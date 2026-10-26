// Pappa Tracker v3 — guscio: intestazione, barra delle sezioni, tendina, avvisi.
// Le sezioni non si importano fra loro: si parlano solo attraverso questo modulo.

export const BAMBINI = ['Gabriel', 'Vittorio'];
export const COLORE  = { Gabriel: '#3B82F6', Vittorio: '#14B8A6' };
export const SIGLA   = { Gabriel: 'g', Vittorio: 'v' };

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                     'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const ABBR = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
                     'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

// ── date e numeri ──────────────────────────────────────────────────────────

function due(n) { return String(n).padStart(2, '0'); }

// Le date si compongono in locale: toISOString passa a UTC e in Italia toglie un giorno.
function aData(iso) { return new Date(iso + 'T00:00:00'); }

export function isoOggi() {
  const d = new Date();
  return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
}

export function dataLunga(iso) {
  const d = aData(iso);
  return d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear();
}

export function dataCorta(iso) {
  const d = aData(iso);
  return d.getDate() + ' ' + ABBR[d.getMonth()];
}

export function numero(valore, decimali) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return '—';
  const s = decimali === undefined ? String(n) : n.toFixed(decimali);
  return s.replace('.', ',');
}

// ── elementi del guscio ────────────────────────────────────────────────────

// Con Node il DOM non c'è. I test delle sezioni importano le sezioni, e ogni sezione
// importa questo modulo: senza guscio in pagina le funzioni pure restano usabili e
// tutto il resto sta fermo.
const DOC = typeof document !== 'undefined' ? document : null;
function trova(id) { return DOC ? DOC.getElementById(id) : null; }

const vista    = trova('vista');
const barra    = trova('barra');
const elTitolo = trova('titolo');
const elSotto  = trova('sotto');
const elPiu    = trova('piu');
const elIngr   = trova('ingranaggio');
const tendina  = trova('tendina');
const tTitolo  = trova('tendina-titolo');
const tSotto   = trova('tendina-sotto');
const tCorpo   = trova('tendina-corpo');
const velo     = trova('velo');
const elAvviso = trova('avviso');

const inPagina = !!vista;

// ── registro delle sezioni ─────────────────────────────────────────────────

function oggiScritto() {
  const d = new Date();
  return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
}

const SEZIONI = {
  oggi:     { titolo: 'Oggi',     sotto: oggiScritto },
  crescita: { titolo: 'Crescita', sotto: '' },
  misure:   { titolo: 'Misure',   sotto: '' },
  pappe:    { titolo: 'Pappe',    sotto: '' },
  vaccini:  { titolo: 'Vaccini',  sotto: '' }
};

let corrente = null;
let inserimento = null;

function testo(v) { return typeof v === 'function' ? v() : (v || ''); }

export function registraSezione(nome, { titolo, sotto, disegna, piu } = {}) {
  const s = SEZIONI[nome];
  if (!s) { console.warn('sezione sconosciuta: ' + nome); return; }
  if (titolo !== undefined) s.titolo = titolo;
  if (sotto !== undefined) s.sotto = sotto;
  s.disegna = disegna;
  s.piu = piu;
  if (corrente === nome) vaA(nome);
}

function segnaposto(nome) {
  const d = document.createElement('div');
  d.className = 'card vuoto';
  d.textContent = 'La sezione «' + SEZIONI[nome].titolo + '» non è ancora pronta.';
  return d;
}

export function vaA(nome) {
  const s = SEZIONI[nome];
  if (!s || !inPagina) return;
  corrente = nome;
  chiudiTendina();
  for (const b of barra.querySelectorAll('.tb')) b.classList.toggle('on', b.dataset.sezione === nome);
  elTitolo.textContent = s.titolo;
  elSotto.textContent = testo(s.sotto);
  elPiu.hidden = typeof s.piu !== 'function';
  vista.textContent = '';
  if (typeof s.disegna === 'function') s.disegna(vista);
  else vista.append(segnaposto(nome));
  window.scrollTo(0, 0);
}

// ── tendina in basso ───────────────────────────────────────────────────────
// Le animazioni partono dal valore che la tendina ha sullo schermo:
// un gesto interrotto a meta si puo invertire senza salti.

