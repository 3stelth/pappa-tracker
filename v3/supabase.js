// Indirizzo e chiave pubblica del progetto Supabase, in un posto solo.
//
// Stanno qui e non dentro dati.js perché ora servono a due moduli: dati.js per leggere
// e scrivere le righe, accesso.js per l'accesso e il rinnovo del token. Scritti due
// volte, prima o poi uno dei due resterebbe indietro.
//
// La chiave «publishable» è pubblica di proposito: sta nel sorgente della pagina e
// chiunque la può leggere. Non è un segreto e non apre niente da sola. Quello che si
// può fare con Supabase lo decidono le policy del database, non questa riga.

export const URL_SUPABASE = 'https://ukcwajbbybkobaroyqiq.supabase.co';
export const CHIAVE_SUPABASE = 'sb_publishable_jicoWcdW87NzVXFQTx3fxA_dJOv_dVe';
