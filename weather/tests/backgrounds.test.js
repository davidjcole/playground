const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
    const elements = new Map();
    const images = [];
    const properties = new Map();
    const context = vm.createContext({
        console,
        window: { matchMedia: () => ({ matches: true }) },
        document: {
            body: { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value) } },
            createElement() { return { style: { setProperty: (key, value) => properties.set(key, value) } }; },
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, { addEventListener() {}, replaceChildren() {} });
                return elements.get(id);
            }
        },
        Image: class { constructor() { images.push(this); } }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts.js'), 'utf8'), context);
    return { context, elements, images, properties };
}

test('matches condition codes, clear nights and text-only responses', () => {
    const { context } = setup();
    const cases = [
        [{ code: 1000, text: 'Sunny' }, 1, 'sunny'],
        [{ code: 1000, text: 'Clear' }, 0, 'night'],
        [{ code: 1003 }, 1, 'cloudy'],
        [{ code: 1009 }, 0, 'cloudy'],
        [{ code: 1183 }, 1, 'rain'],
        [{ code: 1072 }, 1, 'rain'],
        [{ code: 1204 }, 1, 'snow'],
        [{ code: 1237 }, 1, 'snow'],
        [{ code: 1117 }, 1, 'snow'],
        [{ code: 1147 }, 1, 'fog'],
        [{ code: 1033 }, 1, 'fog'],
        [{ code: 1279 }, 1, 'thunderstorm'],
        [{ code: 1087 }, 1, 'thunderstorm'],
        [{ text: 'Moderate Rain With Thunder' }, 1, 'thunderstorm'],
        [{ text: 'Light sleet showers' }, 1, 'snow'],
        [{ text: 'Freezing fog' }, 1, 'fog'],
        [{ text: 'Light drizzle' }, 1, 'rain'],
        [{ text: 'Clear' }, 0, 'night'],
        [{ code: 9999, text: 'Unknown' }, 1, 'cloudy'],
        [{ code: 1183, text: 'Sunny' }, 1, 'rain']
    ];
    for (const [condition, isDay, expected] of cases) {
        assert.equal(context.getWeatherPhotoKey(condition, isDay), expected, JSON.stringify(condition));
    }
});

test('photo and photographer credit change together after image load', () => {
    const { context, elements, images, properties } = setup();
    context.updateWeatherBackground({ code: 1000 }, 1);
    assert.equal(properties.size, 0);
    images[0].onload();
    assert.equal(properties.get('--weather-background'), 'url("images/sunny.jpg")');
    assert.equal(context.document.body.dataset.weatherBackground, 'sunny');
    assert.equal(elements.get('photoPhotographer').textContent, 'Chun Kit Soo');
    assert.match(elements.get('photoPhotographer').href, /unsplash\.com\/@soochunkit/);
    assert.match(elements.get('photoSource').href, /unsplash\.com\/photos\/F0524yzycqM/);
});

test('stale or failed image loads cannot change the current photo or credit', () => {
    const { context, elements, images, properties } = setup();
    context.updateWeatherBackground({ code: 1000 }, 1);
    context.updateWeatherBackground({ code: 1225 }, 1);
    images[1].onload();
    images[0].onload();
    assert.equal(properties.get('--weather-background'), 'url("images/snow.jpg")');
    assert.equal(elements.get('photoPhotographer').textContent, 'Cloris Ying');
    context.updateWeatherBackground({ code: 1135 }, 1);
    images[2].onerror();
    assert.equal(properties.get('--weather-background'), 'url("images/snow.jpg")');
    assert.equal(elements.get('photoPhotographer').textContent, 'Cloris Ying');
});

test('the newest weather request owns both results and background', async () => {
    const { context, elements, images, properties } = setup();
    const requests = [];
    context.fetch = () => new Promise((resolve) => requests.push(resolve));
    vm.runInContext('renderWeatherData = (element, rows) => { element.rows = rows; };', context);
    const response = (name, code) => ({ ok: true, json: async () => ({
        location: { name, region: 'Region', country: 'Country' },
        current: { temp_c: 10, condition: { code, text: 'Weather' }, is_day: 1, wind_kph: 5, wind_dir: 'N', humidity: 50 }
    }) });
    const first = context.fetchWeatherForLocation('London');
    const second = context.fetchWeatherForLocation('Paris');
    requests[1](response('Paris', 1183));
    await second;
    requests[0](response('London', 1000));
    await first;
    assert.equal(images.length, 1);
    images[0].onload();
    assert.equal(properties.get('--weather-background'), 'url("osman-rana-GXEZuWo5m4I-unsplash.jpg")');
    assert.equal(elements.get('weather').rows[0][1], 'Paris, Region, Country');

    context.updateWeatherBackground({ code: 1000 }, 1);
    const third = context.fetchWeatherForLocation('Berlin');
    images[1].onload();
    assert.equal(context.document.body.dataset.weatherBackground, 'rain');
    requests[2](response('Berlin', 1225));
    await third;
    images[2].onload();
    assert.equal(context.document.body.dataset.weatherBackground, 'snow');
});
