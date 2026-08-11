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
import { transcribeMediaBuffer } from '../lib/transcribe';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const DE = arg('de', 'C:\\cursos\\audio');
const A = arg('a', 'C:\\cursos\\texto');
const HINT = arg('hint', ''); // sesga ortografía de términos propios del curso

const MIMES: Record<string, string> = {
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.webm': 'audio/webm', '.flac': 'audio/flac', '.mp4': 'audio/mp4',
};

const mb = (b: number) => (b / 1048576).toFixed(1);
const hhmm = (s: number | null) => (s == null ? '?' : `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`);

if (!existsSync(DE)) { console.error(`\n  ✖ No existe ${DE}. Corré antes: node scripts/curso-audio.mjs\n`); process.exit(1); }
mkdirSync(A, { recursive: true });

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

let hechas = 0, saltadas = 0, fallidas = 0;
const indice: string[] = [];

for (const [clave, piezas] of [...grupos].sort()) {
  const dest = join(A, `${clave}.md`);
  if (existsSync(dest)) {
    console.log(`  = ${clave}  (ya estaba)`);
    saltadas++;
    indice.push(`- [${clave}](${clave}.md)`);
    continue;
  }

  const partes: string[] = [];
  let segundos = 0;
  let idioma: string | null = null;
  let fallo: string | null = null;

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
    console.log(`✓ ${hhmm(r.duracion_s)}`);
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
    `> ${hhmm(segundos)}${idioma ? ` · ${idioma}` : ''}${piezas.length > 1 ? ` · ${piezas.length} partes` : ''} · transcripción automática (whisper-1), sin corregir.`,
    '>',
    '> Tus apuntes van acá arriba. Lo de abajo es materia prima para leer, no para',
    '> mandar al RAG tal cual.',
    '',
    '## Apuntes',
    '',
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

console.log(`\n  ${hechas} transcripta(s) · ${saltadas} ya estaban · ${fallidas} fallada(s)`);
console.log(`  Índice: ${join(A, '_indice.md')}\n`);
if (fallidas) console.log('  Las falladas se reintentan solas al volver a correr (no dejaron .md).\n');
console.log('  Cuando tengas tu versión curada, entra por /conocimiento — esa puerta ya\n  existe y es la única que escribe en mako_knowledge.\n');
process.exit(fallidas && !hechas ? 1 : 0);
