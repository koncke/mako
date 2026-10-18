// =============================================================================
// cerebro-union — UN SOLO grafo para el super admin: el negocio y la construcción de MaKo (17/10/2026)
// =============================================================================
// Martín, 17/10/2026: «en SuperAdmin no pongas 2 grafos, todo 1 solo... Para eso existen los filtros para ver desarrollo
// o ventas o marketing». Hasta hoy `VistaCerebro` dibujaba DOS `<Grafo>` y un selector «Negocio / Construcción». Ahora se
// dibuja uno: esto junta los dos `Cerebro` en uno, y las capas son un atajo del filtro de carpetas (cerebro-filtro.ts).
//
// PURO, sin `server-only` y sin React: lo llama el cliente (VistaCerebro, a cada vuelta del grafo vivo) y lo prueba
// tests/second-brain-grafo-movil.test.ts sin base. No corre ninguna física: el layout de ~180 nodos de la construcción
// cuesta segundos (docs/hallazgos-second-brain.md), así que las dos nubes ya asentadas se PONEN lado a lado.
//
// QUÉ NO SE PIERDE: ningún nodo ni ninguna arista de los dos grafos. Lo único que cambia es el id de la raíz de la
// construcción (`raiz` choca con la del negocio): pasa a `n1:obra`, que es lo que es, la carpeta madre de su nube.
// Cualquier otro id que chocara se prefija con `obra:` (hoy no choca ninguno; el test lo mira).
//
// ⚠️ NO HAY UNA ARISTA ENTRE LAS DOS RAÍCES, a propósito: una arista se dibuja sólo si significa algo verificable, y «la
//    construcción de MaKo» no es parte del negocio que se mira (el super admin puede estar mirando el de un cliente).
//    Son dos nubes en el mismo lienzo, con las mismas barra lateral, búsqueda y filtros.
// =============================================================================

import {
  AREAS, CAPA_CONSTRUCCION, CAPA_NEGOCIO, TAXONOMIA_NEGOCIO,
  type AristaCerebro, type Cerebro, type Encuadre, type NodoCerebro, type Punto, type Taxonomia,
} from './cerebro-modelo';
import type { EstadoFiltro } from './cerebro-filtro';

export { CAPA_CONSTRUCCION, CAPA_NEGOCIO };
/** La raíz de la construcción dentro del mapa único. */
export const ID_RAIZ_OBRA = 'n1:obra';

/** Cuánto aire entre las dos nubes, como fracción del lado más grande de las dos. */
const AIRE_ENTRE_NUBES = 0.18;

const IDS_AREAS_NEGOCIO: ReadonlySet<string> = new Set(AREAS.map((a) => a.id));
/** ¿Esta área es una de las diez del negocio? Sólo ésas se editan («Editar» en la barra lateral). */
export const esAreaDeNegocio = (area: string): boolean => IDS_AREAS_NEGOCIO.has(area);

/** La taxonomía de las dos capas juntas, con la capa de cada carpeta. */
export function unirTaxonomias(negocio: Taxonomia, obra: Taxonomia): Taxonomia {
  return {
    carpetas: [...negocio.carpetas, ...obra.carpetas],
    areas: [...negocio.areas, ...obra.areas],
    capas: [
      { id: CAPA_NEGOCIO, nombre: 'Negocio', carpetas: negocio.carpetas.map((c) => c.id) },
      { id: CAPA_CONSTRUCCION, nombre: 'Construcción de MaKo', carpetas: obra.carpetas.map((c) => c.id) },
    ],
  };
}

