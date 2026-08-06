// =============================================================================
// sync-contrato-detalle — que el contrato viva en UN lugar, también para los .md
// =============================================================================
// El contrato del `detalle` vive en lib/detalle-contrato.ts y todos los caminos de
// código lo importan. Pero las skills son archivos .md: no pueden importar nada, así
// que hasta acá había que acordarse de actualizarlas a mano — y no se hizo. Eso fue
// exactamente lo que pasó: el contrato se actualizó en el camino de Claude Code y no
// en el de WhatsApp, y desde WhatsApp siguió saliendo mal.
//
// Este script copia el molde del módulo a los .md, entre marcadores. Corre en el
// pre-push junto al typecheck: si un .md quedó desincronizado, el push se frena.
//
//   node scripts/sync-contrato-detalle.mjs            → escribe
//   node scripts/sync-contrato-detalle.mjs --check    → falla si hay diferencia
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const FUENTE = 'lib/detalle-contrato.ts';
const DESTINOS = ['.claude/skills/plan-tareas/SKILL.md'];

const INICIO = '<!-- CONTRATO-DETALLE:INICIO — generado por scripts/sync-contrato-detalle.mjs, NO editar a mano -->';
const FIN = '<!-- CONTRATO-DETALLE:FIN -->';

/** Saca MOLDE_DETALLE y MOLDE_ADVERTENCIA del módulo sin importarlo (es TS + server-only). */
function leerFuente() {
  const src = readFileSync(FUENTE, 'utf8');
  const mMolde = src.match(/export const MOLDE_DETALLE = \[([\s\S]*?)\]\.join\(/);
  const mAdv = src.match(/export const MOLDE_ADVERTENCIA = '([\s\S]*?)';/);
  if (!mMolde || !mAdv) throw new Error(`No pude leer MOLDE_DETALLE/MOLDE_ADVERTENCIA de ${FUENTE}`);
  const molde = [...mMolde[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((m) => m[1].replace(/\\'/g, "'"))
    .join('\n');
  return { molde, advertencia: mAdv[1].replace(/\\'/g, "'") };
}

const { molde, advertencia } = leerFuente();
const bloque = [
  INICIO,
  '',
  'El `detalle` va con ESTA forma exacta. Vive en `lib/detalle-contrato.ts` y se copia acá',
  'sola: si cambia allá, cambia acá. No la edites a mano.',
  '',
  '```',
  molde,
  '```',
  '',
  advertencia,
  '',
  FIN,
].join('\n');

let sucio = 0;
for (const d of DESTINOS) {
  if (!existsSync(d)) { console.warn(`  · ${d} no existe, salteado`); continue; }
  const txt = readFileSync(d, 'utf8');
  const i = txt.indexOf(INICIO);
  const j = txt.indexOf(FIN);
  if (i < 0 || j < 0) {
    console.error(`  ✗ ${d}: faltan los marcadores CONTRATO-DETALLE. Agregalos donde tenga que ir el contrato.`);
    sucio++;
    continue;
  }
  const nuevo = txt.slice(0, i) + bloque + txt.slice(j + FIN.length);
  if (nuevo === txt) { console.log(`  ✓ ${d} al día`); continue; }
  if (CHECK) { console.error(`  ✗ ${d} DESINCRONIZADO — corré: node scripts/sync-contrato-detalle.mjs`); sucio++; continue; }
  writeFileSync(d, nuevo);
  console.log(`  ↻ ${d} actualizado`);
}

if (sucio) process.exit(1);
