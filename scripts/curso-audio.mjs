// Video de clase -> audio chico, listo para transcribir.
//
// Por que existe: lib/transcribe.ts corta en 25 MB (MAX_BYTES, linea 13) y la
// cascada barata de lib/ai-cheap.ts corta antes todavia, a 14 MB inline. Un video
// de clase de 40 min pesa cientos de MB, asi que SIEMPRE devuelve 'muy_grande' ->
// HTTP 413. No es un bug: hay que mandar audio, no video.
//
// A 32 kbps mono 16 kHz una hora de clase pesa ~14 MB y el habla se transcribe
// igual de bien. Si algo se pasa del objetivo, se parte por tiempo.
//
// ffmpeg NO esta en el PATH de esta maquina, pero hay un build GPL completo en
// disco. No hace falta instalar nada.
//
//   node scripts/curso-audio.mjs --de C:\cursos\video --a C:\cursos\audio

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { esIntermedio } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const DE = arg('de', 'C:\\cursos\\video');
const A = arg('a', 'C:\\cursos\\audio');
const KBPS = Number(arg('kbps', 32));
const MB_OBJETIVO = Number(arg('mb', 13)); // el tope MÁS CHICO de la cascada, no el primero
const FFMPEG = arg('ffmpeg', join(
  process.env.LOCALAPPDATA ?? '',
  'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe',
));

const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.ts', '.flv', '.mpg', '.mpeg']);
const mb = (b) => (b / 1048576).toFixed(1);

if (!existsSync(FFMPEG)) {
  console.error(`\n  ✖ No encuentro ffmpeg en:\n    ${FFMPEG}`);
  console.error('    Pasalo con --ffmpeg <ruta>. (Get-Command ffmpeg da vacío en esta');
  console.error('    máquina aunque el binario exista: no está en el PATH.)\n');
  process.exit(1);
}
if (!existsSync(DE)) { console.error(`\n  ✖ No existe la carpeta de entrada: ${DE}\n`); process.exit(1); }
mkdirSync(A, { recursive: true });

// Segundos que caben en el objetivo con este bitrate. A 32 kbps -> 4.000 B/s,
// asi que 13 MB son ~56 min: la mayoria de las clases nunca se parte.
// ⚠️ 13 MB, NO 20: el número sale del tope MÁS CHICO de la cascada de STT, no del
// primer proveedor. Groq y OpenAI aceptan 25 MB, pero el ÚLTIMO escalón es Gemini,
// que manda el audio INLINE dentro del request y topea en 14. Con piezas de 20 MB
// toda clase larga nacía sin fallback: Groq en su cuota horaria (7.200 s/h) + OpenAI
// sin crédito = «ningún proveedor pudo transcribir», con Gemini disponible y excluido
// por tamaño. Medido en BlueHacker el 22/08/2026: 32 clases falladas, las 32 con una
// pieza por encima de 14 MB, y ninguna por otra causa.
//
// El corolario: un tope de tamaño elegido contra UN proveedor apaga a los demás en
// silencio. Se elige contra el más restrictivo de todos los que se piensa usar.
const SEG_MAX = Math.floor((MB_OBJETIVO * 1048576) / ((KBPS * 1000) / 8));

