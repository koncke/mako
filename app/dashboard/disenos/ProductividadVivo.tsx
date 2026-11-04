'use client';

// =============================================================================
// ProductividadVivo — la hoja Productividad con su diseño (./HojaProductividad.tsx) y los datos de VERDAD
// =============================================================================
// HojaProductividad sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó) y quién mira (el saludo, que trae la página aparte).
// lib/productividad-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaProductividad, type DatosPieza } from '@/lib/productividad-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaProductividad } from './HojaProductividad';

export type ExtrasProductividad = { quien: QuienMira | null };

export default function ProductividadVivo({ hoja, hoy, datos, extras, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasProductividad | null;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaProductividad(hoja, datos, hoy), [hoja, datos, hoy]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaProductividad hoja={hoja} vista={vista} titulo={titulo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
