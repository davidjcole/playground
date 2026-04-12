async function fetchWeather() {
    const location = document.getElementById('locationInput').value.trim();
    const weatherElement = document.getElementById('weather');

    if (!location) {
        weatherElement.innerHTML = `<p>Please enter a location.</p>`;
        return;
    }

    try {
        const response = await fetch(`/api/weather?q=${encodeURIComponent(location)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const clothesRecommendation = getClothesRecommendation(data.current.temp_c, data.current.condition.text);
        
        weatherElement.innerHTML = `
            <p><strong>Location:</strong> ${data.location.name}, ${data.location.region}, ${data.location.country}</p>
            <p><strong>Temperature:</strong> ${data.current.temp_c}°C</p>
            <p><strong>Condition:</strong> ${data.current.condition.text}</p>
            <p><strong>Wind:</strong> ${data.current.wind_kph} kph, ${data.current.wind_dir}</p>
            <p><strong>Humidity:</strong> ${data.current.humidity}%</p>
            <p><strong>Clothing Recommendation:</strong> ${clothesRecommendation}</p>
        `;
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        document.getElementById('weather').innerHTML = `<p>Error fetching weather data. Please check console for details.</p>`;
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

// Event listener for the button
document.querySelector('button').addEventListener('click', fetchWeather);
