
import { state, onChange, addLogs, editLog, deleteLog, restoreLog, setLogFlags, saveRecord, saveMeta, newId, setTreePhotos } from './store.js';
import { addPhotos, flushPending, pendingCount } from './photos.js';
import { fileUrl, getToken, driveConnected, listBackups } from './drive.js';
import { backupNow, maybeWeeklyBackup } from './backup.js';
import { runImport } from './importer.js';
import { signOut, auth } from './firebase.js';
import { TIPS, NOTES, COLLECTION } from './knowledge.js';

const D = { pots: [], done: [] };
const TODAY = new Date();
let TREES = [], LOGS = [], DELETED = [], PH = {}, byId = {}, MIXES = [];
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico = (n, cls='') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_L = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const NOW_M = TODAY.getMonth() + 1;
function localDay(d=new Date()){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

const ACT = {
  prune:{label:'Light prune', icon:'scissors'}, hard:{label:'Hard prune', icon:'scissors'},
  root:{label:'Root prune', icon:'roots'}, repot:{label:'Repot', icon:'pot'},
  wire:{label:'Wired', icon:'wire'}, unwire:{label:'Wire removed', icon:'wire'},
  style:{label:'Styled', icon:'brush'}, defol:{label:'Defoliated', icon:'leaf'},
  fert:{label:'Fertilised', icon:'drop'}, fung:{label:'Fungicide', icon:'shield'},
  insect:{label:'Insecticide', icon:'bug'}, buy:{label:'Acquired', icon:'tag'},
  note:{label:'Observation', icon:'eye'}, died:{label:'Died', icon:'x'}, gone:{label:'Left collection', icon:'archive'}
};
Object.keys(ACT).forEach(k=>ACT[k].kind=k);
ACT.fung.label='Mancozeb spray'; ACT.insect.label='Maverick spray';
/* Jobs shown on the Log screen: editable (rename, hide, add your own, shortcuts). Saved with your records. */
const KINDS = [['prune','Prune'],['hard','Hard prune'],['root','Root prune'],['repot','Repot'],['wire','Wire'],['unwire','Wire removed'],['defol','Defoliate'],['style','Styling'],['fert','Feed'],['fung','Fungicide'],['insect','Insecticide'],['note','Other / observation']];
const KIND_ICON = {prune:'scissors',hard:'scissors',root:'roots',repot:'pot',wire:'wire',unwire:'wire',defol:'leaf',style:'brush',fert:'drop',fung:'shield',insect:'bug',note:'eye'};
let JOBS = ['prune','hard','root','repot','wire','unwire','defol','style','fert','fung','insect','note'].map(id=>({id, label:ACT[id].label, kind:id, hidden:false}));
let COMBOS = [{id:'cb1', label:'Repot + root prune', jobs:['repot','root']}, {id:'cb2', label:'Prune & wire', jobs:['prune','wire']}, {id:'cb3', label:'Full workover', jobs:['hard','root','repot']}];
function applyJobs(){ JOBS.forEach(j=>{ ACT[j.id] = {label:j.label, icon:KIND_ICON[j.kind]||'eye', kind:j.kind}; }); }
let jobsTimer; function saveJobs(){ applyJobs(); clearTimeout(jobsTimer); jobsTimer=setTimeout(()=>saveMeta('settings',{jobs:JOBS, combos:COMBOS}),600); }
applyJobs();
const kindOf = a => (ACT[a] && ACT[a].kind) || a;

/* --- Season guidance: draft for Brisbane (subtropical, SE Qld). Months 1-12. --- */
const SEASONS = [['Summer',[12,1,2]],['Autumn',[3,4,5]],['Winter',[6,7,8]],['Spring',[9,10,11]]];
const TASKS = {repot:{label:'Repot', c:'var(--wire)'}, struct:{label:'Hard / structural prune', c:'#7A5A2E'}, prune:{label:'Trim new growth', c:'var(--moss)'},
  wire:{label:'Wire', c:'var(--glaze)'}, defol:{label:'Defoliate / decandle', c:'#8C9A3A'}, clean:{label:'Clean / needle work', c:'#9C7FB0'}, potash:{label:'Liquid potash', c:'#C2577A'}, fert:{label:'Feed', c:'#6E8FA0'}};
const GUIDE = {  /* timing from Nathan's monthly calendar + Red Dragon newsletters (Brisbane) */
  pine:{name:'Black pines', every:3, rows:{repot:[7,8,9], struct:[7], wire:[6,7], defol:[9], clean:[3,4,5,6], prune:[12,1,2,10,11], fert:[3,4,5,9,10,11,12,1,2]}},
  elm:{name:'Chinese elms', every:2, rows:{repot:[6,7,8,9,10], struct:[6,7], prune:[9,10,11,12,1,2,3], wire:[6,7], defol:[12], fert:[3,4,5,9,10,11]}},
  juniper:{name:'Junipers', every:3, rows:{repot:[7,8,9,10], struct:[6,7,8], prune:[9,10,11,12,1,2,3], wire:[6,7], clean:[3,9], fert:[3,4,5,9,10,11,12,1,2]}},
  fig:{name:'Figs', every:2, rows:{repot:[10,11], prune:[9,10,11,12,1,2,3], defol:[12], wire:[11,12,1,2], fert:[3,4,5,9,10,11]}},
  cler:{name:'Clerodendrums', every:2, rows:{repot:[9,10], prune:[10,11,12,1,2,3], wire:[10,11,12,1,2], fert:[3,4,5,9,10,11]}},
  swamp:{name:'Swamp cypress', every:2, rows:{repot:[8,9], struct:[7,8], prune:[10,11,12,1,2,3], wire:[6,7], fert:[9,10,11,12,1,2,3]}},
  podo:{name:'Buddhist pine', every:3, rows:{repot:[9,10], prune:[9,10,11,12,1,2,3,4], wire:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  mela:{name:'Melaleuca', every:2, rows:{repot:[9,10], prune:[10,11,12,1,2,3], fert:[3,4,5,9,10,11]}},
  bougie:{name:'Bougainvillea', every:2, rows:{repot:[10,11,12], prune:[1,2,3], wire:[11,12,1,2], potash:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  azalea:{name:'Azalea', every:2, rows:{repot:[9,10], prune:[11,12,1,2], wire:[12,1,2], potash:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  african:{name:'Jaboticaba', every:2, rows:{repot:[9,10,11], prune:[11,12,1,2,3], wire:[11,12,1,2], potash:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  other:{name:'Other', every:2, rows:{}}
};
/* already set up in Nathan's TickTick "Bonsai" list (recurring, Saturdays 8am) */
const ROUTINES = [
  {name:'Fertilise Bonsai', every:'Every 2nd Saturday', icon:'drop', first:'2026-10-03', weeks:2},
  {name:'Spray Maverick (insecticide)', every:'Every 4 weeks', icon:'bug', first:'2026-10-10', weeks:4},
  {name:'Spray Mancozeb (fungicide)', every:'Every 4 weeks', icon:'shield', first:'2026-10-24', weeks:4}
];
function routineDates(r, y, m){ const out=[]; let d=parseD(r.first); while(d.getFullYear()<y || (d.getFullYear()===y && d.getMonth()<m-1)) d.setDate(d.getDate()+7*r.weeks); while(d.getFullYear()===y && d.getMonth()===m-1){ out.push(new Date(d)); d.setDate(d.getDate()+7*r.weeks);} return out; }
function nextSat(){const d=new Date(TODAY);d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));return 'Next: Sat '+d.getDate()+' '+MONTHS[d.getMonth()];}

/* --- helpers --- */
const evMin = t => t.every ? t.every[0] : (GUIDE[t.group]||GUIDE.other).every;
const evText = t => t.every ? t.every[0]+'–'+t.every[1] : String((GUIDE[t.group]||GUIDE.other).every);
const photo = id => PH[id] ? PH[id].src : null;
function cover(t){ const ps=(t.photos||[]).filter(id=>PH[id]); const best=t.cover&&PH[t.cover]?t.cover:(ps.find(id=>PH[id].thumb)||ps[0]); return best ? photo(best) : null; }
function coverId(t){ const ps=(t.photos||[]).filter(id=>PH[id]); return t.cover&&PH[t.cover]?t.cover:(ps.find(id=>PH[id].thumb)||ps[0]); }
function thumb(t, cls='thumb'){ const c = cover(t); return c ? `<img class="${cls}" src="${c}" alt="" loading="lazy">` : `<div class="${cls} ph">${ico('tree')}</div>`; }
function parseD(s){ if(!s) return null; const p=s.split('-').map(Number); return new Date(p[0], (p[1]||1)-1, p[2]||15); }
function fmtD(s, prec){ if(!s) return 'Date unknown'; const d=parseD(s); return (prec==='month'||s.length===7) ? MONTHS_L[d.getMonth()]+' '+d.getFullYear() : d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear(); }
function ago(s){ const d=parseD(s); if(!d) return ''; const m=(TODAY.getFullYear()-d.getFullYear())*12+TODAY.getMonth()-d.getMonth(); if(m<1) return 'this month'; if(m<12) return m+' mo ago'; const y=Math.floor(m/12), r=m%12; return y+' yr'+(r>=6?' ½':'')+' ago'; }
function years(s){ const d=parseD(s); if(!d) return null; return Math.floor((TODAY-d)/31557600000); }
function logsFor(id){ return LOGS.filter(l => l.trees.includes(id)); }
function lastOf(id, keys){ return logsFor(id).find(l => S.ticks[l.id]!=='tick' && l.actions.some(a => keys.includes(kindOf(a)))); }
function repotStatus(t){
  const g = GUIDE[t.group] || GUIDE.other, last = lastOf(t.id, ['repot']);
  if(!last) return {cls:'due', text:'No repot on record', due:true, last:null};
  const d = parseD(last.date); let next = new Date(d); next.setFullYear(d.getFullYear()+evMin(t));
  const rm = repotMonth(t); if(rm) next = new Date(rm[0], rm[1]-1, 1);
  const months = (next.getFullYear()-TODAY.getFullYear())*12 + next.getMonth()-TODAY.getMonth();
  const inWindow = (g.rows.repot||[]).includes(NOW_M);
  let cls='ok', text='Next repot '+MONTHS[next.getMonth()]+' '+next.getFullYear();
  if(months<=0){ cls = inWindow ? 'due' : 'late'; text = inWindow ? 'Repot due now' : 'Repot due (next window)'; }
  return {cls, text, due: months<=0 && inWindow, last, next};
}
function sourcePills(l){
  const map = {'Bonsai Album':'Album','Care App':'Care App','2003–2010 spreadsheet':'2003–10 sheet','Graytrees':'Graytrees'};
  return l.sources.map(s => `<span class="pill src">${esc(map[s]||s)}</span>`).join('') + ((l.flags||[]).includes('confirmed') ? `<span class="pill ok">Confirmed repot</span>` : '') + (l.flags && (l.flags.includes('bulk')||l.flags.includes('tick')) ? (S.ticks[l.id]==='real' ? `<span class="pill ok">Confirmed repot</span>` : S.ticks[l.id]==='tick' ? `<span class="pill unc">Reminder tick – not counted</span>` : `<span class="pill unc" title="Same-day tick on many trees in the Care App">Unconfirmed tick</span>`) : '');
}
function actChips(l){ return l.actions.map(a => `<span class="act ${kindOf(a)}">${ico(ACT[a]?.icon||'eye')}${esc(ACT[a]?.label||a)}</span>`).join(''); }

/* --- state --- */
const S = { view:'trees', tree:null, tab:'info', q:'', group:'all', sort:'name', histAct:'all', review:{}, notes:{}, ticks:{}, toast:null, newLog:null, layout:'cards' };
try{ S.layout = localStorage.getItem('gt-layout') || 'cards'; }catch(e){}
function go(view, opts={}){ Object.assign(S, {view}, opts); sync(); render(); window.scrollTo({top:0}); }

/* --- search header --- */
function header(placeholder='Search trees, species, history…'){
  return `<div class="topbar"><div class="brand"><div class="seal" aria-hidden="true">GT</div><b>Graytrees</b></div>
  <label class="search">${ico('search')}<input id="q" type="search" placeholder="${placeholder}" value="${esc(S.q)}" aria-label="Search"></label></div>`;
}
function proto(){
  if(!state.ready.trees) return `<div class="proto">${ico('history')}<div>Loading your records…</div></div>`;
  if(!TREES.length) return `<div class="card" style="padding:18px;margin-bottom:14px"><h2 style="font-size:22px">Welcome to Graytrees</h2><p class="muted">Your collection is empty. Load your merged records (from Bonsai Album, the Care App and the 2003–2010 sheet) to get started.</p><button class="btn" data-nav="import">${ico('archive')}Import my records</button></div>`;
  const off = !navigator.onLine;
  if(off || state.pending) return `<div class="proto">${ico('history')}<div><b>${off?'No signal.':'Syncing…'}</b> ${off?'Everything you log is saved on this device and will sync when you\'re back in range.':'Your latest changes are being saved to the cloud.'}</div></div>`;
  return '';
}

/* --- views --- */
const GROUPS = [['all','All'],['pine','Pines'],['juniper','Junipers'],['elm','Elms'],['fig','Figs'],['cler','Clerodendrums'],['other','Others']];
function inGroup(t){ if(S.group==='all') return true; if(S.group==='other') return !['pine','juniper','elm','fig','cler'].includes(t.group); return t.group===S.group; }
function matches(t, q){ q=q.toLowerCase(); return [t.name,t.common,t.scientific,t.style,t.source,(t.aka||[]).map(a=>a.name).join(' ')].join(' ').toLowerCase().includes(q); }

function viewTrees(past=false){
  const list = TREES.filter(t => (past ? t.status==='past' : t.status!=='past') && inGroup(t) && (!S.q || matches(t,S.q)));
  const lastWork = t => (logsFor(t.id)[0]||{}).date || '';
  list.sort(S.sort==='recent' ? (a,b)=> lastWork(b).localeCompare(lastWork(a)) : (a,b)=> a.name.localeCompare(b.name));
  const all = past ? [] : TREES.filter(t=>t.status!=='past').map(t=>({t, r:repotStatus(t)}));
  const due = all.filter(x=>x.r.due);
  const upcoming = all.filter(x=>x.r.next && !x.r.due).sort((a,b)=>a.r.next-b.r.next).slice(0,4);
  const g = Object.values(GUIDE);
  const workNow = past ? [] : Object.entries(GUIDE).filter(([k,v])=>k!=='other').map(([k,v])=>[v.name, Object.entries(v.rows).filter(([task,ms])=>ms.includes(NOW_M)).map(([task])=>TASKS[task].label)]).filter(x=>x[1].length);
  const histHits = S.q && !past ? LOGS.filter(l => l.text.toLowerCase().includes(S.q.toLowerCase())).slice(0,8) : [];
  return header() + (past?'':proto()) + (past ? `<div class="section-h"><div><span class="eyebrow">Kept for the record</span><h2>Past trees</h2></div><span class="muted num">${list.length}</span></div><p class="muted" style="margin-top:-6px">Trees that died, were given away or left bonsai. Their full history stays searchable.</p>` : `
  <section class="season" aria-label="This month">
    <div><span class="eyebrow">${MONTHS_L[NOW_M-1]} in Brisbane · ${SEASONS.find(s=>s[1].includes(NOW_M))[0].toLowerCase()}</span>
      <h2 style="margin-top:4px">${due.length ? due.length+' tree'+(due.length>1?'s':'')+' ready to repot' : 'No trees need repotting yet'}</h2>
      ${due.length?'':`<p class="muted" style="margin:8px 0 0;font-size:15px">Each species has a repot interval (pines every 3 years, elms and figs every 2). None of your trees have reached theirs yet.</p>`}
      <p class="muted" style="margin:8px 0 0;font-size:15px">Good work this month: ${workNow.slice(0,4).map(w=>`<b style="color:var(--ink)">${esc(w[0])}</b> ${esc(w[1].join(', ').toLowerCase())}`).join(' · ')}.</p>
      <button class="btn ghost small" style="margin-top:12px" data-nav="season">${ico('season')}Open season calendar</button></div>
    <div class="due-list">${due.length ? due.slice(0,5).map(({t,r})=>`<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:14px">Last repot ${r.last?fmtD(r.last.date):'—'} · every ${evText(t)} yrs</span></span><span class="pill due">Due</span></button>`).join('') : `<span class="eyebrow">Next repots coming up</span>${upcoming.map(({t,r})=>`<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:14px">Last repot ${fmtD(r.last.date)} · every ${evText(t)} yrs</span></span><span class="pill ok num">${MONTHS[r.next.getMonth()]} ${r.next.getFullYear()}</span></button>`).join('')}`}</div>
  </section>`) + `
  <div class="section-h"><h2>${past?'':'Collection'}</h2><div class="row">${past?'':`<button class="btn small" data-edittree="">${ico('plus')}Add tree</button>`}
    <div class="seg" role="group" aria-label="Layout">${[['cards','Cards'],['gallery','Gallery'],['list','List']].map(([k,l])=>`<button data-layout="${k}" aria-pressed="${S.layout===k}">${l}</button>`).join('')}</div>
    <label class="muted" for="sort" style="font-size:14px">Sort</label>
    <select id="sort" class="chip"><option value="name"${S.sort==='name'?' selected':''}>A–Z</option><option value="recent"${S.sort==='recent'?' selected':''}>Recently worked</option></select></div></div>
  <div class="chips" role="group" aria-label="Filter by species">${GROUPS.map(([k,l])=>`<button class="chip" data-group="${k}" aria-pressed="${S.group===k}">${l}</button>`).join('')}</div>
  <p class="muted num" style="font-size:14px;margin:10px 0">${list.length} ${past?'past':''} tree${list.length===1?'':'s'}${S.q?` matching “${esc(S.q)}”`:''}</p>
  ${!list.length ? '<div class="empty">No trees match.</div>' : S.layout==='gallery' ? `<div class="gallery">${list.map(t=>galleryTile(t)).join('')}</div>` : S.layout==='list' ? `<div class="card tlist">${list.map(t=>listRow(t)).join('')}</div>` : `<div class="grid">${list.map(t=>treeCard(t)).join('')}</div>`}
  ${histHits.length?`<div class="section-h"><h2>In history</h2></div>${histHits.map(l=>entry(l,true)).join('')}`:''}`;
}
function treeCard(t){
  const lr = lastOf(t.id,['repot']), lp = lastOf(t.id,['prune','hard']), r = t.status==='past'?null:repotStatus(t);
  const age = years(t.plantDate && t.plantDate.length===4 ? t.plantDate+'-06-01' : t.plantDate);
  return `<button class="tcard" data-tree="${t.id}">${thumb(t)}<span class="body">
    <h3>${esc(t.name)}</h3>
    <span style="font-size:15px">${esc(t.common||'')}${t.scientific?` · <span class="sci">${esc(t.scientific)}</span>`:''}</span>
    <span class="muted" style="font-size:14px">${[t.style, age!=null?age+' yrs old':null, t.status==='past'&&t.fate?t.fate:null].filter(Boolean).map(esc).join(' · ')}</span>
    <span class="muted" style="font-size:14px">${lr?'Repotted '+fmtD(lr.date, lr.precision):''}${lr&&lp?'<br>':''}${lp?'Pruned '+fmtD(lp.date, lp.precision):''}</span>
    <span class="last">${r?`<span class="pill ${r.cls}">${esc(r.text)}</span>`:`<span class="pill src">${esc(t.fate||'Past tree')}</span>`}</span>
  </span></button>`;
}

function galleryTile(t){
  const r = t.status==='past'?null:repotStatus(t), c = cover(t);
  return `<button class="gtile" data-tree="${t.id}">${c?`<img src="${c}" alt="" loading="lazy">`:`<span class="ph" style="height:100%">${ico('tree')}</span>`}
    <span class="cap"><b>${esc(t.name)}</b><span>${esc(t.common||'')}</span>${r?`<span class="pill ${r.cls}">${esc(r.text)}</span>`:''}</span></button>`;
}
function listRow(t){
  const lr = lastOf(t.id,['repot']), lp = lastOf(t.id,['prune','hard']), r = t.status==='past'?null:repotStatus(t);
  return `<button class="lrow" data-tree="${t.id}">${thumb(t,'lthumb')}
    <span class="lname"><b>${esc(t.name)}</b><span class="muted">${esc(t.common||'')}${t.scientific?` · <i>${esc(t.scientific)}</i>`:''}</span></span>
    <span class="lcol"><span class="muted">Repotted</span><span class="num">${lr?fmtD(lr.date,lr.precision):'—'}</span></span>
    <span class="lcol"><span class="muted">Pruned</span><span class="num">${lp?fmtD(lp.date,lp.precision):'—'}</span></span>
    <span class="lcol">${r?`<span class="pill ${r.cls}">${esc(r.text)}</span>`:''}</span></button>`;
}
function viewTree(){
  const t = byId[S.tree]; if(!t) return go('trees');
  const L = logsFor(t.id), r = t.status==='past'?null:repotStatus(t);
  const lr = lastOf(t.id,['repot']), lp = lastOf(t.id,['prune','hard']), lw = lastOf(t.id,['wire']);
  const age = years(t.plantDate && t.plantDate.length===4 ? t.plantDate+'-06-01' : t.plantDate);
  const c = cover(t);
  const tabs = [['info','Info'],['history','History'],['photos','Photos'],['calendar','Calendar'],['reminders','Reminders']];
  return `<div class="topbar"><button class="back" data-back>${ico('back')}${t.status==='past'?'Past trees':'Collection'}</button><span style="flex:1"></span>
    <button class="btn ghost small" data-edittree="${t.id}" aria-label="Edit tree">${ico('brush')}</button><button class="btn small" data-log="${t.id}">${ico('plus')}Log work</button></div>
  <div class="hero">
    <div class="hero-img">${c?`<img src="${c}" alt="${esc(t.name)}" data-zoom="${coverId(t)}">`:`<div class="ph" style="height:100%">${ico('tree')}</div>`}${t.photos.length?`<span class="count">${t.photos.length} photo${t.photos.length>1?'s':''}</span>`:''}</div>
    <div class="title-block">
      <span class="eyebrow">${esc(t.common||'Bonsai')}${t.status==='past'?' · past tree':''}</span>
      <h1 style="margin-top:4px">${esc(t.name)}</h1>
      ${t.scientific?`<p class="sci" style="margin:6px 0 0;font-size:19px">${esc(t.scientific)}</p>`:''}
      <div class="row" style="margin-top:12px">${t.style?`<span class="chip">${esc(t.style)}</span>`:''}${age!=null?`<span class="chip num">${age} years old</span>`:''}${t.acquired?`<span class="chip num">Yours since ${parseD(t.acquired).getFullYear()}</span>`:''}${t.stage?`<span class="chip">${esc(t.stage)}</span>`:''}</div>
      <div class="facts">
        <div class="fact"><span class="k">${ico('pot')}Last repot</span><div class="v num">${lr?fmtD(lr.date,lr.precision).replace(/^\d+ /,''):'—'}</div><div class="s muted">${lr?ago(lr.date):''}</div></div>
        <div class="fact"><span class="k">${ico('scissors')}Last prune</span><div class="v num">${lp?fmtD(lp.date,lp.precision).replace(/^\d+ /,''):'—'}</div><div class="s muted">${lp?ago(lp.date):''}</div></div>
        <div class="fact"><span class="k">${ico('wire')}Last wired</span><div class="v num">${lw?fmtD(lw.date,lw.precision).replace(/^\d+ /,''):'—'}</div><div class="s muted">${lw?ago(lw.date):''}</div></div>
        <div class="fact"><span class="k">${ico('history')}On record</span><div class="v num">${L.length} entries</div><div class="s muted">since ${L.length?parseD(L[L.length-1].date).getFullYear():'—'}</div></div>
      </div>
      ${r?`<p style="margin:14px 0 0"><span class="pill ${r.cls}">${esc(r.text)}</span> <span class="muted" style="font-size:14px">Repot every ${evText(t)} years${t.every?' (older, larger tree)':' for '+esc(GUIDE[t.group].name.toLowerCase())}</span></p>`:''}
    </div>
  </div>
  <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${S.tab===k}">${l}${k==='history'?` <span class="num">(${L.length})</span>`:''}</button>`).join('')}</div>
  <div role="tabpanel">${({info:tabInfo,history:tabHistory,photos:tabPhotos,calendar:tabCal,reminders:tabRem})[S.tab](t,L)}</div>`;
}
function tabInfo(t){
  const money = v => v ? '$'+Number(v).toLocaleString('en-AU',{minimumFractionDigits:0}) : null;
  const rows = [['Common name',t.common],['Scientific name',t.scientific?`<i>${esc(t.scientific)}</i>`:null,true],['Style',t.style],['Development',t.stage],
    ['Plant date / age',t.plantDate?fmtD(t.plantDate.length===4?t.plantDate:t.plantDate)+'':null],['Date acquired',t.acquired?fmtD(t.acquired):null],['Source',t.source],
    ['Purchase price',money(t.price)],['Value',money(t.value)],['Height',t.height?t.height+' cm':null],['Trunk width',t.trunk?t.trunk+' cm':null],
    ['Pot',t.pot],['Soil mix',t.substrate],['Notes',t.notes],
    ['Also known as',(t.aka||[]).map(a=>`${esc(a.name)} <span class="muted">(${esc(a.app)})</span>`).join('<br>')||null,true]];
  return `<dl class="info">${rows.filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${r[2]?r[1]:esc(r[1]).replace(/\n/g,'<br>')}</dd>`).join('')}</dl>
  <p style="margin-top:14px"><button class="btn ghost small" data-edittree="${t.id}">${ico('brush')}Edit details</button></p>`;
}
function entry(l, showTree=false){
  const d = parseD(l.date);
  const isNew = S.newLog===l.id;
  return `<article class="entry${isNew?' new':''}">
    ${isNew?'<span class="stamp" aria-hidden="true">GT<br>済</span>':''}
    <div class="date">${l.date?`<b class="num">${l.precision==='month'?'–':d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span>`:'<span>?</span>'}</div>
    <div style="min-width:0">
      ${showTree?`<div style="margin-bottom:6px">${l.trees.map(id=>`<button class="tree-link" data-tree="${id}">${esc(byId[id]?.name||id)}</button>`).join(', ')} <span class="muted num" style="font-size:14px">· ${d?d.getFullYear():''}</span></div>`:''}
      <div class="acts">${actChips(l)}</div>
      <div class="txt">${esc(l.text)}</div>
      ${l.photos && l.photos.length?`<div class="shots">${l.photos.map(p=>photo(p)?`<img src="${photo(p)}" alt="" loading="lazy" data-zoom="${p}">`:'').join('')}</div>`:''}
      <div class="meta">${sourcePills(l)}<button class="pill src" style="border:0;cursor:pointer" data-editentry="${l.id}" aria-label="Edit entry">${ico('brush')}Edit</button>${l.trees.length>1&&!showTree?`<span class="pill src">Batch of ${l.trees.length} trees</span>`:''}</div>
      ${l.raw?`<details><summary>${l.raw.length} records combined</summary><ul>${l.raw.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}
    </div></article>`;
}
function byYear(L, showTree){
  let html='', y=null;
  const counts = {}; L.forEach(l=>{const yy=(l.date||'????').slice(0,4); counts[yy]=(counts[yy]||0)+1;});
  for(const l of L){ const yy=(l.date||'????').slice(0,4); if(yy!==y){ y=yy; html+=`<h3 class="year num">${yy}<small>${counts[yy]} entr${counts[yy]>1?'ies':'y'}</small></h3>`; } html+=entry(l, showTree); }
  return html;
}
function tabHistory(t,L){ return L.length ? `<p class="muted" style="font-size:15px;margin-top:0">Every entry from Bonsai Album, the Care App and your 2003–2010 spreadsheet. Where two apps recorded the same job, they're shown as one entry and the original wording is kept underneath.</p>`+byYear(L,false) : '<div class="empty">No history yet.</div>'; }
function tabPhotos(t){
  const ps = t.photos.map(id=>({id,...PH[id]})).filter(p=>p.src);
  const dated = LOGS.reduce((m,l)=>{(l.photos||[]).forEach(p=>m[p]=m[p]||l.date);return m;},{});
  return `<div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="muted num">${ps.length} photos</span>
    <label class="btn small">${ico('cam')}Add photo<input type="file" accept="image/*" multiple hidden data-addphoto="${t.id}"></label></div>
    ${ps.length?`<div class="pgrid">${ps.map(p=>`<figure><img src="${p.src}" alt="" loading="lazy" data-zoom="${p.id}"><figcaption class="num">${dated[p.id]?fmtD(dated[p.id]):(p.origin==='Bonsai Album'?'Bonsai Album':'Old plant list')}</figcaption></figure>`).join('')}</div>`:'<div class="empty">No photos yet.</div>'}`;
}
function calRows(rows, mine){
  const keys = Object.keys(rows);
  return keys.map(k=>`<tr><th scope="row">${TASKS[k].label}</th>${MONTHS.map((m,i)=>{const on=rows[k].includes(i+1), prev=rows[k].includes(i===0?12:i), next=rows[k].includes(i===11?1:i+2);
    return `<td class="${i+1===NOW_M?'now':''}">${on?`<span class="bar${!prev||i===0?' s':''}${!next||i===11?' e':''}" style="--k:${TASKS[k].c}"></span>`:''}</td>`;}).join('')}</tr>`).join('')
  + (mine?`<tr class="mine"><th scope="row" style="color:var(--wire)">Your repots</th>${MONTHS.map((m,i)=>{const n=mine[i+1]||0;return `<td class="${i+1===NOW_M?'now':''}">${n?`<span class="dot" style="width:${8+Math.min(n,12)*1.6}px;height:${8+Math.min(n,12)*1.6}px" title="${n} repot${n>1?'s':''}"></span>`:''}</td>`;}).join('')}</tr>`:'');
}
function calTable(rows, mine){
  const leg = `<div class="cal-legend">${Object.keys(rows).map(k=>`<span><i style="background:${TASKS[k].c}"></i>${TASKS[k].label}</span>`).join('')}${mine?`<span><i style="background:var(--wire);width:9px;border-radius:50%"></i>Your repots</span>`:''}</div>`;
  return `<div class="cal">${leg}<table><thead><tr class="seas"><th></th>${MONTHS.map((m,i)=>{const s=SEASONS.find(s=>s[1].includes(i+1));return `<th style="${i+1===NOW_M?'color:var(--wire)':''}">${s[1][0]===i+1||i===0?s[0]:''}</th>`;}).join('')}</tr>
  <tr><th></th>${MONTHS.map((m,i)=>`<th class="${i+1===NOW_M?'now':''}">${m}</th>`).join('')}</tr></thead><tbody>${calRows(rows,mine)}</tbody></table></div>`;
}
function myRepotMonths(ids){ const m={}; LOGS.forEach(l=>{ if(l.actions.some(a=>kindOf(a)==='repot') && l.trees.some(id=>ids.includes(id)) && !(l.flags||[]).includes('bulk') && l.date){ const mm=+l.date.slice(5,7); m[mm]=(m[mm]||0)+1; }}); return m; }
function tabCal(t){
  const g = GUIDE[t.group]||GUIDE.other;
  const mine = myRepotMonths([t.id]);
  return `<p class="muted" style="margin-top:0;font-size:15px">Timing for ${esc(g.name.toLowerCase())} in Brisbane, from your monthly calendar and the Red Dragon newsletters. The orange dots show when you've actually repotted this tree.</p>
  ${Object.keys(g.rows).length?calTable(g.rows, mine):'<div class="empty">No guidance for this species yet.</div>'}
  ${NOTES[t.group]?`<div class="card" style="padding:16px;margin-top:12px"><span class="eyebrow">Care notes</span><ul class="done-list" style="margin-top:8px">${NOTES[t.group].map(n=>`<li>${ico('leaf')}<span>${esc(n)}</span></li>`).join('')}</ul><p class="muted" style="font-size:13px;margin:8px 0 0">From your monthly calendar and the Red Dragon newsletters</p></div>`:''}`;
}
function tabRem(t){
  const g = GUIDE[t.group]||GUIDE.other, r = t.status==='past'?null:repotStatus(t);
  return `<div class="more-list">
    ${r?`<button>${ico('pot')}<div>Repot every ${evText(t)} years<span>${esc(r.text)}${r.last?' · last '+fmtD(r.last.date):''}</span></div></button>`:''}
    <button>${ico('scissors')}<div>Maintenance prune in season<span>${(g.rows.prune||g.rows.struct||[]).map(m=>MONTHS[m-1]).join(', ')||'—'}</span></div></button>
    <button>${ico('bell')}<div>Send to TickTick<span>Reminders will go to your Bonsai list in TickTick once the app is live</span></div></button>
  </div>`;
}

/* ---- monthly look-ahead: what falls due in a given month ---- */
function addMonths(y,m,n){ const d=new Date(y,m-1+n,1); return [d.getFullYear(), d.getMonth()+1]; }
function repotMonth(t){
  const g = GUIDE[t.group]||GUIDE.other, win = g.rows.repot||[]; if(!win.length) return null;
  const last = lastOf(t.id,['repot']);
  let [y,m] = last ? (()=>{const d=parseD(last.date); return [d.getFullYear()+evMin(t), d.getMonth()+1];})() : [TODAY.getFullYear(), NOW_M];
  if(y < TODAY.getFullYear() || (y===TODAY.getFullYear() && m < NOW_M)) { y=TODAY.getFullYear(); m=NOW_M; }
  for(let i=0;i<24;i++){ const [yy,mm]=addMonths(y,m,i); if(win.includes(mm)) return [yy,mm]; }
  return null;
}
function lookahead(y,m){
  const active = TREES.filter(t=>t.status!=='past');
  const repots = active.filter(t=>{ const r=repotMonth(t); return r && r[0]===y && r[1]===m; });
  const prev = m===1?12:m-1, opens=[];
  for(const [k,g] of Object.entries(GUIDE)){
    const ts = active.filter(t=>t.group===k); if(!ts.length) continue;
    for(const task of ['struct','wire','defol','clean','potash','prune']){
      const w = g.rows[task]||[]; if(w.includes(m) && !w.includes(prev)) opens.push({task, g, trees:ts, until:MONTHS[w.reduce((a,x)=>x,0)-1]});
    }
  }
  const routines = ROUTINES.map(r=>({r, dates:routineDates(r,y,m)}));
  return {repots, opens, routines, coll:(COLLECTION[m]||[])};
}
function tickTitle(o){ const verb={struct:'Hard prune',wire:'Wire',defol:o.g.name==='Black pines'?'Decandle':'Defoliate',clean:o.g.name==='Black pines'?'Needle clean-up':'Clean out dead needles',potash:'Liquid potash (fortnightly)',prune:'Start trimming new growth'}[o.task]; return `${verb}: ${o.g.name.toLowerCase()} (${o.trees.length} tree${o.trees.length>1?'s':''})`; }
function viewAhead(){
  const sel = S.ahead || 0, [y,m] = addMonths(TODAY.getFullYear(), NOW_M, sel), A = lookahead(y,m);
  const nItems = A.repots.length + A.opens.length + A.coll.length;
  return `<div class="section-h" style="margin-top:8px"><div><span class="eyebrow">Monthly look-ahead</span><h2>What falls due</h2></div></div>
  <div class="chips" role="group" aria-label="Month">${[0,1,2,3,4,5].map(i=>{const [yy,mm]=addMonths(TODAY.getFullYear(),NOW_M,i); const n=(()=>{const a=lookahead(yy,mm); return a.repots.length+a.opens.length+a.coll.length;})(); return `<button class="chip" data-ahead="${i}" aria-pressed="${sel===i}">${MONTHS[mm-1]}${yy!==TODAY.getFullYear()?' '+String(yy).slice(2):''} <span class="num muted">${n}</span></button>`;}).join('')}</div>
  <div class="ahead">
    <div class="card" style="padding:16px">
      <h3 style="font-size:20px">${MONTHS_L[m-1]} ${y}</h3>
      ${A.repots.length?`<span class="eyebrow" style="display:block;margin-top:12px">Repots due (${A.repots.length})</span>${A.repots.map(t=>{const l=lastOf(t.id,['repot']); return `<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:14px">${l?'Last repot '+fmtD(l.date,l.precision):'No repot on record'} · every ${evText(t)} yrs</span></span>${ico('pot')}</button>`;}).join('')}`:''}
      ${A.opens.length?`<span class="eyebrow" style="display:block;margin-top:14px">Seasons opening</span>${A.opens.map(o=>`<div class="due-item"><span class="ph" style="width:44px;height:44px;border-radius:10px;flex:none;background:${TASKS[o.task].c};color:#fff">${ico(o.task==='wire'?'wire':o.task==='defol'?'leaf':o.task==='potash'?'drop':o.task==='clean'?'brush':'scissors')}</span><span class="t"><b>${esc(tickTitle(o))}</b><span class="muted" style="font-size:14px">${o.trees.map(t=>esc(t.name)).slice(0,4).join(', ')}${o.trees.length>4?' and '+(o.trees.length-4)+' more':''}</span></span></div>`).join('')}`:''}
      ${A.coll.length?`<span class="eyebrow" style="display:block;margin-top:14px">Whole collection</span>${A.coll.map(c=>`<div class="due-item"><span class="ph" style="width:44px;height:44px;border-radius:10px;flex:none">${ico('tree')}</span><span class="t"><b>${esc(c)}</b></span></div>`).join('')}`:''}
      ${!nItems?'<p class="muted">Nothing new falls due this month. Routine feeding and spraying carry on.</p>':''}
      <span class="eyebrow" style="display:block;margin-top:14px">Already in your TickTick</span>
      ${A.routines.map(({r,dates})=>`<div class="due-item"><span class="ph" style="width:44px;height:44px;border-radius:10px;flex:none">${ico(r.icon)}</span><span class="t"><b>${esc(r.name)}</b><span class="muted num" style="font-size:14px">${dates.map(d=>'Sat '+d.getDate()).join(', ')||'—'}</span></span></div>`).join('')}
    </div>
    <div class="card tips" style="padding:16px">
      <span class="eyebrow">Advice for ${MONTHS_L[m-1]}</span>
      <p class="muted" style="font-size:14px;margin:4px 0 6px">From your monthly calendar and the Red Dragon newsletters</p>
      ${(TIPS[m]||[]).map(x=>`<div class="tip"><b>${esc(x.t)}</b><p>${esc(x.x)}</p><span>${esc(x.s)}</span></div>`).join('')}
    </div>
    <div class="card tt" style="padding:16px">
      <span class="eyebrow">TickTick preview · sent ${sel===0?'today (first run)':'1 '+MONTHS_L[m-1]+' at 7am'}</span>
      <p class="muted" style="font-size:14.5px;margin:6px 0 10px">One task in your <b style="color:var(--ink)">Bonsai</b> list, due the end of the month. Tick items off as you get to them.</p>
      <div class="tt-task"><span class="tt-box"></span><div style="min-width:0;flex:1"><b>Bonsai jobs – ${MONTHS_L[m-1]} ${y}</b><span>Due ${new Date(y,m,0).getDate()} ${MONTHS[m-1]} · ${nItems} checklist item${nItems===1?'':'s'}</span>
        <ul class="tt-list">${[...A.repots.map(t=>'Repot '+t.name), ...A.opens.map(o=>tickTitle(o)), ...A.coll].map(x=>`<li><span class="tt-box sm"></span>${esc(x)}</li>`).join('') || '<li class="muted">Nothing extra this month – routines continue</li>'}</ul>
        <span style="display:block;margin-top:8px">Notes: this month's advice (${(TIPS[m]||[]).map(x=>esc(x.t.toLowerCase())).join(', ')})</span></div></div>
    </div>
  </div>`;
}
function viewSeason(){
  const groups = Object.entries(GUIDE).filter(([k])=>k!=='other' && TREES.some(t=>t.status!=='past'&&t.group===k));
  return header() + viewAhead() + `<div class="section-h"><div><span class="eyebrow">Brisbane · from your calendar &amp; Red Dragon</span><h2>Season calendar</h2></div></div>
  <div class="section-h" style="margin-top:14px"><h2 style="font-size:19px">Collection routines</h2></div>
  <div class="more-list">${ROUTINES.map(r=>{const nx=routineDates(r,TODAY.getFullYear(),NOW_M).find(d=>d>=new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()))||routineDates(r,...addMonths(TODAY.getFullYear(),NOW_M,1))[0]; return `<button>${ico(r.icon)}<div>${esc(r.name)}<span>${esc(r.every)} · next Sat ${nx?nx.getDate()+' '+MONTHS[nx.getMonth()]:''} · in TickTick</span></div></button>`;}).join('')}</div>
  ${groups.map(([k,g])=>{ const ids=TREES.filter(t=>t.status!=='past'&&t.group===k).map(t=>t.id); return `<div class="section-h"><h2 style="font-size:20px">${esc(g.name)} <span class="muted num" style="font-family:var(--body);font-size:15px;font-weight:400">${ids.length} tree${ids.length>1?'s':''} · repot every ${g.every} yrs${k==='pine'?' (3–5 for the oldest)':''}</span></h2></div>${calTable(g.rows, myRepotMonths(ids))}`; }).join('')}`;
}

function viewHistory(){
  let L = LOGS;
  if(S.histAct!=='all') L = L.filter(l=>l.actions.some(a=>kindOf(a)===S.histAct));
  if(S.q) L = L.filter(l=>(l.text+' '+l.trees.map(id=>byId[id]?.name).join(' ')).toLowerCase().includes(S.q.toLowerCase()));
  const shown = L.slice(0, S.histLimit||60);
  const years = new Set(LOGS.map(l=>(l.date||'').slice(0,4)).filter(Boolean));
  return header('Search all history…') + `<div class="section-h"><div><span class="eyebrow">Every tree · every year</span><h2>History</h2></div><span class="muted num">${LOGS.length} entries · ${Math.min(...years)}–${Math.max(...years)}</span></div>
  <div class="chips" role="group" aria-label="Filter by job">${['all','repot','root','prune','hard','wire','fert','insect','fung','note'].map(k=>`<button class="chip" data-hact="${k}" aria-pressed="${S.histAct===k}">${k==='all'?'All jobs':ACT[k].label}</button>`).join('')}</div>
  <p class="muted num" style="font-size:14px">${L.length} matching</p>
  ${byYear(shown,true)}
  ${L.length>shown.length?`<p style="text-align:center"><button class="btn ghost" data-more>Show more (${L.length-shown.length} older)</button></p>`:''}`;
}

/* mixes */
const ING = {akadama:['Akadama','#B5653A'], pumice:['Pumice','#CFC8B8'], scoria:['Scoria','#7A2F25'], zeolite:['Zeolite','#9DB8A4'], diatomite:['Diatomite','#E2B87A'],
  bark:['Pine bark 3–6 mm','#5A3A22'], barkf:['Pine bark fines','#7B5636'], charcoal:['Charcoal','#2C2C2C'], sand:['Coarse sand','#D9C9A0'], peat:['Peat moss','#4A3B2E'],
  potmix:['Potting mix','#3E3328'], gritty:['Gritty mix','#9A8F80'], orchid:['Orchid bark','#8A5A34'], kanuma:['Kanuma','#E8D9A8'],
  clay:['Expanded clay 3 mm','#B0583A'], propsand:['Propagation sand','#E3D3A6'], lava:['Lava rock','#5E3B3B'], nuggets:['Pine nuggets','#6B4528'], native:['Native potting mix','#3B2F22'], grit:['Coarse grit','#A9A39A'], minibark:['Mini pine bark','#6E4A2C'], bark7:['Pine bark 7 mm','#4E321D']};
export const DEFAULT_MIXES = [
  {name:'Clerodendrum 2026 mix', parts:{akadama:1,diatomite:1,pumice:1,scoria:1,bark:1}, used:['cler-large','cler-small','cler-informal'], note:'Changed because the trees struggled in the straight inorganic mix.'},
  {name:'Gritty mix 50 / 25 / 25', parts:{akadama:2,pumice:1,zeolite:1}, used:['beaver-fig','jbp-240'], note:'Plus a scoop of bark.'},
  {name:'Pine repot 2:1:1', parts:{pumice:2,akadama:1,gritty:1}, used:['jbp-spike'], note:'Plus a scoop of pine bark (Apr 2026: ran short, needed more).'},
  {name:'Elm 2025 (60/20/20)', parts:{gritty:3,bark:1,potmix:1}, used:['birthday-elm','cler-small'], note:'Used 19 Jul 2025.'},
  {name:'Bougainvillea 1:1:1', parts:{pumice:1,zeolite:1,barkf:1}, used:['bougainvillea'], note:'With a small amount of sand and peat moss.'},
  {name:'JBP – Bonsai South', parts:{clay:2,bark:1,propsand:1}, used:[], note:'50 / 25 / 25. From your recipe sheet.'},
  {name:'Pines & junipers', parts:{pumice:2,akadama:1,nuggets:1}, used:[], note:'50 / 25 / 25. From your recipe sheet.'},
  {name:'Pines & junipers – Bonsai En', parts:{akadama:1,pumice:1,zeolite:1}, used:[], note:'Add something extra if more water retention is needed in summer.'},
  {name:'Stephen Cullum all-rounder', parts:{zeolite:1,diatomite:1,bark7:1,potmix:1}, used:[], note:'All 7 mm bark instead of potting mix drains better but needs watering twice a day in summer.'},
  {name:'General 50/50', parts:{native:1,grit:1}, used:[], note:'Grit = pumice, diatomite, coarse river sand etc.'},
  {name:'Shibui Bonsai Growers', parts:{minibark:7,propsand:3}, used:[], note:'Plus zeolite and dolomite.'},
  {name:'Bonsai Empire – deciduous', parts:{akadama:2,pumice:1,lava:1}, used:[], note:'50 / 25 / 25.'},
  {name:'Bonsai Empire – conifers', parts:{akadama:1,pumice:1,lava:1}, used:[], note:'Equal thirds.'},
];
function ratioBar(parts){ const tot=Object.values(parts).reduce((a,b)=>a+b,0); return `<div class="ratio" role="img" aria-label="Ratio">${Object.entries(parts).map(([k,v])=>`<span style="width:${v/tot*100}%;background:${ING[k][1]}" title="${ING[k][0]}"></span>`).join('')}</div>`; }
function viewMixes(){
  const m = MIXES[S.mix||0];
  const L=+(S.cl||30), W=+(S.cw||22), H=+(S.ch||7), shape=S.cs||'rect', scoop=+(S.sc||500);
  const vol = (shape==='rect'?L*W*H:shape==='oval'?Math.PI*(L/2)*(W/2)*H:Math.PI*(L/2)*(L/2)*H)/1000*0.9;
  const tot = Object.values(m.parts).reduce((a,b)=>a+b,0);
  return header('Search…') + `<div class="section-h"><div><span class="eyebrow">Soil recipes</span><h2>Mixes</h2></div><button class="btn small" data-editmix="">${ico('plus')}New mix</button></div>
  <div class="grid">${MIXES.map((x,i)=>`<div class="card mix" role="button" tabindex="0" data-mix="${i}" style="border:2px solid ${i===(S.mix||0)?'var(--glaze)':'transparent'};text-align:left;cursor:pointer">
    <h3 style="font-size:19px">${esc(x.name)}</h3>${ratioBar(x.parts)}
    <div class="ing">${Object.entries(x.parts).map(([k,v])=>`<span><i style="background:${ING[k][1]}"></i><b class="num">${v}</b> ${ING[k][0]}</span>`).join('')}</div>
    <span class="muted" style="font-size:14px">${esc(x.note)}</span>
    ${(x.used||[]).length?`<span style="font-size:14px">Used on: ${x.used.map(id=>esc(byId[id]?.name)).join(', ')}</span>`:''}${x.id?`<span><button class="btn ghost small" data-editmix="${i}">Edit</button></span>`:''}</div>`).join('')}</div>
  <div class="note" style="margin-top:12px"><b>Potting tips from your sheet:</b> pine bark uses up nitrogen as it breaks down, so add slow-release to the mix. Add zeolite to inorganic mixes to hold fertiliser. Aim to repot pines every 5 years.</div>
  <div class="section-h"><h2 style="font-size:20px">How much do I need?</h2><span class="muted">for ${esc(m.name)}</span></div>
  <div class="card" style="padding:16px;display:grid;gap:16px">
    <div class="calc">
      <label class="field"><span class="muted" style="font-size:14px">Pot shape</span><select id="cs"><option value="rect"${shape==='rect'?' selected':''}>Rectangle / square</option><option value="oval"${shape==='oval'?' selected':''}>Oval</option><option value="round"${shape==='round'?' selected':''}>Round</option></select></label>
      <label class="field"><span class="muted" style="font-size:14px">${shape==='round'?'Diameter':'Length'} (cm)</span><input id="cl" type="number" inputmode="decimal" value="${L}"></label>
      ${shape!=='round'?`<label class="field"><span class="muted" style="font-size:14px">Width (cm)</span><input id="cw" type="number" inputmode="decimal" value="${W}"></label>`:''}
      <label class="field"><span class="muted" style="font-size:14px">Depth (cm)</span><input id="ch" type="number" inputmode="decimal" value="${H}"></label>
      <label class="field"><span class="muted" style="font-size:14px">Your scoop (mL)</span><input id="sc" type="number" inputmode="decimal" value="${scoop}"></label>
    </div>
    <p style="margin:0">About <b class="num" style="font-size:22px">${vol.toFixed(1)} L</b> of mix <span class="muted" style="font-size:14px">(inside volume, less 10% for the root ball)</span></p>
    <div class="calc-out">${Object.entries(m.parts).map(([k,v])=>`<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${ING[k][1]};margin-right:8px"></i>${ING[k][0]}</span><b>${(vol*v/tot).toFixed(2)} L</b><b>${Math.max(0.5,Math.round(vol*v/tot*1000/scoop*2)/2)} scoops</b>`).join('')}</div>
  </div>`;
}

function viewPots(){
  const pots = D.pots.slice().sort((a,b)=>a.name.localeCompare(b.name));
  return header('Search pots…') + `<div class="section-h"><div><span class="eyebrow">${pots.length} recorded</span><h2>Pots</h2></div><button class="btn small" data-editpot="">${ico('plus')}Add pot</button></div>
  <div class="grid">${pots.filter(p=>!S.q||p.name.toLowerCase().includes(S.q.toLowerCase())).map(p=>`<button class="card pot" data-editpot="${p.id}" style="border:0;text-align:left">${p.photos&&p.photos.length&&photo(p.photos[0])?`<img class="thumb" src="${photo(p.photos[0])}" alt="">`:`<div class="thumb ph">${ico('pot')}</div>`}
    <div style="min-width:0"><h3 style="font-size:17px;font-family:var(--body);font-weight:700">${esc(p.name)}</h3>
    <div class="muted" style="font-size:14px">${[p.shape,p.material,p.size?('Size '+p.size):'',p.glazed===true?'Glazed':p.glazed===false?'Unglazed':''].filter(Boolean).map(esc).join(' · ')}</div>
    <div style="font-size:14px">${[p.price?'$'+p.price:'',p.acquired?fmtD(p.acquired):'',p.source].filter(Boolean).map(esc).join(' · ')||'<span class="muted">'+esc(p.notes)+'</span>'}</div></div></button>`).join('')||'<div class="empty">No pots yet.</div>'}</div>`;
}
function viewReview(){
  const st = {active:TREES.filter(t=>t.status!=='past').length, past:TREES.filter(t=>t.status==='past').length};
  return header() + `<div class="section-h"><div><span class="eyebrow">How your old records were brought in</span><h2>Import notes</h2></div></div>
  <div class="statgrid">
    <div class="stat"><b class="num">${st.active}</b><span>trees in the collection</span></div>
    <div class="stat"><b class="num">${st.past}</b><span>past trees kept with history</span></div>
    <div class="stat"><b class="num">${LOGS.length}</b><span>history entries</span></div>
    <div class="stat"><b class="num">${Object.keys(PH).length}</b><span>photos</span></div>
  </div>
  <div class="section-h"><h2 style="font-size:20px">Decisions made with you</h2></div>
  <div class="card" style="padding:16px"><ul class="done-list">${(D.done||[]).map(x=>`<li>${ico('check')}<span>${esc(x)}</span></li>`).join('')||'<li class="muted">Nothing imported yet.</li>'}</ul></div>`;
}
function viewMore(){
  return header() + `<div class="section-h"><h2>More</h2></div><div class="more-list">
    <button data-nav="pots">${ico('pot')}<div>Pots<span>${D.pots.length} recorded</span></div></button>
    <button data-nav="mixes">${ico('mix')}<div>Soil mixes<span>Recipes and a pot volume calculator</span></div></button>
    <button data-nav="past">${ico('archive')}<div>Past trees<span>${TREES.filter(t=>t.status==='past').length} trees from 2003 onwards</span></div></button>
    <button data-nav="recycle">${ico('x')}<div>Recycle bin<span>${DELETED.length} deleted entr${DELETED.length===1?'y':'ies'} you can restore</span></div></button>
    <button data-nav="settings">${ico('shield')}<div>Backups &amp; Drive<span>${state.meta.backup?.lastDay?'Last backup '+fmtD(state.meta.backup.lastDay):'No backup yet'}</span></div></button>
    <button data-nav="review">${ico('question')}<div>Import notes<span>What was merged and how</span></div></button>
  </div>`;
}
function viewRecycle(){
  return header() + `<div class="section-h"><div><span class="eyebrow">Nothing is ever lost</span><h2>Recycle bin</h2></div></div>
  <p class="muted" style="margin-top:-4px">Deleted history entries stay here. Restore puts them straight back.</p>
  ${DELETED.map(l=>`<div class="card" style="padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center"><div style="flex:1;min-width:0"><b>${l.trees.map(id=>esc(byId[id]?.name||id)).join(', ')}</b> <span class="muted num">· ${fmtD(l.date,l.precision)}</span><div class="muted" style="font-size:14.5px;white-space:pre-line">${esc(l.text)}</div></div><button class="btn small" data-restore="${l.id}">Restore</button></div>`).join('')||'<div class="empty">The recycle bin is empty.</div>'}`;
}
function viewSettings(){
  const b = state.meta.backup;
  return header() + `<div class="section-h"><div><span class="eyebrow">Your data, in your accounts</span><h2>Backups &amp; Drive</h2></div></div>
  <div class="stack">
    <div class="card" style="padding:16px"><b>Google Drive</b><p class="muted" style="margin:4px 0 10px;font-size:15px">Full-size photos and weekly backups go into a "Graytrees" folder in your Drive. The app can only see files it created.</p>
      ${driveConnected()?`<span class="pill ok">Connected</span>`:`<button class="btn small" data-drive>${ico('check')}Connect Google Drive</button>`}
      <p class="muted num" style="font-size:14px;margin:10px 0 0" id="pendingInfo"></p></div>
    <div class="card" style="padding:16px"><b>Weekly backup</b><p class="muted" style="margin:4px 0 10px;font-size:15px">Every 7 days, the next time the app is opened online, all records are saved to Drive → Graytrees → Backups as a JSON file and a history spreadsheet (CSV).</p>
      <p style="margin:0 0 10px">${b?.lastDay?`Last backup <b>${fmtD(b.lastDay)}</b> · ${b.trees} trees, ${b.logs} entries`:'No backup yet.'}</p>
      <button class="btn small" data-backup>${ico('archive')}Back up now</button></div>
    <div class="card" style="padding:16px"><b>Import records</b><p class="muted" style="margin:4px 0 10px;font-size:15px">Load the merged records file and photo bundle. Safe to run again; nothing is duplicated.</p><button class="btn ghost small" data-nav="import">${ico('archive')}Open import</button></div>
    <div class="card" style="padding:16px"><b>Signed in</b><p class="muted" style="margin:4px 0 10px;font-size:15px">${esc(auth.currentUser?.email||'')}</p><button class="btn ghost small" data-signout>Sign out</button></div>
  </div>`;
}
function viewImport(){
  return header() + `<div class="section-h"><div><span class="eyebrow">One-time setup</span><h2>Import my records</h2></div></div>
  <div class="card" style="padding:16px;display:grid;gap:14px">
    <p style="margin:0">Choose the two files Claude sent you: <b>graytrees-import.json</b> (records) and the photo files <b>graytrees-photos-1.zip</b> and <b>graytrees-photos-2.zip</b> (select both together). Photos are uploaded to your Google Drive, so do this on Wi-Fi; it takes a few minutes.</p>
    <label class="field"><span class="eyebrow">Records file (.json)</span><input type="file" id="impJson" accept=".json,application/json"></label>
    <label class="field"><span class="eyebrow">Photos (.zip – choose both)</span><input type="file" id="impZip" multiple accept=".zip,application/zip"></label>
    <button class="btn" data-runimport>${ico('archive')}Start import</button>
    <p id="impStatus" class="muted num" style="margin:0" role="status">${esc(S.importResult||'')}</p>
  </div>`;
}
/* --- quick log sheet --- */
const LG = {trees:new Set(), acts:new Set(), date:'', note:'', mix:'', fileObjs:[], err:''};
function openLog(treeId){
  LG.trees = new Set(treeId?[treeId]:[]); LG.acts=new Set(); LG.date=localDay(); LG.note=''; LG.mix=''; LG.fileObjs=[]; LG.err=''; LG.filter='all'; LG.editing=false;
  renderSheet();
}
function renderSheet(){
  const act = TREES.filter(t=>t.status!=='past').filter(t=>LG.filter==='all'||t.group===LG.filter||(LG.filter==='other'&&!['pine','juniper','elm','fig','cler'].includes(t.group))).sort((a,b)=>a.name.localeCompare(b.name));
  let sheet = $('#layer .sheet.log');
  if(!sheet){ $('#layer').innerHTML = `<div class="scrim" data-close><div class="sheet log" role="dialog" aria-modal="true" aria-label="Log work"></div></div>`; sheet = $('#layer .sheet.log'); }
  sheet.innerHTML = `
    <div class="row" style="justify-content:space-between"><h2>Log work</h2><button class="btn ghost small" data-close aria-label="Close">${ico('x')}</button></div>
    <div class="step"><span class="eyebrow">1 · Which trees? <span class="num" style="color:var(--glaze)">${LG.trees.size} selected</span></span>
      <div class="chips" style="margin-bottom:8px">${GROUPS.map(([k,l])=>`<button class="chip" data-lgf="${k}" aria-pressed="${LG.filter===k}">${l}</button>`).join('')}<button class="chip" data-lgall>Select all shown</button><button class="chip" data-lgnone>Clear</button></div>
      <div class="picker">${act.map(t=>`<button class="pick" data-lgt="${t.id}" aria-pressed="${LG.trees.has(t.id)}">${thumb(t,'')}<span>${esc(t.name)}</span></button>`).join('')}</div></div>
    <div class="step"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="eyebrow">2 · What did you do?</span><button class="btn ghost small" data-jobsed aria-expanded="${!!LG.editing}">${LG.editing?'Done editing':'Edit jobs'}</button></div>
      ${LG.editing ? jobsEditor() : `${COMBOS.length?`<div class="combos">${COMBOS.map(c=>`<button class="combo" data-combo="${c.id}">+ ${esc(c.label)}</button>`).join('')}</div>`:''}
      <div class="actgrid">${JOBS.filter(j=>!j.hidden).map(j=>`<button class="actbtn" data-lga="${j.id}" aria-pressed="${LG.acts.has(j.id)}">${ico(KIND_ICON[j.kind]||'eye')}${esc(j.label)}</button>`).join('')}</div>`}</div>
    <div class="step" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <label class="field"><span class="eyebrow">Date</span><input type="date" id="lgdate" value="${LG.date}"></label>
      <label class="field"><span class="eyebrow">Soil mix (if repotted)</span><select id="lgmix"><option value="">—</option>${MIXES.map(m=>`<option${LG.mix===m.name?' selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
    </div>
    <label class="field step"><span class="eyebrow">Notes (optional)</span><textarea id="lgnote" rows="2" placeholder="e.g. Heavy cut back, removed two lower branches">${esc(LG.note)}</textarea></label>
    <div class="step row"><label class="btn ghost small">${ico('cam')}Add photos<input type="file" accept="image/*" multiple hidden id="lgfiles"></label><span class="muted" style="font-size:14px">${LG.fileObjs.length?LG.fileObjs.length+' photo'+(LG.fileObjs.length>1?'s':'')+' attached':'Take one now or pick from your gallery later'}</span></div>
    ${LG.err?`<p class="err" role="alert">${esc(LG.err)}</p>`:''}
    <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-lgsave>${ico('check')}Save${LG.trees.size>1?' for '+LG.trees.size+' trees':''}</button></div>`;
}
function jobsEditor(){
  return `<div class="jobs-ed">
    <p class="muted" style="margin:0;font-size:14.5px">Rename jobs, hide ones you never use, or add your own. "Counts as" decides which "Last done" tile and reminder a job updates.</p>
    <div class="jrow eyebrow" style="font-size:12px"><span>Job name</span><span>Counts as</span><span></span></div>
    ${JOBS.map((j,i)=>`<div class="jrow"><input value="${esc(j.label)}" data-jlabel="${i}" aria-label="Job name">
      <select data-jkind="${i}" aria-label="Counts as">${KINDS.map(([k,l])=>`<option value="${k}"${j.kind===k?' selected':''}>${l}</option>`).join('')}</select>
      <button class="tg" data-jhide="${i}" aria-pressed="${!j.hidden}">${j.hidden?'Hidden':'Shown'}</button></div>`).join('')}
    <div class="row"><button class="btn ghost small" data-jadd>${ico('plus')}Add a job</button></div>
    <span class="eyebrow" style="margin-top:8px">Shortcuts (tick several jobs in one tap)</span>
    ${COMBOS.map((c,i)=>`<div class="jrow"><input value="${esc(c.label)}" data-clabel="${i}" aria-label="Shortcut name"><span class="muted" style="font-size:13.5px">${c.jobs.map(id=>esc(ACT[id]?.label||id)).join(' + ')}</span><button class="tg" data-cdel="${i}">Remove</button></div>`).join('')}
    <div class="row"><button class="btn ghost small" data-cadd>${ico('plus')}Save ticked jobs as a shortcut</button>${LG.err&&LG.editing?'':''}</div>
  </div>`;
}
async function saveLog(){
  if(!LG.trees.size){ LG.err='Pick at least one tree.'; return renderSheet(); }
  if(!LG.acts.size && !LG.note.trim()){ LG.err='Pick what you did, or write a note.'; return renderSheet(); }
  if(LG.saving) return; LG.saving=true;
  const btn=$('[data-lgsave]'); if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  const acts=[...LG.acts]; if(!acts.length) acts.push('note');
  const ids=[...LG.trees];
  let pids=[];
  try{ if(LG.fileObjs.length) pids = await addPhotos(LG.fileObjs, {trees:ids, date:LG.date}); }catch(err){ console.warn(err); toast('Photos saved on this device; they will upload later'); }
  const label = acts.map(a=>ACT[a]?.label||a).join(', ');
  const text = label + (LG.mix?`\nMix: ${LG.mix}`:'') + (LG.note.trim()?`\n${LG.note.trim()}`:'');
  const batch = newId('B');
  // one record per tree keeps each tree's history independent; they share a batch id
  const entries = ids.map((tid,i)=>({id:batch+'-'+i, batch, trees:[tid], date:LG.date, precision:'day', actions:acts, text, sources:['Graytrees'], flags:[], photos:pids, mix:LG.mix||null}));
  const p = addLogs(entries);
  for(const tid of ids) if(pids.length) setTreePhotos(tid, [...pids, ...(byId[tid]?.photos||[])]);
  $('#layer').innerHTML=''; LG.saving=false;
  S.newLog = entries[Math.max(0,ids.indexOf(S.tree))].id;
  toast(`Logged for ${ids.length} tree${ids.length>1?'s':''}${navigator.onLine?'':' (saved on this device)'}`);
  if(ids.length===1){ go('tree',{tree:ids[0],tab:'history'}); } else { S.histAct='all'; go('history'); }
  p.catch(err=>toast('Could not save: '+err.message));
}
function keepScroll(fn){ const sh=$('.sheet'), ss=sh?sh.scrollTop:0; fn(); const n=$('.sheet'); if(n) n.scrollTop=ss; }
function toast(msg){ const el=document.createElement('div'); el.className='toast'; el.setAttribute('role','status'); el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),2800); }

/* --- generic edit form (trees, pots, mixes, history entries) --- */
let FORM = null;
function openForm(f){ FORM = f; FORM.err=''; renderForm(); }
function fieldHtml(fd, v){
  const id='f_'+fd.k, val = v ?? '';
  if(fd.type==='select') return `<label class="field"><span class="eyebrow">${fd.label}</span><select id="${id}">${fd.options.map(([k,l])=>`<option value="${esc(k)}"${String(val)===String(k)?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
  if(fd.type==='textarea') return `<label class="field" style="grid-column:1/-1"><span class="eyebrow">${fd.label}</span><textarea id="${id}" rows="3">${esc(val)}</textarea></label>`;
  if(fd.type==='jobs') return `<div class="field" style="grid-column:1/-1"><span class="eyebrow">${fd.label}</span><div class="chips" style="flex-wrap:wrap">${JOBS.map(j=>`<button type="button" class="chip" data-fjob="${j.id}" aria-pressed="${(val||[]).includes(j.id)}">${esc(j.label)}</button>`).join('')}</div></div>`;
  if(fd.type==='parts') return `<div class="field" style="grid-column:1/-1"><span class="eyebrow">${fd.label}</span><div class="calc">${Object.entries(ING).map(([k,[l]])=>`<label class="field"><span class="muted" style="font-size:13.5px">${l}</span><input type="number" min="0" step="0.5" inputmode="decimal" data-part="${k}" value="${(val||{})[k]||''}" placeholder="0"></label>`).join('')}</div></div>`;
  if(fd.type==='trees') return `<div class="field" style="grid-column:1/-1"><span class="eyebrow">${fd.label}</span><div class="chips" style="flex-wrap:wrap">${TREES.filter(t=>t.status!=='past').sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<button type="button" class="chip" data-ftree="${t.id}" aria-pressed="${(val||[]).includes(t.id)}">${esc(t.name)}</button>`).join('')}</div></div>`;
  return `<label class="field"><span class="eyebrow">${fd.label}</span><input id="${id}" type="${fd.type||'text'}" ${fd.type==='number'?'inputmode="decimal" step="any"':''} value="${esc(val)}"></label>`;
}
function renderForm(){
  const f = FORM, v = f.value;
  $('#layer').innerHTML = `<div class="scrim" data-close><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(f.title)}">
    <div class="row" style="justify-content:space-between"><h2>${esc(f.title)}</h2><button class="btn ghost small" data-close aria-label="Close">${ico('x')}</button></div>
    ${f.note?`<p class="muted" style="font-size:14.5px">${f.note}</p>`:''}
    <div class="step" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${f.fields.map(fd=>fieldHtml(fd, v[fd.k])).join('')}</div>
    ${f.err?`<p class="err" role="alert">${esc(f.err)}</p>`:''}
    ${f.danger?`<div class="row" style="margin-top:16px">${f.danger}</div>`:''}
    <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-fsave>${ico('check')}Save</button></div>
  </div></div>`;
}
function readForm(){
  const v = {...FORM.value};
  for(const fd of FORM.fields){
    if(['jobs','parts','trees'].includes(fd.type)) continue;
    const el = $('#f_'+fd.k); if(!el) continue;
    let x = el.value.trim();
    if(fd.type==='number') x = x===''?null:Number(x);
    if(fd.k==='glazed') x = x==='yes'?true:x==='no'?false:null;
    v[fd.k]=x;
  }
  const parts={}; document.querySelectorAll('[data-part]').forEach(i=>{ const n=parseFloat(i.value); if(n>0) parts[i.dataset.part]=n; }); if(FORM.fields.some(f=>f.type==='parts')) v.parts=parts;
  return v;
}
const GROUP_BY_COMMON = {'Japanese Black Pine':'pine','Chinese Elm':'elm','Chinese Juniper':'juniper','Japanese Garden Juniper':'juniper','Juniper':'juniper','Clerodendrum':'cler','Port Jackson Fig':'fig','Tiger Bark Fig':'fig','Fig':'fig','Swamp Cypress':'swamp','Buddhist Pine':'podo','Melaleuca':'mela','Bougainvillea':'bougie','Azalea':'azalea'};
function editTree(id){
  const t = id ? byId[id] : {status:'active', photos:[], group:'other', aka:[]};
  openForm({ title: id?'Edit '+t.name:'Add a tree', value:{...t}, kind:'trees',
    fields:[{k:'name',label:'Name'},{k:'common',label:'Common name'},{k:'scientific',label:'Scientific name'},
      {k:'group',label:'Care group (sets season timing)',type:'select',options:[['pine','Black pine'],['elm','Chinese elm'],['juniper','Juniper'],['fig','Fig'],['cler','Clerodendrum'],['swamp','Swamp cypress'],['podo','Buddhist pine'],['mela','Melaleuca'],['bougie','Bougainvillea'],['azalea','Azalea'],['african','Jaboticaba'],['other','Other']]},
      {k:'style',label:'Style'},{k:'stage',label:'Development',type:'select',options:[['',''],['Early development','Early development'],['Mid development','Mid development'],['Refinement','Refinement']]},
      {k:'plantDate',label:'Plant date',type:'date'},{k:'acquired',label:'Date acquired',type:'date'},{k:'source',label:'Source'},
      {k:'price',label:'Purchase price ($)',type:'number'},{k:'value',label:'Value ($)',type:'number'},{k:'height',label:'Height (cm)',type:'number'},{k:'trunk',label:'Trunk width (cm)',type:'number'},
      {k:'pot',label:'Pot'},{k:'substrate',label:'Soil mix'},
      {k:'status',label:'Status',type:'select',options:[['active','In my collection'],['past','Past tree']]},{k:'fate',label:'If past: what happened'},
      {k:'notes',label:'Notes',type:'textarea'}],
    onSave: async v => { if(!v.name) return 'Give the tree a name.'; if(!id && v.group==='other' && GROUP_BY_COMMON[v.common]) v.group=GROUP_BY_COMMON[v.common]; const nid = await saveRecord('trees', v); S.tree=nid; go('tree',{tree:nid, tab:'info'}); toast('Saved'); }});
}
function editPot(id){
  const p = id ? D.pots.find(x=>x.id===id) : {photos:[]};
  openForm({ title: id?'Edit pot':'Add a pot', value:{...p, glazed: p.glazed===true?'yes':p.glazed===false?'no':''},
    fields:[{k:'name',label:'Description'},{k:'shape',label:'Shape'},{k:'material',label:'Material'},{k:'size',label:'Size'},
      {k:'glazed',label:'Glazed?',type:'select',options:[['',''],['yes','Glazed'],['no','Unglazed']]},{k:'holes',label:'Drainage holes'},
      {k:'price',label:'Price ($)',type:'number'},{k:'acquired',label:'Date bought',type:'date'},{k:'source',label:'Where from'},{k:'potter',label:'Potter'},{k:'notes',label:'Notes',type:'textarea'}],
    danger: id?`<label class="btn ghost small">${ico('cam')}Add photo<input type="file" accept="image/*" hidden data-potphoto="${id}"></label>`:'',
    onSave: async v => { if(!v.name) return 'Add a short description.'; await saveRecord('pots', v); go('pots'); toast('Pot saved'); }});
}
function editMix(i){
  const m = i==null ? {parts:{}, used:[]} : MIXES[i];
  openForm({ title: i==null?'New mix':'Edit '+m.name, value:{...m},
    fields:[{k:'name',label:'Name'},{k:'parts',label:'Parts of each ingredient',type:'parts'},{k:'note',label:'Notes',type:'textarea'},{k:'used',label:'Used on',type:'trees'}],
    onSave: async v => { if(!v.name) return 'Give the mix a name.'; if(!Object.keys(v.parts||{}).length) return 'Add at least one ingredient.'; await saveRecord('mixes', v); go('mixes'); toast('Mix saved'); }});
}
function editEntry(id){
  const l = LOGS.find(x=>x.id===id); if(!l) return;
  openForm({ title:'Edit entry', value:{...l, actions:[...l.actions]},
    note:'The previous version is kept with the entry, so nothing is lost.',
    fields:[{k:'date',label:'Date',type:l.precision==='month'?'text':'date'},{k:'actions',label:'Jobs',type:'jobs'},{k:'text',label:'Notes',type:'textarea'}],
    danger:`<button class="btn ghost small" data-delentry="${id}">${ico('x')}Delete entry</button><span class="muted" style="font-size:14px">Goes to the recycle bin; restorable.</span>`,
    onSave: async v => { if(!v.actions.length) return 'Pick at least one job.'; await editLog(id, {date:v.date, actions:v.actions, text:v.text}); toast('Entry updated'); render(); }});
}

/* --- render + events --- */
const VIEWS = {trees:()=>viewTrees(false), past:()=>viewTrees(true), tree:viewTree, season:viewSeason, history:viewHistory, mixes:viewMixes, pots:viewPots, review:viewReview, more:viewMore, recycle:viewRecycle, settings:viewSettings, import:viewImport};
export function render(){
  const v = VIEWS[S.view] || VIEWS.trees;
  $('#main').innerHTML = v();
  const navKey = S.view==='tree' ? (byId[S.tree]?.status==='past'?'past':'trees') : S.view;
  document.querySelectorAll('[data-nav]').forEach(b=>{ if(b.closest('.rail,.tabbar')) b.setAttribute('aria-current', (b.dataset.nav===navKey || (b.closest('.tabbar') && b.dataset.nav==='more' && ['pots','mixes','past','review','more','recycle','settings','import'].includes(navKey))) ? 'page':'false'); });
  if(S.view==='settings') pendingCount().then(n=>{ const el=$('#pendingInfo'); if(el) el.textContent = n ? `${n} photo${n>1?'s':''} waiting to upload` : ''; });
}
function sync(){
  TREES = state.trees.map(t=>({...t, photos:t.photos||[], aka:t.aka||[]}));
  byId = Object.fromEntries(TREES.map(t=>[t.id,t]));
  LOGS = state.logs.filter(l=>!l.deleted).map(l=>({...l, trees:l.trees||[], actions:l.actions||['note'], sources:l.sources||[], flags:l.flags||[]}));
  DELETED = state.logs.filter(l=>l.deleted).map(l=>({...l, trees:l.trees||[]}));
  PH = Object.fromEntries(Object.values(state.photos).map(p=>[p.id,{src:p.thumb||p.url, thumb:!!p.thumb, date:p.date, origin:p.origin, driveId:p.driveId, url:p.url}]));
  D.pots = state.pots; D.done = state.meta.importNotes?.done || [];
  MIXES = state.mixes.slice().sort((a,b)=>a.name.localeCompare(b.name));
  if(!MIXES.length) MIXES = DEFAULT_MIXES;
  const st = state.meta.settings; if(st && st.jobs){ JOBS=st.jobs; COMBOS=st.combos||[]; applyJobs(); }
  S.ticks = {}; LOGS.forEach(l=>{ if(l.flags.includes('tick')) S.ticks[l.id]='tick'; });
}
let raf=0;
export function refresh(){ if(S.view==='import'&&S.importing) return; cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ sync(); if(!document.querySelector('#layer .sheet')) render(); else if(S.view!=='tree'||byId[S.tree]) render(); }); }

let qTimer;
document.addEventListener('input', e=>{
  if(e.target.id==='q'){ clearTimeout(qTimer); const pos=e.target.selectionStart; qTimer=setTimeout(()=>{ S.q=e.target.value; render(); const q=$('#q'); if(q){q.focus(); q.setSelectionRange(pos,pos);} },180); }
  if(e.target.id==='lgnote') LG.note=e.target.value;
  if(e.target.dataset.jlabel){ JOBS[+e.target.dataset.jlabel].label=e.target.value||'Untitled job'; saveJobs(); }
  if(e.target.dataset.clabel){ COMBOS[+e.target.dataset.clabel].label=e.target.value||'Shortcut'; saveJobs(); }
  if(e.target.id==='lgdate') LG.date=e.target.value;
  if(['cl','cw','ch','sc'].includes(e.target.id)){ S[e.target.id]=e.target.value; clearTimeout(qTimer); const id=e.target.id; qTimer=setTimeout(()=>{render(); const el=$('#'+id); if(el){el.focus();}},400); }
});
document.addEventListener('change', async e=>{
  if(e.target.id==='sort'){ S.sort=e.target.value; render(); }
  if(e.target.id==='lgmix') LG.mix=e.target.value;
  if(e.target.dataset.jkind){ JOBS[+e.target.dataset.jkind].kind=e.target.value; saveJobs(); keepScroll(renderSheet); }
  if(e.target.id==='cs'){ S.cs=e.target.value; render(); }
  if(e.target.id==='lgfiles'){ LG.fileObjs.push(...e.target.files); keepScroll(renderSheet); }
  if(e.target.dataset.addphoto){
    const tid=e.target.dataset.addphoto, files=[...e.target.files]; toast(`Saving ${files.length} photo${files.length>1?'s':''}…`);
    try{ const ids = await addPhotos(files, {trees:[tid]}); await setTreePhotos(tid, [...ids, ...(byId[tid]?.photos||[])]); toast(`Added ${ids.length} photo${ids.length>1?'s':''}`); }catch(err){ toast('Could not add photo: '+err.message); }
  }
  if(e.target.dataset.potphoto){
    const pid=e.target.dataset.potphoto; const ids = await addPhotos([...e.target.files], {}); const p=D.pots.find(x=>x.id===pid); await saveRecord('pots', {...p, photos:[...ids, ...(p.photos||[])]}); toast('Photo added');
  }
});
async function openLightbox(id){
  const p=PH[id]; if(!p) return;
  const lb=document.createElement('div'); lb.className='lightbox';
  lb.innerHTML=`<div><img src="${p.src}" alt=""><p>${p.date?fmtD(p.date):esc(p.origin||'')} · tap to close</p></div>`;
  document.body.appendChild(lb);
  if(p.driveId && navigator.onLine){ try{ const u = await fileUrl(p.driveId); const img=lb.querySelector('img'); if(img) img.src=u; }catch(err){ /* thumbnail is fine */ } }
}
document.addEventListener('click', async e=>{
  const c = e.target.closest('[data-fsave],[data-fjob],[data-ftree],[data-delentry],[data-restore],[data-edittree],[data-editpot],[data-editmix],[data-editentry],[data-drive],[data-backup],[data-signout],[data-runimport],[data-ahead],[data-jobsed],[data-combo],[data-jhide],[data-jadd],[data-cadd],[data-cdel],[data-layout],[data-tick],[data-close],[data-nav],[data-tree],[data-back],[data-tab],[data-group],[data-log],[data-zoom],[data-hact],[data-more],[data-mix],[data-lgt],[data-lga],[data-lgf],[data-lgall],[data-lgnone],[data-lgsave],.lightbox');
  if(!c) return;
  const d = c.dataset;
  if(c.classList.contains('lightbox')){ c.remove(); return; }
  if('close' in d){ if(e.target===c || c.tagName==='BUTTON'){ $('#layer').innerHTML=''; FORM=null; } return; }
  if('fjob' in d){ const a=FORM.value.actions=FORM.value.actions||[]; const i=a.indexOf(d.fjob); i>=0?a.splice(i,1):a.push(d.fjob); c.setAttribute('aria-pressed', i<0); return; }
  if('ftree' in d){ const a=FORM.value.used=FORM.value.used||[]; const i=a.indexOf(d.ftree); i>=0?a.splice(i,1):a.push(d.ftree); c.setAttribute('aria-pressed', i<0); return; }
  if('fsave' in d){ const v=readForm(); if(FORM.value.actions) v.actions=FORM.value.actions; if(FORM.value.used) v.used=FORM.value.used; c.disabled=true; try{ const err=await FORM.onSave(v); if(err){ FORM.value=v; FORM.err=err; renderForm(); return; } $('#layer').innerHTML=''; FORM=null; }catch(err){ FORM.value=v; FORM.err='Could not save: '+err.message; renderForm(); } return; }
  if('delentry' in d){ await deleteLog(d.delentry); $('#layer').innerHTML=''; FORM=null; toast('Moved to the recycle bin'); return; }
  if('restore' in d){ await restoreLog(d.restore); toast('Restored'); return; }
  if('edittree' in d){ editTree(d.edittree||null); return; }
  if('editpot' in d){ editPot(d.editpot||null); return; }
  if('editmix' in d){ editMix(d.editmix===''?null:+d.editmix); return; }
  if('editentry' in d){ editEntry(d.editentry); return; }
  if('drive' in d){ try{ await getToken(true); toast('Google Drive connected'); render(); flushPending(); }catch(err){ toast('Drive not connected: '+err.message); } return; }
  if('backup' in d){ c.disabled=true; c.textContent='Backing up…'; try{ const day=await backupNow(true); toast('Backup saved to Drive ('+day+')'); }catch(err){ toast('Backup failed: '+err.message); } render(); return; }
  if('signout' in d){ await signOut(); location.reload(); return; }
  if('runimport' in d){
    const j=$('#impJson').files[0], z=[...$('#impZip').files], out=$('#impStatus');
    if(!j){ out.textContent='Choose the records file (.json) first.'; out.style.color='var(--rust)'; return; }
    c.disabled=true; out.style.color=''; S.importing=true;
    try{ await getToken(true); }catch(err){ out.textContent='Google Drive permission is needed for the photos: '+err.message; c.disabled=false; return; }
    try{ const r = await runImport(j, z, (msg,a,b)=>{ out.textContent = msg + (b?` ${a} of ${b}`:''); }); S.importResult=`Done: ${r.trees} trees, ${r.logs} history entries, ${r.photos} photos${r.failed?` (${r.failed} photos failed – run the import again to retry)`:''}.`; out.textContent=S.importResult; }
    catch(err){ S.importResult='Import stopped: '+err.message+'. Run it again to continue.'; out.textContent=S.importResult; out.style.color='var(--rust)'; }
    S.importing=false; refresh(); c.disabled=false; return;
  }
  if('lgt' in d){ LG.trees.has(d.lgt)?LG.trees.delete(d.lgt):LG.trees.add(d.lgt); LG.err=''; const sc=$('.picker').scrollTop, ss=$('.sheet').scrollTop; renderSheet(); $('.picker').scrollTop=sc; $('.sheet').scrollTop=ss; return; }
  if('lga' in d){ LG.acts.has(d.lga)?LG.acts.delete(d.lga):LG.acts.add(d.lga); LG.err=''; keepScroll(renderSheet); return; }
  if('lgf' in d){ LG.filter=d.lgf; keepScroll(renderSheet); return; }
  if('lgall' in d){ document.querySelectorAll('[data-lgt]').forEach(b=>LG.trees.add(b.dataset.lgt)); keepScroll(renderSheet); return; }
  if('lgnone' in d){ LG.trees.clear(); keepScroll(renderSheet); return; }
  if('lgsave' in d){ saveLog(); return; }
  if('jobsed' in d){ LG.editing=!LG.editing; keepScroll(renderSheet); return; }
  if('combo' in d){ const cb=COMBOS.find(x=>x.id===d.combo); cb.jobs.forEach(j=>LG.acts.add(j)); LG.err=''; keepScroll(renderSheet); return; }
  if('jhide' in d){ const j=JOBS[+d.jhide]; j.hidden=!j.hidden; saveJobs(); keepScroll(renderSheet); return; }
  if('jadd' in d){ JOBS.push({id:'c'+Date.now(), label:'New job', kind:'note', hidden:false}); saveJobs(); keepScroll(renderSheet); setTimeout(()=>{const ins=document.querySelectorAll('[data-jlabel]'); const el=ins[ins.length-1]; el.focus(); el.select();},30); return; }
  if('cadd' in d){ if(LG.acts.size<2){ toast('Tick two or more jobs first, then save them as a shortcut'); return; } COMBOS.push({id:'cb'+Date.now(), label:[...LG.acts].map(a=>ACT[a].label).join(' + '), jobs:[...LG.acts]}); saveJobs(); keepScroll(renderSheet); return; }
  if('cdel' in d){ COMBOS.splice(+d.cdel,1); saveJobs(); keepScroll(renderSheet); return; }
  if('layout' in d){ S.layout=d.layout; try{localStorage.setItem('gt-layout',S.layout);}catch(err){} render(); return; }
  if('ahead' in d){ S.ahead=+d.ahead; render(); return; }
  if('tick' in d){ const l=LOGS.find(x=>x.id===d.tick); const flags=(l.flags||[]).filter(f=>!['tick','bulk','confirmed'].includes(f)).concat(d.val==='tick'?['tick']:['confirmed']); setLogFlags(d.tick, flags); return; }
  if('log' in d){ openLog(d.log||null); return; }
  if('zoom' in d){ openLightbox(d.zoom); return; }
  if('nav' in d){ S.q=''; S.group='all'; go(d.nav); return; }
  if('tree' in d){ S.newLog=null; go('tree',{tree:d.tree, tab:'info'}); return; }
  if('back' in d){ go(byId[S.tree]?.status==='past'?'past':'trees'); return; }
  if('tab' in d){ S.tab=d.tab; S.newLog=null; render(); return; }
  if('group' in d){ S.group=d.group; render(); return; }
  if('hact' in d){ S.histAct=d.hact; S.histLimit=60; render(); return; }
  if('more' in d){ S.histLimit=(S.histLimit||60)+80; render(); return; }
  if('mix' in d){ S.mix=+d.mix; render(); return; }
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ $('#layer').innerHTML=''; FORM=null; document.querySelector('.lightbox')?.remove(); } });

export function startApp(){
  sync(); render();
  onChange(refresh);
  window.addEventListener('online', ()=>{ refresh(); flushPending(); maybeWeeklyBackup(); });
  window.addEventListener('offline', refresh);
  setTimeout(async ()=>{ const n = await flushPending(); if(n) toast(`${n} photo${n>1?'s':''} uploaded`); const b = await maybeWeeklyBackup(); if(b) toast('Weekly backup saved to Drive'); }, 4000);
}
