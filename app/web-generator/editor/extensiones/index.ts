'use client';

// ⚠️ 'use client' A PROPÓSITO: este módulo enchufa los NodeViews de React (TarjetaVista, la vista de
// los ítems de OptimizadoVista…) y sólo lo importa el armazón (EditorLanding.tsx). Sin la directiva,
// importar el VALOR `vistaItemOptimizado` de un 'use client' desde acá era, para el grafo, un módulo
// del server tomando una referencia de cliente (tests/frontera-use-client.test.ts).

// =============================================================================
// extensiones — `extensionesLanding(op)`: el documento de la landing con sus NodeViews
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1).
//
// Lo usa el armazón (EditorLanding.tsx, paquete H) en `useEditor({ extensions })`, una sola
// vez (`useMemo`): la lista no se recrea por render.
//
// Arriba de extensionesBase (esquema.ts, sin React) se enchufan acá los NodeViews:
//   · la SECCIÓN (`TarjetaVista`): el elemento del NodeView ES el `section.gm-tarjeta`
//     (`as: 'section'`), su contentDOM ES el `.gm-tarjeta-cuerpo`, y los `data-*` del
//     contrato se escriben en cada actualización de ProseMirror (ver `vistaTarjeta`);
//   · imagen y video (este paquete) y los de G2 (diseños optimizados, botones, formulario,
//     gráfico, insertado, HTML libre), cada uno por su ruta y su nombre del contrato;
//   · el menú «/» (extensiones/barra.ts, paquete G2): su plugin tiene que estar en el editor
//     para que MenuBarra.tsx lo pueda leer.
// =============================================================================

import { Extension, type Extensions, type NodeViewRenderer, type NodeViewRendererProps } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { Node as NodoPM } from '@tiptap/pm/model';
import { NODO } from '@/lib/editor-landing/doc';
import { specTarjeta } from '@/lib/editor-landing/especificacion';
import TarjetaVista from '../nodos/TarjetaVista';
import ImagenVista from '../nodos/ImagenVista';
import VideoVista from '../nodos/VideoVista';
import OptimizadoVista, { vistaItemOptimizado } from '../nodos/OptimizadoVista';
import BotonesVista from '../nodos/BotonesVista';
import FormularioVista from '../nodos/FormularioVista';
import GraficoVista from '../nodos/GraficoVista';
import InsertadoVista from '../nodos/InsertadoVista';
import HtmlLibreVista from '../nodos/HtmlLibreVista';
import { extensionesBase, PLACEHOLDER_GENERAL, PLACEHOLDER_TITULO, type VistasNodos } from './esquema';
import { aplicarAttrs, attrsDeRaiz } from './comun';
import ExtensionBarra from './barra';
import type { OpcionesLanding } from './plugins';
import { pluginAnimacionSecciones } from '../animacion-reglas';

export { PLACEHOLDER_GENERAL, PLACEHOLDER_TITULO };
export { opcionesLanding, registrarAbrirEnlace, type OpcionesLanding } from './plugins';
export { ponerAnimacionDePagina } from '../animacion-reglas';

/**
 * Los `data-*` y el `id` de la sección, de la forma de especificacion.ts (sin el `style`, que
 * depende del TEMA y lo pone TarjetaVista). En el editor, una sección con diseño de imagen y
 * SIN imagen conserva su diseño (la forma pública lo baja a 'sin'): así se ve el hueco
 * «Agregar imagen» en su lugar, como en Gamma.
 * ⚠️ Los de la ANIMACIÓN (`data-anim`, `data-anim-dir`, `data-anim-texto`) NO van acá: dependen del
 *    estilo de la página (la config, no el nodo) y del lugar de la sección entre las visibles, y
 *    ProseMirror sólo llama al `update` de las secciones que cambiaron. Los pone `AnimacionSecciones`
 *    (abajo) como decoraciones de nodo, que se recalculan con el documento y con la config.
 */
function attrsDeSeccion(n: NodoPM): Record<string, string | undefined> {
  const a = attrsDeRaiz(specTarjeta(n.attrs, { modo: 'editor' }));
  const diseno = typeof n.attrs.diseno === 'string' ? n.attrs.diseno : 'sin';
  return {
    id: a.id,
    'data-diseno': diseno !== 'sin' && !n.attrs.imagenSrc ? diseno : a['data-diseno'],
    'data-ancho': a['data-ancho'],
    'data-alinea': a['data-alinea'],
    'data-alto': a['data-alto'],
    'data-fondo': a['data-fondo'],
    'data-superposicion': a['data-superposicion'],
    'data-oculta': a['data-oculta'],
  };
}

