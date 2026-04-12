const state = {
  data: null,
  selectedCategory: "ALL",
  search: "",
  selectedPromptId: null,
  showFavoritesOnly: false,
  sort: "title",
  favorites: new Set(),
  flatPrompts: []
};

const el = (id) => document.getElementById(id);
const $categories = el("categories");
const $promptList = el("promptList");
const $search = el("search");
const $countHint = el("countHint");
const $toggleFavs = el("toggleFavs");
const $clearFavs = el("clearFavs");
const $copyBtn = el("copyBtn");
const $copyMarkdownBtn = el("copyMarkdownBtn");
const $detailTitle = el("detailTitle");
const $detailMeta = el("detailMeta");
const $detailBody = el("detailBody");
const $toast = el("toast");
const $toastText = el("toastText");
const $sort = el("sort");

function toast(msg){
  $toastText.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => $toast.classList.remove("show"), 1400);
}

function loadFavorites(){
  try{
    const raw = localStorage.getItem("prompt_favorites_v1");
    if(raw){
      const arr = JSON.parse(raw);
      state.favorites = new Set(arr);
    }
  }catch(e){}
}

function saveFavorites(){
  try{
    localStorage.setItem("prompt_favorites_v1", JSON.stringify([...state.favorites]));
  }catch(e){}
}

function flattenPrompts(data){
  const out = [];
  for(const cat of data.categories || []){
    for(const p of (cat.prompts || [])){
      out.push({
        ...p,
        category: cat.category,
        icon: cat.icon || "",
        description: cat.description || ""
      });
    }
  }
  return out;
}

function normalize(s){
  return (s || "").toLowerCase();
}

function filteredPrompts(){
  const q = normalize(state.search).trim();
  let arr = state.flatPrompts;

  if(state.selectedCategory !== "ALL"){
    arr = arr.filter((p) => p.category === state.selectedCategory);
  }
  if(state.showFavoritesOnly){
    arr = arr.filter((p) => state.favorites.has(p.id));
  }
  if(q){
    arr = arr.filter((p) => {
      const hay = normalize(p.id) + " " + normalize(p.title) + " " + normalize(p.prompt) + " " + normalize(p.category);
      return hay.includes(q);
    });
  }

  const sortMode = state.sort;
  arr = [...arr].sort((a, b) => {
    if(sortMode === "id") return a.id.localeCompare(b.id);
    if(sortMode === "category"){
      const c = a.category.localeCompare(b.category);
      return c !== 0 ? c : a.title.localeCompare(b.title);
    }
    return a.title.localeCompare(b.title);
  });

  return arr;
}

function renderCategories(){
  const cats = state.data.categories || [];
  const counts = new Map();
  for(const cat of cats){
    counts.set(cat.category, (cat.prompts || []).length);
  }
  const total = state.flatPrompts.length;

  const parts = [];
  parts.push(categoryButton("ALL", "🌐", "All prompts", total));

  for(const cat of cats){
    parts.push(categoryButton(cat.category, cat.icon || "📁", cat.description || "", counts.get(cat.category) || 0));
  }
  $categories.innerHTML = parts.join("");
  for(const btn of $categories.querySelectorAll("button[data-cat]")){
    btn.addEventListener("click", () => {
      state.selectedCategory = btn.dataset.cat;
      state.selectedPromptId = null;
      renderAll();
    });
  }
  highlightActiveCategory();
}

function categoryButton(name, icon, desc, count){
  const active = (state.selectedCategory === name) ? "active" : "";
  const safeDesc = escapeHtml(desc || "");
  return `
    <button class="catBtn ${active}" data-cat="${escapeAttr(name)}" title="${safeDesc}">
      <div class="catIcon">${escapeHtml(icon)}</div>
      <div class="catMeta">
        <div class="catName">${escapeHtml(name)}</div>
        <div class="catDesc">${safeDesc || "&nbsp;"}</div>
      </div>
      <div class="catCount">${count}</div>
    </button>
  `;
}

function highlightActiveCategory(){
  for(const btn of $categories.querySelectorAll("button[data-cat]")){
    btn.classList.toggle("active", btn.dataset.cat === state.selectedCategory);
  }
}

