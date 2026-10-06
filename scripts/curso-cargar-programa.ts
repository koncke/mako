// =============================================================================
// curso-cargar-programa — carga el programa de Mauricio como curso de «Negocio que Escala»
// =============================================================================
// Pedido de Martín (06/10/2026): «implementes la tab de "CURSO" que ya teníamos en el workspace
// de Mauricio, con todo su programa». Los datos —las 63 clases de su planilla, los 43
// formularios del catálogo viejo y la logística— viven en lib/curso-programa-nqe.ts, que es
// puro y lo ejecuta tests/curso-programa-nqe.test.ts. Este script sólo los ESCRIBE.
//
// ── Uso (desde la raíz del repo: lee .env.local de ahí) ──────────────────────
//
//   node --import tsx scripts/curso-cargar-programa.ts --seco   ← sólo imprime el plan
//   node --import tsx scripts/curso-cargar-programa.ts          ← escribe
//
// ⚠️ IDEMPOTENTE POR (workspace_id, producto_id, origen), Y NO PISA NADA. Una clase cuyo `origen`
// ya está en la base se SALTEA aunque su contenido difiera de la semilla: puede ser que Mauricio
// la haya editado desde la tab Curso, y su edición le gana a este archivo. Por eso NO es un
// upsert de PostgREST: el índice único de la mig 0202 es PARCIAL (`where origen is not null`) y
// un `on conflict` sin ese predicado no lo puede inferir. Se leen los orígenes que ya están y se
// inserta sólo lo que falta. Si dos corridas se cruzan, el índice frena la segunda (falla el
// lote entero, no duplica) y se vuelve a correr.
//
// ⚠️ Y SI MAURICIO BORRA UNA CLASE, VOLVER A CORRER ESTO LA RECREA (no hay lápida). Es para la
// carga inicial; después el curso se maneja desde la pantalla.
//
// ⚠️ SÓLO ESCRIBE curso_clases. No toca producto_entrega, ni cliente_entrega, ni el avance.
//
// ⚠️ NO usa getTenantDb(): lib/workspace.ts importa 'server-only' y next/headers, que no corren
// con `node --import tsx` pelado. Va el cliente de servicio con el `.eq('workspace_id', …)` A
// MANO en cada consulta, que es exactamente lo que el proxy agregaría.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';
import { sanearCampos } from '../lib/curso';
import { CURSO_NQE, ETAPAS_NQE, programaNqe, type ClaseSemilla } from '../lib/curso-programa-nqe';

const SECO = process.argv.includes('--seco');
const WS = CURSO_NQE.workspaceId;
const PRODUCTO = CURSO_NQE.productoId;
/** De a cuántas filas se inserta: 107 entran en una, pero un lote chico deja ver dónde cortó. */
const LOTE = 50;

type EtapaEntrega = { key?: unknown };

