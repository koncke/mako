// =============================================================================
// mako-doer-in — "Hola MaKo": MaKo ESCUCHA en el grupo, RECUERDA y actúa
// =============================================================================
// El webhook de Evolution nos entrega los mensajes de los grupos de MaKo. Acá
// decidimos si MaKo responde y lo hace con MEMORIA de la conversación (mig 0086).
//
// Enganche (por grupo, setting mako.doer.modo.<jid>):
//   · 'libre'   → responde a TODO mensaje del grupo (grupos dedicados a MaKo).
//   · 'ventana' → responde si lo nombran ("mako"), si es una nota de voz, si hay
//                 una acción pendiente, o si hay una VENTANA abierta. Nombrarlo/
//                 hablarle abre/renueva una ventana de N minutos: dentro de ella
//                 se charla libre sin repetir "Hola MaKo".
// Feedback: muestra "escribiendo…" mientras razona (el modelo puede tardar).
// Escrituras: SIEMPRE por confirmación (mako-doer-acciones): propone → "sí" → hace.

import 'server-only';
import { chatClaudeTools, type RichMsg } from '@/lib/anthropic';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import { validarRespuestaDoer, esRutaPlan, mensajeBorrador, EJEMPLO_BORRADOR, AVISO_NO_PUDE, avisoNoPude, mensajeLeadPropuesto, EJEMPLO_LEAD, conLinksDeAccion } from '@/lib/respuesta-doer';
import { recetasDelTurno } from '@/lib/doer-recetas';
import { evaluarPermiso } from '@/lib/veto-claude';
import { causaDelFallo, textoFalloIA, linkKeysIA } from '@/lib/fallo-ia-texto';
import { LARGO_WHATSAPP } from '@/lib/hechos-mako';
import { reaccionPara, esSoloEmoji, EMOJI_RECIBIDO } from '@/lib/reaccion-emoji';
import { clavesCargadas } from '@/lib/ia-keys-ws';
import { avisoDePuntos, puntosDelMensaje } from '@/lib/puntos-mensaje';
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION, crearRunnerAcciones } from '@/lib/mako-doer-acciones';
import { porId } from '@/lib/api-mako/registro';
import { runnerDelRegistro, vistaDe } from '@/lib/api-mako/ejecutar';
import { herramientasDelTurno } from '@/lib/doer-herramientas';
import { credWs } from '@/lib/credenciales';
import type { Ctx as CtxApi } from '@/lib/api-mako/tipos';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { guardarTurno, historialGrupo } from '@/lib/mako-doer-conv';
import { clasificarIntencion, CONTRATO, avisoDeDuda, makoPreguntoAlgo } from '@/lib/mako-intencion';
import { contactosDelMensaje, textoDeContactos } from '@/lib/vcard';
import { buildSystemPrompt } from '@/lib/mako-context';
import { reaccionarMensaje, enviarAGrupoJid, KEY_GRUPO_JID, KEY_GRUPO_SUPERADMIN } from '@/lib/mako-grupo';
import { enviarPresencia, fetchMediaBase64EnInstancia } from '@/lib/evolution';
import { getSetting, setSetting } from '@/lib/settings';
import { wsSuperAdmin, runWithWorkspace, OWNER_WS, esWorkspaceDueno } from '@/lib/workspace';
import { informeParaRango } from '@/lib/informe-congelado';
import { getSupabaseServer } from '@/lib/supabase';
import { APP_BASE_URL as APP_URL, linkApp } from '@/lib/app-url';
import { provsGratisDePlataforma, provsDe, rotulo, nroCuenta, transcribirAudio, SttSinEscucha, chatCheap, chatCheapTools, cheapDisponible } from '@/lib/ai-cheap';
import { paraWhatsApp, agendaQueSigue, agendaSeCierra, agendaVigente, contextoAgendaAbierta, bloqueAgendaGoogle, herramientasQueSiguen, ACCIONES_AGENDA } from '@/lib/agenda-sin-ia';
import { crearMemoDeAcciones } from '@/lib/turno-sin-duplicar';
// El MISMO lector que usa el importador del tablero. Que WhatsApp tenga su propia idea
// de qué formatos existen es cómo un .txt terminó rebotando (ver AGENTS.md, "Una cosa,
// un lugar").
import { archivoATexto } from '@/lib/archivo-a-texto';
import { puedeLeerse, formatosLegibles, porQueNoPuedo } from '@/lib/formatos-archivo';
import { ordenarPorCuota, anotarRebote429 } from '@/lib/ia-cuotas';
import { recordUsage } from '@/lib/anthropic-usage';
import { rutearDoer } from '@/lib/mako-router';
import { overrideDeFeature } from '@/lib/model-registry';
import { encolar, reclamar, soltar, pendientes, esperarSilencio, marcarProcesados, unirMensajes, huerfanosGlobal, VENTANA_MS, VENTANA_AUDIO_MS } from '@/lib/mako-doer-buffer';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';

// ── settings del doer ─────────────────────────────────────────────────────────
const KEY_ACTIVO = 'mako.doer.activo';        // interruptor general (default: ON)
const KEY_GRUPOS = 'mako.doer.grupos';        // allowlist de JIDs donde MaKo escucha
const KEY_LAST = (jid: string) => `mako.doer.last.${jid}`;     // dedup del último msg
const KEY_SENT = (jid: string) => `mako.doer.sent.${jid}`;     // ids que MANDÓ MaKo (anti-eco)
const KEY_MODO = (jid: string) => `mako.doer.modo.${jid}`;     // 'libre' | 'ventana'
const KEY_VENTANA = (jid: string) => `mako.doer.ventana.${jid}`; // ISO de vencimiento
const VENTANA_MIN = 15;                       // duración de la ventana de charla libre

// La línea de voz de MaKo suele ser el número PROPIO del dueño: sus mensajes y los
// de MaKo llegan los dos como fromMe. Guardamos los ids que enviamos para poder
// distinguir "el dueño escribe" (procesar) del "eco de mi propia respuesta" (saltar).
async function idsEnviados(ws: number, jid: string): Promise<string[]> {
  return runWithWorkspace(ws, async () => {
    const raw = await getSetting(KEY_SENT(jid));
    if (!raw) return [];
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; }
  });
}
async function registrarEnviado(ws: number, jid: string, id: string): Promise<void> {
  return registrarEnviados(ws, jid, [id]);
}
// Registra VARIOS ids en UN solo read-modify-write. Importante con los mensajes
// separados (punto 10): antes eran N escrituras concurrentes sobre la misma key
// (lost-update → MaKo procesaba su propio eco); ahora la respuesta se registra de una.
async function registrarEnviados(ws: number, jid: string, ids: string[]): Promise<void> {
  const nuevos = ids.filter(Boolean);
  if (!nuevos.length) return;
  const prev = await idsEnviados(ws, jid);
  const next = [...prev.filter((x) => !nuevos.includes(x)), ...nuevos].slice(-40); // ring buffer
  await runWithWorkspace(ws, () => setSetting(KEY_SENT(jid), JSON.stringify(next)));
}

/** JIDs de grupo donde el doer está habilitado (allowlist). */
export async function gruposDoer(ws: number): Promise<string[]> {
  return runWithWorkspace(ws, async () => {
    const raw = await getSetting(KEY_GRUPOS);
    if (!raw) return [];
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; }
  });
}
export async function setGruposDoer(ws: number, jids: string[]): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_GRUPOS, JSON.stringify([...new Set(jids)])));
}
async function doerActivo(ws: number): Promise<boolean> {
  return runWithWorkspace(ws, async () => (await getSetting(KEY_ACTIVO)) !== 'false');
}

/** Modo del grupo: 'libre' (responde a todo — DEFAULT) o 'ventana' (con activador).
 *  Los grupos de MaKo (Pruebas, SuperAdmin y los de cada cliente) son 100% para
 *  hablarle a la IA, así que por defecto responde a todo; 'ventana' es opt-in. */
export async function modoDoer(ws: number, jid: string): Promise<'libre' | 'ventana'> {
  return runWithWorkspace(ws, async () => ((await getSetting(KEY_MODO(jid))) === 'ventana' ? 'ventana' : 'libre'));
}
export async function setModoDoer(ws: number, jid: string, modo: 'libre' | 'ventana'): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_MODO(jid), modo));
}
async function ventanaVigente(ws: number, jid: string): Promise<boolean> {
  const iso = await runWithWorkspace(ws, () => getSetting(KEY_VENTANA(jid)));
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > Date.now();
}
async function abrirVentana(ws: number, jid: string): Promise<void> {
  const iso = new Date(Date.now() + VENTANA_MIN * 60_000).toISOString();
  await runWithWorkspace(ws, () => setSetting(KEY_VENTANA(jid), iso));
}

// ── parseo del mensaje entrante ───────────────────────────────────────────────
type MsgIn = { key?: { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string }; message?: Record<string, unknown>; pushName?: string; base64?: string };

function textoDe(m: MsgIn): string {
  const msg = m.message ?? {};
  if (typeof msg.conversation === 'string') return msg.conversation;
  const ext = msg.extendedTextMessage as { text?: string } | undefined;
  if (ext && typeof ext.text === 'string') return ext.text;
  const img = msg.imageMessage as { caption?: string } | undefined;
  if (img?.caption) return img.caption;
  // TARJETA DE CONTACTO. Es la forma natural de pasar un lead por WhatsApp —
  // nadie tipea un teléfono que ya tiene en la agenda— y era justo la única que
  // no se leía: entraba, no daba ni texto ni adjunto, y MaKo respondía «no me
  // llegó ningún dato», que es lo contrario de lo que había pasado. Ver lib/vcard.ts.
  const contactos = contactosDelMensaje(msg);
  if (contactos.length) return textoDeContactos(contactos);
  return '';
}

/** ¿El mensaje trae una nota de voz? Devuelve el base64 inline si vino, o marca que
 *  hay audio para pedirlo aparte (el webhook no siempre adjunta el base64). */
function audioDe(m: MsgIn): { base64: string | null; mime: string } | null {
  const msg = m.message ?? {};
  const am = msg.audioMessage as { base64?: string; mimetype?: string } | undefined;
  const ptt = msg.pttMessage as { base64?: string; mimetype?: string } | undefined;
  const a = am || ptt;
  if (!a) return null;
  const b64 = m.base64 || a.base64 || (msg.base64 as string | undefined) || null;
  return { base64: b64, mime: a.mimetype || 'audio/ogg' };
}

/**
 * ¿Trae un archivo? Tres caminos, y el tercero es el que faltaba:
 *
 *  · IMAGEN → va NATIVA a Claude (una captura se entiende mirándola, no describiéndola).
 *  · PDF    → va NATIVO a Claude (mantiene el layout: tablas, columnas, orden de lectura).
 *  · CUALQUIER OTRO archivo → se LEE con `archivoATexto`, el mismo lector que usa el
 *    importador del tablero. .txt, .md, .vtt, .srt, .csv, .docx, audio, video…
 *
 * ANTES ACÁ SOLO ENTRABAN IMÁGENES Y PDF: todo lo demás rebotaba con «ese tipo de
 * archivo todavía no», incluido un .txt — que es texto plano y es EL formato más fácil
 * de leer que existe. Martín mandó uno por WhatsApp para cargarlo al plan y le rebotó.
 *
 * La lista de lo que se puede leer NO se escribe acá: sale de `lib/formatos-archivo.ts`.
 * Si mañana el lector aprende un formato nuevo, WhatsApp lo acepta solo — que es
 * exactamente lo que no pasó la primera vez.
 */
function adjuntoDe(m: MsgIn): { tipo: 'image' | 'document' | 'texto'; base64: string | null; mime: string; caption: string; nombre: string; soportado: boolean } | null {
  const msg = m.message ?? {};
  const img = msg.imageMessage as { base64?: string; mimetype?: string; caption?: string } | undefined;
  if (img) {
    const mime = (img.mimetype || 'image/jpeg').split(';')[0];
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(mime);
    return { tipo: 'image', base64: m.base64 || img.base64 || null, mime: ok ? mime : 'image/jpeg', caption: img.caption || '', nombre: 'captura.jpg', soportado: true };
  }
  const doc = msg.documentMessage as { base64?: string; mimetype?: string; caption?: string; fileName?: string } | undefined;
  if (doc) {
    const mime = (doc.mimetype || '').split(';')[0];
    const nombre = doc.fileName || 'archivo';
    const caption = doc.caption || nombre;
    if (/pdf/i.test(mime) || /\.pdf$/i.test(nombre)) {
      return { tipo: 'document', base64: m.base64 || doc.base64 || null, mime: 'application/pdf', caption, nombre, soportado: true };
    }
    // Todo lo demás va por el lector compartido. `soportado` lo decide la extensión que
    // ese lector declara: no hay una segunda lista acá que se pueda quedar vieja.
    return { tipo: 'texto', base64: m.base64 || doc.base64 || null, mime, caption, nombre, soportado: puedeLeerse(nombre, mime) };
  }
  return null;
}



/** Cuánto texto de un archivo entra en un turno de WhatsApp. 200.000 caracteres son
 *  unas 6 horas de transcripción: más que eso no es una charla, es una importación
 *  (para eso está el importador del tablero, que trocea). Lo que se corta SE DICE. */
const TOPE_ARCHIVO_WA = 200_000;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
/** ¿El mensaje interpela a MaKo? (lo nombra al principio o lo menciona). */
function nombraAMaKo(texto: string): boolean {
  const t = norm(texto).trim();
  if (/\bmako\b/.test(t.slice(0, 60))) return true;   // "hola mako", "che mako, ..."
  return false;
}

/** ¿Es una CARGA de tareas al plan? (para el acuse instantáneo, punto 10). MUY estricto
 *  a propósito: "anotá/apuntá" (casi siempre = anotar en el plan), "al plan/a la lista",
 *  o una lista de ≥2 ítems. NADA de sumá/agregá/cargá: son ambiguos (sumar=totalizar,
 *  agregar un contacto, cargar un reporte) y dispararían el acuse fuera de lugar. Ante la
 *  duda NO acusamos (el pedido igual se procesa igual, solo sin el "recibido" instantáneo). */
function esCargaDePlan(texto: string): boolean {
  if (/\b(anot[aá]|apunt[aá])|al plan\b|a la lista\b/i.test(norm(texto))) return true;
  return (texto.match(/(^|\n)\s*(\d+[.)]|[-*•])\s+\S/g) ?? []).length >= 2;
}

/** Sanea el historial para la Messages API: arranca en 'user' y no repite rol. */
function saneaHistorial(turnos: Array<{ role: 'user' | 'assistant'; content: string }>): RichMsg[] {
  const out: RichMsg[] = [];
  for (const t of turnos) {
    if (!out.length && t.role !== 'user') continue;          // debe arrancar en user
    if (out.length && out[out.length - 1].role === t.role) { // fusiona roles repetidos
      out[out.length - 1] = { role: t.role, content: `${out[out.length - 1].content}\n${t.content}` };
    } else {
      out.push({ role: t.role, content: t.content });
    }
  }
  return out;
}

