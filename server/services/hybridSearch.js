// Method 3 - Hybrid search = BM25 + vector, combined with Reciprocal Rank Fusion (RRF).
import { env } from "../config/env.js";
import { bm25Search } from "./bm25Search.js";
import { vectorSearch } from "./vectorSearch.js";

// RRF: each list gives a chunk the score 1 / (k + rank). A chunk's final score is the SUM over lists.
//  - We use ranks, not raw scores, because BM25 scores (e.g. 7.3) and cosine scores (e.g. 0.82) are on different scales.
//  - k (default 60) softens the gap between rank 1 and rank 2: with k=60 rank1 -> 1/61, rank2 -> 1/62.
//    A small k would make the top positions dominate; a large k flattens the differences.
//
// Dry run, k=60:   BM25 list: [A, B, C]    Vector list: [B, D, A]
//   A = 1/61 + 1/63 = 0.03226     B = 1/62 + 1/61 = 0.03253     C = 1/63 = 0.01587     D = 1/62 = 0.01613
//   Final order: B, A, D, C   (B and A appear in both lists so they win)
//
// lists: array of ranked arrays of items that have a `chunkId`. Pure function (easy to test).
export function reciprocalRankFusion(lists, k = 60, topK = 5) {
  const merged = new Map(); // chunkId -> { item, score, ranks }
  for (const [listNo, list] of lists.entries()) {
    list.forEach((item, i) => {
      const rank = i + 1;
      const entry = merged.get(item.chunkId) || { item, score: 0, ranks: {} }; // dedupe by chunkId
      entry.score += 1 / (k + rank);
      entry.ranks[listNo] = rank;
      merged.set(item.chunkId, entry);
    });
  }
  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.item.chunkId.localeCompare(b.item.chunkId)) // tie-break = deterministic
    .slice(0, topK)
    .map((e) => ({ ...e.item, score: e.score, bm25Rank: e.ranks[0] ?? null, vectorRank: e.ranks[1] ?? null }));
}

export async function hybridSearch(query, documentIds, topK = 5) {
  // Fetch a bigger candidate pool from each method, then cut to the same final top-K as the other methods.
  const pool = Math.max(env.hybridPool, topK);
  const [bm25, vec] = await Promise.all([bm25Search(query, documentIds, pool), vectorSearch(query, documentIds, pool)]);
  return reciprocalRankFusion([bm25, vec], env.rrfK, topK);
}
