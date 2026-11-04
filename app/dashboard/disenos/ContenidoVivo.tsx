'use client';

// =============================================================================
// ContenidoVivo — la hoja Contenido e IA con su diseño (./HojaContenido.tsx) y los datos de VERDAD
// =============================================================================
// HojaContenido sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo: los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó), quién mira (el saludo, que trae la página aparte) y el período
// de la hoja (el rótulo de arriba). lib/contenido-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con
// next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaContenido, type DatosPieza } from '@/lib/contenido-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaContenido } from './HojaContenido';

export type ExtrasContenido = { quien: QuienMira | null };

export default function ContenidoVivo({ hoja, datos, extras, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; datos: Record<string, DatosPieza>; extras: ExtrasContenido | null; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaContenido(hoja, datos), [hoja, datos]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaContenido hoja={hoja} vista={vista} titulo={titulo} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
