// Test del livello dei dati della v3.
//
// Nessun caso usa la rete e nessuno usa il localStorage vero. Ogni caso costruisce i
// suoi oggetti, mette `stato.data` a mano e chiama la funzione. I casi di avvia()
// ricevono una fetch finta come parametro.
//
// I valori dei pesi sono inventati: il registro vero non entra nei test.

import { uguale, uguali, vero } from './aiuto.js';
import {
  stato,
  RIGA,
  isGiorno,
  fondi,
  pesate,
  temperature,
  pappe,
  scriviMisura,
  cancellaMisura,
  provaSenzaScritture,
  avvia,
} from '../dati.js';

export const nome = 'dati';

// ─── aiuti locali ───

/** Mette `stato.data` a un contenuto noto, senza passare dal localStorage. */
function metti(dati) {
  stato.data = dati ? JSON.parse(JSON.stringify(dati)) : {};
  stato.sync = 'fermo';
  return stato.data;
}

/**
 * Lancia `f` con la rete e il deposito sostituiti da finti, e la console zitta.
 * `f` riceve un oggetto con `fetchChiamato()` e `tocchiDeposito()`.
 * Aspetta `f` prima di rimettere i veri: così nemmeno un caso asincrono può
 * arrivare alla rete vera.
 */
async function senzaMondo(f) {
  const vecchioFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const vecchioDeposito = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const vecchiaConsole = { log: console.log, warn: console.warn, error: console.error };
  let fetchChiamato = false;
  let tocchi = 0;
  const deposito = {
    getItem: () => { tocchi += 1; return null; },
    setItem: () => { tocchi += 1; },
    removeItem: () => { tocchi += 1; },
  };
  Object.defineProperty(globalThis, 'fetch', {
    value: () => { fetchChiamato = true; throw new Error('i test non usano la rete'); },
    configurable: true, writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: deposito, configurable: true, writable: true,
  });
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try {
    return await f({ fetchChiamato: () => fetchChiamato, tocchiDeposito: () => tocchi });
  } finally {
    console.log = vecchiaConsole.log;
    console.warn = vecchiaConsole.warn;
    console.error = vecchiaConsole.error;
    if (vecchioFetch) Object.defineProperty(globalThis, 'fetch', vecchioFetch);
    else delete globalThis.fetch;
    if (vecchioDeposito) Object.defineProperty(globalThis, 'localStorage', vecchioDeposito);
    else delete globalThis.localStorage;
  }
}

/**
 * Costruisce una fetch finta. `risposta(url)` torna le righe da dare, oppure null
 * per far fallire la richiesta, oppure il numero di uno stato HTTP di errore.
 */
function finta(risposta) {
  const chiamate = [];
  const f = async (url, opzioni = {}) => {
    const metodo = String(opzioni.method || 'GET').toUpperCase();
    let corpo = null;
    try { corpo = opzioni.body ? JSON.parse(opzioni.body) : null; } catch { corpo = opzioni.body; }
    chiamate.push({ url: String(url), metodo, corpo });
    const r = risposta(String(url), metodo);
    if (r === null) throw new TypeError('rete non raggiungibile');
    if (typeof r === 'number') return { ok: false, status: r, json: async () => [] };
    return { ok: true, status: 200, json: async () => r };
  };
  f.chiamate = chiamate;
  f.post = () => chiamate.filter((c) => c.metodo === 'POST');
  return f;
}

/** Vera se una delle chiamate è una POST che punta alla riga 'main'. */
function haScrittoMain(f) {
  return f.post().some((c) => c.url.includes('id=eq.main') || (c.corpo && c.corpo.id === 'main'));
}

const SENZA_SEME = { leggiSeme: null };

// ─── casi ───

