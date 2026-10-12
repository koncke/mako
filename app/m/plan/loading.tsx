// =============================================================================
// /m/plan — mientras se lee el tablero: la FORMA de la pantalla, no un spinner
// =============================================================================
// `leerPlanHoy` trae el tablero entero (tareas, proyectos, dependencias y borradores): sin
// esto, tocar «Plan» en la barra no hacía nada visible hasta que llegaba todo. El título
// grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './plan.css';

export default function PlanCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando el plan">
      <div className="m-plan-seg"><div className="mk-skel m-plan-skel-seg" /></div>
      <div className="m-plan-cuerpo"><SkeletonFilas filas={5} /></div>
    </div>
  );
}
