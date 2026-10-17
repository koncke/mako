// =============================================================================
// /m/experimentos — se retiró con /experimentos (17/10/2026): en el teléfono, al Dashboard
// =============================================================================
// Los experimentos se piden en «Editar con MaKo» del Dashboard (app/experimentos/page.tsx dice por qué). El teléfono no
// tiene ese panel: el link aterriza en su Dashboard, que es donde se ve la hoja. Con `rutaConWs` (la pestaña del cliente).
// La puerta de la tab que se fue se queda mientras su key siga en la barra (app/experimentos/page.tsx dice por qué).

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { requireMovil } from '@/lib/movil-guard';

export default async function ExperimentosRetiradaM() {
  await requireMovil({ navKey: 'experimentos' });
  redirect(await rutaConWs('/m/dashboard'));
}
