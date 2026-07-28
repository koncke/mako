// =============================================================================
// gancho — el ELEMENTO TANGIBLE de la oferta (el que genera FOMO en los ads)
// =============================================================================
// Casi todo servicio tiene (o puede tener) un elemento CONCRETO y TANGIBLE que hace
// que la oferta se entienda rápido y genere CURIOSIDAD/FOMO en los anuncios: un
// dashboard, una planilla de Excel, un documento, una metodología con nombre. Ej de
// Mauricio: instala DASHBOARDS con sus clientes; MaKo con su software. Ese "gancho"
// permite copys como "si tus empleados no cumplen sus objetivos es porque te falta
// ESTE dashboard". OJO: NO es el "hook" de un guion (primera línea del video) — es el
// MECANISMO tangible del que después cuelgan los ganchos de los anuncios.
//
// MaKo propone 1-3 candidatos desde el brief; el cliente los revisa/edita. Corre con
// la IA gratis del cliente (Gemini). Patrón "writer": genera a pedido, guarda en
// app_settings, NO sincroniza por-entidad.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { getPanorama } from './archivero';
import { getSetting, setSetting } from './settings';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';

// Un gancho tangible:
//  · tipo  = qué clase de elemento es (Dashboard, Excel, Documento, Metodología…).
//  · queEs = qué es concretamente y qué resuelve.
//  · fomo  = una línea estilo anuncio que usa el gancho para generar curiosidad/FOMO.
export type Gancho = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.gancho';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const tieneGanchos = (t: string): boolean => parseGanchos(t).length > 0;

function normalizarGancho(v: unknown): Gancho {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { id: str(o.id) || randomUUID(), nombre: str(o.nombre), tipo: str(o.tipo), queEs: str(o.queEs) || str(o['que_es']), fomo: str(o.fomo) };
}

// ── Persistencia (por workspace, vía runWithWorkspace del route) ──────────────
export async function getGanchos(): Promise<Gancho[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(normalizarGancho).filter((g) => g.nombre) : [];
  } catch { return []; }
}
export async function setGanchos(list: Gancho[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

/** Texto de los ganchos para inyectar en otros prompts (razones/ángulos → FOMO). */
export function ganchosTexto(gs: Gancho[]): string {
  if (!gs.length) return '';
  return gs.map((g) => `- ${g.nombre} (${g.tipo}): ${g.queEs}`).join('\n');
}

// ── Prompt (editable en /configuraciones) ────────────────────────────────────
export const GANCHO_SYSTEM_TEMPLATE = `Sos MaKo, encontrando el GANCHO de un negocio: su elemento TANGIBLE y CONCRETO que hace que la oferta se entienda rápido y genere CURIOSIDAD/FOMO en los anuncios de Meta. NO es un sentimiento ni una promesa: es una COSA que el cliente entrega o usa (un dashboard, una planilla de Excel, un documento, una metodología CON NOMBRE, un software, un checklist, una plantilla).

Ejemplos del concepto: "instala un DASHBOARD de objetivos con cada cliente" → permite el copy "si tus empleados no cumplen sus objetivos es porque te falta ESTE dashboard". Una "metodología de 4 pasos con nombre propio" también sirve.

Encontrá 1 a 3 GANCHOS candidatos para ESTE negocio (según lo que ya dice el brief). Si el negocio no menciona uno claro, PROPONÉ el más plausible que podría crear/mostrar (y decilo natural). Cada gancho:
- "nombre": el nombre del elemento tangible, corto y concreto (ej: "Dashboard de Objetivos por Empleado", "Planilla de Escala 90 días").
- "tipo": qué clase de elemento es. UNO de: Dashboard, Planilla Excel, Documento, Metodología, Software, Checklist, Plantilla, Otro.
- "queEs": qué es concretamente y qué resuelve, en 1-2 frases claras.
- "fomo": UNA línea estilo anuncio que use el gancho para generar CURIOSIDAD/FOMO en el espectador (concreta, del dolor real; ej: "Si tu equipo no cumple sus metas, no es falta de ganas: es que no tienen ESTE tablero a la vista todos los días.").

REGLAS:
- Aterrizá TODO en el negocio real del brief; nada genérico.
- NO inventes resultados ni cifras que no estén en el contexto.
- IDIOMA: español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos.

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera) con esta forma EXACTA:
{"ganchos":[{"nombre":"","tipo":"","queEs":"","fomo":""}]}`;

export const GANCHO_USER_TEMPLATE = `CONTEXTO DEL NEGOCIO (datos reales del Archivero):
{{brief}}
{{panorama}}
Encontrá 1-3 ganchos tangibles. Devolvé solo el JSON.`;

// ── Parseo ────────────────────────────────────────────────────────────────────
export function parseGanchos(text: string): Gancho[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.ganchos) ? raw.ganchos : [];
  return arr.slice(0, 3).map(normalizarGancho).filter((g) => g.nombre);
}

// ── Generación (envelope {ok}; nunca lanza). IA gratis del cliente. ───────────
export type GenResult = { ok: true; ganchos: Gancho[]; uso: Uso } | { ok: false; error: string };

export async function generarGanchos(): Promise<GenResult> {
  try {
    const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí sale el gancho.' };
    }
    const sys = await renderPrompt('gancho.system', GANCHO_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('gancho.user', GANCHO_USER_TEMPLATE, {
      brief,
      panorama: panorama.trim() ? `\nPANORAMA (lo que MaKo entendió del negocio):\n${panorama.slice(0, 6000)}\n` : '',
    });
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2000,
      feature: 'gancho', motivo: 'Detectar el gancho tangible de la oferta',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneGanchos,
    });
    if (!text) return { ok: false, error: 'No hay IA para detectar el gancho. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    const ganchos = parseGanchos(text);
    if (!ganchos.length) return { ok: false, error: 'MaKo no devolvió ganchos. Reintenta en un momento.' };
    return { ok: true, ganchos, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
