# Después de cada clase: arma el video final, lo revisa y transcribe el audio (bajado a 1x).
#   python -I despues.py            -> procesa lo que haya en grabar/log.json y todavía no esté hecho
# Entradas: grabar/log.json (el log del control, copiado de la página), plan.json.
# Salidas:  video/NN - título.mp4 · audio/1x/NN - título.mp3 · transcripciones/NN - título.json
#           grabar/hecho.json (una línea por clase con lo que dio la revisión)
import ctypes, json, os, subprocess, sys
# prioridad mínima (la heredan ffmpeg y node): el 10/11 a las 01:15 este armado dejó sin CPU a la captura en vivo
ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00000040)
sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # la consola de Windows es cp1252

BASE = "C:/cursos/programa-meta-ads-the-net-lab"
G = f"{BASE}/grabar"
plan = json.load(open(f"{BASE}/plan.json", encoding="utf-8"))
por_n = {c["n"]: c for c in plan["clases"]}
log = json.load(open(f"{G}/log.json", encoding="utf-8"))
hecho_p = f"{G}/hecho.json"
hecho = json.load(open(hecho_p, encoding="utf-8")) if os.path.exists(hecho_p) else {}
extra = {}
if os.path.exists(f"{G}/marcas-extra.json"):
    for x in json.load(open(f"{G}/marcas-extra.json", encoding="utf-8")):
        extra[f"{x['n']}.{x['j']}"] = x["marcaIni"]
for d in ("video", "audio/1x", "transcripciones"):
    os.makedirs(f"{BASE}/{d}", exist_ok=True)

def sesion_video(ent):
    """La carpeta video/crudo/sNN cuya captura cubre la clase entera (de la marca de inicio a la de fin)."""
    import datetime, glob, re
    ini = (ent.get("marcaIniExtra") or ent["marcaIni"]) / 1000.0; fin = ent["marcaFin"] / 1000.0
    for d_ in sorted(glob.glob(f"{BASE}/video/crudo/s*")):
        segs = sorted(glob.glob(f"{d_}/v-*.mkv"))
        if not segs: continue
        m_ = re.search(r"v-(\d{8})-(\d{6})", os.path.basename(segs[0]))
        t0 = datetime.datetime.strptime(m_.group(1) + m_.group(2), "%Y%m%d%H%M%S").timestamp()
        t1 = max(os.path.getmtime(x) for x in segs)
        try:   # la sesión que se está grabando: el tramo abierto tiene la fecha de modificación VIEJA (NTFS); manda el supervisor
            ev_ = json.load(open(f"{BASE}/video/crudo/estado.json", encoding="utf-8"))
            if ev_.get("sesion") == os.path.basename(d_): t1 = max(t1, ev_["reloj"])
        except Exception: pass
        if t0 + 2 <= ini and fin + 3 <= t1 + 60:
            return d_
    return None

def nombre(n, j):
    c = por_n[n]; nv = len(c.get("videos") or [1])
    return c["archivo"] + (f" (parte {j + 1} de {nv})" if nv > 1 else "")

for ent in log:
    if not ent.get("ok"): continue
    clave = f"{ent['n']}.{ent['j']}@{ent['marcaIni']}"   # una clase grabada dos veces tiene dos entradas
    if hecho.get(clave, {}).get("estado") in ("ok", "transcripta", "alerta", "repetir", "solo-audio"): continue   # no se transcribe dos veces
    if f"{ent['n']}.{ent['j']}" in extra: ent["marcaIniExtra"] = extra[f"{ent['n']}.{ent['j']}"]
    nom = nombre(ent["n"], ent["j"])
    mp4 = f"{BASE}/video/{nom}.mp4"; mp3 = f"{BASE}/audio/1x/{nom}.mp3"; tx = f"{BASE}/transcripciones/{nom}.json"
    vdir = sesion_video(ent)
    if vdir:
        r = subprocess.run([sys.executable, "-I", f"{G}/procesar.py", "--entrada", json.dumps(ent), "--salida", mp4, "--audio1x", mp3,
                            "--video-dir", vdir], capture_output=True, text=True, encoding='utf-8', errors='replace')
        linea = (r.stdout.strip().splitlines() or [r.stderr.strip()[-400:]])[-1]
    else:   # ninguna captura cubre la clase entera (se reinició en el medio): queda el audio
        import glob as _g
        vdir = sorted(d_ for d_ in _g.glob(f"{BASE}/video/crudo/s*") if _g.glob(f"{d_}/v-*.mkv"))[-1]
        linea = 'FALTA_MARCA {"motivo": "ninguna sesión de video cubre la clase entera", "pitido_ini": 1, "pitido_fin": 1}' 
    res = {"estado": "error", "procesar": linea}
    if linea.startswith("FALTA_MARCA") and '"pitido_ini": null' not in linea and '"pitido_fin": null' not in linea:
        # el audio está (los dos pitidos) pero el video no: se transcribe el audio y la clase queda para volver a grabar
        r2 = subprocess.run([sys.executable, "-I", f"{G}/procesar.py", "--entrada", json.dumps(ent), "--salida", mp4, "--audio1x", mp3,
                             "--video-dir", vdir, "--solo-audio"], capture_output=True, text=True, encoding='utf-8', errors='replace')
        l2 = (r2.stdout.strip().splitlines() or [r2.stderr.strip()[-400:]])[-1]
        if l2.startswith("SOLO_AUDIO "):
            res = {"estado": "solo-audio", "procesar": linea, "audio": json.loads(l2.split(" ", 1)[1])}
            t = subprocess.run(["node", f"{G}/transcribir.mjs", mp3, tx], capture_output=True, text=True, encoding='utf-8', errors='replace')
            res["transcripcion"] = (t.stdout.strip() or t.stderr.strip()[-300:])
            hecho[clave] = res
            json.dump(hecho, open(hecho_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(clave, "solo-audio", res["transcripcion"][-60:]); continue
    if linea.startswith("OK ") or linea.startswith("ALERTA "):
        res["revision"] = json.loads(linea.split(" ", 1)[1])
        res["estado"] = "ok" if linea.startswith("OK ") else "alerta"
        t = subprocess.run(["node", f"{G}/transcribir.mjs", mp3, tx], capture_output=True, text=True, encoding='utf-8', errors='replace')
        res["transcripcion"] = (t.stdout.strip() or t.stderr.strip()[-300:])
        if t.stdout.startswith("OK") and res["estado"] == "ok": res["estado"] = "transcripta"
    hecho[clave] = res
    json.dump(hecho, open(hecho_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(clave, res["estado"], json.dumps(res.get("revision", {}).get("alertas", res.get("procesar")), ensure_ascii=False))
