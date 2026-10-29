import Document from "../models/Document.js";
import { toObjectIds, cleanString, parseTopK, parseMethod } from "../config/validate.js";
import { AppError } from "../middleware/errors.js";
import { search } from "../services/search.js";
import { generateAnswer } from "../services/generateAnswer.js";

// POST /api/chat/ask   body: { question, documentIds, method, topK }
// Flow: validate -> retrieve (BM25 | vector | hybrid) -> build prompt -> LLM answer -> validate citations.
export async function ask(req, res) {
  const question = cleanString(req.body.question, "question", { max: 1000 });
  const method = parseMethod(req.body.method);
  const topK = parseTopK(req.body.topK);
  const ids = toObjectIds(req.body.documentIds);

  const ready = await Document.find({ _id: { $in: ids }, status: "ready" }, "_id");
  if (ready.length === 0) throw new AppError(400, "None of the selected documents are ready to search.", "NO_DOCUMENTS");
  const documentIds = ready.map((d) => d._id);

  const t0 = performance.now();
  const sources = await search(method, question, documentIds, topK);
  const retrievalMs = performance.now() - t0;

  const g0 = performance.now();
  const result = await generateAnswer(question, sources);
  const generationMs = performance.now() - g0;

  res.json({
    question,
    method,
    topK,
    answer: result.answer,
    found: result.found,
    citations: result.citations, // only labels that map to really retrieved chunks
    invalidCitations: result.invalidCitations,
    sources, // every retrieved passage, with its score (label depends on scoreType)
    latency: { retrievalMs, generationMs },
  });
}
