import sys, re, json, html, shutil, os, markdown, openpyxl
sys.path.insert(0, "/home/claude/v3"); sys.path.insert(0, "/home/claude/book")
import flows
wb = openpyxl.load_workbook("/home/claude/v3/VTS_manual_content.xlsx", data_only=True)
pw = openpyxl.load_workbook("/home/claude/v3/pc/VTS_plant_catalogue.xlsx", data_only=True)
def rows(w, n):
    it = w[n].iter_rows(values_only=True); h = next(it); return [dict(zip(h, r)) for r in it if any(c not in (None, "") for c in r)]
S = lambda v: "" if v is None else str(v).strip()
T = rows(wb, "Tasks"); ST = rows(wb, "Steps"); FS = {S(r["Task ID"]): r for r in rows(wb, "Flow_specs")}
TOP = rows(wb, "Topics"); SEC = rows(wb, "Topic_Sections"); REF = rows(wb, "References"); CL = rows(wb, "Checklist_Items"); LK = rows(wb, "Look_at"); SP = rows(wb, "Site_Params"); GL = rows(wb, "Glossary")
TASKN = {S(r["Task ID"]): S(r["Task name"]) for r in T}; TOPN = {S(r["Topic ID"]): S(r["Title"]).replace(" And ", " and ") for r in TOP}
SHORT = {S(r["Citation key"]): S(r["Short cite"]) for r in REF}
def fmt(t):
    t = html.escape(S(t))
    t = re.sub(r"\{\{task:([^}]+)\}\}", lambda m: f'<a href="#/task/{m.group(1)}">{html.escape(TASKN.get(m.group(1), m.group(1)))}</a>', t)
    t = re.sub(r"\{\{topic:([^}]+)\}\}", lambda m: f'<a href="#/topic/{m.group(1)}">{html.escape(TOPN.get(m.group(1), m.group(1)))}</a>', t)
    t = re.sub(r"\{\{doc:([^}]+)\}\}", r"\1", t)
    lines = t.split("\n"); out = []; ul = False
    for ln in lines:
        if ln.startswith("- "):
            if not ul: out.append("<ul>"); ul = True
            out.append(f"<li>{ln[2:]}</li>")
        else:
            if ul: out.append("</ul>"); ul = False
            if ln.strip(): out.append(f"<p>{ln}</p>")
    if ul: out.append("</ul>")
    return "".join(out)
# ---- flujos
os.makedirs("flows", exist_ok=True); fl = {}
for tid, r in FS.items():
    if S(r["Status"]) == "Curated":
        flows.render_flow(S(r["Spec"]), f"flows/{tid}", formats=("svg",))
        svg = open(f"flows/{tid}.svg", encoding="utf-8").read(); svg = svg[svg.index("<svg"):]
        svg = re.sub(r'<svg width="[^"]+" height="[^"]+"', "<svg", svg, 1); fl[tid] = svg
print(len(fl), "diagramas")
steps = {}
for s in ST: steps.setdefault(S(s["Task ID"]), []).append(dict(t=fmt(re.sub(r"^(Yes|No)\s*[:\-]\s*", "", S(s["Text"]))) .replace("<p>", "").replace("</p>", ""), ty=S(s["Step type"]), lv=int(s["Level"])))
tasks = []
for r in T:
    i = S(r["Task ID"])
    tasks.append(dict(id=i, sys=S(r["System"]), no=int(r["No"]), name=S(r["Task name"]), kind=S(r["Kind"]), primary=S(r["Primary frequency"]), freq=[x.strip() for x in S(r["Frequency chips"]).split(";") if x.strip()], visit=S(r["Visit"]), cor=S(r["Corrective class"]),
        type=S(r["Task type"]), level=S(r["Action level"]), short=fmt(r["Short description"]), when=fmt(r["When"]), resp=fmt(r["Responsibilities"]), tools=fmt(r["Tools and equipment"]), safety=fmt(r["Safety notes"]), waste=fmt(r["Waste handling"]), esc=fmt(r["Escalation"]), notes=fmt(r["Notes"]),
        basis=[SHORT.get(b.strip(), b.strip()) for b in S(r["Basis"]).split(";") if b.strip()], steps=steps.get(i, []), flow=fl.get(i, "")))
