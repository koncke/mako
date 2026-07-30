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
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';

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

// ── Preguntas personalizadas antes de proponer (por si ya tiene uno específico) ─
export type PreguntaEnt = { pregunta: string; opciones: string[] };
export const ENTREGABLE_PREGUNTAS_TEMPLATE = `Sos MaKo. Antes de proponer el ENTREGABLE tangible del negocio (el elemento CONCRETO que genera FOMO en los ads: un dashboard, una planilla, una metodología con nombre, un checklist, un software), hacé 2 o 3 preguntas CERRADAS y CORTAS al dueño para afinar — por si ya tiene uno específico. Personalizá las preguntas según lo que YA sabés del negocio (usá el contexto). Cada pregunta con 3-4 opciones concretas (el usuario también podrá elegir "Otra").
Ideas de qué preguntar (elegí las más útiles para ESTE negocio): si ya entrega un elemento tangible y de qué tipo; si su método/proceso tiene un nombre propio; en qué formato lo mostraría (dashboard, planilla, documento, software); qué parte de su servicio es la más "mostrable".
REGLAS: aterrizá las preguntas en el negocio real; nada genérico. IDIOMA: español NEUTRO/MEXICANO, de "tú".
Devolvé EXCLUSIVAMENTE un JSON: {"preguntas":[{"pregunta":"","opciones":["","",""]}]}`;
export const ENTREGABLE_PREGUNTAS_USER = `CONTEXTO DEL NEGOCIO:
{{brief}}
{{panorama}}
Hacé 2-3 preguntas cerradas para afinar el entregable. Devolvé solo el JSON.`;

export function parsePreguntasEnt(text: string): PreguntaEnt[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.preguntas) ? raw.preguntas : [];
  return arr
    .map((v) => { const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; return { pregunta: str(o.pregunta), opciones: Array.isArray(o.opciones) ? o.opciones.map(str).filter(Boolean).slice(0, 4) : [] }; })
    .filter((p) => p.pregunta && p.opciones.length >= 2)
    .slice(0, 3);
}

// Fallback ESTÁTICO (sin IA) si la cascada no devuelve preguntas usables. El punto de
// "MaKo siempre pregunta antes de proponer" es que el dueño pueda decir "ya tengo uno
// específico" ANTES de que se le proponga algo genérico — eso no puede depender de que
// el modelo de turno acierte un JSON anidado estricto. Genéricas pero siempre útiles.
const PREGUNTAS_ENT_FALLBACK: PreguntaEnt[] = [
  { pregunta: '¿Ya tienes un entregable tangible específico en mente?', opciones: ['Sí, lo tengo muy claro', 'Tengo una idea, pero no está definida', 'No, que MaKo lo proponga'] },
  { pregunta: 'Si ya lo tienes (o lo imaginas), ¿en qué formato es?', opciones: ['Dashboard o panel', 'Planilla o Excel', 'Documento o checklist', 'Software o app', 'Metodología con nombre propio'] },
];

export async function generarPreguntasEntregable(): Promise<{ ok: true; preguntas: PreguntaEnt[] } | { ok: false; error: string }> {
  try {
    const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen las preguntas.' };
    }
    const sys = await renderPrompt('entregable.preguntas.system', ENTREGABLE_PREGUNTAS_TEMPLATE, {});
    const user = await renderPrompt('entregable.preguntas.user', ENTREGABLE_PREGUNTAS_USER, {
      brief, panorama: panorama.trim() ? `\nPANORAMA:\n${panorama.slice(0, 5000)}\n` : '',
    });
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 1200,
      feature: 'entregable', motivo: 'Preguntas para afinar el entregable',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => parsePreguntasEnt(t).length > 0,
    });
    const preguntas = text ? parsePreguntasEnt(text) : [];
    // La IA no dio preguntas usables (json roto, cascada agotada, etc.) — caemos a las
    // genéricas en vez de saltar directo a generar: el dueño SIEMPRE tiene que poder
    // decir "ya tengo uno" antes de que se le proponga algo.
    return { ok: true, preguntas: preguntas.length ? preguntas : PREGUNTAS_ENT_FALLBACK };
  } catch {
    return { ok: true, preguntas: PREGUNTAS_ENT_FALLBACK };
  }
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
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2000,
      feature: 'entregable', motivo: 'Detectar el entregable tangible de la oferta',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneEntregables,
    });
    if (!text) return { ok: false, error: 'No hay IA para detectar el entregable. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    const entregables = parseEntregables(text);
    if (!entregables.length) return { ok: false, error: 'MaKo no devolvió entregables. Reintenta en un momento.' };
    return { ok: true, entregables, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
