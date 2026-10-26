# Pappa Tracker v3

Data: 2026-10-26
Cartella nuova: `/v3/` — la v1 alla root e la v2 in `/v2/` restano pubblicate e intatte.

## Contesto e problema

La v1 e la v2 sono nate per il latte: poppate, millilitri, pannolini, terapie. Quella fase è finita. Oggi la famiglia apre l'app per **un dato solo: il peso**. La sezione del cibo è abbandonata.

I bambini sono due gemelli prematuri. Il peso non si guarda come numero isolato: si guarda per capire se la crescita va. Serve quindi anche **la lunghezza**, e serve il confronto con le curve di crescita. L'app oggi non ha né la lunghezza né le curve.

In più ci sono due informazioni che la famiglia tiene fuori dall'app e vorrebbe dentro: le **misurazioni** varie (temperatura compresa) e i **vaccini**.

## Obiettivo

Un'app nuova che risponde a quattro domande, in quest'ordine di importanza:

1. Quanto pesano oggi, e come è andata nelle ultime settimane?
2. Quanto sono lunghi, e quando li abbiamo misurati l'ultima volta?
3. Come stanno rispetto alle curve di crescita, tenendo conto della prematurità?
4. Che vaccini hanno fatto?

Più una domanda di servizio: quali pappe piacciono.

### Non obiettivi

- Niente millilitri, niente orari delle poppate, niente grammature.
- Niente conteggio dei pannolini.
- Niente terapie e niente obiettivi giornalieri.
- Niente registro della frutta (resta solo leggibile nei dati vecchi).
- Niente notifiche e niente promemoria.
- **Niente avvisi sulla temperatura.** La temperatura si segna e si rilegge. Nessuna soglia, nessun allarme febbre: non è stato chiesto.
- Niente esportazione in CSV finché non viene chiesta.

### Anti-obiettivi

Cose che renderebbero la v3 un fallimento anche se funzionasse:

- **Mostrare un percentile sbagliato.** È il rischio più grave del progetto. Un numero errato su un bambino prematuro fa danno reale a chi legge.
- **Far sembrare un giudizio quello che è una misura.** Niente rosso, niente "sotto la norma", niente faccine di allarme sulla crescita.
- **Perdere o alterare i dati storici.** 101 pesate, 172 giorni di registro.
- **Rendere l'inserimento lento.** Se segnare una pappa gradita costa più di tre secondi, non lo farà nessuno.

## Vincoli

- **Pubblicazione**: GitHub Pages, cartella `/v3/`. Nessuna compilazione, nessun passo di build.
- **Dati**: Supabase, tabella `pappa_tracker_data`, chiave pubblicabile già nel codice.
- **Dispositivo**: telefono, larghezza 480 px al massimo. Due genitori, due telefoni, stessi dati.
- **Lingua**: italiano.
- **Offline**: l'app deve aprirsi e mostrare i dati anche senza rete, come già fa la v2 (localStorage più sincronizzazione).

## I dati

### Riga nuova, copia integrale

La v3 scrive su una **riga Supabase nuova**, `id = 'v3'`, nella stessa tabella. La riga `id = 'main'` della v2 **non viene mai scritta dalla v3**.

Alla prima apertura la v3 copia nella riga nuova **l'intero contenuto** della riga vecchia, non solo i campi che le servono. Motivo: la riga vecchia resta come copia di sicurezza, e la v3 non perde niente che un domani possa servire.

Conseguenza accettata: quello che viene scritto nella v2 dopo il passaggio non arriva nella v3. La famiglia passa alla v3 e smette di usare la v2.

### Forma dei dati

Si tiene la forma della v2, perché i dati storici sono già così:

```
data[AAAA-MM-GG][bambino] = {
  weight:  { kg, time, note, addedAt },     // già esistente
  length:  { cm, time, note, addedAt },     // NUOVO
  temperatures: [ { temp, time, note, id } ],
  meals:   [ { foods: [id], liking, id } ]  // senza orario e senza quantità
}
```

`length` ha la stessa forma di `weight`: un oggetto per bambino per giorno. La fusione dei dati fra dispositivi lo tratta come `weight` (vince quello con `addedAt` più recente).

I vaccini **non** stanno sotto una data: sono un elenco a sé, in una chiave di configurazione come `goals`, esclusa dal ciclo sui giorni:

```
data.vaccini = {
  aggiornatoAl: 'AAAA-MM-GG',        // data di emissione del certificato
  sedute: [ { data, bambini: [], voci: [ { nome, prodotto, dose, lotto, copre: [], tipo } ] } ]
}
```

`tipo` vale `vaccino` oppure `profilassi`.

