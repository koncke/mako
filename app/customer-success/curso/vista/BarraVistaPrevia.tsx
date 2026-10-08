'use client';

// =============================================================================
// BarraVistaPrevia — la franja arriba de la vista del alumno: volver a editar, y que es una vista
// =============================================================================
// Tres cosas, y ninguna escribe nada del alumno:
//   · «← Volver a editar», a la tab Curso con el mismo producto. Por `ButtonLink` (app/_ui/Link):
//     lleva el `?ws=` de la pestaña, o el super admin que mira a un cliente volvería a SU curso.
//   · «Vista del alumno», a la derecha: dice qué es esta pantalla.
//   · Y al abrirse, anota el ensayo del onboarding (`curso_vista`) — sólo para un admin, que es quien
//     arma el curso. Es lo ÚNICO que se escribe, y va a `app_settings`, no al alumno.
//
// ⚠️ SIN EL DESPLEGABLE DE LA ETAPA desde el 08/10/2026 (item 2, Martín: «no entiendo por qué el
//    desplegable de "Bienvenida" de los módulos... Eso no tiene mucho sentido, quitalo. Allí mueve el
//    texto "Vista de alumno". Y en lugar que el botón diga "Volver al curso" que diga "<- Volver a
//    editar"»). Elegía «en qué etapa está el alumno» y se leía como un selector de módulos. La vista
//    previa es la del alumno el DÍA UNO (./page.tsx).
//
// Copy de pantalla: corto y de tú (AGENTS.md).

import { useEffect, useRef } from 'react';
import { ButtonLink, Status } from '@/app/_ui';
import { marcarVistaAlumnoAction } from '../actions';

/**
 * El destino de «Volver a editar»: la tab Curso con el producto que se estaba mirando. Sin exportar: un
 * valor de un archivo `'use client'` no es ese valor para el server (AGENTS.md, la frontera de datos).
 */
const hrefVolverAEditar = (productoId: number) => `/customer-success/curso?producto=${productoId}`;

export function BarraVistaPrevia({ productoId, anotar }: {
  productoId: number;
  /** ¿Anotar el ensayo del onboarding? Sólo un admin (el guard de verdad está en la action). */
  anotar: boolean;
}) {
  // Una vez por montaje: la action es idempotente, pero no hace falta pedirla en cada render.
  const anotado = useRef(false);
  useEffect(() => {
    if (!anotar || anotado.current) return;
    anotado.current = true;
    // Best-effort: si no se anota, la lista de la tab lo sigue pidiendo; nada se rompe.
    void marcarVistaAlumnoAction().catch(() => {});
  }, [anotar]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
    }}>
      <ButtonLink size="sm" variant="secondary" href={hrefVolverAEditar(productoId)}>{'←'} Volver a editar</ButtonLink>
      <span style={{ flex: 1 }} />
      <Status tono="info">Vista del alumno</Status>
    </div>
  );
}
