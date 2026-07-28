// =============================================================================
// avatares — el "¿A QUIÉN?" de la metodología de Jan (las FILAS de la matriz)
// =============================================================================
// Jan ("Anuncio Ganador") arranca el anuncio ganador por la primera palanca:
// ¿A QUIÉN le vendo? No a "todos": a 3 SUBNICHOS distintos del cliente ideal, que
// compran por razones DIFERENTES (el que no delega, el que ya intentó y falló, el
// que crece sin control…). Esos 3 avatares son las FILAS de la matriz 3×3; después,
// para cada uno, MaKo encuentra 3 razones (un dolor, un deseo, una explicación) =
// 9 ángulos para testear en RECON.
//
// MaKo PROPONE los 3 avatares desde el brief del Archivero; el cliente los revisa,
// ajusta o regenera. Patrón "writer" (ver scaffold-mako-writer): genera a pedido y
// guarda el resultado en app_settings. NO persiste por-entidad ni sincroniza.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { chatClaude } from './anthropic';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { getSetting, setSetting } from './settings';

export type Avatar = { id: string; nombre: string; descripcion: string; dolor: string; deseo: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.avatares';
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// ── Persistencia (por workspace, vía runWithWorkspace del route) ──────────────
export async function getAvatares(): Promise<Avatar[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Avatar[]).filter((a) => a && a.nombre) : [];
  } catch { return []; }
}
export async function setAvatares(list: Avatar[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

// ── Texto de los avatares (para inyectar en el prompt de ángulos) ─────────────
// Numerado 1..N: los ángulos referencian al avatar por su número (más robusto que
// por nombre). Formato compacto pero con el dolor/deseo, que es lo que da la razón.
export function avataresTexto(avs: Avatar[]): string {
  if (!avs.length) return '';
  return avs
    .map((a, i) => `${i + 1}. ${a.nombre} — ${a.descripcion} · Dolor: ${a.dolor} · Deseo: ${a.deseo}`)
    .join('\n');
}

// ── Prompt (editable en /configuraciones) ────────────────────────────────────
export const AVATARES_SYSTEM_TEMPLATE = `Sos MaKo, definiendo los AVATARES de un negocio para sus anuncios de Meta (metodología de Jan, "Anuncio Ganador"). La primera pregunta del anuncio ganador es ¿A QUIÉN le vendo? La respuesta NO es "a todos": son SUBNICHOS distintos del cliente ideal, que compran por razones DIFERENTES.

Tu tarea: encontrar 3 AVATARES DISTINTOS ENTRE SÍ en lo que el negocio ya dice. No 3 versiones de la misma persona — 3 personas distintas, con un dolor y una situación propias (ej: "el fundador que no delega", "el que ya invirtió en ads y se quemó", "el que crece sin control y se le desarma el equipo").

Cada avatar:
- "nombre": el subnicho en 2-5 palabras, con carácter (ej: "El Fundador Atrapado", "El Que Ya Se Quemó"). NO uses solo un cargo genérico.
- "descripcion": quién es, en una ESCENA concreta y viva, 1-2 frases (qué hace un martes cualquiera, qué lo tiene despierto).
- "dolor": su dolor #1, CONCRETO y específico de ese subnicho (no "quiere crecer").
- "deseo": qué quiere lograr de verdad, en sus palabras.

REGLAS:
- Aterrizá TODO en los datos reales del negocio que te paso; nada de avatares genéricos de manual.
- NO inventes cifras ni datos que no estén en el contexto.
- Los 3 tienen que ser genuinamente DISTINTOS: si dos comparten el mismo dolor, uno sobra.
- IDIOMA: todo el texto es para el equipo del cliente en MÉXICO. Español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos (nada de "tenés/querés/mirá").

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera) con esta forma EXACTA:
{"avatares":[{"nombre":"","descripcion":"","dolor":"","deseo":""}]}`;

export const AVATARES_USER_TEMPLATE = `CONTEXTO DEL NEGOCIO (datos reales del Archivero):
{{brief}}
{{fase}}
Encontrá 3 avatares distintos. Devolvé solo el JSON.`;

// ── Parseo ────────────────────────────────────────────────────────────────────
export function parseAvatares(text: string): Avatar[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.avatares) ? raw.avatares : [];
  return arr
    .slice(0, 3)
    .map((v) => {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      return { id: randomUUID(), nombre: str(o.nombre), descripcion: str(o.descripcion), dolor: str(o.dolor), deseo: str(o.deseo) };
    })
    .filter((a) => a.nombre);
}

// ── Generación (envelope {ok}; nunca lanza) ───────────────────────────────────
export type GenResult = { ok: true; avatares: Avatar[]; uso: Uso } | { ok: false; error: string };

export async function generarAvatares(): Promise<GenResult> {
  try {
    const [brief, fase] = await Promise.all([perfilNegocioTexto(), faseNegocioTexto()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero carga tu negocio en El Archivero: de ahí salen los avatares.' };
    }
    const sys = await renderPrompt('avatares.system', AVATARES_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('avatares.user', AVATARES_USER_TEMPLATE, {
      brief,
      fase: fase ? `\nFASE DEL NEGOCIO (para el tono/urgencia):\n${fase}\n` : '',
    });
    let uso: Uso = null;
    const text = await chatClaude(sys, [{ role: 'user', content: user }], {
      thinking: true, effort: 'high', maxTokens: 8000, feature: 'avatares',
      onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
    });
    const avatares = parseAvatares(text);
    if (!avatares.length) return { ok: false, error: 'MaKo no devolvió avatares. Reintenta en un momento.' };
    return { ok: true, avatares, uso };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
