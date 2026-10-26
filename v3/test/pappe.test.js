// Test della sezione Pappe della v3: catalogo, chiavi, punteggi ed elenco.
//
// Nessun caso usa la rete o il localStorage vero. Ogni caso mette `stato.data` a mano.
// Il DOM non serve: pappe.js lo tocca solo dentro disegna(), piu() e i gestori.

import { uguale, uguali, vero } from './aiuto.js';
import { stato } from '../dati.js';
import {
  CATEGORIE,
  ALIMENTI,
  GIUDIZI,
  alimento,
  chiavePappa,
  nomePappa,
  elenco,
  punteggio,
  gruppo,
} from '../pappe.js';

export const nome = 'pappe';

/** Mette `stato.data` a un contenuto noto, senza passare dal localStorage. */
function metti(dati) {
  stato.data = dati ? JSON.parse(JSON.stringify(dati)) : {};
  stato.sync = 'fermo';
}

/** Una pappa nuova (forma `foods`). */
function nuova(id, foods, liking) {
  return { id, foods, liking };
}

export const casi = [
  {
    // Il brief diceva 45: i preset della v2 sono 41 alimenti + 13 frutti = 54.
    nome: 'ALIMENTI copia i preset della v2 (41 + 13 frutti) e nessun id è doppio',
    prova: () => {
      uguale(ALIMENTI.length, 54, 'numero degli alimenti');
      uguale(new Set(ALIMENTI.map((a) => a.id)).size, ALIMENTI.length, 'id tutti diversi');
      const perCat = {};
      for (const a of ALIMENTI) perCat[a.cat] = (perCat[a.cat] || 0) + 1;
      uguali(perCat, { carb: 9, prot: 17, veg: 14, fat: 1, fruit: 13 }, 'alimenti per categoria');
      for (const a of ALIMENTI) {
        vero(CATEGORIE.some((c) => c.id === a.cat), `categoria nota per ${a.id}`);
        vero(a.nome && a.emoji, `nome ed emoji per ${a.id}`);
      }
    },
  },
  {
    nome: "alimento(): 'riso' ha nome 'Riso'; una frase del vecchio registro torna con l'emoji generica",
    prova: () => {
      uguale(alimento('riso').nome, 'Riso', 'nome del riso');
      const frase = alimento('30 g di zucchine e patate');
      uguale(frase.emoji, '🍽️', 'emoji generica');
      uguale(frase.nome, '30 g di zucchine e patate', "il nome è l'id");
      uguale(frase.id, '30 g di zucchine e patate', "l'id resta com'è");
    },
  },
  {
    nome: "chiavePappa(): l'ordine degli alimenti non conta",
    prova: () => {
      uguale(chiavePappa(['pera', 'mela']), chiavePappa(['mela', 'pera']), 'stessa chiave');
      uguale(chiavePappa(['pera', 'mela']), 'mela+pera', 'id ordinati, uniti da +');
    },
  },
  {
    nome: 'elenco(): una pappa con due good sta sopra una con due bad',
    prova: () => {
      metti({
        '2026-10-01': { Gabriel: { meals: [nuova('a', ['riso', 'pollo'], 'bad'), nuova('b', ['pastina', 'zucca'], 'good')] } },
        '2026-10-02': { Gabriel: { meals: [nuova('c', ['riso', 'pollo'], 'bad'), nuova('d', ['pastina', 'zucca'], 'good')] } },
      });
      const righe = elenco();
      uguale(righe.length, 2, 'due pappe diverse');
      uguale(righe[0].chiave, chiavePappa(['pastina', 'zucca']), 'sopra quella piaciuta');
      uguale(righe[1].chiave, chiavePappa(['riso', 'pollo']), 'sotto quella no');
      uguale(righe[0].gruppo, 'gradite', 'gruppo della prima');
      uguale(righe[1].gruppo, 'rivedere', 'gruppo della seconda');
    },
  },
  {
    nome: 'elenco(): una pappa con un solo giudizio sta nel gruppo poche',
    prova: () => {
      metti({ '2026-10-01': { Gabriel: { meals: [nuova('a', ['riso', 'pollo'], 'good')] } } });
      const righe = elenco();
      uguale(righe.length, 1, 'una riga');
      uguale(righe[0].gruppo, 'poche', 'gruppo');
    },
  },
  {
    nome: "elenco(): una pappa storica con 'items' e una nuova con 'foods' sugli stessi alimenti sono la stessa riga",
    prova: () => {
      metti({
        '2026-08-28': { Gabriel: { meals: [{ id: 'm1', liking: 'all', items: [
          { cat: 'prot', qty: 25, unit: 'g', foods: ['yogurt'] },
          { cat: 'fruit', qty: 40, unit: 'g', foods: ['mela', 'pera'] },
        ] }] } },
        '2026-09-28': { Vittorio: { meals: [nuova('m2', ['pera', 'yogurt', 'mela'], 'good')] } },
      });
      const righe = elenco();
      uguale(righe.length, 1, 'una riga sola');
      uguale(righe[0].conteggi.Gabriel.good, 1, "'all' storico conta come good");
      uguale(righe[0].conteggi.Vittorio.good, 1, 'il giudizio nuovo conta');
      uguale(righe[0].gruppo, 'gradite', 'due giudizi buoni: gradita');
    },
  },
  {
    nome: 'punteggio(): due good valgono più di un good e un bad',
    prova: () => {
      vero(
        punteggio({ good: 2, ok: 0, bad: 0 }) > punteggio({ good: 1, ok: 0, bad: 1 }),
        'due good battono good più bad'
      );
      uguale(punteggio({ good: 1, ok: 1, bad: 1 }), 0, 'good, ok e bad si annullano');
      uguale(punteggio({ good: 0, ok: 0, bad: 0 }), 0, 'senza giudizi vale zero');
      uguale(punteggio({ good: 0, ok: 0, bad: 2 }), -1, 'tutti bad vale -1');
    },
  },
  {
    nome: "nomePappa(): 'Pastina + Zucchina' e 'Pastina + Zucchina + Grana / Parmigiano'",
    prova: () => {
      uguale(nomePappa(['pastina', 'zucchina']), 'Pastina + Zucchina', 'due alimenti');
      uguale(nomePappa(['pastina', 'zucchina', 'grana']), 'Pastina + Zucchina + Grana / Parmigiano', 'tre alimenti');
    },
  },
  {
    nome: 'elenco(): i giudizi si contano separati per bambino',
    prova: () => {
      metti({
        '2026-10-01': { Gabriel: { meals: [nuova('a', ['riso', 'pollo'], 'good')] } },
        '2026-10-02': { Gabriel: { meals: [nuova('b', ['riso', 'pollo'], 'good')] } },
      });
      const r = elenco()[0];
      uguale(r.conteggi.Gabriel.good, 2, 'due good di Gabriel');
      uguale(r.conteggi.Vittorio.good, 0, 'nessun good di Vittorio');
      uguale(r.conteggi.Vittorio.ok + r.conteggi.Vittorio.bad, 0, 'niente altro per Vittorio');
    },
  },
  {
    nome: 'gruppo(): con meno di due giudizi sono poche; poi gradite, rivedere o neutre dal punteggio',
    prova: () => {
      uguale(gruppo({ good: 0, ok: 0, bad: 0 }), 'poche', 'nessun giudizio');
      uguale(gruppo({ good: 1, ok: 0, bad: 0 }), 'poche', 'un giudizio buono');
      uguale(gruppo({ good: 0, ok: 0, bad: 1 }), 'poche', 'un giudizio cattivo');
      uguale(gruppo({ good: 2, ok: 0, bad: 0 }), 'gradite', 'due buoni');
      uguale(gruppo({ good: 0, ok: 0, bad: 2 }), 'rivedere', 'due cattivi');
      uguale(gruppo({ good: 0, ok: 3, bad: 0 }), 'neutre', 'tutti così così: punteggio zero, non è un giudizio negativo');
      uguale(gruppo({ good: 1, ok: 0, bad: 1 }), 'neutre', 'pareri che si annullano');
      uguale(gruppo({ good: 0, ok: 2, bad: 1 }), 'rivedere', 'sotto zero: da rivedere');
      uguale(gruppo({ good: 3, ok: 1, bad: 1 }), 'gradite', 'più buoni che cattivi');
    },
  },
  {
    nome: 'elenco(): una pappa senza giudizio o senza alimenti non crea conteggi falsi',
    prova: () => {
      metti({
        '2026-10-01': { Gabriel: { meals: [
          { id: 'a', foods: ['riso'] },
          { id: 'b', foods: [], liking: 'good' },
        ] } },
      });
      const righe = elenco();
      uguale(righe.length, 1, 'la pappa senza alimenti non è una riga');
      uguale(righe[0].gruppo, 'poche', 'senza giudizi: poche');
      const c = righe[0].conteggi.Gabriel;
      uguale(c.good + c.ok + c.bad, 0, 'zero giudizi');
    },
  },
  {
    nome: 'alimento(): un personalizzato dello storico si legge col suo nome, senza entrare in ALIMENTI',
    prova: () => {
      metti({ customFoods: [{ id: 'mspwb9hcpv5yjb', name: 'Brodo vegetale', emoji: '🔥', cat: 'veg' }] });
      const a = alimento('mspwb9hcpv5yjb');
      uguale(a.nome, 'Brodo vegetale', 'nome dal campo name');
      uguale(a.emoji, '🔥', 'emoji del personalizzato');
      uguale(nomePappa(['pastina', 'mspwb9hcpv5yjb']), 'Pastina + Brodo vegetale', 'il nome entra nel nome della pappa');
      uguale(ALIMENTI.some((x) => x.id === 'mspwb9hcpv5yjb'), false, 'il catalogo resta di 54');
      uguale(alimento('riso').nome, 'Riso', 'i preset vincono e restano');
      metti({});
      uguale(alimento('mspwb9hcpv5yjb').nome, 'mspwb9hcpv5yjb', "senza customFoods torna il nome uguale all'id");
    },
  },
  {
    nome: 'elenco(): una frase libera del vecchio registro frutta rende la riga solo lettura; un personalizzato no',
    prova: () => {
      metti({
        customFoods: [{ id: 'cf1', name: 'Brodo vegetale', emoji: '🔥', cat: 'veg' }],
        customFruits: [{ id: '30 g di zucchine e patate', name: '30 g di zucchine e patate', emoji: '🍽️' }],
        '2026-10-01': { Gabriel: { meals: [
          nuova('a', ['30 g di zucchine e patate'], 'good'),
          nuova('b', ['pastina', 'cf1'], 'good'),
          nuova('c', ['pastina', 'zucchina'], 'good'),
        ] } },
      });
      const per = {};
      for (const r of elenco()) per[r.chiave] = r;
      uguale(per['30 g di zucchine e patate'].soloLettura, true, 'la frase libera non si tocca');
      uguale(per[chiavePappa(['pastina', 'cf1'])].soloLettura, false, 'il personalizzato è un alimento vero');
      uguale(per[chiavePappa(['pastina', 'zucchina'])].soloLettura, false, 'i preset sono toccabili');
      uguale(per['30 g di zucchine e patate'].nome, '30 g di zucchine e patate', 'la riga resta leggibile');
      uguale(ALIMENTI.length, 54, 'la frase non entra nel catalogo');
    },
  },
  {
    nome: 'elenco(): una pappa con tutti così così sta nel gruppo neutre',
    prova: () => {
      metti({
        '2026-10-01': { Gabriel: { meals: [nuova('a', ['riso', 'pollo'], 'ok')] } },
        '2026-10-02': { Vittorio: { meals: [nuova('b', ['riso', 'pollo'], 'ok')] } },
      });
      uguale(elenco()[0].gruppo, 'neutre', 'due così così');
    },
  },
  {
    nome: 'GIUDIZI e CATEGORIE: valori della specifica',
    prova: () => {
      uguali(GIUDIZI, { good: { e: '👍', l: 'Piaciuta' }, ok: { e: '😐', l: 'Così così' }, bad: { e: '👎', l: 'No' } }, 'giudizi');
      uguali(CATEGORIE.map((c) => c.id), ['carb', 'prot', 'veg', 'fat', 'fruit'], 'ordine delle categorie');
    },
  },
];
