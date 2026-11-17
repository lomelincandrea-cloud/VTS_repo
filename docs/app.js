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
const ROUTES=["home","start","maintain","request","learn","tool"];
function route(){const h=(location.hash||"#home").slice(1);const r=ROUTES.includes(h)?h:"home";
  $$("section.view").forEach(v=>v.classList.toggle("on",v.id==="v-"+r));
  $$("nav.main a").forEach(a=>{const on=a.dataset.r===r||(r==="request"&&a.dataset.r==="maintain");on?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current")});
  window.scrollTo(0,0);}
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
let mapF="ALL",mapSel=null;
function homeMap(){drawMap($("#homemap"),{filter:mapF,sel:mapSel,onpick:id=>{mapSel=mapSel===id?null:id;homeMap()}});
  const ws=HUC.filter(w=>Object.keys(w.s).length&&(!mapSel||w.id===mapSel));let tot={};ws.forEach(w=>{for(const k in w.s)tot[k]=(tot[k]||0)+w.s[k]});
  let h=`<h3>${mapSel?esc(ws[0].n):"All watersheds"}</h3>`;ORDER.forEach(k=>{if(mapF!=="ALL"&&mapF!==k)return;h+=`<div class="count"><b>${tot[k]||0}</b><span>${esc(SYS[k].n)}${(tot[k]||0)===1?"":"s"}</span></div>`});
  h+=`<p class="small muted">${mapSel?"Click the watershed again to see all.":"Click a blue watershed to see its systems."}</p>`;$("#mapcounts").innerHTML=h;}
function mapChips(){chips($("#mapchips"),[["ALL","All systems"],...ORDER.map(k=>[k,SYS[k].n])],mapF,k=>{mapF=k;homeMap()})}

/* start */
let stSys="SB";
function startGrid(){const s=SYS[stSys];const diy=s.who.startsWith("Do");
  $("#startgrid").innerHTML=`
  <div class="panel stack"><h3>When it fits</h3><p>${esc(s.fit)}</p><p class="small muted">${esc(s.what)}</p></div>
  <div class="panel stack"><h3>${diy?"Build it yourself":"Who builds it"}</h3><ul class="plain">${diy?"<li>[IMPLEMENTATION GUIDE]</li><li>[SIZING SHEET, ONE PAGE]</li><li>[PERMITS TO CHECK]</li>":"<li>[FACT SHEET]</li><li>[PRACTITIONERS AND CONTRACTORS]</li><li>[PERMITS TO CHECK]</li>"}</ul></div>
  <div class="panel stack"><h3>What it costs</h3><p>Build: [RANGE]</p><p>Yearly maintenance: [RANGE]</p><p class="small muted">Ranges will come from project reports and the Site History records.</p></div>
  <div class="panel stack"><h3>What it takes to maintain</h3><p>${esc(s.upkeep)}</p><a href="#learn">See the checklists and manual</a></div>
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

/* tool */
const VISITS=["Routine visit","After storms","Spring visit","Pre-storm visit","January review (office)","When needed","Corrective"];
const S={sys:[
  {id:"A",n:"Sample basin 1",t:"SB",w:"Monterey Bay",last:"2026-10-20",next:"2026-11-17",st:"ok"},
  {id:"B",n:"Sample ditch 1",t:"VD",w:"El Toro Creek-Salinas River",last:"2026-09-30",next:"2026-11-08",st:"due"},
  {id:"C",n:"Sample bioreactor 1",t:"WB",w:"Monterey Bay",last:"2026-10-12",next:"2026-11-12",st:"act"},
  {id:"D",n:"Sample wetland 1",t:"TW",w:"Monterey Bay",last:"2026-11-02",next:"2026-12-01",st:"ok"}],
 sched:[
  {d:"2026-11-08",s:"B",v:"Routine visit",t:"VD_T01, VD_T02",w:"Crew 1",st:"Overdue"},
  {d:"2026-11-12",s:"C",v:"Corrective",t:"COR_T01",w:"Crew 1",st:"Scheduled"},
  {d:"2026-11-17",s:"A",v:"Routine visit",t:"SB_T01, SB_T02",w:"Ranch irrigator",st:"Scheduled"}],
 log:[
  {d:"2026-11-02",s:"D",v:"Routine visit",c:"Crew 1 (2 people)",t:"TW_T01, TW_T02",n:"Water reaching the outlet. Trash removed at inlet.",f:"",h:2,k:0,i:"AL"},
  {d:"2026-10-20",s:"A",v:"Routine visit",c:"Ranch irrigator",t:"SB_T01, SB_T02",n:"Trash removed at inlet. Water level normal.",f:"",h:1,k:0,i:"AL"},
  {d:"2026-08-18",s:"A",v:"Pre-storm visit",c:"Ranch irrigator",t:"SB_T01, SB_T03, SB_T04",n:"Mowed berms before the rains. Outlet gate tested.",f:"",h:4,k:60,i:"AL"},
  {d:"2026-10-12",s:"C",v:"Routine visit",c:"Crew 1 (2 people)",t:"WB_T01",n:"Slow drainage at outlet.",f:"F05 row 1",h:1.5,k:0,i:"AL"}],
 corr:[
  {d:"2026-10-12",s:"C",f:"Is water moving through the inlet and outlet as expected? Needs attention",l:"Outlet control structure",c:"Debris behind stoplogs",a:"Scheduled COR_T01 for Nov 12",u:"Before next storm",m:"",h:"",r:"Open",p:"1 photo"}]};
const FN={SB:"Sediment Basin",TW:"Treatment Wetland",VD:"Vegetated Ditch",WB:"Woodchip Bioreactor"};
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
let fSys="A";
function pmonths(s){const o=new Set();(s||"").split(",").map(t=>t.trim()).filter(Boolean).forEach(t=>{if(t.includes("-")){const[a,b]=t.split("-").map(x=>MONTHS.indexOf(x.trim()));for(let i=a;i<=b;i++)o.add(i)}else if(MONTHS.includes(t))o.add(MONTHS.indexOf(t))});return o}
function fhead(code,title,keys){return `<div class="fcode">FORM ${esc(code)}</div><div class="ftitle">${esc(title)}</div><table class="fkeys"><tbody>${keys.map(k=>`<tr><td>${esc(k[0])}</td><td>${esc(k[1])}</td></tr>`).join("")}</tbody></table>`}
function forms(){
  if(!S.sys.some(s=>s.id===fSys))fSys=S.sys[0].id;const sy=S.sys.find(s=>s.id===fSys);
  $$(".fsel").forEach(sel=>{sel.innerHTML=S.sys.map(s=>`<option value="${s.id}"${s.id===fSys?" selected":""}>${esc(s.n)} (${esc(FN[s.t])})</option>`).join("");sel.onchange=()=>{fSys=sel.value;forms()}});
  /* F03 annual plan */
  const ts=TASKS.filter(t=>t[1]===sy.t),cnt=Array(12).fill(0),vis=MONTHS.map((m,i)=>S.sched.filter(r=>r.s===sy.id&&+r.d.slice(5,7)===i+1).map(r=>+r.d.slice(8,10)).join(", "));
  let rows=`<tr class="fplan"><td colspan="3">Planned visits (write the dates)</td>${vis.map(v=>`<td class="m">${v}</td>`).join("")}<td>Routine tasks are done at every routine visit.</td></tr>`;
  ts.forEach(t=>{const ms=pmonths(t[5]);let mid;
    if(t[3]==="Routine visit"||!ms.size)mid=`<td class="fall" colspan="12">${t[3]==="Routine visit"?"at every routine visit":"when needed"}</td>`;
    else mid=MONTHS.map((m,i)=>{if(ms.has(i))cnt[i]++;return `<td class="m">${ms.has(i)?"x":""}</td>`}).join("");
    rows+=`<tr><td>${esc(t[3])}</td><td><span class="id">${esc(t[0])}</span> ${esc(t[2])}</td><td>${esc(t[4])}</td>${mid}<td>${esc(t[6])}</td></tr>`});
  rows+=`<tr class="fcount"><td colspan="3">Planned tasks this month (count)</td>${cnt.map(c=>`<td class="m">${c}</td>`).join("")}<td></td></tr>`;
  $("#planForm").innerHTML=`<div class="form">${fhead(sy.t+"_F03","Annual Plan — "+FN[sy.t],[["VTS type",FN[sy.t]],["Site / prepared by / date",sy.n]])}<div class="scroll"><table class="fgrid"><thead><tr><th>Visit</th><th>Task</th><th>Component</th>${MONTHS.map(m=>`<th>${m}</th>`).join("")}<th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  /* F06 site history */
  const lg=S.log.filter(r=>r.s===sy.id);
  $("#logFormView").innerHTML=`<div class="form">${fhead("VTS_F06","Site History",[["VTS name",sy.n],["VTS type",FN[sy.t]],["Supervisor",""]])}<div class="scroll"><table class="flog"><thead><tr><th>Date</th><th>Visit type</th><th>Crew members</th><th>Tasks performed</th><th>Notes</th><th>Corrective maintenance (F05 entry)</th><th>Supervisor initials</th><th>Hours*</th><th>Materials cost*</th></tr></thead><tbody>${lg.map(r=>`<tr><td>${fmt(r.d)}</td><td>${esc(r.v)}</td><td>${esc(r.c)}</td><td>${esc(r.t)}</td><td>${esc(r.n)}</td><td>${esc(r.f)}</td><td>${esc(r.i)}</td><td>${esc(r.h)}</td><td>${r.k&&+r.k?"$"+esc(r.k):""}</td></tr>`).join("")}${"<tr>"+"<td></td>".repeat(9)+"</tr>".repeat(1)}</tbody></table></div></div>`;
  /* F05 corrective log */
  const cr=S.corr.filter(r=>r.s===sy.id);
  $("#corrFormView").innerHTML=`<div class="form">${fhead("VTS_F05","Corrective Maintenance Log",[["VTS name",sy.n],["VTS type",FN[sy.t]],["Supervisor",""]])}<div class="scroll"><table class="flog"><thead><tr><th>Date</th><th>Finding (from the checklist)</th><th>Location</th><th>Likely cause</th><th>Action taken</th><th>Urgency</th><th>Materials used</th><th>Hours</th><th>Resolved / escalated</th><th>Photos (before / after)</th></tr></thead><tbody>${cr.map(r=>`<tr><td>${fmt(r.d)}</td><td>${esc(r.f)}</td><td>${esc(r.l)}</td><td>${esc(r.c)}</td><td>${esc(r.a)}</td><td>${esc(r.u)}</td><td>${esc(r.m)}</td><td>${esc(r.h)}</td><td>${esc(r.r)}</td><td>${esc(r.p)}</td></tr>`).join("")}${"<tr>"+"<td></td>".repeat(10)+"</tr>"}</tbody></table></div></div>`;
}
const sysName=id=>{const x=S.sys.find(s=>s.id===id);return x?x.n:id};
const TAG={ok:["ok","Up to date"],due:["due","Visit due"],act:["act","Needs a fix"]};
const fmt=d=>new Date(d+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
function tool(){
  const open=S.corr.filter(c=>c.r==="Open").length;
  $("#tiles").innerHTML=[[S.sys.length,"systems"],[S.sys.filter(s=>s.st==="ok").length,"up to date"],[S.sched.length,"visits scheduled"],[open,"open fixes"],[S.log.reduce((a,l)=>a+(+l.h||0),0),"hours logged"]].map(t=>`<div class="tile"><b>${t[0]}</b>${t[1]}</div>`).join("");
  $("#sysBody").innerHTML=S.sys.map(s=>`<tr><td><strong>${esc(s.n)}</strong></td><td>${esc(SYS[s.t].n)}</td><td>${esc(s.w)}</td><td>${fmt(s.last)}</td><td>${fmt(s.next)}</td><td><span class="tag ${TAG[s.st][0]}">${TAG[s.st][1]}</span></td></tr>`).join("");
  S.sched.sort((a,b)=>a.d.localeCompare(b.d));
  $("#schedBody").innerHTML=S.sched.map((r,i)=>`<tr><td>${fmt(r.d)}</td><td>${esc(sysName(r.s))}</td><td>${esc(r.v)}</td><td>${esc(r.t)}</td><td>${esc(r.w)}</td><td><span class="tag ${r.st==="Overdue"?"act":r.st==="Sent"?"info":"due"}">${esc(r.st)}</span></td><td><button class="btn sm ghost" type="button" data-send="${i}">Send to phone</button></td></tr>`).join("")||`<tr><td colspan="7">Nothing scheduled. Add a visit below.</td></tr>`;
  S.log.sort((a,b)=>b.d.localeCompare(a.d));
  forms();
  $$("[data-send]").forEach(b=>b.onclick=()=>openPhone(+b.dataset.send));
  ["#s1","#l2"].forEach(q=>$(q).innerHTML=S.sys.map(s=>`<option value="${s.id}">${esc(s.n)}</option>`).join(""));
  ["#s2","#l3"].forEach(q=>$(q).innerHTML=VISITS.map(v=>`<option>${v}</option>`).join(""));}
$("#schedForm").addEventListener("submit",e=>{e.preventDefault();const sy=S.sys.find(s=>s.id===$("#s1").value);S.sched.push({d:$("#s3").value,s:sy.id,v:$("#s2").value,t:sy.t+"_T01",w:$("#s4").value,st:"Scheduled"});tool();e.target.reset()});
$("#logForm").addEventListener("submit",e=>{e.preventDefault();S.log.push({d:$("#l1").value,s:$("#l2").value,v:$("#l3").value,c:$("#l4").value,t:$("#l5").value,n:$("#l8").value,f:"",h:$("#l6").value,k:$("#l7").value,i:""});const sy=S.sys.find(s=>s.id===$("#l2").value);fSys=sy.id;sy.last=$("#l1").value;if(sy.st==="due")sy.st="ok";tool();e.target.reset()});
$("#stormBtn").onclick=()=>{const d=new Date();d.setDate(d.getDate()+2);const ds=d.toISOString().slice(0,10);S.sys.forEach(s=>S.sched.push({d:ds,s:s.id,v:"After storms",t:s.t+"_T01",w:"Unassigned",st:"Scheduled"}));tool();$("#stormMsg").textContent="Added "+S.sys.length+" after-storm inspections, due "+fmt(ds)+". See Scheduled.";};
$("#addSysBtn").onclick=()=>{S.sys.push({id:String.fromCharCode(65+S.sys.length),n:"Sample system "+(S.sys.length+1),t:"SB",w:"[WATERSHED]",last:"2026-11-10",next:"2026-12-10",st:"ok"});tool()};
function nchart(){const inl=[38,41,36,44,40,37],out=[21,19,22,18,17,16],m=["Jun","Jul","Aug","Sep","Oct","Nov"];const X=i=>40+i*52,Y=v=>130-v*2.4;
  const ln=a=>a.map((v,i)=>(i?"L":"M")+X(i)+" "+Y(v)).join(" ");
  $("#nchart").innerHTML=`<svg viewBox="0 0 330 160" role="img" aria-label="Sample chart: nitrate is lower at the outlet than at the inlet in each month."><line x1="34" y1="130" x2="320" y2="130" stroke="var(--line)"/><path d="${ln(inl)}" fill="none" stroke="var(--silt)" stroke-width="3"/><path d="${ln(out)}" fill="none" stroke="var(--water)" stroke-width="3" stroke-dasharray="6 4"/>${m.map((t,i)=>`<text x="${X(i)}" y="148" font-size="11" text-anchor="middle" fill="var(--muted)">${t}</text>`).join("")}<text x="40" y="18" font-size="12" fill="var(--silt)" font-weight="700">Inlet</text><text x="90" y="18" font-size="12" fill="var(--water)" font-weight="700">Outlet (dashed)</text></svg>`}

/* phone checklist: items from the draft Sediment Basin checklist (SB_F04) */
const CL=[
 ["Is the site safe to access and inspect from stable ground?","Do not enter. Record the condition and notify the supervisor before continuing."],
 ["Is water moving through the inlet and outlet as expected?","Clear accessible trash, vegetation, and shallow sediment from stable ground. If flow stays restricted or the structure looks damaged, photograph it and notify the supervisor."],
 ["Is the water level unusually high or close to the overflow level?","Check the outlet for visible blockages and remove accessible debris if safe. If the level stays high, record it, photograph it, and notify the supervisor."],
 ["Has sediment reached or passed the warning or cleanout level?","Record the location, photograph it, and notify the supervisor so sediment removal can be planned before the next significant water event."],
 ["Are there unwanted weeds or invasive species?","Remove small weeds by hand where safe. Record the species and take a photo."],
 ["Is there erosion, slumping, rills, gullies, or cracking on the embankments?","Record the location, take a photo, and notify the supervisor. Do not start repairs beyond your authorization."],
 ["Are there animal burrows on the slopes or berms?","Record the location, take a photo, and notify the supervisor."]];
let phIdx=null,phAns=[];
function openPhone(i){phIdx=i;phAns=CL.map(()=>null);const r=S.sched[i];r.st="Sent";tool();
  $("#phTitle").textContent=sysName(r.s);$("#phSub").textContent=r.v+", "+fmt(r.d)+", "+r.w+". Sample items from the Visit Sheet (F04) for a sediment basin.";phone();$("#phoneDlg").showModal();}
function phone(){$("#phBody").innerHTML=CL.map((q,i)=>`<div class="q"><p>${i+1}. ${esc(q[0])}</p><div class="ans">${[["n","Normal"],["a","Needs attention"],["x","Doesn’t apply"]].map(a=>`<button type="button" class="${a[0]}" data-q="${i}" data-a="${a[0]}" aria-pressed="${phAns[i]===a[0]}">${a[1]}</button>`).join("")}</div>${phAns[i]==="a"?`<div class="guide"><strong>What to do:</strong> ${esc(q[1])}<br><button class="btn sm ghost" type="button" style="margin-top:.4rem">Add photo</button></div>`:""}</div>`).join("");
  $$("#phBody [data-q]").forEach(b=>b.onclick=()=>{phAns[+b.dataset.q]=b.dataset.a;phone()});}
$("#phClose").onclick=()=>$("#phoneDlg").close();
$("#phSend").onclick=()=>{const r=S.sched[phIdx];const bad=CL.filter((q,i)=>phAns[i]==="a");const start=S.corr.length;
  bad.forEach(q=>S.corr.push({d:r.d,s:r.s,f:q[0]+" Needs attention",l:"",c:"",a:"",u:"",m:"",h:"",r:"Open",p:""}));
  S.log.push({d:r.d,s:r.s,v:r.v,c:r.w,t:r.t,n:phAns.filter(a=>a).length+" of "+CL.length+" items answered on phone.",f:bad.length?"F05 rows "+(start+1)+(bad.length>1?" to "+(start+bad.length):""):"",h:"",k:"",i:""});
  const sy=S.sys.find(s=>s.id===r.s);sy.last=r.d;sy.st=bad.length?"act":"ok";fSys=r.s;S.sched.splice(phIdx,1);$("#phoneDlg").close();tool();};

stations();mapChips();homeMap();
chips($("#startchips"),ORDER.map(k=>[k,SYS[k].n]),stSys,k=>{stSys=k;startGrid()});startGrid();layers();whereMap();
chips($("#audchips"),AUD,lAud,k=>{lAud=k;learn()});chips($("#lsyschips"),[["ALL","All systems"],...ORDER.map(k=>[k,SYS[k].n])],lSys,k=>{lSys=k;learn()});learn();
tool();nchart();route();
