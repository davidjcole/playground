import { WORKBOOK_DATA } from "./data.js";

const els = {
  region: document.querySelector("#region"),
  landingPage: document.querySelector("#landing-page"),
  landingPageOptions: document.querySelector("#landing-page-options"),
  platform: document.querySelector("#platform"),
  medium: document.querySelector("#medium"),
  trackingDate: document.querySelector("#tracking-date"),
  topic: document.querySelector("#topic"),
  campaign: document.querySelector("#campaign"),
  source: document.querySelector("#source"),
  finalUrl: document.querySelector("#final-url"),
  paramSource: document.querySelector("#param-source"),
  paramMedium: document.querySelector("#param-medium"),
  paramCampaign: document.querySelector("#param-campaign"),
  paramActionkit: document.querySelector("#param-actionkit"),
  validationMessage: document.querySelector("#validation-message"),
  fillExample: document.querySelector("#fill-example"),
  copyUrl: document.querySelector("#copy-url"),
  saveUrl: document.querySelector("#save-url"),
  saveStatus: document.querySelector("#save-status")
};

const example = {
  region: "Global",
  landingPage: "https://justrecoverygathering.org/",
  platform: "facebook",
  medium: "owned-social",
  trackingDate: "2021-03-22",
  topic: "gjrg",
  campaign: "global-gjrg-global-fb-post-20210322",
  source: "global-fb-post-20210322"
};

let visibleValues = {
  regions: [...WORKBOOK_DATA.regions],
  platforms: [...WORKBOOK_DATA.platforms],
  mediums: [...WORKBOOK_DATA.mediums]
};

const autoState = {
  campaignDirty: false,
  sourceDirty: false,
  lastCampaign: "",
  lastSource: ""
};

function optionMarkup(value, label = value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugToken(value, replacement = "-") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, replacement)
    .replace(new RegExp(`${replacement}{2,}`, "g"), replacement)
    .replace(new RegExp(`^${replacement}|${replacement}$`, "g"), "");
}

function getLocalDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getTodayStamp() {
  return getLocalDateInputValue().replaceAll("-", "");
}

function getSelectedDateStamp() {
  return (els.trackingDate.value || getLocalDateInputValue()).replaceAll("-", "");
}

function getPlatformPrefix(platform) {
  const prefixes = {
    actionkit: "em",
    facebook: "fb",
    twitter: "tw",
    instagram: "ig",
    whatsapp: "wa",
    linkedin: "li",
    bluesky: "bsky",
    google: "google",
    zoom: "zoom",
    email: "em",
    partner: "partner",
    social: "social",
    web: "web",
    website: "web",
    wordpress: "wp"
  };

  return prefixes[platform] || slugToken(platform) || "src";
}

function getContentType(medium) {
  const types = {
    email: "em",
    "owned-social": "post",
    "paid-social": "ads",
    cpc: "ads",
    referral: "ref",
    manychat: "manychat",
    akafteraction: "afteraction",
    "video link": "video",
    "video-url-search": "video-search",
    web: "web"
  };

  return types[medium] || slugToken(medium) || "src";
}

function computeAutomaticSource(platform, medium, topic, region, date) {
  const prefix = getPlatformPrefix(platform);
  const contentType = getContentType(medium);

  if (!platform || !medium || !region || !date) return "";

  if (medium === "email") {
    return `${contentType}-${date}-${region}`;
  }

  if (medium === "owned-social") {
    return `${prefix}-post-${date}-${region}`;
  }

  if (medium === "paid-social" || medium === "cpc") {
    return `${prefix}-ads-${topic || date}-${region}`;
  }

  if (medium === "referral") {
    return `${prefix}-ref-${topic || date}-${region}`;
  }

  if (medium === "manychat") {
    return `${prefix}-manychat-${date}-${region}`;
  }

  if (medium === "akafteraction") {
    return `${prefix}-akafteraction-${date}-${region}`;
  }

  if (medium === "video link" || medium === "video-url-search") {
    return `${prefix}-${contentType}-${date}-${region}`;
  }

  if (medium === "web") {
    return `${prefix}-web-${date}-${region}`;
  }

  return `${prefix}-${contentType}-${date}-${region}`;
}

function computeAutomaticFields() {
  const region = slugToken(els.region.value);
  const topic = slugToken(els.topic.value);
  const platform = slugToken(els.platform.value);
  const medium = slugToken(els.medium.value);
  const date = getSelectedDateStamp();

  const campaignParts = [region, topic, platform, medium, date].filter(Boolean);

  return {
    campaign: campaignParts.join("-"),
    source: computeAutomaticSource(platform, medium, topic, region, date)
  };
}

