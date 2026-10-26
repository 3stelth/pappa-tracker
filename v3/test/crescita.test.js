// Il calcolo dei percentili è la parte critica del progetto: un numero sbagliato su un
// bambino prematuro fa danno reale a chi legge. Qui si controlla ogni pezzo del
// calcolo, e in fondo i quattro numeri veri che compaiono sullo schermo.

import { leggiJson, uguale, vero, vicino } from './aiuto.js';
import * as c from '../crescita.js';

export const nome = 'crescita';

let caricate = false;
async function pronte() {
  if (!caricate) {
    await c.caricaTabelle((file) => leggiJson(`dati/${file}`));
    caricate = true;
  }
}

export const casi = [
  {
    nome: 'un eta corretta negativa non ha tabella',
    prova: async () => {
      await pronte();
      uguale(c.lms('peso', -1), null, 'lms al giorno -1');
    },
  },
  {
    nome: 'oltre il giorno 1856 non c e tabella',
    prova: async () => {
      await pronte();
      uguale(c.lms('peso', 1857), null, 'lms al giorno 1857');
    },
  },
  {
    nome: 'i due estremi della tabella ci sono',
    prova: async () => {
      await pronte();
      vero(c.lms('peso', 0) !== null, 'peso al giorno 0');
      vero(c.lms('lunghezza', c.GIORNO_MAX) !== null, `lunghezza al giorno ${c.GIORNO_MAX}`);
    },
  },
  {
    nome: 'i casi di riferimento tornano entro 0,01',
    prova: async () => {
      await pronte();
      const { casi: riferimento } = await leggiJson('test/riferimento-z.json');
      for (const caso of riferimento) {
        const terna = c.lms(caso.misura, caso.giorni);
        vicino(c.zDa(caso.valore, terna), caso.z, 0.01, `${caso.misura}, giorno ${caso.giorni}`);
      }
    },
  },
  {
    nome: 'il percentile di z noti e quello giusto',
    prova: () => {
      // La funzione erf usa l'approssimazione di Abramowitz e Stegun 7.1.26, con un
      // errore massimo dichiarato di 1,5e-7. Sul percentile diventa 7,5e-6, e il
      // percentile si mostra senza decimali: la tolleranza qui è quella, non zero.
      vicino(c.percentile(0), 50, 1e-5, 'percentile di z 0');
      vicino(c.percentile(-1.881), 3, 0.05, 'percentile di z -1,881');
      vicino(c.percentile(1.881), 97, 0.05, 'percentile di z +1,881');
    },
  },
  {
    nome: 'zDa e valoreA sono una l inversa dell altra',
    prova: async () => {
      await pronte();
      for (const giorno of [0, c.GIORNO_MAX]) {
        for (const misura of ['peso', 'lunghezza']) {
          const terna = c.lms(misura, giorno);
          vicino(c.zDa(c.valoreA(terna, 1.234), terna), 1.234, 1e-9, `${misura}, giorno ${giorno}`);
        }
      }
    },
  },
  {
    nome: 'la prima misura del database sta a 14 giorni corretti',
    prova: () => uguale(c.giorniDa(c.TERMINE, '2026-03-19'), 14, 'giorni corretti al 19 marzo'),
  },
  {
    nome: 'una data prima del termine da giorni negativi',
    prova: () => uguale(c.giorniDa(c.TERMINE, '2026-02-23'), -10, 'giorni corretti al 23 febbraio'),
  },
  {
    nome: 'la prematurita e di 87 giorni',
    prova: () => uguale(c.giorniDa(c.NASCITA, c.TERMINE), 87, 'giorni dalla nascita al termine'),
  },
  {
    nome: 'il 25 ottobre 2026 sta a 234 giorni corretti',
    prova: () => uguale(c.giorniDa(c.TERMINE, '2026-10-25'), 234, 'giorni corretti al 25 ottobre'),
  },
  {
    nome: 'prima del termine l eta corretta si scrive a parole',
    prova: () =>
      uguale(c.etaScritta(c.TERMINE, '2026-02-23'), 'non ancora al termine', 'età al 23 febbraio'),
  },
  {
    nome: 'sotto il mese l eta si scrive in giorni',
    prova: () => uguale(c.etaScritta(c.TERMINE, '2026-03-19'), '14 gg', 'età al 19 marzo'),
  },
  {
    nome: 'oggi l eta corretta e 7 mesi e 20 gg',
    prova: () => uguale(c.etaScritta(c.TERMINE, '2026-10-25'), '7 mesi e 20 gg', 'età al 25 ottobre'),
  },
  {
    nome: 'il percentile si scrive come ordinale, senza precisione finta',
    prova: () => {
      uguale(c.percentileScritto(0.4), '<1°', 'sotto il primo percentile');
      uguale(c.percentileScritto(40.098), '40°', 'quarantesimo percentile');
      uguale(c.percentileScritto(99.6), '>99°', 'sopra il novantanovesimo');
    },
  },
  {
    nome: 'il punteggio z si scrive col meno tipografico e la virgola',
    prova: () => {
      uguale(c.zScritto(-0.25), 'z −0,25', 'z negativo');
      uguale(c.zScritto(0.5), 'z +0,50', 'z positivo');
    },
  },
  {
    nome: 'i quattro numeri veri che compaiono sullo schermo',
    prova: async () => {
      await pronte();
      // Pesi veri dei due bambini, già nel database pubblico. Stanno qui perché sono
      // l'unico punto in cui un errore nel calcolo si vedrebbe subito sullo schermo.
      const attesi = [
        ['Gabriel, prima misura', 2.97, 14, -1.6054, 5.42],
        ['Gabriel, oggi', 8.29, 234, -0.2508, 40.098],
        ['Vittorio, prima misura', 2.125, 14, -3.7405, 0.009],
        ['Vittorio, oggi', 6.45, 234, -2.5194, 0.588],
      ];
      for (const [chi, kg, giorni, z, p] of attesi) {
        const terna = c.lms('peso', giorni);
        const zTrovato = c.zDa(kg, terna);
        vicino(zTrovato, z, 0.0005, `${chi}: punteggio z`);
        vicino(c.percentile(zTrovato), p, 0.005, `${chi}: percentile`);
      }
    },
  },
];
