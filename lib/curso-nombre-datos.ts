import 'server-only';

// =============================================================================
// curso-nombre-datos — el nombre de cada curso, leído de la base
// =============================================================================
// La regla vive en lib/curso-nombre.ts (pura, con test). Esto la alimenta: las ofertas principales de
// cada producto y si están activas. Lo llaman TODOS los lugares que nombran un curso: el portal del
// alumno (lib/curso-portal.ts), el editor de la tab Curso, su vista previa, la ficha del cliente, el
// mail de invitación (lib/curso-invitar.ts), la comunidad y la API de MaKo. Uno que lea
// `productos.nombre` por su cuenta vuelve a llamar al curso como el CRM, que es lo que Martín prohibió.
//
// ⚠️ EL MAPA TRAE SÓLO LOS CURSOS QUE TIENEN NOMBRE. Uno sin título ni oferta principal NO está, y
// quien dibuja pone su genérico (`SIN_NOMBRE_ALUMNO` / `SIN_NOMBRE_EQUIPO`). Por eso acá no se lee la
// tabla `productos`: no hay nada de ella que sirva para nombrar un curso.
//
// ⚠️ POR DEFAULT DEVUELVE EL NOMBRE DE BASE, SIN EL TÍTULO PUESTO A MANO: el editor y el portal
// aplican el título encima al dibujar (`tituloDe`), y si lo trajera adentro, borrar el título dejaría
// el viejo hasta recargar. Con `conTitulo` devuelve el nombre FINAL: para quien no dibuja el título
// encima (la ficha del equipo, el mail, la comunidad, la API).
//
// ⚠️ NO TIRA POR LAS OFERTAS: si no se pueden leer, los cursos vuelven sin nombre (el genérico) y queda
// en el log. Un nombre que no se pudo leer no es motivo para que no abra el portal.

import { getTenantDb } from './workspace';
import { nombreBaseDelCurso, nombreDelCurso, type OfertaDelCurso } from './curso-nombre';

export async function nombresDeCursos(productoIds: readonly number[], opts: { conTitulo?: boolean } = {}): Promise<Map<number, string>> {
  const ids = [...new Set(productoIds.filter((n) => Number.isInteger(n) && n > 0))];
  const out = new Map<number, string>();
  if (!ids.length) return out;

  const principales = new Map<number, OfertaDelCurso[]>();
  try {
    const db = await getTenantDb();
    const { data: ligas, error: e1 } = await db.from('oferta_productos').select('oferta_id, producto_id').in('producto_id', ids).eq('rol', 'principal');
    if (e1) throw new Error(e1.message);
    const ofertaIds = [...new Set(((ligas ?? []) as Array<{ oferta_id: number }>).map((l) => Number(l.oferta_id)))];
    if (ofertaIds.length) {
      const { data: ofs, error: e2 } = await db.from('ofertas').select('id, nombre, activa').in('id', ofertaIds);
      if (e2) throw new Error(e2.message);
      const oferta = new Map(((ofs ?? []) as Array<{ id: number; nombre: string | null; activa: boolean | null }>).map((o) => [Number(o.id), o]));
      for (const l of (ligas ?? []) as Array<{ oferta_id: number; producto_id: number }>) {
        const o = oferta.get(Number(l.oferta_id));
        if (!o) continue;
        const lista = principales.get(Number(l.producto_id)) ?? [];
        lista.push({ nombre: o.nombre, activa: o.activa });
        principales.set(Number(l.producto_id), lista);
      }
    }
  } catch (e) {
    console.warn('[curso-nombre] no pude leer las ofertas; los cursos van sin nombre:', e instanceof Error ? e.message : e);
    principales.clear();
  }

  // El título se lee para TODOS los pedidos con `conTitulo`, también los que no tienen oferta: un curso
  // sin oferta pero con título puesto a mano tiene nombre.
  const titulos = new Map<number, string | null>();
  if (opts.conTitulo) {
    // No tira: si el estilo no se lee vuelve el de siempre (lib/curso-estilo-datos.ts).
    const { estilosDeProductos } = await import('./curso-estilo-datos');
    const estilos = await estilosDeProductos(ids);
    for (const id of ids) titulos.set(id, estilos.get(id)?.titulo ?? null);
  }
  for (const id of ids) {
    const base = nombreBaseDelCurso(principales.get(id) ?? []);
    const nombre = opts.conTitulo ? nombreDelCurso(titulos.get(id), base) : base;
    if (nombre) out.set(id, nombre);
  }
  return out;
}
