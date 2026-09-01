// Planifica los cortes de un anuncio: se queda solo con los tramos donde hay HABLA.
//
// Detector de doble umbral (hysteresis). Cuatro intentos hasta llegar aca, y cada uno
// fallo por una razon distinta que conviene saber antes de "simplificar" esto:
//
// 1) Umbral FIJO de silencio. El piso de ruido cambia por toma (-39 a -84 dB en el mismo
//    anuncio: el locutor va manejando). Las tomas ruidosas no tenian NI UN silencio
//    detectable: se corta el silencio digital y queda intacto el perceptual.
// 2) Umbral ADAPTATIVO simple (RMS-13 por toma). Mejor, pero un umbral solo distingue
//    SONIDO de SILENCIO, no HABLA de NO-HABLA. Y lo que arruina un anuncio es el no-habla
//    CON energia: una respiracion de 1,36 s con pico -6,3 dB (tan fuerte como el habla), o
//    el "eh" del STS, una isla de 0,2 s a -23 dB. Eso es lo que "se ve de IA".
// 3) Timestamps de palabra de Whisper para posicionar los cortes. **NO SIRVEN PARA
//    POSICIONAR.** Dos motivos independientes:
//      - `word.end` esta estirado: cubre la pausa siguiente. "apriete," figura durando
//        2,44 s cuando deja de sonar a los 0,5 s.
//      - `word.start` esta CORRIDO, hasta ~0,6 s en este material. Whisper ubica
//        "apagando" en 3.24, pero ahi todavia suena "terminar"; despues hay 0,45 s de
//        silencio real y "apagando" arranca recien en 3.90. Cortar por esos numeros parte
//        palabras al medio y salen "pagando", "quiere" por "requiere", "ser" por "hacer".
//
// Lo que SI funciona: la ENERGIA posiciona (es exacta) y Whisper solo VERIFICA despues.
// Dos umbrales:
//   - BAJO  (RMS-DELTA_LO): marca los bordes del tramo, para no cortar la cola suave de
//     una palabra ni su ataque.
//   - ALTO  (RMS-DELTA_HI): marca el nucleo de habla. Una respiracion o una muletilla no
//     llegan a este nivel; una silaba si.
// Se conserva un tramo del umbral bajo solo si contiene algun nucleo del alto, y su cabeza
// se recorta hasta poco antes del primer nucleo. Asi se va la respiracion que viene pegada
// adelante, que es lo que dejaba el bache de 1,4 s antes de "Nadie".
//
// uso: node plan-cortes.mjs <dir sts-N.mp3> <ntomas> <durvid> [aire] [minhueco] [minseg]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const DIR = process.argv[2], N = +process.argv[3], DURVID = +process.argv[4];
const AIRE     = +(process.argv[5] ?? 0.07);
const MINHUECO = +(process.argv[6] ?? 0.14);
const MINSEG   = +(process.argv[7] ?? 0.20);
const DELTA_LO = +(process.env.DELTA_LO ?? 13);   // borde: generoso, no corta colas
const DELTA_HI = +(process.env.DELTA_HI ?? 6);    // nucleo: solo habla llega aca
const MINSIL   = +(process.env.MINSIL ?? 0.10);
const MINNUC   = +(process.env.MINNUC ?? 0.04);   // nucleo minimo para contar como habla
const AIRE_COLA = +(process.env.AIRE_COLA ?? 0.22); // mas que AIRE: las vocales finales decaen
const CLAMP    = +(process.env.CLAMP ?? 0.35);    // margen para el error de Whisper
const TOPE_U = -24, PISO_U = -46;

