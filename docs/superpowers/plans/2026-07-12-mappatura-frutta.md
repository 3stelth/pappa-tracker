# Mappatura frutta (svezzamento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrare quale frutta è stata data a ciascun bambino, per giorno, con un conteggio (es. banana ×2), come registro indipendente che non tocca mai `feeds`/ml/Obiettivi, con inserimento rapido a chip e visibilità nel riepilogo giornaliero e settimanale.

**Architecture:** App single-file (`index.html`), JS vanilla, nessun framework di test. Tre nuove chiavi di config in `state.data` (`fruitLog`, `customFruits`, `hiddenFruits`), trattate come le altre config-key esistenti (`goals`, `customTherapies`...) nei quattro punti che già le escludono dal ciclo sui giorni. Verifica su copia sandbox con cloud Supabase disattivato e dati sintetici.

**Tech Stack:** HTML/CSS/JS inline; server statico `.claude/serve.js` (localhost:8765); anteprima via Browser tools; localStorage; Supabase (disattivato nei test).

## Global Constraints

- **NON NEGOZIABILE — mai toccare i pasti:** nessuna riga di codice legge, crea, sposta o cancella `feeds` per derivare o influenzare la frutta. La frutta vive esclusivamente in `state.data.fruitLog`/`customFruits`/`hiddenFruits`.
- **File unico:** tutte le modifiche in `index.html`; nessuna dipendenza nuova (a parte `_sandbox.html`, mai committato).
- **Formato date:** chiavi `YYYY-MM-DD` via `dk()`, coerente col resto dell'app.
- **Config-key, non giorno:** `fruitLog`, `customFruits`, `hiddenFruits` vanno aggiunte a **tutti e cinque** i punti che oggi trattano le config-key come "non un giorno": `applyTombstones` (`index.html:457`), `cleanDuplicates` (`index.html:503`), `migrateTemperatures` (`index.html:698`), il guard-loop di `mergeData` (`index.html:589`), e implicitamente `exportCSV`/qualsiasi futuro ciclo su `Object.keys(state.data)`.
- **Conteggio ≥ 1:** in `fruitLog[bn][key]`, un frutto a conteggio 0 va rimosso dalla mappa (mai lasciare chiavi a 0); mappe/giorni vuoti vanno rimossi a cascata per non sporcare `state.data`.

---

## Verification Harness (data-safe) — riusato da ogni task

Non committare mai `_sandbox.html`.

**H1. Copia sandbox cloud-OFF dalle sorgenti correnti:**
```bash
sed 's#const SUPABASE_ANON_KEY = "[^"]*";#const SUPABASE_ANON_KEY = "";#' index.html > _sandbox.html
grep -c 'SUPABASE_ANON_KEY = ""' _sandbox.html   # atteso: 1
```

**H2. Server** (se non attivo): `node .claude/serve.js`. Apri nel Browser `http://localhost:8765/_sandbox.html`, sblocca con password `Ebby`.

**H3. Semina dati sintetici** (console via javascript_tool; non chiama `saveData`, cloud comunque off):
```js
useSupabase = () => false;
sessionStorage.setItem('pappatracker_auth','true');
const _key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _ago = n => { const x=new Date(); x.setDate(x.getDate()-n); return _key(x); };
const today=new Date(), todayKey=_key(today);
state.data = {
  fruitLog: { Gabriel: { [todayKey]: { banana: 2, pera: 1 } }, Vittorio: { [todayKey]: { banana: 1 } } },
  customFruits: [{ id:'albicocca', name:'Albicocca', emoji:'🟠' }],
  hiddenFruits: []
};
for(let i=1;i<=6;i++){ const k=_ago(i);
  state.data[k] = state.data[k] || {};
  state.data.fruitLog.Gabriel[k] = i%2===0 ? { banana:1, pesca:1 } : { pera:2 };
}
state.baby='Gabriel'; state.selDate=today; state.tab='feed'; state.view='today'; render();
```

**H4. Cleanup a fine sessione:** `rm -f _sandbox.html`; ferma il server; `git status` → `_sandbox.html` non deve comparire.

---

## File Structure

- **Modify:** `index.html` — unico file:
  - Costanti/helper dati (~riga 355, vicino a `uid()`): `FRUIT_PRESETS`, `fruitCatalog`, `getFruitLog`, `bumpFruit`, `clearFruit`, `addCustomFruit`, `hideFruit`, `unhideFruit`, `deleteCustomFruit`.
  - Guard config-key: `applyTombstones` (~457), `cleanDuplicates` (~503), `migrateTemperatures` (~698), `mergeData` (~541-589).
  - CSS: dopo `.goal-summary` (~riga 169) — classi `.fruit-*`.
  - `buildDayView`: nuova `buildFruitSection(bn,key)` chiamata dopo la sezione Poppate (~978); riga frutta nella `recap-card` (~938).
  - `buildWeeklySummaryParts` (~2004): colonna 🍎 + legenda totali.
  - `exportCSV` (~803): nuovo helper `buildFruitCSVRows()` + chiamata.
  - Modali: `openAddFruit`/`submitAddFruit`/`openManageFruits` (vicino a `openAddTherapy`, ~1859).
- **Temp (mai committato):** `_sandbox.html`.

---

## Task 1: Modello dati, helper e integrazione sync (nessuna UI ancora)

Aggiunge le tre chiavi di config e le funzioni per leggerle/modificarle, e le inserisce in tutti i punti che già trattano le config-key come "non un giorno". Nessun effetto visivo ancora: dopo questo task le funzioni sono richiamabili da console ma non c'è alcuna UI (stato intermedio coerente, verificabile via console).

**Files:**
- Modify: `index.html` — helper (~355), `applyTombstones` (~457), `cleanDuplicates` (~503), `migrateTemperatures` (~698), `mergeData` (~541-589).

**Interfaces — Produces:**
- `FRUIT_PRESETS: Array<{id,name,emoji}>`
- `fruitCatalog(): Array<{id,name,emoji}>` — preset (meno `hiddenFruits`) + `customFruits`
- `getFruitLog(bn, key): Object<fruitId,count>`
- `bumpFruit(bn, key, fruitId, delta): Promise<void>` — clamp ≥0, rimuove chiavi/oggetti vuoti, `saveData()`, `render()`
- `clearFruit(bn, key, fruitId): Promise<void>`
- `addCustomFruit(name, emoji): Promise<void>`
- `hideFruit(fruitId): Promise<void>` / `unhideFruit(fruitId): Promise<void>`
- `deleteCustomFruit(fruitId): Promise<void>`

- [ ] **Step 1: Aggiungi `FRUIT_PRESETS` e gli helper di lettura/scrittura dopo `uid()` (`index.html:355`).**

