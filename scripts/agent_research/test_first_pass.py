"""Exercise revision preservation, tamper detection, and concurrent archive writes."""
import copy
import json
import tempfile
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import first_pass as fp

HERE = Path(__file__).resolve().parent


class FirstPassTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Path(self.tmp.name) / 'archive'
        self.record = json.loads((HERE / 'fixtures/first-pass.json').read_text())

    def test_partial_without_claims_is_preserved(self):
        digest = fp.archive(self.store, self.record)
        raw, restored = fp.read_object(self.store, digest)
        self.assertEqual(restored, self.record)
        self.assertEqual(raw, fp.encode(self.record))
        self.assertEqual(restored['usage']['cost_usd'], None)

    def test_revisit_and_recovery_preserve_exact_history(self):
        first = fp.archive(self.store, self.record)
        revised = copy.deepcopy(self.record)
        revised['parents'] = [first]
        revised['stop_reason'] = 'A later attempt found the archive inaccessible.'
        second = fp.archive(self.store, revised)
        destination = Path(self.tmp.name) / 'recovered'
        self.assertEqual(fp.copy_history(self.store, destination, second), 2)
        for digest in (first, second):
            self.assertEqual(fp.read_object(self.store, digest), fp.read_object(destination, digest))
        self.assertNotEqual(first, second)

    def test_concurrent_identical_writes_are_idempotent(self):
        with ThreadPoolExecutor(max_workers=8) as workers:
            hashes = list(workers.map(lambda _: fp.archive(self.store, self.record), range(16)))
        self.assertEqual(len(set(hashes)), 1)
        self.assertEqual(len(list(self.store.rglob('*.json'))), 1)
        self.assertEqual(list(self.store.rglob('.pending-*')), [])

    def test_tampered_parent_refuses_revisit_and_recovery(self):
        digest = fp.archive(self.store, self.record)
        fp.object_path(self.store, digest).write_text('{}')
        self.record['parents'] = [digest]
        with self.assertRaisesRegex(ValueError, 'hash'):
            fp.archive(self.store, self.record)
        destination = Path(self.tmp.name) / 'recovered'
        with self.assertRaisesRegex(ValueError, 'hash'):
            fp.copy_history(self.store, destination, digest)
        self.assertFalse(destination.exists())

    def test_missing_and_cross_place_parents_fail(self):
        self.record['parents'] = ['a' * 64]
        with self.assertRaises(FileNotFoundError):
            fp.archive(self.store, self.record)
        self.record['parents'] = []
        parent = fp.archive(self.store, self.record)
        self.record['parents'] = [parent]
        self.record['place_ref'] = 'osm:way/2'
        with self.assertRaisesRegex(ValueError, 'another place'):
            fp.archive(self.store, self.record)

    def test_graph_limit_refuses_before_publishing(self):
        first = fp.archive(self.store, self.record)
        self.record['parents'] = [first]
        self.record['stop_reason'] = 'Second attempt.'
        with patch.object(fp, 'MAX_CHAIN', 1):
            with self.assertRaisesRegex(ValueError, 'verification limit'):
                fp.archive(self.store, self.record)
        self.assertEqual(len(list(self.store.rglob('*.json'))), 1)

    def test_claim_annotations_must_resolve(self):
        self.record['annotations'] = [{'claim_id':'invented','kind':'qualification','note':'Unsupported.'}]
        with self.assertRaisesRegex(ValueError, 'unknown claim'):
            fp.validate(self.record)
        bundle = json.loads((HERE / 'fixtures/internal-review-bundle.json').read_text())
        self.record['dossier'] = bundle['dossier']
        self.record['annotations'][0]['claim_id'] = bundle['dossier']['claims'][0]['claim_id']
        fp.validate(self.record)
        self.record['dossier']['place']['place_ref'] = 'osm:way/2'
        with self.assertRaisesRegex(ValueError, 'another place'):
            fp.validate(self.record)

    def test_unknown_cost_cannot_be_zero(self):
        self.record['usage']['cost_usd'] = 0
        with self.assertRaisesRegex(ValueError, 'remain null'):
            fp.validate(self.record)

    def test_reported_cost_requires_value(self):
        self.record['usage']['cost_basis'] = 'api_invoice'
        with self.assertRaisesRegex(ValueError, 'requires a value'):
            fp.validate(self.record)

    def test_unreported_model_requires_reason(self):
        self.record['attribution']['model_unreported_reason'] = None
        with self.assertRaisesRegex(ValueError, 'requires a reason'):
            fp.validate(self.record)

    def test_outcome_is_separate_from_acceptance(self):
        for invalid in ('accepted', 'released', 'verified'):
            with self.subTest(invalid=invalid):
                self.record['outcome'] = invalid
                with self.assertRaises(ValueError):
                    fp.validate(self.record)
        self.record['outcome'] = 'researched'
        with self.assertRaisesRegex(ValueError, 'dossier'):
            fp.validate(self.record)

    def test_boundaries_and_hostile_input(self):
        for field, value in [('created_at', '2026-02-30T00:00:00Z'), ('parents', ['a'*64]*2),
                             ('question', 'x'*70000), ('next_questions', [])]:
            with self.subTest(field=field):
                record = copy.deepcopy(self.record)
                record[field] = value
                with self.assertRaises(ValueError):
                    fp.validate(record)
        for digest in ('../secret', 'A'*64, 'a'*64+'\n'):
            with self.assertRaises(ValueError):
                fp.object_path(self.store, digest)
        with self.assertRaises(ValueError):
            fp.intake.parse_json('{"question":"a","question":"b"}')

    def test_source_access_outcomes_require_safe_locators(self):
        self.record['searches'][0]['outcome'] = 'opened'
        with self.assertRaisesRegex(ValueError, 'requires a locator'):
            fp.validate(self.record)
        self.record['searches'][0]['locator'] = 'http://127.0.0.1/secrets'
        with self.assertRaisesRegex(ValueError, 'public HTTP'):
            fp.validate(self.record)


if __name__ == '__main__':
    unittest.main()
