#!/usr/bin/env node
// =============================================================================
// modulos-ts.mjs — todo .ts/.tsx/.mts del repo tiene que ser un MÓDULO (tener import o export)
// =============================================================================
// POR QUE EXISTE: los runs 51 y 52 de Actions (16/10/2026) fallaron en «Tipos» con
//   tests/_cobros-conexion-hijo.ts: error TS2300: Duplicate identifier 'Fila'.
//   error TS2451: Cannot redeclare block-scoped variable 'db'.
// El archivo del error NO había cambiado. Lo que cambió fueron otros hijos de tests
// (`_fathom-carga-hijo.ts`, `_plan-kanban-hijo.ts`) que no tenían ni un `import` ni un `export`:
// para TypeScript un archivo así no es un módulo sino un SCRIPT, y todos los scripts comparten el
// ámbito global — dos que declaran `type Fila` o `const db` chocan, y el rojo cae en el que no
// tocaste. Un tsc acotado de lo que cambió no lo ve (compila cada archivo SOLO): por eso es una
// guarda aparte, barata (un regex sobre los archivos), que corre en el pre-push, en Actions y en
// scripts/antes-de-subir.mjs. Cura: `export {};` arriba de todo.
//
// Uso: node scripts/modulos-ts.mjs        (todo el repo, de git ls-files)  ·  exit 1 si hay alguno
// =============================================================================

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sinComentarios } from './tests-afectados.mjs';

/** Scripts que ya eran globales cuando se escribió la guarda (17/10/2026) y no chocan con nadie. Si lo editás, sumale `export {};` y sacalo de acá. */
export const EXCEPCIONES = new Set(['scripts/ai-step-v2.mts']);

const ES_TS = /\.(?:ts|tsx|mts)$/;

/** De `archivos`, los que el tsc toma como script global: sin ningún `import`/`export` a nivel de archivo. */
export function sinModulo(archivos, leer) {
  const malos = [];
  for (const f of archivos) {
    if (!ES_TS.test(f) || f.endsWith('.d.ts') || EXCEPCIONES.has(f)) continue;
    const src = leer(f);
    if (src == null) continue;
    if (!/^\s*(?:import|export)\b/m.test(sinComentarios(src))) malos.push(f);
  }
  return malos.sort();
}

export const MENSAJE = (malos) => [
  `  ✖ ${malos.length} archivo(s) .ts SIN import ni export — para TypeScript son scripts GLOBALES y chocan entre sí (TS2300/TS2451):`,
  ...malos.map((f) => `      ${f}`),
  '    Agregá `export {};` arriba de cada uno (runs 51 y 52 de Actions: el rojo cae en OTRO archivo, el que no tocaste).',
].join('\n');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  const malos = sinModulo(archivos, (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } });
  if (malos.length) { process.stderr.write(MENSAJE(malos) + '\n'); process.exit(1); }
  process.stdout.write(`[modulos-ts] ✓ todos los .ts son módulos (${archivos.filter((f) => ES_TS.test(f)).length} archivos)\n`);
}
