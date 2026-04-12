const jokes = [
    { setup: "I tried to do some magic with this glass of water...", punchline: "But it's just not transparent." },
    { setup: "I attempted to catch some fog earlier...", punchline: "I mist." },
    { setup: "I'm opening a shop that only sells helium balloons...", punchline: "Business is really looking up!" },
    { setup: "I bought some shoes from a drug dealer...", punchline: "I don't know what he laced them with, but I've been tripping all day." },
    { setup: "I've got a new job at a calendar factory...", punchline: "My main duty is just to make sure the days line up." },
    { setup: "I tried to catch some invisible men...", punchline: "But I couldn't see them." },
    { setup: "I bought a wooden whistle...", punchline: "But it wooden whistle." },
    { setup: "I used to be addicted to soap...", punchline: "But I'm clean now." },
    { setup: "I tried to grow some plants...", punchline: "But I haven't botany." },
    { setup: "I'm friends with all electricians...", punchline: "We have great current-cy!" }
];

function getJoke() {
    playSound();
    const setupElement = document.getElementById("setup");
    const punchlineElement = document.getElementById("punchline");
    const selectedJoke = jokes[Math.floor(Math.random() * jokes.length)];

    setupElement.textContent = selectedJoke.setup;
    punchlineElement.textContent = "...";

    window.setTimeout(() => {
        punchlineElement.textContent = selectedJoke.punchline;
    }, 800);
}

function tipHat() {
    const fez = document.getElementById("fez");
    fez.style.animation = "none";
    void fez.offsetHeight;
    fez.style.animation = null;
}

function playSound() {
    const sound = document.getElementById("soundEffect");
    sound.currentTime = 0;
    sound.play();
}

document.getElementById("jokeButton").addEventListener("click", getJoke);

const fez = document.getElementById("fez");
fez.addEventListener("click", tipHat);
fez.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        tipHat();
    }
});
