// =============================================================================
// mako-turno-app — el turno del chat de MaKo en el TELÉFONO (MaKo Mobile)
// =============================================================================
// El «turno compartido» que pedía docs/api-mako-diseno.md §4.2 para que el chat de la app
// deje de ser sólo lectura: MaKo lee datos reales y PROPONE acciones, y la persona las
// confirma tocando la tarjeta del hilo (app/m/mako/acciones.ts → confirmarPendiente, que
// reclama antes de ejecutar y vuelve a mirar el gating). Lo usan app/api/m/mako/route.ts y
// app/m/mako/acciones.ts. El chat de escritorio (/api/mako-doer) sigue SÓLO LECTURA.
//
// Las piezas son las del doer de WhatsApp (lib/mako-doer-in.ts), sin el jid ni Evolution:
//   · qué herramientas viajan: `herramientasDelChat` → `herramientasDelTurno` sobre el
//     veredicto de `clasificarIntencion` (el MISMO camino; AGENTS.md, «Una capacidad nueva
//     del doer se prueba con el turno que CORRE»), sin confirmar_accion y sin las lecturas
//     de la agenda de Google (lib/mako-turno-app-reglas.ts);
//   · las pendientes vigentes del canal en el system y `ctx.turnStart` (el anti
//     auto-confirm de lib/api-mako/acciones.ts);
//   · `crearMemoDeAcciones` + `nuevoIntento()` en CADA corrida (lib/turno-sin-duplicar.ts);
//   · los links de una acción los escribe el CÓDIGO (`linksDeUnaAccion`).
//
// ⚠️ LA CLAVE DE SCOPE ES `app:<sesión>`, nunca `app:ws<N>`: una persona sólo ve, confirma o
// cancela lo que se propuso en ESE chat.
//
// ⚠️ LAS SESIONES SON POR PERSONA: `chart_key = mako-movil:<persona>` (chartKeyDePersona).
// `getSession(id)` de lib/chart-chats.ts NO filtra por clave, así que toda lectura o
// escritura por id pasa por `sesionDe`, que compara la clave. Y `listAllSessions` (la tab
// /mako de escritorio, que es por workspace) excluye `mako-movil:%` para no mostrarlos.
//
// ⚠️ UNA FOTO NO LLEGA AL MODELO COMO BLOQUE (medido el 11/10/2026, ver lib/mako-adjuntos.ts):
// se lee ANTES con el lector compartido (lib/archivo-a-texto.ts) y su texto entra al turno.
// =============================================================================

import 'server-only';
import { exigirPermisoIa } from '@/lib/ia-permiso';
import { CLAUDE_EN_PAUSA, chatClaudeTools, permisoDeLaClaveDelNegocio, type RichMsg, type ToolDef } from '@/lib/anthropic';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION } from '@/lib/mako-doer-acciones';
import { aToolDef, gatingOk, parecidasQueNoViajaron, porId, visible } from '@/lib/api-mako/registro';
import { errorParaTicket, type ErrorDelTurno } from '@/lib/tickets-reglas';
import { identidadDe } from '@/lib/tickets-db';
import { registrarError } from '@/lib/errores-app';
import { avisoClaveTapada, taparClaves } from '@/lib/claves-en-el-chat';
import { encolarTurno, esperarALaPc, pcDe, TopeDeTurnos, type Ejecutor } from '@/lib/ia-pc';
import { armarPrompt, AVISO_PC_ILEGIBLE, avisoDeLaPc, CLAVE_MODELO_PC, esperaDelTurno, laPersonaEstaAdentro, modeloPc, pcUsable, probarSuClaveTrasLaPc, PROVEEDORES_PC, RESERVA_RESPALDO_MS, type FalloDeLaPc, type ProveedorPc } from '@/lib/ia-pc-reglas';
import { IA_DE_LA_PC, MODELO_SU_OPENAI_DEFAULT, NOMBRE_MODELO_IA, type EleccionIA } from '@/lib/chat-ia-reglas';
import { claveDeIAPropia, negocioConSuIA } from '@/lib/ia-del-negocio';
import { entrarSoloSuIA } from '@/lib/solo-su-ia';
import { runnerDelRegistro, vistaDe } from '@/lib/api-mako/ejecutar';
import { confirmarPendiente, cancelarPendiente } from '@/lib/api-mako/acciones';
import { esAccion, type Ctx } from '@/lib/api-mako/tipos';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { clasificarIntencion, makoPreguntoAlgo, nombraGoogleCalendar } from '@/lib/mako-intencion';
import { permisoCalendarioGoogle } from '@/lib/google-calendar';
import { lineaDeOfrecibles, preguntoReunionOTarea } from '@/lib/doer-herramientas';
import { recetasDelTurno } from '@/lib/doer-recetas';
import { bloqueAgendaGoogle, hechoGoogleCalendar, agendaQueSigue, agendaSeCierra, agendaVigente, contextoAgendaAbierta, herramientasQueSiguen, ACCIONES_AGENDA } from '@/lib/agenda-sin-ia';
import { crearMemoDeAcciones, MARGEN_RELOJ_MS } from '@/lib/turno-sin-duplicar';
import { buildSystemPrompt } from '@/lib/mako-context';
import { avisoDePuntos } from '@/lib/puntos-mensaje';
import { validarRespuestaDoer } from '@/lib/respuesta-doer';
import { sanearSalida } from '@/lib/doer-salida';
import { credDelCliente, credWs, esNegocioDelEntorno } from '@/lib/credenciales';
import { getSetting, setSetting } from '@/lib/settings';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { runWithWorkspace, getWorkspaceActual, getRolWsEfectivo, getCapaActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { esTabConChatPropio } from '@/lib/chat-mako-reglas';
import {
  createSession, getSession, listSessions, getSessionMessagesConBloques, getMensajeConBloques, appendMessage,
  renameSession, tituloDesde, type ChartSession, type ChartMsg, type ChartMsgConBloques,
} from '@/lib/chart-chats';
import { adjuntosVisibles, audioDeBloques, leerRef, rutaDeVozDelChat, sanearBloques, vozDeBloques } from '@/lib/chat-mako-bloques';
import { urlAudio } from '@/lib/offer-reglas';
import { MAX_BLOQUES_MENSAJE, aGuardar, bloqueDeResultado, bloquesGuardados, esPorQueGuardado, type Bloque } from '@/lib/chat-bloques';
import { archivarPdfsDelChat, archivarPegadosDelChat, borrarAdjuntos, subirAdjuntos, subirNotaDeVozDelChat, urlFirmadaDeAdjunto } from '@/lib/chat-mako-adjuntos';
import { pedidoDelMensaje, recortarMensaje, textoParaTitulo, textosParaArchivar } from '@/lib/chat-pegado';
import { puedeArchivarConSuIA } from '@/lib/archivero-ingesta';
import { archivoATexto } from '@/lib/archivo-a-texto';
import { aFila, plano } from '@/lib/bandeja-filas';
import { descartarPropuesta, getPropuesta, propuestasPendientesDelChat } from '@/lib/propuestas';
import { descartarPropuesta as descartarBorradorDelPlan } from '@/lib/plan-propuesta';
import { resolverPropuesta as resolverPropuestaDeVideo } from '@/lib/editor-video/propuestas-server';
import { descartarBorrador } from '@/lib/evolution-envio';
import { getPendiente, resolverPendiente } from '@/lib/mako-pendientes';
import { PREGUNTAR, TOOL_PREGUNTAR, ERROR_TRAS_PREGUNTAR, crearGuardiaDePregunta, retirar } from '@/lib/chat-pregunta';
import { conDesde, conEntidadPorDefecto, contextoDesde, herramientasDelModo, pistaDesde, type Desde } from '@/lib/chat-desde';
import { enSegundoPlano } from '@/lib/chat-trabajos';
import { REGLA_NO_EXISTE } from '@/lib/no-existe';
import { cerrarSiVolvio, conTicketsDeMaKo, ticketDeNoPude, type DondeNoPude } from '@/lib/no-pude-server';
import { paqueteParaElTurno } from '@/lib/cerebro-para-chat';
import { esFallaTragadaDeHerramienta, esGuardaDeHerramienta, esLaReglaDeUnaGuarda, laUltimaFueGuarda, LINEA_YA_AVISADO, lineaCortaDelTicket, lineaDelTicket } from '@/lib/no-pude';
import { puedeVerKey } from '@/lib/movil-rutas';
import { bloquesDeAdjuntos, pedidoConLecturas, placeholderDeAdjunto, type AdjuntoListo } from '@/lib/mako-adjuntos';
import {
  chartKeyDePersona, canalKeyDeSesion, herramientasDelChat, tarjetaDePendiente, linksDeUnaAccion, abrirDeResultado, idDePropuesta, aRetirar,
  type FormularioPropuesta, type PropuestaPantalla,
  propuestaDePantalla, sinLinksDeRevision, MENSAJE_BORRADOR_APP, mensajeLeadApp, TEXTO_SOLO_TARJETA, TEXTO_SOLO_BLOQUE,
  historialParaModelo, bloquesDelMensaje, entraOtroDibujo, confirmadoTrasElUltimoPedido, esPedido, salioBien, hoyLegible, errorCortoDeTarjeta, conInstruccionDeTarjeta, faltaIADelNegocio, avisoSinIA, porQueSinRespuesta,
  iaParaConectar, IA_PARA_CONECTAR, ENV_DE_IA, falloDeSuClave, AVISO_SU_CLAVE, falloDeSuOpenAI, AVISO_SU_OPENAI, avisoSinElModelo, AVISO_CONECTA_TU_PC, AVISO_NO_LEI_SU_IA, AVISO_SIN_ARCHIVERO, AVISO_ARCHIVERO_EN_PAUSA,
  type LinkCapturado, type MensajeChat, type RespuestaTurno, type ResultadoTarjeta, type SesionChat, type TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';

/** La feature registrada del doer (lib/model-catalogo.ts → Gemini). Claude está vetado. */
const FEATURE = 'mako-doer';
/** Cuánto texto ESCRITO de la persona entra por mensaje (lo pegado tiene el suyo, lib/chat-pegado.ts). Eran 8.000 y Martín
 *  (18/10): «tiene que dejar mensajes mucho más largos». Lo que pasa de acá se dice y queda entero en El Archivero. */
const TOPE_MENSAJE = 20_000;

// ── Quién habla ──────────────────────────────────────────────────────────────

export type PersonaChat = {
  ws: number;
  /** el rol REAL en el workspace: un closer/setter es 'miembro' y no ve lo de admin */
  rol: 'admin' | 'miembro';
  /** quién confirma, para el historial de la pendiente */
  actor: string;
  /** de quién son las sesiones (chartKeyDePersona) */
  chartKey: string;
  /** la persona de la sesión (`usuarios.id`): «mi hoja» del Dashboard y de General es la suya (`Ctx.quien`) */
  quien?: { sub: string; email: string; nombre: string };
};

export type FalloPersona = { error: string; status: 400 | 401 | 403 };

/**
 * La persona del request, o por qué no. Exige sesión ADENTRO (el proxy no alcanza como red)
 * y la misma regla del Sidebar para la tab MaKo (`puedeVerKey`, lib/movil-rutas.ts): rol +
 * capa del workspace. El workspace sale de `getWorkspaceActual()`, nunca del `?ws=` crudo.
 */
export async function personaDelRequest(): Promise<PersonaChat | FalloPersona> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'Tu sesión venció.', status: 401 };
  const rolWs = await getRolWsEfectivo();
  if (!rolWs) return { error: 'Tu sesión venció.', status: 401 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Elige una cuenta primero.', status: 400 };
  const capa = await getCapaActual().catch(() => null);
  if (!puedeVerKey('mako', rolWs, capa)) return { error: 'MaKo no está en tu cuenta.', status: 403 };
  const chartKey = chartKeyDePersona(sesion);
  if (!chartKey) return { error: 'Tu sesión venció.', status: 401 };
  // Sólo una persona de verdad (`usuarios.id`): una sesión 'dev' o 'password' no tiene un informe propio.
  const quien = /^\d+$/.test(String(sesion.sub)) ? { sub: String(sesion.sub), email: (sesion.email ?? '').toLowerCase(), nombre: sesion.nombre ?? '' } : undefined;
  return { ws, rol: rolWs === 'admin' ? 'admin' : 'miembro', actor: sesion.email || sesion.nombre || sesion.sub, chartKey, quien };
}

// ── Las sesiones de la persona ───────────────────────────────────────────────

const aSesion = (s: ChartSession): SesionChat => ({ id: s.id, titulo: s.titulo, pinned: s.pinned, updatedAt: s.updated_at });

/** La sesión si es de ESTA persona; null si no existe o es de otro (no se distingue: a
 *  quien no le corresponde, no existe). */
async function sesionDe(persona: PersonaChat, sessionId: number): Promise<ChartSession | null> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) return null;
  const s = await getSession(sessionId);
  return s && s.chart_key === persona.chartKey ? s : null;
}

