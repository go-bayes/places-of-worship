// stage 1 of the deep-time dates (docs/development/deep-time-date-format-brief-2026-11-24.md):
// the portal's check of an observation date, moved out of verification-map.js
// so the shared date test (convex/lib/partialDates.node-test.mjs) can reach
// it. a client copy of isValidObservationDate in convex/lib/partialDates.ts:
// YYYY, YYYY-MM or YYYY-MM-DD, a real Gregorian date, a year from 1000 to 2100.
// the caller trims the value; the server remains the authority.
(function () {
    const FORM = /^([0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?$/;

    function daysInMonth(year, month) {
        if (month === 2) {
            const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
            return leap ? 29 : 28;
        }
        return [4, 6, 9, 11].includes(month) ? 30 : 31;
    }

    function isObservationDate(value) {
        const match = FORM.exec(String(value));
        if (!match) return false;
        const year = Number(match[1]);
        if (year < 1000 || year > 2100) return false;
        if (match[2] === undefined) return true;
        const month = Number(match[2]);
        if (month < 1 || month > 12) return false;
        if (match[3] === undefined) return true;
        const day = Number(match[3]);
        return day >= 1 && day <= daysInMonth(year, month);
    }

    window.PowPartialDate = Object.freeze({ isObservationDate });
})();
