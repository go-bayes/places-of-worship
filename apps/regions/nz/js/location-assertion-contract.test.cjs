const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(`${__dirname}/location-assertion-contract.js`, "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const contract = context.window.PowLocationAssertion;

const building = {
    mode: "building_identified",
    basis: "map_placement",
    latitude: -41.2865,
    longitude: 174.7762,
    confidence: "high",
    contributorConfirmed: true,
};

assert.equal(contract.validate(building), "");
assert.deepEqual(JSON.parse(JSON.stringify(contract.payload(building))), {
    contract_version: "location_assertion_v1",
    mode: "building_identified",
    basis: "map_placement",
    latitude: -41.2865,
    longitude: 174.7762,
    confidence: "high",
    contributor_confirmed: true,
});

const approximate = {
    ...building,
    mode: "approximate_area",
    basis: "named_source_description",
    uncertaintyRadiusM: 2000,
    sourceWording: "Somewhere within roughly two kilometres of the settlement centre.",
    confidence: "low",
};
assert.equal(contract.validate(approximate), "");
assert.equal(contract.payload(approximate).uncertainty_radius_m, 2000);
assert.match(contract.validate({ ...approximate, sourceWording: "" }), /Record what the source/);
assert.match(contract.validate({ ...approximate, uncertaintyRadiusM: 0 }), /uncertainty radius/);
assert.match(contract.validate({ ...approximate, contributorConfirmed: false }), /Confirm that the location description/);
assert.match(contract.validate({ ...building, uncertaintyRadiusM: 100 }), /cannot include an uncertainty radius/);

console.log("location assertion contract tests passed");

// the derived grade matches the server thresholds
assert.equal(contract.grade(building), "building");
assert.equal(contract.grade({ mode: "approximate_area", uncertaintyRadiusM: 100 }), "parcel_or_compound");
assert.equal(contract.grade({ mode: "approximate_area", uncertaintyRadiusM: 300 }), "street");
assert.equal(contract.grade({ mode: "approximate_area", uncertaintyRadiusM: 2000 }), "locality");
assert.equal(contract.grade({ mode: "approximate_area", uncertaintyRadiusM: 2001 }), "area");
assert.equal(contract.gradeLabel({ mode: "approximate_area", uncertaintyRadiusM: 1000 }), "locality-level");

