// =============================================================================
// /m/crm — lo que LEE el CRM del teléfono (server): el tablero y la ficha
// =============================================================================
// Ninguna regla propia: cada pieza es la lectura que ya usa el escritorio, recortada a lo que
// el teléfono dibuja.
//
//   · Tablero → lo mismo que app/crm/page.tsx: el funnel de la URL validado contra los de este
//               workspace, sus etapas, sus leads en la columna en la que los dibuja CrmBoard
//               (mapToCrmLead + etapasDelTablero), el orden manual y la plata de cada columna.
//               Hasta 40 tarjetas por columna; el conteo dice el total (v3, 14/10/2026).
//   · Ficha   → fichaMovil (lib/crm-movil.ts) + el historial con autor de escritorio
//               (getLeadAuditAction) para las notas y la actividad.
//
// La lista de la v2 (Hoy · Por responder · Nuevos y el filtro por etapa) se borró con la v3: el
// CRM del teléfono es el tablero, y lo que espera respuesta vive en la pestaña Chats.
//
// «No pude leer» y «no hay nada» son dos respuestas: el tablero vuelve null cuando su lectura
// falló, y la pantalla lo dice distinto de una columna vacía.
// =============================================================================

import 'server-only';
import { getWorkspaceActual } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { fichaMovil, type FichaMovil } from '@/lib/crm-movil';
import { listLeadsDeFunnel, getLead } from '@/lib/leads';
import { getPipelineStagesDefault, getFunnelDe, listarFunnels } from '@/lib/funnels';
import { leerOrdenManual } from '@/lib/crm-orden';
import { ordenarKanbanManual } from '@/app/crm/orden-kanban';
import { totalDeColumna, textoDelTotal, plataCorta } from '@/app/crm/total-columna';
import { generateFunnel, DEFAULT_PIPELINE } from '@/lib/pipeline';
import { getCampaignNameMap } from '@/lib/queries';
import { etapasDeProducto } from '@/lib/lead-funnel';
import { mapToCrmLead, etapasDelTablero } from '@/app/crm/crm-map';
import { canalDeLead } from '@/app/crm/origen-lead';
import { getLeadAuditAction } from '@/app/crm/actions';
import {
  cuandoEnLista, etapaEnTablero, lineaActividad, llegoPor, proximaLlamada, seMueveEnElTelefono, seSacaEnElTelefono,
  FUERA_DE_ACTIVIDAD, type LineaActividad,
} from './reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

// ── El tablero (v3, 14/10/2026) ──────────────────────────────────────────────
// Martín: el CRM del teléfono es el TABLERO de escritorio, con menos cosas. Las mismas lecturas
// que app/crm/page.tsx: el funnel de la URL validado contra los de ESTE workspace (un id ajeno
// cae al del negocio, como en escritorio), sus etapas, sus leads con la columna en la que los
// dibuja CrmBoard (mapToCrmLead + etapasDelTablero), el orden manual de cada columna y la suma
// de plata de la columna (totalDeColumna). Las columnas van como las bandas de escritorio
// (pipeline → nutrición → salidas), en una sola fila.

/** Cuántas tarjetas viajan por columna. El conteo dice el total; el resto, en la computadora. */
const TOPE_COLUMNA = 40;

export type TarjetaCrmM = {
  id: number;
  col: string;
  nombre: string;
  /** La empresa o por dónde llegó. */
  segunda: string | null;
  cuando: string;
  /** El monto (o el estimado, con «≈»), corto. */
  plata: string | null;
};

export type TableroCrmM = {
  /** null = el funnel del negocio (como `leads.funnel_id`). */
  funnelId: number | null;
  /** El selector: el del negocio primero. Con uno solo, no hay selector. */
  funnels: Array<{ id: number | null; nombre: string }>;
  /** `movible`: se puede llevar un lead ACÁ desde el teléfono; `sale`: se puede sacar uno de acá. */
  columnas: Array<{ key: string; titulo: string; total: string | null; cuantos: number; movible: boolean; sale: boolean }>;
  tarjetas: TarjetaCrmM[];
};

