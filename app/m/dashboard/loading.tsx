// =============================================================================
// /m/dashboard — mientras se leen los números: la FORMA de la pantalla, no un spinner
// =============================================================================
// La pauta y los cobros tardan (lecturas paginadas): sin esto, tocar «Dashboard» en More no hacía
// nada visible hasta que llegaba todo. El título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './dashboard.css';

export default function DashboardCargando() {
  return (
    <div className="m-dash" aria-busy="true" aria-label="Cargando el Dashboard">
      <div className="m-dash-seg"><div className="mk-skel m-dash-skel-seg" /></div>
      <div className="mk-skel m-dash-skel-graf" />
      <div className="m-dash-skel-lista"><SkeletonFilas filas={5} /></div>
    </div>
  );
}
