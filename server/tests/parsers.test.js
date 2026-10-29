import test from "node:test";
import assert from "node:assert/strict";
import { parsePdf, parseCsvFile, detectFileType, sanitizeFilename } from "../services/fileParser.js";
import { chunkSegments } from "../services/chunker.js";
import { makeChunkId } from "../services/ingest.js";
import { makePdf } from "./helpers.js";

test("PDF: text is extracted per page and page numbers are preserved", async () => {
  const { segments, pageCount } = await parsePdf(makePdf(["The hostel gate closes at 11 PM.", "Students need 75 percent attendance."]));
  assert.equal(pageCount, 2);
  assert.equal(segments[0].page, 1);
  assert.match(segments[0].text, /11 PM/);
  assert.equal(segments[1].page, 2);
  const chunks = chunkSegments(segments);
  assert.deepEqual(chunks.map((c) => c.metadata.page), [1, 2]);
});

test("PDF with no selectable text is reported as needing OCR", async () => {
  await assert.rejects(() => parsePdf(makePdf(["", ""])), (e) => e.code === "NEEDS_OCR");
});

test("PDF: corrupted file gives a clear error", async () => {
  await assert.rejects(() => parsePdf(Buffer.from("%PDF-1.4 garbage")), (e) => e.code === "BAD_PDF" || e.code === "EMPTY_FILE");
});

test("CSV: headers, quoted fields, empty values and original row numbers", () => {
  const csv = 'name,city,note\nAsha,"Bhopal, MP",\nRavi,Indore,"said ""hi"""\n,,\n';
  const { segments } = parseCsvFile(Buffer.from(csv));
  assert.equal(segments.length, 2); // the all-empty row is skipped
  assert.equal(segments[0].row, 2); // first data row is row 2 (header = row 1)
  assert.equal(segments[0].text, "name: Asha | city: Bhopal, MP"); // empty "note" omitted, quoted comma kept
  assert.equal(segments[1].text, 'name: Ravi | city: Indore | note: said "hi"');
});

test("CSV: header-only file is rejected", () => {
  assert.throws(() => parseCsvFile(Buffer.from("a,b\n")), (e) => e.code === "EMPTY_FILE");
});

test("file validation: type, magic bytes, empty files", () => {
  assert.equal(detectFileType("a.pdf", Buffer.from("%PDF-1.7 x")), "pdf");
  assert.throws(() => detectFileType("a.pdf", Buffer.from("not a pdf")), (e) => e.code === "BAD_FILE");
  assert.throws(() => detectFileType("a.exe", Buffer.from("MZ")), (e) => e.code === "UNSUPPORTED_TYPE");
  assert.throws(() => detectFileType("a.csv", Buffer.alloc(0)), (e) => e.code === "EMPTY_FILE");
});

test("filenames are sanitised", () => {
  assert.equal(sanitizeFilename("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(sanitizeFilename("my<script>.pdf"), "my_script_.pdf");
});

test("chunk ids are stable for identical input and change when text changes", () => {
  assert.equal(makeChunkId("abcdef1234567", 3, "ffff0000aaaa"), makeChunkId("abcdef1234567", 3, "ffff0000aaaa"));
  assert.notEqual(makeChunkId("abcdef1234567", 3, "ffff0000aaaa"), makeChunkId("abcdef1234567", 3, "eeee0000aaaa"));
});
