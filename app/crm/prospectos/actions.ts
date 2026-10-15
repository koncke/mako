'use server';
// =============================================================================
// /crm/prospectos — las acciones de la lista de prospectos (Leads Scraper)
// =============================================================================
// ⚠️ ARCHIVO `'use server'`: SÓLO funciones async exportadas (AGENTS.md: una constante o un tipo
// con valor exportado acá tira el build con 125 errores). Lo que hace cada una vive en
// lib/prospectos.ts; acá queda quién puede y la invalidación de la pantalla.
//
// Quién puede: buscar CUESTA PLATA (la cuenta de Apify del negocio), así que es sólo admin. Ver la
// lista, descartar y pasar al CRM, cualquiera con acceso al CRM (el setter es quien prospecta).

import { revalidatePath } from 'next/cache';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { crearBusqueda, cambiarEstado, listarProspectos, pasarAlCrm, revisarPendientes, funnelDeEntrada, type ListaProspectos, type ResultadoPasar } from '@/lib/prospectos';
import { importarLeadsRevisadosAction } from '../actions';

async function exigirSesion(): Promise<'admin' | 'closer' | 'setter'> {
  const rol = await getRolWsEfectivo();
  if (!rol) throw new Error('Tu sesión venció. Vuelve a entrar.');
  return rol;
}

export async function buscarProspectosAction(crudo: unknown): Promise<{ ok: true; rotulo: string; techoUsd: number } | { ok: false; error: string; conectar?: 'apify' }> {
  const rol = await exigirSesion();
  if (rol !== 'admin') return { ok: false, error: 'Buscar prospectos se cobra en la cuenta de Apify del negocio: lo hace un admin.' };
  let autor: string | null = null;
  try { autor = (await getUsuarioActual())?.email ?? null; } catch { /* sin autor no se frena */ }
  const r = await crearBusqueda(crudo, autor);
  if (r.ok) revalidatePath('/crm/prospectos');
  return r.ok ? { ok: true, rotulo: r.rotulo, techoUsd: r.techoUsd } : r;
}

/** La lista, después de preguntar por las búsquedas que siguen corriendo (la red del aviso de Apify). */
export async function listarProspectosAction(): Promise<ListaProspectos> {
  await exigirSesion();
  await revisarPendientes();
  return listarProspectos();
}

export async function cambiarEstadoProspectosAction(ids: number[], estado: 'nuevo' | 'descartado'): Promise<{ cambiados: number }> {
  await exigirSesion();
  if (estado !== 'nuevo' && estado !== 'descartado') throw new Error('Estado inválido.');
  const cambiados = await cambiarEstado(Array.isArray(ids) ? ids : [], estado);
  revalidatePath('/crm/prospectos');
  return { cambiados };
}

/** El funnel al que van por defecto: el que declara «Prospección» (decisión 9), o el del negocio. */
export async function funnelDeProspeccionAction(): Promise<number | null> {
  await exigirSesion();
  return funnelDeEntrada('chat_saliente');
}

export async function pasarProspectosAlCrmAction(ids: number[], funnelId: number | null): Promise<ResultadoPasar> {
  await exigirSesion();
  const destino = funnelId == null ? null : Number(funnelId);
  const r = await pasarAlCrm(Array.isArray(ids) ? ids : [], Number.isInteger(destino) ? destino : null, importarLeadsRevisadosAction);
  revalidatePath('/crm/prospectos');
  revalidatePath('/crm');
  return r;
}
