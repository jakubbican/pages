#!/usr/bin/env python3
"""Vytěžení termínové listiny závodní komise ČSK DV (formát .xls) do JSON.

Použití:
    pip install xlrd            # .xls (BIFF) umí jen xlrd, ne openpyxl
    python3 xls_extract.py Terminova_listina_2027.xls 2027 > raw-2027.json
    python3 xls_extract.py Terminova_listina_2027.xls 2027 --md   # přehled k ruční kontrole

Co skript řeší (podrobněji v ../README.md):
- List je mřížka po víkendech: sloupec B = měsíc (slučovaná buňka přes celý měsíc),
  C = datum víkendu (často slučované přes 2–3 řádky), dál sloupce podle úrovně:
  ICF | ČP | NKZ, ČPJ + ČPŽ | MČR | STAVITELÉ | pořadatel | VEŘEJNÉ ZÁVODY | … poznámka.
- Sloupce se hledají podle textu záhlaví (řádek s „datum“), ne podle pevné pozice.
- Disciplína NENÍ v textu, ale v BARVĚ PÍSMA (podle legendy listu):
  červená = slalom, modrá / tyrkysová = sjezd, oranžová = kajak kros, černá = neurčeno.
  Jedna buňka může mít víc barev (rich text) – pak se rozdělí na úseky.
- Datum se dopočítá ze slučovaných buněk a měsíce; výstup je ve formátu stránky
  („DD.-DD.MM.“, „DD.MM.-DD.MM.“, „DD.MM.“), který umí převést export do kalendáře.

Výstup je SUROVINA pro ruční redakci (místo konání, zkrácení textu, úroveň),
ne hotová data – místo konání v listině samostatně není a musí se doplnit z textu.
"""
import json
import re
import sys

import xlrd

MONTHS = {
    'LEDEN': 1, 'ÚNOR': 2, 'BŘEZEN': 3, 'DUBEN': 4, 'KVĚTEN': 5, 'ČERVEN': 6,
    'ČERVENEC': 7, 'SRPEN': 8, 'ZÁŘÍ': 9, 'ŘÍJEN': 10, 'LISTOPAD': 11, 'PROSINEC': 12,
}


def rgb_to_discipline(rgb):
    """Barva písma -> disciplína. Odstíny se v různých letech liší, proto podle převládající složky."""
    if rgb is None:
        return None
    r, g, b = rgb
    if r > 180 and g < 80 and b < 80:
        return 'Slalom'          # červená (např. 221,8,6)
    if r > 200 and 60 <= g <= 160 and b < 60:
        return 'Kros'            # oranžová (255,102,0)
    if b > 150 and r < 100:
        return 'Sjezd'           # modrá (0,102,204) i tyrkysová (51,204,204)
    return None


def find_columns(sh):
    for r in range(min(sh.nrows, 10)):
        row = [str(sh.cell_value(r, c)).strip().upper() for c in range(sh.ncols)]
        if 'DATUM' in row:
            cols = {}
            for c, v in enumerate(row):
                if v == 'DATUM':
                    cols['datum'] = c
                elif v == 'ICF':
                    cols['ICF'] = c
                elif v == 'ČP':
                    cols['ČP'] = c
                elif 'NKZ' in v or 'ČPJ' in v:
                    cols['NKZ/ČPJ/ČPŽ'] = c
                elif v == 'MČR':
                    cols['MČR'] = c
                elif 'STAVITEL' in v:
                    cols['stavitelé'] = c
                elif 'POŘADATEL' in v:
                    cols['pořadatel'] = c
                elif 'VEŘEJN' in v:
                    cols['VZ'] = c
            cols['month'] = cols['datum'] - 1
            return r, cols
    raise SystemExit('Nenašel jsem řádek se záhlavím „datum“.')


def merged_value(sh, merges, r, c):
    """Hodnota buňky, nebo levé horní buňky slučované oblasti, do které patří."""
    for (r0, r1, c0, c1) in merges:
        if r0 <= r < r1 and c0 <= c < c1:
            return sh.cell_value(r0, c0)
    return sh.cell_value(r, c)


