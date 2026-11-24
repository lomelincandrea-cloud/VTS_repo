"""Turns VTS records (data_schema.json) into the view model the two report templates print.

All rules live here, so the templates only print. The Tool (Part 4) must apply the same rules.
Rules (COWORK 2026-11-19, Part 3):
- Every nitrate value carries its method, kit or instrument and range, date, flow, and role.
- Evidence levels: test strip = Field screening; portable photometer = Field measurement; laboratory = Laboratory.
- Display unit: mg/L as NO3-N, NO3 equivalent in brackets. NO3 = NO3-N x 4.43. Values as entered are never changed.
- A strip result is the closest color block. It is shown as the span between the neighbouring blocks, with no decimals.
- Inlet minus outlet only between the SAME method at the SAME visit, labelled a rough comparison. Never a % removal.
- No laboratory result for the year -> "No laboratory result recorded this year". Strips never stand in for it.
- Anything not recorded prints "No data recorded".
- Only closed visits count. A visit still being filled in (draft) is not a record yet.
- Indicator status comes only from the target written for it (see STATUS); no target -> "Target not set".
The Tool runs the same rules in the browser (docs/tool/report_model.js); check_js_port.py compares both.
"""
import json, math
from collections import defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
FACTOR = 4.43
NO_DATA = "No data recorded"
EVIDENCE = {"test strip": "Field screening", "portable photometer": "Field measurement", "laboratory": "Laboratory", "visual": "Visual check"}
SYS_NAME = {"SB": "Sediment basin", "TW": "Treatment wetland", "VD": "Vegetated ditch", "WB": "Woodchip bioreactor"}
CONVERSION_NOTE = ("Nitrate as NO3 and nitrate-nitrogen as NO3-N are the same measurement in two units. NO3 = NO3-N x 4.43. "
                   "Values are shown as mg/L as NO3-N, with the NO3 equivalent in brackets.")
STATUS = {"met": "Meets target", "not_met": "Below target", "target_not_set": "Target not set", "no_data": NO_DATA,
          "not_due": "Not due yet", "not_rated": "Field check only", "not_applicable": "Does not apply"}
BLUE, YELLOW, GREEN, RED, MUTED, LINE = "#03467E", "#F6B800", "#2F8F4E", "#B4361F", "#5B6E83", "#DBE5EF"


# ---------------------------------------------------------------- loading
def load(data_path, xlsx_path=None):
    data = json.loads(Path(data_path).read_text(encoding="utf-8"))
    indicators = json.loads((HERE / "indicators.json").read_text(encoding="utf-8"))
    items = {}
    if xlsx_path and Path(xlsx_path).exists():
        import openpyxl
        ws = openpyxl.load_workbook(xlsx_path, read_only=True)["Checklist_Items"]
        rows = list(ws.iter_rows(values_only=True)); h = rows[0]
        for r in rows[1:]:
            d = dict(zip(h, r))
            if d["Item ID"]: items[d["Item ID"]] = {"question": d["Question"], "section": d["Section"]}
    return data, indicators, items


# ---------------------------------------------------------------- numbers and units
def decimals(s):
    s = str(s); return len(s.split(".")[1]) if "." in s else 0


def sig(x, n=2):
    if x == 0: return "0"
    d = max(n - 1 - int(math.floor(math.log10(abs(x)))), 0)
    v = round(x, d); return f"{v:.{d}f}" if d else f"{int(round(v))}"


def whole(x):
    """Strip values: whole numbers only. A color block cannot give more precision."""
    return str(int(round(x)))


def is_no3n(unit): return unit and "NO3-N" in unit.replace(" ", "")


