import { useState } from "react";
import DocumentQA from "./pages/DocumentQA.jsx";
import Evaluation from "./pages/Evaluation.jsx";
import HealthBanner from "./components/HealthBanner.jsx";

const PAGES = [
  { id: "qa", label: "Document Q&A", hint: "Ask questions about your files" },
  { id: "eval", label: "RAG Evaluation", hint: "Compare BM25, vector and hybrid" },
];

export default function App() {
  const [page, setPage] = useState("qa");
  return (
    <div className="min-h-screen md:flex">
      <nav className="border-b border-line bg-white md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r" aria-label="Main">
        <div className="px-5 py-5">
          <p className="text-lg font-semibold tracking-tight">RAGBench</p>
          <p className="text-xs text-muted">Multi-document RAG and retrieval evaluation</p>
        </div>
        <ul className="flex gap-1 px-3 pb-3 md:block md:space-y-1">
          {PAGES.map((p) => (
            <li key={p.id} className="flex-1 md:flex-none">
              <button
                onClick={() => setPage(p.id)}
                aria-current={page === p.id ? "page" : undefined}
                className={`w-full rounded-md px-3 py-2 text-left ${page === p.id ? "bg-ink text-white" : "hover:bg-slate-100"}`}
              >
                <span className="block text-sm font-medium">{p.label}</span>
                <span className={`hidden text-xs md:block ${page === p.id ? "text-slate-300" : "text-muted"}`}>{p.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1 space-y-5 p-4 md:p-8">
        <HealthBanner />
        {/* Both pages stay mounted so typed text and results are kept when you switch. */}
        <div hidden={page !== "qa"}><DocumentQA /></div>
        <div hidden={page !== "eval"}><Evaluation active={page === "eval"} /></div>
      </main>
    </div>
  );
}