function syncAutomaticFields() {
  const generated = computeAutomaticFields();

  const shouldUpdateCampaign =
    !autoState.campaignDirty ||
    !els.campaign.value.trim() ||
    els.campaign.value.trim() === autoState.lastCampaign;
  if (shouldUpdateCampaign) {
    els.campaign.value = generated.campaign;
    autoState.lastCampaign = generated.campaign;
    autoState.campaignDirty = false;
  }

  const shouldUpdateSource =
    !autoState.sourceDirty ||
    !els.source.value.trim() ||
    els.source.value.trim() === autoState.lastSource;
  if (shouldUpdateSource) {
    els.source.value = generated.source;
    autoState.lastSource = generated.source;
    autoState.sourceDirty = false;
  }
}

function populateSelect(select, values, placeholder) {
  select.innerHTML = [optionMarkup("", placeholder), ...values.map((value) => optionMarkup(value))].join("");
}

function populatePages() {
  els.landingPageOptions.innerHTML = WORKBOOK_DATA.pages.map((page) => optionMarkup(page)).join("");
}

function getAvailableMediums(platform) {
  const baseMediums = visibleValues.mediums;
  if (!platform) return baseMediums;
  const matched = WORKBOOK_DATA.combinations
    .filter((entry) => entry.platform === platform && baseMediums.includes(entry.medium))
    .map((entry) => entry.medium);
  return matched.length ? matched : baseMediums;
}

function refillMediumOptions() {
  const current = els.medium.value;
  const available = getAvailableMediums(els.platform.value);
  populateSelect(els.medium, available, "Select a medium");
  if (available.includes(current)) {
    els.medium.value = current;
  }
}

async function loadVisibleSettings() {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) throw new Error("Failed");
    const settings = await response.json();
    visibleValues = {
      regions: settings.configured ? [...(settings.regions || [])] : [...WORKBOOK_DATA.regions],
      platforms: settings.configured ? [...(settings.platforms || [])] : [...WORKBOOK_DATA.platforms],
      mediums: settings.configured ? [...(settings.mediums || [])] : [...WORKBOOK_DATA.mediums]
    };
  } catch {
    visibleValues = {
      regions: [...WORKBOOK_DATA.regions],
      platforms: [...WORKBOOK_DATA.platforms],
      mediums: [...WORKBOOK_DATA.mediums]
    };
  }
}

function setParams(source, medium, campaign, actionkitSource) {
  els.paramSource.textContent = source || "-";
  els.paramMedium.textContent = medium || "-";
  els.paramCampaign.textContent = campaign || "-";
  els.paramActionkit.textContent = actionkitSource || "-";
}

function updateValidation(landingPage, platform, medium, campaign) {
  const warnings = [];

  if (!landingPage) warnings.push("Add a landing page URL.");
  else {
    try {
      new URL(landingPage);
    } catch {
      warnings.push("Landing page URL is not valid.");
    }
  }

  if (platform && medium) {
    const isKnownCombo = WORKBOOK_DATA.combinations.some(
      (entry) => entry.platform === platform && entry.medium === medium
    );
    if (!isKnownCombo) warnings.push("That source and medium pair does not appear in the workbook.");
  }

  if (campaign && campaign !== campaign.toLowerCase()) {
    warnings.push("Campaign names are lowercased in the final URL to match the spreadsheet formula.");
  }

  els.validationMessage.textContent =
    warnings.length > 0 ? warnings.join(" ") : "Looks good. This matches the spreadsheet formula pattern.";
}

function getCurrentRecord() {
  const landingPage = els.landingPage.value.trim();
  const platform = slugToken(els.platform.value);
  const medium = slugToken(els.medium.value);
  const trackingDate = els.trackingDate.value || getLocalDateInputValue();
  const topic = slugToken(els.topic.value);
  const campaign = slugToken(els.campaign.value);
  const actionkitSource = slugToken(els.source.value);

  if (!landingPage || !platform || !medium || !campaign) return null;

  try {
    const url = new URL(landingPage);
    url.searchParams.set("utm_source", platform);
    url.searchParams.set("utm_medium", medium);
    url.searchParams.set("utm_campaign", campaign);
    if (actionkitSource) url.searchParams.set("source", actionkitSource);

    return {
      region: els.region.value,
      landingPage,
      platform,
      medium,
      trackingDate,
      topic,
      campaign,
      actionkitSource,
      finalUrl: url.toString()
    };
  } catch {
    return null;
  }
}

