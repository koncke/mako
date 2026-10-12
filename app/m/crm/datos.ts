// =============================================================================
// /m/crm — lo que LEE la v2 (server): la lista en tres grupos, el filtro por etapa y la ficha
// =============================================================================
// Ninguna regla propia: cada pieza es la lectura que ya usa el escritorio, recortada a lo que
// el teléfono dibuja (~30 filas compactas; la cartera nunca baja al teléfono).
//
//   · Hoy           → reunionesDeHoy (lib/crm-movil.ts: getJuntasProximas + la hora de
//                     junta_N_at en la zona del negocio), sólo las de HOY.
//   · Por responder → getConversacionesNoOficial (lib/evolution-mensajes.ts), la MISMA lectura
//                     de la bandeja de WhatsApp de escritorio y del «sin responder» de MaKo: el
//                     último mensaje del chat es del lead. Sin ocultos ni bloqueados, sólo chats
//                     con lead, de los últimos 7 días.
//   · Nuevos        → la cartera (listLeads, cacheada) con la etapa del TABLERO de escritorio
//                     (mapToCrmLead + etapasDelTablero): los de los últimos 7 días que siguen en
//                     la etapa de ENTRADA del funnel del negocio.
//   · Filtro        → el tablero del negocio entero (listLeadsDeFunnel(null), lo mismo que /crm
//                     sin ?funnel=), contado por la columna en la que lo dibuja el tablero.
//   · Ficha         → fichaMovil (lib/crm-movil.ts) + el historial con autor de escritorio
//                     (getLeadAuditAction) para las notas y la actividad.
//
// «No pude leer» y «no hay nada» son dos respuestas: cada grupo vuelve null cuando su lectura
// falló, y la pantalla lo dice distinto de un vacío.
// =============================================================================

import 'server-only';
import { getWorkspaceActual } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { reunionesDeHoy, rotuloSinTexto, fichaMovil, type FichaMovil } from '@/lib/crm-movil';
import { getConversacionesNoOficial } from '@/lib/evolution-mensajes';
import { listLeads, listLeadsDeFunnel, getLead, type Lead } from '@/lib/leads';
import { getPipelineStagesDefault } from '@/lib/funnels';
import { generateFunnel, DEFAULT_PIPELINE, type Stage } from '@/lib/pipeline';
import { getCampaignNameMap } from '@/lib/queries';
import { etapasDeProducto } from '@/lib/lead-funnel';
import { mapToCrmLead, etapasDelTablero } from '@/app/crm/crm-map';
import { canalDeLead } from '@/app/crm/origen-lead';
import { getLeadAuditAction } from '@/app/crm/actions';
import {
  cuandoEnLista, etapaEnTablero, haceCuanto, lineaActividad, llegoPor, proximaLlamada,
  FUERA_DE_ACTIVIDAD, NOMBRE_REUNION, type LineaActividad,
} from './reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const SIETE_DIAS = 7 * 864e5;
/** Cuántas filas de cada grupo viajan al teléfono. */
const TOPE_GRUPO = 10;
/** Cuántas filas trae el filtro por etapa. Lo demás está en el kanban de la computadora. */
const TOPE_ETAPA = 40;

// ── La lista ──────────────────────────────────────────────────────────────────

/** Una fila de la lista: lo que se dibuja, ya armado en el server. */
export type FilaCrmM = { leadId: number; nombre: string; segunda: string | null; riel: string };

export type ListaCrmM = {
  /** null = no se pudo leer (distinto de una lista vacía). */
  hoy: FilaCrmM[] | null;
  porResponder: FilaCrmM[] | null;
  nuevos: FilaCrmM[] | null;
  /** Hay más nuevos que los que viajaron: «Ver todos» abre el filtro en la etapa de entrada. */
  masNuevos: boolean;
  /** La etapa de entrada del funnel del negocio (la del «Ver todos»). */
  entrada: { key: string; label: string } | null;
};

async function etapasDelNegocio(): Promise<Stage[]> {
  return getPipelineStagesDefault().catch(() => generateFunnel(DEFAULT_PIPELINE).stages);
}

/** El segundo renglón de un lead nuevo: por dónde llegó, o su empresa. */
function segundaDeNuevo(l: Lead, c: { canal: string; origin: string }): string | null {
  return llegoPor(c.canal, c.origin) ?? (l.empresa?.trim() || null);
}

