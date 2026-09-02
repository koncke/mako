// Saca la portada de un curso de su propio video, para los que no tienen tapa en ninguna
// plataforma.
//
//   node scripts/curso-portada-desde-video.mjs --plan C:\cursos\<slug>\plan.json
//
// Los cursos que vienen de Drive no pasaron por cursoselite, asi que no hay `cover_image`
// que bajar. Sin tapa la tarjeta sale sin imagen —que esta contemplado y se ve bien— pero
// entre 120 con tapa desentona, y Martin pidio que la tengan.
//
// ⚠️ NO SE SACA DEL SEGUNDO 0. Casi todo video arranca en negro, con un fade o con una
//    placa de logo: el frame 0 da una tapa negra en la mitad de los casos. Se prueban
//    varios momentos y se elige el que tiene mas COLOR —desviacion estandar de la
//    luminancia—, que es una medida barata de «esto no es una pantalla plana».
//
// ⚠️ Y SE LEE DEL MONTAJE DE DRIVE, que es red: cada intento son segundos. Por eso los
//    momentos son pocos y fijos, y se corta apenas uno da un frame con contenido.
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PLAN = arg('plan', '');
const FFDIR = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin'));
const FORZAR = process.argv.includes('--forzar');

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = dirname(PLAN);
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\ufeff/, ''));
const slug = plan.slug || base.split(/[\\/]/).pop();

const destino = join(REPO, 'public', 'cono-portadas', `${slug}.jpg`);
if (existsSync(destino) && !FORZAR) {
  console.log(`\n  Ya tiene tapa: ${destino}  (--forzar para rehacerla)\n`);
  process.exit(0);
}

const ffmpeg = join(FFDIR, 'ffmpeg.exe');
const ffprobe = join(FFDIR, 'ffprobe.exe');
if (!existsSync(ffmpeg)) { console.error(`\n  ✖ No encuentro ffmpeg en ${FFDIR}\n`); process.exit(1); }

// De donde sacarla: el video local si esta, y si no el de Drive.
const drive = (() => { try { return JSON.parse(readFileSync(join(base, 'drive.json'), 'utf8')); } catch { return null; } })();
const fuenteDe = (c) => {
  const local = join(base, 'video', `${c.archivo}.mp4`);
  if (existsSync(local)) return local;
  const d = (drive?.clases ?? []).find((x) => Number(x.n) === Number(c.n));
  if (d && drive.carpeta && d.archivo) {
    const p = join(drive.carpeta, d.rel ?? '', d.archivo);
    if (existsSync(p)) return p;
  }
  return null;
};

/**
 * ⚠️ LA PRIMERA CLASE NO SIEMPRE ES LA MEJOR TAPA —suele ser «Bienvenida», que es la
 *    persona hablando a cámara sobre fondo plano—, pero es la que REPRESENTA al curso y la
 *    que un lector reconoce. Se prueban las tres primeras por si la primera no se puede
 *    leer, no para elegir la mas linda: elegir por «vistosidad» es como se termina
 *    publicando la tapa de una clase al azar.
 */
const candidatas = (plan.clases ?? []).slice(0, 3).map(fuenteDe).filter(Boolean);
if (!candidatas.length) { console.error('\n  ✖ No encuentro el video de ninguna de las 3 primeras clases.\n'); process.exit(1); }

const MOMENTOS = ['00:00:20', '00:01:10', '00:02:30', '00:00:05'];
const tmp = join(tmpdir(), `tapa-${process.pid}.jpg`);

// Cuanto «pasa» en un frame: desviacion estandar de la luminancia. Un negro o un blanco
// planos dan ~0; una escena con contenido, decenas.
const contraste = (f) => {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', f, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YDIF', '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /YDIF=([\d.]+)/.exec(`${r.stdout}${r.stderr}`);
  if (m) return Number(m[1]);
  // Si signalstats no esta, se cae al tamano del JPEG: un frame plano comprime muchisimo
  // mas que uno con detalle. Es peor medida y alcanza para descartar un negro.
  try { return statSync(f).size / 1000; } catch { return 0; }
};

let mejor = null, mejorPuntaje = -1;
for (const fuente of candidatas) {
  for (const t of MOMENTOS) {
    try { unlinkSync(tmp); } catch { /* no existia */ }
    const r = spawnSync(ffmpeg, ['-v', 'error', '-ss', t, '-i', fuente, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', '-y', tmp], { encoding: 'utf8', timeout: 180_000 });
    if (r.status !== 0 || !existsSync(tmp)) continue;
    const p = contraste(tmp);
    if (p > mejorPuntaje) { mejorPuntaje = p; mejor = readFileSync(tmp); }
    // Suficiente contenido: no se gastan mas lecturas de red.
    if (p > 12) break;
  }
  if (mejorPuntaje > 12) break;
}
try { unlinkSync(tmp); } catch { /* ya no estaba */ }

if (!mejor) { console.error('\n  ✖ No pude extraer ningún frame legible.\n'); process.exit(1); }

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, mejor);
console.log(`\n  ✓ tapa de «${plan.curso}»: ${destino}  (${Math.round(mejor.length / 1024)} KB · contraste ${mejorPuntaje.toFixed(1)})`);
console.log(`    Sumala al catálogo con: node scripts/curso-categoria-portada.mjs\n`);