// ── preámbulo del doer en el grupo de WhatsApp ────────────────────────────────
/**
 * LA VOZ Y EL FORMATO. Va SIEMPRE, con tools y sin tools.
 */
/** «martes, 7 de octubre de 2026, 20:45», en la zona que se pase. */
function hoyLegible(tz: string): string {
  try {
    return new Date().toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  } catch {
    return new Date().toISOString();
  }
}

const DOER_WA_VOZ = `CONTEXTO: estás en un grupo de WhatsApp con el dueño del negocio (y a veces su equipo). Te escriben a ti. Ves el HISTORIAL de la conversación: úsalo, no arranques de cero ni pidas datos que ya te dieron antes. Responde como MaKo: breve, humano, estilo WhatsApp (2-5 líneas, sin volcar JSON ni tecnicismos).

SI NO ENTENDISTE SI TE ESTÁN PIDIENDO ALGO O SOLO CONTÁNDOTE ALGO: contesta como en una charla y, si te parece que hay algo para anotar en el plan, PREGUNTA ("¿te lo anoto como tarea?"). ⛔ No crees un borrador que no te pidieron: al cliente le llega un link a revisar un plan que no pidió y no entiende de dónde salió.`;

/**
 * ⚠️ EL PROTOCOLO DE HERRAMIENTAS, Y SOLO VA SI DE VERDAD SE MANDAN HERRAMIENTAS.
 *
 * EL CASO (01/10/2026, ws13). Un cliente escribió «hola mako, como venimos de
 * reuniones los ultimos 15 dias» y recibió «⚠️ Te quedaste sin cuota de IA». Su key
 * había contestado HTTP 200. La intención fue `charlar`, cuyo contrato es `tools: []`
 * (lib/mako-intencion.ts), y el turno entró igual al loop de tool-use — con el array
 * vacío y con ESTE texto, que nombra diez herramientas una por una y ORDENA usarlas.
 *
 * ⚠️ Y LA LISTA VACÍA NO ERA LA CAUSA: ES EL PROMPT. Medido en vivo contra las dos
 * APIs, con las keys de la agencia:
 *   · system CORTO + `tools: []` + `tool_choice: auto` → Groq HTTP 200, contesta bien.
 *   · ESTE system + `tools: []`            → Groq HTTP 400 «Tool choice is none, but
 *     model called a tool» (3/3) y Gemini HTTP 200 con el content VACÍO (2/2).
 *   · ESTE system SIN el campo `tools`     → exactamente lo mismo (2/2).
 * O sea que sacar el campo del body no alcanza: lo que rompe es pedirle al modelo que
 * llame algo que no recibió. Es «una regla en un prompt no es una regla» con el signo
 * dado vuelta — un prompt que PROMETE una capacidad que la API no concede.
 *
 * ⚠️ Y encima el modelo la llama igual: Gemini devolvió `finish_reason: tool_calls`
 * pidiendo `metricas_negocio`, que sólo existía en el TEXTO de acá abajo. Por eso
 * `runTool` chequea contra la lista del turno (ver `permitidasDelTurno`).
 */
const DOER_WA_TOOLS = `TUS HERRAMIENTAS (la lista exacta de este turno está al final): úsalas para responder con datos reales; nunca inventes nombres, números ni fechas. Si te preguntan por un lead/reunión/campaña, BÚSCALO con las tools antes de decir que no lo tienes. Si necesitas VARIOS datos, pide TODAS las herramientas en el MISMO paso (puedes llamar varias a la vez): cada paso de más vuelve a mandar la conversación entera.

SEGÚN DE QUÉ TE HABLEN, puedes tener herramientas de cada tab de MaKo (email, chatbot, landing, métricas, experimentos…). Úsalas igual que las demás: una lectura trae el dato; una acción NUNCA ejecuta directo — o deja una acción pendiente (pides el "sí") o te devuelve un LINK para revisar en MaKo (lo pasas tal cual y no pides confirmación por el chat).`;


// Dónde ver el detalle completo en la app: MaKo da un resumen corto y REDIRIGE con
// un link cuando hay una vista más rica (para eso están las tabs). {id} = id del lead.
const DEEP_LINKS = `LINKS A LA APP: cuando el detalle completo vive en una tab, da el resumen corto y CIERRA con un link para verlo (formato: "Mira el detalle aquí → URL"). No inventes rutas; usa estas (base ${APP_URL}):
- Ficha 360 de un lead: ${APP_URL}/crm/{id}
- Análisis de una llamada de ventas: ${APP_URL}/closing?call={recording_id} (el recording_id sale de reuniones_lead → analisis_llamadas). Si no lo tienes, ${APP_URL}/closing.
- WhatsApp con un lead: ${APP_URL}/whatsapp?lead={id}
- Marketing / anuncios: ${APP_URL}/dashboard · Ads Manager: ${APP_URL}/ads-manager
- Experimentos (verdades validadas): ${APP_URL}/experimentos
- Plan / tareas: ${APP_URL}/plan · Nutrición y email: ${APP_URL}/email
- Salud de la cuenta de Meta: ${APP_URL}/integraciones
Ej: "Con Jesús la R1 se ve floja en el cierre. El análisis completo lo tienes aquí → ${APP_URL}/closing".`;

/**
 * Cuántas API keys de IA tiene cargadas ESTE workspace.
 *
 * Es el dato que separa «se cayó el proveedor» de «se cayó el proveedor Y no
 * tenías respaldo»: el hecho técnico es el mismo, y lo que el cliente puede hacer
 * al respecto no. Con 0 no hay IA; con 1 no hay cascada.
 */
async function contarKeysIA(): Promise<number> {
  let n = 0;
  for (const prov of ['gemini', 'groq', 'cerebras', 'mistral', 'openrouter']) {
    n += (await clavesCargadas(prov).catch(() => [])).length;
  }
  return n;
}

export type ResultadoDoer = { engaged: boolean; reply?: string; skip?: string };

/**
 * SEGURIDAD / AISLAMIENTO: ¿de qué workspace son los DATOS que ve el doer en este
 * grupo? Lo decide el GRUPO (quién lo posee), NO la instancia que lo recibió. Si el
 * grupo es el mako.grupo_jid de un CLIENTE → ese cliente (ve SUS datos, jamás los del
 * dueño ni los de otro cliente). Si es el grupo SuperAdmin o uno de prueba del dueño →
 * OWNER_WS. Cualquier otro → null (no contestamos: fail-closed).
 */
/**
 * De quién es ESTE grupo. Exportada porque el acuse de recibo del webhook necesita
 * exactamente la misma respuesta: resolver por la INSTANCIA le da el workspace de la
 * línea, y la línea de voz de MaKo está mapeada al dueño — así que todo «ok» de todo
 * grupo de todo cliente caía al ws1 (ver app/api/webhooks/evolution/route.ts).
 */
export async function wsDeGrupoJid(jid: string): Promise<number | null> {
  // 1) ¿Grupo MaKo de algún cliente? → ESE workspace. Va PRIMERO: aunque el dueño lo
  //    tenga en su allowlist, los datos se scopean al cliente dueño del grupo.
  const { data } = await getSupabaseServer()
    .from('app_settings').select('workspace_id').eq('key', KEY_GRUPO_JID).eq('value', jid).limit(1).maybeSingle();
  const wsCliente = (data as { workspace_id?: number } | null)?.workspace_id;
  if (wsCliente != null) return wsCliente;
  // 2) Grupo SuperAdmin del dueño.
  const superadmin = await runWithWorkspace(OWNER_WS, () => getSetting(KEY_GRUPO_SUPERADMIN));
  if (superadmin && jid === superadmin) return OWNER_WS;
  // 3) Grupos de prueba del dueño (su allowlist), p.ej. "MaKo · Pruebas".
  if ((await gruposDoer(OWNER_WS)).includes(jid)) return OWNER_WS;
  return null;
}

/**
 * Procesa un mensaje entrante de grupo. Best-effort: nunca lanza. `instance` es la
 * línea que RECIBIÓ el mensaje (para pedirle el audio y mostrar "escribiendo…").
 * El control operativo (allowlist/modo/ventana) vive en la AGENCIA (OWNER_WS); los
 * DATOS y la memoria se scopean al workspace DUEÑO DEL GRUPO (aislamiento).
 */
// Qué tools ve el modelo en este turno: `herramientasDelTurno` (lib/doer-herramientas.ts).
export async function manejarEntranteDoer(instance: string, data: MsgIn): Promise<ResultadoDoer> {
  const jid = data.key?.remoteJid;
  if (!jid || !jid.endsWith('@g.us')) return { engaged: false, skip: 'no es grupo' };

  // Aislamiento PRIMERO: ¿de quién es este grupo? wsDeGrupoJid solo reconoce grupos
  // creados por la app (el `mako.grupo_jid` de un workspace, el SuperAdmin, o los de
  // prueba del dueño). Un grupo cualquiera devuelve null y no se contesta.
  const wsData = await wsDeGrupoJid(jid);
  if (wsData == null) return { engaged: false, skip: 'grupo sin dueño reconocido' };

  // El grupo OFICIAL de MaKo de un cliente está habilitado por el hecho de existir:
  // se lo creó el onboarding para hablar con MaKo, y exigir además que el dueño lo
  // sumara a mano a su allowlist dejaba a los clientes hablándole a una pared —
  // Mauricio (ws1) y Leila (ws11) escribieron y NADIE respondió, porque solo estaban
  // habilitados el grupo de Martín y uno de pruebas. La allowlist queda para los
  // grupos EXTRA (pruebas, equipos internos), no para los oficiales.
  const suyo = await grupoOficialDe(wsData);
  if (jid !== suyo && !(await gruposDoer(OWNER_WS)).includes(jid)) {
    return { engaged: false, skip: 'grupo no habilitado' };
  }
  return runWithWorkspace(wsData, () => bufferearYResponder(wsData, instance, data));
}

/**
 * EL CANDADO DEL LOTE. Antes, cada mensaje entrante corría el agente por su cuenta y
 * en paralelo: el 5/8 entraron 16 mensajes en 4 segundos y salieron 16 borradores, 133
 * tareas y 19 proyectos duplicados. El dueño lo pidió así: «si detecta que le estoy
 * enviando muchos mensajes debería esperar y luego cargar TODAS las tareas al mismo
 * tiempo».
 *
 * Todo mensaje se ENCOLA. Una sola invocación gana el candado del grupo, espera el
 * silencio y contesta una vez por todo. Las otras encolan y se van calladas.
 */