Dopo la riga:
```js
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
```
inserisci:
```js
// ─── FRUTTA (registro indipendente dai feeds: non influisce su ml/medie/Obiettivi) ───
const FRUIT_PRESETS = [
  {id:'banana', name:'Banana', emoji:'🍌'},
  {id:'pera', name:'Pera', emoji:'🍐'},
  {id:'mela', name:'Mela', emoji:'🍎'},
  {id:'pesca', name:'Pesca', emoji:'🍑'},
  {id:'kiwi', name:'Kiwi', emoji:'🥝'},
  {id:'uva', name:'Uva', emoji:'🍇'},
  {id:'fragola', name:'Fragola', emoji:'🍓'},
  {id:'mirtilli', name:'Mirtilli', emoji:'🫐'},
  {id:'arancia', name:'Arancia', emoji:'🍊'},
  {id:'melone', name:'Melone', emoji:'🍈'},
  {id:'mango', name:'Mango', emoji:'🥭'},
  {id:'avocado', name:'Avocado', emoji:'🥑'}
];
function fruitCatalog() {
  const hidden = new Set(state.data.hiddenFruits || []);
  const presets = FRUIT_PRESETS.filter(f => !hidden.has(f.id));
  const custom = state.data.customFruits || [];
  return [...presets, ...custom];
}
function getFruitLog(bn, key) {
  return (state.data.fruitLog && state.data.fruitLog[bn] && state.data.fruitLog[bn][key]) || {};
}
async function bumpFruit(bn, key, fruitId, delta) {
  if (!state.data.fruitLog) state.data.fruitLog = {};
  if (!state.data.fruitLog[bn]) state.data.fruitLog[bn] = {};
  if (!state.data.fruitLog[bn][key]) state.data.fruitLog[bn][key] = {};
  const day = state.data.fruitLog[bn][key];
  const next = Math.max(0, (day[fruitId]||0) + delta);
  if (next === 0) delete day[fruitId]; else day[fruitId] = next;
  if (!Object.keys(day).length) delete state.data.fruitLog[bn][key];
  if (!Object.keys(state.data.fruitLog[bn]).length) delete state.data.fruitLog[bn];
  await saveData(); render();
}
async function clearFruit(bn, key, fruitId) {
  const cur = getFruitLog(bn, key)[fruitId] || 0;
  if (cur > 0) await bumpFruit(bn, key, fruitId, -cur);
}
async function addCustomFruit(name, emoji) {
  name = (name||'').trim(); if (!name) return;
  if (!state.data.customFruits) state.data.customFruits = [];
  state.data.customFruits.push({ id: uid(), name, emoji: emoji || '🍏' });
  await saveData(); render();
}
async function hideFruit(fruitId) {
  if (!state.data.hiddenFruits) state.data.hiddenFruits = [];
  if (!state.data.hiddenFruits.includes(fruitId)) state.data.hiddenFruits.push(fruitId);
  await saveData(); render();
}
async function unhideFruit(fruitId) {
  state.data.hiddenFruits = (state.data.hiddenFruits||[]).filter(id => id !== fruitId);
  await saveData(); render();
}
async function deleteCustomFruit(fruitId) {
  state.data.customFruits = (state.data.customFruits||[]).filter(f => f.id !== fruitId);
  await saveData(); render();
}
```

- [ ] **Step 2: Escludi le nuove chiavi da `applyTombstones` (`index.html:457`).**

Sostituisci:
```js
    if (dateKey === 'doseOverrides' || dateKey === '_tombstones' || dateKey === 'customTherapies' || dateKey === 'hiddenTherapies' || dateKey === 'therapyEnds' || dateKey === 'therapySkips' || dateKey === 'goals') continue;
```
(questa occorrenza, dentro `applyTombstones`) con:
```js
    if (dateKey === 'doseOverrides' || dateKey === '_tombstones' || dateKey === 'customTherapies' || dateKey === 'hiddenTherapies' || dateKey === 'therapyEnds' || dateKey === 'therapySkips' || dateKey === 'goals' || dateKey === 'fruitLog' || dateKey === 'customFruits' || dateKey === 'hiddenFruits') continue;
```

- [ ] **Step 3: Escludi le nuove chiavi da `cleanDuplicates` (`index.html:503`).**

Stessa identica sostituzione di Step 2, applicata alla seconda occorrenza (dentro `cleanDuplicates`, riga 503 — usa il numero di riga per individuare quella giusta, il testo è identico a Step 2).

- [ ] **Step 4: Escludi le nuove chiavi da `migrateTemperatures` (`index.html:698`).**

Sostituisci:
```js
    if(key==='doseOverrides' || key==='_tombstones' || key==='customTherapies' || key==='hiddenTherapies' || key==='therapyEnds' || key==='therapySkips' || key==='goals') continue;
```
con:
```js
    if(key==='doseOverrides' || key==='_tombstones' || key==='customTherapies' || key==='hiddenTherapies' || key==='therapyEnds' || key==='therapySkips' || key==='goals' || key==='fruitLog' || key==='customFruits' || key==='hiddenFruits') continue;
```

- [ ] **Step 5: Merge di `customFruits`/`hiddenFruits`/`fruitLog` in `mergeData` (`index.html:541`).**

Dopo il blocco (subito prima della riga `for (const dateKey in local) {`, `index.html:588`):
```js
  // Therapy single-day skips: union of date arrays per baby/tid
  if (local.therapySkips) {
    merged.therapySkips = merged.therapySkips || {};
    for (const bn in local.therapySkips) {
      merged.therapySkips[bn] = merged.therapySkips[bn] || {};
      for (const tid in local.therapySkips[bn]) {
        const s = new Set([...(merged.therapySkips[bn][tid] || []), ...(local.therapySkips[bn][tid] || [])]);
        merged.therapySkips[bn][tid] = [...s];
      }
    }
  }
```
inserisci:
```js
  // Custom fruits: union by id (local wins on duplicate) — condiviso tra i bambini
  if (local.customFruits) {
    const byId = {};
    (merged.customFruits || []).forEach(f => { if (f && f.id) byId[f.id] = f; });
    (local.customFruits || []).forEach(f => { if (f && f.id) byId[f.id] = f; });
    merged.customFruits = Object.values(byId);
  }
  // Hidden fruits: union of id array — condiviso tra i bambini
  if (local.hiddenFruits) {
    merged.hiddenFruits = [...new Set([...(merged.hiddenFruits || []), ...(local.hiddenFruits || [])])];
  }
  // Fruit log: merge profondo baby -> dateKey -> fruitId -> count. Il giorno locale
  // vince per intero se presente in entrambi (come i tombstone-safe array altrove),
  // così una correzione di un genitore non sparisce per un merge "somma" involontario.
  if (local.fruitLog) {
    merged.fruitLog = merged.fruitLog || {};
    for (const bn in local.fruitLog) {
      merged.fruitLog[bn] = { ...(merged.fruitLog[bn] || {}), ...(local.fruitLog[bn] || {}) };
    }
  }
```
Poi sostituisci il guard del ciclo giorni (`index.html:589`):
```js
    if (dateKey === '_tombstones' || dateKey === 'customTherapies' || dateKey === 'hiddenTherapies' || dateKey === 'therapyEnds' || dateKey === 'therapySkips' || dateKey === 'goals') continue;
```
con:
```js
    if (dateKey === '_tombstones' || dateKey === 'customTherapies' || dateKey === 'hiddenTherapies' || dateKey === 'therapyEnds' || dateKey === 'therapySkips' || dateKey === 'goals' || dateKey === 'fruitLog' || dateKey === 'customFruits' || dateKey === 'hiddenFruits') continue;
```

