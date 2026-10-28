// Avvio della v3. Sta in un modulo suo, caricato per ultimo: così ogni sezione si è
// già registrata e sente l'arrivo dei dati con `onCambio`.
//
// Le tabelle OMS le carica la sezione Crescita, che è la sola che le usa.
//
// Prima dei dati viene l'accesso: senza token Supabase non risponde, quindi se non c'è
// una sessione si mostra la schermata e `avvia` parte solo dopo.

import { avvia } from './dati.js';
import { haSessione, onScaduta } from './accesso.js';
import { mostraAccesso } from './accesso-vista.js';

function partenza() {
  avvia().catch((errore) => console.error('[avvio] i dati non si caricano:', errore));
}

// Si registra sempre, anche quando la sessione c'è: serve proprio nel caso in cui
// scada mentre l'app è aperta, che è il caso di tutte le notti.
onScaduta(() => mostraAccesso(partenza));

if (haSessione()) partenza();
else mostraAccesso(partenza);
