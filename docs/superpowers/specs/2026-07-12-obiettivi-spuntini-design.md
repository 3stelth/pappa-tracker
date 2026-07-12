# Obiettivi — gestione "spuntini" (poppate fuori-pasto)

Data: 2026-07-12
File toccato: `index.html` (app single-file)

## Contesto e problema

La scheda **Obiettivi** (`buildGoals`, `index.html:1203`) pianifica `n` pasti al giorno e mappa **ogni** poppata del giorno, in ordine di orario, a uno slot 1→n (`feeds[j-1]`, `index.html:1272`). Non distingue un pasto "vero" da uno spuntino fuori-programma.

Caso reale (11 luglio, `n=5`): dopo alcuni pasti veri i bambini hanno ricevuto un breve **spuntino**. Non essendo stato accorpato al pasto precedente (erano passate ore), lo spuntino è finito nel 5° slot (piccolo → "ultimo pasto ridotto"). Il vero pasto serale è diventato la 6ª poppata → oltre gli slot → conteggiato solo come "+1 extra" e **sparito dalla griglia**. In realtà: 5 pasti + 1 spuntino, ma la griglia mostra l'ultimo pasto ridotto e ne nasconde uno.

## Obiettivo

Permettere di marcare una poppata come **spuntino**, così che negli Obiettivi:
1. lo spuntino **non occupi uno slot** di pasto pianificato (i pasti veri riprendono il loro posto);
2. lo spuntino sia mostrato **a parte** sotto gli slot;
3. i suoi ml **contino** nel totale giornaliero (i pasti rimanenti si riducono per compensare — scelta utente "scala dal totale").

Non-obiettivi (YAGNI): nessuna classificazione automatica per soglia; nessuna categoria oltre "spuntino"; nessuna modifica alle altre schede; lo spuntino si aggiunge/marca dalla scheda poppata standard, non dal modale-obiettivo (che serve a riempire uno slot pianificato).

## Vincolo di sicurezza dati (NON NEGOZIABILE)

Nessun pasto (`feeds`) reale va creato, spostato o cancellato dall'implementazione. Il flag `snack` è metadata impostato **solo da azione utente** tramite la scheda di modifica poppata (come già si modifica ml/ora). Nessuna mutazione automatica dei feeds; nessuna modifica alla logica di merge/tombstone. Vedi [[never-fabricate-or-mutate-feeds]].

## Modello dati

Un flag booleano opzionale sulla singola poppata:

```
feed = { id, time, ml, type, note, snack?: true, ...(planned/target/leftover/extra se da modale-obiettivo) }
```

- Assente/falsy = pasto normale. `true` = spuntino.
- Vive sul feed esistente; `mergeData` conserva già l'intero oggetto voce (`index.html:617` mantiene `e`), quindi nessuna modifica al merge.

## Componenti / modifiche

### A. Interruttore "🍪 Spuntino" nella scheda poppata (`showModal`, `index.html:1417`)

- Aggiungere, **solo per le poppate** (`isF`), un toggle a chip "🍪 Spuntino" / "🍽️ Pasto" (default: Pasto).
- `showModal` prende un nuovo parametro `fsnack` (booleano) che imposta lo stato iniziale del toggle.
- `openAdd` (`index.html:1408`) passa `false`.
- `openEdit` (`index.html:1411`) passa `e.snack` della poppata in modifica → consente la correzione a posteriori (es. 11 luglio).
- `submitForm` (`index.html:1430`) legge il toggle e include `snack:true` nell'entry solo quando attivo (altrimenti il campo è assente).

Nota: `addEntry` in modifica **sostituisce** l'intera voce mantenendo solo `id` (`index.html:775`) — comportamento preesistente. Marcare uno spuntino tramite questo modale quindi rimuove eventuali `planned/target/leftover` dalla voce: accettabile, perché uno spuntino non è un pasto pianificato.

### B. Separazione pasti/spuntini nella griglia (`buildGoals`, `index.html:1258-1309`)

