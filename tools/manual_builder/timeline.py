"""Línea de tiempo del año de mantenimiento (SVG): fondo con la temporada de lluvias y el flujo de visitas.

Uso desde el notebook:
    from timeline import year_boxes, make_year_timeline
    make_year_timeline(path, **year_boxes(tasks, "SB"))      # un sistema (lee las tareas del Excel)
    make_year_timeline(path, **GENERAL)                      # versión general, sin tareas
"""
import textwrap
from html import escape

W, X0, X1 = 1000, 20, 980
MW = (X1 - X0) / 12
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
FONT = "Public Sans, DejaVu Sans, Arial, sans-serif"
RAIN_F, RAIN_T = "#E6F1FB", "#0C447C"
GRAY = ("#F1EFE8", "#888780", "#2C2C2A", "#5F5E5A")
TEAL = ("#E1F5EE", "#0F6E56", "#085041", "#0F6E56")
CORAL = ("#FAECE7", "#993C1D", "#712B13", "#993C1D")
# columnas de las cajas: (x, ancho) — enero, primavera (abr–may), agosto, post-tormenta (oct–dic)
COLS = [(24, 176), (238, 196), (488, 226), (746, 230)]


def _wrap(items, width_px, size=12.5):
    n = max(12, int((width_px - 24) / (size * 0.56)))
    out = []
    for it in items:
        lines = textwrap.wrap(it, n) or [""]
        out.append(lines)
    return out


def _t(x, y, s, size=12.5, weight=400, fill="#2C2C2A", anchor="start"):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{escape(s)}</text>'


