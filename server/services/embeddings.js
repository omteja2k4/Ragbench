// Gemini client + embedding helper. The API key lives only here on the server.
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errors.js";

let client = null;
export function getAI() {
  if (!env.geminiKey) throw new AppError(503, "GEMINI_API_KEY is not set on the server. Add it to server/.env and restart.", "NO_API_KEY");
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiKey });
  return client;
}

// Turn Gemini SDK errors into a clear message for the UI.
export function wrapAIError(err, what) {
  if (err instanceof AppError) return err;
  const status = err.status || err.code;
  let msg = `Gemini ${what} failed: ${err.message}`;
  if (status === 400 && /API key/i.test(err.message)) msg = "Gemini rejected the API key. Check GEMINI_API_KEY.";
  else if (status === 401 || status === 403) msg = "Gemini rejected the request (invalid key or no access). Check GEMINI_API_KEY.";
  else if (status === 404) msg = `Gemini model not found (${err.message}). Check GEMINI_CHAT_MODEL / EMBEDDING_MODEL in server/.env.`;
  else if (status === 429) msg = "Gemini rate limit or quota reached (429). Wait a minute and retry (free-tier limits are low).";
  return new AppError(502, msg, "AI_ERROR");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry temporary problems (rate limit 429, overloaded 503) with growing waits: 2s, 4s, 8s.
export async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status || err.code;
      if (attempt >= 3 || ![429, 500, 503].includes(status)) throw err;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

// taskType tells Gemini how the vector will be used: stored passages use RETRIEVAL_DOCUMENT,
// the user's question uses RETRIEVAL_QUERY. This gives better matches between the two.
// embedTexts(["a","b"]) -> [[...768 numbers], [...768 numbers]]  (same order as the input)
export async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT", batchSize = 50) {
  const ai = getAI();
  const vectors = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const res = await withRetry(() =>
        ai.models.embedContent({ model: env.embeddingModel, contents: batch, config: { taskType, outputDimensionality: env.embeddingDims } })
      );
      const embeddings = res.embeddings || [];
      if (embeddings.length !== batch.length) throw new Error(`expected ${batch.length} embeddings but got ${embeddings.length}`);
      for (const e of embeddings) {
        if (e.values?.length !== env.embeddingDims) {
          throw new AppError(500, `Embedding has ${e.values?.length} dimensions but EMBEDDING_DIMENSIONS is ${env.embeddingDims}. The Atlas vector index must match.`, "DIMENSION_MISMATCH");
        }
        vectors.push(e.values);
      }
    } catch (err) {
      throw wrapAIError(err, "embedding request");
    }
  }
  return vectors;
}

export async function embedQuery(text) {
  const [vec] = await embedTexts([text], "RETRIEVAL_QUERY");
  return vec;
}
