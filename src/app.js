
import { state, onChange, addLogs, editLog, deleteLog, restoreLog, setLogFlags, saveRecord, saveMeta, newId, setTreePhotos, savePhoto } from './store.js';
import { addPhotos, flushPending, pendingCount, localFull } from './photos.js';
import { fileUrl, getToken, driveConnected, listBackups } from './drive.js';
import { backupNow, maybeWeeklyBackup } from './backup.js';
import { runImport } from './importer.js';
import { signOut, auth } from './firebase.js';
import { TIPS, NOTES, COLLECTION } from './knowledge.js';
import { GUIDE, CALS, calOf, AZ_AFTER, repotWin, autumnWin, evMin, addMonths, makeJobs, tickTitle } from './jobs.js';

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
  prune:{label:'Light prune', icon:'scissors'}, hard:{label:'Hard prune', icon:'cutter'},
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
const KIND_ICON = {prune:'scissors',hard:'cutter',root:'roots',repot:'pot',wire:'wire',unwire:'wire',defol:'leaf',style:'brush',fert:'drop',fung:'shield',insect:'bug',note:'eye'};
let JOBS = ['prune','hard','root','repot','wire','unwire','defol','style','fert','fung','insect','note'].map(id=>({id, label:ACT[id].label, kind:id, hidden:false}));
let COMBOS = [{id:'cb1', label:'Repot + root prune', jobs:['repot','root']}, {id:'cb2', label:'Prune & wire', jobs:['prune','wire']}, {id:'cb3', label:'Full workover', jobs:['hard','root','repot']}];
function applyJobs(){ JOBS.forEach(j=>{ ACT[j.id] = {label:j.label, icon:KIND_ICON[j.kind]||'eye', kind:j.kind}; }); }
let jobsTimer; function saveJobs(){ applyJobs(); clearTimeout(jobsTimer); jobsTimer=setTimeout(()=>saveMeta('settings',{jobs:JOBS, combos:COMBOS}),600); }
applyJobs();
const kindOf = a => (ACT[a] && ACT[a].kind) || a;

/* --- Season guidance: draft for Brisbane (subtropical, SE Qld). Months 1-12. --- */
const SEASONS = [['Summer',[12,1,2]],['Autumn',[3,4,5]],['Winter',[6,7,8]],['Spring',[9,10,11]]];
const TASKS = {repot:{label:'Repot', c:'var(--wire)'}, struct:{label:'Hard / structural prune', c:'#7A5A2E'}, prune:{label:'Trim new growth', c:'var(--moss)'},
  wire:{label:'Wire', c:'var(--glaze)'}, defol:{label:'Defoliate / decandle', c:'#8C9A3A'}, clean:{label:'Clean / needle work', c:'#9C7FB0'}, potash:{label:'Liquid potash', c:'#C2577A'}, fert:{label:'Feed', c:'#6E8FA0'}, autumn:{label:'Autumn option', c:'var(--wire)'}};
/* already set up in Nathan's TickTick "Bonsai" list (recurring, Saturdays 8am) */
const ROUTINES = [
  {name:'Fertilise Bonsai', every:'Every 2nd Saturday', icon:'drop', first:'2026-10-03', weeks:2},
  {name:'Spray Maverick (insecticide)', every:'Every 4 weeks', icon:'bug', first:'2026-10-10', weeks:4},
  {name:'Spray Mancozeb (fungicide)', every:'Every 4 weeks', icon:'shield', first:'2026-10-24', weeks:4}
];
function routineDates(r, y, m){ const out=[]; let d=parseD(r.first); while(d.getFullYear()<y || (d.getFullYear()===y && d.getMonth()<m-1)) d.setDate(d.getDate()+7*r.weeks); while(d.getFullYear()===y && d.getMonth()===m-1){ out.push(new Date(d)); d.setDate(d.getDate()+7*r.weeks);} return out; }
function nextSat(){const d=new Date(TODAY);d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));return 'Next: Sat '+d.getDate()+' '+MONTHS[d.getMonth()];}

/* --- helpers --- */
const evText = t => t.every ? t.every[0]+'–'+t.every[1]+' years' : ((n=>n===1?'year':n+' years')((GUIDE[t.group]||GUIDE.other).every));
const photo = id => PH[id] ? PH[id].src : null;
// Tree photo: the one you pinned, otherwise the most recent dated photo
let PDATE = {};
function coverId(t){
  const ps=(t.photos||[]).filter(id=>PH[id]);
  if(t.cover && PH[t.cover]) return t.cover;
  let best=null, bd='';
  for(const id of ps){ const d=PH[id].date||PDATE[id]||''; if(!best || d>bd){ best=id; bd=d; } }
  return best;
}
function cover(t){ const id=coverId(t); return id ? photo(id) : null; }
function thumb(t, cls='thumb'){ const c = cover(t); return c ? `<img class="${cls}" src="${c}" alt="" loading="lazy">` : `<div class="${cls} ph">${ico('tree')}</div>`; }
function parseD(s){ if(!s) return null; const p=s.split('-').map(Number); return new Date(p[0], (p[1]||1)-1, p[2]||15); }
function fmtD(s, prec){ if(!s) return 'Date unknown'; if(String(s).length===4) return String(s); const d=parseD(s); return (prec==='month'||s.length===7) ? MONTHS_L[d.getMonth()]+' '+d.getFullYear() : d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear(); }
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
  const inWindow = repotWin(t).includes(NOW_M), inAutumn = autumnWin(t).includes(NOW_M);
  let cls='ok', text='Next repot '+MONTHS[next.getMonth()]+' '+next.getFullYear();
  if(months<=0){ cls = inWindow ? 'due' : 'late'; text = inWindow ? 'Repot due now' : inAutumn ? 'Repot overdue · autumn option open (light root work)' : 'Repot due (next window)'; }
  return {cls, text, due: months<=0 && inWindow, last, next};
}
function sourcePills(l){
  const map = {'Bonsai Album':'Album','Care App':'Care App','2003–2010 spreadsheet':'2003–10 sheet','Graytrees':'GraytTrees'};
  return l.sources.map(s => `<span class="pill src">${esc(map[s]||s)}</span>`).join('') + ((l.flags||[]).includes('confirmed') ? `<span class="pill ok">Confirmed repot</span>` : '') + (l.flags && (l.flags.includes('bulk')||l.flags.includes('tick')) ? (S.ticks[l.id]==='real' ? `<span class="pill ok">Confirmed repot</span>` : S.ticks[l.id]==='tick' ? `<span class="pill unc">Reminder tick – not counted</span>` : `<span class="pill unc" title="Same-day tick on many trees in the Care App">Unconfirmed tick</span>`) : '');
}
function actChips(l){ return l.actions.map(a => `<span class="act ${kindOf(a)}">${ico(ACT[a]?.icon||'eye')}${esc(ACT[a]?.label||a)}</span>`).join(''); }

/* --- state --- */
const S = { view:'trees', tree:null, tab:'info', q:'', group:'all', sort:'name', histAct:'all', review:{}, notes:{}, ticks:{}, toast:null, newLog:null, layout:'cards' };
try{ S.layout = localStorage.getItem('gt-layout') || 'cards'; }catch(e){}
function textSize(){ try{ return localStorage.getItem('gt-fs') || '1.12'; }catch(e){ return '1.12'; } }
export function setTextSize(v){ try{ if(v) localStorage.setItem('gt-fs', v); }catch(e){} document.documentElement.style.setProperty('--fs', v || textSize()); }
setTextSize();
function go(view, opts={}){ Object.assign(S, {view}, opts); sync(); render(); window.scrollTo({top:0}); }