/** Los dos cerebros en uno. `negocio` es el del workspace que se mira; `obra`, la construcción de MaKo. */
export function unirCerebros(negocio: Cerebro<string>, obra: Cerebro<string>): Cerebro<string> {
  const taxNegocio = negocio.taxonomia ?? TAXONOMIA_NEGOCIO;
  const taxObra = obra.taxonomia ?? TAXONOMIA_NEGOCIO;

  // Los ids de la construcción que chocan con los del negocio (siempre `raiz`) cambian; el resto queda igual.
  const delNegocio = new Set(negocio.nodos.map((n) => n.id));
  const idNuevo = (id: string): string => (id === 'raiz' ? ID_RAIZ_OBRA : delNegocio.has(id) ? `obra:${id}` : id);

  // Las dos nubes lado a lado: la de la construcción a la derecha, centrada en vertical con la del negocio.
  const vacio = negocio.nodos.length === 0;
  const en = negocio.encuadre;
  const eo = obra.encuadre;
  const aire = Math.max(en.lado, eo.lado) * AIRE_ENTRE_NUBES;
  const dx = vacio ? 0 : en.x + en.lado + aire - eo.x;
  const dy = vacio ? 0 : en.y + en.lado / 2 - (eo.y + eo.lado / 2);

  const nodosObra: NodoCerebro<string>[] = obra.nodos.map((n) => ({ ...n, id: idNuevo(n.id) }));
  const aristasObra: AristaCerebro[] = obra.aristas.map((a) => ({ ...a, de: idNuevo(a.de), a: idNuevo(a.a) }));
  const posiciones: Record<string, Punto> = { ...negocio.posiciones };
  for (const [id, p] of Object.entries(obra.posiciones)) posiciones[idNuevo(id)] = { x: p.x + dx, y: p.y + dy };

  // El encuadre que abarca las dos cajas (cuadrado, como el resto del modelo): `ajustar()` del grafo encuadra contra el
  // bbox real de los nodos, así que esto sólo fija la escala del viewBox.
  const cajas: Encuadre[] = vacio ? [eo] : [en, { x: eo.x + dx, y: eo.y + dy, lado: eo.lado }];
  const x0 = Math.min(...cajas.map((c) => c.x));
  const y0 = Math.min(...cajas.map((c) => c.y));
  const x1 = Math.max(...cajas.map((c) => c.x + c.lado));
  const y1 = Math.max(...cajas.map((c) => c.y + c.lado));
  const lado = Math.max(x1 - x0, y1 - y0);
  const encuadre: Encuadre = { x: (x0 + x1) / 2 - lado / 2, y: (y0 + y1) / 2 - lado / 2, lado };

  return {
    negocio: negocio.negocio,
    nodos: [...negocio.nodos, ...nodosObra],
    aristas: [...negocio.aristas, ...aristasObra],
    cuenta: {
      total: negocio.cuenta.total + obra.cuenta.total,
      mako: negocio.cuenta.mako + obra.cuenta.mako,
      usuario: negocio.cuenta.usuario + obra.cuenta.usuario,
      pendientes: negocio.cuenta.pendientes + obra.cuenta.pendientes,
    },
    vacias: [...negocio.vacias],
    posiciones,
    encuadre,
    huella: negocio.huella,
    taxonomia: unirTaxonomias(taxNegocio, taxObra),
  };
}

/** Lo que «Exportar» puede bajar del filtro puesto: sólo existe el ZIP del negocio, no el de la construcción.
 *  Devuelve el filtro recortado a lo del negocio, o `null` si lo que se mira es SÓLO la construcción (ahí no hay nada
 *  del negocio que bajar, y un filtro vacío bajaría TODO el negocio, que no es lo que se está viendo). */
export function filtroDelNegocio(f: EstadoFiltro, tax: Taxonomia): EstadoFiltro | null {
  const carpetasNegocio = new Set(tax.capas?.find((c) => c.id === CAPA_NEGOCIO)?.carpetas ?? tax.carpetas.map((c) => c.id));
  const carpetas = new Set([...f.carpetas].filter((c) => carpetasNegocio.has(c)));
  if (f.carpetas.size && !carpetas.size) return null;
  const areas = new Set([...f.areas].filter((a) => esAreaDeNegocio(a)));
  if (f.areas.size && !areas.size) return null;
  return { carpetas, areas, autoria: f.autoria };
}
