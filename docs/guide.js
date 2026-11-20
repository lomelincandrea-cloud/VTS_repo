/* Visual "how to use" guide for Learn (the Tool has its own "?" panel in tool.js). Each step is a link to the part it explains.
   Hidden with "Got it" (remembered only in this browser); "How to use" brings it back. */
window.VTSGuide = (function () {
  "use strict";
  const ICON = {
    book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v13"/>',
    flow: '<rect x="8" y="2.5" width="8" height="5" rx="1.5"/><path d="M12 7.5v3"/><path d="M12 10.5l4 3-4 3-4-3z"/><path d="M12 16.5v2.5"/><rect x="8" y="19" width="8" height="3" rx="1"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    gantt: '<path d="M4 5v15h16"/><rect x="7" y="7" width="6" height="2.6" rx="1"/><rect x="10" y="11" width="8" height="2.6" rx="1"/><rect x="7" y="15" width="4" height="2.6" rx="1"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 6h4"/><path d="M10 11l1.5 1.5L14.5 9.5"/><circle cx="12" cy="18" r=".8"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z"/>',
    chart: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="7" rx=".6"/><rect x="11" y="7" width="3" height="11" rx=".6"/><rect x="16" y="13" width="3" height="5" rx=".6"/>',
    sheet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8l1.3 1.3L12 7"/><path d="M14 8h2"/><path d="M8.5 13l1.3 1.3L12 12"/><path d="M14 13h2"/><path d="M9 18h6"/>'};
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ""}</svg>`;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const get = k => { try { return localStorage.getItem("vts_guide_" + k); } catch (e) { return null; } };
  const set = (k, v) => { try { v === null ? localStorage.removeItem("vts_guide_" + k) : localStorage.setItem("vts_guide_" + k, v); } catch (e) {} };

  function render(box, key, title, intro, steps, tip) {
    if (!box) return;
    if (get(key) === "hidden") {
      box.innerHTML = `<button type="button" class="g-open" aria-expanded="false">${svg("book")} How to use ${esc(title)}</button>`;
      box.querySelector(".g-open").onclick = () => { set(key, null); render(box, key, title, intro, steps, tip); };
      return;
    }
    box.innerHTML = `<section class="guide" aria-label="How to use ${esc(title)}">
      <div class="guide-head"><h2>How to use ${esc(title)}</h2><span class="l-sp"></span><button type="button" class="btn ghost sm g-close">Got it, hide this</button></div>
      <p class="guide-intro">${esc(intro)}</p>
      <ol class="guide-steps">${steps.map((s, i) => `<li><a href="${s.href}" class="guide-step"><span class="guide-num">${i + 1}</span><span class="guide-ic">${svg(s.icon)}</span>
        <span class="guide-t">${esc(s.title)}</span><span class="guide-d">${esc(s.text)}</span>${s.soon ? '<span class="l-chip y">Coming next</span>' : ""}</a></li>`).join("")}</ol>
      ${tip ? `<p class="guide-tip">${tip}</p>` : ""}</section>`;
    box.querySelector(".g-close").onclick = () => { set(key, "hidden"); render(box, key, title, intro, steps, tip); };
  }

  function learn() {
    render(document.getElementById("learnGuide"), "learn", "Learn", "Everything a crew needs to look after a system, in four places. Tap a step to go there.", [
      {icon: "book", title: "Pick your system", text: "Open Manual and choose sediment basin, wetland, ditch, bioreactor, or corrective work. Tasks are grouped by visit.", href: "#learn/manual/SB"},
      {icon: "flow", title: "Open a task", text: "Each task has a step-by-step diagram, the steps, what to bring, safety, and when to call the supervisor.", href: "#learn/task/SB_T01"},
      {icon: "leaf", title: "Field Guide: find a plant", text: "In Field Guide, drag the seedling along the bank to a zone, then filter. Tap a card to see how to recognize it.", href: "#learn/plants"},
      {icon: "download", title: "Download the forms", text: "The manual, the Field Guide, the Visit Sheets and the forms, in PDF or Excel. They are drafts for review.", href: "#learn/downloads"}],
      "Tip: the Read first box on each system page has safety, waste, and the basics that apply to every system.");
  }
  return {learn, render};
})();

window.VTSGuide.learn();
