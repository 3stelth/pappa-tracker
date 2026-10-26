// Livello dei dati della v3: stato in memoria, localStorage, Supabase, fusione.
//
// Due regole che non si violano mai:
// 1. La riga Supabase id='main' si legge, non si scrive. È il registro storico della
//    famiglia. Per questo la POST sta in una funzione sola, che scrive sempre RIGA.
// 2. Se la rete non risponde al primo avvio, non si scrive niente di remoto. Una riga
//    'v3' vuota diventerebbe la copia e cancellerebbe lo storico.
//
// La forma dei dati è quella della v2, perché i dati storici sono già così:
//   data['AAAA-MM-GG'][bambino] = { weight, length, temperatures[], meals[],
//                                   feeds[], diapers[], therapies{} }
// La v3 non mostra feeds, diapers e therapies, ma la fusione non li perde.

const URL_SUPABASE = 'https://ukcwajbbybkobaroyqiq.supabase.co';
const CHIAVE_SUPABASE = 'sb_publishable_jicoWcdW87NzVXFQTx3fxA_dJOv_dVe';
const TABELLA = 'pappa_tracker_data';

export const stato = { data: {}, sync: 'fermo' };
export const CHIAVE_LOCALE = 'pappatracker_data_v3';
export const RIGA = 'v3';

// I gradimenti storici valgono all/half/little e si rileggono come good/ok/bad.
const ALIAS_GIUDIZIO = { all: 'good', half: 'ok', little: 'bad' };

const CAMPO = { peso: 'weight', lunghezza: 'length', temperatura: 'temperatures' };
const UNITA = { peso: 'kg', lunghezza: 'cm' };

let senzaScritture = false;
const ascoltatori = [];

// ─── aiuti ───

function piano(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function copia(x) {
  return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
}

function deposito() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function nuovoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Momento in millisecondi, sempre crescente dentro la stessa sessione: due scritture
// nello stesso millisecondo devono comunque avere un addedAt diverso, altrimenti la
// fusione non sa quale delle due è l'ultima.
let ultimoMomento = 0;
function momento() {
  const t = Math.max(Date.now(), ultimoMomento + 1);
  ultimoMomento = t;
  return t;
}

function oraLocale() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function isGiorno(chiave) {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(chiave));
}

function giorniOrdinati() {
  return Object.keys(stato.data).filter(isGiorno).sort();
}

function avvisa() {
  for (const f of ascoltatori) {
    try {
      f();
    } catch (errore) {
      console.error('[dati] un ascoltatore ha lanciato un errore:', errore);
    }
  }
}

export function onCambio(f) {
  if (typeof f === 'function') ascoltatori.push(f);
}

export function provaSenzaScritture(acceso) {
  senzaScritture = !!acceso;
  console.log(`[dati] scritture ${senzaScritture ? 'spente' : 'accese'}`);
}

// ─── fusione ───

/** Chiave stabile di una voce di lista: l'id, oppure i suoi campi. */
function chiaveVoce(e) {
  if (piano(e) && e.id) return `id:${e.id}`;
  if (!piano(e)) return `v:${JSON.stringify(e)}`;
  return `c:${Object.keys(e).sort().map((k) => `${k}=${JSON.stringify(e[k])}`).join('|')}`;
}

function unisciLista(mia, altrui) {
  const per = new Map();
  for (const e of altrui) per.set(chiaveVoce(e), e);
  for (const e of mia) per.set(chiaveVoce(e), e); // a chiave uguale vince il mio
  return [...per.values()].sort((a, b) =>
    String((piano(a) && a.time) || '').localeCompare(String((piano(b) && b.time) || ''))
  );
}

function fondiBambino(mio, altrui) {
  if (!piano(mio)) return piano(altrui) && mio === undefined ? altrui : mio;
  if (!piano(altrui)) return mio;
  const fuso = {};
  for (const k of new Set([...Object.keys(altrui), ...Object.keys(mio)])) {
    const a = mio[k];
    const b = altrui[k];
    if (Array.isArray(a) && Array.isArray(b)) {
      fuso[k] = unisciLista(a, b);
    } else if (Array.isArray(a) || Array.isArray(b)) {
      fuso[k] = a !== undefined ? a : b;
    } else if (piano(a) && piano(b)) {
      // weight e length: vince quello con addedAt più grande. Gli altri oggetti
      // (per esempio therapies) si fondono campo per campo, e il mio vince.
      if ('addedAt' in a || 'addedAt' in b) fuso[k] = (a.addedAt || 0) >= (b.addedAt || 0) ? a : b;
      else fuso[k] = { ...b, ...a };
    } else {
      fuso[k] = a !== undefined ? a : b;
    }
  }
  return fuso;
}

