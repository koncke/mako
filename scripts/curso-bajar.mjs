// Baja el curso ENTERO desde el plan.json que armó curso-plan.mjs.
//
// Decisiones que importan (medidas, no supuestas):
//   · --referer es OBLIGATORIO y es LO ÚNICO que hace falta para autenticar. La
//     privacidad "solo en estos dominios" de Vimeo se valida por el header
//     Referer, no por sesión. Verificado: con --referer y SIN cookies, yt-dlp
//     lista los 12 formatos hasta 1080p.
//   · Las cookies quedaron OPCIONALES (--cookies), y por default APAGADAS. No
//     solo son innecesarias acá: con el Chrome dedicado abierto, el DB de
//     cookies está lockeado y yt-dlp aborta con "Could not copy Chrome cookie
//     database" (issue 7271) — o sea que pedirlas rompía la descarga por una
//     credencial que nadie necesitaba. Si algún día una plataforma sí las pide,
//     --cookies las manda apuntando al SUBDIRECTORIO del perfil (…\perfil\Default),
//     porque yt-dlp hace dirname() para encontrar 'Local State'.
//   · --ffmpeg-location: ffmpeg NO está en el PATH de esta máquina. Vimeo sirve
//     video y audio por separado, así que sin merge no hay archivo.
//   · --download-archive: reanudable. Volver a correr no re-baja nada.
//
//   node <abs>\scripts\curso-bajar.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-bajar.mjs --plan … --solo 3,7,12
//   node <abs>\scripts\curso-bajar.mjs --plan … --listar

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const tiene = (n) => process.argv.includes(`--${n}`);

const PLAN = arg('plan', '');
const PERFIL = arg('perfil', 'C:\\cursos\\perfil');
const SOLO = arg('solo', '');
const FFDIR = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin'));
const FORMATO = arg('formato', 'bv*+ba/b');
const PAUSA = arg('pausa', '1');
// Fragmentos en paralelo. Ver el porqué (y por qué 4) junto al flag.
const CONCURRENTES = arg('concurrentes', '8');

if (!PLAN || !existsSync(PLAN)) {
  console.error('\n  ✖ Falta --plan <ruta a plan.json>. Lo produce curso-plan.mjs.\n');
  process.exit(1);
}

// Sin el replace del BOM, un plan.json editado desde PowerShell 5.1 revienta:
// «Set-Content -Encoding utf8» escribe UTF-8 CON BOM y JSON.parse no lo tolera.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const base = dirname(PLAN);
const dirVideo = join(base, 'video');

// yt-dlp: preferir el ejecutable, caer al módulo de Python (así se instaló acá).
const resolverYtdlp = () => {
  for (const c of [['yt-dlp', []], ['yt-dlp.exe', []]]) {
    const p = spawnSync(c[0], ['--version'], { encoding: 'utf8' });
    if (p.status === 0) return { cmd: c[0], pre: [], version: p.stdout.trim() };
  }
  for (const py of ['python', 'py']) {
    const p = spawnSync(py, ['-m', 'yt_dlp', '--version'], { encoding: 'utf8' });
    if (p.status === 0) return { cmd: py, pre: ['-m', 'yt_dlp'], version: p.stdout.trim() };
  }
  return null;
};

const yt = resolverYtdlp();
if (!yt) {
  console.error('\n  ✖ No encuentro yt-dlp. Instalalo con:');
  console.error('      python -m pip install -U yt-dlp pycryptodomex\n');
  process.exit(1);
}

const ffmpegOk = existsSync(join(FFDIR, 'ffmpeg.exe'));

let clases = plan.clases ?? [];
if (SOLO) {
  const n = new Set(SOLO.split(',').map((x) => Number(x.trim())).filter(Boolean));
  clases = clases.filter((c) => n.has(c.n));
}