- [ ] **Step 6: Verifica statica.**

```bash
grep -nE "FRUIT_PRESETS|function fruitCatalog|function getFruitLog|function bumpFruit|function clearFruit|function addCustomFruit|function hideFruit|function unhideFruit|function deleteCustomFruit|dateKey === 'fruitLog'|key==='fruitLog'|merged.fruitLog" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"  # open==close
```
Atteso: tutte le funzioni presenti; almeno 5 occorrenze di `'fruitLog'`/`fruitLog` nei guard/merge; parentesi bilanciate.

- [ ] **Step 7: Verifica live (data-safe) — helper via console.**

Harness H1-H3. In console:
```js
(() => {
  const key = dk(new Date());
  bumpFruit('Vittorio', key, 'mela', 1);
  bumpFruit('Vittorio', key, 'mela', 1);
  bumpFruit('Vittorio', key, 'mela', -1);
  const log = getFruitLog('Vittorio', key);
  const cat = fruitCatalog().map(f=>f.id);
  return JSON.stringify({ log, hasAlbicocca: cat.includes('albicocca'), hasBanana: cat.includes('banana') });
})();
```
Atteso: `log` = `{"banana":1,"mela":1}` (Vittorio aveva già banana:1 dal seed H3, ora +1 mela netto), `hasAlbicocca: true` (custom del seed), `hasBanana: true`.

Poi verifica che azzerare rimuova la chiave e non lasci residui:
```js
(() => {
  const key = dk(new Date());
  clearFruit('Vittorio', key, 'mela');
  return JSON.stringify(getFruitLog('Vittorio', key));
})();
```
Atteso: `{"banana":1}` (nessuna chiave `mela` residua).

Verifica infine che i `feeds` non siano mai stati toccati:
```js
JSON.stringify(state.data[dk(new Date())]?.Gabriel?.feeds || 'nessun feed — invariato');
```
Atteso: `"nessun feed — invariato"` (il seed H3 non ha creato feeds).

- [ ] **Step 8: Commit.**

```bash
git add index.html
git commit -m "Frutta: modello dati fruitLog/customFruits/hiddenFruits, helper e integrazione sync"
```

---

## Task 2: Card "🍎 Frutta" nel day view — griglia chip e inserimento

Aggiunge la sezione visiva sotto "🍼 Poppate": griglia di chip preset+custom con badge conteggio, e lista "Dati oggi" con stepper. Il pulsante "Aggiungi frutto" e "Gestisci" sono collegati a modali che arriveranno nel Task 3 — per ora i loro `onclick` possono già puntare a funzioni che verranno definite lì (nessun placeholder di codice: il click semplicemente non farà nulla finché il Task 3 non è applicato, stato intermedio dichiarato).

**Files:**
- Modify: `index.html` — CSS (~169), `buildDayView` (dopo la sezione Poppate, ~978).

**Interfaces — Consumes:** `fruitCatalog()`, `getFruitLog(bn,key)`, `bumpFruit`, `clearFruit` (Task 1); `state.baby`, `dk()`, `fmtDotDate()` (esistenti).
**Interfaces — Produces:** `buildFruitSection(bn, key): string` (HTML).

- [ ] **Step 1: Aggiungi le classi CSS dopo `.goal-summary` (`index.html:169`).**

Dopo la riga:
```css
.goal-summary { font-size: 10px; color: var(--sub); text-align: center; margin-top: 4px; font-weight: 600; }
```
inserisci:
```css
.fruit-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.fruit-chip { position: relative; display: flex; align-items: center; gap: 6px; padding: 9px 14px 9px 11px; border: 1px solid var(--glass-brd-2); border-radius: var(--r-sm); background: var(--glass-2); color: var(--txt); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: transform 0.15s; }
.fruit-chip:active { transform: scale(0.94); }
.fruit-chip .fruit-emoji { font-size: 17px; }
.fruit-chip.add { border-style: dashed; color: var(--sub); }
.fruit-badge { position: absolute; top: -6px; right: -6px; background: var(--grad); color: #fff; font-size: 10px; font-weight: 800; min-width: 17px; height: 17px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 4px; box-shadow: 0 3px 8px -2px var(--accent); }
.fruit-log-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--glass); border: 1px solid var(--glass-brd); border-radius: var(--r-sm); padding: 8px 10px; margin-bottom: 7px; }
.fruit-log-name { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
.fruit-stepper { display: flex; align-items: center; gap: 8px; }
.fruit-step-btn { border: none; width: 26px; height: 26px; border-radius: 9px; background: var(--glass-2); color: var(--txt); font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; }
.fruit-step-btn:active { transform: scale(0.88); }
.fruit-step-count { min-width: 18px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Aggiungi `buildFruitSection` (vicino a `getBabyDay`, `index.html:712`, subito dopo la sua chiusura).**

Dopo:
```js
function getBabyDay(bn, dateKey) {
  const bd = state.data[dateKey]?.[bn];
  const feeds = bd?.feeds || [], diapers = bd?.diapers || [], checks = bd?.therapies || {}, ts = getActiveTherapies(bn, dateKey);
  return { feeds, diapers, checks, therapies: ts, totalMl: feeds.reduce((s,f)=>s+(f.ml||0),0), totalDiapers: diapers.length, therapyDone: ts.filter(t=>checks[t.id]).length };
}
```
inserisci:
```js
function buildFruitSection(bn, key) {
  const dateLabel = fmtDotDate(key);
  const log = getFruitLog(bn, key);
  const catalog = fruitCatalog();
  let h = `<div class="content"><div class="content-title">🍎 Frutta · ${dateLabel}</div>`;
  h += `<div class="fruit-grid">${catalog.map(f=>{
    const n = log[f.id]||0;
    return `<button class="fruit-chip" onclick="bumpFruit('${bn}','${key}','${f.id}',1)"><span class="fruit-emoji">${f.emoji}</span>${f.name}${n>0?`<span class="fruit-badge">${n}</span>`:''}</button>`;
  }).join("")}<button class="fruit-chip add" onclick="openAddFruit()">➕ Aggiungi</button><button class="fruit-chip add" onclick="openManageFruits()">⚙️ Gestisci</button></div>`;
  const active = catalog.filter(f=>(log[f.id]||0)>0).sort((a,b)=>(log[b.id]||0)-(log[a.id]||0));
  if (active.length) {
    h += `<div class="content-title" style="margin-top:2px;font-size:11px;color:var(--hint)">Dati oggi</div>`;
    active.forEach(f=>{
      h += `<div class="fruit-log-row"><span class="fruit-log-name">${f.emoji} ${f.name}</span><div class="fruit-stepper"><button class="fruit-step-btn" onclick="bumpFruit('${bn}','${key}','${f.id}',-1)">−</button><span class="fruit-step-count">${log[f.id]}</span><button class="fruit-step-btn" onclick="bumpFruit('${bn}','${key}','${f.id}',1)">+</button><button class="entry-del" onclick="clearFruit('${bn}','${key}','${f.id}')">✕</button></div></div>`;
    });
  } else {
    h += `<div class="empty">Nessuna frutta registrata</div>`;
  }
  h += `</div>`;
  return h;
}
```

- [ ] **Step 3: Richiama `buildFruitSection` nel day view, subito dopo la sezione Poppate (`index.html:970-978`).**

Sostituisci:
```js
  // Feeds
  const feeds = state.data[key]?.[state.baby]?.feeds || [];
  h+=`<div class="content"><div class="content-title">🍼 Poppate · ${dateLabel}</div>`;
  if(!feeds.length) h+=`<div class="empty">Nessuna poppata</div>`;
  else feeds.forEach((e,i)=>{
    const eI=e.type==="Materno"?"🤱":"🍼";
    const tBg=e.type==="Formula"?"rgba(59,130,246,0.16)":"rgba(245,158,11,0.18)",tC=e.type==="Formula"?"#3B82F6":"#D97706";
    h+=`<div class="entry" onclick="state.tab='feed';openEdit(${i})"><div class="entry-icon">${eI}</div><div class="entry-body"><div class="entry-top"><span class="entry-time">${e.time}</span><span class="entry-ml" style="color:var(--accent)">${e.ml} ml</span><span class="entry-tag" style="background:${tBg};color:${tC}">${e.type}</span></div>${e.note?`<div class="entry-note">${e.note}</div>`:''}</div><button class="entry-del" onclick="event.stopPropagation();state.tab='feed';delEntry(${i})">✕</button></div>`;
  });
  h+=`</div>`;
  // Diapers
