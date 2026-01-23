# DESIGN SPEC & MOODBOARD: Areál Lídy Polesné & SK VS ČB

## 1. Vize a Strategie
**Cíl:** Vytvořit moderní, sjednocující web, který prezentuje **Areál Lídy Polesné** jako živé centrum vodních sportů a zábavy, jehož srdcem a hybatelem je **SK Vodní Slalom České Budějovice**.

**Klíčová myšlenka:** "Umbrella" (Deštník). Areál zastřešuje, Klub pohání.
- **Pro veřejnost:** Přehledný rozcestník (Hospoda, Půjčovna, Koupání).
- **Pro sportovce:** Prestižní prezentace klubu, historie, úspěchů a náboru.

## 2. Vizuální Identita (Look & Feel)
Styl musí být **expresivní, čistý, dynamický**. Žádné zbytečné omáčky, důraz na vizuál (foto/video).

### Barevná paleta
*Bude upřesněna dle finálního výběru loga, ale vycházíme z:*
- **Primary Navy:** Tmavě modrá (z loga SK VS) - *Dominance, tradice, důvěra.*
- **Action White:** Čistá bílá - *Vzdušnost, prostor pro fotky.*
- **Nature Green/Blue:** (z loga Areálu/Vrbného) - *Příroda, voda, relax.*
- **Accent Red/Yellow:** (volitelně pro Call-to-Action prvky, dle dresů/partneřů).

### Typografie
*Vycházíme z materiálů ECA 2022 (bude upřesněno po kontrole fontu ve složce).*
- **Nadpisy:** Bold, moderní bezpatkové písmo (např. Montserrat, Oswald).
- **Text:** Čitelné, neutrální písmo (např. Roboto, Open Sans).

### Obrazový materiál (Mood)
Využijeme bohatý archiv (složka `podklady pro Davea` a `Galerie`).
- **Hero sekce:** Emoce, stříkající voda, detail tváře závodníka nebo letecký pohled na areál (`13 letecke snimky.png`).
- **Historie:** Černobílé nebo archivní fotky stavby (`historie 1.JPG`, `stavba 1.JPG`) v kontrastu s moderním areálem.
- **Komunita:** Děti, tréninky, radost (`14 děti.JPG`, `jezdci 1.JPG`).

## 3. Informační Architektura (Struktura webu)
Jednostránkový koncept (One-Page) s detailními podstránkami pro specifické sekce (Novinky, Závody).

### A. Hlavní stránka (Homepage)
1.  **HERO Video/Foto:** "Voda, která spojuje."
2.  **Rychlý přehled (Status bar):** Voda (teče/neteče), Hospoda (Open/Close), Teplota.
3.  **SK VS ČB (Brand):** "Jsme tu doma." (Odkaz na Nábor, Podporu).
4.  **Služby Areálu (Karty):**
    - Restaurace Na Kanále
    - Vodácké Centrum (Půjčovna)
    - River Surfing / Dračí lodě
5.  **Kalendář & Novinky:** Co se děje.
6.  **Patička:** Partneři, Mapa, Kontakty.

### B. Klíčový obsah (Zdroje textů)
*   **Historie & Rekonstrukce:** Čerpáme z `SKVSCB_Reonstrukce Areálu...pdf`.
*   **Vize & Hodnoty:** Čerpáme z `Prezentace obecna hotovo.pptx`.
*   **Historická data:** Složka `podklady pro Davea na MS Sprint`.

## 4. Technické řešení
- **Platforma:** GitHub Pages.
- **Engine:** Jekyll (statický generátor).
- **Styling:** Tailwind CSS (pro rychlý a moderní design).
- **Správa obsahu:** Editace Markdown souborů (pro Novinky) + Config (pro otevírací doby).

## 5. Další kroky
1.  Připravit `_config.yml` a základní kostru Jekyllu.
2.  Vytvořit HTML šablonu (Layout) pro Hlavní stránku.
3.  Vytáhnout texty z PDF/PPTX (ručně nebo pomocí nástrojů).
4.  Vybrat a optimalizovat fotky pro web.
