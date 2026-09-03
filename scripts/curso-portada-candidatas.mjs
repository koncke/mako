// Saca N fotogramas CANDIDATOS de un curso y los pega en una hoja de contacto numerada,
// para que alguien (o un agente) MIRE y elija cuál sirve de portada.
//
//   node scripts/curso-portada-candidatas.mjs --slug metolodogia-jads
//   node scripts/curso-portada-candidatas.mjs --slug X --candidatas 12 --salida C:/cursos/_cand
//
// ── Por qué existe ──────────────────────────────────────────────────────────────────────
// `curso-portada-desde-video.mjs` mira CUATRO offsets fijos del PRIMER video del curso y se
// queda con el de más contraste (`signalstats YDIF`). Medido sobre los 13 cursos que se
// cargaron desde Drive, eso produjo:
//
//   · higher-levels-ae-mastery → un frame con «Discord.gg/yYDwWaT3RY» en rojo, gigante,
//     cruzando la imagen: la marca de agua del que pirateó el curso.
//   · youtube-2026            → una captura de ZOOM, con la tira de miniaturas de los
//     participantes a la derecha.
//   · linkedin-for-ceos       → un documento compartido en pantalla, ilegible al tamaño de
//     una tarjeta, con otra marca de agua encima («smmarketing.cours»).
//   · universidad-de-youtube  → una oficina vacía con el autor descentrado y fuera de foco.
//
// El contraste NO mide nada de eso. Un slide blanco con texto negro tiene MÁS contraste que
// la cara de una persona, así que el criterio viejo prefiere activamente lo que no sirve.
//
// ⚠️ Y no se arregla con otro desempate automático. «Si hay que desempatar, todavía estás
//    adivinando»: no hay ninguna métrica de imagen que distinga «el autor mirando a cámara»
//    de «un señor cualquiera en un slide», ni que sepa que ese texto rojo es una marca de
//    agua de piratería y no el título del curso. Eso se ve MIRANDO. Este script no elige:
//    prepara para que alguien elija, que es lo honesto.
//
// ⚠️ Y muestrea VARIOS VIDEOS, no varios offsets de uno. La clase 1 de un curso es casi
//    siempre la bienvenida —placa de logo, o el autor leyendo las reglas de la casa—, así
//    que el mejor plano del curso rara vez está ahí. De los 13, los tres frames que sí
//    servían salieron de clases del medio.
import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SLUG = arg('slug', '');
const CUANTAS = Number(arg('candidatas', 12));
const RAIZ = arg('salida', 'C:\\cursos\\_candidatas');

if (!SLUG) { console.error('\n  ✖ Falta --slug\n'); process.exit(1); }

const driveJson = `C:\\cursos\\${SLUG}\\drive.json`;
if (!existsSync(driveJson)) { console.error(`\n  ✖ No existe ${driveJson}\n`); process.exit(1); }
const drive = JSON.parse(readFileSync(driveJson, 'utf8'));

/**
 * Los videos que existen DE VERDAD en el montaje.
 *
 * ⚠️ Se comprueba archivo por archivo y no se confía en `drive.json`: ese archivo lo
 *    escriben DOS rutinas distintas con dos formas del campo `rel`, y un `-ss` de ffmpeg
 *    sobre una ruta que no existe no falla ruidoso — devuelve un jpg de 0 bytes que después
 *    se pega igual en la hoja, como un rectángulo negro que parece un frame oscuro.
 */
const videos = (drive.clases ?? [])
  .map((c) => ({ ...c, ruta: join(drive.carpeta ?? '', c.rel ?? '', c.archivo ?? '') }))
  .filter((c) => c.archivo && existsSync(c.ruta));

if (!videos.length) {
  console.error(`\n  ✖ Ningún video de ${SLUG} está accesible en el montaje.`);
  console.error(`     ¿Está Google Drive montado? (carpeta: ${drive.carpeta})\n`);
  process.exit(2);
}

/**
 * Se saltean el 15% inicial y el 10% final del CURSO.
 *
 * La bienvenida y la despedida son las dos clases que menos representan a un curso, y son
 * justo las que caen primero en cualquier muestreo ingenuo. Con 12 candidatas sobre 100
 * clases, tomar de la 16 a la 90 no pierde nada y saca las dos puntas malas.
 */
const desde = Math.floor(videos.length * 0.15);
const hasta = Math.max(desde + 1, Math.floor(videos.length * 0.90));
const rango = videos.slice(desde, hasta);
const paso = Math.max(1, Math.floor(rango.length / CUANTAS));
const elegidos = [];
for (let i = 0; i < rango.length && elegidos.length < CUANTAS; i += paso) elegidos.push(rango[i]);

const dir = join(RAIZ, SLUG);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const duracion = (ruta) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', ruta], { encoding: 'utf8' });
  const d = Number(String(r.stdout ?? '').trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
};

console.log(`\n  ${SLUG}: ${videos.length} videos accesibles · saco ${elegidos.length} candidatas\n`);

