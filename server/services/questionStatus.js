// Works out whether each saved evaluation question is usable:
//   labeled      - has user-confirmed passages that still exist  -> counts in Hit Ratio / MRR
//   no_labels    - user has not selected any passage             -> metrics unavailable
//   stale        - some labeled chunk no longer exists (document deleted / re-processed) -> user must review
//   no_documents - none of its documents exist any more
import Chunk from "../models/Chunk.js";
import Document from "../models/Document.js";

const uniq = (arr) => [...new Set(arr)];

export async function attachStatus(questions) {
  const chunkIds = uniq(questions.flatMap((q) => q.relevantChunkIds || []));
  const existingChunks = new Set((await Chunk.find({ chunkId: { $in: chunkIds } }, "chunkId").lean()).map((c) => c.chunkId));
  const docIds = uniq(questions.flatMap((q) => (q.documentIds || []).map(String)));
  const readyDocs = new Set((await Document.find({ _id: { $in: docIds }, status: "ready" }, "_id").lean()).map((d) => String(d._id)));

  return questions.map((q) => {
    const obj = typeof q.toObject === "function" ? q.toObject() : q;
    const activeDocumentIds = (obj.documentIds || []).map(String).filter((id) => readyDocs.has(id));
    const staleChunkIds = (obj.relevantChunkIds || []).filter((id) => !existingChunks.has(id));
    let status = "labeled";
    if (activeDocumentIds.length === 0) status = "no_documents";
    else if ((obj.relevantChunkIds || []).length === 0) status = "no_labels";
    else if (staleChunkIds.length > 0) status = "stale";
    return { ...obj, status, staleChunkIds, activeDocumentIds };
  });
}
