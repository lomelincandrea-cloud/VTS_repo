const SYS={
 SB:{n:"Sediment basin",s:"Settles soil out of runoff",what:"A pond that slows runoff so soil settles to the bottom before the water moves on.",fit:"You lose soil in runoff, and you have room at the low end of the ranch.",upkeep:"Routine look, trash removal, and sediment removal when the basin fills to its cleanout mark.",who:"Do it yourself guide",t:[9,"SB_T01 Routine Visual Inspection","SB_T05 Sediment Monitoring","SB_T09 Sediment Removal"]},
 VD:{n:"Vegetated ditch",s:"Plants slow and filter the flow",what:"A drainage ditch planted with grasses or sedges that slow water down and hold soil.",fit:"You already have a ditch that carries runoff, and you can keep it planted instead of bare.",upkeep:"Mowing to a target height, clearing structures, and checking the ditch shape once a year.",who:"Do it yourself guide",t:[11,"VD_T01 Routine Visual Inspection","VD_T03 Vegetation Maintenance","VD_T06 Inspect Ditch Cross-Section"]},
 WB:{n:"Woodchip bioreactor",s:"Woodchips feed nitrate-removing microbes",what:"A buried bed of woodchips. Microbes living on the chips turn nitrate in the water into nitrogen gas.",fit:"Nitrate is the main problem, and you want something contained that takes little surface area.",upkeep:"Stoplog and control service, drainage checks, leak tests, and new woodchips every so many years.",who:"Installed by practitioners",t:[9,"WB_T01 Routine Visual Inspection","WB_T04 Control Structure and Stoplog Service","WB_T05 Check Water Drainage"]},
 TW:{n:"Treatment wetland",s:"Plants and microbes clean the water",what:"A shallow planted wetland that water moves through slowly, giving plants and microbes time to work.",fit:"Several ranches drain to one place, and there is land that can stay wet.",upkeep:"Keeping water moving in and out, vegetation work, and a yearly structural check.",who:"Installed by practitioners",t:[10,"TW_T01 Routine Visual Inspection","TW_T04 Test and Clear Control Structures","TW_T08 Condition Check"]}
};
const ORDER=["SB","VD","WB","TW"];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const el=(t,a={},h="")=>{const e=document.createElement(t);for(const k in a)e.setAttribute(k,a[k]);e.innerHTML=h;return e};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* routing */
const ROUTES=["home","start","maintain","request","learn","tool","phone"];
function route(){const parts=(location.hash||"#home").slice(1).split("/");const r=ROUTES.includes(parts[0])?parts[0]:"home";
  if(r==="learn"&&window.learnRoute)window.learnRoute(parts.slice(1));
  if(r==="tool"&&window.toolRoute)window.toolRoute(parts.slice(1));
  if(r==="phone"&&window.ToolPlan)window.ToolPlan.phone(parts.slice(1).join("/"));
  $$("section.view").forEach(v=>v.classList.toggle("on",v.id==="v-"+r));
  $$("nav.main a").forEach(a=>{const on=a.dataset.r===r||(r==="request"&&a.dataset.r==="maintain");on?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current")});
  window.scrollTo(0,0);
  if(r==="home")setTimeout(()=>{lmap?lmap.invalidateSize():homeMap()},0);}
addEventListener("hashchange",route);

/* tabs */
$$(".tabs").forEach(tl=>tl.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  tl.querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected",x===b));
  tl.parentElement.querySelectorAll(":scope > .tabpanel").forEach(p=>p.classList.toggle("on",p.dataset.p===b.dataset.t));}));

/* chips helper */
function chips(box,items,cur,cb){box.innerHTML="";items.forEach(([k,l])=>{const b=el("button",{class:"chip",type:"button","aria-pressed":k===cur},esc(l));b.onclick=()=>{cb(k);chips(box,items,k,cb)};box.append(b)})}

/* home: stations */
let curSys="SB";
function stations(){const box=$("#stations");box.innerHTML="";ORDER.forEach(k=>{const b=el("button",{type:"button","aria-pressed":k===curSys},esc(SYS[k].n)+"<small>"+esc(SYS[k].s)+"</small>");b.onclick=()=>{curSys=k;stations()};box.append(b)});
  const s=SYS[curSys];$("#sysdetail").innerHTML=`<div class="grid2"><div class="stack"><h3>${esc(s.n)}</h3><p>${esc(s.what)}</p></div><div class="stack"><p><strong>Looking after it:</strong> ${esc(s.upkeep)}</p><p class="small muted">${s.t[0]} maintenance tasks in the draft manual, for example ${esc(s.t.slice(1).join(", "))}.</p></div></div>`;}

