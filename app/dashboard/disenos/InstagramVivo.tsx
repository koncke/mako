'use client';

// =============================================================================
// InstagramVivo — la hoja «Instagram y redes» con su diseño (./HojaInstagram.tsx) y los datos de VERDAD
// =============================================================================
// HojaInstagram sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo, con DOS fuentes:
//   · los datos de los componentes de la hoja (`datos`, los que la página ya leyó): lo que te mostró Meta, cada red, quién te ve, los
//     anuncios, los leads de cada día y de dónde llegan;
//   · las publicaciones del Calendario de los datos de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx). Sin
//     ellos (un link compartido no los trae), esas tarjetas dicen que no pudieron leerlo.
// lib/instagram-diseno.ts arma lo que dibuja cada parte, con test. El reloj (`useAhora`) llega después de montar. Lo carga
// EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaInstagram, type DatosPieza } from '@/lib/instagram-diseno';
import { useAhora } from '@/app/general/bloques/comun';
import { useGeneral } from '../ElementoGeneral';
import { HojaInstagram } from './HojaInstagram';

export default function InstagramVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const g = useGeneral();
  const ahoraIso = useAhora();
  const general = g?.datos ?? null;
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: todo lo de hoy «viene».
  const ahora = ahoraIso ? Date.parse(ahoraIso) : Date.parse(`${hoy}T00:00:00Z`);
  const vista = useMemo(() => vistaInstagram(hoja, datos, general, ahora), [hoja, datos, general, ahora]);
  const variables = g?.variables ?? {};
  const titulo = variables.nombre ? `${variables.saludo ?? 'Hola'}, ${variables.nombre}` : hoja.nombre;
  return <HojaInstagram hoja={hoja} vista={vista} titulo={titulo} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
