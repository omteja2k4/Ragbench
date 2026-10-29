// One entry point for all three retrieval methods, so chat and evaluation use IDENTICAL code.
import { bm25Search } from "./bm25Search.js";
import { vectorSearch } from "./vectorSearch.js";
import { hybridSearch } from "./hybridSearch.js";

const SCORE_TYPE = { bm25: "bm25", vector: "cosine", hybrid: "rrf" };

// Human-readable location, e.g. "Page 2", "Section: Fees", "Row 14".
export function locationLabel(meta = {}) {
  if (meta.page != null) return `Page ${meta.page}`;
  if (meta.section) return `Section: ${meta.section}`;
  if (meta.row != null) return `Row ${meta.row}`;
  return `Chunk ${meta.chunkIndex ?? "?"}`;
}

// Same result shape for every method.
export function normalizeHit(hit, method, rank) {
  return {
    rank,
    chunkId: hit.chunkId,
    documentId: String(hit.documentId),
    filename: hit.metadata?.filename,
    fileType: hit.metadata?.fileType,
    location: locationLabel(hit.metadata),
    metadata: hit.metadata,
    text: hit.text,
    score: hit.score,
    scoreType: SCORE_TYPE[method], // bm25 score | cosine similarity | rrf fused score
    ...(method === "hybrid" ? { bm25Rank: hit.bm25Rank, vectorRank: hit.vectorRank } : {}),
  };
}

// documentIds must already be ObjectIds.
export async function search(method, query, documentIds, topK = 5) {
  const fn = { bm25: bm25Search, vector: vectorSearch, hybrid: hybridSearch }[method];
  if (!fn) throw new Error(`Unknown search method: ${method}`);
  const hits = await fn(query, documentIds, topK);
  return hits.map((h, i) => normalizeHit(h, method, i + 1));
}