// Las clases que el propio plan marcó como sin fuente NO se intentan: son las que
// la plataforma reporta con duración 00:00, y del otro lado dan HTTP 404. Intentarlas
// no es «por si acaso»: son 10 reintentos × ~300 fragmentos cada una, y ensucian el
// log con cientos de ERROR que después parecen un problema del descargador.
const vacias = clases.filter((c) => c.sinFuente);
if (vacias.length && !tiene('incluir-vacias')) {
  clases = clases.filter((c) => !c.sinFuente);
}

console.log(`\n  Curso   : ${plan.curso}`);
console.log(`  Clases  : ${clases.length}${SOLO ? ` (filtradas de ${plan.clases.length})` : ''}`);
console.log(`  yt-dlp  : ${yt.version}${yt.pre.length ? ' (vía python -m yt_dlp)' : ''}`);
console.log(`  ffmpeg  : ${ffmpegOk ? FFDIR : '⚠ NO encontrado — Vimeo no va a poder mergear video+audio'}`);
console.log(`  Referer : ${plan.referer}`);
console.log(`  Destino : ${dirVideo}`);
if (vacias.length) {
  const modo = tiene('incluir-vacias') ? 'las intento igual (--incluir-vacias)' : 'las saltea';
  console.log(`  ⚠ ${vacias.length} clase(s) sin fuente en la plataforma (duración 00:00) — ${modo}:`);
  console.log(`    ${vacias.map((c) => c.n).join(', ')}`);
}
console.log('');

if (tiene('listar')) {
  for (const c of clases) console.log(`  ${String(c.n).padStart(2, '0')}  ${c.duracion}  ${c.titulo}   [${c.plataforma} ${c.videoId}]`);
  console.log('');
  process.exit(0);
}

if (!ffmpegOk) {
  console.error('  ✖ Sin ffmpeg no sigo: bajaría pistas sueltas sin unir.');
  console.error(`    Pasá la carpeta con --ffmpeg <dir que contiene ffmpeg.exe>\n`);
  process.exit(1);
}

mkdirSync(dirVideo, { recursive: true });
const archivo = join(base, 'bajados.txt'); // el registro de reanudación de yt-dlp

// ⚠️ EL REGISTRO SOBREVIVE A LOS ARCHIVOS, Y ESO SE VE COMO «YA ESTÁ». `--liberar` de
// curso-a-drive.mjs borra los .mp4 locales cuando ya están en Drive —está bien, son
// cientos de megas— pero `bajados.txt` sigue diciendo «esta clase ya se bajó». Reanudar
// un curso liberado no baja NADA, `video/` queda vacío, y yt-dlp no lo reporta como
// error: es su comportamiento correcto. El síntoma es «parece que ya está».
//
// Se detecta cruzando las tres fuentes: el registro dice que sí, el disco dice que no, y
// Drive tampoco lo tiene. Solo cuando las TRES coinciden hay un problema — un archivo
// liberado que SÍ está en Drive no es un problema, es el diseño.
const idsRegistrados = (() => {
  try {
    return new Set(readFileSync(archivo, 'utf8').split(/\r?\n/)
      .map((l) => l.trim().split(/\s+/).pop()).filter(Boolean));
  } catch { return new Set(); }
})();
if (idsRegistrados.size) {
  const enDrive = (() => {
    try {
      const d = JSON.parse(readFileSync(join(base, 'drive.json'), 'utf8').replace(/^﻿/, ''));
      return new Set((d.clases ?? []).filter((x) => x.videoId).map((x) => Number(x.n)));
    } catch { return new Set(); }
  })();
  const fantasmas = clases.filter((c) => idsRegistrados.has(String(c.videoId))
    && !existsSync(join(dirVideo, `${c.archivo}.mp4`))
    && !enDrive.has(Number(c.n)));
  if (fantasmas.length) {
    console.log(`\n  ⚠ ${fantasmas.length} clase(s) figuran en bajados.txt, NO están en video/ y TAMPOCO en Drive.`);
    for (const c of fantasmas.slice(0, 6)) console.log(`      n=${c.n}  ${String(c.titulo).slice(0, 54)}`);
    if (fantasmas.length > 6) console.log(`      … y ${fantasmas.length - 6} más`);
    console.log(`    yt-dlp las va a saltear y video/ va a quedar sin ellas, sin dar error.`);
    console.log(`    Para volver a bajarlas: sumá --rebajar (les saca la línea del registro).\n`);
  }
  if (tiene('rebajar') && fantasmas.length) {
    const quitar = new Set(fantasmas.map((c) => String(c.videoId)));
    const quedan = readFileSync(archivo, 'utf8').split(/\r?\n/)
      .filter((l) => !quitar.has(l.trim().split(/\s+/).pop() ?? ''));
    writeFileSync(archivo, quedan.join('\n'), 'utf8');
    console.log(`  ✓ --rebajar: saqué ${fantasmas.length} línea(s) de bajados.txt.\n`);
  }
}