async function main() {
  const db = getSupabaseServer();
  const semilla = programaNqe();

  // 1. El producto es el que creemos: un id equivocado cargaría el programa en otro producto.
  const { data: prod, error: eProd } = await db.from('productos')
    .select('id, nombre').eq('workspace_id', WS).eq('id', PRODUCTO).maybeSingle();
  if (eProd) throw new Error(`productos: ${eProd.message}`);
  if (!prod || prod.nombre !== CURSO_NQE.producto) {
    throw new Error(`El producto ${PRODUCTO} del ws${WS} es «${prod?.nombre ?? 'inexistente'}», no «${CURSO_NQE.producto}». No se carga nada.`);
  }

  // 2. Las etapas existen en la entrega del producto. Una clase cuelga de la CLAVE de su etapa:
  // con una clave que la entrega no tiene, la clase existiría y no se dibujaría en ningún lado.
  const { data: ent, error: eEnt } = await db.from('producto_entrega')
    .select('data').eq('workspace_id', WS).eq('producto_id', PRODUCTO).maybeSingle();
  if (eEnt) throw new Error(`producto_entrega: ${eEnt.message}`);
  const etapasVivas = ((ent?.data as { etapas?: EtapaEntrega[] } | null)?.etapas ?? [])
    .map((e) => (typeof e.key === 'string' ? e.key : '')).filter(Boolean);
  const faltan = [...new Set(semilla.map((c) => c.etapa))].filter((e) => !etapasVivas.includes(e));
  if (faltan.length) throw new Error(`La entrega del producto no tiene las etapas ${faltan.join(', ')} (tiene: ${etapasVivas.join(', ') || 'ninguna'}). No se carga nada.`);
  if (etapasVivas.join(',') !== ETAPAS_NQE.join(',')) {
    // No frena: las clases viajan con su clave. Se avisa porque el reparto se pensó en este orden.
    console.warn(`⚠️ El orden de las etapas cambió desde el 06/10.\n   hoy:     ${etapasVivas.join(' → ')}\n   semilla: ${ETAPAS_NQE.join(' → ')}`);
  }

  // 3. Lo que se va a escribir es lo que la base va a guardar: los campos pasan intactos por el
  // mismo saneo que usa la pantalla. El test ya lo fija; acá frena antes de escribir algo que
  // la pantalla después reescribiría distinto.
  for (const c of semilla) {
    if (!isDeepStrictEqual(sanearCampos(c.campos), c.campos)) throw new Error(`${c.origen}: sus campos no sobreviven a sanearCampos.`);
  }

  // 4. Lo que ya está.
  const { data: ya, error: eYa } = await db.from('curso_clases')
    .select('origen').eq('workspace_id', WS).eq('producto_id', PRODUCTO).not('origen', 'is', null);
  if (eYa) throw new Error(`curso_clases: ${eYa.message}`);
  const existentes = new Set((ya ?? []).map((r) => r.origen as string));
  const nuevas = semilla.filter((c) => !existentes.has(c.origen));
  const saltadas = semilla.filter((c) => existentes.has(c.origen));

  console.log(`ws${WS} · producto ${PRODUCTO} «${prod.nombre}» · ${SECO ? 'MODO SECO (no escribe)' : 'ESCRIBE'}`);
  console.log(`semilla: ${semilla.length} clases · ya en la base: ${saltadas.length} (se saltean) · a crear: ${nuevas.length}\n`);
  imprimirPlan(semilla, existentes);

  if (SECO) { console.log('\n→ seco: no se escribió nada.'); return; }
  if (!nuevas.length) { console.log('\n→ no hay nada que crear.'); return; }

  let creadas = 0;
  for (let i = 0; i < nuevas.length; i += LOTE) {
    const filas = nuevas.slice(i, i + LOTE).map((c) => ({ ...c, workspace_id: WS, producto_id: PRODUCTO }));
    const { error } = await db.from('curso_clases').insert(filas);
    if (error) throw new Error(`insert (lote desde ${nuevas[i].origen}): ${error.message} — van ${creadas} creadas; volver a correr retoma desde aquí.`);
    creadas += filas.length;
  }

  // 5. Se verifica lo que quedó en la BASE, no lo que se mandó: cada origen de la semilla
  // tiene que estar, y se cuenta por etapa.
  const { data: despues, error: eDes } = await db.from('curso_clases')
    .select('etapa, origen, obligatoria').eq('workspace_id', WS).eq('producto_id', PRODUCTO);
  if (eDes) throw new Error(`releer curso_clases: ${eDes.message}`);
  const enBase = new Set((despues ?? []).map((r) => r.origen as string | null));
  const perdidas = semilla.filter((c) => !enBase.has(c.origen)).map((c) => c.origen);
  if (perdidas.length) throw new Error(`Se insertó pero faltan en la base: ${perdidas.join(', ')}`);

  console.log(`\n✔ creadas ${creadas} · saltadas ${saltadas.length} · en la base ahora: ${despues?.length ?? 0}`);
  for (const e of ETAPAS_NQE) {
    const fs = (despues ?? []).filter((r) => r.etapa === e);
    console.log(`   ${e.padEnd(11)} ${String(fs.length).padStart(3)} clases · ${fs.filter((r) => r.obligatoria).length} obligatoria`);
  }
}

function imprimirPlan(semilla: ClaseSemilla[], existentes: Set<string>) {
  for (const e of ETAPAS_NQE) {
    const cs = semilla.filter((c) => c.etapa === e);
    console.log(`── ${e} (${cs.length})`);
    for (const c of cs) {
      const marca = existentes.has(c.origen) ? '= ' : '+ ';
      const ob = c.obligatoria ? '★' : ' ';
      const extra = c.campos.length ? ` [${c.campos.length} campos]` : '';
      console.log(`  ${marca}${ob} ${String(c.orden).padStart(3)} ${c.tipo.padEnd(12)} ${c.origen.padEnd(20)} ${c.titulo}${extra}`);
    }
  }
  console.log('\n  + se crea · = ya está y se saltea · ★ obligatoria (cierra la etapa)');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✖', e instanceof Error ? e.message : e); process.exit(1); });
