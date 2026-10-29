import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true, unique: true }, // stable id, e.g. "a1b2c3d4e5_3_9f8e7d6c"
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
  text: { type: String, required: true },
  textHash: { type: String, index: true }, // used to reuse embeddings of identical text
  // select:false keeps the 1536 numbers out of normal queries (they are big and never shown in the UI)
  embedding: { type: [Number], select: false },
  metadata: {
    filename: String,
    fileType: String,
    page: Number, // PDF only
    section: String, // DOCX only
    row: Number, // CSV only
    chunkIndex: Number,
  },
});

export default mongoose.model("Chunk", chunkSchema); // collection name: "chunks"
