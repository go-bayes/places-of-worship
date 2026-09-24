#!/usr/bin/env python3
"""Preserve provisional research attempts as immutable, independently verifiable objects."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

import intake
import lib

HERE = Path(__file__).resolve().parent
SCHEMA = json.loads((HERE / 'schemas/agent-first-pass.v1.json').read_text())
MAX_CHAIN = 1000
# explicit selectors only; the operator names the target, as intake.py submit does
DEPLOYMENTS = ('dev', 'local')
INGEST_FUNCTION = 'firstPassReceipts:ingestFirstPass'
RECORD_FUNCTION = 'firstPassReceipts:getFirstPassRecord'


def encode(record):
    """Version-1 wire format: sorted ASCII JSON, compact separators, final newline."""
    return (json.dumps(record, sort_keys=True, ensure_ascii=True,
                       separators=(',', ':'), allow_nan=False) + '\n').encode('ascii')


def validate(record):
    # use the same bounded parser and schema vocabulary as provisional intake.
    record = intake.parse_json(encode(record))
    errors = intake.schema_errors(record, SCHEMA)
    if errors:
        raise ValueError('; '.join(errors))
    try:
        datetime.fromisoformat(record['created_at'])
    except ValueError as exc:
        raise ValueError('invalid creation timestamp') from exc
    parents = record['parents']
    if len(parents) != len(set(parents)):
        raise ValueError('duplicate parent hash')
    attribution = record['attribution']
    if (attribution['model_reported'] is None) != (attribution['model_unreported_reason'] is not None):
        raise ValueError('an unreported model requires a reason; a reported model must omit that reason')
    usage = record['usage']
    if usage['cost_basis'] in {'unknown', 'subscription_unmetered'} and usage['cost_usd'] is not None:
        raise ValueError('unknown or unmetered cost must remain null')
    if usage['cost_basis'] in {'tool_list_price', 'api_invoice'} and usage['cost_usd'] is None:
        raise ValueError('reported monetary cost requires a value')
    dossier = record['dossier']
    ids = set()
    if dossier is not None:
        errors = intake.validate_dossier(dossier)
        if errors:
            raise ValueError('; '.join(errors))
        if dossier['place']['place_ref'] != record['place_ref']:
            raise ValueError('dossier belongs to another place')
        ids = {claim['claim_id'] for claim in dossier['claims']}
    if record['outcome'] == 'researched' and dossier is None:
        raise ValueError('researched requires a validated dossier')
    if record['outcome'] in {'partial', 'blocked'} and not record['next_questions']:
        raise ValueError('unfinished research requires a next question')
    for annotation in record['annotations']:
        if annotation['claim_id'] not in ids:
            raise ValueError('annotation references an unknown claim')
    for search in record['searches']:
        dates = {}
        for field in ('attempted_at', 'retrieved_at'):
            if search[field] is not None:
                try:
                    dates[field] = datetime.fromisoformat(search[field])
                except ValueError as exc:
                    raise ValueError(f'invalid search {field}') from exc
        if len(dates) == 2 and dates['retrieved_at'] < dates['attempted_at']:
            raise ValueError('search retrieval precedes its attempt')
        if search['outcome'] == 'not_attempted' and dates:
            raise ValueError('unattempted search cannot have access timestamps')
        if search['outcome'] in {'blocked', 'no_results'} and search['retrieved_at'] is not None:
            raise ValueError('unsuccessful search cannot report retrieved content')
        if search['locator'] is not None and not intake.public_url(search['locator']):
            raise ValueError('search locator must be a public HTTP(S) URL')
        if search['outcome'] in {'opened', 'snippet_only', 'blocked'} and search['locator'] is None:
            raise ValueError('source access outcome requires a locator')
    return record


def object_path(store: Path, digest: str):
    if not re.fullmatch(r'[a-f0-9]{64}', digest):
        raise ValueError('invalid object hash')
    return store / 'objects' / 'sha256' / digest[:2] / f'{digest}.json'


def read_object(store: Path, digest: str):
    path = object_path(store, digest)
    # local archive roots must be operator-controlled; source text never sets paths.
    if path.is_symlink():
        raise ValueError('object symlinks are refused')
    with path.open('rb') as stream:
        raw = stream.read(intake.MAX_BYTES + 1)
    if len(raw) > intake.MAX_BYTES or hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('object hash or byte limit mismatch')
    record = validate(intake.parse_json(raw))
    if encode(record) != raw:
        raise ValueError('object is not in version-1 wire format')
    return raw, record


def verify(store: Path, digest: str):
    """Read the complete parent graph, checking hashes, shape and place identity."""
    pending = [digest]
    objects = {}
    place_ref = None
    while pending:
        current = pending.pop()
        if current in objects:
            continue
        if len(objects) >= MAX_CHAIN:
            raise ValueError('parent graph exceeds verification limit')
        raw, record = read_object(store, current)
        if place_ref is None:
            place_ref = record['place_ref']
        if record['place_ref'] != place_ref:
            raise ValueError('parent belongs to another place')
        objects[current] = (raw, record)
        pending.extend(record['parents'])
    return objects


def put_bytes(store: Path, raw: bytes):
    digest = hashlib.sha256(raw).hexdigest()
    path = object_path(store, digest)
    path.parent.mkdir(parents=True, exist_ok=True)
    # hard-link publication prevents readers seeing partial files and never replaces a key.
    fd, temporary = tempfile.mkstemp(prefix='.pending-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path)
        except FileExistsError:
            existing, _ = read_object(store, digest)
            if existing != raw:
                raise ValueError('existing object differs')
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        os.unlink(temporary)
    read_object(store, digest)
    return digest


def archive(store: Path, record):
    record = validate(record)
    ancestors = set()
    for parent in record['parents']:
        history = verify(store, parent)
        ancestors.update(history)
        if len(ancestors) >= MAX_CHAIN:
            raise ValueError('parent graph exceeds verification limit')
        if history[parent][1]['place_ref'] != record['place_ref']:
            raise ValueError('parent belongs to another place')
    raw = encode(record)
    digest = put_bytes(store, raw)
    verify(store, digest)
    return digest


def copy_history(source: Path, destination: Path, digest: str):
    objects = verify(source, digest)
    # all inputs are verified before copying; an interruption leaves reusable objects.
    for raw, _ in objects.values():
        put_bytes(destination, raw)
    verify(destination, digest)
    return len(objects)


BUNDLE_SCHEMA = json.loads(intake.BUNDLE_SCHEMA.read_text())
FIRST_PASS_HASH_FIELDS = lib.screen_hash_fields('agent-first-pass.v1')


def screened_text(record):
    """Every string of the record and its dossier that could carry a personal detail, by path.

    Mirrors convex/lib/firstPass.ts screenedText: each string value, and each
    object key the schema does not declare, except strings the schema
    constrains by enum, const or pattern and values shaped as a hex hash.
    """
    return lib.screened_strings(record, SCHEMA, SCHEMA, {'dossier': (BUNDLE_SCHEMA['$defs']['dossier'], BUNDLE_SCHEMA)})


def submission_errors(record):
    """Rules the shared backend adds to the archive's: reviewers read receipts.

    The local archive stays the operator's private working copy and keeps any
    record; a record that fails here stays there for human handling.
    """
    errors = lib.screen_errors(lib.screen_findings(record, SCHEMA, SCHEMA, FIRST_PASS_HASH_FIELDS,
                                                   {'dossier': (BUNDLE_SCHEMA['$defs']['dossier'], BUNDLE_SCHEMA)}))
    dossier = record['dossier']
    if dossier is not None:
        manifest = dossier['run_manifest']
        attribution = record['attribution']
        if attribution['agent_run_id'] == manifest['run_id'] and (
                attribution['model_requested'] != manifest['model_id_requested']
                or attribution['model_reported'] != manifest.get('model_id_reported')):
            errors.append("attribution names the dossier's run but disagrees with its models")
    return errors


def convex_run(deployment, function, payload):
    """Run one internal Convex function through the CLI and return its JSON result."""
    if deployment not in DEPLOYMENTS:
        raise ValueError('an explicit dev or local deployment is required')
    command = ['npx', '--no-install', 'convex', 'run', '--deployment', deployment,
               '--codegen', 'disable', function, json.dumps(payload)]
    # the controller invokes the api; no model sees this process or its credentials.
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(completed.stdout)


def history_order(objects, digest):
    """Order a verified parent graph so every parent precedes its revisions."""
    order, done, stack = [], set(), [(digest, False)]
    while stack:
        current, expanded = stack.pop()
        if current in done:
            continue
        if expanded:
            done.add(current)
            order.append(current)
            continue
        stack.append((current, True))
        for parent in objects[current][1]['parents']:
            if parent not in done:
                stack.append((parent, False))
    return order


def submit(store: Path, digest: str, deployment: str, run=convex_run):
    """Send a verified record and its history, parents first, and collect the receipts."""
    if deployment not in DEPLOYMENTS:
        raise ValueError('an explicit dev or local deployment is required')
    objects = verify(store, digest)
    # screen the whole history before the first write, so nothing partial is
    # sent. a record that fails only because a rule tightened after it was
    # receipted may still retry: a read-only lookup must show the backend
    # holding these exact bytes, and the record is then not sent again.
    receipted = {}
    for current, (raw, record) in objects.items():
        errors = submission_errors(record)
        if errors:
            stored = run(deployment, RECORD_FUNCTION, {'recordHash': current})
            if stored is None or stored.get('record_json', '').encode('ascii') != raw:
                raise ValueError(f'{current}: ' + '; '.join(errors))
            receipted[current] = {'record_hash': current, 'receipt_id': f'first-pass:{current}', 'created': False,
                                  'already_receipted': True, 'current_errors': errors}
    receipts = []
    for current in history_order(objects, digest):
        if current in receipted:
            receipts.append(receipted[current])
            continue
        raw = objects[current][0]
        receipt = run(deployment, INGEST_FUNCTION, {'recordJson': raw.decode('ascii'), 'recordHash': current})
        if not isinstance(receipt, dict) or receipt.get('record_hash') != current:
            raise ValueError('receipt names a different record')
        receipts.append(receipt)
    return receipts


def restore(store: Path, digest: str, deployment: str, run=convex_run):
    """Rebuild a record's history in a local archive from backend receipts, verifying every hash."""
    if deployment not in DEPLOYMENTS:
        raise ValueError('an explicit dev or local deployment is required')
    pending, restored = [digest], set()
    while pending:
        current = pending.pop()
        if current in restored:
            continue
        if len(restored) >= MAX_CHAIN:
            raise ValueError('parent graph exceeds verification limit')
        object_path(store, current)
        stored = run(deployment, RECORD_FUNCTION, {'recordHash': current})
        if stored is None:
            raise ValueError(f'no receipt holds {current}')
        raw = stored['record_json'].encode('ascii')
        if hashlib.sha256(raw).hexdigest() != current:
            raise ValueError('receipt bytes do not match their hash')
        record = validate(intake.parse_json(raw))
        if encode(record) != raw:
            raise ValueError('receipt bytes are not in version-1 wire format')
        put_bytes(store, raw)
        restored.add(current)
        pending.extend(record['parents'])
    verify(store, digest)
    return len(restored)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    add = commands.add_parser('archive')
    add.add_argument('record', type=Path)
    add.add_argument('--store', type=Path, required=True)
    check = commands.add_parser('verify')
    check.add_argument('hash')
    check.add_argument('--store', type=Path, required=True)
    recover = commands.add_parser('copy')
    recover.add_argument('hash')
    recover.add_argument('--store', type=Path, required=True)
    recover.add_argument('--destination', type=Path, required=True)
    send = commands.add_parser('submit', help='send a verified record and its history to Convex for receipts')
    send.add_argument('hash')
    send.add_argument('--store', type=Path, required=True)
    send.add_argument('--deployment', choices=DEPLOYMENTS, required=True)
    fetch = commands.add_parser('restore', help='rebuild a record and its history from Convex receipts')
    fetch.add_argument('hash')
    fetch.add_argument('--store', type=Path, required=True)
    fetch.add_argument('--deployment', choices=DEPLOYMENTS, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'submit':
            receipts = submit(args.store, args.hash, args.deployment)
            print(json.dumps({'sha256': args.hash, 'submitted': len(receipts),
                              'created': sum(1 for receipt in receipts if receipt.get('created')),
                              'receipts': receipts, 'disposition': 'provisional', 'storage': 'convex_only'}))
            return 0
        if args.command == 'restore':
            restored = restore(args.store, args.hash, args.deployment)
            objects = verify(args.store, args.hash)
            print(json.dumps({'sha256': args.hash, 'restored_objects': restored, 'verified_objects': len(objects),
                              'disposition': 'provisional', 'storage': 'local_only'}))
            return 0
        if args.command == 'archive':
            digest = archive(args.store, intake.read_json(args.record))
        else:
            digest = args.hash
            if args.command == 'copy':
                if args.store.resolve() == args.destination.resolve():
                    raise ValueError('recovery copy requires a different destination')
                copy_history(args.store, args.destination, digest)
        objects = verify(args.store, digest)
        print(json.dumps({'sha256': digest, 'verified_objects': len(objects),
                          'disposition': 'provisional', 'storage': 'local_only'}))
        return 0
    except subprocess.CalledProcessError as exc:
        parser.exit(1, f'first-pass archive: convex run failed: {(exc.stderr or "").strip()[-2000:]!r}\n')
    except (OSError, ValueError, TypeError, KeyError) as exc:
        parser.exit(1, f'first-pass archive: {str(exc)!r}\n')


if __name__ == '__main__':
    raise SystemExit(main())
