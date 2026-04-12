const SOURCE_URL = "https://mapbox-event-finder.vercel.app/api/csv-export";
const MAX_RETRIES = 2;

const totalEl = document.getElementById("total");
const uniqueCountriesEl = document.getElementById("uniqueCountries");
const tbody = document.getElementById("tableBody");
const eventsBody = document.getElementById("eventsBody");
const platformsBody = document.getElementById("platformsBody");
const errorEl = document.getElementById("error");
const statusPill = document.getElementById("status-pill");
const diag = document.getElementById("diag");
const retryBtn = document.getElementById("retryBtn");
const tabBtnSummary = document.getElementById("tabBtnSummary");
const tabBtnEvents = document.getElementById("tabBtnEvents");
const tabBtnPlatforms = document.getElementById("tabBtnPlatforms");
const tabSummary = document.getElementById("tab-summary");
const tabEvents = document.getElementById("tab-events");
const tabPlatforms = document.getElementById("tab-platforms");

let parsedRows = [];
let currentSort = { field: null, dir: null };
let currentPlatformSort = { by: "count", dir: "desc" };

function setLoading(isLoading) {
  statusPill.textContent = isLoading ? "Loading" : "Idle";
}

function activateTab(which) {
  const isSummary = which === "summary";
  const isEvents = which === "events";
  const isPlatforms = which === "platforms";
  tabSummary.classList.toggle("active", isSummary);
  tabEvents.classList.toggle("active", isEvents);
  tabPlatforms.classList.toggle("active", isPlatforms);
  tabBtnSummary.setAttribute("aria-selected", String(isSummary));
  tabBtnEvents.setAttribute("aria-selected", String(isEvents));
  tabBtnPlatforms.setAttribute("aria-selected", String(isPlatforms));
}

tabBtnSummary.addEventListener("click", () => activateTab("summary"));
tabBtnEvents.addEventListener("click", () => activateTab("events"));
tabBtnPlatforms.addEventListener("click", () => activateTab("platforms"));

function normalizeKeyName(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveKey(row, target) {
  if (!row || typeof row !== "object") return null;
  const want = normalizeKeyName(target);
  for (const k of Object.keys(row)) {
    if (normalizeKeyName(k) === want) return k;
  }
  return null;
}

function resolveCountryKey(row) {
  return resolveKey(row, "country");
}

function normalizeCountry(val) {
  if (val == null) return "Unknown";
  const s = String(val).trim();
  if (!s) return "Unknown";
  const map = {
    US: "United States",
    UK: "United Kingdom",
    GB: "United Kingdom",
    CD: "Congo (DRC)",
    BI: "Burundi",
    SL: "Sierra Leone",
    JM: "Jamaica",
    PR: "Puerto Rico",
    FR: "France"
  };
  return map[s] || s;
}

function summarize(rows) {
  const cleaned = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && typeof r === "object" && Object.keys(r).length > 0
  );
  const counts = new Map();
  for (const r of cleaned) {
    const key = resolveCountryKey(r);
    const value = key ? r[key] : undefined;
    const c = normalizeCountry(value);
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  return { total: cleaned.length, byCountry: sorted };
}

function aggregateByPlatform(rows) {
  const cleaned = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && typeof r === "object" && Object.keys(r).length > 0
  );
  const counts = new Map();
  for (const r of cleaned) {
    const key = resolveKey(r, "rsvp_platform") || resolveKey(r, "rsvp platform");
    let v = key ? r[key] : "";
    v = String(v ?? "").trim();
    const platform = v ? v : "Unknown";
    counts.set(platform, (counts.get(platform) || 0) + 1);
  }
  const arr = Array.from(counts.entries());
  arr.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return arr;
}

function renderSummary({ total, byCountry }) {
  totalEl.textContent = total;
  uniqueCountriesEl.textContent = byCountry.length;
  tbody.innerHTML = "";
  for (const [country, count] of byCountry) {
    const tr = document.createElement("tr");
    const tdC = document.createElement("td");
    tdC.textContent = country;
    const tdN = document.createElement("td");
    tdN.textContent = count;
    tr.appendChild(tdC);
    tr.appendChild(tdN);
    tbody.appendChild(tr);
  }
}

