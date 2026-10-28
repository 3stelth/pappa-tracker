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
  righeAffiancate,
  cellaMisura,
  dentroPeriodo,
  giorniTemperatura,
  testoDelta,
  FEBBRE,
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
    nome: '9. righeAffiancate mette i due bambini sulla stessa riga e cellaMisura scrive il valore con la virgola',
    prova() {
      metti({
        '2026-10-20': { Gabriel: { weight: peso(8.1) } },
        '2026-10-25': { Gabriel: { weight: peso(8.29) }, Vittorio: { weight: peso(6.45) } },
      });
      const r = righeAffiancate('peso', 12);
      uguali(r.map((x) => x.iso), ['2026-10-25', '2026-10-20'], 'una riga per giorno, dalla più recente');
      uguale(r[0].celle[0].valore, 8.29, 'Gabriel nella prima colonna');
      uguale(r[0].celle[1].valore, 6.45, 'Vittorio nella seconda');
      uguale(r[1].celle[1], null, 'il giorno senza Vittorio lascia la cella vuota');

      // La temperatura divide le righe anche per ora: più misure in un giorno restano distinte.
      metti({
        '2026-10-25': {
          Gabriel: { temperatures: [temp(36.8, '08:00', 'a'), temp(37.4, '20:15', 'b')] },
          Vittorio: { temperatures: [temp(36.9, '08:00', 'c')] },
        },
      });
      const t = righeAffiancate('temperatura', 12);
      uguali(t.map((x) => x.ora), ['20:15', '08:00'], 'una riga per ora, dalla più tarda');
      uguale(t[0].celle[1], null, 'alle 20:15 Vittorio non ha misure');
      uguale(t[1].celle[0].id, 'a');
      uguale(t[1].celle[1].id, 'c', 'alla stessa ora i due bambini stanno affiancati');

      // Due misure dello stesso bambino allo stesso momento non devono sparire.
      metti({ '2026-10-25': { Gabriel: { temperatures: [temp(37, '08:00', 'x'), temp(37.5, '08:00', 'y')] } } });
      const d = righeAffiancate('temperatura', 12);
      uguale(d.length, 2, 'la cella già occupata apre una riga in più');
      uguali(d.map((x) => x.celle[0].id).sort(), ['x', 'y']);

      const p = cellaMisura({ bambino: 'Gabriel', tipo: 'peso', iso: '2026-10-25', valore: 8.29, id: '' });
      const l = cellaMisura({ bambino: 'Vittorio', tipo: 'lunghezza', iso: '2026-10-12', valore: 64, id: '' });
      const c = cellaMisura({ bambino: 'Gabriel', tipo: 'temperatura', iso: '2026-10-02', valore: 37.1, id: 'abc' });
      vero(p.includes('8,29') && p.includes('kg'), `cella del peso: ${p}`);
      vero(l.includes('64') && l.includes('cm'), `cella della lunghezza: ${l}`);
      vero(c.includes('37,1') && c.includes('°C'), `cella della temperatura: ${c}`);
      vero(!p.includes('8.29'), 'il punto decimale non deve comparire');
      // Nome e data stanno nell'intestazione e nell'etichetta: nella cella non si ripetono.
      vero(!p.includes('chip') && !p.includes('25 ott'), `la cella ripete il nome o la data: ${p}`);
      for (const cella of [p, l, c, cellaMisura(null)]) {
        vero(!cella.includes('undefined') && !cella.includes('NaN'), `cella sporca: ${cella}`);
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
  {
    nome: '15. righeAffiancate conta i giorni dalla riga sotto e la differenza dalla misura prima',
    prova() {
      metti({
        '2026-09-29': { Gabriel: { weight: peso(8.035) }, Vittorio: { weight: peso(6.18) } },
        '2026-10-05': { Gabriel: { weight: peso(8.13) }, Vittorio: { weight: peso(6.23) } },
        '2026-10-20': { Gabriel: { weight: peso(8.155) }, Vittorio: { weight: peso(6.23) } },
        '2026-10-25': { Gabriel: { weight: peso(8.29) }, Vittorio: { weight: peso(6.45) } },
      });
      const r = righeAffiancate('peso');
      uguali(r.map((x) => x.giorni), [5, 15, 6, null], 'i giorni fra la riga e quella sotto');
      uguale(testoDelta('peso', r[0].delta[0]), '+135', 'Gabriel dal 20 al 25 ottobre');
      uguale(testoDelta('peso', r[0].delta[1]), '+220', 'Vittorio dal 20 al 25 ottobre');
      uguale(testoDelta('peso', r[1].delta[1]), '=', 'il peso che non cambia');
      uguale(testoDelta('peso', r[3].delta[0]), '', 'la riga più vecchia non ha niente sotto');
      uguale(r[3].delta[0], null, 'e la differenza è null, non zero');
    },
  },
  {
    nome: '16. la differenza non si scrive se la misura prima di quel bambino non è sulla riga sotto',
    prova() {
      // I giorni in ospedale: l'11 giugno la pesata prima di Gabriel è il 7, non l'8.
      // «3 gg» non è il suo intervallo, quindi i grammi non si scrivono.
      metti({
        '2026-06-07': { Gabriel: { weight: peso(5.61) } },
        '2026-06-08': { Vittorio: { weight: peso(4.1) } },
        '2026-06-11': { Gabriel: { weight: peso(5.67) }, Vittorio: { weight: peso(4.2) } },
      });
      const r = righeAffiancate('peso');
      uguali(r.map((x) => x.iso), ['2026-06-11', '2026-06-08', '2026-06-07']);
      uguale(r[0].giorni, 3, 'i giorni restano quelli fra le due righe');
      uguale(r[0].delta[0], null, 'Gabriel non ha la differenza: la sua pesata prima è il 7');
      uguale(testoDelta('peso', r[0].delta[1]), '+100', 'Vittorio invece sì: la sua pesata prima è l’8');
      uguale(r[1].delta[1], null, 'l’8 giugno Vittorio non ha niente sotto di suo');
    },
  },
  {
    nome: '17. dentroPeriodo taglia le righe ma non i conti, già fatti sulla lista intera',
    prova() {
      metti({
        '2026-06-11': { Gabriel: { weight: peso(5.67) } },
        '2026-10-20': { Gabriel: { weight: peso(8.155) } },
        '2026-10-25': { Gabriel: { weight: peso(8.29) } },
      });
      const tutte = righeAffiancate('peso');
      const mese = dentroPeriodo(tutte, '1m');
      uguali(mese.map((x) => x.iso), ['2026-10-25', '2026-10-20'], 'un mese dalla pesata più recente');
      uguale(testoDelta('peso', mese[1].delta[0]), '+2485', 'la riga tagliata tiene il confronto con giugno');
      uguale(dentroPeriodo(tutte, 'tutto').length, 3, 'Tutto non taglia niente');
      uguale(dentroPeriodo([], '1m').length, 0, 'senza righe non si rompe');
    },
  },
  {
    nome: '18. giorniTemperatura fa una riga per giorno, con il massimo di ogni bambino e il conto',
    prova() {
      metti({
        '2026-06-23': {
          Gabriel: { temperatures: [temp(38.2, '07:00', 'a'), temp(37.0, '19:00', 'b')] },
          Vittorio: { temperatures: [temp(37.5, '07:00', 'c')] },
        },
        '2026-06-05': { Vittorio: { temperatures: [temp(36.5, '10:00', 'd')] } },
      });
      const g = giorniTemperatura();
      uguali(g.map((x) => x.iso), ['2026-06-23', '2026-06-05'], 'un giorno per riga, dal più recente');
      uguali(g[0].massimi, [38.2, 37.5], 'il massimo di ogni bambino in quel giorno');
      uguale(g[0].quante, 3, 'il conto è di tutte le misure del giorno');
      uguali(g[1].massimi, [null, 36.5], 'il bambino senza misure non ha massimo');
      uguale(g[1].quante, 1);
      uguali(g[0].letture.map((r) => r.ora), ['19:00', '07:00'], 'le ore dentro, dalla più tarda');
      uguale(g[0].letture[1].celle[1].id, 'c', 'alle 07:00 i due stanno affiancati');
      vero(g[0].massimi[0] >= FEBBRE, 'il 23 giugno Gabriel passa la soglia');
      vero(g[1].massimi[1] < FEBBRE, 'il 5 giugno no');
    },
  },
];