function fondiGiorno(mio, altrui) {
  if (!piano(mio)) return piano(altrui) && mio === undefined ? altrui : mio;
  if (!piano(altrui)) return mio;
  const fuso = {};
  for (const bn of new Set([...Object.keys(altrui), ...Object.keys(mio)])) {
    fuso[bn] = fondiBambino(mio[bn], altrui[bn]);
  }
  return fuso;
}

function chiavePietra(t) {
  if (t.id) return `id:${t.id}`;
  return `ck:${t.kind || ''}|${t.dateKey || ''}|${t.baby || ''}|${t.ck || ''}`;
}

function unisciPietre(mie, altrui) {
  const per = new Map();
  for (const t of [...(Array.isArray(altrui) ? altrui : []), ...(Array.isArray(mie) ? mie : [])]) {
    if (!piano(t)) continue;
    const k = chiavePietra(t);
    const vecchia = per.get(k);
    if (!vecchia || (t.deletedAt || 0) >= (vecchia.deletedAt || 0)) per.set(k, t);
  }
  return [...per.values()];
}

/**
 * Toglie dai dati quello che le tombstone dicono cancellato. Per temperatures e meals
 * il confronto è sull'id. Per weight e length la tombstone non ha id: cancella solo se
 * la misura è più vecchia della cancellazione, così un reinserimento non sparisce.
 */
function applicaPietre(dati, pietre) {
  if (!pietre.length) return;
  const idCancellati = new Set(pietre.map((t) => t.id).filter(Boolean));
  const misureCancellate = new Map();
  for (const t of pietre) {
    if (!t.id && (t.kind === 'weight' || t.kind === 'length')) {
      misureCancellate.set(`${t.dateKey}|${t.baby}|${t.kind}`, t.deletedAt || 0);
    }
  }
  for (const iso of Object.keys(dati)) {
    if (!isGiorno(iso)) continue;
    const giorno = dati[iso];
    if (!piano(giorno)) continue;
    for (const bn of Object.keys(giorno)) {
      const bd = giorno[bn];
      if (!piano(bd)) continue;
      if (idCancellati.size) {
        for (const lista of ['temperatures', 'meals']) {
          if (Array.isArray(bd[lista])) {
            bd[lista] = bd[lista].filter((e) => !(piano(e) && e.id && idCancellati.has(e.id)));
          }
        }
      }
      for (const campo of ['weight', 'length']) {
        const quando = misureCancellate.get(`${iso}|${bn}|${campo}`);
        if (quando !== undefined && piano(bd[campo]) && (bd[campo].addedAt || 0) <= quando) {
          delete bd[campo];
        }
      }
    }
  }
}

// ─── vaccini ───
// I vaccini non si fondono a blocco intero: il blocco con modificatoAt più grande
// cancellerebbe l'altro (per esempio il blocco dei certificati contro una voce
// aggiunta a mano sul telefono). Si uniscono per seduta e, dentro la seduta, per voce.

function chiaveSeduta(s) {
  const chi = Array.isArray(s.bambini) ? [...s.bambini].sort().join('+') : '';
  return `${s.data}|${chi}`;
}

function chiaveVoceVaccino(v) {
  return [v.nome, v.prodotto, v.dose, v.lotto].map((x) => String(x == null ? '' : x).toLowerCase()).join('|');
}

/**
 * Unisce due blocchi vaccini. I campi del blocco (stato, emessoDa, aggiornatoAl...) li
 * porta il più recente, ma solo quelli che ha: gli altri restano dal più vecchio.
 * Le sedute si uniscono per data e bambini, le voci per nome, prodotto, dose e lotto.
 * Una voce uguale non si duplica; se due voci hanno la stessa chiave vince la più recente.
 * Niente sparisce. Non modifica gli argomenti.
 */
