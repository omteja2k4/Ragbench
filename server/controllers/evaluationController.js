import EvaluationQuestion from "../models/EvaluationQuestion.js";
import EvaluationRun from "../models/EvaluationRun.js";
import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import { AppError } from "../middleware/errors.js";
import { toObjectIds, cleanString, parseTopK } from "../config/validate.js";
import { search, locationLabel } from "../services/search.js";
import { attachStatus } from "../services/questionStatus.js";
import { startEvaluation } from "../services/evaluation.js";

// ---------- Questions ----------
// Checks the user-selected chunk ids really exist inside the selected documents, and builds snapshots.
async function prepareLabels(chunkIds, documentIds) {
  const ids = [...new Set((Array.isArray(chunkIds) ? chunkIds : []).map(String))];
  if (ids.length === 0) return { ids: [], snapshots: [] };
  const found = await Chunk.find({ chunkId: { $in: ids }, documentId: { $in: documentIds } }).lean();
  if (found.length !== ids.length) {
    throw new AppError(400, "Some selected passages no longer exist or are outside the selected documents. Please re-select the supporting passages.", "STALE_LABELS");
  }
  const snapshots = found.map((c) => ({ chunkId: c.chunkId, filename: c.metadata.filename, location: locationLabel(c.metadata), preview: c.text.slice(0, 160) }));
  return { ids, snapshots };
}

async function readQuestionBody(body) {
  const question = cleanString(body.question, "question", { max: 1000 });
  const expectedAnswer = cleanString(body.expectedAnswer, "expectedAnswer", { max: 2000 });
  const documentIds = toObjectIds(body.documentIds);
  const found = await Document.countDocuments({ _id: { $in: documentIds }, status: "ready" });
  if (found !== documentIds.length) throw new AppError(400, "One or more selected documents do not exist or are not ready.", "NO_DOCUMENTS");
  const labels = await prepareLabels(body.relevantChunkIds, documentIds);
  return { question, expectedAnswer, documentIds, relevantChunkIds: labels.ids, relevantSnapshots: labels.snapshots };
}

export async function createQuestion(req, res) {
  const data = await readQuestionBody(req.body);
  const q = await EvaluationQuestion.create(data);
  const [withStatus] = await attachStatus([q]);
  res.status(201).json({ question: withStatus });
}

export async function listQuestions(req, res) {
  const rows = await EvaluationQuestion.find().sort({ createdAt: 1 });
  res.json({ questions: await attachStatus(rows) });
}

export async function updateQuestion(req, res) {
  const data = await readQuestionBody(req.body);
  const q = await EvaluationQuestion.findByIdAndUpdate(req.params.id, { ...data, updatedAt: new Date() }, { new: true });
  if (!q) throw new AppError(404, "Question not found.", "NOT_FOUND");
  const [withStatus] = await attachStatus([q]);
  res.json({ question: withStatus });
}

export async function deleteQuestion(req, res) {
  const q = await EvaluationQuestion.findByIdAndDelete(req.params.id);
  if (!q) throw new AppError(404, "Question not found.", "NOT_FOUND");
  res.json({ ok: true });
}

// ---------- Supporting-passage suggestions ----------
// POST /api/evaluation/suggest-chunks  body: { question, expectedAnswer?, documentIds, topK? }
// Only SUGGESTS candidates. Nothing is saved until the user ticks checkboxes and saves the question.
// The expected answer is added to the search text here (this is labeling, not evaluation) to find the answer passage more easily.
export async function suggestChunks(req, res) {
  const question = cleanString(req.body.question, "question", { max: 1000 });
  const extra = cleanString(req.body.expectedAnswer, "expectedAnswer", { max: 2000, required: false });
  const documentIds = toObjectIds(req.body.documentIds);
  const topK = Math.min(10, parseTopK(req.body.topK, 8));
  const suggestions = await search("hybrid", extra ? `${question} ${extra}` : question, documentIds, topK);
  res.json({ suggestions: suggestions.map(({ chunkId, documentId, filename, location, text, score, rank }) => ({ chunkId, documentId, filename, location, text, score, rank })) });
}

// ---------- Runs ----------
export async function runEvaluation(req, res) {
  const topK = parseTopK(req.body?.topK);
  const run = await startEvaluation(topK);
  res.status(202).json({ runId: run._id, status: run.status, progress: run.progress });
}

export async function listRuns(req, res) {
  const runs = await EvaluationRun.find({}, "createdAt finishedAt status config progress summary error").sort({ createdAt: -1 }).limit(50);
  res.json({ runs });
}

export async function getRun(req, res) {
  const run = await EvaluationRun.findById(req.params.id);
  if (!run) throw new AppError(404, "Run not found.", "NOT_FOUND");
  res.json({ run });
}
