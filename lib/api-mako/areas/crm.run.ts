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
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import { crearRunnerAcciones, ejecutarAccion } from '@/lib/mako-doer-acciones';
import {
  getLead, updateLead, logLeadChanges, logLeadEvent, getLeadAudit, faltantesParaMover, saveLeadMeta,
  setMeetingManual, setPipelineStage, duplicadosDeLead, getTrackingEvents, getVslEngagement,
  contarVisitasLanding, esRequisitosFaltantes, type Lead, type FathomLink,
} from '@/lib/leads';
import { getFunnelDefault } from '@/lib/funnels';
import { salidasDeEtapa, stageMetaOpt, ENTRADAS, MAKO_SETTER, type EntradaId } from '@/lib/pipeline';
// «Nuevo CRM» por su tipo (14/10/2026): el catálogo puro y el alta que comparte con el modal.
import { TIPOS_CRM, TIPO_CRM_OTRO, ENTRADAS_OFRECIDAS, siembraDeCrm, tipoCrmPorId } from '@/lib/pipeline';
import { CANALES, esCanal } from '@/lib/fase-diagnostico';
import { FUNNEL_DEFAULT_NOMBRE } from '@/lib/funnel-fila';
import { crearCrm } from '@/lib/nuevo-crm';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
// El candado de «calificado»: el mismo que aplica updateLead y que dibuja la ficha.
import { calificadoSeDescarta } from '@/lib/calificado-reunion';
import { getJuntasProximas } from '@/lib/queries';
import { getLeadPlan, getPagosByLead, savePlanPagos, saveLeadPlanManual, marcarPago, cobrarCuota, registrarPagoSuelto } from '@/lib/pagos';
import { avisoDeConservadas } from '@/lib/pagos-campo';
// Sólo para la lectura cobranza_lead (14/10/2026): lo cobrado con la misma cuenta que la ficha.
import { cobradoDelLead, esCuotaDevuelta } from '@/lib/cobrado-lead';
import { listarCobros } from '@/lib/cobros';
import { centavos, diferenciaPendiente, type RestoDeCobro } from '@/lib/pagos-diferencia';
import { getResumenLead, linkResumenLead } from '@/lib/lead-resumen';
import { getWorkspaceActual } from '@/lib/workspace';
import { getUltimoInsightGenerado, generarInsightLead } from '@/lib/lead-insights';
import { buildJourney } from '@/lib/journey';
import { propuestasPendientes, crearPropuesta } from '@/lib/propuestas';
import { listarProspectos } from '@/lib/prospectos';
import { FUENTES_PROSPECCION, contactable, rotuloDeBusqueda } from '@/lib/prospectos-reglas';
import { getSetting } from '@/lib/settings';
import { listPendientes, resolverConfirmacion } from '@/lib/mako-confirmaciones';
import { evaluarAutoWorkspace } from '@/lib/crm-auto';
import { crmAutoHabilitado, setCrmAuto, KEY_CRM_AUTO } from '@/lib/envio-flags';
import {
  horariosLibresDeGoogle, permisoCalendarioGoogle, crearEventoDeReunion, moverEventoDeReunion,
  proximasReunionesCon, choquesEnAgenda, eventosDelDia, cambiarEventoDeReunion, cancelarEventoDeReunion,
} from '@/lib/google-calendar';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
// La agenda de Google no pasa por el modelo: lo que se lee va a la persona
// (`paraLaPersona`) y el modelo recibe un estado o un resumen sin datos de la agenda.
import {
  cuandoLegible, minutosDeHora, salidaHorarios, salidaReunionesDeLead, salidaDelDia, propuestaAgendar, elegirReunion, propuestaMover,
  propuestaCambiar, propuestaCancelar, noPudeLeerDia, yaPaso, resultadoAgendar, resultadoMover, resultadoCambiar, resultadoCancelar,
  historialAgendar, historialMover, historialCambiar, historialCancelar, type EventoDia,
} from '@/lib/agenda-sin-ia';
// Puro (sin server-only): la misma conversión hora-de-pared → instante que usa la
// grilla del CRM, con el salto de horario de verano resuelto. No se escribe otra.
import { instanteDeLocal, DURACION_DEFECTO_MIN } from '@/app/crm/horarios-respuesta';
import { eventTypeDeReunion, linkParaAgendar } from '@/lib/calendly-agenda';
import { listReviewPendientes } from '@/lib/review-queue';
import { listProductos, upsertProducto } from '@/lib/productos';
import { productosDelLead, agregarAProducto, quitarDeProducto, moverEtapaEnProducto } from '@/lib/lead-funnel';
// El evento de agenda vinculado a una etapa de reunión (16/10/2026): las mismas funciones que la pantalla.
import {
  listarEventosDeAgenda, prepararVinculo, vincularEvento, buscarVinculo, desvincularEvento, type AgendaDelNegocio,
} from '@/lib/agenda-evento-etapa-server';
import { puedeQuitar, aQuienPromover, etapaDeEntrada, type ProductoDelLead } from '@/lib/lead-funnel-reglas';
import {
  listarEtiquetas, etiquetaPorId, etiquetasDeLead, conteoPorEtiqueta, crearEtiqueta, editarEtiqueta,
  archivarEtiqueta, usoDeEtiqueta, ponerEtiqueta, sacarEtiqueta, catalogoWhatsApp, esEtiquetaError,
  type Etiqueta, type EntradaEtiqueta, type ResultadoPoner,
} from '@/lib/etiquetas';
import { limpiarNombreEtiqueta, claveNombre, colorValido, emojiValido, consecuenciaDeArchivar, autorPublico } from '@/lib/etiquetas-reglas';
import { linkApp, APP_BASE_URL } from '@/lib/app-url';
import { ofertasDelLead, asignarOfertaAlLead, crearOfertaParaLead } from '@/lib/oferta-lead';
import { validarOfertaNueva } from '@/lib/oferta-modelo';
import { usuarioInstagram } from '@/app/crm/campo-inline';
import { sugerenciasDeUnCrm, volverAMostrar } from '@/lib/sugerencias-crm-server';
import { plantillaPorId } from '@/lib/plantillas-automatizaciones';
import {
  invalidar, hoyDelWorkspace, esFechaIso, etapasDelFunnelDefault, etapasDelFunnelDeLead, leadsFiltrados, conteoPorEtapa,
  nombresAsignables, ignorarDatosDeUnLead, todoIgnorado, algoIgnorado, datosSinMarcarDeUnLead, guardarEntradas, guardarDeal,
  existeIdentidadFiscal, proponerLote, estadoConfirmacion, productosCrm, type ProductoCrm,
} from './crm.helpers';
import { leerFichaDeFunnel, cambiarFichaDeFunnel, type FichaDelFunnel } from '@/lib/ficha/config-server';
import { aplicarCambio, describirCambio, sanearCambio } from '@/lib/ficha/config';
import { cambioDeInputApi, salidaFichaApi } from '@/lib/ficha/api';

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

/** Lo que edita `editar_contacto_lead`: los datos de «Información principal» (mig 0194, 0258, 0274). */
const CAMPOS_CONTACTO = ['nombre', 'email', 'telefono', 'empresa', 'web', 'instagram', 'youtube', 'linkedin', 'direccion', 'sexo'] as const;

/** El lead por id, o null (no existe en ESTE workspace o falló la lectura). No lanza. */
const leadDe = (id: unknown): Promise<Lead | null> => (typeof id === 'number' ? getLead(id).catch(() => null) : Promise.resolve(null));
const noExiste = (id: unknown) => `No existe el lead #${String(id)} en este workspace. Búscalo con buscar_leads.`;

/** Lecturas por lead: el «no existe» es un error del que llama (400), no nuestro. */
async function conLead(input: Record<string, unknown>, fn: (lead: Lead) => Promise<SalidaLectura>) {
  const lead = await leadDe(input.leadId);
  return lead ? fn(lead) : fallo(noExiste(input.leadId));
}

// ── agenda de Google ──────────────────────────────────────────────────────────

/** Fecha y hora para el chat, en la zona del NEGOCIO (no la de quien mira). */
const cuando = cuandoLegible;
/** «HH:MM» (24 h) → minutos desde medianoche, o null. */
const minutosDe = minutosDeHora;

/**
 * La fecha y la hora que dijo la persona → el instante EXACTO, en la zona del negocio.
 *
 * ⚠️ El modelo pasa «2026-10-09» y «10:30», nunca un ISO: la aritmética de husos no la
 * hace un modelo («un dato exacto que pasa por un modelo deja de ser exacto»). Y se
 * exige futuro con margen: agendar algo que empieza en dos minutos es mandar una
 * invitación que llega tarde.
 */
async function instanteEnZona(ws: number, fecha: unknown, hora: unknown): Promise<{ iso: string; tz: string } | { error: string }> {
  if (!esFechaIso(fecha)) return { error: '«fecha» tiene que ser una fecha YYYY-MM-DD.' };
  const min = minutosDe(hora);
  if (min == null) return { error: '«hora» tiene que ser HH:MM en 24 h (ej. 10:30).' };
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  const iso = instanteDeLocal(fecha, min, tz);
  if (!iso) return { error: 'No pude armar esa fecha y hora.' };
  if (Date.parse(iso) < Date.now() + 5 * 60_000) return { error: `El ${cuando(iso, tz)} ya pasó o es en menos de 5 minutos.` };
  return { iso, tz };
}

/** null si se puede escribir en la agenda; si no, el motivo para la persona. */
async function agendaParaEscribir(): Promise<string | null> {
  const p = await permisoCalendarioGoogle();
  if (!p.conectado) return 'Este negocio no tiene una agenda de Google conectada. Se conecta en Integraciones → Google Calendar.';
  if (!p.puedeMover) return 'La agenda de Google está conectada con permiso de solo lectura: hay que reconectarla en Integraciones para poder agendar o mover.';
  return null;
}

/**
 * Entre qué reuniones se elige la que nombró la persona, para mover, cambiar o cancelar:
 * con un lead, las suyas; sin lead, las del día que dijo (`fecha_actual`). Los errores
 * llevan sólo lo que dijo la persona o el CRM: la lectura de la agenda se queda adentro.
 */
async function reunionesAElegir(input: Record<string, unknown>, ctx: Ctx): Promise<
  { lead: Lead | null; todas: EventoDia[]; fechaActual: string | null; horaActual: string | null; tz: string }
  | { error: string; paraLaPersona?: string }
