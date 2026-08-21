#!/usr/bin/env python3
"""Tabulate Eriksen & Andrew (2010), Churches in Port Vila, into the batch-import format.

Input: the transcription below (one record per worship site named in Part Two of the
survey, cross-referenced to the Part One alphabetic number) plus a locality gazetteer of
OSM centroids. Output: apps/regions/vu/data/source/vu_port_vila_churches_2010.csv with the
curator batch-import header (docs/portal-batch-import-and-corrections.md), ready for Guy's
field verification and for scripts/build_vu_survey_tasks.py.

Transcription rules: names and localities as the survey gives them; founding years go to
first_date (organisation founding per interview, date_confidence medium); the interview or
survey date goes to last_date (the survey attests the site then); pastors' names are not
transcribed (project rule on office-holder names; they remain in the PDF via the locator);
denomination_code is left blank where the project taxonomy has no code and the body is
listed for Guy to rule on.
"""

from __future__ import annotations

import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "apps" / "regions" / "vu" / "data" / "source" / "vu_port_vila_churches_2010.csv"

TAXONOMY_VERSION = "2026-06-12.1"
SURVEY_DATE = "2010"

# locality gazetteer: OSM place nodes and named features, Overpass 2026-08-22, bbox
# (-17.80,168.25,-17.68,168.42); values are (lat, lng, basis, confidence, containing_area)
GAZ = {
    "Town centre": (-17.7415, 168.3150, "described_locality", "low", "Port Vila"),
    "Club Vanuatu, town centre": (-17.7381, 168.3149, "map_georeference", "medium", "Port Vila"),
    "Freswota": (-17.7215, 168.3205, "described_locality", "low", "Port Vila"),
    "Freswota 1": (-17.7215, 168.3205, "described_locality", "low", "Port Vila"),
    "Freswota 2": (-17.7215, 168.3205, "described_locality", "low", "Port Vila"),
    "Freswota 3": (-17.7215, 168.3205, "described_locality", "low", "Port Vila"),
    "Freswota 4": (-17.7215, 168.3205, "described_locality", "low", "Port Vila"),
    "Freswota 5": (-17.7191, 168.3195, "described_locality", "low", "Port Vila"),
    "Freswota School": (-17.7207, 168.3214, "map_georeference", "medium", "Port Vila"),
    "Ananboru": (-17.7218, 168.3132, "described_locality", "low", "Port Vila"),
    "Seaside": (-17.7447, 168.3210, "described_locality", "low", "Port Vila"),
    "Seaside Paama": (-17.7447, 168.3210, "described_locality", "low", "Port Vila"),
    "Seaside Tongoa": (-17.7447, 168.3210, "described_locality", "low", "Port Vila"),
    "Seaside Futuna": (-17.7447, 168.3210, "described_locality", "low", "Port Vila"),
    "Seaside, near Independence Park": (-17.7447, 168.3210, "described_locality", "low", "Port Vila"),
    "Nambatu": (-17.7499, 168.3160, "described_locality", "low", "Port Vila"),
    "Nambatri": (-17.7575, 168.3139, "described_locality", "low", "Port Vila"),
    "Ohlen": (-17.7160, 168.3172, "described_locality", "low", "Port Vila"),
    "Ohlen Freswind": (-17.7129, 168.3172, "described_locality", "low", "Port Vila"),
    "Ohlen Whitewood": (-17.7163, 168.3186, "described_locality", "low", "Port Vila"),
    "Tebakor": (-17.7177, 168.3107, "described_locality", "low", "Port Vila"),
    "Manples": (-17.7149, 168.3090, "described_locality", "low", "Port Vila"),
    "Agathis": (-17.7113, 168.3120, "described_locality", "low", "Port Vila"),
    "Tagabe": (-17.7067, 168.3094, "described_locality", "low", "Port Vila"),
    "Platiniere estate, Tagabe": (-17.7067, 168.3094, "described_locality", "low", "Port Vila"),
    "Blacksands": (-17.7115, 168.2968, "described_locality", "low", "Port Vila"),
    "Malapoa": (-17.7260, 168.3030, "described_locality", "low", "Port Vila"),
    "Beverly Hills": (-17.7245, 168.3251, "described_locality", "low", "Port Vila"),
    "Half road Pango": (-17.7600, 168.3050, "described_locality", "low", "Pango"),
    "Pango": (-17.7765, 168.2907, "described_locality", "low", "Pango"),
    "Erakor half road": (-17.7450, 168.3300, "described_locality", "low", "Erakor"),
    "Erakor Bridge": (-17.7380, 168.3339, "map_georeference", "medium", "Erakor"),
    "Erakor": (-17.7744, 168.3161, "described_locality", "low", "Erakor"),
    "Mele": (-17.6880, 168.2707, "described_locality", "low", "Mele"),
    "Etas": (-17.7488, 168.3831, "described_locality", "low", "Efate (Eratap area), Shefa"),
    "Teouma": (-17.7700, 168.3950, "described_locality", "low", "Efate (Teouma), Shefa"),
    "Roundabout bridge": (None, None, "regional_only", "low", "Port Vila"),
    "Port Vila (locality not given)": (None, None, "regional_only", "low", "Port Vila"),
}

