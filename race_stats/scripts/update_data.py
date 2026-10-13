#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=============================================================================
CSK / SLALOM-WORLD DATA UPDATER & AGGREGATOR
=============================================================================
Tento skript stahuje a aktualizuje data o vodáckých závodech z webu slalom-world.com,
provádí normalizaci názvů oddílů, očištění zrušených závodů, započtení významných
mezinárodních závodů a generuje finální frontendovou databázi `data.js`.

Použití:
    python update_data.py                 # Aktualizuje aktuální rok a přegeneruje data.js
    python update_data.py --year 2026     # Aktualizuje konkrétní rok (např. 2026)
    python update_data.py --all           # Znovu stáhne celou historii 2012-dnes
    python update_data.py --no-scrape     # Pouze přepočítá data.js ze stávajícího raw_races.json
=============================================================================
"""

import os
import sys
import json
import re
import time
import argparse
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup

# Fix encoding for Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
RAW_CACHE_FILE = os.path.join(PROJECT_ROOT, "data", "raw_races.json")
OUTPUT_DATA_FILE = os.path.join(PROJECT_ROOT, "data.js")

# Zvláštní evidence velkých závodů konaných v ČR, u kterých Slalom-World neparsoval
# 'počet hodnocených' do textu tabulky, ale výsledky jsou v přiložených PDF/Siwidata.
KNOWN_MAJOR_EVENTS = {
    # (year, keyword_in_col0): (competitors, club, clean_name, discipline)
    (2026, "world cup - prague"): (360, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
    (2024, "world cup - prague"): (372, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
    (2022, "world cup - prague"): (368, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
    (2022, "wrr"): (375, "USK Praha", "WRR + ECA Open Slalom Cup Troja", "SLALOM"),
    (2021, "world cup - prague"): (354, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
    (2018, "mistrovství evropy"): (342, "USK Praha", "Mistrovství Evropy ve vodním slalomu Praha - Troja", "SLALOM"),
    (2018, "wrr"): (412, "USK Praha", "WRR + ECA Open Slalom Cup Troja", "SLALOM"),
    (2017, "world cup - prague"): (365, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
    (2016, "world cup - prague"): (340, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
    (2015, "world cup - prague"): (350, "USK Praha", "Světový pohár ve vodním slalomu Praha - Troja", "SLALOM"),
}

# --- NORMALIZACE NÁZVŮ ODDÍLŮ ---
def normalize_club(raw_name):
    """
    Sjednotí historické a alternativní názvy oddílů pod jeden kanonický název.
    """
    if not raw_name:
        return ""
    
    name = raw_name.strip()
    name_lower = name.lower()
    
    # 1. USK Praha
    if "univerzitní sportovní klub praha" in name_lower or "usk praha" in name_lower or name_lower == "usk":
        return "USK Praha"
        
    # 2. SK VS České Budějovice
    if "české budějovice" in name_lower or "ceske budejovice" in name_lower or "č. budějovice" in name_lower or "c. budejovice" in name_lower or "sk vs čb" in name_lower or "skvs cb" in name_lower:
        return "SK VS České Budějovice"
        
    # 3. SK Vltava Český Krumlov
    if "český krumlov" in name_lower or "cesky krumlov" in name_lower or "č. krumlov" in name_lower or "c. krumlov" in name_lower:
        return "SK Vltava Č. Krumlov z.s."
        
    # 4. SKUP Olomouc
    if "olomouc" in name_lower:
        return "SK UP Olomouc"
        
    # 5. TJ Slávia Hradec Králové
    if "hradec" in name_lower:
        return "TJ Slávia Hradec Králové"
        
    # 6. TJ Kotva Braník
    if "kotva braník" in name_lower or "kotva branik" in name_lower or "braník" in name_lower or "branik" in name_lower:
        return "TJ Kotva Braník"
        
    # 7. TJ Bohemians Praha
    if "bohemians" in name_lower:
        return "TJ Bohemians Praha"
        
    # 8. TJ Tesla Brno
    if "tesla brno" in name_lower:
        return "TJ Tesla Brno"
        
    # 9. TJ Lokomotiva Žatec
    if "žatec" in name_lower or "zatec" in name_lower:
        return "TJ Lokomotiva Žatec"
        
    # 10. TJ ČSAD Plzeň
    if "čsad plzeň" in name_lower or "csad plzen" in name_lower or "čsad" in name_lower:
        return "TJ ČSAD Plzeň"
        
    # 11. TJ Union Plzeň
    if "union plzeň" in name_lower or "union plzen" in name_lower or "union" in name_lower:
        return "TJ Union Plzeň"
        
    # 12. TJ Jiskra Havlíčkův Brod
    if "havlíčkův brod" in name_lower or "havlickuv brod" in name_lower or "havl. brod" in name_lower or "havl brod" in name_lower:
        return "TJ Jiskra Havlíčkův Brod"
        
    # 13. TJ Krupka
    if "krupka" in name_lower:
        return "TJ Krupka"
        
    # 14. Železný Brod
    if "železný brod" in name_lower or "zelezny brod" in name_lower:
        return "TJ Jiskra Železný Brod"
        
    # 15. Benátky nad Jizerou
    if "benátky" in name_lower or "benatky" in name_lower:
        return "Kanoe klub DELFÍN Benátky n.J."
        
    # 16. SKK Třebechovice
    if "třebechovice" in name_lower or "trebechovice" in name_lower:
        return "SK Třebechovice"
        
    # 17. Česká Lípa
    if "česká lípa" in name_lower or "ceska lipa" in name_lower:
        return "TJ ŽSK - oddíl kanoistiky Česká Lípa"
        
    # 18. Sušice
    if "sušice" in name_lower or "susice" in name_lower:
        return "TJ Sokol Sušice"
        
    # 19. Hubertus Karlovy Vary
    if "hubertus" in name_lower or "karlovy vary" in name_lower:
        return "SK Hubertus Karlovy Vary"
        
    # 20. SKK Vysoké Mýto
    if "vysoké mýto" in name_lower or "vysokem myte" in name_lower or "vysoke myto" in name_lower:
        return "SKK Vysoké Mýto"
        
    # 21. SK Žižkov
    if "žižkov" in name_lower or "zizkov" in name_lower:
        return "SK Žižkov"
        
    # 22. Pardubice (TJ Syntesia Pardubice vs SK Modrá Hvězda Pardubice)
    if "syntesia" in name_lower or "pardubice" in name_lower:
        if "modrá hvězda" in name_lower or "modra hvezda" in name_lower:
            return "SK Modrá Hvězda Pardubice"
        return "TJ Syntesia Pardubice"
        
    # 23. Dukla Praha
    if "dukla praha" in name_lower:
        return "TJ Dukla Praha"
        
    # 24. Roudnice nad Labem
    if "roudnice" in name_lower:
        return "Klub kanoistiky Roudnice n.L."
        
    # 25. Spoj Brno
    if "spoj brno" in name_lower:
        return "Kanoe Klub Spoj Brno"
        
    # 26. Bechyně
    if "bechyně" in name_lower or "bechyne" in name_lower:
        return "TJ Jiskra Bechyně"
        
    # 27. Kralupy
    if "kralupy" in name_lower:
        return "TJ Kralupy, oddíl kanoistiky"
        
    # 28. Loko Plzeň
    if "loko plzeň" in name_lower or "lokomotiva plzeň" in name_lower or "loko plzen" in name_lower:
        return "TJ Loko Plzeň"
        
    # 29. Rakovník
    if "rakovník" in name_lower or "rakovnik" in name_lower:
        return "KK Rakovník"
        
    # 30. Trutnov
    if "trutnov" in name_lower:
        return "Loko Trutnov"
        
    # 31. Veselí nad Moravou
    if "veselí nad moravou" in name_lower or "veseli nad moravou" in name_lower:
        return "SK Veselí nad Moravou"
        
    # 32. Kroměříž
    if "kroměříž" in name_lower or "kromeriz" in name_lower:
        return "VK Kroměříž"
        
    # 33. Opava
    if "opava" in name_lower:
        return "KK Opava"
        
    # 34. Zábřeh
    if "zábřeh" in name_lower or "zabreh" in name_lower:
        return "Vodní sporty Zábřeh"
        
    # 35. Strakonice
    if "strakonice" in name_lower:
        return "Otava Strakonice"
        
    # 36. Dvůr Králové
    if "dvůr králové" in name_lower or "dvora kralove" in name_lower or "dvur kralove" in name_lower:
        return "TJ Dvůr Králové"
        
    # 37. Tábor
    if "tábor" in name_lower or "tabor" in name_lower:
        return "VS Tábor"
        
    # 38. Kadaň
    if "kadaň" in name_lower or "kadan" in name_lower:
        return "TJ DNT VS Kadaň"

    return name

# --- KLASIFIKACE DISCIPLÍN ---
def classify_discipline(col0):
    """
    Zařadí závod do jedné ze tří disciplín: SLALOM, SJEZD, KROS.
    """
    col0_lower = col0.lower()
    if "kros" in col0_lower or "cx" in col0_lower:
        return "KROS"
    if "sjezd" in col0_lower or "sprint" in col0_lower or "sj" in col0_lower or "sp" in col0_lower:
        return "SJEZD"
    if "slalom" in col0_lower or "sl" in col0_lower:
        return "SLALOM"
    return "SLALOM"

def clean_race_name(col0):
    """
    Vyčistí název závodu od doplňkových kódů, čísla disciplíny a textu hodnocených.
    """
    name = col0
    if "/" in name:
        name = name.split("/")[0]
        
    # 1. Standardní oddělení čísla závodu a disciplíny: "Název 123 SLALOM"
    m = re.search(r'^(.*?)\s+\d+\s*(SJEZD|SLALOM|kros|cx)\b', name, re.I)
    if m:
        return m.group(1).strip()
        
    # 2. Věková kategorie před číslem závodu: "Název RD U2341SLALOM" -> "Název RD U23"
    m_u = re.search(r'^(.*?\bU\d{2})\d+\s*(SJEZD|SLALOM|kros|cx)\b', name, re.I)
    if m_u:
        return m_u.group(1).strip()
        
    # 3. Rok v názvu před číslem závodu: "Olympiáda dětí a mládeže 202674SLALOM" -> "Olympiáda dětí a mládeže 2026"
    m_yr = re.search(r'^(.*?\b20\d\d)\d+\s*(SJEZD|SLALOM|kros|cx)\b', name, re.I)
    if m_yr:
        return m_yr.group(1).strip()
        
    # 4. Obecné číselné kódy před disciplínou
    m_gen = re.search(r'^(.*?)\d+\s*(SJEZD|SLALOM|kros|cx)\b', name, re.I)
    if m_gen:
        return m_gen.group(1).strip()
        
    return name.strip()

# --- SCRAPER (Slalom World) ---
def scrape_year(year):
    """
    Stáhne seznam závodů pro daný rok ze Slalom-Worldu.
    """
    print(f"Stahuji data z webu pro rok {year}...")
    url = f"https://www.slalom-world.com/index.php?act=00&rok={year}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            html = response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Chyba při stahování roku {year}: {e}")
        return []
        
    soup = BeautifulSoup(html, 'html.parser')
    tables = soup.find_all('table')
    if len(tables) < 3:
        print(f"Rok {year} nemá dostatek tabulek na webu (nalezeno {len(tables)}).")
        return []
        
    # Tabulka 2 obsahuje seznam závodů
    table = tables[2]
    rows = table.find_all('tr')
    
    scraped_races = []
    for r_idx, r in enumerate(rows):
        cols = r.find_all('td')
        if not cols:
            continue
        
        cols_text = [td.get_text(strip=True, separator=" ") for td in cols]
        if len(cols_text) < 3:
            continue
            
        links = [a['href'] for a in r.find_all('a', href=True)]
        
        scraped_races.append({
            'year': year,
            'row_idx': r_idx,
            'col0': cols_text[0],
            'date': cols_text[1],
            'club': cols_text[2],
            'location': cols_text[3] if len(cols_text) > 3 else '',
            'links': links
        })
    
    print(f"Rok {year}: staženo {len(scraped_races)} záznamů o závodech.")
    return scraped_races

# --- HLAVNÍ LOGIKA AGREGACE ---
def process_data():
    """
    Načte raw_races.json, aplikuje normalizaci a filtry a vytvoří data.js.
    """
    if not os.path.exists(RAW_CACHE_FILE):
        print(f"CHYBA: Soubor raw mezipaměti {RAW_CACHE_FILE} neexistuje.")
        return

    with open(RAW_CACHE_FILE, 'r', encoding='utf-8') as f:
        races = json.load(f)

    print(f"Zpracovávám {len(races)} surových závodů z mezipaměti...")

    clubs_data = {}
    global_totals = {
        'races': 0,
        'competitors': 0,
        'by_year': {},
        'by_discipline': {
            'SLALOM': {'races': 0, 'competitors': 0},
            'SJEZD': {'races': 0, 'competitors': 0},
            'KROS': {'races': 0, 'competitors': 0}
        }
    }

    ignored_count = 0
    valid_count = 0

    cancelled_keywords = ["zrušeno", "zrušeny", "zrušen", "odloženo", "stornováno", "nedostatek vody", "covid 19", "výsledky nejsou k dispozici"]

    for r in races:
        col0 = r['col0']
        col0_lower = col0.lower()
        club_raw = r.get('club', '')
        year = r['year']
        date = r['date']
        location = r.get('location', '')
        location_lower = location.lower()
        
        # 1. Kontrola známých velkých závodů s manuálním počtem (PDF výsledky)
        override = None
        for (yr, kw), (cnt, clb, cname, disc) in KNOWN_MAJOR_EVENTS.items():
            if yr == year and kw in col0_lower:
                override = (cnt, clb, cname, disc)
                break
                
        if override:
            competitors, club_name, race_title, discipline = override
            valid_count += 1
        else:
            # 2. Očištění zrušených závodů
            is_cancelled = any(kw in col0_lower for kw in cancelled_keywords)
            if is_cancelled:
                ignored_count += 1
                continue
                
            # 3. Získání počtu závodníků
            match_comp = re.search(r'počet hodnocených:\s*(\d+)', col0, re.I)
            if not match_comp:
                ignored_count += 1
                continue
                
            competitors = int(match_comp.group(1))
            valid_count += 1
            
            club_name = normalize_club(club_raw)
            
            # 4. Pravidlo pro neznámý / neuvedený oddíl v Praze-Troji (připadá na USK Praha)
            if not club_name or club_name == "Neznámý oddíl" or club_raw.strip() == "":
                is_troja_loc = ("troja" in location_lower or "troji" in location_lower or "vodácká" in location_lower or "praha 7" in location_lower or "usd praha" in location_lower)
                is_troja_col0 = ("troja" in col0_lower or "troji" in col0_lower or "prague" in col0_lower or "praha" in col0_lower)
                is_dukla = "dukla" in club_raw.lower() or "dukla" in col0_lower
                
                if (is_troja_loc or is_troja_col0) and not is_dukla:
                    club_name = "USK Praha"
            
            if not club_name:
                club_name = "Neznámý oddíl"
                
            discipline = classify_discipline(col0)
            race_title = clean_race_name(col0)
        
        race_record = {
            'year': year,
            'date': date,
            'name': race_title,
            'discipline': discipline,
            'competitors': competitors
        }
        
        if club_name not in clubs_data:
            clubs_data[club_name] = {
                'name': club_name,
                'races': [],
                'totals': {
                    'all_races': 0,
                    'all_competitors': 0,
                    'slalom_races': 0,
                    'slalom_competitors': 0,
                    'sjezd_races': 0,
                    'sjezd_competitors': 0,
                    'kros_races': 0,
                    'kros_competitors': 0
                },
                'years': {}
            }
            
        club = clubs_data[club_name]
        club['races'].append(race_record)
        
        # Aktualizace celkových součtů klubu
        club['totals']['all_races'] += 1
        club['totals']['all_competitors'] += competitors
        
        if discipline == 'SLALOM':
            club['totals']['slalom_races'] += 1
            club['totals']['slalom_competitors'] += competitors
        elif discipline == 'SJEZD':
            club['totals']['sjezd_races'] += 1
            club['totals']['sjezd_competitors'] += competitors
        elif discipline == 'KROS':
            club['totals']['kros_races'] += 1
            club['totals']['kros_competitors'] += competitors
            
        # Aktualizace ročních součtů klubu
        year_str = str(year)
        if year_str not in club['years']:
            club['years'][year_str] = {
                'races': 0,
                'competitors': 0,
                'slalom_races': 0,
                'slalom_competitors': 0,
                'sjezd_races': 0,
                'sjezd_competitors': 0,
                'kros_races': 0,
                'kros_competitors': 0
            }
            
        y_stats = club['years'][year_str]
        y_stats['races'] += 1
        y_stats['competitors'] += competitors
        if discipline == 'SLALOM':
            y_stats['slalom_races'] += 1
            y_stats['slalom_competitors'] += competitors
        elif discipline == 'SJEZD':
            y_stats['sjezd_races'] += 1
            y_stats['sjezd_competitors'] += competitors
        elif discipline == 'KROS':
            y_stats['kros_races'] += 1
            y_stats['kros_competitors'] += competitors

        # Aktualizace globálních součtů
        global_totals['races'] += 1
        global_totals['competitors'] += competitors
        global_totals['by_discipline'][discipline]['races'] += 1
        global_totals['by_discipline'][discipline]['competitors'] += competitors
        
        if year_str not in global_totals['by_year']:
            global_totals['by_year'][year_str] = {
                'races': 0,
                'competitors': 0,
                'slalom_races': 0,
                'slalom_competitors': 0,
                'sjezd_races': 0,
                'sjezd_competitors': 0,
                'kros_races': 0,
                'kros_competitors': 0
            }
            
        gy_stats = global_totals['by_year'][year_str]
        gy_stats['races'] += 1
        gy_stats['competitors'] += competitors
        if discipline == 'SLALOM':
            gy_stats['slalom_races'] += 1
            gy_stats['slalom_competitors'] += competitors
        elif discipline == 'SJEZD':
            gy_stats['sjezd_races'] += 1
            gy_stats['sjezd_competitors'] += competitors
        elif discipline == 'KROS':
            gy_stats['kros_races'] += 1
            gy_stats['kros_competitors'] += competitors

    print(f"Výsledek agregace: {valid_count} platných závodů, {ignored_count} zrušených/neúplných.")
    print(f"Nalezeno {len(clubs_data)} znormalizovaných oddílů.")

    # Seřazení závodů uvnitř klubů od nejnovějších
    for club_name, club in clubs_data.items():
        club['races'].sort(key=lambda x: (x['year'], x['date']), reverse=True)

    dashboard_data = {
        'clubs': list(clubs_data.values()),
        'global_totals': global_totals
    }

    # Zápis do data.js
    os.makedirs(os.path.dirname(OUTPUT_DATA_FILE), exist_ok=True)
    with open(OUTPUT_DATA_FILE, 'w', encoding='utf-8') as f:
        f.write("/* DATA FOR CANOE CLUB STATISTICS DASHBOARD - GENERATED ON " + datetime.now().strftime("%d.%m.%Y %H:%M:%S") + " */\n")
        f.write("window.CSK_DATA = ")
        json.dump(dashboard_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"Soubor data.js byl úspěšně vygenerován a uložen.")

# --- SPUŠTĚNÍ ---
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Aktualizační skript statistik vodáckých oddílů.')
    parser.add_argument('--year', type=int, default=None,
                        help='Rok, který se má stáhnout z webu a aktualizovat (výchozí je aktuální rok)')
    parser.add_argument('--all', action='store_true',
                        help='Stáhnout kompletně všechna léta (2012-dnes) znovu a přepsat mezipaměť')
    parser.add_argument('--no-scrape', action='store_true',
                        help='Nestahovat nic z webu, pouze regenerovat data.js z existujícího raw_races.json')

    args = parser.parse_args()

    # Zajištění složky pro data
    os.makedirs(os.path.join(PROJECT_ROOT, "data"), exist_ok=True)

    if args.no_scrape:
        print("Režim bez stahování: Pouze regeneruji databázi data.js...")
        process_data()
    else:
        existing_races = []
        if os.path.exists(RAW_CACHE_FILE):
            try:
                with open(RAW_CACHE_FILE, 'r', encoding='utf-8') as f:
                    existing_races = json.load(f)
            except Exception as e:
                print(f"Nelze načíst stávající raw_races.json: {e}")

        if args.all:
            print("Režim stahování VŠECH let. To může trvat déle...")
            all_scraped = []
            current_year = datetime.now().year
            for y in range(2012, current_year + 1):
                all_scraped.extend(scrape_year(y))
                time.sleep(1.0)
            
            with open(RAW_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(all_scraped, f, ensure_ascii=False, indent=2)
            print("Všechna léta úspěšně uložena do raw_races.json.")
        else:
            target_year = args.year if args.year is not None else datetime.now().year
            scraped_races = scrape_year(target_year)
            
            if scraped_races:
                existing_races = [r for r in existing_races if r['year'] != target_year]
                existing_races.extend(scraped_races)
                existing_races.sort(key=lambda x: (x['year'], x.get('row_idx', 0)))

                with open(RAW_CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(existing_races, f, ensure_ascii=False, indent=2)
                print(f"Mezipaměť raw_races.json byla aktualizována o rok {target_year}.")
            else:
                print(f"Nebyly staženy žádné nové záznamy pro rok {target_year}.")

        process_data()
