#!/usr/bin/env python3
"""validate and package provisional internal agent evidence without fetching sources."""
from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import math
import re
import subprocess
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlsplit

import lib
from safe_http import parse_public_url, UnsafeURL

HERE = Path(__file__).resolve().parent
BUNDLE_SCHEMA = HERE / 'schemas' / 'agent-review-bundle.v1.json'
REVIEW_SCHEMA = HERE / 'schemas' / 'agent-review.v1.json'
MAX_BYTES = 65_536
MAX_DEPTH = 32
MODELS = {'claude': 'sonnet', 'codex': 'gpt-5.6-luna'}
RUN_KEYS = ('backend', 'model_requested', 'model_id_reported', 'started_at', 'ended_at',
            'duration_seconds', 'usage', 'raw_trace_sha256', 'prompt_sha256', 'cli_version',
            'exit_code', 'tool_policy_version')


# reject duplicate and prototype-like keys before interpreting a JSON object.
def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result or key in {'__proto__', 'prototype', 'constructor'}:
            raise ValueError('duplicate or forbidden JSON key')
        result[key] = value
    return result


# bound depth, values, and control characters for all source and manifest fields.
def _guard(value, depth=0):
    if depth > MAX_DEPTH:
        raise ValueError('JSON exceeds depth limit')
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError('non-finite JSON number')
    if isinstance(value, str) and any(ord(c) < 32 and c not in '\n\r\t' for c in value):
        raise ValueError('control character in JSON text')
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str) or key in {'__proto__', 'prototype', 'constructor'}:
                raise ValueError('forbidden JSON key')
            _guard(key, depth + 1)
            _guard(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            _guard(child, depth + 1)


# parse a bounded UTF-8 JSON document with strict numbers and object keys.
def parse_json(raw: str | bytes):
    if isinstance(raw, bytes):
        if len(raw) > MAX_BYTES:
            raise ValueError('JSON exceeds 64 KiB limit')
        raw = raw.decode('utf-8', errors='strict')
    if len(raw.encode('utf-8')) > MAX_BYTES:
        raise ValueError('JSON exceeds 64 KiB limit')
    def bad_number(_):
        raise ValueError('non-finite JSON number')
    try:
        value = json.loads(raw, object_pairs_hook=_object, parse_constant=bad_number)
        _guard(value)
        return value
    except (RecursionError, UnicodeError) as exc:
        raise ValueError('invalid or excessively nested JSON') from exc


# read only a bounded local JSON file selected by the operator.
def read_json(path: Path):
    with path.open('rb') as stream:
        return parse_json(stream.read(MAX_BYTES + 1))


# apply the self-contained schema vocabulary used by the internal bundle.
def schema_errors(value, schema, root=None, path='$'):
    root = schema if root is None else root
    if '$ref' in schema:
        ref = schema['$ref']
        if not ref.startswith('#/'):
            return [f'{path}: external schema references are forbidden']
        target = root
        for part in ref[2:].split('/'):
            target = target[part]
        return schema_errors(value, target, root, path)
    errors = []
    kinds = schema.get('type', [])
    kinds = [kinds] if isinstance(kinds, str) else kinds
    if kinds and not any(lib._type_ok(value, kind) for kind in kinds):
        return [f'{path}: invalid type']
    if 'const' in schema and (value != schema['const'] or type(value) is not type(schema['const'])):
        errors.append(f'{path}: invalid constant')
    if 'enum' in schema and value not in schema['enum']:
        errors.append(f'{path}: invalid enum')
    if isinstance(value, str):
        if len(value) < schema.get('minLength', 0) or len(value) > schema.get('maxLength', MAX_BYTES):
            errors.append(f'{path}: invalid string length')
        if 'pattern' in schema and re.search(schema['pattern'], value) is None:
            errors.append(f'{path}: invalid string pattern')
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        if not math.isfinite(value) or value < schema.get('minimum', -math.inf) or value > schema.get('maximum', math.inf):
            errors.append(f'{path}: invalid number')
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0) or len(value) > schema.get('maxItems', MAX_BYTES):
            errors.append(f'{path}: invalid array length')
        for i, item in enumerate(value):
            if 'items' in schema:
                errors += schema_errors(item, schema['items'], root, f'{path}[{i}]')
    if isinstance(value, dict):
        props = schema.get('properties', {})
        for key in schema.get('required', []):
            if key not in value:
                errors.append(f'{path}: missing {key}')
        for key, item in value.items():
            if key in props:
                errors += schema_errors(item, props[key], root, f'{path}.{key}')
            elif schema.get('additionalProperties') is False:
                errors.append(f'{path}: unexpected field {key}')
    return errors


