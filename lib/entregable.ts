// =============================================================================
// entregable — el ELEMENTO TANGIBLE de la oferta (el que genera FOMO en los ads)
// =============================================================================
// Casi todo servicio tiene (o puede tener) un elemento CONCRETO y TANGIBLE que hace
// que la oferta se entienda rápido y genere CURIOSIDAD/FOMO en los anuncios: un
// dashboard, una planilla de Excel, un documento, una metodología con nombre. Ej de
// Mauricio: instala DASHBOARDS con sus clientes; MaKo con su software. Ese entregable
// permite copys como "si tus empleados no cumplen sus objetivos es porque te falta
// ESTE dashboard". OJO: NO es el "hook" de un guion — es el MECANISMO tangible.
//
// MaKo propone 1-3 candidatos desde el brief; el cliente los revisa/edita, o CARGA EL
// SUYO directo (muchas veces ya lo tiene claro). Corre con la IA gratis del cliente.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { getPanorama } from './archivero';
import { getSetting, setSetting } from './settings';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, leerDocumentoIA, docsIADisponible, motivoDeErroresCascada } from './ai-cheap';

// Un entregable tangible:
//  · tipo  = qué clase de elemento es (Dashboard, Excel, Documento, Metodología…).
//  · queEs = qué es concretamente y qué resuelve.
//  · fomo  = una línea estilo anuncio que usa el entregable para generar FOMO.
export type Entregable = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.entregable';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const tieneEntregables = (t: string): boolean => parseEntregables(t).length > 0;

function normalizarEntregable(v: unknown): Entregable {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { id: str(o.id) || randomUUID(), nombre: str(o.nombre), tipo: str(o.tipo), queEs: str(o.queEs) || str(o['que_es']), fomo: str(o.fomo) };
}

