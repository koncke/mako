// =============================================================================
// copywriter/compartir-reglas — qué link deja EDITAR un guion (docs/diseno-copywriter.md, D9)
// =============================================================================
// «Tu cliente entra y edita lo que le presentás» (Martín a Teo, 28/10/2026): un guion se comparte con un link que
// EDITA, sin cuenta. El mecanismo es el de siempre (lib/shares.ts): una fila de `shares` con `recurso: 'copywriter'`,
// `alcance: 'item'`, `permiso: 'editar'` y el id de la página en `recurso_id`.
//
// Sin `server-only` a propósito: la condición vive acá para que los tests la importen (la usan la página pública Y la
// ruta que guarda, como `puedeVer` del lado de leer: si sólo la usara la página, cualquiera con un token vivo de otro
// recurso mandaría un POST).
// =============================================================================

import { puedeEditar, RECURSO_GUION, type Share } from '../shares';
import { esIdPagina, type GuionAbierto } from './tipos';
import type { CatalogosCopy } from './catalogos';

/**
 * El id del guion que este link deja EDITAR, o null. En POSITIVO (AGENTS.md, «Un guard sobre algo destructivo se
 * escribe en POSITIVO»): es un link del Copywriter, de un workspace válido, apunta a una página del Copywriter, y
 * `puedeEditar` —el punto de autorización de escritura de siempre— dice que alcanza para ESA página. El id sale de la
 * FILA, nunca del pedido.
 */
export function guionDelShare(share: Share): string | null {
  if (share.recurso !== RECURSO_GUION) return null;
  const ws = Number(share.workspace_id);
  if (!Number.isInteger(ws) || ws <= 0) return null;
  const id = share.recurso_id;
  if (!esIdPagina(id)) return null;
  return puedeEditar(share, RECURSO_GUION, id) ? id : null;
}

/**
 * Lo que viaja al navegador de quien entra con el link: el guion, sin dónde cuelga en el árbol del negocio (`padre`),
 * y de la biblioteca de MaKo SÓLO el ángulo y la estructura de ESTE guion (los nombres y las secciones que la página
 * dibuja). La biblioteca entera es del método de MaKo y no se reparte con un link.
 */
export function loQueViajaConElLink(g: GuionAbierto, c: CatalogosCopy): { guion: GuionAbierto; catalogos: CatalogosCopy } {
  const { angulo, estructura } = g.doc.props;
  return {
    guion: { pagina: { ...g.pagina, padre: null, orden: 0 }, doc: g.doc },
    catalogos: {
      angulos: angulo ? c.angulos.filter((a) => a.id === angulo) : [],
      estructuras: estructura ? c.estructuras.filter((e) => e.id === estructura) : [],
    },
  };
}
