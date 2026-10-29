// Small shared UI pieces so the pages stay readable.
export const METHODS = [
  { id: "bm25", label: "BM25", color: "#b45309", scoreLabel: "BM25 score" },
  { id: "vector", label: "Vector", color: "#4f46e5", scoreLabel: "Cosine similarity" },
  { id: "hybrid", label: "Hybrid", color: "#0f766e", scoreLabel: "RRF score" },
];
export const methodMeta = (id) => METHODS.find((m) => m.id === id);

export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-dark disabled:bg-slate-300",
    secondary: "border border-line bg-white text-ink hover:bg-slate-50 disabled:text-slate-400",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-slate-400",
  };
  return <button {...props} className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`} />;
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {children}
    </div>
  );
}

export function Notice({ children, tone = "info" }) {
  const tones = { info: "border-sky-200 bg-sky-50 text-sky-900", warn: "border-amber-200 bg-amber-50 text-amber-900" };
  return <div className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Empty({ children }) {
  return <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Spinner({ label = "Working..." }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </span>
  );
}

export function MethodBadge({ id }) {
  const m = methodMeta(id);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export const TYPE_STYLE = { pdf: "bg-red-50 text-red-700", docx: "bg-blue-50 text-blue-700", csv: "bg-emerald-50 text-emerald-700" };
export function TypeBadge({ type }) {
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] uppercase ${TYPE_STYLE[type] || "bg-slate-100"}`}>{type}</span>;
}

export const fmtMs = (v) => (typeof v === "number" ? `${Math.round(v).toLocaleString()} ms` : "n/a");
export const fmtPct = (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "n/a");
export const fmtNum = (v, d = 3) => (typeof v === "number" ? v.toFixed(d) : "n/a");