def make_year_timeline(path, plan, spring, august, post, routine, as_needed, system_label="", pdca=False):
    boxes = [("January review", "In the office", plan, GRAY), ("Spring visit", "April", spring, TEAL),
             ("Pre-storm visit", "August", august, TEAL), ("Post-storm visit", "Oct – Apr, within 48 h", post, CORAL)]
    wrapped = [_wrap(b[2], COLS[i][1]) for i, b in enumerate(boxes)]
    lines = max(sum(len(w) for w in ws) + 0.35 * max(len(ws) - 1, 0) for ws in wrapped)
    top, lh = 66, 16.5
    box_h = 62 + lines * lh + 10
    bot = top + box_h
    y_post = bot + 14; y_rut = y_post + 40; y_need = y_rut + 40
    rut_lines = textwrap.wrap("Routine — at every visit, all year: " + "; ".join(routine), 150)
    need_lines = textwrap.wrap("When needed — " + "; ".join(as_needed), 150)
    y_need = y_rut + 18 + 16 * len(rut_lines) + 10
    band_bot = y_need + 18 + 16 * len(need_lines) + 8
    H = band_bot + 66 + (166 if pdca else 0)
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H:.0f}" width="{W}" height="{H:.0f}">',
         '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#5F5E5A" stroke-width="1.6" stroke-linecap="round"/></marker></defs>']
    # temporada de lluvias (1 oct – 30 abr)
    s.append(f'<rect x="{X0}" y="28" width="{4 * MW:.1f}" height="{band_bot - 28:.1f}" rx="8" fill="{RAIN_F}"/>')
    s.append(f'<rect x="{X0 + 9 * MW:.1f}" y="28" width="{3 * MW:.1f}" height="{band_bot - 28:.1f}" rx="8" fill="{RAIN_F}"/>')
    s.append(_t(X0 + 2 * MW, 48, "Rainy season", 13, 600, RAIN_T, "middle"))
    s.append(_t(X0 + 10.5 * MW, 48, "Rainy season", 13, 600, RAIN_T, "middle"))
    for i in range(1, 12):
        x = X0 + i * MW
        s.append(f'<line x1="{x:.1f}" y1="28" x2="{x:.1f}" y2="{band_bot:.1f}" stroke="#B4B2A9" stroke-width="0.6" stroke-dasharray="2 4"/>')
    # cajas del flujo
    for i, (title, sub, items, (fill, stroke, tc, sc)) in enumerate(boxes):
        x, w = COLS[i]
        s.append(f'<rect x="{x}" y="{top}" width="{w}" height="{box_h:.1f}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        s.append(_t(x + w / 2, top + 22, title, 15, 700, tc, "middle"))
        s.append(_t(x + w / 2, top + 41, sub, 12.5, 400, sc, "middle"))
        s.append(f'<line x1="{x + 12}" y1="{top + 52}" x2="{x + w - 12}" y2="{top + 52}" stroke="{stroke}" stroke-width="0.6"/>')
        y = top + 70
        for item in wrapped[i]:
            for j, ln in enumerate(item):
                s.append(_t(x + 12 + (10 if j else 0), y, ("• " if j == 0 else "") + ln, 12.5, 400, tc))
                y += lh
            y += lh * 0.35
    for i in range(3):
        xa = COLS[i][0] + COLS[i][1] + 3; xb = COLS[i + 1][0] - 4
        s.append(f'<line x1="{xa}" y1="{top + 30}" x2="{xb}" y2="{top + 30}" stroke="#5F5E5A" stroke-width="1.6" marker-end="url(#ar)"/>')
    # barras: post-tormenta (ene–abr), rutina, según necesidad
    s.append(f'<rect x="{X0 + 4}" y="{y_post:.1f}" width="{4 * MW - 8:.1f}" height="28" rx="5" fill="{CORAL[0]}" stroke="{CORAL[1]}" stroke-width="0.8"/>')
    s.append(_t(X0 + 2 * MW, y_post + 19, "Post-storm visits continue until April 30", 12.5, 400, CORAL[2], "middle"))
    h_rut = 12 + 16 * len(rut_lines)
    s.append(f'<rect x="{X0 + 4}" y="{y_rut:.1f}" width="{X1 - X0 - 8}" height="{h_rut}" rx="5" fill="{GRAY[0]}" stroke="{GRAY[1]}" stroke-width="0.8"/>')
    for j, ln in enumerate(rut_lines): s.append(_t(W / 2, y_rut + 19 + 16 * j, ln, 12.5, 400, GRAY[2], "middle"))
    h_need = 12 + 16 * len(need_lines)
    s.append(f'<rect x="{X0 + 4}" y="{y_need:.1f}" width="{X1 - X0 - 8}" height="{h_need}" rx="5" fill="#FFFFFF" stroke="{GRAY[1]}" stroke-width="0.8" stroke-dasharray="5 4"/>')
    for j, ln in enumerate(need_lines): s.append(_t(W / 2, y_need + 19 + 16 * j, ln, 12.5, 400, GRAY[3], "middle"))
    # meses y leyenda
    for i, m in enumerate(MONTHS): s.append(_t(X0 + (i + 0.5) * MW, band_bot + 22, m, 13, 600, "#444441", "middle"))
    s.append(_t(W / 2, band_bot + 50, "Blue = rainy season (October 1 – April 30) · the cycle starts again every January ", 12, 400, "#5F5E5A", "middle"))
    if pdca: s += _pdca_row(band_bot + 74)
    s.append("</svg>")
    open(path, "w", encoding="utf-8").write("\n".join(s))
    return path


def year_boxes(tasks, system, also=()):
    """Arma el contenido de las cajas a partir de las tareas del Excel (Visit y Plan months)."""
    ts = sorted([t for t in tasks if t["system"] == system], key=lambda t: t["number"]) + [t for t in tasks if t["id"] in also]
    lab = lambda t: f'{t["id"]} {t["name"]}'
    plan = [lab(t) for t in ts if t["visit"] == "January review (office)"] + ["Write the Annual Plan (F03)"]
    spring = [lab(t) for t in ts if t["visit"] == "Spring visit"]
    august = [lab(t) for t in ts if t["visit"] == "Pre-storm visit"] + ["Checklist items marked P (pre-storm)"]
    insp = [lab(t) for t in ts if t["kind"] == "Routine inspection"]
    post = insp + ["Checklist items marked A (post-storm)"]
    routine = [lab(t) for t in ts if t["primary"] == "Routine"]
    need = [lab(t) for t in ts if t["visit"] == "When needed"] + ["repairs (chapter 4)"]
    return dict(plan=plan, spring=spring, august=august, post=post, routine=routine, as_needed=need)


GENERAL = dict(
    plan=["Review the Site History of last year", "Write the Annual Plan (F03)", "Agree on post-storm visits with the site partners"],
    spring=["Vegetation survey (plants growing)", "Water checks: flow, clarity, nitrate"],
    august=["Vegetation maintenance", "Test and clear control structures", "Sediment monitoring", "Condition check", "Safety and skills refresher"],
    post=["Routine Visual Inspection after rain of 0.5 in or more in 24 h", "Checklist items marked A"],
    routine=["Routine Visual Inspection with the Visit Sheet (F04)", "Remove Trash and Debris", "overview photos"],
    as_needed=["sediment removal (finish before October 1)", "woodchip top-off", "repairs found at inspections (chapter 4)"],
)


PDCA = [("PLAN", "January", "Choose the tasks and visit dates for each system (F03). Agree on post-storm visits with the site partners.", ("#EEEDFE", "#534AB7", "#3C3489")),
        ("DO", "Every visit", "Inspect with the Visit Sheet (F04) and do the tasks of that visit.", ("#E1F5EE", "#0F6E56", "#085041")),
        ("CHECK", "After every visit", "The supervisor reads the Visit Sheet and photos, adds the visit to the Site History (F06), and schedules repairs (F05).", ("#FAEEDA", "#854F0B", "#633806")),
        ("ACT", "Next January", "Review the Site History of the year and change tasks, dates, or the design.", ("#FAECE7", "#993C1D", "#712B13"))]


def _pdca_row(y):
    out, w, gap = [], 222, 24
    x = X0 + 4
    for i, (k, when, txt, (f, st, tc)) in enumerate(PDCA):
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="128" rx="9" fill="{f}" stroke="{st}" stroke-width="1"/>')
        out.append(_t(x + 14, y + 26, k, 18, 800, tc))
        out.append(_t(x + w - 14, y + 26, when, 12.5, 600, st, "end"))
        for j, ln in enumerate(textwrap.wrap(txt, 33)): out.append(_t(x + 14, y + 52 + 17 * j, ln, 12.5, 400, tc))
        if i < 3: out.append(f'<line x1="{x + w + 3}" y1="{y + 64}" x2="{x + w + gap - 4}" y2="{y + 64}" stroke="#5F5E5A" stroke-width="1.6" marker-end="url(#ar)"/>')
        x += w + gap
    xp, xa = X0 + 4 + w / 2, X0 + 4 + 3 * (w + gap) + w / 2   # ACT back to PLAN: the cycle starts again
    out.append(f'<path d="M{xa:.1f} {y + 128} L{xa:.1f} {y + 150} L{xp:.1f} {y + 150} L{xp:.1f} {y + 131}" fill="none" stroke="#5F5E5A" stroke-width="1.6" marker-end="url(#ar)"/>')
    return out


def make_monitor(path):
    """Qué se registra y a dónde va (sección Monitoring and Reporting)."""
    cols = [("During the visit", "Crew", ["Overview photos of the system", "Visit Sheet F04: the tasks of the visit and the inspection checklist", "A photo of everything abnormal", "What was done and observations", "On paper? Photograph the sheet and send it"], ("#E1F5EE", "#0F6E56", "#085041")),
            ("After the visit", "Supervisor", ["Read the Visit Sheet and the photos", "Add the visit to the Site History F06", "Schedule repairs and record them in F05",
              "Talk findings through with the site partners", "Findings and photos stay within the team and the site partners"], ("#FAEEDA", "#854F0B", "#633806")),
            ("Every January", "Supervisor and team", ["Review the Site History of each system", "Recurring problems change the plan (F03)",
              "Problems that keep coming back go to a technical review of the design"], ("#EEEDFE", "#534AB7", "#3C3489"))]
    w, gap, top = 300, 30, 20
    body = []
    for c in cols: body.append([textwrap.wrap(b, 36) for b in c[2]])
    hmax = max(sum(len(x) for x in b) * 17 + len(b) * 8 for b in body) + 74
    H = top + hmax + 30
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
         '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#5F5E5A" stroke-width="1.6" stroke-linecap="round"/></marker></defs>']
    x = (W - (3 * w + 2 * gap)) / 2
    for i, (title, who, _, (f, st, tc)) in enumerate(cols):
        s.append(f'<rect x="{x}" y="{top}" width="{w}" height="{hmax}" rx="10" fill="{f}" stroke="{st}" stroke-width="1"/>')
        s.append(_t(x + 16, top + 28, title, 17, 800, tc)); s.append(_t(x + w - 16, top + 28, who, 12.5, 600, st, "end"))
        s.append(f'<line x1="{x + 14}" y1="{top + 42}" x2="{x + w - 14}" y2="{top + 42}" stroke="{st}" stroke-width="0.6"/>')
        y = top + 64
        for item in body[i]:
            for j, ln in enumerate(item):
                s.append(_t(x + 16 + (10 if j else 0), y, ("• " if j == 0 else "") + ln, 13, 400, tc)); y += 17
            y += 8
        if i < 2: s.append(f'<line x1="{x + w + 4}" y1="{top + 30}" x2="{x + w + gap - 4}" y2="{top + 30}" stroke="#5F5E5A" stroke-width="1.6" marker-end="url(#ar)"/>')
        x += w + gap
    s.append(_t(W / 2, H - 8, "↻ The January review feeds the next year's plan", 12.5, 600, "#5F5E5A", "middle"))
    s.append("</svg>"); open(path, "w", encoding="utf-8").write("\n".join(s)); return path


