# Instrukce pro aktualizaci dat: Vodácké oddíly ČR

Tento dokument slouží jako návod pro budoucí vývojáře nebo AI agenty, jak provést aktualizaci statistik závodů divoké vody (slalom, sjezd a kros) v České republice po skončení sezóny nebo v průběhu roku.

---

## 1. Přehled architektury projektu

Projekt je navržen jako plně přenositelná a statická webová aplikace (Single Page Application), která nevyžaduje serverovou část. Veškerá data jsou uložena lokálně:

```
[Adresář projektu]
├── index.html                   # Uživatelské rozhraní (dashboard)
├── styles.css                   # Vzhled a design (glassmorphism dark mode)
├── app.js                       # Reaktivní logika filtrů a vykreslování grafů
├── data.js                      # Hlavní agregovaná databáze (načítá se do window.CSK_DATA)
├── data/
│   ├── raw_races.json           # Surová mezipaměť stažených závodů ze Slalom World (2012-dnes)
│   ├── directors_cache.json     # Mezipaměť detailů závodů a jmen ředitelů
│   └── directors_stats.json     # Statistika ředitelů závodů
└── scripts/
    ├── update_data.py           # Univerzální stahovací, čisticí a regenerační skript (Python)
    ├── analyze_directors.py     # Skript pro analýzu a generování statistik ředitelů
    └── UPDATE_GUIDE.md          # Tento návod k aktualizaci
```

---

## 2. Postup aktualizace dat

Aktualizace se provádí spuštěním Python skriptu `scripts/update_data.py`. Skript vyžaduje nainstalované knihovny `beautifulsoup4` (pro parsování HTML).

### Příprava prostředí
Pokud ještě nemáte nainstalované závislosti, nainstalujte je pomocí pip:
```bash
pip install beautifulsoup4
```

### Scénář A: Běžná aktualizace na konci sezóny (Doporučeno)
Chcete-li stáhnout data za aktuální kalendářní rok (např. skončenou sezónu 2026) a aktualizovat dashboard:
```bash
python scripts/update_data.py
```
*Skript stáhne data za aktuální rok, odstraní z `data/raw_races.json` staré záznamy pro tento konkrétní rok (aby se předešlo duplicitám), přidá nové, uloží mezipaměť a vygeneruje aktualizovaný `data.js`.*

### Scénář B: Aktualizace pro konkrétní rok (např. 2026, 2027)
Pokud chcete explicitně stáhnout a zpracovat konkrétní rok:
```bash
python scripts/update_data.py --year 2026
```

### Scénář C: Regenerace bez stahování z webu
Pokud jste upravili pouze normalizaci klubů nebo doplňková pravidla v Pythonu a chcete přegenerovat soubor `data.js` ze stávajících lokálních surových dat bez opětovného stahování z internetu:
```bash
python scripts/update_data.py --no-scrape
```

### Scénář D: Kompletní obnovení celé databáze (2012–dnes)
Pokud došlo k rozsáhlé změně historických dat nebo chcete mezipaměť vytvořit zcela znovu od nuly:
```bash
python scripts/update_data.py --all
```
*Tento režim stáhne postupně všechna léta od roku 2012 do současnosti s 1sekundovými rozestupy, aby nezatěžoval server.*

### Scénář E: Aktualizace statistiky ředitelů závodů
Po aktualizaci hlavní databáze můžete aktualizovat statistiku ředitelů:
```bash
python scripts/analyze_directors.py
```

---

## 3. Na co si dát pozor (Gotchas & Úskalí)

Při aktualizaci nebo úpravách skriptu věnujte pozornost následujícím bodům:

### 1. Kódování konzole ve Windows (Unicode/cp1252)
> [!WARNING]
> Výchozí příkazová řádka v systému Windows (PowerShell/CMD) často používá staré kódování `cp1252` (ANSI). Pokud Python skript vypíše na standardní výstup (stdout) český znak s diakritikou (např. `Č`, `ř`, `á`), může dojít k chybě `UnicodeEncodeError`.
> 
> **Řešení implementované v `update_data.py`:**
> Skript na začátku automaticky nastavuje `sys.stdout.reconfigure(encoding='utf-8')`. Do souborů (`data.js` a `raw_races.json`) zapisuje plnohodnotné UTF-8 s diakritikou.

