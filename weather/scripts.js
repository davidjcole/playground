// script.js
// Function to fetch weather data based on the user's input
async function fetchWeather() {
    const apiKey = 'dfe297f009fd4e35b8294540241105'; // Replace 'YOUR_API_KEY' with your actual API key from WeatherAPI.com
    const location = document.getElementById('locationInput').value;
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=no`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Display weather information
        const weatherElement = document.getElementById('weather');
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
    // Basic recommendations based on temperature
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

    // Additional recommendations based on weather condition
    if (condition.includes('rain')) {
        recommendation += ' Bring an umbrella or wear a waterproof jacket.';
    }
    if (condition.includes('snow')) {
        recommendation += ' Make sure to wear boots and heavy winter clothing.';
    }

    return recommendation;
}

// Event listener for the button
document.querySelector('button').addEventListener('click', fetchWeather);
