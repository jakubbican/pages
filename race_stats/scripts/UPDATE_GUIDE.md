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
│   └── raw_races.json           # Surová mezipaměť stažených závodů ze Slalom World (2012-dnes)
└── scripts/
    ├── update_data.py           # Univerzální stahovací, čisticí a regenerační skript (Python)
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
Chcete-li stáhnout data za aktuální kalendářní rok (např. probíhající rok 2026) a aktualizovat dashboard:
```bash
python scripts/update_data.py
```
*Skript stáhne data za aktuální rok, odstraní z `data/raw_races.json` staré záznamy pro tento konkrétní rok (aby se předešlo duplicitám), přidá nové, uloží mezipaměť a vygeneruje aktualizovaný `data.js`.*

### Scénář B: Aktualizace pro konkrétní budoucí rok (např. 2027)
Pokud chcete explicitně stáhnout a zpracovat konkrétní rok:
```bash
python scripts/update_data.py --year 2027
```

### Scénář C: Regenerace bez stahování z webu
Pokud jste upravili pouze normalizaci klubů v Pythonu a chcete přegenerovat soubor `data.js` ze stávajících lokálních surových dat bez opětovného stahování z internetu:
```bash
python scripts/update_data.py --no-scrape
```

### Scénář D: Kompletní obnovení celé databáze (2012–dnes)
Pokud došlo k rozsáhlé změně historických dat nebo chcete mezipaměť vytvořit zcela znovu od nuly:
```bash
python scripts/update_data.py --all
```
*Tento režim stáhne postupně všechna léta od roku 2012 do současnosti s 1sekundovými rozestupy, aby nezatěžoval server.*

---

## 3. Na co si dát pozor (Gotchas & Úskalí)

Při aktualizaci nebo úpravách skriptu věnujte pozornost následujícím bodům:

### 1. Kódování konzole ve Windows (Unicode/cp1252)
> [!WARNING]
> Výchozí příkazová řádka v systému Windows (PowerShell/CMD) často používá staré kódování `cp1252` (ANSI). Pokud Python skript vypíše na standardní výstup (stdout) český znak s diakritikou (např. `Č`, `ř`, `á`), dojde k chybě `UnicodeEncodeError`.
> 
> **Řešení implementované v `update_data.py`:**
> Skript veškeré výpisy do konzole v hlavní spouštěcí sekci provádí bez české diakritiky (ASCII-safe). Do souborů (`data.js` a `raw_races.json`) však zapisuje plnohodnotné UTF-8 s diakritikou, což je v pořádku. Pokud budete skript upravovat, **nepoužívejte v `print()` českou diakritiku**, nebo před spuštěním překonfigurujte kódování konzole (`sys.stdout.reconfigure(encoding='utf-8')`).

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
Pokud v datech přbyde zcela nový oddíl, nebo stávající změní název, může se v tabulce dashboardu zobrazit nezarovnaný surový název.
Pro nápravu:
1. Otevřete `scripts/update_data.py`.
2. Najděte funkci `normalize_club(name)`.
3. Přidejte novou podmínku a mapování pro daný oddíl (skript provádí lowercase porovnání podřetězců).
4. Spusťte `python scripts/update_data.py --no-scrape` pro okamžité přegenerování databáze z lokální mezipaměti.

### 4. Automatické přiřazování závodů v Troji (USK Praha)
Ve skriptu je naimplementováno asociační pravidlo pro očištění prázdných či neznámých pořadatelů:
- Pokud je u závodu nevyplněný pořadatel nebo je označen jako „Neznámý“, ale název závodu nebo lokalita obsahuje slovo **„Troja“** či **„Troji“**, skript závod automaticky přisoudí **USK Praha**.
- Toto pravidlo **automaticky ignoruje mezinárodní akce** (obsahující klíčová slova jako „Světový pohár“, „Mistrovství světa“, „World Cup“ atd.), které jsou správně ponechány pod „Neznámý oddíl“, a také závody organizované Duklou (pokud je „Dukla“ v názvu či u pořadatele).

---

## 4. Ověření úspěšné aktualizace

Po spuštění aktualizačního skriptu:
1. Zkontrolujte, zda se v konzoli zobrazil výpis:
   `Soubor data.js byl uspesne vygenerovan a ulozen.`
2. Otevřete `index.html` v prohlížeči.
3. Ověřte, že v KPI kartě **Celkový průtok** nebo **Uspořádané akce** došlo ke zvýšení čísel, případně že se v dropdownu let objevil nový rok.
4. Zkontrolujte vývojový graf, zda správně vykresluje nový trendový bod.
