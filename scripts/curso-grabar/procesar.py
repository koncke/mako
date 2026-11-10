# Arma el video final de una clase juntando la captura de video (ffmpeg gfxcapture, sólo el rectángulo del video)
# y el audio del loopback, alineados por la marca de sincronía del control (destello blanco + pitido de 1 kHz).
#
#   python -I procesar.py --entrada '<json del log del control>' --salida X.mp4 [--audio1x X.mp3]
#   entrada: {"n","j","marcaIni","inicio","fin","marcaFin","dur"} en ms de reloj (Date.now()); "marcaIniExtra" pisa a marcaIni.
#
# - Audio: busca el pitido cerca de cada marca (DFT a 1 kHz) -> posición exacta en muestras.
# - Video: busca el destello (salto de brillo de 0,3-0,9 s) cerca de cada marca -> pts exacto.
# - Corta el video SIN recomprimir desde el keyframe anterior al arranque, hasta el destello final, y el audio
#   desde la muestra de ese mismo instante. Si los relojes se corrieron entre marca y marca, estira el audio.
# - Revisa: nivel de audio, huecos mudos, cuadros congelados o negros, duración. Imprime OK/ALERTA con los números.
import argparse, datetime, glob, json, os, re, subprocess, sys, wave
import numpy as np

BASE = "C:/cursos/programa-meta-ads-the-net-lab"
ap = argparse.ArgumentParser()
ap.add_argument("--entrada", required=True)
ap.add_argument("--salida", required=True)
ap.add_argument("--audio1x", default=None)
ap.add_argument("--solo-audio", action="store_true", help="sin video: sólo el audio a 1x para transcribir (captura de video perdida)")
ap.add_argument("--audio-dir", default=f"{BASE}/audio/crudo")
ap.add_argument("--video-dir", default=f"{BASE}/video/crudo")
a = ap.parse_args()
e = json.loads(a.entrada)
info = {"n": e["n"], "j": e.get("j", 0)}

# ---------- audio: tramos como una sola línea de tiempo ----------
tramos = []
for f in sorted(glob.glob(f"{a.audio_dir}/tramo-*.wav")):
    m = json.load(open(f + ".json", encoding="utf-8"))
    w = wave.open(f); tramos.append({"f": f, "k0": m["muestra_inicial"], "n": w.getnframes(), "rate": w.getframerate(), "t0": m["t0"]}); w.close()
rate = tramos[0]["rate"]; T0 = tramos[0]["t0"]
reloj = [json.loads(l) for l in open(f"{a.audio_dir}/reloj.jsonl", encoding="utf-8") if l.strip()]
reloj = [r for r in reloj if r["reloj"] >= T0]
RX = np.array([r["reloj"] for r in reloj]); RY = np.array([r["muestras"] for r in reloj])

def k_de_reloj(t):  # muestra aproximada para una hora de reloj (el registro es cada 10 s)
    if len(RX) == 0: return int((t - T0) * rate)
    if t <= RX[0]: return int(RY[0] - (RX[0] - t) * rate)
    if t >= RX[-1]: return int(RY[-1] + (t - RX[-1]) * rate)
    return int(np.interp(t, RX, RY))

def leer_audio(k0, n):
    out = np.zeros(max(0, n), dtype=np.int16)
    for tr in tramos:
        a0 = max(k0, tr["k0"]); a1 = min(k0 + n, tr["k0"] + tr["n"])
        if a1 <= a0: continue
        w = wave.open(tr["f"]); w.setpos(a0 - tr["k0"])
        out[a0 - k0:a1 - k0] = np.frombuffer(w.readframes(a1 - a0), dtype=np.int16); w.close()
    return out

def buscar_pitido(t_ms, ventana=4.0):
    k_c = k_de_reloj(t_ms / 1000.0)
    k0 = k_c - int(ventana * rate); x = leer_audio(k0, int(2 * ventana * rate)).astype(np.float32) / 32768
    hop = int(rate * 0.005); win = int(rate * 0.02)
    ex = np.exp(-2j * np.pi * 1000 / rate * np.arange(win))
    cands = []
    i = 0
    while i < len(x) - win:
        s = x[i:i + win]; tot = float(np.sum(s * s))
        if tot > win * (10 ** (-45 / 10)) and abs(np.dot(s, ex)) ** 2 * 2 / (win * tot) > 0.6:  # 1.0 = tono puro
            cands.append(k0 + i); i += int(rate * 0.5)  # salto el resto de este pitido
        else:
            i += hop
    if not cands: return None
    return min(cands, key=lambda k: abs(k - k_c))

