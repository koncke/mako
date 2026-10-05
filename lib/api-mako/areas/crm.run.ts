// =============================================================================
// api-mako/areas/crm.run — los cuerpos del área `crm`
// =============================================================================
// Un runner por id de crm.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// y opcionalmente { proponer } para las que tienen pantalla propia. Todo corre
// adentro de runWithWorkspace(ctx.ws): las libs que ya scopean con getTenantDb
// scopean solas. Nunca se escribe directo desde preparar().
//
// Las HEREDADAS se ENVUELVEN, no se mudan: siete tests leen lib/mako-tools.ts y
// lib/mako-doer-acciones.ts por regex. `proponerLegado` corre la tool vieja entera
// (valida y deja la pendiente ella misma) y `ejecutar` va por `ejecutarAccion` con
// el slug que ya está en la base.
//
// ⚠️ preparar() de una acción `pantalla` genérica NO puede lanzar: al confirmar en
// /mako/revisar, acciones.ts lo llama FUERA de su try (aplicarPropuestaGenerica) y
// una excepción tiraría la pantalla. Por eso los «no existe» vuelven como { error }.
// Y ejecutar() tampoco lanza (tipos.ts): `seguro()` lo garantiza.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import { crearRunnerAcciones, ejecutarAccion } from '@/lib/mako-doer-acciones';
import {
  getLead, updateLead, logLeadChanges, logLeadEvent, getLeadAudit, faltantesParaMover, saveLeadMeta,
  setMeetingManual, setPipelineStage, duplicadosDeLead, getTrackingEvents, getVslEngagement,
  contarVisitasLanding, esRequisitosFaltantes, type Lead, type FathomLink,
} from '@/lib/leads';
import { getFunnelDefault } from '@/lib/funnels';
import { salidasDeEtapa, stageMetaOpt, ENTRADAS, MAKO_SETTER, type EntradaId } from '@/lib/pipeline';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
// El candado de «calificado»: el mismo que aplica updateLead y que dibuja la ficha.
import { calificadoSeDescarta } from '@/lib/calificado-reunion';
import { getJuntasProximas } from '@/lib/queries';
import { getLeadPlan, getPagosByLead, savePlanPagos, saveLeadPlanManual, marcarPago } from '@/lib/pagos';
import { getResumenLead, linkResumenLead } from '@/lib/lead-resumen';
import { getUltimoInsightGenerado, generarInsightLead } from '@/lib/lead-insights';
import { buildJourney } from '@/lib/journey';
import { propuestasPendientes, crearPropuesta } from '@/lib/propuestas';
import { getSetting } from '@/lib/settings';
import { listPendientes, resolverConfirmacion } from '@/lib/mako-confirmaciones';
import { evaluarAutoWorkspace } from '@/lib/crm-auto';
import { crmAutoHabilitado, setCrmAuto, KEY_CRM_AUTO } from '@/lib/envio-flags';
import { horariosLibresDeGoogle } from '@/lib/google-calendar';
import { eventTypeDeReunion, linkParaAgendar } from '@/lib/calendly-agenda';
import { listReviewPendientes } from '@/lib/review-queue';
import { listProductos, upsertProducto } from '@/lib/productos';
import { APP_BASE_URL } from '@/lib/app-url';
import {
  invalidar, hoyDelWorkspace, esFechaIso, etapasDelFunnelDefault, etapasDelFunnelDeLead, faltantesDeUnLead, leadsFiltrados, conteoPorEtapa,
  nombresAsignables, marcarPendientesIgnorados, guardarEntradas, guardarDeal, existeIdentidadFiscal, proponerLote,
  estadoConfirmacion,
} from './crm.helpers';

/** Los campos del Deal Details por sección: el parámetro plano es `<seccion>_<campo>`. */
const CAMPOS_DEAL = {
  fiscal: ['razon', 'id_fiscal', 'domicilio', 'correo'],
  servicio: ['que_es', 'fecha_inicio', 'fecha_termino', 'duracion', 'frecuencia', 'modalidad', 'sesiones'],
  promesa: ['resultado', 'garantia'],
  obligaciones: ['cliente', 'prestador'],
} as const;

// ── helpers del archivo ───────────────────────────────────────────────────────

const legado = (ctx: Ctx) => crearRunnerAcciones(ctx.ws, ctx.canalKey, ctx.turnStart ?? 0, ctx.mensajeUsuario ?? '');
const texto = async (p: Promise<string | { content: string; isError?: boolean }>) => { const r = await p; return typeof r === 'string' ? r : r.content; };
const json = (o: unknown): string => JSON.stringify(o);
const fallo = (msg: string) => ({ content: msg, isError: true });
const autorDe = (ctx: Ctx): string => ctx.actor?.trim() || 'MaKo';
const canalTxt = (ctx: Ctx): string => (ctx.canal === 'http' ? 'la API' : ctx.canal === 'whatsapp' ? 'WhatsApp' : 'la app');
const origenPropuesta = (ctx: Ctx): string => (ctx.canal === 'whatsapp' ? 'whatsapp' : ctx.canal === 'http' ? 'claude' : 'app');
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const s = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const b = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const labels = (pasos: ReadonlyArray<{ label: string }>): string => pasos.map((p) => p.label).join(', ');
const sumarDias = (iso: string, dias: number): string => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

/** El lead por id, o null (no existe en ESTE workspace o falló la lectura). No lanza. */
const leadDe = (id: unknown): Promise<Lead | null> => (typeof id === 'number' ? getLead(id).catch(() => null) : Promise.resolve(null));
const noExiste = (id: unknown) => `No existe el lead #${String(id)} en este workspace. Búscalo con buscar_leads.`;

/** Lecturas por lead: el «no existe» es un error del que llama (400), no nuestro. */
async function conLead(input: Record<string, unknown>, fn: (lead: Lead) => Promise<string | { content: string; isError?: boolean }>) {
  const lead = await leadDe(input.leadId);
  return lead ? fn(lead) : fallo(noExiste(input.leadId));
}

/** ejecutar() NUNCA lanza: si algo falla, ok:false con el motivo (la pendiente se
 *  resuelve y un «sí» repetido no la vuelve a correr). */
