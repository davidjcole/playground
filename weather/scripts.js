const weatherPhotos = {
    sunny: { image: 'images/sunny.jpg', photographer: 'Chun Kit Soo', username: 'soochunkit', photoId: 'F0524yzycqM' },
    night: { image: 'images/clear-night.jpg', photographer: 'Hayden Scott', username: 'hayden', photoId: 'cnyE0EnkrTg' },
    cloudy: { image: 'images/cloudy.jpg', photographer: 'Billy Huynh', username: 'billy_huy', photoId: 'v9bnfMCyKbg' },
    rain: { image: 'osman-rana-GXEZuWo5m4I-unsplash.jpg', photographer: 'Osman Rana', username: 'osmanrana', photoId: 'GXEZuWo5m4I' },
    snow: { image: 'images/snow.jpg', photographer: 'Cloris Ying', username: 'clorisyy', photoId: 'J1LYc-oMA4k' },
    fog: { image: 'images/fog.jpg', photographer: 'James Kelly-Smith', username: 'jksphotographer', photoId: 'D2KCi3AzRQ8' },
    thunderstorm: { image: 'images/thunderstorm.jpg', photographer: 'Yifu Wu', username: 'nnonno', photoId: '9mjivTB4YMs' }
};

const weatherConditionGroups = {
    thunderstorm: [1087, 1273, 1276, 1279, 1282],
    snow: [1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264],
    rain: [1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246],
    fog: [1012, 1015, 1018, 1021, 1024, 1027, 1030, 1033, 1036, 1039, 1042, 1045, 1048, 1135, 1147],
    cloudy: [1003, 1006, 1009]
};
let weatherRequestVersion = 0;
let weatherBackgroundVersion = 0;

function getWeatherPhotoKey(condition = {}, isDay = 1) {
    const code = Number(condition.code);
    if (code === 1000) return Number(isDay) === 0 ? 'night' : 'sunny';
    for (const [group, codes] of Object.entries(weatherConditionGroups)) {
        if (codes.includes(code)) return group;
    }

    const text = String(condition.text || '').toLowerCase();
    if (/thunder|lightning/.test(text)) return 'thunderstorm';
    if (/snow|sleet|blizzard|ice pellets|hail/.test(text)) return 'snow';
    if (/rain|drizzle|shower/.test(text)) return 'rain';
    if (/fog|mist|haze|smoke|smog|dust|sandstorm/.test(text)) return 'fog';
    if (/cloud|overcast/.test(text)) return 'cloudy';
    if (/sunny|clear/.test(text)) return Number(isDay) === 0 ? 'night' : 'sunny';
    return 'cloudy';
}

function updateWeatherBackground(condition, isDay) {
    const key = getWeatherPhotoKey(condition, isDay);
    const photo = weatherPhotos[key];
    const version = ++weatherBackgroundVersion;
    const image = new Image();

    // Update the image and attribution together, only after the photo has loaded.
    image.onload = () => {
        if (version !== weatherBackgroundVersion) return;
        if (document.body.dataset.weatherBackground !== key) {
            const background = document.getElementById('weatherBackground');
            const layer = document.createElement('div');
            layer.className = 'weather-background-layer';
            layer.style.setProperty('--weather-background', `url("${photo.image}")`);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                background.replaceChildren(layer);
            } else {
                background.appendChild(layer);
                const fade = layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
                fade.onfinish = () => {
                    // Remove only older layers; a newer photo may already be fading in.
                    for (const previous of Array.from(background.children)) {
                        if (previous === layer) break;
                        previous.remove();
                    }
                };
            }
        }
        document.body.dataset.weatherBackground = key;
        const photographer = document.getElementById('photoPhotographer');
        photographer.textContent = photo.photographer;
        photographer.href = `https://unsplash.com/@${photo.username}?utm_source=playground&utm_medium=referral`;
        document.getElementById('photoSource').href = `https://unsplash.com/photos/${photo.photoId}?utm_source=playground&utm_medium=referral`;
    };
    image.onerror = () => { /* Keep the displayed photo and its matching credit if loading fails. */ };
    image.src = photo.image;
}

async function fetchWeatherForLocation(location, detectedLabel = null) {
    const weatherElement = document.getElementById('weather');
    const requestVersion = ++weatherRequestVersion;
    ++weatherBackgroundVersion;
    try {
        const response = await fetch(`/api/weather?q=${encodeURIComponent(location)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (requestVersion !== weatherRequestVersion) return;

        const clothesRecommendation = getClothesRecommendation(data.current.temp_c, data.current.condition.text);
        const displayLocation = detectedLabel || `${data.location.name}, ${data.location.region}, ${data.location.country}`;

        renderWeatherData(weatherElement, [
            ['Location', displayLocation],
            ['Temperature', `${data.current.temp_c}°C`],
            ['Condition', data.current.condition.text],
            ['Wind', `${data.current.wind_kph} kph, ${data.current.wind_dir}`],
            ['Humidity', `${data.current.humidity}%`],
            ['Clothing Recommendation', clothesRecommendation]
        ]);
        updateWeatherBackground(data.current.condition, data.current.is_day);
    } catch (error) {
        if (requestVersion !== weatherRequestVersion) return;
        console.error('Failed to fetch weather data:', error);
        renderWeatherMessage('Error fetching weather data. Please check console for details.');
    }
}

async function fetchWeather() {
    const location = document.getElementById('locationInput').value.trim();

    if (!location) {
        renderWeatherMessage('Please enter a location.');
        return;
    }

    await fetchWeatherForLocation(location);
}

async function detectLocationAndFetchWeather() {
    const detectButton = document.getElementById('detectLocationButton');
    const originalText = detectButton.textContent;
    detectButton.disabled = true;
    detectButton.textContent = 'Detecting...';

    try {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser.');
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        document.getElementById('locationInput').value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        renderWeatherMessage('Location detected. Click "Get Weather" to load the forecast.');
    } catch (error) {
        console.error('Failed to detect location:', error);
        renderWeatherMessage('Unable to detect your location automatically. Please allow location access or enter a place manually.');
    } finally {
        detectButton.disabled = false;
        detectButton.textContent = originalText;
    }
}

function getClothesRecommendation(temperature, condition) {
    const normalizedCondition = condition.toLowerCase();
    let recommendation = '';
    if (temperature > 25) {
        recommendation = 'Wear light clothing such as a T-shirt and shorts.';
    } else if (temperature > 15) {
        recommendation = 'Wear long pants and a long-sleeve shirt.';
    } else if (temperature > 5) {
        recommendation = 'Consider a sweater or a light jacket.';
    } else {
        recommendation = 'Wear a warm coat, hat, and gloves.';
    }

    if (normalizedCondition.includes('rain')) {
        recommendation += ' Bring an umbrella or wear a waterproof jacket.';
    }
    if (normalizedCondition.includes('snow')) {
        recommendation += ' Make sure to wear boots and heavy winter clothing.';
    }

    return recommendation;
}

function renderWeatherMessage(message) {
    const weatherElement = document.getElementById('weather');
    weatherElement.replaceChildren();

    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    weatherElement.appendChild(paragraph);
}

function renderWeatherData(container, rows) {
    container.replaceChildren();

    for (const [label, value] of rows) {
        const paragraph = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        paragraph.appendChild(strong);
        paragraph.appendChild(document.createTextNode(value));
        container.appendChild(paragraph);
    }
}

// Event listener for the button
document.getElementById('getWeatherButton').addEventListener('click', fetchWeather);
document.getElementById('detectLocationButton').addEventListener('click', detectLocationAndFetchWeather);
