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
import { getSesionAdmin, getUsuarioActual } from './auth';
import { CLAVE_GUARDIA, parseGuardia } from './onboarding-guardia';
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
import { borrarBinario, insertFile, listFiles, mapaParaEscribir, subirBinario } from './archivero';
import { idDeContenido } from './archivero-registro';
import { nombreArchivoLoQueVendes, pdfDeLoQueVendes } from './lo-que-vendes-pdf';
import { tzDeWorkspace } from './timezone';
import { faltanDelArranque, type OfferSesionVista, type PiezasSabidas } from './offer-marco';
import {
  CLAVE_ENCUESTA, briefDesdeArranque, cierreDePasos, etapaDeArranque, fundirBrief, mensajesDeArranque, sinMarca,
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
    loQueVende: !!sesion && faltanDelArranque(sesion.piezas).length === 0,
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
  /** Lo que quiere resolver primero: decide a qué pestaña entra al terminar (`rutaDeEntrada`). */
  interes: EstadoArranque['interes'] | null;
  /** La guardia lo bloqueó (lib/onboarding-guardia.ts): la pantalla muestra el aviso en vez del chat. */
  bloqueo: { at: string; motivo: string } | null;
  /** Quien mira es el equipo de MaKo: ve el motivo, lo que escribió y «Desbloquear». Para el cliente, vacío. */
  equipo: { ultimasFaltas: string[] } | null;
};

