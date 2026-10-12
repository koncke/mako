// =============================================================================
// automatizacion-chat — el chat con MaKo de UNA automatización (puro, sin `server-only`)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5 y §3.3). Pedido de Martín, textual: «tiene que
// tener un chat donde guarda el registro... como hoy lo hace Claude que te saltan una pregunta con tres opciones» y
// «que se guarde un registro tipo chat de las cosas que vos le fuiste pidiendo desde el primer pedido hasta el último».
//
// Acá viven la FORMA del chat y sus dos reglas puras (sanear y agregar). Lo lee y lo escribe
// lib/automatizacion-chat-db.ts (server-only), en `app_settings` con la clave `claveChat(id)`, SIN migración.
//
// ⚠️ ESTOS NOMBRES SON UN CONTRATO DE LA OLA 1 CON LA OLA 2 (la ruta, la API de MaKo y ChatMako.tsx programan contra
// ellos en paralelo): no se cambian.
//
// ⚠️ `sanearChat` NUNCA TIRA. Lo guardado lo escribieron otras versiones del código, o una mano: un mensaje que no se
// entiende se descarta y el resto se sigue viendo. Un chat roto no puede dejar la automatización sin abrir.
// =============================================================================

import type { Disparador } from './disparadores';

/** Sobre qué pregunta MaKo (§2.4). */
export type SobrePregunta = 'canal' | 'producto' | 'evento' | 'cron' | 'condicion';
export type OpcionPregunta = { valor: string; label: string; detalle?: string };
export type PreguntaMako = { id: string; sobre: SobrePregunta; texto: string; opciones: OpcionPregunta[]; otra: true };
/** valor null = «Elige tú»; texto = «Otra cosa». */
export type RespuestaMako = { preguntaId: string; sobre: SobrePregunta; valor: string | null; texto?: string };
export type MensajeChatMako = {
  id: string; de: 'yo' | 'mako'; texto: string; at: string; via: 'app' | 'whatsapp';
  pregunta?: PreguntaMako; respuesta?: RespuestaMako;
  cambios?: { cambiadas: number; quitadas: number; agregadas: number }; avisos?: string[];
  /**
   * DE QUÉ TARJETA SALIÓ (decimotercera tanda, 12/10/2026, punto 7: «las recomendaciones que te de MaKo, en "MaKo te
   * ayuda a escribirlo"... se debe quedar guardado como parte del historial del chat... se tiene que ver que el usuario
   * apretó el botón en X tarjeta»). El nombre de la tarjeta tal como se lee en el lienzo (`nombreDeTarjeta`,
   * lib/flujo-conversacion.ts). Ausente = un turno del chat de siempre.
   */
  tarjeta?: string;
};
export type ChatAutomatizacion = { v: 1; mensajes: MensajeChatMako[] };

/** Cuántos mensajes se guardan: los ÚLTIMOS. */
export const TOPE_CHAT = 60;
/** Cuántas rondas de preguntas antes de que MaKo elija solo (§0: «Como mucho, 2 rondas»). */
export const TOPE_RONDAS = 2;
export const claveChat = (secuenciaId: number) => `automatizacion.chat:${secuenciaId}`;

/** El largo máximo de un texto guardado (un mensaje, una pregunta, un aviso). Lo de más se corta. */
export const TOPE_TEXTO_CHAT = 4000;
/** El largo máximo del nombre de una tarjeta (`tarjeta`): es un rótulo, no un mensaje. */
export const TOPE_TARJETA_CHAT = 160;
/** Cuántas opciones guarda una pregunta, y cuántos avisos un mensaje. */
const TOPE_OPCIONES = 8;
const TOPE_AVISOS = 20;

const SOBRES: ReadonlySet<string> = new Set<SobrePregunta>(['canal', 'producto', 'evento', 'cron', 'condicion']);

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const esId = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;
const texto = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, TOPE_TEXTO_CHAT) : null);
const esSobre = (v: unknown): v is SobrePregunta => typeof v === 'string' && SOBRES.has(v);
const conteo = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10_000 ? v : null);

function sanearOpcion(raw: unknown): OpcionPregunta | null {
  if (!esObjeto(raw)) return null;
  const valor = texto(raw.valor);
  const label = texto(raw.label);
  if (!valor || !label) return null;
  const detalle = texto(raw.detalle);
  return detalle ? { valor, label, detalle } : { valor, label };
}

function sanearPregunta(raw: unknown): PreguntaMako | null {
  if (!esObjeto(raw) || !esId(raw.id) || !esSobre(raw.sobre) || !Array.isArray(raw.opciones)) return null;
  const t = texto(raw.texto);
  if (!t) return null;
  const opciones = raw.opciones.map(sanearOpcion).filter((o): o is OpcionPregunta => o != null).slice(0, TOPE_OPCIONES);
  if (!opciones.length) return null;
  return { id: raw.id, sobre: raw.sobre, texto: t, opciones, otra: true };
}

