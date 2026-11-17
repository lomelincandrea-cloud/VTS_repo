(function(){
'use strict';
const V=window.VTS, GEO=window.VTS_GEO||{}; const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)]; const app=$('#app');
const SYS={SB:{n:'Sediment Basin',c:'#2B7BBF'},TW:{n:'Treatment Wetland',c:'#3C9D5B'},VD:{n:'Vegetated Ditch',c:'#C99700'},WB:{n:'Woodchip Bioreactor',c:'#DD6B2A'},COR:{n:'Corrective Maintenance',c:'#B4361F'}};
const MAIN=['SB','TW','VD','WB'];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const taskById=id=>V.tasks.find(t=>t.id===id);
const sysChip=s=>`<span class="chip sys" style="background:${(SYS[s]||{}).c||'#888'}">${s}</span>`;
const iconSvg=(g,c)=>V.icons[g+'_'+c]?`<svg viewBox="0 0 24 24">${V.icons[g+'_'+c]}</svg>`:'';
function flowerSvg(col){const h=V.flowerHex[(col||'').toLowerCase()]||'#F6B800';let p='';[0,72,144,216,288].forEach(a=>{p+=`<ellipse cx="12" cy="5.6" rx="3" ry="4.2" fill="${h}" stroke="#0002" stroke-width=".6" transform="rotate(${a} 12 12)"/>`});return `<svg viewBox="0 0 24 24">${p}<circle cx="12" cy="12" r="2.6" fill="#8a6a3b"/></svg>`;}
/* ---------- navegación ---------- */
const NAV=[['','Home'],['map','Map'],['manual','Manual'],['checklist','Checklists'],['plants','Plants'],['sources','Sources']];
function setNav(v){$('#nav').innerHTML=NAV.map(([k,n])=>`<a href="#/${k==='manual'?'manual/SB':k==='checklist'?'checklist/SB':k}" class="${(v===k||(k==='manual'&&(v==='task'||v==='topic')))?'on':''}">${n}</a>`).join('');}
function route(){const [v='',a,b]=location.hash.replace(/^#\/?/,'').split('/');window.scrollTo(0,0);setNav(v);closeModal();
 try{ if(v==='map')viewMap(); else if(v==='manual')viewManual(a); else if(v==='task')viewTask(a); else if(v==='topic')viewTopic(a); else if(v==='checklist')viewChecklist(a||'SB'); else if(v==='plants')viewPlants(); else if(v==='sources')viewSources(); else viewHome(); }
 catch(e){app.innerHTML=`<div class="card"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`;console.error(e);} }
window.addEventListener('hashchange',route);
/* ---------- modal ---------- */
const modal=$('#modal'); function openModal(h){modal.innerHTML=`<div class="sheet"><button class="x" aria-label="Close">×</button>${h}</div>`;modal.hidden=false;$('.x',modal).onclick=closeModal;}
function closeModal(){modal.hidden=true;modal.innerHTML='';} modal.addEventListener('click',e=>{if(e.target===modal)closeModal();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
/* ---------- home ---------- */
function viewHome(){const nt=V.tasks.length,np=V.plants.filter(p=>p.status==='Native').length,ns=(GEO.points?GEO.points.features.length:0);
 app.innerHTML=`<section class="hero"><h1>Keep every treatment system<br>working for the water</h1><p>Operation and maintenance manual, inspection checklists, a plant picker, and a map of vegetated treatment systems in the Salinas Valley. A prototype to explore, built from the project's open materials.</p>
 <div class="cta"><a class="btn" href="#/checklist/SB">Start an inspection</a><a class="btn ghost" href="#/plants">Find plants to plant</a><a class="btn ghost" href="#/map">Open the map</a></div></section>
 <div class="grid g4" style="margin-top:18px"><div class="card"><div class="stat">${ns}</div>VTS sites on the map</div><div class="card"><div class="stat">${nt}</div>maintenance tasks, each with a flow diagram</div><div class="card"><div class="stat">${np}</div>native plants with identification clues</div><div class="card"><div class="stat">4</div>inspection checklists you can fill in</div></div>
 <h2>Choose your system</h2><div class="grid g4">${MAIN.map(s=>`<a class="card" href="#/manual/${s}"><span class="sysdot" style="background:${SYS[s].c}"></span><h3 style="display:inline">${SYS[s].n}</h3><p class="src">${V.tasks.filter(t=>t.sys===s).length} tasks · checklist · plants</p><span class="chip">Manual</span><span class="chip">Checklist</span></a>`).join('')}</div>
 <h2>Start here</h2><div class="grid g3">${[['topic/TOP-01','About this manual','Who it is for and what to bring.'],['topic/TOP-04','Health and safety','PPE, hazards, heat, enclosed structures.'],['topic/TOP-16','Corrective maintenance','What to do when you find a problem, and who decides.']].map(([h,t,d])=>`<a class="card" href="#/${h}"><h3>${t}</h3><p>${d}</p></a>`).join('')}</div>`;}
/* ---------- mapa ---------- */
const STL={good:'Good',watch:'Needs attention',action:'Action needed'},PUB={good:'Operating',watch:'Under review',action:'Under review'},SCOL={good:'#2F8F4E',watch:'#E39B0B',action:'#B4361F'};
const ISS={SB:['Sediment close to the warning level','Vegetation above target height'],TW:['Water level above operating range','Invasive plants near the inlet'],VD:['Erosion on a bank','Bare patches near the outlet'],WB:['Rodent burrows near the control structure','Stoplog gasket worn']};
const ms={mode:'public',sys:{SB:1,TW:1,VD:1,WB:1},ws:true,huc:false,riv:true};
const rank={good:0,watch:1,action:2};
function inRing(pt,r){let x=pt[0],y=pt[1],c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
function inPoly(pt,g){const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;return ps.some(p=>inRing(pt,p[0])&&!p.slice(1).some(h=>inRing(pt,h)));}
const lastDate=id=>{const n=parseInt(id.slice(1),10);const d=new Date(2026,9,1+((n*5)%28));return d.toISOString().slice(0,10);};
function viewMap(){const feats=(GEO.points||{features:[]}).features;
 app.innerHTML=`<h1>Map of VTS sites</h1><div class="banner">Demo statuses: locations come from the project's GIS file; statuses and issues below are fictional to show how the public and private views would differ.</div>
 <div class="row noprint"><div class="seg" id="mode"><button data-m="public">Public view</button><button data-m="private">Private view (demo)</button></div><span class="sp"></span><div class="pills" id="syspills" style="margin:0">${MAIN.map(s=>`<button class="pill on" data-s="${s}">${SYS[s].n}</button>`).join('')}</div></div>
 <div class="row noprint" style="font-size:13.5px;margin:6px 0"><label><input type="checkbox" id="lws" checked> Sub-watersheds (CalWater)</label><label><input type="checkbox" id="lhuc"> HUC-10 watersheds</label><label><input type="checkbox" id="lriv" checked> Rivers</label></div>
 <div class="mapwrap"><div class="card sitelist" id="sitelist"></div><div id="map"></div></div><p class="src" id="maplegend"></p>`;
 if(!window.L){$('#map').innerHTML='<div style="padding:40px">The map library could not load. Check your internet connection and reload.</div>';return;}
 const map=L.map('map').setView([36.74,-121.5],9);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
 const lay={ws:L.layerGroup(),huc:L.layerGroup(),riv:L.layerGroup(),sites:L.layerGroup()};Object.values(lay).forEach(l=>l.addTo(map));const markers={};
 const wsCount=(GEO.calw?GEO.calw.features:[]).map(f=>{const inside=feats.filter(p=>inPoly(p.geometry.coordinates,f.geometry));return inside});
 function draw(){Object.values(lay).forEach(l=>l.clearLayers());
  if(ms.huc&&GEO.huc10)L.geoJSON(GEO.huc10,{style:{color:'#0a6ab8',weight:1,fillOpacity:.04,dashArray:'4 3'},onEachFeature:(f,l)=>l.bindTooltip(f.properties.name+' (HUC-10 '+f.properties.huc10+')')}).addTo(lay.huc);
  if(ms.ws&&GEO.calw)L.geoJSON(GEO.calw,{style:(f)=>{const i=GEO.calw.features.indexOf(f),s=wsCount[i]||[];if(!s.length)return{color:'#9bb3c9',weight:.8,fillOpacity:.02};const w=s.map(x=>x.properties.status).reduce((a,b)=>rank[b]>rank[a]?b:a,'good');return ms.mode==='private'?{color:SCOL[w],weight:1.5,fillColor:SCOL[w],fillOpacity:.28}:{color:'#03467E',weight:1.5,fillColor:'#03467E',fillOpacity:.10};},
   onEachFeature:(f,l)=>{const i=GEO.calw.features.indexOf(f),s=wsCount[i]||[];if(s.length){const w=s.map(x=>x.properties.status).reduce((a,b)=>rank[b]>rank[a]?b:a,'good');l.bindTooltip(`<b>${esc(f.properties.hsa&&f.properties.hsa!=='undefined'?f.properties.hsa:f.properties.ha)}</b><br>${s.length} VTS site${s.length>1?'s':''}`+(ms.mode==='private'?`<br>Worst status: ${STL[w]}`:''));}}}).addTo(lay.ws);
  if(ms.riv&&GEO.rivers)L.geoJSON(GEO.rivers,{style:{color:'#4aa3df',weight:1.2,opacity:.8},onEachFeature:(f,l)=>f.properties.GNIS_NAME&&l.bindTooltip(f.properties.GNIS_NAME)}).addTo(lay.riv);
  feats.filter(f=>ms.sys[f.properties.system]).forEach(f=>{const p=f.properties,c=SYS[p.system].c,priv=ms.mode==='private';
   const m=L.circleMarker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{radius:priv?10:9,color:c,weight:priv?4:2,fillColor:priv?SCOL[p.status]:c,fillOpacity:.95}).addTo(lay.sites);
   m.bindPopup(popup(p));markers[p.id]=m;});
  list();legend();}
 function popup(p){const priv=ms.mode==='private';return `<div style="min-width:220px"><b>${esc(p.name)}</b><br>${sysChip(p.system)} <small>${SYS[p.system].n}</small><br><small>${esc(p.ws||p.ha||p.huc10_name||'')}</small>`+(priv?`<p style="margin:8px 0 2px"><span class="status"><span class="dot ${p.status}"></span>${STL[p.status]}</span><br><small>Last inspection (demo): ${lastDate(p.id)}</small></p>`+(p.status==='good'?'':`<ul style="margin:4px 0;padding-left:16px">${ISS[p.system].slice(0,p.status==='action'?2:1).map(i=>`<li>${i}</li>`).join('')}</ul>`):`<p style="margin:8px 0 2px"><b>Overall status:</b> ${PUB[p.status]}<br><small>The public view shows location and overall status only.</small></p>`)+`<a href="#/checklist/${p.system}">Open checklist</a> · <a href="#/manual/${p.system}">Manual</a></div>`;}
 function list(){const el=$('#sitelist');el.innerHTML=`<b>${feats.filter(f=>ms.sys[f.properties.system]).length} sites</b>`+feats.filter(f=>ms.sys[f.properties.system]).map(f=>{const p=f.properties;return `<div class="site" data-id="${p.id}">${ms.mode==='private'?`<span class="dot ${p.status}" style="margin-top:6px"></span>`:`<span class="sysdot" style="background:${SYS[p.system].c};margin-top:5px"></span>`}<div>${esc(p.name)}<small>${SYS[p.system].n}</small></div></div>`}).join('');
  $$('.site',el).forEach(s=>s.onclick=()=>{const m=markers[s.dataset.id];if(m){map.flyTo(m.getLatLng(),13);m.openPopup();}});}
 function legend(){$('#maplegend').innerHTML=ms.mode==='private'?'Marker fill = status (demo): <span class="dot good"></span> good <span class="dot watch"></span> needs attention <span class="dot action"></span> action needed. Outline = system type. Watershed shading = worst status among its sites.':'Marker color = system type. The public view shows only location and overall status.';}
 $$('#mode button').forEach(b=>{b.classList.toggle('on',b.dataset.m===ms.mode);b.onclick=()=>{ms.mode=b.dataset.m;$$('#mode button').forEach(x=>x.classList.toggle('on',x===b));draw();};});
 $$('#syspills .pill').forEach(b=>{b.classList.toggle('on',!!ms.sys[b.dataset.s]);b.onclick=()=>{ms.sys[b.dataset.s]=ms.sys[b.dataset.s]?0:1;b.classList.toggle('on',!!ms.sys[b.dataset.s]);draw();};});
 [['lws','ws'],['lhuc','huc'],['lriv','riv']].forEach(([id,k])=>{const e=$('#'+id);e.checked=ms[k];e.onchange=()=>{ms[k]=e.checked;draw();};});
 draw();const pts=feats.map(f=>[f.geometry.coordinates[1],f.geometry.coordinates[0]]);if(pts.length)map.fitBounds(pts,{padding:[30,30]});}
/* ---------- manual ---------- */
const VISITS=['Routine visit','Seasonal visit','Annual visit','As needed (programmed)','As needed (corrective)'];
function viewManual(s){s=SYS[s]?s:'SB';const ts=V.tasks.filter(t=>t.sys===s).sort((a,b)=>a.no-b.no);
 app.innerHTML=`<h1>Operation and maintenance manual</h1><div class="pills">${[...MAIN,'COR'].map(k=>`<a class="pill ${k===s?'on':''}" href="#/manual/${k}">${SYS[k].n}</a>`).join('')}</div>
 <div class="two"><div>${VISITS.map(v=>{const g=ts.filter(t=>t.visit===v);return g.length?`<h2>${v}</h2><div class="grid">${g.map(t=>taskCard(t)).join('')}</div>`:''}).join('')}</div>
 <aside><div class="card"><h3>Read first</h3>${V.topics.filter(t=>!t.sys||t.sys===s||t.sys==='ALL').map(t=>`<p style="margin:6px 0"><a href="#/topic/${t.id}">${esc(t.title)}</a></p>`).join('')}</div>
 <div class="card" style="margin-top:12px"><h3>Fill in a checklist</h3><p>Use the visual inspection checklist for the ${SYS[s].n.toLowerCase()}.</p><a class="btn sm" href="#/checklist/${MAIN.includes(s)?s:'SB'}">Open checklist</a></div></aside></div>`;}
const taskCard=t=>`<a class="card" href="#/task/${t.id}"><div class="row"><b class="hd" style="font-size:20px">${esc(t.name)}</b><span class="sp"></span><small class="src">${t.id}</small></div><div>${t.freq.map(f=>`<span class="chip y">${esc(f)}</span>`).join('')}<span class="chip">${esc(t.type)}</span></div><div class="src" style="margin-top:4px">${t.short.replace(/<[^>]+>/g,'').slice(0,150)}…</div></a>`;
function viewTask(id){const t=taskById(id);if(!t){app.innerHTML='<div class="card">Task not found.</div>';return;}
 const steps=t.steps.map(s=>{const b=s.ty==='Yes branch'?`<span class="tag y">YES</span>`:s.ty==='No branch'?`<span class="tag n">NO</span>`:'';const cls=(s.ty==='Yes branch'||s.ty==='No branch')?'b':s.lv>=2?'sub':'n'+(s.ty.indexOf('Decision')===0?' q':'');return `<li class="${cls}">${b}${s.t}</li>`;}).join('');
 const bx=(h,c,w)=>c?`<div class="box ${w||''}"><b>${h}</b><div>${c}</div></div>`:'';
 app.innerHTML=`<p class="noprint"><a href="#/manual/${t.sys}">← ${SYS[t.sys].n}</a></p><div class="row">${sysChip(t.sys)}<span class="sp"></span><small class="src">${t.id}</small></div><h1>${esc(t.name)}</h1>
 <div>${t.freq.map(f=>`<span class="chip y">${esc(f)}</span>`).join('')}<span class="chip">${esc(t.type)}</span><span class="chip g">${esc(t.level)}</span>${t.cor?`<span class="chip r">${esc(t.cor)}</span>`:''}</div><div class="src" style="margin:6px 0">${t.when.replace(/<\/?p>/g,'')}</div><div class="banner">${t.short.replace(/<\/?p>/g,'')}</div>
 <div class="two"><div>${t.flow?`<div class="flow">${t.flow}</div>`:''}<div class="box" style="margin-top:12px"><b>Steps</b><div><ol class="steps">${steps}</ol></div></div></div>
 <div>${bx('Responsibilities',t.resp)}${bx('Tools and equipment',t.tools)}${bx('Safety',t.safety)}${bx('Waste handling',t.waste)}${bx('Escalation',t.esc,'warn')}${bx('Notes',t.notes)}
 ${t.basis.length?`<p class="src"><b>Basis:</b> ${t.basis.map(esc).join('; ')}</p>`:''}<p class="noprint"><a class="btn sm" href="#/checklist/${MAIN.includes(t.sys)?t.sys:'SB'}">Open the checklist</a></p></div></div>`;}
function viewTopic(id){const t=V.topics.find(x=>x.id===id);if(!t){app.innerHTML='<div class="card">Topic not found.</div>';return;}
 app.innerHTML=`<p class="noprint"><a href="#/manual/SB">← Manual</a></p><h1>${esc(t.title)}</h1><div class="manual-body">${t.html}</div>`;}
/* ---------- checklist ---------- */
function viewChecklist(s){s=MAIN.includes(s)?s:'SB';const key='vts_cl_'+s;const today=new Date().toISOString().slice(0,10);
 let st={h:{site:'',date:today,insp:'',visit:'Routine',rain:'',weather:''},p:{},a:{},all:false};try{const sv=JSON.parse(localStorage.getItem(key));if(sv)st=Object.assign(st,sv);}catch(e){}
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(st));}catch(e){}};const items=V.checklist.filter(i=>i.sys===s);const sites=(GEO.points?GEO.points.features:[]).filter(f=>f.properties.system===s).map(f=>f.properties.name);
 app.innerHTML=`<h1>Visual inspection checklist</h1><div class="pills noprint">${MAIN.map(k=>`<a class="pill ${k===s?'on':''}" href="#/checklist/${k}">${SYS[k].n}</a>`).join('')}</div>
 <div class="card"><div class="fgrid"><label class="field">Site / VTS<select id="h_site"><option value="">Choose…</option>${sites.map(n=>`<option ${st.h.site===n?'selected':''}>${esc(n)}</option>`).join('')}<option ${st.h.site==='Other'?'selected':''}>Other</option></select></label>
 <label class="field">Date<input type="date" id="h_date" value="${st.h.date}"></label><label class="field">Inspector<input id="h_insp" value="${esc(st.h.insp)}"></label>
 <label class="field">Visit type<select id="h_visit">${['Routine','After storm','Seasonal'].map(v=>`<option ${st.h.visit===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field">Last rain (date / amount)<input id="h_rain" value="${esc(st.h.rain)}"></label></div>
 <h3 style="margin-top:14px">Site conditions <small class="src">(the supervisor fills these in from the design or the annual plan)</small></h3><div class="fgrid">${(V.siteParams[s]||[]).map((f,i)=>`<label class="field">${esc(f)}<input data-p="${i}" value="${esc(st.p[i]||'')}"></label>`).join('')}</div></div>
 <div class="sticky noprint"><div class="row"><div style="flex:1;min-width:200px"><div class="bar"><i id="prog"></i></div><small id="ptxt" class="src"></small></div><label style="font-size:13px"><input type="checkbox" id="showall"> Show items that do not apply to this visit</label>
 <button class="btn sm line" id="reset">Reset</button><button class="btn sm line" id="csv">Download CSV</button><button class="btn sm" onclick="window.print()">Print</button></div></div>
 <div id="items"></div><div class="card" id="summary" style="margin-top:14px"></div>`;
 $('#showall').checked=st.all;
 const bind=(id,k)=>{$('#'+id).oninput=$('#'+id).onchange=e=>{st.h[k]=e.target.value;save();if(k==='visit')renderItems();};};bind('h_site','site');bind('h_date','date');bind('h_insp','insp');bind('h_visit','visit');bind('h_rain','rain');
 $$('[data-p]').forEach(i=>i.oninput=()=>{st.p[i.dataset.p]=i.value;save();});$('#showall').onchange=e=>{st.all=e.target.checked;save();renderItems();};
 $('#reset').onclick=()=>{if(confirm('Clear this checklist?')){st.a={};st.p={};save();viewChecklist(s);}};
 function applies(i){return i.vis.includes(st.h.visit);}
 function renderItems(){let cur='',h='';items.filter(i=>st.all||applies(i)).forEach(i=>{if(i.sec!==cur){cur=i.sec;h+=`<div class="cl-sec">${esc(cur)}</div>`;}const a=st.a[i.id]||{};const ab=a.r==='ab';
  h+=`<div class="cl-item ${a.r||''} ${applies(i)?'':'dim'}" data-i="${i.id}"><div class="q">${esc(i.q)}</div><div class="lk">${esc(i.look)}${i.normal?` <b>Normal:</b> ${esc(i.normal)}`:''}</div>
  <div class="rad"><label class="ok"><input type="radio" name="r_${i.id}" value="ok" ${a.r==='ok'?'checked':''}><span>OK</span></label><label class="ab"><input type="radio" name="r_${i.id}" value="ab" ${ab?'checked':''}><span>Abnormal</span></label><label class="na"><input type="radio" name="r_${i.id}" value="na" ${a.r==='na'?'checked':''}><span>N/A</span></label></div>
  ${ab?`<div class="warnbox"><b>If abnormal:</b> ${esc(i.ab)}</div><div class="row"><label><input type="checkbox" data-ph="${i.id}" ${a.ph?'checked':''}> Photo taken${i.photo?' (required)':''}</label><input class="search" style="max-width:none;flex:1" data-nt="${i.id}" placeholder="Location and notes" value="${esc(a.nt||'')}"></div>${i.go.length?`<div style="margin-top:6px">Go to: ${i.go.map(g=>`<a class="chip" href="#/task/${g}">${esc((taskById(g)||{name:g}).name)}</a>`).join('')}</div>`:''}`:''}</div>`;});
  $('#items').innerHTML=h||'<div class="card">No items for this visit type.</div>';
  $$('#items input[type=radio]').forEach(r=>r.onchange=()=>{const id=r.name.slice(2);st.a[id]=Object.assign(st.a[id]||{},{r:r.value});save();renderItems();});
  $$('#items [data-ph]').forEach(c=>c.onchange=()=>{const id=c.dataset.ph;st.a[id]=Object.assign(st.a[id]||{},{ph:c.checked});save();summary();});
  $$('#items [data-nt]').forEach(c=>c.oninput=()=>{const id=c.dataset.nt;st.a[id]=Object.assign(st.a[id]||{},{nt:c.value});save();});summary();}
 function summary(){const act=items.filter(applies);const done=act.filter(i=>(st.a[i.id]||{}).r).length,ab=act.filter(i=>(st.a[i.id]||{}).r==='ab');const nop=ab.filter(i=>i.photo&&!(st.a[i.id]||{}).ph).length;
  $('#prog').style.width=(act.length?100*done/act.length:0)+'%';$('#ptxt').textContent=`${done} of ${act.length} items answered · ${ab.length} abnormal`;
  const go=[...new Set(ab.flatMap(i=>i.go))];$('#summary').innerHTML=`<h3>Summary</h3><p><span class="chip g">${done} answered</span><span class="chip r">${ab.length} abnormal</span>${nop?`<span class="chip y">${nop} abnormal without photo</span>`:''}</p>`+(ab.length?`<p><b>Notify the supervisor</b> of every abnormal finding. Suggested follow-up tasks:</p><p>${go.map(g=>`<a class="chip" href="#/task/${g}">${esc((taskById(g)||{name:g}).name)}</a>`).join('')||'—'}</p>`:'<p class="src">No abnormal findings yet.</p>');}
 $('#csv').onclick=()=>{const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';const rows=[['Checklist',s+'_F04'],['Site',st.h.site],['Date',st.h.date],['Inspector',st.h.insp],['Visit type',st.h.visit],['Last rain',st.h.rain],...(V.siteParams[s]||[]).map((f,i)=>[f,st.p[i]||'']),[],['Item','Section','Question','Applies','Result','Photo','Notes','If abnormal','Go to']];
  items.forEach(i=>{const a=st.a[i.id]||{};rows.push([i.id,i.sec,i.q,applies(i)?'yes':'no',a.r==='ok'?'OK':a.r==='ab'?'Abnormal':a.r==='na'?'N/A':'',a.ph?'yes':'',a.nt||'',a.r==='ab'?i.ab:'',i.go.join(' ')]);});
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${s}_F04_${st.h.date}.csv`;a.click();};
 renderItems();}
