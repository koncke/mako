'use client';

// =============================================================================
// Un guion compartido para editar, cargado APARTE (`next/dynamic`) — el molde de ./PortalCompartidoPerezoso.tsx
// =============================================================================
// El editor del Copywriter trae TipTap entero. Turbopack arma UN solo juego de chunks para todos los componentes
// cliente de esta página: importado directo, quien abre el link de un curso o la galería de marca bajaría el editor, y
// quien abre un guion bajaría lo de los demás. Con `next/dynamic` ADENTRO de un componente cliente el chunk se separa.

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type GuionCompartidoT from './GuionCompartido';

const GuionCompartido = dynamic(() => import('./GuionCompartido'));

export default function GuionCompartidoPerezoso(props: ComponentProps<typeof GuionCompartidoT>) {
  return <GuionCompartido {...props} />;
}
