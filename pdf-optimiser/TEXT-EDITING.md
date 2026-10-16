# Editing Existing PDF Text

Assessment: 16 October 2026. Page organisation, merging, splitting, and compression are implemented. Existing page-text editing is a separate next stage; this release does not expose an Edit Text button.

## Findings In This Workspace

The existing browser engine can extract text and its positions through PDF.js and render pages for inspection. Browser export tests confirm that copied and reordered pages retain selectable text. This provides a useful basis for detecting text under a pointer, but it does not supply a text replacement engine.

pdf-lib supports drawing new text and editing form-field values. Its [documented limitations](https://github.com/Hopding/pdf-lib#limitations) explicitly exclude editing or removing ordinary existing page text. Implementing replacements by drawing white rectangles and new text would leave the original text in the PDF, can obscure neighbouring content, and fails on non-white backgrounds. Such a tool must not be described as true text editing or redaction.

## Options

| Approach | What it offers | Main trade-off |
| --- | --- | --- |
| Add text with the existing engine | Text boxes with editable font, size, colour and position | Adds content; does not replace the original text |
| Build a content-stream editor | A possible route to constrained replacements in simple text PDFs | Requires PDF operator parsing, font encoding and subset handling, glyph positioning, clipping and transformation support; arbitrary PDFs remain difficult |
| Integrate a content-editing SDK | Existing text selection and replacement with paragraph/layout tooling | Commercial licensing and vendor integration; browser-only processing and deployment requirements need verification |

Two candidates for a bounded technical evaluation are [Apryse WebViewer](https://apryse.com/blog/javascript/how-to-edit-text-in-a-pdf-with-javascript-8-3) and [Nutrient Content Editor](https://www.nutrient.io/sdk/content-editor/). Their own documentation describes editing existing PDF text. No accounts, subscriptions, licences or integrations have been created as part of this assessment.

## Recommended Evaluation

Test one client-side content-editing SDK against a small representative set of PDFs before choosing it. Require actual removal/replacement of the original text, not a visual cover-up. Compare a simple exported report, a PDF with subset fonts and ligatures, a rotated page, a document with coloured backgrounds, and a scan with no text layer.

Acceptance checks should include reopening the saved PDF, extracting its text to verify that replaced wording is gone, rendering before/after pages, checking font substitution and line wrapping, and confirming that document bytes are not sent to a third-party service. Scans need an OCR stage before searchable text is available; OCR alone does not recreate an editable original layout.

For a lightweight addition using only the current stack, Add Text is practical. For the requested ability to edit existing wording, an SDK evaluation is the recommended next step. Exact capabilities, licensing and offline/self-hosted deployment support must be confirmed for the selected SDK and version.
