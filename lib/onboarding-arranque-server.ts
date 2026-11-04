// =============================================================================
// onboarding-arranque-server — lo que el chat de arranque LEE y ESCRIBE
// =============================================================================
// Las reglas (etapa, mensajes, respuestas, cierre, brief) son puras y viven en lib/onboarding-arranque.ts,
// con test. Acá: leer los HECHOS (lo que hay hoy en la base: nunca se guarda, se mide), guardar lo que dijo
// la persona, y las dos escrituras grandes del arranque —sembrar el CRM principal y cerrar el onboarding—.
// Las llaman la página (/onboarding, para el primer dibujo) y la ruta (/api/onboarding/arranque).
// =============================================================================

import QRCode from 'qrcode';
import { linkApp } from './app-url';
import { RUTA_APP } from './app-tiendas';
import { avisosDeQuienEntra } from './avisos-telefono';
import 'server-only';
import { capaDef } from './capas';
import { cambiarSettingSi, getSetting, getSettingEstricto, setSetting } from './settings';
import { estaImpersonando, getCapaActual, getTenantDb, getWorkspace, getWorkspaceActual, actualizarWorkspace } from './workspace';
import { OWNER_WS } from './auth-session';
import { contarAdminsClienteActivos } from './usuarios';
import { getSesionAdmin, getUsuarioActual } from './auth';
import { CLAVE_GUARDIA, parseGuardia } from './onboarding-guardia';
import { wsDelOnboarding } from './onboarding-guard';
import { getPerfil, setPerfil } from './perfil';
import { getDiagnosticoFase, getDiagnosticoFaseEstricto } from './fase-store';
import { PREGUNTAS, esCanal } from './fase-diagnostico';
import { getEstadoOnboarding, getEstadoOnboardingEstricto, cerrarPasosOnboarding, type OnboardingState } from './onboarding-state';
import { estadoVerificacionEntrante, getEstadoVerificacionContacto } from './mako-grupo';
import type { VistaEntrante } from './verificacion-entrante';
import { getContactoReportes } from './perfil';
import { integracionConectada } from './credenciales';
import { leerSesion, leerFila, guardarComoOferta } from './offer-sesiones';
import { createSession, deleteSession, listSessions } from './chart-chats';
import { chartKeyDePersona } from './mako-turno-app-reglas';
import { estadoDiagnostico } from './offer-reglas';
import { crearFunnel, getFunnelDefault, idDelFunnelDefault, renombrarFunnel, saveFunnelDefault } from './funnels';
import { FUNNEL_DEFAULT_NOMBRE } from './funnel-fila';
import { DEFAULT_PIPELINE, apagadasAlCrear, mismoPipeline, siembraDeCrm, tipoCrmPorId, type TipoCrmId } from './pipeline';
import { candidatosCrm, etapasConNombres, type PropuestaCrm } from './onboarding-crm';
import type { CanalId } from './fase-diagnostico';
import { listProductos, upsertProducto } from './productos';
import { ANSWERS_KEY, saveAnswers } from './onboarding';
import { borrarBinario, insertFile, listFiles, mapaParaEscribir, subirBinario } from './archivero';
import { idDeContenido } from './archivero-registro';
import { nombreArchivoLoQueVendes, pdfDeLoQueVendes } from './lo-que-vendes-pdf';
import { tzDeWorkspace } from './timezone';
import { NOMBRE_WS_PRUEBA } from './reset-workspace';
import { faltanDelArranque, type OfferSesionVista, type PiezasSabidas } from './offer-marco';
import { CLAVE_HISTORIAL, anotarCon, conLoNuevo, leerHistorial, unirConOffer } from './onboarding-historial';
import { getSupabaseServer } from './supabase';
import { bloqueDeAudio } from './chat-mako-bloques';
import {
  CLAVE_ENCUESTA, briefDesdeArranque, cierreDePasos, etapaDeArranque, fundirBrief, mensajesDeArranque, TITULO_HILO, decisionDelHilo, contextoDelHilo, cobroDelPrecio, opcionesDeCobro, mensajesDelHilo, pisaElNombreDelPerfil, sinMarca, notaDelPdf,
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

/**
 * Los mensajes del chat «Onboarding», con lecturas ESTRICTAS: si la conversación de Offer o el estado del onboarding no se
 * pudieron leer, tira y no se escribe nada (AGENTS.md: una lectura que cae al default no decide). Sin esto se guardaba una
 * copia a medias para siempre: sin la conversación de lo que vende, o con «Un gusto, . ¿Cómo se llama tu negocio?».
 */
async function mensajesParaElHilo(e: EstadoArranque): Promise<ReturnType<typeof mensajesDelHilo>> {
  const h = await hechosDelArranque(e);
  if (!h.terminado) throw new Error('El onboarding todavía no terminó (o no se pudo leer su estado): no armo el chat.');
  if (e.sesionId && (h.sesionCaida || !h.sesion)) throw new Error('No pude leer la conversación del onboarding: no armo el chat a medias.');
  if (!(await hechosConfirmados(h))) throw new Error('No pude leer entero lo que decide el onboarding: no armo el chat a medias.');
  // Del HISTORIAL guardado (21/10/2026): lo que se le preguntó y contestó, con los textos de ese día. Armado del estado de
  // hoy, un arreglo posterior (el nombre del negocio de Florencia, ws21) cambiaba lo que «contestó». Quien terminó antes de
  // que se guardara se anota ahora, marcado `reconstruido` (`vivo` con el historial vacío). Sin poder leerlo, no se arma.
  await anotarHistorial(mensajesDeArranque(e, h), { primeroDeOffer: primeroDeOffer(h) });
  const historial = leerHistorial(await getSettingEstricto(CLAVE_HISTORIAL));
  if (!historial) throw new Error('No pude leer el historial del onboarding: no armo el chat a medias.');
  return mensajesDelHilo(unirConOffer(historial, h.sesion?.mensajes ?? []), e.interes);
}

/** La hora del primer mensaje de la conversación de Offer del onboarding (lo de antes se anota antes de él). */
const primeroDeOffer = (h: Pick<HechosServer, 'sesion'>): number | null => {
  const t = Date.parse(h.sesion?.mensajes[0]?.at ?? '');
  return Number.isFinite(t) ? t : null;
};

/**
 * ¿Lo que decide QUÉ se dibuja se leyó bien? `hechosDelArranque` lee tolerante (para dibujar): la capa cae a «completa»
 * (modo 'oferta'), el diagnóstico y el estado del onboarding a «no hay», y con eso se dibujan preguntas que no se hicieron.
 * Para ANOTAR se releen ESTRICTOS y tienen que dar lo mismo. ⚠️ Un `.catch` sobre `getSetting` no sirve para saber si cayó:
 * `getSetting` nunca tira, devuelve null (revisión adversarial, 21/10: el `faseCaida` de la primera versión no se activaba).
 */
export async function hechosConfirmados(h: HechosServer): Promise<boolean> {
  if (h.sesionCaida) return false;
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return false;
    const [fila, diag, onb] = await Promise.all([
      getSupabaseServer().from('workspaces').select('capa').eq('id', ws).maybeSingle(),
      getDiagnosticoFaseEstricto(),
      getEstadoOnboardingEstricto(),
    ]);
    if (fila.error || !fila.data) return false;
    const capa = capaDef((fila.data as { capa?: string }).capa);
    const modo: ModoArranque = capa.onboarding.includes('productos') ? 'oferta' : 'plan';
    const canal = diag?.canal && esCanal(diag.canal) ? diag.canal : null;
    return modo === h.modo && capa.onboarding.includes('tabs') === h.conTelefono && (diag != null) === h.faseGuardada
      && canal === h.canalNegocio && (onb.status === 'done') === h.terminado;
  } catch {
    return false;
  }
}

