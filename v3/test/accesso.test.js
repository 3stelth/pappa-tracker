// Test dell'accesso della v3.
//
// Nessun caso usa la rete vera e nessuno tocca il localStorage vero: `senzaMondo`
// mette al loro posto una fetch finta e un deposito finto, e li rimette alla fine.
//
// La password che compare qui è inventata. Quella vera non sta in nessun file.

import { uguale, uguali, vero } from './aiuto.js';
import { CHIAVE_SUPABASE } from '../supabase.js';
import {
  token,
  entra,
  esci,
  haSessione,
  onScaduta,
  sessioneDiProva,
  emailDellaSessione,
} from '../accesso.js';
import { avvia, stato } from '../dati.js';

export const nome = 'accesso';

const CHIAVE_SESSIONE = 'pappatracker_sessione_v3';

/** Una sessione come quella salvata, con la scadenza che decide il caso. */
function sessione(fraQuantiSecondi) {
  return JSON.stringify({
    accesso: 'token-vecchio',
    rinnovo: 'rinnovo-vecchio',
    scadenza: Math.floor(Date.now() / 1000) + fraQuantiSecondi,
    email: 'prova@example.invalid',
  });
}

/**
 * Lancia `f` con rete e deposito finti, e la console zitta.
 * `f` riceve `{ deposito, chiamate, rispondi }`: `rispondi` decide la risposta della
 * fetch finta, `chiamate` raccoglie quello che è stato chiesto.
 */
async function senzaMondo(f) {
  const vecchioFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const vecchioDeposito = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const vecchiaConsole = { log: console.log, warn: console.warn, error: console.error };

  const m = new Map();
  const deposito = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };

  const chiamate = [];
  let risposta = () => 500;
  const fetchFinta = async (url, opzioni = {}) => {
    let corpo = null;
    try { corpo = opzioni.body ? JSON.parse(opzioni.body) : null; } catch { corpo = opzioni.body; }
    chiamate.push({ url: String(url), intestazioni: opzioni.headers || {}, corpo });
    const r = risposta(String(url), corpo);
    if (r === null) throw new TypeError('rete non raggiungibile');
    if (typeof r === 'number') return { ok: false, status: r, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => r };
  };

  Object.defineProperty(globalThis, 'fetch', {
    value: fetchFinta, configurable: true, writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: deposito, configurable: true, writable: true,
  });
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  sessioneDiProva(null);

  try {
    return await f({
      deposito,
      chiamate,
      rispondi: (f2) => { risposta = f2; },
    });
  } finally {
    sessioneDiProva(null);
    console.log = vecchiaConsole.log;
    console.warn = vecchiaConsole.warn;
    console.error = vecchiaConsole.error;
    if (vecchioFetch) Object.defineProperty(globalThis, 'fetch', vecchioFetch);
    else delete globalThis.fetch;
    if (vecchioDeposito) Object.defineProperty(globalThis, 'localStorage', vecchioDeposito);
    else delete globalThis.localStorage;
  }
}

/** La risposta di Supabase a un accesso o a un rinnovo riuscito. */
function rispostaConTokens(accesso, rinnovo) {
  return {
    access_token: accesso,
    refresh_token: rinnovo,
    expires_in: 3600,
    user: { email: 'prova@example.invalid' },
  };
}

const soloRinnovi = (chiamate) => chiamate.filter((c) => c.url.includes('grant_type=refresh_token'));

