# Weather Lookup

Small static web page for checking the current weather for a user-entered location.

## What It Does

- Lets a user enter a city or place name.
- Fetches current weather data from WeatherAPI.
- Displays:
  - location
  - temperature in Celsius
  - weather condition
  - wind speed and direction
  - humidity
  - a simple clothing recommendation

## Files

- `index.html` contains the page structure.
- `styles.css` contains the page styling.
- `scripts.js` handles the API request, result rendering, and clothing suggestion logic.

## How It Works

1. The user types a location into the input field.
2. Clicking **Get Weather** runs `fetchWeather()`.
3. The script calls the WeatherAPI `current.json` endpoint.
4. The returned data is rendered into the page.
5. A clothing recommendation is generated from the current temperature and condition text.

## Running Locally

Because this is a static page, you can open `index.html` directly in a browser.

If you prefer to serve it locally, run a simple HTTP server from this folder. For example:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## API Key Note

The current implementation includes a WeatherAPI key directly in client-side JavaScript. That means anyone visiting the page can see and reuse the key.

For a production version, move the API call behind a small backend or serverless function and keep the key in server-side environment variables.

## Limitations

- Only current weather is shown.
- The clothing recommendation is very basic.
- Error handling is minimal.
- The condition checks for rain and snow are case-sensitive, so some condition strings may not trigger the extra advice.

## Possible Improvements

- Add support for pressing Enter to submit.
- Show loading and error states more clearly.
- Add forecast support.
- Improve clothing recommendations using more weather factors.
- Move the API key out of the frontend.
