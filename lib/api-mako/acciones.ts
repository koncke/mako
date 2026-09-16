// =============================================================================
// api-mako/acciones — el ciclo de una acción: proponer → pendiente → confirmar
// =============================================================================
// Ninguna acción escribe directo (AGENTS.md: «un canal PROPONE; una persona
// confirma»). Lo que cambia entre canales es DÓNDE dice que sí la persona:
//
//   · `chat`     → una fila en mako_acciones_pendientes (mig 0085) con vencimiento
//                  de 2 h. La confirma una PERSONA: un «sí» aparte en el grupo de
//                  WhatsApp, o la bandeja /mako/pendientes de la app. Por HTTP solo
//                  la confirma un token acuñado con alcance `ejecutar`, con el `id`
//                  obligatorio, y queda registrado que vino por la API.
//   · `pantalla` → una fila en `propuestas` (mig 0128) y un LINK absoluto a la
//                  pantalla donde se mira, se corrige y se confirma. Las áreas que
//                  ya tienen pantalla propia (leads, tareas, borradores) usan la
//                  suya; el resto va a la genérica /mako/revisar/<id>, que pinta un
//                  formulario desde `parametros` y al confirmar llama `ejecutar()`.
//
// LA CLAVE DE SCOPE de una pendiente es `ctx.canalKey` (lib/api-mako/canal.ts).
// Un «sí» solo alcanza lo que se propuso en ESE canal; la bandeja de la app ve todo
// el workspace, y el grupo de WhatsApp ve además las que vinieron por la API del
// mismo workspace, marcadas.
//
// ⚠️ CONFIRMAR RECLAMA ANTES DE EJECUTAR. Dos «sí» seguidos, dos pestañas o un
// cliente HTTP que reintenta por timeout leían la misma pendiente y ejecutaban dos
// veces (dos eventos en el historial; con presupuesto, plata). El update con
// `.eq('estado','pendiente')` es lo que hace que UNA sola gane; la otra recibe
// «ya estaba». Y si la ejecución explota a mitad, la pendiente queda en `error`
// con el motivo: nunca vuelve a `pendiente`, porque eso es cómo se duplican cosas.
//
// El mecanismo ya lo usaba lib/mako-doer-acciones.ts; acá lo comparten los tres
// canales. Las pendientes viejas siguen resolviendo: sus `tipo` son ids o alias.
// =============================================================================

import 'server-only';
import { crearPendiente, pendientesVigentes, pendientesDelWorkspace, reclamarPendiente, resolverPendiente, type Pendiente } from '@/lib/mako-pendientes';
import { crearPropuesta, getPropuesta, marcarAplicada, descartarPropuesta } from '@/lib/propuestas';
import { tzDeWorkspace } from '@/lib/timezone';
import { APP_BASE_URL } from '@/lib/app-url';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { porId } from './registro';
import { runnerDe } from './runners';
import { canalKeyDe, canalDeClave, etiquetaDeCanal, puedeConfirmar } from './canal';
import { esAccion, type AccionDef, type Ctx, type Ejecutado } from './tipos';

/** Cuánto vive un «sí». Dos horas: alcanza para que el dueño conteste y no para que
 *  un «dale» de la tarde ejecute lo que se propuso a la mañana. */
export const TTL_PENDIENTE_MIN = 120;

/** La bandeja donde una persona ve y confirma toda pendiente del workspace. */
export const RUTA_BANDEJA = '/mako/pendientes';

const fmtFecha = (iso: string, tz: string): string => {
  try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return iso; }
};

const origenDe = (ctx: Ctx): string => (ctx.canal === 'whatsapp' ? 'hola-mako' : ctx.canal === 'http' ? 'api' : 'app');

// ── chat: dejar una pendiente ─────────────────────────────────────────────────

type PropuestoChat = { pendiente: { id: number; resumen: string; venceEnMin: number; url: string } } | { error: string };

export async function proponerChat(def: AccionDef, payload: Record<string, unknown>, resumen: string, ctx: Ctx): Promise<PropuestoChat> {
  const id = await crearPendiente(ctx.ws, {
    grupoJid: ctx.canalKey, tipo: def.tipoPendiente ?? def.id, payload, resumen,
    origen: origenDe(ctx), ttlMin: TTL_PENDIENTE_MIN,
  });
  if (id == null) return { error: 'No se pudo registrar la acción pendiente.' };
  return { pendiente: { id, resumen, venceEnMin: TTL_PENDIENTE_MIN, url: `${APP_BASE_URL}${RUTA_BANDEJA}` } };
}

