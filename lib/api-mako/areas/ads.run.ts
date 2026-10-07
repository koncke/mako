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
import { after } from 'next/server';
import type { Ctx, Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { crearRunnerAcciones, ejecutarAccion } from '@/lib/mako-doer-acciones';
import { runWithWorkspace } from '@/lib/workspace';
import { metaWrite, type MetaWriteBody } from '@/lib/meta-write';
import { getMetaAccountHealth, type NodoEstado } from '@/lib/meta-health';
import { explicarIssueEs, esAprobacionPendiente, linkAprobarEnMeta } from '@/lib/meta-health-ui';
import {
  listCustomAudiences, searchInterests, listLeadForms, listPixels, listPixelEvents, listCustomConversions,
  searchLugares, cuentaMeta, identidadesMeta, paginasDeGanadores, getAdsetTargeting, getAdForEdit,
  getCampaignBasics, getAdsetForAdd, getAdsAprobacionPendiente, getAdAccountId, formularioBase,
  addAdToAdset, updateAdCopy, createCustomAudience, crearFormularioInstantaneo, metaErrorEnvelope,
} from '@/lib/meta-ads-create';
import { explicarRechazoPublicacion } from '@/lib/meta-publicar-errores';
import { erroresFormulario, type FormularioNuevo, type PreguntaEstandar } from '@/lib/meta-formularios';
import type { Creative, CTAType } from '@/lib/campaign-types';
import { getIncidentes } from '@/lib/meta-health-history';
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
        moneda: { gasto: `USD DERIVADO: gasto de Meta ÷ ${TIPO_DE_CAMBIO_USD_MXN} fijo del código, no lo que cobró Meta`, porcentajes: 'hook_rate, hold_rate y ctr van en %' },
        anuncios: orden.slice(0, limite).map((s) => ({
          ad_id: s.ad_id, anuncio: s.ad_name, campana: s.campana, conjunto: s.adset_name, gasto_usd: Math.round(s.spend_usd),
          leads_meta: s.meta_leads, leads_crm: s.leads, agendas: s.agendas, cierres: s.cierres, cash_usd: s.cash_usd,
          dias_corriendo: s.dias_corriendo, veredicto: s.veredicto, hook_rate_pct: r2(s.hook_rate), hold_rate_pct: r2(s.hold_rate),
          ctr_pct: r2(s.ctr_link), cpl_usd: r2(s.cpl_usd), cpm_usd: r2(s.cpm_usd), frecuencia: r2(s.frequency), impresiones: s.impressions,
        })),
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
      const inc = await getIncidentes(num(input, 'limite') ?? 30);
      return J({ incidentes: inc, ...(inc.length ? {} : { nota: 'Lista vacía: no hay incidentes registrados o no se pudo leer la tabla (la lectura no distingue). No afirmes que la cuenta nunca tuvo problemas.' }) });
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
      // COPIA de verdictFromVals (app/ads-analyst/ScriptsBrowser.tsx): primero la
      // confianza por impresiones (confFromImpr: menos de 8000 = baja → 'validar'),
      // después HOOK_MID/HOLD_MID, que valen lo mismo que HOOK_BENCH/HOLD_BENCH de
      // lib/ads-analyst.ts. Deuda: la lib no exporta una función pura del veredicto;
      // si los umbrales cambian allá, hay que cambiarlos acá.
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
      return J({ nota: 'Valoración ESTIMADA contra el perfil de la cuenta; no quedó guardada en el historial de Ads Analyst.', valoracion: r.valoracion });
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
      const salto = monto >= n.dailyBudgetMxn * 5 ? ` ⚠ Es ${Math.round(monto / n.dailyBudgetMxn)} veces el actual.` : '';
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
      const salto = monto >= n.dailyBudgetMxn * 5 ? ` ⚠ Es ${Math.round(monto / n.dailyBudgetMxn)} veces el actual.` : '';
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
      return { payload: { nivel, id }, resumen: `ELIMINAR en Meta ${etiqueta} «${n.name}» (${id})${hijos ? ` y sus ${hijos} ${nivel === 'campaign' ? 'conjuntos (con sus anuncios)' : 'anuncios'}` : ''}. No se puede deshacer.` };
    },
    ejecutar: async (p, ctx) => {
      const level = p.nivel === 'campaign' ? 'campaign' : p.nivel === 'ad' ? 'ad' : 'adset';
      // La guarda de preparar() sale de arbolMeta → getMetaHealth, una caché de 120 s
      // que metaWrite no invalida al cambiar un estado. Lo que decide un DELETE en
      // cascada se lee EN VIVO, justo antes, y en la MISMA cuenta que va a borrar.
      const vivo = await estadoVivoMeta(String(p.id), ctx.ws);
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
      try { conj = await getAdsetForAdd(adsetId); } catch (err) { return { error: `No pude leer el conjunto en Meta (${metaErrorEnvelope(err).message}).` }; }
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
      try { actual = await getAdForEdit(adId); } catch (err) { return { error: `No pude leer el anuncio en Meta (${metaErrorEnvelope(err).message}).` }; }
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
};
