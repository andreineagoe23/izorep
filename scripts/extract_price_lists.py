#!/usr/bin/env python3
"""
ETL one-off: liste de preturi Excel (RADOIA) -> JSON versionat in data/price-lists/.

Doua segmente. Rezidentialul iese PLAT in data/price-lists/ pentru ca acolo il
cauta src/pricing/lists.ts cu import static — e segmentul pe care ruleaza
motorul. Industrialul iese in data/price-lists/industrial/ si e consumat doar
prin baza de date, pana cand motorul stie sa aleaga segmentul.

Ruleaza o singura data, sau cand firma trimite liste noi:
    python scripts/extract_price_lists.py ../attachments

Iesirea e commit-uita in repo si consumata de src/pricing/. Motivul pentru care
ETL-ul e in Python si nu in TS: fisierele sursa sunt .xls (BIFF8) vechi, iar
xlrd e singura bibliotecă care le citește fiabil.
"""
import sys, json, re
from pathlib import Path

import openpyxl, xlrd

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "../attachments")
OUT = Path(__file__).resolve().parent.parent / "data" / "price-lists"
OUT_IND = OUT / "industrial"
OUT.mkdir(parents=True, exist_ok=True)
OUT_IND.mkdir(parents=True, exist_ok=True)


def gaseste(name):
    """Cauta fisierul recursiv sub SRC.

    Listele stau grupate pe segment (preturi/rezidentiale, preturi/industriale,
    preturi/rafinarie), nu plat in radacina. Cautarea dupa nume, nu dupa cale,
    tine ETL-ul independent de aranjarea folderelor. Doua fisiere cu acelasi
    nume in segmente diferite sunt o eroare, nu o alegere: opreste.
    """
    hits = [p for p in SRC.rglob(name) if p.is_file()]
    if not hits:
        raise SystemExit(f"lipseste: {name} (cautat sub {SRC})")
    if len(hits) > 1:
        raise SystemExit(f"ambiguu: {name} apare in {[str(h) for h in hits]}")
    return hits[0]


def rows_xls(name):
    ws = xlrd.open_workbook(str(gaseste(name))).sheet_by_index(0)
    return [ws.row_values(i) for i in range(ws.nrows)]


def rows_xlsx(name, sheet=0):
    wb = openpyxl.load_workbook(gaseste(name), data_only=True)
    ws = wb.worksheets[sheet]
    return [list(r) for r in ws.iter_rows(values_only=True)]


def num(v):
    """Celula -> float sau None. Prinde si '30,36' si '134.43 / mp'."""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 6)
    m = re.search(r"\d+(?:[.,]\d+)?", str(v))
    return round(float(m.group(0).replace(",", ".")), 6) if m else None


# --------------------------------------------------------------------------
# 1. Matrici diametru x grosime (elastomer, vata minerala)
# --------------------------------------------------------------------------
def matrix(rows, *, first_row, last_row, thicknesses, cols, mp_row):
    """
    Matricile sunt RARE: combinatiile care nu se executa sunt goale.
    Gol = "nu se oferteaza", NU "pret zero". Le omitem din JSON.
    """
    cells = {}
    for r in range(first_row, last_row + 1):
        d = num(rows[r][0])
        if d is None:
            continue
        for th, c in zip(thicknesses, cols):
            p = num(rows[r][c])
            if p is not None:
                cells[f"{int(d)}|{th}"] = round(p, 6)
    per_mp = {}
    for th, c in zip(thicknesses, cols):
        p = num(rows[mp_row][c])
        if p is not None:
            per_mp[str(th)] = round(p, 6)
    return {"cells": cells, "per_mp": per_mp}


