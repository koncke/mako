import sys, re, io
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
# Extrae las recetas GSAP literales de un bundle minificado.
ruta = sys.argv[1]
src = io.open(ruta, encoding='utf-8', errors='replace').read()

def ventanas(pat, antes, despues, etiqueta):
    out = []
    for m in re.finditer(pat, src):
        a = max(0, m.start()-antes); b = min(len(src), m.end()+despues)
        out.append(src[a:b].replace('\n',' '))
    print(f"\n{'='*20} {etiqueta}  ({len(out)}) {'='*20}")
    for i, s in enumerate(out):
        print(f"\n--[{i}]-- {s}")

modo = sys.argv[2] if len(sys.argv) > 2 else 'fromto'
if modo == 'fromto':
    ventanas(r'\.fromTo\(', 90, 300, 'fromTo')
elif modo == 'tl':
    ventanas(r'timeline\(', 60, 700, 'timeline')
elif modo == 'exports':
    # export{a as b, ...}
    for m in re.finditer(r'export\s*\{([^}]{0,4000})\}', src):
        print('\nEXPORT:', m.group(1))
elif modo == 'imports':
    for m in re.finditer(r'import\s*\{([^}]{0,2000})\}\s*from\s*"([^"]+)"', src):
        print('\nIMPORT from', m.group(2), ':', m.group(1))
elif modo == 'chunks':
    for m in re.finditer(r'"([^"]*assets/[^"]*\.(?:js|css))"', src):
        print(m.group(1))
    for m in re.finditer(r'import\("([^"]+)"\)', src):
        print('DYN', m.group(1))
else:
    ventanas(modo, 80, 260, modo)
