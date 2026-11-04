# -*- coding: utf-8 -*-
"""Tabla comparativa: para cada demo, la FORMA de cada receta de entrada con sus
   valores literales. Clasifica cada .fromTo( por las propiedades de su estado
   inicial, que es lo que define el gesto."""
import sys, re, io, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMOS = os.path.join(RAIZ, 'demos')
COMILLAS = chr(96) + '"' + "'"


def bloque(src, i, ab, ce):
    while i < len(src) and src[i].isspace():
        i += 1
    if i >= len(src) or src[i] != ab:
        return None
    prof, j = 1, i + 1
    while j < len(src) and prof:
        c = src[j]
        if c == ab:
            prof += 1
        elif c == ce:
            prof -= 1
        elif c in COMILLAS:
            q = c
            j += 1
            while j < len(src) and src[j] != q:
                if src[j] == '\\':
                    j += 1
                j += 1
        j += 1
    return (i, j)


def args_de(src, i):
    """los argumentos de una llamada, partidos en el nivel 0 de coma"""
    b = bloque(src, i, '(', ')')
    if not b:
        return []
    s = src[b[0] + 1:b[1] - 1]
    partes, prof, act = [], 0, ''
    k = 0
    while k < len(s):
        c = s[k]
        if c in '([{':
            prof += 1
        elif c in ')]}':
            prof -= 1
        elif c in COMILLAS:
            q = c
            act += c
            k += 1
            while k < len(s) and s[k] != q:
                act += s[k]
                k += 1
            act += s[k] if k < len(s) else ''
            k += 1
            continue
        if c == ',' and prof == 0:
            partes.append(act.strip())
            act = ''
        else:
            act += c
        k += 1
    if act.strip():
        partes.append(act.strip())
    return partes


FORMAS = [
    ('TITULO letra', r'yPercent:\s*1\d\d'),
    ('iris clipPath', r'clipPath'),
    ('tarjeta rota', r'rotation:\s*[^0]'),
    ('tile y+scale', r'y:\s*-?\d+[\s\S]{0,40}scale:\s*\.9'),
    ('escala desde', r'scale:\s*\.[0-8]\b'),
    ('chip y neg', r'y:\s*-\d+[\s\S]{0,30}scale:\s*1\.'),
    ('barra scaleX', r'scaleX:\s*0'),
    ('anillo dash', r'strokeDash'),
    ('texto y', r'^\{?\s*opacity:\s*0\s*,\s*y:\s*\d+\s*\}?$'),
    ('lateral x', r'x:\s*-?\d+'),
    ('sheet %', r'[xy]Percent:\s*100'),
]


def forma(desde):
    d = ' '.join(desde.split())
    out = []
    for nom, pat in FORMAS:
        if re.search(pat, d):
            out.append(nom)
    return out[0] if out else 'otro'


def mirar(slug):
    p = os.path.join(DEMOS, slug, 'main.js')
    if not os.path.exists(p):
        return None
    s = io.open(p, encoding='utf-8', errors='replace').read()
    filas = []
    for m in re.finditer(r'\.fromTo\(', s):
        a = args_de(s, m.end() - 1)
        if len(a) < 3:
            continue
        desde, hasta = a[1], a[2]
        dur = re.search(r'duration:\s*([\w.()*+ ]{1,18})', hasta)
        ease = re.search(r'ease:\s*.(\w[\w.()\d, ]{1,22}).', hasta)
        stag = re.search(r'stagger:\s*([\w.()*+ ]{1,14})', hasta)
        filas.append((forma(desde), ' '.join(desde.split())[:68],
                      (dur.group(1) if dur else '-').strip(),
                      (ease.group(1) if ease else '(default)').strip(),
                      (stag.group(1) if stag else '-').strip()))
    return filas


if __name__ == '__main__':
    slugs = sys.argv[1:] if len(sys.argv) > 1 else sorted(
        d for d in os.listdir(DEMOS) if os.path.isdir(os.path.join(DEMOS, d)))
    for slug in slugs:
        filas = mirar(slug)
        if filas is None:
            continue
        print('\n' + '=' * 96)
        print('  ' + slug.upper() + '   (' + str(len(filas)) + ' recetas)')
        print('=' * 96)
        vistos = set()
        for f, desde, dur, ease, stag in filas:
            k = (f, desde[:40], dur, ease)
            if k in vistos:
                continue
            vistos.add(k)
            print('  %-14s %-68s  dur %-10s %-20s stg %s' % (f, desde, dur, ease, stag))
