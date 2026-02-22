// ---------- Helpers ----------
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","when","while","for","to","of","in","on","at","by","from","with","as",
  "is","are","was","were","be","been","being",
  "it","its","this","that","these","those",
  "i","me","my","mine","we","us","our","ours","you","your","yours","he","him","his","she","her","hers","they","them","their","theirs",
  "not","no","yes","do","does","did","doing","done",
  "can","could","should","would","may","might","must","will","shall",
  "so","than","too","very","just","also","about","into","over","under","again","more","most","some","any","all","each","few","many",
  "because","until","during","before","after","above","below","up","down","out","off","there","here","why","how","what","who","whom","which",
  "been","being","have","has","had","having"
]);

function formatDurationSeconds(totalSeconds){
  totalSeconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2,"0")}s`;
}

function getSentences(text){
  const parts = text
    .replace(/\s+/g, " ")
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length;
}

function getParagraphs(text){
  const parts = text
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length;
}

function getLines(text){
  if (!text.trim()) return 0;
  return text.replace(/\r\n/g, "\n").split("\n").length;
}

function getWords(text, countNumbersAsWords){
  const re = countNumbersAsWords
    ? /\b(?:[a-zA-Z]+(?:['-][a-zA-Z]+)*|\d+(?:[\.,]\d+)*)\b/g
    : /\b[a-zA-Z]+(?:['-][a-zA-Z]+)*\b/g;
  return (text.match(re) || []);
}

function countSyllables(rawWord){
  let word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing silent 'e'
  word = word.replace(/e\b/, "");

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let syllables = vowelGroups ? vowelGroups.length : 0;

  // "le" ending heuristic
  if (/[aeiouy][^aeiouy]le\b/.test(word)) syllables += 1;

  // "-ed" / "-es" heuristic
  if (/(ed|es)\b/.test(word) && !/(ted|ded)\b/.test(word)) syllables -= 1;

  if (syllables < 1) syllables = 1;
  return syllables;
}

function fogLabel(fog){
  if (!isFinite(fog) || fog <= 0) return { text:"Readability", cls:"muted" };
  if (fog < 6)  return { text:"Very easy", cls:"good" };
  if (fog < 9)  return { text:"Easy", cls:"good" };
  if (fog < 13) return { text:"Standard", cls:"warn" };
  if (fog < 17) return { text:"Difficult", cls:"warn" };
  return { text:"Very difficult", cls:"bad" };
}

function gunningFogIndex(text, countNumbersAsWords){
  const words = getWords(text, countNumbersAsWords);
  const wordCount = words.length;
  if (wordCount === 0) return { fog: 0, complex: 0, sentences: 0 };

  let sentenceCount = getSentences(text);
  if (sentenceCount === 0) sentenceCount = 1;

  let complexCount = 0;
  for (const w of words){
    // Only count alphabetic words as complex for syllables
    if (/^[A-Za-z]/.test(w) && countSyllables(w) >= 3) complexCount += 1;
  }

  const avgSentenceLength = wordCount / sentenceCount;
  const pctComplex = (complexCount / wordCount) * 100;
  const fog = 0.4 * (avgSentenceLength + pctComplex);

  return { fog, complex: complexCount, sentences: sentenceCount };
}

function computeKeywordDensity(words, ignoreStopwords, topN){
  const counts = new Map();
  for (const w of words){
    const lower = w.toLowerCase();
    if (!/[a-z]/i.test(lower)) continue;
    if (ignoreStopwords && STOPWORDS.has(lower)) continue;
    if (lower.length < 2) continue;
    counts.set(lower, (counts.get(lower) || 0) + 1);
  }

  const total = words.length || 1;
  return [...counts.entries()]
    .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([kw, c]) => ({ kw, c, pct: (c / total) * 100 }));
}

// ---------- UI wiring ----------
const els = {
  text: document.getElementById("text"),
  btnSample: document.getElementById("btnSample"),
  btnCopy: document.getElementById("btnCopy"),
  btnDownload: document.getElementById("btnDownload"),
  btnClear: document.getElementById("btnClear"),
  optNumbers: document.getElementById("optNumbers"),
  optStopwords: document.getElementById("optStopwords"),
  wpm: document.getElementById("wpm"),
  spm: document.getElementById("spm"),
  wpmOut: document.getElementById("wpmOut"),
  spmOut: document.getElementById("spmOut"),
  // metrics
  mWords: document.getElementById("mWords"),
  mUnique: document.getElementById("mUnique"),
  mChars: document.getElementById("mChars"),
  mCharsNoSpaces: document.getElementById("mCharsNoSpaces"),
  mSentences: document.getElementById("mSentences"),
  mAvgSent: document.getElementById("mAvgSent"),
  mParagraphs: document.getElementById("mParagraphs"),
  mLines: document.getElementById("mLines"),
  mReadTime: document.getElementById("mReadTime"),
  mSpeakTime: document.getElementById("mSpeakTime"),
  mWpm: document.getElementById("mWpm"),
  mSpm: document.getElementById("mSpm"),
  mFog: document.getElementById("mFog"),
  mComplex: document.getElementById("mComplex"),
  fogLabel: document.getElementById("fogLabel"),
  kwBody: document.getElementById("kwBody"),
  kwMeta: document.getElementById("kwMeta")
};

const STORAGE_KEY = "simple_word_counter_text_v1";
const TOP_KEYWORDS = 15;

function setFogPill(fog){
  const info = fogLabel(fog);
  els.fogLabel.textContent = info.text;
  els.fogLabel.classList.remove("good","warn","bad","muted");
  els.fogLabel.classList.add(info.cls);
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, ch => (
    ch === "&" ? "&amp;" :
    ch === "<" ? "&lt;" :
    ch === ">" ? "&gt;" :
    ch === `"` ? "&quot;" : "&#39;"
  ));
}

