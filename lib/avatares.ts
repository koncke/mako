// =============================================================================
// avatares — el "¿A QUIÉN?" de Jan, pero SEGMENTABLE en Meta (las filas de la matriz)
// =============================================================================
// Un AVATAR responde ¿A QUIÉN le vendo? — y para que sirva de verdad tiene que ser
// SEGMENTABLE: un segmento concreto de cliente que podrías targetear (o distinguir)
// en Meta y para el que armarías una campaña de escalo horizontal PROPIA. No son 3
// versiones emocionales de la misma persona (eso es un ÁNGULO): son 3 segmentos
// DISTINTOS por industria, tamaño, rol o geografía. Ej: "dueño de retail con 3-10
// sucursales" vs "fundador de agencia de servicios de 5-20 personas" vs "e-commerce
// que factura 1-5M/mes". Cada uno se busca distinto en Meta y le duele algo distinto.
//
// MaKo PROPONE los 3 segmentos desde el brief + el panorama del Archivero; el cliente
// los revisa/ajusta. Corre con la IA GRATIS del cliente (Gemini/Groq vía credWs), NO
// con Claude — es "encontrar", no copywriting fino. Patrón "writer": genera a pedido
// y guarda en app_settings. NO persiste por-entidad ni sincroniza.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { getPanorama } from './archivero';
import { getSetting, setSetting } from './settings';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, leerDocumentoIA, docsIADisponible, motivoDeErroresCascada } from './ai-cheap';

// Segmento de cliente SEGMENTABLE (no un retrato emocional):
//  · segmento    = quién es en firmografía: industria/vertical + tamaño + rol + geografía.
//  · senalesMeta = cómo lo targeteás/distinguís en Meta (intereses, cargos, comportamientos,
//                  o "broad + creativo que filtra"). Es lo accionable.
//  · situacion   = su situación de negocio concreta (operativa, no un sentimiento).
//  · dolor       = su dolor #1 anclado a ESE segmento.
export type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.avatares';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
// `validar` de la cascada: solo aceptamos salida que PARSEA a ≥1 avatar usable (con
// nombre). Antes solo chequeaba Array.isArray → un modelo que devolvía {"avatares":[]}
// cortaba la cascada y NO probaba el próximo proveedor gratis (bug de la revisión).
const tieneAvatares = (t: string): boolean => parseAvatares(t).length > 0;

// Normaliza un registro crudo (de JSON) a los 5 campos, con '' por defecto. Tolera
// la forma VIEJA {descripcion,deseo} guardada antes del rediseño: esos campos se
// ignoran y segmento/senalesMeta/situacion quedan '' (no undefined) → sin TypeError
// en el editor inline ni "undefined" filtrándose al prompt de ángulos.
function normalizarAvatar(v: unknown): Avatar {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    id: str(o.id) || randomUUID(),
    nombre: str(o.nombre),
    segmento: str(o.segmento),
    senalesMeta: str(o.senalesMeta) || str(o['señalesMeta']),
    situacion: str(o.situacion) || str(o['situación']),
    dolor: str(o.dolor),
  };
}