function buildUrl() {
  const record = getCurrentRecord();
  const landingPage = els.landingPage.value.trim();
  const platform = slugToken(els.platform.value);
  const medium = slugToken(els.medium.value);
  const campaign = slugToken(els.campaign.value);
  const actionkitSource = slugToken(els.source.value);

  setParams(platform, medium, campaign, actionkitSource);
  updateValidation(landingPage, els.platform.value, els.medium.value, els.campaign.value.trim());

  if (!record) {
    els.finalUrl.textContent = "Complete the required fields to build a URL.";
    els.saveUrl.disabled = true;
    return;
  }

  els.finalUrl.textContent = record.finalUrl;
  els.saveUrl.disabled = false;
}

function handleCampaignManualEdit() {
  autoState.campaignDirty = els.campaign.value.trim() !== autoState.lastCampaign;
  buildUrl();
}

function handleSourceManualEdit() {
  autoState.sourceDirty = els.source.value.trim() !== autoState.lastSource;
  buildUrl();
}

async function copyText(value, fallbackLabel) {
  if (!value || value.startsWith("Complete") || value.startsWith("Landing page URL is invalid")) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    window.alert(`Could not copy ${fallbackLabel}.`);
  }
}

async function saveCurrentUrl() {
  const record = getCurrentRecord();
  if (!record) {
    els.saveStatus.textContent = "Complete the required fields before saving.";
    return;
  }

  els.saveStatus.textContent = "Saving URL...";

  try {
    const response = await fetch("/api/urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });

    if (!response.ok) throw new Error("Save failed");
    els.saveStatus.innerHTML = 'URL saved. Open <a href="/history.html">History</a> to view previous records.';
  } catch {
    els.saveStatus.textContent = "Could not save this URL. Make sure the local server is running.";
  }
}

function loadExample() {
  if (
    !visibleValues.regions.includes(example.region) ||
    !visibleValues.platforms.includes(example.platform) ||
    !visibleValues.mediums.includes(example.medium)
  ) {
    els.saveStatus.textContent = "The current settings hide one or more example values.";
    return;
  }

  els.region.value = example.region;
  els.landingPage.value = example.landingPage;
  els.platform.value = example.platform;
  refillMediumOptions();
  els.medium.value = example.medium;
  els.trackingDate.value = example.trackingDate;
  els.topic.value = example.topic;
  autoState.campaignDirty = false;
  autoState.sourceDirty = false;
  els.campaign.value = example.campaign;
  els.source.value = example.source;
  autoState.lastCampaign = example.campaign;
  autoState.lastSource = example.source;
  buildUrl();
}

async function initialize() {
  await loadVisibleSettings();
  populateSelect(els.region, visibleValues.regions, "Select a region");
  populateSelect(els.platform, visibleValues.platforms, "Select a source");
  populateSelect(els.medium, visibleValues.mediums, "Select a medium");
  populatePages();
  els.trackingDate.value = getLocalDateInputValue();

  els.platform.addEventListener("change", () => {
    refillMediumOptions();
    syncAutomaticFields();
    buildUrl();
  });

  [els.medium, els.region, els.landingPage, els.trackingDate, els.topic].forEach((element) => {
    element.addEventListener("input", () => {
      syncAutomaticFields();
      buildUrl();
    });
    element.addEventListener("change", () => {
      syncAutomaticFields();
      buildUrl();
    });
  });

  [els.campaign, els.source].forEach((element) => {
    element.addEventListener("input", buildUrl);
    element.addEventListener("change", buildUrl);
  });

  els.campaign.addEventListener("input", handleCampaignManualEdit);
  els.campaign.addEventListener("change", handleCampaignManualEdit);
  els.source.addEventListener("input", handleSourceManualEdit);
  els.source.addEventListener("change", handleSourceManualEdit);

  els.fillExample.addEventListener("click", loadExample);
  els.copyUrl.addEventListener("click", () => copyText(els.finalUrl.textContent, "URL"));
  els.saveUrl.addEventListener("click", saveCurrentUrl);
  els.saveUrl.disabled = true;

  if (!visibleValues.regions.length || !visibleValues.platforms.length || !visibleValues.mediums.length) {
    els.saveStatus.innerHTML = 'One or more dropdown groups are empty. Update <a href="/settings.html">Settings</a> to restore choices.';
  }

  syncAutomaticFields();
  buildUrl();
}

initialize();
