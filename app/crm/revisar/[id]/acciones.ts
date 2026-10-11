'use server';

// =============================================================================
// Confirmar o descartar los contactos que propuso un canal
// =============================================================================
// ⚠️ NO CREA LOS LEADS ACÁ: delega en `importarLeadsRevisadosAction`, la MISMA acción
// que usa el importador del CRM. No es reuso por elegancia — esa función ya sanea cada
// campo, vuelve a resolver los duplicados CONTRA LA BASE (no contra lo que dijo el
// cliente), respeta el tope por lote y devuelve el mismo resumen. Una segunda ruta de
// alta con sus propias validaciones es exactamente donde las dos se separan, y el día
// que se separen una va a dejar entrar lo que la otra rechaza.
//
// Lo propio de acá es cerrar la propuesta y aplicar lo que la tabla no sabe llevar
// (app/crm/revisar/[id]/propuesta-lead.ts): los PRODUCTOS que pidió la persona y la
// ATRIBUCIÓN de la landing. Las dos cosas se leen de la PROPUESTA, guardada por el
// server — nunca de lo que manda el navegador.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getPropuesta, marcarAplicada, descartarPropuesta } from '@/lib/propuestas';
import { importarLeadsRevisadosAction } from '@/app/crm/actions';
import { getUsuarioActual } from '@/lib/auth';
import { getTenantDb } from '@/lib/workspace';
import { idDelFunnelDefault } from '@/lib/funnels';
import { agregarAProducto } from '@/lib/lead-funnel';
import { casaParaEscribir, casaReal } from '@/lib/lead-funnel-reglas';
import type { FilaImport } from '@/app/crm/leads-importar';
import { productosDePropuesta, atribucionDePropuesta } from './propuesta-lead';

export type ResultadoConfirmar =
  | { ok: true; creados: number; omitidos: number; errores: string[] }
  | { ok: false; error: string };

export async function confirmarLeadsAction(id: string, filas: FilaImport[]): Promise<ResultadoConfirmar> {
  if (!(await getUsuarioActual())) return { ok: false, error: 'sin sesión' };

  const prop = await getPropuesta(id);
  if (!prop) return { ok: false, error: 'esa propuesta no existe' };
  if (prop.estado !== 'pendiente') return { ok: false, error: 'esa propuesta ya se resolvió' };

  // El primer producto es la CASA del lead que se crea: `casaParaEscribir` porque el
  // tablero del negocio pide sus leads con `funnel_id` NULL. Sin productos (Claude,
  // WhatsApp, la app), `undefined` = el embudo del negocio, como siempre.
  const productos = productosDePropuesta(prop.datos);
  const defaultId = productos.length ? await idDelFunnelDefault() : null;
  const casa = productos.length ? casaParaEscribir(productos[0], defaultId) : undefined;

  const r = await importarLeadsRevisadosAction(filas, casa);
  if (!r.creados && !r.ids?.length && r.errores.length) return { ok: false, error: r.errores.join(' · ') };
  const errores = [...r.errores];

  // ── La atribución de la landing, sólo sobre los leads que SE CREARON ──────────────
  // Una ficha que ya existía conserva la suya: su primer contacto es el que la trajo.
  const atrib = atribucionDePropuesta(prop.origen, prop.datos);
  const creados = (r.ids ?? []).filter((x) => x.destino === 'crear');
  if (Object.keys(atrib).length && creados.length) {
    const db = await getTenantDb();
    for (const x of creados) {
      const a = atrib[x.filaId];
      if (!a) continue;
      const { error } = await db.from('leads').update(a).eq('id', x.leadId);
      if (error) errores.push(`No pude guardar de qué campaña vino un lead: ${error.message}`);
    }
  }

  // ── Los productos: «agregar, nunca mover» ────────────────────────────────────────
  // Al lead nuevo, los que siguen a su casa; a la ficha que ya estaba, todos (si ya está
  // en alguno, `agregarAProducto` no hace nada). Cada uno es best-effort: la persona YA
  // está en el CRM, y un producto que falla no deshace el alta — se dice cuál.
  for (const x of r.ids ?? []) {
    const lista = x.destino === 'crear' ? productos.slice(1) : productos;
    for (const p of lista) {
      const real = casaReal(p, defaultId);
      if (real == null) { errores.push('No pude leer el producto del negocio para agregarlo.'); continue; }
      try { await agregarAProducto(x.leadId, real); }
      catch (e) { errores.push(`No pude agregarlo a un producto: ${e instanceof Error ? e.message : 'error'}`); }
    }
  }

  // ⚠️ Se marca DESPUÉS de crear, con la guarda de `pendiente` adentro: dos pestañas o
  // un doble click crean UN solo lote. Si devuelve false es que otra la ganó — los
  // leads ya están creados, así que no es un error que el usuario tenga que ver.
  await marcarAplicada(id, { creados: r.creados, enriquecidos: r.enriquecidos, omitidos: r.omitidos });

  revalidatePath('/crm');
  return { ok: true, creados: r.creados, omitidos: r.omitidos, errores };
}

/**
 * Descarta UNA propuesta de contactos.
 *
 * ⚠️ SÓLO tipo 'lead' y SÓLO pendiente (11/10/2026). `descartarPropuesta` no mira el tipo,
 * y esta acción pide cualquier sesión: sin el chequeo, un closer descartaba por id una
 * propuesta de ACCIÓN de MaKo, que en `descartarAccionAction` es sólo del admin. Y una que
 * ya se resolvió no contesta «ok» como si se hubiera descartado ahora.
 */
export async function descartarLeadsAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getUsuarioActual())) return { ok: false, error: 'sin sesión' };
  const prop = await getPropuesta(id);
  if (!prop || prop.tipo !== 'lead') return { ok: false, error: 'esa propuesta no existe' };
  if (prop.estado !== 'pendiente') return { ok: false, error: 'esa propuesta ya se resolvió' };
  await descartarPropuesta(id);
  return { ok: true };
}
