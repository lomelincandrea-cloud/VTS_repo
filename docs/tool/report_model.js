/* Report rules in the browser. A line-by-line port of tools/report_templates/report_model.py:
   same inputs (records of data_schema.json, indicators.json, checklist items), same view model, same text.
   tools/report_templates/check_js_port.py renders every sample site with both and compares them (tool/crosscheck.html).
   Change a rule in both files, then run the check. Python-style number formatting is kept on purpose (see fixed, pyRound). */
window.VTSReport = (function () {
  "use strict";
  const FACTOR = 4.43, NO_DATA = "No data recorded";
  const EVIDENCE = {"test strip": "Field screening", "portable photometer": "Field measurement", "laboratory": "Laboratory", "visual": "Visual check"};
  const SYS_NAME = {SB: "Sediment basin", TW: "Treatment wetland", VD: "Vegetated ditch", WB: "Woodchip bioreactor"};
  const CONVERSION_NOTE = "Nitrate as NO3 and nitrate-nitrogen as NO3-N are the same measurement in two units. NO3 = NO3-N x 4.43. " +
    "Values are shown as mg/L as NO3-N, with the NO3 equivalent in brackets.";
  const STATUS = {met: "Meets target", not_met: "Below target", target_not_set: "Target not set", no_data: NO_DATA,
    not_due: "Not due yet", not_rated: "Field check only", not_applicable: "Does not apply"};
  const [BLUE, YELLOW, GREEN, RED, MUTED, LINE] = ["#03467E", "#F6B800", "#2F8F4E", "#B4361F", "#5B6E83", "#DBE5EF"];

  /* ---------- Python-compatible helpers ---------- */
  const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
  const get = (o, k, d = null) => has(o, k) ? o[k] : d;                       /* dict.get(k, d) */
  const truthy = x => !(x === null || x === undefined || x === false || x === 0 || x === "" || (Array.isArray(x) && !x.length) || (typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length));
  const or = (a, b) => truthy(a) ? a : b;
  function pyRound(x) { const f = Math.floor(x), r = x - f; return r === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x); }   /* round half to even */
  function fixed(x, d) {          /* f"{x:.{d}f}". toFixed rounds the exact binary value like Python, except an exact tie, which Python sends to the even digit */
    const [ip, fp] = Math.abs(x).toFixed(100).split(".");
    if (fp[d] === "5" && /^0*$/.test(fp.slice(d + 1))) {
      const last = d ? +fp[d - 1] : +ip[ip.length - 1];
      if (last % 2 === 0) return (x < 0 ? "-" : "") + ip + (d ? "." + fp.slice(0, d) : "");
    }
    return x.toFixed(d);
  }
  const pyFloat = x => Number.isInteger(x) ? x.toFixed(1) : String(x);       /* str(float) */
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const sortBy = (arr, key) => arr.map((v, i) => [key(v), i, v]).sort((x, y) => { for (let k = 0; k < x[0].length; k++) { const c = cmp(x[0][k], y[0][k]); if (c) return c; } return x[1] - y[1]; }).map(x => x[2]);
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const days = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);

  /* ---------- numbers and units ---------- */
  const decimals = s => { s = String(s); return s.includes(".") ? s.split(".")[1].length : 0; };
  function sig(x, n = 2) {
    if (x === 0) return "0";
    const d = Math.max(n - 1 - Math.floor(Math.log10(Math.abs(x))), 0);
    return d ? fixed(x, d) : String(pyRound(x));
  }
  const whole = x => String(pyRound(x));
  const isNo3n = unit => !!unit && unit.replace(/ /g, "").includes("NO3-N");

  function nitrateDisplay(m) {
    const unit = m.unit_as_entered || "", raw = m.value_as_entered, method = m.method, v = parseFloat(raw);
    if (method === "test strip") {
      const kit = m.instrument_or_kit || {}, blocks = (kit.blocks || []).slice().sort((a, b) => a - b);
      let lo, hi;
      const i = blocks.indexOf(v);
      if (i >= 0) { lo = i > 0 ? blocks[i - 1] : 0; hi = i + 1 < blocks.length ? blocks[i + 1] : null; } else { lo = v; hi = v; }
      const toN = isNo3n(unit) ? x => x : x => x / FACTOR, to3 = isNo3n(unit) ? x => x * FACTOR : x => x;
      const main = hi === null ? `${whole(toN(v))} or more mg/L NO3-N [${whole(to3(v))} or more mg/L NO3]`
        : `${whole(toN(lo))} to ${whole(toN(hi))} mg/L NO3-N [${whole(to3(lo))} to ${whole(to3(hi))} mg/L NO3]`;
      return {text: main, detail: `closest color block: ${raw} ${unit}`, n_low: toN(lo), n_high: hi === null ? null : toN(hi), n_value: toN(v)};
    }
    const d = decimals(raw), n = isNo3n(unit) ? v : v / FACTOR, n3 = isNo3n(unit) ? v * FACTOR : v;
    return {text: `${fixed(n, d)} mg/L NO3-N [${fixed(n3, d)} mg/L NO3]`, detail: `as entered: ${raw} ${unit}`, n_value: n, decimals: d};
  }
  function kitText(m) {
    const k = m.instrument_or_kit || {};
    if (m.method === "laboratory") return `${get(k, "laboratory", NO_DATA)}, report of ${get(k, "report_date", NO_DATA)}`;
    return truthy(k) ? `${get(k, "name", NO_DATA)} (${get(k, "range", "range not recorded")})` : NO_DATA;
  }
  const yesno = b => b === null || b === undefined ? NO_DATA : (b ? "yes" : "no");

  /* ---------- selection helpers ---------- */
  function Records(data, indicators, items, siteId) {
    const R = {d: data, items};
    R.ind = Object.fromEntries(indicators.map(i => [i.id, i]));
    R.site = data.sites.find(s => s.id === siteId);
    const p = data.meta.generated_for_period; R.start = p.start; R.end = p.end; R.year = parseInt(R.end.slice(0, 4), 10);
    R.visits_all = sortBy(data.visits.filter(v => v.site === siteId && get(v, "status", "closed") === "closed"), v => [v.date]);
    R.visits = R.visits_all.filter(v => R.start <= v.date && v.date <= R.end);
    R.vid = Object.fromEntries(R.visits_all.map(v => [v.id, v]));
    R.meas_all = data.measurements.filter(m => has(R.vid, m.visit));
    R.obs_all = data.observations.filter(o => has(R.vid, o.visit));
    R.cor_all = data.corrective_entries.filter(c => c.site === siteId);
    R.in_period = x => R.start <= x && x <= R.end;
    R.mdate = m => R.vid[m.visit].date;
    R.meas = ({ind = null, par = null, year = null, method = null} = {}) => sortBy(R.meas_all.filter(m => (ind === null || m.indicator === ind) && (par === null || m.parameter === par)
      && (method === null || m.method === method) && (year === null || R.mdate(m).slice(0, 4) === String(year))), m => [R.mdate(m), m.point || ""]);
    R.obs = pred => R.obs_all.filter(o => R.in_period(R.vid[o.visit].date) && pred(o));
    R.item_q = i => get(items[i] || {}, "question", i);
    R.item_sec = i => get(items[i] || {}, "section", "");
    return R;
  }

  function nitrateRows(R, ms) {
    return ms.map(m => {
      const nd = nitrateDisplay(m);
      return {date: R.mdate(m), point: m.point || NO_DATA, value: nd.text, detail: nd.detail, evidence: EVIDENCE[m.method], method: m.method, kit: kitText(m),
        flow: yesno(m.flow_present), time: m.sample_time || NO_DATA, role: m.recorded_by_role || NO_DATA, photo: get(m, "photo")};
    });
  }
  function comparisons(R, ms) {
    const out = [], groups = new Map();
    ms.forEach(m => { const key = m.visit + "\u0000" + m.method; if (!groups.has(key)) groups.set(key, {vid: m.visit, method: m.method, pts: {}}); groups.get(key).pts[String(get(m, "point"))] = m; });
    sortBy([...groups.values()], g => [R.vid[g.vid].date]).forEach(({vid, method, pts}) => {
      if (!has(pts, "inlet") || !has(pts, "outlet")) return;
      const a = nitrateDisplay(pts.inlet), b = nitrateDisplay(pts.outlet);
      let txt, diff;
      if (method === "test strip") {
        diff = a.n_value - b.n_value;
        txt = diff ? `about ${whole(Math.abs(diff))} mg/L NO3-N ${diff > 0 ? "lower" : "higher"} at the outlet (closest blocks)` : "same color block at the inlet and the outlet";
      } else {
        const d = Math.max(get(a, "decimals", 1), get(b, "decimals", 1)); diff = a.n_value - b.n_value;
        txt = `${fixed(Math.abs(diff), d)} mg/L NO3-N ${diff > 0 ? "lower" : "higher"} at the outlet [${fixed(Math.abs(diff) * FACTOR, d)} mg/L NO3]`;
      }
      out.push({date: R.vid[vid].date, method, evidence: EVIDENCE[method], text: txt + " (rough comparison)", diff_n: diff});
    });
    return out;
  }

  /* ---------- SVG charts (points with dates, no smoothed lines) ---------- */
  function niceMax(v) {
    if (v <= 0) return 1;
    const k = Math.pow(10, Math.floor(Math.log10(v / 4)));
    for (const m of [1, 2, 2.5, 5, 10]) if (4 * m * k >= v) return 4 * m * k;
    return 40 * k;
  }
  function axes(w, h, pad, ymax, label) {
    const g = [`<line x1="${pad}" y1="${h - pad}" x2="${w - 10}" y2="${h - pad}" stroke="${MUTED}"/>`, `<line x1="${pad}" y1="10" x2="${pad}" y2="${h - pad}" stroke="${MUTED}"/>`];
    for (let k = 0; k < 5; k++) {
      const v = ymax * k / 4, y = h - pad - (h - pad - 10) * k / 4;
      g.push(`<line x1="${pad}" y1="${fixed(y, 1)}" x2="${w - 10}" y2="${fixed(y, 1)}" stroke="${LINE}" stroke-width=".6"/><text x="${pad - 4}" y="${fixed(y + 3, 1)}" text-anchor="end" font-size="8" fill="${MUTED}">${sig(v, 2)}</text>`);
    }
    g.push(`<text x="12" y="${fixed((h - pad) / 2, 0)}" font-size="8" fill="${MUTED}" transform="rotate(-90 12 ${fixed((h - pad) / 2, 0)})" text-anchor="middle">${label}</text>`);
    return g;
  }
  function chartPoints(series, title, ylabel, hlines = [], w = 520, h = 200, pad = 44) {
    const xs = [...new Set(series.flatMap(s => s.points.map(p => p.x_label)))].sort();
    if (!xs.length) return null;
    const ys = [...series.flatMap(s => s.points.flatMap(p => [get(p, "y"), get(p, "y_high"), get(p, "y_low")]).filter(v => v !== null)), ...hlines.map(x => x[0])];
    const ymax = ys.length ? niceMax(Math.max(...ys) * 1.08) : 1;
    const X = i => pad + 20 + (w - pad - 40) * (i + 0.5) / xs.length, Y = v => h - pad - (h - pad - 10) * v / ymax;
    const g = axes(w, h, pad, ymax, ylabel);
    hlines.forEach(([v, lab, col]) => g.push(`<line x1="${pad}" y1="${fixed(Y(v), 1)}" x2="${w - 10}" y2="${fixed(Y(v), 1)}" stroke="${col}" stroke-dasharray="5 3" stroke-width="1.2"/><text x="${w - 12}" y="${fixed(Y(v) - 3, 1)}" font-size="8" text-anchor="end" fill="${col}">${lab}</text>`));
    xs.forEach((x, i) => g.push(`<text x="${fixed(X(i), 1)}" y="${h - pad + 12}" font-size="8" text-anchor="middle" fill="${MUTED}">${x}</text>`));
    const n = series.length, legend = [];
    series.forEach((s, si) => {
      const off = (si - (n - 1) / 2) * 12;
      s.points.forEach(p => {
        const cx = X(xs.indexOf(p.x_label)) + off;
        if (get(p, "y_low") !== null) {
          const top = get(p, "y_high") !== null ? p.y_high : ymax;
          g.push(`<line x1="${fixed(cx, 1)}" y1="${fixed(Y(p.y_low), 1)}" x2="${fixed(cx, 1)}" y2="${fixed(Y(top), 1)}" stroke="${s.color}" stroke-width="5" stroke-linecap="round" opacity=".75"/>`);
        }
        if (get(p, "y") !== null) {
          const cy = Y(p.y);
          if (s.shape === "circle") g.push(`<circle cx="${fixed(cx, 1)}" cy="${fixed(cy, 1)}" r="4" fill="${s.color}"/>`);
          else if (s.shape === "ring") g.push(`<circle cx="${fixed(cx, 1)}" cy="${fixed(cy, 1)}" r="4" fill="#fff" stroke="${s.color}" stroke-width="2"/>`);
          else if (s.shape === "square") g.push(`<rect x="${fixed(cx - 4, 1)}" y="${fixed(cy - 4, 1)}" width="8" height="8" fill="${s.color}"/>`);
          else g.push(`<path d="M${fixed(cx, 1)},${fixed(cy - 5, 1)} L${fixed(cx + 5, 1)},${fixed(cy, 1)} L${fixed(cx, 1)},${fixed(cy + 5, 1)} L${fixed(cx - 5, 1)},${fixed(cy, 1)}Z" fill="${s.color}"/>`);
        }
      });
      legend.push(s);
    });
    const leg = legend.map((s, k) => `<g transform="translate(${pad + 10 + (k % 2) * 210},${h - 14 + Math.floor(k / 2) * 13})"><rect width="10" height="10" fill="${s.color}"/><text x="14" y="9" font-size="8.5" fill="#1F2D3D">${s.label}</text></g>`).join("");
    return `<svg viewBox="0 0 ${w} ${h + 6 + 13 * Math.floor((legend.length - 1) / 2)}" width="100%" role="img" aria-label="${title}"><title>${title}</title>${g.join("")}${leg}</svg>`;
  }

  /* ---------- shared pieces ---------- */
  function header(R, report) {
    const s = R.site;
    return {report, site_name: s.name, type: SYS_NAME[s.type], type_code: s.type, period_start: R.start, period_end: R.end,
      generated: todayIso(), generated_by: R.d.organization.name, sample: get(R.d.meta, "sample", false),
      source_line: "Generated from the Visit Sheets, Site History and Corrective Maintenance Log of this site."};
  }
  function labBlock(R, year) {
    const labs = R.meas({ind: "IND-05", par: "nitrate", year, method: "laboratory"}), turb = R.meas({ind: "IND-05", par: "turbidity", year, method: "laboratory"});
    const status = R.d.laboratory_samples.find(l => l.site === R.site.id && l.year === year) || null;
    const tgt = get(R.site.params, "nitrate_removal_target"), comps = comparisons(R, labs);
    let verdict;
    if (!labs.length) verdict = "No laboratory result recorded this year";
    else if (!truthy(tgt)) verdict = "Target not set";
    else if (comps.length) verdict = comps[comps.length - 1].diff_n >= tgt.min_difference ? "Inside the target" : "Outside the target";
    else verdict = "No inlet and outlet pair from the same visit";
    return {rows: nitrateRows(R, labs), comparisons: comps, verdict, target: truthy(tgt) ? tgt.text : "Target not set",
      turbidity: turb.map(m => ({date: R.mdate(m), point: m.point, value: `${m.value_as_entered} ${m.unit_as_entered}`, kit: kitText(m)})),
      status: status ? status.status : (R.site.type === "SB" ? "not applicable" : NO_DATA)};
  }
  const correctiveRows = R => sortBy(R.cor_all, c => [c.date]).filter(c => R.in_period(c.date)).map(c => ({...c, in_period: R.in_period(c.date), hours_text: get(c, "hours") === null ? "" : c.hours}));
  function photoLog(R) {
    const pts = get(R.site.params, "photo_points") || {}, rows = [];
    R.visits.forEach(v => {
      if (v.type === "January review") return;
      rows.push({date: v.date, type: v.type, photos: (v.photos || []).map(p => p.id),
        all_points: ["Routine", "After storm", "Pre-storm"].includes(v.type) ? "required, " + yesno(get(v, "all_photo_points_taken")) : yesno(get(v, "all_photo_points_taken"))});
    });
    return {points: truthy(pts) ? `${get(pts, "count", NO_DATA)} (${get(pts, "where", NO_DATA)})` : NO_DATA, rows};
  }

  /* ---------- Report 1: Food Safety Record ---------- */
  function foodSafety(data, indicators, items, siteId, includeHistory = false) {
    const R = Records(data, indicators, items, siteId), s = R.site, p = s.params;
    const plan = data.annual_plans.find(a => a.site === siteId && a.year === R.year) || null;
    const planned = get(plan || {}, "planned_visits", []).filter(x => x.date <= R.end);
    const cor = correctiveRows(R);
    const vegMeas = {}; R.meas({ind: "IND-06", year: R.year}).forEach(m => { vegMeas[m.parameter] = m; });
    const burrowObs = R.obs(o => truthy(get(o, "burrows")));
    const wildlifeShared = get(s.sharing, "wildlife_in_food_safety_record", false);
    const farm = R.obs(o => R.item_sec(o.item) === "Boundaries & farm activity");
    const waterItems = R.obs(o => (R.item_q(o.item) || "").toLowerCase().includes("unusual color"));
    const trash = R.obs(o => (R.item_q(o.item) || "").toLowerCase().includes("trash"));
    const structSecs = ["Inlet, outlet & controls", "Embankments & erosion", "Berms & erosion", "Banks, sediment & erosion"];
    const pre = R.visits.filter(v => v.type === "Pre-storm"), preIds = new Set(pre.map(v => v.id));
    const findings = R.obs(o => o.answer === "abnormal" && structSecs.includes(R.item_sec(o.item)) && preIds.has(o.visit));
    const fIds = new Set(findings.map(f => f.id));
    const fixedBefore = cor.filter(c => fIds.has(get(c, "observation")) && c.status === "resolved" && truthy(get(c, "resolved_date")) && c.resolved_date < `${R.year}-10-01`);
    const jar = R.meas({ind: "IND-03", year: R.year}), nitr = R.meas({par: "nitrate", year: R.year});
    const measIds = new Set(R.meas_all.map(m => m.id)), corIds = new Set(R.cor_all.map(c => c.id));
    const revisions = data.revisions.filter(r => includeHistory && (has(R.vid, r.record_id) || measIds.has(r.record_id) || corIds.has(r.record_id)) && R.in_period(r.when.slice(0, 10)))
      .map(r => ({...r, when_text: r.when.slice(0, 16).replace("T", " ")}));
    return {
      ...header(R, "Food Safety Record"),
      project_owner: s.project_owner,
      summary: {planned: planned.length, done: R.visits.filter(v => v.date <= R.end).length,
        planned_done: planned.filter(x => R.visits.some(v => v.date === x.date)).length,
        open_corrective: cor.filter(c => c.status === "open" || c.status === "escalated").length},
      vegetation: {
        mowing: R.visits.filter(v => truthy(get(v, "mowing"))).map(v => ({date: v.date, areas: or(v.mowing.areas.join("; "), NO_DATA), at_target: yesno(get(v.mowing, "at_target_height")), photo: v.mowing.photo || "none"})),
        designated: get(p, "designated_mowing_areas") || NO_DATA, unmowed: get(p, "areas_left_unmowed") || NO_DATA, target_height: get(p, "target_vegetation_height") || NO_DATA,
        survey: {cover: has(vegMeas, "vegetation_cover") ? vegMeas.vegetation_cover.value_as_entered + " % (estimate)" : NO_DATA,
          invasive: has(vegMeas, "invasive_species_count") ? vegMeas.invasive_species_count.value_as_entered : NO_DATA,
          date: has(vegMeas, "vegetation_cover") ? R.mdate(vegMeas.vegetation_cover) : NO_DATA},
        invasive_removed: R.visits.flatMap(v => (v.invasive_removed || []).map(x => ({date: v.date, ...x})))},
      wildlife: {shared: wildlifeShared,
        observations: burrowObs.map(o => ({date: R.vid[o.visit].date, item: o.item, location: o.location_in_system || NO_DATA,
          range: o.burrows.count_range, in_use: o.burrows.in_use, trend: o.burrows.trend, photo: o.photo || "none"})),
        actions: cor.filter(c => get(c, "task") === "COR_T04")},
      farm: farm.map(o => ({date: R.vid[o.visit].date, item: o.item, question: R.item_q(o.item), answer: o.answer, note: o.note || "", photo: o.photo || ""})),
      structures: {findings: findings.length, fixed_before_oct1: fixedBefore.length, visit: pre.length ? pre[0].date : NO_DATA,
        rows: findings.map(f => ({item: f.item, question: R.item_q(f.item), location: f.location_in_system || NO_DATA, note: f.note || ""}))},
      water: {unusual: waterItems.map(o => ({date: R.vid[o.visit].date, answer: o.answer, note: o.note || "", photo: o.photo || ""})),
        jar: jar.map(m => ({date: R.mdate(m), answer: m.value_as_entered, photo: m.photo || "none"})),
        nitrate: nitrateRows(R, nitr), conversion_note: CONVERSION_NOTE},
      trash: {visits_with_trash_task: R.visits.filter(v => (v.tasks_done || []).some(t => t.endsWith("_T02"))).map(v => v.date),
        findings: trash.filter(o => o.answer === "abnormal").map(o => ({date: R.vid[o.visit].date, note: o.note || "", fixed_now: yesno(get(o, "fixed_now"))})),
        notes: R.visits.filter(v => truthy(get(v, "notes"))).map(v => ({date: v.date, note: v.notes}))},
      corrective: cor,
      photos: photoLog(R),
      signoff: R.visits.map(v => ({date: v.date, type: v.type, initials: get(v.sign_off || {}, "initials", NO_DATA), signed: get(v.sign_off || {}, "date", NO_DATA)})),
      history: revisions, include_history: includeHistory};
  }

  /* ---------- Report 2: Water Quality and Maintenance Summary ---------- */
  function waterSummary(data, indicators, items, siteId, years = 3) {
    const R = Records(data, indicators, items, siteId), s = R.site, p = s.params, Y = R.year;
    const yrs = Array.from({length: years}, (_, i) => Y - years + 1 + i);
    const plan = data.annual_plans.find(a => a.site === siteId && a.year === Y) || null;
    const planned = get(plan || {}, "planned_visits", []).filter(x => x.date <= R.end);
    const onSite = R.visits.filter(v => v.type !== "January review");
    const cor = correctiveRows(R), lab = labBlock(R, Y), rows = [];
    const add = (iid, target, result, when, method, trend, status) => rows.push({id: iid, goal: R.ind[iid].goal, indicator: R.ind[iid].indicator, target, result, date: when, method, trend, status, status_text: STATUS[status]});
    const met = ok => ok ? "met" : "not_met";
    const pct = ms => pyRound(100 * ms.filter(m => m.value_as_entered === "yes").length / ms.length);
    const joinOr = (arr, sep) => or(arr.join(sep), NO_DATA);

    const w = R.meas({ind: "IND-01", year: Y});
    add("IND-01", "Water at the inlet and no shortcuts at every visit", w.length ? `${pct(w)} % of ${w.length} visits` : NO_DATA,
      w.length ? R.mdate(w[w.length - 1]) : NO_DATA, "Visual check at each visit",
      joinOr(yrs.filter(y => R.meas({ind: "IND-01", year: y}).length).map(y => `${y}: ${pct(R.meas({ind: "IND-01", year: y}))} %`), " · "),
      w.length ? met(w.every(m => m.value_as_entered === "yes")) : "no_data");
    const sed = R.meas({ind: "IND-02", year: Y}), cl = get(p, "cleanout_level_sediment");
    add("IND-02", truthy(cl) ? `Below the cleanout level (${cl.value} ${cl.unit})` : "Target not set",
      joinOr(sed.map(m => `${m.point}: ${m.value_as_entered} ${m.unit_as_entered}`), "; "), sed.length ? R.mdate(sed[0]) : NO_DATA, "Marked rod at the reference points",
      joinOr(yrs.filter(y => R.meas({ind: "IND-02", year: y}).length).map(y => `${y}: max ${pyFloat(Math.max(...R.meas({ind: "IND-02", year: y}).map(m => parseFloat(m.value_as_entered))))} in`), " · "),
      !truthy(cl) ? "target_not_set" : !sed.length ? "no_data" : met(sed.every(m => parseFloat(m.value_as_entered) < cl.value)));
    const jar = R.meas({ind: "IND-03"}), jarY = jar.find(m => R.mdate(m).slice(0, 4) === String(Y));
    add("IND-03", "Outlet jar clearer (yes)", jarY ? jarY.value_as_entered : NO_DATA, jarY ? R.mdate(jarY) : NO_DATA, "Jars side by side, photographed",
      joinOr(jar.map(m => `${R.mdate(m).slice(0, 4)}: ${m.value_as_entered}`), " · "), jarY ? met(jarY.value_as_entered === "yes") : "no_data");
    const fs = R.meas({ind: "IND-04", par: "nitrate", year: Y}), fc = comparisons(R, fs);
    add("IND-04", "Lower at the outlet (field check only)", or(fc.map(c => `${c.evidence}: ${c.text}`).join("; "), s.type !== "SB" ? NO_DATA : "Not measured (a sediment basin is not built to remove nitrate)"),
      fs.length ? R.mdate(fs[0]) : NO_DATA, joinOr([...new Set(fs.map(m => EVIDENCE[m.method] + " (" + m.method + ")"))].sort(), "; "), "see field checks chart",
      s.type === "SB" ? "not_applicable" : fc.length ? "not_rated" : "no_data");
    add("IND-05", lab.target, !lab.comparisons.length ? lab.verdict : `${lab.comparisons[lab.comparisons.length - 1].text}. ${lab.verdict}`,
      lab.rows.length ? lab.rows[0].date : NO_DATA, "Laboratory",
      joinOr(yrs.flatMap(y => comparisons(R, R.meas({ind: "IND-05", par: "nitrate", year: y, method: "laboratory"})).map(c => `${y}: ${c.text.split(" (")[0]}`)), " · "),
      s.type === "SB" ? "not_applicable" : ({"Inside the target": "met", "Outside the target": "not_met", "Target not set": "target_not_set"}[lab.verdict] || "no_data"));
    const veg = {}; R.meas({ind: "IND-06", year: Y}).forEach(m => { veg[m.parameter] = m; }); const vt = get(p, "vegetation_cover_target"), hasVeg = Object.keys(veg).length > 0;
    add("IND-06", truthy(vt) ? `Cover at least ${vt.min_percent} %` : "Target not set",
      hasVeg ? `${veg.vegetation_cover.value_as_entered} % cover (estimate); ${veg.invasive_species_count.value_as_entered} invasive species` : NO_DATA,
      hasVeg ? R.mdate(veg.vegetation_cover) : NO_DATA, "Vegetation survey with the Field Guide",
      joinOr(yrs.flatMap(y => R.meas({ind: "IND-06", par: "vegetation_cover", year: y}).map(m => `${y}: ${m.value_as_entered} %`)), " · "),
      !truthy(vt) ? "target_not_set" : !has(veg, "vegetation_cover") ? "no_data" : met(parseFloat(veg.vegetation_cover.value_as_entered) >= vt.min_percent));
    const struct = foodSafety(data, indicators, items, siteId).structures;
    add("IND-07", "All findings repaired before October 1", struct.visit !== NO_DATA ? `${struct.findings} findings; ${struct.fixed_before_oct1} repaired before October 1` : NO_DATA,
      struct.visit, "Condition check", NO_DATA,
      struct.visit === NO_DATA ? "no_data" : struct.fixed_before_oct1 === struct.findings ? "met" : R.end < `${Y}-10-01` ? "not_due" : "not_met");
    const opened = cor.length, closed = cor.filter(c => c.status === "resolved").length;
    const prevItems = new Set(R.obs_all.filter(o => R.vid[o.visit].date.slice(0, 4) === String(Y - 1) && o.answer === "abnormal").map(o => o.item));
    const back = [...new Set(R.obs(o => o.answer === "abnormal").filter(o => prevItems.has(o.item)).map(o => o.item))].sort();
    add("IND-08", "Target not set", `${opened} opened, ${closed} closed; came back from ${Y - 1}: ${back.join(", ") || "none"}`, R.end, "Corrective Maintenance Log", NO_DATA, "target_not_set");
    const done = planned.filter(x => R.visits.some(v => v.date === x.date)).length;
    add("IND-09", "All planned visits done", planned.length ? `${pyRound(100 * done / planned.length)} % (${done} of ${planned.length})` : NO_DATA, R.end, "Annual Plan against the Site History", NO_DATA,
      planned.length ? met(done === planned.length) : "no_data");
    const req = onSite.filter(v => ["Routine", "After storm", "Pre-storm"].includes(v.type));
    add("IND-10", "Photos from all photo points at every Routine, After storm and Pre-storm visit",
      req.length ? `${req.filter(v => truthy(get(v, "all_photo_points_taken"))).length} of ${req.length} visits` : NO_DATA, req.length ? req[req.length - 1].date : NO_DATA, "Photo points", NO_DATA,
      req.length ? met(req.every(v => truthy(get(v, "all_photo_points_taken")))) : "no_data");

    /* charts: laboratory and field checks are separate charts; every method its own series; points only */
    const inYrs = m => yrs.includes(parseInt(R.mdate(m).slice(0, 4), 10));
    const labSeries = [];
    [["inlet", "circle", BLUE], ["outlet", "ring", BLUE]].forEach(([pt, shape, col]) => {
      const pts = R.meas({ind: "IND-05", par: "nitrate", method: "laboratory"}).filter(m => m.point === pt && inYrs(m)).map(m => ({x_label: R.mdate(m), y: nitrateDisplay(m).n_value}));
      if (pts.length) labSeries.push({label: `Laboratory, ${pt}`, color: pt === "inlet" ? col : "#6FA8DC", shape, points: pts});
    });
    const fieldSeries = [];
    [["test strip", "inlet", YELLOW, "bar"], ["test strip", "outlet", "#C99700", "bar"], ["portable photometer", "inlet", GREEN, "diamond"], ["portable photometer", "outlet", "#7CC49A", "diamond"]].forEach(([meth, pt, col, shape]) => {
      const pts = R.meas({par: "nitrate", method: meth}).filter(m => m.point === pt && inYrs(m)).map(m => { const nd = nitrateDisplay(m); return meth === "test strip" ? {x_label: R.mdate(m), y_low: nd.n_low, y_high: nd.n_high} : {x_label: R.mdate(m), y: nd.n_value}; });
      if (pts.length) fieldSeries.push({label: `${meth.charAt(0).toUpperCase() + meth.slice(1)}, ${pt}`, color: col, shape, points: pts});
    });
    const sedSeries = [];
    [["circle", BLUE], ["square", GREEN], ["diamond", "#C99700"], ["ring", RED]].forEach(([shape, col], k) => {
      const pt = `RP${k + 1}`, pts = R.meas({ind: "IND-02"}).filter(m => m.point === pt && inYrs(m)).map(m => ({x_label: R.mdate(m), y: parseFloat(m.value_as_entered)}));
      if (pts.length) sedSeries.push({label: `Reference point ${pt.slice(2)}`, color: col, shape, points: pts});
    });
    const hl = truthy(cl) ? [[cl.value, "Cleanout level", RED]] : [];
    if (truthy(get(p, "warning_level_sediment"))) hl.push([p.warning_level_sediment.value, "Warning level", "#E39B0B"]);

    const byType = {}; let hours = 0, hoursMissing = 0;
    R.visits.forEach(v => { byType[v.type] = (byType[v.type] || 0) + 1; if (get(v, "hours_crew_total") !== null) hours += v.hours_crew_total; else hoursMissing += 1; });
    hours += cor.reduce((a, c) => a + (get(c, "hours") || 0), 0);
    const rain = new Map();
    R.visits.forEach(v => { const r = get(v, "last_rain"); if (truthy(r) && get(r, "amount_in", 0) >= 0.5 && !rain.has(r.date)) rain.set(r.date, {date: r.date, amount: r.amount_in, checks: []}); });
    R.visits.forEach(v => {
      if (v.type === "After storm" && truthy(get(v, "last_rain")) && rain.has(v.last_rain.date)) {
        const dd = days(v.date, v.last_rain.date);
        rain.get(v.last_rain.date).checks.push({date: v.date, within_48h: dd <= 2 ? "yes" : `no (${dd} days)`});
      }
    });
    const shareOwner = get(s.sharing, "show_owner_in_water_summary", false);
    return {
      ...header(R, "Water Quality and Maintenance Summary"),
      context: {year_built: s.year_built || NO_DATA, drainage_area: truthy(get(s, "drainage_area")) ? `${s.drainage_area.value} ${s.drainage_area.unit}` : NO_DATA,
        huc12: truthy(get(s, "huc12")) ? `${s.huc12.name} (${s.huc12.code})` : NO_DATA, owner: shareOwner ? s.project_owner : null},
      plain: {visits: R.visits.length, planned: planned.length, done, lab: lab.verdict, open: cor.filter(c => c.status === "open" || c.status === "escalated").length,
        jar: rows[2].result, nitrate_applies: s.type !== "SB"},
      indicators: rows, lab, field: {rows: nitrateRows(R, fs), comparisons: fc},
      charts: {lab: chartPoints(labSeries, "Laboratory nitrate by spring visit", "mg/L NO3-N"),
        field: chartPoints(fieldSeries, "Field checks of nitrate by spring visit", "mg/L NO3-N"),
        sediment: chartPoints(sedSeries, "Sediment depth by reference point", "inches", hl)},
      maintenance: {by_type: Object.entries(byType).sort((a, b) => cmp(a[0], b[0])), hours: parseFloat(fixed(hours, 1)), hours_missing: hoursMissing, corrective: cor.length,
        cost: "No data recorded (labor rates and material prices are not recorded)"},
      events: {rain: [...rain.values()], repairs: cor.filter(c => c.status === "resolved")},
      conversion_note: CONVERSION_NOTE, evidence_legend: ["test strip", "portable photometer", "laboratory"].map(k => [EVIDENCE[k], k]),
      load_block: null};
  }

  /* checklist items as report_model.load reads them from the Checklist_Items sheet */
  const itemsFrom = checklist => Object.fromEntries((checklist || []).map(c => [c.id, {question: c.q, section: c.sec}]));
  return {foodSafety, waterSummary, itemsFrom, STATUS, NO_DATA, SYS_NAME, nitrateDisplay, _py: {pyRound, fixed, pyFloat, sig}};
})();
