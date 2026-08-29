// =============================================================================
// mako-prompts — prompts de MaKo: núcleo fijo (código) + módulos editables
// =============================================================================
// El NÚCLEO (reglas duras) vive acá y NO se edita desde la UI. Los módulos
// (persona/voz + modos del consultor) son editables y versionados (historial +
// restaurar), guardados en app_settings como JSON. Hoy el agente usa la persona;
// los modos quedan listos para cuando existan esos endpoints.

import 'server-only';
import { getSetting, setSetting } from './settings';
import { MAKO_PERSONA } from './mako-persona';
import { REGLA_MARCA } from './mako-gramatica';

// Núcleo FIJO — reglas duras, no editables. (Es el bloque que hoy ya usa el agente.)
export const MAKO_NUCLEO = `REGLAS DE FORMATO Y TONO:
- Markdown: **negritas** para lo clave, viñetas y títulos cortos (##) SOLO cuando ayuden. Nada de muros de texto.
- El PRIMER mensaje breve e impactante (2-4 líneas): lo más importante, no un resumen de todo.
- Muy analítico: piensa a fondo, usa números, comparaciones y relaciones causa-efecto.
- REGLA DURA: NUNCA termines con una pregunta. Cierra con una afirmación, recomendación o próximo paso concreto.
- No inventes datos que no estén; si algo no se puede concluir, decilo.
- ${REGLA_MARCA}
- HIPÓTESIS, NO VERDADES: lo que ves en los datos del dashboard son señales, no verdades probadas. NUNCA declares una relación causa-efecto como conclusión cerrada ("esto funciona", "X bajó por Y"). Enmarca tus lecturas como hipótesis ("el dato sugiere…", "esto apunta a…") y, cuando detectes algo con palanca, CIERRA PROPONIENDO INICIAR UN EXPERIMENTO en la vista de Experimentos para validarlo con datos. Las únicas verdades del negocio viven ahí: si abajo te paso "VERDADES VALIDADAS", ésas sí puedes afirmarlas y citarlas; el resto se prueba, no se asume.`;

export type Modo = { key: string; label: string; def: string };
export const MODOS: Modo[] = [
  { key: 'persona', label: 'Persona / voz', def: MAKO_PERSONA },
  { key: 'analista', label: 'Analista', def: 'Modo análisis de gráficos: mira el dato, encuentra la causa y dale el próximo paso. Números antes que opiniones.' },
  { key: 'comparador', label: 'Comparador', def: 'Modo comparación: contrastá períodos, anuncios o cohortes; resaltá qué cambió y por qué importa.' },
  { key: 'guiones', label: 'Guiones / VSL', def: 'Modo guiones: analizá el creativo (hook, oferta, CTA) y proponé mejoras concretas al guion o al VSL.' },
  { key: 'consultor', label: 'Consultor', def: 'Modo consultor: pensá en orden (oferta → adquisición → sistematización → escala) y decí qué tocar primero.' },
  { key: 'closer', label: 'Leads / Closer', def: 'Modo closer: por qué un lead está trabado y qué decir/hacer en la próxima llamada para avanzarlo.' },
];

const STORE_KEY = 'mako.prompts';
type Stored = { current: string; versions: Array<{ ts: string; text: string }> };
type PromptStore = Record<string, Stored>;

async function readStore(): Promise<PromptStore> {
  const raw = await getSetting(STORE_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as PromptStore; } catch { return {}; }
}

export type PromptModoOut = { key: string; label: string; current: string; isDefault: boolean; versions: Array<{ ts: string; text: string }> };

export async function getPrompts(): Promise<PromptModoOut[]> {
  const store = await readStore();
  return MODOS.map((m) => {
    const s = store[m.key];
    return { key: m.key, label: m.label, current: s?.current ?? m.def, isDefault: !s?.current, versions: s?.versions ?? [] };
  });
}

/** Persona activa para el agente (la guardada, o el default MAKO_PERSONA). */
export async function getActivePersona(): Promise<string> {
  const store = await readStore();
  return store['persona']?.current ?? MAKO_PERSONA;
}

const defOf = (modo: string) => MODOS.find((m) => m.key === modo)?.def ?? '';

export async function savePrompt(modo: string, text: string): Promise<void> {
  if (!MODOS.some((m) => m.key === modo)) throw new Error('modo inválido');
  const store = await readStore();
  const prev = store[modo] ?? { current: defOf(modo), versions: [] };
  // El valor anterior va al historial.
  const versions = [{ ts: new Date().toISOString(), text: prev.current }, ...prev.versions].slice(0, 30);
  store[modo] = { current: text, versions };
  await setSetting(STORE_KEY, JSON.stringify(store));
}

export async function restorePrompt(modo: string, ts: string): Promise<void> {
  const store = await readStore();
  const s = store[modo];
  if (!s) return;
  const v = s.versions.find((x) => x.ts === ts);
  if (!v) return;
  const versions = [{ ts: new Date().toISOString(), text: s.current }, ...s.versions].slice(0, 30);
  store[modo] = { current: v.text, versions };
  await setSetting(STORE_KEY, JSON.stringify(store));
}

/** Vuelve al default del código (borra el override; queda "en default"). */
export async function resetPrompt(modo: string): Promise<void> {
  const store = await readStore();
  if (!(modo in store)) return;
  delete store[modo];
  await setSetting(STORE_KEY, JSON.stringify(store));
}
