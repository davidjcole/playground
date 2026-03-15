# 350 source code generator

Small browser app generated from the workbook at `/Users/davidjcole/Downloads/Copy of 350 Source Code Generator - TESTING(1).xlsx`.

## Run it

```bash
npm start
```

Then open [http://localhost:4173](http://localhost:4173).

## What it includes

- Workbook-backed regions, landing pages, UTM sources, and UTM media values
- Live final URL generation using the spreadsheet formula logic
- Syntax guidance from the `ActionKit Source Syntax` sheet
- A helper that can suggest common source-code formats for matched platform and medium pairs
- SQLite-backed URL saving using Node's built-in `node:sqlite`
- A second `/history` page so users can review previously created URLs