/* maps */
function drawMap(box,opts={}){const f=opts.filter||"ALL";let h=`<svg viewBox="0 0 340 520" role="img" aria-label="Map of Central Coast watersheds">`;
  HUC.forEach(w=>{const n=f==="ALL"?Object.values(w.s).reduce((a,b)=>a+b,0):(w.s[f]||0);
    const cls=opts.plain?"":(n?"has"+(opts.sel===w.id?" sel":""):"");
    const st=opts.shade&&opts.shade(w)?` style="fill:var(--silt);opacity:${opts.shade(w)}"`:"";
    h+=`<path d="${w.d}" class="${cls}" data-id="${w.id}"${st}><title>${esc(w.n)}${n?": "+n+" systems":""}</title></path>`;
    if(n&&!opts.plain)h+=`<text x="${w.c[0]}" y="${w.c[1]}" text-anchor="middle">${n}</text>`;});
  box.innerHTML=h+"</svg>";
  if(opts.onpick)box.querySelectorAll("path.has").forEach(p=>p.onclick=()=>opts.onpick(p.dataset.id));}
/* home: Leaflet map of the 18 CCWG sites (public view: location and system only, no status) */
const SCOL={SB:"#2B7BBF",TW:"#3C9D5B",VD:"#C99700",WB:"#DD6B2A"};
let mapF="ALL";var lmap=null,lmapLay=null,lmapMk={};const mapLy={ws:true,riv:true};
function homeMap(){const box=$("#homemap"),G=window.VTS_GEO||{},feats=((G.points||{}).features||[]).filter(f=>mapF==="ALL"||f.properties.system===mapF);
  if(!window.L){box.innerHTML=`<p class="muted" style="padding:1rem">The map could not load. Check your internet connection and reload.</p>`;}
  else if(lmap||box.clientWidth){
    /* the map is created only once its box is visible, so Leaflet measures the right size */
    if(!lmap){lmap=L.map(box,{scrollWheelZoom:false});
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(lmap);
      lmapLay={ws:L.layerGroup().addTo(lmap),riv:L.layerGroup().addTo(lmap),sites:L.layerGroup().addTo(lmap)};
      const all=((G.points||{}).features||[]).map(f=>[f.geometry.coordinates[1],f.geometry.coordinates[0]]);
      all.length?lmap.fitBounds(all,{padding:[30,30]}):lmap.setView([36.74,-121.6],9);
      if(window.ResizeObserver)new ResizeObserver(()=>{if(box.clientWidth)lmap.invalidateSize()}).observe(box);}
    Object.values(lmapLay).forEach(l=>l.clearLayers());lmapMk={};
    if(mapLy.ws&&G.calw)L.geoJSON(G.calw,{style:{color:"#03467E",weight:1,fillColor:"#03467E",fillOpacity:.05},onEachFeature:(f,l)=>{const n=f.properties.hsa&&f.properties.hsa!=="undefined"?f.properties.hsa:f.properties.ha;if(n)l.bindTooltip(esc(n))}}).addTo(lmapLay.ws);
    if(mapLy.riv&&G.rivers)L.geoJSON(G.rivers,{style:{color:"#4AA3DF",weight:1.2,opacity:.8},onEachFeature:(f,l)=>f.properties.GNIS_NAME&&l.bindTooltip(esc(f.properties.GNIS_NAME))}).addTo(lmapLay.riv);
    feats.forEach(f=>{const p=f.properties,c=SCOL[p.system]||"#888";
      const m=L.circleMarker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{radius:9,color:"#fff",weight:2,fillColor:c,fillOpacity:.95}).addTo(lmapLay.sites);
      m.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(SYS[p.system]?SYS[p.system].n:p.system)}<br><small>${esc([p.ws,p.ha].filter(x=>x&&x!=="undefined").join(" · "))}</small><br><a href="#learn/manual/${p.system}">How to maintain it</a>`);lmapMk[p.id]=m;});}
  let h="";ORDER.forEach(k=>{if(mapF!=="ALL"&&mapF!==k)return;const n=feats.filter(f=>f.properties.system===k).length;h+=`<div class="count"><b>${n}</b><span><span class="sdot" style="background:${SCOL[k]}"></span>${esc(SYS[k].n)}${n===1?"":SYS[k].n.endsWith("ch")?"es":"s"}</span></div>`});
  h+=`<div class="sitelist" role="list">${feats.map(f=>`<button type="button" role="listitem" data-id="${f.properties.id}"><span class="sdot" style="background:${SCOL[f.properties.system]}"></span><span>${esc(f.properties.name)}<small>${esc(SYS[f.properties.system].n)}</small></span></button>`).join("")}</div>`;
  $("#mapcounts").innerHTML=h;
  $$("#mapcounts .sitelist button").forEach(b=>b.onclick=()=>{const m=lmapMk[b.dataset.id];if(m){lmap.flyTo(m.getLatLng(),13);m.openPopup();box.scrollIntoView({behavior:"smooth",block:"center"})}});}
function mapLayers(){$$("#maplayers input").forEach(i=>{i.checked=mapLy[i.dataset.l];i.onchange=()=>{mapLy[i.dataset.l]=i.checked;homeMap()}})}
function mapChips(){chips($("#mapchips"),[["ALL","All systems"],...ORDER.map(k=>[k,SYS[k].n])],mapF,k=>{mapF=k;homeMap()})}

/* start */
let stSys="SB";
function startGrid(){const s=SYS[stSys];const diy=s.who.startsWith("Do");
  $("#startgrid").innerHTML=`
  <div class="panel stack"><h3>When it fits</h3><p>${esc(s.fit)}</p><p class="small muted">${esc(s.what)}</p></div>
  <div class="panel stack"><h3>${diy?"Build it yourself":"Who builds it"}</h3><ul class="plain">${diy?"<li>[IMPLEMENTATION GUIDE]</li><li>[SIZING SHEET, ONE PAGE]</li><li>[PERMITS TO CHECK]</li>":"<li>[FACT SHEET]</li><li>[PRACTITIONERS AND CONTRACTORS]</li><li>[PERMITS TO CHECK]</li>"}</ul></div>
  <div class="panel stack"><h3>What it costs</h3><p>Build: [RANGE]</p><p>Yearly maintenance: [RANGE]</p><p class="small muted">Ranges will come from project reports and the Site History records.</p></div>
  <div class="panel stack"><h3>What it takes to maintain</h3><p>${esc(s.upkeep)}</p><a href="#learn/manual/${stSys}">See the checklists and manual</a></div>
  <div class="panel stack"><h3>Examples near you</h3><p>See which watersheds already have a ${esc(s.n.toLowerCase())}.</p><a href="#home">Open the map</a></div>
  <div class="panel stack"><h3>Who can help</h3><ul class="plain"><li>[TECHNICAL ASSISTANCE CONTACT]</li><li>[FUNDING PROGRAMS]</li></ul></div>`;}
const LAYERS=["Surface water limits (TMDL areas)","Groundwater nitrate risk (draft model)","Systems already in place","Distance to drainage infrastructure","Conservation land and easements"];
let layerOn=new Set();
function whereMap(){drawMap($("#whereMap"),{plain:true,shade:w=>layerOn.size?((parseInt(w.id.slice(-3))*7+layerOn.size*13)%10)/14+.15:0})}
function layers(){const b=$("#layers");b.innerHTML="";LAYERS.forEach((l,i)=>{const lab=el("label",{class:"check"},`<input type="checkbox">${esc(l)}`);lab.firstChild.onchange=e=>{e.target.checked?layerOn.add(i):layerOn.delete(i);whereMap()};b.append(lab)})}
$("#siteForm").addEventListener("submit",e=>{e.preventDefault();$("#siteDone").innerHTML=`<div class="done"><strong>Request received.</strong> In the real site this would go to the technical team. Nothing was sent from this prototype.</div>`;e.target.reset()});

/* request */
$("#reqForm").addEventListener("submit",e=>{e.preventDefault();const f=e.target;const sy=[...f.querySelectorAll("[name=sys]:checked")].map(x=>x.value),nd=[...f.querySelectorAll("[name=need]:checked")].map(x=>x.value);
  $("#reqDone").innerHTML=`<div class="done"><strong>Request received, ${esc($("#r1").value)}.</strong><p>${sy.length?esc(sy.join(", ")):"No system chosen"}${nd.length?". You asked for: "+esc(nd.join("; ").toLowerCase()):""}.</p><p class="small">Nothing was sent from this prototype.</p></div>`;f.reset();$("#reqDone").scrollIntoView({block:"nearest"})});

/* learn */
const MAT=[
 ["Operation and Maintenance Manual (VTS_D01)","The full manual: every task, step by step, with safety notes.","crew",ORDER,"Draft"],
 ["Field Guide (VTS_D02)","Plants, signs of problems, wildlife and the parts of a system, with photos.","crew",ORDER,"Draft"],
 ["Visit Sheet (F04)","One sheet per visit: the tasks of the visit, the inspection checklist, what you fixed on the spot, what was done, and overview photos. Excel and print.","crew ranch",ORDER,"Draft"],
 ["Annual Plan (F03)","Which task is done in which month.","crew owner",ORDER,"Draft"],
 ["Preventive Maintenance Reference (F02)","Tasks grouped by visit.","crew",ORDER,"Draft"],
 ["Site History (VTS_F06) and Corrective Maintenance Log (VTS_F05)","Site History is one line per visit, kept by the supervisor. The Corrective Maintenance Log records each fix. Paper forms.","crew ranch owner",ORDER,"Draft"],
 ["Site Card (VTS_F07)","One card for each site, kept with the site partners.","ranch owner",ORDER,"Draft"],
 ["Quick cards, one page each","The short answer on the spot: what the system does, what not to do, who to call.","ranch",ORDER,"Proposed"],
 ["Before the rains and after a storm","Two short checks timed to the season.","ranch crew",ORDER,"Proposed"],
 ["Troubleshooting guide","If this, check that. For example: low flow into the wetland, check the inflow pipe and the pump.","crew ranch",ORDER,"Proposed"],
 ["Photo guide: what good looks like","Pictures of a correct setup and of the same place when it needs attention.","ranch crew",ORDER,"Proposed"],
 ["Field safety basics","Tools, heat, slips and falls, first aid.","crew",ORDER,"Proposed"],
 ["Pumps and equipment basics","Sump pumps, gauges and filters; mowing equipment that saves time.","crew",["TW","WB","VD"],"Proposed"],
 ["Woodchip bioreactor care","Woodchip condition and replacement, hydrogen sulfide, and what never to dump in it.","crew ranch",["WB"],"Proposed"],
 ["Why this system is on your land","For landowners: what it does for the ranch and what the long-term commitment is.","owner",ORDER,"Proposed"],
 ["Hands-on training days","Field sessions with partner organizations.","crew",ORDER,"Proposed"]
];
const AUD=[["all","Everyone"],["crew","Maintenance crew"],["ranch","Ranch manager or irrigator"],["owner","Landowner"]];
const AUDN={crew:"Crew",ranch:"Ranch staff",owner:"Landowner"};
let lAud="all",lSys="ALL";
function learn(){$("#learnBody").innerHTML=MAT.filter(m=>(lAud==="all"||m[2].includes(lAud))&&(lSys==="ALL"||m[3].includes(lSys))).map(m=>`<tr><td><strong>${esc(m[0])}</strong></td><td>${esc(m[1])}</td><td>${m[2].split(" ").map(a=>AUDN[a]).join(", ")}</td><td><span class="tag ${m[4]==="Draft"?"info":"due"}">${m[4]}</span></td></tr>`).join("")||`<tr><td colspan="4">Nothing for this combination yet.</td></tr>`}

stations();mapChips();mapLayers();homeMap();
chips($("#startchips"),ORDER.map(k=>[k,SYS[k].n]),stSys,k=>{stSys=k;startGrid()});startGrid();layers();whereMap();
chips($("#audchips"),AUD,lAud,k=>{lAud=k;learn()});chips($("#lsyschips"),[["ALL","All systems"],...ORDER.map(k=>[k,SYS[k].n])],lSys,k=>{lSys=k;learn()});learn();
route();