> {
  const fechaActual = input.fecha_actual === undefined || input.fecha_actual === null ? null : input.fecha_actual;
  if (fechaActual != null && !esFechaIso(fechaActual)) return { error: '«fecha_actual» tiene que ser YYYY-MM-DD: el día que tiene la reunión, como lo dijo la persona.' };
  const horaActual = s(input.hora_actual) ?? null;
  if (horaActual != null && minutosDe(horaActual) == null) return { error: '«hora_actual» tiene que ser HH:MM en 24 h (ej. 10:30).' };
  let lead: Lead | null = null;
  if (input.leadId !== undefined && input.leadId !== null) {
    lead = await leadDe(input.leadId);
    if (!lead) return { error: noExiste(input.leadId) };
    if (!lead.email) return { error: `${lead.nombre} no tiene email cargado: sin email no se reconoce su reunión en la agenda. Si es un evento sin invitados, búscalo por el día (fecha_actual) sin el lead.` };
  } else if (!fechaActual) {
    return { error: 'Sin lead, la reunión se busca por el día: pasa fecha_actual (el día que tiene, como lo dijo la persona) y, si la dijo, hora_actual.' };
  }
  const sinAgenda = await agendaParaEscribir();
  if (sinAgenda) return { error: sinAgenda };
  const tz = await tzDeWorkspace(ctx.ws).catch(() => TZ_DEFAULT);
  if (lead?.email) return { lead, todas: await proximasReunionesCon(lead.email), fechaActual, horaActual, tz };
  const dia = await eventosDelDia(fechaActual!, tz);
  if (!dia.ok) return noPudeLeerDia({ fecha: fechaActual!, codigo: dia.codigo, motivo: dia.motivo });
  return { lead: null, todas: dia.eventos, fechaActual, horaActual, tz };
}

/** Con quién era la reunión, para el resumen y el historial. Sin lead, vacío; una
 *  pendiente de antes del 07/10 con lead y sin nombre, «el lead». */
const conQuienDe = (payload: Record<string, unknown>): string =>
  (payload.leadId == null ? '' : String(payload.leadNombre ?? '').trim() || 'el lead');
const leadIdDe = (payload: Record<string, unknown>): number | null => (payload.leadId == null ? null : Number(payload.leadId));

/** Lo que pasó afuera ya pasó: si el historial falla, no se reporta como fallo de la acción. */
async function anotar(leadId: number, titulo: string, texto: string, autor: string): Promise<void> {
  try { await logLeadEvent(leadId, titulo, texto, autor); }
  catch (e) { console.error(`[api-mako crm] historial del lead ${leadId}:`, e instanceof Error ? e.message : String(e)); }
}

// ── etiquetas del CRM (mig 0224) ──────────────────────────────────────────────

const noExisteEtiqueta = (id: unknown) => `No existe la etiqueta #${String(id)} en este negocio. Pide el etiquetaId con listar_etiquetas.`;
const etiquetaDeInput = (id: unknown): Promise<Etiqueta | null> => (typeof id === 'number' ? etiquetaPorId(id).catch(() => null) : Promise.resolve(null));

/** Lo que se ve de una etiqueta: el vínculo con su producto y su etapa por NOMBRE, no ids sueltos. */
function vistaEtiqueta(e: Etiqueta, productos: ProductoCrm[] | null, leads?: number | null) {
  const p = e.etapa_key ? (productos?.find((x) => (e.funnel_id == null ? x.esDefault : x.embudoId === e.funnel_id)) ?? null) : null;
  return {
    id: e.id, nombre: e.nombre, color: e.color, emoji: e.emoji,
    etapa: e.etapa_key ? { key: e.etapa_key, label: p ? etiquetaDe(p, e.etapa_key) : e.etapa_key, embudoId: p?.embudoId ?? e.funnel_id, producto: p?.nombre ?? null } : null,
    whatsapp: e.wa_label_id ? { labelId: e.wa_label_id, linea: e.wa_instance } : null,
    archivada: Boolean(e.archivada_at),
    ...(leads !== undefined ? { leads } : {}),
  };
}

/**
 * El vínculo a una etapa que pidió el input, contra las etapas REALES del producto. Sin `etapa`, no
 * hay vínculo que cambiar (`{}`). Sin `embudoId`, el producto principal del negocio.
 */
async function vinculoDeInput(input: Record<string, unknown>): Promise<{ vinculo?: { funnelId: number | null; etapaKey: string }; texto?: string } | { error: string; disponibles?: unknown }> {
  const etapa = s(input.etapa);
  if (!etapa) return {};
  const productos = await productosCrm();
  if (!productos) return { error: NO_LEI_PRODUCTOS };
  const emb = n(input.embudoId);
  const p = emb != null ? productos.find((x) => x.embudoId === emb) : productos.find((x) => x.esDefault);
  if (!p) return { error: emb != null ? `No existe el funnel #${emb} en el CRM de este negocio.` : 'No encontré el funnel principal del negocio.', disponibles: productos.map((x) => ({ embudoId: x.embudoId, nombre: x.nombre })) };
  const st = p.etapas.find((x) => x.key === etapa);
  if (!st) return { error: `«${etapa}» no es una etapa de «${p.nombre}».`, disponibles: p.etapas.map((x) => ({ key: x.key, label: x.label })) };
  return { vinculo: { funnelId: p.esDefault ? null : p.embudoId, etapaKey: etapa }, texto: `vinculada a «${st.label}» de «${p.nombre}»` };
}

/** La etiqueta del celular que pidió el input, contra el catálogo guardado. */
async function whatsappDeInput(input: Record<string, unknown>): Promise<{ labelId?: string; texto?: string } | { error: string; disponibles?: unknown }> {
  const id = s(input.waLabelId);
  if (!id) return {};
  const cat = await catalogoWhatsApp().catch(() => null);
  if (!cat) return { error: 'No se pudieron leer las etiquetas del WhatsApp del celular.' };
  const l = cat.find((x) => x.labelId === id);
  if (!l) return { error: `La etiqueta «${id}» no está en el WhatsApp del celular. Las de WhatsApp se crean en el celular.`, disponibles: cat.map((x) => ({ labelId: x.labelId, nombre: x.nombre })) };
  return { labelId: id, texto: `en WhatsApp «${l.nombre}»` };
}

/** Lo que salió mal afuera, en una frase, para el resumen. */
const fallosSync = (r: Extract<ResultadoPoner, { ok: true }>): string => {
  const mal = r.sync.filter((x) => !x.ok);
  return mal.length ? ` No se pudo en ${mal.map((x) => x.destino).join(' ni ')} (quedó en el historial).` : '';
};

/**
 * La consecuencia de archivar, para el resumen de la propuesta: la MISMA frase que la confirmación
 * del CRUD (`consecuenciaDeArchivar`, lib/etiquetas-reglas.ts). Revisión del 08/10/2026
 * (etiquetas-6, datos-5): cada una tenía su redacción y la de acá prometía que las condiciones
 * «dejan de cumplirse» cuando el motor todavía las cumplía. La decisión ahora es que archivar la
 * APAGA (el motor la excluye) y la frase dice eso. Un número que no se pudo leer se dice.
 */
function usoTexto(u: Awaited<ReturnType<typeof usoDeEtiqueta>>): string {
  const frase = consecuenciaDeArchivar(u);
  return frase ? `. ${frase.replace(/\.$/, '')}` : '';
}

// ── un lead en varios productos (mig 0207) ────────────────────────────────────

const NO_LEI_PRODUCTOS = 'No se pudieron leer los funnels del CRM de este negocio.';
const etiquetaDe = (p: ProductoCrm, key: string | null | undefined): string => p.etapas.find((e) => e.key === key)?.label ?? key ?? 'sin etapa';

/** Lo que las tres acciones validan antes de proponer: el lead en ESTE negocio (getLead scopea),
 *  el producto por su embudo, y en cuáles está el lead. Un id que no es de acá no existe. */
async function leadYProducto(input: Record<string, unknown>): Promise<
  | { error: string; disponibles?: unknown }
  | { lead: Lead; producto: ProductoCrm; productos: ProductoCrm[]; suyos: ProductoDelLead[]; enEse: ProductoDelLead | null }
> {
  const lead = await leadDe(input.leadId);
  if (!lead) return { error: noExiste(input.leadId) };
  const productos = await productosCrm();
  if (!productos) return { error: NO_LEI_PRODUCTOS };
  const id = Number(input.embudoId);
  const producto = productos.find((p) => p.embudoId === id);
  if (!producto) {
    return {
      error: `No existe el funnel #${String(input.embudoId)} en el CRM de este negocio. Pide el embudoId con productos_del_lead.`,
      disponibles: productos.map((p) => ({ embudoId: p.embudoId, nombre: p.nombre })),
    };
  }
  const { productos: suyos } = await productosDelLead(lead.id);
  return { lead, producto, productos, suyos, enEse: suyos.find((p) => p.funnelId === id) ?? null };
}

/** Los nombres para el resumen de lo que ya se hizo. Si la lectura falla, los ids: lo escrito ya
 *  está escrito, y un nombre que no se pudo leer no lo vuelve un fallo. */
