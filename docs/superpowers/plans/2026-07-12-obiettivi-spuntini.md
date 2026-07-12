# Obiettivi — gestione spuntini — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcare una poppata come "spuntino" così che negli Obiettivi non occupi uno slot di pasto pianificato ma i suoi ml contino comunque nel totale giornaliero.

**Architecture:** App single-file (`index.html`), JS vanilla, nessun framework di test. Un flag booleano `snack` sul feed (impostato solo da azione utente nel modale poppata) separa pasti veri e spuntini in `buildGoals`. Verifica su copia sandbox con cloud Supabase disattivato e dati sintetici.

**Tech Stack:** HTML/CSS/JS inline; server statico `.claude/serve.js` (localhost:8765); anteprima via Browser tools; localStorage; Supabase (disattivato nei test).

## Global Constraints

- **NON NEGOZIABILE — nessuna mutazione automatica dei pasti:** l'implementazione non crea/sposta/cancella `feeds`. Il flag `snack` è metadata impostato solo da azione utente tramite la scheda di modifica poppata. Nessuna modifica alla logica di merge/tombstone.
- **File unico:** tutte le modifiche in `index.html`; nessuna dipendenza nuova (a parte `_sandbox.html`, mai committato).
- **"Scala dal totale":** i ml dello spuntino sono inclusi in `consumedSoFar` (contano verso l'obiettivo); gli spuntini NON contano come slot pianificati.
- **Formato date:** chiavi `YYYY-MM-DD` via `dk`; feeds mantenuti ordinati per orario (`sort` in `addEntry`/`addPlannedFeed`), quindi ordine array = ordine cronologico.

---

## Verification Harness (data-safe) — riusato da ogni task

Non committare mai `_sandbox.html`.

**H1. Copia sandbox cloud-OFF dalle sorgenti correnti:**
```bash
sed 's#const SUPABASE_ANON_KEY = "[^"]*";#const SUPABASE_ANON_KEY = "";#' index.html > _sandbox.html
grep -c 'SUPABASE_ANON_KEY = ""' _sandbox.html   # atteso: 1
```

**H2. Server** (se non attivo): `node .claude/serve.js`. Apri nel Browser `http://localhost:8765/_sandbox.html`, sblocca con password `Ebby`.

**H3. Semina dati sintetici** (console via javascript_tool; non chiama `saveData`, cloud comunque off). Scenario 11 luglio: 5 pasti veri + 1 spuntino, n=5:
```js
useSupabase = () => false;
sessionStorage.setItem('pappatracker_auth','true');
const _key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _ago = n => { const x=new Date(); x.setDate(x.getDate()-n); return _key(x); };
const today=new Date();
state.data={ goals:{ meals:5, lastMeal:'22:00' } };
for(let i=1;i<=7;i++){ const k=_ago(i);
  state.data[k]={ Gabriel:{feeds:[{id:'g'+i,time:'08:00',ml:200},{id:'g'+i+'b',time:'12:00',ml:200},{id:'g'+i+'c',time:'16:00',ml:200},{id:'g'+i+'d',time:'20:00',ml:200}]},
                  Vittorio:{feeds:[{id:'v'+i,time:'08:00',ml:170}]} }; }
// oggi Gabriel: 4 pasti veri + 1 spuntino (14:30, 40ml) + pasto serale = 5 pasti veri + 1 spuntino
state.data[_key(today)]={ Gabriel:{feeds:[
  {id:'m1',time:'06:00',ml:150,planned:true,target:170},
  {id:'m2',time:'09:30',ml:160,planned:true,target:170},
  {id:'sn',time:'11:30',ml:40,snack:true},
  {id:'m3',time:'13:00',ml:160,planned:true,target:170},
  {id:'m4',time:'17:00',ml:160,planned:true,target:170},
  {id:'m5',time:'20:30',ml:150,planned:true,target:170}
]}, Vittorio:{feeds:[{id:'w1',time:'06:00',ml:120}]} };
state.selDate=today; state.tab='goals'; state.view='goals'; render();
```

**H4. Vai su Obiettivi** (clic sulla voce "Obiettivi" nella tab bar) oppure valuta `buildGoals()` per ispezionare l'HTML nei test di logica.

**H5. Cleanup a fine sessione:** `rm -f _sandbox.html`; ferma il server; `git status` → `_sandbox.html` non deve comparire.

---

## File Structure

- **Modify:** `index.html` — unico file:
  - `showModal` (~riga 1417), `openAdd` (~1408), `openEdit` (~1411), `submitForm` (~1430) — toggle spuntino.
  - `buildGoals` recap (~righe 1230-1233) e griglia (~1258-1308) — separazione pasti/spuntini, mappatura slot, calcoli, display, riepilogo.
  - CSS Goals (~righe 166-169) — classe `.goal-snack`.
- **Temp (mai committato):** `_sandbox.html`.

---

## Task 1: Interruttore "🍪 Spuntino" nella scheda poppata

Aggiunge il toggle nel modale poppata (aggiunta + modifica) e lo persiste sul feed. Nessun effetto ancora sulla griglia Obiettivi (che verrà aggiornata nel Task 2): dopo questo task, marcare uno spuntino salva `snack:true` ma la griglia lo mostra ancora come slot — stato intermedio coerente.

**Files:**
- Modify: `index.html` — `showModal`, `openAdd`, `openEdit`, `submitForm`.

**Interfaces — Produces:** feed con campo opzionale `snack:true`; `showModal(h,m,ml,ftype,fnote,dtype,dcolor,dnote,fsnack)` (nuovo 9° parametro).

- [ ] **Step 1: Aggiungi il parametro `fsnack` e il toggle in `showModal`.**

Sostituisci la riga della firma (`index.html:1417`):
```js
function showModal(h,m,ml,ftype,fnote,dtype,dcolor,dnote){
```
con:
```js
function showModal(h,m,ml,ftype,fnote,dtype,dcolor,dnote,fsnack){
```
Poi, nel ramo `if(isF){...}` (`index.html:1422`), sostituisci l'intera assegnazione di `fields` per le poppate:
```js
  if(isF){fields=`<div class="form-label">Quantità (ml)</div><input class="form-input big" type="number" inputmode="numeric" id="f-ml" value="${ml}" placeholder="es. 120" style="margin-bottom:12px"><div class="form-label">Tipo</div><div class="chips" id="f-type-chips">${FEED_TYPES.map(t=>`<button class="chip${ftype===t?' on':''}" data-val="${t}" onclick="pickChip('f-type-chips','${t}')">${t==='Formula'?'🍼 Formula':'🤱 Materno'}</button>`).join("")}</div><div class="form-label">Note (opzionale)</div><input class="form-input" id="f-note" value="${fnote}" placeholder="es. rigurgito..." style="margin-bottom:12px">`;}
```
con (aggiunge il blocco chips "Pasto/Spuntino" dopo il Tipo):
```js
  if(isF){fields=`<div class="form-label">Quantità (ml)</div><input class="form-input big" type="number" inputmode="numeric" id="f-ml" value="${ml}" placeholder="es. 120" style="margin-bottom:12px"><div class="form-label">Tipo</div><div class="chips" id="f-type-chips">${FEED_TYPES.map(t=>`<button class="chip${ftype===t?' on':''}" data-val="${t}" onclick="pickChip('f-type-chips','${t}')">${t==='Formula'?'🍼 Formula':'🤱 Materno'}</button>`).join("")}</div><div class="form-label">Pasto o spuntino</div><div class="chips" id="f-snack-chips"><button class="chip${!fsnack?' on':''}" data-val="meal" onclick="pickChip('f-snack-chips','meal')">🍽️ Pasto</button><button class="chip${fsnack?' on':''}" data-val="snack" onclick="pickChip('f-snack-chips','snack')">🍪 Spuntino</button></div><div class="form-label">Note (opzionale)</div><input class="form-input" id="f-note" value="${fnote}" placeholder="es. rigurgito..." style="margin-bottom:12px">`;}
```

- [ ] **Step 2: Passa `fsnack` dai chiamanti `openAdd` e `openEdit`.**

`openAdd` (`index.html:1408-1410`): sostituisci
```js
function openAdd(){
  state._editIdx=null;const n=new Date();showModal(n.getHours(),n.getMinutes(),"","Formula","","Cacca","","");
}
```
con
```js
function openAdd(){
  state._editIdx=null;const n=new Date();showModal(n.getHours(),n.getMinutes(),"","Formula","","Cacca","","",false);
}
```
`openEdit` (`index.html:1411-1416`): sostituisci
```js
function openEdit(idx){
  state._editIdx=idx;const key=dk(state.selDate),sec=state.tab==="feed"?"feeds":"diapers",e=state.data[key][state.baby][sec][idx];
  const[h,m]=e.time.split(":").map(Number);
  if(state.tab==="feed")showModal(h,m,String(e.ml),e.type,e.note||"","Cacca","","");
  else showModal(h,m,"","Formula","",e.dtype,e.color||"",e.note||"");
}
```
con
```js
function openEdit(idx){
  state._editIdx=idx;const key=dk(state.selDate),sec=state.tab==="feed"?"feeds":"diapers",e=state.data[key][state.baby][sec][idx];
  const[h,m]=e.time.split(":").map(Number);
  if(state.tab==="feed")showModal(h,m,String(e.ml),e.type,e.note||"","Cacca","","",!!e.snack);
  else showModal(h,m,"","Formula","",e.dtype,e.color||"",e.note||"",false);
}
```

- [ ] **Step 3: Leggi il toggle in `submitForm` e salva il flag.**

`submitForm` (`index.html:1430-1434`): sostituisci
```js
function submitForm(){
  const h=parseInt(document.getElementById("f-h").value),m=parseInt(document.getElementById("f-m").value),time=ft(h,m);
  if(state.tab==="feed"){const ml=parseInt(document.getElementById("f-ml").value);if(!ml||isNaN(ml))return;addEntry({time,ml,type:getChip("f-type-chips")||"Formula",note:document.getElementById("f-note").value.trim()});}
  else{addEntry({time,dtype:getChip("d-type-chips")||"Cacca",color:document.getElementById("d-color").value.trim(),note:document.getElementById("d-note").value.trim()});}
}
```
con
```js
function submitForm(){
  const h=parseInt(document.getElementById("f-h").value),m=parseInt(document.getElementById("f-m").value),time=ft(h,m);
  if(state.tab==="feed"){const ml=parseInt(document.getElementById("f-ml").value);if(!ml||isNaN(ml))return;const entry={time,ml,type:getChip("f-type-chips")||"Formula",note:document.getElementById("f-note").value.trim()};if(getChip("f-snack-chips")==="snack")entry.snack=true;addEntry(entry);}
  else{addEntry({time,dtype:getChip("d-type-chips")||"Cacca",color:document.getElementById("d-color").value.trim(),note:document.getElementById("d-note").value.trim()});}
}
```

- [ ] **Step 4: Verifica statica.**

```bash
grep -nE "function showModal\(h,m,ml,ftype,fnote,dtype,dcolor,dnote,fsnack\)|f-snack-chips|getChip\(\"f-snack-chips\"\)===\"snack\"|,false\);|,!!e.snack\);" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"  # open==close
```

- [ ] **Step 5: Verifica live (data-safe).**

Harness H1-H2. In console: apri un nuovo add poppata da codice non serve — verifica via flusso: `state.baby='Gabriel'; state.tab='feed'; state.selDate=new Date(); openAdd();` poi controlla che il modale contenga i chip:
```js
!!document.getElementById('f-snack-chips')
```
Atteso `true`. Chiudi (`closeModal()`). Poi simula un edit di uno spuntino esistente:
```js
state.tab='feed'; state.baby='Gabriel';
state.data[dk(state.selDate)]={Gabriel:{feeds:[{id:'x',time:'11:00',ml:40,snack:true,type:'Formula'}]}};
openEdit(0);
document.querySelector('#f-snack-chips .chip.on')?.dataset.val;  // atteso: 'snack'
```
Atteso `'snack'` (il toggle riflette lo stato). `closeModal()`.

- [ ] **Step 6: Commit.**

```bash
git add index.html
git commit -m "Poppate: interruttore Spuntino nella scheda (aggiunta + modifica)"
```

---

## Task 2: Griglia Obiettivi — gli spuntini non occupano slot

Separa pasti veri e spuntini in `buildGoals`, mappa gli slot solo ai pasti veri, mostra gli spuntini a parte, e aggiorna calcoli/riepilogo. Include la classe CSS `.goal-snack`.

**Files:**
- Modify: `index.html` — CSS Goals (~166-169), recap sezione A (~1230-1233), griglia sezione B (~1258-1308).

**Interfaces — Consumes:** `effectiveTargetMl`, `isPast`, `n`, `lastMealMin`, `editPlannedSlot`, `openGoalMeal` (esistenti); feed con campo `snack` (Task 1).

- [ ] **Step 1: Aggiungi la classe CSS `.goal-snack` dopo `.goal-summary` (`index.html:169`).**

Dopo la riga:
```css
.goal-summary { font-size: 10px; color: var(--sub); text-align: center; margin-top: 4px; font-weight: 600; }
```
inserisci:
```css
.goal-snack { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--glass-2); border: 1px dashed var(--glass-brd); border-radius: var(--r-sm); padding: 6px 10px; margin-bottom: 7px; cursor: pointer; }
.goal-snack-lbl { font-size: 10px; font-weight: 800; color: var(--amber); white-space: nowrap; }
.goal-snack-main { display: flex; align-items: baseline; gap: 6px; }
.goal-snack .goal-slot-time { font-size: 12px; }
.goal-snack .goal-slot-ml { font-size: 12px; color: var(--sub); }
```

- [ ] **Step 2: Aggiorna il recap di sezione A per contare solo i pasti veri negli slot (`index.html:1230-1233`).**

Sostituisci:
```js
    const dFeeds=state.data[key]?.[bn]?.feeds||[];
    const dDone=dFeeds.length, dCons=dFeeds.reduce((s,x)=>s+(x.ml||0),0);
    const dRem=Math.max(0, n-dDone);
    const per=(avg>0 && dRem>0)?Math.max(0,Math.round((avg-dCons)/dRem/5)*5):(avg>0?Math.round(avg/n/5)*5:0);
```
con:
```js
    const dFeeds=state.data[key]?.[bn]?.feeds||[];
    const dDone=dFeeds.filter(f=>!f.snack).length;               // solo pasti veri occupano slot
    const dCons=dFeeds.reduce((s,x)=>s+(x.ml||0),0);              // ml totali (spuntini inclusi)
    const dRem=Math.max(0, n-dDone);
    const per=(avg>0 && dRem>0)?Math.max(0,Math.round((avg-dCons)/dRem/5)*5):(avg>0?Math.round(avg/n/5)*5:0);
```

- [ ] **Step 3: Sostituisci il corpo del `BABIES.forEach` della griglia (`index.html:1258-1308`).**

Sostituisci l'intero blocco (dalla riga `BABIES.forEach(bn=>{` che apre la griglia, `index.html:1258`, fino alla sua `});` di chiusura a `index.html:1308`) con:
```js
  BABIES.forEach(bn=>{
    const col=COLORS[bn];
    const allFeeds=state.data[key]?.[bn]?.feeds||[];
    const meals=[], snacks=[];
    allFeeds.forEach((f,idx)=>{ (f.snack?snacks:meals).push({...f,_i:idx}); }); // _i = indice reale nell'array feeds
    const realDone=meals.length;
    const dailyTarget=effectiveTargetMl(bn,key);         // obiettivo del giorno (override manuale o media relativa)
    const consumedSoFar=allFeeds.reduce((s,x)=>s+(x.ml||0),0); // gli spuntini contano nel totale
    const remainingSlots=Math.max(0, n-realDone);
    // Ricalcolo quantità: il residuo per arrivare all'obiettivo diviso i pasti rimasti (multipli di 5).
    const remainingPer=(dailyTarget>0 && remainingSlots>0)?Math.max(0,Math.round((dailyTarget-consumedSoFar)/remainingSlots/5)*5):0;
    const anchor=realDone>0?meals[realDone-1].time:null;  // tabella di marcia ancorata all'ultimo pasto vero
    const anchorMin=anchor?(parseInt(anchor.split(':')[0])*60+parseInt(anchor.split(':')[1])):null;
    h+=`<div><div class="goal-col-head" style="color:${col.pri}">${bn}</div>`;
    for(let j=1;j<=n;j++){
      if(j<=realDone){
        const f=meals[j-1];
        const hasLeft=f.planned&&f.leftover>0;
        const hasMore=f.planned&&f.extra>0;
        const cls=hasLeft?'leftover':'done';
        const mlCol=hasLeft?'var(--red)':col.pri;
        const badge=hasLeft?`<div class="goal-left-badge">avanzati ${f.leftover} ml</div>`
                  :hasMore?`<div class="goal-more-badge">+${f.extra} ml in più</div>`:'';
        h+=`<div class="goal-slot ${cls}" style="--slotcol:${col.pri}" onclick="editPlannedSlot('${bn}',${f._i})">
          <div class="goal-slot-idx"><span class="${hasLeft?'goal-warn':'goal-check'}">${hasLeft?'⚠':'✓'}</span>${j}° pasto</div>
          <div class="goal-slot-main"><span class="goal-slot-time">${f.time}</span><span class="goal-slot-ml" style="color:${mlCol}">${f.ml} ml</span></div>
          ${badge}
        </div>`;
      } else {
        const isNext=!isPast && (j===realDone+1);
        // Solo per oggi/futuro proiettiamo gli orari; i giorni passati restano "liberi" (nessuna proiezione).
        let timeHtml='';
        if(!isPast && anchorMin!=null){
          let raw;
          if(j===n){ raw=lastMealMin; }                          // l'ultimo pasto è esattamente all'orario scelto
          else {
            const remaining=n-realDone;
            const step=(lastMealMin>anchorMin && remaining>0)?(lastMealMin-anchorMin)/remaining:0;
            raw=Math.min(Math.round((anchorMin+step*(j-realDone))/15)*15, lastMealMin);
          }
          timeHtml=`<span class="goal-slot-time" style="opacity:.7;font-weight:600">${ft(Math.floor(raw/60),raw%60)}</span>`;
        }
        const qLabel=dailyTarget>0?`≈ ${remainingPer} ml`:'imposta media';
        h+=`<div class="goal-slot pending${isNext?' next':''}" style="--slotcol:${col.pri}" onclick="openGoalMeal('${bn}',${j},${remainingPer})">
          <div class="goal-slot-idx">${j}° pasto${isNext?' · prossimo':''}</div>
          <div class="goal-slot-main">${timeHtml}<span class="goal-slot-ml" style="color:${col.pri}">${qLabel}</span></div>
        </div>`;
      }
    }
    // Spuntini fuori-pasto: mostrati a parte, non occupano slot
    snacks.forEach(s=>{
      h+=`<div class="goal-snack" onclick="editPlannedSlot('${bn}',${s._i})">
        <span class="goal-snack-lbl">🍪 Spuntino</span>
        <span class="goal-snack-main"><span class="goal-slot-time">${s.time}</span><span class="goal-slot-ml">${s.ml} ml</span></span>
      </div>`;
    });
    const goalTot=dailyTarget>0?`${dailyTarget} ml`:'—';
    const extra=realDone>n?` · +${realDone-n} extra`:'';
    const snackNote=snacks.length?` · 🍪 ${snacks.length} spuntino${snacks.length>1?'i':''}`:'';
    h+=`<div class="goal-summary">Fatti ${Math.min(realDone,n)}/${n}${extra}${snackNote}<br>${consumedSoFar} ml / obiettivo ${goalTot}</div>`;
    h+=`</div>`;
  });
```

- [ ] **Step 4: Verifica statica.**

```bash
grep -nE "f.snack\?snacks:meals|const realDone=meals.length|goal-snack|editPlannedSlot\('\\\$\{bn\}',\\\$\{f._i\}\)|snackNote" index.html
grep -n "feeds\[j-1\]" index.html || echo "vecchia mappatura feeds[j-1] rimossa ✓"
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"  # open==close
```

- [ ] **Step 5: Verifica live (data-safe) — scenario 11 luglio.**

Harness H1-H4 con il seed dello scenario (Gabriel: 5 pasti veri + 1 spuntino 40ml, n=5). Su Obiettivi, valuta in console:
```js
(() => {
  const slots=[...document.querySelectorAll('.goal-grid .goal-slot')];
  const gabSlots=slots.slice(0,5); // colonna Gabriel = primi 5 slot
  const out={
    slotMls: gabSlots.map(s=>s.querySelector('.goal-slot-ml')?.textContent.trim()),
    snackRows: [...document.querySelectorAll('.goal-snack')].map(s=>s.innerText.replace(/\n+/g,' ')),
    summary: document.querySelector('.goal-summary')?.innerText.replace(/\n+/g,' | ')
  };
  return JSON.stringify(out);
})();
```
Atteso: i 5 slot di Gabriel mostrano i **pasti veri** (incluso il serale delle 20:30 da 150 ml, non lo spuntino da 40); una riga `.goal-snack` "🍪 Spuntino 11:30 40 ml"; il summary contiene "Fatti 5/5 · 🍪 1 spuntino" e il totale ml **include** i 40 dello spuntino. Nessuno slot deve mostrare "40 ml".

- [ ] **Step 6: Verifica indice di modifica corretto (con spuntino in mezzo).**

In console, verifica che il click di uno slot apra la poppata giusta (indice reale, non di slot):
```js
(() => {
  const slots=[...document.querySelectorAll('.goal-grid .goal-slot')].slice(0,5);
  // il 3° slot pasto è il pasto delle 13:00 (m3), che nell'array feeds è a indice 3 (dopo lo spuntino a idx 2)
  const onclick3 = slots[2].getAttribute('onclick');
  return onclick3; // deve contenere editPlannedSlot('Gabriel',3)
})();
```
Atteso: `editPlannedSlot('Gabriel',3)` (indice reale 3, perché lo spuntino occupa l'indice 2). Poi apri davvero: esegui quel click e verifica che il modale mostri ml 160 e ora 13:00, quindi `closeModal()`.

- [ ] **Step 7: Verifica regressione + togli-flag + console.**

1. Giornata senza spuntini (es. un giorno passato con soli pasti): identica a prima (nessuna riga `.goal-snack`, summary senza "🍪").
2. Togli flag: `state.data[dk(state.selDate)].Gabriel.feeds.find(f=>f.snack).snack=false; render();` → lo spuntino rientra come pasto (ora 6 pasti veri → il 6° è "+1 extra"), nessuna riga spuntino.
3. `read_console_messages` onlyErrors → nessun errore.
Screenshot facoltativo (gli screenshot headless possono incepparsi: preferisci l'ispezione DOM).

- [ ] **Step 8: Commit + cleanup.**

```bash
git add index.html
git commit -m "Obiettivi: gli spuntini non occupano slot, mostrati a parte, ml nel totale"
rm -f _sandbox.html
git status   # _sandbox.html NON deve comparire
```

---

## Self-Review (spec coverage)

- Spec §A toggle spuntino (showModal/openAdd/openEdit/submitForm) → Task 1. ✓
- Spec §B separazione pasti/spuntini + slot su `meals` + indice reale di modifica → Task 2 Step 3. ✓
- Spec §C calcoli "scala dal totale" (`consumedSoFar` incl. spuntini, `realDone`, anchor sui pasti veri) → Task 2 Step 2-3. ✓
- Spec §D display spuntini (riga `.goal-snack`) + CSS → Task 2 Step 1, 3. ✓
- Spec §E riepilogo (extra su realDone, nota spuntini) → Task 2 Step 3. ✓
- Vincolo sicurezza dati → Global Constraints + harness sandbox; flag solo da azione utente, nessuna modifica a merge. ✓
- Edge case indice di modifica → Task 2 Step 6 (verifica esplicita). ✓