const duracion = (f) => {
  const p = spawnSync(FFMPEG, ['-i', f], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(`${p.stderr}`);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100;
};

const correr = (args) => {
  const p = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (p.status === 0) return;
  // ⚠️ EL MENSAJE SE RECORTA A 4 LÍNEAS PARA QUE SE PUEDA LEER, y con eso se pierde la
  //    evidencia. Cuando el video de origen tiene la pista de audio rota, el «Invalid data
  //    found» sale al PRINCIPIO y lo tapan cientos de líneas posteriores; las últimas
  //    cuatro dicen «Task finished with error code: -22», que no distingue un material
  //    roto de un argumento mal puesto. Un mensaje recortado sirve para MOSTRAR el error,
  //    no para DECIDIR sobre su causa — así que el stderr entero viaja aparte.
  const e = new Error((`${p.stderr}`.trim().split('\n').slice(-4).join('\n')) || 'ffmpeg falló');
  e.stderr = `${p.stderr}`;
  throw e;
};

// ⚠️ Un m4a escribe su `moov atom` AL FINAL. Si el proceso muere a mitad —y acá murió,
// porque el loop se cortó con el ffmpeg corriendo— queda un archivo de tamaño
// razonable, con nombre final, y COMPLETAMENTE ilegible: «moov atom not found». El
// script lo daba por hecho (saltea lo que ya existe) y ScreenApp lo aceptaba sin
// error porque son bytes; la transcripción simplemente nunca llegaba.
//
// Por eso se escribe a un archivo PARCIAL y se renombra al final. Un corte deja un
// .parcial —que el filtro de entrada no mira— en vez de un .m4a mentiroso.
const PARCIAL = '.parcial';
const valido = (f) => {
  const p = spawnSync(FFMPEG, ['-v', 'error', '-i', f, '-f', 'null', '-'], { encoding: 'utf8' });
  // ffmpeg con -f null decodifica de verdad: un moov faltante o datos truncados salen acá.
  return p.status === 0 && !/moov atom not found|Invalid data found|error/i.test(`${p.stderr}`);
};

// ⚠️ «DECODIFICA» NO ES «ESTÁ COMPLETO», y confundirlos costó un curso entero. `valido`
// de arriba contesta si el archivo se puede LEER; un audio de 4 minutos sacado de una
// clase de 24 se lee perfecto. Con eso, la reanudación decía «ya estaba» para siempre y
// la transcripción salía impecable —bien escrita, bien puntuada— de los primeros cinco
// minutos de la clase. Medido en «Creator Club»: 50 de 62 audios cortados, uno al 2%
// (1,7 min de habla para una clase de 69), y los 50 publicados en el portal.
//
// La causa de fondo del corte es una CARRERA: el audio se extrajo mientras yt-dlp
// todavía estaba escribiendo el .mp4, así que ffmpeg copió lo que había hasta ahí. El
// guard de `.part` cubre el caso en que el temporal existe; cuando no queda ninguno, la
// única evidencia de que el audio quedó corto es su DURACIÓN.
//
// La regla: cuando un paso deriva un archivo de otro, lo que se verifica es que llegue
// hasta el FINAL de la fuente. La integridad se mide contra el original, nunca contra
// sí mismo.
const TOLERANCIA = 0.97;   // el re-encode pierde fracciones de segundo, no minutos
const completo = (f, durFuente) => {
  if (!durFuente) return true;                 // sin fuente medible no se puede afirmar nada
  const d = duracion(f);
  if (d == null) return false;
  return d >= durFuente * TOLERANCIA || durFuente - d <= 5;
};

// ⚠️ Esta carpeta la puede estar ESCRIBIENDO el descargador ahora mismo, y los
// archivos intermedios de yt-dlp parecen videos terminados: para una clase a medio
// bajar quedan «<titulo>.fhls-fastly_skyfire-598.mp4» (solo la pista de video, ya
// completa y de 170 MB) junto a un .part del audio. Tomarlo por bueno produce un
// audio mudo o un ffmpeg que falla con «Invalid argument», y el diagnóstico
// aparenta ser un problema de ffmpeg cuando es una carrera de escritura.
//
// Dos filtros, y el primero es una ALLOWLIST (guarda en positivo):
//   1. Si viene --plan, solo se aceptan los nombres que el plan declara.
//   2. Siempre: se descartan los intermedios «.f<formato>.<ext>» y todo lo que
//      tenga un hermano .part / .ytdl (= sigue bajando).
const PLAN = arg('plan', '');
// ⚠️ La allowlist va por NÚMERO DE CLASE, no por nombre completo. Comparar el nombre
// entero parecía más estricto y era un salteo silencioso: el descargador no siempre
// produce exactamente el `archivo` del plan. Medido — el plan decía
// «212 - 1. No pares de hacer $$$» y en disco quedó «… hacer $$»: un `$` menos, y
// las clases 212 y 215 se descartaron sin una línea de aviso. El número de 3 dígitos
// es la clave real y es la que usa TODO el pipeline aguas abajo.
// Sobre el BASENAME siempre: con el curso organizado la ruta relativa empieza con la
// carpeta del módulo y el número de clase deja de estar al principio.
const nDe = (f) => { const m = /^(\d{1,3})\s*-\s*/.exec(basename(f)); return m ? Number(m[1]) : null; };
const esperados = PLAN && existsSync(PLAN)
  // El replace del BOM: PowerShell 5.1 lo mete al editar el plan y JSON.parse muere.
  ? new Set(JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, '')).clases.map((c) => c.n))
  : null;

