"use strict";

const el = (id) => document.getElementById(id);
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
let cropper;
let sourceFile;
let sourceUrl;
let previewUrl;
let outputBlob;
let timer;
let revision = 0;
let loadRevision = 0;
let ready = false;
let originalRatio = 1;
let resizeTimer;
let cropBeforeResize;

lucide.createIcons();

// Cropper restores screen coordinates on resize; preserve image coordinates instead.
window.addEventListener("resize", () => {
    if (!ready) return;
    if (!cropBeforeResize) cropBeforeResize = cropper.getData();
    invalidate();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (ready && cropBeforeResize) {
            const container = cropper.getContainerData();
            const canvas = cropper.getCanvasData();
            const scale = Math.min(container.width / canvas.naturalWidth, container.height / canvas.naturalHeight);
            const width = canvas.naturalWidth * scale;
            const height = canvas.naturalHeight * scale;
            cropper.clear();
            cropper.setCanvasData({ width, height, left: (container.width - width) / 2, top: (container.height - height) / 2 });
            cropper.crop();
            cropper.setData(cropBeforeResize);
        }
        cropBeforeResize = null;
        syncCrop();
    }, 300);
});

function message(text, error = false) {
    el("message").textContent = text;
    el("message").classList.toggle("error", error);
    el("message").hidden = !text;
}

function fileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function invalidate() {
    revision += 1;
    clearTimeout(timer);
    outputBlob = null;
    el("download").disabled = true;
    el("export-size").textContent = "-";
    el("output-dimensions").textContent = "";
    el("saving").textContent = "";
    el("preview").hidden = true;
    el("preview-placeholder").hidden = false;
    el("preview-placeholder").textContent = "Preparing preview...";
    el("export-result").setAttribute("aria-busy", "true");
}

function scheduleExport() {
    invalidate();
    if (ready) timer = setTimeout(generateExport, 250);
}

function syncCrop() {
    if (!ready || cropBeforeResize) return;
    const data = cropper.getData(true);
    el("crop-size").textContent = `${data.width} x ${data.height} px`;
    for (const key of ["x", "y", "width", "height"]) el(`crop-${key}`).value = data[key];
    scheduleExport();
}

async function loadFile(file) {
    if (!file) return;
    if (!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(file.type)) {
        message("Choose a JPEG, PNG, WebP, GIF, BMP or AVIF image. HEIC and TIFF files need to be converted first.", true);
        return;
    }
    if (file.size > 40 * 1024 * 1024) {
        message("This file is too large. Choose an image under 40 MB.", true);
        return;
    }
    const currentLoad = ++loadRevision;
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.src = url;
    message("Opening image...");
    try {
        await probe.decode();
        if (currentLoad !== loadRevision) { URL.revokeObjectURL(url); return; }
        if (probe.naturalWidth * probe.naturalHeight > 40_000_000 || Math.max(probe.naturalWidth, probe.naturalHeight) > 16384) {
            throw new Error("This image is too large to edit safely. Choose an image under 40 megapixels and 16,384 pixels per side.");
        }
        ready = false;
        clearTimeout(resizeTimer);
        cropBeforeResize = null;
        invalidate();
        el("crop-tools").disabled = true;
        el("export-settings").disabled = true;
        if (cropper) cropper.destroy();
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        sourceUrl = url;
        sourceFile = file;
        originalRatio = probe.naturalWidth / probe.naturalHeight;
        el("upload").hidden = true;
        el("editor").hidden = false;
        el("source").src = url;
        el("file-name").textContent = file.name;
        el("file-info").textContent = `${probe.naturalWidth} x ${probe.naturalHeight} px / ${fileSize(file.size)}`;
        el("original-size").textContent = fileSize(file.size);
        el("export-name").value = `${file.name.replace(/\.[^.]+$/, "")}-optimised`;
        el("ratio").value = "free";
        message(/\.gif$/i.test(file.name) || file.type === "image/gif" ? "Animated images are exported as a single still frame." : "");
        cropper = new Cropper(el("source"), {
            viewMode: 1,
            autoCropArea: 1,
            restore: false,
            background: true,
            checkOrientation: false,
            checkCrossOrigin: false,
            toggleDragModeOnDblclick: false,
            ready() {
                ready = true;
                el("crop-tools").disabled = false;
                el("export-settings").disabled = false;
                syncCrop();
            },
            crop: syncCrop
        });
    } catch (error) {
        URL.revokeObjectURL(url);
        if (currentLoad === loadRevision) message(error.message.startsWith("This image") ? error.message : "This image could not be opened. It may be damaged, or its format may not be supported by your browser.", true);
    }
}

function settingsValid() {
    return ["max-width", "max-height"].every((id) => el(id).checkValidity());
}

