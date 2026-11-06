// =============================================================================
// /customers — se fue a Admin (5/11/2026)
// =============================================================================
// Martín: «la tab que hoy en día se llama Customer dentro de Super Admin, que se llame Admin directamente». La tab vive en
// /admin (app/admin/page.tsx), con las mismas pestañas y Revenue adelante. Esta ruta queda como redirect, con su `?tab=`,
// `?cuenta=` y `?cliente=` (`destinoDeCustomers`): está en marcadores, en mails ya mandados («Quieren entrar») y en links de
// avisos. La pantalla de los negocios vive en app/admin/clientes (la de Studio, 6/11/2026).
//
// ⚠️ EL GUARD VA ANTES DEL REDIRECT, como en /admin/cobros: un redirect no se le ofrece a cualquiera. `/customers` sigue en
//    `SOLO_ADMIN` del proxy.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { destinoDeCustomers } from '@/app/admin/pestanas-reglas';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ tab?: string; cuenta?: string; cliente?: string }> }) {
  if (!(await getSesionAdmin())) redirect('/inicio');
  redirect(destinoDeCustomers(await searchParams));
}
