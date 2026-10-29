import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import PassagePicker from "./PassagePicker.jsx";
import { Button, Panel, ErrorBox, Notice, TypeBadge } from "./ui.jsx";

// Create or edit one test question: question text, expected answer, documents, supporting passages.
export default function QuestionForm({ documents, editing, onSaved, onCancel }) {
  const ready = documents.filter((d) => d.status === "ready");
  const [question, setQuestion] = useState("");
  const [expected, setExpected] = useState("");
  const [docIds, setDocIds] = useState([]);
  const [selected, setSelected] = useState({}); // { chunkId: passage }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fill the form when "Edit" is clicked on a saved question.
  useEffect(() => {
    if (!editing) return;
    setQuestion(editing.question);
    setExpected(editing.expectedAnswer);
    setDocIds(editing.documentIds.map(String));
    const stale = new Set(editing.staleChunkIds);
    const map = {};
    for (const s of editing.relevantSnapshots) map[s.chunkId] = { chunkId: s.chunkId, filename: s.filename, location: s.location, text: s.preview, stale: stale.has(s.chunkId) };
    setSelected(map);
    setError("");
  }, [editing]);

  const reset = () => {
    setQuestion("");
    setExpected("");
    setSelected({});
    setError("");
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.saveQuestion({ question, expectedAnswer: expected, documentIds: docIds, relevantChunkIds: Object.keys(selected) }, editing?._id);
      reset();
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const toggleDoc = (id) => setDocIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const canSave = question.trim() && expected.trim() && docIds.length > 0 && !saving;

  return (
    <Panel title={editing ? "Edit test question" : "New test question"}>
      {ready.length === 0 ? (
        <Notice>Upload at least one document on the Document Q&A page first.</Notice>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Question</span>
              <textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="When does the hostel gate close?" className="w-full rounded-md border border-line px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Expected answer</span>
              <textarea rows={2} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="11 PM" className="w-full rounded-md border border-line px-3 py-2" />
            </label>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Documents to search</legend>
            <div className="flex flex-wrap gap-2">
              {ready.map((d) => (
                <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-2.5 py-1 text-sm">
                  <input type="checkbox" className="accent-teal-700" checked={docIds.includes(d._id)} onChange={() => toggleDoc(d._id)} />
                  <TypeBadge type={d.fileType} /> {d.filename}
                </label>
              ))}
            </div>
          </fieldset>

          <PassagePicker question={question} expectedAnswer={expected} documents={documents} documentIds={docIds} selected={selected} setSelected={setSelected} />

          <ErrorBox>{error}</ErrorBox>
          <div className="flex gap-2">
            <Button onClick={save} disabled={!canSave}>{saving ? "Saving..." : editing ? "Save changes" : "Save question"}</Button>
            {editing && <Button variant="secondary" onClick={() => (reset(), onCancel())}>Cancel</Button>}
          </div>
        </div>
      )}
    </Panel>
  );
}
