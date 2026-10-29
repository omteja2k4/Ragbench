import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useDocuments } from "../hooks/useDocuments.js";
import QuestionForm from "../components/QuestionForm.jsx";
import QuestionTable from "../components/QuestionTable.jsx";
import RunPanel from "../components/RunPanel.jsx";
import ResultsDashboard from "../components/ResultsDashboard.jsx";
import { ErrorBox } from "../components/ui.jsx";

const TABS = [["create", "1. Create test questions"], ["run", "2. Run evaluation"], ["compare", "3. Compare results"]];

export default function Evaluation({ active }) {
  const { documents, reload: reloadDocs } = useDocuments();
  const [tab, setTab] = useState("create");
  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");

  const loadQuestions = useCallback(async () => {
    try { setQuestions((await api.listQuestions()).questions); } catch (e) { setError(e.message); }
  }, []);
  const loadRuns = useCallback(async () => {
    try { setRuns((await api.listRuns()).runs); } catch (e) { setError(e.message); }
  }, []);
  const openRun = useCallback(async (id) => {
    try { setRun((await api.getRun(id)).run); } catch (e) { setError(e.message); }
  }, []);

  // Reload whenever this page becomes visible (documents may have been uploaded or deleted on the other page).
  useEffect(() => { if (active) { loadQuestions(); loadRuns(); reloadDocs(); } }, [active, loadQuestions, loadRuns, reloadDocs]);

  // Open the newest run when the Compare tab is shown for the first time.
  useEffect(() => {
    if (tab === "compare" && !run && runs.length > 0) openRun(runs[0]._id);
  }, [tab, run, runs, openRun]);

  async function removeQuestion(id) {
    try { await api.deleteQuestion(id); await loadQuestions(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${tab === id ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>
        ))}
      </div>
      <ErrorBox>{error}</ErrorBox>

      {tab === "create" && (
        <>
          <QuestionForm documents={documents} editing={editing} onCancel={() => setEditing(null)} onSaved={() => (setEditing(null), loadQuestions())} />
          <QuestionTable questions={questions} documents={documents} onEdit={(q) => (setEditing(q), window.scrollTo({ top: 0, behavior: "smooth" }))} onDelete={removeQuestion} />
        </>
      )}

      {tab === "run" && (
        <RunPanel questions={questions} onFinished={(id) => (loadRuns(), openRun(id), setTab("compare"))} />
      )}

      {tab === "compare" && (
        <>
          {runs.length > 0 && (
            <label className="block text-sm">
              <span className="mr-2 text-muted">Evaluation run</span>
              <select value={run?._id || ""} onChange={(e) => openRun(e.target.value)} className="rounded-md border border-line bg-white px-2 py-1.5">
                {runs.map((r) => <option key={r._id} value={r._id}>{new Date(r.createdAt).toLocaleString()} ({r.status}, Top-{r.config.topK})</option>)}
              </select>
            </label>
          )}
          <ResultsDashboard run={run} />
        </>
      )}
    </div>
  );
}
