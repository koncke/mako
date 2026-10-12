'use client';

// La fila de tabs de /admin/offer-playbook. Es lo ÚNICO cliente de la pantalla:
// el documento se dibuja en el servidor (MarkdownDoc no lleva 'use client' y no
// pesa en el bundle), así que cambiar de tab es navegar a `?tab=` y que el
// servidor dibuje la otra. Con el router de la casa, que preserva el `?ws=`.
//
// Importa de tabs.ts y NO de secciones.ts: secciones importa MarkdownDoc, y
// traerlo acá lo metería entero en el bundle del navegador.

import { Tabs } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { TABS_PLAYBOOK, hrefDeTab, type TabPlaybook } from './tabs';

export function TabsPlaybook({ activa, cuentas }: { activa: TabPlaybook; cuentas: Partial<Record<TabPlaybook, number>> }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={TABS_PLAYBOOK.map((t) => ({ id: t.id, label: t.label, badge: cuentas[t.id] }))}
      activa={activa}
      onCambio={(id) => router.replace(hrefDeTab(id as TabPlaybook), { scroll: false })}
    />
  );
}