function renderPromptList(){
  const arr = filteredPrompts();
  $countHint.textContent = `${arr.length} prompt${arr.length === 1 ? "" : "s"}`;

  if(arr.length === 0){
    $promptList.innerHTML = `<div class="empty">No prompts match your filters.</div>`;
    return;
  }

  const rows = arr.map((p, idx) => {
    const active = (p.id === state.selectedPromptId) ? "active" : "";
    const starred = state.favorites.has(p.id) ? "active" : "";
    return `
      <div class="promptRow ${active}" data-id="${escapeAttr(p.id)}" data-idx="${idx}">
        <div style="min-width:0">
          <div class="promptTitle">${escapeHtml(p.title)}</div>
          <div class="promptId">${escapeHtml(p.id)} · ${escapeHtml(p.category)}</div>
        </div>
        <div class="rowRight">
          <div class="star ${starred}" title="Toggle favorite" data-star="${escapeAttr(p.id)}">★</div>
        </div>
      </div>
    `;
  });

  $promptList.innerHTML = rows.join("");

  for(const row of $promptList.querySelectorAll(".promptRow")){
    row.addEventListener("click", (e) => {
      const star = e.target.closest("[data-star]");
      if(star){
        toggleFavorite(star.dataset.star);
        return;
      }
      selectPrompt(row.dataset.id);
    });
  }

  if(state.selectedPromptId){
    const active = $promptList.querySelector(`.promptRow[data-id="${cssEscape(state.selectedPromptId)}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }
}

function renderDetail(){
  const p = state.flatPrompts.find((x) => x.id === state.selectedPromptId);
  const has = !!p;

  $copyBtn.disabled = !has;
  $copyMarkdownBtn.disabled = !has;

  if(!has){
    $detailTitle.textContent = "Select a prompt";
    $detailMeta.innerHTML = "";
    $detailBody.innerHTML = `<div class="empty">Pick a category or search, then click a prompt.</div>`;
    return;
  }

  $detailTitle.textContent = p.title;
  const fav = state.favorites.has(p.id) ? "★" : "☆";
  $detailMeta.innerHTML = `
    <span>${escapeHtml(p.icon || "")} ${escapeHtml(p.category)}</span>
    <span style="opacity:.7">·</span>
    <span class="promptId">${escapeHtml(p.id)}</span>
    <span style="opacity:.7">·</span>
    <span title="Favorite">${fav}</span>
  `;

  $detailBody.innerHTML = `<pre>${escapeHtml(p.prompt)}</pre>`;
}

function renderAll(){
  highlightActiveCategory();
  renderPromptList();
  renderDetail();
  renderFavToggleUI();
}

function renderFavToggleUI(){
  $toggleFavs.classList.toggle("primary", state.showFavoritesOnly);
  $toggleFavs.textContent = state.showFavoritesOnly ? "★ Favorites: On" : "★ Favorites";
}

function selectPrompt(id){
  state.selectedPromptId = id;
  renderAll();
}

function toggleFavorite(id){
  if(state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavorites();
  renderAll();
}

async function copySelected(asMarkdown = false){
  const p = state.flatPrompts.find((x) => x.id === state.selectedPromptId);
  if(!p) return;

  const text = asMarkdown
    ? `### ${p.title}\n\n**ID:** ${p.id}\n**Category:** ${p.category}\n\n\`\`\`\n${p.prompt}\n\`\`\`\n`
    : p.prompt;

  try{
    await navigator.clipboard.writeText(text);
    toast(asMarkdown ? "Copied markdown" : "Copied prompt");
  }catch(e){
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast(asMarkdown ? "Copied markdown" : "Copied prompt");
  }
}

function escapeHtml(s){
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttr(s){
  return escapeHtml(s).replaceAll("`", "&#096;");
}

function cssEscape(s){
  return String(s).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function keyHandler(e){
  const isTyping = document.activeElement === $search;
  if(e.key === "/" && !isTyping){
    e.preventDefault();
    $search.focus();
    return;
  }
  if(e.key === "Escape"){
    if(document.activeElement === $search) $search.blur();
    $toast.classList.remove("show");
    return;
  }
  if(e.key.toLowerCase() === "f" && !isTyping){
    state.showFavoritesOnly = !state.showFavoritesOnly;
    state.selectedPromptId = null;
    renderAll();
    return;
  }
  if(e.key.toLowerCase() === "c" && !isTyping){
    copySelected(false);
    return;
  }
  if(e.key === "Enter" && !isTyping){
    if(!state.selectedPromptId){
      const first = filteredPrompts()[0];
      if(first) selectPrompt(first.id);
    }
    return;
  }

  if((e.key === "ArrowDown" || e.key === "ArrowUp") && !isTyping){
    e.preventDefault();
    const arr = filteredPrompts();
    if(arr.length === 0) return;

    let idx = Math.max(0, arr.findIndex((p) => p.id === state.selectedPromptId));
    if(state.selectedPromptId == null) idx = -1;

    idx = (e.key === "ArrowDown") ? Math.min(arr.length - 1, idx + 1) : Math.max(0, idx - 1);
    selectPrompt(arr[idx].id);
  }
}

async function init(){
  loadFavorites();

  let data;
  try{
    const res = await fetch("prompt-library-complete.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Failed to load JSON: " + res.status);
    data = await res.json();
  }catch(err){
    el("appSub").textContent = "Could not load JSON file";
    $detailBody.innerHTML = `<div class="empty">
      <div style="margin-bottom:10px; color:var(--danger); font-weight:650">Couldn't load <span class="promptId">prompt-library-complete.json</span>.</div>
      <div>Fixes:</div>
      <ol>
        <li>Make sure <span class="promptId">index.html</span> and <span class="promptId">prompt-library-complete.json</span> are in the same folder.</li>
        <li>Open with a local server (fetch is blocked from <span class="promptId">file://</span> URLs in most browsers).</li>
        <li>Try: <span class="promptId">python -m http.server 8000</span> then open <span class="promptId">http://localhost:8000</span></li>
      </ol>
    </div>`;
    console.error(err);
    return;
  }

  state.data = data;
  state.flatPrompts = flattenPrompts(data);

  el("appTitle").textContent = data.title || "Prompt Library";
  el("appSub").textContent = `${state.flatPrompts.length} prompts · v${data.version || "?"}`;

  renderCategories();
  renderAll();
}

$search.addEventListener("input", () => {
  state.search = $search.value;
  state.selectedPromptId = null;
  renderAll();
});

$toggleFavs.addEventListener("click", () => {
  state.showFavoritesOnly = !state.showFavoritesOnly;
  state.selectedPromptId = null;
  renderAll();
});

$clearFavs.addEventListener("click", () => {
  state.favorites.clear();
  saveFavorites();
  state.showFavoritesOnly = false;
  state.selectedPromptId = null;
  renderAll();
  toast("Favorites cleared");
});

$copyBtn.addEventListener("click", () => copySelected(false));
$copyMarkdownBtn.addEventListener("click", () => copySelected(true));

$sort.addEventListener("change", () => {
  state.sort = $sort.value;
  state.selectedPromptId = null;
  renderAll();
});

document.addEventListener("keydown", keyHandler);

init();
