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
import { crearTarea, crearCategoria, listCategorias, type Prioridad } from '@/lib/todo';
import { agregarTareasPlanOwner, priorizarNuevasOwner } from '@/lib/plan-board';
import { crearPropuesta } from '@/lib/plan-propuesta';

// Base pública para armar los links que MaKo manda por WhatsApp (deep-links al plan).
const APP_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');
const PRIOS: Prioridad[] = ['alta', 'media', 'baja', 'futuro'];
const prioOk = (p: unknown): Prioridad => (PRIOS.includes(p as Prioridad) ? (p as Prioridad) : 'media');

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
    // Nunca lanzamos: si algo falla, devolvemos {ok:false}. Si no, confirmar_accion
    // (que nos llama sin try/catch) dejaría la pendiente vigente y un "sí" repetido
    // la re-ejecutaría (duplicados).
    try {
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
      case 'tareas_plan': {
        // Agregar tareas al plan (punto 8). El super-admin (OWNER_WS) escribe DIRECTO al
        // board en la DB (mig 0093, antes iba a la bandeja localStorage); los clientes van
        // derecho a la base (todo.ts).
        const arr = Array.isArray(payload.tareas) ? (payload.tareas as Array<Record<string, unknown>>) : [];
        const items = arr
          .map((t) => ({ titulo: String(t.titulo ?? '').trim(), prioridad: prioOk(t.prioridad), proyecto: t.proyecto ? String(t.proyecto).trim() : undefined, deadline: typeof t.deadline === 'string' && t.deadline ? t.deadline : undefined, detalle: typeof t.detalle === 'string' && t.detalle ? String(t.detalle) : undefined }))
          .filter((t) => t.titulo);
        if (!items.length) return { ok: false, resumen: 'No había tareas válidas para agregar.' };
        const nN = `${items.length} tarea${items.length === 1 ? '' : 's'}`;
        const mirar = items.length === 1 ? 'Miralo acá' : 'Miralas acá';

        if (ws === OWNER_WS) {
          const { ids, proyectoIds } = await agregarTareasPlanOwner(
            items.map((it) => ({ titulo: it.titulo, prioridad: it.prioridad, proyecto: it.proyecto, deadline: it.deadline, detalle: it.detalle })),
            { tipo: 'whatsapp' },
          );
          const links = ids.map((id) => `${APP_URL}/plan/agencia?tarea=${id}`);
          // El Perro Guardián trabaja las nuevas server-side (no depende de abrir el board):
          // puntúa + arma checklists + a los proyectos les pone emoji/detalle/score. Si falla,
          // las tareas quedan con su score inicial (no rompe la carga).
          let prioLinea = '';
          try {
            const c = await priorizarNuevasOwner(ids, proyectoIds);
            if (c) {
              const partes = [c.tareas.alta && `${c.tareas.alta} en Alta`, c.tareas.media && `${c.tareas.media} en Media`, c.tareas.baja && `${c.tareas.baja} en Baja`, c.tareas.futuro && `${c.tareas.futuro} a futuro`].filter(Boolean);
              const proj = c.proyectos ? ` y ordenó ${c.proyectos} proyecto${c.proyectos === 1 ? '' : 's'}` : '';
              if (partes.length || proj) prioLinea = `\n🐕 El Perro Guardián las priorizó (${partes.join(', ')})${proj}, y les armó la checklist.`;
            }
          } catch (e) { console.error('[mako-doer-acciones] priorizar nuevas:', e instanceof Error ? e.message : String(e)); }
          return { ok: true, resumen: `Agregué ${nN} a tu plan.${prioLinea} ${mirar}:\n${links.join('\n')}` };
        }

        // Cliente: ya estamos dentro de runWithWorkspace(ws) → la base scopea al cliente.
        // El nombre de categoría se guarda truncado a 40 (todo.ts) → usamos el MISMO
        // recorte como clave, si no un 2º lote con el mismo proyecto largo lo duplica.
        const cats = await listCategorias().catch(() => []);
        const catName = (p: string) => p.slice(0, 40).trim();
        const byName = new Map(cats.map((c) => [c.nombre.trim().toLowerCase(), c.id]));
        const links: string[] = [];
        let fallidas = 0;
        for (const it of items) {
          try {
            let catId: number | undefined;
            if (it.proyecto) {
              const nombreCat = catName(it.proyecto);
              const k = nombreCat.toLowerCase();
              catId = byName.get(k);
              if (catId == null) { const c = await crearCategoria(nombreCat, '#2F6FED'); catId = c.id; byName.set(k, c.id); }
            }
            const tarea = await crearTarea({ titulo: it.titulo, prioridad: it.prioridad, deadline: it.deadline ?? null, detalle: it.detalle ?? null, categorias: catId != null ? [catId] : [], origen: 'mako' });
            links.push(`${APP_URL}/plan?tarea=${tarea.id}`);
          } catch (e) {
            fallidas++;
            console.error('[mako-doer-acciones] tareas_plan item:', e instanceof Error ? e.message : String(e));
          }
        }
        // ok:true SIEMPRE (aunque falle alguna) para que la pendiente se resuelva y un
        // "sí" repetido NO re-cree las que ya entraron. Reportamos el parcial.
        if (!links.length) return { ok: false, resumen: `No pude agregar ninguna (fallaron ${fallidas}).` };
        const cola = fallidas ? ` (${fallidas} no pude)` : '';
        return { ok: true, resumen: `Agregué ${links.length} tarea${links.length === 1 ? '' : 's'} al plan${cola}. ${links.length === 1 ? 'Miralo acá' : 'Miralas acá'}:\n${links.join('\n')}` };
      }
      default:
        return { ok: false, resumen: `Acción desconocida: ${tipo}` };
    }
    } catch (e) {
      console.error(`[mako-doer-acciones] ejecutarAccion ${tipo}:`, e instanceof Error ? e.message : String(e));
      return { ok: false, resumen: `No pude ejecutarlo (${e instanceof Error ? e.message : 'error'}).` };
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
    name: 'proponer_tareas_plan',
    description: 'PROPONE agregar TAREAS al plan del negocio. Usala cuando te pasan una lista de cosas para el plan (aunque venga desordenada). Cada tarea necesita al menos un título. Resolvé vos lo DEDUCIBLE (a qué proyecto va, dedup con ver_plan). Para lo que NO podés deducir (fechas/urgencia, si un ítem es 1 o varias tareas, prioridad), NO hagas el ida-y-vuelta por WhatsApp: pasá esas dudas en "preguntas" (cada una con 2-4 opciones) — se responden de a UNA en la pantalla de revisión de la app. La tool te devuelve un LINK a esa pantalla: pasáselo tal cual, NO pidas "sí" ni repitas la lista por el chat.',
    input_schema: {
      type: 'object',
      properties: {
        tareas: {
          type: 'array',
          description: 'Las tareas a agregar, ya con lo deducible resuelto (proyecto asignado).',
          items: {
            type: 'object',
            properties: {
              titulo: { type: 'string', description: 'qué hay que hacer, corto e imperativo.' },
              prioridad: { type: 'string', enum: ['alta', 'media', 'baja', 'futuro'], description: 'opcional; default media.' },
              proyecto: { type: 'string', description: 'opcional; nombre del proyecto/categoría donde va (si no existe, se crea).' },
              deadline: { type: 'string', description: 'opcional; fecha límite YYYY-MM-DD.' },
              detalle: { type: 'string', description: 'opcional; contexto extra que se dijo.' },
            },
            required: ['titulo'],
          },
        },
        preguntas: {
          type: 'array',
          description: 'Opcional (recomendado). Lo que NO pudiste deducir, para que lo respondan en la app de a UNA. Cada pregunta corta + 2-4 opciones probables (respuestas típicas, cortas) para elegir de un clic. Ej: {"pregunta":"¿El módulo de Webinars es una tarea o lo separamos?","opciones":["Una sola","Separar en grabar/analizar/seguir"]}. Máximo 4.',
          items: {
            type: 'object',
            properties: {
              pregunta: { type: 'string', description: 'la pregunta, corta y concreta.' },
              opciones: { type: 'array', description: '2-4 respuestas probables (cortas).', items: { type: 'string' } },
            },
            required: ['pregunta'],
          },
        },
      },
      required: ['tareas'],
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

// `turnStart` = Date.now() del arranque del turno. Sirve para bloquear el auto-confirm:
// una pendiente creada EN ESTE turno (createdAt >= turnStart) no puede confirmarse en el
// mismo turno; el "sí" del dueño siempre llega en un mensaje aparte (otro turno posterior).
export function crearRunnerAcciones(ws: number, grupoJid: string, turnStart = 0): ToolRunner {
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

      case 'proponer_tareas_plan': {
        const raw: unknown[] = Array.isArray((input as { tareas?: unknown }).tareas) ? (input as { tareas: unknown[] }).tareas : [];
        const tareas = raw
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({ titulo: typeof x.titulo === 'string' ? x.titulo.trim().slice(0, 200) : '', prioridad: prioOk(x.prioridad), proyecto: x.proyecto ? String(x.proyecto).trim().slice(0, 120) : undefined, deadline: typeof x.deadline === 'string' && x.deadline ? String(x.deadline) : undefined, detalle: typeof x.detalle === 'string' && x.detalle ? String(x.detalle).slice(0, 600) : undefined }))
          .filter((t) => t.titulo);
        if (!tareas.length) return JSON.stringify({ ok: false, error: 'No hay ninguna tarea con título. Resolvé lo deducible con ver_plan; si falta info, ponela en "preguntas" — no preguntes por acá.' });
        const preguntasRaw = (input as { preguntas?: unknown }).preguntas;
        const preguntas = Array.isArray(preguntasRaw)
          ? preguntasRaw.map((p) => {
              if (typeof p === 'string') return { pregunta: p.trim().slice(0, 300), opciones: [] as string[] };
              const o = (p ?? {}) as Record<string, unknown>;
              return { pregunta: String(o.pregunta ?? '').trim().slice(0, 300), opciones: Array.isArray(o.opciones) ? o.opciones.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : [] };
            }).filter((p) => p.pregunta).slice(0, 5)
          : [];
        const resumen = `Agregar ${tareas.length} tarea${tareas.length === 1 ? '' : 's'} al plan`;

        // BORRADOR + link a /plan/revisar para TODOS (dueño y clientes): nada de ida-y-vuelta
        // ni "sí" por WhatsApp. Las preguntas se responden de a una en la app.
        try {
          const id = await crearPropuesta({ tareas: tareas.map((t) => ({ titulo: t.titulo, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle, prioridad: t.prioridad })), preguntas, resumen, origen: 'whatsapp' });
          const link = `${APP_URL}/plan/revisar/${id}`;
          return JSON.stringify({ ok: true, borrador: true, link, tareas: tareas.length, preguntas: preguntas.length, instruccion: `Armaste un BORRADOR con ${tareas.length} tarea${tareas.length === 1 ? '' : 's'}${preguntas.length ? ` y ${preguntas.length} pregunta${preguntas.length === 1 ? '' : 's'}` : ''}. Mandá UNA línea corta + este link para que lo revisen, respondan y confirmen EN LA APP (NO pidas "sí" acá, NO repitas la lista): ${link}` });
        } catch (e) {
          return JSON.stringify({ ok: false, error: `No pude armar el borrador: ${e instanceof Error ? e.message : 'error'}` });
        }
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
        // Guard anti auto-confirm: si la pendiente se creó en ESTE mismo turno, no la
        // ejecutamos. El "sí" del dueño es un mensaje aparte (turno posterior). 1.5s de
        // margen por el skew reloj-app/DB. Bloquea que el modelo proponga Y confirme solo.
        if (turnStart && target.createdAt && Date.parse(target.createdAt) >= turnStart - 1500) {
          return 'Recién propuse esa acción en este mismo mensaje. NO la confirmes vos: frená y esperá a que el dueño mande un "sí" aparte.';
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
