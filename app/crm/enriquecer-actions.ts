'use server';

// =============================================================================
// Completar en LOTE desde el tablero — las acciones (24/10/2026)
// =============================================================================
// Lo que hacen está en ./enriquecer-lote-server.ts. Acá, la puerta: sesión y ADMIN del negocio, la misma que «Traer de un grupo»
// (los datos que se traen de WhatsApp son datos personales, y «Datos de empresa» gasta la red de la línea). Las usa la barra de
// lote, ./AccionesLoteLeads.tsx.

import { revalidatePath } from 'next/cache';
import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { autorDelMovimiento } from '@/lib/leads';
import type { ResultadoFichas, ResultadoPerfiles } from './grupo-wa-server';
import { completarFichasDeLeads, completarPerfilesDeLeads, idsLimpios, telefonosDeLeads } from './enriquecer-lote-server';

const SOLO_ADMIN = 'Sólo el administrador del negocio puede completar los datos en lote.';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** El teléfono de cada tildado, para pedirle a la extensión sus fichas (la extensión sólo lee los teléfonos que se le pasan). */
export async function telefonosDeLeadsAction(ids: number[]): Promise<{ ok: true; telefonos: Array<{ id: number; telefono: string }> } | { ok: false; error: string }> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try { return { ok: true, telefonos: await telefonosDeLeads(idsLimpios(ids)) }; } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Una tanda de fichas de SU WhatsApp Web, escrita sólo en los tildados (`ids`). Corta por tiempo: lo que falta, en `pendientes`. */
export async function completarFichasDeLeadsAction(p: { ids: number[]; fichas: unknown[] }): Promise<ResultadoFichas> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await completarFichasDeLeads({
      ids: idsLimpios(p.ids), fichas: Array.isArray(p.fichas) ? p.fichas : [], autor: await autorDelMovimiento(), hasta: Date.now() + 40_000,
    });
    if (r.ok && (r.nombres || r.empresas)) revalidatePath('/crm');
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/**
 * «Datos de empresa» sobre los tildados: con tope por día (lo cuenta el server; sin tope por corrida desde el 25/10). `soloContar`: la cuenta
 * que se muestra antes de consultar. Corta por tiempo: la barra vuelve a llamar con `hechas` y `saltear`.
 */
export async function completarPerfilesDeLeadsAction(p: { ids: number[]; hechas?: number; saltear?: string[]; soloContar?: boolean }): Promise<ResultadoPerfiles> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    const hechas = Number.isInteger(p.hechas) && (p.hechas as number) >= 0 ? (p.hechas as number) : 0;
    const saltear = (Array.isArray(p.saltear) ? p.saltear : []).filter((t) => typeof t === 'string');
    const r = await completarPerfilesDeLeads({
      ids: idsLimpios(p.ids), autor: await autorDelMovimiento(), hechas, saltear, soloContar: p.soloContar === true, hasta: Date.now() + 40_000,
    });
    if (r.ok && r.completados) revalidatePath('/crm');
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}
