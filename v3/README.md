# Pappa Tracker v3

App di famiglia per due gemelli nati pretermine. Mostra peso, lunghezza, temperatura,
percentili di crescita, gradimento delle pappe e vaccini.

La v1 alla root e la v2 in `/v2/` restano pubblicate e intatte. La v3 vive in `/v3/` e
scrive su una riga Supabase sua, `id='v3'`. La riga `id='main'` della v2 non viene mai
scritta dalla v3.

## Come si apre

Niente compilazione: sono file statici e moduli caricati dal browser. In locale serve un
server, perché i moduli ES non si caricano da `file://`.

```bash
node .claude/serve.js   # poi apri http://localhost:8765/v3/
```

## I percentili

Curve OMS 2006, maschi, **tabelle per giorno di età**, sull'età corretta (giorni dal 5
marzo 2026). Le tabelle mensili con interpolazione sbagliavano fino a 0,197 in punteggio
z, cioè quasi 90 grammi: non si usano.

Le tabelle stanno in `v3/dati/oms-peso-giorni.json` e `v3/dati/oms-lunghezza-giorni.json`.
Si rigenerano dai file dell'OMS:

```bash
python -I v3/strumenti/genera-tabelle.py wfa-boys-day.xlsx lhfa-boys-day.xlsx
```

I due file arrivano da `https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/`,
cartelle `weight-for-age/expanded-tables/` e `length-height-for-age/expandable-tables/`.

## I test

```bash
node v3/test/esegui.mjs            # tutti
node v3/test/esegui.mjs crescita   # solo uno
```

Gli stessi moduli girano anche nel browser, su `v3/test/tutti.test.html`: lì i JSON
passano da `fetch` e i percorsi sono diversi.

Il test più importante ricalcola dalle LMS i valori che l'OMS pubblica nello stesso file:
25.998 confronti, scarto massimo 0,0005, cioè l'arrotondamento alla terza cifra con cui
l'OMS li pubblica. Il controllo si ferma a ±3 deviazioni standard di proposito: oltre,
l'OMS non usa le LMS, estrapola in modo lineare.

## L'icona

```bash
python -I v3/strumenti/genera-icona.py
```

Scrive `icona.svg` per il favicon e i due PNG per la schermata Home del telefono.

## I vaccini

`v3/dati/vaccini.json` è il seme del primo caricamento, preso dai certificati ULSS. Sono
dati sanitari di due minori e questo repository è pubblico, quindi il file sta in
`.gitignore`: resta sul computer e non entra in cronologia. L'app lo legge se lo trova;
altrimenti la sezione Vaccini parte vuota e i vaccini si aggiungono dal telefono, dove
finiscono nei dati sincronizzati.

## Licenza delle tabelle

WHO Child Growth Standards 2006, Organizzazione Mondiale della Sanità, CC BY-NC-SA 3.0
IGO: si copiano e si adattano per usi non commerciali, con attribuzione e con la stessa
licenza. Questa è un'app di famiglia, senza alcun uso commerciale. L'attribuzione compare
in fondo alla schermata Crescita. Il logo dell'OMS non si usa.