# multiplicatorii de elemente speciale — identici ca formă în toate listele,
# dar cu valori proprii per sistem. banda = [min_diam, max_diam].
BANDS_PIPE = [
    {"band": [18, 60],   "ml": 1, "manseta": 0.25, "cot_teu_reductie": None, "robinet_vana_flansa_contor": 1.5, "pompa_filtru_distribuitor": 2},
    {"band": [76, 114],  "ml": 1, "manseta": 0.5,  "cot_teu_reductie": 1,    "robinet_vana_flansa_contor": 2,   "pompa_filtru_distribuitor": 2.5},
    {"band": [140, 273], "ml": 1, "manseta": 0.5,  "cot_teu_reductie": 2,    "robinet_vana_flansa_contor": 2.5, "pompa_filtru_distribuitor": 3.5},
    {"band": [324, 9999],"ml": 1, "manseta": 0.5,  "cot_teu_reductie": 3,    "robinet_vana_flansa_contor": 3,   "pompa_filtru_distribuitor": 4.5},
]
BANDS_SHEET = [  # tabla si PVC au benzi proprii (vezi subsolul listelor)
    {"band": [80, 200],  "ml": 1, "cot_teu_reductie": 1, "flansa_robinet_contor_distribuitor": 2, "pompa_filtru_vana23": 2.5},
    {"band": [210, 400], "ml": 1, "cot_teu_reductie": 2, "flansa_robinet_contor_distribuitor": 3, "pompa_filtru_vana23": 3},
    {"band": [401, 9999],"ml": 1, "cot_teu_reductie": 2, "flansa_robinet_contor_distribuitor": 3, "pompa_filtru_vana23": 4},
]

out = {}

# --- elastomer ------------------------------------------------------------
r = rows_xls("pret-rezidential-elastomer.xls")
out["elastomer"] = {
    "sistem": "elastomer",
    "denumire": "Izolatii conducte cu cauciuc elastomeric, clasa B-s3,d0",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [9, 13, 19, 25, 32],
    **matrix(r, first_row=12, last_row=30, thicknesses=[9, 13, 19, 25, 32], cols=[1, 2, 3, 4, 5], mp_row=31),
    "multiplicatori": BANDS_PIPE,
}

# --- vata minerala --------------------------------------------------------
r = rows_xls("pret-rezidential-vata-minerala.xls")
out["vata_minerala"] = {
    "sistem": "vata_minerala",
    "denumire": "Izolatii conducte cu vata minerala caserata cu folie de aluminiu",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [20, 30, 40, 50, 60, 80, 100],
    **matrix(r, first_row=10, last_row=29, thicknesses=[20, 30, 40, 50, 60, 80, 100], cols=[1, 2, 3, 4, 5, 6, 7], mp_row=30),
    "multiplicatori": [dict(b, cot_teu_reductie=(None if b["band"] == [18, 60] else b["cot_teu_reductie"])) for b in BANDS_PIPE],
}

# --- tabla (doua blocuri pe aceeasi foaie: A-C si D-F) --------------------
r = rows_xlsx("pret-rezidential-tabla-aluminiu.xlsx")
cells = {}
for i in range(10, 42):
    row = r[i]
    for d_col, price_cols in ((0, [(0.6, 1), (0.8, 2)]), (3, [(0.8, 4), (1.0, 5)])):
        d = num(row[d_col])
        if d is None:
            continue
        for th, c in price_cols:
            p = num(row[c])
            if p is not None:
                cells[f"{int(d)}|{th}"] = round(p, 6)
out["tabla"] = {
    "sistem": "tabla",
    "denumire": "Protectie izolatii cu tabla de aluminiu (jachetare)",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [0.6, 0.8, 1.0],
    "cells": cells,
    "per_mp": {"0.8": num(r[42][2])},
    "multiplicatori": BANDS_SHEET,
}

# --- PVC (doua blocuri: A/B si C/E — atentie, coloana D e goala) ----------
r = rows_xls("pret-rezidential-pvc.xls")
cells = {}
for i in range(8, 40):
    row = r[i]
    for d_col, p_col in ((0, 1), (2, 4)):
        d, p = num(row[d_col]), num(row[p_col])
        if d is not None and p is not None:
            cells[f"{int(d)}|-"] = round(p, 6)
