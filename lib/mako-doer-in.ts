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
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION, crearRunnerAcciones } from '@/lib/mako-doer-acciones';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { guardarTurno, historialGrupo } from '@/lib/mako-doer-conv';
import { buildSystemPrompt } from '@/lib/mako-context';
import { enviarAGrupoJid, KEY_GRUPO_JID, KEY_GRUPO_SUPERADMIN } from '@/lib/mako-grupo';
import { enviarPresencia, fetchMediaBase64EnInstancia } from '@/lib/evolution';
import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { transcribirAudio, chatCheap } from '@/lib/ai-cheap';
import { rutearDoer } from '@/lib/mako-router';
import { overrideDeFeature } from '@/lib/model-registry';

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
  if (!id) return;
  const prev = await idsEnviados(ws, jid);
  const next = [...prev.filter((x) => x !== id), id].slice(-30); // ring buffer chico
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

/** ¿Trae una IMAGEN (captura, foto) o un PDF? Claude los lee nativo. Otros documentos
 *  (docx/xlsx) no se soportan → se devuelven con soportado:false. */
function adjuntoDe(m: MsgIn): { tipo: 'image' | 'document'; base64: string | null; mime: string; caption: string; soportado: boolean } | null {
  const msg = m.message ?? {};
  const img = msg.imageMessage as { base64?: string; mimetype?: string; caption?: string } | undefined;
  if (img) {
    const mime = (img.mimetype || 'image/jpeg').split(';')[0];
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(mime);
    return { tipo: 'image', base64: m.base64 || img.base64 || null, mime: ok ? mime : 'image/jpeg', caption: img.caption || '', soportado: true };
  }
  const doc = msg.documentMessage as { base64?: string; mimetype?: string; caption?: string; fileName?: string } | undefined;
  if (doc) {
    const mime = (doc.mimetype || '').split(';')[0];
    const esPdf = /pdf/i.test(mime) || /\.pdf$/i.test(doc.fileName || '');
    return { tipo: 'document', base64: m.base64 || doc.base64 || null, mime: 'application/pdf', caption: doc.caption || doc.fileName || '', soportado: esPdf };
  }
  return null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
/** ¿El mensaje interpela a MaKo? (lo nombra al principio o lo menciona). */
function nombraAMaKo(texto: string): boolean {
  const t = norm(texto).trim();
  if (/\bmako\b/.test(t.slice(0, 60))) return true;   // "hola mako", "che mako, ..."
  return false;
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

CUANDO TE PASA UNA LISTA DE TAREAS PARA EL PLAN (aunque venga desordenada: "anotá esto", "agregá al plan", varias cosas juntas en un mensaje):
1. Primero CONFIRMÁ en una línea que recibiste el pedido y lo vas a procesar ("Dale, anoto eso 👇").
2. Fijate si te falta info para cargarlas bien (¿a qué proyecto va cada una?, ¿tiene fecha?, ¿eso son una o varias tareas?). Si algo NO te queda claro, decí cuántas preguntas tenés ("Tengo 2 preguntas") y hacelas DE A UNA: una pregunta, esperás la respuesta, y recién ahí la siguiente. Como un formulario, pero charlando. NO las tires todas juntas ni adivines. Si está todo claro, no preguntes nada.
3. Cuando ya tenés todo, llamá a 'proponer_tareas_plan' con la lista final, mostrá qué vas a crear y pedí el "sí". NUNCA confirmes en el mismo mensaje en que proponés: proponés y FRENÁS ahí; el "sí" tiene que venir del dueño en un mensaje aparte.
4. Recién con ese "sí", 'confirmar_accion' las crea y te devuelve el/los link(s). Pasáselos al dueño tal cual (uno por tarea/proyecto): "Listo, las agregué → link".`;

// Dónde ver el detalle completo en la app: MaKo da un resumen corto y REDIRIGE con
// un link cuando hay una vista más rica (para eso están las tabs). {id} = id del lead.
const APP_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');
const DEEP_LINKS = `LINKS A LA APP: cuando el detalle completo vive en una tab, dá el resumen corto y CERRÁ con un link para verlo (formato: "Mirá el detalle acá → URL"). No inventes rutas; usá estas (base ${APP_URL}):
- Ficha 360 de un lead: ${APP_URL}/leads/{id}
- Análisis de una llamada de ventas: ${APP_URL}/closing?call={recording_id} (el recording_id sale de reuniones_lead → analisis_llamadas). Si no lo tenés, ${APP_URL}/closing.
- WhatsApp con un lead: ${APP_URL}/whatsapp?lead={id}
- Marketing / anuncios: ${APP_URL}/graphics · Ads Manager: ${APP_URL}/ads-manager
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
export async function manejarEntranteDoer(instance: string, data: MsgIn): Promise<ResultadoDoer> {
  const jid = data.key?.remoteJid;
  if (!jid || !jid.endsWith('@g.us')) return { engaged: false, skip: 'no es grupo' };
  // Control de la agencia: ¿el doer está habilitado en este grupo?
  if (!(await gruposDoer(OWNER_WS)).includes(jid)) return { engaged: false, skip: 'grupo no habilitado' };
  // Aislamiento: los datos son del workspace que POSEE el grupo.
  const wsData = await wsDeGrupoJid(jid);
  if (wsData == null) return { engaged: false, skip: 'grupo sin dueño reconocido' };
  return runWithWorkspace(wsData, () => procesarDoer(wsData, instance, data));
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

    // Resolver el texto: si vino como NOTA DE VOZ, transcribir (pidiendo el base64 a
    // la instancia si el webhook no lo adjuntó inline).
    let texto = textoDirecto;
    if (!texto && audio) {
      let b64 = audio.base64;
      if (!b64 && msgId) {
        const m = await fetchMediaBase64EnInstancia(instance, jid, msgId, !!key?.fromMe);
        if (m) { b64 = m.base64; audio.mime = m.mimetype || audio.mime; }
      }
      if (!b64) { console.error('[mako-doer-in] audio sin base64'); return { engaged: false, skip: 'audio sin base64' }; }
      try { texto = (await transcribirAudio(b64, audio.mime, { language: 'es', feature: 'MaKo · nota de voz', motivo: 'Transcribir nota de voz del grupo' })).trim(); }
      catch (e) { console.error('[mako-doer-in] STT:', e instanceof Error ? e.message : String(e)); return { engaged: false, skip: 'audio no transcribible' }; }
      if (!texto) return { engaged: false, skip: 'audio vacío' };
    }

    // Adjunto (imagen/PDF): Claude lo lee nativo. Armamos bloques de contenido.
    let mediaBlocks: Array<{ type: string } & Record<string, unknown>> | null = null;
    if (!audio && adjunto) {
      if (!adjunto.soportado) {
        const aviso = 'Por ahora solo puedo leer imágenes (capturas) y PDFs. Ese tipo de archivo todavía no. Pasámelo como PDF o captura y lo miro.';
        const env = await enviarAGrupoJid(jid, aviso);
        if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
        return { engaged: true, reply: aviso };
      }
      let b64 = adjunto.base64;
      if (!b64 && msgId) {
        const m = await fetchMediaBase64EnInstancia(instance, jid, msgId, !!key?.fromMe);
        if (m) { b64 = m.base64; }
      }
      if (!b64) { console.error('[mako-doer-in] adjunto sin base64'); return { engaged: false, skip: 'adjunto sin base64' }; }
      const source = { type: 'base64', media_type: adjunto.tipo === 'image' ? adjunto.mime : 'application/pdf', data: b64 };
      const prompt = textoDirecto || adjunto.caption || (adjunto.tipo === 'image' ? 'Mirá esta imagen y decime qué ves y qué hago.' : 'Leé este PDF y decime lo importante.');
      mediaBlocks = [{ type: adjunto.tipo, source }, { type: 'text', text: prompt }];
      // Para la memoria guardamos un placeholder de texto.
      texto = `(envió ${adjunto.tipo === 'image' ? 'una imagen' : 'un PDF'}${adjunto.caption ? `: ${adjunto.caption}` : ''})${textoDirecto ? ` — ${textoDirecto}` : ''}`;
    }

    // Historial (memoria) + system — TODO scopeado al workspace del grupo (wsData).
    const historial = await historialGrupo(wsData, jid, 24);
    const base = await runWithWorkspace(wsData, () => buildSystemPrompt({ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: texto }));
    const ctxPend = vigentes.length
      ? `\n\nACCIONES PENDIENTES DE CONFIRMACIÓN EN ESTE GRUPO (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nSi el dueño está confirmando, usá confirmar_accion con el id que corresponda.`
      : '';
    const system = `${base}\n\n${DOER_WA_PREAMBLE}\n\n${DEEP_LINKS}${ctxPend}`;

    const tools = [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS];
    const runnerAcciones = crearRunnerAcciones(wsData, jid);
    const runTool = async (name: string, input: Record<string, unknown>) =>
      NOMBRES_ACCION.has(name) ? runnerAcciones(name, input) : runMakoTool(name, input);

    // Si hay imagen/PDF, el último turno del usuario va con bloques (media + texto);
    // si no, texto plano. La memoria guarda siempre el placeholder de texto.
    const userContent: RichMsg['content'] = mediaBlocks ?? texto;
    const msgs: RichMsg[] = [...saneaHistorial(historial), { role: 'user', content: userContent }];
    // Guardar el turno del usuario ANTES de la IA (así queda aunque falle).
    await guardarTurno(wsData, jid, 'user', texto, msgId);

    // Router: elegí el modelo por TURNO (no todo a Opus). Saludo/charla sin dato →
    // barato (Groq, sin tools). Dato/acción → Sonnet con tools. Razonamiento/copy/
    // media → Opus. El override manual del dueño (/modelos-ia) pin-ea el modelo.
    const ruta = rutearDoer(texto, { hayMedia: !!mediaBlocks, hayPendientes: vigentes.length > 0 });
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
      const { text } = await chatClaudeTools(system, msgs, tools, runTool, {
        feature: 'mako-doer-in', maxSteps: 8,
        ...(pin ? {} : { model: ruta.model }),
        effort: ruta.effort,
        motivo: `${ruta.motivo} «${recorte}»`,
      });
      respuesta = (text ?? '').trim();
    }
    if (respuesta) {
      const env = await enviarAGrupoJid(jid, respuesta);
      if (env.ok && env.id) await registrarEnviado(OPS, jid, env.id);
      await guardarTurno(wsData, jid, 'assistant', respuesta, env.ok ? env.id : undefined);
    }
    return { engaged: true, reply: respuesta };
  } catch (e) {
    console.error('[mako-doer-in]', e instanceof Error ? e.message : String(e));
    return { engaged: false, skip: e instanceof Error ? e.message : String(e) };
  }
}
