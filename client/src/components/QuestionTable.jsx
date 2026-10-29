import { Panel, Empty, Button } from "./ui.jsx";

const STATUS = {
  labeled: ["Labeled", "bg-emerald-50 text-emerald-800"],
  no_labels: ["No passages selected", "bg-amber-50 text-amber-800"],
  stale: ["Stale labels, review needed", "bg-red-50 text-red-800"],
  no_documents: ["Documents deleted", "bg-red-50 text-red-800"],
};

export default function QuestionTable({ questions, documents, onEdit, onDelete }) {
  const docName = (id) => documents.find((d) => d._id === id)?.filename || "(deleted)";
  return (
    <Panel title={`Saved questions (${questions.length})`}>
      {questions.length === 0 ? (
        <Empty>No questions yet. Add a question above, then pick the passages that answer it.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr><th className="py-2 pr-3 font-medium">Question</th><th className="pr-3 font-medium">Expected answer</th><th className="pr-3 font-medium">Documents</th><th className="pr-3 font-medium">Supporting passages</th><th /></tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const [label, style] = STATUS[q.status];
                return (
                  <tr key={q._id} className="border-b border-line align-top last:border-0">
                    <td className="py-2.5 pr-3">{q.question}</td>
                    <td className="pr-3">{q.expectedAnswer}</td>
                    <td className="pr-3 text-xs text-muted">{q.documentIds.map((id) => docName(String(id))).join(", ")}</td>
                    <td className="pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${style}`}>{label}{q.status !== "no_labels" && ` (${q.relevantChunkIds.length})`}</span>
                      {q.relevantSnapshots.map((s) => (
                        <p key={s.chunkId} className="mt-1 line-clamp-1 text-xs text-muted" title={s.preview}>{s.filename}, {s.location}: {s.preview}</p>
                      ))}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <Button variant="secondary" className="mr-1.5 !px-2.5 !py-1" onClick={() => onEdit(q)}>Edit</Button>
                      <Button variant="danger" className="!px-2.5 !py-1" onClick={() => window.confirm("Delete this question?") && onDelete(q._id)}>Delete</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