async function nombresDe(leadId: number, embudoId: number): Promise<{ lead: string; producto: string; etapa: (key: string | null | undefined) => string }> {
  const [lead, productos] = await Promise.all([leadDe(leadId), productosCrm().catch(() => null)]);
  const p = productos?.find((x) => x.embudoId === embudoId);
  return { lead: lead?.nombre ?? `el lead #${leadId}`, producto: p?.nombre ?? `el funnel #${embudoId}`, etapa: (key) => (p ? etiquetaDe(p, key) : key ?? 'sin etapa') };
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

// ── la ficha del lead por bloques (ver_ficha_funnel, cambiar_ficha_funnel) ────

/** La ficha del CRM pedido (sin embudoId, el principal), o el error con los CRM que hay. */
async function fichaDelCrm(embudoId: unknown): Promise<FichaDelFunnel | { error: string; disponibles?: unknown }> {
  const pedido = n(embudoId) ?? null;
  let f: FichaDelFunnel | null;
  try { f = await leerFichaDeFunnel(pedido); } catch { return { error: 'No pude leer ese CRM. Intenta de nuevo.' }; }
  if (f) return f;
  const crms = await productosCrm().catch(() => null);
  return { error: pedido == null ? 'Este negocio todavía no tiene un CRM.' : `El CRM #${pedido} no es de este negocio.`, disponibles: crms?.map((p) => ({ embudoId: p.embudoId, nombre: p.nombre })) };
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
      const [{ faltan, avisan, apagados }, stages] = await Promise.all([datosSinMarcarDeUnLead(lead), etapasDelFunnelDeLead(lead)]);
      // `avisan` es lo que cuenta «N sin marcar» de su ficha y su fila en «A revisar» (la ficha de SU funnel):
      // si MaKo dijera otro número, contradiría la pantalla.
      const siAvisa = new Set(avisan.map((f) => f.id));
      const apagado = new Set<string>(apagados);
      return json({
        lead_id: lead.id, nombre: lead.nombre, etapa: etapaVigenteDe(lead, stages),
        al_dia: faltan.length === 0, faltan: faltan.map((f) => ({ id: f.id, label: f.label })),
        sin_marcar: avisan.length,
        no_avisan: faltan.filter((f) => !siAvisa.has(f.id)).map((f) => ({ id: f.id, label: f.label, por: apagado.has(f.id) ? 'este CRM no avisa de ese dato' : 'ignorado' })),
        ...(lead.pendientes_ignorados ? { ignorados_desde: lead.pendientes_ignorados } : {}),
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
    leer: (input, ctx) => conLead(input, async (lead) => {
      const plan = await getLeadPlan(lead.id);
      const cuotas = plan.pagos.map((p) => ({
        pago_id: p.id, numero: p.numero, es_inicial: p.numero === 0, monto_usd: Number(p.monto_usd), vence: p.fecha_esperada, pagada: p.pagado, fecha_pago: p.fecha_pago, tiene_comprobante: !!p.comprobante_path,
        // La moneda en que se cobró (mig 0255 y 0292): sólo donde no fue en dólares, para no llenar de ruido.
        ...(p.moneda && p.moneda !== 'USD' && p.monto_original != null ? { cobrada_en: { moneda: p.moneda, monto: Number(p.monto_original) } } : {}),
      }));
      const suma = (xs: typeof cuotas) => Math.round(xs.reduce((a, c) => a + c.monto_usd, 0) * 100) / 100;
      const sus = lead.venta_tipo === 'suscripcion';
      // ⚠️ LO COBRADO SALE DE LA MISMA FUNCIÓN QUE LA FICHA (`cobradoDelLead`, lib/cobrado-lead.ts, 14/10/2026): sin
      // ella MaKo decía «pagada por completo» de una mensualidad activa y no veía una renovación rechazada, que
      // vive en el cobro de la pasarela. Si los cobros no se pueden leer, se cuenta sin ellos (sólo las cuotas).
      const [cobros, { hoy }] = await Promise.all([listarCobros(ctx.ws, { leadId: lead.id, limite: 50 }).catch(() => []), hoyDelWorkspace(ctx.ws)]);
      const cob = cobradoDelLead({
        ventaTipo: lead.venta_tipo ?? null, montoCierreUsd: lead.monto_cierre_usd ?? null,
        suscripcionMontoUsd: lead.suscripcion_monto_usd ?? null, suscripcionMeses: lead.suscripcion_meses ?? null,
        fechaCierre: lead.fecha_cierre ?? null,
        suscripcionCanceladaAt: (lead as unknown as { suscripcion_cancelada_at?: string | null }).suscripcion_cancelada_at ?? null,
        pagos: plan.pagos, cobros, hoy,
      });
      return json({
        lead_id: lead.id, nombre: lead.nombre, estado: lead.estado_lead,
        venta_tipo: lead.venta_tipo ?? 'unico',
        total_vendido_usd: plan.total_usd,
        ...(sus ? { suscripcion_mensual_usd: lead.suscripcion_monto_usd ?? null, suscripcion_meses: lead.suscripcion_meses ?? null, nota: 'Suscripción: total_vendido_usd queda null a propósito; el importe es el mensual.' } : {}),
        duracion_meses: plan.duracion_meses, fecha_cierre: plan.fecha_cierre, fecha_inicio_servicio: plan.fecha_inicio, tiene_contrato: plan.tiene_contrato,
        cobrado_usd: suma(cuotas.filter((c) => c.pagada)),
        // Sin las DEVUELTAS (un reembolso de la pasarela): no son deuda, y con ellas este número no coincidía con
        // `cobrado.pendiente_usd` de la misma respuesta (revisión del 14/10/2026; MaKo podía citar cualquiera).
        por_cobrar_usd: suma(cuotas.filter((c, i) => !c.pagada && !esCuotaDevuelta(plan.pagos[i]))),
        cobrado: {
          texto: cob.texto, estado: cob.semaforo.texto, tono: cob.semaforo.tono,
          cobrado_usd: cob.cobradoUsd, total_usd: cob.totalUsd, pendiente_usd: cob.pendienteUsd, vencido_usd: cob.vencidoUsd, porcentaje: cob.pct,
          proxima: cob.proxima ? { pago_id: cob.proxima.pagoId, vence: cob.proxima.fecha, monto_usd: cob.proxima.montoUsd } : null,
          ...(cob.suscripcion ? { suscripcion: { estado: cob.suscripcion.estado, mensualidad: cob.suscripcion.mensualidadTexto, fin_del_plazo: cob.suscripcion.finPlazo, proxima_renovacion: cob.suscripcion.proximaRenovacion, renovacion_fallida: cob.suscripcion.renovacionFallida, cobra: cob.suscripcion.fuente, meses_sin_registrar: cob.suscripcion.sinRegistrar } } : {}),
          ...(cob.monedas.length ? { en_otras_monedas: cob.monedas } : {}),
          ...(cob.cuadra && !cob.cuadra.cuadra ? { no_cuadra: `El plan suma USD ${cob.cuadra.diferenciaUsd > 0 ? 'más' : 'menos'} que el cierre (diferencia ${cob.cuadra.diferenciaUsd}).` } : {}),
          ...(cob.seDibuja ? {} : { nota: cob.tipo === 'sin_cobro' ? 'Becado: no tiene cobrado.' : 'Sin venta ni cuotas cargadas.' }),
        },
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
      const wsLink = await getWorkspaceActual();
      return json({
        tope: 100, recortado: ps.length >= 100,
        propuestas: ps.map((p) => ({
          id: p.id, url: linkApp(`/crm/revisar/${p.id}`, wsLink), resumen: p.resumen, origen: p.origen,
          contactos: Array.isArray(p.datos.leads) ? p.datos.leads.length : 1,
          creada: p.createdAt, horas_esperando: Math.max(0, Math.round((ahora - Date.parse(p.createdAt)) / 3_600_000)),
        })),
      });
    },
  },
  listar_prospectos: {
    leer: async (input) => {
      const r = await listarProspectos();
      if ('error' in r) return fallo(r.error);
      const estado = s(input.estado) ?? 'nuevo';
      const minimo = typeof input.minimo === 'number' ? input.minimo : 0;
      const limite = typeof input.limite === 'number' ? input.limite : 30;
      const coinciden = r.prospectos.filter((p) => p.estado === estado && p.puntaje >= minimo);
      return json({
        total: coinciden.length, devueltos: Math.min(limite, coinciden.length), pantalla: linkApp('/crm/prospectos', await getWorkspaceActual()),
        prospectos: coinciden.slice(0, limite).map((p) => ({
          id: p.id, nombre: p.nombre, rubro: p.rubro, ciudad: p.ciudad, fuente: FUENTES_PROSPECCION[p.fuente].nombre,
          se_puede_contactar: contactable(p), puntaje: p.puntaje, razon: p.razon, estado: p.estado, lead_id: p.lead_id,
        })),
      });
    },
  },
  busquedas_prospeccion: {
    leer: async () => {
      const r = await listarProspectos();
      if ('error' in r) return fallo(r.error);
      return json({
        busquedas: r.busquedas.map((b) => ({
          id: b.id, que: rotuloDeBusqueda(b.parametros), estado: b.estado, nuevos: b.nuevos, encontrados: b.resultados, motivo: b.motivo, creada: b.created_at,
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
  // ── La agenda de Google ─────────────────────────────────────────────────────
  // Estos cuatro sólo LEEN la agenda y llaman a lib/agenda-sin-ia.ts, que arma lo que
  // ve el modelo (un estado, o un resumen con lo que dijo la persona) y lo que ve la
  // persona (`paraLaPersona`). Acá no se escribe ningún texto con datos de la agenda:
  // tests/agenda-sin-ia.test.ts lo exige, y prueba los constructores con centinelas.
  horarios_libres_dia: {
    leer: async (input) => {
      if (!esFechaIso(input.fecha)) return fallo('«fecha» tiene que ser una fecha YYYY-MM-DD.');
      const r = await horariosLibresDeGoogle(input.fecha, { duracionMin: n(input.duracion_min) });
      return salidaHorarios({ fecha: input.fecha, codigo: r.codigo, motivo: r.motivo, slots: r.slots ?? [], pasoMin: r.rango.pasoMin, duracionMin: r.rango.duracionMin });
    },
  },
  reuniones_agenda_lead: {
    leer: (input, ctx) => conLead(input, async (lead) => {
      if (!lead.email) return fallo(`${lead.nombre} no tiene email cargado: sin email no se reconoce su reunión en la agenda.`);
      const p = await permisoCalendarioGoogle();
      if (!p.conectado) return fallo('Este negocio no tiene una agenda de Google conectada. Se conecta en Integraciones → Google Calendar.');
      const tz = await tzDeWorkspace(ctx.ws).catch(() => TZ_DEFAULT);
      return salidaReunionesDeLead({ nombre: lead.nombre, reuniones: await proximasReunionesCon(lead.email), tz });
    }),
  },
  agenda_del_dia: {
    leer: async (input, ctx) => {
      if (!esFechaIso(input.fecha)) return fallo('«fecha» tiene que ser una fecha YYYY-MM-DD.');
      const tz = await tzDeWorkspace(ctx.ws).catch(() => TZ_DEFAULT);
      const r = await eventosDelDia(input.fecha, tz);
      return salidaDelDia(r.ok
        ? { fecha: input.fecha, ok: true, codigo: 'ok', motivo: '', eventos: r.eventos, tz }
        : { fecha: input.fecha, ok: false, codigo: r.codigo, motivo: r.motivo, eventos: [], tz });
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
        lead_id: id, nombre: r.lead.nombre, link: linkResumenLead(id, await getWorkspaceActual()),
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
  productos_del_lead: {
    leer: async (input) => {
      const productos = await productosCrm();
      if (!productos) return fallo(NO_LEI_PRODUCTOS);
      if (input.leadId == null) return json({ productos, nota: 'embudoId es el id que piden agregar_lead_a_producto, quitar_lead_de_producto y mover_lead_en_producto; no es el de listar_productos.' });
      return conLead(input, async (lead) => {
        const { productos: suyos } = await productosDelLead(lead.id);
        const deEl = new Map(suyos.map((p) => [p.funnelId, p]));
        return json({
          lead: { id: lead.id, nombre: lead.nombre },
          puede_quitar: puedeQuitar(suyos),
          productos: productos.map((p) => {
            const x = deEl.get(p.embudoId);
            // En el principal, la etapa EFECTIVA (la que pinta el tablero): pipeline_stage es un
            // override y casi siempre está vacío. En los agregados, la de su fila.
            return { ...p, esta: !!x, principal: !!x?.esCasa, etapa: x ? (x.esCasa ? etapaVigenteDe(lead, p.etapas) : x.etapa) : null };
          }),
          nota: 'principal = su producto de origen: ahí se mueve con proponer_cambio_etapa. En los otros, con mover_lead_en_producto.',
        });
      });
    },
  },

  listar_etiquetas: {
    leer: async (input) => {
      const [etiquetas, conteo, productos] = await Promise.all([
        listarEtiquetas({ incluirArchivadas: input.incluirArchivadas === true }),
        conteoPorEtiqueta().catch(() => null),
        productosCrm().catch(() => null),
      ]);
      return json({
        etiquetas: etiquetas.map((e) => vistaEtiqueta(e, productos, conteo ? (conteo.get(e.id) ?? 0) : null)),
        nota: 'etiquetaId = id. Vinculada a una etapa: agregarla mueve al lead ahí, y entrar o salir de la etapa la agrega o la elimina.',
      });
    },
  },
  etiquetas_lead: {
    // ⚠️ `puesta_por` guarda el EMAIL de quien la puso desde la ficha (autorDelMovimiento). Por
    // HTTP no viajan datos del equipo —`historial_lead` y `notas_lead`, con el mismo autor, son
    // SIN_HTTP—, así que ahí sale reducido a «una persona» / «MaKo» / la automatización
    // (revisión del 08/10/2026, datos-7). En la app y en WhatsApp el que pregunta es del equipo.
    leer: (input, ctx) => conLead(input, async (lead) => {
      const [suyas, productos] = await Promise.all([etiquetasDeLead(lead.id), productosCrm().catch(() => null)]);
      return json({
        lead: { id: lead.id, nombre: lead.nombre },
        etiquetas: suyas.map((e) => ({ ...vistaEtiqueta(e, productos), puesta_at: e.puesta_at, puesta_por: ctx.canal === 'http' ? autorPublico(e.puesta_por) : e.puesta_por })),
      });
    }),
  },

  // Lo MISMO que ve el botón plegado del CRM (lib/sugerencias-crm-server.ts: calculado una vez y
  // guardado unos minutos, menos lo callado). Para crear una, crear_automatizacion_desde_plantilla con la
  // plantilla, la etapa (su key) y el producto que trae `crear`: la etapa en palabras de esa operación
  // acepta también la key, y el producto desempata si dos CRM tienen una etapa con el mismo nombre.
  sugerencias_crm: {
    leer: async (input, ctx) => {
      const r = await sugerenciasDeUnCrm(ctx.ws, n(input.embudoId) ?? null);
      if (!r) return json({ crm: null, nota: 'Este negocio todavía no tiene un CRM.', sugerencias: [] });
      return json({
        crm: r.foto.crm,
        etapas: r.foto.etapas,
        total_leads: r.foto.total_leads,
        ...(r.foto.total_leads == null ? { nota_leads: 'No se pudieron leer los leads: no hay sugerencias del tablero y los conteos vienen en null (no es cero).' } : {}),
        automatizaciones_del_negocio: r.foto.automatizaciones,
        sugerencias: r.sugerencias.map((s) => ({
          id: s.id,
          de: s.clase === 3 ? 'el estado del tablero' : 'el CRM armado',
          texto: s.texto,
          etapa: s.etapa,
          ...(s.accion.tipo === 'plantilla' ? {
            crear: {
              plantilla: s.accion.plantilla,
              plantilla_nombre: plantillaPorId(s.accion.plantilla)?.nombre ?? null,
              etapa: s.accion.disparador ? s.accion.disparador.split(':').slice(2).join(':') : null,
              producto: r.crm.nombre,
              solo_admin: true,
            },
          } : {}),
          ...(s.accion.tipo === 'link' ? { pantalla: s.accion.href } : {}),
          ...(s.accion.tipo === 'chat' ? { revisar: s.accion.pedido } : {}),
        })),
        // Lo callado con «Ahora no» en ESTE CRM, con hasta cuándo: se deshace con volver_a_mostrar_sugerencia.
        calladas: r.calladas?.map(({ sugerencia: s, hasta }) => ({ id: s.id, texto: s.texto, etapa: s.etapa, hasta })) ?? null,
        ...(r.calladas == null ? { nota_calladas: 'No se pudo leer lo callado: se muestran todas y calladas viene en null (no es «ninguna»).' } : {}),
        calculado_at: r.calculadoAt,
      });
    },
  },
  volver_a_mostrar_sugerencia: {
    preparar: async (input, ctx) => {
      const r = await sugerenciasDeUnCrm(ctx.ws, n(input.embudoId) ?? null);
      if (!r) return { error: 'Este negocio todavía no tiene un CRM.' };
      if (!r.calladas) return { error: 'No pude leer lo callado de este CRM. Intenta de nuevo.' };
      const id = String(input.sugerenciaId ?? '').trim();
      const c = r.calladas.find((x) => x.sugerencia.id === id);
      if (!c) return { error: `«${id}» no está callada en «${r.crm.nombre}».`, disponibles: r.calladas.map((x) => ({ id: x.sugerencia.id, texto: x.sugerencia.texto })) };
      return { payload: { embudoId: r.crm.id, sugerenciaId: id }, resumen: `Volver a mostrar en «${r.crm.nombre}»: «${c.sugerencia.texto}».` };
    },
    ejecutar: (payload, ctx) => seguro('volver a mostrar la sugerencia', async () => {
      const v = await volverAMostrar(ctx.ws, Number(payload.embudoId), String(payload.sugerenciaId));
      if (!v.ok) return { ok: false, resumen: v.error };
      // Sin cambio, «Listo» sería un éxito falso: ya estaba a la vista (otra persona o venció).
      if (!v.cambio) return { ok: false, resumen: 'Esa sugerencia ya estaba a la vista: no se cambió nada.' };
      return { ok: true, resumen: 'Listo: la sugerencia vuelve a la lista de ese CRM.' };
    }),
  },

  // ── La ficha del lead por bloques (14/10/2026) ──────────────────────────────
  ver_ficha_funnel: {
    leer: async (input) => {
      const f = await fichaDelCrm(input.embudoId);
      if ('error' in f) return fallo(json(f));
      return json(salidaFichaApi(f));
    },
  },
  cambiar_ficha_funnel: {
    preparar: async (input) => {
      const f = await fichaDelCrm(input.embudoId);
      if ('error' in f) return f;
      const c = cambioDeInputApi(input);
      if ('error' in c) return c;
      // Todo lo que se puede saber sin escribir falla acá (AGENTS.md, «Confirmar RECLAMA antes de ejecutar»):
      // el mismo `aplicarCambio` que corre al confirmar, sobre la ficha de hoy.
      const r = aplicarCambio(f.guardada, c, f.eleccion.id, f.respaldo);
      if (!r.ok) return { error: r.error };
      if (!r.cambio) return { error: 'La ficha ya está así.', yaEstaba: true };
      return { payload: { embudoId: f.funnel.id, cambio: c }, resumen: `${describirCambio(c)}, en la ficha de «${f.funnel.nombre}» (para todos sus leads).` };
    },
    ejecutar: (payload) => seguro('cambiar la ficha', async () => {
      const c = sanearCambio(payload.cambio);
      if ('error' in c) return { ok: false, resumen: c.error };
      const r = await cambiarFichaDeFunnel(Number(payload.embudoId), c);
      if (!r.ok) return { ok: false, resumen: r.error };
      if (!r.cambio) return { ok: false, resumen: 'La ficha ya estaba así: no se cambió nada.' };
      // Los avisos de la ficha cambian lo que cuenta «Datos sin marcar» (la caché de leads).
      invalidar('leads');
      return { ok: true, resumen: `Listo: ${describirCambio(c)}.` };
    }),
  },

  // ── El evento de agenda vinculado a una etapa de reunión (16/10/2026) ───────────
  // Las MISMAS funciones que la pantalla (lib/agenda-evento-etapa-server.ts): una implementación.
  listar_eventos_agenda: {
    leer: async () => {
      let a: AgendaDelNegocio;
      try { a = await listarEventosDeAgenda(); } catch { return fallo('No pude leer los eventos de la agenda. Intenta de nuevo.'); }
      return json({
        eventos: a.eventos.map((e) => ({
          proveedor: e.proveedor, evento: e.identificador, nombre: e.nombre, duracion_min: e.duracionMin,
          de_integraciones: e.credencial, en_la_cuenta: e.enLaCuenta,
          vinculado_a: e.vinculo ? { embudoId: e.vinculo.funnelId, crm: e.vinculo.funnel, etapa: e.vinculo.etapa, etapa_nombre: e.vinculo.etapaNombre, reunion: e.vinculo.reunion } : null,
        })),
        etapas_vinculables: a.etapas.map((x) => ({ embudoId: x.funnelId, crm: x.funnel, etapa: x.etapa, etapa_nombre: x.etapaNombre, reunion: x.reunion })),
        agendas: a.proveedores,
        ...(a.sePuedeVincular ? {} : { nota: 'Falta un paso de la base (migración 0293): se ve la lista, pero todavía no se puede vincular.' }),
      });
    },
  },
  vincular_evento_etapa: {
    preparar: async (input) => {
      const p = await prepararVinculo({ proveedor: input.proveedor, evento: input.evento, funnelId: input.embudoId, etapa: input.etapa });
      if (!p.ok) return { error: p.error };
      if (p.yaEstaba) return { error: `«${p.evento.nombre}» ya está vinculado a «${p.etapaNombre}» de «${p.funnel}».`, yaEstaba: true };
      return {
        payload: { proveedor: p.evento.proveedor, evento: p.evento.identificador, embudoId: p.funnelId, etapa: p.etapa },
        resumen: `Vincular «${p.evento.nombre}» (${p.evento.proveedor === 'calcom' ? 'Cal.com' : 'Calendly'}) a «${p.etapaNombre}» de «${p.funnel}»: quien lo reserve cae ahí, como su ${p.reunion}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('vincular el evento', async () => {
      const r = await vincularEvento({ proveedor: payload.proveedor, evento: payload.evento, funnelId: payload.embudoId, etapa: payload.etapa, autor: autorDe(ctx) });
      if (!r.ok) return { ok: false, resumen: r.error };
      if (r.yaEstaba) return { ok: false, resumen: 'Ese evento ya estaba vinculado ahí: no se cambió nada.' };
      return { ok: true, resumen: `Listo: quien reserve «${r.evento.nombre}» cae en «${r.etapaNombre}» de «${r.funnel}».`, datos: { evento: r.evento.identificador, embudoId: r.funnelId, etapa: r.etapa } };
    }),
  },
  desvincular_evento_etapa: {
    preparar: async (input) => {
      let v: Awaited<ReturnType<typeof buscarVinculo>>;
      try { v = await buscarVinculo({ proveedor: input.proveedor, evento: input.evento }); } catch { return { error: 'No pude leer los vínculos. Intenta de nuevo.' }; }
      if (!v) return { error: 'Ese evento no está vinculado a ninguna etapa.', yaEstaba: true };
      return {
        payload: { proveedor: v.proveedor, evento: v.identificador },
        resumen: `Desvincular «${v.nombre ?? v.identificador}» de su etapa: sus reservas vuelven a la R1 o R2 de Integraciones y al CRM principal.`,
      };
    },
    ejecutar: (payload) => seguro('desvincular el evento', async () => {
      const r = await desvincularEvento({ proveedor: payload.proveedor, evento: payload.evento });
      if (!r.ok) return { ok: false, resumen: r.error };
      if (!r.cambio) return { ok: false, resumen: 'Ese evento ya no estaba vinculado: no se cambió nada.' };
      return { ok: true, resumen: `Listo: «${r.vinculo.nombre ?? r.vinculo.identificador}» ya no está vinculado a ninguna etapa.` };
    }),
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
        return { id, url: linkApp(`/crm/revisar/${id}`, await getWorkspaceActual()), nueva };
      }
      const j = JSON.parse(await texto(legado(ctx)('proponer_lead', input))) as Record<string, unknown>;
      if (j.ok !== true || typeof j.url !== 'string') return { error: String(j.error ?? 'no se pudo proponer') };
      // Sin la query: el link lleva `?ws=N` (linkApp), y con él pegado el id no es el de la propuesta.
      return { id: j.url.split(/[?#]/)[0].split('/').pop() ?? '', url: j.url, nueva: j.nueva !== false };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Esta propuesta se confirma en su pantalla de revisión, no por aquí.' }),
  },

  // ── Acciones chat ───────────────────────────────────────────────────────────
  // Agendar / mover en Google. Todo lo que se puede saber sin escribir se chequea en
  // preparar() (la pendiente se RECLAMA antes de ejecutar: un rechazo en ejecutar()
  // la consume igual). Lo único que se vuelve a mirar al confirmar es lo que el
  // tiempo cambia: que la hora no haya pasado.
  proponer_agendar_agenda: {
    preparar: async (input, ctx) => {
      // Con lead, se lo invita; sin lead es un evento del negocio («una reunión que se llame
      // PRUEBA», 08/10/2026) y el título lo pone la persona.
      let lead: Lead | null = null;
      if (input.leadId !== undefined && input.leadId !== null) {
        lead = await leadDe(input.leadId);
        if (!lead) return { error: noExiste(input.leadId) };
        if (!lead.email) return { error: `${lead.nombre} no tiene email cargado, y la invitación de Google va al email. Pídeselo, o agenda el evento sin el lead.` };
      } else if (!s(input.titulo)) {
        return { error: 'Sin lead, el evento necesita un título: pasa el que dijo la persona en «titulo».' };
      }
      const sinAgenda = await agendaParaEscribir();
      if (sinAgenda) return { error: sinAgenda };
      const t = await instanteEnZona(ctx.ws, input.fecha, input.hora);
      if ('error' in t) return { error: t.error };
      const duracion = n(input.duracion_min) ?? DURACION_DEFECTO_MIN;
      // El email va en el payload: se invita al que la persona VIO en el resumen,
      // aunque la ficha cambie entre el «propongo» y el «sí».
      return propuestaAgendar({
        leadId: lead?.id ?? null, email: lead?.email ?? null, titulo: s(input.titulo) ?? `Reunión con ${lead?.nombre ?? ''}`.trim(),
        inicioIso: t.iso, tz: t.tz, duracionMin: duracion, choques: await choquesEnAgenda(t.iso, duracion),
      });
    },
    ejecutar: (payload, ctx) => seguro('agendar la reunión', async () => {
      const id = leadIdDe(payload);
      const iso = String(payload.inicioIso);
      const tz = String(payload.tz || TZ_DEFAULT);
      if (Date.parse(iso) < Date.now()) return yaPaso('agendó', iso, tz);
      const titulo = String(payload.titulo ?? '');
      const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : null;
      const r = await crearEventoDeReunion({ inicioIso: iso, duracionMin: Number(payload.duracionMin) || undefined, titulo, emailInvitado: email });
      if (r.ok && id != null && email) await anotar(id, 'Reunión agendada', historialAgendar({ titulo, inicioIso: iso, tz, canal: canalTxt(ctx), email }), autorDe(ctx));
      return resultadoAgendar({ ok: r.ok, codigo: r.codigo, motivo: r.motivo, titulo, inicioIso: iso, tz, email });
    }),
  },
  proponer_mover_reunion: {
    preparar: async (input, ctx) => {
      // Cuál reunión: con lo que DIJO la persona (el día y, si lo dijo, la hora). Antes el
      // modelo copiaba el `inicio` exacto de una lista de la agenda que tenía que leer —o
      // sea que la agenda pasaba por él—; ahora la elige el código. Con lead o sin lead.
      const r = await reunionesAElegir(input, ctx);
      if ('error' in r) return r;
      const t = await instanteEnZona(ctx.ws, input.fecha, input.hora);
      if ('error' in t) return { error: t.error };
      const elegida = elegirReunion({ quien: r.lead?.nombre ?? null, accion: 'mover', todas: r.todas, fechaActual: r.fechaActual, horaActual: r.horaActual, tz: t.tz, nuevoIso: t.iso });
      if ('error' in elegida) return elegida;
      const duracion = elegida.reunion.duracionMin ?? DURACION_DEFECTO_MIN;
      return propuestaMover({
        leadId: r.lead?.id ?? null, nombre: r.lead?.nombre ?? null, email: r.lead?.email ?? null, reunion: elegida.reunion,
        nuevoIso: t.iso, tz: t.tz, fechaActual: r.fechaActual, horaActual: r.horaActual,
        choques: await choquesEnAgenda(t.iso, duracion, elegida.reunion.inicioIso),
      });
    },
    ejecutar: (payload, ctx) => seguro('mover la reunión', async () => {
      const id = leadIdDe(payload);
      const nuevo = String(payload.nuevoIso);
      const antes = String(payload.inicioActualIso);
      const tz = String(payload.tz || TZ_DEFAULT);
      const conQuien = conQuienDe(payload);
      if (Date.parse(nuevo) < Date.now()) return yaPaso('movió', nuevo, tz);
      const titulo = String(payload.titulo ?? '');
      const r = await moverEventoDeReunion({
        inicioAnteriorIso: antes, emailInvitado: String(payload.email ?? ''), titulo,
        nuevoInicioIso: nuevo, duracionMin: Number(payload.duracionMin) || undefined,
        // Mover lo que se nombró, o nada: si no está, crear una nueva mandaría una
        // invitación a una reunión que nadie pidió.
        crearSiNoExiste: false,
      });
      if (r.ok && id != null) await anotar(id, 'Reunión movida', historialMover({ conQuien, nuevoIso: nuevo, tz, canal: canalTxt(ctx) }), autorDe(ctx));
      return resultadoMover({ ok: r.ok, codigo: r.codigo, motivo: r.motivo, titulo, antesIso: antes, nuevoIso: nuevo, tz, conQuien });
    }),
  },
  proponer_cambiar_reunion: {
    preparar: async (input, ctx) => {
      const tituloNuevo = s(input.titulo) ?? null;
      const duracion = n(input.duracion_min) ?? null;
      if (!tituloNuevo && duracion == null) return { error: 'Pasa qué cambia: el título nuevo (titulo), la duración nueva (duracion_min) o las dos. Para el día o la hora es proponer_mover_reunion.' };
      const r = await reunionesAElegir(input, ctx);
      if ('error' in r) return r;
      const elegida = elegirReunion({ quien: r.lead?.nombre ?? null, accion: 'cambiar', todas: r.todas, fechaActual: r.fechaActual, horaActual: r.horaActual, tz: r.tz });
      if ('error' in elegida) return elegida;
      return propuestaCambiar({
        leadId: r.lead?.id ?? null, nombre: r.lead?.nombre ?? null, email: r.lead?.email ?? null, reunion: elegida.reunion, tz: r.tz,
        tituloNuevo, duracionMin: duracion, fechaActual: r.fechaActual, horaActual: r.horaActual,
      });
    },
    ejecutar: (payload, ctx) => seguro('cambiar la reunión', async () => {
      const id = leadIdDe(payload);
      const conQuien = conQuienDe(payload);
      const tz = String(payload.tz || TZ_DEFAULT);
      const inicio = String(payload.inicioIso);
      const tituloAntes = String(payload.titulo ?? '');
      const tituloNuevo = typeof payload.tituloNuevo === 'string' && payload.tituloNuevo.trim() ? payload.tituloNuevo.trim() : null;
      const duracion = typeof payload.duracionMin === 'number' ? payload.duracionMin : null;
      const r = await cambiarEventoDeReunion({ inicioIso: inicio, titulo: tituloAntes, emailInvitado: typeof payload.email === 'string' ? payload.email : null, tituloNuevo, duracionMin: duracion });
      if (r.ok && id != null) await anotar(id, 'Reunión cambiada', historialCambiar({ conQuien, tituloNuevo, duracionMin: duracion, canal: canalTxt(ctx) }), autorDe(ctx));
      return resultadoCambiar({ ok: r.ok, codigo: r.codigo, motivo: r.motivo, tituloAntes, inicioIso: inicio, tz, conQuien, tituloNuevo, duracionMin: duracion });
    }),
  },
  proponer_cancelar_reunion: {
    preparar: async (input, ctx) => {
      const r = await reunionesAElegir(input, ctx);
      if ('error' in r) return r;
      const elegida = elegirReunion({ quien: r.lead?.nombre ?? null, accion: 'cancelar', todas: r.todas, fechaActual: r.fechaActual, horaActual: r.horaActual, tz: r.tz });
      if ('error' in elegida) return elegida;
      return propuestaCancelar({
        leadId: r.lead?.id ?? null, nombre: r.lead?.nombre ?? null, email: r.lead?.email ?? null, reunion: elegida.reunion, tz: r.tz,
        fechaActual: r.fechaActual, horaActual: r.horaActual,
      });
    },
    ejecutar: (payload, ctx) => seguro('cancelar la reunión', async () => {
      const id = leadIdDe(payload);
      const conQuien = conQuienDe(payload);
      const tz = String(payload.tz || TZ_DEFAULT);
      const inicio = String(payload.inicioIso);
      const titulo = String(payload.titulo ?? '');
      const r = await cancelarEventoDeReunion({ inicioIso: inicio, titulo, emailInvitado: typeof payload.email === 'string' ? payload.email : null });
      if (r.ok && id != null) await anotar(id, 'Reunión cancelada', historialCancelar({ conQuien, canal: canalTxt(ctx) }), autorDe(ctx));
      return resultadoCancelar({ ok: r.ok, codigo: r.codigo, motivo: r.motivo, titulo, inicioIso: inicio, tz, conQuien });
    }),
  },
  marcar_asistencia_reunion: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const cual = input.cual === 'R2' ? 'R2' : 'R1';
      const fecha = cual === 'R1' ? lead.fecha_junta_1 : lead.fecha_junta_2;
      if (!fecha) return { error: `La ${cual} de ${lead.nombre} no tiene fecha cargada, y sin fecha la asistencia se descarta. Primero hay que cargar la reunión (marcar_reunion_manual) o esperar que llegue por Calendly.` };
      const asistio = input.asistio === true;
      if ((cual === 'R1' ? lead.asistio_j1 : lead.asistio_j2) === asistio) return { error: `La ${cual} de ${lead.nombre} ya está marcada como ${asistio ? 'asistida' : 'no asistida'}.`, yaEstaba: true };
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
      if (lead.calificado === calificado) return { error: `${lead.nombre} ya está marcado como ${calificado ? 'calificado' : 'no calificado'}.`, yaEstaba: true };
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
      // El monto REAL (Mauricio, 13/10/2026: «un pago diferente»). La regla de la diferencia es la de la ficha
      // (`diferenciaPendiente`, lib/pagos-diferencia.ts), y la escritura también (`cobrarCuota`, lib/pagos.ts).
      const montoUsd = typeof input.montoUsd === 'number' && Number.isFinite(input.montoUsd) && input.montoUsd > 0 ? centavos(input.montoUsd) : null;
      if (montoUsd != null && !pagado) return { error: '«montoUsd» va sólo al marcar la cuota como cobrada.' };
      const resto: RestoDeCobro = input.resto === 'descuento' ? 'descuento' : 'pendiente';
      const falta = diferenciaPendiente(Number(pago.monto_usd), montoUsd, { yaPagada: false, resto });
      const distinto = montoUsd != null && montoUsd !== Number(pago.monto_usd);
      const extra = !distinto ? '' : falta > 0
        ? ` por ${montoUsd} USD: los ${falta} USD que faltan quedan como una cuota nueva pendiente`
        : montoUsd! < Number(pago.monto_usd) ? ` por ${montoUsd} USD: los ${centavos(Number(pago.monto_usd) - montoUsd!)} USD que faltan son un descuento` : ` por ${montoUsd} USD`;
      return {
        payload: { pagoId: pago.id, leadId: lead.id, pagado, fechaPago, ...(distinto ? { montoUsd, resto } : {}) },
        resumen: pagado
          ? `Marcar ${cuota} de ${lead.nombre} (${pago.monto_usd} USD) como cobrada el ${fechaPago}${extra}.`
          : `Desmarcar ${cuota} de ${lead.nombre} (${pago.monto_usd} USD): vuelve a figurar sin cobrar.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('marcar el pago', async () => {
      const pagado = payload.pagado === true;
      const fechaPago = typeof payload.fechaPago === 'string' ? payload.fechaPago : null;
      if (pagado && fechaPago && typeof payload.montoUsd === 'number') {
        const r = await cobrarCuota(Number(payload.pagoId), Number(payload.leadId), {
          monto: payload.montoUsd, fecha: fechaPago, resto: payload.resto === 'descuento' ? 'descuento' : 'pendiente',
        });
        const nota = `Cuota cobrada (${fechaPago}) · USD ${r.monto} (era de USD ${r.original})${r.pendiente != null ? ` · quedan USD ${r.pendiente} pendientes` : r.descuento > 0 ? ` · USD ${r.descuento} de descuento` : ''}`;
        await logLeadEvent(Number(payload.leadId), 'Pago registrado', nota, autorDe(ctx));
        invalidar('pagos', 'leads');
        return { ok: true, resumen: `Listo: cuota cobrada el ${fechaPago} por ${r.monto} USD${r.pendiente != null ? `; quedan ${r.pendiente} USD pendientes en una cuota nueva` : ''}.` };
      }
      await marcarPago(Number(payload.pagoId), pagado, fechaPago);
      await logLeadEvent(Number(payload.leadId), pagado ? 'Pago registrado' : 'Pago desmarcado', pagado ? `Cuota marcada como pagada${fechaPago ? ` (${fechaPago})` : ''}` : 'Cuota desmarcada', autorDe(ctx));
      invalidar('pagos', 'leads');
      return { ok: true, resumen: pagado ? `Listo: cuota marcada como cobrada el ${fechaPago}.` : 'Listo: la cuota volvió a figurar sin cobrar.' };
    }),
  },
  registrar_pago_suelto: {
    preparar: async (input, ctx) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const montoUsd = typeof input.montoUsd === 'number' && Number.isFinite(input.montoUsd) && input.montoUsd > 0 ? centavos(input.montoUsd) : null;
      if (montoUsd == null) return { error: 'Falta el monto (un número mayor a cero, en USD).', faltan: ['montoUsd'] };
      if (input.fechaPago !== undefined && !esFechaIso(input.fechaPago)) return { error: '«fechaPago» tiene que ser una fecha YYYY-MM-DD.' };
      const fechaPago = s(input.fechaPago) ?? (await hoyDelWorkspace(ctx.ws)).hoy;
      return {
        payload: { leadId: lead.id, montoUsd, fechaPago },
        resumen: `Registrar un pago de ${montoUsd} USD de ${lead.nombre} el ${fechaPago}, fuera del plan de cuotas (no cambia el monto de cierre).`,
      };
    },
    ejecutar: (payload, ctx) => seguro('registrar el pago', async () => {
      const fecha = String(payload.fechaPago);
      const r = await registrarPagoSuelto(Number(payload.leadId), { monto: Number(payload.montoUsd), fecha });
      await logLeadEvent(Number(payload.leadId), 'Pago registrado', `Pago fuera del plan por USD ${r.monto} el ${fecha}`, autorDe(ctx));
      invalidar('pagos', 'leads');
      return { ok: true, resumen: `Listo: pago de ${r.monto} USD registrado el ${fecha}.`, datos: { pagoId: r.pagoId } };
    }),
  },
  // Ignoran IGUAL que la pantalla (14/10/2026): en `datos_ignorados`, por la misma escritura que la ficha
  // y la ✕ de «A revisar» (ignorarDatosDeUnLead, crm.helpers.ts). Lo ignorado sale en «Ver más».
  ignorar_datos_sin_marcar: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      if (lead.pendientes_ignorados) return { error: `Los datos sin marcar de ${lead.nombre} ya están ignorados desde ${lead.pendientes_ignorados}.`, yaEstaba: true };
      if (todoIgnorado(lead)) return { error: `Los datos sin marcar de ${lead.nombre} ya están ignorados.`, yaEstaba: true };
      return { payload: { leadId: lead.id }, resumen: `Ignorar los datos sin marcar de ${lead.nombre}: dejan de contar y quedan en «Ver más», donde se pueden volver a mostrar. La asistencia a una reunión pasada sigue avisando.` };
    },
    ejecutar: (payload, ctx) => seguro('ignorar los datos sin marcar', async () => {
      const r = await ignorarDatosDeUnLead(Number(payload.leadId), true, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Listo: los datos del lead #${String(payload.leadId)} ya no cuentan en «Datos sin marcar».` };
    }),
  },
  reactivar_datos_sin_marcar: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      if (!algoIgnorado(lead)) return { error: `${lead.nombre} no tiene datos sin marcar ignorados.`, yaEstaba: true };
      return { payload: { leadId: lead.id }, resumen: `Volver a contar todos los datos sin marcar de ${lead.nombre}.` };
    },
    ejecutar: (payload, ctx) => seguro('volver a contar los datos sin marcar', async () => {
      const r = await ignorarDatosDeUnLead(Number(payload.leadId), false, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: r.error };
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

  // ── Crear un CRM por su TIPO (14/10/2026): el mismo camino que «Nuevo CRM» ─────────────────
  // `siembraDeCrm` sanea igual que el modal y `crearCrm` (lib/nuevo-crm.ts) escribe igual. Lo que
  // se puede saber sin escribir (tipo, canal, entradas, nombre reservado) falla en preparar().
  tipos_de_crm: {
    leer: async () => json({
      tipos: TIPOS_CRM.map((t) => ({
        tipo: t.id,
        nombre: t.label,
        que_es: t.linea,
        se_vende: CANALES.find((c) => c.id === t.canal)?.label ?? t.canal,
        llega_por: t.entradas.map((e) => ENTRADAS[e]?.label ?? e),
        etapas: t.pipeline.map((st) => st.label),
      })),
      otro: {
        tipo: TIPO_CRM_OTRO,
        que_es: 'Lo armas tú: pasa canal y entradas.',
        canales: CANALES.map((c) => ({ canal: c.id, nombre: c.label, que_es: c.desc })),
        entradas: ENTRADAS_OFRECIDAS.map((e) => ({ entrada: e, nombre: ENTRADAS[e].label })),
      },
    }),
  },
  crear_crm: {
    preparar: async (input) => {
      const nombre = s(input.nombre);
      if (!nombre) return { error: 'Falta el nombre del CRM.', faltan: ['nombre'] };
      if (nombre.toLowerCase() === FUNNEL_DEFAULT_NOMBRE.toLowerCase()) return { error: `«${FUNNEL_DEFAULT_NOMBRE}» es el nombre del CRM que ya existe. Ponle otro.` };
      if (input.tipo === TIPO_CRM_OTRO && !esCanal(input.canal)) return { error: 'Con el tipo otro, pasa el canal: cómo se cierra la venta.', faltan: ['canal'] };
      if (input.tipo === TIPO_CRM_OTRO && !(Array.isArray(input.entradas) && input.entradas.length)) return { error: 'Con el tipo otro, pasa al menos una entrada: cómo llega la gente.', faltan: ['entradas'] };
      const siembra = siembraDeCrm({ tipo: input.tipo, canal: input.canal, entradas: input.entradas });
      if ('error' in siembra) return { error: siembra.error };
      const t = siembra.tipo ? tipoCrmPorId(siembra.tipo) : null;
      const comoEs = t ? `«${t.label}»` : `a mano (${CANALES.find((c) => c.id === siembra.canal)?.label ?? siembra.canal})`;
      return {
        payload: { nombre, tipo: siembra.tipo ?? TIPO_CRM_OTRO, canal: siembra.canal, entradas: siembra.entradas },
        resumen: `Crear el CRM «${nombre}», ${comoEs}: ${siembra.pipeline.map((st) => st.label).join(' → ')}. La gente llega por: ${siembra.entradas.map((e) => ENTRADAS[e]?.label ?? e).join(' · ')}.`,
      };
    },
    ejecutar: (payload) => seguro('crear el CRM', async () => {
      // Se vuelve a sanear con lo guardado en la pendiente: entre el «sí» y la propuesta pudo
      // cambiar el catálogo (un deploy), y un tipo que ya no existe no siembra otro por default.
      const siembra = siembraDeCrm({ tipo: payload.tipo, canal: payload.canal, entradas: payload.entradas });
      if ('error' in siembra) return { ok: false, resumen: siembra.error };
      try {
        const r = await crearCrm(String(payload.nombre), siembra);
        invalidar('pipeline', 'leads');
        const aviso = r.etapasDelTipo ? '' : ' Quedó con las etapas de su canal: ajústalas desde el lápiz del CRM.';
        return { ok: true, resumen: `Listo: creado el CRM «${String(payload.nombre)}» (embudoId ${r.funnelId}).${aviso}`, datos: { embudoId: r.funnelId, productoId: r.productoId } };
      } catch (e) {
        // `crearProductoConFunnel` tira con un mensaje para la persona (nombre vacío o reservado).
        return { ok: false, resumen: e instanceof Error ? e.message : String(e) };
      }
    }),
  },

  // Un lead en VARIOS productos (mig 0207): por lib/lead-funnel.ts, tal como lo usa la ficha.
  agregar_lead_a_producto: {
    preparar: async (input) => {
      const r = await leadYProducto(input);
      if ('error' in r) return r;
      if (r.enEse) return { error: `${r.lead.nombre} ya está en «${r.producto.nombre}».`, yaEstaba: true };
      const entrada = etapaDeEntrada(r.producto.etapas);
      if (!entrada) return { error: `«${r.producto.nombre}» no tiene etapas.` };
      return {
        payload: { leadId: r.lead.id, embudoId: r.producto.embudoId },
        resumen: `Agregar a ${r.lead.nombre} a «${r.producto.nombre}», en «${etiquetaDe(r.producto, entrada)}» (sigue en los funnels que ya tiene).`,
      };
    },
    ejecutar: (payload, ctx) => seguro('agregar al funnel', async () => {
      const id = Number(payload.leadId); const embudo = Number(payload.embudoId);
      const r = await agregarAProducto(id, embudo, { autor: autorDe(ctx) });
      const n = await nombresDe(id, embudo);
      if (!r.agregado) return { ok: false, resumen: `${n.lead} ya estaba en «${n.producto}»: no se agregó nada.` };
      invalidar('leads');
      return { ok: true, resumen: `Listo: ${n.lead} quedó también en «${n.producto}», en «${n.etapa(r.etapa)}».` };
    }),
  },
  quitar_lead_de_producto: {
    preparar: async (input) => {
      const r = await leadYProducto(input);
      if ('error' in r) return r;
      if (!r.enEse) return { error: `${r.lead.nombre} no está en «${r.producto.nombre}».`, yaEstaba: true };
      if (!puedeQuitar(r.suyos)) return { error: `«${r.producto.nombre}» es el único funnel de ${r.lead.nombre}: no se lo puede quitar.` };
      let resumen = `Quitar a ${r.lead.nombre} de «${r.producto.nombre}»`;
      if (r.enEse.esCasa) {
        // Quitar la casa PROMUEVE otra: lo dice antes del «sí», con su nombre y su etapa.
        const nueva = aQuienPromover(r.suyos);
        const np = nueva ? r.productos.find((p) => p.embudoId === nueva.funnelId) : undefined;
        if (nueva && np) resumen += `: era su funnel principal, y pasa a serlo «${np.nombre}», en «${etiquetaDe(np, nueva.etapa)}»`;
      }
      return { payload: { leadId: r.lead.id, embudoId: r.producto.embudoId }, resumen: `${resumen}.` };
    },
    ejecutar: (payload, ctx) => seguro('quitar del funnel', async () => {
      const id = Number(payload.leadId); const embudo = Number(payload.embudoId);
      const d = await quitarDeProducto(id, embudo, { autor: autorDe(ctx) });
      invalidar('leads');
      const n = await nombresDe(id, embudo);
      return {
        ok: true,
        resumen: d.casaAntes ? `Listo: ${n.lead} salió de «${n.producto}», que era su funnel principal; ahora lo es el que tenía hace más tiempo.` : `Listo: ${n.lead} salió de «${n.producto}».`,
        datos: { deshacer: d },
      };
    }),
  },
  mover_lead_en_producto: {
    preparar: async (input) => {
      const r = await leadYProducto(input);
      if ('error' in r) return r;
      if (!r.enEse) return { error: `${r.lead.nombre} no está en «${r.producto.nombre}»: se suma antes con agregar_lead_a_producto.` };
      // La casa se mueve por el camino de siempre (requisitos, estado, Meta): moverEtapaEnProducto
      // escribe sólo la fila de lead_funnel, y la casa no tiene fila.
      if (r.enEse.esCasa) return { error: `«${r.producto.nombre}» es el funnel principal de ${r.lead.nombre}: ahí se mueve con proponer_cambio_etapa, que pide el monto o el motivo cuando hacen falta.` };
      const etapa = s(input.etapa) ?? '';
      const destino = r.producto.etapas.find((e) => e.key === etapa);
      if (!destino) return { error: `«${etapa}» no es una etapa de «${r.producto.nombre}».`, disponibles: r.producto.etapas.map((e) => ({ key: e.key, label: e.label })) };
      if (r.enEse.etapa === etapa) return { error: `${r.lead.nombre} ya está en «${destino.label}» de «${r.producto.nombre}».`, yaEstaba: true };
      return {
        payload: { leadId: r.lead.id, embudoId: r.producto.embudoId, etapa },
        resumen: `Mover a ${r.lead.nombre} en «${r.producto.nombre}»: de «${etiquetaDe(r.producto, r.enEse.etapa)}» a «${destino.label}».`,
      };
    },
    ejecutar: (payload, ctx) => seguro('mover en el funnel', async () => {
      const id = Number(payload.leadId); const embudo = Number(payload.embudoId); const etapa = String(payload.etapa);
      const r = await moverEtapaEnProducto(id, embudo, etapa, { autor: autorDe(ctx) });
      const n = await nombresDe(id, embudo);
      if (r.antes === etapa) return { ok: false, resumen: `${n.lead} ya estaba en «${n.etapa(etapa)}» de «${n.producto}»: no se movió nada.` };
      invalidar('leads');
      return { ok: true, resumen: `Listo: ${n.lead} pasó de «${n.etapa(r.antes)}» a «${n.etapa(etapa)}» en «${n.producto}».` };
    }),
  },

  // Las ETIQUETAS del CRM (mig 0224): todo por lib/etiquetas.ts, la única puerta de escritura.
  crear_etiqueta: {
    preparar: async (input) => {
      const nombre = limpiarNombreEtiqueta(input.nombre);
      if (!nombre) return { error: 'Falta el nombre de la etiqueta.', faltan: ['nombre'] };
      const todas = await listarEtiquetas().catch(() => null);
      if (!todas) return { error: 'No se pudieron leer las etiquetas del negocio.' };
      const ya = todas.find((e) => claveNombre(e.nombre) === claveNombre(nombre));
      if (ya) return { error: `Ya hay una etiqueta «${ya.nombre}» (id ${ya.id}).`, yaEstaba: true };
      if (input.color !== undefined && !colorValido(input.color)) return { error: `«${String(input.color)}» no es un color #RRGGBB.` };
      const v = await vinculoDeInput(input);
      if ('error' in v) return v;
      const w = await whatsappDeInput(input);
      if ('error' in w) return w;
      const extras = [v.texto, w.texto].filter(Boolean).join(', ');
      return {
        payload: { nombre, color: colorValido(input.color), emoji: emojiValido(input.emoji), vinculo: v.vinculo ?? null, waLabelId: w.labelId ?? null },
        resumen: `Crear la etiqueta «${nombre}»${extras ? `, ${extras}` : ''}.`,
      };
    },
    ejecutar: (payload) => seguro('crear la etiqueta', async () => {
      try {
        const { etiqueta } = await crearEtiqueta({
          nombre: payload.nombre, color: payload.color ?? undefined, emoji: payload.emoji ?? undefined,
          vinculo: (payload.vinculo as EntradaEtiqueta['vinculo']) ?? null, waLabelId: (payload.waLabelId as string | null) ?? null,
        });
        return { ok: true, resumen: `Listo: creada la etiqueta «${etiqueta.nombre}» (id ${etiqueta.id}).`, datos: { etiquetaId: etiqueta.id } };
      } catch (e) {
        if (esEtiquetaError(e)) return { ok: false, resumen: e.message };
        throw e;
      }
    }),
  },
  editar_etiqueta: {
    preparar: async (input) => {
      const e = await etiquetaDeInput(input.etiquetaId);
      if (!e) return { error: noExisteEtiqueta(input.etiquetaId) };
      const payload: Record<string, unknown> = { etiquetaId: e.id };
      const cambios: string[] = [];
      const nombre = input.nombre !== undefined ? limpiarNombreEtiqueta(input.nombre) : '';
      if (input.nombre !== undefined && !nombre) return { error: 'El nombre no puede quedar vacío.' };
      if (nombre && nombre !== e.nombre) {
        if (claveNombre(nombre) !== claveNombre(e.nombre)) {
          const otra = (await listarEtiquetas().catch(() => [])).find((x) => x.id !== e.id && claveNombre(x.nombre) === claveNombre(nombre));
          if (otra) return { error: `Ya hay una etiqueta «${otra.nombre}» (id ${otra.id}).` };
        }
        payload.nombre = nombre; cambios.push(`nombre «${nombre}»`);
      }
      if (input.color !== undefined) {
        const c = colorValido(input.color);
        if (!c) return { error: `«${String(input.color)}» no es un color #RRGGBB.` };
        if (c !== e.color.toUpperCase()) { payload.color = c; cambios.push(`color ${c}`); }
      }
      if (input.emoji !== undefined && emojiValido(input.emoji) !== e.emoji) { payload.emoji = emojiValido(input.emoji); cambios.push('emoji'); }
      if (input.sinEtapa === true) {
        if (e.etapa_key) { payload.vinculo = null; cambios.push('sin etapa vinculada'); }
      } else {
        const v = await vinculoDeInput(input);
        if ('error' in v) return v;
        if (v.vinculo && (v.vinculo.etapaKey !== e.etapa_key || v.vinculo.funnelId !== e.funnel_id)) { payload.vinculo = v.vinculo; cambios.push(v.texto ?? 'etapa'); }
      }
      if (input.sinWhatsApp === true) {
        if (e.wa_label_id) { payload.waLabelId = null; cambios.push('sin etiqueta de WhatsApp'); }
      } else {
        const w = await whatsappDeInput(input);
        if ('error' in w) return w;
        if (w.labelId && w.labelId !== e.wa_label_id) { payload.waLabelId = w.labelId; cambios.push(w.texto ?? 'WhatsApp'); }
      }
      if (!cambios.length) return { error: `«${e.nombre}» ya está así: no cambia nada.`, yaEstaba: true };
      return { payload, resumen: `Editar la etiqueta «${e.nombre}»: ${cambios.join(', ')}.` };
    },
    ejecutar: (payload) => seguro('editar la etiqueta', async () => {
      const entrada: EntradaEtiqueta = {};
      if ('nombre' in payload) entrada.nombre = payload.nombre;
      if ('color' in payload) entrada.color = payload.color;
      if ('emoji' in payload) entrada.emoji = payload.emoji;
      if ('vinculo' in payload) entrada.vinculo = (payload.vinculo as EntradaEtiqueta['vinculo']) ?? null;
      if ('waLabelId' in payload) entrada.waLabelId = (payload.waLabelId as string | null) ?? null;
      try {
        const e = await editarEtiqueta(Number(payload.etiquetaId), entrada);
        return { ok: true, resumen: `Listo: la etiqueta «${e.nombre}» quedó guardada.` };
      } catch (err) {
        if (esEtiquetaError(err)) return { ok: false, resumen: err.message };
        throw err;
      }
    }),
  },
  archivar_etiqueta: {
    preparar: async (input) => {
      const e = await etiquetaDeInput(input.etiquetaId);
      if (!e) return { error: noExisteEtiqueta(input.etiquetaId) };
      const archivar = input.archivar !== false;
      if (Boolean(e.archivada_at) === archivar) return { error: `«${e.nombre}» ya está ${archivar ? 'archivada' : 'activa'}.`, yaEstaba: true };
      if (!archivar) return { payload: { etiquetaId: e.id, archivar }, resumen: `Recuperar la etiqueta «${e.nombre}».` };
      const uso = await usoDeEtiqueta(e.id);
      return { payload: { etiquetaId: e.id, archivar }, resumen: `Archivar la etiqueta «${e.nombre}»${usoTexto(uso)}.` };
    },
    ejecutar: (payload) => seguro('archivar la etiqueta', async () => {
      try {
        const { etiqueta } = await archivarEtiqueta(Number(payload.etiquetaId), payload.archivar !== false);
        return { ok: true, resumen: etiqueta.archivada_at ? `Listo: «${etiqueta.nombre}» quedó archivada.` : `Listo: «${etiqueta.nombre}» volvió a estar activa.` };
      } catch (err) {
        if (esEtiquetaError(err)) return { ok: false, resumen: err.message };
        throw err;
      }
    }),
  },
  poner_etiqueta_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const e = await etiquetaDeInput(input.etiquetaId);
      if (!e) return { error: noExisteEtiqueta(input.etiquetaId) };
      if (e.archivada_at) return { error: `«${e.nombre}» está archivada: no se puede agregar.` };
      const suyas = await etiquetasDeLead(lead.id).catch(() => null);
      if (!suyas) return { error: 'No se pudieron leer las etiquetas del lead.' };
      if (suyas.some((x) => x.id === e.id)) return { error: `${lead.nombre} ya tiene «${e.nombre}».`, yaEstaba: true };
      return {
        payload: { leadId: lead.id, etiquetaId: e.id },
        resumen: `Agregarle «${e.nombre}» a ${lead.nombre}${e.etapa_key ? ' (está vinculada a una etapa: lo pasa ahí)' : ''}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('agregar la etiqueta', async () => {
      const r = await ponerEtiqueta(Number(payload.leadId), Number(payload.etiquetaId), { autor: autorDe(ctx) });
      if (!r.ok) return { ok: false, resumen: `No se pudo agregar la etiqueta: ${r.error}` };
      if (r.yaEstaba) return { ok: true, resumen: 'Ya la tenía: no cambió nada.' };
      invalidar('leads');
      return { ok: true, resumen: `Listo: etiqueta agregada${r.movio ? ', y pasó a la etapa vinculada' : ''}.${fallosSync(r)}` };
    }),
  },
  sacar_etiqueta_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const e = await etiquetaDeInput(input.etiquetaId);
      if (!e) return { error: noExisteEtiqueta(input.etiquetaId) };
      const suyas = await etiquetasDeLead(lead.id).catch(() => null);
      if (!suyas) return { error: 'No se pudieron leer las etiquetas del lead.' };
      if (!suyas.some((x) => x.id === e.id)) return { error: `${lead.nombre} no tiene «${e.nombre}».`, yaEstaba: true };
      return { payload: { leadId: lead.id, etiquetaId: e.id }, resumen: `Eliminarle «${e.nombre}» a ${lead.nombre}.` };
    },
    ejecutar: (payload, ctx) => seguro('eliminar la etiqueta', async () => {
      const r = await sacarEtiqueta(Number(payload.leadId), Number(payload.etiquetaId), { autor: autorDe(ctx) });
      if (!r.ok) return { ok: false, resumen: `No se pudo eliminar la etiqueta: ${r.error}` };
      if (r.yaEstaba) return { ok: true, resumen: 'Ya no la tenía: no cambió nada.' };
      invalidar('leads');
      return { ok: true, resumen: `Listo: etiqueta eliminada.${fallosSync(r)}` };
    }),
  },

  // ── Acciones pantalla (genérica /mako/revisar) ──────────────────────────────
  oferta_del_lead: {
    leer: (input) => conLead(input, async (lead) => {
      const r = await ofertasDelLead(lead.id);
      if (!r) return fallo(noExiste(lead.id));
      return json({ lead: { id: lead.id, nombre: lead.nombre }, actual: r.actual, ofertas: r.ofertas });
    }),
  },
  asignar_oferta_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const quitar = b(input.quitar) === true;
      const ofertaId = n(input.ofertaId);
      if (!quitar && ofertaId == null) return { error: 'Falta la oferta: pasa ofertaId (de oferta_del_lead) o quitar.', faltan: ['ofertaId'] };
      const r = await ofertasDelLead(lead.id);
      if (!r) return { error: noExiste(lead.id) };
      if (quitar) {
        if (r.actual == null) return { error: `${lead.nombre} no tiene oferta.`, yaEstaba: true };
        return { payload: { leadId: lead.id, ofertaId: null }, resumen: `Dejar a ${lead.nombre} sin oferta.` };
      }
      const o = r.ofertas.find((x) => x.id === ofertaId);
      if (!o) return { error: `No existe la oferta #${ofertaId} en este negocio. Míralas con oferta_del_lead.` };
      if (r.actual === o.id) return { error: `${lead.nombre} ya tiene la oferta «${o.nombre}».`, yaEstaba: true };
      return { payload: { leadId: lead.id, ofertaId: o.id }, resumen: `Asignarle a ${lead.nombre} la oferta «${o.nombre}».` };
    },
    ejecutar: (payload, ctx) => seguro('asignar la oferta', async () => {
      const ofertaId = payload.ofertaId == null ? null : Number(payload.ofertaId);
      const r = await asignarOfertaAlLead(Number(payload.leadId), ofertaId, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: r.error };
      invalidar('leads');
      return { ok: true, resumen: ofertaId == null ? 'Listo: quedó sin oferta.' : `Listo: oferta «${r.nombre}» asignada.` };
    }),
  },
  crear_oferta_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const v = validarOfertaNueva({ nombre: input.nombre, modelo: input.modelo, ticket: input.ticketUsd });
      if (!v.ok) return { error: v.error };
      const r = await ofertasDelLead(lead.id);
      if (!r) return { error: noExiste(lead.id) };
      const ya = r.ofertas.find((o) => o.nombre.toLowerCase() === v.nombre.toLowerCase());
      if (ya) return { error: `Ya hay una oferta «${ya.nombre}» (id ${ya.id}): asígnala con asignar_oferta_lead.` };
      const cobro = v.modelo === 'suscripcion' ? 'por mes' : 'pago único';
      return {
        payload: { leadId: lead.id, nombre: v.nombre, modelo: v.modelo, ticket: v.ticket },
        resumen: `Crear la oferta «${v.nombre}» (${v.ticket != null ? `USD ${v.ticket} ` : ''}${cobro}) y asignársela a ${lead.nombre}.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('crear la oferta', async () => {
      const r = await crearOfertaParaLead(Number(payload.leadId), { nombre: payload.nombre, modelo: payload.modelo, ticket: payload.ticket }, autorDe(ctx));
      if (!r.ok) return { ok: false, resumen: r.error };
      invalidar('leads');
      return { ok: true, resumen: `Listo: creada la oferta «${r.oferta.nombre}» (id ${r.oferta.id}) y asignada.`, datos: { ofertaId: r.oferta.id } };
    }),
  },
  editar_contacto_lead: {
    preparar: async (input) => {
      const lead = await leadDe(input.leadId);
      if (!lead) return { error: noExiste(input.leadId) };
      const campos = CAMPOS_CONTACTO;
      const email = s(input.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: `«${email}» no parece un email.` };
      const tel = s(input.telefono);
      if (tel && tel.replace(/\D/g, '').length < 8) return { error: `«${tel}» no parece un teléfono completo (con código de país).` };
      const payload: Record<string, unknown> = { leadId: lead.id };
      const cambios: string[] = [];
      for (const k of campos) {
        let v = s(input[k]);
        // Instagram se guarda como en la ficha: el usuario, sin la @ (`usuarioInstagram`).
        if (v && k === 'instagram') {
          const u = usuarioInstagram(v);
          if (!u) return { error: `«${v}» no parece un usuario de Instagram.` };
          v = u;
        }
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
      for (const k of CAMPOS_CONTACTO) if (typeof payload[k] === 'string') meta[k] = payload[k] as string;
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
      const cambios = await saveLeadPlanManual(id, { total_usd: n(payload.total_usd) ?? null, duracion_meses: n(payload.duracion_meses) ?? null, fecha_cierre: s(payload.fecha_cierre) ?? null, fecha_inicio: s(payload.fecha_inicio) ?? null, cuotas });
      // ⚠️ LO QUE NO SE TOCÓ SE DICE. Una cuota con un link sin pagar o un recordatorio corriendo se conserva como
      // está, y contestar «Listo: N cuotas» sobre eso afirmaba un plan que no quedó escrito.
      const sinTocar = avisoDeConservadas(cambios);
      await logLeadEvent(id, 'Plan de pagos', `Cuotas actualizadas desde ${canalTxt(ctx)} (${cuotas.length} sin pagar)${sinTocar ? ` · no se tocó: ${sinTocar}` : ''}`, autorDe(ctx));
      // saveLeadPlanManual escribe estado_lead con un update directo que no audita:
      // el diff deja en el historial que el lead pasó a ganado y quién lo hizo.
      await logLeadChanges(id, before, await getLead(id).catch(() => null), autorDe(ctx));
      invalidar('pagos', 'leads');
      return { ok: true, resumen: sinTocar
        ? `Guardé las cuotas de ${before.nombre} menos lo que no se puede cambiar (${sinTocar}); el lead quedó como ganado.`
        : `Listo: ${cuotas.length} cuota(s) guardadas para ${before.nombre}; el lead quedó como ganado.` };
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
      return { id: r.id, url: linkApp(`/crm/revisar/${r.id}`, await getWorkspaceActual()), nueva: r.nueva, extra: { leads: r.leads, ...(r.descartados.length ? { descartados: r.descartados } : {}) } };
    },
    ejecutar: async () => ({ ok: false, resumen: 'Esta propuesta se confirma en su pantalla de revisión, no por aquí.' }),
  },
};
