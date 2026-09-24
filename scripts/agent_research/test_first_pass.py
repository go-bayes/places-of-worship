"""Exercise revision preservation, tamper detection, and concurrent archive writes."""
import copy
import hashlib
import json
import subprocess
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

    def test_optional_context_links_the_portal_record(self):
        # no context: the record stands as before
        fp.validate(self.record)
        self.record['context'] = {
            'task_id': 'task_01',
            'evidence_draft_id': 'draft_01',
            'evidence_version_hash': '0' * 64,
            'assistance_request_id': 'assist_01',
        }
        restored = fp.validate(self.record)
        self.assertEqual(restored['context']['evidence_version_hash'], '0' * 64)
        digest = fp.archive(self.store, self.record)
        _, archived = fp.read_object(self.store, digest)
        self.assertEqual(archived['context'], self.record['context'])
        # every field is optional; the block may name only the task
        self.record['context'] = {'task_id': 'task_01'}
        fp.validate(self.record)
        # an empty block is allowed and means nothing was linked
        self.record['context'] = {}
        fp.validate(self.record)

    def test_context_rejects_unknown_fields_and_bad_hashes(self):
        self.record['context'] = {'task_id': 'task_01', 'reviewer': 'someone'}
        with self.assertRaisesRegex(ValueError, 'unexpected field reviewer'):
            fp.validate(self.record)
        self.record['context'] = {'evidence_version_hash': 'not-a-hash'}
        with self.assertRaisesRegex(ValueError, 'invalid string pattern'):
            fp.validate(self.record)
        self.record['context'] = {'evidence_version_hash': 'A' * 64}
        with self.assertRaisesRegex(ValueError, 'invalid string pattern'):
            fp.validate(self.record)
        self.record['context'] = {'task_id': ''}
        with self.assertRaisesRegex(ValueError, 'invalid string length'):
            fp.validate(self.record)
        self.record['context'] = 'task_01'
        with self.assertRaisesRegex(ValueError, 'invalid type'):
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

    def test_blocked_source_metadata_survives_without_a_dossier(self):
        search = self.record['searches'][0]
        search.update(outcome='blocked', locator='https://example.org/archive',
                      source_name='Example archive', attempted_at='2026-09-18T05:50:00Z',
                      retrieved_at=None, licence_note='Access terms not assessed.',
                      access_note='The archive requires human access.')
        digest = fp.archive(self.store, self.record)
        _, recovered = fp.read_object(self.store, digest)
        self.assertEqual(recovered['searches'], self.record['searches'])
        self.assertIsNone(recovered['dossier'])
        del search['licence_note']
        with self.assertRaisesRegex(ValueError, 'licence_note'):
            fp.validate(self.record)

    def test_search_dates_are_valid_and_scope_matches_access(self):
        search = self.record['searches'][0]
        search.update(outcome='opened', locator='https://example.org/history',
                      attempted_at='2026-09-18T05:50:00Z', retrieved_at='2026-09-18T05:51:00Z')
        fp.validate(self.record)
        for date in ('2026-02-30T05:51:00Z', '2026-09-18T05:49:00Z'):
            search['retrieved_at'] = date
            with self.assertRaises(ValueError):
                fp.validate(self.record)
        search.update(outcome='blocked', retrieved_at='2026-09-18T05:51:00Z')
        with self.assertRaisesRegex(ValueError, 'unsuccessful'):
            fp.validate(self.record)
        search.update(outcome='not_attempted', retrieved_at=None)
        with self.assertRaisesRegex(ValueError, 'unattempted'):
            fp.validate(self.record)

    def test_source_access_outcomes_require_safe_locators(self):
        self.record['searches'][0]['outcome'] = 'opened'
        with self.assertRaisesRegex(ValueError, 'requires a locator'):
            fp.validate(self.record)
        self.record['searches'][0]['locator'] = 'http://127.0.0.1/secrets'
        with self.assertRaisesRegex(ValueError, 'public HTTP'):
            fp.validate(self.record)


    def test_researched_fixture_validates(self):
        record = json.loads((HERE / 'fixtures/first-pass-researched.json').read_text())
        restored = fp.validate(record)
        self.assertEqual(restored['outcome'], 'researched')
        self.assertEqual(len(restored['annotations']), 2)


class FakeBackend:
    """Stand-in for the Convex receipt functions: hash-checked, parents first, idempotent."""

    def __init__(self):
        self.receipts = {}
        self.calls = []

    def __call__(self, deployment, function, payload):
        self.calls.append((deployment, function))
        if function == fp.INGEST_FUNCTION:
            raw = payload['recordJson']
            digest = payload['recordHash']
            if hashlib.sha256(raw.encode('ascii')).hexdigest() != digest:
                raise ValueError('hash mismatch')
            for parent in json.loads(raw)['parents']:
                if parent not in self.receipts:
                    raise ValueError('parent has no receipt')
            created = digest not in self.receipts
            self.receipts.setdefault(digest, raw)
            return {'receipt_id': f'first-pass:{digest}', 'record_hash': digest, 'created': created,
                    'storage_tier': 'convex_only', 'judgment_ids': []}
        if function == fp.RECORD_FUNCTION:
            raw = self.receipts.get(payload['recordHash'])
            if raw is None:
                return None
            return {'record_hash': payload['recordHash'], 'record_json': raw,
                    'parents': json.loads(raw)['parents']}
        raise AssertionError(function)


class FirstPassSubmitTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Path(self.tmp.name) / 'archive'
        record = json.loads((HERE / 'fixtures/first-pass.json').read_text())
        self.first = fp.archive(self.store, record)
        revised = copy.deepcopy(record)
        revised['parents'] = [self.first]
        revised['stop_reason'] = 'A later attempt found the archive inaccessible.'
        self.second = fp.archive(self.store, revised)
        self.backend = FakeBackend()

    def test_submit_sends_history_parents_first_and_retries_idempotently(self):
        receipts = fp.submit(self.store, self.second, 'local', run=self.backend)
        self.assertEqual([r['record_hash'] for r in receipts], [self.first, self.second])
        self.assertTrue(all(r['created'] for r in receipts))
        self.assertEqual(self.backend.calls[0], ('local', 'firstPassReceipts:ingestFirstPass'))
        again = fp.submit(self.store, self.second, 'local', run=self.backend)
        self.assertEqual([r['created'] for r in again], [False, False])
        self.assertEqual(len(self.backend.receipts), 2)
        # the backend holds the archive's exact bytes
        for digest in (self.first, self.second):
            raw, _ = fp.read_object(self.store, digest)
            self.assertEqual(self.backend.receipts[digest].encode('ascii'), raw)

    def test_history_order_handles_shared_ancestors(self):
        record = json.loads((HERE / 'fixtures/first-pass.json').read_text())
        record['parents'] = [self.first]
        record['stop_reason'] = 'A parallel revisit of the first attempt.'
        sibling = fp.archive(self.store, record)
        record['parents'] = [self.second, sibling]
        record['stop_reason'] = 'A merge of two revisits.'
        merged = fp.archive(self.store, record)
        order = fp.history_order(fp.verify(self.store, merged), merged)
        self.assertEqual(len(order), 4)
        self.assertEqual(order[0], self.first)
        self.assertEqual(order[-1], merged)
        fp.submit(self.store, merged, 'dev', run=self.backend)
        self.assertEqual(len(self.backend.receipts), 4)

    def test_submit_requires_an_explicit_deployment_and_a_verified_store(self):
        for selector in (None, 'prod', 'pastel-goshawk-398', ''):
            with self.assertRaisesRegex(ValueError, 'explicit dev or local'):
                fp.submit(self.store, self.second, selector, run=self.backend)
        with self.assertRaisesRegex(ValueError, 'explicit dev or local'):
            fp.convex_run('prod', fp.INGEST_FUNCTION, {})
        fp.object_path(self.store, self.first).write_text('{}')
        with self.assertRaisesRegex(ValueError, 'hash'):
            fp.submit(self.store, self.second, 'local', run=self.backend)
        self.assertEqual(self.backend.calls, [])

    def test_submit_refuses_a_receipt_for_another_record(self):
        def wrong(deployment, function, payload):
            return {'record_hash': '0' * 64, 'created': True}
        with self.assertRaisesRegex(ValueError, 'different record'):
            fp.submit(self.store, self.second, 'local', run=wrong)

    def test_restore_rebuilds_a_clean_archive_from_receipts(self):
        fp.submit(self.store, self.second, 'local', run=self.backend)
        clean = Path(self.tmp.name) / 'clean'
        self.assertEqual(fp.restore(clean, self.second, 'local', run=self.backend), 2)
        for digest in (self.first, self.second):
            self.assertEqual(fp.read_object(clean, digest), fp.read_object(self.store, digest))
        # an identical restore reuses the verified objects
        self.assertEqual(fp.restore(clean, self.second, 'local', run=self.backend), 2)

    def test_restore_refuses_tampered_or_missing_receipts(self):
        fp.submit(self.store, self.second, 'local', run=self.backend)
        clean = Path(self.tmp.name) / 'clean'
        self.backend.receipts[self.first] = self.backend.receipts[self.first].replace('invented', 'altered')
        with self.assertRaisesRegex(ValueError, 'do not match'):
            fp.restore(clean, self.second, 'local', run=self.backend)
        with self.assertRaises(FileNotFoundError):
            fp.verify(clean, self.first)
        with self.assertRaisesRegex(ValueError, 'no receipt'):
            fp.restore(clean, 'f' * 64, 'local', run=FakeBackend())

    def test_convex_run_names_the_target_and_passes_exact_bytes(self):
        raw, _ = fp.read_object(self.store, self.first)
        payload = {'recordJson': raw.decode('ascii'), 'recordHash': self.first}
        completed = subprocess.CompletedProcess([], 0, stdout='{"record_hash": "x"}\n', stderr='')
        with patch.object(fp.subprocess, 'run', return_value=completed) as run:
            self.assertEqual(fp.convex_run('local', fp.INGEST_FUNCTION, payload), {'record_hash': 'x'})
        command = run.call_args.args[0]
        self.assertEqual(command[:7], ['npx', '--no-install', 'convex', 'run', '--deployment', 'local', '--codegen'])
        self.assertEqual(command[-2], 'firstPassReceipts:ingestFirstPass')
        self.assertEqual(json.loads(command[-1]), payload)
        self.assertTrue(run.call_args.kwargs['check'])


if __name__ == '__main__':
    unittest.main()
