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
import { CLAUDE_EN_PAUSA, chatClaudeTools, permisoDeLaClaveDelNegocio, type RichMsg, type ToolDef } from '@/lib/anthropic';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION } from '@/lib/mako-doer-acciones';
import { aToolDef, gatingOk, porId } from '@/lib/api-mako/registro';
import { errorParaTicket, type ErrorDelTurno } from '@/lib/tickets-reglas';
import { identidadDe } from '@/lib/tickets-db';
import { registrarError } from '@/lib/errores-app';
import { avisoClaveTapada, taparClaves } from '@/lib/claves-en-el-chat';
import { encolarTurno, esperarALaPc, pcDe, TopeDeTurnos, type Ejecutor } from '@/lib/ia-pc';
import { armarPrompt, AVISO_PC_ILEGIBLE, avisoDeLaPc, CLAVE_MODELO_PC, esperaDelTurno, modeloPc, pcUsable, type FalloDeLaPc } from '@/lib/ia-pc-reglas';
import { negocioConSuIA } from '@/lib/ia-del-negocio';
import { entrarSoloSuIA } from '@/lib/solo-su-ia';
import { runnerDelRegistro, vistaDe } from '@/lib/api-mako/ejecutar';
import { confirmarPendiente, cancelarPendiente } from '@/lib/api-mako/acciones';
import { esAccion, type Ctx } from '@/lib/api-mako/tipos';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { clasificarIntencion, makoPreguntoAlgo } from '@/lib/mako-intencion';
import { preguntoReunionOTarea } from '@/lib/doer-herramientas';
import { recetasDelTurno } from '@/lib/doer-recetas';
import { bloqueAgendaGoogle, agendaQueSigue, agendaSeCierra, agendaVigente, contextoAgendaAbierta, herramientasQueSiguen, ACCIONES_AGENDA } from '@/lib/agenda-sin-ia';
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
import {
  createSession, getSession, listSessions, getSessionMessages, getSessionMessagesConBloques, getMensajeConBloques, appendMessage,
  renameSession, tituloDesde, type ChartSession, type ChartMsgConBloques,
} from '@/lib/chart-chats';
import { adjuntosVisibles, audioDeBloques, leerRef, sanearBloques } from '@/lib/chat-mako-bloques';
import { urlAudio } from '@/lib/offer-reglas';
import { MAX_BLOQUES_MENSAJE, aGuardar, bloqueDeResultado, bloquesGuardados, type Bloque } from '@/lib/chat-bloques';
import { archivarPdfsDelChat, archivarPegadosDelChat, borrarAdjuntos, subirAdjuntos, urlFirmadaDeAdjunto } from '@/lib/chat-mako-adjuntos';
import { recortarMensaje, textoParaTitulo, textosParaArchivar } from '@/lib/chat-pegado';
import { archivoATexto } from '@/lib/archivo-a-texto';
import { aFila, plano } from '@/lib/bandeja-filas';
import { descartarPropuesta, getPropuesta, propuestasPendientesDelChat } from '@/lib/propuestas';
import { descartarPropuesta as descartarBorradorDelPlan } from '@/lib/plan-propuesta';
import { resolverPropuesta as resolverPropuestaDeVideo } from '@/lib/editor-video/propuestas-server';
import { descartarBorrador } from '@/lib/evolution-envio';
import { getPendiente, resolverPendiente } from '@/lib/mako-pendientes';
import { PREGUNTAR, TOOL_PREGUNTAR, ERROR_TRAS_PREGUNTAR, crearGuardiaDePregunta, retirar } from '@/lib/chat-pregunta';
import { enSegundoPlano } from '@/lib/chat-trabajos';
import { puedeVerKey } from '@/lib/movil-rutas';
import { bloquesDeAdjuntos, placeholderDeAdjunto, promptDeAdjunto, type AdjuntoListo } from '@/lib/mako-adjuntos';
import {
  chartKeyDePersona, canalKeyDeSesion, herramientasDelChat, tarjetaDePendiente, linksDeUnaAccion, abrirDeResultado, idDePropuesta, aRetirar,
  type FormularioPropuesta, type PropuestaPantalla,
  propuestaDePantalla, sinLinksDeRevision, MENSAJE_BORRADOR_APP, mensajeLeadApp, TEXTO_SOLO_TARJETA, TEXTO_SOLO_BLOQUE,
  historialParaModelo, bloquesDelMensaje, entraOtroDibujo, confirmadoTrasElUltimoPedido, esPedido, salioBien, hoyLegible, errorCortoDeTarjeta, conInstruccionDeTarjeta, faltaIADelNegocio, avisoSinIA,
  iaParaConectar, IA_PARA_CONECTAR, ENV_DE_IA, falloDeSuClave, AVISO_SU_CLAVE, AVISO_CONECTA_TU_PC, AVISO_NO_LEI_SU_IA, AVISO_SIN_ARCHIVERO, AVISO_ARCHIVERO_EN_PAUSA,
  type LinkCapturado, type MensajeChat, type RespuestaTurno, type ResultadoTarjeta, type SesionChat, type TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';

/** La feature registrada del doer (lib/model-catalogo.ts → Gemini). Claude está vetado. */
const FEATURE = 'mako-doer';
/** Cuánto texto ESCRITO de la persona entra por mensaje (lo pegado tiene el suyo, lib/chat-pegado.ts). Eran 8.000 y Martín
 *  (18/10): «tiene que dejar mensajes mucho más largos». Lo que pasa de acá se dice y queda entero en El Archivero. */
const TOPE_MENSAJE = 20_000;
/** Cuánto de lo leído de los archivos entra al turno. El loop re-manda la conversación en
 *  cada paso: 40.000 caracteres son ~10 páginas, y lo que se corta SE DICE. */
const TOPE_LECTURA = 40_000;

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
  return {
    role: m.role, content: m.content, created_at: m.created_at,
    ...(bloques.length ? { adjuntos: adjuntosVisibles(m.id, bloques) } : {}), ...(vista.length ? { bloques: vista } : {}),
    // La nota de voz de una respuesta copiada de Offer (el chat «Onboarding»): se reproduce desde la ruta de Offer.
    ...(audio ? { audio: { url: urlAudio(audio.sesion, audio.mensaje), secs: audio.secs } } : {}),
  };
}

