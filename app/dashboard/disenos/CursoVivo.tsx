'use client';

// =============================================================================
// CursoVivo — la hoja «Curso o comunidad» con su diseño (./HojaCurso.tsx) y los datos de VERDAD
// =============================================================================
// HojaCurso sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Aquí se arma lo vivo, con DOS fuentes:
//   · los datos de los componentes de la hoja (`datos`, los que la página ya leyó): los números, lo que vieron, el avance, las
//     áreas y la cartera;
//   · el Calendario de los datos de General (`useGeneral().datos`, que pone app/general/ProveedorGeneral.tsx): lo que vas a
//     publicar y lo de hoy. Sin ellos (un link compartido no los trae), esas dos tarjetas dicen que no pudieron leerlo.
// lib/curso-diseno.ts arma lo que dibuja cada parte, con test. El reloj (`useAhora`) llega después de montar. Lo carga EditorInforme
// con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaCurso, type DatosPieza } from '@/lib/curso-diseno';
import { useAhora } from '@/app/general/bloques/comun';
import { useGeneral } from '../ElementoGeneral';
import { HojaCurso } from './HojaCurso';

export default function CursoVivo({ hoja, hoy, datos, periodo, onGrilla, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; periodo: string;
  onGrilla?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const g = useGeneral();
  const ahoraIso = useAhora();
  const general = g?.datos ?? null;
  // Sin reloj todavía (el server, el primer cuadro), el día empieza a la medianoche: todo lo de hoy «viene».
  const ahora = ahoraIso ? Date.parse(ahoraIso) : Date.parse(`${hoy}T00:00:00Z`);
  const vista = useMemo(() => vistaCurso(hoja, datos, general, ahora), [hoja, datos, general, ahora]);
  // El título es el de la frase de apertura («Tus alumnos»), como el «Studio Overview» de Vitrea; sin ella, el nombre de la hoja.
  const apertura = hoja.componentes.find((c): c is Grafico => c.id === hoja.diseno?.piezas.apertura && c.clase === 'grafico');
  const titulo = apertura?.titulo?.trim() || hoja.nombre;
  return <HojaCurso hoja={hoja} vista={vista} titulo={titulo} periodo={periodo} onGrilla={onGrilla} onFila={onFila} compartido={compartido} />;
}
