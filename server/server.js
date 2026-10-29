import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb, checkSearchIndexes } from "./config/db.js";
import { markInterruptedRuns } from "./services/evaluation.js";

async function main() {
  await connectDb();
  await markInterruptedRuns();
  const idx = await checkSearchIndexes(true);
  if (!idx.ok) console.warn("WARNING - search indexes:", idx.message, "(see README > MongoDB Atlas setup)");
  if (!env.geminiKey) console.warn("WARNING - GEMINI_API_KEY is not set. Uploads and questions will fail until you add it.");
  createApp().listen(env.port, () => console.log(`RAGBench API running on http://localhost:${env.port}`));
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
