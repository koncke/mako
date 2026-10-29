// =============================================================================
// /copywriter — la última página tocada; sin ninguna (o con `?nueva`), «¿Qué vas a crear hoy?» y los templates
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
import { mudarLoDeAntes } from '@/lib/copywriter/mudanza';
import { masReciente } from '@/lib/copywriter/arbol';
import { esTipoGuion } from '@/lib/copywriter/tipos';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { requireCopywriter } from './acceso';
import { Copywriter } from './Copywriter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CopywriterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'copywriter' });
  await requireCopywriter();
  // `?nueva` es «Nueva» de la barra de páginas: los templates, aunque haya páginas. `?nuevo=<tipo>` también (lo usan las
  // rutas viejas que se mudaron acá: /youtube-writer, /stories y «Abrir en Copywriter»), con los templates de ese tipo
  // primero. Nada se crea por abrir un link.
  const sp = await searchParams;
  const nuevo = sp.nuevo;
  const tipoInicial = esTipoGuion(nuevo) ? nuevo : null;
  const enNueva = sp.nueva !== undefined || !!tipoInicial;
  // La primera vez, lo que el negocio ya tenía (los guiones del Ads Writer, los de Reels) pasa a páginas (lib/copywriter/mudanza.ts).
  await mudarLoDeAntes();
  const r = await listar();
  const ultima = r.ok && !enNueva ? masReciente(r.paginas) : null;
  if (ultima) redirect(await rutaConWs(`/copywriter/${ultima.id}`));
  const [catalogos, ws] = await Promise.all([catalogosDelCopywriter(), getWorkspaceActual().catch(() => null)]);
  return (
    <Copywriter
      ws={ws}
      paginas={r.ok ? r.paginas : []}
      guion={null}
      error={r.ok ? null : `No se pudo leer la lista de guiones: ${r.error}`}
      catalogos={catalogos}
      tipoInicial={tipoInicial}
    />
  );
}
