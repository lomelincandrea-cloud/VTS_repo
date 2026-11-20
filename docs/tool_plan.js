/* Tool: Yearly plan (overview grid of all VTS, and the editable plan of one VTS), the Visit Sheet (F04) form,
   the list of Visit Sheets, Next visits (calendar and table), Send to phone and the Corrective log.
   Routes: #tool/plan (overview), #tool/plan/all/<year>, #tool/plan/<site>/<year> (edit one VTS), #tool/visit/<visit id>, #tool/sheets, #tool/visits. Uses window.ToolKit (tool.js), VTSStore (store.js), VTS_LEARN (learn_data.js).
   Rules: a draft is saved freely; an approved plan or a closed visit is changed only with a reason (edit history). */
window.ToolPlan = (function () {
  "use strict";
  const St = window.VTSStore, L = window.VTS_LEARN || {tasks: [], checklist: []};
  const K = () => window.ToolKit;
  const MV = {"Routine": "Routine visit", "After storm": "After storms", "Spring": "Spring visit", "Pre-storm": "Pre-storm visit", "January review": "January review (office)", "When needed": "When needed", "Corrective": "Corrective"};
  const TYPES = Object.keys(MV);
  const ON_SITE = ["Routine", "After storm", "Spring", "Pre-storm"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const BURROW_ITEMS = ["SB-CL-13", "SB-CL-18", "VD-CL-14", "TW-CL-12", "WB-CL-02", "WB-CL-07", "WB-CL-14"];
  const KITS = {
    "strip-n": {method: "test strip", name: "Nitrate test strips", range: "0 to 50 mg/L NO3-N", blocks: [0, 2, 5, 10, 20, 50], unit: "mg/L NO3-N"},
    "strip-3": {method: "test strip", name: "Nitrate test strips (nitrate scale)", range: "0 to 250 mg/L NO3", blocks: [0, 10, 25, 50, 100, 250], unit: "mg/L NO3"},
    "photometer": {method: "portable photometer", name: "Portable nitrate photometer", range: "0 to 30 mg/L NO3-N", unit: "mg/L NO3-N"}};
  const CATS = ["typo", "wrong site", "late result", "other"];
  const esc = s => K().esc(s), q = (s, r) => K().q(s, r), qa = (s, r) => K().qa(s, r);
  const taskBy = id => L.tasks.find(t => t.id === id);
  const nitrateSys = t => L.tasks.some(x => x.sys === t && /^Water Check/.test(x.name));
  const yearNow = () => new Date().getFullYear();

  function suggested(sys, type) {
    const ts = L.tasks.filter(t => t.sys === sys), routine = ts.filter(t => t.visit === "Routine visit").map(t => t.id);
    const own = ts.filter(t => t.visit === MV[type]).map(t => t.id);
    if (type === "Routine") return routine;
    if (type === "After storm") return own.length ? own : routine.filter(id => /_T01$/.test(id));
    if (type === "Spring" || type === "Pre-storm") return [...new Set([...routine, ...own])];
    return own;
  }
  const chosen = (sys, pv) => pv.tasks ? pv.tasks : suggested(sys, pv.type);
  const taskLink = id => { const t = taskBy(id); return `<a href="#learn/task/${id}">${esc(t ? t.name : id)}</a> <span class="l-src">${id}</span>`; };

  /* ================= Yearly plan: Gantt ================= */
  const FIXED = [[1, 14, "January review"], [4, 15, "Spring"], [8, 19, "Pre-storm"]];
  const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const isRoutine = id => (taskBy(id) || {}).visit === "Routine visit";
  const keyOf = x => x.task || "+" + x.text;
  const label = k => k[0] === "+" ? esc(k.slice(1)) : `${esc((taskBy(k) || {}).name || k)} <span class="l-src">${k}</span>`;
  let editMode = false;
  /* after: how to redraw the page that is open (overview grid or one VTS's plan). openRec: the visit record shown under the grid. */
  let after = null, openRec = null;
  const redraw = (s, year) => after ? after() : plan(s.id, year);
  const money = n => n === null || n === undefined || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
  const rate = () => (St.data.organization || {}).labor_rate ?? null;
  function estCost(pv) {
    const mat = (pv.materials || []).reduce((a, m) => a + (+m.qty || 0) * (+m.unit_cost || 0), 0);
    const lab = pv.est_hours && pv.est_crew && rate() ? pv.est_hours * pv.est_crew * rate() : 0;
    return {mat, lab, total: mat + lab};
  }
  /* rows of the Gantt: every non-routine task in any visit, plus rows added with + */
  function ganttRows(s, p) {
    const set = new Set(p.rows || []);
    p.planned_visits.forEach(pv => { chosen(s.type, pv).forEach(id => { if (!isRoutine(id)) set.add(id); }); pv.extra_tasks.forEach(x => set.add(keyOf(x))); });
    return [...set].sort((a, b) => (a[0] === "+") - (b[0] === "+") || a.localeCompare(b));
  }
  const visitHas = (s, pv, k) => k[0] === "+" ? pv.extra_tasks.some(x => keyOf(x) === k) : chosen(s.type, pv).includes(k) || pv.extra_tasks.some(x => x.task === k);
  const doneVisit = (s, pv) => St.visitsOf(s.id).find(v => v.status === "closed" && (v.planned_id === pv.id || v.date === pv.date));

  function plan(siteId, yearArg) {
    if (!siteId || siteId === "all") return overview(yearArg);
    after = null;
    const active = St.sites().filter(s => s.status !== "decommissioned");
    const s = St.site(siteId) || active[0];
    if (!s) { K().view().innerHTML = `<div class="panel">Add a VTS first in <a href="#tool/vts">My VTS</a>.</div>`; return; }
    const years = [...new Set([...St.data.annual_plans.filter(p => p.site === s.id).map(p => p.year), yearNow(), yearNow() + 1])].sort();
    const year = +yearArg || yearNow();
    const p = St.planOf(s.id, year);
    const head = `<p><a href="#tool/plan/all/${year}">← All VTS in ${year}</a></p><div class="l-row"><h2 style="margin:0">Plan of one VTS</h2><span class="l-sp"></span>
        <label class="l-lab">VTS <select id="pSite">${active.map(x => `<option value="${x.id}"${x.id === s.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label class="l-lab">Year <select id="pYear">${years.map(y => `<option${y === year ? " selected" : ""}>${y}</option>`).join("")}</select></label><a class="btn ghost sm" href="#tool/vts/${s.id}/history/${year}">Site History</a></div>`;
    if (!p) {
      K().view().innerHTML = head + `<div class="panel stack"><p>No plan for ${year} yet.</p><div class="row"><button class="btn" type="button" id="pNew">Create the ${year} plan</button></div>
        <p class="small muted">It starts with the visits the manual fixes: the January review, the spring visit in April and the pre-storm visit in August, with their tasks. Routine tasks are done at every visit. Add the other visits you need on the chart.</p></div>`;
      wire(); q("#pNew").onclick = () => { newPlan(s, year); plan(s.id, year); }; return;
    }
    p.rows = p.rows || [];
    const pvs = p.planned_visits.slice().sort((a, b) => a.date.localeCompare(b.date));
    const approved = p.status === "approved", rows = ganttRows(s, p);
    const routine = suggested(s.type, "Routine");
    const extraDone = St.visitsOf(s.id).filter(v => v.status === "closed" && v.date.slice(0, 4) === String(year) && !pvs.some(pv => pv.id === v.planned_id || pv.date === v.date));
    const byMonth = m => pvs.filter(pv => +pv.date.slice(5, 7) - 1 === m);
    const cell = (k, m) => {
      const hits = byMonth(m).filter(pv => visitHas(s, pv, k));
      if (!hits.length) return `<td class="g-c${editMode ? " g-add" : ""}" data-k="${esc(k)}" data-m="${m}">${editMode ? '<span class="g-plus">+</span>' : ""}</td>`;
      return `<td class="g-c on" data-k="${esc(k)}" data-m="${m}">${hits.map(pv => { const dv = doneVisit(s, pv), done = dv && (dv.tasks_done || []).includes(k);
        const cls = done ? "done" : dv ? "miss" : "plan", sym = done ? "✓" : dv ? "–" : "✕", note = done ? " · done" : dv ? " · visit closed, task not marked done" : "";
        return `<span class="g-mark ${cls}" title="${esc(pv.date)} · ${esc(pv.type)}${note}">${sym}<small>${+pv.date.slice(8)}</small></span>`; }).join("")}</td>`;
    };
    K().view().innerHTML = head + `
      <div class="t-bar"><span>${approved ? `<span class="l-chip g">Approved</span> Changes ask for a reason.` : `<span class="l-chip y">Draft</span> Changes are saved as you go.`}</span><span class="l-sp"></span>
        <button class="btn ${editMode ? "" : "ghost "}sm" type="button" id="pEdit" aria-pressed="${editMode}">${editMode ? "Done editing" : "Edit the plan"}</button>
        ${approved ? "" : `<button class="btn ghost sm" type="button" id="pApprove">Approve the plan</button>`}</div>
      ${editMode ? `<p class="l-banner">Editing: click an empty month to schedule a task and choose the exact day. Click a ✕ to move it or take it out. Use + to add a task, and the bin to remove one (it asks why).</p>` : ""}
      <div class="scroll g-wrap"><table class="g-tab">
        <thead><tr><th class="g-t">Task</th>${MONTHS.map(m => `<th>${m}</th>`).join("")}</tr></thead>
        <tbody>
          <tr class="g-visits"><th class="g-t">Visits</th>${MONTHS.map((_, m) => `<td>${byMonth(m).map(pv => { const dv = doneVisit(s, pv);
            return `<button type="button" class="g-v ${dv ? "done" : ""}" data-pv="${pv.id}" title="${esc(pv.type)} visit, ${esc(pv.date)}">${+pv.date.slice(8)}<small>${esc(pv.type.split(" ")[0])}</small></button>`; }).join("")}
            ${extraDone.filter(v => +v.date.slice(5, 7) - 1 === m).map(v => `<a class="g-v done extra" href="#tool/visit/${v.id}" title="${esc(v.type)} visit, ${esc(v.date)} (not in the plan)">${+v.date.slice(8)}<small>${esc(v.type.split(" ")[0])}</small></a>`).join("")}</td>`).join("")}</tr>
          <tr class="g-rout"><th class="g-t">Routine tasks, at every visit<br>${routine.map(id => `<span class="l-src">${esc((taskBy(id) || {}).name || id)}</span>`).join("<br>")}</th>${MONTHS.map((_, m) => `<td>${byMonth(m).length ? '<span class="g-dot" title="At every visit">●</span>' : ""}</td>`).join("")}</tr>
          ${rows.map(k => `<tr><th class="g-t">${k[0] !== "+" ? `<a href="#learn/task/${k}">${label(k)}</a>` : `<span class="l-chip y">Extra</span> ${label(k)}`}${editMode ? ` <button type="button" class="g-del" data-del="${esc(k)}" aria-label="Remove this task from the plan">🗑</button>` : ""}</th>${MONTHS.map((_, m) => cell(k, m)).join("")}</tr>`).join("")}
          <tr class="g-addrow"><th class="g-t" colspan="13"><div class="l-row"><span class="g-plusbig">+</span><select id="gAddSel" aria-label="Add a task"><option value="">Add a task…</option>
            ${L.tasks.filter(t => (t.sys === s.type || t.sys === "COR") && !rows.includes(t.id) && !routine.includes(t.id)).map(t => `<option value="${t.id}">${esc(t.id + " " + t.name)}</option>`).join("")}<option value="+">Another task (write it)</option></select>
            <input id="gAddTxt" placeholder="Describe the task" hidden><button class="btn ghost sm" type="button" id="gAdd">Add</button></div></th></tr>
        </tbody></table></div>
      <p class="l-src">✕ planned · ✓ done (from the Site History) · – visit closed but the task was not marked done · the number is the day of the month · ● routine tasks, done at every visit. Select a visit date in the Visits row to open its record.</p>
      <p class="l-src">Estimated for ${year}: <b>${money(pvs.reduce((a, pv) => a + estCost(pv).total, 0))}</b>${rate() ? "" : ` (materials only; <a href="#tool/plan/all/${year}">set a labor rate</a> to add labor)`}</p>
      <div id="pRec">${openRec && pvs.some(pv => pv.id === openRec) ? recordHtml(s, p, pvs.find(pv => pv.id === openRec)) : ""}</div>
      ${histOf([p.id])}`;
    wire();
    q("#pEdit").onclick = () => { editMode = !editMode; plan(s.id, year); };
    if (q("#pApprove")) q("#pApprove").onclick = () => { p.status = "approved"; p.approved = K().today(); St.persist(); plan(s.id, year); };
    q("#gAddSel").onchange = e => { q("#gAddTxt").hidden = e.target.value !== "+"; };
    q("#gAdd").onclick = () => {
      const v = q("#gAddSel").value, txt = q("#gAddTxt").value.trim(), k = v === "+" ? (txt ? "+" + txt : "") : v;
      if (!k) return;
      p.rows = [...new Set([...(p.rows || []), k])]; St.persist(); editMode = true; plan(s.id, year);
    };
    qa("[data-del]").forEach(b => b.onclick = () => {
      const k = b.dataset.del;
      reasonCat(`Remove "${k[0] === "+" ? k.slice(1) : (taskBy(k) || {}).name || k}" from the ${year} plan`, (reason, cat) => {
        const next = p.planned_visits.map(pv => { const v = JSON.parse(JSON.stringify(pv)); v.tasks = chosen(s.type, v).filter(t => t !== k); v.extra_tasks = v.extra_tasks.filter(x => keyOf(x) !== k); return v; });
        p.rows = (p.rows || []).filter(r => r !== k);
        St.update("annual_plans", p.id, {planned_visits: next}, `Task removed: ${k}. ${reason}`, cat); plan(s.id, year);
      }, null, true);
    });
    qa("td.g-c").forEach(td => td.onclick = () => { if (editMode) cellDlg(s, p, td.dataset.k, +td.dataset.m, year); });
    qa("[data-pv].g-v").forEach(b => b.onclick = () => { openRec = b.dataset.pv; showRec(q("#pRec"), s, p, p.planned_visits.find(pv => pv.id === openRec), year); });
    qa("[data-pvrow]").forEach(det => wireVisitRow(s, p, det, year));
  }
  function wire() {
    q("#pSite").onchange = e => location.hash = `#tool/plan/${e.target.value}/${q("#pYear").value}`;
    q("#pYear").onchange = e => location.hash = `#tool/plan/${q("#pSite").value}/${e.target.value}`;
  }
  function newPlan(s, year) {
    const id = `P-${s.id}-${year}`, d = (m, day) => `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    St.put("annual_plans", {id, site: s.id, year, status: "draft", rows: [], planned_visits: FIXED.map(([m, day, t], i) => ({id: `${id}-${i + 1}`, date: d(m, day), type: t, extra_tasks: [], materials: []}))});
  }
  /* save a change. Draft: direct. Approved, or a removal: asks a reason (edit history). */
  function changePlan(s, p, next, what, needReason) {
    if (p.status !== "approved" && !needReason) { p.planned_visits = next; St.persist(); redraw(s, p.year); return; }
    reasonCat(`${p.status === "approved" ? "Change the approved plan" : "Change the plan"}: ${what}`, (reason, cat) => { St.update("annual_plans", p.id, {planned_visits: next}, `${what}. ${reason}`, cat); redraw(s, p.year); }, () => redraw(s, p.year), needReason);
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  function typeFor(k, month) {
    const t = taskBy(k);
    if (!t) return "When needed";
    if (t.sys === "COR") return "Corrective";
    return {"Spring visit": "Spring", "Pre-storm visit": "Pre-storm", "January review (office)": "January review", "After storms": "After storm"}[t.visit] || "When needed";
  }
  /* click on a month cell in edit mode */
  function cellDlg(s, p, k, m, year) {
    const first = `${year}-${String(m + 1).padStart(2, "0")}-01`, last = new Date(year, m + 1, 0).getDate(), lastD = `${year}-${String(m + 1).padStart(2, "0")}-${last}`;
    const inMonth = p.planned_visits.filter(pv => +pv.date.slice(5, 7) - 1 === m), here = inMonth.filter(pv => visitHas(s, pv, k));
    const name = k[0] === "+" ? k.slice(1) : (taskBy(k) || {}).name || k;
    K().openDlg(`<h3>${esc(name)} · ${MON_LONG[m]} ${year}</h3>
      ${here.length ? `<p>Scheduled on ${here.map(pv => `<b>${esc(pv.date)}</b> (${esc(pv.type)})`).join(", ")}.</p>` : ""}
      <form id="gcF" class="stack">
        <div class="f"><label for="gcD">${here.length ? "Move it to" : "Which day?"}</label><input type="date" id="gcD" min="${first}" max="${lastD}" value="${here[0] ? here[0].date : (inMonth[0] ? inMonth[0].date : `${year}-${String(m + 1).padStart(2, "0")}-15`)}" required></div>
        ${inMonth.length ? `<p class="l-src">Visits already planned this month: ${inMonth.map(pv => `${esc(pv.date)} (${esc(pv.type)})`).join(", ")}. Choose one of those days to do the task in the same visit.</p>` : ""}
        <div class="row"><button class="btn" type="submit">${here.length ? "Move" : "Schedule"}</button>${here.length ? `<button class="btn ghost" type="button" id="gcRm">Take it out of ${MON_LONG[m]}</button>` : ""}<button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    q("#gcF").onsubmit = e => {
      e.preventDefault(); const day = q("#gcD").value; if (!day) return;
      let next = clone(p.planned_visits);
      if (here.length) next = removeFrom(s, next, k, here.map(x => x.id));
      next = addTo(s, next, k, day, p);
      q("#toolDlg").close();
      changePlan(s, p, next, here.length ? `${name} moved to ${day}` : `${name} scheduled on ${day}`, false);
    };
    if (q("#gcRm")) q("#gcRm").onclick = () => { q("#toolDlg").close(); changePlan(s, p, removeFrom(s, clone(p.planned_visits), k, here.map(x => x.id)), `${name} taken out of ${MON_LONG[m]}`, true); };
  }
  function addTo(s, list, k, day, p) {
    let pv = list.find(v => v.date === day);
    if (!pv) { pv = {id: `${p.id}-${Date.now().toString(36)}`, date: day, type: typeFor(k), extra_tasks: [], materials: [], tasks: []}; list.push(pv); }
    if (k[0] === "+") { if (!pv.extra_tasks.some(x => keyOf(x) === k)) pv.extra_tasks.push({task: null, text: k.slice(1)}); }
    else if (suggested(s.type, pv.type).includes(k) || !taskBy(k) || taskBy(k).sys === s.type) { pv.tasks = [...new Set([...chosen(s.type, pv), k])]; }
    else if (!pv.extra_tasks.some(x => x.task === k)) pv.extra_tasks.push({task: k, text: (taskBy(k) || {}).name || k});
    return list;
  }
  function removeFrom(s, list, k, ids) {
    return list.map(pv => { if (!ids.includes(pv.id)) return pv; pv.tasks = chosen(s.type, pv).filter(t => t !== k); pv.extra_tasks = pv.extra_tasks.filter(x => keyOf(x) !== k); return pv; })
               .filter(pv => FIXED.some(f => f[2] === pv.type) || pv.type === "Routine" || pv.type === "After storm" || chosen(s.type, pv).length || pv.extra_tasks.length);
  }
  /* the record of one planned visit: tasks, crew and hours, materials, estimated cost, and the two actions */
  function recordHtml(s, p, pv) {
    const dv = St.visitsOf(s.id).find(v => v.planned_id === pv.id || v.date === pv.date), c = estCost(pv), tasks = [...chosen(s.type, pv), ...pv.extra_tasks.map(keyOf)];
    const st = vStatus(s, pv);
    return `<section class="panel t-rec" data-pvrow="${pv.id}" aria-label="Visit record">
      <div class="l-row"><h3 style="margin:0">${esc(s.name)} · ${esc(pv.type)} visit · ${esc(pv.date)}</h3><span class="l-sp"></span>${chipOf(st)}<button class="btn ghost sm" type="button" data-recclose>Close the record</button></div>
      <div class="l-row"><label class="l-lab">Date <input type="date" data-f="date" value="${pv.date}"></label><label class="l-lab">Type <select data-f="type">${TYPES.map(t => `<option${t === pv.type ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <div><b>Tasks</b><ul class="t-tasks">${tasks.map(t => `<li>${t[0] === "+" ? `<span class="l-chip y">Extra</span> ${esc(t.slice(1))}` : taskLink(t)}</li>`).join("") || "<li class='l-src'>No tasks chosen.</li>"}</ul></div>
      <div class="grid3"><label class="l-lab">Crew (people) <input type="number" min="0" data-f="est_crew" value="${pv.est_crew ?? ""}" style="width:5rem"></label><label class="l-lab">Hours on site <input type="number" min="0" step="0.5" data-f="est_hours" value="${pv.est_hours ?? ""}" style="width:5rem"></label>
        <span class="l-src">Labor ${rate() ? money(c.lab) : "(set a labor rate)"} · materials ${money(c.mat)} · <b>estimated ${money(c.total)}</b></span></div>
      <div class="scroll"><table class="t-mat"><thead><tr><th>Material</th><th>Quantity</th><th>Unit</th><th>Unit cost ($)</th><th>Cost</th><th></th></tr></thead><tbody>
        ${(pv.materials || []).map((m, i) => `<tr><td>${esc(m.item)}</td><td>${esc(m.qty)}</td><td>${esc(m.unit || "")}</td><td>${esc(m.unit_cost)}</td><td>${money((+m.qty || 0) * (+m.unit_cost || 0))}</td><td><button class="btn ghost sm" type="button" data-rmm="${i}">Remove</button></td></tr>`).join("")}
        <tr><td><input data-mi="item" placeholder="For example: native seed" aria-label="Material"></td><td><input data-mi="qty" type="number" min="0" step="any" style="width:5rem" aria-label="Quantity"></td><td><input data-mi="unit" placeholder="lb" style="width:5rem" aria-label="Unit"></td><td><input data-mi="unit_cost" type="number" min="0" step="any" style="width:6rem" aria-label="Unit cost"></td><td></td><td><button class="btn ghost sm" type="button" data-addm>Add</button></td></tr></tbody></table></div>
      <p class="l-src">Materials and the labor rate are set by the supervisor. Crews do not record costs.</p>
      <div class="row">${dv ? `<a class="btn" href="#tool/visit/${dv.id}">Open the Visit Sheet</a>` : `<button class="btn" type="button" data-rec>Open the Visit Sheet</button>`}<button class="btn ghost" type="button" data-sendpv>Send to phone</button>
        ${after ? `<a href="#tool/plan/${s.id}/${p.year}">Edit this VTS's plan →</a>` : dv ? "" : `<button class="btn ghost sm" type="button" data-rmv>Remove the visit</button>`}</div>
    </section>`;
  }
  /* show a record in a box without redrawing the page; scroll only to bring it into view */
  function showRec(box, s, p, pv, year) {
    if (!box || !pv) return;
    box.innerHTML = recordHtml(s, p, pv);
    wireVisitRow(s, p, q("[data-pvrow]", box), year);
    const r = box.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight - 80) box.scrollIntoView({block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  }
  function wireVisitRow(s, p, det, year) {
    const id = det.dataset.pvrow, edit = (fn, what, need) => { openRec = id; changePlan(s, p, clone(p.planned_visits).map(v => v.id === id ? fn(v) : v), what, need); };
    const re = () => { openRec = id; redraw(s, year); };
    q("[data-f=date]", det).onchange = e => edit(v => (v.date = e.target.value, v), "Visit date changed");
    q("[data-f=type]", det).onchange = e => edit(v => (v.type = e.target.value, v), "Visit type changed");
    ["est_crew", "est_hours"].forEach(f => q(`[data-f=${f}]`, det).onchange = e => { const pv = p.planned_visits.find(v => v.id === id); pv[f] = e.target.value === "" ? null : +e.target.value; St.persist(); re(); });
    q("[data-addm]", det).onclick = () => {
      const g = n => q(`[data-mi=${n}]`, det).value.trim(); if (!g("item")) return;
      const pv = p.planned_visits.find(v => v.id === id); pv.materials = [...(pv.materials || []), {item: g("item"), qty: +g("qty") || 0, unit: g("unit"), unit_cost: +g("unit_cost") || 0}]; St.persist(); re();
    };
    qa("[data-rmm]", det).forEach(b => b.onclick = () => { const pv = p.planned_visits.find(v => v.id === id); pv.materials.splice(+b.dataset.rmm, 1); St.persist(); re(); });
    const rec = q("[data-rec]", det); if (rec) rec.onclick = () => { const v = startVisit(s, p.planned_visits.find(x => x.id === id)); location.hash = "#tool/visit/" + v.id; };
    const snd = q("[data-sendpv]", det); if (snd) snd.onclick = () => { const pv = p.planned_visits.find(x => x.id === id); sendDlg(s, {date: pv.date, type: pv.type, planned_id: pv.id, tasks_planned: [...chosen(s.type, pv), ...pv.extra_tasks.map(keyOf)]}); };
    const rm = q("[data-rmv]", det); if (rm) rm.onclick = () => { openRec = null; changePlan(s, p, clone(p.planned_visits).filter(v => v.id !== id), "Visit removed", true); };
    const cl = q("[data-recclose]", det); if (cl) cl.onclick = () => { openRec = null; det.parentElement.innerHTML = ""; };
  }

  /* ================= Yearly plan: overview of all VTS (rows) by month ================= */
  const SYM = {done: "✓", plan: "○", late: "!"}, WORD = {done: "Done", plan: "Planned", late: "Overdue"};
  function vStatus(s, pv) { return doneVisit(s, pv) ? "done" : pv.date < K().today() ? "late" : "plan"; }
  const chipOf = st => `<span class="o-key o-${st}"><span aria-hidden="true">${SYM[st]}</span> ${WORD[st]}</span>`;
  const shortDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric"});
  function overview(yearArg) {
    const year = +yearArg || yearNow();
    after = () => overview(year);
    const sites = St.sites().filter(x => x.status !== "decommissioned" || (x.decommissioned && x.decommissioned.date.slice(0, 4) >= String(year)));
    const years = [...new Set([...St.data.annual_plans.map(x => x.year), yearNow(), yearNow() + 1])].sort();
    const monthCost = Array(12).fill(0), count = {done: 0, plan: 0, late: 0};
    let rowsHtml = "";
    sites.forEach(s => {
      const p = St.planOf(s.id, year), pvs = p ? p.planned_visits.slice().sort((a, b) => a.date.localeCompare(b.date)) : [];
      const extra = St.visitsOf(s.id).filter(v => v.status === "closed" && v.date.slice(0, 4) === String(year) && !pvs.some(pv => pv.id === v.planned_id || pv.date === v.date));
      const cells = Array.from({length: 12}, () => []);
      pvs.forEach(pv => {
        const st = vStatus(s, pv), c = estCost(pv), n = [...chosen(s.type, pv), ...pv.extra_tasks].length, m = +pv.date.slice(5, 7) - 1;
        count[st]++; monthCost[m] += c.total;
        const sum = `${pv.type} visit · ${shortDate(pv.date)} · ${n} task${n === 1 ? "" : "s"} · ${rate() ? "estimated " + money(c.total) : "Set a labor rate to see the cost"}`;
        cells[m].push(`<button type="button" class="o-chip o-${st}" data-site="${s.id}" data-pv="${pv.id}" aria-label="${esc(WORD[st] + ": " + sum)}"><span aria-hidden="true">${SYM[st]} ${+pv.date.slice(8)}</span><span class="o-tip" aria-hidden="true">${esc(WORD[st])} · ${esc(sum)}</span></button>`);
      });
      extra.forEach(v => { count.done++; cells[+v.date.slice(5, 7) - 1].push(`<a class="o-chip o-done o-extra" href="#tool/visit/${v.id}" aria-label="${esc(`Done: ${v.type} visit · ${shortDate(v.date)} · not in the plan`)}"><span aria-hidden="true">✓ ${+v.date.slice(8)}</span><span class="o-tip" aria-hidden="true">Done · ${esc(v.type)} visit · ${esc(shortDate(v.date))} · not in the plan</span></a>`); });
      rowsHtml += `<tr><th class="g-t" scope="row"><span class="sdot" style="background:${K().COLOR[s.type]}"></span><a href="#tool/vts/${s.id}">${esc(s.name)}</a><br><span class="l-src">${esc(K().NAME[s.type])}${p ? (p.status === "approved" ? " · approved" : " · draft") : ""}</span>
          ${p ? "" : `<br><a class="l-src" href="#tool/plan/${s.id}/${year}">No plan for ${year}. Create it →</a>`}</th>${cells.map(c => `<td class="o-c">${c.join("")}</td>`).join("")}</tr>`;
    });
    K().view().innerHTML = `<div class="l-row"><h2 style="margin:0">Yearly plan</h2><span class="l-sp"></span>
        <label class="l-lab">Year <select id="oYear">${years.map(y => `<option${y === year ? " selected" : ""}>${y}</option>`).join("")}</select></label>
        <label class="l-lab">Labor rate <input type="number" min="0" step="1" id="pRate" value="${rate() ?? ""}" placeholder="$ per person-hour" style="width:9rem"></label></div>
      <p class="l-src">All your VTS in ${year}: ${count.done} done, ${count.plan} planned, ${count.late} overdue. Status uses today's date (${esc(K().today())}). Point at a visit for a summary; select it to open its record below.</p>
      <div class="scroll g-wrap"><table class="g-tab o-grid"><caption class="vh">Visits of every VTS by month in ${year}</caption>
        <thead><tr><th class="g-t" scope="col">VTS</th>${MONTHS.map(m => `<th scope="col">${m}</th>`).join("")}</tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="13">No VTS yet. <a href="#tool/vts/new">Register a system</a>.</td></tr>`}
          <tr class="o-cost"><th class="g-t" scope="row">Estimated cost <span class="l-chip r">Sample data</span>${rate() ? "" : `<br><span class="l-src">Materials only: set a labor rate</span>`}</th>${monthCost.map(c => `<td>${c ? money(c) : ""}</td>`).join("")}</tr></tbody></table></div>
      <p class="d-legend">${["done", "plan", "late"].map(chipOf).join(" ")} <span class="l-src">The number is the day of the month.</span></p>
      <div id="oRec">${openRec ? (() => { const f = findPv(openRec); return f ? recordHtml(f.s, f.p, f.pv) : ""; })() : ""}</div>`;
    q("#oYear").onchange = e => { openRec = null; location.hash = `#tool/plan/all/${e.target.value}`; };
    q("#pRate").onchange = e => { St.data.organization.labor_rate = e.target.value === "" ? null : +e.target.value; St.persist(); overview(year); };
    qa(".o-chip[data-pv]").forEach(b => {
      b.onclick = () => { const f = findPv(b.dataset.pv); if (!f) return; openRec = f.pv.id; showRec(q("#oRec"), f.s, f.p, f.pv, year); };
      b.onkeydown = e => { if (e.key === "Escape") b.classList.add("o-hide"); };
      b.onblur = () => b.classList.remove("o-hide");
    });
    const box = q("#oRec [data-pvrow]"); if (box) { const f = findPv(openRec); wireVisitRow(f.s, f.p, box, year); }
  }
  function findPv(id) {
    for (const p of St.data.annual_plans) { const pv = p.planned_visits.find(x => x.id === id); if (pv) return {s: St.site(p.site), p, pv}; }
    return null;
  }

  /* ================= Visit Sheet ================= */
  function startVisit(s, pv) {
    const id = `V-${s.id.replace(/^S-/, "")}-${pv.date}-${Date.now().toString(36).slice(-4)}`;
    const v = {id, site: s.id, date: pv.date, type: pv.type, status: "draft", planned_id: pv.id, crew_size: null, hours_on_site: null, hours_crew_total: null, last_rain: null,
      tasks_planned: [...chosen(s.type, pv), ...pv.extra_tasks.map(x => x.task || "+" + x.text)], tasks_done: [], mowing: null, invasive_removed: [], photos: [], all_photo_points_taken: null,
      notes: "", supervisor_role: "supervisor", sign_off: null, form: {items: {}, water: {kit: "strip-n"}, water_at_inlet: null}};
    St.put("visits", v); return v;
  }
  function visit(id) {
    const v = St.visit(id);
    if (!v) { K().view().innerHTML = `<p>Visit not found. <a href="#tool/plan">Back to the plan</a></p>`; return; }
    const s = St.site(v.site);
    if (v.status === "closed") return closedView(s, v);
    renderForm(s, v, {mode: "tool", box: () => K().view(), save: () => St.put("visits", v), again: () => visit(id)});
  }
  /* The Visit Sheet form. o.mode "tool" (supervisor, store) or "phone" (field page, saved on the phone). */
  function renderForm(s, v, o) {
    const id = v.id, phone = o.mode === "phone";
    const f = v.form = v.form || {items: {}, water: {kit: "strip-n"}};
    const chkType = v.type === "Spring" ? "Routine" : v.type;
    const items = L.checklist.filter(i => i.sys === s.type && i.vis.includes(chkType));
    const nitrate = nitrateSys(s.type), kit = KITS[f.water.kit || "strip-n"], pp = (s.params || {}).photo_points;
    const mowTask = v.tasks_planned.some(t => /_T03$/.test(t) && /Vegetation Maintenance/.test((taskBy(t) || {}).name || ""));
    let sec = "";
    o.box().innerHTML = `
      ${phone ? "" : `<p><a href="#tool/plan/${s.id}/${v.date.slice(0, 4)}">← Yearly plan</a> · <a href="#tool/visits">← Next visits</a></p>`}
      <div class="t-card"><div class="t-band" style="background:${K().COLOR[s.type]}"><span>Visit Sheet · ${esc(s.type)}_F04</span><span class="l-sp"></span><span class="l-chip y">${phone ? "On this phone" : "Draft"}</span></div>
      <form id="vf" class="t-head stack" novalidate>
        <h2 class="l-title" style="margin:0">${esc(s.name)}</h2>
        <div class="grid3"><div class="f"><label>Date</label><input type="date" name="date" value="${v.date}"></div>
          <div class="f"><label>Visit type</label><select name="type">${TYPES.map(t => `<option${t === v.type ? " selected" : ""}>${t}</option>`).join("")}</select></div>
          <div class="f"><label>Last rain (date, inches)</label><div class="l-row"><input type="date" name="rain_date" value="${v.last_rain?.date || ""}" style="flex:1"><input type="number" step="0.1" min="0" name="rain_in" value="${v.last_rain?.amount_in ?? ""}" style="width:6rem" aria-label="Rain amount, inches"></div></div></div>
        ${ON_SITE.includes(v.type) ? `<fieldset><legend>Did water reach the inlet and move through the whole system, with no shortcuts?</legend>${yn("water_at_inlet", f.water_at_inlet)}</fieldset>` : ""}
        <fieldset><legend>Tasks of this visit (mark what was done)</legend>${v.tasks_planned.map(t => `<label class="check"><input type="checkbox" name="task" value="${esc(t)}"${v.tasks_done.includes(t) ? " checked" : ""}> ${t[0] === "+" ? `<span class="l-chip y">Extra</span> ${esc(t.slice(1))}` : taskLink(t)}</label>`).join("") || '<p class="l-src">No tasks planned.</p>'}</fieldset>
        ${mowTask ? `<fieldset><legend>Mowing record</legend><p class="l-src">Designated mowing areas: ${esc((s.params || {}).designated_mowing_areas || "not set in Site Conditions")}</p>
          <div class="f"><label>Areas mowed</label><input name="mow_areas" value="${esc((v.mowing?.areas || []).join("; "))}" placeholder="Berms, access paths, other"></div>
          <p>At the target height?</p>${yn("mow_target", v.mowing?.at_target_height)}<label class="check"><input type="checkbox" name="mow_photo"${v.mowing?.photo ? " checked" : ""}> Photo taken (the area looks different from the last visit)</label></fieldset>` : ""}
        ${items.length ? `<h3>Visual inspection checklist</h3>${items.map(i => { const a = f.items[i.id] || {}; const head = i.sec !== sec ? `<h4 class="t-sec">${esc(sec = i.sec)}</h4>` : "";
          return head + `<div class="t-item-q${a.a === "abnormal" ? " ab" : ""}" data-item="${i.id}"><p><b>${esc(i.q)}</b> <span class="l-src">${i.id}</span></p><p class="l-src">${esc(i.look)}</p>
            <div class="t-seg" role="group" aria-label="Answer">${[["ok", "OK"], ["abnormal", "Abnormal"], ["na", "N/A"]].map(([k, n]) => `<button type="button" data-ans="${k}" aria-pressed="${a.a === k}">${n}</button>`).join("")}</div>
            ${a.a === "abnormal" ? `<p class="l-warn"><b>If abnormal:</b> ${esc(i.ab)}</p><div class="grid2"><div class="f"><label>Location in the system</label><input data-k="loc" value="${esc(a.loc || "")}"></div><div class="f"><label>Notes</label><input data-k="note" value="${esc(a.note || "")}"></div></div>
              <label class="check"><input type="checkbox" data-k="photo"${a.photo ? " checked" : ""}> Photo taken${i.photo ? " (required for this item)" : ""}</label><label class="check"><input type="checkbox" data-k="fixed"${a.fixed ? " checked" : ""}> Fixed now (small fix)</label>
              ${BURROW_ITEMS.includes(i.id) ? `<div class="grid3"><div class="f"><label>About how many burrows</label><select data-k="count">${["", "none", "1 to 5", "more than 5"].map(o => `<option${a.count === o ? " selected" : ""}>${o}</option>`).join("")}</select></div>
                <div class="f"><label>Do they look in use?</label><select data-k="use">${["", "looks in use", "does not look in use", "not sure"].map(o => `<option${a.use === o ? " selected" : ""}>${o}</option>`).join("")}</select></div>
                <div class="f"><label>Since the last visit</label><select data-k="trend">${["", "more", "fewer", "about the same", "first time"].map(o => `<option${a.trend === o ? " selected" : ""}>${o}</option>`).join("")}</select></div></div>` : ""}
              ${i.go.length ? `<p class="l-src">Go to: ${i.go.map(taskLink).join(" · ")}</p>` : ""}` : ""}</div>`; }).join("")}` : (v.type === "January review" ? `<p class="l-src">Office review: no checklist.</p>` : "")}
        ${v.type === "Spring" ? `<fieldset class="t-req"><legend>Spring visit: water check <span class="l-chip r">Required items marked</span></legend>
          <div class="grid2"><div><p>Water flowing at the inlet?</p>${yn("flow_in", f.water.flow_in)}</div><div><p>Water flowing at the outlet?</p>${yn("flow_out", f.water.flow_out)}</div></div>
          <p><b>Required.</b> Jar comparison: is the outlet jar clearer than the inlet jar?</p>${yn("jar", f.water.jar)}<label class="check"><input type="checkbox" name="jar_photo"${f.water.jar_photo ? " checked" : ""}> Photo of both jars side by side (required)</label>
          ${nitrate ? `<div class="f"><label>Kit or instrument</label><select name="kit">${Object.entries(KITS).map(([k, x]) => `<option value="${k}"${(f.water.kit || "strip-n") === k ? " selected" : ""}>${esc(x.name)} (${esc(x.range)})</option>`).join("")}</select></div>
            <div class="grid2">${["in", "out"].map(pt => `<div class="panel"><p><b>Required.</b> Nitrate at the ${pt === "in" ? "inlet" : "outlet"}</p>
              ${kit.blocks ? `<div class="f"><label>Closest color block</label><select name="${pt}_val"><option value=""></option>${kit.blocks.map(b => `<option${String(f.water[pt + "_val"]) === String(b) ? " selected" : ""}>${b}</option>`).join("")}</select></div>`
                           : `<div class="f"><label>Reading</label><input type="number" step="0.1" min="0" name="${pt}_val" value="${esc(f.water[pt + "_val"] ?? "")}"></div>`}
              <div class="f"><label>Unit, exactly as printed on the kit</label><input name="${pt}_unit" value="${esc(f.water[pt + "_unit"] || kit.unit)}"></div>
              <div class="f"><label>Time</label><input type="time" name="${pt}_time" value="${esc(f.water[pt + "_time"] || "")}"></div>
              <label class="check"><input type="checkbox" name="${pt}_photo"${f.water[pt + "_photo"] ? " checked" : ""}> Photo ${kit.blocks ? "of the strip next to its color scale" : "of the reading"} (required)</label></div>`).join("")}</div>
            <p class="l-src">Method: ${esc(kit.method)}. Do not convert units in the field. NO3 = NO3-N × 4.43.</p>
            <div class="f"><label>Laboratory pair this year (once a year)</label><select name="lab">${["", "sent", "not done this year"].map(o => `<option${f.water.lab === o ? " selected" : ""}>${o}</option>`).join("")}</select></div>` : `<p class="l-src">A sediment basin is not built to remove nitrate: flow and clarity only.</p>`}</fieldset>` : ""}
        <fieldset><legend>Before you leave</legend>
          ${ON_SITE.includes(v.type) ? `<label class="check"><input type="checkbox" name="pp"${v.all_photo_points_taken ? " checked" : ""}> Overview photos taken from all photo points${pp ? ` (${pp.count}: ${esc(pp.where)})` : ""} <span class="l-chip r">Required</span></label>` : ""}
          <div class="grid3"><div class="f"><label>Crew size</label><input type="number" min="1" name="crew" value="${v.crew_size ?? ""}"></div><div class="f"><label>Hours on site</label><input type="number" min="0" step="0.25" name="hours" value="${v.hours_on_site ?? ""}"></div></div>
          <div class="f"><label>What was done; observations</label><textarea name="notes">${esc(v.notes || "")}</textarea></div></fieldset>
        <div id="vMissing"></div>
        ${phone ? `<div class="row"><button class="btn" type="button" id="vClose">Finish and send back</button><span class="l-src">Saved on this phone as you go.</span></div>`
                : `<div class="row"><button class="btn" type="button" id="vClose">Close the visit</button><button class="btn ghost" type="button" id="vSend">Send to phone</button><label class="btn ghost" for="vImp">Import results from the phone</label><input type="file" id="vImp" accept=".json,application/json" hidden><button class="btn ghost" type="button" id="vDel">Delete this draft</button></div><p class="l-src">Saved as you go (draft).</p><div id="vImpMsg"></div>`}
      </form></div>`;
    const root = o.box(), form = q("#vf", root), Q = sel => q(sel, root);
    const save = () => { readForm(v, form); o.save(); };
    form.addEventListener("change", e => { if (e.target.id === "vImp") return; save(); if (e.target.name === "type" || e.target.name === "kit") o.again(); });
    form.addEventListener("input", e => { if (e.target.matches("input[type=text],input:not([type]),textarea,input[type=number]")) save(); });
    qa("[data-ans]", form).forEach(b => b.onclick = () => { const it = b.closest("[data-item]").dataset.item; f.items[it] = {...(f.items[it] || {}), a: b.dataset.ans}; save(); o.again(); });
    qa("[data-yn]", form).forEach(b => b.onclick = () => { const k = b.dataset.yn, val = b.dataset.v === "yes"; setYn(v, k, val); o.save(); o.again(); });
    const miss = () => { const m = missing(s, v); if (!m.length) return false; Q("#vMissing").innerHTML = `<div class="l-warn"><b>Before ${phone ? "sending" : "closing"}, complete:</b><ul>${m.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`; Q("#vMissing").scrollIntoView({block: "center"}); return true; };
    if (phone) { Q("#vClose").onclick = () => { save(); if (!miss()) o.finish(); }; return; }
    Q("#vDel").onclick = () => { if (confirm("Delete this draft visit?")) { St.remove("visits", id); location.hash = `#tool/plan/${s.id}/${v.date.slice(0, 4)}`; } };
    Q("#vClose").onclick = () => { save(); if (miss()) return; closeVisit(s, v); visit(id); };
    Q("#vSend").onclick = () => sendDlg(s, v);
    Q("#vImp").onchange = e => importResults(s, v, e.target.files[0]);
  }
  const yn = (k, val) => `<span class="t-seg" role="group">${[["yes", "Yes"], ["no", "No"]].map(([x, n]) => `<button type="button" data-yn="${k}" data-v="${x}" aria-pressed="${val === (x === "yes")}">${n}</button>`).join("")}</span>`;
  function setYn(v, k, val) {
    const f = v.form;
    if (k === "water_at_inlet") f.water_at_inlet = val;
    else if (k === "mow_target") v.mowing = {...(v.mowing || {areas: [], photo: null}), at_target_height: val};
    else f.water[k] = val;
  }
  function readForm(v, form) {
    const val = n => form.elements[n] ? form.elements[n].value : undefined, chk = n => form.elements[n] ? form.elements[n].checked : undefined;
    v.date = val("date") || v.date; v.type = val("type") || v.type;
    v.last_rain = val("rain_date") ? {date: val("rain_date"), amount_in: parseFloat(val("rain_in")) || 0} : null;
    v.tasks_done = qa("input[name=task]", form).filter(c => c.checked).map(c => c.value);
    if (form.elements.mow_areas) v.mowing = {...(v.mowing || {}), areas: val("mow_areas").split(";").map(x => x.trim()).filter(Boolean), photo: chk("mow_photo") ? `PH-${v.id}-mow` : null, at_target_height: v.mowing?.at_target_height ?? null};
    qa("[data-item]", form).forEach(box => { const it = box.dataset.item, a = v.form.items[it]; if (!a) return; qa("[data-k]", box).forEach(i => { a[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value; }); });
    const w = v.form.water;
    ["kit", "in_val", "out_val", "in_unit", "out_unit", "in_time", "out_time", "lab"].forEach(n => { if (form.elements[n]) w[n] = val(n); });
    ["jar_photo", "in_photo", "out_photo"].forEach(n => { if (form.elements[n]) w[n] = chk(n); });
    if (form.elements.pp) v.all_photo_points_taken = chk("pp");
    v.crew_size = parseInt(val("crew"), 10) || null; v.hours_on_site = parseFloat(val("hours")) || null;
    v.hours_crew_total = v.crew_size && v.hours_on_site ? Math.round(v.crew_size * v.hours_on_site * 100) / 100 : null;
    v.notes = val("notes") || "";
  }
  function missing(s, v) {
    const m = [], w = v.form.water, nitrate = nitrateSys(s.type);
    if (ON_SITE.includes(v.type) && !v.all_photo_points_taken) m.push("Overview photos from all photo points");
    if (v.type === "Spring") {
      if (w.jar === undefined || w.jar === null) m.push("Jar comparison answer (yes / no)");
      if (!w.jar_photo) m.push("Photo of the two jars");
      if (nitrate) ["in", "out"].forEach(pt => { const n = pt === "in" ? "inlet" : "outlet";
        if (w[pt + "_val"] === undefined || w[pt + "_val"] === "") m.push(`Nitrate reading at the ${n}`);
        if (!w[pt + "_unit"]) m.push(`Unit at the ${n}, as printed on the kit`);
        if (!w[pt + "_photo"]) m.push(`Photo of the ${n} reading`); });
    }
    return m;
  }
  function closeVisit(s, v) {
    const f = v.form, at = new Date().toISOString().slice(0, 19), role = (St.session() || {}).role || "crew";
    const mid = () => St.nextId("measurements", `M-${v.id.slice(2)}-`), oid = () => St.nextId("observations", `O-${v.id.slice(2)}-`);
    const meas = (ind, par, value, extra = {}) => St.add("measurements", {id: mid(), visit: v.id, indicator: ind, parameter: par, point: null, value_as_entered: String(value), unit_as_entered: null, method: "visual",
      instrument_or_kit: null, flow_present: null, sample_time: null, photo: null, recorded_by_role: role, recorded_at: at, ...extra});
    if (f.water_at_inlet !== null && f.water_at_inlet !== undefined) meas("IND-01", "water_at_inlet_no_shortcuts", f.water_at_inlet ? "yes" : "no");
    Object.entries(f.items).forEach(([item, a]) => {
      if (!a.a) return;
      const o = {id: oid(), visit: v.id, item, answer: a.a, location_in_system: a.loc || null, note: a.note || null, photo: a.a === "abnormal" && a.photo ? `PH-${v.id}-${item}` : null,
                 fixed_now: a.a === "abnormal" ? !!a.fixed : null, burrows: a.count ? {count_range: a.count, in_use: a.use || "not sure", trend: a.trend || "first time"} : null};
      St.add("observations", o);
      if (a.a === "abnormal" && !a.fixed) {
        const it = L.checklist.find(x => x.id === item) || {go: [], q: item};
        St.add("corrective_entries", {id: St.nextId("corrective_entries", "C-NEW-"), site: s.id, visit: v.id, observation: o.id, task: it.go.find(g => /^COR_/.test(g)) || it.go[0] || null, date: v.date,
          finding: `${a.note || it.q} (${item})`, location: a.loc || null, likely_cause: null, action_taken: null, urgency: null, materials_used: null, hours: null, status: "open", resolved_date: null, photos: o.photo ? [o.photo] : []});
      }
    });
    if (v.type === "Spring") {
      const w = f.water, flow = pt => w["flow_" + pt] === undefined ? null : w["flow_" + pt];
      meas("IND-03", "jar_outlet_clearer", w.jar ? "yes" : "no", {photo: `PH-${v.id}-jar`, flow_present: flow("in") && flow("out")});
      if (nitrateSys(s.type)) {
        const kit = KITS[w.kit || "strip-n"];
        ["in", "out"].forEach(pt => meas("IND-04", "nitrate", w[pt + "_val"], {point: pt === "in" ? "inlet" : "outlet", unit_as_entered: w[pt + "_unit"], method: kit.method,
          instrument_or_kit: {name: kit.name, range: kit.range, ...(kit.blocks ? {blocks: kit.blocks} : {})}, flow_present: flow(pt === "in" ? "in" : "out"), sample_time: w[pt + "_time"] || null, photo: `PH-${v.id}-${pt}`}));
        if (w.lab) { const y = +v.date.slice(0, 4), ex = St.data.laboratory_samples.find(l => l.site === s.id && l.year === y);
          if (ex) Object.assign(ex, {status: w.lab, visit: v.id}); else St.add("laboratory_samples", {site: s.id, year: y, status: w.lab, visit: v.id, laboratory: null, report_date: null}); }
      }
    }
    const pp = (s.params || {}).photo_points;
    v.photos = v.all_photo_points_taken && pp ? Array.from({length: pp.count}, (_, k) => ({id: `PH-${v.id}-pp${k + 1}`, photo_point: k + 1, caption: `Overview from photo point ${k + 1}`})) : [];
    delete v.form; delete v.tasks_planned; v.status = "closed"; v.sign_off = {initials: "DEMO", date: K().today()};
    const i = St.data.visits.findIndex(x => x.id === v.id); St.data.visits[i] = v; St.persist();
  }

  /* ---------- closed visit: read-only, corrections with a reason ---------- */
  function closedView(s, v) {
    const obs = St.data.observations.filter(o => o.visit === v.id), ms = St.data.measurements.filter(m => m.visit === v.id), cor = St.data.corrective_entries.filter(c => c.visit === v.id);
    const lab = v.type === "Spring" && nitrateSys(s.type) ? St.data.laboratory_samples.find(l => l.site === s.id && l.year === +v.date.slice(0, 4)) : null;
    const fields = [["crew_size", "Crew size", v.crew_size], ["hours_on_site", "Hours on site", v.hours_on_site], ["notes", "Notes", v.notes]];
    K().view().innerHTML = `
      <p><a href="#tool/plan/${s.id}/${v.date.slice(0, 4)}">← Yearly plan</a></p>
      <div class="t-card"><div class="t-band" style="background:${K().COLOR[s.type]}"><span>Visit Sheet · ${esc(s.type)}_F04</span><span class="l-sp"></span><span class="l-chip g">Closed ${esc(v.sign_off?.date || "")}</span></div>
      <div class="t-head stack"><h2 class="l-title" style="margin:0">${esc(s.name)}</h2><p class="muted">${esc(v.date)} · ${esc(v.type)}${v.last_rain ? ` · last rain ${esc(v.last_rain.date)}, ${v.last_rain.amount_in} in` : ""}</p>
        <p class="l-src">A closed visit is not overwritten. Each correction asks for a reason and stays in the change history.</p>
        <table class="t-kv">${fields.map(([k, n, x]) => `<tr><th>${n}</th><td>${x === null || x === "" || x === undefined ? '<span class="muted">Not recorded</span>' : esc(x)} <button class="btn ghost sm" type="button" data-fix="${k}">Correct</button></td></tr>`).join("")}
          <tr><th>Tasks done</th><td>${(v.tasks_done || []).map(t => t[0] === "+" ? esc(t.slice(1)) : taskLink(t)).join("<br>") || "None marked"}</td></tr>
          <tr><th>Photo points</th><td>${v.all_photo_points_taken ? `all taken (${v.photos.length} photos)` : "not recorded"}</td></tr>
          ${v.mowing ? `<tr><th>Mowing</th><td>${esc((v.mowing.areas || []).join("; ") || "areas not recorded")}; at target height: ${v.mowing.at_target_height === null ? "not recorded" : v.mowing.at_target_height ? "yes" : "no"}</td></tr>` : ""}</table>
        ${ms.length ? `<h3>Measurements</h3><div class="scroll"><table><thead><tr><th>Indicator</th><th>Point</th><th>Value as entered</th><th>Method</th><th></th></tr></thead><tbody>${ms.map(m => `<tr><td>${esc(m.indicator)} ${esc(m.parameter)}</td><td>${esc(m.point || "")}</td><td>${esc(m.value_as_entered)} ${esc(m.unit_as_entered || "")}</td><td>${esc(m.method)}${m.instrument_or_kit ? "<br><span class='l-src'>" + esc(m.instrument_or_kit.name || m.instrument_or_kit.laboratory || "") + "</span>" : ""}</td><td><button class="btn ghost sm" type="button" data-mfix="${m.id}">Correct</button></td></tr>`).join("")}</tbody></table></div>` : ""}
        ${lab ? `<div class="panel"><b>Laboratory pair ${v.date.slice(0, 4)}:</b> ${esc(lab.status)}${lab.status !== "result received" && lab.status !== "not done this year" ? ` <button class="btn sm" type="button" id="vLab">Add the laboratory results</button>` : ""}</div>` : ""}
        ${obs.length ? `<h3>Checklist answers</h3><div class="scroll"><table><thead><tr><th>Item</th><th>Answer</th><th>Location / notes</th><th>Photo</th></tr></thead><tbody>${obs.map(o => `<tr><td>${esc(o.item)}</td><td>${esc(o.answer)}${o.burrows ? `<br><span class="l-src">${esc(o.burrows.count_range)}, ${esc(o.burrows.in_use)}, ${esc(o.burrows.trend)}</span>` : ""}</td><td>${esc([o.location_in_system, o.note].filter(Boolean).join(" · "))}</td><td>${o.photo ? "yes" : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
        ${cor.length ? `<h3>Corrective Maintenance Log (F05) entries from this visit</h3>${cor.map(c => `<p>${esc(c.finding)} <span class="l-chip ${c.status === "open" ? "y" : "g"}">${esc(c.status)}</span></p>`).join("")}` : ""}
        ${histOf([v.id, ...ms.map(m => m.id)])}
      </div></div>`;
    qa("[data-fix]").forEach(b => b.onclick = () => correct(`Correct: ${b.closest("tr").firstChild.textContent}`, v[b.dataset.fix], b.dataset.fix === "notes" ? "text" : "number", (val, reason, cat) => {
      const patch = {[b.dataset.fix]: b.dataset.fix === "notes" ? val : (val === "" ? null : +val)};
      if (b.dataset.fix !== "notes") { const c = b.dataset.fix === "crew_size" ? patch.crew_size : v.crew_size, h = b.dataset.fix === "hours_on_site" ? patch.hours_on_site : v.hours_on_site; patch.hours_crew_total = c && h ? Math.round(c * h * 100) / 100 : null; }
      St.update("visits", v.id, patch, reason, cat); visit(v.id); }));
    qa("[data-mfix]").forEach(b => b.onclick = () => { const m = ms.find(x => x.id === b.dataset.mfix);
      const kind = ["jar_outlet_clearer", "water_at_inlet_no_shortcuts"].includes(m.parameter) ? ["yes", "no"]
                 : m.method === "test strip" && m.instrument_or_kit && m.instrument_or_kit.blocks ? m.instrument_or_kit.blocks.map(String) : "number";
      correct(`Correct the value of ${m.indicator} ${m.parameter}${m.point ? " (" + m.point + ")" : ""}`, m.value_as_entered, kind, (val, reason, cat) => { St.update("measurements", m.id, {value_as_entered: String(val)}, reason, cat); visit(v.id); }); });
    if (q("#vLab")) q("#vLab").onclick = () => labDlg(s, v, lab);
  }
  function histOf(ids) {
    const h = St.data.revisions.filter(r => ids.includes(r.record_id)).slice().reverse();
    return `<h3>Change history</h3>${h.length ? `<div class="scroll"><table><thead><tr><th>When</th><th>Record</th><th>Change</th><th>Reason</th><th>By</th></tr></thead><tbody>${h.map(r => `<tr><td>${esc(r.when.slice(0, 16).replace("T", " "))}</td><td>${esc(r.record_type)} ${esc(r.record_id)}</td><td>${esc(r.field)}: ${esc(sh(r.old_value))} → ${esc(sh(r.new_value))}</td><td>${esc(r.reason)}${r.category ? ` (${esc(r.category)})` : ""}</td><td>${esc(r.who_role)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No changes recorded.</p>`}`;
  }
  const sh = x => x === null || x === undefined ? "none" : Array.isArray(x) ? `${x.length} item(s)` : typeof x === "object" ? "changed" : String(x);
  function reasonCat(title, done, cancel) {
    K().openDlg(`<h3>${esc(title)}</h3><form id="rcF" class="stack"><div class="f"><label for="rcR">Reason (required)</label><textarea id="rcR" required></textarea></div>
      <div class="f"><label for="rcC">Kind of change (optional)</label><select id="rcC"><option value="">—</option>${CATS.map(c => `<option>${c}</option>`).join("")}</select></div>
      <div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    qa("#toolDlg [data-close]").forEach(b => b.onclick = () => { q("#toolDlg").close(); if (cancel) cancel(); });
    q("#rcF").onsubmit = e => { e.preventDefault(); const r = q("#rcR").value.trim(); if (!r) return; q("#toolDlg").close(); done(r, q("#rcC").value || null); };
  }
  function correct(title, cur, kind, done) {
    K().openDlg(`<h3>${esc(title)}</h3><form id="cF" class="stack"><p class="l-src">Current value: ${esc(cur ?? "not recorded")}</p>
      <div class="f"><label for="cV">New value</label>${Array.isArray(kind) ? `<select id="cV">${kind.map(o => `<option${String(cur) === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : kind === "text" ? `<input id="cV" value="${esc(cur ?? "")}">` : `<input id="cV" type="number" step="any" min="0" required value="${esc(cur ?? "")}">`}</div>
      <div class="f"><label for="cR">Why are you changing it? (required)</label><textarea id="cR" required></textarea></div>
      <div class="f"><label for="cC">Kind of change (optional)</label><select id="cC"><option value="">—</option>${CATS.map(c => `<option>${c}</option>`).join("")}</select></div>
      <div class="row"><button class="btn" type="submit">Save the correction</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    q("#cF").onsubmit = e => { e.preventDefault(); const r = q("#cR").value.trim(); if (!r) return; q("#toolDlg").close(); done(q("#cV").value, r, q("#cC").value || null); };
  }
  function labDlg(s, v, lab) {
    K().openDlg(`<h3>Laboratory results, ${v.date.slice(0, 4)}</h3><form id="lbF" class="stack"><p class="l-src">From the laboratory report. These are the performance check.</p>
      <div class="grid2"><div class="f"><label>Laboratory</label><input id="lbN" required></div><div class="f"><label>Report date</label><input type="date" id="lbD" required></div>
        <div class="f"><label>Nitrate, inlet</label><input type="number" step="0.01" id="lbI" required></div><div class="f"><label>Nitrate, outlet</label><input type="number" step="0.01" id="lbO" required></div>
        <div class="f"><label>Unit, as on the report</label><input id="lbU" value="mg/L NO3-N" required></div></div>
      <div class="grid2"><div class="f"><label>Turbidity, inlet (NTU, if measured)</label><input type="number" step="0.1" id="lbTI"></div><div class="f"><label>Turbidity, outlet (NTU, if measured)</label><input type="number" step="0.1" id="lbTO"></div></div>
      <div class="row"><button class="btn" type="submit">Save the results</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    q("#lbF").onsubmit = e => {
      e.preventDefault();
      const kit = {name: q("#lbN").value, laboratory: q("#lbN").value, report_date: q("#lbD").value}, at = q("#lbD").value + "T09:00:00";
      const add = (par, pt, val, unit) => St.add("measurements", {id: St.nextId("measurements", `M-${v.id.slice(2)}-L`), visit: v.id, indicator: "IND-05", parameter: par, point: pt, value_as_entered: String(val), unit_as_entered: unit,
        method: "laboratory", instrument_or_kit: kit, flow_present: null, sample_time: null, photo: null, recorded_by_role: "laboratory", recorded_at: at});
      add("nitrate", "inlet", q("#lbI").value, q("#lbU").value); add("nitrate", "outlet", q("#lbO").value, q("#lbU").value);
      if (q("#lbTI").value) add("turbidity", "inlet", q("#lbTI").value, "NTU"); if (q("#lbTO").value) add("turbidity", "outlet", q("#lbTO").value, "NTU");
      Object.assign(lab, {status: "result received", laboratory: kit.laboratory, report_date: kit.report_date}); St.persist();
      q("#toolDlg").close(); visit(v.id);
    };
  }
  /* ================= Next visits: calendar and table ================= */
  function openPlanned() {
    const t = K().today(), y = +t.slice(0, 4), out = [];
    St.sites().filter(s => s.status !== "decommissioned").forEach(s => St.data.annual_plans.filter(p => p.site === s.id).forEach(p => p.planned_visits.forEach(pv => {
      const rec = St.visitsOf(s.id).find(v => v.planned_id === pv.id || (v.date === pv.date && v.type === pv.type) || v.date === pv.date);
      if (rec && rec.status === "closed") return;
      const status = rec ? "In progress" : pv.date < t ? "Overdue" : "Planned";
      if (status === "Overdue" && pv.date.slice(0, 4) !== String(y)) return;
      out.push({s, p, pv, rec, status});
    })));
    return out.sort((a, b) => a.pv.date.localeCompare(b.pv.date));
  }
  function upcoming() {
    const horizon = new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10);
    return openPlanned().filter(x => x.status !== "Planned" || x.pv.date <= horizon);
  }
  const cal = {y: null, m: null, day: null, site: ""};
  const pad = n => String(n).padStart(2, "0");
  function next(filter) {
    if (filter !== undefined) cal.site = filter || "";
    const t = K().today();
    if (cal.y === null) { cal.y = +t.slice(0, 4); cal.m = +t.slice(5, 7) - 1; }
    const all = openPlanned().filter(x => !cal.site || x.s.id === cal.site);
    const list = cal.day ? all.filter(x => x.pv.date === cal.day) : upcoming().filter(x => !cal.site || x.s.id === cal.site);
    const sites = St.sites().filter(s => s.status !== "decommissioned");
    const perDay = {}; all.forEach(x => { perDay[x.pv.date] = (perDay[x.pv.date] || 0) + 1; });
    const first = new Date(cal.y, cal.m, 1), days = new Date(cal.y, cal.m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;   /* weeks start on Monday */
    const focusDay = cal.day && cal.day.slice(0, 7) === `${cal.y}-${pad(cal.m + 1)}` ? cal.day : t.slice(0, 7) === `${cal.y}-${pad(cal.m + 1)}` ? t : `${cal.y}-${pad(cal.m + 1)}-01`;
    let cells = Array(lead).fill(`<td role="gridcell"></td>`);
    for (let d = 1; d <= days; d++) {
      const iso = `${cal.y}-${pad(cal.m + 1)}-${pad(d)}`, n = perDay[iso] || 0, late = all.some(x => x.pv.date === iso && x.status === "Overdue");
      cells.push(`<td role="gridcell"><button type="button" class="c-day${n ? " has" : ""}${late ? " late" : ""}${iso === t ? " today" : ""}" data-day="${iso}" aria-pressed="${iso === cal.day}" tabindex="${iso === focusDay ? 0 : -1}"
        aria-label="${new Date(iso + "T12:00:00").toLocaleDateString("en-US", {weekday: "long", month: "long", day: "numeric"})}${n ? `, ${n} visit${n > 1 ? "s" : ""}` : ", no visits"}${iso === t ? ", today" : ""}">${d}${n ? `<span class="c-n" aria-hidden="true">${n}</span>` : ""}</button></td>`);
    }
    while (cells.length % 7) cells.push(`<td role="gridcell"></td>`);
    const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(`<tr role="row">${cells.slice(i, i + 7).join("")}</tr>`);
    const monthName = first.toLocaleDateString("en-US", {month: "long", year: "numeric"});
    K().view().innerHTML = `<div class="l-row"><h2 style="margin:0">Next visits</h2><span class="l-sp"></span>
        <label class="l-lab">VTS <select id="nSite"><option value="">All</option>${sites.map(s => `<option value="${s.id}"${s.id === cal.site ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
      <div class="c-wrap">
        <div class="c-cal panel"><div class="l-row c-head"><button class="btn ghost sm" type="button" id="cPrev" aria-label="Previous month">‹</button><b id="cTitle" aria-live="polite">${esc(monthName)}</b><button class="btn ghost sm" type="button" id="cNext" aria-label="Next month">›</button></div>
          <table role="grid" class="c-grid" aria-labelledby="cTitle"><thead><tr role="row">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => `<th role="columnheader" scope="col">${d}</th>`).join("")}</tr></thead><tbody>${weeks.join("")}</tbody></table>
          <p class="l-src">A number marks the visits that day; a red edge, an overdue one. Arrow keys move between days.</p></div>
        <div class="stack">
          <p class="muted">${cal.day ? `Visits on ${esc(new Date(cal.day + "T12:00:00").toLocaleDateString("en-US", {weekday: "long", month: "long", day: "numeric", year: "numeric"}))}. <button class="rg-jump" type="button" id="cAll">Show the next four months</button>` : "Planned visits for the next four months, and any planned visit not recorded yet."}</p>
          <div class="scroll"><table class="c-tab"><thead><tr><th>Date</th><th>VTS</th><th>Visit</th><th>Tasks</th><th>Who</th><th>Status</th><th><span class="vh">Actions</span></th></tr></thead><tbody>
            ${list.map(x => { const tasks = [...chosen(x.s.type, x.pv), ...x.pv.extra_tasks.map(e => e.task || "+" + e.text)];
              return `<tr><td>${esc(shortDate(x.pv.date))}<br><span class="l-src">${esc(x.pv.date.slice(0, 4))}</span></td><td><span class="sdot" style="background:${K().COLOR[x.s.type]}"></span><a href="#tool/vts/${x.s.id}">${esc(x.s.name)}</a></td>
                <td>${esc(x.pv.type)}${x.p.status === "draft" ? '<br><span class="l-src">plan still a draft</span>' : ""}</td>
                <td><details><summary>${tasks.length} task${tasks.length === 1 ? "" : "s"}</summary><ul class="t-tasks">${tasks.map(k => `<li>${k[0] === "+" ? esc(k.slice(1)) : taskLink(k)}</li>`).join("")}</ul></details></td>
                <td><span class="l-src">Not assigned</span></td>
                <td><span class="o-key ${x.status === "Overdue" ? "o-late" : x.status === "In progress" ? "o-prog" : "o-plan"}">${x.status === "Overdue" ? '<span aria-hidden="true">!</span> ' : ""}${x.status}</span></td>
                <td><div class="row" style="gap:.4rem"><button class="btn sm" type="button" data-open="${x.pv.id}">${x.rec ? "Continue the Visit Sheet" : "Open the Visit Sheet"}</button><button class="btn ghost sm" type="button" data-send="${x.pv.id}">Send to phone</button></div></td></tr>`; }).join("")
              || `<tr><td colspan="7">${cal.day ? "No open visits that day." : "No visits in the next four months."} <a href="#tool/plan">See the yearly plan</a>.</td></tr>`}
          </tbody></table></div>
          <p class="l-src">"Who" stays empty until visits can be assigned to a person or crew.</p></div></div>`;
    q("#nSite").onchange = e => { cal.day = null; next(e.target.value); };
    q("#cPrev").onclick = () => { moveMonth(-1); next(); q("#cPrev").focus(); };
    q("#cNext").onclick = () => { moveMonth(1); next(); q("#cNext").focus(); };
    if (q("#cAll")) q("#cAll").onclick = () => { cal.day = null; next(); };
    qa(".c-day").forEach(b => {
      b.onclick = () => { cal.day = cal.day === b.dataset.day ? null : b.dataset.day; next(); const f = q(`.c-day[data-day="${b.dataset.day}"]`); if (f) f.focus(); };
      b.onkeydown = e => {
        const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: null, End: null}[e.key];
        if (step === undefined) return;
        e.preventDefault();
        const d = new Date(b.dataset.day + "T12:00:00");
        if (e.key === "Home") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); else if (e.key === "End") d.setDate(d.getDate() + 6 - ((d.getDay() + 6) % 7)); else d.setDate(d.getDate() + step);
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (d.getMonth() !== cal.m || d.getFullYear() !== cal.y) { cal.y = d.getFullYear(); cal.m = d.getMonth(); next(); }
        qa(".c-day").forEach(x => x.tabIndex = -1); const f = q(`.c-day[data-day="${iso}"]`); if (f) { f.tabIndex = 0; f.focus(); }
      };
    });
    const find = b => list.find(x => x.pv.id === b.dataset.open || x.pv.id === b.dataset.send);
    qa("[data-open]").forEach(b => b.onclick = () => { const x = find(b); const v = x.rec || startVisit(x.s, x.pv); location.hash = "#tool/visit/" + v.id; });
    qa("[data-send]").forEach(b => b.onclick = () => { const x = find(b); sendDlg(x.s, {date: x.pv.date, type: x.pv.type, planned_id: x.pv.id, tasks_planned: [...chosen(x.s.type, x.pv), ...x.pv.extra_tasks.map(e => e.task || "+" + e.text)]}); });
  }
  function moveMonth(dir) { cal.m += dir; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } }

  /* ================= Visit Sheets: every visit record, open ones first ================= */
  let sheetSite = "";
  function sheets(filter) {
    if (filter !== undefined) sheetSite = filter || "";
    const all = St.data.visits.filter(v => !sheetSite || v.site === sheetSite).slice()
      .sort((a, b) => (a.status === "closed") - (b.status === "closed") || b.date.localeCompare(a.date));
    const open = all.filter(v => v.status !== "closed").length;
    K().view().innerHTML = `<div class="l-row"><h2 style="margin:0">Visit Sheets</h2><span class="l-sp"></span>
        <label class="l-lab">VTS <select id="vsSite"><option value="">All</option>${St.sites().map(s => `<option value="${s.id}"${s.id === sheetSite ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
      <p class="muted">${open} open, ${all.length - open} closed. Only closed visits count in the reports. Start a new Visit Sheet from Next visits or from a visit in the Yearly plan.</p>
      <div class="scroll"><table><thead><tr><th>Date</th><th>VTS</th><th>Visit</th><th>Tasks done</th><th>Status</th><th><span class="vh">Open</span></th></tr></thead><tbody>
        ${all.map(v => { const s = St.site(v.site) || {name: v.site, type: "SB"}, closed = v.status === "closed";
          return `<tr><td>${esc(v.date)}</td><td><span class="sdot" style="background:${K().COLOR[s.type]}"></span>${esc(s.name)}</td><td>${esc(v.type)}</td>
            <td>${(v.tasks_done || []).length} of ${(v.tasks_planned || []).length || "—"}</td>
            <td>${closed ? `<span class="o-key o-done"><span aria-hidden="true">✓</span> Closed</span>` : `<span class="o-key o-prog">Open</span>`}</td>
            <td><a href="#tool/visit/${v.id}">${closed ? "See the Visit Sheet" : "Continue the Visit Sheet"} →</a></td></tr>`; }).join("") || `<tr><td colspan="6">No Visit Sheets yet.</td></tr>`}
      </tbody></table></div>`;
    q("#vsSite").onchange = e => sheets(e.target.value);
  }

  /* ================= Send to phone (no server: the visit travels inside the link) ================= */
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  function payload(s, v) {
    return {v: 1, org: St.data.organization.name, s: {id: s.id, name: s.name, type: s.type, params: s.params || {}}, d: v.date, vt: v.type, pid: v.planned_id || null, tasks: v.tasks_planned || []};
  }
  function linkFor(s, v) { return location.href.split("#")[0] + "#phone/" + b64e(JSON.stringify(payload(s, v))); }
  function sendDlg(s, v) {
    const url = linkFor(s, v);
    K().openDlg(`<h3>Send to phone</h3><p>${esc(s.name)} · ${esc(v.type)} visit · ${esc(v.date)}</p>
      <div class="t-qr" id="sQr" aria-label="QR code with the link"></div>
      <div class="f"><label for="sUrl">Link for the operator's phone</label><input id="sUrl" readonly value="${esc(url)}"></div>
      <div class="row"><button class="btn sm" type="button" id="sCopy">Copy link</button>${navigator.share ? `<button class="btn ghost sm" type="button" id="sShare">Share…</button>` : ""}<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">Open it here</a></div>
      <p class="l-src">The phone opens the Visit Sheet with the tasks and Site Conditions already filled in. The link carries this visit's checklist (no exact location), so share it only with the crew.
        Answers stay on that phone until the operator taps "Finish and send back" and sends you the results file; then use "Import results from the phone" on this Visit Sheet.</p>`);
    q("#sUrl").onfocus = e => e.target.select();
    q("#sCopy").onclick = async () => { try { await navigator.clipboard.writeText(url); q("#sCopy").textContent = "Copied"; } catch (e) { q("#sUrl").select(); document.execCommand("copy"); q("#sCopy").textContent = "Copied"; } };
    if (q("#sShare")) q("#sShare").onclick = () => navigator.share({title: `Visit Sheet: ${s.name}`, text: `${v.type} visit on ${v.date}`, url}).catch(() => {});
    qr(q("#sQr"), url);
  }
  function qr(box, url) {
    const draw = () => { try { box.innerHTML = ""; new window.QRCode(box, {text: url, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.L}); } catch (e) { box.innerHTML = '<p class="l-src">The link is too long for a QR code. Copy or share it instead.</p>'; } };
    if (window.QRCode) return draw();
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    sc.onload = draw; sc.onerror = () => { box.innerHTML = '<p class="l-src">The QR code could not load. Copy or share the link instead.</p>'; }; document.head.appendChild(sc);
  }

  /* ================= Phone page (#phone/<payload>) ================= */
  function phone(code) {
    const box = q("#phoneView");
    let p;
    try { p = JSON.parse(b64d(code || "")); } catch (e) { box.innerHTML = `<div class="panel"><h2>This link is not complete</h2><p>Ask the supervisor to send the visit again.</p></div>`; return; }
    const key = "vts_phone_" + (p.pid || p.s.id + "_" + p.d);
    let v; try { v = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { v = null; }
    v = v || {id: "PHONE-" + (p.pid || p.d), site: p.s.id, date: p.d, type: p.vt, status: "draft", planned_id: p.pid, tasks_planned: p.tasks, tasks_done: [], mowing: null, photos: [], all_photo_points_taken: null,
              crew_size: null, hours_on_site: null, hours_crew_total: null, last_rain: null, notes: "", form: {items: {}, water: {kit: "strip-n"}, water_at_inlet: null}};
    const store = () => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} };
    const s = p.s, conds = (L.siteParams && L.siteParams[s.type] || []).map(f => [f.field, K().paramValue(s.params, f.field)]).filter(([, x]) => x && x !== "see Design");
    const again = () => { renderForm(s, v, {mode: "phone", box: () => q("#phoneView #phoneForm"), save: store, again, finish}); };
    function finish() {
      const out = {kind: "vts-visit-results", version: 1, exported_at: new Date().toISOString().slice(0, 19), ref: {site: s.id, site_name: s.name, planned_id: p.pid, date: v.date, type: v.type},
                   visit: {date: v.date, type: v.type, last_rain: v.last_rain, tasks_done: v.tasks_done, mowing: v.mowing, all_photo_points_taken: v.all_photo_points_taken, crew_size: v.crew_size, hours_on_site: v.hours_on_site, notes: v.notes, form: v.form}};
      const name = `visit_${s.id}_${v.date}.json`, blob = new Blob([JSON.stringify(out, null, 1)], {type: "application/json"}), file = new File([blob], name, {type: "application/json"});
      q("#phoneView #phoneForm").insertAdjacentHTML("afterbegin", `<div class="panel stack t-done"><h3>Ready to send back</h3><p>Send this results file to your supervisor. They import it into the Visit Sheet and close the visit.</p>
        <div class="row">${navigator.canShare && navigator.canShare({files: [file]}) ? `<button class="btn" type="button" id="phShare">Share the results</button>` : ""}<a class="btn ghost" id="phDl" download="${name}">Download the results file</a></div>
        <p class="l-src">Your answers stay on this phone, so you can send them again.</p></div>`);
      q("#phoneView #phDl").href = URL.createObjectURL(blob);
      if (q("#phoneView #phShare")) q("#phoneView #phShare").onclick = () => navigator.share({files: [file], title: `Visit results: ${s.name}`}).catch(() => {});
      window.scrollTo(0, 0);
    }
    box.innerHTML = `<div class="stack"><p class="l-src">${esc(p.org || "")} · Visit Sheet for the field</p>
      ${conds.length ? `<details class="panel"><summary><b>Site Conditions</b> (from the supervisor)</summary><table class="t-kv">${conds.map(([k, x]) => `<tr><th>${esc(k)}</th><td>${esc(x)}</td></tr>`).join("")}</table></details>` : ""}
      <div id="phoneForm"></div></div>`;
    again();
  }
  async function importResults(s, v, file) {
    const msg = q("#toolView #vImpMsg");
    try {
      const r = JSON.parse(await file.text());
      if (r.kind !== "vts-visit-results") throw new Error("This is not a results file from the Visit Sheet.");
      if (r.ref.site !== s.id) throw new Error(`These results are for ${r.ref.site_name || r.ref.site}, not for ${s.name}.`);
      const w = r.visit;
      Object.assign(v, {date: w.date, type: w.type, last_rain: w.last_rain, tasks_done: w.tasks_done || [], mowing: w.mowing, all_photo_points_taken: w.all_photo_points_taken, crew_size: w.crew_size, hours_on_site: w.hours_on_site,
                        hours_crew_total: w.crew_size && w.hours_on_site ? Math.round(w.crew_size * w.hours_on_site * 100) / 100 : null, notes: w.notes || "", form: w.form || v.form});
      St.put("visits", v); visit(v.id);
      q("#toolView #vImpMsg").innerHTML = `<p class="l-banner">Imported ${Object.keys((w.form || {}).items || {}).length} checklist answers from the phone (sent ${esc(r.exported_at.replace("T", " "))}). Check them, then close the visit.</p>`;
    } catch (e) { msg.innerHTML = `<p class="l-warn">${esc(e.message || "The file could not be read.")}</p>`; }
  }
  /* ================= Corrective Maintenance Log (F05), interactive ================= */
  const COR_T04_ACTIONS = ["filled an inactive burrow", "reduced cover near the berm", "stopped work (nest or possible protected species)", "passed to the supervisor"];
  const STATUS_CHIP = {open: "y", escalated: "r", resolved: "g"};
  let corFilter = {status: "active", site: ""};
  function corrective(siteArg) {
    if (siteArg !== undefined) corFilter.site = siteArg || "";
    const all = St.data.corrective_entries.slice().sort((a, b) => b.date.localeCompare(a.date));
    const list = all.filter(c => (!corFilter.site || c.site === corFilter.site) && (corFilter.status === "all" || (corFilter.status === "active" ? c.status !== "resolved" : c.status === corFilter.status)));
    const count = st => all.filter(c => (!corFilter.site || c.site === corFilter.site) && (st === "active" ? c.status !== "resolved" : st === "all" || c.status === st)).length;
    K().view().innerHTML = `<div class="l-row"><h2 style="margin:0">Corrective log</h2><span class="l-sp"></span>
        <label class="l-lab">VTS <select id="cSite"><option value="">All</option>${St.sites().map(s => `<option value="${s.id}"${s.id === corFilter.site ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        <button class="btn sm" type="button" id="cNew">Add a finding</button></div>
      <p class="muted">Every repair the inspections found (Corrective Maintenance Log, F05). Schedule the repair into the yearly plan, then record what was done.</p>
      <div class="l-pills" role="group" aria-label="Status">${[["active", "Open and escalated"], ["open", "Open"], ["escalated", "Escalated"], ["resolved", "Resolved"], ["all", "All"]].map(([k, n]) => `<button type="button" class="l-pill${corFilter.status === k ? " on" : ""}" data-cf="${k}" aria-pressed="${corFilter.status === k}">${n} <small>${count(k)}</small></button>`).join("")}</div>
      <div class="t-corgrid">${list.map(corCard).join("") || `<div class="panel">Nothing here.</div>`}</div>`;
    q("#cSite").onchange = e => corrective(e.target.value);
    qa("[data-cf]").forEach(b => b.onclick = () => { corFilter.status = b.dataset.cf; corrective(); });
    q("#cNew").onclick = newFindingDlg;
    qa("[data-csched]").forEach(b => b.onclick = () => scheduleDlg(all.find(c => c.id === b.dataset.csched)));
    qa("[data-cact]").forEach(b => b.onclick = () => actionDlg(all.find(c => c.id === b.dataset.cact)));
  }
  function corCard(c) {
    const s = St.site(c.site) || {name: c.site, type: "SB"}, t = c.task && taskBy(c.task), v = c.visit && St.visit(c.visit);
    return `<div class="panel t-cor ${c.status}"><div class="l-row"><span class="sdot" style="background:${K().COLOR[s.type]}"></span><b>${esc(s.name)}</b><span class="l-sp"></span><span class="l-chip ${STATUS_CHIP[c.status] || ""}">${esc(c.status)}</span></div>
      <p class="t-corf">${esc(c.finding)}</p>
      <p class="l-src">Found ${esc(c.date)}${c.location ? " · " + esc(c.location) : ""}${c.urgency ? " · urgency: " + esc(c.urgency) : ""}${v ? ` · <a href="#tool/visit/${v.id}">from the ${esc(v.type)} visit</a>` : ""}</p>
      ${t ? `<p>Task: <a href="#learn/task/${t.id}">${esc(t.name)}</a> <span class="l-src">${t.id}</span></p>` : ""}
      ${c.scheduled ? `<p><span class="l-chip">Scheduled ${esc(c.scheduled.date)}</span> <a href="#tool/plan/${c.site}/${c.scheduled.date.slice(0, 4)}">see the plan</a></p>` : ""}
      ${c.action_taken ? `<p><b>Action:</b> ${esc(c.action_taken)}${c.resolved_date ? ` <span class="l-src">(${esc(c.resolved_date)})</span>` : ""}</p>` : ""}
      ${c.materials_used || c.hours || c.material_cost ? `<p class="l-src">${[c.materials_used && "Materials: " + esc(c.materials_used), c.hours && c.hours + " h", c.material_cost != null && "materials $" + c.material_cost].filter(Boolean).join(" · ")}</p>` : ""}
      ${(c.photos || []).length ? `<p class="l-src">Photos: ${c.photos.map(esc).join(", ")}</p>` : ""}
      <div class="row">${c.status !== "resolved" ? `<button class="btn ghost sm" type="button" data-csched="${c.id}">${c.scheduled ? "Reschedule" : "Schedule the repair"}</button>` : ""}<button class="btn sm" type="button" data-cact="${c.id}">${c.action_taken ? "Update the action" : "Record the action"}</button></div></div>`;
  }
  function planFor(s, year) { let p = St.planOf(s.id, year); if (!p) { newPlan(s, year); p = St.planOf(s.id, year); } return p; }
  function scheduleDlg(c) {
    const s = St.site(c.site), cors = L.tasks.filter(t => t.sys === "COR" || t.sys === s.type);
    K().openDlg(`<h3>Schedule the repair</h3><p>${esc(c.finding)}</p><form id="scF" class="stack">
      <div class="grid2"><div class="f"><label for="scD">Day</label><input type="date" id="scD" required value="${c.scheduled ? c.scheduled.date : K().today()}"></div>
        <div class="f"><label for="scT">Task</label><select id="scT">${cors.map(t => `<option value="${t.id}"${t.id === c.task ? " selected" : ""}>${esc(t.id + " " + t.name)}</option>`).join("")}<option value="+"${!c.task ? " selected" : ""}>Another task (the finding)</option></select></div></div>
      <p class="l-src">It is added to the yearly plan of ${esc(s.name)} on that day (a new Corrective visit, or the visit already planned that day) and shows in Next visits.</p>
      <div class="row"><button class="btn" type="submit">Schedule</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    q("#scF").onsubmit = e => {
      e.preventDefault(); const day = q("#scD").value; if (!day) return;
      const k = q("#scT").value === "+" ? "+" + c.finding.slice(0, 80) : q("#scT").value, p = planFor(s, +day.slice(0, 4));
      let next = clone(p.planned_visits);
      if (c.scheduled && c.scheduled.date !== day) next = removeFrom(s, next, k, next.filter(v => v.date === c.scheduled.date).map(v => v.id));
      next = addTo(s, next, k, day, p);
      const pv = next.find(v => v.date === day);
      const finish = () => { St.update("corrective_entries", c.id, {scheduled: {date: day, planned_id: pv.id}, task: k[0] === "+" ? c.task : k}, `Repair scheduled for ${day}`, "scheduled"); corrective(); };
      q("#toolDlg").close();
      if (p.status === "approved") reasonCat(`Add the repair to the approved ${p.year} plan`, (reason, cat) => { St.update("annual_plans", p.id, {planned_visits: next}, `Repair scheduled (${c.id}) on ${day}. ${reason}`, cat); finish(); }, () => corrective());
      else { p.planned_visits = next; St.persist(); finish(); }
    };
  }
  function actionDlg(c) {
    const isBurrow = c.task === "COR_T04";
    K().openDlg(`<h3>Record the action</h3><p>${esc(c.finding)}</p><form id="acF" class="stack">
      <div class="f"><label for="acA">Action taken</label>${isBurrow ? `<select id="acA">${COR_T04_ACTIONS.map(a => `<option${a === c.action_taken ? " selected" : ""}>${a}</option>`).join("")}</select><p class="l-src">The four actions of Animal Burrows and Activity (COR_T04).</p>`
        : `<input id="acA" value="${esc(c.action_taken || "")}" required placeholder="For example: cleared the inlet">`}</div>
      <div class="grid2"><div class="f"><label for="acC">Likely cause</label><input id="acC" value="${esc(c.likely_cause || "")}"></div>
        <div class="f"><label for="acU">Urgency</label><select id="acU">${["", "Low", "Normal", "High"].map(u => `<option${u === (c.urgency || "") ? " selected" : ""}>${u}</option>`).join("")}</select></div>
        <div class="f"><label for="acM">Materials used</label><input id="acM" value="${esc(c.materials_used || "")}"></div>
        <div class="f"><label for="acMC">Cost of the materials ($, supervisor)</label><input id="acMC" type="number" min="0" step="any" value="${c.material_cost ?? ""}"></div>
        <div class="f"><label for="acH">Hours (crew total)</label><input id="acH" type="number" min="0" step="0.25" value="${c.hours ?? ""}"></div>
        <div class="f"><label for="acS">Status</label><select id="acS">${["open", "escalated", "resolved"].map(x => `<option${x === c.status ? " selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="f"><label for="acD">Date resolved</label><input id="acD" type="date" value="${c.resolved_date || K().today()}"></div></div>
      <label class="check"><input type="checkbox" id="acP"${(c.photos || []).some(p => /after/.test(p)) ? " checked" : ""}> Photo after the repair taken</label>
      <div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    q("#acF").onsubmit = e => {
      e.preventDefault();
      const st = q("#acS").value, photos = (c.photos || []).filter(p => !/after/.test(p)).concat(q("#acP").checked ? [`PH-${c.id}-after`] : []);
      const patch = {action_taken: q("#acA").value.trim() || null, likely_cause: q("#acC").value.trim() || null, urgency: q("#acU").value || null, materials_used: q("#acM").value.trim() || null,
                     material_cost: q("#acMC").value === "" ? null : +q("#acMC").value, hours: q("#acH").value === "" ? null : +q("#acH").value, status: st, resolved_date: st === "resolved" ? q("#acD").value : null, photos};
      const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(c[k] ?? null)));
      q("#toolDlg").close();
      if (Object.keys(changed).length) St.update("corrective_entries", c.id, changed, st === "resolved" && c.status !== "resolved" ? "Repair done and recorded" : "Action recorded", "action");
      corrective();
    };
  }
  function newFindingDlg() {
    const sites = St.sites().filter(s => s.status !== "decommissioned");
    K().openDlg(`<h3>Add a finding</h3><form id="nfF" class="stack">
      <div class="grid2"><div class="f"><label for="nfS">VTS</label><select id="nfS">${sites.map(s => `<option value="${s.id}"${s.id === corFilter.site ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div class="f"><label for="nfD">Date found</label><input type="date" id="nfD" value="${K().today()}" required></div></div>
      <div class="f"><label for="nfF2">What was found</label><input id="nfF2" required></div>
      <div class="grid2"><div class="f"><label for="nfL">Location in the system</label><input id="nfL"></div>
        <div class="f"><label for="nfT">Task that fixes it</label><select id="nfT"><option value="">Not sure yet</option>${L.tasks.filter(t => t.sys === "COR").map(t => `<option value="${t.id}">${esc(t.id + " " + t.name)}</option>`).join("")}</select></div></div>
      <div class="row"><button class="btn" type="submit">Add</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    q("#nfF").onsubmit = e => {
      e.preventDefault();
      St.add("corrective_entries", {id: St.nextId("corrective_entries", "C-NEW-"), site: q("#nfS").value, visit: null, observation: null, task: q("#nfT").value || null, date: q("#nfD").value, finding: q("#nfF2").value.trim(),
        location: q("#nfL").value.trim() || null, likely_cause: null, action_taken: null, urgency: null, materials_used: null, material_cost: null, hours: null, status: "open", resolved_date: null, scheduled: null, photos: []});
      q("#toolDlg").close(); corFilter.status = "active"; corrective();
    };
  }
  return {plan, visit, next, sheets, phone, corrective, newPlan};
})();
