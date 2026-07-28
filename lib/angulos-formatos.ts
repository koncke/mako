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
import { getRazones } from './razones';
import { getAvatares } from './avatares';
import { getEntregables, entregablesTexto } from './entregable';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';

export type Medio = 'imagen' | 'video';
export type FormatoAngulo = { id: string; nombre: string; medio: Medio; descripcion: string; ejemplo: string };

// ── LA BIBLIOTECA (fija; la IA elige de acá) ─────────────────────────────────
export const BIBLIOTECA_ANGULOS: FormatoAngulo[] = [
  // ── Imagen ──
  { id: 'comparacion', medio: 'imagen', nombre: 'Comparación', descripcion: 'Dos columnas: esto vs aquello (con vos vs sin vos, tu método vs el común).', ejemplo: 'Izq: "Equipo sin tablero" caótico · Der: "Equipo con el Dashboard" ordenado.' },
  { id: 'testimonio-capturas', medio: 'imagen', nombre: 'Testimonio con capturas', descripcion: 'Capturas reales de mensajes (WhatsApp/DM) de un cliente contento.', ejemplo: 'Screenshot de un cliente: "esto me cambió el negocio", con contexto arriba.' },
  { id: 'antes-despues', medio: 'imagen', nombre: 'Antes y después', descripcion: 'El estado inicial vs el resultado, lado a lado o en una tira.', ejemplo: 'Antes: números en rojo · Después: mismos números en verde.' },
  { id: 'screenshot-resultado', medio: 'imagen', nombre: 'Captura de un resultado', descripcion: 'La foto de un resultado real y concreto (un dashboard, un número, un reporte).', ejemplo: 'Screenshot del dashboard mostrando el objetivo cumplido.' },
  { id: 'checklist', medio: 'imagen', nombre: 'Lista / checklist', descripcion: 'Una lista corta de puntos que el espectador quiere cumplir (o teme no cumplir).', ejemplo: '"5 señales de que tu equipo no está alineado" con checks.' },
  { id: 'stat-impactante', medio: 'imagen', nombre: 'Dato que frena el scroll', descripcion: 'Un número o estadística fuerte y visual que interrumpe.', ejemplo: '"El 70% de los equipos no sabe su objetivo de la semana."' },
  { id: 'carrusel-pasos', medio: 'imagen', nombre: 'Carrusel de pasos', descripcion: 'Varias placas mostrando el cómo funciona / el paso a paso del mecanismo.', ejemplo: 'Placa 1: el problema → 2: el gancho → 3: el resultado.' },
  // ── Video ──
  { id: 'hook-problema', medio: 'video', nombre: 'Hook de problema', descripcion: 'Arranca hablando directo al dolor, a cámara, sin intro.', ejemplo: '"Si tu equipo no cumple sus metas, no es falta de ganas…"' },
  { id: 'testimonio-hablado', medio: 'video', nombre: 'Testimonio hablado', descripcion: 'El cliente cuenta su antes/después a cámara, natural.', ejemplo: 'Cliente: "en 60 días pasamos de X a Y".' },
  { id: 'demo-walkthrough', medio: 'video', nombre: 'Demo / recorrido', descripcion: 'Se muestra el producto o el entregable funcionando (screen o en vivo).', ejemplo: 'Recorrido del dashboard: acá ves quién cumple y quién no.' },
  { id: 'explicacion-mecanismo', medio: 'video', nombre: 'Explicación del mecanismo', descripcion: 'Explica POR QUÉ funciona tu método (el "no es tu culpa, es que…").', ejemplo: 'Pizarra/talking-head explicando el porqué del sistema.' },
  { id: 'dia-en-la-vida', medio: 'video', nombre: 'Un día en la vida', descripcion: 'Muestra el día del cliente con vs sin la solución.', ejemplo: 'Lunes sin el sistema (caos) vs con el sistema (control).' },
  { id: 'reaccion-caso', medio: 'video', nombre: 'Reacción a un caso', descripcion: 'Reaccionás/comentás sobre una captura o un caso real de un cliente.', ejemplo: 'Mostrás el chat de un cliente y explicás qué pasó.' },
  { id: 'mini-vsl', medio: 'video', nombre: 'Mini-VSL', descripcion: 'Carta de venta corta en video: problema → mecanismo → oferta → CTA.', ejemplo: '60-90s que cierran con una invitación clara.' },
];

export function formatoPorId(id: string): FormatoAngulo | undefined {
  return BIBLIOTECA_ANGULOS.find((f) => f.id === id);
}

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
export const FORMATOS_SYSTEM_TEMPLATE = `Sos MaKo, eligiendo los mejores FORMATOS de creativo para los anuncios de un negocio. Tenés una BIBLIOTECA FIJA de formatos (imagen y video); NO inventes formatos nuevos: solo ELEGÍS de la biblioteca los que mejor le sirven a ESTE negocio, según sus razones de compra y su gancho tangible.

Para cada recomendación:
- "formatoId": EXACTAMENTE uno de los IDs de la biblioteca que te paso (no otro).
- "para": a qué caso del negocio le sirve — el avatar y/o la razón de compra (ej: "Avatar 'Dueño de retail', razón Dolor").
- "porque": 1 frase concreta de por qué ese formato encaja con ese caso y este negocio (usá el gancho si aplica).

Elegí entre 4 y 6 recomendaciones, MEZCLANDO imagen y video, cubriendo distintos avatares/razones. Priorizá los formatos que aprovechen el GANCHO tangible del negocio (ej: si hay un dashboard, "screenshot-resultado" o "demo-walkthrough" lucen).

REGLAS:
- Usá SOLO IDs de la biblioteca. Aterrizá el "para"/"porque" en el negocio real.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo argentino.

Devolvé EXCLUSIVAMENTE un objeto JSON válido con esta forma EXACTA:
{"recomendaciones":[{"formatoId":"","para":"","porque":""}]}`;

export const FORMATOS_USER_TEMPLATE = `BIBLIOTECA DE FORMATOS (elegí SOLO de estos IDs):
{{biblioteca}}

NEGOCIO:
{{brief}}
{{gancho}}RAZONES DE COMPRA (la matriz avatar × razón):
{{razones}}

Elegí los mejores formatos de la biblioteca para este negocio. Devolvé solo el JSON.`;

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
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2200,
      feature: 'angulos-formatos', motivo: 'Elegir formatos de creativo de la biblioteca',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneRecom,
    });
    if (!text) return { ok: false, error: 'No hay IA para elegir los formatos. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    const recomendaciones = parseRecomendaciones(text);
    if (!recomendaciones.length) return { ok: false, error: 'MaKo no devolvió recomendaciones. Reintenta en un momento.' };
    return { ok: true, recomendaciones, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
