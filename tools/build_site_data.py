"""Builds the Learn data of the website from the two source workbooks.

Reads   tools/manual_builder/data/VTS_manual_content.xlsx        (manual: tasks, steps, flows, topics, checklist, site conditions)
        tools/plant_catalogue_builder/data/VTS_plant_catalogue.xlsx (Field Guide: plants, watchlist, icons, sources)
        tools/site_data/plant_icons.json                          (plant icon drawings)
Writes  docs/learn_data.js      window.VTS_LEARN = {...}   (the Tool keeps its own docs/data.js)
        docs/img/manual/*        figures used by the topics
        docs/downloads/*         latest draft PDFs and Excel forms (marked DRAFT on the site)
        docs/tool/*.json         sample records and indicators for the Tool (copied from tools/report_templates)
        docs/tool/templates, docs/tool/fonts   report templates and fonts, so the Tool prints the same reports

Run from the repo root with the conda environment "vts" (Graphviz 'dot' must be on the PATH for the flow diagrams):
    python tools/build_site_data.py
Rebuild the manual PDF and the Field Guide first if you want the downloads to match the latest workbook.
"""
import html, json, re, shutil, sys, tempfile
from datetime import date
from pathlib import Path
import markdown, openpyxl

ROOT = Path(__file__).resolve().parents[1]
MB, PB = ROOT / "tools" / "manual_builder", ROOT / "tools" / "plant_catalogue_builder"
DOCS = ROOT / "docs"
sys.path.insert(0, str(MB))
import flows  # noqa: E402

VISIT_ORDER = ["Routine visit", "After storms", "Spring visit", "Pre-storm visit", "January review (office)", "When needed", "Corrective"]
SYS_NAME = {"SB": "Sediment basin", "TW": "Treatment wetland", "VD": "Vegetated ditch", "WB": "Woodchip bioreactor", "COR": "Corrective maintenance"}
S = lambda v: "" if v is None else str(v).strip()


def rows(wb, name):
    it = wb[name].iter_rows(values_only=True); h = next(it)
    return [dict(zip(h, r)) for r in it if any(c not in (None, "") for c in r)]


wb = openpyxl.load_workbook(MB / "data" / "VTS_manual_content.xlsx", data_only=True)
pw = openpyxl.load_workbook(PB / "data" / "VTS_plant_catalogue.xlsx", data_only=True)
T, ST, GR = rows(wb, "Tasks"), rows(wb, "Steps"), rows(wb, "Task_Groups")
FS = {S(r["Task ID"]): r for r in rows(wb, "Flow_specs")}
TOP, SEC, REF = rows(wb, "Topics"), rows(wb, "Topic_Sections"), rows(wb, "References")
CL, SP, GL = rows(wb, "Checklist_Items"), rows(wb, "Site_Params"), rows(wb, "Glossary")
TASKN = {S(r["Task ID"]): S(r["Task name"]) for r in T}
TOPN = {S(r["Topic ID"]): S(r["Title"]) for r in TOP}
SHORT = {S(r["Citation key"]): S(r["Short cite"]) for r in REF}


def links(t):
    t = re.sub(r"\{\{task:([^}]+)\}\}", lambda m: f'<a href="#learn/task/{m.group(1)}">{html.escape(TASKN.get(m.group(1), m.group(1)))}</a>', t)
    t = re.sub(r"\{\{topic:([^}]+)\}\}", lambda m: f'<a href="#learn/topic/{m.group(1)}">{html.escape(TOPN.get(m.group(1), m.group(1)))}</a>', t)
    return re.sub(r"\{\{doc:([^}]+)\}\}", r"\1", t)


def md(t, inline=False):
    h = markdown.markdown(S(t), extensions=["tables"])
    if inline: h = re.sub(r"^<p>(.*)</p>$", r"\1", h, flags=re.S)
    return links(h)


def field(t):
    """Same convention as the manual: text, then notes after each '*'."""
    t = S(t)
    if not t: return ""
    parts = re.split(r"\s*\*", t); head, notes = parts[0].strip(), [p.strip() for p in parts[1:] if p.strip()]
    out = md(head) if head else ""
    if notes: out += "<ul class='notes'>" + "".join(f"<li>{md(n, True)}</li>" for n in notes) + "</ul>"
    return out