# ======================================================================================================
# Figuras de la ronda de noviembre: mapa de uso del manual, ciclo correctivo, remoción de sedimento
# y esquemas numerados por sistema para el Condition Check.
# ======================================================================================================
BLUE_D, INK = "#03467E", "#1F2D3D"
PAL = [("#EEEDFE", "#534AB7", "#3C3489"), ("#E1F5EE", "#0F6E56", "#085041"), ("#E6F1FB", "#185FA5", "#0C447C"), ("#FAECE7", "#993C1D", "#712B13"), ("#FAEEDA", "#854F0B", "#633806")]
_DEFS = '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#5F5E5A" stroke-width="1.6" stroke-linecap="round"/></marker></defs>'


def _svg(path, w, h, body):
    open(path, "w", encoding="utf-8").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{_DEFS}' + "\n".join(body) + "</svg>"); return path


def _card(x, y, w, h, title, lines, pal, sub=None, wrap=30, size=12.5):
    f, st, tc = pal; out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{f}" stroke="{st}" stroke-width="1"/>']
    ty = y + 26
    for ln in textwrap.wrap(title, max(10, int((w - 28) / 9.8))): out.append(_t(x + 14, ty, ln, 15.5, 800, tc)); ty += 19
    if sub: out.append(_t(x + 14, ty, sub, 11.5, 600, st)); ty += 16
    ty += 4
    for item in lines:
        for j, ln in enumerate(textwrap.wrap(item, wrap)):
            out.append(_t(x + 14 + (9 if j else 0), ty, ("→ " if j == 0 else "") + ln, size, 400, tc)); ty += 16.5
        ty += 4
    return out


