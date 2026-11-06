// =============================================================================
// calendario-email — enlazar un «Email» del Calendario a un email de Email Marketing (6/11/2026)
// =============================================================================
// La promesa a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md): el email del Calendario deja de ser un
// recordatorio. Enlazarlo PROGRAMA el broadcast a la hora del evento, y lo hace por la MISMA regla que «Programar» en Email
// Marketing: el `preparar` y el `ejecutar` de `programar_broadcast` (lib/api-mako/areas/email.run.ts), con su segmento, su
// tope, el turno del envío automático y los avisos (envío apagado, sin remitente propio). No hay una segunda regla acá.
//
// Lo usan la operación `enlazar_email_calendario` (lib/api-mako/areas/calendario.*) y el modal del evento
// (app/calendario/EnlazarEmail.tsx, por las actions de la tab). Lo puro, en lib/calendario-email-reglas.ts.
//
// ⚠️ PROGRAMAR UN EMAIL LE ESCRIBE A UN SEGMENTO ENTERO: el resumen se muestra ANTES y se confirma (en la pantalla o con la
//    pendiente de la API). El `ejecutar` vuelve a correr el `preparar` del broadcast: entre la vista y el clic pudo cambiar.
// ⚠️ SI EL EVENTO SE MUEVE, EL EMAIL SE MUEVE CON ÉL (`reprogramarSiEnlazado`, desde `cambiarEventoAction`); uno ya enviado
//    no se toca.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspace } from './workspace';
import { tabEnCapa } from './capas';
import type { Ctx, Ejecutado, Preparado, AccionRun } from './api-mako/tipos';
import { RUNNERS as RUNNERS_EMAIL } from './api-mako/areas/email.run';
import { ESTADOS_ENLAZABLES, coincideLaHora, motivoParaNoEnlazar, type EmailEnlazado, type EventoParaEmail } from './calendario-email-reglas';

const FALTA_MIGRACION = 'Todavía no se puede enlazar un email: falta un cambio en la base de MaKo (la migración 0406). Avísale a soporte; no se tocó nada.';
const faltaColumna = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204') && /email_broadcast_id/.test(e.message ?? '');

type FilaEvento = EventoParaEmail & { id: string; titulo: string; email_broadcast_id: number | null };

/**
 * El Calendario no le abre a nadie lo que su plan no tiene: programar un email es de la tab Email Marketing (`email`), y la
 * operación del Calendario se gatea por `calendario`. null = puede; si no, el motivo. «No pude leer el plan» no es un sí.
 */
async function sinEmailEnElPlan(ws: number): Promise<string | null> {
  const w = await getWorkspace(ws).catch(() => null);
  if (!w) return 'No pude leer el plan del negocio: no se programó nada.';
  return tabEnCapa('email', w.capa) ? null : 'Tu plan no tiene Email Marketing: el email del Calendario queda como recordatorio.';
}

const programar = () => RUNNERS_EMAIL.programar_broadcast as AccionRun;
const cancelar = () => RUNNERS_EMAIL.cancelar_programacion_broadcast as AccionRun;

async function evento(id: string): Promise<FilaEvento | null | 'sin-migracion'> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select('id, tipo, formato, titulo, dia_completo, inicio, email_broadcast_id').eq('id', id).maybeSingle();
  if (faltaColumna(error)) return 'sin-migracion';
  if (error) throw new Error(`No pude leer el evento: ${error.message}`);
  return (data as FilaEvento | null) ?? null;
}

async function broadcast(id: number): Promise<EmailEnlazado | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('email_broadcasts').select('id, asunto, estado, programado_at, enviado_at').eq('id', id).maybeSingle();
  if (error) throw new Error(`No pude leer el email: ${error.message}`);
  return (data as EmailEnlazado | null) ?? null;
}

export type EmailDelEvento =
  | { ok: true; enlazado: EmailEnlazado | null; opciones: EmailEnlazado[]; motivo: string | null; horaDistinta: boolean }
  | { ok: false; error: string };

/** Lo que dibuja el modal: el email enlazado, los que se pueden enlazar y por qué no, si no se puede. */
export async function emailDelEvento(eventoId: string, ahoraMs = Date.now()): Promise<EmailDelEvento> {
  const ev = await evento(eventoId);
  if (ev === 'sin-migracion') return { ok: false, error: FALTA_MIGRACION };
  if (!ev) return { ok: false, error: 'Ese evento ya no existe.' };
  const db = await getTenantDb();
  const [enlazado, lista] = await Promise.all([
    ev.email_broadcast_id != null ? broadcast(Number(ev.email_broadcast_id)) : Promise.resolve(null),
    db.from('email_broadcasts').select('id, asunto, estado, programado_at, enviado_at').in('estado', ESTADOS_ENLAZABLES as string[]).order('updated_at', { ascending: false }).limit(50),
  ]);
  if (lista.error) return { ok: false, error: `No pude leer los emails de Email Marketing: ${lista.error.message}` };
  return {
    ok: true, enlazado, opciones: (lista.data ?? []) as EmailEnlazado[],
    motivo: motivoParaNoEnlazar(ev, ahoraMs),
    horaDistinta: !!enlazado && !coincideLaHora(enlazado, ev.inicio),
  };
}

