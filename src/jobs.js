// Season rules and the monthly job list. Shared by the app (Season screen, look-ahead)
// and scripts/monthly-jobs.mjs (the monthly TickTick checklist), so both always agree.
import { COLLECTION, TIPS } from './knowledge.js';

export const GUIDE = {  /* timing from Nathan's monthly calendar, Red Dragon newsletters and his own repot history (Brisbane); repot windows revised Oct 2026 */
  pine:{name:'Black pines', every:3, rows:{repot:[7,8], autumn:[3,4,5], struct:[7], wire:[6,7], defol:[9], clean:[3,4,5,6], prune:[12,1,2,10,11], fert:[3,4,5,9,10,11,12,1,2]}},
  elm:{name:'Chinese elms', every:2, rows:{repot:[7,8], autumn:[3,4,5], struct:[6,7], prune:[9,10,11,12,1,2,3], wire:[6,7], defol:[12], fert:[3,4,5,9,10,11]}},
  juniper:{name:'Junipers', every:3, rows:{repot:[7,8], autumn:[3,4,5], struct:[6,7,8], prune:[9,10,11,12,1,2,3], wire:[6,7], clean:[3,9], fert:[3,4,5,9,10,11,12,1,2]}},
  fig:{name:'Figs', every:2, rows:{repot:[10,11,12], autumn:[3,4], prune:[9,10,11,12,1,2,3], defol:[12], wire:[11,12,1,2], fert:[3,4,5,9,10,11]}},
  cler:{name:'Clerodendrums', every:2, rows:{repot:[10,11,12], autumn:[3,4], prune:[10,11,12,1,2,3], wire:[10,11,12,1,2], fert:[3,4,5,9,10,11]}},
  swamp:{name:'Swamp cypress', every:1, rows:{repot:[7,8], autumn:[3,4,5], struct:[7,8], prune:[10,11,12,1,2,3], wire:[6,7], fert:[9,10,11,12,1,2,3]}},
  podo:{name:'Buddhist pine', every:3, rows:{repot:[7,8], autumn:[3,4,5], prune:[9,10,11,12,1,2,3,4], wire:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  mela:{name:'Melaleuca', every:2, rows:{repot:[8,9,10], autumn:[3,4,5], prune:[10,11,12,1,2,3], fert:[3,4,5,9,10,11]}},
  bougie:{name:'Bougainvillea', every:2, rows:{repot:[10,11,12], autumn:[3,4], prune:[1,2,3], wire:[11,12,1,2], potash:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  azalea:{name:'Azaleas', every:2, rows:{repot:[7,8], autumn:[3,4,5], prune:[11,12,1,2], wire:[12,1,2], potash:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  african:{name:'Jaboticaba', every:2, rows:{repot:[10,11,12], autumn:[3,4], prune:[11,12,1,2,3], wire:[11,12,1,2], potash:[3,4,5,6,7,8], fert:[3,4,5,9,10,11]}},
  other:{name:'Other', every:2, rows:{}}
};
/* the three season calendars (Oct 2026): grouped by what wakes each tree up */
export const CALS = [
  {id:'exotic', name:'Exotics', blurb:'Northern-hemisphere trees. Repot mid-July to August: elms first, then junipers and pines.', species:['elm','juniper','pine','swamp','podo','azalea'], def:'pine'},
  {id:'native', name:'Natives', blurb:'Australian natives. Repot August to September, October at a stretch.', species:['mela']},
  {id:'tropical', name:'Ficus & tropicals', blurb:'Repot mid-October to December, once nights stay above about 15°C. Never January.', species:['fig','cler','bougie','african'], def:'fig'}
];
export const calOf = g => CALS.find(c=>c.species.includes(g));
export const AZ_AFTER = [10,11];  /* azalea repotted straight after flowering */
export const repotWin = t => (t.group==='azalea' && t.azTiming==='after') ? AZ_AFTER : ((GUIDE[t.group]||GUIDE.other).rows.repot||[]);
export const autumnWin = t => (GUIDE[t.group]||GUIDE.other).rows.autumn||[];
export const evMin = t => t.every ? t.every[0] : (GUIDE[t.group]||GUIDE.other).every;
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTHS_L = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function parseD(s){ if(!s) return null; const p=s.split('-').map(Number); return new Date(p[0], (p[1]||1)-1, p[2]||15); }
export function addMonths(y,m,n){ const d=new Date(y,m-1+n,1); return [d.getFullYear(), d.getMonth()+1]; }
export function tickTitle(o){ const pine=o.g.name==='Black pines'; const verb={struct:'Hard prune',wire:'Wire',defol:pine?'Decandle':'Defoliate',clean:pine?'Needle clean-up':'Clean out dead needles',potash:'Liquid potash (fortnightly)',prune:'Start trimming new growth'}[o.task]; return `${verb}: ${o.g.name.toLowerCase()} (${o.trees.length} tree${o.trees.length>1?'s':''})`; }

/* Wire checks: a tree logged as "Wired" needs its wire checked every 3 months (8 weeks for the fast-growing
 * tropicals – figs, clerodendrums, bougainvillea, jaboticaba – when wired October to March) so it doesn't cut
 * into a growing branch. Logging "Wire checked" restarts the 3 months; "Wire removed" ends it. */
export const WIRE_CHECK_MONTHS = 3;
export const WIRE_FAST_WEEKS = 8, WIRE_FAST = ['fig','cler','bougie','african'], WIRE_FAST_MONTHS = [10,11,12,1,2,3];
// Wiring logged before 2026 is old history: that wire came off long ago (removals weren't recorded then).
export const WIRE_FROM = '2026-01-01';
export function addMonthsDate(d, n){ const x = new Date(d.getFullYear(), d.getMonth()+n, d.getDate()); if(x.getDate()!==d.getDate()) x.setDate(0); return x; }
export function wireStatus(t, lastOf){
  const l = lastOf(t.id, ['wire','unwire','wirechk']); if(!l || (l.date||'') < WIRE_FROM) return null;
  const kinds = l._kinds || l.actions || [];
  if(kinds.includes('unwire') && !kinds.includes('wire')) return null;          // wire is off
  const wired = kinds.includes('wire') ? l : (lastOf(t.id, ['wire']) || l);
  const from = parseD(l.date), fast = WIRE_FAST.includes(t.group) && WIRE_FAST_MONTHS.includes(from.getMonth()+1);
  const due = fast ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + WIRE_FAST_WEEKS*7) : addMonthsDate(from, WIRE_CHECK_MONTHS);
  return { since: wired.date, lastCheck: l.date, checked: !kinds.includes('wire'), due, fast };
}
const fmtShort = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** Jobs engine. lastOf(treeId, kinds) returns the latest matching history entry. */
export function makeJobs({ trees, lastOf, today = new Date() }){
  const nowY = today.getFullYear(), nowM = today.getMonth()+1;
  const active = trees.filter(t=>t.status!=='past');
  function repotMonth(t){
    const win = repotWin(t); if(!win.length) return null;
    const last = lastOf(t.id,['repot']);
    let [y,m] = last ? (()=>{const d=parseD(last.date); return [d.getFullYear()+evMin(t), d.getMonth()+1];})() : [nowY, nowM];
    if(y < nowY || (y===nowY && m < nowM)) { y=nowY; m=nowM; }
    for(let i=0;i<24;i++){ const [yy,mm]=addMonths(y,m,i); if(win.includes(mm)) return [yy,mm]; }
    return null;
  }
  function wireChecks(y,m){                     // checks falling due in month y-m (plus any overdue, for the current month)
    const cur = y===nowY && m===nowM, end = new Date(y, m, 0, 23, 59);
    return active.map(t=>({t, w:wireStatus(t, lastOf)})).filter(({w})=> w && (cur ? w.due<=end : (w.due.getFullYear()===y && w.due.getMonth()+1===m)))
      .sort((a,b)=>a.w.due-b.w.due);
  }
  function month(y,m){
    const wires = wireChecks(y,m);
    const repots = active.filter(t=>{ const r=repotMonth(t); return r && r[0]===y && r[1]===m; });
    const prev = m===1?12:m-1, opens=[];
    for(const [k,g] of Object.entries(GUIDE)){
      const ts = active.filter(t=>t.group===k); if(!ts.length) continue;
      for(const task of ['struct','wire','defol','clean','potash','prune']){
        const w = g.rows[task]||[]; if(w.includes(m) && !w.includes(prev)) opens.push({task, g, trees:ts});
      }
    }
    const overdueBy = t => { const l=lastOf(t.id,['repot']); if(!l) return false; const d=parseD(l.date); return (d.getFullYear()+evMin(t))*12+d.getMonth()+1 <= y*12+m; };
    const autumn = active.filter(t=>!repots.includes(t) && autumnWin(t).includes(m) && (t.autumn==='yes' || overdueBy(t)));
    const coll = COLLECTION[m]||[];
    const items = [...wires.map(({t,w})=>`Check wire: ${t.name} (${w.checked?'last checked':'wired'} ${fmtShort(parseD(w.lastCheck))}; due ${fmtShort(w.due)})`), ...repots.map(t=>'Repot '+t.name), ...autumn.map(t=>'Autumn option: repot '+t.name+' (light root work)'), ...opens.map(tickTitle), ...coll];
    const notes = (TIPS[m]||[]).map(x=>x.t+': '+x.x);
    return {repots, opens, autumn, coll, wires, items, notes, title:`Bonsai jobs – ${MONTHS_L[m-1]} ${y}`};
  }
  return { repotMonth, month, wireChecks };
}

/** The monthly "Bonsai jobs – <Month Year>" checklist for month y-m, worked out from a backup
 *  ({trees, logs, meta}). Same rules as the Season screen. Returns {title, due, items[], notes[]}. */
export function monthlyJobs(data, y, m){
  const settings = (data.meta||[]).find(x=>x.id==='settings');
  const kindOf = a => (settings?.jobs||[]).find(j=>j.id===a)?.kind || a;   // a renamed "Repot" job still counts as a repot
  const logs = (data.logs||[]).filter(l=>!l.deleted).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const lastOf = (id,kinds) => { const l = logs.find(l=>(l.trees||[]).includes(id) && !(l.flags||[]).includes('tick') && (l.actions||[]).some(a=>kinds.includes(kindOf(a)))); return l && {...l, _kinds:(l.actions||[]).map(kindOf)}; };
  const out = makeJobs({ trees:data.trees||[], lastOf, today:new Date(y,m-1,1) }).month(y,m);
  const last = new Date(y,m,0).getDate();
  return { title:out.title, due:`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`, items:out.items, notes:out.notes };
}
