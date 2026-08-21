// =============================================================================
// Audio de clase -> markdown para LEER y CURAR. Reusa lib/transcribe.
// Uso: npx tsx scripts/curso-transcribir.ts [--de C:\cursos\audio] [--a C:\cursos\texto]
// Requiere .env.local con OPENAI_API_KEY.
//
// IMPORTANTE — esto NO escribe en la base ni en mako_knowledge, a proposito.
// El RAG de MaKo recibe la version CURADA por el dueño (sus apuntes, sus
// razonamientos, sus conclusiones), no el transcript crudo de un curso ajeno.
// Ese paso final es a mano, por la puerta que ya existe: /conocimiento ->
// app/api/mako/knowledge. Aca solo se produce el material para leer.
//
// Reanudable: si el .md ya existe, no se vuelve a gastar la llamada a whisper.
// Las piezas 'nombre.parteNN.m4a' que dejo curso-audio.mjs se unen en un solo .md.
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { transcribeMediaBuffer } from '../lib/transcribe';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const DE = arg('de', 'C:\\cursos\\audio');
const A = arg('a', 'C:\\cursos\\texto');
const HINT = arg('hint', ''); // sesga ortografía de términos propios del curso

// ffmpeg NO está en el PATH de esta máquina; misma ruta que usa curso-audio.mjs.
const FFMPEG = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe'));

const MIMES: Record<string, string> = {
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.webm': 'audio/webm', '.flac': 'audio/flac', '.mp4': 'audio/mp4',
};

const mb = (b: number) => (b / 1048576).toFixed(1);

