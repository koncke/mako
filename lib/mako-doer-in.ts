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
import { corregirLinkBorrador, idDeLinkRevisar } from '@/lib/link-borrador';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import { validarRespuestaDoer, esRutaPlan, mensajeBorrador, EJEMPLO_BORRADOR, AVISO_NO_PUDE } from '@/lib/respuesta-doer';
import { avisoDePuntos, puntosDelMensaje } from '@/lib/puntos-mensaje';
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION, crearRunnerAcciones } from '@/lib/mako-doer-acciones';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { guardarTurno, historialGrupo } from '@/lib/mako-doer-conv';
import { buildSystemPrompt } from '@/lib/mako-context';
import { enviarAGrupoJid, KEY_GRUPO_JID, KEY_GRUPO_SUPERADMIN } from '@/lib/mako-grupo';
import { enviarPresencia, fetchMediaBase64EnInstancia } from '@/lib/evolution';
import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { APP_BASE_URL as APP_URL } from '@/lib/app-url';
import { transcribirAudio, chatCheap, chatCheapTools, cheapDisponible } from '@/lib/ai-cheap';
// El MISMO lector que usa el importador del tablero. Que WhatsApp tenga su propia idea
// de qué formatos existen es cómo un .txt terminó rebotando (ver AGENTS.md, "Una cosa,
// un lugar").
import { archivoATexto } from '@/lib/archivo-a-texto';
import { puedeLeerse, formatosLegibles, porQueNoPuedo } from '@/lib/formatos-archivo';
import { ordenarPorCuota } from '@/lib/ia-cuotas';
import { rutearDoer } from '@/lib/mako-router';
import { overrideDeFeature } from '@/lib/model-registry';
import { encolar, reclamar, soltar, pendientes, esperarSilencio, marcarProcesados, unirMensajes, huerfanosGlobal, VENTANA_MS, VENTANA_AUDIO_MS } from '@/lib/mako-doer-buffer';

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
const DOER_WA_PREAMBLE = `CONTEXTO: estás en un grupo de WhatsApp con el dueño del negocio (y a veces su equipo). Te escriben a vos. Ves el HISTORIAL de la conversación: usalo, no arranques de cero ni pidas datos que ya te dieron antes. Respondé como MaKo: breve, humano, estilo WhatsApp (2-5 líneas, sin volcar JSON ni tecnicismos).

HERRAMIENTAS DE LECTURA: buscar_leads, ficha_lead, historial_whatsapp, reuniones_lead, buscar_conocimiento, estado_experimentos, ver_funnel, listar_secuencias_nutricion, listar_campanas_meta. Usalas para responder con datos reales; nunca inventes nombres, números ni fechas. Si te preguntan por un lead/reunión/campaña, BUSCALO con las tools antes de decir que no lo tenés.

CUANDO TE PIDEN ACCIONES (cambiar la etapa de un lead, activar/pausar una nutrición, renombrar/pausar/ajustar el presupuesto de una campaña de Meta): NO ejecutás directo. Usás la tool 'proponer_*' correspondiente —que deja la acción PENDIENTE— y en tu respuesta explicás en una línea qué vas a hacer y pedís que confirmen con un "sí". Conseguí primero los ids con las tools de lectura.

CUANDO EL DUEÑO CONFIRMA ("sí", "dale", "hacelo", "confirmo") y hay una acción pendiente: llamá 'confirmar_accion' para ejecutarla. Si dice que no, 'cancelar_accion'. Si no estás seguro de a cuál se refiere, usá 'listar_pendientes' y preguntá.

CUANDO TE PASA UNA LISTA DE TAREAS PARA EL PLAN (aunque venga desordenada: "anotá esto", "agregá al plan", varias cosas juntas):
- Ya se mandó un acuse automático ("recibí, lo proceso"): NO vuelvas a saludar ni acusar, andá al grano.
- MENSAJES SEPARADOS: WhatsApp se lee mejor cortito. Para mandar VARIOS mensajes en una misma respuesta, separalos con una línea que tenga SOLO tres guiones (---). Nada de un chorizo largo.
0. EL DETALLE DE CADA TAREA ES LO MÁS IMPORTANTE. El título dice QUÉ; el detalle es lo que hace que la tarea se pueda ejecutar dentro de tres semanas sin volver a leer el WhatsApp — y es lo ÚNICO con lo que el Perro decide a qué proyecto va. Volcá el razonamiento, los ejemplos, los links y los números del dueño, con sus palabras. NUNCA lo resumas a una línea.
1. PRIMERO usá 'ver_plan' para ver los proyectos y las tareas que ya existen. Con eso resolvé SOLO lo DEDUCIBLE, sin preguntar:
   · ASIGNÁ cada tarea al proyecto que YA existe y le corresponde. NO preguntes "a qué proyecto" si es deducible.
   · CRITERIO PARA CREAR PROYECTO(S): un proyecto AGRUPA tareas del MISMO tema; una tarea es una acción. ⚠️ Si la lista mezcla VARIOS temas distintos (ej. funnels, análisis de competencia, finanzas, formatos de video son 4 temas, no 1), NO metas todo en UN SOLO proyecto "cajón de sastre": creá UN PROYECTO POR TEMA y repartí cada tarea en el suyo. Si un ítem encaja en un proyecto que YA existe, mandalo ahí (no crees uno nuevo). Si un ítem es una acción suelta que ningún tema agrupa, dejala como tarea sin proyecto. Para asignar a un proyecto (nuevo o existente), poné su nombre en el campo "proyecto" de cada tarea (el Perro Guardián revisa esa propuesta y decide si abre el proyecto o si la manda a uno que ya existe — vos proponés, no decidís).
   · DEDUP: si una tarea que te piden YA existe (título parecido en ver_plan), NO la dupliques: decílo, mandá su link (el campo "link" que te da ver_plan) y ofrecé enriquecerla en vez de crear otra.
2. ARMÁ EL BORRADOR: llamá 'proponer_tareas_plan' con las tareas (cada una con su "proyecto"). Lo que NO podés deducir pasalo en "preguntas" (se responden de a UNA en la app, no por WhatsApp que se traba). ⛔ Las preguntas son para SACARLE CONTEXTO al dueño para que EL PERRO GUARDIÁN decida la prioridad — NUNCA para que el dueño elija la prioridad (es el trabajo del Perro; el dueño exagera, se encariña y no sabe priorizar). PROHIBIDO preguntar "¿qué prioridad le das?", "¿cuál te urge primero?". Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en PLATA y en cuánto, qué es "listo", si es 1 tarea o varias. CRITERIO: cada pregunta tiene que TENER SENTIDO (no preguntes lo obvio ni algo que se contradice con lo dicho) y ELEGÍ EL MEJOR TIPO por pregunta — "multi" si valen varias respuestas a la vez (sin opción "Ambas/Todas", que tilde varias), "opcion" si es excluyente, "escala" para intensidad 1-5, "comparacion" para enfrentar dos ítems. NADA de preguntas abiertas (siempre con opciones). Una lista cruda casi siempre tiene algo para preguntar.
   · BAJAS (con criterio): si en ver_plan viste tareas que esta lista deja OBSOLETAS o que ya están DUPLICADAS, proponé borrarlas/fusionarlas en el campo "eliminar" (cada una con su "id" EXACTO de ver_plan + un "motivo" corto). Solo lo que de verdad ya no aplica o se funde con otra — NO borres por borrar. Cada baja la confirma el dueño/cliente con un checkbox en la app.
3. La tool te devuelve un LINK a la pantalla de revisión. Mandá UNA sola línea corta + el link, tal cual, y NADA MÁS — ej: "${EJEMPLO_BORRADOR}". ⛔ NO pidas "confirmá con un sí", NO repitas la lista de tareas en el chat, NO tires preguntas sueltas: TODO se resuelve en el link. ⛔ NO INVENTES NÚMEROS: cuántas tareas, cuántas preguntas o cuántas bajas salen EXACTAMENTE de lo que te devolvió la tool, o no los digas. ⛔ NO NOMBRES EL PROYECTO: vos proponés uno y el Perro decide otro; prometer un nombre que después no está en el tablero es la peor forma de romper la confianza. Vale IGUAL para el dueño y para un cliente.`;

