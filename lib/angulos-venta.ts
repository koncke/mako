// =============================================================================
// angulos-venta — la MATRIZ 3×3 de ángulos (metodología de Jan, "Anuncio Ganador")
// =============================================================================
// El diferencial de la competencia (100ads) es la fábrica de creativos, y el
// primer eslabón son los ÁNGULOS. Un ángulo NO se inventa: se ENCUENTRA en lo que
// el negocio ya dice. Jan lo estructura como una MATRIZ:
//
//   1 producto  ×  3 AVATARES (¿a quién?)  ×  3 RAZONES cada uno  =  9 versiones
//
// Los 3 avatares son las FILAS (lib/avatares.ts). Para CADA avatar, MaKo encuentra
// 3 razones de compra — un DOLOR, un DESEO y una EXPLICACIÓN (mecanismo/encuadre) —
// que son las COLUMNAS. Cada celda = un ángulo listo para volverse creativo: son
// los ~9 anuncios "RECON" que Jan lanza baratos para que el MERCADO elija al ganador.
//
// Patrón "writer" (ver scaffold-mako-writer): genera a pedido y guarda el resultado
// en app_settings. NO persiste por-entidad ni sincroniza.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { chatClaude } from './anthropic';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { getSetting, setSetting } from './settings';
import { getAvatares, avataresTexto, type Avatar } from './avatares';