export async function listarSesiones(persona: PersonaChat): Promise<SesionChat[]> {
  return runWithWorkspace(persona.ws, async () => (await listSessions(persona.chartKey)).map(aSesion));
}

/** Una sesión vacía. Sin saludo del modelo: cada «Nuevo chat» costaba dos llamadas (el
 *  saludo y el título) en el chat de escritorio. */
export async function nuevaSesion(persona: PersonaChat): Promise<SesionChat> {
  return runWithWorkspace(persona.ws, async () => aSesion(await createSession(persona.chartKey, null, '')));
}

/**
 * LA conversación de una tab con chat propio (el Second Brain, 23/10/2026: lib/chat-mako-reglas.ts → TAB_SECOND_BRAIN), con la
 * clave de la persona y el sufijo de la tab: UNA por persona y por negocio (`runWithWorkspace`). `crear`: si no hay, la crea
 * (vacía, sin título: el primer turno se lo pone). Sin `crear`, null si todavía no habló. La tab es de una lista cerrada.
 */
export async function sesionDeTab(persona: PersonaChat, tab: string, crear: boolean): Promise<SesionChat | null> {
  if (!esTabConChatPropio(tab)) return null;
  const clave = `${persona.chartKey}:${tab}`;
  return runWithWorkspace(persona.ws, async () => {
    const ya = (await listSessions(clave)).sort((a, b) => a.id - b.id)[0];
    if (ya) return aSesion(ya);
    return crear ? aSesion(await createSession(clave, null, '')) : null;
  });
}

/** Las tarjetas de las pendientes vigentes de UN chat (las de este turno, con `desde`).
 *  La fila sale de `aFila` (lib/bandeja-filas.ts), la misma de /mako/pendientes y de Inbox.
 *  ⚠️ `pendientesVigentes` ESCRIBE (vence lo vencido antes de leer): bien acá, que es una
 *  pantalla o un turno; nunca en un badge con polling. */
const tarjetasVigentes = async (ws: number, canalKey: string, desde?: number): Promise<TarjetaPendiente[]> => {
  const vigentes = (await pendientesVigentes(ws, canalKey))
    .filter((p) => desde == null || Date.parse(p.createdAt) >= desde - MARGEN_RELOJ_MS);
  if (!vigentes.length) return [];
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  return vigentes.map((p) => tarjetaDePendiente(p, aFila(p, tz)));
};

/** Los mensajes de la sesión y las acciones que esperan confirmación en ella. */
export async function abrirSesion(persona: PersonaChat, sessionId: number): Promise<{ sesion: SesionChat; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[]; pantallas: PropuestaPantalla[] } | null> {
  return runWithWorkspace(persona.ws, async () => {
    const s = await sesionDe(persona, sessionId);
    if (!s) return null;
    const [mensajes, propuestas, pantallas] = await Promise.all([
      getSessionMessagesConBloques(s.id),
      tarjetasVigentes(persona.ws, canalKeyDeSesion(s.id)),
      pantallasDelChat(persona, canalKeyDeSesion(s.id)).catch(() => [] as PropuestaPantalla[]),
    ]);
    return { sesion: aSesion(s), mensajes: mensajes.map((m) => aMensajeChat(persona.ws, m)), propuestas, pantallas };
  });
}

/**
 * El formulario de una propuesta genérica, para confirmarla ADENTRO del chat (1.10, docs/ops-center-principal.md §2.5):
 * los mismos datos planos que arma /mako/revisar/<id>. null = no va adentro: no es genérica, ya no está pendiente, su
 * operación no existe, o mueve plata (eso espera a la D2 y se sigue confirmando en su pantalla).
 */
async function formularioDe(propuestaId: string, rol: PersonaChat['rol']): Promise<FormularioPropuesta | null> {
  const prop = await getPropuesta(propuestaId).catch(() => null);
  if (!prop || prop.tipo !== 'accion' || prop.estado !== 'pendiente') return null;
  const def = porId(String(prop.datos.operacion ?? ''));
  if (!def || !esAccion(def) || def.costo === 'dinero') return null;
  const payload = prop.datos.payload && typeof prop.datos.payload === 'object' && !Array.isArray(prop.datos.payload) ? prop.datos.payload as Record<string, unknown> : {};
  return {
    propuestaId: prop.id, payload, puedeDecidir: rol === 'admin',
    operacion: { id: def.id, titulo: def.titulo, descripcion: def.descripcion, escribe: def.escribe, reversible: def.reversible, parametros: def.parametros.map(plano) },
  };
}

/** La propuesta de pantalla con su formulario, si va adentro. */
async function conFormulario(p: PropuestaPantalla, rol: PersonaChat['rol']): Promise<PropuestaPantalla> {
  const id = p.clase === 'accion' ? idDePropuesta(p.escritorio) : null;
  const form = id ? await formularioDe(id, rol) : null;
  return form ? { ...p, form } : p;
}

/** Las propuestas genéricas que siguen pendientes de ESTE chat: al volver, están, con su formulario. */
async function pantallasDelChat(persona: PersonaChat, canalKey: string): Promise<PropuestaPantalla[]> {
  const props = await propuestasPendientesDelChat(canalKey);
  return Promise.all(props.map((pr) => conFormulario(
    propuestaDePantalla({ clase: 'accion', url: `/mako/revisar/${pr.id}`, operacion: String(pr.datos.operacion ?? '') }), persona.rol)));
}

/** Un mensaje guardado, para la pantalla: sus adjuntos sin el path (lib/chat-mako-bloques.ts). */
function aMensajeChat(ws: number, m: ChartMsgConBloques): MensajeChat {
  const bloques = sanearBloques(ws, m.bloques);
  const vista = bloquesGuardados(m.bloques);
  const audio = audioDeBloques(m.bloques);
  const voz = vozDeBloques(ws, m.bloques);
  return {
    role: m.role, content: m.content, created_at: m.created_at,
    ...(bloques.length ? { adjuntos: adjuntosVisibles(m.id, bloques) } : {}), ...(vista.length ? { bloques: vista } : {}),
    // La nota de voz de una respuesta copiada de Offer (el chat «Onboarding»): se reproduce desde la ruta de Offer.
    ...(audio ? { audio: { url: urlAudio(audio.sesion, audio.mensaje), secs: audio.secs } } : {}),
    // La de la persona en ESTE chat (OC7): se pide por su mensaje (`urlDeVozDelChat`).
    ...(voz && !audio ? { audio: { url: rutaDeVozDelChat(m.id), secs: voz.secs } } : {}),
  };
}

/** La regla de un chat que la persona SIGUE con `antes` (uno de antes, o el de una tab): la de la ruta (route.ts → personaDelChat). */
export type ReglaDeOtroChat = (sesion: number) => Promise<PersonaChat | null>;

/**
 * ¿Quién puede abrir lo guardado en la conversación `sesion`? La persona, si es SU chat. Si no, la persona con la clave de ese
 * chat, si la regla que deja SEGUIRLO la deja (`deOtroChat`): un chat de antes o el de una tab (22/10/2026). Para el admin
 * ésa es la de leer su texto, así que quien lee el mensaje abre su foto o escucha su nota, a propósito. Nunca una clave armada
 * a mano. null = nadie que pueda.
 */
async function quienAbre(persona: PersonaChat, sesion: number, deOtroChat?: ReglaDeOtroChat): Promise<PersonaChat | null> {
  if (await sesionDe(persona, sesion)) return persona;
  const otro = deOtroChat ? await deOtroChat(sesion) : null;
  return otro && (await sesionDe(otro, sesion)) ? otro : null;
}

/**
 * El link firmado de un adjunto guardado (`ref` = `<id del mensaje>:<n>`), o null. Mira de QUIÉN es la conversación
 * del mensaje ANTES de firmar (`quienAbre`): los chats son por persona, así que el admin no abre los adjuntos de un closer.
 * ⚠️ Hasta el 22/10/2026 sólo miraba el chat PROPIO: la foto o el PDF de un chat de antes o de una tab daba 404.
 */
export async function urlDeAdjunto(persona: PersonaChat, ref: unknown, deOtroChat?: ReglaDeOtroChat): Promise<string | null> {
  const r = leerRef(ref);
  if (!r) return null;
  return runWithWorkspace(persona.ws, async () => {
    const m = await getMensajeConBloques(r.msgId);
    if (!m || !(await quienAbre(persona, m.session_id, deOtroChat))) return null;
    const b = sanearBloques(persona.ws, m.bloques)[r.i];
    return b ? urlFirmadaDeAdjunto(b.path) : null;
  });
}

/** El link firmado de la nota de voz de un mensaje, o null. Como `urlDeAdjunto`: mira de QUIÉN es la conversación antes. */
export async function urlDeVozDelChat(persona: PersonaChat, msgId: unknown, deOtroChat?: ReglaDeOtroChat): Promise<string | null> {
  const id = typeof msgId === 'string' && /^\d{1,15}$/.test(msgId) ? Number(msgId) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return runWithWorkspace(persona.ws, async () => {
    const m = await getMensajeConBloques(id);
    if (!m || !(await quienAbre(persona, m.session_id, deOtroChat))) return null;
    const v = vozDeBloques(persona.ws, m.bloques);
    return v ? urlFirmadaDeAdjunto(v.path) : null;
  });
}

/** Lo que se dice cuando se escuchó la nota y no había voz (el de Offer: app/api/offer/route.ts → transcribir). */
export const NOTA_SIN_VOZ = 'Escuché tu audio pero no le entendí nada: grábalo de nuevo un poco más cerca del micrófono, o escríbemelo.';

/**
 * LA NOTA DE VOZ DEL CHAT (OC7, 22/10/2026): la escucha la IA del NEGOCIO (D6b, como todo el turno: su OpenAI o su Gemini, nunca
 * la red de la plataforma con «sólo su IA») ANTES de guardar nada, como Offer: si nadie la puede escuchar, no queda un mensaje
 * mudo. 424 = ninguna IA pudo (el texto dice cuál y por qué; se reintenta con la misma grabación); 422 = se escuchó y no había
 * voz (no sirve mandar lo mismo). Un 4xx y no un 502: la pantalla toma un 5xx por «no sé si llegó» (app/m/mako/chat-ui.ts →
 * leerRespuesta) y la nota no volvía a la barra. Lo que se entendió es el mensaje del turno (`turnoApp`); el MP3 se guarda con él.
 */
