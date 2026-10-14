// =============================================================================
// /creaciones — la galería de lo que publican los negocios de MaKo, con estrellas (como GitHub Explore)
// =============================================================================
// Pedido de Martín (13/10/2026, punto 10): «Yo como creador de MaKo, jamás voy a poder idear todos los escenarios,
// todas las automatizaciones, los dashboards, los formatos de generación de vídeo o imagen... Por eso quiero crear un
// sistema parecido al de github de estrellas, para que los usuarios hagan sus creaciones y otros usuarios puedan
// puntuarles.»
//
// Sólo el ADMIN del negocio: usar una creación crea algo en el negocio, y darle una estrella es votar por él. Sin tab
// en la barra todavía (se le preguntó a Martín): se entra por el link y por el botón «Publicar» de cada feature.
// La vista viaja en `?tab=` leída acá (AGENTS.md: el link que copiás es la tab que estás viendo).
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { FaltaTablaCreacionesError, listarCreaciones, misCreaciones, type Creacion } from '@/lib/creaciones';
import { esOrdenCreaciones, esTipoCreacion, type OrdenCreaciones, type TipoCreacion } from '@/lib/creaciones-reglas';
import { EmptyState, PageHeader, Pagina } from '@/app/_ui';
import { GaleriaCreaciones } from './GaleriaCreaciones';

export const dynamic = 'force-dynamic';

export default async function CreacionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([]);
  const ws = await getWorkspaceActual();
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const tab = uno('tab') === 'mias' ? 'mias' : 'explorar';
  const t = uno('tipo');
  const tipo: TipoCreacion | null = esTipoCreacion(t) ? t : null;
  const o = uno('orden');
  const orden: OrdenCreaciones = esOrdenCreaciones(o) ? o : 'estrellas';
  const q = uno('q') ?? '';

  if (ws == null) {
    return <Pagina><PageHeader titulo="Creaciones" /><EmptyState titulo="Entra a un negocio primero." /></Pagina>;
  }

  let inicial: { creaciones: Creacion[]; hayMas: boolean } = { creaciones: [], hayMas: false };
  let mias: Creacion[] = [];
  let error: string | null = null;
  try {
    [inicial, mias] = await Promise.all([listarCreaciones(ws, { tipo, orden, q }), misCreaciones(ws)]);
  } catch (e) {
    error = e instanceof FaltaTablaCreacionesError ? e.message : 'No se pudo cargar la galería.';
    if (!(e instanceof FaltaTablaCreacionesError)) console.error(`[creaciones] página (ws ${ws}):`, e instanceof Error ? e.message : e);
  }

  return (
    <Pagina>
      <PageHeader titulo="Creaciones" proposito="Lo que crean los negocios de MaKo, con sus estrellas." />
      <GaleriaCreaciones
        tabInicial={tab}
        filtroInicial={{ tipo, orden, q }}
        inicial={inicial}
        mias={mias}
        error={error}
      />
    </Pagina>
  );
}
