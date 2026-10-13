import json
import re
import os
from collections import defaultdict

RAW_CACHE_FILE = r"c:\Users\JakubBican\Documents\OneDrive - SK Vodní slalom České Budějovice, z. s\csk_whatever\data\raw_races.json"
DIRECTORS_CACHE = r"c:\Users\JakubBican\Documents\OneDrive - SK Vodní slalom České Budějovice, z. s\csk_whatever\data\directors_cache.json"

def clean_director_name(name, club="", col0=""):
    if not name:
        return "Neuveden"
    
    # Replace non-breaking spaces
    name = name.replace('\xa0', ' ')
    
    # Remove labels
    name = re.sub(r'^(?:ředitel|reditel|závodu|zavodu)\s*:\s*', '', name, flags=re.I)
    
    # If the text starts with vrchní/hlavní rozhodčí, director is empty
    if re.search(r'^\s*(?:vrchní|hlavní|hl\.)\s*rozhod[cč][íi]', name, re.I):
        return "Neuveden"
    if name.strip().lower() in ["vrchní", "vrchni", "hlavní", "hlavni", "rozhodčí", "rozhodci"]:
        return "Neuveden"
        
    # Remove anything after vrchní / hlavní rozhodčí / zástupce
    name = re.split(r'\s+(?:vrchní|hlavní|hl\.|zástupce|zást\.|stavitel|technický|hlavny)\s*(?:rozhod[cč][íi]|stavitel|vedoucí|hana)?', name, flags=re.I)[0]
    
    # Remove titles
    titles = [
        r'\bIng\.', r'\bMgr\.', r'\bBc\.', r'\bMUDr\.', r'\bMVDr\.', r'\bRNDr\.', 
        r'\bPh\.D\.', r'\bCSc\.', r'\bDiS\.', r'\bPaedDr\.', r'\bJUDr\.', r'\bDoc\.', r'\bProf\.'
    ]
    for t in titles:
        name = re.sub(t, '', name, flags=re.I)
        
    # Remove parenthetical info e.g. (KVS), (SKVS)
    name = re.sub(r'\(.*?\)', '', name)
    
    # Remove trailing/leading punctuation
    name = name.strip(' ,;:-–/|\t\n.')
    name = " ".join(name.split())
    
    # Handle single names from known clubs
    if name.lower() == "jan" and "pardubice" in club.lower():
        return "Jan Šťastný"
    if name.lower() == "iva" and "česká lípa" in club.lower():
        return "Iva Šedivá"
    if name.lower() == "miloš" and "tábor" in club.lower():
        return "Miloš Kotek"
    if name.lower() in ["michal", "muchal"] and "železný brod" in club.lower():
        return "Michael Veřtát"
    
    if not name or len(name) < 3 or name.lower() in ["neuveden", "neznámý", "neznamy", "pořadatel", "oddíl", "-", "---", "none", "vrchní", "hlavní", "sk vs č. budějovice", "pau fra"] or "viz" in name.lower():
        return "Neuveden"
        
    # Standardize name capitalization: If ALL UPPERCASE or all lowercase, capitalize each word
    words = name.split()
    cleaned_words = []
    for w in words:
        if w.isupper() or w.islower():
            cleaned_words.append(w.capitalize())
        else:
            cleaned_words.append(w)
    name = " ".join(cleaned_words)
    
    # Specific known name normalizations / typos / reversed order
    name_replacements = {
        "p.Schreiber Zbyněk": "Zbyněk Schreiber",
        "P.schreiber Zbyněk": "Zbyněk Schreiber",
        "Zbyněk Schreiber": "Zbyněk Schreiber",
        "Schreiber Zbyněk": "Zbyněk Schreiber",
        "Šamánek Bohuslav": "Bohuslav Šamánek",
        "Bohuslav Samanek": "Bohuslav Šamánek",
        "Veřtát Michael": "Michael Veřtát",
        "Michal Veřtát": "Michael Veřtát",
        "Muchal Veřtát": "Michael Veřtát",
        "Jan Štastný": "Jan Šťastný",
        "Jan Šťastny": "Jan Šťastný",
        "Jan Stastny": "Jan Šťastný",
        "Knebel Robert": "Robert Knebel",
        "Vaclav Vondra": "Václav Vondra",
        "Vondra Václav": "Václav Vondra",
        "Roman Pláchý": "Roman Plachý",
        "Zdenek Bocek": "Zdeněk Boček",
        "Jiri Holy": "Jiří Holý",
        "Jirka Holý": "Jiří Holý",
        "Jirí Holý": "Jiří Holý",
        "Jiří Holý St.": "Jiří Holý st.",
        "Jiří Holý Ml.": "Jiří Holý ml.",
        "Vladislav Galuska": "Vladislav Galuška",
        "Lukas Novosad": "Lukáš Novosad",
        "Ondrej Zajic": "Ondřej Zajíc",
        "Tomas Slovak": "Tomáš Slovák",
        "Pavel Mrazek": "Pavel Mrázek",
        "Martin Buchtel": "Martin Buchtel",
        "Petr Cech": "Petr Čech",
        "Vitezslav Hales": "Vítězslav Haleš",
        "Vítězslav Hales": "Vítězslav Haleš",
        "Vitezslav Haleš": "Vítězslav Haleš",
        "Aleš Kropáček - Předseda Oddílu": "Aleš Kropáček",
        "Jaroslav Kvapil": "Jaroslav Kvapil",
        "Martin Říha": "Martin Říha",
        "Miloslav Říha": "Miloslav Říha",
        "Míla Říha": "Miloslav Říha",
        "Miloš Říha": "Miloslav Říha",
        "Vít Rozsypal": "Vít Rozsypal",
        "Vit Rozsypal": "Vít Rozsypal",
        "Ivan Pisvejc": "Ivan Pišvejc",
        "Jindřich Outrata": "Jindra Outrata",
        "Oldřích Weber": "Oldřich Weber",
        "Bednářová Anna": "Anna Bednářová",
        "Jakub Prűher": "Jakub Prüher",
        "Jakub Prűher Zást. Hana Tesař": "Jakub Prüher",
        "Hojdová Eliška": "Eliška Hojdová",
        "Knebel David": "David Knebel",
        "Kneblová Pavla": "Pavla Kneblová",
        "Váckav Martin": "Václav Martin"
    }
    
    for k, v in name_replacements.items():
        if name.lower() == k.lower():
            name = v
            break
            
    return name