def make_howto(path):
    """Mapa 'cómo usar este manual': cinco situaciones y a dónde ir."""
    cards = [("I am planning the year", ["1.3 Preventive Maintenance: the visits of the year", "Annual Plan for each system (F03)"]),
             ("I am going to a site", ["Visit Sheet for that system (appendices)", "Chapter 3: the tasks of that visit", "The routine kit"]),
             ("I do not recognize something", ["Field Guide: plants, signs of problems, wildlife, parts of a system"]),
             ("I found a problem", ["Chapter 4: quick fixes during the visit", "Chapter 4: repairs that are scheduled"]),
             ("The visit is over", ["Hand in the Visit Sheet", "1.4 Monitoring and Records: what happens with it"])]
    w, gap, h = 180, 14, 190; s = []; x = 20
    for i, (t, lines) in enumerate(cards):
        s += _card(x, 16, w, h, t, lines, PAL[i], wrap=22, size=12); x += w + gap
    s.append(_t(500, h + 42, "Each task page shows the visit it belongs to (top left) and the systems it applies to (SB, TW, VD, WB).", 12.5, 600, "#5F5E5A", "middle"))
    return _svg(path, 1000, h + 56, s)


def make_corrective(path):
    """Ciclo correctivo: encontrar, decidir (arreglo rápido o reparación programada), hacer, registrar y revisar."""
    s = []; y = 20
    s += _card(20, y + 46, 190, 120, "1. Find", ["A problem is found at an inspection and written on the Visit Sheet, with a photo"], PAL[2], wrap=24)
    s += _card(258, y, 250, 100, "2a. Quick fix", ["Small, safe, and the quick-fix kit is enough: fix it during the visit"], PAL[1], wrap=32)
    s += _card(258, y + 116, 250, 100, "2b. Scheduled repair", ["Bigger, unsafe, or needs equipment: the supervisor plans a return visit"], PAL[4], wrap=32)
    s += _card(556, y + 46, 190, 120, "3. Do", ["Do the work and take before-and-after photos"], PAL[0], wrap=24)
    s += _card(790, y + 46, 190, 120, "4. Record and check", ["Write it down (F05). At the next visit, check that it held"], PAL[3], wrap=24)
    for x1, y1, x2, y2 in ((212, y + 90, 254, y + 56), (212, y + 122, 254, y + 160), (510, y + 56, 552, y + 90), (510, y + 160, 552, y + 122), (748, y + 106, 786, y + 106)):
        s.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#5F5E5A" stroke-width="1.6" marker-end="url(#ar)"/>')
    s.append(_t(500, y + 244, "↻ If it did not hold, it goes back to step 1 and the cause is looked at again. See also 1.4 Monitoring and Records.", 12.5, 600, "#5F5E5A", "middle"))
    return _svg(path, 1000, y + 258, s)


