'use client';

// =============================================================================
// ficha/registro-reuniones — los COMPONENTES de los bloques de la tab Reuniones
// =============================================================================
// Las reglas están en ./reglas-reuniones.ts. Los dos archivos son del frente de Reuniones (ver ./tipos.ts).
// HOY (14/10/2026) `reunion-1` es ReunionesCard ENTERA, la de siempre: la R1, la R2, la agenda, lo que salió
// de la llamada, el setter y el closer. La tanda B2 la parte en sus bloques.
// =============================================================================

import { ReunionesCard, type PartesReuniones } from '../ReunionesCard';
import { REGLAS_REUNIONES, partesDeReunion1 } from './reglas-reuniones';
import type { EntradaRegistro, PropsBloque } from './tipos';

/** Una parte de la tarjeta de siempre, con el título del bloque (los datos y su edición son los mismos). */
function parte(partes: (p: PropsBloque) => PartesReuniones) {
  return function Parte(p: PropsBloque) {
    const { lead, data } = p.ctx;
    return <ReunionesCard lead={lead} respuestas={data.respuestas} equipo={data.equipo} closerDetectado={data.closerDetectado} partes={partes(p)} rotulo={p.titulo} />;
  };
}

export const REGISTRO_REUNIONES: { [K in keyof typeof REGLAS_REUNIONES]: EntradaRegistro } = {
  // La R1 y las cajas, más lo que la hoja no puso aparte (`partesDeReunion1`).
  'reunion-1': { Componente: parte((p) => partesDeReunion1(p.hermanos)), ...REGLAS_REUNIONES['reunion-1'] },
  'reunion-2': { Componente: parte(() => ({ r2: true })), ...REGLAS_REUNIONES['reunion-2'] },
  'agendar-reunion': { Componente: parte(() => ({ agendar: true })), ...REGLAS_REUNIONES['agendar-reunion'] },
  'lo-que-salio-de-la-llamada': { Componente: parte(() => ({ llamada: true })), ...REGLAS_REUNIONES['lo-que-salio-de-la-llamada'] },
};