Dentro il `BABIES.forEach`, sostituire l'uso diretto di `feeds`/`done`:
```js
const allFeeds = state.data[key]?.[bn]?.feeds || [];
const meals=[], snacks=[];
allFeeds.forEach((f,idx)=>{ (f.snack?snacks:meals).push({...f,_i:idx}); }); // _i = indice reale per la modifica
const realDone = meals.length;
```
- Gli slot `for(let j=1;j<=n;j++)` mappano `meals[j-1]` (non più `feeds[j-1]`).
- Il click di modifica dello slot usa l'indice reale: `editPlannedSlot('${bn}', ${meals[j-1]._i})` invece di `${j-1}`.
- `done` → `realDone` in tutti gli usi di slot (`j<=realDone`, `isNext=j===realDone+1`, `anchor`, `remainingSlots`, `extra`, "Fatti").

### C. Calcoli "scala dal totale"

- `consumedSoFar = allFeeds.reduce((s,x)=>s+(x.ml||0),0)` — include gli spuntini (contano nel totale).
- `remainingSlots = Math.max(0, n-realDone)`.
- `remainingPer = (dailyTarget>0 && remainingSlots>0)?Math.max(0,Math.round((dailyTarget-consumedSoFar)/remainingSlots/5)*5):0` — invariato nella forma; ora `consumedSoFar` (con spuntini) riduce i pasti rimanenti.
- `anchor = realDone>0 ? meals[realDone-1].time : null` — la tabella di marcia si ancora all'ultimo **pasto vero**, non allo spuntino.
- Recap sezione A (`index.html:1230-1233`): `dDone` conta solo i pasti veri (`meals.length`), `dCons` = somma di tutte le poppate; "restano Y pasti" usa `n-realDone`.

### D. Visualizzazione spuntini (griglia, dopo gli slot, prima del riepilogo)

Per ogni bambino, se `snacks.length>0`, una riga compatta sotto gli slot:
```
🍪 Spuntino · HH:MM · X ml   (toccabile → editPlannedSlot(bn, snack._i))
```
Stile coerente con `.goal-slot` ma visivamente distinto (nuova classe `.goal-snack`: più piccola, sfondo neutro, niente numero di slot). Ogni spuntino è cliccabile per modificarlo/togliere il flag.

### E. Riepilogo (`index.html:1305-1307`)

- `extra = realDone>n ? ` · +${realDone-n} extra` : ''` (pasti veri oltre il pianificato).
- Nota spuntini: `snacks.length ? ` · 🍪 ${snacks.length} spuntino${snacks.length>1?'i':''}` : ''`.
- Riga: `Fatti ${Math.min(realDone,n)}/${n}${extra}${snackNote}` + `${consumedSoFar} ml / obiettivo ${goalTot}`.

## Flusso dati / edge case

- **0 pasti veri, solo spuntini:** tutti gli slot pending; spuntini elencati; `remainingPer` calcolato su `n` slot con `consumedSoFar` degli spuntini.
- **Modifica indice:** poiché `feeds` è mantenuto ordinato per orario (`sort` in `addEntry`/`addPlannedFeed`), l'ordine dell'array = ordine cronologico; `_i` resta l'indice valido per `openEdit`.
- **Giorni passati:** invariata la cristallizzazione; gli spuntini si mostrano allo stesso modo (riga separata), gli slot pending restano senza orario.
- **Retro-fix 11 luglio:** l'utente apre la poppata-spuntino dalla griglia (o dalla scheda Oggi), attiva "🍪 Spuntino", salva → lo slot si libera e il pasto serale ricompare.

## Testing (manuale, anteprima locale data-safe)

Anteprima su copia sandbox con cloud disattivato (`SUPABASE_ANON_KEY=""`) e dati sintetici; mai `saveData` sui dati reali.

1. Toggle: aggiungendo/modificando una poppata compare "🍪 Spuntino"; salvando con toggle attivo la voce ha `snack:true`; senza, il campo è assente.
2. Slot: giornata con 5 pasti veri + 1 spuntino (n=5) → i 5 slot mostrano i 5 pasti veri (pasto serale incluso), lo spuntino è nella riga "🍪" separata, non in uno slot.
3. Calcolo: `consumedSoFar` include lo spuntino; i pasti rimanenti si riducono di conseguenza; "Fatti 5/5 · 🍪 1 spuntino".
4. Modifica dallo slot: toccando uno slot si apre la poppata **giusta** (indice reale corretto anche con spuntini in mezzo).
5. Togli flag: modificando lo spuntino e disattivando "Spuntino", torna a essere un pasto e rientra negli slot.
6. Regressione: giornata senza spuntini identica a prima; giorni passati invariati; badge avanzati/di più e allineamento 68px intatti.
