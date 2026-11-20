/* Learn: the manual by system and task, the Field Guide plant picker, and the downloads.
   Data: window.VTS_LEARN, built by tools/build_site_data.py from the two workbooks. Routes: #learn/manual/SB, #learn/task/SB_T01,
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

  function tabs(cur) {
    qa("#learnTabs a").forEach(a => a.dataset.t === cur ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    q("#learnMaterials").hidden = cur !== "materials"; view().hidden = cur === "materials";
  }

  window.learnRoute = function (parts) {
    const [v, a] = parts;
    const which = !v ? "manual" : v;
    tabs(["task", "topic"].includes(which) ? "manual" : which);
    if (which === "task") task(a);
    else if (which === "topic") topic(a);
    else if (which === "plants") plants();
    else if (which === "downloads") downloads();
    else if (which === "materials") {}
    else manual(a);
  };

  /* ---------- manual by system, tasks grouped by visit ---------- */
  function manual(s) {
    s = L.systems[s] ? s : "SB";
    const ts = L.tasks.filter(t => t.sys === s).sort((a, b) => a.no - b.no);
    const groups = L.visits.map(v => [v, ts.filter(t => t.visit === v)]).filter(([, g]) => g.length);
    const own = L.topics.filter(t => t.sys === s), general = L.topics.filter(t => !t.sys || t.sys === "General" || t.sys === "ALL");
    const tlist = ts_ => ts_.map(t => `<p class="l-li"><a href="#learn/topic/${t.id}">${esc(t.title)}</a></p>`).join("");
    const sheet = L.downloads.find(d => d.code === `${s}_F04`);
    view().innerHTML = `
      <div class="l-pills" role="group" aria-label="System">${Object.keys(L.systems).map(k => `<a class="l-pill${k === s ? " on" : ""}" href="#learn/manual/${k}">${esc(L.systems[k])}</a>`).join("")}</div>
      <div class="l-two">
        <div>${groups.map(([v, g]) => `<h2 class="l-h">${esc(v)}</h2><div class="l-grid">${g.map(card).join("")}</div>`).join("") || "<p>No tasks.</p>"}</div>
        <aside class="stack">
          <div class="panel"><h3>Read first</h3>${tlist(own)}<h3 style="margin-top:.8rem">All systems</h3>${tlist(general)}</div>
          ${sheet ? `<div class="panel"><h3>Visit Sheet</h3><p>The checklist for the ${esc(L.systems[s].toLowerCase())}, to fill in at each visit.</p><p><a class="btn sm" href="${sheet.file}" download>Download (Excel)</a> ${chip("Draft", "y")}</p></div>` : ""}
        </aside>
      </div>`;
  }
  const card = t => `<a class="l-card" href="#learn/task/${t.id}"><span class="l-row"><b>${esc(t.name)}</b><small class="l-src">${t.id}</small></span>
    <span>${t.freq.map(f => chip(f, "y")).join("")}${t.type ? chip(t.type) : ""}</span><span class="l-src">${stripTags(t.short).slice(0, 150)}${stripTags(t.short).length > 150 ? "…" : ""}</span></a>`;
  const stripTags = h => String(h || "").replace(/<[^>]+>/g, "");

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
      <div class="l-row">${sysTag(t.sys)}<span class="l-src">${t.id} · ${esc(t.visit)}</span></div>
      <h2 class="l-title">${esc(t.name)}</h2>
      <div>${t.freq.map(f => chip(f, "y")).join("")}${t.type ? chip(t.type) : ""}${t.level ? chip(t.level, "g") : ""}${t.status ? chip(t.status === "Draft" ? "Draft for review" : t.status, "r") : ""}</div>
      <p class="l-src">${t.when}</p><div class="l-banner">${t.short}</div>
      <div class="l-two">
        <div>${t.flow ? `<figure class="l-flow">${t.flow}<figcaption class="l-src">Steps to ${esc(t.name.toLowerCase())}.</figcaption></figure>` : ""}
          <div class="l-box"><b>Steps</b><div><ol class="l-steps">${steps}</ol></div></div></div>
        <div>${g && g.by[t.sys] ? box("In this system", g.by[t.sys]) : ""}${box("Responsibilities", t.resp)}${box("Tools and equipment", t.tools)}${box("Safety", t.safety)}${box("Waste handling", t.waste)}${box("Escalation", t.esc, true)}${box("Notes", t.notes)}
          ${items.length ? box("Visit Sheet items that send you here", "<ul>" + items.map(i => `<li>${esc(i.q)} <span class="l-src">${i.id}</span></li>`).join("") + "</ul>") : ""}
          ${t.basis.length ? `<p class="l-src"><b>Basis:</b> ${t.basis.map(esc).join("; ")}</p>` : ""}</div>
      </div>
      ${g ? `<p class="l-src">Done together with ${g.members.filter(m => m !== t.id).map(m => `<a href="#learn/task/${m}">${esc(m)}</a>`).join(", ")} (${esc(g.name)}).</p>` : ""}`;
  }

  /* ---------- one topic ---------- */
  function topic(id) {
    const t = L.topics.find(x => x.id === id);
    view().innerHTML = t ? `<p><a href="#learn/manual/SB">← Manual</a></p><h2 class="l-title">${esc(t.title)}</h2><div class="l-body">${t.html}</div>`
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
    view().innerHTML = `<h2 class="l-title">Plant picker</h2><p>Where do you want to plant? Drag the seedling along the bank, or tap a zone. Then filter by system, type, or flowers. The same plants are in the Field Guide (VTS_D02).</p>
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
    view().innerHTML = `<h2 class="l-title">Downloads</h2>
      <p class="l-banner">These are drafts for review. They have not had technical review yet, and they will change.</p>
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
