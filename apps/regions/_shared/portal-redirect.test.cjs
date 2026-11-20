const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const countries = [
    "al", "au", "br", "bs", "ca", "cz", "gh", "ie", "in", "ke", "kr",
    "mw", "mx", "pt", "ro", "rw", "sk", "uk", "us", "vu", "za", "zm",
];
const portals = ["verification", "review"];
const script = new vm.Script(
    fs.readFileSync(path.join(__dirname, "portal-redirect.js"), "utf8"),
    { filename: "portal-redirect.js" },
);

for (const country of countries) {
    for (const portal of portals) {
        const page = `${country}/${portal}.html`;
        test(`${page} keeps the legacy redirect target and preserves the fragment`, () => {
            const html = fs.readFileSync(path.join(__dirname, "..", page), "utf8");
            assert.match(html, /<script src="\.\.\/_shared\/portal-redirect\.js\?v=20261120a" defer><\/script>/);
            assert.doesNotMatch(html, /<script>/);

            const fallback = html.match(/<a id="portal-redirect-link" href="([^"]+)">/);
            assert.ok(fallback, "the fallback link remains available without JavaScript");
            assert.equal(fallback[1], `../nz/${portal}.html?country=${country}`);

            // the old scripts keep the first country parameter's position,
            // remove duplicates and serialise the query without a fragment
            const cases = [
                ["", `?country=${country}`, ""],
                ["?batch=field%20work&tag=one&tag=two", `?batch=field+work&tag=one&tag=two&country=${country}`, "#place-5"],
                ["?batch=field&country=nz&tag=one&country=zz", `?batch=field&country=${country}&tag=one`, "#place-5"],
                ["?country=nz&batch=field", `?country=${country}&batch=field`, ""],
            ];
            for (const [query, legacyQuery, hash] of cases) {
                const location = new URL(`https://religionmap.org/apps/regions/${page}${query}${hash}`);
                const fallbackUrl = new URL(fallback[1], location);
                const legacyTarget = new URL(fallbackUrl);
                legacyTarget.search = legacyQuery;
                const redirects = [];
                script.runInNewContext({
                    URL,
                    URLSearchParams,
                    document: {
                        getElementById(id) {
                            assert.equal(id, "portal-redirect-link");
                            return { href: fallbackUrl.href };
                        },
                    },
                    window: {
                        location: {
                            search: location.search,
                            hash: location.hash,
                            replace: target => redirects.push(target),
                        },
                    },
                });
                assert.deepEqual(redirects, [legacyTarget.href + hash], location.href);
            }
        });
    }
}
