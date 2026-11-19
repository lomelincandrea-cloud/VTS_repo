"""Corrections to the catalogue after the manual review (2026-11-12). Excel stays the single source."""
import openpyxl
P = "data/VTS_plant_catalogue.xlsx"
wb = openpyxl.load_workbook(P)


def hdr(ws):
    return [c.value for c in ws[1]]


def setc(ws, key, col, val):
    ci = hdr(ws).index(col) + 1
    for r in range(2, ws.max_row + 1):
        if ws.cell(r, 1).value == key:
            ws.cell(r, ci).value = val
            return
    raise KeyError(key)


s = wb["Signs"]
setc(s, "FG-CRACK", "What to do", "Photograph it with something for scale and tell the supervisor. Reinforce it temporarily with soil from the site only if you can reach it from stable ground, no water comes through, and the berm is not moving.")
setc(s, "FG-BURROW", "What to do", "Do not trap or poison. Photograph it and tell the supervisor. Fill and compact only burrows with no signs of use (no fresh soil, tracks, or droppings). If there is a nest, or a protected species may be present, stop and tell the supervisor.")
setc(s, "FG-RILL", "What to do", "Fill small rills, compact, and reseed. A gully, or a berm that is losing its shape, is not a quick fix: tell the supervisor. Before the rains, protect bare soil with seed and straw, wattles, or jute netting.")
setc(s, "FG-STOPLOG-STUCK", "What to do", "Do not force it and do not move it yourself. Record it and tell the supervisor, who decides how to set the water level.")
setc(s, "FG-SHORT", "Task", None)
setc(s, "FG-CATTAIL", "Source", "Stakeholder interviews, 2026")
w = wb["Wildlife"]
setc(w, "Western pond turtle", "Scientific name", "Actinemys marmorata / A. pallida")
wb.save(P)
print("catalogue corrected")