# validate public URL syntax; DNS and redirects belong to the controlled fetcher.
def public_url(url):
    try:
        parsed = parse_public_url(url)
        host = (parsed.hostname or '').rstrip('.')
        if '\\' in url or '%' in host or any(c.isspace() for c in url):
            return False
        import ipaddress
        try:
            ipaddress.ip_address(host)
            return False
        except ValueError:
            if re.fullmatch(r'(?:[0-9]+|0x[0-9a-f]+)(?:\.(?:[0-9]+|0x[0-9a-f]+))*', host, re.I):
                return False
        return bool(host)
    except (ValueError, TypeError, UnsafeURL):
        return False


# convert a partial calendar date into its earliest/latest represented date.
def date_bounds(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}(-\d{2}(-\d{2})?)?', value):
        raise ValueError('invalid partial ISO date')
    parts = [int(p) for p in value.split('-')]
    year, month = parts[0], parts[1] if len(parts) > 1 else 1
    start = date(year, month, parts[2] if len(parts) > 2 else 1)
    last_month = month if len(parts) > 1 else 12
    end = date(year, last_month, parts[2] if len(parts) > 2 else calendar.monthrange(year, last_month)[1])
    return start, end


# validate dossier facts as bounded, source-attributed claims, never accepted states.
def validate_dossier(dossier):
    schema = json.loads(BUNDLE_SCHEMA.read_text())
    try:
        _guard(dossier)
        if len(json.dumps(dossier, allow_nan=False).encode()) > MAX_BYTES:
            return ['dossier exceeds byte limit']
    except (ValueError, TypeError, OverflowError) as exc:
        return [str(exc)]
    errors = schema_errors(dossier, schema['$defs']['dossier'], schema)
    if errors:
        return errors
    if dossier['place']['country_code'] != 'NZ':
        errors.append('internal pilot permits only operator-cleared NZ sources')
    quarantine = dossier['personal_details_quarantine']
    if quarantine['items'] or quarantine['item_count']:
        errors.append('personal-details quarantine requires human handling')
    run = dossier['run_manifest']
    if run['backend'] not in MODELS or run['model_id_requested'] != MODELS.get(run['backend']):
        errors.append('unsupported researcher model')
    if run.get('exit_status') != 'completed':
        errors.append('research attempt was not completed')
    ids = set()
    for claim in dossier['claims']:
        cid = claim['claim_id']
        if cid in ids:
            errors.append('duplicate claim id')
        ids.add(cid)
        if not public_url(claim['source']['locator']):
            errors.append(f'{cid}: only public HTTP(S) source locators are permitted')
        for field in ['value', 'quoted_support', 'note']:
            if lib.find_personal_details(claim.get(field, '')):
                errors.append(f'{cid}: potential personal details require human handling')
        bounds = {}
        for key in ('date_start', 'date_end'):
            if claim.get(key) is not None:
                try:
                    bounds[key] = date_bounds(claim[key])
                    precision = {'day': 10, 'month': 7, 'year': 4}.get(claim.get('date_precision'))
                    if precision and len(claim[key]) != precision:
                        errors.append(f'{cid}: date precision does not match bound')
                except (ValueError, TypeError):
                    errors.append(f'{cid}: invalid {key}')
        if 'date_end' in bounds and 'date_start' not in bounds:
            errors.append(f'{cid}: end bound requires start bound')
        if len(bounds) == 2 and bounds['date_start'][0] > bounds['date_end'][1]:
            errors.append(f'{cid}: reversed date bounds')
        for field in ('source_date', 'retrieved_at'):
            value = claim['source'].get(field)
            if value:
                try:
                    date_bounds(value.split('T')[0])
                except (ValueError, TypeError):
                    errors.append(f'{cid}: invalid {field}')
        reader = claim['reader']
        if reader['backend'] != run['backend'] or reader['model_id'] not in {run['model_id_requested'], run['model_id_reported']}:
            errors.append(f'{cid}: inconsistent researcher provenance')
    for cid in dossier['status_assessment']['supporting_claim_ids']:
        if cid not in ids:
            errors.append('status assessment references unknown claim')
    try:
        date_bounds(dossier['status_assessment']['asof_date'])
    except ValueError:
        errors.append('invalid assessment date')
    for entry in dossier['osm_version_chain']:
        if not public_url(entry['locator']):
            errors.append('invalid OSM history locator')
    return errors


