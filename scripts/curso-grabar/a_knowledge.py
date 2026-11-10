# Escribe la pestaña «Transcripción» de cada clase del curso en su documento del portal (public/cono-doc/…json).
#   python -I a_knowledge.py <carpeta del repo>        (por ejemplo, un worktree propio)
# Sale de transcripciones/<NN - título>[ (parte k de m)].json (ElevenLabs scribe sobre el audio grabado, bajado a 1x).
# Una clase con varios videos se escribe sólo cuando están TODAS sus partes. Imprime qué clases escribió.
import html, json, os, sys

BASE = "C:/cursos/programa-meta-ads-the-net-lab"
REPO = sys.argv[1]
SLUG_CURSO = "programa-meta-ads-the-net-lab"
NOTA = ("Transcripción automática del audio de la clase, sin corregir: puede confundir nombres propios y "
        "términos técnicos.")
plan = json.load(open(f"{BASE}/plan.json", encoding="utf-8"))

def parrafos(tx):
    """Corta en las pausas del habla (> 0,9 s a velocidad normal) cuando el párrafo ya es largo; nunca deja uno eterno."""
    pal = tx.get("palabras") or []
    if not pal:
        return [tx.get("texto", "").strip()] if tx.get("texto") else []
    out, cur = [], []
    for i, w in enumerate(pal):
        cur.append(w["t"])
        txt = " ".join(cur)
        fin_frase = w["t"].endswith((".", "?", "!", "…"))
        pausa = (pal[i + 1]["a"] - w["b"]) if i + 1 < len(pal) else 99
        if (fin_frase and ((pausa > 0.9 and len(txt) > 280) or len(txt) > 900)) or len(txt) > 1500:
            out.append(txt); cur = []
    if cur: out.append(" ".join(cur))
    return [p.replace(" ,", ",").replace(" .", ".").strip() for p in out if p.strip()]

escritas, faltan = [], []
for c in plan["clases"]:
    vids = c.get("videos") or []
    if not vids: continue
    nombres = [c["archivo"] + (f" (parte {k + 1} de {len(vids)})" if len(vids) > 1 else "") for k in range(len(vids))]
    rutas = [f"{BASE}/transcripciones/{nm}.json" for nm in nombres]
    if not all(os.path.exists(r) for r in rutas):
        faltan.append(c["n"]); continue
    cuerpo = [f'<h2 class="ugc-paper-title">Transcripción</h2><p class="ugc-doc-note">{html.escape(NOTA)}</p>']
    for k, r in enumerate(rutas):
        tx = json.load(open(r, encoding="utf-8"))
        if len(rutas) > 1:
            cuerpo.append(f'<p class="ugc-doc-p"><strong>Parte {k + 1} de {len(rutas)}</strong></p>')
        cuerpo += [f'<p class="ugc-doc-p">{html.escape(p)}</p>' for p in parrafos(tx)]
    doc_p = f"{REPO}/public/cono-doc/{SLUG_CURSO}__{c['slug']}.json"
    if not os.path.exists(doc_p):
        print("SIN DOCUMENTO", c["n"], doc_p); continue
    doc = json.load(open(doc_p, encoding="utf-8"))
    nuevo = "".join(cuerpo)
    if doc["paneles"].get("Transcripción") == nuevo: continue
    doc["paneles"]["Transcripción"] = nuevo
    with open(doc_p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    escritas.append(c["n"])
print("escritas", escritas)
print("faltan", faltan)
