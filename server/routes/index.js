import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { checkSearchIndexes } from "../config/db.js";
import * as docs from "../controllers/documentController.js";
import * as chat from "../controllers/chatController.js";
import * as ev from "../controllers/evaluationController.js";

const router = Router();

// Files are kept in memory (no files written to disk), with a size limit.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileMb * 1024 * 1024, files: 10 } });

// Health + index status (the UI shows a warning if an Atlas index is missing)
router.get("/health", async (req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(env.geminiKey), chatModel: env.chatModel, indexes: await checkSearchIndexes() });
});

// Documents
router.post("/documents/upload", upload.array("files", 10), docs.uploadDocuments);
router.get("/documents", docs.listDocuments);
router.get("/documents/:id/chunks", docs.browseChunks);
router.delete("/documents/:id", docs.removeDocument);

// Document Q&A
router.post("/chat/ask", chat.ask);

// Evaluation questions
router.post("/evaluation/questions", ev.createQuestion);
router.get("/evaluation/questions", ev.listQuestions);
router.put("/evaluation/questions/:id", ev.updateQuestion);
router.delete("/evaluation/questions/:id", ev.deleteQuestion);

// Supporting passages
router.post("/evaluation/suggest-chunks", ev.suggestChunks);
router.get("/evaluation/documents/:id/chunks", docs.browseChunks);

// Evaluation runs
router.post("/evaluation/run", ev.runEvaluation);
router.get("/evaluation/runs", ev.listRuns);
router.get("/evaluation/runs/:id", ev.getRun);

export default router;