// ── Persistencia (por workspace, vía runWithWorkspace del route) ──────────────
export async function getEntregables(): Promise<Entregable[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(normalizarEntregable).filter((g) => g.nombre) : [];
  } catch { return []; }
}
export async function setEntregables(list: Entregable[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

/** Texto de los entregables para inyectar en otros prompts (razones → FOMO). */
export function entregablesTexto(gs: Entregable[]): string {
  if (!gs.length) return '';
  return gs.map((g) => `- ${g.nombre} (${g.tipo}): ${g.queEs}`).join('\n');
}

// ── Prompt (editable en /configuraciones) ────────────────────────────────────
export const ENTREGABLE_SYSTEM_TEMPLATE = `Sos MaKo, encontrando el ENTREGABLE de un negocio: su elemento TANGIBLE y CONCRETO que hace que la oferta se entienda rápido y genere CURIOSIDAD/FOMO en los anuncios de Meta. NO es un sentimiento ni una promesa: es una COSA que el cliente entrega o usa (un dashboard, una planilla de Excel, un documento, una metodología CON NOMBRE, un software, un checklist, una plantilla).

Ejemplos del concepto: "instala un DASHBOARD de objetivos con cada cliente" → permite el copy "si tus empleados no cumplen sus objetivos es porque te falta ESTE dashboard". Una "metodología de 4 pasos con nombre propio" también sirve.

Encontrá 1 a 3 ENTREGABLES candidatos para ESTE negocio (según lo que ya dice el brief). Si el negocio no menciona uno claro, PROPONÉ el más plausible que podría crear/mostrar (y decilo natural). Cada entregable:
- "nombre": el nombre del elemento tangible, corto y concreto (ej: "Dashboard de Objetivos por Empleado", "Planilla de Escala 90 días").
- "tipo": qué clase de elemento es. UNO de: Dashboard, Planilla Excel, Documento, Metodología, Software, Checklist, Plantilla, Otro.
- "queEs": qué es concretamente y qué resuelve, en 1-2 frases claras.
- "fomo": UNA línea estilo anuncio que use el entregable para generar CURIOSIDAD/FOMO en el espectador (concreta, del dolor real; ej: "Si tu equipo no cumple sus metas, no es falta de ganas: es que no tienen ESTE tablero a la vista todos los días.").

REGLAS:
- Aterrizá TODO en el negocio real del brief; nada genérico.
- NO inventes resultados ni cifras que no estén en el contexto.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera) con esta forma EXACTA:
{"entregables":[{"nombre":"","tipo":"","queEs":"","fomo":""}]}`;

export const ENTREGABLE_USER_TEMPLATE = `CONTEXTO DEL NEGOCIO (datos reales del Archivero):
{{brief}}
{{panorama}}{{respuestas}}
Encontrá 1-3 entregables tangibles. Devolvé solo el JSON.`;

// ── Parseo ────────────────────────────────────────────────────────────────────
export function parseEntregables(text: string): Entregable[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.entregables) ? raw.entregables : [];
  return arr.slice(0, 3).map(normalizarEntregable).filter((g) => g.nombre);
}

// ── Preguntas DINÁMICAS, de a UNA, adaptadas a lo que ya contestó ─────────────
// Antes era un lote fijo de 2-3 preguntas pedidas de una — genérico por diseño (no
// podía reaccionar a la respuesta anterior) y encima cuando la IA fallaba, el
// fallback estático quedaba pareciendo LA pregunta normal. Ahora: una pregunta a la
// vez, la IA ve el historial completo y decide la siguiente (o si ya alcanza para
// proponer). Si el dueño dice que ya tiene algo concreto, la propia IA puede pedirle
// que lo suba (tipo "archivo") en vez de necesitar un botón aparte para eso.
export type PreguntaDinamica = { pregunta: string; tipo: 'opciones' | 'archivo'; opciones: string[] };
export type PasoHistorial = { pregunta: string; respuesta: string };

const ENTREGABLE_SIGUIENTE_SYSTEM = `Sos MaKo, ayudando a un dueño de negocio a definir su ENTREGABLE tangible: el elemento CONCRETO que genera FOMO en los ads (un dashboard, una planilla, una metodología con nombre, un checklist, un software, una plantilla). Vas de a UNA pregunta cerrada por vez, adaptando la siguiente a lo que ya te contestó — nunca repitas algo que ya sabés.

REGLAS:
- Si con lo que ya te contestó tenés suficiente para proponerle un entregable concreto con confianza, o ya van 3 preguntas, respondé {"terminado":true} — no sigas preguntando de más.
- Si el dueño te dijo que YA TIENE algo concreto (ej: "una plantilla", "un dashboard que ya uso") y todavía no lo mostró, la siguiente pregunta puede ser tipo "archivo": invitalo a subir una imagen o captura de eso. Si en un paso anterior ya declinó subir algo, NO se lo vuelvas a pedir — seguí con preguntas de opciones.
- Si no, hacé una pregunta tipo "opciones" con 3-4 opciones CONCRETAS y ACCIONABLES para ESTE negocio real (nunca genéricas de manual — usá el contexto de verdad).
- Español neutro/mexicano, de "tú".

Devolvé EXCLUSIVAMENTE uno de estos JSON (nada de texto afuera):
{"terminado":true}
{"terminado":false,"pregunta":"...","tipo":"opciones","opciones":["...","...","..."]}
{"terminado":false,"pregunta":"...","tipo":"archivo","opciones":[]}`;
const ENTREGABLE_SIGUIENTE_USER = `CONTEXTO DEL NEGOCIO:
{{brief}}
{{panorama}}

CONVERSACIÓN HASTA AHORA:
{{historial}}

¿Cuál es la siguiente pregunta (o ya das por terminado)? Devolvé solo el JSON.`;

const PREGUNTA_ENT_FALLBACK: PreguntaDinamica = { pregunta: '¿Ya tienes un entregable tangible específico en mente?', tipo: 'opciones', opciones: ['Sí, lo tengo muy claro', 'Tengo una idea, pero no está definida', 'No, que MaKo lo proponga'] };

type Siguiente = { terminado: true } | { terminado: false; pregunta: PreguntaDinamica };
function parseSiguientePregunta(text: string): Siguiente | null {
  const raw = parseJsonObject(text);
  if (raw.terminado === true) return { terminado: true };
  const pregunta = str(raw.pregunta);
  if (!pregunta) return null;
  const tipo = raw.tipo === 'archivo' ? 'archivo' : 'opciones';
  const opciones = Array.isArray(raw.opciones) ? raw.opciones.map(str).filter(Boolean).slice(0, 5) : [];
  if (tipo === 'opciones' && opciones.length < 2) return null;
  return { terminado: false, pregunta: { pregunta, tipo, opciones } };
}

const MAX_PREGUNTAS_ENT = 4;

export async function siguientePreguntaEntregable(historial: PasoHistorial[]): Promise<
  { ok: true; terminado: true } | { ok: true; terminado: false; pregunta: PreguntaDinamica } | { ok: false; error: string }
> {
  try {
    const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen las preguntas.' };
    }
    if (historial.length >= MAX_PREGUNTAS_ENT) return { ok: true, terminado: true };
    const histTxt = historial.length ? historial.map((h) => `- ${h.pregunta} → ${h.respuesta}`).join('\n') : '(nada todavía — es la primera pregunta)';
    const sys = await renderPrompt('entregable.siguiente.system', ENTREGABLE_SIGUIENTE_SYSTEM, {});
    const user = await renderPrompt('entregable.siguiente.user', ENTREGABLE_SIGUIENTE_USER, {
      brief, panorama: panorama.trim() ? `\nPANORAMA:\n${panorama.slice(0, 5000)}\n` : '', historial: histTxt,
    });
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 500,
      feature: 'entregable', motivo: 'Siguiente pregunta para afinar el entregable',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => parseSiguientePregunta(t) !== null,
    });
    const parsed = text ? parseSiguientePregunta(text) : null;
    if (parsed) return { ok: true, ...parsed };
    // La IA no respondió algo usable: si es la primera pregunta, caemos a la genérica
    // de siempre (nunca dejamos la pantalla sin preguntar nada); si ya veníamos con
    // algo de contexto, mejor cerrar y proponer con lo que hay que forzar más preguntas
    // que puedan volver a fallar.
    if (historial.length === 0) return { ok: true, terminado: false, pregunta: PREGUNTA_ENT_FALLBACK };
    return { ok: true, terminado: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lee un archivo/imagen que el dueño subió como respuesta a una pregunta tipo "archivo". */
export async function describirArchivoEntregable(imagenDataUrl: string): Promise<string> {
  try {
    const { text } = await leerDocumentoIA({
      dataUrl: imagenDataUrl, isPdf: imagenDataUrl.startsWith('data:application/pdf'), nombreArchivo: 'entregable-archivo',
      prompt: 'Describí en 2-4 frases qué muestra esta imagen o documento (qué es, qué se ve) — para entender qué ENTREGABLE tangible es, en el contexto del negocio de un cliente. Español neutro.',
      feature: 'entregable', motivo: 'Leer el archivo que subió para el entregable', timeoutMs: 25000,
    });
    return text.trim();
  } catch { return ''; }
}

// ── Generación (envelope {ok}; nunca lanza). IA gratis del cliente. ───────────
export type GenResult = { ok: true; entregables: Entregable[]; uso: Uso } | { ok: false; error: string };

export async function generarEntregables(respuestas?: Array<{ pregunta: string; respuesta: string }>): Promise<GenResult> {
  try {
    const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí sale el entregable.' };
    }
    const respTxt = respuestas && respuestas.length
      ? `\nRESPUESTAS DEL DUEÑO (úsalas para afinar el entregable):\n${respuestas.map((r) => `- ${r.pregunta} → ${r.respuesta}`).join('\n')}\n`
      : '';
    const sys = await renderPrompt('entregable.system', ENTREGABLE_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('entregable.user', ENTREGABLE_USER_TEMPLATE, {
      brief,
      panorama: panorama.trim() ? `\nPANORAMA (lo que MaKo entendió del negocio):\n${panorama.slice(0, 6000)}\n` : '',
      respuestas: respTxt,
    });
    const errores: string[] = [];
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2000,
      feature: 'entregable', motivo: 'Detectar el entregable tangible de la oferta',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneEntregables, erroresOut: errores,
    });
    if (!text) {
      // Distinguir "no hay ninguna key cargada" de "hay key pero la cascada falló
      // igual" (cuota, rate-limit, corte momentáneo) — antes ambos casos mostraban
      // el mismo "conectá tu API key" aunque el dueño YA la había conectado.
      const hayIA = await docsIADisponible();
      const motivo = motivoDeErroresCascada(errores);
      return { ok: false, error: hayIA
        ? `Tu IA está conectada pero no pudo responder ahora mismo${motivo ? `: ${motivo}` : ' (puede ser un límite de uso momentáneo). Probá de nuevo en un momento.'}`
        : 'No hay IA para detectar el entregable. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    }
    const entregables = parseEntregables(text);
    if (!entregables.length) return { ok: false, error: 'MaKo no devolvió entregables. Reintenta en un momento.' };
    return { ok: true, entregables, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