function getField(row, field) {
  const k = resolveKey(row, field);
  return k ? row[k] ?? "" : "";
}

function renderEventsTable(rows) {
  eventsBody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const cells = [
      getField(r, "id"),
      getField(r, "title"),
      getField(r, "city"),
      normalizeCountry(getField(r, "country")),
      getField(r, "rsvp_platform") || getField(r, "rsvp platform")
    ];
    for (const c of cells) {
      const td = document.createElement("td");
      td.textContent = c == null ? "" : String(c);
      tr.appendChild(td);
    }
    eventsBody.appendChild(tr);
  }
}

function renderPlatformsTable(platformPairs) {
  platformsBody.innerHTML = "";
  for (const [name, count] of platformPairs) {
    const tr = document.createElement("tr");
    const tdN = document.createElement("td");
    tdN.textContent = name;
    const tdC = document.createElement("td");
    tdC.textContent = count;
    tr.appendChild(tdN);
    tr.appendChild(tdC);
    platformsBody.appendChild(tr);
  }
}

function sortEvents(field) {
  if (currentSort.field === field) {
    currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
  } else {
    currentSort.field = field;
    currentSort.dir = "asc";
  }
  document.querySelectorAll("#tab-events thead th").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
  });
  const th = document.querySelector(`#tab-events thead th[data-field="${field}"]`);
  if (th) th.classList.add(currentSort.dir === "asc" ? "sort-asc" : "sort-desc");

  const sorted = [...parsedRows];
  sorted.sort((a, b) => {
    const va = (field === "country" ? normalizeCountry(getField(a, field)) : getField(a, field)).toLowerCase();
    const vb = (field === "country" ? normalizeCountry(getField(b, field)) : getField(b, field)).toLowerCase();
    if (va < vb) return currentSort.dir === "asc" ? -1 : 1;
    if (va > vb) return currentSort.dir === "asc" ? 1 : -1;
    return 0;
  });
  renderEventsTable(sorted);
}

function sortPlatforms(by) {
  if (currentPlatformSort.by === by) {
    currentPlatformSort.dir = currentPlatformSort.dir === "asc" ? "desc" : "asc";
  } else {
    currentPlatformSort.by = by;
    currentPlatformSort.dir = by === "count" ? "desc" : "asc";
  }

  document.querySelectorAll("#tab-platforms thead th").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
  });
  const th = document.querySelector(`#tab-platforms thead th[data-platform-sort="${by}"]`);
  if (th) th.classList.add(currentPlatformSort.dir === "asc" ? "sort-asc" : "sort-desc");

  const pairs = aggregateByPlatform(parsedRows);
  pairs.sort((a, b) => {
    if (by === "name") {
      const va = a[0].toLowerCase();
      const vb = b[0].toLowerCase();
      if (va < vb) return currentPlatformSort.dir === "asc" ? -1 : 1;
      if (va > vb) return currentPlatformSort.dir === "asc" ? 1 : -1;
      return 0;
    }
    if (a[1] === b[1]) return a[0].localeCompare(b[0]);
    return currentPlatformSort.dir === "asc" ? a[1] - b[1] : b[1] - a[1];
  });
  renderPlatformsTable(pairs);
}

function assert(cond, msg) {
  const p = document.createElement("p");
  p.textContent = (cond ? "✓ " : "✗ ") + msg;
  p.className = cond ? "ok" : "fail";
  diag.appendChild(p);
  return cond;
}