/**
 * El link firmado de un adjunto guardado (`ref` = `<id del mensaje>:<n>`), o null. Mira de QUIÉN es la conversación
 * del mensaje ANTES de firmar: los chats son por persona, así que el admin no abre los adjuntos de un closer.
 */
export async function urlDeAdjunto(persona: PersonaChat, ref: unknown): Promise<string | null> {
  const r = leerRef(ref);
  if (!r) return null;
  return runWithWorkspace(persona.ws, async () => {
    const m = await getMensajeConBloques(r.msgId);
    if (!m || !(await sesionDe(persona, m.session_id))) return null;
    const b = sanearBloques(persona.ws, m.bloques)[r.i];
    return b ? urlFirmadaDeAdjunto(b.path) : null;
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
   * Guardar los archivos (mig 0305) y pasar los PDF del admin a El Archivero. Lo prenden SÓLO el Second Brain y el chat
   * del teléfono (las rutas /api/mako/chat y /api/m/mako). Sin esto, el turno de siempre: los lee y no los guarda.
   */
  guardarAdjuntos?: boolean;
  /**
   * El `maxDuration` de la ruta que llama, en ms (300 s si no se dice): lo que se espera a la PC del cliente sale de acá
   * (`esperaDelTurno`). El Analyst del lead tiene 300 s y no 420, y Vercel cortaba sin aviso (revisión del 21/10/2026).
   */
  plazoMs?: number;
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
    if (claude) n++;
    return n;
  } catch {
    return null;
  }
}

/**
 * ¿Hay con qué pasar un archivo a El Archivero sin la cascada barata? Su clave de Claude (la puerta 2 del veto) o su
 * OpenAI. Sólo se pregunta con «sólo su IA» (D6b): ahí, sin ninguna de las dos, El Archivero no corre y se dice.
 * `pausa`: tiene su clave de Claude pero la plataforma la pausó y no hay OpenAI: se dice eso, no que falta la clave.
 */
async function puedeArchivarConSuIA(): Promise<'si' | 'no' | 'pausa'> {
  try {
    const claude = await permisoDeLaClaveDelNegocio('El Archivero');
    if (claude && 'permiso' in claude) return 'si';
    const { provsDe } = await import('@/lib/ai-cheap');
    if ((await provsDe('openai')).length > 0) return 'si';
    return claude && 'pausa' in claude ? 'pausa' : 'no';
  } catch {
    return 'no';
  }
}

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
const AVISE_AL_EQUIPO = 'Le avisé al equipo de MaKo: te aviso por aquí cuando esté arreglado.';
const AVISO_NO_LEI = (nombre: string) => `No pude leer «${nombre}».`;

/**
 * Un turno del chat del teléfono. Devuelve null si la sesión no es de esta persona.
 * Nunca tira por un fallo del modelo: lo devuelve como `aviso` (y no lo guarda). Sin texto
 * ni archivos tira: eso lo frena antes quien llama.
 */
export async function turnoApp(persona: PersonaChat, sessionId: number, entrada: EntradaTurnoApp): Promise<RespuestaTurno | null> {
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
    const previos = await getSessionMessages(s.id);

    // LO QUE ESCRIBIÓ LA PERSONA SE GUARDA SIEMPRE, antes del modelo.
    // Los archivos se guardan (mig 0305): el binario ANTES, y su referencia en el mismo insert del mensaje
    // (lib/chat-mako-adjuntos.ts). Si el mensaje quedó sin ella, el binario no queda suelto.
    const guardados: MensajeChat[] = [];
    // ⚠️ SÓLO SI QUIEN LLAMA LO PIDE (`guardarAdjuntos`): el Second Brain y el chat del teléfono. El MaKo Analyst de un
    //    lead usa este mismo turno, y su PDF es del LEAD: no va a El Archivero del negocio (revisión del 16/10/2026).
    const subidos = adjuntos.length && entrada.guardarAdjuntos ? await subirAdjuntos(ws, adjuntos) : [];
    const bloques = subidos.map((x) => x.bloque);
    let msg: Awaited<ReturnType<typeof appendMessage>>;
    try {
      msg = await appendMessage(s.id, 'user', textoMemoria, bloques);
    } catch (e) {
      await borrarAdjuntos(bloques.map((b) => b.path)); // el mensaje no quedó: sus binarios tampoco
      throw e;
    }
    if (bloques.length && !msg.conBloques) await borrarAdjuntos(bloques.map((b) => b.path));
    const conArchivos = msg.conBloques && msg.id != null ? adjuntosVisibles(msg.id, bloques) : [];
    guardados.push({ role: 'user', content: textoMemoria, ...(conArchivos.length ? { adjuntos: conArchivos } : {}) });
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

    let lectura = lecturas.map((l) => `[Lo que dice «${l.nombre}», leído por el sistema:]\n${l.texto}`).join('\n\n');
    if (lectura.length > TOPE_LECTURA) lectura = `${lectura.slice(0, TOPE_LECTURA)}\n[…el archivo sigue; se cortó aquí por largo]`;
    const pedido = textoPersona || (adjuntos.length ? promptDeAdjunto(adjuntos[0].tipo) : '');
    const textoModelo = lectura ? `${pedido}\n\n${lectura}` : pedido;
    const userContent: RichMsg['content'] = adjuntos.length
      ? bloquesDeAdjuntos(adjuntos.map((a) => ({ tipo: a.tipo, mime: a.mime, base64: Buffer.from(a.bytes).toString('base64') })), textoModelo)
      : textoModelo;

    const turnStart = Date.now();
    const historial = historialParaModelo(previos, 12);
    const vigentes = await pendientesVigentes(ws, canalKey);
    const claveAgenda = `mako.doer.agenda.${canalKey}`;
    const agendaAbierta = agendaVigente(await getSetting(claveAgenda).catch(() => null), Date.now());
    const ultimoDeMako = previos.slice(-2).reverse().find((r) => r.role === 'assistant')?.content ?? null;
    const textoClasificar = `${(entrada.pista ?? '').slice(0, 120)}${adjuntos.length ? textoMemoria : textoPersona}`;
    const intencion = clasificarIntencion(textoClasificar, {
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
    let ticketPropuesto = false;
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
      hayPendientes: vigentes.length > 0, resumenesPendientes: vigentes.map((p) => p.resumen), sinCalendly,
    });
    // Con herramientas, también la de preguntar con opciones (1.9, lib/chat-pregunta.ts): la regla la impone el código.
    const tools = turno.tools.length ? [...(turno.tools as ToolDef[]), TOOL_PREGUNTAR] : (turno.tools as ToolDef[]);
    const permitidas = new Set(tools.map((t) => t.name));

    // El system se arma DESPUÉS de las tools: depende de ellas.
    const base = await buildSystemPrompt({ chartKey: 'mako-doer', titulo: titulo ?? 'MaKo', contexto: '', query: textoPersona || textoMemoria, sinNumerosDelNegocio: persona.rol !== 'admin' });
    const tz = tools.length ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : null;
    const puedeCancelar = permitidas.has('cancelar_accion');
    const ctxPend = vigentes.length
      ? `\n\nACCIONES ESPERANDO CONFIRMACIÓN EN ESTE CHAT (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nLa persona las confirma tocando su tarjeta; tú no puedes confirmarlas.${puedeCancelar ? ' Si te dice que no la quiere, usa cancelar_accion con su id.' : ''}`
      : '';
    const ctxAgenda = agendaAbierta && tools.some((t) => herramientasQueSiguen(agendaAbierta).includes(t.name)) ? contextoAgendaAbierta(agendaAbierta) : '';
    const ctxPuntos = avisoDePuntos(textoPersona);
    const bloqueTools = tools.length
      ? `\n\n${TOOLS_APP}${recetasDelTurno(permitidas, turno.ofrece)}${bloqueAgendaGoogle(tools.map((t) => t.name))}${turno.instruccion ? `\n\n${turno.instruccion}` : ''}\n\n${CANAL_APP}\n\nLAS QUE TIENES EN ESTE TURNO (y NINGUNA otra): ${tools.map((t) => t.name).join(', ')}.`
      : `\n\n${SIN_TOOLS_APP}`;
    const ctxHoy = tz ? `\n\nHOY ES ${hoyLegible(tz)} (zona ${tz}). Para «mañana», «el jueves» o «la semana que viene», calcula la fecha desde aquí; las horas que te digan son de esta zona.` : '';
    const ctxAtado = (entrada.contexto ?? '').trim();
    const system = `${base}\n\n${VOZ_APP}${bloqueTools}${ctxHoy}${ctxPend}${ctxAgenda}${ctxPuntos ? `\n\n${ctxPuntos}` : ''}${ctxAtado ? `\n\n${ctxAtado}` : ''}`;

    // ── Las herramientas ───────────────────────────────────────────────────────
    const runRegistro = runnerDelRegistro(ctx);
    const NOMBRES_DE_SIEMPRE = new Set(MAKO_TOOLS.map((t) => t.name));
    const capturados: LinkCapturado[] = [];
    // Un turno que se re-arranca (la cascada de chatClaudeTools rota de cuenta) no repite
    // acciones: el mismo memo que el doer de WhatsApp.
    const escribe = (n: string) => { const d = porId(n); return d ? d.tipo !== 'lectura' : NOMBRES_ACCION.has(n) && !n.startsWith('listar_'); };
    const memo = crearMemoDeAcciones(escribe);
    // Desde que MaKo pregunta, no se propone nada en el turno (1.9): una lectura sí, para armar las opciones.
    const guardia = crearGuardiaDePregunta(escribe);
    /** Cuántas herramientas corrieron DE VERDAD en el turno, y cuántas LEYERON sin error: el guardia de promesas (1.5). */
    let corridas = 0;
    let leidas = 0;
    /** Los CONTROLES que escribieron de verdad en el turno (`cancelar_accion` sin error): respaldan «ya la cancelé». */
    let escribieron = 0;
    const runTool = async (name: string, input: Record<string, unknown>) => {
      // El contrato se aplica AL EJECUTAR: lo que no viajó no corre, aunque el modelo lo
      // llame (lo dice el texto, lo pide igual). Confirmar, menos que nada.
      if (!permitidas.has(name)) {
        return { content: JSON.stringify({ ok: false, error: `«${name}» no está disponible en este chat.` }), isError: true };
      }
      if (name === PREGUNTAR) {
        const q = guardia.preguntar(input);
        return q.ok ? JSON.stringify({ ok: true, instruccion: q.texto }) : { content: JSON.stringify({ ok: false, error: q.texto }), isError: true };
      }
      if (guardia.bloquea(name)) return { content: JSON.stringify({ ok: false, error: ERROR_TRAS_PREGUNTAR }), isError: true };
      // Lo rechazado no cuenta: no corrió.
      corridas++;
      const previo = memo.previo(name);
      if (previo) return previo.out as Awaited<ReturnType<typeof runRegistro>>;
      // Las de siempre por sus cuerpos de siempre; TODO lo demás (incluidas las acciones
      // heredadas, que tienen gemela) por el registro: así cada acción pasa por el gating
      // de la vista de ESTA persona y deja su pendiente con la clave de ESTE chat.
      // La instrucción de una pendiente es la de WhatsApp («pide un sí»): acá se confirma en la tarjeta.
      // Lo que DIBUJE (`ctx.aDibujar`) queda anotado con el nombre de esta herramienta: con una pregunta, lo de una que
      // escribe se retira. Las herramientas del turno corren de a una (chatClaudeTools las espera en orden).
      herramientaActual = name;
      const out = conInstruccionDeTarjeta(await (NOMBRES_DE_SIEMPRE.has(name) ? runMakoTool(name, input) : runRegistro(name, input)));
      memo.anotar(name, out);
      if (!escribe(name) && (out as { isError?: unknown }).isError !== true) leidas++;
      if (porId(name)?.tipo === 'control' && salioBien(out)) escribieron++;
      const err = errorParaTicket(name, out);
      if (err) erroresDelTurno.push(err);
      else if (name === LEVANTAR_TICKET) ticketPropuesto = true;
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
    const leidaPc = await pcDe(ws, persona.actor).then((d) => ({ d, error: null }), (e: unknown) => ({ d: null, error: e instanceof Error ? e.message : String(e) }));
    const pc = leidaPc.d;
    const pcIlegible = leidaPc.error;
    // Sólo se le manda a una PC en línea CON un Claude con sesión: «en línea» sin sesión no contesta nada.
    const pcPuede = pcUsable(pc);
    // Lo que falló en la PC del cliente (apagada, sin Claude, sin sesión, al tope, no contestó a tiempo) no es un bug.
    let falloDeLaPc: FalloDeLaPc | null = pc && !pcPuede ? (pc.enLinea ? (pc.claudeFalta ? 'sin-claude' : 'sesion') : 'apagada') : null;
    let reponeDeLaPc: string | null = null;
    if (pc && pcPuede) {
      try {
        const modelo = modeloPc(await getSetting(CLAVE_MODELO_PC).catch(() => null));
        const turnoPc = await encolarTurno(pc, s.id, { system, prompt: armarPrompt(historial, textoModelo), tools, modelo });
        // Lo que le queda a la ruta, no 240 s fijos (el Analyst del lead tiene 300 s: Vercel cortaba sin aviso).
        const espera = esperaDelTurno(entrada.plazoMs ?? PLAZO_RUTA_MS, Date.now() - inicio);
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
    // Con «sólo su IA» (D6b) la cascada barata no participa: chatClaudeTools usa su OpenAI o su Claude, o nada. Si la PC
    // tardó (ya no queda tiempo) o el negocio pasó su tope, no se prueba otra cosa.
    if (!texto && falloDeLaPc !== 'tarde' && falloDeLaPc !== 'muchos') {
      try {
        const r = await chatClaudeTools(system, msgs, tools, nuevoIntento(), {
          feature: FEATURE, maxSteps: 8, sinFallbackClaude: true, soloSuIA: negocio.suIA,
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
    const deSuClave = fallo?.includes(CLAUDE_EN_PAUSA) ? { aviso: CLAUDE_EN_PAUSA, conectar: null }
      : falloDeSuClave(fallo) ? { aviso: AVISO_SU_CLAVE, conectar: 'anthropic' } : null;
    // Sin una IA propia no es un bug: es configuración del negocio, y se le pide a la persona (tickets #5 y #6).
    const sinIA = !falloDeLaPc && !deSuClave && faltaIADelNegocio(fallo, fallo ? await iaPropiaDelTurno() : null);

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
      ...(fallo && !sinIA && !falloDeLaPc && !deSuClave ? [{ nombre: 'responder', mensaje: fallo, etiqueta: 'contestarte' }] : []),
      // No poder leer la PC sí es de MaKo (la base), si por eso no hubo respuesta.
      ...(pcIlegible && !texto ? [{ nombre: 'leer-la-pc', mensaje: `no pude leer la computadora: ${pcIlegible}`, etiqueta: 'ver tu computadora' }] : []),
    ];
    if (fallasDeMako.length && !ticketPropuesto) {
      const quien = await identidadDe(ws, persona.actor).catch(() => null);
      const r = await registrarError({ origen: 'mako', ...fallasDeMako[0], hilo: String(s.id) }, quien);
      if (r.ok && r.ticketId) paraLaPersona.push(AVISE_AL_EQUIPO);
    }

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
      const delaPc = avisoDeLaPc(falloDeLaPc, false, { repone: reponeDeLaPc, tz: tzAviso });
      aviso = [aviso, delaPc ?? deSuClave?.aviso ?? sinIAEs?.aviso ?? (pcIlegible && negocio.suIA ? AVISO_PC_ILEGIBLE : null) ?? AVISO_NO_PUDE].filter(Boolean).join(' ');
    }
    let conectar = sinIAEs?.conectar ?? (respuesta ? null : deSuClave?.conectar ?? null);
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
