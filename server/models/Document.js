import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true }, // sanitized original name
  fileType: { type: String, enum: ["pdf", "docx", "csv"], required: true },
  contentHash: { type: String, required: true, index: true }, // sha256 of the file; detects duplicate uploads
  sizeBytes: Number,
  status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
  errorMessage: String,
  chunkCount: { type: Number, default: 0 },
  pageCount: Number, // PDFs only
  config: { chunkSize: Number, chunkOverlap: Number, embeddingModel: String }, // how this doc was processed
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Document", documentSchema);
