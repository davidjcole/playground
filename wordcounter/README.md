# Simple Word Counter

A lightweight, in-browser text analysis tool for word counts, readability, timing estimates, and keyword density.

## Features

- Word metrics: words, unique words, complex words, characters, characters without spaces, sentences, paragraphs, and lines
- Timing estimates: reading time and speaking time with adjustable WPM/SPM sliders
- Readability Score (Gunning Fog based):
  - Readability indicator (`Very easy` to `Very difficult`)
  - Grade and age estimate
  - Grade cap at `17+`
  - Age cap at `21+`
  - School level mapping for grades `6` through `17`
- Keyword density table:
  - Top 15 keywords
  - Optional stopword filtering
  - Per-keyword count and percentage
- Theme support:
  - Light/dark mode toggle
  - Defaults to system theme unless the user explicitly overrides
- Local-first behavior:
  - All analysis runs in the browser
  - Text and theme preferences are stored in `localStorage`

## Readability Formula

The app uses the Gunning Fog formula:

`0.4 × (words/sentences + 100×complex/words)`

Complex words are approximated as words with 3 or more syllables.

## Run Locally

No build step is required.

1. Open `/Users/davidjcole/Websites/playground/wordcounter/index.html` directly in your browser.
2. Or serve the directory with any static server and open the served URL.

Example:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Project Structure

- `/Users/davidjcole/Websites/playground/wordcounter/index.html` — app markup
- `/Users/davidjcole/Websites/playground/wordcounter/styles.css` — app styles and theme rules
- `/Users/davidjcole/Websites/playground/wordcounter/app.js` — metrics, readability logic, keyword density, and UI wiring
