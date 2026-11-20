'use client';
// =============================================================================
// EL MOTOR DE LOS TUTORIALES: qué se está señalando ahora (18/11/2026)
// =============================================================================
// Uno solo para toda la app, montado una vez en app/layout.tsx (<MotorTutorial>), y sólo para quien ve el onboarding V2
// (lib/onboarding-v2/revision.ts). Dos cosas puede estar mostrando:
//
//   · EL TUTORIAL DE UNA PESTAÑA (lib/tutoriales): la pantalla se oscurece, se marca cada paso sobre la página de verdad, con su
//     tarjeta («n de N», «Omitir recorrido» abajo a la izquierda, «Atrás» y «Siguiente») y el video chico de Martín. El último
//     paso (`clic`) espera el clic de la persona en lo marcado: «Haz clic en…».
//       mostrarTutorial(tutorialDe('crm'), { alTerminar })
//
//   · UNA MARCA: un solo lugar donde tocar, en vez de un botón de atajo (Martín, 18/11: «Abrir Funnel Coach», «Ver mi reto»…
//     «ese tipo de botones jamás los pongas de esa manera… para que la persona luego sepa dónde tiene que ir a cliquear»).
//       senalarDondeTocar({ sel: '[data-recorrido="sb-funnel"]', titulo, texto, haz: 'Haz clic en Funnel Coach' }, alHacer)
//
// El clic de la persona NO se frena: hace lo suyo (abre el chat, el menú) y el motor se entera en captura.
// =============================================================================
import { useSyncExternalStore } from 'react';
import type { PasoTutorial, TutorialPestana } from '@/lib/tutoriales';

export type MotivoFin = 'fin' | 'omitido';

export type Senal =
  | { tipo: 'tutorial'; id: number; tutorial: TutorialPestana; alTerminar?: (m: MotivoFin) => void;
      /** Otro video en lugar del de la pestaña (la primera vez en el Ops Center, el del recorrido): su último lugar marcado es el cierre. */
      video?: string;
      /** Sin la presentación: arranca en el video (lo pidió un clic, como el «▶» del video del día del reto). */
      directo?: boolean;
      /** La persona tocó lo marcado por una frase del video (su `sel`): el chat del reto lo cuenta como hecho. */
      alTocar?: (sel: string) => void;
      /** EL VIDEO EN SU MENSAJE (20/11, V4 y R57-21): el selector del lugar del chat donde se ve el video mientras ese lugar está a la
       *  vista (el del día del reto). Fuera de la vista (se scrolleó, se navegó), en la esquina. Sin `lugar`, en la esquina. */
      lugar?: string }
  /** Un video que se estaba viendo en su lugar y salió de la vista (o se navegó): sigue flotando abajo a la derecha, desde `desde`. */
  | { tipo: 'video'; id: number; clave: string; titulo: string; desde: number;
      /** Al terminar en la esquina, o al cerrarlo con su X (20/11, D1-03: la marca de Offer Coach del día 1 sale igual). */
      alTerminar?: (m: MotivoFin) => void }
  | { tipo: 'marca'; id: number; paso: PasoTutorial & { haz: string }; alHacer: () => void; alOmitir?: () => void; listo?: string; libre?: boolean;
      /** «{título}: dale play» sobre un video quieto (V5, ./useDalePlay.ts): la tarjeta lleva sólo el título y la X. */
      invita?: boolean;
      /** «Pasa el mouse por…»: pasar el mouse por lo marcado ya cuenta, como el clic (el menú de la foto se abre al pasar; OD-11). */
      pasar?: boolean };

let actual: Senal | null = null;
let n = 0;
const oyentes = new Set<() => void>();
const avisar = () => { for (const f of oyentes) f(); };

/** El tutorial de una pestaña. Reemplaza lo que hubiera (una cosa por vez). */
export function mostrarTutorial(tutorial: TutorialPestana, o?: { alTerminar?: (m: MotivoFin) => void; video?: string; directo?: boolean; alTocar?: (sel: string) => void; lugar?: string }): void {
  actual = { tipo: 'tutorial', id: ++n, tutorial, alTerminar: o?.alTerminar, ...(o?.video ? { video: o.video } : {}), ...(o?.directo ? { directo: true } : {}), ...(o?.alTocar ? { alTocar: o.alTocar } : {}), ...(o?.lugar ? { lugar: o.lugar } : {}) };
  avisar();
}

/**
 * EL VIDEO SIEMPRE A LA VISTA (Martín, 18/11: «si estoy viendo el tutorial y me voy a otro lugar… que aparezca la vista previa
 * chiquitita abajo a la derecha, o si scrolleo en el chat y queda muy arriba… que aparezca también ahí abajito»). Un video que
 * corría en su lugar y salió de la vista sigue aquí, desde donde iba. No pisa un tutorial en curso.
 */
export function reproducirFlotante(clave: string, titulo: string, desde: number, alTerminar?: (m: MotivoFin) => void): void {
  if (actual && actual.tipo !== 'video') return;
  actual = { tipo: 'video', id: ++n, clave, titulo, desde, ...(alTerminar ? { alTerminar } : {}) };
  tiempoFlotante = desde;
  avisar();
}

/**
 * Un solo lugar donde tocar. `alHacer` corre cuando la persona toca lo marcado. Con `listo`, la tarjeta lleva ese botón
 * («Entendido») y lo marcado no hace falta tocarlo. `libre`: sin las tapas alrededor del hueco (el mouse tiene que poder pasar por
 * otro lado: el menú de la foto se cierra si el mouse sale de la foto y no llega al menú).
 */
