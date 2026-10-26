// Il grafico della crescita e le decisioni della sezione Crescita.
//
// Qui si controlla che il disegno non inventi numeri: un 'NaN' nell'SVG sparisce dallo
// schermo senza errori, e una linea disegnata senza bande non vuol dire niente.
//
// Si controlla anche quello che la sezione decide prima di disegnare: da quale data si
// contano i giorni, quale interruttore è accesso, quale percentile va in quale carta.
// Lo schermo e lo stato non possono dire due cose diverse: un percentile contato dalla
// nascita sotto l'etichetta «Età corretta» è l'anti-obiettivo numero uno del progetto.

import { leggiJson, uguale, uguali, vero, vicino } from './aiuto.js';
import * as c from '../crescita.js';
import { SENZA_BANDE, Z_BANDE, bande, disegnaGrafico, finestra } from '../grafico.js';
import {
  TESTO_ATTESA,
  TESTO_ERRORE,
  cartaPercentile,
  invitoLunghezza,
  markup,
  partenzaDi,
} from '../crescita-vista.js';

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

/** Il solo testo di un SVG: il messaggio va a capo in più <tspan>. */
function testoDi(svg) {
  return svg
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Se l'elemento con quell'attributo ha la classe `on` nel markup. */
function acceso(html, attributo, valore) {
  const trovato = new RegExp(`<[a-z]+([^>]*?)\\s${attributo}="${valore}"`).exec(html);
  if (!trovato) throw new Error(`non trovo ${attributo}="${valore}" nel markup`);
  return /class="[^"]*\bon\b/.test(trovato[1]);
}

const SERIE_VERA = {
  Gabriel: [
    { giorni: 14, valore: 2.97 },
    { giorni: 234, valore: 8.29 },
  ],
  Vittorio: [{ giorni: 14, valore: 2.125 }],
};

// Pesate vere dei due bambini, già nel database pubblico.
const PESATE = {
  Gabriel: [
    { iso: '2026-03-19', kg: 2.97 },
    { iso: '2026-10-25', kg: 8.29 },
  ],
  Vittorio: [
    { iso: '2026-03-19', kg: 2.125 },
    { iso: '2026-10-25', kg: 6.45 },
  ],
};

