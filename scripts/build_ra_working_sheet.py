#!/usr/bin/env python3
"""Build the RA pilot Google Sheets import workbook.

This script turns the CSV tabs in docs/templates/ra-historical-site-evidence
into a single .xlsx workbook that can be imported into Google Drive as a
native Google Sheet. It uses only the Python standard library so the workflow
does not add spreadsheet-generation dependencies to the project.
"""

from __future__ import annotations

import argparse
import csv
import html
from datetime import UTC, datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


REPO_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = REPO_ROOT / "docs" / "templates" / "ra-historical-site-evidence"
DEFAULT_OUTPUT = (
    REPO_ROOT / "exports" / "ra-working-sheet" / "nz-pow-ra-pilot-working-sheet.xlsx"
)

TEMPLATE_TABS = [
    ("site_evidence_wide", "site_evidence_wide.csv"),
    ("controlled_vocabularies", "controlled_vocabularies.csv"),
    ("sources", "sources.csv"),
    ("site_observations", "site_observations.csv"),
    ("site_lifecycle_events", "site_lifecycle_events.csv"),
    ("candidate_matches", "candidate_matches.csv"),
    ("review_notes", "review_notes.csv"),
]

VALIDATION_FIELDS = {
    "source_type",
    "site_type",
    "geocoding_basis",
    "geocoding_confidence",
    "match_method",
    "match_confidence",
    "visual_verification_source",
    "existence_status",
    "worship_use_status",
    "public_access_status",
    "quality_flag",
    "review_status",
    "privacy_flag",
    "licence_flag",
}

README_ROWS = [
    ["NZ places of worship RA pilot working sheet"],
    [""],
    [
        "Purpose",
        "Record source-backed evidence for New Zealand places of worship at 2013, 2018, and 2023, plus lifecycle dates when sources support them.",
    ],
    [
        "RA role",
        "Use the NZ verification map to identify a task, collect evidence, and enter one row per source-place record in site_evidence_wide.",
    ],
    [
        "Save location",
        "This project-owned Google Sheet is the saved working copy. Do not put private or restricted source material into GitHub.",
    ],
    [
        "Main tab",
        "Use site_evidence_wide for the pilot unless the project team asks you to use the normalised reference tabs.",
    ],
    [
        "Target years",
        "Use present, absent, uncertain, or not_assessed for 2013, 2018, and 2023 only when the source supports the judgement.",
    ],
    [
        "No approval",
        "Rows entered here are evidence proposals. They do not change the public map or the master database until reviewed.",
    ],
]


def column_name(index: int) -> str:
    name = ""
    current = index
    while current:
        current, remainder = divmod(current - 1, 26)
        name = chr(65 + remainder) + name
    return name


def cell_ref(row_index: int, column_index: int) -> str:
    return f"{column_name(column_index)}{row_index}"


def sheet_xml(rows: list[list[str]], *, freeze_first_row: bool, add_filter: bool) -> str:
    width = max((len(row) for row in rows), default=1)
    height = max(len(rows), 1)
    dimension = f"A1:{cell_ref(height, width)}"

    sheet_view = '<sheetView workbookViewId="0"/>'
    if freeze_first_row:
        sheet_view = (
            '<sheetView workbookViewId="0">'
            '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            '<selection pane="bottomLeft"/>'
            "</sheetView>"
        )

    sheet_data = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            if value == "":
                continue
            style = ' s="1"' if row_index == 1 else ""
            escaped = html.escape(str(value), quote=False)
            cells.append(
                f'<c r="{cell_ref(row_index, column_index)}" t="inlineStr"{style}>'
                f"<is><t>{escaped}</t></is></c>"
            )
        sheet_data.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    auto_filter = f'<autoFilter ref="A1:{cell_ref(1000, width)}"/>' if add_filter else ""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="{dimension}"/>'
        f"<sheetViews>{sheet_view}</sheetViews>"
        '<sheetFormatPr defaultRowHeight="15"/>'
        f"<sheetData>{''.join(sheet_data)}</sheetData>"
        f"{auto_filter}"
        "</worksheet>"
    )


def sheet_xml_with_validations(
    rows: list[list[str]],
    *,
    freeze_first_row: bool,
    add_filter: bool,
    validation_formulas: dict[int, str],
) -> str:
    xml = sheet_xml(rows, freeze_first_row=freeze_first_row, add_filter=add_filter)
    if not validation_formulas:
        return xml

    validations = []
    for column_index, formula in sorted(validation_formulas.items()):
        column = column_name(column_index)
        validations.append(
            '<dataValidation type="list" allowBlank="1" showInputMessage="1" '
            f'sqref="{column}2:{column}1000">'
            f"<formula1>{html.escape(formula, quote=False)}</formula1>"
            "</dataValidation>"
        )
    data_validations = (
        f'<dataValidations count="{len(validations)}">{"".join(validations)}</dataValidations>'
    )
    return xml.replace("</worksheet>", f"{data_validations}</worksheet>")


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = "".join(
        f'<sheet name="{html.escape(name, quote=True)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{sheets}</sheets>"
        "</workbook>"
    )


