// =============================================================================
// onboarding-arranque-server — lo que el chat de arranque LEE y ESCRIBE
// =============================================================================
// Las reglas (etapa, mensajes, respuestas, cierre, brief) son puras y viven en lib/onboarding-arranque.ts,
// con test. Acá: leer los HECHOS (lo que hay hoy en la base: nunca se guarda, se mide), guardar lo que dijo
// la persona, y las dos escrituras grandes del arranque —sembrar el CRM principal y cerrar el onboarding—.
// Las llaman la página (/onboarding, para el primer dibujo) y la ruta (/api/onboarding/arranque).
// =============================================================================

import 'server-only';
import { capaDef } from './capas';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { getCapaActual, getWorkspace, getWorkspaceActual, actualizarWorkspace } from './workspace';
import { getUsuarioActual } from './auth';
import { getPerfil, setPerfil } from './perfil';
import { getDiagnosticoFase } from './fase-store';
import { PREGUNTAS, esCanal } from './fase-diagnostico';
import { getEstadoOnboarding, cerrarPasosOnboarding, type OnboardingState } from './onboarding-state';
import { getEstadoVerificacionContacto } from './mako-grupo';
import { getContactoReportes } from './perfil';
import { integracionConectada } from './credenciales';
import { leerSesion, leerFila, guardarComoOferta } from './offer-sesiones';
import { estadoDiagnostico } from './offer-reglas';
import { crearFunnel, getFunnelDefault, idDelFunnelDefault, renombrarFunnel, saveFunnelDefault } from './funnels';
import { FUNNEL_DEFAULT_NOMBRE } from './funnel-fila';
import { DEFAULT_PIPELINE, apagadasAlCrear, mismoPipeline, siembraDeCrm, tipoCrmPorId, type TipoCrmId } from './pipeline';
import { listProductos, upsertProducto } from './productos';
import { ANSWERS_KEY, saveAnswers } from './onboarding';
import { mapaParaEscribir } from './archivero';
import type { OfferSesionVista } from './offer-marco';
import {
  briefDesdeArranque, cierreDePasos, etapaDeArranque, fundirBrief, mensajesDeArranque, sinMarca,
  type EstadoArranque, type EtapaArranque, type HechosArranque, type MensajeArranque, type ModoArranque,
} from './onboarding-arranque';

const CLAVE = 'onboarding.arranque';

function parseEstado(raw: string | null): EstadoArranque {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as EstadoArranque) : {};
  } catch { return {}; }
}

/** Lo guardado, para DIBUJAR (una lectura caída dibuja la conversación desde el principio). */
export async function leerEstadoArranque(): Promise<EstadoArranque> {
  return parseEstado(await getSetting(CLAVE).catch(() => null));
}

/**
 * Funde un cambio sobre lo guardado, leyendo ESTRICTO: con la lectura caída, escribir sobre `{}` borraría
 * todo lo que la persona ya contestó (AGENTS.md, «Una lectura que cae al DEFAULT sirve para dibujar, nunca
 * para DECIDIR»). Un campo en `undefined` se BORRA (así «Cambiar número» vuelve al teléfono).
 */
export async function guardarEstadoArranque(patch: Partial<EstadoArranque>): Promise<EstadoArranque> {
  const raw = await getSettingEstricto(CLAVE);
  const previo = parseEstado(raw);
  const nuevo: Record<string, unknown> = { ...previo };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete nuevo[k];
    else nuevo[k] = v;
  }
  await setSetting(CLAVE, JSON.stringify(nuevo));
  return nuevo as EstadoArranque;
}

export type HechosServer = HechosArranque & {
  pasosCapa: string[];
  telefonoVerificado: boolean;
  metaConectado: boolean;
  sesion: OfferSesionVista | null;
  /**
   * Hay una conversación anotada y NO se pudo leer. «No pude leer» no es «no hay»: con esto en true la
   * pantalla no abre una conversación nueva (rehacer la oferta y dejar la vieja huérfana), avisa y relee.
   */
  sesionCaida: boolean;
  estadoOnboarding: OnboardingState;
};

