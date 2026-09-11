// builds or checks the golden fixtures for the pow-canonical-json.v1
// contract (rfc 8785 canonical bytes and sha-256 object hashes). the cases
// authored here are the source; the typescript implementation computes the
// expected values, and both the typescript and rust test suites then verify
// their implementation against the written file.
//
//   node scripts/canonical_json_fixtures.mjs --write
//   node scripts/canonical_json_fixtures.mjs --check
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      for (const extension of [".js", ".ts"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { canonicalJsonStrict, objectHash, CANONICAL_JSON_CONTRACT, CANONICAL_JSON_SCHEME, HASH_CONTRACT } = await import("../convex/lib/canonicalJson.ts");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "schemas/fixtures/pow-canonical-json.v1.json");

// each case is authored as json text so that both languages parse the same
// bytes; the parsed value is what the contract canonicalises
const cases = [
  ["empty_object", "{}"],
  ["empty_array", "[]"],
  ["null", "null"],
  ["booleans", "[true,false]"],
  ["empty_string", '""'],
  ["integer", "42"],
  ["negative_integer", "-7"],
  ["zero", "0"],
  ["negative_zero_prints_as_zero", "-0"],
  ["float_with_trailing_zero", "1.0"],
  ["decimal_fraction", "0.1"],
  ["exponent_uppercase_input", "1E+2"],
  ["large_exponent_boundary_21", "1e21"],
  ["just_below_exponent_boundary", "100000000000000000000"],
  ["small_exponent_boundary", "0.000001"],
  ["just_below_small_boundary", "1e-7"],
  ["negative_small_exponent", "-1.5e-10"],
  ["min_subnormal", "5e-324"],
  ["max_double", "1.7976931348623157e308"],
  ["integer_beyond_safe_range_rounds_to_double", "9007199254740993"],
  ["max_safe_integer", "9007199254740991"],
  ["coordinates_wellington", '{"latitude":-41.28664,"longitude":174.77557}'],
  ["coordinates_point_geojson", '{"type":"Point","coordinates":[172.6362,-43.5321]}'],
  ["coordinates_with_radius", '{"uncertainty_radius_m":75,"latitude":-43.532054,"longitude":172.636225}'],
  ["timestamp_strings", '{"recorded_at":"2026-09-11T04:30:00.000Z","source_date":"1864-05"}'],
  ["unicode_macron", '{"name":"Ōtautahi","tradition":"Māori"}'],
  ["unicode_astral_emoji", '"🕌 mosque"'],
  ["unicode_combining", '"Ma\\u0304ori"'],
  ["string_escapes", '"quote \\" backslash \\\\ slash / tab \\t newline \\n cr \\r bs \\b ff \\f"'],
  ["control_characters_lowercase_hex", '"\\u0000\\u001f\\u007f"'],
  ["line_separators_not_escaped", '"\\u2028\\u2029"'],
  ["key_order_utf16_not_utf8", '{"b":1,"a":2,"aa":3,"A":4,"":5,"\\u00e9":6,"\\ud83d\\ude00":7,"\\uff5e":8,"z":9,"_":10,"10":11,"2":12}'],
  ["key_order_nested", '{"z":{"b":1,"a":[{"y":1,"x":2}]},"a":{"d":null,"c":true}}'],
  ["nulls_and_optional_absent", '{"note":null,"uncertainty":null,"source":"directory"}'],
  ["ordered_array_retains_order", '{"segments":[{"segment_index":1},{"segment_index":0}]}'],
  ["set_like_array_presorted_by_builder", '{"parent_object_hashes":["sha256:0a","sha256:0b"]}'],
  ["mixed_array", '[1,"two",null,true,{"k":[]},[]]'],
  ["deep_nesting", '{"a":{"b":{"c":{"d":{"e":{"f":[[[[1]]]]}}}}}}'],
  ["rfc8785_example_numbers", '{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001]}'],
  ["rfc8785_example_literals", '{"literals":[null,true,false]}'],
  // a member named __proto__ is ordinary json; an implementation that copies
  // members by assignment into a fresh object would drop it (finding of the
  // 2026-09-11 review) and hash two different documents identically
  ["member_named_proto_is_kept", '{"__proto__":1,"note":"same"}'],
  ["evidence_like_record", '{"observation_contract_version":"guided_observation_v1","source_type":"denominational_directory","source_title":"Directory 2016","source_date_or_capture_date":"2016-07","target_year_statuses":{"2018":"present","2013":"not_assessed","2023":"present"},"privacy_flag":"clear","licence_flag":"needs_review","evidence_note":"The directory records this place as active in July 2016."}'],
];

// texts the contract must refuse: values outside the i-json domain
const rejected = [
  ["nan_literal", "NaN", "non-finite number"],
  ["infinity_literal", "Infinity", "non-finite number"],
  ["duplicate_member_names", '{"a":1,"a":2}', "duplicate member name"],
  ["lone_surrogate", '"\\ud800"', "lone surrogate"],
  ["trailing_data", "{} {}", "trailing data"],
];

const built = {
  contract: CANONICAL_JSON_CONTRACT,
  scheme: CANONICAL_JSON_SCHEME,
  hash_contract: HASH_CONTRACT,
  hash_algorithm: "sha256 over utf-8 canonical bytes, written as sha256:<lowercase hex>",
  cases: cases.map(([name, json_text]) => {
    const value = JSON.parse(json_text);
    return { name, json_text, canonical: canonicalJsonStrict(value), object_hash: objectHash(value) };
  }),
  rejected: rejected.map(([name, json_text, reason]) => ({ name, json_text, reason })),
};

const rendered = `${JSON.stringify(built, null, 2)}\n`;
if (process.argv.includes("--write")) {
  fs.writeFileSync(fixturePath, rendered);
  console.log(`wrote ${built.cases.length} cases and ${built.rejected.length} rejections to ${path.relative(repoRoot, fixturePath)}`);
} else {
  const current = fs.readFileSync(fixturePath, "utf8");
  if (current !== rendered) {
    console.error("fixture file is stale; run with --write");
    process.exit(1);
  }
  console.log("fixtures are current");
}
