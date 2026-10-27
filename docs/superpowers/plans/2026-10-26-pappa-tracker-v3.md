# Pappa Tracker v3 — piano di costruzione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** costruire `/v3/`, un'app di famiglia che mostra peso, lunghezza, temperatura, percentili di crescita OMS sull'età corretta, gradimento delle pappe e vaccini, senza toccare la v1 e la v2.

**Architecture:** pagina statica servita da GitHub Pages, nessuna compilazione. `index.html` tiene il guscio (intestazione, barra delle sezioni, contenitore vuoto) e carica moduli ES. Ogni sezione ha un modulo che disegna il proprio markup dentro il contenitore e un foglio di stile suo. I dati stanno in `localStorage` e si sincronizzano con la riga Supabase `id='v3'`. I percentili si calcolano dalle tabelle OMS per giorno di età, caricate come JSON. Ogni funzione che si può provare senza schermo torna una stringa o un oggetto, così i test girano con Node.

**Tech Stack:** HTML, CSS, JavaScript con moduli ES, `fetch` verso Supabase REST, SVG disegnato a mano per il grafico e le sagome. Node per lanciare i test. Python 3 con `openpyxl` e `Pillow` solo per generare tabelle e icone, una volta, fuori dall'app.

**Spec:** `docs/superpowers/specs/2026-10-26-pappa-tracker-v3-design.md`

## Global Constraints

- Cartella `/v3/`. La v1 alla root e la v2 in `/v2/` non si toccano mai.
- Nessuna compilazione, nessun passo di build, nessuna dipendenza scaricata a ogni apertura.
- Supabase: `https://ukcwajbbybkobaroyqiq.supabase.co`, chiave publishable `sb_publishable_jicoWcdW87NzVXFQTx3fxA_dJOv_dVe`, tabella `pappa_tracker_data`, riga `id='v3'`. La riga `id='main'` si legge, non si scrive mai.
- Chiave di localStorage: `pappatracker_data_v3`.
- Bambini: `['Gabriel','Vittorio']`. Colori: Gabriel `#3B82F6`, Vittorio `#14B8A6`.
- Nascita `2025-12-08`. Termine `2026-03-05`. Prematurità 87 giorni. Tabelle OMS valide da 0 a 1856 giorni di età corretta.
- Lingua italiana in ogni testo visibile. Virgola decimale nei numeri mostrati, punto nei dati.
- Larghezza di riferimento 480 px. Niente pulsante flottante: il `+` sta nell'intestazione.
- Niente millilitri, pannolini, terapie, grammature, orari dei pasti, notifiche, soglie o avvisi sulla temperatura.
- Niente rosso e niente parole di giudizio sulla crescita.
- Il tocco risponde su `pointerdown`. Le liste e i chip si aggiornano sul posto: mai ricostruire tutta la schermata a ogni tocco.
- Riga di attribuzione in fondo alla schermata Crescita: `Curve: WHO Child Growth Standards 2006, Organizzazione Mondiale della Sanità. CC BY-NC-SA 3.0 IGO.`
- Riga fissa sotto i percentili: `Percentile e punteggio z sono descrizioni statistiche, da leggere insieme al pediatra. Non sono un voto e non sono una diagnosi.`
- **Proprietà dei file:** ogni task scrive solo i file elencati sotto «Files». Nessun task diverso dal Task 3 modifica `index.html`. Ogni sezione mette il suo CSS nel suo foglio. Nessuna sezione importa un'altra sezione: si parlano solo attraverso `app.js` e `dati.js`.
- **Il repository è pubblico** e GitHub Pages ne serve i file. Nessun codice fiscale e nessun peso dei bambini nei file di test. `v3/dati/vaccini.json` contiene dati sanitari di due minori (date, prodotti, lotti): sta in `.gitignore`, resta sul computer e **non entra in cronologia**. L'app lo legge se lo trova; sul sito pubblicato non lo trova, e la sezione Vaccini parte vuota con il `+` per aggiungere a mano. Questa scelta cambia solo se l'utente dice di pubblicarlo.
- Nessun task esegue comandi `git`. I commit li fa chi coordina, a ondata finita.

## Review Focus

Classi di ingresso che la specifica implica e che nessun task eserciterebbe da sé. Ogni riga ha il suo test, nel task che possiede il codice.

1. **Età corretta negativa** (misura prima del 5 marzo 2026): le tabelle OMS non la coprono. L'app mostra la misura senza percentile e scrive perché. Test nel Task 2.
2. **Supabase irraggiungibile al primo avvio**: l'app non deve creare una riga `v3` vuota, perché quella riga diventerebbe la copia dei dati storici. Si apre con i dati locali e riprova alla prossima apertura. Test nel Task 4.
3. **Forme vecchie dei dati storici**: `temperature` al singolare invece di `temperatures`, pappe con `items` invece di `foods`, gradimenti `all`/`half`/`little`. Si leggono tutte senza perdere niente e senza riscrivere lo storico. Test nel Task 4 e nel Task 8.
4. **Nessuna lunghezza nel database**: è il caso reale di oggi. Sagoma grigia con l'invito, grafico della lunghezza con l'invito, nessuna altezza stimata dal peso. Test nel Task 6 e nel Task 7.
5. **Una sola misura, o nessuna**: niente differenza rispetto alla pesata prima, niente linea con un punto solo, nessun percentile di partenza quando le misure sono meno di due. Test nel Task 6 e nel Task 7.

## Come si provano i test

Un modulo di test per argomento, sotto `v3/test/`. Ogni modulo esporta un elenco di casi:

```js
// v3/test/<nome>.test.js
export const nome = 'dati';
export const casi = [
  { nome: 'il peso più recente vince', prova: () => { if (x !== y) throw new Error(`atteso ${y}, trovato ${x}`); } },
];
```

Due modi di lanciarli, sugli stessi moduli:

- `node v3/test/esegui.mjs` lancia tutto; `node v3/test/esegui.mjs dati crescita` lancia solo quelli nominati. Stampa una riga per caso, il totale, ed esce con 1 al primo fallimento.
- `v3/test/tutti.test.html` lancia tutto nel browser, scrive l'esito in pagina e mette `document.title` a `OK` oppure a `FALLITO`.

Perché una funzione si possa provare con Node, le funzioni che disegnano **tornano una stringa** (SVG o HTML) e non toccano il DOM. Il collegamento al DOM sta solo nel codice che registra la sezione, e si prova a mano nel browser.

## Ordine di esecuzione

1. **Prima ondata, in parallelo:** Task 1 (tabelle), Task 3 (guscio, icone, lanciatore dei test), Task 4 (dati).
2. **Seconda ondata:** Task 2 (percentili), che ha bisogno dei JSON del Task 1 e del lanciatore del Task 3.
3. **Terza ondata, in parallelo:** Task 5, 6, 7, 8, 9.
4. **In fondo, da solo:** Task 10.

---

