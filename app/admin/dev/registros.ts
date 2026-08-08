// =============================================================================
// El registro de cada área, en un solo lugar
// =============================================================================
// La ruta es dinámica (`/admin/dev/[area]`), así que los datos no se pueden
// importar por variable: el bundler necesita ver los imports. Este archivo es
// esa tabla, y es lo único que hay que tocar para sumar un área — la pantalla
// ya está escrita.

import type { Registro } from './_registro/tipos';
import { PARTES as ONBOARDING_PARTES, BITACORA as ONBOARDING_BITACORA } from './onboarding/bitacora';
import { PARTES as GENERAL_PARTES, BITACORA as GENERAL_BITACORA } from './general/bitacora';
import { PARTES as CHATBOT_PARTES, BITACORA as CHATBOT_BITACORA } from './chatbot/bitacora';
import { PARTES as ADS_PARTES, BITACORA as ADS_BITACORA } from './ads-generator/bitacora';

const REGISTROS: Record<string, Registro> = {
  onboarding: { partes: ONBOARDING_PARTES, bitacora: ONBOARDING_BITACORA },
  general: { partes: GENERAL_PARTES, bitacora: GENERAL_BITACORA },
  chatbot: { partes: CHATBOT_PARTES, bitacora: CHATBOT_BITACORA },
  'ads-generator': { partes: ADS_PARTES, bitacora: ADS_BITACORA },
};

/** Un área sin registro devuelve vacío: la pantalla muestra sus estados vacíos. */
export const registroDe = (slug: string): Registro => REGISTROS[slug] ?? { partes: [], bitacora: [] };