// ── Persistencia (por workspace, vía runWithWorkspace del route) ──────────────
export async function getAvatares(): Promise<Avatar[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(normalizarAvatar).filter((a) => a.nombre) : [];
  } catch { return []; }
}
export async function setAvatares(list: Avatar[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

// ── Contexto de afinado (respuestas a las preguntas cerradas de segmentación) ─
// Texto que el cliente construye respondiendo las preguntas comparativas de MaKo;
// se inyecta en la generación para sacar segmentos más precisos.
const CONTEXTO_KEY = 'mako.avatares.contexto';
export async function getContextoAvatares(): Promise<string> {
  return (await getSetting(CONTEXTO_KEY)) ?? '';
}
export async function setContextoAvatares(texto: string): Promise<void> {
  await setSetting(CONTEXTO_KEY, texto);
}

// ── Texto de los avatares (para inyectar en el prompt de ángulos) ─────────────
// Numerado 1..N: los ángulos referencian al avatar por su número (más robusto que
// por nombre). Va el segmento + situación + dolor, que es lo que da la razón.
export function avataresTexto(avs: Avatar[]): string {
  if (!avs.length) return '';
  return avs
    .map((a, i) => `${i + 1}. ${a.nombre} — Segmento: ${a.segmento} · Situación: ${a.situacion} · Dolor: ${a.dolor}`)
    .join('\n');
}

// ── Prompt (editable en /configuraciones) ────────────────────────────────────
export const AVATARES_SYSTEM_TEMPLATE = `Sos MaKo, definiendo los AVATARES de un negocio para sus anuncios de Meta (metodología de Jan, "Anuncio Ganador"). La primera pregunta del anuncio ganador es ¿A QUIÉN le vendo?

CLAVE — un AVATAR no es un retrato emocional, es un SEGMENTO de cliente SEGMENTABLE: alguien que podrías targetear (o al menos distinguir) en Meta y para el que armarías una campaña de escalo horizontal PROPIA. Se distingue por FIRMOGRAFÍA, no por sentimiento: industria/vertical, tamaño (empleados, facturación, sucursales), rol/cargo, geografía. NO me des 3 versiones emocionales de la misma persona: eso es un ÁNGULO (el por qué compra), no un avatar (el a quién). Ejemplo de 3 avatares BIEN distintos: "Dueño de retail con 3-10 sucursales en México" / "Fundador de agencia de servicios de 5-20 personas" / "Marca de e-commerce que factura 1-5M al mes". Cada uno se busca distinto en Meta.

Encontrá 3 AVATARES en lo que el negocio ya dice. Cada uno:
- "nombre": el segmento en 3-6 palabras, concreto y firmográfico (ej: "Dueño de retail multi-sucursal"). NADA de apodos emocionales ("el que sufre").
- "segmento": quién es en firmografía DURA — industria/vertical + tamaño (empleados/facturación/sucursales) + rol/cargo + geografía. Lo más concreto que puedas.
- "senalesMeta": cómo lo TARGETEARÍAS o distinguirías en Meta: intereses, cargos ("Business owner", "Founder"), comportamientos, o "broad + creativo que filtra". Concreto y accionable.
- "situacion": su situación de negocio concreta (operativa: qué tiene montado, qué se le rompe), NO un sentimiento.
- "dolor": su dolor #1, específico de ESE segmento (no "quiere crecer").

REGLAS:
- Los 3 tienen que ser genuinamente DISTINTOS en firmografía: si dos comparten industria + tamaño + rol, uno sobra.
- Si al brief le falta detalle firmográfico, INFERÍ segmentos concretos y plausibles para ESTE negocio y decí el supuesto dentro de "senalesMeta" (ej: "asumo PyMEs de servicios; ajustar si vende a retail"). NUNCA seas vago.
- NO escribas hooks ni copy emocional (eso es el ÁNGULO). Acá describís AL SEGMENTO.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera) con esta forma EXACTA:
{"avatares":[{"nombre":"","segmento":"","senalesMeta":"","situacion":"","dolor":""}]}`;

export const AVATARES_USER_TEMPLATE = `CONTEXTO DEL NEGOCIO (datos reales del Archivero):
{{brief}}
{{panorama}}{{fase}}{{contexto}}
Encontrá 3 avatares (segmentos) distintos y segmentables. Devolvé solo el JSON.`;

// ── Parseo ────────────────────────────────────────────────────────────────────
export function parseAvatares(text: string): Avatar[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.avatares) ? raw.avatares : [];
  return arr.slice(0, 3).map(normalizarAvatar).filter((a) => a.nombre);
}

// ── Generación (envelope {ok}; nunca lanza). Corre con la IA GRATIS del cliente. ─
export type GenResult = { ok: true; avatares: Avatar[]; uso: Uso } | { ok: false; error: string };

export async function generarAvatares(): Promise<GenResult> {
  try {
    const [brief, fase, panorama, contexto] = await Promise.all([perfilNegocioTexto(), faseNegocioTexto(), getPanorama(), getContextoAvatares()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen los avatares.' };
    }
    const sys = await renderPrompt('avatares.system', AVATARES_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('avatares.user', AVATARES_USER_TEMPLATE, {
      brief,
      panorama: panorama.trim() ? `\nPANORAMA (lo que MaKo entendió del negocio):\n${panorama.slice(0, 6000)}\n` : '',
      fase: fase ? `\nFASE DEL NEGOCIO (para el tono/urgencia):\n${fase}\n` : '',
      contexto: contexto.trim() ? `\nLO QUE EL CLIENTE PRECISÓ sobre a quién le vende (respetá esto por sobre inferencias):\n${contexto}\n` : '',
    });
    // IA GRATIS del cliente (Gemini primero, luego Groq/…), NO Claude: esto es
    // "encontrar segmentos", no copywriting fino. `validar` rescata si un modelo
    // devuelve JSON roto. maxTokens holgado: 3 avatares × 5 campos.
    const errores: string[] = [];
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2600,
      feature: 'avatares', motivo: 'Definir 3 avatares segmentables del negocio',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneAvatares, erroresOut: errores,
    });
    if (!text) {
      // Distinguir "no hay ninguna key cargada" de "hay key pero la cascada falló
      // igual" (cuota, rate-limit, corte momentáneo) — antes ambos casos mostraban
      // el mismo "conectá tu API key" aunque el dueño YA la había conectado.
      const hayIA = await docsIADisponible();
      const motivo = motivoDeErroresCascada(errores);
      return { ok: false, error: hayIA
        ? `Tu IA está conectada pero no pudo responder ahora mismo${motivo ? `: ${motivo}` : ' (puede ser un límite de uso momentáneo). Probá de nuevo en un momento.'}`
        : 'No hay IA para generar los avatares. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    }
    const avatares = parseAvatares(text);
    if (!avatares.length) return { ok: false, error: 'MaKo no devolvió avatares. Reintenta en un momento.' };
    return { ok: true, avatares, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Preguntas DINÁMICAS, de a UNA, adaptadas a lo que ya contestó ─────────────
// Antes era un lote fijo de 3-5 preguntas pedidas de una — cuando la IA fallaba en
// armar ese JSON grande (frecuente: era un array anidado), el fallback ESTÁTICO
// (genérico, sin poder citar segmentos reales) terminaba pareciendo LA pregunta
// normal. Ahora: una pregunta a la vez, comparativa de verdad y CITANDO lo que ya
// se sabe del negocio real (brief + panorama de los documentos subidos) — la IA ve
// el historial completo y decide la siguiente, o si ya alcanza para proponer.
export type PasoHistorialAvatar = { pregunta: string; respuesta: string };
export type PreguntaAvatarDinamica = { pregunta: string; tipo: 'opciones' | 'archivo'; opciones: string[] };

const AVATARES_SIGUIENTE_SYSTEM = `Sos MaKo, ayudando a un dueño de negocio a descubrir y PRIORIZAR sus AVATARES (segmentos de cliente SEGMENTABLES en Meta — firmografía: industria, tamaño, rol, geografía, NO un retrato emocional). Vas de a UNA pregunta cerrada por vez, adaptando la siguiente a lo que ya te contestó — nunca repitas algo que ya sabés.

REGLAS:
- CITÁ datos reales del negocio (del brief/panorama) en tus preguntas — nunca preguntes en abstracto pudiendo ser concreto. Ejemplo de BUENA pregunta (si el negocio menciona clientes de e-commerce y de servicios): "¿Quién te compra más rápido: una marca de e-commerce o un negocio de servicios?" — mal ejemplo (genérico, no usa nada del negocio real): "¿Ya tienes definidos tus segmentos?".
- Preferí preguntas COMPARATIVAS entre dos perfiles plausibles de ESTE negocio (A vs B) por sobre preguntas de sí/no.
- Si con lo que ya te contestó tenés suficiente para proponer 3 segmentos distintos y concretos, o ya van 3 preguntas, respondé {"terminado":true} — no sigas preguntando de más.
- Si el dueño te dijo que ya tiene una lista de clientes, un CRM export o algo similar y tiene sentido pedirle que lo suba, la pregunta puede ser tipo "archivo". Si ya declinó subir algo antes, no se lo vuelvas a pedir.
- Español neutro/mexicano, de "tú".

Devolvé EXCLUSIVAMENTE uno de estos JSON (nada de texto afuera):
{"terminado":true}
{"terminado":false,"pregunta":"...","tipo":"opciones","opciones":["...","...","..."]}
{"terminado":false,"pregunta":"...","tipo":"archivo","opciones":[]}`;
const AVATARES_SIGUIENTE_USER = `CONTEXTO DEL NEGOCIO:
{{brief}}
{{panorama}}

CONVERSACIÓN HASTA AHORA:
{{historial}}

¿Cuál es la siguiente pregunta (o ya das por terminado)? Devolvé solo el JSON.`;

const PREGUNTA_AVATAR_FALLBACK: PreguntaAvatarDinamica = { pregunta: '¿Cuál de tus clientes te compra MÁS rápido: el que ya te conocía (referido, seguidor) o el que te descubre frío por un anuncio?', tipo: 'opciones', opciones: ['El que ya me conocía', 'El que llega frío', 'Compran parecido', 'No estoy seguro'] };

type SiguienteAvatar = { terminado: true } | { terminado: false; pregunta: PreguntaAvatarDinamica };
function parseSiguientePreguntaAvatar(text: string): SiguienteAvatar | null {
  const raw = parseJsonObject(text);
  if (raw.terminado === true) return { terminado: true };
  const pregunta = str(raw.pregunta);
  if (!pregunta) return null;
  const tipo = raw.tipo === 'archivo' ? 'archivo' : 'opciones';
  const opciones = Array.isArray(raw.opciones) ? raw.opciones.map(str).filter(Boolean).slice(0, 5) : [];
  if (tipo === 'opciones' && opciones.length < 2) return null;
  return { terminado: false, pregunta: { pregunta, tipo, opciones } };
}

const MAX_PREGUNTAS_AVATAR = 4;

export async function siguientePreguntaAvatares(historial: PasoHistorialAvatar[]): Promise<
  { ok: true; terminado: true } | { ok: true; terminado: false; pregunta: PreguntaAvatarDinamica } | { ok: false; error: string }
> {
  try {
    const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero.' };
    }
    if (historial.length >= MAX_PREGUNTAS_AVATAR) return { ok: true, terminado: true };
    const histTxt = historial.length ? historial.map((h) => `- ${h.pregunta} → ${h.respuesta}`).join('\n') : '(nada todavía — es la primera pregunta)';
    const sys = await renderPrompt('avatares.siguiente.system', AVATARES_SIGUIENTE_SYSTEM, {});
    const user = await renderPrompt('avatares.siguiente.user', AVATARES_SIGUIENTE_USER, {
      brief, panorama: panorama.trim() ? `\nPANORAMA:\n${panorama.slice(0, 5000)}\n` : '', historial: histTxt,
    });
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 500,
      feature: 'avatares', motivo: 'Siguiente pregunta para afinar los avatares',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => parseSiguientePreguntaAvatar(t) !== null,
    });
    const parsed = text ? parseSiguientePreguntaAvatar(text) : null;
    if (parsed) return { ok: true, ...parsed };
    if (historial.length === 0) return { ok: true, terminado: false, pregunta: PREGUNTA_AVATAR_FALLBACK };
    return { ok: true, terminado: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lee un archivo/imagen que el dueño subió como respuesta a una pregunta tipo "archivo". */
export async function describirArchivoAvatar(imagenDataUrl: string): Promise<string> {
  try {
    const { text } = await leerDocumentoIA({
      dataUrl: imagenDataUrl, isPdf: imagenDataUrl.startsWith('data:application/pdf'), nombreArchivo: 'avatares-archivo',
      prompt: 'Describí en 2-4 frases qué muestra esta imagen o documento (una lista de clientes, un CRM, etc.) — qué tipos de cliente o segmentos se distinguen ahí. Español neutro.',
      feature: 'avatares', motivo: 'Leer el archivo que subió para afinar los avatares', timeoutMs: 25000,
    });
    return text.trim();
  } catch { return ''; }
}