/** La lista del CRM en el teléfono: tres grupos, cada uno con su propio fallo. Nunca tira. */
export async function listaCrm(): Promise<ListaCrmM> {
  const ws = await getWorkspaceActual();
  const [tz, hoy] = await Promise.all([
    ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
    hoyEnWorkspace(),
  ]);
  const ahora = Date.now();
  const cartera = listLeads();

  const leerHoy = async (): Promise<FilaCrmM[]> => {
    const rs = await reunionesDeHoy(hoy, tz);
    return rs.filter((r) => r.dia === 'hoy').slice(0, TOPE_GRUPO).map((r) => ({
      leadId: r.leadId, nombre: r.nombre, segunda: NOMBRE_REUNION[r.cual], riel: r.hora ?? 'Sin hora',
    }));
  };

  const leerPorResponder = async (): Promise<FilaCrmM[]> => {
    const [convs, leads] = await Promise.all([getConversacionesNoOficial(600, false), cartera.catch(() => [] as Lead[])]);
    const nombres = new Map(leads.map((l) => [l.id, l.nombre?.trim() || null]));
    const vistos = new Set<number>();
    const out: FilaCrmM[] = [];
    // Vienen de la más reciente a la más vieja.
    for (const c of convs) {
      if (!c.ultimoEntrante || c.leadId == null || c.bloqueado || !c.ultimaFecha) continue;
      if (ahora - Date.parse(c.ultimaFecha) > SIETE_DIAS) continue;
      if (vistos.has(c.leadId)) continue;
      vistos.add(c.leadId);
      out.push({
        leadId: c.leadId,
        nombre: nombres.get(c.leadId) || c.nombre || 'Sin nombre',
        segunda: c.ultimoTexto?.trim() || rotuloSinTexto(c.ultimoTipo),
        riel: haceCuanto(c.ultimaFecha, ahora, tz, hoy),
      });
      if (out.length === TOPE_GRUPO) break;
    }
    return out;
  };

  const leerNuevos = async (): Promise<{ filas: FilaCrmM[]; mas: boolean; entrada: { key: string; label: string } | null }> => {
    const [leads, stages, campMap] = await Promise.all([cartera, etapasDelNegocio(), getCampaignNameMap().catch(() => ({}) as Record<string, string>)]);
    const tablero = etapasDelTablero(stages);
    const keys = stages.map((s) => s.key);
    const entradaKey = tablero.entrada ?? null;
    const entrada = entradaKey ? { key: entradaKey, label: stages.find((s) => s.key === entradaKey)?.label ?? entradaKey } : null;
    const filas: FilaCrmM[] = [];
    let mas = false;
    // listLeads viene ordenada por created_at, de la más nueva a la más vieja.
    for (const l of leads) {
      const t = Date.parse(l.created_at ?? '');
      if (!Number.isFinite(t) || ahora - t > SIETE_DIAS) break;
      const c = mapToCrmLead(l, campMap, tablero);
      if (etapaEnTablero(c.stage, keys) !== entradaKey) continue;
      if (filas.length === TOPE_GRUPO) { mas = true; break; }
      filas.push({ leadId: l.id, nombre: l.nombre?.trim() || 'Sin nombre', segunda: segundaDeNuevo(l, c), riel: cuandoEnLista(l.created_at, tz, hoy) });
    }
    return { filas, mas, entrada };
  };

  const [h, p, n] = await Promise.allSettled([leerHoy(), leerPorResponder(), leerNuevos()]);
  for (const [nombre, x] of [['hoy', h], ['por responder', p], ['nuevos', n]] as const) {
    if (x.status === 'rejected') console.error(`[m/crm] ${nombre}: ${msg(x.reason)}`);
  }
  return {
    hoy: h.status === 'fulfilled' ? h.value : null,
    porResponder: p.status === 'fulfilled' ? p.value : null,
    nuevos: n.status === 'fulfilled' ? n.value.filas : null,
    masNuevos: n.status === 'fulfilled' && n.value.mas,
    entrada: n.status === 'fulfilled' ? n.value.entrada : null,
  };
}

// ── El filtro por etapa ───────────────────────────────────────────────────────

export type EtapaConteoM = { key: string; label: string; n: number };
export type PorEtapaM = { etapas: EtapaConteoM[]; total: number; filas: FilaCrmM[]; hayMas: boolean };