def nitrate_display(m):
    """Returns the text for one nitrate value, following the unit and precision rules."""
    unit, raw, method = m.get("unit_as_entered") or "", m["value_as_entered"], m["method"]
    v = float(raw)
    if method == "test strip":
        kit = m.get("instrument_or_kit") or {}; blocks = sorted(kit.get("blocks") or [])
        if v in blocks:
            i = blocks.index(v); lo = blocks[i - 1] if i > 0 else 0; hi = blocks[i + 1] if i + 1 < len(blocks) else None
        else:
            lo, hi = v, v
        to_n = (lambda x: x) if is_no3n(unit) else (lambda x: x / FACTOR)
        to_3 = (lambda x: x * FACTOR) if is_no3n(unit) else (lambda x: x)
        if hi is None:
            main = f"{whole(to_n(v))} or more mg/L NO3-N [{whole(to_3(v))} or more mg/L NO3]"
        else:
            main = f"{whole(to_n(lo))} to {whole(to_n(hi))} mg/L NO3-N [{whole(to_3(lo))} to {whole(to_3(hi))} mg/L NO3]"
        return {"text": main, "detail": f"closest color block: {raw} {unit}", "n_low": to_n(lo), "n_high": None if hi is None else to_n(hi), "n_value": to_n(v)}
    d = decimals(raw)
    n = v if is_no3n(unit) else v / FACTOR
    n3 = v * FACTOR if is_no3n(unit) else v
    return {"text": f"{n:.{d}f} mg/L NO3-N [{n3:.{d}f} mg/L NO3]", "detail": f"as entered: {raw} {unit}", "n_value": n, "decimals": d}


def kit_text(m):
    k = m.get("instrument_or_kit") or {}
    if m["method"] == "laboratory":
        return f"{k.get('laboratory', NO_DATA)}, report of {k.get('report_date', NO_DATA)}"
    return f"{k.get('name', NO_DATA)} ({k.get('range', 'range not recorded')})" if k else NO_DATA


def yesno(b): return NO_DATA if b is None else ("yes" if b else "no")


# ---------------------------------------------------------------- selection helpers
class Records:
    def __init__(self, data, indicators, items, site_id):
        self.d, self.items = data, items
        self.ind = {i["id"]: i for i in indicators}
        self.site = next(s for s in data["sites"] if s["id"] == site_id)
        p = data["meta"]["generated_for_period"]; self.start, self.end = p["start"], p["end"]; self.year = int(self.end[:4])
        self.visits_all = sorted([v for v in data["visits"] if v["site"] == site_id and v.get("status", "closed") == "closed"], key=lambda v: v["date"])
        self.visits = [v for v in self.visits_all if self.start <= v["date"] <= self.end]
        self.vid = {v["id"]: v for v in self.visits_all}
        self.meas_all = [m for m in data["measurements"] if m["visit"] in self.vid]
        self.obs_all = [o for o in data["observations"] if o["visit"] in self.vid]
        self.cor_all = [c for c in data["corrective_entries"] if c["site"] == site_id]
        self.in_period = lambda x: self.start <= x <= self.end

    def mdate(self, m): return self.vid[m["visit"]]["date"]
    def meas(self, ind=None, par=None, year=None, method=None):
        out = [m for m in self.meas_all if (ind is None or m["indicator"] == ind) and (par is None or m["parameter"] == par)
               and (method is None or m["method"] == method) and (year is None or self.mdate(m)[:4] == str(year))]
        return sorted(out, key=lambda m: (self.mdate(m), m.get("point") or ""))
    def obs(self, pred): return [o for o in self.obs_all if self.in_period(self.vid[o["visit"]]["date"]) and pred(o)]
    def item_q(self, i): return (self.items.get(i) or {}).get("question", i)
    def item_sec(self, i): return (self.items.get(i) or {}).get("section", "")


def nitrate_rows(R, ms):
    """One table row per nitrate value: value, evidence level, method, kit, date, flow, role."""
    rows = []
    for m in ms:
        nd = nitrate_display(m)
        rows.append({"date": R.mdate(m), "point": m.get("point") or NO_DATA, "value": nd["text"], "detail": nd["detail"],
                     "evidence": EVIDENCE[m["method"]], "method": m["method"], "kit": kit_text(m), "flow": yesno(m.get("flow_present")),
                     "time": m.get("sample_time") or NO_DATA, "role": m.get("recorded_by_role") or NO_DATA, "photo": m.get("photo")})
    return rows


def comparisons(R, ms):
    """Inlet minus outlet, only between the same method at the same visit."""
    out = []
    groups = defaultdict(dict)
    for m in ms: groups[(m["visit"], m["method"])][m.get("point")] = m
    for (vid, method), pts in sorted(groups.items(), key=lambda k: R.vid[k[0][0]]["date"]):
        if "inlet" not in pts or "outlet" not in pts: continue
        a, b = nitrate_display(pts["inlet"]), nitrate_display(pts["outlet"])
        if method == "test strip":
            diff = a["n_value"] - b["n_value"]
            txt = f"about {whole(abs(diff))} mg/L NO3-N {'lower' if diff > 0 else 'higher'} at the outlet (closest blocks)" if diff else "same color block at the inlet and the outlet"
        else:
            d = max(a.get("decimals", 1), b.get("decimals", 1)); diff = a["n_value"] - b["n_value"]
            txt = f"{abs(diff):.{d}f} mg/L NO3-N {'lower' if diff > 0 else 'higher'} at the outlet [{abs(diff) * FACTOR:.{d}f} mg/L NO3]"
        out.append({"date": R.vid[vid]["date"], "method": method, "evidence": EVIDENCE[method], "text": txt + " (rough comparison)", "diff_n": diff})
    return out


