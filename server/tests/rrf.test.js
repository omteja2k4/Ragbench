import test from "node:test";
import assert from "node:assert/strict";
import { reciprocalRankFusion } from "../services/hybridSearch.js";

const item = (id) => ({ chunkId: id, text: id });

test("RRF matches the hand-calculated example (k=60)", () => {
  const bm25 = ["A", "B", "C"].map(item);
  const vec = ["B", "D", "A"].map(item);
  const out = reciprocalRankFusion([bm25, vec], 60, 10);
  assert.deepEqual(out.map((o) => o.chunkId), ["B", "A", "D", "C"]);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(out[0].score, 1 / 62 + 1 / 61); // B
  near(out[1].score, 1 / 61 + 1 / 63); // A
  near(out[2].score, 1 / 62); // D
  near(out[3].score, 1 / 63); // C
});

test("RRF removes duplicates by chunkId and records each list's rank", () => {
  const out = reciprocalRankFusion([[item("A")], [item("X"), item("A")]], 60, 10);
  assert.equal(out.filter((o) => o.chunkId === "A").length, 1);
  const a = out.find((o) => o.chunkId === "A");
  assert.equal(a.bm25Rank, 1);
  assert.equal(a.vectorRank, 2);
  assert.equal(out.find((o) => o.chunkId === "X").bm25Rank, null);
});

test("RRF applies the final top-K cutoff", () => {
  const out = reciprocalRankFusion([["A", "B", "C", "D"].map(item), ["E", "F", "G"].map(item)], 60, 3);
  assert.equal(out.length, 3);
});

test("RRF with one empty list still works", () => {
  const out = reciprocalRankFusion([[], ["A", "B"].map(item)], 60, 5);
  assert.deepEqual(out.map((o) => o.chunkId), ["A", "B"]);
});

test("RRF ignores raw score magnitudes (uses ranks only)", () => {
  const bm25 = [{ chunkId: "A", score: 999 }, { chunkId: "B", score: 1 }];
  const vec = [{ chunkId: "B", score: 0.99 }, { chunkId: "A", score: 0.1 }];
  const out = reciprocalRankFusion([bm25, vec], 60, 2);
  assert.ok(Math.abs(out[0].score - out[1].score) < 1e-12); // symmetric ranks -> equal scores
});
