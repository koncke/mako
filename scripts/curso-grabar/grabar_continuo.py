# Graba SIN cortes lo que suena en la PC (loopback WASAPI de la salida por defecto),
# en tramos de N minutos, mono 48 kHz. No baja nada: escucha la mezcla que va a los parlantes.
#
#   python grabar_continuo.py --dir <carpeta> [--tramo-min 30]
#
# Para cuando aparece <carpeta>/PARAR.
# Linea de tiempo: la muestra k (contando todos los tramos) es el instante t0 + k/rate, porque
# WASAPI no entrega paquetes cuando nada suena y esos huecos se rellenan con ceros segun el reloj.
# Igual se anota cada 10 s el par (reloj, muestras) en reloj.jsonl, para cortar por la hora real.
import argparse, json, os, site, sys, threading, time, wave
sys.path.insert(0, site.getusersitepackages())
import numpy as np
import pyaudiowpatch as pyaudio

ap = argparse.ArgumentParser()
ap.add_argument("--dir", required=True)
ap.add_argument("--tramo-min", type=float, default=30)
ap.add_argument("--umbral-db", type=float, default=-55)
a = ap.parse_args()
os.makedirs(a.dir, exist_ok=True)

p = pyaudio.PyAudio()
wasapi = p.get_host_api_info_by_type(pyaudio.paWASAPI)
salida = p.get_device_info_by_index(wasapi["defaultOutputDevice"])
lb = next((d for d in p.get_loopback_device_info_generator() if salida["name"] in d["name"]), None)
if lb is None:
    print("ERROR sin loopback para", salida["name"], flush=True); sys.exit(2)
rate = int(lb["defaultSampleRate"]); ch = lb["maxInputChannels"]
TRAMO = int(a.tramo_min * 60 * rate)

lock = threading.Lock()
st = {"total": 0, "en_tramo": 0, "wf": None, "n": 0, "ultimo_cb": time.time(),
      "ultimo_sonido": 0.0, "db": -120.0}
t0 = time.time()
reloj = open(os.path.join(a.dir, "reloj.jsonl"), "a", encoding="utf-8")

def abrir_tramo():
    st["n"] += 1
    nombre = os.path.join(a.dir, f"tramo-{st['n']:03d}.wav")
    wf = wave.open(nombre, "wb"); wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(rate)
    with open(nombre + ".json", "w", encoding="utf-8") as f:
        json.dump({"t0": t0, "rate": rate, "muestra_inicial": st["total"], "abierto": time.time()}, f)
    st["wf"] = wf; st["en_tramo"] = 0

def escribir(mono):  # mono: int16 1-D; con el lock tomado
    i = 0
    while i < len(mono):
        if st["wf"] is None or st["en_tramo"] >= TRAMO:
            if st["wf"] is not None: st["wf"].close()
            abrir_tramo()
        k = min(len(mono) - i, TRAMO - st["en_tramo"])
        st["wf"].writeframes(mono[i:i + k].tobytes())
        st["en_tramo"] += k; st["total"] += k; i += k

def cb(data, frames, info, status):
    x = np.frombuffer(data, dtype=np.int16).reshape(-1, ch).astype(np.int32)
    mono = (x.sum(axis=1) // ch).astype(np.int16)
    f = mono.astype(np.float32) / 32768.0
    rms = float(np.sqrt(np.mean(f * f))) if f.size else 0.0
    d = 20 * np.log10(rms) if rms > 0 else -120.0
    with lock:
        escribir(mono)
        st["ultimo_cb"] = time.time(); st["db"] = float(d)
        if d > a.umbral_db: st["ultimo_sonido"] = time.time()
    return (None, pyaudio.paContinue)

with lock: abrir_tramo()
s = p.open(format=pyaudio.paInt16, channels=ch, rate=rate, input=True, input_device_index=lb["index"],
           frames_per_buffer=int(rate * 0.05), stream_callback=cb)
s.start_stream()
print("GRABANDO", json.dumps({"rate": rate, "dispositivo": lb["name"], "t0": t0}, ensure_ascii=False), flush=True)
ultimo_reloj = 0; ultimo_estado = 0
try:
    while not os.path.exists(os.path.join(a.dir, "PARAR")):
        time.sleep(0.25)
        ahora = time.time()
        with lock:
            if ahora - st["ultimo_cb"] > 0.3:
                falta = int((ahora - t0) * rate) - st["total"]
                if falta > rate * 0.25:
                    escribir(np.zeros(falta, dtype=np.int16))
            info = {"reloj": ahora, "muestras": st["total"], "tramo": st["n"],
                    "seg": round(st["total"] / rate, 1), "db": round(st["db"], 1),
                    "sin_sonido": round(ahora - st["ultimo_sonido"], 1) if st["ultimo_sonido"] else None}
        if ahora - ultimo_reloj >= 10:
            ultimo_reloj = ahora; reloj.write(json.dumps(info) + "\n"); reloj.flush()
        if ahora - ultimo_estado >= 2:
            ultimo_estado = ahora
            with open(os.path.join(a.dir, "estado.json"), "w", encoding="utf-8") as f: json.dump(info, f)
finally:
    s.stop_stream(); s.close(); p.terminate()
    with lock:
        if st["wf"] is not None: st["wf"].close()
    reloj.close()
    print("FIN", json.dumps(info), flush=True)
