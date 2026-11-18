// =============================================================================
// Los tutoriales de las pestañas: el índice (18/11/2026)
// =============================================================================
// Un archivo por pestaña al lado de éste (lib/tutoriales/<pestana>.ts), y acá se juntan. El motor del recorrido (lo arma el chat
// del onboarding) los lee con `tutorialDe` o `tutorialDeRuta`. tests/tutoriales-pestanas.test.ts comprueba que cada marca que
// pide un paso la ponga algún componente, que el clic vaya sólo en el último paso y que no haya dos tutoriales con la misma ruta.
// Lo que falta de las 34 pestañas (archivos.json de C:/dev/artefactos-pestanas) va sumando su archivo y su línea acá.
// =============================================================================

import { TUTORIAL_AUTOMATIONS } from './automations';
import { TUTORIAL_AVATAR } from './avatar';
import { TUTORIAL_CALENDAR } from './calendar';
import { TUTORIAL_CHATS } from './chats';
import { TUTORIAL_CLASSROOM } from './classroom';
import { TUTORIAL_COPILOT } from './copilot';
import { TUTORIAL_COPYWRITING } from './copywriting';
import { TUTORIAL_CRM } from './crm';
import { TUTORIAL_DASHBOARD } from './dashboard';
import { TUTORIAL_IMAGE } from './image';
import { TUTORIAL_INTEGRACIONES } from './integraciones';
import { TUTORIAL_OFFER } from './offer';
import { TUTORIAL_OPS_CENTER } from './ops-center';
import { TUTORIAL_PLAN } from './plan';
import { TUTORIAL_SETTINGS } from './settings';
import { TUTORIAL_SPY } from './spy';
import { TUTORIAL_TICKETERA } from './ticketera';
import { TUTORIAL_VIDEO } from './video';
import { TUTORIAL_WEB } from './web';
import { TUTORIALES_DE_ADENTRO } from './de-siempre';
import type { TutorialPestana } from './tipos';

export type { LadoPaso, PasoTutorial, TutorialPestana } from './tipos';

/** Todos, en el orden del reto de 7 días (días 1 a 3 primero: Ops Center, Offer, Settings e Integraciones, CRM). */
export const TUTORIALES: readonly TutorialPestana[] = [
  TUTORIAL_OPS_CENTER,
  TUTORIAL_OFFER,
  TUTORIAL_SETTINGS,
  TUTORIAL_INTEGRACIONES,
  TUTORIAL_CRM,
  TUTORIAL_TICKETERA,
  TUTORIAL_CHATS,
  TUTORIAL_CALENDAR,
  TUTORIAL_AUTOMATIONS,
  TUTORIAL_COPILOT,
  TUTORIAL_SPY,
  TUTORIAL_COPYWRITING,
  TUTORIAL_WEB,
  TUTORIAL_PLAN,
  TUTORIAL_DASHBOARD,
  TUTORIAL_CLASSROOM,
  TUTORIAL_AVATAR,
  TUTORIAL_VIDEO,
  TUTORIAL_IMAGE,
  // Los de las pantallas de adentro (con `estado`): los que la app ya tenía, en el formato nuevo (./de-siempre.ts).
  ...TUTORIALES_DE_ADENTRO,
];

export const tutorialDe = (pestana: string): TutorialPestana | null => TUTORIALES.find((t) => t.pestana === pestana) ?? null;

const sinBarra = (r: string) => r.replace(/\/+$/, '') || '/';
/**
 * El tutorial de una ruta (de escritorio o de MaKo Mobile), sin el `#`. Una vista de adentro se nombra con su query (la
 * Ticketera: `/second-brain?ticketera=tickets`) y gana si la ruta la trae; si no, vale la ruta sin el `?`. Sólo los de la entrada
 * de cada pestaña: uno con `estado` lo pide el motor cuando la pantalla llega ahí (`tutorialDe`).
 */
export function tutorialDeRuta(ruta: string): TutorialPestana | null {
  const [camino, query = ''] = ruta.split('#')[0].split('?');
  const deEntrada = TUTORIALES.filter((t) => !t.estado);
  const conQuery = deEntrada.find((t) => t.ruta.includes('?') && query && new URLSearchParams(query).toString().includes(t.ruta.split('?')[1])
    && sinBarra(t.ruta.split('?')[0]) === sinBarra(camino));
  if (conQuery) return conQuery;
  const r = sinBarra(camino);
  return deEntrada.find((t) => (!t.ruta.includes('?') && t.ruta === r) || t.rutaMovil === r) ?? null;
}

/** Los pasos que se muestran en esta versión: en el teléfono, sin los `soloComputadora`. */
export const pasosPara = (t: TutorialPestana, telefono: boolean) => (telefono ? t.pasos.filter((p) => !p.soloComputadora) : t.pasos);
