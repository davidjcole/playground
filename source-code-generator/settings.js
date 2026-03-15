import { WORKBOOK_DATA } from "./data.js";

const els = {
  status: document.querySelector("#settings-status"),
  save: document.querySelector("#save-settings"),
  resetDefaults: document.querySelector("#reset-defaults"),
  regions: document.querySelector("#regions-options"),
  platforms: document.querySelector("#platforms-options"),
  mediums: document.querySelector("#mediums-options"),
  regionInput: document.querySelector("#regions-input"),
  platformInput: document.querySelector("#platforms-input"),
  mediumInput: document.querySelector("#mediums-input"),
  addForms: document.querySelectorAll(".settings-add-form")
};

const workbookDefaults = {
  regions: WORKBOOK_DATA.regions,
  platforms: WORKBOOK_DATA.platforms,
  mediums: WORKBOOK_DATA.mediums
};

let currentValues = {
  regions: [...workbookDefaults.regions],
  platforms: [...workbookDefaults.platforms],
  mediums: [...workbookDefaults.mediums]
};

let editingState = {
  category: null,
  originalValue: null
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function iconButtonMarkup(kind, category, value) {
  if (kind === "edit") {
    return `<button class="icon-button settings-edit" type="button" data-category="${category}" data-value="${escapeHtml(value)}" aria-label="Edit ${escapeHtml(value)}" title="Edit">✎</button>`;
  }

  return `<button class="icon-button settings-delete" type="button" data-category="${category}" data-value="${escapeHtml(value)}" aria-label="Delete ${escapeHtml(value)}" title="Delete">×</button>`;
}

function normalizeValue(category, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return category === "regions" ? trimmed : trimmed.toLowerCase();
}

function renderCategory(container, category) {
  const values = currentValues[category];
  container.innerHTML = values.length
    ? values
    .map(
      (value) => `
        <div class="settings-item">
          ${
            editingState.category === category && editingState.originalValue === value
              ? `
                <form class="settings-edit-form" data-category="${category}" data-original-value="${escapeHtml(value)}">
                  <input class="settings-edit-input" type="text" value="${escapeHtml(value)}" />
                  <button class="ghost-button" type="submit">Save</button>
                  <button class="ghost-button settings-cancel-edit" type="button">Cancel</button>
                </form>
              `
              : `
                <span class="settings-item-label">${escapeHtml(value)}</span>
                <div class="settings-item-actions">
                  ${iconButtonMarkup("edit", category, value)}
                  ${iconButtonMarkup("delete", category, value)}
                </div>
              `
          }
        </div>
      `
    )
    .join("")
    : '<div class="empty-state">No values in this list yet.</div>';

  container.querySelectorAll(".settings-edit").forEach((button) => {
    button.addEventListener("click", () => {
      editingState = {
        category: button.dataset.category,
        originalValue: button.dataset.value || ""
      };
      renderAll();
      container.querySelector(".settings-edit-input")?.focus();
    });
  });

  container.querySelectorAll(".settings-delete").forEach((button) => {
    button.addEventListener("click", () => {
      removeValue(button.dataset.category, button.dataset.value || "");
    });
  });

  container.querySelectorAll(".settings-edit-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector(".settings-edit-input");
      updateValue(form.dataset.category, form.dataset.originalValue || "", input?.value || "");
    });
  });

  container.querySelectorAll(".settings-cancel-edit").forEach((button) => {
    button.addEventListener("click", () => {
      editingState = { category: null, originalValue: null };
      renderAll();
    });
  });
}

function renderAll() {
  renderCategory(els.regions, "regions");
  renderCategory(els.platforms, "platforms");
  renderCategory(els.mediums, "mediums");
}

function addValue(category, rawValue) {
  const value = normalizeValue(category, rawValue);
  if (!value) return;
  if (currentValues[category].includes(value)) {
    els.status.textContent = `"${value}" is already in ${category}.`;
    return;
  }
  currentValues[category].push(value);
  currentValues[category].sort((left, right) => left.localeCompare(right));
  renderAll();
  els.status.textContent = `Added "${value}". Save settings to apply it to the builder.`;
}

function updateValue(category, originalValue, nextRawValue) {
  const nextValue = normalizeValue(category, nextRawValue);
  if (!nextValue) {
    els.status.textContent = "Edited values cannot be empty.";
    return;
  }

  if (originalValue !== nextValue && currentValues[category].includes(nextValue)) {
    els.status.textContent = `"${nextValue}" is already in ${category}.`;
    return;
  }

  currentValues[category] = currentValues[category].map((value) =>
    value === originalValue ? nextValue : value
  );
  currentValues[category].sort((left, right) => left.localeCompare(right));
  editingState = { category: null, originalValue: null };
  renderAll();
  els.status.textContent = `Updated "${originalValue}" to "${nextValue}". Save settings to apply it.`;
}

function removeValue(category, rawValue) {
  currentValues[category] = currentValues[category].filter((value) => value !== rawValue);
  if (editingState.category === category && editingState.originalValue === rawValue) {
    editingState = { category: null, originalValue: null };
  }
  renderAll();
  els.status.textContent = `Removed "${rawValue}". Save settings to apply the change.`;
}

function resetToDefaults() {
  currentValues = {
    regions: [...workbookDefaults.regions],
    platforms: [...workbookDefaults.platforms],
    mediums: [...workbookDefaults.mediums]
  };
  editingState = { category: null, originalValue: null };
  renderAll();
  els.status.textContent = "Restored the workbook defaults. Save settings to apply them.";
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) throw new Error("Failed");
    const settings = await response.json();

    currentValues = {
      regions: settings.configured ? [...(settings.regions || [])] : [...workbookDefaults.regions],
      platforms: settings.configured ? [...(settings.platforms || [])] : [...workbookDefaults.platforms],
      mediums: settings.configured ? [...(settings.mediums || [])] : [...workbookDefaults.mediums]
    };
    editingState = { category: null, originalValue: null };
    renderAll();
    els.status.textContent = "Add, remove, or reorder your dropdown variables, then save.";
  } catch {
    currentValues = {
      regions: [...workbookDefaults.regions],
      platforms: [...workbookDefaults.platforms],
      mediums: [...workbookDefaults.mediums]
    };
    editingState = { category: null, originalValue: null };
    renderAll();
    els.status.textContent = "Could not load saved settings. Showing all values.";
  }
}

async function saveSettings() {
  const payload = {
    regions: currentValues.regions,
    platforms: currentValues.platforms,
    mediums: currentValues.mediums
  };

  els.status.textContent = "Saving settings...";

  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Failed");
    els.status.textContent = "Settings saved. The builder page will now use these dropdown choices.";
  } catch {
    els.status.textContent = "Could not save settings. Make sure the local server is running.";
  }
}

els.save.addEventListener("click", saveSettings);
els.resetDefaults.addEventListener("click", resetToDefaults);
els.addForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = form.dataset.category;
    const input =
      category === "regions"
        ? els.regionInput
        : category === "platforms"
          ? els.platformInput
          : els.mediumInput;
    addValue(category, input.value);
    input.value = "";
    input.focus();
  });
});

loadSettings();
