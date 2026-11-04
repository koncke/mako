'use client';

// =============================================================================
// OperacionVivo — la hoja «Operación diaria» con su diseño (./HojaOperacion.tsx) y los datos de VERDAD
// =============================================================================
// HojaOperacion sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo, como en
// ./GeneralVivo.tsx, con DOS fuentes:
//   · los datos de los bloques de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx);
//   · los de seis componentes de la hoja (`datos`, los que la página ya leyó): los cuatro números, los meses y lo que te deben.
//     lib/operacion-diseno.ts arma lo que dibuja cada parte, con test.
// El reloj (`useAhora`) llega después de montar. Tildar una tarea es la MISMA escritura que en los bloques de General
// (`useCompletar`, con «Deshacer»). Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Hoja } from '@/lib/graficos-catalogo';
import { vistaOperacion, type DatosPieza } from '@/lib/operacion-diseno';
import { useAhora } from '@/app/general/bloques/comun';
import { useCompletar } from '@/app/general/bloques/Plan';
import { useGeneral } from '../ElementoGeneral';
import { HojaOperacion } from './HojaOperacion';

export default function OperacionVivo({ hoja, hoy, datos, onGrilla, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; onGrilla?: () => void; compartido?: boolean;
}) {
  const g = useGeneral();
  const ahoraIso = useAhora();
  const { hechas, completar, toast } = useCompletar();
  const general = g?.datos ?? null;
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: todo lo de hoy «viene».
  const ahora = ahoraIso ? Date.parse(ahoraIso) : Date.parse(`${hoy}T00:00:00Z`);
  const vista = useMemo(() => (general ? vistaOperacion(general, hoja, datos, ahora) : null), [general, hoja, datos, ahora]);
  if (!vista) return null;
  const variables = g?.variables ?? {};
  const titulo = variables.nombre ? `${variables.saludo ?? 'Hola'}, ${variables.nombre}` : hoja.nombre;
  return (
    <HojaOperacion vista={vista} titulo={titulo} fecha={variables.fecha ?? null} hechas={hechas} onCompletar={(id) => completar({ id })}
      onGrilla={onGrilla} compartido={compartido} pie={toast} />
  );
}
