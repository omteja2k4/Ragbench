import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useDocuments } from "../hooks/useDocuments.js";
import DocumentPanel from "../components/DocumentPanel.jsx";
import SourceCard from "../components/SourceCard.jsx";
import { Button, Panel, ErrorBox, Spinner, MethodBadge, METHODS, fmtMs } from "../components/ui.jsx";

export default function DocumentQA() {
  const { documents, loading, error, reload } = useDocuments();
  const [selected, setSelected] = useState([]);
  const [question, setQuestion] = useState("");
  const [method, setMethod] = useState("hybrid");
  const [topK, setTopK] = useState(5);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [result, setResult] = useState(null);

  // Select every ready document the first time the list loads.
  useEffect(() => {
    setSelected((s) => (s.length === 0 ? documents.filter((d) => d.status === "ready").map((d) => d._id) : s.filter((id) => documents.some((d) => d._id === id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length]);

  async function ask() {
    setAsking(true);
    setAskError("");
    setResult(null);
    try {
      setResult(await api.ask({ question, method, topK, documentIds: selected }));
    } catch (e) {
      setAskError(e.message);
    } finally {
      setAsking(false);
    }
  }

  const canAsk = question.trim() && selected.length > 0 && !asking;
  const citedIds = new Set(result?.citations.map((c) => c.chunkId));

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <DocumentPanel documents={documents} selected={selected} setSelected={setSelected} reload={reload} loading={loading} error={error} />

      <div className="space-y-5">
        <Panel title="Ask a question">
          <label htmlFor="q" className="sr-only">Question</label>
          <textarea
            id="q"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && canAsk && ask()}
            placeholder="When does the hostel gate close?"
            className="w-full resize-y rounded-md border border-line px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Retrieval method</legend>
              <div className="flex overflow-hidden rounded-md border border-line">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    aria-pressed={method === m.id}
                    className={`px-3 py-1.5 text-sm ${method === m.id ? "bg-ink text-white" : "bg-white hover:bg-slate-50"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="text-xs text-muted">
              <span className="mb-1 block">Top-K</span>
              <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink">
                {[3, 5, 8, 10].map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <Button onClick={ask} disabled={!canAsk} className="ml-auto">{asking ? "Searching..." : "Ask"}</Button>
          </div>
          {selected.length === 0 && documents.length > 0 && <p className="mt-2 text-xs text-muted">Select at least one document to search.</p>}
        </Panel>

        {asking && <Spinner label="Retrieving passages and generating the answer..." />}
        <ErrorBox>{askError}</ErrorBox>

        {result && (
          <Panel
            title="Answer"
            action={<span className="flex items-center gap-2 text-xs text-muted"><MethodBadge id={result.method} /> Top-{result.topK} | retrieval {fmtMs(result.latency.retrievalMs)} | answer {fmtMs(result.latency.generationMs)}</span>}
          >
            <p className={`text-base leading-relaxed ${result.found ? "" : "text-muted"}`}>{result.answer}</p>

            {result.citations.length > 0 && (
              <p className="mt-3 text-sm">
                <span className="text-muted">Source: </span>
                {result.citations.map((c) => `${c.filename}, ${c.location}`).join("; ")}
              </p>
            )}
            {result.invalidCitations.length > 0 && (
              <p className="mt-2 text-xs text-amber-800">The model cited unknown source ids ({result.invalidCitations.join(", ")}); they were ignored.</p>
            )}

            <h3 className="mb-2 mt-5 text-sm font-semibold">Retrieved passages ({result.sources.length})</h3>
            {result.sources.length === 0 && <p className="text-sm text-muted">No passages matched this question.</p>}
            <div className="space-y-2">
              {result.sources.map((s) => (
                <SourceCard key={s.chunkId} source={s} method={result.method} cited={citedIds.has(s.chunkId)} label={`S${s.rank}`} />
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
