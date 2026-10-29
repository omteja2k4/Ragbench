// Chunking: turn long text into small overlapping pieces that fit an embedding model.
//
// Dry run (size=40, overlap=15) on "Cats sleep. Dogs bark loudly. Birds sing at dawn.":
//   units  = ["Cats sleep.", "Dogs bark loudly.", "Birds sing at dawn."]
//   chunk1 = "Cats sleep. Dogs bark loudly."           (28 chars, adding the next unit would exceed 40)
//   overlap carry = last units that fit in 15 chars -> none fits ("Dogs bark loudly." is 17) -> start fresh
//   chunk2 = "Birds sing at dawn."
// With a bigger overlap, the last sentence of chunk N is repeated at the start of chunk N+1,
// so an answer that sits on a boundary is still fully inside one chunk.

// Split text into small "units": paragraphs -> sentences -> (if still too long) word groups.
function toUnits(text, size) {
  const units = [];
  for (const para of text.split(/\n{2,}/)) {
    const flat = para.replace(/\s*\n\s*/g, " ").trim();
    if (!flat) continue;
    for (const sentence of flat.split(/(?<=[.!?])\s+/)) {
      if (sentence.length <= size) {
        units.push(sentence);
        continue;
      }
      // A very long "sentence" (tables, URLs...) is cut at word boundaries.
      let piece = "";
      for (const word of sentence.split(" ")) {
        if (word.length > size) {
          if (piece) units.push(piece), (piece = "");
          for (let i = 0; i < word.length; i += size) units.push(word.slice(i, i + size));
          continue;
        }
        if (piece.length + word.length + 1 > size) units.push(piece), (piece = word);
        else piece = piece ? `${piece} ${word}` : word;
      }
      if (piece) units.push(piece);
    }
  }
  return units;
}

// Pure function: text in, array of strings out. Easy to unit-test.
export function splitText(text, size = 1000, overlap = 150) {
  if (overlap >= size) throw new Error("chunk overlap must be smaller than chunk size");
  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks = [];
  let cur = []; // units in the chunk being built
  let len = 0;
  for (const unit of toUnits(clean, size)) {
    if (cur.length && len + unit.length + 1 > size) {
      chunks.push(cur.join(" "));
      // Carry the last few units into the next chunk (the overlap).
      let keep = [];
      let keepLen = 0;
      for (let i = cur.length - 1; i >= 0; i--) {
        if (keepLen + cur[i].length + 1 > overlap) break;
        keep.unshift(cur[i]);
        keepLen += cur[i].length + 1;
      }
      if (keepLen + unit.length + 1 > size) (keep = []), (keepLen = 0);
      cur = keep;
      len = keepLen;
    }
    cur.push(unit);
    len += unit.length + 1;
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks;
}

// Cleaning step: normalise whitespace and remove junk characters.
export function cleanText(text) {
  return (text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// segments: [{ text, page?, section?, row? }]  (produced by fileParser.js)
// Returns chunks WITHOUT ids/embeddings: [{ text, metadata: { page|section|row, chunkIndex } }]
// A chunk never mixes two pages / sections / rows, so every chunk has one exact location.
export function chunkSegments(segments, { chunkSize = 1000, chunkOverlap = 150 } = {}) {
  const out = [];
  for (const seg of segments) {
    for (const text of splitText(seg.text, chunkSize, chunkOverlap)) {
      const metadata = { chunkIndex: out.length };
      if (seg.page != null) metadata.page = seg.page;
      if (seg.section != null) metadata.section = seg.section;
      if (seg.row != null) metadata.row = seg.row;
      out.push({ text, metadata });
    }
  }
  return out;
}
