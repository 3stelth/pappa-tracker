// Accesso alla v3. Un solo account di famiglia, con email e password.
//
// Le iscrizioni su Supabase sono chiuse, quindi qui non esiste una registrazione: si
// entra con l'account che esiste già, o non si entra.
//
// Perché scritto a mano e non con la libreria supabase-js, che v1 e v2 caricano da
// internet: la v3 non carica niente da fuori, nessuno script e nessun foglio di stile
// esterno. È un'app che si installa sul telefono, e volevamo che partisse anche con la
// rete incerta. Il prezzo di quella scelta è il rinnovo del token, che qui scriviamo
// noi: sta tutto in `chiediRinnovo`, l'unico punto che lo fa.
//
// Perché un punto solo: il token d'accesso dura un'ora, e il token di rinnovo cambia a
// ogni uso. Supabase tollera il riuso dello stesso token di rinnovo per dieci secondi;
// oltre quella finestra considera la sessione rubata e la chiude. Se due parti dell'app
// chiedessero il rinnovo per conto proprio, prima o poi lo spenderebbero due volte e
// l'utente si troverebbe fuori senza motivo. Per questo `rinnova` tiene una sola
// richiesta in volo e fa aspettare a tutti la stessa risposta.

import { URL_SUPABASE, CHIAVE_SUPABASE } from './supabase.js';

const CHIAVE_LOCALE = 'pappatracker_sessione_v3';

// Quanto prima della scadenza si rinnova. Un minuto basta: la richiesta dura meno di un
// secondo, e così una scrittura non parte mai con un token che scade mentre viaggia.
const MARGINE = 60;

let inVolo = null;
let sessioneFinta = null;
const ascoltatori = [];

/**
 * Solo per i test: fa come se si fosse entrati, senza rete e senza deposito.
 * Con `null` torna il comportamento normale. Ha lo stesso scopo di
 * `provaSenzaScritture` in dati.js: provare il giro vero senza toccare niente di vero.
 */
export function sessioneDiProva(accesso) {
  sessioneFinta = accesso
    ? {
        accesso,
        rinnovo: 'rinnovo-di-prova',
        scadenza: Math.floor(Date.now() / 1000) + 3600,
        email: 'prova@example.invalid',
      }
    : null;
}

function deposito() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function leggiSessione() {
  if (sessioneFinta) return sessioneFinta;
  const d = deposito();
  if (!d) return null;
  try {
    const s = JSON.parse(d.getItem(CHIAVE_LOCALE) || 'null');
    if (!s || !s.accesso || !s.rinnovo || !s.scadenza) return null;
    return s;
  } catch {
    return null;
  }
}

/** Salva la risposta di Supabase nella forma che usiamo noi. */
function salvaSessione(risposta) {
  const s = {
    accesso: risposta.access_token,
    rinnovo: risposta.refresh_token,
    scadenza: Math.floor(Date.now() / 1000) + (risposta.expires_in || 3600),
    email: (risposta.user && risposta.user.email) || '',
  };
  const d = deposito();
  if (d) {
    try {
      d.setItem(CHIAVE_LOCALE, JSON.stringify(s));
    } catch (errore) {
      // Senza deposito l'accesso vale finché la pagina resta aperta: non è un guasto da
      // fermare qui, ma va detto, perché spiega un login richiesto di nuovo domani.
      console.warn('[accesso] la sessione non si salva:', errore);
    }
  }
  return s;
}

function scartaSessione() {
  const d = deposito();
  if (!d) return;
  try {
    d.removeItem(CHIAVE_LOCALE);
  } catch (errore) {
    console.warn('[accesso] la sessione non si cancella:', errore);
  }
}

/** Avvisa chi guarda che la sessione è finita e serve entrare di nuovo. */
function avvisaScaduta() {
  for (const f of ascoltatori) {
    try {
      f();
    } catch (errore) {
      console.error('[accesso] un ascoltatore è andato in errore:', errore);
    }
  }
}

/** Registra chi vuole sapere che la sessione è scaduta: la vista rimette la schermata. */
export function onScaduta(f) {
  if (typeof f === 'function') ascoltatori.push(f);
}

/** C'è una sessione salvata? Non dice se è ancora valida: lo scopre `token()`. */
export function haSessione() {
  return !!leggiSessione();
}

/** L'email con cui si è entrati, per mostrarla. I token non escono da questo modulo. */
export function emailDellaSessione() {
  const s = leggiSessione();
  return s ? s.email : '';
}

async function chiediRinnovo(rinnovo) {
  let r;
  try {
    r = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: CHIAVE_SUPABASE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rinnovo }),
    });
  } catch (errore) {
    // Rete muta. La sessione è ancora buona: non si cancella, si riprova dopo.
    throw new Error(`il rinnovo non parte: ${errore && errore.message}`);
  }
  if (r.status === 400 || r.status === 401) {
    // Questo è un no definitivo: il token di rinnovo non vale più.
    scartaSessione();
    avvisaScaduta();
    return null;
  }
  if (!r.ok) throw new Error(`risposta ${r.status} al rinnovo`);
  const d = await r.json();
  if (!d || !d.access_token || !d.refresh_token) throw new Error('rinnovo senza token');
  salvaSessione(d);
  return d.access_token;
}

function rinnova(sessione) {
  if (!inVolo) {
    inVolo = chiediRinnovo(sessione.rinnovo).finally(() => {
      inVolo = null;
    });
  }
  return inVolo;
}

/**
 * Il token da mettere in Authorization, rinnovato se sta per scadere.
 * Torna null se non c'è sessione o se il rinnovo è stato rifiutato: in quel caso serve
 * entrare di nuovo. Lancia se la rete non risponde, perché quello non è un logout.
 */
export async function token() {
  const s = leggiSessione();
  if (!s) return null;
  if (s.scadenza - MARGINE > Math.floor(Date.now() / 1000)) return s.accesso;
  return rinnova(s);
}

/**
 * Entra con email e password. Torna l'email in caso di riuscita.
 * Lancia con un messaggio già leggibile: lo mostra la schermata d'accesso.
 */
export async function entra(email, password) {
  let r;
  try {
    r = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: CHIAVE_SUPABASE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Senza rete non si può entrare. Riprova quando torna il segnale.');
  }
  if (r.status === 400 || r.status === 401) {
    throw new Error('Email o password sbagliate.');
  }
  if (!r.ok) {
    throw new Error(`Supabase ha risposto ${r.status}. Riprova più tardi.`);
  }
  const d = await r.json();
  if (!d || !d.access_token || !d.refresh_token) {
    throw new Error('Risposta senza token. Riprova più tardi.');
  }
  return salvaSessione(d).email;
}

/** Esce e dimentica la sessione su questo dispositivo. */
export function esci() {
  scartaSessione();
}
