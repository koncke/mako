'use client';

// =============================================================================
// ComercialVivo — la hoja Comercial con su diseño (./HojaComercial.tsx) y los datos de VERDAD
// =============================================================================
// HojaComercial sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los datos
// de los componentes de la hoja (`datos`, los que la página ya leyó) y lo que trae la página aparte (`extras`: las llamadas de
// venta de hoy y quién mira). lib/comercial-diseno.ts arma lo que dibuja cada parte, con test. El reloj (`useAhora`) llega
// después de montar: hasta ahí, ninguna llamada de hoy «pasó». Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaComercial, type AgendaComercial, type DatosPieza } from '@/lib/comercial-diseno';
import { useAhora } from '@/app/general/bloques/comun';
import type { QuienMira } from './HojaClosing';
import { HojaComercial } from './HojaComercial';

export type ExtrasComercial = { agenda: AgendaComercial | null; quien: QuienMira | null };

export default function ComercialVivo({ hoja, hoy, datos, extras, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasComercial | null; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const ahoraIso = useAhora() ?? `${hoy}T00:00:00.000Z`;
  const vista = useMemo(() => vistaComercial(hoja, datos, extras?.agenda ?? null, hoy, ahoraIso), [hoja, datos, extras, hoy, ahoraIso]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaComercial hoja={hoja} vista={vista} titulo={titulo} fecha={quien?.fecha || null} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