export async function vistaArranque(): Promise<VistaArranque> {
  const e = await leerEstadoArranque();
  const [h, guardia, superAdmin] = await Promise.all([
    hechosDelArranque(e),
    // Para DIBUJAR: una lectura caída no muestra el bloqueo (las rutas lo vuelven a mirar estricto antes de dejar pasar).
    getSetting(CLAVE_GUARDIA).then(parseGuardia).catch(() => ({}) as ReturnType<typeof parseGuardia>),
    getSesionAdmin().catch(() => null),
  ]);
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
    interes: e.interes ?? null,
    bloqueo: guardia.bloqueo ? { at: guardia.bloqueo.at, motivo: guardia.bloqueo.motivo } : null,
    equipo: superAdmin && guardia.bloqueo ? { ultimasFaltas: guardia.ultimasFaltas ?? [] } : null,
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

/** Lo que El Archivero dice del PDF «Lo que vendes» (su «por qué» en la lista). */
export const RAZON_LO_QUE_VENDES = 'Lo armó MaKo con lo que contaste en el onboarding. Sus datos ya están en tu perfil.';

/**
 * Deja el PDF «Lo que vendes» como un documento de El Archivero (17/10/2026, docs/relevo/onboarding.md: «el PDF que no
 * queda en El Archivero»). Decisión con criterio: SIN EXTRACCIÓN. Lo que dice el PDF ya está en el perfil (el brief que
 * escribe el cierre, de las mismas piezas): leerlo de nuevo con la IA sería pagar por saber lo que ya se sabe (la
 * hallazgo del 17/10 lo frenaba por eso: «pagaría una extracción por cliente»). La fila va con `campos` vacíos y su
 * razonamiento; el binario, donde guarda El Archivero (`<ws>/<id>`, id por contenido).
 * Una vez por negocio: si ya hay un documento con ese nombre, no se repite (el PDF lleva la fecha: el contenido cambia).
 */
export async function archivarLoQueVendes(ws: number, piezas: PiezasSabidas, negocio: string): Promise<{ ok: true; id: string | null } | { ok: false; motivo: string }> {
  const nombre = nombreArchivoLoQueVendes(negocio);
  if ((await listFiles()).some((f) => f.nombre === nombre)) return { ok: true, id: null };
  const zona = await tzDeWorkspace(ws).catch(() => '');
  const bytes = pdfDeLoQueVendes(piezas, { negocio, fecha: new Date(), zona: zona || undefined });
  const id = idDeContenido(ws, bytes);
  const path = await subirBinario(ws, id, Buffer.from(bytes), 'application/pdf');
  try {
    await insertFile(ws, { id, nombre, mime: 'application/pdf', tamano: bytes.byteLength, storage_path: path, razonamiento: RAZON_LO_QUE_VENDES, campos: {} });
  } catch (e) {
    await borrarBinario(path);
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, id };
}

export class FaltaParaCerrar extends Error {}

/**
 * Cierra el arranque: deja escrito el perfil del negocio (el brief, fundido sin pisar) y el producto de lo que
 * vende (modo 'oferta'), y cierra los pasos del onboarding por la puerta única (`cerrarPasosOnboarding`): el
 * teléfono y Meta se postergan si no se hicieron, nunca se marcan hechos. La OFERTA (la fila de `ofertas`) se
 * guarda sólo si la conversación ya tiene una armada: desde el 17/10/2026 el onboarding no la arma (eso es de la
 * tab Offer), y una conversación que venía de antes puede traerla.
 */
export async function cerrarArranque(): Promise<{ estado: OnboardingState; avisos: string[] }> {
  const e = parseEstado(await getSettingEstricto(CLAVE));
  const h = await hechosDelArranque(e);
  const etapa = etapaDeArranque(e, h);
  if (h.terminado) return { estado: h.estadoOnboarding, avisos: [] };
  if (etapa !== 'cierre') throw new FaltaParaCerrar('Todavía falta un paso de la conversación.');
  const avisos: string[] = [];

  // 1. La oferta armada, si la conversación ya traía una (modo 'oferta').
  const fila = h.modo === 'oferta' && e.sesionId ? await leerFila(e.sesionId) : null;
  const propuesta = fila?.conclusiones.length ? fila.conclusiones[fila.conclusiones.length - 1].propuesta : null;
  const piezas = h.sesion?.piezas;

  // 2. El producto (y la oferta, si hay una armada), modo 'oferta': el catálogo que usa el CRM al ganar un lead.
  // ⚠️ VA ANTES DEL BRIEF, y el orden es el arreglo. `guardarComoOferta` siembra primero la oferta principal
  // DESDE EL BRIEF (`seedOfertaDesdeBrief`, que corre una sola vez y quema su guard): con `oferta_nombre` ya
  // escrito, creaba «X» desde el brief y después la de Offer chocaba con el nombre y quedaba «X · versión 1».
  // Cada cliente nuevo terminaba con dos ofertas iguales (revisión del 16/10). Sin el nombre en el brief
  // todavía, la siembra no crea nada y la oferta del negocio es la de la conversación.
  if (h.modo === 'oferta' && piezas && e.sesionId) {
    try {
      const productos = await listProductos();
      if (!productos.length) {
        // El precio NO se pasa a número: lo que dijo el dueño es texto libre («$3k», «800 MXN/mes») y el
        // monto del producto es el del link de cobro (CobrarConLink). Queda escrito en la descripción y el
        // monto lo pone él en Productos.
        const precio = sinMarca(piezas?.precio?.valor);
        await upsertProducto({
          nombre: sinMarca(propuesta?.nombre) || `Oferta de ${e.negocio ?? 'tu negocio'}`,
          tipo: 'unico',
          monto_usd: null,
          suscripcion_meses: null,
          promesa: sinMarca(piezas?.resultado?.valor) || null,
          incluye: sinMarca(piezas?.entregables?.valor) || null,
          garantia: sinMarca(piezas?.garantia?.valor) || null,
          descripcion: precio ? `Precio: ${precio}` : null,
        });
      }
      if (propuesta) await guardarComoOferta(e.sesionId);
    } catch (err) {
      console.error('[arranque] producto/oferta:', err instanceof Error ? err.message : err);
      avisos.push('Lo que vendes quedó en la conversación, pero no pude guardarlo en tu catálogo; lo cargas en Productos.');
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

  // 3-bis. «Lo que vendes» queda como DOCUMENTO en El Archivero (17/10/2026; y de ahí, en Second Brain → Documentos).
  // Best-effort: no traba el cierre.
  if (h.modo === 'oferta' && piezas) {
    const ws = await getWorkspaceActual().catch(() => null);
    if (ws != null) {
      const r = await archivarLoQueVendes(ws, piezas, e.negocio ?? '').catch((err) => ({ ok: false as const, motivo: err instanceof Error ? err.message : String(err) }));
      if (!r.ok) console.error('[arranque] «Lo que vendes» al Archivero:', r.motivo);
    }
  }

  // 4. Cómo llegó y qué quiere resolver primero (17/10/2026): un setting propio, para que el super admin los lea sin
  // abrir la conversación (y la API de MaKo, `ver_estado_onboarding`). Best-effort: no traba el cierre.
  if (e.origen || e.interes) {
    await setSetting(CLAVE_ENCUESTA, JSON.stringify({ origen: e.origen ?? null, interes: e.interes ?? null, at: new Date().toISOString() }))
      .catch((err) => console.error('[arranque] encuesta:', err instanceof Error ? err.message : err));
  }

  // 5. Los pasos.
  const quien = (await getUsuarioActual().catch(() => null))?.email || 'admin-cliente';
  const cambios = cierreDePasos(h.pasosCapa, { telefonoVerificado: h.telefonoVerificado, metaConectado: h.metaConectado });
  const estado = await cerrarPasosOnboarding(cambios, quien);
  return { estado, avisos };
}

/** El tipo de CRM elegido, validado contra el catálogo. */
export function tipoValido(v: unknown): TipoCrmId | null {
  return tipoCrmPorId(v)?.id ?? null;
}