export function fondiVaccini(x, y) {
  if (!piano(x)) return piano(y) ? copia(y) : x;
  if (!piano(y)) return copia(x);
  const [vecchio, nuovo] = (x.modificatoAt || 0) <= (y.modificatoAt || 0) ? [x, y] : [y, x];
  const fuso = { ...copia(vecchio), ...copia(nuovo) };
  fuso.modificatoAt = Math.max(x.modificatoAt || 0, y.modificatoAt || 0);

  const sedute = new Map();
  for (const blocco of [vecchio, nuovo]) {
    for (const s of Array.isArray(blocco.sedute) ? blocco.sedute : []) {
      if (!piano(s)) continue;
      const k = chiaveSeduta(s);
      const presente = sedute.get(k);
      const voci = new Map(presente ? presente.voci.map((v) => [chiaveVoceVaccino(v), v]) : []);
      for (const v of Array.isArray(s.voci) ? s.voci : []) {
        if (piano(v)) voci.set(chiaveVoceVaccino(v), copia(v));
      }
      sedute.set(k, { ...copia(presente || {}), ...copia(s), voci: [...voci.values()] });
    }
  }
  fuso.sedute = [...sedute.entries()]
    .sort((p, q) => (p[1].data < q[1].data ? -1 : p[1].data > q[1].data ? 1 : p[0] < q[0] ? -1 : 1))
    .map(([, s]) => s);
  return fuso;
}

/**
 * Fonde due copie dei dati. Non modifica gli argomenti. Niente si cancella mai solo
 * perché manca da una parte: solo una tombstone cancella.
 */
export function fondi(mio, altrui) {
  const a = piano(mio) ? copia(mio) : {};
  const b = piano(altrui) ? copia(altrui) : {};
  const fuso = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (k === '_tombstones') continue;
    if (isGiorno(k)) {
      fuso[k] = fondiGiorno(a[k], b[k]);
    } else if (k === 'vaccini' && (piano(a[k]) || piano(b[k]))) {
      fuso[k] = fondiVaccini(a[k], b[k]);
    } else {
      fuso[k] = k in a ? a[k] : b[k];
    }
  }
  const pietre = unisciPietre(a._tombstones, b._tombstones);
  if (pietre.length) fuso._tombstones = pietre;
  applicaPietre(fuso, pietre);
  return fuso;
}

// ─── localStorage ───

export function caricaLocale() {
  const d = deposito();
  if (!d) return;
  try {
    const testo = d.getItem(CHIAVE_LOCALE);
    if (testo) stato.data = JSON.parse(testo);
  } catch (errore) {
    console.error('[dati] i dati locali non si leggono:', errore);
  }
}

export function salvaLocale() {
  if (senzaScritture) {
    console.log('[dati] prova senza scritture: salvaLocale saltata');
    return;
  }
  const d = deposito();
  if (!d) return;
  try {
    d.setItem(CHIAVE_LOCALE, JSON.stringify(stato.data));
  } catch (errore) {
    console.error('[dati] i dati locali non si scrivono:', errore);
  }
}

// ─── Supabase ───

function intestazioni() {
  return { apikey: CHIAVE_SUPABASE, Authorization: `Bearer ${CHIAVE_SUPABASE}` };
}

function rete(opzioni) {
  if (typeof opzioni.fetch === 'function') return opzioni.fetch;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  return null;
}

/** Legge una riga. Torna il suo `data`, oppure null se la riga non c'è. Lancia se la rete non risponde. */
async function leggiRiga(chiamata, id) {
  const r = await chiamata(`${URL_SUPABASE}/rest/v1/${TABELLA}?id=eq.${id}&select=data`, {
    headers: intestazioni(),
  });
  if (!r || r.ok === false) throw new Error(`risposta ${r && r.status} leggendo la riga ${id}`);
  const righe = await r.json();
  if (!Array.isArray(righe) || !righe.length || !piano(righe[0]) || !righe[0].data) return null;
  return righe[0].data;
}

/**
 * Scrive la riga della v3. L'id è la costante RIGA: questa è l'unica POST del modulo,
 * e non esiste un modo di chiamarla per scrivere la riga 'main'.
 */
async function scriviRigaV3(chiamata, data) {
  const r = await chiamata(`${URL_SUPABASE}/rest/v1/${TABELLA}`, {
    method: 'POST',
    headers: {
      ...intestazioni(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ id: RIGA, data }),
  });
  if (!r || r.ok === false) throw new Error(`risposta ${r && r.status} scrivendo la riga ${RIGA}`);
}

