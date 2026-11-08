// =============================================================================
// api-mako/areas/negocio.run — los cuerpos del área `negocio`
// =============================================================================
// Un runner por id de negocio.def.ts. Lecturas: { leer }. Acciones: { preparar,
// ejecutar }. Las heredadas de MAKO_TOOLS se ENVUELVEN con runMakoTool (siete tests
// leen lib/mako-tools.ts por regex: los cuerpos no se mudan). Todo corre adentro de
// runWithWorkspace(ctx.ws): las libs que usan getSetting/getTenantDb scopean solas.
//
// ⚠️ NADA ESCRIBE EN leer() NI EN preparar(). La pantalla genérica /mako/revisar
// guarda el INPUT y al confirmar vuelve a llamar preparar(input): por eso cada
// preparar acepta exactamente los `parametros` declarados, revalida contra la base
// y NO lanza (un throw tiraría la pantalla de revisión): los «no existe» vuelven
// como { error }. ejecutar() tampoco lanza: todo error sale como { ok:false }.
//
// ⚠️ Las generaciones con IA (avatares, lead magnets, productos) corren al CONFIRMAR,
// nunca al proponer: proponer no gasta la cuota de IA del cliente.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import { contextoParaAgente, seccionContexto, type SeccionAgente } from '@/lib/agente-contexto';
import { getFile, urlDescarga, urlPreview } from '@/lib/archivero';
import { generarPreguntasCerradas, getSchema } from '@/lib/onboarding';
import { getDiagnosticoFase, setDiagnosticoFase } from '@/lib/fase-store';
import { guardarComoOferta, leerSesion, listarSesionesOffer } from '@/lib/offer-sesiones';
import { leerFunnels } from '@/lib/funnels';
import { rotuloDeFunnels, sanearFunnelIds } from '@/lib/funnels-elegidos';
import { AVISO_DIAGNOSTICO_VIEJO, PUNTOS_CONTROL, REHACER_DIAGNOSTICO, avisosAfirmables, dimensionLabel } from '@/lib/offer-marco';
import { EMAIL_MAKO, linkApp } from '@/lib/app-url';
import { resumenDePrueba } from '@/lib/prueba-uso';
import { gratisHastaDe } from '@/lib/plan-a-mano';
import { lineaDelPrimerMes } from '@/lib/primer-mes-reglas';
import { empezarPlanAhora } from '@/lib/empezar-plan';
import { esPruebaDePlan } from '@/lib/prueba-plan-reglas';
import { altaDePartner, cambiarCobroPartner, cambiarCodigoPartner, hacermePartner, registrarPagoAPartner, resumenDelPrograma, tableroDe } from '@/lib/partners-programa';
import { COMO_PARTNERS, CUANTOS_PARTNERS, PAGOS_PARA_ACREDITAR, RUTA_PARTNERS, TEXTO_ESTADO_REFERIDO, altaLimpia, cobroLimpio, codigoNuevoValido } from '@/lib/partners-reglas';
import { mensajesParaCopiar } from '@/lib/partners-recursos';
import { NOMBRE_COSA_PRUEBA } from '@/lib/topes-plan';
import { MODULOS_KNOWLEDGE, moduloDeKey } from '@/lib/knowledge-modulos';
import { darDeBajaMiPlan, suscripcionDeMakoDe } from '@/lib/cobros';
import { esBajaPedida } from '@/lib/cobros-reglas';
import { getWorkspace } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { CAPACIDADES_PASARELA, NOMBRE_PASARELA } from '@/lib/cobros-tipos';
import { lugarSeccion, lugarDato, rutaDato, rutaSeccion, datoDeCampo, type DatoDelNegocio } from '@/lib/secciones-negocio';
import { conKit, conPorDefecto, kitTieneAlgo, resumenDeKit, sanearFuente, sanearKit, sinKit } from '@/lib/marca/kits';
import { faseDef, diagnosticar, PREGUNTAS, CANALES, type CanalId } from '@/lib/fase-diagnostico';
import { getEstadoOnboarding } from '@/lib/onboarding-state';
import { getSetting } from '@/lib/settings';
import { CLAVE_ENCUESTA } from '@/lib/onboarding-arranque';
import { getAvatares, getContextoAvatares, siguientePreguntaAvatares } from '@/lib/avatares';
import { getEntregables, siguientePreguntaEntregable } from '@/lib/entregable';
import { getPersona, personaEstado } from '@/lib/persona';
import { getPersonalidad, setPersonalidad, personalizarPregunta } from '@/lib/personalidad-store';
import { PERSONALIDAD_PREGUNTAS, personalidadCompleta } from '@/lib/personalidad';
import { getRazones } from '@/lib/razones';
import { listProductos, deleteProducto } from '@/lib/productos';
import { cuantosEnEntrega } from '@/lib/entrega-servicio';
import { fraseEntregaAlBorrar } from '@/lib/servicio-etapas';
import { sugerirProductos } from '@/lib/productos-ia';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { conLosCursosDe, grafoParaChat } from '@/lib/cerebro-para-chat';
import { construirVault } from '@/lib/vault';
import { indiceDelCerebro, recuperar } from '@/lib/cerebro-recuperar';
import { matchNodo, type CampoCerebro } from '@/lib/buscar-cerebro';
import { AREAS as AREAS_CEREBRO, type AreaId } from '@/lib/cerebro-modelo';
import { esPasoOnboarding, tabEnCapa } from '@/lib/capas';
import { cerrarPasosOnboarding, getEstadoOnboardingEstricto } from '@/lib/onboarding-state';
import { CIERRES_PASO, PASOS_TAB_POR_API, ROTULO_PASO_ONBOARDING, revisarCierreDePaso, revisarMarcaDePasoTab, type CierrePaso, type ResultadoCierre } from '@/lib/onboarding-pasos-api';
import { hechoDePasoOnboarding, hechoDePasoTab } from '@/lib/onboarding-hechos';
import { desmarcarPasoEnTodasLasTabs, getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { puentearPasosCopyGen } from '@/lib/copygen-puente';
import { borrarOferta, guardarOferta, listarOfertas, ofertasDeFunnels, productosDeOfertas, usoDeOferta } from '@/lib/ofertas';
import { planDeOferta, precioTexto, resolverOfertaPrincipal, urgenciaTexto, urgenciaVigente } from '@/lib/oferta-modelo';
import { getSettingEstricto } from '@/lib/settings';
import { ANSWERS_KEY } from '@/lib/onboarding';
import {
  capaDelWs, camposPerfil, estadoArchivero, faltantesYConocido, campoOcupado, completarHuecoPerfil,
  borrarDocumentoArchivero, regenerarAvatares, editarAvatar, borrarAvatar, regenerarLeadMagnets, editarLeadMagnet,
  aplicarSugerenciasProductos, guardarDescripcionPersona, borrarFotoPersona, personalidadParaEscribir, glosarioPropio, tabsPorConfigurar,
  nodosDeDatos, faltaBrief, faltaBriefProductos, type PasoRespuesta, type PatchAvatar, type PatchLeadMagnet,
} from './negocio.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const json = (x: unknown): string => JSON.stringify(x);
const errorLectura = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
/** Menos que esto no es un documento (`sumar_documento_second_brain`): es una frase, y para eso está guardar_campo_perfil. */
const MIN_DOCUMENTO = 120;

/** preparar() de la pantalla genérica no puede lanzar: se envuelve. */
const seguro = (fn: (input: Record<string, unknown>, ctx: Ctx) => Promise<Preparado>) =>
  async (input: Record<string, unknown>, ctx: Ctx): Promise<Preparado> => {
    try { return await fn(input, ctx); } catch (e) { return { error: `No pude revisar la propuesta contra la base (${msg(e)}).`, falla: true }; }
  };

/** ejecutar() nunca lanza: si algo falla, ok:false con el motivo. */
const sinLanzar = (fn: (payload: Record<string, unknown>, ctx: Ctx) => Promise<Ejecutado>) =>
  async (payload: Record<string, unknown>, ctx: Ctx): Promise<Ejecutado> => {
    try { return await fn(payload, ctx); } catch (e) { return { ok: false, resumen: `No se pudo aplicar (${msg(e)}).` }; }
  };

const respuestasDe = (v: unknown): PasoRespuesta[] =>
  Array.isArray(v)
    ? v.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { pregunta: String(o.pregunta ?? '').trim(), respuesta: String(o.respuesta ?? '').trim() }; })
      .filter((x) => x.pregunta && x.respuesta)
    : [];

/** Si la IA devolvió menos avatares que los que había, dice cuántos se fueron y cuántas razones quedaron sin avatar. */
const avisoQuitados = async (ids: string[]): Promise<string> => {
  if (!ids.length) return '';
  const huerfanas = (await getRazones().catch(() => null))?.filter((r) => ids.includes(r.avatarId ?? '')).length;
  const razones = huerfanas == null ? ' (no pude contar las razones de compra que quedaron sin avatar)' : `; ${huerfanas} razón${huerfanas === 1 ? '' : 'es'} de compra quedaron sin avatar`;
  return ` Se quitaron ${ids.length} avatar${ids.length === 1 ? '' : 'es'}${razones}.`;
};

const TOPE_RESULTADOS_CEREBRO = 30;
const TOPE_VAULT_CHARS = 60_000;
const recorte = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── El onboarding desde afuera (cerrar_paso_onboarding, marcar_paso_onboarding_tab) ──────────────────────────

/** La capa del negocio, ESTRICTA: `capaDelWs` cae a la capa por defecto si no puede leer, y con eso cerraría pasos de
 *  otro plan. Sin `getCapaActual`, que va memoizado por request. */
async function capaEstricta(ws: number) {
  const w = await getWorkspace(ws); // tira si la base no contesta
  if (!w) throw new Error('no encontré este negocio');
  return capaDef(w.capa);
}

/** La MISMA revisión al proponer y al confirmar: entre el «sí» y la propuesta pudo cambiar el dato o el estado. */
async function revisarCierre(input: Record<string, unknown>, ws: number) {
  const paso = str(input, 'paso');
  const cierre = str(input, 'cierre') as CierrePaso;
  const rechazo = (r: ResultadoCierre) => ({ r, paso: null, cierre: null, capa: null });
  if (!esPasoOnboarding(paso)) return rechazo({ error: `«${paso}» no es un paso del arranque.` });
  if (!CIERRES_PASO.includes(cierre)) return rechazo({ error: 'cierre va como «hecho» o «postergado».', disponibles: CIERRES_PASO });
  const [capa, estado] = await Promise.all([capaEstricta(ws), getEstadoOnboardingEstricto()]);
  // El dato vivo sólo de un paso de su plan: los otros se rechazan sin leer nada.
  const hecho = capa.onboarding.includes(paso) ? await hechoDePasoOnboarding(paso, ws, capa) : { sinDato: 'no es de su plan.' };
  return { r: revisarCierreDePaso({ estado, pasosCapa: capa.onboarding, paso, cierre, hecho }), paso, cierre, capa };
}

async function revisarMarcaTab(input: Record<string, unknown>, ws: number) {
  const tab = str(input, 'tab');
  const paso = str(input, 'paso');
  const hecho = input.hecho !== false;
  const capa = await capaEstricta(ws);
  const permitido = !!PASOS_TAB_POR_API[tab]?.includes(paso);
  // `getEstadoTab` ya cruza el registro compartido de pasos (un paso hecho en otra tab cuenta).
  const steps = permitido ? (await getEstadoTab(tab)).steps : {};
  const dato = permitido && hecho ? await hechoDePasoTab(paso) : { sinDato: 'no se marca desde aquí.' };
  return { r: revisarMarcaDePasoTab({ tab, paso, hecho, steps, tabEnCapa: tabEnCapa(tab, capa.id), dato }), tab, paso, hecho };
}