/**
 * Anota en el historial (lib/onboarding-historial.ts, `conLoNuevo` en modo `vivo`): lo que MaKo dice la primera vez que se
 * ve, y lo que la persona mandó (`respuesta`) tal cual. Con compare-and-set (dos pestañas a la vez no se pisan) y la
 * lectura ESTRICTA: caída, o con algo que no se entiende, no se escribe nada (tira). Devuelve cuántos anotó.
 */
export async function anotarHistorial(
  vista: { antes: readonly MensajeArranque[]; despues: readonly MensajeArranque[] },
  o: { primeroDeOffer?: number | null; respuesta?: string | null } = {},
): Promise<number> {
  return anotarCon(
    { leer: () => getSettingEstricto(CLAVE_HISTORIAL), cambiar: (raw, nuevo) => cambiarSettingSi(CLAVE_HISTORIAL, raw, nuevo) },
    (previo) => conLoNuevo(previo, vista, { ahora: Date.now(), primeroDeOffer: o.primeroDeOffer, vivo: true, respuesta: o.respuesta }),
  );
}

/**
 * Lo que la persona contestó, en vivo (la ruta, después de guardar la respuesta): la pregunta que contestaba (si todavía no
 * estaba anotada, como la del PDF, que aparece sin pasar por acá) y su respuesta TAL CUAL, con el texto de la opción que
 * tocó. `e` es el estado leído estricto ANTES de la respuesta, y `h` sus hechos; `confirmado`, `hechosConfirmados(h)`
 * calculado ANTES de escribir nada: la respuesta que cierra la fase guarda el diagnóstico, y confirmado después ya no
 * coincidía con `h` (segunda revisión, 22/10: esa respuesta no se anotaba nunca). Best-effort: el historial no traba nada.
 */
