// Builds a tiny valid PDF in memory (one text line per page) so parsing can be tested without real files.
export function makePdf(pageTexts) {
  const objs = [];
  const add = (body) => objs.push(body) && objs.length; // returns object number (1-based)
  const n = pageTexts.length;
  add("<< /Type /Catalog /Pages 2 0 R >>"); // 1
  add(`<< /Type /Pages /Kids [${pageTexts.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${n} >>`); // 2
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // 3
  pageTexts.forEach((text, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    const stream = text ? `BT /F1 12 Tf 72 700 Td (${text}) Tj ET` : "";
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (out += `${String(o).padStart(10, "0")} 00000 n \n`));
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
