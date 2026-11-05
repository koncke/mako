'use client';

// =============================================================================
// HooksVivo — la hoja «Hooks y retención» con su diseño (./HojaHooks.tsx) y los datos de VERDAD
// =============================================================================
// HojaHooks sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo con los datos de
// los componentes de la hoja (`datos`, los que la página ya leyó). lib/hooks-diseno.ts arma lo que dibuja cada tarjeta, con test.
// Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaHooks, type DatosPieza } from '@/lib/hooks-diseno';
import { HojaHooks } from './HojaHooks';

export default function HooksVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaHooks(hoja, datos), [hoja, datos]);
  return <HojaHooks hoja={hoja} vista={vista} titulo={hoja.nombre} hoy={hoy} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