/** Lo que este módulo le agrega a un NodeView de React (sus métodos son los de TipTap). */
type VistaReact = { dom: HTMLElement; contentDOM?: HTMLElement | null; update?: (n: NodoPM, d: readonly unknown[], i: unknown) => boolean };

/**
 * El NodeView de la sección. El contentDOM lo crea TipTap (un `div` que pone adentro del
 * elemento del NodeView): se le pone la clase `gm-tarjeta-cuerpo` acá, al construirlo, y
 * TarjetaVista NO dibuja un NodeViewContent. Con NodeViewContent los bloques quedaban un nivel
 * más abajo (`.gm-tarjeta-cuerpo > div > bloques`) y la hoja del contenido, que separa los
 * bloques con `.gm-tarjeta-cuerpo > * + *`, dejaba todo pegado.
 * Los `data-*` se escriben al construir y en cada `update`, sin esperar a React: si no, entre la
 * transacción y el render se pintaba un cuadro con el diseño viejo.
 */
function vistaTarjeta(): NodeViewRenderer {
  const base = ReactNodeViewRenderer(TarjetaVista, { as: 'section', className: 'gm-tarjeta' });
  return (props: NodeViewRendererProps) => {
    const vista = base(props) as unknown as VistaReact;
    if (vista.contentDOM) vista.contentDOM.classList.add('gm-tarjeta-cuerpo');
    let puestos = aplicarAttrs(vista.dom, attrsDeSeccion(props.node));
    const actualizar = vista.update?.bind(vista);
    if (actualizar) {
      vista.update = (n, d, i) => {
        const ok = actualizar(n, d, i);
        if (ok) puestos = aplicarAttrs(vista.dom, attrsDeSeccion(n), puestos);
        return ok;
      };
    }
    return vista as unknown as ReturnType<NodeViewRenderer>;
  };
}

/** El `<video>` recibe sus clics (play, volumen, pantalla completa): ProseMirror no los toma. */
const vistaVideo = ReactNodeViewRenderer(VideoVista, {
  stopEvent: ({ event }) => {
    const t = event.target as HTMLElement | null;
    return !!t?.closest?.('video, button, input, textarea');
  },
});

/**
 * Los data-* de animación de cada sección (animacion-reglas.ts, `pluginAnimacionSecciones`): con ellos,
 * `gm-reproducir` (el ▶ y el efecto recién elegido del panel «Animar») tiene qué reproducir en el
 * lienzo. La config le llega del armazón con `ponerAnimacionDePagina` (EditorLanding.tsx).
 */
const AnimacionSecciones = Extension.create({
  name: 'animacionSecciones',
  addProseMirrorPlugins() { return [pluginAnimacionSecciones()]; },
});

export type OpcionesExtensiones = Partial<OpcionesLanding> & Pick<OpcionesLanding, 'subirArchivo' | 'elegirImagen'> & {
  /** Reemplaza el texto de la línea vacía («Escribe algo o escribe «/» para ver los comandos»). */
  placeholder?: string;
};

/** Todas las extensiones del documento de una página de la landing, con sus NodeViews. */
export function extensionesLanding(op: OpcionesExtensiones): Extensions {
  const vistas: VistasNodos = {
    [NODO.tarjeta]: vistaTarjeta(),
    [NODO.imagen]: ReactNodeViewRenderer(ImagenVista),
    [NODO.video]: vistaVideo,
    [NODO.optimizado]: ReactNodeViewRenderer(OptimizadoVista),
    [NODO.optimizadoItem]: vistaItemOptimizado,
    [NODO.botones]: ReactNodeViewRenderer(BotonesVista),
    [NODO.formulario]: ReactNodeViewRenderer(FormularioVista),
    [NODO.grafico]: ReactNodeViewRenderer(GraficoVista),
    [NODO.insertado]: ReactNodeViewRenderer(InsertadoVista),
    [NODO.htmlLibre]: ReactNodeViewRenderer(HtmlLibreVista),
  };
  return [...extensionesBase({ ...op, vistas }), ExtensionBarra, AnimacionSecciones];
}

export default extensionesLanding;
