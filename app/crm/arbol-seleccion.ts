// =============================================================================
// Tildar y destildar en un filtro con forma de ÁRBOL (grupo › hijos)
// =============================================================================
// Lo usa el filtro «Anuncio» del CRM: las campañas son los grupos y sus anuncios los
// hijos (pedido de Martín, 10/10/2026: «Que dentro del filtro de "Anuncio" estén las
// campañas primero como arbol y dentro se pueda seleccionar anuncios de esas campañas»).
//
// Puro y sin 'server-only', a propósito: es la parte delicada del árbol y vive afuera del
// componente para que un test la EJECUTE (tests/crm-filtro-ads.test.ts). Adentro del menú
// sólo se la podría leer.
//
// Dos selecciones, y nunca se pisan: `grupos` = los elegidos ENTEROS (todo lo que trajo esa
// campaña, también los leads sin anuncio conocido) y `hijos` = los elegidos sueltos.
// =============================================================================

export type SeleccionArbol = { grupos: Set<string>; hijos: Set<string> };

/**
 * Tildar un grupo es elegirlo ENTERO: sus hijos sueltos se sueltan, porque ya los cubre.
 * Destildarlo lo saca, y sus hijos quedan sin elegir.
 */
export function alternarGrupo(sel: SeleccionArbol, grupo: string, hijosDelGrupo: string[]): SeleccionArbol {
  const grupos = new Set(sel.grupos);
  const hijos = new Set(sel.hijos);
  if (grupos.has(grupo)) {
    grupos.delete(grupo);
    return { grupos, hijos };
  }
  grupos.add(grupo);
  for (const h of hijosDelGrupo) hijos.delete(h);
  return { grupos, hijos };
}

/**
 * Tildar o destildar un hijo.
 *
 * ⚠️ Si su grupo estaba elegido ENTERO, destildar un hijo es «todos menos éste»: el grupo se
 * suelta y quedan elegidos sus OTROS hijos, que es lo que hace cualquier árbol con casillas.
 * Lo ingenuo —sacarlo de `hijos`, donde nunca estuvo— no cambia nada: el grupo entero lo
 * seguiría cubriendo y la casilla no se destildaría nunca.
 */
export function alternarHijo(sel: SeleccionArbol, grupo: string, hijo: string, hijosDelGrupo: string[]): SeleccionArbol {
  const grupos = new Set(sel.grupos);
  const hijos = new Set(sel.hijos);
  if (grupos.has(grupo)) {
    grupos.delete(grupo);
    for (const h of hijosDelGrupo) if (h !== hijo) hijos.add(h);
    return { grupos, hijos };
  }
  if (hijos.has(hijo)) hijos.delete(hijo);
  else hijos.add(hijo);
  return { grupos, hijos };
}

/**
 * Abrir o cerrar un grupo A MANO, sobre el registro de «los que están al revés de su
 * default» (con pocas campañas nacen abiertas; con muchas, cerradas). Se FIJA el estado
 * pedido, no se alterna: alternar a ciegas, con el buscador abierto (que muestra todo
 * desplegado), dejaba el registro al revés de lo que se ve.
 *
 * Lo usa la fila de la campaña: tildarla la despliega y destildarla la pliega — «Si
 * aprieto seleccionar una campaña se despliega, pero si deselecciono se debe volver a
 * plegar» (Martín, 10/10/2026).
 */
export function conGrupoAbierto(alternados: Set<string>, grupo: string, abrir: boolean, abiertoPorDefecto: boolean): Set<string> {
  const c = new Set(alternados);
  if (abrir === abiertoPorDefecto) c.delete(grupo);
  else c.add(grupo);
  return c;
}
