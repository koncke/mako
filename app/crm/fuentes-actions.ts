'use server';

// =============================================================================
// fuentes-actions — la pestaña «Formularios» de «Asignar fuentes» y sus reglas de calificación (20/11/2026)
// =============================================================================
// Las puertas de la PANTALLA: ponen la sesión y el rol y llaman a lib/fuentes-crm-server.ts, que es la implementación que usa
// también la API de MaKo (listar_formularios, asignar_formulario, ver_reglas_formulario, guardar_reglas_formulario y
// reaplicar_reglas_formulario, lib/api-mako/areas/crm.*). Leer: cualquier sesión del negocio. Cambiar: sólo su admin (como las
// campañas de Meta, app/crm/campanas-actions.ts).
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md). Los tipos, sí (se borran al compilar).
// =============================================================================

import { getRolWsEfectivo } from '@/lib/workspace';
import { exigirSesion } from '@/lib/sesion-accion';
import {
  formulariosDelFunnel, alternarFormulario, reglasDelFormulario, guardarReglasDeFormulario, reaplicarReglasDeFormulario,
  type EstadoFormularios, type EstadoReglas, type ResultadoReaplicar,
} from '@/lib/fuentes-crm-server';
import type { ReglasFormulario } from '@/lib/calificacion-formulario';

export type { FormularioFila, EstadoFormularios, EstadoReglas } from '@/lib/fuentes-crm-server';

const SOLO_ADMIN = 'Sólo el administrador del negocio puede cambiar las fuentes.';

/** Los formularios de los tres tipos, para la pestaña «Formularios». */
export async function formulariosAction(funnelId: number | null): Promise<EstadoFormularios | { ok: false; error: string }> {
  await exigirSesion();
  return formulariosDelFunnel(funnelId);
}

/** Prende o apaga UN formulario en este funnel. Sólo el admin. */
export async function alternarFormularioAction(funnelId: number | null, fuente: { clave: string; nombre: string }, prendido: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  const r = await alternarFormulario(funnelId, fuente, prendido === true);
  return r.ok ? { ok: true } : r;
}

/** Lo que necesita el editor de reglas de un formulario en este funnel. */
export async function reglasAction(funnelId: number | null, clave: string): Promise<EstadoReglas | { ok: false; error: string }> {
  await exigirSesion();
  return reglasDelFormulario(funnelId, clave);
}

/** Guarda las reglas de un formulario en este funnel. Sólo el admin. */
export async function guardarReglasAction(funnelId: number | null, clave: string, nombre: string, reglas: ReglasFormulario): Promise<{ ok: true; reglas: ReglasFormulario } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  const r = await guardarReglasDeFormulario(funnelId, clave, nombre, reglas);
  return r.ok ? { ok: true, reglas: r.reglas } : r;
}

/** Pasa las reglas guardadas por los leads que ya entraron (con `simular`, sólo cuenta). Sólo el admin. */
export async function reaplicarAction(funnelId: number | null, clave: string, simular: boolean): Promise<ResultadoReaplicar> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  return reaplicarReglasDeFormulario(funnelId, clave, simular === true);
}
