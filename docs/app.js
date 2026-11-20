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
let lastTop=null,navClick=false,first=true;
/* a click on a tab or pill keeps the page where it is; a click on a card or link inside the content may move to the tab bar */
document.addEventListener("click",e=>{const a=e.target.closest("a[href^='#']");navClick=!!(a&&a.closest(".l-pills,.l-tabs,nav,[role=group],[role=tablist]"));setTimeout(()=>navClick=false,500)},true);
const calm=()=>window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function route(){const parts=(location.hash||"#home").slice(1).split("/");const r=ROUTES.includes(parts[0])?parts[0]:"home";const top=r!==lastTop;lastTop=r;
  if(r==="learn"&&window.learnRoute)window.learnRoute(parts.slice(1));
  if(r==="tool"&&window.toolRoute)window.toolRoute(parts.slice(1));
  if(r==="phone"&&window.ToolPlan)window.ToolPlan.phone(parts.slice(1).join("/"));
  $$("section.view").forEach(v=>v.classList.toggle("on",v.id==="v-"+r));
  $$("nav.main a").forEach(a=>{const on=a.dataset.r===r||(r==="request"&&a.dataset.r==="maintain");on?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current")});
  /* scroll to the top and focus the h1 only when the page changes (home, learn, tool...); inside a page keep the place,
     but bring the page's tab bar back into view if it is above the screen */
  if(top){window.scrollTo(0,0);const h=$("section.view.on h1");if(h&&first===false){h.setAttribute("tabindex","-1");h.focus({preventScroll:true})}}
  else if(!navClick)setTimeout(()=>{const bar=$("section.view.on .l-tabs");if(!bar)return;const hd=($("header.top")||{}).offsetHeight||0,y=bar.getBoundingClientRect().top;if(y<hd)window.scrollBy(0,y-hd-8)},0);
  if(r==="start")setTimeout(drawLinks,0);
  if(r==="home")setTimeout(()=>{placeRibbon();lmap?lmap.invalidateSize():homeMap()},0);}
addEventListener("hashchange",()=>{first=false;route()});
/* skip link: the site uses the hash for pages, so move focus by hand */
$("#skipLink").onclick=e=>{e.preventDefault();const t=$("section.view.on h1")||$("#main");t.setAttribute("tabindex","-1");t.focus()};

/* tabs */
$$(".tabs").forEach(tl=>tl.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  tl.querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected",x===b));
  tl.parentElement.querySelectorAll(":scope > .tabpanel").forEach(p=>p.classList.toggle("on",p.dataset.p===b.dataset.t));}));

/* chips helper */
function chips(box,items,cur,cb){box.innerHTML="";items.forEach(([k,l])=>{const b=el("button",{class:"chip",type:"button","aria-pressed":k===cur},esc(l));b.onclick=()=>{cb(k);chips(box,items,k,cb)};box.append(b)})}

/* home: the water ribbon (still) and the system picker. Ribbon buttons and picker buttons select the same system. */
let curSys="SB";
const NEXT={SB:"VD",VD:"WB",WB:"TW",TW:null},POS=[.2,.42,.64,.86];
function placeRibbon(){/* put the four buttons on the ribbon and scatter the sediment specks; needs the SVG to be measurable */
  $$(".h-stations").forEach(g=>{if(g.dataset.done)return;const m=document.getElementById(g.parentNode.querySelector("defs path").id);let L=0;try{L=m.getTotalLength()}catch(e){}if(!L)return;
    ORDER.forEach((k,i)=>{const p=m.getPointAtLength(L*POS[i]);g.querySelector('[data-k="'+k+'"]').setAttribute("transform","translate("+p.x.toFixed(1)+","+p.y.toFixed(1)+")")});
    const sp=g.parentNode.querySelector(".h-specks"),vert=g.closest("svg").classList.contains("h-art-v");let seed=3,r=()=>(seed=(seed*16807)%2147483647)/2147483647,h="";
    for(let i=0;i<46;i++){const t=.02+r()*.5,p=m.getPointAtLength(L*t),a=(r()-.5)*44;h+='<circle cx="'+(p.x+(vert?a:0)).toFixed(0)+'" cy="'+(p.y+(vert?0:a)).toFixed(0)+'" r="'+(1.8+r()*3.2).toFixed(1)+'" fill="#6F4526" opacity="'+(.9-t*1.5).toFixed(2)+'"/>'}
    if(sp)sp.innerHTML=h;g.dataset.done="1";});}
