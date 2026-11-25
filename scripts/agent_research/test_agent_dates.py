"""Deep-time stage 1 in the agent tools (merge review of pull request #240, finding 6).

The pre-submit checks agree with ingestion (convex/lib/agentIntake.ts): an agent's dated
claim meets the country's floor unless the agent confirmed the date; a documentary source's
own date keeps 1000 to 2100, or falls before 1000 with the agent's confirmation; and the
dossier builder carries the agent's confirmations.
"""
import json
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import intake  # noqa: E402
import research_place  # noqa: E402

FULL_WIDTH_0920 = ''.join(chr(0xFF10 + int(digit)) for digit in '0920')


def fixture():
    return json.loads((HERE / 'fixtures/internal-review-bundle.json').read_text())


def with_claim(**changes):
    bundle = fixture()
    claim = bundle['dossier']['claims'][0]
    claim.update({'date_start': None, 'date_end': None, 'date_precision': 'unknown'})
    source = changes.pop('source', None)
    claim.update(changes)
    if source is not None:
        claim['source'].update(source)
    return bundle


def agent(*dates):
    return [{'date': date, 'confirmed_by': 'agent'} for date in dates]


class AgentDatesTest(unittest.TestCase):
    def errors(self, bundle):
        return intake.validate_bundle(intake.parse_json(json.dumps(bundle)))

    def test_a_claim_below_the_floor_needs_the_agents_confirmation(self):
        self.assertTrue(any('earlier than 1600' in e for e in self.errors(with_claim(date_start='1590', date_precision='year'))))
        self.assertTrue(self.errors(with_claim(date_start='1590', date_precision='year', confirmed_dates=agent('1591'))))
        self.assertEqual(self.errors(with_claim(date_start='1590', date_precision='year', confirmed_dates=agent('1590'))), [])

    def test_a_documentary_source_date_keeps_the_observation_range_or_is_confirmed(self):
        self.assertTrue(any('source_date' in e for e in self.errors(with_claim(source={'source_date': '0731'}))))
        self.assertEqual(self.errors(with_claim(source={'source_date': '0731'}, confirmed_dates=agent('0731'))), [])
        self.assertTrue(any('source_date' in e for e in self.errors(with_claim(source={'source_date': '2101-01-01'}))))

    def test_partial_dates_take_ascii_digits_only(self):
        with self.assertRaises(ValueError):
            intake.date_bounds(FULL_WIDTH_0920)

    def test_the_floor_table_matches_the_backend(self):
        source = (ROOT / 'convex/lib/countryYears.ts').read_text()
        table = source[source.index('DATE_FLOOR_YEARS'):]
        for code, floor in intake.DATE_FLOOR_YEARS.items():
            self.assertEqual(int(re.search(rf'\b{code}: (\d+),', table).group(1)), floor, code)
        self.assertEqual(int(re.search(r'DEFAULT_DATE_FLOOR_YEAR = (\d+);', source).group(1)), intake.DEFAULT_DATE_FLOOR_YEAR)

    def test_the_dossier_builder_carries_the_agents_confirmations(self):
        place = {'place_ref': 'osm:node/1', 'name': 'Test chapel', 'country_code': 'NZ', 'seed_latitude': -41.3, 'seed_longitude': 174.8}
        output = {'claims': [
            {'claim_type': 'start_date', 'value': '1590', 'date_start': '1590', 'date_precision': 'year',
             'source': {'source_name': 'Parish history', 'locator': 'https://example.org/history', 'source_date': '0731'},
             'confirmed_dates': [{'date': '1590', 'confirmed_by': 'agent'}, {'date': '0731', 'confirmed_by': 'agent'},
                                 {'date': '1600', 'confirmed_by': 'agent'}, {'date': '1590', 'confirmed_by': 'contributor'}]},
            {'claim_type': 'name', 'value': 'Test chapel', 'source': {'source_name': 'Sign', 'locator': 'https://example.org/sign'}},
        ]}
        dossier = research_place.assemble_dossier(place, output, 'claude', 'sonnet', {}, '2026-11-25T00:00:00Z', '2026-11-25T00:01:00Z', 60.0, 'run-1', 'nz-v1')
        self.assertEqual(dossier['claims'][0]['confirmed_dates'], agent('1590', '0731'))
        self.assertNotIn('confirmed_dates', dossier['claims'][1])


if __name__ == '__main__':
    unittest.main()
