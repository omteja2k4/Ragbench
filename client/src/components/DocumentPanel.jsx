import { useRef, useState } from "react";
import { api } from "../services/api.js";
import { Button, Panel, Empty, ErrorBox, TypeBadge } from "./ui.jsx";

const ACCEPT = ".pdf,.docx,.csv";

// Upload area + document list with checkboxes (which documents to search) and delete buttons.
export default function DocumentPanel({ documents, selected, setSelected, reload, loading, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]); // [{ name, state: "uploading" | "done" | "error", message }]

  const setUpload = (name, patch) => setUploads((list) => list.map((u) => (u.name === name ? { ...u, ...patch } : u)));

  async function handleFiles(fileList) {
    const files = [...fileList];
    if (files.length === 0) return;
    setUploads(files.map((f) => ({ name: f.name, state: "uploading" })));
    // One file per request, one after another, so each file shows its own status.
    for (const file of files) {
      try {
        const data = await api.uploadFile(file);
        const r = data.results[0];
        if (r.ok) {
          setUpload(file.name, { state: "done", message: `${r.document.chunkCount} chunks` });
          setSelected((s) => [...s, r.document._id]); // select new documents automatically
        } else setUpload(file.name, { state: "error", message: r.error });
      } catch (e) {
        // A 422 response still carries the per-file error message
        const msg = e.data?.results?.[0]?.error || e.message;
        setUpload(file.name, { state: "error", message: msg });
      }
      await reload();
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.filename}" and its ${doc.chunkCount} chunks?\nEvaluation questions that use it will be marked stale.`)) return;
    try {
      await api.deleteDocument(doc._id);
      setSelected((s) => s.filter((id) => id !== doc._id));
      await reload();
    } catch (e) {
      alert(e.message);
    }
  }

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const ready = documents.filter((d) => d.status === "ready");

  return (
    <Panel title="Documents" action={ready.length > 0 && <span className="text-xs text-muted">{selected.length} of {ready.length} selected</span>}>
      <div
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => (e.preventDefault(), setDragging(false), handleFiles(e.dataTransfer.files))}
        className={`rounded-md border-2 border-dashed px-4 py-6 text-center ${dragging ? "border-accent bg-teal-50" : "border-line"}`}
      >
        <p className="text-sm">Drop PDF, DOCX or CSV files here</p>
        <Button variant="secondary" className="mt-3" onClick={() => inputRef.current.click()}>Choose files</Button>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (handleFiles(e.target.files), (e.target.value = ""))} />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {uploads.map((u) => (
            <li key={u.name} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.state === "uploading" && <span className="text-muted">Processing...</span>}
              {u.state === "done" && <span className="text-accent">Ready, {u.message}</span>}
              {u.state === "error" && <span className="text-red-700">{u.message}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2">
        <ErrorBox>{error}</ErrorBox>
        {loading && <p className="text-sm text-muted">Loading documents...</p>}
        {!loading && documents.length === 0 && <Empty>No documents yet. Upload one to start asking questions.</Empty>}
        {documents.map((d) => (
          <div key={d._id} className="flex items-start gap-3 rounded-md border border-line px-3 py-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-teal-700"
              aria-label={`Search ${d.filename}`}
              disabled={d.status !== "ready"}
              checked={selected.includes(d._id)}
              onChange={() => toggle(d._id)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TypeBadge type={d.fileType} />
                <span className="truncate text-sm font-medium" title={d.filename}>{d.filename}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {d.status === "ready" && `${d.chunkCount} chunks${d.pageCount ? `, ${d.pageCount} pages` : ""}`}
                {d.status === "processing" && "Processing..."}
                {d.status === "failed" && <span className="text-red-700">Failed: {d.errorMessage}</span>}
              </p>
            </div>
            <button onClick={() => remove(d)} className="text-xs text-red-700 hover:underline" aria-label={`Delete ${d.filename}`}>Delete</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
