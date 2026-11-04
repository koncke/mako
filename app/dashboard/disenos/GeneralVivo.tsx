'use client';

// =============================================================================
// GeneralVivo — la hoja General con su diseño (./HojaGeneral.tsx) y los datos de VERDAD
// =============================================================================
// HojaGeneral sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo, como en
// ./MiDiaVivo.tsx, con DOS fuentes:
//   · los datos de los bloques de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx);
//   · los de dos componentes de la hoja (`datos`, los que la página ya leyó): `meses` (lo cobrado y la inversión por mes) y
//     `deben` (lo que falta cobrar por tramo de atraso). lib/general-diseno.ts arma lo que dibuja cada parte, con test.
// El reloj (`useAhora`) llega después de montar: las llamadas que ya pasaron se sacan recién con él.
// Lo carga EditorInforme con next/dynamic: el Dashboard no se lleva esta hoja si no hay una General con diseño.
// =============================================================================

import { useMemo } from 'react';
import type { Hoja } from '@/lib/graficos-catalogo';
import { vistaGeneral, type DatosPieza } from '@/lib/general-diseno';
import { useAhora } from '@/app/general/bloques/comun';
import { useGeneral } from '../ElementoGeneral';
import { HojaGeneral } from './HojaGeneral';

export default function GeneralVivo({ hoja, hoy, datos, onGrilla, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; onGrilla?: () => void; compartido?: boolean;
}) {
  const g = useGeneral();
  const ahoraIso = useAhora();
  const general = g?.datos ?? null;
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: todo lo de hoy «viene».
  const ahora = ahoraIso ? Date.parse(ahoraIso) : Date.parse(`${hoy}T00:00:00Z`);
  const vista = useMemo(() => (general ? vistaGeneral(general, hoja, datos, ahora) : null), [general, hoja, datos, ahora]);
  if (!vista) return null;
  const variables = g?.variables ?? {};
  const titulo = variables.nombre ? `${variables.saludo ?? 'Hola'}, ${variables.nombre}` : hoja.nombre;
  return <HojaGeneral vista={vista} titulo={titulo} fecha={variables.fecha ?? null} onGrilla={onGrilla} compartido={compartido} />;
}
