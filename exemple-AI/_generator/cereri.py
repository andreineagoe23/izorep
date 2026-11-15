"""Scrie cererile de oferta: varianta cu lipsuri (cea care merge in attachments)
si varianta completa (doar in scratch, pentru pretul asteptat)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import openpyxl
from openpyxl.styles import Font, Alignment
from spec import EX1, EX2

OUT = sys.argv[1]


def ex1(complet):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Izolatii"
    ws.column_dimensions["B"].width = 95
    for i, (cod, text, tc, um, q, lipsa, extra) in enumerate(EX1["randuri"], start=1):
        ws.cell(i, 1, "IZOLATII")
        ws.cell(i, 2, (tc or text) if complet else text)
        if um:
            ws.cell(i, 4, um)
        elif complet:
            ws.cell(i, 4, "ml")
        ws.cell(i, 5, q)
    return wb


def ex2(complet):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for f in EX2["foi"]:
        ws = wb.create_sheet(f["nume"])
        ws.column_dimensions["B"].width = 10
        ws.column_dimensions["C"].width = 78
        ws.column_dimensions["F"].width = 18
        ws["A1"] = "LISTA DE CANTITATI - IZOLATII"
        ws["A1"].font = Font(bold=True, size=13)
        ws["A2"] = f"Beneficiar : {EX2['beneficiar']}"
        ws["A3"] = f"Obiectiv : {EX2['obiectiv']}"
        ws["A4"] = f"Capitol : {f['nume']}"
        r = 6
        for j, h in enumerate(f["antet"], start=1):
            c = ws.cell(r, j, h)
            c.font = Font(bold=True)
            c.alignment = Alignment(wrap_text=True)
        r += 1
        n = 0
        for (cod, text, tc, um, q, lipsa, extra) in f["randuri"]:
            if um is None:  # antet de sectiune, imbinat ca in oferta 118.1
                ws.cell(r, 1, text).font = Font(bold=True)
                ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
                r += 1
                continue
            n += 1
            ws.cell(r, 1, n)
            ws.cell(r, 2, cod)
            ws.cell(r, 3, (tc or text) if complet else text)
            ws.cell(r, 4, um)
            ws.cell(r, 5, q)
            if extra:
                ws.cell(r, 6, extra)
            r += 1
    return wb


for ex, fn in ((EX1, ex1), (EX2, ex2)):
    d = os.path.join(OUT, ex["folder"])
    os.makedirs(d, exist_ok=True)
    fn(False).save(os.path.join(d, "1-cerere-de-oferta.xlsx"))
    fn(True).save(os.path.join(d, "_complet.xlsx"))
print("ok", OUT)
