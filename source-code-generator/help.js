import { WORKBOOK_DATA } from "./data.js";

const syntaxList = document.querySelector("#syntax-list");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

syntaxList.innerHTML = WORKBOOK_DATA.syntaxGuides
  .map((guide) => {
    const syntax = guide.syntax ? `<p><strong>Syntax:</strong> ${escapeHtml(guide.syntax)}</p>` : "";
    const example = guide.example ? `<p><strong>Example:</strong> ${escapeHtml(guide.example)}</p>` : "";
    const notes = guide.notes ? `<p><strong>Notes:</strong> ${escapeHtml(guide.notes)}</p>` : "";
    return `<article class="syntax-item"><h4>${escapeHtml(guide.label)}</h4>${syntax}${example}${notes}</article>`;
  })
  .join("");
