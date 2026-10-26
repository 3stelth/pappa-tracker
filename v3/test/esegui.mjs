#!/usr/bin/env node
// Lanciatore dei test della v3, da riga di comando.
//
//   node v3/test/esegui.mjs            lancia tutti i moduli *.test.js
//   node v3/test/esegui.mjs dati       lancia solo quelli nominati
//
// Esce con 1 se almeno un caso è fallito. Un modulo non ancora scritto si salta,
// e lo dice: serve mentre più persone costruiscono pezzi diversi nello stesso momento.

import { access, readdir } from 'node:fs/promises';

const QUI = new URL('./', import.meta.url);

const chiesti = process.argv.slice(2);
let nomi = chiesti;
if (nomi.length === 0) {
  const file = await readdir(QUI);
  nomi = file
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => f.slice(0, -'.test.js'.length))
    .sort();
}

let passati = 0;
let falliti = 0;
const saltati = [];
const rotti = [];

for (const nome of nomi) {
  const file = new URL(`./${nome}.test.js`, QUI);

  // Un modulo di test che non c'è ancora si salta. Un modulo che c'è ma non si carica
  // è un fallimento: se guardassimo solo il messaggio dell'errore, un import rotto
  // dentro il test passerebbe per «file mancante».
  try {
    await access(file);
  } catch {
    saltati.push(nome);
    console.log(`- ${nome}: il modulo non c'è ancora, lo salto`);
    continue;
  }

  let modulo;
  try {
    modulo = await import(file.href);
  } catch (errore) {
    rotti.push(nome);
    console.log(`\n== ${nome} ==`);
    console.log(`  FALLITO  il modulo non si carica`);
    console.log(`       ${errore.message}`);
    continue;
  }

  console.log(`\n== ${modulo.nome || nome} ==`);
  if (!Array.isArray(modulo.casi)) {
    rotti.push(nome);
    console.log(`  FALLITO  il modulo non esporta 'casi'`);
    continue;
  }
  for (const caso of modulo.casi) {
    try {
      await caso.prova();
      passati += 1;
      console.log(`  ok   ${caso.nome}`);
    } catch (errore) {
      falliti += 1;
      console.log(`  FALLITO  ${caso.nome}`);
      console.log(`       ${errore.message}`);
    }
  }
}

console.log(`\n${passati} casi su ${passati + falliti}`);
if (saltati.length) console.log(`moduli non ancora scritti: ${saltati.join(', ')}`);
if (rotti.length) console.log(`moduli che non si caricano: ${rotti.join(', ')}`);

process.exit(falliti || rotti.length ? 1 : 0);
