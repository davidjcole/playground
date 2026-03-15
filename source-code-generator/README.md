# 350 source code generator

`350 source code generator` is a small local web application for building tracked URLs from a spreadsheet-derived set of variables. It lets users:

- choose tracking inputs such as region, landing page, UTM source, UTM medium, topic, and date
- automatically generate `utm_campaign` and `source` values from those inputs
- save completed URLs into a local SQLite database
- review previously created URLs on a dedicated History page
- manage which regions, UTM sources, and UTM media are available in the dropdowns from a dedicated Settings page

The app is based on the workbook:

`/Users/davidjcole/Downloads/Copy of 350 Source Code Generator - TESTING(1).xlsx`

## Overview

This project replaces the spreadsheet workflow with a browser-based interface. The spreadsheet still acts as the source of truth for:

- the available regions
- the available landing pages
- the available UTM source values
- the available UTM medium values
- the original syntax guidance that informed the application design

Instead of constructing URLs row by row in Excel, users fill out a form and the app generates the final URL immediately.

## How the application works

The application has four main screens:

1. `Build URLs`
2. `History`
3. `Help`
4. `Settings`

### Build URLs page

The main page is:

`/index.html`

This page contains the core tracking form. Users can fill in:

- `Region`
- `Landing page URL`
- `UTM source`
- `UTM medium`
- `Date`
- `Topic`
- `UTM campaign`
- `Source (ActionKit)`

The page also shows:

- the final generated linking URL
- the resolved query parameters
- validation messaging
- buttons for loading an example, copying the final URL, and saving the finished record

### History page

The history page is:

`/history.html`

This page loads saved URL records from the local database and shows:

- the saved final URL
- created timestamp
- region
- UTM source
- UTM medium
- date
- topic
- campaign
- ActionKit source

Users can search the saved records and copy previously created URLs.

### Help page

The help page is:

`/help.html`

This page contains the syntax guidance that was originally embedded in the spreadsheet. It acts as a reference page for naming patterns and examples.

### Settings page

The settings page is:

`/settings.html`

This page lets users manage the dropdown values shown on the main builder page. Users can:

- add new `Region` values
- add new `UTM source` values
- add new `UTM medium` values
- edit existing values
- delete existing values
- reset all values back to the workbook defaults

These settings are stored locally and affect the dropdowns on the builder page.

## URL generation logic

The final URL is built by combining:

- the landing page URL
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `source` when present

The generated URL follows the spreadsheet-style query string behavior:

- if the landing page has no query string, parameters are added with `?`
- if the landing page already has a query string, parameters are appended with `&`

### Automatic campaign generation

The `UTM campaign` field is auto-generated from:

- region
- topic
- UTM source
- UTM medium
- selected date

Pattern:

```text
region-topic-source-medium-yyyymmdd
```

Example:

```text
global-climate-finance-facebook-owned-social-20260315
```

Users can still manually edit the field. Once edited, the app stops overwriting it automatically.

### Automatic ActionKit source generation

The `Source (ActionKit)` field is also auto-generated. Its pattern is based primarily on:

- UTM source
- UTM medium
- selected date
- region
- topic where needed

Examples:

- `email` -> `em-yyyymmdd-region`
- `owned-social` -> `fb-post-yyyymmdd-region`
- `paid-social` -> `fb-ads-topic-region`
- `referral` -> `fb-ref-topic-region`

Like campaign generation, users can manually edit the source field and keep their custom value.

## Data flow

There are three main sources of data in the app:

### 1. Workbook-derived static data

`/data.js`

This file contains the extracted spreadsheet values used by the UI:

- regions
- pages
- UTM sources
- UTM media
- source/medium combinations
- syntax guidance entries

### 2. User-managed settings

The Settings page stores the currently allowed values for:

- `regions`
- `platforms`
- `mediums`

These values are read by the builder page before it renders the dropdowns.

### 3. Saved URL records

Each completed URL that the user saves is stored in SQLite with metadata such as:

- region
- landing page
- UTM source
- UTM medium
- date
- topic
- campaign
- ActionKit source
- final URL
- created timestamp

## Local database

The application stores data in:

`/urls.db`

This is a local SQLite database managed through Node's built-in `node:sqlite` module.

The database currently stores:

- saved URL records
- saved settings values

Because the database is local, each machine keeps its own history and settings.

## Server and API

The application runs from:

`/server.js`

This Node server does two jobs:

1. serves the static HTML, CSS, and JavaScript files
2. exposes a small local API for saved URLs and settings

### API endpoints

#### `GET /api/urls`

Returns saved URL records for the History page.

#### `POST /api/urls`

Saves a newly created URL record from the builder page.

#### `GET /api/settings`

Returns the saved Settings page values.

#### `POST /api/settings`

Saves the current list of allowed dropdown values.

## File structure

Key project files:

- `index.html`
  Main URL builder page
- `app.js`
  Builder logic, auto-generation logic, save logic
- `history.html`
  Saved URL records page
- `history.js`
  History page rendering and search logic
- `help.html`
  Syntax reference page
- `help.js`
  Help page rendering
- `settings.html`
  Settings page UI
- `settings.js`
  Settings page add/edit/delete/save logic
- `styles.css`
  Shared styling across the application
- `data.js`
  Workbook-derived static configuration
- `server.js`
  Local Node server and API
- `urls.db`
  Local SQLite database

## Running locally

Open Terminal and run:

```bash
cd /Users/davidjcole/Websites/playground/source-code-generator
npm start
```

Then open:

- [http://localhost:4173/index.html](http://localhost:4173/index.html)
- [http://localhost:4173/history.html](http://localhost:4173/history.html)
- [http://localhost:4173/help.html](http://localhost:4173/help.html)
- [http://localhost:4173/settings.html](http://localhost:4173/settings.html)

## Common workflow

Typical usage looks like this:

1. Open the builder page
2. Select region, source, medium, date, and topic
3. Choose or paste the landing page URL
4. Let the app auto-fill `UTM campaign` and `Source (ActionKit)`
5. Adjust those values manually if needed
6. Copy the final URL
7. Save the URL so it appears on the History page

## Notes

- The dropdown values can be narrower than the workbook if Settings have been customized.
- Older saved records may not include newer fields such as `topic` or `date`.
- Settings changes affect the builder dropdowns after they are saved.
- The app is designed to work as a local tool and does not require an external database or hosted backend.
