# Supervisor de la captura de video: arranca ffmpeg (gfxcapture de la ventana «MaKo grabando clases», recortada al
# rectángulo del video) y lo reinicia si la captura se CONGELA.
#
# Por qué: el 10/11 a las 00:51 la sesión de Windows Graphics Capture dejó de mandar cuadros sin ningún error; ffmpeg
# siguió escribiendo el último cuadro repetido (dup) durante 10 minutos y tres clases quedaron con el video quieto.
# Una captura nueva de la misma ventana andaba perfecto. Con el punto que parpadea en la página siempre hay cuadros
# nuevos, así que «casi todos los cuadros son repetidos» = congelada.
#
#   python -I video_supervisor.py            (para con video/crudo/PARAR)
# Cada arranque escribe en video/crudo/s<N>/ (los pts de cada sesión empiezan en 0; el nombre del tramo da la hora).
import ctypes, json, os, subprocess, sys, time
from ctypes import wintypes

BASE = "C:/cursos/programa-meta-ads-the-net-lab/video/crudo"
TITULO = "MaKo grabando clases"
LOG = f"{BASE}/supervisor.log"
os.makedirs(BASE, exist_ok=True)
user32 = ctypes.windll.user32

def log(m):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S") + " " + m + "\n")

def ventana():
    res = []
    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(h, l):
        n = user32.GetWindowTextLengthW(h)
        if n and user32.IsWindowVisible(h):
            b = ctypes.create_unicode_buffer(n + 1); user32.GetWindowTextW(h, b, n + 1)
            if TITULO in b.value: res.append(h)
        return True
    user32.EnumWindows(cb, 0)
    return res[0] if res else None

def preparar_ventana():
    h = ventana()
    if not h:
        log("no encuentro la ventana"); return False
    if user32.IsIconic(h) or not user32.IsZoomed(h):
        user32.ShowWindow(h, 3)   # SW_MAXIMIZE: minimizada no se captura
        log("ventana maximizada"); time.sleep(2)
    return True

def proxima_sesion():
    n = 1
    while os.path.exists(f"{BASE}/s{n:02d}"): n += 1
    d = f"{BASE}/s{n:02d}"; os.makedirs(d); return d

def correr():
    d = proxima_sesion()
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i",
           f"gfxcapture=window_title='{TITULO}':capture_cursor=0:max_framerate=30:crop_left=240:crop_top=210:crop_right=240:crop_bottom=0",
           "-vf", "hwdownload,format=bgra", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-g", "60",
           "-f", "segment", "-segment_time", "1800", "-reset_timestamps", "0", "-strftime", "1",
           f"{d}/v-%Y%m%d-%H%M%S.mkv", "-progress", "pipe:1", "-stats_period", "1"]
    err = open(f"{d}/ffmpeg.log", "w", encoding="utf-8")
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=err, text=True, creationflags=0x00000020)  # NORMAL: con prioridad baja el armado la dejaba sin CPU
    log(f"ffmpeg pid={p.pid} en {d}")
    hist = []   # (t, frame, dup)
    cur = {}
    for linea in p.stdout:
        k, _, v = linea.strip().partition("=")
        cur[k] = v
        if k != "progress": continue
        try:
            fr = int(cur.get("frame", 0)); dup = int(cur.get("dup_frames", 0))
        except ValueError:
            continue
        ahora = time.time(); hist.append((ahora, fr, dup)); hist = [x for x in hist if ahora - x[0] <= 12]
        with open(f"{BASE}/estado.json", "w", encoding="utf-8") as f:
            json.dump({"reloj": ahora, "sesion": os.path.basename(d), "frame": fr, "dup": dup, "pid": p.pid}, f)
        if os.path.exists(f"{BASE}/PARAR"):
            log("PARAR: corto ffmpeg"); break
        if len(hist) >= 2 and ahora - hist[0][0] >= 10:
            dfr = hist[-1][1] - hist[0][1]; ddup = hist[-1][2] - hist[0][2]
            # congelada = Windows no manda cuadros nuevos: ffmpeg sigue a ~30/s pero casi todos repetidos.
            # LENTA (la PC sin CPU: pocos cuadros en total) no se arregla reiniciando: 10/11 01:15 se reinició dos veces así.
            if dfr >= 200 and ddup >= 0.85 * dfr:
                log(f"congelada: {ddup} de {dfr} cuadros repetidos en {ahora - hist[0][0]:.0f} s; reinicio"); break
            if dfr < 200: log(f"lenta: {dfr} cuadros en {ahora - hist[0][0]:.0f} s (no reinicio)") if int(ahora) % 30 == 0 else None
        if len(hist) >= 2 and hist[-1][1] == hist[0][1] and ahora - hist[0][0] >= 12 and hist[-1][1] > 0:
            log("sin ningún cuadro en 12 s; reinicio"); break
    try:
        p.terminate(); p.wait(timeout=15)
    except Exception:
        try: p.kill()
        except Exception: pass
    err.close()
    log(f"ffmpeg terminó (código {p.returncode})")

log("supervisor arrancó")
while not os.path.exists(f"{BASE}/PARAR"):
    if not preparar_ventana():
        time.sleep(10); continue
    correr()
    time.sleep(1)
log("supervisor terminó")