export function senalarDondeTocar(paso: PasoTutorial & { haz: string }, alHacer: () => void, o?: { alOmitir?: () => void; listo?: string; libre?: boolean; invita?: boolean; pasar?: boolean }): number {
  actual = { tipo: 'marca', id: ++n, paso, alHacer, alOmitir: o?.alOmitir, listo: o?.listo, libre: o?.libre, ...(o?.invita ? { invita: true } : {}), ...(o?.pasar ? { pasar: true } : {}) };
  avisar();
  return n;
}

/** Saca lo de ahora SÓLO si es `id` (lo que pidió quien llama), sin avisarle a nadie: el video del «dale play» salió de la vista. */
export function soltarSenal(id: number): void {
  if (!actual || actual.id !== id) return;
  actual = null;
  avisar();
}

/**
 * Y VUELVE AL CHAT CUANDO SE VE (20/11, F2 de la auditoría: «el cuadrito de la esquina está SÓLO mientras el video del chat no se ve»).
 * El flotante anota en qué segundo va (`anotarTiempoFlotante`); cuando el video de su lugar vuelve a verse, `volverAlChat` cierra
 * el flotante y devuelve ese segundo, para que el del chat siga desde ahí. null si no flota ese video.
 */
let tiempoFlotante = 0;
export function anotarTiempoFlotante(t: number): void { tiempoFlotante = t; }
export function volverAlChat(clave: string): number | null {
  if (!actual || actual.tipo !== 'video' || actual.clave !== clave) return null;
  const t = tiempoFlotante;
  actual = null;
  avisar();
  return t;
}

/**
 * EL CHAT «ONBOARDING» PRESENTA EL RECORRIDO (20/11, OD-05): con su mensaje «Dale play…» (app/second-brain/BienvenidaOpsCenter.tsx),
 * el recorrido lo arranca ese play, no el motor solo (`PrimeraVez`). Lo prende el chat mientras se ve.
 */
let presentaElChat = false;
export function chatPresentaRecorrido(si: boolean): void { presentaElChat = si; }

// Y EL RETO (20/11, OD-09): mientras el chat «Onboarding» escribe «¡Listo tu onboarding…! Tu reto de 7 días tiene su propio chat»,
// la marca al reto (app/second-brain/reto/MarcaAlReto.tsx) espera. Con su propio aviso: `useSenal` no cambia con esto.
let presentaReto = false;
const oyentesReto = new Set<() => void>();
export function chatPresentaReto(si: boolean): void {
  if (presentaReto === si) return;
  presentaReto = si;
  for (const f of oyentesReto) f();
}
export const elChatPresentaElReto = (): boolean => presentaReto;
const suscribirReto = (f: () => void) => { oyentesReto.add(f); return () => { oyentesReto.delete(f); }; };
export function usePresentaReto(): boolean {
  return useSyncExternalStore(suscribirReto, () => presentaReto, () => false);
}
export const elChatPresentaElRecorrido = (): boolean => presentaElChat;

// ¿ES LA REVISIÓN DE MARTÍN? (20/11, la verificación de V10): lo decide el servidor (lib/onboarding-v2/revision.ts → esRevision) y
// lo trae el motor (app/layout.tsx → MotorTutorial); lo leen las placas «Todavía no está grabado» de los coaches y del reto.
let revisionDeMartin = false;
const oyentesRevision = new Set<() => void>();
export function anotarRevision(si: boolean): void {
  if (revisionDeMartin === si) return;
  revisionDeMartin = si;
  for (const f of oyentesRevision) f();
}
const suscribirRevision = (f: () => void): (() => void) => { oyentesRevision.add(f); return () => { oyentesRevision.delete(f); }; };
export function useEsRevision(): boolean {
  return useSyncExternalStore(suscribirRevision, () => revisionDeMartin, () => false);
}

/** Lo que se esté mostrando, fuera. No llama a `alTerminar` (lo cierra quien lo pidió). */
export function cerrarTutorial(): void {
  if (!actual) return;
  actual = null;
  avisar();
}

/** Para el motor: termina lo de ahora y avisa a quien lo pidió. */
export function terminar(id: number, como: MotivoFin | 'hecho'): void {
  const s = actual;
  if (!s || s.id !== id) return;
  actual = null;
  avisar();
  // El video de la esquina avisa a quien lo pidió (D1-03: antes cortaba sin avisar, y el día 1 no marcaba nunca Offer Coach si su
  // video terminaba ahí). Al volver a su mensaje (`volverAlChat`) no termina: no avisa.
  if (s.tipo === 'video') { s.alTerminar?.(como === 'omitido' ? 'omitido' : 'fin'); return; }
  if (s.tipo === 'tutorial') s.alTerminar?.(como === 'omitido' ? 'omitido' : 'fin');
  else if (como === 'omitido') s.alOmitir?.();
  else s.alHacer();
}

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
export function useSenal(): Senal | null {
  return useSyncExternalStore(suscribir, () => actual, () => null);
}
export const senalAhora = (): Senal | null => actual;

// ── La convivencia con la guía de cada pestaña (app/_ui/guia) ──────────────────────────────────────────────────────────
// Para quien ve el motor, la primera vez en una pestaña con tutorial manda el tutorial: la guía no pregunta «¿Quieres que te
// ayude…?» encima (dos cosas hablando a la vez). Lo prende <MotorTutorial> al montarse.
let motorMontado = false;
let rutasConTutorial: ((ruta: string) => boolean) | null = null;
export function motorPresente(si: boolean, conTutorial?: (ruta: string) => boolean): void {
  motorMontado = si;
  rutasConTutorial = si ? conTutorial ?? null : null;
}
/** ¿El motor se ocupa de esta pestaña? (lo pregunta useGuiaDeLaTab antes de su primera vez). */
export function motorSeOcupa(ruta: string): boolean {
  if (!motorMontado) return false;
  if (actual) return true;
  return !!rutasConTutorial?.(ruta);
}