/* --- search header --- */
function header(placeholder='Search trees, species, history…'){
  return `<div class="topbar"><div class="brand"><div class="seal" aria-hidden="true">GT</div><b>GraytTrees</b></div>
  <label class="search">${ico('search')}<input id="q" type="search" placeholder="${placeholder}" value="${esc(S.q)}" aria-label="Search"></label></div>`;
}
function proto(){
  if(!state.ready.trees) return `<div class="proto">${ico('history')}<div>Loading your records…</div></div>`;
  if(!TREES.length) return `<div class="card" style="padding:18px;margin-bottom:14px"><h2 style="font-size:calc(22px*var(--fs))">Welcome to GraytTrees</h2><p class="muted">Your collection is empty. Load your merged records (from Bonsai Album, the Care App and the 2003–2010 sheet) to get started.</p><button class="btn" data-nav="import">${ico('archive')}Import my records</button></div>`;
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
  ${(()=>{ const b=state.meta.backup, days=b?.lastMs?Math.floor((Date.now()-b.lastMs)/864e5):null; return past||(days!==null&&days<=8) ? '' : `<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:180px">${ico('archive')} <b>${days===null?'No backup yet':'Last backup '+days+' days ago'}</b><span class="muted" style="display:block;font-size:calc(14px*var(--fs))">The weekly backup to Drive hasn't run${state.meta.backupError?' ('+esc(state.meta.backupError)+')':''}.</span></span><button class="btn small" data-backup>${ico('archive')}Back up now</button></div>`; })()}
  <section class="season" aria-label="This month">${ukiyoBand()}
    <div><span class="eyebrow">${MONTHS_L[NOW_M-1]} in Brisbane · ${SEASONS.find(s=>s[1].includes(NOW_M))[0].toLowerCase()}</span>
      <h2 style="margin-top:4px">${due.length ? due.length+' tree'+(due.length>1?'s':'')+' ready to repot' : 'No trees need repotting yet'}</h2>
      ${due.length?'':`<p class="muted" style="margin:8px 0 0;font-size:calc(15px*var(--fs))">Each species has a repot interval (pines every 3 years, elms and figs every 2). None of your trees have reached theirs yet.</p>`}
      <p class="muted" style="margin:8px 0 0;font-size:calc(15px*var(--fs))">Good work this month: ${workNow.slice(0,4).map(w=>`<b style="color:var(--ink)">${esc(w[0])}</b> ${esc(w[1].join(', ').toLowerCase())}`).join(' · ')}.</p>
      <button class="btn ghost small" style="margin-top:12px" data-nav="season">${ico('season')}Open season calendar</button></div>
    <div class="due-list">${due.length ? due.slice(0,5).map(({t,r})=>`<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:calc(14px*var(--fs))">Last repot ${r.last?fmtD(r.last.date):'—'} · every ${evText(t)} yrs</span></span><span class="pill due">Due</span></button>`).join('') : `<span class="eyebrow">Next repots coming up</span>${upcoming.map(({t,r})=>`<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:calc(14px*var(--fs))">Last repot ${fmtD(r.last.date)} · every ${evText(t)} yrs</span></span><span class="pill ok num">${MONTHS[r.next.getMonth()]} ${r.next.getFullYear()}</span></button>`).join('')}`}</div>
  </section>`) + `
  <div class="section-h"><h2>${past?'':'Collection'}</h2><div class="row">${past?'':`<button class="btn small" data-edittree="">${ico('plus')}Add tree</button>`}
    <div class="seg" role="group" aria-label="Layout">${[['cards','Cards'],['gallery','Gallery'],['list','List']].map(([k,l])=>`<button data-layout="${k}" aria-pressed="${S.layout===k}">${l}</button>`).join('')}</div>
    <span class="row" style="gap:8px;flex-wrap:nowrap"><label class="muted" for="sort" style="font-size:calc(14px*var(--fs))">Sort</label>
    <select id="sort" class="chip"><option value="name"${S.sort==='name'?' selected':''}>A–Z</option><option value="recent"${S.sort==='recent'?' selected':''}>Recently worked</option></select></span></div></div>
  <div class="chips" role="group" aria-label="Filter by species">${GROUPS.map(([k,l])=>`<button class="chip" data-group="${k}" aria-pressed="${S.group===k}">${l}</button>`).join('')}</div>
  <p class="muted num" style="font-size:calc(14px*var(--fs));margin:10px 0">${list.length} ${past?'past':''} tree${list.length===1?'':'s'}${S.q?` matching “${esc(S.q)}”`:''}</p>
  ${!list.length ? '<div class="empty">No trees match.</div>' : S.layout==='gallery' ? `<div class="gallery">${list.map(t=>galleryTile(t)).join('')}</div>` : S.layout==='list' ? `<div class="card tlist">${list.map(t=>listRow(t)).join('')}</div>` : `<div class="grid">${list.map(t=>treeCard(t)).join('')}</div>`}
  ${histHits.length?`<div class="section-h"><h2>In history</h2></div>${histHits.map(l=>entry(l,true)).join('')}`:''}`;
}
function treeCard(t){
  const lr = lastOf(t.id,['repot']), lp = lastOf(t.id,['prune','hard']), r = t.status==='past'?null:repotStatus(t);
  const age = years(t.plantDate && t.plantDate.length===4 ? t.plantDate+'-06-01' : t.plantDate);
  return `<button class="tcard" data-tree="${t.id}">${thumb(t)}<span class="body">
    <h3>${esc(t.name)}</h3>
    <span style="font-size:calc(15px*var(--fs))">${esc(t.common||'')}${t.scientific?` · <span class="sci">${esc(t.scientific)}</span>`:''}</span>
    <span class="muted" style="font-size:calc(14px*var(--fs))">${[t.style, age!=null?age+' yrs old':null, t.status==='past'&&t.fate?t.fate:null].filter(Boolean).map(esc).join(' · ')}</span>
    <span class="muted" style="font-size:calc(14px*var(--fs))">${lr?'Repotted '+fmtD(lr.date, lr.precision):''}${lr&&lp?'<br>':''}${lp?'Pruned '+fmtD(lp.date, lp.precision):''}</span>
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
      ${t.scientific?`<p class="sci" style="margin:6px 0 0;font-size:calc(19px*var(--fs))">${esc(t.scientific)}</p>`:''}
      <div class="row" style="margin-top:12px">${t.style?`<span class="chip">${esc(t.style)}</span>`:''}${age!=null?`<span class="chip num">${age} years old</span>`:''}${t.acquired?`<span class="chip num">Yours since ${parseD(t.acquired).getFullYear()}</span>`:''}${t.stage?`<span class="chip">${esc(t.stage)}</span>`:''}</div>
      <div class="facts">
        <div class="fact"><span class="k">${ico('pot')}Last repot</span><div class="v num">${lr?fmtD(lr.date,lr.precision).replace(/^\d+ /,''):'—'}</div><div class="s muted">${lr?ago(lr.date):''}</div></div>
        <div class="fact"><span class="k">${ico('scissors')}Last prune</span><div class="v num">${lp?fmtD(lp.date,lp.precision).replace(/^\d+ /,''):'—'}</div><div class="s muted">${lp?ago(lp.date):''}</div></div>
        <div class="fact"><span class="k">${ico('wire')}Last wired</span><div class="v num">${lw?fmtD(lw.date,lw.precision).replace(/^\d+ /,''):'—'}</div><div class="s muted">${lw?ago(lw.date):''}</div></div>
        <div class="fact"><span class="k">${ico('history')}On record</span><div class="v num">${L.length} entries</div><div class="s muted">since ${L.length?parseD(L[L.length-1].date).getFullYear():'—'}</div></div>
      </div>
      ${r?`<p style="margin:14px 0 0"><span class="pill ${r.cls}">${esc(r.text)}</span> <span class="muted" style="font-size:calc(14px*var(--fs))">Repot every ${evText(t)}${t.every?' (older, larger tree)':' for '+esc(GUIDE[t.group].name.toLowerCase())}</span></p>`:''}
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
      ${showTree?`<div style="margin-bottom:6px">${l.trees.map(id=>`<button class="tree-link" data-tree="${id}">${esc(byId[id]?.name||id)}</button>`).join(', ')} <span class="muted num" style="font-size:calc(14px*var(--fs))">· ${d?d.getFullYear():''}</span></div>`:''}
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
function tabHistory(t,L){ return L.length ? `<p class="muted" style="font-size:calc(15px*var(--fs));margin-top:0">Every entry from Bonsai Album, the Care App and your 2003–2010 spreadsheet. Where two apps recorded the same job, they're shown as one entry and the original wording is kept underneath.</p>`+byYear(L,false) : '<div class="empty">No history yet.</div>'; }
function tabPhotos(t){
  const ps = t.photos.map(id=>({id,...PH[id]})).filter(p=>p.src);
  const dated = LOGS.reduce((m,l)=>{(l.photos||[]).forEach(p=>m[p]=m[p]||l.date);return m;},{});
  return compareBlock(t, ps, dated) + `<div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="muted num">${ps.length} photos</span>
    <label class="btn small">${ico('cam')}Add photo<input type="file" accept="image/*" multiple hidden data-addphoto="${t.id}"></label></div>
    ${ps.length?`<div class="pgrid">${ps.map(p=>`<figure><img src="${p.src}" alt="" loading="lazy" data-zoom="${p.id}"><figcaption class="num">${p.date||dated[p.id]?fmtD(p.date||dated[p.id]):(p.origin==='Bonsai Album'?'Bonsai Album':'Old plant list')}</figcaption></figure>`).join('')}</div>`:'<div class="empty">No photos yet.</div>'}`;
}
/* woodblock-style band: Prussian-blue Fuji over a seigaiha sea, with a Brisbane-season motif */
function ukiyoBand(m=NOW_M){
  const season = [12,1,2].includes(m)?'summer':[3,4,5].includes(m)?'autumn':[6,7,8].includes(m)?'winter':'spring';
  const blossom = (x,y,r)=>[0,72,144,216,288].map(a=>`<circle cx="${(x+Math.cos(a*Math.PI/180)*r).toFixed(1)}" cy="${(y+Math.sin(a*Math.PI/180)*r).toFixed(1)}" r="${(r*0.75).toFixed(1)}"/>`).join('')+`<circle cx="${x}" cy="${y}" r="${(r*0.45).toFixed(1)}" fill="#F7E3A1"/>`;
  const leaf = (x,y,s,rot)=>`<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 -10 L2.5 -3 L9 -5 L4.5 1 L7 7 L1 4 L0 10 L-1 4 L-7 7 L-4.5 1 L-9 -5 L-2.5 -3 Z"/>`;
  const motif = {
    spring:`<g fill="#E9A3B4">${blossom(70,22,4)}${blossom(112,40,3)}${blossom(160,18,3.5)}${blossom(236,30,2.6)}</g>`,
    summer:`<circle cx="250" cy="26" r="13" fill="#C8412F"/>`,
    autumn:`<g fill="#C8612F">${leaf(80,24,1,10)}${leaf(130,42,.8,-25)}${leaf(196,20,.9,40)}${leaf(250,36,.7,-10)}</g>`,
    winter:`<g fill="#FFFFFF" opacity=".9">${[[60,14],[96,30],[140,12],[180,38],[222,20],[268,32],[318,12]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g>`}[season];
  return `<div class="ukiyo" aria-hidden="true"><svg viewBox="0 0 600 76" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
    <defs><pattern id="sgh" width="24" height="12" patternUnits="userSpaceOnUse"><g fill="var(--ukiyo-bg)" stroke="var(--prussian)" stroke-width=".9" opacity=".55">
      <circle cx="0" cy="12" r="11"/><circle cx="0" cy="12" r="7"/><circle cx="0" cy="12" r="3"/><circle cx="24" cy="12" r="11"/><circle cx="24" cy="12" r="7"/><circle cx="24" cy="12" r="3"/>
      <circle cx="12" cy="18" r="11"/><circle cx="12" cy="18" r="7"/><circle cx="12" cy="18" r="3"/></g></pattern></defs>
    <rect width="600" height="76" fill="var(--ukiyo-bg)"/>${motif}
    <path d="M330 76 L455 18 L479 18 L600 70 L600 76 Z" fill="var(--prussian)"/>
    <path d="M436 27 L455 18 L479 18 L499 28 L488 26 L478 33 L469 25 L458 32 L449 26 Z" fill="#F7F4EC"/>
    <rect y="56" width="600" height="20" fill="url(#sgh)"/>
  </svg></div>`;
}
/* before / after comparison: oldest vs newest dated photo, either side changeable */
function compareBlock(t, ps, dated){
  const when = p => p.date || dated[p.id] || '';
  const ds = ps.filter(when).sort((a,b)=>when(a).localeCompare(when(b)));
  if(ds.length<2) return '';
  const c = (S.cmp && S.cmp.tree===t.id) ? S.cmp : {tree:t.id, a:ds[0].id, b:ds[ds.length-1].id, pick:null};
  const A = ds.find(p=>p.id===c.a)||ds[0], B = ds.find(p=>p.id===c.b)||ds[ds.length-1];
  const yrs = Math.round((parseD(when(B))-parseD(when(A)))/3.15576e10*10)/10;
  const strip = side => `<div class="cmp-strip" role="group" aria-label="Choose the ${side==='a'?'before':'after'} photo">${ds.map(p=>`<button data-cmp${side}="${p.id}" aria-pressed="${(side==='a'?A:B).id===p.id}"><img src="${p.src}" alt="" loading="lazy"><span class="num">${fmtD(when(p)).replace(/^\d+ /,'')}</span></button>`).join('')}</div>`;
  return `<div class="card cmp" data-cmptree="${t.id}">
    <div class="row" style="justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:10px"><b style="font-size:calc(17px*var(--fs))">Before and after</b><span class="muted num" style="font-size:calc(14px*var(--fs))">${yrs>=1?yrs+' years':Math.max(1,Math.round(yrs*12))+' months'} apart</span></div>
    <div class="cmp-stage" style="--x:50%">
      <img class="cmp-b" data-id="${B.id}" src="${B.src}" alt="After, ${esc(fmtD(when(B)))}" ${B.driveId?`data-full="${B.driveId}"`:''}>
      <img class="cmp-a" data-id="${A.id}" src="${A.src}" alt="Before, ${esc(fmtD(when(A)))}" ${A.driveId?`data-full="${A.driveId}"`:''}>
      <span class="cmp-line" aria-hidden="true"></span>
      <span class="cmp-lab l num">${esc(fmtD(when(A)))}</span><span class="cmp-lab r num">${esc(fmtD(when(B)))}</span>
    </div>
    <input type="range" min="0" max="100" value="50" data-cmpx aria-label="Slide between before and after">
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="chip" data-cmppick="a" aria-pressed="${c.pick==='a'}">Change before</button>
      <button class="chip" data-cmppick="b" aria-pressed="${c.pick==='b'}">Change after</button>
      <button class="chip" data-cmpswap>Swap</button>
      ${(c.a!==ds[0].id||c.b!==ds[ds.length-1].id)?'<button class="chip" data-cmpreset>Oldest vs newest</button>':''}
    </div>
    ${c.pick?`<p class="muted" style="margin:10px 0 6px;font-size:calc(14px*var(--fs))">Tap a photo to use as the <b style="color:var(--ink)">${c.pick==='a'?'before':'after'}</b> picture, e.g. one taken from the same side.</p>${strip(c.pick)}`:''}
  </div>`;
}
async function upgradeCmp(){
  for(const img of document.querySelectorAll('.cmp-stage img[data-full]')){
    if(!navigator.onLine) return;
    try{ const u = await fileUrl(img.dataset.full); if(img.isConnected) img.src = u; }catch(e){ /* thumbnail is fine */ }
  }
}
function cmpMove(stage, clientX){ const r=stage.getBoundingClientRect(); const x=Math.max(0,Math.min(100,(clientX-r.left)/r.width*100)); stage.style.setProperty('--x',x+'%'); const rg=stage.parentElement.querySelector('[data-cmpx]'); if(rg) rg.value=Math.round(x); }
document.addEventListener('pointerdown', e=>{ const st=e.target.closest('.cmp-stage'); if(!st) return; st.setPointerCapture(e.pointerId); cmpMove(st,e.clientX); const mv=ev=>cmpMove(st,ev.clientX), up=()=>{st.removeEventListener('pointermove',mv);st.removeEventListener('pointerup',up);}; st.addEventListener('pointermove',mv); st.addEventListener('pointerup',up); });
const rowList = rows => Array.isArray(rows) ? rows : Object.entries(rows).map(([k,months])=>({k, label:TASKS[k].label, months}));
function calRows(rows, mine){
  return rowList(rows).map(({k,label,months})=>`<tr><th scope="row">${esc(label)}</th>${MONTHS.map((m,i)=>{const on=months.includes(i+1), prev=months.includes(i===0?12:i), next=months.includes(i===11?1:i+2);
    return `<td class="${i+1===NOW_M?'now':''}">${on?`<span class="bar${!prev||i===0?' s':''}${!next||i===11?' e':''}${k==='autumn'?' opt':''}" style="--k:${TASKS[k].c}"></span>`:''}</td>`;}).join('')}</tr>`).join('')
  + (mine?`<tr class="mine"><th scope="row" style="color:var(--wire)">Your repots</th>${MONTHS.map((m,i)=>{const n=mine[i+1]||0;return `<td class="${i+1===NOW_M?'now':''}">${n?`<span class="dot" style="width:${8+Math.min(n,12)*1.6}px;height:${8+Math.min(n,12)*1.6}px" title="${n} repot${n>1?'s':''}"></span>`:''}</td>`;}).join('')}</tr>`:'');
}
function calTable(rows, mine){
  const leg = `<div class="cal-legend">${[...new Set(rowList(rows).map(r=>r.k))].map(k=>`<span><i style="background:${TASKS[k].c}${k==='autumn'?';opacity:.35':''}"></i>${TASKS[k].label}</span>`).join('')}${mine?`<span><i style="background:var(--wire);width:9px;border-radius:50%"></i>Your repots</span>`:''}</div>`;
  return `<div class="cal">${leg}<table><thead><tr class="seas"><th></th>${MONTHS.map((m,i)=>{const s=SEASONS.find(s=>s[1].includes(i+1));return `<th style="${i+1===NOW_M?'color:var(--wire)':''}">${s[1][0]===i+1||i===0?s[0]:''}</th>`;}).join('')}</tr>
  <tr><th></th>${MONTHS.map((m,i)=>`<th class="${i+1===NOW_M?'now':''}">${m}</th>`).join('')}</tr></thead><tbody>${calRows(rows,mine)}</tbody></table></div>`;
}
const SHORT = {pine:'pines',elm:'elms',juniper:'junipers',fig:'figs',cler:'clerodendrums',swamp:'swamp cypress',podo:'Buddhist pine',mela:'melaleuca',bougie:'bougainvillea',azalea:'azaleas',african:'jaboticaba'};
function mergedRows(keys){
  const out=[];
  for(const task of ['repot','autumn',...Object.keys(TASKS).filter(x=>x!=='repot'&&x!=='autumn')]){
    const pats = new Map();
    keys.forEach(k=>{ const m=GUIDE[k].rows[task]; if(m&&m.length){ const id=[...m].sort((a,b)=>a-b).join(','); if(!pats.has(id)) pats.set(id,{months:m,who:[]}); pats.get(id).who.push(SHORT[k]); }});
    const all = pats.size===1 && [...pats.values()][0].who.length===keys.length;
    pats.forEach(p=>out.push({k:task, months:p.months, label: all||keys.length===1 ? TASKS[task].label : TASKS[task].label+' · '+p.who.join(', ')}));
  }
  return out;
}
function myRepotMonths(ids){ const m={}; LOGS.forEach(l=>{ if(l.actions.some(a=>kindOf(a)==='repot') && l.trees.some(id=>ids.includes(id)) && !(l.flags||[]).includes('bulk') && l.date){ const mm=+l.date.slice(5,7); m[mm]=(m[mm]||0)+1; }}); return m; }
function tabCal(t){
  const g = GUIDE[t.group]||GUIDE.other, c = calOf(t.group);
  const mine = myRepotMonths([t.id]);
  const rows = {...g.rows, ...(t.group==='azalea'?{repot:repotWin(t)}:{})};
  return `<p class="muted" style="margin-top:0;font-size:calc(15px*var(--fs))">Timing for ${esc(g.name.toLowerCase())} in Brisbane${c?', on your <b style="color:var(--ink)">'+esc(c.name)+'</b> calendar':''}${t.group==='azalea'?(t.azTiming==='after'?' (repotting after flowering)':' (repotting before flowering, flowers pinched off)'):''}. The orange dots show when you've actually repotted this tree.${t.autumn==='yes'?' <span class="pill unc">Flagged for autumn repot</span>':''}</p>
  ${Object.keys(rows).length?calTable(rows, mine):'<div class="empty">No guidance for this species yet.</div>'}
  ${NOTES[t.group]?`<div class="card" style="padding:16px;margin-top:12px"><span class="eyebrow">Care notes</span><ul class="done-list" style="margin-top:8px">${NOTES[t.group].map(n=>`<li>${ico('leaf')}<span>${esc(n)}</span></li>`).join('')}</ul><p class="muted" style="font-size:calc(13px*var(--fs));margin:8px 0 0">From your monthly calendar and the Red Dragon newsletters</p></div>`:''}`;
}
function tabRem(t){
  const g = GUIDE[t.group]||GUIDE.other, r = t.status==='past'?null:repotStatus(t);
  return `<div class="more-list">
    ${r?`<button>${ico('pot')}<div>Repot every ${evText(t)}<span>${esc(r.text)}${r.last?' · last '+fmtD(r.last.date):''}</span></div></button>`:''}
    <button>${ico('scissors')}<div>Maintenance prune in season<span>${(g.rows.prune||g.rows.struct||[]).map(m=>MONTHS[m-1]).join(', ')||'—'}</span></div></button>
    <button>${ico('bell')}<div>Send to TickTick<span>Reminders will go to your Bonsai list in TickTick once the app is live</span></div></button>
  </div>`;
}

/* ---- monthly look-ahead: what falls due in a given month ---- */
const JC = () => makeJobs({trees:TREES, lastOf, today:TODAY});
const repotMonth = t => JC().repotMonth(t);
function lookahead(y,m){ return {...JC().month(y,m), routines: ROUTINES.map(r=>({r, dates:routineDates(r,y,m)}))}; }
function viewAhead(){
  const sel = S.ahead || 0, [y,m] = addMonths(TODAY.getFullYear(), NOW_M, sel), A = lookahead(y,m);
  const nItems = A.repots.length + A.opens.length + A.coll.length + A.autumn.length;
  return `<div class="section-h" style="margin-top:8px"><div><span class="eyebrow">Monthly look-ahead</span><h2>What falls due</h2></div></div>
  <div class="chips" role="group" aria-label="Month">${[0,1,2,3,4,5].map(i=>{const [yy,mm]=addMonths(TODAY.getFullYear(),NOW_M,i); const n=(()=>{const a=lookahead(yy,mm); return a.repots.length+a.opens.length+a.coll.length+a.autumn.length;})(); return `<button class="chip" data-ahead="${i}" aria-pressed="${sel===i}">${MONTHS[mm-1]}${yy!==TODAY.getFullYear()?' '+String(yy).slice(2):''} <span class="num muted">${n}</span></button>`;}).join('')}</div>
  <div class="ahead">
    <div class="card" style="padding:16px">
      <h3 style="font-size:calc(20px*var(--fs))">${MONTHS_L[m-1]} ${y}</h3>
      ${A.repots.length?`<span class="eyebrow" style="display:block;margin-top:12px">Repots due (${A.repots.length})</span>${A.repots.map(t=>{const l=lastOf(t.id,['repot']); return `<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:calc(14px*var(--fs))">${l?'Last repot '+fmtD(l.date,l.precision):'No repot on record'} · every ${evText(t)} yrs</span></span>${ico('pot')}</button>`;}).join('')}`:''}
      ${A.autumn.length?`<span class="eyebrow" style="display:block;margin-top:14px">Autumn repot option (${A.autumn.length}) · light root work only</span>${A.autumn.map(t=>{const l=lastOf(t.id,['repot']); return `<button class="due-item" data-tree="${t.id}">${thumb(t,'')}<span class="t"><b>${esc(t.name)}</b><span class="muted" style="font-size:calc(14px*var(--fs))">${t.autumn==='yes'?'Flagged by you':'Overdue'}${l?' · last repot '+fmtD(l.date,l.precision):''}</span></span><span class="pill unc">Optional</span></button>`;}).join('')}`:''}
      ${A.opens.length?`<span class="eyebrow" style="display:block;margin-top:14px">Seasons opening</span>${A.opens.map(o=>`<div class="due-item"><span class="ph" style="width:44px;height:44px;border-radius:10px;flex:none;background:${TASKS[o.task].c};color:#fff">${ico(o.task==='wire'?'wire':o.task==='defol'?'leaf':o.task==='potash'?'drop':o.task==='clean'?'chop':o.task==='struct'?'cutter':'scissors')}</span><span class="t"><b>${esc(tickTitle(o))}</b><span class="muted" style="font-size:calc(14px*var(--fs))">${o.trees.map(t=>esc(t.name)).slice(0,4).join(', ')}${o.trees.length>4?' and '+(o.trees.length-4)+' more':''}</span></span></div>`).join('')}`:''}
      ${A.coll.length?`<span class="eyebrow" style="display:block;margin-top:14px">Whole collection</span>${A.coll.map(c=>`<div class="due-item"><span class="ph" style="width:44px;height:44px;border-radius:10px;flex:none">${ico('tree')}</span><span class="t"><b>${esc(c)}</b></span></div>`).join('')}`:''}
      ${!nItems?'<p class="muted">Nothing new falls due this month. Routine feeding and spraying carry on.</p>':''}
      <span class="eyebrow" style="display:block;margin-top:14px">Already in your TickTick</span>
      ${A.routines.map(({r,dates})=>`<div class="due-item"><span class="ph" style="width:44px;height:44px;border-radius:10px;flex:none">${ico(r.icon)}</span><span class="t"><b>${esc(r.name)}</b><span class="muted num" style="font-size:calc(14px*var(--fs))">${dates.map(d=>'Sat '+d.getDate()).join(', ')||'—'}</span></span></div>`).join('')}
    </div>
    <div class="card tips" style="padding:16px">
      <span class="eyebrow">Advice for ${MONTHS_L[m-1]}</span>
      <p class="muted" style="font-size:calc(14px*var(--fs));margin:4px 0 6px">From your monthly calendar and the Red Dragon newsletters</p>
      ${(TIPS[m]||[]).map(x=>`<div class="tip"><b>${esc(x.t)}</b><p>${esc(x.x)}</p><span>${esc(x.s)}</span></div>`).join('')}
    </div>
    <div class="card tt" style="padding:16px">
      <span class="eyebrow">TickTick preview · ${sel===0?'this month':'arrives 1 '+MONTHS_L[m-1]+', 7am'}</span>
      <p class="muted" style="font-size:calc(14.5px*var(--fs));margin:6px 0 10px">One task in your <b style="color:var(--ink)">Bonsai</b> list, due the end of the month. Tick items off as you get to them.</p>
      <div class="tt-task"><span class="tt-box"></span><div style="min-width:0;flex:1"><b>Bonsai jobs – ${MONTHS_L[m-1]} ${y}</b><span>Due ${new Date(y,m,0).getDate()} ${MONTHS[m-1]} · ${nItems} checklist item${nItems===1?'':'s'}</span>
        <ul class="tt-list">${[...A.repots.map(t=>'Repot '+t.name), ...A.autumn.map(t=>'Autumn option: repot '+t.name+' (light root work)'), ...A.opens.map(o=>tickTitle(o)), ...A.coll].map(x=>`<li><span class="tt-box sm"></span>${esc(x)}</li>`).join('') || '<li class="muted">Nothing extra this month – routines continue</li>'}</ul>
        <span style="display:block;margin-top:8px">Notes: this month's advice (${(TIPS[m]||[]).map(x=>esc(x.t.toLowerCase())).join(', ')})</span></div></div>
    </div>
  </div>`;
}
function viewSeason(){
  const live = k => TREES.filter(t=>t.status!=='past'&&t.group===k);
  return header() + `<div class="ukiyo-wrap">${ukiyoBand()}</div>` + viewAhead() + `<div class="section-h"><div><span class="eyebrow">Brisbane · from your calendar &amp; Red Dragon</span><h2>Season calendar</h2></div></div>
  <div class="section-h" style="margin-top:14px"><h2 style="font-size:calc(19px*var(--fs))">Collection routines</h2></div>
  <div class="more-list">${ROUTINES.map(r=>{const nx=routineDates(r,TODAY.getFullYear(),NOW_M).find(d=>d>=new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()))||routineDates(r,...addMonths(TODAY.getFullYear(),NOW_M,1))[0]; return `<button>${ico(r.icon)}<div>${esc(r.name)}<span>${esc(r.every)} · next Sat ${nx?nx.getDate()+' '+MONTHS[nx.getMonth()]:''} · in TickTick</span></div></button>`;}).join('')}</div>
  ${CALS.map(c=>{ const keys=c.species.filter(k=>live(k).length); if(!keys.length) return ''; const ids=keys.flatMap(k=>live(k).map(t=>t.id)); const azAfter=keys.includes('azalea') && live('azalea').some(t=>t.azTiming==='after');
    const cs = S.calSp||{}, sel = c.id in cs ? cs[c.id] : c.def; const sp = sel && keys.includes(sel) ? sel : null;
    const rows = sp ? {...GUIDE[sp].rows, ...(sp==='azalea'&&azAfter?{repot:[...new Set([...GUIDE.azalea.rows.repot, ...AZ_AFTER])]}:{})} : mergedRows(keys).filter(r=>r.k==='repot'||r.k==='autumn');
    const ids2 = sp ? live(sp).map(t=>t.id) : ids;
    return `<div class="section-h"><h2 style="font-size:calc(20px*var(--fs))">${esc(c.name)} <span class="muted num" style="font-family:var(--body);font-size:calc(15px*var(--fs));font-weight:400">${ids.length} tree${ids.length>1?'s':''}</span></h2></div><p class="muted" style="margin:-4px 0 10px;font-size:calc(15px*var(--fs))">${esc(c.blurb)}${keys.includes('azalea')?' Azaleas: '+(azAfter?'some are set to repot after flowering (Oct–Nov).':'repotting before flowering means pinching off that spring\'s flowers; switch a tree to after-flowering on its edit screen.'):''}</p>
    ${keys.length>1?`<div class="chips" role="group" aria-label="${esc(c.name)} species"><button class="chip" data-calsp="${c.id}:" aria-pressed="${!sp}">Repot timing</button>${keys.map(k=>`<button class="chip" data-calsp="${c.id}:${k}" aria-pressed="${sp===k}">${esc(GUIDE[k].name)} <span class="num muted">${live(k).length}</span></button>`).join('')}</div>`:''}
    ${keys.length===1 ? calTable(GUIDE[keys[0]].rows, myRepotMonths(ids)) : calTable(rows, myRepotMonths(ids2))}
    ${sp?`<p class="muted" style="font-size:calc(14px*var(--fs));margin:6px 0 0">Repot every ${GUIDE[sp].every===1?'year':GUIDE[sp].every+' years'}${sp==='pine'?' (3–5 for the oldest)':''}.</p>`:''}`;}).join('')}
  <p class="muted" style="font-size:calc(14px*var(--fs))">The faint bars are the optional autumn window: urgent or overdue repots and second-flush pines, light root work only. Flag a tree for it on its edit screen.</p>`;
}

function viewHistory(){
  let L = LOGS;
  if(S.histAct!=='all') L = L.filter(l=>l.actions.some(a=>kindOf(a)===S.histAct));
  if(S.q) L = L.filter(l=>(l.text+' '+l.trees.map(id=>byId[id]?.name).join(' ')).toLowerCase().includes(S.q.toLowerCase()));
  const shown = L.slice(0, S.histLimit||60);
  const years = new Set(LOGS.map(l=>(l.date||'').slice(0,4)).filter(Boolean));
  return header('Search all history…') + `<div class="section-h"><div><span class="eyebrow">Every tree · every year</span><h2>History</h2></div><span class="muted num">${LOGS.length} entries · ${Math.min(...years)}–${Math.max(...years)}</span></div>
  <div class="chips" role="group" aria-label="Filter by job">${['all','repot','root','prune','hard','wire','fert','insect','fung','note'].map(k=>`<button class="chip" data-hact="${k}" aria-pressed="${S.histAct===k}">${k==='all'?'All jobs':ACT[k].label}</button>`).join('')}</div>
  <p class="muted num" style="font-size:calc(14px*var(--fs))">${L.length} matching</p>
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
    <h3 style="font-size:calc(19px*var(--fs))">${esc(x.name)}</h3>${ratioBar(x.parts)}
    <div class="ing">${Object.entries(x.parts).map(([k,v])=>`<span><i style="background:${ING[k][1]}"></i><b class="num">${v}</b> ${ING[k][0]}</span>`).join('')}</div>
    <span class="muted" style="font-size:calc(14px*var(--fs))">${esc(x.note)}</span>
    ${(x.used||[]).length?`<span style="font-size:calc(14px*var(--fs))">Used on: ${x.used.map(id=>esc(byId[id]?.name)).join(', ')}</span>`:''}${x.id?`<span><button class="btn ghost small" data-editmix="${i}">Edit</button></span>`:''}</div>`).join('')}</div>
  <div class="note" style="margin-top:12px"><b>Potting tips from your sheet:</b> pine bark uses up nitrogen as it breaks down, so add slow-release to the mix. Add zeolite to inorganic mixes to hold fertiliser. Aim to repot pines every 5 years.</div>
  <div class="section-h"><h2 style="font-size:calc(20px*var(--fs))">How much do I need?</h2><span class="muted">for ${esc(m.name)}</span></div>
  <div class="card" style="padding:16px;display:grid;gap:16px">
    <div class="calc">
      <label class="field"><span class="muted" style="font-size:calc(14px*var(--fs))">Pot shape</span><select id="cs"><option value="rect"${shape==='rect'?' selected':''}>Rectangle / square</option><option value="oval"${shape==='oval'?' selected':''}>Oval</option><option value="round"${shape==='round'?' selected':''}>Round</option></select></label>
      <label class="field"><span class="muted" style="font-size:calc(14px*var(--fs))">${shape==='round'?'Diameter':'Length'} (cm)</span><input id="cl" type="number" inputmode="decimal" value="${L}"></label>
      ${shape!=='round'?`<label class="field"><span class="muted" style="font-size:calc(14px*var(--fs))">Width (cm)</span><input id="cw" type="number" inputmode="decimal" value="${W}"></label>`:''}
      <label class="field"><span class="muted" style="font-size:calc(14px*var(--fs))">Depth (cm)</span><input id="ch" type="number" inputmode="decimal" value="${H}"></label>
      <label class="field"><span class="muted" style="font-size:calc(14px*var(--fs))">Your scoop (mL)</span><input id="sc" type="number" inputmode="decimal" value="${scoop}"></label>
    </div>
    <p style="margin:0">About <b class="num" style="font-size:calc(22px*var(--fs))">${vol.toFixed(1)} L</b> of mix <span class="muted" style="font-size:calc(14px*var(--fs))">(inside volume, less 10% for the root ball)</span></p>
    <div class="calc-out">${Object.entries(m.parts).map(([k,v])=>`<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${ING[k][1]};margin-right:8px"></i>${ING[k][0]}</span><b>${(vol*v/tot).toFixed(2)} L</b><b>${Math.max(0.5,Math.round(vol*v/tot*1000/scoop*2)/2)} scoops</b>`).join('')}</div>
  </div>`;
}

function viewPots(){
  const pots = D.pots.slice().sort((a,b)=>a.name.localeCompare(b.name));
  return header('Search pots…') + `<div class="section-h"><div><span class="eyebrow">${pots.length} recorded</span><h2>Pots</h2></div><button class="btn small" data-editpot="">${ico('plus')}Add pot</button></div>
  <div class="grid">${pots.filter(p=>!S.q||p.name.toLowerCase().includes(S.q.toLowerCase())).map(p=>`<button class="card pot" data-editpot="${p.id}" style="border:0;text-align:left">${p.photos&&p.photos.length&&photo(p.photos[0])?`<img class="thumb" src="${photo(p.photos[0])}" alt="">`:`<div class="thumb ph">${ico('pot')}</div>`}
    <div style="min-width:0"><h3 style="font-size:calc(17px*var(--fs));font-family:var(--body);font-weight:700">${esc(p.name)}</h3>
    <div class="muted" style="font-size:calc(14px*var(--fs))">${[p.shape,p.material,p.size?('Size '+p.size):'',p.glazed===true?'Glazed':p.glazed===false?'Unglazed':''].filter(Boolean).map(esc).join(' · ')}</div>
    <div style="font-size:calc(14px*var(--fs))">${[p.price?'$'+p.price:'',p.acquired?fmtD(p.acquired):'',p.source].filter(Boolean).map(esc).join(' · ')||'<span class="muted">'+esc(p.notes)+'</span>'}</div></div></button>`).join('')||'<div class="empty">No pots yet.</div>'}</div>`;
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
  <div class="section-h"><h2 style="font-size:calc(20px*var(--fs))">Decisions made with you</h2></div>
  <div class="card" style="padding:16px"><ul class="done-list">${(D.done||[]).map(x=>`<li>${ico('check')}<span>${esc(x)}</span></li>`).join('')||'<li class="muted">Nothing imported yet.</li>'}</ul></div>`;
}
function viewMore(){
  return header() + `<div class="section-h"><h2>More</h2></div><div class="more-list">
    <button data-nav="library">${ico('book')}<div>Library<span>${BOOKS().length?BOOKS().length+' books · do I own it? barcode check':'Your bonsai books'}</span></div></button>
    <button data-nav="pots">${ico('pot')}<div>Pots<span>${D.pots.length} recorded</span></div></button>
    <button data-nav="tools">${ico('scissors')}<div>Tools<span>${TOOLS().length?TOOLS().length+' tools · steel, care and what they cost':'Your bonsai tools'}</span></div></button>
    <button data-nav="mixes">${ico('mix')}<div>Soil mixes<span>Recipes and a pot volume calculator</span></div></button>
    <button data-nav="past">${ico('archive')}<div>Past trees<span>${TREES.filter(t=>t.status==='past').length} trees from 2003 onwards</span></div></button>
    <button data-nav="recycle">${ico('x')}<div>Recycle bin<span>${DELETED.length} deleted entr${DELETED.length===1?'y':'ies'} you can restore</span></div></button>
    <button data-nav="settings">${ico('shield')}<div>Settings &amp; backups<span>Text size · ${state.meta.backup?.lastDay?'Last backup '+fmtD(state.meta.backup.lastDay):'No backup yet'}</span></div></button>
    <button data-nav="how">${ico('eye')}<div>How it works<span>Where everything lives, making changes, getting things back</span></div></button>
    <button data-nav="review">${ico('question')}<div>Import notes<span>What was merged and how</span></div></button>
  </div>`;
}
/* "How it works" – visual maps of the setup (replaces reading docs/HOW-IT-WORKS.md) */
function mnode(icon, title, sub, kind='', tap=''){
  return `<div class="mnode ${kind}"${tap?` role="button" tabindex="0" data-nav="${tap}"`:''}><span class="mi">${ico(icon)}</span><span><b>${title}</b><span>${sub}</span></span></div>`;
}
const mdown = (label='') => `<div class="mdown" aria-hidden="true"><i></i>${label?`<em>${label}</em>`:''}</div>`;
function viewHow(){
  const b = state.meta.backup, last = b?.lastDay ? 'Last one '+fmtD(b.lastDay) : 'Not run yet';
  const live = TREES.filter(t=>t.status!=='past').length;
  return header() + `<div class="section-h"><div><span class="eyebrow">GraytTrees at a glance</span><h2>How it works</h2></div></div>
  <div class="map card">
    <h3>Where everything lives</h3>
    ${mnode('tree','Your devices','Fold, Tab and laptop. Works offline in the shed; changes sync when back in range.','k-you')}
    ${mdown()}
    ${mnode('leaf','GraytTrees app','graytrees.github.io/GraytTrees · only your Google account can sign in','k-app')}
    ${mdown('saves to')}
    <div class="mrow">
      ${mnode('archive','Records','Firebase (Sydney) · '+live+' trees, '+LOGS.length+' entries, pots, mixes','k-data')}
      ${mnode('cam','Google Drive','GraytTrees folder · full-size photos and the weekly backup ('+last.replace('Last one','last one')+')','k-data','settings')}
      ${mnode('bell','TickTick','Bonsai list · Saturday feed and spray routines, plus a jobs checklist on the 1st of each month','k-data')}
    </div>
    ${mdown('copied by')}
    ${mnode('shield','IDrive','Google Personal Backup · a second copy of your whole Google account, Drive included','k-data')}
  </div>
  <div class="map card">
    <h3>Making a change</h3>
    ${mnode('question','You describe it','Tell Claude what you want; a screenshot helps','k-you')}
    ${mdown()}
    ${mnode('brush','Claude edits the code','Kept in GitHub (graytrees/GraytTrees) with every earlier version','k-app')}
    ${mdown('about 2 minutes')}
    ${mnode('check','Live on your devices','Open the app and tap “Update available” to refresh','k-data')}
    <p class="muted mnote">Anything that changes how records are stored: back up first (More › Settings &amp; backups › Back up now). A change can always be rolled back to an earlier version.</p>
  </div>
  <div class="map card">
    <h3>If something goes wrong</h3>
    <p class="muted mnote" style="margin-top:0">Start at the top and work down. Each step reaches further back.</p>
    ${mnode('x','Deleted an entry?','Recycle bin – tap Restore. Nothing is lost.','k-step','recycle')}
    ${mdown()}
    ${mnode('history','Changed an entry by mistake?','Every edit keeps the earlier version with the entry','k-step')}
    ${mdown()}
    ${mnode('archive','Records damaged or missing?','Weekly backup in Drive › GraytTrees › Backups. JSON + a spreadsheet CSV, readable without the app.','k-step','settings')}
    ${mdown()}
    ${mnode('shield','Google Drive itself lost?','Restore from IDrive’s copy of your Google account','k-step')}
    ${mdown()}
    ${mnode('leaf','App broken after a change?','Ask Claude to republish the last good version from GitHub','k-step')}
  </div>
  <div class="map card">
    <h3>Once a year</h3>
    <p class="muted mnote" style="margin-top:0">Glance at Firebase usage (free tier) and Drive storage space. GitHub has two-factor on, with recovery codes in Bitwarden.</p>
  </div>`;
}
function viewRecycle(){
  return header() + `<div class="section-h"><div><span class="eyebrow">Nothing is ever lost</span><h2>Recycle bin</h2></div></div>
  <p class="muted" style="margin-top:-4px">Deleted history entries stay here. Restore puts them straight back.</p>
  ${DELETED.map(l=>`<div class="card" style="padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center"><div style="flex:1;min-width:0"><b>${l.trees.map(id=>esc(byId[id]?.name||id)).join(', ')}</b> <span class="muted num">· ${fmtD(l.date,l.precision)}</span><div class="muted" style="font-size:calc(14.5px*var(--fs));white-space:pre-line">${esc(l.text)}</div></div><button class="btn small" data-restore="${l.id}">Restore</button></div>`).join('')||'<div class="empty">The recycle bin is empty.</div>'}`;
}
function viewSettings(){
  const b = state.meta.backup;
  return header() + `<div class="section-h"><div><span class="eyebrow">Your data, in your accounts</span><h2>Settings &amp; backups</h2></div></div>
  <div class="stack">
    <div class="card" style="padding:16px"><b>Text size</b><p class="muted" style="margin:4px 0 10px;font-size:15px">Set separately on each device.</p>
      <div class="seg" role="group" aria-label="Text size">${[['1','Standard'],['1.12','Large'],['1.25','Larger']].map(([k,l])=>`<button data-fs="${k}" aria-pressed="${textSize()===k}">${l}</button>`).join('')}</div></div>
    <div class="card" style="padding:16px"><b>Google Drive</b><p class="muted" style="margin:4px 0 10px;font-size:calc(15px*var(--fs))">Full-size photos and weekly backups go into a "GraytTrees" folder in your Drive. The app can only see files it created.</p>
      ${driveConnected()?`<span class="pill ok">Connected</span>`:`<button class="btn small" data-drive>${ico('check')}Connect Google Drive</button>`}
      <p class="muted num" style="font-size:calc(14px*var(--fs));margin:10px 0 0" id="pendingInfo"></p></div>
    <div class="card" style="padding:16px"><b>Weekly backup</b><p class="muted" style="margin:4px 0 10px;font-size:calc(15px*var(--fs))">Every 7 days, the next time the app is opened online, all records are saved to Drive → GraytTrees → Backups as a JSON file and a history spreadsheet (CSV).</p>
      <p style="margin:0 0 10px">${b?.lastDay?`Last backup <b>${fmtD(b.lastDay)}</b> · ${b.trees} trees, ${b.logs} entries`:'No backup yet.'}</p>
      <button class="btn small" data-backup>${ico('archive')}Back up now</button></div>
    <div class="card" style="padding:16px"><b>Import records</b><p class="muted" style="margin:4px 0 10px;font-size:calc(15px*var(--fs))">Load the merged records file and photo bundle. Safe to run again; nothing is duplicated.</p><button class="btn ghost small" data-nav="import">${ico('archive')}Open import</button></div>
    <div class="card" style="padding:16px"><b>Signed in</b><p class="muted" style="margin:4px 0 10px;font-size:calc(15px*var(--fs))">${esc(auth.currentUser?.email||'')}</p><button class="btn ghost small" data-signout>Sign out</button></div>
  </div>`;
}
function viewImport(){
  return header() + `<div class="section-h"><div><span class="eyebrow">One-time setup</span><h2>Import my records</h2></div></div>
  <div class="card" style="padding:16px;display:grid;gap:14px">
    <p style="margin:0">Choose the two files Claude sent you: <b>graytrees-import.json</b> (records) and the photo files <b>graytrees-photos-1.zip</b> and <b>graytrees-photos-2.zip</b> (select both together). Photos are uploaded to your Google Drive, so do this on Wi-Fi; it takes a few minutes.</p>
    <p style="margin:0" class="muted">Library: choose <b>graytrees-library.json</b> as the records file and leave the photos empty. Books already in your library are left as they are.</p>
    <p style="margin:0" class="muted">Tools: choose <b>graytrees-tools.json</b> as the records file and leave the photos empty. Tools you've already edited are left as they are.</p>
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
    <div class="step row"><label class="btn ghost small">${ico('cam')}Add photos<input type="file" accept="image/*" multiple hidden id="lgfiles"></label><span class="muted" style="font-size:calc(14px*var(--fs))">${LG.fileObjs.length?LG.fileObjs.length+' photo'+(LG.fileObjs.length>1?'s':'')+' attached':'Take one now or pick from your gallery later'}</span></div>
    ${LG.err?`<p class="err" role="alert">${esc(LG.err)}</p>`:''}
    <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-lgsave>${ico('check')}Save${LG.trees.size>1?' for '+LG.trees.size+' trees':''}</button></div>`;
}
function jobsEditor(){
  return `<div class="jobs-ed">
    <p class="muted" style="margin:0;font-size:calc(14.5px*var(--fs))">Rename jobs, hide ones you never use, or add your own. "Counts as" decides which "Last done" tile and reminder a job updates.</p>
    <div class="jrow eyebrow" style="font-size:calc(12px*var(--fs))"><span>Job name</span><span>Counts as</span><span></span></div>
    ${JOBS.map((j,i)=>`<div class="jrow"><input value="${esc(j.label)}" data-jlabel="${i}" aria-label="Job name">
      <select data-jkind="${i}" aria-label="Counts as">${KINDS.map(([k,l])=>`<option value="${k}"${j.kind===k?' selected':''}>${l}</option>`).join('')}</select>
      <button class="tg" data-jhide="${i}" aria-pressed="${!j.hidden}">${j.hidden?'Hidden':'Shown'}</button></div>`).join('')}
    <div class="row"><button class="btn ghost small" data-jadd>${ico('plus')}Add a job</button></div>
    <span class="eyebrow" style="margin-top:8px">Shortcuts (tick several jobs in one tap)</span>
    ${COMBOS.map((c,i)=>`<div class="jrow"><input value="${esc(c.label)}" data-clabel="${i}" aria-label="Shortcut name"><span class="muted" style="font-size:calc(13.5px*var(--fs))">${c.jobs.map(id=>esc(ACT[id]?.label||id)).join(' + ')}</span><button class="tg" data-cdel="${i}">Remove</button></div>`).join('')}
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
  if(fd.type==='parts') return `<div class="field" style="grid-column:1/-1"><span class="eyebrow">${fd.label}</span><div class="calc">${Object.entries(ING).map(([k,[l]])=>`<label class="field"><span class="muted" style="font-size:calc(13.5px*var(--fs))">${l}</span><input type="number" min="0" step="0.5" inputmode="decimal" data-part="${k}" value="${(val||{})[k]||''}" placeholder="0"></label>`).join('')}</div></div>`;
  if(fd.type==='trees') return `<div class="field" style="grid-column:1/-1"><span class="eyebrow">${fd.label}</span><div class="chips" style="flex-wrap:wrap">${TREES.filter(t=>t.status!=='past').sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<button type="button" class="chip" data-ftree="${t.id}" aria-pressed="${(val||[]).includes(t.id)}">${esc(t.name)}</button>`).join('')}</div></div>`;
  return `<label class="field"><span class="eyebrow">${fd.label}</span><input id="${id}" type="${fd.type||'text'}" ${fd.type==='number'?'inputmode="decimal" step="any"':''} value="${esc(val)}"></label>`;
}
function renderForm(){
  const f = FORM, v = f.value;
  $('#layer').innerHTML = `<div class="scrim" data-close><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(f.title)}">
    <div class="row" style="justify-content:space-between"><h2>${esc(f.title)}</h2><button class="btn ghost small" data-close aria-label="Close">${ico('x')}</button></div>
    ${f.note?`<p class="muted" style="font-size:calc(14.5px*var(--fs))">${f.note}</p>`:''}
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
      ...(t.group==='azalea'?[{k:'azTiming',label:'Azalea repot timing',type:'select',options:[['','Before flowering, Jul–Aug (pinch off flowers)'],['after','After flowering, Oct–Nov']]}]:[]),
      {k:'autumn',label:'Autumn repot flag',type:'select',options:[['','Not flagged'],['yes','Remind me in the autumn window (Mar–May)']]},
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
/* --- tools (Kaneshin etc.) --- */
const TOOL_TYPES = [['cutter','Branch / concave cutter','cutter'],['knob','Knob cutter','cutter'],['wirec','Wire cutter','wire'],['pliers','Pliers','wire'],['jin','Jin pliers','wire'],
  ['scissors','Bonsai scissors','scissors'],['trim','Trimming scissors','scissors'],['rootc','Root cutter','roots'],['carve','Jin / shari carving tool','chop'],['knife','Knife','chop'],
  ['saw','Saw','chop'],['tweezers','Tweezers / spatula','brush'],['rake','Rake / root hook','roots'],['scoop','Soil scoop','mix'],['sieve','Sieve','mix'],['other','Other','tag']];
const TT = Object.fromEntries(TOOL_TYPES.map(([k,l,i])=>[k,{label:l,icon:i}]));
const RUSTCARE = 'Rusts if left damp. After each session wipe off sap and moisture, dry fully, then a thin coat of camellia oil on the blades and pivot. Light rust: rub off with a rubber rust eraser (e.g. Crean Mate), then oil. ';
const STEELS = {
  carbon:{label:'Carbon steel', rust:true, care:RUSTCARE+'Takes a very keen edge and is easy to resharpen.'},
  blue:{label:'Blue steel (aogami)', rust:true, care:RUSTCARE+'High-carbon Japanese steel: holds its edge longer than plain carbon steel.'},
  white:{label:'White steel (shirogami)', rust:true, care:RUSTCARE+'Very pure carbon steel: sharpest edge, but chips if twisted in a cut.'},
  yellow:{label:'Yellow steel (kigami)', rust:true, care:RUSTCARE},
  stainless:{label:'Stainless steel', rust:false, care:'Virtually rustproof, so it can stay outdoors in the wet without harm. Still wipe sap off and oil the pivot now and then. Harder to resharpen than carbon steel; best sent to a specialist.'},
  blackss:{label:'Black-finished stainless', rust:false, care:'Stainless under a black finish: rustproof. Wipe sap off and oil the pivot now and then.'},
  mild:{label:'Mild steel', rust:true, care:RUSTCARE+'Softer, low-carbon steel: fine for scoops and sieves, won\'t hold a fine cutting edge.'},
  other:{label:'Other / unknown', rust:false, care:''}};
const TOOLS = () => (state.tools||[]).filter(x=>!x.deleted);
const yen = n => n ? '¥'+Number(n).toLocaleString('en-AU') : null;
const aud = n => n ? 'A$'+Number(n).toLocaleString('en-AU',{minimumFractionDigits:0,maximumFractionDigits:2}) : null;
function toolSize(x){ return [x.length?x.length+' mm':'', x.blade?'blade '+x.blade+' mm':'', x.weight?x.weight+' g':''].filter(Boolean).join(' · '); }
function toolThumb(x, cls='thumb'){ const id=(x.photos||[]).find(i=>photo(i)); return id ? `<img class="${cls}" src="${photo(id)}" alt="" loading="lazy">` : `<div class="${cls} ph">${ico(TT[x.type]?.icon||'tag','mid')}</div>`; }
function viewTools(){
  const all = TOOLS(), f = S.toolf||'all', q = S.q.toLowerCase();
  const order = Object.fromEntries(TOOL_TYPES.map(([k],i)=>[k,i]));
  const list = all.filter(x=> f==='all' || (f==='rust') === !!STEELS[x.steel]?.rust)
    .filter(x=>!q || [x.name,x.brand,x.model,STEELS[x.steel]?.label,x.notes].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>(order[a.type]??99)-(order[b.type]??99) || a.name.localeCompare(b.name));
  const tYen = all.reduce((s,x)=>s+(+x.priceYen||0),0), tAud = all.reduce((s,x)=>s+(+x.priceAud||0),0), nRust = all.filter(x=>STEELS[x.steel]?.rust).length;
  return header('Search tools…') + `<div class="section-h"><div><span class="eyebrow">${all.length} recorded</span><h2>Tools</h2></div><button class="btn small" data-edittool="">${ico('plus')}Add tool</button></div>
  ${all.length?`<div class="statgrid" style="margin-bottom:12px"><div class="stat"><b class="num">${all.length}</b><span>tools</span></div>${tYen?`<div class="stat"><b class="num">${yen(tYen)}</b><span>paid in yen</span></div>`:''}${tAud?`<div class="stat"><b class="num">${aud(tAud)}</b><span>paid in dollars</span></div>`:''}<div class="stat"><b class="num">${nRust}</b><span>need oiling (rust-prone steel)</span></div></div>
  <div class="chips" role="group" aria-label="Filter by steel">${[['all','All'],['rust','Carbon steels – keep oiled'],['ss','Stainless']].map(([k,l])=>`<button class="chip" data-toolf="${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div>`
  :`<div class="card" style="padding:16px;margin-bottom:12px"><p style="margin-top:0">No tools yet. Import <b>graytrees-tools.json</b> (your Kaneshin and Wazakura orders) under More › Import, or add tools one at a time.</p><button class="btn" data-nav="import">${ico('archive')}Import my tools</button></div>`}
  <div class="grid">${list.map(x=>`<button class="card pot" data-tool="${x.id}" style="border:0;text-align:left">${toolThumb(x)}
    <div style="min-width:0"><h3 style="font-size:calc(17px*var(--fs));font-family:var(--body);font-weight:700">${esc(x.name)}</h3>
    <div class="muted" style="font-size:calc(14px*var(--fs))">${[x.brand, x.model?'No.'+x.model:'', toolSize(x)].filter(Boolean).map(esc).join(' · ')}</div>
    <div style="font-size:calc(14px*var(--fs));margin-top:4px">${x.steel?`<span class="pill ${STEELS[x.steel]?.rust?'unc':'ok'}">${esc(STEELS[x.steel]?.label||x.steel)}</span> `:''}${x.acquired?`<span class="muted">Bought ${esc(fmtD(x.acquired))}</span>`:''}</div></div></button>`).join('')||(all.length?'<div class="empty">No tools match.</div>':'')}</div>`;
}
function viewTool(){
  const x = TOOLS().find(t=>t.id===S.toolId); if(!x) return viewTools();
  const st = STEELS[x.steel], ps = (x.photos||[]).filter(i=>photo(i)), c = ps[0];
  const rows = [['Type',TT[x.type]?.label],['Brand / maker',x.brand],['Model No.',x.model],['Length',x.length?x.length+' mm':null],['Blade length',x.blade?x.blade+' mm':null],['Weight',x.weight?x.weight+' g':null],
    ['Steel',st?st.label+(x.steelNote?' – '+x.steelNote:''):x.steelNote],['Bought',x.acquired?fmtD(x.acquired)+' ('+ago(x.acquired).replace(' ago','')+' ago)':null],['Where from',x.source],
    ['Price',[yen(x.priceYen),aud(x.priceAud)].filter(Boolean).join(' · ')||null],['Comments',x.notes]];
  return `<div class="topbar"><button class="back" data-nav="tools">${ico('back')}Tools</button><span style="flex:1"></span><button class="btn small" data-edittool="${x.id}">${ico('brush')}Edit</button></div>
  <div class="hero"><div class="hero-img">${c?`<img src="${photo(c)}" alt="${esc(x.name)}" data-zoom="${c}">`:`<div class="ph" style="height:100%">${ico(TT[x.type]?.icon||'tag','big')}</div>`}${ps.length>1?`<span class="count">${ps.length} photos</span>`:''}</div>
  <div><span class="eyebrow">${esc(TT[x.type]?.label||'Tool')}</span><h1 style="margin:2px 0 10px">${esc(x.name)}</h1>
  ${st&&st.care?`<div class="note"><b>Care · ${esc(st.label)}:</b> ${esc(st.care)}</div>`:''}
  <dl class="info">${rows.filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1]).replace(/\n/g,'<br>')}</dd>`).join('')}</dl>
  ${x.url?`<p><a href="${esc(x.url)}" target="_blank" rel="noopener" style="color:var(--glaze);font-weight:700">Maker's product page ↗</a></p>`:''}</div></div>
  <div class="section-h" style="margin-top:18px"><h2 style="font-size:calc(20px*var(--fs))">Photos</h2><label class="btn small">${ico('cam')}Add photos<input type="file" accept="image/*" multiple hidden data-toolphoto="${x.id}"></label></div>
  ${ps.length?`<div class="pgrid">${ps.map(i=>`<figure><img src="${photo(i)}" alt="" loading="lazy" data-zoom="${i}"></figure>`).join('')}</div>`:'<div class="empty">No photos yet.</div>'}`;
}
function editTool(id){
  const x = id ? TOOLS().find(t=>t.id===id) : {photos:[], type:'scissors'};
  openForm({ title: id?'Edit '+x.name:'Add a tool', value:{...x},
    note: 'Weights and lengths are as listed by the maker. Put the yen price from the order and, if you have it, what it cost in dollars (card statement) including postage.',
    fields:[{k:'name',label:'Name'},{k:'type',label:'Type',type:'select',options:TOOL_TYPES.map(([k,l])=>[k,l])},{k:'brand',label:'Brand / maker'},{k:'model',label:'Model No.'},
      {k:'length',label:'Length (mm)',type:'number'},{k:'blade',label:'Blade length (mm)',type:'number'},{k:'weight',label:'Weight (g)',type:'number'},
      {k:'steel',label:'Steel / material',type:'select',options:[['',''],...Object.entries(STEELS).map(([k,v])=>[k,v.label])]},{k:'steelNote',label:'Steel detail (grade, finish)'},
      {k:'acquired',label:'Date bought',type:'date'},{k:'source',label:'Where from'},{k:'priceYen',label:'Price (¥)',type:'number'},{k:'priceAud',label:'Cost in A$ (optional)',type:'number'},
      {k:'url',label:'Maker\'s product page (link)'},{k:'notes',label:'Comments',type:'textarea'}],
    danger: id?`<button class="btn ghost small" data-deltool="${esc(id)}">${ico('x')}Remove tool</button>`:'',
    onSave: async v => { if(!v.name) return 'Give the tool a name.'; const nid = await saveRecord('tools', v); S.toolId=nid; go('tool'); toast('Tool saved'); }});
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
    danger:`<button class="btn ghost small" data-delentry="${id}">${ico('x')}Delete entry</button><span class="muted" style="font-size:calc(14px*var(--fs))">Goes to the recycle bin; restorable.</span>`,
    onSave: async v => { if(!v.actions.length) return 'Pick at least one job.'; await editLog(id, {date:v.date, actions:v.actions, text:v.text}); toast('Entry updated'); render(); }});
}

/* --- Library: your bonsai books (replaces Handy Library) --- */
const BOOKS = () => (state.books||[]).filter(b=>!b.deleted);
const isbnDigits = s => String(s||'').toUpperCase().replace(/[^0-9X]/g,'');
function isbn13(s){
  const d = isbnDigits(s);
  if(d.length===13) return d;
  if(d.length!==10) return null;
  const core = '978'+d.slice(0,9);
  const sum = [...core].reduce((a,c,i)=>a+(+c)*(i%2?3:1),0);
  return core + ((10 - sum%10)%10);
}
const authorName = a => { const [l,f] = String(a).split(',').map(x=>x.trim()); return f ? `${f} ${l}` : l; };
const authorsTxt = b => (b.authors||[]).map(authorName).join(', ');
function bookCover(b, cls='bk-cover'){
  const src = b.cover || b.coverUrl;
  const ph = `<div class="${cls} bk-ph"><span>${esc(b.title)}</span></div>`;
  return src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" onerror="this.outerHTML=this.dataset.ph" data-ph="${esc(ph)}">` : ph;
}
function viewLibrary(){
  const all = BOOKS();
  const q = (S.q||'').toLowerCase().trim(), f = S.bkf||'all';
  let list = all.filter(b=>f==='all'||(f==='key'&&b.key)||(f==='pages'&&(b.photos||[]).length));
  const hit = {};
  const terms = q.split(/\s+/).filter(Boolean).map(t=>t.length>3&&t.endsWith('s')?t.slice(0,-1):t);
  const has = txt => { const l=String(txt).toLowerCase(); return terms.every(t=>l.includes(t)); };
  if(q){ const qi = isbnDigits(q); list = list.filter(b=>{
    if(has([b.title,b.subtitle,authorsTxt(b),b.publisher,b.notes].join(' ')) || (qi.length>=4 && [b.isbn,b.isbn13].some(x=>isbnDigits(x).includes(qi)))) return true;
    const lines = [...String(b.contents||'').split('\n').map(l=>['Contents',l]), ...String(b.index||'').split('\n').map(l=>['Index',l])].filter(([,l])=>has(l));
    if(lines.length){ hit[b.id]=lines.slice(0,3); return true; } return false; }); }
  const by = S.bksort||'title';
  const key = b => by==='author' ? (b.authors||[''])[0].toLowerCase() : by==='year' ? String(9999-(+b.year||0)) : b.title.replace(/^(the|a)\s+/i,'').toLowerCase();
  list.sort((a,b)=>key(a).localeCompare(key(b)) || a.title.localeCompare(b.title));
  const nKey = all.filter(b=>b.key).length, nPg = all.filter(b=>(b.photos||[]).length).length;
  return header('Search title, author or ISBN…') + `<div class="section-h"><div><span class="eyebrow">${all.length} books</span><h2>Library</h2></div>
    <div class="row" style="gap:8px"><button class="btn small" data-bkcheck>${ico('barcode')}Do I own it?</button><button class="btn ghost small" data-editbook="">${ico('plus')}Add</button></div></div>
  <p class="muted" style="margin:-4px 0 12px;font-size:calc(14px*var(--fs))">Search also looks inside the typed contents and index of each book. <label class="linkish">Load typed text from Claude<input type="file" id="bktext" accept=".json,application/json" hidden></label></p>
  ${all.length?'':`<div class="card" style="padding:16px;margin-bottom:12px"><p style="margin-top:0">Your library is empty. Import <b>graytrees-library.json</b> (the 100 books from Handy Library) under More › Import, or add books one at a time.</p><button class="btn" data-nav="import">${ico('archive')}Import my library</button></div>`}
  <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    <div class="chips">${[['all','All',all.length],['key','Key books',nKey],['pages','With page photos',nPg]].map(([k,l,n])=>`<button class="chip" data-bkf="${k}" aria-pressed="${f===k}">${k==='key'?ico('star'):''}${l} <span class="count muted">${n}</span></button>`).join('')}</div>
    <label class="row" style="gap:6px;font-size:calc(14px*var(--fs))"><span class="muted">Sort</span><select id="bksort">${[['title','Title'],['author','Author'],['year','Newest']].map(([k,l])=>`<option value="${k}"${by===k?' selected':''}>${l}</option>`).join('')}</select></label>
  </div>
  <div class="shelf">${list.map(b=>`<button class="bk" data-book="${esc(b.id)}">${bookCover(b)}${b.key?`<span class="bk-key" title="Key book">${ico('star')}</span>`:''}
    <b>${esc(b.title)}</b><span>${esc(authorsTxt(b))}${b.year?' · '+esc(b.year):''}</span>${hit[b.id]?`<em class="bk-hit">${hit[b.id].map(([w,l])=>`${w}: ${esc(l.trim())}`).join('<br>')}</em>`:''}</button>`).join('') || (all.length?'<div class="empty" style="grid-column:1/-1">No books match.</div>':'')}</div>`;
}
function viewBook(){
  const b = BOOKS().find(x=>x.id===S.book); if(!b) return go('library');
  const pg = (b.photos||[]).filter(id=>PH[id]);
  const facts = [b.publisher, b.year, b.pages?b.pages+' pages':'' ].filter(Boolean).map(esc).join(' · ');
  return header('Search title, author or ISBN…') + `<button class="btn ghost small" data-nav="library" style="margin-bottom:10px">${ico('back')}Library</button>
  <div class="bk-head">${bookCover(b,'bk-big')}
    <div style="min-width:0"><h2 style="margin:0 0 4px">${esc(b.title)}</h2>${b.subtitle?`<p class="muted" style="margin:0 0 6px">${esc(b.subtitle)}</p>`:''}
      <p style="margin:0 0 6px;font-weight:600">${esc(authorsTxt(b))||'<span class="muted">Author not recorded</span>'}</p>
      ${facts?`<p class="muted" style="margin:0 0 6px">${facts}</p>`:''}
      ${b.isbn13||b.isbn?`<p class="muted num" style="margin:0 0 10px">ISBN ${esc(b.isbn13||b.isbn)}</p>`:''}
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn small ${b.key?'':'ghost'}" data-bkkey="${esc(b.id)}" aria-pressed="${!!b.key}">${ico('star')}${b.key?'Key book':'Mark as key book'}</button>
      <button class="btn ghost small" data-editbook="${esc(b.id)}">${ico('brush')}Edit</button></div>
    </div></div>
  ${b.notes?`<div class="section-h"><h2 style="font-size:calc(20px*var(--fs))">My notes</h2></div><div class="card" style="padding:14px 16px;white-space:pre-wrap">${esc(b.notes)}</div>`:''}
  ${b.contents||b.index?`<div class="section-h"><div><span class="eyebrow">${esc(b.textNote||'Typed from your page photos')}</span><h2 style="font-size:calc(20px*var(--fs))">Contents &amp; index</h2></div></div>
    ${b.contents?`<details class="card bk-text"><summary>Contents</summary><div>${esc(b.contents)}</div></details>`:''}
    ${b.index?`<details class="card bk-text"><summary>Index</summary><div>${esc(b.index)}</div></details>`:''}`:''}
  <div class="section-h"><div><span class="eyebrow">Contents, index, key chapters</span><h2 style="font-size:calc(20px*var(--fs))">Page photos</h2></div>
    <label class="btn small">${ico('cam')}Add pages<input type="file" accept="image/*" multiple hidden data-bookphoto="${esc(b.id)}"></label></div>
  ${pg.length?`<div class="pgrid pages">${pg.map((id,i)=>`<figure><img src="${PH[id].src}" alt="Page photo ${i+1}" loading="lazy" data-zoom="${id}"><figcaption class="num">Page photo ${i+1}</figcaption></figure>`).join('')}</div>
    <p class="muted" style="font-size:calc(14px*var(--fs))">Tap a page to read it full size (needs signal the first time).</p>`
   :`<div class="empty">No pages yet. Photograph the contents and index first; they make the book searchable later.</div>`}
  ${b.summary?`<div class="section-h"><h2 style="font-size:calc(20px*var(--fs))">About this book</h2></div><div class="card muted" style="padding:14px 16px;font-size:calc(15px*var(--fs));white-space:pre-line">${esc(b.summary)}</div>`:''}
  <p class="muted" style="font-size:calc(13.5px*var(--fs));margin-top:18px">${esc(b.source||'Added in GraytTrees')}${b.location?' · '+esc(b.location):''}</p>`;
}
function editBook(id, pre){
  const b = id ? BOOKS().find(x=>x.id===id) : {authors:[], photos:[], key:false, ...(pre||{})};
  openForm({ title: id?'Edit book':'Add a book', value:{...b, authors:(b.authors||[]).join('; '), key:b.key?'yes':''},
    fields:[{k:'title',label:'Title'},{k:'subtitle',label:'Subtitle'},{k:'authors',label:'Author(s) – Surname, First; separate with ;'},
      {k:'publisher',label:'Publisher'},{k:'year',label:'Year'},{k:'pages',label:'Pages',type:'number'},{k:'isbn',label:'ISBN'},
      {k:'key',label:'Key book?',type:'select',options:[['','No'],['yes','Yes – one of my key references']]},
      {k:'notes',label:'My notes',type:'textarea'}],
    danger: id?`<button class="btn ghost small" data-delbook="${esc(id)}">${ico('x')}Remove from library</button>`:'',
    onSave: async v => {
      if(!v.title) return 'Add the title.';
      const i13 = isbn13(v.isbn);
      if(i13 && BOOKS().some(x=>x.id!==id && (x.isbn13===i13))) return 'A book with that ISBN is already in your library.';
      const rec = {...v, authors:String(v.authors||'').split(';').map(x=>x.trim()).filter(Boolean), key:v.key==='yes', isbn13:i13||v.isbn13||null};
      if(!id){ rec.id = i13 && !BOOKS().some(x=>x.id==='b'+i13) ? 'b'+i13 : newId('b'); rec.source='Added in GraytTrees'; }
      const nid = await saveRecord('books', rec); S.book=nid; go('book'); toast('Book saved'); }});
}
/* "Do I own it?" – scan a barcode or type an ISBN while shopping */
const BK = {stream:null, timer:0, msg:'', result:null};
function stopScan(){ clearInterval(BK.timer); BK.timer=0; BK.stream?.getTracks().forEach(t=>t.stop()); BK.stream=null; }
function openBookCheck(){ BK.msg=''; BK.result=null; renderBookCheck(); }
function renderBookCheck(){
  const live = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  const r = BK.result;
  $('#layer').innerHTML = `<div class="scrim" data-close><div class="sheet bkcheck" role="dialog" aria-modal="true" aria-label="Do I own this book?">
    <div class="row" style="justify-content:space-between"><h2>Do I own it?</h2><button class="btn ghost small" data-close aria-label="Close">${ico('x')}</button></div>
    <p class="muted" style="margin-top:0;font-size:calc(14.5px*var(--fs))">Scan the barcode on the back cover, or type the ISBN or part of the title.</p>
    ${live?`<div class="scanbox"><video id="bkvid" playsinline muted></video><i></i></div>
      <div class="row" style="gap:8px;margin:10px 0"><button class="btn" data-bkscan>${ico('barcode')}${BK.stream?'Scanning…':'Scan barcode'}</button></div>`
     :`<label class="btn" style="margin-bottom:10px">${ico('cam')}Photograph the barcode<input type="file" accept="image/*" capture="environment" hidden id="bkphoto"></label>`}
    <form class="row" style="gap:8px;flex-wrap:nowrap" data-bkform><input id="bkq" type="search" placeholder="ISBN or title" style="flex:1" value="${esc(BK.q||'')}" aria-label="ISBN or title"><button class="btn ghost" type="submit">${ico('search')}Check</button></form>
    <div id="bkres" role="status" style="margin-top:14px">${BK.msg?`<p class="muted">${esc(BK.msg)}</p>`:''}${r?bookCheckResult(r):''}</div>
  </div></div>`;
  if(BK.stream){ const v=$('#bkvid'); v.srcObject=BK.stream; v.play().catch(()=>{}); }
}
function bookCheckResult(r){
  if(r.own.length) return `<div class="bk-own yes">${ico('check')}<b>Yes, you own ${r.own.length>1?'these':'this'}</b></div>`+r.own.slice(0,6).map(b=>`<button class="bk-row" data-book="${esc(b.id)}">${bookCover(b,'bk-mini')}<span><b>${esc(b.title)}</b><span class="muted">${esc(authorsTxt(b))}${b.year?' · '+esc(b.year):''}</span></span></button>`).join('')
    + (r.alt?`<p class="muted" style="font-size:calc(14px*var(--fs))">Same title, different edition or ISBN – check the year before buying.</p>`:'');
  const f = r.found;
  return `<div class="bk-own no">${ico('x')}<b>Not in your library</b></div>
    ${f?`<div class="bk-row" style="cursor:default">${f.coverUrl?`<img class="bk-mini" src="${esc(f.coverUrl)}" alt="" onerror="this.remove()">`:''}<span><b>${esc(f.title)}</b><span class="muted">${esc((f.authors||[]).map(authorName).join(', '))}${f.year?' · '+esc(f.year):''}</span></span></div>`
       :r.isbn?`<p class="muted" style="font-size:calc(14px*var(--fs))">ISBN ${esc(r.isbn)}${r.looked?' – no details found online.':''}</p>`:''}
    ${r.isbn?`<button class="btn small" data-bkadd>${ico('plus')}Add to my library</button>`:''}`;
}
async function checkBook(raw){
  const q = String(raw||'').trim(); BK.q=q; if(!q) return;
  const i13 = isbn13(q), all = BOOKS();
  let own = [], alt = false, found = null;
  if(i13){
    own = all.filter(b=>b.isbn13===i13 || isbn13(b.isbn)===i13);
    BK.result = {isbn:i13, own, found:null}; BK.msg = own.length?'':'Looking it up…'; renderBookCheck();
    if(!own.length){
      try{
        const ac = new AbortController(); setTimeout(()=>ac.abort(), 7000);
        const j = await (await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${i13}&format=json&jscmd=data`, {signal:ac.signal})).json();
        const d = j['ISBN:'+i13];
        if(d) found = {title:d.title, subtitle:d.subtitle||'', authors:(d.authors||[]).map(a=>{ const p=a.name.trim().split(' '); return p.length>1?p.pop()+', '+p.join(' '):a.name; }), publisher:d.publishers?.[0]?.name||'', year:(d.publish_date||'').match(/\d{4}/)?.[0]||'', pages:d.number_of_pages||null, coverUrl:d.cover?.medium||d.cover?.large||''};
      }catch(err){ /* offline or not found */ }
      if(found){ const t = found.title.toLowerCase().slice(0,24); own = all.filter(b=>b.title.toLowerCase().startsWith(t)); alt = own.length>0; }
      BK.result = {isbn:i13, own, alt, found, looked:true}; BK.msg='';
    }
  } else {
    const ql = q.toLowerCase();
    own = all.filter(b=>[b.title,b.subtitle,authorsTxt(b)].join(' ').toLowerCase().includes(ql));
    BK.result = {isbn:null, own, found:null}; BK.msg='';
  }
  renderBookCheck();
}
async function startScan(){
  if(BK.stream){ stopScan(); renderBookCheck(); return; }
  try{
    const det = new BarcodeDetector({formats:['ean_13','ean_8','upc_a','code_128']});
    BK.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment', width:{ideal:1280}}});
    BK.msg='Hold the barcode inside the box.'; BK.result=null; renderBookCheck();
    BK.timer = setInterval(async ()=>{
      const v = $('#bkvid'); if(!v){ stopScan(); return; }
      if(v.readyState<2) return;
      try{ const codes = await det.detect(v); const c = codes.find(x=>isbn13(x.rawValue) && /^97[89]/.test(isbn13(x.rawValue))) || codes[0];
        if(c){ stopScan(); navigator.vibrate?.(60); checkBook(c.rawValue); } }catch(err){ /* keep trying */ }
    }, 250);
  }catch(err){ stopScan(); BK.msg='Camera not available: '+err.message+'. Type the ISBN instead.'; renderBookCheck(); }
}
async function scanPhoto(file){
  BK.msg='Reading the barcode…'; renderBookCheck();
  try{
    if(!('BarcodeDetector' in window)) throw new Error('this browser can’t read barcodes');
    const bmp = await createImageBitmap(file);
    const codes = await new BarcodeDetector({formats:['ean_13','ean_8','upc_a']}).detect(bmp);
    if(!codes.length) throw new Error('no barcode found in the photo');
    checkBook(codes[0].rawValue);
  }catch(err){ BK.msg='Couldn’t read it ('+err.message+'). Type the 13-digit number under the barcode instead.'; renderBookCheck(); }
}

/* --- render + events --- */
const VIEWS = {trees:()=>viewTrees(false), past:()=>viewTrees(true), tree:viewTree, season:viewSeason, history:viewHistory, mixes:viewMixes, pots:viewPots, tools:viewTools, tool:viewTool, review:viewReview, more:viewMore, recycle:viewRecycle, settings:viewSettings, import:viewImport, how:viewHow, library:viewLibrary, book:viewBook};
export function render(){
  const v = VIEWS[S.view] || VIEWS.trees;
  $('#main').innerHTML = v();
  const navKey = S.view==='tree' ? (byId[S.tree]?.status==='past'?'past':'trees') : S.view;
  document.querySelectorAll('[data-nav]').forEach(b=>{ if(b.closest('.rail,.tabbar')) b.setAttribute('aria-current', (b.dataset.nav===navKey || (b.dataset.nav==='more' && ['pots','tools','tool','mixes','past','review','more','recycle','settings','import','how','library','book'].includes(navKey))) ? 'page':'false'); });
  if(document.querySelector('.cmp-stage')) upgradeCmp();
  if(S.view==='settings') pendingCount().then(n=>{ const el=$('#pendingInfo'); if(el) el.textContent = n ? `${n} photo${n>1?'s':''} waiting to upload` : ''; });
}
function sync(){
  TREES = state.trees.map(t=>({...t, photos:t.photos||[], aka:t.aka||[]}));
  byId = Object.fromEntries(TREES.map(t=>[t.id,t]));
  LOGS = state.logs.filter(l=>!l.deleted).map(l=>({...l, trees:l.trees||[], actions:l.actions||['note'], sources:l.sources||[], flags:l.flags||[]}));
  DELETED = state.logs.filter(l=>l.deleted).map(l=>({...l, trees:l.trees||[]}));
  PH = Object.fromEntries(Object.values(state.photos).map(p=>[p.id,{src:p.thumb||p.url, thumb:!!p.thumb, date:p.date, origin:p.origin, driveId:p.driveId, url:p.url}]));
  PDATE = {}; LOGS.forEach(l=>(l.photos||[]).forEach(p=>{ if(!PDATE[p]) PDATE[p]=l.date; }));
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
  if(e.target.id==='q'){ clearTimeout(qTimer); const pos=e.target.selectionStart; qTimer=setTimeout(()=>{ S.q=e.target.value; if(S.view==='book') S.view='library'; render(); const q=$('#q'); if(q){q.focus(); q.setSelectionRange(pos,pos);} },180); }
  if(e.target.matches('[data-cmpx]')){ e.target.closest('.cmp').querySelector('.cmp-stage').style.setProperty('--x', e.target.value+'%'); return; }
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
  if(e.target.id==='bksort'){ S.bksort=e.target.value; render(); }
  if(e.target.id==='bkphoto' && e.target.files[0]) scanPhoto(e.target.files[0]);
  if(e.target.id==='bktext' && e.target.files[0]){
    try{ const j = JSON.parse(await e.target.files[0].text()); let n=0, miss=0;
      for(const u of (j.bookText||[])){ const b=BOOKS().find(x=>x.id===u.id); if(!b){ miss++; continue; } await saveRecord('books', {...b, contents:u.contents??b.contents??'', index:u.index??b.index??'', textNote:u.textNote||b.textNote||''}); n++; }
      toast(`Typed text added to ${n} book${n===1?'':'s'}${miss?` (${miss} not found)`:''}`);
    }catch(err){ toast('Could not read that file: '+err.message); }
    e.target.value='';
  }
  if(e.target.dataset.bookphoto){
    const bid=e.target.dataset.bookphoto, files=[...e.target.files]; toast(`Saving ${files.length} page${files.length>1?'s':''}…`);
    try{ const ids = await addPhotos(files, {origin:'Library'}); const b=BOOKS().find(x=>x.id===bid); await saveRecord('books', {...b, photos:[...(b.photos||[]), ...ids]}); toast(`Added ${ids.length} page${ids.length>1?'s':''}`); }catch(err){ toast('Could not add pages: '+err.message); }
  }
  if(e.target.dataset.toolphoto){
    const tid=e.target.dataset.toolphoto, files=[...e.target.files]; toast(`Saving ${files.length} photo${files.length>1?'s':''}…`);
    try{ const ids = await addPhotos(files, {origin:'Tools'}); const x=TOOLS().find(t=>t.id===tid); await saveRecord('tools', {...x, photos:[...(x.photos||[]), ...ids]}); toast(`Added ${ids.length} photo${ids.length>1?'s':''}`); }catch(err){ toast('Could not add photos: '+err.message); }
    e.target.value='';
  }
  if(e.target.dataset.potphoto){
    const pid=e.target.dataset.potphoto; const ids = await addPhotos([...e.target.files], {}); const p=D.pots.find(x=>x.id===pid); await saveRecord('pots', {...p, photos:[...ids, ...(p.photos||[])]}); toast('Photo added');
  }
});
async function openLightbox(id){
  const p=PH[id]; if(!p) return;
  const lb=document.createElement('div'); lb.className='lightbox';
  lb.innerHTML=`<div><img src="${p.src}" alt=""><p>${p.date?fmtD(p.date):esc(p.origin||'Date unknown')} · <button class="lb-date" data-phdate="${id}">Change date</button>${S.view==='tree'&&byId[S.tree]?.photos?.includes(id)?(byId[S.tree].cover===id?` · <button class="lb-date" data-phcover="">Go back to newest photo</button>`:coverId(byId[S.tree])===id?'':` · <button class="lb-date" data-phcover="${id}">Use as tree photo</button>`):''} · tap photo to close</p></div>`;
  if(S.view==='tool'){ const dp=lb.querySelector('[data-phdate]'); dp.insertAdjacentHTML('afterend', ` · <button class="lb-date" data-tooldelph="${id}">Remove from this tool</button>`); }
  if(p.origin==='Library'){ lb.classList.add('page'); if(S.view==='book'){ const dp=lb.querySelector('[data-phdate]'); dp.outerHTML=`<button class="lb-date" data-pgdel="${id}">Remove this page</button>`; } }
  document.body.appendChild(lb);
  const note=document.createElement('p'); note.className='lb-full'; lb.firstChild.appendChild(note);
  if(p.driveId){
    note.innerHTML=`<span>Loading full size…</span> · <a href="https://drive.google.com/file/d/${p.driveId}/view" target="_blank" rel="noopener">Open in Drive to zoom</a>`;
    if(navigator.onLine) await loadFull(lb, p, false);
    else note.querySelector('span').textContent='Showing the small copy (no signal)';
  } else {
    note.innerHTML='<span>The full-size copy is still on this device waiting to upload.</span>';
    const local = await localFull(id); if(local){ lb.querySelector('img').src=local; note.querySelector('span').textContent='Full size (on this device, uploads when online)'; }
  }
}
async function loadFull(lb, p, interactive){
  const span=lb.querySelector('.lb-full span');
  try{
    if(interactive) await getToken(true);
    const u = await fileUrl(p.driveId); const img=lb.querySelector('img'); if(img) img.src=u;
    if(span) span.textContent='Full size';
  }catch(err){
    if(span) span.innerHTML=`Small copy only · <button class="lb-date" data-lbfull="${p.driveId}">Load full size</button>`;
  }
}
document.addEventListener('click', async e=>{
  const c = e.target.closest('[data-fsave],[data-fjob],[data-ftree],[data-delentry],[data-restore],[data-edittree],[data-editpot],[data-editmix],[data-editentry],[data-drive],[data-backup],[data-signout],[data-runimport],[data-ahead],[data-calsp],[data-cmpa],[data-cmpb],[data-cmppick],[data-cmpswap],[data-cmpreset],[data-jobsed],[data-combo],[data-jhide],[data-jadd],[data-cadd],[data-cdel],[data-layout],[data-fs],[data-tick],[data-close],[data-nav],[data-tree],[data-back],[data-tab],[data-group],[data-log],[data-zoom],[data-hact],[data-more],[data-mix],[data-lgt],[data-lga],[data-lgf],[data-lgall],[data-lgnone],[data-lgsave],[data-book],[data-bkf],[data-bkcheck],[data-editbook],[data-bkkey],[data-delbook],[data-bkscan],[data-bkadd],[data-phdate],[data-phsave],[data-phcover],[data-lbfull],[data-pgdel],[data-tool],[data-toolf],[data-edittool],[data-deltool],[data-tooldelph],.lightbox');
  if(!c) return;
  const d = c.dataset;
  if(c.classList.contains('lightbox')){ if(e.target.closest('.lb-edit,.lb-full a')) return; c.remove(); return; }
  if('phdate' in d){ const p=PH[d.phdate]; const v=p.date&&p.date.length===10?p.date:''; c.parentElement.outerHTML=`<p class="lb-edit"><label>Taken <input type="date" id="phd" value="${v}" max="${localDay()}"></label> <span class="muted">or year only</span> <input id="phy" type="number" inputmode="numeric" min="1980" max="${TODAY.getFullYear()}" placeholder="e.g. 2009" value="${p.date&&p.date.length===4?p.date:''}" style="width:6.5em"> <button class="btn small" data-phsave="${d.phdate}">Save</button></p>`; return; }
  if('pgdel' in d){ const b=BOOKS().find(x=>x.id===S.book); await saveRecord('books', {...b, photos:(b.photos||[]).filter(x=>x!==d.pgdel)}); document.querySelector('.lightbox')?.remove(); toast('Page removed'); return; }
  if('lbfull' in d){ const lb=c.closest('.lightbox'); const p=Object.values(PH).find(x=>x.driveId===d.lbfull); c.parentElement.textContent='Loading full size…'; await loadFull(lb, p, true); return; }
  if('phcover' in d){ const t=byId[S.tree]; await saveRecord('trees', {...t, cover:d.phcover||null}); document.querySelector('.lightbox')?.remove(); toast(d.phcover?'Tree photo set':'Showing the newest photo'); return; }
  if('phsave' in d){ const dd=$('#phd').value, yy=$('#phy').value.trim(); const date=/^(19|20)\d{2}$/.test(yy)?yy:dd; if(!date){ toast('Pick a date or type a year'); return; } await savePhoto({id:d.phsave, date, taken:true}); document.querySelector('.lightbox')?.remove(); toast('Photo date saved'); return; }
  if('close' in d){ if(e.target===c || c.tagName==='BUTTON'){ stopScan(); $('#layer').innerHTML=''; FORM=null; } return; }
  if('book' in d){ stopScan(); $('#layer').innerHTML=''; FORM=null; S.q=''; S.book=d.book; go('book'); return; }
  if('bkf' in d){ S.bkf=d.bkf; render(); return; }
  if('bkcheck' in d){ openBookCheck(); return; }
  if('bkscan' in d){ startScan(); return; }
  if('bkadd' in d){ const r=BK.result; stopScan(); editBook(null, {...(r.found||{}), isbn:r.isbn}); return; }
  if('editbook' in d){ editBook(d.editbook||null); return; }
  if('bkkey' in d){ const b=BOOKS().find(x=>x.id===d.bkkey); await saveRecord('books', {...b, key:!b.key}); toast(b.key?'No longer a key book':'Marked as a key book'); return; }
  if('delbook' in d){ const b=BOOKS().find(x=>x.id===d.delbook); await saveRecord('books', {...b, deleted:true, deletedMs:Date.now()}); $('#layer').innerHTML=''; FORM=null; go('library'); toast('Removed from library'); return; }
  if('fjob' in d){ const a=FORM.value.actions=FORM.value.actions||[]; const i=a.indexOf(d.fjob); i>=0?a.splice(i,1):a.push(d.fjob); c.setAttribute('aria-pressed', i<0); return; }
  if('ftree' in d){ const a=FORM.value.used=FORM.value.used||[]; const i=a.indexOf(d.ftree); i>=0?a.splice(i,1):a.push(d.ftree); c.setAttribute('aria-pressed', i<0); return; }
  if('fsave' in d){ const v=readForm(); if(FORM.value.actions) v.actions=FORM.value.actions; if(FORM.value.used) v.used=FORM.value.used; c.disabled=true; try{ const err=await FORM.onSave(v); if(err){ FORM.value=v; FORM.err=err; renderForm(); return; } $('#layer').innerHTML=''; FORM=null; }catch(err){ FORM.value=v; FORM.err='Could not save: '+err.message; renderForm(); } return; }
  if('delentry' in d){ await deleteLog(d.delentry); $('#layer').innerHTML=''; FORM=null; toast('Moved to the recycle bin'); return; }
  if('restore' in d){ await restoreLog(d.restore); toast('Restored'); return; }
  if('edittree' in d){ editTree(d.edittree||null); return; }
  if('editpot' in d){ editPot(d.editpot||null); return; }
  if('edittool' in d){ editTool(d.edittool||null); return; }
  if('tool' in d){ S.q=''; S.toolId=d.tool; go('tool'); return; }
  if('toolf' in d){ S.toolf=d.toolf; render(); return; }
  if('deltool' in d){ const x=TOOLS().find(t=>t.id===d.deltool); await saveRecord('tools', {...x, deleted:true, deletedMs:Date.now()}); $('#layer').innerHTML=''; FORM=null; go('tools'); toast('Tool removed'); return; }
  if('tooldelph' in d){ const x=TOOLS().find(t=>t.id===S.toolId); await saveRecord('tools', {...x, photos:(x.photos||[]).filter(i=>i!==d.tooldelph)}); document.querySelector('.lightbox')?.remove(); toast('Photo removed from this tool'); return; }
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
    try{ const r = await runImport(j, z, (msg,a,b)=>{ out.textContent = msg + (b?` ${a} of ${b}`:''); }); S.importResult=`Done: ${r.tools?r.tools+' tools, ':''}${r.books?r.books+' books, ':''}${r.trees} trees, ${r.logs} history entries, ${r.photos} photos${r.failed?` (${r.failed} photos failed – run the import again to retry)`:''}.`; out.textContent=S.importResult; }
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
  if('fs' in d){ setTextSize(d.fs); render(); return; }
  if('layout' in d){ S.layout=d.layout; try{localStorage.setItem('gt-layout',S.layout);}catch(err){} render(); return; }
  if('ahead' in d){ S.ahead=+d.ahead; render(); return; }
  if('cmpa' in d || 'cmpb' in d || 'cmppick' in d || 'cmpswap' in d || 'cmpreset' in d){
    const tid=c.closest('[data-cmptree]').dataset.cmptree, st=c.closest('.cmp').querySelector('.cmp-stage');
    const cur={tree:tid, a:st.querySelector('.cmp-a').dataset.id, b:st.querySelector('.cmp-b').dataset.id, pick:S.cmp?.tree===tid?S.cmp.pick:null, ...(S.cmp?.tree===tid?{a:S.cmp.a,b:S.cmp.b}:{})};
    if('cmpreset' in d) S.cmp=null;
    else if('cmppick' in d) S.cmp={...cur, pick: cur.pick===d.cmppick?null:d.cmppick};
    else if('cmpswap' in d) S.cmp={...cur, a:cur.b, b:cur.a};
    else S.cmp={...cur, ...('cmpa' in d?{a:d.cmpa}:{b:d.cmpb}), pick:null};
    render(); return; }
  if('calsp' in d){ const [ci,k]=d.calsp.split(':'); S.calSp={...(S.calSp||{}), [ci]:k}; render(); return; }
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
document.addEventListener('submit', e=>{ if(e.target.matches('[data-bkform]')){ e.preventDefault(); stopScan(); checkBook($('#bkq').value); } });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ stopScan(); $('#layer').innerHTML=''; FORM=null; document.querySelector('.lightbox')?.remove(); } });

export function startApp(){
  sync(); render();
  onChange(refresh);
  window.addEventListener('online', ()=>{ refresh(); flushPending(); maybeWeeklyBackup(); });
  window.addEventListener('offline', refresh);
  setTimeout(async ()=>{ const n = await flushPending(); if(n) toast(`${n} photo${n>1?'s':''} uploaded`); const b = await maybeWeeklyBackup(); if(b) toast('Weekly backup saved to Drive'); }, 4000);
}
