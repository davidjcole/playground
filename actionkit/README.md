# ActionKit Draft Email Creator

Simple app to create ActionKit draft emails using:

- `POST /rest/v1/mailer/`

The browser sends draft payloads to a local backend proxy (`POST /api/drafts`).
ActionKit credentials are handled on the backend and are never stored in browser storage.

## Files

- `index.html` - draft form UI
- `settings.html` - draft default settings UI
- `styles.css` - basic styling
- `app.js` - front-end settings + API request logic
- `server.js` - static file server + ActionKit proxy endpoint
- `.env.example` - required server environment variable names

## Run

1. Optional: set initial server env vars (you can also set these in settings UI):

```bash
cd /Users/davidjcole/Websites/playground/actionkit
export AK_API_BASE_URL="https://your-org.actionkit.com"
export AK_API_USERNAME="your_api_username"
export AK_API_PASSWORD="your_api_password"
export PORT="8000"
```

2. Start the app server:

```bash
node server.js
```

3. Open `http://localhost:8000`.

## Usage

1. Open `http://localhost:8000/settings.html` and save:
   - Fromline Resource Path
   - Email Wrapper Resource Path (optional)
   - Submitter Resource Path (optional)
   - ActionKit API Base URL
   - ActionKit API Username
   - ActionKit API Password (leave blank later if unchanged)
2. Open `http://localhost:8000/index.html` and submit draft content.
   - Use the built-in WYSIWYG editor toolbar for the HTML body field.

## Required inputs

- Settings page:
  - `fromline`
  - ActionKit API Base URL
  - ActionKit API Username
  - ActionKit API Password
- Draft page:
  - `subjects`
  - `html`

## Notes

- Optional fields in draft UI: `preview_text`, `text`.
- Optional settings fields: `emailwrapper`, `submitter`.
- Settings are stored in browser `localStorage` under `actionkit.settings`.
- Draft form content is auto-saved in browser `localStorage` under `actionkit.draft` and restored when you return.
- Server API credentials are stored server-side in `.server-config.json` after saving in settings.
- The browser never stores ActionKit API username/password in this version.
