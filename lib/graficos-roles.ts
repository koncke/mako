// =============================================================================
// La capa (la tab) que cada rol con hoja única del Dashboard necesita para ver su hoja
// =============================================================================
// El closer ve SÓLO la hoja Closing y el setter SÓLO la hoja Chat Analyst (`HOJA_DE_ROL`, en
// lib/graficos-plantillas.ts, que toma de acá la capa de cada uno). Vive aparte porque también lo lee
// lib/movil-rutas.ts, que viaja al navegador en CADA página (DesvioMovil está en el layout raíz):
// importar las plantillas ahí metería el catálogo entero en todos los bundles.
// Sin `server-only`: lo leen el server, el teléfono y los tests.

export const CAPA_DE_HOJA_DE_ROL = { closer: 'closing', setter: 'whatsapp' } as const;

/** La capa que el rol necesita para su hoja única, o null (el admin, o un rol sin hoja única). */
export const capaDeHojaDeRol = (rol: unknown): string | null =>
  rol === 'closer' || rol === 'setter' ? CAPA_DE_HOJA_DE_ROL[rol] : null;
