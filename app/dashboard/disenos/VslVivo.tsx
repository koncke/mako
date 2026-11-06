'use client';

// =============================================================================
// VslVivo — la hoja «VSL y YouTube» con su diseño (./HojaVsl.tsx) y los datos de VERDAD
// =============================================================================
// HojaVsl sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo con los datos de los
// componentes de la hoja (`datos`, los que la página ya leyó). lib/vsl-diseno.ts arma lo que dibuja cada tarjeta, con test.
// Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaVsl, type DatosPieza } from '@/lib/vsl-diseno';
import { HojaVsl } from './HojaVsl';

export default function VslVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaVsl(hoja, datos), [hoja, datos]);
  return <HojaVsl hoja={hoja} vista={vista} titulo={hoja.nombre} hoy={hoy} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
