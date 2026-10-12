// =============================================================================
// El aviso del lead QUIETO, del lado del server (#800)
// =============================================================================
// Una vez por día y por negocio: los leads que pasaron el plazo que el dueño le puso a su
// etapa, en UN mensaje. Las reglas viven en lib/lead-quieto.ts (puro, con test); acá sólo se
// lee la base y se emite.
//
// ⚠️ NO MIRA `crm_auto_enabled`. El CRM automático MUEVE leads y por eso nace apagado por
// cliente; esto no toca a nadie: le avisa al dueño. El que lo prende es él, poniéndole un
// plazo a una etapa — sin ningún plazo declarado no se lee ni un lead y no sale nada.
//
// ⚠️ CORRE DESPUÉS DEL CRM AUTOMÁTICO (app/api/cron/crm-automatico): lo que el motor acaba de
// mover ya no está quieto, y contarlo dos veces sería avisar de un lead que ya se atendió.
//
// ⚠️ DESDE EL 12/10/2026 NO HAY PANTALLA QUE PONGA UN PLAZO. La pastilla «Plazo» del pop-up de
// etapas (app/crm/EtapasModal.tsx) se fue con el punto 4 del feedback: «Elimina lo de "Ponerle
// un plazo", para eso ya tenemos la tab de "Automations"... como una automatización que se lo
// pase a otra etapa». Lo que quedó, a propósito, y por eso este aviso está INERTE y no muerto:
//   · la op `plazo` de `editarEtapaAction` (app/crm/actions.ts), sin call site en la app;
//   · este aviso y su cron, que sólo leen leads si hay algún plazo guardado;
//   · los plazos que YA estaban guardados (`funnels.data.umbrales.porEtapa`): siguen avisando, y
//     también los leen el CRM automático (T2 y T6, lib/crm-auto-plan.ts) y MaKo Mobile
//     (lib/crm-movil.ts). Ya no hay dónde verlos ni sacarlos: el aviso se apaga desde
//     Notificaciones (`crm-lead-quieto`). Borrar el backend, o limpiar esos plazos, es una
//     decisión que no se tomó acá.
// =============================================================================

import 'server-only';
import { pipelineStageOf, type StageDerivable } from './pipeline';
import { funnelsConUmbrales, productosPorFunnel } from './funnels';
import { getTenantDb, runWithWorkspace, listarWorkspaces } from './workspace';
import { leerTodo } from './supabase-paginado';
import { emitirDelCatalogo } from './avisos';
import { linkApp } from './app-url';
import { CAMPO_ETAPA } from './etapa-historial';
import { slotDeReunion } from './funnel-etapas';
import {
  plazosValidos, entradaALaEtapa, relojDesde, leadsQuietos, textoLeadsQuietos,
  type EnEtapa, type PlazosPorEtapa,
} from './lead-quieto';

export type ResultadoQuietos = {
  ws: number;
  ok: boolean;
  /** Etapas con plazo declarado (todas las de sus embudos). 0 = no se leyó ningún lead. */
  plazos?: number;
  /** Leads que pasaron su plazo. */
  quietos?: number;
  /** Los que no se pudo saber desde cuándo están en su etapa: no se afirma nada de ellos. */
  sinFecha?: number;
  /** Plazos guardados que no valen (etapa borrada, número roto). Quedan escritos, no se tiran. */
  descartes?: string[];
  aviso?: boolean;
  /** Sólo en modo prueba (`dry`): el texto que habría salido. */
  texto?: string | null;
  error?: string;
};

type FilaLead = StageDerivable & {
  id: number | string; nombre: string | null; funnel_id: number | string | null;
  etapa_vista: string | null; created_at: string | null;
  junta_1_at: string | null; junta_2_at: string | null;
};

const COLS_LEAD = 'id, nombre, funnel_id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_realizada, etapa_vista, created_at';

/**
 * La fecha de la reunión que ESA etapa representa, si es una reunión con lugar (las dos
 * primeras: `slotDeReunion`). La primera cae a `fecha_agenda` como en el CRM automático (T1).
 */
function fechaDeReunion(l: FilaLead, stages: Parameters<typeof slotDeReunion>[0], etapa: string): string | null {
  const slot = slotDeReunion(stages, etapa);
  if (!slot) return null;
  return slot.cual === 'r1'
    ? (l.junta_1_at ?? l.fecha_junta_1 ?? l.fecha_agenda)
    : (l.junta_2_at ?? l.fecha_junta_2);
}

