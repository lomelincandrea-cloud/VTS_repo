"""VTS_D02 Field Guide builder: reads data/VTS_plant_catalogue.xlsx and writes output/VTS_D02_Field_Guide.pdf.
English only for now (Spanish columns stay in the Excel). Photos that do not exist are left out, not shown as boxes.
Run:  python3 build_field_guide.py [path/to/manual.pdf]   (the manual PDF is used only to print task page numbers)
"""
import re, subprocess, sys
from html import escape as esc
from pathlib import Path
import openpyxl
from weasyprint import HTML

BASE = Path(__file__).resolve().parent
IMG = BASE / "images"
FONT_DIR = (BASE.parent / "manual_builder" / "fonts").resolve().as_uri()
MANUAL_PDF = sys.argv[1] if len(sys.argv) > 1 else None
VERSION = "Version 1.0 · Draft for review · November 2026"
FOOT = "Field Guide · Vegetated Treatment Systems · Draft for review, November 2026"
SYS_COLOR = {"SB": "#2B7BBF", "TW": "#3C9D5B", "VD": "#C99700", "WB": "#DD6B2A"}
SYS_NAME = {"SB": "Sediment basin", "TW": "Treatment wetland", "VD": "Vegetated ditch", "WB": "Woodchip bioreactor"}
BLUE = "#03467E"

wb = openpyxl.load_workbook(BASE / "data" / "VTS_plant_catalogue.xlsx", read_only=True)


def table(name):
    rows = [r for r in wb[name].iter_rows(values_only=True) if any(c is not None for c in r)]
    h = rows[0]
    return [{k: (str(v).strip() if v is not None else "") for k, v in zip(h, r)} for r in rows[1:]]


plants, watch, signs, wildlife, parts, icons, sources = (table(n) for n in ("Plants", "Watchlist", "Signs", "Wildlife", "Parts", "Icons", "Sources"))
settings = {r["Key"]: r["Value"] for r in table("Settings")}
ICON = {(r["Group"], r["Code"]): r["Meaning"] for r in icons}

