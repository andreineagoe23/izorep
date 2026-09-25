#!/usr/bin/env python3
"""
ETL one-off: registrul de conversie ml -> mp (RADOIA) -> JSON in data/referinte/.

    python scripts/extract_conversii.py ../attachments

Scoate din registru DOAR seriile de diametre si sectiunile standard de
tubulatura. Suprafetele NU se extrag: sunt formula pura
(`PI x (fi + 2 x izolatie) / 1000`, respectiv `2 x (A + B + 4 x izolatie) / 1000`),
iar o suprafata salvata e primul lucru care se invecheste — depinde de grosimea
izolatiei, care e per pozitie.

Motivul pentru care seriile trebuie sa existe ca date: DN nu e un diametru
masurabil, iar conversia DIFERA dupa material. DN15 e ø21,3 la otel, ø18 la
cupru, ø20 la PP-R. Codul aplica azi tabelul de otel tuturor.
"""
import sys, json, re
from pathlib import Path

import openpyxl

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "../attachments")
OUT = Path(__file__).resolve().parent.parent / "data" / "referinte"
OUT.mkdir(parents=True, exist_ok=True)

NUME = "conversie-ml-mp-tevi-tubulaturi.xlsx"

# Antetul de sectiune -> cheia de material. Norma se citeste din paranteza
# antetului, cand exista; pentru otel nu e scrisa acolo, ci in foaia de
# instructiuni ("EN 10255") — dar tabelul contine si randuri de peste DN150,
# care nu exista in EN 10255. Vezi nota de mai jos.
MATERIALE = {
    "TEAVA NEAGRA": ("otel_negru", "EN 10255 / EN 10220"),
    "TEAVA ZINCATA": ("otel_zincat", "EN 10255 / EN 10220"),
    "TEAVA DE CUPRU": ("cupru", "EN 1057"),
    "TEAVA PP-R": ("ppr", "EN ISO 15874"),
    "TEAVA PE-HD": ("pehd", "EN 12201"),
    "TEAVA PE-Xa": ("pexa", "EN ISO 15875"),
    "TEAVA PVC-U presiune": ("pvc_presiune", "EN ISO 1452"),
    "TEAVA PVC-U canalizare": ("pvc_canalizare", "EN 1329 / EN 1401"),
}


def gaseste(name):
    hits = [p for p in SRC.rglob(name) if p.is_file()]
    if not hits:
        raise SystemExit(f"lipseste: {name} (cautat sub {SRC})")
    return hits[0]


def foaie(wb, nume):
    return [list(r) for r in wb[nume].iter_rows(values_only=True)]


wb = openpyxl.load_workbook(gaseste(NUME), data_only=True)

# --- tevi: sectiuni pe material -------------------------------------------
serii = []
material = standard = None
for row in foaie(wb, "Tevi"):
    prim = str(row[0]).strip() if row[0] is not None else ""
    cheie = next((k for k in MATERIALE if prim.startswith(k)), None)
    if cheie:
        material, standard = MATERIALE[cheie]
        continue
    if prim.lower().startswith(("subtotal", "total")):
        material = None
        continue
    if material is None or not isinstance(row[0], (int, float)):
        continue
    dn, toli, fi = row[0], row[1], row[2]
    if not isinstance(fi, (int, float)):
        continue
    serii.append({
        "material": material,
        "dn": int(dn),
        "diametru_exterior": round(float(fi), 2),
        "toli": str(toli).strip() if toli else None,
        "standard": standard,
    })

# --- tubulatura circulara: nominalul ESTE diametrul exterior ---------------
for row in foaie(wb, "Tubulatura circulara"):
    if not isinstance(row[0], (int, float)):
        continue
    serii.append({
        "material": "spiro",
        "dn": None,
        "diametru_exterior": round(float(row[0]), 2),
        "toli": str(row[1]).strip() if row[1] else None,
        "standard": None,
    })

# --- tubulatura rectangulara: doar sectiunile, nu suprafetele --------------
sectiuni = []
for row in foaie(wb, "Tubulatura rectangulara"):
    if isinstance(row[0], (int, float)) and isinstance(row[1], (int, float)):
        sectiuni.append({"a_mm": int(row[0]), "b_mm": int(row[1])})

referinte = {
    "sursa": NUME,
    "nota": (
        "Transcriere generata (openpyxl), nu fisier scris de firma in Excel. "
        "Conflict cunoscut: DN150 apare aici ca 165,1 (EN 10255), iar in "
        "tabel-conversie-tevi.docx si in dn-table.ts ca 168,3 (ISO 4200). "
        "Pentru tarifare conteaza 168,3 — randul din listele de preturi e 168."
    ),
    "formule": {
        "circular": "m2/ml = PI * (fi + 2 * izolatie) / 1000",
        "rectangular": "m2/ml = 2 * (A + B + 4 * izolatie) / 1000",
        "piese_speciale": "+5-10% suprafata pentru coturi si fitinguri",
    },
    "serii_diametre": serii,
    "sectiuni_rectangulare": sectiuni,
}

p = OUT / "conversii-tevi.json"
p.write_text(json.dumps(referinte, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

pe_material = {}
for s in serii:
    pe_material[s["material"]] = pe_material.get(s["material"], 0) + 1
print(f"  {p.name}")
for m, n in sorted(pe_material.items()):
    print(f"    {m:16s} {n:3d} randuri")
print(f"    {'rectangulare':16s} {len(sectiuni):3d} sectiuni")
print(f"\nScris in {OUT}")
