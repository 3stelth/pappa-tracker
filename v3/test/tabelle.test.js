// Le tabelle OMS sono il dato più delicato del progetto: un valore sbagliato qui
// diventa un percentile sbagliato sullo schermo. Questo test ricalcola dalle LMS i
// valori che l'OMS pubblica nello stesso file, per tutti i 1857 giorni, le due misure
// e i sette punteggi z da -3 a +3.
//
// Il controllo si ferma a ±3 di proposito. Oltre quella soglia l'OMS non usa le LMS:
// estrapola in modo lineare, e le colonne a ±4 infatti non tornano (scarto fino a
// 0,05). Non è un errore del file.

import { leggiJson, uguale, vero, vicino } from './aiuto.js';

export const nome = 'tabelle';

const TOLLERANZA = 0.001;
// L'OMS pubblica i valori arrotondati alla terza cifra, quindi lo scarto non può
// superare mezzo millesimo. Il margine di 1e-9 copre la polvere della virgola mobile:
// il caso peggiore reale vale 0,0005000000000023874.
const SCARTO_ATTESO = 0.0005 + 1e-9;
const GIORNI = 1857;
const CONFRONTI = 25998; // 1857 giorni x 2 misure x 7 punteggi z

let cache = null;
async function carica() {
  if (!cache) {
    const [peso, lunghezza, sd, riferimento] = await Promise.all([
      leggiJson('dati/oms-peso-giorni.json'),
      leggiJson('dati/oms-lunghezza-giorni.json'),
      leggiJson('test/oms-sd-pubblicati.json'),
      leggiJson('test/riferimento-z.json'),
    ]);
    cache = { tabelle: { peso, lunghezza }, sd, riferimento };
  }
  return cache;
}

function valoreA([L, M, S], z) {
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

function zDa(valore, [L, M, S]) {
  return Math.abs(L) < 1e-9
    ? Math.log(valore / M) / S
    : (Math.pow(valore / M, L) - 1) / (L * S);
}

/** Ricalcola tutte le colonne pubblicate. Torna il conto dei confronti e lo scarto peggiore. */
async function confronta() {
  const { tabelle, sd } = await carica();
  let confronti = 0;
  let peggiore = 0;
  let dove = null;
  for (const misura of ['peso', 'lunghezza']) {
    const giorni = tabelle[misura].giorni;
    for (let g = 0; g < giorni.length; g += 1) {
      for (let i = 0; i < sd.z.length; i += 1) {
        const atteso = sd[misura][g][i];
        const scarto = Math.abs(valoreA(giorni[g], sd.z[i]) - atteso);
        if (scarto > peggiore) {
          peggiore = scarto;
          dove = `${misura}, giorno ${g}, z ${sd.z[i]}`;
        }
        confronti += 1;
      }
    }
  }
  return { confronti, peggiore, dove };
}

export const casi = [
  {
    nome: 'le due tabelle hanno 1857 giorni',
    prova: async () => {
      const { tabelle } = await carica();
      uguale(tabelle.peso.giorni.length, GIORNI, 'giorni del peso');
      uguale(tabelle.lunghezza.giorni.length, GIORNI, 'giorni della lunghezza');
      uguale(tabelle.peso.unita, 'kg', 'unità del peso');
      uguale(tabelle.lunghezza.unita, 'cm', 'unità della lunghezza');
    },
  },
  {
    nome: 'le LMS riproducono i valori pubblicati dall OMS, 25998 confronti',
    prova: async () => {
      const { confronti, peggiore, dove } = await confronta();
      uguale(confronti, CONFRONTI, 'numero dei confronti');
      vero(
        peggiore <= TOLLERANZA,
        `scarto massimo ${peggiore} oltre la tolleranza ${TOLLERANZA}, su ${dove}`
      );
    },
  },
  {
    nome: 'lo scarto massimo resta dentro l arrotondamento dell OMS',
    prova: async () => {
      const { peggiore, dove } = await confronta();
      vero(
        peggiore <= SCARTO_ATTESO,
        `scarto massimo ${peggiore} oltre ${SCARTO_ATTESO} atteso, su ${dove}`
      );
    },
  },
  {
    nome: 'i casi di riferimento tornano entro 1e-7',
    prova: async () => {
      const { tabelle, riferimento } = await carica();
      vero(riferimento.casi.length > 300, `attesi più di 300 casi, trovati ${riferimento.casi.length}`);
      for (const caso of riferimento.casi) {
        const terna = tabelle[caso.misura].giorni[caso.giorni];
        vicino(zDa(caso.valore, terna), caso.z, 1e-7, `${caso.misura}, giorno ${caso.giorni}`);
      }
    },
  },
  {
    nome: 'il giorno 0 ha la mediana che si aspetta un neonato a termine',
    prova: async () => {
      const { tabelle } = await carica();
      const [, mPeso] = tabelle.peso.giorni[0];
      const [, mLunghezza] = tabelle.lunghezza.giorni[0];
      vero(mPeso > 3.3 && mPeso < 3.4, `mediana del peso al giorno 0: ${mPeso}`);
      vero(mLunghezza > 49 && mLunghezza < 50, `mediana della lunghezza al giorno 0: ${mLunghezza}`);
    },
  },
];
