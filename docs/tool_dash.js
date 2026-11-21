/* Dashboard and reports (Tool step 4d). Route: #tool/dashboard.
   Every number and status comes from window.VTSReport (tool/report_model.js), the browser copy of the report rules,
   checked against tools/report_templates/report_model.py. The page itself decides nothing.
   Reports: the same templates as the PDF reports (tool/templates, rendered with Nunjucks), opened to print or save as PDF. */
window.ToolDash = (function () {
  "use strict";
  const St = window.VTSStore, K = () => window.ToolKit, RM = () => window.VTSReport;
  const esc = s => K().esc(s), q = (s, r) => K().q(s, r), qa = (s, r) => K().qa(s, r);
  const NUNJUCKS = "https://cdnjs.cloudflare.com/ajax/libs/nunjucks/3.2.4/nunjucks.min.js";
  const SHORT = {"IND-01": "Water flow", "IND-02": "Sediment", "IND-03": "Jar test", "IND-04": "Nitrate, field", "IND-05": "Nitrate, laboratory",
    "IND-06": "Plant cover", "IND-07": "Repairs before Oct 1", "IND-08": "Problems fixed", "IND-09": "Visits as planned", "IND-10": "Photo points"};
  const MARK = {met: ["✓", "g"], not_met: ["✕", "r"], not_due: ["…", "y"], target_not_set: ["○", ""], no_data: ["–", "n"], not_rated: ["◇", "b"], not_applicable: ["n/a", "n"]};
  const filt = {site: "", type: "", year: null};
  let indicators = null, env = null, dmap = null, sel = null;

  const thisYear = () => +K().today().slice(0, 4);
  function period(year) { const end = `${year}-12-31`, t = K().today(); return {start: `${year}-01-01`, end: end < t ? end : t}; }
  function dataFor(year) { const d = JSON.parse(JSON.stringify(St.data)); d.meta.generated_for_period = period(year); return d; }
  const items = () => RM().itemsFrom((window.VTS_LEARN || {}).checklist);
  async function loadIndicators() { if (!indicators) indicators = await fetch("tool/indicators.json", {cache: "no-cache"}).then(r => r.json()); return indicators; }
  function chip(st) { const [m, c] = MARK[st] || ["", ""]; return `<span class="d-st d-${c || "o"}" title="${esc(RM().STATUS[st])}"><b aria-hidden="true">${m}</b> ${esc(RM().STATUS[st])}</span>`; }

  /* ---------- page ---------- */
  async function render(siteArg) {
    if (siteArg !== undefined) filt.site = siteArg === "all" ? "" : siteArg;
    if (!window.VTSReport) { K().view().innerHTML = `<div class="panel">The report rules could not load.</div>`; return; }
    await loadIndicators();
    const years = [...new Set(St.data.visits.map(v => +v.date.slice(0, 4)).concat(thisYear()))].sort((a, b) => b - a);
    if (!filt.year) filt.year = thisYear();
    const all = St.sites(), start = period(filt.year).start;
    /* a VTS decommissioned before the year shown has nothing to report; it stays in the VTS list */
    const sites = all.filter(s => (filt.site ? s.id === filt.site : !(s.status === "decommissioned" && s.decommissioned && s.decommissioned.date < start)) && (!filt.type || s.type === filt.type));
    const d = dataFor(filt.year), it = items();
    const models = sites.map(s => ({s, w: RM().waterSummary(d, indicators, it, s.id)}));
    const p = period(filt.year), one = filt.site && models.length === 1 ? models[0] : null;
    K().view().innerHTML = `
      <div class="l-row"><h2 style="margin:0">Dashboard and reports</h2></div>
      <p class="t-intro">This is the monitoring of your systems. Each indicator compares what the crews recorded with the target set for that system. Start with the map, open a system for its details, and print a report when someone asks for one.</p>
      <div class="d-filters panel">
        <label class="l-lab">VTS <select id="dSite"><option value="">All my VTS (${all.length})</option>${all.map(s => `<option value="${s.id}"${s.id === filt.site ? " selected" : ""}>${esc(s.name)}${s.status === "decommissioned" ? " (decommissioned)" : ""}</option>`).join("")}</select></label>
        <label class="l-lab">System type <select id="dType"${filt.site ? " disabled" : ""}><option value="">All types</option>${Object.entries(K().NAME).map(([k, n]) => `<option value="${k}"${k === filt.type ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="l-lab">Year <select id="dYear">${years.map(y => `<option${y === filt.year ? " selected" : ""}>${y}</option>`).join("")}</select></label>
        <span class="l-src">Period: ${esc(p.start)} to ${esc(p.end)}. Sample data.</span>
      </div>
      ${!models.length ? `<div class="panel">No VTS of this type.</div>` : band(models) + charts(models) + (one ? single(one) : rollup(models))}
      ${reports(models, one)}
      ${history(sites)}`;
    K().bar();
    wire(models);
    if (models.length) drawMap(models);
  }

  /* ---------- top band: map of the VTS with floating KPI tiles and a detail card ---------- */
  const worst = w => w.indicators.some(i => i.status === "not_met") ? ["!", "late", "Something is below its target"] : w.indicators.some(i => i.status === "met") ? ["✓", "done", "All targets with data are met"] : ["○", "plan", "Not enough data"];
  function kpis(models) {
    const sum = k => models.reduce((a, m) => a + m.w.plain[k], 0), below = models.reduce((a, m) => a + m.w.indicators.filter(i => i.status === "not_met").length, 0);
    return `<div class="d-kpis">
      <div class="d-kpi"><b>${models.length}</b><span>VTS shown</span></div>
      <div class="d-kpi"><b>${sum("done")} of ${sum("planned")}</b><span>planned visits done so far</span></div>
      <div class="d-kpi"><b>${sum("open")}</b><span>repairs open or with the supervisor</span><a href="#tool/log${filt.site ? "/" + filt.site : ""}">Maintenance log →</a></div>
      <div class="d-kpi"><b>${below}</b><span>indicator results below target (✕ in the table)</span></div></div>`;
  }
  function band(models) {
    if (!sel || !models.some(m => m.s.id === sel)) sel = (models[0] || {}).s && models[0].s.id;
    return `<section class="d-band" aria-labelledby="dBandT"><h3 id="dBandT" class="vh">Your systems at a glance</h3>
      <div class="d-mapwrap"><div id="dMap" class="d-map" aria-label="Map of your VTS (sample sites)"></div>${kpis(models)}
        <div class="d-detail" id="dDetail" aria-live="polite">${detail(models.find(m => m.s.id === sel))}</div></div>
      <p class="l-src">Sample sites in made-up places. Pin colour: system type; symbol: ✓ all targets with data met, ! something below its target, ○ not enough data. Select a pin or a VTS in the list.</p>
      <div class="d-pick" role="group" aria-label="Choose a VTS">${models.map(({s, w}) => { const [sy] = worst(w); return `<button type="button" data-dsel="${s.id}" aria-pressed="${s.id === sel}"><span class="sdot" style="background:${K().COLOR[s.type]}"></span>${esc(s.name)} <span aria-hidden="true">${sy}</span></button>`; }).join("")}</div></section>`;
  }
  function detail(m) {
    if (!m) return "";
    const {s, w} = m, lv = K().lastVisit(s.id), nv = K().nextPlanned(s.id), [sy, , txt] = worst(w);
    return `<div class="l-row"><span class="sdot" style="background:${K().COLOR[s.type]}"></span><b>${esc(s.name)}</b></div><p class="l-src">${esc(K().NAME[s.type])} · ${sy} ${esc(txt)}</p>
      <ul class="d-syms">${w.indicators.map(i => { const [mk, c] = MARK[i.status]; return `<li><span class="d-dot d-${c || "o"}" aria-hidden="true">${mk}</span><span>${esc(SHORT[i.id])}<span class="vh">: ${esc(i.status_text)}</span></span></li>`; }).join("")}</ul>
      <table class="t-kv"><tr><th>Last visit</th><td>${lv ? esc(lv.date + " · " + lv.type) : "None yet"}</td></tr><tr><th>Next visit</th><td>${nv ? esc(nv.date + " · " + nv.type) : "Not planned"}</td></tr></table>
      <a class="btn" href="#tool/vts/${s.id}/history">Open Site History</a>`;
  }
  function drawMap(models) {
    if (dmap) { dmap.remove(); dmap = null; }
    const box = q("#dMap"); if (!box) return;
    if (!(window.L && window.L.map)) { box.innerHTML = `<p class="muted" style="padding:1rem">The map could not load. The list below still works.</p>`; return; }
    dmap = window.L.map(box, {scrollWheelZoom: false, zoomControl: false}); window.L.control.zoom({position: "bottomleft"}).addTo(dmap);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap contributors"}).addTo(dmap);
    const pts = [];
    models.filter(m => m.s.location).forEach(({s, w}) => {
      const ll = [s.location.lat, s.location.lon], [sy] = worst(w); pts.push(ll);
      window.L.marker(ll, {title: s.name, icon: window.L.divIcon({className: "d-pin", iconSize: [40, 40], iconAnchor: [20, 20], html: `<span style="background:${K().COLOR[s.type]}"${s.id === sel ? ' class="on"' : ""}>${sy}</span>`})})
        .addTo(dmap).on("click", () => pick(s.id, models));
    });
    const wide = innerWidth >= 1024;
    if (pts.length) dmap.fitBounds(pts, wide ? {paddingTopLeft: [40, 150], paddingBottomRight: [380, 40], maxZoom: 12} : {padding: [30, 30], maxZoom: 12}); else dmap.setView([36.7, -121.6], 9);
    setTimeout(() => dmap && dmap.invalidateSize(), 60);
  }
  function pick(id, models) {
    sel = id;
    q("#dDetail").innerHTML = detail(models.find(m => m.s.id === id));
    qa("[data-dsel]").forEach(b => b.setAttribute("aria-pressed", b.dataset.dsel === id));
    qa(".d-pin span").forEach(x => x.classList.remove("on"));
    const c = q("#dCharts"); if (c) c.outerHTML = charts(models);
  }

  /* ---------- indicators as small charts (plain SVG), built only from the recorded results; no data, no chart ---------- */
  const num = t => { const m = String(t || "").match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
  const yearsOf = t => [...String(t || "").matchAll(/(\d{4}): (?:max )?(-?\d+(?:\.\d+)?)/g)].map(m => [m[1], +m[2]]);
  const W = "var(--water)", G = "#D3DDD3", INK = "#12261A";
  function ring(pct, sub, label) {
    const r = 40, C = 2 * Math.PI * r, f = Math.max(0, Math.min(100, pct)) / 100;
    return `<svg viewBox="0 0 120 120" class="d-svg d-ring" role="img" aria-label="${esc(label)}"><circle cx="60" cy="60" r="${r}" fill="none" stroke="${G}" stroke-width="12"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${W}" stroke-width="12" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)" stroke-linecap="butt"/>
      <line x1="60" y1="8" x2="60" y2="26" stroke="${INK}" stroke-width="2"/><text x="60" y="64" text-anchor="middle" font-size="22" font-weight="700" fill="${INK}">${Math.round(pct)}%</text>
      <text x="60" y="82" text-anchor="middle" font-size="10" fill="#44574B">${esc(sub)}</text></svg>`;
  }
  function gauges(rps, warn, clean, unit) {
    const max = Math.max(clean || 0, ...rps.map(r => r[1])) * 1.2 || 1, H = 120, y = v => 10 + H - v / max * H, bw = 34, gap = 30, w0 = 70;
    const width = w0 + rps.length * (bw + gap) + 40;
    return `<svg viewBox="0 0 ${width} 150" class="d-svg" role="img" aria-label="Sediment depth by reference point: ${rps.map(r => `${r[0]} ${r[1]} ${unit}`).join(", ")}${warn ? `; warning level ${warn} ${unit}` : ""}${clean ? `; cleanout level ${clean} ${unit}` : ""}">
      ${rps.map((r, i) => { const x = w0 + i * (bw + gap); return `<rect x="${x}" y="10" width="${bw}" height="${H}" fill="#F1F5EA" stroke="${G}"/><rect x="${x}" y="${y(r[1]).toFixed(1)}" width="${bw}" height="${(10 + H - y(r[1])).toFixed(1)}" fill="#8B5E3C"/>
        <text x="${x + bw / 2}" y="${(y(r[1]) - 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${r[1]}</text><text x="${x + bw / 2}" y="146" text-anchor="middle" font-size="11" fill="${INK}">${esc(r[0])}</text>`; }).join("")}
      ${warn ? `<line x1="${w0 - 6}" x2="${width - 30}" y1="${y(warn).toFixed(1)}" y2="${y(warn).toFixed(1)}" stroke="#7A5A00" stroke-width="2" stroke-dasharray="5 3"/><text x="2" y="${(y(warn) + 4).toFixed(1)}" font-size="10" fill="#7A5A00">warning ${warn}</text>` : ""}
      ${clean ? `<line x1="${w0 - 6}" x2="${width - 30}" y1="${y(clean).toFixed(1)}" y2="${y(clean).toFixed(1)}" stroke="#B4361F" stroke-width="2"/><text x="2" y="${(y(clean) + 4).toFixed(1)}" font-size="10" fill="#B4361F">cleanout ${clean}</text>` : ""}</svg>`;
  }
  function inout(a, b, unit, note) {
    const max = Math.max(a, b) * 1.15 || 1, L = 200, x0 = 60, bar = (v, yy, lab, col) => `<text x="0" y="${yy + 15}" font-size="12" fill="${INK}">${lab}</text><rect x="${x0}" y="${yy}" width="${(v / max * L).toFixed(1)}" height="22" fill="${col}"/><text x="${x0 + v / max * L + 6}" y="${yy + 15}" font-size="12" font-weight="700" fill="${INK}">${v}</text>`;
    return `<svg viewBox="0 0 320 80" class="d-svg" role="img" aria-label="Nitrate ${unit}: inlet ${a}, outlet ${b}, ${(a - b).toFixed(1)} lower at the outlet${note ? " (" + note + ")" : ""}">
      ${bar(a, 6, "Inlet", "#8B5E3C")}${bar(b, 40, "Outlet", "#3FA3B8")}</svg>`;
  }
  function cover(pct, target, inv) {
    const L = 240, x = v => 10 + v / 100 * L;
    return `<svg viewBox="0 0 280 70" class="d-svg" role="img" aria-label="Plant cover ${pct} %${target ? `, target at least ${target} %` : ""}; ${inv} invasive species">
      <rect x="10" y="20" width="${L}" height="22" fill="#F1F5EA" stroke="${G}"/><rect x="10" y="20" width="${(pct / 100 * L).toFixed(1)}" height="22" fill="#2F7D4A"/>
      <text x="${Math.min(x(pct) - 4, 245)}" y="36" text-anchor="end" font-size="12" font-weight="700" fill="#fff">${pct} %</text>
      ${target ? `<line x1="${x(target)}" x2="${x(target)}" y1="12" y2="50" stroke="${INK}" stroke-width="2.5"/><text x="${x(target)}" y="64" text-anchor="middle" font-size="11" fill="${INK}">target ${target} %</text>` : ""}
      <text x="10" y="12" font-size="11" fill="#44574B">${inv} invasive species found</text></svg>`;
  }
  function pair(a, b, la, lb) {
    const max = Math.max(a, b, 1), H = 62, bar = (v, x, lab) => `<rect x="${x}" y="${18 + H - v / max * H}" width="40" height="${v / max * H}" fill="${W}"/><text x="${x + 20}" y="${14 + H - v / max * H}" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}">${v}</text><text x="${x + 20}" y="${H + 26}" text-anchor="middle" font-size="11" fill="${INK}">${lab}</text>`;
    return `<svg viewBox="0 0 200 104" class="d-svg" role="img" aria-label="${a} ${la}, ${b} ${lb}">${bar(a, 30, la)}${bar(b, 120, lb)}<line x1="20" x2="180" y1="80" y2="80" stroke="${G}"/></svg>`;
  }
  function jars(ans) {
    const jar = (x, col, lab) => `<path d="M${x} 24 h30 v6 q6 4 6 12 v34 q0 6 -6 6 h-30 q-6 0 -6 -6 v-34 q0 -8 6 -12z" fill="${col}" stroke="${INK}" stroke-width="2"/><text x="${x + 15}" y="100" text-anchor="middle" font-size="11" fill="${INK}">${lab}</text>`;
    const yes = /^yes/i.test(ans);
    return `<svg viewBox="0 0 160 108" class="d-svg" role="img" aria-label="Jar test: outlet clearer than inlet: ${esc(ans)}">${jar(24, "#A9825A", "Inlet")}${jar(96, yes ? "#CFEAF2" : "#B99470", "Outlet")}</svg>`;
  }
  function spark(pts, unit) {
    if (pts.length < 2) return "";
    const vs = pts.map(p => p[1]), mn = Math.min(...vs), mx = Math.max(...vs), X = i => 14 + i * (172 / (pts.length - 1)), Y = v => 42 - (mx === mn ? 12 : (v - mn) / (mx - mn) * 24);
    return `<svg viewBox="0 0 200 62" class="d-spark" role="img" aria-label="Last values: ${pts.map(p => `${p[0]} ${p[1]}${unit}`).join(", ")}"><polyline points="${pts.map((p, i) => `${X(i)},${Y(p[1])}`).join(" ")}" fill="none" stroke="${W}" stroke-width="2"/>
      ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p[1])}" r="3" fill="${W}"/><text x="${X(i)}" y="${Y(p[1]) - 6}" text-anchor="middle" font-size="9" fill="${INK}">${p[1]}</text><text x="${X(i)}" y="60" text-anchor="middle" font-size="9" fill="#44574B">${p[0]}</text>`).join("")}</svg>`;
  }
  function chartOf(i, s, w) {
    const r = i.result || "", nd = /^No data|^Not measured|^No laboratory/i.test(r);
    if (["no_data", "not_applicable"].includes(i.status) && nd) return "";
    switch (i.id) {
      case "IND-01": case "IND-09": { const v = num(r); return v === null ? "" : ring(v, i.id === "IND-01" ? "of visits" : "planned done", `${SHORT[i.id]}: ${r}. Target: ${i.target}`); }
      case "IND-10": { const m = r.match(/(\d+) of (\d+)/); return m ? ring(+m[1] / +m[2] * 100, `${m[1]} of ${m[2]} visits`, `${SHORT[i.id]}: ${r}`) : ""; }
      case "IND-02": { const rps = [...r.matchAll(/(RP\d+): (\d+(?:\.\d+)?) (\w+)/g)].map(m => [m[1], +m[2], m[3]]); const p = s.params || {};
        return rps.length ? gauges(rps, p.warning_level_sediment && p.warning_level_sediment.value, p.cleanout_level_sediment && p.cleanout_level_sediment.value, rps[0][2]) : ""; }
      case "IND-05": { const rows = (w.lab && w.lab.rows) || [], a = rows.filter(x => x.point === "inlet").pop(), b = rows.filter(x => x.point === "outlet").pop();
        return a && b ? inout(num(a.value), num(b.value), "mg/L NO3-N", "laboratory") : ""; }
      case "IND-04": { const rows = (w.field && w.field.rows) || [], blk = x => num((String(x.detail).match(/block: ([\d.]+)/) || [])[1] ?? x.value), a = rows.filter(x => x.point === "inlet").pop(), b = rows.filter(x => x.point === "outlet").pop();
        return a && b ? inout(blk(a), blk(b), "mg/L NO3-N", "field check only, closest colour blocks") : ""; }
      case "IND-06": { const v = num(r), inv = num((r.match(/(\d+) invasive/) || [])[1]) || 0, t = num(i.target); return v === null ? "" : cover(v, t, inv); }
      case "IND-07": { const m = r.match(/(\d+) findings?; (\d+) repaired/); return m ? pair(+m[1], +m[2], "found", "fixed by Oct 1") : ""; }
      case "IND-08": { const m = r.match(/(\d+) opened, (\d+) closed/); return m ? pair(+m[1], +m[2], "opened", "closed") : ""; }
      case "IND-03": return /^(yes|no)/i.test(r) ? jars(r) : "";
    }
    return "";
  }
  function charts(models) {
    const m = models.find(x => x.s.id === sel) || models[0]; if (!m) return "";
    const {s, w} = m;
    return `<section class="stack" id="dCharts" aria-labelledby="dChartsT"><h3 id="dChartsT" style="margin:0">Indicators of ${esc(s.name)}</h3>
      <p class="l-src">Each chart is drawn only from what the crews recorded (sample data), with its target as a line or mark. Where there is no value or no target, the card says so instead of drawing.</p>
      <div class="d-ccards">${w.indicators.map(i => { const c = chartOf(i, s, w), tr = yearsOf(i.trend);
        return `<article class="d-ccard d-c-${i.status}"><header><span class="d-id">${esc(i.id)}</span><h4>${esc(SHORT[i.id])}</h4>${chip(i.status)}</header>
          ${c || `<p class="d-nochart">${esc(i.result || RM().NO_DATA)}</p>`}
          ${c ? `<p class="d-res2">${esc(i.result)}</p>` : ""}<p class="l-src">Target: ${esc(i.target)}</p>
          ${i.id === "IND-04" && c ? `<p class="l-src"><b>Field check only.</b> Test strips give a range, not a value.</p>` : ""}${spark(tr, i.id === "IND-02" ? " in" : "")}</article>`; }).join("")}</div></section>`;
  }
  const legend = () => `<p class="d-legend">${Object.keys(MARK).map(k => chip(k)).join(" ")}</p>`;

  function rollup(models) {
    return `<div class="panel stack"><h3 style="margin:0">All indicators at a glance</h3>
        <p class="t-intro">One row per system, one column per indicator. A ✓ means it meets its target; tap a row to see why.</p>
        <div class="scroll"><table class="d-mx"><thead><tr><th>VTS</th>${models[0].w.indicators.map(i => `<th title="${esc(i.indicator)}"><span>${esc(i.id)}</span>${esc(SHORT[i.id])}</th>`).join("")}</tr></thead>
        <tbody>${models.map(({s, w}) => `<tr><th><a href="#tool/dashboard/${s.id}"><span class="sdot" style="background:${s.status === "decommissioned" ? "#9AA7B5" : K().COLOR[s.type]}"></span>${esc(s.name)}</a></th>
          ${w.indicators.map(i => { const [m, c] = MARK[i.status]; return `<td><span class="d-dot d-${c || "o"}" title="${esc(i.id + ": " + i.status_text + ". " + i.result)}">${m}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
        ${legend()}</div>`;
  }

  function single({s, w}) {
    const c = w.charts;
    return `<div class="panel stack"><div class="l-row"><span class="sdot" style="background:${K().COLOR[s.type]}"></span><h3 style="margin:0">${esc(s.name)}</h3><span class="l-src">${esc(K().NAME[s.type])}</span><span class="l-sp"></span>
        <a href="#tool/vts/${s.id}">Card</a><a href="#tool/vts/${s.id}/history/${filt.year}">Site History</a><a href="#tool/plan/${s.id}/${filt.year}">Yearly plan</a></div>
        <p>${w.plain.visits} visits recorded; ${w.plain.done} of the ${w.plain.planned} planned visits done so far. Outlet jar clearer at the spring visit: ${esc(w.plain.jar)}.
        ${w.plain.nitrate_applies ? `Laboratory check of nitrate: ${esc(w.plain.lab)}.` : "A sediment basin is not built to remove nitrate; nitrate is not measured."} ${w.plain.open} repair(s) open or with the supervisor.</p>
        ${legend()}</div>
      <div class="panel stack"><h3 style="margin:0">Report charts</h3><p class="l-src">The charts of the Water Summary. Each point is one measurement on its date. Points are not joined. Laboratory and field checks are separate charts.</p>
        <div class="d-charts">${[["lab", "Laboratory nitrate, mg/L NO3-N"], ["field", "Field checks of nitrate (strip spans, photometer points)"], ["sediment", "Sediment depth by reference point, with warning and cleanout levels"]]
          .map(([k, t]) => `<figure class="d-chart">${c[k] || '<p class="muted">No data recorded</p>'}<figcaption>${esc(t)}</figcaption></figure>`).join("")}</div>
        <p class="l-src">${esc(w.conversion_note)}</p></div>`;
  }

  function reports(models, one) {
    const row = ({s}) => `<li><span><span class="sdot" style="background:${K().COLOR[s.type]}"></span>${esc(s.name)}</span><span class="l-sp"></span>
      <button type="button" class="btn ghost sm" data-rep="fsr" data-s="${s.id}">Food Safety Record</button><button type="button" class="btn ghost sm" data-rep="ws" data-s="${s.id}">Water Summary</button></li>`;
    return `<div class="panel stack" id="dReports"><h3 style="margin:0">Reports</h3>
      <p class="t-intro">Two printable reports built from your records: the Food Safety Record for an auditor, and the Water Quality and Maintenance Summary for funders and partners. Nothing is sent anywhere unless you send it.</p>
      <div class="d-reps">
        <div class="d-rep"><b>Food Safety Record</b><p>Visit by visit: vegetation, wildlife (only if the project owner chose so), farm activity, structures, water, trash, repairs, photos and sign-off. Documentation the project owner can show an auditor.</p>
          <label class="check"><input type="checkbox" id="dHist"> Add the change history at the end</label></div>
        <div class="d-rep"><b>Water Quality and Maintenance Summary</b><p>The indicators with targets, results, methods and trends, the charts, and the maintenance done. For Preservation, Inc., the Water Boards and the crews. It never shows the exact place, and shows the project owner only if they chose so in Sharing.</p></div>
      </div>
      ${one ? `<div class="row"><button type="button" class="btn" data-rep="fsr" data-s="${one.s.id}">Food Safety Record</button><button type="button" class="btn" data-rep="ws" data-s="${one.s.id}">Water Quality and Maintenance Summary</button></div>`
        : `<ul class="d-replist">${models.map(row).join("")}</ul>`}
      <p class="l-src">Each report opens here, ready to print or to save as PDF. Period: the year chosen above. Every page says Sample data.</p>
      <p>See a sample first: <a href="#report/food-safety/sample">Food Safety Record</a> · <a href="#report/water-summary/sample">Water Quality and Maintenance Summary</a>.</p>
      <p class="l-warn" id="dRepMsg" hidden></p></div>`;
  }

  /* ---------- change history ---------- */
  function siteOf(r) {
    const D = St.data;
    if (D.sites.some(s => s.id === r.record_id)) return r.record_id;
    const pl = D.annual_plans.find(p => p.id === r.record_id); if (pl) return pl.site;
    const c = D.corrective_entries.find(x => x.id === r.record_id); if (c) return c.site;
    const vid = D.visits.some(v => v.id === r.record_id) ? r.record_id : ((D.measurements.find(m => m.id === r.record_id) || D.observations.find(o => o.id === r.record_id) || {}).visit);
    const v = vid && D.visits.find(x => x.id === vid); return v ? v.site : null;
  }
  const val = x => x === null || x === undefined ? "" : typeof x === "object" ? JSON.stringify(x) : String(x);
  function historyRows(sites) {
    const ids = new Set(sites.map(s => s.id)), p = period(filt.year);
    return St.data.revisions.map(r => ({r, site: siteOf(r)})).filter(x => ids.has(x.site) && x.r.when.slice(0, 10) >= p.start && x.r.when.slice(0, 10) <= p.end)
      .sort((a, b) => a.r.when.localeCompare(b.r.when)).map(({r, site}) => ({when: r.when.replace("T", " ").slice(0, 16), vts: (St.site(site) || {}).name || site, record: `${r.record_type} ${r.record_id}`,
        field: r.field, old: val(r.old_value), new: val(r.new_value), reason: r.reason, category: r.category || "", by: r.who_role}));
  }
  function history(sites) {
    const rows = historyRows(sites);
    return `<div class="panel stack"><div class="l-row"><h3 style="margin:0">Change history</h3><span class="l-sp"></span>
        <button type="button" class="btn ghost sm" id="dCsv"${rows.length ? "" : " disabled"}>Download CSV</button><button type="button" class="btn ghost sm" id="dHpdf"${rows.length ? "" : " disabled"}>Print or save as PDF</button></div>
      <p class="l-src">Every correction to a closed visit, an approved plan, a repair or a VTS, with the old value, the new one and the reason. ${rows.length} in this period for the VTS shown.</p>
      ${rows.length ? `<div class="scroll"><table class="d-hist"><thead><tr><th>When</th><th>VTS</th><th>Record</th><th>Change</th><th>Reason</th><th>By</th></tr></thead><tbody>
        ${rows.slice().reverse().slice(0, 8).map(h => `<tr><td>${esc(h.when)}</td><td>${esc(h.vts)}</td><td>${esc(h.record)}</td><td>${esc(h.field)}: ${esc(short(h.old))} → ${esc(short(h.new))}</td><td>${esc(h.reason)}${h.category ? ` (${esc(h.category)})` : ""}</td><td>${esc(h.by)}</td></tr>`).join("")}</tbody></table></div>
        ${rows.length > 8 ? `<p class="l-src">The 8 most recent are shown. The download has all ${rows.length}.</p>` : ""}` : '<p class="muted">No changes recorded in this period.</p>'}</div>`;
  }
  const short = s => s.length > 40 ? s.slice(0, 39) + "…" : (s || "none");
  const fileBase = () => `VTS_${filt.site || filt.type || "all"}_${filt.year}`;
  function download(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows) {
    const cols = [["when", "When"], ["vts", "VTS"], ["record", "Record"], ["field", "Field"], ["old", "Old value"], ["new", "New value"], ["reason", "Reason"], ["category", "Category"], ["by", "Changed by (role)"]];
    const cell = v => /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    return "﻿" + [cols.map(c => c[1]).join(","), ...rows.map(r => cols.map(c => cell(String(r[c[0]] ?? ""))).join(","))].join("\r\n") + "\r\n";
  }
  function historyDoc(rows) {
    const p = period(filt.year);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Change history ${esc(fileBase())}</title><style>
      @page{size:A4 landscape;margin:14mm;@bottom-left{content:"Change history · ${esc(p.start)} to ${esc(p.end)} · Sample data";font:8pt sans-serif;color:#5B6E83}@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt sans-serif;color:#5B6E83}}
      body{font:9pt/1.4 "Public Sans",Arial,sans-serif;color:#1F2D3D}h1{font:700 18pt "Barlow Condensed",Arial,sans-serif;color:#03467E;margin:0 0 4pt}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #DBE5EF;padding:3pt 4pt;text-align:left;vertical-align:top}th{background:#03467E;color:#fff}tr:nth-child(even) td{background:#F4F8FC}
      .s{color:#B4361F;font-weight:700}</style></head><body><h1>Change history</h1>
      <p><span class="s">Sample data.</span> ${esc(St.data.organization.name)} · ${filt.site ? esc((St.site(filt.site) || {}).name) : "All VTS" + (filt.type ? ", " + esc(K().NAME[filt.type]) : "")} · ${esc(p.start)} to ${esc(p.end)} · generated ${esc(K().today())}</p>
      <table><thead><tr><th>When</th><th>VTS</th><th>Record</th><th>Field</th><th>Old value</th><th>New value</th><th>Reason</th><th>Category</th><th>By (role)</th></tr></thead><tbody>
      ${rows.map(r => `<tr>${["when", "vts", "record", "field", "old", "new", "reason", "category", "by"].map(k => `<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  }

  /* ---------- report rendering (same templates as render_reports.py) ---------- */
  function loadScript(src) { return new Promise((ok, bad) => { if (window.nunjucks) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("Nunjucks did not load")); document.head.appendChild(s); }); }
  async function getEnv() {
    if (env) return env;
    await loadScript(NUNJUCKS);
    const names = ["_style.html", "food_safety_record.html", "water_summary.html"];
    const src = Object.fromEntries(await Promise.all(names.map(n => fetch("tool/templates/" + n, {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(n + " " + r.status); return r.text(); }).then(t => [n, t]))));
    const Loader = window.nunjucks.Loader.extend({getSource: name => ({src: src[name], path: name, noCache: false})});
    env = new window.nunjucks.Environment(new Loader(), {autoescape: true});
    return env;
  }
  async function report(kind, siteId) {
    const d = dataFor(filt.year), it = items(), withHist = !!(q("#dHist") && q("#dHist").checked);
    const r = kind === "fsr" ? RM().foodSafety(d, indicators, it, siteId, withHist) : RM().waterSummary(d, indicators, it, siteId);
    if (r.history) r.history = r.history.map(h => ({...h, old_value: val(h.old_value), new_value: val(h.new_value)}));
    const html = (await getEnv()).render(kind === "fsr" ? "food_safety_record.html" : "water_summary.html", {r, font_dir: new URL("tool/fonts", location.href).href});
    const s = St.site(siteId);
    viewer(`${kind === "fsr" ? "Food Safety Record" : "Water Quality and Maintenance Summary"} · ${s.name} · ${filt.year}`, html, `${kind === "fsr" ? "Food_Safety_Record" : "Water_Summary"}_${s.id}_${filt.year}`);
  }
  /* the report inside the page: no new tab needed (some browsers block them). Print prints only the report. */
  function viewer(title, html, base) {
    K().openDlg(`<h3 style="margin:0 6rem .4rem 0">${esc(title)}</h3>
      <div class="row"><button type="button" class="btn" id="dPrint">Print or save as PDF</button><button type="button" class="btn ghost" id="dHtml">Download HTML</button></div>
      <p class="l-src">To get a PDF, press Print and choose "Save as PDF" as the printer. Sample data on every page.</p>
      <iframe id="dFrame" class="d-frame" title="${esc(title)}"></iframe>`, () => {
      const f = q("#dFrame"); f.srcdoc = html;
      q("#toolDlg .l-sheet").classList.add("d-wide");
      q("#dPrint").onclick = () => { f.contentWindow.focus(); f.contentWindow.print(); };
      q("#dHtml").onclick = () => download(base + ".html", html, "text/html;charset=utf-8");
    });
  }


  function wire(models) {
    q("#dSite").onchange = e => { filt.site = e.target.value; render(); };
    q("#dType").onchange = e => { filt.type = e.target.value; render(); };
    q("#dYear").onchange = e => { filt.year = +e.target.value; render(); };
    qa("[data-rep]").forEach(b => b.onclick = () => {
      b.disabled = true; const t = b.textContent; b.textContent = "Preparing…";
      report(b.dataset.rep, b.dataset.s).catch(e => msg("The report could not be made: " + e.message)).finally(() => { b.disabled = false; b.textContent = t; });
    });
    const sites = models.map(m => m.s);
    qa("[data-dsel]").forEach(b => b.onclick = () => { pick(b.dataset.dsel, models); if (dmap) drawMap(models); });
    if (q("#dCsv")) q("#dCsv").onclick = () => download(fileBase() + "_change_history.csv", csv(historyRows(sites)), "text/csv;charset=utf-8");
    if (q("#dHpdf")) q("#dHpdf").onclick = () => viewer(`Change history · ${filt.year}`, historyDoc(historyRows(sites)), fileBase() + "_change_history");
  }
  const msg = t => { const m = q("#dRepMsg"); if (m) { m.textContent = t; m.hidden = false; } };

  /* ---------- public sample reports (#report/food-safety/sample, #report/water-summary/sample): no sign-in, the sample data file as it is ---------- */
  const SAMPLE_SITE = "S-VD";   /* the vegetated ditch, the same system as the sample Food Safety Record PDF */
  async function sample(kind) {
    const box = document.getElementById("reportView"), fsr = kind !== "water-summary";
    const title = fsr ? "Food Safety Record" : "Water Quality and Maintenance Summary";
    box.innerHTML = `<p class="l-src">Preparing the sample report…</p>`;
    try {
      const [d, ind] = await Promise.all(["tool/sample_data.json", "tool/indicators.json"].map(f => fetch(f, {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); })));
      const it = RM().itemsFrom((window.VTS_LEARN || {}).checklist);
      const r = fsr ? RM().foodSafety(d, ind, it, SAMPLE_SITE, false) : RM().waterSummary(d, ind, it, SAMPLE_SITE);
      const html = (await getEnv()).render(fsr ? "food_safety_record.html" : "water_summary.html", {r, font_dir: new URL("tool/fonts", location.href).href});
      box.innerHTML = `<div class="r-banner"><p><b>Sample report, made with sample data.</b> ${fsr ? "Documentation you can show an auditor. The auditor or the program decides what it needs; this is not a compliance report." : "For funders and partners. It never shows the exact place."}</p>
          <div class="row"><button class="btn" type="button" id="rPrint">Print or save as PDF</button><a class="btn ghost" href="#tool/dashboard">Make yours in the Tool →</a>
          <a href="#report/${fsr ? "water-summary" : "food-safety"}/sample">See the ${fsr ? "Water Quality and Maintenance Summary" : "Food Safety Record"} →</a></div></div>
        <h1 class="r-title">${title}</h1>
        <iframe id="rFrame" class="r-frame" title="${title}, sample"></iframe>`;
      const f = document.getElementById("rFrame"); f.srcdoc = html;
      f.onload = () => { try { f.style.height = Math.max(900, f.contentDocument.documentElement.scrollHeight + 40) + "px"; } catch (e) {} };
      document.getElementById("rPrint").onclick = () => { f.contentWindow.focus(); f.contentWindow.print(); };
    } catch (e) { box.innerHTML = `<div class="panel">The sample report could not be made (${esc(e.message)}). Open the site from a web server, not as a file.</div>`; }
  }
  return {render, sample};
})();
