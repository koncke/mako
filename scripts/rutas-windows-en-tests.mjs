#!/usr/bin/env node
// =============================================================================
// rutas-windows-en-tests.mjs — un test no fija una ruta de Windows como dato
// =============================================================================
// POR QUÉ (16/10/2026): los tests corren también en Linux (GitHub Actions). Un
// test que fijaba `REPO = 'C:\\repo\\dashboard-marketing'` y lo pasaba por
// `resolve` dio verde en la notebook y 2 rojos en Linux, donde `C:\…` es una ruta
// RELATIVA y `resolve` le pega delante el cwd del runner: tiró el run 38845971505.
// Es la trampa de `.pathname.replace(/^\//, '')` del 15/10, del lado de los datos.
//
// Busca literales `'C:\…'`, `"C:/…"`, `` `C:\…` `` en tests/ fuera de los
// comentarios. Un literal así es legítimo cuando es un DATO para un parser (un
// nombre de archivo que manda el navegador, un texto que se redacta) y no una ruta
// que se resuelve: esos van en PERMITIDOS con su motivo. Lo que no está ahí, frena.
//
// Corre en las guardas baratas del push (scripts/guardas-push.sh): ~1 s, sin tsx.
// =============================================================================

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Archivos con literales de Windows A PROPÓSITO, con el porqué. */
export const PERMITIDOS = new Map([
  ['tests/agente-plugin.test.ts', 'texto que el plugin redacta: la ruta es contenido, no se abre'],
  ['tests/curso-adjuntos.test.ts', 'el nombre que manda el navegador (C:\\docs\\…): se limpia, no se abre'],
  ['tests/curso-grabar-notas.test.ts', 'el nombre que manda el navegador (C:\\fakepath\\…): se limpia, no se abre'],
  ['tests/vista-adjuntos.test.ts', 'la extensión de un nombre de archivo: se parsea, no se abre'],
  ['tests/decisiones-aviso.test.ts', 'el cwd de una sesión de Claude Code, como lo guarda la ficha: se compara como texto'],
  ['tests/operaciones.test.ts', 'el cwd de una sesión de Claude Code, como lo guarda la ficha: se compara como texto'],
  ['tests/cartero-carpetas.test.ts', 'el cwd de una sesión de Claude Code y las carpetas del Runner: enCwds los compara como texto, no se abren'],
  ['tests/centro-uso.test.ts', 'el cwd de una sesión de Claude Code y las carpetas del Runner: enCwds los compara como texto, no se abren'],
  ['tests/centro-turnos.test.ts', 'el cwd de una sesión de Claude Code: enCwds lo compara como texto y carpetaDelCwd arma con él el nombre de la carpeta del transcript, no se abre'],
  ['tests/centro-adjuntos.test.ts', 'el cwd de una sesión de Claude Code y las carpetas del Runner: enCwds los compara como texto, no se abren'],
  ['tests/rutas-windows-en-tests.test.ts', 'los casos de esta misma guarda: son el texto que tiene que cazar'],
]);

// Después de `X:` va `/`, `\\` (la barra escapada de un string común) o UNA barra seguida de un
// carácter de ruta (String.raw o template). Una barra seguida de comilla es un escape, no una ruta:
// `` `… \`m:\` …` `` daba falso positivo en instagram-buscar.test.ts.
const LITERAL = /['"`][A-Za-z]:(?:\/|\\\\|\\[\w .-])/;

/** Saca los comentarios: las líneas `//` PRIMERO y los bloques después (AGENTS.md). */
export function sinComentarios(fuente) {
  return fuente
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));   // conserva los números de línea
}

/** Números de línea (desde 1) con un literal de ruta Windows fuera de comentarios. */
export function lineasConRutaWindows(fuente) {
  return sinComentarios(fuente).split('\n')
    .map((l, i) => (LITERAL.test(l) ? i + 1 : 0))
    .filter(Boolean);
}

function main() {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const archivos = execFileSync('git', ['ls-files', 'tests'], { cwd: repo, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f));
  const malos = [];
  for (const f of archivos) {
    if (PERMITIDOS.has(f)) continue;
    let fuente;
    try { fuente = readFileSync(join(repo, f), 'utf8'); } catch { continue; }   // borrado en el árbol
    for (const n of lineasConRutaWindows(fuente)) malos.push(`${f}:${n}`);
  }
  if (!malos.length) process.exit(0);
  process.stdout.write(`${malos.map((m) => `    ${m}`).join('\n')}\n\n` +
    '  Un test que fija una ruta de Windows (C:\\…) la ve RELATIVA en Linux (GitHub Actions):\n' +
    "  `resolve` le pega el cwd del runner. Usá resolve('/repo/x'), join(tmpdir(), …) o\n" +
    '  fileURLToPath(new URL(…, import.meta.url)). Si es un DATO que no se resuelve (un\n' +
    '  nombre de archivo, un texto), sumalo a PERMITIDOS en scripts/rutas-windows-en-tests.mjs\n' +
    '  con su motivo.\n');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