# require an independent advisory review that covers every claim and pins source URLs.
def validate_review(review, dossier):
    try:
        _guard(review)
    except ValueError as exc:
        return [str(exc)]
    errors = schema_errors(review, json.loads(REVIEW_SCHEMA.read_text()))
    if errors:
        return errors
    claims = {c['claim_id']: c for c in dossier['claims']}
    checked = set()
    for check in review['claim_checks']:
        cid = check['claim_id']
        if cid not in claims:
            errors.append('review references unknown claim')
            continue
        if cid in checked:
            errors.append('duplicate review claim check')
        checked.add(cid)
        if check['source_url'] != claims[cid]['source']['locator']:
            errors.append(f'{cid}: review source differs from claim source')
        if check['access_method'] == 'not_checked' and check['outcome'] == 'supported':
            errors.append(f'{cid}: unchecked source cannot be supported')
    if set(claims) != checked:
        errors.append('review must cover every claim')
    if review['cultural_sensitivity']['flagged'] and review['recommendation'] != 'defer_cultural':
        errors.append('sensitive review must defer to human judgement')
    if review['recommendation'] == 'accept' and any(c['outcome'] != 'supported' or c['access_method'] != 'opened' for c in review['claim_checks']):
        errors.append('accept recommendation requires opened, supported checks for every claim')
    return errors


# validate a complete bundle including cross-field provenance and bounded transport.
def validate_bundle(bundle):
    try:
        _guard(bundle)
        if len(json.dumps(bundle, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()) > MAX_BYTES:
            return ['bundle exceeds byte limit']
    except (ValueError, TypeError, OverflowError) as exc:
        return [str(exc)]
    schema = json.loads(BUNDLE_SCHEMA.read_text())
    errors = schema_errors(bundle, schema)
    if errors:
        return errors
    errors += validate_dossier(bundle['dossier'])
    errors += validate_review(bundle['review'], bundle['dossier'])
    research, review = bundle['research_run'], bundle['review_run']
    if research['backend'] == review['backend']:
        errors.append('research and review must use different providers')
    for run in (research, review):
        if MODELS.get(run['backend']) != run['model_requested']:
            errors.append('backend and model mismatch')
        try:
            start, end = datetime.fromisoformat(run['started_at']), datetime.fromisoformat(run['ended_at'])
            if end < start:
                errors.append('run timestamps are reversed')
        except ValueError:
            errors.append('invalid run timestamp')
    original = bundle['dossier']['run_manifest']
    if original['backend'] != research['backend'] or original['model_id_requested'] != research['model_requested']:
        errors.append('dossier and research manifest disagree')
    return errors


# produce a retry-safe immutable JSON file; models never choose file paths or identities.
def write_bundle(output_dir, dossier, review, research_manifest, review_manifest):
    normalised = []
    for manifest in (research_manifest, review_manifest):
        normalised.append({key: manifest.get(key) for key in RUN_KEYS})
    bundle = {'schema_version': 'agent-review-bundle.v1',
              'submission_key': lib.sha256(dossier['dossier_id']), 'dossier': dossier,
              'review': review, 'research_run': normalised[0], 'review_run': normalised[1]}
    errors = validate_bundle(bundle)
    if errors:
        raise ValueError('; '.join(errors[:12]))
    raw = json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    if len(raw) > MAX_BYTES:
        raise ValueError('bundle exceeds byte limit')
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = output_dir / 'bundle.json'
    try:
        with path.open('xb') as stream:
            stream.write(raw)
    except FileExistsError:
        if path.read_bytes() != raw:
            raise ValueError('output already contains a different immutable bundle')
    return {'bundle_path': str(path), 'submission_key': bundle['submission_key'],
            'sha256': hashlib.sha256(raw).hexdigest(), 'provisional': True}


# validate locally or explicitly upload a validated bundle to an enabled development backend.
def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['validate', 'submit'])
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--deployment', help='explicit dev or local selector; required for submit')
    args = parser.parse_args(argv)
    try:
        with args.bundle.open('rb') as stream:
            raw = stream.read(MAX_BYTES + 1)
        bundle = parse_json(raw)
        errors = validate_bundle(bundle)
        if errors:
            raise ValueError('; '.join(errors[:12]))
        if args.command == 'submit':
            if args.deployment not in {'dev', 'local'}:
                raise ValueError('submit requires explicit dev or local deployment')
            command = ['npx', '--no-install', 'convex', 'run', '--deployment', args.deployment, '--codegen', 'disable',
                       'internalAgentIntake:ingestBundle', json.dumps({'bundleJson': raw.decode('utf-8'), 'bundleHash': hashlib.sha256(raw).hexdigest()})]
            # the controller invokes the API; no model sees this process or its credentials.
            subprocess.run(command, check=True)
        else:
            print(json.dumps({'valid': True, 'provisional': True, 'sha256': hashlib.sha256(raw).hexdigest()}))
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(json.dumps({'valid': False, 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
