import 'server-only';

// =============================================================================
// resumen-ficha-config — lo que ESTE negocio eligió mostrar en el Resumen del lead
// =============================================================================
// Vive en `app_settings` del workspace: es del negocio (lo decide el admin y lo ve todo el
// equipo). El catálogo y los defaults, en lib/resumen-ficha.ts.
//
// ⚠️ SI LA LECTURA FALLA, VALEN LOS DEFAULTS. Es lo que se veía antes de que esto existiera.
// =============================================================================

import { getSetting, setSetting } from './settings';
import { sanearResumen, type ResumenElegido } from './resumen-ficha';

export const KEY_RESUMEN_FICHA = 'crm.resumen.campos';

export async function resumenDelNegocio(): Promise<ResumenElegido> {
  try {
    const crudo = await getSetting(KEY_RESUMEN_FICHA);
    return crudo ? sanearResumen(JSON.parse(crudo)) : {};
  } catch (e) {
    console.warn('[resumen-ficha] no se pudo leer qué muestra el negocio:', e instanceof Error ? e.message : e);
    return {};
  }
}

export async function guardarResumen(v: unknown): Promise<ResumenElegido> {
  const limpio = sanearResumen(v);
  await setSetting(KEY_RESUMEN_FICHA, JSON.stringify(limpio));
  return limpio;
}