function yOra(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  return new DOMMatrixReadOnly(t).m42;
}

function fermaAnim(el) {
  if (!el._anim) return;
  try { el._anim.commitStyles(); } catch (e) { /* la tendina e nascosta */ }
  el._anim.cancel();
  el._anim = null;
}

function animaA(el, y, ms) {
  const da = yOra(el);
  fermaAnim(el);
  const a = el.animate(
    [{ transform: 'translateY(' + da + 'px)' }, { transform: 'translateY(' + y + 'px)' }],
    { duration: ms, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' }
  );
  el._anim = a;
  return a;
}

function fuoriSchermo() { return tendina.offsetHeight + 48; }

export function apriTendina(html, { titolo = '', sotto = '' } = {}) {
  tCorpo.innerHTML = html == null ? '' : html;
  tTitolo.textContent = titolo;
  tTitolo.hidden = !titolo;
  tSotto.textContent = sotto;
  tSotto.hidden = !sotto;
  const eraChiusa = tendina.hidden;
  tendina.hidden = false;
  velo.hidden = false;
  if (eraChiusa) {
    fermaAnim(tendina);
    tendina.style.transform = 'translateY(' + fuoriSchermo() + 'px)';
  }
  tendina.dataset.verso = 'su';
  requestAnimationFrame(() => velo.classList.add('on'));
  animaA(tendina, 0, 320);
  return tendina;
}

export function chiudiTendina() {
  if (!inPagina || tendina.hidden) return;
  tendina.dataset.verso = 'giu';
  velo.classList.remove('on');
  const a = animaA(tendina, fuoriSchermo(), 240);
  a.finished.then(() => {
    if (tendina.dataset.verso !== 'giu') return;
    tendina.hidden = true;
    velo.hidden = true;
    tCorpo.textContent = '';
  }).catch(() => { /* animazione annullata: la tendina e risalita */ });
}

// trascinamento 1:1 col dito sulla presa
(function presaTendina() {
  if (!inPagina) return;
  const presa = trova('presa');
  let y0 = 0, base = 0, dy = 0, attivo = false;
  presa.addEventListener('pointerdown', (e) => {
    attivo = true; dy = 0; y0 = e.clientY;
    fermaAnim(tendina);
    base = yOra(tendina);
    presa.setPointerCapture(e.pointerId);
  });
  presa.addEventListener('pointermove', (e) => {
    if (!attivo) return;
    dy = e.clientY - y0;
    tendina.style.transform = 'translateY(' + Math.max(0, base + dy) + 'px)';
  });
  const fine = () => {
    if (!attivo) return;
    attivo = false;
    if (dy > tendina.offsetHeight / 3) chiudiTendina();
    else { tendina.dataset.verso = 'su'; animaA(tendina, 0, 260); }
  };
  presa.addEventListener('pointerup', fine);
  presa.addEventListener('pointercancel', fine);
})();

// ── avvisi ─────────────────────────────────────────────────────────────────

let orologioAvviso = null;

export function avviso(testoAvviso) {
  if (!inPagina) return;
  elAvviso.textContent = testoAvviso;
  elAvviso.hidden = false;
  requestAnimationFrame(() => elAvviso.classList.add('on'));
  clearTimeout(orologioAvviso);
  orologioAvviso = setTimeout(() => {
    elAvviso.classList.remove('on');
    setTimeout(() => { elAvviso.hidden = true; }, 240);
  }, 2400);
}

// ── inserimento di una misura (lo fornisce misure.js) ──────────────────────

export function registraInserimento(f) { inserimento = f; }

export function apriInserimentoMisura(opzioni) {
  if (typeof inserimento === 'function') inserimento(opzioni);
}

// ── tocchi: rispondono su pointerdown, non al rilascio ─────────────────────

if (inPagina) {
barra.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.tb');
  if (b) vaA(b.dataset.sezione);
});

elPiu.addEventListener('pointerdown', () => {
  const s = SEZIONI[corrente];
  if (s && typeof s.piu === 'function') s.piu();
});

elIngr.addEventListener('pointerdown', () => avviso('Impostazioni: ancora da fare.'));

velo.addEventListener('pointerdown', () => chiudiTendina());

vaA('oggi');
}