async function bufferearYResponder(wsData: number, instance: string, data: MsgIn): Promise<ResultadoDoer> {
  const jid = data.key?.remoteJid ?? '';
  const msgId = data.key?.id ?? '';
  const audio = audioDe(data);
  const adjunto = adjuntoDe(data);
  const texto = textoDe(data).trim();
  // ── REACCIONES ───────────────────────────────────────────────────────────
  //
  // Pedido del dueño (25/8/2026): risa o corazón a los stickers, y un 👍 a cada
  // petición «para afirmar que la recibió».
  //
  // ⚠️ VA ANTES DEL SKIP DE ABAJO, que es donde el sticker moría. Un sticker no
  // trae texto, ni audio, ni adjunto: caía en «sin texto ni audio ni adjunto» y
  // MaKo no hacía absolutamente nada — indistinguible de estar caída, que es la
  // sensación que este cliente ya tuvo tres veces esta semana.
  const stickerRaw = (data.message as Record<string, unknown> | undefined)?.stickerMessage as
    { accessibilityLabel?: string; emoji?: string } | undefined;
  const esGif = Boolean((data.message as Record<string, unknown> | undefined)?.videoMessage
    && ((data.message as Record<string, unknown>).videoMessage as { gifPlayback?: boolean })?.gifPlayback);
  const soloEmoji = esSoloEmoji(texto);

  if (stickerRaw || esGif || soloEmoji) {
    // La pista sale de lo que haya: el emoji tipeado, o la etiqueta que algunos
    // stickers traen. Sin pista → risa, que es el default que pidió el dueño.
    const pista = soloEmoji ? texto : (stickerRaw?.emoji ?? stickerRaw?.accessibilityLabel ?? '');
    await reaccionarMensaje(jid, data.key, reaccionPara(pista)).catch(() => false);
    // Un sticker no se contesta con palabras: la reacción ES la respuesta. Si
    // además traía texto (un emoji suelto no), sigue el camino normal.
    if (!soloEmoji || !texto) return { engaged: true, skip: 'sticker/gif: reaccionado' };
    return { engaged: true, skip: 'emoji suelto: reaccionado' };
  }

  if (!texto && !audio && !adjunto) return { engaged: false, skip: 'sin texto ni audio ni adjunto' };

  // El 👍 del acuse: MaKo va a procesar esto, y que se sepa YA. Best-effort y sin
  // await bloqueante en el camino feliz — si la reacción falla, el turno sigue.
  void reaccionarMensaje(jid, data.key, EMOJI_RECIBIDO).catch(() => false);

  // El eco de nuestra propia respuesta no entra a la cola (si no, MaKo se contesta sola).
  if (data.key?.fromMe && msgId && (await idsEnviados(OWNER_WS, jid)).includes(msgId)) {
    return { engaged: false, skip: 'eco de mi propia respuesta' };
  }

  const nuevo = await encolar(jid, { waId: msgId, texto, tieneMedia: !!adjunto, tieneAudio: !!audio, payload: data as unknown });
  if (!nuevo && msgId) return { engaged: false, skip: 'ya estaba en la cola (re-entrega)' };

  const quien = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  if (!(await reclamar(jid, quien))) return { engaged: false, skip: 'encolado — ya hay alguien juntando' };

  // "Escribiendo…" YA, aunque la respuesta tarde la ventana de silencio. Es lo que
  // hace que la espera se sienta atención y no abandono, y no cuesta un mensaje.
  // 55s y no 25s: la espera real MEDIDA de un audio es de 38 a 52 segundos, así que
  // el "escribiendo…" se apagaba a mitad de camino y el chat quedaba muerto.
  void enviarPresencia(instance, jid, 'composing', 55000);

  // ── ACUSE DE RECIBO DE UNA NOTA DE VOZ / UN ADJUNTO ───────────────────────
  // Medido en prod sobre los tres audios del 8/8: 38,6 · 50,6 · 51,7 segundos SIN
  // que MaKo dijera una sola palabra. Y no es una molestia estética: el dueño
  // reenvió el mismo audio 2 min 43 s después creyendo que no había llegado, y
  // salieron dos borradores duplicados de la misma cosa.
  //
  // El acuse de TEXTO ya existía (en `procesarDoer`), pero su condición arranca con
  // `!audio`, o sea que excluía por definición al caso más lento. Y sobre todo:
  // vive DESPUÉS de `esperarSilencio`, así que el buffer del lote —que se agregó
  // más tarde— lo empujó detrás de 21 segundos de espera. El comentario de allá que
  // dice «lo mandamos ACÁ, lo primero» quedó viejo el día que se sumó el buffer.
  //
  // ACÁ es el único punto del pipeline por el que pasa EXACTAMENTE UNA invocación
  // por lote (el que pierde el candado ya volvió en la línea de arriba), y está
  // delante de la espera. Mandar tres audios seguidos deja un solo «te escucho».
  //
  // Solo para media, a propósito: una nota de voz o un adjunto SIEMPRE enganchan
  // (más abajo, `esMedia` saltea el chequeo de modo/ventana), así que acá no hace
  // falta repetir esa guarda. Para texto el acuse sigue donde estaba, porque ahí sí
  // depende de si lo nombran y de si hay una charla pendiente.
  //
  // Y EL DE TEXTO TAMBIÉN, por la misma razón. Vivía en `procesarDoer`, o sea DETRÁS de
  // `esperarSilencio`: el «Dale, anoto eso» llegaba 8 segundos después de mandar el
  // mensaje (20 si el lote traía audio). El dueño: «tarda mucho en enviarse, eso tiene
  // que ser casi de inmediato». El comentario de allá decía «lo mandamos ACÁ, lo
  // primero» y era verdad el día que se escribió — el buffer llegó después y lo empujó
  // atrás sin que nadie tocara esa línea. Ahora hay UN solo acuse, y está acá.
  //
  // Para texto SÍ hay que preguntar si engancha (en media no: siempre engancha), y son
  // tres lecturas baratas de settings. Se cortocircuitan en orden de costo.
  if (audio || adjunto) {
    if (!(await doerActivo(OWNER_WS))) return { engaged: false, skip: 'doer desactivado' };
    const ackTxt = audio ? 'Te escucho 🎧 dame un momento y te contesto.' : 'Me llegó 📎 lo miro y te contesto.';
    const ack = await enviarAGrupoJid(jid, ackTxt, 0);   // delay 0: sin el retardo anti-ban
    // El anti-eco ANTES de seguir: la línea de voz es el número del propio dueño, así
    // que todo lo que manda MaKo vuelve por el webhook como `fromMe`. Sin registrar el
    // id, el acuse se encola como si lo hubiera dicho él.
    if (ack.ok && ack.id) await registrarEnviado(OWNER_WS, jid, ack.id);
  } else if (texto.length > 10 && (await doerActivo(OWNER_WS))) {
    const modo = await modoDoer(OWNER_WS, jid);
    const engancha = modo === 'libre' || nombraAMaKo(texto)
      || (await ventanaVigente(OWNER_WS, jid))
      || (await pendientesVigentes(wsData, jid)).length > 0;
    // Con una charla pendiente NO se acusa: ahí MaKo está en medio de un ida y vuelta
    // y un «dame un segundo» corta la conversación en vez de acompañarla.
    const hayCharla = (await pendientesVigentes(wsData, jid)).length > 0;
    if (engancha && !hayCharla && (esCargaDePlan(texto) || rutearDoer(texto, { hayMedia: false, hayPendientes: false }).tier !== 'cheap')) {
      const ackTxt = esCargaDePlan(texto) ? 'Claro, anoto eso 👇 dame un segundo.' : 'Recibido 👍 dame un momento y te contesto.';
      const ack = await enviarAGrupoJid(jid, ackTxt, 0);
      if (ack.ok && ack.id) await registrarEnviado(OWNER_WS, jid, ack.id);
    }
  }

  try {
    // Un adjunto no espera: es un acto deliberado y se responde solo.
    const cola = adjunto ? await pendientes(jid) : await esperarSilencio(jid, audio ? VENTANA_AUDIO_MS : VENTANA_MS);
    if (!cola.length) return { engaged: false, skip: 'la cola quedó vacía' };

    // UNO SOLO → el camino de siempre, sin tocar nada. Es el caso mayoritario y no
    // tiene sentido meterle un rodeo: se procesa su payload tal cual llegó.
    if (cola.length === 1) {
      const r = await procesarDoer(wsData, instance, (cola[0].payload as MsgIn) ?? data);
      await marcarProcesados(cola.map((m) => m.id));
      return r;
    }

    // VARIOS → un solo turno con todo junto. Los audios se transcriben ahora (uno por
    // uno) y el texto se arma numerado, para que el modelo entienda que fueron mensajes
    // separados y que el último puede corregir al primero.
    const textos: string[] = [];
    for (const m of cola) {
      const p = (m.payload as MsgIn) ?? {};
      let t = m.texto.trim();
      if (!t && audioDe(p)) t = await transcribirDeMensaje(instance, p);
      // El ARCHIVO gana sobre el texto suelto del mensaje: `textoDeArchivo` ya mete
      // adentro el pedido («mako, cargá esto») junto al contenido, así que usar `t` acá
      // perdería el archivo — que es justo lo que pasaba.
      const arch = await textoDeArchivo(instance, p);
      if (arch) t = arch.texto || arch.error || t;
      // Una imagen o un PDF NO entran en un lote: el turno sintético es texto plano y
      // los bloques nativos no viajan. Antes desaparecían sin dejar rastro — mandabas
      // la captura junto a un mensaje y MaKo contestaba como si no existiera. Ahora al
      // menos se nombra, así MaKo puede pedirla de nuevo en vez de ignorarla.
      const otro = adjuntoDe(p);
      if (otro && otro.tipo !== 'texto') {
        t = `${t ? `${t}\n` : ''}(en este mensaje mandé ${otro.tipo === 'image' ? 'una imagen' : 'un PDF'}${otro.caption ? `: «${otro.caption}»` : ''}, pero llegó junto a otros mensajes y no la pudiste mirar — pídemela suelta si la necesitas)`;
      }
      if (t) textos.push(t);
    }
    if (!textos.length) { await marcarProcesados(cola.map((m) => m.id)); return { engaged: false, skip: 'nada legible en el lote' }; }
    const ultimo = (cola[cola.length - 1].payload as MsgIn) ?? data;
    const sintetico: MsgIn = {
      key: { remoteJid: jid, id: ultimo.key?.id ?? msgId, fromMe: ultimo.key?.fromMe },
      pushName: ultimo.pushName,
      message: { conversation: unirMensajes(textos.map((t) => ({ texto: t }))) },
    };
    console.log(`[mako-doer-in] lote de ${cola.length} mensajes en ${jid} → una sola respuesta`);
    const r = await procesarDoer(wsData, instance, sintetico);
    await marcarProcesados(cola.map((m) => m.id));
    return r;
  } finally {
    await soltar(jid, quien);
  }
}

/** Por qué no puedo abrir esto, y qué hacer. Si sabemos el motivo concreto («es el Word
 *  viejo, guardalo como .docx») lo decimos: un «no sé leer ese formato» deja al dueño
 *  adivinando con el archivo en la mano. */
function noPuedoAbrir(nombre: string): string {
  const motivo = porQueNoPuedo(nombre);
  return motivo
    ? `«${nombre}» ${motivo}`
    : `«${nombre}» no lo puedo abrir. Sí puedo con: ${formatosLegibles()}.`;
}

/**
 * Lee el archivo de un mensaje y devuelve su contenido listo para entrar como texto.
 *
 * Vive acá afuera —y no adentro de procesarDoer— porque hay DOS caminos que reciben
 * mensajes: el de uno solo y el del LOTE (cuando llegan varios en ráfaga). El lote
 * transcribía los audios pero no leía los archivos, así que un .txt mandado junto a
 * «mako, cargá esto» se caía en silencio: el mensaje sintético se armaba sin él.
 *
 * Devuelve null si el mensaje no trae un archivo de texto. Si trae uno que no se puede
 * abrir, devuelve el motivo en `error` para que quien llama se lo diga al dueño.
 */
async function textoDeArchivo(instance: string, m: MsgIn): Promise<{ texto: string; error: string } | null> {
  const adj = adjuntoDe(m);
  if (!adj || adj.tipo !== 'texto') return null;
  if (!adj.soportado) {
    return { texto: '', error: noPuedoAbrir(adj.nombre) };
  }
  let b64 = adj.base64;
  const id = m.key?.id ?? '';
  if (!b64 && id) {
    const media = await fetchMediaBase64EnInstancia(instance, m.key?.remoteJid ?? '', id, !!m.key?.fromMe);
    if (media) b64 = media.base64;
  }
  if (!b64) { console.error(`[mako-doer-in] «${adj.nombre}» sin base64`); return { texto: '', error: '' }; }

  // Un .txt/.md/.docx/.vtt NO va como media block: mandárselo a Claude en base64 es la
  // vía cara para algo que se resuelve con file.text(). Se lee y su contenido ES el texto.
  const file = new File([Buffer.from(b64, 'base64')], adj.nombre, { type: adj.mime || 'text/plain' });
  const lect = await archivoATexto(file).catch((e) => ({ texto: '', via: 'no-soportado' as const, warning: e instanceof Error ? e.message : String(e) }));
  const contenido = (lect.texto || '').trim();
  if (!contenido) {
    return { texto: '', error: lect.warning
      ? `Me llegó «${adj.nombre}» pero no lo pude leer: ${lect.warning}`
      : `Me llegó «${adj.nombre}» pero salió vacío — no tiene texto que yo pueda sacar.` };
  }
  // El corte se DICE, no se traga: un archivo cortado en silencio son la mitad de las
  // tareas perdidas sin que nadie se entere.
  const cortado = contenido.length > TOPE_ARCHIVO_WA;
  const cuerpo = cortado ? `${contenido.slice(0, TOPE_ARCHIVO_WA)}\n\n[…corté aquí: el archivo sigue, pero no entra entero en un mensaje]` : contenido;
  const pedido = textoDe(m).trim() || (adj.caption && adj.caption !== adj.nombre ? adj.caption : '');
  console.log(`[mako-doer-in] archivo «${adj.nombre}» leído por ${lect.via}: ${contenido.length} chars${cortado ? ' (CORTADO)' : ''}`);
  return {
    texto: [
      pedido || `Te mando «${adj.nombre}». Léelo y dime qué hacemos con esto.`,
      '',
      `<<<ARCHIVO «${adj.nombre}»>>>`,
      cuerpo,
      '<<<FIN DEL ARCHIVO>>>',
    ].join('\n'),
    error: '',
  };
}

/** Transcribe la nota de voz de un mensaje ya encolado ('' si no se pudo). */
async function transcribirDeMensaje(instance: string, m: MsgIn): Promise<string> {
  const a = audioDe(m);
  if (!a) return '';
  let b64 = a.base64;
  const id = m.key?.id ?? '';
  if (!b64 && id) {
    const media = await fetchMediaBase64EnInstancia(instance, m.key?.remoteJid ?? '', id, !!m.key?.fromMe);
    if (media) b64 = media.base64;
  }
  if (!b64) return '';
  try {
    return (await transcribirAudio(b64, a.mime, { language: 'es', feature: 'MaKo · nota de voz', motivo: 'Transcribir nota de voz (lote)' })).trim();
  } catch (e) { console.error('[mako-doer-in] STT lote:', e instanceof Error ? e.message : String(e)); return ''; }
}

/** El JID del grupo de MaKo que el onboarding creó para ESE workspace ('' si no tiene). */
async function grupoOficialDe(ws: number): Promise<string> {
  return runWithWorkspace(ws, async () => (await getSetting(KEY_GRUPO_JID).catch(() => '')) ?? '');
}

