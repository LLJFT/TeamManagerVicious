import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import MarkdownIt from "markdown-it";

const SRC = path.resolve("docs/Bootcamp-Product-Documentation.md");
const OUT = path.resolve("docs/Bootcamp-Product-Documentation.pdf");

const md = new MarkdownIt({ html: false, linkify: false, typographer: true });
const tokens = md.parse(fs.readFileSync(SRC, "utf8"), {});

const PAGE = { size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 } };
const COLORS = {
  text: "#1a1f2e",
  muted: "#5b6573",
  accent: "#0e7490",
  rule: "#d6dde6",
  codeBg: "#f3f5f9",
};
const FONTS = { body: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", mono: "Courier" };

const doc = new PDFDocument({ ...PAGE, autoFirstPage: false, bufferPages: true, info: {
  Title: "The Bootcamp — Product Documentation",
  Author: "The Bootcamp",
  Subject: "Product Documentation",
}});
doc.pipe(fs.createWriteStream(OUT));

function newPage() { doc.addPage(PAGE); }

function drawCover() {
  newPage();
  const w = doc.page.width, h = doc.page.height;
  doc.save();
  doc.rect(0, 0, w, h).fill("#0b1220");
  doc.rect(0, h * 0.62, w, 6).fill(COLORS.accent);
  doc.fillColor("#9fb3c8").font(FONTS.body).fontSize(14)
    .text("ESPORTS TEAM MANAGEMENT PLATFORM", 72, h * 0.32, { width: w - 144, align: "left", characterSpacing: 2 });
  doc.fillColor("#ffffff").font(FONTS.bold).fontSize(48)
    .text("The Bootcamp", 72, h * 0.38, { width: w - 144, align: "left" });
  doc.fillColor("#cbd5e1").font(FONTS.body).fontSize(20)
    .text("Product Documentation", 72, h * 0.50, { width: w - 144, align: "left" });
  doc.fillColor("#94a3b8").font(FONTS.body).fontSize(11)
    .text("Sourced from the current production codebase", 72, h * 0.66, { width: w - 144, align: "left" });
  doc.fillColor("#64748b").fontSize(10)
    .text(new Date().toISOString().slice(0, 10), 72, h - 96, { width: w - 144, align: "left" });
  doc.restore();
}

// Inline rendering: bold/italic/code from inline tokens
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

const headings = []; // for TOC: { level, text, page }

function renderHeading(level, inline) {
  const sizes = { 1: 22, 2: 18, 3: 14, 4: 12 };
  const size = sizes[level] ?? 12;
  const spaceBefore = level === 2 ? 18 : level === 3 ? 12 : 8;
  const spaceAfter = level === 2 ? 8 : 6;
  ensureSpace(size + spaceBefore + spaceAfter + 20);
  doc.moveDown(spaceBefore / 12);
  const text = (inline.children || []).map(c => c.content).join("");
  // Record TOC entry on the current page index (will be remapped later because cover/TOC pages are inserted before content)
  headings.push({ level, text, pageIndex: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
  doc.font(FONTS.bold).fontSize(size).fillColor(level === 2 ? COLORS.accent : COLORS.text);
  doc.text(text, { lineGap: 2 });
  if (level === 2) {
    const y = doc.y + 2;
    doc.moveTo(PAGE.margins.left, y).lineTo(doc.page.width - PAGE.margins.right, y)
      .lineWidth(0.5).strokeColor(COLORS.rule).stroke();
    doc.moveDown(0.6);
  } else {
    doc.moveDown(spaceAfter / 12);
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
      .text(bullet, startX, y, { width: indent, continued: false });
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
  const lineH = 13;

  function rowHeight(row, isHeader) {
    let maxLines = 1;
    doc.font(isHeader ? FONTS.bold : FONTS.body).fontSize(10);
    for (const cell of row) {
      const h = doc.heightOfString(cell, { width: colW - cellPad * 2 });
      maxLines = Math.max(maxLines, h);
    }
    return maxLines + cellPad * 2;
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isHeader = r === 0;
    const h = rowHeight(row, isHeader);
    ensureSpace(h + 4);
    const y = doc.y;
    if (isHeader) {
      doc.save().rect(PAGE.margins.left, y, usableW, h).fill("#eef2f7").restore();
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

// Walk tokens
let i = 0;
function nextInlineAfter(openIdx) {
  for (let j = openIdx + 1; j < tokens.length; j++) if (tokens[j].type === "inline") return tokens[j];
  return { children: [] };
}

drawCover();

// Reserve TOC page
newPage();
const tocPageIndex = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;

// First content page
newPage();

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
        // Find inline within this item
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

// Now render TOC on the reserved page, and page numbers in footer
const range = doc.bufferedPageRange();
// Build TOC: only h2 entries, mapped to their actual page numbers
// pdfkit pages are 0-indexed via bufferedPageRange
function gotoPage(idx) { doc.switchToPage(idx); }

gotoPage(tocPageIndex);
doc.font(FONTS.bold).fontSize(22).fillColor(COLORS.text)
  .text("Table of Contents", PAGE.margins.left, PAGE.margins.top);
doc.moveTo(PAGE.margins.left, doc.y + 4).lineTo(doc.page.width - PAGE.margins.right, doc.y + 4)
  .lineWidth(0.5).strokeColor(COLORS.rule).stroke();
doc.y += 16;

const tocItems = headings.filter(h => h.level === 2);
for (const h of tocItems) {
  const y = doc.y;
  const humanPage = h.pageIndex - tocPageIndex; // cover=?, but we want page number relative to start
  doc.font(FONTS.body).fontSize(12).fillColor(COLORS.text)
    .text(h.text, PAGE.margins.left, y, { width: doc.page.width - PAGE.margins.left - PAGE.margins.right - 40, continued: false });
  doc.font(FONTS.body).fontSize(11).fillColor(COLORS.muted)
    .text(String(humanPage + 1), doc.page.width - PAGE.margins.right - 30, y, { width: 30, align: "right" });
  doc.moveDown(0.3);
}

// Page numbers in footer for content pages (skip cover page = first page)
const total = range.count;
for (let p = 0; p < total; p++) {
  doc.switchToPage(range.start + p);
  if (p === 0) continue; // cover
  const y = doc.page.height - PAGE.margins.bottom + 24;
  doc.font(FONTS.body).fontSize(9).fillColor(COLORS.muted)
    .text(`The Bootcamp — Product Documentation`, PAGE.margins.left, y, { width: 300, align: "left", lineBreak: false });
  doc.text(`Page ${p} of ${total - 1}`, doc.page.width - PAGE.margins.right - 200, y, { width: 200, align: "right", lineBreak: false });
}

doc.end();
console.log("Wrote", OUT);