// El filtro `in` viaja en la URL: 200 ids por trozo la deja en ~1 KB (el mismo criterio que
// lib/etapa-historial.ts).
const TROZO = 200;

/** El aviso de UN negocio, dentro de su contexto. Nunca tira: el error vuelve en la fila. */
async function quietosDelWorkspace(ws: number, ahoraMs: number, dry = false): Promise<ResultadoQuietos> {
  const funnels = await funnelsConUmbrales();
  if (!funnels) return { ws, ok: false, error: 'no se pudieron leer los funnels' };

  const plazos = new Map<number, PlazosPorEtapa>();
  const etiquetas = new Map<number, Map<string, string>>();
  const etapasDe = new Map<number, NonNullable<typeof funnels>[number]['cfg']['stages']>();
  const descartes: string[] = [];
  let idDefault: number | null = null;
  for (const f of funnels) {
    if (f.esDefault) idDefault = f.id;
    etiquetas.set(f.id, new Map(f.cfg.stages.map((s) => [s.key, s.label])));
    etapasDe.set(f.id, f.cfg.stages);
    const v = plazosValidos(f.umbrales?.porEtapa, f.cfg.stages);
    descartes.push(...v.descartes.map((d) => `funnel ${f.id} · ${d}`));
    if (Object.keys(v.plazos).length) plazos.set(f.id, v.plazos);
  }
  const nPlazos = [...plazos.values()].reduce((s, p) => s + Object.keys(p).length, 0);
  // Sin un solo plazo no hay nada que mirar: ni una lectura de leads.
  if (!nPlazos) return { ws, ok: true, plazos: 0, quietos: 0, descartes };

  const plazoDe = (funnelId: number, etapa: string) => plazos.get(funnelId)?.[etapa] ?? null;
  const db = await getTenantDb();

  // ── La CASA de cada lead: su etapa sale de la derivación (puede no estar escrita) ──────
  const abiertos = await leerTodo<FilaLead>(db, 'leads', COLS_LEAD, { orden: 'id', eq: { estado_lead: 'abierto' } });
  const candidatos: Array<{ l: FilaLead; funnelId: number; etapa: string }> = [];
  for (const l of abiertos) {
    const funnelId = l.funnel_id != null ? Number(l.funnel_id) : idDefault;
    if (funnelId == null) continue;
    const etapa = pipelineStageOf(l);
    if (plazoDe(funnelId, etapa)) candidatos.push({ l, funnelId, etapa });
  }

  // La última fila `Etapa` de cada candidato. Ordenadas de la más nueva a la más vieja, la
  // primera que aparece por lead es la que vale.
  const ultima = new Map<number, { valor: string | null; at: string }>();
  const ids = candidatos.map((c) => Number(c.l.id));
  for (let i = 0; i < ids.length; i += TROZO) {
    const filas = await leerTodo<{ id: number; lead_id: number | string; valor_nuevo: string | null; created_at: string }>(
      db, 'lead_audit', 'id, lead_id, valor_nuevo, created_at', {
        orden: [{ col: 'created_at', asc: false }, { col: 'id', asc: false }],
        filtros: (q) => q.eq('campo', CAMPO_ETAPA).in('lead_id', ids.slice(i, i + TROZO)),
      },
    );
    for (const f of filas) {
      const k = Number(f.lead_id);
      if (!ultima.has(k)) ultima.set(k, { valor: f.valor_nuevo, at: f.created_at });
    }
  }

  const items: EnEtapa[] = candidatos.map(({ l, funnelId, etapa }) => ({
    leadId: Number(l.id), nombre: l.nombre?.trim() || `Lead ${l.id}`, funnelId, etapa,
    desde: relojDesde(
      entradaALaEtapa({ etapa, etapaVista: l.etapa_vista, ultimaEtapa: ultima.get(Number(l.id)), creadoEn: l.created_at }),
      fechaDeReunion(l, etapasDe.get(funnelId), etapa),
    ),
  }));

  // ── Los productos AGREGADOS: la fila de `lead_funnel` sí sabe desde cuándo está ─────────
  const funnelsConPlazo = [...plazos.keys()];
  const filasLf = await leerTodo<{ id: number; lead_id: number | string; funnel_id: number | string; etapa: string | null; etapa_desde: string | null }>(
    db, 'lead_funnel', 'id, lead_id, funnel_id, etapa, etapa_desde', { orden: 'id', filtros: (q) => q.in('funnel_id', funnelsConPlazo) },
  );
  const agregados = filasLf.filter((f) => f.etapa && plazoDe(Number(f.funnel_id), f.etapa));
  if (agregados.length) {
    const nombres = new Map<number, { nombre: string | null; estado: string | null }>();
    const idsAg = [...new Set(agregados.map((f) => Number(f.lead_id)))];
    for (let i = 0; i < idsAg.length; i += TROZO) {
      const ls = await leerTodo<{ id: number | string; nombre: string | null; estado_lead: string | null }>(
        db, 'leads', 'id, nombre, estado_lead', { orden: 'id', filtros: (q) => q.in('id', idsAg.slice(i, i + TROZO)) },
      );
      for (const l of ls) nombres.set(Number(l.id), { nombre: l.nombre, estado: l.estado_lead });
    }
    for (const f of agregados) {
      const lead = nombres.get(Number(f.lead_id));
      if (!lead) continue;
      items.push({
        leadId: Number(f.lead_id), nombre: lead.nombre?.trim() || `Lead ${f.lead_id}`,
        funnelId: Number(f.funnel_id), etapa: f.etapa!, desde: f.etapa_desde,
      });
    }
  }

  const quietos = leadsQuietos(items, plazoDe, ahoraMs);
  const sinFecha = items.filter((it) => !it.desde).length;
  // Con más de un embudo en juego, la etapa sola no alcanza: «Agenda R2» puede existir en dos.
  const variosEmbudos = new Set(quietos.map((q) => q.funnelId)).size > 1;
  // ⚠️ EL NOMBRE ES EL DEL PRODUCTO: todos los embudos se llaman «Funnel principal» por la
  // migración 0170, y es el producto lo que el dueño ve en el desplegable del CRM.
  const productos = variosEmbudos ? await productosPorFunnel([...new Set(quietos.map((q) => q.funnelId))]) : new Map<number, string>();
  const etiqueta = (funnelId: number, etapa: string) => ({
    etapa: etiquetas.get(funnelId)?.get(etapa) ?? etapa,
    embudo: variosEmbudos ? (productos.get(funnelId)?.trim() || null) : null,
  });
  const texto = textoLeadsQuietos(quietos, etiqueta, linkApp('/crm', ws));
  if (!texto) return { ws, ok: true, plazos: nPlazos, quietos: 0, sinFecha, descartes };
  if (dry) return { ws, ok: true, plazos: nPlazos, quietos: quietos.length, sinFecha, descartes, texto };

  // ⚠️ VA `texto` Y NO `contexto`: con `contexto` un modelo redacta el mensaje, y un dato
  // exacto que pasa por un LLM deja de ser exacto. El dedup de ~20 h convierte las nueve
  // corridas del cron en un mensaje por día.
  const r = await emitirDelCatalogo('crm-lead-quieto', { ws, texto, dedupTtlMin: 1200 });
  return { ws, ok: true, plazos: nPlazos, quietos: quietos.length, sinFecha, descartes, aviso: r.ok && !r.deduped };
}