function selSys(k){curSys=k;
  $$(".h-st").forEach(e=>e.setAttribute("aria-pressed",e.dataset.k===k));
  $$("#sysPick button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.k===k));
  const s=SYS[k],nx=NEXT[k],c=$("#sysCard");
  c.classList.remove("h-in");void c.offsetWidth;c.classList.add("h-in");
  c.innerHTML=`<h3>${esc(s.n)}</h3><p class="h-short">${esc(s.s)}</p><div class="grid2"><p>${esc(s.what)}</p><p><strong>Looking after it:</strong> ${esc(s.upkeep)}</p></div>
    <p class="h-next">Next, the water enters ${nx?"the "+esc(SYS[nx].n.toLowerCase()):"Monterey Bay"}.</p><div class="row"><a class="btn" href="#learn/manual/${k}">Read the manual: ${esc(s.n)}</a></div>`;}
function stations(){const box=$("#sysPick");box.innerHTML="";ORDER.forEach(k=>{const b=el("button",{type:"button","data-k":k,"aria-pressed":k===curSys},esc(SYS[k].n));b.onclick=()=>selSys(k);box.append(b)});
  $$(".h-st").forEach(g=>{g.onclick=()=>selSys(g.dataset.k);g.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selSys(g.dataset.k)}}});
  placeRibbon();selSys(curSys);}
