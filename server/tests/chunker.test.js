import test from "node:test";
import assert from "node:assert/strict";
import { splitText, chunkSegments, cleanText } from "../services/chunker.js";

test("short text stays in one chunk", () => {
  assert.deepEqual(splitText("Hello world.", 100, 10), ["Hello world."]);
});

test("empty text gives no chunks", () => {
  assert.deepEqual(splitText("   ", 100, 10), []);
});

test("long text is split and no chunk is larger than the size", () => {
  const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const chunks = splitText(text, 120, 30);
  assert.ok(chunks.length > 5);
  for (const c of chunks) assert.ok(c.length <= 120, `chunk too long: ${c.length}`);
});

test("overlap: end of one chunk is repeated at the start of the next", () => {
  const text = "Alpha one. Bravo two. Charlie three. Delta four. Echo five. Foxtrot six.";
  const chunks = splitText(text, 35, 15);
  assert.ok(chunks.length >= 3);
  for (let i = 1; i < chunks.length; i++) {
    const prevLastSentence = chunks[i - 1].split(/(?<=\.)\s/).pop();
    assert.ok(chunks[i].startsWith(prevLastSentence), `chunk ${i} should start with "${prevLastSentence}" but is "${chunks[i]}"`);
  }
});

test("no text is lost: every sentence appears in at least one chunk", () => {
  const sentences = Array.from({ length: 20 }, (_, i) => `Fact ${i} holds.`);
  const chunks = splitText(sentences.join(" "), 80, 20);
  for (const s of sentences) assert.ok(chunks.some((c) => c.includes(s)), `missing: ${s}`);
});

test("a very long word is hard-cut instead of looping forever", () => {
  const chunks = splitText("x".repeat(250), 100, 10);
  assert.equal(chunks.length, 3);
});

test("overlap >= size is rejected", () => {
  assert.throws(() => splitText("abc", 10, 10));
});

test("chunkSegments keeps page / section / row metadata and numbers chunks", () => {
  const out = chunkSegments(
    [{ text: "Page one text.", page: 1 }, { text: "Fees section.", section: "Fees" }, { text: "name: A | age: 3", row: 7 }],
    { chunkSize: 100, chunkOverlap: 10 }
  );
  assert.deepEqual(out.map((c) => c.metadata), [
    { chunkIndex: 0, page: 1 },
    { chunkIndex: 1, section: "Fees" },
    { chunkIndex: 2, row: 7 },
  ]);
});

test("cleanText normalises whitespace", () => {
  assert.equal(cleanText("a   b\r\n\r\n\r\n\r\nc\u0000"), "a b\n\nc");
});
