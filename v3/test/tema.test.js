// Test del tema della v3.
//
// Nessun caso usa il DOM, la rete o il localStorage vero: il deposito si passa
// finto. I casi girano uguali con Node e nel browser.

import { uguale, uguali, vero } from './aiuto.js';
import {
  CHIAVE_TEMA,
  TEMI,
  ASPETTO,
  ICONA,
  COLORE_BARRA,
  normalizza,
  prossimo,
  temaEffettivo,
  leggiScelta,
  salvaScelta,
  applica,
} from '../tema.js';

export const nome = 'tema';

/** Un localStorage finto, con dentro quello che gli passi. */
function deposito(dentro = {}) {
  return {
    getItem: (k) => (k in dentro ? dentro[k] : null),
    setItem: (k, v) => { dentro[k] = String(v); },
    dentro,
  };
}

/** Un deposito rotto: è il browser in navigazione privata, che lancia a ogni tocco. */
const rotto = {
  getItem() { throw new Error('deposito negato'); },
  setItem() { throw new Error('deposito negato'); },
};

export const casi = [
  {
    nome: '1. il tasto fa girare i tre temi in tondo: sistema → chiaro → scuro → sistema',
    prova() {
      uguale(prossimo('sistema'), 'chiaro');
      uguale(prossimo('chiaro'), 'scuro');
      uguale(prossimo('scuro'), 'sistema');
      uguali(TEMI, ['sistema', 'chiaro', 'scuro'], 'ordine dei tre temi');
    },
  },
  {
    nome: '2. normalizza: un valore sconosciuto, vuoto o nullo vale «sistema»',
    prova() {
      uguale(normalizza('chiaro'), 'chiaro');
      uguale(normalizza('scuro'), 'scuro');
      uguale(normalizza('sistema'), 'sistema');
      uguale(normalizza('pippo'), 'sistema', 'parola sconosciuta');
      uguale(normalizza(''), 'sistema', 'stringa vuota');
      uguale(normalizza(null), 'sistema', 'niente');
      uguale(normalizza(undefined), 'sistema', 'non definito');
      // Da un valore rovinato il tasto riparte dal primo tema, non si blocca.
      uguale(prossimo('pippo'), 'chiaro');
    },
  },
  {
    nome: '3. temaEffettivo: la scelta esplicita vince sul sistema; «sistema» lo segue',
    prova() {
      uguale(temaEffettivo('chiaro', true), 'chiaro', 'chiaro resta chiaro anche se il telefono è scuro');
      uguale(temaEffettivo('scuro', false), 'scuro', 'scuro resta scuro anche se il telefono è chiaro');
      uguale(temaEffettivo('sistema', true), 'scuro');
      uguale(temaEffettivo('sistema', false), 'chiaro');
      uguale(temaEffettivo('pippo', true), 'scuro', 'un valore rovinato segue il sistema');
    },
  },
  {
    nome: '4. leggiScelta e salvaScelta usano una chiave tutta loro, fuori dai dati dei bambini',
    prova() {
      vero(CHIAVE_TEMA !== 'pappatracker_data_v3', 'la chiave del tema non è quella dei dati');
      const d = deposito();
      uguale(leggiScelta(d), 'sistema', 'senza niente salvato');
      salvaScelta('scuro', d);
      uguale(d.dentro[CHIAVE_TEMA], 'scuro', 'scrive nella sua chiave');
      uguale(leggiScelta(d), 'scuro', 'rilegge quello che ha scritto');
      uguali(Object.keys(d.dentro), [CHIAVE_TEMA], 'non tocca nessun altra chiave');
      salvaScelta('pippo', d);
      uguale(leggiScelta(d), 'sistema', 'un valore sconosciuto non entra');
    },
  },
  {
    nome: '5. un deposito che lancia non ferma l’app: legge «sistema» e salva senza errori',
    prova() {
      uguale(leggiScelta(rotto), 'sistema');
      salvaScelta('scuro', rotto);
      salvaScelta('scuro', null);
      uguale(leggiScelta(null), 'sistema', 'niente deposito');
    },
  },
  {
    nome: '6. ogni tema ha la sua icona, la sua etichetta e il suo avviso, senza buchi',
    prova() {
      for (const t of TEMI) {
        vero(typeof ICONA[t] === 'string' && ICONA[t].length > 0, `manca l'icona di ${t}`);
        vero(!ICONA[t].includes('undefined') && !ICONA[t].includes('NaN'), `icona sporca: ${t}`);
        vero(ASPETTO[t] && ASPETTO[t].etichetta && ASPETTO[t].avviso, `manca l'aspetto di ${t}`);
      }
      uguali(Object.keys(ICONA).sort(), [...TEMI].sort(), 'le icone sono esattamente tre');
      // Il colore della barra di sistema esiste per i due temi che si vedono davvero.
      uguali(Object.keys(COLORE_BARRA).sort(), ['chiaro', 'scuro']);
    },
  },
  {
    nome: '7. applica() senza pagina non fa niente e non lancia',
    prova() {
      vero(typeof globalThis.document === 'undefined', 'questo caso ha senso solo fuori dal browser');
      applica('scuro');
      applica('scuro', null);
    },
  },
];
