// =============================================================================
// mako-doer-acciones — el catálogo de ESCRITURAS del doer (punto 11) + confirmación
// =============================================================================
// MaKo NO ejecuta escrituras directo: las PROPONE. Cada tool `proponer_*` deja
// una acción pendiente (mako_acciones_pendientes, mig 0085) con vencimiento y
// devuelve un resumen para que MaKo pida el OK en el grupo. El dueño confirma con
// `confirmar_accion` → ahí recién se ejecuta la escritura REAL (ejecutarAccion),
// por los callers ya gateados (setPipelineStage, setSecuenciaActiva, metaWrite).
// Modelo de seguridad elegido: "Ejecuta con confirmación" + "pendiente con
// vencimiento" — un "sí" viejo o de otra charla nunca dispara algo por accidente.

import 'server-only';
import type { ToolDef, ToolRunner } from '@/lib/anthropic';
import { runWithWorkspace, getTenantDb, OWNER_WS } from '@/lib/workspace';
import { crearPendiente, resolverPendiente, pendientesVigentes } from '@/lib/mako-pendientes';
import { getLead, setPipelineStage, getFunnel } from '@/lib/leads';
import { getSecuenciasConStats, setSecuenciaActiva } from '@/lib/nutricion';
import { metaWrite, type MetaWriteBody } from '@/lib/meta-write';

// ── helpers de entrada ────────────────────────────────────────────────────────
function num(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v.trim() : '';
}
function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tijuana' });
  } catch { return iso; }
}

// ── dispatcher de la escritura REAL (se corre al confirmar) ───────────────────

export async function ejecutarAccion(ws: number, tipo: string, payload: Record<string, unknown>): Promise<{ ok: boolean; resumen: string }> {
  return runWithWorkspace(ws, async () => {
    switch (tipo) {
      case 'lead_etapa': {
        const leadId = Number(payload.leadId);
        const etapa = String(payload.etapa);
        const monto = payload.monto != null ? Number(payload.monto) : undefined;
        const motivo = payload.motivo != null ? String(payload.motivo) : undefined;
        await setPipelineStage(leadId, etapa, { monto: monto ?? null, motivo: motivo ?? null });
        return { ok: true, resumen: `Lead #${leadId} movido a la etapa '${etapa}'.` };
      }
      case 'nutricion_toggle': {
        const id = Number(payload.secuenciaId);
        const activa = Boolean(payload.activa);
        await setSecuenciaActiva(id, activa);
        return { ok: true, resumen: `Secuencia de nutrición #${id} ${activa ? 'activada' : 'pausada'}.` };
      }
      case 'meta_nombre':
      case 'meta_presupuesto':
      case 'meta_estado': {
        // Escribir a Meta es acción de la cuenta global del dueño (Fase 1).
        if (ws !== OWNER_WS) return { ok: false, resumen: 'Las campañas de Meta solo se editan desde el workspace principal por ahora.' };
        const id = String(payload.campaignId);
        let body: MetaWriteBody;
        if (tipo === 'meta_nombre') body = { level: 'campaign', id, op: 'name', name: String(payload.nombre) };
        else if (tipo === 'meta_presupuesto') body = { level: 'campaign', id, op: 'budget', dailyBudgetMxn: Number(payload.montoMxn) };
        else body = { level: 'campaign', id, op: 'status', status: payload.estado === 'ACTIVE' ? 'ACTIVE' : 'PAUSED' };
        const r = await metaWrite(body);
        if (!r.ok) return { ok: false, resumen: `Meta rechazó el cambio: ${r.message}` };
        if (tipo === 'meta_nombre') return { ok: true, resumen: `Campaña renombrada a "${payload.nombre}".` };
        if (tipo === 'meta_presupuesto') return { ok: true, resumen: `Presupuesto de la campaña puesto en $${payload.montoMxn} MXN/día.` };
        return { ok: true, resumen: `Campaña ${payload.estado === 'ACTIVE' ? 'activada' : 'pausada'}.` };
      }
      default:
        return { ok: false, resumen: `Acción desconocida: ${tipo}` };
    }
  });
}

