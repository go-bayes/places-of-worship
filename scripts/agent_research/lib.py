"""shared helpers for the agent research pilot: dossier schema validation,
text normalisation, personal-details redaction, distance, agreement.

standard library only. the validator covers the json-schema subset the
dossier schema uses (type, enum, const, required, properties,
additionalProperties, items, $ref into $defs, pattern, minimum, maximum,
minLength, maxLength); it is not a general implementation.
"""
from __future__ import annotations

import hashlib
import copy
import json
import math
import re
import unicodedata
from functools import lru_cache
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCHEMA_PATH = HERE / "schemas" / "agent-dossier.v1.json"
SCHEMA_VERSION = "agent-dossier.v1"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def idempotency_key(place_ref: str, prompt_version: str, model_id: str, seed_source: str) -> str:
    # place id + prompt version + model + edition, as the batch-review lane keys its artifacts
    return sha256("|".join([place_ref, prompt_version, model_id, seed_source]))


# ---------------------------------------------------------------------------
# schema validation


def load_schema(path: Path = SCHEMA_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


_TYPES = {
    "object": dict,
    "array": list,
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
    "null": type(None),
}


def _type_ok(value, type_name: str) -> bool:
    if type_name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if type_name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if type_name == "boolean":
        return isinstance(value, bool)
    return isinstance(value, _TYPES[type_name])


def _resolve(ref: str, root: dict) -> dict:
    assert ref.startswith("#/"), ref
    node = root
    for part in ref[2:].split("/"):
        node = node[part]
    return node


def validate(instance, schema: dict, root: dict | None = None, path: str = "$") -> list[str]:
    """returns a list of error strings; empty means valid"""
    root = root or schema
    errors: list[str] = []
    if "$ref" in schema:
        return validate(instance, _resolve(schema["$ref"], root), root, path)
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: not in enum")
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(instance, t) for t in types):
            errors.append(f"{path}: expected type {types}, got {type(instance).__name__}")
            return errors
    if isinstance(instance, str):
        if "pattern" in schema and re.search(schema["pattern"].removesuffix("$") + (r"\Z" if schema["pattern"].endswith("$") else ""), instance) is None:
            errors.append(f"{path}: does not match {schema['pattern']}")
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(f"{path}: shorter than {schema['minLength']}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: longer than {schema['maxLength']}")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: below minimum {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: above maximum {schema['maximum']}")
    if isinstance(instance, dict):
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing required {key!r}")
        props = schema.get("properties", {})
        for key, value in instance.items():
            if key in props:
                errors.extend(validate(value, props[key], root, f"{path}.{key}"))
            elif schema.get("additionalProperties", True) is False:
                errors.append(f"{path}: unexpected property {key_ref(instance, key)}")
    if isinstance(instance, list) and "items" in schema:
        for index, item in enumerate(instance):
            errors.extend(validate(item, schema["items"], root, f"{path}[{index}]"))
    return errors


def validate_dossier(dossier: dict) -> list[str]:
    return validate(dossier, load_schema())


# ---------------------------------------------------------------------------
# text normalisation and quote matching

_QUOTES = {"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " "}


def normalise_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    for src, dst in _QUOTES.items():
        text = text.replace(src, dst)
    text = text.lower()
    text = re.sub(r"[^a-z0-9À-ɏ\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str) -> list[str]:
    return normalise_text(text).split()


def quote_support(quote: str, page_text: str) -> tuple[str, float]:
    """how well a quoted support appears in a page: exact, partial or absent.

    returns (outcome, share): outcome in supported / partially_supported /
    not_found / no_quote; share is the fraction of the quote's word bigrams
    found in the page (0.6 or more counts as partial).
    """
    q = normalise_text(quote)
    if not q:
        return "no_quote", 0.0
    page = normalise_text(page_text)
    if not page:
        return "not_found", 0.0
    if q in page:
        return "supported", 1.0
    q_tokens = q.split()
    if len(q_tokens) < 2:
        share = 1.0 if q_tokens[0] in page else 0.0
    else:
        grams = [" ".join(q_tokens[i:i + 2]) for i in range(len(q_tokens) - 1)]
        share = sum(1 for g in grams if g in page) / len(grams)
    if share >= 0.6:
        return "partially_supported", round(share, 3)
    return "not_found", round(share, 3)


def strip_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<!--.*?-->", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    # a few common entities; a full parser is not needed for matching
    for entity, char in (("&amp;", "&"), ("&quot;", '"'), ("&#39;", "'"), ("&rsquo;", "'"), ("&lsquo;", "'"),
                         ("&ldquo;", '"'), ("&rdquo;", '"'), ("&nbsp;", " "), ("&ndash;", "-"), ("&mdash;", "-")):
        text = text.replace(entity, char)
    text = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), text)
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# personal details

_PHONE = re.compile(r"(?:\+64|\b0)[\s-]?\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,5}\b")
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# honorific followed by capitalised name tokens: the diocesan-directory pattern
_HONORIFIC_NAME = re.compile(
    r"\b(?:Rev(?:'d|erend|d)?\.?|Fr\.?|Father|Pastor|Vicar|Archdeacon|Bishop|Canon|Dean|Mr|Mrs|Ms|Dr)\s+"
    r"((?:[A-Z][a-zA-Z'\-]+\s?){1,3})"
)


def find_personal_details(text: str) -> list[dict]:
    """phones, emails and honorific-led names in free text; the caller decides
    which are living people. every hit is quarantined, since the pipeline
    cannot tell a living vicar from a dead one at capture."""
    found: list[dict] = []
    for match in _PHONE.finditer(text or ""):
        found.append({"kind": "phone", "value": match.group(0).strip()})
    for match in _EMAIL.finditer(text or ""):
        found.append({"kind": "email", "value": match.group(0)})
    regex_spans = [match.span() for match in _HONORIFIC_NAME.finditer(text or "")]
    for match in _HONORIFIC_NAME.finditer(text or ""):
        found.append({"kind": "person_name", "value": match.group(0).strip()})
    for start, end, value in explicit_title_hits(text or ""):
        if not any(left <= start and end <= right for left, right in regex_spans):
            found.append({"kind": "person_name", "value": value})
    return found


def redact_text(text: str, details: list[dict]) -> str:
    out = text or ""
    for item in sorted(details, key=lambda d: -len(d["value"])):
        out = out.replace(item["value"], f"[{item['kind']} withheld]")
    return out


BUNDLE_SCHEMA_PATH = HERE / "schemas" / "agent-review-bundle.v1.json"
SCREEN_POLICY_PATH = HERE / "schemas" / "screen-policy.v1.json"
CITED_NAME_RULE = "public_source_cited.v1"
_DIGEST = re.compile(r"[0-9a-f]{40}|[0-9a-f]{64}")
_ASCII_TOKEN = re.compile(r"[0-9A-Za-z]+")
_HEX_DIGITS = frozenset("0123456789abcdefABCDEF")


def hash_token_spans(text: str) -> list[tuple[int, int]]:
    """spans of 40- or 64-digit hex tokens anywhere in text: maximal runs of ASCII letters and
    digits, any case, so "sha256:<digest>", "Reference <DIGEST>" and a bare digest all count."""
    return [m.span() for m in _ASCII_TOKEN.finditer(text)
            if len(m.group(0)) in (40, 64) and set(m.group(0)) <= _HEX_DIGITS]


# second-level labels under which a country code's registrable domains sit (co.nz, org.uk);
# an approximation of the public suffix list, used only to shorten recorded hosts
_SECOND_LEVEL = frozenset({"ac", "co", "com", "edu", "gen", "geek", "gov", "govt", "health", "iwi", "kiwi",
                           "maori", "mil", "net", "nom", "org", "parliament", "school", "cri"})


def screened_domain(host: str) -> str:
    """the registrable part of a host, for a run-row counter: the last two labels, or three under
    a country code's second-level label. any label that carries a personal detail or a hex digest
    is replaced by its position (<label#N>), so the counter never records such text."""
    labels = [label for label in (host or "").lower().rstrip(".").split(".") if label]
    if not labels:
        return "<unparsed host>"
    keep = 3 if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in _SECOND_LEVEL else 2
    kept = labels[-keep:]
    return ".".join(f"<label#{index}>" if find_personal_details(label) or hash_token_spans(label) else label
                    for index, label in enumerate(kept))


def key_ref(obj: dict, key: str) -> str:
    """an opaque positional reference to an undeclared object key, so diagnostics and refusal
    records never copy the key itself: its index among the object's keys in code-point order."""
    return f"<key#{sorted(obj).index(key)}>"


def screen_hash_fields(schema_version: str) -> frozenset[str]:
    """the audited fields of a record type that may hold a hex digest (screen-policy.v1)."""
    policy = json.loads(SCREEN_POLICY_PATH.read_text(encoding="utf-8"))
    return frozenset(policy["hash_fields"][schema_version])


@lru_cache(maxsize=1)
def cited_name_rule() -> dict:
    return json.loads(SCREEN_POLICY_PATH.read_text(encoding="utf-8"))["cited_name_rules"][CITED_NAME_RULE]


_RULE_WHITESPACE = frozenset(chr(n) for n in (*range(9, 14), 0x20, 0x85, 0xA0, 0x1680,
                                                *range(0x2000, 0x200B), 0x2028, 0x2029,
                                                0x202F, 0x205F, 0x3000))
_DETECTOR_WHITESPACE = _RULE_WHITESPACE | {'\ufeff'}
_NAME_CHARS = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'-")


def explicit_title_hits(text: str) -> list[tuple[int, int, str]]:
    titles = sorted(cited_name_rule()['stop_titles'], key=len, reverse=True)
    hits = []
    for start in range(len(text)):
        if start and (text[start - 1] in _NAME_CHARS and text[start - 1] not in "'-" or '0' <= text[start - 1] <= '9' or text[start - 1] == '_'):
            continue
        for title in titles:
            if not text.startswith(title, start):
                continue
            pos = start + len(title)
            if pos < len(text) and text[pos] == '.':
                pos += 1
            if pos >= len(text) or text[pos] not in _DETECTOR_WHITESPACE:
                continue
            while pos < len(text) and text[pos] in _DETECTOR_WHITESPACE:
                pos += 1
            if pos >= len(text) or not 'A' <= text[pos] <= 'Z':
                continue
            while pos < len(text) and text[pos] in _NAME_CHARS:
                pos += 1
            hits.append((start, pos, text[start:pos]))
            break
    return hits


def rule_normal_form(text: str) -> str:
    out = []
    for char in text:
        if char in _RULE_WHITESPACE:
            if out and out[-1] != ' ':
                out.append(' ')
        elif char in '‘’':
            out.append("'")
        elif 'A' <= char <= 'Z':
            out.append(chr(ord(char) + 32))
        else:
            out.append(char)
    return ''.join(out).strip(' ')


_LEFT_BOUNDARY = frozenset(' \t\n\r("')
_RIGHT_BOUNDARY = frozenset(' \t\n\r.,;:!?)"')
_QUOTE_BOUNDARY = frozenset(' .,;:!?()[]"\'')
def parse_name(text: str, start: int) -> dict | None:
    if start < 0 or start >= len(text) or (start and text[start - 1] not in _LEFT_BOUNDARY):
        return None
    titles = sorted(cited_name_rule()['honorifics'], key=len, reverse=True)
    title = next((title for title in titles if text.startswith(title, start)), None)
    if title is None:
        return None
    pos = start + len(title)
    if pos < len(text) and text[pos] == '.':
        pos += 1
    if pos >= len(text) or text[pos] != ' ':
        return None
    pos += 1
    tokens = []
    stops = cited_name_rule()['stop_titles']

    def token_at(at):
        end = at
        while end < len(text) and text[end] in _NAME_CHARS:
            end += 1
        token = text[at:end]
        return (token, end) if len(token) >= 2 and 'A' <= token[0] <= 'Z' and token not in stops else None

    while len(tokens) < 3:
        token = token_at(pos)
        if token is None:
            break
        tokens.append(token[0])
        pos = token[1]
        if len(tokens) == 3 or pos >= len(text) or text[pos] != ' ' or token_at(pos + 1) is None:
            break
        pos += 1
    if not tokens or (len(tokens) == 3 and pos < len(text) and text[pos] == ' ' and token_at(pos + 1) is not None):
        return None
    if pos < len(text) and text[pos] not in _RIGHT_BOUNDARY:
        return None
    value = text[start:pos]
    bare = ' '.join(tokens)
    return {'start': start, 'end': pos, 'text': value, 'key': name_key(value), 'bare': bare, 'bare_key': name_key(bare)}


def parsed_names(text: str) -> list[dict]:
    return [name for start in range(len(text)) if (name := parse_name(text, start)) is not None]


def mask_names(text: str, admitted) -> str:
    chars = list(text)
    for name in parsed_names(text):
        if name['key'] in admitted:
            chars[name['start']:name['end']] = [' '] * (name['end'] - name['start'])
    return ''.join(chars)


def admitted_known_keys(admitted) -> frozenset[str]:
    bare = {key[key.index(' ') + 1:] for key in admitted if ' ' in key and len(key[key.index(' ') + 1:]) >= 3}
    return frozenset(admitted | bare)


def claim_field_path(norm: str) -> bool:
    return norm.removeprefix('dossier.') in {
        f'claims[].{field}' for field in cited_name_rule()['claim_fields']
    }


def name_key(text: str) -> str:
    return ''.join(chr(ord(c) + 32) if 'A' <= c <= 'Z' else c for c in text)


def quote_contains_name(quote: str, key: str) -> bool:
    form = rule_normal_form(quote)
    at = form.find(key)
    while at >= 0:
        end = at + len(key)
        if (at == 0 or form[at - 1] in _QUOTE_BOUNDARY) and (end == len(form) or form[end] in _QUOTE_BOUNDARY):
            return True
        at = form.find(key, at + 1)
    return False


def honorific_name_matches(text: str) -> list[tuple[int, int, str, bool]]:
    matches = []
    for match in _HONORIFIC_NAME.finditer(text):
        start, end = match.span()
        while end > start and text[end - 1] in _RULE_WHITESPACE:
            end -= 1
        value = text[start:end]
        parsed = parse_name(text, start)
        valid = parsed is not None and parsed['end'] == end
        matches.append((start, end, value, valid))
    return matches


def _claim_fields(claim):
    for path in cited_name_rule()['claim_fields']:
        node = claim
        for part in path.split('.'):
            node = node.get(part) if isinstance(node, dict) else None
        if isinstance(node, str):
            yield path, node


def covered_claim_names(claim, citable) -> dict[str, str]:
    quote = claim.get('quoted_support') if isinstance(claim, dict) else None
    source = claim.get('source') if isinstance(claim, dict) else None
    locator = source.get('locator') if isinstance(source, dict) else None
    if not isinstance(quote, str) or not rule_normal_form(quote) or not isinstance(locator, str) or not citable(locator):
        return {}
    covered = {}
    for _, field in _claim_fields(claim):
        for name in parsed_names(field):
            if quote_contains_name(quote, name['key']):
                covered.setdefault(name['key'], name['text'])
    return covered


def cited_name_coverage(dossier, citable) -> tuple[frozenset[str], list[str]]:
    claims = {}
    for claim in dossier.get('claims', []):
        if isinstance(claim, dict) and isinstance(claim.get('claim_id'), str):
            claims.setdefault(claim['claim_id'], claim)
    admitted = set()
    errors = []
    items = dossier.get('personal_details_quarantine', {}).get('items', [])
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        if 'admitted_by_rule' not in item:
            if any(field in item for field in ('field', 'start', 'end')):
                errors.append(f'personal_details_quarantine.items[{index}]: span requires a rule')
            continue
        claim_id = item.get('context_claim_id')
        claim = claims.get(claim_id) if isinstance(claim_id, str) else None
        field = item.get('field')
        start, end = item.get('start'), item.get('end')
        node = claim
        if isinstance(field, str) and field in cited_name_rule()['claim_fields']:
            for part in field.split('.'):
                node = node.get(part) if isinstance(node, dict) else None
        else:
            node = None
        quote = claim.get('quoted_support') if isinstance(claim, dict) else None
        locator = claim.get('source', {}).get('locator') if isinstance(claim, dict) and isinstance(claim.get('source'), dict) else None
        valid = (item.get('admitted_by_rule') == CITED_NAME_RULE and item.get('kind') == 'person_name'
                 and isinstance(quote, str) and bool(rule_normal_form(quote))
                 and isinstance(locator, str) and citable(locator) and isinstance(node, str)
                 and type(start) is int and type(end) is int and 0 <= start < end <= len(node))
        match = next((name for name in parsed_names(node) if name['start'] == start and name['end'] == end), None) if valid else None
        if not match or not quote_contains_name(quote, match['key']):
            errors.append(f'personal_details_quarantine.items[{index}]: rule {CITED_NAME_RULE} does not cover its claim')
        else:
            admitted.add(match['key'])
    return frozenset(admitted), errors


def has_unadmitted_detail(text: str, admitted=frozenset(), should_mask=False) -> bool:
    masked = mask_names(text, admitted) if should_mask else text
    return (bool(_PHONE.search(masked) or _EMAIL.search(masked)) or
            bool(_HONORIFIC_NAME.search(masked)) or bool(explicit_title_hits(masked)) or
            bool(admitted and any(key in rule_normal_form(masked) for key in admitted_known_keys(admitted))))


def _digest_exempt(norm: str, text: str, is_key: bool, hash_fields) -> bool:
    """a designated hash field whose whole value is a lowercase digest."""
    return not is_key and norm in hash_fields and _DIGEST.fullmatch(text) is not None


def _walk_screened(value, schema, root, on_string, overrides=None, path="", norm="", parent=None, key=None):
    """visit every string value and every object key the schema does not declare, whatever the
    schema says about the value: enum, const and pattern exempt nothing. on_string(parent, key,
    path, norm, text, is_key) may return a replacement for a value; norm is the path with every
    array index written as []. mirrors convex/lib/agentIntake.ts and pow-cli's walk."""
    schema = schema or {}
    while isinstance(schema.get("$ref"), str) and schema["$ref"].startswith("#/"):
        target = root
        for part in schema["$ref"][2:].split("/"):
            target = target.get(part, {}) if isinstance(target, dict) else {}
        schema = target or {}
    if isinstance(value, str):
        replacement = on_string(parent, key, path, norm, value, False)
        if replacement is not None and parent is not None:
            parent[key] = replacement
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _walk_screened(item, schema.get("items"), root, on_string, None, f"{path}[{index}]", f"{norm}[]", value, index)
    elif isinstance(value, dict):
        properties = schema.get("properties", {})
        for child_key, child in list(value.items()):
            declared = child_key in properties or (overrides and path == "" and child_key in overrides)
            # an undeclared key is named by position, never copied into a path
            label = child_key if declared else key_ref(value, child_key)
            child_path = f"{path}.{label}" if path else label
            child_norm = f"{norm}.{label}" if norm else label
            if overrides and path == "" and child_key in overrides:
                _walk_screened(child, overrides[child_key][0], overrides[child_key][1], on_string, None, child_path, child_norm, value, child_key)
            elif child_key in properties:
                _walk_screened(child, properties[child_key], root, on_string, None, child_path, child_norm, value, child_key)
            else:
                on_string(None, None, f"{child_path} (key)", child_norm, child_key, True)
                _walk_screened(child, {}, root, on_string, None, child_path, child_norm, value, child_key)


def screened_strings(value, schema, root, overrides=None, prefix="") -> list[tuple[str, str]]:
    """every string value and undeclared key of value, by path."""
    found: list[tuple[str, str]] = []
    _walk_screened(value, schema, root, lambda parent, key, path, norm, text, is_key: found.append((path, text)),
                   overrides, prefix, prefix)
    return found


def screen_findings(value, schema, root, hash_fields, overrides=None, prefix="", skip=(), admitted=frozenset()) -> list[tuple[str, str]]:
    """(path, reason) for every string or undeclared key that carries a phone number, email
    address or honorific-led name ("personal"), or is shaped as a hex hash outside a designated
    hash field ("hash"). paths under a skipped prefix are left to another check."""
    findings: list[tuple[str, str]] = []

    def check(parent, key, path, norm, text, is_key):
        if any(norm == s or norm.startswith(s + ".") or norm.startswith(s + "[") for s in skip):
            return None
        if has_unadmitted_detail(text, admitted, not is_key and claim_field_path(norm)):
            findings.append((path, "personal"))
        elif not _digest_exempt(norm, text, is_key, hash_fields) and hash_token_spans(text):
            findings.append((path, "hash"))
        return None

    _walk_screened(value, schema, root, check, overrides, prefix, prefix)
    return findings


def screen_errors(findings) -> list[str]:
    """the validators' messages for screen findings; they name paths, never the text."""
    return [f"potential personal details in {path} require human handling" if reason == "personal"
            else f"hash-shaped value in {path} is outside a designated hash field"
            for path, reason in findings]


def normalise_detail(text: str) -> str:
    """case-, width- and whitespace-insensitive form used to match a known quarantined value."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text or "").casefold()).strip()


def known_value_findings(value, known_values, schema=None, root=None, prefix="", admitted=frozenset()) -> list[str]:
    """paths of strings or keys, anywhere in value, that contain a known quarantined value
    (normalised) or the sha256 of one. the runner applies this to everything it transports."""
    needles = [(v, normalise_detail(v), sha256(v)) for v in known_values if isinstance(v, str) and v.strip()]
    found: list[str] = []

    def check(parent, key, path, norm, text, is_key):
        checked = mask_names(text, admitted) if not is_key and claim_field_path(norm) else text
        plain, lowered = normalise_detail(checked), checked.lower()
        if any((needle and needle in plain) or digest in lowered for _, needle, digest in needles):
            found.append(path)
        return None

    if needles:
        _walk_screened(value, schema or {}, root or {}, check, None, prefix, prefix)
    return found


def known_values(items, include_admitted=False) -> dict[str, str]:
    """every quarantined value to withhold, with its kind. a name caught with its honorific is
    withheld without it too, so "Rev'd Pat Example" also withholds "Pat Example"."""
    known: dict[str, str] = {}
    for item in items:
        if 'admitted_by_rule' in item and not include_admitted:
            continue
        value = item.get("value")
        if not isinstance(value, str) or not value.strip():
            continue
        known.setdefault(value, item["kind"])
        match = _HONORIFIC_NAME.fullmatch(value.strip()) if item["kind"] == "person_name" else None
        if match and len(match.group(1).strip()) >= 3:
            known.setdefault(match.group(1).strip(), "person_name")
    return known


def screen_spans(value, schema, root, hash_fields, known: dict[str, str] | None = None, prefix: str = "", admitted=frozenset()) -> list[dict]:
    """every screen finding as {path, detector, start, end}, never the text: a structured record
    that the later flag-and-hold review can reuse to propose redactions. offsets are Unicode
    code-point indices into the string at path. detectors: phone, email, person_name (patterns),
    hash_outside_field, known_value (a quarantined value, case/width/whitespace normalised) and
    known_value_hash (the sha256 of one)."""
    needles = [(value_, _known_pattern(value_), sha256(value_)) for value_ in (known or {}) if value_.strip()]
    found: list[dict] = []

    def check(parent, key, path, norm, text, is_key):
        checked = mask_names(text, admitted) if not is_key and claim_field_path(norm) else text
        spans = [("phone", m.span()) for m in _PHONE.finditer(checked)]
        spans += [("email", m.span()) for m in _EMAIL.finditer(checked)]
        regex_spans = [m.span() for m in _HONORIFIC_NAME.finditer(checked)]
        spans += [("person_name", span) for span in regex_spans]
        spans += [("person_name", (start, end)) for start, end, _ in explicit_title_hits(checked)
                  if not any(left <= start and end <= right for left, right in regex_spans)]
        if not _digest_exempt(norm, checked, is_key, hash_fields):
            spans += [("hash_outside_field", span) for span in hash_token_spans(checked)]
        for value_, pattern, digest in needles:
            if normalise_detail(value_) in normalise_detail(checked):
                match = pattern.search(checked)
                spans.append(("known_value", match.span() if match else (0, len(checked))))
            at = checked.lower().find(digest)
            if at >= 0:
                spans.append(("known_value_hash", (at, at + len(digest))))
        for detector, (start, end) in sorted(set(spans), key=lambda s: (s[1], s[0])):
            found.append({"path": path, "detector": detector, "start": start, "end": end})
        return None

    _walk_screened(value, schema, root, check, None, prefix, prefix)
    return found


def _known_pattern(value: str):
    return re.compile(r"\s+".join(re.escape(token) for token in value.split()), re.IGNORECASE)


def dossier_screen_schema() -> tuple[dict, dict]:
    """the schema an outgoing dossier is screened against: the review bundle's dossier."""
    root = json.loads(BUNDLE_SCHEMA_PATH.read_text(encoding="utf-8"))
    return root["$defs"]["dossier"], root


def _claim_context(claims, path):
    match = re.match(r"claims\[(\d+)\]", path)
    if match and int(match.group(1)) < len(claims):
        return claims[int(match.group(1))].get("claim_id")
    return None


def quarantine_dossier(dossier: dict, extra_names: list[str] | None = None, citable=None) -> dict:
    """move personal details out of every string of the dossier into the quarantine block,
    values kept (redacted=false). call redact_quarantine before committing. three passes: the
    cited-name pass (rule public_source_cited.v1) first marks each clergy-honorific name that a
    qualifying claim quotes from an allowlisted public source, and those names stay in place;
    the pattern pass then withholds phones, emails and every other honorific-led name; the
    known-value pass removes every recurrence of each withheld value (case, width and whitespace
    normalised), so a name caught once is withheld wherever it repeats. when a withheld value or
    an extra name removes the evidence for a cited name, that name is demoted and the passes are
    repeated without it. an undeclared object key cannot be redacted and stays refusable."""
    if citable is None:
        # intake imports lib at module load; defer this import to avoid a cycle.
        try:
            from . import intake
        except ImportError:
            import intake
        citable = intake.citable_locator_check(dossier)
    extra = [{"kind": "person_name", "value": n} for n in (extra_names or [])]
    schema, root = dossier_screen_schema()

    def covered_names(target) -> set[str]:
        covered: set[str] = set()
        for claim in target.get("claims", []):
            covered.update(covered_claim_names(claim, citable))
        return covered

    def redact_passes(target, admitted) -> list[dict]:
        """the pattern and known-value passes over target, in place; returns the withheld items."""
        items = [item for item in target.get("personal_details_quarantine", {}).get("items", [])
                 if "admitted_by_rule" not in item]
        claims = target.get("claims", [])

        def redact(parent, key, path, norm, text, is_key):
            if parent is None or path.startswith("personal_details_quarantine"):
                return None
            checked = mask_names(text, admitted) if not is_key and claim_field_path(norm) else text
            details = find_personal_details(checked)
            details += [e for e in extra if e["value"] in text]
            if not details:
                return None
            claim_id = _claim_context(claims, path)
            for d in details:
                item = {"kind": d["kind"], "context_claim_id": claim_id, "value": d["value"]}
                items.append(item)
            return redact_text(text, details)

        _walk_screened(target, schema, root, redact)
        admitted_items = [{'kind': 'person_name', 'value': name['text'], 'admitted_by_rule': CITED_NAME_RULE}
                          for claim in target.get('claims', []) for _, field in _claim_fields(claim)
                          for name in parsed_names(field) if name['key'] in admitted]
        ordered = sorted(known_values(items + admitted_items + extra, include_admitted=True).items(),
                         key=lambda pair: -len(pair[0]))

        def replace_segment(segment, path):
            out = segment
            for value, kind in ordered:
                if normalise_detail(value) not in normalise_detail(out):
                    continue
                replaced = _known_pattern(value).sub(f"[{kind} withheld]", out)
                out = replaced if normalise_detail(value) not in normalise_detail(replaced) else f"[{kind} withheld]"
                items.append({"kind": kind, "context_claim_id": _claim_context(claims, path), "value": value})
            return out

        def redact_known(parent, key, path, norm, text, is_key):
            if parent is None or path.startswith("personal_details_quarantine"):
                return None
            names = [name for name in parsed_names(text) if name['key'] in admitted] if not is_key and claim_field_path(norm) else []
            parts = []
            pos = 0
            for name in names:
                parts.append(replace_segment(text[pos:name['start']], path))
                parts.append(name['text'])
                pos = name['end']
            parts.append(replace_segment(text[pos:], path))
            out = ''.join(parts)
            return out if out != text else None

        _walk_screened(target, schema, root, redact_known)
        return items

    # find the stable set of cited names on copies; admissions only shrink, so this ends.
    admitted = covered_names(dossier)
    while admitted:
        trial = copy.deepcopy(dossier)
        redact_passes(trial, admitted)
        demoted = admitted - covered_names(trial)
        if not demoted:
            break
        admitted -= demoted
    # the final passes run on the dossier itself, so callers' references stay valid.
    items = redact_passes(dossier, admitted)
    rule_items = []
    for claim in dossier.get("claims", []):
        quote = claim.get('quoted_support')
        # only a claim that itself qualifies (quotation and citable source) may carry a rule item
        if not isinstance(quote, str) or not covered_claim_names(claim, citable):
            continue
        seen_names = set()
        for field, value_text in _claim_fields(claim):
            for name in parsed_names(value_text):
                key = name['key']
                if key in admitted and key not in seen_names and quote_contains_name(quote, key):
                    rule_items.append({"kind": "person_name", "context_claim_id": claim.get("claim_id"),
                                       "value": name['text'], "admitted_by_rule": CITED_NAME_RULE,
                                       "field": field, "start": name['start'], "end": name['end']})
                    seen_names.add(key)
    # dedupe by (kind, value, claim, rule)
    seen = set()
    unique = []
    for item in rule_items + items:
        key = (item["kind"], item.get("value"), item.get("context_claim_id"), item.get("admitted_by_rule"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    dossier["personal_details_quarantine"] = {
        "redacted": False,
        "item_count": len(unique),
        "items": unique,
        "note": "values held in the run directory only; redact_quarantine strips them before commit",
    }
    return dossier


def redact_quarantine(dossier: dict) -> dict:
    """replace each quarantined value by its sha256 for the private dossier copy.
    an item with neither a value nor a hash is refused, since it could not show recurrence."""
    block = dossier.get("personal_details_quarantine", {"items": []})
    stripped = []
    for item in block.get("items", []):
        entry = {"kind": item["kind"], "context_claim_id": item.get("context_claim_id")}
        if 'admitted_by_rule' in item:
            entry['admitted_by_rule'] = item['admitted_by_rule']
            for field in ('field', 'start', 'end'):
                entry[field] = item[field]
        if "value" in item:
            entry["value_sha256"] = sha256(item["value"])
        elif re.fullmatch(r"[0-9a-f]{64}", str(item.get("value_sha256", ""))):
            entry["value_sha256"] = item["value_sha256"]
        else:
            raise ValueError("quarantine item has neither a value nor a value hash")
        stripped.append(entry)
    dossier["personal_details_quarantine"] = {
        "redacted": True,
        "item_count": len(stripped),
        "items": stripped,
        "note": "personal details stripped before commit; hashes let a later run recognise recurrence",
    }
    return dossier


def bundle_quarantine(dossier: dict) -> dict:
    """reduce a redacted quarantine block to the review form: kind, claim and any rule flag.
    no value and no hash of a value leaves the private copy."""
    block = dossier.get("personal_details_quarantine", {"items": []})
    if not block.get("redacted") or any("value" in item for item in block.get("items", [])):
        raise ValueError("quarantine block must be redacted before it enters a bundle")
    items = [{**{"kind": item["kind"], "context_claim_id": item.get("context_claim_id")},
              **({field: item[field] for field in ('admitted_by_rule', 'field', 'start', 'end')}
                 if 'admitted_by_rule' in item else {})}
             for item in block.get("items", [])]
    dossier["personal_details_quarantine"] = {
        "redacted": True,
        "item_count": len(items),
        "items": items,
        "note": "personal details withheld; the kind and claim of each are recorded, and hashes stay in the private dossier copy",
    }
    return dossier


# ---------------------------------------------------------------------------
# geometry


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# agreement between readers

_YEAR = re.compile(r"(1[6-9]\d\d|20\d\d)")

# claim types whose value is a date or a year
DATE_TYPES = {"start_date", "building_date", "renovation", "worship_active_asof", "worship_ended", "closure_event", "sale_or_disposal", "land_or_consecration"}
LOCATION_TOLERANCE_M = 75.0
DATE_TOLERANCE_YEARS = 1


# compare only explicit event bounds; incidental years in prose remain uninterpreted.
def _date_bounds(claim: dict):
    start, end = claim.get("date_start"), claim.get("date_end")
    if not start or claim.get("date_precision") == "unknown":
        return None
    end = end or start
    if not all(re.fullmatch(r"[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?", x) for x in (start, end)):
        return None
    try:
        for value in (start, end):
            parts = [int(x) for x in value.split("-")]
            date(*((parts + [1, 1])[:3]))
    except ValueError:
        return None
    if start > end:
        return None
    return start, end


def _status_group(value: str) -> str:
    v = normalise_text(value)
    if "inactive" in v or "closed" in v or "ended" in v or "former" in v:
        return "inactive"
    if "active" in v or "open" in v or "in use" in v:
        return "active"
    return v


# claim types with one true value per place, on which readers can agree or
# disagree; dated observations (worship active in 1924, in 2013, in 2026) are
# each true and are reported per reader, not compared
SINGLE_VALUED_TYPES = {"name", "address", "religion", "denomination", "start_date", "building_date", "worship_ended",
                       "closure_event", "sale_or_disposal", "land_or_consecration", "location", "current_status"}

_COORD = re.compile(r"(-?\d{1,2}\.\d{3,}),?\s+(-?\d{1,3}\.\d{3,})")


def _coords(claim: dict) -> tuple[float, float] | None:
    structured = claim.get("value_structured") or {}
    try:
        return float(structured["latitude"]), float(structured["longitude"])
    except (KeyError, TypeError, ValueError):
        pass
    m = _COORD.search(str(claim.get("value") or ""))
    if m:
        lat, lon = float(m.group(1)), float(m.group(2))
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon
    return None


def claims_agree(a: dict, b: dict) -> tuple[bool | None, str]:
    """same claim type, do two readers' values agree within tolerance.
    None means the pair cannot be compared (a value neither side parses)."""
    ctype = a["claim_type"]
    if ctype == "current_status":
        if "unknown" in (a["value"], b["value"]):
            return None, "unknown status"
        return _status_group(a["value"]) == _status_group(b["value"]), "status group"
    if ctype in DATE_TYPES:
        bounds_a, bounds_b = _date_bounds(a), _date_bounds(b)
        if bounds_a is None or bounds_b is None:
            return None, "missing or ambiguous structured event bounds"
        if any(len(x) != len(y) for x, y in zip(bounds_a, bounds_b)):
            return None, "different date granularity"
        agree = all(abs(int(x) - int(y)) <= DATE_TOLERANCE_YEARS if len(x) == 4 else x == y
                    for x, y in zip(bounds_a, bounds_b))
        return agree, f"event bounds {bounds_a} vs {bounds_b}"
    if ctype == "location":
        ca, cb = _coords(a), _coords(b)
        if ca is None or cb is None:
            return None, "coordinates missing on one side"
        d = haversine_m(ca[0], ca[1], cb[0], cb[1])
        return d <= LOCATION_TOLERANCE_M, f"{d:.0f} m apart"
    ta, tb = set(tokens(a["value"])), set(tokens(b["value"]))
    if not ta or not tb:
        return None, "empty value"
    if ta == tb or a["value"].strip().lower() == b["value"].strip().lower():
        return True, "exact"
    if len(ta) == 1 and len(tb) == 1:
        # christian / christianity, anglican / anglicans: a shared stem counts
        wa, wb = next(iter(ta)), next(iter(tb))
        stem = min(len(wa), len(wb), 6)
        return wa[:stem] == wb[:stem], "stem"
    jaccard = len(ta & tb) / len(ta | tb)
    contained = ta <= tb or tb <= ta
    return (jaccard >= 0.5 or contained), f"jaccard {jaccard:.2f}"


def compute_agreement(dossiers: list[dict]) -> dict:
    """retain every claim and require complete, comparable readings for agreement.
    contradictions, missing readers, and unparseable values are escalated."""
    readers = [d["run_manifest"]["backend"] + ":" + d["provenance"].get("produced_by", d["run_manifest"]["run_id"]) for d in dossiers]
    by_type: dict[str, list[tuple[str, dict]]] = {}
    for reader, dossier in zip(readers, dossiers):
        for claim in dossier.get("claims", []):
            ctype = claim["claim_type"]
            if ctype in ("osm_object_version", "other"):
                continue
            by_type.setdefault(ctype, []).append((reader, claim))
        # the assessment as a status claim
        assessment = dossier.get("status_assessment", {})
        if assessment.get("current_status"):
            by_type.setdefault("current_status", []).append((reader, {
                "claim_type": "current_status",
                "value": assessment["current_status"],
            }))
        loc = dossier.get("candidate_location", {})
        if loc.get("latitude") is not None and loc.get("longitude") is not None:
            by_type.setdefault("candidate_location", []).append((reader, {
                "claim_type": "location",
                "value": f"{loc['latitude']},{loc['longitude']}",
                "value_structured": {"latitude": loc["latitude"], "longitude": loc["longitude"]},
            }))

    rows = []
    agreed = majority = disagreed = single = not_comparable = 0
    observations = []
    for ctype, entries in sorted(by_type.items()):
        values = [{"reader": r, "claim_id": c.get("claim_id"), "value": c.get("value"), "date_start": c.get("date_start"), "date_end": c.get("date_end")} for r, c in entries]
        compare_type = "location" if ctype == "candidate_location" else ctype
        if compare_type not in SINGLE_VALUED_TYPES:
            # dated observations: reported per reader, never a disagreement
            observations.append({"claim_type": ctype, "outcome": "observation", "values": values, "detail": "dated observations are complementary, not compared"})
            continue
        if len({r for r, _ in entries}) < 2:
            single += 1
            rows.append({"claim_type": ctype, "outcome": "single_reader", "values": values, "detail": ""})
            continue
        notes = []
        verdicts = []
        missing_comparison = len({r for r, _ in entries}) < len(readers)
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                ok, note = claims_agree(entries[i][1], entries[j][1])
                notes.append(f"{entries[i][0]} vs {entries[j][0]}: {note}")
                if ok is None:
                    missing_comparison = True
                else:
                    verdicts.append(ok)
        if any(ok is False for ok in verdicts):
            disagreed += 1
            outcome = "disagree"
        elif missing_comparison or not verdicts:
            not_comparable += 1
            outcome = "not_comparable"
        else:
            agreed += 1
            outcome = "agree"
        rows.append({"claim_type": ctype, "outcome": outcome, "values": values, "detail": "; ".join(notes)})
    compared = agreed + majority + disagreed
    return {
        "readers": readers,
        "claim_types_compared": compared,
        "agreed": agreed,
        "majority": majority,
        "disagreed": disagreed,
        "single_reader": single,
        "not_comparable": not_comparable,
        # strict: every pair agreed; lenient: a majority of pairs agreed
        "agreement_rate": round(agreed / compared, 3) if compared else None,
        "majority_rate": round((agreed + majority) / compared, 3) if compared else None,
        "agreement_version": "agreement.v2",
        "escalate_to_human": [r["claim_type"] for r in rows if r["outcome"] != "agree"],
        "rows": rows + observations,
    }


def read_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