// ── ¿ESTE AUDIO TIENE ALGO ADENTRO? ─────────────────────────────────────────
//
// ⚠️ UN AUDIO MUDO NO DEVUELVE VACÍO: DEVUELVE UNA INVENCIÓN. Dos clases de «Master
// Marca Personal» tienen el video SIN pista de sonido (−91 dB, el piso digital). Sobre
// ese silencio, Whisper devolvió «Thank you.» —su alucinación clásica— y Gemini se
// inventó un noticiero entero: «Bienvenidos a una edición más de Noticias de Bolsillo,
// yo soy Javier Pérez y hoy hablaremos sobre las energías renovables». Una clase sobre
// Calendly. Y eso se publicó, redactado impecable, sin que nada fallara.
//
// Es la peor forma del problema que este pipeline viene cerrando todo el día: no es una
// transcripción incompleta, es una COMPLETAMENTE FALSA, y se lee mejor que las buenas.
//
// La guarda va ANTES de gastar la llamada, y el criterio es el BITRATE EFECTIVO: el
// audio se genera a 32 kbps, así que un archivo que no llega ni a un cuarto de eso no
// tiene voz. Medido sobre las 92 clases del curso: las reales dan entre 29,9 y 33,3
// kbps y las dos mudas 1,0 y 2,1 — un factor de 14 entre las dos poblaciones, así que
// el umbral tiene todo el aire del mundo.
const KBPS_MINIMO = Number(arg('kbps-minimo', '8'));
const duracionSeg = (ruta: string): number | null => {
  const p = spawnSync(FFMPEG, ['-i', ruta], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(`${p.stderr}`);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100 : null;
};
/** kbps efectivos, o null si no se puede medir (y entonces no se afirma nada). */
const kbpsDe = (ruta: string): number | null => {
  const d = duracionSeg(ruta);
  if (!d || d < 3) return null;   // un archivo de 2 segundos no dice nada del contenido
  return (statSync(ruta).size * 8) / d / 1000;
};
const hhmm = (s: number | null) => (s == null ? '?' : `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`);

if (!existsSync(DE)) { console.error(`\n  ✖ No existe ${DE}. Corré antes: node scripts/curso-audio.mjs\n`); process.exit(1); }
mkdirSync(A, { recursive: true });

// ⚠️ Todo el cuerpo va dentro de main(): tsx compila estos scripts a CJS y un
// `await` de nivel superior explota con «Top-level await is currently not
// supported with the "cjs" output format». Es el mismo patrón de
// scripts/backfill-transcripts.ts, y el error aparece en tiempo de TRANSFORM,
// así que el typecheck pasa en verde y falla recién al ejecutar.
async function main() {

// Agrupar: 'clase-3.parte00.m4a' y 'clase-3.parte01.m4a' son UNA clase.
const grupos = new Map<string, string[]>();
for (const f of readdirSync(DE).sort()) {
  if (!MIMES[extname(f).toLowerCase()]) continue;
  const m = /^(.*)\.parte\d+$/.exec(basename(f, extname(f)));
  const clave = m ? m[1] : basename(f, extname(f));
  grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
}

if (!grupos.size) { console.error(`\n  ✖ No hay audio en ${DE}\n`); process.exit(1); }

console.log(`\n  ${grupos.size} clase(s) para transcribir · salida en ${A}\n`);

let hechas = 0, saltadas = 0, fallidas = 0, mudas = 0;
const indice: string[] = [];

for (const [clave, piezas] of [...grupos].sort()) {
  const dest = join(A, `${clave}.md`);
  if (existsSync(dest)) {
    // ⚠️ «EXISTE» NO ES «ESTÁ AL DÍA». Si el audio se rehizo —porque el anterior estaba
    // cortado, que es justo lo que `curso-audio.mjs` ahora detecta— la transcripción
    // vieja sigue en disco y este salteo la deja ahí para siempre. Pasó con «Creator
    // Club»: 50 audios corregidos y 50 transcripciones de media clase publicadas, sin
    // una línea que lo dijera.
    //
    // La misma regla que el audio contra el video: un derivado se compara con SU FUENTE.
    // Acá la vara es la fecha, que es lo que hay cuando el contenido no se puede comparar.
    const tDest = statSync(dest).mtimeMs;
    const tFuente = Math.max(...piezas.map((f) => statSync(join(DE, f)).mtimeMs));
    if (tDest >= tFuente) {
      console.log(`  = ${clave}  (ya estaba)`);
      saltadas++;
      indice.push(`- [${clave}](${clave}.md)`);
      continue;
    }
    console.log(`  ↻ ${clave}  (el audio es más nuevo que la transcripción — la rehago)`);
  }

  // ⚠️ LOS APUNTES SON EL ÚNICO DATO DE ESTE ARCHIVO QUE NO ES DERIVADO, Y NO TIENEN
  // BACKUP: viven en C:\cursos, fuera del repo y fuera de git. La transcripción se
  // puede volver a pedir; lo que escribió una persona, no.
  //
  // Hasta hoy el salteo era incondicional y este camino no existía. Al agregar el
  // rehacer-por-fecha de acá arriba —que es correcto y hace falta— se abrió la puerta a
  // pisarlos, y encima en TANDA: cada audio que `completo()` detecte cortado deja su
  // .md por rehacer. Medido antes de que pasara: 0 de 1.649 .md tienen apuntes, así que
  // no se perdió ninguno. La trampa quedaba armada para el primero que se escribiera.
  const apuntesPrevios = (() => {
    if (!existsSync(dest)) return '';
    try {
      const s = readFileSync(dest, 'utf8');
      const a = s.indexOf('## Apuntes');
      const t = s.indexOf('## Transcripción');
      if (a < 0) return '';
      return s.slice(a + '## Apuntes'.length, t > a ? t : undefined).trim();
    } catch { return ''; }
  })();
  if (apuntesPrevios) console.log(`     (conservo tus ${apuntesPrevios.length} caracteres de apuntes)`);

  // El audio mudo se descarta ANTES de gastar la llamada: ver la nota de kbpsDe.
  const kbps = piezas.length === 1 ? kbpsDe(join(DE, piezas[0])) : null;
  if (kbps !== null && kbps < KBPS_MINIMO) {
    console.log(`  ⊘ ${clave}  (${kbps.toFixed(1)} kbps: el audio es SILENCIO, el video no trae pista de sonido — no lo mando a transcribir)`);
    mudas++;
    continue;
  }

  const partes: string[] = [];
  let segundos = 0;
  let idioma: string | null = null;
  let fallo: string | null = null;
  // Qué proveedor escuchó de verdad. Se escribe en la cabecera del .md: un fallback
  // que no se anota en ningún lado es una degradación silenciosa (ver STT_CASCADA).
  const modelos = new Set<string>();

  for (const [i, f] of piezas.entries()) {
    const ruta = join(DE, f);
    const bytes = readFileSync(ruta);
    const etiqueta = piezas.length > 1 ? `${clave} [${i + 1}/${piezas.length}]` : clave;
    process.stdout.write(`  · ${etiqueta} (${mb(statSync(ruta).size)} MB) … `);

    const r = await transcribeMediaBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      MIMES[extname(f).toLowerCase()],
      f,
      HINT || undefined,
    );

    if (r.status !== 'ok' || !r.transcript) {
      // 'muy_grande' acá significa que curso-audio.mjs no bajó lo suficiente:
      // rebajar el bitrate (--kbps 24) o el objetivo (--mb 12) y repetir.
      fallo = `${r.status}: ${r.error ?? 'sin texto'}`;
      console.log(`✖ ${fallo}`);
      break;
    }
    partes.push(r.transcript.trim());
    segundos += r.duracion_s ?? 0;
    idioma ??= r.idioma;
    if (r.model) modelos.add(r.model);
    console.log(`✓ ${hhmm(r.duracion_s)}${r.model && r.model !== 'whisper-1' ? `  (${r.model})` : ''}`);
  }

  if (fallo) {
    // No se escribe un .md parcial: un archivo a medias se saltearía en la
    // próxima corrida y quedaría incompleto para siempre sin ninguna señal.
    fallidas++;
    continue;
  }

  const cabecera = [
    `# ${clave}`,
    '',
    `> ${hhmm(segundos)}${idioma ? ` · ${idioma}` : ''}${piezas.length > 1 ? ` · ${piezas.length} partes` : ''} · transcripción automática (${modelos.size ? [...modelos].join(' + ') : 'desconocido'}), sin corregir.`,
    '>',
    '> Tus apuntes van acá arriba. Lo de abajo es materia prima para leer, no para',
    '> mandar al RAG tal cual.',
    '',
    '## Apuntes',
    '',
    apuntesPrevios,          // ⚠️ lo escrito a mano NO se regenera: ver la nota de arriba
    '',
    '## Transcripción',
    '',
  ].join('\n');

  writeFileSync(dest, cabecera + partes.join('\n\n---\n\n') + '\n', 'utf8');
  console.log(`  ✓ ${clave}  →  ${basename(dest)}`);
  hechas++;
  indice.push(`- [${clave}](${clave}.md)`);
}

writeFileSync(join(A, '_indice.md'), `# Clases transcriptas\n\n${indice.join('\n')}\n`, 'utf8');

console.log(`
  ${hechas} transcripta(s) · ${saltadas} ya estaban · ${fallidas} fallada(s)${mudas ? ` · ${mudas} MUDA(S)` : ''}`);
if (mudas) console.log(`  ⊘ ${mudas} clase(s) tienen el video SIN pista de audio. NO se les inventa una transcripción.`);
console.log(`  Índice: ${join(A, '_indice.md')}\n`);
if (fallidas) console.log('  Las falladas se reintentan solas al volver a correr (no dejaron .md).\n');
console.log('  Cuando tengas tu versión curada, entra por /conocimiento — esa puerta ya\n  existe y es la única que escribe en mako_knowledge.\n');
process.exit(fallidas && !hechas ? 1 : 0);

}

main().catch((e) => { console.error(`\n  ✖ ${e instanceof Error ? e.message : String(e)}\n`); process.exit(1); });
