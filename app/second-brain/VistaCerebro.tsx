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

import { useState, type ReactNode } from 'react';
import type { AreaId, Cerebro } from '@/lib/cerebro-modelo';
import { Grafo } from './Grafo';
import { AreasHub } from './AreasHub';

export function VistaCerebro({ cerebro, funnelPanel }: {
  cerebro: Cerebro;
  funnelPanel: ReactNode;
}) {
  const [abierta, setAbierta] = useState<AreaId | null>(null);

  return (
    <>
      <Grafo cerebro={cerebro} onAbrirArea={setAbierta} areaAbierta={abierta} />
      {/* El separador solo existe si hay algo abajo. Fijo, dejaba un hueco permanente
          entre el mapa y nada. */}
      {abierta && <div style={{ height: 'var(--sect-gap)' }} />}
      <AreasHub abierta={abierta} onAbrir={setAbierta} funnelPanel={funnelPanel} />
    </>
  );
}
