'use client';

// =============================================================================
// AutomatizacionesVivo — la hoja Automatizaciones con su diseño (./HojaAutomatizaciones.tsx) y los datos de VERDAD
// =============================================================================
// HojaAutomatizaciones sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los
// datos de los componentes de la hoja (`datos`, los que la página ya leyó) y quién mira (el saludo, que trae la página aparte).
// lib/automatizaciones-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaAutomatizaciones, type DatosPieza } from '@/lib/automatizaciones-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaAutomatizaciones } from './HojaAutomatizaciones';

export type ExtrasAutomatizaciones = { quien: QuienMira | null };

export default function AutomatizacionesVivo({ hoja, hoy, datos, extras, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasAutomatizaciones | null; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaAutomatizaciones(hoja, datos, hoy), [hoja, datos, hoy]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaAutomatizaciones hoja={hoja} vista={vista} titulo={titulo} periodo={periodo} hoy={hoy} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
