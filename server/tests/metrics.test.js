import test from "node:test";
import assert from "node:assert/strict";
import { hitAndRank, hitRatio, mrr, summarizeMethod } from "../services/metrics.js";

test("hit at rank 1 -> hit 1, RR 1", () => {
  assert.deepEqual(hitAndRank(["c1", "c2"], ["c1"]), { hit: 1, firstRelevantRank: 1, reciprocalRank: 1 });
});

test("hit at rank 2 -> RR 0.5", () => {
  const r = hitAndRank(["c9", "c4", "c1"], ["c4"]);
  assert.equal(r.hit, 1);
  assert.equal(r.firstRelevantRank, 2);
  assert.equal(r.reciprocalRank, 0.5);
});

test("several relevant chunks: the FIRST one found counts", () => {
  const r = hitAndRank(["c9", "c7", "c4"], ["c4", "c7"]);
  assert.equal(r.firstRelevantRank, 2);
});

test("no relevant chunk retrieved -> hit 0, RR 0", () => {
  assert.deepEqual(hitAndRank(["a", "b"], ["z"]), { hit: 0, firstRelevantRank: null, reciprocalRank: 0 });
});

test("missing labels -> metrics are null (unavailable), never 0", () => {
  assert.deepEqual(hitAndRank(["a"], []), { hit: null, firstRelevantRank: null, reciprocalRank: null });
  assert.deepEqual(hitAndRank(["a"], undefined), { hit: null, firstRelevantRank: null, reciprocalRank: null });
});

test("spec example: 8 hits out of 10 questions = 80%", () => {
  const qs = Array.from({ length: 10 }, (_, i) => ({ hit: i < 8 ? 1 : 0 }));
  assert.equal(hitRatio(qs), 0.8);
});

test("spec example: MRR of ranks 1, 2, none = 0.5", () => {
  assert.equal(mrr([{ reciprocalRank: 1 }, { reciprocalRank: 0.5 }, { reciprocalRank: 0 }]), 0.5);
});

test("unlabeled questions are excluded from Hit Ratio and MRR", () => {
  const qs = [{ hit: 1, reciprocalRank: 1 }, { hit: null, reciprocalRank: null }, { hit: 0, reciprocalRank: 0 }];
  assert.equal(hitRatio(qs), 0.5);
  assert.equal(mrr(qs), 0.5);
});

test("all questions unlabeled -> null, not 0", () => {
  assert.equal(hitRatio([{ hit: null }]), null);
  assert.equal(mrr([]), null);
});

test("summarizeMethod: averages latency, counts errors and judgments", () => {
  const s = summarizeMethod([
    { status: "ok", hit: 1, reciprocalRank: 1, retrievalMs: 100, answerMs: 1000, judgment: { status: "ok", verdict: "correct" } },
    { status: "ok", hit: 0, reciprocalRank: 0, retrievalMs: 300, answerMs: 2000, judgment: { status: "ok", verdict: "incorrect" } },
    { status: "ok", hit: null, reciprocalRank: null, retrievalMs: 200, answerMs: null, answerError: "x", judgment: { status: "unavailable" } },
    { status: "error", error: "index missing" },
  ]);
  assert.equal(s.hitRatio, 0.5);
  assert.equal(s.mrr, 0.5);
  assert.equal(s.labeledQuestions, 2);
  assert.equal(s.avgRetrievalMs, 200);
  assert.equal(s.avgAnswerMs, 1500);
  assert.equal(s.errorCount, 1);
  assert.deepEqual(s.judged, { correct: 1, partial: 0, incorrect: 1, unavailable: 1 });
});
