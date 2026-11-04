import sys, re, io
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ruta = sys.argv[1]; nombres = sys.argv[2].split(',')
src = io.open(ruta, encoding='utf-8', errors='replace').read()
for n in nombres:
    # llamadas al helper: no precedidas de letra/._$ (para no cazar "xxi(")
    pat = re.compile(r'(?<![A-Za-z0-9_$.])' + re.escape(n) + r'\(')
    hits = []
    for m in pat.finditer(src):
        # el cuerpo, balanceando parentesis, hasta 300 chars
        i = m.end(); prof = 1; j = i
        while j < len(src) and prof and j - i < 320:
            if src[j] == '(': prof += 1
            elif src[j] == ')': prof -= 1
            j += 1
        hits.append(src[m.start():j])
    # la definicion lleva "function n(" delante -> se filtra
    defs = len(re.findall(r'function\s+' + re.escape(n) + r'\(', src))
    print(f"\n{'='*16} {n}(  → {len(hits)} llamadas ({defs} def) {'='*16}")
    for h in hits:
        if len(h) > 310: h = h[:310] + '…'
        print(' •', h.replace('\n', ' '))
