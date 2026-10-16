// =============================================================================
// /m/curso — mientras se lee el curso: la FORMA de la pantalla, no un spinner
// =============================================================================
// ./datos.ts lee la cartera de la entrega (servicios, etapas, clientes y secuencias de cada producto),
// las clases de cada curso y el progreso de cada cliente ganado (paginado: clientes × clases pasa las
// 1000 filas en el ws1). Sin esto, tocar «Curso» en More dejaba More congelado hasta que llegaba todo. La
// fila del curso y dos módulos con sus clases; el título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './curso.css';

export default function CursoCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando el curso">
      <div className="mk-skel m-curso-skel-curso" />
      <div className="mk-skel m-curso-skel-titulo" />
      <SkeletonFilas filas={3} />
      <div className="mk-skel m-curso-skel-titulo" />
      <SkeletonFilas filas={2} />
    </div>
  );
}
