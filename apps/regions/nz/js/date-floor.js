// F1 per-country date floor (jb 2026-08-31; docs/portal-location-and-occupancy-plan.md):
// the earliest year a dated claim or period may name. a typo guard, not a
// historical statement. Client mirror of convex/lib/countryYears.ts
// DATE_FLOOR_YEARS; both files move together (countryYears.node-test.mjs ties
// them). the contracts read window.POW_DATE_FLOOR_YEAR, which the portal sets
// from this table for its country, so an unset value falls back to the default.
(function () {
    const DEFAULT_DATE_FLOOR_YEAR = 1600;
    const DATE_FLOOR_YEARS = Object.freeze({
        NZ: 1600,
        VU: 1600,
        AU: 1600,
        BR: 1500,
        CA: 1500,
        IE: 1000,
        IN: 1000,
        KR: 1000,
        MX: 1500,
        PT: 1000,
        RO: 1000,
        SK: 1000,
        UK: 1000,
        US: 1500,
    });

    function yearFor(countryCode) {
        const floor = countryCode ? DATE_FLOOR_YEARS[String(countryCode).toUpperCase()] : undefined;
        return Number.isInteger(floor) ? floor : DEFAULT_DATE_FLOOR_YEAR;
    }

    // the floor in force on this page: set by the portal for its country
    function current() {
        const value = Number(window.POW_DATE_FLOOR_YEAR);
        return Number.isInteger(value) && value > 0 ? value : DEFAULT_DATE_FLOOR_YEAR;
    }

    window.PowDateFloor = Object.freeze({ DEFAULT_DATE_FLOOR_YEAR, DATE_FLOOR_YEARS, current, yearFor });
})();