```
con:
```js
  // Feeds
  const feeds = state.data[key]?.[state.baby]?.feeds || [];
  h+=`<div class="content"><div class="content-title">🍼 Poppate · ${dateLabel}</div>`;
  if(!feeds.length) h+=`<div class="empty">Nessuna poppata</div>`;
  else feeds.forEach((e,i)=>{
    const eI=e.type==="Materno"?"🤱":"🍼";
    const tBg=e.type==="Formula"?"rgba(59,130,246,0.16)":"rgba(245,158,11,0.18)",tC=e.type==="Formula"?"#3B82F6":"#D97706";
    h+=`<div class="entry" onclick="state.tab='feed';openEdit(${i})"><div class="entry-icon">${eI}</div><div class="entry-body"><div class="entry-top"><span class="entry-time">${e.time}</span><span class="entry-ml" style="color:var(--accent)">${e.ml} ml</span><span class="entry-tag" style="background:${tBg};color:${tC}">${e.type}</span></div>${e.note?`<div class="entry-note">${e.note}</div>`:''}</div><button class="entry-del" onclick="event.stopPropagation();state.tab='feed';delEntry(${i})">✕</button></div>`;
  });
  h+=`</div>`;
  // Fruit (registro indipendente: non tocca feeds/ml/Obiettivi)
  h+=buildFruitSection(state.baby, key);
  // Diapers
```

- [ ] **Step 4: Verifica statica.**

```bash
grep -nE "function buildFruitSection|buildFruitSection\(state.baby, key\)|class=\"fruit-grid\"|class=\"fruit-log-row\"" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"
```

- [ ] **Step 5: Verifica live (data-safe).**

Harness H1-H3, poi nel Browser naviga sulla tab "Poppate" (view `today`) e valuta in console:
```js
(() => {
  const grid = document.querySelector('.fruit-grid');
  const badges = [...document.querySelectorAll('.fruit-badge')].map(b=>b.textContent);
  const rows = [...document.querySelectorAll('.fruit-log-row .fruit-log-name')].map(n=>n.textContent.trim());
  return JSON.stringify({ hasGrid: !!grid, badges, rows });
})();
```
Atteso (bambino corrente Gabriel dal seed H3, oggi banana:2, pera:1): `hasGrid: true`, `badges` contiene `"2"` e `"1"`, `rows` contiene `"🍌 Banana"` e `"🍐 Pera"`.

Poi tocca davvero un chip e verifica il badge aggiornarsi:
```js
document.querySelector('.fruit-chip')?.click();
await new Promise(r=>setTimeout(r,50));
document.querySelector('.fruit-badge')?.textContent; // atteso: conteggio incrementato di 1 rispetto a prima
```

E lo stepper meno fino a far sparire la riga:
```js
const btn = [...document.querySelectorAll('.fruit-step-btn')].find(b=>b.textContent==='−');
btn?.click();
```
Atteso: nessun errore; se il conteggio arriva a 0 la riga sparisce da "Dati oggi" al re-render.

`read_console_messages` con `onlyErrors: true` → nessun errore.

- [ ] **Step 6: Commit.**

```bash
git add index.html
git commit -m "Frutta: card Frutta nel day view con griglia chip e Dati oggi"
```

---

## Task 3: Modali "Aggiungi frutto" e "Gestisci"

Collega i due pulsanti lasciati "a vuoto" nel Task 2. Aggiunge un frutto personalizzato (nome + emoji) condiviso tra i bambini, e un pannello per nascondere/mostrare preset ed eliminare personalizzati (senza mai toccare lo storico in `fruitLog`).

**Files:**
- Modify: `index.html` — vicino a `openAddTherapy` (`index.html:1859`).

**Interfaces — Consumes:** `addCustomFruit`, `hideFruit`, `unhideFruit`, `deleteCustomFruit`, `FRUIT_PRESETS`, `fruitCatalog` (Task 1); `setModal`/`closeModal`/`uid` (esistenti); `openAddFruit()`/`openManageFruits()` richiamate senza argomenti da `buildFruitSection` (Task 2) — il catalogo frutta è condiviso tra i bambini, non serve `bn`/`key`.

- [ ] **Step 1: Aggiungi i modali dopo `restoreTherapy` (`index.html:1921-1926`, subito prima del commento `// Undo a single-day skip`).**

