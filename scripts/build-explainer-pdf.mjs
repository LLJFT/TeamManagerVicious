import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import MarkdownIt from "markdown-it";

const SRC = path.resolve("deliverables/explainer_video/Explainer_Video_Production.md");
const OUT = path.resolve("deliverables/explainer_video/Explainer_Video_Production.pdf");

const md = new MarkdownIt({ html: false, linkify: false, typographer: true });
const tokens = md.parse(fs.readFileSync(SRC, "utf8"), {});

const PAGE = { size: "LETTER", margins: { top: 64, bottom: 64, left: 64, right: 64 } };
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
  Title: "Vicious — Premium Explainer Video Production Package",
  Author: "Vicious",
  Subject: "Explainer Video — Production Bible",
}});
doc.pipe(fs.createWriteStream(OUT));

function newPage() { doc.addPage(PAGE); }

function drawCover() {
  newPage();
  const w = doc.page.width, h = doc.page.height;
  doc.save();
  doc.rect(0, 0, w, h).fill(COLORS.onyx);
  doc.rect(0, h * 0.62, w, 4).fill(COLORS.accent);
  doc.fillColor("#9CA3AF").font(FONTS.body).fontSize(11).text("VICIOUS  ·  ESPORTS PLATFORM", 64, 80, { characterSpacing: 3 });
  doc.fillColor("#F5F6F8").font(FONTS.bold).fontSize(36).text("Premium Explainer Video", 64, 120, { width: w - 128 });
  doc.fillColor("#F5F6F8").font(FONTS.bold).fontSize(36).text("Production Package", 64, 162, { width: w - 128 });
  doc.fillColor("#9CA3AF").font(FONTS.body).fontSize(13).text("Concept · Script · Storyboard · Motion direction · Production notes · Delivery", 64, 220, { width: w - 128 });
  doc.fillColor("#9CA3AF").font(FONTS.body).fontSize(10).text("Long cut 75s  ·  Short cut 35s  ·  16:9 / 9:16 / 1:1", 64, h - 96);
  doc.fillColor("#F5F6F8").font(FONTS.bold).fontSize(11).text("vicious.gg", 64, h - 76);
  doc.restore();
}

function ensureSpace(needed) {
  if (doc.y + needed > doc.page.height - PAGE.margins.bottom) newPage();
}

function inlineText(children) {
  return children.map((c) => c.content || (c.children ? inlineText(c.children) : "")).join("");
}

