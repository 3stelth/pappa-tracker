// Avvio della v3. Sta in un modulo suo, caricato per ultimo: così ogni sezione si è
// già registrata e sente l'arrivo dei dati con `onCambio`.
//
// Le tabelle OMS le carica la sezione Crescita, che è la sola che le usa.

import { avvia } from './dati.js';

avvia().catch((errore) => console.error('[avvio] i dati non si caricano:', errore));
