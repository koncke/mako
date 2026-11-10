// =============================================================================
// api-mako/areas/ads.run — los cuerpos del área `ads`
// =============================================================================
// Un runner por id de ads.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }
// (o { proponerLegado, ejecutar } para las heredadas de lib/mako-doer-acciones.ts).
// Todo corre adentro de runWithWorkspace(ctx.ws): las libs que scopean con
// getTenantDb / credWs scopean solas. Nunca se escribe desde leer() ni preparar().
//
// ⚠️ Tres cosas que un lector de estos cuerpos no ve en las libs:
//  · metaWrite (lib/meta-write.ts) recibe el ws EXPLÍCITO y de ahí saca el token. Va
//    SIEMPRE ctx.ws, nunca un número a mano: hasta el 07/10/2026 usaba envCred (la
//    cuenta del ws 1 para todos) y por eso estas escrituras estaban cerradas al ws 1.
//  · Meta devuelve «no pude leer» con la misma cara que «no hay»: listPixelEvents y
//    getAdsAprobacionPendiente caen a vacío ante un error. Las salidas lo DICEN.
//  · Los montos que en lib/ se llaman *Mxn están en la MONEDA DE LA CUENTA.
// =============================================================================

import 'server-only';
import { leerConfig as leerConfigMB, leerDecisiones as leerDecisionesMB, leerDecision as leerDecisionMB, reclamar as reclamarMB, guardarConfig as guardarConfigMB, validarCambio as validarCambioMB, cupoDe as cupoMB, actualizar as actualizarMB, PlanSinPiloto } from '@/lib/media-buyer/store';
import { modoEfectivo as modoEfectivoMB } from '@/lib/media-buyer/plan';
import { ORDEN_TACTICAS, TACTICAS, resolverTacticas, validarTacticas, type TacticaAuto } from '@/lib/media-buyer/tacticas';
import { lanzar as lanzarMB, deshacer as deshacerMB } from '@/lib/media-buyer/ejecutar';
import { revisarMontoEditado } from '@/lib/media-buyer/monto';
import { fmtDinero } from '@/lib/format';
import { leerDatosCuenta as leerDatosCuentaMB, SinCuentaParaOperar as SinCuentaMB } from '@/lib/media-buyer/datos';
import { llevarHooksAlVideo as llevarHooksAlVideoMB } from '@/lib/media-buyer/hooks-video';
import { analizarCuenta as analizarCuentaMB } from '@/lib/media-buyer/corrida';
import { crearCampana as crearCampanaMB, prepararCampana as prepararCampanaMB } from '@/lib/media-buyer/campana';
import type { LugarZona as LugarZonaMB } from '@/lib/media-buyer/zona';
import { resolverLugares as resolverLugaresMB } from '@/lib/media-buyer/publico';
import type { Decision as DecisionMB } from '@/lib/media-buyer/tipos';
import { AGENTES_MAKO, AGENTE_DE, NOMBRE_AGENTE, QUE_HACE, TACTICAS_DE, TACTICA_DE_ESTADO, cambioDeAgente, estadoDeAgente, type AgenteMako, type EstadoAgente } from '@/lib/media-buyer/agentes';
import { agenteDeClave } from '@/lib/media-buyer/agentes-propios';
import { leerAgentesPropios, guardarAgentePropio, borrarAgentePropio } from '@/lib/media-buyer/agentes-ia';
import { leerPerfilCopiloto, guardarPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { METODO_ANUNCIOS, TEMAS_METODO, type TemaMetodo } from '@/lib/media-buyer/copiloto-metodo-anuncios';
import { esPreguntaHipotetica } from '@/lib/media-buyer/copiloto-pedido';
import {
  sanearPerfil, pasoDeCopiloto, propuestaDe, funnelElegido, seccionesDe, recomendarFunnel, evaluarFunnel, aplicarCambio as aplicarPerfil, datosDeDecision,
  fichaDelNegocio, compararFunnels, cuentaDe, TIPOS_DE_NEGOCIO, type PerfilCopiloto,
} from '@/lib/media-buyer/copiloto';
import { lienzoMediaBuyer, vistaMediaBuyer } from '@/lib/media-buyer/vista';
import { campanasRetenidas } from '@/lib/media-buyer/productos';
import { conjuntosDe as conjuntosDeMB, generadosDelNegocio as generadosDelNegocioMB, plantillaDelConjunto as plantillaDelConjuntoMB, revisarSubida as revisarSubidaMB, subirCreativos as subirCreativosMB } from '@/lib/media-buyer/subir';
import { archivoValido as archivoValidoSubida, leerPedidoDeSubida, NOMBRE_CTA as NOMBRE_CTA_SUBIDA } from '@/lib/media-buyer/creativos';
import { esPathDeStaging } from '@/lib/ads-staging';
import { barrerStagingViejo, faltanEnStaging, firmarSubidaDeStaging } from '@/lib/ads-staging-firma';
import type { Alerta as AlertaMB } from '@/lib/media-buyer/protect';
import { after } from 'next/server';
import type { Ctx, Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { quienChatea } from '../tipos';
import { crearRunnerAcciones, ejecutarAccion } from '@/lib/mako-doer-acciones';
import { runWithWorkspace } from '@/lib/workspace';
import { leerRefCreativo } from '@/lib/creativo-mako';
import { resolverCreativoMako } from '@/lib/creativo-mako-fuentes';
import { filaDeRendimiento } from '@/lib/ads-rendimiento';
import { calcularPresupuestoAds } from '@/lib/calculadora-presupuesto-ads';
import { ROTULO_FUNNEL, sanearPlan } from '@/lib/funnel-plan';
import { guardarPlanFunnel, leerPlanFunnel } from '@/lib/funnel-plan-db';
import { metaWrite, type MetaWriteBody } from '@/lib/meta-write';
import { getMetaAccountHealth, type NodoEstado } from '@/lib/meta-health';
// El aviso «es N veces el actual» vive en UN lugar con la tabla del Ads Manager: era la
// misma cuenta escrita dos veces acá y una tercera en el cartel de la pantalla.
import { saltoPresupuesto } from '@/lib/presupuesto-cambio';
import { explicarIssueEs, esAprobacionPendiente, linkAprobarEnMeta } from '@/lib/meta-health-ui';
import {
  listCustomAudiences, searchInterests, listLeadForms, listPixels, listPixelEvents, listCustomConversions,
  searchLugares, cuentaMeta, identidadesMeta, paginasDeGanadores, getAdsetTargeting, getAdForEdit,
  getCampaignBasics, getAdsetForAdd, getAdsAprobacionPendiente, getAdAccountId, formularioBase,
  addAdToAdset, updateAdCopy, createCustomAudience, crearFormularioInstantaneo, metaErrorEnvelope, editarPublicoConjunto,
} from '@/lib/meta-ads-create';
import { cambiosDesdeEntrada, entradaDesdeApi, resumenDeCambios, type EntradaPublico } from '@/lib/publico-cambios';
import { lugaresDesdeMeta } from '@/lib/meta-geo';
import { publicoParaZernio } from '@/lib/zernio-publico';
import { explicarRechazoPublicacion } from '@/lib/meta-publicar-errores';
import { erroresFormulario, type FormularioNuevo, type PreguntaEstandar } from '@/lib/meta-formularios';
import type { Creative, CTAType } from '@/lib/campaign-types';
import { ANUNCIO_DESDE_ARCHIVO_APAGADO, MAX_VIDEO_BYTES, errorDelArchivo, linkDeDescarga, rutaEnElBucket, tipoDelArchivo } from '@/lib/anuncio-desde-archivo';
import { leerIncidentes } from '@/lib/meta-health-history';
import { getSenalesRecon } from '@/lib/queries';
import { motivosDeVentaPorLlamada } from '@/lib/venta-por-llamada';
import { tzDeWorkspace } from '@/lib/timezone';
import { hoyEnTz, diasAntes } from '@/lib/date-utils';
import { TIPO_DE_CAMBIO_USD_MXN } from '@/lib/config';
import {
  getScriptAnalystView, getScriptView, getQuadrantData, buildAccountProfile, getDrafts, deleteDraft,
  valorarGuion, syncScriptAnalyses, analyzeOne, setAngleOverride, setAvatarOverride, type ScriptView,
} from '@/lib/ads-analyst';
import { getAngles, setAngles, angleKey } from '@/lib/script-angles';
import { getAvatares, setAvatares, avatarKey } from '@/lib/script-avatares';
import {
  SIN_META, metaConectada, arbolMeta, nodoDe, soloDigitos, esFecha, publicacionesMako, transcriptDeAnuncio,
  tieneAnalisis, vocabularioParaEscribir, estadoVivoMeta,
} from './ads.helpers';

// ── utilidades ──────────────────────────────────────────────────────────────

type In = Record<string, unknown>;
const J = (o: unknown): string => JSON.stringify(o);
const str = (i: In, k: string): string => (typeof i[k] === 'string' ? (i[k] as string).trim() : '');
const num = (i: In, k: string): number | null => (typeof i[k] === 'number' && Number.isFinite(i[k]) ? (i[k] as number) : null);
const fallo = (error: string): SalidaLectura => ({ content: J({ ok: false, error }), isError: true });
const r2 = (n: number | null | undefined): number | null => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

const legado = (ctx: Ctx) => crearRunnerAcciones(ctx.ws, ctx.canalKey, ctx.turnStart ?? 0, ctx.mensajeUsuario ?? '');
const texto = async (p: Promise<string | { content: string; isError?: boolean }>): Promise<string> => {
  const r = await p;
  return typeof r === 'string' ? r : r.content;
};

/** Una lectura en vivo de Meta: exige la integración y traduce el error de Meta a un
 *  «no pude leer» explícito (nunca a un vacío). */
async function vivo(fn: () => Promise<unknown>): Promise<SalidaLectura> {
  if (!(await metaConectada())) return fallo(SIN_META);
  try {
    return J(await fn());
  } catch (err) {
    return fallo(`Meta no contestó (${metaErrorEnvelope(err).message}). Eso NO significa que no haya datos: es la lectura la que falló.`);
  }
}

const nodoCompacto = (n: NodoEstado) => ({
  id: n.id, nombre: n.name, estado: n.effectiveStatus, estado_texto: n.statusLabel, semaforo: n.semaforo,
  ...(n.objective ? { objetivo: n.objective } : {}),
  presupuesto_diario_moneda_cuenta: n.dailyBudgetMxn ?? null,
  ...(n.lifetimeBudgetMxn != null ? { presupuesto_total_moneda_cuenta: n.lifetimeBudgetMxn } : {}),
});

const problemasDe = (n: NodoEstado, accountId: string | null) => (n.issues ?? []).map((it) => {
  const e = explicarIssueEs(it);
  const aprob = esAprobacionPendiente(it);
  return { titulo: e.titulo, detalle: e.detalle, codigo: it.code ?? null, aprobacion_manual: aprob, ...(aprob ? { link_aprobar: linkAprobarEnMeta(accountId, n.id) } : {}) };
});

/** Escribir a Meta por metaWrite, con la cuenta del workspace de la pendiente. */
async function escribirMeta(ctx: Ctx, body: MetaWriteBody, ok: string): Promise<Ejecutado> {
  const r = await metaWrite(body, ctx.ws);
  if (!r.ok) return { ok: false, resumen: `Meta rechazó el cambio: ${r.message}` };
  return { ok: true, resumen: ok, datos: { id: r.id, ...(r.propagadas != null ? { propagadas: r.propagadas } : {}) } };
}

/**
 * Corre `trabajo` DESPUÉS de contestar, re-entrando al workspace (after() corre fuera
 * del AsyncLocalStorage: sin runWithWorkspace, getTenantDb caería a otro ws). Para el
 * análisis de guiones: una sola llamada es chatClaude con thinking y effort high, y la
 * lib reserva 150 s para UNA; la ruta v1 corta a los 60 s. Síncrono, la función moría
 * después de reclamar la pendiente y la dejaba `confirmada` para siempre. Así la
 * pendiente se resuelve al toque con «quedó en marcha», y si la plataforma corta el
 * trabajo no queda nada a medias: processCandidate escribe la fila recién al final
 * (y el proceso diario retoma lo que siga pendiente). El techo sigue siendo el
 * maxDuration de la función que CONFIRMÓ (60 s por la ruta v1).
 * Fuera de un request (un script), after() tira: ahí se corre en línea.
 */
async function enSegundoPlano(ws: number, etiqueta: string, trabajo: () => Promise<unknown>): Promise<'fondo' | 'en_linea'> {
  const envuelto = () => runWithWorkspace(ws, async () => {
    try { await trabajo(); } catch (err) { console.error(`[api-mako:ads] ${etiqueta} falló: ${err instanceof Error ? err.message : String(err)}`); }
  });
  try { after(envuelto); return 'fondo'; } catch { await envuelto(); return 'en_linea'; }
}

/** Tope duro de un presupuesto nuevo contra el actual. Un ×100 del modelo (centavos
 *  contra unidades) no puede llegar a la pantalla como una propuesta normal. */
const TOPE_SALTO_PRESUPUESTO = 10;

/** El motivo por el que un monto no se propone, o null. Con presupuesto actual 0 no
 *  hay contra qué comparar: tampoco se propone (el aviso «N veces» ni se calculaba). */
function topePresupuesto(monto: number, actual: number, moneda: string, quien: string): string | null {
  if (!(actual > 0)) return `${quien} figura con presupuesto diario 0: no hay contra qué comparar el monto nuevo. Cámbialo desde el Ads Manager.`;
  if (monto > actual * TOPE_SALTO_PRESUPUESTO) return `${monto} ${moneda}/día es más de ${TOPE_SALTO_PRESUPUESTO} veces el presupuesto actual (${actual} ${moneda}/día). Revisa el monto (¿centavos contra unidades?); si de verdad es ese, cámbialo desde el Ads Manager.`;
  return null;
}

/** Error de Meta al crear, con la traducción de los rechazos conocidos. */
/** ¿El negocio tiene por dónde crear un anuncio por Zernio? Su Meta conectada por Zernio, o los anuncios por Zernio aparte del token.
 *  Sin poder leerlo, no: el anuncio desde un archivo no tiene otro camino (Meta directo pide el creativo ya subido). */
async function anunciosPorZernio(ws: number): Promise<boolean> {
  try {
    const { canalMeta } = await import('@/lib/meta-via');
    if ((await canalMeta(ws)).via === 'zernio') return true;
    const [{ conexionAnunciosZernio }, { credWs }] = await Promise.all([import('@/lib/zernio-ads'), import('@/lib/credenciales')]);
    return !!(await conexionAnunciosZernio(ws, await credWs('META_AD_ACCOUNT_ID', ws)));
  } catch { return false; }
}

function errorAlCrear(err: unknown, reusaGanador = false): Ejecutado {
  const env = metaErrorEnvelope(err);
  return { ok: false, resumen: `Meta rechazó la creación: ${explicarRechazoPublicacion(env.error_subcode, { reusaGanador }) ?? env.message}` };
}

const COLORES_OK = /^#[0-9a-fA-F]{6}$/;

// ── guiones ─────────────────────────────────────────────────────────────────

const guionCompacto = (s: ScriptView) => ({
  ad_id: s.adId, nombre: s.name, etiqueta: s.short, angulo: s.angle, avatar: s.avatar || null, tipo_gancho: s.hookType,
  formato: s.format, es_imagen: s.esImagen, duracion_s: Math.round(s.dur), hook_rate_pct: s.esImagen ? null : r2(s.hookRate),
  retencion_final_pct: s.esImagen ? null : r2(s.finalRet), ctr_pct: r2(s.ctr), agendas_meta: s.agendas, cierres_crm: s.cierres,
  gasto_usd_derivado: Math.round(s.spend), impresiones: s.impressions, frecuencia: r2(s.freq), dias_activos: s.days,
  ultima_fecha: s.lastFecha, campana: s.campana, conjunto: s.adset,
  diagnostico: s.note ? `${s.note.title}: ${s.note.text}` : null, gancho_sugerido: s.suggestion,
});

const NOTA_GUIONES = 'Gasto en USD = gasto de Meta ÷ tipo de cambio fijo (derivado, no lo que cobró Meta). Agendas = conversión de Meta atribuida al anuncio; cierres = CRM. Métricas de TODO el histórico del anuncio.';

// ── vocabulario ─────────────────────────────────────────────────────────────

type Vocab = 'angulos' | 'avatares';
const claveDe = (cual: Vocab, o: { key?: string; label?: string }) => (cual === 'angulos' ? angleKey : avatarKey)(String(o.key ?? o.label ?? ''));

function prepararAgregarVocab(cual: Vocab) {
  return async (input: In): Promise<Preparado> => {
    const label = str(input, 'label');
    if (!label) return { error: 'El nombre es obligatorio.', faltan: ['label'] };
    const v = await vocabularioParaEscribir(cual);
    if ('error' in v) return { error: v.error };
    const key = claveDe(cual, { label });
    if (v.lista.some((x) => claveDe(cual, x) === key)) return { error: `Ya existe ${cual === 'angulos' ? 'un ángulo' : 'un avatar'} con la clave «${key}».` };
    const color = str(input, 'color');
    const desc = str(input, 'desc');
    return {
      payload: { label, ...(desc ? { desc } : {}), ...(COLORES_OK.test(color) ? { color } : {}) },
      resumen: `Agregar ${cual === 'angulos' ? 'el ángulo' : 'el avatar'} «${label}» (clave ${key})${desc ? `: ${desc}` : ''}`,
    };
  };
}

function prepararEditarVocab(cual: Vocab) {
  return async (input: In): Promise<Preparado> => {
    const key = str(input, 'key');
    const cambios = { label: str(input, 'label'), desc: str(input, 'desc'), color: str(input, 'color') };
    if (!cambios.label && !cambios.desc && !cambios.color) return { error: 'No hay nada que cambiar: manda label, desc o color.', faltan: ['label'] };
    if (cambios.color && !COLORES_OK.test(cambios.color)) return { error: 'El color tiene que ser #RRGGBB.' };
    const v = await vocabularioParaEscribir(cual);
    if ('error' in v) return { error: v.error };
    const actual = v.lista.find((x) => claveDe(cual, x) === key);
    if (!actual) return { error: `No existe la clave «${key}».`, disponibles: v.lista.map((x) => claveDe(cual, x)) };
    return {
      payload: { key, ...Object.fromEntries(Object.entries(cambios).filter(([, x]) => x)) },
      resumen: `Editar «${actual.label}» (${key}): ${Object.entries(cambios).filter(([, x]) => x).map(([k, x]) => `${k} → ${x}`).join(' · ')}`,
    };
  };
}

function ejecutarVocab(cual: Vocab, op: 'agregar' | 'editar' | 'borrar') {
  return async (payload: In): Promise<Ejecutado> => {
    // Se relee ESTRICTO al ejecutar: entre la propuesta y el «sí» la pantalla pudo cambiar la lista.
    const v = await vocabularioParaEscribir(cual);
    if ('error' in v) return { ok: false, resumen: v.error };
    const key = String(payload.key ?? '');
    let lista = v.lista;
    if (op === 'agregar') lista = [...lista, { label: String(payload.label), ...(payload.color ? { color: String(payload.color) } : {}), ...(payload.desc ? { desc: String(payload.desc) } : {}) } as (typeof lista)[number]]; // sin `key`: sanitize la deriva del label (con key '' sería «angulo»)
    else if (op === 'editar') {
      if (!lista.some((x) => claveDe(cual, x) === key)) return { ok: false, resumen: `La clave «${key}» ya no existe.` };
      lista = lista.map((x) => (claveDe(cual, x) === key ? { ...x, key, ...(payload.label ? { label: String(payload.label) } : {}), ...(payload.desc ? { desc: String(payload.desc) } : {}), ...(payload.color ? { color: String(payload.color) } : {}) } : x));
    } else {
      if (!lista.some((x) => claveDe(cual, x) === key)) return { ok: false, resumen: `La clave «${key}» ya no existe.` };
      lista = lista.filter((x) => claveDe(cual, x) !== key);
    }
    try {
      const final = cual === 'angulos' ? await setAngles(lista) : await setAvatares(lista);
      return { ok: true, resumen: `Listo: ${final.length} ${cual} en el vocabulario.`, datos: { claves: final.map((x) => x.key) } };
    } catch (err) {
      return { ok: false, resumen: err instanceof Error ? err.message : 'No se pudo guardar.' };
    }
  };
}

function prepararBorrarVocab(cual: Vocab) {
  return async (input: In): Promise<Preparado> => {
    const key = str(input, 'key');
    const v = await vocabularioParaEscribir(cual);
    if ('error' in v) return { error: v.error };
    const actual = v.lista.find((x) => claveDe(cual, x) === key);
    if (!actual) return { error: `No existe la clave «${key}».`, disponibles: v.lista.map((x) => claveDe(cual, x)) };
    if (cual === 'angulos' && v.lista.length <= 1) return { error: 'Es el único ángulo: la lista no puede quedar vacía.' };
    // La descripción y el color van en el resumen: volver a agregarlo con el mismo nombre
    // recupera la clave pero NO la descripción que guía a la IA. Así queda escrito.
    const ultimo = cual === 'avatares' && v.lista.length <= 1 ? ' Es el último avatar: la IA deja de clasificar avatar en los próximos análisis.' : '';
    return { payload: { key }, resumen: `Quitar ${cual === 'angulos' ? 'el ángulo' : 'el avatar'} «${actual.label}» (${key}) del vocabulario. Descripción actual: ${actual.desc ? `«${actual.desc}»` : '(sin descripción)'}; color ${actual.color || '(sin color)'}.${ultimo}` };
  };
}

function prepararOverride(cual: Vocab, campo: 'angle' | 'avatar') {
  return async (input: In): Promise<Preparado> => {
    const adId = str(input, 'ad_id');
    const valor = str(input, campo);
    if (!soloDigitos(adId)) return { error: 'ad_id tiene que ser el id numérico del anuncio.' };
    if (!(await tieneAnalisis(adId))) return { error: `El anuncio ${adId} no tiene análisis de guion: no hay nada que corregir.` };
    const aIa = valor.toLowerCase() === 'ia';
    if (!aIa) {
      const lista = cual === 'angulos' ? await getAngles() : await getAvatares();
      if (!lista.some((x) => x.key === valor)) return { error: `«${valor}» no está en el vocabulario de ${cual}.`, disponibles: lista.map((x) => x.key) };
    }
    return { payload: { adId, valor: aIa ? null : valor }, resumen: aIa ? `Devolver ${campo === 'angle' ? 'el ángulo' : 'el avatar'} del anuncio ${adId} a la clasificación de la IA` : `Fijar ${campo === 'angle' ? 'el ángulo' : 'el avatar'} del anuncio ${adId} en «${valor}»` };
  };
}

// ═══════════════════════════════════════════════════════════════════════════

export const RUNNERS: Runners = {
  // ── LECTURAS — Ads Manager ───────────────────────────────────────────────
  listar_campanas_meta: { leer: (input, ctx) => legado(ctx)('listar_campanas_meta', input) },

  ver_estado_meta: {
    leer: async (input) => {
      const a = await arbolMeta();
      if ('error' in a) return fallo(a.error);
      const { h } = a;
      const soloActivas = input.soloActivas === true;
      const conjPorCamp = new Map<string, number>();
      for (const s of h.adsets) if (s.parentId) conjPorCamp.set(s.parentId, (conjPorCamp.get(s.parentId) ?? 0) + 1);
      const campDeConj = new Map(h.adsets.map((s) => [s.id, s.parentId]));
      const adsPorCamp = new Map<string, number>();
      for (const ad of h.ads) { const c = ad.parentId ? campDeConj.get(ad.parentId) : null; if (c) adsPorCamp.set(c, (adsPorCamp.get(c) ?? 0) + 1); }
      const TOPE = 60;
      const lista = h.campaigns.filter((c) => !soloActivas || c.effectiveStatus === 'ACTIVE');
      return J({
        leido_en: h.fetchedAtISO,
        ...(h.parcial ? { advertencia: 'Lectura PARCIAL: alguna parte de la cuenta no se pudo leer; pueden faltar campañas, conjuntos o anuncios.' } : {}),
        moneda: h.account.currency,
        cuenta: { estado: h.account.statusLabel, semaforo: h.account.severidad, entrega_frenada: h.account.entregaFrenada, motivo_deshabilitacion: h.account.disableReasonLabel },
        resumen_anuncios: h.resumen,
        campanas: lista.slice(0, TOPE).map((c) => ({ ...nodoCompacto(c), conjuntos: conjPorCamp.get(c.id) ?? 0, anuncios: adsPorCamp.get(c.id) ?? 0 })),
        ...(lista.length > TOPE ? { campanas_omitidas: lista.length - TOPE } : {}),
      });
    },
  },

  ver_salud_cuenta_meta: {
    leer: async () => {
      if (!(await metaConectada())) return fallo(SIN_META);
      try {
        const a = await getMetaAccountHealth();
        return J({
          estado: a.statusLabel, codigo_estado: a.status, semaforo: a.severidad, entrega_frenada: a.entregaFrenada,
          motivo_deshabilitacion: a.disableReasonLabel, moneda: a.currency,
          saldo_adeudado_moneda_cuenta: a.balanceMxn, gastado_historico_moneda_cuenta: a.amountSpentMxn,
          tope_gasto_moneda_cuenta: a.spendCapMxn, prepago: a.isPrepay, zona_horaria: a.timezoneName, pais: a.country,
        });
      } catch (err) {
        return fallo(`No pude leer la cuenta de Meta (${err instanceof Error ? err.message : 'error'}). Eso NO significa que la cuenta esté caída: es la lectura la que falló.`);
      }
    },
  },

  listar_conjuntos_meta: {
    leer: async (input) => {
      const a = await arbolMeta();
      if ('error' in a) return fallo(a.error);
      const camp = str(input, 'campaignId');
      const sem = str(input, 'semaforo');
      const lista = a.h.adsets.filter((s) => (!camp || s.parentId === camp) && (!sem || s.semaforo === sem));
      const TOPE = 100;
      return J({
        moneda: a.h.account.currency, ...(a.h.parcial ? { advertencia: 'Lectura PARCIAL de Meta: pueden faltar conjuntos.' } : {}),
        conjuntos: lista.slice(0, TOPE).map((s) => ({ ...nodoCompacto(s), campaignId: s.parentId, presupuesto_restante_moneda_cuenta: s.budgetRemainingMxn ?? null, aprendizaje: s.learning?.label ?? null })),
        ...(lista.length > TOPE ? { conjuntos_omitidos: lista.length - TOPE } : {}),
      });
    },
  },

  listar_anuncios_meta: {
    leer: async (input) => {
      const a = await arbolMeta();
      if ('error' in a) return fallo(a.error);
      const { h } = a;
      const adset = str(input, 'adsetId');
      const camp = str(input, 'campaignId');
      const sem = str(input, 'semaforo');
      const conjDeCamp = new Set(h.adsets.filter((s) => s.parentId === camp).map((s) => s.id));
      const lista = h.ads.filter((ad) => (!adset || ad.parentId === adset) && (!camp || (ad.parentId != null && conjDeCamp.has(ad.parentId))) && (!sem || ad.semaforo === sem));
      const TOPE = 100;
      return J({
        ...(h.parcial ? { advertencia: 'Lectura PARCIAL de Meta: pueden faltar anuncios.' } : {}),
        anuncios: lista.slice(0, TOPE).map((ad) => ({ id: ad.id, nombre: ad.name, adsetId: ad.parentId, estado: ad.effectiveStatus, estado_texto: ad.statusLabel, semaforo: ad.semaforo, problemas: problemasDe(ad, h.account.accountId) })),
        ...(lista.length > TOPE ? { anuncios_omitidos: lista.length - TOPE } : {}),
      });
    },
  },

  listar_anuncios_con_problemas_meta: {
    leer: async (input) => {
      const a = await arbolMeta();
      if ('error' in a) return fallo(a.error);
      const { h } = a;
      const camp = str(input, 'campaignId');
      const conj = new Map(h.adsets.map((s) => [s.id, s]));
      const campanas = new Map(h.campaigns.map((c) => [c.id, c]));
      const rojos = h.ads.filter((ad) => ad.semaforo === 'rojo').filter((ad) => !camp || conj.get(ad.parentId ?? '')?.parentId === camp);
      return J({
        ...(h.parcial ? { advertencia: 'Lectura PARCIAL de Meta: pueden faltar anuncios.' } : {}),
        total: rojos.length,
        anuncios: rojos.slice(0, 50).map((ad) => {
          const s = conj.get(ad.parentId ?? '');
          return { id: ad.id, nombre: ad.name, estado_texto: ad.statusLabel, conjunto: s?.name ?? null, campana: campanas.get(s?.parentId ?? '')?.name ?? null, problemas: problemasDe(ad, h.account.accountId) };
        }),
        ...(rojos.length > 50 ? { anuncios_omitidos: rojos.length - 50 } : {}),
      });
    },
  },

  listar_recomendaciones_meta: {
    leer: async () => {
      const a = await arbolMeta();
      if ('error' in a) return fallo(a.error);
      const { h } = a;
      return J({
        recomendaciones_de_meta_disponibles: h.recosMetaDisponibles,
        ...(h.recosMetaDisponibles ? {} : { nota: 'Meta no devolvió recomendaciones propias para esta cuenta (común en cuentas nuevas o con poco gasto). Las que hay son sugerencias de MaKo sobre el estado en vivo.' }),
        recomendaciones: h.recomendaciones.slice(0, 40).map((r) => ({ fuente: r.fuente, prioridad: r.prioridad, titulo: r.titulo, detalle: r.detalle })),
        ...(h.recomendaciones.length > 40 ? { omitidas: h.recomendaciones.length - 40 } : {}),
      });
    },
  },

  ver_plan_funnel: {
    leer: async () => {
      const plan = await leerPlanFunnel();
      return J(plan ?? { plan: null, nota: 'Este negocio todavía no guardó un plan del funnel.' });
    },
  },
  guardar_plan_funnel: {
    preparar: async (input) => {
      const plan = sanearPlan(input);
      if (!plan) return { error: 'Falta qué funnel se eligió.' };
      return { payload: { ...plan }, resumen: `Guardar el plan del funnel: ${ROTULO_FUNNEL[plan.funnel]}` };
    },
    ejecutar: async (p) => {
      const plan = sanearPlan(p, new Date().toISOString());
      if (!plan) return { ok: false, resumen: 'No sé qué funnel guardar.' };
      await guardarPlanFunnel(plan);
      return { ok: true, resumen: `Guardé el plan: ${ROTULO_FUNNEL[plan.funnel]}. Lo ves con «Ver el plan».` };
    },
  },
  calcular_presupuesto_anuncios: {
    leer: async (input) => {
      const evento = str(input, 'evento') === 'venta' ? 'venta' : 'lead';
      const plan = calcularPresupuestoAds({
        presupuesto: num(input, 'presupuesto') ?? 0, dias: num(input, 'dias') ?? 0,
        costoPorResultado: num(input, 'costoPorResultado') ?? 0, evento, ticket: num(input, 'ticket') ?? 0,
        cierre: num(input, 'cierre') ?? undefined, avatares: num(input, 'avatares') ?? 3, funcionalidades: num(input, 'funcionalidades') ?? 3,
      });
      return plan.ok ? J(plan) : fallo(plan.error);
    },
  },
  ver_rendimiento_anuncios: {
    leer: async (input, ctx) => {
      const hoy = hoyEnTz(await tzDeWorkspace(ctx.ws));
      const hasta = str(input, 'hasta') || hoy;
      const desde = str(input, 'desde') || diasAntes(hasta, 29);
      if (!esFecha(desde) || !esFecha(hasta)) return fallo('Las fechas van como YYYY-MM-DD.');
      if (desde > hasta) return fallo('«desde» es posterior a «hasta».');
      const limite = num(input, 'limite') ?? 25;
      const senales = await getSenalesRecon(desde, hasta);
      const orden = [...senales].sort((x, y) => y.spend_usd - x.spend_usd);
      const ventana = { desde, hasta, dias: Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1 };
      if (!orden.length) return J({ ventana, anuncios: [], nota: `No hay anuncios con gasto sincronizado entre el ${desde} y el ${hasta}. Eso NO significa que no se invirtió: puede que no haya corrido nada o que la sincronización esté parada. No des un cero.` });
      return J({
        ventana,
        moneda: { gasto: `USD con la moneda REAL de la cuenta: lo que cobró Meta si la cuenta cobra en USD; un derivado con el tipo de cambio fijo del código (${TIPO_DE_CAMBIO_USD_MXN}) si cobra en MXN`, porcentajes: 'hook_rate, hold_rate y ctr van en %' },
        // ⚠️ El renglón lo arma `filaDeRendimiento` (lib/ads-rendimiento.ts): hasta el 17/10/2026 este map devolvía
        // `leads_meta` = 10 fijo (la META de leads, no los de Meta) y `leads_crm` = los que reporta Meta.
        anuncios: orden.slice(0, limite).map(filaDeRendimiento),
        ...(orden.length > limite ? { anuncios_omitidos: orden.length - limite } : {}),
      });
    },
  },

  ver_cuenta_meta: { leer: () => vivo(() => cuentaMeta()) },
  listar_publicos_meta: { leer: () => vivo(async () => ({ publicos: await listCustomAudiences(), nota: 'count null = Meta no dio el tamaño.' })) },
  buscar_intereses_meta: {
    leer: (input) => {
      const q = str(input, 'q');
      if (q.length < 2) return Promise.resolve(fallo('El texto a buscar tiene que tener al menos 2 caracteres.'));
      return vivo(async () => ({ q, intereses: await searchInterests(q) }));
    },
  },
  buscar_lugares_meta: {
    leer: (input) => {
      const q = str(input, 'q');
      if (q.length < 2) return Promise.resolve(fallo('El texto a buscar tiene que tener al menos 2 caracteres.'));
      const pais = str(input, 'pais').toUpperCase() || null;
      return vivo(async () => ({ q, lugares: await searchLugares(q, pais) }));
    },
  },
  listar_formularios_meta: {
    leer: (input) => {
      const page = str(input, 'page') || null;
      if (page && !soloDigitos(page)) return Promise.resolve(fallo('page tiene que ser el id numérico de la página.'));
      return vivo(async () => ({ formularios: await listLeadForms(page) }));
    },
  },
  listar_pixeles_meta: { leer: () => vivo(async () => ({ pixeles: await listPixels() })) },
  listar_eventos_pixel_meta: {
    leer: (input) => {
      const pixel = str(input, 'pixel');
      if (!soloDigitos(pixel)) return Promise.resolve(fallo('pixel tiene que ser el id numérico del pixel.'));
      return vivo(async () => {
        const eventos = await listPixelEvents(pixel);
        return { pixel, ventana_dias: 30, eventos, ...(eventos.length ? {} : { nota: 'Lista vacía: puede ser que el pixel no recibió eventos o que Meta no contestó. No afirmes que falta un evento.' }) };
      });
    },
  },
  listar_conversiones_meta: { leer: () => vivo(async () => ({ conversiones: await listCustomConversions(), nota: 'estado null = Meta no dio el dato.' })) },
  listar_identidades_meta: { leer: () => vivo(() => identidadesMeta()) },
  verificar_ganadores_reusables: {
    leer: (input) => {
      const ids = (Array.isArray(input.ids) ? input.ids : []).map(String).filter(soloDigitos).slice(0, 50);
      if (!ids.length) return Promise.resolve(fallo('ids tiene que traer al menos un id numérico de anuncio.'));
      return vivo(async () => ({ ganadores: await paginasDeGanadores(ids), nota: 'puede: true también cuando Meta no contestó: no poder preguntar no autoriza a descartar.' }));
    },
  },
  listar_motivos_venta_llamada: {
    leer: async () => {
      const motivos = await motivosDeVentaPorLlamada();
      return J({ motivos, ...(motivos.length ? {} : { nota: 'No hay evidencia registrada de venta por llamada.' }) });
    },
  },
  ver_publico_conjunto_meta: {
    leer: (input) => {
      const id = str(input, 'adsetId');
      if (!soloDigitos(id)) return Promise.resolve(fallo('adsetId tiene que ser el id numérico del conjunto.'));
      return vivo(() => getAdsetTargeting(id));
    },
  },
  ver_textos_anuncio_meta: {
    leer: (input) => {
      const id = str(input, 'adId');
      if (!soloDigitos(id)) return Promise.resolve(fallo('adId tiene que ser el id numérico del anuncio.'));
      return vivo(() => getAdForEdit(id));
    },
  },
  ver_datos_campana_meta: {
    leer: (input) => {
      const id = str(input, 'campaignId');
      if (!soloDigitos(id)) return Promise.resolve(fallo('campaignId tiene que ser el id numérico de la campaña.'));
      return vivo(() => getCampaignBasics(id));
    },
  },
  ver_datos_conjunto_meta: {
    leer: (input) => {
      const id = str(input, 'adsetId');
      if (!soloDigitos(id)) return Promise.resolve(fallo('adsetId tiene que ser el id numérico del conjunto.'));
      return vivo(() => getAdsetForAdd(id));
    },
  },
  verificar_aprobacion_meta: {
    leer: (input) => {
      const ids = (Array.isArray(input.ids) ? input.ids : []).map(String).filter(soloDigitos).slice(0, 50);
      if (!ids.length) return Promise.resolve(fallo('ids tiene que traer al menos un id numérico de anuncio.'));
      return vivo(async () => {
        const [r, accountId] = await Promise.all([getAdsAprobacionPendiente(ids), getAdAccountId()]);
        return {
          pedidos: ids.length, leidos: r.leidos,
          ...(r.leidos < ids.length ? { advertencia: `Solo se pudieron leer ${r.leidos} de ${ids.length}: de los demás no se sabe.` } : {}),
          pendientes: r.pendientes.map((p) => ({ id: p.id, nombre: p.name, link_aprobar: linkAprobarEnMeta(accountId, p.id) })),
        };
      });
    },
  },
  listar_incidentes_meta: {
    leer: async (input) => {
      // `null` = no se pudo leer la tabla (17/10/2026: antes llegaba como lista vacía y la nota decía «no distingue»).
      const inc = await leerIncidentes(num(input, 'limite') ?? 30);
      if (inc === null) return fallo('No pude leer el historial de incidentes. Eso NO significa que no haya: es la lectura la que falló.');
      return J({ incidentes: inc, ...(inc.length ? {} : { nota: 'Lista vacía: no hay incidentes registrados.' }) });
    },
  },
  ver_base_formulario_meta: {
    leer: (input) => {
      const page = str(input, 'page') || null;
      if (page && !soloDigitos(page)) return Promise.resolve(fallo('page tiene que ser el id numérico de la página.'));
      return vivo(() => formularioBase(page));
    },
  },
  listar_publicaciones_mako_meta: {
    leer: async (input) => {
      const limite = num(input, 'limite') ?? 20;
      const filas = await publicacionesMako(str(input, 'status') || null, limite);
      return J({ publicaciones: filas, ...(filas.length === limite ? { nota: `Se muestran las ${limite} más recientes; puede haber más.` } : {}) });
    },
  },

  // ── LECTURAS — Ads Analyst ───────────────────────────────────────────────
  listar_guiones_analizados: {
    leer: async (input) => {
      const v = await getScriptAnalystView();
      const ang = str(input, 'angulo');
      const av = str(input, 'avatar');
      const limite = num(input, 'limite') ?? 30;
      const lista = v.scripts.filter((s) => (!ang || s.angle === ang) && (!av || s.avatar === av)).sort((a, b) => b.agendas - a.agendas || b.spend - a.spend);
      return J({
        nota: NOTA_GUIONES, total_con_senal: lista.length, cobertura: v.counts,
        ...(v.scripts.length ? {} : { advertencia: 'No hay guiones analizados con señal. Puede ser que todavía no se analizó nada: mira ver_estado_analisis_guiones.' }),
        guiones: lista.slice(0, limite).map(guionCompacto),
        ...(lista.length > limite ? { guiones_omitidos: lista.length - limite } : {}),
      });
    },
  },
  ver_ficha_guion: {
    leer: async (input) => {
      const adId = str(input, 'ad_id');
      if (!soloDigitos(adId)) return fallo('ad_id tiene que ser el id numérico del anuncio.');
      const s = await getScriptView(adId);
      if (!s) {
        const tiene = await tieneAnalisis(adId);
        return fallo(tiene ? `El anuncio ${adId} está analizado pero no tiene señal (gasto, leads ni agendas) o no tiene métricas de Meta: no hay ficha que mostrar.` : `El anuncio ${adId} no tiene análisis de guion todavía.`);
      }
      return J({
        nota: `${NOTA_GUIONES} La retención por bloque es una ESTIMACIÓN: interpola los cuartiles de Meta y los segundos de cada bloque los estimó la IA.`,
        ...guionCompacto(s),
        bloques: s.beats.map((b) => ({ tipo: b.kind, segundo_inicio_estimado: b.t0, retencion_estimada_pct: r2(b.ret), texto: b.text })),
      });
    },
  },
  ver_estado_analisis_guiones: {
    leer: async () => {
      const v = await getScriptAnalystView();
      return J({ ...v.counts, ultimo_analisis: v.lastSync, nota: 'enVista = analizados con señal (lo que muestra la lista); sinTranscript = anuncios con métricas y sin fila de análisis todavía.' });
    },
  },
  ver_cuadrante_retencion: {
    leer: async (input) => {
      const desde = str(input, 'desde') || undefined;
      const hasta = str(input, 'hasta') || undefined;
      if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) return fallo('Las fechas van como YYYY-MM-DD.');
      const puntos = await getQuadrantData(desde, hasta);
      // COPIA de verdictFromVals (hoy en lib/ads-analyst-patrones.ts; vivía en
      // app/ads-analyst/ScriptsBrowser.tsx): primero la confianza por impresiones
      // (confFromImpr: menos de 8000 = baja → 'validar'), después HOOK_MID/HOLD_MID,
      // que valen lo mismo que HOOK_BENCH/HOLD_BENCH de lib/ads-analyst.ts. Deuda: desde
      // el 11/10/2026 esa función pura SÍ existe y se exporta, pero sus claves no son las
      // de esta salida ('reescribir' vs 'reescribir_cuerpo'): cambiarla por un import
      // cambia lo que lee quien ya consume la API. Si los umbrales cambian allá, acá también.
      const HOOK = 28, HOLD = 10, IMPR_MIN = 8000;
      const cuadrante = (h: number, r: number, impr: number) => (impr < IMPR_MIN ? 'validar' : h >= HOOK ? (r >= HOLD ? 'escalar' : 'reescribir_cuerpo') : (r >= HOLD ? 'mejorar_gancho' : 'repensar'));
      return J({
        ventana: desde || hasta ? { desde: desde ?? null, hasta: hasta ?? null } : 'todo el histórico',
        umbrales: { hook_rate_pct: HOOK, retencion_pct: HOLD, impresiones_minimas: IMPR_MIN },
        nota: `Solo guiones de video con señal en la ventana. Gasto en USD derivado; retención estimada. Con menos de ${IMPR_MIN} impresiones el cuadrante es «validar»: la muestra no alcanza para recomendar escalar ni reescribir.`,
        puntos: puntos.map((p) => ({ ad_id: p.id, etiqueta: p.short, angulo: p.angle, hook_rate_pct: p.hookRate, retencion_cta_pct: p.hold, gasto_usd_derivado: Math.round(p.spend), impresiones: p.impressions, agendas_meta: p.agendas, cuadrante: cuadrante(p.hookRate, p.hold, p.impressions) })),
      });
    },
  },
  ver_perfil_guiones: {
    leer: async () => J({ nota: `${NOTA_GUIONES} n_confiables = guiones con 8000 impresiones o más; con pocos, las tasas son ruido.`, ...(await buildAccountProfile()) }),
  },
  listar_angulos_guion: { leer: async () => J({ angulos: await getAngles() }) },
  listar_avatares_guion: {
    leer: async () => {
      const av = await getAvatares();
      return J({ avatares: av, ...(av.length ? {} : { nota: 'El negocio no definió avatares: la IA no clasifica avatar.' }) });
    },
  },
  listar_guiones_valorados: {
    leer: async (input) => {
      const limite = num(input, 'limite') ?? 20;
      const d = await getDrafts(limite);
      return J({
        valorados: d.map((x) => ({
          id: x.id, creado: x.created_at, etiqueta: x.short, angulo: x.angle, tipo_gancho: x.hook_type, veredicto: x.verdicto,
          hook_rate_estimado_pct: x.valoracion?.prediccion?.hook_rate_estimado ?? null, retencion_cta_estimada_pct: x.valoracion?.prediccion?.retencion_cta_estimada ?? null,
          razon: x.valoracion?.prediccion?.razon ?? null, extracto_guion: x.guion.slice(0, 280),
        })),
        ...(d.length === limite ? { nota: `Se muestran los ${limite} más recientes; puede haber más.` } : {}),
      });
    },
  },
  ver_transcript_anuncio: {
    leer: async (input) => {
      const adId = str(input, 'ad_id');
      if (!soloDigitos(adId)) return fallo('ad_id tiene que ser el id numérico del anuncio.');
      const t = await transcriptDeAnuncio(adId);
      if (!t) return fallo(`El anuncio ${adId} no tiene transcripción todavía (la genera un proceso diario sobre los anuncios con métricas de los últimos 45 días).`);
      return J({ ...t, ...(t.status === 'sin_video' ? { nota: 'sin_video puede ser que Meta no devolvió el video, no necesariamente que el anuncio no lo tenga.' } : {}) });
    },
  },
  valorar_guion_nuevo: {
    leer: async (input) => {
      const guion = str(input, 'guion');
      if (guion.length < 80) return fallo('El guion tiene que tener al menos 80 caracteres.');
      const r = await valorarGuion(guion, num(input, 'dur') ?? undefined);
      if (!r.ok) return fallo(`No se pudo valorar el guion: ${r.error}`);
      return J({ nota: 'Valoración ESTIMADA contra el perfil de la cuenta; no quedó guardada en el historial de Ads Writer (Analizar guion).', valoracion: r.valoracion });
    },
  },

  // ── ACCIONES — Ads Manager (heredadas, chat) ─────────────────────────────
  proponer_estado_campana: {
    proponerLegado: (input, ctx) => texto(legado(ctx)('proponer_estado_campana', input)),
    ejecutar: (payload, ctx) => ejecutarAccion(ctx.ws, 'meta_estado', payload),
  },
  proponer_renombrar_campana: {
    proponerLegado: (input, ctx) => texto(legado(ctx)('proponer_renombrar_campana', input)),
    ejecutar: (payload, ctx) => ejecutarAccion(ctx.ws, 'meta_nombre', payload),
  },

  // ── ACCIONES — Ads Manager (nuevas, chat) ────────────────────────────────
  proponer_estado_conjunto: {
    preparar: async (input) => {
      const id = str(input, 'adsetId');
      const estado = str(input, 'estado') === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
      if (!soloDigitos(id)) return { error: 'adsetId tiene que ser el id numérico del conjunto.' };
      const a = await arbolMeta();
      if ('error' in a) return { error: a.error };
      const n = nodoDe(a.h, 'adset', id);
      if (!n && !a.h.parcial) return { error: `No encuentro el conjunto ${id} en la cuenta de Meta.` };
      return { payload: { adsetId: id, estado }, resumen: `${estado === 'ACTIVE' ? 'Activar' : 'Pausar'} el conjunto ${n ? `«${n.name}» ` : ''}(${id})${n ? '' : ' (no se pudo verificar el id: la lectura de Meta vino parcial)'}` };
    },
    ejecutar: (p, ctx) => escribirMeta(ctx, { level: 'adset', id: String(p.adsetId), op: 'status', status: p.estado === 'ACTIVE' ? 'ACTIVE' : 'PAUSED' }, `Conjunto ${p.estado === 'ACTIVE' ? 'activado' : 'pausado'}.`),
  },
  proponer_estado_anuncio: {
    preparar: async (input) => {
      const id = str(input, 'adId');
      const estado = str(input, 'estado') === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
      if (!soloDigitos(id)) return { error: 'adId tiene que ser el id numérico del anuncio.' };
      const a = await arbolMeta();
      if ('error' in a) return { error: a.error };
      const n = nodoDe(a.h, 'ad', id);
      if (!n && !a.h.parcial) return { error: `No encuentro el anuncio ${id} en la cuenta de Meta.` };
      return { payload: { adId: id, estado }, resumen: `${estado === 'ACTIVE' ? 'Activar' : 'Pausar'} el anuncio ${n ? `«${n.name}» ` : ''}(${id})${n ? '' : ' (no se pudo verificar el id: la lectura de Meta vino parcial)'}` };
    },
    ejecutar: (p, ctx) => escribirMeta(ctx, { level: 'ad', id: String(p.adId), op: 'status', status: p.estado === 'ACTIVE' ? 'ACTIVE' : 'PAUSED' }, `Anuncio ${p.estado === 'ACTIVE' ? 'activado' : 'pausado'}.`),
  },
  proponer_renombrar_entidad_meta: {
    preparar: async (input) => {
      const nivel = str(input, 'nivel') === 'ad' ? 'ad' : 'adset';
      const id = str(input, 'id');
      const nombre = str(input, 'nombre');
      if (!soloDigitos(id)) return { error: 'id tiene que ser el id numérico del conjunto o del anuncio.' };
      if (!nombre) return { error: 'El nombre nuevo no puede estar vacío.', faltan: ['nombre'] };
      const a = await arbolMeta();
      if ('error' in a) return { error: a.error };
      const n = nodoDe(a.h, nivel, id);
      if (!n && !a.h.parcial) return { error: `No encuentro ese ${nivel === 'ad' ? 'anuncio' : 'conjunto'} (${id}) en la cuenta de Meta.` };
      return { payload: { nivel, id, nombre }, resumen: `Renombrar el ${nivel === 'ad' ? 'anuncio' : 'conjunto'} ${n ? `«${n.name}» ` : ''}(${id}) → «${nombre}»${n ? '' : ' (no se pudo verificar el id: la lectura de Meta vino parcial)'}` };
    },
    ejecutar: (p, ctx) => escribirMeta(ctx, { level: p.nivel === 'ad' ? 'ad' : 'adset', id: String(p.id), op: 'name', name: String(p.nombre) }, `Renombrado a «${String(p.nombre)}».`),
  },

  // ── ACCIONES — Ads Manager (pantalla) ────────────────────────────────────
  proponer_presupuesto_campana: {
    preparar: async (input) => {
      const campaignId = str(input, 'campaignId');
      const monto = num(input, 'montoMxn');
      if (!soloDigitos(campaignId)) return { error: 'campaignId tiene que ser el id numérico de la campaña.' };
      if (monto == null || monto <= 0) return { error: 'montoMxn tiene que ser mayor que 0.', faltan: ['montoMxn'] };
      // Lo que mueve plata no se propone a ciegas: sin leer la campaña, no hay propuesta.
      const a = await arbolMeta();
      if ('error' in a) return { error: a.error };
      const n = nodoDe(a.h, 'campaign', campaignId);
      if (!n) return { error: `No encuentro la campaña ${campaignId} en la cuenta de Meta.` };
      if (n.dailyBudgetMxn == null) return { error: `La campaña «${n.name}» no tiene presupuesto diario de campaña (reparte por conjunto o usa presupuesto total): usa proponer_presupuesto_conjunto.` };
      const mon = a.h.account.currency;
      const tope = topePresupuesto(monto, n.dailyBudgetMxn, mon, `La campaña «${n.name}»`);
      if (tope) return { error: tope };
      const s = saltoPresupuesto(monto, n.dailyBudgetMxn);
      const salto = s?.sube ? ` ⚠ Es ${s.veces} veces el actual.` : '';
      // `desdePantalla` lo pone SOLO este preparar(), y preparar() de una `pantalla`
      // corre únicamente al proponer y al confirmar en /mako/revisar. La pendiente de
      // CHAT que deja la tool vieja de lib/mako-doer-acciones.ts ({campaignId, montoMxn},
      // tipo 'meta_presupuesto') resuelve a esta def por tipoPendiente y llegaría a
      // ejecutar() por un «sí» en WhatsApp o un clic en /mako/pendientes: sin la marca,
      // ejecutar() la cierra sin tocar Meta.
      return { payload: { campaignId, montoMxn: monto, desdePantalla: true }, resumen: `Poner el presupuesto diario de la campaña «${n.name}» (${campaignId}) en ${monto} ${mon}/día (hoy: ${n.dailyBudgetMxn} ${mon}).${salto}` };
    },
    ejecutar: async (payload, ctx) => {
      if (payload.desdePantalla !== true) return { ok: false, resumen: 'El presupuesto de una campaña se confirma en pantalla, no por chat: esta pendiente se cerró sin tocar Meta. Pide la propuesta de nuevo y confírmala en el link de revisión.' };
      return ejecutarAccion(ctx.ws, 'meta_presupuesto', { campaignId: payload.campaignId, montoMxn: payload.montoMxn });
    },
  },
  proponer_presupuesto_conjunto: {
    preparar: async (input) => {
      const adsetId = str(input, 'adsetId');
      const monto = num(input, 'montoMonedaCuenta');
      if (!soloDigitos(adsetId)) return { error: 'adsetId tiene que ser el id numérico del conjunto.' };
      if (monto == null || monto <= 0) return { error: 'montoMonedaCuenta tiene que ser mayor que 0.', faltan: ['montoMonedaCuenta'] };
      const a = await arbolMeta();
      if ('error' in a) return { error: a.error };
      const n = nodoDe(a.h, 'adset', adsetId);
      if (!n) return { error: `No encuentro el conjunto ${adsetId} en la cuenta de Meta.` };
      if (n.dailyBudgetMxn == null) return { error: `El conjunto «${n.name}» no tiene presupuesto diario propio (lo reparte la campaña o usa presupuesto total): usa proponer_presupuesto_campana.` };
      const mon = a.h.account.currency;
      const tope = topePresupuesto(monto, n.dailyBudgetMxn, mon, `El conjunto «${n.name}»`);
      if (tope) return { error: tope };
      const s = saltoPresupuesto(monto, n.dailyBudgetMxn);
      const salto = s?.sube ? ` ⚠ Es ${s.veces} veces el actual.` : '';
      return { payload: { adsetId, monto }, resumen: `Poner el presupuesto diario del conjunto «${n.name}» (${adsetId}) en ${monto} ${mon}/día (hoy: ${n.dailyBudgetMxn} ${mon}).${salto}` };
    },
    ejecutar: (p, ctx) => escribirMeta(ctx, { level: 'adset', id: String(p.adsetId), op: 'budget', dailyBudgetMxn: Number(p.monto) }, `Presupuesto del conjunto puesto en ${Number(p.monto)} por día (moneda de la cuenta).`),
  },
  proponer_eliminar_entidad_meta: {
    preparar: async (input) => {
      const nivel = (['campaign', 'adset', 'ad'] as const).find((x) => x === str(input, 'nivel'));
      const id = str(input, 'id');
      if (!nivel) return { error: 'nivel tiene que ser campaign, adset o ad.' };
      if (!soloDigitos(id)) return { error: 'id tiene que ser el id numérico de la entidad.' };
      const a = await arbolMeta();
      if ('error' in a) return { error: a.error };
      const n = nodoDe(a.h, nivel, id);
      if (!n) return { error: `No encuentro esa entidad (${id}) en la cuenta de Meta.` };
      // La lib no lo verifica (lo hacía solo el navegador): acá se exige pausada.
      if ((n.configuredStatus ?? n.effectiveStatus) !== 'PAUSED') return { error: `«${n.name}» no está pausada (${n.statusLabel}). Solo se elimina lo pausado: primero pausa.` };
      const hijos = nivel === 'campaign' ? a.h.adsets.filter((s) => s.parentId === id).length : nivel === 'adset' ? a.h.ads.filter((x) => x.parentId === id).length : 0;
      const etiqueta = nivel === 'campaign' ? 'la campaña' : nivel === 'adset' ? 'el conjunto' : 'el anuncio';
      // Por la conexión de Facebook, borrar el ÚLTIMO anuncio de un conjunto que creó Zernio (por MaKo) borra también el conjunto,
      // y la campaña si queda vacía (OpenAPI de Zernio, DELETE /ads/{adId}). Con el token no pasaba: se dice antes de confirmar.
      const { canalMeta } = await import('@/lib/meta-via');
      const unico = nivel === 'ad' && n.parentId != null && a.h.ads.filter((x) => x.parentId === n.parentId).length === 1;
      const cascada = unico && (await canalMeta()).via === 'zernio'
        ? ' Es el único anuncio de su conjunto: si el conjunto lo creó MaKo, se borran también el conjunto y, si queda vacía, la campaña.'
        : '';
      return { payload: { nivel, id }, resumen: `ELIMINAR en Meta ${etiqueta} «${n.name}» (${id})${hijos ? ` y sus ${hijos} ${nivel === 'campaign' ? 'conjuntos (con sus anuncios)' : 'anuncios'}` : ''}. No se puede deshacer.${cascada}` };
    },
    ejecutar: async (p, ctx) => {
      const level = p.nivel === 'campaign' ? 'campaign' : p.nivel === 'ad' ? 'ad' : 'adset';
      // La guarda de preparar() sale de arbolMeta → getMetaHealth, una caché de 120 s
      // que metaWrite no invalida al cambiar un estado. Lo que decide un DELETE en
      // cascada se lee EN VIVO, justo antes, y en la MISMA cuenta que va a borrar.
      const vivo = await estadoVivoMeta(String(p.id), ctx.ws, level);
      if ('error' in vivo) return { ok: false, resumen: `No borré nada: ${vivo.error}` };
      const estado = vivo.configurado ?? vivo.efectivo;
      if (estado !== 'PAUSED') return { ok: false, resumen: `No borré nada: en Meta ya no está pausada (estado actual: ${estado}). Pausa primero y vuelve a proponerlo.` };
      return escribirMeta(ctx, { level, id: String(p.id), op: 'delete' }, 'Eliminado en Meta.');
    },
  },
  proponer_agregar_anuncio: {
    preparar: async (input) => {
      if (!(await metaConectada())) return { error: SIN_META };
      const adsetId = str(input, 'adsetId');
      const nombre = str(input, 'nombre');
      const fuente = str(input, 'fuente');
      if (!soloDigitos(adsetId)) return { error: 'adsetId tiene que ser el id numérico del conjunto.' };
      if (!nombre) return { error: 'El nombre del anuncio es obligatorio.', faltan: ['nombre'] };
      let conj: { name: string; needsForm: boolean };
      try { conj = await getAdsetForAdd(adsetId); } catch (err) { return { error: `No pude leer el conjunto en Meta (${metaErrorEnvelope(err).message}).`, falla: true }; }
      const opcional = (k: string) => str(input, k) || undefined;
      // Reusar un post arma el creativo con object_story_id y SIN textos
      // (lib/meta-ads-create.ts, createAdCreative): lo que venga en estos campos se tiraría en silencio.
      if (fuente === 'existing') {
        const sobran = ['primary_text', 'headline', 'description', 'cta_type', 'destination_url', 'lead_form_id', 'media_type', 'image_hash', 'video_id'].filter((k) => str(input, k));
        if (sobran.length) return { error: `Reusar un post conserva sus textos y su media: con fuente existing no se usan ${sobran.join(', ')}. Quítalos, o usa fuente upload para textos nuevos.` };
      }
      const creative: Creative = fuente === 'existing'
        ? { source: 'existing', source_ad_id: str(input, 'source_ad_id') }
        : {
            source: 'upload', media_type: str(input, 'media_type') === 'video' ? 'video' : 'image',
            image_hash: opcional('image_hash') ?? null, video_id: opcional('video_id') ?? null,
            primary_text: opcional('primary_text'), headline: opcional('headline'), description: opcional('description'),
            cta_type: opcional('cta_type') as CTAType | undefined, destination_url: opcional('destination_url'),
            lead_form_id: opcional('lead_form_id') ?? null,
          };
      if (creative.source === 'existing') {
        if (!soloDigitos(String(creative.source_ad_id ?? ''))) return { error: 'Con fuente existing, source_ad_id tiene que ser el id numérico del anuncio a reusar.', faltan: ['source_ad_id'] };
        if (conj.needsForm) return { error: `El conjunto «${conj.name}» optimiza por formulario: Meta rechaza reusar un post ahí (1487888). Usa fuente upload con lead_form_id.` };
      } else {
        if (creative.media_type === 'image' && !creative.image_hash) return { error: 'Con una imagen hace falta image_hash (la imagen ya subida a la cuenta).', faltan: ['image_hash'] };
        if (creative.media_type === 'video' && !soloDigitos(String(creative.video_id ?? ''))) return { error: 'Con un video hace falta video_id (el video ya subido a la cuenta).', faltan: ['video_id'] };
        if (!creative.primary_text) return { error: 'Falta el texto principal del anuncio.', faltan: ['primary_text'] };
        if (conj.needsForm && !soloDigitos(String(creative.lead_form_id ?? ''))) return { error: `El conjunto «${conj.name}» optimiza por formulario: hace falta lead_form_id (de listar_formularios_meta).`, faltan: ['lead_form_id'] };
        if (!conj.needsForm && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(creative.destination_url ?? '')) return { error: 'Hace falta destination_url exacta con https.', faltan: ['destination_url'] };
      }
      const detalle = creative.source === 'existing' ? `reusando el post del anuncio ${creative.source_ad_id}` : `con ${creative.media_type === 'video' ? `el video ${creative.video_id}` : 'una imagen ya subida'}; texto: «${String(creative.primary_text).slice(0, 120)}»`;
      return { payload: { adsetId, nombre, creative }, resumen: `Crear EN PAUSA el anuncio «${nombre}» en el conjunto «${conj.name}» (${adsetId}), ${detalle}.` };
    },
    ejecutar: async (p) => {
      const creative = p.creative as Creative;
      try {
        const r = await addAdToAdset(String(p.adsetId), creative, String(p.nombre));
        return { ok: true, resumen: `Anuncio creado EN PAUSA (${r.ad_id}). Para que entregue hay que activarlo.`, datos: { ad_id: r.ad_id, creative_id: r.creative_id } };
      } catch (err) { return errorAlCrear(err, creative?.source === 'existing'); }
    },
  },

  // «Súbeme este anuncio» desde el grupo (29/10/2026, la llamada con Thiago; lib/anuncio-desde-archivo.ts). Baja el archivo (el del
  // mensaje o el de un link de Drive), lo guarda en el bucket de los creativos y PROPONE el anuncio EN PAUSA; al aprobarlo, firma el
  // link y lo crea por Zernio (`video.url` o `imageUrl`). ⚠️ Detrás de ZERNIO_ANUNCIOS_PROBADO: apagada, lo dice y no baja nada.
  proponer_anuncio_desde_archivo: {
    preparar: async (input, ctx) => {
      const { ZERNIO_ANUNCIOS_PROBADO } = await import('@/lib/zernio-ads-cuerpo');
      if (!ZERNIO_ANUNCIOS_PROBADO) return { error: ANUNCIO_DESDE_ARCHIVO_APAGADO };
      if (!(await metaConectada())) return { error: SIN_META };
      // Sólo por Zernio: Meta directo pide el `video_id` o el `image_hash` ya subidos (proponer_agregar_anuncio).
      if (!(await anunciosPorZernio(ctx.ws))) return { error: 'Para subir un anuncio desde un archivo hacen falta los anuncios por Zernio conectados (Integraciones → Meta → Conectar con Facebook). Mientras, súbelo desde el Media Buyer.' };
      const adsetId = str(input, 'adsetId');
      const nombre = str(input, 'nombre');
      const origen = str(input, 'origen');
      const textoPrincipal = str(input, 'primary_text');
      if (!soloDigitos(adsetId)) return { error: 'adsetId tiene que ser el id numérico del conjunto.' };
      if (!nombre) return { error: 'El nombre del anuncio es obligatorio.', faltan: ['nombre'] };
      if (!textoPrincipal) return { error: 'Falta el texto principal del anuncio.', faltan: ['primary_text'] };
      let conj: { name: string; needsForm: boolean };
      try { conj = await getAdsetForAdd(adsetId); } catch (err) { return { error: `No pude leer el conjunto en Meta (${metaErrorEnvelope(err).message}).`, falla: true }; }
      const destino = str(input, 'destination_url');
      if (!conj.needsForm && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(destino)) return { error: 'Hace falta destination_url exacta con https.', faltan: ['destination_url'] };
      if (conj.needsForm) return { error: `El conjunto «${conj.name}» optimiza por formulario: súbelo desde el Media Buyer, donde se elige el formulario.` };
      // El archivo: el del mensaje (lo baja el turno del grupo) o el de un link.
      let archivo: { bytes: Uint8Array; mime: string; nombre: string } | null = null;
      if (origen === 'mensaje') {
        const a = ctx.archivoDelMensaje ? await ctx.archivoDelMensaje().catch(() => null) : null;
        if (!a) return { error: 'No veo una imagen ni un video en este mensaje. Mándalo junto con el pedido, o pásame el link.' };
        archivo = { bytes: Uint8Array.from(Buffer.from(a.base64, 'base64')), mime: a.mime, nombre: a.nombre };
      } else if (origen === 'link') {
        const url = linkDeDescarga(str(input, 'link'));
        if (!url) return { error: 'Ese link no sirve: pásame el link de Google Drive del archivo (compartido con cualquiera con el enlace) o uno https directo.', faltan: ['link'] };
        try {
          // ⛔ Se baja por `bajarWebSegura` (01/11/2026, auditoría de seguridad): con `fetch` y
          // `redirect: 'follow'` un link público que redirige a 169.254.169.254 o a 127.0.0.1 se bajaba desde
          // nuestro servidor (SSRF). Cada salto pasa por `validarDestino` y el pedido va a la IP ya validada
          // (sin rebinding). El techo es el de un video de anuncio, no el de una web: se lee hasta un byte
          // de más para saber si se pasó.
          const [{ bajarWebSegura, pedirClavado }, { validarDestino: validar }] = await Promise.all([
            import('@/lib/archivero-bajada'), import('@/lib/landing-fetch'),
          ]);
          const limites = { maxBytes: MAX_VIDEO_BYTES + 1, timeoutMs: 60_000 };
          let r: Awaited<ReturnType<typeof bajarWebSegura>>;
          try {
            r = await bajarWebSegura(url, { validar, pedir: (u, ips) => pedirClavado(u, ips, undefined, limites) });
          } catch (err) {
            // Un salto a una dirección privada, o demasiados redirects: es el link, no una falla nuestra.
            return { error: `Ese link no se puede bajar: ${err instanceof Error ? err.message : String(err)}` };
          }
          // Un 403 o un 404 es cómo está compartido (una regla, no una falla nuestra): la persona lo arregla.
          if (r.status < 200 || r.status >= 300) return { error: `Ese archivo no se deja bajar (${r.status}): si es de Drive, compártelo con «cualquiera con el enlace».` };
          const mime = (r.tipo || '').split(';')[0];
          if (r.cuerpo.byteLength > MAX_VIDEO_BYTES) return { error: 'El archivo pasa los 100 MB: súbelo desde el Media Buyer en la app.' };
          archivo = { bytes: new Uint8Array(r.cuerpo), mime, nombre: url.split('/').pop() || 'archivo' };
        } catch (err) { return { error: `No pude bajar el archivo (${err instanceof Error ? err.message : String(err)}).`, falla: true }; }
      } else return { error: 'origen es «mensaje» o «link».', faltan: ['origen'] };
      const tipo = tipoDelArchivo(archivo.mime, archivo.nombre);
      const malo = errorDelArchivo(tipo, archivo.bytes.byteLength);
      if (malo || !tipo) return { error: malo ?? 'Ese archivo no sirve como anuncio.' };
      const { randomUUID } = await import('node:crypto');
      const { getSupabaseServer } = await import('@/lib/supabase');
      const { ADS_CREATIVES_BUCKET } = await import('@/lib/meta-ads-create');
      const ruta = rutaEnElBucket(ctx.ws, randomUUID(), tipo, archivo.mime);
      const { error: eSubida } = await getSupabaseServer().storage.from(ADS_CREATIVES_BUCKET)
        .upload(ruta, archivo.bytes, { contentType: archivo.mime || (tipo === 'video' ? 'video/mp4' : 'image/jpeg'), upsert: false });
      if (eSubida) return { error: `No pude guardar el archivo (${eSubida.message}).`, falla: true };
      const opcional = (k: string) => str(input, k) || undefined;
      return {
        payload: { adsetId, nombre, ruta, media_type: tipo, primary_text: textoPrincipal, headline: opcional('headline'), cta_type: opcional('cta_type'), destination_url: destino },
        resumen: `Crear EN PAUSA el anuncio «${nombre}» en el conjunto «${conj.name}» (${adsetId}) con ${tipo === 'video' ? 'el video' : 'la imagen'} que mandaste, por Zernio.`,
      };
    },
    ejecutar: async (p) => {
      const { ZERNIO_ANUNCIOS_PROBADO } = await import('@/lib/zernio-ads-cuerpo');
      if (!ZERNIO_ANUNCIOS_PROBADO) return { ok: false, resumen: ANUNCIO_DESDE_ARCHIVO_APAGADO };
      const { getSupabaseServer } = await import('@/lib/supabase');
      const { ADS_CREATIVES_BUCKET } = await import('@/lib/meta-ads-create');
      // El link se firma AHORA (2 horas): la propuesta pudo esperar su aprobación más que eso.
      const { data, error } = await getSupabaseServer().storage.from(ADS_CREATIVES_BUCKET).createSignedUrl(String(p.ruta), 7200);
      if (error || !data?.signedUrl) return { ok: false, resumen: `No encontré el archivo guardado (${error?.message ?? 'sin link'}). Vuelve a mandarlo.` };
      const video = p.media_type === 'video';
      const creative: Creative = {
        source: 'upload', media_type: video ? 'video' : 'image',
        ...(video ? { video_url: data.signedUrl } : { thumbnail_url: data.signedUrl }),
        primary_text: String(p.primary_text ?? ''), headline: p.headline ? String(p.headline) : undefined,
        cta_type: p.cta_type ? (String(p.cta_type) as CTAType) : undefined, destination_url: p.destination_url ? String(p.destination_url) : undefined,
      };
      try {
        const r = await addAdToAdset(String(p.adsetId), creative, String(p.nombre));
        return { ok: true, resumen: `Anuncio creado EN PAUSA (${r.ad_id}). Para que entregue hay que activarlo.`, datos: { ad_id: r.ad_id } };
      } catch (err) { return errorAlCrear(err); }
    },
  },
  proponer_editar_textos_anuncio: {
    preparar: async (input) => {
      if (!(await metaConectada())) return { error: SIN_META };
      const adId = str(input, 'adId');
      if (!soloDigitos(adId)) return { error: 'adId tiene que ser el id numérico del anuncio.' };
      const edited: Record<string, string> = {};
      for (const k of ['primary_text', 'headline', 'description', 'cta_type', 'destination_url']) { const v = str(input, k); if (v) edited[k] = v; }
      if (!Object.keys(edited).length) return { error: 'No hay nada que cambiar: manda al menos un texto.', faltan: ['primary_text'] };
      if (edited.destination_url && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(edited.destination_url)) return { error: 'destination_url tiene que ser una URL exacta con https.' };
      let actual: Awaited<ReturnType<typeof getAdForEdit>>;
      try { actual = await getAdForEdit(adId); } catch (err) { return { error: `No pude leer el anuncio en Meta (${metaErrorEnvelope(err).message}).`, falla: true }; }
      if (!actual.editable || !actual.creative) return { error: actual.reason ?? 'Este anuncio no permite editar sus textos (reusa un post o es dinámico).' };
      const antes = actual.creative as unknown as Record<string, unknown>;
      const cambios = Object.entries(edited).map(([k, v]) => `${k}: «${String(antes[k] ?? '').slice(0, 80)}» → «${v.slice(0, 80)}»`).join(' · ');
      return { payload: { adId, edited }, resumen: `Editar los textos del anuncio «${actual.name}» (${adId}); vuelve a revisión de Meta. ${cambios}` };
    },
    ejecutar: async (p) => {
      try {
        const r = await updateAdCopy(String(p.adId), p.edited as Record<string, string>);
        return { ok: true, resumen: 'Textos actualizados: Meta vuelve a revisar el anuncio.', datos: { creative_id: r.creative_id } };
      } catch (err) { return errorAlCrear(err); }
    },
  },
  proponer_editar_publico_conjunto: {
    preparar: async (input, ctx) => {
      if (!(await metaConectada())) return { error: SIN_META };
      const adsetId = str(input, 'adsetId');
      if (!soloDigitos(adsetId)) return { error: 'adsetId tiene que ser el id numérico del conjunto.' };
      const entrada = entradaDesdeApi(input);
      if ('error' in entrada) return { error: entrada.error };
      let actual: Awaited<ReturnType<typeof getAdsetTargeting>>;
      try { actual = await getAdsetTargeting(adsetId); } catch (err) { return { error: `No pude leer el conjunto en Meta (${metaErrorEnvelope(err).message}).`, falla: true }; }
      // Un pin sobre un geo que MaKo no sabe re-escribir se frena ACÁ, antes del «sí» (al ejecutar tiraría igual).
      if (entrada.pin && lugaresDesdeMeta(actual.targeting.geo_locations, actual.targeting.excluded_geo_locations).noEntiendo.length) {
        return { error: 'Este conjunto tiene lugares que MaKo no sabe editar: el punto del mapa se agrega en Meta.' };
      }
      // Por la conexión de Facebook (Zernio) se escribe en SU forma: lo que no se puede mandar (Advantage+, un barrio) se dice
      // antes del «sí», no al confirmar (lib/zernio-publico.ts).
      const { canalMeta } = await import('@/lib/meta-via');
      if ((await canalMeta(ctx.ws)).via === 'zernio') {
        try { publicoParaZernio(actual.targeting, cambiosDesdeEntrada(actual.targeting, entrada)); }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
      }
      const cambios = resumenDeCambios(cambiosDesdeEntrada(actual.targeting, entrada));
      return { payload: { adsetId, entrada }, resumen: `Cambiar el público del conjunto «${actual.name}» (${adsetId}): ${cambios.join(' · ')}. Lo demás se conserva. Vuelve a revisión de Meta y reinicia el aprendizaje.` };
    },
    ejecutar: async (p) => {
      try {
        const r = await editarPublicoConjunto(String(p.adsetId), p.entrada as EntradaPublico);
        return { ok: true, resumen: `Público de «${r.name}» actualizado: Meta vuelve a revisar el conjunto.` };
      } catch (err) { return errorAlCrear(err); }
    },
  },
  proponer_crear_publico_meta: {
    preparar: async (input) => {
      if (!(await metaConectada())) return { error: SIN_META };
      const tipo = (['page', 'ig', 'video', 'pixel'] as const).find((x) => x === str(input, 'tipo'));
      if (!tipo) return { error: 'tipo tiene que ser page, ig, video o pixel.' };
      const dias = num(input, 'dias') ?? 90;
      // La lib topea en 365 para todos; Meta rechaza más de 180 en públicos de sitio web,
      // y ese rechazo llegaría DESPUÉS de que la persona confirmó.
      if (tipo === 'pixel' && dias > 180) return { error: 'Meta acepta hasta 180 días de retención en públicos de sitio web (pixel). Usa 180 o menos.' };
      const evento = str(input, 'evento').replace(/[^A-Za-z0-9_]/g, '');
      const name = str(input, 'name');
      const fuente = { page: 'interactuaron con la página de Facebook', ig: 'interactuaron con Instagram', video: 'vieron videos de la página', pixel: `dispararon ${evento || 'PageView'} en la web` }[tipo];
      return { payload: { tipo, dias, ...(tipo === 'pixel' && evento ? { evento } : {}), ...(name ? { name } : {}) }, resumen: `Crear el público${name ? ` «${name}»` : ''} con las personas que ${fuente} en los últimos ${dias} días.` };
    },
    ejecutar: async (p) => {
      try {
        const r = await createCustomAudience({ tipo: p.tipo as 'page' | 'ig' | 'video' | 'pixel', dias: Number(p.dias), ...(p.name ? { name: String(p.name) } : {}), ...(p.evento ? { evento: String(p.evento) } : {}) });
        return { ok: true, resumen: `Público «${r.name}» creado (${r.id}).`, datos: r };
      } catch (err) { return errorAlCrear(err); }
    },
  },
  proponer_crear_formulario_meta: {
    preparar: async (input) => {
      if (!(await metaConectada())) return { error: SIN_META };
      const page = str(input, 'page') || null;
      if (page && !soloDigitos(page)) return { error: 'page tiene que ser el id numérico de la página.' };
      const f: FormularioNuevo = {
        nombre: str(input, 'nombre'),
        estandar: (Array.isArray(input.estandar) ? input.estandar : []).map(String) as PreguntaEstandar[],
        propias: (Array.isArray(input.propias) ? input.propias : []).map((x) => String(x).trim()).filter(Boolean),
        mayorIntencion: input.mayorIntencion === true,
        privacidadUrl: str(input, 'privacidadUrl'),
        sitioUrl: str(input, 'sitioUrl'),
      };
      const errores = erroresFormulario(f);
      if (errores.length) return { error: errores.join(' ') };
      return { payload: { formulario: f, ...(page ? { page } : {}) }, resumen: `Crear el formulario «${f.nombre}» en la página${page ? ` ${page}` : ''}: ${f.estandar.join(', ')}${f.propias.length ? ` + ${f.propias.length} preguntas propias` : ''}${f.mayorIntencion ? ', mayor intención' : ''}; privacidad ${f.privacidadUrl}; botón final ${f.sitioUrl}.` };
    },
    ejecutar: async (p) => {
      try {
        const r = await crearFormularioInstantaneo(p.formulario as FormularioNuevo, p.page ? String(p.page) : null);
        return { ok: true, resumen: `Formulario «${r.name}» creado (${r.id}).`, datos: r };
      } catch (err) { return errorAlCrear(err); }
    },
  },

  // ── ACCIONES — Ads Analyst ───────────────────────────────────────────────
  proponer_sincronizar_guiones: {
    preparar: async () => ({ payload: {}, resumen: 'Analizar con IA UN guion pendiente (de los que tienen transcript y todavía no tienen análisis), en segundo plano.' }),
    ejecutar: async (_p, ctx) => {
      // UNO, y en segundo plano: timeBudgetMs solo se mira ANTES de arrancar cada
      // análisis, así que no acota lo que dura una llamada (hasta 150 s según la lib).
      const modo = await enSegundoPlano(ctx.ws, 'sincronizar guiones', () => syncScriptAnalyses({ max: 1 }));
      return {
        ok: true,
        resumen: modo === 'fondo'
          ? 'Quedó en marcha el análisis de un guion pendiente; tarda uno o dos minutos. El resultado no vuelve aquí: revisa ver_estado_analisis_guiones después.'
          : 'Se corrió el análisis de un guion pendiente; revisa ver_estado_analisis_guiones.',
      };
    },
  },
  proponer_reanalizar_guion: {
    preparar: async (input) => {
      const adId = str(input, 'ad_id');
      if (!soloDigitos(adId)) return { error: 'ad_id tiene que ser el id numérico del anuncio.' };
      const t = await transcriptDeAnuncio(adId);
      if (!t || !t.transcript?.trim()) return { error: `El anuncio ${adId} no tiene transcripción: no hay guion que analizar.` };
      return { payload: { adId }, resumen: `Volver a analizar con IA el guion del anuncio ${adId} (reemplaza su análisis; las correcciones manuales se conservan).` };
    },
    ejecutar: async (p, ctx) => {
      const adId = String(p.adId);
      const modo = await enSegundoPlano(ctx.ws, `reanalizar guion ${adId}`, () => analyzeOne(adId));
      return {
        ok: true,
        resumen: modo === 'fondo'
          ? `Quedó en marcha el nuevo análisis del guion ${adId}; tarda uno o dos minutos. El resultado no vuelve aquí: mira ver_ficha_guion después (si falla, la fila queda en error con el motivo).`
          : `Se corrió el nuevo análisis del guion ${adId}; mira ver_ficha_guion.`,
      };
    },
  },
  proponer_corregir_angulo_guion: {
    preparar: prepararOverride('angulos', 'angle'),
    ejecutar: async (p) => { await setAngleOverride(String(p.adId), (p.valor as string | null) ?? null); return { ok: true, resumen: 'Ángulo del guion actualizado.' }; },
  },
  proponer_corregir_avatar_guion: {
    preparar: prepararOverride('avatares', 'avatar'),
    ejecutar: async (p) => { await setAvatarOverride(String(p.adId), (p.valor as string | null) ?? null); return { ok: true, resumen: 'Avatar del guion actualizado.' }; },
  },
  proponer_borrar_guion_valorado: {
    preparar: async (input) => {
      const id = num(input, 'id');
      if (id == null) return { error: 'Falta el id del guion valorado.', faltan: ['id'] };
      const d = (await getDrafts(500)).find((x) => x.id === id);
      if (!d) return { error: `No encuentro el guion valorado #${id} (se buscó entre los 500 más recientes).` };
      return { payload: { id }, resumen: `Borrar del historial el guion valorado #${id} «${d.short ?? d.guion.slice(0, 60)}»` };
    },
    ejecutar: async (p) => { await deleteDraft(Number(p.id)); return { ok: true, resumen: 'Guion valorado borrado del historial.' }; },
  },
  proponer_agregar_angulo: { preparar: prepararAgregarVocab('angulos'), ejecutar: ejecutarVocab('angulos', 'agregar') },
  proponer_editar_angulo: { preparar: prepararEditarVocab('angulos'), ejecutar: ejecutarVocab('angulos', 'editar') },
  proponer_borrar_angulo: { preparar: prepararBorrarVocab('angulos'), ejecutar: ejecutarVocab('angulos', 'borrar') },
  proponer_agregar_avatar: { preparar: prepararAgregarVocab('avatares'), ejecutar: ejecutarVocab('avatares', 'agregar') },
  proponer_editar_avatar: { preparar: prepararEditarVocab('avatares'), ejecutar: ejecutarVocab('avatares', 'editar') },
  proponer_borrar_avatar: { preparar: prepararBorrarVocab('avatares'), ejecutar: ejecutarVocab('avatares', 'borrar') },

  // ── El Media Buyer (25/10/2026): lo que hace la pantalla /ads-manager, por la API. La plata la mueve lib/media-buyer/ejecutar.ts
  // (topes, lectura en vivo, reclamo antes de escribir): estos runners no escriben en Meta por su cuenta.
  ver_media_buyer: {
    leer: async (_input, ctx) => {
      // Las mismas tres pestañas y los mismos 30 días que la pantalla (app/api/media-buyer/route.ts → GET).
      const [config, { decisiones, existeTabla }, cupo, propios] = await Promise.all([leerConfigMB(ctx.ws), leerDecisionesMB(ctx.ws, 30), cupoMB(ctx.ws), leerAgentesPropios(ctx.ws).catch(() => [])]);
      if (!existeTabla) return J({ instalado: false, nota: 'El registro del Media Buyer todavía no está instalado (falta la migración 0332).' });
      const modo = modoEfectivoMB(config.modo, cupo);
      const r = resolverTacticas(config.tacticas, { piloto: modo === 'piloto', pilotoPermitido: cupo.piloto });
      // Quién firma cada acción (lo de un agente propio lleva su id en la clave: `propia:<id>:…`).
      const firma = (d: DecisionMB) => {
        const id = d.tactica === 'manual' ? agenteDeClave(d.clave) : null;
        return id ? propios.find((a) => a.id === id)?.nombre ?? 'Un agente propio' : NOMBRE_AGENTE[AGENTE_DE[d.tactica]];
      };
      const alertas = (config.ultimaCorridaInfo as { alertas?: unknown } | null)?.alertas;
      const corta = (d: DecisionMB) => ({
        id: d.id, estado: d.estado, tipo: d.tipo, tactica: d.tactica, agente: firma(d), nivel: d.nivel, entidad: d.entidadNombre, entidadId: d.entidadId,
        titulo: d.titulo, titular: d.titular, porque: d.porque, numeros: d.numeros, antes: d.antes, despues: d.despues, moneda: d.moneda,
        creada: d.creada, aplicada: d.aplicadaAt, por: d.origen === 'piloto' ? 'piloto automático' : d.aplicadaPor, error: d.error,
        estrellas: d.estrellas, motivoDescarte: d.motivoDescarte,
        variaciones: d.variaciones?.map((v) => ({ id: v.id, gancho: v.gancho ?? null, texto: v.textoPrincipal.slice(0, 280), elegida: v.elegida })),
      });
      return J({
        prendido: config.encendido, modo, resultado: config.kpi, objetivo: config.objetivo,
        // El plan (MaKo Esencial: N recomendaciones por día y sin piloto automático; null = sin tope).
        plan: { recomendacionesPorDia: cupo.recomendacionesDia, pilotoAutomatico: cupo.piloto },
        topes: { subidaMaxPctDia: config.subidaMaxPctDia, presupuestoMaxDia: config.presupuestoMaxDia },
        metas: { ventasMes: config.metaVentasMes, gastoMes: config.metaGastoMes },
        cuentaPublicitaria: config.cuentaPublicitaria,
        // DÓNDE y HASTA (zona_media_buyer, hasta_media_buyer): dónde prende y sube, y cuándo termina cada campaña.
        zona: config.zona, hasta: config.hasta, hastaCampanas: config.hastaCampanas,
        ultimaCorrida: config.ultimaCorrida,
        // Los agentes, como el panel «N activos» de la pantalla (app/ads-manager/Agentes.tsx).
        agentes: AGENTES_MAKO.map((a) => ({ agente: a, nombre: NOMBRE_AGENTE[a], que: QUE_HACE[a], estado: estadoDeAgente(a, r), tacticas: TACTICAS_DE[a] })),
        agentesPropios: propios.map((a) => ({ agenteId: a.id, nombre: a.nombre, regla: a.regla, cada: a.cada, estado: a.estado })),
        // Lo que Protect vio roto la última vez que miró la cuenta (lib/media-buyer/protect.ts).
        alertas: Array.isArray(alertas) ? (alertas as AlertaMB[]).map((x) => ({ tipo: x.tipo, gravedad: x.gravedad, titulo: x.titulo, detalle: x.detalle })) : [],
        abiertas: decisiones.filter((d) => ['abierta', 'fallida', 'bloqueada'].includes(d.estado)).map(corta),
        hechas: decisiones.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha').slice(0, 30).map(corta),
        descartadas: decisiones.filter((d) => d.estado === 'descartada' || d.estado === 'vencida').slice(0, 30).map(corta),
      });
    },
  },
  lanzar_decision_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'decisionId');
      const d = await leerDecisionMB(ctx.ws, id).catch(() => null);
      if (!d) return { error: `No encuentro la decisión ${id} en este negocio (míralas con ver_media_buyer).` };
      if (!['abierta', 'fallida', 'bloqueada'].includes(d.estado)) return { error: `Esa decisión ya está ${d.estado}.` };
      const presupuesto = num(input, 'presupuesto');
      if (presupuesto != null && d.despues?.presupuesto == null) return { error: 'Esa decisión no cambia un presupuesto: no lleva monto.' };
      // Lo mismo que «Editar» en la pantalla (monto.ts → revisarMontoEditado): subir cinco veces o más no sale; bajar 80% o más
      // sí, y la confirmación de la pantalla lo dice con todas las letras, que es lo que confirma la persona (va `confirmarBaja`).
      let baja: string | null = null;
      if (presupuesto != null) {
        const rev = revisarMontoEditado(presupuesto, d.antes?.presupuesto ?? null, { fmt: (n) => fmtDinero(n, d.moneda) });
        if (!rev.ok && !rev.confirmar) return { error: rev.error };
        if (!rev.ok) baja = rev.error;
      }
      const variaciones = Array.isArray(input.variaciones) ? input.variaciones.filter((x): x is string => typeof x === 'string').slice(0, 20) : null;
      if (variaciones && !d.variaciones?.length) return { error: 'Esa decisión no tiene variaciones para elegir.' };
      if (variaciones) {
        const ids = new Set(d.variaciones!.map((v) => v.id));
        const ajenas = variaciones.filter((v) => !ids.has(v));
        if (ajenas.length || !variaciones.length) return { error: `Esas variaciones no son de la decisión (las suyas: ${[...ids].join(', ')}).` };
      }
      // Los textos de la IA salen sólo leídos: la confirmación los lista y van explícitos (sin esto, las que marcó el Diseñador).
      const salen = d.variaciones?.length ? (variaciones ?? d.variaciones.filter((v) => v.elegida).map((v) => v.id)) : null;
      if (salen && !salen.length) return { error: 'Esa decisión no tiene ningún texto elegido: pasa los ids en variaciones.' };
      // Lo que sale ENTERO (gancho, texto y título): la confirmación es lo único que se lee antes de que se publique.
      const textos = salen ? d.variaciones!.filter((v) => salen.includes(v.id))
        .map((v) => `«${[v.gancho, v.textoPrincipal, v.titulo ? `Título: ${v.titulo}` : null].filter(Boolean).join(' / ')}»`).join(' · ') : '';
      const extra = [presupuesto != null ? `con ${presupuesto} por día` : null, salen ? `${salen.length} ${salen.length === 1 ? 'texto' : 'textos'}` : null].filter(Boolean).join(', ');
      return {
        payload: { decisionId: id, presupuesto, variaciones: salen, ...(baja ? { confirmarBaja: true } : {}) },
        resumen: `${baja ? `⚠️ ${baja} ` : ''}Lanzar: ${d.titulo}${extra ? ` (${extra})` : ''}. ${d.titular}.${textos ? ` Salen: ${textos}` : ''}`,
      };
    },
    ejecutar: async (payload, ctx) => {
      const quien = quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)';
      const opts = {
        presupuesto: payload.presupuesto == null ? undefined : Number(payload.presupuesto),
        elegidas: Array.isArray(payload.variaciones) ? (payload.variaciones as string[]) : undefined,
        bajaConfirmada: payload.confirmarBaja === true,
      };
      const r = await lanzarMB(ctx.ws, String(payload.decisionId), { nombre: quien, origen: 'persona' }, opts);
      return r.ok ? { ok: true, resumen: `Lanzada: ${r.decision.titulo}.${r.ajuste ? ` ${r.ajuste}` : ''}` } : { ok: false, resumen: r.error };
    },
  },
  deshacer_decision_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'decisionId');
      const d = await leerDecisionMB(ctx.ws, id).catch(() => null);
      if (!d) return { error: `No encuentro la decisión ${id} en este negocio.` };
      if (d.estado !== 'aplicada') return { error: 'Sólo se deshace una decisión aplicada.' };
      return { payload: { decisionId: id }, resumen: `Deshacer: ${d.titulo}.` };
    },
    ejecutar: async (payload, ctx) => {
      const r = await deshacerMB(ctx.ws, String(payload.decisionId), quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return r.ok ? { ok: true, resumen: `Deshecha: ${r.decision.titulo}.${r.ajuste ? ` ${r.ajuste}` : ''}` } : { ok: false, resumen: r.error };
    },
  },
  descartar_decision_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'decisionId');
      const d = await leerDecisionMB(ctx.ws, id).catch(() => null);
      if (!d) return { error: `No encuentro la decisión ${id} en este negocio.` };
      if (!['abierta', 'fallida', 'bloqueada'].includes(d.estado)) return { error: `Esa decisión ya está ${d.estado}.` };
      const motivo = str(input, 'motivo').slice(0, 300) || null;
      return { payload: { decisionId: id, motivo }, resumen: `Descartar: ${d.titulo}.` };
    },
    ejecutar: async (payload, ctx) => {
      const d = await reclamarMB(ctx.ws, String(payload.decisionId), ['abierta', 'fallida', 'bloqueada'], { estado: 'descartada', motivo_descarte: (payload.motivo as string | null) ?? null });
      return d ? { ok: true, resumen: `Descartada: ${d.titulo}.` } : { ok: false, resumen: 'Esa decisión ya no estaba abierta.' };
    },
  },
  reabrir_decision_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'decisionId');
      const d = await leerDecisionMB(ctx.ws, id).catch(() => null);
      if (!d) return { error: `No encuentro la decisión ${id} en este negocio.` };
      if (d.estado !== 'descartada' && d.estado !== 'vencida') return { error: 'Sólo se vuelve a abrir una descartada o vencida.' };
      return { payload: { decisionId: id }, resumen: `Reabrir: ${d.titulo}.` };
    },
    ejecutar: async (payload, ctx) => {
      // Lo mismo que el botón de la pantalla (route.ts → reabrir): vuelve a correr sus 48 h desde ahora.
      const d = await reclamarMB(ctx.ws, String(payload.decisionId), ['descartada', 'vencida'], { estado: 'abierta', motivo_descarte: null, creada: new Date().toISOString() });
      return d ? { ok: true, resumen: `Abierta de nuevo: ${d.titulo}.` } : { ok: false, resumen: 'Esa decisión ya no estaba descartada.' };
    },
  },
  calificar_decision_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'decisionId');
      const n = num(input, 'estrellas');
      if (n == null || !Number.isInteger(n) || n < 1 || n > 5) return { error: 'estrellas va de 1 a 5, entero.', faltan: ['estrellas'] };
      const d = await leerDecisionMB(ctx.ws, id).catch(() => null);
      if (!d) return { error: `No encuentro la decisión ${id} en este negocio.` };
      if (d.estado !== 'aplicada' && d.estado !== 'deshecha') return { error: 'Sólo se califica una decisión hecha.' };
      return { payload: { decisionId: id, estrellas: n }, resumen: `${n} ${n === 1 ? 'estrella' : 'estrellas'} a: ${d.titulo}.` };
    },
    ejecutar: async (payload, ctx) => {
      await actualizarMB(ctx.ws, String(payload.decisionId), { estrellas: Number(payload.estrellas) });
      return { ok: true, resumen: 'Calificación guardada.' };
    },
  },
  hooks_al_video_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'decisionId');
      const d = await leerDecisionMB(ctx.ws, id).catch(() => null);
      if (!d) return { error: `No encuentro la decisión ${id} en este negocio.` };
      if (d.tipo !== 'variaciones_hook') return { error: 'Sólo las variaciones de hook de un video van al Video Generator.' };
      const variaciones = Array.isArray(input.variaciones) ? input.variaciones.filter((x): x is string => typeof x === 'string').slice(0, 20) : null;
      const ids = new Set((d.variaciones ?? []).map((v) => v.id));
      if (variaciones && (!variaciones.length || variaciones.some((v) => !ids.has(v)))) return { error: `Esos hooks no son de la decisión (los suyos: ${[...ids].join(', ')}).` };
      const cuantos = variaciones ? variaciones.length : (d.variaciones ?? []).filter((v) => v.elegida).length;
      return { payload: { decisionId: id, variaciones }, resumen: `Llevar ${cuantos} ${cuantos === 1 ? 'hook' : 'hooks'} de «${d.entidadNombre}» al Video Generator, como guiones.` };
    },
    ejecutar: async (payload, ctx) => {
      const d = await leerDecisionMB(ctx.ws, String(payload.decisionId));
      if (!d) return { ok: false, resumen: 'Esa decisión ya no está.' };
      // Lo mismo que el botón de la pantalla (route.ts → hooks_a_video): las elegidas pisan la marca guardada.
      const elegidas = Array.isArray(payload.variaciones) ? new Set(payload.variaciones as string[]) : null;
      const r = await llevarHooksAlVideoMB(ctx.ws, elegidas ? { ...d, variaciones: (d.variaciones ?? []).map((v) => ({ ...v, elegida: elegidas.has(v.id) })) } : d);
      return r.ok ? { ok: true, resumen: `En el Video Generator: ${r.cargados} ${r.cargados === 1 ? 'guion nuevo' : 'guiones nuevos'}${r.salteados ? ` (${r.salteados} ya estaban)` : ''}. En AI Avatar están en «Hooks ganadores», para filmarlos con tu avatar.` } : { ok: false, resumen: r.error };
    },
  },
  analizar_cuenta_media_buyer: {
    preparar: async (_input, ctx) => {
      const config = await leerConfigMB(ctx.ws);
      if (!config.existeTabla) return { error: 'El Media Buyer todavía no está instalado (falta la migración 0332).' };
      if (!config.encendido) return { error: 'El Media Buyer está apagado: préndelo en /ads-manager (o con modo_media_buyer) para que mire la cuenta.' };
      return { payload: {}, resumen: 'Que el Media Buyer mire la cuenta ahora y deje sus decisiones (sin lanzar ninguna).' };
    },
    ejecutar: async (_payload, ctx) => {
      const r = await analizarCuentaMB(ctx.ws, { quien: quienChatea(ctx)?.nombre ?? 'MaKo', soloProponer: true });
      if (r.estado !== 'ok') return { ok: false, resumen: r.mensaje ?? `El Media Buyer no pudo mirar la cuenta (${r.estado}).` };
      return { ok: true, resumen: `Listo: ${r.nuevas ?? 0} decisiones nuevas para revisar en /ads-manager.${r.sinVariaciones?.length ? ` Sin variaciones: ${r.sinVariaciones[0]}` : ''}` };
    },
  },
  modo_media_buyer: {
    preparar: async (input, ctx) => {
      const modo = str(input, 'modo');
      if (!['piloto', 'propone', 'apagado'].includes(modo)) return { error: 'modo tiene que ser piloto, propone o apagado.', faltan: ['modo'] };
      if (modo === 'piloto' && !(await cupoMB(ctx.ws)).piloto) return { error: new PlanSinPiloto().message };
      const que = modo === 'piloto' ? 'Prender el piloto automático: MaKo lanza solo sus decisiones, dentro de los topes.'
        : modo === 'propone' ? 'Dejar el Media Buyer proponiendo: cada decisión espera a una persona.' : 'Apagar el Media Buyer: no analiza ni lanza nada.';
      return { payload: { modo }, resumen: que };
    },
    ejecutar: async (payload, ctx) => {
      const modo = String(payload.modo);
      const cambio = modo === 'apagado' ? { encendido: false } : { encendido: true, modo: modo === 'piloto' ? 'piloto' as const : 'propone' as const };
      await guardarConfigMB(ctx.ws, cambio, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: modo === 'apagado' ? 'Media Buyer apagado.' : modo === 'piloto' ? 'Piloto automático prendido.' : 'El Media Buyer queda proponiendo.' };
    },
  },
  topes_media_buyer: {
    preparar: async (input) => {
      const cambio: Record<string, unknown> = {};
      for (const k of ['subidaMaxPctDia', 'presupuestoMaxDia', 'objetivo'] as const) { const v = num(input, k); if (v != null) cambio[k] = v; }
      const kpi = str(input, 'kpi');
      if (kpi) cambio.kpi = kpi;
      if (!Object.keys(cambio).length) return { error: 'No pasaste nada para cambiar.', faltan: ['subidaMaxPctDia', 'presupuestoMaxDia', 'kpi', 'objetivo'] };
      const v = validarCambioMB(cambio);
      if (!v.ok) return { error: v.error };
      const partes = [
        cambio.subidaMaxPctDia != null ? `subida máxima ${cambio.subidaMaxPctDia}% por día` : null,
        cambio.presupuestoMaxDia != null ? `presupuesto máximo US$ ${cambio.presupuestoMaxDia} por día` : null,
        cambio.kpi ? `resultado: ${cambio.kpi}` : null,
        cambio.objetivo != null ? `objetivo US$ ${cambio.objetivo} por resultado` : null,
      ].filter(Boolean);
      return { payload: cambio, resumen: `Topes del Media Buyer: ${partes.join(' · ')}.` };
    },
    ejecutar: async (payload, ctx) => {
      await guardarConfigMB(ctx.ws, payload, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Topes del Media Buyer guardados.' };
    },
  },
  metas_media_buyer: {
    preparar: async (input) => {
      const cambio: Record<string, number | null> = {};
      for (const k of ['metaVentasMes', 'metaGastoMes'] as const) { const v = num(input, k); if (v != null) cambio[k] = v > 0 ? v : null; }
      if (!Object.keys(cambio).length) return { error: 'No pasaste nada para cambiar.', faltan: ['metaVentasMes', 'metaGastoMes'] };
      const v = validarCambioMB(cambio);
      if (!v.ok) return { error: v.error };
      const de = (x: number | null) => (x == null ? 'sin meta' : `US$ ${x}`);
      const partes = [
        'metaVentasMes' in cambio ? `caja del mes: ${de(cambio.metaVentasMes)}` : null,
        'metaGastoMes' in cambio ? `gasto del mes: ${de(cambio.metaGastoMes)}` : null,
      ].filter(Boolean);
      return { payload: cambio, resumen: `Metas del Media Buyer: ${partes.join(' · ')}.` };
    },
    ejecutar: async (payload, ctx) => {
      await guardarConfigMB(ctx.ws, payload, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Metas del mes guardadas.' };
    },
  },
  cuenta_media_buyer: {
    preparar: async (input) => {
      const cuenta = str(input, 'cuentaPublicitaria');
      const v = validarCambioMB({ cuentaPublicitaria: cuenta || null });
      if (!v.ok) return { error: v.error };
      const act = (v.fila.cuenta_publicitaria as string | null) ?? null;
      return { payload: { cuentaPublicitaria: act }, resumen: act ? `El Media Buyer trabaja en la cuenta ${act}.` : 'El Media Buyer usa la cuenta de Integraciones.' };
    },
    ejecutar: async (payload, ctx) => {
      await guardarConfigMB(ctx.ws, { cuentaPublicitaria: (payload.cuentaPublicitaria as string | null) ?? null }, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Cuenta del Media Buyer guardada.' };
    },
  },
  ver_automatizaciones_media_buyer: {
    leer: async (_input, ctx) => {
      const [config, { decisiones, existeTabla }, cupo] = await Promise.all([leerConfigMB(ctx.ws), leerDecisionesMB(ctx.ws, 30), cupoMB(ctx.ws)]);
      if (!existeTabla) return J({ instalado: false, nota: 'El registro del Media Buyer todavía no está instalado (falta la migración 0332).' });
      const r = resolverTacticas(config.tacticas, { piloto: modoEfectivoMB(config.modo, cupo) === 'piloto', pilotoPermitido: cupo.piloto });
      return J({
        pilotoEnElPlan: cupo.piloto,
        tacticas: ORDEN_TACTICAS.map((t) => {
          const ds = decisiones.filter((d) => d.tactica === t);
          return {
            tactica: t, nombre: TACTICAS[t].nombre, que: TACTICAS[t].que, estado: r[t].estado,
            umbrales: TACTICAS[t].parametros.map((p) => ({ id: p.id, nombre: p.nombre, valor: r[t].p[p.id], recomendado: p.recomendado, minimo: p.min, maximo: p.max })),
            campanas: r[t].campanas ? [...r[t].campanas] : 'toda la cuenta',
            recomendaciones30d: ds.length, hechas30d: ds.filter((d) => d.estado === 'aplicada').length,
            ultima: ds.map((d) => d.creada).sort().pop() ?? null,
          };
        }),
      });
    },
  },
  ver_campanas_media_buyer: {
    leer: async (_input, ctx) => {
      // Lo mismo que leen la pantalla (route.ts → campanas, subir_preparar, estado_zernio) y el agente: leerDatosCuenta.
      let d: Awaited<ReturnType<typeof leerDatosCuentaMB>>;
      try { d = await leerDatosCuentaMB(ctx.ws); } catch (e) {
        if (e instanceof SinCuentaMB) return J({ conectada: false, nota: e.message });
        throw e;
      }
      // `prendido` es el interruptor PROPIO (lo que se elige en una táctica), como la lista de la pantalla.
      const fila = (n: (typeof d.arbol)[number]) => ({ id: n.id, nombre: n.nombre, prendido: n.configurado === 'ACTIVE', presupuestoDia: n.presupuestoDia });
      // Por producto, como la pestaña Campañas (lienzoMediaBuyer, con la cuenta que ya se leyó). Si el CRM falla, sin esta parte.
      const config = await leerConfigMB(ctx.ws);
      const lz = await lienzoMediaBuyer(ctx.ws, config.kpi, config.objetivo, undefined, d).catch(() => null);
      const deLienzo = (c: { id: string; nombre: string; gasto: number; resultados: number; costo: number | null }) => ({ id: c.id, nombre: c.nombre, gastoMes: c.gasto, resultadosMes: c.resultados, costoMes: c.costo });
      const retenidas = campanasRetenidas(d.arbol);
      return J({
        conectada: true, fuente: d.fuente, cuenta: d.adAccountId, cuentaNombre: d.cuentaNombre ?? null, moneda: d.moneda, avisos: d.avisos,
        // MK-03 (27/10/2026): un borrador del Administrador no existe para la API. Que MaKo no conteste «no la encuentro».
        borradores: 'Un borrador del Administrador de anuncios no llega por la API: si falta una campaña, está sin publicar o en otra cuenta (compara el número).',
        ...(lz?.aviso ? { aviso: lz.aviso } : {}),
        campanas: d.arbol.filter((n) => n.nivel === 'campaign' && n.configurado !== 'DELETED').map((c) => ({
          ...fila(c),
          ...(retenidas.has(c.id) ? { retenidaEnMeta: 'Meta la retuvo: no entrega hasta que un admin la publique en el Administrador de anuncios.' } : {}),
          conjuntos: d.arbol.filter((s) => s.nivel === 'adset' && s.parentId === c.id && s.configurado !== 'DELETED').map(fila),
        })),
        ...(lz ? {
          resultado: config.kpi,
          porProducto: lz.productos.filter((p) => p.campanas.length).map((p) => ({ ...deLienzo(p), campanas: p.campanas.map(deLienzo) })),
          sinProducto: lz.sinProducto.map(deLienzo),
        } : {}),
      });
    },
  },
  automatizacion_media_buyer: {
    preparar: async (input, ctx) => {
      const t = str(input, 'tactica') as TacticaAuto;
      if (!(ORDEN_TACTICAS as string[]).includes(t)) return { error: 'tactica tiene que ser una de las de ver_automatizaciones_media_buyer.', faltan: ['tactica'] };
      const cambio: Record<string, unknown> = {};
      const estado = str(input, 'estado');
      if (estado) cambio.estado = estado;
      if (input.umbrales != null) cambio.parametros = input.umbrales;
      if (Array.isArray(input.campanas)) cambio.campanas = input.campanas.length ? input.campanas : null;
      if (!Object.keys(cambio).length) return { error: 'No pasaste nada para cambiar.', faltan: ['estado', 'umbrales', 'campanas'] };
      // Sólo lo que se cambia: se confirma más tarde, y el servidor lo mezcla campo por campo con lo guardado en ese momento
      // (tacticas.ts → mezclarTacticas). Con la táctica entera, la confirmación pisaba lo que otro cambió en el medio (falla 2).
      const v = validarTacticas({ [t]: cambio });
      if (!v.ok) return { error: v.error };
      if (v.valor[t]?.estado === 'automatica' && !(await cupoMB(ctx.ws)).piloto) return { error: new PlanSinPiloto().message };
      const partes = [
        estado ? `queda ${estado === 'automatica' ? 'automática' : estado}` : null,
        v.valor[t]?.parametros ? `umbrales: ${Object.entries(v.valor[t]?.parametros ?? {}).map(([k, x]) => `${k} ${x}`).join(', ')}` : null,
        'campanas' in cambio ? (cambio.campanas ? `cubre ${(cambio.campanas as string[]).length} campañas` : 'cubre toda la cuenta') : null,
      ].filter(Boolean);
      return { payload: { tacticas: v.valor }, resumen: `${TACTICAS[t].nombre}: ${partes.join(' · ')}.` };
    },
    ejecutar: async (payload, ctx) => {
      await guardarConfigMB(ctx.ws, { tacticas: payload.tacticas as never }, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Táctica del Media Buyer guardada.' };
    },
  },
  // ── Los agentes y la Biblioteca (25/10/2026): lo mismo que el panel «N activos» y la pestaña Biblioteca de la pantalla.
  // ── Marketing CoPilot (6/11/2026).
  ver_copiloto_media_buyer: {
    leer: async (_input, ctx) => {
      const perfil = await leerPerfilCopiloto(ctx.ws);
      const f = funnelElegido(perfil);
      // Sólo con lo que dijo (9/11/2026): antes un presupuesto sin contestar se leía como 0 y todo funnel con anuncios «no le servía».
      const decide = datosDeDecision(perfil);
      const ficha = fichaDelNegocio(perfil);
      return J({
        perfil, paso: pasoDeCopiloto(perfil), funnel: f ? { id: f.id, nombre: f.nombre } : null,
        secciones: seccionesDe(f?.id, perfil.presupuestoMes), propuesta: propuestaDe(perfil),
        recomendado: decide ? recomendarFunnel(decide) : null, veredicto: f && decide ? evaluarFunnel(f.id, decide) : null,
        sabe: ficha.sabe, falta: ficha.falta.map((d) => ({ dato: d.clave, pregunta: d.pregunta, imprescindible: d.imprescindible })),
        funnels: decide ? compararFunnels(perfil).map((c) => ({ id: c.funnel.id, sirve: c.sirve, motivo: c.motivo, pide: c.pide, tarda: c.tarda })) : null,
        cuenta: cuentaDe(perfil),
      });
    },
  },
  copiloto_media_buyer: {
    preparar: async (input, ctx) => {
      const actual = await leerPerfilCopiloto(ctx.ws);
      const cambio: Partial<PerfilCopiloto> = {};
      for (const k of ['funnel', 'referente', 'llamadas', 'objetivo', 'formato', 'vende', 'casos', 'pais'] as const) { const v = str(input, k); if (v) (cambio as Record<string, unknown>)[k] = v; }
      for (const k of ['ticket', 'presupuestoMes', 'ritmo', 'meta', 'ventasMes', 'margen', 'lista', 'horas'] as const) { const v = num(input, k); if (v != null) (cambio as Record<string, unknown>)[k] = v; }
      if (!Object.keys(cambio).length) return { error: 'No pasaste nada para guardar.', faltan: ['funnel', 'ticket', 'presupuestoMes', 'llamadas', 'meta'] };
      // Una PREGUNTA por otro funnel («¿y si en vez de anuncios hago orgánico?») no es un pedido de cambiarlo (9/11/2026, la batería: el
      // modelo lo cambiaba igual, con la regla B del prompt en contra). Lo cumple el código: primero se comparan, después se decide.
      if (cambio.funnel && cambio.funnel !== actual.funnel && esPreguntaHipotetica(ctx.mensajeUsuario)) {
        return { error: 'La persona PREGUNTÓ por ese funnel, no pidió cambiarlo. Compárale los dos con sus números (LOS FUNNELS PARA ESTE NEGOCIO), di cuál elegirías y pregúntale si quiere cambiar; no lo propongas todavía.' };
      }
      const nuevo = sanearPerfil({ ...actual, ...cambio, entrada: actual.entrada ?? (cambio.referente ? 'referente' : 'funnel') });
      // Cambiar de funnel borra el aviso de antes: el nuevo se evalúa de cero.
      const final = cambio.funnel || cambio.referente ? aplicarPerfil(nuevo, { ajuste: undefined, aceptado: undefined }) : nuevo;
      const f = funnelElegido(final);
      // Un DATO del negocio (la meta, el margen, la lista…) se guarda aunque todavía no haya funnel (9/11/2026): es lo que el agente
      // descubre charlando y lo que dibuja el panel. Un cambio de funnel o de referente, sí, tiene que dejar uno.
      if (!f && (cambio.funnel || cambio.referente)) return { error: 'Falta el funnel o un referente (funnel: vsl-llamada, mensajes, formulario, carrito, webinar, lead-magnet, email, youtube u organico).', faltan: ['funnel'] };
      const datos = [
        final.vende && cambio.vende ? TIPOS_DE_NEGOCIO[final.vende].toLowerCase() : null,
        cambio.ticket != null ? `venta de ${final.ticket} dólares` : null,
        cambio.presupuestoMes != null ? `${final.presupuestoMes} dólares al mes en anuncios` : null,
        cambio.meta != null ? `meta de ${final.meta} por mes` : null,
        cambio.ventasMes != null ? `hoy ${final.ventasMes} por mes` : null,
        cambio.margen != null ? `margen de ${final.margen}%` : null,
        cambio.lista != null ? `lista de ${final.lista} contactos` : null,
        cambio.casos ? (final.casos === 'si' ? 'con casos reales' : 'sin casos todavía') : null,
        cambio.pais ? `vende en ${final.pais}` : null,
        cambio.horas != null ? `${final.horas} horas por semana para contenido` : null,
      ].filter(Boolean);
      return { payload: { perfil: final }, resumen: `Marketing CoPilot: ${[f && (cambio.funnel || cambio.referente || !datos.length) ? f.nombre : null, ...datos].filter(Boolean).join(', ') || 'guardar lo que dijiste'}.` };
    },
    ejecutar: async (payload, ctx) => {
      await guardarPerfilCopiloto(ctx.ws, sanearPerfil(payload.perfil));
      return { ok: true, resumen: 'Guardado en el Marketing CoPilot.' };
    },
  },
  // El método de campañas de Meta, por tema (lib/media-buyer/copiloto-metodo-anuncios.ts): puro, sin base ni IA.
  metodo_campanas_copiloto: {
    leer: async (input) => {
      const t = str(input, 'tema') as TemaMetodo;
      // El tema equivocado vuelve como REGLA con la lista, no como vacío (el mismo criterio que leer_modulo_knowledge).
      if (!(TEMAS_METODO as readonly string[]).includes(t)) return `No existe el tema «${t}». Los que hay: ${TEMAS_METODO.join(', ')}.`;
      return `## Método de campañas de Meta › ${t}\n${METODO_ANUNCIOS[t]}\n\n(Criterio de un curso de 2026, sin auditar: úsalo en tus palabras, sin nombrar de dónde sale, y bájalo a los números de ESTE negocio; si choca con lo que ya sabes, gana lo más parecido a este negocio.)`;
    },
  },
  modo_agente_media_buyer: {
    preparar: async (input, ctx) => {
      const a = str(input, 'agente') as AgenteMako;
      const estado = str(input, 'estado') as EstadoAgente;
      if (!AGENTES_MAKO.includes(a)) return { error: 'agente tiene que ser estratega, media_buyer, disenador o protect.', faltan: ['agente'] };
      if (!(estado in TACTICA_DE_ESTADO)) return { error: 'estado tiene que ser pausado, propone o automatico.', faltan: ['estado'] };
      if (estado === 'automatico' && !(await cupoMB(ctx.ws)).piloto) return { error: new PlanSinPiloto().message };
      const v = validarTacticas(cambioDeAgente(a, TACTICA_DE_ESTADO[estado]));
      if (!v.ok) return { error: v.error };
      const que = estado === 'pausado' ? 'queda pausado' : estado === 'propone' ? 'propone y espera a una persona' : 'lanza solo, dentro de los topes';
      return { payload: { tacticas: v.valor }, resumen: `${NOMBRE_AGENTE[a]} ${que}.` };
    },
    ejecutar: async (payload, ctx) => {
      await guardarConfigMB(ctx.ws, { tacticas: payload.tacticas as never }, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Agente del Media Buyer guardado.' };
    },
  },
  agente_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'agenteId');
      const lista = await leerAgentesPropios(ctx.ws);
      const actual = id ? lista.find((a) => a.id === id) : null;
      if (id && !actual) return { error: `No encuentro el agente ${id} en este negocio (míralos con ver_media_buyer).` };
      const cambio: Record<string, string> = {};
      for (const k of ['nombre', 'regla', 'cada', 'estado'] as const) { const v = str(input, k); if (v) cambio[k] = v; }
      if (actual && !Object.keys(cambio).length) return { error: 'No pasaste nada para cambiar.', faltan: ['nombre', 'regla', 'cada', 'estado'] };
      const agente = { ...(actual ?? { id: `ag-${Date.now().toString(36)}`, cada: 'dia', estado: 'activo' }), ...cambio };
      const { validarAgente } = await import('@/lib/media-buyer/agentes-propios');
      const v = validarAgente(agente);
      if (!v.ok) return { error: v.error, faltan: actual ? undefined : ['nombre', 'regla'] };
      const cada = v.valor.cada === 'semana' ? 'los lunes' : 'cada día';
      return { payload: { agente: v.valor }, resumen: `${actual ? 'Cambiar' : 'Crear'} el agente «${v.valor.nombre}» (${cada}${v.valor.estado === 'pausado' ? ', pausado' : ''}): ${v.valor.regla}` };
    },
    ejecutar: async (payload, ctx) => {
      const r = await guardarAgentePropio(ctx.ws, payload.agente);
      return r.ok ? { ok: true, resumen: `Agente guardado: lo mira tu IA en la próxima vuelta del Media Buyer.` } : { ok: false, resumen: r.error };
    },
  },
  borrar_agente_media_buyer: {
    preparar: async (input, ctx) => {
      const id = str(input, 'agenteId');
      const a = (await leerAgentesPropios(ctx.ws)).find((x) => x.id === id);
      if (!a) return { error: `No encuentro el agente ${id} en este negocio (míralos con ver_media_buyer).` };
      return { payload: { agenteId: id }, resumen: `Borrar el agente «${a.nombre}».` };
    },
    ejecutar: async (payload, ctx) => {
      const r = await borrarAgentePropio(ctx.ws, String(payload.agenteId));
      return r.ok ? { ok: true, resumen: 'Agente borrado.' } : { ok: false, resumen: r.error };
    },
  },
  ver_biblioteca_media_buyer: {
    leer: async (_input, ctx) => {
      // Lo mismo que la pestaña Biblioteca (app/ads-manager/MediaBuyer.tsx → <Biblioteca>): las mismas decisiones y los mejores del mes.
      const [config, { decisiones, existeTabla }] = await Promise.all([leerConfigMB(ctx.ws), leerDecisionesMB(ctx.ws, 30)]);
      if (!existeTabla) return J({ instalado: false, nota: 'El registro del Media Buyer todavía no está instalado (falta la migración 0332).' });
      const vista = await vistaMediaBuyer(ctx.ws, config.kpi, config.objetivo).catch(() => null);
      const esVariacion = (d: DecisionMB) => d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook';
      const corta = (d: DecisionMB) => ({
        decisionId: d.id, tipo: d.tipo, de: d.entidadNombre, titulo: d.titulo, porque: d.porque, creada: d.creada, aplicada: d.aplicadaAt,
        variaciones: d.variaciones?.map((v) => ({ id: v.id, gancho: v.gancho ?? null, texto: v.textoPrincipal.slice(0, 280), elegida: v.elegida })),
      });
      return J({
        resultado: config.kpi,
        paraRevisar: decisiones.filter((d) => ['abierta', 'fallida', 'bloqueada'].includes(d.estado) && esVariacion(d)).map(corta),
        mejores: (vista?.mejores ?? []).map((a) => ({ adId: a.adId, nombre: a.nombre, campana: a.campana, gastoMes: a.gasto, resultadosMes: a.resultados, costoMes: a.costo })),
        lanzados: decisiones.filter((d) => d.estado === 'aplicada' && (esVariacion(d) || d.tipo === 'crear_anuncios')).map(corta),
      });
    },
  },
  // DÓNDE, HASTA y «lánzame una campaña» (29/10/2026): lib/media-buyer/zona.ts y campana.ts, la misma puerta que la pantalla.
  zona_media_buyer: {
    preparar: async (input, ctx) => {
      const v = validarCambioMB({ zona: (Array.isArray(input.zona) ? input.zona : []) as never });
      if (!v.ok) return { error: v.error };
      // Cada lugar confirmado contra Meta (su id con su nombre): la confirmación muestra lo que dice Meta, no lo que mandó el modelo.
      const r = await resolverLugaresMB(ctx.ws, v.fila.zona as LugarZonaMB[]);
      if (!r.ok) return { error: r.error, ...(r.error.startsWith('No pude') ? { falla: true as const } : {}) };
      const zona = r.lugares;
      return { payload: { zona }, resumen: zona.length ? `El Media Buyer prende y sube presupuestos sólo en: ${zona.map((l) => l.nombre).join(', ')}.` : 'El Media Buyer trabaja en toda la cuenta (sin zona).' };
    },
    ejecutar: async (payload, ctx) => {
      await guardarConfigMB(ctx.ws, { zona: payload.zona as LugarZonaMB[] }, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Zona del Media Buyer guardada.' };
    },
  },
  hasta_media_buyer: {
    preparar: async (input, ctx) => {
      const hasta = str(input, 'hasta') || null;
      const campanaId = str(input, 'campanaId') || null;
      const v = validarCambioMB(campanaId ? { hastaCampana: { campanaId, fecha: hasta } } : { hasta });
      if (!v.ok) return { error: v.error };
      let nombre: string | null = null;
      if (campanaId) {
        // La campaña tiene que ser de la cuenta: se busca en la lectura del Media Buyer (la misma de la pantalla).
        const datos = await leerDatosCuentaMB(ctx.ws).catch(() => null);
        const c = datos?.arbol.find((n) => n.nivel === 'campaign' && n.id === campanaId);
        if (!datos) return { error: 'No pude leer tu cuenta de Meta para encontrar esa campaña.', falla: true };
        if (!c) return { error: `La campaña ${campanaId} no está en tu cuenta (míralas con ver_campanas_media_buyer).` };
        nombre = c.nombre;
      }
      const que = nombre ? `la campaña «${nombre}»` : 'toda la cuenta';
      const fecha = hasta ? `${hasta.slice(8, 10)}/${hasta.slice(5, 7)}/${hasta.slice(0, 4)}` : null;
      return {
        payload: { hasta, campanaId },
        resumen: fecha ? `Fecha de fin de ${que}: el ${fecha}. Pasada, MaKo la pausa; desde 3 días antes no sube presupuestos.` : `Sin fecha de fin para ${que}.`,
      };
    },
    ejecutar: async (payload, ctx) => {
      const hasta = (payload.hasta as string | null) ?? null;
      const campanaId = (payload.campanaId as string | null) ?? null;
      await guardarConfigMB(ctx.ws, campanaId ? { hastaCampana: { campanaId, fecha: hasta } } : { hasta }, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return { ok: true, resumen: 'Fecha de fin guardada.' };
    },
  },
  proponer_crear_campana: {
    preparar: async (input, ctx) => {
      // Los parámetros planos de la API (lo que se edita en /mako/revisar) → la entrada de la pantalla «Nueva campaña».
      const tipo = str(input, 'creativoTipo');
      // «Usar en un anuncio» de los editores y del AI Avatar (6/11/2026, lo prometido a Thiago): la pieza llega subida al
      // staging (`archivo`) o como un video que MaKo ya generó (`generado`, su ref). La ref se resuelve ACÁ, en el negocio, con
      // la misma función que arma la lista (lib/creativo-mako-fuentes.ts): la url nunca la trae el pedido.
      let creativo: Record<string, unknown>;
      if (tipo === 'generado') {
        const ref = leerRefCreativo(str(input, 'creativoRef'));
        if (!ref) return { error: 'Falta el video de MaKo: su ref (de `generados` en preparar_subida_media_buyer).', faltan: ['creativoRef'] };
        const c = await runWithWorkspace(ctx.ws, () => resolverCreativoMako(ref));
        if (c === 'cambio') return { error: 'Ese video se volvió a filmar después de elegirlo: elígelo otra vez para ver el de ahora.' };
        if (!c) return { error: 'Ese video ya no está entre tus videos de MaKo.' };
        creativo = c.media_type === 'image' ? { tipo: 'imagen', url: c.url } : { tipo: 'video', url: c.url };
      } else if (tipo === 'archivo') {
        creativo = { tipo, path: str(input, 'archivoPath'), media: str(input, 'archivoMedia') === 'video' ? 'video' : 'imagen' };
      } else {
        creativo = tipo === 'anuncio' ? { tipo, adId: str(input, 'anuncioId') }
          : tipo === 'video_cuenta' ? { tipo, videoId: str(input, 'videoId') }
            : tipo === 'video' ? { tipo, url: str(input, 'videoUrl') }
              : { tipo, url: str(input, 'imagenUrl') };
      }
      const entrada: Record<string, unknown> = {
        nombre: str(input, 'nombre'), objetivo: str(input, 'objetivo'), presupuestoDia: num(input, 'presupuestoDia'),
        lugares: Array.isArray(input.lugares) ? input.lugares : [], hasta: str(input, 'hasta') || null,
        edadMin: num(input, 'edadMin'), edadMax: num(input, 'edadMax'),
        formularioId: str(input, 'formularioId') || null, pixelId: str(input, 'pixelId') || null, evento: str(input, 'evento') || null,
        url: str(input, 'url') || null, creativo, texto: str(input, 'texto'), titulo: str(input, 'titulo') || null,
        boton: str(input, 'boton') || null, enPausa: input.enPausa === true,
      };
      const p = await prepararCampanaMB(ctx.ws, entrada);
      if (!p.ok) return { error: p.error, ...(p.faltan ? { faltan: p.faltan } : {}), ...(p.falla ? { falla: true as const } : {}) };
      // Un archivo del staging se borra a las 6 horas si no se publica: la confirmación lo dice.
      return { payload: { entrada }, resumen: `${p.resumen}${tipo === 'archivo' ? ' Confírmala antes de 6 horas: después el archivo se borra.' : ''}` };
    },
    ejecutar: async (payload, ctx) => {
      const r = await crearCampanaMB(ctx.ws, (payload.entrada ?? {}) as Record<string, unknown>, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)');
      return r.ok
        // Nace en pausa (campana-reglas.ts → CAMPANA_PRENDIDA_MEDIDA); lo que la relectura vio distinto va ENTERO en el resumen.
        ? { ok: true, resumen: `Campaña creada en Meta (${r.campaignId}). ${r.resumen}${r.avisos.length ? ` Ojo: ${r.avisos.join(' ')}` : ''}`, datos: { campaignId: r.campaignId, adSetId: r.adSetId, adId: r.adId, decisionId: r.decisionId, avisos: r.avisos } }
        : { ok: false, resumen: r.error };
    },
  },
  preparar_subida_media_buyer: {
    leer: async (input, ctx) => {
      // Lo mismo que «Subir creativos» de la pantalla: los conjuntos y los textos de partida (/api/media-buyer → subir_preparar)
      // y una firma por archivo (creative-signurl), con las MISMAS funciones (lib/media-buyer/subir.ts, lib/ads-staging-firma.ts).
      let datos: Awaited<ReturnType<typeof leerDatosCuentaMB>>;
      try { datos = await leerDatosCuentaMB(ctx.ws); } catch (e) {
        if (e instanceof SinCuentaMB) return J({ conectada: false, nota: e.message });
        throw e;
      }
      const conjuntos = conjuntosDeMB(datos);
      const adsetId = str(input, 'adsetId');
      if (adsetId && !conjuntos.some((c) => c.id === adsetId)) return J({ error: 'Ese conjunto no está en tu cuenta publicitaria.', conjuntos });
      const plantilla = adsetId ? await plantillaDelConjuntoMB(ctx.ws, datos, adsetId) : null;
      const nombres = (Array.isArray(input.nombres) ? input.nombres : []).filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 10);
      const subidas: Array<{ nombre: string; path: string; subirA: string; cabeceras: Record<string, string> }> = [];
      for (const nombre of nombres) {
        const f = await firmarSubidaDeStaging(nombre);
        if (!f.ok) throw new Error(`No pude preparar la subida de «${nombre}»: ${f.error}`);
        // La apikey es la pública (la anon, la misma que lleva el navegador): el gateway de Supabase la pide además del token.
        subidas.push({ nombre, path: f.path, subirA: f.signedUrl, cabeceras: { 'x-upsert': 'true', ...(f.apikey ? { apikey: f.apikey, authorization: `Bearer ${f.apikey}` } : {}) } });
      }
      // Cada firma barre lo que sobra del staging, como la de la pantalla.
      if (subidas.length) after(() => barrerStagingViejo());
      // Los videos que MaKo ya generó (AI Avatar, Video Generator): se suben con su `ref`, sin PUT. Sin leerlos, la nota lo dice.
      let generados: Array<{ ref: string; titulo: string; toma: number | null; origen: string; fecha: string | null }> = [];
      let notaGenerados: string | null = null;
      try {
        generados = (await generadosDelNegocioMB(ctx.ws)).map((c) => ({ ref: c.ref, titulo: c.titulo, toma: c.toma, origen: c.origen === 'montaje' ? 'anuncio montado' : 'toma', fecha: c.fecha }));
      } catch (e) { notaGenerados = `No pude leer tus videos de MaKo: ${e instanceof Error ? e.message : String(e)}`; }
      return J({
        generados,
        ...(notaGenerados ? { notaGenerados } : {}),
        conectada: true,
        zernio: !!datos.conexion,
        ...(datos.conexion ? {} : { nota: 'Para publicar creativos nuevos conecta la cuenta por Zernio (con el token propio, Meta los rechaza: error 1885183).' }),
        conjuntos,
        ...(plantilla ? { textosDePartida: { ...plantilla.textos, deAnuncio: plantilla.deAnuncio } } : {}),
        subidas,
        ...(subidas.length ? { comoSubir: 'Un PUT por archivo a subirA, con esas cabeceras y el archivo como cuerpo. Después, subir_creativos_media_buyer con cada path. El archivo se borra a las 6 horas si no se publica.' } : {}),
      });
    },
  },
  subir_creativos_media_buyer: {
    preparar: async (input, ctx) => {
      // El pedido se lee como lo lee la pantalla (lib/media-buyer/creativos.ts → leerPedidoDeSubida), y lo que va a fallar falla
      // ACÁ (revisarSubida y el staging), antes de que una persona lo confirme: confirmar no vuelve a `pendiente`.
      const p = leerPedidoDeSubida({
        adSetId: str(input, 'adsetId'), archivos: input.archivos, activo: input.activo, original: str(input, 'original') || null,
        textos: { textoPrincipal: input.textoPrincipal, titulo: input.titulo, cta: input.cta, link: input.link, formularioId: input.formularioId },
      });
      if (!p.adSetId) return { error: 'Falta el conjunto: su id numérico (de preparar_subida_media_buyer).', faltan: ['adsetId'] };
      // Un archivo del disco, con su path del staging; un video de MaKo, con su `ref` (de `generados` en preparar_subida_media_buyer).
      const ajenos = p.archivos.filter((a) => !archivoValidoSubida(a, esPathDeStaging));
      if (ajenos.length) return { error: `Esos archivos no se subieron con preparar_subida_media_buyer ni son videos de MaKo: ${ajenos.map((a) => a.path || a.nombre).join(', ')}.` };
      if (p.archivos.length > 10) return { error: 'Son hasta 10 archivos por subida.' };
      const rev = await revisarSubidaMB(ctx.ws, { adSetId: p.adSetId, archivos: p.archivos, textos: p.textos, original: p.original });
      if (!rev.ok) return { error: rev.error };
      let faltan: string[];
      try { faltan = await faltanEnStaging(rev.archivos.filter((a) => !a.ref).map((a) => a.path)); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
      if (faltan.length) return { error: `No encuentro ${faltan.join(', ')}: súbelo a la URL de preparar_subida_media_buyer (el archivo se borra a las 6 horas).` };
      const t = p.textos;
      const n = rev.archivos.length;
      const destino = t.formularioId ? `el formulario ${t.formularioId}` : t.link;
      const delDisco = rev.archivos.some((a) => !a.ref);
      // La url de un video de MaKo NO viaja en la pendiente: al confirmar se vuelve a resolver por su ref.
      const archivos = rev.archivos.map(({ url: _url, ...a }) => a);
      return {
        payload: {
          adsetId: p.adSetId, archivos, activo: p.activo, original: p.original,
          textoPrincipal: t.textoPrincipal, titulo: t.titulo, cta: t.cta, link: t.link, formularioId: t.formularioId,
        },
        // Lo que se publica, ENTERO: la confirmación es lo único que se lee antes de que salga.
        resumen: `Subir ${n} ${n === 1 ? 'creativo' : 'creativos'} a «${rev.conjunto.nombre}»${rev.campana ? ` (${rev.campana})` : ''}, ${p.activo ? 'activos: gastan del presupuesto del conjunto' : 'en pausa'}. `
          + `Archivos: ${rev.archivos.map((a) => `${a.nombre}${a.ref ? ' (video de MaKo)' : ''}`).join(', ')}. Texto: «${t.textoPrincipal}». Título: «${t.titulo}». Botón: ${NOMBRE_CTA_SUBIDA[t.cta]}. Destino: ${destino}. `
          + (rev.original ? `Se prueba contra «${rev.original.nombre}»: si uno le gana, MaKo propone pausar el original. ` : '')
          + (delDisco ? 'Confírmalo antes de 6 horas: después los archivos se borran.' : ''),
      };
    },
    ejecutar: async (payload, ctx) => {
      const p = leerPedidoDeSubida({
        adSetId: payload.adsetId, archivos: payload.archivos, activo: payload.activo, original: payload.original,
        textos: { textoPrincipal: payload.textoPrincipal, titulo: payload.titulo, cta: payload.cta, link: payload.link, formularioId: payload.formularioId },
      });
      if (!p.adSetId) return { ok: false, resumen: 'Falta el conjunto.' };
      const r = await subirCreativosMB(ctx.ws, { adSetId: p.adSetId, archivos: p.archivos, textos: p.textos, activo: p.activo, original: p.original }, quienChatea(ctx)?.nombre ?? 'MaKo (a pedido)', 'la API de MaKo');
      if (!r.ok) return { ok: false, resumen: r.error };
      const n = r.creados.length;
      return {
        ok: true,
        resumen: `${n === 1 ? 'Subido 1 anuncio' : `Subidos ${n} anuncios`}${r.errores.length ? `; no salieron: ${r.errores.join(' · ')}` : ''}. Se deshace con deshacer_decision_media_buyer.`,
        datos: { decisionId: r.decisionId, anuncios: r.creados },
      };
    },
  },
};