# ---------------------------------------------------------------- SVG charts (points with dates, no smoothed lines)
def nice_max(v):
    """Round the axis top up to 1, 2, 2.5 or 5 x 10^k so the 4 tick steps are round numbers."""
    if v <= 0: return 1
    k = 10 ** math.floor(math.log10(v / 4))
    for m in (1, 2, 2.5, 5, 10):
        if 4 * m * k >= v: return 4 * m * k
    return 40 * k


def _axes(w, h, pad, ymax, label):
    g = [f'<line x1="{pad}" y1="{h-pad}" x2="{w-10}" y2="{h-pad}" stroke="{MUTED}"/>', f'<line x1="{pad}" y1="10" x2="{pad}" y2="{h-pad}" stroke="{MUTED}"/>']
    for k in range(5):
        v = ymax * k / 4; y = h - pad - (h - pad - 10) * k / 4
        g.append(f'<line x1="{pad}" y1="{y:.1f}" x2="{w-10}" y2="{y:.1f}" stroke="{LINE}" stroke-width=".6"/><text x="{pad-4}" y="{y+3:.1f}" text-anchor="end" font-size="8" fill="{MUTED}">{sig(v, 2)}</text>')
    g.append(f'<text x="12" y="{(h-pad)/2:.0f}" font-size="8" fill="{MUTED}" transform="rotate(-90 12 {(h-pad)/2:.0f})" text-anchor="middle">{label}</text>')
    return g


def chart_points(series, title, ylabel, hlines=(), w=520, h=200, pad=44):
    """series: [{label, color, shape, points:[{x_label, y, y_low, y_high, note}]}]. Each series is drawn with its own markers; never joined."""
    xs = sorted({p["x_label"] for s in series for p in s["points"]})
    if not xs: return None
    ys = [v for s in series for p in s["points"] for v in (p.get("y"), p.get("y_high"), p.get("y_low")) if v is not None] + [v for v, _, _ in hlines]
    ymax = nice_max(max(ys) * 1.08) if ys else 1
    X = lambda i: pad + 20 + (w - pad - 40) * (i + 0.5) / len(xs)
    Y = lambda v: h - pad - (h - pad - 10) * v / ymax
    g = _axes(w, h, pad, ymax, ylabel)
    for v, lab, col in hlines:
        g.append(f'<line x1="{pad}" y1="{Y(v):.1f}" x2="{w-10}" y2="{Y(v):.1f}" stroke="{col}" stroke-dasharray="5 3" stroke-width="1.2"/><text x="{w-12}" y="{Y(v)-3:.1f}" font-size="8" text-anchor="end" fill="{col}">{lab}</text>')
    for i, x in enumerate(xs): g.append(f'<text x="{X(i):.1f}" y="{h-pad+12}" font-size="8" text-anchor="middle" fill="{MUTED}">{x}</text>')
    n = len(series); legend = []
    for si, s in enumerate(series):
        off = (si - (n - 1) / 2) * 12
        for p in s["points"]:
            cx = X(xs.index(p["x_label"])) + off
            if p.get("y_low") is not None:
                top = p.get("y_high") if p.get("y_high") is not None else ymax
                g.append(f'<line x1="{cx:.1f}" y1="{Y(p["y_low"]):.1f}" x2="{cx:.1f}" y2="{Y(top):.1f}" stroke="{s["color"]}" stroke-width="5" stroke-linecap="round" opacity=".75"/>')
            if p.get("y") is not None:
                cy = Y(p["y"])
                if s["shape"] == "circle": g.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4" fill="{s["color"]}"/>')
                elif s["shape"] == "ring": g.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4" fill="#fff" stroke="{s["color"]}" stroke-width="2"/>')
                elif s["shape"] == "square": g.append(f'<rect x="{cx-4:.1f}" y="{cy-4:.1f}" width="8" height="8" fill="{s["color"]}"/>')
                else: g.append(f'<path d="M{cx:.1f},{cy-5:.1f} L{cx+5:.1f},{cy:.1f} L{cx:.1f},{cy+5:.1f} L{cx-5:.1f},{cy:.1f}Z" fill="{s["color"]}"/>')
        legend.append(s)
    leg = "".join(f'<g transform="translate({pad + 10 + (k % 2) * 210},{h - 14 + (k // 2) * 13})"><rect width="10" height="10" fill="{s["color"]}"/><text x="14" y="9" font-size="8.5" fill="#1F2D3D">{s["label"]}</text></g>' for k, s in enumerate(legend))
    return f'<svg viewBox="0 0 {w} {h + 6 + 13 * ((len(legend) - 1) // 2)}" width="100%" role="img" aria-label="{title}"><title>{title}</title>{"".join(g)}{leg}</svg>'