const log = (s) => process.stderr.write(s + '\n');
const ff = (a) => { const r = spawnSync('ffmpeg', a, { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stdout || '') + (r.stderr || ''); };

// tramos con sonido por encima de `U`, a partir de los silencios que reporta ffmpeg
function tramos(f, U, d, TOPE) {
  const txt = ff(['-hide_banner', '-i', f, '-af', `silencedetect=n=${U.toFixed(1)}dB:d=${d}`, '-f', 'null', '-']);
  const sil = [];
  const re = /silence_start:\s*(-?[\d.]+)|silence_end:\s*([\d.]+)/g;
  let m, cur = null;
  while ((m = re.exec(txt))) {
    if (m[1] !== undefined) cur = Math.max(0, +m[1]);
    else if (cur !== null) { sil.push([cur, +m[2]]); cur = null; }
  }
  if (cur !== null) sil.push([cur, TOPE]);
  const out = []; let t = 0;
  for (const [a, b] of sil) { if (a > t) out.push([t, a]); t = Math.max(t, b); }
  if (t < TOPE) out.push([t, TOPE]);
  return out.filter(([a, b]) => b > a);
}

const segs = [];
let durOriginal = 0, sinNucleo = 0, segSinNucleo = 0, cabezaCortada = 0;
for (let i = 1; i <= N; i++) {
  const f = `${DIR}/sts-${i}.mp3`;
  const st = ff(['-hide_banner', '-i', f, '-af', 'astats', '-f', 'null', '-']);
  const rms = +(st.match(/RMS level dB:\s*(-?[\d.]+)/) || [])[1];
  const ULO = Math.min(TOPE_U, Math.max(PISO_U, rms - DELTA_LO));
  const UHI = Math.min(-14, Math.max(-34, rms - DELTA_HI));

  const durAud = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
  const TOPE = Math.min(DURVID, durAud);
  durOriginal += DURVID;

  // arranques de palabra, si estan cacheados. Solo para el clamp de mas abajo; si no hay
  // cache el plan sale igual, un poco menos apretado.
  let starts = [];
  try { starts = (JSON.parse(fs.readFileSync(`${DIR}/words-${i}.json`, 'utf8')).words || []).map(w => w.start); } catch {}

  const bordes  = tramos(f, ULO, MINSIL, TOPE);
  const nucleos = tramos(f, UHI, MINSIL, TOPE).filter(([a, b]) => b - a >= MINNUC);

  const buenosRaw = [];
  for (const [a, b] of bordes) {
    const dentro = nucleos.filter(([p, q]) => q > a && p < b);
    if (!dentro.length) { sinNucleo++; segSinNucleo += b - a; continue; }
    // La cabeza arranca poco antes del primer nucleo y la cola termina poco despues del
    // ultimo: lo que sobra a los costados es respiracion, que viaja pegada dentro del
    // mismo tramo de energia y por eso descartar tramos enteros no la saca.
    // La cola lleva MAS margen que la cabeza a proposito: una vocal final decae despacio
    // y queda debajo del umbral alto siendo todavia parte de la palabra. Recortarla al
    // ras se come finales.
    let ini = Math.max(a, Math.min(...dentro.map(x => x[0])) - AIRE);
    const fin = Math.min(b, Math.max(...dentro.map(x => x[1])) + AIRE_COLA);

    // Ultimo recurso, y el unico lugar donde Whisper interviene en POSICIONAR: cuando el
    // ruido de arranque es tan fuerte como el habla (medido -15,7 dB al inicio de una toma,
    // contra -16,4 de RMS de la voz), ningun umbral de energia lo separa. Ahi el dato util
    // es que Whisper no transcribio NADA antes. Se usa como tope grueso y solo si el
    // desfase es grande, con CLAMP de margen para el error de Whisper (que llega a ~0,6 s).
    const prim = starts.find(s => s >= a - 0.05 && s <= b);
    if (prim !== undefined && prim - ini > 0.50) {
      const nuevo = Math.max(ini, prim - CLAMP);
      cabezaCortada += nuevo - ini;
      ini = nuevo;
    }
    cabezaCortada += (ini - a) + (b - fin);
    buenosRaw.push([ini, fin]);
  }

  let t2 = buenosRaw.map(([a, b]) => [Math.max(0, a), Math.min(TOPE, b + AIRE)]);
  const fus = [];
  for (const s of t2) {
    if (fus.length && s[0] <= fus[fus.length - 1][1] + MINHUECO) fus[fus.length - 1][1] = Math.max(fus[fus.length - 1][1], s[1]);
    else fus.push([...s]);
  }
  const buenos = fus.filter(([a, b]) => b - a >= MINSEG);

  const usado = buenos.reduce((s, [a, b]) => s + (b - a), 0);
  log(`toma ${i}: lo ${ULO.toFixed(1)} / hi ${UHI.toFixed(1)} dB | ${bordes.length} tramos, ` +
      `${nucleos.length} nucleos -> ${buenos.length} tramo(s), ${usado.toFixed(2)}s (se van ${(DURVID - usado).toFixed(2)}s)`);
  for (const [a, b] of buenos) segs.push({ toma: i, ini: +a.toFixed(3), fin: +b.toFixed(3) });
}

const total = segs.reduce((s, x) => s + (x.fin - x.ini), 0);
log(`\n${sinNucleo} tramos sin nucleo de habla (${segSinNucleo.toFixed(2)}s) + ${cabezaCortada.toFixed(2)}s de cabeza recortada`);
log(`${segs.length} tramos | ${durOriginal.toFixed(2)}s -> ${total.toFixed(2)}s (se van ${(durOriginal - total).toFixed(2)}s, ${(100 * (durOriginal - total) / durOriginal).toFixed(0)}%)`);
process.stdout.write(JSON.stringify({ total: +total.toFixed(3), segs }));
