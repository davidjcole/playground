# PDF Optimiser

A private, browser-only PDF workspace at `/pdf-optimiser/`. No PDF files are uploaded. Plain JavaScript and disposable Web Workers run Ghostscript WebAssembly for compression, pdf-lib for page operations and validation, PDF.js for previews, and fflate for ZIP exports.

## Run

From the repository root:

```sh
npm ci
npm start
```

Open `http://localhost:3000/pdf-optimiser/`. `PORT` can select another port. Installation and startup copy pinned dependency assets and licences to `vendor/`; these generated assets are not committed. Railway's existing Node deployment installs and serves them automatically. No native Ghostscript installation or external API is required.

```sh
npm run test:pdf
```

## Behaviour

- Compression accepts one PDF up to 50 MiB and 200 pages.
- High quality (300 dpi), balanced (150 dpi), and smallest file (72 dpi) image downsampling. Text and vectors are not deliberately rasterised.
- Optional removal of the document Info dictionary and XMP references. This is not a redaction or an anonymisation tool: visible content and other embedded data can still contain personal information.
- Original and output previews with page navigation; sizes measured from actual output bytes.
- Original bytes are returned when the output would be the same size or larger, except when metadata removal was requested.
- Output must parse successfully and preserve page count and page dimensions.
- Password-protected documents, digital signatures and interactive forms are rejected.
- Ghostscript rewrites documents; comments, accessibility tags, attachments and other nonvisual content may not survive. This tool does not guarantee PDF/A compliance or preservation of specialised document features.
- Cancellation terminates the processing worker. Processing times out after two minutes. Each run uses a fresh worker to release WebAssembly memory.

## Organise, Merge And Split

- Open the organiser with one or several PDFs, or switch from a loaded compression document. Add PDFs to append their pages. The workspace limits all loaded source files to 50 MiB combined and assembled documents to 200 pages.
- Page thumbnails show current output positions and original source filenames/page numbers. Select pages with checkboxes or thumbnails; preview individual pages at a larger size.
- Reorder by dragging pages before another page, or use the earlier/later buttons on desktop, keyboard, or touch devices. Dragging a selected page moves the selected group in document order.
- Rotate, duplicate, or delete selected pages. At least one page must remain. Undo/redo retains up to 50 changes, including appended documents. Replacing all PDFs starts a fresh workspace.
- Download the assembled PDF, extract the selected pages, or send the assembled document to the compression tool. Switching tools retains organiser changes.
- Page ranges refer to the current thumbnail order. `1-3, 5` extracts four pages into one PDF or splits them into two PDFs (`1-3` and `5`) in one ZIP. Typed range ordering is preserved; repeated ranges intentionally repeat pages. Exports contain at most 200 pages, even when ranges overlap.
- Page exports copy PDF page content without compression or rasterisation. Source files are unchanged. Document-level bookmarks, attachments, accessibility tags, and specialised navigation structures are not guaranteed to survive copying. Existing form and signature restrictions apply to all tools.
- Individual PDF exports and the combined PDFs in a ZIP are limited to 50 MiB. Export cancellation terminates the worker; no partial download is generated.

See [TEXT-EDITING.md](TEXT-EDITING.md) for the assessment of editing existing page text.

## Dependencies And Licences

`@jspawn/ghostscript-wasm` 0.0.2 is AGPL-3.0. pdf-lib 1.17.1 and fflate 0.8.3 are MIT. PDF.js 4.10.38 is Apache-2.0. Lucide is the existing locally bundled icon library. Dependency licences are copied alongside served assets. Ghostscript's upstream source is linked in its [package repository](https://github.com/jsscheller/ghostscript-wasm). Review the AGPL obligations before distributing a proprietary product; a commercial Ghostscript licence or a differently licensed engine may be appropriate.

The PDF workspace and its workers receive a scoped CSP allowance for WebAssembly compilation (`wasm-unsafe-eval`). Other playground pages keep their existing policy.