# ---------------------------------------------------------------- shared pieces
def header(R, report):
    s = R.site
    return {"report": report, "site_name": s["name"], "type": SYS_NAME[s["type"]], "type_code": s["type"], "period_start": R.start, "period_end": R.end,
            "generated": date.today().isoformat(), "generated_by": R.d["organization"]["name"], "sample": R.d["meta"].get("sample", False),
            "source_line": "Generated from the Visit Sheets, Site History and Corrective Maintenance Log of this site."}


def lab_block(R, year):
    labs = R.meas(ind="IND-05", par="nitrate", year=year, method="laboratory")
    turb = R.meas(ind="IND-05", par="turbidity", year=year, method="laboratory")
    status = next((l for l in R.d["laboratory_samples"] if l["site"] == R.site["id"] and l["year"] == year), None)
    tgt = R.site["params"].get("nitrate_removal_target")
    comps = comparisons(R, labs)
    if not labs:
        verdict = "No laboratory result recorded this year"
    elif not tgt:
        verdict = "Target not set"
    elif comps:
        verdict = "Inside the target" if comps[-1]["diff_n"] >= tgt["min_difference"] else "Outside the target"
    else:
        verdict = "No inlet and outlet pair from the same visit"
    return {"rows": nitrate_rows(R, labs), "comparisons": comps, "verdict": verdict, "target": tgt["text"] if tgt else "Target not set",
            "turbidity": [{"date": R.mdate(m), "point": m["point"], "value": f'{m["value_as_entered"]} {m["unit_as_entered"]}', "kit": kit_text(m)} for m in turb],
            "status": status["status"] if status else ("not applicable" if R.site["type"] == "SB" else NO_DATA)}


def corrective_rows(R):
    return [{**c, "in_period": R.in_period(c["date"]), "hours_text": "" if c.get("hours") is None else c["hours"]} for c in sorted(R.cor_all, key=lambda c: c["date"]) if R.in_period(c["date"])]


def photo_log(R):
    pts = (R.site["params"].get("photo_points") or {})
    rows = []
    for v in R.visits:
        if v["type"] in ("January review",): continue
        rows.append({"date": v["date"], "type": v["type"], "photos": [p["id"] for p in v.get("photos", [])],
                     "all_points": "required, " + yesno(v.get("all_photo_points_taken")) if v["type"] in ("Routine", "After storm", "Pre-storm") else yesno(v.get("all_photo_points_taken"))})
    return {"points": f'{pts.get("count", NO_DATA)} ({pts.get("where", NO_DATA)})' if pts else NO_DATA, "rows": rows}


