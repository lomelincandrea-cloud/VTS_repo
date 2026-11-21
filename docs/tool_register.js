/* Register a system: a step-by-step page that asks everything the VTS record needs.
   Steps: 1 System, 2 Location, 3 Design, 4 Site Conditions (from the Visit Sheet of that type), 5 Documents, 6 Sharing, 7 Review.
   Route: #tool/vts/new. The draft is kept in this browser until it is saved or discarded. Uses ToolKit (tool.js) and VTSStore. */
window.ToolRegister = (function () {
  "use strict";
  const St = window.VTSStore, L = window.VTS_LEARN || {}, K = () => window.ToolKit;
  const esc = s => K().esc(s), q = (s, r) => K().q(s, r), qa = (s, r) => K().qa(s, r);
  const DRAFT = "vts_register_draft";
  const STEPS = ["System", "Location", "Design", "Site Conditions", "Documents", "Sharing", "Review"];
  const ABOUT = {
    SB: "A basin that slows runoff so sediment settles before the water leaves the field.",
    TW: "A shallow wetland with plants that remove nitrate and sediment.",
    VD: "A ditch with grass and plants on its banks and bottom that slow the water and hold soil.",
    WB: "A buried bed of woodchips that removes nitrate from drainage water."};
  const DESIGN = {
    SB: ["Basin volume", "Basin depth", "Outlet"],
    TW: ["Wetland area", "Design retention time", "Cells"],
    VD: ["Length", "Bottom width", "Side slopes"],
    WB: ["Bed size", "Media", "Control structures"]};
  const DOC_KINDS = ["Design drawings", "Planting plan", "Permit", "Agreement with the project owner", "Site Card (VTS_F07)", "Photo", "Other"];
  const UNITS = ["in", "ft", "cm"];
  const SKIP = /^(year built|drainage area)/i;   /* asked in step 1 */
  let st = null, step = 0, pick = null;

  const blank = () => ({type: "", name: "", project_owner: "", year_built: "", drainage: "", location: null, huc12: "",
    design: [], params: {}, documents: [], privacy: {location: "private", documents: "private", status: "private"},
    sharing: {wildlife_in_food_safety_record: false, show_owner_in_water_summary: false}});
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify({st, step})); } catch (e) {} };
  const clear = () => { try { localStorage.removeItem(DRAFT); } catch (e) {} };
  function load() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d && d.st) { st = d.st; step = d.step || 0; return; } } catch (e) {} st = blank(); step = 0; }

  /* one key per Site Conditions field of the Visit Sheet; the card reads them back with ToolKit.paramValue */
  function kindOf(field) {
    const f = field.toLowerCase();
    if (f.startsWith("warning level")) return ["level", "warning_level_sediment"];
    if (f.startsWith("cleanout level")) return ["level", "cleanout_level_sediment"];
    if (f.startsWith("nitrate-removal target")) return ["nitrate", "nitrate_removal_target"];
    if (f.startsWith("vegetation-cover target")) return ["percent", "vegetation_cover_target"];
    if (f.startsWith("photo points")) return ["photos", "photo_points"];
    if (f.startsWith("pump")) return ["pump", "pump"];
    if (f.startsWith("target vegetation height")) return ["text", "target_vegetation_height"];
    if (f.startsWith("designated mowing")) return ["area", "designated_mowing_areas"];
    if (f.startsWith("areas left unmowed")) return ["area", "areas_left_unmowed"];
    if (f.startsWith("operating water-level")) return ["text", "operating_water_level_range"];
    if (f.startsWith("overflow marker")) return ["text", "overflow_marker"];
    if (f.startsWith("drawdown time")) return ["text", "drawdown_time"];
    return ["text", f.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")];
  }
  const fields = () => (L.siteParams && L.siteParams[st.type] || []).filter(f => !SKIP.test(f.field));

  /* ---------- page ---------- */
  function page() {
    if (!st) load();
    const v = K().view();
    v.innerHTML = `<p><a href="#tool/vts">← My VTS</a></p>
      <div class="l-row"><h2 style="margin:0">Register a system</h2><span class="l-sp"></span><button class="btn ghost sm" type="button" id="rgDiscard">Discard this draft</button></div>
      <p class="muted">Seven short steps. Only the first one is needed to save; the rest can be filled in later from the card. The draft stays in this browser while you work.</p>
      <ol class="rg-steps" id="rgSteps">${stepsHtml()}</ol>
      <div class="rg-layout"><form id="rgF" class="panel rg-body" novalidate>${body()}
        <p class="l-warn" id="rgMsg" hidden></p>
        <div class="row rg-nav">${step > 0 ? '<button class="btn ghost" type="button" id="rgBack">Back</button>' : ""}<span class="l-sp"></span>
          ${step < STEPS.length - 1 ? '<button class="btn" type="submit">Next</button>' : '<button class="btn" type="submit">Save the VTS</button>'}</div></form>
        <aside class="rg-prev" aria-label="Preview of the card"><p class="l-src">The card, as it fills in</p><div id="rgPrev">${preview()}</div></aside></div>`;
    K().bar();
    wire();
    /* the card on the right and the step counts follow what is typed */
    const F = q("#rgF"), live = () => { read(); q("#rgPrev").innerHTML = preview(); q("#rgSteps").innerHTML = stepsHtml(); wireSteps(); };
    F.addEventListener("input", live); F.addEventListener("change", live);
  }
  /* how much of each step is filled: [filled, of] (of = null when it is just a count) */
  function filled(i) {
    const has = x => x !== undefined && x !== null && String(x).trim() !== "";
    if (i === 0) return [[st.type, st.name, st.project_owner, st.year_built, st.drainage].filter(has).length, 5];
    if (i === 1) return [[st.location, st.huc12].filter(has).length, 2];
    if (i === 2) { const d = st.design.length ? st.design : (DESIGN[st.type] || []).map(l => ({label: l, value: ""})); return [d.filter(x => has(x.value)).length, d.length]; }
    if (i === 3) { const f = fields(); return [f.filter(x => { const v = st.params[kindOf(x.field)[1]]; return v !== undefined && v !== null && v !== ""; }).length, f.length]; }
    if (i === 4) return [st.documents.length, null];
    return [1, 1];
  }
  function stepsHtml() {
    return STEPS.map((n, i) => {
      const [a, b] = i < 6 ? filled(i) : [0, 0], done = i < 6 && (b === null ? a > 0 : a === b && b > 0);
      const note = i >= 5 ? "" : b === null ? `${a} added` : `${a} of ${b} filled`;
      return `<li><button type="button" data-rs="${i}" class="${i === step ? "on" : done ? "past" : ""}"${i === step ? ' aria-current="step"' : ""}><span>${done ? "✓" : i + 1}</span>${esc(n)}${note ? `<small class="rg-cnt">${note}</small>` : ""}${done ? '<span class="vh"> (complete)</span>' : ""}</button></li>`;
    }).join("");
  }
  /* the same layout as the VTS card (header, Design, Site Conditions, Documents, Sharing); empty fields say "Not set" */
  function preview() {
    const ns = '<span class="rg-ns">Not set</span>', val = x => x === undefined || x === null || String(x).trim() === "" ? ns : esc(x);
    const c = st.type ? K().COLOR[st.type] : "#6B8574";
    const design = [["Year built", st.year_built], ["Drainage area", st.drainage ? st.drainage + " acres" : ""], ...(st.design.length ? st.design : (DESIGN[st.type] || []).map(l => ({label: l, value: ""}))).map(d => [d.label, d.value])];
    return `<div class="t-card"><div class="t-band" style="background:${c}"><span>${st.type ? esc(K().NAME[st.type]) : "System type not chosen"}</span><span class="l-sp"></span><span class="l-chip">Draft</span></div>
      <div class="t-head"><h3 style="margin:0">${st.name ? esc(st.name) : ns}</h3><p class="muted">Project owner: ${val(st.project_owner)} · ${st.huc12 ? esc(st.huc12) : "Sub-watershed not set"}</p><p class="l-src">${st.location ? `Placed on the map at ${st.location.lat}, ${st.location.lon}` : "Not placed on the map yet"}</p></div>
      <div class="rg-pbody">
        <div class="l-box"><b>Design</b><div><table class="t-kv">${design.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${val(v)}</td></tr>`).join("")}</table></div></div>
        <div class="l-box"><b>Site Conditions</b><div>${st.type ? `<table class="t-kv">${fields().map(f => `<tr><th>${esc(f.field)}</th><td>${val(show(st.params[kindOf(f.field)[1]]))}</td></tr>`).join("")}</table>` : `<p class="l-src">Choose the system type first.</p>`}</div></div>
        <div class="l-box"><b>Documents</b><div>${st.documents.length ? st.documents.map(d => `<p>${val(d.title)} <span class="l-src">${esc(d.kind)}${d.date ? " · " + esc(d.date) : ""}</span></p>`).join("") : '<p class="rg-ns">None yet</p>'}</div></div>
        <div class="l-box"><b>Sharing</b><div><table class="t-kv">${[["Location", st.privacy.location], ["Documents", st.privacy.documents], ["Status", st.privacy.status]].map(([k, v]) => `<tr><th>${k}</th><td>${esc(v[0].toUpperCase() + v.slice(1))}</td></tr>`).join("")}</table></div></div>
      </div></div>`;
  }

  function body() {
    if (step === 0) return `<h3>1. What system is it?</h3>
      <div class="rg-types" role="radiogroup" aria-label="System type">${Object.entries(K().NAME).map(([k, n]) => `<label class="rg-type${st.type === k ? " on" : ""}" style="--c:${K().COLOR[k]}"><input type="radio" name="rgT" value="${k}"${st.type === k ? " checked" : ""}>
        <span class="sdot" style="background:${K().COLOR[k]}"></span><b>${n}</b><small>${esc(ABOUT[k])}</small></label>`).join("")}</div>
      <div class="grid2"><div class="f"><label for="rgN">Name (required)</label><input id="rgN" value="${esc(st.name)}" placeholder="For example: North field basin"></div>
        <div class="f"><label for="rgO">Project owner (required)</label><input id="rgO" value="${esc(st.project_owner)}" placeholder="The farm or landowner"><span class="l-src">Shared exports do not show the owner unless you choose so in step 6.</span></div>
        <div class="f"><label for="rgY">Year built</label><input id="rgY" type="number" min="1950" max="2100" inputmode="numeric" value="${esc(st.year_built)}"></div>
        <div class="f"><label for="rgA">Drainage area (acres)</label><input id="rgA" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(st.drainage)}"><span class="l-src">From the design.</span></div></div>`;
    if (step === 1) return `<h3>2. Where is it?</h3>
      <p>Tap the map at the system. You can drag the map and zoom. The exact place is private unless you share it in step 6.</p>
      <div id="rgMap" class="t-pick rg-map"></div>
      <p class="l-src" id="rgLL">${st.location ? `Placed at ${st.location.lat}, ${st.location.lon}.` : "Not placed yet."}</p>
      <div class="row"><button class="btn ghost sm" type="button" id="rgClearLL"${st.location ? "" : " hidden"}>Remove the point</button></div>
      <div class="f"><label for="rgH">Sub-watershed (HUC-12), if you know it</label><input id="rgH" value="${esc(st.huc12)}" placeholder="Name or 12-digit code"><span class="l-src">Watershed summaries use it instead of the exact place. In the full Tool it comes from the map point.</span></div>`;
    if (step === 2) {
      if (!st.design.length) st.design = (DESIGN[st.type] || []).map(label => ({label, value: ""}));
      return `<h3>3. Design</h3><p>The main numbers from the design drawings. Change a label if yours is different, or add a line.</p>
      <div class="rg-rows">${st.design.map((d, i) => `<div class="rg-row"><input aria-label="What" data-dl="${i}" value="${esc(d.label)}"><input aria-label="Value for ${esc(d.label)}" data-dv="${i}" value="${esc(d.value)}" placeholder="Value and unit"><button type="button" class="btn ghost sm" data-ddel="${i}" aria-label="Remove ${esc(d.label)}">✕</button></div>`).join("")}</div>
      <div class="row"><button class="btn ghost sm" type="button" id="rgDAdd">+ Add a line</button></div>`;
    }
    if (step === 3) return `<h3>4. Site Conditions</h3>
      <p>These are the values crews compare against on every visit. They are the "Site conditions" block of the ${esc(K().NAME[st.type].toLowerCase())} Visit Sheet. <a href="#learn/manual/${st.type}">See the manual</a>.</p>
      ${fields().map(f => cond(f)).join("")}`;
    if (step === 4) return `<h3>5. Documents</h3><p>List the documents that exist for this system. In this prototype only the name of a file is kept; the file is not uploaded.</p>
      <div class="rg-rows">${st.documents.map((d, i) => `<div class="rg-doc"><input aria-label="Title" data-gt="${i}" value="${esc(d.title)}" placeholder="Title">
        <select aria-label="Kind" data-gk="${i}">${DOC_KINDS.map(k => `<option${k === d.kind ? " selected" : ""}>${k}</option>`).join("")}</select>
        <input type="date" aria-label="Date" data-gd="${i}" value="${esc(d.date || "")}"><button type="button" class="btn ghost sm" data-gdel="${i}" aria-label="Remove">✕</button>
        ${d.file ? `<span class="l-src">File: ${esc(d.file)} (not uploaded in the prototype)</span>` : ""}</div>`).join("") || '<p class="muted">No documents yet.</p>'}</div>
      <div class="row"><button class="btn ghost sm" type="button" id="rgGAdd">+ Add a document</button><label class="btn ghost sm rg-file">Choose a file…<input type="file" id="rgGFile" hidden></label></div>`;
    if (step === 5) return `<h3>6. Who can see it</h3><p>Every part starts as Private. Change only what the project owner agreed to share.</p>
      ${[["location", "Location", "The point on the map."], ["documents", "Documents", "The files listed in step 5."], ["status", "Status", "Whether the system is working and when it was last visited."]].map(([k, n, d]) => `<div class="rg-share"><div><b>${n}</b><span class="l-src">${d}</span></div>
        <span class="t-seg" role="group" aria-label="${n}" data-pi="${k}">${[["private", "Private"], ["watershed", "Watershed"], ["public", "Public"]].map(([l, t]) => `<button type="button" data-l="${l}" aria-pressed="${st.privacy[k] === l}">${t}</button>`).join("")}</span>
        <span class="l-src rg-sharenow">${esc(HELP[st.privacy[k]])}</span></div>`).join("")}
      <label class="check"><input type="checkbox" id="rgW"${st.sharing.wildlife_in_food_safety_record ? " checked" : ""}> Include wildlife seen at visits in the Food Safety Record</label>
      <label class="check"><input type="checkbox" id="rgS"${st.sharing.show_owner_in_water_summary ? " checked" : ""}> Show the project owner's name in the Water Quality and Maintenance Summary</label>`;
    return review();
  }
  const HELP = {private: "Only your organization and the people you invite.", watershed: "Only inside sub-watershed (HUC-12) summaries. Never the exact place or the owner's name.", public: "Anyone can see it on the public site."};

  function cond(f) {
    const [kind, key] = kindOf(f.field), v = st.params[key], id = "rgP_" + key, note = f.notes ? `<span class="l-src">${esc(f.notes)}</span>` : "";
    const req = kind === "photos" ? " (needed before the first visit)" : "";
    if (kind === "level") return `<div class="f"><label for="${id}">${esc(f.field)}</label><div class="rg-inline"><input id="${id}" type="number" min="0" step="0.1" inputmode="decimal" data-pk="${key}" data-pt="level" value="${v ? v.value : ""}">
      <select aria-label="Unit" data-pu="${key}">${UNITS.map(u => `<option${v && v.unit === u ? " selected" : ""}>${u}</option>`).join("")}</select></div>${note}</div>`;
    if (kind === "percent") return `<div class="f"><label for="${id}">${esc(f.field)}</label><div class="rg-inline"><input id="${id}" type="number" min="0" max="100" step="5" inputmode="numeric" data-pk="${key}" data-pt="percent" value="${v ? v.min_percent : ""}"><span>% at least</span></div>${note}</div>`;
    if (kind === "nitrate") return `<div class="f"><label for="${id}">${esc(f.field)}</label><div class="rg-inline"><span>Outlet at least</span><input id="${id}" type="number" min="0" step="0.5" inputmode="decimal" data-pk="${key}" data-pt="nitrate" value="${v ? v.min_difference : ""}"><span>mg/L NO3-N lower than the inlet, measured by</span>
      <select aria-label="Method" data-pm="${key}">${[["laboratory", "laboratory pair"], ["field measurement", "field measurement"]].map(([m, t]) => `<option value="${m}"${v && v.method === m ? " selected" : ""}>${t}</option>`).join("")}</select></div>${note}<span class="l-src">Leave empty if the designer set no target.</span></div>`;
    if (kind === "photos") return `<div class="f"><label for="${id}">${esc(f.field)}${req}</label><div class="rg-inline"><input id="${id}" type="number" min="1" max="20" inputmode="numeric" data-pk="${key}" data-pt="photos" value="${v ? v.count : ""}" aria-label="Number of photo points"><span>photo points, marked at</span></div>
      <input data-pw="${key}" aria-label="Where the photo points are marked" value="${esc(v ? v.where : "")}" placeholder="For example: blue stakes at the inlet, the north berm and the outlet">${note}</div>`;
    if (kind === "pump") return `<div class="f"><span class="rg-lab">${esc(f.field)}</span><div class="rg-inline" role="radiogroup" aria-label="Is there a pump">${["no", "yes"].map(x => `<label class="check"><input type="radio" name="rgPump" value="${x}" data-pk="${key}" data-pt="pump"${(v ? v.present : "no") === (x === "yes") || (!v && x === "no") ? " checked" : ""}> ${x === "yes" ? "Yes" : "No"}</label>`).join("")}</div>
      <input data-po="${key}" aria-label="Pump owner and contact" value="${esc(v && v.owner_contact || "")}" placeholder="Who owns it, who checks and repairs it, and how to reach them"${v && v.present ? "" : " hidden"}>${note}</div>`;
    const big = kind === "area";
    return `<div class="f"><label for="${id}">${esc(f.field)}</label>${big ? `<textarea id="${id}" data-pk="${key}" data-pt="text" rows="2">${esc(v || "")}</textarea>` : `<input id="${id}" data-pk="${key}" data-pt="text" value="${esc(v || "")}">`}${note}</div>`;
  }

  function missing() {
    const m = [];
    if (!st.location) m.push(["Location", 1]);
    if (!st.design.some(d => d.value.trim())) m.push(["Design", 2]);
    fields().forEach(f => { const [, key] = kindOf(f.field), v = st.params[key]; if (v === undefined || v === null || v === "") m.push([f.field, 3]); });
    return m;
  }
  function review() {
    const m = missing(), n = K().NAME[st.type], pp = st.params.photo_points;
    const rows = [["System", n], ["Name", st.name], ["Project owner", st.project_owner], ["Year built", st.year_built || "Not set"], ["Drainage area", st.drainage ? st.drainage + " acres" : "Not set"],
      ["Location", st.location ? `${st.location.lat}, ${st.location.lon}` : "Not placed"], ["Sub-watershed", st.huc12 || "Not set"],
      ...st.design.filter(d => d.value.trim()).map(d => [d.label, d.value]),
      ...fields().map(f => { const [, key] = kindOf(f.field); return [f.field, show(st.params[key]) || "Not set"]; }),
      ["Documents", st.documents.length ? st.documents.map(d => d.title || d.kind).join("; ") : "None"],
      ["Sharing", `Location ${st.privacy.location}, documents ${st.privacy.documents}, status ${st.privacy.status}`]];
    return `<h3>7. Review and save</h3>
      ${m.length ? `<div class="l-warn"><b>Not filled in yet:</b> ${m.map(([t, s]) => `<button type="button" class="rg-jump" data-rs="${s}">${esc(t)}</button>`).join(", ")}. You can save now and add them later from the card.${!pp ? " Photo points are needed before the first visit." : ""}</div>` : '<p class="l-chip g">Everything is filled in.</p>'}
      <table class="t-kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
      <label class="check"><input type="checkbox" id="rgPlan" checked> Also start the ${planYear()} yearly plan, with the visits the manual fixes that are still ahead</label>`;
  }
  /* the plan year: this year while a fixed visit (last one: pre-storm, Aug 19) is still ahead, otherwise next year */
  const planYear = () => { const t = K().today(), y = +t.slice(0, 4); return t <= `${y}-08-19` ? y : y + 1; };
  const show = v => v === undefined || v === null || v === "" ? "" : typeof v !== "object" ? String(v)
    : "unit" in v && "value" in v ? `${v.value} ${v.unit}` : "min_percent" in v ? `${v.min_percent} % at least` : "count" in v ? `${v.count}: ${v.where || "where not set"}`
    : "present" in v ? (v.present ? "Yes. " + (v.owner_contact || "Owner not set") : "No") : v.text || "";

  /* ---------- read the step back into the draft ---------- */
  function read() {
    const F = q("#rgF");
    if (step === 0) { const t = q('input[name="rgT"]:checked', F); if (t && t.value !== st.type) { st.type = t.value; st.design = []; st.params = {}; } st.name = q("#rgN").value; st.project_owner = q("#rgO").value; st.year_built = q("#rgY").value; st.drainage = q("#rgA").value; }
    if (step === 1) st.huc12 = q("#rgH").value.trim();
    if (step === 2) st.design = qa("[data-dl]", F).map(i => ({label: i.value.trim(), value: q(`[data-dv="${i.dataset.dl}"]`, F).value.trim()})).filter(d => d.label);
    if (step === 3) qa("[data-pk]", F).forEach(i => {
      const key = i.dataset.pk, t = i.dataset.pt, val = i.value.trim();
      if (t === "level") st.params[key] = val === "" ? null : {value: +val, unit: q(`[data-pu="${key}"]`, F).value};
      else if (t === "percent") st.params[key] = val === "" ? null : {min_percent: +val};
      else if (t === "nitrate") { const m = q(`[data-pm="${key}"]`, F).value; st.params[key] = val === "" ? null : {text: `Outlet at least ${+val} mg/L NO3-N lower than the inlet in the ${m === "laboratory" ? "laboratory pair" : "field measurement"}`, min_difference: +val, unit: "mg/L NO3-N", method: m}; }
      else if (t === "photos") { const w = q(`[data-pw="${key}"]`, F).value.trim(); st.params[key] = val === "" && !w ? null : {count: val === "" ? null : +val, where: w}; }
      else if (t === "pump") { if (i.checked) st.params[key] = {present: i.value === "yes", owner_contact: i.value === "yes" ? q(`[data-po="${key}"]`, F).value.trim() : ""}; }
      else st.params[key] = val || null;
    });
    if (step === 4) st.documents = st.documents.map((d, i) => ({...d, title: q(`[data-gt="${i}"]`, F).value.trim(), kind: q(`[data-gk="${i}"]`, F).value, date: q(`[data-gd="${i}"]`, F).value || null}));
    if (step === 5) st.sharing = {wildlife_in_food_safety_record: q("#rgW").checked, show_owner_in_water_summary: q("#rgS").checked};
    save();
  }
  function check() {
    if (step === 0) {
      const m = [!st.type && "the system type", !st.name.trim() && "a name", !st.project_owner.trim() && "the project owner"].filter(Boolean);
      if (m.length) return `Please choose or fill in ${m.join(", ")}.`;
      const y = st.year_built && +st.year_built; if (y && (y < 1950 || y > new Date().getFullYear() + 1)) return "The year built looks wrong.";
    }
    if (step === 3) {
      const w = st.params.warning_level_sediment, c = st.params.cleanout_level_sediment;
      if (w && c && w.unit === c.unit && w.value >= c.value) return "The warning level should be lower than the cleanout level.";
    }
    return "";
  }
  function go(n) { step = Math.max(0, Math.min(STEPS.length - 1, n)); save(); page(); window.scrollTo({top: q(".rg-steps").getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth"}); }

  function wireSteps() { qa("[data-rs]").forEach(b => b.onclick = () => { read(); const e = check(); if (e && +b.dataset.rs > step) return msg(e); go(+b.dataset.rs); }); }
  function wire() {
    const F = q("#rgF");
    wireSteps();
    if (q("#rgBack")) q("#rgBack").onclick = () => { read(); go(step - 1); };
    q("#rgDiscard").onclick = () => { if (confirm("Discard this draft? What you typed will be lost.")) { clear(); st = blank(); step = 0; page(); } };
    F.onsubmit = e => {
      e.preventDefault(); read(); const err = check(); if (err) return msg(err);
      if (step < STEPS.length - 1) go(step + 1); else finish();
    };
    if (step === 0) qa('input[name="rgT"]', F).forEach(r => r.onchange = () => { qa(".rg-type", F).forEach(l => l.classList.toggle("on", l.contains(r) && r.checked)); });
    if (step === 1) mapStep();
    if (step === 2) {
      q("#rgDAdd").onclick = () => { read(); st.design.push({label: "New line", value: ""}); page(); };
      qa("[data-ddel]", F).forEach(b => b.onclick = () => { read(); st.design.splice(+b.dataset.ddel, 1); if (!st.design.length) st.design.push({label: "Design fact", value: ""}); page(); });
    }
    if (step === 3) qa('input[name="rgPump"]', F).forEach(r => r.onchange = () => { q("[data-po]", F).hidden = !(r.checked && r.value === "yes"); });
    if (step === 4) {
      q("#rgGAdd").onclick = () => { read(); st.documents.push({title: "", kind: DOC_KINDS[0], date: null, url: null}); page(); };
      q("#rgGFile").onchange = e => { const f = e.target.files[0]; if (!f) return; read(); st.documents.push({title: f.name.replace(/\.[^.]+$/, ""), kind: /\.(jpe?g|png|heic)$/i.test(f.name) ? "Photo" : "Other", date: null, url: null, file: f.name}); page(); };
      qa("[data-gdel]", F).forEach(b => b.onclick = () => { read(); st.documents.splice(+b.dataset.gdel, 1); page(); });
    }
    if (step === 5) qa("[data-pi]", F).forEach(g => qa("button", g).forEach(b => b.onclick = () => { read(); st.privacy[g.dataset.pi] = b.dataset.l; save(); page(); }));
  }
  const msg = t => { const m = q("#rgMsg"); m.textContent = t; m.hidden = false; m.scrollIntoView({block: "nearest"}); };

  function mapStep() {
    if (!(window.L && window.L.map)) { q("#rgMap").innerHTML = '<p class="muted" style="padding:1rem">The map could not load. You can place the system later from its card.</p>'; return; }
    if (pick) { pick.remove(); pick = null; }
    const ll0 = st.location ? [st.location.lat, st.location.lon] : null, mine = St.sites().filter(s => s.location);
    pick = window.L.map("rgMap", {scrollWheelZoom: false});
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap contributors"}).addTo(pick);
    mine.forEach(s => window.L.circleMarker([s.location.lat, s.location.lon], {radius: 6, color: "#fff", weight: 1, fillColor: "#9AA7B5", fillOpacity: .9}).addTo(pick).bindTooltip(s.name));
    let mk = ll0 ? window.L.circleMarker(ll0, {radius: 10, color: "#fff", weight: 2, fillColor: K().COLOR[st.type], fillOpacity: 1}).addTo(pick) : null;
    if (ll0) pick.setView(ll0, 14); else if (mine.length) pick.fitBounds(mine.map(s => [s.location.lat, s.location.lon]), {padding: [30, 30], maxZoom: 12}); else pick.setView([36.68, -121.62], 10);
    pick.on("click", e => {
      st.location = {lat: +e.latlng.lat.toFixed(5), lon: +e.latlng.lng.toFixed(5)};
      if (mk) mk.setLatLng(e.latlng); else mk = window.L.circleMarker(e.latlng, {radius: 10, color: "#fff", weight: 2, fillColor: K().COLOR[st.type], fillOpacity: 1}).addTo(pick);
      q("#rgLL").textContent = `Placed at ${st.location.lat}, ${st.location.lon}.`; q("#rgClearLL").hidden = false; save();
    });
    q("#rgClearLL").onclick = () => { st.location = null; if (mk) { pick.removeLayer(mk); mk = null; } q("#rgLL").textContent = "Not placed yet."; q("#rgClearLL").hidden = true; save(); };
    setTimeout(() => pick && pick.invalidateSize(), 80);
  }

  function finish() {
    const id = St.nextId("sites", "S-NEW-"), a = parseFloat(st.drainage), y = parseInt(st.year_built, 10);
    St.add("sites", {id, name: st.name.trim(), type: st.type, year_built: isNaN(y) ? null : y, drainage_area: isNaN(a) ? null : {value: a, unit: "acres"},
      huc12: st.huc12 ? {code: /^\d{12}$/.test(st.huc12) ? st.huc12 : "", name: st.huc12} : null, location: st.location, project_owner: st.project_owner.trim(),
      status: "active", decommissioned: null, params: st.params, sharing: st.sharing, privacy: st.privacy,
      design: st.design.filter(d => d.value.trim()), documents: st.documents.filter(d => d.title || d.file).map(d => ({title: d.title || d.file, kind: d.kind, date: d.date, url: null}))});
    const plan = q("#rgPlan") && q("#rgPlan").checked && window.ToolPlan, year = planYear();
    if (plan) {   /* a draft plan without the visits already past, so the Site History does not show them as missed */
      window.ToolPlan.newPlan(St.site(id), year);
      const p = St.planOf(id, year); p.planned_visits = p.planned_visits.filter(v => v.date >= K().today()); St.persist();
    }
    if (pick) { pick.remove(); pick = null; }
    clear(); st = null; step = 0;
    location.hash = plan ? `#tool/plan/${id}/${year}` : `#tool/vts/${id}`;
  }
  return {page};
})();