Dopo:
```js
// Undo an end (reactivate from the viewed day): clears the end override.
async function restoreTherapy(bn, tid) {
  if (!state.data.therapyEnds) state.data.therapyEnds = {};
  if (!state.data.therapyEnds[bn]) state.data.therapyEnds[bn] = {};
  state.data.therapyEnds[bn][tid] = ""; // "" clears the end (even a hardcoded one)
  await saveData(); render();
}
```
inserisci:
```js
// ─── FRUTTA: modali Aggiungi / Gestisci ───
const FRUIT_EMOJI_CHOICES = ['🍎','🍐','🍑','🍌','🍇','🍓','🫐','🍊','🍈','🥭','🥑','🍍','🍒','🥥','🟠','🟢'];
function openAddFruit() {
  const emojiOpts = FRUIT_EMOJI_CHOICES.map((e,i)=>`<option value="${e}"${i===0?' selected':''}>${e}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="closeModal()"><div class="modal" onclick="event.stopPropagation()"><div class="modal-handle"></div><div class="modal-title">🍎 Aggiungi frutto</div>
    <div class="form-label">Nome *</div><input class="form-input big" type="text" id="fr-name" placeholder="es. Albicocca" style="margin-bottom:10px">
    <div class="form-label">Emoji</div><select class="form-select" id="fr-emoji" style="width:100%">${emojiOpts}</select>
    <div class="form-actions" style="margin-top:14px"><button class="btn-cancel" onclick="closeModal()">Annulla</button><button class="btn-save" onclick="submitAddFruit()">Aggiungi 🍎</button></div>
  </div></div>`);
}
async function submitAddFruit() {
  const name = document.getElementById('fr-name').value.trim();
  if (!name) return;
  const emoji = document.getElementById('fr-emoji').value || '🍏';
  await addCustomFruit(name, emoji);
  closeModal();
}
function openManageFruits() {
  const hidden = new Set(state.data.hiddenFruits || []);
  const presetRows = FRUIT_PRESETS.map(f => `<div class="fruit-log-row"><span class="fruit-log-name">${f.emoji} ${f.name}</span><button class="weight-btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px" onclick="${hidden.has(f.id)?`unhideFruit('${f.id}')`:`hideFruit('${f.id}')`};openManageFruits()">${hidden.has(f.id)?'Mostra':'Nascondi'}</button></div>`).join('');
  const customRows = (state.data.customFruits||[]).map(f => `<div class="fruit-log-row"><span class="fruit-log-name">${f.emoji} ${f.name}</span><button class="entry-del" onclick="deleteCustomFruit('${f.id}');openManageFruits()">✕</button></div>`).join('');
  setModal(`<div class="modal-bg" onclick="closeModal()"><div class="modal" onclick="event.stopPropagation()"><div class="modal-handle"></div><div class="modal-title">⚙️ Gestisci frutti</div>
    <div class="content-title" style="font-size:11px;color:var(--hint)">Preset</div>${presetRows}
    ${customRows?`<div class="content-title" style="font-size:11px;color:var(--hint);margin-top:10px">Personalizzati</div>${customRows}`:''}
    <div class="form-actions" style="margin-top:14px"><button class="btn-cancel" style="width:100%" onclick="closeModal()">Chiudi</button></div>
  </div></div>`);
}
```

- [ ] **Step 2: Verifica statica.**

```bash
grep -nE "function openAddFruit|function submitAddFruit|function openManageFruits|FRUIT_EMOJI_CHOICES" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"
```

- [ ] **Step 3: Verifica live (data-safe) — aggiungi un frutto personalizzato.**

Harness H1-H3. Nel Browser, sulla tab Poppate, clicca il chip "➕ Aggiungi" (o via console `openAddFruit()`), poi:
```js
document.getElementById('fr-name').value = 'Cachi';
document.getElementById('fr-emoji').value = '🟠';
submitAddFruit();
```
Atteso: dopo un breve delay, `state.data.customFruits` contiene un oggetto `{name:'Cachi', emoji:'🟠', id:...}`; verifica:
```js
await new Promise(r=>setTimeout(r,50));
JSON.stringify(state.data.customFruits.find(f=>f.name==='Cachi'));
```
E che compaia in griglia **per entrambi i bambini** (catalogo condiviso, non filtrato per bambino):
```js
state.baby='Vittorio'; render();
[...document.querySelectorAll('.fruit-chip')].some(c=>c.textContent.includes('Cachi'));
```
Atteso: `true`.

- [ ] **Step 4: Verifica live — nascondi un preset, storico intatto.**

```js
hideFruit('kiwi');
await new Promise(r=>setTimeout(r,50));
const inGrid = [...document.querySelectorAll('.fruit-chip')].some(c=>c.textContent.includes('Kiwi'));
inGrid; // atteso: false
```
Poi verifica che uno storico preesistente di kiwi (se seminato) resti leggibile da `getFruitLog`/riepiloghi anche se nascosto dalla griglia — per questo task basta verificare che `state.data.fruitLog` non venga alterato da `hideFruit`:
```js
JSON.stringify(state.data.fruitLog); // atteso: invariato rispetto a prima di hideFruit
```
Ripristina: `unhideFruit('kiwi');`.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "Frutta: modali Aggiungi frutto personalizzato e Gestisci catalogo"
```

---

## Task 4: Riga frutta nel riepilogo giornaliero (recap-card)

Aggiunge, nella card di ogni bambino in cima al day view, una riga `🍎 🍌×2 🍐×1` visibile solo se quel bambino ha dati per il giorno.

**Files:**
- Modify: `index.html` — `recap-row` (`index.html:931-942`).

**Interfaces — Consumes:** `getFruitLog(bn,key)` (Task 1).

- [ ] **Step 1: Aggiungi la riga frutta subito dopo la riga 💩 (`index.html:937`).**

Sostituisci:
```js
      <div class="recap-line">💩 <b>${d.totalDiapers}</b></div>
      <div class="recap-line">⚖️ <b>${(state.data[key]?.[bn]?.weight?.kg||'—')}${state.data[key]?.[bn]?.weight?' kg':''}</b></div>
```
con:
```js
      <div class="recap-line">💩 <b>${d.totalDiapers}</b></div>
      ${(() => {
        const log = getFruitLog(bn, key);
        const entries = Object.keys(log).filter(id=>log[id]>0);
        if (!entries.length) return '';
        const cat = fruitCatalog();
        const items = entries.map(id => ({ id, count: log[id], meta: cat.find(f=>f.id===id) || {emoji:'🍏',name:id} }))
          .sort((a,b) => b.count - a.count)
          .map(x => `${x.meta.emoji}×${x.count}`)
          .join(' ');
        return `<div class="recap-line">🍎 ${items}</div>`;
      })()}
      <div class="recap-line">⚖️ <b>${(state.data[key]?.[bn]?.weight?.kg||'—')}${state.data[key]?.[bn]?.weight?' kg':''}</b></div>