# ---------------------------------------------------------------- Report 1: Food Safety Record
def food_safety(data, indicators, items, site_id, include_history=False):
    R = Records(data, indicators, items, site_id); s = R.site; p = s["params"]
    plan = next((a for a in data["annual_plans"] if a["site"] == site_id and a["year"] == R.year), None)
    planned = [x for x in (plan or {}).get("planned_visits", []) if x["date"] <= R.end]
    done_types = [v for v in R.visits]
    cor = corrective_rows(R)
    veg_meas = {m["parameter"]: m for m in R.meas(ind="IND-06", year=R.year)}
    burrow_obs = R.obs(lambda o: o.get("burrows"))
    wildlife_shared = s["sharing"].get("wildlife_in_food_safety_record", False)
    farm = R.obs(lambda o: R.item_sec(o["item"]) == "Boundaries & farm activity")
    water_items = R.obs(lambda o: "unusual color" in (R.item_q(o["item"]) or "").lower())
    trash = R.obs(lambda o: "trash" in (R.item_q(o["item"]) or "").lower())
    struct_secs = ("Inlet, outlet & controls", "Embankments & erosion", "Berms & erosion", "Banks, sediment & erosion")
    pre = [v for v in R.visits if v["type"] == "Pre-storm"]
    findings = R.obs(lambda o: o["answer"] == "abnormal" and R.item_sec(o["item"]) in struct_secs and o["visit"] in {v["id"] for v in pre})
    fixed_before = [c for c in cor if c.get("observation") in {f["id"] for f in findings} and c["status"] == "resolved" and c.get("resolved_date") and c["resolved_date"] < f"{R.year}-10-01"]
    jar = R.meas(ind="IND-03", year=R.year)
    nitr = R.meas(par="nitrate", year=R.year)
    revisions = [{**r, "when_text": r["when"][:16].replace("T", " ")} for r in data["revisions"] if include_history and (r["record_id"] in R.vid or r["record_id"] in {m["id"] for m in R.meas_all}
                 or r["record_id"] in {c["id"] for c in R.cor_all}) and R.in_period(r["when"][:10])]
    return {
        **header(R, "Food Safety Record"),
        "project_owner": s["project_owner"],
        "summary": {"planned": len(planned), "done": len([v for v in R.visits if v["date"] <= R.end]),
                    "planned_done": sum(1 for x in planned if any(v["date"] == x["date"] for v in R.visits)),
                    "open_corrective": sum(1 for c in cor if c["status"] in ("open", "escalated"))},
        "vegetation": {
            "mowing": [{"date": v["date"], "areas": "; ".join(v["mowing"]["areas"]) or NO_DATA, "at_target": yesno(v["mowing"].get("at_target_height")), "photo": v["mowing"].get("photo") or "none"}
                       for v in R.visits if v.get("mowing")],
            "designated": p.get("designated_mowing_areas") or NO_DATA, "unmowed": p.get("areas_left_unmowed") or NO_DATA, "target_height": p.get("target_vegetation_height") or NO_DATA,
            "survey": {"cover": (veg_meas["vegetation_cover"]["value_as_entered"] + " % (estimate)") if "vegetation_cover" in veg_meas else NO_DATA,
                       "invasive": veg_meas["invasive_species_count"]["value_as_entered"] if "invasive_species_count" in veg_meas else NO_DATA,
                       "date": R.mdate(veg_meas["vegetation_cover"]) if "vegetation_cover" in veg_meas else NO_DATA},
            "invasive_removed": [{"date": v["date"], **x} for v in R.visits for x in v.get("invasive_removed", [])]},
        "wildlife": {"shared": wildlife_shared,
                     "observations": [{"date": R.vid[o["visit"]]["date"], "item": o["item"], "location": o.get("location_in_system") or NO_DATA,
                                       "range": o["burrows"]["count_range"], "in_use": o["burrows"]["in_use"], "trend": o["burrows"]["trend"], "photo": o.get("photo") or "none"} for o in burrow_obs],
                     "actions": [c for c in cor if c.get("task") == "COR_T04"]},
        "farm": [{"date": R.vid[o["visit"]]["date"], "item": o["item"], "question": R.item_q(o["item"]), "answer": o["answer"], "note": o.get("note") or "", "photo": o.get("photo") or ""} for o in farm],
        "structures": {"findings": len(findings), "fixed_before_oct1": len(fixed_before), "visit": pre[0]["date"] if pre else NO_DATA,
                       "rows": [{"item": f["item"], "question": R.item_q(f["item"]), "location": f.get("location_in_system") or NO_DATA, "note": f.get("note") or ""} for f in findings]},
        "water": {"unusual": [{"date": R.vid[o["visit"]]["date"], "answer": o["answer"], "note": o.get("note") or "", "photo": o.get("photo") or ""} for o in water_items],
                  "jar": [{"date": R.mdate(m), "answer": m["value_as_entered"], "photo": m.get("photo") or "none"} for m in jar],
                  "nitrate": nitrate_rows(R, nitr), "conversion_note": CONVERSION_NOTE},
        "trash": {"visits_with_trash_task": [v["date"] for v in R.visits if any(t.endswith("_T02") for t in v.get("tasks_done", []))],
                  "findings": [{"date": R.vid[o["visit"]]["date"], "note": o.get("note") or "", "fixed_now": yesno(o.get("fixed_now"))} for o in trash if o["answer"] == "abnormal"],
                  "notes": [{"date": v["date"], "note": v["notes"]} for v in R.visits if v.get("notes")]},
        "corrective": cor,
        "photos": photo_log(R),
        "signoff": [{"date": v["date"], "type": v["type"], "initials": (v.get("sign_off") or {}).get("initials", NO_DATA), "signed": (v.get("sign_off") or {}).get("date", NO_DATA)} for v in R.visits],
        "history": revisions, "include_history": include_history,
    }