function renderTokens(tokens) {
  let listStack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t.type) {
      case "heading_open": {
        const lvl = parseInt(t.tag.slice(1), 10);
        const text = inlineText(tokens[i + 1].children || []);
        i += 2;
        if (lvl === 1) { newPage(); doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(22).text(text); doc.moveDown(0.3); doc.strokeColor(COLORS.accent).lineWidth(2).moveTo(64, doc.y).lineTo(140, doc.y).stroke(); doc.moveDown(0.6); }
        else if (lvl === 2) { ensureSpace(50); doc.moveDown(0.6); doc.fillColor(COLORS.accent).font(FONTS.bold).fontSize(15).text(text); doc.moveDown(0.3); }
        else { ensureSpace(34); doc.moveDown(0.4); doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(12).text(text); doc.moveDown(0.2); }
        break;
      }
      case "paragraph_open": {
        const text = inlineText(tokens[i + 1].children || []);
        i += 2;
        ensureSpace(20);
        doc.fillColor(COLORS.text).font(FONTS.body).fontSize(10.5).text(text, { lineGap: 2 });
        doc.moveDown(0.4);
        break;
      }
      case "bullet_list_open":
      case "ordered_list_open":
        listStack.push(t.type === "ordered_list_open" ? { type: "o", n: 1 } : { type: "u" });
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        listStack.pop();
        doc.moveDown(0.3);
        break;
      case "list_item_open": {
        const list = listStack[listStack.length - 1];
        // find inline content inside the item
        let j = i + 1;
        let text = "";
        while (j < tokens.length && tokens[j].type !== "list_item_close") {
          if (tokens[j].type === "inline") text = inlineText(tokens[j].children || []);
          j++;
        }
        i = j;
        ensureSpace(16);
        const bullet = list?.type === "o" ? `${list.n++}. ` : "•  ";
        doc.fillColor(COLORS.text).font(FONTS.body).fontSize(10.5).text(bullet + text, { indent: 10, lineGap: 1.5 });
        break;
      }
      case "fence":
      case "code_block": {
        ensureSpace(40);
        const lines = t.content.split("\n");
        const lineH = 12;
        const blockH = lines.length * lineH + 12;
        ensureSpace(blockH);
        const x = 64, y = doc.y;
        doc.save();
        doc.rect(x, y, doc.page.width - 128, blockH).fill("#F5F6F8");
        doc.fillColor("#0E1117").font(FONTS.mono).fontSize(9).text(t.content, x + 8, y + 6, { width: doc.page.width - 144, lineGap: 1 });
        doc.restore();
        doc.y = y + blockH + 6;
        break;
      }
      case "table_open": {
        // collect rows until table_close
        const rows = [];
        let cur = null;
        let j = i + 1;
        while (j < tokens.length && tokens[j].type !== "table_close") {
          const tk = tokens[j];
          if (tk.type === "tr_open") cur = [];
          else if (tk.type === "tr_close") { rows.push(cur); cur = null; }
          else if (tk.type === "inline" && cur) cur.push(inlineText(tk.children || []));
          j++;
        }
        i = j;
        renderTable(rows);
        doc.moveDown(0.4);
        break;
      }
      case "hr":
        ensureSpace(20);
        doc.moveDown(0.3);
        doc.strokeColor(COLORS.rule).lineWidth(0.5).moveTo(64, doc.y).lineTo(doc.page.width - 64, doc.y).stroke();
        doc.moveDown(0.4);
        break;
      case "blockquote_open": {
        let j = i + 1, parts = [];
        while (j < tokens.length && tokens[j].type !== "blockquote_close") {
          if (tokens[j].type === "inline") parts.push(inlineText(tokens[j].children || []));
          j++;
        }
        i = j;
        ensureSpace(40);
        const x0 = 64, y0 = doc.y;
        doc.save();
        doc.rect(x0, y0, 3, parts.length * 14 + 8).fill(COLORS.accent);
        doc.fillColor(COLORS.text).font(FONTS.italic).fontSize(10.5).text(parts.join("\n"), x0 + 14, y0 + 2, { width: doc.page.width - 128 - 14, lineGap: 2 });
        doc.restore();
        doc.moveDown(0.4);
        break;
      }
      default: break;
    }
  }
}

function renderTable(rows) {
  if (!rows.length) return;
  const cols = rows[0].length;
  const tableW = doc.page.width - 128;
  const colW = tableW / cols;
  const lineH = 14;
  for (let r = 0; r < rows.length; r++) {
    ensureSpace(lineH + 4);
    const y = doc.y;
    if (r === 0) doc.save().rect(64, y - 2, tableW, lineH + 4).fill("#F5F6F8").restore();
    rows[r].forEach((cell, c) => {
      doc.fillColor(r === 0 ? COLORS.text : COLORS.text).font(r === 0 ? FONTS.bold : FONTS.body).fontSize(9).text(cell, 64 + c * colW + 6, y + 2, { width: colW - 12, ellipsis: true, lineBreak: false });
    });
    doc.y = y + lineH + 2;
    doc.strokeColor(COLORS.rule).lineWidth(0.4).moveTo(64, doc.y).lineTo(64 + tableW, doc.y).stroke();
    doc.moveDown(0.05);
  }
}

drawCover();
newPage();
renderTokens(tokens);

// page numbers
const range = doc.bufferedPageRange();
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(i);
  doc.fillColor(COLORS.muted).font(FONTS.body).fontSize(8).text(`Vicious · Explainer Video Production · ${i} / ${range.count - 1}`, 64, doc.page.height - 36, { width: doc.page.width - 128, align: "center" });
}

doc.end();
console.log("→ wrote", OUT);
