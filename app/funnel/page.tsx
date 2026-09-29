// =============================================================================
// /funnel → /crm  (la ruta se retiró; las etapas se editan en el pop-up del CRM)
// =============================================================================
// Pedido de Martín (28/09/2026): «Quiero eliminar la ruta de funnel, que todo se edite
// como un pop-up dentro del mismo CRM. Así es más simple».
//
// ⚠️ SE REDIRIGE, NO SE BORRA. `/funnel` estaba enlazada desde ocho lugares, y uno de
// ellos es el panel de tracking que ve el CLIENTE en su propia landing («Activar la
// landing como entrada de leads»): un 404 ahí es peor que la pantalla vieja. Los links
// internos se apuntaron a su destino nuevo en el mismo commit; esto cubre los que viven
// afuera del repo — un marcador, un aviso ya mandado por WhatsApp, un mail viejo.
//
// ⚠️ Y `FunnelEditor` / `EntradasCard` SIGUEN EXISTIENDO, en esta misma carpeta. Lo que
// se retira es la RUTA, no los componentes: los montan /onboarding y /second-brain, que
// es donde se configura el negocio entero (las entradas, las transiciones, las
// nutriciones suprimidas). Next sólo hace ruta de un `page.tsx`, así que dejarlos acá no
// resucita nada.
//
// El `?f=` se traduce a `?funnel=`, que es como lo nombra el CRM. Y va con `rutaConWs`:
// un `redirect()` pelado pierde la pestaña del cliente que el super admin está mirando.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function FunnelRedirect({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const id = Number(f);
  // Un id que no es un número se ignora: el CRM abre el funnel del negocio. Y uno que sí
  // lo es lo valida igual la página del CRM contra los funnels de ESTE workspace.
  const destino = Number.isInteger(id) && id > 0 ? `/crm?funnel=${id}` : '/crm';
  redirect(await rutaConWs(destino));
}