# ---------------- flow diagrams (inline SVG)
tmp = Path(tempfile.mkdtemp()); flow_svg = {}
def render_flow(key, spec):
    try:
        flows.render_flow(spec, str(tmp / key), formats=("svg",))
        svg = (tmp / f"{key}.svg").read_text(encoding="utf-8"); svg = svg[svg.index("<svg"):]
        return re.sub(r'<svg width="[^"]+" height="[^"]+"', "<svg", svg, count=1)
    except Exception as e:
        print(f"  flow {key}: {e}"); return ""
for tid, r in FS.items():
    if S(r["Status"]) == "Curated" and S(r["Spec"]): flow_svg[tid] = render_flow(tid, S(r["Spec"]))
for g in GR:
    if S(g.get("Flow spec")): flow_svg[S(g["Group ID"])] = render_flow(S(g["Group ID"]), S(g["Flow spec"]))
print(len([v for v in flow_svg.values() if v]), "flow diagrams")

# ---------------- tasks and groups
steps = {}
for s in sorted(ST, key=lambda s: (S(s["Task ID"]), int(s["Order"]))):
    steps.setdefault(S(s["Task ID"]), []).append({"t": md(re.sub(r"^(Yes|No)\s*[:\-–—]\s*", "", S(s["Text"]), flags=re.I), True), "ty": S(s["Step type"]), "lv": int(s["Level"])})
group_of = {}
groups = []
for g in GR:
    gid = S(g["Group ID"]); members = [m.strip() for m in S(g["Members"]).split(";") if m.strip()]
    for m in members: group_of[m] = gid
    groups.append({"id": gid, "name": S(g["Name"]), "visit": S(g["Visit"]), "members": members, "intro": md(g["Intro"]) if S(g["Intro"]) else "",
                   "table": md(g["Action table"]) if S(g["Action table"]) else "", "notes": field(g["Notes"]), "tools": field(g["Tools and equipment"]),
                   "safety": field(g["Safety notes"]), "esc": field(g["Escalation"]), "resp": field(g["Responsibilities"]),
                   "by": {k: md(g[k], True) for k in ("SB", "TW", "VD", "WB") if S(g.get(k))}, "flow": flow_svg.get(gid, "")})
tasks = []
for r in T:
    i = S(r["Task ID"])
    tasks.append({"id": i, "sys": S(r["System"]), "no": int(r["No"]), "name": S(r["Task name"]), "visit": S(r["Visit"]), "freq": [x.strip() for x in S(r["Frequency chips"]).split(";") if x.strip()],
                  "type": S(r["Task type"]), "level": S(r["Action level"]), "component": S(r["Component"]), "months": S(r["Plan months"]),
                  "short": md(r["Short description"], True), "when": md(r["When"], True), "resp": field(r["Responsibilities"]), "tools": field(r["Tools and equipment"]),
                  "safety": field(r["Safety notes"]), "waste": field(r["Waste handling"]), "esc": field(r["Escalation"]), "notes": field(r["Notes"]),
                  "basis": [SHORT.get(b.strip(), b.strip()) for b in S(r["Basis"]).split(";") if b.strip()],
                  "steps": steps.get(i, []), "flow": flow_svg.get(i, ""), "group": group_of.get(i, ""), "status": S(r["Review status"])})

# ---------------- topics (HTML) and their figures
IMG_OUT = DOCS / "img" / "manual"; IMG_OUT.mkdir(parents=True, exist_ok=True)
def figure(im, caption):
    for ext in (".svg", ".png", ".jpg", ".jpeg"):
        f = MB / "images" / f"{im}{ext}"
        if f.exists():
            shutil.copy(f, IMG_OUT / f.name)
            return f'<figure><img src="img/manual/{f.name}" alt="{html.escape(caption)}" loading="lazy"><figcaption>{html.escape(caption)}</figcaption></figure>'
    return ""
