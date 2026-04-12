# Playground

A small collection of browser-based experiments, utilities, and prototypes.

Live site:
[https://playground.thinkingsystems.co.uk/](https://playground.thinkingsystems.co.uk/)

Legacy GitHub Pages URL:
[https://davidjcole.github.io/playground/](https://davidjcole.github.io/playground/)

## What's in the repo

This repository contains a set of lightweight HTML, CSS, and JavaScript mini-projects, including:

- `index.html` and `styles.css`: landing page for the playground
- `readability/`: a Gunning Fog Index readability calculator
- `wordcounter/`: a richer word counter with readability and keyword density metrics
- `weather/`: a weather lookup tool with clothing suggestions
- `zuzu-booker/`: a booking cost calculator with holiday-aware pricing
- `jokes/`, `drawtheline/`, `recycle/`, `prompt-examples/`: other small experiments and utilities

## Hosting

The site is hosted on Railway at:
[https://playground.thinkingsystems.co.uk/](https://playground.thinkingsystems.co.uk/)

Railway now serves the static site and also runs a small Node server for the weather proxy. That proxy keeps the WeatherAPI key out of the browser by reading it from an environment variable on the server.

Relevant files:

- `server.js`: serves the site and proxies `/api/weather`
- `package.json`: start script for Railway
- `railway.json`: Railway deploy configuration

## Environment variables

The weather lookup requires this Railway environment variable:

- `WEATHER_API_KEY`: WeatherAPI key used by the server-side `/api/weather` proxy

## Local development

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

The app will run on `http://localhost:3000` by default, or on the port provided by Railway via `PORT`.

## Notes

- Most of the site is plain static HTML/CSS/JavaScript.
- The weather page should call the local `/api/weather` endpoint rather than talking directly to WeatherAPI from client-side code.
- This repo is intended as a sandbox for trying out ideas, so different folders may vary in polish and structure.
