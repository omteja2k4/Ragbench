import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { Button, Panel, ErrorBox, Notice } from "./ui.jsx";

// Starts an evaluation run and shows live progress by polling the saved run every 1.5 seconds.
export default function RunPanel({ questions, onFinished }) {
  const [topK, setTopK] = useState(5);
  const [runId, setRunId] = useState(null);
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");

  const count = (s) => questions.filter((q) => q.status === s).length;
  const labeled = count("labeled");

  useEffect(() => {
    if (!runId) return;
    let stop = false;
    const tick = async () => {
      try {
        const { run } = await api.getRun(runId);
        if (stop) return;
        setRun(run);
        if (run.status !== "running") {
          setRunId(null);
          onFinished(run._id);
        }
      } catch (e) {
        if (!stop) (setError(e.message), setRunId(null));
      }
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => ((stop = true), clearInterval(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function start() {
    setError("");
    setRun(null);
    try {
      const data = await api.startRun(topK);
      setRunId(data.runId);
    } catch (e) {
      setError(e.message);
    }
  }

  const running = Boolean(runId);
  const pct = run ? Math.round((run.progress.done / Math.max(1, run.progress.total)) * 100) : 0;

  return (
    <Panel title="Run evaluation">
      <p className="text-sm text-muted">
        Runs every saved question through BM25, vector and hybrid search with the same documents, Top-K and answer prompt. Each run is saved so you can compare it later.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Saved questions</dt><dd className="font-medium">{questions.length}</dd></div>
        <div><dt className="text-xs text-muted">With valid labels</dt><dd className="font-medium">{labeled}</dd></div>
        <div><dt className="text-xs text-muted">Without passages</dt><dd className="font-medium">{count("no_labels")}</dd></div>
        <div><dt className="text-xs text-muted">Stale labels</dt><dd className="font-medium">{count("stale")}</dd></div>
      </dl>
      {questions.length > labeled && (
        <div className="mt-3"><Notice tone="warn">Questions without valid labels still get answers, but they are left out of Hit Ratio and MRR.</Notice></div>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-xs text-muted">
          <span className="mb-1 block">Top-K (same for all methods)</span>
          <select value={topK} disabled={running} onChange={(e) => setTopK(Number(e.target.value))} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink">
            {[3, 5, 8, 10].map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <Button onClick={start} disabled={running || questions.length === 0} className="!px-5 !py-2.5">{running ? "Running..." : "Run Evaluation"}</Button>
      </div>

      {running && run && (
        <div className="mt-4" role="status">
          <div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-sm text-muted">{run.progress.done} of {run.progress.total} questions done{run.progress.current ? `. Now: ${run.progress.current}` : ""}</p>
        </div>
      )}
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
    </Panel>
  );
}
