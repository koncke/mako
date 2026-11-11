// =============================================================================
// Lead Magnet ARCHIVADO (11/11/2026, pedido de Martín)
// =============================================================================
// Martín, 11/11/2026, textual: «en la parte de lead magnet sácalo… guárdalo o archívalo… pero no lo quiero en producción.
// Porque no está bien construido… luego en un momento lo haremos bien».
//
// NADA SE BORRÓ: la pantalla (app/lead-magnet-generator/, app/m/lead-magnet-generator/), su ruta (/api/lead-magnet-generator),
// lo que arma (lib/lead-magnets/) y su área de la API de MaKo (lib/api-mako/areas/leadmagnet.*) siguen enteros. Este interruptor
// los apaga para TODOS, también para el super admin:
//   · la fila «Lead Magnet» de la barra (app/_components/nav.ts) y, con ella, la del «More» del teléfono;
//   · la pantalla y la del teléfono → 404 (app/lead-magnet-generator/puerta.ts, app/m/lead-magnet-generator/page.tsx);
//   · su ruta → 404 (`puertaLeadMagnetsApi`);
//   · el link público de un lead magnet → 404 (app/compartido/[token]/page.tsx; el 11/11 no había ni uno);
//   · sus operaciones en la API de MaKo: no se ven ni se confirman (`gatingOk`, lib/api-mako/registro.ts);
//   · lo que MaKo ofrece (lib/funciones-mako.ts) y los botones que llevaban ahí: «Crear el regalo» del Marketing CoPilot va al
//     Copywriter (lib/media-buyer/copiloto.ts) y «Este se armó en Lead Magnet» del Second Brain no se muestra.
// Lo de la base no se tocó (el 11/11: 0 lead magnets y 0 links compartidos).
//
// Para rehacerlo y volver a abrirlo: `LEAD_MAGNET_EN_PRODUCCION = true`. Con eso vuelve todo tal cual estaba, incluida su puerta
// de «sólo la plataforma» (puerta.ts), que es aparte. El test: tests/lead-magnet-archivado.test.ts.
// Sin `server-only` a propósito: lo lee la barra, que corre en el navegador.
// =============================================================================

/** ¿Lead Magnet está en producción? Apagado por pedido de Martín (11/11/2026), para rehacerlo bien. */
export const LEAD_MAGNET_EN_PRODUCCION: boolean = false;

/** La key de la tab (nav.ts, la puerta, el gating de la API). */
export const NAV_LEAD_MAGNET = 'lead-magnet-generator';