function sanearRespuesta(raw: unknown): RespuestaMako | null {
  if (!esObjeto(raw) || !esId(raw.preguntaId) || !esSobre(raw.sobre)) return null;
  if (raw.valor !== null && typeof raw.valor !== 'string') return null;
  const out: RespuestaMako = { preguntaId: raw.preguntaId, sobre: raw.sobre, valor: raw.valor === null ? null : raw.valor.slice(0, TOPE_TEXTO_CHAT) };
  const t = texto(raw.texto);
  if (t) out.texto = t;
  return out;
}

/**
 * UN mensaje de lo que sea que haya llegado (la base, la ruta, la API). null = no se entiende. Lo opcional que viene
 * roto (una pregunta sin opciones, unos cambios con letras) se cae SOLO: el mensaje se sigue viendo.
 */
export function sanearMensaje(raw: unknown): MensajeChatMako | null {
  if (!esObjeto(raw) || !esId(raw.id)) return null;
  if (raw.de !== 'yo' && raw.de !== 'mako') return null;
  if (raw.via !== 'app' && raw.via !== 'whatsapp') return null;
  const t = texto(raw.texto);
  if (t == null) return null;
  if (typeof raw.at !== 'string' || Number.isNaN(Date.parse(raw.at))) return null;
  const m: MensajeChatMako = { id: raw.id, de: raw.de, texto: t, at: raw.at, via: raw.via };
  const pregunta = raw.pregunta === undefined ? null : sanearPregunta(raw.pregunta);
  if (pregunta) m.pregunta = pregunta;
  const respuesta = raw.respuesta === undefined ? null : sanearRespuesta(raw.respuesta);
  if (respuesta) m.respuesta = respuesta;
  if (esObjeto(raw.cambios)) {
    const c = raw.cambios;
    const cambiadas = conteo(c.cambiadas);
    const quitadas = conteo(c.quitadas);
    const agregadas = conteo(c.agregadas);
    if (cambiadas != null && quitadas != null && agregadas != null) m.cambios = { cambiadas, quitadas, agregadas };
  }
  if (Array.isArray(raw.avisos)) {
    const avisos = raw.avisos.map(texto).filter((a): a is string => !!a && a.trim().length > 0).slice(0, TOPE_AVISOS);
    if (avisos.length) m.avisos = avisos;
  }
  if (typeof raw.tarjeta === 'string' && raw.tarjeta.trim()) m.tarjeta = raw.tarjeta.trim().slice(0, TOPE_TARJETA_CHAT);
  return m;
}

/** Sin repetidos por id (gana el PRIMERO: lo que ya estaba) y con el tope (quedan los últimos). */
function deduparYTopar(lista: readonly MensajeChatMako[]): MensajeChatMako[] {
  const vistos = new Set<string>();
  const out = lista.filter((m) => (vistos.has(m.id) ? false : (vistos.add(m.id), true)));
  return out.slice(-TOPE_CHAT);
}

/**
 * EL CHAT DE LO QUE SEA QUE HAYA LLEGADO: el texto guardado en `app_settings` (un JSON), el objeto ya parseado, null
 * (no hay chat) o basura. NUNCA tira: lo que no se entiende se descarta.
 */
export function sanearChat(raw: unknown): ChatAutomatizacion {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch { o = null; }
  }
  const crudos = esObjeto(o) && Array.isArray(o.mensajes) ? o.mensajes : [];
  return { v: 1, mensajes: deduparYTopar(crudos.map(sanearMensaje).filter((m): m is MensajeChatMako => m != null)) };
}

/**
 * SUMA MENSAJES AL FINAL. Un id que ya está no se vuelve a sumar (el mismo turno escrito dos veces, por un reintento,
 * queda una vez), lo malformado no entra, y quedan los últimos `TOPE_CHAT`.
 */
export function agregarMensajes(c: ChatAutomatizacion, nuevos: MensajeChatMako[]): ChatAutomatizacion {
  const base = sanearChat(c).mensajes;
  const limpios = nuevos.map(sanearMensaje).filter((m): m is MensajeChatMako => m != null);
  return { v: 1, mensajes: deduparYTopar([...base, ...limpios]) };
}

/** El evento del stream cuando MaKo pregunta en vez de armar (§3.4): después de éste, el stream termina. */
export type EventoPreguntaIA = { t: 'pregunta'; pregunta: PreguntaMako; mensaje: MensajeChatMako };

/** Lo que suma el `listo` de EDITAR (§3.4 y §3.5). */
export type ExtrasEdicionIA = {
  resumen: string; cambiadas: string[]; quitadas: string[];
  disparadores?: Disparador[] | null;   // CRON a guardar por action 'disparadores'; ausente = no lo toca
  pregunta?: PreguntaMako;               // p. ej. «¿Cambio qué la dispara?»
};
