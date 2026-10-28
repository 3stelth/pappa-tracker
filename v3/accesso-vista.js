// La schermata d'accesso: email, password, un tasto.
//
// Niente registrazione e niente «password dimenticata»: l'account è uno solo e le
// iscrizioni su Supabase sono chiuse. Chi perde la password la cambia dal pannello
// Supabase, non da qui.
//
// Finché questa schermata è aperta il guscio dell'app resta nascosto (lo fa
// `data-fuori` sul body, in accesso.css) e dati.js non viene nemmeno chiamato: senza
// token non potrebbe leggere niente.

import { entra } from './accesso.js';

const RIQUADRO = `
  <form class="acc-card card" id="acc-form" novalidate>
    <div class="acc-t">Pappa Tracker</div>
    <div class="acc-s">Gabriel &amp; Vittorio</div>
    <label class="acc-campo">
      <span>Email</span>
      <input type="email" id="acc-email" autocomplete="username"
             inputmode="email" autocapitalize="off" spellcheck="false" required>
    </label>
    <label class="acc-campo">
      <span>Password</span>
      <input type="password" id="acc-pwd" autocomplete="current-password" required>
    </label>
    <button class="save" type="submit" id="acc-vai">Entra</button>
    <div class="acc-err" id="acc-err" hidden></div>
  </form>
`;

/** Mostra la schermata. `poi` viene chiamata quando si è entrati. */
export function mostraAccesso(poi) {
  const posto = document.getElementById('accesso');
  if (!posto) {
    console.error('[accesso] manca il contenitore #accesso: la schermata non si mostra');
    return;
  }
  apri(posto, poi);
}

function apri(posto, poi) {
  document.body.dataset.fuori = '1';
  posto.hidden = false;
  posto.innerHTML = RIQUADRO;

  const form = posto.querySelector('#acc-form');
  const campoEmail = posto.querySelector('#acc-email');
  const campoPwd = posto.querySelector('#acc-pwd');
  const tasto = posto.querySelector('#acc-vai');
  const errore = posto.querySelector('#acc-err');

  campoEmail.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = campoEmail.value.trim();
    const password = campoPwd.value;
    if (!email || !password) {
      mostraErrore(errore, 'Servono email e password.');
      return;
    }

    tasto.disabled = true;
    tasto.textContent = 'Entro…';
    errore.hidden = true;
    try {
      await entra(email, password);
      chiudi(posto);
      poi();
    } catch (guaio) {
      mostraErrore(errore, guaio.message);
      tasto.disabled = false;
      tasto.textContent = 'Entra';
      campoPwd.value = '';
      campoPwd.focus();
    }
  });
}

function chiudi(posto) {
  posto.hidden = true;
  posto.innerHTML = '';
  delete document.body.dataset.fuori;
}

function mostraErrore(dove, testo) {
  dove.textContent = testo;
  dove.hidden = false;
}