export const casi = [
  {
    nome: 'le cinque bande hanno i valori z dell OMS, non altri',
    prova: () => {
      // Un errore di battitura qui (−1,881 che diventa −1,181) sposterebbe la banda P3
      // senza far cadere nessun altro test, e la linea di un bambino sembrerebbe sotto
      // P3 quando non lo è.
      uguali(
        Z_BANDE,
        [
          [-1.881, 'P3'],
          [-1.036, 'P15'],
          [0, 'P50'],
          [1.036, 'P85'],
          [1.881, 'P97'],
        ],
        'i cinque z e le cinque etichette delle bande'
      );
    },
  },
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
    nome: 'senza bande il grafico non si disegna e lo dice',
    prova: async () => {
      await pronte();
      // Oltre il giorno 1856 le tabelle finiscono. Senza bande, la linea del bambino
      // da sola non dice dove sta: l asse y si scalerebbe sui suoi pesi e la linea
      // finirebbe in alto nel riquadro.
      const svg = disegnaGrafico({
        misura: 'peso',
        serie: {
          Gabriel: [
            { giorni: 2000, valore: 18 },
            { giorni: 2100, valore: 19 },
          ],
          Vittorio: [],
        },
        giorniDa: 1900,
        giorniA: 2100,
      });
      uguale(conta(svg, 'class="serie"'), 0, 'nessuna linea senza bande');
      uguale(conta(svg, 'class="punto"'), 0, 'nessun pallino senza bande');
      uguale(conta(svg, 'class="asse-y"'), 0, 'nessun asse y senza bande');
      uguale(testoDi(svg), SENZA_BANDE, 'il grafico dice che le bande mancano');
    },
  },
  {
    nome: 'chi disegna puo dire perche le bande mancano',
    prova: async () => {
      await pronte();
      const svg = disegnaGrafico({
        misura: 'peso',
        serie: {},
        giorniDa: 1900,
        giorniA: 2100,
        messaggio: TESTO_ATTESA,
      });
      uguale(testoDi(svg), TESTO_ATTESA, 'compare il messaggio di chi chiama');
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

  // ── le decisioni della sezione ──

  {
    nome: 'l eta corretta parte dal termine, l anagrafica dalla nascita',
    prova: () => {
      uguale(partenzaDi('corretta'), c.TERMINE, 'partenza dell età corretta');
      uguale(partenzaDi('anagrafica'), c.NASCITA, 'partenza dell età anagrafica');
    },
  },
  {
    nome: 'gli interruttori accesi nel markup sono quelli dello stato',
    prova: () => {
      // Il difetto che questo caso guarda: il markup con class="on" scritto fisso.
      // app.js svuota #vista e richiama disegna() a ogni ritorno sulla sezione, mentre
      // lo stato sopravvive: lo schermo mostrerebbe «Età corretta» acceso sopra
      // percentili contati dalla nascita.
      const primo = markup({ eta: 'corretta', misura: 'peso', periodo: 'tutto' });
      vero(acceso(primo, 'data-eta', 'corretta'), 'età corretta accesa');
      vero(!acceso(primo, 'data-eta', 'anagrafica'), 'età anagrafica spenta');
      vero(acceso(primo, 'data-misura', 'peso'), 'peso acceso');
      vero(!acceso(primo, 'data-misura', 'lunghezza'), 'lunghezza spenta');
      vero(acceso(primo, 'data-periodo', 'tutto'), 'tutto acceso');
      vero(!acceso(primo, 'data-periodo', '1m'), '1m spento');

      const altro = markup({ eta: 'anagrafica', misura: 'lunghezza', periodo: '1m' });
      vero(acceso(altro, 'data-eta', 'anagrafica'), 'età anagrafica accesa');
      vero(!acceso(altro, 'data-eta', 'corretta'), 'età corretta spenta');
      vero(acceso(altro, 'data-misura', 'lunghezza'), 'lunghezza accesa');
      vero(!acceso(altro, 'data-misura', 'peso'), 'peso spento');
      vero(acceso(altro, 'data-periodo', '1m'), '1m acceso');
      vero(!acceso(altro, 'data-periodo', 'tutto'), 'tutto spento');
    },
  },
  {
    nome: 'senza le tabelle la carta non scrive nessun percentile',
    prova: async () => {
      await pronte();
      for (const [tabelle, atteso] of [
        ['attesa', TESTO_ATTESA],
        ['errore', TESTO_ERRORE],
      ]) {
        const carta = cartaPercentile({
          bambino: 'Gabriel',
          righe: PESATE.Gabriel,
          misura: 'peso',
          eta: 'corretta',
          tabelle,
        });
        uguale(carta.percentile, undefined, `con tabelle '${tabelle}' nessun percentile`);
        uguale(carta.z, undefined, `con tabelle '${tabelle}' nessun punteggio z`);
        uguale(carta.nota, atteso, `con tabelle '${tabelle}' il testo giusto`);
      }
      vero(TESTO_ATTESA !== TESTO_ERRORE, 'attesa ed errore si scrivono in modo diverso');
    },
  },
  {
    nome: 'la carta porta con se l eta con cui ha contato i giorni',
    prova: async () => {
      await pronte();
      // Il percentile e l'etichetta che lo spiega escono insieme: chi disegna non può
      // scrivere «Età corretta» sopra un numero contato dalla nascita.
      const corretta = cartaPercentile({
        bambino: 'Gabriel',
        righe: PESATE.Gabriel,
        misura: 'peso',
        eta: 'corretta',
        tabelle: 'pronte',
      });
      const anagrafica = cartaPercentile({
        bambino: 'Gabriel',
        righe: PESATE.Gabriel,
        misura: 'peso',
        eta: 'anagrafica',
        tabelle: 'pronte',
      });
      uguale(corretta.eta, 'corretta', 'l età della carta corretta');
      uguale(anagrafica.eta, 'anagrafica', 'l età della carta anagrafica');
      // Il numero anagrafico si scrive accanto alla sua data di partenza: un
      // interruttore sbagliato non basta a farlo leggere come età corretta.
      uguale(corretta.etaNota, undefined, 'l età corretta è quella di sempre, non si nota');
      uguale(
        anagrafica.etaNota,
        'contato dall’età anagrafica',
        'il numero anagrafico porta addosso la sua data di partenza'
      );
      vero(
        corretta.percentile !== anagrafica.percentile,
        `le due età danno percentili diversi: ${corretta.percentile} e ${anagrafica.percentile}`
      );
    },
  },
  {
    nome: 'i quattro percentili veri, come li scrive la carta',
    prova: async () => {
      await pronte();
      const attesi = {
        Gabriel: ['40°', 'z −0,25', 'alla prima misura 5°, z −1,61'],
        Vittorio: ['<1°', 'z −2,52', 'alla prima misura <1°, z −3,74'],
      };
      for (const bambino of ['Gabriel', 'Vittorio']) {
        const carta = cartaPercentile({
          bambino,
          righe: PESATE[bambino],
          misura: 'peso',
          eta: 'corretta',
          tabelle: 'pronte',
        });
        const [p, z, prima] = attesi[bambino];
        uguale(carta.percentile, p, `${bambino}: percentile di oggi`);
        uguale(carta.z, z, `${bambino}: punteggio z di oggi`);
        uguale(carta.prima, prima, `${bambino}: percentile della prima misura`);
      }
    },
  },
  {
    nome: 'con una misura sola non c e il percentile di partenza',
    prova: async () => {
      await pronte();
      const carta = cartaPercentile({
        bambino: 'Gabriel',
        righe: [PESATE.Gabriel[1]],
        misura: 'peso',
        eta: 'corretta',
        tabelle: 'pronte',
      });
      uguale(carta.percentile, '40°', 'il percentile di oggi c è');
      uguale(carta.prima, undefined, 'il percentile di partenza non c è');
    },
  },
  {
    nome: 'fuori dalle tabelle la carta non scrive un percentile',
    prova: async () => {
      await pronte();
      const carta = cartaPercentile({
        bambino: 'Gabriel',
        righe: [{ iso: '2026-02-23', kg: 1.8 }], // dieci giorni prima del termine
        misura: 'peso',
        eta: 'corretta',
        tabelle: 'pronte',
      });
      uguale(carta.percentile, undefined, 'nessun percentile prima del termine');
      uguale(carta.fuori, 'fuori dalle tabelle OMS', 'lo dice');
      uguale(carta.motivo, c.MOTIVO_FUORI_TABELLA, 'con il motivo di crescita.js');
    },
  },
  {
    nome: 'l invito della lunghezza non afferma il falso con una misura sola',
    prova: () => {
      vero(invitoLunghezza(0).includes('Nessuna lunghezza'), 'con zero misure');
      vero(!invitoLunghezza(1).includes('Nessuna lunghezza'), 'con una misura non dice zero');
      vero(invitoLunghezza(1).includes('Una sola lunghezza'), 'con una misura lo dice');
      vero(invitoLunghezza(1).includes('la seconda'), 'con una misura chiede la seconda');
      vero(invitoLunghezza(0).includes('la prima'), 'con zero misure chiede la prima');
    },
  },
  {
    nome: 'i quattro percentili veri che compaiono nella sezione',
    prova: async () => {
      await pronte();
      // La catena completa, numero per numero: giorni di età corretta, punteggio z,
      // percentile, forma scritta.
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