# direct OSM place-of-worship matches (name + locality agree): point overrides the gazetteer
OSM_POINTS = {
    "Presbyterian Church, Malasitapu": (-17.7230, 168.3195, "map_georeference", "high", "OSM amenity=place_of_worship 'Malasitapu'"),
    "Catholic Church, Paray": (-17.7535, 168.3161, "map_georeference", "high", "OSM 'Eglise du Coeur Immaculé de Marie de Paray'"),
    "Presbyterian Church, Pakaroa": (-17.7163, 168.3186, "described_locality", "medium", "OSM 'Pakaroa Presbyterian Church' is in the Vila extract; confirm point on visit"),
}

P = "christian.pentecostal"
PRES = "christian.presbyterian"
SDA = "christian.seventh_day_adventist"
COC = "christian.church_of_christ"
ANG = "christian.anglican"
CATH = "christian.catholic"
LDS = "christian.latter_day_saints"

# (name, religion free text, denomination_code or None, locality key, locator, first_date, last_date, notes)
ROWS = [
    # town centre, pp. 6-7
    ("Catholic Cathedral Sacré-Cœur", "Catholic", CATH, "Town centre", "Part Two p.6 (Towncenter); Part One no. 7", None, SURVEY_DATE, "Cathedral; parish also covers Centenary church, Tebakor."),
    ("Presbyterian Church, town centre", "Presbyterian", PRES, "Town centre", "Part Two p.7 (Towncenter); Part One no. 35", None, SURVEY_DATE, "Listed by location only (established church)."),
    ("Praise and Worship Ministries, Port Vila branch", "Pentecostal (Praise and Worship / World Breakthrough network)", P, "Club Vanuatu, town centre", "Part Two p.7 (Towncenter); Part One no. 34", None, "2010-03", "Held services at Club Vanuatu; seeking a new venue after renovations. Branch of Mele Praise and Worship; about 14 households. Shared venue: verify current location."),
    # Freswota, pp. 8-14
    ("Presbyterian Church, Malasitapu", "Presbyterian", PRES, "Freswota", "Part Two p.8 (Freswota); Part One no. 35", "2009-08-21", SURVEY_DATE, "Dedication plate dated 21 August 2009 (building dedication; first_date is the dedication)."),
    ("Seventh-day Adventist Church, Epacho", "Seventh-day Adventist", SDA, "Freswota 1", "Part Two p.8 (Freswota); Part One no. 39", None, SURVEY_DATE, "Possible OSM match 'Epauto SDA church' in the Vila extract; verify."),
    ("Seventh-day Adventist Church, Mautoa", "Seventh-day Adventist", SDA, "Freswota 5", "Part Two p.8 (Freswota); Part One no. 39", None, SURVEY_DATE, ""),
    ("Living Wota (Living Water Ministry)", "Pentecostal", P, "Freswota 5", "Part Two p.8 (Freswota); Part One no. 28", "2002", "2006-07", "Main church Freswota 5. Breakaway from Renewal church 2002. Interview July 2006."),
    ("Survival (Healing Ministry)", "Pentecostal (healing ministry)", P, "Freswota 5", "Part Two p.9 (Freswota); Part One no. 41", "1996", "2010-01", "Breakaway from Revival/New Covenant 1996; primary school built 2007 in Freswota 5. Branches Nguna, Tanna, Malekula."),
    ("Life Revelation Church", "Pentecostal", P, "Freswota 5", "Part Two p.9 (Freswota); Part One no. 26", "2007", "2010-01", "Breakaway from Survival 2007; church under construction at visit; about 60 members."),
    ("Father's House (Triumphant Church)", "Pentecostal", P, "Freswota 5", "Part Two p.10 (Freswota); Part One no. 18", "2002", "2006-07", "Triumphant church created 2002 from the former CMC Salem branch; renamed Father's House 2008; under 100 members."),
    ("Equipper's House (Father's House branch)", "Pentecostal", P, "Erakor", "Part Two p.10 (Freswota); Part One no. 18", None, "2006-07", "Independent branch of Father's House at Erakor; about 20 members."),
    ("Anglican sub-centre, Freswota 4", "Anglican", ANG, "Freswota 4", "Part Two p.11 (Freswota); Part One no. 1", None, SURVEY_DATE, ""),
    ("Apostolic Faith Ministry", "Apostolic", None, "Freswota School", "Part Two p.11 (Freswota); Part One no. 3", None, SURVEY_DATE, "Main church in Port Vila at Freswota School (shared venue). No interview obtained."),
    ("NTM (Neil Thomas Ministries), Freswota 5", "Neil Thomas Ministries", None, "Freswota 5", "Part Two p.11 (Freswota); Part One no. 30", None, SURVEY_DATE, "One of about 15 NTM centres in Port Vila and surrounds; headquarters at Agathis."),
    ("Devine Healing Ministry", "Pentecostal (healing ministry)", P, "Freswota 2", "Part Two p.11 (Freswota); Part One no. 16", "2009", "2010-02", "Founded 2009; at least 200 members early 2010."),
    ("Today's Youth Ministry", "Inter-church youth programme", None, "Port Vila (locality not given)", "Part Two p.12 (Freswota); Part One no. 42", "1996", "2009-01", "Inter-church youth programme started 1996 on Ambae, headquartered in Port Vila; no worship site given. Candidate for exclusion or para-church classification."),
    ("Living Word House", "Pentecostal", P, "Freswota 3", "Part Two p.12 (Freswota); Part One no. 27", "2000", "2009-01", "Founded 2000; about 50 members."),
    ("Church of Christ, Freswota centre", "Church of Christ", COC, "Freswota 2", "Part Two p.12 (Freswota); Part One no. 12", None, SURVEY_DATE, ""),
    ("Pentecostal Evangelical Fellowship (AOG breakaway)", "Pentecostal (Assemblies of God breakaway)", P, "Freswota 5", "Part Two p.13 (Freswota); Part One no. 32", "2004-10", "2010-01", "Founded October 2004; first met in Fresh Water Primary School hall; own building in Freswota 5 in use from 2006, still under construction 2009; about 75 members."),
    ("Presbyterian Reformed Church", "Presbyterian Reformed (Presbyterian Reformed Church of Australia and New Zealand outreach)", "christian.reformed", "Freswota 5", "Part Two p.13 (Freswota); Part One no. 36", "2010", "2010-01", "Just starting at the time of the visit; 10-15 members."),
    ("United Pentecostal Church International, Freswota", "United Pentecostal Church International", P, "Freswota", "Part Two p.14 (Freswota); Part One no. 43", None, "2010-01", "About 200 members. UPCI arrived Vanuatu 1983 (first branch Pango)."),
    # Ananboru, pp. 14-15
    ("Four Square Church, Port Vila", "Foursquare (Pentecostal)", P, "Ananboru", "Part Two p.14 (Ananboru); Part One no. 20", "2001", "2006-07", "Arrived Vanuatu 2001; initially rented Anabouru (French) school, then the VNCW guesthouse; planning own building. Shared venue: verify current location."),
    ("United Pentecostal Church International, Ananboru", "United Pentecostal Church International", P, "Ananboru", "Part Two p.14 (Ananboru); Part One no. 43", None, "2010-01", "New church building under construction in 2010; about 1000 members."),
    ("Church of Christ, Sarabulu", "Church of Christ", COC, "Ananboru", "Part Two p.15 (Ananboru); Part One no. 12", "1990", "2010-01", "Broke out of the Sarembeto congregation 1990; about 100 members."),
    # Seaside, pp. 15-16
    ("Church of Christ, Sarembeto", "Church of Christ", COC, "Seaside, near Independence Park", "Part Two p.15 (Seaside); Part One no. 12", None, "2010-01", "First Church of Christ in Port Vila; about 200 members."),
    ("Vanuatu Revival Fellowship", "Pentecostal (Revival Fellowship, Australia)", P, "Seaside Paama", "Part Two p.15 (Seaside); Part One no. 47", None, "2010-02", "Main church Seaside Paama; branches Santo, Tanna, Malekula."),
    ("Anglican sub-centre, Seaside", "Anglican", ANG, "Seaside", "Part Two p.16 (Seaside); Part One no. 1", None, SURVEY_DATE, ""),
    ("Presbyterian Church, Paama Seaside", "Presbyterian", PRES, "Seaside Paama", "Part Two p.16 (Seaside); Part One no. 35", None, SURVEY_DATE, ""),
    ("Presbyterian Church, Tongoa Seaside", "Presbyterian", PRES, "Seaside Tongoa", "Part Two p.16 (Seaside); Part One no. 35", None, SURVEY_DATE, ""),
    ("Presbyterian Church, Futuna Seaside", "Presbyterian", PRES, "Seaside Futuna", "Part Two p.16 (Seaside); Part One no. 35", None, SURVEY_DATE, ""),
    # Nambatu, pp. 16-18
    ("Potter's House", "Pentecostal (Christian Fellowship Ministries)", P, "Nambatu", "Part Two p.16 (Nambatu); Part One no. 33", "2002", "2006-07", "Established 2002; first met at Rossi Hotel then Club Vanuatu before settling in Nambatu; more than 300 members."),
    ("Upper Room", "Pentecostal (World Breakthrough network)", P, "Nambatu", "Part Two p.16 (Nambatu); Part One no. 44", "2000-07", "2006-07", "Founded July 2000; main congregation meets weekly in Tampea Hall (shared venue)."),
    ("We Care Ministry (AOG branch)", "Assemblies of God", P, "Nambatu", "Part Two p.17 (Nambatu); Part One no. 5", None, SURVEY_DATE, "Branch of AOG Evangel Temple."),
    ("Church of Jesus Christ of Latter-day Saints, Port Vila First Branch", "Latter-day Saints", LDS, "Port Vila (locality not given)", "Part Two p.17 (Nambatu); Part One no. 13", None, "2010-01", "Port Vila District about 2000 members across six branches; missionaries arrived 1973, deported 1980, readmitted 1989."),
    ("Church of Jesus Christ of Latter-day Saints, Port Vila Second Branch", "Latter-day Saints", LDS, "Port Vila (locality not given)", "Part Two p.17 (Nambatu); Part One no. 13", None, "2010-01", "See First Branch."),
    ("Church of Jesus Christ of Latter-day Saints, Blacksands Branch", "Latter-day Saints", LDS, "Blacksands", "Part Two p.17 (Nambatu); Part One no. 13", None, "2010-01", ""),
    ("Church of Jesus Christ of Latter-day Saints, Erakor Branch", "Latter-day Saints", LDS, "Erakor", "Part Two p.17 (Nambatu); Part One no. 13", None, "2010-01", ""),
    ("Church of Jesus Christ of Latter-day Saints, Mele Branch", "Latter-day Saints", LDS, "Mele", "Part Two p.17 (Nambatu); Part One no. 13", None, "2010-01", ""),
    ("Church of Jesus Christ of Latter-day Saints, Etas Branch", "Latter-day Saints", LDS, "Etas", "Part Two p.17 (Nambatu); Part One no. 13", None, "2010-01", "'Branch long Etas'."),
    ("Seventh-day Adventist Church, Portoriki", "Seventh-day Adventist", SDA, "Nambatu", "Part Two p.17 (Nambatu); Part One no. 39", None, SURVEY_DATE, "Signposted 'Welcome to Portoroki'."),
    ("Catholic Church, Paray", "Catholic", CATH, "Nambatu", "Part Two p.18 (Nambatu); Part One no. 7", None, SURVEY_DATE, ""),
    ("Himford, Holy Church blong ol Nation", "Christian (independent)", None, "Nambatu", "Part Two p.18 (Nambatu); Part One no. 25", None, SURVEY_DATE, "Signage 'Holi Jos b/g ol Nasen', 'Revival 2008'. No interview text."),
    # Nambatri, p. 18
    ("Presbyterian Church, Nangirei", "Presbyterian", PRES, "Nambatri", "Part Two p.18 (Nambatri); Part One no. 35", None, SURVEY_DATE, ""),
    # Ohlen, pp. 19-22
    ("Glorious Church", "Pentecostal (healing and miracle church)", P, "Ohlen Freswind", "Part Two p.19 (Ohlen); Part One no. 22", "2000", "2006-07", "Breakaway from Survival 2000; 300-400 members including island branches."),
    ("Seventh-day Adventist Church, Freswind", "Seventh-day Adventist", SDA, "Ohlen Freswind", "Part Two p.19 (Ohlen); Part One no. 39", None, SURVEY_DATE, ""),
    ("Cornerstone Christian Center", "Pentecostal (Christian Revival Crusade affiliated)", P, "Ohlen Freswind", "Part Two p.19 (Ohlen); Part One no. 15", "1997", "2006-07", "Founded 1997 (as Christian Cornerstone Center); branches Santo, Malekula."),
    ("New Covenant Church (Revival)", "Christian (indigenous revival church)", None, "Ohlen", "Part Two p.20 (Ohlen); Part One no. 31", "1978", "2006-07", "Born of the late-1970s revival; vision dated 29 September 1978 (first_date is the vision year, not a building date). Parent of Survival, Bible Church, Tabernacle Fellowship."),
    ("Presbyterian Church, Ohlen Whitewood", "Presbyterian", PRES, "Ohlen Whitewood", "Part Two p.20 (Ohlen); Part One no. 35", None, SURVEY_DATE, "Listed as 'Ohlen Whitewood and Pakaroa' under one pastor; recorded as two sites."),
    ("Presbyterian Church, Pakaroa", "Presbyterian", PRES, "Ohlen Whitewood", "Part Two p.20 (Ohlen); Part One no. 35", None, SURVEY_DATE, ""),
    ("Tabernacle Fellowship", "Pentecostal", P, "Ohlen", "Part Two p.20 (Ohlen); Part One no. 38", "2003", SURVEY_DATE, "Breakaway from New Covenant 2003; members mainly from Shefa."),
    ("Christian Outreach Center", "Christian Outreach Centre (Australia-linked)", None, "Ohlen Freswind", "Part Two p.20 (Ohlen); Part One no. 11", None, SURVEY_DATE, "Linked to Christian Outreach Centre web page (p.36)."),
    ("Grace Church of God", "Pentecostal (charismatic revival)", P, "Ohlen", "Part Two p.21 (Ohlen); Part One no. 23", "2002", "2010-02-16", "Founded 2002; 30-50 committed members; pastor still identifies with the Presbyterian Church."),
    ("United Pentecostal Church International, Ohlen Freswind", "United Pentecostal Church International", P, "Ohlen Freswind", "Part Two p.21 (Ohlen); Part One no. 43", None, "2010-01", "About 100 members."),
    ("Apostolic Church, Ohlen", "Apostolic", None, "Ohlen", "Part Two p.21-22 (Ohlen); Part One no. 2", None, "2010-02", "Main Apostolic church in Port Vila; signposted 'Apostolic Church Ohlen'. Church founded on Ambae 1949."),
    # Tebakor, pp. 22-23
    ("Catholic Church, Centenary", "Catholic", CATH, "Tebakor", "Part Two p.22 (Tebakor); Part One no. 7", None, SURVEY_DATE, "Under Sacré-Cœur parish."),
    ("Apostolic Life Ministry", "Apostolic Life Ministry (Apostolic breakaway)", None, "Malapoa", "Part Two p.22 (Tebakor); Part One no. 4", "1993", "2010-03", "Founded 1993 after split from the Apostolic Church; main church built in Malapoa on land bought from Ifira; runs a TV and radio broadcasting centre. Survey lists location as Tebakor/Malapoa."),
    ("Assembly of God, Evangel Temple", "Assemblies of God", P, "Tebakor", "Part Two p.23 (Tebakor); Part One no. 5", "1968", SURVEY_DATE, "AOG Vanuatu started by a US missionary 1968 (first_date is the AOG's arrival, not necessarily this building)."),
    ("NTM (Neil Thomas Ministries), Manples", "Neil Thomas Ministries", None, "Manples", "Part Two p.23 (Tebakor); Part One no. 30", None, SURVEY_DATE, ""),
    # Manples, p. 23
    ("Seventh-day Adventist Church, Kaweriki", "Seventh-day Adventist", SDA, "Manples", "Part Two p.23 (Manples); Part One no. 39", None, SURVEY_DATE, ""),
    ("Elim Church, Manples", "Pentecostal (Korean mission)", P, "Manples", "Part Two p.23 (Manples); Part One no. 24", "1999", "2006-07", "Founded by Korean missionaries with a former AOG pastor who left AOG in 1999."),
    ("Presbyterian Church, Matatempoa", "Presbyterian", PRES, "Manples", "Part Two p.23 (Manples); Part One no. 35", None, SURVEY_DATE, ""),
    ("Presbyterian Church, Kokorako", "Presbyterian", PRES, "Manples", "Part Two p.23 (Manples); Part One no. 35", None, SURVEY_DATE, ""),
    # Agathis, p. 24
    ("Word Christian Fellowship (Jesus Only)", "Pentecostal (AOG breakaway)", P, "Agathis", "Part Two p.24 (Agathis); Part One no. 49", "1973", SURVEY_DATE, "Breakaway from AOG 1973; first called Jesus Only."),
    ("NTM (Neil Thomas Ministries) headquarters, Agathis", "Neil Thomas Ministries", None, "Agathis", "Part Two p.24 (Agathis); Part One no. 30", "1976", SURVEY_DATE, "Founder arrived 1976; earlier ground bought in Nambatu early 1980s (Kauman Bible College); headquarters now at Atakis/Agathis with bible college and nursing centre; about 15 centres in Port Vila area."),
    # Tagabe, pp. 24-26
    ("Anglican Church, main centre, Tagabe", "Anglican", ANG, "Tagabe", "Part Two p.24 (Tagabe); Part One no. 1", None, SURVEY_DATE, "Main centre of the Anglican Church in Port Vila."),
    ("Bible Church", "Evangelical (breakaway from New Covenant; Evangelical Bible Mission support)", "christian.evangelical", "Tagabe", "Part Two p.25 (Tagabe); Part One no. 6", "1993", "2010-02", "Founded 1993 after leadership dispute in New Covenant; US missionary support from 1995."),
    ("Christ Baptist Church", "Baptist", "christian.baptist", "Platiniere estate, Tagabe", "Part Two p.25 (Tagabe); Part One no. 9", None, SURVEY_DATE, "US missionaries; runs a primary school. Source is the mission web page, not an interview."),
    ("Word Breakthrough", "Pentecostal (World Breakthrough network; breakaway from Presbyterian)", P, "Platiniere estate, Tagabe", "Part Two p.25 (Tagabe); Part One no. 48", None, "2010-02", "70-80 members."),
    ("Sowing Faith Seed", "Pentecostal (World Breakthrough network; ALM breakaway)", P, "Tagabe", "Part Two p.26 (Tagabe); Part One no. 40", "2001", "2010-03", "Founded 2001; in the mainly Tanna-settled area around the airport; building a kindergarten. Locality inferred from section heading."),
    ("Presbyterian Church, Cliffdon", "Presbyterian", PRES, "Tagabe", "Part Two p.26 (Tagabe); Part One no. 35", None, SURVEY_DATE, ""),
    # Blacksands, pp. 26-28
    ("Catholic Church, Blacksands (planned)", "Catholic", CATH, "Blacksands", "Part Two p.26 (Blacksands); Part One no. 7", None, SURVEY_DATE, "In 2010 a piece of land was intended for a Catholic church; no building reported. Verify whether built."),
    ("Seventh-day Adventist Church, Olwi", "Seventh-day Adventist", SDA, "Blacksands", "Part Two p.26 (Blacksands); Part One no. 39", None, SURVEY_DATE, ""),
    ("Church of the Nazarene", "Nazarene", "christian.nazarene", "Blacksands", "Part Two p.26 (Blacksands); Part One no. 14", None, SURVEY_DATE, "No interview obtained; mission web pages listed p.36."),
    ("Renewal Church", "Christian (indigenous charismatic church)", None, "Blacksands", "Part Two p.27 (Blacksands); Part One no. 37", "1980", "2006-07", "Founded shortly after the Santo rebellion (1980) by Nagriamel leaders; first_date approximate. Branches on most islands. Locality inferred from section heading."),
    ("Vanuatu Fellowship blong ol Pikinini blong God", "Pentecostal (NTM breakaway; World Breakthrough network)", P, "Blacksands", "Part Two p.27 (Blacksands); Part One no. 45", "1998", "2010-04", "Near AOG Blacksands; broke from NTM 1998; 50-100 members."),
    ("Assembly of God, Blacksands branch", "Assemblies of God", P, "Blacksands", "Part Two p.27 (Blacksands); Part One no. 5", None, SURVEY_DATE, ""),
    ("ELOHIM Family Assembly", "Christian (Hebraic-practice assembly)", None, "Blacksands", "Part Two p.28 (Blacksands); Part One no. 17", "2007", "2010-03", "Founded 2007 with a bible study school; branches Pentecost, Santo, Aneityum. Locality inferred from section heading."),
    # Malapoa, p. 28
    ("Freedom of Worship centre, Malapoa", "Christian (non-denominational fellowship)", "christian.nondenominational", "Malapoa", "Part Two p.28 (Malapoa); Part One no. 21", None, SURVEY_DATE, "One of three Freedom of Worship centres."),
    ("NTM (Neil Thomas Ministries) branch, Malapoa", "Neil Thomas Ministries", None, "Malapoa", "Part Two p.28 (Malapoa); Part One no. 30", None, SURVEY_DATE, ""),
    ("Eklesia (Christian Mission Centre)", "Pentecostal (Christian Mission Centre movement)", P, "Malapoa", "Part Two p.28 (Malapoa); Part One no. 10", None, SURVEY_DATE, "CMC founded after the Every Home for Christ crusade in the 1990s; Eklesia recognised as the legitimate Port Vila CMC branch 1999."),
    # Beverly Hills, p. 29
    ("Church of Christ, Beverly Hills", "Church of Christ", COC, "Beverly Hills", "Part Two p.29 (Beverly Hills); Part One no. 12", None, SURVEY_DATE, "About 50 members."),
    ("Presbyterian Church, Brian Memorial", "Presbyterian", PRES, "Beverly Hills", "Part Two p.29 (Beverly Hills); Part One no. 35", None, SURVEY_DATE, ""),
    # Half road Pango, pp. 29-30
    ("Freedom of Worship, Half road Pango", "Christian (non-denominational fellowship)", "christian.nondenominational", "Half road Pango", "Part Two p.29 (Half road Pango); Part One no. 21", "1999", "2006-07", "Ministry founded 1999 by a group that left NTM via Praise and Worship; about 30 members; centres Malapoa, Erakor Bridge, Half road Pango."),
    ("Freedom of Worship centre, Erakor Bridge", "Christian (non-denominational fellowship)", "christian.nondenominational", "Erakor Bridge", "Part Two p.29 (Half road Pango); Part One no. 21", None, "2006-07", ""),
    ("Vanuatu Indigenous Seventh Day Adventist Church (Self-Supporting SDA), Pango headquarters", "Seventh-day Adventist (self-supporting breakaway)", SDA, "Pango", "Part Two p.29 (Half road Pango); Part One no. 46", "1997", "2010-02", "Broke away from SDA 1997 over tithing; headquarters and first self-supporting ministry at Pango; signage 'Eselpako Seventh Day Adventist Church'; clinic at Pango."),
    ("Self-Supporting SDA, Erakor", "Seventh-day Adventist (self-supporting breakaway)", SDA, "Erakor", "Part Two p.29 (Half road Pango); Part One no. 46", None, "2010-02", ""),
    ("Self-Supporting SDA, Teouma", "Seventh-day Adventist (self-supporting breakaway)", SDA, "Teouma", "Part Two p.29 (Half road Pango); Part One no. 46", None, "2010-02", ""),
    ("Self-Supporting SDA, Roundabout bridge", "Seventh-day Adventist (self-supporting breakaway)", SDA, "Roundabout bridge", "Part Two p.29 (Half road Pango); Part One no. 46", None, "2010-02", "'Roundabout bridge' not located; ask Guy."),
    ("Self-Supporting SDA, Blacksands", "Seventh-day Adventist (self-supporting breakaway)", SDA, "Blacksands", "Part Two p.29 (Half road Pango); Part One no. 46", None, "2010-02", ""),
    ("United Pentecostal Church International, Half road Pango", "United Pentecostal Church International", P, "Half road Pango", "Part Two p.30 (Half road Pango); Part One no. 43", None, SURVEY_DATE, "About 100 members."),
    # Erakor half road, p. 30
    ("Family Worship Ark Healing Ministry", "Pentecostal (healing ministry)", P, "Erakor half road", "Part Two p.30 (Erakor Half Road); Part One no. 19", "1996-07-10", "2010-03", "Ministry established 10 July 1996 (plaque); earlier met at Independence Park, Mele, Agathis; present church officially opened December 2009; over 200 members; branch being built on Tanna."),
    # Teouma, pp. 31-33
    ("Center Ville Christian Center", "Christian (AOG-trained; teaching-institute model)", None, "Teouma", "Part Two p.31-32 (Teoma); Part One no. 8", None, "2010-03", "Church building under construction 2010; 12 core families; runs Skul Blong Prophet. Pastor describes it as 'not a church in the ordinary sense'."),
    ("Melanesian Brotherhood (Anglican)", "Anglican religious order", ANG, "Port Vila (locality not given)", "Part Two p.33 (Teoma); Part One no. 29", None, "2010-03", "Household-based order of brothers; no worship site given. Candidate for residential_religious or exclusion."),
]

