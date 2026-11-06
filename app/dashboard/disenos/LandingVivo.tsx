'use client';

// =============================================================================
// LandingVivo — la hoja Landing con su diseño (./HojaLanding.tsx) y los datos de VERDAD
// =============================================================================
// HojaLanding sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los datos de
// los componentes de la hoja (`datos`, los que la página ya leyó) y quién mira (el saludo, que trae la página aparte).
// lib/landing-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaLanding, type DatosPieza } from '@/lib/landing-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaLanding } from './HojaLanding';

export type ExtrasLanding = { quien: QuienMira | null };

export default function LandingVivo({ hoja, hoy, datos, extras, periodo, onGrilla, onPeriodo, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasLanding | null; periodo: string;
  onGrilla?: () => void; onPeriodo?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaLanding(hoja, datos, hoy), [hoja, datos, hoy]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaLanding hoja={hoja} vista={vista} titulo={titulo} periodo={periodo} onGrilla={onGrilla} onPeriodo={onPeriodo} onFila={onFila} compartido={compartido} />;
}