/** El resumen de enlazar (y programar) ese email a la hora del evento, sin escribir nada. */
export async function prepararEnlace(eventoId: string, broadcastId: number, ctx: Ctx, ahoraMs = Date.now()): Promise<Preparado> {
  const ev = await evento(eventoId);
  if (ev === 'sin-migracion') return { error: FALTA_MIGRACION };
  if (!ev) return { error: 'Ese evento ya no existe en el Calendario.' };
  const no = motivoParaNoEnlazar(ev, ahoraMs) ?? (await sinEmailEnElPlan(ctx.ws));
  if (no) return { error: no };
  const programado_at = new Date(Date.parse(ev.inicio)).toISOString();
  const p = await programar().preparar!({ id: broadcastId, programado_at }, ctx);
  if ('error' in p) return p;
  return {
    payload: { eventoId, broadcastId, programado_at },
    resumen: `Enlazar el evento «${ev.titulo}» del Calendario con este email y programarlo para esa hora. ${p.resumen}`.slice(0, 1500),
  };
}

/** Programa el email y deja el evento enlazado. Vuelve a mirar todo: entre el resumen y el clic pudo cambiar. */
export async function ejecutarEnlace(payload: Record<string, unknown>, ctx: Ctx): Promise<Ejecutado> {
  const eventoId = String(payload.eventoId ?? '');
  const broadcastId = Number(payload.broadcastId);
  const ev = await evento(eventoId);
  if (ev === 'sin-migracion') return { ok: false, resumen: FALTA_MIGRACION };
  if (!ev) return { ok: false, resumen: 'Ese evento ya no existe en el Calendario: no se programó nada.' };
  const sinPlan = await sinEmailEnElPlan(ctx.ws);
  if (sinPlan) return { ok: false, resumen: sinPlan };
  if (Date.parse(ev.inicio) !== Date.parse(String(payload.programado_at))) {
    return { ok: false, resumen: 'El evento cambió de hora desde que se armó esto: vuelve a enlazarlo para programarlo a la hora nueva.' };
  }
  const p = await programar().preparar!({ id: broadcastId, programado_at: payload.programado_at }, ctx);
  if ('error' in p) return { ok: false, resumen: p.error };
  const r = await programar().ejecutar(p.payload, ctx);
  if (!r.ok) return r;
  const db = await getTenantDb();
  const { error } = await db.from('calendario_eventos').update({ email_broadcast_id: broadcastId, updated_at: new Date().toISOString() }).eq('id', eventoId);
  if (error) return { ok: false, resumen: `El email quedó programado, pero no pude enlazarlo al evento (${error.message}). Míralo en Email Marketing.` };
  return { ok: true, resumen: `Email enlazado al evento «${ev.titulo}». ${r.resumen}`, datos: { eventoId, broadcastId, programado_at: payload.programado_at } };
}

/** Suelta el enlace. Si el email seguía programado, primero se cancela (vuelve a borrador y no sale). */
export async function soltarEnlace(eventoId: string, ctx: Ctx): Promise<Ejecutado> {
  const ev = await evento(eventoId);
  if (ev === 'sin-migracion') return { ok: false, resumen: FALTA_MIGRACION };
  if (!ev || ev.email_broadcast_id == null) return { ok: true, resumen: 'El evento no tenía un email enlazado.' };
  const b = await broadcast(Number(ev.email_broadcast_id));
  if (b?.estado === 'programado') {
    const p = await cancelar().preparar!({ id: b.id }, ctx);
    if ('error' in p) return { ok: false, resumen: p.error };
    const r = await cancelar().ejecutar(p.payload, ctx);
    if (!r.ok) return r;
  }
  const db = await getTenantDb();
  const { error } = await db.from('calendario_eventos').update({ email_broadcast_id: null, updated_at: new Date().toISOString() }).eq('id', eventoId);
  if (error) return { ok: false, resumen: `No pude soltar el email del evento: ${error.message}` };
  return { ok: true, resumen: b?.estado === 'programado' ? 'Email soltado: volvió a borrador y no sale.' : 'Email soltado del evento.' };
}

/**
 * Después de mover un evento: si tiene un email PROGRAMADO, lo mueve a la hora nueva (con la misma regla). null = no había
 * nada que mover; un texto = qué pasó, para decirlo.
 */
export async function reprogramarSiEnlazado(eventoId: string, ctx: Ctx): Promise<string | null> {
  const ev = await evento(eventoId);
  if (ev === 'sin-migracion' || !ev || ev.email_broadcast_id == null) return null;
  const b = await broadcast(Number(ev.email_broadcast_id));
  if (!b || b.estado !== 'programado' || coincideLaHora(b, ev.inicio)) return null;
  const p = await prepararEnlace(eventoId, b.id, ctx);
  if ('error' in p) return `El email enlazado sigue a la hora de antes: ${p.error}`;
  const r = await ejecutarEnlace(p.payload, ctx);
  return r.ok ? 'El email enlazado se movió a la hora nueva.' : `El email enlazado sigue a la hora de antes: ${r.resumen}`;
}