out["pvc"] = {
    "sistem": "pvc",
    "denumire": "Izolatii conducte PVC",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [],
    "cells": cells,
    "per_mp": {},
    "multiplicatori": BANDS_SHEET,
}

# --- inchideri goluri la foc (pret ADITIV: gol + wrap + colier) -----------
r = rows_xlsx("pret-rezidential-goluri-foc.xlsx")
praguri = []
for i in range(12, 24):
    label, price = r[i][2], num(r[i][4])
    if label and price is not None:
        mp = num(label)
        praguri.append({"pana_la_mp": mp, "pret_buc": price})
peste = num(r[23][4])
# Banda WRAP are DOUA tabele in lista firmei, cu preturi complet diferite
# la acelasi diametru: "conducte plastic" (2-6 infasurari, ø32-ø160) si
# "conducte otel" (1 infasurare, ø22-ø168). La ø140 sunt 65,665 fata de
# 12,19 EUR. Varianta anterioara le citea ca pe un singur tabel si taia
# arbitrar la randul 60, pastrand din otel doar primul rand — deci ø140 otel
# ar fi fost tarifat cu pretul de plastic. Sectiunile se recunosc dupa
# antetul lor, nu dupa indici ficsi.
H_PLASTIC = re.compile(r"banda\s+WRAP.*conducte\s+plastic|conducte\s+plastic.*banda\s+WRAP", re.I)
H_OTEL = re.compile(r"banda\s+WRAP.*conducte\s+otel|conducte\s+otel.*banda\s+WRAP", re.I)
H_COLIER = re.compile(r"colier\s+de\s+protectie\s+antifoc", re.I)

wrap_plastic, wrap_otel, colier = [], [], []
sectiune = None
for row in r:
    antet = " ".join(str(c) for c in row if c)
    if H_PLASTIC.search(antet):
        sectiune = wrap_plastic
        continue
    if H_OTEL.search(antet):
        sectiune = wrap_otel
        continue
    if H_COLIER.search(antet):
        sectiune = colier
        continue
    if sectiune is None or len(row) < 3 or not row[1]:
        continue
    # Coloana "Dimensiune conducta" e scrisa "ø32". Fara marcajul asta,
    # randul e antet de tabel sau nota, nu o intrare de pret.
    if not re.match(r"\s*[øØ]\s*\d", str(row[1])):
        continue
    d, pret = num(row[1]), num(row[2])
    if d is None or pret is None:
        continue
    if sectiune is colier:
        colier.append({"diametru": int(d), "pret_urcare_1colier": pret,
                       "pret_orizontal_2coliere": num(row[4])})
    else:
        sectiune.append({"diametru": int(d), "pret": pret, "obs": str(row[4] or "")})
out["goluri_foc"] = {
    "sistem": "goluri_foc",
    "denumire": "Inchideri goluri la foc EI60 / EI90 / EI120",
    "contine": "material + manopera",
    "moneda": "EUR",
    "regula": "pret final = gol (dupa suprafata) + banda WRAP (optional) + colier PROMASTOP (optional)",
    "praguri_suprafata": praguri[:-1],
    "peste_1mp_pret_pe_mp": peste,
    "banda_wrap": {"plastic": wrap_plastic, "otel": wrap_otel},
    "colier_promastop": colier,
}

# --------------------------------------------------------------------------
# INDUSTRIAL — aceeasi forma, alte valori. Primit 4 septembrie 2026.
#
# Nu e un coeficient peste rezidential: vata e x1,25 constant, elastomerul
# x1,25 la 9/13/19 mm dar x1,20 la 25/32 mm, iar tabla variaza pe rand in jurul
# lui x1,10-1,11. De aceea sunt liste proprii, nu un multiplicator.
# --------------------------------------------------------------------------
ind = {}