# ---- temas (HTML)
def md(t): return markdown.markdown(t, extensions=["tables"])
def auto_table(sysid):
    order = ["Routine", "Seasonal", "Biannual", "Annual", "Multiyear / Comprehensive", "As needed"]; g = {}
    for t in tasks:
        if t["sys"] == sysid: g.setdefault(t["primary"], []).append(t)
    rws = "".join(f'<tr><td>{f}</td><td>' + "<br>".join(f'<a href="#/task/{t["id"]}">{html.escape(t["name"])}</a>' for t in g[f]) + "</td></tr>" for f in order if f in g)
    return f"<table><thead><tr><th>Frequency</th><th>Tasks</th></tr></thead><tbody>{rws}</tbody></table>"
def visits_table():
    vo = ["Routine visit", "Seasonal visit", "Annual visit", "As needed (programmed)", "As needed (corrective)"]; g = {v: {} for v in vo}
    for t in tasks:
        if t["visit"] in g: g[t["visit"]].setdefault(t["name"], []).append(t["sys"])
    return "<table><thead><tr><th>Visit</th><th>Tasks</th></tr></thead><tbody>" + "".join(f"<tr><td>{v}</td><td>" + "<br>".join(f'{html.escape(n)} <small>({", ".join(ss)})</small>' for n, ss in g[v].items()) + "</td></tr>" for v in vo if g[v]) + "</tbody></table>"
imgdir = "/home/claude/v3/images"; topics = []
for tp in TOP:
    tid = S(tp["Topic ID"]); parts = [f'<div class="intro">{fmt(tp["Intro"])}</div>'] if S(tp["Intro"]) else []
    for sc in sorted([s for s in SEC if S(s["Topic ID"]) == tid], key=lambda s: int(s["Order"])):
        h, tx, ty = S(sc["Heading"]), S(sc["Text"]), S(sc["Type"])
        if h: parts.append(f"<h2>{html.escape(h)}</h2>")
        src = S(sc["Table source"])
        if ty == "Image":
            for im in [x.strip() for x in S(sc["Images"]).split(",") if x.strip()]:
                if os.path.exists(f"{imgdir}/{im}.jpg"): shutil.copy(f"{imgdir}/{im}.jpg", f"docs/img/{im}.jpg"); parts.append(f'<figure><img src="img/{im}.jpg" alt=""><figcaption>{html.escape(tx)}</figcaption></figure>')
            continue
        if src == "auto:visits": parts.append(fmt(tx) + visits_table()); continue
        if src.startswith("auto:"): parts.append(fmt(tx) + auto_table(src[5:])); continue
        if ty == "Definition list": parts.append("<dl class='gl'>" + "".join(f"<dt>{html.escape(S(g['Term']))}</dt><dd>{html.escape(S(g['Definition']))}</dd>" for g in sorted(GL, key=lambda g: S(g['Term']).lower())) + "</dl>"); continue
        if ty == "Terms":
            for p in re.split(r"\n\n+", tx):
                m = re.match(r"^(.{2,40}?) — (.+)$", p, re.S); parts.append(f'<p><span class="chip">{html.escape(m.group(1))}</span> {html.escape(m.group(2))}</p>' if m else f"<p>{html.escape(p)}</p>")
            continue
        if ty == "Table":
            if tx and not tx.startswith("("): parts.append(fmt(tx))
            t_html = md(S(sc["Table data"])); t_html = re.sub(r"\{\{task:([^}]+)\}\}", lambda m: f'<a href="#/task/{m.group(1)}">{html.escape(TASKN.get(m.group(1), m.group(1)))}</a>', t_html); parts.append(t_html); continue
        parts.append(md(re.sub(r"(?m)^(\d+)\.(?=\S)", r"\1. ", tx)) if re.search(r"(?m)^(\d+\.|-)\s", tx) else fmt(tx))
        parts[-1] = re.sub(r"\{\{task:([^}]+)\}\}", lambda m: f'<a href="#/task/{m.group(1)}">{html.escape(TASKN.get(m.group(1), m.group(1)))}</a>', parts[-1])
        parts[-1] = re.sub(r"\{\{topic:([^}]+)\}\}", lambda m: f'<a href="#/topic/{m.group(1)}">{html.escape(TOPN.get(m.group(1), m.group(1)))}</a>', parts[-1])
    topics.append(dict(id=tid, title=TOPN[tid], sys=S(tp["System"]), html="".join(parts)))