/** Lo que hay HOY en la base para este negocio. Cada lectura que falla cae a «no», que es el lado seguro para dibujar. */
export async function hechosDelArranque(e: EstadoArranque): Promise<HechosServer> {
  const ws = await getWorkspaceActual();
  const capa = capaDef(await getCapaActual());
  const pasosCapa = [...capa.onboarding];
  const modo: ModoArranque = pasosCapa.includes('productos') ? 'oferta' : 'plan';
  let sesionCaida = false;
  const [perfil, w, diag, sesion, onb, verif, contacto, meta] = await Promise.all([
    getPerfil().catch(() => null),
    ws != null ? getWorkspace(ws).catch(() => null) : Promise.resolve(null),
    getDiagnosticoFase().catch(() => null),
    e.sesionId ? leerSesion(e.sesionId).catch(() => { sesionCaida = true; return null; }) : Promise.resolve(null),
    getEstadoOnboarding(),
    ws != null ? getEstadoVerificacionContacto(ws).catch(() => null) : Promise.resolve(null),
    getContactoReportes().catch(() => null),
    integracionConectada('meta').catch(() => false),
  ]);
  // Verificado = el teléfono GUARDADO es el mismo que se verificó (el mismo criterio que el wizard).
  const telefonoVerificado = !!verif?.verificado && !!contacto && verif.telefono === contacto.telefono.replace(/\D/g, '');
  return {
    modo,
    nombreCuenta: perfil?.nombre ?? '',
    nombreWorkspace: w?.nombre ?? '',
    faseGuardada: diag != null,
    canalNegocio: diag?.canal && esCanal(diag.canal) ? diag.canal : null,
    puedeConcluir: !!sesion?.puedeConcluir,
    ofertaLista: !!sesion?.conclusion,
    // Lo que ya contestó del diagnóstico en la conversación de la oferta: el arranque no lo repite.
    faseOffer: sesion ? (({ respuestas, canal }) => ({ respuestas, canal }))(estadoDiagnostico(sesion.mensajes, { canal: null, yaGuardado: false })) : null,
    conCrm: modo === 'oferta',
    conTelefono: pasosCapa.includes('tabs'),
    terminado: onb.status === 'done',
    pasosCapa,
    telefonoVerificado,
    metaConectado: !!meta,
    sesion,
    sesionCaida,
    estadoOnboarding: onb,
  };
}

/** Lo que la pantalla necesita para dibujar la conversación. */
export type VistaArranque = {
  modo: ModoArranque;
  etapa: EtapaArranque;
  antes: MensajeArranque[];
  despues: MensajeArranque[];
  /** La conversación de la oferta (modo 'oferta'), o null si todavía no arrancó (o no se pudo leer). */
  sesion: OfferSesionVista | null;
  /** Ya hay una conversación anotada: NUNCA se abre otra (aunque ésta no se haya podido leer). */
  tieneSesion: boolean;
  /** Está anotada y no se pudo leer: la pantalla avisa y relee, no crea. */
  sesionCaida: boolean;
  /** El funnel principal, donde nace la conversación de la oferta (y su primer CRM). */
  funnelDefaultId: number | null;
  introVista: boolean;
  nombre: string;
  /** El número que se está verificando (para la tarjeta del teléfono). */
  telefonoNumero: string;
  /** El tipo de CRM elegido, para la tarjeta. */
  crmTipo: TipoCrmId | null;
  /** El canal con el que se propone el CRM. */
  canal: HechosArranque['canalNegocio'];
};

export async function vistaArranque(): Promise<VistaArranque> {
  const e = await leerEstadoArranque();
  const h = await hechosDelArranque(e);
  const { antes, despues } = mensajesDeArranque(e, h);
  return {
    modo: h.modo,
    etapa: etapaDeArranque(e, h),
    antes,
    despues,
    sesion: h.sesion,
    tieneSesion: e.sesionId != null,
    sesionCaida: h.sesionCaida,
    funnelDefaultId: h.modo === 'oferta' ? await idDelFunnelDefault().catch(() => null) : null,
    introVista: !!e.introVista,
    nombre: e.nombre ?? '',
    telefonoNumero: e.telefonoNumero ?? '',
    crmTipo: e.crmTipo ?? null,
    canal: h.canalNegocio,
  };
}

