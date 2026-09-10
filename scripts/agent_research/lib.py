"""shared helpers for the agent research pilot: dossier schema validation,
text normalisation, personal-details redaction, distance, agreement.

standard library only. the validator covers the json-schema subset the
dossier schema uses (type, enum, const, required, properties,
additionalProperties, items, $ref into $defs, pattern, minimum, maximum,
minLength, maxLength); it is not a general implementation.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from datetime import datetime, timezone
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
        errors.append(f"{path}: {instance!r} not in enum")
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(instance, t) for t in types):
            errors.append(f"{path}: expected type {types}, got {type(instance).__name__}")
            return errors
    if isinstance(instance, str):
        if "pattern" in schema and re.search(schema["pattern"], instance) is None:
            errors.append(f"{path}: {instance!r} does not match {schema['pattern']}")
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(f"{path}: shorter than {schema['minLength']}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: longer than {schema['maxLength']}")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: {instance} below minimum {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: {instance} above maximum {schema['maximum']}")
    if isinstance(instance, dict):
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing required {key!r}")
        props = schema.get("properties", {})
        for key, value in instance.items():
            if key in props:
                errors.extend(validate(value, props[key], root, f"{path}.{key}"))
            elif schema.get("additionalProperties", True) is False:
                errors.append(f"{path}: unexpected property {key!r}")
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
    for match in _HONORIFIC_NAME.finditer(text or ""):
        found.append({"kind": "person_name", "value": match.group(0).strip()})
    return found


def redact_text(text: str, details: list[dict]) -> str:
    out = text or ""
    for item in sorted(details, key=lambda d: -len(d["value"])):
        out = out.replace(item["value"], f"[{item['kind']} withheld]")
    return out


def quarantine_dossier(dossier: dict, extra_names: list[str] | None = None) -> dict:
    """move personal details out of claim text into the quarantine block,
    values kept (redacted=false). call redact_quarantine before committing."""
    items = list(dossier.get("personal_details_quarantine", {}).get("items", []))
    extra = [{"kind": "person_name", "value": n} for n in (extra_names or [])]
    for claim in dossier.get("claims", []):
        for field in ("value", "quoted_support", "note"):
            text = claim.get(field)
            if not text:
                continue
            details = find_personal_details(text) + [e for e in extra if e["value"] in text]
            if not details:
                continue
            claim[field] = redact_text(text, details)
            for d in details:
                items.append({"kind": d["kind"], "context_claim_id": claim["claim_id"], "value": d["value"]})
    for entry in dossier.get("osm_version_chain", []):
        for field in ("tags_summary", "change_note"):
            text = entry.get(field)
            if not text:
                continue
            details = find_personal_details(text) + [e for e in extra if e["value"] in text]
            if details:
                entry[field] = redact_text(text, details)
                for d in details:
                    items.append({"kind": d["kind"], "context_claim_id": None, "value": d["value"]})
    assessment = dossier.get("status_assessment", {})
    for field in ("basis", "osm_stale_basis"):
        text = assessment.get(field)
        if text:
            details = find_personal_details(text) + [e for e in extra if e["value"] in text]
            if details:
                assessment[field] = redact_text(text, details)
                for d in details:
                    items.append({"kind": d["kind"], "context_claim_id": None, "value": d["value"]})
    # dedupe by (kind, value, claim)
    seen = set()
    unique = []
    for item in items:
        key = (item["kind"], item.get("value"), item.get("context_claim_id"))
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
    block = dossier.get("personal_details_quarantine", {"items": []})
    stripped = []
    for item in block.get("items", []):
        entry = {"kind": item["kind"], "context_claim_id": item.get("context_claim_id")}
        if "value" in item:
            entry["value_sha256"] = sha256(item["value"])
        elif "value_sha256" in item:
            entry["value_sha256"] = item["value_sha256"]
        stripped.append(entry)
    dossier["personal_details_quarantine"] = {
        "redacted": True,
        "item_count": len(stripped),
        "items": stripped,
        "note": "personal details stripped before commit; hashes let a later run recognise recurrence",
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


def _years(claim: dict) -> list[int]:
    years = []
    for field in ("date_start", "date_end", "value"):
        text = claim.get(field)
        if text:
            years.extend(int(y) for y in _YEAR.findall(str(text)))
    return years


def _status_group(value: str) -> str:
    v = normalise_text(value)
    if "inactive" in v or "closed" in v or "ended" in v or "former" in v:
        return "inactive"
    if "active" in v or "open" in v or "in use" in v:
        return "active"
    return v


def claims_agree(a: dict, b: dict) -> tuple[bool, str]:
    """same claim type, do two readers' values agree within tolerance"""
    ctype = a["claim_type"]
    if ctype in DATE_TYPES:
        ya, yb = _years(a), _years(b)
        if ya and yb:
            agree = min(abs(x - y) for x in ya for y in yb) <= DATE_TOLERANCE_YEARS
            return agree, f"years {sorted(set(ya))} vs {sorted(set(yb))}"
        return False, "no parseable year on one side"
    if ctype == "location":
        sa, sb = a.get("value_structured") or {}, b.get("value_structured") or {}
        try:
            d = haversine_m(float(sa["latitude"]), float(sa["longitude"]), float(sb["latitude"]), float(sb["longitude"]))
        except (KeyError, TypeError, ValueError):
            return False, "coordinates missing on one side"
        return d <= LOCATION_TOLERANCE_M, f"{d:.0f} m apart"
    if ctype in ("worship_active_asof",):
        return _status_group(a["value"]) == _status_group(b["value"]), "status group"
    ta, tb = set(tokens(a["value"])), set(tokens(b["value"]))
    if not ta or not tb:
        return False, "empty value"
    if ta == tb or a["value"].strip().lower() == b["value"].strip().lower():
        return True, "exact"
    jaccard = len(ta & tb) / len(ta | tb)
    contained = ta <= tb or tb <= ta
    return (jaccard >= 0.5 or contained), f"jaccard {jaccard:.2f}"


