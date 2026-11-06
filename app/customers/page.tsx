// =============================================================================
// /customers — se fue a Admin (5/11/2026), que desde el 6/11/2026 es la copia del dashboard de Polar
// =============================================================================
// Martín: «la tab que hoy en día se llama Customer dentro de Super Admin, que se llame Admin directamente». La tab vive en
// /admin (app/admin/(polar)/), con sus secciones por ruta. Esta ruta queda como redirect, con su `?tab=`, `?cuenta=` y
// `?cliente=`: está en marcadores, en mails ya mandados («Quieren entrar») y en links de avisos. El destino sale de la MISMA
// tabla de los links viejos de /admin (`destinoDeTabViejo`, app/admin/_polar/datos/resumen.ts). Sin `?tab=` (o con uno que
// no existe), /customers abría la lista de los negocios: sigue abriendo esa (/admin/customers), con su ficha si trae
// `?cliente=` o `?cuenta=` (según su tab, como `destinoDeTabViejo`). Lo que no es un número se cae (es un id).
//
// ⚠️ EL GUARD VA ANTES DEL REDIRECT, como en /admin/cobros: un redirect no se le ofrece a cualquiera. `/customers` sigue en
//    `SOLO_ADMIN` del proxy.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { destinoDeTabViejo } from '@/app/admin/_polar/datos/resumen';

export const dynamic = 'force-dynamic';

type Param = string | string[] | undefined;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ tab?: Param; cuenta?: Param; cliente?: Param }> }) {
  if (!(await getSesionAdmin())) redirect('/inicio');
  const sp = await searchParams;
  redirect(destinoDeTabViejo({ ...sp, tab: sp.tab ?? 'customers' }) ?? destinoDeTabViejo({ ...sp, tab: 'customers' }) ?? '/admin/customers');
}
