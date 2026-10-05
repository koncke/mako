// =============================================================================
// Chat Analyst — cómo rinden las secuencias del Chatbot
// =============================================================================
// Martín, 05/10/2026: «Elimina las pestañas… Y la pestaña de dashboard ponlo en una
// nueva ruta dentro de "Analysts" de la sidebar».
//
// Era la cuarta pestaña de /chatbot y ahí competía con el trabajo: esa tab es para
// ARMAR las secuencias, y los números son otra pregunta («¿cómo rinden?»), que es
// exactamente la que contestan los Analysts. `/chat-analyst` ya existía en la barra
// marcada «PRONTO» (app/_components/nav.ts) y este es su contenido.
//
// ⚠️ LOS DATOS SE RESUELVEN ACÁ Y BAJAN POR PROPS. El dashboard es un componente
// cliente (recharts) y el catálogo de secuencias pesa: pedirlo con un `fetch` al montar
// agrega una ida y vuelta sobre datos que el server ya tiene a mano. Es la misma
// decisión —y por el mismo motivo medido— que la lista de /mensajes.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { getSettingData } from '@/lib/setting-secuencias';
import { getFunnelDefault } from '@/lib/funnels';
import { Pagina, PageHeader } from '@/app/_ui';
import { ChatAnalystVista } from './ChatAnalystVista';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireRolWs(['setter'], { nav: 'chat-analyst' });
  const [{ secuencias, serie }, funnel] = await Promise.all([
    getSettingData(),
    getFunnelDefault().catch(() => null),
  ]);
  const etapas = (funnel?.stages ?? []).map((s) => ({ value: s.key, label: s.label }));
  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Chat Analyst"
        proposito="Cómo rinden tus secuencias de mensajes: qué se envía, qué se abre y qué contesta."
      />
      <ChatAnalystVista
        secuencias={JSON.parse(JSON.stringify(secuencias))}
        serie={serie}
        etapas={etapas}
      />
    </Pagina>
  );
}
