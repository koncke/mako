'use client';

// =============================================================================
// MarketingVivo — la hoja Marketing con su diseño (./HojaMarketing.tsx) y los datos de VERDAD
// =============================================================================
// HojaMarketing sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó) y quién mira (el saludo, que trae la página aparte).
// lib/marketing-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaMarketing, type DatosPieza } from '@/lib/marketing-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaMarketing } from './HojaMarketing';

export type ExtrasMarketing = { quien: QuienMira | null };

export default function MarketingVivo({ hoja, hoy, datos, extras, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasMarketing | null; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaMarketing(hoja, datos, hoy), [hoja, datos, hoy]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaMarketing hoja={hoja} vista={vista} titulo={titulo} fecha={quien?.fecha || null} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
