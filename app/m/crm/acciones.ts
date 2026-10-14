'use server';

// =============================================================================
// /m/crm — las acciones del CRM en el teléfono
// =============================================================================
// Puertas FINAS. Cada escritura delega en la de escritorio (app/crm/actions.ts,
// lib/lead-funnel.ts); lo que esta puerta agrega, y por qué no se llaman directo:
//   1. QUIÉN PUEDE: sesión + la MISMA regla del Sidebar para la tab CRM (puedeVerKey).
//      Una server action no hereda el guard de la página que la monta.
//   2. LO QUE EL TELÉFONO NO HACE, la acción tampoco: mover a una etapa que pide wizard,
//      a Ganado o a una de cobro se rechaza del lado del server (seMueveEnElTelefono),
//      no sólo escondiendo el botón. Y nunca manda los toques de Meta (calificado,
//      asistencia): son conversiones que no se deshacen.
//   3. UN AGREGADO SE MUEVE EN SU PRODUCTO (moverEtapaEnProducto), NUNCA con
//      setLeadStageAction: eso le tocaría la etapa, el estado, el monto y el CAPI a la CASA.
//   4. LA NOTA SE RELEE: logLeadEvent se traga el error del insert y addLeadNoteAction no
//      verifica que el lead sea de este workspace. Se chequea el lead antes y se relee
//      después: «Nota guardada» sólo si la nota está.
//   5. refresh(): las de escritorio revalidan /crm, no la pantalla del teléfono.
//
// v2 (11/10/2026) tuvo porEtapaAction (el filtro por etapa de la lista); la v3 (14/10/2026) la
// borró con la lista: el CRM del teléfono es el tablero, y mover va por moverEtapaAction.
//
// Agendar NO pasa por aquí: el sheet llama directo a reagendarReunionAction,
// duracionReunionAction, huecosR2Action, reservarR2Action y linkDeAgendaAction
// (app/crm), y la página que lo monta declara maxDuration = 60.
//
// ⚠️ 'use server' EXPORTA SÓLO FUNCIONES ASYNC. Los tipos de los resultados se
// escriben inline (no hay módulo de datos que exportar desde aquí).
// =============================================================================

import { refresh } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { puedeVerKey } from '@/lib/movil-rutas';
import { getLead } from '@/lib/leads';
import { productosDelLead, etapasDeProducto, moverEtapaEnProducto } from '@/lib/lead-funnel';
import { idDelFunnelDefault } from '@/lib/funnels';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { buscarLeads, notasDeLead } from '@/lib/crm-movil';
import { comoLite, seMueveEnElTelefono, MIN_BUSQUEDA, type EtapaM, type FilaLeadM } from './reglas';
import { addLeadNoteAction, setLeadStageAction, undoStageMoveAction } from '@/app/crm/actions';
import { TOPE_NOTA } from '@/app/crm/notas-reglas';

/** null = puede; si no, el motivo corto (para un toast). */
async function noPuede(): Promise<string | null> {
  try {
    if (!(await getUsuarioActual())) return 'Sesión vencida';
    const [rol, capa] = await Promise.all([getRolWsEfectivo(), getCapaActual()]);
    if (!puedeVerKey('crm', rol, capa)) return 'Sin acceso al CRM';
    return null;
  } catch {
    return 'Sesión vencida';
  }
}

const idOk = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const corto = (e: unknown, def: string) => {
  const m = e instanceof Error ? e.message : '';
  return m && m.length <= 90 ? m : def;
};