export async function anotarRespuesta(e: EstadoArranque, h: HechosServer, dicho: string | null, confirmado: boolean): Promise<void> {
  if (!dicho?.trim() || !confirmado) return;
  try {
    await anotarHistorial(mensajesDeArranque(e, h), { primeroDeOffer: primeroDeOffer(h), respuesta: dicho });
  } catch (err) {
    console.error('[arranque] historial (respuesta):', err instanceof Error ? err.message : err);
  }
}

/**
 * El chat «Onboarding» del Ops Center con la conversación del arranque, TAL CUAL (20/10/2026). Una sola vez y para quien
 * contestó el onboarding (`dueno`; sin dueño anotado, sólo si el negocio tiene un admin). Va a su chart_key (el del chat
 * del Ops Center y el de /m/mako). Si la persona no tenía chats, primero se crea el principal (el más viejo es el jefe,
 * «Second Brain»), para que éste quede como «Onboarding» y no como el principal.
 *
 * ⚠️ SIN CARRERA (revisión del Cerebro, 20/10): «Entrar a MaKo» o un F5 durante el POST corrían el Ops Center a la vez y
 *    quedaban dos «Onboarding» y dos vacíos, o se entraba a uno a medio copiar. Ahora: una RESERVA con compare-and-set
 *    sobre el estado (`hiloCreando`, quien no la gana no crea), los mensajes en UN insert, y `hiloChat` recién al final.
 *    Un chat marcado (`contextoDelHilo`) sin `hiloChat` es uno que quedó a medias: se borra y se rehace.
 * Devuelve el id del chat de esta persona, o null si no le toca (o si otro lo está armando).
 */
