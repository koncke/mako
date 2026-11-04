// =============================================================================
// /newsletters — Sales Machine · Newsletter: los suscriptos (un CRM) y las ediciones
// =============================================================================
// Aprobado por Martín el 29/10/2026 («Sí, armalo así»). La primera pintada se arma en el server (app/newsletters/estado.ts)
// y la pantalla es app/newsletters/NewslettersApp.tsx; el modelo, en lib/newsletter-reglas.ts.
// `?edicion=<id>` abre esa edición (es el link del Calendario).
// Sólo el super admin entra mientras esté en PRONTO (./puerta.ts): sacarla de ahí para todos es la decisión del go-live del
// email, que es de Martín.

import { puertaNewsletter } from './puerta';
import { Pagina } from '@/app/_ui';
import { leerEstadoNewsletter } from './estado';
import { NewslettersApp } from './NewslettersApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ edicion?: string }> }) {
  await puertaNewsletter();
  const sp = await searchParams;
  const edicion = Number(sp.edicion);
  const estado = await leerEstadoNewsletter();
  return (
    <Pagina>
      <NewslettersApp inicial={estado} edicionInicial={Number.isSafeInteger(edicion) && edicion > 0 ? edicion : null} />
    </Pagina>
  );
}