// ── ToolDefs de acciones (lo que ve Claude) ───────────────────────────────────

export const MAKO_ACCION_TOOLS: ToolDef[] = [
  {
    name: 'listar_secuencias_nutricion',
    description: 'Lista las secuencias de nutrición del negocio con su id, nombre, etapa y si están activas o pausadas. Usala para saber el id antes de proponer activar/pausar una.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_campanas_meta',
    description: 'Lista las campañas de Meta Ads conocidas (id, nombre y gasto reciente), tomadas de las métricas ya sincronizadas. Usala para conseguir el id de una campaña antes de proponer renombrarla, cambiar su presupuesto o pausarla/activarla.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'proponer_cambio_etapa',
    description: 'PROPONE mover un lead a otra etapa del funnel (deja la acción pendiente de confirmación del dueño; NO la ejecuta). Conseguí el leadId con buscar_leads y la etapa con ver_funnel. Para etapas de cierre pasá monto; para perdido/descalificado, motivo.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'number', description: 'id del lead (de buscar_leads).' },
        etapa: { type: 'string', description: "key de la etapa destino (de ver_funnel), p.ej. 'agenda', 'manual', 'ganado', 'perdido'." },
        monto: { type: 'number', description: 'monto de cierre en USD (solo para etapa ganada).' },
        motivo: { type: 'string', description: 'motivo (solo para perdido/descalificado).' },
      },
      required: ['leadId', 'etapa'],
    },
  },
  {
    name: 'proponer_toggle_nutricion',
    description: 'PROPONE activar o pausar una secuencia de nutrición (deja la acción pendiente de confirmación; NO la ejecuta). Conseguí el secuenciaId con listar_secuencias_nutricion.',
    input_schema: {
      type: 'object',
      properties: {
        secuenciaId: { type: 'number', description: 'id de la secuencia (de listar_secuencias_nutricion).' },
        activa: { type: 'boolean', description: 'true para activar, false para pausar.' },
      },
      required: ['secuenciaId', 'activa'],
    },
  },
  {
    name: 'proponer_renombrar_campana',
    description: 'PROPONE renombrar una campaña de Meta Ads (deja la acción pendiente de confirmación; NO la ejecuta). Conseguí el campaignId con listar_campanas_meta.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'id numérico de la campaña (de listar_campanas_meta).' },
        nombre: { type: 'string', description: 'nombre nuevo.' },
      },
      required: ['campaignId', 'nombre'],
    },
  },
  {
    name: 'proponer_presupuesto_campana',
    description: 'PROPONE cambiar el presupuesto diario de una campaña de Meta Ads, en pesos MXN (deja la acción pendiente de confirmación; NO la ejecuta). Ojo: tocar el presupuesto afecta el gasto real de la cuenta.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'id numérico de la campaña (de listar_campanas_meta).' },
        montoMxn: { type: 'number', description: 'presupuesto diario en pesos MXN.' },
      },
      required: ['campaignId', 'montoMxn'],
    },
  },
  {
    name: 'proponer_estado_campana',
    description: 'PROPONE pausar o activar una campaña de Meta Ads (deja la acción pendiente de confirmación; NO la ejecuta).',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'id numérico de la campaña (de listar_campanas_meta).' },
        estado: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'ACTIVE para activar, PAUSED para pausar.' },
      },
      required: ['campaignId', 'estado'],
    },
  },
  {
    name: 'listar_pendientes',
    description: 'Lista las acciones que dejaste pendientes de confirmación en este grupo y que siguen vigentes (no vencidas). No requiere parámetros.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'confirmar_accion',
    description: 'EJECUTA una acción que estaba pendiente de confirmación, cuando el dueño te dio el OK ("sí", "dale", "confirmo"). Si hay una sola pendiente vigente podés omitir el id; si hay varias, pasá el id exacto (de listar_pendientes).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id de la acción pendiente a ejecutar (opcional si hay una sola).' } },
    },
  },
  {
    name: 'cancelar_accion',
    description: 'Cancela una acción pendiente (el dueño dijo que no, o cambió de idea). Si hay una sola vigente podés omitir el id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id de la acción pendiente a cancelar (opcional si hay una sola).' } },
    },
  },
];

