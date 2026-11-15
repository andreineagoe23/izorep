"""Construieste folderul exemple-AI: oferta asteptata, comenzi, avize, facturi,
situatii si cheia de verificare, din rezultatele importului (json) si spec."""
import sys, os, json, shutil
sys.path.insert(0, os.path.dirname(__file__))
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from spec import EX1, EX2

SCR, DEST = sys.argv[1], sys.argv[2]
B = Font(bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")
THIN = Side(style="thin", color="999999")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def r2(x):
    return round(x + 1e-9, 2)


def incarca(folder, nume):
    d = json.load(open(os.path.join(SCR, folder, nume)))
    return {(l["foaie"], l["rand"]): l for l in d["linii"]}


def stare(l):
    if l is None or not l["sistem"]:
        return "Lasat afara"
    if l["pret"] is None:
        return "Fara pret"
    return "De verificat" if l["validare"] else "Gata"


def randuri_ex(ex):
    """(foaie, rand_excel, cod, text, complet, um, q, lipsa, extra, sectiune)"""
    out = []
    if "randuri" in ex:
        for i, (cod, t, tc, um, q, lipsa, extra) in enumerate(ex["randuri"], start=1):
            out.append(("Izolatii", i, cod, t, tc or t, um, q, lipsa, extra, None))
    else:
        for f in ex["foi"]:
            r, sect = 7, None
            for (cod, t, tc, um, q, lipsa, extra) in f["randuri"]:
                if um is None:
                    sect = t
                else:
                    out.append((f["nume"], r, cod, t, tc or t, um, q, lipsa, extra, sect))
                r += 1
    return out


# Ce trebuie sa iasa acolo unde importul „complet” nu e raspunsul:
# cod -> (pret asteptat sau None, starea asteptata, explicatie)
ASTEPTAT = {
    "A14": (101.84, "De verificat", "vata 100 mm (tabelul de grosimi uzuale al firmei, DN100 si peste) + tabla 0,8"),
    "A16": (39.26, "De verificat", "UM buc fara piesa numita: omul alege piesa (cot/teu la ø89 = pretul pe ml)"),
    "A27": (27.99, "De verificat", "PVC pe oferta industriala: pret din lista rezidentiala, de confirmat"),
    "A30": (1445.69, "Gata", "suprafata (manta + capace) x pret/mp x 2,47, ca distribuitorul din Oferta 284"),
    "A31": (980.00, "Fara pret", "nu are D si L: pretul se pune de mana (980 € e exemplu)"),
    "A33": (None, "Lasat afara", "demontare: nu e in listele de izolatii"),
    "A34": (None, "Lasat afara", "alta meserie"),
    "B20": (None, "Fara pret", "nu are diametru: nu se poate ghici, se cere clientului"),
    "B23": (23.13, "De verificat", "peste ultimul rand: formula firmei pe mp"),
    "B25": (None, "Lasat afara", "alta meserie"),
    "B26": (None, "Lasat afara", "alta meserie"),
    "C02": (16.23, "De verificat", "peste ultimul rand: formula firmei pe mp"),
    "C06": (None, "Lasat afara", "tubulatura neizolata"),
    "C07": (48.00, "De verificat", "protectie la foc: pret de mana (48 €/m² e singurul semnat, la EI60)"),
    "C08": (36.40, "De verificat", "rectangular in metri: 2 x (400 + 300 + 4 x 50) / 1000 = 1,8 m²/ml x 20,22 €/m²"),
    "D05": (None, "Fara pret", "nu are dimensiunea golului: se cere clientului"),
    "D06": (30.36, "De verificat", "materialul tevii nu e scris: otel presupus"),
    "D07": (26.89, "Gata", "gol 260/260 = 0,07 m²"),
    "D08": (26.89, "De verificat", "pat de cabluri: doar golul 400/200 = 0,08 m²; banda si colierul nu se aplica"),
}


def asteptat(ex, rr, complet):
    foaie, rand, cod = rr[0], rr[1], rr[2]
    if cod in ASTEPTAT:
        return ASTEPTAT[cod]
    l = complet.get((foaie, rand))
    if l is None or l["pret"] is None:
        return (None, "Lasat afara", "")
    return (l["pret"], "Gata", l["straturi"] or "inchidere gol la foc")


def verdict(pa, sa, l):
    s = stare(l)
    p = l["pret"] if l else None
    if pa is None:
        if s == sa:
            return "corect"
        if s == "Lasat afara":
            return "a ramas afara (corect ar fi „Fara pret”)"
        if p is None:
            return "corect (fara pret)"
        return "GRESIT pe tacute" if s == "Gata" else "pret propus, marcat"
    if s == "Lasat afara":
        return "PIERDUT: a ramas afara din oferta"
    if p is None:
        return "fara pret: il completeaza omul"
    if abs(p - pa) < 0.006:
        if s == "Gata" and sa == "De verificat":
            return "pret bun, dar iese „Gata” fara sa ceara verificare"
        return "corect" if s == sa or sa != "Gata" else "corect, cere confirmare"
    return "GRESIT pe tacute (iese „Gata”)" if s == "Gata" else "pret gresit, dar marcat „De verificat”"


CULOARE = {"corect": "E2F0D9", "GRESIT": "F8CBAD", "PIERDUT": "F8CBAD", "pret gresit": "FFE699",
           "fara pret": "FFF2CC", "pret bun": "FFE699", "a ramas": "FFF2CC", "pret propus": "FFF2CC"}


def cheie(ex, d):
    complet = incarca(ex["folder"], "_complet.fara.json")
    fara = incarca(ex["folder"], "1-cerere-de-oferta.fara.json")
    model = incarca(ex["folder"], "cerere.model.json")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cheie"
    cap = ["Foaia", "Randul din Excel", "Cod", "Textul din cerere", "Ce lipseste intentionat", "Ce trebuie sa iasa",
           "Pret unitar asteptat (€)", "Starea asteptata", "Fara AI: starea", "Fara AI: pret", "Fara AI: verdict",
           "Cu AI: starea", "Cu AI: pret", "Cu AI: ce a inteles", "Cu AI: verdict"]
    ws.append([f"Cheie de verificare - {ex['obiectiv']} (oferta {ex['tip']}). Rulat pe 15.11.2026, ramura ux-lucrare, din linia de comanda."])
    ws["A1"].font = Font(bold=True, size=12)
    ws.append(["„Fara AI” = doar regulile. „Cu AI” = regulile, apoi modelul pe randurile necitite, de doua ori. Date inventate."])
    ws.append([])
    ws.append(cap)
    for c in ws[4]:
        c.font = B
        c.alignment = WRAP
        c.fill = PatternFill("solid", fgColor="D9D9D9")
    stat = {}
    rez = []
    for rr in randuri_ex(ex):
        foaie, rand, cod, t, tc, um, q, lipsa, extra, sect = rr
        pa, sa, ce = asteptat(ex, rr, complet)
        lf, lm = fara.get((foaie, rand)), model.get((foaie, rand))
        vf, vm = verdict(pa, sa, lf), verdict(pa, sa, lm)
        inteles = ""
        if lm and lm["sistem"]:
            inteles = lm["straturi"] or f'{lm["sistem"]} {lm["dtip"] or ""}{lm["d"] or ""}'
            if lm["avert"]:
                inteles += " [" + ", ".join(lm["avert"]) + "]"
            if lm["motive"]:
                inteles += " (" + ", ".join(lm["motive"]) + ")"
        ws.append([foaie, rand, cod, t + (f" | {extra}" if extra else ""), lipsa or "nimic (rand martor)", ce, pa, sa,
                   stare(lf), lf["pret"] if lf else None, vf, stare(lm), lm["pret"] if lm else None, inteles, vm])
        for col, v in ((11, vf), (15, vm)):
            for k, cul in CULOARE.items():
                if v.startswith(k):
                    ws.cell(ws.max_row, col).fill = PatternFill("solid", fgColor=cul)
                    break
        stat[vm.split(":")[0].split(" (")[0]] = stat.get(vm.split(":")[0].split(" (")[0], 0) + 1
        rez.append((rr, pa, sa, ce, lf, lm, vf, vm))
    for i, w in enumerate([14, 8, 7, 62, 34, 46, 10, 13, 13, 9, 30, 13, 9, 40, 34], start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=5):
        for c in row:
            c.alignment = WRAP
    ws.freeze_panes = "E5"
    wb.save(os.path.join(d, "cheie-de-verificare.xlsx"))
    return rez, stat


NOTE = [
    "Preturile sunt exprimate in Euro si nu contin TVA . Plata se face in Lei la cursul BNR din ziua facturarii.",
    "Plata lucrarilor se face pe baza cantitatilor real executate si aprobate in situatii de lucrari.",
]


def pozitii_oferta(ex, rez):
    """Pozitiile care intra in oferta: (nr, foaie, cod, denumire, um, q, extra, pret, sectiune)."""
    out, n = [], 0
    for (rr, pa, sa, ce, lf, lm, vf, vm) in rez:
        foaie, rand, cod, t, tc, um, q, lipsa, extra, sect = rr
        if pa is None:
            continue
        n += 1
        out.append((n, foaie, cod, tc, um or "ml", q, extra, pa, sect))
    return out


def oferta_ex1(ex, poz, d):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Izolatii"
    for col, w in zip("ABCDEF", (20, 78, 8, 14, 16, 18)):
        ws.column_dimensions[col].width = w
    ws["A5"] = "OFERTA LUCRARI IZOLATII TERMICE"
    ws["A5"].font = Font(bold=True, size=14)
    ws["C7"] = f"Nr. {ex['numar']} / {ex['data']}"
    ws["A10"] = ex["atentia"]
    ws["A11"] = f"Beneficiar : {ex['beneficiar']}"
    ws["A12"] = f"Obiectiv : {ex['obiectiv']}"
    cap = ["Identificare_Norma", "Denumire", "UM", "TOTAL  CANTITATE", "Pret unitar\nEuro /elem", "Pret total Euro"]
    for j, h in enumerate(cap, start=1):
        c = ws.cell(15, j, h)
        c.font = B
        c.alignment = WRAP
        c.border = BOX
    r = 16
    for (n, foaie, cod, den, um, q, extra, pret, sect) in poz:
        vals = ["IZOLATII", den, um, q, pret, f"=D{r}*E{r}"]
        for j, v in enumerate(vals, start=1):
            c = ws.cell(r, j, v)
            c.border = BOX
            if j == 2:
                c.alignment = WRAP
        ws.cell(r, 6).number_format = "#,##0.00"
        r += 1
    ultim = r - 1
    r += 1
    ws.cell(r, 1, "TOTAL LUCRARI IZOLATII TERMICE (fara TVA)").font = B
    ws.cell(r, 6, f"=SUM(F16:F{ultim})").font = B
    tot = r
    r += 2
    ws.cell(r, 1, f"DISCOUNT {ex['discount']} % (PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE CALENDARISTICE DE LA DATA EMITERII)")
    ws.cell(r, 6, f"=F{tot}*{ex['discount']}%")
    dis = r
    r += 2
    ws.cell(r, 1, "TOTAL GENERAL (FARA TVA)").font = B
    ws.cell(r, 6, f"=F{tot}-F{dis}").font = B
    for rr in (tot, dis, r):
        ws.cell(rr, 6).number_format = "#,##0.00"
    r += 2
    ws.cell(r, 1, "Nota  :").font = B
    for t in NOTE + [
        "PVC-ul este ofertat din lista rezidentiala (nu exista lista industriala de PVC).",
        "Rezervorul de condens: pret pus de mana, fara dimensiuni in cerere.",
        "Pretul elementelor speciale pentru izolatiile cu vata minerala este urmatorul:",
    ]:
        r += 1
        ws.cell(r, 1, t)
    for linie in (["Diametru Ø", "Pret / ml", "Pret / cot, teu, reductie", "Pret / robinet, vana, contor, flansa, compensator", "Pret / pompa, filtru Y, distribuitor/colector"],
                  ["18 - 60", "X", "", "X*1.5", "X*2"], ["76 - 114", "X", "X", "X*2", "X*2,5"],
                  ["140 – 273", "X", "X*2", "X*2,5", "X*3,5"], ["˃ 324", "X", "X*3", "X*3", "X*4,5"]):
        r += 1
        for j, v in enumerate(linie, start=1):
            ws.cell(r, j, v).alignment = WRAP
    r += 2
    ws.cell(r, 1, "Pretul elementelor speciale pentru protectiile cu tabla de aluminiu este urmatorul:")
    for linie in (["Diametru Ø", "Pret / ml", "Pret / cot, teu, reductie", "Pret / flansa, compensator, robinet, vana, contor, distribuitor", "Pret / pompa, filtru Y, vana 2-3 cai"],
                  ["80 – 200", "X", "X", "X*2", "X*2,5"], ["210 - 400", "X", "X*2", "X*3", "X*3"], ["˃ 400", "X", "X*2", "X*3", "X*4"]):
        r += 1
        for j, v in enumerate(linie, start=1):
            ws.cell(r, j, v).alignment = WRAP
    r += 3
    ws.cell(r, 1, "PALTINIS,")
    ws.cell(r, 6, ex["firma"])
    ws.cell(r + 1, 1, ex["data"])
    wb.save(os.path.join(d, f"2-oferta-{ex['numar']}-fabrica-demo-abur.xlsx"))


def oferta_ex2(ex, poz, d):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Oferta"
    for col, w in zip("ABCDEFGH", (7, 9, 74, 7, 11, 15, 13, 15)):
        ws.column_dimensions[col].width = w
    ws["A4"] = "OFERTA LUCRARI IZOLATII TERMICE"
    ws["A4"].font = Font(bold=True, size=14)
    ws["D6"] = f"Nr. {ex['numar']} / {ex['data']}"
    ws["A9"] = ex["atentia"]
    ws["A10"] = f"Beneficiar : {ex['beneficiar']}"
    ws["A11"] = f"Obiectiv : {ex['obiectiv']}"
    cap = ["Nr.", "Cod", "Denumire", "UM", "Cantitate", "dimensiune gol", "P.U. euro/elem", "Pret total euro"]
    for j, h in enumerate(cap, start=1):
        c = ws.cell(14, j, h)
        c.font = B
        c.alignment = WRAP
        c.border = BOX
    r = 15
    subt, foaie_c, sect_c, start = [], None, None, None

    def inchide():
        nonlocal r
        if start is not None:
            ws.cell(r, 1, f"Subtotal {foaie_c}").font = B
            ws.cell(r, 8, f"=SUM(H{start}:H{r-1})").font = B
            ws.cell(r, 8).number_format = "#,##0.00"
            subt.append(r)
            r += 1

    for (n, foaie, cod, den, um, q, extra, pret, sect) in poz:
        if foaie != foaie_c:
            inchide()
            foaie_c, sect_c = foaie, None
            ws.cell(r, 1, foaie.upper()).font = B
            r += 1
            start = r
        if sect and sect != sect_c:
            sect_c = sect
            ws.cell(r, 1, sect).font = Font(bold=True, italic=True)
            r += 1
        vals = [n, cod, den, um, q, extra, pret, f"=E{r}*G{r}"]
        for j, v in enumerate(vals, start=1):
            c = ws.cell(r, j, v)
            c.border = BOX
            if j == 3:
                c.alignment = WRAP
        ws.cell(r, 8).number_format = "#,##0.00"
        r += 1
    inchide()
    r += 1
    ws.cell(r, 1, "TOTAL LUCRARI IZOLATII TERMICE (fara TVA)").font = B
    ws.cell(r, 8, "=" + "+".join(f"H{s}" for s in subt)).font = B
    ws.cell(r, 8).number_format = "#,##0.00"
    r += 2
    ws.cell(r, 1, "Nota:").font = B
    for t in NOTE + [
        "Preturile inchiderilor de goluri se refera la treceri EI60 - EI120 pentru conducte; colierele si banda wrap sunt incluse unde e cazul.",
        "Protectia la foc a tubulaturii (EI120) si patul de cabluri: pret pus de mana.",
        "Nu sunt ofertate: pozitia fara diametru (elastomer 19 mm, 110 m) si trecerea DN80 fara dimensiunea golului.",
    ]:
        r += 1
        ws.cell(r, 1, t)
    r += 3
    ws.cell(r, 1, "Paltinis,")
    ws.cell(r, 6, ex["firma"])
    ws.cell(r + 1, 1, ex["data"])
    wb.save(os.path.join(d, f"2-oferta-{ex['numar']}-ansamblu-demo-bloc-c2.xlsx"))


def situatie(ex, poz, nr, data, fractii, anterior, d, nume):
    """Formatul din aplicatie (web/situatie.ts). `fractii(n, um, q)` -> cantitatea din perioada."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Situatia {nr}"
    for col, w in zip("ABCDEFGHIJ", (6, 60, 7, 12, 12, 13, 13, 13, 16, 16)):
        ws.column_dimensions[col].width = w
    ws["A1"] = f"SITUATIE DE LUCRARI NR. {nr} / {data}"
    ws.merge_cells("A1:J1")
    ws["A1"].font = Font(bold=True, size=14)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws["A3"] = f"Beneficiar : {ex['beneficiar']}"
    ws["A4"] = f"Obiectiv : {ex['obiectiv']}"
    ws["A5"] = f"Conform ofertei {ex['numar']} / {ex['data']}"
    cap = ["Nr.", "Denumire", "UM", "Cant. ofertă", "Preț unitar €", "Cant. anterioară", "Cant. în perioadă",
           "Cant. cumulată", "Valoare perioadă €", "Valoare cumulată €"]
    for j, h in enumerate(cap, start=1):
        c = ws.cell(8, j, h)
        c.font = B
        c.alignment = WRAP
    r, tc, tk, nou = 9, 0.0, 0.0, {}
    for (n, foaie, cod, den, um, q, extra, pret, sect) in poz:
        ant = anterior.get(n, 0)
        cur = fractii(n, um, q, ant)
        nou[n] = ant + cur
        vals = [n, den, um, q, pret, ant, cur, ant + cur, round(pret * cur, 4), round(pret * (ant + cur), 4)]
        for j, v in enumerate(vals, start=1):
            c = ws.cell(r, j, v)
            if j == 2:
                c.alignment = WRAP
        ws.cell(r, 9).number_format = ws.cell(r, 10).number_format = "#,##0.00"
        tc += pret * cur
        tk += pret * (ant + cur)
        r += 1
    r += 1

    def rand(et, a, b):
        nonlocal r
        ws.cell(r, 1, et).font = B
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
        for col, v in ((9, a), (10, b)):
            c = ws.cell(r, col, r2(v))
            c.font = B
            c.number_format = "#,##0.00"
        r += 1

    rand("TOTAL LUCRARI (fara TVA)", tc, tk)
    if ex["discount"]:
        p = ex["discount"] / 100
        rand(f"DISCOUNT {ex['discount']} %", r2(tc) * p, r2(tk) * p)
        rand("TOTAL DE FACTURAT (fara TVA)", r2(tc) - r2(r2(tc) * p), r2(tk) - r2(r2(tk) * p))
    r += 1
    ws.cell(r, 1, ex["firma"])
    wb.save(os.path.join(d, nume))
    return nou, r2(tc), r2(tk)


# ------------------------------------------------------------------ PDF-uri
ST = getSampleStyleSheet()
MIC = ParagraphStyle("mic", parent=ST["Normal"], fontSize=8, leading=10)
NORMAL = ParagraphStyle("n", parent=ST["Normal"], fontSize=9, leading=12)
TITLU = ParagraphStyle("t", parent=ST["Normal"], fontSize=14, leading=18, alignment=1, fontName="Helvetica-Bold")
FURNIZOR = ("Furnizor: FURNIZOR DEMO IZOLATII S.R.L.<br/>Sediu: Str. Exemplului nr. 1, Timisoara, Judet: TIMIS<br/>"
            "C.I.F.: RO00000000 (fictiv) &nbsp; Nr.Reg.Com.: J00/0000/2020<br/>Cont: RO00DEMO0000000000000000 &nbsp; Banca: DEMO BANK")
SUBSOL = "EXEMPLU PENTRU TESTAREA APLICATIEI - date inventate, nu este document fiscal."


def fmt(x, z=2):
    s = f"{x:,.{z}f}"
    return s


def pdf(cale, titlu, serie, numar, data, cumparator, linii, cu_pret, curs=None, aviz=None, obiectiv="", tva=21, scadenta=None):
    """linii: (cod, denumire, um, cantitate, pret_lei)"""
    doc = SimpleDocTemplate(cale, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=12 * mm, bottomMargin=14 * mm,
                            title=f"{titlu} {serie} {numar}", author="exemplu de test")
    el = []
    antet = Table([[Paragraph(FURNIZOR, MIC),
                    Paragraph(f"{'Cumparator' if cu_pret else 'Primitor'}: {cumparator}<br/>Adresa: SAT PALTINIS, COM. PALTINIS, NR. 185, jud. CARAS-SEVERIN", MIC)]],
                  colWidths=[95 * mm, 87 * mm])
    antet.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    el += [antet, Spacer(1, 6 * mm), Paragraph(titlu, TITLU), Spacer(1, 2 * mm)]
    info = f"Seria: {serie} &nbsp;&nbsp;&nbsp; Numar: {numar} &nbsp;&nbsp;&nbsp; Data: {data}"
    if curs:
        info += f" &nbsp;&nbsp;&nbsp; Curs: {curs:.4f}"
    if aviz:
        info += f" &nbsp;&nbsp;&nbsp; Nr.Aviz: {aviz}"
    el += [Paragraph(info, ParagraphStyle("i", parent=NORMAL, alignment=1)), Spacer(1, 5 * mm)]
    if cu_pret:
        cap = ["Nr.\nCrt.", "Denumirea bunurilor livrate\nsau a serviciilor prestate", "U/M", "Cantitate", "Pret unitar\nLEI", "Valoare\nLEI", "TVA\nLEI"]
        lat = [10, 78, 12, 22, 22, 22, 16]
    else:
        cap = ["Nr.\nCrt.", "Denumirea bunurilor livrate", "U/M", "Pret unitar", "Cantitate", "Valoare"]
        lat = [10, 96, 14, 22, 22, 18]
    date, tot, ttva = [cap], 0.0, 0.0
    for i, (cod, den, um, q, pret) in enumerate(linii, start=1):
        nume = f"{cod} {den}".strip()
        if cu_pret:
            v = r2(q * pret)
            t = r2(v * tva / 100)
            tot += v
            ttva += t
            date.append([str(i), nume, um, fmt(q, 3), fmt(pret, 4), fmt(v), fmt(t)])
        else:
            date.append([str(i), nume, um, "", fmt(q, 3), ""])
    t = Table(date, colWidths=[x * mm for x in lat], repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"), ("ALIGN", (2, 1), (2, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    el += [t, Spacer(1, 4 * mm)]
    if cu_pret:
        s = Table([["Subtotal", fmt(tot), fmt(ttva), f"{tva} %"], ["T O T A L", fmt(r2(tot + ttva)), "", ""]],
                  colWidths=[110 * mm, 30 * mm, 24 * mm, 18 * mm])
        s.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 9), ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"), ("ALIGN", (1, 0), (-1, -1), "RIGHT")]))
        el += [s, Spacer(1, 3 * mm), Paragraph(f"Se va achita prin banca cu OP. Termen de plata: {scadenta}", NORMAL)]
    else:
        el += [Paragraph("U R M E A Z A &nbsp; F A C T U R A", ParagraphStyle("u", parent=NORMAL, alignment=1, fontName="Helvetica-Bold"))]
    el += [Spacer(1, 3 * mm), Paragraph(obiectiv, NORMAL), Spacer(1, 10 * mm),
           Paragraph("Semnatura expeditorului &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Semnatura primitorului / delegatului", MIC),
           Spacer(1, 12 * mm), Paragraph(SUBSOL, ParagraphStyle("s", parent=MIC, textColor=colors.grey, alignment=1))]
    doc.build(el)


def eml(cale, data_rfc, subiect, obiectiv, linii, firma, nota=""):
    corp = (f"Buna ziua,\r\n\r\nDorim sa comandam pentru obiectivul {obiectiv} urmatoarele :\r\n\r\n"
            + "".join(f"*\t{l} ;\r\n" for l in linii)
            + f"\r\nFactura pe {firma}.\r\n" + (f"\r\n{nota}\r\n" if nota else "")
            + "\r\nMultumim !\r\n\r\nCu stima,\r\nDepartament Ofertare\r\n" + firma + "\r\n(exemplu pentru testarea aplicatiei, date inventate)\r\n")
    with open(cale, "w", encoding="utf-8", newline="") as f:
        f.write(f"From: ofertare@firma-demo.invalid\r\nTo: comenzi@furnizor-demo.invalid\r\nDate: {data_rfc}\r\n"
                f"Subject: {subiect}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n{corp}")


# ------------------------------------------------------------------ rulare
if os.path.isdir(DEST):
    shutil.rmtree(DEST)
os.makedirs(DEST)
REZ = {}

# ---- Exemplul 1
ex = EX1
d = os.path.join(DEST, ex["folder"])
os.makedirs(d)
shutil.copy(os.path.join(SCR, ex["folder"], "1-cerere-de-oferta.xlsx"), os.path.join(d, "1-cerere-de-oferta-fabrica-demo-abur.xlsx"))
rez, stat = cheie(ex, d)
poz = pozitii_oferta(ex, rez)
oferta_ex1(ex, poz, d)
ob = "FABRICA DEMO SEBES"
eml(os.path.join(d, "3-comanda-materiale-cochilii.eml"), "Mon, 16 Nov 2026 10:12:00 +0200", f"Comanda materiale - {ob}", ob,
    ["Cochilii caserate Ø60 x 40 mm = 127 m", "Cochilii caserate Ø89 x 50 mm = 172 m", "Cochilii caserate Ø76 x 50 mm = 40 m",
     "Cochilii caserate Ø48 x 40 mm = 18 m", "Cochilii caserate Ø35 x 40 mm = 22 m", "Cochilii caserate Ø28 x 40 mm = 30 m"], ex["firma"])
eml(os.path.join(d, "4-comanda-materiale-tabla.eml"), "Mon, 16 Nov 2026 10:25:00 +0200", f"Comanda materiale - {ob}", ob,
    ["Tabla aluminiu 0,6 mm = 305 kg", "Tabla aluminiu 0,8 mm = 1.075 kg", "Tabla inox 0,4 mm = 130 kg"], ex["firma"])
CUMP = "SC RADOIA ISOLIRUNG SRL"
l1 = [("CCA060040", "COCHILTECH AL. 60 X 40", "ML", 100, 22.0780), ("CCA089050", "COCHILTECH AL. 89 X 50", "ML", 172, 32.7712),
      ("CCA076050", "COCHILTECH AL. 76 X 50", "ML", 40, 29.7388), ("", "COCHILII VATA CASERATE 48/40", "ML", 18, 19.3116),
      ("CCA035040", "COCHILTECH AL. 35 X 40", "", 22, 15.9600), ("CCA028040", "COCHILTECH AL. 28 X 40", "ML", 30, 14.5220),
      ("", "BANDA ALUMINIU ADEZIVA 50MM X 50M", "BUC", 12, 18.5000)]
pdf(os.path.join(d, "5-aviz-cochilii-DM-2611001.pdf"), "A V I Z &nbsp;de insotire a marfii", "DM", "2611001", "19/11/2026", CUMP, l1, False, obiectiv=ob)
pdf(os.path.join(d, "6-factura-cochilii-DM-26110457.pdf"), "F A C T U R A", "DM", "26110457", "20/11/2026", CUMP,
    l1 + [("", "TRANSPORT", "BUC", 1, 250.0)], True, curs=5.3250, aviz="2611001", obiectiv=ob, scadenta="18/02/2027")
l2 = [("", "TABLA AL. 0,6*1000 (KG)", "KG", 305, 0), ("", "TABLA AL. 0,8*1000 (KG)", "KG", 1075, 0), ("", "TABLA INOX 0,4*1000 (KG)", "KG", 130, 0)]
pdf(os.path.join(d, "7-aviz-tabla-DM-2611002.pdf"), "A V I Z &nbsp;de insotire a marfii", "DM", "2611002", "23/11/2026", CUMP, l2, False, obiectiv=ob)


def f1(n, um, q, ant):
    if um in ("buc",):
        return q // 2
    return round(q * 0.4, 1) if q * 0.4 != int(q * 0.4) else int(q * 0.4)


def f2(n, um, q, ant):
    rest = round(q - ant, 1)
    rest = int(rest) if rest == int(rest) else rest
    if n % 3 == 0:  # o treime din pozitii raman neterminate
        return rest // 2 if isinstance(rest, int) else round(rest / 2, 1)
    return rest


a1, c1, k1 = situatie(ex, poz, 1, "30.11.2026", f1, {}, d, "8-situatie-de-lucrari-1.xlsx")
a2, c2, k2 = situatie(ex, poz, 2, "18.12.2026", f2, a1, d, "9-situatie-de-lucrari-2.xlsx")
REZ[ex["folder"]] = dict(stat=stat, pozitii=len(poz), total=r2(sum(p[7] * p[5] for p in poz)), s1=c1, s2=c2, cumulat=k2)

# ---- Exemplul 2
ex = EX2
d = os.path.join(DEST, ex["folder"])
os.makedirs(d)
shutil.copy(os.path.join(SCR, ex["folder"], "1-cerere-de-oferta.xlsx"), os.path.join(d, "1-cerere-de-oferta-ansamblu-demo-bloc-c2.xlsx"))
rez, stat = cheie(ex, d)
poz = pozitii_oferta(ex, rez)
oferta_ex2(ex, poz, d)
ob = "ANSAMBLU DEMO BLOC C2 TIMISOARA"
eml(os.path.join(d, "3-comanda-materiale-elastomer-si-saltele.eml"), "Tue, 17 Nov 2026 09:40:00 +0200", f"Comanda materiale - {ob}", ob,
    ["Tuburi elastomer Ø22 x 13 mm = 320 m", "Tuburi elastomer Ø28 x 13 mm = 280 m", "Tuburi elastomer Ø35 x 13 mm = 190 m",
     "Tuburi elastomer Ø42 x 13 mm = 270 m", "Tuburi elastomer Ø48 x 19 mm = 140 m", "Tuburi elastomer Ø60 x 19 mm = 100 m",
     "Tuburi elastomer Ø35 x 9 mm = 210 m", "Placa elastomer 19 mm = 248 m2", "Placa elastomer 9 mm = 102 m2",
     "Saltea vata minerala lamelara caserata Al 50 mm = 435 m2"], "R&F ISORAD SYSTEM SRL", nota="Livrare pe santier, in doua transe.")
CUMP = "R&F ISORAD SYSTEM SRL"
l3 = [("", "ST 13x22 TUBURI K-FLEX", "ML", 320, 2.5819), ("", "ST 13x28 TUBURI K-FLEX", "ML", 280, 2.9315),
      ("", "ST 13x35 TUBURI K-FLEX", "ML", 190, 3.1623), ("", "TUBURI K-FLEX 13X42", "ML", 270, 3.8083),
      ("", "ST 19x48 TUBURI K-FLEX", "ML", 140, 14.6300), ("", "ARMAFLEX ACE PLUS TUBES 19 X 60", "ML", 100, 13.3812),
      ("", "ST 9x35 TUBURI K-FLEX", "ML", 210, 3.5046), ("", "ARMAFLEX ACE PLACA 19 MM", "MP", 248, 30.9140),
      ("", "K-FLEX ST ROLA 9 MM", "ROLA", 6, 484.0000), ("", "LM ECO ALU M 50X1000X5000", "MP", 300, 26.3872)]
pdf(os.path.join(d, "4-aviz-elastomer-si-saltele-DM-2611015.pdf"), "A V I Z &nbsp;de insotire a marfii", "DM", "2611015", "24/11/2026", CUMP, l3, False, obiectiv=ob)
pdf(os.path.join(d, "5-factura-elastomer-si-saltele-DM-26110512.pdf"), "F A C T U R A", "DM", "26110512", "25/11/2026", CUMP, l3, True,
    curs=5.3250, aviz="2611015", obiectiv=ob, scadenta="23/02/2027")
a1, c1, k1 = situatie(ex, poz, 1, "04.12.2026", f1, {}, d, "6-situatie-de-lucrari-1.xlsx")
a2, c2, k2 = situatie(ex, poz, 2, "21.12.2026", f2, a1, d, "7-situatie-de-lucrari-2.xlsx")
REZ[ex["folder"]] = dict(stat=stat, pozitii=len(poz), total=r2(sum(p[7] * p[5] for p in poz)), s1=c1, s2=c2, cumulat=k2)
json.dump(REZ, open(os.path.join(SCR, "rezumat.json"), "w"), indent=1, ensure_ascii=False)
print(json.dumps(REZ, indent=1, ensure_ascii=False))
