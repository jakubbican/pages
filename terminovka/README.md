# Termínová listina

Statická stránka s termínovou listinou závodů divoké vody (slalom, sjezd, sprint, kajak kros) ve vzhledu SK VS ČB.

- `index.html` – aktuální listina (teď **2027, předběžná – příprava 1, stav 7. 11. 2026**)
- `2026.html` – archiv listiny 2026 (v1, 23. 1. 2026)
- `assets/` – tokeny klubu (`skvscb-theme.css`) a logo
- `tools/xls_extract.py` – vytěžení XLS od závodní komise do JSON / přehledové tabulky

Data jsou přímo v `index.html` v poli `const data = [...]`, jeden závod = jeden objekt:

```js
{"datum": "03.-04.04.", "misto": "Vyšší Brod", "poradatel": "Loko Plzeň",
 "disciplina": "Sjezd (Klasik)", "uroven": "ČP, ČPJ, NOM, MČR", "akce": "1. a 2. ČP SJ …"}
```

- `datum` jen ve tvarech `DD.MM.`, `DD.-DD.MM.`, `DD.MM.-DD.MM.` – jinak nefunguje export do kalendáře (`parseDateString`). Rok je v `parseDateString` (`const year = …`).
- `disciplina` – text; filtr i barva štítku hledají podřetězce `slalom`, `sjezd`, `sprint`, `kros`.
- `uroven` – zkratky oddělené čárkou: `SP`, `MS`, `ME`, `WRR`, `ICF` (mezinárodní → čip INT), `MČR`, `ČP`, `ČPJ`, `ČPŽ`, `ČPV`, `NKZ`, `NOM` (nominace), `VZ`, … Neznámé zkratky padnou do čipu „Ostatní“.

## Jak aktualizovat z XLS závodní komise

Listina chodí jako `.xls` (starý binární Excel), vizuálně uspořádaná pro tisk, ne pro stroj. Na co si dát pozor:

1. **Mřížka po víkendech.** Sloupec B = měsíc (slučovaná buňka přes celý měsíc), C = datum víkendu, často slučované přes 2–3 řádky. Řádek bez data patří k víkendu nad ním (přes sloučení), ne „nikam“.
2. **Sloupce = úroveň, ne disciplína:** ICF | ČP | NKZ, ČPJ + ČPŽ | MČR | STAVITELÉ | pořadatel | VEŘEJNÉ ZÁVODY | (vpravo občas poznámka mimo tabulku).
3. **Disciplína je jen v barvě písma** (legenda v řádku 3): červená = slalom, modrá i tyrkysová = sjezd, oranžová = kajak kros. Veřejné závody bývají černé → disciplínu je nutné odvodit z názvu („slalomy“, „sjezdy“) nebo z minulého roku.
4. **Jedna buňka může mít víc barev** (rich text) – typicky Lipno nebo Roudnice, kde je v jedné buňce slalom i sjezd/kros. Skript je rozdělí na úseky.
5. **Víc pořadatelů v jedné buňce** odpovídá řádkům textu ve vedlejších buňkách (Lipno: „SKVS“ nahoře = slalom, „SK Vltava“ dole = sjezd).
6. **Místo konání v tabulce samostatně není** – je zamíchané v textu („ČP SJ Vyšší Brod“), u ICF závodů v názvu („SP Augsburg“), jinde jen pořadatel. Doplňuje se ručně.
7. **Překlepy a nekonzistence:** `27.-28..`, `30.9-3.10.`, „Trója/Troja“, „ČPJve slalomu“, pořadatel „Loko Plz“, prázdný pořadatel. Datum ověřit na den v týdnu (víkendy).

Postup:

```bash
pip install xlrd
python3 tools/xls_extract.py Terminova_listina_2027.xls 2027 --md   # přehled k ručnímu procházení
python3 tools/xls_extract.py Terminova_listina_2027.xls 2027 > raw.json
```

Výstup je surovina: pro každý řádek datum (dopočtené ze sloučení), pořadatel a texty po sloupcích s disciplínou podle barvy. Z toho se ručně poskládají záznamy do `const data` – sloučit, co k sobě patří (ČP + ČPJ + MČR na jednom místě = jeden závod), rozdělit, co je jinde nebo jiná disciplína, doplnit místo a zkrátit text.

Kontrola: vyrenderovat XLS do PDF (`soffice --headless --convert-to pdf listina.xls`) a projít proti stránce, ověřit dny v týdnu, spočítat, že žádný řádek z přehledu nezůstal nepoužitý.

Při nové sezóně: současný `index.html` zkopírovat do `ROK.html` jako archiv, v něm přepnout odkaz na aktuální listinu; v `index.html` vyměnit data, rok v `parseDateString`, titulek, štítek verze a jméno PDF.