## Task 1: tabelle OMS per giorno e verifica automatica

**Files:**
- Create: `v3/strumenti/genera-tabelle.py`
- Create: `v3/dati/oms-peso-giorni.json`, `v3/dati/oms-lunghezza-giorni.json`
- Create: `v3/test/oms-sd-pubblicati.json`, `v3/test/riferimento-z.json`
- Create: `v3/test/tabelle.test.js`
- Create: `v3/test/aiuto.js`, `v3/test/esegui.mjs`, `v3/test/tutti.test.html` (il lanciatore comune: lo scrive questo task perché serve a tutti gli altri)
- Create: `.github/workflows/verifica-v3.yml`

**Interfaces:**
- Consumes: i due file OMS già scaricati, passati come argomenti: `wfa-boys-day.xlsx` (peso per età, 0-1856 giorni) e `lhfa-boys-day.xlsx` (lunghezza per età), in
  `C:\Users\pchome\AppData\Local\Temp\claude\C--Users-pchome-Documents-pappa-tracker--claude-worktrees-app-semplificata-v2-600023\47cf076c-82f6-4115-bf97-f9e1b6c5c60a\scratchpad\who\`.
  Se mancano, si riscaricano dagli URL scritti nella specifica.
- Produces: la forma dei JSON che tutta l'app legge.

```
v3/dati/oms-<misura>-giorni.json
{ "misura":"peso", "unita":"kg",
  "fonte":"WHO Child Growth Standards 2006, weight-for-age boys, expanded tables",
  "licenza":"CC BY-NC-SA 3.0 IGO",
  "giorni":[[L,M,S], ...] }          // indice = giorni di età corretta, 0..1856, 1857 righe

v3/test/oms-sd-pubblicati.json
{ "z":[-3,-2,-1,0,1,2,3],
  "peso":[[v,v,v,v,v,v,v], ...],     // stesso indice, i valori che l'OMS pubblica
  "lunghezza":[[...], ...] }