// ── pantalla genérica: dejar una propuesta con link ──────────────────────────

export async function proponerPantallaGenerica(def: AccionDef, payload: Record<string, unknown>, resumen: string, ctx: Ctx, ref?: string | null) {
  const { id, nueva } = await crearPropuesta({
    ws: ctx.ws, tipo: 'accion', ref: ref ?? null,
    origen: ctx.canal === 'whatsapp' ? 'whatsapp' : ctx.canal === 'http' ? 'claude' : 'app',
    resumen,
    datos: { operacion: def.id, payload, resumen, canal: ctx.canal },
  });
  return { propuesta: { id, url: `${APP_BASE_URL}/mako/revisar/${id}`, nueva } };
}

/**
 * Lo que la pantalla genérica aplica al confirmar. El payload puede venir EDITADO
 * por la persona (la pantalla es editable, es el punto): se vuelve a preparar contra
 * la base y recién después se ejecuta. `marcarAplicada` es lo que hace que dos
 * clicks creen UNA sola cosa.
 */
export async function aplicarPropuestaGenerica(propuestaId: string, payloadEditado: Record<string, unknown> | null, ctx: Ctx): Promise<Ejecutado> {
  return runWithWorkspace(ctx.ws, async () => {
    const prop = await getPropuesta(propuestaId);
    if (!prop || prop.tipo !== 'accion') return { ok: false, resumen: 'La propuesta no existe en este workspace.' };
    if (prop.estado !== 'pendiente') return { ok: false, resumen: `Esta propuesta ya está ${prop.estado}.` };
    const opId = String(prop.datos.operacion ?? '');
    const def = porId(opId);
    const run = runnerDe(def?.id ?? '');
    if (!def || !esAccion(def) || !run || !('ejecutar' in run)) return { ok: false, resumen: `La operación «${opId}» ya no existe.` };
    const base = (prop.datos.payload ?? {}) as Record<string, unknown>;
    const entrada = payloadEditado ? { ...base, ...payloadEditado } : base;
    const prep = await run.preparar(entrada, ctx);
    if ('error' in prep) return { ok: false, resumen: prep.error };
    // Reclamar ANTES de ejecutar: dos clicks crean una sola cosa.
    const mia = await marcarAplicada(propuestaId, { en_curso: true });
    if (!mia) return { ok: false, resumen: 'Esta propuesta ya se estaba aplicando.' };
    let r: Ejecutado;
    try { r = await run.ejecutar(prep.payload, ctx); }
    catch (err) { r = { ok: false, resumen: `No se pudo aplicar (${err instanceof Error ? err.message : 'error'}).` }; }
    // El resultado final pisa el «en curso». Si falló, queda aplicada con el error
    // escrito: volver a `pendiente` sería invitar a un segundo click sobre algo que
    // pudo haber escrito a medias.
    await marcarResultado(propuestaId, { resumen: r.resumen, ok: r.ok, ...(r.datos ?? {}) });
    return r;
  });
}

async function marcarResultado(id: string, resultado: Record<string, unknown>): Promise<void> {
  const db = await getTenantDb();
  await db.from('propuestas').update({ resultado }).eq('id', id);
}

export async function descartarPropuestaGenerica(propuestaId: string, ctx: Ctx): Promise<void> {
  await runWithWorkspace(ctx.ws, () => descartarPropuesta(propuestaId));
}

// ── pendientes: listar, confirmar, cancelar ──────────────────────────────────

/** Qué ve cada canal: WhatsApp ve su grupo y las de la API del mismo workspace;
 *  HTTP ve las suyas; la bandeja de la app ve todo el workspace. */
