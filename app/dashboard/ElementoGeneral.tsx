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
// ⚠️ El título propio (el `texto` del elemento) reemplaza al del bloque y va por CONTEXTO (`useTituloPropio`, que lee
//    el título de cada bloque, app/general/bloques/comun.tsx): en el mismo renglón que lo que el bloque dice al lado y su
//    link. Hasta la tercera vuelta (14/10/2026) iba aparte, arriba, y escondía el del bloque por CSS: dos títulos.
// ⚠️ EL FONDO (la opción `fondo` de cada bloque, lib/general-piezas.ts) lo aplica ESTE marco, no el bloque: `data-oscuro`
//    redefine los TOKENS (la tinta, los grises, las líneas) a los de la isla oscura y la tarjeta de afuera se pinta con
//    `:has` (app/dashboard/editor-css.ts). Un bloque que usa los tokens de la casa se da vuelta solo.

import { createContext, useContext, type ReactNode } from 'react';
import type { Elemento } from '@/lib/graficos-catalogo';
import { opcionDe, piezaGeneral, type OpcionesElegidas, type PiezaGeneral, type ValoresVariables } from '@/lib/general-piezas';

export type FunnelElegible = { id: number; nombre: string };

/** Lo que General le presta al editor (lo monta app/general/ProveedorGeneral.tsx). */
export type ContextoDeGeneral = {
  /** El bloque dibujado con sus opciones, o null si no hay con qué. */
  dibujar: (e: Elemento) => ReactNode;
  /** Lo que el bloque define en el panel (null = nada propio). */
  configurar: (e: Elemento) => ReactNode;
  /** El bloque con datos de ejemplo (y sus opciones, si se dan): el menú y las miniaturas de las plantillas. */
  muestra: (pieza: PiezaGeneral, opciones?: OpcionesElegidas) => ReactNode;
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

const TituloPropio = createContext<string | null>(null);
/** El título que se le escribió al bloque en el panel (null = el suyo). */
export const useTituloPropio = (): string | null => useContext(TituloPropio);

const CSS = `
.gen-pieza{flex:1;min-height:0;min-width:0;overflow:auto;display:flex;flex-direction:column;scrollbar-width:thin}
.gen-pieza[data-oscuro]{--ink:var(--on-sidebar);--dim:var(--sidebar-text);--faint:var(--sidebar-text);--border:var(--sidebar-line);
  --border-strong:color-mix(in srgb,var(--on-sidebar) 24%,transparent);--surface-2:color-mix(in srgb,var(--on-sidebar) 8%,transparent);
  --surface:color-mix(in srgb,var(--on-sidebar) 7%,var(--sidebar));--gb-fondo:var(--sidebar);color:var(--on-sidebar)}
.gen-pieza-vacia{flex:1;display:grid;place-items:center;text-align:center;padding:16px;font-size:14px;color:var(--dim);border:1px dashed var(--border-strong);border-radius:12px}
`;

export function ElementoGeneral({ e }: { e: Elemento }) {
  const g = useContext(Contexto);
  const pieza = e.general?.pieza;
  if (!pieza) return null;
  const info = piezaGeneral(pieza);
  const nodo = g?.dibujar(e) ?? null;
  const titulo = e.texto.trim();
  const oscuro = opcionDe(pieza, e.general?.opciones, 'fondo') === 'oscuro';
  return (
    <div className="gen-pieza" data-pieza={pieza} data-oscuro={oscuro ? '' : undefined}>
      <style>{CSS}</style>
      <TituloPropio.Provider value={titulo || null}>
        {nodo ?? (
          <div className="gen-pieza-vacia">
            {!g ? `«${info.nombre}» se ve en la tab General.` : `No pude armar «${info.nombre}».`}
          </div>
        )}
      </TituloPropio.Provider>
    </div>
  );
}

/**
 * Un bloque de General con sus datos de EJEMPLO y sus opciones, con el mismo marco que en la hoja (el fondo, el título
 * propio): la miniatura de una plantilla (./MiniaturaHoja.tsx). Fuera de General, nada.
 */
export function PiezaGeneralDeMuestra({ e }: { e: Elemento }) {
  const g = useContext(Contexto);
  const pieza = e.general?.pieza;
  if (!g || !pieza) return null;
  const titulo = e.texto.trim();
  const oscuro = opcionDe(pieza, e.general?.opciones, 'fondo') === 'oscuro';
  return (
    <div className="gen-pieza" data-pieza={pieza} data-oscuro={oscuro ? '' : undefined}>
      <style>{CSS}</style>
      <TituloPropio.Provider value={titulo || null}>{g.muestra(pieza, e.general?.opciones)}</TituloPropio.Provider>
    </div>
  );
}