```

- [ ] **Step 2: Verifica statica.**

```bash
grep -n "getFruitLog(bn, key)" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"
```

- [ ] **Step 3: Verifica live (data-safe).**

Harness H1-H3 (seed: Gabriel oggi banana:2, pera:1; Vittorio oggi banana:1). In console:
```js
(() => {
  const cards = [...document.querySelectorAll('.recap-card')];
  return cards.map(c => {
    const line = [...c.querySelectorAll('.recap-line')].find(l => l.textContent.includes('🍎'));
    return line ? line.textContent.trim() : null;
  });
})();
```
Atteso: un array di 2 elementi, il primo (Gabriel) contiene `"🍎 🍌×2 🍐×1"` (ordine per conteggio decrescente), il secondo (Vittorio) contiene `"🍎 🍌×1"`.

Poi verifica l'omissione: seleziona un giorno senza dati frutta (es. `state.selDate = new Date(Date.now()-10*86400000); render();`) e ripeti la query — atteso: entrambe le voci `null` (nessuna riga 🍎).

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "Frutta: riga nel riepilogo giornaliero (recap-card)"
```

---

## Task 5: Colonna e legenda frutta nel riepilogo settimanale

Aggiunge una colonna 🍎 alla tabella settimanale (emoji deduplicate per giorno) e una riga-legenda con i totali della settimana per il bambino selezionato.

**Files:**
- Modify: `index.html` — `buildWeeklySummaryParts` (`index.html:2004-2034`).

**Interfaces — Consumes:** `getFruitLog(bn,key)`, `fruitCatalog()` (Task 1).

- [ ] **Step 1: Sostituisci l'intera funzione `buildWeeklySummaryParts` (`index.html:2004-2034`).**