I vaccini stanno **nei dati sincronizzati, non in un file del repository**. Motivo: dopo una visita il genitore deve poterne aggiungere uno dal telefono, e l'altro genitore lo deve vedere. Il file `v3/dati/vaccini.json` serve solo come **seme del primo caricamento**: contiene i dati estratti dai due certificati e viene copiato nei dati una volta sola.

### Scelte minori, decise qui

Non erano nella conversazione. Le decide il progetto, non chi costruisce:

- **Chiave di localStorage diversa dalla v2.** Se la v3 usasse la stessa chiave, aprire le due app sullo stesso telefono mescolerebbe i dati.
- **La copia iniziale avviene una volta sola**, e solo se la riga `v3` non esiste ancora. Se esiste, la v3 la usa e non copia niente. Due telefoni che aprono la v3 per la prima volta nello stesso momento non devono creare due copie diverse: vince la prima scrittura, la seconda rilegge.
- **Schermata Oggi senza lunghezze**: finché non c'è nessuna misura di lunghezza, al posto della sagoma compare una figura grigia con scritto "manca la lunghezza" e un tocco apre l'inserimento. Niente sagoma falsa e niente altezza stimata dal peso.
- **Il pulsante +** sta nell'intestazione, non come pulsante flottante. Nella v2 il menu flottante copriva l'area dei tocchi e intercettava i tap: un difetto già segnalato.

## Le cinque sezioni

### 1. Oggi

Le due sagome affiancate, una per bambino, nel colore del bambino (Gabriel blu `#3B82F6`, Vittorio verde acqua `#14B8A6`).

- La **figura è alta in proporzione alla lunghezza reale**. I due si confrontano a occhio.
- Sopra la figura: la lunghezza in centimetri **con la data della misura**.
- Sotto: il peso grande, la differenza rispetto alla pesata prima, e la data della pesata.
- Peso e lunghezza hanno **date separate e visibili**: si misurano in momenti diversi.
- Sotto le due schede, una **barra del tempo** da trascinare. Mentre si trascina, le figure cambiano altezza e i numeri cambiano insieme, 1:1 col dito. La barra ha i **nomi dei mesi** come riferimento e scorre sul tempo reale, non sul numero di misure.
- In fondo, le ultime pesate in elenco.

### 2. Crescita

Il grafico del peso e quello della lunghezza, con dietro le bande dei percentili.

- Interruttore **età corretta / età anagrafica**, con l'età corretta attiva per prima.
- Il grafico della lunghezza oggi è vuoto: non c'è nessuna misura nel database. Finché ci sono meno di due misure, al posto del grafico compare l'invito a inserirne una.
- Periodo selezionabile: 1 mese, 3 mesi, 6 mesi, tutto.
- Sotto il grafico, il percentile di oggi per ogni bambino, con quello di partenza accanto.
- Sotto ancora, la spiegazione in parole semplici (vedi più avanti).

### 3. Misure

Dove si legge e si scrive. Il pulsante **+** sta in alto a destra su tutte le schermate e apre la stessa tendina.

1. Scegli il bambino: Gabriel, Vittorio, Tutti e due.
2. Scegli cosa: Peso, Lunghezza, Temperatura.
3. Il valore è grande al centro, con **−** e **+** larghi ai lati e le scorciatoie (−50 g, −10 g, +10 g, +50 g per il peso). Niente tastiera.
4. La data è già su oggi.
5. Salva.

Sotto, l'elenco delle ultime misure di ogni tipo, modificabili e cancellabili.

### 4. Pappe

Il gradimento, e basta. Nessun orario, nessuna quantità, nessuna grammatura.

- L'elenco delle pappe già fatte, le più gradite in cima, quelle da rivedere sotto.
- Si tocca la riga, si alza una tendina con una fila di tre faccine (👍 😐 👎) **per ogni bambino**, si tocca e si chiude da sé. Due tocchi per un bambino, tre per tutti e due.
- Una pappa nuova si compone toccando le icone degli alimenti, raggruppate per categoria, e si giudica nella stessa schermata.
- Gli alimenti sono i 45 già presenti nella v2 (`FOOD_PRESETS`), con le stesse icone e gli stessi identificativi.
- Il giudizio si dà **sulla pappa intera**, non sul singolo alimento. È la regola già stabilita nella v2 e i dati storici sono così.

### 5. Vaccini

- In cima, lo stato ("In regola") e la **data di emissione del certificato**, perché si sappia a quando è aggiornato.
- Un campo di **ricerca**: cerca per vaccino, malattia o numero di lotto, ed evidenzia le parole trovate.
- Sotto, la cronologia per data. Ogni data è una seduta, con dentro le somministrazioni di quel giorno.
- **Si raggruppa per iniezione, non per malattia.** Il certificato elenca l'esavalente sei volte, una per malattia. Nell'app è una riga sola con sotto le sei malattie che copre.
- Il Beyfortus è segnato come **profilassi**, non come vaccino: è un anticorpo monoclonale.
- Una sezione "In programma", vuota finché non arrivano gli appuntamenti.

