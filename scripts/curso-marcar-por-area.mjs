// =============================================================================
// curso-marcar-por-area — marca POR ÁREA las clases de m6-m9 que ya están cargadas en el ws1 (#665)
// =============================================================================
// Decisión de Martín (06/10/2026, memoria cs-decisiones-cierre-0610): «m6-m9 por área con link
// propio del líder de área». La semilla (lib/curso-programa-nqe.ts, `FORMULARIOS_POR_AREA`) ya trae
// `por_area: true` en los 13 formularios de palancas, evidencia, umbrales y carta. Pero la semilla
// NO es la fuente de verdad: una vez cargado, el curso vive en la base, y
// scripts/curso-cargar-programa.ts SALTEA todo origen que ya existe. Cambiar la semilla no cambia lo
// cargado; esto sí.
//
// ⚠️ NECESITA LA MIG 0212 APLICADA (la columna `curso_clases.por_area`). Sin ella, se niega.
//
// ── Uso: desde la RAÍZ del repo ─────────────────────────────────────────────────
//   node --import tsx scripts/curso-marcar-por-area.mjs            ← SECO (default): dice qué marcaría
//   node --import tsx scripts/curso-marcar-por-area.mjs --commit   ← escribe
//
//   · Lee DATABASE_URL de `.env.local` del cwd, y la semilla del cwd: lo que se marca es EXACTAMENTE
//     lo que la semilla commiteada dice, no una lista copiada a mano.
//   · `--import tsx` hace falta porque importa un `.ts`.
//
// UBICA CADA CLASE POR SU `origen` ('catalogo:m6c1'…), en el ws1 y el producto 1 — NUNCA POR ID.
//
// SE NIEGA (no escribe NADA) si:
//   · el producto 1 del ws1 no se llama como dice la semilla (base equivocada);
//   · la columna `por_area` no existe (la 0212 no se aplicó);
//   · algún origen aparece más de una vez (no debería poder: hay un índice único por origen).
// Un origen que FALTA (Mauricio borró esa clase) no frena: se dice y se marca el resto.
// Una clase que YA está por área se saltea: correrlo dos veces no hace nada la segunda.
// Una clase marcada por área en la base que la semilla NO marca no se toca: se avisa (alguien la
// marcó a mano, y desmarcar no es el trabajo de este script).
//
// ⚠️ LAS RESPUESTAS QUE YA HAYA NO SE PIERDEN, y por eso no frena: lo que el cliente contestó antes
// queda en su fila (área ''), la ficha lo sigue mostrando, y desde ahora cada área contesta aparte.
// Lo que cambia es que esa tarea vuelve a «pendiente» hasta que la manden todas sus áreas — se
// cuentan las filas y se avisa cuántas son. Ninguno de los 13 es obligatorio en la semilla, así que
// no le cambia la etapa a nadie.
//
// No manda nada a nadie: sólo un UPDATE de `por_area` sobre curso_clases.
//
// La función pura (`planPorArea`) la EJECUTA tests/curso-marcar-por-area.test.ts contra la semilla
// de este árbol.
// =============================================================================

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WS = 1;
const PRODUCTO = 1;
const PRODUCTO_NOMBRE = 'Negocio que Escala';

/**
 * Qué hacer con cada clase. `filas` = lo que hay en la base ({id, origen, titulo, por_area});
 * `origenes` = los que la semilla marca por área.
 * Devuelve { marcar: fila[], ya: fila[], faltan: origen[], ajenas: fila[], rechazos: string[] }.
 */
export function planPorArea(filas, origenes) {
  const quiero = new Set(origenes);
  const rechazos = [];
  const porOrigen = new Map();
  for (const f of filas) {
    if (!f.origen) continue;
    if (!porOrigen.has(f.origen)) porOrigen.set(f.origen, []);
    porOrigen.get(f.origen).push(f);
  }
  const marcar = [];
  const ya = [];
  const faltan = [];
  for (const o of origenes) {
    const fs = porOrigen.get(o) ?? [];
    if (fs.length > 1) { rechazos.push(`«${o}» aparece ${fs.length} veces (ids ${fs.map((f) => f.id).join(', ')}): tiene que ser una.`); continue; }
    if (!fs.length) { faltan.push(o); continue; }
    (fs[0].por_area === true ? ya : marcar).push(fs[0]);
  }
  // Por área en la base y NO en la semilla: alguien la marcó a mano. No se toca.
  const ajenas = filas.filter((f) => f.por_area === true && !quiero.has(f.origen ?? ''));
  return { marcar, ya, faltan, ajenas, rechazos };
}