def classify_discipline(col0):
    col0_lower = col0.lower()
    if "kros" in col0_lower or "cx" in col0_lower:
        return "KROS"
    if "sjezd" in col0_lower or "sprint" in col0_lower or "sj" in col0_lower or "sp" in col0_lower:
        return "SJEZD"
    if "slalom" in col0_lower or "sl" in col0_lower:
        return "SLALOM"
    return "SLALOM"

def run_analysis():
    with open(RAW_CACHE_FILE, 'r', encoding='utf-8') as f:
        races = json.load(f)

    with open(DIRECTORS_CACHE, 'r', encoding='utf-8') as f:
        directors_cache = json.load(f)

    cancelled_keywords = ["zrušeno", "zrušeny", "zrušen", "odloženo", "stornováno", "nedostatek vody", "Covid 19", "výsledky nejsou k dispozici"]

    directors_stats = defaultdict(lambda: {
        'races_count': 0,
        'competitors_count': 0,
        'slalom_races': 0,
        'slalom_comps': 0,
        'sjezd_races': 0,
        'sjezd_comps': 0,
        'kros_races': 0,
        'kros_comps': 0,
        'years': set(),
        'clubs': defaultdict(int),
        'race_examples': []
    })

    total_valid = 0
    total_comps = 0

    for r in races:
        col0 = r['col0']
        if any(kw in col0.lower() for kw in cancelled_keywords):
            continue
        m_comp = re.search(r'počet hodnocených:\s*(\d+)', col0, re.I)
        if not m_comp:
            continue

        comps = int(m_comp.group(1))
        total_valid += 1
        total_comps += comps

        idz = None
        for link in r.get('links', []):
            m = re.search(r'idz=(\d+)', link)
            if m:
                idz = m.group(1)
                break

        raw_dir = ""
        if idz and idz in directors_cache:
            raw_dir = directors_cache[idz].get('director', '')

        club = r.get('club', '').strip()
        dir_name = clean_director_name(raw_dir, club=club, col0=col0)
        disc = classify_discipline(col0)
        year = r['year']

        st = directors_stats[dir_name]
        st['races_count'] += 1
        st['competitors_count'] += comps
        st['years'].add(year)
        if club:
            st['clubs'][club] += 1

        if disc == 'SLALOM':
            st['slalom_races'] += 1
            st['slalom_comps'] += comps
        elif disc == 'SJEZD':
            st['sjezd_races'] += 1
            st['sjezd_comps'] += comps
        elif disc == 'KROS':
            st['kros_races'] += 1
            st['kros_comps'] += comps

        st['race_examples'].append({
            'year': year,
            'name': col0.split('/')[0].strip(),
            'comps': comps,
            'disc': disc
        })

    # Sort results
    sorted_by_races = sorted(directors_stats.items(), key=lambda x: x[1]['races_count'], reverse=True)
    sorted_by_comps = sorted(directors_stats.items(), key=lambda x: x[1]['competitors_count'], reverse=True)

    # Save full JSON dataset
    json_path = r"c:\Users\JakubBican\Documents\OneDrive - SK Vodní slalom České Budějovice, z. s\csk_whatever\data\directors_stats.json"
    clean_json = []
    for name, st in sorted_by_races:
        if name == "Neuveden":
            continue
        clean_json.append({
            'name': name,
            'races': st['races_count'],
            'competitors': st['competitors_count'],
            'avg_competitors': round(st['competitors_count'] / st['races_count'], 1) if st['races_count'] > 0 else 0,
            'slalom_races': st['slalom_races'],
            'slalom_competitors': st['slalom_comps'],
            'sjezd_races': st['sjezd_races'],
            'sjezd_competitors': st['sjezd_comps'],
            'kros_races': st['kros_races'],
            'kros_competitors': st['kros_comps'],
            'years': sorted(list(st['years'])),
            'clubs': dict(st['clubs'])
        })
    with open(json_path, 'w', encoding='utf-8') as out:
        json.dump(clean_json, out, ensure_ascii=False, indent=2)

    # Save Markdown report
    report_path = r"C:\Users\JakubBican\.gemini\antigravity\brain\505287d3-0f02-4bba-80a7-89b80845c5d8\scratch\directors_final_report.md"
    with open(report_path, "w", encoding="utf-8") as out:
        out.write("# Detailní statistika ředitelů vodáckých závodů v ČR (2012–2026)\n\n")
        out.write(f"- **Celkový počet platných závodů v databázi:** {total_valid:,}\n".replace(',', ' '))
        out.write(f"- **Celkový počet startů závodníků v cíli:** {total_comps:,}\n".replace(',', ' '))
        out.write(f"- **Celkový počet identifikovaných ředitelů:** {len(clean_json)}\n\n")
        
        out.write("## Žebříček podle počtu odřízených závodů\n\n")
        out.write("| Poř. | Jméno ředitele | Počet závodů | Celkový průtok (startů) | Průměr / závod | Slalom (záv/startů) | Sjezd (záv/startů) | Kros | Hlavní pořadatelské kluby | Aktivní roky |\n")
        out.write("| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |\n")
        
        for rank, item in enumerate(clean_json, 1):
            name = item['name']
            r_cnt = item['races']
            c_cnt = item['competitors']
            avg = item['avg_competitors']
            sl = f"{item['slalom_races']} / {item['slalom_competitors']:,}".replace(',', ' ')
            sj = f"{item['sjezd_races']} / {item['sjezd_competitors']:,}".replace(',', ' ')
            kr = f"{item['kros_races']}" if item['kros_races'] > 0 else "-"
            sorted_clubs = sorted(item['clubs'].items(), key=lambda x: x[1], reverse=True)
            clubs_str = ", ".join([c[0] for c in sorted_clubs[:2]])
            years_str = f"{item['years'][0]}–{item['years'][-1]}" if len(item['years']) > 1 else str(item['years'][0])
            out.write(f"| {rank}. | **{name}** | **{r_cnt}** | {c_cnt:,}".replace(',', ' ') + f" | {avg:.1f} | {sl} | {sj} | {kr} | {clubs_str} | {years_str} |\n")

    print(f"Analysis successfully finished. {len(clean_json)} directors found.")

if __name__ == '__main__':
    run_analysis()