def workbook_relationships(sheet_count: int) -> str:
    relationships = []
    for index in range(1, sheet_count + 1):
        relationships.append(
            f'<Relationship Id="rId{index}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{index}.xml"/>'
        )
    relationships.append(
        f'<Relationship Id="rId{sheet_count + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{''.join(relationships)}"
        "</Relationships>"
    )


def content_types(sheet_count: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    overrides.extend(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        f"{''.join(overrides)}"
        "</Types>"
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        '<font><sz val="11"/><name val="Arial"/></font>'
        '<font><b/><sz val="11"/><name val="Arial"/></font>'
        "</fonts>"
        '<fills count="3">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F0E8"/><bgColor indexed="64"/></patternFill></fill>'
        "</fills>"
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
        "</cellXfs>"
        "</styleSheet>"
    )


def package_relationships() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def core_properties() -> str:
    created = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>NZ PoW RA Pilot Working Sheet</dc:title>"
        "<dc:creator>Places of Worship project</dc:creator>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def app_properties(sheet_names: list[str]) -> str:
    titles = "".join(f"<vt:lpstr>{html.escape(name)}</vt:lpstr>" for name in sheet_names)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>Places of Worship</Application>"
        "<DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>"
        f'<TitlesOfParts><vt:vector size="{len(sheet_names)}" baseType="lpstr">{titles}</vt:vector></TitlesOfParts>'
        "</Properties>"
    )


def read_csv_rows(path: Path) -> list[list[str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.reader(handle))


def validation_field_for_header(header: str) -> str | None:
    if header.endswith("_date_precision"):
        return "date_precision"
    if header.startswith("target_year_") and header.endswith("_status"):
        return "target_year_status"
    if header in VALIDATION_FIELDS:
        return header
    return None


def controlled_vocabulary_ranges(vocabulary_rows: list[list[str]]) -> dict[str, tuple[int, int]]:
    ranges: dict[str, tuple[int, int]] = {}
    for row_index, row in enumerate(vocabulary_rows[1:], start=2):
        if not row:
            continue
        field = row[0]
        if field in ranges:
            start, _end = ranges[field]
            ranges[field] = (start, row_index)
        else:
            ranges[field] = (row_index, row_index)
    return ranges


def validation_formulas_for_site_evidence(
    site_evidence_rows: list[list[str]],
    vocabulary_rows: list[list[str]],
) -> dict[int, str]:
    if not site_evidence_rows:
        return {}
    vocab_ranges = controlled_vocabulary_ranges(vocabulary_rows)
    formulas = {}
    for column_index, header in enumerate(site_evidence_rows[0], start=1):
        field = validation_field_for_header(header)
        if field is None or field not in vocab_ranges:
            continue
        start, end = vocab_ranges[field]
        formulas[column_index] = f"'controlled_vocabularies'!$B${start}:$B${end}"
    return formulas


def build_workbook(output_path: Path) -> None:
    sheets = [("README", README_ROWS)]
    sheets.extend(
        (sheet_name, read_csv_rows(TEMPLATE_DIR / csv_name))
        for sheet_name, csv_name in TEMPLATE_TABS
    )
    sheet_names = [sheet_name for sheet_name, _rows in sheets]
    rows_by_sheet = dict(sheets)
    validation_formulas = validation_formulas_for_site_evidence(
        rows_by_sheet["site_evidence_wide"],
        rows_by_sheet["controlled_vocabularies"],
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output_path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types(len(sheets)))
        archive.writestr("_rels/.rels", package_relationships())
        archive.writestr("docProps/core.xml", core_properties())
        archive.writestr("docProps/app.xml", app_properties(sheet_names))
        archive.writestr("xl/workbook.xml", workbook_xml(sheet_names))
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_relationships(len(sheets)))
        archive.writestr("xl/styles.xml", styles_xml())
        for index, (sheet_name, rows) in enumerate(sheets, start=1):
            if sheet_name == "site_evidence_wide":
                worksheet_xml = sheet_xml_with_validations(
                    rows,
                    freeze_first_row=True,
                    add_filter=True,
                    validation_formulas=validation_formulas,
                )
            else:
                worksheet_xml = sheet_xml(
                    rows,
                    freeze_first_row=sheet_name != "README",
                    add_filter=sheet_name != "README",
                )
            archive.writestr(
                f"xl/worksheets/sheet{index}.xml",
                worksheet_xml,
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Path for the generated .xlsx workbook. Defaults to a gitignored exports/ path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_workbook(args.output)
    try:
        display_path = args.output.relative_to(REPO_ROOT)
    except ValueError:
        display_path = args.output
    print(f"Wrote {display_path}")


if __name__ == "__main__":
    main()
