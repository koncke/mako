'use client';

// =============================================================================
// CsVivo — la hoja CS Analyst con su diseño (./HojaCs.tsx) y los datos de VERDAD
// =============================================================================
// HojaCs sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los datos de los
// componentes de la hoja (`datos`, los que la página ya leyó), quién mira (el saludo) y el ORDEN de las etapas de la entrega (lo
// lee la página aparte: la pieza de las etapas las ordena de la que más clientes tiene a la que menos, y un carril va en el orden
// del servicio). lib/cs-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaCs, type DatosPieza } from '@/lib/cs-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaCs } from './HojaCs';

/** `etapas`: las de la entrega de cada servicio, en su orden (null si no se pudo leer: los carriles van por cuántos tienen). */
export type ExtrasCs = { quien: QuienMira | null; etapas: string[] | null };

export default function CsVivo({ hoja, datos, extras, onGrilla, onFila, compartido }: {
  hoja: Hoja; datos: Record<string, DatosPieza>; extras: ExtrasCs | null;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const etapas = extras?.etapas ?? null;
  const vista = useMemo(() => vistaCs(hoja, datos, etapas), [hoja, datos, etapas]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaCs hoja={hoja} vista={vista} titulo={titulo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
