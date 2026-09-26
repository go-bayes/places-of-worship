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
        dossier['status_assessment']['basis'] = f'{NAME} signed the notice.'
        lib.quarantine_dossier(dossier)
        self.assertIn(NAME, dossier['claims'][0]['value'])
        self.assertIn(NAME, dossier['status_assessment']['basis'])
        items = dossier['personal_details_quarantine']['items']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['admitted_by_rule'], lib.CITED_NAME_RULE)
        self.assertNotIn(NAME, lib.known_values(items))
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
            {'kind': 'person_name', 'context_claim_id': claim['claim_id'], 'admitted_by_rule': lib.CITED_NAME_RULE}]
        record['dossier']['personal_details_quarantine']['item_count'] = 1
        self.assertTrue(any('personal details' in error for error in first_pass.submission_errors(record)))

    def test_normal_form(self):
        self.assertEqual(lib.rule_normal_form(" REV’D\u00a0PAT\t EXAMPLE "), "rev'd pat example")
        self.assertEqual(lib.rule_normal_form('ÄABC'), 'Äabc')
        for honorific, expected in [('Rev.', False), ('Fr.', True), ('Dr', False)]:
            self.assertEqual(lib.honorific_name_matches(f'{honorific} Pat Example')[0][3], expected)
