# Obiettivi — override manuale + cristallizzazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nella scheda Obiettivi: permettere l'override manuale della media giornaliera per giorno/bambino, cristallizzare i giorni passati (media relativa al giorno, numero pasti congelato, niente proiezioni), e allineare le card dei due bambini alla stessa altezza.

**Architecture:** App single-file (`index.html`), JS vanilla senza build né framework di test. Le nuove impostazioni vivono in `state.data.goals` (config), MAI dentro gli array `feeds`. La verifica avviene su una **copia sandbox** dell'app con il cloud Supabase disattivato e dati sintetici, così i dati reali non vengono mai toccati.

**Tech Stack:** HTML/CSS/JS inline; server statico `.claude/serve.js` (localhost:8765); anteprima via Browser tools; localStorage per la persistenza locale; Supabase per il cloud (disattivato nei test).

## Global Constraints

- **NON NEGOZIABILE — nessuna modifica ai pasti reali:** non creare/modificare/spostare/sovrascrivere/cancellare voci `feeds`. I nuovi dati stanno solo in `state.data.goals`. Gli slot "mancanti" sono UI: diventano pasti solo via `addPlannedFeed` su azione utente.
- **Test data-safe:** la verifica gira SOLO sulla copia sandbox `_sandbox.html` con `SUPABASE_ANON_KEY=""` (cloud off) e dati sintetici. Mai eseguire `saveData()` con Supabase attivo durante i test.
- **File unico:** tutte le modifiche in `index.html`. Non introdurre dipendenze o file nuovi (a parte `_sandbox.html`, mai committato).
- **Formato date:** chiavi giorno `YYYY-MM-DD` via `dk(d)` — l'ordinamento lessicografico coincide con quello cronologico (usato per `isPast`).
- **Password app:** `Ebby`. Colori bambini: `COLORS.Gabriel`/`COLORS.Vittorio`. Variabile ambra: `var(--amber)`.

---

## Verification Harness (data-safe) — riusato da ogni task

Eseguire questi passi per ogni verifica. Non committare mai `_sandbox.html`.

**H1. Genera la copia sandbox (cloud OFF) dalle sorgenti correnti:**
```bash
sed 's#const SUPABASE_ANON_KEY = "[^"]*";#const SUPABASE_ANON_KEY = "";#' index.html > _sandbox.html
grep -n 'SUPABASE_ANON_KEY = ""' _sandbox.html   # atteso: 1 riga → cloud disattivato
```

