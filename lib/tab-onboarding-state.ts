// =============================================================================
// tab-onboarding-state — el onboarding DE CADA TAB (regla del producto)
// =============================================================================
// REGLA: toda tab tiene onboarding. Ninguna tab sirve sin configuración previa,
// así que ninguna se entrega cruda. Metodología completa (las 3 etapas Conectar →
// Contexto → Ensayo y los principios de baja fricción):
//   .claude/skills/tab-onboarding/SKILL.md
//
// Molde copiado de lib/onboarding-state.ts (el onboarding global del cliente),
// con dos diferencias deliberadas:
//   1. NO es bloqueante para toda la app: solo decide si la tab abre en su
//      onboarding o en su vista normal.
//   2. Vive por tab: una key de app_settings por tab, sin tabla ni migración.
//
// El estado además ALIMENTA A MaKo (ver resumenOnboardingTabs): nunca propone
// optimizar una tab que el cliente jamás configuró.

import 'server-only';
import { getSetting, setSetting } from './settings';

export type TabOnboardingStatus = 'pendiente' | 'done';

export type TabOnboardingState = {
  v: 1;
  status: TabOnboardingStatus;
  steps: Record<string, { done: boolean; at?: string }>;
  updated_at: string;
};

/** Definición del onboarding de UNA tab: sus pasos, en orden. */
export type TabOnboardingDef = {
  key: string;          // 'setting' — la key del nav
  titulo: string;       // "Dejemos tu setting listo"
  pasos: Array<{ key: string; label: string }>;
  /**
   * Tabs que DEPENDEN de esta: entrar ahí sin haber terminado este onboarding
   * no tiene sentido, así que se las manda acá. Ej.: /whatsapp y /email no
   * necesitan su propio onboarding — su configuración (canal probado, voz,
   * secuencias) se hace entera en /setting. Una sola puerta de entrada en vez
   * de tres recorridos que piden lo mismo.
   */
  cubre?: string[];
  /** Href al que se manda (default `/${key}`). */
  href?: string;
};

/**
 * Catálogo de onboardings por tab. Agregar una tab = agregar una entrada acá
 * (mismo espíritu que lib/tab-activacion.ts y lib/capas.ts: el dato manda, no
 * un `if` desparramado).
 */
export const TAB_ONBOARDINGS: Record<string, TabOnboardingDef> = {
  setting: {
    key: 'setting',
    titulo: 'Dejemos tu setting listo',
    pasos: [
      { key: 'canales', label: 'Conectar y probar' },
      { key: 'contexto', label: 'Cómo conversás' },
      { key: 'voz', label: 'Tus audios' },
      { key: 'ensayo', label: 'Ensayo con MaKo' },
      { key: 'aprobar', label: 'Aprobar y prender' },
    ],
    // WhatsApp y Email NO tienen onboarding propio: su configuración (conectar y
    // probar el canal, la voz, las secuencias) se hace entera acá. Entrar a esas
    // tabs sin esto hecho manda a /setting — una puerta, no tres recorridos que
    // piden lo mismo.
    cubre: ['whatsapp', 'email'],
  },
};

export const tabOnboardingDef = (key: string): TabOnboardingDef | null => TAB_ONBOARDINGS[key] ?? null;

/**
 * ¿A dónde tiene que ir el usuario antes de usar esta tab? Devuelve el href del
 * onboarding que la cubre (propio o de la tab de la que depende), o null si ya
 * está lista. Lo usan las pages en su guard.
 */
export async function onboardingRequeridoPara(tab: string): Promise<string | null> {
  // Onboarding propio.
  if (tabOnboardingDef(tab) && (await onboardingTabPendiente(tab))) {
    return tabOnboardingDef(tab)!.href ?? `/${tab}`;
  }
  // Onboarding de otra tab que cubre a esta.
  for (const def of Object.values(TAB_ONBOARDINGS)) {
    if (!def.cubre?.includes(tab)) continue;
    if (await onboardingTabPendiente(def.key)) return def.href ?? `/${def.key}`;
  }
  return null;
}