### 2. Změna struktury webu slalom-world.com
> [!CAUTION]
> Skript stahuje roční přehledy z URL `https://www.slalom-world.com/index.php?act=00&rok={year}` a spoléhá na to, že:
> - Na stránce jsou alespoň 3 tabulky (`<table>`).
> - **Tabulka indexu 2** (`tables[2]`) je seznam všech závodů v daném roce.
> - Sloupec 0 (`td[0]`) obsahuje název závodu, typ a status (např. "... SJEZD / počet hodnocených: 98").
> - Sloupec 1 (`td[1]`) obsahuje datum ve formátu `DD.MM.YYYY` nebo `DD.MM.YYYY-DD.MM.YYYY`.
> - Sloupec 2 (`td[2]`) obsahuje přesný název pořádajícího oddílu.
> 
> Pokud provozovatel webu změní pořadí tabulek nebo jejich sloupců, bude nutné upravit indexy v metodě `scrape_year()`.

### 3. Přidání nového oddílu (Normalizace názvů)
Pokud v datech přibyde zcela nový oddíl, nebo stávající změní název, může se v tabulce dashboardu zobrazit nezarovnaný surový název.
Pro nápravu:
1. Otevřete `scripts/update_data.py`.
2. Najděte funkci `normalize_club(name)`.
3. Přidejte novou podmínku a mapování pro daný oddíl (skript provádí lowercase porovnání podřetězců).
4. Spusťte `python scripts/update_data.py --no-scrape` pro okamžité přegenerování databáze z lokální mezipaměti.

### 4. Mezinárodní a významné závody v ČR vs. Zahraniční závody
> [!IMPORTANT]
> - **Závody v Praze-Troji (Světový pohár Troja, Mistrovství Evropy Troja, WRR Troja, Olympiáda dětí a mládeže)**:
>   Tyto akce pořádané v areálu USD Praha-Troja jsou správně přisuzovány pořádajícímu oddílu **USK Praha** (pokud pořadatelem nebyla TJ DUKLA Praha).
> - **Závody pořádané českými oddíly na domácích tratích (ECA Cup České Vrbné, ECA Cup Roudnice, Lipno)**:
>   Tyto akce patří příslušným českým pořadatelům (SK VS České Budějovice, KK Roudnice, SK Vltava Č. Krumlov atd.).
> - **Čistě zahraniční mezinárodní závody (SP Tacen, SP Augsburg, ME Pau, MS La Seu, SP Ivrea atd.)**:
>   Zůstávají evidovány pod **„Neznámý oddíl“** (zahraniční pořadatel), aby je výchozí filtr aplikace **„Jen domácí“** spolehlivě odfiltroval ze statistiky českých klubů.
> - **Slovník `KNOWN_MAJOR_EVENTS`**:
>   U některých ročníků Světových pohárů v Troji Slalom-World neparsoval do souhrnné tabulky text `počet hodnocených: X`, ačkoliv k nim existují oficiální výsledkové listiny v PDF / Siwidata. Tento slovník zajišťuje přesné započtení počtu hodnocených startů (např. SP Troja 2026: 360 hodnocených, 2024: 372 hodnocených, 2022: 368 hodnocených atd.).

---

## 4. Ověření úspěšné aktualizace

Po spuštění aktualizačního skriptu:
1. Zkontrolujte, zda se v konzoli zobrazil výpis:
   `Soubor data.js byl úspěšně vygenerován a uložen.`
2. Otevřete `index.html` v prohlížeči.
3. Ověřte, že v KPI kartě **Celkový průtok** nebo **Uspořádané akce** došlo ke zvýšení čísel, případně že se v dropdownu let objevil nový rok.
4. Zkontrolujte vývojový graf, zda správně vykresluje nový trendový bod od nuly na osách Y.
