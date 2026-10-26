'use client';

// Las pestañas de Customers (25/10/2026): viajan en `?tab=`, que lee el server (app/customers/page.tsx). Un link copiado
// abre la misma pestaña, y «Atrás» vuelve a la anterior.

import { Tabs } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';

export type PestanaCustomers = 'customers' | 'billing' | 'agents';

export function PestanasCustomers({ activa }: { activa: PestanaCustomers }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={[{ id: 'customers', label: 'Customers' }, { id: 'billing', label: 'Billing' }, { id: 'agents', label: 'Agents' }]}
      activa={activa}
      onCambio={(id) => router.push(id === 'customers' ? '/customers' : `/customers?tab=${id}`)}
    />
  );
}