Sostituisci:
```js
function buildWeeklySummaryParts(bn) {
  bn = bn || state.baby;
  const c=COLORS[bn], now=new Date();
  const todayDow=(now.getDay()+6)%7;
  const monThisWeek=new Date(now.getFullYear(),now.getMonth(),now.getDate()-todayDow);
  const startDate=new Date(monThisWeek.getFullYear(),monThisWeek.getMonth(),monThisWeek.getDate()-weeklyOffset*7);
  const endDate=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+6);
  const label=`${startDate.getDate()}/${startDate.getMonth()+1} — ${endDate.getDate()}/${endDate.getMonth()+1}`;
  const todayKey=dk(now);
  let rows='';
  let totMl=0,totFeeds=0,totDiapers=0,days=0;
  for(let i=0;i<7;i++){
    const d=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+i);
    const key=dk(d), bd=state.data[key]?.[bn];
    const dayFeeds=bd?.feeds||[], dayDiapers=bd?.diapers||[];
    const ml=dayFeeds.reduce((s,f)=>s+(f.ml||0),0);
    const wt=bd?.weight?.kg||'—';
    const dayTemps=bd?.temperatures||[];
    const tmp=dayTemps.length?Math.max(...dayTemps.map(t=>t.temp)):'—';
    const dayName=DAYNAMES[(d.getDay()+6)%7];
    const hasData=dayFeeds.length||dayDiapers.length||bd?.weight||dayTemps.length;
    const isPast=key<todayKey;
    if(isPast && hasData) days++;
    if(isPast) { totMl+=ml; totFeeds+=dayFeeds.length; totDiapers+=dayDiapers.length; }
    rows+=`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 4px;font-weight:700;font-size:10px">${dayName} ${d.getDate()}/${d.getMonth()+1}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${ml||'—'}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${dayFeeds.length||'—'}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${dayDiapers.length||'—'}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${wt}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${tmp}</td></tr>`;
  }
  const avgMl=days?Math.round(totMl/days):0, avgFeeds=days?(totFeeds/days).toFixed(1):0, avgDiapers=days?(totDiapers/days).toFixed(1):0;
  const isCurrentWeek=weeklyOffset===0;
  const tableInner = `<thead><tr style="border-bottom:2px solid ${c.pri}"><th style="padding:6px 4px;text-align:left;font-size:9px;color:#888">Giorno</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">ml</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">🍼</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">💩</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">kg</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">°C</th></tr></thead><tbody>${rows}<tr style="background:${c.light};font-weight:800"><td style="padding:6px 4px;font-size:10px">Media/gg</td><td style="padding:6px 4px;text-align:center;font-size:10px">${avgMl}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${avgFeeds}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${avgDiapers}</td><td style="padding:6px 4px;text-align:center;font-size:10px">—</td><td style="padding:6px 4px;text-align:center;font-size:10px">—</td></tr></tbody>`;
  return { label, tableInner, isCurrentWeek, c, bn };
}
```
con:
```js
function buildWeeklySummaryParts(bn) {
  bn = bn || state.baby;
  const c=COLORS[bn], now=new Date();
  const todayDow=(now.getDay()+6)%7;
  const monThisWeek=new Date(now.getFullYear(),now.getMonth(),now.getDate()-todayDow);
  const startDate=new Date(monThisWeek.getFullYear(),monThisWeek.getMonth(),monThisWeek.getDate()-weeklyOffset*7);
  const endDate=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+6);
  const label=`${startDate.getDate()}/${startDate.getMonth()+1} — ${endDate.getDate()}/${endDate.getMonth()+1}`;
  const todayKey=dk(now);
  const catalog=fruitCatalog();
  let rows='';
  let totMl=0,totFeeds=0,totDiapers=0,days=0;
  const fruitTotals={}; // fruitId -> conteggio settimanale
  let anyFruit=false;
  for(let i=0;i<7;i++){
    const d=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+i);
    const key=dk(d), bd=state.data[key]?.[bn];
    const dayFeeds=bd?.feeds||[], dayDiapers=bd?.diapers||[];
    const ml=dayFeeds.reduce((s,f)=>s+(f.ml||0),0);
    const wt=bd?.weight?.kg||'—';
    const dayTemps=bd?.temperatures||[];
    const tmp=dayTemps.length?Math.max(...dayTemps.map(t=>t.temp)):'—';
    const dayName=DAYNAMES[(d.getDay()+6)%7];
    const hasData=dayFeeds.length||dayDiapers.length||bd?.weight||dayTemps.length;
    const isPast=key<todayKey;
    if(isPast && hasData) days++;
    if(isPast) { totMl+=ml; totFeeds+=dayFeeds.length; totDiapers+=dayDiapers.length; }
    const dayFruitLog=getFruitLog(bn,key);
    const dayFruitIds=Object.keys(dayFruitLog).filter(id=>dayFruitLog[id]>0);
    const fruitCell=dayFruitIds.map(id=>(catalog.find(f=>f.id===id)||{emoji:'🍏'}).emoji).join('');
    if(dayFruitIds.length){ anyFruit=true; dayFruitIds.forEach(id=>{ fruitTotals[id]=(fruitTotals[id]||0)+dayFruitLog[id]; }); }
    rows+=`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 4px;font-weight:700;font-size:10px">${dayName} ${d.getDate()}/${d.getMonth()+1}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${ml||'—'}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${dayFeeds.length||'—'}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${dayDiapers.length||'—'}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${wt}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${tmp}</td><td style="padding:6px 4px;text-align:center;font-size:12px">${fruitCell||'—'}</td></tr>`;
  }
  const avgMl=days?Math.round(totMl/days):0, avgFeeds=days?(totFeeds/days).toFixed(1):0, avgDiapers=days?(totDiapers/days).toFixed(1):0;
  const isCurrentWeek=weeklyOffset===0;
  const tableInner = `<thead><tr style="border-bottom:2px solid ${c.pri}"><th style="padding:6px 4px;text-align:left;font-size:9px;color:#888">Giorno</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">ml</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">🍼</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">💩</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">kg</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">°C</th><th style="padding:6px 4px;text-align:center;font-size:9px;color:#888">🍎</th></tr></thead><tbody>${rows}<tr style="background:${c.light};font-weight:800"><td style="padding:6px 4px;font-size:10px">Media/gg</td><td style="padding:6px 4px;text-align:center;font-size:10px">${avgMl}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${avgFeeds}</td><td style="padding:6px 4px;text-align:center;font-size:10px">${avgDiapers}</td><td style="padding:6px 4px;text-align:center;font-size:10px">—</td><td style="padding:6px 4px;text-align:center;font-size:10px">—</td><td style="padding:6px 4px;text-align:center;font-size:10px">—</td></tr></tbody>`;
  const fruitLegend = anyFruit
    ? Object.keys(fruitTotals).map(id => ({ id, count: fruitTotals[id], meta: catalog.find(f=>f.id===id) || {emoji:'🍏',name:id} }))
        .sort((a,b) => b.count - a.count)
        .map(x => `${x.meta.emoji} ${x.meta.name} ${x.count}`)
        .join(' · ')
    : '';
  return { label, tableInner, isCurrentWeek, c, bn, fruitLegend };
}
```

- [ ] **Step 2: Mostra la legenda in `buildWeeklyInline` (`index.html:1084-1095`).**

Sostituisci:
```js
function buildWeeklyInline() {
  const bn = state.trendsBaby || 'Gabriel';
  const c = COLORS[bn];
  const parts = buildWeeklySummaryParts(bn);
  let h = `<div class="content"><div class="content-title">📅 Riepilogo settimanale</div>`;
  h += `<div class="pills" style="margin-bottom:11px">${BABIES.map(b=>`<button class="pill ${bn===b?'on':'off'}"${bn===b?` style="background:${COLORS[b].grad}"`:''} onclick="setTrendsWeeklyBaby('${b}')">${b}</button>`).join("")}</div>`;
  h += `<div class="cal" style="padding:13px">`;
  h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><button onclick="navWeeklyTrends(1)" style="border:none;width:30px;height:30px;border-radius:10px;background:${hexA(c.pri,0.15)};color:${c.pri};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">‹</button><span style="font-size:13px;font-weight:700">${parts.label}</span><button onclick="navWeeklyTrends(-1)"${parts.isCurrentWeek?' disabled':''} style="border:none;width:30px;height:30px;border-radius:10px;background:${parts.isCurrentWeek?'var(--glass-2)':hexA(c.pri,0.15)};color:${parts.isCurrentWeek?'var(--hint)':c.pri};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">›</button></div>`;
  h += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-family:inherit">${parts.tableInner}</table></div>`;
  h += `</div></div>`;
  return h;
}
```
con:
```js
function buildWeeklyInline() {
  const bn = state.trendsBaby || 'Gabriel';
  const c = COLORS[bn];
  const parts = buildWeeklySummaryParts(bn);
  let h = `<div class="content"><div class="content-title">📅 Riepilogo settimanale</div>`;
  h += `<div class="pills" style="margin-bottom:11px">${BABIES.map(b=>`<button class="pill ${bn===b?'on':'off'}"${bn===b?` style="background:${COLORS[b].grad}"`:''} onclick="setTrendsWeeklyBaby('${b}')">${b}</button>`).join("")}</div>`;
  h += `<div class="cal" style="padding:13px">`;
  h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><button onclick="navWeeklyTrends(1)" style="border:none;width:30px;height:30px;border-radius:10px;background:${hexA(c.pri,0.15)};color:${c.pri};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">‹</button><span style="font-size:13px;font-weight:700">${parts.label}</span><button onclick="navWeeklyTrends(-1)"${parts.isCurrentWeek?' disabled':''} style="border:none;width:30px;height:30px;border-radius:10px;background:${parts.isCurrentWeek?'var(--glass-2)':hexA(c.pri,0.15)};color:${parts.isCurrentWeek?'var(--hint)':c.pri};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">›</button></div>`;
  h += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-family:inherit">${parts.tableInner}</table></div>`;
  if (parts.fruitLegend) h += `<div style="font-size:11px;color:var(--sub);margin-top:10px;text-align:center">🍎 ${parts.fruitLegend}</div>`;
  h += `</div></div>`;
  return h;
}
```

- [ ] **Step 3: Verifica statica.**

```bash
grep -nE "fruitTotals|fruitLegend|dayFruitLog|const catalog=fruitCatalog\(\)" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"
```

- [ ] **Step 4: Verifica live (data-safe).**

Harness H1-H3 (seed: Gabriel ha frutta oggi + nei 6 giorni precedenti alternati banana/pesca o pera×2). Naviga sulla view "trends"/settimanale (o valuta direttamente `buildWeeklySummaryParts('Gabriel')` in console):
```js
(() => {
  const parts = buildWeeklySummaryParts('Gabriel');
  return JSON.stringify({ hasFruitHeader: parts.tableInner.includes('🍎'), legend: parts.fruitLegend });
})();
```
Atteso: `hasFruitHeader: true`; `legend` non vuota e contiene sia banana che pera/pesca con i totali attesi dal seed (es. banana conta i giorni pari + oggi 2, quindi > 0).

Poi verifica l'omissione per un bambino/settimana senza dati:
```js
(() => {
  const parts = buildWeeklySummaryParts('Vittorio'); // Vittorio ha solo oggi, ma la settimana passata è vuota nel seed
  return parts.fruitLegend; // atteso: stringa con solo la voce di oggi (banana), non vuota se oggi è nella settimana corrente
})();
```
Verifica infine il caso realmente vuoto forzando un log azzerato:
```js
(() => {
  const saved = state.data.fruitLog; state.data.fruitLog = {};
  const parts = buildWeeklySummaryParts('Gabriel');
  const out = { legend: parts.fruitLegend, hasDash: parts.tableInner.includes('>—<') };
  state.data.fruitLog = saved; // ripristina
  return JSON.stringify(out);
})();
```
Atteso: `legend: ""` e la colonna 🍎 mostra `—` per tutti i giorni.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "Frutta: colonna e legenda nel riepilogo settimanale"
```

---

## Task 6: Export CSV

