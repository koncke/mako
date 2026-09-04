// =============================================================================
// angulos-formatos — la BIBLIOTECA de formatos de creativo (¿cómo se muestra?)
// =============================================================================
// Un "ÁNGULO" (en el sentido de Mauricio) = el FORMATO del creativo: cómo se ejecuta
// visualmente. Separado en IMAGEN y VIDEO. La biblioteca es FIJA (la definimos
// nosotros, no es configurable por el cliente); la IA AGARRA de esta biblioteca y
// decide cuál es el mejor para cada caso del negocio (según sus razones + su gancho).
//
// Distinto de las RAZONES (las motivaciones de compra, ver razones) y del ENTREGABLE
// (el elemento tangible, ver entregable). El pipeline: avatar → razón → entregable →
// FORMATO (esto) → creativo.
// =============================================================================

import 'server-only';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { getSetting, setSetting } from './settings';
import { getRazones, setRazones } from './razones';
import { getAvatares } from './avatares';
import { getEntregables, entregablesTexto } from './entregable';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, errorDeCascada } from './ai-cheap';
import { BIBLIOTECA_ANGULOS, formatoPorId, type Medio, type FormatoAngulo } from './angulos-data';

// La biblioteca (data pura) vive en ./angulos-data para poder usarla también en la
// UI (client). Acá la re-exportamos + la lógica de IA que elige de ella.
export { BIBLIOTECA_ANGULOS, formatoPorId };
export type { Medio, FormatoAngulo };

// Una recomendación de MaKo: elige un formato de la biblioteca para un "caso" del
// negocio (una razón/avatar) y dice por qué.
export type Recomendacion = { formatoId: string; para: string; porque: string };

