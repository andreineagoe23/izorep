"""
Oracol independent de motor: cereri noi + prețul așteptat, calculat direct din
listele de prețuri (JSON), cu regulile scrise ale firmei (pricing.md, tevi.md).
Nu importă nimic din codul aplicației.

Rulare: venv/bin/python -I genereaza.py <repo> <dir_iesire>
"""
import json, sys, os
from decimal import Decimal, ROUND_HALF_UP
import openpyxl
from openpyxl.styles import Font

REPO, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def bani(x):
    return float(Decimal(repr(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

def lista(sistem, seg):
    cale = f"{REPO}/data/price-lists/{'industrial/' if seg == 'industrial' else ''}{sistem}.json"
    return json.load(open(cale))

ISO = {15: 21.3, 20: 26.9, 25: 33.7, 32: 42.4, 40: 48.3, 50: 60.3, 65: 76.1, 80: 88.9, 100: 114.3,
       125: 139.7, 150: 168.3, 200: 219.1, 250: 273.0, 300: 323.9}

def randuri(L):
    return sorted({float(k.split("|")[0]) for k in L["cells"]})

def rand_apropiat(L, od):
    rs = randuri(L)
    best = min(rs, key=lambda r: (abs(r - od), -r))  # la egalitate, cel de sus
    return best

def rand_sus(L, d):
    for r in randuri(L):
        if r >= d - 1e-9:
            return r
    return None

def celula(L, r, g):
    rr = int(r) if r == int(r) else r
    v = L["cells"].get(f"{rr}|{g}")
    if v is None and L["sistem"] == "tabla":
        # Tabla: grosimea nu contează, rândul are o singură grosime (pricing.md, 23 noiembrie).
        alt = [float(k.split("|")[1]) for k in L["cells"] if k.split("|")[0] == str(rr)]
        if alt:
            gg = min(alt, key=lambda x: abs(x - g))
            v = L["cells"][f"{rr}|{gg:g}" if f"{rr}|{gg:g}" in L["cells"] else f"{rr}|{gg}"]
    if v is None:
        raise KeyError(f"{rr}|{g}")
    return v

def mult(L, r, cheie_forma):
    for b in L["multiplicatori"]:
        lo, hi = b["band"]
        if lo <= r <= hi:
            for k, v in b.items():
                if k == "band":
                    continue
                if cheie_forma in k.split("_") or k == cheie_forma:
                    return v
    return None

FORMA_CHEI = {"ml": "ml", "cot": "cot", "robinet": "robinet"}

def pret_teava(seg, straturi, dn=None, od_plastic=None, forma="ml"):
    """straturi: [(sistem, grosime)], ultimul poate fi ('tabla', 0.8)."""
    total = 0.0
    geometric = None
    for i, (sis, g) in enumerate(straturi):
        L = lista(sis, seg)
        if i == 0:
            r = rand_apropiat(L, ISO[dn]) if dn else rand_sus(L, od_plastic)
        elif sis == "tabla":
            r = rand_sus(L, geometric)
        else:
            r = rand_apropiat(L, geometric)
        # Pe metru liniar multiplicatorul e 1 pe orice bandă; piesele îl iau din banda lor.
        m = 1 if forma == "ml" else mult(L, r, FORMA_CHEI[forma])
        if m is not None:
            # Prețul din listă se ia rotunjit la bani, apoi × multiplicatorul (cheia lui Adrian: robinet DN50 = 18,87).
            total += bani(bani(celula(L, r, g)) * m)
        geometric = r + 2 * (g if sis != "tabla" else 0)
    return bani(total)

def pe_mp(seg, straturi):
    return bani(sum(bani(lista(s, seg)["per_mp"][str(g)]) for s, g in straturi))

def rect_ml(seg, a, b, sis, g):
    m2ml = 2 * (a + b + 2 * g) / 1000
    return bani(m2ml * lista(sis, seg)["per_mp"][str(g)])

GOL = json.load(open(f"{REPO}/data/price-lists/goluri_foc.json"))
def pret_gol(l, h):
    s = l * h / 1e6
    for p in GOL["praguri_suprafata"]:
        if s <= p["pana_la_mp"] + 1e-12:
            return p["pret_buc"]
    return bani(GOL["peste_1mp_pret_pe_mp"] * s)

# (rand, text, um, cantitate, asteptat(seg) -> (stare, pret|None), nota)
CAZURI = [
    ("Izolatie conducta apa rece DN15 cu elastomer 13 mm", "ml", 120, lambda s: ("gata", pret_teava(s, [("elastomer", 13)], dn=15))),
    ("Izolatie conducta apa rece DN25 cu elastomer 19 mm", "ml", 85.5, lambda s: ("gata", pret_teava(s, [("elastomer", 19)], dn=25))),
    ("Izolatie conducta DN40 elastomer 9 mm", "ml", 40, lambda s: ("gata", pret_teava(s, [("elastomer", 9)], dn=40))),
    ("Izolatie conducta frig DN65 elastomer 25 mm", "ml", 60, lambda s: ("gata", pret_teava(s, [("elastomer", 25)], dn=65))),
    ("Izolatie conducta frig DN100 elastomer 32 mm", "ml", 33, lambda s: ("gata", pret_teava(s, [("elastomer", 32)], dn=100))),
    ("Izolatie conducta DN150 elastomer 19 mm", "ml", 18, lambda s: ("gata", pret_teava(s, [("elastomer", 19)], dn=150))),
    ("Izolatie teava PPR Ø25 cu elastomer 9 mm", "ml", 210, lambda s: ("gata", pret_teava(s, [("elastomer", 9)], od_plastic=25))),
    ("Izolatie teava PEHD Ø63 cu elastomer 13 mm", "ml", 75, lambda s: ("gata", pret_teava(s, [("elastomer", 13)], od_plastic=63))),
    ("Izolatie teava PPR Ø90 cu elastomer 19 mm", "ml", 22, lambda s: ("gata", pret_teava(s, [("elastomer", 19)], od_plastic=90))),
    ("Izolatie conducta agent termic DN50 vata minerala 40 mm", "ml", 130, lambda s: ("gata", pret_teava(s, [("vata_minerala", 40)], dn=50))),
    ("Izolatie conducta DN80 vata minerala 50 mm cu protectie tabla aluminiu", "ml", 48, lambda s: ("gata", pret_teava(s, [("vata_minerala", 50), ("tabla", 0.8)], dn=80))),
    ("Izolatie conducta DN125 vata minerala 60 mm si tabla aluminiu 0,8 mm", "ml", 26, lambda s: ("gata", pret_teava(s, [("vata_minerala", 60), ("tabla", 0.8)], dn=125))),
    ("Izolatie vata minerala 50 mm cu protectie tabla aluminiu DN100 - COT", "buc", 4, lambda s: ("gata", pret_teava(s, [("vata_minerala", 50), ("tabla", 0.8)], dn=100, forma="cot"))),
    ("Izolatie elastomer 13 mm DN32 - COT", "buc", 6, lambda s: ("fara", None)),
    ("Izolatie robinet DN50 cu elastomer 19 mm", "buc", 3, lambda s: ("gata", pret_teava(s, [("elastomer", 19)], dn=50, forma="robinet"))),
    ("Izolare tubulatura rectangulara cu saltele vata minerala 50 mm", "mp", 200, lambda s: ("gata", pe_mp(s, [("vata_minerala", 50)]))),
    ("Izolare tubulatura rectangulara cu placi elastomer 19 mm", "m2", 64, lambda s: ("gata", pe_mp(s, [("elastomer", 19)]))),
    ("Izolare tubulatura rectangulara 500x400 cu vata minerala 40 mm", "ml", 30, lambda s: ("gata", rect_ml(s, 500, 400, "vata_minerala", 40))),
    ("Izolatie conducta DN50", "ml", 25, lambda s: ("fara", None)),
    ("Izolatie conducta elastomer DN80", "ml", 25, lambda s: ("fara", None)),
    ("Izolatie cu elastomer 13 mm", "ml", 25, lambda s: ("fara", None)),
    ("Izolatie vata minerala 50 mm cu protectie tabla DN100", "ml", 25, lambda s: ("fara", None)),
    ("Izolatie cauciuc 19 mm DN40", "ml", 44, lambda s: ("gata", pret_teava(s, [("elastomer", 19)], dn=40))),
    ("Izolatie vata minrala 30 mm DN32", "ml", 52, lambda s: ("gata", pret_teava(s, [("vata_minerala", 30)], dn=32))),
    ("Izolatie cochilii 50 mm DN65", "ml", 37, lambda s: ("gata", pret_teava(s, [("vata_minerala", 50)], dn=65))),
    ("Izolatie elastomer 9 mm DN20", "ml", 0, lambda s: ("gata", pret_teava(s, [("elastomer", 9)], dn=20))),
    ("Izolatie elastomer 13 mm DN15", None, 16, lambda s: ("verif", pret_teava(s, [("elastomer", 13)], dn=15))),
    ("Izolatie elastomer 13 mm DN25", "buc", 750, lambda s: ("verif", pret_teava(s, [("elastomer", 13)], dn=25))),
]
FOC = [  # (text, gol, cantitate, asteptat)
    ("Teava OL DN25", "140/140", 6, ("gata", pret_gol(140, 140))),
    ("Teava PPR 75", "250/200", 4, ("gata", pret_gol(250, 200))),
    ("Teava OL DN100", "400/300", 2, ("gata", pret_gol(400, 300))),
    ("Teava OL DN200", "1000/1000", 1, ("gata", pret_gol(1000, 1000))),
    ("Teava OL DN300", "1500/1000", 1, ("gata", pret_gol(1500, 1000))),
    ("Teava OL DN50", None, 3, ("fara", None)),
]

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Instalatii"
ws.append(["LISTA DE CANTITATI - IZOLATII (test oracol)"])
ws.append([])
ws.append(["Nr. crt.", "Denumire articol", "UM", "Cantitate"])
for c in ws[3]:
    c.font = Font(bold=True)
asteptari = []
for i, (text, um, q, f) in enumerate(CAZURI, start=1):
    ws.append([i, text, um, q])
    for seg in ("rezidential", "industrial"):
        st, p = f(seg)
        asteptari.append({"foaie": "Instalatii", "rand": ws.max_row, "seg": seg, "text": text, "stare": st, "pret": p})
w2 = wb.create_sheet("Treceri foc")
w2.append(["Nr. Crt.", "Denumire", "UM", "Cantitate", "dimensiune gol"])
w2.append(["Treceri prin pereti rezistenti la foc EI90"] * 5)
w2.merge_cells(start_row=2, start_column=1, end_row=2, end_column=5)
for i, (text, gol, q, (st, p)) in enumerate(FOC, start=1):
    w2.append([i, text, "buc", q, gol])
    for seg in ("rezidential", "industrial"):
        asteptari.append({"foaie": "Treceri foc", "rand": w2.max_row, "seg": seg, "text": text, "stare": st, "pret": p})
wb.save(f"{OUT}/cerere-oracol.xlsx")
json.dump(asteptari, open(f"{OUT}/asteptari.json", "w"), ensure_ascii=False, indent=1)
print(len(CAZURI) + len(FOC), "randuri,", len(asteptari), "asteptari")