export async function escucharNotaDelChat(persona: PersonaChat, sessionId: number, bytes: Uint8Array):
  Promise<{ ok: true; texto: string } | { ok: false; error: string; status: 404 | 422 | 424 }> {
  // Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i), lib/ia-permiso.ts).
  await exigirPermisoIa();
  return runWithWorkspace(persona.ws, async () => {
    // El chat es de quien la manda ANTES de escucharla: si no, cada nota a un chat ajeno gastaba la IA y volvía 404 (revisión).
    if (!(await sesionDe(persona, sessionId))) return { ok: false, error: 'No encuentro ese chat.', status: 404 };
    const negocio = await negocioConSuIA(persona.ws);
    entrarSoloSuIA(negocio.suIA);
    const { transcribirAudio, SttSinEscucha, errorDeCascada } = await import('@/lib/ai-cheap');
    let texto: string;
    try {
      // ⚠️ `pii: true` (la revisión de Integración, 22/10/2026): sin él, si las claves del negocio no pueden, el MP3 iba a la red
      // gratis de la agencia (Groq y Gemini, y el Gemini gratis ENTRENA con lo que recibe). En la nota se habla de los leads, y
      // el texto de este mismo chat nunca va ahí. Como las notas de WhatsApp (lib/mako-doer-in.ts) y el dictado del Plan.
      texto = (await transcribirAudio(Buffer.from(bytes).toString('base64'), 'audio/mpeg', { language: 'es', feature: FEATURE, motivo: 'MaKo: escuchar una nota de voz del chat', pii: true })).trim();
    } catch (e) {
      const delNegocio = e instanceof SttSinEscucha ? e.errores : [e instanceof Error ? e.message : String(e)];
      console.error('[mako-turno-app] nota de voz:', delNegocio.join(' | ').slice(0, 300));
      return { ok: false, error: await errorDeCascada(delNegocio, 'escuchar tu audio'), status: 424 };
    }
    return texto ? { ok: true, texto } : { ok: false, error: NOTA_SIN_VOZ, status: 422 };
  });
}

// ── El system del turno ──────────────────────────────────────────────────────

const VOZ_APP = `CONTEXTO: estás en el chat de MaKo en el TELÉFONO de la persona (el dueño del negocio o alguien de su equipo). Responde breve y claro (2-5 líneas), sin volcar JSON ni tecnicismos. Ves el historial de este chat: úsalo y no pidas datos que ya te dieron.
LA VOZ: directa y cálida, SIN groserías ni lunfardo (ninguna mala palabra ni insulto, tampoco en broma): este chat lo usan los clientes de MaKo y su equipo.`;

/** El protocolo de herramientas: SÓLO si viajan herramientas (AGENTS.md, «Un prompt que
 *  ORDENA usar algo que no se mandó…»). */
const TOOLS_APP = `TUS HERRAMIENTAS (la lista exacta de este turno está al final): úsalas para responder con datos reales; nunca inventes nombres, números ni fechas. Si te preguntan por un lead, una reunión o una campaña, BÚSCALO antes de decir que no lo tienes. Si necesitas varios datos, pide todas las herramientas en el mismo paso.
Una lectura trae el dato. Una acción NUNCA ejecuta directo: o deja una acción pendiente, o deja una propuesta para revisar en una pantalla.`;

/** Lo que cambia en ESTE canal y manda sobre las recetas (que hablan de WhatsApp). */
const CANAL_APP = `EN ESTE CHAT (la app en el teléfono), y esto manda sobre lo de arriba:
- Una acción pendiente se confirma TOCANDO la tarjeta que el sistema pone debajo de tu mensaje, no con un «sí» escrito, y tú no puedes confirmarla. Di en una línea qué vas a hacer y que lo confirme en la tarjeta.
- Lo que se revisa en una pantalla (un borrador del plan, la ficha de un lead, un formulario) la persona lo abre desde Inbox.
- NO escribas links, rutas ni ids: los pone el sistema. Y nada de separar en varios mensajes con ---.`;

const SIN_TOOLS_APP = `EN ESTE TURNO NO TIENES HERRAMIENTAS: no puedes mirar el CRM, el plan ni las campañas. ⛔ NO inventes números, nombres ni fechas, y no los deduzcas de la conversación. Si te piden un dato del negocio, dilo en una línea («pídemelo con lo que necesitas y lo busco») y nada más.`;

// ── El turno ─────────────────────────────────────────────────────────────────

export type EntradaTurnoApp = {
  mensaje: string;
  adjuntos?: AdjuntoListo[];
  /**
   * Quién es el REFERENTE de este chat (su `IdAsesor`), si tiene uno al frente.
   *
   * ⚠️ NO ES LO MISMO QUE `contexto`, y por eso viaja aparte (2/11/2026). `contexto` lleva su FICHA
   * —cómo piensa, 5.200 caracteres, en CADA mensaje—; esto sólo dice QUIÉN es, para que el Second
   * Brain cuelgue su curso ENTERO como capa y traiga la clase que la pregunta pida, sin que el
   * curso viaje en cada turno (lib/cerebro-para-chat.ts, lib/cerebro-referente.ts).
   */
  referente?: string | null;
  /**
   * Las herramientas PROPIAS de este chat (ids del registro): el coach del Ops Center (lib/asesores/contexto.ts →
   * `HERRAMIENTAS_DEL_COACH`, 4/11/2026). Viajan en cada turno que lleva herramientas, primero y dentro del presupuesto
   * (lib/doer-herramientas.ts → `propias`). Las pone el SERVIDOR según la conversación, nunca el navegador.
   */
  propias?: readonly string[];
  /**
   * Lo que la PANTALLA ata a esta conversación: hoy, la ficha de un lead en «MaKo Analyst»
   * (lib/mako-analyst-lead.ts, 12/10/2026: «un chat con la IA que por defecto tenga atado los
   * datos de ese lead»). Lo arma el código leyendo la API de MaKo EN ESTE turno y va al FINAL
   * del system, así que manda sobre la voz del teléfono. NO se guarda en el hilo: los datos del
   * lead cambian entre turnos, y guardados serían la foto del primero (AGENTS.md, «Un dato
   * EXACTO que viaja con un trabajo diferido es la FOTO de cuando se guardó»). Sin esto, el
   * turno de siempre.
   */
  contexto?: string;
  /**
   * Lo que la PANTALLA antepone al texto que se CLASIFICA (la intención y las herramientas del turno), no al que lee el
   * modelo ni al que se guarda. Hoy: el chat de la ficha del lead mientras se EDITA la vista (17/10/2026, Martín: «Al
   * momento de EDITAR, también debería salir automáticamente este modal, pero ahora ya no para analizar al lead, sino
   * para editar la vista»). Medido ese día con el selector de herramientas: «hazla épica», «saca el bloque de notas» o
   * «cambia el nombre de esta hoja» SOLOS no traen `cambiar_ficha_funnel` (se clasifican «capturar» o se quedan afuera
   * del presupuesto); con «Cambia la ficha del CRM: » adelante, los seis pedidos medidos la traen.
   */
  pista?: string;
  /**
   * DESDE DÓNDE ESCRIBE (22/10/2026, OC6, lib/chat-desde.ts): la tab, la entidad que tiene abierta y el modo. La entidad va en
   * la pista y en el system, y las herramientas la toman por defecto; en «analizar» no viaja ninguna que escriba. El mensaje
   * se guarda con su marca («[desde: CRM › Ana]»): el chip vuelve al recargar.
   */
  desde?: Desde | null;
  /**
   * SÓLO la prueba de punta a punta que se corre a mano (scripts/ia-pc/probar-punta-a-punta.mts): llega a la PC sin la sesión
   * del pedido, y sólo con la persona de prueba del ws3 (`laPersonaEstaAdentro`). En cualquier otro negocio o persona, la PC
   * no se usa, aunque haya sesión.
   */
  pruebaSinSesion?: boolean;
  /**
   * Guardar los archivos (mig 0305) y pasar los PDF del admin a El Archivero. Lo prenden SÓLO el Second Brain y el chat
   * del teléfono (las rutas /api/mako/chat y /api/m/mako). Sin esto, el turno de siempre: los lee y no los guarda.
   */
  guardarAdjuntos?: boolean;
  /**
   * La nota de voz del mensaje (OC7, 22/10/2026): el MP3 y cuánto dura. Lo que se ENTENDIÓ ya viene en `mensaje`
   * (`escucharNotaDelChat`, antes del turno); esto es el binario, que se guarda con el mensaje (con `guardarAdjuntos`) para
   * volver a escucharlo. Va sola: sin archivos.
   */
  voz?: { bytes: Uint8Array; secs: number } | null;
  /**
   * El `maxDuration` de la ruta que llama, en ms (300 s si no se dice): lo que se espera a la PC del cliente sale de acá
   * (`esperaDelTurno`). El Analyst del lead tiene 300 s y no 420, y Vercel cortaba sin aviso (revisión del 21/10/2026).
   */
  plazoMs?: number;
  /**
   * CON QUÉ IA CORRE ESTE MENSAJE (8b, 23/10/2026; lib/chat-ia-reglas.ts): lo que la persona eligió en el «+» de la caja, YA
   * validado por la ruta (lib/chat-ia.ts → eleccionDelPedido: una cuenta suya, que se le ofrecería ahora). null o sin esto,
   * Automático (lo decide el chat jefe: su computadora, y si no puede, sus claves).
   *   · pc: su computadora, con el modelo elegido, y si no contesta NO cae a las claves (eligió ésa);
   *   · anthropic: directo a SU Claude (la puerta 2), con el modelo elegido; con el crédito de MaKo, Haiku igual;
   *   · openai: directo a SU OpenAI, sin caer a Claude.
   */
  ia?: EleccionIA;
};

/** El plazo de una ruta que no dice el suyo: el más corto de las que llaman al turno (app/api/crm/analyst). */
const PLAZO_RUTA_MS = 300_000;

/** El cartel de la plataforma: se muestra y NO se guarda (AGENTS.md, «Un cartel de la
 *  PLATAFORMA no es un turno de la conversación»). */
const AVISO_NO_PUDE = 'No pude contestar ahora. Tu mensaje quedó guardado.';

/**
 * Cuántas cuentas de IA PROPIAS del negocio puede usar el turno con herramientas: las de la cascada de `chatClaudeTools`
 * (`CASCADA_TOOLS`), leídas con `provsDe`, que ya saca las copias de la plataforma. Es la misma cuenta que hace la
 * cascada, así que no puede decir «tienes» donde la cascada no encontró nada. `null` = no se pudo leer.
 */
async function iaPropiaDelTurno(): Promise<number | null> {
  try {
    const { provsDe, CASCADA_TOOLS } = await import('@/lib/ai-cheap');
    let n = 0;
    for (const p of CASCADA_TOOLS) n += (await provsDe(p)).length;
    // Y su Claude, que el turno usa cuando ninguna barata contesta (`chatClaudeTools`, 20/10/2026): un negocio con sólo
    // su Claude TIENE con qué contestar. En pausa también: es SU Claude, y lo que hay que decirle es que está en pausa,
    // no que conecte uno (revisión del Cerebro, 21/10/2026).
    const claude = await permisoDeLaClaveDelNegocio(FEATURE);
    // Sin poder comprobarla no se sabe si tiene: lo mismo que el `catch` de abajo.
    if (claude && 'noPudeLeer' in claude) return null;
    if (claude) n++;
    return n;
  } catch {
    return null;
  }
}

// `puedeArchivarConSuIA` (¿hay con qué pasar un archivo a El Archivero sin la cascada barata?) se mudó a
// lib/archivero-ingesta.ts el 3/11/2026: la API (`sumar_documento_second_brain`) pregunta lo mismo.

/** Las IA que el negocio tiene guardadas en SU fila (`credDelCliente`, sin el entorno), para abrirle la que ya eligió. */
async function iaConFila(): Promise<string[]> {
  const out: string[] = [];
  for (const s of IA_PARA_CONECTAR) if (await credDelCliente(ENV_DE_IA[s]).catch(() => null)) out.push(s);
  return out;
}

/** Mandarle un ticket al equipo de MaKo (lib/api-mako/areas/tickets.def.ts): viaja SIEMPRE en el chat de la app, para
 *  que MaKo pueda proponerlo cuando la persona pide algo que la app todavía no tiene (docs/diseno-ticketera-usuarios.md). */
