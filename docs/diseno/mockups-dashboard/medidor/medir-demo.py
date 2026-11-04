# -*- coding: utf-8 -*-
"""Mide el movimiento de un demo de codeandchill LEYENDO EL CODIGO FUENTE.
   Baja el bundle, encuentra la libreria de helpers GSAP con sus recetas literales,
   resuelve la tabla de alias export/import y lee la funcion de entrada de cada
   pagina para sacar el ORDEN, los delays y los SELECTORES."""
import sys, re, io, os, subprocess
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = 'https://demo.codeandchill.store'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMOS = os.path.join(RAIZ, 'demos')
COMILLAS = chr(96) + '"' + "'"          # backtick, doble, simple


def bajar(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    r = subprocess.run(['curl', '-s', '-f', '-o', dest, url], capture_output=True)
    ok = r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 0
    if not ok and os.path.exists(dest):
        os.remove(dest)
    return ok


def leer(p):
    return io.open(p, encoding='utf-8', errors='replace').read()


def bloque(src, i, ab, ce):
    """desde el primer `ab` en/tras i (salteando espacios), el bloque balanceado"""
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


def cuerpo_fn(src, tras_nombre):
    """los args (...) y despues el cuerpo {...}, los dos balanceados.
       Sin esto, un parametro destructurado  function f(e,{y:t=26})  hace que un
       find('{') ingenuo tome el OBJETO DE ARGUMENTOS por cuerpo: el grep da cero
       fromTo y uno concluye que la plantilla no anima."""
    a = bloque(src, tras_nombre, '(', ')')
    if not a:
        return None, None
    b = bloque(src, a[1], '{', '}')
    if not b:
        return None, None
    return src[a[0]:a[1]], src[b[0]:b[1]]


def funciones_con_fromto(src):
    out = {}
    for m in re.finditer(r'function\s+([A-Za-z_$][\w$]*)\s*\(', src):
        args, cu = cuerpo_fn(src, m.end() - 1)
        if cu is None or len(cu) > 2000:
            continue
        if '.fromTo(' in cu or ('ease:' in cu and ('.to(' in cu or '.set(' in cu)):
            out[m.group(1)] = (args + cu).replace('\n', ' ')
    return out


def tabla_export(src):
    t = {}
    for m in re.finditer(r'export\s*\{([^}]{0,8000})\}', src):
        for par in m.group(1).split(','):
            par = par.strip()
            mm = re.match(r'([\w$]+)\s+as\s+([\w$]+)$', par)
            if mm:
                t[mm.group(1)] = mm.group(2)
            elif re.match(r'^[\w$]+$', par):
                t[par] = par
    return t


def tabla_import(src):
    t = {}
    for m in re.finditer(r'import\s*\{([^}]{0,5000})\}\s*from\s*["\']([^"\']+)["\']', src):
        for par in m.group(1).split(','):
            par = par.strip()
            mm = re.match(r'([\w$]+)\s+as\s+([\w$]+)$', par)
            if mm:
                t[mm.group(2)] = mm.group(1)
            elif re.match(r'^[\w$]+$', par):
                t[par] = par
    return t


def ventanas_fromto(src, antes=110, despues=420, tope=22):
    """Para los demos de REACT: las animaciones no viven en funciones nombradas sino
       dentro de useLayoutEffect, asi que no hay 'libreria' que resolver por alias.
       Un extractor que exige  function X(  da CERO ahi, y el cero es del instrumento."""
    out, vistos = [], set()
    for m in re.finditer(r'\.(?:fromTo|timeline)\(', src):
        a = max(0, m.start() - antes)
        s = src[a: m.end() + despues].replace('\n', ' ')
        clave = s[antes - 10: antes + 90]
        if clave in vistos:
            continue
        vistos.add(clave)
        out.append(s)
        if len(out) >= tope:
            break
    return out


def es_react(src):
    return ('useLayoutEffect' in src or 'useEffect' in src) and 'function ' in src


def css_movimiento(css):
    """las reglas de hover/active/focus y los keyframes: lo que NO se ve en reposo"""
    L = []
    for m in re.finditer(r'([^{}]{0,220}:(?:hover|active|focus-visible|focus-within)[^{}]{0,220})\{([^{}]{0,300})\}', css):
        sel = ' '.join(m.group(1).split())
        cuerpo = ' '.join(m.group(2).split())
        if cuerpo:
            L.append(sel + ' { ' + cuerpo + ' }')
    K = []
    for m in re.finditer(r'@keyframes\s+([\w-]+)\s*\{', css):
        b = bloque(css, m.end() - 1, '{', '}')
        if b:
            K.append('@keyframes ' + m.group(1) + ' ' + ' '.join(css[b[0]:b[1]].split())[:260])
    T = sorted(set(' '.join(m.group(0).split())
                   for m in re.finditer(r'transition:[^;}]{0,120}', css)))
    return L, K, T


def fn_que_llama(src, locales, cuantas=3):
    """las funciones del chunk que reparten DELAYS sobre varios helpers: la entrada"""
    res = []
    for m in re.finditer(r'function\s+([\w$]*)\s*\(', src):
        args, cu = cuerpo_fn(src, m.end() - 1)
        if cu is None:
            continue
        n = sum(1 for L in locales if re.search(r'(?<![\w$.])' + re.escape(L) + r'\(', cu))
        if n < 1:
            continue
        peso = n * 10 + cu.count('delay:') * 3 + cu.count('.set(') * 2
        res.append((m.group(1), args, n, peso, cu))
    res.sort(key=lambda x: -x[3])
    return res[:cuantas]


def medir(slug, paginas=None, tope=2600):
    dir_ = os.path.join(DEMOS, slug)
    html_p = os.path.join(dir_, 'page.html')
    if not bajar(BASE + '/' + slug + '/', html_p):
        return '[' + slug + '] NO SE PUDO BAJAR'
    html = leer(html_p)
    mains = re.findall(r'src="(/[^"]*?/assets/[^"]+\.js)"', html)
    if not mains:
        return '[' + slug + '] sin bundle en el HTML'
    main_p = os.path.join(dir_, 'main.js')
    bajar(BASE + mains[0], main_p)
    main = leer(main_p)

    lib = funciones_con_fromto(main)
    exp = tabla_export(main)
    inv = {v: k for k, v in exp.items()}
    chunks = sorted(set(re.findall(r'assets/([\w.-]+\.js)', main)))
    crudo_fromto = main.count('.fromTo(')
    # una medicion que da CERO es sospechosa: si no hay libreria pero SI hay fromTo,
    # el demo es de React y las recetas estan en useLayoutEffect.
    arq = 'react' if (len(lib) < 4 and crudo_fromto >= 3) or es_react(main) else 'vanilla'

    L = ['#' * 78,
         '#  ' + slug.upper() + '   bundle ' + str(len(main) // 1024) + 'kB - '
         + str(len(lib)) + ' helpers - ' + str(len(chunks)) + ' chunks - ARQ ' + arq.upper()
         + ' - ' + str(crudo_fromto) + ' fromTo crudos',
         '#' * 78,
         '', 'CHUNKS: ' + (', '.join(chunks) if chunks else '(ninguno: todo en el bundle)')]

    if arq == 'vanilla':
        L += ['', '=' * 28 + ' LA LIBRERIA DE ENTRADAS ' + '=' * 28]
        for n, cu in lib.items():
            if len(cu) > 560:
                cu = cu[:560] + '...'
            L.append('')
            L.append('[' + n + ' -> export ' + exp.get(n, '(no exp)') + ']  ' + cu)
    else:
        L += ['', '=' * 24 + ' RECETAS (React: dentro de useLayoutEffect) ' + '=' * 24]
        for s in ventanas_fromto(main):
            L.append('')
            L.append('- ' + s)

    for m in re.finditer(r'timeline\(', main):
        ctx = main[max(0, m.start() - 170): m.start() + 1700].replace('\n', ' ')
        if '.add(' in ctx or 'fromTo' in ctx:
            L.append('')
            L.append('=' * 26 + ' TIMELINE DEL ARMAZON ' + '=' * 26)
            L.append(ctx)
            break

    # el CSS: hover, active, focus y keyframes (invisibles en el estilo en reposo)
    cssu = re.findall(r'href="(/[^"]*?/assets/[^"]+\.css)"', html)
    if cssu:
        css_p = os.path.join(dir_, 'main.css')
        if bajar(BASE + cssu[0], css_p):
            H, K, T = css_movimiento(leer(css_p))
            L += ['', '=' * 26 + ' CSS: HOVER / ACTIVE / FOCUS ' + '=' * 26]
            L += ['  ' + h for h in H[:70]]
            L += ['', '  -- keyframes --'] + ['  ' + k for k in K[:20]]
            L += ['', '  -- transitions --'] + ['  ' + t for t in T[:25]]

    for ch in chunks:
        base_ch = ch.split('-')[0]
        if paginas and base_ch not in paginas:
            continue
        ch_p = os.path.join(dir_, ch)
        if not bajar(BASE + '/' + slug + '/assets/' + ch, ch_p):
            continue
        cs = leer(ch_p)
        imp = tabla_import(cs)
        mapa = {}
        for loc, expn in imp.items():
            orig = inv.get(expn, expn)
            if orig in lib:
                mapa[loc] = orig
        L.append('')
        L.append('=' * 24 + ' PAGINA ' + ch + ' (' + str(len(cs) // 1024) + 'kB) ' + '=' * 24)
        if mapa:
            L.append('  alias: ' + ', '.join(k + '=' + v for k, v in sorted(mapa.items())))
            for nom, args, n, peso, cu in fn_que_llama(cs, list(mapa.keys())):
                if len(cu) > tope:
                    cu = cu[:tope] + '...'
                L.append('')
                L.append('  >>> function ' + nom + args + '  [' + str(n) + ' helpers]')
                L.append(cu)
        else:
            # React, o un chunk que anima por su cuenta: ventanas crudas
            L.append('  (sin helpers importados: recetas crudas)')
            for s in ventanas_fromto(cs, 130, 520, 14):
                L.append('')
                L.append('  - ' + s)
    txt = '\n'.join(L)
    io.open(os.path.join(dir_, 'INFORME.txt'), 'w', encoding='utf-8').write(txt)
    return ('[' + slug + '] ok - ' + str(len(lib)) + ' helpers - '
            + str(len(chunks)) + ' chunks - informe ' + str(len(txt) // 1024) + 'kB')


if __name__ == '__main__':
    slug = sys.argv[1]
    pags = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] != '-' else None
    print(medir(slug, pags))
