// MongoDB connection + a check that the two Atlas indexes exist.
import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  if (!env.mongoUri) throw new Error("MONGODB_URI is missing. Copy server/.env.example to server/.env and fill it in.");
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("MongoDB connected:", mongoose.connection.name);
}

// Atlas $search / $vectorSearch return EMPTY results (not an error) when an index is missing.
// So we ask Atlas which indexes exist and report problems explicitly.
let cache = { at: 0, value: null };

export async function checkSearchIndexes(force = false) {
  if (!force && cache.value && Date.now() - cache.at < 15000) return cache.value;
  const result = { ok: false, text: "unknown", vector: "unknown", message: "" };
  try {
    const col = mongoose.connection.collection("chunks");
    const list = await col.listSearchIndexes().toArray();
    const find = (name) => list.find((i) => i.name === name);
    const text = find(env.searchIndex);
    const vec = find(env.vectorIndex);
    result.text = text ? (text.queryable ? "ready" : "building") : "missing";
    result.vector = vec ? (vec.queryable ? "ready" : "building") : "missing";
    result.ok = result.text === "ready" && result.vector === "ready";
    const problems = [];
    if (result.text !== "ready") problems.push(`Atlas Search index "${env.searchIndex}" is ${result.text}`);
    if (result.vector !== "ready") problems.push(`Atlas Vector Search index "${env.vectorIndex}" is ${result.vector}`);
    result.message = problems.join("; ");
  } catch (err) {
    // Happens on a non-Atlas MongoDB (no search index support) or when the connection is down.
    result.message = `Could not list Atlas search indexes: ${err.message}`;
  }
  cache = { at: Date.now(), value: result };
  return result;
}
