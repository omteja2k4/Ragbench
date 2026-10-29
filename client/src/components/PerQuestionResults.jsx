import { useState } from "react";
import { Panel, Empty, METHODS, MethodBadge, fmtMs } from "./ui.jsx";
import SourceCard from "./SourceCard.jsx";

const VERDICT = {
  correct: ["Correct", "bg-emerald-50 text-emerald-800"],
  partial: ["Partially correct", "bg-amber-50 text-amber-800"],
  incorrect: ["Incorrect", "bg-red-50 text-red-800"],
};

function MethodColumn({ id, result, relevantIds, labeled }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  if (result.status === "error") {
    return <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><MethodBadge id={id} /><p className="mt-2">Retrieval failed: {result.error}</p></div>;
  }
  const verdict = result.judgment?.status === "ok" ? VERDICT[result.judgment.verdict] : null;
  return (
    <div className="rounded-md border border-line p-3 text-sm">
      <div className="flex items-center justify-between"><MethodBadge id={id} />
        <span className={`rounded px-1.5 py-0.5 text-xs ${verdict ? verdict[1] : "bg-slate-100 text-slate-600"}`}>{verdict ? verdict[0] : "Judgment unavailable"}</span>
      </div>
      <p className="mt-2 leading-relaxed">{result.answer ?? <span className="text-red-700">No answer: {result.answerError}</span>}</p>
      {result.judgment?.explanation && <p className="mt-1 text-xs text-muted">Judge: {result.judgment.explanation}</p>}
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted">First relevant rank</dt><dd className="font-medium">{!labeled ? "n/a" : result.firstRelevantRank ?? "not retrieved"}</dd></div>
        <div><dt className="text-muted">Retrieval</dt><dd className="font-medium">{fmtMs(result.retrievalMs)}</dd></div>
        <div><dt className="text-muted">Answer</dt><dd className="font-medium">{fmtMs(result.answerMs)}</dd></div>
      </dl>
      <button className="mt-2 text-xs text-accent hover:underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} retrieved passages ({result.retrieved.length})</button>
      {open && (
        <div className="mt-2 space-y-2">
          {result.retrieved.map((c) => <SourceCard key={c.chunkId} source={c} relevant={relevantIds.has(c.chunkId)} />)}
        </div>
      )}
    </div>
  );
}

export default function PerQuestionResults({ run }) {
  const [openId, setOpenId] = useState(null);
  if (!run.results?.length) return <Panel title="Per-question results"><Empty>No question results yet.</Empty></Panel>;
  return (
    <Panel title="Per-question results">
      <div className="space-y-2">
        {run.results.map((r) => {
          const key = String(r.questionId);
          const open = openId === key;
          const labeled = r.labelStatus === "labeled";
          return (
            <div key={key} className="rounded-md border border-line">
              <button className="flex w-full items-start gap-3 px-3 py-2.5 text-left" onClick={() => setOpenId(open ? null : key)} aria-expanded={open}>
                <span className="mt-0.5 text-muted">{open ? "−" : "+"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.question}</span>
                  <span className="block text-xs text-muted">Expected: {r.expectedAnswer}</span>
                </span>
                {!labeled && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">{r.labelStatus === "no_labels" ? "No labels: metrics n/a" : r.labelStatus === "stale" ? "Stale labels: metrics n/a" : "Skipped"}</span>}
              </button>
              {open && (
                <div className="grid gap-3 border-t border-line p-3 lg:grid-cols-3">
                  {r.skippedReason && <p className="text-sm text-muted lg:col-span-3">{r.skippedReason}</p>}
                  {METHODS.map((m) => <MethodColumn key={m.id} id={m.id} result={r.methods?.[m.id]} relevantIds={new Set(r.relevantChunkIds)} labeled={labeled} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
