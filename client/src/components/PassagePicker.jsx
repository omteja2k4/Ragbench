import { useState } from "react";
import { api } from "../services/api.js";
import { Button, ErrorBox, Spinner, TypeBadge } from "./ui.jsx";

// Lets the user label supporting passages with checkboxes. Chunk ids stay behind the scenes.
//  - "Find Supporting Passages": automatic suggestions (hybrid search, top 8)
//  - "Browse All Passages": manual search through every stored chunk of a document (always available)
// `selected` is an object { [chunkId]: passage } owned by the parent form.
export default function PassagePicker({ question, expectedAnswer, documents, documentIds, selected, setSelected }) {
  const [tab, setTab] = useState("suggest");
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [browseDoc, setBrowseDoc] = useState("");
  const [term, setTerm] = useState("");
  const [browse, setBrowse] = useState(null);

  const toggle = (p) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[p.chunkId]) delete next[p.chunkId];
      else next[p.chunkId] = p;
      return next;
    });

  async function suggest() {
    setLoading(true);
    setError("");
    try {
      const data = await api.suggestChunks({ question, expectedAnswer, documentIds });
      setSuggestions(data.suggestions);
    } catch (e) {
      setError(`${e.message} You can still use "Browse all passages".`);
    } finally {
      setLoading(false);
    }
  }

  async function load(page = 1) {
    const id = browseDoc || documentIds[0];
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setBrowse(await api.browseChunks(id, { search: term, page }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const row = (p) => (
    <label key={p.chunkId} className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-2 hover:bg-slate-50">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" checked={Boolean(selected[p.chunkId])} onChange={() => toggle(p)} />
      <div className="min-w-0">
        <p className="text-xs text-muted"><span className="font-medium text-ink">{p.filename}</span>, {p.location}</p>
        <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm">{p.text}</p>
      </div>
    </label>
  );

  const chosen = Object.values(selected);
  const docName = (id) => documents.find((d) => d._id === id)?.filename;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-line">
        {[["suggest", "Find supporting passages"], ["browse", "Browse all passages"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === id ? "border-accent font-medium text-accent" : "border-transparent text-muted"}`}>{label}</button>
        ))}
      </div>

      {tab === "suggest" && (
        <div className="space-y-2">
          <Button variant="secondary" onClick={suggest} disabled={loading || !question.trim() || documentIds.length === 0}>Find supporting passages</Button>
          <p className="text-xs text-muted">These are only suggestions. Tick the passages that really contain the answer. If the right one is missing, use Browse all passages.</p>
          {suggestions && suggestions.length === 0 && <p className="text-sm text-muted">No passages found. Try Browse all passages.</p>}
          {suggestions?.map(row)}
        </div>
      )}

      {tab === "browse" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select value={browseDoc || documentIds[0] || ""} onChange={(e) => (setBrowseDoc(e.target.value), setBrowse(null))} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm" aria-label="Document to browse">
              {documentIds.map((id) => <option key={id} value={id}>{docName(id) || id}</option>)}
            </select>
            <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} placeholder="Search words in this document" className="min-w-0 flex-1 rounded-md border border-line px-3 py-1.5 text-sm" />
            <Button variant="secondary" onClick={() => load(1)} disabled={loading || documentIds.length === 0}>Search</Button>
          </div>
          {browse && browse.chunks.length === 0 && <p className="text-sm text-muted">No passages match.</p>}
          {browse?.chunks.map(row)}
          {browse && browse.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button variant="secondary" disabled={browse.page <= 1 || loading} onClick={() => load(browse.page - 1)}>Previous</Button>
              <span className="text-muted">Page {browse.page} of {browse.pages} ({browse.total} passages)</span>
              <Button variant="secondary" disabled={browse.page >= browse.pages || loading} onClick={() => load(browse.page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}

      {loading && <Spinner />}
      <ErrorBox>{error}</ErrorBox>

      <div>
        <h4 className="text-sm font-semibold">Selected supporting passages ({chosen.length})</h4>
        {chosen.length === 0 && <p className="mt-1 text-sm text-muted">None selected. Without passages, Hit Ratio and MRR are unavailable for this question.</p>}
        <ul className="mt-1 space-y-1">
          {chosen.map((p) => (
            <li key={p.chunkId} className="flex items-start gap-2 rounded-md bg-teal-50/60 px-3 py-1.5 text-sm">
              <div className="min-w-0 flex-1">
                <span className="text-xs text-muted">{p.filename}, {p.location}</span>
                {p.stale && <span className="ml-2 text-xs font-medium text-red-700">No longer exists. Remove it and choose again.</span>}
                <p className="line-clamp-2">{p.text}</p>
              </div>
              <button className="text-xs text-red-700 hover:underline" onClick={() => toggle(p)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