# ---------- video: segmentos con pts globales ----------
segs = []
for f in sorted(glob.glob(f"{a.video_dir}/v-*.mkv")):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=start_time,duration", "-of", "json", f], capture_output=True, text=True, encoding='utf-8', errors='replace')
    try:
        fm = json.loads(p.stdout)["format"]; d = fm.get("duration")
        segs.append({"f": f, "ini": float(fm["start_time"]), "fin": float(fm["start_time"]) + float(d) if d not in (None, "N/A") else 1e9})
    except Exception:
        pass
# el fin de cada tramo es el comienzo del siguiente: con -reset_timestamps 0, Matroska informa como «duración» la marca
# final (en el tramo 2: 3601,8 en vez de 1801), y sumarla al inicio hacía que el tramo 2 «abarcara» también al 3
for i_ in range(len(segs) - 1): segs[i_]["fin"] = segs[i_ + 1]["ini"]
if segs: segs[-1]["fin"] = 1e9
m = re.search(r"v-(\d{8})-(\d{6})", os.path.basename(segs[0]["f"]))
t_v0 = datetime.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").timestamp() - segs[0]["ini"]  # hora del pts 0 (±1 s)

def seg_de(pts):
    for s in segs:
        if s["ini"] - 0.5 <= pts <= s["fin"] + 0.5: return s
    return None

def brillos(s, ini, dur, ancho=64, solo_key=False):
    # por cuadro: (pts, Y medio, desvío de Y, U medio, V medio)
    # -ss se mide desde el comienzo del ARCHIVO (ffmpeg le suma su start_time); -copyts deja los pts absolutos en showinfo
    p = subprocess.run(["ffmpeg", "-hide_banner", "-threads", "1"] + (["-skip_frame", "nokey"] if solo_key else []) + ["-copyts", "-ss", f"{max(0.0, ini - s['ini']):.3f}", "-t", f"{dur:.3f}", "-i", s["f"],
                        "-vf", f"scale={ancho}:-2,format=yuv420p,showinfo", "-f", "null", "-"], capture_output=True, text=True, encoding='utf-8', errors='replace')
    fr = []
    for l in p.stderr.splitlines():
        mm = re.search(r"pts_time:([\d.]+).*?mean:\[(\d+) (\d+) (\d+)\].*?stdev:\[([\d.]+)", l)
        if mm: fr.append((float(mm.group(1)), int(mm.group(2)), float(mm.group(5)), int(mm.group(3)), int(mm.group(4))))
    return fr

def buscar_destello(t_ms, ventana=6.0):
    pts_c = t_ms / 1000.0 - t_v0
    s = seg_de(pts_c)
    if not s: return None
    fr = brillos(s, max(s["ini"], pts_c - ventana), 2 * ventana)
    # 1) destello MAGENTA (desde el 10/11 00:30): U y V altos a la vez, casi imposible en una clase
    mag = [f[0] for i, f in enumerate(fr) if f[3] > 185 and f[4] > 200 and (i == 0 or not (fr[i - 1][3] > 185 and fr[i - 1][4] > 200))]
    if mag: return min(mag, key=lambda t: abs(t - pts_c))
    # 2) destello BLANCO (las marcas de antes): salto a blanco puro; detrás puede quedar la página blanca
    cands = [fr[i][0] for i in range(1, len(fr)) if fr[i][1] >= 233 and fr[i - 1][1] <= 231]  # Y en rango limitado: blanco puro = 235, la página ~226
    if not cands: return None
    return min(cands, key=lambda t: abs(t - pts_c))

def keyframe_antes(pts):
    s = seg_de(pts)
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-skip_frame", "nokey", "-show_entries", "frame=pts_time",
                        "-read_intervals", f"{max(0, pts - 8):.3f}%{pts + 0.05:.3f}", "-of", "csv=p=0", s["f"]], capture_output=True, text=True, encoding='utf-8', errors='replace')
    ks = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", p.stdout) if float(x) <= pts + 1e-3]   # ffprobe a veces deja «0.067000,»
    return max(ks) if ks else s["ini"]