// Dónde ver el detalle completo en la app: MaKo da un resumen corto y REDIRIGE con
// un link cuando hay una vista más rica (para eso están las tabs). {id} = id del lead.
const DEEP_LINKS = `LINKS A LA APP: cuando el detalle completo vive en una tab, dá el resumen corto y CERRÁ con un link para verlo (formato: "Mirá el detalle acá → URL"). No inventes rutas; usá estas (base ${APP_URL}):
- Ficha 360 de un lead: ${APP_URL}/crm/{id}
- Análisis de una llamada de ventas: ${APP_URL}/closing?call={recording_id} (el recording_id sale de reuniones_lead → analisis_llamadas). Si no lo tenés, ${APP_URL}/closing.
- WhatsApp con un lead: ${APP_URL}/whatsapp?lead={id}
- Marketing / anuncios: ${APP_URL}/dashboard · Ads Manager: ${APP_URL}/ads-manager
- Experimentos (verdades validadas): ${APP_URL}/experimentos
- Plan / tareas: ${APP_URL}/plan · Nutrición y email: ${APP_URL}/email
- Salud de la cuenta de Meta: ${APP_URL}/integraciones
Ej: "Con Jesús la R1 se ve floja en el cierre. El análisis completo lo tenés acá → ${APP_URL}/closing".`;