HEADER = [
    "name", "country_code", "religion", "denomination_code", "taxonomy_version", "lat", "lng",
    "locality", "containing_area", "geocoding_basis", "location_confidence", "source_locator",
    "source_url", "first_date", "last_date", "date_confidence", "culturally_sensitive", "notes",
]


def build_rows() -> list[dict[str, str]]:
    out = []
    for name, religion, code, loc_key, locator, first, last, notes in ROWS:
        lat, lng, basis, conf, area = GAZ[loc_key]
        if name in OSM_POINTS:
            lat, lng, basis, conf, osm_note = OSM_POINTS[name]
            notes = f"{notes} {osm_note}".strip()
        locality = loc_key if lat is not None or loc_key != "Port Vila (locality not given)" else ""
        if lat is not None:
            notes = f"{notes} Point is the {('OSM feature' if basis == 'map_georeference' else 'OSM locality centroid')}; verify on visit.".strip()
        out.append({
            "name": name,
            "country_code": "VU",
            "religion": religion,
            "denomination_code": code or "",
            "taxonomy_version": TAXONOMY_VERSION if code else "",
            "lat": f"{lat:.4f}" if lat is not None else "",
            "lng": f"{lng:.4f}" if lng is not None else "",
            "locality": locality,
            "containing_area": area,
            "geocoding_basis": basis if lat is not None else "regional_only",
            "location_confidence": conf,
            "source_locator": locator,
            "source_url": "",
            "first_date": first or "",
            "last_date": last or "",
            "date_confidence": "medium" if first else "",
            "culturally_sensitive": "",
            "notes": notes,
        })
    return out


def main() -> None:
    rows = build_rows()
    names = [r["name"] for r in rows]
    assert len(names) == len(set(names)), "duplicate site names"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        w.writerows(rows)
    uncoded = sorted({r["religion"] for r in rows if not r["denomination_code"]})
    print(f"wrote {len(rows)} rows to {OUT.relative_to(REPO)}")
    print(f"rows without a taxonomy code ({len(uncoded)} bodies): " + "; ".join(uncoded))


if __name__ == "__main__":
    main()
