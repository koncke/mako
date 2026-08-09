'use client';

// =============================================================================
// VistaCerebro — el estado que comparten el mapa y las áreas de abajo
// =============================================================================
// Las dos mitades de /second-brain no son dos bloques que casualmente están en la
// misma página: se hablan. Fijar un dato en el mapa y tocar «Abrir Razones» abre esa
// área abajo; pasar el cursor por una tarjeta de área resalta esa zona del mapa. Ese
// ida y vuelta es lo que justifica que estén juntas, y necesita un dueño del estado.
//
// La página sigue siendo un Server Component: acá abajo solo vive el estado, y el
// panel del funnel entra como slot ya renderizado en el servidor (el mismo patrón que
// ya usaba `OnboardingTabs` con `funnelPanel`).
// =============================================================================

import { useState, type ReactNode } from 'react';
import type { AreaId, Cerebro } from '@/lib/cerebro-modelo';
import { Grafo } from './Grafo';
import { AreasHub } from './AreasHub';

export function VistaCerebro({ cerebro, conteo, funnelPanel }: {
  cerebro: Cerebro;
  conteo: Record<string, number>;
  funnelPanel: ReactNode;
}) {
  const [abierta, setAbierta] = useState<AreaId | null>(null);
  const [resaltada, setResaltada] = useState<AreaId | null>(null);

  return (
    <>
      <Grafo cerebro={cerebro} onAbrirArea={(a) => setAbierta(a)} areaResaltada={resaltada} />
      <div style={{ height: 'var(--sect-gap)' }} />
      <AreasHub
        conteo={conteo}
        abierta={abierta}
        onAbrir={setAbierta}
        onResaltar={setResaltada}
        funnelPanel={funnelPanel}
      />
    </>
  );
}
