'use server';

// =============================================================================
// /m/inbox — decidir desde el teléfono lo que espera en «Para decidir»
// =============================================================================
// NO HAY UNA SEGUNDA IMPLEMENTACIÓN DE NADA. Cada acción delega en la de escritorio, que
// es la que reclama, ejecuta y resuelve (todo el ciclo vive en lib/api-mako/acciones.ts y
// en lib/mako-confirmaciones.ts):
//   · confirmar/cancelar una pendiente → app/mako/pendientes/acciones.ts
//   · confirmar/descartar una acción   → app/mako/revisar/[id]/acciones.ts
//   · resolver un cambio del CRM       → app/crm/mako-confirm-actions.ts
//
// Lo que esta puerta agrega, y por qué no se importan las de escritorio directo:
//   1. QUIÉN PUEDE, con la MISMA regla que arma la lista (`tiposVisibles`): rol + capa.
//      Las de escritorio miran la sesión y el rol, pero la capa la miraba la PÁGINA
//      (`requireRolWs([], { nav: 'mako' })`), y una server action no hereda ningún guard.
//      Lo que la lista del teléfono no ofrece, la acción tampoco lo hace.
//   2. Una acción con parámetros object/object[] NO se confirma acá: se revisa en la
//      computadora (docs/diseno-mako-mobile.md). La lista ya no ofrece el botón; esto lo
//      vuelve verdad del lado del server.
//   3. REFRESCA LA PANTALLA DEL TELÉFONO (`refresh()`). Las de escritorio revalidan su
//      propia ruta, y `revalidatePath` sólo redibuja la ruta que se está mirando: sin
//      esto, el ítem seguía en el Inbox y el badge seguía contándolo.
//   4. El error vuelve CORTO para un toast cuando lo decide esta puerta; el de la acción
//      de escritorio pasa tal cual (puede ser el resultado de lo que se ejecutó).
//
// ⚠️ LA PÁGINA QUE LAS MONTA DECLARA `export const maxDuration = 420`: el techo de la
// PÁGINA gobierna sus server actions, y confirmar una acción de MaKo puede correr IA o
// analizar una llamada. Sin eso la plataforma corta a mitad y la propuesta queda
// «aplicándose» sin resultado (app/mako/pendientes/page.tsx).
//
// ⚠️ `ok: false` DESPUÉS DE EJECUTAR NO SE REINTENTA: la pendiente o la propuesta ya
// quedó cerrada con su error (se ejecutó y falló). El teléfono muestra el motivo, sin
// botón de reintentar.
//
// ⚠️ 'use server' EXPORTA SÓLO FUNCIONES ASYNC. El tipo del resultado vive en
// lib/inbox-movil-reglas.ts (`ResultadoMovil`, puro).
// =============================================================================

import { refresh } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { getPropuesta } from '@/lib/propuestas';
import { porId } from '@/lib/api-mako/registro';
import { esAccion } from '@/lib/api-mako/tipos';
import {
  complejidadDe, decisionValida, idDePropuesta, idNumerico, tiposVisibles,
  type ResultadoMovil, type TipoDecision,
} from '@/lib/inbox-movil-reglas';
import { confirmarPendienteAction, cancelarPendienteAction } from '@/app/mako/pendientes/acciones';
import { confirmarAccionAction, descartarAccionAction } from '@/app/mako/revisar/[id]/acciones';
import { resolverConfirmacionAction } from '@/app/crm/mako-confirm-actions';

/** null = puede; si no, el motivo corto. Sesión primero: sin cookie no hay rol. */
async function noPuede(tipo: TipoDecision): Promise<string | null> {
  try {
    if (!(await getUsuarioActual())) return 'Sesión vencida';
  } catch {
    return 'Sesión vencida';
  }
  const [rol, capa] = await Promise.all([getRolWsEfectivo(), getCapaActual()]);
  return tiposVisibles(rol, capa).includes(tipo) ? null : 'Sin permiso';
}

/** Envuelto: la escritura ya pasó, y un fallo al refrescar no puede volverla un error. */
function refrescar(): void {
  try { refresh(); } catch (e) { console.error('[m/inbox] refresh:', e instanceof Error ? e.message : e); }
}

/** Confirma y ejecuta una acción que MaKo dejó esperando un «sí». Sólo el admin. */
export async function confirmarPendienteMovil(id: number | string): Promise<ResultadoMovil> {
  const n = idNumerico(id);
  if (n == null) return { ok: false, error: 'Acción inválida' };
  const no = await noPuede('pendiente');
  if (no) return { ok: false, error: no };
  const r = await confirmarPendienteAction(n);
  refrescar();
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, error: r.error };
}

/** «No ejecutar»: cierra la pendiente sin hacer nada. Sólo el admin. */
export async function cancelarPendienteMovil(id: number | string): Promise<ResultadoMovil> {
  const n = idNumerico(id);
  if (n == null) return { ok: false, error: 'Acción inválida' };
  const no = await noPuede('pendiente');
  if (no) return { ok: false, error: no };
  const r = await cancelarPendienteAction(n);
  refrescar();
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, error: r.error };
}

/**
 * Confirma una propuesta de acción SIMPLE con los parámetros tal como se guardaron (el
 * `payload` del ítem: el teléfono confirma, no edita). Una compleja contesta que se
 * revisa en la computadora, sin tocar nada. Sólo el admin.
 */
export async function confirmarAccionMovil(id: string, payload: Record<string, unknown>): Promise<ResultadoMovil> {
  const pid = idDePropuesta(id);
  if (!pid) return { ok: false, error: 'Propuesta inválida' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'Faltan los datos' };
  const no = await noPuede('accion');
  if (no) return { ok: false, error: no };
  // La operación se lee de la PROPUESTA guardada, como en la de escritorio.
  const prop = await getPropuesta(pid).catch(() => null);
  const def = prop?.tipo === 'accion' ? porId(String(prop.datos.operacion ?? '')) : null;
  if (prop?.tipo === 'accion' && complejidadDe(def && esAccion(def) ? def.parametros : null) === 'compleja') {
    return { ok: false, error: 'Revísala en la computadora' };
  }
  const r = await confirmarAccionAction(pid, payload);
  refrescar();
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, error: r.error };
}

/** Descarta una propuesta de acción: no se ejecuta nada. Sólo el admin. */
export async function descartarAccionMovil(id: string): Promise<ResultadoMovil> {
  const pid = idDePropuesta(id);
  if (!pid) return { ok: false, error: 'Propuesta inválida' };
  const no = await noPuede('accion');
  if (no) return { ok: false, error: no };
  const r = await descartarAccionAction(pid);
  refrescar();
  return r.ok ? { ok: true, resumen: r.resumen } : { ok: false, error: r.error };
}

/**
 * Resuelve un cambio del CRM automático con una de sus `opciones` (`decision` del ítem):
 * 'confirmar' (dejarlo), 'rechazar' (deshacerlo) u 'op:<key>'. Dos toques seguidos aplican
 * UNA vez: el reclamo vive en `resolverConfirmacion` (lib/mako-confirmaciones.ts).
 */
export async function resolverConfirmacionMovil(id: number | string, decision: string): Promise<ResultadoMovil> {
  const n = idNumerico(id);
  const d = decisionValida(decision);
  if (n == null || !d) return { ok: false, error: 'Decisión inválida' };
  const no = await noPuede('confirmacion');
  if (no) return { ok: false, error: no };
  const r = await resolverConfirmacionAction(n, d);
  refrescar();
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? 'No se pudo' };
}
