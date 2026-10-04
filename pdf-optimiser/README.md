# PDF Optimiser

A private, browser-only PDF compressor at `/pdf-optimiser/`. No PDF files are uploaded. Plain JavaScript and a disposable Web Worker run Ghostscript WebAssembly, with pdf-lib for validation and metadata removal and PDF.js for original/output page previews.

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

- One PDF at a time, up to 50 MiB and 200 pages.
- High quality (300 dpi), balanced (150 dpi), and smallest file (72 dpi) image downsampling. Text and vectors are not deliberately rasterised.
- Optional removal of the document Info dictionary and XMP references. This is not a redaction or an anonymisation tool: visible content and other embedded data can still contain personal information.
- Original and output previews with page navigation; sizes measured from actual output bytes.
- Original bytes are returned when the output would be the same size or larger, except when metadata removal was requested.
- Output must parse successfully and preserve page count and page dimensions.
- Password-protected documents, digital signatures and interactive forms are rejected.
- Ghostscript rewrites documents; comments, accessibility tags, attachments and other nonvisual content may not survive. This tool does not guarantee PDF/A compliance or preservation of specialised document features.
- Cancellation terminates the processing worker. Processing times out after two minutes. Each run uses a fresh worker to release WebAssembly memory.

## Dependencies And Licences

`@jspawn/ghostscript-wasm` 0.0.2 is AGPL-3.0. pdf-lib 1.17.1 is MIT. PDF.js 4.10.38 is Apache-2.0. Lucide is the existing locally bundled icon library. Dependency licences are copied alongside served assets. Ghostscript's upstream source is linked in its [package repository](https://github.com/jsscheller/ghostscript-wasm). Review the AGPL obligations before distributing a proprietary product; a commercial Ghostscript licence or a differently licensed engine may be appropriate.

The PDF workspace and its workers receive a scoped CSP allowance for WebAssembly compilation (`wasm-unsafe-eval`). Other playground pages keep their existing policy.