const fallos = [];
let ok = 0;

for (const [i, c] of clases.entries()) {
  console.log(`\n  ── ${i + 1}/${clases.length} · ${String(c.n).padStart(2, '0')} ${c.titulo} (${c.duracion}) ──`);

  const args = [
    ...yt.pre,
    c.url,
    '--referer', plan.referer,
    // ⚠️ VIMEO BLOQUEA POR HUELLA TLS, y el error no se parece a lo que es.
    //
    // 7 de las 227 clases de MasteryHaus fallaron con «This request has been blocked
    // due to its TLS fingerprint». No es el referer, no es la sesión, no es la IP: es
    // que el handshake de yt-dlp NO se parece al de un navegador, y algunos videos —no
    // todos, los mismos 7 siempre— tienen esa protección encendida.
    //
    // `--impersonate` hace que el handshake sea el de Chrome. Necesita `curl_cffi` en el
    // MISMO Python que corre yt-dlp, y además un yt-dlp reciente: con el de julio de
    // 2026 los targets figuraban «unavailable» aun con curl_cffi instalado, y eso se lee
    // como «falta la dependencia» cuando lo que faltaba era actualizar yt-dlp.
    //
    // Se manda SIEMPRE: si no hay soporte, yt-dlp lo ignora y sigue con el handshake de
    // siempre. El costo de ponerlo es cero; el de no ponerlo son 7 videos que se
    // reportan como error genérico.
    '--impersonate', 'chrome',
    // Si el plan no trae UA, NO se manda el flag: `--user-agent ""` es peor que
    // omitirlo (yt-dlp arranca con User-Agent en blanco y algunos CDN invalidan
    // el token por eso). Omitirlo deja el default de yt-dlp, que funciona.
    ...(plan.userAgent ? ['--user-agent', plan.userAgent] : []),
    // Solo si se piden a mano: ver la nota de arriba sobre el DB lockeado.
    ...(tiene('cookies') ? ['--cookies-from-browser', `chrome:${join(PERFIL, 'Default')}`] : []),
    '--ffmpeg-location', FFDIR,
    '-f', FORMATO,
    '--merge-output-format', 'mp4',
    '-o', join(dirVideo, `${c.archivo}.%(ext)s`),
    '--download-archive', archivo,
    '--no-overwrites',
    '--no-playlist',
    // ⚠️ SIN ESTO yt-dlp baja UN FRAGMENTO POR VEZ. Un HLS de una clase de 40 min son
    //    ~1.500 fragmentos, y medido el 28/08/2026 cada conexión da 600-800 KB/s: la clase
    //    tarda 10-13 min aunque pese 214 MB. Con 5.000 clases en la cola eso son SEMANAS.
    //
    //    El límite es POR CONEXIÓN, no de la línea —por eso abrir 4 multiplica y no reparte—.
    //    Medido dos veces sobre el MISMO curso, una atras de la otra:
    //      4 fragmentos -> 288 MB en 120 s  (2,40 MB/s)
    //      8 fragmentos -> 462 MB en 120 s  (3,85 MB/s)   <- 1,6x, y sin un solo 503
    //
    //    8 y no 16: el CDN ya venia devolviendo 503 de a ratos con UNA sola conexion, y un
    //    503 en la mitad de un HLS no se recupera bien. Se sube cuando se mida que aguanta.
    '--concurrent-fragments', CONCURRENTES,
    '--retries', '5',
    '--fragment-retries', '5',
    // ⚠️ ABORTAR en vez de saltear el fragmento que no está. Las URLs de los segmentos
    //    del CDN vienen FIRMADAS y vencen; en un video largo eso pasa A MITAD de la
    //    descarga y a partir de ahí TODOS los fragmentos dan 410 Gone.
    //
    //    Sin este flag yt-dlp reintenta cada fragmento y después lo SALTEA, así que
    //    muele miles de fragmentos muertos durante horas y al final escribe un archivo
    //    con agujeros que igual no sirve. El 28/08/2026 se comió 7 HORAS en una sola
    //    clase de 62 min, con la cola entera detrás esperando.
    //
    //    Con el flag, el 410 mata el intento en segundos. La clase queda como fallida y
    //    se rebaja después con un manifiesto nuevo, que es lo único que la arregla:
    //    reintentar con la MISMA firma vencida no puede funcionar por definición.
    '--abort-on-unavailable-fragment',
    '--sleep-requests', PAUSA,
    '--no-warnings',
    // ⚠️ El progreso, en un archivo, hay que ACOTARLO. yt-dlp repinta la linea con
    //    retorno de carro: en una terminal se ve como una sola linea que cambia, pero
    //    cuando la salida va a un archivo cada repintado se escribe ENTERO. La cola del
    //    26/08 dejo un log de 15 MB en el que el error quedaba enterrado.
    //
    //    Apagarlo del todo tampoco sirve: sin velocidad en el log no se puede saber si
    //    una descarga avanza o esta colgada, y medir los bytes desde afuera engania —
    //    las descargas van a rafagas y una ventana corta cae justo en el hueco entre
    //    dos streams y parece frenada. Una linea cada 30s da las dos cosas.
    ...(process.stdout.isTTY
      ? ['--progress']
      : ['--progress', '--newline', '--progress-delta', '30']),
  ];

  const p = spawnSync(yt.cmd, args, { stdio: 'inherit' });
  if (p.status === 0) { ok++; continue; }

  fallos.push({ n: c.n, titulo: c.titulo, url: c.url, code: p.status });
  console.error(`  ✖ falló (código ${p.status}) — sigo con las demás`);
}

