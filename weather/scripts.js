async function fetchWeatherForLocation(location, detectedLabel = null) {
    const weatherElement = document.getElementById('weather');
    try {
        const response = await fetch(`/api/weather?q=${encodeURIComponent(location)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

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
    } catch (error) {
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
        const response = await fetch('/api/geoip');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const locationQuery = `${data.lat},${data.lon}`;
        const detectedLabel = `${data.city}, ${data.regionName}, ${data.country}`;
        document.getElementById('locationInput').value = detectedLabel;
        await fetchWeatherForLocation(locationQuery, detectedLabel);
    } catch (error) {
        console.error('Failed to detect location:', error);
        renderWeatherMessage('Unable to detect your location automatically right now.');
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
