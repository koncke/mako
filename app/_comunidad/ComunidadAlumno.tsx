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

//
// ⚠️ SI LA COMUNIDAD CONTESTA QUE NO ENTRA, SE VUELVE A MIRAR LA ENTRADA DEL PORTAL, UNA VEZ (f33, 24/10/2026). Sacar a
//    un alumno le saca también el curso: con el portal ya abierto, la comunidad era lo primero en enterarse y decía
//    otra cosa que el curso. Con el `refresh`, un acceso cortado muestra la frase de la entrada en todo el portal, y un
//    curso que ya no ve deja de aparecer. Una sola vez: si el server sigue mostrando la comunidad, no hay vuelta.
import { useMemo, useRef } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { SIN_ACCESO_PORTAL } from '@/lib/curso-portal-aviso';
import { apiDelAlumno, type ApiComunidad } from './api';
import { Comunidad } from './Comunidad';

export function ComunidadAlumno({ token, productoId }: { token: string; productoId: number }) {
  // Una API por token y producto: cambiar de producto es otra comunidad (y otra lista para mencionar).
  const router = useRouter();
  const mirada = useRef(false);
  const api = useMemo((): ApiComunidad => {
    const base = apiDelAlumno(token, productoId);
    return {
      ...base,
      inicio: async () => {
        const r = await base.inicio();
        if (!r.ok && r.error === SIN_ACCESO_PORTAL && !mirada.current) { mirada.current = true; router.refresh(); }
        return r;
      },
    };
  }, [token, productoId, router]);
  return <Comunidad key={`${productoId}`} api={api} tema="alumno" />;
}

export default ComunidadAlumno;
