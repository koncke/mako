'use client';

// =============================================================================
// ColdCallingVivo — la hoja «Cold Calling» con su diseño (./HojaColdCalling.tsx) y los datos de VERDAD
// =============================================================================
// HojaColdCalling sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo con los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó). lib/cold-calling-diseno.ts arma lo que dibuja cada tarjeta, con
// test. Lo carga EditorInforme con next/dynamic; `onCambio` es su `refrescar` (después de grabar una llamada, la hoja vuelve a leer).
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaColdCalling, type DatosPieza } from '@/lib/cold-calling-diseno';
import { HojaColdCalling } from './HojaColdCalling';

export default function ColdCallingVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, onCambio, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; onCambio?: () => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaColdCalling(hoja, datos), [hoja, datos]);
  return <HojaColdCalling hoja={hoja} vista={vista} titulo={hoja.nombre} hoy={hoy} periodo={periodo} onGrilla={onGrilla} onFila={onFila} onCambio={onCambio} compartido={compartido} />;
}
