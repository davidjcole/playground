function updateCounters() {
    const startDate = new Date('2010-05-11T00:01:00');
    const endDate = new Date('2024-07-04T00:01:00');
    const now = new Date();

    updateCounter(now - startDate, 'sinceCounter');
    updateCounter(endDate - now, 'untilCounter');
}

function updateCounter(difference, elementId) {
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    document.querySelector(`#${elementId} .days`).textContent = days;
    document.querySelector(`#${elementId} .hours`).textContent = hours;
    document.querySelector(`#${elementId} .minutes`).textContent = minutes;
    document.querySelector(`#${elementId} .seconds`).textContent = seconds;
}

setInterval(updateCounters, 1000);
