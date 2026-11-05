'use client';

// Las pestañas de Admin (5/11/2026; eran las de Customers): viajan en `?tab=`, que lee el server (app/admin/page.tsx). Un link
// copiado abre la misma pestaña, y «Atrás» vuelve a la anterior.

import { Tabs } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { SelectorVista } from '@/app/_ui/SelectorVista';
import { PESTANAS_BARRA, ROTULO_PESTANA_ADMIN, pestanaDeBarra, rutaPestanaAdmin, type PestanaAdmin } from './pestanas-reglas';

export function PestanasAdmin({ activa }: { activa: PestanaAdmin }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={PESTANAS_BARRA.map((id) => ({ id, label: ROTULO_PESTANA_ADMIN[id] }))}
      activa={pestanaDeBarra(activa)}
      onCambio={(id) => router.push(rutaPestanaAdmin(id as PestanaAdmin))}
      // Los negocios tienen dos vistas: la lista con su ficha (Customers) y la grilla de administración (Accounts). Va a la
      // derecha de la fila, en el MISMO lugar en las dos (AGENTS.md).
      extra={activa === 'customers' || activa === 'accounts' ? (
        <SelectorVista vistas={['tabla', 'tarjetas'] as const} vista={activa === 'accounts' ? 'tarjetas' : 'tabla'} ariaLabel="Cómo ver los negocios"
          onVista={(v) => router.push(rutaPestanaAdmin(v === 'tarjetas' ? 'accounts' : 'customers'))} />
      ) : undefined}
    />
  );
}
