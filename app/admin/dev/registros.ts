// =============================================================================
// El registro de cada área, en un solo lugar
// =============================================================================
// La ruta es dinámica (`/admin/dev/[area]`), así que los datos no se pueden
// importar por variable: el bundler necesita ver los imports. Este archivo es
// esa tabla, y es lo único que hay que tocar para sumar un área — la pantalla
// ya está escrita.

import type { Registro } from './_registro/tipos';
import { PARTES as ADMIN_PARTES, BITACORA as ADMIN_BITACORA } from './admin/bitacora';
import { PARTES as ONBOARDING_PARTES, BITACORA as ONBOARDING_BITACORA } from './onboarding/bitacora';
import { PARTES as GENERAL_PARTES, BITACORA as GENERAL_BITACORA } from './general/bitacora';
import { PARTES as CHATBOT_PARTES, BITACORA as CHATBOT_BITACORA } from './chatbot/bitacora';
import { PARTES as ADS_PARTES, BITACORA as ADS_BITACORA } from './ads-writer/bitacora';
import { PARTES as SEMAFORO_PARTES, BITACORA as SEMAFORO_BITACORA } from './semaforo/bitacora';
import { PARTES as PRICING_PARTES, BITACORA as PRICING_BITACORA } from './pricing/bitacora';
import { PARTES as PRODUCTOS_PARTES, BITACORA as PRODUCTOS_BITACORA } from './products-offers/bitacora';

const REGISTROS: Record<string, Registro> = {
  admin: { partes: ADMIN_PARTES, bitacora: ADMIN_BITACORA },
  onboarding: { partes: ONBOARDING_PARTES, bitacora: ONBOARDING_BITACORA },
  general: { partes: GENERAL_PARTES, bitacora: GENERAL_BITACORA },
  chatbot: { partes: CHATBOT_PARTES, bitacora: CHATBOT_BITACORA },
  'ads-writer': { partes: ADS_PARTES, bitacora: ADS_BITACORA },
  semaforo: { partes: SEMAFORO_PARTES, bitacora: SEMAFORO_BITACORA },
  pricing: { partes: PRICING_PARTES, bitacora: PRICING_BITACORA },
  'products-offers': { partes: PRODUCTOS_PARTES, bitacora: PRODUCTOS_BITACORA },
};

/** Un área sin registro devuelve vacío: la pantalla muestra sus estados vacíos. */
export const registroDe = (slug: string): Registro => REGISTROS[slug] ?? { partes: [], bitacora: [] };

/**
 * Los slugs que tienen bitácora escrita a mano. Existe para que
 * `tests/dev-areas.test.ts` no mantenga su propia lista: la tenía, se quedó vieja
 * sola (`pricing` faltaba) y el test pasaba en verde igual.
 */
export const REGISTROS_SLUGS = Object.keys(REGISTROS);
