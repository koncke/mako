// =============================================================================
// sync-puede-filmar — el juicio único, también en la extensión
// =============================================================================
// `lib/flow-puede-filmar.ts` decide si el puente puede filmar. De ese booleano
// cuelgan CUATRO compuertas duras —el botón de la web, la cola de la extensión, el
// reparto del server y el guard de filmar server-side—, así que dos versiones
// distintas de este archivo no es un desfase cosmético: es que la mitad del sistema
// diga que sí y la otra mitad que no, que es exactamente el bug que este módulo
// vino a cerrar.
//
// Misma solución y misma guarda que los otros tres: se GENERA, y el pre-push falla
// si quedó viejo.
//
//   node --import tsx scripts/sync-puede-filmar.mjs            → escribe
//   node --import tsx scripts/sync-puede-filmar.mjs --check    → falla si quedó viejo
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const FUENTE = 'lib/flow-puede-filmar.ts';
const DESTINO = 'extension/puede-filmar.js';

/** Ver la nota de CRLF en sync-operaciones.mjs: se normaliza para DECIDIR. */
const sinCR = (s) => s.replace(/\r\n/g, '\n');

/**
 * El `.ts` sin los tipos.
 *
 * ⚠️ No es un transpilador: es un borrado de anotaciones sobre un archivo escrito a
 * propósito para poder copiarse. El borrado de los `type` es POR LÍNEAS —la unión
 * tiene punto y coma adentro de cada miembro, así que un `[\s\S]*?;` cortaría por la
 * mitad— y las firmas se reemplazan una por una, con guarda al final.
 */
function sinTipos(ts) {
  const lineas = sinCR(ts).split('\n');
  const out = [];
  let enTipo = false;
  let llaves = 0;
  for (const l of lineas) {
    if (!enTipo && /^export type \w+ =/.test(l)) { enTipo = true; llaves = 0; }
    if (enTipo) {
      // ⚠️ SE CUENTAN LAS LLAVES, y esto ya falló: cortar en la primera línea que
      // termina en `;` deja medio tipo adentro del JS, porque los campos de un
      // objeto (`op?: string | null;`) terminan en `;` cada uno. El tipo cierra
      // cuando las llaves vuelven a cero Y la línea termina en `;`.
      for (const c of l) { if (c === '{') llaves++; else if (c === '}') llaves--; }
      if (llaves <= 0 && l.trimEnd().endsWith(';')) enTipo = false;
      continue;
    }
    out.push(l);
  }
  return out.join('\n')
    // ⚠️ El import cambia de vecino: en `lib/` es un módulo TS hermano; en la
    // extensión es el archivo generado por sync-boq-patch, con su `.js` explícito
    // (los módulos del service worker no resuelven extensiones).
    .replace("import { comoViajo } from './flow-boq-patch';", "import { comoViajo } from './boq-patch.js';")
    .replace('function tieneAt(cuerpo: string): boolean {', 'function tieneAt(cuerpo) {')
    .replace(
      'export function elegirPlantilla(\n'
      + '  plantillas: Record<string, PlantillaGuardada | null | undefined>,\n'
      + '  cat: OperacionMinima,\n'
      + '): { clase: string; pl: PlantillaGuardada; porQue: string } {',
      'export function elegirPlantilla(plantillas, cat) {',
    )
    .replace(
      'export function ensayarOperacion(\n'
      + '  plantillas: Record<string, PlantillaGuardada | null | undefined>,\n'
      + '  cat: OperacionMinima,\n'
      + '): Ensayo {',
      'export function ensayarOperacion(plantillas, cat) {',
    )
    .replace('  const orden = [...candidatas].sort((a, b) => Number(b[1]!.cuando || 0) - Number(a[1]!.cuando || 0));',
      '  const orden = [...candidatas].sort((a, b) => Number(b[1].cuando || 0) - Number(a[1].cuando || 0));')
    .replace('    const pl = p as PlantillaGuardada;', '    const pl = p;')
    .replace(
      'export function puedeFilmar(\n'
      + '  plantillas: Record<string, PlantillaGuardada | null | undefined>,\n'
      + '  necesarias: readonly OperacionMinima[],\n'
      + '): Ensayo {',
      'export function puedeFilmar(plantillas, necesarias) {',
    )
    .replace('  const pl = hallada[1] as PlantillaGuardada;', '  const pl = hallada[1];');
}

const js = sinTipos(readFileSync(FUENTE, 'utf8'));

// ⚠️ LA GUARDA DEL BORRADO. Si quedó una anotación, el `.js` no parsea y el service
// worker muere ENTERO al importarlo — o sea que el puente se apaga por un archivo
// que ni siquiera es el que falla. Mejor romper acá, con el nombre a la vista.
for (const sospecha of [': string', ': Ensayo', ': readonly', 'export type', ' as ']) {
  if (js.includes(sospecha)) {
    console.error(`\n  X Quedó «${sospecha}» en el JS generado desde ${FUENTE}.`);
    console.error('    El borrado de tipos es literal: si una firma cambió, cambiá su reemplazo.\n');
    process.exit(1);
  }
}
if (!js.includes("from './boq-patch.js'")) {
  console.error(`\n  X El import de comoViajo no se reescribió a './boq-patch.js'.\n`);
  process.exit(1);
}

const cuerpo = `// =============================================================================
// GENERADO por scripts/sync-puede-filmar.mjs desde ${FUENTE} — NO EDITAR A MANO
// =============================================================================
// El pre-push falla si quedó viejo. De este juicio cuelgan CUATRO compuertas duras:
// el botón de la web, la cola de la extensión, el reparto del server y el guard de
// filmar. Dos versiones distintas es media app diciendo que sí y media que no.
// =============================================================================

${js.replace(/^\/\/ =+\n(\/\/.*\n)*\/\/ =+\n/, '').trimStart()}`;

if (CHECK) {
  if (!existsSync(DESTINO)) {
    console.error(`\n  X ${DESTINO} no existe. Corré: node --import tsx scripts/sync-puede-filmar.mjs\n`);
    process.exit(1);
  }
  if (sinCR(readFileSync(DESTINO, 'utf8')) !== sinCR(cuerpo)) {
    console.error(`\n  X ${DESTINO} quedó viejo respecto de ${FUENTE}.`);
    console.error('    Decide si el puente puede filmar: la versión que corre tiene que ser');
    console.error('    la que se probó.\n');
    console.error('    Corré: node --import tsx scripts/sync-puede-filmar.mjs\n');
    process.exit(1);
  }
  console.log(`  ✓ ${DESTINO} al día`);
  process.exit(0);
}

writeFileSync(DESTINO, cuerpo);
console.log(`✅ ${DESTINO}`);