marca_ini = e.get("marcaIniExtra") or e["marcaIni"]
k_ini = buscar_pitido(marca_ini); k_fin = buscar_pitido(e["marcaFin"])
if a.solo_audio:
    if None in (k_ini, k_fin):
        print("FALTA_MARCA", json.dumps({**info, "pitido_ini": k_ini, "pitido_fin": k_fin})); sys.exit(3)
    espera = max(0.0, (e.get("inicio", marca_ini) - marca_ini) / 1000.0)
    RX_, RY_ = RX, RY
    def _corr(k0, desde_s, n):
        # mismo criterio que audio_corregido (más abajo), sin video: ceros donde el loopback perdió paquetes
        w0 = float(np.interp(k0, RY_, RX_)); idx = [i for i in range(len(RX_)) if w0 - 12 <= RX_[i] <= w0 + desde_s + n / rate + 12]
        piezas = []; puesto = 0; pos = None; i0 = idx[0]
        for i in range(i0, idx[-1]):
            s_a, s_b = int(RY_[i]), int(RY_[i + 1])
            if pos is None and s_a <= k0 < s_b: pos = sum(len(p) for p in piezas) + (k0 - s_a)
            piezas.append(leer_audio(s_a, s_b - s_a))
            perdido = int((RX_[i + 1] - RX_[i0]) * rate) - (s_b - int(RY_[i0]))
            if perdido - puesto > int(0.075 * rate): piezas.append(np.zeros(perdido - puesto, dtype=np.int16)); puesto = perdido
        todo = np.concatenate(piezas); a0 = pos + int(desde_s * rate)
        return todo[a0:a0 + n]
    n_ = int(((k_fin - k_ini) / rate - espera - 0.05) * rate)
    y = _corr(k_ini, espera, n_)
    t2 = a.audio1x + ".tmp.wav"
    w = wave.open(t2, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(y.tobytes()); w.close()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", t2, "-af", "atempo=0.5", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "64k", a.audio1x], check=True)
    os.remove(t2)
    yf = y.astype(np.float32) / 32768
    info.update({"pitido_ini": k_ini, "pitido_fin": k_fin, "audio_s": round(len(y) / rate, 1),
                 "audio_db_mediana": round(float(np.median([20 * np.log10(np.sqrt(np.mean(yf[i:i + rate] ** 2)) + 1e-9) for i in range(0, max(1, len(yf) - rate), rate)])), 1)})
    print("SOLO_AUDIO " + json.dumps(info, ensure_ascii=False)); sys.exit(0)
v_ini = buscar_destello(marca_ini); v_fin = buscar_destello(e["marcaFin"])
info.update({"pitido_ini": k_ini, "pitido_fin": k_fin, "destello_ini": v_ini, "destello_fin": v_fin})
if None in (k_ini, k_fin, v_ini, v_fin):
    print("FALTA_MARCA", json.dumps(info)); sys.exit(3)

dur_a = (k_fin - k_ini) / rate; dur_v = v_fin - v_ini
info["deriva_ms"] = round((dur_a - dur_v) * 1000, 1)   # audio crudo contra video, entre las dos marcas
espera = max(0.0, ((e.get("reinicio") or e.get("inicio", marca_ini)) - marca_ini) / 1000.0)  # de la marca al arranque (o al reinicio con sonido)
p_play = v_ini + espera
S = keyframe_antes(max(v_ini, p_play - 0.4))
fin_v = v_fin - 0.02                         # justo antes del destello final

def audio_corregido(k0, desde_s, n):
    """Audio desde k0 (crudo) + desde_s segundos de reloj, n muestras, con silencio donde el loopback perdió paquetes.
    El video sigue el reloj (medido: 11 ms en 829 s); el audio pierde 70-160 ms cuando la PC se carga. El registro del
    grabador (cada 10 s: reloj y muestras) dice cuánto se perdió en cada tramo: se rellena con ceros al final del tramo
    en cuanto lo perdido pasa de 75 ms (el ruido del registro es de ±50 ms), así el desfase nunca pasa de ~75 ms."""
    if len(RX) < 2:
        return leer_audio(k0 + int(desde_s * rate), n), 0
    w0 = float(np.interp(k0, RY, RX))                 # hora de reloj de la muestra k0
    w_a = min(w0, w0 + desde_s) - 12; w_b = w0 + desde_s + n / rate + 12   # desde ANTES de k0: lo perdido se cuenta desde ahí
    idx = [i for i in range(len(RX)) if w_a <= RX[i] <= w_b]
    if len(idx) < 2:
        return leer_audio(k0 + int(desde_s * rate), n), 0
    i0 = idx[0]
    piezas = []; puesto = 0; pos_k0 = None
    for i in range(i0, idx[-1]):
        s_a, s_b = int(RY[i]), int(RY[i + 1])
        if pos_k0 is None and s_a <= k0 < s_b:
            pos_k0 = sum(len(p) for p in piezas) + (k0 - s_a)
        piezas.append(leer_audio(s_a, s_b - s_a))
        perdido = int((RX[i + 1] - RX[i0]) * rate) - (s_b - int(RY[i0]))   # acumulado contra el reloj
        if perdido - puesto > int(0.075 * rate):
            piezas.append(np.zeros(perdido - puesto, dtype=np.int16)); puesto = perdido
    if pos_k0 is None:
        return leer_audio(k0 + int(desde_s * rate), n), 0
    todo = np.concatenate(piezas)
    a0 = pos_k0 + int(desde_s * rate)
    out = np.zeros(n, dtype=np.int16)
    seg = todo[max(0, a0):max(0, a0) + n]
    out[:len(seg)] = seg
    return out, puesto

x, rellenado = audio_corregido(k_ini, S - v_ini, int((fin_v - S) * rate))
info["silencio_rellenado_ms"] = round(rellenado / rate * 1000)
# control: con la corrección, el pitido final tiene que caer donde el destello final (1,0 s dentro de esta ventana)
y_fin, _ = audio_corregido(k_ini, (v_fin - v_ini) - 1.0, int(2.5 * rate))
_yf = y_fin.astype(np.float32) / 32768; _win = int(rate * 0.02); _ex = np.exp(-2j * np.pi * 1000 / rate * np.arange(_win))
for _i in range(0, len(_yf) - _win, int(rate * 0.005)):
    _s = _yf[_i:_i + _win]; _t = float(np.sum(_s * _s))
    if _t > _win * (10 ** (-45 / 10)) and abs(np.dot(_s, _ex)) ** 2 * 2 / (_win * _t) > 0.6:
        info["desfase_final_ms"] = round((_i / rate - 1.0) * 1000); break
fin_pitido = int((v_ini + 0.35 - S) * rate)   # callar el pitido si quedó adentro
if fin_pitido > 0: x[:min(len(x), fin_pitido)] = 0
tmp_wav = a.salida + ".tmp.wav"
w = wave.open(tmp_wav, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(x.tobytes()); w.close()
af = []
usados = [s2 for s2 in segs if s2["fin"] > S and s2["ini"] < fin_v]
temporales = []
if len(usados) == 1:   # -ss relativo al archivo: S es un keyframe, así que el corte sin recomprimir empieza justo ahí
    vin = ["-ss", f"{S - usados[0]['ini']:.3f}", "-t", f"{fin_v - S:.3f}", "-i", usados[0]["f"]]
else:                  # la clase cruza de tramo: cada parte por separado (cada tramo arranca en keyframe) y se unen
    partes = []
    for k2, s2 in enumerate(usados):
        a_ = max(S, s2["ini"]); b_ = min(fin_v, s2["fin"])
        parte = f"{a.salida}.parte{k2}.mkv"; temporales.append(parte)
        rr = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-ss", f"{a_ - s2['ini']:.3f}", "-t", f"{b_ - a_:.3f}",
                             "-i", s2["f"], "-map", "0:v:0", "-c", "copy", "-avoid_negative_ts", "make_zero", parte], capture_output=True, text=True, encoding='utf-8', errors='replace')
        if rr.returncode != 0:
            print("FFMPEG_FALLO parte", rr.stderr[-500:]); sys.exit(4)
        partes.append(parte)
    lista = a.salida + ".lista.txt"; temporales.append(lista)
    open(lista, "w", encoding="utf-8").write("".join("file '" + p_ + "'" + chr(10) for p_ in partes))
    vin = ["-f", "concat", "-safe", "0", "-i", lista]
