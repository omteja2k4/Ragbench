// All calls to the Express backend live here, so components never build URLs themselves.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new Error("Cannot reach the server. Is it running on port 5000?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.data = data;
    throw err;
  }
  return data;
}

const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  health: () => request("/health"),

  // documents
  listDocuments: () => request("/documents"),
  uploadFile: (file) => {
    const form = new FormData();
    form.append("files", file);
    return request("/documents/upload", { method: "POST", body: form });
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  browseChunks: (docId, { search = "", page = 1 } = {}) =>
    request(`/evaluation/documents/${docId}/chunks?search=${encodeURIComponent(search)}&page=${page}&limit=10`),

  // question answering
  ask: (body) => request("/chat/ask", json("POST", body)),

  // evaluation
  listQuestions: () => request("/evaluation/questions"),
  saveQuestion: (body, id) => request(id ? `/evaluation/questions/${id}` : "/evaluation/questions", json(id ? "PUT" : "POST", body)),
  deleteQuestion: (id) => request(`/evaluation/questions/${id}`, { method: "DELETE" }),
  suggestChunks: (body) => request("/evaluation/suggest-chunks", json("POST", body)),
  startRun: (topK) => request("/evaluation/run", json("POST", { topK })),
  listRuns: () => request("/evaluation/runs"),
  getRun: (id) => request(`/evaluation/runs/${id}`),
};
