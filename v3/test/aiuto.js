// Aiuti dei test della v3.
// Gli stessi moduli di test girano con Node e nel browser. L'unica differenza è come
// si legge un file JSON, e sta tutta dentro leggiJson.

const inNode =
  typeof process !== 'undefined' && !!(process.versions && process.versions.node);

/** Legge un JSON. Il percorso è relativo alla cartella v3/, per esempio 'dati/x.json'. */
export async function leggiJson(percorso) {
  const url = new URL('../' + percorso, import.meta.url);
  if (inNode) {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(url, 'utf8'));
  }
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`non riesco a leggere ${percorso}: ${risposta.status}`);
  return risposta.json();
}

function mostra(valore) {
  if (typeof valore === 'string') return `'${valore}'`;
  if (typeof valore === 'number') return String(valore);
  try {
    const testo = JSON.stringify(valore);
    return testo && testo.length > 200 ? testo.slice(0, 200) + '…' : String(testo);
  } catch {
    return String(valore);
  }
}

export function vero(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio || 'atteso vero, trovato falso');
}

export function uguale(trovato, atteso, messaggio) {
  if (trovato !== atteso) {
    throw new Error(
      `${messaggio || 'valori diversi'}: atteso ${mostra(atteso)}, trovato ${mostra(trovato)}`
    );
  }
}

export function uguali(trovato, atteso, messaggio) {
  const a = JSON.stringify(trovato);
  const b = JSON.stringify(atteso);
  if (a !== b) {
    throw new Error(`${messaggio || 'oggetti diversi'}: atteso ${mostra(atteso)}, trovato ${mostra(trovato)}`);
  }
}

export function vicino(trovato, atteso, tolleranza, messaggio) {
  if (!Number.isFinite(trovato)) {
    throw new Error(`${messaggio || 'numero atteso'}: trovato ${mostra(trovato)}`);
  }
  const scarto = Math.abs(trovato - atteso);
  if (!(scarto <= tolleranza)) {
    throw new Error(
      `${messaggio || 'fuori tolleranza'}: atteso ${atteso} ± ${tolleranza}, trovato ${trovato} (scarto ${scarto})`
    );
  }
}

/** Lancia la funzione e torna l'errore che ha lanciato. Fallisce se non lancia niente. */
export function lancia(funzione, messaggio) {
  try {
    funzione();
  } catch (errore) {
    return errore;
  }
  throw new Error(messaggio || 'atteso un errore, non è stato lanciato niente');
}
