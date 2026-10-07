// =============================================================================
// url-ficha — la URL de /customer-success con la ficha abierta (`?cliente=<leadId>`)
// =============================================================================
// Pura y sin `'use client'` ni `server-only`: la llama el efecto de ClientesApp y la EJECUTA
// tests/cs-kanban-ficha-ui.test.ts. ClientesApp no se puede importar desde un test (arrastra
// las server actions), así que la cuenta que decide qué queda en la URL vive acá.
//
// ⚠️ EL PARÁMETRO ES EL DEL PLAN (`PARAM_CLIENTE`): es el mismo dato —«este cliente»— en dos
// pantallas, y dos strings a mano son dos oportunidades de que uno diga `client`. Lo que se
// LEE está en `leerClienteDeUrl` (el mismo archivo), que lo usa page.tsx en el server.

import { PARAM_CLIENTE } from '@/app/plan/board/filtro-cliente';

/**
 * La misma URL con `?cliente=` puesto (o sacado, con `null`).
 *
 * ⚠️ SE PARTE DE LA QUERY QUE YA HAY, NUNCA SE ARMA DE CERO: ahí viaja el `?ws=` del super
 * admin o de la agencia, y perderlo es terminar mirando otra cuenta (AGENTS.md, «cinco
 * formas de navegar»). El `#` también se conserva.
 */
export function hrefConFicha(
  url: { pathname: string; search: string; hash: string },
  leadId: number | null,
): string {
  const sp = new URLSearchParams(url.search);
  if (leadId != null) sp.set(PARAM_CLIENTE, String(leadId)); else sp.delete(PARAM_CLIENTE);
  const qs = sp.toString();
  return url.pathname + (qs ? `?${qs}` : '') + url.hash;
}