export const casi = [
  {
    nome: "0. senza sessione: token() torna null e haSessione() dice no",
    async prova() {
      await senzaMondo(async ({ chiamate }) => {
        uguale(haSessione(), false, 'non c’è nessuna sessione salvata');
        uguale(await token(), null, 'senza sessione non esiste un token');
        uguale(chiamate.length, 0, 'e non si chiama la rete per scoprirlo');
      });
    },
  },
  {
    nome: '1. sessione valida: torna il token salvato senza toccare la rete',
    async prova() {
      await senzaMondo(async ({ deposito, chiamate }) => {
        deposito.setItem(CHIAVE_SESSIONE, sessione(3600));
        uguale(haSessione(), true);
        uguale(await token(), 'token-vecchio');
        uguale(emailDellaSessione(), 'prova@example.invalid');
        uguale(chiamate.length, 0, 'un token ancora buono non si rinnova');
      });
    },
  },
  {
    nome: '2. token scaduto: lo rinnova una volta e salva i token nuovi',
    async prova() {
      await senzaMondo(async ({ deposito, chiamate, rispondi }) => {
        deposito.setItem(CHIAVE_SESSIONE, sessione(10)); // dentro il margine di 60 s
        rispondi(() => rispostaConTokens('token-nuovo', 'rinnovo-nuovo'));

        uguale(await token(), 'token-nuovo');
        uguale(soloRinnovi(chiamate).length, 1, 'un rinnovo solo');

        const salvata = JSON.parse(deposito.getItem(CHIAVE_SESSIONE));
        uguale(salvata.accesso, 'token-nuovo');
        uguale(salvata.rinnovo, 'rinnovo-nuovo', 'il token di rinnovo va sostituito: ruota a ogni uso');
        vero(salvata.scadenza > Math.floor(Date.now() / 1000) + 3000, 'la scadenza nuova è fra un’ora');
      });
    },
  },
  {
    nome: '3. due richieste insieme con il token scaduto: un rinnovo solo, non due',
    async prova() {
      await senzaMondo(async ({ deposito, chiamate, rispondi }) => {
        deposito.setItem(CHIAVE_SESSIONE, sessione(10));
        rispondi(() => rispostaConTokens('token-nuovo', 'rinnovo-nuovo'));

        // Questo è il caso che Supabase punisce: il token di rinnovo speso due volte
        // oltre la finestra di dieci secondi chiude la sessione.
        const [a, b] = await Promise.all([token(), token()]);

        uguali([a, b], ['token-nuovo', 'token-nuovo'], 'le due chiamate hanno la stessa risposta');
        uguale(soloRinnovi(chiamate).length, 1, 'e la rete è stata chiamata una volta sola');
      });
    },
  },
  {
    nome: '4. rinnovo rifiutato: cancella la sessione e avvisa che è scaduta',
    async prova() {
      await senzaMondo(async ({ deposito, rispondi }) => {
        deposito.setItem(CHIAVE_SESSIONE, sessione(10));
        rispondi(() => 400);

        let avvisato = false;
        onScaduta(() => { avvisato = true; });

        uguale(await token(), null, 'senza rinnovo non c’è token');
        uguale(deposito.getItem(CHIAVE_SESSIONE), null, 'la sessione va cancellata');
        uguale(avvisato, true, 'e la vista deve saperlo, per rimettere la schermata');
      });
    },
  },
  {
    nome: '5. rinnovo con la rete muta: la sessione resta, non è un logout',
    async prova() {
      await senzaMondo(async ({ deposito, rispondi }) => {
        deposito.setItem(CHIAVE_SESSIONE, sessione(10));
        rispondi(() => null); // la fetch lancia

        let errore = null;
        try {
          await token();
        } catch (e) {
          errore = e;
        }
        vero(errore instanceof Error, 'la rete muta deve farsi sentire');
        vero(deposito.getItem(CHIAVE_SESSIONE) !== null, 'ma la sessione è ancora buona');
      });
    },
  },
  {
    nome: '6. entra(): password sbagliata dà un messaggio leggibile, giusta salva la sessione',
    async prova() {
      await senzaMondo(async ({ deposito, rispondi }) => {
        rispondi(() => 400);
        let errore = null;
        try {
          await entra('prova@example.invalid', 'sbagliata');
        } catch (e) {
          errore = e;
        }
        uguale(errore && errore.message, 'Email o password sbagliate.');
        uguale(haSessione(), false, 'un tentativo fallito non lascia niente');

        rispondi(() => rispostaConTokens('token-fresco', 'rinnovo-fresco'));
        uguale(await entra('prova@example.invalid', 'giusta'), 'prova@example.invalid');
        uguale(haSessione(), true);
        uguale(await token(), 'token-fresco');

        esci();
        uguale(haSessione(), false, 'esci() dimentica la sessione');
      });
    },
  },
  {
    nome: '7. dati.js manda il token dell’utente in Authorization, non la chiave pubblica',
    async prova() {
      await senzaMondo(async ({ deposito, rispondi }) => {
        deposito.setItem(CHIAVE_SESSIONE, sessione(3600));
        rispondi(() => 500); // le richieste di dati falliscono: qui guardiamo le intestazioni

        const chiamate = [];
        const fetchSpia = async (url, opzioni = {}) => {
          chiamate.push({ url: String(url), intestazioni: opzioni.headers || {} });
          return { ok: false, status: 500, json: async () => [] };
        };

        stato.data = {};
        await avvia({ fetch: fetchSpia });

        vero(chiamate.length > 0, 'avvia() deve aver provato a leggere');
        const i = chiamate[0].intestazioni;
        uguale(i.Authorization, 'Bearer token-vecchio', 'in Authorization va il token di chi è entrato');
        uguale(i.apikey, CHIAVE_SUPABASE, 'in apikey resta la chiave pubblica del progetto');
        vero(
          !String(i.Authorization).includes(CHIAVE_SUPABASE),
          'la chiave pubblica non deve più comparire in Authorization'
        );
      });
    },
  },
  {
    nome: '8. senza sessione dati.js non chiama la rete: si ferma prima',
    async prova() {
      await senzaMondo(async () => {
        let chiamata = false;
        const fetchSpia = async () => {
          chiamata = true;
          return { ok: true, status: 200, json: async () => [] };
        };

        stato.data = {};
        await avvia({ fetch: fetchSpia });

        uguale(chiamata, false, 'senza token non si chiede niente a Supabase');
        uguale(stato.sync, 'errore', 'e lo stato lo dice, invece di far finta che vada');
      });
    },
  },
];
