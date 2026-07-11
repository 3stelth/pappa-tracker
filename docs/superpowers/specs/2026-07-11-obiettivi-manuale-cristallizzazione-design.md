# Obiettivi — override manuale della media + cristallizzazione giorni passati

Data: 2026-07-11
File toccato: `index.html` (app single-file)

## Contesto

La scheda **Obiettivi** (`buildGoals`, `index.html:1175`) calcola per ogni bambino:
- una **media giornaliera** dagli ultimi 7 giorni (`avgDailyMl`, `index.html:1122`);
- un **numero di pasti** globale (`getGoalMeals` → `state.data.goals.meals`, `index.html:1140`);
- da questi, la **quantità per pasto** e una **griglia** di slot con orari proiettati.

Tre problemi segnalati dall'utente:

1. La media 7gg non è modificabile: a volte è troppo alta/bassa per il bambino e serve fissarla a mano per la singola giornata.
2. I giorni passati **non si cristallizzano**: `avgDailyMl` calcola sempre "ultimi 7 giorni da oggi" e il numero pasti è globale, quindi guardando un giorno passato i numeri e gli orari cambiano nel tempo / si riscrivono cambiando le impostazioni.
3. Le card dei due bambini si **disallineano** quando una ha il badge "avanzati/di più" (diventa più alta) e l'altra no.

(La richiesta "quando mangiano di più non è specificato quanto" è **già implementata** nel codice — badge `goal-more-badge`, `index.html:1240` — ed è verosimilmente un problema di cache lato dispositivo. Da verificare col numero di versione mostrato in pagina.)

## Obiettivi (cosa deve fare)

1. **Override manuale della media 7gg**, per giorno e per bambino, con indicazione visiva chiara che il valore è stato forzato a mano e possibilità di tornare alla media.
2. **Cristallizzare i giorni passati**: media relativa al giorno visualizzato, numero pasti congelato per giorno, nessuna proiezione di orari sui giorni passati.
3. **Card sempre allineate e della stessa dimensione**, indipendentemente dai badge.

Non-obiettivi (YAGNI): nessuna modifica alla sincronizzazione cloud oltre al minimo necessario per preservare i nuovi campi; nessun override per singolo slot (si agisce sul totale giornaliero, non sul singolo pasto); nessuna modifica alle altre schede.

## Vincolo di sicurezza dati (NON NEGOZIABILE)

L'implementazione **non deve mai** creare, modificare, spostare, sovrascrivere o cancellare pasti (`feeds`) reali. In particolare:

- I nuovi dati stanno **solo** in `state.data.goals` (config), **mai** dentro gli array `feeds` dei giorni.
- Nessun pasto "fittizio" viene generato: gli slot mancanti restano placeholder vuoti a livello di sola UI; diventano pasti reali **solo** quando l'utente li inserisce manualmente (`addPlannedFeed`, invariato).
- La "cristallizzazione" congela esclusivamente numeri di configurazione (media, numero pasti), non tocca i dati registrati.
- Nessuna modifica alla logica di merge/tombstone che possa alterare pasti esistenti.

## Modello dati

I nuovi dati stanno **dentro l'oggetto `goals`** (`state.data.goals`), che è già gestito dal merge cloud come *last-writer-wins* (`index.html:575`). Questo evita di toccare la logica di merge per-giorno (che, `index.html:609`, non preserverebbe campi scalari nuovi messi sull'oggetto bambino-giorno).

```
state.data.goals = {
  meals: <int>,                 // default globale esistente (pasti/giorno per oggi e futuro)
  lastMeal: '22:00',            // esistente
  mealsByDate: {                // NUOVO — numero pasti congelato per data
    'YYYY-MM-DD': <int>
  },
  targetByDate: {               // NUOVO — override manuale della media, per data e bambino
    'YYYY-MM-DD': { Gabriel: <ml>, Vittorio: <ml> }
  }
}
```

Regole:
- `mealsByDate[dateKey]` viene scritto quando: (a) si cambia il selettore su un giorno; (b) si registra un pasto in un giorno che non ha ancora un valore (snapshot del default corrente). Una volta presente, quel giorno è congelato.
- `targetByDate[dateKey][bn]` esiste **solo** se l'utente ha forzato un valore. Assente = si usa la media calcolata.

## Componenti / modifiche

### A. Target giornaliero effettivo (funzioni)

