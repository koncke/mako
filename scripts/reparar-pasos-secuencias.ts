// =============================================================================
// reparar-pasos-secuencias — `nutricion_secuencias.pasos` guardado como STRING
// =============================================================================
// SÍNTOMA: una secuencia que existe, se lista y tiene CERO mensajes adentro. No da
// error y no se puede activar para nada: el motor lee
// `Array.isArray(r.pasos) ? r.pasos : []` (lib/nutricion.ts:159 y :222), así que un
// `pasos` que es un string JSON vale lo mismo que un array vacío. Fail-safe —no manda
// nada— y mudo: desde la pantalla se lee como «esta secuencia no tiene mensajes».
//
// CAUSA: la misma capa de codificación de más que ya mordió en el store de
// /mensajes (`scripts/reparar-store-plantillas.ts`, 04/10/2026): pasarle el TEXTO
// de un `JSON.stringify` a una columna `jsonb` guarda un jsonb que CONTIENE un
// string con el JSON adentro. El driver `postgres` ya serializa para jsonb; va el
// OBJETO (`sql.json(obj)`), nunca el texto.
//
// MEDIDO EL 05/10/2026 contra producción: de 62 secuencias, **60 array y 2 string** —
// `recordatorio-r1` («Recordatorio de reunión — que llegue») en los workspaces 9 y 10,
// las dos inactivas, las dos escritas el 31/07/2026 a las 14:43:21.735Z (el mismo
// segundo, o sea una siembra). El código que las escribió ya no existe: ningún archivo
// del repo nombra `recordatorio-r1` y el único `JSON.stringify` sobre `pasos` que queda
// es para un prompt (`lib/nutricion-generator.ts:308`). O sea que esto es REPARAR
// filas viejas, no tapar un escritor vivo.
//
//   censo:     NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-pasos-secuencias.ts
//   reparar:   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-pasos-secuencias.ts --escribir
//
// ⚠️ SIN `--escribir` SÓLO MIRA. Y antes de escribir deja el valor crudo de cada fila en
// `.respaldo-pasos-secuencias.json`: si la decodificación saca algo que no es el array
// que había, el original es lo único que puede devolverlo.
//
// ⚠️ LA VERIFICACIÓN NO USA EL LECTOR DE ESTE SCRIPT. Es la trampa que el respaldo del
// store ya pagó: un lector que hace `JSON.parse` si el valor vino como string deshace
// exactamente la capa de más, y releer con él da VERDE sobre una fila rota. Acá se
// relee preguntando a POSTGRES `jsonb_typeof(pasos)`, que es la pregunta que el lector
// propio no puede contestar mal.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { writeFileSync } from 'node:fs';
import postgres from 'postgres';

const ESCRIBIR = process.argv.includes('--escribir');
const ARCHIVO = resolve(process.cwd(), '.respaldo-pasos-secuencias.json');

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

/**
 * Decodifica hasta llegar a un ARRAY, o se abstiene. Una capa de más es el bug
 * conocido; dos serían el bug aplicado dos veces, así que el while no supone
 * cuántas hay — pero corta a las 5 para no colgarse con un dato raro.
 */
function hastaArray(crudo: string): unknown[] | null {
  let v: unknown = crudo;
  for (let i = 0; i < 5; i++) {
    if (Array.isArray(v)) return v;
    if (typeof v !== 'string') return null;
    try { v = JSON.parse(v); } catch { return null; }
  }
  return Array.isArray(v) ? v : null;
}

type Fila = { ws: number; id: number; clave: string; activa: boolean; tipo: string; crudo: string };

async function main() {
  const malas = (await sql`
    select workspace_id as ws, id, clave, activa, jsonb_typeof(pasos) as tipo, pasos #>> '{}' as crudo
      from nutricion_secuencias
     where jsonb_typeof(pasos) <> 'array'
     order by workspace_id, id`) as unknown as Fila[];

  const total = (await sql`select count(*)::int as n from nutricion_secuencias`)[0] as { n: number };
  console.log(`${total.n} secuencias · ${malas.length} con \`pasos\` que NO es un array`);
  if (!malas.length) { console.log('✓ nada que reparar'); return; }

  const plan: { fila: Fila; pasos: unknown[] }[] = [];
  for (const f of malas) {
    const pasos = hastaArray(f.crudo);
    const donde = `ws${f.ws} sec ${f.id} «${f.clave}» (${f.activa ? 'ACTIVA' : 'inactiva'}, ${f.tipo})`;
    if (!pasos) { console.log(`  ⛔ ${donde}: no pude decodificar a un array — la dejo como está`); continue; }
    console.log(`  → ${donde}: ${pasos.length} pasos adentro`);
    plan.push({ fila: f, pasos });
  }

  if (!ESCRIBIR) { console.log('\n(sólo censo; con --escribir las repara)'); return; }
  if (!plan.length) { console.log('\nno hay ninguna que se pueda reparar'); return; }

  writeFileSync(ARCHIVO, JSON.stringify(malas, null, 2), 'utf8');
  console.log(`\nrespaldo crudo en ${ARCHIVO}`);

  for (const { fila, pasos } of plan) {
    // `sql.json(objeto)`, NUNCA `JSON.stringify(...)::jsonb`: eso es el bug.
    // El cast es del TIPO de postgres, cuyo `JSONValue` no contempla un array en
    // la raíz; el valor que viaja es el array, que es lo que la columna tenía.
    await sql`update nutricion_secuencias set pasos = ${sql.json(pasos as never)}, updated_at = now() where id = ${fila.id}`;
    // Se relee preguntándole a Postgres el TIPO, no parseando acá.
    const r = (await sql`select jsonb_typeof(pasos) as tipo, jsonb_array_length(pasos) as n from nutricion_secuencias where id = ${fila.id}`)[0] as { tipo: string; n: number };
    if (r.tipo !== 'array' || r.n !== pasos.length) throw new Error(`sec ${fila.id}: quedó ${r.tipo} con ${r.n} (esperaba array con ${pasos.length})`);
    console.log(`  ✓ ws${fila.ws} sec ${fila.id} «${fila.clave}»: array con ${r.n} pasos`);
  }
}

main().then(() => sql.end()).catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