const bajados = existsSync(dirVideo) ? readdirSync(dirVideo).filter((f) => /\.(mp4|mkv|webm|m4v)$/i.test(f)) : [];

console.log('\n' + '─'.repeat(70));
console.log(`  ${ok}/${clases.length} clases OK · ${fallos.length} con error`);
console.log(`  Archivos en destino: ${bajados.length}`);
console.log(`  Registro reanudable: ${archivo}`);
console.log('─'.repeat(70));

if (fallos.length) {
  console.log('\n  Fallaron (volver a correr las reintenta; las OK se saltean solas):');
  for (const f of fallos) console.log(`    ${String(f.n).padStart(2, '0')}  ${f.titulo}`);
  console.log(`\n  Reintento puntual:  --solo ${fallos.map((f) => f.n).join(',')}`);
  console.log('  Si dice 403: revisá que plan.referer sea el dominio que embebe el');
  console.log('  player — es lo único que autentica un embed restringido por dominio.');
  console.log('  Si dice "Could not copy Chrome cookie database": estás pasando');
  console.log('  --cookies con el Chrome dedicado abierto. No hacen falta: sacá el flag.');
}

console.log(`\n  Siguiente:`);
console.log(`    node <abs>\\scripts\\curso-audio.mjs --de "${dirVideo}" --a "${join(base, 'audio')}"`);
console.log(`    npx tsx <abs>\\scripts\\curso-transcribir.ts --de "${join(base, 'audio')}" --a "${join(base, 'texto')}"\n`);

process.exit(fallos.length ? 1 : 0);
