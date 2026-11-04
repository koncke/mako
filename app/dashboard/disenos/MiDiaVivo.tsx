'use client';

// =============================================================================
// MiDiaVivo — la hoja «Mi día» con su diseño (./HojaMiDia.tsx) y los datos de VERDAD de General
// =============================================================================
// HojaMiDia sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo, igual que
// en ./FocusVivo.tsx:
//   · los datos son los de los bloques de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx) y
//     lib/mi-dia-diseno.ts arma lo que dibuja cada parte, con test;
//   · el reloj (`useAhora`) llega después de montar: la marca del ahora y lo que ya pasó no se dibujan en el server;
//   · tildar una tarea de hoy es la MISMA escritura que en los bloques de General (`useCompletar`, con «Deshacer»).
// Lo carga EditorInforme con next/dynamic: el Dashboard no se lleva esta hoja si no hay un «Mi día».
// =============================================================================

import { useMemo } from 'react';
import type { Hoja } from '@/lib/graficos-catalogo';
import { vistaMiDia } from '@/lib/mi-dia-diseno';
import { ZONA_POR_DEFECTO } from '@/lib/zona-negocio-reglas';
import { useAhora } from '@/app/general/bloques/comun';
import { useCompletar } from '@/app/general/bloques/Plan';
import type { DatosGeneral } from '@/app/general/datos-tipos';
import { useGeneral } from '../ElementoGeneral';
import { HojaMiDia } from './HojaMiDia';

export default function MiDiaVivo({ hoja, hoy, onGrilla, compartido }: { hoja: Hoja; hoy: string; onGrilla?: () => void; compartido?: boolean }) {
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
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: todo lo de hoy «viene».
  const vista = useMemo(() => vistaMiDia(datos, ahora ?? Date.parse(`${hoy}T00:00:00Z`)), [datos, ahora, hoy]);
  const tz = datos.calendario.ok ? datos.calendario.d.tz : ZONA_POR_DEFECTO;
  const titulo = variables.nombre ? `${variables.saludo ?? 'Hola'}, ${variables.nombre}` : hoja.nombre;
  return (
    <HojaMiDia vista={vista} titulo={titulo} fecha={variables.fecha ?? null} tz={tz} ahora={ahora}
      hechas={hechas} onCompletar={(id) => completar({ id })} onGrilla={onGrilla} compartido={compartido} pie={toast} />
  );
}
