# -*- coding: utf-8 -*-
"""Genera l'icona della v3: la sagoma del bambino su fondo sfumato.

Lancia:  python -I v3/strumenti/genera-icona.py
Scrive:  v3/icona-512.png, v3/icona-180.png, v3/icona.svg

La sagoma e quella della funzione baby() del mockup .claude/mockup/v3b.html,
viewBox 0 0 120 240. Qui le stesse forme si ridisegnano con Pillow.
I PNG non hanno canale alfa: iOS mette il nero dove c'e trasparenza.
La sagoma sta dentro un quadrato piu piccolo dell'icona, cosi resta un
margine su tutti i lati: iOS taglia gli angoli.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

V3 = Path(__file__).resolve().parent.parent

BLU = (0x3B, 0x82, 0xF6)    # #3B82F6, il colore di Gabriel
VERDE = (0x14, 0xB8, 0xA6)  # #14B8A6, il colore di Vittorio

LATO = 2048    # si disegna grande, poi si riduce con LANCZOS
QUOTA = 0.80   # quota del lato occupata dalla sagoma; il resto e margine
U = 14         # pixel per unita del viewBox, con supercampionamento
BORDO = 24     # unita di margine nella tela di lavoro: le braccia ruotate escono dal viewBox
BAVAGLIO = 190  # il bavaglio e bianco meno coperto, cosi si distingue dal corpo

# ── le forme, nelle unita del viewBox 120x240 ──────────────────────────────
# ellissi: (cx, cy, rx, ry)
TESTA = (60, 52, 42, 44)
ORECCHIE = [(17, 56, 8, 10), (103, 56, 8, 10)]
PIEDI = [(44, 226, 17, 12), (76, 226, 17, 12)]
OCCHI = [(45, 52, 5, 6.5), (75, 52, 5, 6.5)]

# rettangoli arrotondati: (x, y, larghezza, altezza, raggio)
GAMBE = [(34, 162, 25, 60, 12.5), (61, 162, 25, 60, 12.5)]
# braccia: come sopra, piu l'angolo in senso orario e il centro di rotazione
BRACCIA = [
    (2, 100, 24, 64, 12, 11, (14, 100)),
    (94, 100, 24, 64, 12, -11, (106, 100)),
]

# tracciati: punto di partenza, poi i segmenti.
# ('c', c1, c2, fine) e una cubica di Bezier, ('l', fine) una retta.
CIUFFO = ((58, 4), [
    ('c', (65, 1), (72, 5), (73, 12)),
    ('c', (74, 17), (71, 21), (67, 23)),
    ('c', (64, 16), (61, 10), (58, 4)),
])
CORPO = ((60, 92), [
    ('c', (39, 92), (31, 101), (29, 116)),
    ('l', (25, 148)),
    ('c', (23, 163), (36, 172), (60, 172)),
    ('c', (84, 172), (97, 163), (95, 148)),
    ('l', (91, 116)),
    ('c', (89, 101), (81, 92), (60, 92)),
])
BAVA = ((29, 150), [
    ('l', (91, 150)),
    ('l', (89, 164)),
    ('c', (88, 176), (78, 184), (60, 184)),
    ('c', (42, 184), (32, 176), (31, 164)),
])
BOCCA = ((51, 68), (60, 75), (69, 68))  # quadratica
BOCCA_SPESSORE = 3.4

# Le stesse forme in SVG, per il favicon. Vengono dal mockup senza cambiamenti:
# se cambi i numeri qui sopra, cambiali anche qui.
SAGOMA_SVG = """\
<path d="M58 4c7-3 14 1 15 8 1 5-2 9-6 11-3-7-6-13-9-19z"/>
<ellipse cx="17" cy="56" rx="8" ry="10"/><ellipse cx="103" cy="56" rx="8" ry="10"/>
<ellipse cx="60" cy="52" rx="42" ry="44"/>
<path d="M60 92c-21 0-29 9-31 24l-4 32c-2 15 11 24 35 24s37-9 35-24l-4-32c-2-15-10-24-31-24z"/>
<rect x="2" y="100" width="24" height="64" rx="12" transform="rotate(11 14 100)"/>
<rect x="94" y="100" width="24" height="64" rx="12" transform="rotate(-11 106 100)"/>
<rect x="34" y="162" width="25" height="60" rx="12.5"/>
<rect x="61" y="162" width="25" height="60" rx="12.5"/>
<ellipse cx="44" cy="226" rx="17" ry="12"/><ellipse cx="76" cy="226" rx="17" ry="12"/>
<path d="M29 150h62l-2 14c-1 12-11 20-29 20s-28-8-29-20z" fill="#BEBEBE"/>
<ellipse cx="45" cy="52" rx="5" ry="6.5" fill="#000"/>
<ellipse cx="75" cy="52" rx="5" ry="6.5" fill="#000"/>
<path d="M51 68q9 7 18 0" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round"/>\
"""


# ── disegno della maschera ────────────────────────────────────────────────

def px(x, y):
    """Dalle unita del viewBox ai pixel della tela di lavoro."""
    return ((x + BORDO) * U, (y + BORDO) * U)


