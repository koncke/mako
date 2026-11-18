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
      alTocar?: (sel: string) => void }
  /** Un video que se estaba viendo en su lugar y salió de la vista (o se navegó): sigue flotando abajo a la derecha, desde `desde`. */
  | { tipo: 'video'; id: number; clave: string; titulo: string; desde: number }
  | { tipo: 'marca'; id: number; paso: PasoTutorial & { haz: string }; alHacer: () => void; alOmitir?: () => void; listo?: string; libre?: boolean };

let actual: Senal | null = null;
let n = 0;
const oyentes = new Set<() => void>();
const avisar = () => { for (const f of oyentes) f(); };

/** El tutorial de una pestaña. Reemplaza lo que hubiera (una cosa por vez). */
export function mostrarTutorial(tutorial: TutorialPestana, o?: { alTerminar?: (m: MotivoFin) => void; video?: string; directo?: boolean; alTocar?: (sel: string) => void }): void {
  actual = { tipo: 'tutorial', id: ++n, tutorial, alTerminar: o?.alTerminar, ...(o?.video ? { video: o.video } : {}), ...(o?.directo ? { directo: true } : {}), ...(o?.alTocar ? { alTocar: o.alTocar } : {}) };
  avisar();
}

/**
 * EL VIDEO SIEMPRE A LA VISTA (Martín, 18/11: «si estoy viendo el tutorial y me voy a otro lugar… que aparezca la vista previa
 * chiquitita abajo a la derecha, o si scrolleo en el chat y queda muy arriba… que aparezca también ahí abajito»). Un video que
 * corría en su lugar y salió de la vista sigue aquí, desde donde iba. No pisa un tutorial en curso.
 */
export function reproducirFlotante(clave: string, titulo: string, desde: number): void {
  if (actual && actual.tipo !== 'video') return;
  actual = { tipo: 'video', id: ++n, clave, titulo, desde };
  avisar();
}

/**
 * Un solo lugar donde tocar. `alHacer` corre cuando la persona toca lo marcado. Con `listo`, la tarjeta lleva ese botón
 * («Entendido») y lo marcado no hace falta tocarlo. `libre`: sin las tapas alrededor del hueco (el mouse tiene que poder pasar por
 * otro lado: el menú de la foto se cierra si el mouse sale de la foto y no llega al menú).
 */
export function senalarDondeTocar(paso: PasoTutorial & { haz: string }, alHacer: () => void, o?: { alOmitir?: () => void; listo?: string; libre?: boolean }): void {
  actual = { tipo: 'marca', id: ++n, paso, alHacer, alOmitir: o?.alOmitir, listo: o?.listo, libre: o?.libre };
  avisar();
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
  if (s.tipo === 'video') return;
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
