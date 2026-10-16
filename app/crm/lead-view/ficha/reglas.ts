// =============================================================================
// ficha/reglas — las reglas de TODOS los bloques con componente, juntas (puro)
// =============================================================================
// Cada tab tiene las suyas en su archivo (./reglas-<tab>.ts), así los frentes de la tanda B2 no se pisan.
// Un bloque se registra en el archivo de su tab PRINCIPAL (`def.tab` del catálogo), una sola vez: lo
// fija tests/ficha-armador.test.ts.
// =============================================================================

import type { BloqueId } from '@/lib/ficha/catalogo';
import type { ReglasBloque, ReglasDeTab } from './tipos';
import { REGLAS_RESUMEN } from './reglas-resumen';
import { REGLAS_REUNIONES } from './reglas-reuniones';
import { REGLAS_TRACKING } from './reglas-tracking';
import { REGLAS_PAGOS } from './reglas-pagos';
import { REGLAS_CS } from './reglas-cs';

/** Las reglas de cada tab, por el nombre de su archivo (el test cruza cada una con su tab del catálogo). */
export const REGLAS_POR_ARCHIVO: Readonly<Record<'resumen' | 'reuniones' | 'tracking' | 'pagos' | 'cs', ReglasDeTab>> = {
  resumen: REGLAS_RESUMEN, reuniones: REGLAS_REUNIONES, tracking: REGLAS_TRACKING, pagos: REGLAS_PAGOS, cs: REGLAS_CS,
};

export const REGLAS: ReglasDeTab = { ...REGLAS_RESUMEN, ...REGLAS_REUNIONES, ...REGLAS_TRACKING, ...REGLAS_PAGOS, ...REGLAS_CS };

/** Las reglas de un bloque CON componente, o undefined (no se dibuja ni se ofrece). */
export const reglasDe = (id: BloqueId): ReglasBloque | undefined => REGLAS[id];
