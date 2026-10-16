import 'server-only';

// =============================================================================
// /m/comunidad — lo que lee la Comunidad del teléfono (server)
// =============================================================================
// Las MISMAS lecturas que app/customer-success/comunidad/page.tsx, con las mismas funciones (nada copiado):
// los productos de Customer Success (`productosDeLaEntrega`, la lista del kanban y del Curso) con el nombre
// de su CURSO (`nombresDeCursos`, nunca el del producto del CRM), el producto de `?producto=` o el del post
// de `?post=` (`productoDelPost`), quién mira (`actorDelEquipo`, la puerta de todas las actions de
// escritorio) y la comunidad con la primera página del feed (`inicioComunidad` + `feedComunidad`).
//
// ⚠️ EL WORKSPACE ES EL DEL REQUEST (`getWorkspaceActual`, y adentro de cada lectura `actor.ws`). Nada sale
//    de `?ws=`: `?producto=` y `?post=` son las claves de escritorio (QUERY_DE_SECCION) y se validan contra
//    lo de ESTE negocio (`productoDelWorkspace` dentro del actor).
// ⚠️ SI FALLA, FALLA VISIBLE (como escritorio): «No pude cargar la comunidad» en vez de un feed vacío, que se
//    leería como una comunidad sin nadie.
// ⚠️ NO ESCRIBE NADA DE LA TAB: escritorio anota los pasos de su onboarding en cada carga
//    (`sincronizarOnboardingComunidad`); el teléfono no (docs/hallazgos-mobile.md, «Sin hacer»). Lo único
//    que se escribe es lo que ya escribe leer el feed en escritorio (`marcarActividad`: «en línea»).
// ⚠️ EL HILO DE UNA CLASE (comunidad_posts con `clase_id`, mig 0227) NO SE LEE ACÁ: el feed ya lo saca
//    (`feedComunidad`), y un `?post=` que apunta a uno lo abre `detallePost` con la puerta de `postDe` (lo
//    ve quien ve la clase). Esta carpeta no consulta la tabla: tests/curso-comentarios-clase.test.ts barre
//    los lectores.

import { feedComunidad, inicioComunidad, productoDelPost } from '@/lib/comunidad-datos';
import type { ComunidadVista, FeedVista } from '@/lib/comunidad-tipos';
import { getWorkspaceActual } from '@/lib/workspace';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { SIN_NOMBRE_EQUIPO } from '@/lib/curso-nombre';
import { productosDeLaEntrega } from '@/app/customer-success/entrega';
import { actorDelEquipo } from '@/app/customer-success/comunidad/actor';
import { R, idDeUrl, productoElegido } from './modelo';

export type ProductoComunidad = { id: number; nombre: string };

export type LecturaComunidad =
  | { tipo: 'sin-productos' }
  /** Una lectura que se cayó: se reintenta. */
  | { tipo: 'error'; frase: string }
  /** El actor no pasa (sesión, plan, cuenta propia): no es algo que un reintento arregle. */
  | { tipo: 'cerrada'; frase: string }
  | {
    tipo: 'ok';
    productos: ProductoComunidad[];
    productoId: number;
    comunidad: ComunidadVista;
    feed: FeedVista;
    /** El post de `?post=` (el link de la ficha a lo que publicó un alumno): se abre una vez. */
    postInicial: number | null;
  };

const mensaje = (e: unknown): string => (e instanceof Error && e.message ? e.message : String(e));

export async function leerComunidad(sp: { producto?: string | string[]; post?: string | string[] }): Promise<LecturaComunidad> {
  const postInicial = idDeUrl(sp.post);

  let productos: ProductoComunidad[];
  try {
    const lista = await productosDeLaEntrega();
    const nombres = await nombresDeCursos(lista.map((p) => p.id), { conTitulo: true }).catch(() => new Map<number, string>());
    productos = lista.map((p) => ({ id: p.id, nombre: nombres.get(p.id) ?? SIN_NOMBRE_EQUIPO }));
  } catch (e) {
    console.error('[m/comunidad] productosDeLaEntrega:', mensaje(e));
    return { tipo: 'error', frase: R.sinLeerProductos };
  }
  if (!productos.length) return { tipo: 'sin-productos' };

  // Sin `?producto=`, el producto sale del post: el link de la ficha no sabe de cuál es (escritorio).
  let pedido = idDeUrl(sp.producto);
  if (pedido == null && postInicial != null) {
    const ws = await getWorkspaceActual();
    pedido = ws ? await productoDelPost(ws, postInicial).catch(() => null) : null;
  }
  const productoId = productoElegido(productos, pedido);
  if (productoId == null) return { tipo: 'sin-productos' };

  const actor = await actorDelEquipo(productoId);
  if (typeof actor === 'string') return { tipo: 'cerrada', frase: actor };

  try {
    const [comunidad, feed] = await Promise.all([inicioComunidad(actor), feedComunidad(actor, {})]);
    return { tipo: 'ok', productos, productoId, comunidad, feed, postInicial };
  } catch (e) {
    console.error('[m/comunidad] inicioComunidad/feedComunidad:', mensaje(e));
    return { tipo: 'error', frase: `${R.noPudeCargar}.` };
  }
}
