// =============================================================================
// Genera lib/editor-landing/metricas-fuentes.ts: la letra de respaldo con las medidas de cada fuente del catálogo
// =============================================================================
// La publicada sirve su fuente desde su propio dominio y no espera a que llegue (`font-display: swap`): mientras
// tanto se ve una letra del sistema. Para que el cambio casi no se note, esa letra se agranda o se achica
// (`size-adjust`) y se le corrigen el alto y la bajada (`ascent-override`, `descent-override`, `line-gap-override`)
// hasta ocupar lo mismo que la fuente de verdad. Es la misma cuenta que hace `next/font` (font-utils.js,
// `calculateSizeAdjustValues`) con la misma tabla de medidas que trae Next (capsize-font-metrics.json, 4,3 MB):
// acá quedan SÓLO las familias que un tema puede usar (`FUENTES`, temas.ts), unas 100 líneas.
//
// Correr (cuando se suma una familia a FUENTES; el test lo pide):
//   node --import tsx scripts/generar-metricas-fuentes.mts
// =============================================================================
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FUENTES } from '../lib/editor-landing/temas';

type Medidas = { familyName: string; category: string; ascent: number; descent: number; lineGap: number; unitsPerEm: number; xWidthAvg: number };

const require = createRequire(join(process.cwd(), 'package.json'));
const tabla = require('next/dist/server/capsize-font-metrics.json') as Record<string, Medidas>;
const porNombre = new Map(Object.values(tabla).map((m) => [m.familyName, m]));
const ARIAL = porNombre.get('Arial')!;
const TIMES = porNombre.get('Times New Roman')!;

// Como `formatOverrideValue` de Next: en porcentaje, sin signo, con dos decimales.
const pct = (v: number) => Number(Math.abs(v * 100).toFixed(2));

const filas: string[] = [];
const faltan: string[] = [];
for (const [familia, def] of Object.entries(FUENTES).sort(([a], [b]) => a.localeCompare(b))) {
  const m = porNombre.get(familia);
  if (!m || !m.unitsPerEm) { faltan.push(familia); continue; }
  // Next usa Times New Roman sólo para las serif; para todo lo demás, Arial.
  const serif = def.tipo === 'serif' || m.category === 'serif';
  const base = serif ? TIMES : ARIAL;
  const ajuste = m.xWidthAvg ? (m.xWidthAvg / m.unitsPerEm) / (base.xWidthAvg / base.unitsPerEm) : 1;
  const em = m.unitsPerEm * ajuste;
  filas.push(`  ${JSON.stringify(familia)}: [${JSON.stringify(serif ? 'serif' : 'sans')}, ${pct(ajuste)}, ${pct(m.ascent / em)}, ${pct(m.descent / em)}, ${pct(m.lineGap / em)}],`);
}

const salida = `// =============================================================================
// GENERADO por scripts/generar-metricas-fuentes.mts — no se edita a mano
// =============================================================================
// Por familia del catálogo (FUENTES, temas.ts): [letra de respaldo, size-adjust %, ascent-override %,
// descent-override %, line-gap-override %]. Sale de las medidas que trae Next (capsize-font-metrics.json) con la
// cuenta de next/font. Lo usa fuentes-propias.ts para la letra que se ve mientras llega la de verdad.
${faltan.length ? `// Sin medidas en la tabla de Next (van sin respaldo ajustado): ${faltan.join(', ')}.\n` : ''}// =============================================================================

export type MedidasRespaldo = readonly [respaldo: 'sans' | 'serif', tamano: number, alto: number, bajada: number, interlinea: number];

export const METRICAS_FUENTES: Readonly<Record<string, MedidasRespaldo>> = {
${filas.join('\n')}
};

/** Las familias de FUENTES que la tabla de Next no tiene: el test las conoce para no pedirlas. */
export const SIN_MEDIDAS: readonly string[] = ${JSON.stringify(faltan)};
`;
writeFileSync(join(process.cwd(), 'lib/editor-landing/metricas-fuentes.ts'), salida);
console.log(`${filas.length} familias con medidas${faltan.length ? `; sin medidas: ${faltan.join(', ')}` : ''}`);