v3/test/riferimento-z.json
{ "casi":[ {"misura":"peso","giorni":123,"valore":5.512,"z":-0.4213987}, ... ] }
```

- [ ] **Step 1: scrivi `v3/strumenti/genera-tabelle.py`**

Due argomenti: il percorso del file del peso, poi quello della lunghezza. Scrive i quattro JSON sotto `v3/`. Legge con `openpyxl` in `read_only` le colonne `Day`, `L`, `M`, `S` e `SD3neg SD2neg SD1neg SD0 SD1 SD2 SD3`. Si ferma con un errore se i giorni non sono 0..1856 senza buchi. I casi di `riferimento-z.json` sono deterministici e senza dati di famiglia: per ogni `g` in `range(0, 1857, 9)` e per ogni misura, prende `z` da `[-2.5, -1.3, -0.4, 0.37, 1.1, 2.2]` a rotazione sull'indice, calcola `valore = round(M*(1+L*S*z)**(1/L), 3)` e salva lo `z` **ricalcolato da quel valore arrotondato**, con 7 decimali.

- [ ] **Step 2: scrivi il lanciatore dei test**

`v3/test/aiuto.js` espone `leggiJson(percorso)` (con `fs` in Node, con `fetch` nel browser), più `uguale`, `vicino` e `vero`, che lanciano un errore con un messaggio leggibile. `v3/test/esegui.mjs` prende i nomi dei moduli da provare, oppure li cerca tutti con `fs.readdir` su `v3/test/*.test.js`. Importa ogni modulo, gira ogni caso dentro un `try`, stampa `ok` o `FALLITO` con il messaggio, e in fondo `N casi su M`. Esce con 1 se almeno un caso è fallito. Un modulo che non esiste ancora si salta, scrivendolo. `v3/test/tutti.test.html` importa gli stessi moduli nel browser, scrive l'esito in pagina e mette `document.title`.

- [ ] **Step 3: scrivi `v3/test/tabelle.test.js`**

```js
export const nome = 'tabelle';
// 1. le due tabelle hanno 1857 giorni
// 2. le LMS riproducono i valori pubblicati: per 1857 giorni x 2 misure x 7 z,
//    |M*(1+L*S*z)^(1/L) - pubblicato| <= 0.001, e i confronti sono 25998
// 3. lo scarto massimo è <= 0.0005  (l'arrotondamento alla terza cifra dell'OMS)
// 4. ogni caso di riferimento-z.json torna entro 1e-7
// 5. il giorno 0 del peso ha M fra 3.3 e 3.4; il giorno 0 della lunghezza ha M fra 49 e 50
```

- [ ] **Step 4: lancia il generatore**

Run: `python -I v3/strumenti/genera-tabelle.py "<cartella who>/wfa-boys-day.xlsx" "<cartella who>/lhfa-boys-day.xlsx"`
Atteso: scrive i quattro file e stampa `peso: 1857 giorni` e `lunghezza: 1857 giorni`.

- [ ] **Step 5: lancia il test**

Run: `node v3/test/esegui.mjs tabelle`
Atteso: 5 casi su 5, `25998 confronti`, uscita 0.

- [ ] **Step 6: scrivi `.github/workflows/verifica-v3.yml`**

Gira su `push` e `pull_request` quando cambia qualcosa sotto `v3/`. Un passo solo: `node v3/test/esegui.mjs`. Nessuna dipendenza da installare.

---

## Task 2: `crescita.js` — età corretta, LMS, punteggio z, percentile

**Files:**
- Create: `v3/crescita.js`
- Test: `v3/test/crescita.test.js`

**Interfaces:**
- Consumes: i JSON del Task 1.
- Produces:

```js
export const NASCITA = '2025-12-08';
export const TERMINE = '2026-03-05';
export const GIORNO_MAX = 1856;
export async function caricaTabelle(leggi)   // leggi(percorso) -> oggetto; di default fetch.
                                             // -> {peso:{unita,giorni}, lunghezza:{…}}, tenute in cache
export function lms(misura, giorni)          // -> [L,M,S] | null fuori da 0..1856 o senza tabelle caricate
export function zDa(valore, terna)           // -> number
export function valoreA(terna, z)            // -> number
export function percentile(z)                // -> number 0..100
export function giorniDa(isoPartenza, isoMisura)   // -> intero, può essere negativo
export function etaScritta(isoPartenza, isoMisura) // -> '7 mesi e 20 gg' | '14 gg' | 'non ancora al termine'
export function percentileScritto(p)         // -> '<1°' | '40°' | '>99°'
export function zScritto(z)                  // -> 'z −0,25'
export const MOTIVO_FUORI_TABELLA = 'Le curve OMS partono dalla data del termine: prima non esistono.';
```

Le formule stanno nella specifica, sezione «Il calcolo»: `z = ((X/M)^L − 1)/(L·S)`, con il caso `|L| < 1e-9` che passa a `ln(X/M)/S`, e l'inversa `X = M·(1 + L·S·z)^(1/L)`. `percentile` usa `erf` con l'approssimazione di Abramowitz-Stegun 7.1.26. Il punteggio z **non si tronca mai**. `giorniDa` compone le date in locale (`new Date(iso + 'T00:00:00')`), mai con `toISOString`. `caricaTabelle` prende i percorsi con `new URL('./dati/…', import.meta.url)`.

- [ ] **Step 1: scrivi `v3/test/crescita.test.js`**

```
 1. lms('peso', -1) è null                       → l'età corretta negativa non ha tabella
 2. lms('peso', 1857) è null                     → oltre il limite non ha tabella
 3. lms('peso', 0) e lms('lunghezza', 1856) non sono null
 4. ogni caso di riferimento-z.json torna entro 0.01
 5. percentile(0) è 50; |percentile(-1.881) - 3| <= 0.05; |percentile(1.881) - 97| <= 0.05
 6. zDa(valoreA(terna, 1.234), terna) torna 1.234 entro 1e-9, per il giorno 0 e il giorno 1856
 7. giorniDa(TERMINE, '2026-03-19') è 14         → la prima misura del database
 8. giorniDa(TERMINE, '2026-02-23') è -10        → prima del termine, negativo
 9. giorniDa(NASCITA, '2026-03-05') è 87         → la prematurità
10. giorniDa(TERMINE, '2026-10-25') è 234        → oggi
11. etaScritta(TERMINE, '2026-02-23') è 'non ancora al termine'
12. etaScritta(TERMINE, '2026-03-19') è '14 gg'
13. etaScritta(TERMINE, '2026-10-25') è '7 mesi e 20 gg'
14. percentileScritto(0.4) è '<1°'; percentileScritto(40.098) è '40°'; percentileScritto(99.6) è '>99°'
15. zScritto(-0.25) è 'z −0,25'   (meno tipografico, virgola decimale)
16. i quattro numeri veri: con le tabelle caricate,
    zDa(2.970, lms('peso',14))  vale -1.6054 entro 0.0005  e percentile vale  5.420 entro 0.005
    zDa(8.290, lms('peso',234)) vale -0.2508 entro 0.0005  e percentile vale 40.098 entro 0.005
    zDa(2.125, lms('peso',14))  vale -3.7405 entro 0.0005  e percentile vale  0.009 entro 0.005
    zDa(6.450, lms('peso',234)) vale -2.5194 entro 0.0005  e percentile vale  0.588 entro 0.005
```

Il caso 16 usa quattro numeri già verificati sulle tabelle giornaliere. Sono i pesi veri dei due bambini, ma stanno già nel database pubblico: qui servono come àncora, perché sono l'unico punto in cui un errore nel calcolo si vedrebbe subito sullo schermo.

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs crescita`
Atteso: fallisce, `crescita.js` non esiste.

- [ ] **Step 3: scrivi `v3/crescita.js`**

- [ ] **Step 4: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs crescita`
Atteso: 16 casi su 16, uscita 0.

---

## Task 3: guscio, stili di base, navigazione, icone, lanciatore dei test

**Files:**
- Create: `v3/index.html`, `v3/stili/base.css`, `v3/app.js`, `v3/manifest.json`
- Create: `v3/strumenti/genera-icona.py`, `v3/icona.svg`, `v3/icona-180.png`, `v3/icona-512.png`
- Il lanciatore dei test (`v3/test/aiuto.js`, `esegui.mjs`, `tutti.test.html`) lo scrive il Task 1.

**Interfaces:**
- Consumes: niente.
- Produces:

```js
// v3/app.js
export const BAMBINI = ['Gabriel','Vittorio'];
export const COLORE = { Gabriel:'#3B82F6', Vittorio:'#14B8A6' };
export const SIGLA  = { Gabriel:'g', Vittorio:'v' };      // classe CSS del bambino
export function registraSezione(nome, { titolo, sotto, disegna, piu })
   // nome: 'oggi'|'crescita'|'misure'|'pappe'|'vaccini'
   // disegna(contenitore) viene chiamata quando la sezione si apre
   // piu() viene chiamata al tocco del + nell'intestazione; undefined nasconde il +
export function vaA(nome)
export function apriTendina(html, { titolo, sotto }) // -> l'elemento della tendina, già in pagina
export function chiudiTendina()
export function avviso(testo)
export function registraInserimento(f)               // misure.js registra qui la sua tendina
export function apriInserimentoMisura({ tipo, bambino })  // chiama f; senza f non fa niente
export function isoOggi()                            // data locale 'AAAA-MM-GG'
export function dataLunga(iso)                       // '25 ottobre 2026'
export function dataCorta(iso)                       // '25 ott'
export function numero(valore, decimali)             // '8,29'  (virgola decimale)
export const MESI = ['gennaio', …];
export const ABBR = ['gen', …];
```

```js
// v3/test/aiuto.js
export async function leggiJson(percorsoRelativoAllaRadiceV3)  // fs in Node, fetch nel browser
export function uguale(trovato, atteso, messaggio)             // lancia un errore se diversi
export function vicino(trovato, atteso, tolleranza, messaggio)
export function vero(condizione, messaggio)
```

`index.html`: le `<meta>` del telefono, `<link rel="icon" href="icona.svg">`, `<link rel="apple-touch-icon" href="icona-180.png">`, `<meta name="apple-mobile-web-app-title" content="Pappa">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<link rel="manifest" href="manifest.json">`, i sei `<link>` dei fogli di stile, l'intestazione con titolo, sottotitolo e i due pulsanti (ingranaggio e `+`), un `<main id="vista">` vuoto, la barra delle cinque sezioni con le icone SVG del mockup, e in fondo i moduli caricati con `<script type="module">`. Nessun contenuto di sezione dentro `index.html`.

- [ ] **Step 1: copia gli stili dal mockup approvato in `v3/stili/base.css`**

Da `.claude/mockup/v3b.html` prendi i token di `:root`, `body`, e le classi `.hdr .hdr-t .hdr-s .hdr-b .tabbar .tb .card .sect .lbl .chip .sheet .grab .save .rowline .seg .who-pick .src .hide mark`. Adatta il guscio da «telefono finto dentro una pagina» a pagina intera: quello che nel mockup è `.screen` diventa il `body`, l'intestazione resta in alto con `position:sticky`, la barra delle sezioni in basso con `position:fixed`, il contenuto scorre in mezzo con `padding-bottom:92px`. Contenuto larghezza massima 480 px, centrato. Niente pulsante flottante.

- [ ] **Step 3: scrivi `v3/strumenti/genera-icona.py`**

Disegna con `Pillow` la sagoma della funzione `baby()` del mockup `v3b.html`: testa (ellisse), orecchie, corpo, braccia e gambe (rettangoli arrotondati), piedi, occhi e bocca. Sfondo: sfumatura in diagonale dal blu `#3B82F6` al verde acqua `#14B8A6`, sagoma bianca sopra, nessuna trasparenza (iOS mette il nero dove c'è il canale alfa). Disegna a 2048 px e riduce con `LANCZOS`. Scrive `v3/icona-512.png` e `v3/icona-180.png`, e `v3/icona.svg` con la stessa sagoma su fondo sfumato, per il favicon.

- [ ] **Step 4: lancia il generatore e guarda l'icona**

Run: `python -I v3/strumenti/genera-icona.py`
Atteso: tre file scritti; `v3/icona-180.png` è 180×180 in modo `RGB`. Apri l'immagine e controlla che si veda un bambino intero, con la testa dentro il quadrato e un margine su tutti i lati: iOS taglia gli angoli.

- [ ] **Step 5: scrivi `v3/manifest.json`**

`name` «Pappa Tracker», `short_name` «Pappa», `start_url` «.», `display` «standalone», `background_color` e `theme_color` `#EAF0FB`, le due icone con `sizes` e `type`.

- [ ] **Step 6: scrivi `v3/index.html` e `v3/app.js`**

Il cambio di sezione svuota `#vista` e chiama `disegna` della sezione nuova: è un cambio di schermata, non un aggiornamento al tocco. La tendina in basso è un elemento solo, riusato: `apriTendina` la riempie e la fa salire, `chiudiTendina` la fa scendere, il tocco fuori la chiude. Le animazioni della tendina partono dal valore che ha sullo schermo, così un gesto a metà si può invertire. I tocchi di barra e pulsanti rispondono su `pointerdown`.

- [ ] **Step 7: apri l'app e controlla il guscio**

Run: apri `http://localhost:8765/v3/` (server di anteprima, nome `pappa`)
Atteso: intestazione, cinque voci in basso, nessun errore in console. Il tocco su ogni voce cambia il titolo. A 390 px di larghezza niente scorrimento orizzontale.

---

## Task 4: `dati.js` — stato, localStorage, Supabase, copia iniziale, fusione

**Files:**
- Create: `v3/dati.js`
- Test: `v3/test/dati.test.js`

**Interfaces:**
- Consumes: niente.
- Produces:

```js
export const stato = { data:{}, sync:'fermo' };   // 'fermo'|'in corso'|'ok'|'errore'
export const CHIAVE_LOCALE = 'pappatracker_data_v3';
export const RIGA = 'v3';
export function isGiorno(chiave)                  // true solo per 'AAAA-MM-GG'
export function fondi(mio, altrui)                // -> dati fusi; non modifica gli argomenti
export function caricaLocale()
export function salvaLocale()
export async function avvia()                     // copia iniziale se serve, poi sincronizza
export async function sincronizza()
export function pesate(bambino)                   // -> [{iso, kg, note}] in ordine di data
export function lunghezze(bambino)                // -> [{iso, cm, note}] in ordine di data
export function temperature(bambino)              // -> [{iso, temp, ora, note, id}] dalla più recente
export function pappe()                           // -> [{iso, id, bambino, alimenti:[id], giudizio}]
export function vaccini()                         // -> {aggiornatoAl, sedute:[…]} | null
export function scriviMisura(bambino, tipo, valore, iso)  // 'peso'|'lunghezza'|'temperatura'
export function cancellaMisura(bambino, tipo, iso, id)
export function scriviGiudizio(bambino, iso, alimenti, giudizio)   // 'good'|'ok'|'bad'
export function onCambio(f)
export function provaSenzaScritture(acceso)       // acceso: salvaLocale e sincronizza non fanno niente
```

`scriviMisura` scrive `{kg|cm, time, note, addedAt}` per peso e lunghezza, un oggetto per bambino per giorno; per la temperatura aggiunge un elemento con `id` alla lista `temperatures`. Dopo ogni scrittura: `salvaLocale()`, poi `sincronizza()` senza bloccare l'interfaccia, poi i richiami di `onCambio`. Con `provaSenzaScritture(true)` le due scritture scrivono in console quello che avrebbero fatto e non fanno niente: serve a provare l'inserimento senza mandare misure finte nel Supabase di famiglia.

`fondi` segue queste regole:
- peso e lunghezza: vince l'oggetto con `addedAt` più grande; `addedAt` mancante vale 0.
- `temperatures` e `meals`: unione per `id`; a `id` uguale vince quello di `mio`. Un elemento senza `id` si tiene con una chiave composta dai suoi campi, così non si duplica.
- chiavi che non sono date (`goals`, `vaccini`, `customFoods`, `customFruits`, `hiddenFruits`, `hiddenFoods`, `fruitLog`, `doseOverrides`, e ogni altra): se sta in uno solo, si tiene; se sta in tutti e due, vince `mio`, tranne `vaccini` dove vince quello con `modificatoAt` più grande.
- `_tombstones`: unione per `id`; alla fine ogni elemento con quell'`id` sparisce da `temperatures` e `meals`.
- niente si cancella mai solo perché manca da una parte.

`avvia()`: legge `localStorage`; poi chiede a Supabase la riga `v3` con `?id=eq.v3&select=data`. Tre casi.
1. La riga `v3` c'è: fonde con quella, risalva, va avanti.
2. La riga `v3` non c'è e la riga `main` si legge: copia **tutto** il contenuto di `main` nella riga `v3` con una `POST` e lo usa.
3. Una delle due richieste non risponde: **non scrive niente di remoto**, mette `stato.sync='errore'`, tiene i dati locali. La copia si riprova alla prossima apertura.

Il seme dei vaccini: se `stato.data.vaccini` manca, `avvia()` legge `dati/vaccini.json` e lo mette dentro una volta sola, con `modificatoAt` al momento. Se il file non si legge, non mette niente.

Chiamate a Supabase: `apikey` e `Authorization: Bearer` con la chiave publishable; sulla `POST` anche `Prefer: resolution=merge-duplicates,return=minimal`.

- [ ] **Step 1: scrivi `v3/test/dati.test.js`**

Niente rete e niente `localStorage` vero: ogni caso costruisce i suoi oggetti, mette `stato.data` a mano e chiama la funzione. Per i casi di `avvia()` passa una finta `fetch` come parametro: `avvia({ fetch: finta })`.

```
 1. fondi: il peso con addedAt più recente vince
 2. fondi: un giorno presente solo da una parte resta
 3. fondi: temperature con id diversi si uniscono; lo stesso id non si duplica
 4. fondi: una tombstone toglie la temperatura con quell'id da tutte e due le parti
 5. fondi: 'goals' presente solo nell'altra parte resta
 6. fondi: 'vaccini' con modificatoAt più recente vince
 7. fondi: non modifica gli oggetti che riceve
 8. isGiorno('2026-03-19') è true; isGiorno('goals') e isGiorno('_tombstones') sono false
 9. temperature(): legge anche 'temperature' al singolare, e non riscrive lo storico
10. pappe(): legge una pappa vecchia con 'items' e una nuova con 'foods', e dà gli stessi alimenti
11. pappe(): 'all' si legge 'good', 'half' si legge 'ok', 'little' si legge 'bad'
12. pesate(): esce in ordine di data anche se le chiavi dell'oggetto sono disordinate
13. scriviMisura('Gabriel','peso',8.5,'2026-10-26') mette kg, time, note e addedAt
14. scriviMisura due volte nello stesso giorno sovrascrive, e addedAt cresce
15. cancellaMisura su una temperatura lascia una tombstone con il suo id
16. con provaSenzaScritture(true), scriviMisura non tocca localStorage e non chiama fetch
17. avvia() con la riga v3 presente: nessuna POST, i dati arrivano da lì
18. avvia() con la riga v3 assente e main presente: una POST sola, su id 'v3', con tutto il contenuto di main
19. avvia() con la rete che fallisce: nessuna POST, stato.sync è 'errore', stato.data resta quello locale
20. avvia() non manda mai una POST su id 'main'
```

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs dati`
Atteso: fallisce, `dati.js` non esiste.

- [ ] **Step 3: scrivi `v3/dati.js`**

- [ ] **Step 4: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs dati`
Atteso: 20 casi su 20, uscita 0.

---

## Task 5: sezione Misure — inserimento, elenco, modifica, cancellazione

**Files:**
- Create: `v3/misure.js`, `v3/stili/misure.css`
- Test: `v3/test/misure.test.js`

**Interfaces:**
- Consumes: `app.js` (`registraSezione`, `registraInserimento`, `apriTendina`, `chiudiTendina`, `avviso`, `BAMBINI`, `SIGLA`, `isoOggi`, `dataCorta`, `numero`), `dati.js` (`pesate`, `lunghezze`, `temperature`, `scriviMisura`, `cancellaMisura`, `onCambio`).
- Produces:

```js
export const TIPI = {
  peso:        { nome:'Peso',        unita:'kg', emoji:'⚖️', passo:0.005, scorciatoie:[-0.05,-0.01,0.01,0.05], decimali:3, min:1,  max:40 },
  lunghezza:   { nome:'Lunghezza',   unita:'cm', emoji:'📏', passo:0.5,   scorciatoie:[-2,-1,1,2],              decimali:1, min:30, max:150 },
  temperatura: { nome:'Temperatura', unita:'°C', emoji:'🌡️', passo:0.1,   scorciatoie:[-0.5,-0.1,0.1,0.5],      decimali:1, min:32, max:43 }
};
export function apriInserimento({ tipo, bambino, iso, id })  // bambino 'Gabriel'|'Vittorio'|'Tutti e due'
export function valorePartenza(tipo, bambino)   // -> l'ultima misura di quel tipo, o il centro dell'intervallo
export function entroLimiti(tipo, valore)       // -> boolean
export function passoSicuro(tipo, valore, delta)// -> il valore nuovo, fermato ai limiti
export function ultimeMisure(quante)            // -> [{bambino, tipo, iso, valore, id}] dalla più recente
export function rigaMisura(m)                   // -> HTML di una riga dell'elenco
```

Al caricamento, `misure.js` chiama `registraInserimento(apriInserimento)` di `app.js`.

- [ ] **Step 1: scrivi `v3/test/misure.test.js`**

```
1. valorePartenza('peso','Gabriel') con pesate nei dati dà l'ultima pesata
2. valorePartenza('peso','Gabriel') senza pesate dà un valore dentro i limiti
3. valorePartenza('peso','Tutti e due') dà l'ultima pesata di Gabriel
4. entroLimiti('temperatura', 31.9) è false; entroLimiti('temperatura', 37.1) è true
5. entroLimiti('peso', 0.5) è false       (il dito tenuto sul meno non porta il peso a zero)
6. passoSicuro('peso', 1.0, -0.05) resta 1.0   (si ferma al minimo, non va sotto)
7. passoSicuro('peso', 8.29, 0.01) vale 8.3 entro 1e-9   (nessun errore di virgola mobile visibile)
8. ultimeMisure(3) mescola i tre tipi e i due bambini in ordine di data
9. rigaMisura() scrive il valore con la virgola e l'unità giusta, e non contiene 'undefined'
```

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs misure`

- [ ] **Step 3: scrivi `v3/misure.js` e `v3/stili/misure.css`**

Markup e stili dal mockup `v3b.html`, frame «3 · Misure»: `.mbtns .mbtn .who-pick .stepper .step-b .val .quick .rowline .save .wrow`. Il valore sta al centro, `−` e `+` larghi ai lati, le scorciatoie sotto. **Niente tastiera.** La data parte da oggi e si cambia con una riga che apre un `<input type="date">`.

Il cambio di bambino, di tipo e di valore aggiorna i nodi già in pagina: `classList.toggle` sui chip e sui pulsanti, `textContent` sul numero. **Mai ridisegnare la tendina a ogni tocco.** Tenere premuto `−` o `+` ripete il passo e accelera dopo mezzo secondo.

Con bambino «Tutti e due», il salvataggio scrive due misure, una per bambino, con lo stesso valore e la stessa data.

Sotto, l'elenco delle ultime misure di ogni tipo. Il tocco su una riga riapre la tendina su quella misura, con «Salva» che la riscrive e «Cancella» che la toglie. La cancellazione chiede conferma una volta sola.

- [ ] **Step 4: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs misure`
Atteso: 9 casi su 9.

- [ ] **Step 5: prova l'inserimento nel browser senza scrivere davvero**

Precauzione: prima di toccare «Salva», spegni le scritture, altrimenti le misure di prova finiscono nel Supabase di famiglia. In console: `(await import('/v3/dati.js')).provaSenzaScritture(true)`.
Run: apri `http://localhost:8765/v3/`, vai su Misure, apri la tendina, cambia il valore, salva.
Atteso: in console la misura che sarebbe stata scritta, con bambino, tipo, valore e data giusti. Nel pannello di rete nessuna `POST` verso `pappa_tracker_data`.

---

## Task 6: sezione Oggi — sagome, barra del tempo, ultime pesate

**Files:**
- Create: `v3/oggi.js`, `v3/stili/oggi.css`
- Test: `v3/test/oggi.test.js`

**Interfaces:**
- Consumes: `app.js` (`registraSezione`, `apriInserimentoMisura`, `BAMBINI`, `COLORE`, `SIGLA`, `dataLunga`, `dataCorta`, `numero`, `isoOggi`, `ABBR`), `dati.js` (`pesate`, `lunghezze`, `onCambio`), `crescita.js` (`TERMINE`, `etaScritta`).
- Produces:

```js
export function sagoma({ colore, colore2, scuro, id })  // -> stringa SVG, la sagoma del mockup
export function sagomaVuota()                            // -> stringa SVG grigia, per quando manca la lunghezza
export function statoAlGiorno(bambino, iso)
  // -> { kg, isoPeso, deltaG, isoPrecedente, cm, isoLunghezza }; i campi che mancano sono null
export function altezzaSagoma(cm, cmMax, altezzaScena)   // -> px, proporzionale alla lunghezza reale
export function riferimentiMesi(isoDa, isoA)             // -> [{frazione, etichetta}] per la barra del tempo
```

- [ ] **Step 1: scrivi `v3/test/oggi.test.js`**

```
1. statoAlGiorno con due pesate: deltaG è la differenza in grammi, isoPrecedente è la data prima
2. statoAlGiorno con una sola pesata: deltaG è null e isoPrecedente è null  (nessuna differenza inventata)
3. statoAlGiorno senza pesate: kg è null
4. statoAlGiorno senza lunghezze: cm è null e isoLunghezza è null  (niente stima dal peso)
5. statoAlGiorno a una data di mezzo: prende l'ultima misura non successiva a quella data
6. altezzaSagoma(70,78,214) sta fra 180 e 200; altezzaSagoma(64,78,214) è più piccola
7. sagoma() e sagomaVuota() non contengono mai 'NaN' né 'undefined'
8. riferimentiMesi('2026-03-19','2026-10-25') dà 8 etichette, da 'mar' a 'ott', con frazioni fra 0 e 1
```

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs oggi`

- [ ] **Step 3: scrivi `v3/oggi.js` e `v3/stili/oggi.css`**

Markup e stili dal mockup `v3b.html`, frame «1 · Oggi»: `.twins .twin .twin-name .dot .stage .fig .cmbox .hline .kgrow .big .delta .when .timebar .track .ticks .wrow`. Copia la funzione `baby()` del mockup per la sagoma.

Senza nessuna lunghezza: al posto della sagoma colorata va `sagomaVuota()` (la stessa sagoma in `var(--hint)` con opacità 0,35), sopra la scritta «manca la lunghezza», e il tocco sulla scena chiama `apriInserimentoMisura({tipo:'lunghezza', bambino})`. **Nessuna altezza stimata dal peso.**

La barra del tempo è un `<input type="range">` con 1000 passi sul tempo reale fra la prima e l'ultima misura, con i nomi dei mesi come riferimento. Durante il trascinamento si aggiornano solo i nodi di testo e la `transform` delle sagome: **niente ricostruzione del markup**. La barra torna sempre su oggi quando la sezione si apre.

- [ ] **Step 4: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs oggi`
Atteso: 8 casi su 8.

- [ ] **Step 5: guarda la sezione nel browser**

Run: apri `http://localhost:8765/v3/`
Atteso: due schede con i pesi veri (Gabriel 8,29 kg, Vittorio 6,45 kg del 25 ottobre), la sagoma grigia con «manca la lunghezza», la barra che muove i numeri. Portando la barra a marzo i pesi scendono a 2,97 e 2,125.

---

## Task 7: sezione Crescita — grafico, bande OMS, percentili, spiegazioni

**Files:**
- Create: `v3/grafico.js`, `v3/crescita-vista.js`, `v3/stili/crescita.css`
- Test: `v3/test/grafico.test.js`

**Interfaces:**
- Consumes: `crescita.js` (tutto), `dati.js` (`pesate`, `lunghezze`, `onCambio`), `app.js` (`registraSezione`, `apriInserimentoMisura`, `BAMBINI`, `COLORE`, `SIGLA`, `numero`).
- Produces:

```js
// v3/grafico.js
export const Z_BANDE = [[-1.881,'P3'],[-1.036,'P15'],[0,'P50'],[1.036,'P85'],[1.881,'P97']];
export function bande(misura, giorniDa, giorniA, passo)  // -> [{z, etichetta, punti:[[giorni,valore]]}]
export function disegnaGrafico({ misura, serie, giorniDa, giorniA })
  // serie: {Gabriel:[{giorni,valore}], Vittorio:[…]} -> stringa SVG completa
export function finestra(periodo, serie)   // periodo '1m'|'3m'|'6m'|'tutto' -> {giorniDa, giorniA}
// v3/crescita-vista.js: solo registraSezione, nessun export
```

L'asse x è in **giorni** di età corretta, con le etichette scritte in mesi. I riempimenti e i tratteggi vengono dal mockup.

- [ ] **Step 1: scrivi `v3/test/grafico.test.js`**

```
1. bande('peso',0,100,1): la banda z=0 al giorno 0 vale M del giorno 0   (la mediana è la mediana)
2. bande(): cinque bande, etichette P3 P15 P50 P85 P97
3. disegnaGrafico con serie vuote: nessun 'NaN' nell'SVG e nessuna linea dei bambini
4. disegnaGrafico con un punto solo: nessuna linea, solo il pallino
5. disegnaGrafico con punti a giorni negativi: quei punti non entrano nel disegno
6. finestra('1m', serie) copre circa 30 giorni; finestra('tutto', serie) copre tutto il registro
7. disegnaGrafico('lunghezza', …) usa i cm: l'asse y arriva oltre 50, non si ferma a 11
```

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs grafico`

- [ ] **Step 3: scrivi `v3/grafico.js`**

SVG a mano come nel mockup: `viewBox` fisso, scala lineare, un `path` per banda e uno per bambino, cerchio bianco bordato sull'ultimo punto, etichette degli assi. Nessuna libreria.

- [ ] **Step 4: scrivi `v3/crescita-vista.js` e `v3/stili/crescita.css`**

Markup e stili dal mockup `v3b.html`, frame «2 · Crescita»: `.agebox .seg .chart .pctbox .explain .src`. Dall'alto: le due età (corretta accesa per prima), l'interruttore Peso/Lunghezza, l'interruttore del periodo, il grafico, i percentili di oggi e di partenza per ogni bambino, le tre spiegazioni, la riga fissa sul pediatra, la riga di attribuzione OMS.

Il percentile si scrive come ordinale; sotto l'1 scrive `<1°`; accanto sta sempre il punteggio z chiamato per nome. Il percentile di partenza è quello della prima misura e si mostra **solo con almeno due misure**. Scegliendo l'età anagrafica, i percentili si ricalcolano sui giorni dalla nascita e sopra il grafico compare la riga «stai guardando l'età anagrafica».

Con meno di due misure di lunghezza, al posto del grafico della lunghezza va l'invito a inserirne una, e il tocco chiama `apriInserimentoMisura({tipo:'lunghezza'})`. Quando `lms()` torna `null`, al posto del percentile va «fuori dalle tabelle OMS» con `MOTIVO_FUORI_TABELLA`.

- [ ] **Step 5: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs grafico`
Atteso: 7 casi su 7.

- [ ] **Step 6: guarda la sezione e controlla i quattro percentili**

Run: apri `http://localhost:8765/v3/`, vai su Crescita.
Atteso: le bande dietro, le due linee davanti, la linea di Vittorio sotto quella di Gabriel. I quattro numeri sono già calcolati dalle tabelle giornaliere dell'OMS sulle pesate vere, e devono comparire **identici**:

| bambino | misura | data | kg | giorni corretti | z | percentile | come si scrive |
|---|---|---|---|---|---|---|---|
| Gabriel | prima | 2026-03-19 | 2,970 | 14 | −1,6054 | 5,420 | `5°` |
| Gabriel | oggi | 2026-10-25 | 8,290 | 234 | −0,2508 | 40,098 | `40°` |
| Vittorio | prima | 2026-03-19 | 2,125 | 14 | −3,7405 | 0,009 | `<1°` |
| Vittorio | oggi | 2026-10-25 | 6,450 | 234 | −2,5194 | 0,588 | `<1°` |

Se uno dei quattro non torna, è l'anti-obiettivo numero uno del progetto: fermati e correggi. Non cambiare l'arrotondamento e non toccare la tabella per far quadrare il numero.

---

## Task 8: sezione Pappe — gradimento della pappa intera

**Files:**
- Create: `v3/pappe.js`, `v3/stili/pappe.css`
- Test: `v3/test/pappe.test.js`

**Interfaces:**
- Consumes: `app.js` (`registraSezione`, `apriTendina`, `chiudiTendina`, `BAMBINI`, `SIGLA`, `isoOggi`), `dati.js` (`pappe`, `scriviGiudizio`, `onCambio`).
- Produces:

```js
export const CATEGORIE = [ {id:'carb',nome:'Carboidrati',emoji:'🍚'}, {id:'prot',nome:'Proteine',emoji:'🐟'},
                           {id:'veg',nome:'Verdure',emoji:'🥦'},      {id:'fat',nome:'Grassi',emoji:'🫒'},
                           {id:'fruit',nome:'Frutta',emoji:'🍎'} ];
export const ALIMENTI = [ /* i 45 della v2, stessi id, nomi ed emoji */ ];
export const GIUDIZI = { good:{e:'👍',l:'Piaciuta'}, ok:{e:'😐',l:'Così così'}, bad:{e:'👎',l:'No'} };
export function alimento(id)          // -> {id,nome,emoji,cat}; per un id sconosciuto {id, nome:id, emoji:'🍽️'}
export function chiavePappa(alimenti) // -> gli id ordinati, uniti da '+'
export function nomePappa(alimenti)   // -> 'Pastina + Zucchina + Grana'
export function elenco()              // -> [{chiave, alimenti, nome, conteggi, punteggio, gruppo}]
export function punteggio(conteggi)   // -> number
export function gruppo(conteggi)      // -> 'gradite'|'rivedere'|'poche'
```

Gli `ALIMENTI` sono i 45 della v2: i `FOOD_PRESETS` più i `FRUIT_PRESETS` con `cat:'fruit'`, copiati da `v2/index.html` righe 476-543 con gli stessi id. I `customFruits` dello storico **non** entrano nel catalogo: sono frasi che descrivono pappe intere, non alimenti. Si risolvono solo in lettura, con `alimento()` che per un id sconosciuto torna un oggetto con l'emoji generica.

`punteggio` conta `good` come `+1`, `ok` come `0`, `bad` come `−1`, diviso il numero dei giudizi. Con meno di due giudizi la pappa va nel gruppo `poche`, non fra le gradite e non fra quelle da rivedere.

- [ ] **Step 1: scrivi `v3/test/pappe.test.js`**

```
1. ALIMENTI ha 45 voci e nessun id doppio
2. alimento('riso').nome è 'Riso'; alimento('30 g di zucchine e patate') torna emoji '🍽️'
3. chiavePappa(['pera','mela']) è uguale a chiavePappa(['mela','pera'])   (l'ordine non conta)
4. elenco(): una pappa con due 'good' sta sopra una con due 'bad'
5. elenco(): una pappa con un solo giudizio sta nel gruppo 'poche'
6. elenco(): una pappa storica con 'items' e una nuova con 'foods' sugli stessi alimenti sono la stessa riga
7. punteggio({good:2,ok:0,bad:0}) è maggiore di punteggio({good:1,ok:0,bad:1})
8. nomePappa(['pastina','zucchina']) è 'Pastina + Zucchina'
9. elenco() conta i giudizi separati per bambino: due 'good' di Gabriel non diventano giudizi di Vittorio
```

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs pappe`

- [ ] **Step 3: scrivi `v3/pappe.js` e `v3/stili/pappe.css`**

Markup e stili dal mockup `.claude/mockup/v3.html`, frame «4 · Pappe»: `.meal .meal .em .meal .nm .meal .st .pill-like .judge .judge .who .faces .face .face.sel .taps`. Tre blocchi: «Le più gradite», «Da rivedere», «Ancora poche prove».

Un tocco sulla riga alza la tendina con due file di faccine, una per bambino. Il tocco su una faccina la accende **sul posto** con `classList.toggle`, scrive il giudizio e, quando tutti e due i bambini hanno risposto, chiude la tendina dopo 240 ms. **Niente ricostruzione della tendina a ogni tocco**: è il difetto già segnalato nella v2.

Il `+` dell'intestazione apre la composizione di una pappa nuova: le icone degli alimenti raggruppate per categoria, il tocco le accende sul posto, e la stessa schermata porta le faccine. Nessuna quantità, nessuna grammatura, nessun orario.

- [ ] **Step 4: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs pappe`
Atteso: 9 casi su 9.

- [ ] **Step 5: guarda la sezione nel browser**

Run: apri `http://localhost:8765/v3/`, vai su Pappe.
Atteso: le pappe dello storico raggruppate per alimenti, con i gradimenti veri. Il tocco su una riga alza la tendina e la faccina si accende senza che la scheda sfarfalli.

---

## Task 9: sezione Vaccini — cronologia, ricerca, seme dai certificati

**Files:**
- Create: `v3/vaccini.js`, `v3/stili/vaccini.css`
- Test: `v3/test/vaccini.test.js`
- `v3/dati/vaccini.json` **è già scritto e già verificato** contro i due PDF dei certificati: cinque sedute, dieci somministrazioni, ogni lotto, ogni data, ogni dose e ogni prodotto confrontati a macchina. Non riscriverlo e non cambiarne un carattere. Leggilo per conoscere i nomi dei campi: `nome`, `prodotto`, `sigla`, `dose`, `lotto`, `tipo` (`vaccino` o `profilassi`), `via` (`iniezione` o `bocca`), `copre`. Il file sta in `.gitignore`: c'è sul computer, non nel repository pubblico. Quindi la sezione deve funzionare **anche senza di lui**: senza vaccini mostra «nessun vaccino ancora» e il `+` per aggiungerli a mano.

**Interfaces:**
- Consumes: `app.js` (`registraSezione`, `apriTendina`, `chiudiTendina`, `dataLunga`, `BAMBINI`), `dati.js` (`vaccini`, `onCambio`), `crescita.js` (`NASCITA`, `TERMINE`, `etaScritta`).
- Produces:

```js
export function cerca(sedute, query)    // -> [{data, bambini, voci}] con solo le voci che corrispondono
export function evidenzia(testo, query) // -> HTML con <mark>; la query va ripulita dai caratteri della regexp
export function contaVoci(sedute)       // -> {sedute, somministrazioni}
export function rigaSeduta(seduta, query) // -> HTML di una seduta intera
```

`v3/dati/vaccini.json` viene dai due certificati ULSS 2 Marca Trevigiana emessi il 26 ottobre 2026. I due bambini hanno **le stesse dieci somministrazioni nelle stesse cinque date**, quindi ogni seduta ha `bambini:['Gabriel','Vittorio']`. Nessun codice fiscale nel file. Contenuto esatto, da non cambiare:

```
aggiornatoAl: '2026-10-26'

2026-02-23  Beyfortus · RSV · lotto (omesso) · tipo 'profilassi'
            copre: virus respiratorio sinciziale
2026-03-03  Esavalente · Hexyon · dose 1 · lotto (omesso) · tipo 'vaccino'
            copre: difterite, tetano, pertosse, poliomielite, epatite B, Haemophilus influenzae b
            Pneumococco · Vaxneuvance PCV15 · dose 1 · lotto (omesso) · copre: pneumococco
2026-04-03  Meningococco B · Bexsero · dose 1 · lotto (omesso) · copre: meningococco B
            Rotavirus · Rotarix RV1 · dose 1 · lotto (omesso) · copre: rotavirus
2026-05-19  Esavalente · Hexyon · dose 2 · lotto (omesso) · copre: le stesse sei
            Pneumococco · Vaxneuvance PCV15 · dose 2 · lotto (omesso) · copre: pneumococco
            Rotavirus · Rotarix RV1 · dose 2 · lotto (omesso) · copre: rotavirus
2026-06-23  Pneumococco · Vaxneuvance PCV15 · dose 3 · lotto (omesso) · copre: pneumococco
            Meningococco B · Bexsero · dose 2 · lotto (omesso) · copre: meningococco B
```

Una iniezione, una voce: l'esavalente è **una** riga con sotto le sei malattie, non sei righe.

- [ ] **Step 1: scrivi `v3/test/vaccini.test.js`**

```
 0. senza vaccini nei dati, la sezione mostra «nessun vaccino ancora» e non va in errore
 1. dati/vaccini.json si legge e ha aggiornatoAl '2026-10-26'  (salta il caso se il file non c'è)
 2. contaVoci(): 5 sedute e 10 somministrazioni
 3. l'esavalente del 3 marzo è una voce sola, con sei malattie in 'copre'
 4. il Beyfortus ha tipo 'profilassi', non 'vaccino'
 5. ogni seduta ha bambini ['Gabriel','Vittorio']
 6. cerca(sedute,'<lotto>') trova una voce sola, quella del 3 marzo
 7. cerca(sedute,'difterite') trova le due voci dell'esavalente
 8. cerca(sedute,'pippo') non trova niente
 9. cerca(sedute,'') torna tutte le cinque sedute
10. evidenzia('Hexyon','hex') contiene '<mark>Hex</mark>'
11. evidenzia('a+b','a+') non manda in errore la regexp
12. etaScritta(TERMINE,'2026-02-23') è 'non ancora al termine'; nessuna data di seduta dà 'Invalid Date'
13. rigaSeduta() non contiene 'undefined'
```

- [ ] **Step 2: lancia il test e verifica che fallisca**

Run: `node v3/test/esegui.mjs vaccini`

- [ ] **Step 3: scrivi `v3/vaccini.js` e `v3/stili/vaccini.css`**

Markup e stili dal mockup `v3b.html`, frame «4 · Vaccini»: `.search .ok-badge .tl-day .tl-rail .tl-pin .tl-line .tl-body .tl-date .tl-age .vax .covers`. In cima lo stato «In regola, tutti e due» con la data di emissione; poi la ricerca; poi la cronologia dalla seduta più recente; in fondo «In programma», vuoto, con la riga che dice di mandare il foglio degli appuntamenti.

Ogni seduta porta l'età anagrafica e l'età corretta. Il `+` dell'intestazione apre una tendina per aggiungere una somministrazione a mano: data, nome, prodotto, dose, lotto, malattie coperte, tipo. Scrive nei dati sincronizzati, non nel file.

- [ ] **Step 4: lancia il test e verifica che passi**

Run: `node v3/test/esegui.mjs vaccini`
Atteso: 13 casi su 13.

- [ ] **Step 5: confronta la schermata con i certificati**

Run: apri `http://localhost:8765/v3/`, vai su Vaccini.
Atteso: cinque sedute, dieci somministrazioni, lotti e date uguali a quelli dei PDF in `C:\Users\pchome\Downloads\cert. vaccini_GABRIEL.pdf` e `cert. vaccini_VITTORIO.pdf`. Controlla a vista ogni lotto e ogni data: un lotto sbagliato qui è un dato sanitario sbagliato.

---

## Task 10: montaggio, prova a 390 px, istruzioni

**Files:**
- Modify: `v3/index.html` (solo i `<script>` e i `<link>` che mancano)
- Create: `v3/README.md`

- [ ] **Step 1: lancia tutti i test**

Run: `node v3/test/esegui.mjs`
Atteso: ogni modulo verde, uscita 0.

- [ ] **Step 2: lancia i test anche nel browser**

Run: apri `http://localhost:8765/v3/test/tutti.test.html`
Atteso: `document.title` è `OK`. Serve perché nel browser `leggiJson` passa da `fetch` e i percorsi sono diversi da quelli di Node.

- [ ] **Step 3: prova le cinque sezioni a 390 px**

Run: apri `http://localhost:8765/v3/` con la finestra a 390×844.
Atteso: nessuno scorrimento orizzontale, nessun errore in console, la barra in basso sempre visibile, il `+` raggiungibile in ogni sezione, nessun pulsante flottante che copre i tocchi.

- [ ] **Step 4: prova la prima apertura a dati vuoti**

Precauzione: svuota solo la chiave della v3, non quella della v2. In console: `localStorage.removeItem('pappatracker_data_v3')`, poi ricarica.
Atteso: l'app si riempie dalla riga `v3` di Supabase. Nel pannello di rete compare `id=eq.v3`; una `POST` su `id=eq.main` non deve comparire mai.

- [ ] **Step 5: scrivi `v3/README.md`**

Dieci righe: cos'è, dove è pubblicata, come si rigenerano le tabelle OMS e l'icona, come si lanciano i test, la licenza delle tabelle, e la riga che dice che la v1 e la v2 non si toccano.

---

## Collegati

- [[dati-nascita-eta-corretta]]
- [[vaccini-fonte-e-aggiunta]]
- [[never-fabricate-or-mutate-feeds]]
- [[safe-write-path-testing]]
- [[no-full-rerender-on-tap]]
- [[legacy-fruit-log-is-free-text]]