async function semeDeiVaccini() {
  const r = await fetch(new URL('./dati/vaccini.json', import.meta.url));
  if (!r.ok) throw new Error(`risposta ${r.status}`);
  return r.json();
}

function ugualiProfondi(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => k in b && ugualiProfondi(a[k], b[k]));
}

/**
 * Mette il seme dei vaccini. Se il blocco manca, lo copia. Se c'è già, lo fonde col seme
 * (fondiVaccini è ripetibile) e scrive solo se l'unione cambia qualcosa: così le sedute
 * dei certificati non si perdono nemmeno quando un altro telefono ha scritto per primo.
 * Scrive solo in locale: la risalita remota la fa sincronizza() alla prossima scrittura.
 * Se il file non si legge, non mette niente.
 */
async function semina(opzioni) {
  const leggi = 'leggiSeme' in opzioni ? opzioni.leggiSeme : semeDeiVaccini;
  if (typeof leggi !== 'function') return;
  let seme = null;
  try {
    seme = await leggi();
  } catch (errore) {
    console.warn('[dati] il seme dei vaccini non si legge:', errore);
    return;
  }
  if (!piano(seme)) return;
  if (!piano(stato.data.vaccini)) {
    stato.data.vaccini = { ...seme, modificatoAt: momento() };
    salvaLocale();
    return;
  }
  const attuale = stato.data.vaccini;
  const fuso = fondiVaccini(attuale, seme);
  if (ugualiProfondi(fuso, fondiVaccini(attuale, attuale))) return;
  stato.data.vaccini = { ...fuso, modificatoAt: momento() };
  salvaLocale();
}

/**
 * Primo avvio. Legge i dati locali, poi la riga 'v3'. Tre casi.
 * 1. La riga 'v3' c'è: la fonde con i dati locali e risalva. Nessuna scrittura remota.
 * 2. La riga 'v3' non c'è e 'main' si legge: copia tutto main nella riga 'v3' e lo usa.
 * 3. Una delle due letture non risponde: non scrive niente di remoto, sync='errore',
 *    tiene i dati locali. La copia si riprova alla prossima apertura.
 */
export async function avvia(opzioni = {}) {
  caricaLocale();
  const chiamata = rete(opzioni);
  if (!chiamata) {
    stato.sync = 'errore';
    avvisa();
    return;
  }
  stato.sync = 'in corso';

  let daV3 = null;
  try {
    daV3 = await leggiRiga(chiamata, RIGA);
  } catch (errore) {
    console.error(`[dati] la riga ${RIGA} non si legge:`, errore);
    stato.sync = 'errore';
    avvisa();
    return;
  }

  if (daV3) {
    stato.data = fondi(stato.data, daV3);
    salvaLocale();
    stato.sync = 'ok';
  } else {
    let daMain = null;
    try {
      daMain = await leggiRiga(chiamata, 'main');
    } catch (errore) {
      console.error("[dati] la riga 'main' non si legge: nessuna copia, si riprova dopo", errore);
      stato.sync = 'errore';
      avvisa();
      return;
    }
    if (!daMain) {
      // Niente da copiare. Scrivere una riga 'v3' vuota adesso la farebbe diventare la
      // copia dello storico: non si scrive.
      console.warn("[dati] né la riga v3 né la riga main hanno dati: nessuna scrittura");
      stato.sync = 'ok';
    } else {
      let copiata = false;
      if (senzaScritture) {
        console.log('[dati] prova senza scritture: copia iniziale saltata');
      } else {
        try {
          await scriviRigaV3(chiamata, daMain);
          copiata = true;
        } catch (errore) {
          console.error('[dati] la copia iniziale non è riuscita:', errore);
        }
      }
      stato.data = fondi(stato.data, daMain);
      salvaLocale();
      stato.sync = copiata ? 'ok' : 'errore';
    }
  }

  await semina(opzioni);
  avvisa();
}

/**
 * Legge la riga 'v3', fonde, risalva e riscrive la riga 'v3'. Se la riga 'v3' non
 * esiste ancora non scrive niente: la copia iniziale la fa avvia(), con il contenuto
 * di main. Altrimenti la riga nuova nascerebbe con i soli dati di questo telefono.
 */