def norm_date(raw, month, year):
    """'06.-07' / '30.4.-02.5.' / '9.-14.' / ' 30.9-3.10.' -> 'DD.-DD.MM.' apod."""
    s = re.sub(r'\s+', '', str(raw)).rstrip('.')
    if not s:
        return None
    parts = s.split('-')
    out = []
    for p in parts:
        nums = [n for n in p.split('.') if n]
        if len(nums) >= 2:
            out.append((int(nums[0]), int(nums[1])))
        elif len(nums) == 1:
            out.append((int(nums[0]), None))
    if not out:
        return None
    # chybějící měsíc: konec = měsíc oddílu; začátek bez měsíce = stejný jako konec
    end_d, end_m = out[-1]
    end_m = end_m or month
    if len(out) == 1:
        return f'{end_d:02d}.{end_m:02d}.'
    start_d, start_m = out[0]
    start_m = start_m or end_m
    if start_m == end_m:
        return f'{start_d:02d}.-{end_d:02d}.{end_m:02d}.'
    return f'{start_d:02d}.{start_m:02d}.-{end_d:02d}.{end_m:02d}.'


def segments(book, sh, r, c):
    """Text buňky rozdělený podle barvy písma: [(disciplína, text), …]."""
    text = str(sh.cell_value(r, c))
    xf = book.xf_list[sh.cell_xf_index(r, c)]
    base_font = xf.font_index
    runs = sh.rich_text_runlist_map.get((r, c)) or []
    if not runs:
        bounds = [(0, base_font)]
    elif runs[0][0] > 0:
        bounds = [(0, base_font)] + list(runs)   # začátek textu má barvu buňky
    else:
        bounds = list(runs)
    segs = []
    for i, (pos, font) in enumerate(bounds):
        end = bounds[i + 1][0] if i + 1 < len(bounds) else len(text)
        chunk = text[pos:end].strip()
        if not chunk:
            continue
        rgb = book.colour_map.get(book.font_list[font].colour_index)
        segs.append({'disciplina': rgb_to_discipline(rgb), 'text': re.sub(r'\s*\n\s*', ' | ', chunk).strip(' |')})
    return segs


def extract(path, year):
    book = xlrd.open_workbook(path, formatting_info=True)
    sh = book.sheet_by_index(0)
    merges = sh.merged_cells
    hdr, cols = find_columns(sh)
    month = None
    rows = []
    for r in range(hdr + 2, sh.nrows):
        m = str(merged_value(sh, merges, r, cols['month'])).strip().upper()
        if m in MONTHS:
            month = MONTHS[m]
        if month is None:
            continue
        raw_date = merged_value(sh, merges, r, cols['datum'])
        cells = {}
        for key in ('ICF', 'ČP', 'NKZ/ČPJ/ČPŽ', 'MČR', 'VZ'):
            c = cols.get(key)
            if c is None or not str(sh.cell_value(r, c)).strip():
                continue
            cells[key] = segments(book, sh, r, c)
        extra = [str(sh.cell_value(r, c)).strip() for c in range(max(cols.values()) + 1, sh.ncols)
                 if str(sh.cell_value(r, c)).strip()]
        org = str(sh.cell_value(r, cols['pořadatel'])).strip() if 'pořadatel' in cols else ''
        if not cells and not extra:
            continue
        rows.append({
            'row': r + 1,                       # číslo řádku jako v Excelu
            'datum_raw': str(raw_date).strip(),
            'datum': norm_date(raw_date, month, year),
            'poradatel': re.sub(r'\s*\n\s*', ' | ', org).strip(' |'),
            'bunky': cells,
            'poznamka': extra,
        })
    return rows


def to_md(rows):
    out = ['| ř. | datum | pořadatel | sloupec | disciplína | text |', '|---|---|---|---|---|---|']
    for row in rows:
        first = True
        for key, segs in row['bunky'].items():
            for s in segs:
                out.append(f"| {row['row'] if first else ''} | {row['datum'] if first else ''} | "
                           f"{row['poradatel'] if first else ''} | {key} | {s['disciplina'] or '?'} | {s['text']} |")
                first = False
        for note in row['poznamka']:
            out.append(f"| {row['row'] if first else ''} | {row['datum'] if first else ''} | | pozn. | | {note} |")
            first = False
    return '\n'.join(out)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    data = extract(sys.argv[1], int(sys.argv[2]))
    if '--md' in sys.argv:
        print(to_md(data))
    else:
        print(json.dumps(data, ensure_ascii=False, indent=1))
