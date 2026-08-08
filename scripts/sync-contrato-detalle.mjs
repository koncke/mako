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
const FUENTE_PROY = 'lib/plan-proyectos-catalogo.ts';
const FUENTE_PREG = 'lib/preguntas-contrato.ts';
const DESTINOS = ['.claude/skills/plan-tareas/SKILL.md'];

const marca = (nombre) => [
  `<!-- ${nombre}:INICIO — generado por scripts/sync-contrato-detalle.mjs, NO editar a mano -->`,
  `<!-- ${nombre}:FIN -->`,
];
const [INICIO, FIN] = marca('CONTRATO-DETALLE');
const [P_INICIO, P_FIN] = marca('REGLA-NOMBRE-PROYECTO');
const [Q_INICIO, Q_FIN] = marca('CONTRATO-PREGUNTAS');

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

/** La regla del nombre de un proyecto, del catálogo. Mismo motivo que el molde: si se
 *  copia a mano al .md, la copia se queda vieja y desde ese camino sale mal. */
function leerReglaProyecto() {
  const src = readFileSync(FUENTE_PROY, 'utf8');
  const mPref = src.match(/export const PREFIJO_FEATURE = '([^']*)';/);
  const mRegla = src.match(/export const REGLA_NOMBRE_PROYECTO = `([\s\S]*?)`;/);
  if (!mPref || !mRegla) throw new Error(`No pude leer PREFIJO_FEATURE/REGLA_NOMBRE_PROYECTO de ${FUENTE_PROY}`);
  // La regla es un template literal con ${PREFIJO_FEATURE} adentro: se resuelve acá.
  return mRegla[1]
    .replace(/\$\{PREFIJO_FEATURE\.trim\(\)\}/g, mPref[1].trim())
    .replace(/\$\{PREFIJO_FEATURE\}/g, mPref[1]);
}

const bloqueProy = [
  P_INICIO,
  '',
  '**Cómo se llama un proyecto nuevo.** Vive en `lib/plan-proyectos-catalogo.ts` y se copia',
  'acá sola: si cambia allá, cambia acá. No la edites a mano.',
  '',
  ...leerReglaProyecto().split('\n').map((l) => (l.trim() ? `> ${l}` : '>')),
  '',
  P_FIN,
].join('\n');

/** El catálogo de tipos de pregunta del Perro. Mismo motivo que los otros dos: la skill
 *  lo tenía copiado a mano y se quedó vieja — decía que existía `escala` pero no `fecha`,
 *  o sea que desde Claude Code se seguían pidiendo deadlines con una escala del 1 al 5. */
function leerContratoPreguntas() {
  const src = readFileSync(FUENTE_PREG, 'utf8');
  const m = src.match(/export const CONTRATO_TIPOS_PREGUNTA = `([\s\S]*?)`;/);
  if (!m) throw new Error(`No pude leer CONTRATO_TIPOS_PREGUNTA de ${FUENTE_PREG}`);
  return m[1];
}

const bloquePreg = [
  Q_INICIO,
  '',
  '**Los tipos de pregunta y su campo.** Vive en `lib/preguntas-contrato.ts` y se copia acá',
  'sola: si cambia allá, cambia acá. No la edites a mano.',
  '',
  ...leerContratoPreguntas().split('\n').map((l) => (l.trim() ? `> ${l}` : '>')),
  '',
  Q_FIN,
].join('\n');

/** Reemplaza lo que hay entre dos marcadores. Devuelve null si faltan. */
const entre = (txt, ini, fin, bloque) => {
  const i = txt.indexOf(ini);
  const j = txt.indexOf(fin);
  if (i < 0 || j < 0) return null;
  return txt.slice(0, i) + bloque + txt.slice(j + fin.length);
};

// Los bloques que se copian. Agregar uno es sumar una fila acá, no otro `if` encadenado.
const BLOQUES = [
  { nombre: 'CONTRATO-DETALLE', ini: INICIO, fin: FIN, texto: bloque },
  { nombre: 'REGLA-NOMBRE-PROYECTO', ini: P_INICIO, fin: P_FIN, texto: bloqueProy },
  { nombre: 'CONTRATO-PREGUNTAS', ini: Q_INICIO, fin: Q_FIN, texto: bloquePreg },
];

let sucio = 0;
for (const d of DESTINOS) {
  if (!existsSync(d)) { console.warn(`  · ${d} no existe, salteado`); continue; }
  const txt = readFileSync(d, 'utf8');
  let nuevo = txt;
  let faltan = false;
  for (const b of BLOQUES) {
    const paso = entre(nuevo, b.ini, b.fin, b.texto);
    if (paso === null) {
      console.error(`  ✗ ${d}: faltan los marcadores ${b.nombre}. Agregalos donde tenga que ir ese bloque.`);
      faltan = true;
      break;
    }
    nuevo = paso;
  }
  if (faltan) { sucio++; continue; }
  if (nuevo === txt) { console.log(`  ✓ ${d} al día`); continue; }
  if (CHECK) { console.error(`  ✗ ${d} DESINCRONIZADO — corré: node scripts/sync-contrato-detalle.mjs`); sucio++; continue; }
  writeFileSync(d, nuevo);
  console.log(`  ↻ ${d} actualizado`);
}

if (sucio) process.exit(1);