export type ResultadoDoer = { engaged: boolean; reply?: string; skip?: string };

/**
 * SEGURIDAD / AISLAMIENTO: ¿de qué workspace son los DATOS que ve el doer en este
 * grupo? Lo decide el GRUPO (quién lo posee), NO la instancia que lo recibió. Si el
 * grupo es el mako.grupo_jid de un CLIENTE → ese cliente (ve SUS datos, jamás los del
 * dueño ni los de otro cliente). Si es el grupo SuperAdmin o uno de prueba del dueño →
 * OWNER_WS. Cualquier otro → null (no contestamos: fail-closed).
 */
async function wsDeGrupoJid(jid: string): Promise<number | null> {
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
// Subset de tools por ruta (costo). Los turnos claros usan pocas; el resto, todas.
function toolsParaRuta<T extends { name: string }>(motivo: string, todas: T[]): T[] {
  const solo = (nombres: string[]) => todas.filter((t) => nombres.includes(t.name));
  if (motivo.includes('(plan)')) return solo(['ver_plan', 'proponer_tareas_plan', 'listar_pendientes']);
  if (motivo.includes('(confirmación)')) return solo(['listar_pendientes', 'confirmar_accion', 'cancelar_accion']);
  return todas; // dato/acción/default/opus → todas (flexibilidad)
}

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
  if (!texto && !audio && !adjunto) return { engaged: false, skip: 'sin texto ni audio ni adjunto' };

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
      const ackTxt = esCargaDePlan(texto) ? 'Dale, anoto eso 👇 dame un segundo.' : 'Recibido 👍 dame un momento y te contesto.';
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
        t = `${t ? `${t}\n` : ''}(en este mensaje mandé ${otro.tipo === 'image' ? 'una imagen' : 'un PDF'}${otro.caption ? `: «${otro.caption}»` : ''}, pero llegó junto a otros mensajes y no la pudiste mirar — pedímela suelta si la necesitás)`;
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
  const cuerpo = cortado ? `${contenido.slice(0, TOPE_ARCHIVO_WA)}\n\n[…corté acá: el archivo sigue, pero no entra entero en un mensaje]` : contenido;
  const pedido = textoDe(m).trim() || (adj.caption && adj.caption !== adj.nombre ? adj.caption : '');
  console.log(`[mako-doer-in] archivo «${adj.nombre}» leído por ${lect.via}: ${contenido.length} chars${cortado ? ' (CORTADO)' : ''}`);
  return {
    texto: [
      pedido || `Te mando «${adj.nombre}». Leelo y decime qué hacemos con esto.`,
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
        void enviarAGrupoJid(jid, 'Me llegó tu audio pero WhatsApp no me deja bajarlo. ¿Me lo reenviás?', 0);
        return { engaged: false, skip: 'audio sin base64' };
      }
      // Si NINGUNA de las IA pudo escucharlo (Gemini→Groq→OpenAI, todas caídas o sin
      // cuota), MaKo lo dice. Antes se descartaba en silencio: mandabas el audio y no
      // pasaba nada, indistinguible de que te estuviera ignorando.
      try { texto = (await transcribirAudio(b64, audio.mime, { language: 'es', feature: 'MaKo · nota de voz', motivo: 'Transcribir nota de voz del grupo' })).trim(); }
      catch (e) {
        console.error('[mako-doer-in] STT:', e instanceof Error ? e.message : String(e));
        const aviso = 'Me llegó tu audio pero no lo pude escuchar (se me cayó la transcripción). ¿Me lo escribís o me mandás otra nota de voz?';
        const env = await enviarAGrupoJid(jid, aviso);
        if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
        return { engaged: true, reply: aviso };
      }
      if (!texto) {
        const aviso = 'Escuché tu audio pero no le entendí nada — ¿lo repetís un poco más cerca del micrófono, o me lo escribís?';
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
          void enviarAGrupoJid(jid, 'Me llegó tu archivo pero WhatsApp no me deja bajarlo. ¿Me lo reenviás?', 0);
          return { engaged: false, skip: 'adjunto sin base64' };
        }
        const source = { type: 'base64', media_type: adjunto.tipo === 'image' ? adjunto.mime : 'application/pdf', data: b64 };
        const prompt = textoDirecto || adjunto.caption || (adjunto.tipo === 'image' ? 'Mirá esta imagen y decime qué ves y qué hago.' : 'Leé este PDF y decime lo importante.');
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
    const ruta = rutearDoer(texto, { hayMedia: !!mediaBlocks, hayPendientes: vigentes.length > 0 });
    // OJO (jul-19): probamos LEAN para el tier sonnet pero Sonnet perdía fiabilidad en el
    // flujo proponer→confirmar (describía "confirmá con sí" SIN llamar la tool → el "sí"
    // no creaba nada). Volvemos al contexto completo: la baja de costo real la dan el
    // router (tareas→Sonnet, no Opus), el subset de tools y el historial de 12. El lean
    // queda disponible en buildSystemPrompt para cuando revisemos ese flujo.
    const base = await runWithWorkspace(wsData, () => buildSystemPrompt({ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: texto }));
    const ctxPend = vigentes.length
      ? `\n\nACCIONES PENDIENTES DE CONFIRMACIÓN EN ESTE GRUPO (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nSi el dueño está confirmando, usá confirmar_accion con el id que corresponda.`
      : '';
    // CUÁNTAS COSAS PIDIÓ, contadas por CÓDIGO. El preámbulo explica muy bien cómo
    // agrupar tareas en PROYECTOS por tema, y no dice una palabra sobre cuántas TAREAS
    // salen de un mensaje — así que seis puntos numerados terminaron en UNA sola. Y no
    // fue el techo de tokens: gastó 933 de 2500. Resumió. Contar no se le pide a un
    // modelo, se le pasa hecho. Ver lib/puntos-mensaje.ts.
    const ctxPuntos = avisoDePuntos(texto);
    const system = `${base}\n\n${DOER_WA_PREAMBLE}\n\n${DEEP_LINKS}${ctxPend}${ctxPuntos ? `\n\n${ctxPuntos}` : ''}`;

    // Tools por ruta (feedback jul-19, costo): 20 tools con schema pesan varios miles de
    // tokens de INPUT en CADA llamada. Los turnos claros (cargar tareas, confirmar) usan
    // un subset chico → mucho más barato en Claude (y entran mejor en Groq). Los turnos
    // abiertos (dato/acción/razonamiento) mandan todas, para no quedarse sin una tool.
    const tools = toolsParaRuta(ruta.motivo, [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS]);
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
    let tareasCreadas = 0;
    const runTool = async (name: string, input: Record<string, unknown>) => {
      const out = await (NOMBRES_ACCION.has(name) ? runnerAcciones(name, input) : runMakoTool(name, input));
      if (typeof out === 'string' && out.includes('/plan/revisar/')) {
        try {
          const j = JSON.parse(out) as { link?: unknown };
          if (typeof j.link === 'string' && j.link.includes('/plan/revisar/')) linkBorrador = j.link;
          // Cuántas entraron de verdad. Del INPUT de la tool, no de lo que el modelo
          // dice después: contar es justamente lo que hace mal.
          const dadas = (input as { tareas?: unknown }).tareas;
          if (Array.isArray(dadas)) tareasCreadas = dadas.length;
        } catch { /* no era JSON: el link se corrige igual si aparece en el texto */ }
      }
      return out;
    };

    // Si hay imagen/PDF, el último turno del usuario va con bloques (media + texto);
    // si no, texto plano. La memoria guarda siempre el placeholder de texto.
    const userContent: RichMsg['content'] = mediaBlocks ?? texto;
    const msgs: RichMsg[] = [...saneaHistorial(historial), { role: 'user', content: userContent }];
    // Guardar el turno del usuario ANTES de la IA (así queda aunque falle).
    await guardarTurno(wsData, jid, 'user', texto, msgId);

    // (el acuse instantáneo ya salió arriba; el router ya corrió arriba para el contexto)
    const recorte = texto.slice(0, 80);
    let respuesta = '';

    if (ruta.tier === 'cheap' && !mediaBlocks) {
      // Charla trivial: respuesta corta con la voz de MaKo, SIN tools ni Opus. Si
      // falla la IA barata, caemos al doer normal (nunca dejamos al dueño sin respuesta).
      try {
        const cheapSys = `${base}\n\nEs un saludo o charla casual por WhatsApp, sin pedido concreto. Respondé CORTO (1-2 frases), cálido y en la voz de MaKo. No inventes datos ni números; si te piden algo con datos del negocio, decí que lo mirás enseguida.`;
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
          const r = await chatCheapTools(system, msgs, tools, runTool, { feature: 'mako-doer-in', maxSteps: 6, motivo: `groq ${ruta.motivo} «${recorte}»` });
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
            const forzarTool = esRutaPlan(ruta.motivo) || esCargaDePlan(texto);
            const cands = [pin.provider, 'groq', 'cerebras', 'mistral', 'openai'].filter((p, i, a) => a.indexOf(p) === i);
            const orden = await ordenarPorCuota(cands).catch(() => cands);
            let ultErr: unknown = null;
            for (const prov of orden as Array<'groq' | 'openai' | 'gemini' | 'cerebras' | 'mistral'>) {
              try {
                const r = await chatCheapTools(system, msgs, tools, runTool, { provider: prov, model: prov === pin.provider ? pin.model : undefined, feature: 'mako-doer-in', maxSteps: 8, maxTokens: 2500, motivo: `${prov} ${ruta.motivo} «${recorte}»`, toolChoicePrimerPaso: forzarTool ? 'required' : undefined });
                if (!r.text || r.text.startsWith('(')) continue; // centinelas internos
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
                const vv = validarRespuestaDoer(r.text, { motivoRuta: ruta.motivo, linkBorrador });
                if (!vv.ok && vv.razon !== 'sin-borrador' && !linkBorrador) {
                  console.error(`[mako-doer-in] ${prov}: ${vv.detalle} → probando el próximo proveedor`);
                  continue;
                }
                respuesta = r.text.trim();
                break;
              } catch (e2) { ultErr = e2; console.warn(`[mako-doer-in] ${prov} falló: ${e2 instanceof Error ? e2.message : String(e2)}`); }
            }
            // CLAUDE ES EL ÚLTIMO RECURSO, PERO ES UN RECURSO. El comentario de arriba
            // decía «NUNCA caemos a Claude» y para la charla está bien. Pero si la ruta
            // era «cargar al plan» y NINGUNA de las cinco gratis creó el borrador, la
            // alternativa a pagar dos centavos es mandarle prosa al dueño y que el
            // trabajo se pierda — que es exactamente lo que pasó dos veces seguidas.
            // AGENTS.md dice «el ÚLTIMO recurso, no el segundo»: éste es el último.
            if (esRutaPlan(ruta.motivo) && !linkBorrador) {
              console.error(`[mako-doer-in] ninguna IA barata armó el borrador (${orden.join(', ')}) → escalando a Claude`);
              try {
                const { text } = await chatClaudeTools(system, msgs, tools, runTool, {
                  feature: 'mako-doer-in', maxSteps: 8, model: 'claude-sonnet-5',
                  toolChoice: 'any', motivo: `⚠ escalado a Claude: las gratis no armaron el borrador · ${ruta.motivo} «${recorte}»`,
                });
                if (text?.trim()) respuesta = text.trim();
              } catch (e3) { console.error('[mako-doer-in] Claude tampoco pudo:', e3 instanceof Error ? e3.message : String(e3)); }
            }
            if (!respuesta) throw ultErr ?? new Error('todas las IA baratas fallaron');
          } else {
            const { text } = await chatClaudeTools(system, msgs, tools, runTool, {
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
          respuesta = `⚠️ No pude responder ahora: falló la IA (${msg.slice(0, 140)}). Reintentá en un momento o avisá a soporte.`;
        }
      }
    }
    // EL LINK, CORREGIDO CONTRA EL ID REAL. Va acá y no en el prompt porque una
    // instrucción no es una garantía: si el modelo cambió un carácter, lo escribió con
    // otro host o directamente se lo olvidó, se arregla ahora. Y se deja rastro cuando
    // se equivoca — sin el log no hay forma de saber si sigue pasando.
    if (respuesta && linkBorrador) {
      const antes = idDeLinkRevisar(respuesta);
      respuesta = corregirLinkBorrador(respuesta, linkBorrador);
      const bueno = idDeLinkRevisar(linkBorrador);
      if (antes && antes !== bueno) console.warn(`[mako-doer-in] el modelo mandó el link del borrador MAL: «${antes}» → corregido a «${bueno}»`);
      else if (!antes) console.warn('[mako-doer-in] el modelo no puso el link del borrador → agregado');
    }

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

    if (respuesta) {
      const v = validarRespuestaDoer(respuesta, { motivoRuta: ruta.motivo, linkBorrador });
      if (!v.ok && v.razon !== 'sin-borrador') {
        // Las dos razones duras: volcó el molde, o prometió un link que no existe.
        // Mandarle al dueño un link roto es peor que decirle «no pude»: hace clic,
        // lee «este borrador ya no existe» y pierde lo que escribió sin saber por qué.
        console.error(`[mako-doer-in] BLOQUEADA (${v.razon}): ${v.detalle} · ruta «${ruta.motivo}» · ${respuesta.length} chars`);
        // Si el borrador SÍ se creó, lo único roto era el texto: mandamos el link, que
        // es lo que el modelo tenía que haber contestado.
        respuesta = linkBorrador ? mensajeBorrador(linkBorrador) : AVISO_NO_PUDE;
      } else if (!v.ok) {
        // No bloquea —hay turnos de plan que legítimamente no crean nada («¿qué tengo
        // pendiente?»)— pero deja rastro. Antes, el modo de falla grave era el ÚNICO
        // que no logueaba: por eso del 9/8 no quedó una sola línea en Vercel.
        console.error(`[mako-doer-in] ${v.detalle} · ruta «${ruta.motivo}» · ${respuesta.length} chars`);
      }
    }
    if (respuesta) {
      // Mensajes SEPARADOS (punto 10): MaKo separa con una línea de "---"; mandamos
      // cada parte como un mensaje aparte con una pausa chica (se lee como conversación,
      // no un chorizo). Registramos cada id enviado para el anti-eco.
      const partes = respuesta.split(/\n\s*-{3,}\s*\n/).map((p) => p.trim()).filter(Boolean);
      const idsEnv: string[] = [];
      for (let i = 0; i < partes.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 700));
        const env = await enviarAGrupoJid(jid, partes[i]);
        if (env.ok && env.id) idsEnv.push(env.id);
      }
      await registrarEnviados(OPS, jid, idsEnv); // un solo write para toda la respuesta
      await guardarTurno(wsData, jid, 'assistant', partes.join('\n\n'), undefined);
    }
    return { engaged: true, reply: respuesta };
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
