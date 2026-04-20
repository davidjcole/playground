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

function setResult(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

document.getElementById("percentOfForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const percent = toNumber(document.getElementById("percentOfPercent").value);
    const base = toNumber(document.getElementById("percentOfBase").value);

    if (percent === null || base === null) {
        setResult("percentOfResult", "Please enter both values.");
        return;
    }

    const result = (percent / 100) * base;
    setResult("percentOfResult", `${formatNumber(percent)}% of ${formatNumber(base)} is ${formatNumber(result)}.`);
});

document.getElementById("whatPercentForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const part = toNumber(document.getElementById("whatPercentPart").value);
    const whole = toNumber(document.getElementById("whatPercentWhole").value);

    if (part === null || whole === null) {
        setResult("whatPercentResult", "Please enter both values.");
        return;
    }

    if (whole === 0) {
        setResult("whatPercentResult", "The second value cannot be zero.");
        return;
    }

    const result = (part / whole) * 100;
    setResult("whatPercentResult", `${formatNumber(part)} is ${formatNumber(result)}% of ${formatNumber(whole)}.`);
});

document.getElementById("changeForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const start = toNumber(document.getElementById("changeStart").value);
    const end = toNumber(document.getElementById("changeEnd").value);

    if (start === null || end === null) {
        setResult("changeResult", "Please enter both values.");
        return;
    }

    if (start === 0) {
        setResult("changeResult", "The starting value cannot be zero.");
        return;
    }

    const result = ((end - start) / start) * 100;
    const direction = result >= 0 ? "increase" : "decrease";
    setResult(
        "changeResult",
        `From ${formatNumber(start)} to ${formatNumber(end)} is a ${formatNumber(Math.abs(result))}% ${direction}.`
    );
});