r = rows_xlsx("pret-industrial-elastomer.xlsx")
ind["elastomer"] = {
    "sistem": "elastomer",
    "denumire": "Izolatii conducte cu cauciuc elastomeric, clasa B-s3,d0 (industrial)",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [9, 13, 19, 25, 32],
    **matrix(r, first_row=11, last_row=28, thicknesses=[9, 13, 19, 25, 32], cols=[1, 2, 3, 4, 5], mp_row=29),
    "multiplicatori": BANDS_PIPE,
}

r = rows_xlsx("pret-industrial-vata-minerala.xlsx")
ind["vata_minerala"] = {
    "sistem": "vata_minerala",
    "denumire": "Izolatii conducte cu vata minerala caserata cu folie de aluminiu (industrial)",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [20, 30, 40, 50, 60, 80, 100],
    **matrix(r, first_row=12, last_row=32, thicknesses=[20, 30, 40, 50, 60, 80, 100], cols=[1, 2, 3, 4, 5, 6, 7], mp_row=33),
    "multiplicatori": [dict(b, cot_teu_reductie=(None if b["band"] == [18, 60] else b["cot_teu_reductie"])) for b in BANDS_PIPE],
}

# Tabla industriala are ALTE coloane decat cea rezidentiala: 0,8 mm din primul
# bloc sta in coloana D, nu C. Citita cu indicii rezidentiali, tot blocul de
# 0,8 pana la ø390 ar lipsi.
r = rows_xlsx("pret-industrial-tabla-aluminiu.xlsx")
cells = {}
for i in range(11, 43):
    row = r[i]
    for d_col, price_cols in ((0, [(0.6, 1), (0.8, 3)]), (4, [(0.8, 5), (1.0, 6)])):
        d = num(row[d_col])
        if d is None:
            continue
        for th, c in price_cols:
            p = num(row[c])
            if p is not None:
                cells[f"{int(d)}|{th}"] = round(p, 6)
ind["tabla"] = {
    "sistem": "tabla",
    "denumire": "Protectie izolatii cu tabla de aluminiu (jachetare, industrial)",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [0.6, 0.8, 1.0],
    "cells": cells,
    "per_mp": {"0.6": num(r[43][1]), "0.8": num(r[43][3])},
    "multiplicatori": BANDS_SHEET,
}

# Tabla de inox: sistem NOU, fara corespondent rezidential. E jachetare, ca
# aluminiul — indexata pe diametrul exterior al izolatiei, nu pe DN, in ciuda
# antetului care scrie "DN". Doua blocuri de cate patru coloane.
r = rows_xls("pret-industrial-tabla-inox.xls")
cells = {}
for i in range(8, 40):
    row = r[i]
    for d_col, price_cols in ((0, [(0.4, 1), (0.5, 2), (0.6, 3)]), (4, [(0.4, 5), (0.5, 6), (0.6, 7)])):
        d = num(row[d_col])
        if d is None:
            continue
        for th, c in price_cols:
            p = num(row[c])
            if p is not None:
                cells[f"{int(d)}|{th}"] = round(p, 6)
ind["tabla_inox"] = {
    "sistem": "tabla_inox",
    "denumire": "Protectie izolatii cu tabla de inox (jachetare, industrial)",
    "contine": "material + manopera",
    "moneda": "EUR",
    "grosimi_mm": [0.4, 0.5, 0.6],
    "cells": cells,
    "per_mp": {"0.4": num(r[40][1]), "0.5": num(r[40][2]), "0.6": num(r[40][3])},
    "multiplicatori": BANDS_SHEET,
}


def scrie(unde, liste, eticheta):
    print(f"\n{eticheta}")
    for k, v in liste.items():
        p = unde / f"{k}.json"
        p.write_text(json.dumps(v, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        n = len(v.get("cells", {})) or len(v.get("praguri_suprafata", []))
        print(f"  {p.name:22s} {n:4d} intrari")
    print(f"  -> {unde}")


scrie(OUT, out, "REZIDENTIAL")
scrie(OUT_IND, ind, "INDUSTRIAL")
