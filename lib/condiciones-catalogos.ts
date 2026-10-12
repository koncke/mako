// =============================================================================
// condiciones-catalogos — EL catálogo con que se arman las condiciones (puro, lo usan la pantalla y la IA)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.3). Pedido de Martín, textual: «apareció en
// condiciones una condición llamada pagó que no existía dentro del desplegable, eso jamás tiene que pasar. Siempre
// tiene que seleccionar las cosas que existen dentro del desplegable».
//
// `catalogosDe` vivía en app/automations/EditorCondicion.tsx: «Crear con IA» no lo podía importar, así que el modelo
// no veía el catálogo con el que el editor arma su desplegable (`seccionesDeCondiciones`). Ahora vive acá y lo usan:
//   · el editor (EditorCondicion lo importa y lo re-exporta, para el lienzo y «Probar»);
//   · `armarContexto` (lib/flujo-ia-crear.ts), que llena `ctx.catalogoCondicion`.
// Lo remoto (cursos, posts, campañas, reuniones) lo lee `catalogosRemotos` (lib/condiciones-catalogo-datos.ts), la
// MISMA función que contesta GET /api/chat-agent/condiciones al editor.
// =============================================================================

import type { CatalogosCondicion, CursoCondicion, ProductoCondicion, ReunionesDeEmbudo } from './condiciones-catalogo';

/** Las etapas de venta de UN producto (la forma de `SeccionEtapas` de FlujoLienzo). */
export type EtapasDeProducto = { title: string; funnelId: number; options: Array<{ value: string; label: string }> };

/** Lo que trae GET /api/chat-agent/condiciones (`catalogosRemotos`). `reuniones` en null = no se pudo leer. */
export type CatalogosRemotos = {
  cursos: CursoCondicion[]; posts: Array<{ id: number; titulo: string }>; campanas: string[];
  reuniones?: ReunionesDeEmbudo[] | null;
};

/** Los catálogos juntos, en la forma que piden las funciones del catálogo. */
export function catalogosDe(p: { etapas: readonly EtapasDeProducto[]; productos: readonly ProductoCondicion[]; remotos: CatalogosRemotos | null }): CatalogosCondicion {
  return {
    etapas: p.etapas, productos: p.productos, cursos: p.remotos?.cursos, posts: p.remotos?.posts, campanas: p.remotos?.campanas,
    // undefined = todavía no llegó; null = no se pudo leer. Las dos dejan el selector apagado.
    reuniones: p.remotos ? p.remotos.reuniones ?? null : undefined,
  };
}

/**
 * LAS ETAPAS DE VENTA QUE LE LLEGAN AL EDITOR DE LA CONDICIÓN, armadas desde los productos (`productosConEtapas`): una
 * sección por producto CON embudo y con etapas; con un solo producto, el título es «Etapas». La usan el lienzo
 * (app/automations/SecuenciaPerfil.tsx, `etapasCond`) y la IA (`armarContexto`): las dos ven lo mismo.
 */
export function etapasDeCondicion(productos: ReadonlyArray<{ funnelId: number | null; nombre: string; etapas: ReadonlyArray<{ value: string; label: string }> }>): EtapasDeProducto[] {
  return productos.flatMap((pr) => (pr.funnelId == null || !pr.etapas.length ? [] : [{
    title: productos.length > 1 ? pr.nombre : 'Etapas', funnelId: pr.funnelId, options: pr.etapas.map((o) => ({ value: o.value, label: o.label })),
  }]));
}
