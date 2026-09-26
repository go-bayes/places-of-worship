"""Internal cited-name admission and first-pass boundary."""
import json
import unittest
from pathlib import Path

import first_pass
import intake
import lib

HERE = Path(__file__).resolve().parent
NAME = "Rev'd Pat Example"


def fixture(name):
    return json.loads((HERE / 'fixtures' / name).read_text())


class CitedNameTests(unittest.TestCase):
    def dossier(self, quote=None, value=None, locator=None):
        dossier = fixture('internal-review-bundle.json')['dossier']
        claim = dossier['claims'][0]
        claim['value'] = value if value is not None else f'opened 1891 under {NAME}'
        claim['quoted_support'] = quote if quote is not None else f'built in 1891 under {NAME}'
        if locator:
            claim['source']['locator'] = locator
        dossier['personal_details_quarantine']['items'] = []
        dossier['personal_details_quarantine']['item_count'] = 0
        dossier['personal_details_quarantine']['redacted'] = False
        return dossier

    def test_capture_and_bundle_keep_qualified_name(self):
        dossier = self.dossier()
        dossier['place']['name'] = f'{NAME} / Pat Example'
        dossier['status_assessment']['basis'] = f'{NAME} signed the notice.'
        lib.quarantine_dossier(dossier)
        self.assertIn(NAME, dossier['claims'][0]['value'])
        self.assertNotIn('Pat Example', dossier['place']['name'])
        self.assertNotIn('Pat Example', dossier['status_assessment']['basis'])
        items = dossier['personal_details_quarantine']['items']
        self.assertTrue(any(item.get('admitted_by_rule') == lib.CITED_NAME_RULE and item['field'] == 'value'
                            and (item['start'], item['end']) == (18, 35) for item in items))
        lib.redact_quarantine(dossier)
        self.assertEqual(dossier['personal_details_quarantine']['items'][0]['admitted_by_rule'], lib.CITED_NAME_RULE)
        lib.bundle_quarantine(dossier)
        self.assertEqual(dossier['personal_details_quarantine']['items'][0]['admitted_by_rule'], lib.CITED_NAME_RULE)
        bundle = fixture('internal-review-bundle.json')
        bundle['dossier'] = dossier
        self.assertEqual(intake.validate_bundle(bundle), [])

    def test_nonqualifying_names_are_withheld(self):
        cases = [
            self.dossier(value='opened under Dr Pat Example', quote='built under Dr Pat Example'),
            self.dossier(quote='built in 1891'),
            self.dossier(quote="built in 1891 under Pat Examples"),
            self.dossier(locator='https://www.example-parish.nz/history'),
        ]
        for dossier in cases:
            with self.subTest(dossier['claims'][0]):
                lib.quarantine_dossier(dossier)
                self.assertNotIn('Pat Example', json.dumps({k: v for k, v in dossier.items() if k != 'personal_details_quarantine'}))
                self.assertFalse(any('admitted_by_rule' in item for item in dossier['personal_details_quarantine']['items']))

    def test_extra_name_demotes_cover(self):
        dossier = self.dossier()
        lib.quarantine_dossier(dossier, extra_names=['Pat Example'])
        self.assertNotIn('Pat Example', json.dumps({k: v for k, v in dossier.items() if k != 'personal_details_quarantine'}))
        self.assertFalse(any('admitted_by_rule' in item for item in dossier['personal_details_quarantine']['items']))

    def test_first_pass_still_refuses_name(self):
        record = fixture('first-pass-researched.json')
        claim = record['dossier']['claims'][0]
        claim['value'] += f' under {NAME}'
        claim['quoted_support'] += f' under {NAME}'
        record['dossier']['personal_details_quarantine']['items'] = [
            {'kind': 'person_name', 'context_claim_id': claim['claim_id'], 'admitted_by_rule': lib.CITED_NAME_RULE,
             'field': 'value', 'start': claim['value'].index(NAME), 'end': claim['value'].index(NAME) + len(NAME)}]
        record['dossier']['personal_details_quarantine']['item_count'] = 1
        self.assertTrue(any('personal details' in error for error in first_pass.submission_errors(record)))

    def test_normal_form(self):
        self.assertEqual(lib.rule_normal_form(" REV’D\u00a0PAT\t EXAMPLE "), "rev'd pat example")
        self.assertEqual(lib.rule_normal_form('ÄABC'), 'Äabc')
        for honorific, expected in [('Rev.', False), ('Fr.', True), ('Dr', False)]:
            self.assertEqual(lib.honorific_name_matches(f'{honorific} Pat Example')[0][3], expected)
        for text in ("Rev'd Pat Example.", "(Rev'd Pat Example)"):
            self.assertTrue(lib.honorific_name_matches(text)[0][3])
        for text in ("Rev'd\u0085Pat Example", "Rev'd\ufeffPat Example", "Rev'd  Pat Example", "Rev'd Pat Example\u0085", "Rev'd Pat Example/"):
            matches = lib.honorific_name_matches(text)
            self.assertFalse(any(match[3] for match in matches))
        self.assertFalse(lib.quote_contains_name("Rev'd Pat Examples", "rev'd pat example"))
        self.assertFalse(lib.quote_contains_name("Rev'd Pat Example-Smith", "rev'd pat example"))

    def test_known_admitted_forms_are_allowed_only_in_claim_fields(self):
        dossier = self.dossier()
        lib.quarantine_dossier(dossier)
        items = dossier['personal_details_quarantine']['items']
        known = lib.known_values(items, include_admitted=True)
        admitted_names = frozenset({lib.name_key(NAME)})
        lib.redact_quarantine(dossier)
        lib.bundle_quarantine(dossier)
        schema, root = lib.dossier_screen_schema()
        self.assertEqual(lib.known_value_findings(dossier, known, schema, root, 'dossier', admitted_names), [])
        dossier['place']['name'] = 'Pat Example chapel'
        dossier['status_assessment']['basis'] = NAME
        self.assertEqual(set(lib.known_value_findings(dossier, known, schema, root, 'dossier', admitted_names)),
                         {'dossier.place.name', 'dossier.status_assessment.basis'})
        findings = lib.screen_spans(dossier, schema, root, frozenset(), known, 'dossier', admitted_names)
        self.assertTrue(any(f['path'] == 'dossier.place.name' and f['detector'] == 'known_value' for f in findings))
        self.assertTrue(any(f['path'] == 'dossier.status_assessment.basis' for f in findings))

    def test_parser_detector_mask_and_quote(self):
        rule = lib.cited_name_rule()
        self.assertIn('Dr', rule['stop_titles'])
        self.assertEqual([(n['start'], n['end']) for n in lib.parsed_names("Rev'd Pat Example Dr Jo Sample")], [(0, 17)])
        self.assertEqual([(n['start'], n['end']) for n in lib.parsed_names("Rev'd Pat Example Bishop Jo Sample")], [(0, 17), (18, 34)])
        self.assertEqual(lib.parsed_names("éRev'd Pat Example"), [])
        self.assertEqual(lib.parsed_names("Rev'd\u0085Pat Example"), [])
        self.assertEqual(lib.parsed_names("Rev'd Pat Jo Lee Example"), [])
        self.assertEqual([x[2] for x in lib.explicit_title_hits("éRev'd Pat Example")], ["Rev'd Pat"])
        self.assertEqual([x[2] for x in lib.explicit_title_hits("Rev'd\u0085Pat Example")], ["Rev'd\u0085Pat"])
        self.assertEqual(lib.explicit_title_hits("xRev'd Pat"), [])
        self.assertEqual(lib.mask_names("Rev'd Pat Example Dr Jo Sample", {"rev'd pat example"}), ' ' * 17 + ' Dr Jo Sample')
        self.assertTrue(lib.quote_contains_name("(Rev'd Pat Example)", "rev'd pat example"))
        self.assertFalse(lib.quote_contains_name("Rev'd Pat Examples", "rev'd pat example"))

    def test_producer_withholds_embedded_and_nonclaim_recurrences(self):
        dossier = self.dossier()
        dossier['claims'][1]['note'] = 'Pat Examples wrote the history.'
        dossier['place']['name'] = 'Pat Example chapel'
        dossier['status_assessment']['basis'] = "REV'D PAT EXAMPLE signed."
        lib.quarantine_dossier(dossier)
        self.assertIn(NAME, dossier['claims'][0]['value'])
        self.assertNotIn('Pat Example', dossier['claims'][1]['note'])
        self.assertNotIn('Pat Example', dossier['place']['name'])
        self.assertNotIn("REV'D PAT EXAMPLE", dossier['status_assessment']['basis'])

    def test_float_written_span_is_invalid(self):
        bundle = fixture('internal-review-bundle.json')
        dossier = self.dossier()
        lib.quarantine_dossier(dossier)
        lib.redact_quarantine(dossier)
        lib.bundle_quarantine(dossier)
        bundle['dossier'] = dossier
        raw = json.dumps(bundle).replace('"start": 18,', '"start": 18.0,', 1)
        self.assertNotEqual(raw, json.dumps(bundle))
        self.assertEqual(intake.validate_bundle(intake.parse_json(json.dumps(bundle))), [])
        self.assertTrue(intake.validate_bundle(intake.parse_json(raw)))


class NoRuleRecordsTest(unittest.TestCase):
    """records without cited-name rule items keep main's detection, including its known
    cross-language gaps (docs/development/internal-agent-review.md, left to H1)."""

    def test_no_rule_bundle_keeps_main_detection(self):
        bundle = fixture('internal-review-bundle.json')
        bundle['dossier']['status_assessment']['basis'] = "Built by éRev'd Pat Example."
        self.assertEqual(intake.validate_bundle(bundle), [])
        self.assertEqual(lib.find_personal_details("Built by éRev'd Pat Example."), [])
        bundle = fixture('internal-review-bundle.json')
        bundle['dossier']['claims'][0]['value'] = "opened 1891 under Rev'd\u0085Pat Example"
        self.assertTrue(intake.validate_bundle(bundle))
