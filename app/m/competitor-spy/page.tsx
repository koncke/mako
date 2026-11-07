// =============================================================================
// /m/competitor-spy — Competitor Spy en el teléfono (6/11/2026)
// =============================================================================
// El teléfono DESTILA la computadora (AGENTS.md → «MaKo Mobile»): las MISMAS dos vistas de
// /competitor-spy, en el mismo orden y con los mismos rótulos —la lista de competidores con el campo
// de arriba y «Sugeridos», y la ficha de uno— con menos texto y menos piezas. Lo que cambia es la
// forma, que es la decidida en docs/diseno-competitors-spy.md §8: la ficha pasa a UN bloque por
// pantalla, plegados; la galería, a UNA columna; los filtros y el orden, a una hoja que sube desde
// abajo. Los componentes son los de la computadora (SpyM.tsx dice cuáles y por qué).
//
// ⚠️ LA FICHA ES `?competidor=<id>`, LA MISMA CLAVE DE LA COMPUTADORA (lib/movil-rutas.ts →
// QUERY_DE_SECCION): no es una subruta. Así un link compartido abre lo mismo en los dos lados y la
// vuelta a la computadora no pierde al competidor. Y las piezas del que se abre se leen ACÁ, en
// paralelo con todo lo demás, como en /competitor-spy (4/11/2026, Martín: «que cargue más rápido»).
//
// ⚠️ ACÁ NO SE LEE AL COMPETIDOR. En la computadora, abrir una ficha vieja dispara su lectura sola
// (`debeLeerAlAbrir`, lib/spy-vista.ts), que paga Apify y YouTube con la clave del negocio. Esta
// pantalla sólo MUESTRA lo que ya se leyó: la primera lectura de alguien sigue siendo de la
// computadora, y la ficha lo dice en vez de quedarse en un esqueleto eterno (ver SpyM.tsx).
// =============================================================================

import './competitor-spy.css';
import { requireMovil } from '@/lib/movil-guard';
import { PantallaM, VacioM } from '@/app/m/_ui';
import { listarCompetidores, resumenDePiezas } from '@/lib/spy';
import { sugeridosDelNegocio } from '@/lib/spy-sugeridos-server';
import { piezasAction } from '@/app/competitor-spy/actions';
import { SpyM } from './SpyM';

export const dynamic = 'force-dynamic';

// El mismo techo que /competitor-spy: las server actions de esta pantalla (sumar un competidor o un
// canal lee su perfil por Apify, que tarda) corren con el `maxDuration` de SU ruta, y el default corto
// cortaría DESPUÉS de haber leído — o sea, un error sobre algo que en realidad salió bien.
export const maxDuration = 60;

export default async function CompetitorSpyMovil({ searchParams }: { searchParams: Promise<{ competidor?: string | string[] }> }) {
  await requireMovil({ navKey: 'market-an' });
  const sp = await searchParams;
  const pedido = Number(Array.isArray(sp.competidor) ? sp.competidor[0] : sp.competidor);
  const abierto = Number.isInteger(pedido) && pedido > 0 ? pedido : null;
  const [r, resumen, sugeridos, delAbierto] = await Promise.all([
    listarCompetidores().catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) })),
    resumenDePiezas().catch(() => ({})),
    sugeridosDelNegocio().catch(() => []),
    abierto ? piezasAction(abierto).catch(() => null) : Promise.resolve(null),
  ]);
  // El vacío y el error también van adentro de PantallaM, con el refresco prendido (AGENTS.md).
  if (!r.ok) {
    return <PantallaM><VacioM frase={`No pude leer a quiénes miras. ${r.error}`} /></PantallaM>;
  }
  return (
    <PantallaM>
      <SpyM
        competidores={r.competidores}
        resumen={resumen}
        sugeridos={sugeridos}
        abierto={abierto}
        piezas={abierto && delAbierto?.ok ? delAbierto.piezas : []}
      />
    </PantallaM>
  );
}