/**
 * El aviso en cada negocio activo (o sólo en `soloWs`). Cada negocio falla por su cuenta y lo
 * dice en su fila: uno caído no le corta el aviso a los demás.
 *
 * `dry` calcula y devuelve el texto sin mandar nada (el `?dry=1` del cron).
 *
 * `hastaMs` es el techo de tiempo de la corrida: lo que no entra queda para la hora siguiente
 * (el cron corre nueve veces por día y el aviso sale una).
 */
export async function avisarLeadsQuietosTodos(opts?: { soloWs?: number; hastaMs?: number; dry?: boolean }): Promise<ResultadoQuietos[]> {
  let workspaces: Array<{ id: number; estado?: string }>;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    return [{ ws: 0, ok: false, error: `no se pudieron listar los negocios: ${e instanceof Error ? e.message : String(e)}` }];
  }
  if (opts?.soloWs != null) workspaces = workspaces.filter((w) => w.id === opts.soloWs);
  const out: ResultadoQuietos[] = [];
  for (const w of workspaces) {
    if (opts?.hastaMs && Date.now() > opts.hastaMs) {
      out.push({ ws: w.id, ok: true, error: 'sin tiempo en esta corrida: queda para la próxima' });
      continue;
    }
    try {
      out.push(await runWithWorkspace(w.id, () => quietosDelWorkspace(w.id, Date.now(), opts?.dry === true)));
    } catch (e) {
      out.push({ ws: w.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