/**
 * Las columnas del tablero del negocio con cuántos leads dibuja cada una y, si se pide una
 * etapa, sus primeros leads (los más nuevos primero, como el tablero).
 */
export async function porEtapa(key: string | null): Promise<PorEtapaM> {
  const ws = await getWorkspaceActual();
  const [leads, stages, campMap, tz, hoy] = await Promise.all([
    listLeadsDeFunnel(null),
    etapasDelNegocio(),
    getCampaignNameMap().catch(() => ({}) as Record<string, string>),
    ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
    hoyEnWorkspace(),
  ]);
  const tablero = etapasDelTablero(stages);
  const keys = stages.map((s) => s.key);
  const conteo = new Map<string, number>();
  const filas: FilaCrmM[] = [];
  let hayMas = false;
  for (const l of leads) {
    const c = mapToCrmLead(l, campMap, tablero);
    const k = etapaEnTablero(c.stage, keys);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
    if (key && k === key) {
      if (filas.length === TOPE_ETAPA) { hayMas = true; continue; }
      filas.push({ leadId: l.id, nombre: l.nombre?.trim() || 'Sin nombre', segunda: segundaDeNuevo(l, c), riel: cuandoEnLista(l.created_at, tz, hoy) });
    }
  }
  return {
    etapas: stages.map((s) => ({ key: s.key, label: s.label, n: conteo.get(s.key) ?? 0 })),
    total: leads.length,
    filas,
    hayMas,
  };
}

// ── La ficha ──────────────────────────────────────────────────────────────────

export type NotaM = { id: number; texto: string; cuando: string; autor: string };
export type ActividadM = LineaActividad & { id: number; riel: string };

export type FichaV2 = {
  f: FichaMovil;
  /** «Hoy, 10:30» / null = sin agendar. */
  proxima: string | null;
  llegoPor: string | null;
  /** Las últimas notas (las del historial, con el nombre de quien la escribió), hasta 20. */
  notas: NotaM[];
  /** Cuántas hay en total (puede ser más que las que viajan). */
  totalNotas: number;
  actividad: ActividadM[];
};

/** Las notas que viajan (la ficha dibuja 3 y el resto abre en un sheet); las más viejas, en el historial de escritorio. */
const TOPE_NOTAS = 20;
const TOPE_ACTIVIDAD = 4;

/** La ficha en LECTURA. null = el lead no es de este workspace (o no existe). */
export async function fichaV2(leadId: number): Promise<FichaV2 | null> {
  const f = await fichaMovil(leadId);
  if (!f) return null;
  const casa = f.casa ?? f.productos[0] ?? null;
  const [lead, audit, stages] = await Promise.all([
    getLead(leadId).catch(() => null),
    getLeadAuditAction(leadId).catch((e) => { console.error(`[m/crm] historial ${leadId}: ${msg(e)}`); return []; }),
    casa ? etapasDeProducto(casa.funnelId).catch(() => []) : Promise.resolve([]),
  ]);
  const etiqueta = (v: string) => stages.find((s) => s.key === v)?.label ?? stages.find((s) => s.label === v)?.label;
  const ahora = Date.now();
  const notasTodas = audit.filter((r) => r.campo === 'Nota' && (r.valor_nuevo ?? '').trim());
  const notas = notasTodas.slice(0, TOPE_NOTAS).map((r) => ({
    id: r.id, texto: (r.valor_nuevo ?? '').trim(), cuando: cuandoEnLista(r.created_at, f.tz, f.hoy), autor: r.autor_nombre,
  }));
  const actividad = audit
    .filter((r) => !FUERA_DE_ACTIVIDAD.has(r.campo))
    .slice(0, TOPE_ACTIVIDAD)
    .map((r) => ({ id: r.id, ...lineaActividad(r.campo, r.valor_nuevo, etiqueta), riel: cuandoEnLista(r.created_at, f.tz, f.hoy) }));

  return {
    f,
    proxima: proximaLlamada(f.reuniones, ahora, f.tz, f.hoy)?.texto ?? null,
    llegoPor: llegoPor(lead ? canalDeLead(lead) : f.origen.canal, f.origen.anuncio || f.origen.campana),
    notas,
    totalNotas: notasTodas.length,
    actividad,
  };
}