# ---- page numbers of manual tasks (from the Task Index of the manual PDF) ----
TASKPAGE, TASKNAME = {}, {}
if MANUAL_PDF and Path(MANUAL_PDF).exists():
    txt = subprocess.run(["pdftotext", "-layout", MANUAL_PDF, "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    for m in re.finditer(r"^\s*((?:SB|TW|VD|WB|COR)_T\d\d)\s{2,}(.+?),\s*p\.\s*(\d+)\s{2,}", txt, re.M):
        TASKPAGE[m.group(1)] = m.group(3)
        TASKNAME[m.group(1)] = m.group(2).strip()


def taskref(code):
    if not code: return ""
    nm = TASKNAME.get(code, "")
    pg = f", manual p. {TASKPAGE[code]}" if code in TASKPAGE else ""
    return f'<span class="task">{esc(nm + " " if nm else "")}({code}{pg})</span>'


def img_tag(img_id, cls="", style=""):
    for e in (".jpg", ".jpeg", ".png", ".svg"):
        p = IMG / f"{img_id}{e}"
        if p.exists(): return f'<img class="{cls}" style="{style}" src="{p.resolve().as_uri()}">'
    return ""   # missing photos are left out


def chips_sys(s):
    return "".join(f'<span class="sys" style="background:{SYS_COLOR[x]}">{x}</span>' for x in re.split(r"[;,\s]+", s) if x in SYS_COLOR)


def zone_svg(zones):
    z = {x for x in re.split(r"[;,\s]+", zones) if x}
    if not z: return ""
    cols = [("W", 6, "#7FB5E0"), ("L", 12, "#8CCB9B"), ("M", 18, "#8CCB9B"), ("H", 24, "#8CCB9B")]
    out = '<svg class="zone" viewBox="0 0 92 38" width="92" height="38">'
    for i, (k, h, c) in enumerate(cols):
        on = k in z
        out += f'<rect x="{i * 22 + 2}" y="{30 - h}" width="20" height="{h}" fill="{c if on else "#E5E7EA"}" stroke="{"#2C6E49" if on and k != "W" else "#1F5F9A" if on else "#C9CDD2"}" stroke-width="1"/>'
        out += f'<text x="{i * 22 + 12}" y="37" font-size="7.5" text-anchor="middle" fill="{"#1F2D3D" if on else "#9AA0A6"}" font-weight="{700 if on else 400}">{k}</text>'
    return out + "</svg>"


def p(*cls_text):
    return "".join(cls_text)


# ---------- STOP AND CALL ----------
STOP = [
    ("A protected animal or a nest", "Frog, salamander, turtle, goby, woodrat nest, or a bird nest. Stop work nearby. Do not touch or move it.", "Wildlife, p."),
    ("A rotten-egg smell near the woodchips or a control box", "Step back. Do not lean into the box. Do not enter.", "Signs of problems, p."),
    ("Water with an unusual color, an oil sheen, or a strong smell", "Do not touch the water. Photograph it from a safe distance.", "Signs of problems, p."),
    ("A berm that is leaking, moving, or about to be overtopped", "Keep people away from it. Do not fill or regrade.", "Signs of problems, p."),
    ("A pump or electrical box that is not working", "Look only. Do not open it or reach into the sump.", "Signs of problems, p."),
    ("Containers, needles, drums, or unknown liquids", "Do not touch or open them. Keep people away.", ""),
    ("A plant you cannot identify with an umbrella-shaped flower", "Do not handle it. It could be poison hemlock.", "Look-alikes, p."),
]


def section_head(id_, title, sub, color=BLUE):
    return f'<section class="divider" id="{id_}" style="background:{color}"><h1>{esc(title)}</h1><div class="sub">{esc(sub)}</div></section>'


def build():
    h = []
    # ---- cover
    cover_img = img_tag("COVER-PHOTO", "coverimg")
    h.append(f'<section class="cover"><div class="photo">{cover_img}</div><div class="title"><h1 class="big">{esc(settings["Title"])}</h1>'
             f'<div class="sub">{esc(settings["Subtitle"])}</div><div class="lede">{esc(settings["Lede"])}</div>'
             f'<div class="ver">{esc(VERSION)}</div><div class="ver">{esc(settings["Companion"])}</div></div>'
             f'<div class="logos">{img_tag("LOGO-CMSF", "logo")}{img_tag("LOGO-UCSC", "logo")}</div></section>')

    # ---- how to use + stop and call + contents
    how = [l.strip("- ").strip() for l in settings["How to use"].split("\n") if l.strip()]
    intro, bullets = how[0], how[1:]
    stop_rows = "".join(f'<tr><td class="s1">{esc(a)}</td><td>{esc(b)}</td></tr>' for a, b, _ in STOP)
    h.append(f'<section class="page"><h1>How to use this guide</h1><p class="lead">{esc(intro)}</p><ul class="how">' + "".join(f"<li>{esc(b)}</li>" for b in bullets) +
             '</ul><div class="stopbox"><div class="stophead">STOP AND CALL THE SUPERVISOR IF YOU SEE</div><table class="stop">' + stop_rows + '</table></div></section>')

    toc = [("#sec-signs", "Signs of problems", "What it is, why it matters, what to do"), ("#sec-parts", "Parts of a system", "The names used in the manual and the checklists"),
           ("#sec-inv", "Invasive plants", "Remove, control, or monitor"), ("#sec-look", "Look-alikes", "Pairs that are easy to mix up"),
           ("#sec-nat", "Native plants", "Protect, encourage, and replant"), ("#sec-ask", "Plants to ask about", "Native or invasive depends on the strain"),
           ("#sec-wild", "Wildlife", "Never trap, poison, or move animals"), ("#sec-key", "Icon key and zones", "How to read the plant cards"), ("#sec-refs", "References", "")]
    h.append('<section class="page"><h1>Contents</h1><table class="toc">' + "".join(f'<tr><td class="t"><a href="{a}">{esc(b)}</a></td><td class="d">{esc(c)}</td><td class="n"><a class="pg" href="{a}"></a></td></tr>' for a, b, c in toc) + '</table>'
             '<h2>Where each system is used</h2><p class="small">Each card shows the systems where it applies: ' + " ".join(f'<span class="sys" style="background:{SYS_COLOR[k]}">{k}</span> {SYS_NAME[k]}' + ("," if k != "WB" else ".") for k in SYS_COLOR) + '</p></section>')

    # ---- signs
    h.append(section_head("sec-signs", "Signs of problems", "What it is, why it matters, and what to do"))
    groups = []
    for s in signs:
        if s["Group"] not in groups: groups.append(s["Group"])
    body = ""
    for g in groups:
        body += f'<h2 class="grp">{esc(g)}</h2><div class="cards">'
        for s in (x for x in signs if x["Group"] == g):
            photo = img_tag(s["Photo"], "cphoto") if s["Photo"] else ""
            body += (f'<div class="card sign"><div class="ch"><b>{esc(s["Name"])}</b>{chips_sys(s["Systems"])}</div>{photo}'
                     f'<p><span class="k">What it is</span> {esc(s["What it is"])}</p><p><span class="k">Why it matters</span> {esc(s["Why it matters"])}</p>'
                     f'<p class="do"><span class="k">What to do</span> {esc(s["What to do"])}</p>'
                     + (f'<p class="ref">Manual: {taskref(s["Task"])}</p>' if s["Task"] else "") + '</div>')
        body += "</div>"
    h.append(f'<section class="page">{body}</section>')

    # ---- parts
    pr = "".join(f'<tr><td class="s1">{esc(x["Part"])}</td><td>{esc(x["What it does"])}</td><td class="c">{chips_sys(x["Systems"])}</td></tr>' for x in parts)
    h.append(section_head("sec-parts", "Parts of a system", "The names used in the manual and the checklists"))
    h.append(f'<section class="page"><h1>Parts of a system</h1><table class="parts"><thead><tr><th>Part</th><th>What it does</th><th>Systems</th></tr></thead><tbody>{pr}</tbody></table></section>')

    # ---- plants
    inv = [x for x in plants if x["Status"] == "Invasive" and not re.search(r"Verify the Invasive", x["Check (not printed)"])]
    ask = [x for x in plants if re.search(r"Verify the (Native|Invasive) label|which one is planted|cultivated crop", x["Check (not printed)"])]
    askids = {x["Plant ID"] for x in ask}
    nat = [x for x in plants if x["Status"] == "Native" and x["Plant ID"] not in askids]

    def traits(x):
        parts_ = [ICON.get(("Form", x["Form"]), ""), ICON.get(("Leaf", x["Leaf"]), ""), ICON.get(("Stem", x["Stem"]), "")]
        t = " · ".join(a for a in parts_ if a)
        if x["Flower"]: t += f" · {x['Flower']} flowers"
        return t

    def sci(x):
        n = x["Scientific name"]
        note = x["Check (not printed)"]
        m = re.search(r"(?:Currently|now usually|Now usually) (Schoenoplectus \w+)", note)
        return esc(n) + (f' <span class="now">(now {esc(m.group(1))})</span>' if m else "")

    def pcard(x, kind):
        photo = img_tag(x["Plant ID"], "cphoto") or (img_tag(x["Photo"].replace(".jpg", ""), "cphoto") if x["Photo"] else "")
        cls = {"Invasive": "inv", "Native": "nat", "Ask": "ask"}[kind]
        chip = {"Invasive": "Invasive: remove", "Native": "Native: protect", "Ask": "Ask your supervisor"}[kind]
        b = (f'<div class="card plant {cls}"><div class="ch"><div><b>{esc(x["Common name"])}</b><div class="sci">{sci(x)}</div></div><span class="st {cls}">{chip}</span></div>{photo}'
             f'<p class="tr">{esc(traits(x))}</p><p>{esc(x["Clue"])}</p>')
        if x["Look-alike caution"]: b += f'<p class="warn"><span class="k">Look-alike</span> {esc(x["Look-alike caution"])}</p>'
        if x["Notes"]: b += f'<p class="do"><span class="k">What to do</span> {esc(x["Notes"])}</p>'
        if kind == "Native" and x["Useful for"]: b += f'<p class="small">Useful for: {esc(x["Useful for"])}</p>'
        b += f'<div class="foot">{zone_svg(x["Zones"]) if kind == "Native" else ""}<span>{chips_sys(x["Found in"])}</span></div></div>'
        return b

    h.append(section_head("sec-inv", "Invasive plants", settings["Invasive subheading"], "#9C2B1B"))
    ih = "".join(pcard(x, "Invasive") for x in inv)
    w_ok = [w for w in watch if w["Source"] in ("County", "Proposed")]
    wr = "".join(f'<tr><td class="s1">{esc(w["Common name"])}<div class="sci">{esc(w["Scientific name"])}</div></td><td>{esc(w["Look for"])}</td></tr>' for w in w_ok)
    h.append(f'<section class="page"><h1>Invasive plants</h1><p class="lead">{esc(settings["Invasive key"])} Wear gloves. Bag what you remove; do not compost it on site.</p>'
             f'<div class="cards">{ih}</div><h2>Also watch for</h2><p class="small">These invasive plants are not on your site list but can show up. Tell the supervisor if you see one.</p>'
             f'<table class="watch"><tbody>{wr}</tbody></table></section>')

    look = [x for x in plants if x["Look-alike caution"]]
    lr = "".join(f'<tr><td class="s1">{esc(x["Common name"])}<div class="sci">{esc(x["Scientific name"])}</div></td><td>{esc(x["Look-alike caution"])}</td></tr>' for x in look)
    h.append(section_head("sec-look", "Look-alikes", "Pairs that are easy to mix up", "#854F0B"))
    h.append(f'<section class="page"><h1>Look-alikes: do not mix these up</h1><p class="lead">When two plants look alike, do not remove or plant either one until your supervisor confirms.</p>'
             f'<table class="parts"><thead><tr><th>Plant</th><th>Be careful</th></tr></thead><tbody>{lr}</tbody></table></section>')

    h.append(section_head("sec-nat", "Native plants", settings["Native subheading"], "#1B6E45"))
    gr = []
    for x in nat:
        if x["Group"] not in gr: gr.append(x["Group"])
    nb = ""
    for g in gr:
        nb += f'<h2 class="grp">{esc(g)}</h2><div class="cards">' + "".join(pcard(x, "Native") for x in nat if x["Group"] == g) + "</div>"
    h.append(f'<section class="page"><h1>Native plants</h1><p class="lead">{esc(settings["Native key"])}</p>{nb}</section>')

    h.append(section_head("sec-ask", "Plants to ask about", "Native or invasive depends on the strain or the use", "#854F0B"))
    h.append('<section class="page"><h1>Plants to ask about</h1><p class="lead">These plants are sometimes planted or seeded at a site. Whether they are native or invasive depends on the species or the strain. Ask your supervisor before you protect or remove them.</p><div class="cards">'
             + "".join(pcard(x, "Ask") for x in ask) + "</div></section>")

    # ---- wildlife
    prot = [x for x in wildlife if x["Group"].startswith("Protected")]
    other = [x for x in wildlife if not x["Group"].startswith("Protected")]
    wrows = ""
    for x in wildlife:
        how_ = "" if x["How to recognize it"].startswith("To be written") else esc(x["How to recognize it"])
        sc = f'<div class="sci">{esc(x["Scientific name"])}</div>' if x["Scientific name"] else ""
        photo = img_tag(re.sub(r"\W+", "-", x["Common name"]).strip("-"), "cphoto")
        wrows += f'<tr><td class="s1">{esc(x["Common name"])}{sc}<div class="tag">{esc(x["Group"])}</div></td><td>{how_}{photo}</td><td class="do2">{esc(x["What to do"])}</td></tr>'
    h.append(section_head("sec-wild", "Wildlife", "Never trap, poison, or move animals", "#1F5F9A"))
    h.append('<section class="page"><h1>Wildlife</h1><p class="lead">If you think a protected animal or a nest may be there, stop work nearby, do not touch it, and tell the supervisor. The supervisor calls a qualified biologist.</p>'
             f'<table class="wild"><thead><tr><th>Animal</th><th>How to recognize it</th><th>What to do</th></tr></thead><tbody>{wrows}</tbody></table></section>')

    # ---- key
    def klist(g): return "".join(f'<tr><td class="s1">{k[1]}</td><td>{esc(v)}</td></tr>' for k, v in ICON.items() if k[0] == g)
    h.append('<section class="divider" id="sec-key" style="background:#444441"><h1>Icon key and zones</h1><div class="sub">How to read the plant cards</div></section>')
    h.append('<section class="page"><h1>How to read a plant card</h1><p class="lead">Each card lists the form of the plant, its leaves, its stem, and the color of its flowers, then a short clue.</p><div class="cols3">'
             f'<div><h2>Form</h2><table class="keyt">{klist("Form")}</table></div><div><h2>Leaf</h2><table class="keyt">{klist("Leaf")}</table></div><div><h2>Stem</h2><table class="keyt">{klist("Stem")}</table></div></div>'
             f'<h2>Planting zones</h2><p>{esc(settings["Zone note"])}</p><p>{zone_svg("W;L;M;H")} On a native card, a green step means the plant grows in that zone.</p></section>')

    # ---- references
    used = {s for x in plants for s in re.split(r"[;,\s]+", x["Sources"]) if s}
    refs = [s for s in sources if s["Key"] in used and s["Key"] != "PENDING" and s["Key"] in ("LID-G", "MCAC", "CalIPC")]
    rl = "".join(f'<p class="refp">{esc(s["Source"])}</p>' for s in refs)
    rl += '<p class="refp">Calflora. calflora.org</p><p class="refp">Resource Conservation District of Monterey County. (2025). Past projects by the RCD of Monterey County. https://www.rcdmonterey.org/past-projects</p>'
    rl += '<p class="refp">Krone, et al. (2022); Coastal Conservancy (2020); Central Coast Wetlands Group (2017, 2018); Stakeholder interviews, 2026. Full citations are in the References of VTS_D01.</p>'
    h.append(f'<section class="page" id="sec-refs"><h1>References</h1>{rl}</section>')
    return "".join(h)


CSS = f"""
@font-face {{ font-family:'Public Sans'; src:url('{FONT_DIR}/PublicSans-VF.ttf'); font-weight:100 900; }}
@font-face {{ font-family:'Public Sans'; src:url('{FONT_DIR}/PublicSans-Italic-VF.ttf'); font-weight:100 900; font-style:italic; }}
@font-face {{ font-family:'Barlow Condensed'; src:url('{FONT_DIR}/BarlowCondensed-SemiBold.ttf'); font-weight:600; }}
@font-face {{ font-family:'Barlow Condensed'; src:url('{FONT_DIR}/BarlowCondensed-Bold.ttf'); font-weight:700; }}
@page {{ size:Letter; margin:.6in .6in .7in; @bottom-left {{ content:"{FOOT}"; font:8pt 'Public Sans'; color:#5F5E5A; }} @bottom-right {{ content:counter(page); font:8pt 'Public Sans'; color:#5F5E5A; }} }}
@page cover {{ margin:0; @bottom-left {{ content:none }} @bottom-right {{ content:none }} }}
@page div {{ margin:0; @bottom-left {{ content:none }} @bottom-right {{ content:none }} }}
body {{ font:9pt/1.38 'Public Sans'; color:#1F2D3D; }}
h1 {{ font:700 22pt 'Barlow Condensed'; color:var(--c, {BLUE}); text-transform:uppercase; margin:0 0 6pt; border-bottom:2pt solid #F6B800; padding-bottom:3pt; break-after:avoid; }}
h2 {{ font:700 13pt 'Barlow Condensed'; color:{BLUE}; text-transform:uppercase; margin:12pt 0 4pt; break-after:avoid; }}
h2.grp {{ border-bottom:1pt solid #C9D6E3; padding-bottom:2pt; }}
.lead {{ font-size:10pt; margin:0 0 8pt; color:#33485d; }}
.small {{ font-size:8pt; color:#5F5E5A; }}
.page {{ page-break-before:always; }}
.cover {{ page:cover; height:11in; position:relative; }} .cover .photo {{ height:5.9in; overflow:hidden; }} .cover .coverimg {{ width:100%; height:5.9in; object-fit:cover; }}
.cover .title {{ padding:.35in .7in 0; }} .cover h1.big {{ font-size:50pt; border:none; line-height:.98; margin:0 0 8pt; }}
.cover .sub {{ font:700 17pt 'Barlow Condensed'; color:{BLUE}; }} .cover .lede {{ font-size:12pt; color:#33485d; margin-top:4pt; max-width:5.2in; }} .cover .ver {{ margin-top:6pt; font-size:9pt; color:#5F5E5A; }}
.cover .logos {{ position:absolute; left:.7in; right:.7in; bottom:.45in; display:flex; justify-content:space-between; }} .cover .logo {{ height:.6in; }}
.divider {{ page:div; page-break-before:always; height:11in; color:#fff; padding:3.4in .8in 0; box-sizing:border-box; }}
.divider h1 {{ color:#fff; font-size:46pt; border:none; }} .divider .sub {{ font-size:14pt; opacity:.9; }}
ul.how {{ margin:0 0 10pt 14pt; padding:0; }} ul.how li {{ margin:2pt 0; }}
.stopbox {{ border:2pt solid #B4361F; border-radius:8pt; margin-top:12pt; overflow:hidden; }}
.stophead {{ background:#B4361F; color:#fff; font:700 14pt 'Barlow Condensed'; padding:5pt 10pt; letter-spacing:.3pt; }}
table.stop {{ width:100%; border-collapse:collapse; }} table.stop td {{ padding:5pt 10pt; border-top:.5pt solid #E8C4BC; vertical-align:top; }} table.stop td.s1 {{ width:38%; font-weight:700; color:#7A2415; }}
table.toc {{ width:100%; border-collapse:collapse; }} table.toc td {{ padding:6pt 4pt; border-bottom:.5pt solid #D5DBE2; }} table.toc .t {{ font:700 13pt 'Barlow Condensed'; text-transform:uppercase; }} table.toc .n {{ text-align:right; width:30pt; }} table.toc a {{ color:inherit; text-decoration:none; }}
a.pg::after {{ content:target-counter(attr(href), page); }}
.cards {{ display:block; font-size:0; }} .cards > * {{ font-size:9pt; }}
.card {{ display:inline-block; vertical-align:top; width:48.6%; margin:0 1% 7pt 0; box-sizing:border-box; border:1pt solid #C9D6E3; border-left:4pt solid {BLUE}; border-radius:6pt; padding:6pt 8pt; page-break-inside:avoid; background:#fff; }}
.card.inv {{ border-left-color:#B4361F; }} .card.nat {{ border-left-color:#2F8F5B; }} .card.ask {{ border-left-color:#C99700; }}
.card p {{ margin:3pt 0; }} .card .ch {{ display:flex; justify-content:space-between; align-items:flex-start; gap:6pt; margin-bottom:2pt; }}
.card .ch b {{ font-size:10.5pt; }} .sci {{ font-style:italic; font-size:8pt; color:#5F5E5A; }} .now {{ font-style:normal; }}
.k {{ font-weight:700; color:{BLUE}; font-size:7.5pt; text-transform:uppercase; letter-spacing:.2pt; display:inline-block; margin-right:3pt; }}
.do {{ background:#EEF5FB; border-radius:4pt; padding:3pt 5pt; }} .warn {{ background:#FDF1E1; border-radius:4pt; padding:3pt 5pt; }}
.tr {{ font-size:8pt; color:#33485d; font-weight:600; }} .ref {{ font-size:8pt; color:#5F5E5A; }} .task {{ color:{BLUE}; }}
.sys {{ display:inline-block; color:#fff; font:700 7pt 'Public Sans'; padding:1pt 4pt; border-radius:3pt; margin-left:2pt; }}
.st {{ font:700 7pt 'Public Sans'; padding:2pt 5pt; border-radius:8pt; white-space:nowrap; }}
.st.nat {{ background:#E1F5EE; color:#0F6E56; }} .st.inv {{ background:#FCEBEB; color:#A32D2D; }} .st.ask {{ background:#FAEEDA; color:#854F0B; }}
.foot {{ display:flex; justify-content:space-between; align-items:flex-end; margin-top:4pt; }}
.cphoto {{ width:100%; max-height:1.5in; object-fit:cover; border-radius:4pt; margin:3pt 0; }}
table.parts, table.wild, table.watch {{ width:100%; border-collapse:collapse; }}
table.parts th, table.wild th {{ background:{BLUE}; color:#fff; text-align:left; padding:4pt 6pt; font:700 9pt 'Barlow Condensed'; text-transform:uppercase; }}
table.parts td, table.wild td, table.watch td {{ padding:4pt 6pt; border-bottom:.5pt solid #D5DBE2; vertical-align:top; page-break-inside:avoid; }}
td.s1 {{ font-weight:700; width:26%; }} td.c {{ width:20%; }} .tag {{ font-weight:400; font-size:7.5pt; color:#854F0B; }} td.do2 {{ width:34%; background:#EEF5FB; }}
table.keyt td {{ padding:1.5pt 4pt; border-bottom:.4pt solid #E1E5EA; font-size:8.5pt; }} table.keyt td.s1 {{ width:26pt; color:{BLUE}; }}
.cols3 {{ display:flex; gap:12pt; }} .cols3 > div {{ flex:1; }}
.refp {{ margin:4pt 0; font-size:8.5pt; padding-left:12pt; text-indent:-12pt; }}
svg.zone {{ vertical-align:middle; }}
"""

if __name__ == "__main__":
    body = build()
    # section dividers are merged into the first page of each section (saves 8 pages)
    body = re.sub(r'<section class="divider" id="([\w-]+)" style="background:(#[0-9A-Fa-f]+)">.*?</div></section><section class="page"', r'<section class="page" id="\1" style="--c:\2"', body)
    body = body.replace("(Appendix G notes it can be invasive)", "(it can become invasive)")
    html = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>VTS Field Guide</title><style>{CSS}</style></head><body>{body}</body></html>"
    (BASE / "output" / "field_guide.html").write_text(html, encoding="utf-8")
    HTML(string=html, base_url=str(BASE)).write_pdf(str(BASE / "output" / "VTS_D02_Field_Guide.pdf"))
    print("PDF ok")