def visits_table():
    g = {v: {} for v in VISIT_ORDER}
    for t in tasks:
        if t["visit"] in g: g[t["visit"]].setdefault(t["name"], []).append(t)
    body = "".join(f"<tr><td>{v}</td><td>" + "<br>".join(f'<a href="#learn/task/{ts[0]["id"]}">{html.escape(n)}</a> <small>({", ".join(x["sys"] for x in ts)})</small>' for n, ts in g[v].items()) + "</td></tr>" for v in VISIT_ORDER if g[v])
    return f"<table><thead><tr><th>Visit</th><th>Tasks</th></tr></thead><tbody>{body}</tbody></table>"
def system_table(sysid):
    body = "".join(f"<tr><td>{v}</td><td>" + "<br>".join(f'<a href="#learn/task/{t["id"]}">{html.escape(t["name"])}</a>' for t in tasks if t["sys"] == sysid and t["visit"] == v) + "</td></tr>"
                   for v in VISIT_ORDER if any(t["sys"] == sysid and t["visit"] == v for t in tasks))
    return f"<table><thead><tr><th>Visit</th><th>Tasks</th></tr></thead><tbody>{body}</tbody></table>"
topics = []
for tp in TOP:
    tid = S(tp["Topic ID"]); parts = [f'<div class="intro">{md(tp["Intro"])}</div>'] if S(tp["Intro"]) else []
    for sc in sorted([s for s in SEC if S(s["Topic ID"]) == tid], key=lambda s: int(s["Order"])):
        h, tx, ty, src = S(sc["Heading"]), S(sc["Text"]), S(sc["Type"]), S(sc["Table source"])
        if h: parts.append(f"<h2>{html.escape(h)}</h2>")
        if ty == "Image":
            parts += [figure(im.strip(), tx) for im in S(sc["Images"]).split(",") if im.strip()]; continue
        if src == "auto:visits": parts.append(md(tx) + visits_table()); continue
        if src.startswith("auto:") and src[5:] in SYS_NAME: parts.append(md(tx) + system_table(src[5:])); continue
        if ty == "Definition list":
            parts.append("<dl class='gl'>" + "".join(f"<dt>{html.escape(S(g['Term']))}</dt><dd>{html.escape(S(g['Definition']))}</dd>" for g in sorted(GL, key=lambda g: S(g['Term']).lower())) + "</dl>"); continue
        if ty == "Table":
            if tx: parts.append(md(tx))
            if S(sc["Table data"]): parts.append(md(sc["Table data"]))
            continue
        if tx: parts.append(md(tx))
    topics.append({"id": tid, "title": TOPN[tid], "sys": S(tp["System"]), "html": "".join(p for p in parts if p)})

# ---------------- checklist and site conditions (also used by the Tool)
checklist = [{"id": S(r["Item ID"]), "sys": S(r["System"]), "sec": S(r["Section"]), "q": S(r["Question"]), "look": S(r["Look for"]), "normal": S(r["Normal looks like"]),
              "ab": S(r["If abnormal"]), "vis": [x.strip() for x in S(r["Visit types"]).split(";") if x.strip()], "photo": S(r["Photo if abnormal"]) == "Yes",
              "go": [x for x in S(r["Go to tasks"]).split("|") if x]} for r in CL]
site_params = {}
for r in SP: site_params.setdefault(S(r["System"]), []).append({"field": S(r["Field"]), "notes": S(r["Notes"])})

# ---------------- Field Guide (plants)
icons = json.loads((ROOT / "tools" / "site_data" / "plant_icons.json").read_text(encoding="utf-8"))
sp_ = lambda v: [x.strip() for x in S(v).split(";") if x.strip()]
plants = [{"id": S(r["Plant ID"]), "status": S(r["Status"]), "group": S(r["Group"]), "sci": S(r["Scientific name"]), "com": S(r["Common name"]), "type": S(r["Type"]),
           "sys": sp_(r["Found in"]), "ben": S(r["Benefits"]), "form": S(r["Form"]), "leaf": S(r["Leaf"]), "stem": S(r["Stem"]), "flower": S(r["Flower"]), "clue": S(r["Clue"]),
           "zones": sp_(r["Zones"]), "useful": sp_(r["Useful for"]), "look": S(r["Look-alike caution"]), "src": sp_(r["Sources"]), "note": S(r["Notes"])} for r in rows(pw, "Plants")]
