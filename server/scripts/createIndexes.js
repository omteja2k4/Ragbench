// Optional helper: creates both Atlas indexes from code instead of clicking in the Atlas UI.
// Run once:  npm run create-indexes --prefix server
// Needs an Atlas cluster (M0 free tier is fine). Index builds take 1-2 minutes; check with: GET /api/health
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDb } from "../config/db.js";
import Chunk from "../models/Chunk.js";

await connectDb();
await Chunk.createCollection().catch(() => {}); // the collection must exist before search indexes can be created
const col = mongoose.connection.collection("chunks");
const existing = (await col.listSearchIndexes().toArray()).map((i) => i.name);

if (!existing.includes(env.searchIndex)) {
  await col.createSearchIndex({
    name: env.searchIndex,
    definition: { mappings: { dynamic: false, fields: { text: { type: "string" }, documentId: { type: "objectId" } } } },
  });
  console.log(`Created Atlas Search index "${env.searchIndex}"`);
} else console.log(`Atlas Search index "${env.searchIndex}" already exists`);

if (!existing.includes(env.vectorIndex)) {
  await col.createSearchIndex({
    name: env.vectorIndex,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: env.embeddingDims, similarity: "cosine" },
        { type: "filter", path: "documentId" },
      ],
    },
  });
  console.log(`Created Atlas Vector Search index "${env.vectorIndex}"`);
} else console.log(`Atlas Vector Search index "${env.vectorIndex}" already exists`);

await mongoose.disconnect();
