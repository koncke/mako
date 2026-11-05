'use client';

// Las pestañas de Admin (5/11/2026; eran las de Customers): viajan en `?tab=`, que lee el server (app/admin/page.tsx). Un link
// copiado abre la misma pestaña, y «Atrás» vuelve a la anterior.

import { Tabs } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { PESTANAS_ADMIN, ROTULO_PESTANA_ADMIN, rutaPestanaAdmin, type PestanaAdmin } from './pestanas-reglas';

export function PestanasAdmin({ activa }: { activa: PestanaAdmin }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={PESTANAS_ADMIN.map((id) => ({ id, label: ROTULO_PESTANA_ADMIN[id] }))}
      activa={activa}
      onCambio={(id) => router.push(rutaPestanaAdmin(id as PestanaAdmin))}
    />
  );
}
