// Public holidays data for 2024, 2025, and 2026
const publicHolidays = [
    { date: "2024-05-06", name: "Early May bank holiday" },
    { date: "2024-05-27", name: "Spring bank holiday" },
    { date: "2024-08-26", name: "Summer bank holiday" },
    { date: "2024-12-25", name: "Christmas Day" },
    { date: "2024-12-26", name: "Boxing Day" },
    { date: "2025-01-01", name: "New Year’s Day" },
    { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-04-21", name: "Easter Monday" },
    { date: "2025-05-05", name: "Early May bank holiday" },
    { date: "2025-05-26", name: "Spring bank holiday" },
    { date: "2025-08-25", name: "Summer bank holiday" },
    { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year’s Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-05-04", name: "Early May bank holiday" },
    { date: "2026-05-25", name: "Spring bank holiday" },
    { date: "2026-08-31", name: "Summer bank holiday" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day (substitute day)" }
];

const REGULAR_DAY_COST = 18;
const PUBLIC_HOLIDAY_DAY_COST = 36;

function calculateDays() {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    if (!startDateInput.value || !endDateInput.value) {
        alert("Please select both a start and end date.");
        return;
    }

    const start = startDate.getTime();
    const end = new Date(endDate.getTime() + (24 * 60 * 60 * 1000)); // Adjust end date to the day after
    const timeDiff = end - start;
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1; // Add 1 to include both start and end dates

    const outputDiv = document.getElementById('output');
    let holidaysCount = 0;
    let regularDaysCount = 0;
    let totalCost = 0;

    if (daysDiff < 0) {
        outputDiv.innerHTML = "End date must be after the start date.";
    } else {
        let message = `Total Days: ${daysDiff} <br> Start Date: ${formatDate(startDate)} <br> End Date: ${formatDate(endDate)} <br>`;
        
        // Check if any dates in the range are public holidays
        for (let i = start; i <= end; i += 86400000) {
            const currentDate = new Date(i);
            const currentDateStr = currentDate.toISOString().slice(0, 10);

            // Check if currentDateStr is a public holiday
            const isHoliday = publicHolidays.find(holiday => holiday.date === currentDateStr);
            if (isHoliday) {
                holidaysCount++;
                totalCost += PUBLIC_HOLIDAY_DAY_COST;
                message += `${formatDate(currentDate)} is a public holiday: ${isHoliday.name} <br>`;
            } else {
                regularDaysCount++;
                totalCost += REGULAR_DAY_COST;
            }
        }

        if (holidaysCount === 0) {
            message += "No public holidays in the selected date range.";
        } else {
            message += `Total public holidays in the selected date range: ${holidaysCount}`;
        }

        message += `<br><br><b>Breakdown of cost:</b> <br> - Regular days (${regularDaysCount} days) at £${REGULAR_DAY_COST} per day <br> - Public holidays (${holidaysCount} days) at £${PUBLIC_HOLIDAY_DAY_COST} per day <br> <b>Total Cost: £${totalCost}</b>`;

        outputDiv.innerHTML = message;

        // Create and append the "Book now" button
        const bookNowButton = document.createElement('button');
        bookNowButton.textContent = 'Book now';
        bookNowButton.onclick = function() {
            const mailtoLink = `mailto:davidjcole@gmail.com?subject=Zuzu&body=Hi Zoe,%0D%0A%0D%0ADo you have availability to look after Zuzu for us between ${formatDate(startDate)} and ${formatDate(endDate)}?%0D%0A%0D%0AMany thanks,%0D%0ADavid`;
            window.location.href = mailtoLink;
        };
        outputDiv.appendChild(document.createElement('br')); // Add a line break
        outputDiv.appendChild(bookNowButton);

        // Add paragraph break
        outputDiv.appendChild(document.createElement('p'));

        // Create and append the "Add to Calendar" button
        const addToCalendarButton = document.createElement('button');
        addToCalendarButton.textContent = 'Add to Calendar';
        addToCalendarButton.onclick = function() {
            const eventUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${formatGoogleCalendarDate(startDate)}/${formatGoogleCalendarDate(end)}&text=Zuzu%20Booking&ctz=UTC&details=Details%20about%20the%20booking%20go%20here`;
            window.open(eventUrl, '_blank');
        };
        outputDiv.appendChild(addToCalendarButton);
    }
}

function formatDate(date) {
    const day = ("0" + date.getDate()).slice(-2);
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatGoogleCalendarDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
}
