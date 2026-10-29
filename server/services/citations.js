// Source-label helpers. The LLM sees labels like [S1], [S2]; we only trust labels that really exist.

// chunks -> [{ label: "S1", chunk }, ...]
export function buildSourceLabels(chunks) {
  return chunks.map((chunk, i) => ({ label: `S${i + 1}`, chunk }));
}

// Make text safe to put inside our <source> tags: uploaded text must not be able to close the tag.
export function escapeSourceText(text) {
  return String(text).replace(/<\/?source[^>]*>/gi, "[tag removed]");
}

// Keep only cited labels that exist in the retrieved list. Returns the valid citations and the rejected labels.
export function validateCitations(citedLabels, labeled) {
  const byLabel = new Map(labeled.map((l) => [l.label, l.chunk]));
  const valid = [];
  const invalid = [];
  for (const raw of Array.isArray(citedLabels) ? citedLabels : []) {
    const label = String(raw).trim().replace(/^\[|\]$/g, "").toUpperCase();
    if (byLabel.has(label) && !valid.some((v) => v.label === label)) valid.push({ label, chunk: byLabel.get(label) });
    else if (!byLabel.has(label)) invalid.push(String(raw));
  }
  return { valid, invalid };
}
