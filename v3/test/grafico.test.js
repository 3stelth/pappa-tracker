// Il grafico della crescita. Qui si controlla che il disegno non inventi numeri:
// un 'NaN' nell'SVG sparisce dallo schermo senza errori, e una linea disegnata su
// dati che non ci sono è peggio di un grafico vuoto.
//
// L'ultimo caso non riguarda il disegno: ricalcola i quattro percentili veri dei due
// bambini con la stessa catena che usa crescita-vista.js (lms → zDa → percentile →
// percentileScritto). È il guardiano dell'anti-obiettivo numero uno del progetto.

import { leggiJson, uguale, uguali, vero, vicino } from './aiuto.js';
import * as c from '../crescita.js';
import { bande, disegnaGrafico, finestra } from '../grafico.js';

export const nome = 'grafico';

let caricate = false;
async function pronte() {
  if (!caricate) {
    await c.caricaTabelle((file) => leggiJson(`dati/${file}`));
    caricate = true;
  }
}

/** Quante volte un pezzo di testo compare nella stringa. */
function conta(testo, pezzo) {
  return testo.split(pezzo).length - 1;
}

/** I numeri delle etichette dell'asse y, riletti dall'SVG. */
function etichetteY(svg) {
  return [...svg.matchAll(/class="asse-y"[^>]*>([^<]+)</g)].map((m) =>
    Number(m[1].replace(',', '.'))
  );
}

const SERIE_VERA = {
  Gabriel: [
    { giorni: 14, valore: 2.97 },
    { giorni: 234, valore: 8.29 },
  ],
  Vittorio: [{ giorni: 14, valore: 2.125 }],
};

