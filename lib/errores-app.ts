import 'server-only';

// =============================================================================
// Los errores de la app — registrarlos agrupados por huella, y abrir el ticket de bug cuando la huella es nueva
// =============================================================================
// Martín (17/10/2026): «lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app... Y todo lo
// solucionas automáticamente». Las reglas puras (qué se guarda, qué es ruido, la huella): lib/errores-app-reglas.ts.
// Llaman acá: la ruta /api/errores (el navegador), instrumentation.ts (el servidor) y el turno del chat de la app (MaKo).
//
// Lo que hace, en orden:
//   1. ruido → nada (una extensión, la red, un deploy que deja a una pestaña vieja sin sus archivos);
//   2. huella conocida → suma una vez y el afectado; si su ticket ya estaba RESUELTO y vuelve a pasar después del margen,
//      es una REGRESIÓN: un ticket nuevo («Volvió a pasar»);
//   3. huella nueva → con el tope por persona y por día, la fila y el ticket de bug del SISTEMA (`canal: 'sistema'`).
//      El triage lo da por bug evidente (el error lo vio el código) y va solo al Cerebro, salvo zona delicada, el tope del
//      día o el interruptor apagado.
//
// ⚠️ NUNCA TIRA: lo llama el que está fallando (un boundary, un onRequestError, un turno). Un reporte que no se pudo
// guardar se loguea y se pierde; nunca rompe la pantalla ni el turno que lo mandó.

import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { crearTicket, type Identidad } from './tickets-db';
import {
  MARGEN_REGRESION_MS, TOPE_ERRORES_NUEVOS_POR_DIA, conAfectado, esDeConfiguracion, esRuido, huellaDe, leerAfectados, sanearReporte, ticketDeError, tituloDeError,
  type ReporteError,
} from './errores-app-reglas';

const T = 'errores_app';

export type Registrado =
  | { ok: true; huella: string; nuevo: boolean; ticketId: number | null; regresion?: boolean }
  | { ok: false; motivo: 'no-es-un-reporte' | 'ruido' | 'configuracion' | 'tope' | 'falla' };

/** Quien firma un error sin persona (uno del servidor sin sesión): la plataforma. */
async function identidadDelSistema(): Promise<Identidad> {
  return { ws: await wsSuperAdmin(), email: 'sistema@hola-mako.com', nombre: 'MaKo (lo detectó solo)', usuarioId: null, rol: 'sistema', plan: null };
}

async function abrirTicket(r: ReporteError, huella: string, quien: Identidad | null, veces: number, regresion: boolean): Promise<number | null> {
  const t = ticketDeError(r, veces);
  const identidad = quien ?? (await identidadDelSistema());
  const c = await crearTicket({
    identidad, tipo: 'bug', declaradoPor: 'sistema', sistema: true,
    titulo: regresion ? `Volvió a pasar: ${t.titulo}`.slice(0, 140) : t.titulo,
    descripcion: t.descripcion, canal: 'sistema', contexto: t.contexto,
    ref: `error:${huella}:${regresion ? Date.now() : 'primera'}`,
  });
  return c.ok ? c.id : null;
}

/** Registra un error. `quien` = la persona que lo vio (null = no se sabe: un error del servidor sin sesión). */
export async function registrarError(crudo: unknown, quien: Identidad | null, ahora = Date.now()): Promise<Registrado> {
  try {
    const r = sanearReporte(crudo);
    if (!r) return { ok: false, motivo: 'no-es-un-reporte' };
    if (esRuido(r)) return { ok: false, motivo: 'ruido' };
    // Al negocio le falta algo SUYO (una IA conectada): no es un bug, se le pide en el chat (esDeConfiguracion).
    if (esDeConfiguracion(r)) return { ok: false, motivo: 'configuracion' };
    const huella = huellaDe(r);
    const db = getSupabaseServer();
    const ahoraIso = new Date(ahora).toISOString();
    const afectado = quien ? { ws: quien.ws, email: quien.email } : null;

    const { data: fila } = await db.from(T).select('id, veces, afectados, ticket_id, tickets(estado, resuelto_at)').eq('huella', huella).maybeSingle();
    if (fila) {
      const veces = Number(fila.veces) + 1;
      await db.from(T).update({
        veces, ultima_vez: ahoraIso, ejemplo: r,
        ...(afectado ? { afectados: conAfectado(fila.afectados, afectado) } : {}),
      }).eq('id', fila.id);
      const tk = fila.tickets as { estado?: string; resuelto_at?: string | null } | null;
      const resuelto = tk?.estado === 'resuelto' && tk.resuelto_at && ahora - Date.parse(tk.resuelto_at) > MARGEN_REGRESION_MS;
      if (fila.ticket_id && !resuelto) return { ok: true, huella, nuevo: false, ticketId: Number(fila.ticket_id) };
      // Sin ticket (no se pudo abrir la primera vez) o una REGRESIÓN: se abre uno.
      const ticketId = await abrirTicket(r, huella, quien, veces, !!resuelto);
      if (ticketId) await db.from(T).update({ ticket_id: ticketId }).eq('id', fila.id);
      return { ok: true, huella, nuevo: false, ticketId, ...(resuelto ? { regresion: true } : {}) };
    }

    // Una huella NUEVA: el tope por persona y por día (más que esto es un bucle o un abuso, no errores distintos).
    if (quien) {
      const { count } = await db.from(T).select('id', { count: 'exact', head: true })
        .eq('primer_email', quien.email).gte('primera_vez', new Date(ahora - 86_400_000).toISOString());
      if ((count ?? 0) >= TOPE_ERRORES_NUEVOS_POR_DIA) return { ok: false, motivo: 'tope' };
    }
    const { data: nueva, error } = await db.from(T).insert({
      huella, origen: r.origen, titulo: tituloDeError(r), ejemplo: r, primera_vez: ahoraIso, ultima_vez: ahoraIso,
      afectados: afectado ? [afectado] : [], primer_email: quien?.email ?? null,
    }).select('id').single();
    if (error) {
      // 23505: otro pedido con la misma huella ganó por milisegundos. Se cuenta sobre ésa.
      if (error.code === '23505') return registrarError(crudo, quien, ahora);
      console.error(`[errores-app] no pude guardar ${huella}: ${error.message}`);
      return { ok: false, motivo: 'falla' };
    }
    const ticketId = await abrirTicket(r, huella, quien, 1, false);
    if (ticketId) await db.from(T).update({ ticket_id: ticketId }).eq('id', nueva.id);
    return { ok: true, huella, nuevo: true, ticketId };
  } catch (e) {
    console.error('[errores-app] registrarError:', e instanceof Error ? e.message : String(e));
    return { ok: false, motivo: 'falla' };
  }
}

/** Los negocios que vieron el error de un ticket (para avisarles cuando esté arreglado). La plataforma no cuenta. */
export async function negociosAfectados(ticketId: number): Promise<number[]> {
  const { data } = await getSupabaseServer().from(T).select('afectados').eq('ticket_id', ticketId);
  const plataforma = await wsSuperAdmin().catch(() => null);
  const ws = new Set<number>();
  for (const f of data ?? []) for (const a of leerAfectados(f.afectados)) if (a.ws > 0 && a.ws !== plataforma) ws.add(a.ws);
  return [...ws];
}
