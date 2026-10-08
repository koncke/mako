'use client';

// =============================================================================
// ComunidadAlumno — la comunidad del producto, en el portal del ALUMNO
// =============================================================================
// Lo monta la pestaña «Comunidad» del portal (/compartido/curso/<token> y /mi-curso, otra pista):
//
//   <ComunidadAlumno token={token} productoId={producto.productoId} />
//
// con el MISMO token que ya recibe PortalAlumno (en /mi-curso, el `c1.` que se arma desde la cookie).
// Pide todo por POST a /api/compartido/comunidad con el token en el cuerpo (./api.ts, `apiDelAlumno`)
// y se dibuja con la paleta del portal del curso (`tema="alumno"`).
//
// ⚠️ EL LINK DE UN LÍDER DE ÁREA (`c2.`) NO ABRE LA COMUNIDAD (`actorDelAlumno`, lib/comunidad-datos.ts):
//    el líder no es un miembro, y con ese link escribiría con el nombre del cliente. Quien monte esto
//    puede no ofrecer la pestaña cuando `vista.area != null`; si igual se monta, dice que el acceso no
//    está activo.

import { useMemo } from 'react';
import { apiDelAlumno } from './api';
import { Comunidad } from './Comunidad';

export function ComunidadAlumno({ token, productoId }: { token: string; productoId: number }) {
  // Una API por token y producto: cambiar de producto es otra comunidad (y otra lista para mencionar).
  const api = useMemo(() => apiDelAlumno(token, productoId), [token, productoId]);
  return <Comunidad key={`${productoId}`} api={api} tema="alumno" />;
}

export default ComunidadAlumno;
