function toNumber(value) {
    const normalized = String(value)
        .replace(/,/g, "")
        .replace(/\s+/g, "")
        .trim();

    if (normalized === "") {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 2
    }).format(value);
}

function formatRawNumber(value) {
    if (Number.isInteger(value)) {
        return String(value);
    }

    return value.toString();
}

function createTickIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("copy-icon");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M6.4 11.2 3.3 8.1l-1.1 1.1 4.2 4.2L13.8 6l-1.1-1.1z");
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);

    return svg;
}

async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
    }

    const originalLabel = button.getAttribute("aria-label");
    const copyIcon = button.querySelector(".copy-icon");
    if (copyIcon) {
        copyIcon.replaceWith(createTickIcon());
    }
    button.classList.add("copied");
    button.setAttribute("aria-label", "Copied");
    window.setTimeout(() => {
        const tickIcon = button.querySelector(".copy-icon");
        if (tickIcon) {
            const resetIcon = document.createElement("img");
            resetIcon.src = "copied-icon.png";
            resetIcon.alt = "";
            resetIcon.className = "copy-icon";
            tickIcon.replaceWith(resetIcon);
        }
        button.classList.remove("copied");
        button.setAttribute("aria-label", originalLabel);
    }, 1200);
}

function setMessageResult(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

function setCalculatedResult(elementId, message, rawValue) {
    const resultElement = document.getElementById(elementId);
    resultElement.replaceChildren();

    const line = document.createElement("span");
    line.className = "result-line";

    const text = document.createElement("span");
    text.textContent = message;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.setAttribute("aria-label", `Copy ${rawValue}`);
    copyButton.title = "Copy result";

    const copyIcon = document.createElement("img");
    copyIcon.src = "copied-icon.png";
    copyIcon.alt = "";
    copyIcon.className = "copy-icon";
    copyButton.appendChild(copyIcon);

    copyButton.addEventListener("click", () => copyToClipboard(rawValue, copyButton));

    line.appendChild(text);
    line.appendChild(copyButton);
    resultElement.appendChild(line);
}

document.getElementById("percentOfForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const percent = toNumber(document.getElementById("percentOfPercent").value);
    const base = toNumber(document.getElementById("percentOfBase").value);

    if (percent === null || base === null) {
        setMessageResult("percentOfResult", "Please enter both values.");
        return;
    }

    const result = (percent / 100) * base;
    setCalculatedResult(
        "percentOfResult",
        `${formatNumber(percent)}% of ${formatNumber(base)} is ${formatNumber(result)}.`,
        formatRawNumber(result)
    );
});

document.getElementById("whatPercentForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const part = toNumber(document.getElementById("whatPercentPart").value);
    const whole = toNumber(document.getElementById("whatPercentWhole").value);

    if (part === null || whole === null) {
        setMessageResult("whatPercentResult", "Please enter both values.");
        return;
    }

    if (whole === 0) {
        setMessageResult("whatPercentResult", "The second value cannot be zero.");
        return;
    }

    const result = (part / whole) * 100;
    setCalculatedResult(
        "whatPercentResult",
        `${formatNumber(part)} is ${formatNumber(result)}% of ${formatNumber(whole)}.`,
        formatRawNumber(result)
    );
});

document.getElementById("changeForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const start = toNumber(document.getElementById("changeStart").value);
    const end = toNumber(document.getElementById("changeEnd").value);

    if (start === null || end === null) {
        setMessageResult("changeResult", "Please enter both values.");
        return;
    }

    if (start === 0) {
        setMessageResult("changeResult", "The starting value cannot be zero.");
        return;
    }

    const result = ((end - start) / start) * 100;
    const direction = result >= 0 ? "increase" : "decrease";
    setCalculatedResult(
        "changeResult",
        `From ${formatNumber(start)} to ${formatNumber(end)} is a ${formatNumber(Math.abs(result))}% ${direction}.`
        ,
        formatRawNumber(result)
    );
});
