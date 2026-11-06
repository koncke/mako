'use client';

// =============================================================================
// InmobiliariaVivo — la hoja «Inmobiliaria» con su diseño (./HojaInmobiliaria.tsx) y los datos de VERDAD
// =============================================================================
// HojaInmobiliaria sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo con los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó). lib/inmobiliaria-diseno.ts arma lo que dibuja cada tarjeta, con
// test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaInmobiliaria, type DatosPieza } from '@/lib/inmobiliaria-diseno';
import { HojaInmobiliaria } from './HojaInmobiliaria';

export default function InmobiliariaVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaInmobiliaria(hoja, datos), [hoja, datos]);
  return <HojaInmobiliaria hoja={hoja} vista={vista} titulo={hoja.nombre} hoy={hoy} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
