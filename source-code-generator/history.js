const els = {
  search: document.querySelector("#history-search"),
  refresh: document.querySelector("#refresh-history"),
  status: document.querySelector("#history-status"),
  list: document.querySelector("#history-list")
};

let records = [];

function getRecordValue(record, ...keys) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function matchesSearch(record, query) {
  if (!query) return true;
  const haystack = [
    getRecordValue(record, "region"),
    getRecordValue(record, "landing_page", "landingPage"),
    getRecordValue(record, "platform"),
    getRecordValue(record, "medium"),
    getRecordValue(record, "tracking_date", "trackingDate"),
    getRecordValue(record, "topic"),
    getRecordValue(record, "campaign"),
    getRecordValue(record, "actionkit_source", "actionkitSource"),
    getRecordValue(record, "final_url", "finalUrl")
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function renderHistory() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = records.filter((record) => matchesSearch(record, query));

  if (!records.length) {
    els.status.textContent = "No URLs have been saved yet. Create one from the main page first.";
    els.list.innerHTML = "";
    return;
  }

  els.status.textContent = `${filtered.length} saved URL${filtered.length === 1 ? "" : "s"} shown.`;

  if (!filtered.length) {
    els.list.innerHTML = '<div class="empty-state">No saved URLs match that search.</div>';
    return;
  }

  els.list.innerHTML = filtered
    .map(
      (record) => `
        <article class="history-card">
          <div class="history-card-top">
            <div>
              <p class="mini-label">Created</p>
              <p class="history-meta">${escapeHtml(formatDate(getRecordValue(record, "created_at", "createdAt")))}</p>
            </div>
            <button class="ghost-button copy-history-url" type="button" data-url="${escapeHtml(getRecordValue(record, "final_url", "finalUrl"))}">Copy URL</button>
          </div>
          <div class="history-tags">
            <span class="history-tag">Date: ${escapeHtml(getRecordValue(record, "tracking_date", "trackingDate") || "-")}</span>
            <span class="history-tag">Topic: ${escapeHtml(getRecordValue(record, "topic") || "-")}</span>
          </div>
          <p class="history-url">${escapeHtml(getRecordValue(record, "final_url", "finalUrl"))}</p>
          <dl class="history-details">
            <div><dt>Region</dt><dd>${escapeHtml(getRecordValue(record, "region") || "-")}</dd></div>
            <div><dt>Source</dt><dd>${escapeHtml(getRecordValue(record, "platform") || "-")}</dd></div>
            <div><dt>Medium</dt><dd>${escapeHtml(getRecordValue(record, "medium") || "-")}</dd></div>
            <div><dt>Date</dt><dd>${escapeHtml(getRecordValue(record, "tracking_date", "trackingDate") || "-")}</dd></div>
            <div><dt>Topic</dt><dd>${escapeHtml(getRecordValue(record, "topic") || "-")}</dd></div>
            <div><dt>Campaign</dt><dd>${escapeHtml(getRecordValue(record, "campaign") || "-")}</dd></div>
            <div><dt>ActionKit source</dt><dd>${escapeHtml(getRecordValue(record, "actionkit_source", "actionkitSource") || "-")}</dd></div>
          </dl>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".copy-history-url").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.url || "");
      } catch {
        window.alert("Could not copy this URL.");
      }
    });
  });
}

async function loadHistory() {
  els.status.textContent = "Loading saved URLs...";
  try {
    const response = await fetch("/api/urls");
    if (!response.ok) throw new Error("Request failed");
    records = await response.json();
    renderHistory();
  } catch {
    els.status.textContent = "Could not load saved URLs. Make sure the local server is running.";
    els.list.innerHTML = "";
  }
}

els.search.addEventListener("input", renderHistory);
els.refresh.addEventListener("click", loadHistory);

loadHistory();