async function procesarDoer(wsData: number, instance: string, data: MsgIn): Promise<ResultadoDoer> {
  const OPS = OWNER_WS; // settings operativos del doer (agencia), keyeados por jid
  try {
    const key = data.key;
    const jid = key?.remoteJid ?? ''; // manejarEntranteDoer ya validó que es un grupo
    const textoDirecto = textoDe(data).trim();
    const audio = audioDe(data);
    const adjunto = adjuntoDe(data); // imagen o PDF
    if (!textoDirecto && !audio && !adjunto) return { engaged: false, skip: 'sin texto ni audio ni adjunto' };

    if (!(await doerActivo(OPS))) return { engaged: false, skip: 'doer desactivado' };

    const msgId = key?.id ?? '';
    // fromMe: en la línea de voz (número del dueño) el dueño Y MaKo escriben fromMe.
    // Si el id es de una respuesta nuestra, es un eco → saltar (anti-loop).
    if (key?.fromMe) {
      const enviados = await idsEnviados(OPS, jid);
      if (msgId && enviados.includes(msgId)) return { engaged: false, skip: 'eco de mi propia respuesta' };
    }
    // Dedup de re-entregas.
    if (msgId) {
      const last = await runWithWorkspace(OPS, () => getSetting(KEY_LAST(jid)));
      if (last === msgId) return { engaged: false, skip: 'ya tratado' };
    }

    // ¿Enganchamos? (antes de gastar STT / IA). En 'libre' siempre; en 'ventana' si
    // lo nombran, es nota de voz, hay ventana abierta o hay una acción pendiente.
    const modo = await modoDoer(OPS, jid);
    const esMedia = !!audio || !!adjunto; // nota de voz / imagen / PDF = deliberado
    const vigentes = await pendientesVigentes(wsData, jid);
    const abierta = modo === 'ventana' ? await ventanaVigente(OPS, jid) : false;
    const enganchaTexto = modo === 'libre' || nombraAMaKo(textoDirecto) || abierta || vigentes.length > 0;
    if (!esMedia && !enganchaTexto) return { engaged: false, skip: 'no lo nombran / sin ventana / sin pendientes' };

    // Marcar tratado + renovar la ventana (sliding) ANTES de responder.
    if (msgId) await runWithWorkspace(OPS, () => setSetting(KEY_LAST(jid), msgId));
    if (modo === 'ventana') await abrirVentana(OPS, jid);

    // Feedback inmediato: "escribiendo…" mientras razona (best-effort).
    void enviarPresencia(instance, jid, 'composing', 12000);

    // ACUSE INSTANTÁNEO (feedback jul-19): la primera respuesta tiene que ser CASI
    // inmediata. Antes salía DESPUÉS de armar el system/contexto (buildSystemPrompt
    // tarda) y CON el "escribiendo…" (delay anti-ban de ~3s) → se sentía colgado.
    // Ahora lo mandamos ACÁ, lo primero, y con delay 0 (sin simular tipeo). Solo para
    // texto (audio/adjunto se resuelven aparte) y si NO hay una charla pendiente.
    // (El acuse de texto ya salió en `bufferearYResponder`, ANTES de la ventana de
    // silencio. Acá llegaba 8 segundos tarde, que es justo lo que el dueño reportó.)

    // Resolver el texto: si vino como NOTA DE VOZ, transcribir (pidiendo el base64 a
    // la instancia si el webhook no lo adjuntó inline).
    let texto = textoDirecto;
    if (!texto && audio) {
      let b64 = audio.base64;
      if (!b64 && msgId) {
        const m = await fetchMediaBase64EnInstancia(instance, jid, msgId, !!key?.fromMe);
        if (m) { b64 = m.base64; audio.mime = m.mimetype || audio.mime; }
      }
      // UNA VEZ QUE ACUSASTE, CERRÁS SIEMPRE. Acá se acaba de decir «te escucho» y este
      // return se iba mudo con un console.error: el dueño se queda esperando una
      // respuesta que no va a llegar nunca, que es peor que no haber acusado.
      if (!b64) {
        console.error('[mako-doer-in] audio sin base64');
        void enviarAGrupoJid(jid, 'Me llegó tu audio pero WhatsApp no me deja bajarlo. ¿Me lo reenvías?', 0);
        return { engaged: false, skip: 'audio sin base64' };
      }
      // Si NINGUNA de las IA pudo escucharlo (Gemini→Groq→OpenAI, todas caídas o sin
      // cuota), MaKo lo dice. Antes se descartaba en silencio: mandabas el audio y no
      // pasaba nada, indistinguible de que te estuviera ignorando.
      try { texto = (await transcribirAudio(b64, audio.mime, { language: 'es', feature: 'MaKo · nota de voz', motivo: 'Transcribir nota de voz del grupo' })).trim(); }
      catch (e) {
        const detalle = e instanceof Error ? e.message : String(e);
        console.error('[mako-doer-in] STT:', detalle);
        // ⚠️ ACÁ MaKo DECÍA «se me cayó la transcripción» — se comía una culpa que
        // muy seguido no era suya: el cliente tenía UNA sola key y estaba agotada.
        // Un mensaje que se echa la culpa además NO DICE QUÉ HACER, y la solución
        // estaba a dos clics. Ver lib/fallo-ia-texto.ts.
        // Las cuentas se cuentan UNA vez: el texto también las necesita, y con dos
        // llamadas el mensaje podía contradecir a la causa que lo eligió.
        const nKeysAudio = await contarKeysIA().catch(() => 1);
        // ⚠️ El texto se elige con los errores de SUS keys (07/10/2026). Desde que el audio tiene
        // red de plataforma, el error trae también los de la agencia, y con esos la causa la
        // fabricarían nuestras keys (la regla de lib/fallo-ia-texto.ts).
        const delNegocio = e instanceof SttSinEscucha ? e.errores : [detalle];
        const aviso = `Me llegó tu audio pero no lo pude escuchar.\n\n${textoFalloIA(
          causaDelFallo(delNegocio, nKeysAudio),
          linkKeysIA(APP_URL),
          'escuchar tu audio',
          nKeysAudio,
        )}`;
        const env = await enviarAGrupoJid(jid, aviso);
        if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
        return { engaged: true, reply: aviso };
      }
      if (!texto) {
        const aviso = 'Escuché tu audio pero no le entendí nada — ¿lo repites un poco más cerca del micrófono, o me lo escribes?';
        const env = await enviarAGrupoJid(jid, aviso);
        if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
        return { engaged: true, reply: aviso };
      }
    }

    // Adjunto. Imagen y PDF van NATIVOS a Claude; cualquier otro archivo se LEE con el
    // mismo lector del importador y su contenido entra como texto, igual que la
    // transcripción de una nota de voz.
    let mediaBlocks: Array<{ type: string } & Record<string, unknown>> | null = null;
    if (!audio && adjunto) {
      if (!adjunto.soportado) {
        // El aviso enumera lo que SÍ se puede, sacado de la misma lista que usa el
        // lector: si el lector aprende un formato, este mensaje se entera solo.
        const aviso = noPuedoAbrir(adjunto.nombre);
        const env = await enviarAGrupoJid(jid, aviso);
        if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
        return { engaged: true, reply: aviso };
      }
      // El archivo de texto se resuelve PRIMERO: `textoDeArchivo` se trae los bytes él
      // solo, así que bajarlos acá también sería pedirle el mismo adjunto dos veces a
      // Evolution. La descarga de abajo es solo para lo que va nativo.
      if (adjunto.tipo === 'texto') {
        const leido = await textoDeArchivo(instance, data);
        if (!leido || !leido.texto) {
          const aviso = leido?.error || `Me llegó «${adjunto.nombre}» pero no lo pude abrir.`;
          const env = await enviarAGrupoJid(jid, aviso);
          if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
          return { engaged: true, reply: aviso };
        }
        texto = leido.texto;
      } else {
        let b64 = adjunto.base64;
        if (!b64 && msgId) {
          const m = await fetchMediaBase64EnInstancia(instance, jid, msgId, !!key?.fromMe);
          if (m) { b64 = m.base64; }
        }
        if (!b64) {
          console.error('[mako-doer-in] adjunto sin base64');
          void enviarAGrupoJid(jid, 'Me llegó tu archivo pero WhatsApp no me deja bajarlo. ¿Me lo reenvías?', 0);
          return { engaged: false, skip: 'adjunto sin base64' };
        }
        const source = { type: 'base64', media_type: adjunto.tipo === 'image' ? adjunto.mime : 'application/pdf', data: b64 };
        const prompt = textoDirecto || adjunto.caption || (adjunto.tipo === 'image' ? 'Mira esta imagen y dime qué ves y qué hago.' : 'Lee este PDF y dime lo importante.');
        mediaBlocks = [{ type: adjunto.tipo, source }, { type: 'text', text: prompt }];
        // Para la memoria guardamos un placeholder de texto.
        texto = `(envió ${adjunto.tipo === 'image' ? 'una imagen' : 'un PDF'}${adjunto.caption ? `: ${adjunto.caption}` : ''})${textoDirecto ? ` — ${textoDirecto}` : ''}`;
      }
    }

    // Historial (memoria) + system — TODO scopeado al workspace del grupo (wsData).
    // 12 turnos (antes 24): la memoria útil rara vez pasa de ahí y el historial es INPUT
    // en cada llamada (costo). Feedback jul-19.
    const historial = await historialGrupo(wsData, jid, 12);
    // Router PRIMERO (elige el modelo por turno) para decidir cuánto contexto mandar:
    // razonamiento/copy/media (Opus) → contexto completo; el resto (cargar tareas, leer
    // un dato, confirmar, charla) → LEAN (las tools traen el dato). Recorta el INPUT, que
    // es el grueso del gasto del doer (feedback jul-19).
    const rutaBase = rutearDoer(texto, { hayMedia: !!mediaBlocks, hayPendientes: vigentes.length > 0 });
    // DOS PREGUNTAS DISTINTAS, dos módulos. `rutearDoer` contesta CUÁNTO gastar
    // (qué modelo, qué esfuerzo). `clasificarIntencion` contesta QUÉ HACER, y es
    // la que manda sobre las tools, sobre si la tool es obligatoria y sobre qué
    // se valida al salir. Confundirlas es lo que hizo que «Investigar
    // competencia: <links>» devolviera un ensayo en vez de un borrador.
    // ¿El código le acaba de mostrar a la persona opciones de su agenda? Entonces su
    // respuesta corta («la de las 16») sigue ESE pedido y necesita las herramientas de
    // agenda: el modelo no tiene la lista (lib/agenda-sin-ia.ts). Lo deja `runTool`.
    const claveAgenda = `mako.doer.agenda.${jid}`;
    const agendaAbierta = agendaVigente(await getSetting(claveAgenda).catch(() => null), Date.now());
    // ¿MaKo le acaba de preguntar algo? Es lo que convierte un «sí» corto en el pedido de
    // hacer lo que ofreció (lib/mako-intencion.ts, regla 3-ter). Se mira sólo el final del
    // historial: un ofrecimiento de hace diez mensajes no lo contesta un «sí» de ahora.
    const ultimoDeMako = historial.slice(-2).reverse().find((r) => r.role === 'assistant')?.content ?? null;
    const intencion = clasificarIntencion(texto, {
      hayMedia: !!mediaBlocks,
      hayPendientes: vigentes.length > 0,
      // «no, mejor a las 13» corrige una propuesta de agenda, no la contesta.
      hayPendienteDeAgenda: vigentes.some((p) => (ACCIONES_AGENDA as readonly string[]).includes(p.tipo)),
      hayContacto: contactosDelMensaje(data.message).length > 0,
      hayAgendaAbierta: !!agendaAbierta,
      makoPregunto: makoPreguntoAlgo(typeof ultimoDeMako === 'string' ? ultimoDeMako : null),
    });
    // La intención viaja en el `motivo` para que quede en el Saldo de IA: sin
    // eso, un turno mal clasificado es invisible hasta que el dueño lo reclama.
    const ruta = { ...rutaBase, motivo: `${rutaBase.motivo} → ${intencion.intencion}` };
    console.log(`[doer] ws=${wsData} intencion=${intencion.intencion}${intencion.dudosa ? ' (dudosa)' : ''} — ${intencion.porque}`);
    // OJO (jul-19): probamos LEAN para el tier sonnet pero Sonnet perdía fiabilidad en el
    // flujo proponer→confirmar (describía "confirmá con sí" SIN llamar la tool → el "sí"
    // no creaba nada). Volvemos al contexto completo: la baja de costo real la dan el
    // router (tareas→Sonnet, no Opus), el subset de tools y el historial de 12. El lean
    // queda disponible en buildSystemPrompt para cuando revisemos ese flujo.
    const base = await runWithWorkspace(wsData, () => buildSystemPrompt({ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: texto }));
    const ctxPend = vigentes.length
      ? `\n\nACCIONES PENDIENTES DE CONFIRMACIÓN EN ESTE GRUPO (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nSi el dueño está confirmando, usa confirmar_accion con el id que corresponda.`
      : '';
    // CUÁNTAS COSAS PIDIÓ, contadas por CÓDIGO. El preámbulo explica muy bien cómo
    // agrupar tareas en PROYECTOS por tema, y no dice una palabra sobre cuántas TAREAS
    // salen de un mensaje — así que seis puntos numerados terminaron en UNA sola. Y no
    // fue el techo de tokens: gastó 933 de 2500. Resumió. Contar no se le pide a un
    // modelo, se le pasa hecho. Ver lib/puntos-mensaje.ts.
    const ctxPuntos = avisoDePuntos(texto);

    // Tools por ruta (feedback jul-19, costo): 20 tools con schema pesan varios miles de
    // tokens de INPUT en CADA llamada. Los turnos claros (cargar tareas, confirmar) usan
    // un subset chico → mucho más barato en Claude (y entran mejor en Groq). Los turnos
    // abiertos (dato/acción/razonamiento) mandan todas, para no quedarse sin una tool.
    // LAS DE SIEMPRE + LAS DEL REGISTRO DE LAS ÁREAS QUE EL MENSAJE NOMBRA. Las 26 de
    // siempre siguen corriendo por sus cuerpos de siempre (mismo texto, misma salida,
    // mismo post-proceso del link). El registro (lib/api-mako) suma lecturas y acciones
    // de cada tab, SOLO de las áreas que nombra el mensaje y con un presupuesto de
    // caracteres: todas juntas pasan el techo de Groq y encarecen cada turno. Y solo
    // cuando el contrato de la intención deja todas las tools (`tools: null`): capturar,
    // confirmar y charlar no ganan nada.
    /**
     * LO QUE EL CÓDIGO LE MUESTRA A LA PERSONA SIN PASAR POR EL MODELO.
     *
     * La agenda de Google no pasa por ninguna IA (lib/agenda-sin-ia.ts, decisión de
     * Martín del 07/10/2026): una herramienta que la lee le deja el detalle acá
     * (`ctx.aPersona`) y al modelo le devuelve sólo un estado. Se agrega al final de la
     * respuesta, DESPUÉS de los reemplazos y del validador, y NO se guarda en el
     * historial del grupo: el historial vuelve al modelo en el turno siguiente.
     *
     * Sin repetidos: si el turno rota de proveedor, la herramienta vuelve a correr.
     */
    const paraLaPersona: string[] = [];
    const ctxApi: CtxApi = {
      ws: wsData, canal: 'whatsapp', canalKey: jid, alcance: 'ejecutar', rol: 'admin', turnStart: Date.now(), mensajeUsuario: texto,
      aPersona: (t) => {
        const x = paraWhatsApp(t);
        if (x && !paraLaPersona.includes(x)) paraLaPersona.push(x);
      },
    };
    const toolsDeSiempre = [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS];
    // Las herramientas del turno salen de UNA función pura (lib/doer-herramientas.ts), la
    // misma que usa tests/agenda-whatsapp.test.ts: el test armaba el turno a mano, sin el
    // clasificador, y daba verde mientras el turno real llegaba sin la herramienta.
    //
    // ¿Tiene Calendly? Sin él, sus herramientas y su receta («buscá el lead, pedile el
    // email») no viajan: le ganaban a la agenda de Google con un evento sin lead. Si la
    // lectura falla, se deja todo como estaba: «no pude leer» no es «no tiene».
    const sinCalendly = intencion.intencion === 'actuar'
      ? (await credWs('CALENDLY_API_TOKEN', wsData).catch(() => 'no se pudo leer')) == null
      : false;
    // El «sí» a un ofrecimiento elige las herramientas por lo que se ofreció y por lo último
    // que pidió la persona: «sí, dale» no nombra nada.
    const ultimoPedido = historial.slice().reverse().find((r) => r.role === 'user')?.content;
    const contextoDelSi = intencion.sigueOfrecimiento
      ? [typeof ultimoPedido === 'string' ? ultimoPedido : '', typeof ultimoDeMako === 'string' ? ultimoDeMako : ''].filter(Boolean).join('\n')
      : null;
    const turno = herramientasDelTurno({
      veredicto: intencion, texto, contextoDelSi, agendaAbierta: !!agendaAbierta, deSiempre: toolsDeSiempre,
      vista: await vistaDe(ctxApi), hayPendientes: vigentes.length > 0, resumenesPendientes: vigentes.map((p) => p.resumen), sinCalendly,
    });
    const { tools, ofrece } = turno;
    if (turno.delRegistro.length) console.log(`[doer] ws=${wsData} +${turno.delRegistro.length} del registro (${turno.areas.join(', ')})${sinCalendly ? ' · sin Calendly' : ''}`);

    /**
     * ⚠️ EL SYSTEM SE ARMA DESPUÉS DE LAS TOOLS, PORQUE DEPENDE DE ELLAS.
     *
     * Estaba veinticinco líneas más arriba —antes de que se supiera cuántas tools tiene
     * el turno— así que un turno con la lista VACÍA mandaba igual el protocolo entero.
     * Ver `DOER_WA_TOOLS`: eso es lo que rompió el turno del ws13 el 01/10.
     *
     * Y el nombre de cada tool que SÍ viaja se escribe desde el array, no a mano: el
     * texto enumeraba diez lecturas fijas, así que recortar la lista por intención
     * (`toolsParaIntencion`) dejaba el prompt prometiendo lo que la API no recibía.
     */
    const permitidasDelTurno = new Set(tools.map((t) => t.name));
    /**
     * ⚠️ Y SIN HERRAMIENTAS VA LA PROHIBICIÓN DE INVENTAR, QUE VIVÍA ADENTRO DEL BLOQUE
     * QUE SE SACA.
     *
     * «nunca inventes nombres, números ni fechas» era una frase del protocolo de tools,
     * así que al no mandarlo se iba con él. Medido el 02/10/2026 pegándole a Groq con el
     * system ya partido: contestó en 548 ms **«hemos tenido 6 reuniones: 3 internas
     * (planificación, revisión de KPIs, brainstorming), 2 con cliente…»** — seis reuniones
     * que no existen, con su desglose. Eso es PEOR que el cartel que vino a reemplazar: un
     * número inventado no se lee como un error.
     *
     * El camino barato de acá al lado ya lo sabía y lo dice en su propio system
     * (`cheapSys`): era la tercera escritura de la misma regla y la única que faltaba.
     */
    const bloqueTools = tools.length
      ? `\n\n${DOER_WA_TOOLS}${recetasDelTurno(permitidasDelTurno, ofrece)}${bloqueAgendaGoogle(tools.map((t) => t.name))}\n\nLAS QUE TIENES EN ESTE TURNO (y NINGUNA otra): ${tools.map((t) => t.name).join(', ')}.`
      : '\n\nEN ESTE TURNO NO TIENES HERRAMIENTAS: no puedes mirar el CRM, el plan ni las campañas. ⛔ NO inventes números, nombres ni fechas, y no los deduzcas de la conversación. Si te piden un dato del negocio, dilo en una línea («eso lo miro y te lo paso») y nada más.';
    // ⚠️ HOY, EN LA ZONA DEL NEGOCIO. Sin esto el modelo no sabe qué día es, y «agendá una
    // visita el jueves» le pedía ADIVINAR la fecha: una fecha adivinada es una invitación
    // real para el día equivocado (07/10/2026, al sumar agendar por WhatsApp). El resumen
    // que confirma el dueño la ataja —dice el día de la semana—, pero esa red no es para
    // esto. Sólo con herramientas: sin ellas no hay nada que agendar, y el bloque de arriba
    // ya prohíbe inventar fechas.
    const tzHoy = tools.length ? await tzDeWorkspace(wsData).catch(() => TZ_DEFAULT) : null;
    const ctxHoy = tzHoy
      ? `\n\nHOY ES ${hoyLegible(tzHoy)} (zona ${tzHoy}). Para «mañana», «el jueves» o «la semana que viene», calcula la fecha desde aquí; las horas que te digan son de esta zona.`
      : '';
    // El pedido de agenda en curso, sólo si el turno trae la herramienta que lo sigue (un
    // prompt que nombra algo que no viajó es una trampa, ver DOER_WA_TOOLS).
    const ctxAgenda = agendaAbierta && tools.some((t) => herramientasQueSiguen(agendaAbierta).includes(t.name)) ? contextoAgendaAbierta(agendaAbierta) : '';
    const system = `${base}\n\n${DOER_WA_VOZ}${bloqueTools}${ctxHoy}\n\n${LARGO_WHATSAPP}\n\n${DEEP_LINKS}${ctxPend}${ctxAgenda}${ctxPuntos ? `\n\n${ctxPuntos}` : ''}`;
    if (!tools.length) console.log(`[doer] ws=${wsData} turno SIN herramientas (${intencion.intencion}) → system de ${system.length} chars, sin el protocolo de tools`);
    // turnStart bloquea el auto-confirm en el mismo turno; el texto del mensaje va para
    // que las acciones puedan negarse a inventar tareas cuando lo único que dijo el
    // dueño es "sí, dale" (ver pareceConfirmacion en mako-doer-acciones).
    const runnerAcciones = crearRunnerAcciones(wsData, jid, Date.now(), texto);
    // EL LINK DEL BORRADOR NO LO ESCRIBE EL MODELO.
    //
    // La tool devuelve el link con el id REAL; acá se lo guarda para corregir la
    // respuesta antes de mandarla. El id son 17 caracteres al azar y pedirle a un LLM
    // que los copie bien falló en prod de las dos formas: un link que no existía, y
    // —peor— uno que resolvía a un borrador real pero equivocado.
    // Ver lib/link-borrador.ts.
    let linkBorrador: string | null = null;

    /**
     * EL MENSAJE NO SE TIRA: si era una carga al plan y la IA no pudo, se guarda CRUDO.
     *
     * ⚠️ VIVE ACÁ, SUELTO, PORQUE LA IA FALLA DE DOS FORMAS Y SON CAMINOS DISTINTOS. Al
     * escribir esto la primera vez sólo cubrí una —el loop que descarta a todos los
     * proveedores con `continue` y sale sin respuesta— y un refutador encontró la otra
     * el mismo día: cuando las keys están SIN CUOTA, el loop TIRA (`throw err`), lo
     * agarra el catch de abajo y ese catch SIEMPRE asigna `respuesta`. Con la respuesta
     * ya puesta, la guarda del final no entra y el mensaje se perdía igual.
     *
     * Y la que faltaba era la que importa: «si se queda sin créditos no puede cargar una
     * tarea que está copiando de una libreta» es textualmente el motivo de la tarea #769.
     *
     * ⚠️ Devuelve el link o null y NO tira nunca: esto corre en el camino de error, y un
     * fallo acá dejaría al dueño sin el aviso que ya teníamos.
     */
    const guardarCrudo = async (): Promise<string | null> => {
      // Con un borrador ya creado sería un duplicado silencioso («nunca duplicar»).
      if (linkBorrador) return linkBorrador;
      const crudo = texto.replace(/\s+/g, ' ').trim();
      if (!crudo) return null;
      try {
        // Import dinámico, como el resto de lo pesado de este archivo: `plan-propuesta`
        // arrastra el saneo entero y este camino corre una vez cada muerte de obispo.
        const { crearPropuesta } = await import('@/lib/plan-propuesta');
        const id = await crearPropuesta({
          ws: wsData,
          origen: 'mako',
          resumen: 'MaKo no pudo procesarlo — quedó tal cual lo dijiste',
          tareas: [{
            // El título es el arranque, cortado en palabra: sirve para reconocerlo en la
            // lista. El texto ENTERO va al detalle, que es lo que no se puede perder.
            titulo: crudo.length > 90 ? `${crudo.slice(0, 90).replace(/\s+\S*$/, '')}…` : crudo,
            detalle: crudo,
          }],
        });
        // Este link sale por WhatsApp y abre una pantalla de inquilino, así que lleva su
        // `?ws=`. El guard de los links no lo veía porque exime este archivo ENTERO —el
        // prompt de abajo describe la FORMA de una URL y no es un link que sale—, y una
        // exención por archivo tapa también las líneas que sí mandan.
        linkBorrador = linkApp(`/plan/revisar/${id}`, wsData);
        console.error(`[mako-doer-in] ws=${wsData} guardado CRUDO en ${id}: la IA no pudo y el mensaje no se tira`);
        return linkBorrador;
      } catch (eC) {
        console.error('[mako-doer-in] no pude ni guardarlo crudo:', eC instanceof Error ? eC.message : String(eC));
        return null;
      }
    };
    // El texto del tutorial en video, cuando la tool corrió. Lo manda el CÓDIGO
    // por la misma razón que el mensaje del borrador: en la primera prueba el
    // modelo llamó bien a `buscar_tutorial` y después escribió «ahí tenés el video
    // paso a paso» SIN EL LINK — se comió los 11 caracteres del id de YouTube.
    let textoTutorialSalida: string | null = null;
    // Los rangos que pidieron las tools de NÚMEROS. Si cubren un informe ya escrito
    // (lib/informe-congelado.ts), el link lo agrega el código al final (08-T13).
    const rangosPedidos: Array<{ desde: string | null; hasta: string | null }> = [];
    // Lo mismo que `linkBorrador` pero para el alta de un lead: el mensaje lo
    // escribe el CÓDIGO. Ver mensajeLeadPropuesto en lib/respuesta-doer.ts.
    let linkLead: string | null = null;
    let nombreLead = '';
    // Los links de las acciones que se confirman en PANTALLA (/mako/revisar/<id>).
    // Mismo motivo que el borrador: el id es azar y el modelo lo copia mal.
    const linksAccion = new Set<string>();
    let tareasCreadas = 0;
    // Las tres de pendientes van por el REGISTRO aunque vengan en la lista de siempre:
    // la confirmación vieja solo sabe ejecutar los siete tipos de ejecutarAccion, y una
    // pendiente que dejó una acción del registro (otro `tipo`) la cerraría en error. La
    // del registro ejecuta las dos, reclama antes y vuelve a mirar el gating.
    const runRegistro = runnerDelRegistro(ctxApi);
    const PENDIENTES_POR_REGISTRO = new Set(['listar_pendientes', 'confirmar_accion', 'cancelar_accion']);
    const NOMBRES_DE_SIEMPRE = new Set(MAKO_TOOLS.map((t) => t.name));
    /**
     * ⚠️ UNA ACCIÓN NO SE REPITE CUANDO EL TURNO ROTA DE PROVEEDOR.
     *
     * Las corridas de abajo —cada cuenta del cliente, el reintento con la herramienta
     * forzada, la red de plataforma, el salto a Claude— vuelven a correr el turno
     * desde `msgs`, con estas mismas herramientas. Una lectura repetida sólo cuesta; una
     * acción repetida dejaba una segunda pendiente igual, un segundo borrador o un «sí»
     * ejecutado dos veces. Lo que ya hizo una acción en un intento anterior se le devuelve
     * al intento nuevo, que sigue desde ahí (lib/turno-sin-duplicar.ts). Cada corrida
     * empieza con `nuevoIntento()`: sin eso, todo es «el mismo intento» y no se ataja nada.
     */
    const memo = crearMemoDeAcciones((n) => {
      const d = porId(n);
      return d ? d.tipo !== 'lectura' : NOMBRES_ACCION.has(n) && !n.startsWith('listar_');
    });
    const runTool = async (name: string, input: Record<string, unknown>) => {
      const previo = memo.previo(name);
      if (previo) {
        console.warn(`[mako-doer-in] ws=${wsData} ${name}: ya corrió en un intento anterior de este turno; se devuelve lo que dejó`);
        return previo.out as Awaited<ReturnType<typeof runRegistro>>;
      }
      const out = await (PENDIENTES_POR_REGISTRO.has(name) ? runRegistro(name, input)
        : NOMBRES_ACCION.has(name) ? runnerAcciones(name, input)
        : NOMBRES_DE_SIEMPRE.has(name) ? runMakoTool(name, input)
        : runRegistro(name, input));
      memo.anotar(name, out);
      if (name === 'buscar_tutorial' && typeof out === 'string') textoTutorialSalida = out;
      // El pedido de agenda que queda ABIERTO para el próximo mensaje (ver arriba,
      // `agendaAbierta`), o que se cierra porque ya quedó propuesto.
      const sigue = agendaQueSigue(name, input, out, Date.now());
      if (sigue) await setSetting(claveAgenda, JSON.stringify(sigue)).catch(() => {});
      else if (agendaSeCierra(name, out)) await setSetting(claveAgenda, '').catch(() => {});
      if (name === 'metricas_negocio' || name === 'analisis_negocio') {
        rangosPedidos.push({
          desde: typeof input.desde === 'string' ? input.desde : null,
          hasta: typeof input.hasta === 'string' ? input.hasta : null,
        });
      }
      // Solo una ACCIÓN crea un borrador o una propuesta. Una lectura puede devolver un
      // link a /plan/revisar/ (ver el estado de un borrador viejo) y, sin esta guarda,
      // el código pisaba la respuesta con «te armé el borrador» sobre uno que ya existía.
      const esLectura = porId(name)?.tipo === 'lectura';
      if (!esLectura && typeof out === 'string' && out.includes('/mako/revisar/')) {
        try {
          const j = JSON.parse(out) as { url?: unknown };
          if (typeof j.url === 'string' && j.url.includes('/mako/revisar/')) linksAccion.add(j.url);
        } catch { /* no era JSON */ }
      }
      if (!esLectura && typeof out === 'string' && out.includes('/plan/revisar/')) {
        try {
          const j = JSON.parse(out) as { link?: unknown };
          if (typeof j.link === 'string' && j.link.includes('/plan/revisar/')) linkBorrador = j.link;
          // Cuántas entraron de verdad. Del INPUT de la tool, no de lo que el modelo
          // dice después: contar es justamente lo que hace mal.
          const dadas = (input as { tareas?: unknown }).tareas;
          if (Array.isArray(dadas)) tareasCreadas = dadas.length;
        } catch { /* no era JSON: el link se corrige igual si aparece en el texto */ }
      }
      if (!esLectura && typeof out === 'string' && out.includes('/crm/revisar/')) {
        try {
          const j = JSON.parse(out) as { url?: unknown };
          if (typeof j.url === 'string' && j.url.includes('/crm/revisar/')) {
            linkLead = j.url;
            // El nombre sale del INPUT de la tool, no de lo que el modelo escriba
            // después: es el dato que se propuso, no el que recuerda.
            nombreLead = String((input as { nombre?: unknown }).nombre ?? '').trim();
          }
        } catch { /* no era JSON */ }
      }
      return out;
    };
    /** Lo que se le pasa a CADA corrida del turno en vez de `runTool`: abre un intento nuevo
     *  para el memo de las acciones. `tests/turno-sin-duplicar.test.ts` exige que ninguna
     *  corrida reciba `runTool` pelado. */
    const nuevoIntento = () => { memo.nuevoIntento(); return runTool; };

    // Si hay imagen/PDF, el último turno del usuario va con bloques (media + texto);
    // si no, texto plano. La memoria guarda siempre el placeholder de texto.
    const userContent: RichMsg['content'] = mediaBlocks ?? texto;
    // ⚠️ EL HISTORIAL ES CONTEXTO, NO MATERIAL — y hasta acá no había forma de
    // distinguirlos. Los 12 turnos anteriores entraban como mensajes `user`
    // idénticos al de ahora, así que para el modelo TODO era el pedido. Por eso
    // «Investigar competencia: <2 links>» devolvió un análisis del branding de
    // un dashboard mandado 33 h antes y de una idea de contenidos de 25 h antes:
    // no las inventó de la nada, las leyó de la ventana de 48 h y las trató como
    // parte del encargo.
    //
    // La marca va en el ÚLTIMO turno de usuario y no en cada uno del historial:
    // una etiqueta por turno se diluye, y `saneaHistorial` fusiona roles
    // repetidos (la etiqueta quedaría en el medio de un bloque pegado).
    const historialMarcado = saneaHistorial(historial);
    if (historialMarcado.length) {
      historialMarcado.unshift({
        role: 'user',
        content: '[CONTEXTO — los mensajes que siguen hasta el último son la charla PREVIA de este grupo. Sirven para entender de qué se viene hablando. NO son el pedido de ahora y NO se responden: lo único que hay que atender es el ÚLTIMO mensaje.]',
      });
      historialMarcado.push({ role: 'assistant', content: '(entendido: lo de arriba es contexto; atiendo solo el próximo mensaje)' });
    }
    const msgs: RichMsg[] = [...historialMarcado, { role: 'user', content: userContent }];
    // Guardar el turno del usuario ANTES de la IA (así queda aunque falle).
    await guardarTurno(wsData, jid, 'user', texto, msgId);

    // (el acuse instantáneo ya salió arriba; el router ya corrió arriba para el contexto)
    const recorte = texto.slice(0, 80);
    let respuesta = '';
    /**
     * ⚠️ «YA ESTOY DE VUELTA»: EL CARTEL DE FALLO NO ES UN TURNO DE LA CONVERSACIÓN.
     *
     * Lo reportó el dueño el 30/09/2026, en el mensaje siguiente al del fallo: MaKo
     * arrancó con «Ya estoy de vuelta». Nadie escribió esa frase y el modelo no estaba
     * mintiendo — estaba siendo COHERENTE con el historial que le dimos. El turno
     * anterior figuraba como algo que MaKo había dicho («⚠️ Probé tus 4 cuentas de IA y
     * las 4 me rebotaron por límite…»), así que la continuación natural de una ausencia
     * que él mismo había anunciado es anunciar que volvió. Le enseñamos una caída que
     * nunca tuvo y después se la hicimos narrar.
     *
     * Un cartel de «no pude» es un aviso de la PLATAFORMA sobre su propia capacidad: se
     * manda —la persona tiene que leerlo— y no entra al historial. El incidente queda
     * registrado donde se audita (el `console.error` de acá, las filas de
     * `anthropic_usage` y la marca de `anotarRebote429`), que es la regla de la casa:
     * diagnóstico y conversación son dos trabajos y no comparten campo.
     *
     * El camino del AUDIO ya lo hacía bien —manda el aviso y vuelve sin guardar turno—;
     * el del texto era el único que lo guardaba.
     */
    let avisoDeSistema = false;

    if (ruta.tier === 'cheap' && !mediaBlocks) {
      // Charla trivial: respuesta corta con la voz de MaKo, SIN tools ni Opus. Si
      // falla la IA barata, caemos al doer normal (nunca dejamos al dueño sin respuesta).
      try {
        const cheapSys = `${base}\n\nEs un saludo o charla casual por WhatsApp, sin pedido concreto. Responde CORTO (1-2 frases), cálido y en la voz de MaKo. No inventes datos ni números; si te piden algo con datos del negocio, di que lo miras enseguida.`;
        respuesta = (await chatCheap({ system: cheapSys, user: texto, maxTokens: 350, feature: 'mako-doer-in', motivo: `${ruta.motivo} «${recorte}»` })).trim();
      } catch (e) {
        console.warn('[mako-doer-in] cheap falló, uso doer:', e instanceof Error ? e.message : String(e));
      }
    }

    if (!respuesta) {
      // El loop de tool-use corre bajo wsData (procesarDoer ya está dentro de
      // runWithWorkspace(wsData)) → getTenantDb scopea al cliente dueño del grupo.
      // Si el dueño fijó un modelo a mano, ese pin manda; si no, el que eligió el router.
      const pin = await overrideDeFeature('mako-doer-in').catch(() => null);

      // COSTO (feedback jul-19): el grueso del gasto del doer es el INPUT de los turnos
      // de tool-use (tools + historial + resultados). En Groq el input es ~gratis PERO el
      // tier GRATIS de Groq topea en 8k tokens/min, y una lectura del plan (ver_plan) ya
      // pesa más → falla y cae a Claude igual. Por eso queda detrás de un flag: prendé
      // DOER_GROQ_TOOLS=1 SOLO con Groq Dev (de pago, sin ese tope) y el tier 'sonnet'
      // corre ~gratis. Por default = Claude (ya mucho más barato por el router+lean+subset).
      if (process.env.DOER_GROQ_TOOLS === '1' && !pin && ruta.tier === 'sonnet' && !mediaBlocks && (await cheapDisponible())) {
        try {
          const r = await chatCheapTools(system, msgs, tools, nuevoIntento(), { feature: 'mako-doer-in', maxSteps: 6, motivo: `groq ${ruta.motivo} «${recorte}»` });
          // El tier sonnet SIEMPRE implica una tool (dato/acción/plan/confirmación): si
          // Groq contestó sin usar ninguna, no confiamos → lo rehace Claude.
          if (r.toolsUsados > 0 && r.text && !r.text.startsWith('(')) respuesta = r.text.trim();
          else console.warn(`[mako-doer-in] groq no enganchó tool (toolsUsados=${r.toolsUsados}) → Claude`);
        } catch (e) {
          console.warn('[mako-doer-in] groq-tools falló, uso Claude:', e instanceof Error ? e.message : String(e));
        }
      }

      if (!respuesta) {
        // Ruteo DETERMINÍSTICO: el doer ya tiene `pin` (leído arriba con import estático,
        // confiable) → decide ACÁ, sin delegar la detección adentro de chatClaudeTools
        // (cuyo lookup por import dinámico caía en silencio a Opus). Si el dueño pineó una
        // IA barata (Gemini/Groq), corremos el loop de tools DIRECTO ahí; si falla, avisamos
        // el error (NUNCA caemos a Claude ni gastamos Opus). Pin Claude o sin pin → Claude.
        try {
          if (pin && pin.provider !== 'anthropic') {
            // ROTACIÓN PROACTIVA de IA baratas (NUNCA Claude): armamos [pineado + las que
            // soportan tools] y las ORDENAMOS POR CUOTA (las cerca del tope van al final) →
            // probamos primero las que todavía pueden, sin esperar el 429. OpenRouter ":free"
            // queda afuera (tools inconsistentes); OpenAI (barato) es el último de red.
            // DOS señales para forzar la herramienta, no una. El router es una
            // heurística de regex y se equivoca: el 10/8 clasificó «Investigar: … que
            // sea una nueva feature en MaKo» como (dato/acción), no (plan), así que no
            // se forzó nada y el modelo escribió un link de borrador inventado. Con
            // `esCargaDePlan` mirando el texto por su cuenta, hace falta que fallen las
            // dos para quedar sin red.
            // La obligación sale del CONTRATO de la intención. `esCargaDePlan` se
            // mantiene como red: cubre el «anotá esto» explícito aunque el
            // clasificador cambie.
            // ⚠️ UNA ADIVINANZA NO OBLIGA. `dudosa: true` significa, textual, «sin
            // señal clara»; el default de ese caso es `capturar`, que tiene
            // `forzarTool: true` — o sea que a un mensaje que NO se pudo clasificar
            // se le exigía al modelo llamar `proponer_tareas_plan` sí o sí.
            //
            // El 24/8/2026 un cliente escribió «OPA» para probar el canal y eso
            // terminó en «No pude armar el borrador con eso»: se le estaba pidiendo
            // parir una tarea de un saludo de tres letras. Forzar sobre una
            // suposición es más fuerte que el camino seguro, que es justo al revés
            // de como tiene que ser (AGENTS.md: «el fallback es más débil que el
            // camino feliz, nunca más fuerte»).
            //
            // `esCargaDePlan` sigue mandando aparte: mira el TEXTO y cuando dice que
            // sí, no es una adivinanza.
            const forzarTool = (CONTRATO[intencion.intencion].forzarTool && !intencion.dudosa) || esCargaDePlan(texto);
            /**
             * ⚠️ MISTRAL NO ESTÁ ACÁ, Y NO ES POR GUSTO: SU LÍMITE POR MINUTO ES CERO.
             *
             * Medido el 30/09/2026 pegándole a la API con la key del cliente: devuelve 429
             * SIEMPRE, con `limit-req-minute: 0`, y no contesta desde el 29/08. Un
             * proveedor que rebota siempre con un 429 no es un escalón de la cascada: es
             * una línea de «rate limit» GARANTIZADA en la lista de errores, y `causaDelFallo`
             * decide con una regex sobre ese texto. O sea que Mistral le fabricaba el
             * veredicto `sin_cuota` a cualquier falla, fuera o no de cuota.
             *
             * Es la misma jugada que ya se hizo con Cerebras, y la misma regla: antes de
             * dejar un proveedor en la lista, probá la key que YA está en la base.
             */
            /**
             * ⚠️ CEREBRAS TAMPOCO ESTÁ, Y ES EL MISMO MOTIVO QUE MISTRAL: rebota siempre.
             *
             * Medido el 12/08/2026 contra las SIETE keys cargadas en cinco workspaces:
             * las siete devuelven HTTP 402 «Payment required», en los tres modelos de su
             * catálogo. Por eso ya había salido de `PROVS_MULTIKEY` (lib/ia-keys.ts) —o
             * sea que acá era un string muerto— y por eso no vuelve ahora que `provsDe`
             * sí resuelve a los proveedores de una sola key.
             *
             * OpenAI sí queda: es el último escalón, cobra centavos (gpt-4o-mini) y es
             * el que estaba pensado para exactamente este turno. Estuvo inalcanzable
             * desde el 13/08 por el bug de `provsDe`.
             */
            const cands = [pin.provider, 'groq', 'openai'].filter((p, i, a) => a.indexOf(p) === i);
            const orden = await ordenarPorCuota(cands).catch(() => cands);
            let ultErr: unknown = null;
            // ⚠️ TODOS los errores, no solo el último. `ultErr` alcanza para tirar,
            // pero para DECIDIR DE QUIÉN FUE LA CULPA hace falta el conjunto: el
            // último suele ser «falta OPENAI_API_KEY» —el quinto casillero vacío—
            // cuando lo que de verdad pasó fue el 429 del primero. Contar solo el
            // último manda al cliente a cargar la key equivocada.
            const erroresIA: string[] = [];
            /**
             * ⚠️ LOS ERRORES DE NUESTRAS KEYS VAN APARTE, Y NO ELIGEN EL VEREDICTO.
             *
             * La red de plataforma corre con las keys de la AGENCIA. Medido el 01/10/2026
             * en el ws13: de las ocho entradas de la lista con la que se eligió el texto,
             * siete eran de ahí — y los tres únicos 429 también, todos de mistral. El
             * cliente leyó «te quedaste sin cuota» con su propia key contestando HTTP 200.
             *
             * Se separan en el ORIGEN y no por un prefijo dentro del texto: una convención
             * adentro de una cadena libre es justo lo que esta casa ya pagó dos veces.
             */
            const erroresPlataforma: string[] = [];
            /** Instancias DEL CLIENTE que se llegaron a probar, y cuántas contestaron 200. */
            let probadasCliente = 0;
            let contestaronCliente = 0;
            // Lo pone el reintento de arriba: alguna IA escribió un link de borrador, o
            // sea que ENTENDIÓ que este turno cargaba tareas aunque el router no.
            let quisoBorrador = false;
            // ⚠️ EL LOOP RECORRE CUENTAS, NO SÓLO PROVEEDORES. Acá se iteraba `orden` —la
            // lista de proveedores— y se llamaba a `chatCheapTools` sin `clave`, así que
            // resolvía siempre la key BASE de cada uno. Un cliente con dos cuentas de
            // Gemini cargadas tenía la segunda muerta para el WhatsApp: medido en
            // `anthropic_usage` del ws13, `feature=mako-doer-in` tiene 24 llamadas con la
            // cuenta 1 y CERO con la 2 en toda la historia, mientras esa misma key
            // funcionaba por otro camino (8 llamadas OK en `campaign-suggest`, que sí pasa
            // por la cascada). El cliente leía «te quedaste sin cuota» con una cuenta
            // entera sin tocar — y encima se lo leía seguido, porque el peaje del 429 lo
            // pagaba siempre la misma.
            //
            // Se despliega la lista en vez de anidar un segundo `for` a propósito: el
            // cuerpo tiene cinco `continue` con semántica de «probá el siguiente», y con
            // un loop anidado cada uno pasaría a significar otra cosa. Desplegado, un
            // `continue` sigue queriendo decir lo mismo y la única diferencia es que
            // ahora «el siguiente» puede ser otra cuenta del MISMO proveedor.
            //
            // No se reemplaza por `chatCheapToolsCascade`, que ya rota cuenta×proveedor,
            // porque este loop tiene lo suyo: los centinelas, el molde volcado y el
            // «no rotes si ya hay borrador» (nunca duplicar).
            const instancias = (await Promise.all(
              (orden as Array<'groq' | 'openai' | 'gemini' | 'cerebras' | 'mistral'>).map(
                async (prov) => (await provsDe(prov)).map((inst) => ({ prov, inst })),
              ),
            )).flat();
            for (const [nInst, { prov, inst }] of instancias.entries()) {
              probadasCliente++;
              try {
                // ⚠️ LA ÚLTIMA CUENTA DEL CLIENTE ESPERA LA CUOTA DEL MINUTO (hasta 30 s, lo que
                // diga el proveedor). Con otra cuenta esperando, saltar es mejor que esperar; con
                // ninguna, la alternativa a 30 s de espera era «te quedaste sin cuota» sobre una
                // key que se destraba sola. Es el caso de Brigitte (07/10/2026, una sola key):
                // ver lib/ia-rotacion-modelo.ts.
                const esperaCuotaMaxMs = nInst === instancias.length - 1 ? 30_000 : 0;
                const r = await chatCheapTools(system, msgs, tools, nuevoIntento(), { provider: prov, clave: inst.clave, model: prov === pin.provider ? pin.model : undefined, feature: 'mako-doer-in', maxSteps: 8, maxTokens: 2500, motivo: `${rotulo(inst)} ${ruta.motivo} «${recorte}»`, toolChoicePrimerPaso: forzarTool ? 'required' : undefined, esperaCuotaMaxMs });
                /**
                 * ⚠️ ESTA SALIDA ERA MUDA, Y POR ESO EL CLIENTE LEYÓ «TE QUEDASTE SIN CUOTA».
                 *
                 * Medido el 30/09/2026 en el grupo del dueño: Gemini contestó OCHO veces
                 * HTTP 200 en nueve segundos —una fila en `anthropic_usage` ES un 200,
                 * porque `recordUsage` corre después del `throw`— y el modelo agotó los
                 * `maxSteps: 8` sin producir un texto final. Este `continue` descartaba ese
                 * desenlace sin escribir una línea en `erroresIA`, así que río abajo
                 * `causaDelFallo` recibía una lista donde SÓLO quedaban los errores de los
                 * proveedores que ni siquiera importaban —y Mistral devuelve 429 siempre—,
                 * y contestó `sin_cuota`. O sea: MaKo se quedó sin PASOS y le echó la culpa
                 * a las cuentas del cliente, con el proveedor contestando perfecto.
                 *
                 * La regla de la casa estaba escrita a tres líneas de acá («TODOS los
                 * errores, no solo el último») y no cubría las salidas SIN excepción. Un
                 * `continue` que descarta el resultado del único proveedor que contestó es
                 * exactamente eso: evidencia que se tira antes de juzgar.
                 */
                if (!r.text || r.text.startsWith('(')) {
                  contestaronCliente++;
                  erroresIA.push(`${rotulo(inst)}: contestó pero sin texto final (pasos=${r.steps ?? '?'}, fin=${r.stopReason ?? '?'})`);
                  continue; // centinelas internos
                }
                // ⚠️ Acá el único filtro era «que no empiece con paréntesis», y por eso el
                // 9/8 salió el borrador entero por WhatsApp: el modelo redactó el payload
                // en vez de llamar la tool y el código lo aceptó. Ver lib/respuesta-doer.ts.
                // Si volcó el molde, NO es una respuesta: probamos el próximo proveedor.
                // Solo rotamos si todavía no hay borrador — con uno creado, reintentar
                // haría un segundo («nunca duplicar», AGENTS.md).
                //
                // ⚠️ SOLO por `molde-volcado`. La primera versión de esto miraba `.ok` a
                // secas y rotaba también por `sin-borrador` — que es la señal BLANDA, la
                // que tiene casos legítimos («¿qué tengo pendiente?»). Con eso, una
                // respuesta corta y correcta quemaba los cinco proveedores y el usuario
                // recibía el error del último que había reventado («cerebras: HTTP 404»)
                // en vez de la respuesta. Una guarda que descarta lo bueno es peor que
                // no tener guarda.
                let vv = validarRespuestaDoer(r.text, { motivoRuta: ruta.motivo, linkBorrador });
                let texto2 = r.text;

                // EL LINK INVENTADO ES LA PRUEBA DE QUE QUISO CREAR EL BORRADOR.
                //
                // Ninguna de las dos señales de intención vio este turno: el router lo
                // mandó a (dato/acción) y `esCargaDePlan` pide un «anotá» o una lista
                // numerada, y el mensaje era prosa con links («Investigar: … que sea una
                // nueva feature en MaKo»). Así que la tool no se forzó y el modelo
                // contestó en prosa, con un link de borrador que se inventó.
                //
                // Pero ESE link dice algo que ninguna heurística sabía: el modelo creía
                // que estaba armando un borrador. Es la señal de intención más limpia que
                // tenemos —la da él, sobre este mensaje— y llega tarde pero llega. Se
                // reintenta UNA vez con el mismo proveedor y la tool obligatoria.
                // Sin proponer_tareas_plan en el turno (una pregunta: MaKo OFRECE, no arma) forzar
                // una tool sólo obligaría a llamar una lectura cualquiera: un pedido tirado.
                if (!vv.ok && vv.razon === 'link-inventado' && !linkBorrador && permitidasDelTurno.has('proponer_tareas_plan')) {
                  quisoBorrador = true;
                  console.warn(`[mako-doer-in] ${prov} inventó el link → reintento con la tool obligatoria`);
                  const r2 = await chatCheapTools(system, msgs, tools, nuevoIntento(), { provider: prov, model: prov === pin.provider ? pin.model : undefined, feature: 'mako-doer-in', maxSteps: 8, maxTokens: 2500, motivo: `${prov} ${ruta.motivo} «${recorte}» · tool forzada`, toolChoicePrimerPaso: 'required' });
                  if (r2.text && !r2.text.startsWith('(')) {
                    texto2 = r2.text;
                    vv = validarRespuestaDoer(r2.text, { motivoRuta: ruta.motivo, linkBorrador });
                  }
                }

                if (!vv.ok && vv.razon !== 'sin-borrador' && !linkBorrador) {
                  // Mismo caso que arriba: el proveedor CONTESTÓ y lo rechazamos nosotros.
                  // Sin esta línea el veredicto no puede distinguir «nadie me contestó» de
                  // «me contestaron algo que no sirve», y las dos frases son distintas.
                  contestaronCliente++;
                  erroresIA.push(`${rotulo(inst)}: contestó y lo descartamos (${vv.razon}${vv.detalle ? `: ${vv.detalle}` : ''})`);
                  console.error(`[mako-doer-in] ${prov}: ${vv.detalle} → probando el próximo proveedor`);
                  continue;
                }
                respuesta = texto2.trim();
                break;
              } catch (e2) {
                ultErr = e2;
                const m2 = e2 instanceof Error ? e2.message : String(e2);
                erroresIA.push(m2);
                // ⚠️ Y EL 429 SE ANOTA ACÁ TAMBIÉN. `anotarRebote429` tenía UN solo call
                // site, en `chatCheapCascade` — la cascada SIN herramientas, que el doer no
                // usa. Medido: 4.497 filas en la tabla y CERO con la marca de rebote, así
                // que para contestar «¿qué pasó a las 20:30?» hubo que salir a pegarle a la
                // API de Google. Es «cerrar cuatro deja la quinta», otra vez.
                if (/429|rate.?limit|resource.?exhausted|quota/i.test(m2)) {
                  // La firma pide el Nº de CUENTA, no el nombre de la env var: es lo que
                  // `ordenarPorCuota` lee después para no volver a arrancar por la muerta.
                  const modeloPedido = (prov === pin.provider ? pin.model : undefined) ?? inst.chatModel;
                  void anotarRebote429(prov, nroCuenta(inst), modeloPedido, m2).catch(() => {});
                }
                console.warn(`[mako-doer-in] ${prov} falló: ${m2}`);
              }
            }
            // CLAUDE ES EL ÚLTIMO RECURSO, PERO ES UN RECURSO. El comentario de arriba
            // decía «NUNCA caemos a Claude» y para la charla está bien. Pero si la ruta
            // era «cargar al plan» y NINGUNA de las cinco gratis creó el borrador, la
            // alternativa a pagar dos centavos es mandarle prosa al dueño y que el
            // trabajo se pierda — que es exactamente lo que pasó dos veces seguidas.
            // AGENTS.md dice «el ÚLTIMO recurso, no el segundo»: éste es el último.
            // ── LA RED DE PLATAFORMA ────────────────────────────────────────────
            //
            // Si NINGUNA key del cliente contestó, se prueban las GRATIS de la
            // agencia antes de darse por vencido. No es generosidad: un cliente con
            // una sola key cargada no tiene cascada. El ws13 tiene solo
            // `GEMINI_API_KEY`, así que los cinco casilleros de `orden` son en los
            // hechos UN intento — Gemini tuvo un bache de 74 segundos el 25/8 y el
            // cliente recibió un error en su primer día de prueba.
            //
            // Solo se llega acá con `!respuesta`, o sea cuando lo del cliente ya
            // falló. Y solo proveedores GRATIS: pagar por él es otra decisión.
            if (!respuesta) {
              const red = await provsGratisDePlataforma().catch(() => []);
              // ⚠️ CON PRESUPUESTO DE TIEMPO. La agencia tiene 11 keys gratis
              // cargadas y probarlas todas puede ser un minuto largo: del otro lado
              // hay alguien mirando el chat, y a los 40 s ya no importa si la
              // respuesta llega — el cliente se fue. Se prueba lo que entre en el
              // presupuesto y se corta; el que no entró se registra en el log.
              const limite = Date.now() + 25_000;
              let probados = 0;
              // ⚠️ EMPEZAR POR OTRO PROVEEDOR, no por el mismo que acaba de fallar.
              // Si el cliente corre en Gemini y Gemini está saturado, la Gemini de la
              // agencia lo está igual: es el MISMO servicio del otro lado. Probar
              // primero sus tres keys es quemar el presupuesto de tiempo en la única
              // apuesta que ya sabemos perdida — pasó en la verificación de este
              // arreglo, con dos keys de Gemini comiéndose los 25 s enteros.
              const distintoPrimero = [
                ...red.filter((r) => r.provider !== pin.provider),
                ...red.filter((r) => r.provider === pin.provider),
              ];
              for (const r of distintoPrimero) {
                if (Date.now() > limite) {
                  console.error(`[mako-doer-in] red de plataforma cortada por tiempo: ${probados}/${red.length} probados`);
                  break;
                }
                probados++;
                try {
                  const rp = await chatCheapTools(system, msgs, tools, nuevoIntento(), {
                    provider: r.provider, clave: r.clave, wsKey: await wsSuperAdmin(),
                    // 10 s por proveedor: con 25 s de presupuesto entran al menos
                    // dos intentos reales aunque uno quede colgado.
                    timeoutMs: 10_000,
                    feature: 'mako-doer-in', maxSteps: 8, maxTokens: 2500,
                    toolChoicePrimerPaso: forzarTool ? 'required' : undefined,
                    // El motivo lo deja VISIBLE en el Saldo de IA: un respaldo que se
                    // vuelve permanente tiene que poder verse, o el cliente que
                    // necesita cargar su key nunca se entera.
                    motivo: `⚠ red de plataforma (${r.provider}) — el cliente no tiene key que conteste · ${ruta.motivo} «${recorte}»`,
                  });
                  if (rp.text && !rp.text.startsWith('(')) {
                    const vr = validarRespuestaDoer(rp.text, { motivoRuta: ruta.motivo, linkBorrador });
                    if (vr.ok || vr.razon === 'sin-borrador' || linkBorrador) { respuesta = rp.text.trim(); break; }
                    // El tercer agujero de mudez. Medido el mismo día: la red de plataforma
                    // contestó DOS veces con 200 en ese turno y las dos se tiraron acá sin
                    // dejar rastro en ningún lado.
                    erroresPlataforma.push(`plataforma/${r.provider}: contestó y lo descartamos (${vr.razon})`);
                  } else {
                    erroresPlataforma.push(`plataforma/${r.provider}: contestó sin texto final`);
                  }
                } catch (e4) {
                  const m4 = e4 instanceof Error ? e4.message : String(e4);
                  erroresPlataforma.push(`plataforma/${r.provider}: ${m4}`);
                  console.warn(`[mako-doer-in] red de plataforma ${r.provider} falló: ${m4}`);
                }
              }
              if (respuesta) console.error(`[mako-doer-in] ws=${wsData} respondió con la RED DE PLATAFORMA: sus propias keys no contestaron`);
            }

            // ⚠️ ANTES DE ESCALAR, PREGUNTAR SI LA PUERTA ESTÁ ABIERTA.
            //
            // Esta escalada se escribió dando por sentado que Claude estaba
            // disponible, y NO lo está: `mako-doer-in` no figura en
            // `CLAUDE_PERMITIDO` (lib/veto-claude.ts) y el veto vive en el `fetch`,
            // así que la llamada tira SIEMPRE. Medido en `anthropic_usage`: **8
            // vetos entre el 17/8 y el 24/8**, cada uno terminando en un «No pude
            // armar el borrador» para un cliente, y ninguno visible en ningún lado.
            //
            // Dos sistemas correctos que se contradicen, y el único síntoma era un
            // mensaje raro en el WhatsApp de un cliente. `evaluarPermiso` es puro y
            // síncrono: preguntar cuesta nada y convierte una excepción garantizada
            // en un estado conocido — y en un log que dice QUÉ decidir.
            const permiso = evaluarPermiso({ feature: 'mako-doer-in', model: 'claude-sonnet-5' });
            if ((esRutaPlan(ruta.motivo) || esCargaDePlan(texto) || quisoBorrador) && !linkBorrador) {
              if (!permiso.ok) {
                console.error(`[mako-doer-in] ninguna IA barata armó el borrador (${orden.join(', ')}) y NO se puede escalar: ${permiso.razon}`);
              } else {
                console.error(`[mako-doer-in] ninguna IA barata armó el borrador (${orden.join(', ')}) → escalando a Claude`);
                try {
                  const { text } = await chatClaudeTools(system, msgs, tools, nuevoIntento(), {
                    feature: 'mako-doer-in', maxSteps: 8, model: 'claude-sonnet-5',
                    toolChoice: 'any', motivo: `⚠ escalado a Claude: las gratis no armaron el borrador · ${ruta.motivo} «${recorte}»`,
                  });
                  if (text?.trim()) respuesta = text.trim();
                } catch (e3) { console.error('[mako-doer-in] Claude tampoco pudo:', e3 instanceof Error ? e3.message : String(e3)); }
              }
            }
            if (!respuesta) {
              const err = (ultErr instanceof Error ? ultErr : new Error('todas las IA baratas fallaron')) as Error & {
                erroresIA?: string[]; erroresPlataforma?: string[]; probadas?: number; contestaron?: number;
              };
              err.erroresIA = erroresIA;
              err.erroresPlataforma = erroresPlataforma;
              err.probadas = probadasCliente;
              err.contestaron = contestaronCliente;
              throw err;
            }
          } else {
            const { text } = await chatClaudeTools(system, msgs, tools, nuevoIntento(), {
              feature: 'mako-doer-in', maxSteps: 8,
              model: pin ? pin.model : ruta.model,
              effort: ruta.effort,
              motivo: `${ruta.motivo} «${recorte}»`,
            });
            respuesta = (text ?? '').trim();
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[mako-doer-in] IA falló:', msg);
          // El error TÉCNICO va al log, no al WhatsApp del dueño. Le llegó literal
          // «falló la IA (chatCheapTools(cerebras): HTTP 404)» y eso no le dice nada:
          // ni qué pasó con lo que escribió, ni qué hacer. Peor, el proveedor que
          // aparece es el ÚLTIMO que reventó, que puede no tener nada que ver con la
          // causa — los anteriores se descartaron por otra razón y su error quedó
          // pisado. Afuera va lo único que le sirve: si su trabajo se guardó o no.
          //
          // ⚠️ Y el texto depende de QUÉ era el turno. Este catch atrapa cualquier
          // caída del modelo, y contestar «no pude armar el borrador» a quien
          // saludó o preguntó por su oferta manda a buscar el problema al lugar
          // equivocado. Ver `avisoNoPude` en lib/respuesta-doer.ts.
          // ⚠️ DE QUIÉN FUE LA CULPA. Pedido del dueño, y es de fondo: «si la culpa
          // es DEL CLIENTE porque no cargó sus key, el mensaje tiene que reflejar
          // eso; no un "he fallado en la transcripción", ahí MaKo queda como el
          // culpable». Y además de injusto era INÚTIL: «reintentá en un momento»
          // sobre una cuota agotada manda a repetir algo que va a fallar igual,
          // mientras la solución está a dos clics y el cliente no se entera.
          //
          // Solo cuando el fallo NO se puede atribuir —o es genuinamente de los
          // proveedores— se cae al aviso genérico de antes.
          const ee = e as Error & { erroresIA?: string[]; erroresPlataforma?: string[]; probadas?: number; contestaron?: number };
          const errsIA = ee?.erroresIA ?? [msg];
          const errsPlat = ee?.erroresPlataforma ?? [];
          const nKeys = await contarKeysIA().catch(() => 1);
          // El veredicto se decide SÓLO con lo del cliente (ver `erroresPlataforma`). Lo
          // nuestro va al log, que es donde se diagnostica.
          const causa = causaDelFallo(errsIA, nKeys, { probadas: ee?.probadas, contestaron: ee?.contestaron });
          const eraDePlan = esCargaDePlan(texto) || (esRutaPlan(ruta.motivo) && !intencion.dudosa);
          respuesta = causa === 'proveedor_caido'
            ? avisoNoPude(eraDePlan)
            : textoFalloIA(causa, linkKeysIA(APP_URL), eraDePlan ? 'armar el borrador' : 'contestar', nKeys);
          avisoDeSistema = true; // no es un turno de MaKo: ver `avisoDeSistema`
          console.error(`[mako-doer-in] ws=${wsData} fallo de IA (${causa}, ${nKeys} keys, ${ee?.probadas ?? '?'} probadas, ${ee?.contestaron ?? 0} contestaron): ${errsIA.join(' · ').slice(0, 400)}`);
          if (errsPlat.length) console.error(`[mako-doer-in] ws=${wsData} y NUESTRA red de plataforma: ${errsPlat.join(' · ').slice(0, 400)}`);
          // ⚠️ Y EL CARTEL QUEDA REGISTRADO. Desde el 30/09 no entra al historial del grupo
          // —bien: de ahí salía el «Ya estoy de vuelta»— y con eso se perdió la única forma
          // de contarlo: «¿cuántas veces salió?» dejó de tener respuesta. Va por el mismo
          // molde que `anotarRebote429`: una fila de US$0 en el mismo gráfico que el dueño
          // mira, con el motivo escrito.
          void recordUsage('cartel-ia', `cartel:${causa}`, {}, `ws${wsData} · ${intencion.intencion} · ${nKeys} keys · ${ee?.probadas ?? 0} probadas · ${ee?.contestaron ?? 0} contestaron · ${errsIA.join(' · ').slice(0, 200)}`, 'mako', 1).catch(() => {});

          // ⚠️ Y EL MENSAJE SE SALVA IGUAL. El aviso de arriba explica POR QUÉ falló —y
          // con una cuota agotada eso es lo accionable—, pero por sí solo manda al dueño
          // a repetir un audio que ya está transcripto. Las dos cosas no compiten: se
          // dice el motivo Y se deja el borrador crudo.
          if (eraDePlan) {
            const link = await guardarCrudo();
            if (link) respuesta = `${respuesta}\n\nNo te lo pierdas: lo dejé tal cual lo dijiste 👇\n${link}`;
          }
        }
      }
    }
    // ── EL MENSAJE DEL BORRADOR LO ESCRIBE EL CÓDIGO ─────────────────────────
    //
    // Si el borrador se creó, la respuesta ES esta frase. No se corrige la del
    // modelo: se REEMPLAZA. Pedido del dueño, y tiene razón: «el modelo de IA jamás
    // debe ser el responsable de mandar ese mensaje… si literalmente SIEMPRE es el
    // mismo y lo único que cambia es la variable del link».
    //
    // Todo lo que había acá antes era compensar ese error de base. Primero se le pedía
    // al modelo que escribiera la frase con el link; después, como copiaba mal los 17
    // caracteres del id, se agregó `corregirLinkBorrador` para arreglárselo; después,
    // como a veces inventaba el link entero sin haber creado nada, una guarda para
    // detectarlo. Tres capas de red debajo de una decisión que no había que tomar:
    // dejarle a un modelo una salida que no tiene ni una variable de libertad.
    //
    // El trabajo del modelo termina cuando llama la tool. Lo que sale por WhatsApp es
    // de `mensajeBorrador`, la misma función que el prompt usa como ejemplo.
    // ⚠️ EL TUTORIAL LO MANDA EL CÓDIGO. Mismo caso que el borrador y misma razón:
    // el link de un video de YouTube son 11 caracteres al azar y el modelo los
    // resume, los reescribe o los pierde. Se antepone lo que el modelo dijo (que
    // suele ser la aclaración útil de «esto es en tu sitio, no en MaKo») y abajo
    // va el video íntegro, tal como lo armó `textoTutorial`.
    if (textoTutorialSalida) {
      const suyo = (respuesta ?? '').trim();
      // Si el modelo ya pegó el link, no se duplica.
      const yaTieneLink = suyo.includes('youtu.be/') || suyo.includes('youtube.com/');
      respuesta = yaTieneLink ? suyo : [suyo, textoTutorialSalida].filter(Boolean).join('\n\n');
    }

    // ⚠️ EL INFORME YA ESCRITO LO OFRECE EL CÓDIGO (08-T13). Mauricio pidió «un reporte de
    // mis resultados de junio, julio y agosto», y ese informe existe (/analisis/trimestre, en
    // dólares). Si una tool de números pidió un rango que lo cubre, el link va al final —una
    // ruta es un dato exacto y no la transporta el modelo— y SOLO en el workspace dueño: los
    // números son de Mauricio, y para cualquier otro cliente esa pantalla es un 404.
    const informe = rangosPedidos.map((r) => informeParaRango(r.desde, r.hasta)).find(Boolean) ?? null;
    if (informe && respuesta.trim() && !respuesta.includes(informe.ruta) && (await esWorkspaceDueno().catch(() => false))) {
      // El link del informe sale por WhatsApp y abre una pantalla de inquilino, así que va
      // con su `?ws=`. Lo encontró el guard de los links al dejar de ser ciego a la forma
      // con la ruta en una VARIABLE, que es justo la que tenía acá.
      respuesta = `${respuesta.trim()}\n\n📊 ${informe.titulo}: ${linkApp(informe.ruta, wsData)}`;
    }

    if (linkBorrador) {
      if (respuesta && respuesta !== mensajeBorrador(linkBorrador)) {
        // No es un error —el modelo no tiene por qué acertar una frase exacta— pero
        // mirar cuánto se desvía dice si el prompt todavía sirve para algo acá.
        console.warn(`[mako-doer-in] respuesta del modelo reemplazada por el mensaje canónico (${respuesta.length} chars)`);
      }
      respuesta = mensajeBorrador(linkBorrador);
    }

    // Y lo mismo con el lead. El caso que lo trajo: la propuesta se creó bien y
    // el modelo la anunció como «Anotado los datos de Enrique Duarte» — pasado,
    // suena a hecho, y la clienta entendió que el contacto ya estaba en el CRM.
    // El estado de un dato no puede depender de cómo le salió la frase al modelo.
    if (linkLead) {
      if (respuesta && respuesta !== mensajeLeadPropuesto(linkLead, nombreLead)) {
        console.warn(`[mako-doer-in] respuesta reemplazada por el mensaje canónico de lead (${respuesta.length} chars)`);
      }
      respuesta = mensajeLeadPropuesto(linkLead, nombreLead);
    }

    // Y el de una acción que se confirma en PANTALLA: si el link real no está TAL CUAL
    // en la respuesta, lo escribe el código. Ver conLinksDeAccion.
    respuesta = conLinksDeAccion(respuesta, [...linksAccion]);

    // LA COMPUERTA. Va acá, pegada al envío, porque es el único punto por el que pasan
    // las DOS ramas —la IA barata y Claude— y las dos tenían el mismo agujero.
    //
    // Nada de esto reemplaza al prompt: el modelo tiene que acertar. Pero cuando no
    // acierta, lo que llega al WhatsApp del dueño no puede ser el payload crudo.
    // ¿Salió más corto que lo que pidió? No se bloquea —el dueño revisa el borrador y
    // el wizard le deja sumar las que falten— pero queda en el log, que es la única
    // forma de saber si el aviso de los puntos está sirviendo.
    const nPuntos = puntosDelMensaje(texto).length;
    if (nPuntos >= 2 && linkBorrador && tareasCreadas > 0 && tareasCreadas < nPuntos) {
      console.error(`[mako-doer-in] el dueño enumeró ${nPuntos} puntos y el borrador trajo ${tareasCreadas} · ${ruta.motivo}`);
    }

    /**
     * ⚠️ NUNCA EN SILENCIO — y era el ÚNICO camino del doer que no contestaba nada.
     *
     * EL CASO, medido en prod el 30/09/2026. El dueño mandó una nota de voz al grupo del
     * super admin para probar. Llegó el «Te escucho 🎧», Whisper la transcribió entera y
     * bien, el turno quedó guardado… y después **nada**: ni borrador, ni respuesta, ni
     * turno de MaKo. El último que había contestado en ese workspace era de tres días
     * antes. Desde afuera se lee como que la app se colgó.
     *
     * POR QUÉ. El loop de proveedores descarta con `continue` —texto vacío, centinela,
     * molde volcado— y si los descarta a TODOS sale del `for` con `respuesta` en ''. Eso
     * no es una excepción, así que el `catch` de abajo (el que arma el aviso de «no
     * pude») nunca corre. El comentario del camino barato dice «nunca dejamos al dueño
     * sin respuesta» y era verdad para ESE camino: el de abajo lo desmentía.
     *
     * LO QUE ESTA GUARDA NO HACE ES PAGAR. Decisión del dueño, textual: «NO, JAMÁS algo
     * pago para el plan» (30/09/2026). Así que cuando la cascada gratis no da, no se cae
     * a Claude: se contesta con la verdad y se salva el trabajo.
     */
    if (!respuesta) {
      const eraDePlan = esCargaDePlan(texto) || (esRutaPlan(ruta.motivo) && !intencion.dudosa);
      console.error(`[mako-doer-in] ws=${wsData} NINGÚN proveedor dejó una respuesta usable · ruta «${ruta.motivo}» · ${texto.length} chars · borrador=${linkBorrador ?? 'no'}`);

      /**
       * Y SI ERA UNA CARGA AL PLAN, EL MENSAJE NO SE PIERDE: se guarda CRUDO.
       *
       * Sin esto, «reintenta en un momento» le pide al dueño que vuelva a grabar el audio
       * —o que se acuerde de lo que dijo—, y lo que dijo ya lo tenemos transcripto y
       * guardado. Una tarea con el texto tal cual es peor que una bien redactada y es
       * INFINITAMENTE mejor que perderla: el borrador se revisa y se edita antes de
       * entrar, que es para lo que existe.
       *
       * ⚠️ Sólo cuando NO hay borrador ya creado: con uno hecho, esto sería un duplicado
       * silencioso — la regla de la casa («nunca duplicar»).
       */
      if (eraDePlan) await guardarCrudo();

      respuesta = linkBorrador
        ? `No te lo pude ordenar con IA, así que lo dejé tal cual lo dijiste. Revísalo y acomódalo aquí 👇\n${linkBorrador}`
        : avisoNoPude(eraDePlan);
      avisoDeSistema = true;
    }

    if (respuesta) {
      const v = validarRespuestaDoer(respuesta, { motivoRuta: ruta.motivo, linkBorrador });
      if (!v.ok && v.razon !== 'sin-borrador') {
        // Llegar acá ya solo es posible SIN borrador: con uno creado, la respuesta se
        // reemplazó arriba por el mensaje canónico. O sea que las dos razones duras que
        // quedan —volcó el molde, o prometió un link que nadie creó— significan lo
        // mismo: el modelo dijo que hizo algo que no hizo. Eso no se manda.
        console.error(`[mako-doer-in] BLOQUEADA (${v.razon}): ${v.detalle} · ruta «${ruta.motivo}» · ${respuesta.length} chars`);
        respuesta = AVISO_NO_PUDE;
        avisoDeSistema = true;
      } else if (!v.ok) {
        // No bloquea —hay turnos de plan que legítimamente no crean nada («¿qué tengo
        // pendiente?»)— pero deja rastro. Antes, el modo de falla grave era el ÚNICO
        // que no logueaba: por eso del 9/8 no quedó una sola línea en Vercel.
        console.error(`[mako-doer-in] ${v.detalle} · ruta «${ruta.motivo}» · ${respuesta.length} chars`);
      }
    }
    if (respuesta || paraLaPersona.length) {
      // Mensajes SEPARADOS (punto 10): MaKo separa con una línea de "---"; mandamos
      // cada parte como un mensaje aparte con una pausa chica (se lee como conversación,
      // no un chorizo). Registramos cada id enviado para el anti-eco.
      const partes = (respuesta ?? '').split(/\n\s*-{3,}\s*\n/).map((p) => p.trim()).filter(Boolean);
      // Lo que escribió el CÓDIGO (la agenda) va al final, cada bloque como su propio
      // mensaje. Va acá y no antes porque los reemplazos de arriba (el borrador, el
      // lead, el cartel) pisan `respuesta`, y el validador no tiene por qué leerlo.
      const enviar = [...partes, ...paraLaPersona];
      const idsEnv: string[] = [];
      for (let i = 0; i < enviar.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 700));
        const env = await enviarAGrupoJid(jid, enviar[i]);
        if (env.ok && env.id) idsEnv.push(env.id);
      }
      await registrarEnviados(OPS, jid, idsEnv); // un solo write para toda la respuesta
      // Lo que SÍ es conversación se guarda; el cartel de «no pude», no (ver arriba).
      // Y lo del código tampoco: el historial vuelve al modelo en el turno siguiente, y
      // la agenda no pasa por ninguno.
      if (avisoDeSistema) console.warn(`[mako-doer-in] ws=${wsData} aviso de plataforma enviado y FUERA del historial (${(respuesta ?? '').length} chars)`);
      else if (partes.length) await guardarTurno(wsData, jid, 'assistant', partes.join('\n\n'), undefined);
    }
    return { engaged: true, reply: [respuesta, ...paraLaPersona].filter(Boolean).join('\n\n') };
  } catch (e) {
    console.error('[mako-doer-in]', e instanceof Error ? e.message : String(e));
    return { engaged: false, skip: e instanceof Error ? e.message : String(e) };
  }
}


