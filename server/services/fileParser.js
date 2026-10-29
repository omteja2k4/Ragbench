// Text extraction. Each parser returns { segments, pageCount? } where
// segments = [{ text, page? | section? | row? }]. The chunker then splits segments into chunks.
import { createRequire } from "node:module";
import mammoth from "mammoth";
import { parse as parseCsv } from "csv-parse/sync";
import { AppError } from "../middleware/errors.js";
import { env } from "../config/env.js";
import { cleanText } from "./chunker.js";

// Import the inner file: the package's index.js runs a debug routine when loaded as ESM.
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

// ---------- PDF ----------
export async function parsePdf(buffer) {
  const pages = [];
  try {
    // pdf-parse calls pagerender once per page, in order. We capture each page's text ourselves
    // so we can keep the real page numbers.
    // new Uint8Array(buffer) makes a clean copy: Node's pooled Buffers have a byteOffset that this old pdf.js version ignores.
    await pdfParse(new Uint8Array(buffer), {
      pagerender: async (pageData) => {
        const content = await pageData.getTextContent({ normalizeWhitespace: true });
        let lastY;
        let text = "";
        for (const item of content.items) {
          const y = item.transform[5];
          text += lastY === undefined || lastY === y ? item.str : "\n" + item.str;
          lastY = y;
        }
        pages.push(text);
        return text;
      },
    });
  } catch (err) {
    throw new AppError(422, `Could not read this PDF (it may be corrupted or password-protected): ${err.message}`, "BAD_PDF");
  }
  const segments = pages
    .map((text, i) => ({ text: cleanText(text), page: i + 1 }))
    .filter((s) => s.text.length > 0);
  const totalChars = segments.reduce((n, s) => n + s.text.length, 0);
  if (pages.length === 0) throw new AppError(422, "This PDF has no pages.", "EMPTY_FILE");
  if (totalChars < 20) {
    throw new AppError(422, "No selectable text found. This looks like a scanned PDF, which needs OCR. OCR is not supported in version 1.", "NEEDS_OCR");
  }
  return { segments, pageCount: pages.length };
}

// ---------- DOCX ----------
const decodeHtml = (s) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const stripTags = (s) => decodeHtml(s.replace(/<[^>]+>/g, "")).trim();

export async function parseDocx(buffer) {
  let html;
  try {
    ({ value: html } = await mammoth.convertToHtml({ buffer }));
  } catch (err) {
    throw new AppError(422, `Could not read this DOCX file: ${err.message}`, "BAD_DOCX");
  }
  // Walk headings (h1-h6), paragraphs, list items and table rows in order.
  const blocks = [...html.matchAll(/<(h[1-6]|p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/g)];
  const segments = [];
  let heading = null; // current section title
  let buf = []; // paragraphs of the current section
  let paraNo = 0; // paragraph counter (used when the file has no headings)
  let firstPara = 1;

  const flush = () => {
    const text = cleanText(buf.join("\n\n"));
    if (text) {
      const section = heading || `Paragraphs ${firstPara}-${paraNo}`;
      segments.push({ text, section });
    }
    buf = [];
  };

  for (const [, tag, inner] of blocks) {
    const text = stripTags(inner);
    if (!text) continue;
    if (tag.startsWith("h")) {
      flush();
      heading = text;
      firstPara = paraNo + 1;
      buf.push(text); // keep the heading text inside the chunk so it is searchable
    } else {
      paraNo++;
      buf.push(text);
      // Files without headings: close a group every 8 paragraphs so section labels stay specific.
      if (!heading && buf.length >= 8) {
        flush();
        firstPara = paraNo + 1;
      }
    }
  }
  flush();
  if (segments.length === 0) throw new AppError(422, "This DOCX file contains no readable text.", "EMPTY_FILE");
  return { segments };
}

// ---------- CSV ----------
export function parseCsvFile(buffer) {
  let rows;
  try {
    rows = parseCsv(buffer.toString("utf8"), {
      columns: true, // first line = headers
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      delimiter: [",", ";", "\t"],
    });
  } catch (err) {
    throw new AppError(422, `Could not parse this CSV file: ${err.message}`, "BAD_CSV");
  }
  if (rows.length === 0) throw new AppError(422, "This CSV file has no data rows.", "EMPTY_FILE");
  if (rows.length > env.maxCsvRows) {
    throw new AppError(422, `This CSV has ${rows.length} rows; the limit is ${env.maxCsvRows} (each row becomes one embedding).`, "TOO_MANY_ROWS");
  }
  const segments = [];
  rows.forEach((record, i) => {
    // Empty values are skipped; the rest become "column: value" pairs.
    const pairs = Object.entries(record)
      .filter(([k, v]) => k && v !== undefined && v !== null && String(v).trim() !== "")
      .map(([k, v]) => `${k}: ${String(v).trim()}`);
    if (pairs.length === 0) return;
    // Row 1 is the header line, so the first data row is row 2 (same numbering as Excel).
    segments.push({ text: pairs.join(" | "), row: i + 2 });
  });
  if (segments.length === 0) throw new AppError(422, "This CSV file has no readable values.", "EMPTY_FILE");
  return { segments };
}

// ---------- Validation + dispatcher ----------
export function sanitizeFilename(name) {
  const base = String(name || "file").split(/[\\/]/).pop();
  const cleaned = base.replace(/[^\w.\- ()]/g, "_").replace(/\.{2,}/g, ".").trim();
  return cleaned.slice(0, 120) || "file";
}

// Decide the file type from the extension AND check the first bytes (magic numbers).
export function detectFileType(filename, buffer) {
  const ext = filename.toLowerCase().split(".").pop();
  if (!buffer || buffer.length === 0) throw new AppError(422, "The file is empty.", "EMPTY_FILE");
  if (ext === "pdf") {
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new AppError(422, "This file is not a real PDF.", "BAD_FILE");
    return "pdf";
  }
  if (ext === "docx") {
    if (buffer.subarray(0, 2).toString("latin1") !== "PK") throw new AppError(422, "This file is not a real DOCX.", "BAD_FILE");
    return "docx";
  }
  if (ext === "csv") {
    if (buffer.subarray(0, 4096).includes(0)) throw new AppError(422, "This file is not a text CSV.", "BAD_FILE");
    return "csv";
  }
  throw new AppError(415, "Only PDF, DOCX and CSV files are supported.", "UNSUPPORTED_TYPE");
}

export async function parseFile(fileType, buffer) {
  if (fileType === "pdf") return parsePdf(buffer);
  if (fileType === "docx") return parseDocx(buffer);
  return parseCsvFile(buffer);
}