export type AnguloVenta = { id: string; avatarId: string; razon: string; titulo: string; hook: string; descripcion: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.angulos_venta';
// Las 3 razones de compra de Jan (las COLUMNAS de la matriz). Una por celda.
export const RAZONES = ['Dolor', 'Deseo', 'Explicación'] as const;
export type Razon = (typeof RAZONES)[number];

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// ── Persistencia (por workspace, vía runWithWorkspace del route) ──────────────
export async function getAngulosVenta(): Promise<AnguloVenta[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as AnguloVenta[]).filter((a) => a && a.titulo) : [];
  } catch { return []; }
}
export async function setAngulosVenta(list: AnguloVenta[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

// Normaliza la razón cruda del modelo a una de las 3 columnas.
export function normalizarRazon(crudo: string): Razon {
  const c = crudo.toLowerCase();
  if (c.startsWith('dolor') || c.includes('problema') || c.includes('miedo')) return 'Dolor';
  if (c.startsWith('deseo') || c.includes('aspiraci') || c.includes('sueñ') || c.includes('quiere')) return 'Deseo';
  if (c.startsWith('explica') || c.includes('mecanismo') || c.includes('cómo') || c.includes('encuadre')) return 'Explicación';
  return 'Dolor';
}

// ── Prompt (editable en /configuraciones) ────────────────────────────────────
export const ANGULOS_SYSTEM_TEMPLATE = `Sos MaKo, armando la MATRIZ de ÁNGULOS DE VENTA para los anuncios de Meta de un negocio (metodología de Jan, "Anuncio Ganador"). Un ángulo NO se inventa: se ENCUENTRA en lo que el negocio YA dice. La OFERTA no es el producto: es CÓMO lo explicás. Cada ángulo es la CARNADA (el tráiler), no la película.

Te paso 3 AVATARES ya definidos (subnichos distintos del cliente). Para CADA avatar, encontrá 3 ángulos, uno por cada RAZÓN de compra:
- "Dolor": el problema/miedo concreto que lo tiene atascado HOY.
- "Deseo": lo que quiere lograr, el después que sueña.
- "Explicación": un mecanismo, enemigo o encuadre NUEVO que explica por qué tu oferta lo resuelve (el "no es tu culpa, es que…").

Bajá al DOLOR y al DESEO CONCRETOS de ESE avatar; no repitas el mismo mensaje entre avatares. Son 9 ángulos en total (3 avatares × 3 razones): los anuncios que se van a testear para que el mercado elija al ganador.

Cada ángulo:
- "razon": EXACTAMENTE una de: Dolor, Deseo, Explicación.
- "titulo": el nombre del ángulo, 2-4 palabras, con gancho (ej: "El Silencio Cómplice", "El Cuello de Botella Eres Tú").
- "hook": la PRIMERA línea del anuncio, la que frena el scroll, 5-12 palabras, fuerte y del dolor/deseo real de ESE avatar.
- "descripcion": 2-3 frases — cómo este ángulo le habla a ESE avatar y cómo encuadra la oferta.

REGLAS:
- NO inventes cifras, garantías ni resultados que no estén en el contexto del negocio.
- Aterrizá TODO en los datos reales; nada genérico.
- IDIOMA: "titulo", "hook" y "descripcion" son para la AUDIENCIA del cliente (MÉXICO): español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos (nada de "tenés/querés/subí/mirá").

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera) con esta forma EXACTA. "avatar" es el NÚMERO del avatar (1, 2 o 3) tal como te lo paso:
{"matriz":[{"avatar":1,"angulos":[{"razon":"Dolor","titulo":"","hook":"","descripcion":""},{"razon":"Deseo","titulo":"","hook":"","descripcion":""},{"razon":"Explicación","titulo":"","hook":"","descripcion":""}]}]}`;

export const ANGULOS_USER_TEMPLATE = `CONTEXTO DEL NEGOCIO (datos reales del Archivero):
{{brief}}
{{fase}}
AVATARES (usá EXACTAMENTE estos 3, referencialos por su número):
{{avatares}}

Armá la matriz: para cada avatar, 3 ángulos (un Dolor, un Deseo, una Explicación). Devolvé solo el JSON.`;

// ── Parseo de la matriz → 9 ángulos con avatarId ──────────────────────────────
export function parseAngulos(text: string, avatares: Avatar[]): AnguloVenta[] {
  const raw = parseJsonObject(text);
  const filas = Array.isArray(raw.matriz) ? raw.matriz : [];
  const out: AnguloVenta[] = [];
  for (const fila of filas) {
    const f = (fila && typeof fila === 'object' ? fila : {}) as Record<string, unknown>;
    // El modelo referencia al avatar por número (1-based) o, como fallback, por nombre.
    const num = typeof f.avatar === 'number' ? f.avatar : parseInt(str(f.avatar), 10);
    let av: Avatar | undefined = Number.isFinite(num) ? avatares[num - 1] : undefined;
    if (!av) av = avatares.find((a) => a.nombre.toLowerCase() === str(f.avatar).toLowerCase());
    if (!av) continue;
    const angs = Array.isArray(f.angulos) ? f.angulos : [];
    for (const a of angs.slice(0, 3)) {
      const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
      const titulo = str(o.titulo);
      const hook = str(o.hook).replace(/^["“”']+|["“”']+$/g, '');
      if (!titulo || !hook) continue;
      out.push({ id: randomUUID(), avatarId: av.id, razon: normalizarRazon(str(o.razon)), titulo, hook, descripcion: str(o.descripcion) });
    }
  }
  return out;
}

// ── Generación (envelope {ok}; nunca lanza) ───────────────────────────────────
export type GenResult = { ok: true; angulos: AnguloVenta[]; uso: Uso } | { ok: false; error: string };

export async function generarAngulos(): Promise<GenResult> {
  try {
    const avatares = await getAvatares();
    if (avatares.length < 1) {
      return { ok: false, error: 'Primero define tus avatares: son las filas de la matriz.' };
    }
    const [brief, fase] = await Promise.all([perfilNegocioTexto(), faseNegocioTexto()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen los ángulos.' };
    }
    const sys = await renderPrompt('angulos.system', ANGULOS_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('angulos.user', ANGULOS_USER_TEMPLATE, {
      brief,
      fase: fase ? `\nFASE DEL NEGOCIO (para el tono/urgencia):\n${fase}\n` : '',
      avatares: avataresTexto(avatares),
    });
    let uso: Uso = null;
    const text = await chatClaude(sys, [{ role: 'user', content: user }], {
      thinking: true, effort: 'high', maxTokens: 12000, feature: 'angulos-venta',
      onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
    });
    const angulos = parseAngulos(text, avatares);
    if (!angulos.length) return { ok: false, error: 'MaKo no devolvió ángulos. Reintenta en un momento.' };
    return { ok: true, angulos, uso };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
