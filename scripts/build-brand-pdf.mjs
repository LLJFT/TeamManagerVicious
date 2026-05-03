import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import MarkdownIt from "markdown-it";

const SRC = path.resolve("brand/Vicious-Brand-Guidelines.md");
const OUT = path.resolve("brand/Vicious-Brand-Guidelines.pdf");

const md = new MarkdownIt({ html: false, linkify: false, typographer: true });
const tokens = md.parse(fs.readFileSync(SRC, "utf8"), {});

const PAGE = { size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 } };
const COLORS = {
  text: "#0E1117",
  muted: "#5B6573",
  accent: "#E11D2E",
  rule: "#D6DDE6",
  onyx: "#0E1117",
  bone: "#F5F6F8",
};
const FONTS = { body: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", mono: "Courier" };

const doc = new PDFDocument({ ...PAGE, autoFirstPage: false, bufferPages: true, info: {
  Title: "Vicious — Brand Guidelines",
  Author: "Vicious",
  Subject: "Brand Identity System",
}});
doc.pipe(fs.createWriteStream(OUT));

function newPage() { doc.addPage(PAGE); }

function drawCover() {
  newPage();
  const w = doc.page.width, h = doc.page.height;
  doc.save();
  doc.rect(0, 0, w, h).fill(COLORS.onyx);
  // Crimson hairline at 62%
  doc.rect(0, h * 0.62, w, 4).fill(COLORS.accent);
  // Eyebrow
  doc.fillColor("#9CA3AF").font(FONTS.body).fontSize(11)
    .text("BRAND IDENTITY SYSTEM · v1.0", 72, h * 0.32, { width: w - 144, characterSpacing: 3 });
  // V mark
  doc.save();
  doc.translate(72, h * 0.36);
  doc.fillColor(COLORS.accent);
  doc.moveTo(0, 0).lineTo(28, 0).lineTo(50, 64).lineTo(72, 0).lineTo(100, 0)
     .lineTo(60, 110).lineTo(40, 110).closePath().fill();
  doc.restore();
  // Wordmark
  doc.fillColor(COLORS.bone).font(FONTS.bold).fontSize(64)
    .text("VICIOUS", 200, h * 0.40, { width: w - 272, characterSpacing: 6 });
  doc.fillColor("#CBD5E1").font(FONTS.body).fontSize(16)
    .text("Brand Guidelines", 200, h * 0.50, { width: w - 272 });
  doc.fillColor("#9CA3AF").font(FONTS.body).fontSize(11)
    .text("Esports · Team Platform", 72, h * 0.66, { width: w - 144, characterSpacing: 3 });
  doc.fillColor("#64748B").fontSize(10)
    .text(new Date().toISOString().slice(0, 10), 72, h - 96);
  doc.restore();
}

function renderInline(inline, opts = {}) {
  const baseSize = opts.size ?? 11;
  const baseColor = opts.color ?? COLORS.text;
  const stack = [{ font: FONTS.body, color: baseColor, size: baseSize }];
  const parts = [];
  for (const t of inline.children || []) {
    if (t.type === "text") parts.push({ text: t.content, ...stack[stack.length - 1] });
    else if (t.type === "softbreak") parts.push({ text: " ", ...stack[stack.length - 1] });
    else if (t.type === "hardbreak") parts.push({ text: "\n", ...stack[stack.length - 1] });
    else if (t.type === "strong_open") stack.push({ ...stack[stack.length - 1], font: FONTS.bold });
    else if (t.type === "strong_close") stack.pop();
    else if (t.type === "em_open") stack.push({ ...stack[stack.length - 1], font: FONTS.italic });
    else if (t.type === "em_close") stack.pop();
    else if (t.type === "code_inline") parts.push({ text: t.content, font: FONTS.mono, color: COLORS.accent, size: baseSize - 0.5 });
  }
  if (parts.length === 0) return;
  parts.forEach((p, i) => {
    doc.font(p.font).fontSize(p.size).fillColor(p.color);
    const continued = i < parts.length - 1;
    doc.text(p.text, { continued, lineGap: 2 });
  });
}

function ensureSpace(needed) {
  if (doc.y + needed > doc.page.height - PAGE.margins.bottom) newPage();
}

function renderHeading(level, inline) {
  const sizes = { 1: 24, 2: 18, 3: 14, 4: 12 };
  const size = sizes[level] ?? 12;
  ensureSpace(size + 30);
  doc.moveDown(level === 2 ? 1 : 0.6);
  const text = (inline.children || []).map(c => c.content).join("");
  doc.font(FONTS.bold).fontSize(size).fillColor(level === 2 ? COLORS.accent : COLORS.text);
  if (level === 2 || level === 1) {
    doc.text(text.toUpperCase(), { lineGap: 2, characterSpacing: level === 2 ? 1.5 : 1 });
  } else {
    doc.text(text, { lineGap: 2 });
  }
  if (level === 2) {
    const y = doc.y + 2;
    doc.moveTo(PAGE.margins.left, y).lineTo(doc.page.width - PAGE.margins.right, y)
      .lineWidth(0.5).strokeColor(COLORS.rule).stroke();
    doc.moveDown(0.6);
  } else {
    doc.moveDown(0.4);
  }
}

function renderParagraph(inline) {
  ensureSpace(40);
  renderInline(inline);
  doc.moveDown(0.6);
}

function renderList(items, ordered) {
  for (let i = 0; i < items.length; i++) {
    const inline = items[i];
    ensureSpace(30);
    const bullet = ordered ? `${i + 1}.` : "•";
    const indent = 16;
    const startX = PAGE.margins.left;
    const y = doc.y;
    doc.font(FONTS.body).fontSize(11).fillColor(COLORS.muted)
      .text(bullet, startX, y, { width: indent });
    doc.y = y;
    doc.x = startX + indent + 4;
    renderInline(inline, { size: 11 });
    doc.x = startX;
    doc.moveDown(0.3);
  }
  doc.moveDown(0.3);
}

function renderTable(rows) {
  const colCount = rows[0].length;
  const usableW = doc.page.width - PAGE.margins.left - PAGE.margins.right;
  const colW = usableW / colCount;
  const cellPad = 6;

  function rowHeight(row, isHeader) {
    let max = 1;
    doc.font(isHeader ? FONTS.bold : FONTS.body).fontSize(10);
    for (const cell of row) {
      const h = doc.heightOfString(cell, { width: colW - cellPad * 2 });
      max = Math.max(max, h);
    }
    return max + cellPad * 2;
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isHeader = r === 0;
    const h = rowHeight(row, isHeader);
    ensureSpace(h + 4);
    const y = doc.y;
    if (isHeader) {
      doc.save().rect(PAGE.margins.left, y, usableW, h).fill("#EEF2F7").restore();
    }
    for (let c = 0; c < row.length; c++) {
      const x = PAGE.margins.left + colW * c;
      doc.font(isHeader ? FONTS.bold : FONTS.body).fontSize(10).fillColor(COLORS.text);
      doc.text(row[c], x + cellPad, y + cellPad, { width: colW - cellPad * 2 });
      doc.rect(x, y, colW, h).lineWidth(0.4).strokeColor(COLORS.rule).stroke();
    }
    doc.y = y + h;
  }
  doc.moveDown(0.6);
}

function inlineText(inline) {
  return (inline.children || []).map(c => c.content).join("");
}

drawCover();
newPage();

let i = 0;
while (i < tokens.length) {
  const t = tokens[i];
  if (t.type === "heading_open") {
    const level = Number(t.tag.slice(1));
    const inline = tokens[i + 1];
    renderHeading(level, inline);
    i += 3;
  } else if (t.type === "paragraph_open") {
    const inline = tokens[i + 1];
    renderParagraph(inline);
    i += 3;
  } else if (t.type === "bullet_list_open" || t.type === "ordered_list_open") {
    const ordered = t.type === "ordered_list_open";
    const items = [];
    let depth = 1;
    let j = i + 1;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === t.type) depth++;
      else if (tokens[j].type === (ordered ? "ordered_list_close" : "bullet_list_close")) { depth--; if (depth === 0) break; }
      else if (tokens[j].type === "list_item_open" && depth === 1) {
        let k = j + 1;
        while (k < tokens.length && tokens[k].type !== "list_item_close") {
          if (tokens[k].type === "inline") { items.push(tokens[k]); break; }
          k++;
        }
      }
      j++;
    }
    renderList(items, ordered);
    i = j + 1;
  } else if (t.type === "hr") {
    ensureSpace(20);
    const y = doc.y + 4;
    doc.moveTo(PAGE.margins.left, y).lineTo(doc.page.width - PAGE.margins.right, y)
      .lineWidth(0.5).strokeColor(COLORS.rule).stroke();
    doc.y = y + 8;
    i++;
  } else if (t.type === "table_open") {
    const rows = [];
    let j = i + 1;
    let curRow = null;
    while (j < tokens.length && tokens[j].type !== "table_close") {
      if (tokens[j].type === "tr_open") curRow = [];
      else if (tokens[j].type === "tr_close") { rows.push(curRow); curRow = null; }
      else if (tokens[j].type === "inline" && curRow) curRow.push(inlineText(tokens[j]));
      j++;
    }
    renderTable(rows);
    i = j + 1;
  } else {
    i++;
  }
}

const range = doc.bufferedPageRange();
const total = range.count;
for (let p = 0; p < total; p++) {
  doc.switchToPage(range.start + p);
  if (p === 0) continue;
  const y = doc.page.height - PAGE.margins.bottom + 24;
  doc.font(FONTS.body).fontSize(9).fillColor(COLORS.muted)
    .text("VICIOUS · Brand Guidelines v1.0", PAGE.margins.left, y, { width: 300, lineBreak: false, characterSpacing: 1 });
  doc.text(`Page ${p} of ${total - 1}`, doc.page.width - PAGE.margins.right - 200, y, { width: 200, align: "right", lineBreak: false });
}

doc.end();
console.log("Wrote", OUT);