## I percentili

Questa è la parte critica del progetto. Vale l'anti-obiettivo: un numero sbagliato qui fa danno.

### I dati di nascita

- Nascita: **8 dicembre 2025**, a **27 settimane + 4 giorni**. Due maschi.
- Prematurità: 280 − 193 = **87 giorni**.
- Data del termine: **5 marzo 2026**.
- Età corretta = data della misura − 5 marzo 2026.
- Prima misura nel database: 19 marzo 2026, cioè **14 giorni di età corretta** e 42+0 settimane di età post-mestruale.

### Quale curva

**Solo le curve OMS 2006, maschi, sull'età corretta.**

Attenzione a non motivarlo male. Le curve Fenton **non** finiscono al termine: arrivano a **50 settimane di età post-mestruale**, che per questi bambini cadono il **14 maggio 2026**. Le misure dal 19 marzo al 14 maggio 2026 stanno quindi dentro l'intervallo di Fenton. La scelta di non usarle non nasce dal loro intervallo.

Nasce da due ragioni:

1. **Continuità.** Le misure vanno dal 19 marzo 2026 a oggi e proseguiranno per anni. Cambiare curva a metà grafico creerebbe uno scalino nelle bande, in un punto che non corrisponde a niente di reale per chi guarda.
2. **Applicabilità.** Dal termine in poi lo standard OMS descrive la crescita attesa, e l'età corretta è il modo previsto per confrontarci un nato pretermine.

Le misure coperte da Fenton sono le prime otto settimane di registro su trentadue mesi previsti. Il guadagno non vale lo scalino.

