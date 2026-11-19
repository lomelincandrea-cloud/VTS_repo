"""Checklist de inspección en Excel con el mismo diseño que el anexo del manual."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.utils import get_column_letter
BOX, OFF = "\u2610", "\u2612"           # ☐ ☒
def spring_rows(nitrate):
    """Required records of the spring visit (water check). nitrate=False for systems with flow and clarity only (SB)."""
    rows = [("Water flowing at the inlet / at the outlet (yes / no)", False),
            ("Jar comparison: one photo of both jars side by side. Is the outlet jar clearer than the inlet jar? (yes / no)", True)]
    if nitrate:
        rows += [("Nitrate strip, inlet: reading (closest color block), unit as printed on the kit, method; photo with the color scale", True),
                 ("Nitrate strip, outlet: reading (closest color block), unit as printed on the kit, method; photo with the color scale", True),
                 ("Laboratory pair this year (once a year): sent / not done this year; time of each sample", False)]
    return rows
CLOSING = ["Every abnormal finding is recorded and photographed", "The supervisor has been notified", "Follow-up task(s) chosen (write the task codes in Notes)",
           "Overview photos taken from all photo points (Routine, After storm and Pre-storm visits; required)"]
def write_checklist_xlsx(system, items, sys_name, sys_color, tasks, site_params, path, blue="03467E", spring=None):
    wb = Workbook(); ws = wb.active; ws.title = "Checklist"; ws.sheet_view.showGridLines = False
    thin = Side(style="thin", color="C4D3E2"); B = Border(left=thin, right=thin, top=thin, bottom=thin)
    fill = lambda c: PatternFill("solid", fgColor=c)
    FN, FH = "Calibri", "Arial Narrow"
    widths = [4.5, 54, 5.5, 5.5, 5.5, 4, 4, 4, 60, 18, 7, 22]
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    # banda y título
    ws.merge_cells("A1:C1"); ws["A1"] = f"FORM {system}_F04"; ws["A1"].font = Font(name=FH, bold=True, size=10, color="FFFFFF"); ws["A1"].fill = fill(sys_color.lstrip("#")); ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 18
    ws.merge_cells("A2:L2"); ws["A2"] = f"VISUAL INSPECTION CHECKLIST — {sys_name.upper()}"; ws["A2"].font = Font(name=FH, bold=True, size=20, color=blue); ws.row_dimensions[2].height = 30
    for c in range(1, 13): ws.cell(row=2, column=c).border = Border(bottom=Side(style="thick", color=blue))
    ws.row_dimensions[3].height = 6
    # encabezado (tres filas de pares clave / valor)
    keys = [("Site / VTS ID", "Date"), ("Inspector", "Visit type"), ("Last rain (date / amount)", "Weather")]
    for n, (k1, k2) in enumerate(keys, 4):
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=2); ws.cell(row=n, column=1, value=k1)
        ws.merge_cells(start_row=n, start_column=3, end_row=n, end_column=8)
        ws.cell(row=n, column=9, value=k2); ws.merge_cells(start_row=n, start_column=10, end_row=n, end_column=12)
        for c in (1, 9): ws.cell(row=n, column=c).font = Font(name=FH, bold=True, color=blue, size=10); ws.cell(row=n, column=c).fill = fill("E6F0F9")
        for c in range(1, 13): ws.cell(row=n, column=c).border = B
        ws.row_dimensions[n].height = 20
    ws["J5"].fill = fill("FFF8DC")
    ws.merge_cells("A7:L7"); ws["A7"].font = Font(name=FH, size=9, italic=True, color="566A7F"); ws.row_dimensions[7].height = 16
    HR = 9
    if site_params:
        ws.merge_cells(start_row=8, start_column=1, end_row=8, end_column=12); ws["A8"] = "SITE CONDITIONS (the supervisor fills these in from the design or the annual plan)"
        ws["A8"].font = Font(name=FH, bold=True, size=10, color=blue)
        for c in range(1, 13): ws.cell(row=8, column=c).fill = fill("FFF8DC"); ws.cell(row=8, column=c).border = B
        for k, f_ in enumerate(site_params):
            rr = 9 + k; ws.merge_cells(start_row=rr, start_column=1, end_row=rr, end_column=2); ws.cell(row=rr, column=1, value=f_)
            ws.merge_cells(start_row=rr, start_column=3, end_row=rr, end_column=12); ws.cell(row=rr, column=1).font = Font(name=FH, bold=True, color=blue, size=10); ws.cell(row=rr, column=1).fill = fill("E6F0F9")
            for c in range(1, 13): ws.cell(row=rr, column=c).border = B
        HR = 9 + len(site_params) + 1
    # encabezado de tabla
    heads = ["#", "Item", "OK", "Abn.", "N/A", "R", "A", "P", "If abnormal", "Go to task", "Photo", "Notes"]
    for c, h in enumerate(heads, 1):
        cell = ws.cell(row=HR, column=c, value=h); cell.font = Font(name=FH, bold=True, size=10, color="FFFFFF"); cell.fill = fill(blue); cell.border = B
        cell.alignment = Alignment(horizontal="left" if c in (2, 9, 10, 12) else "center", vertical="center")
    ws.row_dimensions[HR].height = 20
    first, r, cur, n = HR + 1, HR + 1, None, 0
    for it in items:
        if it["section"] != cur:
            cur = it["section"]; ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=12)
            ws.cell(row=r, column=1, value=cur.upper()); ws.cell(row=r, column=1).font = Font(name=FH, bold=True, size=11, color="3A2A00")
            for c in range(1, 13): ws.cell(row=r, column=c).fill = fill("F6B800"); ws.cell(row=r, column=c).border = B
            ws.row_dimensions[r].height = 17; r += 1
        n += 1
        ws.cell(row=r, column=1, value=n)
        look = it["look"] + (f"\nNormal: {it['normal']}" if it["normal"] else "")
        ws.cell(row=r, column=2).value = CellRichText(TextBlock(InlineFont(rFont=FN, b=True, sz=10), it["question"]), "\n", TextBlock(InlineFont(rFont=FN, sz=8.5, color="566A7F"), look))
        for c in (3, 4, 5): ws.cell(row=r, column=c, value=BOX)
        for c, (code, v) in zip((6, 7, 8), (("R", "Routine"), ("A", "After storm"), ("P", "Pre-storm"))):
            cell = ws.cell(row=r, column=c)
            if v in it["visits"]: cell.value = code; cell.fill = fill(blue); cell.font = Font(name=FH, bold=True, color="FFFFFF", size=10)
            else: cell.value = "·"; cell.font = Font(color="B9C8D8")
        ws.cell(row=r, column=9, value=it["abnormal"]); ws.cell(row=r, column=10, value=", ".join(it["go"])); ws.cell(row=r, column=11, value=BOX if it["photo"] else "")
        for c in range(1, 13):
            cell = ws.cell(row=r, column=c); cell.border = B
            if c in (1,): cell.font = Font(name=FN, bold=True, color=blue); cell.alignment = Alignment(horizontal="center", vertical="top")
            elif c in (3, 4, 5, 11): cell.font = Font(name="Segoe UI Symbol", size=13, color=blue); cell.alignment = Alignment(horizontal="center", vertical="top")
            elif c in (6, 7, 8): cell.alignment = Alignment(horizontal="center", vertical="top")
            elif c == 10: cell.font = Font(name=FN, bold=True, color=blue, size=9); cell.alignment = Alignment(wrap_text=True, vertical="top")
            elif c == 9: cell.font = Font(name=FN, size=9); cell.alignment = Alignment(wrap_text=True, vertical="top")
            else: cell.alignment = Alignment(wrap_text=True, vertical="top")
        lines = max(-(-len(it["question"]) // 50) + -(-len(look) // 62), -(-len(it["abnormal"]) // 62), 2)
        ws.row_dimensions[r].height = 13.5 * lines + 5; r += 1
    items_last = r - 1
    # spring visit: water check records (required ones are marked)
    if spring is not None:
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=12); ws.cell(row=r, column=1, value="SPRING VISIT — WATER CHECK (REQUIRED ITEMS MARKED)"); ws.cell(row=r, column=1).font = Font(name=FH, bold=True, size=11, color="3A2A00")
        for c in range(1, 13): ws.cell(row=r, column=c).fill = fill("F6B800"); ws.cell(row=r, column=c).border = B
        r += 1
        for t, req in spring_rows(spring.get("nitrate", False)):
            ws.cell(row=r, column=2, value=t).alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
            ws.cell(row=r, column=9, value="Required" if req else "").font = Font(name=FH, bold=True, color="B4361F", size=10)
            ws.merge_cells(start_row=r, start_column=10, end_row=r, end_column=12)
            for c in range(1, 13): ws.cell(row=r, column=c).border = B
            ws.row_dimensions[r].height = 30; r += 1
    # cierre
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=12); ws.cell(row=r, column=1, value="BEFORE YOU LEAVE"); ws.cell(row=r, column=1).font = Font(name=FH, bold=True, size=11, color="3A2A00")
    for c in range(1, 13): ws.cell(row=r, column=c).fill = fill("F6B800"); ws.cell(row=r, column=c).border = B
    r += 1; close0 = r
    for t in CLOSING:
        ws.cell(row=r, column=3, value=BOX); ws.cell(row=r, column=2, value=t).alignment = Alignment(wrap_text=True, vertical="top")
        for c in range(1, 13): ws.cell(row=r, column=c).border = B
        ws.cell(row=r, column=3).font = Font(name="Segoe UI Symbol", size=13, color=blue); ws.cell(row=r, column=3).alignment = Alignment(horizontal="center"); r += 1
    last = r - 1
    for k in ("Crew size", "Hours on site"):
        ws.cell(row=r, column=2, value=k).font = Font(name=FH, bold=True, color=blue, size=10); ws.cell(row=r, column=2).fill = fill("E6F0F9")
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=8)
        for c in range(1, 13): ws.cell(row=r, column=c).border = B
        r += 1
    ws.merge_cells(start_row=r + 1, start_column=1, end_row=r + 1, end_column=12)
    ws.cell(row=r + 1, column=1, value="Visit: R = Routine · A = After storm · P = Pre-storm (August). Observe and document; do only the small actions listed.").font = Font(name=FN, italic=True, size=8.5, color="566A7F")
    # validaciones y formato condicional
    dv = DataValidation(type="list", formula1=f'"{BOX},{OFF}"', allow_blank=False); ws.add_data_validation(dv)
    dv.add(f"C{first}:E{items_last}"); dv.add(f"K{first}:K{items_last}"); dv.add(f"C{close0}:C{last}")
    dvv = DataValidation(type="list", formula1='"Routine,After storm,Spring,Pre-storm"', allow_blank=True); ws.add_data_validation(dvv); dvv.add("J5")
    rng = f"A{first}:L{items_last}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$D{first}="{OFF}"'], fill=fill("F8D3CC")))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$C{first}="{OFF}"'], fill=fill("D9EFDD")))
    ws.conditional_formatting.add(f"B{first}:E{items_last}", FormulaRule(formula=[f'AND($J$5<>"",OR(AND($J$5="Routine",$F{first}<>"R"),AND($J$5="After storm",$G{first}<>"A"),AND($J$5="Pre-storm",$H{first}<>"P")),$F{first}<>"")'], font=Font(color="A0A0A0")))
    item_rng = f"C{first}:E{items_last}"
    ws["A7"] = (f'="Answered: "&COUNTIF({item_rng},"{OFF}")&"     Abnormal: "&COUNTIF(D{first}:D{items_last},"{OFF}")&"     Abnormal without photo: "&SUMPRODUCT((D{first}:D{items_last}="{OFF}")*(K{first}:K{items_last}<>"{OFF}"))')
    ws.freeze_panes = f"A{HR + 1}"; ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0; ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f"{HR}:{HR}"; ws.page_margins.left = ws.page_margins.right = 0.4; ws.page_margins.top = ws.page_margins.bottom = 0.4
    h = wb.create_sheet("How to use")
    for i, t in enumerate(["1. Choose the visit type in the yellow cell (Visit type). Items that do not apply to that visit turn grey (R / A / S show where each item applies).",
        f"2. For each item, tick one box: OK, Abn. or N/A (click the cell and choose {OFF}). Rows turn green (OK) or red (Abnormal).",
        "3. For every Abnormal item: take a photo, tick Photo, write the location in Notes, and notify the supervisor.", "4. Read 'If abnormal' and 'Go to task' for what to do next (the 'Task index' sheet lists the task names).",
        "5. The line under the title counts answered items, abnormal findings, and abnormal findings without a photo.", "", "Source: sheet 'Checklist_Items' of VTS_manual_content.xlsx. Edit the items there, not here."], 1): h.cell(row=i, column=1, value=t)
    h.column_dimensions["A"].width = 130
    ti = wb.create_sheet("Task index"); ti.append(["Task ID", "Task name"])
    for c in ti[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = fill(blue)
    for code in sorted({g for it in items for g in it["go"] if g in tasks}): ti.append([code, tasks[code]])
    ti.column_dimensions["A"].width = 12; ti.column_dimensions["B"].width = 60
    wb.save(path); return path
