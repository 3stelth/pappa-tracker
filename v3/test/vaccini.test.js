// Test della sezione Vaccini della v3.
//
// I casi 1-9 e 13 leggono dati/vaccini.json. Quel file sta in .gitignore (lotti e date
// di due minori): c'è sul computer di famiglia, non nel repository pubblico. Senza di lui
// questi casi non affermano niente e il loro nome dice «SALTATO». I casi 12 e 14-19
// usano dati inventati e girano sempre. Nessun lotto vero sta in questo file: i casi
// che cercano un lotto lo leggono dal file dei dati.
//
// Nessun caso usa la rete o il localStorage vero: i casi che scrivono accendono prima
// provaSenzaScritture.

import { uguale, uguali, vero } from './aiuto.js';
import { leggiJson } from './aiuto.js';
import { stato, vaccini, provaSenzaScritture } from '../dati.js';
import { NASCITA, TERMINE, etaScritta } from '../crescita.js';
import { dataLunga } from '../app.js';
import {
  cerca, evidenzia, contaVoci, rigaSeduta, cronologia, aggiungiVoce, salvaVoce,
  controllaData,
} from '../vaccini.js';

export const nome = 'vaccini';

/** Legge il file dei vaccini. Torna null se non c'è. */
async function leggiFile() {
  try {
    return await leggiJson('dati/vaccini.json');
  } catch (errore) {
    if (errore && (errore.code === 'ENOENT' || /ENOENT|404/.test(String(errore.message)))) return null;
    throw errore;
  }
}

const FILE = await leggiFile();
const SALTATO = FILE ? '' : ' [SALTATO: manca dati/vaccini.json]';

/** Esegue `f(dati)` col file letto. Se il file manca il caso non afferma niente: il nome lo dichiara. */
function conFile(f) {
  return async () => {
    if (FILE) await f(FILE);
  };
}

/** Dati inventati, della stessa forma del file vero. I lotti non esistono. */
function finti() {
  return {
    aggiornatoAl: '2026-01-10',
    stato: 'In regola',
    emessoDa: 'Ente di prova',
    sedute: [
      {
        data: '2026-03-03',
        bambini: ['Gabriel', 'Vittorio'],
        voci: [
          { nome: 'Sestavalente', prodotto: 'Prodotto Uno', sigla: 'SIG', dose: 1, lotto: 'PROVA001',
            tipo: 'vaccino', via: 'iniezione', copre: ['tetano', 'pertosse'] },
          { nome: 'Gocce', prodotto: 'Gocce', dose: 1, lotto: 'PROVA002',
            tipo: 'vaccino', via: 'bocca', copre: ['gocce'] },
        ],
      },
      {
        data: '2026-05-19',
        bambini: ['Gabriel', 'Vittorio'],
        voci: [
          { nome: 'Sestavalente', prodotto: 'Prodotto Uno', sigla: 'SIG', dose: 2, lotto: 'PROVA003',
            tipo: 'vaccino', via: 'iniezione', copre: ['tetano', 'pertosse'] },
        ],
      },
    ],
  };
}

async function zitto(f) {
  const vecchia = console.log;
  console.log = () => {};
  try {
    return await f();
  } finally {
    console.log = vecchia;
  }
}