Se un domani arrivassero misure **precedenti al 5 marzo 2026** (dalla cartella dell'ospedale), questa decisione va riaperta: lì Fenton è l'unico riferimento possibile, perché le curve OMS non esistono prima del termine.

### La fonte

WHO Child Growth Standards 2006, **tabelle estese per giorno di età**, maschi:

- peso per età, 0-1856 giorni (`wfa-boys-zscore-expanded-tables.xlsx`);
- lunghezza per età, 0-1856 giorni (`lhfa-boys-zscore-expanded-tables.xlsx`).

Scaricate dal sito OMS:
`https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/expanded-tables/`
`https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/expandable-tables/`

Ogni riga contiene il giorno, L, M, S e i valori da −4 a +4 deviazioni standard. Le unità sono **kg** per il peso e **cm** per la lunghezza, le stesse del database.

**Tabelle per giorno, non per mese.** La prima stesura di questo documento usava le tabelle mensili con interpolazione lineare dei parametri fra i mesi interi. Misurato sulle 101 pesate reali, quel metodo sbaglia **fino a 0,197 in punteggio z, cioè quasi 90 grammi**. Sul primo peso di Gabriel dava percentile 3,6 invece di 5,4. Per un'app il cui anti-obiettivo è mostrare un percentile sbagliato, è uno scarto inaccettabile e del tutto evitabile: le tabelle giornaliere non richiedono nessuna interpolazione.

### Il calcolo

**L'età si tiene in giorni**, mai in mesi: giorni interi dalla data del termine (5 marzo 2026). I mesi servono solo a scrivere l'età sullo schermo, e lì la conversione è quella dell'OMS, 1 mese = 30,4375 giorni.

I parametri L, M, S si leggono alla riga del giorno. Nessuna interpolazione.

```
z = ((X/M)^L − 1) / (L·S)      se L ≠ 0
z = ln(X/M) / S                 se L ≈ 0
```

Percentile: `Φ(z)·100`, dove Φ è la funzione di ripartizione normale.
Valore atteso a un dato z: `X = M·(1 + L·S·z)^(1/L)`.

**Il punteggio z non si tronca mai.** L'OMS tronca a ±3 solo in alcuni indicatori ponderali, non in peso per età né in lunghezza per età. Un eventuale segnale di valore anomalo resta separato dal numero calcolato.

### La verifica (passo automatico, non a occhio)

Un test ricalcola dalle LMS i valori già pubblicati nello stesso file OMS, per **tutti i 1857 giorni**, per tutte e due le misure, da −3 a +3 deviazioni standard. Tolleranza 0,001.

**Esito: 25.998 confronti su 25.998, scarto massimo 0,0005** — esattamente l'arrotondamento alla terza cifra con cui l'OMS pubblica i valori.

Il controllo si ferma a ±3 di proposito. Oltre quella soglia l'OMS **non** usa le LMS: estrapola in modo lineare. Le colonne a ±4 infatti non tornano (scarto fino a 0,05), e non è un errore del file. Il test lo documenta invece di nasconderlo.

Il test gira a ogni modifica. Se un valore non torna, fallisce e l'app non si pubblica.

Secondo controllo: l'implementazione nel browser e un'implementazione di riferimento separata devono dare lo stesso z entro 0,01.

### La licenza

Le tabelle OMS sono materiale dell'Organizzazione Mondiale della Sanità, rilasciato con licenza **CC BY-NC-SA 3.0 IGO**: si possono copiare e adattare per usi **non commerciali**, con attribuzione, mantenendo la stessa licenza.

L'app è un'app di famiglia, senza alcun uso commerciale. Nella schermata Crescita compare in fondo la riga di attribuzione:

> Curve: WHO Child Growth Standards 2006, Organizzazione Mondiale della Sanità. CC BY-NC-SA 3.0 IGO.

Il logo dell'OMS non si usa. Se un domani l'app diventasse pubblica o commerciale, questa scelta va riaperta.

### Come si mostra

- **L'età corretta viene per prima**, sempre scritta per esteso, con accanto l'età anagrafica.
- **Nessun rosso, nessuna parola di giudizio.** Bande neutre, la linea del bambino nel suo colore.
- Sotto il grafico, per ogni bambino: il percentile di oggi e quello di partenza.
- Sotto il primo percentile si scrive **«<1°»**, non un numero con i decimali: sarebbe una precisione finta. Accanto si mostra il **punteggio z**, chiamato per nome, perché nella coda bassa è l'unico numero che mostra il movimento.
- Tre spiegazioni in parole semplici: cosa sono le bande, perché conta l'età corretta, cosa guardare (la direzione della linea, non il punto).
- Una riga fissa: il percentile e lo z sono descrizioni statistiche, da leggere insieme al pediatra. Non sono un voto e non sono una diagnosi.

### Limiti noti e casi da gestire

- Le tabelle coprono **0-1856 giorni di età corretta**, cioè fino a circa 5 anni. Il limite non si raggiunge prima del 2031.
- **Età corretta negativa** (misura precedente al 5 marzo 2026): le tabelle OMS non la coprono. L'app non calcola e non estrapola: mostra la misura senza percentile e spiega perché.
- I **24 mesi di età corretta** cadono il **4 marzo 2028** (730,5 giorni dal termine, arrotondati al giorno). È la data da cui, in pediatria, di solito si smette di correggere l'età: da verificare col pediatra, l'app non la applica da sola.
- Non c'è la circonferenza cranica. Si aggiunge con lo stesso metodo se serve.

## Stile

Stile Apple, preso dalle skill di `emilkowalski/skills`, lette dal repo senza installarle: `apple-design`, `animate`, `emil-design-eng`.

Le regole che vincolano il codice:

- **Il tocco risponde in giù, non al rilascio.** Il bersaglio reagisce su `pointerdown`.
- **Trascinamento 1:1 col dito**, con `setPointerCapture`.
- **Ogni animazione si può interrompere e invertire a metà.** Si parte dal valore attuale sullo schermo, non da quello finale. Per i gesti si usano le molle, non le transizioni CSS.
- **Mai ricostruire tutta la schermata a ogni tocco.** Le faccine e i chip si aggiornano sul posto. Ricostruire fa sfarfallare la scheda ed è un difetto già segnalato nella v2.

Si tiene l'identità visiva della v2: vetro smerigliato, sfondo chiaro, i due colori dei bambini.

## File

A differenza della v1 e della v2, che sono un file HTML solo da 3000 righe, la v3 si divide:

```
v3/index.html     struttura e stili
v3/app.js         logica
v3/crescita.js    LMS, percentili, grafico
v3/dati/oms-peso-giorni.json      tabelle OMS peso, per giorno
v3/dati/oms-lunghezza-giorni.json tabelle OMS lunghezza, per giorno
v3/dati/vaccini.json       vaccini dai certificati
v3/test/percentili.test.html   il test di verifica
```

Nessuna compilazione: sono moduli caricati dal browser.

## Cosa resta al builder

- Come si disegna il grafico (SVG a mano o una libreria piccola). Vincolo: nessuna compilazione e nessuna dipendenza che vada scaricata a ogni apertura.
- La forma esatta della sagoma. Vincolo: l'altezza deve essere proporzionale alla lunghezza misurata.
- Come si scelgono le pappe più gradite quando i giudizi sono pochi.
- Il comportamento della tendina quando la si riafferra a metà corsa.
- Il modo di modificare e cancellare una misura già inserita.

## Collegati

- [[dati-nascita-eta-corretta]]
- [[vaccini-fonte-e-aggiunta]]
- [[never-fabricate-or-mutate-feeds]]
- [[v2-product-rules]]
- [[no-full-rerender-on-tap]]
