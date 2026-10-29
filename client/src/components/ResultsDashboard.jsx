import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, Empty, METHODS, MethodBadge, fmtMs, fmtPct, fmtNum, Notice } from "./ui.jsx";
import PerQuestionResults from "./PerQuestionResults.jsx";

// Small bar chart of one metric across the three methods. Missing values are left out, never drawn as 0.
function MetricChart({ title, data, unit, domain }) {
  const hasData = data.some((d) => typeof d.value === "number");
  return (
    <Panel title={title}>
      {!hasData ? (
        <Empty>Not available for this run.</Empty>
      ) : (
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8dee6" />
              <XAxis dataKey="name" tickLine={false} />
              <YAxis tickLine={false} domain={domain} unit={unit} />
              <Tooltip formatter={(v) => (typeof v === "number" ? `${v}${unit}` : "n/a")} cursor={{ fill: "#f2f4f7" }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export default function ResultsDashboard({ run }) {
  if (!run) return <Empty>No evaluation run selected. Run an evaluation first, or choose a previous run.</Empty>;
  const s = run.summary || {};
  const series = (pick, round) => METHODS.map((m) => {
    const v = pick(s[m.id]);
    return { name: m.label, color: m.color, value: typeof v === "number" ? Number(round(v)) : null };
  });

  return (
    <div className="space-y-5">
      <Panel title="Run details">
        <p className="text-sm">
          {new Date(run.createdAt).toLocaleString()} | status <strong>{run.status}</strong> | Top-{run.config.topK} | model {run.config.chatModel} | embeddings {run.config.embeddingModel}
        </p>
        <p className="mt-1 text-xs text-muted">Hybrid: RRF k={run.config.rrfK}, {run.config.hybridPool} candidates from each method before fusion. Chunk size {run.config.chunkSize}, overlap {run.config.chunkOverlap}.</p>
        {run.status === "running" && <div className="mt-2"><Notice>This run is still in progress. Numbers below cover the questions finished so far.</Notice></div>}
        {(run.status === "failed" || run.status === "interrupted") && <div className="mt-2"><Notice tone="warn">Run {run.status}: {run.error}. Results below are partial.</Notice></div>}
      </Panel>

      <Panel title="Method comparison">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr><th className="py-2 font-medium">Method</th><th className="font-medium">Hit Ratio</th><th className="font-medium">MRR</th><th className="font-medium">Avg retrieval latency</th><th className="font-medium">Avg answer latency</th></tr>
            </thead>
            <tbody>
              {METHODS.map((m) => {
                const x = s[m.id];
                return (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="py-2.5"><MethodBadge id={m.id} /></td>
                    <td>{x ? <>{fmtPct(x.hitRatio)} <span className="text-xs text-muted">({x.hitCount}/{x.labeledQuestions})</span></> : "n/a"}</td>
                    <td>{fmtNum(x?.mrr)}</td>
                    <td>{fmtMs(x?.avgRetrievalMs)}</td>
                    <td>{fmtMs(x?.avgAnswerMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Hit Ratio and MRR use only questions with user-confirmed labels. Answer latency = retrieval + answer generation (the judge call is excluded). Vector and hybrid latency include one embedding API call for the question. Results come from this one run on your own data; they do not show that one method is always better.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <MetricChart title="Hit Ratio" data={series((x) => x?.hitRatio, (v) => (v * 100).toFixed(1))} unit="%" domain={[0, 100]} />
        <MetricChart title="MRR" data={series((x) => x?.mrr, (v) => v.toFixed(3))} unit="" domain={[0, 1]} />
        <MetricChart title="Avg retrieval latency" data={series((x) => x?.avgRetrievalMs, (v) => Math.round(v))} unit=" ms" />
      </div>

      <Panel title="Answer judgments (automated)">
        <p className="mb-2 text-xs text-muted">An LLM judge compared each generated answer with your expected answer. This is an automated assessment and can be wrong.</p>
        <table className="w-full max-w-xl text-left text-sm">
          <thead className="border-b border-line text-xs text-muted"><tr><th className="py-2 font-medium">Method</th><th className="font-medium">Correct</th><th className="font-medium">Partially correct</th><th className="font-medium">Incorrect</th><th className="font-medium">Unavailable</th></tr></thead>
          <tbody>
            {METHODS.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="py-2"><MethodBadge id={m.id} /></td>
                <td>{s[m.id]?.judged?.correct ?? "n/a"}</td><td>{s[m.id]?.judged?.partial ?? "n/a"}</td><td>{s[m.id]?.judged?.incorrect ?? "n/a"}</td><td>{s[m.id]?.judged?.unavailable ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {METHODS.some((m) => s[m.id]?.errorCount > 0) && (
          <p className="mt-2 text-xs text-red-700">Some retrieval calls failed: {METHODS.filter((m) => s[m.id]?.errorCount).map((m) => `${m.label} (${s[m.id].errorCount})`).join(", ")}. Failed calls are left out of averages. Details are shown per question.</p>
        )}
      </Panel>

      <PerQuestionResults run={run} />
    </div>
  );
}
