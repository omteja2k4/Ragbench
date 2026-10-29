import mongoose from "mongoose";
const { Schema } = mongoose;

// Result of ONE retrieval method on ONE question.
const methodResultSchema = new Schema(
  {
    status: { type: String, enum: ["ok", "error"], default: "ok" },
    error: String,
    retrieved: [
      { chunkId: String, rank: Number, score: Number, scoreType: String, filename: String, location: String, text: String, _id: false },
    ],
    hit: Number, // 1 / 0, or null when labels are unavailable
    firstRelevantRank: Number, // null when not retrieved or labels unavailable
    reciprocalRank: Number, // null when labels unavailable
    answerError: String, // set when answer generation failed (retrieval metrics are still valid)
    answer: String,
    answerFound: Boolean,
    citedChunkIds: [String],
    judgment: { status: String, verdict: String, explanation: String, _id: false }, // status: ok | unavailable
    retrievalMs: Number,
    answerMs: Number, // retrieval + generation (judge call excluded)
  },
  { _id: false }
);

const questionResultSchema = new Schema(
  {
    questionId: Schema.Types.ObjectId,
    question: String,
    expectedAnswer: String,
    labelStatus: String, // labeled | no_labels | stale | no_documents
    relevantChunkIds: [String],
    skippedReason: String,
    methods: { bm25: methodResultSchema, vector: methodResultSchema, hybrid: methodResultSchema },
  },
  { _id: false }
);

const summarySchema = new Schema(
  {
    labeledQuestions: Number,
    hitCount: Number,
    hitRatio: Number, // 0..1 or null
    mrr: Number, // 0..1 or null
    avgRetrievalMs: Number,
    avgAnswerMs: Number,
    okCount: Number,
    errorCount: Number,
    judged: { correct: Number, partial: Number, incorrect: Number, unavailable: Number },
  },
  { _id: false }
);

const runSchema = new Schema({
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date,
  status: { type: String, enum: ["running", "completed", "failed", "interrupted"], default: "running" },
  error: String,
  config: { topK: Number, chatModel: String, embeddingModel: String, rrfK: Number, hybridPool: Number, chunkSize: Number, chunkOverlap: Number },
  progress: { done: { type: Number, default: 0 }, total: { type: Number, default: 0 }, current: String },
  results: [questionResultSchema],
  summary: { bm25: summarySchema, vector: summarySchema, hybrid: summarySchema },
});

export default mongoose.model("EvaluationRun", runSchema);
