// The evaluation runner. For every saved question and every method (bm25, vector, hybrid):
//   retrieval (timed) -> hit/rank -> answer generation (timed) -> judge (not timed) -> save
// The expected answer is used ONLY by the judge, after generation. It never reaches retrieval or generation.
import mongoose from "mongoose";
import EvaluationQuestion from "../models/EvaluationQuestion.js";
import EvaluationRun from "../models/EvaluationRun.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errors.js";
import { METHODS } from "../config/validate.js";
import { search } from "./search.js";
import { generateAnswer } from "./generateAnswer.js";
import { judgeAnswer } from "./judge.js";
import { hitAndRank, summarizeMethod } from "./metrics.js";
import { attachStatus } from "./questionStatus.js";

let activeRunId = null; // only ONE evaluation may run at a time (protects the API budget)
export const isRunning = () => activeRunId !== null;

function buildSummary(results) {
  const summary = {};
  for (const m of METHODS) summary[m] = summarizeMethod(results.map((r) => r.methods?.[m]).filter(Boolean));
  return summary;
}

// Evaluate ONE method on ONE question.
async function evalMethod(method, q, topK) {
  const documentIds = q.activeDocumentIds.map((id) => new mongoose.Types.ObjectId(id));
  const labeled = q.status === "labeled";
  const out = { status: "ok" };

  const t0 = performance.now();
  let chunks;
  try {
    chunks = await search(method, q.question, documentIds, topK); // only the question is passed in
  } catch (err) {
    return { status: "error", error: err.message };
  }
  const retrievalMs = performance.now() - t0;

  // Retrieval metrics: null when the question has no valid labels.
  const rank = hitAndRank(chunks.map((c) => c.chunkId), labeled ? q.relevantChunkIds : []);
  Object.assign(out, rank, {
    retrievalMs,
    retrieved: chunks.map((c) => ({ chunkId: c.chunkId, rank: c.rank, score: c.score, scoreType: c.scoreType, filename: c.filename, location: c.location, text: c.text })),
  });

  // Answer generation, timed together with retrieval (end-to-end answer latency).
  let ans;
  try {
    ans = await generateAnswer(q.question, chunks);
    out.answerMs = performance.now() - t0;
    Object.assign(out, { answer: ans.answer, answerFound: ans.found, citedChunkIds: ans.citations.map((c) => c.chunkId) });
  } catch (err) {
    out.answerError = err.message;
    out.judgment = { status: "unavailable", verdict: null, explanation: "No answer was generated, so nothing could be judged." };
    return out;
  }

  // Judge (separate call, outside the latency timers).
  out.judgment = await judgeAnswer(q.question, q.expectedAnswer, ans.answer);
  return out;
}

export async function startEvaluation(topK) {
  if (activeRunId) throw new AppError(409, "An evaluation is already running. Wait for it to finish.", "RUN_IN_PROGRESS");
  const questions = await attachStatus(await EvaluationQuestion.find().sort({ createdAt: 1 }));
  if (questions.length === 0) throw new AppError(400, "Add at least one test question first.", "NO_QUESTIONS");

  const run = await EvaluationRun.create({
    status: "running",
    config: { topK, chatModel: env.chatModel, embeddingModel: env.embeddingModel, rrfK: env.rrfK, hybridPool: env.hybridPool, chunkSize: env.chunkSize, chunkOverlap: env.chunkOverlap },
    progress: { done: 0, total: questions.length },
  });
  activeRunId = String(run._id);
  runAll(run._id, questions, topK); // NOT awaited: runs in the background, the UI polls for progress
  return run;
}

async function runAll(runId, questions, topK) {
  try {
    const run = await EvaluationRun.findById(runId);
    for (const q of questions) {
      run.progress.current = q.question;
      const result = { questionId: q._id, question: q.question, expectedAnswer: q.expectedAnswer, labelStatus: q.status, relevantChunkIds: q.relevantChunkIds, methods: {} };
      if (q.status === "no_documents") {
        result.skippedReason = "None of this question's documents exist any more.";
      } else {
        // Methods run one after another (not in parallel) so latency numbers are not distorted by each other.
        for (const method of METHODS) result.methods[method] = await evalMethod(method, q, topK);
      }
      run.results.push(result);
      run.progress.done += 1;
      run.summary = buildSummary(run.results);
      await run.save(); // save after every question: partial runs are never lost
    }
    run.status = "completed";
    run.finishedAt = new Date();
    run.progress.current = "";
    await run.save();
  } catch (err) {
    console.error("Evaluation run failed:", err);
    await EvaluationRun.updateOne({ _id: runId }, { status: "failed", error: err.message, finishedAt: new Date() });
  } finally {
    activeRunId = null;
  }
}

// On server start, any run still marked "running" was cut off by a restart.
export async function markInterruptedRuns() {
  await EvaluationRun.updateMany({ status: "running" }, { status: "interrupted", error: "Server restarted during the run.", finishedAt: new Date() });
}
