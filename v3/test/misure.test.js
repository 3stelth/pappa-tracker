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
  ultimePerTipo,
  misureDaSostituire,
  testoSostituzione,
  testoSalvato,
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
      // Il tipo lo porta il titolo del gruppo: nella riga non si ripete.
      vero(!p.includes('Peso'), `la riga del peso ripete il tipo: ${p}`);
      vero(!t.includes('Temperatura'), `la riga della temperatura ripete il tipo: ${t}`);
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
  {
    nome: '11. misureDaSostituire trova peso e lunghezza già scritti, per ogni bambino; la temperatura mai',
    prova() {
      metti({
        '2026-10-25': {
          Gabriel: { weight: peso(8.29), length: lunghezza(70), temperatures: [temp(37.1, '09:00', 't1')] },
        },
        '2026-10-24': { Vittorio: { weight: peso(6.4) } },
      });
      uguali(misureDaSostituire('peso', ['Gabriel', 'Vittorio'], '2026-10-25'), [{ bambino: 'Gabriel', valore: 8.29 }]);
      uguali(misureDaSostituire('peso', ['Vittorio'], '2026-10-25'), [], 'Vittorio quel giorno non ha il peso');
      uguali(misureDaSostituire('peso', ['Gabriel', 'Vittorio'], '2026-10-24'), [{ bambino: 'Vittorio', valore: 6.4 }]);
      uguali(misureDaSostituire('lunghezza', ['Gabriel'], '2026-10-25'), [{ bambino: 'Gabriel', valore: 70 }]);
      uguali(misureDaSostituire('temperatura', ['Gabriel'], '2026-10-25'), [], 'le temperature si aggiungono');
      uguali(misureDaSostituire('peso', ['Gabriel'], '2026-10-26'), [], 'giorno senza misure');
    },
  },
  {
    nome: '12. testoSostituzione nomina il valore che sparirebbe, per uno e per due bambini',
    prova() {
      uguale(
        testoSostituzione('peso', '2026-10-25', [{ bambino: 'Gabriel', valore: 8.29 }]),
        'Gabriel ha già 8,29 kg il 25 ott. Lo sostituisco?'
      );
      uguale(
        testoSostituzione('peso', '2026-10-25', [
          { bambino: 'Gabriel', valore: 8.29 },
          { bambino: 'Vittorio', valore: 6.45 },
        ]),
        'Gabriel ha già 8,29 kg il 25 ott. Vittorio ha già 6,45 kg il 25 ott. Li sostituisco?'
      );
    },
  },
  {
    nome: '13. testoSalvato dice che cosa è stato scritto e per chi',
    prova() {
      uguale(
        testoSalvato('peso', 8.3, ['Gabriel', 'Vittorio'], '2026-10-25', false),
        'Salvato: peso 8,30 kg per Gabriel e Vittorio, 25 ott.'
      );
      const t = testoSalvato('lunghezza', 70.5, ['Gabriel'], '2026-10-12', true);
      vero(t.includes('lunghezza 70,5 cm per Gabriel, 12 ott.'), t);
      vero(t.includes('sostituito'), 'deve dire che ha sostituito');
    },
  },
  {
    nome: '14. ultimePerTipo tiene le ultime di ogni tipo: molte temperature non cacciano le pesate',
    prova() {
      const temps = [];
      for (let i = 1; i <= 6; i += 1) temps.push(temp(36 + i / 10, '0' + i + ':00', 't' + i));
      metti({
        '2026-10-20': { Gabriel: { weight: peso(8.1) } },
        '2026-10-25': { Gabriel: { temperatures: temps } },
      });
      // Con il taglio sul totale, 2 righe sarebbero due temperature e la pesata sparirebbe.
      const m = ultimePerTipo(2);
      uguali(m.map((x) => x.tipo), ['temperatura', 'temperatura', 'peso']);
      uguali(ultimeMisure(2).map((x) => x.tipo), ['temperatura', 'temperatura'], 'ultimeMisure taglia ancora sul totale');
    },
  },
];
