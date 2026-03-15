const SETTINGS_KEY = "actionkit.settings";
const DRAFT_KEY = "actionkit.draft";

const draftForm = document.getElementById("draft-form");
const settingsForm = document.getElementById("settings-form");
const serverConfigForm = document.getElementById("server-config-form");
const output = document.getElementById("output");
const submitBtn = document.getElementById("submitBtn");
const configStatus = document.getElementById("config-status");
const editor = document.getElementById("emailEditor");
const htmlInput = document.getElementById("html");
const editorToolbar = document.getElementById("editor-toolbar");

function getSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      fromline: typeof parsed.fromline === "string" ? parsed.fromline : "",
      emailwrapper: typeof parsed.emailwrapper === "string" ? parsed.emailwrapper : "",
      submitter: typeof parsed.submitter === "string" ? parsed.submitter : "",
    };
  } catch {
    return null;
  }
}

function saveSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function migrateLegacySettings() {
  const settings = getSettings();
  if (!settings) return;
  saveSettings(settings);
}

function getSavedDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft() {
  if (!draftForm) return;
  syncEditorHtml();
  const data = Object.fromEntries(new FormData(draftForm).entries());
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function restoreDraft() {
  if (!draftForm) return;
  const savedDraft = getSavedDraft();
  if (!savedDraft) return;

  const fields = ["subjects", "previewText", "text", "html"];

  for (const fieldName of fields) {
    const field = draftForm.elements.namedItem(fieldName);
    if (!field) continue;
    if (typeof savedDraft[fieldName] !== "string") continue;
    field.value = savedDraft[fieldName];
  }

  if (editor && htmlInput) {
    editor.innerHTML = htmlInput.value || "<p></p>";
  }
}

function linesToArray(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildPayload(data, settings) {
  const payload = {
    fromline: settings.fromline.trim(),
    subjects: linesToArray(data.subjects),
    html: data.html.trim(),
  };

  const previewText = linesToArray(data.previewText);
  if (previewText.length > 0) payload.preview_text = previewText;

  if (data.text.trim()) payload.text = data.text;
  if (settings.emailwrapper?.trim()) payload.emailwrapper = settings.emailwrapper.trim();
  if (settings.submitter?.trim()) payload.submitter = settings.submitter.trim();

  return payload;
}

function syncEditorHtml() {
  if (!editor || !htmlInput) return;
  htmlInput.value = editor.innerHTML;
}

function initEditor() {
  if (!editor || !htmlInput || !editorToolbar) return;

  editor.innerHTML = htmlInput.value || "<p></p>";
  editor.addEventListener("input", syncEditorHtml);

  editorToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-command]");
    if (!button) return;

    const command = button.dataset.command;
    if (!command) return;

    if (command === "createLink") {
      const url = window.prompt("Enter URL (include https://):");
      if (!url) return;
      document.execCommand(command, false, url);
    } else {
      document.execCommand(command, false, null);
    }

    syncEditorHtml();
    saveDraft();
    editor.focus();
  });
}

function formatProxyResponse(result, fallbackStatus, fallbackStatusText) {
  if (!result || typeof result !== "object") {
    return `HTTP ${fallbackStatus} ${fallbackStatusText}\n\nResponse:\n(empty)`;
  }

  const status = result.status ?? fallbackStatus;
  const statusText = result.statusText ?? fallbackStatusText;

  let parsedBody = result.body;
  if (typeof result.body === "string" && result.body) {
    try {
      parsedBody = JSON.stringify(JSON.parse(result.body), null, 2);
    } catch {
      parsedBody = result.body;
    }
  }

  return [
    `HTTP ${status} ${statusText}`,
    result.location ? `Location: ${result.location}` : "Location: (none)",
    "",
    "Response:",
    parsedBody || "(empty body)",
  ].join("\n");
}

async function createDraft(event) {
  event.preventDefault();
  syncEditorHtml();

  const data = Object.fromEntries(new FormData(draftForm).entries());
  const settings = getSettings();

  if (!settings?.fromline) {
    output.textContent = "Settings are missing. Open settings.html and save a fromline.";
    return;
  }

  const payload = buildPayload(data, settings);

  if (!Array.isArray(payload.subjects) || payload.subjects.length === 0) {
    output.textContent = "At least one subject is required.";
    return;
  }

  if (!payload.html) {
    output.textContent = "HTML body is required.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";
  output.textContent = `POST /api/drafts\n\nPayload:\n${JSON.stringify(payload, null, 2)}`;

  try {
    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok && result?.error) {
      output.textContent = `HTTP ${response.status} ${response.statusText}\n\nError:\n${result.error}`;
      return;
    }

    output.textContent = formatProxyResponse(result, response.status, response.statusText);
  } catch (error) {
    output.textContent = `Request failed: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Draft";
  }
}

function initDraftPage() {
  if (!draftForm) return;

  initEditor();
  restoreDraft();

  const settings = getSettings();
  if (configStatus) {
    configStatus.textContent = settings?.fromline
      ? ` | Fromline set: ${settings.fromline}`
      : " | No settings saved";
  }

  draftForm.addEventListener("input", saveDraft);
  draftForm.addEventListener("change", saveDraft);
  window.addEventListener("beforeunload", saveDraft);
  window.addEventListener("pagehide", saveDraft);

  draftForm.addEventListener("submit", createDraft);
}

function initSettingsPage() {
  if (!settingsForm && !serverConfigForm) return;

  const existing = getSettings();
  if (existing && settingsForm) {
    settingsForm.fromline.value = existing.fromline || "";
    settingsForm.emailwrapper.value = existing.emailwrapper || "";
    settingsForm.submitter.value = existing.submitter || "";
    if (output) output.textContent = "Loaded saved draft defaults.";
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(settingsForm).entries());
      saveSettings({
        fromline: data.fromline.trim(),
        emailwrapper: data.emailwrapper.trim(),
        submitter: data.submitter.trim(),
      });

      if (output) output.textContent = "Draft defaults saved.";
    });
  }

  if (serverConfigForm) {
    fetch("/api/server-config")
      .then((response) => response.json())
      .then((config) => {
        if (typeof config.baseUrl === "string") serverConfigForm.baseUrl.value = config.baseUrl;
        if (typeof config.username === "string") serverConfigForm.username.value = config.username;
        if (output && config.baseUrl && config.username) {
          output.textContent = "Loaded server API connection.";
        }
      })
      .catch(() => {
        if (output) output.textContent = "Could not load server API connection.";
      });

    serverConfigForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(serverConfigForm).entries());

      try {
        const response = await fetch("/api/server-config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            baseUrl: data.baseUrl.trim(),
            username: data.username.trim(),
            password: data.password,
          }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          const errorMessage = result?.error || "Failed to save API connection.";
          if (output) output.textContent = errorMessage;
          return;
        }

        serverConfigForm.password.value = "";
        if (output) output.textContent = "Server API connection saved.";
      } catch (error) {
        if (output) output.textContent = `Failed to save API connection: ${error.message}`;
      }
    });
  }
}

initDraftPage();
initSettingsPage();
migrateLegacySettings();