# ---------------------------------------------------------------- Report 2: Water Quality and Maintenance Summary
def water_summary(data, indicators, items, site_id, years=3):
    R = Records(data, indicators, items, site_id); s = R.site; p = s["params"]; Y = R.year
    yrs = list(range(Y - years + 1, Y + 1))
    plan = next((a for a in data["annual_plans"] if a["site"] == site_id and a["year"] == Y), None)
    planned = [x for x in (plan or {}).get("planned_visits", []) if x["date"] <= R.end]
    on_site = [v for v in R.visits if v["type"] != "January review"]
    cor = corrective_rows(R)
    lab = lab_block(R, Y)
    rows = []

    def add(iid, target, result, when, method, trend, status):
        rows.append({"id": iid, "goal": R.ind[iid]["goal"], "indicator": R.ind[iid]["indicator"], "target": target, "result": result, "date": when, "method": method, "trend": trend,
                     "status": status, "status_text": STATUS[status]})
    met = lambda ok: "met" if ok else "not_met"

    w = R.meas(ind="IND-01", year=Y)
    add("IND-01", "Water at the inlet and no shortcuts at every visit", f'{round(100 * sum(m["value_as_entered"] == "yes" for m in w) / len(w))} % of {len(w)} visits' if w else NO_DATA,
        R.mdate(w[-1]) if w else NO_DATA, "Visual check at each visit",
        " · ".join(f'{y}: {round(100 * sum(m["value_as_entered"] == "yes" for m in R.meas(ind="IND-01", year=y)) / len(R.meas(ind="IND-01", year=y)))} %' for y in yrs if R.meas(ind="IND-01", year=y)) or NO_DATA,
        met(all(m["value_as_entered"] == "yes" for m in w)) if w else "no_data")
    sed = R.meas(ind="IND-02", year=Y); cl = p.get("cleanout_level_sediment")
    add("IND-02", f'Below the cleanout level ({cl["value"]} {cl["unit"]})' if cl else "Target not set",
        "; ".join(f'{m["point"]}: {m["value_as_entered"]} {m["unit_as_entered"]}' for m in sed) or NO_DATA, R.mdate(sed[0]) if sed else NO_DATA, "Marked rod at the reference points",
        " · ".join(f'{y}: max {max(float(m["value_as_entered"]) for m in R.meas(ind="IND-02", year=y))} in' for y in yrs if R.meas(ind="IND-02", year=y)) or NO_DATA,
        "target_not_set" if not cl else "no_data" if not sed else met(all(float(m["value_as_entered"]) < cl["value"] for m in sed)))
    jar = R.meas(ind="IND-03")
    add("IND-03", "Outlet jar clearer (yes)", next((m["value_as_entered"] for m in jar if R.mdate(m)[:4] == str(Y)), NO_DATA),
        next((R.mdate(m) for m in jar if R.mdate(m)[:4] == str(Y)), NO_DATA), "Jars side by side, photographed", " · ".join(f'{R.mdate(m)[:4]}: {m["value_as_entered"]}' for m in jar) or NO_DATA,
        next((met(m["value_as_entered"] == "yes") for m in jar if R.mdate(m)[:4] == str(Y)), "no_data"))
    fs = R.meas(ind="IND-04", par="nitrate", year=Y); fc = comparisons(R, fs)
    add("IND-04", "Lower at the outlet (field check only)", "; ".join(f'{c["evidence"]}: {c["text"]}' for c in fc) or (NO_DATA if s["type"] != "SB" else "Not measured (a sediment basin is not built to remove nitrate)"),
        R.mdate(fs[0]) if fs else NO_DATA, "; ".join(sorted({EVIDENCE[m["method"]] + " (" + m["method"] + ")" for m in fs})) or NO_DATA, "see field checks chart",
        "not_applicable" if s["type"] == "SB" else "not_rated" if fc else "no_data")
    add("IND-05", lab["target"], lab["verdict"] if not lab["comparisons"] else f'{lab["comparisons"][-1]["text"]}. {lab["verdict"]}',
        lab["rows"][0]["date"] if lab["rows"] else NO_DATA, "Laboratory", " · ".join(f'{y}: {c["text"].split(" (")[0]}' for y in yrs for c in comparisons(R, R.meas(ind="IND-05", par="nitrate", year=y, method="laboratory"))) or NO_DATA,
        "not_applicable" if s["type"] == "SB" else {"Inside the target": "met", "Outside the target": "not_met", "Target not set": "target_not_set"}.get(lab["verdict"], "no_data"))
    veg = {m["parameter"]: m for m in R.meas(ind="IND-06", year=Y)}; vt = p.get("vegetation_cover_target")
    add("IND-06", f'Cover at least {vt["min_percent"]} %' if vt else "Target not set",
        (f'{veg["vegetation_cover"]["value_as_entered"]} % cover (estimate); {veg["invasive_species_count"]["value_as_entered"]} invasive species' if veg else NO_DATA),
        R.mdate(veg["vegetation_cover"]) if veg else NO_DATA, "Vegetation survey with the Field Guide",
        " · ".join(f'{y}: {m["value_as_entered"]} %' for y in yrs for m in R.meas(ind="IND-06", par="vegetation_cover", year=y)) or NO_DATA,
        "target_not_set" if not vt else "no_data" if "vegetation_cover" not in veg else met(float(veg["vegetation_cover"]["value_as_entered"]) >= vt["min_percent"]))
    struct = food_safety(data, indicators, items, site_id)["structures"]
    add("IND-07", "All findings repaired before October 1", f'{struct["findings"]} findings; {struct["fixed_before_oct1"]} repaired before October 1' if struct["visit"] != NO_DATA else NO_DATA,
        struct["visit"], "Condition check", NO_DATA,
        "no_data" if struct["visit"] == NO_DATA else "met" if struct["fixed_before_oct1"] == struct["findings"] else "not_due" if R.end < f"{Y}-10-01" else "not_met")
    opened = len(cor); closed = sum(1 for c in cor if c["status"] == "resolved")
    prev_items = {o["item"] for o in R.obs_all if R.vid[o["visit"]]["date"][:4] == str(Y - 1) and o["answer"] == "abnormal"}
    back = sorted({o["item"] for o in R.obs(lambda o: o["answer"] == "abnormal") if o["item"] in prev_items})
    add("IND-08", "Target not set", f'{opened} opened, {closed} closed; came back from {Y-1}: {", ".join(back) or "none"}', R.end, "Corrective Maintenance Log", NO_DATA, "target_not_set")
    done = sum(1 for x in planned if any(v["date"] == x["date"] for v in R.visits))
    add("IND-09", "All planned visits done", f'{round(100 * done / len(planned))} % ({done} of {len(planned)})' if planned else NO_DATA, R.end, "Annual Plan against the Site History", NO_DATA,
        met(done == len(planned)) if planned else "no_data")
    req = [v for v in on_site if v["type"] in ("Routine", "After storm", "Pre-storm")]
    add("IND-10", "Photos from all photo points at every Routine, After storm and Pre-storm visit",
        f'{sum(1 for v in req if v.get("all_photo_points_taken"))} of {len(req)} visits' if req else NO_DATA, req[-1]["date"] if req else NO_DATA, "Photo points", NO_DATA,
        met(all(v.get("all_photo_points_taken") for v in req)) if req else "no_data")

    # charts: laboratory and field checks are separate charts; every method its own series; points only
    lab_series = []
    for pt, shape, col in (("inlet", "circle", BLUE), ("outlet", "ring", BLUE)):
        pts = [{"x_label": R.mdate(m), "y": nitrate_display(m)["n_value"]} for m in R.meas(ind="IND-05", par="nitrate", method="laboratory") if m["point"] == pt and int(R.mdate(m)[:4]) in yrs]
        if pts: lab_series.append({"label": f"Laboratory, {pt}", "color": col if pt == "inlet" else "#6FA8DC", "shape": shape, "points": pts})
    field_series = []
    for meth, pt, col, shape in (("test strip", "inlet", YELLOW, "bar"), ("test strip", "outlet", "#C99700", "bar"), ("portable photometer", "inlet", GREEN, "diamond"), ("portable photometer", "outlet", "#7CC49A", "diamond")):
        pts = []
        for m in R.meas(par="nitrate", method=meth):
            if m["point"] != pt or int(R.mdate(m)[:4]) not in yrs: continue
            nd = nitrate_display(m)
            pts.append({"x_label": R.mdate(m), "y_low": nd["n_low"], "y_high": nd["n_high"]} if meth == "test strip" else {"x_label": R.mdate(m), "y": nd["n_value"]})
        if pts: field_series.append({"label": f"{meth.capitalize()}, {pt}", "color": col, "shape": shape, "points": pts})
    sed_series = []
    for k, (shape, col) in enumerate((("circle", BLUE), ("square", GREEN), ("diamond", "#C99700"), ("ring", RED))):
        pt = f"RP{k+1}"; pts = [{"x_label": R.mdate(m), "y": float(m["value_as_entered"])} for m in R.meas(ind="IND-02") if m["point"] == pt and int(R.mdate(m)[:4]) in yrs]
        if pts: sed_series.append({"label": f"Reference point {pt[2:]}", "color": col, "shape": shape, "points": pts})
    hl = [(cl["value"], "Cleanout level", RED)] if cl else []
    if p.get("warning_level_sediment"): hl.append((p["warning_level_sediment"]["value"], "Warning level", "#E39B0B"))

    by_type = defaultdict(int); hours = 0.0; hours_missing = 0
    for v in R.visits:
        by_type[v["type"]] += 1
        if v.get("hours_crew_total") is not None: hours += v["hours_crew_total"]
        else: hours_missing += 1
    hours += sum(c.get("hours") or 0 for c in cor)
    rain = {}
    for v in R.visits:
        r = v.get("last_rain")
        if r and r.get("amount_in", 0) >= 0.5: rain.setdefault(r["date"], {"date": r["date"], "amount": r["amount_in"], "checks": []})
    for v in R.visits:
        if v["type"] == "After storm" and v.get("last_rain") and v["last_rain"]["date"] in rain:
            dd = (date.fromisoformat(v["date"]) - date.fromisoformat(v["last_rain"]["date"])).days
            rain[v["last_rain"]["date"]]["checks"].append({"date": v["date"], "within_48h": "yes" if dd <= 2 else f"no ({dd} days)"})
    share_owner = s["sharing"].get("show_owner_in_water_summary", False)
    return {
        **header(R, "Water Quality and Maintenance Summary"),
        "context": {"year_built": s.get("year_built") or NO_DATA, "drainage_area": f'{s["drainage_area"]["value"]} {s["drainage_area"]["unit"]}' if s.get("drainage_area") else NO_DATA,
                    "huc12": f'{s["huc12"]["name"]} ({s["huc12"]["code"]})' if s.get("huc12") else NO_DATA, "owner": s["project_owner"] if share_owner else None},
        "plain": {"visits": len(R.visits), "planned": len(planned), "done": done, "lab": lab["verdict"], "open": sum(1 for c in cor if c["status"] in ("open", "escalated")),
                  "jar": rows[2]["result"], "nitrate_applies": s["type"] != "SB"},
        "indicators": rows, "lab": lab, "field": {"rows": nitrate_rows(R, fs), "comparisons": fc},
        "charts": {"lab": chart_points(lab_series, "Laboratory nitrate by spring visit", "mg/L NO3-N"),
                   "field": chart_points(field_series, "Field checks of nitrate by spring visit", "mg/L NO3-N"),
                   "sediment": chart_points(sed_series, "Sediment depth by reference point", "inches", hl)},
        "maintenance": {"by_type": sorted(by_type.items()), "hours": round(hours, 1), "hours_missing": hours_missing, "corrective": len(cor),
                        "cost": "No data recorded (labor rates and material prices are not recorded)"},
        "events": {"rain": list(rain.values()), "repairs": [c for c in cor if c["status"] == "resolved"]},
        "conversion_note": CONVERSION_NOTE, "evidence_legend": [(EVIDENCE[k], k) for k in ("test strip", "portable photometer", "laboratory")],
        "load_block": None,  # appears only when laboratory results and flow for the same time exist (none recorded yet)
    }