cmd = ["ffmpeg", "-hide_banner", "-v", "error", "-y"] + vin + ["-i", tmp_wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy"] + af +       ["-c:a", "aac", "-b:a", "128k", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", "-shortest", a.salida]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
os.remove(tmp_wav)
for t_ in temporales:
    try: os.remove(t_)
    except OSError: pass
if r.returncode != 0:
    print("FFMPEG_FALLO", r.stderr[-800:]); sys.exit(4)

# ---------- revisión ----------
alertas = []
xa = x.astype(np.float32) / 32768
v = int(rate * 1.0)
bloques = [xa[i:i + v] for i in range(max(0, int((p_play - S) * rate)), len(xa) - v, v)]
dbs = np.array([20 * np.log10(np.sqrt(np.mean(b * b)) + 1e-9) for b in bloques]) if bloques else np.array([-120.0])
info["audio_db_mediana"] = round(float(np.median(dbs)), 1)
racha = 0; peor = 0
for d in dbs:
    racha = racha + 1 if d < -50 else 0; peor = max(peor, racha)
info["audio_mudo_max_s"] = int(peor)
if info["audio_db_mediana"] < -40: alertas.append("audio casi mudo")
if abs(info.get("desfase_final_ms", 0)) > 120: alertas.append(f"audio y video desfasados {info['desfase_final_ms']} ms al final")
if "desfase_final_ms" not in info: alertas.append("no encontré el pitido final para medir el desfase")
if peor >= 20: alertas.append(f"{peor} s seguidos sin sonido")
seg_v = seg_de(p_play + 1)
fr = brillos(seg_v, p_play + 1, max(1.0, fin_v - p_play - 1), ancho=32, solo_key=True) if seg_v else []   # keyframes: liviano
if fr:
    stdevs = np.array([f[2] for f in fr]); medias = np.array([f[1] for f in fr])
    info["video_cuadros"] = len(fr)
    info["video_negros_pct"] = round(100 * float(np.mean((medias < 20) & (stdevs < 3))), 1)  # negro = 16 en rango limitado
    ts = np.array([f[0] for f in fr]); huecos = np.diff(ts) if len(ts) > 1 else np.array([0.0])
    info["video_hueco_max_s"] = round(float(huecos.max()), 2)
    # congelada: la captura repite el mismo cuadro (ffmpeg rellena con duplicados y no quedan huecos de pts)
    racha_t0 = fr[0][0]; quieto_max = 0.0
    for i_ in range(1, len(fr)):
        if fr[i_][1:] != fr[i_ - 1][1:]: racha_t0 = fr[i_][0]
        quieto_max = max(quieto_max, fr[i_][0] - racha_t0)
    info["video_quieto_max_s"] = round(quieto_max, 1)
    if quieto_max > 60: alertas.append(f"video quieto {quieto_max:.0f} s seguidos (¿captura congelada?)")
    if info["video_negros_pct"] > 5: alertas.append(f"{info['video_negros_pct']}% de cuadros negros")
    if info["video_hueco_max_s"] > 4.5: alertas.append(f"video sin cuadros nuevos {info['video_hueco_max_s']} s")
else:
    alertas.append("no pude leer cuadros del video")
p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.salida], capture_output=True, text=True, encoding='utf-8', errors='replace')
info["duracion"] = round(float(p.stdout.strip() or 0), 1)
if e.get("dur"):
    esperado = e["dur"] / 2.0
    info["duracion_esperada"] = round(esperado, 1)
    if abs(info["duracion"] - esperado) > max(8, 0.03 * esperado): alertas.append(f"dura {info['duracion']} s y se esperaban {esperado:.0f}")

if a.audio1x:  # sólo la clase (desde el arranque hasta antes de la marca final), bajada a 1x para transcribir
    y = x[max(0, int((p_play - S) * rate)):]
    t2 = a.audio1x + ".tmp.wav"
    w = wave.open(t2, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(y.tobytes()); w.close()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", t2, "-af", "atempo=0.5", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "64k", a.audio1x], check=True)
    os.remove(t2)
info["salida"] = a.salida; info["alertas"] = alertas
print(("ALERTA " if alertas else "OK ") + json.dumps(info, ensure_ascii=False))