/** El buscador: ~20 filas compactas, filtradas en el server. */
export async function buscarLeadsAction(q: string): Promise<{ ok: true; filas: FilaLeadM[]; hayMas: boolean } | { ok: false; error: string }> {
  const no = await noPuede();
  if (no) return { ok: false, error: no };
  const query = String(q ?? '').slice(0, 120);
  if (query.trim().length < MIN_BUSQUEDA) return { ok: true, filas: [], hayMas: false };
  try {
    const r = await buscarLeads(query);
    return { ok: true, ...r };
  } catch (e) {
    console.error(`[m/crm] buscar: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude buscar' };
  }
}

type Nota = { id: number; texto: string; cuando: string; autor: string };

/** Agrega una nota y la RELEE. ok sólo si la nota quedó escrita. */
export async function notaLeadAction(leadId: number, texto: string): Promise<{ ok: true; notas: Nota[] } | { ok: false; error: string }> {
  const no = await noPuede();
  if (no) return { ok: false, error: no };
  // ⚠️ SE RECHAZA, NO SE RECORTA (13/10/2026). Acá se cortaba a 4000 ANTES de llamar a
  // addLeadNoteAction, así que su rechazo por largo nunca llegaba: el teléfono guardaba sólo el
  // principio y contestaba que quedó. El tope es el mismo del alta (app/crm/notas-reglas.ts).
  const t = String(texto ?? '').trim();
  if (!idOk(leadId)) return { ok: false, error: 'Falta el lead' };
  if (!t) return { ok: false, error: 'Nota vacía' };
  if (t.length > TOPE_NOTA) return { ok: false, error: 'La nota es muy larga' };
  try {
    if (!(await getLead(leadId))) return { ok: false, error: 'Ese lead no está' };
    const desde = Date.now() - 60_000;
    await addLeadNoteAction(leadId, t);
    const notas = await notasDeLead(leadId);
    const quedo = notas.some((n) => n.texto.trim() === t && Date.parse(n.cuando) >= desde);
    refresh();
    return quedo ? { ok: true, notas } : { ok: false, error: 'No se guardó' };
  } catch (e) {
    console.error(`[m/crm] nota ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No se guardó' };
  }
}

type ResMover = { ok: true; antes: string; esCasa: boolean; pendientes: string[] } | { ok: false; error: string };

/**
 * Mueve el lead a `etapa` en el producto `funnelId` (null = el del negocio). Decide en
 * el server si es la CASA (setLeadStageAction) o un AGREGADO (moverEtapaEnProducto), y
 * devuelve lo necesario para deshacer.
 */
export async function moverEtapaAction(leadId: number, funnelId: number | null, etapa: string): Promise<ResMover> {
  const no = await noPuede();
  if (no) return { ok: false, error: no };
  if (!idOk(leadId) || typeof etapa !== 'string' || !etapa) return { ok: false, error: 'Falta la etapa' };
  try {
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, error: 'Ese lead no está' };
    const { productos, defaultId, etapaCasa } = await productosDelLead(leadId);
    const fid = funnelId ?? defaultId;
    const prod = productos.find((p) => p.funnelId === fid);
    if (fid == null || !prod) return { ok: false, error: 'No está en ese funnel' };
    const stages = (await etapasDeProducto(fid)) as EtapaM[];
    if (!seMueveEnElTelefono(stages, etapa)) return { ok: false, error: 'Esa, en la computadora' };

    if (!prod.esCasa) {
      const r = await moverEtapaEnProducto(leadId, fid, etapa);
      refresh();
      return { ok: true, antes: r.antes, esCasa: false, pendientes: [] };
    }
    const antes = etapaCasa && stages.some((s) => s.key === etapaCasa) ? etapaCasa : etapaVigenteDe(lead, comoLite(stages));
    if (antes === etapa) return { ok: false, error: 'Ya está ahí' };
    // Sin opts: el teléfono NUNCA manda calificado ni asistencia (van a Meta y no se deshacen).
    const r = await setLeadStageAction(leadId, etapa);
    refresh();
    if (!r.ok) return { ok: false, error: r.mensaje?.slice(0, 90) || 'No se pudo mover' };
    return { ok: true, antes, esCasa: true, pendientes: (r.pendientes ?? []).map((p) => p.label) };
  } catch (e) {
    console.error(`[m/crm] mover ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: corto(e, 'No se pudo mover') };
  }
}

/** El Deshacer del toast: vuelve a la etapa de antes, por el MISMO camino que movió. */
export async function deshacerMoverAction(leadId: number, funnelId: number | null, antes: string, esCasa: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await noPuede();
  if (no) return { ok: false, error: no };
  if (!idOk(leadId) || typeof antes !== 'string' || !antes) return { ok: false, error: 'Nada que deshacer' };
  try {
    if (esCasa) {
      await undoStageMoveAction(leadId, antes);
    } else {
      const fid = funnelId ?? (await idDelFunnelDefault());
      if (fid == null) return { ok: false, error: 'Nada que deshacer' };
      await moverEtapaEnProducto(leadId, fid, antes);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error(`[m/crm] deshacer ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No se pudo deshacer' };
  }
}