export const casi = [
  {
    nome: 'fondi: il peso con addedAt più recente vince',
    prova: () => {
      const mio = { '2026-06-01': { Gabriel: { weight: { kg: 1.111, addedAt: 100 } } } };
      const altrui = { '2026-06-01': { Gabriel: { weight: { kg: 2.222, addedAt: 200 } } } };
      uguale(fondi(mio, altrui)['2026-06-01'].Gabriel.weight.kg, 2.222, 'vince il più recente');
      uguale(fondi(altrui, mio)['2026-06-01'].Gabriel.weight.kg, 2.222, 'vince anche al contrario');
      const senzaData = { '2026-06-01': { Gabriel: { weight: { kg: 3.333 } } } };
      uguale(fondi(senzaData, mio)['2026-06-01'].Gabriel.weight.kg, 1.111, 'addedAt mancante vale 0');
    },
  },
  {
    nome: 'fondi: un giorno presente solo da una parte resta',
    prova: () => {
      const mio = { '2026-06-01': { Gabriel: { weight: { kg: 1.111, addedAt: 1 } } } };
      const altrui = { '2026-07-02': { Vittorio: { feeds: [{ id: 'f1', ml: 120 }] } } };
      const f = fondi(mio, altrui);
      uguale(f['2026-06-01'].Gabriel.weight.kg, 1.111, 'il giorno mio resta');
      uguale(f['2026-07-02'].Vittorio.feeds.length, 1, 'il giorno altrui resta, feeds compresi');
    },
  },
  {
    nome: 'fondi: temperature con id diversi si uniscono; lo stesso id non si duplica',
    prova: () => {
      const mio = {
        '2026-06-01': { Gabriel: { temperatures: [
          { id: 'a', temp: 36.8, time: '08:00' },
          { id: 'b', temp: 37.1, time: '12:00' },
        ] } },
      };
      const altrui = {
        '2026-06-01': { Gabriel: { temperatures: [
          { id: 'b', temp: 39.9, time: '12:00' },
          { id: 'c', temp: 36.5, time: '20:00' },
        ] } },
      };
      const lista = fondi(mio, altrui)['2026-06-01'].Gabriel.temperatures;
      uguale(lista.length, 3, 'tre voci, una per id');
      uguale(lista.filter((t) => t.id === 'b').length, 1, "l'id 'b' sta una volta sola");
      uguale(lista.find((t) => t.id === 'b').temp, 37.1, "a id uguale vince il mio");
    },
  },
  {
    nome: 'fondi: una tombstone toglie la temperatura con quel id da tutte e due le parti',
    prova: () => {
      const mio = {
        '2026-06-01': { Gabriel: { temperatures: [{ id: 'a', temp: 36.8 }, { id: 'b', temp: 37.1 }] } },
        _tombstones: [{ kind: 'temperatures', dateKey: '2026-06-01', baby: 'Gabriel', id: 'b', deletedAt: 500 }],
      };
      const altrui = {
        '2026-06-01': { Gabriel: { temperatures: [{ id: 'b', temp: 37.1 }, { id: 'c', temp: 36.5 }] } },
      };
      const f = fondi(mio, altrui);
      const lista = f['2026-06-01'].Gabriel.temperatures;
      uguale(lista.length, 2, 'resta tutto fuori che la voce cancellata');
      vero(!lista.some((t) => t.id === 'b'), "la voce 'b' non c'è più");
      uguale(f._tombstones.length, 1, 'la tombstone resta nei dati fusi');
    },
  },
  {
    nome: "fondi: 'goals' presente solo nell'altra parte resta",
    prova: () => {
      const f = fondi({ '2026-06-01': {} }, { goals: { pappe: 3 } });
      uguale(f.goals.pappe, 3, 'la chiave di configurazione resta');
      const g = fondi({ goals: { pappe: 4 } }, { goals: { pappe: 3 } });
      uguale(g.goals.pappe, 4, 'se sta in tutti e due vince il mio');
    },
  },
  {
    nome: "fondi: 'vaccini' con modificatoAt più recente vince",
    prova: () => {
      const mio = { vaccini: { aggiornatoAl: '2026-10-26', sedute: [], modificatoAt: 10 } };
      const altrui = { vaccini: { aggiornatoAl: '2026-11-30', sedute: [1], modificatoAt: 20 } };
      uguale(fondi(mio, altrui).vaccini.aggiornatoAl, '2026-11-30', "vince il modificatoAt più grande");
      uguale(fondi(altrui, mio).vaccini.aggiornatoAl, '2026-11-30', 'anche al contrario');
      uguale(fondi({}, mio).vaccini.aggiornatoAl, '2026-10-26', 'se sta in uno solo resta');
    },
  },
  {
    nome: 'fondi: non modifica gli oggetti che riceve',
    prova: () => {
      const mio = {
        '2026-06-01': { Gabriel: { weight: { kg: 1.111, addedAt: 1 }, temperatures: [{ id: 'a', temp: 36.8 }] } },
        _tombstones: [{ kind: 'temperatures', dateKey: '2026-06-01', baby: 'Gabriel', id: 'z', deletedAt: 9 }],
      };
      const altrui = { '2026-06-01': { Gabriel: { temperatures: [{ id: 'z', temp: 40 }] } }, goals: { pappe: 1 } };
      const primaMio = JSON.stringify(mio);
      const primaAltrui = JSON.stringify(altrui);
      const f = fondi(mio, altrui);
      f['2026-06-01'].Gabriel.weight.kg = 99;
      uguale(JSON.stringify(mio), primaMio, 'mio è intatto');
      uguale(JSON.stringify(altrui), primaAltrui, 'altrui è intatto');
    },
  },
  {
    nome: 'isGiorno riconosce solo le date',
    prova: () => {
      uguale(isGiorno('2026-03-19'), true, 'una data è un giorno');
      uguale(isGiorno('goals'), false, 'goals non è un giorno');
      uguale(isGiorno('_tombstones'), false, '_tombstones non è un giorno');
      uguale(isGiorno('vaccini'), false, 'vaccini non è un giorno');
      uguale(isGiorno('2026-13-40'), false, 'un mese inesistente non è un giorno');
    },
  },
  {
    nome: "temperature(): legge anche 'temperature' al singolare, e non riscrive lo storico",
    prova: () => {
      metti({
        '2026-04-01': { Gabriel: { temperature: { temp: 37.2, time: '06:00', note: '', id: 't1' } } },
        '2026-04-03': { Gabriel: { temperatures: [{ temp: 36.9, time: '07:00', note: '', id: 't2' }] } },
      });
      const lista = temperature('Gabriel');
      uguale(lista.length, 2, 'due temperature lette');
      uguale(lista[0].iso, '2026-04-03', 'la più recente per prima');
      uguale(lista[1].temp, 37.2, 'la forma vecchia si legge');
      uguale(lista[1].ora, '06:00', "l'orario si chiama ora");
      vero(stato.data['2026-04-01'].Gabriel.temperature !== undefined, 'la forma vecchia resta sul posto');
      vero(stato.data['2026-04-01'].Gabriel.temperatures === undefined, 'nessuna lista nuova scritta nello storico');
    },
  },
  {
    nome: "pappe(): una pappa con 'items' e una con 'foods' danno gli stessi alimenti",
    prova: () => {
      metti({
        '2026-08-28': { Gabriel: { meals: [{ id: 'm1', time: '17:00', liking: 'good', items: [
          { cat: 'prot', qty: 25, unit: 'g', foods: ['yogurt'] },
          { cat: 'fruit', qty: 40, unit: 'g', foods: ['mela', 'pera'] },
        ] }] } },
        '2026-09-28': { Gabriel: { meals: [{ id: 'm2', liking: 'good', foods: ['yogurt', 'mela', 'pera'] }] } },
      });
      const lista = pappe();
      uguale(lista.length, 2, 'due pappe');
      uguali(lista[0].alimenti, ['yogurt', 'mela', 'pera'], "la forma con items dà gli alimenti");
      uguali(lista[1].alimenti, ['yogurt', 'mela', 'pera'], "la forma con foods dà gli stessi alimenti");
      uguale(lista[0].bambino, 'Gabriel', 'il bambino arriva dalla chiave del giorno');
    },
  },
  {
    nome: "pappe(): 'all' si legge 'good', 'half' si legge 'ok', 'little' si legge 'bad'",
    prova: () => {
      metti({
        '2026-07-01': { Gabriel: { meals: [
          { id: 'm1', foods: ['riso'], liking: 'all' },
          { id: 'm2', foods: ['pera'], liking: 'half' },
          { id: 'm3', foods: ['mela'], liking: 'little' },
          { id: 'm4', foods: ['zucchina'], liking: 'good' },
        ] } },
      });
      const per = {};
      for (const p of pappe()) per[p.id] = p.giudizio;
      uguale(per.m1, 'good', "'all' si rilegge 'good'");
      uguale(per.m2, 'ok', "'half' si rilegge 'ok'");
      uguale(per.m3, 'bad', "'little' si rilegge 'bad'");
      uguale(per.m4, 'good', 'i giudizi nuovi restano come sono');
    },
  },
  {
    nome: 'pesate(): esce in ordine di data anche con le chiavi disordinate',
    prova: () => {
      metti({
        '2026-05-10': { Gabriel: { weight: { kg: 3.3, addedAt: 3 } } },
        '2026-03-01': { Gabriel: { weight: { kg: 1.1, addedAt: 1 } } },
        goals: { pappe: 2 },
        '2026-04-02': { Gabriel: { weight: { kg: 2.2, addedAt: 2 } } },
        '2026-04-20': { Vittorio: { weight: { kg: 9.9, addedAt: 4 } } },
      });
      const lista = pesate('Gabriel');
      uguali(lista.map((p) => p.iso), ['2026-03-01', '2026-04-02', '2026-05-10'], 'ordine di data');
      uguale(lista.length, 3, "le pesate dell'altro bambino non entrano");
      uguale(lista[0].kg, 1.1, 'il valore arriva da kg');
    },
  },
  {
    nome: 'scriviMisura: un peso nuovo ha kg, time, note e addedAt',
    prova: () => senzaMondo(() => {
      provaSenzaScritture(true);
      try {
        metti({});
        scriviMisura('Gabriel', 'peso', 8.5, '2026-10-26');
        const w = stato.data['2026-10-26'].Gabriel.weight;
        uguale(w.kg, 8.5, 'kg scritto');
        uguale(w.note, '', 'note vuota');
        vero(/^\d{2}:\d{2}$/.test(w.time), `time in ore e minuti, trovato '${w.time}'`);
        vero(typeof w.addedAt === 'number' && w.addedAt > 0, 'addedAt è un numero');
      } finally {
        provaSenzaScritture(false);
      }
    }),
  },
  {
    nome: 'scriviMisura: due volte nello stesso giorno sovrascrive, e addedAt cresce',
    prova: () => senzaMondo(() => {
      provaSenzaScritture(true);
      try {
        metti({});
        scriviMisura('Gabriel', 'peso', 8.5, '2026-10-26');
        const prima = { ...stato.data['2026-10-26'].Gabriel.weight };
        scriviMisura('Gabriel', 'peso', 8.6, '2026-10-26');
        const dopo = stato.data['2026-10-26'].Gabriel.weight;
        uguale(dopo.kg, 8.6, 'il valore nuovo sovrascrive');
        uguale(Object.keys(stato.data['2026-10-26'].Gabriel).length, 1, 'resta un peso solo nel giorno');
        vero(dopo.addedAt > prima.addedAt, `addedAt cresce: ${prima.addedAt} -> ${dopo.addedAt}`);
      } finally {
        provaSenzaScritture(false);
      }
    }),
  },
  {
    nome: 'cancellaMisura su una temperatura lascia una tombstone con il suo id',
    prova: () => senzaMondo(() => {
      provaSenzaScritture(true);
      try {
        metti({ '2026-10-26': { Gabriel: { temperatures: [
          { id: 'x1', temp: 36.9, time: '08:00' },
          { id: 'x2', temp: 37.0, time: '09:00' },
        ] } } });
        cancellaMisura('Gabriel', 'temperatura', '2026-10-26', 'x2');
        const lista = stato.data['2026-10-26'].Gabriel.temperatures;
        uguale(lista.length, 1, 'resta una temperatura');
        uguale(lista[0].id, 'x1', 'è quella non cancellata');
        const pietre = stato.data._tombstones || [];
        const mia = pietre.find((t) => t.id === 'x2');
        vero(!!mia, 'la tombstone con quel id esiste');
        uguale(mia.dateKey, '2026-10-26', 'la tombstone porta il giorno');
        uguale(mia.baby, 'Gabriel', 'la tombstone porta il bambino');
        vero(typeof mia.deletedAt === 'number' && mia.deletedAt > 0, 'la tombstone porta il momento');
      } finally {
        provaSenzaScritture(false);
      }
    }),
  },
  {
    nome: 'con provaSenzaScritture(true), scriviMisura non tocca il deposito e non chiama fetch',
    prova: () => senzaMondo(({ fetchChiamato, tocchiDeposito }) => {
      provaSenzaScritture(true);
      try {
        metti({});
        scriviMisura('Vittorio', 'temperatura', 37.4, '2026-10-26');
        uguale(stato.data['2026-10-26'].Vittorio.temperatures.length, 1, 'la misura sta in memoria');
        uguale(tocchiDeposito(), 0, 'il deposito non è stato toccato');
        uguale(fetchChiamato(), false, 'nessuna chiamata di rete');
      } finally {
        provaSenzaScritture(false);
      }
    }),
  },
  {
    nome: 'avvia(): con la riga v3 presente non manda nessuna POST e usa quei dati',
    prova: async () => {
      const remoto = { '2026-10-20': { Gabriel: { weight: { kg: 4.44, addedAt: 50 } } }, goals: { pappe: 2 } };
      const rete = finta((url) => (url.includes('id=eq.v3') ? [{ data: remoto }] : []));
      await senzaMondo(async () => {
        metti({});
        await avvia({ fetch: rete, ...SENZA_SEME });
      });
      uguale(rete.post().length, 0, 'nessuna POST');
      uguale(stato.data['2026-10-20'].Gabriel.weight.kg, 4.44, 'i dati arrivano dalla riga v3');
      uguale(stato.data.goals.pappe, 2, 'le chiavi di configurazione arrivano con gli altri');
      uguale(stato.sync, 'ok', 'la sincronizzazione risulta riuscita');
    },
  },
  {
    nome: "avvia(): riga v3 assente e main presente, una POST sola su id 'v3' con tutto main",
    prova: async () => {
      const main = {
        '2026-08-27': { Vittorio: {
          feeds: [{ id: 'f1', ml: 230, time: '11:15' }],
          diapers: [{ id: 'd1', dtype: 'pipi' }],
          therapies: { vitd: true },
          temperatures: [{ id: 't1', temp: 36.7, time: '06:00' }],
          weight: { kg: 5.55, addedAt: 40 },
        } },
        goals: { pappe: 3 },
        customFruits: [{ id: 'cf1', name: '30 g di zucchine e patate' }],
        _tombstones: [{ ck: '11:15|230|Latte', id: 'vecchio', baby: 'Vittorio', kind: 'feeds', dateKey: '2026-08-27', deletedAt: 1 }],
      };
      const rete = finta((url) => (url.includes('id=eq.v3') ? [] : [{ data: main }]));
      await senzaMondo(async () => {
        metti({});
        await avvia({ fetch: rete, ...SENZA_SEME });
      });
      const post = rete.post();
      uguale(post.length, 1, 'una POST sola');
      uguale(post[0].corpo.id, RIGA, "la POST va sulla riga 'v3'");
      uguali(post[0].corpo.data, main, 'la POST porta tutto il contenuto di main');
      uguale(stato.data['2026-08-27'].Vittorio.feeds.length, 1, 'i feeds non si perdono');
      uguale(stato.data['2026-08-27'].Vittorio.diapers.length, 1, 'i diapers non si perdono');
      uguale(stato.data['2026-08-27'].Vittorio.therapies.vitd, true, 'le therapies non si perdono');
      uguale(stato.data.customFruits.length, 1, 'i customFruits non si perdono');
    },
  },
  {
    nome: 'avvia(): con la rete che fallisce non scrive niente di remoto',
    prova: async () => {
      const locale = { '2026-09-02': { Gabriel: { weight: { kg: 6.66, addedAt: 70 } } } };
      const rete = finta(() => null);
      await senzaMondo(async () => {
        metti(locale);
        await avvia({ fetch: rete, ...SENZA_SEME });
      });
      uguale(rete.post().length, 0, 'nessuna POST');
      uguale(stato.sync, 'errore', "lo stato della sincronizzazione è 'errore'");
      uguali(stato.data, locale, 'i dati locali restano quelli');
    },
  },
  {
    nome: "avvia(): non manda mai una POST sulla riga 'main'",
    prova: async () => {
      const main = { '2026-08-27': { Vittorio: { feeds: [{ id: 'f1', ml: 230 }] } } };
      const scenari = [
        ['riga v3 presente', finta((url) => (url.includes('id=eq.v3') ? [{ data: { goals: {} } }] : [{ data: main }]))],
        ['riga v3 assente, main presente', finta((url) => (url.includes('id=eq.v3') ? [] : [{ data: main }]))],
        ['riga v3 assente, main assente', finta(() => [])],
        ['riga v3 assente, main non risponde', finta((url) => (url.includes('id=eq.v3') ? [] : null))],
        ['tutte le letture in errore HTTP', finta(() => 500)],
        ['rete morta', finta(() => null)],
      ];
      for (const [come, rete] of scenari) {
        await senzaMondo(async () => {
          metti({});
          await avvia({ fetch: rete, ...SENZA_SEME });
        });
        vero(!haScrittoMain(rete), `nessuna POST su main (${come})`);
        for (const c of rete.post()) uguale(c.corpo.id, RIGA, `la POST punta alla riga v3 (${come})`);
      }
      const morta = scenari[scenari.length - 1][1];
      uguale(morta.post().length, 0, 'con la rete morta non parte nessuna POST');
    },
  },
];
