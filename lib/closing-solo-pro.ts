// =============================================================================
// closing-solo-pro — el análisis de las llamadas de venta (Closing Analyst) es SÓLO de MaKo Pro (14/11/2026, puro)
// =============================================================================
// La tabla de planes lo vende como de Pro desde el 23/10 (`TABS_SOLO_PRO`, 'closing-analyst', lib/topes-plan.ts; la fila
// «Análisis de tus llamadas de venta con IA», lib/planes-comparacion.ts) y NINGÚN código lo frenaba: el Esencial veía la
// hoja entera. `SOLO_PRO_FUERA_DE_LA_BARRA` (lib/plan-esencial-reglas.ts) decía que su candado «va en el Dashboard», y nadie
// lo había puesto. Lo decide el plan del negocio (`esEsencialDeLaSesion` / `esEsencialDe(ctx.ws)`); ante la duda, pasa.
//
// DÓNDE SE HACE CUMPLIR:
//   · la hoja «Closing» del Dashboard (app/dashboard/page.tsx → EditorInforme): el candado EN LUGAR de los gráficos, sin
//     pedir sus datos. Es la hoja con `plantilla: 'closing'` (`esHojaClosing`, app/dashboard/aviso-closing.ts), la misma
//     que abre /closing (que redirige) y la ÚNICA del closer;
//   · la misma hoja en el teléfono (/m/dashboard/[hoja]), sin «Pasa a Pro» (el teléfono no vende, T5);
//   · las rutas HTTP de la hoja (app/api/closing/puerta.ts: la ficha de una llamada, sincronizar, re-analizar, revisar y su
//     transcript) y «Analizar llamadas» de la ficha del lead en el CRM (app/api/closing/analizar-lead): 403 con el texto;
//   · la API de MaKo: las operaciones del área `closing` que leen o escriben el ANÁLISIS (lib/api-mako/areas/closing.run.ts).
// LO QUE QUEDA ABIERTO, a propósito (`OPERACIONES_CLOSING_ABIERTAS`): engancharle grabaciones a un lead y las grabaciones del
// botón «Grabar» de la ficha (Cold Calling). Son del CRM y del grabador de reuniones, no del análisis.
// =============================================================================

/** Qué es, en las palabras con que se vende (la línea de Pro de /planes). */
export const QUE_ES_CLOSING = 'Qué mejorar en cada llamada de venta';

/** El candado de la hoja (el mismo molde que `textoSoloPro`, lib/topes-plan.ts), con «Pasar a Pro» al lado. */
export const TEXTO_CLOSING_SOLO_PRO = `${QUE_ES_CLOSING} es de MaKo Pro. Pasa a Pro para usarlo.`;

/** En el teléfono: de qué plan es, sin vender. */
export const TEXTO_CLOSING_SOLO_PRO_TELEFONO = `${QUE_ES_CLOSING} es de MaKo Pro.`;

/**
 * Las operaciones del área `closing` de la API que NO son el análisis (las grabaciones del CRM): quedan en los dos planes. El
 * transcript de una llamada NO está acá: se pide desde el análisis («cuando el análisis no alcanza»), como su ruta de la hoja.
 */
export const OPERACIONES_CLOSING_ABIERTAS: ReadonlySet<string> = new Set([
  'adjuntar_grabaciones_fathom', 'grabaciones_en_mako_de_un_lead', 'como_termino_grabacion',
]);