export async function hiloDelOnboarding(): Promise<number | null> {
  // Mirando a un cliente, NO: el chat quedaría con el chart_key del super admin. Se crea cuando entra el cliente.
  if (await estaImpersonando().catch(() => true)) return null;
  const ws = await getWorkspaceActual();
  if (ws == null || ws === OWNER_WS) return null;
  const persona = await getUsuarioActual();
  const chartKey = persona ? chartKeyDePersona(persona) : null;
  if (!chartKey) return null;
  const raw = await getSettingEstricto(CLAVE);
  const previo = parseEstado(raw);
  const unSoloAdmin = previo.dueno ? false : (await contarAdminsClienteActivos(ws)) === 1;
  const decision = decisionDelHilo(previo, chartKey, { ahora: Date.now(), unSoloAdmin });
  if (decision === 'listo') return !previo.hiloDe || previo.hiloDe === chartKey ? previo.hiloChat ?? null : null;
  if (decision !== 'crear') return null;
  // La reserva: si el estado cambió desde que lo leímos (otra pestaña reservó), no se crea nada.
  const reservado = JSON.stringify({ ...previo, hiloCreando: { at: new Date().toISOString(), por: chartKey } });
  if (!raw || !(await cambiarSettingSi(CLAVE, raw, reservado))) return null;
  try {
    const mensajes = await mensajesParaElHilo(previo);
    const marca = contextoDelHilo(previo.sesionId);
    const sesiones = await listSessions(chartKey, true);
    for (const s of sesiones.filter((x) => x.contexto === marca)) await deleteSession(s.id);
    if (!sesiones.some((s) => !s.archived && s.contexto !== marca)) await createSession(chartKey, null, null);
    const hilo = await createSession(chartKey, TITULO_HILO, marca);
    try {
      const db = await getTenantDb();
      // Cada mensaje con su hora, creciente (cuarta revisión, 21/10): en UN insert todas las filas llevaban el mismo now(),
      // y el chat se lee ordenado sólo por esa hora: los empates salían en el orden físico de la tabla, desordenados.
      const t0 = Date.now() - mensajes.length;
      // Una respuesta por voz guarda en `bloques` (mig 0305) cuál mensaje de Offer tiene el audio (lib/chat-mako-bloques.ts).
      // La columna va sólo si hay audio, y sin ella (una base sin la 0305) se copia el texto igual.
      const filas = mensajes.map((m, i) => ({
        session_id: hilo.id, role: m.role, content: m.content, created_at: new Date(t0 + i).toISOString(),
        bloques: m.audio && previo.sesionId ? [bloqueDeAudio(previo.sesionId, m.audio.mensaje, m.audio.secs)] : null,
      }));
      const conAudio = filas.some((f) => f.bloques);
      let { error } = await db.from('chart_chats').insert(conAudio ? filas : filas.map(({ bloques: _b, ...f }) => f));
      if (error && conAudio) {
        console.error('[arranque] chat «Onboarding» con audio:', error.message, '— lo copio sin los audios');
        ({ error } = await db.from('chart_chats').insert(filas.map(({ bloques: _b, ...f }) => f)));
      }
      if (error) throw new Error(`No pude copiar la conversación del onboarding: ${error.message}`);
      await db.from('chart_sessions').update({ updated_at: new Date().toISOString() }).eq('id', hilo.id);
    } catch (err) {
      await deleteSession(hilo.id).catch(() => {});
      throw err;
    }
    await guardarEstadoArranque({ hiloChat: hilo.id, hiloDe: chartKey, hiloAt: new Date().toISOString(), hiloCreando: undefined, ...(previo.dueno ? {} : { dueno: chartKey }) });
    return hilo.id;
  } catch (err) {
    await guardarEstadoArranque({ hiloCreando: undefined }).catch(() => {});
    throw err;
  }
}

/**
 * El chat «Onboarding» para quien terminó ANTES de que existiera (20/10/2026, Florencia, ws21: terminó el 18/10 y su Ops
 * Center tenía 0 chats). /onboarding redirige a quien ya terminó, así que el final del onboarding no le llega nunca: se
 * crea en su primera visita al Ops Center. Con la MISMA regla que el final: sólo el onboarding de la oferta (el Project
 * Manager entra a /plan), sólo con el onboarding terminado y sólo para su dueño (`hiloDelOnboarding`). Devuelve el id
 * sólo si lo creó ahora.
 */