/** Escribe el nombre que eligió en su perfil (best-effort: ya quedó en la conversación). */
export async function guardarNombre(nombre: string): Promise<void> {
  try { await setPerfil({ nombre }); } catch (err) { console.error('[arranque] nombre:', err instanceof Error ? err.message : err); }
}

/** El nombre del negocio, en el workspace actual (best-effort: ya quedó en la conversación). */
export async function guardarNombreNegocio(nombre: string): Promise<void> {
  const ws = await getWorkspaceActual();
  if (ws == null) return;
  try { await actualizarWorkspace(ws, { nombre }); } catch (err) { console.error('[arranque] negocio:', err instanceof Error ? err.message : err); }
}

/**
 * Siembra el CRM PRINCIPAL con el tipo que eligió. No crea un CRM nuevo: un negocio nace con su «Funnel
 * principal» (crearWorkspace) y TODO lead que entra sin asignación cae ahí (`funnel_id` null); un CRM
 * secundario arrancaría vacío. Se siembra sólo si está INTACTO (igual al de fábrica), con el mismo guard que
 * tenía el wizard: con la lectura caída no se escribe nada, y uno que el negocio ya editó no se pisa.
 */
export async function sembrarCrmPrincipal(tipo: TipoCrmId, nombreNegocio: string): Promise<{ sembrado: boolean; aviso?: string }> {
  const s = siembraDeCrm({ tipo });
  if ('error' in s) throw new Error(s.error);
  const actual = await getFunnelDefault();
  if (actual.origen === 'error') throw new Error('No pude leer tu CRM (falló la base de MaKo, no es nada tuyo). Prueba de nuevo en un momento.');
  const intacto = mismoPipeline(actual.pipeline, DEFAULT_PIPELINE) && actual.suppressed.length === 0;
  if (!intacto) return { sembrado: false, aviso: 'Tu CRM ya tenía etapas propias: lo dejé como estaba.' };
  await saveFunnelDefault(s.pipeline, apagadasAlCrear(s.pipeline, s.suppressed), { entradas: s.entradas });
  // El canal del negocio, como lo dejaba el diagnóstico del wizard (lo leen las plantillas de nutrición).
  await setSetting('onboarding.funnel_tipos', JSON.stringify([s.canal])).catch(() => {});
  const id = actual.id ?? (await idDelFunnelDefault().catch(() => null));
  if (id != null && nombreNegocio.trim()) await renombrarFunnel(id, nombreNegocio).catch(() => {});
  return { sembrado: true };
}

/**
 * Que exista el funnel principal antes de abrir la conversación de la oferta (nace atada a él). Todo negocio
 * nuevo lo trae de fábrica (crearWorkspace); uno viejo puede no tenerlo, y sin él la conversación no
 * arranca. Se crea VACÍO, como el de fábrica (sin etapas, sin declarar): así sigue «intacto» y el CRM se
 * siembra después con el tipo que elija. Con la lectura caída no se crea nada (podría ya existir).
 */
export async function asegurarFunnelPrincipal(): Promise<void> {
  if ((await idDelFunnelDefault().catch(() => null)) != null) return;
  const actual = await getFunnelDefault().catch(() => null);
  if (!actual || actual.origen === 'error' || actual.id != null) return;
  await crearFunnel({ nombre: FUNNEL_DEFAULT_NOMBRE, esDefault: true });
}

export class FaltaParaCerrar extends Error {}

/**
 * Cierra el arranque: deja escrito el perfil del negocio (el brief, fundido sin pisar), el producto y la
 * oferta (modo 'oferta') y cierra los pasos del onboarding por la puerta única (`cerrarPasosOnboarding`):
 * el teléfono y Meta se postergan si no se hicieron, nunca se marcan hechos.
 */
