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
// La condición del orden vive aparte, SIN server-only, para que se pueda testear.
import { pasoBloqueadoPor } from './onboarding-orden';
export { pasoBloqueadoPor };

export type TabOnboardingStatus = 'pendiente' | 'done';

export type TabOnboardingState = {
  v: 1;
  status: TabOnboardingStatus;
  steps: Record<string, { done: boolean; at?: string }>;
  updated_at: string;
};

// El catálogo vive aparte y SIN `server-only`, para que sus dos reglas que
// fallan en silencio —el prefijo de las keys y el orden de los pasos— tengan
// test. Se re-exporta para que nada de lo que ya lo importaba cambie.
export { TAB_ONBOARDINGS, type TabOnboardingDef } from './tab-onboarding-catalogo';
// ⚠️ El VALOR y el TIPO se importan aparte del re-export: un `export … from` NO
// crea binding local, asi que este archivo dejaba de compilar aunque el
// re-export fuera correcto. Es el gotcha que AGENTS.md ya tiene escrito.
import { TAB_ONBOARDINGS, type TabOnboardingDef } from './tab-onboarding-catalogo';

/**
 * Los pasos que aparecen en más de un onboarding. Conectar el WhatsApp desde la
 * tab WhatsApp tiene que contar también adentro del Chat Agent: es el MISMO
 * número, no dos configuraciones. Por eso, además del estado por tab, cada paso
 * hecho se anota en un registro compartido del workspace y al leer se cruzan
 * los dos. Sin esto, el cliente escanearía el mismo QR dos veces.
 */
const KEY_PASOS_COMPARTIDOS = 'onboarding.tab.pasos';

async function pasosCompartidos(): Promise<Record<string, string>> {
  try {
    const raw = await getSetting(KEY_PASOS_COMPARTIDOS);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, string>;
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}

async function anotarPasoCompartido(paso: string, done: boolean): Promise<void> {
  const actual = await pasosCompartidos();
  if (done) actual[paso] = new Date().toISOString();
  else delete actual[paso];
  await setSetting(KEY_PASOS_COMPARTIDOS, JSON.stringify(actual));
}

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
  const compartidos = await pasosCompartidos();
  let parsed: Partial<TabOnboardingState> = {};
  try {
    const raw = await getSetting(keyDe(tab));
    if (raw) parsed = JSON.parse(raw) as Partial<TabOnboardingState>;
  } catch { /* estado ilegible: se arranca del esqueleto */ }

  // Un paso vale si lo marcó ESTA tab o si ya lo hizo otra: es la misma
  // configuración vista desde dos puertas.
  const steps = Object.fromEntries(def.pasos.map((p) => {
    const propio = parsed.steps?.[p.key];
    if (propio?.done) return [p.key, propio];
    const at = compartidos[p.key];
    return [p.key, at ? { done: true, at } : { done: false }];
  })) as TabOnboardingState['steps'];

  // Solo los pasos que bloquean deciden si la tab está lista.
  const todo = def.pasos.filter((p) => !p.opcional).every((p) => steps[p.key]?.done);
  return {
    ...base,
    ...parsed,
    v: 1,
    // El status se RECALCULA: si otra tab completó lo que faltaba, esta ya está.
    status: parsed.status === 'done' || todo ? 'done' : 'pendiente',
    steps,
  };
}

/** Marca un paso hecho (o deshecho). Cierra la tab cuando cae el último. */
export async function marcarPasoTab(tab: string, paso: string, done = true): Promise<TabOnboardingState> {
  const def = tabOnboardingDef(tab);
  if (!def) throw new Error(`La tab "${tab}" no tiene onboarding definido.`);
  if (!def.pasos.some((p) => p.key === paso)) throw new Error(`Paso "${paso}" desconocido en la tab "${tab}".`);

  // ⚠️ NO SE PUEDE SALTEAR UN PASO. Antes esto aceptaba cualquier clave, así que
  // el wizard cerraba el onboarding entero marcando el último paso — pasó en
  // vivo, con una clienta delante: marcó `ensayo` y `aprobar` con diez segundos
  // de diferencia, sin haber grabado un audio, la tab quedó `done` y le apareció
  // el dashboard vacío en vez del onboarding.
  //
  // El guard va en el SERVER y no en el botón: la UI ya deshabilitaba «Siguiente»
  // y aun así se llegó acá. Los pasos `opcional` no bloquean (para eso existe
  // «Omitir por ahora»), y desmarcar (`done: false`) nunca se frena.
  if (done) {
    const estadoPrevio = await getEstadoTab(tab);
    const falta = pasoBloqueadoPor(def.pasos, estadoPrevio.steps, paso);
    if (falta) {
      const label = def.pasos.find((p) => p.key === falta)?.label ?? falta;
      throw new Error(`Antes de este paso falta completar «${label}».`);
    }
  }

  await anotarPasoCompartido(paso, done);
  const s = await getEstadoTab(tab);
  s.steps[paso] = { done, at: new Date().toISOString() };
  s.status = def.pasos.filter((p) => !p.opcional).every((p) => s.steps[p.key]?.done) ? 'done' : 'pendiente';
  s.updated_at = new Date().toISOString();
  await setSetting(keyDe(tab), JSON.stringify(s));
  return s;
}

/**
 * El INVERSO de marcarPasoTab, para cuando la condición que cerró un paso deja
 * de ser cierta — el caso real: el cliente desvinculó su WhatsApp y el paso
 * "conectá tu número" seguía en verde.
 *
 * Recorre TODAS las tabs que contienen el paso, no solo el registro compartido:
 * `getEstadoTab` deja ganar al estado propio de cada tab, así que limpiar solo
 * el compartido dejaba el paso vivo en la tab por la que el cliente configuró.
 */
export async function desmarcarPasoEnTodasLasTabs(paso: string): Promise<void> {
  for (const def of Object.values(TAB_ONBOARDINGS)) {
    if (!def.pasos.some((p) => p.key === paso)) continue;
    await marcarPasoTab(def.key, paso, false);
  }
}

/** Reabrir el onboarding de una tab (para rehacerlo desde la propia tab). */
export async function reabrirOnboardingTab(tab: string): Promise<TabOnboardingState> {
  const def = tabOnboardingDef(tab);
  if (!def) throw new Error(`La tab "${tab}" no tiene onboarding definido.`);
  const s = estadoInicial(def);
  // También se sueltan los pasos compartidos de esta tab: rehacer el onboarding
  // de WhatsApp tiene que volver a pedir el QR, no darlo por hecho.
  const compartidos = await pasosCompartidos();
  for (const p of def.pasos) delete compartidos[p.key];
  await setSetting(KEY_PASOS_COMPARTIDOS, JSON.stringify(compartidos));
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
      const faltan = def.pasos.filter((p) => !p.opcional && !e.s.steps[p.key]?.done).map((p) => p.label);
      return `- ${def.key}: falta ${faltan.join(', ')}`;
    }).join('\n');
    return `TABS SIN CONFIGURAR (su onboarding no está terminado). Si el usuario pregunta por mejorar algo de estas tabs, lo PRIMERO es que termine de configurarlas — no propongas optimizaciones sobre algo que todavía no está armado:\n${detalle}`;
  } catch {
    return '';
  }
}
