// Il tema della pagina: chiaro, scuro, o come il sistema.
//
// La scelta sta in una chiave di localStorage tutta sua, fuori da `stato.data`.
// Motivo: dati.js scrive `stato.data` intero nella riga Supabase, quindi una
// preferenza messa lì arriverebbe su tutti i telefoni di casa. Il tema è di questo
// telefono soltanto.
//
// Qui non si sceglie nessun colore: si scrive solo `data-tema` sulla radice del
// documento. I colori li decide base.css. Senza attributo vale la media query del
// sistema, e il primo disegno della pagina è già giusto.

export const CHIAVE_TEMA = 'pappatracker_tema_v3';

/** In tondo, nell'ordine in cui il tasto li fa girare. */
export const TEMI = ['sistema', 'chiaro', 'scuro'];

export const ASPETTO = {
  sistema: { etichetta: 'Come il sistema', avviso: 'Tema: come il sistema' },
  chiaro: { etichetta: 'Tema chiaro', avviso: 'Tema chiaro' },
  scuro: { etichetta: 'Tema scuro', avviso: 'Tema scuro' },
};

// Le tre icone, nello stile degli altri tasti: 24×24, disegnate col tratto.
// Il mezzo cerchio pieno di «sistema» è l'unico pezzo con un riempimento.
export const ICONA = {
  sistema:
    '<circle cx="12" cy="12" r="8.2"/>' +
    '<path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" style="fill:currentColor" stroke="none"/>',
  chiaro:
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.4v2.2M12 19.4v2.2M4.2 12H2M22 12h-2.2' +
    'M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6"/>',
  scuro: '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
};

/** Il colore della barra di sistema del telefono, uguale al fondo della pagina. */
export const COLORE_BARRA = { chiaro: '#F2F2F7', scuro: '#000000' };

/** Riporta un valore qualsiasi a uno dei tre temi. Quello che non si riconosce vale 'sistema'. */
export function normalizza(valore) {
  return TEMI.includes(valore) ? valore : 'sistema';
}

/** Il tema che viene dopo, a ogni tocco del tasto. */
export function prossimo(tema) {
  const i = TEMI.indexOf(normalizza(tema));
  return TEMI[(i + 1) % TEMI.length];
}

/**
 * Il tema che si vede davvero: 'sistema' diventa chiaro o scuro secondo il telefono.
 * `sistemaScuro` è l'esito di `prefers-color-scheme: dark`.
 */
export function temaEffettivo(scelta, sistemaScuro) {
  const t = normalizza(scelta);
  return t === 'sistema' ? (sistemaScuro ? 'scuro' : 'chiaro') : t;
}

/** Legge la scelta salvata. Senza localStorage, o con un valore strano, dà 'sistema'. */
export function leggiScelta(deposito = depositoLocale()) {
  try {
    return normalizza(deposito && deposito.getItem(CHIAVE_TEMA));
  } catch {
    return 'sistema';
  }
}

/** Salva la scelta. Se il deposito non c'è o rifiuta, non succede niente. */
export function salvaScelta(tema, deposito = depositoLocale()) {
  try {
    if (deposito) deposito.setItem(CHIAVE_TEMA, normalizza(tema));
  } catch {
    /* localStorage spento o pieno: il tema vale solo per questa visita. */
  }
}

function depositoLocale() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function sistemaScuro() {
  try {
    return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

/**
 * Scrive il tema nella pagina: l'attributo sulla radice, il colore della barra di
 * sistema, l'icona e l'etichetta del tasto. `tasto` può mancare.
 */
export function applica(tema, tasto) {
  const doc = globalThis.document;
  if (!doc) return;
  const scelta = normalizza(tema);
  const effettivo = temaEffettivo(scelta, sistemaScuro());
  const radice = doc.documentElement;

  // Due attributi, due lavori: `data-tema` è la scelta (serve al tasto), `data-scuro`
  // è il risultato. Il CSS guarda solo il secondo, così la tavolozza scura sta
  // scritta in un posto solo.
  radice.dataset.tema = scelta;
  if (effettivo === 'scuro') radice.dataset.scuro = '1';
  else delete radice.dataset.scuro;

  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', COLORE_BARRA[effettivo]);

  if (tasto) {
    const svg = tasto.querySelector('svg');
    if (svg) svg.innerHTML = ICONA[scelta];
    tasto.setAttribute('aria-label', ASPETTO[scelta].etichetta);
  }
}

/**
 * Accende il tasto: mette il tema salvato e fa girare i tre stati a ogni tocco.
 * `dillo(testo)` serve a mostrare quale tema è appena entrato: senza, il tasto
 * cambia icona e basta.
 */
export function avvia(tasto, dillo) {
  applica(leggiScelta(), tasto);

  // Con «come il sistema», se il telefono passa a scuro mentre l'app è aperta la
  // pagina deve seguirlo senza ricaricare.
  try {
    const query = globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)');
    if (query && query.addEventListener) {
      query.addEventListener('change', () => applica(leggiScelta(), tasto));
    }
  } catch {
    /* un browser che non sa ascoltare la media query resta sul tema di partenza. */
  }

  if (!tasto) return;
  tasto.addEventListener('pointerdown', () => {
    const nuovo = prossimo(leggiScelta());
    salvaScelta(nuovo);
    applica(nuovo, tasto);
    if (dillo) dillo(ASPETTO[nuovo].avviso);
  });
}