**H2. Avvia il server statico** (se non già attivo): `node .claude/serve.js` (serve la root su http://localhost:8765). Apri nel Browser `http://localhost:8765/_sandbox.html` e sblocca con password `Ebby`.

**H3. Semina dati sintetici** (console via javascript_tool) — non chiama mai `saveData`, e comunque il cloud è off:
```js
useSupabase = () => false; // sicurezza extra
const _key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _ago = n => { const x=new Date(); x.setDate(x.getDate()-n); return _key(x); };
const today = new Date();
state.data = { goals:{ meals:5, lastMeal:'22:00' } };
for(let i=1;i<=7;i++){ const k=_ago(i);
  state.data[k]={ Gabriel:{feeds:[{id:'g'+i+'a',time:'08:00',ml:200},{id:'g'+i+'b',time:'12:00',ml:200},{id:'g'+i+'c',time:'16:00',ml:200},{id:'g'+i+'d',time:'20:00',ml:200}]},
                  Vittorio:{feeds:[{id:'v'+i+'a',time:'08:00',ml:170},{id:'v'+i+'b',time:'12:00',ml:170},{id:'v'+i+'c',time:'16:00',ml:170},{id:'v'+i+'d',time:'20:00',ml:170}]} };
}
state.data[_key(today)]={ Gabriel:{feeds:[{id:'gt1',time:'05:30',ml:130,planned:true,target:170,leftover:40,extra:0}]},
                          Vittorio:{feeds:[{id:'vt1',time:'05:30',ml:120,planned:true,target:140,leftover:20,extra:0}]} };
state.selDate = today;
render();
```
Media attesa: Gabriel 800 ml, Vittorio 680 ml.

**H4. Vai alla scheda Obiettivi**: clicca la voce "Obiettivi" nella tab bar in basso (o valuta `buildGoals()` per ispezionare l'HTML stringa nei test di logica).

**H5. Cleanup a fine sessione di test:** `rm -f _sandbox.html` e ferma il server. Verifica `git status` → `_sandbox.html` non deve mai comparire tra i file committati.

---

## File Structure

- **Modify:** `index.html` — unico file. Aree toccate:
  - CSS `.goal-slot` (~riga 150) — altezza uniforme.
  - `state` init (~riga 352) — nuovo campo `goalMealsForceEditKey`.
  - Helpers date/goal (~righe 353, 1120-1173) — `dkToDate`, `avgDailyMl(ref)`, `effectiveTargetMl`, `getManualTarget`, `isManualTarget`, `setManualTarget`, `clearManualTarget`, `getGoalMeals(key)`, `setGoalMeals` per-giorno, snapshot in `addPlannedFeed`.
  - `buildGoals` (~righe 1175-1276) — wiring target effettivo, selettore bloccato, recap tappabile, griglia giorni passati.
  - Nuove funzioni modale (~dopo 1346) — `openTargetModal`, `saveTargetModal`.
- **Temp (mai committato):** `_sandbox.html` — copia cloud-off per i test.

---

## Task 1: Helper dati (date-relative + config obiettivi)

Funzioni pure/di stato, base per tutto il resto. Nessun cambiamento visibile ancora.

**Files:**
- Modify: `index.html:353` (dopo `dk`), `index.html:1122-1173` (helper goals), `index.html:352` (state init), `index.html:1163-1173` (`addPlannedFeed`).

**Interfaces — Produces:**
- `dkToDate(key:string): Date`
- `avgDailyMl(bn:string, ref?:Date): number` — finestra 7gg relativa a `ref` (default `state.selDate`).
- `getManualTarget(bn:string, key:string): number|undefined`
- `isManualTarget(bn:string, key:string): boolean`
- `effectiveTargetMl(bn:string, key:string): number`
- `setManualTarget(bn, key, ml): Promise<void>` — salva override, `closeModal()`, `render()`.
- `clearManualTarget(bn, key): Promise<void>` — rimuove override, `closeModal()`, `render()`.
- `getGoalMeals(key?:string): number` — per-giorno con fallback default globale.
- `setGoalMeals(n, key?): Promise<void>` — scrive `mealsByDate[key]`; se `key`==oggi aggiorna anche `goals.meals`.

- [ ] **Step 1: Aggiungi `dkToDate` subito dopo `dk` (riga 353).**

Dopo:
```js
function dk(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
```
inserisci:
```js
function dkToDate(key){ const p=String(key).split('-'); return new Date(+p[0], (+p[1])-1, +p[2]); }
```

- [ ] **Step 2: Rendi `avgDailyMl` relativa a un giorno di riferimento (riga 1122).**

Sostituisci l'intera funzione:
```js
function avgDailyMl(bn){
  const now=new Date(); let tot=0, days=0;
  for(let i=1;i<=7;i++){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);
    const f=state.data[dk(d)]?.[bn]?.feeds||[];
    if(f.length){ tot+=f.reduce((s,x)=>s+(x.ml||0),0); days++; }
  }
  return days?Math.round(tot/days):0;
}
```
con:
```js
function avgDailyMl(bn, ref){
  const base = (ref instanceof Date) ? ref : (state.selDate || new Date());
  let tot=0, days=0;
  for(let i=1;i<=7;i++){
    const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()-i);
    const f=state.data[dk(d)]?.[bn]?.feeds||[];
    if(f.length){ tot+=f.reduce((s,x)=>s+(x.ml||0),0); days++; }
  }
  return days?Math.round(tot/days):0;
}
```

- [ ] **Step 3: Aggiungi gli helper override + target effettivo subito dopo `goalPerMeal` (riga 1153).**

Dopo la riga:
```js
function goalPerMeal(bn,n){ const a=avgDailyMl(bn); return a>0?Math.round(a/n/5)*5:0; }
```
inserisci:
```js
function getManualTarget(bn, key){ const v=state.data.goals?.targetByDate?.[key]?.[bn]; return (typeof v==='number' && v>=0)?v:undefined; }
function isManualTarget(bn, key){ return getManualTarget(bn,key)!==undefined; }
function effectiveTargetMl(bn, key){
  const m=getManualTarget(bn,key);
  return (m!==undefined) ? m : avgDailyMl(bn, dkToDate(key));
}
async function setManualTarget(bn, key, ml){
  ml=Math.max(0, Math.round(parseInt(ml)||0));
  if(!state.data.goals) state.data.goals={};
  if(!state.data.goals.targetByDate) state.data.goals.targetByDate={};
  if(!state.data.goals.targetByDate[key]) state.data.goals.targetByDate[key]={};
  state.data.goals.targetByDate[key][bn]=ml;
  await saveData(); closeModal(); render();
}
async function clearManualTarget(bn, key){
  const t=state.data.goals?.targetByDate;
  if(t && t[key]){ delete t[key][bn]; if(!Object.keys(t[key]).length) delete t[key]; }
  await saveData(); closeModal(); render();
}
```

- [ ] **Step 4: Rendi `getGoalMeals` e `setGoalMeals` per-giorno (righe 1140-1151).**

Sostituisci:
```js
function getGoalMeals(){
  const g=state.data.goals?.meals;
  if(typeof g==='number' && g>=1) return goalClamp(g);
  const seed=Math.round((avgDailyFeeds('Gabriel')+avgDailyFeeds('Vittorio'))/2)||6;
  return goalClamp(seed);
}
async function setGoalMeals(n){
  n=goalClamp(parseInt(n)||6);
  if(!state.data.goals) state.data.goals={};
  state.data.goals.meals=n;
  await saveData(); render();
}
```
con:
```js
function getGoalMeals(key){
  const byDate = (key && state.data.goals?.mealsByDate) ? state.data.goals.mealsByDate[key] : undefined;
  if(typeof byDate==='number' && byDate>=1) return goalClamp(byDate);
  const g=state.data.goals?.meals;
  if(typeof g==='number' && g>=1) return goalClamp(g);
  const seed=Math.round((avgDailyFeeds('Gabriel')+avgDailyFeeds('Vittorio'))/2)||6;
  return goalClamp(seed);
}
async function setGoalMeals(n, key){
  n=goalClamp(parseInt(n)||6);
  const k = key || dk(state.selDate);
  if(!state.data.goals) state.data.goals={};
  if(!state.data.goals.mealsByDate) state.data.goals.mealsByDate={};
  state.data.goals.mealsByDate[k]=n;
  if(k===dk(new Date())) state.data.goals.meals=n; // oggi aggiorna anche il default per i giorni futuri
  await saveData(); render();
}
```

- [ ] **Step 5: Snapshot del numero pasti quando si registra un pasto (in `addPlannedFeed`, riga 1163).**

Nella funzione:
```js
async function addPlannedFeed(bn, feed){
  const key=dk(state.selDate);
  if(!state.data[key]) state.data[key]={};
```
inserisci subito dopo `const key=dk(state.selDate);`:
```js
  if(!state.data.goals) state.data.goals={};
  if(!state.data.goals.mealsByDate) state.data.goals.mealsByDate={};
  if(typeof state.data.goals.mealsByDate[key]!=='number') state.data.goals.mealsByDate[key]=getGoalMeals(key); // congela il giorno alla prima poppata
```

- [ ] **Step 6: Aggiungi il flag di sblocco emergenza allo state (riga 352).**

Nella riga:
```js
let state = { data: {}, baby: "Gabriel", tab: "feed", view: "today", trendsBaby: "Gabriel", selDate: new Date(), viewMonth: new Date(), syncStatus: "local", calExpanded: false, fabOpen: false };
```
aggiungi `, goalMealsForceEditKey: null` prima della graffa di chiusura:
```js
let state = { data: {}, baby: "Gabriel", tab: "feed", view: "today", trendsBaby: "Gabriel", selDate: new Date(), viewMonth: new Date(), syncStatus: "local", calExpanded: false, fabOpen: false, goalMealsForceEditKey: null };
```

- [ ] **Step 7: Verifica logica (data-safe).**

Esegui l'Harness H1-H3. Poi in console valuta:
```js
(() => {
  const k = dk(state.selDate);
  const a = [
    avgDailyMl('Gabriel', dkToDate(k)) === 800,
    effectiveTargetMl('Gabriel', k) === 800,
    isManualTarget('Gabriel', k) === false,
    getGoalMeals(k) === 5,
    (state.data.goals.targetByDate === undefined),
  ];
  return a;
})();
```
Atteso: `[true,true,true,true,true]`. Poi testa override in-memory (senza cloud, `useSupabase` è off):
```js
setManualTarget('Gabriel', dk(state.selDate), 900).then(()=>console.log('manual=',effectiveTargetMl('Gabriel',dk(state.selDate)), isManualTarget('Gabriel',dk(state.selDate))));
```
Atteso: `manual= 900 true`. Poi `clearManualTarget` → torna 800/false.

- [ ] **Step 8: Commit.**

```bash
git add index.html
git commit -m "Obiettivi: helper per override manuale target e media relativa al giorno"
```

---

## Task 2: Wiring di `buildGoals` al target effettivo (comportamento invariato per oggi)

Collega `buildGoals` ai nuovi helper senza cambiare ancora l'aspetto: oggi deve restare identico.

**Files:**
- Modify: `index.html:1175-1276` (`buildGoals`).

**Interfaces — Consumes:** `effectiveTargetMl`, `getGoalMeals(key)`, `isManualTarget` (Task 1). **Produces:** variabili locali `isPast`, target basati su override.

- [ ] **Step 1: Riordina l'header di `buildGoals` e calcola `n` per-giorno (righe 1175-1181).**

Sostituisci:
```js
function buildGoals(){
  const n=getGoalMeals();
  const lastMealMin=(()=>{ const p=getGoalLastMeal().split(':'); return parseInt(p[0])*60+parseInt(p[1]); })();
  const key=dk(state.selDate), todayK=dk(new Date());
  const isToday=key===todayK;
  const dateLabel=isToday?'Oggi':`${state.selDate.getDate()} ${MONTHS[state.selDate.getMonth()]}`;
```
con:
```js
function buildGoals(){
  const key=dk(state.selDate), todayK=dk(new Date());
  const isToday=key===todayK;
  const isPast=key<todayK;
  const n=getGoalMeals(key);
  const lastMealMin=(()=>{ const p=getGoalLastMeal().split(':'); return parseInt(p[0])*60+parseInt(p[1]); })();
  const dateLabel=isToday?'Oggi':`${state.selDate.getDate()} ${MONTHS[state.selDate.getMonth()]}`;
```

- [ ] **Step 2: Usa il target effettivo nel recap (riga 1194) e nella griglia (riga 1224).**

Riga 1194: sostituisci
```js
    const col=COLORS[bn], avg=avgDailyMl(bn);
```
con
```js
    const col=COLORS[bn], avg=effectiveTargetMl(bn,key), manual=isManualTarget(bn,key);
```
Riga 1224: sostituisci
```js
    const dailyTarget=avgDailyMl(bn);                    // media giornaliera prefissata (obiettivo del giorno)
```
con
```js
    const dailyTarget=effectiveTargetMl(bn,key);         // obiettivo del giorno (override manuale o media relativa)
```

- [ ] **Step 3: Verifica invarianza su "oggi".**

Harness H1-H4 (aggiorna `_sandbox.html`, ricarica, riseeda). Su "Oggi" la scheda deve mostrare, come prima: Gabriel "Media 7gg 800 ml", ml/pasto ricalcolato, slot con orari e "· prossimo". Nessuna regressione visiva. Screenshot di conferma.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "Obiettivi: buildGoals usa il target effettivo e il numero pasti per-giorno"
```

---

## Task 3: UI override manuale (etichetta tappabile + modale)

**Files:**
- Modify: `index.html:1200-1208` (blocco recap per-bambino), aggiungi funzioni dopo `submitGoalMeal` (riga 1346).

**Interfaces — Consumes:** `getManualTarget`, `avgDailyMl(ref)`, `setManualTarget`, `clearManualTarget`, `dkToDate` (Task 1). **Produces:** `openTargetModal(bn,key)`, `saveTargetModal(bn,key)`.

- [ ] **Step 1: Sostituisci il blocco recap per-bambino (righe 1200-1208).**

Sostituisci:
```js
    h+=`<div class="recap-card" style="--cardgrad:${col.grad}"><div class="recap-name" style="color:${col.pri}">${bn}</div>`;
    if(avg>0){
      h+=`<div style="font-size:11px;color:var(--sub)">Media 7gg <b style="color:var(--txt)">${avg} ml</b></div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:4px"><span style="font-size:24px;font-weight:800;color:${col.pri};letter-spacing:-0.02em">${per}</span><span style="font-size:12px;color:var(--sub);font-weight:600">ml / pasto</span></div>
      ${dDone>0?`<div style="font-size:10px;color:var(--hint);margin-top:2px">ricalcolato · presi ${dCons} ml, restano ${dRem} pasti</div>`:''}`;
    } else {
      h+=`<div style="font-size:11px;color:var(--hint);line-height:1.5;margin-top:2px">Inserisci qualche poppata per calcolare il target.</div>`;
    }
    h+=`</div>`;
```
con:
```js
    h+=`<div class="recap-card" style="--cardgrad:${col.grad}"><div class="recap-name" style="color:${col.pri}">${bn}</div>`;
    if(avg>0){
      const labelHtml = manual
        ? `<div style="font-size:11px;color:var(--amber);font-weight:700;cursor:pointer" onclick="openTargetModal('${bn}','${key}')">✏️ Manuale <b>${avg} ml</b></div>`
        : `<div style="font-size:11px;color:var(--sub);cursor:pointer" onclick="openTargetModal('${bn}','${key}')">Media 7gg <b style="color:var(--txt)">${avg} ml</b> ✏️</div>`;
      h+=labelHtml+`
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:4px"><span style="font-size:24px;font-weight:800;color:${col.pri};letter-spacing:-0.02em">${per}</span><span style="font-size:12px;color:var(--sub);font-weight:600">ml / pasto</span></div>
      ${dDone>0?`<div style="font-size:10px;color:var(--hint);margin-top:2px">ricalcolato · presi ${dCons} ml, restano ${dRem} pasti</div>`:''}
      ${manual?`<div style="font-size:10px;margin-top:3px"><a href="#" onclick="clearManualTarget('${bn}','${key}');return false" style="color:var(--sub);font-weight:600">↺ torna alla media</a></div>`:''}`;
    } else {
      h+=`<div style="font-size:11px;color:var(--hint);line-height:1.5;margin-top:2px;cursor:pointer" onclick="openTargetModal('${bn}','${key}')">Nessuna media · tocca per impostare un obiettivo manuale ✏️</div>`;
    }
    h+=`</div>`;
```

- [ ] **Step 2: Aggiungi le funzioni modale dopo `submitGoalMeal` (dopo riga 1346).**

Dopo la chiusura di `submitGoalMeal` (`}` a riga 1346) inserisci:
```js
function openTargetModal(bn, key){
  const c=COLORS[bn];
  const cur=getManualTarget(bn,key);
  const avg=avgDailyMl(bn, dkToDate(key));
  const val=(cur!==undefined)?cur:(avg||'');
  const dayTxt = key===dk(new Date()) ? 'oggi' : 'questo giorno';
  setModal(`<div class="modal-bg" onclick="closeModal()"><div class="modal" onclick="event.stopPropagation()"><div class="modal-handle"></div>
    <div class="modal-title" style="color:${c.acc}">Obiettivo giornaliero — ${bn}</div>
    <div class="form-label">Media 7gg calcolata: <b>${avg||0} ml</b></div>
    <div class="form-label" style="margin-top:8px">Obiettivo manuale (ml al giorno)</div>
    <input class="form-input big" type="number" inputmode="numeric" id="tgt-ml" value="${val}" placeholder="es. 800" style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--hint);margin-bottom:12px">Vale solo per ${dayTxt}. Il ml per pasto si ricalcola da qui.</div>
    <div class="form-actions">
      ${cur!==undefined?`<button class="btn-cancel" onclick="clearManualTarget('${bn}','${key}')">↺ Torna alla media</button>`:`<button class="btn-cancel" onclick="closeModal()">Annulla</button>`}
      <button class="btn-save" style="background:${c.grad}" onclick="saveTargetModal('${bn}','${key}')">Salva</button>
    </div>
  </div></div>`);
}
function saveTargetModal(bn, key){
  const el=document.getElementById('tgt-ml');
  if(!el || el.value===''){ closeModal(); return; }
  setManualTarget(bn, key, el.value);
}
```

- [ ] **Step 3: Verifica UI (data-safe).**

Harness H1-H4. Su Obiettivi:
1. Tocca la riga "Media 7gg 800 ml" di Gabriel → si apre il modale, mostra "Media 7gg calcolata: 800 ml".
2. Inserisci 900, Salva → l'etichetta diventa ambra "✏️ Manuale 900 ml", il ml/pasto si ricalcola, compare "↺ torna alla media".
3. `read_console_messages` per assenza errori; screenshot.
4. Clicca "↺ torna alla media" → torna "Media 7gg 800 ml".

Nota: qui `setManualTarget` chiama `saveData`, ma nel sandbox `useSupabase` è off → scrive solo il localStorage sandbox, nessun cloud.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "Obiettivi: modale e etichetta per override manuale della media"
```

---

## Task 4: Cristallizzazione della griglia nei giorni passati

Sui giorni passati: niente proiezioni orarie, niente "· prossimo"; gli slot mancanti restano liberi con la sola quantità stimata (≈ ml).

**Files:**
- Modify: `index.html:1246-1266` (ramo `else` degli slot pending).

**Interfaces — Consumes:** `isPast` (Task 2), `anchorMin`, `lastMealMin`, `remainingPer`, `dailyTarget` (esistenti).

- [ ] **Step 1: Sostituisci il ramo pending (righe 1246-1266).**

Sostituisci:
```js
      } else {
        const isNext=(j===done+1);
        // Orari ancorati all'ultimo pasto consumato; i rimanenti si distribuiscono così che
        // l'ULTIMO cada esattamente all'orario impostato (lastMeal) e niente dopo.
        let timeHtml='';
        if(anchorMin!=null){
          let raw;
          if(j===n){ raw=lastMealMin; }                          // l'ultimo pasto è esattamente all'orario scelto
          else {
            const remaining=n-done;
            const step=(lastMealMin>anchorMin && remaining>0)?(lastMealMin-anchorMin)/remaining:0;
            raw=Math.min(Math.round((anchorMin+step*(j-done))/15)*15, lastMealMin);
          }
          timeHtml=`<span class="goal-slot-time" style="opacity:.7;font-weight:600">${ft(Math.floor(raw/60),raw%60)}</span>`;
        }
        const qLabel=dailyTarget>0?`≈ ${remainingPer} ml`:'imposta media';
        h+=`<div class="goal-slot pending${isNext?' next':''}" style="--slotcol:${col.pri}" onclick="openGoalMeal('${bn}',${j},${remainingPer})">
          <div class="goal-slot-idx">${j}° pasto${isNext?' · prossimo':''}</div>
          <div class="goal-slot-main">${timeHtml}<span class="goal-slot-ml" style="color:${col.pri}">${qLabel}</span></div>
        </div>`;
      }
```
con:
```js
      } else {
        const isNext=!isPast && (j===done+1);
        // Solo per oggi/futuro proiettiamo gli orari; i giorni passati restano "liberi" (nessuna proiezione).
        let timeHtml='';
        if(!isPast && anchorMin!=null){
          let raw;
          if(j===n){ raw=lastMealMin; }                          // l'ultimo pasto è esattamente all'orario scelto
          else {
            const remaining=n-done;
            const step=(lastMealMin>anchorMin && remaining>0)?(lastMealMin-anchorMin)/remaining:0;
            raw=Math.min(Math.round((anchorMin+step*(j-done))/15)*15, lastMealMin);
          }
          timeHtml=`<span class="goal-slot-time" style="opacity:.7;font-weight:600">${ft(Math.floor(raw/60),raw%60)}</span>`;
        }
        const qLabel=dailyTarget>0?`≈ ${remainingPer} ml`:'imposta media';
        h+=`<div class="goal-slot pending${isNext?' next':''}" style="--slotcol:${col.pri}" onclick="openGoalMeal('${bn}',${j},${remainingPer})">
          <div class="goal-slot-idx">${j}° pasto${isNext?' · prossimo':''}</div>
          <div class="goal-slot-main">${timeHtml}<span class="goal-slot-ml" style="color:${col.pri}">${qLabel}</span></div>
        </div>`;
      }
```

- [ ] **Step 2: Verifica giorni passati vs oggi (data-safe).**

Harness H1-H4. Poi:
1. In console: `state.selDate=new Date(); state.selDate.setDate(state.selDate.getDate()-1); render();` e vai su Obiettivi (o clicca ‹). Giorno passato: gli slot non registrati mostrano solo "≈ X ml" senza orario e senza "· prossimo".
2. Torna a oggi (‹/›): gli orari proiettati e "· prossimo" ricompaiono.
3. Verifica che cliccando uno slot passato si apra `openGoalMeal` (inserimento pasto mancante) — poi **chiudi senza confermare** (non creare pasti). Screenshot.

- [ ] **Step 3: Commit.**

```bash
git add index.html
git commit -m "Obiettivi: giorni passati senza proiezioni orarie, slot liberi con stima ml"
```

---

## Task 5: Blocco selettore "Pasti al giorno" nei giorni passati (con sblocco emergenza)

**Files:**
- Modify: `index.html:1185-1187` (label + select del selettore pasti).

**Interfaces — Consumes:** `isPast` (Task 2), `state.goalMealsForceEditKey` (Task 1 Step 6), `key`, `n`.

- [ ] **Step 1: Sostituisci il blocco selettore pasti (righe 1185-1187).**

Sostituisci:
```js
  h+=`<div class="form-label">Pasti al giorno</div>`;
  h+=`<select class="form-select" style="width:100%" onchange="setGoalMeals(this.value)">${[4,5,6,7].map(v=>`<option value="${v}"${v===n?' selected':''}>${v} pasti</option>`).join('')}</select>`;
  h+=`<div style="font-size:11px;color:var(--hint);margin-top:8px;line-height:1.5">Stesso latte totale, meno pasti: la quantità per pasto viene ricalcolata dalla media degli ultimi 7 giorni.</div>`;
```
con:
```js
  const mealsLocked = isPast && state.goalMealsForceEditKey!==key;
  h+=`<div class="form-label">Pasti al giorno</div>`;
  h+=`<select class="form-select" style="width:100%"${mealsLocked?' disabled':''} onchange="setGoalMeals(this.value)">${[4,5,6,7].map(v=>`<option value="${v}"${v===n?' selected':''}>${v} pasti</option>`).join('')}</select>`;
  if(mealsLocked){
    h+=`<div style="font-size:11px;color:var(--hint);margin-top:8px;line-height:1.5">🔒 Giorno passato: numero pasti congelato per non riscrivere la storia. <a href="#" onclick="state.goalMealsForceEditKey='${key}';render();return false" style="color:var(--amber);font-weight:700">Sblocca (emergenza)</a></div>`;
  } else {
    h+=`<div style="font-size:11px;color:var(--hint);margin-top:8px;line-height:1.5">Stesso latte totale, meno pasti: la quantità per pasto viene ricalcolata dalla media degli ultimi 7 giorni.</div>`;
  }
```

- [ ] **Step 2: Verifica blocco/sblocco (data-safe).**

Harness H1-H4. Poi:
1. Vai su un giorno passato → il select "Pasti al giorno" è disabilitato (grigio) con testo "🔒 Giorno passato… Sblocca (emergenza)".
2. Clicca "Sblocca (emergenza)" → il select diventa modificabile; cambia a 6 → cambia SOLO quel giorno (`mealsByDate[quelGiorno]`), non il default globale (in console: `state.data.goals.meals` invariato, `state.data.goals.mealsByDate[quelGiorno]===6`).
3. Torna a oggi → il select è attivo come prima, valore = default. Screenshot dello stato bloccato.

- [ ] **Step 3: Commit.**

```bash
git add index.html
git commit -m "Obiettivi: selettore pasti bloccato sui giorni passati con sblocco d'emergenza"
```

---

## Task 6: Card allineate e della stessa altezza

**Files:**
- Modify: `index.html:150` (`.goal-slot`).

- [ ] **Step 1: Aggiungi altezza uniforme a `.goal-slot` (riga 150).**

Sostituisci:
```css
.goal-slot { position: relative; background: var(--glass); border: 1px solid var(--glass-brd); border-radius: var(--r-sm); padding: 9px 10px 9px 14px; margin-bottom: 7px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.15s; overflow: hidden; }
```
con:
```css
.goal-slot { position: relative; background: var(--glass); border: 1px solid var(--glass-brd); border-radius: var(--r-sm); padding: 9px 10px 9px 14px; margin-bottom: 7px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.15s; overflow: hidden; box-sizing: border-box; min-height: 62px; display: flex; flex-direction: column; justify-content: center; }
```

- [ ] **Step 2: Verifica allineamento (data-safe) e taratura pixel.**

Harness H1-H4 con lo scenario seed (Gabriel ha "avanzati 40", Vittorio "avanzati 20": entrambi con badge). Poi crea asimmetria in console per il caso critico:
```js
state.data[dk(state.selDate)].Vittorio.feeds[0].leftover=0; // Vittorio senza badge
render();
```
Vai su Obiettivi: la riga "1° pasto" di Gabriel (con badge) e di Vittorio (senza badge) devono avere **la stessa altezza** e le due colonne restare allineate per tutti gli slot successivi. Misura in console:
```js
(()=>{const s=[...document.querySelectorAll('.goal-slot')].slice(0,2).map(e=>e.getBoundingClientRect().height);return s;})();
```
Atteso: le due altezze coincidono. Se un badge sfora `min-height`, aumenta `min-height` (es. 66px) e ripeti. Screenshot finale.

- [ ] **Step 3: Commit.**

```bash
git add index.html
git commit -m "Obiettivi: caselle pasto ad altezza uniforme, colonne sempre allineate"
```

---

## Task 7: Verifica (ed eventuale fix) del badge "di più"

Il badge verde `+X ml in più` è già nel codice (`goal-more-badge`, riga 1240). Verifica che si mostri davvero; se rotto, correggi.

**Files:**
- Inspect: `index.html:1235-1245` (rendering slot done), `index.html:1332-1345` (`submitGoalMeal`). Modify solo se si trova un bug.

- [ ] **Step 1: Verifica rendering "di più" (data-safe, senza creare pasti reali).**

Harness H1-H3. Poi in console costruisci uno stato con un pasto "di più" e ispeziona l'HTML SENZA salvare:
```js
const k=dk(state.selDate);
state.data[k].Gabriel.feeds=[{id:'more1',time:'06:00',ml:210,planned:true,target:170,leftover:0,extra:40}];
render();
const html=buildGoals();
console.log('badge più presente:', html.includes('ml in più'));
```
Atteso: `badge più presente: true`. Vai su Obiettivi: lo slot di Gabriel mostra "210 ml" e il badge verde "+40 ml in più". Screenshot.

- [ ] **Step 2: Se il badge NON appare, diagnostica e correggi.**

Controlla: `f.planned` truthy? `f.extra>0`? `.goal-more-badge` definito (riga 167)? Applica il fix minimo necessario mantenendo il vincolo dati. Se invece appare correttamente, nessuna modifica al codice — è confermato che in v10 funziona (probabile cache sul dispositivo dell'utente).

- [ ] **Step 3: Commit (solo se è stato applicato un fix).**

```bash
git add index.html
git commit -m "Obiettivi: fix visualizzazione badge '+ml in più'"
```
Se nessun fix: nessun commit; annota nell'handoff che il badge è confermato funzionante in v10.

- [ ] **Step 4: Cleanup finale.**

```bash
rm -f _sandbox.html
git status   # _sandbox.html NON deve comparire
```

---

## Self-Review (spec coverage)

- Spec §1 Override manuale → Task 1 (helper) + Task 3 (UI). ✓
- Spec §2 Cristallizzazione: media relativa → Task 1 Step 2; pasti per-giorno + snapshot → Task 1 Step 4-5; niente proiezioni passate → Task 4; selettore bloccato con sblocco → Task 5. ✓
- Spec §3 Badge "di più" (già presente) → Task 7. ✓
- Spec §4 Card allineate → Task 6. ✓
- Vincolo sicurezza dati → Global Constraints + Verification Harness sandbox (cloud off, dati sintetici, no saveData sui dati reali). ✓
- Nota merge cloud (goals last-writer-wins): i nuovi campi `mealsByDate`/`targetByDate` vivono in `goals`, coerente con `meals`/`lastMeal` esistenti (nessuna modifica a `mergeData`). ✓
