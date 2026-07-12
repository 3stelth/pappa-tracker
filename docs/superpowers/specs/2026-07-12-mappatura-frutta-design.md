# Mappatura frutta (svezzamento)

Data: 2026-07-12
File toccato: `index.html` (app single-file)

## Contesto e problema

I bambini stanno iniziando lo svezzamento alla frutta. Serve un modo per ricordare **quale frutta è stata data, a chi, in che giorno e quante volte**, senza che questo dato influisca in alcun modo su ml, medie o Obiettivi — che restano calcolati solo dai `feeds` (latte).

## Obiettivo

- Registrare per ogni bambino/giorno un **set di frutti con conteggio** (es. banana ×2, pera ×1), senza orario.
- Inserimento rapido: griglia di frutti preimpostati con emoji, tap = +1; possibilità di aggiungere frutti personalizzati (nome + emoji) che restano salvati.
- Visibilità nel **riepilogo giornaliero** (card in cima al giorno) e nel **riepilogo settimanale** (tabella), oltre che nella sezione di inserimento stessa.

Non-obiettivi (YAGNI): nessun orario per frutto, nessuna quantità in grammi, nessun impatto su ml/medie/Obiettivi, nessuna sincronizzazione col conteggio pasti, nessuna dashboard dedicata separata (si integra nelle superfici esistenti).

## Vincolo di sicurezza dati (NON NEGOZIABILE)

Nessun `feed` (poppata) reale va creato, spostato, letto per derivarne conteggi o cancellato dall'implementazione. La frutta è una **struttura dati indipendente**, mai innestata dentro `feeds`. Vive in chiavi di configurazione dedicate di `state.data` (come `goals`/`customTherapies`), escluse dal ciclo sui giorni. Vedi [[never-fabricate-or-mutate-feeds]].

## Modello dati

Tre nuove chiavi in `state.data`, trattate come config (mai iterate come "giorno"):

```js
state.data.fruitLog = {
  "Gabriel":  { "2026-07-12": { banana: 2, pera: 1 } },
  "Vittorio": { "2026-07-12": { banana: 1 } }
}
state.data.customFruits = [ { id, name, emoji } ]   // frutti aggiunti dall'utente, condivisi tra i bambini
state.data.hiddenFruits = [ "kiwi" ]                 // id di preset nascosti (pulizia griglia), condivisi
```

- `fruitLog[baby][dateKey]` è una mappa `fruitId -> count` (interi ≥ 1; a 0 la chiave va rimossa).
- `fruitId` per i preset è uno slug fisso (es. `banana`, `pera`); per i personalizzati è l'`id` generato con `uid()`.
- Un frutto personalizzato non ha valori di default: nome ed emoji sono quelli inseriti dall'utente.

### Preset

Lista fissa in ordine di frequenza d'uso da svezzamento:

```
banana 🍌 · pera 🍐 · mela 🍎 · pesca 🍑 · kiwi 🥝 · uva 🍇 ·
fragola 🍓 · mirtilli 🫐 · arancia 🍊 · melone 🍈 · mango 🥭 · avocado 🥑
```

Un preset nascosto (`hiddenFruits`) non compare nella griglia ma il suo storico in `fruitLog` resta intatto e visibile nei riepiloghi.

## Componenti / modifiche

### A. Card "🍎 Frutta" nel day view, sotto "🍼 Poppate" (`buildDayView`, dopo la sezione feeds)

