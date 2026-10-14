'use client';

// =============================================================================
// ElementoGeneral — un bloque de la tab General adentro del editor, y lo que General le presta al editor
// =============================================================================
// Desde el 14/10/2026 General es el MISMO editor que el Dashboard (lib/general-piezas.ts explica el pedido). Dos cosas
// viajan por contexto desde la página de General (app/general/page.tsx), y fuera de ahí no existen:
//   · LOS BLOQUES YA DIBUJADOS. El server de /general arma cada bloque con las lecturas de siempre (el objetivo del
//     trimestre, los KPIs, el semáforo, el Plan, la cobranza) y se los pasa al editor como nodos ya armados: el
//     editor no aprende a leer nada de eso. Un bloque que no está (en el Dashboard, en un link compartido) lo DICE.
//   · LAS VARIABLES DE UN TEXTO («{{nombre}}», lib/general-piezas.ts): los valores de quien mira.
//   · LOS FUNNELS que se pueden elegir en un bloque que se ata a uno («Tu funnel hoy», «A quién cobrarle»): el server
//     armó una variante por funnel (`clavePieza`), así elegir en el panel cambia el bloque sin volver al server.
// ⚠️ Lo que adentro de un bloque cambia datos (registrar un KPI, «Marcar cobrada») hace `router.refresh()`: la página
//    vuelve a armar los bloques y el editor no se entera, que es lo que tiene que pasar (no cambia el informe).
// ⚠️ El título propio (el `texto` del elemento) reemplaza al del bloque: el del bloque se esconde por CSS (el primer
//    h2 de adentro), así ningún bloque tuvo que aprender a recibir un título.

import { createContext, useContext, type ReactNode } from 'react';
import type { Elemento } from '@/lib/graficos-catalogo';
import { clavePieza, piezaGeneral, type ValoresVariables } from '@/lib/general-piezas';

export type FunnelElegible = { id: number; nombre: string };

const PiezasContexto = createContext<Record<string, ReactNode> | null>(null);
const VariablesContexto = createContext<ValoresVariables | null>(null);
const FunnelsContexto = createContext<FunnelElegible[] | null>(null);

/** Lo monta /general alrededor del editor. */
export function ContextoGeneral({ piezas, variables, funnels, children }: {
  piezas: Record<string, ReactNode>;
  variables: ValoresVariables;
  /** null = no se pudieron leer: el panel no ofrece elegir. */
  funnels: FunnelElegible[] | null;
  children: ReactNode;
}) {
  return (
    <PiezasContexto.Provider value={piezas}>
      <VariablesContexto.Provider value={variables}>
        <FunnelsContexto.Provider value={funnels}>{children}</FunnelsContexto.Provider>
      </VariablesContexto.Provider>
    </PiezasContexto.Provider>
  );
}

/** Los valores de las variables de un Texto (null fuera de General: quedan las llaves). */
export const useVariablesInforme = (): ValoresVariables | null => useContext(VariablesContexto);
/** ¿El editor está montado en General? (lo que sólo se ofrece ahí: los bloques). */
export const useEnGeneral = (): boolean => useContext(PiezasContexto) != null;
/** Los funnels que un bloque puede elegir (null fuera de General, o si no se pudieron leer). */
export const useFunnelsGeneral = (): FunnelElegible[] | null => useContext(FunnelsContexto);

const CSS = `
.gen-pieza{flex:1;min-height:0;min-width:0;overflow:auto;display:flex;flex-direction:column}
.gen-pieza[data-titulo] h2:first-of-type{display:none}
.gen-pieza-tit{margin:0 0 16px;font-size:25px;font-weight:600;letter-spacing:-.015em;color:var(--ink)}
.gen-pieza-vacia{flex:1;display:grid;place-items:center;text-align:center;padding:16px;font-size:14px;color:var(--dim);border:1px dashed var(--border-strong);border-radius:12px}
`;

export function ElementoGeneral({ e }: { e: Elemento }) {
  const piezas = useContext(PiezasContexto);
  const pieza = e.general?.pieza;
  if (!pieza) return null;
  const info = piezaGeneral(pieza);
  const funnel = e.general?.funnel ?? null;
  const nodo = piezas?.[clavePieza(pieza, funnel)];
  const titulo = e.texto.trim();
  return (
    <div className="gen-pieza" data-pieza={pieza} data-titulo={titulo ? '' : undefined}>
      <style>{CSS}</style>
      {titulo && <h3 className="gen-pieza-tit">{titulo}</h3>}
      {nodo ?? (
        <div className="gen-pieza-vacia">
          {!piezas ? `«${info.nombre}» se ve en la tab General.`
            // Un funnel archivado (o más allá del tope) no tiene variante: se dice cuál falta, no «no pude».
            : funnel ? 'Ese funnel ya no está. Elige otro en el panel.'
              : `No pude armar «${info.nombre}».`}
        </div>
      )}
    </div>
  );
}
