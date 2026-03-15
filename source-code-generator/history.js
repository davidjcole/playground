const els = {
  search: document.querySelector("#history-search"),
  refresh: document.querySelector("#refresh-history"),
  status: document.querySelector("#history-status"),
  list: document.querySelector("#history-list")
};

let records = [];

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
    record.region,
    record.landing_page,
    record.platform,
    record.medium,
    record.tracking_date,
    record.topic,
    record.campaign,
    record.actionkit_source,
    record.final_url
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
              <p class="history-meta">${escapeHtml(formatDate(record.created_at))}</p>
            </div>
            <button class="ghost-button copy-history-url" type="button" data-url="${escapeHtml(record.final_url)}">Copy URL</button>
          </div>
          <div class="history-tags">
            <span class="history-tag">Date: ${escapeHtml(record.tracking_date || "-")}</span>
            <span class="history-tag">Topic: ${escapeHtml(record.topic || "-")}</span>
          </div>
          <p class="history-url">${escapeHtml(record.final_url)}</p>
          <dl class="history-details">
            <div><dt>Region</dt><dd>${escapeHtml(record.region || "-")}</dd></div>
            <div><dt>Source</dt><dd>${escapeHtml(record.platform || "-")}</dd></div>
            <div><dt>Medium</dt><dd>${escapeHtml(record.medium || "-")}</dd></div>
            <div><dt>Date</dt><dd>${escapeHtml(record.tracking_date || "-")}</dd></div>
            <div><dt>Topic</dt><dd>${escapeHtml(record.topic || "-")}</dd></div>
            <div><dt>Campaign</dt><dd>${escapeHtml(record.campaign || "-")}</dd></div>
            <div><dt>ActionKit source</dt><dd>${escapeHtml(record.actionkit_source || "-")}</dd></div>
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