SOIL, SOIL_D, WATER, SED, GREEN_P, CHIP = "#D9C8A9", "#8A6A3B", "#BFDDF3", "#8C7355", "#3C9D5B", "#E3B66B"


def _num(x, y, n): return f'<circle cx="{x}" cy="{y}" r="11" fill="{BLUE_D}"/><text x="{x}" y="{y + 4.5}" font-family="{FONT}" font-size="12.5" font-weight="700" fill="#fff" text-anchor="middle">{n}</text>'
def _plants(xs, y, h=16): return "".join(f'<path d="M{x} {y} q-3 -{h * .6} -1 -{h} M{x} {y} q3 -{h * .5} 5 -{h * .85} M{x} {y} q-5 -{h * .4} -8 -{h * .7}" stroke="{GREEN_P}" stroke-width="1.6" fill="none"/>' for x in xs)


def make_sed_removal(path):
    """Antes y después de la remoción de sedimento (corte de un basin o antecámara)."""
    s = []
    for k, (ox, title) in enumerate(((20, "Before: sediment at the cleanout level"), (520, "After: storage restored"))):
        s.append(_t(ox + 230, 22, title, 14, 700, INK, "middle"))
        s.append(f'<path d="M{ox} 60 L{ox + 70} 60 L{ox + 130} 150 L{ox + 330} 150 L{ox + 390} 60 L{ox + 460} 60 L{ox + 460} 180 L{ox} 180 Z" fill="{SOIL}" stroke="{SOIL_D}" stroke-width="1.2"/>')
        s.append(f'<path d="M{ox + 84} 80 L{ox + 376} 80 L{ox + 330} 150 L{ox + 130} 150 Z" fill="{WATER}"/>')
        if k == 0: s.append(f'<path d="M{ox + 108} 116 L{ox + 352} 116 L{ox + 330} 150 L{ox + 130} 150 Z" fill="{SED}"/>')
        s.append(f'<line x1="{ox + 230}" y1="70" x2="{ox + 230}" y2="150" stroke="{INK}" stroke-width="3"/>')
        s.append(f'<line x1="{ox + 222}" y1="116" x2="{ox + 246}" y2="116" stroke="#B4361F" stroke-width="3"/>')
        s.append(_t(ox + 252, 120, "cleanout mark", 11.5, 600, "#B4361F"))
        s.append(_t(ox + 236, 66, "marked stake", 11.5, 400, INK))
    s.append('<line x1="486" y1="110" x2="514" y2="110" stroke="#5F5E5A" stroke-width="1.8" marker-end="url(#ar)"/>')
    return _svg(path, 1000, 190, s)


