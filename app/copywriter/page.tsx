// =============================================================================
// /copywriter — «Encuentra tu siguiente OUTLIER»; `?ver=guiones`, la última página; `?nueva`, los templates
// =============================================================================
// 11/11/2026 (D18, Martín: «aplícalo para copywriting, me gustaría traer outliers»): como Image y Video, la portada son los
// outliers (./OutliersCopy.tsx, ./vista.ts). Lo de abajo, tal cual, es «Mis guiones» (`?ver=guiones`) y «Crear desde cero»
// (`?nueva` o `?nuevo=<tipo>`).
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
import { catalogosDelCopywriter, ofertasDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { requireCopywriter } from './acceso';
import { Copywriter } from './Copywriter';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { leerOutliersCopy } from '@/lib/copywriter/outliers-servidor';
import { primeraTandaCopy } from '@/lib/copywriter/outliers';
import { vistaDeCopy } from './vista';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// La primera apertura de un negocio grande muda cientos de páginas (lib/copywriter/mudanza.ts): unos segundos. Si se
// corta, la mudanza se repite sin duplicar, pero mejor que no se corte.
export const maxDuration = 60;

export default async function CopywriterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'copywriter' });
  await requireCopywriter();
  // `?nueva` es «Nueva» de la barra de páginas: los templates, aunque haya páginas. `?nuevo=<tipo>` también (lo usan las
  // rutas viejas que se mudaron acá: /youtube-writer, /stories y «Abrir en Copywriter»), con los templates de ese tipo
  // primero. Nada se crea por abrir un link.
  const sp = await searchParams;
  const vista = vistaDeCopy(sp);
  if (vista === 'outliers') {
    // La portada va en el CENTRO de la pantalla de Create, con el chat de MaKo a la izquierda y sus guiones detrás de la «←»
    // (11/11/2026, Martín: «en la vista de outliers no está el chat de MaKo»; Image lo hace igual desde el 9/11). Por eso lista
    // las páginas, y la mudanza corre también acá (la primera vez de un negocio; lib/copywriter/mudanza.ts).
    await mudarLoDeAntes();
    const [portada, r, catalogos, ws, ofertas] = await Promise.all([
      // Sólo la primera tanda viaja con la página; el resto lo pide la portada (13/11/2026: eran 924 outliers, 1,19 MB).
      leerOutliersCopy().then(primeraTandaCopy), listar(), catalogosDelCopywriter(), getWorkspaceActual().catch(() => null), ofertasDelCopywriter(),
    ]);
    return (
      <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
        <Copywriter ws={ws} paginas={r.ok ? r.paginas : []} guion={null}
          error={r.ok ? null : `No se pudo leer la lista de páginas: ${r.error}`} catalogos={catalogos} ofertas={ofertas} portada={portada} />
      </Pagina>
    );
  }
  const nuevo = sp.nuevo;
  const tipoInicial = esTipoGuion(nuevo) ? nuevo : null;
  const enNueva = sp.nueva !== undefined || !!tipoInicial;
  // La primera vez, lo que el negocio ya tenía (los guiones del Ads Writer, los de Reels) pasa a páginas (lib/copywriter/mudanza.ts).
  await mudarLoDeAntes();
  const r = await listar();
  const ultima = r.ok && !enNueva ? masReciente(r.paginas) : null;
  if (ultima) redirect(await rutaConWs(`/copywriter/${ultima.id}`));
  const [catalogos, ws, ofertas] = await Promise.all([catalogosDelCopywriter(), getWorkspaceActual().catch(() => null), ofertasDelCopywriter()]);
  // El shell único de Create (app/_crear/PantallaCrear.tsx) mide el alto de la <Pagina>, como Video y Offer.
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <Copywriter
        ws={ws}
        paginas={r.ok ? r.paginas : []}
        guion={null}
        error={r.ok ? null : `No se pudo leer la lista de páginas: ${r.error}`}
        catalogos={catalogos}
        tipoInicial={tipoInicial}
        nuevaInicial={enNueva}
        ofertas={ofertas}
      />
    </Pagina>
  );
}
