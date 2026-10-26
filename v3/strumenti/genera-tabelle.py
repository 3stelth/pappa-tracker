#!/usr/bin/env python3
"""Trasforma le tabelle OMS in JSON per la v3.

Le tabelle arrivano dall'Organizzazione Mondiale della Sanità, WHO Child Growth
Standards 2006, maschi, nelle versioni *per giorno di età* (expanded tables):

  peso per età      wfa-boys-zscore-expanded-tables.xlsx
  lunghezza per età lhfa-boys-zscore-expanded-tables.xlsx

Si usano le tabelle per giorno, non quelle per mese: l'interpolazione lineare fra
i mesi interi sbaglia fino a 0,197 in punteggio z, cioè quasi 90 grammi.

Scrive quattro file:
  v3/dati/oms-peso-giorni.json        L, M, S per giorno, le legge l'app
  v3/dati/oms-lunghezza-giorni.json   idem
  v3/test/oms-sd-pubblicati.json      i valori che l'OMS pubblica, li legge il test
  v3/test/riferimento-z.json          casi di controllo calcolati qui, li legge il test

Uso:
  python -I v3/strumenti/genera-tabelle.py <peso.xlsx> <lunghezza.xlsx>
"""
import json
import math
import sys
from pathlib import Path

import openpyxl

GIORNO_MAX = 1856
COLONNE_SD = ["SD3neg", "SD2neg", "SD1neg", "SD0", "SD1", "SD2", "SD3"]
Z_SD = [-3, -2, -1, 0, 1, 2, 3]
# Gli z dei casi di controllo. Niente valori interi: così il test non passa per caso
# su una colonna già pubblicata.
Z_CASI = [-2.5, -1.3, -0.4, 0.37, 1.1, 2.2]

MISURE = {
    "peso": {
        "unita": "kg",
        "fonte": "WHO Child Growth Standards 2006, weight-for-age boys, expanded tables",
    },
    "lunghezza": {
        "unita": "cm",
        "fonte": "WHO Child Growth Standards 2006, length-for-age boys, expanded tables",
    },
}
LICENZA = "CC BY-NC-SA 3.0 IGO"


def valore_a(L, M, S, z):
    """Il valore atteso a un dato punteggio z, dalle LMS."""
    if abs(L) < 1e-9:
        return M * math.exp(S * z)
    return M * (1 + L * S * z) ** (1 / L)


def z_da(valore, L, M, S):
    """Il punteggio z di un valore, dalle LMS."""
    if abs(L) < 1e-9:
        return math.log(valore / M) / S
    return ((valore / M) ** L - 1) / (L * S)


def leggi(percorso):
    """Legge un file OMS e torna (lms, sd), due liste indicizzate per giorno."""
    foglio = openpyxl.load_workbook(percorso, read_only=True).active
    righe = foglio.iter_rows(values_only=True)
    intestazioni = list(next(righe))
    pos = {nome: i for i, nome in enumerate(intestazioni) if nome}
    for atteso in ["Day", "L", "M", "S", *COLONNE_SD]:
        if atteso not in pos:
            raise SystemExit(f"{percorso}: manca la colonna {atteso}")

    lms, sd = [], []
    for giorno, riga in enumerate(r for r in righe if r[pos["Day"]] is not None):
        if int(riga[pos["Day"]]) != giorno:
            raise SystemExit(
                f"{percorso}: i giorni hanno un buco, atteso {giorno}, trovato {riga[pos['Day']]}"
            )
        lms.append([float(riga[pos[c]]) for c in ("L", "M", "S")])
        sd.append([float(riga[pos[c]]) for c in COLONNE_SD])

    if len(lms) != GIORNO_MAX + 1:
        raise SystemExit(f"{percorso}: attesi {GIORNO_MAX + 1} giorni, trovati {len(lms)}")
    return lms, sd


def scrivi(percorso, dati):
    percorso.parent.mkdir(parents=True, exist_ok=True)
    percorso.write_text(
        json.dumps(dati, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"  scritto {percorso} ({percorso.stat().st_size // 1024} KB)")


def main(argomenti):
    if len(argomenti) != 2:
        raise SystemExit(__doc__)

    radice = Path(__file__).resolve().parents[1]  # la cartella v3/
    tabelle = dict(zip(MISURE, argomenti))
    sd_pubblicati = {"z": Z_SD}
    casi = []

    for misura, percorso in tabelle.items():
        lms, sd = leggi(percorso)
        print(f"{misura}: {len(lms)} giorni")
        scrivi(
            radice / "dati" / f"oms-{misura}-giorni.json",
            {
                "misura": misura,
                "unita": MISURE[misura]["unita"],
                "fonte": MISURE[misura]["fonte"],
                "licenza": LICENZA,
                "giorni": lms,
            },
        )
        sd_pubblicati[misura] = sd

        # I casi di controllo: un valore arrotondato come lo scriverebbe l'OMS, e il
        # punteggio z che quel valore arrotondato deve dare. Il test ricalcola lo z
        # e confronta. Nessun dato della famiglia entra qui.
        for i, giorno in enumerate(range(0, GIORNO_MAX + 1, 9)):
            L, M, S = lms[giorno]
            z = Z_CASI[i % len(Z_CASI)]
            valore = round(valore_a(L, M, S, z), 3)
            casi.append(
                {
                    "misura": misura,
                    "giorni": giorno,
                    "valore": valore,
                    "z": round(z_da(valore, L, M, S), 7),
                }
            )

    scrivi(radice / "test" / "oms-sd-pubblicati.json", sd_pubblicati)
    scrivi(radice / "test" / "riferimento-z.json", {"casi": casi})
    print(f"{len(casi)} casi di riferimento")


if __name__ == "__main__":
    main(sys.argv[1:])
