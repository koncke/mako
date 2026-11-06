// =============================================================================
// /customers → Admin: a dónde va un link viejo de /customers (puro, con test: tests/customers.test.ts)
// =============================================================================
// La tabla es la de los links viejos de /admin (`destinoDeTabViejo`, app/admin/_polar/datos/resumen.ts): una sola, para que
// `/customers?tab=X` y `/admin?tab=X` lleguen al mismo lugar. Lo único propio de /customers: sin `?tab=` (o con uno que no
// existe) abría la lista de los negocios, así que sigue abriendo esa (/admin/customers), con la ficha de `?cliente=` si es un
// número. Vive fuera de page.tsx porque un page.tsx de Next sólo puede exportar lo suyo.

import { destinoDeTabViejo } from '@/app/admin/_polar/datos/resumen';

type Param = string | string[] | undefined;

export function destinoDeCustomers(sp: { tab?: Param; cuenta?: Param; cliente?: Param }): string {
  return destinoDeTabViejo({ ...sp, tab: sp.tab ?? 'customers' }) ?? destinoDeTabViejo({ ...sp, tab: 'customers' }) ?? '/admin/customers';
}