function renderKeywords(rows, totalWords){
  els.kwMeta.textContent = `Top ${TOP_KEYWORDS}`;

  if (totalWords === 0){
    els.kwBody.innerHTML = `<tr><td class="muted" colspan="3">Type to see keywords…</td></tr>`;
    return;
  }
  if (rows.length === 0){
    els.kwBody.innerHTML = `<tr><td class="muted" colspan="3">No keywords found with current filters.</td></tr>`;
    return;
  }

  els.kwBody.innerHTML = rows.map(r => {
    const pct = r.pct.toFixed(2) + "%";
    return `<tr>
      <td>${escapeHtml(r.kw)}</td>
      <td>${r.c}</td>
      <td>${pct}</td>
    </tr>`;
  }).join("");
}

function update(){
  const text = els.text.value;

  const countNumbers = els.optNumbers.checked;
  const ignoreStopwords = els.optStopwords.checked;

  const words = getWords(text, countNumbers);
  const wordCount = words.length;

  const unique = new Set(words.map(w => w.toLowerCase())).size;

  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;

  let sentences = getSentences(text);
  const paragraphs = getParagraphs(text);
  const lines = getLines(text);

  if (sentences === 0 && wordCount > 0) sentences = 1;

  const avgSent = (sentences > 0) ? (wordCount / sentences) : 0;

  const wpm = parseInt(els.wpm.value, 10);
  const spm = parseInt(els.spm.value, 10);

  const readSeconds = (wordCount / Math.max(1, wpm)) * 60;
  const speakSeconds = (wordCount / Math.max(1, spm)) * 60;

  const fogRes = gunningFogIndex(text, countNumbers);

  // Metrics
  els.mWords.textContent = wordCount.toLocaleString();
  els.mUnique.textContent = `Unique: ${unique.toLocaleString()}`;

  els.mChars.textContent = chars.toLocaleString();
  els.mCharsNoSpaces.textContent = charsNoSpaces.toLocaleString();

  els.mSentences.textContent = sentences.toLocaleString();
  els.mAvgSent.textContent = (avgSent ? avgSent.toFixed(1) : "0");

  els.mParagraphs.textContent = paragraphs.toLocaleString();
  els.mLines.textContent = lines.toLocaleString();

  els.mReadTime.textContent = formatDurationSeconds(readSeconds);
  els.mSpeakTime.textContent = formatDurationSeconds(speakSeconds);

  els.mWpm.textContent = wpm;
  els.mSpm.textContent = spm;

  if (wordCount === 0){
    els.mFog.textContent = "—";
    els.mComplex.textContent = "0";
    setFogPill(0);
  } else {
    els.mFog.textContent = (isFinite(fogRes.fog) ? fogRes.fog.toFixed(1) : "—");
    els.mComplex.textContent = fogRes.complex.toLocaleString();
    setFogPill(fogRes.fog);
  }

  // Keyword density
  const kwRows = computeKeywordDensity(words, ignoreStopwords, TOP_KEYWORDS);
  renderKeywords(kwRows, wordCount);

  // Autosave
  try { localStorage.setItem(STORAGE_KEY, text); } catch {}
}

// Small debounce so typing stays snappy on long text
let t = null;
function scheduleUpdate(){
  if (t) clearTimeout(t);
  t = setTimeout(update, 60);
}

// Actions
els.btnClear.addEventListener("click", () => {
  els.text.value = "";
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  update();
  els.text.focus();
});

els.btnCopy.addEventListener("click", async () => {
  const text = els.text.value;
  try {
    await navigator.clipboard.writeText(text);
    els.btnCopy.textContent = "Copied";
    setTimeout(() => els.btnCopy.textContent = "Copy", 900);
  } catch {
    // Fallback
    els.text.focus();
    els.text.select();
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    els.btnCopy.textContent = "Copied";
    setTimeout(() => els.btnCopy.textContent = "Copy", 900);
  }
});

els.btnDownload.addEventListener("click", () => {
  const blob = new Blob([els.text.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "text.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

els.btnSample.addEventListener("click", () => {
  const sample =
`Good writing is clear and direct. It uses short sentences when possible, and it avoids unnecessary complexity.

Readability scores are estimates. They are most useful when you compare two versions of the same text.

Try adding longer sentences with many multisyllabic words to see how the Gunning Fog Index changes.`;
  els.text.value = sample;
  update();
  els.text.focus();
});

// Controls
els.text.addEventListener("input", scheduleUpdate);
els.optNumbers.addEventListener("change", update);
els.optStopwords.addEventListener("change", update);

els.wpm.addEventListener("input", () => {
  els.wpmOut.textContent = els.wpm.value;
  scheduleUpdate();
});
els.spm.addEventListener("input", () => {
  els.spmOut.textContent = els.spm.value;
  scheduleUpdate();
});

// Init
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved != null) els.text.value = saved;
} catch {}

els.wpmOut.textContent = els.wpm.value;
els.spmOut.textContent = els.spm.value;
update();
