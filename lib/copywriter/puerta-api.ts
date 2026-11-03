// =============================================================================
// copywriter/puerta-api — la puerta del Copywriter para la API de MaKo (lib/api-mako/areas/copywriter.run.ts)
// =============================================================================
// Hasta el 28/10/2026 la API andaba sólo en el negocio de la plataforma, como la pantalla (sólo el super admin). Desde el
// 29/10 la tab Copywriting de todos los negocios ES el Copywriter (lib/copywriter/puerta.ts), así que la API también: lo
// que queda es el gating de cada operación (`gating.tab` y la capa del negocio). Si hubiera que volver a cerrarla, se
// cierran las DOS (ésta y puerta.ts). Aparte de acceso.ts para que los runners no carguen next/navigation.
// =============================================================================

import 'server-only';


export async function veCopywriterEnApi(ws: number): Promise<boolean> {
  void ws;
  return true;
}