def compute_agreement(dossiers: list[dict]) -> dict:
    """per claim type, whether the readers that made a claim of that type
    agree. a type with one reader is single_reader; with two or more, agree
    when every pair agrees, disagree otherwise. status and location are
    compared from the dossier's assessment and candidate blocks as well."""
    readers = [d["run_manifest"]["backend"] + ":" + d["provenance"].get("produced_by", d["run_manifest"]["run_id"]) for d in dossiers]
    by_type: dict[str, list[tuple[str, dict]]] = {}
    for reader, dossier in zip(readers, dossiers):
        seen_types = set()
        for claim in dossier.get("claims", []):
            ctype = claim["claim_type"]
            if ctype in ("osm_object_version", "other"):
                continue
            # one representative claim per reader per type: the highest confidence first
            if ctype in seen_types:
                continue
            seen_types.add(ctype)
            by_type.setdefault(ctype, []).append((reader, claim))
        # the assessment as a status claim
        assessment = dossier.get("status_assessment", {})
        if assessment.get("current_status"):
            by_type.setdefault("current_status", []).append((reader, {
                "claim_type": "worship_active_asof",
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
    agreed = disagreed = single = 0
    for ctype, entries in sorted(by_type.items()):
        values = [{"reader": r, "value": c.get("value")} for r, c in entries]
        if len(entries) < 2:
            single += 1
            rows.append({"claim_type": ctype, "outcome": "single_reader", "values": values, "detail": ""})
            continue
        notes = []
        all_agree = True
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                ok, note = claims_agree(entries[i][1], entries[j][1])
                notes.append(f"{entries[i][0]} vs {entries[j][0]}: {note}")
                all_agree = all_agree and ok
        if all_agree:
            agreed += 1
        else:
            disagreed += 1
        rows.append({
            "claim_type": ctype,
            "outcome": "agree" if all_agree else "disagree",
            "values": values,
            "detail": "; ".join(notes),
        })
    compared = agreed + disagreed
    return {
        "readers": readers,
        "claim_types_compared": compared,
        "agreed": agreed,
        "disagreed": disagreed,
        "single_reader": single,
        "agreement_rate": round(agreed / compared, 3) if compared else None,
        "escalate_to_human": [r["claim_type"] for r in rows if r["outcome"] == "disagree"],
        "rows": rows,
    }


def read_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