/* ---------- plantas ---------- */
const ZN=[['W','Water','Standing or constantly wet'],['L','Low','Ponds briefly after rain'],['M','Mid','Slope that gets wet and dries'],['H','High','Top of the bank, stays dry']],ZX={W:12.5,L:37.5,M:62.5,H:87.5};
const GROUPS=['Trees','Shrubs and vines','Flowers and herbs','Grasses, sedges and rushes','Aquatic plants and algae'];
const ps={zone:'all',sys:'all',group:'all',flowers:false,inv:false,color:'',q:'',by:'zone',x:50};
function gY(x){const p=[[0,238],[22,238],[27,196],[50,172],[75,112],[100,86]];for(let i=1;i<p.length;i++){if(x<=p[i][0]){const a=p[i-1],b=p[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+t*(b[1]-a[1]);}}return 86;}
const zoneOf=x=>x<25?'W':x<50?'L':x<75?'M':'H';
function bankSvg(){let g='';for(let x=0;x<=100;x+=1)g+=(x?'L':'M')+(x*10)+','+gY(x).toFixed(1)+' ';const ground='M0,340 '+g.replace(/^M/,'L')+'L1000,340 Z';
 const deco=(x,fn)=>{const y=gY(x);return fn(x*10,y);};
 const reed=(x,y)=>`<g stroke="#3C9D5B" stroke-width="3" stroke-linecap="round"><path d="M${x},${y} V${y-48}"/><path d="M${x+9},${y} V${y-36}"/><path d="M${x-9},${y} V${y-40}"/></g><ellipse cx="${x}" cy="${y-52}" rx="4" ry="9" fill="#8a6a3b"/>`;
 const tuft=(x,y)=>`<g stroke="#4aa866" stroke-width="3" fill="none" stroke-linecap="round"><path d="M${x},${y} q-6,-22 -16,-30"/><path d="M${x},${y} v-34"/><path d="M${x},${y} q6,-22 16,-30"/></g>`;
 const shrub=(x,y)=>`<rect x="${x-3}" y="${y-18}" width="6" height="18" fill="#8a6a3b"/><circle cx="${x-14}" cy="${y-24}" r="16" fill="#3C9D5B"/><circle cx="${x+14}" cy="${y-24}" r="16" fill="#2F8F4E"/><circle cx="${x}" cy="${y-38}" r="17" fill="#43a965"/><circle cx="${x+8}" cy="${y-42}" r="4" fill="#E87AA6"/>`;
 const tree=(x,y)=>`<rect x="${x-5}" y="${y-62}" width="10" height="62" fill="#8a6a3b"/><circle cx="${x}" cy="${y-84}" r="38" fill="#2F8F4E"/><circle cx="${x-24}" cy="${y-68}" r="24" fill="#3C9D5B"/><circle cx="${x+26}" cy="${y-70}" r="24" fill="#43a965"/>`;
 return `<svg viewBox="0 0 1000 340" preserveAspectRatio="none"><defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4f0"/><stop offset="1" stop-color="#3f93cf"/></linearGradient><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a98557"/><stop offset="1" stop-color="#6f5233"/></linearGradient></defs>
 ${ZN.map(([c],i)=>`<rect id="zr_${c}" x="${i*250}" y="0" width="250" height="340" fill="#03467E" opacity="0"/>`).join('')}
 <path d="M0,196 L270,196 L270,238 L0,238 Z" fill="url(#gw)" opacity=".9"/><path d="${ground}" fill="url(#gs)"/><path d="M0,196 L270,196" stroke="#fff" stroke-width="3" opacity=".7" stroke-dasharray="14 10"/>
 ${deco(6,reed)}${deco(13,reed)}${deco(19,reed)}${deco(31,tuft)}${deco(38,tuft)}${deco(45,tuft)}${deco(56,shrub)}${deco(66,shrub)}${deco(82,tree)}${deco(94,tree)}</svg>`;}
function matches(p){if(ps.sys!=='all'&&!p.sys.includes(ps.sys))return false;if(ps.group!=='all'&&p.group!==ps.group)return false;if(ps.flowers&&!p.flower)return false;if(ps.color&&(p.flower||'').toLowerCase()!==ps.color)return false;
 if(ps.q){const q=ps.q.toLowerCase();if(!(p.sci+' '+p.com+' '+p.ben+' '+p.clue).toLowerCase().includes(q))return false;}return true;}
function pcard(p,i){const inv=p.status==='Invasive';const src=p.src.map(k=>(V.plantSources[k]||{short:k}).short).join('; ');
 return `<div class="pcard ${inv?'inv':''}" data-id="${p.id}" style="animation-delay:${Math.min(i,24)*25}ms"><div class="ph">${iconSvg('form',p.form)}<span class="tg"><span class="chip ${inv?'r':'g'}">${inv?'INVASIVE':'NATIVE'}</span></span></div><div class="bd"><div class="sci">${esc(p.sci)}</div><div>${esc(p.com)}</div>
 <div class="icrow">${p.form?`<div class="ico">${iconSvg('form',p.form)}${esc(V.iconNames[p.form]||'')}</div>`:''}${p.leaf?`<div class="ico">${iconSvg('leaf',p.leaf)}${esc(V.iconNames[p.leaf]||'')}</div>`:''}${p.stem?`<div class="ico">${iconSvg('stem',p.stem)}${esc(V.iconNames[p.stem]||'')}</div>`:''}${p.flower?`<div class="ico">${flowerSvg(p.flower)}${esc(p.flower)}</div>`:''}</div>
 ${inv?'<div class="warnbox" style="background:#fbe3dd;color:#7a1f10">Remove and report to the supervisor.</div>':`<div class="zb">${ZN.map(([c,n])=>`<span class="${p.zones.includes(c)?'on':''}">${n}</span>`).join('')}</div>`}
 <div>${p.sys.map(sysChip).join('')}</div><div class="src" style="margin-top:4px">${esc(src)}</div></div></div>`;}
function viewPlants(){
 app.innerHTML=`<h1>Plant picker</h1><p>Where do you want to plant? Drag the seedling along the bank, or tap a zone. Then filter by system, type, or flowers.</p>
 <div class="bankbox" id="bank">${bankSvg()}${ZN.map(([c,n],i)=>`<div class="zlab" data-z="${c}" style="left:${i*25+12.5}%">${n}</div>`).join('')}
  <div class="pin" id="pin" tabindex="0" role="slider" aria-label="Planting zone" style="left:50%;top:50%"><svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="25" fill="#fff" stroke="#03467E" stroke-width="3"/><path d="M27 42 V26" stroke="#3C9D5B" stroke-width="3.5" stroke-linecap="round"/><path d="M27 28 C17 28 13 20 13 15 C21 15 27 19 27 28Z" fill="#43a965"/><path d="M27 26 C35 26 41 20 41 13 C33 13 27 17 27 26Z" fill="#2F8F4E"/></svg></div><div class="hint" id="hint">Drag me or tap a zone</div></div>
 <div class="row" style="margin-top:10px"><b id="zinfo" class="hd" style="font-size:21px"></b><span class="sp"></span><button class="pill" id="allz">All zones</button></div>
 <div class="pills" id="fsys"></div><div class="pills" id="fgrp"></div>
 <div class="row"><label class="pill" id="fflw"><input type="checkbox" style="display:none"> With flowers</label><span id="fcol" class="row"></span><label class="pill" id="finv"><input type="checkbox" style="display:none"> Show invasive plants</label><span class="sp"></span><input class="search" id="q" placeholder="Search name, benefit, clue…" value="${esc(ps.q)}"><select class="search" id="by" style="max-width:150px"><option value="zone">Group by zone</option><option value="type">Group by type</option><option value="none">No grouping</option></select></div>
 <div id="pcount" class="src" style="margin:8px 0"></div><div id="presults"></div>`;
 const bank=$('#bank'),pin=$('#pin');
 function place(x,anim){ps.x=x;pin.style.left=x+'%';pin.style.top=(gY(x)/340*100)+'%';pin.classList.toggle('drag',!anim);}
 function setZone(z,snap){ps.zone=z;$$('.zlab').forEach(l=>l.classList.toggle('on',l.dataset.z===z));ZN.forEach(([c])=>{$('#zr_'+c).setAttribute('opacity',c===z?'.16':'0');});
  const zi=ZN.find(a=>a[0]===z);$('#zinfo').textContent=zi?`${zi[1]} zone · ${zi[2]}`:'All zones';$('#hint').style.display=z==='all'?'block':'none';if(snap&&zi)place(ZX[z],true);results();}
 function xFrom(e){const r=bank.getBoundingClientRect();return Math.max(2,Math.min(98,(e.clientX-r.left)/r.width*100));}
 let drag=false;pin.addEventListener('pointerdown',e=>{drag=true;pin.setPointerCapture(e.pointerId);pin.classList.add('drag');e.preventDefault();});
 pin.addEventListener('pointermove',e=>{if(!drag)return;const x=xFrom(e);place(x,false);const z=zoneOf(x);if(z!==ps.zone)setZone(z,false);});
 pin.addEventListener('pointerup',e=>{if(!drag)return;drag=false;pin.classList.remove('drag');setZone(zoneOf(ps.x),true);});
 pin.addEventListener('keydown',e=>{const i=ZN.findIndex(a=>a[0]===ps.zone);if(e.key==='ArrowRight')setZone(ZN[Math.min(3,(i<0?0:i+1))][0],true);if(e.key==='ArrowLeft')setZone(ZN[Math.max(0,(i<0?0:i-1))][0],true);});
 bank.addEventListener('click',e=>{if(e.target.closest('.pin'))return;const z=e.target.closest('.zlab');setZone(z?z.dataset.z:zoneOf(xFrom(e)),true);});
 $('#allz').onclick=()=>{ps.zone='all';setZone('all',false);place(50,true);};
 const fs=$('#fsys'),fg=$('#fgrp');
 function pills(){fs.innerHTML=['all',...MAIN].map(s=>`<button class="pill ${ps.sys===s?'on':''}" data-s="${s}">${s==='all'?'All systems':SYS[s].n}</button>`).join('');fg.innerHTML=['all',...GROUPS].map(g=>`<button class="pill ${ps.group===g?'on':''}" data-g="${esc(g)}">${g==='all'?'All types':g}</button>`).join('');
  $$('[data-s]',fs).forEach(b=>b.onclick=()=>{ps.sys=b.dataset.s;pills();results();});$$('[data-g]',fg).forEach(b=>b.onclick=()=>{ps.group=b.dataset.g;pills();results();});
  $('#fflw').classList.toggle('on',ps.flowers);$('#finv').classList.toggle('on',ps.inv);
  const cols=[...new Set(V.plants.filter(p=>p.flower).map(p=>p.flower.toLowerCase()))];$('#fcol').innerHTML=ps.flowers?cols.map(c=>`<button class="pill ${ps.color===c?'on':''}" data-c="${c}" style="padding:4px 10px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${V.flowerHex[c]||'#ccc'};border:1px solid #0003;margin-right:5px;vertical-align:-1px"></span>${c}</button>`).join(''):'';
  $$('[data-c]').forEach(b=>b.onclick=()=>{ps.color=ps.color===b.dataset.c?'':b.dataset.c;pills();results();});}
 $('#fflw').onclick=e=>{e.preventDefault();ps.flowers=!ps.flowers;if(!ps.flowers)ps.color='';pills();results();};$('#finv').onclick=e=>{e.preventDefault();ps.inv=!ps.inv;pills();results();};
 $('#q').oninput=e=>{ps.q=e.target.value;results();};$('#by').value=ps.by;$('#by').onchange=e=>{ps.by=e.target.value;results();};
 function results(){let nat=V.plants.filter(p=>p.status==='Native'&&matches(p)&&(ps.zone==='all'||p.zones.includes(ps.zone)));const inv=ps.inv?V.plants.filter(p=>p.status==='Invasive'&&matches(p)):[];
  let h='',i=0;const sec=(t,arr,note)=>arr.length?`<h2>${esc(t)} <small class="src">${arr.length}</small></h2>${note||''}<div class="grid g4">${arr.map(p=>pcard(p,i++)).join('')}</div>`:'';
  if(ps.by==='zone'&&ps.zone==='all')h=ZN.map(([c,n,d])=>sec(n+' zone',nat.filter(p=>p.zones.includes(c)),`<p class="src">${d}</p>`)).join('');else if(ps.by==='type')h=GROUPS.map(g=>sec(g,nat.filter(p=>p.group===g))).join('');else h=sec(ps.zone==='all'?'Native plants':(ZN.find(a=>a[0]===ps.zone)||[])[1]+' zone',nat);
  if(inv.length)h+=sec('Invasive plants to remove',inv,'<div class="warnbox">These plants are not for planting. Document them and notify the supervisor.</div>');
  $('#presults').innerHTML=h||'<div class="card">No plants match these filters. Try another zone or clear a filter.</div>';$('#pcount').textContent=`${nat.length} native plant${nat.length===1?'':'s'}${inv.length?` and ${inv.length} invasive`:''} match`;if(ps.by==='zone'&&ps.zone==='all')$('#pcount').textContent+=' (a plant that grows in several zones appears in each one)';
  $$('.pcard').forEach(c=>c.onclick=()=>plantModal(c.dataset.id));}
 pills();setZone('all',false);place(50,true);}
function plantModal(id){const p=V.plants.find(x=>x.id===id);if(!p)return;const src=p.src.map(k=>{const s=V.plantSources[k]||{short:k,apa:''};return `<li>${esc(s.apa||s.short)}</li>`;}).join('');
 openModal(`<span class="chip ${p.status==='Invasive'?'r':'g'}">${p.status.toUpperCase()}</span><span class="chip">${esc(p.group)}</span><h2 style="margin-top:6px"><i>${esc(p.sci)}</i></h2><p style="font-size:18px;margin:0 0 8px">${esc(p.com)}</p>
 <div class="icrow" style="gap:16px">${['form','leaf','stem'].filter(g=>p[g]).map(g=>`<div class="ico" style="width:70px">${iconSvg(g,p[g])}${g.toUpperCase()}<br>${esc(V.iconNames[p[g]]||'')}</div>`).join('')}${p.flower?`<div class="ico" style="width:70px">${flowerSvg(p.flower)}FLOWER<br>${esc(p.flower)}</div>`:''}</div>
 <p><b>How to recognize it:</b> ${esc(p.clue)}</p>${p.status==='Native'?`<div class="zb">${ZN.map(([c,n])=>`<span class="${p.zones.includes(c)?'on':''}">${n}</span>`).join('')}</div>`:''}<p><b>Benefits:</b> ${esc(p.ben)}</p><p>${p.sys.map(sysChip).join('')}${p.useful.map(u=>`<span class="chip g">${esc(u)}</span>`).join('')}</p>
 ${p.look?`<div class="warnbox"><b>Do not confuse:</b> ${esc(p.look)}</div>`:''}${p.note?`<div class="warnbox">${esc(p.note)}</div>`:''}<p class="src"><b>Source${p.src.length>1?'s':''}</b></p><ul class="src">${src}</ul><p class="src">Photo: to be added (open-license sources).</p>`);}
/* ---------- fuentes ---------- */
function viewSources(){app.innerHTML=`<h1>Sources</h1><p>Every source behind the manual, with its verification status.</p><div class="row"><input class="search" id="sq" placeholder="Search sources…"><span class="sp"></span><div class="pills" id="sf" style="margin:0">${['All','Verified','To verify','From v1.0 list'].map((s,i)=>`<button class="pill ${i?'':'on'}" data-f="${s}">${s}</button>`).join('')}</div></div><div id="slist"></div>`;let f='All',q='';
 const draw=()=>{const l=V.sources.filter(s=>(f==='All'||s.status.indexOf(f)===0)&&(s.apa+s.short).toLowerCase().includes(q));$('#slist').innerHTML=`<p class="src">${l.length} sources</p>`+l.map(s=>`<div class="card" style="margin:8px 0"><span class="chip ${s.status.indexOf('Verified')===0?'g':s.status==='To verify'?'y':''}">${esc(s.status)}</span><b>${esc(s.short||s.key)}</b><div class="src">${esc(s.apa)}</div></div>`).join('');};
 $$('#sf .pill').forEach(b=>b.onclick=()=>{f=b.dataset.f;$$('#sf .pill').forEach(x=>x.classList.toggle('on',x===b));draw();});$('#sq').oninput=e=>{q=e.target.value.toLowerCase();draw();};draw();}
route();
})();
