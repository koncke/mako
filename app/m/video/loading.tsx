// =============================================================================
// /m/video — mientras se leen el historial y los montajes: la FORMA de la lista, no un spinner
// =============================================================================
// El título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './video.css';

export default function VideoCargando() {
  return <div aria-busy="true" aria-label="Cargando Video Generator"><SkeletonFilas filas={3} /></div>;
}
