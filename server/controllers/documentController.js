import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import { AppError } from "../middleware/errors.js";
import { ingestFile, deleteDocument } from "../services/ingest.js";
import { locationLabel } from "../services/search.js";

// POST /api/documents/upload   (multipart field name: "files")
// Each file is processed one after another; the response lists success/failure per file.
export async function uploadDocuments(req, res) {
  if (!req.files?.length) throw new AppError(400, "No files received. Choose a PDF, DOCX or CSV file.", "NO_FILE");
  const results = [];
  for (const file of req.files) {
    try {
      const doc = await ingestFile(file);
      results.push({ filename: doc.filename, ok: true, document: doc });
    } catch (err) {
      results.push({ filename: file.originalname, ok: false, error: err.message, code: err.code });
    }
  }
  const allFailed = results.every((r) => !r.ok);
  res.status(allFailed ? 422 : 201).json({ results });
}

// GET /api/documents
export async function listDocuments(req, res) {
  const documents = await Document.find().sort({ createdAt: -1 });
  res.json({ documents });
}

// GET /api/documents/:id/chunks  and  GET /api/evaluation/documents/:id/chunks
// Browse a document's stored chunks, with optional plain-text search (?search=) and paging (?page=&limit=).
export async function browseChunks(req, res) {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw new AppError(404, "Document not found.", "NOT_FOUND");
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const filter = { documentId: doc._id };
  const term = String(req.query.search || "").trim().slice(0, 200);
  if (term) filter.text = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }; // escaped: plain text, not a regex
  const [total, rows] = await Promise.all([
    Chunk.countDocuments(filter),
    Chunk.find(filter).sort({ "metadata.chunkIndex": 1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  const chunks = rows.map((c) => ({
    chunkId: c.chunkId,
    documentId: String(c.documentId),
    filename: c.metadata.filename,
    location: locationLabel(c.metadata),
    metadata: c.metadata,
    text: c.text,
  }));
  res.json({ chunks, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

// DELETE /api/documents/:id  -> removes the document and all its chunks.
export async function removeDocument(req, res) {
  const result = await deleteDocument(req.params.id);
  res.json({ ok: true, ...result });
}
