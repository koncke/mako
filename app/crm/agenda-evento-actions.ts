'use server';

// =============================================================================
// agenda-evento-actions — vincular un evento de Calendly o Cal.com a una etapa de reunión
// =============================================================================
// Las puertas de la PANTALLA (el pop-up de etapas, app/crm/EtapasModal.tsx, que todavía no las usa:
// es el frente siguiente). La regla vive en lib/agenda-evento-etapa.ts y la base en
// lib/agenda-evento-etapa-server.ts, la misma que corre la API de MaKo (área crm:
// listar_eventos_agenda, vincular_evento_etapa, desvincular_evento_etapa). Acá sólo hay puertas:
// quién puede (el admin del negocio, el mismo corte que `editarEtapaAction`) y qué se devuelve.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos). Ver AGENTS.md.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import {
  listarEventosDeAgenda, vincularEvento, desvincularEvento, crearEventoDeAgenda, editarEventoDeAgenda, leerVinculos,
  type AgendaDelNegocio, type ResultadoVincular, type ResultadoDesvincular, type ResultadoEventoEscrito,
} from '@/lib/agenda-evento-etapa-server';
import type { ProveedorAgenda } from '@/lib/agenda-evento-etapa';
import { exigirSesion } from '@/lib/sesion-accion';

export type { AgendaDelNegocio, EventoDeAgenda, EtapaVinculable, ResultadoEventoEscrito } from '@/lib/agenda-evento-etapa-server';

const SOLO_ADMIN = 'Solo el administrador del workspace puede editar el funnel.';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function esAdmin(): Promise<boolean> {
  return (await getRolWsEfectivo()) === 'admin';
}

async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/** Los eventos de la agenda del negocio (Calendly y Cal.com), con su vínculo, y las etapas que se pueden vincular. */
export async function listarEventosAgendaAction(): Promise<({ ok: true } & AgendaDelNegocio) | { ok: false; error: string }> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    return { ok: true, ...(await listarEventosDeAgenda()) };
  } catch (e) {
    console.error('[agenda-evento] listar:', msg(e));
    return { ok: false, error: 'No pude leer los eventos de tu agenda. Intenta de nuevo.' };
  }
}

/**
 * Lo vinculado a UNA etapa, de la BASE (22/10/2026, Martín: «abrir el modal queda cargando mucho»): el pop-up lo muestra
 * al toque, mientras la lista de la agenda (que le pregunta a Calendly y a Cal.com) llega por `listarEventosAgendaAction`.
 */
export async function vinculadosDeEtapaAction(funnelId: number, etapa: string): Promise<{ ok: true; eventos: Array<{ proveedor: ProveedorAgenda; identificador: string; nombre: string }> } | { ok: false; error: string }> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const { vinculos } = await leerVinculos();
    return {
      ok: true,
      eventos: vinculos.filter((v) => v.funnelId === funnelId && v.etapa === etapa)
        .map((v) => ({ proveedor: v.proveedor, identificador: v.identificador, nombre: v.nombre || v.identificador })),
    };
  } catch (e) {
    console.error('[agenda-evento] vinculados:', msg(e));
    return { ok: false, error: 'No pude leer lo vinculado.' };
  }
}

/** Vincula un evento a una etapa de reunión. Un evento va a UNA sola etapa: el segundo vínculo se rechaza. */
export async function vincularEventoEtapaAction(input: { proveedor: ProveedorAgenda; identificador: string; funnelId: number; etapa: string }): Promise<ResultadoVincular> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await vincularEvento({ proveedor: input.proveedor, evento: input.identificador, funnelId: input.funnelId, etapa: input.etapa, autor: await autorActual() });
    if (r.ok && !r.yaEstaba) revalidatePath('/crm');
    return r;
  } catch (e) {
    console.error('[agenda-evento] vincular:', msg(e));
    return { ok: false, error: 'No se pudo vincular. Intenta de nuevo.' };
  }
}

/** Desvincula un evento: sus reservas vuelven a lo de antes (la R1/R2 de Integraciones y el funnel principal). */
export async function desvincularEventoEtapaAction(input: { proveedor: ProveedorAgenda; identificador: string }): Promise<ResultadoDesvincular> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await desvincularEvento({ proveedor: input.proveedor, evento: input.identificador });
    if (r.ok && r.cambio) revalidatePath('/crm');
    return r;
  } catch (e) {
    console.error('[agenda-evento] desvincular:', msg(e));
    return { ok: false, error: 'No se pudo desvincular. Intenta de nuevo.' };
  }
}

/**
 * Crea un evento en la agenda del negocio (21/10/2026, «que se pueda editar o crear eventos desde allí») y, con
 * `etapa`, lo vincula a esa etapa de reunión en el mismo gesto: se crea PARA asignarlo. Si crear sale y vincular no,
 * se dice: el evento ya existe en la cuenta y se marca a mano en la lista.
 */
export async function crearEventoAgendaAction(input: { proveedor: ProveedorAgenda; nombre: string; duracionMin: number; vincularA?: { funnelId: number; etapa: string } }): Promise<ResultadoEventoEscrito & { vinculado?: boolean; avisoVinculo?: string }> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  const r = await crearEventoDeAgenda(input);
  if (!r.ok || !input.vincularA) return r;
  try {
    const v = await vincularEvento({ proveedor: r.evento.proveedor, evento: r.evento.identificador, funnelId: input.vincularA.funnelId, etapa: input.vincularA.etapa, autor: await autorActual() });
    if (v.ok) revalidatePath('/crm');
    return v.ok ? { ...r, vinculado: true } : { ...r, vinculado: false, avisoVinculo: v.error };
  } catch (e) {
    console.error('[agenda-evento] crear y vincular:', msg(e));
    return { ...r, vinculado: false, avisoVinculo: 'Se creó, pero no se pudo asignar. Márcalo en la lista.' };
  }
}

/** Cambia el nombre o la duración de un evento de la agenda del negocio. */
export async function editarEventoAgendaAction(input: { proveedor: ProveedorAgenda; identificador: string; nombre?: string; duracionMin?: number }): Promise<ResultadoEventoEscrito> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  return editarEventoDeAgenda(input);
}