def make_schematic(path, system):
    """Esquema numerado (corte) de cada sistema para el Condition Check. Los números coinciden con la lista de la página."""
    s = []; W_, H_ = 520, 200
    if system == "SB":
        s.append(f'<path d="M0 62 L70 62 L128 150 L330 150 L372 58 L410 58 L470 128 L520 128 L520 190 L0 190 Z" fill="{SOIL}" stroke="{SOIL_D}" stroke-width="1.2"/>')
        s.append(f'<path d="M92 96 L354 96 L330 150 L128 150 Z" fill="{WATER}"/><path d="M119 136 L336 136 L330 150 L128 150 Z" fill="{SED}"/>')
        s.append(f'<line x1="20" y1="70" x2="96" y2="100" stroke="#5F5E5A" stroke-width="6"/>')                       # inlet pipe
        s.append(f'<rect x="298" y="90" width="9" height="60" fill="#5F5E5A"/><line x1="302" y1="146" x2="500" y2="124" stroke="#5F5E5A" stroke-width="6"/>')  # riser + outlet pipe
        s.append(f'<line x1="210" y1="100" x2="210" y2="150" stroke="{INK}" stroke-width="2.5"/>')
        s.append(_plants((380, 392, 404, 50, 62), 58 if True else 0))
        s += [_num(40, 52, 1), _num(430, 44, 2), _num(210, 84, 3), _num(302, 74, 4), _num(392, 30, 5)]
    elif system == "TW":
        s.append(f'<path d="M0 70 L40 70 L62 150 L118 150 L136 122 L250 122 L262 96 L286 96 L298 122 L400 122 L416 104 L440 104 L470 136 L520 136 L520 190 L0 190 Z" fill="{SOIL}" stroke="{SOIL_D}" stroke-width="1.2"/>')
        s.append(f'<path d="M46 92 L250 92 L262 96 L250 122 L136 122 L118 150 L62 150 Z" fill="{WATER}"/><path d="M286 100 L416 104 L400 122 L298 122 Z" fill="{WATER}"/>')
        s.append(f'<path d="M66 140 L120 140 L118 150 L62 150 Z" fill="{SED}"/>')
        s.append(f'<line x1="6" y1="60" x2="52" y2="88" stroke="#5F5E5A" stroke-width="6"/><line x1="258" y1="108" x2="292" y2="108" stroke="#5F5E5A" stroke-width="6"/>')
        s.append(_plants((150, 170, 190, 210, 230, 310, 330, 350, 370, 390), 122, 26))
        s.append(f'<rect x="414" y="96" width="28" height="8" fill="#5F5E5A"/>')
        s += [_num(22, 44, 1), _num(90, 112, 2), _num(274, 78, 3), _num(190, 74, 4), _num(274, 138, 5), _num(428, 78, 6)]
    elif system == "VD":
        s.append(f'<path d="M0 60 L110 60 L200 150 L320 150 L410 60 L520 60 L520 190 L0 190 Z" fill="{SOIL}" stroke="{SOIL_D}" stroke-width="1.2"/>')
        s.append(f'<path d="M172 122 L348 122 L320 150 L200 150 Z" fill="{WATER}"/>')
        s.append(_plants((130, 146, 162, 215, 235, 255, 275, 295, 360, 376, 392), 150, 22).replace("150 q", "150 q"))
        s.append(f'<line x1="200" y1="166" x2="320" y2="166" stroke="{INK}" stroke-width="1.4" marker-end="url(#ar)" marker-start="url(#ar)"/>')
        s.append(_t(260, 182, "bottom width", 11.5, 400, INK, "middle"))
        s.append(f'<line x1="440" y1="60" x2="440" y2="150" stroke="{INK}" stroke-width="1.4" stroke-dasharray="4 3"/>' + _t(448, 110, "depth", 11.5, 400, INK))
        s.append(f'<circle cx="60" cy="120" r="20" fill="#fff" stroke="#5F5E5A" stroke-width="5"/>')
        s += [_num(146, 84, 1), _num(260, 136, 2), _num(60, 86, 3), _num(480, 44, 4)]
    else:  # WB
        s.append(f'<path d="M0 70 L520 70 L520 190 L0 190 Z" fill="{SOIL}" stroke="{SOIL_D}" stroke-width="1.2"/>')
        s.append(f'<path d="M96 70 L112 152 L408 152 L424 70 Z" fill="{CHIP}" stroke="{INK}" stroke-width="2.4"/>')
        s.append("".join(f'<path d="M{x} {y} l7 -3 M{x + 9} {y + 5} l6 3" stroke="{SOIL_D}" stroke-width="1.3"/>' for x in range(120, 400, 22) for y in (88, 108, 128, 144)))
        s.append(f'<rect x="52" y="52" width="34" height="64" fill="#fff" stroke="#5F5E5A" stroke-width="3"/><rect x="434" y="52" width="34" height="64" fill="#fff" stroke="#5F5E5A" stroke-width="3"/>')
        s.append("".join(f'<line x1="438" y1="{y}" x2="464" y2="{y}" stroke="#5F5E5A" stroke-width="2.5"/>' for y in (78, 90, 102)))
        s.append(f'<line x1="4" y1="96" x2="52" y2="96" stroke="#5F5E5A" stroke-width="6"/><line x1="86" y1="100" x2="108" y2="104" stroke="#5F5E5A" stroke-width="6"/><line x1="412" y1="104" x2="434" y2="100" stroke="#5F5E5A" stroke-width="6"/><line x1="468" y1="100" x2="516" y2="100" stroke="#5F5E5A" stroke-width="6"/>')
        s.append(f'<path d="M69 52 L69 34 L451 34 L451 52" fill="none" stroke="#5F5E5A" stroke-width="3" stroke-dasharray="7 5"/>')
        s += [_num(26, 76, 1), _num(100, 168, 2), _num(260, 60, 3), _num(451, 132, 4), _num(494, 80, 5), _num(260, 20, 6)]
    return _svg(path, W_, H_, s)


