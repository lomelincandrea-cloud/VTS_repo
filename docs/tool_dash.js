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
  let indicators = null, env = null;

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
      <p class="muted">How each system is doing against the targets of the Monitoring framework, and the reports you can print. Every status comes from the target written for that indicator; where there is no target it says so.</p>
      <div class="d-filters panel">
        <label class="l-lab">VTS <select id="dSite"><option value="">All my VTS (${all.length})</option>${all.map(s => `<option value="${s.id}"${s.id === filt.site ? " selected" : ""}>${esc(s.name)}${s.status === "decommissioned" ? " (decommissioned)" : ""}</option>`).join("")}</select></label>
        <label class="l-lab">System type <select id="dType"${filt.site ? " disabled" : ""}><option value="">All types</option>${Object.entries(K().NAME).map(([k, n]) => `<option value="${k}"${k === filt.type ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="l-lab">Year <select id="dYear">${years.map(y => `<option${y === filt.year ? " selected" : ""}>${y}</option>`).join("")}</select></label>
        <span class="l-src">Period: ${esc(p.start)} to ${esc(p.end)}. Sample data.</span>
      </div>
      ${!models.length ? `<div class="panel">No VTS of this type.</div>` : one ? single(one) : rollup(models)}
      ${reports(models, one)}
      ${history(sites)}`;
    K().bar();
    wire(models);
  }

  function tiles(models) {
    const sum = k => models.reduce((a, m) => a + m.w.plain[k], 0);
    const lab = models.filter(m => m.w.plain.nitrate_applies && ["met", "not_met"].includes(m.w.indicators[4].status)), labMet = lab.filter(m => m.w.indicators[4].status === "met").length;
    const noLab = models.filter(m => m.w.plain.nitrate_applies).length - lab.length;
    return `<div class="d-tiles">
      <div class="d-tile"><b>${models.length}</b><span>VTS shown</span></div>
      <div class="d-tile"><b>${sum("done")} of ${sum("planned")}</b><span>planned visits done so far</span></div>
      <div class="d-tile"><b>${sum("open")}</b><span>repairs open or with the supervisor</span><a href="#tool/corrective${filt.site ? "/" + filt.site : ""}">Corrective log</a></div>
      <div class="d-tile"><b>${lab.length ? `${labMet} of ${lab.length}` : "–"}</b><span>laboratory nitrate checks inside the target${noLab ? ` (${noLab} VTS without a result or a target)` : ""}</span></div></div>`;
  }
  const legend = () => `<p class="d-legend">${Object.keys(MARK).map(k => chip(k)).join(" ")}</p>`;

  function rollup(models) {
    return `${tiles(models)}
      <div class="panel stack"><h3 style="margin:0">All indicators at a glance</h3>
        <p class="l-src">One row per VTS, one column per indicator. Tap a VTS for its details and reports.</p>
        <div class="scroll"><table class="d-mx"><thead><tr><th>VTS</th>${models[0].w.indicators.map(i => `<th title="${esc(i.indicator)}"><span>${esc(i.id)}</span>${esc(SHORT[i.id])}</th>`).join("")}</tr></thead>
        <tbody>${models.map(({s, w}) => `<tr><th><a href="#tool/dashboard/${s.id}"><span class="sdot" style="background:${s.status === "decommissioned" ? "#9AA7B5" : K().COLOR[s.type]}"></span>${esc(s.name)}</a></th>
          ${w.indicators.map(i => { const [m, c] = MARK[i.status]; return `<td><span class="d-dot d-${c || "o"}" title="${esc(i.id + ": " + i.status_text + ". " + i.result)}">${m}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
        ${legend()}</div>
      <div class="d-cards">${models[0].w.indicators.map((ind, k) => `<article class="panel d-card"><header><span class="d-id">${esc(ind.id)}</span><h3>${esc(SHORT[ind.id])}</h3></header>
        <p class="l-src">${esc(ind.goal)}. ${esc(ind.indicator)}.</p>
        <ul class="d-rows">${models.map(({s, w}) => { const i = w.indicators[k]; return `<li><a href="#tool/dashboard/${s.id}">${esc(s.name)}</a>${chip(i.status)}<span class="d-res">${esc(i.result)}</span></li>`; }).join("")}</ul></article>`).join("")}</div>`;
  }

  function single({s, w}) {
    const c = w.charts;
    return `${tiles([{s, w}])}
      <div class="panel stack"><div class="l-row"><span class="sdot" style="background:${K().COLOR[s.type]}"></span><h3 style="margin:0">${esc(s.name)}</h3><span class="l-src">${esc(K().NAME[s.type])}</span><span class="l-sp"></span>
        <a href="#tool/vts/${s.id}">Card</a><a href="#tool/vts/${s.id}/history/${filt.year}">Site History</a><a href="#tool/plan/${s.id}/${filt.year}">Yearly plan</a></div>
        <p>${w.plain.visits} visits recorded; ${w.plain.done} of the ${w.plain.planned} planned visits done so far. Outlet jar clearer at the spring visit: ${esc(w.plain.jar)}.
        ${w.plain.nitrate_applies ? `Laboratory check of nitrate: ${esc(w.plain.lab)}.` : "A sediment basin is not built to remove nitrate; nitrate is not measured."} ${w.plain.open} repair(s) open or with the supervisor.</p>
        ${legend()}</div>
      <div class="d-cards">${w.indicators.map(i => `<article class="panel d-card d-c-${i.status}"><header><span class="d-id">${esc(i.id)}</span><h3>${esc(SHORT[i.id])}</h3>${chip(i.status)}</header>
        <p class="l-src">${esc(i.goal)}. ${esc(i.indicator)}.</p>
        <table class="t-kv"><tr><th>Target</th><td>${esc(i.target)}</td></tr><tr><th>Result</th><td>${esc(i.result)}</td></tr><tr><th>Date</th><td>${esc(i.date)}</td></tr>
          <tr><th>Method</th><td>${esc(i.method)}</td></tr><tr><th>Over the years</th><td>${esc(i.trend)}</td></tr></table></article>`).join("")}</div>
      <div class="panel stack"><h3 style="margin:0">Charts</h3><p class="l-src">Each point is one measurement on its date. Points are not joined. Laboratory and field checks are separate charts.</p>
        <div class="d-charts">${[["lab", "Laboratory nitrate, mg/L NO3-N"], ["field", "Field checks of nitrate (strip spans, photometer points)"], ["sediment", "Sediment depth by reference point, with warning and cleanout levels"]]
          .map(([k, t]) => `<figure class="d-chart">${c[k] || '<p class="muted">No data recorded</p>'}<figcaption>${esc(t)}</figcaption></figure>`).join("")}</div>
        <p class="l-src">${esc(w.conversion_note)}</p></div>`;
  }

  function reports(models, one) {
    const row = ({s}) => `<li><span><span class="sdot" style="background:${K().COLOR[s.type]}"></span>${esc(s.name)}</span><span class="l-sp"></span>
      <button type="button" class="btn ghost sm" data-rep="fsr" data-s="${s.id}">Food Safety Record</button><button type="button" class="btn ghost sm" data-rep="ws" data-s="${s.id}">Water Summary</button></li>`;
    return `<div class="panel stack" id="dReports"><h3 style="margin:0">Reports</h3>
      <div class="d-reps">
        <div class="d-rep"><b>Food Safety Record</b><p>Visit by visit: vegetation, wildlife (only if the project owner chose so), farm activity, structures, water, trash, repairs, photos and sign-off. Documentation the project owner can show an auditor.</p>
          <label class="check"><input type="checkbox" id="dHist"> Add the change history at the end</label></div>
        <div class="d-rep"><b>Water Quality and Maintenance Summary</b><p>The indicators with targets, results, methods and trends, the charts, and the maintenance done. For Preservation, Inc., the Water Boards and the crews. It never shows the exact place, and shows the project owner only if they chose so in Sharing.</p></div>
      </div>
      ${one ? `<div class="row"><button type="button" class="btn" data-rep="fsr" data-s="${one.s.id}">Food Safety Record</button><button type="button" class="btn" data-rep="ws" data-s="${one.s.id}">Water Quality and Maintenance Summary</button></div>`
        : `<ul class="d-replist">${models.map(row).join("")}</ul>`}
      <p class="l-src">Each report opens here, ready to print or to save as PDF. Period: the year chosen above. Every page says Sample data.</p>
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
    if (q("#dCsv")) q("#dCsv").onclick = () => download(fileBase() + "_change_history.csv", csv(historyRows(sites)), "text/csv;charset=utf-8");
    if (q("#dHpdf")) q("#dHpdf").onclick = () => viewer(`Change history · ${filt.year}`, historyDoc(historyRows(sites)), fileBase() + "_change_history");
  }
  const msg = t => { const m = q("#dRepMsg"); if (m) { m.textContent = t; m.hidden = false; } };
  return {render};
})();
