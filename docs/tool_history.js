/* Site History of one VTS: one timeline per year that joins the yearly plan, the visits, the repairs (F05),
   laboratory results and every change to the record. Route: #tool/vts/<site id>/history[/<year>|all].
   Uses window.ToolKit (tool.js) and window.VTSStore (store.js). */
window.ToolHistory = (function () {
  "use strict";
  const St = window.VTSStore, K = () => window.ToolKit;
  const esc = s => K().esc(s);
  const filt = {kind: "all"};
  const KIND = {
    done: {label: "Visit done", dot: "#2F8F4E", group: "visits"},
    extra: {label: "Visit not in the plan", dot: "#2F8F4E", group: "visits"},
    noplan: {label: "Visit done", dot: "#2F8F4E", group: "visits"},
    missed: {label: "Planned visit not recorded", dot: "#B4361F", group: "visits"},
    planned: {label: "Planned visit", dot: "#2B7BBF", group: "visits"},
    found: {label: "Repair needed", dot: "#C99700", group: "repairs"},
    sched: {label: "Repair scheduled", dot: "#C99700", group: "repairs"},
    fixed: {label: "Repair done", dot: "#2F8F4E", group: "repairs"},
    lab: {label: "Laboratory results", dot: "#6B4FA0", group: "visits"},
    change: {label: "Record changed", dot: "#5B6E83", group: "changes"},
    site: {label: "System", dot: "var(--ink)", group: "changes"}};
  const REC = {annual_plan: "Yearly plan", visit: "Visit", measurement: "Measurement", observation: "Checklist answer", corrective_entrie: "Repair", corrective_entry: "Repair", site: "System"};
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const short = x => x === null || x === undefined ? "none" : Array.isArray(x) ? `${x.length} item(s)` : typeof x === "object" ? "changed" : String(x);
  const doneVisit = (s, pv) => St.visitsOf(s.id).find(v => v.status === "closed" && (v.planned_id === pv.id || v.date === pv.date));

  /* every event of one site, each {date, kind, title, text, link, linkText} */
  function events(s) {
    const out = [], today = K().today(), plans = St.data.annual_plans.filter(p => p.site === s.id), used = new Set();
    const visits = St.visitsOf(s.id), vids = new Set(visits.map(v => v.id));
    plans.forEach(p => p.planned_visits.forEach(pv => {
      const dv = doneVisit(s, pv);
      if (dv) { used.add(dv.id); out.push(visitEv(s, dv, "done", pv)); return; }
      const draft = visits.find(v => v.planned_id === pv.id && v.status !== "closed");
      if (pv.date < today) out.push({date: pv.date, kind: "missed", title: `${pv.type} visit`, text: draft ? "Started on the Visit Sheet but not closed." : "In the plan, but no visit was recorded for this date.",
        link: draft ? `#tool/visit/${draft.id}` : `#tool/plan/${s.id}/${p.year}`, linkText: draft ? "Finish the Visit Sheet" : "See the plan"});
      else out.push({date: pv.date, kind: "planned", title: `${pv.type} visit`, text: `In the ${p.year} plan (${p.status}).`, link: `#tool/plan/${s.id}/${p.year}`, linkText: "See the plan", link2: "#tool/visits", link2Text: "Next visits"});
    }));
    visits.filter(v => v.status === "closed" && !used.has(v.id)).forEach(v => out.push(visitEv(s, v, plans.some(p => p.year === +v.date.slice(0, 4)) ? "extra" : "noplan")));
    St.data.corrective_entries.filter(c => c.site === s.id).forEach(c => {
      const link = `#tool/corrective/${s.id}`;
      out.push({date: c.date, kind: "found", title: c.finding, text: [c.location, c.urgency && "urgency: " + c.urgency, c.status !== "resolved" && "status: " + c.status].filter(Boolean).join(" · "), link, linkText: "Corrective log"});
      if (c.scheduled && c.scheduled.date) out.push({date: c.scheduled.date, kind: "sched", title: c.finding, text: c.status === "resolved" ? "Was scheduled for this date." : "Scheduled in the yearly plan.", link: `#tool/plan/${s.id}/${c.scheduled.date.slice(0, 4)}`, linkText: "See the plan"});
      if (c.resolved_date) out.push({date: c.resolved_date, kind: "fixed", title: c.finding, text: c.action_taken || "", link, linkText: "Corrective log"});
    });
    (St.data.laboratory_samples || []).filter(l => l.site === s.id && l.report_date).forEach(l => out.push({date: l.report_date, kind: "lab", title: "Laboratory report received", text: l.laboratory || "", link: l.visit ? `#tool/visit/${l.visit}` : null, linkText: "Open the visit"}));
    /* changes to this site, its plans, its visits and what was recorded in them, its repairs */
    const own = new Set([s.id, ...plans.map(p => p.id), ...vids, ...St.data.corrective_entries.filter(c => c.site === s.id).map(c => c.id),
      ...St.data.measurements.filter(m => vids.has(m.visit)).map(m => m.id), ...St.data.observations.filter(o => vids.has(o.visit)).map(o => o.id)]);
    const visitOf = id => vids.has(id) ? id : (St.data.measurements.find(m => m.id === id) || St.data.observations.find(o => o.id === id) || {}).visit;
    St.data.revisions.filter(r => own.has(r.record_id)).forEach(r => {
      const v = visitOf(r.record_id), plan = plans.find(p => p.id === r.record_id);
      out.push({date: r.when.slice(0, 10), kind: "change", title: `${REC[r.record_type] || r.record_type}, ${r.field.replace(/_/g, " ")}: ${short(r.old_value)} → ${short(r.new_value)}`, text: `${r.reason}${r.category ? " (" + r.category + ")" : ""} · ${r.who_role}`,
        link: v ? `#tool/visit/${v}` : plan ? `#tool/plan/${s.id}/${plan.year}` : null, linkText: v ? "Open the visit" : "See the plan"});
    });
    if (s.year_built) out.push({date: `${s.year_built}-01-01`, kind: "site", title: "Built", text: "Year built from the design record.", yearOnly: true});
    if (s.decommissioned && s.decommissioned.date) out.push({date: s.decommissioned.date, kind: "site", title: `Decommissioned (${s.decommissioned.category})`, text: s.decommissioned.reason});
    return out.sort((a, b) => b.date.localeCompare(a.date) || order(a) - order(b));
  }
  const order = e => ["planned", "missed", "done", "extra", "noplan", "lab", "found", "sched", "fixed", "change", "site"].indexOf(e.kind);
  function visitEv(s, v, kind, pv) {
    const obs = St.data.observations.filter(o => o.visit === v.id), bad = obs.filter(o => o.answer === "abnormal").length;
    const meas = St.data.measurements.filter(m => m.visit === v.id).length, rep = St.data.corrective_entries.filter(c => c.visit === v.id).length;
    const nt = (v.tasks_done || []).length, np = (v.photos || []).length;
    const bits = [nt && pl(nt, "task"), bad ? pl(bad, "problem") + " found" : "no problems found", meas && pl(meas, "measurement"), np && pl(np, "photo"), rep && pl(rep, "repair") + " logged"];
    return {date: v.date, kind, title: `${v.type} visit`, text: bits.filter(Boolean).join(" · ") + (pv && pv.date !== v.date ? ` · planned for ${pv.date}` : ""), link: `#tool/visit/${v.id}`, linkText: "Open the Visit Sheet"};
  }

  function render(siteId, yearArg) {
    if (filt.site !== siteId) { filt.site = siteId; filt.kind = "all"; }
    const s = St.site(siteId), all = events(s), now = +K().today().slice(0, 4);
    const years = [...new Set(all.map(e => +e.date.slice(0, 4)).filter(y => y >= now - 5))].sort((a, b) => b - a);
    if (!years.includes(now)) years.unshift(now);
    const year = yearArg === "all" ? "all" : (+yearArg || now);
    const inYear = all.filter(e => year === "all" || +e.date.slice(0, 4) === year);
    const list = inYear.filter(e => filt.kind === "all" || KIND[e.kind].group === filt.kind);
    const n = k => inYear.filter(e => e.kind === k).length;
    const counts = [["planned", "visit planned ahead", "visits planned ahead"], ["done", "done as planned", "done as planned"], ["missed", "not recorded", "not recorded"], ["extra", "visit not in the plan", "visits not in the plan"], ["found", "repair needed", "repairs needed"], ["fixed", "repair done", "repairs done"]];
    const groups = [["all", "Everything"], ["visits", "Visits"], ["repairs", "Repairs"], ["changes", "Changes"]];
    let lastMonth = "";
    const rows = list.map(e => {
      const m = e.yearOnly ? e.date.slice(0, 4) : `${MON[+e.date.slice(5, 7) - 1]} ${e.date.slice(0, 4)}`;
      const head = m !== lastMonth ? `<li class="h-month">${esc(m)}</li>` : ""; lastMonth = m;
      return head + `<li class="h-ev h-${e.kind}"><span class="h-dot" style="background:${KIND[e.kind].dot}"></span>
        <div class="h-body"><div class="h-top"><span class="h-date">${esc(e.yearOnly ? e.date.slice(0, 4) : e.date)}</span><span class="h-kind">${esc(KIND[e.kind].label)}</span></div>
        <b class="h-title">${esc(e.title)}</b>${e.text ? `<span class="h-text">${esc(e.text)}</span>` : ""}
        ${e.link || e.link2 ? `<span class="h-links">${e.link ? `<a href="${e.link}">${esc(e.linkText)}</a>` : ""}${e.link2 ? `<a href="${e.link2}">${esc(e.link2Text)}</a>` : ""}</span>` : ""}</div></li>`;
    }).join("");
    return `<div class="l-row"><h3 style="margin:0">Site History</h3><span class="l-sp"></span>
        <label class="l-lab">Year <select id="hYear">${years.map(y => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`).join("")}<option value="all"${year === "all" ? " selected" : ""}>All years</option></select></label></div>
      <p class="muted">Everything that happened at this system, newest first: the visits of the yearly plan and whether they were done, the repairs, laboratory results, and every change to the record with its reason.</p>
      ${year !== "all" && !St.planOf(siteId, year) && inYear.length ? `<p class="l-src">There is no ${year} yearly plan in the Tool, so these visits are not compared with a plan.</p>` : ""}
      <div class="h-sum">${counts.filter(([k]) => n(k)).map(([k, one, many]) => `<span class="h-n h-n-${k}"><b>${n(k)}</b> ${n(k) === 1 ? one : many}</span>`).join("")}</div>
      <div class="l-pills" role="group" aria-label="Show">${groups.map(([k, t]) => `<button type="button" class="l-pill${filt.kind === k ? " on" : ""}" data-hk="${k}" aria-pressed="${filt.kind === k}">${t}</button>`).join("")}</div>
      <ol class="h-line">${rows || `<li class="muted">Nothing recorded ${year === "all" ? "yet" : "in " + year}.</li>`}</ol>
      <p class="l-src">Sample data. Missed means the plan had a visit on that date and no closed Visit Sheet matches it.</p>`;
  }
  function wire(siteId, again) {
    const y = document.getElementById("hYear");
    if (y) y.onchange = () => { location.hash = `#tool/vts/${siteId}/history/${y.value}`; };
    document.querySelectorAll("[data-hk]").forEach(b => b.onclick = () => { filt.kind = b.dataset.hk; again(); });
  }
  return {render, wire, events};
})();
