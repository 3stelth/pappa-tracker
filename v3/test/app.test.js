// Il guscio della v3: qui si provano le decisioni pure, non il DOM.
//
// Con Node il documento non c'è, quindi app.js registra zero gestori e restano
// visibili solo le funzioni. È la stessa regola delle sezioni.

import { uguale, vero } from './aiuto.js';
import { FUORI_PER_RICARICARE, deveRicaricare } from '../app.js';

export const nome = 'app';

const ORA = 60 * 60 * 1000;

export const casi = [
  {
    nome: '1. la soglia del ricaricamento è di quattro ore',
    prova() {
      uguale(FUORI_PER_RICARICARE, 4 * ORA);
      // Una notte sta dentro la soglia, il giro fra una pappa e l'altra no: se la
      // soglia scendesse sotto le tre ore l'app si ricaricherebbe in mezzo alla
      // giornata, e il conto delle pappe ripartirebbe da «Oggi».
      vero(FUORI_PER_RICARICARE >= 3 * ORA, 'non così corta da scattare di giorno');
      vero(FUORI_PER_RICARICARE <= 12 * ORA, 'non così lunga da saltare una notte');
    },
  },
  {
    nome: '2. si ricarica solo dopo quattro ore fuori, mai prima',
    prova() {
      uguale(deveRicaricare(4 * ORA), true, 'quattro ore esatte');
      uguale(deveRicaricare(9 * ORA), true, 'una notte');
      uguale(deveRicaricare(4 * ORA - 1), false, 'un millisecondo prima');
      uguale(deveRicaricare(20 * 60 * 1000), false, 'venti minuti');
      uguale(deveRicaricare(0), false, 'rientro immediato');
    },
  },
  {
    nome: '3. un tempo che non è un numero non fa ricaricare',
    prova() {
      // Al primo evento di visibilità non c'è nessuna uscita da cui contare: un
      // valore storto non deve mai trasformarsi in un ricaricamento a ciclo.
      uguale(deveRicaricare(NaN), false);
      uguale(deveRicaricare(undefined), false);
      uguale(deveRicaricare(null), false);
      uguale(deveRicaricare(Infinity), false, 'nemmeno infinito');
      uguale(deveRicaricare('100000000'), false, 'nemmeno una stringa');
      uguale(deveRicaricare(-5 * ORA), false, 'un tempo negativo');
    },
  },
];
