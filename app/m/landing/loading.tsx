// =============================================================================
// /m/landing — mientras se leen las landings: la FORMA de la lista, no un spinner
// =============================================================================
// El título grande lo sigue poniendo el shell. Los números de cada fila llegan después, cada uno
// en su Suspense (page.tsx): esto cubre sólo la primera lectura.

import { SkeletonFilas } from '@/app/m/_ui';

export default function LandingCargando() {
  return <SkeletonFilas filas={3} />;
}
