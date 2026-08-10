'use client';

// =============================================================================
// VistaCerebro — el estado que comparten el mapa y las áreas de abajo
// =============================================================================
// Las dos mitades de /second-brain no son dos bloques que casualmente están en la
// misma página: se hablan. El mapa NAVEGA y la sección de abajo EDITA — tocar «Abrir»
// en la columna del mapa abre esa área acá abajo, ya lista para completarla. Ese ida y
// vuelta es lo que justifica que estén juntas, y necesita un dueño del estado.
//
// Solo queda UN estado compartido: qué área está abierta. El otro —qué área resaltar
// mientras el cursor pasaba por una tarjeta— se fue con las tarjetas, y con él el
// re-render del mapa entero en cada movimiento del mouse.
//
// La página sigue siendo un Server Component: acá abajo solo vive el estado, y el
// panel del funnel entra como slot ya renderizado en el servidor (el mismo patrón que
// ya usaba `OnboardingTabs` con `funnelPanel`).
// =============================================================================

import { useCallback, useState, type ReactNode } from 'react';
import type { AreaId, Cerebro } from '@/lib/cerebro-modelo';
import { PageHeader } from '@/app/_ui';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import { Grafo } from './Grafo';
import { AreasHub } from './AreasHub';
import { BotonClaude } from './BotonClaude';
import { BotonExportar } from './BotonExportar';

export function VistaCerebro({ cerebro, funnelPanel, agenteToken, appUrl }: {
  cerebro: Cerebro;
  funnelPanel: ReactNode;
  agenteToken: string | null;
  appUrl: string;
}) {
  const [abierta, setAbierta] = useState<AreaId | null>(null);
  /** Cuántas veces se pidió IR a la sección, no cuál. Abrir y saltar son dos cosas
   *  distintas —tocar un nodo abre sin mover la pantalla, tocar «Abrir» va— y con un
   *  solo booleano no se distinguen dos pedidos seguidos de salto a la MISMA sección:
   *  el estado no cambia y el efecto no vuelve a correr. Un contador sí cambia siempre. */
  const [salto, setSalto] = useState(0);

  const abrir = (a: AreaId | null, saltar = false) => {
    setAbierta(a);
    if (saltar) setSalto((n) => n + 1);
  };

  /** EL FILTRO DEL MAPA VIVE ACÁ, no adentro del grafo, porque el botón de exportar es
   *  su HERMANO y los dos tienen que hablar del mismo recorte. El header lo renderiza
   *  esta vista justamente para eso: antes vivía en la página, que es un server
   *  component, y no había ningún ancestro con estado. */
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);

  /** Y lo que el mapa está mostrando de verdad, que además del filtro incluye la
   *  búsqueda por texto y la de MaKo. Se usa para el conteo honesto de «lo que estás
   *  viendo»; lo que se EXPORTA sale del filtro, que es lo único que se puede volver a
   *  expresar en un formulario. */
  const [verse, setVerse] = useState<{ ids: string[]; recortado: boolean }>({ ids: [], recortado: false });
  const alVerse = useCallback((info: { ids: string[]; recortado: boolean }) => setVerse(info), []);

  return (
    <>
      <PageHeader
        titulo="Second Brain"
        proposito="Todo lo que MaKo sabe de tu negocio."
        acciones={<BotonClaude tokenInicial={agenteToken} appUrl={appUrl} />}
        accion={<BotonExportar cerebro={cerebro} filtroMapa={filtro} recorte={verse} />}
      />
      <Grafo cerebro={cerebro} onAbrirArea={abrir} areaAbierta={abierta} onVerse={alVerse} filtro={filtro} onFiltro={setFiltro} />
      {/* El separador solo existe si hay algo abajo. Fijo, dejaba un hueco permanente
          entre el mapa y nada. */}
      {abierta && <div style={{ height: 'var(--sect-gap)' }} />}
      <AreasHub abierta={abierta} onAbrir={abrir} salto={salto} funnelPanel={funnelPanel} />
    </>
  );
}