export async function hiloParaQuienYaTermino(): Promise<number | null> {
  const e = parseEstado(await getSettingEstricto(CLAVE));
  if (e.hiloChat || (!e.nombre && !e.sesionId)) return null;
  if (!capaDef(await getCapaActual()).onboarding.includes('productos')) return null;
  if ((await getEstadoOnboarding()).status !== 'done') return null;
  if ('error' in (await wsDelOnboarding())) return null;
  return hiloDelOnboarding();
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
  const [perfil, w, diag, sesion, onb, verif, contacto, meta, avisos] = await Promise.all([
    getPerfil().catch(() => null),
    ws != null ? getWorkspace(ws).catch(() => null) : Promise.resolve(null),
    getDiagnosticoFase().catch(() => null),
    e.sesionId ? leerSesion(e.sesionId).catch(() => { sesionCaida = true; return null; }) : Promise.resolve(null),
    getEstadoOnboarding(),
    ws != null ? getEstadoVerificacionContacto(ws).catch(() => null) : Promise.resolve(null),
    getContactoReportes().catch(() => null),
    integracionConectada('meta').catch(() => false),
    avisosDeQuienEntra(),
  ]);
  const precioDicho = sesion ? sinMarca(sesion.piezas?.precio?.valor) : '';
  // Verificado = el teléfono GUARDADO es el mismo que se verificó (el mismo criterio que el wizard).
  const telefonoVerificado = !!verif?.verificado && !!contacto && verif.telefono === contacto.telefono.replace(/\D/g, '');
  return {
    modo,
    nombreCuenta: perfil?.nombre ?? '',
    // El nombre del ws de prueba no se ofrece como «tu negocio» (lo pone el RESET: lib/reset-workspace.ts).
    nombreWorkspace: w?.nombre && w.nombre !== NOMBRE_WS_PRUEBA ? w.nombre : '',
    faseGuardada: diag != null,
    canalNegocio: diag?.canal && esCanal(diag.canal) ? diag.canal : null,
    // Con las piezas, sí. Ya no espera a que el modelo deje de preguntar (`preguntaAbierta`, 18/10): con las piezas el turno
    // que cierra lo escribe el código (app/api/offer/route.ts → mensajeDeCierreDelArranque), y esperar al modelo hizo que
    // Florencia contestara 6 preguntas de más (20/10/2026).
    loQueVende: !!sesion && faltanDelArranque(sesion.piezas).length === 0,
    // Cómo cobra, leído del precio que contó: se PROPONE y se confirma con un toque (etapa 'cobro', cuarta revisión, 21/10),
    // entre TODAS las lecturas posibles (novena revisión).
    cobroLeido: precioDicho ? cobroDelPrecio(precioDicho) : null,
    cobroOpciones: precioDicho ? opcionesDeCobro(precioDicho) : null,
    // Lo que ya contestó del diagnóstico en la conversación de la oferta: el arranque no lo repite.
    faseOffer: sesion ? (({ respuestas, canal }) => ({ respuestas, canal }))(estadoDiagnostico(sesion.mensajes, { canal: null, yaGuardado: false })) : null,
    conCrm: modo === 'oferta',
    conTelefono: pasosCapa.includes('tabs'),
    conAvisos: avisos.aplica,
    avisosListos: avisos.listos,
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
/** Lo escribe el alta por el pago (Planes, 31/10/2026). Es el mismo texto que `CLAVE_WHATSAPP_DEL_PAGO` de lib/origen-cuenta.ts: no se
 *  importa para que las dos puntas suban en cualquier orden, y tests/onboarding-whatsapp-primero.test.ts los compara. */
const CLAVE_WHATSAPP_DEL_PAGO = 'cuenta.whatsapp_del_pago';

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
  /** El QR de la tarjeta de los avisos, sólo en esa etapa: lleva a instalar MaKo en el teléfono de quien lo escanea (`/app`). */
  avisosQr: string | null;
  /** El número que se está verificando (para la tarjeta del teléfono). */
  telefonoNumero: string;
  /** El WhatsApp que dio al pagar, sólo dígitos: la tarjeta arranca con él y lo manda un toque. Vacío si no dio ninguno. */
  telefonoDelPago: string;
  /** El mensaje que la persona le manda a MaKo para confirmar su WhatsApp (4/11/2026), sólo en esa etapa: el link `wa.me` y si ya llegó. */
  whatsapp: VistaEntrante | null;
  /** El tipo de CRM elegido, para la tarjeta. */
  crmTipo: TipoCrmId | null;
  /** El CRM a medida que armó MaKo (lib/onboarding-crm.ts): la tarjeta muestra sus etapas con esos nombres. */
  crmPropuesta: PropuestaCrm | null;
  /** El canal con el que se propone el CRM. */
  canal: HechosArranque['canalNegocio'];
  /** Lo que quiere resolver primero: decide a qué pestaña entra al terminar (`rutaDeEntrada`). */
  interes: EstadoArranque['interes'] | null;
  /** La guardia lo bloqueó (lib/onboarding-guardia.ts): la pantalla muestra el aviso en vez del chat. */
  bloqueo: { at: string; motivo: string } | null;
  /** Quien mira es el equipo de MaKo: ve el motivo, lo que escribió y «Desbloquear». Para el cliente, vacío. */
  equipo: { ultimasFaltas: string[] } | null;
};

/**
 * `anotar` (la ruta, después de una respuesta que se guardó): lo que MaKo dice ahora queda en el historial. Mirar no anota
 * (la página y el GET: la hora sería la de quien mira). Best-effort, el historial no traba la conversación. Para anotar,
 * el estado se lee ESTRICTO y los hechos se confirman (`hechosConfirmados`): con una lectura caída, lo dibujado («Un
 * gusto, . ¿Cómo se llama tu negocio?») no es lo que pasó, y quedaría para siempre (revisión adversarial, 21/10).
 */
export async function vistaArranque(o: { anotar?: boolean | 'cierre' } = {}): Promise<VistaArranque> {
  let estricto = false;
  let e: EstadoArranque;
  if (o.anotar) {
    try { e = parseEstado(await getSettingEstricto(CLAVE)); estricto = true; } catch { e = {}; }
  } else {
    e = await leerEstadoArranque();
  }
  const [h, guardia, superAdmin] = await Promise.all([
    hechosDelArranque(e),
    // Para DIBUJAR: una lectura caída no muestra el bloqueo (las rutas lo vuelven a mirar estricto antes de dejar pasar).
    getSetting(CLAVE_GUARDIA).then(parseGuardia).catch(() => ({}) as ReturnType<typeof parseGuardia>),
    getSesionAdmin().catch(() => null),
  ]);
  const { antes, despues } = mensajesDeArranque(e, h);
  // Con el onboarding ya terminado anota sólo el POST que lo cierra (`'cierre'`): el congelado del historial depende de que
  // el cierre quede anotado, y un POST viejo con todo terminado no tiene nada nuevo que contar (segunda revisión, 22/10).
  if (estricto && (o.anotar === 'cierre' || !h.terminado) && (await hechosConfirmados(h))) {
    await anotarHistorial({ antes, despues }, { primeroDeOffer: primeroDeOffer(h) })
      .catch((err) => console.error('[arranque] historial:', err instanceof Error ? err.message : err));
  }
  const etapa = etapaDeArranque(e, h);
  return {
    modo: h.modo,
    etapa,
    antes,
    despues,
    sesion: h.sesion,
    tieneSesion: e.sesionId != null,
    sesionCaida: h.sesionCaida,
    funnelDefaultId: h.modo === 'oferta' ? await idDelFunnelDefault().catch(() => null) : null,
    introVista: !!e.introVista,
    nombre: e.nombre ?? '',
    // Al link único (lib/app-tiendas.ts): lleva a la tienda de ese teléfono o, si todavía no está, a instalarla. Al entrar con su cuenta, sigue en este mismo paso.
    avisosQr: etapa === 'avisos' ? await QRCode.toDataURL(linkApp(RUTA_APP, null), { margin: 1, width: 336 }).catch(() => null) : null,
    telefonoNumero: e.telefonoNumero ?? '',
    telefonoDelPago: etapa === 'telefono' ? (await getSetting(CLAVE_WHATSAPP_DEL_PAGO).catch(() => null)) ?? '' : '',
    whatsapp: etapa === 'codigo' && e.telefonoEntrante
      ? await getWorkspaceActual().then((ws) => (ws == null ? null : estadoVerificacionEntrante(ws))).catch(() => null)
      : null,
    crmTipo: e.crmTipo ?? null,
    crmPropuesta: e.crmPropuesta ?? null,
    canal: h.canalNegocio,
    interes: e.interes ?? null,
    bloqueo: guardia.bloqueo ? { at: guardia.bloqueo.at, motivo: guardia.bloqueo.motivo } : null,
    equipo: superAdmin && guardia.bloqueo ? { ultimasFaltas: guardia.ultimasFaltas ?? [] } : null,
  };
}

/**
 * Escribe el nombre que dijo en su perfil (best-effort: ya quedó en la conversación), SÓLO si el perfil no tiene uno de
 * verdad (vacío o un email). Lo que se lee de lo escrito se recorta con reglas y no se confirma: pisaba el nombre completo
 * que trajo Google («María del Carmen Pérez» quedaba «María», cuarta revisión, 21/10). Para saludar alcanza el estado.
 */
export async function guardarNombre(nombre: string): Promise<void> {
  let actual: string | null | undefined;
  try { actual = (await getPerfil())?.nombre; } catch { return; /* sin leer el perfil no se decide pisarlo */ }
  if (!pisaElNombreDelPerfil(actual)) return;
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
export async function sembrarCrmPrincipal(tipo: TipoCrmId, nombreNegocio: string, nombres?: Readonly<Record<string, string>>): Promise<{ sembrado: boolean; aviso?: string }> {
  const siembra = siembraDeCrm({ tipo });
  if ('error' in siembra) throw new Error(siembra.error);
  // Las etapas con los nombres del CRM a medida (20/10/2026): mismas claves, otros nombres.
  const s = { ...siembra, pipeline: etapasConNombres(siembra.pipeline, nombres) };
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
 * El CRM a medida (20/10/2026, pedido del 18/10, punto 10: «el armado del CRM también debe ser personalizado»): con lo que
 * vende (las piezas de la conversación del onboarding), MaKo elige el tipo entre los de su canal y nombra sus etapas. null =
 * no se pudo (sin la conversación, o la IA no contestó algo que sirva): queda la plantilla de su canal, como antes.
 */
export async function propuestaDeCrm(e: EstadoArranque, canal: CanalId | null): Promise<PropuestaCrm | null> {
  if (!e.sesionId) return null;
  const sesion = await leerSesion(e.sesionId).catch(() => null);
  if (!sesion) return null;
  const { crmOffer } = await import('./offer-ia');
  const r = await crmOffer({ piezas: sesion.piezas, canal, candidatos: candidatosCrm(canal), inicio: Date.now() });
  return r.ok ? r.valor : null;
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
    await insertFile(ws, { id, nombre, mime: 'application/pdf', tamano: bytes.byteLength, storage_path: path, razonamiento: RAZON_LO_QUE_VENDES, campos: {}, origen: 'onboarding' });
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
        // Cuotas o mensual es una suscripción (20/10/2026, Florencia: cobra 6 cuotas y quedaba «pago único»), pero SÓLO lo
        // que confirmó con un toque (`e.cobro`, cuarta revisión, 21/10): lo leído sin confirmar no llega al producto.
        const cobro = e.cobro ?? { tipo: 'unico' as const, meses: null };
        await upsertProducto({
          nombre: sinMarca(propuesta?.nombre) || `Oferta de ${e.negocio ?? 'tu negocio'}`,
          tipo: cobro.tipo,
          monto_usd: null,
          suscripcion_meses: cobro.meses,
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
  // Con un «no» al PDF, lo que escribió que faltaba va acá: «lo anoto» tiene que quedar anotado (cuarta revisión, 21/10).
  // Un «no» sin nada escrito también deja marca (sexta revisión, 21/10: el «No» tocado no anotaba nada).
  const pdfNota = notaDelPdf(e);
  if (e.origen || e.interes || pdfNota) {
    await setSetting(CLAVE_ENCUESTA, JSON.stringify({ origen: e.origen ?? null, interes: e.interes ?? null, at: new Date().toISOString(), pdfNota }))
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
