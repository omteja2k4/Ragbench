// LLM-as-judge: a SEPARATE model call that compares the generated answer with the expected answer.
// It runs AFTER generation and is NOT included in latency numbers.
// The verdict is an automated assessment, not guaranteed truth.
import { env } from "../config/env.js";
import { getAI, withRetry } from "./embeddings.js";

const VERDICTS = ["correct", "partial", "incorrect"];

const JUDGE_PROMPT = `You compare a generated answer with an expected answer for the same question.
Judge only whether the generated answer conveys the same facts as the expected answer.
- "correct": same facts, wording may differ
- "partial": some of the expected facts are present, or it is correct but incomplete / adds a wrong detail
- "incorrect": missing, contradicting, or says the information was not found
Reply with JSON only: {"verdict": "correct" | "partial" | "incorrect", "explanation": "one short sentence"}`;

export async function judgeAnswer(question, expected, generated) {
  try {
    const res = await withRetry(() =>
      getAI().models.generateContent({
        model: env.chatModel,
        contents: `Question: ${question}\nExpected answer: ${expected}\nGenerated answer: ${generated}`,
        config: { systemInstruction: JUDGE_PROMPT, responseMimeType: "application/json" },
      })
    );
    const parsed = JSON.parse(res.text || "{}");
    if (!VERDICTS.includes(parsed.verdict)) throw new Error("judge returned an unknown verdict");
    return { status: "ok", verdict: parsed.verdict, explanation: String(parsed.explanation || "").slice(0, 300) };
  } catch (err) {
    // Judging failed: report it as unavailable. Never guess a verdict.
    return { status: "unavailable", verdict: null, explanation: `Judge call failed: ${err.message}` };
  }
}
