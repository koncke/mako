// =============================================================================
// Los tutoriales de las pestañas: el índice (18/11/2026)
// =============================================================================
// Un archivo por pestaña al lado de éste (lib/tutoriales/<pestana>.ts), y acá se juntan. El motor del recorrido (lo arma el chat
// del onboarding) los lee con `tutorialDe` o `tutorialDeRuta`. tests/tutoriales-pestanas.test.ts comprueba que cada marca que
// pide un paso la ponga algún componente, que el clic vaya sólo en el último paso y que no haya dos tutoriales con la misma ruta.
// Lo que falta (las 34 pestañas, archivos.json de C:/dev/artefactos-pestanas) va sumando su archivo y su línea acá.
// =============================================================================

import { TUTORIAL_CRM } from './crm';
import { TUTORIAL_INTEGRACIONES } from './integraciones';
import { TUTORIAL_OFFER } from './offer';
import { TUTORIAL_OPS_CENTER } from './ops-center';
import { TUTORIAL_SETTINGS } from './settings';
import type { TutorialPestana } from './tipos';

export type { LadoPaso, PasoTutorial, TutorialPestana } from './tipos';

/** Todos, en el orden del reto de 7 días (días 1 a 3 primero). */
export const TUTORIALES: readonly TutorialPestana[] = [
  TUTORIAL_OPS_CENTER,
  TUTORIAL_OFFER,
  TUTORIAL_SETTINGS,
  TUTORIAL_INTEGRACIONES,
  TUTORIAL_CRM,
];

export const tutorialDe = (pestana: string): TutorialPestana | null => TUTORIALES.find((t) => t.pestana === pestana) ?? null;

/** El tutorial de una ruta (de escritorio o de MaKo Mobile), sin el `?` ni el `#`. */
export function tutorialDeRuta(ruta: string): TutorialPestana | null {
  const r = ruta.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return TUTORIALES.find((t) => t.ruta === r || t.rutaMovil === r) ?? null;
}

/** Los pasos que se muestran en esta versión: en el teléfono, sin los `soloComputadora`. */
export const pasosPara = (t: TutorialPestana, telefono: boolean) => (telefono ? t.pasos.filter((p) => !p.soloComputadora) : t.pasos);