const LEVANTAR_TICKET = 'levantar_ticket';
const TICKET_TOOLS: ToolDef[] = (() => { const d = porId(LEVANTAR_TICKET); return d ? [aToolDef(d)] : []; })();
/** Lo que el CÓDIGO le dice a la persona cuando lo que falló ya entró a la Ticketera (no lo escribe el modelo). */
const AVISO_NO_LEI = (nombre: string) => `No pude leer «${nombre}».`;

/**
 * Un turno del chat del teléfono. Devuelve null si la sesión no es de esta persona.
 * Nunca tira por un fallo del modelo: lo devuelve como `aviso` (y no lo guarda). Sin texto
 * ni archivos tira: eso lo frena antes quien llama.
 */
export async function turnoApp(persona: PersonaChat, sessionId: number, entrada: EntradaTurnoApp): Promise<RespuestaTurno | null> {
  // Antes de todo: el turno puede salir por la PC del cliente, que no pasa por las puertas de lib/anthropic.ts ni de lib/ai-cheap.ts.
  // Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i), lib/ia-permiso.ts).
  await exigirPermisoIa();
  // Desde acá corre el plazo de la ruta: lo que se hace DESPUÉS de responder (El Archivero) se mide contra esto.
  const inicio = Date.now();
  return runWithWorkspace(persona.ws, async () => {
    const s = await sesionDe(persona, sessionId);
    if (!s) return null;
    const ws = persona.ws;
    // ── D6b: ¿el NEGOCIO corre con su IA? (su PC, su Claude o su GPT; lib/ia-del-negocio.ts) ─────────────────────────
    // Se decide por negocio y fallando cerrado, y TODO lo que sigue del turno corre adentro (lib/solo-su-ia.ts): la lectura
    // de las fotos, El Archivero, el modelo y lo que corre después de responder no tocan ninguna key barata ni la red de la
    // plataforma.
    const negocio = await negocioConSuIA(ws);
    entrarSoloSuIA(negocio.suIA);
    const desde = entrada.desde ?? null;
    const canalKey = canalKeyDeSesion(s.id);
    // El corte respeta los TEXTOS PEGADOS (lib/chat-pegado.ts, #848/#864): lo escrito hasta TOPE_MENSAJE, los pegados
    // con su propio tope, y las marcas siempre cerradas.
    // ⚠️ NUNCA UNA KEY EN EL CHAT (pieza 1.6, 20/10/2026): una clave pegada se TAPA antes de todo —el historial, el
    // título, El Archivero y el modelo— y la respuesta trae el botón «Conectar» de su servicio (lib/claves-en-el-chat.ts).
    // Desde aquí, el mensaje de la persona es `mensaje`: el crudo no se vuelve a leer.
    const tapado = taparClaves(entrada.mensaje ?? '');
    const mensaje = tapado.texto;
    // Lo que va ENTERO a El Archivero (#884: cada TEXTO PEGADO largo, y lo escrito que no entra en el tope), ANTES del
    // corte: el aviso del corte dice si quedó ahí (lib/chat-pegado.ts). Sólo del admin y con `guardarAdjuntos`: el MaKo
    // Analyst de un lead usa este turno y lo que se pega ahí es del LEAD.
    // ⛔ D6b: con su propio Claude, El Archivero extrae con SU clave de Claude o SU OpenAI, nunca con la cascada barata
    // ni con la red gratis de la plataforma (revisión del Cerebro, 21/10/2026: un pegado de 40 leads iba a la Gemini de
    // la agencia). Sin ninguna de las dos, no se archiva, y se dice.
    const paraArchivar = persona.rol === 'admin' && entrada.guardarAdjuntos ? textosParaArchivar(mensaje.trim(), TOPE_MENSAJE) : [];
    const archiva = !paraArchivar.length ? 'no' : negocio.suIA ? await puedeArchivarConSuIA() : 'si';
    const textoPersona = recortarMensaje(mensaje.trim(), TOPE_MENSAJE, undefined, archiva === 'si');
    const adjuntos = entrada.adjuntos ?? [];
    const avisos: string[] = [];

    // Los archivos se LEEN antes: el bloque nativo no le llega al modelo del doer (ver la
    // cabecera). El lector es el mismo del importador del tablero.
    const lecturas: Array<{ nombre: string; texto: string }> = [];
    const textos: Array<string | null> = [];
    for (const a of adjuntos) {
      const leido = await archivoATexto(new File([a.bytes as BlobPart], a.nombre, { type: a.mime })).catch(() => null);
      const texto = leido?.texto?.trim() || null;
      textos.push(texto);
      if (texto) lecturas.push({ nombre: a.nombre, texto });
      else avisos.push(negocio.suIA ? AVISO_NO_LEI_SU_IA(a.nombre) : AVISO_NO_LEI(a.nombre));
    }
    // Lo que queda en la MEMORIA del chat: el texto de la persona, o el placeholder del archivo.
    const textoMemoria = adjuntos.length === 1
      ? placeholderDeAdjunto(adjuntos[0].tipo, adjuntos[0].nombre, textoPersona)
      : adjuntos.length > 1
        ? `(envió ${adjuntos.length} archivos: ${adjuntos.map((a) => a.nombre).join(', ')})${textoPersona ? ` — ${textoPersona}` : ''}`
        : textoPersona;
    // La ruta ya lo frena; acá es la red para otro llamador.
    if (!textoMemoria) throw new Error('turnoApp: mensaje vacío');

    // El historial de ANTES de este mensaje: se lee antes de guardarlo.
    // Sin el porqué de un turno sin respuesta (la marca `porque`): es un cartel de la plataforma guardado en el hilo, no algo
    // que dijo MaKo, y el modelo no lo tiene que continuar (AGENTS.md, «Un cartel de la PLATAFORMA no es un turno»).
    const previos = (await getSessionMessagesConBloques(s.id)).filter((m) => !(m.role === 'assistant' && esPorQueGuardado(m.bloques)));

    // LO QUE ESCRIBIÓ LA PERSONA SE GUARDA SIEMPRE, antes del modelo.
    // Los archivos se guardan (mig 0305): el binario ANTES, y su referencia en el mismo insert del mensaje
    // (lib/chat-mako-adjuntos.ts). Si el mensaje quedó sin ella, el binario no queda suelto.
    const guardados: MensajeChat[] = [];
    // ⚠️ SÓLO SI QUIEN LLAMA LO PIDE (`guardarAdjuntos`): el Second Brain y el chat del teléfono. El MaKo Analyst de un
    //    lead usa este mismo turno, y su PDF es del LEAD: no va a El Archivero del negocio (revisión del 16/10/2026).
    const subidos = adjuntos.length && entrada.guardarAdjuntos ? await subirAdjuntos(ws, adjuntos) : [];
    const bloques = subidos.map((x) => x.bloque);
    // La nota de voz (OC7), con el mensaje: va AL FINAL, así las posiciones de los adjuntos (`<id>:<n>`) no cambian.
    // Con una clave DICTADA (tapada en el texto), el audio no se guarda: la dice (la revisión, 22/10/2026).
    const voz = entrada.voz && entrada.guardarAdjuntos && !tapado.tapadas ? await subirNotaDeVozDelChat(ws, entrada.voz) : null;
    // ⚠️ NO LLAMAR A ESTO `aGuardar`: ese nombre es el de la función importada de lib/chat-bloques, y una const local
    // con el mismo nombre la TAPA en todo `turnoApp` —incluido el `conElMensaje.map(aGuardar)` de la respuesta, que
    // entonces recibe un array donde espera un callback y revienta en ejecución (pasó entre el 22 y el 24/10/2026).
    const conElPedido = voz ? [...bloques, voz] : bloques;
    let msg: Awaited<ReturnType<typeof appendMessage>>;
    try {
      // Con su marca de desde dónde (OC6): lo que vuelve en `guardados` va sin ella, así el hilo no lo toma por un texto tapado.
      msg = await appendMessage(s.id, 'user', conDesde(textoMemoria, desde), conElPedido);
    } catch (e) {
      await borrarAdjuntos(conElPedido.map((b) => b.path)); // el mensaje no quedó: sus binarios tampoco
      throw e;
    }
    if (conElPedido.length && !msg.conBloques) await borrarAdjuntos(conElPedido.map((b) => b.path));
    const conArchivos = msg.conBloques && msg.id != null ? adjuntosVisibles(msg.id, bloques) : [];
    const conVoz = voz && msg.conBloques && msg.id != null ? { audio: { url: rutaDeVozDelChat(msg.id), secs: voz.secs } } : {};
    guardados.push({ role: 'user', content: textoMemoria, ...(conArchivos.length ? { adjuntos: conArchivos } : {}), ...conVoz });
    // Un PDF del ADMIN, también a El Archivero, después de responder (lib/chat-mako-adjuntos.ts dice por qué sólo él).
    const msgId = msg.id;
    const pdfs = persona.rol === 'admin' && msg.conBloques && msgId != null ? subidos.flatMap(({ bloque, de }, i) => {
      const texto = textos[de];
      return bloque.tipo === 'document' && texto ? [{ i, contenido: adjuntos[de].bytes, nombre: bloque.nombre, mime: bloque.mime, texto }] : [];
    }) : [];
    // Lo pegado y lo escrito largo del admin, ENTERO (antes del corte del mensaje), también a El Archivero: se guarda
    // solo, sin pedirlo, como los PDF (#884, lib/chat-mako-adjuntos.ts → archivarPegadosDelChat). Ver `paraArchivar`.
    if (pdfs.length || paraArchivar.length) {
      const puede = paraArchivar.length ? archiva : negocio.suIA ? await puedeArchivarConSuIA() : 'si';
      if (puede !== 'si') avisos.push(puede === 'pausa' ? AVISO_ARCHIVERO_EN_PAUSA : AVISO_SIN_ARCHIVERO);
      else {
        if (pdfs.length && msgId != null) await archivarPdfsDelChat(ws, msgId, inicio, pdfs);
        if (paraArchivar.length) await archivarPegadosDelChat(ws, inicio, paraArchivar);
      }
    }
    let titulo = s.titulo;
    if (!titulo) {
      // Un mensaje que es sólo un texto pegado se titula con el nombre del pegado, no con sus marcas (lib/chat-pegado.ts).
      titulo = tituloDesde(textoParaTitulo(textoPersona) || textoMemoria);
      await renameSession(s.id, titulo).catch(() => {});
    }
    const sesion: SesionChat = { id: s.id, titulo, pinned: s.pinned, updatedAt: new Date().toISOString() };
    const vacio = (aviso: string | null): RespuestaTurno => ({ ok: false, sesion, mensajes: guardados, aviso, paraLaPersona: [], propuestas: [], pantallas: [] });

    // Con archivos y nada legible ni escrito, no hay pedido: no se gasta el modelo.
    if (adjuntos.length && !lecturas.length && !textoPersona) return vacio(avisos.join(' ') || AVISO_NO_PUDE);

    // Lo leído, encerrado como dato con su regla (lib/mako-adjuntos.ts → lecturaDeArchivos, la revisión de chats-unificados, 28/10/2026).
    const textoModelo = pedidoConLecturas(textoPersona, lecturas, adjuntos[0]?.tipo);
    const userContent: RichMsg['content'] = adjuntos.length
      ? bloquesDeAdjuntos(adjuntos.map((a) => ({ tipo: a.tipo, mime: a.mime, base64: Buffer.from(a.bytes).toString('base64') })), textoModelo)
      : textoModelo;

    const turnStart = Date.now();
    // Al modelo va rol y texto, nada más: los `bloques` de la base vienen CRUDOS (`unknown`, los sanea quien los
    // dibuja) y no son los `Bloque[]` ya saneados de `MensajeChat`. Por eso el hilo viaja como `ChartMsg`.
    const hilo: readonly ChartMsg[] = previos;
    const historial = historialParaModelo(hilo, 12);
    const vigentes = await pendientesVigentes(ws, canalKey);
    const claveAgenda = `mako.doer.agenda.${canalKey}`;
    const agendaAbierta = agendaVigente(await getSetting(claveAgenda).catch(() => null), Date.now());
    const ultimoDeMako = previos.slice(-2).reverse().find((r) => r.role === 'assistant')?.content ?? null;
    // Con un texto pegado se clasifica lo que la persona ESCRIBIÓ: el documento es dato, no el pedido (#44, `pedidoDelMensaje`).
    const textoClasificar = `${(entrada.pista ?? '').slice(0, 120)}${pistaDesde(desde)}${adjuntos.length ? textoMemoria : pedidoDelMensaje(textoPersona)}`;
    const intencion = clasificarIntencion(textoClasificar, {
      // Por la app MaKo sólo PROPONE y la persona confirma: ante la duda se actúa, no se anota (D1 = A, lib/mako-intencion.ts).
      canal: 'app',
      hayMedia: adjuntos.length > 0,
      hayPendientes: vigentes.length > 0,
      hayPendienteDeAgenda: vigentes.some((p) => (ACCIONES_AGENDA as readonly string[]).includes(p.tipo)),
      hayAgendaAbierta: !!agendaAbierta,
      makoPregunto: makoPreguntoAlgo(ultimoDeMako),
      preguntoReunionOTarea: preguntoReunionOTarea(ultimoDeMako),
    });

    // Lo que el CÓDIGO le muestra a la persona sin pasar por el modelo (la agenda de Google):
    // va en la respuesta y NO se guarda en el hilo, que vuelve al modelo en el turno siguiente.
    const paraLaPersona: string[] = [];
    // Los errores de MaKo en ESTE turno (lib/tickets-reglas.ts, `errorParaTicket`): van al ticket que se proponga, y
    // si el modelo no lo propone, lo propone el código al final (docs/diseno-ticketera-usuarios.md §2.1).
    const erroresDelTurno: ErrorDelTurno[] = [];
    /** Lo que dibujaron las herramientas del turno (`ctx.aDibujar`), y si vino de una que escribe. */
    const bloquesDelTurno: { b: Bloque; accion: boolean }[] = [];
    let herramientaActual = '';
    // Una sola vez cada uno: un turno que se re-arranca (la cascada rota de cuenta) vuelve a correr las lecturas. Dice si
    // quedó en pantalla (el repetido ya está): con el tope lleno, `false`, y la lectura no le dice al modelo «ya lo ve». Una
    // lectura deja lugar para la pregunta que puede venir después (`entraOtroDibujo`).
    const dibujar = (b: Bloque): boolean => {
      if (bloquesDelTurno.some((x) => JSON.stringify(x.b) === JSON.stringify(b))) return true;
      const accion = porId(herramientaActual)?.tipo !== 'lectura';
      if (!entraOtroDibujo(bloquesDelTurno, accion, MAX_BLOQUES_MENSAJE)) return false;
      bloquesDelTurno.push({ b, accion });
      return true;
    };
    const ctx: Ctx = {
      ws, canal: 'app', canalKey,
      // `proponer`: este turno deja pendientes y propuestas; confirmar es de la persona
      // (confirmar_accion pide `ejecutar` y además no viaja: dos cortes).
      alcance: 'proponer', rol: persona.rol, turnStart, mensajeUsuario: textoPersona || textoMemoria, actor: persona.actor, quien: persona.quien,
      aPersona: (t) => { const x = (t ?? '').trim(); if (x && !paraLaPersona.includes(x)) paraLaPersona.push(x); },
      // Lo que DIBUJA una lectura o una propuesta (lib/chat-bloques.ts): se guarda con la respuesta de MaKo.
      aDibujar: dibujar,
      // Los archivos de ESTE mensaje, ya guardados: el comprobante del estado de cuenta (la 2.28).
      adjuntos: conArchivos.map(({ ref, nombre, tipo }) => ({ ref, nombre, tipo })),
      // Lo que el ticket sabe sin que lo escriba el modelo: el pedido textual, lo último que dijo MaKo y el error.
      contextoTicket: () => ({
        pedido: textoPersona || textoMemoria,
        ...(ultimoDeMako ? { respuestaMako: ultimoDeMako } : {}),
        ...(erroresDelTurno[0] ? { error: erroresDelTurno[0].error, herramienta: erroresDelTurno[0].herramienta } : {}),
      }),
    };
    const vista = await vistaDe(ctx);
    const sinCalendly = intencion.intencion === 'actuar'
      ? (await credWs('CALENDLY_API_TOKEN', ws).catch(() => 'no se pudo leer')) == null
      : false;
    const ultimoPedido = previos.slice().reverse().find((r) => r.role === 'user')?.content;
    const contextoDelSi = intencion.sigueOfrecimiento ? [ultimoPedido ?? '', ultimoDeMako ?? ''].filter(Boolean).join('\n') : null;
    const turno = herramientasDelChat<ToolDef>({
      veredicto: intencion, texto: textoClasificar, contextoDelSi, agendaAbierta: !!agendaAbierta,
      deSiempre: [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS, ...TICKET_TOOLS], vista,
      hayPendientes: vigentes.length > 0, resumenesPendientes: vigentes.map((p) => p.resumen), sinCalendly, propias: entrada.propias,
    });
    // Lo que ESCRIBE (una acción o un control; no una lectura): el memo, la guardia de la pregunta y el modo «analizar».
    const escribe = (n: string) => { const d = porId(n); return d ? d.tipo !== 'lectura' : NOMBRES_ACCION.has(n) && !n.startsWith('listar_'); };
    // Con herramientas, también la de preguntar con opciones (1.9, lib/chat-pregunta.ts): la regla la impone el código. En
    // «analizar» (OC6) no viaja ninguna que escriba: lo cumple el servidor, no el modelo.
    const tools = herramientasDelModo(turno.tools.length ? [...(turno.tools as ToolDef[]), TOOL_PREGUNTAR] : (turno.tools as ToolDef[]), desde, escribe);
    const permitidas = new Set(tools.map((t) => t.name));

    // El system se arma DESPUÉS de las tools: depende de ellas. Lo que el Second Brain sabe de la pregunta lo trae el servidor ANTES
    // del modelo y sin IA (lib/cerebro-para-chat.ts, 28/10/2026), en paralelo y con la plata según el rol: no depende de que el
    // modelo pida una herramienta. `paqueteParaElTurno` nunca tira.
    const segundoCerebroP = paqueteParaElTurno(textoPersona || textoMemoria, { sinPlata: persona.rol !== 'admin', referente: entrada.referente });
    const base = await buildSystemPrompt({ chartKey: 'mako-doer', titulo: titulo ?? 'MaKo', contexto: '', query: textoPersona || textoMemoria, sinNumerosDelNegocio: persona.rol !== 'admin' });
    const segundoCerebro = await segundoCerebroP;
    const tz = tools.length ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : null;
    const ctxPend = vigentes.length
      ? `\n\nACCIONES ESPERANDO CONFIRMACIÓN EN ESTE CHAT (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nLa persona las confirma o las cancela tocando su tarjeta; tú no puedes hacer ninguna de las dos. Si te dice que no la quiere, dile que toque «Cancelar» en la tarjeta.`
      : '';
    const ctxAgenda = agendaAbierta && tools.some((t) => herramientasQueSiguen(agendaAbierta).includes(t.name)) ? contextoAgendaAbierta(agendaAbierta) : '';
    const ctxPuntos = avisoDePuntos(textoPersona);
    const bloqueTools = tools.length
      ? `\n\n${TOOLS_APP}${recetasDelTurno(permitidas, turno.ofrece)}${bloqueAgendaGoogle(tools.map((t) => t.name))}${turno.instruccion ? `\n\n${turno.instruccion}` : ''}\n\n${CANAL_APP}\n\nLAS QUE TIENES EN ESTE TURNO (y ninguna otra en este turno: son una selección para este pedido, no todo lo que MaKo hace): ${tools.map((t) => t.name).join(', ')}.`
      : `\n\n${SIN_TOOLS_APP}`;
    // Lo que en una pregunta no viaja pero se ofrece (27/10/2026, `ofrecibles`): sin esto MaKo decía «no puedo».
    // En modo «analizar» no (la revisión del 28/10/2026): con el «sí» lo que escribe tampoco viaja (`herramientasDelModo`).
    const ctxOfrece = turno.ofrece && turno.ofrecibles?.length && desde?.modo !== 'analizar' ? `\n\n${lineaDeOfrecibles(turno.ofrecibles)}` : '';
    // Si nombra Google Calendar, el estado real de la conexión y si a ESTA persona le alcanza el rol (ticket #42).
    const ctxGoogle = nombraGoogleCalendar(textoPersona) ? hechoGoogleCalendar({ ...(await permisoCalendarioGoogle()), rol: persona.rol }) : '';
    const ctxHoy = tz ? `\n\nHOY ES ${hoyLegible(tz)} (zona ${tz}). Para «mañana», «el jueves» o «la semana que viene», calcula la fecha desde aquí; las horas que te digan son de esta zona.` : '';
    const ctxAtado = (entrada.contexto ?? '').trim();
    const ctxDesde = contextoDesde(desde);
    const system = `${base}\n\n${VOZ_APP}\n\n${REGLA_NO_EXISTE}${bloqueTools}${ctxOfrece}${ctxGoogle}${ctxHoy}${ctxPend}${ctxAgenda}${ctxPuntos ? `\n\n${ctxPuntos}` : ''}${segundoCerebro ? `\n\n${segundoCerebro}` : ''}${ctxDesde ? `\n\n${ctxDesde}` : ''}${ctxAtado ? `\n\n${ctxAtado}` : ''}`;

    // ── Las herramientas ───────────────────────────────────────────────────────
    const runRegistro = runnerDelRegistro(ctx);
    const NOMBRES_DE_SIEMPRE = new Set(MAKO_TOOLS.map((t) => t.name));
    const capturados: LinkCapturado[] = [];
    // Un turno que se re-arranca (la cascada de chatClaudeTools rota de cuenta) no repite
    // acciones: el mismo memo que el doer de WhatsApp.
    const memo = crearMemoDeAcciones(escribe);
    // Desde que MaKo pregunta, no se propone nada en el turno (1.9): una lectura sí, para armar las opciones.
    const guardia = crearGuardiaDePregunta(escribe);
    /** Cuántas herramientas corrieron DE VERDAD en el turno, y cuántas LEYERON sin error: el guardia de promesas (1.5). */
    let corridas = 0;
    let leidas = 0;
    /** Los CONTROLES que escribieron de verdad en el turno (`cancelar_accion` sin error): respaldan «ya la cancelé». */
    let escribieron = 0;
    /** Lo que el modelo llamó y no viajó, aunque existe y la persona lo puede usar: un RUTEO (el ticket con su causa). */
    const noViajo: string[] = [];
    /** Si lo ÚLTIMO que corrió devolvió una GUARDA de MaKo (un 400: `esGuardaDeHerramienta`), y cuántas se TRAGARON una falla:
     *  el «no pude» es la regla de la guarda sólo si fue lo último y nada falló (`esLaReglaDeUnaGuarda`). */
    let ultimaFueGuarda = false;
    let tragadas = 0;
    /** «La última» después de esta salida (`laUltimaFueGuarda`): una lectura que anduvo no la cambia. */
    const anotarLaUltima = (name: string, out: unknown): void => {
      ultimaFueGuarda = laUltimaFueGuarda(ultimaFueGuarda, {
        guarda: esGuardaDeHerramienta(out), tragada: esFallaTragadaDeHerramienta(out),
        error: (out as { isError?: unknown } | null)?.isError === true, escribe: escribe(name),
      });
    };
    const runTool = async (name: string, input: Record<string, unknown>) => {
      // El contrato se aplica AL EJECUTAR: lo que no viajó no corre, aunque el modelo lo
      // llame (lo dice el texto, lo pide igual). Confirmar, menos que nada.
      if (!permitidas.has(name)) {
        // RUTEO (27/10/2026, lib/no-pude.ts): existe, esta persona la puede usar y no viajó. confirmar_accion no viaja a propósito.
        const def = porId(name);
        if (def && name !== 'confirmar_accion' && visible(def, vista) && !noViajo.includes(def.titulo)) noViajo.push(def.titulo);
        return { content: JSON.stringify({ ok: false, error: `«${name}» no está disponible en este chat.` }), isError: true };
      }
      // La entidad que la persona tiene abierta, por defecto (OC6): «movelo a Ganado» desde la ficha de Ana es ESE lead.
      input = conEntidadPorDefecto(porId(name), input, desde);
      if (name === PREGUNTAR) {
        const q = guardia.preguntar(input);
        return q.ok ? JSON.stringify({ ok: true, instruccion: q.texto }) : { content: JSON.stringify({ ok: false, error: q.texto }), isError: true };
      }
      if (guardia.bloquea(name)) return { content: JSON.stringify({ ok: false, error: ERROR_TRAS_PREGUNTAR }), isError: true };
      // Lo rechazado no cuenta: no corrió.
      corridas++;
      const previo = memo.previo(name);
      if (previo) { anotarLaUltima(name, previo.out); return previo.out as Awaited<ReturnType<typeof runRegistro>>; }
      // Las de siempre por sus cuerpos de siempre; TODO lo demás (incluidas las acciones
      // heredadas, que tienen gemela) por el registro: así cada acción pasa por el gating
      // de la vista de ESTA persona y deja su pendiente con la clave de ESTE chat.
      // La instrucción de una pendiente es la de WhatsApp («pide un sí»): acá se confirma en la tarjeta.
      const correr = async () => (NOMBRES_DE_SIEMPRE.has(name) ? runMakoTool(name, input) : runRegistro(name, input));
      // Lo que DIBUJE (`ctx.aDibujar`) queda anotado con el nombre de esta herramienta: con una pregunta, lo de una que
      // escribe se retira. Las herramientas del turno corren de a una (chatClaudeTools las espera en orden).
      herramientaActual = name;
      // Una herramienta que REVIENTA es una falla de verdad (la verificación de tren-t): el loop la atrapa sin pasar por
      // `errorParaTicket`, y la guarda de antes quedaba como «la última». Se cuenta como tragada.
      const out = conInstruccionDeTarjeta(await correr().catch((e: unknown) => { ultimaFueGuarda = false; tragadas++; throw e; }));
      memo.anotar(name, out);
      anotarLaUltima(name, out);
      if (esFallaTragadaDeHerramienta(out)) tragadas++;
      if (!escribe(name) && (out as { isError?: unknown }).isError !== true) leidas++;
      if (porId(name)?.tipo === 'control' && salioBien(out)) escribieron++;
      const err = errorParaTicket(name, out);
      if (err) erroresDelTurno.push(err);
      const sigue = agendaQueSigue(name, input, out, Date.now());
      if (sigue) await setSetting(claveAgenda, JSON.stringify(sigue)).catch(() => {});
      else if (agendaSeCierra(name, out)) await setSetting(claveAgenda, '').catch(() => {});
      for (const l of linksDeUnaAccion(name, input, out)) if (!capturados.some((c) => c.url === l.url)) capturados.push(l);
      return out;
    };
    /** Cada corrida abre un intento nuevo para el memo (tests/turno-sin-duplicar.test.ts). */
    const nuevoIntento = () => { memo.nuevoIntento(); return runTool; };

    const msgs: RichMsg[] = [...historial, { role: 'user', content: userContent }];
    let texto = '';
    let fallo: string | null = null;
    // ── ¿Lo piensa la computadora de ESTA persona? (docs/ia-del-cliente.md, ola 1; D6a, 21/10/2026) ──────────────
    // Su Claude, con su cuenta, en su PC, sin herramientas propias. Las de MaKo corren AQUÍ, con este mismo `runTool`
    // (lib/ia-pc.ts → `esperarALaPc`): el gating, el memo y las tarjetas son los de siempre. Sólo la PC de quien escribe:
    // la cuenta es de una persona (§10). La lectura de la PC no decide D6b (eso ya lo hizo `negocioConSuIA`, fallando
    // cerrado): si no se pudo leer, el turno sigue sin ella, con su clave si la tiene, y nunca con la cascada barata.
    // ⚠️ No leerla NO es «no tiene»: a la dueña con su PC conectada se le pedía «conecta tu computadora» (segunda
    // revisión, 21/10/2026). Se le dice que no se pudo ver, y va a la Ticketera.
    // Lo que eligió en el «+» (8b, ya validado por la ruta): con una de sus claves, la computadora no se usa; con la
    // computadora, las claves no.
    const ia = entrada.ia ?? null;
    // Con qué IA la piensa la computadora (la ola 3): su ChatGPT si eligió «Tu computadora · ChatGPT»; si no, su Claude,
    // como siempre.
    const eligioLaPc = !!ia && !!IA_DE_LA_PC[ia.cuenta];
    let iaDeLaPc: ProveedorPc = (ia && IA_DE_LA_PC[ia.cuenta]) ?? 'claude';
    const leerPc = (cual: ProveedorPc) => pcDe(ws, persona.actor, cual).then((d) => ({ d, error: null }), (e: unknown) => ({ d: null, error: e instanceof Error ? e.message : String(e) }));
    // LA PC SÓLO CON LA PERSONA ADENTRO (`laPersonaEstaAdentro`, lib/ia-pc-reglas.ts): el turno no le cree a la persona que le
    // pasan, mira la sesión de ESTE pedido. Sin ella —un cron, un webhook— ni se lee su PC, con Claude o con ChatGPT: el turno
    // sigue con su clave, si la tiene. Lo automático nunca usa la suscripción del dueño (D6a). La puerta (`encolarTurno`)
    // lo vuelve a mirar: esto evita leer la PC, aquello es lo que frena.
    const adentro = laPersonaEstaAdentro(await getUsuarioActual().catch(() => null), persona, entrada.pruebaSinSesion === true);
    let leidaPc = adentro ? await leerPc(iaDeLaPc) : { d: null, error: null };
    // En Automático, la PC que no puede con su Claude pero sí con su ChatGPT (o su Gemini, 24/10/2026) contesta con ésa: a quien
    // conectó sólo su ChatGPT, el aviso le decía «tu Claude no tiene la sesión iniciada». Sólo con alguna PC: un negocio sin
    // ninguna no paga una lectura más en cada turno. El orden es `PROVEEDORES_PC`.
    if (!ia && leidaPc.d && !pcUsable(leidaPc.d, 'claude')) {
      for (const otra of PROVEEDORES_PC.filter((p) => p !== 'claude')) {
        const conOtra = await leerPc(otra);
        if (pcUsable(conOtra.d, otra)) { leidaPc = conOtra; iaDeLaPc = otra; break; }
      }
    }
    const pc = leidaPc.d;
    const pcIlegible = leidaPc.error;
    // Sólo se le manda a una PC en línea CON una cuenta con sesión de ESA IA: «en línea» sin sesión no contesta nada.
    const pcPuede = pcUsable(pc, iaDeLaPc);
    // Lo que falló en la PC del cliente (apagada, sin Claude, sin sesión, al tope, no contestó a tiempo) no es un bug.
    const conLaPc = !ia || eligioLaPc;
    // Sólo si se usa la computadora: con «Tu Claude» elegido y la PC apagada, el aviso era «tu computadora está apagada» y se
    // perdía el error de su clave (revisión del selector, 23/10/2026). «Falta Claude Code» es sólo de Claude.
    let falloDeLaPc: FalloDeLaPc | null = conLaPc && pc && !pcPuede ? (pc.enLinea ? (pc.claudeFalta && iaDeLaPc === 'claude' ? 'sin-claude' : 'sesion') : 'apagada') : null;
    // Eligió su computadora y no hay ninguna conectada (si no se pudo LEER, lo dice su propio aviso): eso es lo que pasa.
    if (eligioLaPc && !pc && !pcIlegible) falloDeLaPc = 'apagada';
    let reponeDeLaPc: string | null = null;
    // En Automático con una clave propia, la espera de la PC le deja tiempo a su clave (`RESERVA_RESPALDO_MS`): si la PC no
    // contesta, contesta su clave. Elegida la computadora, no: eligió ésa. Sólo se lee si va a la PC.
    const reservado = conLaPc && !!pc && pcPuede && !eligioLaPc && await claveDeIAPropia(ws).catch(() => false);
    if (conLaPc && pc && pcPuede) {
      try {
        // El modelo que eligió para este chat; si no, el del negocio. Con su ChatGPT o su Gemini, ninguno: su programa usa el suyo.
        const modelo = iaDeLaPc !== 'claude' ? undefined
          : ia?.cuenta === 'pc' && ia.modelo ? modeloPc(ia.modelo) : modeloPc(await getSetting(CLAVE_MODELO_PC).catch(() => null));
        // Lo que le queda a la ruta, no 240 s fijos (el Analyst del lead tiene 300 s: Vercel cortaba sin aviso). El turno vence
        // cuando el chat deja de esperarlo: si la ruta muere, una PC que se prende después no piensa un pedido que nadie lee.
        const espera = esperaDelTurno(entrada.plazoMs ?? PLAZO_RUTA_MS, Date.now() - inicio, reservado ? RESERVA_RESPALDO_MS : 0);
        const turnoPc = await encolarTurno(pc, s.id, {
          system, prompt: armarPrompt(historial, textoModelo), tools, modelo, ...(iaDeLaPc !== 'claude' ? { proveedor: iaDeLaPc } : {}),
        }, espera, { pruebaSinSesion: entrada.pruebaSinSesion === true });
        const r = await esperarALaPc(turnoPc, ws, pc.id, nuevoIntento() as Ejecutor, espera);
        if (!r) { falloDeLaPc = 'tarde'; fallo = 'la computadora del cliente no contestó a tiempo'; }
        else if ('desconectada' in r) { falloDeLaPc = 'desconectada'; fallo = 'la computadora del cliente se desconectó a mitad del turno'; }
        else if ('apagada' in r) { falloDeLaPc = 'apagada'; fallo = 'la computadora del cliente se apagó (no tomó el turno o dejó de latir)'; }
        else if ('error' in r) { falloDeLaPc = r.tipo ?? 'error'; reponeDeLaPc = r.repone ?? null; fallo = `la computadora del cliente: ${r.error}`; }
        else texto = r.texto.trim();
      } catch (e) {
        falloDeLaPc = e instanceof TopeDeTurnos ? 'muchos' : 'error';
        fallo = `la computadora del cliente: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    // Sin su PC (no tiene, está apagada o sin sesión, o no pudo): con su clave, si la tiene (docs/ia-del-cliente.md §5).
    // Con «sólo su IA» (D6b) la cascada barata no participa: chatClaudeTools usa su OpenAI, su Gemini o su Claude, o nada. Si
    // la PC tardó, sólo si se le reservó tiempo a su clave (`probarSuClaveTrasLaPc`); si el negocio pasó su tope, no.
    if (!texto && probarSuClaveTrasLaPc(falloDeLaPc, { eligioLaPc, reservado })) {
      try {
        const r = await chatClaudeTools(system, msgs, tools, nuevoIntento(), {
          feature: FEATURE, maxSteps: 8, sinFallbackClaude: true, soloSuIA: negocio.suIA,
          // Lo que eligió (8b): directo a SU Claude con ese modelo, o directo a SU OpenAI con el suyo (o uno que sabe orquestar
          // herramientas, `MODELO_SU_OPENAI_DEFAULT`, nunca el `gpt-4o-mini` de la capa barata); si no, la cascada de siempre.
          ...(ia?.cuenta === 'anthropic' ? { soloSuClaude: true, ...(ia.modelo ? { modeloSuClaude: ia.modelo } : {}) }
            : ia?.cuenta === 'openai' ? { soloSuOpenAI: true, modeloSuOpenAI: ia.modelo ?? MODELO_SU_OPENAI_DEFAULT } : {}),
          motivo: `app ${intencion.intencion} «${(textoPersona || textoMemoria).slice(0, 60)}»`,
        });
        texto = (r.text ?? '').trim();
        if (texto.startsWith('(')) { fallo = fallo ?? `centinela ${texto.slice(0, 40)}`; texto = ''; }
        // Contestó su clave: lo de la PC ya no es lo que pasó.
        if (texto) { fallo = null; falloDeLaPc = null; }
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        // Si había fallado la PC, eso es lo que se le dice; lo de su clave queda en el log.
        if (falloDeLaPc) console.warn(`[mako-turno-app] ws=${ws} sesión=${s.id}: sin la PC, su clave tampoco: ${m.slice(0, 200)}`);
        else fallo = m;
      }
    }
    if (fallo) console.error(`[mako-turno-app] ws=${ws} sesión=${s.id} ${intencion.intencion}: ${fallo.slice(0, 300)}`);
    // Lo que falló de SU cuenta (su Claude en pausa, su clave sin crédito) se le dice a la persona: no es un bug.
    // Con «Tu ChatGPT» elegido, lo de SU OpenAI también (`falloDeSuOpenAI`): su cuenta, o el modelo que no le dejaron usar.
    const suOpenAI = ia?.cuenta === 'openai' ? falloDeSuOpenAI(fallo) : null;
    const modeloOpenAI = ia?.cuenta === 'openai' ? ia.modelo ?? MODELO_SU_OPENAI_DEFAULT : '';
    const deSuClave = fallo?.includes(CLAUDE_EN_PAUSA) ? { aviso: CLAUDE_EN_PAUSA, conectar: null }
      : falloDeSuClave(fallo) ? { aviso: AVISO_SU_CLAVE, conectar: 'anthropic' } : null;
    const deSuOpenAI = suOpenAI === 'cuenta' ? { aviso: AVISO_SU_OPENAI, conectar: 'openai' }
      : suOpenAI ? { aviso: avisoSinElModelo(NOMBRE_MODELO_IA[modeloOpenAI] ?? modeloOpenAI, persona.rol === 'admin'), conectar: null } : null;
    /** Lo de su cuenta, de cualquiera de las dos: es lo que leen el ticket, el porqué y el botón. */
    const deSuCuenta = deSuClave ?? deSuOpenAI;
    // Sin una IA propia no es un bug: es configuración del negocio, y se le pide a la persona (tickets #5 y #6).
    const sinIA = !falloDeLaPc && !deSuCuenta && faltaIADelNegocio(fallo, fallo ? await iaPropiaDelTurno() : null);

    // ── Lo que falló de MaKo va SOLO a la Ticketera ─────────────────────────────
    // Martín (17/10/2026): «córrelo en toda la app: MaKo en los chats de la app... Y todo lo solucionas
    // automáticamente». Ya no se le propone una tarjeta a la persona: el error se registra (agrupado por huella,
    // lib/errores-app.ts) y la primera vez es un ticket de bug que va solo al Cerebro. A la persona se le dice SÓLO si
    // entró, y el aviso de que está arreglado le llega en ESTE hilo. Lo que falló porque el proveedor de IA no
    // contestó (un 503, el cupo) no es un bug de MaKo: lo descarta `esRuido`. Y el negocio sin una IA propia tampoco:
    // no se registra, se le pide que conecte la suya (`sinIA`, abajo).
    const fallasDeMako = [
      // `etiqueta`: el nombre humano de la operación («Mover un lead de etapa»), para el título que lee el cliente.
      ...erroresDelTurno.map((e) => ({ nombre: e.herramienta, mensaje: e.error, etiqueta: porId(e.herramienta)?.titulo })),
      // Un 404 de su OpenAI sí va: puede ser un id de modelo nuestro mal puesto (`falloDeSuOpenAI`, 'no-existe').
      ...(fallo && !sinIA && !falloDeLaPc && (!deSuCuenta || suOpenAI === 'no-existe') ? [{ nombre: 'responder', mensaje: fallo, etiqueta: 'contestarte' }] : []),
      // No poder leer la PC sí es de MaKo (la base), si por eso no hubo respuesta.
      ...(pcIlegible && !texto ? [{ nombre: 'leer-la-pc', mensaje: `no pude leer la computadora: ${pcIlegible}`, etiqueta: 'ver tu computadora' }] : []),
    ];
    // Desde el 27/10/2026 también si el modelo propuso un ticket (antes, si el modelo lo proponía se apagaba el registro y la falla
    // dependía de que la persona tocara el botón): su tarjeta queda, por si lo pidió ella. La línea la escribe el código.
    /** Lo que no fue de MaKo sino del proveedor de IA (un 503, el cupo): `esRuido` no lo registra, y es su propio ticket. */
    let delProveedor = false;
    /** registrarError DEJÓ ticket (no sólo «hubo una falla»): el «no pude» del modelo no abre otro. */
    let registroConTicket = false;
    if (fallasDeMako.length) {
      const quien = await identidadDe(ws, persona.actor).catch(() => null);
      const r = await registrarError({ origen: 'mako', ...fallasDeMako[0], hilo: String(s.id) }, quien);
      if (r.ok && r.ticketId) { registroConTicket = true; paraLaPersona.push(r.nuevo ? lineaDelTicket(r.ticketId) : LINEA_YA_AVISADO); }
      delProveedor = !r.ok && r.motivo === 'ruido' && fallasDeMako[0].nombre === 'responder';
    }
    const dondeDelTurno: DondeNoPude = { ws, actor: persona.actor, superficie: 'ops-center', conv: String(s.id), pedido: textoPersona, ...(desde?.pantalla ? { ruta: desde.pantalla } : {}) };

    // ── Lo que sale ────────────────────────────────────────────────────────────
    const delTurno = await tarjetasVigentes(ws, canalKey, turnStart).catch(() => [] as TarjetaPendiente[]);
    const capturadas = await Promise.all(capturados.map((l) => conFormulario(propuestaDePantalla(l), persona.rol)));
    // Con una pregunta, lo que el turno propuso ANTES se retira, también en la base: depende de la respuesta (1.9).
    const pregunta = guardia.pregunta;
    if (pregunta) {
      await Promise.all([
        ...delTurno.map((t) => resolverPendiente(ws, t.pendienteId, 'cancelada', 'MaKo preguntó antes de proponer', { soloSiPendiente: true }).catch(() => false)),
        ...capturados.map((l) => retirarEnSuPantalla(ws, aRetirar(l))),
      ]);
    }
    const retirado = retirar(pregunta, delTurno, capturadas);
    const propuestas = retirado.propuestas;
    // Lo que dibujaron las herramientas: con una pregunta, sólo lo de las lecturas (lo propuesto se retiró).
    const dibujos = bloquesDelTurno.filter((x) => !pregunta || !x.accion).map((x) => x.b);
    // Una propuesta de pantalla que ya trae su bloque (el antes y el después de una edición de video, con su «Aceptar en el
    // editor») no se dibuja dos veces: queda el bloque.
    const conBloque = new Set(dibujos.flatMap((b) => ('abrir' in b && b.abrir ? [b.abrir.href] : [])));
    const pantallas = retirado.pantallas.filter((p) => !conBloque.has(p.escritorio));
    // Con lo que QUEDA: con una pregunta se retiró, y el mensaje no puede decir «confírmalo abajo» sin nada abajo.
    const borrador = pregunta ? null : capturados.find((c) => c.clase === 'borrador') ?? null;
    const lead = pregunta ? null : capturados.find((c) => c.clase === 'lead') ?? null;

    let respuesta: string | null = null;
    let aviso: string | null = avisos.length ? avisos.join(' ') : null;
    if (texto) {
      const v = validarRespuestaDoer(texto, { motivoRuta: `→ ${intencion.intencion}`, linkBorrador: borrador?.url ?? null });
      if (!v.ok && v.razon !== 'sin-borrador' && !borrador) {
        // Volcó el molde, o anuncia un borrador que nadie creó: eso no se manda.
        console.error(`[mako-turno-app] ws=${ws} BLOQUEADA (${v.razon}): ${v.detalle}`);
      } else {
        respuesta = texto;
      }
    }
    // El estado de un dato no depende de cómo le salió la frase al modelo.
    if (borrador) respuesta = MENSAJE_BORRADOR_APP;
    else if (lead) respuesta = mensajeLeadApp(lead.nombre);
    if (respuesta) respuesta = sinLinksDeRevision(respuesta) || null;
    // ⚠️ SIN GROSERÍAS, COMO EN WHATSAPP (17/10/2026, docs/relevo/mako-en-whatsapp.md §3): la persona de MaKo dice «puedes
    // putear suave» (lib/mako-persona.ts) y el doer lo corta antes de mandar (`sanearSalida`, lib/doer-salida.ts); este chat
    // —el de la app y el teléfono de los clientes— no. Se saca la oración, no la respuesta entera (las promesas no: acá la
    // tarjeta y la pantalla dicen lo que quedó hecho).
    if (respuesta && !borrador && !lead) {
      // Con lo que DE VERDAD corrió (1.5): sin ninguna herramienta, «déjame ver» es mentira. Y lo que dice HECHO, con lo
      // que lo respalda: en este chat el turno no ejecuta nada, así que «ya le mandé» sólo vale si lo anota el hilo.
      const saneo = sanearSalida(respuesta, {
        corrioHerramientas: corridas > 0,
        // Lo que va debajo del texto: el «:» final lo presenta («Te armé la tabla de tus ventas:» y la tabla).
        bloquesDebajo: dibujos.length > 0 || !!pregunta || propuestas.length > 0 || pantallas.length > 0,
        hecho: {
          // El respaldo lo pone el CÓDIGO: lo que escribió en el turno, o una tarjeta confirmada después del último PEDIDO
          // (un «gracias» no corta). Si este mensaje ES un pedido, no hay nada después de él.
          respaldado: escribieron > 0 || (!esPedido(intencion.intencion) && confirmadoTrasElUltimoPedido(historial,
            (t) => esPedido(clasificarIntencion(t, { hayMedia: false }).intencion))),
        },
      });
      if (saneo.groserias.length) console.warn(`[mako-turno-app] ws=${ws} sesión=${s.id}: le saqué una grosería (${saneo.groserias.join(', ')})`);
      respuesta = saneo.texto;
    }
    // LO QUE NO EXISTE Y LO QUE NO PUDO (lib/no-existe.ts, lib/no-pude.ts; Leandro y Leila, 27/10/2026): las marcas nunca le
    // llegan a la persona, el ticket sale solo a la Ticketera con su causa (un RUTEO si llamó algo que existe y no viajó), y la
    // línea que lo dice la escribe el código. Repetido en la misma conversación: nada.
    if (respuesta) {
      // Si lo que falló ya dejó su ticket (registrarError), sólo se sacan las marcas: un ticket, una línea (la revisión del 28/10).
      // Si lo último que corrió fue una GUARDA y nada falló (a la vista o tragado) ni hubo ruteo, el «no pude» es esa regla, la
      // diga o no el modelo (base 7: el formato de la marca pide el QUÉ, no el porqué).
      const np = await conTicketsDeMaKo(respuesta, { ruteo: noViajo.length > 0, yaRegistrado: registroConTicket, regla: esLaReglaDeUnaGuarda({ ultimaFueGuarda, errores: erroresDelTurno.length, tragadas }) && !noViajo.length }, dondeDelTurno, { operacion: noViajo[0] ?? null, noViajaron: () => parecidasQueNoViajaron({ vista, pedido: dondeDelTurno.pedido ?? '', viajaron: tools.map((t) => t.name) }) });
      respuesta = [np.texto, np.linea].filter(Boolean).join('\n\n') || null;
    }
    // El proveedor y la configuración que volvieron a andar cierran su ticket solos (una vez cada 10 minutos por negocio).
    // La configuración, sólo si contestó la MISMA cuenta que había fallado (o el negocio no tenía IA y ahora contestó una).
    if (respuesta && !fallo) await Promise.all([cerrarSiVolvio(ws, 'proveedor'), cerrarSiVolvio(ws, 'configuracion', `ia:${ia?.cuenta ?? 'auto'}`)]);
    if (!respuesta && (propuestas.length || pantallas.length)) respuesta = TEXTO_SOLO_TARJETA;
    // La pregunta va con el mensaje de MaKo (al recargar vuelve); sin texto, el mensaje ES la pregunta.
    if (pregunta && !respuesta) respuesta = pregunta.pregunta;
    // Lo que dibujaron las herramientas va con el mensaje (al recargar vuelve). Sin texto, una línea que lo presente.
    if (dibujos.length && !respuesta) respuesta = TEXTO_SOLO_BLOQUE;
    const conElMensaje = bloquesDelMensaje(dibujos, pregunta, MAX_BLOQUES_MENSAJE);

    if (respuesta) {
      await appendMessage(s.id, 'assistant', respuesta, conElMensaje.length ? conElMensaje.map(aGuardar) : undefined);
      guardados.push({ role: 'assistant', content: respuesta, ...(conElMensaje.length ? { bloques: conElMensaje } : {}) });
    }
    // Sin IA: lo dice MaKo, con el botón que abre el modal de las keys en esta misma pantalla (`conectar`). Salvo en el
    // workspace del entorno, donde la key que pegara pasaría a ser la de la plataforma (`avisoSinIA`): ahí, sin botón.
    // Con su computadora conectada pero apagada, no se le pide conectar otra IA: se le dice que la prenda. Y en un negocio
    // que corre con su propio Claude (D6b), a quien no conectó su computadora se le dice dónde (no que conecte Gemini).
    const sinIAEs = !respuesta && sinIA && !pc
      ? pcIlegible && negocio.suIA
        ? { aviso: AVISO_PC_ILEGIBLE, conectar: null }
        : negocio.suIA && negocio.conPc
          ? { aviso: AVISO_CONECTA_TU_PC, conectar: null }
          : avisoSinIA(await esNegocioDelEntorno(ws).catch(() => false), iaParaConectar(await iaConFila(), negocio.suIA))
      : null;
    if (!respuesta) {
      const tzAviso = falloDeLaPc === 'tope' ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;
      const delaPc = avisoDeLaPc(falloDeLaPc, false, { repone: reponeDeLaPc, tz: tzAviso, ia: iaDeLaPc });
      // Con un porqué conocido, MaKo lo dice EN EL HILO (`porQueSinRespuesta`): al volver a entrar está ahí, y no «No te pude
      // contestar esto». En la respuesta sigue yendo como aviso, con su botón (no en `guardados`: saldría dos veces).
      const porQue = porQueSinRespuesta({ delaPc, deSuClave: deSuCuenta?.aviso, sinIA: sinIAEs?.aviso, pcIlegible: pcIlegible && negocio.suIA ? AVISO_PC_ILEGIBLE : null });
      if (porQue) {
        const boton = sinIAEs?.conectar ?? deSuCuenta?.conectar ?? null;
        await anotarEnHilo(s.id, porQue, [{ t: 'porque', ...(boton ? { conectar: boton } : {}) }]);
      }
      aviso = [aviso, porQue ?? AVISO_NO_PUDE].filter(Boolean).join(' ');
      // EL PROVEEDOR Y LA CONFIGURACIÓN TAMBIÉN DEJAN TICKET (27/10/2026, Martín: «siempre»): uno por negocio y causa, que nunca
      // va al Runner (lib/tickets-reglas.ts) y se cierra solo cuando vuelve a andar. Va pegado al aviso de siempre.
      const causaSin = sinIA || deSuCuenta ? 'configuracion' : delProveedor ? 'proveedor' : null;
      if (causaSin) {
        const t = await ticketDeNoPude(causaSin, dondeDelTurno, { operacion: sinIA ? 'una IA propia' : deSuCuenta ? 'su cuenta de IA' : null, error: fallo?.slice(0, 300) ?? null,
          // Qué cuenta falló: la configuración se cierra sola sólo cuando contesta ESA (`cerrarSiVolvio`).
          ...(causaSin === 'configuracion' ? { herramienta: sinIA ? 'ia:ninguna' : `ia:${ia?.cuenta ?? 'auto'}` } : {}) });
        if (t) aviso = `${aviso} ${lineaCortaDelTicket(t.id)}`;
      }
    }
    let conectar = sinIAEs?.conectar ?? (respuesta ? null : deSuCuenta?.conectar ?? null);
    // La clave tapada se le dice, con el botón del servicio que se reconoció. ⚠️ ESE BOTÓN GANA (22/10/2026, la prueba de
    // los chats): sin IA, el botón del «sin IA» (Gemini) se ponía primero, y a quien pegó su clave de OpenAI le abría el de
    // Gemini. Lo que quiere conectar es lo que pegó; si no se reconoció el servicio, el de siempre.
    if (tapado.tapadas) {
      aviso = [avisoClaveTapada(tapado.servicio), aviso].filter(Boolean).join(' ');
      conectar = tapado.servicio ?? conectar;
    }
    return { ok: !!respuesta, sesion, mensajes: guardados, aviso, paraLaPersona, propuestas, pantallas, conectar };
  });
}

// ── La tarjeta: confirmar o cancelar ─────────────────────────────────────────

/** Lo que queda en el hilo después de tocar la tarjeta: el modelo lo lee en el turno
 *  siguiente («¿ya lo hiciste?»). Es el `resumen` del resultado, que por contrato es apto
 *  para un modelo (lo que no, va en `paraLaPersona` y no se guarda). Si guardarlo falla, la
 *  acción igual quedó hecha: no se revierte una ejecución porque no se pudo anotar. */
/** Lo que el turno propuso en una pantalla y se retira porque MaKo preguntó (1.9): cada uno con SU descarte, que sólo
 *  toca lo que sigue pendiente. Si falla, se registra y el turno sigue: la pregunta igual sale. */
async function retirarEnSuPantalla(ws: number, r: ReturnType<typeof aRetirar>): Promise<void> {
  if (!r) return;
  try {
    if (r.clase === 'accion' || r.clase === 'lead') await descartarPropuesta(r.id);
    else if (r.clase === 'borrador') await descartarBorradorDelPlan(r.id);
    else if (r.clase === 'editor') await resolverPropuestaDeVideo({ ws, id: r.id, estado: 'descartada', persona: 'MaKo', descartes: [] });
    else await descartarBorrador(Number(r.id));
  } catch (e) {
    console.error(`[mako-turno-app] ws=${ws} no pude retirar ${r.clase} ${r.id}:`, e instanceof Error ? e.message : String(e));
  }
}

async function anotarEnHilo(sessionId: number, texto: string, bloques: readonly Bloque[] = []): Promise<void> {
  // Con el bloque (lib/chat-bloques.ts): al recargar, lo creado vuelve con su miniatura debajo del «Hecho: …».
  try { await appendMessage(sessionId, 'assistant', texto, bloques.length ? bloques.map(aGuardar) : undefined); }
  catch (e) { console.error(`[mako-turno-app] no pude anotar en la sesión ${sessionId}:`, e instanceof Error ? e.message : String(e)); }
}

function ctxDeTarjeta(persona: PersonaChat, sessionId: number, aPersona?: (t: string) => void): Ctx {
  // Sin `turnStart`: el toque es un acto aparte del turno que propuso. Sin `bandeja`: este
  // chat ve SÓLO su clave. `rol` es el real: gatingOk se vuelve a mirar al confirmar.
  return { ws: persona.ws, canal: 'app', canalKey: canalKeyDeSesion(sessionId), alcance: 'ejecutar', rol: persona.rol, actor: persona.actor, quien: persona.quien, aPersona };
}

const NO_ES_TUYA: ResultadoTarjeta = { ok: false, error: 'No encuentro ese chat' };

export async function confirmarDesdeTarjeta(persona: PersonaChat, sessionId: number, pendienteId: number): Promise<ResultadoTarjeta> {
  return runWithWorkspace(persona.ws, async () => {
    if (!(await sesionDe(persona, sessionId))) return NO_ES_TUYA;
    // ⛔ D6b TAMBIÉN AL CONFIRMAR (revisión del Cerebro, 21/10/2026): una tarjeta con costo de IA (analizar una hoja, el
    // insight de un lead, una landing…) se ejecuta acá, no en el turno que la propuso, y corría fuera de «sólo su IA»: los
    // números del negocio iban a la Gemini gratis. Se prende igual que en el turno, y lo que va por detrás (`after`) lo hereda.
    entrarSoloSuIA((await negocioConSuIA(persona.ws)).suIA);
    // Un trabajo LARGO (1.11, lib/chat-trabajos.ts): se confirma por detrás y la respuesta vuelve enseguida, con el G6 que
    // la pantalla consulta. Si no se puede anotar su avance, corre como siempre, acá abajo.
    // ⚠️ SÓLO LA DE ESTE CHAT, Y SI QUIEN TOCA PUEDE (revisión del 21/10/2026): con la pendiente de otro chat (los ids son
    //    correlativos) anotaba «En curso» y servía para ver qué hay vivo en otros; y un closer que tocaba una de admin veía
    //    «En curso» y después «No se pudo». Si no, el camino de siempre contesta el error sin escribir en el hilo.
    const pend = await getPendiente(persona.ws, pendienteId).catch(() => null);
    const def = pend?.estado === 'pendiente' && pend.grupoJid === canalKeyDeSesion(sessionId) ? porId(pend.tipo) : undefined;
    const ctx = ctxDeTarjeta(persona, sessionId);
    if (def && esAccion(def) && def.lenta && gatingOk(def, await vistaDe(ctx))) {
      const trabajo = await enSegundoPlano(persona.ws, sessionId, def.titulo, async () => {
        const r = await confirmarPendiente(ctx, pendienteId);
        return 'error' in r ? { ok: false, resumen: errorCortoDeTarjeta(r.error) } : r;
      }, (r) => abrirDeResultado(def.id, r.datos));
      if (trabajo) return { ok: true, resumen: `En curso: ${def.titulo}`, paraLaPersona: [], bloques: [trabajo], enCurso: true };
    }
    const detalle: string[] = [];
    const r = await confirmarPendiente(ctxDeTarjeta(persona, sessionId, (t) => { if (t && !detalle.includes(t)) detalle.push(t); }), pendienteId);
    if ('error' in r) return { ok: false, error: errorCortoDeTarjeta(r.error), paraLaPersona: detalle };
    // Lo que el chat dibuja con el resultado (`datos.bloque` del runner), saneado: se guarda con el «Hecho» y vuelve a
    // la pantalla para sumarlo sin recargar (la 1.7: confirmar `crear_diseno_imagen` deja su miniatura en el hilo).
    const bloque = r.ok ? bloqueDeResultado(r.datos) : null;
    await anotarEnHilo(sessionId, r.ok ? `Hecho: ${r.resumen}` : `No se pudo: ${r.resumen}`, bloque ? [bloque] : []);
    // Sin bloque (que trae su propio botón), el «Abrir en <tab>» del link que devolvió la acción (1.8).
    const abrir = r.ok && !bloque ? abrirDeResultado(r.tipo, r.datos) : null;
    // ok:false acá es «se ejecutó y falló»: la pendiente quedó en error y no vuelve.
    return r.ok
      ? { ok: true, resumen: r.resumen, paraLaPersona: detalle, ...(bloque ? { bloques: [bloque] } : {}), ...(abrir ? { abrir } : {}) }
      : { ok: false, error: r.resumen, ejecutada: true, paraLaPersona: detalle };
  });
}

export async function cancelarDesdeTarjeta(persona: PersonaChat, sessionId: number, pendienteId: number): Promise<ResultadoTarjeta> {
  return runWithWorkspace(persona.ws, async () => {
    if (!(await sesionDe(persona, sessionId))) return NO_ES_TUYA;
    const r = await cancelarPendiente(ctxDeTarjeta(persona, sessionId), pendienteId);
    if ('error' in r) return { ok: false, error: errorCortoDeTarjeta(r.error) };
    await anotarEnHilo(sessionId, r.resumen);
    return { ok: true, resumen: r.resumen, paraLaPersona: [] };
  });
}