/** Nombres de los tools de acción (para rutear en el runner combinado del doer). */
export const NOMBRES_ACCION = new Set(MAKO_ACCION_TOOLS.map((t) => t.name));

// ── runner: crea/lista/confirma pendientes (cerrado sobre ws + grupoJid) ──────

const TTL_MIN = 120; // 2h de vigencia para el "sí".

export function crearRunnerAcciones(ws: number, grupoJid: string): ToolRunner {
  const proponer = async (tipo: string, payload: Record<string, unknown>, resumen: string): Promise<string> => {
    const id = await crearPendiente(ws, { grupoJid, tipo, payload, resumen, origen: 'hola-mako', ttlMin: TTL_MIN });
    if (id == null) return JSON.stringify({ ok: false, error: 'No pude registrar la acción pendiente.' });
    return JSON.stringify({ ok: true, pendiente_id: id, resumen, vence_en_min: TTL_MIN, instruccion: 'Deciles qué vas a hacer y pedí que confirmen con un "sí" para ejecutarlo.' });
  };

  return async (name, input) => {
    switch (name) {
      case 'listar_secuencias_nutricion': {
        const secs = await runWithWorkspace(ws, () => getSecuenciasConStats());
        return JSON.stringify(secs.map((s) => ({ id: s.id, nombre: s.nombre, etapa: s.etapa, activa: s.activa })));
      }

      case 'listar_campanas_meta': {
        const campanas = await runWithWorkspace(ws, async () => {
          const db = await getTenantDb();
          const { data } = await db.from('marketing_metrics_daily')
            .select('campaign_id, campaign_name, spend, fecha')
            .not('campaign_id', 'is', null)
            .order('fecha', { ascending: false })
            .limit(600);
          const map = new Map<string, { id: string; nombre: string; gasto: number }>();
          for (const r of (data ?? []) as Array<{ campaign_id: string; campaign_name: string | null; spend: number | null }>) {
            if (!r.campaign_id) continue;
            const prev = map.get(r.campaign_id) ?? { id: r.campaign_id, nombre: r.campaign_name ?? '(sin nombre)', gasto: 0 };
            prev.gasto += Number(r.spend ?? 0);
            if (r.campaign_name) prev.nombre = r.campaign_name;
            map.set(r.campaign_id, prev);
          }
          return [...map.values()].sort((a, b) => b.gasto - a.gasto).slice(0, 40)
            .map((c) => ({ id: c.id, nombre: c.nombre, gasto_reciente_usd: Math.round(c.gasto) }));
        });
        if (!campanas.length) return 'No tengo campañas de Meta sincronizadas todavía.';
        return JSON.stringify(campanas);
      }

      case 'proponer_cambio_etapa': {
        const leadId = num(input, 'leadId');
        const etapa = str(input, 'etapa');
        if (leadId == null || !etapa) return JSON.stringify({ ok: false, error: 'Faltan leadId o etapa.' });
        const { lead, label } = await runWithWorkspace(ws, async () => {
          const l = await getLead(leadId).catch(() => null);
          const f = await getFunnel().catch(() => null);
          const lbl = f?.stages?.find((s) => s.key === etapa)?.label ?? etapa;
          return { lead: l, label: lbl };
        });
        if (!lead) return JSON.stringify({ ok: false, error: `No existe el lead #${leadId} en este workspace.` });
        const monto = num(input, 'monto');
        const motivo = str(input, 'motivo');
        const payload: Record<string, unknown> = { leadId, etapa };
        if (monto != null) payload.monto = monto;
        if (motivo) payload.motivo = motivo;
        return proponer('lead_etapa', payload, `Mover a ${lead.nombre ?? `lead #${leadId}`} → etapa "${label}"${monto != null ? ` ($${monto})` : ''}${motivo ? ` (motivo: ${motivo})` : ''}`);
      }

      case 'proponer_toggle_nutricion': {
        const secuenciaId = num(input, 'secuenciaId');
        if (secuenciaId == null) return JSON.stringify({ ok: false, error: 'Falta secuenciaId.' });
        const activa = Boolean((input as { activa?: unknown }).activa);
        const sec = await runWithWorkspace(ws, async () => (await getSecuenciasConStats()).find((s) => s.id === secuenciaId));
        if (!sec) return JSON.stringify({ ok: false, error: `No existe la secuencia #${secuenciaId}.` });
        return proponer('nutricion_toggle', { secuenciaId, activa }, `${activa ? 'Activar' : 'Pausar'} la secuencia de nutrición "${sec.nombre}"`);
      }

      case 'proponer_renombrar_campana': {
        const campaignId = str(input, 'campaignId');
        const nombre = str(input, 'nombre');
        if (!/^\d+$/.test(campaignId) || !nombre) return JSON.stringify({ ok: false, error: 'campaignId (numérico) y nombre son obligatorios.' });
        return proponer('meta_nombre', { campaignId, nombre }, `Renombrar la campaña ${campaignId} → "${nombre}"`);
      }

      case 'proponer_presupuesto_campana': {
        const campaignId = str(input, 'campaignId');
        const montoMxn = num(input, 'montoMxn');
        if (!/^\d+$/.test(campaignId) || montoMxn == null || montoMxn <= 0) return JSON.stringify({ ok: false, error: 'campaignId (numérico) y montoMxn (> 0) son obligatorios.' });
        return proponer('meta_presupuesto', { campaignId, montoMxn }, `Poner el presupuesto de la campaña ${campaignId} en $${montoMxn} MXN/día`);
      }

      case 'proponer_estado_campana': {
        const campaignId = str(input, 'campaignId');
        const estado = str(input, 'estado').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
        if (!/^\d+$/.test(campaignId)) return JSON.stringify({ ok: false, error: 'campaignId (numérico) es obligatorio.' });
        return proponer('meta_estado', { campaignId, estado }, `${estado === 'ACTIVE' ? 'Activar' : 'Pausar'} la campaña ${campaignId}`);
      }

      case 'listar_pendientes': {
        const vig = await pendientesVigentes(ws, grupoJid);
        if (!vig.length) return 'No hay acciones pendientes de confirmar en este grupo.';
        return JSON.stringify(vig.map((p) => ({ id: p.id, resumen: p.resumen, vence: fmtFecha(p.venceAt) })));
      }

      case 'confirmar_accion':
      case 'cancelar_accion': {
        const id = num(input, 'id');
        const vig = await pendientesVigentes(ws, grupoJid);
        if (!vig.length) return 'No hay ninguna acción pendiente vigente para ' + (name === 'confirmar_accion' ? 'confirmar' : 'cancelar') + '.';
        const target = id != null ? vig.find((p) => p.id === id) : (vig.length === 1 ? vig[0] : undefined);
        if (!target) {
          if (id != null) return `No encuentro la acción #${id} vigente. Vigentes: ${vig.map((p) => `#${p.id} (${p.resumen})`).join('; ')}`;
          return `Hay ${vig.length} acciones pendientes, aclará cuál: ${vig.map((p) => `#${p.id} (${p.resumen})`).join('; ')}`;
        }
        if (name === 'cancelar_accion') {
          await resolverPendiente(ws, target.id, 'cancelada');
          return `Cancelada: ${target.resumen}`;
        }
        const res = await ejecutarAccion(ws, target.tipo, target.payload);
        await resolverPendiente(ws, target.id, res.ok ? 'ejecutada' : 'error', res.resumen);
        return res.ok ? `✅ Hecho: ${res.resumen}` : `❌ No se pudo: ${res.resumen}`;
      }

      default:
        return { content: `Acción desconocida: ${name}`, isError: true };
    }
  };
}