export const casi = [
  {
    nome: '0. senza vaccini nei dati, la sezione dice «nessun vaccino ancora» e non va in errore',
    prova: () => {
      const prima = stato.data;
      stato.data = {};
      try {
        uguale(vaccini(), null, 'senza vaccini vaccini() torna null');
        for (const html of [cronologia(vaccini(), ''), cronologia(null, 'x'), cronologia({ sedute: [] }, '')]) {
          vero(typeof html === 'string' && html.length > 0, 'la cronologia torna del testo');
        }
        vero(/nessun vaccino ancora/i.test(cronologia(null, '')), 'manca «nessun vaccino ancora»');
        uguali(contaVoci(null), { sedute: 0, somministrazioni: 0 }, 'contaVoci(null)');
        uguali(cerca(null, 'x'), [], 'cerca(null)');
      } finally {
        stato.data = prima;
      }
    },
  },
  {
    nome: '1. dati/vaccini.json si legge e ha aggiornatoAl 2026-10-26' + SALTATO,
    prova: conFile((dati) => {
      uguale(dati.aggiornatoAl, '2026-10-26', 'aggiornatoAl');
    }),
  },
  {
    nome: '2. contaVoci(): 5 sedute e 10 somministrazioni' + SALTATO,
    prova: conFile((dati) => {
      uguali(contaVoci(dati.sedute), { sedute: 5, somministrazioni: 10 }, 'conteggio');
    }),
  },
  {
    nome: '3. l\'esavalente del 3 marzo è una voce sola, con sei malattie in copre' + SALTATO,
    prova: conFile((dati) => {
      const seduta = dati.sedute.find((s) => s.data === '2026-03-03');
      vero(seduta, 'manca la seduta del 3 marzo');
      const esa = seduta.voci.filter((v) => v.nome === 'Esavalente');
      uguale(esa.length, 1, 'voci Esavalente il 3 marzo');
      uguale(esa[0].copre.length, 6, 'malattie coperte');
    }),
  },
  {
    nome: '4. il Beyfortus ha tipo profilassi, non vaccino' + SALTATO,
    prova: conFile((dati) => {
      const voci = dati.sedute.flatMap((s) => s.voci).filter((v) => v.nome === 'Beyfortus');
      uguale(voci.length, 1, 'voci Beyfortus');
      uguale(voci[0].tipo, 'profilassi', 'tipo');
    }),
  },
  {
    nome: '5. ogni seduta ha bambini Gabriel e Vittorio' + SALTATO,
    prova: conFile((dati) => {
      for (const s of dati.sedute) uguali(s.bambini, ['Gabriel', 'Vittorio'], 'bambini del ' + s.data);
    }),
  },
  {
    nome: '6. cerca(sedute, lotto della prima dose di esavalente) trova una voce sola, quella del 3 marzo' + SALTATO,
    prova: conFile((dati) => {
      // Il lotto si legge dal file: nel codice del repository pubblico non ne sta nessuno.
      const esa = dati.sedute.find((x) => x.data === '2026-03-03').voci.find((v) => v.nome === 'Esavalente' && v.dose === 1);
      vero(esa && esa.lotto, "nel file manca l'esavalente dose 1 del 3 marzo");
      const r = cerca(dati.sedute, esa.lotto);
      uguale(r.length, 1, 'sedute trovate');
      uguale(r[0].data, '2026-03-03', 'data');
      uguale(r[0].voci.length, 1, 'voci trovate');
      uguale(r[0].voci[0].lotto, esa.lotto, 'lotto');
    }),
  },
  {
    nome: '7. cerca(sedute, difterite) trova le due voci dell\'esavalente' + SALTATO,
    prova: conFile((dati) => {
      const voci = cerca(dati.sedute, 'difterite').flatMap((s) => s.voci);
      uguale(voci.length, 2, 'voci trovate');
      vero(voci.every((v) => v.nome === 'Esavalente'), 'non sono tutte esavalente');
    }),
  },
  {
    nome: '8. cerca(sedute, pippo) non trova niente' + SALTATO,
    prova: conFile((dati) => {
      uguali(cerca(dati.sedute, 'pippo'), [], 'risultato');
    }),
  },
  {
    nome: '9. cerca(sedute, "") torna tutte le cinque sedute' + SALTATO,
    prova: conFile((dati) => {
      uguale(cerca(dati.sedute, '').length, 5, 'sedute');
      uguale(cerca(dati.sedute, '   ').length, 5, 'sedute con soli spazi');
    }),
  },
  {
    nome: '10. evidenzia(Hexyon, hex) contiene <mark>Hex</mark>',
    prova: () => {
      vero(evidenzia('Hexyon', 'hex').includes('<mark>Hex</mark>'), evidenzia('Hexyon', 'hex'));
    },
  },
  {
    nome: '11. evidenzia(a+b, a+) non manda in errore la regexp',
    prova: () => {
      uguale(evidenzia('a+b', 'a+'), '<mark>a+</mark>b', 'testo evidenziato');
      for (const q of ['(', '[', '\\', '*', '?', '$^', '.*']) evidenzia('prova (x) [y]', q);
    },
  },
  {
    nome: '12. etaScritta(TERMINE, 23 febbraio) è «non ancora al termine»; nessuna data di seduta dà Invalid Date',
    prova: () => {
      uguale(etaScritta(TERMINE, '2026-02-23'), 'non ancora al termine', 'età corretta del 23 febbraio');
      // Le sedute del file se c'è, altrimenti le date del brief: nessuna è un dato sanitario.
      const date = FILE ? FILE.sedute.map((x) => x.data)
        : ['2026-02-23', '2026-03-03', '2026-04-03', '2026-05-19', '2026-06-23'];
      for (const data of date) {
        for (const t of [dataLunga(data), etaScritta(NASCITA, data), etaScritta(TERMINE, data)]) {
          vero(!/Invalid|NaN|undefined/.test(t), `data ${data}: «${t}»`);
        }
      }
    },
  },
  {
    nome: '13. rigaSeduta() non contiene undefined, NaN o Invalid Date' + SALTATO,
    prova: conFile((dati) => {
      for (const s of dati.sedute) {
        const html = rigaSeduta(s, '');
        vero(!/undefined|NaN|Invalid Date|\[object/.test(html), 'seduta ' + s.data);
      }
    }),
  },
  {
    nome: '14. con dati inventati: cerca e rigaSeduta funzionano, voce per voce',
    prova: () => {
      const d = finti();
      uguali(contaVoci(d.sedute), { sedute: 2, somministrazioni: 3 }, 'conteggio');
      uguale(cerca(d.sedute, 'prova003').length, 1, 'lotto, senza badare alle maiuscole');
      uguale(cerca(d.sedute, 'tetano').flatMap((s) => s.voci).length, 2, 'malattia');
      uguale(cerca(d.sedute, 'bocca').flatMap((s) => s.voci).length, 1, 'per bocca');
      uguale(cerca(d.sedute, 'sestavalente')[0].voci.length, 1, 'filtra le voci dentro la seduta');
      const riga = rigaSeduta(d.sedute[0], 'prova001');
      vero(riga.includes('<mark>PROVA001</mark>'), 'il lotto cercato è evidenziato');
      vero(!/undefined|NaN|Invalid Date/.test(riga), 'niente undefined');
      // una iniezione, una voce: nessun chip ripetuto per sestavalente con due malattie in una riga sola
      uguale((riga.match(/class="vax /g) || []).length, 2, 'due voci, due righe');
    },
  },
  {
    nome: '15. il testo scritto a mano non diventa HTML',
    prova: () => {
      uguale(evidenzia('<b>x</b>', 'x'), '&lt;b&gt;<mark>x</mark>&lt;/b&gt;', 'evidenzia esce dal testo');
      const d = finti();
      d.sedute[0].voci[0].nome = '<img src=x onerror=alert(1)>';
      const html = rigaSeduta(d.sedute[0], '');
      vero(!html.includes('<img'), 'il nome non va in pagina come tag');
      vero(!/Nessun risultato per «<b>/.test(cronologia(d, '<b>')), 'la query non va in pagina come tag');
    },
  },
  {
    nome: '16. aggiungiVoce: unisce alla seduta della stessa data, o ne crea una, in ordine; non tocca l\'originale',
    prova: () => {
      const d = finti();
      const copia = JSON.stringify(d);
      const voce = { nome: 'Nuovo', lotto: 'PROVA009', tipo: 'vaccino', via: 'iniezione', copre: [] };

      const unita = aggiungiVoce(d, '2026-03-03', ['Gabriel', 'Vittorio'], voce);
      uguale(unita.sedute.length, 2, 'stessa data e stessi bambini: nessuna seduta nuova');
      uguale(unita.sedute[0].voci.length, 3, 'la voce è nella seduta del 3 marzo');

      const solo = aggiungiVoce(d, '2026-03-03', ['Gabriel'], voce);
      uguale(solo.sedute.length, 3, 'stessa data ma un bambino solo: seduta nuova');

      const prima = aggiungiVoce(d, '2026-01-02', ['Gabriel', 'Vittorio'], voce);
      uguali(prima.sedute.map((s) => s.data), ['2026-01-02', '2026-03-03', '2026-05-19'], 'ordine per data');

      uguale(JSON.stringify(d), copia, 'l\'originale non cambia');
      uguale(unita.stato, 'In regola', 'gli altri campi restano');

      const da0 = aggiungiVoce(null, '2026-06-01', ['Vittorio'], voce);
      uguali(contaVoci(da0.sedute), { sedute: 1, somministrazioni: 1 }, 'da nessun dato');
      uguale(da0.stato, undefined, 'senza dati non si inventa «In regola»');
    },
  },
  {
    nome: '17. salvaVoce scrive passando da scriviVaccini (con le scritture spente)',
    prova: async () => {
      const prima = stato.data;
      stato.data = { vaccini: finti() };
      try {
        await zitto(() => {
          provaSenzaScritture(true);
          try {
            salvaVoce('2026-06-23', ['Gabriel', 'Vittorio'], {
              nome: 'Prova', lotto: 'PROVA777', tipo: 'vaccino', via: 'iniezione', copre: [],
            });
          } finally {
            provaSenzaScritture(false);
          }
        });
        uguali(contaVoci(vaccini().sedute), { sedute: 3, somministrazioni: 4 }, 'dopo la scrittura');
        vero(typeof vaccini().modificatoAt === 'number', 'scriviVaccini segna modificatoAt');
      } finally {
        stato.data = prima;
      }
    },
  },
  {
    nome: '18. la parola «lotto» non trova tutte le voci; il numero di lotto sì',
    prova: () => {
      const d = finti();
      uguali(cerca(d.sedute, 'lotto'), [], 'l\'etichetta non si cerca');
      uguale(cerca(d.sedute, 'PROVA002').flatMap((x) => x.voci).length, 1, 'il lotto si trova');
      vero(rigaSeduta(d.sedute[0], '').includes('lotto PROVA001'), 'l\'etichetta si legge ancora');
      vero(rigaSeduta(d.sedute[0], 'otto').includes('lotto PROVA001'), 'la ricerca non evidenzia l\'etichetta');
    },
  },
  {
    nome: '19. controllaData rifiuta date impossibili, future o prima della nascita',
    prova: () => {
      const oggi = '2026-10-26';
      uguale(controllaData('2026-06-23', oggi), '', 'data buona');
      uguale(controllaData(NASCITA, oggi), '', 'il giorno della nascita va bene');
      uguale(controllaData(oggi, oggi), '', 'oggi va bene');
      vero(controllaData('2026-10-27', oggi) !== '', 'domani');
      vero(controllaData('2025-12-07', oggi) !== '', 'prima della nascita');
      vero(controllaData('2026-02-30', oggi) !== '', '30 febbraio');
      for (const brutta of ['', 'ieri', '23/06/2026', null, undefined]) {
        vero(controllaData(brutta, oggi) !== '', `«${brutta}»`);
      }
    },
  },
];
