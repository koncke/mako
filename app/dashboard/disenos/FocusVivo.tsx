'use client';

// =============================================================================
// FocusVivo — la hoja Focus con su diseño (./HojaFocus.tsx) y los datos de VERDAD de General
// =============================================================================
// HojaFocus sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo:
//   · los datos son los de los bloques de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx) y
//     lib/focus-diseno.ts arma lo que dibuja cada parte, con test;
//   · el reloj (`useAhora`) llega después de montar: «en 20 min» y las llamadas que ya pasaron no se dibujan en el server;
//   · completar una tarea es la MISMA escritura que en los bloques de General (`useCompletar`, con «Deshacer»);
//   · la meta se edita o se carga con el editor de siempre (app/general/EditarObjetivo.tsx).
// Lo carga EditorInforme con next/dynamic: el Dashboard no se lleva el Plan ni el editor de la meta si no hay un Focus.
// =============================================================================

import { useMemo } from 'react';
import type { Hoja } from '@/lib/graficos-catalogo';
import { subtituloFocus, vistaFocus } from '@/lib/focus-diseno';
import { ZONA_POR_DEFECTO } from '@/lib/zona-negocio-reglas';
import { useAhora } from '@/app/general/bloques/comun';
import { useCompletar } from '@/app/general/bloques/Plan';
import { EditarObjetivo } from '@/app/general/EditarObjetivo';
import { projProgress } from '@/app/plan/board/piezas';
import type { DatosGeneral } from '@/app/general/datos-tipos';
import { useGeneral } from '../ElementoGeneral';
import { HojaFocus } from './HojaFocus';

export default function FocusVivo({ hoja, hoy, onGrilla, compartido }: { hoja: Hoja; hoy: string; onGrilla?: () => void; compartido?: boolean }) {
  const g = useGeneral();
  const datos = g?.datos ?? null;
  return datos ? <ConDatos hoja={hoja} hoy={hoy} datos={datos} variables={g?.variables ?? {}} onGrilla={onGrilla} compartido={compartido} /> : null;
}

function ConDatos({ hoja, hoy, datos, variables, onGrilla, compartido }: {
  hoja: Hoja; hoy: string; datos: DatosGeneral; variables: Partial<Record<string, string>>; onGrilla?: () => void; compartido?: boolean;
}) {
  const ahoraIso = useAhora();
  const ahora = ahoraIso ? Date.parse(ahoraIso) : null;
  const { hechas, completar, toast } = useCompletar();
  const plan = datos.plan.ok ? datos.plan.d : null;
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: «lo que viene» es todo lo de hoy.
  const vista = useMemo(
    () => vistaFocus(datos, ahora ?? Date.parse(`${hoy}T00:00:00Z`), (id) => projProgress(plan?.tareasDeProyectos ?? [], id)),
    [datos, ahora, hoy, plan],
  );
  const tz = datos.calendario.ok ? datos.calendario.d.tz : ZONA_POR_DEFECTO;
  const titulo = variables.nombre ? `${variables.saludo ?? 'Hola'}, ${variables.nombre}` : hoja.nombre;
  const sub = subtituloFocus(variables.fecha, vista.resumen.llamadas?.total ?? null, vista.resumen.tareas?.total ?? null);
  const cab = datos.cabecera.ok ? datos.cabecera.d : null;
  const metaAccion = cab && !compartido ? (
    <EditarObjetivo objetivo={cab.objetivo} anio={cab.anio} quarter={cab.quarter}
      disparador={<span className="fp-btn fp-btn--accent fp-focus__go">{cab.objetivo ? 'Editar la meta' : 'Cargar la meta'}</span>} />
  ) : null;
  return (
    <HojaFocus vista={vista} titulo={titulo} sub={sub} hoy={hoy} tz={tz} ahora={ahora} metaAccion={metaAccion}
      hechas={hechas} onCompletar={(id) => completar({ id })} onGrilla={onGrilla} compartido={compartido} pie={toast} />
  );
}
