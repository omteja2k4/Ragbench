# Code walkthrough (stage by stage)

Use this to explain the project file by file. Each stage lists the files, what they do, how data moves, and how to test.

## 1. Setup and structure
`server/config/env.js` reads `.env` once. `server/app.js` builds the Express app (separate from `server.js` so tests can use it without opening a port). `client/vite.config.js` proxies `/api` to the server.

## 2. Backend server and MongoDB
`server.js` connects (`config/db.js`), marks any run cut off by a restart as "interrupted", checks the Atlas indexes, then listens. `middleware/errors.js` turns every error into `{ error: { code, message } }`. **Why check indexes?** Atlas returns *empty results* (no error) when an index is missing, so the app asks Atlas which indexes exist (`checkSearchIndexes`) and reports problems clearly.
Test: `GET /api/health`.

## 3. Upload and parsing (`services/fileParser.js`, `controllers/documentController.js`)
`detectFileType` checks extension + first bytes; `parsePdf` / `parseDocx` / `parseCsvFile` return `segments` like `{ text, page }`, `{ text, section }` or `{ text, row }`.
Note: pdf-parse is given `new Uint8Array(buffer)` because pooled Node Buffers confuse the old pdf.js inside it (found while testing).

## 4. Chunking and embeddings (`chunker.js`, `embeddings.js`)
**Dry run**, `splitText(text, size=40, overlap=15)` on `"Cats sleep. Dogs bark loudly. Birds sing at dawn."`
1. Split into sentence units: `["Cats sleep.", "Dogs bark loudly.", "Birds sing at dawn."]`
2. Add units until the next one would pass 40 characters: chunk 1 = `"Cats sleep. Dogs bark loudly."` (28 chars).
3. Carry back units totalling at most 15 chars (the overlap); none fits here, so chunk 2 = `"Birds sing at dawn."`.
With overlap 20 and shorter sentences, the last sentence of chunk 1 would be repeated at the start of chunk 2.
`chunkSegments` runs this per segment, so a chunk never crosses a page, section or row. `embedTexts` sends up to 50 texts per Gemini call (stored passages use task type `RETRIEVAL_DOCUMENT`) and checks the vector length.

## 5. MongoDB storage (`ingest.js`, `models/`)
`ingestFile`: hash file, reject duplicates, create Document (processing), parse, chunk, reuse stored embeddings for identical text, embed the rest, `insertMany`, mark ready. On any failure chunks are removed and the document is marked failed.
Chunk id = `fileHash[:10]_index_textHash[:8]`.

## 6. Retrieval (`bm25Search.js`, `vectorSearch.js`, `hybridSearch.js`, `search.js`)
`search(method, query, documentIds, topK)` is the single entry point used by chat, suggestions and evaluation, and returns the same shape for every method.
**RRF dry run**, k = 60. BM25 list `[A, B, C]`, vector list `[B, D, A]`:
- A = 1/61 + 1/63 = 0.03226
- B = 1/62 + 1/61 = 0.03253
- C = 1/63 = 0.01587
- D = 1/62 = 0.01613
Final order: **B, A, D, C**. B and A appear in both lists, so they beat chunks found by only one method. Tested in `tests/rrf.test.js`.

## 7. Answer generation and citations (`generateAnswer.js`, `citations.js`)
Chunks become `<source id="S1" file=".." location="..">text</source>`. The model must answer in JSON `{found, answer, sources}`. `validateCitations` keeps only labels that exist in the retrieved list, so citations can never be invented. Uploaded text cannot close `<source>` tags (`escapeSourceText`).

## 8. Document Q&A UI (`pages/DocumentQA.jsx`, `DocumentPanel.jsx`, `SourceCard.jsx`)
Upload sends one file per request so each file shows its own status. Asking calls `POST /api/chat/ask` and shows the answer, citations, retrieved passages and timings. Scores are labelled by type (BM25 score, cosine similarity, RRF score) because they are not comparable.

## 9. Evaluation questions (`QuestionForm.jsx`, `PassagePicker.jsx`, `evaluationController.js`)
The user ticks passages; the form keeps `{ chunkId: passage }` in state and sends only the ids. The server verifies each id exists inside the selected documents and stores a snapshot (filename, location, preview) so a stale label can still be shown. `questionStatus.js` computes `labeled | no_labels | stale | no_documents` on every read, so deleting a document immediately marks affected questions.

## 10. Metrics and execution (`metrics.js`, `evaluation.js`, `judge.js`)
**Dry run**, relevant = `[c4]`:
- retrieved `[c9, c4, c1]` -> hit 1, rank 2, reciprocal rank 0.5
- retrieved `[c2, c3]` -> hit 0, reciprocal rank 0
- question without labels -> all `null` (excluded, never counted as 0)
Hit Ratio over those 2 labeled questions = 1/2 = 50%; MRR = (0.5 + 0) / 2 = 0.25.
`startEvaluation` creates a run, returns 202 and keeps working in the background. For each question and method: time retrieval, compute hit/rank, generate the answer (timed together with retrieval), then call the judge (not timed). The run is saved after every question. Only one run at a time (409 otherwise).

## 11. Dashboard (`ResultsDashboard.jsx`, `PerQuestionResults.jsx`, `RunPanel.jsx`)
`RunPanel` polls `GET /runs/:id` every 1.5 s. The dashboard shows the table, three Recharts bar charts (missing values are not drawn as zero), judge counts and expandable per-question details.

## 12. Tests
`npm test` runs 44 tests in `server/tests/`. They need no database or API key.

## Manual end-to-end checklist (needs Atlas + Gemini)
1. Upload a PDF; see "Ready, N chunks". Open Atlas > `chunks` and confirm `metadata.page` and `embedding` exist.
2. Ask the same question with BM25, Vector, Hybrid; check citations match the passages shown.
3. Ask something not in the file; expect "could not be found".
4. Evaluation: add a question, click *Find supporting passages*, tick a passage, save; status shows "Labeled".
5. Add a second question and skip passages; status shows "No passages selected".
6. Run Evaluation; watch progress; check the table, charts and per-question details.
7. Delete the document; the question shows "Documents deleted" / stale and is excluded from metrics.