const hechas = [];
for (const [k, v] of elegidos.entries()) {
  const dur = duracion(v.ruta);
  // A un TERCIO de la clase: pasado el saludo y antes del cierre. Si no se pudo leer la
  // duración, 90 s a ciegas — es mejor que el segundo 0, que siempre es una placa.
  const t = dur ? Math.max(5, dur / 3) : 90;
  const out = join(dir, `${String(k + 1).padStart(2, '0')}.jpg`);
  const r = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-ss', String(t),
    '-i', v.ruta, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', '-y', out],
    { encoding: 'utf8', timeout: 120_000 });
  const ok = existsSync(out) && readdirSync(dir).includes(`${String(k + 1).padStart(2, '0')}.jpg`);
  if (ok) hechas.push({ n: k + 1, titulo: v.titulo, archivo: out });
  console.log(`   ${String(k + 1).padStart(2)}. ${ok ? '✓' : '✖'} ${String(v.titulo ?? v.archivo).slice(0, 62)}`);
  if (!ok && r.stderr) console.log(`        ${String(r.stderr).trim().split('\n').pop()?.slice(0, 90)}`);
}

if (!hechas.length) { console.error('\n  ✖ No salió ninguna candidata.\n'); process.exit(3); }

// La hoja de contacto: 4 por fila, con el número quemado arriba a la izquierda para poder
// nombrarlas sin ambigüedad («la 7»).
const sheet = join(RAIZ, `${SLUG}.png`);
const entradas = hechas.flatMap((h) => ['-i', h.archivo]);
/**
 * ⚠️ DOS trampas de ffmpeg al armar el mosaico, y la primera diagnosticada MAL.
 *
 * 1. `tile` TIENE UNA SOLA ENTRADA. Apila los frames de UN stream a lo largo del tiempo;
 *    no es un montador de N imagenes. Pasarle N labels da «More input link labels
 *    specified for filter 'tile' than it has inputs: 12 > 1» y el error que llega a la
 *    ultima linea del stderr es «Error : Invalid argument», que no nombra ni el filtro ni
 *    la causa. Las N imagenes se unen antes con `concat`, y recien eso se tilea.
 *
 *    ⚠️ Esto se diagnostico primero como un problema de ESCAPADO del `fontfile`, y
 *       era falso: la fuente andaba desde el principio. Lo que engaña es que el unico
 *       sintoma visible («Invalid argument») aparece igual con las dos causas, y el
 *       script solo mostraba la ULTIMA linea del stderr — donde la causa nunca esta. Es
 *       la regla del repo sobre mensajes recortados, pagada de nuevo: para DECIDIR sobre
 *       la causa de un fallo hace falta el stderr entero.
 *
 * 2. `concat` exige que todas sus entradas coincidan tambien en SAR, no solo en tamaño.
 *    Un `pad` deja SAR 2817:2816 en algunos frames y 1:1 en otros, asi que sin `setsar=1`
 *    falla con «parameters do not match» aunque las 12 midan 640x360.
 *
 * Y `drawtext` en Windows si necesita `fontfile` explicito (sin el: «Fontconfig error:
 * Cannot load default config file»). Se copia la fuente al lado de las candidatas y ffmpeg
 * corre con `cwd` ahi, que evita tener que escapar la letra de unidad.
 */
const FUENTE_SRC = 'C:\\Windows\\Fonts\\arialbd.ttf';
const FUENTE = 'f.ttf';
try { copyFileSync(FUENTE_SRC, join(dir, FUENTE)); } catch { /* sin fuente se numera igual, ver abajo */ }
const hayFuente = existsSync(join(dir, FUENTE));
const numero = (h) => hayFuente
  ? `,drawtext=fontfile=${FUENTE}:text=${h.n}:fontcolor=yellow:fontsize=54:box=1:boxcolor=black@0.75:boxborderw=8:x=12:y=10`
  : '';   // sin fuente se arma SIN numerar: una hoja sin numeros sirve, una que no existe no
const etiquetas = hechas.map((h, i) =>
  `[${i}:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:-1:-1:color=black,setsar=1` +
  `${numero(h)}[v${i}]`
).join(';');
const refs = hechas.map((_, i) => `[v${i}]`).join('');
const cadena = `${etiquetas};${refs}concat=n=${hechas.length}:v=1:a=0[s];`
  + `[s]tile=4x${Math.ceil(hechas.length / 4)}[out]`;
const rt = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', ...entradas,
  '-filter_complex', cadena, '-map', '[out]', '-frames:v', '1', '-y', sheet],
  { encoding: 'utf8', timeout: 180_000, cwd: dir });   // cwd: para que 'f.ttf' resuelva sin ruta

if (!existsSync(sheet)) {
  console.error(`\n  ✖ No pude armar la hoja: ${String(rt.stderr ?? '').trim().split('\n').pop()}\n`);
  process.exit(4);
}

console.log(`\n  → hoja de contacto: ${sheet}`);
console.log(`  → candidatas sueltas en: ${dir}\n`);
for (const h of hechas) console.log(`     ${String(h.n).padStart(2)} · ${String(h.titulo ?? '').slice(0, 70)}`);
console.log();
