//! Partial dates under stage 1 of the deep-time date format
//! (docs/development/deep-time-date-format-brief-2026-11-24.md, rulings 1 to 8 of
//! section 10). A partial date is YYYY, YYYY-MM or YYYY-MM-DD with ASCII digits and a
//! real Gregorian calendar date. A year below 1000 is written with four digits (0920)
//! and the year 0000 is refused in every form until stage 2 gives it a meaning.
//!
//! pow-cli checks dates downstream of the backend, where a date below a country's floor
//! or below the observation range may already carry its confirmation, so every check
//! here is the historical one: any real date from the year 0001. The tests run every
//! check against the shared fixture, schemas/fixtures/partial-dates.v1.json.

use chrono::NaiveDate;

/// The first and last calendar day a partial date covers.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PartialDateBounds {
    pub earliest: NaiveDate,
    pub latest: NaiveDate,
}

fn digits(part: &str, width: usize) -> Option<u32> {
    if part.len() != width || !part.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    part.parse().ok()
}

/// Parses a historical partial date into the days it covers; None for anything else.
pub fn parse_historical(value: &str) -> Option<PartialDateBounds> {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.is_empty() || parts.len() > 3 {
        return None;
    }
    let year = i32::try_from(digits(parts[0], 4)?).ok()?;
    if year < 1 {
        return None;
    }
    match parts.len() {
        1 => Some(PartialDateBounds {
            earliest: NaiveDate::from_ymd_opt(year, 1, 1)?,
            latest: NaiveDate::from_ymd_opt(year, 12, 31)?,
        }),
        2 => {
            let month = digits(parts[1], 2)?;
            let earliest = NaiveDate::from_ymd_opt(year, month, 1)?;
            let next = if month == 12 {
                NaiveDate::from_ymd_opt(year + 1, 1, 1)?
            } else {
                NaiveDate::from_ymd_opt(year, month + 1, 1)?
            };
            Some(PartialDateBounds {
                earliest,
                latest: next.pred_opt()?,
            })
        }
        _ => {
            let date = NaiveDate::from_ymd_opt(year, digits(parts[1], 2)?, digits(parts[2], 2)?)?;
            Some(PartialDateBounds {
                earliest: date,
                latest: date,
            })
        }
    }
}

/// Parses a historical date written YYYY-MM-DD; None for every other form.
pub fn parse_historical_day(value: &str) -> Option<NaiveDate> {
    if value.len() != 10 {
        return None;
    }
    parse_historical(value).map(|bounds| bounds.earliest)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::Value;

    pub(crate) fn fixture_rows() -> Vec<Value> {
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../schemas/fixtures/partial-dates.v1.json"
        ))
        .expect("the shared fixture is JSON");
        fixture["dates"].as_array().expect("dates").clone()
    }

    pub(crate) fn expected_bounds(row: &Value) -> Option<(String, String)> {
        row["historical"].as_bool().unwrap().then(|| {
            (
                row["bounds"][0].as_str().unwrap().to_owned(),
                row["bounds"][1].as_str().unwrap().to_owned(),
            )
        })
    }

    #[test]
    fn parse_historical_matches_the_shared_fixture() {
        for row in fixture_rows() {
            let value = row["value"].as_str().unwrap();
            let actual = parse_historical(value).map(|bounds| {
                (
                    bounds.earliest.format("%Y-%m-%d").to_string(),
                    bounds.latest.format("%Y-%m-%d").to_string(),
                )
            });
            assert_eq!(actual, expected_bounds(&row), "{value:?}");
        }
    }

    #[test]
    fn parse_historical_day_takes_full_dates_only() {
        for row in fixture_rows() {
            let value = row["value"].as_str().unwrap();
            let expected = row["historical"].as_bool().unwrap() && value.len() == 10;
            assert_eq!(parse_historical_day(value).is_some(), expected, "{value:?}");
        }
    }
}