- Segue `state.baby` (stesso switch flottante usato da Poppate/Pannolini/Terapie).
- **Griglia chip**: emoji + nome, badge col conteggio del giorno se > 0. Tap = +1 per il bambino corrente sul giorno selezionato (`state.selDate`). Toast di conferma come le poppate.
- Chip finale **"＋ Aggiungi frutto"**: apre un mini-modale (nome + selezione emoji da un set ristretto o input libero) → crea voce in `customFruits`.
- Chip finale **"⚙️ Gestisci"**: apre un modale con l'intero catalogo (preset + personalizzati); ogni riga ha un toggle "mostra/nascondi" (preset → `hiddenFruits`) o un'azione "elimina" (solo per i personalizzati, con conferma — lo storico in `fruitLog` resta invariato anche dopo l'eliminazione del frutto dal catalogo).
- Sotto la griglia, riga **"Dati oggi"**: elenco dei frutti con conteggio > 0, ciascuno con stepper `− n +` e ✕ per azzerare/rimuovere la voce dal giorno.
- Nessun vincolo sui giorni passati (a differenza degli Obiettivi): la frutta si può correggere retroattivamente in qualunque giorno, perché è un registro libero, non un piano.

### B. Riepilogo giornaliero (`recap-row` in cima al day view, `index.html:931`)

Nella `recap-card` di ogni bambino, aggiungo una riga (solo se `fruitLog[bn][key]` non è vuoto), subito dopo la riga 💩:

```
🍎 🍌×2 🍐×1
```

Ordine: per conteggio decrescente. Se il giorno non ha frutta, la riga non compare (stesso pattern di ⚖️/🌡️ che mostrano "—" solo dove ha senso — qui invece si omette del tutto per non affollare la card).

### C. Riepilogo settimanale (`buildWeeklySummaryParts`, `index.html:2004`)

- Nuova colonna **🍎** nella tabella (dopo °C): per ogni riga-giorno, le emoji dei frutti dati quel giorno al bambino selezionato, deduplicate e senza conteggio (es. `🍌🍐`) — lo spazio in tabella è stretto, il dettaglio numerico sta altrove.
- Sotto la tabella (dentro la stessa card `.content`, dopo il div `.cal`), una riga-legenda con i **totali della settimana** per quel bambino, ordinata per frequenza decrescente:

```
🍌 Banana 8 · 🍐 Pera 5 · 🍑 Pesca 3
```

- Se la settimana non ha alcun dato di frutta, colonna e legenda non compaiono (nessuna riga vuota).

### D. Funzioni helper

```js
function fruitCatalog() {
  // preset (meno gli hiddenFruits) + customFruits, ciascuno {id, name, emoji}
}
function getFruitLog(bn, key) { return state.data.fruitLog?.[bn]?.[key] || {}; }
function bumpFruit(bn, key, fruitId, delta) {
  // crea state.data.fruitLog/[bn]/[key] se assente; applica delta; clamp >= 0;
  // se il risultato è 0 rimuove la chiave; rimuove oggetti vuoti a cascata; saveData(); render()
}
function addCustomFruit(name, emoji) {
  // crea {id: uid(), name, emoji} in state.data.customFruits; saveData(); render()
}
```

### E. Sync, merge, export (integrazione con l'infrastruttura esistente)

Le tre chiavi vanno aggiunte ai punti che già trattano le config-key come non-giorno:

1. **Guard "non è un giorno"** in `applyTombstones` (`index.html:457`) e `cleanDuplicates` (`index.html:503`): aggiungere `'fruitLog'`, `'customFruits'`, `'hiddenFruits'` alla lista `dateKey === '...'`.
2. **`mergeData`** (`index.html:541`):
   - `customFruits`: union per `id`, locale vince sui duplicati (stesso pattern di `customTherapies`, `index.html:552-557`).
   - `hiddenFruits`: union di insiemi, stesso pattern di `hiddenTherapies` (`index.html:562-565`).
   - `fruitLog`: merge profondo `baby -> dateKey -> fruitId -> count`. Per ogni bambino e ogni giorno presente in locale o remoto, il giorno **locale vince per intero** se presente in entrambi (stesso principio "local wins" già usato per gli array di feed/diaper, `index.html:617`); i giorni assenti in locale vengono presi dal remoto. Questo evita che una correzione fatta da un genitore sparisca per un merge "somma" involontario.
   - Guard day-loop (`index.html:589`): aggiungere le tre chiavi alla lista di esclusione.
3. **Export CSV** (`index.html:806` circa, funzione che costruisce `rows`): aggiungere una riga per ogni frutto registrato nel giorno, per bambino, con colonna tipo `"Frutta"`, frutto e conteggio al posto di ml/tipo pasto.

## UI/stile

Riuso dei componenti esistenti, nessuno stile nuovo da inventare:
- Chip griglia: stesso pattern di `.pill`/chip usati altrove (bordo arrotondato, `--glass-2`, stato "on" con badge).
- Stepper `− n +`: stesso pattern del selettore pasti in Obiettivi.
- Font/colori: variabili CSS esistenti (`--accent`, `--glass`, `--sub`, `--hint`), coerenti con dark/light mode già supportati.

## Testing

Manuale via browser (app single-file, nessun test automatico esistente):
1. Tap su un frutto preset → badge +1, toast, persistenza dopo reload.
2. Stepper − fino a 0 → la voce sparisce da "Dati oggi" e dal riepilogo.
3. Aggiungi frutto personalizzato → compare in griglia per **entrambi** i bambini, persiste al reload.
4. Nascondi un preset → sparisce dalla griglia ma lo storico passato resta visibile nei riepiloghi.
5. Riepilogo giornaliero: riga frutta compare solo se c'è dato, ordinata per conteggio.
6. Riepilogo settimanale: colonna 🍎 popolata per i giorni con dati, legenda totali corretta, nessuna riga/colonna se la settimana è vuota.
7. Verifica che nessuna operazione sopra tocchi `feeds`/ml/Obiettivi (controllo visivo sulle altre schede invariate).
8. Sync multi-dispositivo: modificare frutta su due "client" (localStorage separati) per lo stesso giorno e verificare che il merge non perda dati né sovrascriva silenziosamente l'altro bambino.
