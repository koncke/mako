// =============================================================================
// /admin/cobros — se fue a Customers › Billing (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 12): «Elimina la tab de "https://hola-mako.com/admin/cobros"... para eso ya
// vamos a tener la nueva vista». Lo que mostraba (vender un plan, los precios en la moneda de la Mercado Pago de MaKo, el
// precio del cliente de agencia y lo cobrado) vive en app/admin/cobros/Contenido.tsx y lo monta Admin › Billing (/admin?tab=billing; era /customers, 5/11/2026).
// La ruta queda como redirect: el super admin la tiene en marcadores y en links ya mandados.
//
// ⚠️ EL GUARD ES EL DE /admin/estrategia: el rol de AGENCIA (getSesionAdmin), no `rol_ws` —que vale 'admin' para el dueño
// de CADA workspace y abriría esto a todos los clientes—. Va primero también acá: un redirect no se le ofrece a cualquiera.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function CobrosPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  redirect('/admin?tab=billing');
}
