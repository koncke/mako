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

/** Definición del onboarding de UNA tab: sus pasos, en orden. */
export type TabOnboardingDef = {
  key: string;          // 'setting' — la key del nav
  titulo: string;       // "Dejemos tu setting listo"
  /**
   * `opcional`: el paso se muestra y se puede hacer, pero NO bloquea la tab. El
   * método oficial de WhatsApp y el email son mejoras, no requisitos — obligar a
   * pasar por ellos dejaba a un cliente con su número ya vinculado sin poder
   * entrar a su propio inbox.
   */
  pasos: Array<{ key: string; label: string; opcional?: boolean }>;
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
  // ── WhatsApp: conectar y probar los dos métodos ──
  // Vive en su tab porque es donde el cliente llega buscando WhatsApp. Los
  // mismos pasos aparecen dentro del Chat Agent cuando elige "configurar todo":
  // no se repiten, se comparten (ver PASOS_COMPARTIDOS).
  whatsapp: {
    key: 'whatsapp',
    titulo: 'Configuración de WhatsApp',
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'wa_no_oficial_prueba', label: 'Verificación' },
      // Lo que NO bloquea, al final: se puede dejar para después.
      { key: 'wa_oficial', label: 'WhatsApp oficial', opcional: true },
      { key: 'wa_oficial_plantilla', label: 'Tu primera plantilla', opcional: true },
      { key: 'wa_oficial_prueba', label: 'Verificación del oficial', opcional: true },
    ],
  },

  // ── Email: el canal de los que no contestan por WhatsApp ──
  email: {
    key: 'email',
    titulo: 'Configuración del email',
    // Acá NO son opcionales: son los únicos pasos de la tab. Lo son dentro del
    // Chat Agent, donde el email es una mejora sobre un canal que ya funciona.
    pasos: [
      { key: 'email_conectar', label: 'Tu email' },
      { key: 'email_prueba', label: 'Verificación del email' },
    ],
  },

  // ── Chat Agent: la cabeza. Necesita al menos un canal vivo ──
  // ORDEN (regla en .claude/skills/tab-onboarding): lo aburrido al final,
  // EXCEPTO lo que bloquea. El WhatsApp de empresa sí bloquea: el paso de
  // contexto lee las conversaciones reales de ese número, así que sin él no hay
  // nada que leer.
  setting: {
    key: 'setting',
    titulo: 'Configuración del Chat Agent',
    pasos: [
      { key: 'wa_no_oficial', label: 'Tu WhatsApp' },
      { key: 'wa_no_oficial_prueba', label: 'Verificación' },
      { key: 'contexto', label: 'Tu forma de escribir' },
      { key: 'voz', label: 'Tus audios' },
      { key: 'ensayo', label: 'Ensayo de conversación' },
      { key: 'aprobar', label: 'Tus secuencias de mensajes' },
      { key: 'wa_oficial', label: 'WhatsApp oficial', opcional: true },
      { key: 'wa_oficial_plantilla', label: 'Tu primera plantilla', opcional: true },
      { key: 'wa_oficial_prueba', label: 'Verificación del oficial', opcional: true },
      { key: 'email_conectar', label: 'Tu email', opcional: true },
      { key: 'email_prueba', label: 'Verificación del email', opcional: true },
    ],
    href: '/chatbot',
  },

  // ── Instagram: decidir la cuenta de Zernio, conectar, contexto y ensayo ──
  // ORDEN: acá lo aburrido (Zernio y el OAuth) va PRIMERO porque bloquea de
  // verdad — sin la decisión de Zernio tomada no hay API con la que hablar, y
  // sin cuenta conectada el inbox y el compositor no tienen nada que mostrar
  // (la excepción prevista por la regla de la skill). Los dos primeros pasos NO
  // se marcan a mano: se derivan de señales reales (estado vivo, no recordado) —
  // `zernio` de la key BYOK propia o de la fila en zernio_workspace, `conectar`
  // de los facts de la cuenta que devuelve Zernio. El contexto no pide nada
  // nuevo: muestra lo que la app ya sabe del negocio. El ensayo previsualiza el
  // borrador del chatbot con un DM simulado.
  instagram: {
    key: 'instagram',
    titulo: 'Configuración de Instagram',
    pasos: [
      { key: 'zernio', label: 'Conexión con Zernio' },
      { key: 'conectar', label: 'Tu cuenta de Instagram' },
      { key: 'contexto', label: 'Contexto del negocio' },
      { key: 'ensayo', label: 'Ensayo de respuesta' },
    ],
  },

  // ── Carousels (Content Machine): escribir no necesita la cuenta conectada ──
  // Orden estándar de la skill (lo aburrido al final… y acá ni siquiera al
  // final): conectar Instagram NO bloquea —los guiones se escriben igual y la
  // cuenta recién hace falta al PUBLICAR, que vive en /instagram— así que el
  // paso es opcional y la tab solo lo muestra como aviso con link. El ensayo se
  // marca solo desde la primera pieza generada (patrón landing-an: la tab se
  // configura usándola).
  // ⚠️ Keys con prefijo `carousels_` a propósito: 'contexto'/'ensayo' a secas
  // COLISIONAN vía KEY_PASOS_COMPARTIDOS con el Chat Agent y con Instagram
  // (gotcha conocido, ver el def de instagram) — un paso que NO es la misma
  // configuración no comparte key.
  carousels: {
    key: 'carousels',
    titulo: 'Configuración de Carousels',
    pasos: [
      { key: 'carousels_instagram', label: 'Tu cuenta de Instagram', opcional: true },
      { key: 'carousels_contexto', label: 'Contexto del negocio' },
      { key: 'carousels_ensayo', label: 'Tu primer carrusel' },
    ],
  },

  // ── Reels: el writer de guiones se configura usándose ──
  // ORDEN (regla de la skill): el valor primero, la plomería al final. Escribir
  // guiones NO exige la cuenta conectada, así que `conectar` es OPCIONAL y va
  // último: es el MISMO paso de la tab instagram (registro compartido) — si la
  // cuenta ya se conectó allá, acá aparece hecho, y publicar el borrador es lo
  // único que la necesita. Los otros dos pasos van con keys namespaced
  // (`reels_*`) a propósito: las keys peladas `contexto`/`ensayo` ya COLISIONAN
  // entre instagram y setting vía el registro compartido (gotcha conocido) y no
  // son la misma configuración que esta tab.
  // `reels_contexto` se deriva del perfil del negocio (estado vivo, lo marca la
  // page al detectarlo); `reels_ensayo` lo marca la primera pieza generada.
  reels: {
    key: 'reels',
    titulo: 'Configuración de Reels',
    pasos: [
      { key: 'reels_contexto', label: 'Contexto del negocio' },
      { key: 'reels_ensayo', label: 'Tu primer guion' },
      { key: 'conectar', label: 'Tu cuenta de Instagram', opcional: true },
    ],
  },

  // ── Landing Analyst: la única tab que se configura USÁNDOLA ──
  // No hay credencial que pedir ni contexto que redactar: el funnel y el perfil
  // ya están cargados, y el "ensayo" ES el primer análisis. Por eso el paso que
  // bloquea es analizar una página, y se marca solo desde analizarLanding().
  // El seguimiento es opcional a propósito: sin él MaKo diagnostica el copy
  // igual — lo que suma es poder cruzarlo con lo que hace la gente.
  'landing-an': {
    key: 'landing-an',
    titulo: 'Configuración del Landing Analyst',
    pasos: [
      { key: 'analizar', label: 'Tu primera página analizada' },
      { key: 'seguimiento', label: 'Seguimiento puesto en la landing', opcional: true },
    ],
    href: '/landing-analyst',
  },

  // ── Landing Generator: se prende escribiendo la primera página ──
  'landing-writer': {
    key: 'landing-writer',
    titulo: 'Configuración del Landing Generator',
    pasos: [
      { key: 'generar', label: 'Tu primera versión escrita' },
      { key: 'guardar', label: 'Una versión guardada', opcional: true },
    ],
    href: '/landing-generator',
  },

  // ── Stories: el writer de secuencias de stories ──
  // `conectar` es OPCIONAL a propósito: escribir el guion de un día de stories
  // no necesita la cuenta de Instagram — publicarlo sí, y eso pasa en
  // /instagram. Y es EL MISMO paso `conectar` de la tab instagram (registro
  // compartido de KEY_PASOS_COMPARTIDOS): si la cuenta ya se conectó allá, acá
  // aparece hecho solo — es la misma cuenta, no dos configuraciones. Esta tab
  // NUNCA lo marca por su cuenta (se deriva del estado vivo de /instagram).
  // Los otros dos pasos van namespaced (stories_*) adrede: unos `contexto` /
  // `ensayo` pelados colisionarían vía el registro compartido con instagram y
  // con el Chat Agent, y terminar el ensayo de Stories marcaría «Ensayo de
  // conversación» del Chat Agent como hecho (el gotcha ya documentado de
  // KEY_PASOS_COMPARTIDOS).
  stories: {
    key: 'stories',
    titulo: 'Configuración de Stories',
    pasos: [
      { key: 'conectar', label: 'Tu cuenta de Instagram', opcional: true },
      { key: 'stories_contexto', label: 'Contexto del negocio' },
      { key: 'stories_ensayo', label: 'Tu primera secuencia' },
    ],
  },
};

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
