// Test della sezione Misure della v3.
//
// Nessun caso usa la rete, il localStorage o il DOM: si provano solo le funzioni pure.
// I dati si mettono a mano in `stato.data`, nella forma della v2. I valori sono
// inventati: il registro vero non entra nei test.

import { uguale, uguali, vero, vicino } from './aiuto.js';
import { stato } from '../dati.js';
import {
  TIPI,
  valorePartenza,
  entroLimiti,
  passoSicuro,
  ultimeMisure,
  rigaMisura,
} from '../misure.js';

export const nome = 'misure';

/** Mette `stato.data` a un contenuto noto, senza passare dal localStorage. */
function metti(dati) {
  stato.data = dati ? JSON.parse(JSON.stringify(dati)) : {};
  stato.sync = 'fermo';
}

const peso = (kg) => ({ kg, time: '08:00', note: '', addedAt: 1 });
const lunghezza = (cm) => ({ cm, time: '08:00', note: '', addedAt: 1 });
const temp = (t, ora, id) => ({ id, temp: t, time: ora, note: '' });

export const casi = [
  {
    nome: "1. valorePartenza('peso','Gabriel') con pesate nei dati dà l'ultima pesata",
    prova() {
      metti({
        '2026-10-20': { Gabriel: { weight: peso(8.1) } },
        '2026-10-25': { Gabriel: { weight: peso(8.29) }, Vittorio: { weight: peso(6.45) } },
      });
      uguale(valorePartenza('peso', 'Gabriel'), 8.29);
      uguale(valorePartenza('peso', 'Vittorio'), 6.45);
    },
  },
  {
    nome: "2. valorePartenza('peso','Gabriel') senza pesate dà un valore dentro i limiti",
    prova() {
      metti({});
      const v = valorePartenza('peso', 'Gabriel');
      vero(Number.isFinite(v), `atteso un numero, trovato ${v}`);
      vero(entroLimiti('peso', v), `${v} è fuori dai limiti del peso`);
      vero(entroLimiti('lunghezza', valorePartenza('lunghezza', 'Vittorio')), 'lunghezza fuori limiti');
      vero(entroLimiti('temperatura', valorePartenza('temperatura', 'Vittorio')), 'temperatura fuori limiti');
    },
  },
  {
    nome: "3. valorePartenza('peso','Tutti e due') dà l'ultima pesata di Gabriel",
    prova() {
      metti({
        '2026-10-25': { Gabriel: { weight: peso(8.29) }, Vittorio: { weight: peso(6.45) } },
      });
      uguale(valorePartenza('peso', 'Tutti e due'), 8.29);
    },
  },
  {
    nome: "4. entroLimiti('temperatura', 31.9) è false; entroLimiti('temperatura', 37.1) è true",
    prova() {
      uguale(entroLimiti('temperatura', 31.9), false);
      uguale(entroLimiti('temperatura', 37.1), true);
      uguale(entroLimiti('temperatura', 43.1), false);
    },
  },
  {
    nome: "5. entroLimiti('peso', 0.5) è false (il dito sul meno non porta il peso a zero)",
    prova() {
      uguale(entroLimiti('peso', 0.5), false);
      uguale(entroLimiti('peso', 0), false);
      uguale(entroLimiti('peso', TIPI.peso.min), true);
      uguale(entroLimiti('peso', TIPI.peso.max), true);
    },
  },
  {
    nome: "6. passoSicuro('peso', 1.0, -0.05) resta 1.0 (si ferma al minimo)",
    prova() {
      uguale(passoSicuro('peso', 1.0, -0.05), 1.0);
      uguale(passoSicuro('peso', 40, 0.05), 40, 'si ferma anche al massimo');
    },
  },
  {
    nome: "7. passoSicuro('peso', 8.29, 0.01) vale 8.3 entro 1e-9 (niente errori di virgola mobile)",
    prova() {
      vicino(passoSicuro('peso', 8.29, 0.01), 8.3, 1e-9);
      uguale(String(passoSicuro('peso', 8.29, 0.01)), '8.3', 'nemmeno un 8.299999999999999');
      uguale(String(passoSicuro('temperatura', 37.1, 0.1)), '37.2');
    },
  },
  {
    nome: '8. ultimeMisure(3) mescola i tre tipi e i due bambini in ordine di data',
    prova() {
      metti({
        '2026-10-01': { Vittorio: { weight: peso(6.0) } },
        '2026-10-23': { Gabriel: { temperatures: [temp(37.1, '09:30', 't1')] } },
        '2026-10-24': { Vittorio: { length: lunghezza(64) } },
        '2026-10-25': { Gabriel: { weight: peso(8.29) } },
      });
      const m = ultimeMisure(3);
      uguali(
        m,
        [
          { bambino: 'Gabriel', tipo: 'peso', iso: '2026-10-25', valore: 8.29, id: '' },
          { bambino: 'Vittorio', tipo: 'lunghezza', iso: '2026-10-24', valore: 64, id: '' },
          { bambino: 'Gabriel', tipo: 'temperatura', iso: '2026-10-23', valore: 37.1, id: 't1' },
        ],
        'le tre più recenti, dalla più recente'
      );
    },
  },
  {
    nome: '9. rigaMisura() scrive il valore con la virgola e l\'unità giusta, senza "undefined"',
    prova() {
      const p = rigaMisura({ bambino: 'Gabriel', tipo: 'peso', iso: '2026-10-25', valore: 8.29, id: '' });
      const l = rigaMisura({ bambino: 'Vittorio', tipo: 'lunghezza', iso: '2026-10-12', valore: 64, id: '' });
      const t = rigaMisura({ bambino: 'Gabriel', tipo: 'temperatura', iso: '2026-10-02', valore: 37.1, id: 'abc' });
      vero(p.includes('8,29') && p.includes('kg'), `riga del peso: ${p}`);
      vero(l.includes('64') && l.includes('cm'), `riga della lunghezza: ${l}`);
      vero(t.includes('37,1') && t.includes('°C'), `riga della temperatura: ${t}`);
      vero(!p.includes('8.29'), 'il punto decimale non deve comparire');
      vero(p.includes('25 ott') && t.includes('2 ott'), 'la data corta compare');
      for (const riga of [p, l, t]) {
        vero(!riga.includes('undefined') && !riga.includes('NaN'), `riga sporca: ${riga}`);
      }
    },
  },
  {
    nome: '10. due temperature dello stesso giorno stanno in ordine di ora, la più tarda per prima',
    prova() {
      metti({
        '2026-10-25': {
          Gabriel: { temperatures: [temp(36.8, '08:00', 'a'), temp(37.4, '20:15', 'b')] },
        },
      });
      const m = ultimeMisure(5);
      uguali(m.map((x) => x.id), ['b', 'a']);
    },
  },
];