watch = [{"com": S(r["Common name"]), "sci": S(r["Scientific name"]), "look": S(r["Look for"]), "src": S(r["Source"])} for r in rows(pw, "Watchlist")]
plant_sources = {S(r["Key"]): {"short": S(r["Short"]), "apa": S(r["Source"])} for r in rows(pw, "Sources")}
icon_names = {S(r["Code"]): S(r["Meaning"]) for r in rows(pw, "Icons")}

# ---------------- downloads (latest drafts)
DL = DOCS / "downloads"; DL.mkdir(exist_ok=True)
def latest(folder, pattern):
    fs = sorted(folder.glob(pattern)); return fs[-1] if fs else None
docs = []
for code, title, f, kind, what in (
        ("VTS_D01", "Operation and Maintenance Manual", latest(MB / "output", "VTS_D01_OM_Manual_draft_for_review_*.pdf"), "pdf", "The full manual: systems, tasks, corrective maintenance, and the forms as appendices."),
        ("VTS_D02", "Field Guide", latest(PB / "output", "VTS_D02_Field_Guide_draft_*.pdf"), "pdf", "Plants, warning signs, and wildlife to know in the field."),
        ("Forms", "Forms F01 to F07 (Excel)", MB / "output" / "VTS_forms.xlsx", "xlsx", "Document control, preventive reference, annual plans, corrective log, site history, site card."),
        ("SB_F04", "Visit Sheet, sediment basin (Excel)", MB / "output" / "SB_F04_visual_inspection_checklist.xlsx", "xlsx", "The checklist to fill in at each visit."),
        ("TW_F04", "Visit Sheet, treatment wetland (Excel)", MB / "output" / "TW_F04_visual_inspection_checklist.xlsx", "xlsx", "The checklist to fill in at each visit."),
        ("VD_F04", "Visit Sheet, vegetated ditch (Excel)", MB / "output" / "VD_F04_visual_inspection_checklist.xlsx", "xlsx", "The checklist to fill in at each visit."),
        ("WB_F04", "Visit Sheet, woodchip bioreactor (Excel)", MB / "output" / "WB_F04_visual_inspection_checklist.xlsx", "xlsx", "The checklist to fill in at each visit.")):
    if not f or not f.exists():
        print(f"  download missing (build it first): {code}"); continue
    shutil.copy(f, DL / f.name)
    docs.append({"code": code, "title": title, "file": f"downloads/{f.name}", "kind": kind, "size_kb": round(f.stat().st_size / 1024), "what": what, "status": "Draft"})

# ---------------- Tool sample records (same file the report templates use)
(DOCS / "tool").mkdir(exist_ok=True)
shutil.copy(ROOT / "tools" / "report_templates" / "sample_data.json", DOCS / "tool" / "sample_data.json")
shutil.copy(ROOT / "tools" / "report_templates" / "indicators.json", DOCS / "tool" / "indicators.json")
# report templates and their fonts, so the Tool prints the same reports in the browser (rendered with Nunjucks)
for sub, src, pat in (("templates", ROOT / "tools" / "report_templates", "*.html"), ("fonts", MB / "fonts", "*.ttf")):
    (DOCS / "tool" / sub).mkdir(exist_ok=True)
    for f in sorted(src.glob(pat)): shutil.copy(f, DOCS / "tool" / sub / f.name)

data = {"built": date.today().isoformat(), "visits": VISIT_ORDER, "systems": SYS_NAME, "tasks": tasks, "groups": groups, "topics": topics,
        "checklist": checklist, "siteParams": site_params, "plants": plants, "watch": watch, "plantSources": plant_sources,
        "icons": icons["icons"], "iconNames": icon_names, "flowerHex": icons["flowerHex"], "downloads": docs}
out = DOCS / "learn_data.js"
out.write_text("// Built by tools/build_site_data.py from the manual and plant catalogue workbooks. Do not edit by hand.\nwindow.VTS_LEARN=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
shutil.rmtree(tmp, ignore_errors=True)
print(f"learn_data.js {out.stat().st_size // 1024} KB: {len(tasks)} tasks, {len(groups)} groups, {len(topics)} topics, {len(checklist)} checklist items, {len(plants)} plants, {len(docs)} downloads")
