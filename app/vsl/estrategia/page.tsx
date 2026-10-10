// =============================================================================
// /vsl/estrategia — redirige a la tab de super admin /admin/estrategia
// =============================================================================
// Era el documento interno de oferta y estrategia (revisión del 28/07), público
// por caer bajo '/vsl' (PUBLICOS en lib/rutas-publicas.ts) y con noindex. El
// 10/10/2026 su contenido se mudó a /admin/estrategia, junto con el runway y los
// costos, sólo para super admin.
//
// ⚠️ LA RUTA NO SE BORRA: el link circuló (se le mandó a un consultor) y un 404 es
// peor que un salto. Redirige, y el guard de /admin/* (proxy + getSesionAdmin) se
// encarga de quién la puede ver: quien no es super admin ya no la lee.
//
// ⚠️ '/vsl' SIGUE EN PUBLICOS: tests/acciones-sin-sesion.test.ts exige que esta
// ruta sea pública y de sólo lectura, y un redirect lo cumple.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function EstrategiaVieja() {
  redirect('/admin/estrategia');
}
