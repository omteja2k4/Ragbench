// Small input-validation helpers used by controllers.
import mongoose from "mongoose";
import { AppError } from "../middleware/errors.js";

export const METHODS = ["bm25", "vector", "hybrid"];

export function toObjectIds(ids, fieldName = "documentIds") {
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, `${fieldName} must be a non-empty array.`, "VALIDATION");
  return ids.map((id) => {
    if (!mongoose.isValidObjectId(id)) throw new AppError(400, `Invalid id in ${fieldName}.`, "VALIDATION");
    return new mongoose.Types.ObjectId(id);
  });
}

export function cleanString(value, name, { max = 2000, required = true } = {}) {
  const s = typeof value === "string" ? value.trim() : "";
  if (required && !s) throw new AppError(400, `${name} is required.`, "VALIDATION");
  if (s.length > max) throw new AppError(400, `${name} is too long (max ${max} characters).`, "VALIDATION");
  return s;
}

export function parseTopK(value, fallback = 5) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new AppError(400, "topK must be a whole number from 1 to 20.", "VALIDATION");
  return n;
}

export function parseMethod(value) {
  if (!METHODS.includes(value)) throw new AppError(400, `method must be one of: ${METHODS.join(", ")}.`, "VALIDATION");
  return value;
}
