// Reads settings from the .env file once, and exports them as one object.
// Every other file imports `env` from here instead of touching process.env directly.
import "dotenv/config";

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== "" ? n : fallback;
};

export const env = {
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || "",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  geminiKey: process.env.GEMINI_API_KEY || "",
  chatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
  embeddingModel: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  // gemini-embedding-001 can return 3072, 1536 or 768 numbers per text. We ask for 768 (small and fast).
  // The Atlas vector index MUST use the same number.
  embeddingDims: num(process.env.EMBEDDING_DIMENSIONS, 768),

  chunkSize: num(process.env.CHUNK_SIZE, 1000), // characters
  chunkOverlap: num(process.env.CHUNK_OVERLAP, 150), // characters
  maxFileMb: num(process.env.MAX_FILE_MB, 10),
  maxCsvRows: num(process.env.MAX_CSV_ROWS, 3000),

  searchIndex: process.env.SEARCH_INDEX_NAME || "chunk_text_index",
  vectorIndex: process.env.VECTOR_INDEX_NAME || "chunk_vector_index",
  rrfK: num(process.env.RRF_K, 60),
  hybridPool: num(process.env.HYBRID_CANDIDATES, 20), // candidates fetched from EACH method before fusion
};
