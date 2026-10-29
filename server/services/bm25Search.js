// Method 1 - BM25 keyword search using MongoDB Atlas Search ($search).
// Atlas Search is built on Lucene, whose default scoring for the text operator is BM25.
import Chunk from "../models/Chunk.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errors.js";
import { checkSearchIndexes } from "../config/db.js";

// Every search method returns the same shape (see normalizeHit in search.js).
export async function bm25Search(query, documentIds, topK = 5) {
  const idx = await checkSearchIndexes();
  if (idx.text === "missing" || idx.text === "building") {
    throw new AppError(503, `BM25 search is not ready: Atlas Search index "${env.searchIndex}" is ${idx.text}. See README > MongoDB Atlas setup.`, "INDEX_NOT_READY");
  }
  try {
    return await Chunk.aggregate([
      {
        $search: {
          index: env.searchIndex,
          compound: {
            must: [{ text: { query, path: "text" } }],
            // Only look inside the documents the user selected.
            filter: [{ in: { path: "documentId", value: documentIds } }],
          },
        },
      },
      { $limit: topK },
      { $addFields: { score: { $meta: "searchScore" } } },
      { $project: { embedding: 0, textHash: 0 } },
    ]);
  } catch (err) {
    throw new AppError(500, `BM25 search failed: ${err.message}. Check that the Atlas Search index definition matches the README.`, "SEARCH_FAILED");
  }
}
