# Arma app/dashboard/disenos/velocidad-css.ts desde tend.css (la hoja de la copia de Tend). 10/11/2026.
#   python -I docs/diseno/mockups-dashboard/velocidad-tend/armar-css.py
# Lo que hace, como el armador de las otras hojas copiadas (hallazgos-templates-dashboard.md §13 y §33):
#   · saca el ARMAZÓN (lo que va entre ARMAZON-INICIO y ARMAZON-FIN: la barra de la izquierda, la de arriba y la del teléfono);
#   · pone todo adentro de .vt y le pone el prefijo vt- a cada clase (también a la segunda de un selector compuesto: «(?<!\d)\.»);
#   · los resets por etiqueta van con :where() (§13: si no, le ganan a las clases de la hoja);
#   · :root → .vt; el tema oscuro de Tend (:root[data-theme="dark"]) → .vt:where([data-tema="oscuro"] *) (§36);
#   · @media (max-width: 760px) → @container vt (max-width: 760px): adentro del Dashboard manda el ancho de la hoja, no el de la ventana;
#   · los @keyframes con el prefijo.
# Lo de la adaptación (lo que se toca, la hoja compartida, la grabadora) lo agrega este mismo script al final, desde ADAPTACION.
import re, pathlib
AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parents[3]
css = (AQUI / 'tend.css').read_text(encoding='utf-8')
css = re.sub(r'/\* ARMAZON-INICIO.*?ARMAZON-FIN[^*]*\*/', '', css, flags=re.S)
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)  # los comentarios: el porqué vive en la hoja de la copia

DARK = '.vt:where([data-tema="oscuro"] *)'
ETIQUETAS = {'button', 'a', 'h1', 'h2', 'h3', 'p', 'ul', 'svg', 'li', 'b', 'small', 'i', 'span', 'kbd', 'em'}

def clases(sel: str) -> str:
    # cada .clase → .vt-clase, también la de «svg.i» (no toca «1.5px»: sólo recibe selectores)
    return re.sub(r'(?<!\d)\.(?=[a-zA-Z_-])', '.vt-', sel)

def selector(sel: str) -> str:
    sel = sel.strip()
    if sel == ':root':
        return '.vt'
    if sel.startswith(':root[data-theme="dark"]'):
        resto = sel[len(':root[data-theme="dark"]'):].strip()
        return DARK + ((' ' + clases(resto)) if resto else '')
    if sel in ('html, body',):
        return None
    if sel == 'body':
        return '.vt'
    if sel == '*':
        return '.vt, .vt *'
    if sel == ':focus-visible':
        return '.vt :focus-visible'
    if sel == '*, *::before, *::after':
        return '.vt, .vt *, .vt *::before, .vt *::after'
    partes = []
    for s in sel.split(','):
        s = s.strip()
        tag = re.match(r'^([a-z][a-z0-9]*)(\b.*)$', s)
        if tag and tag.group(1) in ETIQUETAS and not s.startswith('svg.'):
            partes.append(f'.vt :where({tag.group(1)}){clases(tag.group(2))}')
        elif s.startswith('svg.'):
            partes.append('.vt svg' + clases(s[3:]))
        else:
            partes.append('.vt ' + clases(s))
    return ', '.join(partes)

def armar(bloque: str) -> str:
    out, i = [], 0
    while i < len(bloque):
        j = bloque.find('{', i)
        if j < 0:
            break
        cab = bloque[i:j].strip()
        if cab.startswith('@media') or cab.startswith('@container') or cab.startswith('@supports'):
            prof, k = 1, j + 1
            while prof:
                prof += {'{': 1, '}': -1}.get(bloque[k], 0); k += 1
            adentro = armar(bloque[j + 1:k - 1])
            if cab.startswith('@media') and 'max-width' in cab:
                cab = cab.replace('@media', '@container vt')
            out.append(f'{cab} {{\n{adentro}}}\n')
            i = k
            continue
        k = bloque.find('}', j)
        cuerpo = bloque[j + 1:k].strip()
        if cab.startswith('@font-face'):
            out.append(f'{cab} {{ {cuerpo} }}\n')
        elif cab.startswith('@keyframes'):
            # @keyframes tiene bloques adentro
            prof, k = 1, j + 1
            while prof:
                prof += {'{': 1, '}': -1}.get(bloque[k], 0); k += 1
            out.append(cab.replace('@keyframes ', '@keyframes vt-') + ' ' + bloque[j:k].strip() + '\n')
            i = k
            continue
        else:
            sel = selector(cab)
            if sel:
                cuerpo = cuerpo.replace('animation: flash', 'animation: vt-flash').replace('animation: fade', 'animation: vt-fade')
                out.append(f'{sel} {{ {cuerpo} }}\n')
        i = k + 1
    return ''.join(out)

hoja = armar(css)
hoja = hoja.replace('.vt { box-sizing: border-box; }', '')
# El contenedor de la hoja (para @container vt) y el fondo de la página de la copia.
hoja = hoja.replace('.vt {\n  --font', '.vt {\n  --font', 1)
ADAPTACION = (AQUI / 'adaptacion.css').read_text(encoding='utf-8')
ADAPTACION = re.sub(r'/\*.*?\*/', '', ADAPTACION, flags=re.S)

ts = f"""// =============================================================================
// velocidad-css — la hoja de estilos de «Velocidad de llamada» con su diseño propio (la copia de Tend, «Today»)
// =============================================================================
// GENERADA por docs/diseno/mockups-dashboard/velocidad-tend/armar-css.py desde la hoja de la copia (tend.css) y lo de la adaptación
// (adaptacion.css): todo adentro de .vt, cada clase con el prefijo vt-, sin el armazón de Tend (la barra de la izquierda, la de arriba
// y la del teléfono), los resets por etiqueta con :where() y con @container en lugar de @media. No se edita a mano: se cambia la copia
// y se vuelve a correr el armador. Escrita desde lo MEDIDO del demo: nada del código de la tienda.
// Paleta doble: claro por defecto y oscuro bajo [data-tema="oscuro"] de <html> (§36 de hallazgos-templates-dashboard.md).
// ⚠️ En un template literal no va ningún backtick ni un «dólar con llave».
// =============================================================================

export const CSS_VELOCIDAD = `
{hoja}{ADAPTACION.strip()}
`;
"""
assert '`' not in hoja + ADAPTACION and '${' not in hoja + ADAPTACION
(RAIZ / 'app/dashboard/disenos/velocidad-css.ts').write_text(ts, encoding='utf-8')
print('ok', len(ts))
