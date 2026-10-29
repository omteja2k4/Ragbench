// Ingestion pipeline:
//   Upload -> Text extraction -> Cleaning -> Chunking -> Embeddings -> MongoDB
import crypto from "node:crypto";
import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errors.js";
import { sanitizeFilename, detectFileType, parseFile } from "./fileParser.js";
import { chunkSegments } from "./chunker.js";
import { embedTexts } from "./embeddings.js";

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Stable chunk id: same file + same position + same text => same id.
// If the text of a chunk changes (e.g. different chunk size), its id changes too,
// which is how stale evaluation labels are detected.
export function makeChunkId(contentHash, index, textHash) {
  return `${contentHash.slice(0, 10)}_${index}_${textHash.slice(0, 8)}`;
}

export async function ingestFile(file) {
  const filename = sanitizeFilename(file.originalname);
  const fileType = detectFileType(filename, file.buffer);
  const contentHash = sha(file.buffer);

  // Duplicate upload? Reuse the existing document instead of embedding everything again.
  const existing = await Document.findOne({ contentHash });
  if (existing && existing.status !== "failed") {
    throw new AppError(409, `This file was already uploaded as "${existing.filename}".`, "DUPLICATE");
  }
  if (existing) {
    await Chunk.deleteMany({ documentId: existing._id });
    await Document.deleteOne({ _id: existing._id }); // failed earlier: retry from scratch
  }

  const doc = await Document.create({
    filename,
    fileType,
    contentHash,
    sizeBytes: file.buffer.length,
    status: "processing",
    config: { chunkSize: env.chunkSize, chunkOverlap: env.chunkOverlap, embeddingModel: env.embeddingModel },
  });

  try {
    const { segments, pageCount } = await parseFile(fileType, file.buffer); // extract + clean
    const pieces = chunkSegments(segments, { chunkSize: env.chunkSize, chunkOverlap: env.chunkOverlap });
    if (pieces.length === 0) throw new AppError(422, "No text could be extracted from this file.", "EMPTY_FILE");

    const textHashes = pieces.map((p) => sha(p.text));

    // Reuse embeddings of identical text that is already stored (saves API calls).
    const known = await Chunk.find({ textHash: { $in: textHashes } }, "textHash embedding").select("+embedding").lean();
    const cache = new Map(known.filter((k) => k.embedding?.length === env.embeddingDims).map((k) => [k.textHash, k.embedding]));
    const missing = [...new Set(textHashes.filter((h) => !cache.has(h)))];
    const firstTextFor = new Map();
    pieces.forEach((p, i) => firstTextFor.set(textHashes[i], p.text));
    const fresh = await embedTexts(missing.map((h) => firstTextFor.get(h)));
    missing.forEach((h, i) => cache.set(h, fresh[i]));

    const docs = pieces.map((p, i) => ({
      chunkId: makeChunkId(contentHash, i, textHashes[i]),
      documentId: doc._id,
      text: p.text,
      textHash: textHashes[i],
      embedding: cache.get(textHashes[i]),
      metadata: { filename, fileType, ...p.metadata },
    }));
    await Chunk.insertMany(docs, { ordered: true });

    doc.status = "ready";
    doc.chunkCount = docs.length;
    if (pageCount) doc.pageCount = pageCount;
    await doc.save();
    return doc;
  } catch (err) {
    // Never leave half-processed data behind.
    await Chunk.deleteMany({ documentId: doc._id });
    doc.status = "failed";
    doc.errorMessage = err.message;
    doc.chunkCount = 0;
    await doc.save();
    throw err;
  }
}

export async function deleteDocument(id) {
  const doc = await Document.findById(id);
  if (!doc) throw new AppError(404, "Document not found.", "NOT_FOUND");
  const res = await Chunk.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
  return { deletedChunks: res.deletedCount };
}