/* sections fade in once when they reach the screen (off with reduced motion) */
function fadeIn(){if(!("IntersectionObserver" in window)||calm())return;document.documentElement.classList.add("fx");
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.08});
  $$(".h-sec").forEach(x=>io.observe(x));}

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
let mapF="ALL",mapSel=null;var lmap=null,lmapLay=null,lmapMk={};const mapLy={ws:true,riv:true};
function homeMap(){const box=$("#homemap"),G=window.VTS_GEO||{},feats=((G.points||{}).features||[]).filter(f=>mapF==="ALL"||f.properties.system===mapF);
  if(!window.L){box.innerHTML=`<p class="muted" style="padding:1rem">The map could not load. Check your internet connection and reload.</p>`;}
  else if(lmap||box.clientWidth){
    /* the map is created only once its box is visible, so Leaflet measures the right size */
    if(!lmap){lmap=L.map(box,{scrollWheelZoom:false,zoomControl:false});L.control.zoom({position:"bottomright"}).addTo(lmap);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(lmap);
      lmapLay={ws:L.layerGroup().addTo(lmap),riv:L.layerGroup().addTo(lmap),sites:L.layerGroup().addTo(lmap),sel:L.layerGroup().addTo(lmap)};
      const all=((G.points||{}).features||[]).map(f=>[f.geometry.coordinates[1],f.geometry.coordinates[0]]);
      all.length?lmap.fitBounds(all,{padding:[30,30]}):lmap.setView([36.74,-121.6],9);
      if(window.ResizeObserver)new ResizeObserver(()=>{if(box.clientWidth)lmap.invalidateSize()}).observe(box);}
    Object.values(lmapLay).forEach(l=>l.clearLayers());lmapMk={};
    if(mapLy.ws&&G.calw)L.geoJSON(G.calw,{style:{color:"#03467E",weight:1,fillColor:"#03467E",fillOpacity:.05},onEachFeature:(f,l)=>{const n=f.properties.hsa&&f.properties.hsa!=="undefined"?f.properties.hsa:f.properties.ha;if(n)l.bindTooltip(esc(n))}}).addTo(lmapLay.ws);
    if(mapLy.riv&&G.rivers)L.geoJSON(G.rivers,{style:{color:"#4AA3DF",weight:1.2,opacity:.8},onEachFeature:(f,l)=>f.properties.GNIS_NAME&&l.bindTooltip(esc(f.properties.GNIS_NAME))}).addTo(lmapLay.riv);
    feats.forEach(f=>{const p=f.properties,c=SCOL[p.system]||"#888";
      const m=L.circleMarker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{radius:9,color:"#fff",weight:2,fillColor:c,fillOpacity:.95}).addTo(lmapLay.sites);
      m.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(SYS[p.system]?SYS[p.system].n:p.system)}<br><small>${esc([p.ws,p.ha].filter(x=>x&&x!=="undefined").join(" · "))}</small><br><a href="#learn/manual/${p.system}">How to maintain it</a>`);m.on("click",()=>pickSite(p.id));lmapMk[p.id]=m;});
    if(mapSel&&lmapMk[mapSel])pickSite(mapSel,true);}
  let h="";ORDER.forEach(k=>{if(mapF!=="ALL"&&mapF!==k)return;const n=feats.filter(f=>f.properties.system===k).length;h+=`<div class="count"><b>${n}</b><span><span class="sdot" style="background:${SCOL[k]}"></span>${esc(SYS[k].n)}${n===1?"":SYS[k].n.endsWith("ch")?"es":"s"}</span></div>`});
  h+=`<div class="sitelist" role="list">${feats.map(f=>`<button type="button" role="listitem" data-id="${f.properties.id}"><span class="sdot" style="background:${SCOL[f.properties.system]}"></span><span>${esc(f.properties.name)}<small>${esc(SYS[f.properties.system].n)}</small></span></button>`).join("")}</div>`;
  $("#mapcounts").innerHTML=h;
  $$("#mapcounts .sitelist button").forEach(b=>b.onclick=()=>{const m=lmapMk[b.dataset.id];if(m){calm()?lmap.setView(m.getLatLng(),13,{animate:false}):lmap.flyTo(m.getLatLng(),13);pickSite(b.dataset.id);m.openPopup();box.scrollIntoView({behavior:calm()?"auto":"smooth",block:"center"})}});}
/* the selected site gets a yellow pill label with its system name */
function pickSite(id,quiet){mapSel=id;const G=window.VTS_GEO||{},f=((G.points||{}).features||[]).find(x=>x.properties.id===id);if(!f||!lmapLay)return;lmapLay.sel.clearLayers();
  L.marker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{interactive:false,keyboard:false,icon:L.divIcon({className:"h-pin",html:`<span>${esc(SYS[f.properties.system]?SYS[f.properties.system].n:f.properties.system)}</span>`,iconSize:null,iconAnchor:[0,34]})}).addTo(lmapLay.sel);
  $$("#mapcounts .sitelist button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.id===id));}
function mapLayers(){$$("#maplayers input").forEach(i=>{i.checked=mapLy[i.dataset.l];i.onchange=()=>{mapLy[i.dataset.l]=i.checked;homeMap()}})}
function mapChips(){chips($("#mapchips"),[["ALL","All systems"],...ORDER.map(k=>[k,SYS[k].n])],mapF,k=>{mapF=k;homeMap()})}

/* start */
let stSys="SB",stBr="fit";
/* Start, step 1: a mind map. The system in the centre, six round branches joined by curved connectors; a branch fills the panel below. */
const IP='<span class="l-chip y">In progress</span>';
const todo=(t,x)=>`<li><b>${t}</b> ${IP}<br><span class="muted">${x}</span></li>`;
const BR=[["fit","When it fits","L"],["build",null,"L"],["cost","What it costs","L"],["keep","What it takes to maintain","R"],["near","Examples near you","R"],["help","Who can help","R"]];
function brText(k){const s=SYS[stSys],diy=s.who.startsWith("Do");
  return {fit:[`When it fits`,`<p>${esc(s.fit)}</p><p class="muted">${esc(s.what)}</p>`],
    build:[diy?"Build it yourself":"Who builds it",diy?`<ul class="plain s-todo">${todo("Implementation guide","How to build it yourself, step by step.")}${todo("Sizing sheet, one page","How big it needs to be for your field.")}${todo("Permits to check","The permits to check before you build.")}</ul>`
      :`<p>${esc(s.n)}s are installed by practitioners.</p><ul class="plain s-todo">${todo("Fact sheet","One page on what the system is and does.")}${todo("Practitioners and contractors","People and firms who build these systems.")}${todo("Permits to check","The permits to check before you build.")}</ul>`],
    cost:["What it costs",`<ul class="plain s-todo">${todo("Building it","A typical cost range.")}${todo("Yearly maintenance","A typical cost range per year.")}</ul><p class="small muted">Ranges will come from project reports and the Site History records. Nothing is estimated here until then.</p>`],
    keep:["What it takes to maintain",`<p>${esc(s.upkeep)}</p><p><a href="#learn/manual/${stSys}">See the checklists and manual →</a></p>`],
    near:["Examples near you",`<p>See where there is already a ${esc(s.n.toLowerCase())} on the public map.</p><div class="row"><button class="btn ghost" type="button" id="sNear">Open the map with only ${esc(s.n.toLowerCase())}s</button></div>`],
    help:["Who can help",`<ul class="plain s-todo">${todo("Technical assistance contact","Who to call for advice on a site.")}${todo("Funding programs","Programs that can help pay for a system.")}</ul>`]}[k];}
function startGrid(){
  const box=$("#smap"),node=(k,side)=>{const t=brText(k);return `<button type="button" class="s-node s-${side}" data-br="${k}" aria-pressed="${k===stBr}" aria-controls="sdetail">${esc(t[0])}</button>`};
  box.innerHTML=`<svg class="s-lines" aria-hidden="true"><defs><marker id="sArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10z" fill="var(--water)"/></marker></defs></svg>
    <div class="s-col">${BR.filter(b=>b[2]==="L").map(b=>node(b[0],"l")).join("")}</div>
    <div class="s-centre" aria-hidden="true">${esc(SYS[stSys].n)}</div>
    <div class="s-col">${BR.filter(b=>b[2]==="R").map(b=>node(b[0],"r")).join("")}</div>`;
  $$("#smap .s-node").forEach(b=>b.onclick=()=>{stBr=b.dataset.br;$$("#smap .s-node").forEach(x=>x.setAttribute("aria-pressed",x===b));detail()});
  detail();drawLinks();}
function detail(){const t=brText(stBr),d=$("#sdetail");d.classList.remove("h-in");void d.offsetWidth;d.classList.add("h-in");
  d.innerHTML=`<h3>${esc(SYS[stSys].n)}: ${esc(t[0])}</h3>${t[1]}`;
  if($("#sNear"))$("#sNear").onclick=()=>{mapF=stSys;mapChips();location.hash="#home";setTimeout(()=>{homeMap();const m=$("#homemap");if(m)m.scrollIntoView({block:"center"})},150)};}
/* curved connectors with small arrowheads, drawn from the node positions; redrawn when the size changes */
function drawLinks(){const box=$("#smap"),svg=box&&box.querySelector(".s-lines");if(!svg||!box.offsetWidth)return;
  const B=box.getBoundingClientRect(),c=box.querySelector(".s-centre").getBoundingClientRect(),cx=c.left+c.width/2-B.left,cy=c.top+c.height/2-B.top,r=c.width/2;
  svg.setAttribute("viewBox",`0 0 ${B.width} ${B.height}`);svg.setAttribute("width",B.width);svg.setAttribute("height",B.height);
  let h=svg.querySelector("defs").outerHTML;
  $$("#smap .s-node").forEach(n=>{const R=n.getBoundingClientRect(),left=n.classList.contains("s-l"),nx=(left?R.right:R.left)-B.left,ny=R.top+R.height/2-B.top;
    const sx=cx+(left?-r:r),sy=cy,mx=(sx+nx)/2;
    h+=`<path d="M${sx.toFixed(1)},${sy.toFixed(1)} C${mx.toFixed(1)},${sy.toFixed(1)} ${mx.toFixed(1)},${ny.toFixed(1)} ${(nx+(left?6:-6)).toFixed(1)},${ny.toFixed(1)}" fill="none" stroke="var(--water)" stroke-width="2.5" marker-end="url(#sArr)"/>`;});
  svg.innerHTML=h;}
if(window.ResizeObserver){const ro=new ResizeObserver(()=>drawLinks());setTimeout(()=>{const m=$("#smap");if(m)ro.observe(m)},0);}
/* Next buttons on the Start path */
$$("[data-next]").forEach(b=>b.onclick=()=>{const t=$(`.s-path button[data-t="${b.dataset.next}"]`);t.click();t.focus({preventScroll:true});const p=$(".s-path");const y=p.getBoundingClientRect().top;if(y<0)p.scrollIntoView({block:"start"});setTimeout(drawLinks,0)});
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

stations();mapChips();mapLayers();homeMap();fadeIn();
{const n=((window.VTS_GEO||{}).points||{}).features;if(n&&$("#siteCount"))$("#siteCount").textContent=n.length;}
{const pick=()=>{$("#startchips").innerHTML=ORDER.map(k=>`<button type="button" data-k="${k}" aria-pressed="${k===stSys}">${esc(SYS[k].n)}</button>`).join("");$$("#startchips button").forEach(b=>b.onclick=()=>{stSys=b.dataset.k;pick();startGrid()})};pick();}startGrid();layers();whereMap();
chips($("#audchips"),AUD,lAud,k=>{lAud=k;learn()});chips($("#lsyschips"),[["ALL","All systems"],...ORDER.map(k=>[k,SYS[k].n])],lSys,k=>{lSys=k;learn()});learn();
route();