async function seguro(que: string, fn: () => Promise<Ejecutado>): Promise<Ejecutado> {
  try {
    return await fn();
  } catch (e) {
    if (esRequisitosFaltantes(e)) return { ok: false, resumen: `No se pudo ${que}: falta cargar ${labels(e.faltan)}.` };
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[api-mako crm] ${que}:`, msg);
    return { ok: false, resumen: `No se pudo ${que} (${msg}).` };
  }
}

// ── los runners ───────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // Lecturas heredadas de MAKO_TOOLS → runMakoTool con el MISMO nombre.
  buscar_leads: { leer: (input) => runMakoTool('buscar_leads', input) },
  ficha_lead: { leer: (input) => runMakoTool('ficha_lead', input) },
  reuniones_lead: { leer: (input) => runMakoTool('reuniones_lead', input) },
  reuniones_recientes: { leer: (input) => runMakoTool('reuniones_recientes', input) },
  ver_funnel: { leer: (input) => runMakoTool('ver_funnel', input) },
  // Lectura que vive en el archivo de acciones → el runner de acciones.
  listar_horarios_reunion: { leer: (input, ctx) => legado(ctx)('listar_horarios_reunion', input) },

  listar_leads: {
    leer: async (input) => {
      for (const k of ['desde', 'hasta'] as const) {
        if (input[k] !== undefined && !esFechaIso(input[k])) return fallo(`«${k}» tiene que ser una fecha YYYY-MM-DD.`);
      }
      const etapas = Array.isArray(input.etapas) ? (input.etapas as string[]) : undefined;
      if (etapas?.length) {
        // DEFAULT: se valida un FILTRO contra el catálogo, sin lead de por medio.
        const stages = await etapasDelFunnelDefault();
        const desconocidas = etapas.filter((k) => !stageMetaOpt(stages, k));
        if (desconocidas.length) return fallo(json({ error: `Etapas que el funnel de este negocio no tiene: ${desconocidas.join(', ')}. Pide ver_funnel para las keys reales.`, disponibles: stages.map((x) => x.key) }));
      }
      const campo = s(input.campo_fecha) ?? 'created_at';
      const limite = n(input.limite) ?? 30;
      const { filas, total_cartera } = await leadsFiltrados({ etapas, banda: s(input.banda), campoFecha: campo, desde: s(input.desde), hasta: s(input.hasta), persona: s(input.persona) });
      const leads = filas.slice(0, limite).map(({ l, key, label, fecha }) => ({
        id: l.id, nombre: l.nombre, empresa: l.empresa, etapa: key, etapa_label: label, estado: l.estado_lead,
        closer: l.closer ?? null, setter: l.setter ?? null, [campo]: fecha,
        monto_cierre_usd: l.monto_cierre_usd, total_cobrado_usd: l.total_cobrado_usd,
      }));
      return json({
        filtro: { etapas: etapas ?? null, banda: s(input.banda) ?? null, campo_fecha: campo, desde: s(input.desde) ?? null, hasta: s(input.hasta) ?? null, persona: s(input.persona) ?? null },
        coinciden: filas.length, devueltos: leads.length, omitidos: filas.length - leads.length, total_cartera,
        ...(campo === 'created_at' ? { nota_fecha: 'created_at se compara por su día en UTC.' } : {}),
        nota_montos: 'Montos en USD; null = sin cargar, no cero. En suscripciones monto_cierre_usd queda null a propósito.',
        leads,
      });
    },
  },
  contar_leads_por_etapa: {
    leer: async () => {
      const c = await conteoPorEtapa();
      const top = c.origenes.slice(0, 15);
      return json({ ...c, origenes: top, origenes_omitidos: c.origenes.length - top.length });
    },
  },
  transiciones_desde_etapa: {
    leer: async (input) => {
      // DEFAULT: es una pregunta de catálogo («de esta etapa, ¿a dónde se puede ir?»),
      // sin ningún lead de por medio.
      const f = await getFunnelDefault();
      const etapa = String(input.etapa);
      if (!stageMetaOpt(f.stages, etapa)) return fallo(json({ error: `El funnel de este negocio no tiene la etapa «${etapa}».`, disponibles: f.stages.map((x) => x.key) }));
      const salidas = salidasDeEtapa(f.stages, f.transitions, etapa, { asistio: b(input.asistio) ?? null, cual: input.cual === 'R2' ? 'r2' : 'r1' });
      return json({
        etapa, etapa_label: stageMetaOpt(f.stages, etapa)?.label ?? etapa,
        salidas: salidas.map((o) => ({ etapa_destino: o.to, label: o.label, transicion: o.sub, categoria: o.category, ...(o.asistioJ1 !== undefined ? { asistio_j1: o.asistioJ1 } : {}), ...(o.asistioJ2 !== undefined ? { asistio_j2: o.asistioJ2 } : {}) })),
      });
    },
  },
  requisitos_para_mover: {
    leer: (input) => conLead(input, async (lead) => {
      // DEL LEAD: qué le falta a ÉL para moverse.
      const stages = await etapasDelFunnelDeLead(lead);
      const etapa = String(input.etapa);
      if (!stageMetaOpt(stages, etapa)) return fallo(json({ error: `El funnel de este negocio no tiene la etapa «${etapa}».`, disponibles: stages.map((x) => x.key) }));
      // La MISMA llamada que hace proponer_cambio_etapa al proponer y al confirmar:
      // si esta lectura dijera otra cosa, se pediría un dato que la acción no exige.
      const faltan = faltantesParaMover(lead, etapa, stages, { monto: n(input.monto) ?? null, motivo: s(input.motivo) ?? null });
      const pedibles = new Set(['monto', 'motivo']);
      return json({
        lead_id: lead.id, nombre: lead.nombre, etapa_actual: etapaVigenteDe(lead, stages), etapa_destino: etapa,
        se_puede_mover: faltan.length === 0,
        pedir_por_chat: faltan.filter((f) => pedibles.has(f.id)).map((f) => ({ id: f.id, label: f.label })),
        solo_en_la_ficha: faltan.filter((f) => !pedibles.has(f.id)).map((f) => ({ id: f.id, label: f.label })),
      });
    }),
  },
  faltantes_del_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const [faltan, stages] = await Promise.all([faltantesDeUnLead(lead), etapasDelFunnelDeLead(lead)]);
      return json({
        lead_id: lead.id, nombre: lead.nombre, etapa: etapaVigenteDe(lead, stages),
        al_dia: faltan.length === 0, faltan: faltan.map((f) => ({ id: f.id, label: f.label })),
        ...(lead.pendientes_ignorados ? { ignorados_desde: lead.pendientes_ignorados, nota: 'Sus pendientes están ignorados: no cuentan en «Datos sin marcar», pero siguen faltando.' } : {}),
      });
    }),
  },
  reuniones_proximas: {
    leer: async (_input, ctx) => {
      const dias = n(_input.dias) ?? 2;
      const { tz, hoy } = await hoyDelWorkspace(ctx.ws);
      const r = await getJuntasProximas(hoy, dias);
      return json({
        ventana: { desde: hoy, hasta: sumarDias(hoy, dias - 1), dias }, zona: tz,
        reuniones: r.map((j) => ({
          lead_id: j.lead_id, reunion: j.tipo === 'J1' ? 'R1' : 'R2', fecha: j.fecha, dia: j.dia, nombre: j.nombre, empresa: j.empresa,
          respuestas: j.respuestas, vsl_estado: j.vsl_estado, vsl_plays: j.vsl_plays, vsl_max_pct: j.vsl_max_pct,
          origen: j.origen, madurez: j.madurez, estado: j.estado_lead,
        })),
      });
    },
  },
  historial_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const filas = await getLeadAudit(lead.id);
      return json({
        lead_id: lead.id, nombre: lead.nombre, tope: 100, recortado: filas.length >= 100,
        ...(filas.length ? {} : { nota: 'Sin filas: o el lead no tiene cambios registrados, o falló la lectura del historial.' }),
        cambios: filas.map((r) => ({ campo: r.campo, antes: r.valor_anterior, despues: r.valor_nuevo, autor: r.autor, fecha: r.created_at })),
      });
    }),
  },
  notas_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const filas = await getLeadAudit(lead.id);
      const notas = filas.filter((r) => r.campo === 'Nota');
      return json({
        lead_id: lead.id, nombre: lead.nombre,
        ...(filas.length >= 100 ? { advertencia: 'El historial llegó a su tope de 100 eventos: puede haber notas más viejas que no aparecen.' } : {}),
        notas: notas.map((r) => ({ texto: r.valor_nuevo, autor: r.autor, fecha: r.created_at })),
      });
    }),
  },
  cobranza_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const plan = await getLeadPlan(lead.id);
      const cuotas = plan.pagos.map((p) => ({ pago_id: p.id, numero: p.numero, es_inicial: p.numero === 0, monto_usd: Number(p.monto_usd), vence: p.fecha_esperada, pagada: p.pagado, fecha_pago: p.fecha_pago, tiene_comprobante: !!p.comprobante_path }));
      const suma = (xs: typeof cuotas) => Math.round(xs.reduce((a, c) => a + c.monto_usd, 0) * 100) / 100;
      const sus = lead.venta_tipo === 'suscripcion';
      return json({
        lead_id: lead.id, nombre: lead.nombre, estado: lead.estado_lead,
        venta_tipo: lead.venta_tipo ?? 'unico',
        total_vendido_usd: plan.total_usd,
        ...(sus ? { suscripcion_mensual_usd: lead.suscripcion_monto_usd ?? null, suscripcion_meses: lead.suscripcion_meses ?? null, nota: 'Suscripción: total_vendido_usd queda null a propósito; el importe es el mensual.' } : {}),
        duracion_meses: plan.duracion_meses, fecha_cierre: plan.fecha_cierre, fecha_inicio_servicio: plan.fecha_inicio, tiene_contrato: plan.tiene_contrato,
        cobrado_usd: suma(cuotas.filter((c) => c.pagada)), por_cobrar_usd: suma(cuotas.filter((c) => !c.pagada)),
        cuotas,
        ...(cuotas.length ? {} : { nota_cuotas: 'Sin cuotas cargadas: no hay plan de pagos, no significa que no deba nada.' }),
      });
    }),
  },
  insight_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const g = await getUltimoInsightGenerado(lead.id);
      if (!g) return json({ lead_id: lead.id, nombre: lead.nombre, insight: null, nota: 'MaKo todavía no generó un diagnóstico para este lead (o falló la lectura).' });
      return json({ lead_id: lead.id, nombre: lead.nombre, generado: g.created_at, etapa_al_generar: g.etapa, contenido: g.contenido, fuentes: g.fuentes });
    }),
  },
  tracking_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const vid = lead.visitor_id;
      if (!vid) return json({ lead_id: lead.id, nombre: lead.nombre, sin_datos: true, nota: 'El lead no tiene visitor_id: no hay forma de saber qué hizo en la landing. Esto NO significa que no vio el VSL.' });
      // getTrackingEvents pide `limit` filas POR TABLA y después descarta lo que no es
      // de video: con 60 el recorte podía no notarse. Se pide más y se corta acá.
      const [todos, vsl, visitas] = await Promise.all([getTrackingEvents(vid, 200), getVslEngagement(vid), contarVisitasLanding(vid)]);
      const eventos = todos.slice(0, 60);
      return json({
        lead_id: lead.id, nombre: lead.nombre,
        visitas: { total: visitas.total_visitas, dias_distintos: visitas.dias_distintos, primera: visitas.primera_visita, ultima: visitas.ultima_visita },
        vsl: { plays: vsl.plays, max_pct: vsl.max_pct, sin_datos: vsl.sin_datos, por_video: vsl.porVideo },
        eventos_tope: 60, eventos_recortados: todos.length > 60,
        nota_eventos: 'Se leen hasta 200 filas por tabla (visitas y eventos de video) y se devuelven las 60 más recientes.',
        ...(todos.length ? {} : { nota_vacio: 'Sin eventos pese a tener visitor_id: o no hubo actividad registrada, o falló la lectura. No afirmes que no visitó la landing.' }),
        eventos,
      });
    }),
  },
  journey_lead: {
    leer: (input, ctx) => conLead(input, async (lead) => {
      const { hoy } = await hoyDelWorkspace(ctx.ws);
      // Las reuniones del recorrido salen del embudo DE ESTE LEAD, no de dos
      // rótulos fijos: si falla la lectura, buildJourney cae a «Reunión 1/2».
      const etapas = await etapasDelFunnelDeLead(lead).catch(() => []);
      const pasos = buildJourney({
        createdISO: lead.created_at, fechaAgenda: lead.fecha_agenda, fechaJ1: lead.fecha_junta_1, asistioJ1: lead.asistio_j1,
        fechaJ2: lead.fecha_junta_2, asistioJ2: lead.asistio_j2, fechaConfirmacion: lead.fecha_confirmacion,
        fechaPrimerPago: lead.fecha_primer_pago, fechaCierre: lead.fecha_cierre, estadoLead: lead.estado_lead,
        monto: lead.monto_cierre_usd ?? 0, hoyISO: hoy,
        etapas, etapaActual: etapaVigenteDe(lead, etapas),
      });
      return json({ lead_id: lead.id, nombre: lead.nombre, hoy, hitos: pasos.map((p) => ({ hito: p.label, detalle: p.sub ?? null, fecha: p.date, estado: p.state })) });
    }),
  },
  duplicados_lead: {
    leer: async (input) => {
      const cand = { nombre: s(input.nombre) ?? null, email: s(input.email) ?? null, telefono: s(input.telefono) ?? null };
      if (!cand.nombre && !cand.email && !cand.telefono) return fallo('Pasa al menos un nombre, un email o un teléfono.');
      const r = await duplicadosDeLead(cand);
      return json({ coincidencias: r, ...(r.length ? {} : { nota: 'Sin coincidencias. Si la consulta falló también da vacío: no garantiza que no exista.' }) });
    },
  },
  propuestas_lead_pendientes: {
    leer: async () => {
      const ps = await propuestasPendientes('lead');
      const ahora = Date.now();
      return json({
        tope: 100, recortado: ps.length >= 100,
        propuestas: ps.map((p) => ({
          id: p.id, url: `${APP_BASE_URL}/crm/revisar/${p.id}`, resumen: p.resumen, origen: p.origen,
          contactos: Array.isArray(p.datos.leads) ? p.datos.leads.length : 1,
          creada: p.createdAt, horas_esperando: Math.max(0, Math.round((ahora - Date.parse(p.createdAt)) / 3_600_000)),
        })),
      });
    },
  },
  confirmaciones_crm_automatico: {
    leer: async () => {
      const cs = await listPendientes();
      return json({
        tope: 100, recortado: cs.length >= 100,
        ...(cs.length ? {} : { nota: 'Sin confirmaciones pendientes (si la lectura falló también da vacío).' }),
        confirmaciones: cs.map((c) => ({
          id: c.id, lead_id: c.lead_id, lead: c.lead_nombre, regla: c.regla, titulo: c.titulo, detalle: c.detalle,
          ya_aplicado: c.aplicado, cambios: c.cambios, creada: c.created_at,
          decisiones: ['confirmar', 'rechazar', ...(c.opciones ?? []).map((o) => `op:${o.key}`)],
          opciones: (c.opciones ?? []).map((o) => ({ key: o.key, label: o.label, etapa: o.stage ?? null })),
        })),
      });
    },
  },
  estado_crm_automatico: {
    leer: async () => {
      const [habilitado, guardado] = await Promise.all([crmAutoHabilitado(), getSetting(KEY_CRM_AUTO).catch(() => null)]);
      const origen = guardado === 'true' || guardado === 'false' ? 'setting' : habilitado ? 'deploy' : 'sin_configurar';
      return json({ habilitado, origen, nota: 'origen: setting = lo configuró el negocio; deploy = hereda la configuración del deploy (solo el workspace principal); sin_configurar = apagado por defecto.' });
    },
  },
  evaluar_crm_automatico: {
    leer: async (_input, ctx) => {
      const { hoy } = await hoyDelWorkspace(ctx.ws);
      const [r, habilitado] = await Promise.all([evaluarAutoWorkspace(hoy), crmAutoHabilitado()]);
      const muestra = r.acciones.slice(0, 50);
      const advertencias = ['Las reglas usan keys fijas (lead, nutri, manual, reactivacion): con un funnel de etapas propias pueden no disparar nada aunque haya leads.'];
      // Sin aviso de «la lectura corta en 1000»: evaluarAutoWorkspace pagina desde el
      // 17/09. El aviso viejo salía SIEMPRE en ws1 (1.108 leads) y afirmaba un recorte
      // que ya no existía — un aviso falso enseña a ignorar los verdaderos.
      return json({
        simulacion_sin_escribir: true, fecha: hoy, crm_automatico_prendido: habilitado,
        leads_evaluados: r.totalLeads, acciones_totales: r.acciones.length, por_regla: r.porRegla,
        acciones: muestra.map((a) => ({ regla: a.regla, lead_id: a.leadId, lead: a.lead, que_haria: a.descripcion, pide_confirmacion: a.confirmar, etapa_destino: a.move?.to ?? null })),
        acciones_omitidas: r.acciones.length - muestra.length, advertencias,
      });
    },
  },
  horarios_libres_dia: {
    leer: async (input) => {
      if (!esFechaIso(input.fecha)) return fallo('«fecha» tiene que ser una fecha YYYY-MM-DD.');
      const r = await horariosLibresDeGoogle(input.fecha, { duracionMin: n(input.duracion_min) });
      const slots = r.slots ?? [];
      return json({
        fecha: input.fecha, zona: r.tz, codigo: r.codigo, motivo: r.motivo || null, agenda_verificada: r.codigo === 'ok',
        libres: slots.filter((x) => x.libre).map((x) => x.hora), ocupados: slots.filter((x) => !x.libre).map((x) => x.hora),
        ...(r.codigo === 'ok' ? {} : { nota: 'No se pudo leer la agenda de Google: todo figura libre, pero NO está verificado. Dilo así.' }),
      });
    },
  },
  link_agenda_calendly: {
    leer: async (input) => {
      const cual = input.cual === 'R2' ? 'R2' as const : 'R1' as const;
      let lead: Lead | null = null;
      if (input.leadId !== undefined) {
        lead = await leadDe(input.leadId);
        if (!lead) return fallo(noExiste(input.leadId));
      }
      try {
        const et = await eventTypeDeReunion(cual);
        const url = await linkParaAgendar({ eventType: et, invitado: { nombre: lead?.nombre ?? null, email: lead?.email ?? null }, unUso: false });
        return json({ cual, reunion: et.nombre, url, motivo: null, ...(lead ? { lead_id: lead.id } : {}), instruccion: 'Pasa el link TAL CUAL: no lo reescribas.' });
      } catch (e) {
        return json({ cual, url: null, motivo: e instanceof Error ? e.message : String(e) });
      }
    },
  },
  link_resumen_lead: {
    leer: async (input) => {
      const id = n(input.leadId) ?? 0;
      const r = await getResumenLead(id);
      if (!r) return fallo(noExiste(input.leadId));
      const cuando = r.proximaReunion
        ? new Date(r.proximaReunion.iso).toLocaleString('es-MX', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: r.tz })
        : null;
      return json({
        lead_id: id, nombre: r.lead.nombre, link: linkResumenLead(id),
        proxima_reunion: r.proximaReunion ? { reunion: r.proximaReunion.cual, cuando, zona: r.tz } : null,
        llamadas_analizadas: r.llamadas.length, follow_up_sin_enviar: !!r.borradorSeguimiento,
        instruccion: 'Pasa el link TAL CUAL. No cuentes el contenido de la reunión por el chat.',
      });
    },
  },
  r2_sin_lead: {
    leer: async () => {
      const items = await listReviewPendientes();
      const muestra = items.slice(0, 50);
      return json({
        pendientes: items.length, omitidos: items.length - muestra.length,
        items: muestra.map((i) => ({ id: i.id, tipo: i.tipo, nombre: i.nombre, email: i.email, fecha_evento: i.fecha_evento, creado: i.created_at })),
      });
    },
  },
  listar_productos: {
    leer: async (input) => {
      const ps = await listProductos(input.soloActivos === true);
      return json({
        moneda: 'USD', productos: ps.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, monto_usd: p.monto_usd, suscripcion_meses: p.suscripcion_meses, promesa: p.promesa, incluye: p.incluye, garantia: p.garantia, activo: p.activo })),
        ...(ps.length ? {} : { nota: 'El catálogo está vacío.' }),
      });
    },
  },

  // ── Acciones heredadas ──────────────────────────────────────────────────────
  proponer_cambio_etapa: {
    proponerLegado: (input, ctx) => texto(legado(ctx)('proponer_cambio_etapa', input)),
    ejecutar: (payload, ctx) => ejecutarAccion(ctx.ws, 'lead_etapa', payload),
  },
  proponer_agendar_reunion: {
    proponerLegado: (input, ctx) => texto(legado(ctx)('proponer_agendar_reunion', input)),
    ejecutar: (payload, ctx) => ejecutarAccion(ctx.ws, 'agendar_reunion', payload),
  },
  proponer_lead: {
    proponer: async (input, ctx) => {
      // La tool vieja guarda origen:'whatsapp' siempre: por la app o por HTTP la bandeja
      // reportaba un origen falso. Fuera de WhatsApp se propone acá, con el origen real
      // y la MISMA ref (la llave es la persona, no el canal: dos canales no duplican).
      if (ctx.canal !== 'whatsapp') {
        const nombre = s(input.nombre);
        if (!nombre) return { error: 'Falta el nombre. Pídelo antes de proponer nada.' };
        const telefono = (s(input.telefono) ?? '').replace(/\D/g, '');
        const empresa = s(input.empresa) ?? null;
        const ref = `wa:lead:${telefono || nombre.toLowerCase().replace(/\s+/g, '-')}`;
        const { id, nueva } = await crearPropuesta({
          ws: ctx.ws, tipo: 'lead', origen: origenPropuesta(ctx), ref,
          datos: { nombre, telefono: telefono || null, email: s(input.email) ?? null, empresa, nota: s(input.nota) ?? null },
          resumen: `${nombre}${empresa ? ` (${empresa})` : ''}${telefono ? ` · ${telefono}` : ''}`,
        });
        return { id, url: `${APP_BASE_URL}/crm/revisar/${id}`, nueva };
      }
      const j = JSON.parse(await texto(legado(ctx)('proponer_lead', input))) as Record<string, unknown>;
      if (j.ok !== true || typeof j.url !== 'string') return { error: String(j.error ?? 'no se pudo proponer') };
      return { id: j.url.split('/').pop() ?? '', url: j.url, nueva: j.nueva !== false };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Esta propuesta se confirma en su pantalla de revisión, no por aquí.' }),
  },

  // ── Acciones chat ───────────────────────────────────────────────────────────
  marcar_asistencia_reunion: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const cual = input.cual === 'R2' ? 'R2' : 'R1';
      const fecha = cual === 'R1' ? lead.fecha_junta_1 : lead.fecha_junta_2;
      if (!fecha) return { error: `La ${cual} de ${lead.nombre} no tiene fecha cargada, y sin fecha la asistencia se descarta. Primero hay que cargar la reunión (marcar_reunion_manual) o esperar que llegue por Calendly.` };
      const asistio = input.asistio === true;
      if ((cual === 'R1' ? lead.asistio_j1 : lead.asistio_j2) === asistio) return { error: `La ${cual} de ${lead.nombre} ya está marcada como ${asistio ? 'asistida' : 'no asistida'}.` };
      // updateLead: asistio_j1 !== true → calificado = null. Se dice ANTES del «sí».
      const borraCalificado = cual === 'R1' && !asistio && lead.calificado != null
        ? ` ⚠️ Se borra el calificado (hoy: ${lead.calificado ? 'calificado' : 'no calificado'}).` : '';
      return { payload: { leadId: lead.id, cual, asistio }, resumen: `Marcar que ${lead.nombre} ${asistio ? 'SÍ asistió' : 'NO asistió'} a la ${cual} del ${fecha}.${borraCalificado}` };
    },
    ejecutar: (payload, ctx) => seguro('marcar la asistencia', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      const after = await updateLead(id, payload.cual === 'R2' ? { asistio_j2: payload.asistio === true } : { asistio_j1: payload.asistio === true });
      await logLeadChanges(id, before, after, autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Listo: ${before.nombre} quedó marcado como que ${payload.asistio === true ? 'asistió' : 'no asistió'} a la ${String(payload.cual)}.` };
    }),
  },
  marcar_calificado: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      // ⚠️ EL CANAL NO PUEDE SER MÁS ESTRICTO QUE LA FICHA. Antes exigía
      // `asistio_j1 === true`, que es la regla vieja: dejaba sin marcar a cualquier
      // lead de un funnel sin reuniones. El único caso que sigue rebotando es el que
      // `updateLead` descarta — consta que NO vino a una R1 con fecha.
      if (calificadoSeDescarta(lead)) return { error: `${lead.nombre} no asistió a la R1, así que el calificado se descarta. Corrige la asistencia primero (marcar_asistencia_reunion).` };
      const calificado = input.calificado === true;
      if (lead.calificado === calificado) return { error: `${lead.nombre} ya está marcado como ${calificado ? 'calificado' : 'no calificado'}.` };
      return { payload: { leadId: lead.id, calificado }, resumen: `Marcar a ${lead.nombre} como ${calificado ? 'CALIFICADO (manda la conversión a Meta)' : 'NO calificado'}.` };
    },
    ejecutar: (payload, ctx) => seguro('marcar el calificado', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      const after = await updateLead(id, { calificado: payload.calificado === true });
      await logLeadChanges(id, before, after, autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Listo: ${before.nombre} quedó ${payload.calificado === true ? 'calificado' : 'no calificado'}.` };
    }),
  },
  agregar_nota_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const t = String(input.texto ?? '').trim();
      return { payload: { leadId: lead.id, texto: t }, resumen: `Anotar en ${lead.nombre}: «${t.length > 160 ? `${t.slice(0, 160)}…` : t}»` };
    },
    ejecutar: (payload, ctx) => seguro('agregar la nota', async () => {
      await logLeadEvent(Number(payload.leadId), 'Nota', String(payload.texto), autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Nota agregada al historial del lead #${String(payload.leadId)}.` };
    }),
  },
  asignar_closer_setter: {
    preparar: async (input, ctx) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const pedidos = { closer: s(input.closer), setter: s(input.setter) };
      if (!pedidos.closer && !pedidos.setter) return { error: 'Pasa un closer, un setter o los dos.', faltan: ['closer', 'setter'] };
      const validos = await nombresAsignables(ctx.ws);
      const payload: Record<string, unknown> = { leadId: lead.id };
      const partes: string[] = [];
      for (const rol of ['closer', 'setter'] as const) {
        const pedido = pedidos[rol];
        if (!pedido) continue;
        if (pedido.toLowerCase() === MAKO_SETTER.toLowerCase()) return { error: 'MaKo no se asigna a mano: se asigna solo al pasar a una nutrición automática.' };
        const canon = validos.find((v) => v.toLowerCase() === pedido.toLowerCase());
        if (!canon) return { error: `«${pedido}» no es nadie del equipo ni un ${rol} ya usado en el CRM. Usa uno de los nombres válidos.`, disponibles: validos };
        payload[rol] = canon;
        partes.push(`${rol} ${lead[rol] ? `${lead[rol]} → ` : ''}${canon}`);
      }
      return { payload, resumen: `Asignar a ${lead.nombre}: ${partes.join(' · ')}.` };
    },
    ejecutar: (payload, ctx) => seguro('asignar closer o setter', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      await saveLeadMeta(id, { ...(payload.closer !== undefined ? { closer: String(payload.closer) } : {}), ...(payload.setter !== undefined ? { setter: String(payload.setter) } : {}) });
      await logLeadChanges(id, before, await getLead(id).catch(() => null), autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Listo: ${before.nombre} quedó con ${[payload.closer ? `closer ${String(payload.closer)}` : '', payload.setter ? `setter ${String(payload.setter)}` : ''].filter(Boolean).join(' y ')}.` };
    }),
  },
  mover_a_nutricion_manual: {
    preparar: async (input, ctx) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      if (!esFechaIso(input.deadline)) return { error: '«deadline» tiene que ser una fecha YYYY-MM-DD.' };
      const { hoy } = await hoyDelWorkspace(ctx.ws);
      if (input.deadline < hoy) return { error: `La fecha límite (${input.deadline}) ya pasó: hoy es ${hoy}.` };
      // DEL LEAD: la etapa 'manual' tiene que existir en el funnel por el que ÉL entró.
      const stages = await etapasDelFunnelDeLead(lead);
      if (!stageMetaOpt(stages, 'manual')) return { error: 'El funnel de este negocio no tiene la etapa de nutrición manual.' };
      const motivo = s(input.motivo);
      return { payload: { leadId: lead.id, deadline: input.deadline, ...(motivo ? { motivo } : {}) }, resumen: `Pasar a ${lead.nombre} a Nutrición manual hasta el ${input.deadline}${motivo ? ` (${motivo})` : ''}.` };
    },
    ejecutar: (payload, ctx) => seguro('pasar a nutrición manual', async () => {
      const id = Number(payload.leadId);
      const lead = await getLead(id);
      if (!lead) return { ok: false, resumen: noExiste(id) };
      // Mismo reparto que proponer_cambio_etapa: lo que falta y este canal no carga
      // no bloquea, pero queda DICHO en el historial ({ omitir }).
      const faltan = faltantesParaMover(lead, 'manual', await etapasDelFunnelDeLead(lead), {});
      const requisitos = faltan.length
        ? { omitir: `Pasado a Nutrición manual desde ${canalTxt(ctx)} con confirmación. Sigue sin cargar: ${labels(faltan)}.` }
        : 'validar' as const;
      await setPipelineStage(id, 'manual', { deadline: String(payload.deadline), requisitos, autor: autorDe(ctx) });
      const nota = [s(payload.motivo) ?? null, `vence ${String(payload.deadline)}`].filter(Boolean).join(' · ');
      await logLeadEvent(id, 'Nutrición manual', nota, autorDe(ctx));
      invalidar('leads', 'pagos');
      return { ok: true, resumen: `Listo: ${lead.nombre} quedó en Nutrición manual hasta el ${String(payload.deadline)}.${faltan.length ? ` Sigue sin cargar: ${labels(faltan)}.` : ''}` };
    }),
  },
  marcar_pago_cobrado: {
    preparar: async (input, ctx) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const pagos = await getPagosByLead(lead.id).catch(() => []);
      const pago = pagos.find((p) => p.id === input.pagoId);
      if (!pago) return { error: `La cuota #${String(input.pagoId)} no es de ${lead.nombre}. Pide cobranza_lead para ver sus cuotas.`, disponibles: pagos.map((p) => ({ pago_id: p.id, numero: p.numero, monto_usd: p.monto_usd, pagada: p.pagado })) };
      const pagado = input.pagado === true;
      if (pago.pagado === pagado) return { error: `Esa cuota ya está ${pagado ? 'marcada como cobrada' : 'sin cobrar'}.` };
      if (input.fechaPago !== undefined && !esFechaIso(input.fechaPago)) return { error: '«fechaPago» tiene que ser una fecha YYYY-MM-DD.' };
      const fechaPago = pagado ? (s(input.fechaPago) ?? (await hoyDelWorkspace(ctx.ws)).hoy) : null;
      const cuota = pago.numero === 0 ? 'el cobro inicial' : `la cuota ${pago.numero}`;
      return {
        payload: { pagoId: pago.id, leadId: lead.id, pagado, fechaPago },
        resumen: pagado
          ? `Marcar ${cuota} de ${lead.nombre} (${pago.monto_usd} USD) como cobrada el ${fechaPago}.`
          : `Desmarcar ${cuota} de ${lead.nombre} (${pago.monto_usd} USD): vuelve a figurar sin cobrar.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('marcar el pago', async () => {
      const pagado = payload.pagado === true;
      const fechaPago = typeof payload.fechaPago === 'string' ? payload.fechaPago : null;
      await marcarPago(Number(payload.pagoId), pagado, fechaPago);
      await logLeadEvent(Number(payload.leadId), pagado ? 'Pago registrado' : 'Pago desmarcado', pagado ? `Cuota marcada como pagada${fechaPago ? ` (${fechaPago})` : ''}` : 'Cuota desmarcada', autorDe(ctx));
      invalidar('pagos', 'leads');
      return { ok: true, resumen: pagado ? `Listo: cuota marcada como cobrada el ${fechaPago}.` : 'Listo: la cuota volvió a figurar sin cobrar.' };
    }),
  },
  ignorar_datos_sin_marcar: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      if (lead.pendientes_ignorados) return { error: `Los pendientes de ${lead.nombre} ya están ignorados desde ${lead.pendientes_ignorados}.` };
      return { payload: { leadId: lead.id }, resumen: `Ignorar los datos sin marcar de ${lead.nombre} (siguen visibles en su ficha).` };
    },
    ejecutar: (payload, ctx) => seguro('ignorar los pendientes', async () => {
      await marcarPendientesIgnorados(Number(payload.leadId), true, autorDe(ctx));
      return { ok: true, resumen: `Listo: los pendientes del lead #${String(payload.leadId)} ya no cuentan en «Datos sin marcar».` };
    }),
  },
  reactivar_datos_sin_marcar: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      if (!lead.pendientes_ignorados) return { error: `Los pendientes de ${lead.nombre} no están ignorados.` };
      return { payload: { leadId: lead.id }, resumen: `Volver a contar los datos sin marcar de ${lead.nombre}.` };
    },
    ejecutar: (payload, ctx) => seguro('reactivar los pendientes', async () => {
      await marcarPendientesIgnorados(Number(payload.leadId), false, autorDe(ctx));
      return { ok: true, resumen: `Listo: el lead #${String(payload.leadId)} vuelve a contar en «Datos sin marcar».` };
    }),
  },
  resolver_confirmacion_crm: {
    preparar: async (input) => {
      const cs = await listPendientes();
      const c = cs.find((x) => x.id === input.id);
      if (!c) return { error: `La confirmación #${String(input.id)} no está pendiente.`, disponibles: cs.map((x) => ({ id: x.id, lead: x.lead_nombre, titulo: x.titulo })) };
      const decision = String(input.decision ?? '').trim();
      const op = decision.startsWith('op:') ? (c.opciones ?? []).find((o) => o.key === decision.slice(3)) : undefined;
      if (decision !== 'confirmar' && decision !== 'rechazar' && !op) {
        return { error: `«${decision}» no es una decisión válida para esta confirmación.`, disponibles: ['confirmar', 'rechazar', ...(c.opciones ?? []).map((o) => `op:${o.key}`)] };
      }
      const que = decision === 'confirmar' ? 'Dejar' : decision === 'rechazar' ? 'Rechazar y revertir' : `Aplicar «${op!.label}» en`;
      return { payload: { id: c.id, decision }, resumen: `${que} el cambio automático «${c.titulo}» de ${c.lead_nombre ?? `lead #${c.lead_id}`}.` };
    },
    ejecutar: (payload, ctx) => seguro('resolver la confirmación', async () => {
      // resolverConfirmacion hace `return` sin error si ya no está pendiente: sin
      // esta lectura, «Listo» sería un éxito falso sobre lo que resolvió otra persona.
      const estado = await estadoConfirmacion(Number(payload.id));
      if (estado !== 'pendiente') return { ok: false, resumen: estado ? `La confirmación #${String(payload.id)} ya estaba resuelta (${estado}) por otra persona; no se cambió nada.` : `La confirmación #${String(payload.id)} ya no existe.` };
      await resolverConfirmacion(Number(payload.id), String(payload.decision), autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Listo: confirmación #${String(payload.id)} resuelta (${String(payload.decision)}).` };
    }),
  },
  generar_insight_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      return { payload: { leadId: lead.id }, resumen: `Generar con IA un diagnóstico comercial nuevo de ${lead.nombre}.` };
    },
    ejecutar: (payload) => seguro('generar el diagnóstico', async () => {
      const r = await generarInsightLead(Number(payload.leadId));
      if (!r.ok) return { ok: false, resumen: `No se generó: ${r.motivo}${r.faltantes?.length ? ` Falta: ${labels(r.faltantes)}.` : ''}` };
      const c = r.insight.contenido;
      return { ok: true, resumen: `Diagnóstico generado. ${c.resumen}${c.proxima_accion ? `\nPróxima acción: ${c.proxima_accion}` : ''}`, datos: { insight_id: r.insight.id } };
    }),
  },
  declarar_entradas_funnel: {
    preparar: async (input) => {
      const entradas = (Array.isArray(input.entradas) ? input.entradas : []) as EntradaId[];
      if (!entradas.length) return { error: 'Elige al menos una forma en la que llega la gente.', faltan: ['entradas'] };
      return { payload: { entradas }, resumen: `Declarar que la gente llega por: ${entradas.map((e) => ENTRADAS[e]?.label ?? e).join(' · ')}.` };
    },
    ejecutar: (payload) => seguro('declarar las entradas', async () => {
      const r = await guardarEntradas(payload.entradas as string[]);
      return r.ok ? { ok: true, resumen: 'Listo: quedó declarado cómo llega la gente al negocio.' } : { ok: false, resumen: r.error };
    }),
  },

  // ── Acciones pantalla (genérica /mako/revisar) ──────────────────────────────
  editar_contacto_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const campos = ['nombre', 'email', 'telefono', 'empresa'] as const;
      const email = s(input.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: `«${email}» no parece un email.` };
      const tel = s(input.telefono);
      if (tel && tel.replace(/\D/g, '').length < 8) return { error: `«${tel}» no parece un teléfono completo (con código de país).` };
      const payload: Record<string, unknown> = { leadId: lead.id };
      const cambios: string[] = [];
      for (const k of campos) {
        const v = s(input[k]);
        if (!v || v === (lead[k] ?? '')) continue;
        payload[k] = k === 'email' ? v.toLowerCase() : v;
        cambios.push(`${k}: ${lead[k] ?? '(vacío)'} → ${String(payload[k])}`);
      }
      if (!cambios.length) return { error: 'No hay nada que cambiar: pasa al menos un dato distinto del que ya tiene.' };
      // El alta chequea duplicados y la edición no lo hacía: un teléfono que ya tiene
      // otro lead parte el cruce con WhatsApp y Calendly. Se avisa, no se bloquea
      // (duplicadosDeLead devuelve vacío si la consulta falla).
      let avisoDup = '';
      if (payload.email !== undefined || payload.telefono !== undefined) {
        const dups = (await duplicadosDeLead({ nombre: null, email: (payload.email as string | undefined) ?? null, telefono: (payload.telefono as string | undefined) ?? null }))
          .filter((d) => d.lead.id !== lead.id);
        if (dups.length) avisoDup = ` ⚠️ Ya lo tiene ${dups.slice(0, 3).map((d) => `el lead #${d.lead.id} (${d.texto})`).join(', ')}.`;
      }
      return { payload, resumen: `Corregir el contacto de ${lead.nombre}: ${cambios.join(' · ')}.${avisoDup}` };
    },
    ejecutar: (payload, ctx) => seguro('editar el contacto', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      const meta: Record<string, string> = {};
      for (const k of ['nombre', 'email', 'telefono', 'empresa'] as const) if (typeof payload[k] === 'string') meta[k] = payload[k] as string;
      await saveLeadMeta(id, meta);
      await logLeadChanges(id, before, await getLead(id).catch(() => null), autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Listo: contacto de ${String(meta.nombre ?? before.nombre)} actualizado.` };
    }),
  },
  agregar_link_fathom: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const url = String(input.url ?? '').trim();
      if (!/^https:\/\/([a-z0-9-]+\.)*fathom\.video\//i.test(url)) return { error: 'El link tiene que ser una URL de Fathom (https://fathom.video/…).' };
      if ((lead.fathom_links ?? []).some((f) => f.url === url)) return { error: `Ese link ya está cargado en ${lead.nombre}.` };
      const cual = input.cual === 'R2' ? 'R2' : 'R1';
      return { payload: { leadId: lead.id, cual, url }, resumen: `Agregar a la ${cual} de ${lead.nombre} la grabación ${url}.` };
    },
    ejecutar: (payload, ctx) => seguro('agregar el link de Fathom', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      const url = String(payload.url);
      const actuales = (before.fathom_links ?? []) as FathomLink[];
      if (actuales.some((f) => f.url === url)) return { ok: true, resumen: 'Ese link ya estaba cargado.' };
      await saveLeadMeta(id, { fathom_links: [...actuales, { label: payload.cual === 'R2' ? 'Reunión 2' : 'Reunión 1', url }] });
      await logLeadChanges(id, before, await getLead(id).catch(() => null), autorDe(ctx));
      invalidar('leads');
      return { ok: true, resumen: `Listo: grabación agregada a la ${String(payload.cual)} de ${before.nombre}.` };
    }),
  },
  marcar_reunion_manual: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      if (!esFechaIso(input.fecha)) return { error: '«fecha» tiene que ser una fecha YYYY-MM-DD.' };
      const cual = input.which === 'agendaj2' ? 'R2' : 'R1';
      const asistio = b(input.asistio);
      // setMeetingManual REABRE todo lead no abierto, y updateLead con cerro=null pone
      // monto_cierre_usd y fecha_cierre en null: cargar una fecha borraría el ingreso.
      if (lead.estado_lead === 'ganado') {
        return { error: `${lead.nombre} está GANADO: cargar la reunión lo reabre y borra su monto de cierre (${lead.monto_cierre_usd ?? 'sin monto'} USD) y su fecha de cierre (${lead.fecha_cierre ?? 'sin fecha'}). Eso se hace desde la ficha del lead, no por aquí.` };
      }
      const reabre = lead.estado_lead !== 'abierto'
        ? ` ⚠️ ${lead.nombre} está «${lead.estado_lead}»: se REABRE${lead.motivo_perdida ? ` y se borra el motivo («${lead.motivo_perdida}»)` : ''}.`
        : '';
      // Mismo efecto de updateLead que en marcar_asistencia_reunion: R1 no asistida borra el calificado.
      const borraCalificado = asistio === false && input.which !== 'agendaj2' && lead.calificado != null
        ? ` ⚠️ Se borra el calificado (hoy: ${lead.calificado ? 'calificado' : 'no calificado'}).` : '';
      const nota = s(input.notaExcepcion);
      return {
        payload: { leadId: lead.id, which: input.which, fecha: input.fecha, ...(asistio !== undefined ? { asistio } : {}), ...(nota ? { notaExcepcion: nota } : {}) },
        resumen: `Cargar a mano la ${cual} de ${lead.nombre} el ${input.fecha}${asistio === undefined ? '' : asistio ? ' (asistió)' : ' (no asistió)'}.${reabre}${borraCalificado}`,
      };
    },
    ejecutar: (payload, ctx) => seguro('cargar la reunión', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      await setMeetingManual(id, payload.which === 'agendaj2' ? 'agendaj2' : 'agenda', String(payload.fecha), b(payload.asistio) ?? null);
      if (s(payload.notaExcepcion)) await logLeadEvent(id, 'Agendada fuera de Calendly', String(payload.notaExcepcion), autorDe(ctx));
      await logLeadChanges(id, before, await getLead(id).catch(() => null), autorDe(ctx));
      invalidar('leads', 'pagos');
      return { ok: true, resumen: `Listo: reunión de ${before.nombre} cargada el ${String(payload.fecha)}.` };
    }),
  },
  guardar_plan_pagos: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const plan = { cobro_inicial_usd: n(input.cobro_inicial_usd) ?? null, monto_cuota_usd: n(input.monto_cuota_usd) ?? null, total_cuotas: n(input.total_cuotas) ?? null, dia_de_pago: n(input.dia_de_pago) ?? null };
      if (plan.cobro_inicial_usd == null && plan.monto_cuota_usd == null) return { error: 'Pasa al menos el cobro inicial o el monto de la cuota (en USD).', faltan: ['cobro_inicial_usd', 'monto_cuota_usd'] };
      if (plan.monto_cuota_usd != null && plan.total_cuotas == null) return { error: 'Con monto de cuota hace falta la cantidad de cuotas (1 a 6).', faltan: ['total_cuotas'] };
      const partes = [plan.cobro_inicial_usd != null ? `inicial ${plan.cobro_inicial_usd} USD` : '', plan.monto_cuota_usd != null ? `${plan.total_cuotas} cuota(s) de ${plan.monto_cuota_usd} USD` : '', plan.dia_de_pago != null ? `día ${plan.dia_de_pago}` : ''].filter(Boolean);
      return { payload: { leadId: lead.id, ...plan }, resumen: `Plan de pagos de ${lead.nombre}: ${partes.join(', ')}. Reemplaza las cuotas no pagadas.` };
    },
    ejecutar: (payload, ctx) => seguro('guardar el plan de pagos', async () => {
      const id = Number(payload.leadId);
      const { hoy } = await hoyDelWorkspace(ctx.ws);
      const cuotas = await savePlanPagos(id, { cobro_inicial_usd: n(payload.cobro_inicial_usd) ?? null, monto_cuota_usd: n(payload.monto_cuota_usd) ?? null, total_cuotas: n(payload.total_cuotas) ?? null, dia_de_pago: n(payload.dia_de_pago) ?? null }, hoy);
      await logLeadEvent(id, 'Plan de pagos', `Plan guardado desde ${canalTxt(ctx)} (${cuotas.length} fila(s) de pago)`, autorDe(ctx));
      invalidar('pagos', 'leads');
      return { ok: true, resumen: `Listo: plan de pagos guardado (${cuotas.length} fila(s) de pago).` };
    }),
  },
  guardar_cuotas: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const cuotas = (Array.isArray(input.cuotas) ? input.cuotas : []) as Array<Record<string, unknown>>;
      for (const [i, c] of cuotas.entries()) {
        if (c.fecha_esperada !== undefined && !esFechaIso(c.fecha_esperada)) return { error: `La cuota ${i + 1} tiene una fecha que no es YYYY-MM-DD.` };
      }
      for (const k of ['fecha_cierre', 'fecha_inicio'] as const) if (input[k] !== undefined && !esFechaIso(input[k])) return { error: `«${k}» tiene que ser una fecha YYYY-MM-DD.` };
      const validas = cuotas.filter((c) => (n(c.monto_usd) ?? 0) > 0);
      if (!validas.length) return { error: 'Ninguna cuota tiene un monto mayor que cero.', faltan: ['cuotas'] };
      const total = validas.reduce((a, c) => a + (n(c.monto_usd) ?? 0), 0);
      const aviso = lead.estado_lead !== 'ganado' ? ` ⚠️ Esto marca a ${lead.nombre} como GANADO (hoy está «${lead.estado_lead}»).` : '';
      return {
        payload: { leadId: lead.id, cuotas: validas.map((c) => ({ monto_usd: n(c.monto_usd), fecha_esperada: s(c.fecha_esperada) ?? null })), total_usd: n(input.total_usd) ?? null, duracion_meses: n(input.duracion_meses) ?? null, fecha_cierre: s(input.fecha_cierre) ?? null, fecha_inicio: s(input.fecha_inicio) ?? null },
        resumen: `Reemplazar las cuotas sin pagar de ${lead.nombre} por ${validas.length} cuota(s) que suman ${Math.round(total * 100) / 100} USD.${aviso}`,
      };
    },
    ejecutar: (payload, ctx) => seguro('guardar las cuotas', async () => {
      const id = Number(payload.leadId);
      const before = await getLead(id);
      if (!before) return { ok: false, resumen: noExiste(id) };
      const cuotas = (payload.cuotas as Array<{ monto_usd: number; fecha_esperada: string | null }>) ?? [];
      await saveLeadPlanManual(id, { total_usd: n(payload.total_usd) ?? null, duracion_meses: n(payload.duracion_meses) ?? null, fecha_cierre: s(payload.fecha_cierre) ?? null, fecha_inicio: s(payload.fecha_inicio) ?? null, cuotas });
      await logLeadEvent(id, 'Plan de pagos', `Cuotas actualizadas desde ${canalTxt(ctx)} (${cuotas.length} sin pagar)`, autorDe(ctx));
      // saveLeadPlanManual escribe estado_lead con un update directo que no audita:
      // el diff deja en el historial que el lead pasó a ganado y quién lo hizo.
      await logLeadChanges(id, before, await getLead(id).catch(() => null), autorDe(ctx));
      invalidar('pagos', 'leads');
      return { ok: true, resumen: `Listo: ${cuotas.length} cuota(s) guardadas para ${before.nombre}; el lead quedó como ganado.` };
    }),
  },
  guardar_deal_details: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      // Los parámetros son PLANOS (la pantalla genérica pinta cada uno como campo) y el
      // payload vuelve a las secciones que guarda guardarDeal: `<seccion>_<campo>`.
      for (const k of ['servicio_fecha_inicio', 'servicio_fecha_termino'] as const) if (input[k] !== undefined && !esFechaIso(input[k])) return { error: `«${k}» tiene que ser una fecha YYYY-MM-DD.` };
      if (typeof input.facturado_por_id === 'number' && !(await existeIdentidadFiscal(input.facturado_por_id))) return { error: `No existe la identidad fiscal #${input.facturado_por_id} en este workspace.` };
      const payload: Record<string, unknown> = { leadId: lead.id };
      const lineas: string[] = [];
      for (const [seccion, campos] of Object.entries(CAMPOS_DEAL)) {
        const sec: Record<string, unknown> = {};
        for (const c of campos) {
          const v = input[`${seccion}_${c}`];
          const limpio = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : s(v);
          if (limpio === undefined) continue;
          sec[c] = limpio;
          lineas.push(`${seccion}.${c}: ${Array.isArray(limpio) ? limpio.join(' | ') : limpio}`);
        }
        if (Object.keys(sec).length) payload[`deal_${seccion}`] = sec;
      }
      if (typeof input.facturado_por_id === 'number') { payload.facturado_por_id = input.facturado_por_id; lineas.push(`facturado por: identidad #${input.facturado_por_id}`); }
      if (!lineas.length) return { error: 'Pasa al menos un campo del Deal Details.', faltan: ['fiscal_razon', 'servicio_que_es', 'promesa_resultado', 'facturado_por_id'] };
      const aviso = lead.estado_lead !== 'ganado' ? ` (ojo: ${lead.nombre} hoy está «${lead.estado_lead}», no ganado)` : '';
      return { payload, resumen: `Guardar en el Deal Details de ${lead.nombre}${aviso}: ${lineas.join(' · ')}.` };
    },
    ejecutar: (payload, ctx) => seguro('guardar el Deal Details', async () => {
      const lead = await getLead(Number(payload.leadId));
      if (!lead) return { ok: false, resumen: noExiste(payload.leadId) };
      const tocadas = await guardarDeal(lead, payload, autorDe(ctx));
      return tocadas.length ? { ok: true, resumen: `Listo: Deal Details de ${lead.nombre} guardado (${tocadas.join(', ')}).` } : { ok: false, resumen: 'No había nada que guardar.' };
    }),
  },
  activar_crm_automatico: {
    preparar: async (input) => {
      const on = input.on === true;
      if ((await crmAutoHabilitado()) === on) return { error: `El CRM automático ya está ${on ? 'prendido' : 'apagado'}.` };
      return { payload: { on }, resumen: on ? 'PRENDER el CRM automático: MaKo va a mover leads de toda la cartera en la próxima corrida (con confirmación posterior).' : 'Apagar el CRM automático: MaKo deja de mover leads solo.' };
    },
    ejecutar: (payload) => seguro('cambiar el CRM automático', async () => {
      await setCrmAuto(payload.on === true);
      return { ok: true, resumen: `Listo: CRM automático ${payload.on === true ? 'prendido' : 'apagado'}.` };
    }),
  },
  guardar_producto: {
    preparar: async (input) => {
      const id = n(input.id);
      const existente = id ? (await listProductos()).find((p) => p.id === id) : undefined;
      if (id && !existente) return { error: `No existe el producto #${id} en este workspace. Pide listar_productos.` };
      // MERGE con lo guardado: upsertProducto pone en null todo texto que no venga, y
      // editar solo el precio borraba promesa, incluye y garantía. El tipo también:
      // obligatorio al crear, y al editar sin tipo se conserva el guardado.
      const tipoPedido = input.tipo === 'suscripcion' || input.tipo === 'unico' ? input.tipo : undefined;
      const tipo = tipoPedido ?? existente?.tipo;
      if (tipo !== 'unico' && tipo !== 'suscripcion') return { error: 'Para crear un producto pasa el tipo: unico o suscripcion.', faltan: ['tipo'] };
      const cambiaTipo = existente && tipoPedido && existente.tipo !== tipoPedido
        ? ` ⚠️ Cambia el tipo de ${existente.tipo} a ${tipoPedido}${tipoPedido === 'unico' ? ' y se borra el plazo de la suscripción' : ''}.` : '';
      const payload: Record<string, unknown> = {
        ...(id ? { id } : {}),
        nombre: String(input.nombre).trim(), tipo,
        monto_usd: n(input.monto_usd) ?? existente?.monto_usd ?? null,
        suscripcion_meses: tipo === 'suscripcion' ? (n(input.suscripcion_meses) ?? existente?.suscripcion_meses ?? null) : null,
        promesa: s(input.promesa) ?? existente?.promesa ?? null,
        incluye: s(input.incluye) ?? existente?.incluye ?? null,
        garantia: s(input.garantia) ?? existente?.garantia ?? null,
        descripcion: existente?.descripcion ?? null,
        activo: b(input.activo) ?? existente?.activo ?? true,
      };
      const precio = payload.monto_usd != null ? `${String(payload.monto_usd)} USD${tipo === 'suscripcion' ? ' al mes' : ''}` : 'sin precio';
      return { payload, resumen: `${existente ? `Editar el producto «${existente.nombre}»` : 'Crear el producto'} «${String(payload.nombre)}» (${tipo === 'suscripcion' ? 'suscripción' : 'pago único'}, ${precio}).${cambiaTipo}` };
    },
    ejecutar: (payload) => seguro('guardar el producto', async () => {
      const id = n(payload.id);
      const nuevoId = await upsertProducto({
        nombre: String(payload.nombre), tipo: payload.tipo === 'suscripcion' ? 'suscripcion' : 'unico',
        monto_usd: n(payload.monto_usd) ?? null, suscripcion_meses: n(payload.suscripcion_meses) ?? null,
        promesa: s(payload.promesa) ?? null, incluye: s(payload.incluye) ?? null, garantia: s(payload.garantia) ?? null,
        descripcion: s(payload.descripcion) ?? null, activo: b(payload.activo) ?? true,
      }, id);
      return { ok: true, resumen: `Listo: producto «${String(payload.nombre)}» ${id ? 'actualizado' : 'creado'}.`, datos: { producto_id: nuevoId } };
    }),
  },

  // ── Acción pantalla con pantalla propia (/crm/revisar) ──────────────────────
  proponer_leads: {
    proponer: async (input, ctx) => {
      const r = await proponerLote(ctx.ws, (input.leads as Array<Record<string, unknown>>) ?? [], s(input.origen) ?? null, s(input.ref) ?? null, origenPropuesta(ctx));
      if ('error' in r) return { error: r.error ?? 'ningún contacto válido' };
      return { id: r.id, url: `${APP_BASE_URL}/crm/revisar/${r.id}`, nueva: r.nueva, extra: { leads: r.leads, ...(r.descartados.length ? { descartados: r.descartados } : {}) } };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Esta propuesta se confirma en su pantalla de revisión, no por aquí.' }),
  },
};