export async function sincronizza(opzioni = {}) {
  if (senzaScritture) {
    console.log('[dati] prova senza scritture: sincronizza saltata');
    return;
  }
  const chiamata = rete(opzioni);
  if (!chiamata) {
    stato.sync = 'errore';
    avvisa();
    return;
  }
  stato.sync = 'in corso';
  avvisa();
  try {
    const remoto = await leggiRiga(chiamata, RIGA);
    if (!remoto) {
      console.warn(`[dati] la riga ${RIGA} non esiste ancora: nessuna scrittura remota`);
      stato.sync = 'errore';
      avvisa();
      return;
    }
    stato.data = fondi(stato.data, remoto);
    salvaLocale();
    await scriviRigaV3(chiamata, stato.data);
    stato.sync = 'ok';
  } catch (errore) {
    console.error('[dati] la sincronizzazione non è riuscita:', errore);
    stato.sync = 'errore';
  }
  avvisa();
}

// ─── lettura ───

function misure(bambino, campo, unita) {
  const out = [];
  for (const iso of giorniOrdinati()) {
    const bd = stato.data[iso] && stato.data[iso][bambino];
    const m = piano(bd) ? bd[campo] : null;
    if (!piano(m)) continue;
    const valore = Number(m[unita]);
    if (!Number.isFinite(valore)) continue;
    out.push({ iso, [unita]: valore, note: m.note || '' });
  }
  return out;
}

export function pesate(bambino) {
  return misure(bambino, 'weight', 'kg');
}

export function lunghezze(bambino) {
  return misure(bambino, 'length', 'cm');
}

export function temperature(bambino) {
  const out = [];
  for (const iso of giorniOrdinati()) {
    const bd = stato.data[iso] && stato.data[iso][bambino];
    if (!piano(bd)) continue;
    const voci = [];
    if (Array.isArray(bd.temperatures)) voci.push(...bd.temperatures);
    // Forma vecchia: una temperatura sola, non in lista. Si legge, non si riscrive.
    if (Array.isArray(bd.temperature)) voci.push(...bd.temperature);
    else if (piano(bd.temperature)) voci.push(bd.temperature);
    for (const t of voci) {
      if (!piano(t)) continue;
      const valore = Number(t.temp);
      if (!Number.isFinite(valore)) continue;
      out.push({ iso, temp: valore, ora: t.time || '', note: t.note || '', id: t.id || '' });
    }
  }
  return out.sort((a, b) => b.iso.localeCompare(a.iso) || b.ora.localeCompare(a.ora));
}

/** Gli alimenti di una pappa. La forma vecchia li tiene dentro `items`, la nuova in `foods`. */
function alimentiDi(m) {
  if (Array.isArray(m.foods)) return [...new Set(m.foods.filter(Boolean))];
  const out = [];
  for (const voce of Array.isArray(m.items) ? m.items : []) {
    for (const f of piano(voce) && Array.isArray(voce.foods) ? voce.foods : []) {
      if (f) out.push(f);
    }
  }
  return [...new Set(out)];
}

function giudizioDi(m) {
  const v = m.liking;
  return v ? ALIAS_GIUDIZIO[v] || v : '';
}

export function pappe() {
  const out = [];
  for (const iso of giorniOrdinati()) {
    const giorno = stato.data[iso];
    if (!piano(giorno)) continue;
    for (const bn of Object.keys(giorno)) {
      const bd = giorno[bn];
      if (!piano(bd) || !Array.isArray(bd.meals)) continue;
      for (const m of bd.meals) {
        if (!piano(m)) continue;
        out.push({ iso, id: m.id || '', bambino: bn, alimenti: alimentiDi(m), giudizio: giudizioDi(m) });
      }
    }
  }
  return out;
}

export function vaccini() {
  return piano(stato.data.vaccini) ? stato.data.vaccini : null;
}

// ─── scrittura ───

function cartella(bambino, iso) {
  if (!piano(stato.data[iso])) stato.data[iso] = {};
  if (!piano(stato.data[iso][bambino])) stato.data[iso][bambino] = {};
  return stato.data[iso][bambino];
}

function pietre() {
  if (!Array.isArray(stato.data._tombstones)) stato.data._tombstones = [];
  return stato.data._tombstones;
}