- `avgDailyMl(bn, ref=state.selDate)`: la finestra dei 7 giorni diventa **relativa a `ref`** invece che a `new Date()`. Per oggi il risultato è identico a ora; per un giorno passato dipende solo da dati storici fissi → stabile nel tempo.
- `effectiveTargetMl(bn, dateKey)`: nuova funzione. Ritorna `targetByDate[dateKey]?.[bn]` se presente (override manuale), altrimenti `avgDailyMl(bn, dataDaDateKey)`.
- `isManualTarget(bn, dateKey)`: helper booleano per l'indicazione visiva.
- `getGoalMeals(dateKey=dk(selDate))`: legge `mealsByDate[dateKey]` se presente; altrimenti il default globale `goals.meals` (o il seed calcolato). 
- `setGoalMeals(n)`: scrive sul giorno selezionato (`mealsByDate[dateKey]=n`) e, se il giorno è oggi, aggiorna anche il default globale `goals.meals`.
- `setManualTarget(bn, dateKey, ml)` / `clearManualTarget(bn, dateKey)`: set/rimozione override, poi `saveData()` + `render()`.

Tutti i punti che oggi usano `avgDailyMl(bn)` in `buildGoals` (recap sezione A `index.html:1194`, griglia sezione B `index.html:1224`) passano a `effectiveTargetMl(bn, key)`.

### B. UI override manuale (sezione A recap)

- La riga "Media 7gg **N ml**" diventa tappabile (aggiunta di un'icona ✏️).
- Tap → mini-modale "Obiettivo giornaliero — {bambino}": input numerico pre-riempito col valore corrente, nota "Media 7gg: N ml", pulsanti Annulla / Salva. Se override già presente: pulsante "↺ Torna alla media".
- Stato override attivo: l'etichetta mostra **"✏️ Manuale N ml"** in colore ambra (`var(--amber)`) invece del grigio "Media 7gg"; sotto, link piccolo "↺ torna alla media".

### C. Cristallizzazione giorni passati (griglia sezione B)

Definito `isPast = key < todayK`:
- **Nessuna proiezione oraria** sugli slot non registrati: niente calcolo `anchor/step/lastMeal`, niente `timeHtml`.
- **Nessun evidenziatore "· prossimo"** (`next`).
- Gli slot mancanti restano **liberi con quantità stimata** `≈ X ml` (da `effectiveTargetMl` / pasti rimasti), senza orario. Tap → inserimento del pasto mancante (come oggi).
- **Selettore "Pasti al giorno"**: su giorno passato è **bloccato** (disabilitato/grigio) con un piccolo comando "🔓 Sblocca (emergenza)" che lo riabilita per quella sessione di modifica. Di default resta bloccato per non riscrivere la storia.

Oggi (e futuro) mantengono il comportamento attuale (proiezioni orari, "prossimo", selettore attivo).

### D. Allineamento card (CSS)

- `.goal-slot`: aggiunta di una **`min-height` uniforme** sufficiente a contenere il badge "avanzati/di più", con layout a colonna centrato. Così ogni casella ha la stessa altezza a prescindere dal badge, e le due colonne (Gabriel/Vittorio) restano in riga.
- Verifica che badge (`.goal-left-badge`, `.goal-more-badge`) non spingano oltre la `min-height` (lo spazio è già riservato).

## Flusso dati / edge cases

- **Giorni legacy senza `mealsByDate`**: usano il default globale al momento della visualizzazione (non ricostruibili); si congelano appena si interagisce.
- **Merge cloud**: i nuovi campi vivono in `goals` (last-writer-wins), coerente con `meals`/`lastMeal` esistenti. Limite noto e accettato: modifiche concorrenti a `goals` da due dispositivi possono sovrascriversi (come già oggi). I pasti registrati continuano a fare merge per-voce, invariato.
- **Override con media = 0** (nessuno storico): l'override manuale funziona comunque (imposta un target dove prima non c'era); il ramo "imposta media" si applica solo se non c'è né media né override.
- **Cambio pasti su oggi**: aggiorna sia il giorno sia il default; i giorni futuri erediteranno il nuovo default finché non congelati.

## Testing (manuale, via anteprima locale)

1. Override: su oggi imposto media manuale per Gabriel → etichetta ambra "✏️ Manuale", ml/pasto e slot ricalcolati; "torna alla media" ripristina.
2. Persistenza override: ricarico la pagina → override ancora presente; cambio giorno e torno → invariato.
3. Cristallizzazione media: guardo un giorno passato con storico → numeri stabili; (concettuale) non dipendono più da "oggi".
4. Pasti congelati: cambio "Pasti al giorno" su oggi → i giorni passati non cambiano; selettore bloccato sul giorno passato, "🔓 Sblocca" lo riabilita.
5. Slot passati: giorno passato con pasti mancanti → slot liberi con "≈ ml", senza orario, niente "prossimo"; tap inserisce.
6. Allineamento: giorno con "avanzati" su un solo bambino → le due colonne restano allineate e le caselle stessa altezza.
7. Regressione: oggi conserva proiezioni orari, "prossimo", badge "di più".