Aggiunge righe frutta all'export, tramite un helper isolato e testabile senza dover intercettare il download del browser.

**Files:**
- Modify: `index.html` — `exportCSV` (`index.html:803-818`).

**Interfaces — Consumes:** `state.data.fruitLog`, `fruitCatalog()` (Task 1).
**Interfaces — Produces:** `buildFruitCSVRows(): Array<Array<string>>`.

- [ ] **Step 1: Sostituisci `exportCSV` (`index.html:803-818`).**

Sostituisci:
```js
function exportCSV() {
  const BOM="﻿", rows=[["Data","Bambino","Categoria","Ora","ml","Tipo Latte","Tipo Pannolino","Colore","Terapia","Somministrata","Note"]];
  Object.keys(state.data).sort().forEach(date=>{
    BABIES.forEach(bn=>{
      const bd=state.data[date]?.[bn]; if(!bd) return;
      (bd.feeds||[]).forEach(f=>rows.push([date,bn,"Poppata",f.time,f.ml,f.type,"","","","",f.note||""]));
      (bd.diapers||[]).forEach(d=>rows.push([date,bn,"Pannolino",d.time,"","",d.dtype,d.color||"","","",d.note||""]));
      if(bd.weight)rows.push([date,bn,"Peso",bd.weight.time,bd.weight.kg,"","","","","",bd.weight.note||""]);
      (bd.temperatures||[]).forEach(t=>rows.push([date,bn,"Temperatura",t.time,t.temp,"","","","","",t.note||""]));
      if(bd.therapies)getActiveTherapies(bn,date).forEach(t=>{if(bd.therapies[t.id]!==undefined)rows.push([date,bn,"Terapia","","","","","",t.name,bd.therapies[t.id]?"Sì":"No",getDose(t,date,bn)]);});
    });
  });
  const csv=BOM+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=`pappa-tracker-${dk(new Date())}.csv`; a.click();
}
```
con:
```js
function buildFruitCSVRows() {
  const catalog = fruitCatalog();
  const out = [];
  const log = state.data.fruitLog || {};
  BABIES.forEach(bn => {
    const byDate = log[bn] || {};
    Object.keys(byDate).sort().forEach(date => {
      const day = byDate[date] || {};
      Object.keys(day).filter(id => day[id] > 0).forEach(id => {
        const meta = catalog.find(f => f.id === id) || { name: id, emoji: '🍏' };
        out.push([date, bn, "Frutta", "", day[id], `${meta.emoji} ${meta.name}`, "", "", "", "", ""]);
      });
    });
  });
  return out;
}
function exportCSV() {
  const BOM="﻿", rows=[["Data","Bambino","Categoria","Ora","ml","Tipo Latte","Tipo Pannolino","Colore","Terapia","Somministrata","Note"]];
  Object.keys(state.data).sort().forEach(date=>{
    BABIES.forEach(bn=>{
      const bd=state.data[date]?.[bn]; if(!bd) return;
      (bd.feeds||[]).forEach(f=>rows.push([date,bn,"Poppata",f.time,f.ml,f.type,"","","","",f.note||""]));
      (bd.diapers||[]).forEach(d=>rows.push([date,bn,"Pannolino",d.time,"","",d.dtype,d.color||"","","",d.note||""]));
      if(bd.weight)rows.push([date,bn,"Peso",bd.weight.time,bd.weight.kg,"","","","","",bd.weight.note||""]);
      (bd.temperatures||[]).forEach(t=>rows.push([date,bn,"Temperatura",t.time,t.temp,"","","","","",t.note||""]));
      if(bd.therapies)getActiveTherapies(bn,date).forEach(t=>{if(bd.therapies[t.id]!==undefined)rows.push([date,bn,"Terapia","","","","","",t.name,bd.therapies[t.id]?"Sì":"No",getDose(t,date,bn)]);});
    });
  });
  rows.push(...buildFruitCSVRows());
  const csv=BOM+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=`pappa-tracker-${dk(new Date())}.csv`; a.click();
}
```

- [ ] **Step 2: Verifica statica.**

```bash
grep -nE "function buildFruitCSVRows|rows.push\(\.\.\.buildFruitCSVRows" index.html
node -e "const s=require('fs').readFileSync('index.html','utf8');console.log('braces',(s.match(/{/g)||[]).length,(s.match(/}/g)||[]).length)"
```

- [ ] **Step 3: Verifica live (data-safe) — senza scaricare nulla, chiama l'helper direttamente.**

Harness H1-H3. In console:
```js
JSON.stringify(buildFruitCSVRows());
```
Atteso: un array con almeno le righe di oggi per Gabriel (`["<oggi>","Gabriel","Frutta","",2,"🍌 Banana",...]` e una per la pera) e Vittorio (`["<oggi>","Vittorio","Frutta","",1,"🍌 Banana",...]`), più le righe dei 6 giorni precedenti seminati in H3. Nessuna riga con `Categoria !== "Frutta"` deve comparire in questo array (verifica che ogni riga abbia `r[2]==="Frutta"`):
```js
buildFruitCSVRows().every(r => r[2] === "Frutta"); // atteso: true
```

- [ ] **Step 4: Commit + cleanup.**

```bash
git add index.html
git commit -m "Frutta: righe Frutta nell'export CSV"
rm -f _sandbox.html
git status   # _sandbox.html NON deve comparire
```

---

## Self-Review (spec coverage)

- Spec: modello dati `fruitLog`/`customFruits`/`hiddenFruits`, mai innestati in `feeds` → Task 1. ✓
- Spec §Preset (12 frutti con emoji) → Task 1 Step 1 (`FRUIT_PRESETS`). ✓
- Spec §A card "🍎 Frutta" sotto Poppate, griglia chip, badge, "Dati oggi" con stepper → Task 2. ✓
- Spec §A "＋ Aggiungi frutto" e nascondere preset → Task 3 (`openAddFruit`/`openManageFruits`). ✓
- Spec §B riepilogo giornaliero (recap-card, riga 🍎, omessa se vuota) → Task 4. ✓
- Spec §C riepilogo settimanale (colonna 🍎 + legenda totali, omessi se vuoti) → Task 5. ✓
- Spec §E sync/merge (5 punti di esclusione + merge dedicato "local wins per giorno") → Task 1 Step 2-5. ✓
- Spec §E export CSV → Task 6. ✓
- Vincolo di sicurezza dati (mai toccare `feeds`) → Global Constraints + verifica esplicita Task 1 Step 7 (`state.data[...].Gabriel?.feeds` invariato). ✓
- Nessun vincolo sui giorni passati per la frutta (a differenza degli Obiettivi) → per design nessun codice la impedisce: `buildFruitSection`/`bumpFruit` operano su qualunque `key` passato, incluso `state.selDate` di un giorno passato, senza alcun controllo `isPast`. ✓ (nessun task dedicato necessario: è l'assenza di un vincolo, non una feature da costruire)
