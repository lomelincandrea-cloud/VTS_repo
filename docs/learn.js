/* Learn: a landing page with four doors and the maintenance cycle; the manual by system (illustration with clickable parts,
   the year, the tasks) and by task; the Field Guide plant picker; and the downloads.
   Data: window.VTS_LEARN, built by tools/build_site_data.py from the two workbooks. Routes: #learn (landing), #learn/manual/SB, #learn/task/SB_T01,
   #learn/topic/TOP-01, #learn/plants, #learn/downloads, #learn/materials. app.js calls window.learnRoute(parts). */
(function () {
  "use strict";
  const L = window.VTS_LEARN;
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const COLOR = {SB: "#2B7BBF", TW: "#3C9D5B", VD: "#C99700", WB: "#DD6B2A", COR: "#B4361F"};
  const MAIN = ["SB", "TW", "VD", "WB"];
  const view = () => q("#learnView");
  if (!L) { window.learnRoute = () => { view().innerHTML = "<p>The manual data could not load.</p>"; }; return; }
  const taskBy = id => L.tasks.find(t => t.id === id);
  const sysTag = s => `<span class="l-sys" style="background:${COLOR[s] || "#5B6E83"}">${esc(s)}</span>`;
  const chip = (t, k = "") => `<span class="l-chip ${k}">${esc(t)}</span>`;
  const box = (title, body, warn) => body ? `<div class="l-box${warn ? " warn" : ""}"><b>${esc(title)}</b><div>${body}</div></div>` : "";
  const dlg = () => q("#learnDlg");
  function openDlg(html) { dlg().innerHTML = `<div class="l-sheet"><button class="btn ghost sm l-x" type="button" aria-label="Close">Close</button>${html}</div>`; q(".l-x", dlg()).onclick = () => dlg().close(); dlg().showModal(); }

  /* two tabs: Read online (the manual, the Field Guide) and Download documents (files, materials, sample reports) */
  function tabs(cur) {
    const tab = ["downloads", "materials"].includes(cur) ? "docs" : "read";
    qa("#learnTabs a").forEach(a => a.dataset.t === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    q("#learnMaterials").hidden = tab !== "docs"; view().hidden = false;
  }
  const label = k => `<span class="l-mod l-mod-${k.toLowerCase().replace(/ /g, "")}">${esc(k)}</span>`;

  window.learnRoute = function (parts) {
    const [v, a] = parts;
    const which = !v ? "landing" : v;
    tabs(["task", "topic"].includes(which) ? "manual" : which);
    if (which === "landing") landing();
    else if (which === "task") task(a);
    else if (which === "topic") topic(a);
    else if (which === "plants") plants();
    else if (which === "downloads" || which === "materials") downloads();
    else if (which === "fieldguide") fieldGuide(a);
    else manual(a);
  };

  /* ---------- Learn landing: four doors, the maintenance cycle, Field Guide ---------- */
  const IP = chip("In progress", "y");
  function landing() {
    view().innerHTML = `
      <div class="l-entry" id="lmancard">
        <a class="l-big" href="#learn/manual/SB"><span class="l-bigi" aria-hidden="true">${ico("book")}</span><b>Operation and Maintenance Manual</b><span>How to look after each system, task by task.</span><span class="btn l-ybtn">Start here →</span></a>
        <a class="l-big" href="#learn/fieldguide"><span class="l-bigi" aria-hidden="true">${ico("leaf")}</span><b>Field Guide</b><span>Plants, signs of problems and parts of a system.</span><span class="btn l-ybtn">Browse →</span></a></div>
      <p class="l-guide">New here? <a href="#lmancard" data-jump="lmancard">Start with the manual →</a></p>
      ${wheelBlock(null, wSel)}
      <div id="wTasks">${wheelTasks(wSel)}</div>
      <section class="stack" id="lcycle" aria-labelledby="lcycleT"><h2 id="lcycleT" class="l-h">How the record works</h2>
        <ol class="l-cycle l-cyc-s">${CYCLE.map(([n, t, w, href, where], i) => `<li><a class="l-cstep" href="${href}"><span class="l-cn">${i + 1}</span><b>${esc(t)}</b><span class="l-cw">${esc(where)} →</span></a></li>`).join("")}</ol></section>`;
    wireWheel(k => { wSel = k; const y = window.scrollY; landing(); window.scrollTo(0, y); const g = q(`.w-seg[data-w="${k}"]`) || q("#wT"); if (g) g.focus({preventScroll: true}); });
    qa("[data-jump]").forEach(x => x.onclick = e => { e.preventDefault(); const t = q("#" + x.dataset.jump); t.scrollIntoView({block: "start"}); t.setAttribute("tabindex", "-1"); t.focus({preventScroll: true}); });
  }
  const CYCLE = [["1", "Plan", "January, in the office", "#tool/plan", "Annual plan in the Tool"],
    ["2", "Visit", "Routine, spring, pre-storm", "#learn/downloads", "Visit Sheet download"],
    ["3", "Look and recognize", "Every visit", "#learn/plants", "Field Guide"],
    ["4", "Fix", "Quick fix or scheduled repair", "#learn/topic/TOP-16", "Corrective Maintenance"],
    ["5", "Record and review", "After every visit and in January", "#tool/vts", "Site History in the Tool"]];


  /* ================= R8.7: Read online · the wheel of the year · the Field Guide complete ================= */
  /* the wheel: one drawing of the year. Segments are buttons that filter the tasks below it (keyboard: Tab, Enter or Space). */
  const WSEG = {
    jan: ["January review (office)", "January, in the office", t => t.visit === "January review (office)"],
    spring: ["Spring visit", "April", t => t.visit === "Spring visit"],
    pre: ["Pre-storm visit", "August", t => t.visit === "Pre-storm visit"],
    post: ["Post-storm visit", "October 1 to April 30: within 48 hours after 0.5 in of rain or more in 24 hours. A visual check", t => t.freq.some(f => /^(After storm|Post-storm)/i.test(f))],
    sed: ["Sediment removal", "Once a year and when needed: best after the storm season, around April, only if the post-storm visit shows it is needed. Make sure basins have capacity before October 1.", t => /^Sediment Removal/.test(t.name)],
    routine: ["Routine visit", "At every scheduled visit", t => t.visit === "Routine visit"],
    needed: ["When needed", "No fixed month: planned when an inspection or a measurement calls for it", t => t.visit === "When needed"]};
  function wheelSvg(sys, sel) {
    const C = 220, R0 = 112, R1 = 150, rad = m => (-90 + m * 30) * Math.PI / 180, pt = (r, m) => [C + r * Math.cos(rad(m)), C + r * Math.sin(rad(m))];
    const f = n => n.toFixed(1);
    const sector = (r0, r1, m0, m1) => { const [a, b] = pt(r1, m0), [c, d] = pt(r1, m1), [e, g] = pt(r0, m1), [h, i] = pt(r0, m0), big = (m1 - m0) * 30 > 180 ? 1 : 0;
      return `M${f(a)} ${f(b)}A${r1} ${r1} 0 ${big} 1 ${f(c)} ${f(d)}L${f(e)} ${f(g)}A${r0} ${r0} 0 ${big} 0 ${f(h)} ${f(i)}Z`; };
    const on = k => sel === k ? " on" : "", btn = (k, label, inner) => `<g class="w-seg${on(k)}" data-w="${k}" role="button" tabindex="0" aria-pressed="${sel === k}" aria-label="${esc(label)}">${inner}</g>`;
    const s = [];
    s.push(`<path d="${sector(R0, R1, 9, 16)}" class="w-rain"/>`);   /* rainy season, October 1 to April 30 */
    MONTHS.forEach((m, i) => { const [x1, y1] = pt(R0, i), [x2, y2] = pt(R1, i), [tx, ty] = pt((R0 + R1) / 2, i + .5);
      s.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="w-tick"/><text x="${f(tx)}" y="${f(ty + 4)}" class="w-mon" text-anchor="middle">${m}</text>`); });
    s.push(`<circle cx="${C}" cy="${C}" r="${R1}" class="w-edge"/><circle cx="${C}" cy="${C}" r="${R0}" class="w-edge"/>`);
    [1.5, 4.5, 7.5, 10.5].forEach(m => { const [x, y] = pt(R1 + 3, m), a = -90 + m * 30 + 90;   /* clockwise arrows */
      s.push(`<path d="M-6 -5L6 0L-6 5Z" class="w-arrow" transform="translate(${f(x)} ${f(y)}) rotate(${a})"/>`); });
    /* post-storm visit: a band over the storm season, up to April 30 */
    const [plx, ply] = pt(R1 + 46, 11.2);
    s.push(btn("post", "Post-storm visit: October 1 to April 30, within 48 hours after 0.5 inches of rain or more in 24 hours",
      `<path d="${sector(R1 + 8, R1 + 24, 9, 16)}" class="w-post"/><text x="${f(plx - 10)}" y="${f(ply - 6)}" text-anchor="end" class="w-lab">Post-storm visit</text><text x="${f(plx - 10)}" y="${f(ply + 10)}" text-anchor="end" class="w-sub">after 0.5 in of rain in 24 h</text><text x="${f(plx - 10)}" y="${f(ply + 24)}" text-anchor="end" class="w-sub">Oct 1 to Apr 30</text>`));
    /* the fixed visits on the rim */
    [["jan", .5, "January review", "office, January", "middle", 0, -14], ["spring", 3.5, "Spring visit", "April", "start", 16, 0], ["pre", 7.5, "Pre-storm visit", "August", "end", -16, 6]].forEach(([k, m, t, sub, anc, dx, dy]) => {
      const [x, y] = pt(R1 + 16, m), [lx, ly] = pt(R1 + 40, m);
      s.push(btn(k, `${t}, ${sub}`, `<circle cx="${f(x)}" cy="${f(y)}" r="13" class="w-dot"/><text x="${f(lx + dx)}" y="${f(ly + dy)}" text-anchor="${anc}" class="w-lab">${t}</text><text x="${f(lx + dx)}" y="${f(ly + dy + 15)}" text-anchor="${anc}" class="w-sub">${sub}</text>`));
    });
    /* sediment removal: dashed and conditional, around April (not for woodchip bioreactors) */
    if (sys !== "WB") { const [sx, sy] = pt(R1 + 52, 5.2);
      s.push(btn("sed", "Sediment removal, around April, only if the post-storm visit shows it is needed", `<path d="${sector(R0 - 18, R0 - 6, 3, 4.8)}" class="w-sed"/><text x="${f(sx)}" y="${f(sy - 4)}" text-anchor="start" class="w-lab">Sediment removal</text><text x="${f(sx)}" y="${f(sy + 11)}" text-anchor="start" class="w-sub">around April, only if the post-</text><text x="${f(sx)}" y="${f(sy + 25)}" text-anchor="start" class="w-sub">storm visit shows it is needed</text>`)); }
    /* routine visit: a ring label; when needed: the centre */
    s.push(`<path id="wRoutineArc" d="M${C - 80} ${C} A80 80 0 0 1 ${C + 80} ${C}" fill="none"/>`);
    s.push(btn("routine", "Routine visit: at every scheduled visit", `<circle cx="${C}" cy="${C}" r="80" class="w-ring"/><text class="w-lab w-sm"><textPath href="#wRoutineArc" startOffset="50%" text-anchor="middle">Routine visit · at every scheduled visit</textPath></text>`));
    s.push(btn("needed", "When needed: no fixed month", `<circle cx="${C}" cy="${C}" r="44" class="w-mid"/><text x="${C}" y="${C - 2}" text-anchor="middle" class="w-lab">When</text><text x="${C}" y="${C + 14}" text-anchor="middle" class="w-lab">needed</text>`));
    return `<svg class="w-svg" viewBox="-130 -10 700 460" role="group" aria-label="The maintenance year as a wheel. Each part is a button that shows the tasks of that visit.">${s.join("")}</svg>`;
  }
  function wheelBlock(sys, sel) {
    const items = Object.entries(WSEG).filter(([k]) => !(sys === "WB" && k === "sed"));
    return `<section class="stack w-box" aria-labelledby="wT"><h2 id="wT" class="l-h">The year</h2>
      <p class="t-intro">Maintenance follows the seasons. Each part of the wheel shows which visit is due. Click it to see its tasks.</p>
      <div class="w-wrap">${wheelSvg(sys, sel)}</div>
      <ul class="vh">${items.map(([k, [n, w]]) => `<li>${esc(n)}: ${esc(w)}</li>`).join("")}<li>The rainy season is October 1 to April 30. The wheel turns clockwise and starts again every January.</li></ul>
      ${sys === "WB" ? `<p class="l-src"><b>Woodchip bioreactors:</b> no sediment removal. At every routine visit, check that sediment is not entering the bioreactor (inlet box and woodchip surface).</p>`
        : !sys ? `<p class="l-src">Woodchip bioreactors have no sediment removal: at every routine visit, check that sediment is not entering the bioreactor.</p>` : ""}
      <div class="l-row w-sel"><span id="wSelT" aria-live="polite">${sel && WSEG[sel] ? `<b>${esc(WSEG[sel][0])}:</b> ${esc(WSEG[sel][1])}` : "All visits"}</span><span class="l-sp"></span>${sel ? `<button class="l-pill" type="button" id="wAll">Show all visits</button>` : ""}</div></section>`;
  }
  function wireWheel(onPick) {
    qa(".w-seg").forEach(g => { const go = () => onPick(g.classList.contains("on") ? null : g.dataset.w);
      g.onclick = go; g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }; });
    const a = q("#wAll"); if (a) a.onclick = () => onPick(null);
  }
  let wSel = null;
  /* tasks of the selected part of the wheel, across the four systems: one line per task name, with its systems */
  function wheelTasks(sel) {
    const ts = L.tasks.filter(t => MAIN.includes(t.sys) && (!sel || WSEG[sel][2](t))), by = {};
    ts.forEach(t => (by[t.name] = by[t.name] || []).push(t));
    return `<ul class="w-tasks">${Object.entries(by).map(([n, list]) => `<li><a href="#learn/task/${list[0].id}">${esc(n)}</a> ${list.map(t => `<a class="l-sys" style="background:${COLOR[t.sys]}" href="#learn/task/${t.id}" aria-label="${esc(n)}, ${esc(L.systems[t.sys])}">${t.sys}</a>`).join(" ")}</li>`).join("")}</ul>
      ${sel === "routine" ? "" : sel ? "" : `<p class="l-src">${ts.length} tasks in the four systems.</p>`}`;
  }

  /* ---------- the Field Guide online: every section of the PDF; a section without data says Coming soon ---------- */
  const FG = () => L.fg || {signs: [], wildlife: [], parts: [], stop: []};
  function fgSections() {
    const g = FG(), inv = L.plants.filter(p => p.status === "Invasive").length, nat = L.plants.filter(p => p.status === "Native").length, look = L.plants.filter(p => p.look).length;
    return [["how", "How to use this guide", "When to stop and call the supervisor.", g.stop.length], ["signs", "Signs of problems", "What it is, why it matters, what to do.", g.signs.length],
      ["parts", "Parts of a system", "The names used in the manual and the checklists.", g.parts.length], ["invasive", "Invasive plants", "Remove, control, or monitor; and the watchlist.", inv + L.watch.length],
      ["look", "Look-alikes", "Pairs that are easy to mix up.", look], ["native", "Native plants", "Protect, encourage, and replant.", nat],
      ["ask", "Plants to ask about", "Native or invasive depends on the strain.", 0], ["wildlife", "Wildlife", "Never trap, poison, or move animals.", g.wildlife.length],
      ["key", "Icon key and zones", "How to read the plant cards.", Object.keys(L.iconNames || {}).length], ["refs", "References", "The sources of the guide.", Object.keys(L.plantSources || {}).length],
      ["photos", "Photos", "Photos of each sign, part and animal.", 0]];
  }
  function fieldGuide(sec) {
    const secs = fgSections(), cur = secs.find(x => x[0] === sec);
    if (!cur) {
      view().innerHTML = `<p><a href="#learn">← Read online</a></p><h2 class="l-title">Field Guide</h2><p class="t-intro">Plants, signs of problems, wildlife and the parts of a system: the same content as the Field Guide PDF.</p>
        <div class="l-grid">${secs.map(([k, t, d, n]) => n ? `<a class="l-card" href="#learn/fieldguide/${k}"><b>${esc(t)}</b><span>${esc(d)}</span><span class="l-src">${n} ${k === "refs" ? "sources" : k === "key" ? "icons" : "entries"} →</span></a>`
          : `<div class="l-card l-soon"><b>${esc(t)}</b><span>${esc(d)}</span>${chip("Coming soon", "y")}<span class="l-src">${k === "photos" ? "The photos are being collected." : "No entries yet in the Field Guide."}</span></div>`).join("")}</div>`;
      return;
    }
    const [k, t] = cur, g = FG(), back = `<p><a href="#learn/fieldguide">← Field Guide</a></p><h2 class="l-title">${esc(t)}</h2>`, sysT = list => list.map(sysTag).join(" ");
    let body = "";
    if (k === "how") body = `<p>Find what you see, then do what the card says. If you are not sure, take a photo and ask the supervisor.</p><div class="l-box warn"><b>Stop and call the supervisor if you see</b><div><table class="t-kv">${g.stop.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</table></div></div>`;
    else if (k === "signs") { const grs = [...new Set(g.signs.map(x => x.group))];
      body = `<p class="l-src">Photos: ${chip("Coming soon", "y")}</p>` + grs.map(gr => `<h3 class="l-h">${esc(gr)}</h3><div class="l-grid">${g.signs.filter(x => x.group === gr).map(x => `<div class="panel stack"><b>${esc(x.name)}</b> <span>${sysT(x.sys)}</span>
        <p><b>What it is:</b> ${esc(x.what)}</p><p><b>Why it matters:</b> ${esc(x.why)}</p><p><b>What to do:</b> ${esc(x.do)}</p>${x.task ? `<p class="l-src">Task: ${x.task.split(/[;,]\s*/).map(id => taskBy(id) ? `<a href="#learn/task/${id}">${esc(taskBy(id).name)}</a>` : esc(id)).join(", ")}</p>` : ""}<p class="l-src">${esc(x.src)}</p></div>`).join("")}</div>`).join(""); }
    else if (k === "parts") body = `<div class="scroll"><table><thead><tr><th>Part</th><th>What it does</th><th>Systems</th></tr></thead><tbody>${g.parts.map(x => `<tr><td><b>${esc(x.part)}</b></td><td>${esc(x.what)}</td><td>${sysT(x.sys)}</td></tr>`).join("")}</tbody></table></div><p><a href="#learn/manual/SB">See the parts on the drawing of each system →</a></p>`;
    else if (k === "invasive") body = `<p>Invasive plants are in the plant picker: <a href="#learn/plants">open it and choose "Show invasive plants" →</a></p><ul class="plain">${L.plants.filter(p => p.status === "Invasive").map(p => `<li><b>${esc(p.com)}</b> <i>${esc(p.sci)}</i></li>`).join("")}</ul>
      <h3 class="l-h">Watchlist</h3><div class="scroll"><table><thead><tr><th>Plant</th><th>Look for</th></tr></thead><tbody>${L.watch.map(w => `<tr><td><b>${esc(w.com)}</b><br><i class="l-src">${esc(w.sci)}</i></td><td>${esc(w.look)}</td></tr>`).join("")}</tbody></table></div>`;
    else if (k === "look") body = `<p>When two plants look alike, do not remove or plant either one until your supervisor confirms.</p><div class="scroll"><table><thead><tr><th>Plant</th><th>Be careful</th></tr></thead><tbody>${L.plants.filter(p => p.look).map(p => `<tr><td><b>${esc(p.com)}</b><br><i class="l-src">${esc(p.sci)}</i></td><td>${esc(p.look)}</td></tr>`).join("")}</tbody></table></div>`;
    else if (k === "native") body = `<p>${L.plants.filter(p => p.status === "Native").length} native plants, with how to recognize each one: <a href="#learn/plants">open the plant picker →</a></p>`;
    else if (k === "wildlife") body = `<p class="l-banner">If you think a protected animal or a nest may be there, stop work nearby, do not touch it, and tell the supervisor. The supervisor calls a qualified biologist.</p>
      <div class="l-grid">${g.wildlife.map(x => `<div class="panel stack"><b>${esc(x.com)}</b>${x.sci ? `<i class="l-src">${esc(x.sci)}</i>` : ""}${x.group ? chip(x.group, x.group.startsWith("Protected") ? "r" : "") : ""}
        <p><b>How to recognize it:</b> ${/to be written/i.test(x.how) || !x.how ? `${chip("In progress", "y")} <span class="l-src">The description is being written with a biologist.</span>` : esc(x.how)}</p><p><b>What to do:</b> ${esc(x.do)}</p><p class="l-src">${esc(x.src)}</p></div>`).join("")}</div>`;
    else if (k === "key") body = `<div class="scroll"><table><thead><tr><th>Code</th><th>Meaning</th></tr></thead><tbody>${Object.entries(L.iconNames || {}).map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div><p><a href="#learn/plants">See the icons on the plant cards →</a></p>`;
    else if (k === "refs") body = `<div class="refs">${Object.values(L.plantSources || {}).map(x => `<p>${esc(x.apa)}</p>`).join("")}</div>`;
    else body = `<p>${chip("Coming soon", "y")} No entries yet.</p>`;
    view().innerHTML = back + body;
  }

  /* ---------- one system: illustration with parts, the year, the tasks, plants ---------- */
  const RAINY = [9, 10, 11, 0, 1, 2, 3];
  const VISITS = [["Routine visit", "Routine", "At every visit, all year", t => t.visit === "Routine visit", "all"],
    ["January review (office)", "January review", "January, in the office", t => t.visit === "January review (office)", [0]],
    ["Spring visit", "Spring visit", "April", t => t.visit === "Spring visit", [3]],
    ["Pre-storm visit", "Pre-storm visit", "August", t => t.visit === "Pre-storm visit", [7]],
    ["Post-storm visit", "Post-storm visit", "October to April 30, within 48 hours of a storm", t => t.freq.some(f => /^(After storm|Post-storm)/i.test(f)), RAINY],
    ["When needed", "When needed", "No fixed month", t => t.visit === "When needed", null]];
  const HOW = {SB: ["Water comes in muddy", "Soil settles", "Clearer water leaves"], VD: ["Plants slow the water", "Roots and stems hold soil", "Water moves on"],
    WB: ["Nitrate-rich water enters the buried woodchips", "Microbes turn nitrate into nitrogen gas", "Water leaves with less nitrate"], TW: ["Water spreads and slows", "Plants and microbes work", "Water leaves"]};
  let visF = "all", partSel = null, howStep = 0;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function manual(s) {
    s = L.systems[s] ? s : "SB";
    if (manual.last !== s) { visF = "all"; partSel = null; howStep = 0; manual.last = s; }
    const ts = L.tasks.filter(t => t.sys === s).sort((a, b) => a.no - b.no);
    const own = L.topics.filter(t => t.sys === s), general = L.topics.filter(t => !t.sys || t.sys === "General" || t.sys === "ALL");
    const tlist = ts_ => ts_.map(t => `<p class="l-li"><a href="#learn/topic/${t.id}">${t.num ? `<span class="l-src">${esc(t.num)}</span> ` : ""}${esc(t.title)}</a></p>`).join("");
    const sheet = L.downloads.find(d => d.code === `${s}_F04`), parts = (L.parts || {})[s] || [];
    const vis = VISITS.filter(v => ts.some(v[3]));
    view().innerHTML = `
      <div class="l-row">${label("Maintain")}<div class="l-pills" role="group" aria-label="System">${Object.keys(L.systems).map(k => `<a class="l-pill${k === s ? " on" : ""}" href="#learn/manual/${k}"${k === s ? ' aria-current="page"' : ""}>${esc(L.systems[k])}</a>`).join("")}</div></div>
      ${parts.length ? `<div class="l-two l-sysfig">
        <div><figure class="l-fig"><div class="l-figbox"><img src="img/learn/${s}.webp" alt="Illustration of a ${esc(L.systems[s].toLowerCase())} and its parts." width="1000" height="560">
            ${parts.map((p, i) => `<button type="button" class="l-hot" style="left:${p.x}%;top:${p.y}%" data-part="${p.id}" aria-pressed="${p.id === partSel}" aria-label="${i + 1}: ${esc(p.name)}">${i + 1}</button>`).join("")}</div>
          <figcaption class="l-src">Illustration made with ChatGPT by UCSC SIP interns. Simplified, not to scale.</figcaption></figure>
          <h3>Parts of the ${esc(L.systems[s].toLowerCase())}</h3>
          <ol class="l-parts">${parts.map((p, i) => `<li><button type="button" class="l-partb" data-part="${p.id}" aria-pressed="${p.id === partSel}" aria-controls="lpart"><span class="l-pn" aria-hidden="true">${i + 1}</span>${esc(p.name)}</button></li>`).join("")}</ol></div>
        <div class="stack"><div class="panel" id="lpart" aria-live="polite">${partHtml(s, parts.find(p => p.id === partSel))}</div>${howHtml(s)}</div></div>` : ""}
      ${wheelBlock(s, WSEG[visF] ? visF : null)}
      <div class="l-grid" id="lcards">${cards(ts)}</div>
      <div class="l-two">
        <div class="panel"><h3>Read first</h3>${tlist(own)}<h3 style="margin-top:.8rem">All systems</h3>${tlist(general)}</div>
        <div class="stack">${sheet ? `<div class="panel"><h3>Visit Sheet</h3><p>The checklist for the ${esc(L.systems[s].toLowerCase())}, to fill in at each visit.</p><p><a class="btn sm" href="${sheet.file}" download>Download (Excel)</a> ${chip("Draft", "y")}</p></div>` : ""}
          ${plantsFor(s)}</div>
      </div>`;
    qa("[data-part]").forEach(b => b.onclick = () => { partSel = partSel === b.dataset.part ? null : b.dataset.part; qa("[data-part]").forEach(x => x.setAttribute("aria-pressed", x.dataset.part === partSel)); q("#lpart").innerHTML = partHtml(s, parts.find(p => p.id === partSel)); });
    wireWheel(k => { visF = k || "all"; const y = window.scrollY; manual(s); window.scrollTo(0, y); const g = q(`.w-seg[data-w="${k}"]`) || q("#wT"); if (g) g.focus({preventScroll: true}); });
    wireHow(s);
  }
  manual.last = null;
  /* a visit's place on the strip: a marker on its month, a bar across its months, nothing when it has no month */
  function barPos(m) {
    if (m === "all") return "grid-column:1/13";
    if (!m) return "grid-column:1/13";
    if (m.length === 1) return `grid-column:${m[0] + 1}/span 2`;
    return "grid-column:10/13";   /* after storms: Oct to Dec on the strip, and Jan to Apr in its text */
  }
  function cards(ts) {
    const v = WSEG[visF], list = v ? ts.filter(v[2]) : ts;
    return list.map(card).join("") || `<p class="muted">No tasks for this visit.</p>`;
  }
  function partHtml(s, p) {
    if (!p) return `<p class="muted">Select a numbered part on the drawing, or in the list, to see what to check there and which tasks look after it.</p>`;
    const items = p.items.map(id => L.checklist.find(c => c.id === id)).filter(Boolean);
    return `<h3>${esc(p.name)}</h3><p class="l-src">From the Visit Sheet checklist (${esc(s)}_F04).</p>
      <ul class="l-check">${items.map(i => `<li><b>${esc(i.q)}</b>${i.look ? `<span><span class="l-ok">Looks normal</span> ${esc(i.look)}</span>` : ""}${i.ab ? `<span><span class="l-bad">Needs attention</span> ${esc(i.ab)}</span>` : ""}</li>`).join("")}</ul>
      ${p.tasks.length ? `<p><b>Tasks</b></p><ul class="plain">${p.tasks.map(id => { const t = taskBy(id); return `<li><a href="#learn/task/${id}">${esc(t ? t.name : id)}</a> <span class="l-src">${id}</span></li>`; }).join("")}</ul>` : `<p class="l-src">No task in the manual is linked to these checklist items.</p>`}`;
  }
  /* "How it works" in three still steps; the drawings are coming, so each step shows a placeholder for now */
  function howHtml(s) {
    const st = HOW[s]; if (!st) return "";
    return `<div class="panel l-how" aria-labelledby="lhowT"><h3 id="lhowT">How it works</h3>
      <div class="l-howbtn" role="group" aria-label="Step">${st.map((_, i) => `<button type="button" data-how="${i}" aria-pressed="${i === howStep}">${i + 1}</button>`).join("")}</div>
      <div class="l-howimg" aria-hidden="true">Drawing coming</div><p class="l-howt" aria-live="polite"><b>${howStep + 1}.</b> ${esc(st[howStep])}</p>
      ${howStep < st.length - 1 ? `<button class="btn ghost sm" type="button" id="lhowN">Next step</button>` : `<button class="btn ghost sm" type="button" id="lhowN">Start again</button>`}</div>`;
  }
  function wireHow(s) {
    const box = q(".l-how"); if (!box) return;
    const go = i => { howStep = i; box.outerHTML = howHtml(s); wireHow(s); const n = q(".l-how .l-howt"); n.classList.add("h-in"); };
    qa("[data-how]", box).forEach(b => b.onclick = () => go(+b.dataset.how));
    q("#lhowN", box).onclick = () => go((howStep + 1) % HOW[s].length);
  }
  function plantsFor(s) {
    const n = L.plants.filter(p => p.status === "Native" && p.sys.includes(s));
    if (!n.length) return `<div class="panel stack">${label("Plants")}<h3>Plants for a ${esc(L.systems[s].toLowerCase())}</h3><p>The Field Guide lists no plants for this system.</p><p><a href="#learn/plants">Open the Field Guide →</a></p></div>`;
    return `<div class="panel stack">${label("Plants")}<h3>Plants for a ${esc(L.systems[s].toLowerCase())}</h3><div class="l-bank l-bank-sm">${bankSvg()}</div>
      <p>${n.length} native plants in the Field Guide grow in this system: ${["W", "L", "M", "H"].map(z => `${n.filter(p => p.zones.includes(z)).length} in the ${ZN.find(a => a[0] === z)[1].toLowerCase()} zone`).join(", ")}.</p>
      <p><a href="#learn/plants" data-plants="${s}">Open the Field Guide with only these plants →</a></p></div>`;
  }
  document.addEventListener("click", e => { const a = e.target.closest("[data-plants]"); if (a) { ps.sys = a.dataset.plants; } });

  /* task level as an icon: eye = observe or measure only, eye + wrench = observe + minor action, wrench = action, truck = heavy maintenance by a contractor */
  const IC = {eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z"/>',
    truck: '<path d="M2 6h11v9H2z"/><path d="M13 9h4l3 3v3h-7z"/><circle cx="6" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    form: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/><path d="M9 11h6M9 15h6"/>'};
  /* "Forms for this task": the Visit Sheet, Site History, Corrective Maintenance Log, Site Card or Field Guide the task names */
  const size = kb => kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
  function formsHtml(t) {
    const a = t.annexes || []; if (!a.length) return "";
    return `<div class="l-forms"><b>Forms for this task</b><ul>${a.map(x => `<li><span class="l-fic">${ico("form")}</span><span class="l-ft">${esc(x.title)}${x.sheet ? ` <span class="l-src">(sheet ${esc(x.sheet)})</span>` : ""}</span>
      ${x.file ? `<a href="${x.file}" download>Download (${x.kind === "pdf" ? "PDF" : "Excel"}, ${size(x.size_kb)})</a>` : ""}
      ${x.tool ? `<a href="${x.tool[0]}">${x.file ? "Use it in the Tool" : esc(x.tool[1])} →</a>` : ""}</li>`).join("")}</ul></div>`;
  }
  const XI = {book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h7"/>', leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l7-7"/>'};
  const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k] || XI[k]}</svg>`;
  function levelIcon(t) {
    const heavy = /contractor/i.test(t.type || ""), lv = t.level || "";
    const [keys, text] = heavy ? [["truck"], "Heavy maintenance by a contractor"] : /observe \+ minor/i.test(lv) ? [["eye", "wrench"], "Observe and a minor action"] : /observe/i.test(lv) ? [["eye"], "Observe or measure only"] : /action/i.test(lv) ? [["wrench"], "Action"] : [[], ""];
    return keys.length ? `<span class="l-lv" title="${text}">${keys.map(ico).join("")}<span class="vh">${text}</span></span>` : "";
  }
  const stripTags = h => String(h || "").replace(/<[^>]+>/g, "");
  const card = t => `<a class="l-card" href="#learn/task/${t.id}"><span class="l-row">${levelIcon(t)}<b>${esc(t.name)}</b><small class="l-src">${t.id}</small>${(t.annexes || []).length ? `<span class="l-fcount" title="${t.annexes.length} form${t.annexes.length > 1 ? "s" : ""}">${ico("form")}${t.annexes.length}<span class="vh"> forms</span></span>` : ""}</span>
    <span>${t.freq.map(f => chip(f, "y")).join("")}${t.type ? chip(t.type) : ""}</span><span class="l-src">${stripTags(t.short).slice(0, 150)}${stripTags(t.short).length > 150 ? "…" : ""}</span></a>`;
  const toolList = t => stripTags(t.tools).split(/,\s*(?![^()]*\))/).map(x => x.trim().replace(/\.$/, "")).filter(Boolean);
  /* ---------- one task ---------- */
  function task(id) {
    const t = taskBy(id);
    if (!t) { view().innerHTML = `<p>Task ${esc(id)} not found. <a href="#learn/manual/SB">Back to the manual</a></p>`; return; }
    const g = L.groups.find(x => x.id === t.group);
    const steps = t.steps.map(s => {
      const br = s.ty === "Yes branch" ? `<span class="l-tag y">YES</span>` : s.ty === "No branch" ? `<span class="l-tag n">NO</span>` : "";
      const cls = br ? "b" : s.lv >= 2 ? "sub" : s.ty.startsWith("Decision") ? "q" : "";
      return `<li class="${cls}">${br}${s.t}</li>`;
    }).join("");
    const items = L.checklist.filter(i => i.go.includes(t.id));
    view().innerHTML = `
      <p><a href="#learn/manual/${t.sys}">← ${esc(L.systems[t.sys])}</a></p>
      <div class="l-row">${label("Maintain")}${sysTag(t.sys)}<span class="l-src">${t.id} · ${esc(t.visit)}</span></div>
      <h2 class="l-title">${levelIcon(t)} ${esc(t.name)}</h2>
      <div>${t.freq.map(f => chip(f, "y")).join("")}${t.type ? chip(t.type) : ""}${t.level ? chip(t.level, "g") : ""}${t.status ? chip(t.status === "Draft" ? "Draft for review" : t.status, "r") : ""}</div>
      <p class="l-src">${t.when}</p><div class="l-banner">${t.short}</div>
      ${formsHtml(t)}
      ${toolList(t).length ? `<div class="l-bring"><b>What to bring</b> ${toolList(t).map(x => `<span class="l-tool">${ico("bag")}${esc(x)}</span>`).join("")}</div>` : ""}
      ${whereHtml(t)}
      <div class="l-two">
        <div>${t.flow ? `<figure class="l-flow">${t.flow}<figcaption class="l-src">Steps to ${esc(t.name.toLowerCase())}.</figcaption></figure>` : ""}
          <div class="l-box"><b>Steps</b><div><ol class="l-steps">${steps}</ol></div></div></div>
        <div>${box("Responsibilities", t.resp)}${g && g.by[t.sys] ? box("In this system", g.by[t.sys]) : ""}${box("Safety", t.safety)}${box("Waste handling", t.waste)}${box("Notes", t.notes)}${box("Escalation", t.esc, true)}
          ${items.length ? box("Visit Sheet items that send you here", "<ul>" + items.map(i => `<li>${esc(i.q)} <span class="l-src">${i.id}</span></li>`).join("") + "</ul>") : ""}
          ${t.basis.length ? `<p class="l-src"><b>Basis:</b> ${t.basis.map(esc).join("; ")}</p>` : ""}</div>
      </div>
      ${g ? `<p class="l-src">Done together with ${g.members.filter(m => m !== t.id).map(m => `<a href="#learn/task/${m}">${esc(m)}</a>`).join(", ")} (${esc(g.name)}).</p>` : ""}`;
  }

  /* "Where you work": a small copy of the system drawing with this task's parts highlighted */
  function whereHtml(t) {
    const parts = ((L.parts || {})[t.sys] || []).filter(p => p.tasks.includes(t.id));
    if (!parts.length) return "";
    const all = L.parts[t.sys];
    return `<figure class="l-where"><div class="l-figbox"><img src="img/learn/${t.sys}.webp" alt="" width="1000" height="560">${parts.map(p => `<span class="l-hot on" style="left:${p.x}%;top:${p.y}%" aria-hidden="true">${all.indexOf(p) + 1}</span>`).join("")}</div>
      <figcaption><b>Where you work:</b> ${parts.map(p => esc(p.name)).join(", ")}. <a href="#learn/manual/${t.sys}">See all the parts →</a></figcaption></figure>`;
  }

  /* ---------- one topic ---------- */
  function topic(id) {
    const t = L.topics.find(x => x.id === id);
    view().innerHTML = t ? `<p><a href="#learn/manual/SB">← Manual</a></p><h2 class="l-title">${t.num && t.num !== "0" ? esc(t.num) + " " : ""}${esc(t.title)}</h2><div class="l-body">${t.html}</div>`
                         : `<p>Topic not found. <a href="#learn/manual/SB">Back to the manual</a></p>`;
  }

  /* ---------- Field Guide: plant picker (from the first prototype) ---------- */
  const ZN = [["W", "Water", "Standing or constantly wet"], ["L", "Low", "Ponds briefly after rain"], ["M", "Mid", "Slope that gets wet and dries"], ["H", "High", "Top of the bank, stays dry"]], ZX = {W: 12.5, L: 37.5, M: 62.5, H: 87.5};
  const GROUPS = ["Trees", "Shrubs and vines", "Flowers and herbs", "Grasses, sedges and rushes", "Aquatic plants and algae"];
  const ps = {zone: "all", sys: "all", group: "all", flowers: false, inv: false, color: "", q: "", by: "zone", x: 50};
  const iconSvg = (g, c) => L.icons[g + "_" + c] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${L.icons[g + "_" + c]}</svg>` : "";
  function flowerSvg(col) { const h = L.flowerHex[(col || "").toLowerCase()] || "#F6B800"; let p = ""; [0, 72, 144, 216, 288].forEach(a => { p += `<ellipse cx="12" cy="5.6" rx="3" ry="4.2" fill="${h}" stroke="#0002" stroke-width=".6" transform="rotate(${a} 12 12)"/>`; }); return `<svg viewBox="0 0 24 24" aria-hidden="true">${p}<circle cx="12" cy="12" r="2.6" fill="#8a6a3b"/></svg>`; }
  function gY(x) { const p = [[0, 238], [22, 238], [27, 196], [50, 172], [75, 112], [100, 86]]; for (let i = 1; i < p.length; i++) { if (x <= p[i][0]) { const a = p[i - 1], b = p[i], t = (x - a[0]) / (b[0] - a[0]); return a[1] + t * (b[1] - a[1]); } } return 86; }
  const zoneOf = x => x < 25 ? "W" : x < 50 ? "L" : x < 75 ? "M" : "H";
  function bankSvg() {
    let g = ""; for (let x = 0; x <= 100; x += 1) g += (x ? "L" : "M") + (x * 10) + "," + gY(x).toFixed(1) + " ";
    const ground = "M0,340 " + g.replace(/^M/, "L") + "L1000,340 Z", deco = (x, fn) => fn(x * 10, gY(x));
    const reed = (x, y) => `<g stroke="#3C9D5B" stroke-width="3" stroke-linecap="round"><path d="M${x},${y} V${y - 48}"/><path d="M${x + 9},${y} V${y - 36}"/><path d="M${x - 9},${y} V${y - 40}"/></g><ellipse cx="${x}" cy="${y - 52}" rx="4" ry="9" fill="#8a6a3b"/>`;
    const tuft = (x, y) => `<g stroke="#4aa866" stroke-width="3" fill="none" stroke-linecap="round"><path d="M${x},${y} q-6,-22 -16,-30"/><path d="M${x},${y} v-34"/><path d="M${x},${y} q6,-22 16,-30"/></g>`;
    const shrub = (x, y) => `<rect x="${x - 3}" y="${y - 18}" width="6" height="18" fill="#8a6a3b"/><circle cx="${x - 14}" cy="${y - 24}" r="16" fill="#3C9D5B"/><circle cx="${x + 14}" cy="${y - 24}" r="16" fill="#2F7D4A"/><circle cx="${x}" cy="${y - 38}" r="17" fill="#43a965"/><circle cx="${x + 8}" cy="${y - 42}" r="4" fill="#E87AA6"/>`;
    const tree = (x, y) => `<rect x="${x - 5}" y="${y - 62}" width="10" height="62" fill="#8a6a3b"/><circle cx="${x}" cy="${y - 84}" r="38" fill="#2F7D4A"/><circle cx="${x - 24}" cy="${y - 68}" r="24" fill="#3C9D5B"/><circle cx="${x + 26}" cy="${y - 70}" r="24" fill="#43a965"/>`;
    return `<svg viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lgw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4f0"/><stop offset="1" stop-color="#3f93cf"/></linearGradient><linearGradient id="lgs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a98557"/><stop offset="1" stop-color="#6f5233"/></linearGradient></defs>
      ${ZN.map(([c], i) => `<rect id="lzr_${c}" x="${i * 250}" y="0" width="250" height="340" fill="#03467E" opacity="0"/>`).join("")}
      <path d="M0,196 L270,196 L270,238 L0,238 Z" fill="url(#lgw)" opacity=".9"/><path d="${ground}" fill="url(#lgs)"/><path d="M0,196 L270,196" stroke="#fff" stroke-width="3" opacity=".7" stroke-dasharray="14 10"/>
      ${deco(6, reed)}${deco(13, reed)}${deco(19, reed)}${deco(31, tuft)}${deco(38, tuft)}${deco(45, tuft)}${deco(56, shrub)}${deco(66, shrub)}${deco(82, tree)}${deco(94, tree)}</svg>`;
  }
  function matches(p) {
    if (ps.sys !== "all" && !p.sys.includes(ps.sys)) return false;
    if (ps.group !== "all" && p.group !== ps.group) return false;
    if (ps.flowers && !p.flower) return false;
    if (ps.color && (p.flower || "").toLowerCase() !== ps.color) return false;
    if (ps.q) { const t = ps.q.toLowerCase(); if (!(p.sci + " " + p.com + " " + p.ben + " " + p.clue).toLowerCase().includes(t)) return false; }
    return true;
  }
  function pcard(p, i) {
    const inv = p.status === "Invasive", src = p.src.map(k => (L.plantSources[k] || {short: k}).short).join("; ");
    return `<button type="button" class="l-pcard${inv ? " inv" : ""}" data-id="${p.id}" style="animation-delay:${Math.min(i, 24) * 25}ms">
      <span class="l-ph">${iconSvg("form", p.form)}<span class="l-tg">${chip(inv ? "Invasive" : "Native", inv ? "r" : "g")}</span></span>
      <span class="l-bd"><span class="l-sci">${esc(p.sci)}</span><span>${esc(p.com)}</span>
      <span class="l-icrow">${p.form ? `<span class="l-ico">${iconSvg("form", p.form)}${esc(L.iconNames[p.form] || "")}</span>` : ""}${p.leaf ? `<span class="l-ico">${iconSvg("leaf", p.leaf)}${esc(L.iconNames[p.leaf] || "")}</span>` : ""}${p.stem ? `<span class="l-ico">${iconSvg("stem", p.stem)}${esc(L.iconNames[p.stem] || "")}</span>` : ""}${p.flower ? `<span class="l-ico">${flowerSvg(p.flower)}${esc(p.flower)}</span>` : ""}</span>
      ${inv ? `<span class="l-warn">Remove it and tell the supervisor.</span>` : `<span class="l-zb">${ZN.map(([c, n]) => `<span class="${p.zones.includes(c) ? "on" : ""}">${n}</span>`).join("")}</span>`}
      <span>${p.sys.map(sysTag).join(" ")}</span><span class="l-src">${esc(src)}</span></span></button>`;
  }
  function plants() {
    view().innerHTML = `${label("Plants")}<h2 class="l-title">Plant picker</h2><p>Where do you want to plant? Drag the seedling along the bank, or tap a zone. Then filter by system, type, or flowers. The same plants are in the Field Guide.</p>
      <div class="l-bank" id="lbank">${bankSvg()}${ZN.map(([c, n], i) => `<div class="l-zlab" data-z="${c}" style="left:${i * 25 + 12.5}%">${n}</div>`).join("")}
        <div class="l-pin" id="lpin" tabindex="0" role="slider" aria-label="Planting zone" aria-valuemin="0" aria-valuemax="3"><svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="25" fill="#fff" stroke="#03467E" stroke-width="3"/><path d="M27 42 V26" stroke="#3C9D5B" stroke-width="3.5" stroke-linecap="round"/><path d="M27 28 C17 28 13 20 13 15 C21 15 27 19 27 28Z" fill="#43a965"/><path d="M27 26 C35 26 41 20 41 13 C33 13 27 17 27 26Z" fill="#2F7D4A"/></svg></div>
        <div class="l-hint" id="lhint">Drag me or tap a zone</div></div>
      <div class="l-row" style="margin-top:.6rem"><b id="lzinfo" class="l-zinfo"></b><span class="l-sp"></span><button class="l-pill" type="button" id="lallz">All zones</button></div>
      <div class="l-pills" id="lfsys"></div><div class="l-pills" id="lfgrp"></div>
      <div class="l-row"><button class="l-pill" type="button" id="lfflw" aria-pressed="false">With flowers</button><span id="lfcol" class="l-row"></span><button class="l-pill" type="button" id="lfinv" aria-pressed="false">Show invasive plants</button><span class="l-sp"></span>
        <label class="l-lab">Search <input id="lq" placeholder="Name, benefit, clue…" value="${esc(ps.q)}"></label>
        <label class="l-lab">Group <select id="lby"><option value="zone">by zone</option><option value="type">by type</option><option value="none">no grouping</option></select></label></div>
      <p id="lpcount" class="l-src"></p><div id="lpresults"></div>
      ${L.watch.length ? `<h2 class="l-h">Watchlist</h2><p class="l-src">Plants to watch for and report.</p><div class="scroll"><table><thead><tr><th>Plant</th><th>Look for</th></tr></thead><tbody>${L.watch.map(w => `<tr><td><b>${esc(w.com)}</b><br><i class="l-src">${esc(w.sci)}</i></td><td>${esc(w.look)}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
    const bank = q("#lbank"), pin = q("#lpin");
    const place = (x, anim) => { ps.x = x; pin.style.left = x + "%"; pin.style.top = (gY(x) / 340 * 100) + "%"; pin.classList.toggle("drag", !anim); };
    function setZone(z, snap) {
      ps.zone = z; qa(".l-zlab").forEach(l => l.classList.toggle("on", l.dataset.z === z)); ZN.forEach(([c]) => q("#lzr_" + c).setAttribute("opacity", c === z ? ".16" : "0"));
      const zi = ZN.find(a => a[0] === z); q("#lzinfo").textContent = zi ? `${zi[1]} zone · ${zi[2]}` : "All zones"; q("#lhint").style.display = z === "all" ? "block" : "none";
      pin.setAttribute("aria-valuenow", Math.max(0, ZN.findIndex(a => a[0] === z))); if (snap && zi) place(ZX[z], true); results();
    }
    const xFrom = e => { const r = bank.getBoundingClientRect(); return Math.max(2, Math.min(98, (e.clientX - r.left) / r.width * 100)); };
    let drag = false;
    pin.addEventListener("pointerdown", e => { drag = true; pin.setPointerCapture(e.pointerId); pin.classList.add("drag"); e.preventDefault(); });
    pin.addEventListener("pointermove", e => { if (!drag) return; const x = xFrom(e); place(x, false); const z = zoneOf(x); if (z !== ps.zone) setZone(z, false); });
    pin.addEventListener("pointerup", () => { if (!drag) return; drag = false; pin.classList.remove("drag"); setZone(zoneOf(ps.x), true); });
    pin.addEventListener("keydown", e => { const i = ZN.findIndex(a => a[0] === ps.zone); if (e.key === "ArrowRight") setZone(ZN[Math.min(3, i < 0 ? 0 : i + 1)][0], true); if (e.key === "ArrowLeft") setZone(ZN[Math.max(0, i < 0 ? 0 : i - 1)][0], true); });
    bank.addEventListener("click", e => { if (e.target.closest(".l-pin")) return; const z = e.target.closest(".l-zlab"); setZone(z ? z.dataset.z : zoneOf(xFrom(e)), true); });
    q("#lallz").onclick = () => { setZone("all", false); place(50, true); };
    function pills() {
      q("#lfsys").innerHTML = ["all", ...MAIN].map(s => `<button type="button" class="l-pill${ps.sys === s ? " on" : ""}" data-s="${s}" aria-pressed="${ps.sys === s}">${s === "all" ? "All systems" : esc(L.systems[s])}</button>`).join("");
      q("#lfgrp").innerHTML = ["all", ...GROUPS].map(g => `<button type="button" class="l-pill${ps.group === g ? " on" : ""}" data-g="${esc(g)}" aria-pressed="${ps.group === g}">${g === "all" ? "All types" : esc(g)}</button>`).join("");
      qa("#lfsys [data-s]").forEach(b => b.onclick = () => { ps.sys = b.dataset.s; pills(); results(); });
      qa("#lfgrp [data-g]").forEach(b => b.onclick = () => { ps.group = b.dataset.g; pills(); results(); });
      q("#lfflw").classList.toggle("on", ps.flowers); q("#lfflw").setAttribute("aria-pressed", ps.flowers); q("#lfinv").classList.toggle("on", ps.inv); q("#lfinv").setAttribute("aria-pressed", ps.inv);
      const cols = [...new Set(L.plants.filter(p => p.flower).map(p => p.flower.toLowerCase()))];
      q("#lfcol").innerHTML = ps.flowers ? cols.map(c => `<button type="button" class="l-pill${ps.color === c ? " on" : ""}" data-c="${c}"><span class="l-dot" style="background:${L.flowerHex[c] || "#ccc"}"></span>${esc(c)}</button>`).join("") : "";
      qa("#lfcol [data-c]").forEach(b => b.onclick = () => { ps.color = ps.color === b.dataset.c ? "" : b.dataset.c; pills(); results(); });
    }
    q("#lfflw").onclick = () => { ps.flowers = !ps.flowers; if (!ps.flowers) ps.color = ""; pills(); results(); };
    q("#lfinv").onclick = () => { ps.inv = !ps.inv; pills(); results(); };
    q("#lq").oninput = e => { ps.q = e.target.value; results(); };
    q("#lby").value = ps.by; q("#lby").onchange = e => { ps.by = e.target.value; results(); };
    function results() {
      const nat = L.plants.filter(p => p.status === "Native" && matches(p) && (ps.zone === "all" || p.zones.includes(ps.zone)));
      const inv = ps.inv ? L.plants.filter(p => p.status === "Invasive" && matches(p)) : [];
      let h = "", i = 0;
      const sec = (t, arr, note) => arr.length ? `<h3 class="l-h">${esc(t)} <small class="l-src">${arr.length}</small></h3>${note || ""}<div class="l-pgrid">${arr.map(p => pcard(p, i++)).join("")}</div>` : "";
      if (ps.by === "zone" && ps.zone === "all") h = ZN.map(([c, n, d]) => sec(n + " zone", nat.filter(p => p.zones.includes(c)), `<p class="l-src">${d}</p>`)).join("");
      else if (ps.by === "type") h = GROUPS.map(g => sec(g, nat.filter(p => p.group === g))).join("");
      else h = sec(ps.zone === "all" ? "Native plants" : (ZN.find(a => a[0] === ps.zone) || [])[1] + " zone", nat);
      if (inv.length) h += sec("Invasive plants to remove", inv, `<p class="l-warn">These plants are not for planting. Record them and tell the supervisor.</p>`);
      q("#lpresults").innerHTML = h || `<div class="panel">No plants match these filters. Try another zone or clear a filter.</div>`;
      q("#lpcount").textContent = `${nat.length} native plant${nat.length === 1 ? "" : "s"}${inv.length ? ` and ${inv.length} invasive` : ""} match` + (ps.by === "zone" && ps.zone === "all" ? " (a plant that grows in several zones appears in each one)" : "");
      qa(".l-pcard").forEach(c => c.onclick = () => plantDlg(c.dataset.id));
    }
    pills(); setZone(ps.zone, false); place(ps.zone === "all" ? 50 : ZX[ps.zone], true);
  }
  function plantDlg(id) {
    const p = L.plants.find(x => x.id === id); if (!p) return;
    const src = p.src.map(k => { const s = L.plantSources[k] || {short: k, apa: ""}; return `<li>${esc(s.apa || s.short)}</li>`; }).join("");
    openDlg(`${chip(p.status, p.status === "Invasive" ? "r" : "g")}${chip(p.group)}<h3 class="l-title" style="margin-top:.4rem"><i>${esc(p.sci)}</i></h3><p class="l-com">${esc(p.com)}</p>
      <div class="l-icrow">${["form", "leaf", "stem"].filter(g => p[g]).map(g => `<span class="l-ico big">${iconSvg(g, p[g])}${g.toUpperCase()}<br>${esc(L.iconNames[p[g]] || "")}</span>`).join("")}${p.flower ? `<span class="l-ico big">${flowerSvg(p.flower)}FLOWER<br>${esc(p.flower)}</span>` : ""}</div>
      <p><b>How to recognize it:</b> ${esc(p.clue)}</p>${p.status === "Native" ? `<div class="l-zb">${ZN.map(([c, n]) => `<span class="${p.zones.includes(c) ? "on" : ""}">${n}</span>`).join("")}</div>` : ""}
      <p><b>Benefits:</b> ${esc(p.ben)}</p><p>${p.sys.map(sysTag).join(" ")} ${p.useful.map(u => chip(u, "g")).join("")}</p>
      ${p.look ? `<p class="l-warn"><b>Do not confuse:</b> ${esc(p.look)}</p>` : ""}${p.note ? `<p class="l-warn">${esc(p.note)}</p>` : ""}
      <p class="l-src"><b>Source${p.src.length > 1 ? "s" : ""}</b></p><ul class="l-src">${src}</ul>`);
  }

  /* ---------- downloads ---------- */
  function downloads() {
    view().innerHTML = `<h2 class="l-title">Download documents</h2>
      <p class="t-intro">Every document as a file: the forms named as in the Document Control Sheet (F01), the manual, the Field Guide, and sample reports.</p>
      <p class="l-banner">These are drafts for review. They have not had technical review yet, and they will change.</p>
      <section class="panel stack"><h3 style="margin:0">Food safety: sample reports</h3><p>What the Tool prints for an auditor or a funder, made with sample data.</p>
        <ul class="plain"><li><a href="#report/food-safety/sample">Sample Food Safety Record →</a> · <a href="downloads/Sample_Food_Safety_Record_vegetated_ditch.pdf" download>PDF</a></li><li><a href="#report/water-summary/sample">Sample Water Quality and Maintenance Summary →</a></li></ul></section>
      <div class="l-grid">${L.downloads.map((d, i) => `<div class="panel stack l-doc"><div class="l-row"><b>${esc(d.title)}</b><span class="l-sp"></span>${chip("Draft", "y")}</div>
        <span class="l-src">${esc(d.code)} · ${d.kind.toUpperCase()} · ${d.size_kb >= 1024 ? (d.size_kb / 1024).toFixed(1) + " MB" : d.size_kb + " KB"}</span><p>${esc(d.what)}</p>
        <div class="l-row"><a class="btn sm" href="${d.file}" download>Download</a>${d.kind === "pdf" ? `<button class="btn ghost sm" type="button" data-view="${i}" aria-expanded="false">View here</button>` : ""}</div></div>`).join("")}</div>
      <div id="lviewer" hidden></div>
      <p class="l-src">Files updated ${esc(L.built)}.</p>`;
    qa("[data-view]").forEach(b => b.onclick = () => {
      const d = L.downloads[+b.dataset.view], v = q("#lviewer"), open = b.getAttribute("aria-expanded") === "true";
      qa("[data-view]").forEach(x => x.setAttribute("aria-expanded", "false"));
      if (open) { v.hidden = true; v.innerHTML = ""; return; }
      b.setAttribute("aria-expanded", "true"); v.hidden = false;
      v.innerHTML = `<div class="l-row"><b>${esc(d.title)}</b><span class="l-sp"></span><a href="${d.file}" target="_blank" rel="noopener">Open in a new tab</a></div><iframe class="l-pdf" src="${d.file}" title="${esc(d.title)}"></iframe>
        <p class="l-src">If the document does not show on your phone, use Download or Open in a new tab.</p>`;
      v.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
    });
  }
})();
