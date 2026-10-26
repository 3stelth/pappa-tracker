// Test della sezione Oggi della v3.
//
// Nessun caso usa la rete, il localStorage o il DOM. Ogni caso mette `stato.data` a mano
// e chiama le funzioni pure. I pesi e le lunghezze sono inventati.

import { uguale, vero, vicino } from './aiuto.js';
import { stato } from '../dati.js';
import {
  sagoma,
  sagomaVuota,
  statoAlGiorno,
  altezzaSagoma,
  riferimentiMesi,
} from '../oggi.js';

export const nome = 'oggi';

/** Mette `stato.data` a un contenuto noto, senza passare dal localStorage. */
function metti(dati) {
  stato.data = dati;
  stato.sync = 'fermo';
}

function peso(kg) {
  return { weight: { kg, time: '09:00', addedAt: 1 } };
}

function lunghezza(cm) {
  return { length: { cm, time: '09:00', addedAt: 1 } };
}

export const casi = [
  {
    nome: 'statoAlGiorno con due pesate: deltaG è la differenza in grammi, isoPrecedente è la data prima',
    prova() {
      metti({
        '2026-10-20': { Gabriel: peso(8.155) },
        '2026-10-25': { Gabriel: peso(8.29) },
      });
      const s = statoAlGiorno('Gabriel', '2026-10-25');
      uguale(s.kg, 8.29, 'kg');
      uguale(s.isoPeso, '2026-10-25', 'isoPeso');
      uguale(s.deltaG, 135, 'deltaG');
      uguale(s.isoPrecedente, '2026-10-20', 'isoPrecedente');
    },
  },
  {
    nome: 'statoAlGiorno con una sola pesata: deltaG è null e isoPrecedente è null',
    prova() {
      metti({ '2026-10-25': { Gabriel: peso(8.29) } });
      const s = statoAlGiorno('Gabriel', '2026-10-25');
      uguale(s.kg, 8.29, 'kg');
      uguale(s.deltaG, null, 'deltaG');
      uguale(s.isoPrecedente, null, 'isoPrecedente');
    },
  },
  {
    nome: 'statoAlGiorno senza pesate: kg è null',
    prova() {
      metti({});
      const s = statoAlGiorno('Gabriel', '2026-10-25');
      uguale(s.kg, null, 'kg');
      uguale(s.isoPeso, null, 'isoPeso');
      uguale(s.deltaG, null, 'deltaG');
    },
  },
  {
    nome: 'statoAlGiorno senza lunghezze: cm è null e isoLunghezza è null (niente stima dal peso)',
    prova() {
      metti({
        '2026-10-20': { Gabriel: peso(8.155) },
        '2026-10-25': { Gabriel: peso(8.29) },
      });
      const s = statoAlGiorno('Gabriel', '2026-10-25');
      uguale(s.cm, null, 'cm');
      uguale(s.isoLunghezza, null, 'isoLunghezza');
    },
  },
  {
    nome: 'statoAlGiorno a una data di mezzo: prende l\'ultima misura non successiva a quella data',
    prova() {
      metti({
        '2026-08-01': { Gabriel: { ...peso(6.9), ...lunghezza(66) } },
        '2026-09-01': { Gabriel: { ...peso(7.6), ...lunghezza(68) } },
        '2026-10-01': { Gabriel: { ...peso(8.1), ...lunghezza(70) } },
      });
      const s = statoAlGiorno('Gabriel', '2026-09-15');
      uguale(s.kg, 7.6, 'kg');
      uguale(s.isoPeso, '2026-09-01', 'isoPeso');
      uguale(s.isoPrecedente, '2026-08-01', 'isoPrecedente');
      uguale(s.deltaG, 700, 'deltaG');
      uguale(s.cm, 68, 'cm');
      uguale(s.isoLunghezza, '2026-09-01', 'isoLunghezza');
      // il giorno stesso della misura conta; il giorno prima no
      uguale(statoAlGiorno('Gabriel', '2026-09-01').kg, 7.6, 'kg il giorno stesso');
      uguale(statoAlGiorno('Gabriel', '2026-08-31').kg, 6.9, 'kg il giorno prima');
    },
  },
  {
    nome: 'altezzaSagoma(70,78,214) sta fra 180 e 200; altezzaSagoma(64,78,214) è più piccola',
    prova() {
      const alta = altezzaSagoma(70, 78, 214);
      vero(alta >= 180 && alta <= 200, `70 cm su 214 px: ${alta}`);
      const bassa = altezzaSagoma(64, 78, 214);
      vero(bassa < alta, `64 cm (${bassa}) deve stare sotto 70 cm (${alta})`);
      vicino(bassa / alta, 64 / 70, 1e-9, 'proporzione fra le due altezze');
    },
  },
  {
    nome: 'sagoma() e sagomaVuota() non contengono mai NaN né undefined',
    prova() {
      const colorata = sagoma({ colore: '#3B82F6', colore2: '#7DB4FB', scuro: '#0B2E63', id: 'gg' });
      const vuota = sagomaVuota();
      for (const [nomeSagoma, svg] of [['sagoma', colorata], ['sagomaVuota', vuota]]) {
        vero(typeof svg === 'string' && svg.startsWith('<svg'), `${nomeSagoma} è una stringa SVG`);
        vero(!svg.includes('NaN'), `${nomeSagoma} contiene NaN`);
        vero(!svg.includes('undefined'), `${nomeSagoma} contiene undefined`);
      }
    },
  },
  {
    nome: 'riferimentiMesi(2026-03-19, 2026-10-25) dà 8 etichette, da mar a ott, con frazioni fra 0 e 1',
    prova() {
      const r = riferimentiMesi('2026-03-19', '2026-10-25');
      uguale(r.length, 8, 'quante etichette');
      uguale(r[0].etichetta, 'mar', 'la prima');
      uguale(r[7].etichetta, 'ott', 'l\'ultima');
      for (const { frazione } of r) vero(frazione >= 0 && frazione <= 1, `frazione ${frazione}`);
      uguale(r[0].frazione, 0, 'la prima sta all\'inizio');
    },
  },
];