export const casi = [
  {
    nome: 'la banda di mezzo al giorno 0 vale la mediana della tabella',
    prova: async () => {
      await pronte();
      const mediana = bande('peso', 0, 100, 1).find((b) => b.z === 0);
      vero(!!mediana, 'la banda z 0 c è');
      const [giorno, valore] = mediana.punti[0];
      uguale(giorno, 0, 'il primo punto sta al giorno 0');
      vicino(valore, c.lms('peso', 0)[1], 1e-12, 'la mediana è la M della tabella');
    },
  },
  {
    nome: 'le bande sono cinque, con le etichette dell OMS',
    prova: async () => {
      await pronte();
      const b = bande('peso', 0, 234, 6);
      uguale(b.length, 5, 'quante bande');
      uguali(
        b.map((x) => x.etichetta),
        ['P3', 'P15', 'P50', 'P85', 'P97'],
        'le etichette delle bande'
      );
    },
  },
  {
    nome: 'con le serie vuote non c e nessun NaN e nessuna linea dei bambini',
    prova: async () => {
      await pronte();
      const svg = disegnaGrafico({
        misura: 'peso',
        serie: { Gabriel: [], Vittorio: [] },
        giorniDa: 0,
        giorniA: 234,
      });
      vero(svg.startsWith('<svg'), 'torna un SVG');
      vero(!svg.includes('NaN'), `nessun NaN nell SVG: ${svg.slice(0, 160)}`);
      vero(!svg.includes('undefined'), 'nessun undefined nell SVG');
      uguale(conta(svg, 'class="serie"'), 0, 'quante linee dei bambini');
      uguale(conta(svg, 'class="punto"'), 0, 'quanti pallini');
    },
  },
  {
    nome: 'con un punto solo non c e la linea, c e solo il pallino',
    prova: async () => {
      await pronte();
      const svg = disegnaGrafico({
        misura: 'peso',
        serie: { Gabriel: [{ giorni: 14, valore: 2.97 }], Vittorio: [] },
        giorniDa: 0,
        giorniA: 234,
      });
      vero(!svg.includes('NaN'), 'nessun NaN nell SVG');
      uguale(conta(svg, 'class="serie"'), 0, 'quante linee dei bambini');
      uguale(conta(svg, 'class="punto"'), 1, 'quanti pallini');
    },
  },
  {
    nome: 'i punti a giorni negativi non entrano nel disegno',
    prova: async () => {
      await pronte();
      const comuni = { misura: 'peso', giorniDa: 0, giorniA: 234 };
      const conNegativo = disegnaGrafico({
        ...comuni,
        serie: {
          Gabriel: [
            { giorni: -10, valore: 1.2 },
            { giorni: 14, valore: 2.97 },
            { giorni: 234, valore: 8.29 },
          ],
          Vittorio: [],
        },
      });
      const senzaNegativo = disegnaGrafico({
        ...comuni,
        serie: {
          Gabriel: [
            { giorni: 14, valore: 2.97 },
            { giorni: 234, valore: 8.29 },
          ],
          Vittorio: [],
        },
      });
      uguale(conNegativo, senzaNegativo, 'il punto prima del termine non cambia il disegno');
    },
  },
  {
    nome: 'la finestra di un mese copre un mese, quella di tutto copre il registro',
    prova: () => {
      const uno = finestra('1m', SERIE_VERA);
      vicino(uno.giorniA - uno.giorniDa, 30, 1, 'quanti giorni copre 1m');
      uguale(uno.giorniA, 234, 'la finestra di 1m finisce sull ultima misura');
      const tutto = finestra('tutto', SERIE_VERA);
      uguale(tutto.giorniDa, 0, 'tutto parte dal termine');
      vero(tutto.giorniA >= 234, `tutto arriva all ultima misura: ${tutto.giorniA}`);
    },
  },
  {
    nome: 'il grafico della lunghezza usa i cm, non i kg',
    prova: async () => {
      await pronte();
      const svg = disegnaGrafico({
        misura: 'lunghezza',
        serie: {
          Gabriel: [
            { giorni: 14, valore: 48 },
            { giorni: 234, valore: 66 },
          ],
          Vittorio: [],
        },
        giorniDa: 0,
        giorniA: 234,
      });
      vero(!svg.includes('NaN'), 'nessun NaN nell SVG');
      const etichette = etichetteY(svg);
      vero(etichette.length > 1, `ci sono le etichette dell asse y: ${etichette.join(' ')}`);
      vero(
        Math.max(...etichette) > 50,
        `l asse y arriva oltre 50 cm, non si ferma ai kg: ${etichette.join(' ')}`
      );
    },
  },
  {
    nome: 'i quattro percentili veri che compaiono nella sezione',
    prova: async () => {
      await pronte();
      // Stessa catena di crescita-vista.js, sulle pesate vere dei due bambini.
      const attesi = [
        ['Gabriel, prima misura', '2026-03-19', 2.97, 14, -1.6054, 5.42, '5°'],
        ['Gabriel, oggi', '2026-10-25', 8.29, 234, -0.2508, 40.098, '40°'],
        ['Vittorio, prima misura', '2026-03-19', 2.125, 14, -3.7405, 0.009, '<1°'],
        ['Vittorio, oggi', '2026-10-25', 6.45, 234, -2.5194, 0.588, '<1°'],
      ];
      for (const [chi, iso, kg, giorniAttesi, z, p, scritto] of attesi) {
        const giorni = c.giorniDa(c.TERMINE, iso);
        uguale(giorni, giorniAttesi, `${chi}: giorni di età corretta`);
        const terna = c.lms('peso', giorni);
        vero(!!terna, `${chi}: la tabella OMS ha quel giorno`);
        const zTrovato = c.zDa(kg, terna);
        vicino(zTrovato, z, 0.0005, `${chi}: punteggio z`);
        const pTrovato = c.percentile(zTrovato);
        vicino(pTrovato, p, 0.005, `${chi}: percentile`);
        uguale(c.percentileScritto(pTrovato), scritto, `${chi}: percentile scritto`);
      }
    },
  },
];
