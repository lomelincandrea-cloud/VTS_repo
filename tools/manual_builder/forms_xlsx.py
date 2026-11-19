"""Formularios F01, F02, F03, F05 y F06 en Excel (misma paleta que el manual)."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
def parse_months(s):
    out = []
    for tok in [t.strip() for t in (s or "").replace("–", "-").split(",") if t.strip()]:
        if "-" in tok:
            a, b = [x.strip() for x in tok.split("-")]; i, j = MONTHS.index(a), MONTHS.index(b); out += list(range(i, j + 1))
        elif tok in MONTHS: out.append(MONTHS.index(tok))
    return sorted(set(out))
def write_forms_xlsx(path, docs, tasks, forms, sys_name, freq_order, blue="03467E"):
    wb = Workbook(); wb.remove(wb.active); thin = Side(style="thin", color="C4D3E2"); B = Border(left=thin, right=thin, top=thin, bottom=thin)
    fill = lambda c: PatternFill("solid", fgColor=c); FH = "Arial Narrow"
    def title(ws, code, text, ncols):
        ws.sheet_view.showGridLines = False
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=2); ws["A1"] = f"FORM {code}"; ws["A1"].font = Font(name=FH, bold=True, size=10, color="FFFFFF"); ws["A1"].fill = fill(blue); ws["A1"].alignment = Alignment(horizontal="center")
        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=ncols); ws["A2"] = text.upper(); ws["A2"].font = Font(name=FH, bold=True, size=18, color=blue); ws.row_dimensions[2].height = 28
        for c in range(1, ncols + 1): ws.cell(row=2, column=c).border = Border(bottom=Side(style="thick", color=blue))
    def head(ws, r, labels):
        for c, h in enumerate(labels, 1):
            x = ws.cell(row=r, column=c, value=h); x.font = Font(name=FH, bold=True, color="FFFFFF"); x.fill = fill(blue); x.border = B; x.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    def keys(ws, r, pairs, ncols):
        for k, (a, b) in enumerate(pairs):
            ws.cell(row=r + k, column=1, value=a).font = Font(name=FH, bold=True, color=blue); ws.cell(row=r + k, column=1).fill = fill("E6F0F9")
            for c in range(1, ncols + 1): ws.cell(row=r + k, column=c).border = B
    def setup(ws): ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0; ws.sheet_properties.pageSetUpPr.fitToPage = True
    # F01
    ws = wb.create_sheet("VTS_F01"); title(ws, "VTS_F01", "Document Control Sheet", 6); head(ws, 4, ["Document", "Type", "Title", "Description", "Version", "Status"])
    for k, d in enumerate(docs, 5):
        for c, v in enumerate([d["code"], d["type"], d["name"], d["desc"], d["version"], d["status"]], 1):
            x = ws.cell(row=k, column=c, value=v); x.border = B; x.alignment = Alignment(wrap_text=True, vertical="top")
    for c, w in zip("ABCDEF", (12, 11, 44, 80, 14, 10)): ws.column_dimensions[c].width = w
    setup(ws)
    for s in ("SB", "TW", "VD", "WB"):
        ts = sorted([t for t in tasks if t["system"] == s], key=lambda t: t["number"])
        # F02
        ws = wb.create_sheet(f"{s}_F02"); title(ws, f"{s}_F02", f"Preventive Maintenance Reference — {sys_name[s]}", 5); keys(ws, 4, [("VTS type", sys_name[s]), ("Prepared by", ""), ("Date", "")], 5)
        for r in range(4, 7): ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5); ws.cell(row=r, column=2).value = [sys_name[s], "", ""][r - 4]
        head(ws, 8, ["Task", "Task name", "Component", "Visit", "What to check / how to do it"]); r = 9
        for f in freq_order:
            g = [t for t in ts if t["primary"] == f]
            if not g: continue
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5); ws.cell(row=r, column=1, value=f.upper()).font = Font(name=FH, bold=True, color="3A2A00")
            for c in range(1, 6): ws.cell(row=r, column=c).fill = fill("F6B800"); ws.cell(row=r, column=c).border = B
            r += 1
            for t in g:
                for c, v in enumerate([t["id"], t["name"], t["component"], t["visit"], t["f02"]], 1):
                    x = ws.cell(row=r, column=c, value=v); x.border = B; x.alignment = Alignment(wrap_text=True, vertical="top")
                    if c == 1: x.font = Font(bold=True, color=blue)
                r += 1
        for c, w in zip("ABCDE", (10, 40, 18, 22, 90)): ws.column_dimensions[c].width = w
        setup(ws)
        # F03
        ws = wb.create_sheet(f"{s}_F03"); n = 3 + 12 + 1; title(ws, f"{s}_F03", f"Annual Plan — {sys_name[s]}", n); keys(ws, 4, [("VTS type", sys_name[s]), ("Site / prepared by / date", "")], n)
        for r in range(4, 6): ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=n)
        ws["B4"] = sys_name[s]; head(ws, 7, ["Frequency", "Task", "Component"] + MONTHS + ["Notes"]); r = 8
        ws.cell(row=r, column=1, value="Planned visits (write the dates)"); ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3); ws.cell(row=r, column=1).font = Font(bold=True, color=blue)
        for c in range(1, n + 1): ws.cell(row=r, column=c).fill = fill("FFF8DC"); ws.cell(row=r, column=c).border = B
        ws.cell(row=r, column=n, value="Routine tasks are done at every visit."); r += 1; first = r
        for t in ts:
            ms = parse_months(t["months"]); vals = [t["primary"], f'{t["id"]} {t["name"]}', t["component"]]
            for c, v in enumerate(vals, 1): x = ws.cell(row=r, column=c, value=v); x.border = B; x.alignment = Alignment(wrap_text=True, vertical="top")
            if t["primary"] == "Routine visit" or not ms:
                ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=15); x = ws.cell(row=r, column=4, value="at every scheduled visit" if t["primary"] == "Routine visit" else "as needed"); x.alignment = Alignment(horizontal="center"); x.font = Font(italic=True, color="566A7F")
                for c in range(4, 16): ws.cell(row=r, column=c).border = B
            else:
                for i in range(12): x = ws.cell(row=r, column=4 + i, value="x" if i in ms else ""); x.border = B; x.alignment = Alignment(horizontal="center")
            x = ws.cell(row=r, column=n, value=(t["when"] if len(t["when"]) <= 110 else t["when"][:110].rsplit(" ", 1)[0] + "…")); x.border = B; x.alignment = Alignment(wrap_text=True, vertical="top")
            r += 1
        last = r - 1; ws.cell(row=r, column=1, value="Seasonal and annual tasks scheduled this month (count)").font = Font(bold=True, color=blue); ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
        for i in range(12):
            col = get_column_letter(4 + i); x = ws.cell(row=r, column=4 + i, value=f'=COUNTIF({col}{first}:{col}{last},"x")'); x.font = Font(bold=True); x.alignment = Alignment(horizontal="center")
        for c in range(1, n + 1): ws.cell(row=r, column=c).fill = fill("E6F0F9"); ws.cell(row=r, column=c).border = B
        for c, w in zip(["A", "B", "C"], (22, 44, 18)): ws.column_dimensions[c].width = w
        for i in range(12): ws.column_dimensions[get_column_letter(4 + i)].width = 5
        ws.column_dimensions[get_column_letter(n)].width = 60; ws.freeze_panes = "D8"; setup(ws)
    for code, ttl in (("VTS_F05", "Corrective Maintenance Log"), ("VTS_F06", "Site History")):
        cols = [(c, w) for f, o, c, w in forms if f == code]; ws = wb.create_sheet(code); title(ws, code, ttl, len(cols))
        keys(ws, 4, [("VTS name", ""), ("VTS type", ""), ("Supervisor", "")], len(cols))
        for r in range(4, 7): ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=len(cols))
        head(ws, 8, [c for c, w in cols])
        for r in range(9, 9 + 30):
            ws.row_dimensions[r].height = 28
            for c in range(1, len(cols) + 1): x = ws.cell(row=r, column=c); x.border = B; x.alignment = Alignment(wrap_text=True, vertical="top")
        for i, (c, w) in enumerate(cols, 1): ws.column_dimensions[get_column_letter(i)].width = max(w * 4.2, 12)
        ws.freeze_panes = "A9"; setup(ws)
    # VTS_F07 Site Card: una página que se queda con los site partners
    ws = wb.create_sheet("VTS_F07"); title(ws, "VTS_F07", "Site Card", 2)
    rows_ = [("System name and type", ""), ("What it does", "Cleans the water that leaves the fields before it reaches creeks, sloughs, and the bay."),
             ("Please do not", "☐ spray it   ☐ disk or grade it   ☐ dump soil, weeds, or crop waste in it   ☐ drive through it   ☐ move fences or markers"),
             ("Please tell us if", "water is not reaching it, a pump stops, a berm breaks, or you plan work next to it."), ("Who to call (name, phone)", ""), ("Pump: owner and contact", ""),
             ("Access and food safety rules for visitors", ""), ("Planned visits this year", ""), ("Site partners (who to keep informed)", "")]
    for i, (k, v) in enumerate(rows_, 4):
        a = ws.cell(row=i, column=1, value=k); b = ws.cell(row=i, column=2, value=v); ws.row_dimensions[i].height = 42
        a.font = Font(bold=True); a.border = B; b.border = B; a.alignment = Alignment(wrap_text=True, vertical="top"); b.alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 34; ws.column_dimensions["B"].width = 100; setup(ws)
    wb.save(path); return path