const keyDe = (tab: string) => `onboarding.tab.${tab}`;

function estadoInicial(def: TabOnboardingDef): TabOnboardingState {
  const steps: TabOnboardingState['steps'] = {};
  for (const p of def.pasos) steps[p.key] = { done: false };
  return { v: 1, status: 'pendiente', steps, updated_at: new Date().toISOString() };
}

/** Estado del onboarding de una tab (tolerante: shape viejo o basura → inicial). */
export async function getEstadoTab(tab: string): Promise<TabOnboardingState> {
  const def = tabOnboardingDef(tab);
  if (!def) return { v: 1, status: 'done', steps: {}, updated_at: new Date().toISOString() };
  const base = estadoInicial(def);
  try {
    const raw = await getSetting(keyDe(tab));
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<TabOnboardingState>;
    return {
      ...base,
      ...parsed,
      v: 1,
      status: parsed.status === 'done' ? 'done' : 'pendiente',
      // Merge sobre el esqueleto: si se agregó un paso nuevo, aparece pendiente
      // en vez de romper (y si se sacó uno, deja de contar).
      steps: Object.fromEntries(def.pasos.map((p) => [p.key, parsed.steps?.[p.key] ?? { done: false }])),
    };
  } catch {
    return base;
  }
}

/** Marca un paso hecho (o deshecho). Cierra la tab cuando cae el último. */
export async function marcarPasoTab(tab: string, paso: string, done = true): Promise<TabOnboardingState> {
  const def = tabOnboardingDef(tab);
  if (!def) throw new Error(`La tab "${tab}" no tiene onboarding definido.`);
  if (!def.pasos.some((p) => p.key === paso)) throw new Error(`Paso "${paso}" desconocido en la tab "${tab}".`);
  const s = await getEstadoTab(tab);
  s.steps[paso] = { done, at: new Date().toISOString() };
  s.status = def.pasos.every((p) => s.steps[p.key]?.done) ? 'done' : 'pendiente';
  s.updated_at = new Date().toISOString();
  await setSetting(keyDe(tab), JSON.stringify(s));
  return s;
}

/** Reabrir el onboarding de una tab (para rehacerlo desde la propia tab). */
export async function reabrirOnboardingTab(tab: string): Promise<TabOnboardingState> {
  const def = tabOnboardingDef(tab);
  if (!def) throw new Error(`La tab "${tab}" no tiene onboarding definido.`);
  const s = estadoInicial(def);
  await setSetting(keyDe(tab), JSON.stringify(s));
  return s;
}

/** ¿La tab abre en su onboarding? (no bloquea la app, solo elige la vista). */
export async function onboardingTabPendiente(tab: string): Promise<boolean> {
  if (!tabOnboardingDef(tab)) return false;
  return (await getEstadoTab(tab)).status !== 'done';
}

/**
 * Bloque para el system prompt de MaKo: qué tabs siguen sin configurar. Sin
 * esto, MaKo propone optimizar lo que el cliente nunca configuró. Best-effort:
 * si falla, devuelve '' y el prompt sigue igual.
 */
export async function resumenOnboardingTabs(): Promise<string> {
  try {
    const keys = Object.keys(TAB_ONBOARDINGS);
    if (!keys.length) return '';
    const estados = await Promise.all(keys.map(async (k) => ({ k, s: await getEstadoTab(k) })));
    const pendientes = estados.filter((e) => e.s.status !== 'done');
    if (!pendientes.length) return '';
    const detalle = pendientes.map((e) => {
      const def = TAB_ONBOARDINGS[e.k];
      const faltan = def.pasos.filter((p) => !e.s.steps[p.key]?.done).map((p) => p.label);
      return `- ${def.key}: falta ${faltan.join(', ')}`;
    }).join('\n');
    return `TABS SIN CONFIGURAR (su onboarding no está terminado). Si el usuario pregunta por mejorar algo de estas tabs, lo PRIMERO es que termine de configurarlas — no propongas optimizaciones sobre algo que todavía no está armado:\n${detalle}`;
  } catch {
    return '';
  }
}