// video/ puede estar PLANO o organizado en «<NN Módulo>/» (ver curso-organizar.mjs),
// así que se camina un nivel de subcarpetas. Devuelve rutas relativas a DE.
const listar = (dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? readdirSync(join(dir, e.name)).map((f) => join(e.name, f))
    : [e.name]);

// ⚠️ `listar` devuelve rutas RELATIVAS, que con el curso organizado vienen con la
// carpeta del módulo adelante («01 1. START HERE\001 - ….mp4»). Todo lo que mire el
// nombre tiene que hacerlo sobre el basename: aplicar el regex del número a la ruta
// completa descartó los 247 videos con «sin número de clase al principio».
const todosVideo = listar(DE).filter((f) => VIDEO.has(extname(f).toLowerCase()));
// esIntermedio vive en curso-comun.mjs (ver el porqué allá): estaba copiado en tres
// scripts con el mismo bug, y la bandera `i` escondía toda clase cuyo título empezara
// con «F» después de un punto.
// Clases que YA tienen su archivo final. Un temporal de una de ellas es basura de un
// intento anterior, no una descarga en curso: quedó un «.part-Frag293.part» de la
// clase 193 y su .mp4 completo de 265 MB se salteó para siempre. Un temporal viejo NO
// puede bloquear un archivo terminado.
const terminadas = new Set(todosVideo.filter((f) => !esIntermedio(f)).map(nDe).filter(Boolean));

const temporales = listar(DE).filter((f) => /\.(part|ytdl)$|\.part-Frag\d+/i.test(f));
const enVuelo = new Set(temporales.map(nDe).filter((n) => n && !terminadas.has(n)));
const basura = temporales.filter((f) => { const n = nDe(f); return n && terminadas.has(n); });

const descartes = [];
const entradas = todosVideo.filter((f) => {
  if (esIntermedio(f)) { descartes.push(`${f} (intermedio de yt-dlp)`); return false; }
  const n = nDe(f);
  if (n == null) { descartes.push(`${f} (sin número de clase al principio)`); return false; }
  if (esperados && !esperados.has(n)) { descartes.push(`${f} (la clase ${n} no está en el plan)`); return false; }
  if (enVuelo.has(n)) { descartes.push(`${f} (la clase ${n} sigue bajando)`); return false; }
  return true;
}).sort();

// Los descartes se DICEN, con el motivo. Un salteo silencioso fue exactamente el bug.
if (descartes.length) {
  console.log(`  (salteo ${descartes.length} archivo/s:)`);
  for (const d of descartes.slice(0, 8)) console.log(`     · ${d}`);
}
if (basura.length) {
  console.log(`  (${basura.length} temporal/es de intentos viejos, ignorados — su clase ya está completa)`);
}
if (!entradas.length) { console.error(`\n  ✖ No hay videos TERMINADOS en ${DE}\n`); process.exit(1); }

console.log(`\n  ${entradas.length} video(s) · ${KBPS} kbps mono 16 kHz · objetivo ${MB_OBJETIVO} MB (parte a los ${Math.floor(SEG_MAX / 60)} min)\n`);

let hechos = 0, saltados = 0, fallados = 0, partidos = 0;

/**
 * ¿El video trae pista de audio? Un `false` acá NO es un error: es una clase muda.
 *
 * ⚠️ Existe porque una sola clase sin audio ABORTABA LA TANDA ENTERA. El «Diccionario de
 * Marketing Digital» de la Certificación son 11 segundos de placa de título, sin sonido;
 * ffmpeg contesta «Output file does not contain any stream», el script lo contaba como
 * FALLADO, y con `fallados && !hechos` salía con código 1 — así que el circuito de la
 * corrida leía «la etapa no corrió» y frenaba las 153.
 *
 * Y contarla como fallada tampoco servía: una clase sin pista de audio no va a convertir
 * NUNCA, así que cada reintento la vuelve a chocar. Un fallo que no puede dejar de fallar
 * no es un fallo, es una característica del material — y va contada aparte, para que
 * «fallados» siga significando «reintentá esto».
 */