function aggiungiPietra(t) {
  const lista = pietre();
  const k = chiavePietra(t);
  const i = lista.findIndex((x) => piano(x) && chiavePietra(x) === k);
  if (i >= 0) lista[i] = t;
  else lista.push(t);
}

/** Un reinserimento revoca la cancellazione di prima, altrimenti la fusione la rifarebbe. */
function togliPietra(kind, iso, bambino) {
  if (!Array.isArray(stato.data._tombstones)) return;
  stato.data._tombstones = stato.data._tombstones.filter(
    (t) => !(piano(t) && t.kind === kind && t.dateKey === iso && t.baby === bambino && !t.id)
  );
  if (!stato.data._tombstones.length) delete stato.data._tombstones;
}

function dopoScrittura(descrizione) {
  if (senzaScritture) console.log('[dati] prova senza scritture, avrei scritto:', descrizione);
  salvaLocale();
  sincronizza().catch((errore) => console.error('[dati] sincronizzazione fallita:', errore));
  avvisa();
}

export function scriviMisura(bambino, tipo, valore, iso) {
  const campo = CAMPO[tipo];
  if (!campo) throw new Error(`tipo di misura sconosciuto: ${tipo}`);
  const bd = cartella(bambino, iso);
  if (tipo === 'temperatura') {
    if (!Array.isArray(bd.temperatures)) bd.temperatures = [];
    bd.temperatures.push({ id: nuovoId(), temp: valore, time: oraLocale(), note: '' });
  } else {
    // Se la misura del giorno esiste già, ne tiene l'ora e la nota: cambiano solo valore e addedAt.
    const prima = piano(bd[campo]) ? bd[campo] : {};
    bd[campo] = {
      ...prima,
      [UNITA[tipo]]: valore,
      time: prima.time !== undefined ? prima.time : oraLocale(),
      note: prima.note !== undefined ? prima.note : '',
      addedAt: momento(),
    };
    togliPietra(campo, iso, bambino);
  }
  dopoScrittura({ bambino, tipo, valore, iso });
}

export function cancellaMisura(bambino, tipo, iso, id) {
  const campo = CAMPO[tipo];
  if (!campo) throw new Error(`tipo di misura sconosciuto: ${tipo}`);
  const bd = piano(stato.data[iso]) ? stato.data[iso][bambino] : null;
  if (!piano(bd)) return;
  const quando = momento();
  if (tipo === 'temperatura') {
    if (Array.isArray(bd.temperatures)) {
      bd.temperatures = bd.temperatures.filter((e) => !(piano(e) && e.id === id));
    }
    aggiungiPietra({ kind: 'temperatures', dateKey: iso, baby: bambino, id, deletedAt: quando });
  } else {
    delete bd[campo];
    aggiungiPietra({ kind: campo, dateKey: iso, baby: bambino, deletedAt: quando });
  }
  dopoScrittura({ azione: 'cancella', bambino, tipo, iso, id });
}

function chiaveAlimenti(alimenti) {
  return [...new Set((Array.isArray(alimenti) ? alimenti : []).filter(Boolean))].sort().join('+');
}

/**
 * Sostituisce il blocco dei vaccini e ne segna il momento: nella fusione vince quello
 * con `modificatoAt` più grande. Le sedute le compone chi conosce il dominio, qui si
 * salvano e si sincronizzano.
 */
export function scriviVaccini(dati) {
  if (!piano(dati)) return;
  stato.data.vaccini = { ...dati, modificatoAt: momento() };
  dopoScrittura({ vaccini: `${Array.isArray(dati.sedute) ? dati.sedute.length : 0} sedute` });
}

export function scriviGiudizio(bambino, iso, alimenti, giudizio) {
  const bd = cartella(bambino, iso);
  if (!Array.isArray(bd.meals)) bd.meals = [];
  const cercata = chiaveAlimenti(alimenti);
  let pappa = bd.meals.find((m) => piano(m) && chiaveAlimenti(alimentiDi(m)) === cercata);
  if (!pappa) {
    pappa = { id: nuovoId(), foods: [...new Set(alimenti)] };
    bd.meals.push(pappa);
  }
  pappa.liking = giudizio;
  dopoScrittura({ bambino, iso, alimenti, giudizio });
}