def make_cycle(path):
    """Ciclo circular de uso del manual: planear, visitar, encontrar, arreglar, registrar y revisar."""
    import math
    W_, H_ = 1000, 640; cx, cy, R = 500, 322, 250
    st = [("1. Plan", "January, in the office", ["Annual Plan (F03)", "Reference section 1.3"], PAL[0]),
          ("2. Visit", "Routine, spring, pre-storm", ["Visit Sheet (F04)", "Reference chapter 3"], PAL[1]),
          ("3. Look and recognize", "Every visit", ["Inspection checklist", "Field Guide"], PAL[2]),
          ("4. Fix", "Quick fix or scheduled repair", ["Reference chapter 4", "Corrective Log (F05)"], PAL[4]),
          ("5. Record and review", "After every visit and in January", ["Site History (F06)", "Reference section 1.4"], PAL[3])]
    s = [f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="#C4D3E2" stroke-width="16"/>']
    for k in range(5):
        a = math.radians(-90 + 72 * k + 36); x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        s.append(f'<g transform="translate({x:.1f},{y:.1f}) rotate({72 * k + 36 + 90:.1f})"><path d="M-9 -10 L9 0 L-9 10 Z" fill="#8FA9C4"/></g>')
    bw, bh = 272, 136
    for k, (t, sub, lines, pal) in enumerate(st):
        a = math.radians(-90 + 72 * k); x, y = cx + R * math.cos(a) - bw / 2, cy + R * math.sin(a) - bh / 2
        f, sk, tc = pal
        s.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw}" height="{bh}" rx="12" fill="{f}" stroke="{sk}" stroke-width="1.4"/>')
        s.append(_t(x + 14, y + 30, t, 20, 800, tc)); s.append(_t(x + 14, y + 52, sub, 14, 600, sk))
        for j, ln in enumerate(lines): s.append(_t(x + 14, y + 82 + 22 * j, "→ " + ln, 16, 400, tc))
    s.append(_t(cx, cy - 20, "THE MAINTENANCE", 19, 800, BLUE_D, "middle")); s.append(_t(cx, cy + 4, "CYCLE", 19, 800, BLUE_D, "middle"))
    s.append(_t(cx, cy + 30, "for continual improvement", 15, 400, "#5F5E5A", "middle"))
    return _svg(path, W_, H_, s)