const tieneAudio = (src) => {
  // Mismo camino que `duracion`: `ffmpeg -i` escupe los streams por stderr. No se usa
  // ffprobe porque este script nunca lo necesitó y su ruta no está resuelta acá.
  const p = spawnSync(FFMPEG, ['-i', src], { encoding: 'utf8' });
  const txt = `${p.stderr}`;
  // Si ni siquiera listó streams, no se puede afirmar nada: se intenta igual y que el
  // error de verdad lo dé ffmpeg. «No pude averiguarlo» no es «no tiene».
  if (!/Stream #\d+:\d+/.test(txt)) return true;
  return /Stream #\d+:\d+.*: Audio:/i.test(txt);
};

let mudos = 0;

for (const f of entradas) {
  const src = join(DE, f);
  // `f` puede venir con subcarpeta de módulo; el audio SIEMPRE sale plano en A.
  const nombre = basename(f, extname(f));
  const dest = join(A, `${nombre}.m4a`);

  if (!tieneAudio(src)) {
    console.log(`  ○ ${nombre}  (SIN PISTA DE AUDIO — es una placa muda, no hay nada que transcribir)`);
    mudos++;
    continue;
  }

  // La duración de la FUENTE se mide primero: es la vara contra la que se decide si lo
  // que ya está en disco sirve, y también el criterio de partido de más abajo.
  const dur = duracion(src);

  // Reanudable: si ya existe la pieza (entera o la primera parte), no se rehace.
  // Pero «existe» no alcanza —un .m4a truncado de una corrida interrumpida existe y es
  // ilegible— y «decodifica» tampoco: ver la nota de `completo`. Se piden las dos.
  if (existsSync(dest)) {
    if (valido(dest) && completo(dest, dur)) { console.log(`  = ${nombre}  (ya estaba)`); saltados++; continue; }
    const d = duracion(dest);
    const motivo = d != null && dur ? `quedó en ${Math.round(d / 60)} de ${Math.round(dur / 60)} min` : 'no decodifica';
    console.log(`  ↻ ${nombre}  (el que estaba ${motivo} — lo rehago)`);
    unlinkSync(dest);
  } else if (existsSync(join(A, `${nombre}.parte00.m4a`))) {
    const piezas = readdirSync(A).filter((x) => x.startsWith(`${nombre}.parte`));
    const suma = piezas.reduce((s, x) => s + (duracion(join(A, x)) ?? 0), 0);
    if (!dur || suma >= dur * TOLERANCIA) { console.log(`  = ${nombre}  (ya estaba, en partes)`); saltados++; continue; }
    console.log(`  ↻ ${nombre}  (las partes suman ${Math.round(suma / 60)} de ${Math.round(dur / 60)} min — las rehago)`);
    for (const x of piezas) { try { unlinkSync(join(A, x)); } catch {} }
  }

  const base = ['-hide_banner', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', `${KBPS}k`];

  try {
    if (dur && dur > SEG_MAX) {
      correr([...base, '-f', 'segment', '-segment_time', String(SEG_MAX), '-reset_timestamps', '1', join(A, `${nombre}.parte%02d.m4a`)]);
      const piezas = readdirSync(A).filter((x) => x.startsWith(`${nombre}.parte`));
      const total = piezas.reduce((s, x) => s + statSync(join(A, x)).size, 0);
      // La rama partida NO tenía ninguna verificación: si el corte pasaba, las piezas
      // quedaban. Se exige lo mismo que a la entera — que entre todas cubran la fuente.
      const suma = piezas.reduce((s, x) => s + (duracion(join(A, x)) ?? 0), 0);
      if (suma < dur * TOLERANCIA) throw new Error(`las partes suman ${Math.round(suma / 60)} min de los ${Math.round(dur / 60)} de la fuente`);
      console.log(`  ✓ ${nombre}  →  ${piezas.length} partes, ${mb(total)} MB  (${Math.round(dur / 60)} min)`);
      partidos++;
    } else {
      // Atómico: se escribe al .parcial, se VERIFICA que decodifique, y solo
      // entonces pasa a .m4a. Un corte deja un .parcial, no un .m4a mentiroso.
      const tmp = join(A, `${nombre}${PARCIAL}`);
      if (existsSync(tmp)) unlinkSync(tmp);
      correr([...base, '-f', 'mp4', tmp]);
      if (!valido(tmp)) { unlinkSync(tmp); throw new Error('el audio salió ilegible (no decodifica)'); }
      if (!completo(tmp, dur)) {
        const d = duracion(tmp);
        unlinkSync(tmp);
        throw new Error(`el audio quedó en ${Math.round((d ?? 0) / 60)} min de los ${Math.round(dur / 60)} de la fuente (¿el video todavía se está bajando?)`);
      }
      renameSync(tmp, dest);
      const t = statSync(dest).size;
      // Red de seguridad: si igual se paso del tope real, avisar en vez de que
      // la transcripcion devuelva 413 mas tarde y parezca otro problema.
      const alerta = t > 25 * 1048576 ? '  ⚠ SE PASA DE 25 MB' : t > 14 * 1048576 ? '  ⚠ >14 MB: la cascada barata no lo toma inline' : '';
      console.log(`  ✓ ${nombre}  →  ${mb(t)} MB${dur ? `  (${Math.round(dur / 60)} min)` : ''}${alerta}`);
    }
    hechos++;
    // Salió bien: el .roto de la vuelta anterior ya cumplió su función —hizo que se
    // rebajara— y de acá en más sólo ocupa disco y ensucia el listado.
    try { if (existsSync(`${src}.roto`)) unlinkSync(`${src}.roto`); } catch { /* da igual */ }
  } catch (e) {
    // Un fallo NO borra lo anterior ni queda como estado terminal: se reporta y
    // se sigue. Es la lección del cron de anuncios (9 anuncios sin texto para
    // siempre porque un error contó como "ya transcrito").
    for (const x of [dest, ...readdirSync(A).filter((y) => y.startsWith(`${nombre}.parte`)).map((y) => join(A, y))]) {
      if (existsSync(x)) { try { unlinkSync(x); } catch {} }
    }
    console.error(`  ✖ ${nombre}\n     ${e.message.replace(/\n/g, '\n     ')}`);
    fallados++;

    /**
     * ── EL VIDEO DE ORIGEN PUEDE ESTAR ROTO, Y REINTENTAR NO LO ARREGLA ───────────────
     *
     * Medido el 31/08/2026 en «Curso de Trading ClutiFX», clase 4: el .mp4 estaba
     * completo —175 MB y 27:35, exactamente la duración del plan— y su pista AAC tenía
     * paquetes corruptos. ffmpeg cortaba la extracción a los 7:27 y esta rama lo daba por
     * fallado, que está BIEN: publicar 27% de una clase como si fuera la clase entera es
     * el bug de «Creator Club».
     *
     * Lo que faltaba es que alguien lo arreglara. El archivo EXISTE, así que ningún
     * chequeo lo ve: el registro de yt-dlp dice que se bajó, el disco dice que está, y el
     * pipeline reintenta la misma extracción sobre el mismo material roto ronda tras
     * ronda hasta que se rinde y publica el curso sin esa clase.
     *
     * Se pone en cuarentena renombrándolo. Con el .mp4 fuera del camino, la guarda de
     * fantasmas de `curso-bajar.mjs` lo ve como no bajado, le saca la línea del registro
     * y yt-dlp lo trae de nuevo. Son dos mecanismos que ya existen; lo único que faltaba
     * era conectarlos.
     *
     * ⚠️ UNA SOLA VEZ POR CLASE. Si ya hay un `.roto` de antes, el material es así y
     *    volver a bajarlo es gastar la descarga para llegar al mismo lugar. El límite no
     *    es una preferencia: sin él, esto es un lazo de descargas infinito.
     */
    const roto = `${src}.roto`;
    if (/Invalid data|Error submitting packet|corrupt|moov atom/i.test(`${e.stderr ?? ''}${e.message}`) && !existsSync(roto)) {
      try {
        renameSync(src, roto);
        console.error(`     ↳ el VIDEO de origen está roto: lo aparté como .roto para que se vuelva a bajar.`);
      } catch { /* si no se puede renombrar, queda como estaba: se reintenta y se reporta */ }
    } else if (existsSync(roto)) {
      console.error(`     ↳ ya se rebajó una vez y volvió igual: el material de origen es así.`);
    }
  }
}

console.log(`\n  ${hechos} convertido(s)${partidos ? ` (${partidos} partido/s)` : ''} · ${saltados} ya estaban · ${fallados} fallado(s)${mudos ? ` · ${mudos} sin pista de audio` : ''}`);
console.log(`  Salida: ${A}\n`);
if (fallados) console.log('  Los fallados se pueden reintentar: los que salieron bien se saltean solos.\n');
if (mudos) console.log(`  Los ${mudos} mudos NO se reintentan: no tienen audio y nunca lo van a tener.\n`);
// ⚠️ Los mudos NO cuentan para el código de salida. Son material sin audio, no un fallo
// que se pueda reintentar: si contaran, un curso con una placa muda saldría con 1 para
// siempre y el circuito de la corrida lo leería como «la etapa no corrió».
process.exit(fallados && !hechos ? 1 : 0);
