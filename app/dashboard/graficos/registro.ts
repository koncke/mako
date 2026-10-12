// =============================================================================
// registro — los tipos de gráfico que se dibujan con un componente PROPIO, fuera de Grafico.tsx
// =============================================================================
// El hueco de la ola 2: el «Mapa de calor de página» (`mapa_calor`, sólo sobre el conjunto `toques`) lo dibuja
// el paquete de la landing (P7, app/dashboard/MapaCalor*.tsx), no este archivo. CuerpoGrafico
// (app/dashboard/Grafico.tsx) mira acá ANTES que nada: si el tipo tiene un dibujo registrado, le pasa TODO lo
// que él recibe (el gráfico, el estado de los datos, el tema y el `onDetalle`) y no dibuja nada más.
//
// Para enchufarlo, una línea en DIBUJOS_PROPIOS, con carga perezosa (así su código no viaja a quien no tiene
// un mapa de calor en la hoja):
//
//   mapa_calor: dynamic(() => import('../MapaCalor'), { ssr: false }),
//
// (con `import dynamic from 'next/dynamic'` arriba). Mientras no esté, un gráfico `mapa_calor` dice que todavía
// no se puede dibujar: no rompe la hoja ni cae a otro tipo.

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { Efectivo, Grafico } from '@/lib/graficos-catalogo';
import type { SelDetalle } from '@/lib/graficos-acciones';
import type { TemaHoja } from '@/lib/graficos-temas';
import type { Resultado } from '@/lib/graficos-agregar';

/** Lo mismo que recibe CuerpoGrafico. */
export type PropsDibujo = {
  g: Grafico;
  estado: { cargando: boolean; error?: string; resultado?: Resultado };
  tema: TemaHoja;
  onDetalle?: (sel: SelDetalle) => void;
  /** Lo que resolvió la hoja para este gráfico (período y filtros): el mapa de calor lo necesita (v5). */
  efectivo?: Efectivo;
};

export const DIBUJOS_PROPIOS: Readonly<Record<string, ComponentType<PropsDibujo>>> = {
  mapa_calor: dynamic(() => import('../MapaCalor'), { ssr: false }),
};

/** Los tipos que el catálogo declara y que dibuja un componente propio (aunque todavía no esté enchufado). */
export const TIPOS_CON_DIBUJO_PROPIO: readonly string[] = ['mapa_calor'];
