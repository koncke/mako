// =============================================================================
// /m/ads — mientras se leen Meta y el gasto: la FORMA de la pantalla, no un spinner
// =============================================================================
// El árbol de Meta son varias páginas de la Graph API cuando la caché venció, y el gasto es una
// lectura paginada: sin esto, tocar «Ads Manager» en More no hacía nada visible hasta que llegaba
// todo. El título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './ads.css';

export default function AdsCargando() {
  return (
    <div className="m-ads" aria-busy="true" aria-label="Cargando Ads Manager">
      <div className="m-ads-seg"><div className="mk-skel m-ads-skel-seg" /></div>
      <div className="m-ads-resumen"><SkeletonFilas filas={3} /></div>
      <div className="m-ads-skel-lista"><SkeletonFilas filas={4} /></div>
    </div>
  );
}
