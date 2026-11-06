// =============================================================================
// Qué muestra `/image-editor` según su `?ver=` (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la principal, no "¿Qué vas a crear hoy?"». Sin
// `ver`, los EJEMPLOS (carruseles, anuncios y miniaturas de YouTube); con `?ver=crear`, las plantillas y los diseños del negocio.
// `?ver=carruseles` (el link de antes, que viajó en avisos y en la API) abre los ejemplos con sus filtros, sin redirigir: un
// `redirect()` debajo de app/image-editor/loading.tsx va en el stream y es el React #310 (tests/redirige-antes-del-loader.test.ts).
// La pantalla saca el `ver=` de la barra de direcciones sin navegar (ExplorarCarruseles.tsx).
//
// Puro y aparte de ./ruta.ts a propósito: la página del teléfono (app/m/image-editor) no puede importar ./ruta.ts, que los tests
// tratan como puerta del motor del editor (tests/image-editor-integracion.test.ts, test 4).
// =============================================================================

type Query = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function vistaDeImage(q: Query): 'ejemplos' | 'crear' {
  return primero(q.ver) === 'crear' ? 'crear' : 'ejemplos';
}