/** Un `{ error }` de las reglas puras, como lo espera el choke point (con `yaEstaba` y `disponibles` si vienen). */
const comoError = (r: { error: string; yaEstaba?: true; disponibles?: readonly string[] }): Preparado =>
  ({ error: r.error, ...(r.yaEstaba ? { yaEstaba: true } : {}), ...(r.disponibles ? { disponibles: r.disponibles } : {}) });

// ── El catálogo de ofertas (listar_ofertas, guardar_oferta, borrar_oferta) ───────────────────────────────────

/** Los que, en la oferta que sale del perfil del negocio, MaKo lee del perfil y no de la fila (`resolverOfertaPrincipal`). */
const CAMPOS_DEL_PERFIL = ['promesa', 'incluye', 'garantia', 'precio_usd', 'precio_nota'];

/** El perfil del negocio, ESTRICTO: la oferta que sale de él muestra sus campos, y un perfil sin leer no es uno vacío. */
async function respuestasDelPerfil(): Promise<Record<string, string>> {
  const raw = await getSettingEstricto(ANSWERS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { throw new Error('el perfil del negocio no es legible'); }
}

/**
 * Qué oferta toca y cómo queda: la regla es pura y vive con su test (`planDeOferta`, lib/oferta-modelo.ts): con id,
 * ésa; sin id, siempre una nueva. Corre al proponer Y al confirmar, con la lista leída en el momento.
 */
async function revisarOferta(input: Record<string, unknown>) {
  const ofertas = await listarOfertas(); // tira si la base no contesta
  const p = planDeOferta(ofertas, input);
  return 'error' in p ? p : { ...p, ofertas };
}

// ── los runners ──────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas ────────────────────────────────────────────────────────────────
  contexto_negocio: {
    leer: async (input) => {
      const seccion = str(input, 'seccion') as SeccionAgente | '';
      // El pie del núcleo manda a pedir las secciones por `GET /api/agente/contexto?seccion=…`,
      // una URL que el modelo no tiene por WhatsApp ni en la app: se traduce a esta operación.
      if (!seccion) return (await contextoParaAgente()).replace(/`GET \/api\/agente\/contexto\?seccion=(\w+)`/g, 'contexto_negocio con seccion=«$1»');
      const md = await seccionContexto(seccion);
      // Una sección vacía NO es un error: es un negocio que todavía no cargó eso.
      return md || `_Todavía no hay nada cargado en «${seccion}»._\n`;
    },
  },

  ver_perfil_negocio: {
    leer: async (_input, ctx) => {
      const campos = await camposPerfil(ctx.ws);
      const huecos = campos.filter((c) => c.valor == null).length;
      // Ticket #48 (3/11/2026): MaKo leía el precio y el horario y no sabía en qué pantalla se corrigen. Cada campo lo dice,
      // con el nombre que la persona lee y el link (lib/secciones-negocio.ts, DATOS_DEL_NEGOCIO).
      const conDonde = campos.map((c) => { const d = datoDeCampo(c.key); return d ? { ...c, se_corrige_en: dondeSeEdita(d, ctx.ws) } : c; });
      return json({ campos: conDonde, total: campos.length, huecos, nota: '`pregunta` es cómo se le pide el dato al dueño, no el dato. `valor: null` = nunca se cargó. `se_corrige_en` es la pantalla donde la persona lo corrige tocándolo.' });
    },
  },

  // El plan de MaKo del negocio (15/10/2026, «Tu plan»): lo que la PLATAFORMA le cobra, leído por `alta_ws`.
  ver_mi_plan: {
    leer: async (_input, ctx) => {
      const [ws, sus, gratisHasta] = await Promise.all([getWorkspace(ctx.ws), suscripcionDeMakoDe(ctx.ws), gratisHastaDe(ctx.ws).catch(() => null)]);
      const plan = capaDef(ws?.capa).nombre;
      const donde = linkApp('/configuraciones/plan', ctx.ws);
      if (!sus) return json({ plan, cobro: 'acordado con MaKo', ...(gratisHasta ? { gratis_hasta: gratisHasta } : {}), para_cambiar_o_cancelar: `escribir a ${EMAIL_MAKO}`, link: donde });
      return json({
        plan, cobro: NOMBRE_PASARELA[sus.proveedor], monto_por_mes: formatoMonto(sus.monto, sus.moneda),
        estado: sus.suscripcion_estado === 'cancelada' ? 'dado de baja' : esBajaPedida(sus.motivo) ? 'baja pedida'
          : esPruebaDePlan(sus) && sus.estado === 'pendiente' ? 'en prueba gratis (ver_mi_prueba)' : 'activo',
        ...(esBajaPedida(sus.motivo) ? { baja: sus.motivo } : {}),
        ...(lineaDelPrimerMes(sus, formatoMonto) ? { primer_mes: lineaDelPrimerMes(sus, formatoMonto) } : {}),
        para_darse_de_baja: 'dar_de_baja_mi_plan, o el botón «Darme de baja» de Tu plan',
        link: donde,
      });
    },
  },

  // «Darme de baja» (15/10/2026): la misma función que el botón de Tu plan (lib/cobros.ts, `darDeBajaMiPlan`).
  dar_de_baja_mi_plan: {
    preparar: seguro(async (_input, ctx) => {
      const sus = await suscripcionDeMakoDe(ctx.ws);
      if (!sus) return { error: `El plan de este negocio no se cobra por la pasarela: para darlo de baja hay que escribir a ${EMAIL_MAKO}.` };
      if (sus.suscripcion_estado === 'cancelada') return { error: 'El plan ya estaba dado de baja.', yaEstaba: true };
      if (esBajaPedida(sus.motivo)) return { error: sus.motivo ?? 'La baja ya estaba pedida.', yaEstaba: true };
      const como = esPruebaDePlan(sus) && sus.estado === 'pendiente'
        ? 'Está en su prueba gratis: no se le cobra nada, y sigue usando MaKo hasta el día que iba a cobrarse.'
        : CAPACIDADES_PASARELA[sus.proveedor].bajaAlFinDelPeriodo ? 'Deja de cobrarse al final del mes pagado, y se sigue usando hasta entonces.' : `${NOMBRE_PASARELA[sus.proveedor]} deja de cobrarlo en el acto.`;
      return { payload: {}, resumen: `Dar de baja el plan de MaKo (${formatoMonto(sus.monto, sus.moneda)} por mes, por ${NOMBRE_PASARELA[sus.proveedor]}). ${como}` };
    }),
    ejecutar: sinLanzar(async (_payload, ctx) => {
      const r = await darDeBajaMiPlan(ctx.ws, ctx.actor?.trim() || 'MaKo');
      return r.ok ? { ok: true, resumen: r.resumen, datos: { codigo: r.codigo } } : { ok: false, resumen: r.resumen };
    }),
  },

  // La prueba gratis (25/10/2026): lo mismo que el cartel «Versión de prueba» y la franja de cada tope.
  ver_mi_prueba: {
    leer: async (_input, ctx) => {
      const r = await resumenDePrueba(ctx.ws);
      const link = linkApp('/configuraciones/plan', ctx.ws);
      if (!r.enPrueba) return json({ en_prueba: false, link });
      return json({
        en_prueba: true, dias_que_quedan: r.dias, primer_cobro: r.hasta, plan: r.plan, al_terminar_se_cobra: r.despues,
        usos: r.usos.map((u) => ({ que: NOMBRE_COSA_PRUEBA[u.tope][1], usado: u.usado, de: u.de })),
        exportar_en_masa: 'se habilita con el primer cobro',
        para_empezar_ya: 'empezar_mi_plan_ya', para_cancelar_sin_cobro: 'dar_de_baja_mi_plan', link,
      });
    },
  },

  // «Empezar mi plan ya» (25/10/2026): la misma función que el botón de Tu plan (lib/empezar-plan.ts).
  empezar_mi_plan_ya: {
    preparar: seguro(async (_input, ctx) => {
      const r = await resumenDePrueba(ctx.ws);
      if (!r.enPrueba) return { error: 'Este negocio no está en su prueba gratis: su plan ya se cobra solo.' };
      return { payload: {}, resumen: `Empezar ${r.plan} desde hoy${r.despues ? ` (${r.despues})` : ''}: se abre el pago, y la prueba se cancela cuando ese pago entre.` };
    }),
    ejecutar: sinLanzar(async (_payload, ctx) => {
      const r = await empezarPlanAhora(ctx.ws, ctx.actor?.trim() || 'MaKo');
      return r.ok ? { ok: true, resumen: `Listo: el pago está abierto. Para pagarlo: ${r.link}`, datos: { link: r.link } } : { ok: false, resumen: r.resumen };
    }),
  },

  // MaKo Partners (25/10/2026): lo mismo que /partners (lib/partners-programa.ts).
  ver_mi_programa_partners: {
    leer: async (_input, ctx) => {
      const link = linkApp(RUTA_PARTNERS, ctx.ws);
      const t = await tableroDe(ctx.ws);
      if (!t.alta) return json({ es_partner: false, gana: 'el 100% del primer mes de cada negocio nuevo que traiga, en dinero', para_hacerse: 'hacerme_partner', link });
      return json({
        es_partner: true, desde: t.alta.at, link_para_compartir: t.link, codigo: t.codigo,
        visitas_al_link: t.visitas.total, visitas_este_mes: t.visitas.esteMes,
        ganado_usd: t.resumen.ganadoUsd, a_cobrar_usd: t.resumen.aCobrarUsd, en_camino_usd: t.resumen.porGanarUsd, cobrado_usd: t.resumen.pagadoUsd,
        se_le_transfiere_a: t.alta.cobro ?? 'sin cargar (cambiar_cobro_partners)',
        negocios: t.referidos.map((r) => ({ nombre: r.nombre, plan: r.plan, desde: r.desde, estado: TEXTO_ESTADO_REFERIDO[r.estado], le_deja_usd: r.estado === 'se-fue' ? 0 : r.gananciaUsd })),
        pagos: t.pagos.map((p) => ({ fecha: p.fecha, monto_usd: p.montoUsd })),
        cuando_se_gana: `cuando cada negocio paga su ${PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : `${PAGOS_PARA_ACREDITAR}º`} mes`, link,
        // Los recursos para recomendar (27/10/2026, lib/partners-recursos.ts): los mismos mensajes del panel, con su link. El
        // PDF de venta se arma en el navegador (/partners, «Descargar el PDF de venta»).
        ...(t.link && t.codigo ? { mensajes_para_recomendar: mensajesParaCopiar({ link: t.link, codigo: t.codigo }).map((m) => ({ para: m.titulo, texto: m.texto })) } : {}),
      });
    },
  },
  hacerme_partner: {
    preparar: seguro(async (input, ctx) => {
      const alta = altaLimpia(input);
      const ya = await altaDePartner(ctx.ws).catch(() => null);
      // Cualquier plan es partner desde el 29/10/2026 (antes, sólo MaKo Pro).
      const cuantos = CUANTOS_PARTNERS.find((c) => c.id === alta.cuantos)?.texto;
      const como = alta.como.map((c) => COMO_PARTNERS.find((x) => x.id === c)?.texto).filter(Boolean).join(', ');
      const partes = [cuantos && `a ${cuantos} negocios`, como && `por ${como.toLowerCase()}`, alta.cobro ? `cobra en ${alta.cobro}` : 'dónde cobra, después'].filter(Boolean);
      return { payload: { cuantos: alta.cuantos, como: alta.como, cobro: alta.cobro }, resumen: `${ya ? 'Actualizar el alta de MaKo Partners' : 'Hacer partner de MaKo a este negocio'}: ${partes.join(' · ')}. Gana el 100% del primer mes de cada negocio que traiga.` };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const r = await hacermePartner(ctx.ws, payload);
      return r.ok ? { ok: true, resumen: `Listo: ya es partner. Su link: ${r.link} (código ${r.codigo}).`, datos: { link: r.link, codigo: r.codigo } } : { ok: false, resumen: r.error };
    }),
  },
  cambiar_cobro_partners: {
    preparar: seguro(async (input, ctx) => {
      const cobro = cobroLimpio(input.cobro);
      if (!cobro) return { error: 'Falta a dónde transferirle: su alias, su CBU o el email de PayPal.' };
      const alta = await altaDePartner(ctx.ws);
      if (!alta) return { error: 'Este negocio todavía no es partner: primero hacerme_partner.' };
      return { payload: { cobro }, resumen: `Transferirle lo que gane en MaKo Partners a: ${cobro}${alta.cobro ? ` (antes: ${alta.cobro})` : ''}.` };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const r = await cambiarCobroPartner(ctx.ws, payload.cobro);
      return r.ok ? { ok: true, resumen: `Listo: se le transfiere a ${r.cobro}.` } : { ok: false, resumen: r.error };
    }),
  },
  // Cambiar el código (27/10/2026): lo mismo que «Cambiar» del panel (lib/partners-programa.ts, `cambiarCodigoPartner`).
  cambiar_codigo_partners: {
    preparar: seguro(async (input, ctx) => {
      const v = codigoNuevoValido(input.codigo);
      if (!v.ok) return { error: v.error };
      const t = await tableroDe(ctx.ws);
      if (!t.alta || !t.codigo) return { error: 'Este negocio todavía no es partner: primero hacerme_partner.' };
      if (t.codigo === v.codigo) return { error: `Su código ya es ${v.codigo}.`, yaEstaba: true };
      return { payload: { codigo: v.codigo }, resumen: `Cambiar el código de MaKo Partners de ${t.codigo} a ${v.codigo}. El link y el código de antes le siguen acreditando.` };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const r = await cambiarCodigoPartner(ctx.ws, payload.codigo);
      return r.ok ? { ok: true, resumen: `Listo: su código es ${r.codigo} y su link ${r.link}.`, datos: { codigo: r.codigo, link: r.link } } : { ok: false, resumen: r.error };
    }),
  },
  ver_programa_partners: {
    leer: async () => {
      const p = await resumenDelPrograma();
      return json({
        partners: p.partners, partners_este_mes: p.partnersEsteMes, negocios_referidos: p.referidos,
        ganado_usd: p.ganadoUsd, transferido_usd: p.pagadoUsd, a_pagar_usd: p.aPagarUsd, numeros_al_menos: p.truncado,
        lista: p.lista.map((x) => ({ ws: x.ws, nombre: x.nombre, desde: x.desde, negocios: x.referidos, ganado_usd: x.ganadoUsd, pagado_usd: x.pagadoUsd, a_pagar_usd: x.aCobrarUsd, se_le_transfiere_a: x.cobro })),
        para_anotar_un_pago: 'registrar_pago_partner',
      });
    },
  },
  registrar_pago_partner: {
    preparar: seguro(async (input) => {
      const ws = Number(input.partnerWs);
      if (!Number.isInteger(ws) || ws <= 0) return { error: 'Falta el partner (partnerWs, de ver_programa_partners).' };
      const p = (await resumenDelPrograma()).lista.find((x) => x.ws === ws);
      if (!p) return { error: 'Ese negocio no es partner.' };
      if (!(p.aCobrarUsd > 0)) return { error: `${p.nombre} no tiene nada a cobrar.` };
      const monto = input.montoUsd == null ? p.aCobrarUsd : Math.round(Number(input.montoUsd) * 100) / 100;
      if (!(monto > 0) || monto > p.aCobrarUsd) return { error: `El pago tiene que ser de hasta ${formatoMonto(p.aCobrarUsd, 'USD')}, lo que tiene a cobrar.` };
      const nota = cobroLimpio(input.nota);
      return { payload: { partnerWs: ws, montoUsd: monto, nota }, resumen: `Anotar que le transferiste ${formatoMonto(monto, 'USD')} a ${p.nombre}${p.cobro ? ` (${p.cobro})` : ''}. Se le avisa por email.` };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const r = await registrarPagoAPartner({ ws: Number(payload.partnerWs), montoUsd: Number(payload.montoUsd), nota: payload.nota == null ? null : String(payload.nota), autor: ctx.actor?.trim() || 'MaKo' });
      return r.ok ? { ok: true, resumen: r.resumen, datos: { monto_usd: r.montoUsd } } : { ok: false, resumen: r.error };
    }),
  },

  ver_archivero: {
    leer: async () => {
      const est = await estadoArchivero();
      const nombres = new Map(est.brief.map((c) => [c.key, c.label]));
      return json({
        documentos: est.files.map((f) => ({ id: f.id, nombre: f.nombre, mime: f.mime, tamano_bytes: f.tamano, fecha: f.created_at, que_entendio: f.razonamiento, campos_aportados: f.aporto })),
        procedencia: Object.entries(est.fuente).map(([key, f]) => ({ key, origen: f.tipo === 'manual' ? 'editado a mano' : `documento «${f.nombre ?? f.id}»` })),
        huecos: est.gaps.map((key) => ({ key, pregunta: nombres.get(key) ?? key })),
        nota: 'Solo los campos de a qué se dedica, oferta y cliente salen de documentos. El texto de los documentos no se guarda.',
      });
    },
  },

  obtener_link_documento_archivero: {
    leer: async (input) => {
      const f = await getFile(str(input, 'id'));
      if (!f) return errorLectura('No existe un documento con ese id en este negocio. Pide la lista con ver_archivero.');
      // Una web pegada guarda la URL como storage_path: firmarla sobre el bucket da null.
      if (f.mime === 'text/html' && /^https?:\/\//i.test(f.storage_path)) {
        return json({ nombre: f.nombre, url: f.storage_path, vence_en_segundos: null, nota: 'Es una página web: el link es la dirección original y no vence.' });
      }
      const preview = input.preview === true;
      const url = preview ? await urlPreview(f.storage_path) : await urlDescarga(f.storage_path, f.nombre);
      if (!url) return errorLectura(`No pude generar el link de ese documento. Puede verse desde ${lugarSeccion('archivero')}.`);
      return json({ nombre: f.nombre, url, vence_en_segundos: preview ? 300 : 120, modo: preview ? 'ver en línea' : 'descarga' });
    },
  },

  generar_preguntas_huecos_perfil: {
    leer: async () => {
      const { faltantes, conocido } = await faltantesYConocido();
      if (!faltantes.length) return json({ preguntas: [], nota: 'No hay huecos en el perfil de oferta y cliente.' });
      const preguntas = await generarPreguntasCerradas(faltantes, conocido);
      return json({ preguntas, nota: 'Una pregunta sin opciones es la de respaldo (la IA no pudo armarla cerrada): pregúntala abierta.' });
    },
  },

  ver_diagnostico_fase: {
    leer: async () => {
      const d = await getDiagnosticoFase();
      if (!d) return json({ diagnostico: null, nota: 'El negocio nunca hizo el diagnóstico de fase.' });
      const f = faseDef(d.fase);
      return json({
        fase: f.id, fase_nombre: f.nombre, rango: f.rango,
        cuello: f.cuelloLabel, canal: d.canal ? (CANALES.find((c) => c.id === d.canal)?.label ?? d.canal) : null,
        consistencia_pct: d.consistencia, mixto: d.mixto,
        votos_por_fase: d.reparto.map((n, i) => ({ fase: i + 1, votos: n })),
        objetivo: f.objetivo, hito: f.hito,
        prioridades_criticas: f.acciones.filter((a) => a.critica).map((a) => a.titulo),
        no_hacer_todavia: f.noHacer,
        nota: 'La fase va del 1 al 5 (el número que ve el cliente).',
      });
    },
  },

  listar_analisis_oferta: {
    leer: async (_input, ctx) => {
      const lista = await listarSesionesOffer();
      return json({
        conversaciones: lista.map((s) => ({ id: s.id, titulo: s.titulo, estado: s.estado, nota_total: s.total, fecha: s.updatedAt })),
        link: linkApp('/offer', ctx.ws),
        nota: lista.length
          ? '`nota_total: null` = todavía no hay una oferta armada en esa conversación. El detalle, con ver_analisis_oferta.'
          : 'Todavía no hay conversaciones en la tab Offer.',
      });
    },
  },

  ver_analisis_oferta: {
    leer: async (input, ctx) => {
      const link = linkApp('/offer', ctx.ws);
      let id = typeof input.id === 'number' && Number.isInteger(input.id) && input.id > 0 ? input.id : null;
      if (id == null) {
        id = (await listarSesionesOffer()).find((s) => s.total != null)?.id ?? null;
        if (id == null) return json({ analisis: null, link, nota: 'Todavía no hay ninguna oferta armada en la tab Offer.' });
      }
      const s = await leerSesion(id);
      if (!s) return errorLectura('No existe una conversación de Offer con ese id en este negocio. Pide la lista con listar_analisis_oferta.');
      const conversacion = {
        id: s.id, titulo: s.titulo, estado: s.estado,
        funnel: s.funnelNombre || null, oferta_analizada: s.ofertaBaseNombre || null,
        versiones: s.versiones, guardada_como_oferta: s.ofertaId != null,
        // #895: en qué funnels está guardada (uno o varios) y los del negocio, para guardar_oferta_analisis.
        guardada_en: s.guardadaEn,
        funnels_del_negocio: ((await leerFunnels().catch(() => null)) ?? []).map((f) => ({ id: f.id, nombre: (f.producto ?? '').trim() || f.nombre })),
      };
      const c = s.conclusion;
      if (!c) return json({ conversacion, analisis: null, link, nota: 'Esta conversación todavía no tiene una oferta armada.' });
      const p = c.propuesta;
      // OF1 (22/10/2026): un diagnóstico armado con el embudo de OTRO funnel («solo 2 ventas de 24 asistentes» en el
      // Sprint de Mauricio) no entra al contexto de nadie: ni el diagnóstico ni sus avisos. La oferta sí: es la que está
      // guardada en el funnel.
      const viejo = s.diagnosticoViejo === true;
      return json({
        conversacion,
        version: c.version, fecha: c.at,
        ...(viejo ? { diagnostico_no_vigente: `${AVISO_DIAGNOSTICO_VIEJO} No lo uses ni lo cites: el dueño lo rehace con «${REHACER_DIAGNOSTICO}» en la tab Offer.` } : {}),
        diagnostico: viejo ? null : {
          nota_total: c.calculo.total, lista_para_vender: c.calculo.lista, la_mas_baja: dimensionLabel(c.calculo.cuello),
          tesis: c.diagnostico.tesis, lo_mas_fuerte: c.diagnostico.fuerte,
          cambios: c.diagnostico.cambios.map((x) => ({ que: x.titulo, porque: x.porque })),
          notas: c.diagnostico.dimensiones.map((d) => ({ dimension: dimensionLabel(d.id), nota: d.nota })),
        },
        // Lo guardado pasa por el mismo filtro que el PDF y la pantalla: ningún aviso con un % imposible.
        avisos: viejo ? [] : avisosAfirmables(c.calculo.alertas),
        control_final: (c.calculo.controlFinal ?? []).map((x) => ({ punto: PUNTOS_CONTROL.find((q) => q.punto === x.punto)?.label ?? x.punto, ok: x.ok, porque: x.porque })),
        oferta: {
          nombre: p.nombre, frase: p.frase, para_quien: p.paraQuien.perfil, no_es_para: p.paraQuien.noEs,
          ruta: p.ruta.map((f) => ({ fase: f.fase, hito: f.hito })),
          incluye: p.incluye.map((e) => e.nombre),
          garantia: { nombre: p.garantia.nombre, condiciones: p.garantia.condiciones, plazo: p.garantia.plazo },
          bonos: p.bonos.map((b) => b.nombre),
          precio: p.inversion.precio, valor_total: p.inversion.valorTotal,
          propuesto_por_mako: p.propuestoPorMako ?? [],
          supuestos: p.supuestos ?? [],
          falta_completar: p.completar,
          avisos_del_marco: p.avisos ?? [],
          provisional: c.provisional ?? null,
        },
        link,
        nota: '«[completar]» es un dato que el negocio no dio y MaKo no inventa. `propuesto_por_mako` es lo que MaKo propuso sin que el negocio lo dijera: se presenta como propuesta. El PDF de cada versión se baja desde la tab.',
      });
    },
  },

  // #895: lo mismo que «Guardar» de la tab, en uno o varios funnels (guardarComoOferta, lib/offer-sesiones.ts).
  guardar_oferta_analisis: {
    preparar: seguro(async (input) => {
      let id = typeof input.id === 'number' && Number.isInteger(input.id) && input.id > 0 ? input.id : null;
      if (id == null) id = (await listarSesionesOffer()).find((s) => s.total != null)?.id ?? null;
      if (id == null) return { error: 'Todavía no hay ninguna oferta armada en la tab Offer.' };
      const s = await leerSesion(id);
      if (!s) return { error: 'No existe una conversación de Offer con ese id en este negocio. Pide la lista con listar_analisis_oferta.' };
      if (!s.conclusion) return { error: 'Esa conversación todavía no tiene una oferta armada: primero hay que tocar «Armar mi oferta» en la tab.' };
      const crudo = str(input, 'funnels');
      const disponibles = ((await leerFunnels().catch(() => null)) ?? []).map((f) => ({ id: f.id, nombre: (f.producto ?? '').trim() || f.nombre }));
      let funnelIds: number[] | null = null;
      if (crudo) {
        if (/^tod[oa]s?$/i.test(crudo)) funnelIds = [];
        else {
          const partes = crudo.split(/[,\s]+/).filter(Boolean);
          const ids = sanearFunnelIds(partes);
          if (!ids.length || ids.length !== new Set(partes).size) return { error: `funnels: «${crudo}» no es «todos» ni una lista de ids de funnels separados por coma.` };
          const faltan = ids.filter((x) => !disponibles.some((f) => f.id === x));
          if (faltan.length) return { error: `No hay un funnel activo con id ${faltan.join(', ')}. Los del negocio están en ver_analisis_oferta (funnels_del_negocio).` };
          funnelIds = ids;
        }
      }
      const donde = funnelIds == null
        ? (s.funnelId != null ? `el funnel de la conversación («${s.funnelNombre || `#${s.funnelId}`}»)` : 'el negocio, sin funnel')
        : funnelIds.length ? rotuloDeFunnels(funnelIds, disponibles) : 'todos los funnels';
      const nombre = s.conclusion.propuesta.nombre || s.titulo;
      return { payload: { id, funnelIds }, resumen: `Guardar la oferta «${nombre}» (versión ${s.conclusion.version}) en ${donde}.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const funnelIds = payload.funnelIds == null ? null : sanearFunnelIds(payload.funnelIds);
      const r = await guardarComoOferta(Number(payload.id), funnelIds);
      const s = await leerSesion(Number(payload.id));
      const donde = s?.guardadaEn.length ? ` en ${rotuloDeFunnels(s.guardadaEn.map((x) => x.id), s.guardadaEn)}` : '';
      return { ok: true, resumen: `Listo: la oferta quedó guardada${donde} (oferta #${r.ofertaId}).${r.aviso ? ` ${r.aviso}` : ''}`, datos: { ofertaId: r.ofertaId } };
    }),
  },

  listar_preguntas_diagnostico_fase: {
    leer: async () => json({
      preguntas: PREGUNTAS.map((p, i) => ({ orden: i + 1, id: p.id, texto: p.texto, opciones: p.opciones.map((o, idx) => ({ indice: idx, texto: o })) })),
      canales: CANALES.map((c) => ({ id: c.id, nombre: c.label, descripcion: c.desc })),
      nota: 'La pregunta de volumen usa el texto del canal «llamadas»; con otro canal se adapta, pero los índices valen igual.',
    }),
  },

  ver_estado_onboarding: {
    leer: async (_input, ctx) => {
      const [s, capa, encuestaRaw] = await Promise.all([getEstadoOnboarding(), capaDelWs(ctx.ws), getSetting(CLAVE_ENCUESTA).catch(() => null)]);
      const pasos = capa.onboarding.map((p) => ({ paso: p, hecho: !!s.steps[p]?.done, postergado: !!s.steps[p]?.postergado }));
      // Cómo llegó a MaKo y qué quiere resolver primero (las dos preguntas del arranque del 17/10/2026), si ya cerró. Y lo que
      // dijo que faltaba o estaba mal en el PDF de su oferta (`pdfNota`, quinta revisión, 21/10): MaKo le dijo «lo anoto».
      let encuesta: { origen: string | null; interes: string | null; pdfNota: string | null } | null = null;
      try {
        const v = encuestaRaw ? JSON.parse(encuestaRaw) as { origen?: unknown; interes?: unknown; pdfNota?: unknown } : null;
        if (v) encuesta = { origen: typeof v.origen === 'string' ? v.origen : null, interes: typeof v.interes === 'string' ? v.interes : null, pdfNota: typeof v.pdfNota === 'string' ? v.pdfNota : null };
      } catch { encuesta = null; }
      return json({
        estado: s.status, pasos, encuesta,
        // Sin completedBy: es el email de quien lo cerró (dato del equipo) y esto sale por http.
        empezo: s.startedAt ?? null, termino: s.completedAt ?? null,
        nota: [pasos.length ? 'Solo los pasos que le tocan a este plan.' : 'Este plan no tiene asistente de arranque.',
          // Si la nota no dice qué (un «no» sin detalle, o «No me convence»), que MaKo pregunte: siempre, no sólo con la marca
          // sin detalle (séptima revisión, 21/10).
          encuesta?.pdfNota ? 'encuesta.pdfNota: lo que el cliente dijo que falta o está mal en el PDF de su oferta. Se le prometió trabajarlo en la app: ofrécele corregirlo en Offer. Si la nota no dice QUÉ falta o qué está mal («sin detalle», «No me convence», «Falta algo»), pregúntale antes de corregir nada.' : ''].filter(Boolean).join(' '),
      });
    },
  },

  listar_tabs_por_configurar: {
    leer: async (_input, ctx) => {
      const config = await tabsPorConfigurar(await capaDelWs(ctx.ws));
      return json({ tabs: config, nota: config.length ? 'En el orden en que conviene configurarlas.' : 'No le falta configurar ninguna tab de su plan.' });
    },
  },

  listar_avatares_negocio: {
    leer: async () => {
      const [avatares, contexto] = await Promise.all([getAvatares(), getContextoAvatares()]);
      return json({ avatares, precisado_por_el_dueno: contexto.trim() || null, nota: avatares.length ? undefined : 'El negocio todavía no tiene avatares.' });
    },
  },

  siguiente_pregunta_avatares: {
    leer: async (input) => {
      const r = await siguientePreguntaAvatares(respuestasDe(input.historial));
      if (!r.ok) return errorLectura(r.error);
      return json(r.terminado ? { terminado: true } : { terminado: false, pregunta: r.pregunta });
    },
  },

  listar_lead_magnets: {
    leer: async () => {
      const lista = await getEntregables();
      return json({ lead_magnets: lista.map((e) => ({ ...e, enlace: e.enlace ?? null })), nota: lista.length ? undefined : 'El negocio todavía no tiene lead magnets.' });
    },
  },

  siguiente_pregunta_lead_magnet: {
    leer: async (input) => {
      const r = await siguientePreguntaEntregable(respuestasDe(input.historial));
      if (!r.ok) return errorLectura(r.error);
      return json(r.terminado ? { terminado: true } : { terminado: false, pregunta: r.pregunta });
    },
  },

  ver_cara_de_marca: {
    leer: async (input) => {
      if (input.conLinks === true) {
        const e = await personaEstado();
        return json({ descripcion: e.descripcion || null, fotos: e.fotos.map((f) => ({ id: f.id, nombre: f.nombre, url: f.url, vence_en_horas: 6 })) });
      }
      const p = await getPersona();
      return json({ descripcion: p.descripcion || null, fotos: p.fotos.map((f) => ({ id: f.id, nombre: f.nombre })), nota: 'La cara de los creativos; no afirmes que es el dueño.' });
    },
  },

  ver_personalidad_voz: {
    leer: async () => {
      const p = await getPersonalidad();
      const respuestas = PERSONALIDAD_PREGUNTAS.filter((q) => p.respuestas[q.key]).map((q) => ({ key: q.key, dimension: q.dimension, rasgo: p.respuestas[q.key].rasgo, frase: p.respuestas[q.key].texto || null }));
      return json({ respuestas, muletillas: p.muletillas || null, contestadas: respuestas.length, total: PERSONALIDAD_PREGUNTAS.length, completa: personalidadCompleta(p) });
    },
  },

  ver_pregunta_personalidad: {
    leer: async (input) => {
      const idx = Number(input.idx);
      const total = PERSONALIDAD_PREGUNTAS.length;
      if (!Number.isInteger(idx) || idx < 0 || idx >= total) return errorLectura(`El quiz tiene ${total} preguntas: idx va de 0 a ${total - 1}.`);
      const q = input.personalizar === true ? await personalizarPregunta(idx) : PERSONALIDAD_PREGUNTAS[idx];
      return json({ idx, total, pregunta: q, nota: 'Para guardar, copia el `rasgo` EXACTO de la opción elegida.' });
    },
  },

  buscar_en_segundo_cerebro: {
    leer: async (input) => {
      // El grafo de los chats (lib/cerebro-para-chat.ts): sin física, en caché, y en la plataforma con sus funciones.
      const cerebro = await grafoParaChat();
      const area = str(input, 'area') as AreaId | '';
      const nodos = nodosDeDatos(cerebro.nodos).filter((n) => !area || n.area === area);
      const texto = str(input, 'texto');
      if (!texto) {
        const areas = AREAS_CEREBRO.filter((a) => !area || a.id === area).map((a) => {
          const deArea = nodos.filter((n) => n.area === a.id);
          return { id: a.id, nombre: a.nombre, que: a.que, datos: deArea.filter((n) => n.autoria !== 'pendiente').length, pendientes: deArea.filter((n) => n.autoria === 'pendiente').length };
        });
        return json({ negocio: cerebro.negocio, areas });
      }
      const campos = (Array.isArray(input.campos) && input.campos.length ? input.campos : ['nombre']) as CampoCerebro[];
      const hallados = nodos.filter((n) => matchNodo(n, texto, campos));
      const nombreArea = (id: string) => (cerebro.taxonomia?.areas ?? AREAS_CEREBRO).find((a) => a.id === id)?.nombre ?? id;
      return json({
        resultados: hallados.slice(0, TOPE_RESULTADOS_CEREBRO).map((n) => ({
          id: n.id, area: nombreArea(n.area), etiqueta: n.etiqueta, detalle: recorte(n.detalle, 600), fuente: n.fuente || null,
          quien: n.autoria === 'mako' ? 'lo dedujo MaKo' : n.autoria === 'usuario' ? 'lo escribió el dueño' : 'todavía no existe',
          // ⚠️ DÓNDE SE EDITA ESTE DATO. El nodo YA lo trae (`href`/`abrirEn`,
          // lib/cerebro-modelo.ts:193) y la barra lateral del grafo lo usa desde siempre, pero esta
          // proyección lo tiraba: MaKo leía el dato y no veía la pantalla que lo edita. Por eso le
          // contestó a Leila «la ruta exacta para editar esos datos no la tengo confirmada, y
          // prefiero no inventarte un menú que no existe» (ticket #48, 3/11/2026) sobre algo que
          // tenía en la mano. Sus tickets #46, #47 y #48 —treinta minutos— salen todos de acá.
          // Un dato sin su pantalla obliga a MaKo a elegir entre inventar una ruta o decir «no sé»,
          // y las dos respuestas son malas.
          se_edita_en: n.href ? { pantalla: n.abrirEn ?? null, link: n.href } : null,
          datos: (n.datos ?? []).filter((d) => d.v?.trim()).map((d) => ({ [d.k]: recorte(d.v, 300) })),
        })),
        total: hallados.length,
        quedaron_afuera: Math.max(0, hallados.length - TOPE_RESULTADOS_CEREBRO),
        buscado_en: campos,
      });
    },
  },

  leer_segundo_cerebro_como_archivos: {
    leer: async (input) => {
      const pedidas = Array.isArray(input.areas) ? (input.areas as string[]) : [];
      const areas = (pedidas.length ? pedidas : AREAS_CEREBRO.map((a) => a.id)) as AreaId[];
      const archivos = construirVault(await construirCerebro(), areas);
      let md = '';
      const afuera: string[] = [];
      for (const a of archivos) {
        const bloque = `\n\n---\n## ${a.ruta}\n\n${a.texto}`;
        if (md.length + bloque.length > TOPE_VAULT_CHARS) { afuera.push(a.ruta); continue; }
        md += bloque;
      }
      const pie = afuera.length
        ? `\n\n---\n_Se cortó en ${TOPE_VAULT_CHARS} caracteres. Quedaron afuera ${afuera.length} de ${archivos.length} archivos: ${afuera.join(', ')}. Pídelos con menos áreas._\n`
        : '';
      return `# Segundo cerebro (${archivos.length} archivos)${md}${pie}`;
    },
  },

  indice_segundo_cerebro: {
    leer: async () => indiceDelCerebro(await grafoParaChat()),
  },

  recuperar_del_segundo_cerebro: {
    leer: async (input) => {
      const ids = Array.isArray(input.ids) ? (input.ids as unknown[]).map(String) : [];
      // Un id `ref:<gurú>:<video>` es una clase del curso de un referente (lib/cerebro-referente.ts): su
      // capa no está en el grafo del negocio, así que se cuelga acá, sólo cuando se la pide (3/11/2026).
      const p = recuperar(await conLosCursosDe(await grafoParaChat(), ids), {
        pregunta: str(input, 'pregunta'),
        ids,
        profundidad: typeof input.profundidad === 'number' ? input.profundidad : undefined,
        presupuesto: typeof input.presupuesto === 'number' ? input.presupuesto : undefined,
      });
      return `${p.texto}\n\n_${p.modo === 'indice' ? 'La pregunta no nombra ningún dato: va el índice.' : `${p.nodos.length} datos, ~${p.tokens} tokens.`}_`;
    },
  },

  ver_glosario_negocio: {
    leer: async () => {
      const g = await glosarioPropio();
      return json({ terminos: g.terminos, total: g.terminos.length, ...(g.recortado ? { nota: 'Se muestran los primeros 500 términos; hay más.' } : {}) });
    },
  },

  // Heredadas de MAKO_TOOLS → runMakoTool con el MISMO nombre (misma salida de siempre).
  buscar_conocimiento: { leer: (input) => runMakoTool('buscar_conocimiento', input) },
  buscar_tutorial: { leer: (input) => runMakoTool('buscar_tutorial', input) },

  // ── Acción por chat ─────────────────────────────────────────────────────────
  responder_pregunta_personalidad: {
    preparar: seguro(async (input) => {
      const key = str(input, 'key');
      const q = PERSONALIDAD_PREGUNTAS.find((p) => p.key === key);
      if (!q) return { error: `No existe la pregunta «${key}».`, disponibles: PERSONALIDAD_PREGUNTAS.map((p) => p.key) };
      const rasgo = str(input, 'rasgo');
      // normalizarPersonalidad descarta EN SILENCIO un rasgo que no sea idéntico: se valida aquí.
      if (!q.opciones.some((o) => o.rasgo === rasgo)) return { error: 'Ese rasgo no es uno de los de esta pregunta: cópialo tal cual de la opción elegida.', disponibles: q.opciones.map((o) => o.rasgo) };
      const texto = str(input, 'texto').slice(0, 300);
      return { payload: { key, rasgo, texto }, resumen: `Guardar en el quiz de voz («${q.dimension}»): ${rasgo}${texto ? ` — «${texto}»` : ''}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const key = String(payload.key ?? '');
      const actual = await personalidadParaEscribir();
      const nueva = await setPersonalidad({ ...actual, respuestas: { ...actual.respuestas, [key]: { rasgo: String(payload.rasgo ?? ''), texto: String(payload.texto ?? '') } } });
      if (!nueva.respuestas[key]) return { ok: false, resumen: 'El rasgo no coincide con el catálogo actual del quiz; no se guardó.' };
      const contestadas = Object.keys(nueva.respuestas).length;
      return { ok: true, resumen: `Respuesta guardada (${contestadas} de ${PERSONALIDAD_PREGUNTAS.length} contestadas).`, datos: { contestadas, completa: personalidadCompleta(nueva) } };
    }),
  },

  // ── Acciones por pantalla (genérica /mako/revisar) ─────────────────────────
  guardar_campo_perfil: {
    preparar: seguro(async (input, ctx) => {
      const key = str(input, 'key');
      const valor = str(input, 'valor');
      const campos = await camposPerfil(ctx.ws);
      const campo = campos.find((c) => c.key === key);
      if (!campo) return { error: `«${key}» no es un campo del perfil de este negocio.`, disponibles: campos.map((c) => c.key) };
      if (!valor) return { error: 'Falta el valor.', faltan: ['valor'] };
      // Ticket #46/#48 (3/11/2026): mandaba a «Documentos»; el precio y lo que incluye se leen y se corrigen en «El brief».
      if (await campoOcupado(key)) { const d = datoDeCampo(key); return { error: `«${campo.pregunta}» ya tiene valor. Lo corriges tocándolo en ${d ? lugarDato(d) : lugarSeccion('archivero')}${d ? ` (${linkApp(rutaDato(d), ctx.ws)})` : ''}, no por aquí.` }; }
      return { payload: { key, valor }, resumen: `Completar en el perfil «${campo.pregunta}»: ${valor.slice(0, 200)}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      // La key se revalida contra el esquema: la pantalla guardó el input y pudo pasar tiempo.
      const key = String(payload.key ?? '');
      const esquema = (await getSchema()).flatMap((g) => g.fields.map((f) => f.key));
      if (!esquema.includes(key)) return { ok: false, resumen: 'Ese campo ya no existe en el perfil.' };
      const r = await completarHuecoPerfil(key, String(payload.valor ?? ''));
      return r.ok ? { ok: true, resumen: 'Campo del perfil completado.' } : { ok: false, resumen: `No se guardó: ${r.motivo}.` };
    }),
  },

  borrar_documento_archivero: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const f = await getFile(id);
      if (!f) return { error: 'No existe un documento con ese id en este negocio. Pide la lista con ver_archivero.' };
      const aporta = Object.keys(f.campos ?? {}).length;
      return { payload: { id }, resumen: `Borrar del Archivero «${f.nombre}» (aportó ${aporta} campo${aporta === 1 ? '' : 's'} del perfil). No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const r = await borrarDocumentoArchivero(String(payload.id ?? ''));
      if (!r.ok) return { ok: false, resumen: `No se borró: ${r.motivo}.` };
      return { ok: true, resumen: `Documento borrado y perfil recalculado${r.panoramaVaciado ? '; era el último, así que el resumen del negocio quedó vacío' : ''}.` };
    }),
  },

  guardar_diagnostico_fase: {
    preparar: seguro(async (input) => {
      const crudas = Array.isArray(input.respuestas) ? (input.respuestas as string[]) : [];
      if (crudas.length !== PREGUNTAS.length) return { error: `Hacen falta exactamente ${PREGUNTAS.length} respuestas, una por pregunta y en orden (llegaron ${crudas.length}).`, faltan: ['respuestas'] };
      const respuestas = crudas.map((x) => Number(x));
      const canalPedido = str(input, 'canal');
      const canal = (canalPedido || (await getDiagnosticoFase())?.canal || '') as CanalId | '';
      if (canal && !CANALES.some((c) => c.id === canal)) return { error: `Canal desconocido: ${canal}.`, disponibles: CANALES.map((c) => c.id) };
      const f = faseDef(diagnosticar(respuestas).fase);
      return {
        payload: { respuestas, canal: canal || null },
        resumen: `Guardar el diagnóstico de fase: queda en Fase ${f.id} (${f.nombre}), cuello «${f.cuelloLabel}»${canal ? `, canal ${canal}` : ', sin canal'}.`,
      };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const respuestas = Array.isArray(payload.respuestas) ? payload.respuestas.map(Number) : [];
      if (respuestas.length !== PREGUNTAS.length || respuestas.some((n) => !Number.isInteger(n) || n < 0 || n > 4)) return { ok: false, resumen: 'Las respuestas no son válidas.' };
      const canal = typeof payload.canal === 'string' && CANALES.some((c) => c.id === payload.canal) ? (payload.canal as CanalId) : undefined;
      const d = await setDiagnosticoFase(respuestas, canal);
      const f = faseDef(d.fase);
      return { ok: true, resumen: `Diagnóstico guardado: Fase ${f.id} (${f.nombre}).`, datos: { fase: f.id, consistencia_pct: d.consistencia, mixto: d.mixto } };
    }),
  },

  generar_avatares: {
    preparar: seguro(async () => {
      const falta = await faltaBrief();
      if (falta) return { error: falta, faltan: ['perfil'] };
      const n = (await getAvatares()).length;
      return { payload: {}, resumen: n ? `Regenerar con MaKo los avatares del negocio: reemplaza los ${n} actuales (ids conservados por posición).` : 'Generar con MaKo los avatares del negocio.' };
    }),
    ejecutar: sinLanzar(async () => {
      const r = await regenerarAvatares();
      return r.ok ? { ok: true, resumen: `Avatares regenerados: ${r.nombres.join(', ')}.${await avisoQuitados(r.idsQuitados)}` } : { ok: false, resumen: r.error };
    }),
  },

  afinar_avatares: {
    preparar: seguro(async (input) => {
      const respuestas = respuestasDe(input.respuestas);
      if (!respuestas.length) return { error: 'Faltan las respuestas (pregunta y respuesta).', faltan: ['respuestas'] };
      const falta = await faltaBrief();
      if (falta) return { error: falta, faltan: ['perfil'] };
      return { payload: { respuestas }, resumen: `Sumar ${respuestas.length} respuesta${respuestas.length === 1 ? '' : 's'} sobre a quién le vende y regenerar los avatares.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const respuestas = respuestasDe(payload.respuestas);
      if (!respuestas.length) return { ok: false, resumen: 'No llegaron respuestas.' };
      const r = await regenerarAvatares(respuestas);
      return r.ok ? { ok: true, resumen: `Avatares afinados: ${r.nombres.join(', ')}.${await avisoQuitados(r.idsQuitados)}` } : { ok: false, resumen: `${r.error} Las respuestas no quedaron guardadas.` };
    }),
  },

  editar_avatar_negocio: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const patch: PatchAvatar = {};
      for (const k of ['nombre', 'segmento', 'senalesMeta', 'situacion', 'dolor'] as const) { const v = str(input, k); if (v) patch[k] = v; }
      if (!Object.keys(patch).length) return { error: 'No viene ningún dato para cambiar.', faltan: ['nombre', 'segmento', 'senalesMeta', 'situacion', 'dolor'] };
      if (id) {
        const av = (await getAvatares()).find((a) => a.id === id);
        if (!av) return { error: 'No existe un avatar con ese id.', disponibles: (await getAvatares()).map((a) => ({ id: a.id, nombre: a.nombre })) };
        return { payload: { id, ...patch }, resumen: `Editar el avatar «${av.nombre}»: ${Object.keys(patch).join(', ')}.` };
      }
      if (!patch.nombre) return { error: 'Para agregar un avatar hace falta el nombre.', faltan: ['nombre'] };
      return { payload: { ...patch }, resumen: `Agregar el avatar «${patch.nombre}».` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const patch: PatchAvatar = {};
      for (const k of ['nombre', 'segmento', 'senalesMeta', 'situacion', 'dolor'] as const) if (typeof payload[k] === 'string' && payload[k]) patch[k] = payload[k] as string;
      const r = await editarAvatar(typeof payload.id === 'string' && payload.id ? payload.id : null, patch);
      return r.ok ? { ok: true, resumen: payload.id ? 'Avatar actualizado.' : 'Avatar agregado.', datos: { id: r.id } } : { ok: false, resumen: `No se guardó: ${r.motivo}.` };
    }),
  },

  borrar_avatar_negocio: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const [avatares, razones] = await Promise.all([getAvatares(), getRazones()]);
      const av = avatares.find((a) => a.id === id);
      if (!av) return { error: 'No existe un avatar con ese id.', disponibles: avatares.map((a) => ({ id: a.id, nombre: a.nombre })) };
      const huerfanas = razones.filter((r) => r.avatarId === id).length;
      return { payload: { id }, resumen: `Borrar el avatar «${av.nombre}». ${huerfanas} razón${huerfanas === 1 ? '' : 'es'} de compra quedan sin avatar. No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const r = await borrarAvatar(String(payload.id ?? ''));
      return r.ok ? { ok: true, resumen: 'Avatar borrado.' } : { ok: false, resumen: `No se borró: ${r.motivo}.` };
    }),
  },

  generar_lead_magnets: {
    preparar: seguro(async (input) => {
      const respuestas = respuestasDe(input.respuestas);
      const falta = await faltaBrief();
      if (falta) return { error: falta, faltan: ['perfil'] };
      const actuales = await getEntregables();
      const conEnlace = actuales.filter((e) => e.enlace || e.pieza).length;
      return {
        payload: { respuestas },
        resumen: `Generar lead magnets con MaKo${respuestas.length ? ` usando ${respuestas.length} respuesta${respuestas.length === 1 ? '' : 's'}` : ''}: reemplaza ${actuales.length - conEnlace} y conserva ${conEnlace} con link o con su pieza armada.`,
      };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const r = await regenerarLeadMagnets(respuestasDe(payload.respuestas));
      return r.ok ? { ok: true, resumen: `Lead magnets generados: ${r.nuevos} nuevos, ${r.conservados} conservados (con link o con su pieza).` } : { ok: false, resumen: r.error };
    }),
  },

  editar_lead_magnet: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const patch: PatchLeadMagnet = {};
      for (const k of ['nombre', 'tipo', 'queEs', 'fomo', 'enlace'] as const) { const v = str(input, k); if (v) patch[k] = v; }
      if (!Object.keys(patch).length) return { error: 'No viene ningún dato para cambiar.', faltan: ['nombre', 'tipo', 'queEs', 'fomo', 'enlace'] };
      if (patch.enlace && !/^https?:\/\//i.test(patch.enlace)) return { error: 'El enlace tiene que empezar con http:// o https://.' };
      const lista = await getEntregables();
      const lm = lista.find((e) => e.id === id);
      if (!lm) return { error: 'No existe un lead magnet con ese id.', disponibles: lista.map((e) => ({ id: e.id, nombre: e.nombre })) };
      return { payload: { id, ...patch }, resumen: `Editar el lead magnet «${lm.nombre}»: ${Object.keys(patch).join(', ')}.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const patch: PatchLeadMagnet = {};
      for (const k of ['nombre', 'tipo', 'queEs', 'fomo', 'enlace'] as const) if (typeof payload[k] === 'string' && payload[k]) patch[k] = payload[k] as string;
      if (patch.enlace && !/^https?:\/\//i.test(patch.enlace)) return { ok: false, resumen: 'El enlace tiene que empezar con http:// o https://.' };
      const r = await editarLeadMagnet(String(payload.id ?? ''), patch);
      return r.ok ? { ok: true, resumen: r.aviso ? `Lead magnet actualizado. ${r.aviso}` : 'Lead magnet actualizado.' } : { ok: false, resumen: `No se guardó: ${r.motivo}` };
    }),
  },

  sugerir_productos: {
    preparar: seguro(async () => {
      const falta = await faltaBriefProductos();
      if (falta) return { error: falta, faltan: ['perfil'] };
      const n = (await listProductos()).length;
      return { payload: {}, resumen: `Armar el catálogo con MaKo: crea los productos nuevos INACTIVOS (su precio lo propone MaKo y hay que revisarlo en /crm antes de activarlos) y completa los campos vacíos de los ${n} existentes, sin pisar nada.` };
    }),
    ejecutar: sinLanzar(async () => {
      const r = await sugerirProductos();
      if (!r.ok) return { ok: false, resumen: r.error };
      const a = await aplicarSugerenciasProductos(r.productos);
      return { ok: true, resumen: `Catálogo armado: ${a.creados} productos nuevos y ${a.completados} completados. Los nuevos quedan inactivos hasta que revises su precio en /crm y los actives.`, datos: a };
    }),
  },

  borrar_producto: {
    preparar: seguro(async (input) => {
      const id = Number(input.id);
      const prods = await listProductos();
      const p = prods.find((x) => x.id === id);
      if (!p) return { error: 'No existe un producto con ese id en este negocio. Pide la lista con listar_productos.' };
      // ⚠️ LA CONSECUENCIA ENTERA, Y ANTES DEL CLICK. Desde la migración 0188, borrar un
      // producto se lleva por cascada su tablero de entrega y la etapa en la que está
      // CADA cliente: el resumen decía la verdad y le faltaba la mitad más cara, que es
      // justo lo que esta pantalla existe para que alguien vea antes de confirmar.
      // (El historial de cada movimiento sobrevive: `lead_audit` no tiene FK al producto.)
      const cola = fraseEntregaAlBorrar(await cuantosEnEntrega(id));
      return { payload: { id }, resumen: `Borrar el producto «${p.nombre}»${p.monto_usd != null ? ` (USD ${p.monto_usd})` : ''}. No se puede deshacer.${cola}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const id = Number(payload.id);
      if (!(await listProductos()).some((x) => x.id === id)) return { ok: false, resumen: 'El producto ya no existe.' };
      await deleteProducto(id);
      return { ok: true, resumen: 'Producto borrado.' };
    }),
  },

  guardar_descripcion_cara_de_marca: {
    preparar: seguro(async (input) => {
      const descripcion = str(input, 'descripcion');
      if (!descripcion) return { error: 'Falta la descripción.', faltan: ['descripcion'] };
      const actual = (await getPersona()).descripcion;
      return { payload: { descripcion }, resumen: `Reemplazar la descripción física de la cara de marca${actual ? ' (la anterior se pierde)' : ''}: «${descripcion.slice(0, 160)}${descripcion.length > 160 ? '…' : ''}»` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      await guardarDescripcionPersona(String(payload.descripcion ?? ''));
      return { ok: true, resumen: 'Descripción de la cara de marca guardada.' };
    }),
  },

  borrar_foto_cara_de_marca: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const foto = (await getPersona()).fotos.find((f) => f.id === id);
      if (!foto) return { error: 'No existe una foto con ese id. Pide la lista con ver_cara_de_marca.' };
      return { payload: { id }, resumen: `Borrar la foto «${foto.nombre}» de la cara de marca. No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      if (!(await borrarFotoPersona(String(payload.id ?? '')))) return { ok: false, resumen: 'La foto ya no existe.' };
      return { ok: true, resumen: 'Foto borrada. La descripción física no se recalculó.' };
    }),
  },

  guardar_muletillas_marca: {
    preparar: seguro(async (input) => {
      const muletillas = str(input, 'muletillas').slice(0, 500);
      if (!muletillas) return { error: 'Faltan las muletillas.', faltan: ['muletillas'] };
      const antes = (await getPersonalidad()).muletillas.trim();
      return { payload: { muletillas }, resumen: `Guardar las muletillas de la marca: «${muletillas.slice(0, 200)}»${antes ? ` (reemplaza: «${antes.slice(0, 200)}»)` : ''}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const actual = await personalidadParaEscribir();
      await setPersonalidad({ ...actual, muletillas: String(payload.muletillas ?? '') });
      return { ok: true, resumen: 'Muletillas guardadas.' };
    }),
  },

  reiniciar_personalidad: {
    preparar: seguro(async () => {
      const p = await getPersonalidad();
      const n = Object.keys(p.respuestas).length;
      return { payload: {}, resumen: `Reiniciar el quiz de voz: se borran ${n} respuesta${n === 1 ? '' : 's'}${p.muletillas ? ' y las muletillas' : ''}. No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async () => {
      await setPersonalidad({ respuestas: {}, muletillas: '' });
      return { ok: true, resumen: 'Quiz de voz reiniciado.' };
    }),
  },

  // ── El onboarding desde afuera (P0-12 y P0-13, 23/10/2026) ──────────────────────────────────────────────────
  // ⚠️ El arranque se cierra por SU puerta (`cerrarPasosOnboarding`, la misma del wizard y del chat de arranque), con los
  // pasos de la capa leídos acá: nunca escribe `onboarding.state` a mano ni toca `onboarding.arranque`.
  cerrar_paso_onboarding: {
    preparar: seguro(async (input, ctx) => {
      const { r } = await revisarCierre(input, ctx.ws);
      return 'error' in r ? comoError(r) : { payload: { paso: input.paso, cierre: input.cierre }, resumen: r.resumen };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const x = await revisarCierre(payload, ctx.ws);
      if ('error' in x.r) return x.r.yaEstaba ? { ok: true, resumen: `Ya estaba así: ${x.r.error}` } : { ok: false, resumen: `No se cerró: ${x.r.error}` };
      const estado = await cerrarPasosOnboarding([x.r.cambio], ctx.actor?.trim() || 'MaKo (API)', undefined, x.capa!.onboarding);
      const rot = `«${ROTULO_PASO_ONBOARDING[x.paso!]}»`;
      const hecho = x.cierre === 'hecho' ? `${rot} quedó cerrado.` : `${rot} quedó para después.`;
      return { ok: true, resumen: `${hecho}${estado.status === 'done' && x.r.terminaElArranque ? ' El arranque terminó: la persona entra directo a la app.' : ''}`, datos: { estado: estado.status } };
    }),
  },

  // ⚠️ Desmarcar va por `desmarcarPasoEnTodasLasTabs`: el paso vive en el estado de la tab Y en el registro compartido
  // (onboarding.tab.pasos), y `marcarPasoTab(…, false)` en una sola tab deja vivo el de las otras (AGENTS.md, «el
  // BORRADO va por una función»). Y en el Copy Generator corre antes el puente de una sola vez (`puentearPasosCopyGen`):
  // si todavía no corrió, la próxima carga de la tab volvería a marcar lo que se acaba de desmarcar. Al PROPONER no
  // corre (proponer no escribe), así que en un negocio donde nunca corrió el resumen se arma con los pasos de antes del
  // puente: el «sí» vuelve a revisar todo con el puente ya corrido. Es un caso estrecho (revisión del 23/10/2026).
  marcar_paso_onboarding_tab: {
    preparar: seguro(async (input, ctx) => {
      const { r } = await revisarMarcaTab(input, ctx.ws);
      return 'error' in r ? comoError(r) : { payload: { tab: input.tab, paso: input.paso, hecho: input.hecho !== false }, resumen: r.resumen };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const x = await revisarMarcaTab(payload, ctx.ws);
      if ('error' in x.r) return x.r.yaEstaba ? { ok: true, resumen: `Ya estaba así: ${x.r.error}` } : { ok: false, resumen: `No se cambió: ${x.r.error}` };
      if (x.hecho) {
        const s = await marcarPasoTab(x.tab, x.paso, true);
        return { ok: true, resumen: x.r.resumen.replace(/^Marcar (.+?) como hecho/, '$1 quedó hecho'), datos: { tab: x.tab, estado: s.status } };
      }
      if (x.tab === 'ads-writer') await puentearPasosCopyGen();
      await desmarcarPasoEnTodasLasTabs(x.paso);
      const s = await getEstadoTab(x.tab);
      return { ok: true, resumen: x.r.resumen.replace(/^Desmarcar (.+?)\.(?= |$)/, '$1 quedó sin hacer.'), datos: { tab: x.tab, estado: s.status } };
    }),
  },

  // ── El catálogo de ofertas (P0-14, 23/10/2026) ──────────────────────────────────────────────────────────────
  // ⚠️ listar_ofertas NO siembra la oferta principal desde el perfil, como sí hace el GET de la pantalla
  // (`seedOfertaDesdeBrief`): una lectura no escribe. Sin ofertas, dice cuál es la del perfil.
  listar_ofertas: {
    leer: async (_input, ctx) => {
      const [ofertas, ligasFunnel, ligasProducto, funnels, productos, answers] = await Promise.all([
        listarOfertas(), ofertasDeFunnels(), productosDeOfertas(), leerFunnels().catch(() => null), listProductos(), respuestasDelPerfil(),
      ]);
      const nombreFunnel = new Map((funnels ?? []).map((f) => [f.id, (f.producto ?? '').trim() || f.nombre]));
      const nombreProducto = new Map(productos.map((p) => [p.id, p.nombre]));
      const hoy = new Date();
      if (!ofertas.length) {
        const delPerfil = resolverOfertaPrincipal(null, answers).campos;
        return json({
          ofertas: [],
          se_editan_en: { ofertas: dondeSeEdita('ofertas', ctx.ws), lo_que_usa_mako: dondeSeEdita('brief', ctx.ws) },
          oferta_del_perfil: delPerfil.nombre ? delPerfil : null,
          nota: delPerfil.nombre
            ? 'Todavía no hay ofertas guardadas: MaKo usa la oferta del perfil del negocio (oferta_del_perfil). Se guarda como oferta con guardar_oferta.'
            : 'El negocio todavía no tiene ofertas.',
        });
      }
      return json({
        se_editan_en: { ofertas: dondeSeEdita('ofertas', ctx.ws), lo_que_usa_mako: dondeSeEdita('brief', ctx.ws) },
        ofertas: ofertas.map((o) => {
          // En la que sale del perfil, los cinco campos del perfil se leen de ahí (la misma regla que usan los prompts).
          const c = o.desde_brief ? resolverOfertaPrincipal(o, answers).campos : null;
          return {
            id: o.id, nombre: o.nombre, principal: o.es_principal, activa: o.activa,
            sale_del_perfil: o.desde_brief,
            precio: c ? (c.precio || null) : (precioTexto(o) || null), precio_usd: o.precio_usd, modelo: o.modelo ?? null,
            promesa: c ? (c.promesa || null) : o.promesa, incluye: c ? (c.incluye || null) : o.incluye, garantia: c ? (c.garantia || null) : o.garantia,
            para_quien: o.para_quien, objeciones: o.objeciones, prueba: o.prueba, bonos: o.bonos,
            urgencia: urgenciaTexto(o, hoy) || null,
            urgencia_vigente: urgenciaVigente(o, hoy),
            funnels: ligasFunnel.filter((l) => l.oferta_id === o.id).map((l) => ({ id: l.funnel_id, nombre: nombreFunnel.get(l.funnel_id) ?? null, principal_del_funnel: l.es_principal })),
            productos: ligasProducto.filter((l) => l.oferta_id === o.id).map((l) => ({ id: l.producto_id, nombre: nombreProducto.get(l.producto_id) ?? null, rol: l.rol })),
          };
        }),
        nota: '`sale_del_perfil`: promesa, precio, incluye y garantía vienen del perfil del negocio y se corrigen ahí. `urgencia_vigente: null` = no se puede comprobar (sólo una fecha se puede). `nombre: null` en un funnel = no se pudo leer su nombre.',
      });
    },
  },

  guardar_oferta: {
    preparar: seguro(async (input) => {
      const x = await revisarOferta(input);
      if ('error' in x) return x;
      const { actual, resultado, cambios, ofertas } = x;
      const rot: Record<string, string> = { nombre: 'nombre', modelo: 'cómo se cobra', precio_usd: 'precio', precio_nota: 'precio como se presenta', promesa: 'promesa', incluye: 'qué incluye', garantia: 'garantía', para_quien: 'para quién', objeciones: 'objeciones', prueba: 'prueba', bonos: 'bonos', urgencia_tipo: 'urgencia', urgencia_dato: 'urgencia', urgencia_razon: 'urgencia', urgencia_hasta: 'urgencia', activa: 'si está activa' };
      const campos = [...new Set(Object.keys(cambios).map((k) => rot[k] ?? k))];
      const precio = resultado.precio_nota || (resultado.precio_usd != null ? `USD ${resultado.precio_usd}` : '');
      let resumen = actual
        ? `Editar la oferta «${actual.nombre}»: ${campos.join(', ')}.${typeof cambios.nombre === 'string' ? ` Pasa a llamarse «${resultado.nombre}».` : ''}`
        : `Crear la oferta «${resultado.nombre}»${precio ? ` (${precio})` : ''}.${ofertas.some((o) => o.es_principal) ? '' : ' Es la primera del negocio: queda como la principal.'}`;
      if (actual && (cambios.precio_usd !== undefined || cambios.precio_nota !== undefined)) resumen += ` Precio: ${precio || 'sin precio'}.`;
      // ⚠️ La oferta que sale del perfil: escribir esos campos en la fila NO cambia lo que MaKo usa para escribir
      // (`resolverOfertaPrincipal` los lee del perfil). Decirlo antes del «sí» es lo único honesto.
      if (actual?.desde_brief && Object.keys(cambios).some((k) => CAMPOS_DEL_PERFIL.includes(k))) {
        resumen += ` Ojo: esta oferta sale del perfil del negocio, y lo que MaKo usa para escribir (promesa, precio, incluye y garantía) sigue saliendo del perfil, que se corrige en ${lugarDato('brief')}.`;
      }
      return { payload: { id: actual?.id ?? null, nombre: actual ? undefined : resultado.nombre, ...cambios }, resumen };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const entrada: Record<string, unknown> = { ...payload };
      if (entrada.id == null) delete entrada.id;
      const x = await revisarOferta(entrada);
      if ('error' in x) return x.yaEstaba ? { ok: true, resumen: `Ya estaba así: ${x.error}` } : { ok: false, resumen: `No se guardó: ${x.error}` };
      const g = await guardarOferta(x.resultado, x.actual?.id);
      return {
        ok: true,
        resumen: `${x.actual ? 'Oferta actualizada' : 'Oferta creada'}: «${x.resultado.nombre}» (#${g.id}).${g.principal ? ' Quedó como la principal.' : ''}`,
        datos: { ofertaId: g.id, principal: g.principal },
      };
    }),
  },

  borrar_oferta: {
    preparar: seguro(async (input) => {
      const id = Number(input.id);
      const o = (await listarOfertas()).find((x) => x.id === id);
      if (!o) return { error: `No existe la oferta #${id} en este negocio. Pide la lista con listar_ofertas.` };
      const uso = await usoDeOferta(id);
      const n = (v: number | null, uno: string, varios: string) => (v == null ? null : `${v} ${v === 1 ? uno : varios}`);
      const leads = uso.leads == null ? ' No pude contar los leads que entraron por ella.' : uso.leads ? ` ${n(uso.leads, 'lead que entró por ella queda', 'leads que entraron por ella quedan')} sin oferta.` : '';
      const ligas = [n(uso.funnels, 'funnel', 'funnels'), n(uso.productos, 'producto', 'productos')].filter((v) => v && !v.startsWith('0 '));
      const principal = o.es_principal ? ' Es la principal: hasta que otra lo sea, MaKo vuelve a usar la oferta del perfil del negocio.' : '';
      return { payload: { id }, resumen: `Borrar la oferta «${o.nombre}».${leads}${ligas.length ? ` Se desliga de ${ligas.join(' y ')}.` : ''}${principal} No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const id = Number(payload.id);
      const o = (await listarOfertas()).find((x) => x.id === id);
      if (!o) return { ok: false, resumen: 'La oferta ya no existe.' };
      await borrarOferta(id);
      return { ok: true, resumen: `Oferta «${o.nombre}» borrada.` };
    }),
  },

  // ── Knowledge ─────────────────────────────────────────────────────────────
  modulos_de_knowledge: {
    leer: async () => {
      const { estadoDeLosModulos } = await import('@/lib/knowledge');
      const ms = await estadoDeLosModulos();
      return json({
        modulos: ms.map((m) => ({
          modulo: m.key, nombre: m.nombre, que: moduloDeKey(m.key)?.que ?? '',
          de_que_cursos: m.secciones, se_usa_en: m.tabs, fichas: m.fichas,
        })),
      });
    },
  },

  leer_modulo_knowledge: {
    leer: async (input) => {
      const key = String(input.modulo ?? '').trim();
      const m = moduloDeKey(key);
      // La key equivocada vuelve como REGLA con la lista, no como vacío: un '' acá se lee igual que «no hay material».
      if (!m) return `No existe el módulo «${key}». Los que hay: ${MODULOS_KNOWLEDGE.map((x) => x.key).join(', ')}.`;
      const { metodoDeModulo } = await import('@/lib/knowledge');
      const texto = await metodoDeModulo(key, String(input.pregunta ?? ''));
      if (!texto) return `El módulo «${m.nombre}» todavía no tiene fichas cargadas: no hay material para esta pregunta. No lo rellenes.`;
      return `## Knowledge › ${m.nombre}\n${m.que}\n\n${texto}`;
    },
  },
  // ── Sumar un documento desde un chat (ticket #44): la ingesta de lib/archivero-ingesta.ts, la misma de la pantalla ──
  sumar_documento_second_brain: {
    preparar: seguro(async (input, ctx) => {
      const { documentoDelChat, nombrePegado, caracteres } = await import('@/lib/chat-pegado');
      const { texto, cortado, nombre: delArchivo } = documentoDelChat(str(input, 'texto'));
      if (texto.length < MIN_DOCUMENTO) return { error: 'Eso es muy corto para ser un documento: pídele que lo pegue o lo adjunte entero.' };
      const nombre = (str(input, 'nombre') || delArchivo || nombrePegado(texto, 60)).slice(0, 120);
      const { listFiles } = await import('@/lib/archivero');
      const { idDeContenido, documentoYaArchivado, camposDelModelo } = await import('@/lib/archivero-registro');
      const bytes = new TextEncoder().encode(texto);
      if (documentoYaArchivado(await listFiles(), { id: idDeContenido(ctx.ws, bytes), nombre, tamano: bytes.byteLength })) {
        return { error: `«${nombre}» ya está en el Second Brain: no se vuelve a guardar.`, yaEstaba: true };
      }

      const { conQueSeExtrae, camposDeExtraccion } = await import('@/lib/archivero-ingesta');
      const corte = cortado ? ' ⚠️ Llegó CORTADO: se guarda lo que llegó; pídele el resto y súmalo como otro documento.' : '';
      if ((await conQueSeExtrae(ctx.ws)) === 'servidor') {
        return {
          payload: { nombre, texto, ...(cortado ? { cortado: true } : {}) },
          resumen: `Sumar «${nombre}» al Second Brain (${caracteres(texto)}): MaKo saca de ahí lo que va en tu perfil al guardarlo. Lo que editaste a mano no se toca.${corte}`,
        };
      }
      // Su Claude en la computadora y ninguna clave: el servidor no tiene con qué extraer (D6b). Lo extrae el modelo del
      // turno, que es SU IA, con las claves del perfil; lo que no es una clave del perfil no entra.
      const fields = await camposDeExtraccion();
      const rotulo = new Map(fields.map((f) => [f.key, f.label]));
      if (!Array.isArray(input.campos) || !input.campos.length) {
        return { error: 'Este negocio usa su propio Claude, así que lo lees tú: saca del documento lo que va en el perfil con estas claves (sólo lo que dice) y vuelve a llamarla con `campos` y `resumen`.', disponibles: fields };
      }
      const campos = camposDelModelo(input.campos, new Set(rotulo.keys()));
      const n = Object.keys(campos).length;
      if (!n) return { error: 'Ninguna de esas claves es del perfil: usa las de `disponibles`.', disponibles: fields };
      return {
        payload: { nombre, texto, campos, resumen: str(input, 'resumen').slice(0, 2000), ...(cortado ? { cortado: true } : {}) },
        resumen: `Sumar «${nombre}» al Second Brain (${caracteres(texto)}) con ${n} dato${n === 1 ? '' : 's'} para tu perfil: ${Object.keys(campos).map((k) => rotulo.get(k)).join('; ')}. Lo que editaste a mano no se toca.${corte}`,
      };
    }),
    ejecutar: sinLanzar(async (payload, ctx) => {
      const { sumarTextoAlArchivero } = await import('@/lib/archivero-ingesta');
      const { conSuIADelNegocio } = await import('@/lib/ia-del-negocio');
      const nombre = String(payload.nombre ?? '');
      const texto = String(payload.texto ?? '');
      const campos = payload.campos && typeof payload.campos === 'object' && !Array.isArray(payload.campos)
        ? Object.fromEntries(Object.entries(payload.campos as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]))
        : null;
      // Sin `campos` extrae el servidor, y adentro de D6b: con su clave, nunca con la red gratis.
      const r = campos
        ? await sumarTextoAlArchivero(ctx.ws, { nombre, texto, extraido: { campos, razonamiento: String(payload.resumen ?? '') } })
        : await conSuIADelNegocio(ctx.ws, () => sumarTextoAlArchivero(ctx.ws, { nombre, texto }));
      if (!r.ok) return { ok: false, resumen: `No se guardó: ${r.motivo}.` };
      if (r.yaEstaba) return { ok: true, resumen: `«${r.nombre}» ya estaba en el Second Brain: no se guardó dos veces.`, datos: { id: r.id } };
      const corte = payload.cortado ? ' Llegó cortado: falta el resto, que se suma como otro documento.' : '';
      return { ok: true, resumen: `«${r.nombre}» quedó en el Second Brain (El Archivero) y aportó ${r.aportadas} dato${r.aportadas === 1 ? '' : 's'} a tu perfil.${corte}`, datos: { id: r.id, aportadas: r.aportadas } };
    }),
  },

  // ── La marca (5/11/2026, lib/marca/kits.ts) ──
  ver_kits_marca: {
    leer: async (_input, ctx) => {
      const { leerKitsEstricto } = await import('@/lib/marca/kits-server');
      const k = await leerKitsEstricto().catch(() => null);
      if (!k) return errorLectura('No pude leer la marca del negocio. Vuelve a intentar.');
      const donde = { lugar: lugarSeccion('marca'), link: linkApp(rutaSeccion('marca'), ctx.ws) };
      if (!k.kits.length) return json({ kits: [], donde, nota: 'Todavía no hay kits: se sube el manual de marca ahí, o se arma uno con guardar_kit_marca.' });
      return json({
        kits: k.kits.map((x) => ({
          id: x.id, nombre: x.nombre, porDefecto: x.id === k.porDefecto, colores: x.colores, fuentes: x.fuentes,
          logo: x.logo ? { subidoId: x.logo.subidoId, nombre: x.logo.nombre } : null, origen: x.origen, resumen: resumenDeKit(x),
        })),
        donde,
      });
    },
  },

  guardar_kit_marca: {
    preparar: seguro(async (input) => {
      const { leerKitsEstricto, logoDeSubido, nuevoIdKit } = await import('@/lib/marca/kits-server');
      const k = await leerKitsEstricto();
      const id = str(input, 'id');
      const antes = id ? k.kits.find((x) => x.id === id) ?? null : null;
      if (id && !antes) return { error: 'Ese kit no existe: los que hay están en `disponibles`.', disponibles: k.kits.map((x) => ({ id: x.id, nombre: x.nombre })) };
      let logo = antes?.logo ?? null;
      const logoId = str(input, 'logo_subido_id');
      if (input.sin_logo === true) logo = null;
      else if (logoId) {
        logo = await logoDeSubido(logoId);
        if (!logo) return { error: 'Ese logo no es una imagen de «Subidos» de este negocio.' };
      }
      const fuente = (clave: string, actual: string | null) => (input[clave] === undefined ? actual : sanearFuente(input[clave]));
      const kit = sanearKit({
        id: antes?.id ?? nuevoIdKit(),
        nombre: str(input, 'nombre') || antes?.nombre || 'Mi marca',
        colores: Array.isArray(input.colores) ? input.colores : antes?.colores ?? [],
        fuentes: { titulos: fuente('fuente_titulos', antes?.fuentes.titulos ?? null), texto: fuente('fuente_texto', antes?.fuentes.texto ?? null) },
        logo,
        origen: antes?.origen ?? null,
      });
      if (!kit || !kitTieneAlgo(kit)) return { error: 'Un kit necesita al menos un color, una fuente o un logo.', faltan: ['colores'] };
      const porDefecto = input.por_defecto === true || !k.kits.length;
      const igual = antes && JSON.stringify({ ...antes, actualizado: '' }) === JSON.stringify({ ...kit, actualizado: '' });
      if (igual && (!porDefecto || k.porDefecto === antes.id)) return { error: `El kit «${antes.nombre}» ya está así.`, yaEstaba: true };
      return {
        payload: { kit, porDefecto, antes: antes?.actualizado ?? null },
        resumen: `${antes ? 'Cambiar' : 'Crear'} el kit de marca «${kit.nombre}»: ${resumenDeKit(kit)}${kit.colores.length ? ` (${kit.colores.map((c) => c.hex).join(', ')})` : ''}${porDefecto ? '. Queda por defecto' : ''}.`,
      };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const { cambiarKits } = await import('@/lib/marca/kits-server');
      const kit = sanearKit(payload.kit);
      if (!kit) return { ok: false, resumen: 'El kit no es válido.' };
      const antes = typeof payload.antes === 'string' ? payload.antes : null;
      const r = await cambiarKits((k) => {
        // Lo que se confirmó es el kit COMO ESTABA al proponer: si alguien lo cambió en el medio, no se pisa.
        const ahora = k.kits.find((x) => x.id === kit.id);
        if (antes && ahora && ahora.actualizado !== antes) return { ok: false, error: `El kit «${kit.nombre}» cambió desde que lo propuse: vuelve a pedirlo.` };
        if (antes && !ahora) return { ok: false, error: `El kit «${kit.nombre}» ya no existe.` };
        return conKit(k, { ...kit, actualizado: new Date().toISOString() }, { porDefecto: payload.porDefecto === true });
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Kit de marca «${kit.nombre}» guardado.`, datos: { id: kit.id } };
    }),
  },

  elegir_kit_marca: {
    preparar: seguro(async (input) => {
      const { leerKitsEstricto } = await import('@/lib/marca/kits-server');
      const k = await leerKitsEstricto();
      const kit = k.kits.find((x) => x.id === str(input, 'id'));
      if (!kit) return { error: 'Ese kit no existe: los que hay están en `disponibles`.', disponibles: k.kits.map((x) => ({ id: x.id, nombre: x.nombre })) };
      if (k.porDefecto === kit.id) return { error: `«${kit.nombre}» ya es el kit por defecto.`, yaEstaba: true };
      return { payload: { id: kit.id }, resumen: `Usar el kit «${kit.nombre}» por defecto en Image, Video y Web Generator.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const { cambiarKits } = await import('@/lib/marca/kits-server');
      const r = await cambiarKits((k) => conPorDefecto(k, String(payload.id ?? '')));
      return r.ok ? { ok: true, resumen: 'Kit por defecto cambiado.' } : { ok: false, resumen: r.error };
    }),
  },

  borrar_kit_marca: {
    preparar: seguro(async (input) => {
      const { leerKitsEstricto } = await import('@/lib/marca/kits-server');
      const k = await leerKitsEstricto();
      const kit = k.kits.find((x) => x.id === str(input, 'id'));
      if (!kit) return { error: 'Ese kit no existe: los que hay están en `disponibles`.', disponibles: k.kits.map((x) => ({ id: x.id, nombre: x.nombre })) };
      return { payload: { id: kit.id }, resumen: `Borrar el kit de marca «${kit.nombre}» (${resumenDeKit(kit) || 'vacío'}). No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const { cambiarKits } = await import('@/lib/marca/kits-server');
      const r = await cambiarKits((k) => sinKit(k, String(payload.id ?? '')));
      return r.ok ? { ok: true, resumen: 'Kit de marca borrado.' } : { ok: false, resumen: r.error };
    }),
  },
  ver_plantillas_oferta: {
    leer: async (input): Promise<SalidaLectura> => {
      const { PLANTILLAS_OFERTA, plantillaOferta, formaParaPrompt } = await import('@/lib/offer-plantillas');
      const linea = (p: (typeof PLANTILLAS_OFERTA)[number]) => ({
        id: p.id, nombre: p.nombre, cuando: p.cuando, grupo: p.grupo, forma: p.forma, preguntas: p.preguntas, chips: p.ficha.chips,
      });
      if (typeof input.id === 'string' && input.id.trim()) {
        const p = plantillaOferta(input.id.trim());
        if (!p) return JSON.stringify({ error: 'No existe esa plantilla.', disponibles: PLANTILLAS_OFERTA.map((x) => x.id) });
        return JSON.stringify({
          ...linea(p), forma_en_texto: formaParaPrompt(p),
          ejemplo: { negocio: `${p.negocio.nombre} (ficticio)`, oferta: p.ejemplo, ...(p.diagnostico ? { diagnostico: p.diagnostico.d } : {}) },
          nota: 'El ejemplo es de un negocio ficticio: sirve para ver la forma, nunca como dato de este negocio.',
        });
      }
      return JSON.stringify({ plantillas: PLANTILLAS_OFERTA.map(linea), nota: 'Con id, trae el ejemplo completo de una.' });
    },
  },
};

/** Dónde se edita un dato del negocio, para la salida de una lectura: el camino con los nombres de pantalla y el link. */
function dondeSeEdita(d: DatoDelNegocio, ws: number): { lugar: string; link: string } {
  return { lugar: lugarDato(d), link: linkApp(rutaDato(d), ws) };
}