const BANDA_ORDEN = ['pipeline', 'nutricion', 'salidas'];

/** El tablero de un funnel. null = no se pudo leer. */
export async function tableroCrm(funnelPedido: number | null): Promise<TableroCrmM | null> {
  try {
    const ws = await getWorkspaceActual();
    const [tz, hoy, funnels] = await Promise.all([
      ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
      hoyEnWorkspace(),
      listarFunnels().catch(() => []),
    ]);
    const funnelId = funnels.some((f) => f.id === funnelPedido && !f.esDefault) ? funnelPedido : null;
    const [leads, campMap, stagesRaw, orden] = await Promise.all([
      listLeadsDeFunnel(funnelId),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      (funnelId ? getFunnelDe(funnelId).then((f) => f.stages) : getPipelineStagesDefault()).catch(() => generateFunnel(DEFAULT_PIPELINE).stages),
      leerOrdenManual(funnelId),
    ]);
    const stages = [...stagesRaw].sort((a, b) =>
      (BANDA_ORDEN.indexOf(a.band ?? 'pipeline') - BANDA_ORDEN.indexOf(b.band ?? 'pipeline')) || ((a.col ?? 0) - (b.col ?? 0)));
    const tablero = etapasDelTablero(stages);
    // ⚠️ LA COLUMNA DE CADA LEAD SE CUENTA CON LAS ETAPAS EN EL ORDEN DEL FUNNEL, no en el de las
    // columnas: una etapa que el funnel ya no tiene cae a la PRIMERA (etapaEnTablero), y la primera
    // es la del funnel, la misma que usan CrmBoard y moverEtapaAction.
    const keys = stagesRaw.map((s) => s.key);
    // El más nuevo arriba (el orden de llegada de escritorio); después, el orden manual de cada columna.
    const crm = leads.map((l) => mapToCrmLead(l, campMap, tablero))
      .sort((a, b) => (Date.parse(b.createdISO ?? '') || 0) - (Date.parse(a.createdISO ?? '') || 0));
    const ordenados = ordenarKanbanManual(crm, (c) => c.id, (c) => etapaEnTablero(c.stage, keys), (e) => orden[e]);

    const porCol = new Map<string, typeof ordenados>(keys.map((k) => [k, []]));
    for (const c of ordenados) porCol.get(etapaEnTablero(c.stage, keys))?.push(c);

    const tarjetas: TarjetaCrmM[] = [];
    for (const [col, cs] of porCol) {
      for (const c of cs.slice(0, TOPE_COLUMNA)) {
        const monto = c.monto > 0 ? plataCorta(c.monto) : (c.ingresoEstimado ?? 0) > 0 ? `≈ ${plataCorta(c.ingresoEstimado ?? 0)}` : null;
        tarjetas.push({
          id: c.id, col, nombre: c.name?.trim() || 'Sin nombre',
          segunda: c.company?.trim() || llegoPor(c.canal, c.origin) || null,
          cuando: cuandoEnLista(c.createdISO, tz, hoy),
          plata: monto,
        });
      }
    }
    const lite = stages.map((s) => ({ key: s.key, label: s.label, kind: s.kind ?? null }));
    return {
      funnelId,
      funnels: [
        { id: null, nombre: funnels.find((f) => f.esDefault)?.producto?.trim() || funnels.find((f) => f.esDefault)?.nombre || 'Funnel principal' },
        ...funnels.filter((f) => !f.esDefault).map((f) => ({ id: f.id, nombre: f.producto?.trim() || f.nombre })),
      ],
      columnas: stages.map((s) => {
        const cs = porCol.get(s.key) ?? [];
        const t = totalDeColumna(s.key, cs);
        return {
          key: s.key, titulo: s.label, total: t ? textoDelTotal(t) : null, cuantos: cs.length,
          movible: seMueveEnElTelefono(lite, s.key), sale: seSacaEnElTelefono(lite, s.key),
        };
      }),
      tarjetas,
    };
  } catch (e) {
    console.error(`[m/crm] tablero: ${msg(e)}`);
    return null;
  }
}
