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
  listarEventosDeAgenda, vincularEvento, desvincularEvento,
  type AgendaDelNegocio, type ResultadoVincular, type ResultadoDesvincular,
} from '@/lib/agenda-evento-etapa-server';
import type { ProveedorAgenda } from '@/lib/agenda-evento-etapa';

export type { AgendaDelNegocio, EventoDeAgenda, EtapaVinculable } from '@/lib/agenda-evento-etapa-server';

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
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    return { ok: true, ...(await listarEventosDeAgenda()) };
  } catch (e) {
    console.error('[agenda-evento] listar:', msg(e));
    return { ok: false, error: 'No pude leer los eventos de tu agenda. Intenta de nuevo.' };
  }
}

/** Vincula un evento a una etapa de reunión. Un evento va a UNA sola etapa: el segundo vínculo se rechaza. */
export async function vincularEventoEtapaAction(input: { proveedor: ProveedorAgenda; identificador: string; funnelId: number; etapa: string }): Promise<ResultadoVincular> {
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
