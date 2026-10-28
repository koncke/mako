// =============================================================================
// /copywriter — el último guion tocado; sin ninguno, la caja grande de mila («¿Qué guion escribimos?»)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D1). La misma puerta que /copywriter/<id>. Redirige con un 307 de verdad: no hay
// loading.tsx en la tab (un redirect de adentro de un Suspense va en el stream y queda en carrera con la hidratación:
// el ticket #9 del Web Generator, app/web-generator/layout.tsx).
// Una lista que no se pudo leer no salta: la pantalla lo dice, con el árbol vacío.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { listar } from '@/lib/copywriter/server';
import { masReciente } from '@/lib/copywriter/arbol';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { requireCopywriter } from './acceso';
import { Copywriter } from './Copywriter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CopywriterPage() {
  await requireRolWs([], { nav: 'copywriter' });
  await requireCopywriter();
  const r = await listar();
  const ultima = r.ok ? masReciente(r.paginas) : null;
  if (ultima) redirect(await rutaConWs(`/copywriter/${ultima.id}`));
  const [catalogos, ws] = await Promise.all([catalogosDelCopywriter(), getWorkspaceActual().catch(() => null)]);
  return (
    <Copywriter
      ws={ws}
      paginas={r.ok ? r.paginas : []}
      guion={null}
      error={r.ok ? null : `No se pudo leer la lista de guiones: ${r.error}`}
      catalogos={catalogos}
    />
  );
}
