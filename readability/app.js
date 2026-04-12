function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) {
        return 1;
    }
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");
    return (word.match(/[aeiouy]{1,2}/g) || []).length;
}

function calculateGunningFog(text) {
    const sentences = text.match(/[^\.!\?]+[\.!\?]+["'\)\]]*|.+$/g) || [];
    const words = text.match(/\w+/g) || [];
    if (words.length === 0 || sentences.length === 0) {
        return null;
    }

    let complexWords = 0;
    words.forEach((word) => {
        if (countSyllables(word) >= 3) {
            complexWords += 1;
        }
    });

    const averageSentenceLength = words.length / sentences.length;
    const percentageOfComplexWords = (complexWords / words.length) * 100;
    const gunningFog = 0.4 * (averageSentenceLength + percentageOfComplexWords);
    return gunningFog.toFixed(2);
}

function displayGunningFog() {
    const text = document.getElementById("textInput").value;
    const rawIndex = calculateGunningFog(text);

    if (rawIndex === null) {
        document.getElementById("result").textContent = "Gunning Fog Index: N/A";
        document.getElementById("description").textContent = "Enter some text to calculate readability.";
        document.getElementById("educationLevel").textContent = "Education Level: N/A";
        return;
    }

    const index = parseFloat(rawIndex);
    let description = "";
    let educationLevel = "";

    const grades = [
        "Sixth grade (age 11-12)", "Seventh grade (age 12-13)", "Eighth grade (age 13-14)",
        "High school freshman (age 14-15)", "High school sophomore (age 15-16)",
        "High school junior (age 16-17)", "High school senior (age 17-18)",
        "College freshman (age 18-19)", "College sophomore (age 19-20)",
        "College junior (age 20-21)", "College senior (age 21-22)", "College graduate (age 22+)"
    ];

    if (index < 6) {
        description = "Text is very easy to read.";
        educationLevel = "Below sixth grade (age < 11)";
    } else if (index >= 17) {
        description = "Text is very difficult to read and best understood by university graduates.";
        educationLevel = grades[11];
    } else {
        description = "Text requires a certain level of education to understand.";
        educationLevel = grades[Math.floor(index) - 6];
    }

    document.getElementById("result").textContent = `Gunning Fog Index: ${index}`;
    document.getElementById("description").textContent = description;
    document.getElementById("educationLevel").textContent = `Education Level: ${educationLevel}`;
}

document.getElementById("calculateButton").addEventListener("click", displayGunningFog);
