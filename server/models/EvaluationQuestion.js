import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  expectedAnswer: { type: String, required: true },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
  // Chunk ids the USER confirmed as supporting evidence. Backend data - never typed by the user.
  relevantChunkIds: [String],
  // A small copy of what the user selected, so we can still show it if a chunk is later deleted (stale label).
  relevantSnapshots: [{ chunkId: String, filename: String, location: String, preview: String, _id: false }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("EvaluationQuestion", questionSchema);
