// Method 2 - Vector similarity search using MongoDB Atlas Vector Search ($vectorSearch).
// Embedding the question, then asking Atlas for the stored chunk embeddings closest to it (cosine similarity).
import Chunk from "../models/Chunk.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errors.js";
import { checkSearchIndexes } from "../config/db.js";
import { embedQuery } from "./embeddings.js";

export async function vectorSearch(query, documentIds, topK = 5) {
  const idx = await checkSearchIndexes();
  if (idx.vector === "missing" || idx.vector === "building") {
    throw new AppError(503, `Vector search is not ready: Atlas Vector Search index "${env.vectorIndex}" is ${idx.vector}. See README > MongoDB Atlas setup.`, "INDEX_NOT_READY");
  }
  const queryVector = await embedQuery(query); // 1 small API call per question
  try {
    return await Chunk.aggregate([
      {
        $vectorSearch: {
          index: env.vectorIndex,
          path: "embedding",
          queryVector,
          // numCandidates = how many nearest neighbours Atlas examines before returning `limit`. Higher = more accurate, slower.
          numCandidates: Math.min(Math.max(topK * 20, 100), 1000),
          limit: topK,
          filter: { documentId: { $in: documentIds } },
        },
      },
      { $addFields: { score: { $meta: "vectorSearchScore" } } },
      { $project: { embedding: 0, textHash: 0 } },
    ]);
  } catch (err) {
    throw new AppError(500, `Vector search failed: ${err.message}. Check the vector index definition (dimensions ${env.embeddingDims}, filter on documentId).`, "SEARCH_FAILED");
  }
}
