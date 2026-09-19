#!/usr/bin/env python3
"""Preserve provisional research attempts as immutable, independently verifiable objects."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path

import intake

HERE = Path(__file__).resolve().parent
SCHEMA = json.loads((HERE / 'schemas/agent-first-pass.v1.json').read_text())
MAX_CHAIN = 1000


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
    args = parser.parse_args(argv)
    try:
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
    except (OSError, ValueError, TypeError) as exc:
        parser.exit(1, f'first-pass archive: {str(exc)!r}\n')


if __name__ == '__main__':
    raise SystemExit(main())
