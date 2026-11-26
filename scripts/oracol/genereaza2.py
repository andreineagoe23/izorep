"""A doua cerere, alt format (Cod | Cant. | U.M. | Descriere | Observatii), notațiile din fișierele reale."""
import sys, json, importlib.util
REPO, OUT = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("g1", __file__.replace("genereaza2.py", "genereaza.py"))
sys.argv = [sys.argv[0], REPO, OUT + "/_tmp"]
g1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(g1)
import openpyxl
from openpyxl.styles import Font
bani, lista, rand_apropiat, rand_sus, celula, mult, ISO = g1.bani, g1.lista, g1.rand_apropiat, g1.rand_sus, g1.celula, g1.mult, g1.ISO

def pret(seg, straturi, od, forma="ml"):
    """od: diametrul de pornire, deja pe seria de oțel sau ø; straturi: [(sistem, grosime)]."""
    total, geometric = 0.0, None
    for i, (sis, g) in enumerate(straturi):
        L = lista(sis, "industrial" if sis == "tabla_inox" else ("rezidential" if sis == "pvc" else seg))
        if i == 0:
            r = rand_apropiat(L, od)
        elif sis in ("tabla", "pvc", "tabla_inox"):
            r = rand_sus(L, geometric)
        else:
            r = rand_apropiat(L, geometric)
        m = 1 if forma == "ml" else mult(L, r, forma)
        if m is not None:
            total += bani(bani(celula(L, r, g)) * m)
        geometric = r + 2 * (g if sis not in ("tabla", "pvc", "tabla_inox") else 0)
    return bani(total)

CAZURI = [
  ("IZ-01", 40, "ml", "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di89, g50 - ML", lambda s: ("gata", pret(s, [("vata_minerala", 50), ("tabla", 0.8)], 89))),
  ("IZ-02", 3, "buc", "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - COT", lambda s: ("gata", pret(s, [("vata_minerala", 40), ("tabla", 0.8)], 60, "cot"))),
  ("IZ-03", 50, "ml", 'Izolatie elastomer 13 mm Ø1/2"', lambda s: ("gata", pret(s, [("elastomer", 13)], ISO[15]))),
  ("IZ-04", 95, "ml", "Izolatie elastomer 19 mm DN50, inclusiv protectie PVC", lambda s: ("gata" if s == "rezidential" else "verif", pret(s, [("elastomer", 19), ("pvc", "-")], ISO[50]))),
  ("IZ-05", 36, "ml", "Izolare conducte DN100 elastomer 13mm+40mm vata minerala", lambda s: ("gata", pret(s, [("elastomer", 13), ("vata_minerala", 40)], ISO[100]))),
  ("IZ-06", 80, "ml", "Izolare conducte cupru DN15 cu elastomer 9 mm", lambda s: ("gata", pret(s, [("elastomer", 9)], 18))),
  ("IZ-07", 20, "ml", "Izolatii cu vata minerala si protectie cu tabla de inox Di114, g50 - ML", lambda s: ("gata", pret(s, [("vata_minerala", 50), ("tabla_inox", 0.4)], 114))),
  ("IZ-08", 12.5, "ml", "Izolatie elastomer 13 mm DN15", lambda s: ("gata", pret(s, [("elastomer", 13)], ISO[15]))),
  ("IZ-09", 10, "ml", "Izolatie conducta DN32 vata minerala 30 mm, protectie tabla aluminiu", lambda s: ("gata", pret(s, [("vata_minerala", 30), ("tabla", 0.8)], ISO[32]))),
]
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Oferta"
ws.append(["Proiect: Hala DEMO 2 — izolatii"]); ws.append([])
ws.append(["Cod", "Cant.", "U.M.", "Descriere lucrare", "Observatii"])
for c in ws[3]: c.font = Font(bold=True)
ast = []
for cod, q, um, text, f in CAZURI:
    ws.append([cod, q, um, text, "conform proiect"])
    for seg in ("rezidential", "industrial"):
        st, p = f(seg)
        ast.append({"foaie": "Oferta", "rand": ws.max_row, "seg": seg, "text": text, "stare": st, "pret": p, "cantitate": q})
wb.save(f"{OUT}/cerere-oracol-2.xlsx")
json.dump(ast, open(f"{OUT}/asteptari-2.json", "w"), ensure_ascii=False, indent=1)
print(len(ast), "asteptari")
