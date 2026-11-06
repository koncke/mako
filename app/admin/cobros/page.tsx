// =============================================================================
// /admin/cobros — se fue a Admin › Billing (25/10/2026; era Customers)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 12): «Elimina la tab de "https://hola-mako.com/admin/cobros"... para eso ya
// vamos a tener la nueva vista». Lo que mostraba (vender un plan, los precios en la moneda de la Mercado Pago de MaKo, el
// precio del cliente de agencia y lo cobrado) vive desde el 6/11/2026 en la copia de Polar: Sales (lo cobrado), Products ›
// Checkout Links (vender un plan) y Settings › Payments (los precios). Este redirect va a Sales.
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
  redirect('/admin/sales');
}