def cubica(p0, p1, p2, p3, passi=28):
    punti = []
    for i in range(1, passi + 1):
        t = i / passi
        m = 1 - t
        a, b, c, d = m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t
        punti.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return punti


def quadratica(p0, p1, p2, passi=24):
    punti = [p0]
    for i in range(1, passi + 1):
        t = i / passi
        m = 1 - t
        punti.append((m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0],
                      m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1]))
    return punti


def tracciato(forma):
    inizio, segmenti = forma
    punti = [inizio]
    ora = inizio
    for s in segmenti:
        if s[0] == 'c':
            punti += cubica(ora, s[1], s[2], s[3])
            ora = s[3]
        else:
            punti.append(s[1])
            ora = s[1]
    return [px(x, y) for x, y in punti]


def ellisse(d, e, colore):
    cx, cy, rx, ry = e
    d.ellipse([px(cx - rx, cy - ry), px(cx + rx, cy + ry)], fill=colore)


def rettondo(d, r, colore):
    x, y, w, h, raggio = r
    d.rounded_rectangle([px(x, y), px(x + w, y + h)], radius=raggio * U, fill=colore)


def braccio(misura, b):
    x, y, w, h, raggio, angolo, centro = b
    strato = Image.new('L', misura, 0)
    rettondo(ImageDraw.Draw(strato), (x, y, w, h, raggio), 255)
    # SVG ruota in senso orario, Pillow in senso antiorario: il segno si inverte.
    return strato.rotate(-angolo, resample=Image.Resampling.BICUBIC, center=px(*centro))


def maschera():
    misura = ((120 + 2 * BORDO) * U, (240 + 2 * BORDO) * U)
    m = Image.new('L', misura, 0)
    d = ImageDraw.Draw(m)
    d.polygon(tracciato(CIUFFO), fill=255)
    for e in ORECCHIE:
        ellisse(d, e, 255)
    ellisse(d, TESTA, 255)
    d.polygon(tracciato(CORPO), fill=255)
    for g in GAMBE:
        rettondo(d, g, 255)
    for p in PIEDI:
        ellisse(d, p, 255)
    for b in BRACCIA:
        m = ImageChops.lighter(m, braccio(misura, b))
    d = ImageDraw.Draw(m)
    d.polygon(tracciato(BAVA), fill=BAVAGLIO)
    for o in OCCHI:
        ellisse(d, o, 0)
    d.line(
        [px(x, y) for x, y in quadratica(*BOCCA)],
        fill=0, width=round(BOCCA_SPESSORE * U), joint='curve',
    )
    return m


# ── fondo sfumato ─────────────────────────────────────────────────────────

def sfondo(lato):
    """Sfumatura in diagonale dal blu al verde acqua.

    Si calcola piccola e si ingrandisce: una sfumatura lineare si interpola
    senza scalini, e il ciclo su 2048x2048 pixel sarebbe lento.
    """
    n = 64
    g = Image.new('RGB', (n, n))
    p = g.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            p[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BLU, VERDE))
    return g.resize((lato, lato), Image.Resampling.BICUBIC)


# ── scrittura dei file ────────────────────────────────────────────────────

def main():
    m = maschera()
    scatola = m.getbbox()
    if scatola is None:
        raise SystemExit('la maschera e vuota: nessuna forma disegnata')
    m = m.crop(scatola)
    lu, au = m.size

    dentro = LATO * QUOTA
    k = dentro / max(lu, au)
    nuova = (max(1, round(lu * k)), max(1, round(au * k)))
    m = m.resize(nuova, Image.Resampling.LANCZOS)

    icona = sfondo(LATO)
    bianco = Image.new('RGB', nuova, (255, 255, 255))
    icona.paste(bianco, ((LATO - nuova[0]) // 2, (LATO - nuova[1]) // 2), m)
    icona = icona.convert('RGB')

    for lato in (512, 180):
        f = V3 / f'icona-{lato}.png'
        icona.resize((lato, lato), Image.Resampling.LANCZOS).save(f)
        print(f'{f.name}: {lato}x{lato} RGB')

    # L'SVG usa la stessa inquadratura: la scatola della sagoma in unita del viewBox.
    bx = scatola[0] / U - BORDO
    by = scatola[1] / U - BORDO
    bl = (scatola[2] - scatola[0]) / U
    ba = (scatola[3] - scatola[1]) / U
    ks = 512 * QUOTA / max(bl, ba)
    tx = 256 - ks * (bx + bl / 2)
    ty = 256 - ks * (by + ba / 2)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#14B8A6"/>
</linearGradient>
<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
<g transform="translate({tx:.2f} {ty:.2f}) scale({ks:.4f})" fill="#fff">
{SAGOMA_SVG}
</g>
</mask>
</defs>
<rect width="512" height="512" fill="url(#f)"/>
<rect width="512" height="512" fill="#fff" mask="url(#m)"/>
</svg>
'''
    f = V3 / 'icona.svg'
    f.write_text(svg, encoding='utf-8')
    print(f'{f.name}: sagoma scalata {ks:.4f}')


if __name__ == '__main__':
    main()