async function main() {
  const COMMIT = process.argv.includes('--commit');
  const cwd = process.cwd();
  const req = createRequire(resolve(cwd, 'package.json'));
  req('dotenv').config({ path: resolve(cwd, '.env.local') });
  const postgres = req('postgres');

  // 1. La semilla, del árbol desde donde se corre.
  let semillaMod;
  try {
    semillaMod = await import(pathToFileURL(resolve(cwd, 'lib/curso-programa-nqe.ts')).href);
  } catch (e) {
    console.error(`✖ No pude importar la semilla (${e?.code ?? e?.message}). Se corre desde la raíz del repo y con tsx:\n   node --import tsx scripts/curso-marcar-por-area.mjs${COMMIT ? ' --commit' : ''}`);
    process.exit(1);
  }
  const { programaNqe, CURSO_NQE } = semillaMod;
  if (CURSO_NQE.workspaceId !== WS || CURSO_NQE.productoId !== PRODUCTO) throw new Error(`la semilla apunta a ws${CURSO_NQE.workspaceId}/producto ${CURSO_NQE.productoId}, no a ws${WS}/producto ${PRODUCTO}`);
  const origenes = programaNqe().filter((c) => c.por_area === true).map((c) => c.origen);
  if (!origenes.length) throw new Error('la semilla de este árbol no marca ninguna clase por área (falta #665): se corre desde un árbol con ese commit');

  const conn = process.env.DATABASE_URL;
  if (!conn) { console.error('✖ Falta DATABASE_URL en .env.local'); process.exit(1); }
  const sql = postgres(conn, { ssl: 'require', connect_timeout: 60, max: 1 });

  try {
    // 2. El proyecto es el que creemos.
    const prod = await sql`select id, nombre from productos where workspace_id = ${WS} and id = ${PRODUCTO}`;
    if (prod.length !== 1 || prod[0].nombre !== PRODUCTO_NOMBRE) {
      throw new Error(`el producto ${PRODUCTO} del ws${WS} es «${prod[0]?.nombre ?? 'inexistente'}», no «${PRODUCTO_NOMBRE}». Base equivocada: no se toca nada.`);
    }
    // 3. La 0212 está aplicada.
    const col = await sql`select 1 from information_schema.columns where table_name = 'curso_clases' and column_name = 'por_area'`;
    if (!col.length) throw new Error('curso_clases no tiene la columna por_area: falta aplicar supabase/migrations/0212_curso_por_area.sql. No se toca nada.');

    // 4. Lo que hay (todas las clases del producto: también para ver las marcadas a mano).
    const filas = await sql`
      select id, origen, titulo, etapa, por_area from curso_clases
      where workspace_id = ${WS} and producto_id = ${PRODUCTO} order by id`;
    const plan = planPorArea(filas, origenes);

    // 5. Cuántas respuestas ya hay en las que se van a marcar (no frena: ver la cabecera).
    const ids = plan.marcar.map((f) => f.id);
    const conRespuesta = ids.length ? await sql`
      select clase_id, count(*)::int as n from curso_progreso
      where workspace_id = ${WS} and clase_id in ${sql(ids)} and area = '' and valores <> '{}'::jsonb
      group by clase_id` : [];

    console.log(`ws${WS} · producto ${PRODUCTO} «${prod[0].nombre}» · ${COMMIT ? 'ESCRIBE (--commit)' : 'SECO (no escribe; --commit para escribir)'}\n`);
    console.log(`la semilla marca ${origenes.length} por área · a marcar: ${plan.marcar.length} · ya estaban: ${plan.ya.length} · faltan en la base: ${plan.faltan.length}`);
    for (const f of plan.marcar) console.log(`   + id ${f.id} · ${f.origen} · ${f.etapa} · «${f.titulo}»`);
    for (const f of plan.ya) console.log(`   = id ${f.id} · ${f.origen} · ya por área`);
    for (const o of plan.faltan) console.log(`   ⚠️ ${o}: no está en la base (¿la borraron?). Se marca el resto.`);
    for (const f of plan.ajenas) console.log(`   ⚠️ id ${f.id} · ${f.origen ?? '(sin origen)'} · «${f.titulo}»: por área en la base y NO en la semilla. No se toca.`);
    for (const r of conRespuesta) console.log(`   ⚠️ clase id ${r.clase_id}: ${r.n} cliente(s) ya contestaron. Lo suyo queda; esa tarea vuelve a pendiente hasta que la manden todas sus áreas.`);

    if (plan.rechazos.length) {
      console.error(`\n✖ SE NIEGA, no se escribe nada:\n${plan.rechazos.map((x) => `   · ${x}`).join('\n')}`);
      process.exitCode = 1;
      return;
    }
    if (!plan.marcar.length) { console.log('\n→ no hay nada que marcar.'); return; }
    if (!COMMIT) { console.log(`\n→ seco: se marcarían ${plan.marcar.length} clase(s). Para escribir: --commit`); return; }

    // 6. Escribir en UNA transacción, sólo las que siguen sin marcar, y exigir que sean exactamente ésas.
    await sql.begin(async (tx) => {
      const upd = await tx`
        update curso_clases set por_area = true, updated_at = now()
        where workspace_id = ${WS} and producto_id = ${PRODUCTO} and id in ${tx(ids)} and por_area = false
        returning id`;
      if (upd.length !== ids.length) throw new Error(`el UPDATE tocó ${upd.length} clase(s) y esperaba ${ids.length}: algo cambió desde la lectura — se deshace, volver a correr en seco`);
    });

    // 7. Releer AFUERA de la transacción: lo que ve el portal.
    const despues = await sql`
      select origen from curso_clases
      where workspace_id = ${WS} and producto_id = ${PRODUCTO} and por_area = true order by id`;
    const marcados = new Set(despues.map((f) => f.origen));
    const sinMarcar = origenes.filter((o) => !plan.faltan.includes(o) && !marcados.has(o));
    if (sinMarcar.length) throw new Error(`después de escribir, siguen sin marcar: ${sinMarcar.join(', ')}`);
    console.log(`\n✔ marcadas ${ids.length} · por área en la base ahora: ${despues.length}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Corre siempre que se lo llame, SALVO con MARCAR_POR_AREA_SOLO_IMPORTAR=1: así el test que prueba la
// función pura lo importa sin tocar la base (el mismo criterio que curso-aplicar-694.mjs).
if (process.env.MARCAR_POR_AREA_SOLO_IMPORTAR !== '1') {
  main().catch((e) => { console.error('✖', e instanceof Error ? e.message : e); process.exit(1); });
}
