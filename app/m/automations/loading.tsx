// =============================================================================
// /m/automations — mientras se leen las automatizaciones: la FORMA de la lista, no un spinner
// =============================================================================
// `getSettingData` lee paginados los envíos de 30 días y todas las inscripciones: sin esto, tocar
// «Automations» en More no hacía nada visible hasta que llegaba todo. El título grande lo pone el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './automations.css';

export default function AutomationsCargando() {
  return (
    <div className="m-auto-skel" aria-busy="true" aria-label="Cargando Automations">
      <SkeletonFilas filas={4} />
    </div>
  );
}
