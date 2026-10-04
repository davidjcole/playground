# Weather Lookup

Small static web page for checking the current weather for a user-entered location.

## What It Does

- Lets a user enter a city or place name.
- Fetches current weather data from WeatherAPI.
- A settings dialog switches temperature between Celsius and Fahrenheit and wind speed between kph and mph. Preferences are saved on the device and update existing results without another weather request. Clothing recommendations always use the underlying Celsius temperature.
- Changes the background photo to match the current condition, including clear nights, with linked photographer and Unsplash credits.
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
3. The script calls the server's `/api/weather` proxy, which requests current conditions from WeatherAPI.
4. The returned data is rendered into the page.
5. A clothing recommendation is generated from the current temperature and condition text.
6. WeatherAPI condition codes select a sunny, clear-night, cloudy, rainy, snowy, foggy, or thunderstorm photo. Condition text is used when a code is missing or unknown. The photo and credit change together after the image loads; failed image loads retain the previous photo and credit. Older weather responses and image loads cannot overwrite a newer lookup.

## Background Photos

Photos are bundled locally; no Unsplash API key or runtime image service is required. All are free photos under the [Unsplash License](https://unsplash.com/license).

| Conditions | Photographer | Photo |
| --- | --- | --- |
| Sunny | [Chun Kit Soo](https://unsplash.com/@soochunkit) | [Sunny beach](https://unsplash.com/photos/F0524yzycqM) |
| Clear night | [Hayden Scott](https://unsplash.com/@hayden) | [Starry sky](https://unsplash.com/photos/cnyE0EnkrTg) |
| Partly cloudy, cloudy, overcast, unknown | [Billy Huynh](https://unsplash.com/@billy_huy) | [Cloudy sky](https://unsplash.com/photos/v9bnfMCyKbg) |
| Rain, drizzle, freezing rain; initial background | [Osman Rana](https://unsplash.com/@osmanrana) | [Rainy street](https://unsplash.com/photos/GXEZuWo5m4I) |
| Snow, sleet, ice pellets, blizzard | [Cloris Ying](https://unsplash.com/@clorisyy) | [Snow-covered trees](https://unsplash.com/photos/J1LYc-oMA4k) |
| Fog, mist, haze, smoke, dust | [Dave Hoefler](https://unsplash.com/@iamthedave) | [Evergreen forest shrouded in fog](https://unsplash.com/photos/evergreen-forest-shrouded-in-fog-od287vQyufw) |
| Thunderstorms, including rain or snow with thunder | [Yifu Wu](https://unsplash.com/@nnonno) | [Lightning storm](https://unsplash.com/photos/9mjivTB4YMs) |

The original rain image remains in this folder. The six new JPEGs are in `images/`, resized to 1920 x 1280. Photographer and individual photo links are also displayed in the page footer and open in new tabs. Loaded photos crossfade over 900 ms; reduced-motion preferences switch photos immediately.

## Running Locally

From the repository root:

```bash
npm ci
npm start
```

Then open [http://localhost:3000/weather/](http://localhost:3000/weather/). Run `npm run test:weather` for condition mapping, image-credit synchronization, failed image loads, and overlapping lookups.

## API Key Note

The page requests `/api/weather` on the Node server. Set `WEATHER_API_KEY` in the server environment for live lookups; the key is not exposed to the browser.

## Limitations

- Only current weather is shown.
- The clothing recommendation is very basic.
- Error handling is minimal.

## Possible Improvements

- Add support for pressing Enter to submit.
- Show loading and error states more clearly.
- Add forecast support.
- Improve clothing recommendations using more weather factors.