function runTests() {
  diag.innerHTML = "";
  const rows1 = [{ country: "US" }, { country: "GB" }, { country: "" }, {}];
  const s1 = summarize(rows1);
  assert(s1.total === 3, "Total counts non-empty rows");
  const map1 = Object.fromEntries(s1.byCountry);
  assert(map1["United States"] === 1, "Maps US to United States");
  assert(map1["United Kingdom"] === 1, "Maps GB to United Kingdom");
  assert(map1["Unknown"] === 1, "Blanks grouped under Unknown");

  const ex = {
    ID: "123",
    Title: "Hello",
    CITY: "Paris",
    Country: "FR",
    "RSVP Platform": "controlshift"
  };
  const rowVals = [
    getField(ex, "id"),
    getField(ex, "title"),
    getField(ex, "city"),
    normalizeCountry(getField(ex, "country")),
    getField(ex, "rsvp_platform") || getField(ex, "rsvp platform")
  ];
  assert(
    rowVals[0] === "123" &&
    rowVals[1] === "Hello" &&
    rowVals[2] === "Paris" &&
    rowVals[3] === "France" &&
    rowVals[4] === "controlshift",
    "Events table extracts fields case-insensitively with space/underscore variants"
  );

  const rowsPlat = [
    { rsvp_platform: "controlshift" },
    { "RSVP Platform": "actionkit" },
    { "rsvp platform": "" },
    {}
  ];
  const platPairs = aggregateByPlatform(rowsPlat);
  const platMap = Object.fromEntries(platPairs);
  assert(
    platMap.controlshift === 1 &&
    platMap.actionkit === 1 &&
    platMap.Unknown === 2,
    "Platform aggregation counts values and Unknown correctly"
  );
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }

    i += 1;
  }

  row.push(field);
  rows.push(row);

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function toObjects(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];
  const headers = rows[0];

  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value || "").trim() !== ""))
    .map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] ?? "";
      });
      return entry;
    });
}

function renderFriendlyError(err, attempt, maxAttempts) {
  errorEl.replaceChildren();

  const title = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = "Unable to load data.";
  title.appendChild(strong);
  errorEl.appendChild(title);

  const attemptLine = document.createElement("div");
  attemptLine.className = "muted";
  attemptLine.textContent = `Attempt ${attempt} of ${maxAttempts + 1}`;
  errorEl.appendChild(attemptLine);

  const list = document.createElement("ul");
  list.style.margin = "8px 0 0 16px";
  [
    "The CSV host might be down or blocking cross-origin requests (CORS).",
    'If the CSV schema changed, expected columns include id, title, city, country, rsvp_platform (any case / _ or space). Rows with missing/blank country are "Unknown".',
    "Network hiccup: retry may fix it."
  ].forEach((hint) => {
    const item = document.createElement("li");
    item.textContent = hint;
    list.appendChild(item);
  });
  errorEl.appendChild(list);

  const detail = document.createElement("div");
  detail.className = "muted";
  detail.textContent = err && err.message ? err.message : "";
  errorEl.appendChild(detail);

  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

async function fetchCSVRows() {
  const response = await fetch(SOURCE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status}`);
  }
  const csvText = await response.text();
  return toObjects(csvText);
}

async function loadCSVWithRetry(maxRetries = MAX_RETRIES) {
  setLoading(true);
  clearError();
  let attempt = 0;

  while (true) {
    try {
      parsedRows = await fetchCSVRows();
      const summary = summarize(parsedRows);
      renderSummary(summary);
      renderEventsTable(parsedRows);
      renderPlatformsTable(aggregateByPlatform(parsedRows));
      sortEvents("title");
      sortPlatforms("count");
      setLoading(false);
      break;
    } catch (err) {
      renderFriendlyError(err, attempt + 1, maxRetries);
      if (attempt >= maxRetries) {
        statusPill.textContent = "Error";
        setLoading(false);
        break;
      }
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

document.addEventListener("click", (e) => {
  const th = e.target.closest("#tab-events thead th");
  if (th && th.dataset.field) {
    sortEvents(th.dataset.field);
  }
  const thp = e.target.closest("#tab-platforms thead th");
  if (thp && thp.dataset.platformSort) {
    sortPlatforms(thp.dataset.platformSort);
  }
});

runTests();
loadCSVWithRetry();
retryBtn.addEventListener("click", () => loadCSVWithRetry());