# ---- checklists
sp = {}
for r in SP: sp.setdefault(S(r["System"]), []).append(S(r["Field"]))
items = [dict(id=S(r["Item ID"]), sys=S(r["System"]), sec=S(r["Section"]), q=S(r["Question"]), look=S(r["Look for"]), normal=S(r["Normal looks like"]), ab=S(r["If abnormal"]), vis=[x.strip() for x in S(r["Visit types"]).split(";") if x.strip()], photo=S(r["Photo if abnormal"]) == "Yes", go=[x for x in S(r["Go to tasks"]).split("|") if x]) for r in CL]
look = {}
for r in LK: look.setdefault(S(r["System"]), []).append(dict(sec=S(r["Section"]), check=S(r["What to check"]), ab=S(r["If abnormal"]), go=[x for x in S(r["Go to tasks"]).split("|") if x]))
# ---- plantas
PL = rows(pw, "Plants"); PS = {S(r["Key"]): dict(short=S(r["Short"]), apa=S(r["Source"])) for r in rows(pw, "Sources")}
sp_ = lambda v: [x.strip() for x in S(v).split(";") if x.strip()]
plants = [dict(id=S(r["Plant ID"]), status=S(r["Status"]), group=S(r["Group"]), sci=S(r["Scientific name"]), com=S(r["Common name"]), type=S(r["Type"]), sys=sp_(r["Found in"]), ben=S(r["Benefits"]), form=S(r["Form"]), leaf=S(r["Leaf"]), stem=S(r["Stem"]), flower=S(r["Flower"]), clue=S(r["Clue"]), zones=sp_(r["Zones"]), useful=sp_(r["Useful for"]), look=S(r["Look-alike caution"]), src=sp_(r["Sources"]), note=S(r["Notes"])) for r in PL]
watch = [dict(com=S(r["Common name"]), sci=S(r["Scientific name"]), look=S(r["Look for"]), src=S(r["Source"])) for r in rows(pw, "Watchlist")]
icons = {}
nb = open("/home/claude/v3/pc/vts_plant_catalogue.py").read(); blk = nb[nb.index('G_, B_, Y_, W_ ='):nb.index("def icon(group, code):")]; ns = {}; exec(blk, ns)
icons = {k: v for k, v in ns["ICONS"].items()}; ICN = {S(r["Code"]): S(r["Meaning"]) for r in rows(pw, "Icons")}
ns2 = {}; exec(nb[nb.index("FLOWER_HEX ="):nb.index("def flower_icon")], ns2)
# ---- fuentes
sources = [dict(key=S(r["Citation key"]), apa=S(r["APA"]), short=S(r["Short cite"]), status=S(r["Status"]), url=S(r["URL"])) for r in REF]
names = {"SB": "Sediment Basin", "TW": "Treatment Wetland", "VD": "Vegetated Ditch", "WB": "Woodchip Bioreactor", "COR": "Corrective Maintenance"}
data = dict(tasks=tasks, topics=topics, checklist=items, siteParams=sp, lookAt=look, plants=plants, watch=watch, plantSources=PS, icons=icons, iconNames=ICN, flowerHex=ns2["FLOWER_HEX"], sources=sources, systems=names)
open("docs/data.js", "w", encoding="utf-8").write("window.VTS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";")
for f in ("COVER-PHOTO.jpg", "LOGO-CMSF.png", "LOGO-UCSC.png"): shutil.copy(f"{imgdir}/{f}", f"docs/img/{f}")
shutil.copy("geo.js", "docs/geo.js")
print("data.js", round(os.path.getsize("docs/data.js") / 1e6, 2), "MB;", len(tasks), "tareas;", len(topics), "temas;", len(items), "ítems;", len(plants), "plantas")
