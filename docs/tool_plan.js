/* Tool 4b: Yearly plan (editable, suggested from the manual) and the Visit Sheet (F04) form.
   Routes: #tool/plan, #tool/plan/<site>/<year>, #tool/visit/<visit id>. Uses window.ToolKit (tool.js), VTSStore (store.js), VTS_LEARN (learn_data.js).
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

  /* ================= Yearly plan ================= */
  function plan(siteId, yearArg) {
    const active = St.sites().filter(s => s.status !== "decommissioned");
    const s = St.site(siteId) || active[0];
    if (!s) { K().view().innerHTML = `<div class="panel">Add a VTS first in <a href="#tool/vts">My VTS</a>.</div>`; return; }
    const years = [...new Set([...St.data.annual_plans.filter(p => p.site === s.id).map(p => p.year), yearNow(), yearNow() + 1])].sort();
    const year = +yearArg || yearNow();
    const p = St.planOf(s.id, year);
    const head = `<div class="l-row"><h2 style="margin:0">Yearly plan</h2><span class="l-sp"></span>
        <label class="l-lab">VTS <select id="pSite">${active.map(x => `<option value="${x.id}"${x.id === s.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label class="l-lab">Year <select id="pYear">${years.map(y => `<option${y === year ? " selected" : ""}>${y}</option>`).join("")}</select></label></div>
      <p class="muted">The manual suggests the tasks of each visit. Untick a task that will not be done, add an extra one if needed. Same content as the Annual Plan form (F03).</p>`;
    if (!p) {
      K().view().innerHTML = head + `<div class="panel stack"><p>No plan for ${year} yet.</p><div class="row"><button class="btn" type="button" id="pNew">Create the ${year} plan from the manual</button></div>
        <p class="small muted">It starts with a January review, routine visits every two months, the spring visit in April and the pre-storm visit in August. You can change everything before you approve it.</p></div>`;
      wire(s, year); q("#pNew").onclick = () => { newPlan(s, year); plan(s.id, year); }; return;
    }
    const pvs = p.planned_visits.slice().sort((a, b) => a.date.localeCompare(b.date));
    const approved = p.status === "approved";
    K().view().innerHTML = head + `
      <div class="t-bar"><span>${approved ? `<span class="l-chip g">Approved</span> Changes now ask for a reason and stay in the change history.` : `<span class="l-chip y">Draft</span> Changes are saved as you go.`}</span><span class="l-sp"></span>
        ${approved ? "" : `<button class="btn sm" type="button" id="pApprove">Approve the plan</button>`}<button class="btn ghost sm" type="button" id="pAddV">Add a visit</button></div>
      <div class="stack">${pvs.map(pv => pvCard(s, p, pv)).join("")}</div>
      <h3>Tasks by month</h3>${monthGrid(s, pvs)}
      ${histOf([p.id])}`;
    wire(s, year);
    if (q("#pApprove")) q("#pApprove").onclick = () => { p.status = "approved"; p.approved = K().today(); St.persist(); plan(s.id, year); };
    q("#pAddV").onclick = () => changePlan(s, p, list => [...list, {id: `${p.id}-${Date.now().toString(36)}`, date: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15`, type: "Routine", extra_tasks: []}], "Visit added");
    qa("[data-pv]").forEach(card => {
      const id = card.dataset.pv, edit = (fn, what) => changePlan(s, p, list => list.map(v => v.id === id ? fn(JSON.parse(JSON.stringify(v))) : v), what);
      q("[data-f=date]", card).onchange = e => edit(v => (v.date = e.target.value, v), "Date changed");
      q("[data-f=type]", card).onchange = e => edit(v => (v.type = e.target.value, delete v.tasks, v), "Visit type changed");
      qa("[data-task]", card).forEach(c => c.onchange = () => edit(v => { const cur = new Set(chosen(s.type, v)); c.checked ? cur.add(c.dataset.task) : cur.delete(c.dataset.task); v.tasks = [...cur]; return v; }, `Task ${c.dataset.task} ${c.checked ? "added back" : "removed"}`));
      qa("[data-rmx]", card).forEach(b => b.onclick = () => edit(v => (v.extra_tasks.splice(+b.dataset.rmx, 1), v), "Extra task removed"));
      q("[data-addx]", card).onclick = () => {
        const sel = q("[data-xsel]", card).value, txt = q("[data-xtxt]", card).value.trim();
        if (!sel && !txt) return;
        edit(v => (v.extra_tasks.push(sel ? {task: sel, text: (taskBy(sel) || {}).name || sel} : {task: null, text: txt}), v), "Extra task added");
      };
      const rm = q("[data-rmv]", card); if (rm) rm.onclick = () => { if (confirm("Remove this visit from the plan?")) changePlan(s, p, list => list.filter(v => v.id !== id), "Visit removed"); };
      const rec = q("[data-rec]", card); if (rec) rec.onclick = () => { const v = startVisit(s, p.planned_visits.find(x => x.id === id)); location.hash = "#tool/visit/" + v.id; };
    });
  }
  function wire(s, year) {
    q("#pSite").onchange = e => location.hash = `#tool/plan/${e.target.value}/${q("#pYear").value}`;
    q("#pYear").onchange = e => location.hash = `#tool/plan/${q("#pSite").value}/${e.target.value}`;
  }
  function newPlan(s, year) {
    const d = (m, day) => `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const vis = [[1, 14, "January review"], [2, 10, "Routine"], [4, 15, "Spring"], [6, 10, "Routine"], [8, 19, "Pre-storm"], [10, 14, "Routine"], [12, 9, "Routine"]];
    const id = `P-${s.id}-${year}`;
    St.put("annual_plans", {id, site: s.id, year, status: "draft", planned_visits: vis.map(([m, day, t], i) => ({id: `${id}-${i + 1}`, date: d(m, day), type: t, extra_tasks: []}))});
  }
  /* a draft plan is saved directly; an approved one needs a reason */
  function changePlan(s, p, fn, what) {
    const next = fn(JSON.parse(JSON.stringify(p.planned_visits)));
    if (p.status !== "approved") { p.planned_visits = next; St.persist(); plan(s.id, p.year); return; }
    reasonCat(`Change the approved plan: ${what}`, (reason, cat) => { St.update("annual_plans", p.id, {planned_visits: next}, `${what}. ${reason}`, cat); plan(s.id, p.year); }, () => plan(s.id, p.year));
  }
  function pvCard(s, p, pv) {
    const sug = suggested(s.type, pv.type), cur = new Set(chosen(s.type, pv));
    const done = St.visitsOf(s.id).find(v => v.planned_id === pv.id || v.date === pv.date);
    const others = L.tasks.filter(t => t.sys === s.type || t.sys === "COR").filter(t => !sug.includes(t.id));
    return `<div class="panel t-pv" data-pv="${pv.id}">
      <div class="l-row"><input type="date" data-f="date" value="${pv.date}" aria-label="Date"><select data-f="type" aria-label="Visit type">${TYPES.map(t => `<option${t === pv.type ? " selected" : ""}>${t}</option>`).join("")}</select>
        <span class="l-sp"></span>${done ? `<a class="btn ghost sm" href="#tool/visit/${done.id}">${done.status === "closed" ? "Visit recorded" : "Visit in progress"}</a>` : `<button class="btn sm" type="button" data-rec>Record this visit</button><button class="btn ghost sm" type="button" data-rmv>Remove</button>`}</div>
      ${sug.length ? `<ul class="t-tasks">${sug.map(id => `<li><label class="check"><input type="checkbox" data-task="${id}"${cur.has(id) ? " checked" : ""}> ${taskLink(id)}</label></li>`).join("")}</ul>` : `<p class="l-src">The manual suggests no fixed tasks for this visit type. Add what will be done.</p>`}
      ${[...cur].filter(id => !sug.includes(id)).map(id => `<p class="l-src">Also: ${taskLink(id)}</p>`).join("")}
      ${pv.extra_tasks.length ? `<ul class="t-tasks">${pv.extra_tasks.map((x, i) => `<li><span class="l-chip y">Extra</span> ${x.task ? taskLink(x.task) : esc(x.text)} <button class="btn ghost sm" type="button" data-rmx="${i}">Remove</button></li>`).join("")}</ul>` : ""}
      <div class="l-row t-addx"><select data-xsel aria-label="Add a task from the manual"><option value="">Add a task from the manual…</option>${others.map(t => `<option value="${t.id}">${esc(t.id + " " + t.name)}</option>`).join("")}</select>
        <span class="l-src">or</span><input data-xtxt placeholder="Describe another task" aria-label="Another task"><button class="btn ghost sm" type="button" data-addx>Add</button></div></div>`;
  }
  function monthGrid(s, pvs) {
    const rows = {};
    pvs.forEach(pv => { const m = +pv.date.slice(5, 7) - 1;
      chosen(s.type, pv).forEach(id => (rows[id] = rows[id] || new Set()).add(m));
      pv.extra_tasks.forEach(x => (rows[x.task || "+" + x.text] = rows[x.task || "+" + x.text] || new Set()).add(m)); });
    const keys = Object.keys(rows).sort();
    if (!keys.length) return `<p class="muted">No tasks planned.</p>`;
    return `<div class="scroll"><table class="t-month"><thead><tr><th>Task</th>${MONTHS.map(m => `<th>${m}</th>`).join("")}</tr></thead><tbody>${keys.map(k => `<tr><td>${k[0] === "+" ? `<span class="l-chip y">Extra</span> ${esc(k.slice(1))}` : esc(k + " " + ((taskBy(k) || {}).name || ""))}</td>${MONTHS.map((_, i) => `<td>${rows[k].has(i) ? "x" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
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
    const f = v.form = v.form || {items: {}, water: {kit: "strip-n"}};
    const chkType = v.type === "Spring" ? "Routine" : v.type;
    const items = L.checklist.filter(i => i.sys === s.type && i.vis.includes(chkType));
    const nitrate = nitrateSys(s.type), kit = KITS[f.water.kit || "strip-n"], pp = (s.params || {}).photo_points;
    const mowTask = v.tasks_planned.some(t => /_T03$/.test(t) && /Vegetation Maintenance/.test((taskBy(t) || {}).name || ""));
    let sec = "";
    K().view().innerHTML = `
      <p><a href="#tool/plan/${s.id}/${v.date.slice(0, 4)}">← Yearly plan</a></p>
      <div class="t-card"><div class="t-band" style="background:${K().COLOR[s.type]}"><span>Visit Sheet · ${esc(s.type)}_F04</span><span class="l-sp"></span><span class="l-chip y">Draft</span></div>
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
        <div class="row"><button class="btn" type="button" id="vClose">Close the visit</button><button class="btn ghost" type="button" id="vDel">Delete this draft</button><span class="l-src">Saved as you go (draft).</span></div>
      </form></div>`;
    const form = q("#vf");
    const save = () => { readForm(v, form); St.put("visits", v); };
    form.addEventListener("change", e => { save(); if (e.target.name === "type" || e.target.name === "kit") visit(id); });
    form.addEventListener("input", e => { if (e.target.matches("input[type=text],input:not([type]),textarea,input[type=number]")) save(); });
    qa("[data-ans]", form).forEach(b => b.onclick = () => { const it = b.closest("[data-item]").dataset.item; f.items[it] = {...(f.items[it] || {}), a: b.dataset.ans}; save(); visit(id); });
    qa("[data-yn]", form).forEach(b => b.onclick = () => { const k = b.dataset.yn, val = b.dataset.v === "yes"; setYn(v, k, val); St.put("visits", v); visit(id); });
    q("#vDel").onclick = () => { if (confirm("Delete this draft visit?")) { St.remove("visits", id); location.hash = `#tool/plan/${s.id}/${v.date.slice(0, 4)}`; } };
    q("#vClose").onclick = () => { save(); const miss = missing(s, v); if (miss.length) { q("#vMissing").innerHTML = `<div class="l-warn"><b>Before closing, complete:</b><ul>${miss.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>`; q("#vMissing").scrollIntoView({block: "center"}); return; } closeVisit(s, v); visit(id); };
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
  return {plan, visit};
})();
