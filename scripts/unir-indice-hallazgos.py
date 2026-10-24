# Resuelve los choques de una TABLA del índice de hallazgos (docs/hallazgos.md) en un merge, fila por fila contra la base,
# comparando SIN espacios ni asteriscos (así la reparación de las negritas no cuenta como un cambio):
#   · una fila de HEAD con el mismo contenido que una de la base: no la toqué, gana la de MERGE_HEAD;
#   · una fila de HEAD sin NINGUNA entrada de la base: es nueva, queda como está;
#   · una fila de HEAD que es una de la base con entradas nuevas: esas entradas van ADELANTE de la fila de MERGE_HEAD de la
#     misma área (la que más comparte con la base), si no están ya.
# Después, las negritas que rompe el resolvedor de tablas viejo («**Título **:»): fuera el espacio antes de un `**` que
# sigue con `:`, `,`, `;`, `—` o un espacio (en un índice sano eso no aparece nunca). Y la verificación: ninguna entrada de
# HEAD ni de MERGE_HEAD se pierde. Uso, con el merge a medias: python -I scripts/unir-indice-hallazgos.py . [docs/hallazgos.md]
# Por qué existe y qué rompía el anterior: docs/hallazgos-infra.md → «El resolvedor de tablas rompía las negritas».
import re, subprocess, sys

REPO = sys.argv[1]
ARCH = sys.argv[2] if len(sys.argv) > 2 else 'docs/hallazgos.md'

def git(*a):
    return subprocess.run(['git', '-C', REPO, *a], capture_output=True).stdout.decode('utf-8')

def show(ref):
    return git('show', f'{ref}:{ARCH}').replace('\r\n', '\n')

plano = lambda x: re.sub(r'[\s*]', '', x)
REPARAR = re.compile(r' \*\*(?=[:,; ]|—)')
reparar = lambda t: REPARAR.sub('**', t)
ENTRADA = re.compile(r'(?=\*\*[^*]{3,}?\s?\*\*\s?:)')

def partes(l):
    if not l.startswith('| ') or l.count(' | ') < 2:
        return None, ''
    a, b, c = l.split(' | ', 2)
    return f'{a} | {b}', (c[:-2] if c.endswith(' |') else c)

def entradas(celda):
    return [e.strip() for e in ENTRADA.split(celda) if len(plano(e)) > 25]

base_ref = git('merge-base', 'HEAD', 'MERGE_HEAD').strip()
base_filas = [l for l in show(base_ref).split('\n') if partes(l)[0]]
base_planos = {plano(l) for l in base_filas}
base_entradas = set()
for l in base_filas:
    base_entradas |= {plano(e) for e in entradas(partes(l)[1])}

def resolver(m):
    h, t = m.group(1).split('\n'), [reparar(x) for x in m.group(2).split('\n')]
    nuevas = []
    for l in h:
        clave, celda = partes(l)
        if clave is None:
            continue
        if plano(l) in base_planos:
            continue  # no la toqué (o sólo le reparé espacios): gana la de main
        mias = entradas(celda)
        agregadas = [e for e in mias if plano(e) not in base_entradas]
        if len(agregadas) == len(mias):
            nuevas.append(reparar(l))  # una fila entera nueva
            continue
        cand = [k for k, x in enumerate(t) if partes(x)[0] == clave]
        assert cand, ('no hay en main una fila del área', clave)
        k = max(cand, key=lambda k: sum(1 for e in entradas(partes(t[k])[1]) if plano(e) in base_entradas))
        c2, celda2 = partes(t[k])
        faltan = [e for e in agregadas if plano(e) not in plano(celda2)]
        if faltan:
            t[k] = f'{c2} | {" ".join(faltan)} {celda2} |'
    return '\n'.join(nuevas + t)

p = f'{REPO}/{ARCH}'
s = open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')
r, n = re.subn(r'<<<<<<< [^\n]*\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]*', resolver, s, flags=re.S)
r = reparar(r)
assert not re.search(r'^(<<<<<<<|=======|>>>>>>>)', r, re.M)
pr = plano(r)
falta = 0
for ref in ('HEAD', 'MERGE_HEAD'):
    for l in show(ref).split('\n'):
        if partes(l)[0]:
            for e in entradas(partes(l)[1]):
                if plano(e) not in pr:
                    falta += 1
                    print(f'FALTA de {ref}: {e[:120]}')
open(p, 'w', encoding='utf-8', newline='').write(r.replace('\n', nl))
print(f'{n} choque(s) · entradas perdidas: {falta} · cierres rotos que quedan: {len(re.findall(r" [*][*](?:[:,; ]|—)", r))}')
