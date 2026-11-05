'use client';

// =============================================================================
// ServicioVivo — la hoja «Agencia o servicio» con su diseño (./HojaServicio.tsx) y los datos de VERDAD
// =============================================================================
// HojaServicio sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo, con DOS fuentes:
//   · los datos de los componentes de la hoja (`datos`, los que la página ya leyó): los números, quién avanzó, lo que te deben, la
//     cartera y las etapas;
//   · el Calendario, el Plan y el Semáforo de los datos de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx).
//     Sin ellos (un link compartido no los trae), esas tarjetas dicen que no pudieron leerlos.
// lib/servicio-diseno.ts arma lo que dibuja cada parte, con test. El reloj (`useAhora`) llega después de montar. Tildar una tarea es
// la MISMA escritura que en los bloques de General (`useCompletar`, con «Deshacer»). Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaServicio, type DatosPieza } from '@/lib/servicio-diseno';
import { useAhora } from '@/app/general/bloques/comun';
import { useCompletar } from '@/app/general/bloques/Plan';
import { useGeneral } from '../ElementoGeneral';
import { HojaServicio } from './HojaServicio';

export default function ServicioVivo({ hoja, hoy, datos, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const g = useGeneral();
  const ahoraIso = useAhora();
  const { hechas, completar, toast } = useCompletar();
  const general = g?.datos ?? null;
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: todo lo de hoy «viene».
  const ahora = ahoraIso ? Date.parse(ahoraIso) : Date.parse(`${hoy}T00:00:00Z`);
  const vista = useMemo(() => vistaServicio(hoja, datos, general, ahora), [hoja, datos, general, ahora]);
  const variables = g?.variables ?? {};
  const titulo = variables.nombre ? `${variables.saludo ?? 'Hola'}, ${variables.nombre}` : hoja.nombre;
  return (
    <HojaServicio hoja={hoja} vista={vista} titulo={titulo} fecha={variables.fecha ?? null} hechas={hechas}
      onCompletar={general ? (id) => completar({ id }) : undefined} onGrilla={onGrilla} onFila={onFila} compartido={compartido} pie={toast} />
  );
}
