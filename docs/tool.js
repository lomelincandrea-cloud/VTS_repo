/* Maintenance tool (prototype). Six steps: 1 My VTS, 2 Yearly plan, 3 Next visits, 4 Visit Sheets, 5 Corrective log, 6 Dashboard and reports.
   Data through window.VTSStore (store.js). Routes: #tool, #tool/vts, #tool/vts/<site id>, #tool/plan, #tool/visits, #tool/sheets, #tool/visit/<id>, #tool/corrective, #tool/dashboard.
   app.js calls window.toolRoute(parts). */
(function () {
  "use strict";
  const St = window.VTSStore, L = window.VTS_LEARN || {};
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const COLOR = {SB: "#2B7BBF", TW: "#3C9D5B", VD: "#C99700", WB: "#DD6B2A"};
  const NAME = {SB: "Sediment basin", TW: "Treatment wetland", VD: "Vegetated ditch", WB: "Woodchip bioreactor"};
  const LEVELS = [["private", "Private"], ["watershed", "Watershed"], ["public", "Public"]];
  const LEVEL_HELP = {
    private: "Only your organization and the people you invite.",
    watershed: "Shared with watershed partners only inside sub-watershed (HUC-12) summaries. Never the exact place or the owner's name.",
    public: "Anyone can see it on the public site."};
  const ITEM_HELP = {
    location: {label: "Location", private: "The site is not on any shared map.", watershed: "Counted in its sub-watershed; no point on the map.", public: "The point appears on the public map."},
    documents: {label: "Documents", private: "Only your organization opens them.", watershed: "Watershed partners can open them.", public: "Anyone can download them."},
    status: {label: "Status", private: "Its condition is seen only by your organization.", watershed: "Its condition counts in sub-watershed summaries.", public: "Its overall condition shows on the public map."}};
  const DECOM = ["Replaced", "Removed", "Land use changed", "Agreement ended", "Other"];
  const view = () => q("#toolView");
  let map = null;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };   /* local date */

  /* ---------- routing and session ---------- */
  window.toolRoute = async function (parts) {
    try { await St.load(); }
    catch (e) { q("#toolGate").innerHTML = `<div class="panel">The sample records could not load (${esc(e.message)}). The Tool needs the site to be opened from a web server, not as a file.</div>`; return; }
    const s = St.session();
    q("#toolApp").hidden = !s;
    if (!s) { gate(); return; }
    bar(s);
    const [v, a] = parts;
    const which = v || "vts", step = which === "visit" ? "sheets" : which;
    qa("#toolTabs a").forEach(x => x.dataset.t === step ? x.setAttribute("aria-current", "step") : x.removeAttribute("aria-current"));
    const hint = HINT[step]; q("#toolHint").textContent = hint ? `Step ${hint[0]} of 6 · ${hint[1]}` : "";
    if (map) { map.remove(); map = null; }
    if (which === "vts" && a === "new" && window.ToolRegister) window.ToolRegister.page();
    else if (which === "vts" && a) card(a, parts[2], parts[3]);
    else if (which === "vts") myVts();
    else if (which === "plan" && window.ToolPlan) window.ToolPlan.plan(a, parts[2]);
    else if (which === "visit" && window.ToolPlan) window.ToolPlan.visit(a);
    else if (which === "sheets" && window.ToolPlan) window.ToolPlan.sheets(a);
    else if (which === "visits" && window.ToolPlan) window.ToolPlan.next(a);
    else if (which === "corrective" && window.ToolPlan) window.ToolPlan.corrective(a);
    else if (which === "dashboard" && window.ToolDash) window.ToolDash.render(a);
  };
  function gate() {
    q("#toolGate").innerHTML = `<div class="panel stack t-gate"><h2>Sign in</h2>
      <p>This prototype has no accounts yet. Enter as a demo user to see what a supervisor of a maintenance organization would see. All records are <b>sample data</b>.</p>
      <div class="row"><button class="btn" type="button" id="tEnter">Enter as demo</button></div>
      <p class="small muted">What you change is saved only in this browser. You can go back to the original sample data at any time.</p></div>`;
    q("#tEnter").onclick = async () => {
      St.signIn(); await window.toolRoute((location.hash.slice(1).split("/")).slice(1));
      let seen = null; try { seen = localStorage.getItem("vts_tool_help_seen"); localStorage.setItem("vts_tool_help_seen", "1"); } catch (e) {}
      if (!seen) openHelp();   /* the first time a person signs in */
    };
  }

  /* ---------- the six steps: help line under the tabs, and the "?" side panel ---------- */
  const HINT = {
    vts: [1, "Your systems on a map. Open one to see its card, Site History and who can see what."],
    plan: [2, "See the year at a glance. Select a visit to open its record."],
    visits: [3, "Pick a day on the calendar to see its visits. Open the Visit Sheet or send it to a phone."],
    sheets: [4, "Every Visit Sheet, open ones first. Only closed visits count in the reports."],
    corrective: [5, "Every repair the inspections found. Schedule it, then record what was done."],
    dashboard: [6, "Each indicator against its target. Print the Food Safety Record or the Water Summary."]};
  const HELP = [
    ["My VTS", "Your systems on a map. Open a card to see its design, Site Conditions, documents, who can see them, and its Site History. Register or decommission a system here."],
    ["Yearly plan", "Every VTS by month. ✓ done, ○ planned, ! overdue. Select a visit to see its tasks, materials and estimated cost, open its Visit Sheet or send it to a phone. \"Edit this VTS's plan\" opens the chart of tasks by month."],
    ["Next visits", "A calendar and the list of visits coming up. Pick a day to see only that day."],
    ["Visit Sheets", "Every Visit Sheet, open ones first. Close a visit when it is complete; after that, changes ask for a reason."],
    ["Corrective log", "Every problem found. Schedule the repair into the plan, then record what was done and when."],
    ["Dashboard and reports", "Every indicator against its target, for one VTS or all of them. Print the Food Safety Record and the Water Quality and Maintenance Summary, or download the change history."]];
  function openHelp() {
    const d = q("#toolHelp"); if (!d) return;
    d.innerHTML = `<div class="t-sidein"><div class="l-row"><h2 id="thTitle" style="margin:0">How the Tool works</h2><span class="l-sp"></span><button class="btn ghost sm" type="button" data-close>Close</button></div>
      <p>Plan the year, record every visit, and keep track of repairs. It works with sample data: try anything, then use Reset sample data.</p>
      <ol class="t-helpl">${HELP.map(([t, x]) => `<li><b>${esc(t)}</b><span>${esc(x)}</span></li>`).join("")}</ol>
      <p class="l-banner">A draft saves as you go. Once a plan is approved or a visit is closed, every change asks for a reason and goes into the change history.</p></div>`;
    q("[data-close]", d).onclick = () => d.close();
    d.onclick = e => { if (e.target === d) d.close(); };   /* a click on the backdrop closes it */
    d.showModal();
  }
  if (q("#toolHelpBtn")) q("#toolHelpBtn").onclick = openHelp;
  function bar(s) {
    q("#toolGate").innerHTML = `<div class="t-bar"><span><b>${esc(s.user)}</b> · ${esc(s.role)} · ${esc(s.org)} <span class="l-chip r">Sample data</span>${St.edited() ? ' <span class="l-chip y">Changed in this browser</span>' : ""}</span>
      <span class="l-sp"></span><button class="btn ghost sm" type="button" id="tReset">Reset sample data</button><button class="btn ghost sm" type="button" id="tOut">Sign out</button></div>`;
    q("#tOut").onclick = () => { St.signOut(); window.toolRoute([]); };
    q("#tReset").onclick = () => { if (confirm("Go back to the original sample data? Your changes in this browser will be lost.")) { St.reset(); window.toolRoute(location.hash.slice(1).split("/").slice(1)); } };
  }


  /* ---------- helpers ---------- */
  const lastVisit = id => { const v = St.visitsOf(id).filter(x => x.type !== "January review"); return v[v.length - 1] || null; };
  const lastPhotoVisit = id => { const v = St.visitsOf(id).filter(x => (x.photos || []).length); return v[v.length - 1] || null; };
  function nextPlanned(id) {
    const lv = lastVisit(id), y = new Date().getFullYear(), plans = [St.planOf(id, y), St.planOf(id, y + 1), St.planOf(id, 2026)].filter(Boolean);
    const after = (lv ? lv.date : "0000");
    return plans.flatMap(p => p.planned_visits).filter(x => x.date > after).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }
  const statusChip = s => s.status === "decommissioned" ? `<span class="l-chip">Decommissioned ${esc(s.decommissioned?.date || "")}</span>` : `<span class="l-chip g">Active</span>`;
  function photoSvg(s, v) {
    const c = COLOR[s.type] || "#5B6E83", ph = v && v.photos[0];
    return `<svg class="t-photo" viewBox="0 0 320 180" role="img" aria-label="Sample photo placeholder"><rect width="320" height="180" fill="#dcebf7"/><path d="M0 110 Q80 80 160 105 T320 95 V180 H0Z" fill="#9cc79a"/>
      <path d="M0 132 Q90 118 170 132 T320 128 V180 H0Z" fill="${c}" opacity=".55"/><path d="M40 128 v-30 M52 128 v-24 M64 128 v-28 M240 124 v-26 M252 124 v-20" stroke="#2f6b3a" stroke-width="3" stroke-linecap="round"/>
      <rect x="10" y="10" width="138" height="24" rx="12" fill="#fff" opacity=".9"/><text x="79" y="27" text-anchor="middle" font-size="13" font-weight="700" fill="#B4361F">SAMPLE PHOTO</text>
      <text x="310" y="168" text-anchor="end" font-size="12" fill="#1F2D3D">${esc(v ? v.date + " · " + v.type : "No photo yet")}${ph ? " · " + esc(ph.id) : ""}</text></svg>`;
  }

  /* ---------- My VTS: map and list ---------- */
  function myVts() {
    const sites = St.sites();
    view().innerHTML = `
      <div class="l-row"><h2 style="margin:0">My VTS</h2><span class="l-sp"></span><label class="check" style="min-height:0"><input type="checkbox" id="tShowOff" checked> Show decommissioned</label><a class="btn" href="#tool/vts/new">Register a system</a></div>
      <div class="t-grid"><div class="lmap panel" id="tmap" aria-label="Map of your VTS"></div><div class="t-list" id="tlist"></div></div>
      <p class="small muted">Sample sites in made-up places. Colored dot: system type. Grey dashed dot: decommissioned. ${legend()}</p>`;
    q("#tShowOff").onchange = () => draw();
    if (window.L && window.L.map) {
      map = window.L.map("tmap", {scrollWheelZoom: false});
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap contributors"}).addTo(map);
    } else q("#tmap").innerHTML = `<p class="muted" style="padding:1rem">The map could not load. The list still works.</p>`;
    function draw() {
      const show = q("#tShowOff").checked, list = sites.filter(s => show || s.status !== "decommissioned");
      q("#tlist").innerHTML = list.map(s => { const lv = lastVisit(s.id); return `<a class="t-item${s.status === "decommissioned" ? " off" : ""}" href="#tool/vts/${s.id}"><span class="sdot" style="background:${s.status === "decommissioned" ? "#9AA7B5" : COLOR[s.type]}"></span>
        <span><b>${esc(s.name)}</b><small>${esc(NAME[s.type])} · ${s.status === "decommissioned" ? "decommissioned" : lv ? "last visit " + lv.date : "no visits yet"}</small></span></a>`; }).join("") || `<p class="muted">No VTS yet. Add one.</p>`;
      if (!map) return;
      map.eachLayer(l => { if (l instanceof window.L.CircleMarker) map.removeLayer(l); });
      const pts = [];
      list.filter(s => s.location).forEach(s => {
        const off = s.status === "decommissioned", ll = [s.location.lat, s.location.lon]; pts.push(ll);
        window.L.circleMarker(ll, {radius: 10, color: off ? "#5B6E83" : "#fff", weight: 2, dashArray: off ? "3 3" : null, fillColor: off ? "#C9D2DC" : COLOR[s.type], fillOpacity: off ? .6 : .95})
          .addTo(map).bindPopup(`<b>${esc(s.name)}</b><br>${esc(NAME[s.type])}<br>${off ? "Decommissioned " + esc(s.decommissioned?.date || "") : "Active"}<br><a href="#tool/vts/${s.id}">Open its card</a>`);
      });
      if (pts.length) map.fitBounds(pts, {padding: [30, 30], maxZoom: 12}); else map.setView([36.7, -121.6], 9);
    }
    draw(); if (map) setTimeout(() => map.invalidateSize(), 50);
  }
  const legend = () => Object.entries(NAME).map(([k, n]) => `<span class="sdot" style="background:${COLOR[k]}"></span>${n}`).join(" &nbsp; ");

  /* ---------- one VTS card ---------- */
  function card(id, sub, yr) {
    const s = St.site(id);
    if (!s) { view().innerHTML = `<p>VTS not found. <a href="#tool/vts">Back to My VTS</a></p>`; return; }
    const lv = lastVisit(id), pv = lastPhotoVisit(id), np = nextPlanned(id), p = s.params || {}, off = s.status === "decommissioned";
    const conds = (L.siteParams && L.siteParams[s.type] || []).filter(f => !/^(year built|drainage area)/i.test(f.field)).map(f => [f.field, paramValue(p, f.field)]);   /* year built and drainage area are in Design */
    const hist = St.revisionsOf(id).slice().reverse();
    view().innerHTML = `
      <p><a href="#tool/vts">← My VTS</a></p>
      <div class="t-card${off ? " off" : ""}">
        <div class="t-band" style="background:${off ? "#7A8896" : COLOR[s.type]}"><span>${esc(NAME[s.type])}</span><span class="l-sp"></span>${statusChip(s)}</div>
        <div class="t-head"><h2 class="l-title" style="margin:0">${esc(s.name)}</h2><p class="muted">Project owner: ${esc(s.project_owner)} · ${s.huc12 ? esc(s.huc12.name) : "Sub-watershed not set"}</p>
          ${off ? `<p class="l-warn"><b>Decommissioned on ${esc(s.decommissioned.date)} (${esc(s.decommissioned.category)}).</b> ${esc(s.decommissioned.reason)}</p>` : ""}
          <nav class="l-pills t-ctabs" aria-label="This VTS"><a class="l-pill" href="#tool/vts/${id}"${sub !== "history" ? ' aria-current="page"' : ""}>Overview</a><a class="l-pill" href="#tool/vts/${id}/history"${sub === "history" ? ' aria-current="page"' : ""}>Site History</a>${off ? "" : `<a class="l-pill" href="#tool/plan/${id}">Yearly plan</a>`}<a class="l-pill" href="#tool/corrective/${id}">Corrective log</a></nav></div>
        ${sub === "history" && window.ToolHistory ? `<div class="t-hist">${window.ToolHistory.render(id, yr)}</div>` : `<div class="l-two">
          <div class="stack">
            <figure class="t-fig">${photoSvg(s, pv)}<figcaption class="l-src">Latest visit photo. Real photos will come from the Visit Sheet once accounts and storage exist.</figcaption></figure>
            <div class="l-box"><b>Design</b><div><table class="t-kv">${[["Year built", s.year_built || "Not recorded"], ["Drainage area", s.drainage_area ? s.drainage_area.value + " " + s.drainage_area.unit : "Not recorded"], ...(s.design || []).map(d => [d.label, d.value])].map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table></div></div>
            <div class="l-box"><b>Site Conditions</b><div><table class="t-kv">${conds.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v ? esc(v) : '<span class="muted">Not set</span>'}</td></tr>`).join("")}</table><p class="l-src">The fields of the "Site conditions" block of the Visit Sheet for this system type.</p></div></div>
            <div class="l-box"><b>Documents</b><div>${(s.documents || []).map(d => `<p class="l-row"><span>${esc(d.title)}</span><span class="l-sp"></span><span class="l-src">${esc(d.kind)}${d.date ? " · " + esc(d.date) : ""}</span>${d.url ? `<a href="${esc(d.url)}">Open</a>` : '<span class="l-src">sample, no file</span>'}</p>`).join("") || '<p class="muted">No documents yet.</p>'}</div></div>
          </div>
          <div class="stack">
            <div class="l-box"><b>Sharing</b><div><p class="l-src">Who sees each part of this record. Point at or tap the ⓘ for what each choice means.</p>
              ${["location", "documents", "status"].map(k => shareRow(s, k)).join("")}
              <p class="l-src">In this prototype nothing is published: your choice is only saved in this browser.</p></div></div>
            <div class="l-box"><b>Visits</b><div><table class="t-kv"><tr><th>Last visit</th><td>${lv ? esc(lv.date + " · " + lv.type) : "None yet"}</td></tr><tr><th>Next planned</th><td>${off ? "None (decommissioned)" : np ? esc(np.date + " · " + np.type) : "Not planned"}</td></tr>
              <tr><th>Visits recorded</th><td>${St.visitsOf(id).length}</td></tr></table><p><a href="#tool/vts/${id}/history">Site History: every visit, repair and change</a></p><p><a href="#learn/manual/${s.type}">The tasks of a ${esc(NAME[s.type].toLowerCase())} in the manual</a></p></div></div>
            <div class="l-box ${off ? "" : "warn"}"><b>${off ? "Bring it back" : "Take it out of service"}</b><div>${off
              ? `<p>If the system is working again, reactivate it. The record and its history stay.</p><button class="btn ghost sm" type="button" id="tReact">Reactivate</button>`
              : `<p>Decommission a VTS that is removed, replaced, or no longer maintained. It stays on the map, greyed out, with its record and the reason.</p><button class="btn ghost sm" type="button" id="tDecom">Decommission…</button>`}</div></div>
            <div class="l-box"><b>Change history</b><div>${hist.length ? `<table class="t-kv">${hist.map(h => `<tr><th>${esc(h.when.slice(0, 16).replace("T", " "))}</th><td>${esc(h.field)}: ${esc(short(h.old_value))} → ${esc(short(h.new_value))}<br><span class="l-src">${esc(h.reason)}${h.category ? " (" + esc(h.category) + ")" : ""} · ${esc(h.who_role)}</span></td></tr>`).join("")}</table>` : '<p class="muted">No changes recorded.</p>'}</div></div>
          </div>
        </div>`}
      </div>`;
    bar(St.session());
    if (sub === "history" && window.ToolHistory) { window.ToolHistory.wire(id, () => card(id, sub, yr)); return; }
    qa(".t-seg button").forEach(b => b.onclick = () => {
      const item = b.closest(".t-seg").dataset.item, level = b.dataset.l;
      if ((s.privacy || {})[item] === level) return;
      St.update("sites", id, {privacy: {...(s.privacy || {}), [item]: level}}, `Sharing of ${ITEM_HELP[item].label.toLowerCase()} set to ${level}`, "sharing");
      card(id);
    });
    if (q("#tDecom")) q("#tDecom").onclick = () => decomDlg(s);
    if (q("#tReact")) q("#tReact").onclick = () => reasonDlg("Reactivate this VTS", "Why is it back in service?", reason => { St.update("sites", id, {status: "active", decommissioned: null}, reason, "reactivated"); card(id); });
  }
  const short = v => v === null || v === undefined ? "none" : typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(", ") : String(v);
  function paramValue(p, field) {
    const f = field.toLowerCase(), u = o => o ? `${o.value} ${o.unit}` : "";
    if (f.startsWith("target vegetation height")) return p.target_vegetation_height;
    if (f.startsWith("warning level")) return u(p.warning_level_sediment);
    if (f.startsWith("cleanout level")) return u(p.cleanout_level_sediment);
    if (f.startsWith("nitrate-removal target")) return p.nitrate_removal_target && p.nitrate_removal_target.text;
    if (f.startsWith("vegetation-cover target")) return p.vegetation_cover_target && p.vegetation_cover_target.min_percent + " %";
    if (f.startsWith("photo points")) return p.photo_points && `${p.photo_points.count}: ${p.photo_points.where}`;
    if (f.startsWith("designated mowing")) return p.designated_mowing_areas;
    if (f.startsWith("areas left unmowed")) return p.areas_left_unmowed;
    if (f.startsWith("pump")) return p.pump && (p.pump.present ? "Yes. " + (p.pump.owner_contact || "Owner not set") : "No");
    if (f.startsWith("operating water-level")) return p.operating_water_level_range;
    if (f.startsWith("overflow marker")) return p.overflow_marker;
    if (f.startsWith("drawdown time")) return p.drawdown_time;
    if (f.startsWith("year built") || f.startsWith("drainage area")) return "see Design";
    return p[field] || "";
  }
  function shareRow(s, k) {
    const cur = (s.privacy || {})[k] || "private", h = ITEM_HELP[k];
    return `<div class="t-share"><span class="t-sharel">${h.label} <button type="button" class="t-info" aria-label="What the choices mean for ${h.label}" title="${LEVELS.map(([l, n]) => n + ": " + h[l]).join("\n")}">ⓘ</button></span>
      <span class="t-seg" role="group" aria-label="${h.label} sharing" data-item="${k}">${LEVELS.map(([l, n]) => `<button type="button" data-l="${l}" aria-pressed="${cur === l}" title="${esc(LEVEL_HELP[l] + " " + h[l])}">${n}</button>`).join("")}</span>
      <span class="l-src t-sharenow">${esc(h[cur])}</span></div>`;
  }

  /* shared with tool_plan.js */
  window.ToolKit = {q, qa, esc, COLOR, NAME, view, today, openDlg: (...a) => openDlg(...a), reasonDlg: (...a) => reasonDlg(...a), bar: () => bar(St.session()), lastVisit, nextPlanned, paramValue};

  /* ---------- dialogs ---------- */
  const dlg = () => q("#toolDlg");
  function openDlg(html, onOpen) { dlg().innerHTML = `<div class="l-sheet"><button class="btn ghost sm l-x" type="button" data-close>Close</button>${html}</div>`; qa("[data-close]", dlg()).forEach(b => b.onclick = () => dlg().close()); dlg().showModal(); if (onOpen) onOpen(); }
  function reasonDlg(title, label, done) {
    openDlg(`<h3>${esc(title)}</h3><form id="tRF" class="stack"><div class="f"><label for="tRr">${esc(label)} (required)</label><textarea id="tRr" required></textarea></div><div class="row"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    qa("[data-close]", dlg()).forEach(b => b.onclick = () => dlg().close());
    q("#tRF").onsubmit = e => { e.preventDefault(); const r = q("#tRr").value.trim(); if (!r) return; dlg().close(); done(r); };
  }
  function decomDlg(s) {
    openDlg(`<h3>Decommission ${esc(s.name)}</h3><p class="l-src">The VTS stays in your list and on the map, greyed out. Its visits and records are kept.</p>
      <form id="tDF" class="stack"><div class="grid2"><div class="f"><label for="tDd">Date</label><input type="date" id="tDd" value="${today()}" required></div>
      <div class="f"><label for="tDc">What happened</label><select id="tDc">${DECOM.map(c => `<option>${c}</option>`).join("")}</select></div></div>
      <div class="f"><label for="tDr">Why (required)</label><textarea id="tDr" required placeholder="For example: replaced by a new basin downstream"></textarea></div>
      <div class="row"><button class="btn" type="submit">Decommission</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    qa("[data-close]", dlg()).forEach(b => b.onclick = () => dlg().close());
    q("#tDF").onsubmit = e => {
      e.preventDefault(); const r = q("#tDr").value.trim(); if (!r) return;
      St.update("sites", s.id, {status: "decommissioned", decommissioned: {date: q("#tDd").value, category: q("#tDc").value, reason: r}}, r, "decommissioned");
      dlg().close(); card(s.id);
    };
  }

})();
