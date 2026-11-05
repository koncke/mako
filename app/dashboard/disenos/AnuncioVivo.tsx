'use client';

// =============================================================================
// AnuncioVivo — la hoja «Anuncio ganador» con su diseño (./HojaAnuncio.tsx) y los datos de VERDAD
// =============================================================================
// HojaAnuncio sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo con los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó). lib/anuncio-diseno.ts arma lo que dibuja cada tarjeta, con
// test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaAnuncio, type DatosPieza } from '@/lib/anuncio-diseno';
import { HojaAnuncio } from './HojaAnuncio';

export default function AnuncioVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaAnuncio(hoja, datos, hoy), [hoja, datos, hoy]);
  return <HojaAnuncio hoja={hoja} vista={vista} titulo={hoja.nombre} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
