'use client';

// =============================================================================
// ficha/registro-reuniones — los COMPONENTES de los bloques de la tab Reuniones
// =============================================================================
// Las reglas están en ./reglas-reuniones.ts. Los dos archivos son del frente de Reuniones (ver ./tipos.ts).
// HOY (14/10/2026) `reunion-1` es ReunionesCard ENTERA, la de siempre: la R1, la R2, la agenda, lo que salió
// de la llamada, el setter y el closer. La tanda B2 la parte en sus bloques.
// =============================================================================

import { ReunionesCard } from '../ReunionesCard';
import { REGLAS_REUNIONES } from './reglas-reuniones';
import type { EntradaRegistro, PropsBloque } from './tipos';

function Reuniones({ ctx }: PropsBloque) {
  const { lead, data } = ctx;
  return <ReunionesCard lead={lead} respuestas={data.respuestas} equipo={data.equipo} closerDetectado={data.closerDetectado} />;
}

export const REGISTRO_REUNIONES: { [K in keyof typeof REGLAS_REUNIONES]: EntradaRegistro } = {
  'reunion-1': { Componente: Reuniones, ...REGLAS_REUNIONES['reunion-1'] },
};