async function generateExport() {
    const currentRevision = revision;
    if (!ready || !settingsValid()) {
        el("preview-placeholder").textContent = "Enter dimensions from 1 to 4096 px.";
        el("export-result").setAttribute("aria-busy", "false");
        return;
    }
    try {
        const data = cropper.getData();
        if (data.width < 1 || data.height < 1) throw new Error("Select a crop area first.");
        const scale = Math.min(1, Number(el("max-width").value) / data.width, Number(el("max-height").value) / data.height);
        const width = Math.max(1, Math.round(data.width * scale));
        const height = Math.max(1, Math.round(data.height * scale));
        const format = el("format").value;
        const canvas = cropper.getCroppedCanvas({
            width, height, maxWidth: 4096, maxHeight: 4096,
            fillColor: format === "image/jpeg" ? el("background").value : "transparent",
            imageSmoothingEnabled: true, imageSmoothingQuality: "high"
        });
        if (!canvas || !canvas.width || !canvas.height) throw new Error("Unable to create this crop. Try a smaller image.");
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, format, Number(el("quality").value) / 100));
        if (currentRevision !== revision) return;
        if (!blob) throw new Error("Unable to export this image. Try smaller output dimensions.");
        if (blob.type !== format) throw new Error("Your browser cannot export this format. Choose JPEG or PNG.");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(blob);
        outputBlob = blob;
        el("preview").src = previewUrl;
        el("preview").hidden = false;
        el("preview-placeholder").hidden = true;
        el("output-dimensions").textContent = `${canvas.width} x ${canvas.height}`;
        el("export-size").textContent = fileSize(blob.size);
        const difference = (1 - blob.size / sourceFile.size) * 100;
        el("saving").classList.toggle("larger", difference < 0);
        el("saving").textContent = difference >= 0 ? `${difference.toFixed(1)}% smaller than the original` : `${Math.abs(difference).toFixed(1)}% larger than the original`;
        el("download").disabled = false;
        el("export-result").setAttribute("aria-busy", "false");
    } catch (error) {
        if (currentRevision !== revision) return;
        el("preview-placeholder").textContent = error.message;
        el("export-result").setAttribute("aria-busy", "false");
        message(error.message, true);
    }
}

for (const id of ["choose", "replace"]) el(id).addEventListener("click", () => el("file-input").click());
el("file-input").addEventListener("change", (event) => {
    loadFile(event.target.files[0]);
    event.target.value = "";
});
// Prevent a dropped file from navigating the browser away from the editor.
document.addEventListener("dragover", (event) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    el("upload").classList.add("dragging");
});
document.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) el("upload").classList.remove("dragging");
});
document.addEventListener("drop", (event) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    el("upload").classList.remove("dragging");
    if (event.dataTransfer.files.length > 1) { message("Choose one image at a time.", true); return; }
    loadFile(event.dataTransfer.files[0]);
});

el("ratio").addEventListener("change", () => {
    const value = el("ratio").value;
    cropper.setAspectRatio(value === "free" ? NaN : value === "original" ? originalRatio : Number(value));
});
el("rotate-left").addEventListener("click", () => cropper.rotate(-90));
el("rotate-right").addEventListener("click", () => cropper.rotate(90));
el("flip").addEventListener("click", () => cropper.scaleX(-cropper.getData().scaleX));
el("zoom-in").addEventListener("click", () => cropper.zoom(0.1));
el("zoom-out").addEventListener("click", () => cropper.zoom(-0.1));
el("reset").addEventListener("click", () => {
    el("ratio").value = "free";
    cropper.setAspectRatio(NaN);
    cropper.reset();
});
for (const key of ["x", "y", "width", "height"]) {
    el(`crop-${key}`).addEventListener("change", () => {
        const input = el(`crop-${key}`);
        if (!input.value || !input.checkValidity()) { syncCrop(); return; }
        cropper.setData({ [key]: Number(input.value) });
        syncCrop();
    });
}

el("format").addEventListener("change", () => {
    const format = el("format").value;
    el("extension").textContent = `.${extensions[format]}`;
    el("quality-control").hidden = format === "image/png";
    el("png-note").hidden = format !== "image/png";
    el("background-control").hidden = format !== "image/jpeg";
    scheduleExport();
});
el("quality").addEventListener("input", () => {
    el("quality-value").value = `${el("quality").value}%`;
    scheduleExport();
});
for (const id of ["max-width", "max-height", "background"]) el(id).addEventListener("input", scheduleExport);

el("download").addEventListener("click", () => {
    if (!outputBlob) return;
    const name = el("export-name").value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/, "") || "image-optimised";
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.${extensions[outputBlob.type]}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
});