export async function cerrarArranque(): Promise<{ estado: OnboardingState; avisos: string[] }> {
  const e = parseEstado(await getSettingEstricto(CLAVE));
  const h = await hechosDelArranque(e);
  const etapa = etapaDeArranque(e, h);
  if (h.terminado) return { estado: h.estadoOnboarding, avisos: [] };
  if (etapa !== 'cierre') throw new FaltaParaCerrar('Todavía falta un paso de la conversación.');
  const avisos: string[] = [];

  // 1. La oferta armada (modo 'oferta').
  const fila = h.modo === 'oferta' && e.sesionId ? await leerFila(e.sesionId) : null;
  const propuesta = fila?.conclusiones.length ? fila.conclusiones[fila.conclusiones.length - 1].propuesta : null;
  const piezas = h.sesion?.piezas;

  // 2. El producto y la oferta (modo 'oferta'): el catálogo que usa el CRM al ganar un lead.
  // ⚠️ VA ANTES DEL BRIEF, y el orden es el arreglo. `guardarComoOferta` siembra primero la oferta principal
  // DESDE EL BRIEF (`seedOfertaDesdeBrief`, que corre una sola vez y quema su guard): con `oferta_nombre` ya
  // escrito, creaba «X» desde el brief y después la de Offer chocaba con el nombre y quedaba «X · versión 1».
  // Cada cliente nuevo terminaba con dos ofertas iguales (revisión del 16/10). Sin el nombre en el brief
  // todavía, la siembra no crea nada y la oferta del negocio es la de la conversación.
  if (h.modo === 'oferta' && propuesta && e.sesionId) {
    try {
      const productos = await listProductos();
      if (!productos.length) {
        // El precio NO se pasa a número: lo que dijo el dueño es texto libre («$3k», «800 MXN/mes») y el
        // monto del producto es el del link de cobro (CobrarConLink). Queda escrito en la descripción y el
        // monto lo pone él en Productos.
        const precio = sinMarca(piezas?.precio?.valor);
        await upsertProducto({
          nombre: sinMarca(propuesta.nombre) || `Oferta de ${e.negocio ?? 'tu negocio'}`,
          tipo: 'unico',
          monto_usd: null,
          suscripcion_meses: null,
          promesa: sinMarca(piezas?.resultado?.valor) || null,
          incluye: sinMarca(piezas?.entregables?.valor) || null,
          garantia: sinMarca(piezas?.garantia?.valor) || null,
          descripcion: precio ? `Precio: ${precio}` : null,
        });
      }
      await guardarComoOferta(e.sesionId);
    } catch (err) {
      console.error('[arranque] producto/oferta:', err instanceof Error ? err.message : err);
      avisos.push('Tu oferta quedó en la conversación, pero no pude guardarla en tu catálogo; la guardas desde Offer.');
    }
  }

  // 3. El brief, fundido sobre lo que ya había (la lectura es estricta: caída, no se escribe).
  const diag = await getDiagnosticoFase().catch(() => null);
  const iCuello = PREGUNTAS.findIndex((q) => q.id === 'cuello');
  const rCuello = diag?.respuestas?.[iCuello];
  const cuello = iCuello >= 0 && Number.isInteger(rCuello) && (rCuello as number) >= 0 ? PREGUNTAS[iCuello].opciones[rCuello as number] ?? null : null;
  try {
    const previas = await mapaParaEscribir(ANSWERS_KEY);
    const fundido = fundirBrief(previas, briefDesdeArranque({ estado: e, piezas, propuesta, cuello }));
    if (JSON.stringify(fundido) !== JSON.stringify(previas)) await saveAnswers(fundido);
  } catch (err) {
    console.error('[arranque] brief:', err instanceof Error ? err.message : err);
    avisos.push('No pude guardar el perfil de tu negocio; lo completas en Second Brain.');
  }

  // 4. Los pasos.
  const quien = (await getUsuarioActual().catch(() => null))?.email || 'admin-cliente';
  const cambios = cierreDePasos(h.pasosCapa, { telefonoVerificado: h.telefonoVerificado, metaConectado: h.metaConectado });
  const estado = await cerrarPasosOnboarding(cambios, quien);
  return { estado, avisos };
}

/** El tipo de CRM elegido, validado contra el catálogo. */
export function tipoValido(v: unknown): TipoCrmId | null {
  return tipoCrmPorId(v)?.id ?? null;
}
