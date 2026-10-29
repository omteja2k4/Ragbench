// HTTP-level tests that need NO database and NO Gemini key: they check input validation and error format.
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";

let server, base;
test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("ask: missing question -> 400 with JSON error", async () => {
  const res = await post("/api/chat/ask", { method: "bm25", documentIds: [] });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "VALIDATION");
});

test("ask: unknown method -> 400", async () => {
  const res = await post("/api/chat/ask", { question: "hi", method: "magic", documentIds: ["64b7f0f0f0f0f0f0f0f0f0f0"] });
  assert.equal(res.status, 400);
});

test("ask: bad topK -> 400", async () => {
  const res = await post("/api/chat/ask", { question: "hi", method: "bm25", topK: 99, documentIds: ["64b7f0f0f0f0f0f0f0f0f0f0"] });
  assert.equal(res.status, 400);
});

test("ask: invalid document id -> 400", async () => {
  const res = await post("/api/chat/ask", { question: "hi", method: "bm25", documentIds: ["not-an-id"] });
  assert.equal(res.status, 400);
});

test("upload without a file -> 400", async () => {
  const res = await fetch(base + "/api/documents/upload", { method: "POST", body: new FormData() });
  assert.equal(res.status, 400);
});

test("unknown route -> 404 JSON", async () => {
  const res = await fetch(base + "/api/nope");
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, "NOT_FOUND");
});

test("malformed JSON -> 400", async () => {
  const res = await fetch(base + "/api/chat/ask", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" });
  assert.equal(res.status, 400);
});
