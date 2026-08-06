#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Vodácké oddíly ČR - Aktualizační skript
=======================================
Tento skript stahuje data o závodech z portálu slalom-world.com pro zadaný rok (nebo pro všechna léta),
znormalizuje názvy oddílů a vygeneruje optimalizovaný databázový soubor `data.js` pro webový dashboard.

Použití:
  python scripts/update_data.py                      # Stažení aktuálního roku a regenerace
  python scripts/update_data.py --year 2027          # Stažení konkrétního roku (např. 2027) a regenerace
  python scripts/update_data.py --no-scrape          # Pouze regenerace data.js z lokálních souborů (bez stahování)
  python scripts/update_data.py --all                # Kompletní stažení všech let 2012-dnes (přepíše mezipaměť)
"""

import os
import re
import json
import time
import argparse
import urllib.request
from datetime import datetime
from bs4 import BeautifulSoup

# Výchozí cesty relativně k umístění skriptu
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_CACHE_FILE = os.path.join(PROJECT_ROOT, "data", "raw_races.json")
OUTPUT_DATA_FILE = os.path.join(PROJECT_ROOT, "data.js")

# --- NORMALIZACE ODDÍLŮ ---
def normalize_club(name):
    name = name.strip()
    name = " ".join(name.split())
    if not name:
        return ""
    
    name_lower = name.lower()
    
    # České Budějovice
    if "české budějovice" in name_lower or "č. budějovice" in name_lower or "vsčb" in name_lower or "ceske budejovice" in name_lower:
        return "SK Vodní slalom České Budějovice"
        
    # Český Krumlov
    if "krumlov" in name_lower:
        return "SK Vltava Český Krumlov"
        
    # USK Praha
    if "usk praha" in name_lower or "univerzitní sportovní klub praha" in name_lower:
        return "USK Praha"
        
    # Bohemians Praha
    if "bohemians" in name_lower:
        return "TJ Bohemians Praha"
        
    # Olomouc (SKUP Olomouc / UP Olomouc)
    if "olomouc" in name_lower:
        return "SKUP Olomouc"
        
    # Česká Lípa
    if "česká lípa" in name_lower or "české lípě" in name_lower or "ceska lipa" in name_lower:
        return "SK Kanoistika Česká Lípa"
        
    # Dolní Kounice
    if "dolní kounice" in name_lower or "dolni kounice" in name_lower:
        return "VS Dolní Kounice"
        
    # Brandýs nad Labem
    if "brandýs" in name_lower or "brandys" in name_lower:
        if "dukla" in name_lower:
            return "Dukla Brandýs"
        return "KK Brandýs nad Labem"
        
    # Klatovy
    if "klatovy" in name_lower:
        return "Kanoistický klub Klatovy"
        
    # Sušice
    if "sušice" in name_lower or "susice" in name_lower:
        return "KVS Sušice"
        
    # Benátky nad Jizerou
    if "benátky" in name_lower or "benatek" in name_lower or "benatky" in name_lower:
        return "SKVS Benátky nad Jizerou"
        
    # Železný Brod
    if "železný brod" in name_lower or "železným brodě" in name_lower or "zelezny brod" in name_lower:
        return "TJ KK Železný Brod"
        
    # Tzunami Ostrava
    if "tzunami" in name_lower:
        return "VK Tzunami Ostrava"
        
    # Litovel
    if "litovel" in name_lower:
        return "TJ VS Litovel"
        
    # Vysoké Mýto
    if "vysoké mýto" in name_lower or "vysokem myte" in name_lower or "vysoke myto" in name_lower:
        return "SKK Vysoké Mýto"
        
    # Žižkov
    if "žižkov" in name_lower or "zizkov" in name_lower:
        return "SK Žižkov"
        
    # Pardubice (TJ Syntesia Pardubice vs SK Modrá Hvězda Pardubice)
    if "syntesia" in name_lower or "pardubice" in name_lower:
        if "modrá hvězda" in name_lower or "modra hvezda" in name_lower:
            return "SK Modrá Hvězda Pardubice"
        return "TJ Syntesia Pardubice"
        
    # Dukla Praha
    if "dukla praha" in name_lower:
        return "TJ Dukla Praha"
        
    # Roudnice
    if "roudnice" in name_lower:
        return "Klub kanoistiky Roudnice n.L."
        
    # Spoj Brno
    if "spoj brno" in name_lower:
        return "Kanoe Klub Spoj Brno"
        
    # Bechyně
    if "bechyně" in name_lower or "bechyne" in name_lower:
        return "TJ Jiskra Bechyně"
        
    # Kralupy
    if "kralupy" in name_lower:
        return "TJ Kralupy, oddíl kanoistiky"
        
    # Loko Plzeň
    if "loko plzeň" in name_lower or "lokomotiva plzeň" in name_lower or "loko plzen" in name_lower:
        return "TJ Loko Plzeň"
        
    # Rakovník
    if "rakovník" in name_lower or "rakovnik" in name_lower:
        return "KK Rakovník"
        
    # Trutnov
    if "trutnov" in name_lower:
        return "Loko Trutnov"
        
    # Veselí nad Moravou
    if "veselí nad moravou" in name_lower or "veseli nad moravou" in name_lower:
        return "SK Veselí nad Moravou"
        
    # Kroměříž
    if "kroměříž" in name_lower or "kromeriz" in name_lower:
        return "VK Kroměříž"
        
    # Opava
    if "opava" in name_lower:
        return "KK Opava"
        
    # Zábřeh
    if "zábřeh" in name_lower or "zabreh" in name_lower:
        return "Vodní sporty Zábřeh"
        
    # Strakonice
    if "strakonice" in name_lower:
        return "Otava Strakonice"
        
    # Dvůr Králové
    if "dvůr králové" in name_lower or "dvora kralove" in name_lower or "dvur kralove" in name_lower:
        return "TJ Dvůr Králové"
        
    # Tábor
    if "tábor" in name_lower or "tabor" in name_lower:
        return "VS Tábor"
        
    # Kadaň
    if "kadaň" in name_lower or "kadan" in name_lower:
        return "TJ DNT VS Kadaň"
        
    # Třebechovice
    if "třebechovice" in name_lower or "trebechovice" in name_lower:
        return "SK Třebechovice"

    return name

# --- KLASIFIKACE DISCIPLÍN ---
def classify_discipline(col0):
    col0_lower = col0.lower()
    if "kros" in col0_lower or "cx" in col0_lower:
        return "KROS"
    if "sjezd" in col0_lower or "sprint" in col0_lower or "sj" in col0_lower or "sp" in col0_lower:
        return "SJEZD"
    if "slalom" in col0_lower or "sl" in col0_lower:
        return "SLALOM"
    if "sl " in col0_lower or " sl" in col0_lower:
        return "SLALOM"
    if "sj " in col0_lower or " sj" in col0_lower or "sp " in col0_lower or " sp" in col0_lower:
        return "SJEZD"
    return "SLALOM"

def clean_race_name(col0):
    name = col0
    if "/" in name:
        name = name.split("/")[0]
    match = re.search(r'(.*?)\s+\d+\s+(SJEZD|SLALOM|kros|cx)\b', name, re.I)
    if match:
        name = match.group(1)
    return name.strip()

# --- SCRAPER (Slalom World) ---
def scrape_year(year):
    print(f"Stahuji data z webu pro rok {year}...")
    url = f"https://www.slalom-world.com/index.php?act=00&rok={year}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
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
    if not os.path.exists(RAW_CACHE_FILE):
        print(f"CHYBA: Soubor raw mezipameti {RAW_CACHE_FILE} neexistuje.")
        return

    with open(RAW_CACHE_FILE, 'r', encoding='utf-8') as f:
        races = json.load(f)

    print(f"Zpracovavam {len(races)} surovych zavodu z mezipameti...")

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

    cancelled_keywords = ["zrušeno", "zrušeny", "zrušen", "odloženo", "stornováno", "nedostatek vody", "Covid 19", "výsledky nejsou k dispozici"]

    for r in races:
        col0 = r['col0']
        club_raw = r['club']
        year = r['year']
        date = r['date']
        
        # Očištění zrušených závodů
        is_cancelled = any(kw in col0.lower() for kw in cancelled_keywords)
        if is_cancelled:
            ignored_count += 1
            continue
            
        # Získání počtu závodníků
        match_comp = re.search(r'počet hodnocených:\s*(\d+)', col0, re.I)
        if not match_comp:
            ignored_count += 1
            continue
            
        competitors = int(match_comp.group(1))
        valid_count += 1
        
        club_name = normalize_club(club_raw)
        
        # Override rule for unassigned or unknown clubs in Prague-Troja (typically USK Praha)
        if not club_name or club_name == "Neznámý oddíl" or club_raw.strip() == "":
            col0_lower = col0.lower()
            location_lower = r.get('location', '').lower()
            if "troja" in col0_lower or "troji" in col0_lower or "troja" in location_lower or "troji" in location_lower:
                # Exclude international ICF / ECA events, which should remain unassigned to local clubs
                is_intl = any(kw in col0_lower for kw in ["světový pohár", "svetovy pohar", "mistrovství světa", "mistrovstvi sveta", "mistrovství evropy", "mistrovstvi evropy", "world cup", "european championship"])
                is_dukla = "dukla" in club_raw.lower() or "dukla" in col0_lower
                if not is_intl and not is_dukla:
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

    print(f"Vysledek agregace: {valid_count} platnych zavodu, {ignored_count} zrusenych/neuplnych.")
    print(f"Nalezeno {len(clubs_data)} znormalizovanych oddilu.")

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

    # Poznámka: Nepoužíváme diakritiku v printu kvůli Windows cp1252 kódování v konzoli
    print(f"Soubor data.js byl uspesne vygenerovan a ulozen.")

# --- SPUŠTĚNÍ ---
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Aktualizacni skript statistik vodackych oddilu.')
    parser.add_argument('--year', type=int, default=None,
                        help='Rok, ktery se ma stahnout z webu a aktualizovat (vychozi je aktualni rok)')
    parser.add_argument('--all', action='store_true',
                        help='Stahnout kompletne vsechna leta (2012-dnes) znovu a prepsat mezipamet')
    parser.add_argument('--no-scrape', action='store_true',
                        help='Nestahovat nic z webu, pouze regenerovat data.js z existujiciho raw_races.json')

    args = parser.parse_args()

    # Zajištění složky pro data
    os.makedirs(os.path.join(PROJECT_ROOT, "data"), exist_ok=True)

    if args.no_scrape:
        print("Rezim bez stahovani: Pouze regeneruji databazi data.js...")
        process_data()
    else:
        # Načtení stávajících dat z mezipaměti
        existing_races = []
        if os.path.exists(RAW_CACHE_FILE):
            try:
                with open(RAW_CACHE_FILE, 'r', encoding='utf-8') as f:
                    existing_races = json.load(f)
            except Exception as e:
                print(f"Nelze nacist stavajici raw_races.json: {e}")

        if args.all:
            print("Rezim stahovani VSECH let. To muze trvat dele...")
            all_scraped = []
            current_year = datetime.now().year
            for y in range(2012, current_year + 1):
                all_scraped.extend(scrape_year(y))
                time.sleep(1.0) # Ohleduplnost k serveru
            
            with open(RAW_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(all_scraped, f, ensure_ascii=False, indent=2)
            print("Vsechna leta uspesne ulozena do raw_races.json.")
        else:
            # Stahujeme jeden rok (specifikovaný nebo aktuální)
            target_year = args.year if args.year is not None else datetime.now().year
            scraped_races = scrape_year(target_year)
            
            if scraped_races:
                # Odstraníme z existujících dat záznamy pro tento rok, abychom zamezili duplicitám
                existing_races = [r for r in existing_races if r['year'] != target_year]
                # Přidáme nově stažená data
                existing_races.extend(scraped_races)
                
                # Seřadíme podle roku a řádku
                existing_races.sort(key=lambda x: (x['year'], x.get('row_idx', 0)))

                with open(RAW_CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(existing_races, f, ensure_ascii=False, indent=2)
                print(f"Mezipamet raw_races.json byla aktualizovana o rok {target_year}.")
            else:
                print(f"Nebyly stazeny zadne nove zaznamy pro rok {target_year}.")

        process_data()