async function vigentesPara(ctx: Ctx): Promise<Pendiente[]> {
  if (ctx.bandeja || ctx.canal === 'app') return pendientesDelWorkspace(ctx.ws);
  if (ctx.canal === 'whatsapp') {
    const [grupo, api] = await Promise.all([
      pendientesVigentes(ctx.ws, ctx.canalKey),
      pendientesVigentes(ctx.ws, canalKeyDe('http', ctx.ws)),
    ]);
    return [...grupo, ...api].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  return pendientesVigentes(ctx.ws, ctx.canalKey);
}

export async function listarPendientes(ctx: Ctx) {
  const vig = await vigentesPara(ctx);
  const tz = await tzDeWorkspace(ctx.ws);
  return vig.map((p) => ({
    id: p.id, operacion: p.tipo, resumen: p.resumen,
    origen: etiquetaDeCanal(p.grupoJid), canal: canalDeClave(p.grupoJid),
    vence: fmtFecha(p.venceAt, tz), venceAt: p.venceAt, creada: p.createdAt,
  }));
}

type Elegida = { pendiente: Pendiente } | { error: string; vigentes?: Array<{ id: number; resumen: string }> };

/** Cuál pendiente quiso decir. En WhatsApp, sin id vale si hay una sola; en la app
 *  y por HTTP el id es obligatorio: todas las llamadas del workspace comparten
 *  cola, y «la única» de uno puede ser la de otro. */
async function elegir(ctx: Ctx, id: number | null, verbo: 'confirmar' | 'cancelar'): Promise<Elegida> {
  const vig = await vigentesPara(ctx);
  if (!vig.length) return { error: `No hay ninguna acción pendiente vigente para ${verbo}.` };
  const lista = vig.map((p) => ({ id: p.id, resumen: p.resumen }));
  if (id == null && ctx.canal !== 'whatsapp') return { error: `Di cuál (el id es obligatorio en este canal).`, vigentes: lista };
  const target = id != null ? vig.find((p) => p.id === id) : (vig.length === 1 ? vig[0] : undefined);
  if (target) return { pendiente: target };
  if (id != null) return { error: `No encuentro la acción #${id} vigente.`, vigentes: lista };
  return { error: `Hay ${vig.length} acciones pendientes, aclara cuál.`, vigentes: lista };
}

export async function cancelarPendiente(ctx: Ctx, id: number | null) {
  const e = await elegir(ctx, id, 'cancelar');
  if ('error' in e) return e;
  const tocada = await resolverPendiente(ctx.ws, e.pendiente.id, 'cancelada', `cancelada desde ${ctx.canal}`, { soloSiPendiente: true });
  if (!tocada) return { error: 'Esa acción ya estaba resuelta.' };
  return { ok: true as const, id: e.pendiente.id, resumen: `Cancelada: ${e.pendiente.resumen}` };
}

export async function confirmarPendiente(ctx: Ctx, id: number | null) {
  if (!puedeConfirmar(ctx.canal, ctx.alcance, ctx.bandeja)) {
    return { error: 'Este token propone pero no ejecuta: la persona confirma la acción en MaKo (bandeja de pendientes) o por WhatsApp.' };
  }
  const e = await elegir(ctx, id, 'confirmar');
  if ('error' in e) return e;
  const p = e.pendiente;
  const creada = Date.parse(p.createdAt);

  // Anti auto-confirm. En WhatsApp y en la app, una pendiente creada en ESTE turno
  // no se confirma en él: el «sí» es un mensaje aparte. 1,5 s de margen por el
  // skew reloj-app/base. Es el candado del caso que rompió todo (ver la cabecera
  // de mako-doer-acciones.ts, `CONFIRMACION_PELADA`).
  if (ctx.turnStart && Number.isFinite(creada) && creada >= ctx.turnStart - 1500) {
    return { error: 'Recién propuse esa acción en este mismo mensaje. NO la confirmes tú: frena y espera a que la persona mande un «sí» aparte.' };
  }

  const def = porId(p.tipo);
  const run = runnerDe(def?.id ?? '');
  if (!def || !esAccion(def) || !run || !('ejecutar' in run)) {
    await resolverPendiente(ctx.ws, p.id, 'error', `operación desconocida: ${p.tipo}`, { soloSiPendiente: true });
    return { error: `La acción «${p.tipo}» ya no existe en MaKo; la pendiente quedó cerrada.` };
  }

  // RECLAMAR: una sola confirmación gana. 0 filas = otra ya la tomó (o venció).
  const mia = await reclamarPendiente(ctx.ws, p.id);
  if (!mia) return { error: 'Esa acción ya se estaba ejecutando o ya venció.' };

  let r: Ejecutado;
  try { r = await run.ejecutar(p.payload, ctx); }
  catch (err) { r = { ok: false, resumen: `No pude ejecutarlo (${err instanceof Error ? err.message : 'error'}).` }; }
  const nota = ctx.canal === 'http' ? `${r.resumen} (confirmado por la API)` : r.resumen;
  await resolverPendiente(ctx.ws, p.id, r.ok ? 'ejecutada' : 'error', nota);
  return { ok: r.ok, id: p.id, resumen: r.resumen, ...(r.datos ? { datos: r.datos } : {}) };
}
