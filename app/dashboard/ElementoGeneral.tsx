'use client';

// =============================================================================
// ElementoGeneral — un bloque de la tab General adentro del editor, y lo que General le presta al editor
// =============================================================================
// Desde el 14/10/2026 General es el MISMO editor que el Dashboard (lib/general-piezas.ts explica el pedido). Lo que
// sólo existe en General viaja por contexto desde su página (app/general/ProveedorGeneral.tsx), y fuera de ahí no está:
//   · CÓMO SE DIBUJA CADA BLOQUE (`dibujar`): el server de /general lee los datos (app/general/datos.ts) y los bloques
//     se dibujan con sus opciones (app/general/bloques/). El editor no aprende a leer nada de eso, y el Dashboard no
//     carga el código de General: el dibujo lo pone quien monta el contexto.
//   · LA CONFIGURACIÓN EN EL LUGAR (`configurar`): lo que un bloque define en el panel mismo (los OKRs de «OKRs»).
//   · LA VISTA PREVIA (`muestra`): cada bloque con datos de ejemplo, para el menú «Bloques de General».
//   · LAS VARIABLES DE UN TEXTO («{{nombre}}», lib/general-piezas.ts): los valores de quien mira.
//   · LOS FUNNELS que se pueden elegir en un bloque que se ata a uno («Tu funnel hoy», «A quién cobrarle»).
// ⚠️ Lo que adentro de un bloque cambia datos (registrar un KPI, «Marcar cobrada», completar una tarea) hace
//    `router.refresh()`: la página vuelve a leer y el editor no se entera, que es lo que tiene que pasar.
// ⚠️ El título propio (el `texto` del elemento) reemplaza al del bloque: el del bloque se esconde por CSS (el primer
//    h2 de adentro), así ningún bloque tuvo que aprender a recibir un título.

import { createContext, useContext, type ReactNode } from 'react';
import type { Elemento } from '@/lib/graficos-catalogo';
import { piezaGeneral, type PiezaGeneral, type ValoresVariables } from '@/lib/general-piezas';

export type FunnelElegible = { id: number; nombre: string };

/** Lo que General le presta al editor (lo monta app/general/ProveedorGeneral.tsx). */
export type ContextoDeGeneral = {
  /** El bloque dibujado con sus opciones, o null si no hay con qué. */
  dibujar: (e: Elemento) => ReactNode;
  /** Lo que el bloque define en el panel (null = nada propio). */
  configurar: (e: Elemento) => ReactNode;
  /** El bloque con datos de ejemplo, para el menú. */
  muestra: (pieza: PiezaGeneral) => ReactNode;
  variables: ValoresVariables;
  /** null = no se pudieron leer: el panel no ofrece elegir. */
  funnels: FunnelElegible[] | null;
};

const Contexto = createContext<ContextoDeGeneral | null>(null);

/** Lo monta /general alrededor del editor. */
export function ContextoGeneral({ valor, children }: { valor: ContextoDeGeneral; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Los valores de las variables de un Texto (null fuera de General: quedan las llaves). */
export const useVariablesInforme = (): ValoresVariables | null => useContext(Contexto)?.variables ?? null;
/** ¿El editor está montado en General? (lo que sólo se ofrece ahí: los bloques). */
export const useEnGeneral = (): boolean => useContext(Contexto) != null;
/** Los funnels que un bloque puede elegir (null fuera de General, o si no se pudieron leer). */
export const useFunnelsGeneral = (): FunnelElegible[] | null => useContext(Contexto)?.funnels ?? null;
/** Lo de General para el panel y el menú (null fuera de General). */
export const useGeneral = (): ContextoDeGeneral | null => useContext(Contexto);

const CSS = `
.gen-pieza{flex:1;min-height:0;min-width:0;overflow:auto;display:flex;flex-direction:column}
.gen-pieza[data-titulo] h2:first-of-type{display:none}
.gen-pieza-tit{margin:0 0 16px;font-size:25px;font-weight:600;letter-spacing:-.015em;color:var(--ink)}
.gen-pieza-vacia{flex:1;display:grid;place-items:center;text-align:center;padding:16px;font-size:14px;color:var(--dim);border:1px dashed var(--border-strong);border-radius:12px}
`;

export function ElementoGeneral({ e }: { e: Elemento }) {
  const g = useContext(Contexto);
  const pieza = e.general?.pieza;
  if (!pieza) return null;
  const info = piezaGeneral(pieza);
  const nodo = g?.dibujar(e) ?? null;
  const titulo = e.texto.trim();
  return (
    <div className="gen-pieza" data-pieza={pieza} data-titulo={titulo ? '' : undefined}>
      <style>{CSS}</style>
      {titulo && <h3 className="gen-pieza-tit">{titulo}</h3>}
      {nodo ?? (
        <div className="gen-pieza-vacia">
          {!g ? `«${info.nombre}» se ve en la tab General.` : `No pude armar «${info.nombre}».`}
        </div>
      )}
    </div>
  );
}
