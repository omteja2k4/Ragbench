import { useState } from "react";
import { MethodBadge, TypeBadge, methodMeta, fmtNum } from "./ui.jsx";

// One retrieved passage: file, location, score (labelled by the kind of score), text.
export default function SourceCard({ source, label, cited, relevant, method, clamp = true }) {
  const [open, setOpen] = useState(false);
  const long = source.text.length > 280;
  const scoreName = { bm25: "BM25 score", cosine: "Cosine similarity", rrf: "RRF score" }[source.scoreType] || "Score";
  return (
    <article className={`rounded-md border px-3 py-2.5 ${cited || relevant ? "border-accent bg-teal-50/40" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {label && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-ink">{label}</span>}
        <span className="font-mono">#{source.rank}</span>
        {source.fileType && <TypeBadge type={source.fileType} />}
        <span className="font-medium text-ink">{source.filename}</span>
        <span>{source.location}</span>
        {typeof source.score === "number" && (
          <span className="ml-auto font-mono">{scoreName}: {fmtNum(source.score, source.scoreType === "rrf" ? 4 : 3)}</span>
        )}
        {cited && <span className="font-medium text-accent">Cited in answer</span>}
        {relevant && <span className="font-medium text-emerald-700">Labeled relevant</span>}
      </div>
      <p className={`mt-1.5 whitespace-pre-wrap text-sm leading-relaxed ${clamp && !open ? "line-clamp-4" : ""}`}>{source.text}</p>
      {clamp && long && (
        <button className="mt-1 text-xs text-accent hover:underline" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show more"}</button>
      )}
      {source.bm25Rank !== undefined && method === "hybrid" && (
        <p className="mt-1 text-xs text-muted">BM25 rank: {source.bm25Rank ?? "not in BM25 pool"}, vector rank: {source.vectorRank ?? "not in vector pool"}</p>
      )}
    </article>
  );
}