const SETTING_KEY = 'mako.formatos_recom';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export async function getRecomendaciones(): Promise<Recomendacion[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    const ids = new Set(BIBLIOTECA_ANGULOS.map((f) => f.id));
    return Array.isArray(arr)
      ? (arr as Recomendacion[]).filter((r) => r && ids.has(r.formatoId)).map((r) => ({ formatoId: r.formatoId, para: str(r.para), porque: str(r.porque) }))
      : [];
  } catch { return []; }
}
export async function setRecomendaciones(list: Recomendacion[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

const tieneRecom = (t: string): boolean => {
  const arr = parseJsonObject(t).recomendaciones;
  return Array.isArray(arr) && arr.length > 0;
};

// ── Prompt (editable) ─────────────────────────────────────────────────────────
export const FORMATOS_SYSTEM_TEMPLATE = `Eres MaKo, eligiendo los mejores FORMATOS de creativo para los anuncios de un negocio. Tienes una BIBLIOTECA FIJA de formatos (imagen y video); NO inventes formatos nuevos: solo ELIGES de la biblioteca los que mejor le sirven a ESTE negocio, según sus razones de compra y su gancho tangible.

Para cada recomendación:
- "formatoId": EXACTAMENTE uno de los IDs de la biblioteca que te paso (no otro).
- "para": a qué caso del negocio le sirve — el avatar y/o la razón de compra (ej: "Avatar 'Dueño de retail', razón Dolor").
- "porque": 1 frase concreta de por qué ese formato encaja con ese caso y este negocio (usa el gancho si aplica).

Elige entre 4 y 6 recomendaciones, MEZCLANDO imagen y video, cubriendo distintos avatares/razones. Prioriza los formatos que aprovechen el GANCHO tangible del negocio (ej: si hay un dashboard, "screenshot-resultado" o "demo-walkthrough" lucen).

REGLAS:
- Usa SOLO IDs de la biblioteca. Aterriza el "para"/"porque" en el negocio real.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo argentino.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma EXACTA:
{"recomendaciones":[{"formatoId":"","para":"","porque":""}]}`;

export const FORMATOS_USER_TEMPLATE = `BIBLIOTECA DE FORMATOS (elige SOLO de estos IDs):
{{biblioteca}}

NEGOCIO:
{{brief}}
{{gancho}}RAZONES DE COMPRA (la matriz avatar × razón):
{{razones}}

Elige los mejores formatos de la biblioteca para este negocio. Devuelve solo el JSON.`;

// ── Parseo ────────────────────────────────────────────────────────────────────
export function parseRecomendaciones(text: string): Recomendacion[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.recomendaciones) ? raw.recomendaciones : [];
  const ids = new Set(BIBLIOTECA_ANGULOS.map((f) => f.id));
  return arr
    .map((v) => { const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; return { formatoId: str(o.formatoId), para: str(o.para), porque: str(o.porque) }; })
    .filter((r) => ids.has(r.formatoId))
    .slice(0, 8);
}

// ── Generación (envelope {ok}; nunca lanza). IA gratis del cliente. ───────────
export type Uso = { tokens: number; costUsd: number } | null;
export type GenResult = { ok: true; recomendaciones: Recomendacion[]; uso: Uso } | { ok: false; error: string };

export async function recomendarFormatos(): Promise<GenResult> {
  try {
    const [brief, razones, avatares, entregables] = await Promise.all([perfilNegocioTexto(), getRazones(), getAvatares(), getEntregables()]);
    if (razones.length < 1) {
      return { ok: false, error: 'Primero arma tu Matriz de razones: de ahí salen los formatos.' };
    }
    const avNombre = new Map(avatares.map((a) => [a.id, a.nombre]));
    const razonesTexto = razones
      .map((r) => `- [${avNombre.get(r.avatarId) || 'Avatar'} · ${r.nombre}] ${r.copy || r.descripcion}`)
      .join('\n');
    const biblioteca = BIBLIOTECA_ANGULOS.map((f) => `- ${f.id} (${f.medio}) — ${f.nombre}: ${f.descripcion}`).join('\n');
    const sys = await renderPrompt('formatos.system', FORMATOS_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('formatos.user', FORMATOS_USER_TEMPLATE, {
      biblioteca,
      brief,
      gancho: entregables.length ? `\nENTREGABLE TANGIBLE:\n${entregablesTexto(entregables)}\n` : '',
      razones: razonesTexto,
    });
    const errores: string[] = [];
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2200,
      feature: 'angulos-formatos', motivo: 'Elegir formatos de creativo de la biblioteca',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneRecom, erroresOut: errores,
    });
    if (!text) return { ok: false, error: await errorDeCascada(errores, 'elegir los formatos') };
    const recomendaciones = parseRecomendaciones(text);
    if (!recomendaciones.length) return { ok: false, error: 'MaKo no devolvió recomendaciones. Reintenta en un momento.' };
    return { ok: true, recomendaciones, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── IA: elegir el mejor FORMATO por CELDA y MEDIO (imagen o video) ────────────
// A diferencia de recomendarFormatos (que elige un mix a nivel negocio), esto elige
// UN formato para UNA celda de la matriz (un anuncio concreto) y lo persiste en
// celda.anguloImagen / celda.anguloVideo. Es lo que alimenta la tab Imagen/Video del
// pop-up y el ángulo que sigue el guion. Envelope {ok}; nunca lanza.
export type AnguloResult = { ok: true; formatoId: string; formato: FormatoAngulo } | { ok: false; error: string };

export async function elegirAngulo(celdaId: string, medio: Medio, timeoutMs?: number): Promise<AnguloResult> {
  try {
    const razones = await getRazones();
    const celda = razones.find((r) => r.id === celdaId);
    if (!celda) return { ok: false, error: 'Celda no encontrada.' };
    const opciones = BIBLIOTECA_ANGULOS.filter((f) => f.medio === medio);
    const ids = new Set(opciones.map((f) => f.id));
    const [avatares, entregables] = await Promise.all([getAvatares(), getEntregables()]);
    const av = avatares.find((a) => a.id === celda.avatarId);

    const biblioteca = opciones.map((f) => `- ${f.id} — ${f.nombre}: ${f.descripcion}`).join('\n');
    const sys = `Eres MaKo, eligiendo el MEJOR FORMATO de ${medio === 'imagen' ? 'IMAGEN' : 'VIDEO'} para UN anuncio concreto (metodología de Jan). Tienes una biblioteca FIJA de formatos de ${medio}; elige EXACTAMENTE UNO, el que mejor ejecuta ESTE anuncio para ESTE avatar y ESTA motivación de compra, aprovechando el entregable tangible si aplica. NO inventes formatos.
Devuelve EXCLUSIVAMENTE un JSON: {"formatoId":"<uno de los ids>","porque":"<1 frase>"}`;
    const user = `AVATAR: ${av ? `${av.nombre} — ${av.segmento}. Dolor: ${av.dolor}` : '(sin avatar)'}
MOTIVACIÓN DE COMPRA: ${celda.nombre} — ${celda.descripcion}
COPY/HOOK: ${celda.copy || '(sin copy)'}
${entregables.length ? `ENTREGABLE TANGIBLE: ${entregablesTexto(entregables)}\n` : ''}
FORMATOS DE ${medio.toUpperCase()} (elige SOLO uno de estos ids):
${biblioteca}

Devuelve solo el JSON.`;
    const leerId = (t: string): string => { try { return str(parseJsonObject(t).formatoId); } catch { return ''; } };
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 300, timeoutMs,
      feature: 'angulos-formatos', motivo: `Elegir formato de ${medio} para una celda`,
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => ids.has(leerId(t)),
    });
    const formatoId = leerId(text);
    if (!ids.has(formatoId)) return { ok: false, error: `MaKo no eligió un formato de ${medio} válido. Reintenta.` };
    // Releer DESPUÉS de la llamada lenta para no pisar ediciones concurrentes.
    const actuales = await getRazones();
    const campo = medio === 'imagen' ? 'anguloImagen' : 'anguloVideo';
    await setRazones(actuales.map((r) => (r.id === celdaId ? { ...r, [campo]: formatoId } : r)));
    return { ok: true, formatoId, formato: formatoPorId(formatoId)! };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
