// Evaluation metrics. All pure functions, so they can be unit-tested without a database.

// Compare retrieved ids with the user-confirmed relevant ids.
// retrievedIds is already cut to top-K and ordered best-first.
// Returns null values when there are no labels (never invents a result).
//
// Dry run: retrieved = [c9, c4, c1], relevant = [c4]  ->  first relevant is at rank 2
//   hit = 1, reciprocalRank = 1/2 = 0.5
export function hitAndRank(retrievedIds, relevantIds) {
  if (!Array.isArray(relevantIds) || relevantIds.length === 0) return { hit: null, firstRelevantRank: null, reciprocalRank: null };
  const relevant = new Set(relevantIds);
  const idx = retrievedIds.findIndex((id) => relevant.has(id));
  if (idx === -1) return { hit: 0, firstRelevantRank: null, reciprocalRank: 0 };
  return { hit: 1, firstRelevantRank: idx + 1, reciprocalRank: 1 / (idx + 1) };
}

// Hit Ratio = questions with a hit / valid labeled questions. Questions with hit === null are ignored.
export function hitRatio(perQuestion) {
  const valid = perQuestion.filter((q) => q.hit === 0 || q.hit === 1);
  if (valid.length === 0) return null;
  return valid.reduce((n, q) => n + q.hit, 0) / valid.length;
}

// MRR = average reciprocal rank over valid labeled questions.
export function mrr(perQuestion) {
  const valid = perQuestion.filter((q) => typeof q.reciprocalRank === "number");
  if (valid.length === 0) return null;
  return valid.reduce((n, q) => n + q.reciprocalRank, 0) / valid.length;
}

const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

// Summary for one method from its per-question results (each is a methodResult from the run).
export function summarizeMethod(methodResults) {
  // "ok" = retrieval worked. (An answer-generation failure still leaves valid retrieval metrics.)
  const ok = methodResults.filter((r) => r && r.status === "ok");
  const errors = methodResults.filter((r) => r && r.status === "error");
  const labeled = ok.filter((r) => r.hit === 0 || r.hit === 1);
  const judged = { correct: 0, partial: 0, incorrect: 0, unavailable: 0 };
  for (const r of ok) {
    const v = r.judgment?.status === "ok" ? r.judgment.verdict : "unavailable";
    judged[v] = (judged[v] || 0) + 1;
  }
  return {
    labeledQuestions: labeled.length,
    hitCount: labeled.filter((r) => r.hit === 1).length,
    hitRatio: hitRatio(ok),
    mrr: mrr(ok),
    avgRetrievalMs: avg(ok.map((r) => r.retrievalMs)),
    avgAnswerMs: avg(ok.filter((r) => typeof r.answerMs === "number").map((r) => r.answerMs)),
    okCount: ok.length,
    errorCount: errors.length,
    judged,
  };
}