/**
 * La red del cron: colas que quedaron sin nadie esperándolas (la invocación que
 * hacía la espera se murió con la instancia). Sin esto, esos mensajes se pierden en
 * silencio — el dueño escribió y MaKo nunca contestó.
 */
export async function flushHuerfanos(): Promise<{ grupos: number; procesados: number }> {
  const pares = await huerfanosGlobal();
  let procesados = 0;
  for (const { ws, jid } of pares) {
    try {
      const r = await runWithWorkspace(ws, async () => {
        const quien = `cron${Date.now().toString(36)}`;
        if (!(await reclamar(jid, quien))) return false;
        try {
          const cola = await pendientes(jid);
          if (!cola.length) return false;
          const textos: string[] = [];
          for (const m of cola) {
            let t = m.texto.trim();
            if (!t && audioDe((m.payload as MsgIn) ?? {})) t = await transcribirDeMensaje('', (m.payload as MsgIn) ?? {});
            if (t) textos.push(t);
          }
          const ultimo = (cola[cola.length - 1].payload as MsgIn) ?? {};
          const instancia = String((ultimo as { instance?: string }).instance ?? '');
          if (textos.length) {
            const sintetico: MsgIn = {
              key: { remoteJid: jid, id: ultimo.key?.id ?? '', fromMe: ultimo.key?.fromMe },
              pushName: ultimo.pushName,
              message: { conversation: unirMensajes(textos.map((t) => ({ texto: t }))) },
            };
            console.log(`[mako-doer-in] cron: destrabando ${cola.length} mensaje(s) de ${jid}`);
            await procesarDoer(ws, instancia, sintetico);
          }
          await marcarProcesados(cola.map((m) => m.id));
          return true;
        } finally { await soltar(jid, quien); }
      });
      if (r) procesados++;
    } catch (e) { console.error('[mako-doer-in] flushHuerfanos:', e instanceof Error ? e.message : String(e)); }
  }
  return { grupos: pares.length, procesados };
}
