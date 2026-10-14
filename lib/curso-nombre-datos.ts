import 'server-only';

// =============================================================================
// curso-nombre-datos — el nombre de base de cada curso, leído de la base
// =============================================================================
// La regla vive en lib/curso-nombre.ts (pura, con test). Esto la alimenta: el producto, sus ofertas
// principales y si están activas. Lo llaman TODOS los lugares que nombran un curso: el portal del
// alumno (lib/curso-portal.ts), el editor de la tab Curso, su vista previa y la ficha del cliente.
// Uno que lea `productos.nombre` por su cuenta vuelve a llamar al curso como el CRM.
//
// ⚠️ POR DEFAULT DEVUELVE EL NOMBRE DE BASE, SIN EL TÍTULO PUESTO A MANO: el editor y el portal
// aplican el título encima al dibujar (`tituloDe`), y si lo trajera adentro, borrar el título dejaría
// el viejo hasta recargar. Con `conTitulo` devuelve el nombre FINAL: para quien no dibuja el título
// encima (la ficha del equipo, el mail de invitación), que si no nombraría el curso distinto que el
// portal.
//
// ⚠️ LAS OFERTAS SON COSMÉTICAS PARA ESTO: si no se pueden leer, cada curso vuelve con el nombre de su
// producto (lo de siempre) y queda en el log. El producto sí se lee estricto: sin él no hay curso.

import { getTenantDb } from './workspace';
import { nombreBaseDelCurso, nombreDelCurso, type OfertaDelCurso } from './curso-nombre';

export async function nombresDeCursos(productoIds: readonly number[], opts: { conTitulo?: boolean } = {}): Promise<Map<number, string>> {
  const ids = [...new Set(productoIds.filter((n) => Number.isInteger(n) && n > 0))];
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const db = await getTenantDb();
  const { data: prods, error } = await db.from('productos').select('id, nombre').in('id', ids);
  if (error) throw new Error(error.message);

  const principales = new Map<number, OfertaDelCurso[]>();
  try {
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
    console.warn('[curso-nombre] no pude leer las ofertas; los cursos van con el nombre del producto:', e instanceof Error ? e.message : e);
    principales.clear();
  }

  for (const p of (prods ?? []) as Array<{ id: number; nombre: string | null }>) {
    out.set(Number(p.id), nombreBaseDelCurso(p.nombre, principales.get(Number(p.id)) ?? []));
  }
  if (opts.conTitulo && out.size) {
    // No tira: si el estilo no se lee vuelve el de siempre (lib/curso-estilo-datos.ts).
    const { estilosDeProductos } = await import('./curso-estilo-datos');
    const estilos = await estilosDeProductos([...out.keys()]);
    for (const [id, base] of out) out.set(id, nombreDelCurso(estilos.get(id)?.titulo, base));
  }
  return out;
}
