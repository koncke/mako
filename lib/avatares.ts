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
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';

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
{{panorama}}{{fase}}
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
    const [brief, fase, panorama] = await Promise.all([perfilNegocioTexto(), faseNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen los avatares.' };
    }
    const sys = await renderPrompt('avatares.system', AVATARES_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('avatares.user', AVATARES_USER_TEMPLATE, {
      brief,
      panorama: panorama.trim() ? `\nPANORAMA (lo que MaKo entendió del negocio):\n${panorama.slice(0, 6000)}\n` : '',
      fase: fase ? `\nFASE DEL NEGOCIO (para el tono/urgencia):\n${fase}\n` : '',
    });
    // IA GRATIS del cliente (Gemini primero, luego Groq/…), NO Claude: esto es
    // "encontrar segmentos", no copywriting fino. `validar` rescata si un modelo
    // devuelve JSON roto. maxTokens holgado: 3 avatares × 5 campos.
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 2600,
      feature: 'avatares', motivo: 'Definir 3 avatares segmentables del negocio',
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: tieneAvatares,
    });
    if (!text) return { ok: false, error: 'No hay IA para generar los avatares. Conecta tu API key de Gemini (gratis) en Integraciones.' };
    const avatares = parseAvatares(text);
    if (!avatares.length) return { ok: false, error: 'MaKo no devolvió avatares. Reintenta en un momento.' };
    return { ok: true, avatares, uso: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
