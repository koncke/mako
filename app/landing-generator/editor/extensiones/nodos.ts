// =============================================================================
// extensiones/nodos — los nodos propios del documento de la landing (TipTap)
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1, D3).
//
// Un `Node.create` por cada nodo de `NODO` (lib/editor-landing/doc.ts). Tres contratos que
// no se ven en el código de TipTap:
//
//   1. `content:` es EXACTAMENTE `CONTENIDO_TIPTAP[nombre]` (lib/editor-landing/validar.ts,
//      paquete A). Lo que el saneo del server deja pasar TIENE que poder cargarse acá: si el
//      esquema fuera más estricto, TipTap abriría un documento VACÍO sin avisar y el
//      autoguardado lo guardaría encima (lo medido está en la cabecera de validar.ts).
//   2. `renderHTML` devuelve la forma de especificacion.ts con `{ modo: 'editor' }`: la MISMA
//      que serializa render.ts para la página publicada. Lo que se edita es lo que se publica.
//      (Los nodos con NodeView React dibujan su propio DOM en el editor; esta forma la usan el
//      portapapeles y `getHTML()`.)
//   3. Lo que se LEE de un HTML pegado pasa por el normalizador del nodo (las listas cerradas
//      de doc.ts). Primero el JSON del portapapeles (`data-gm-json`, ver comun.ts) y, si no
//      vino, el HTML de la forma.
//
// Los NodeViews se ENCHUFAN desde afuera (`vista` en las opciones de cada nodo): este módulo
// no importa React, así el test arma el esquema en node sin montar nada.
// =============================================================================

import { Node, type NodeViewRenderer } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';
import { DEGRADADOS, NODO, enLista, ANCHOS_TARJETA, ALINEACIONES_TARJETA, ALTOS_TARJETA, DISENOS_TARJETA, SUPERPOSICIONES, FONDOS_TARJETA, AJUSTES_IMAGEN, esHex, type TipoCampo } from '@/lib/editor-landing/doc';
import { CONTENIDO_TIPTAP } from '@/lib/editor-landing/validar';
import {
  SPEC_NODOS, attrsBoton, attrsBotones, attrsColumnas, attrsEspaciador, attrsFormulario, attrsHtmlLibre,
  attrsImagen, attrsInsertado, attrsOptimizado, attrsOptimizadoItem, attrsRecuadro, attrsTarjeta, attrsVideo,
  idValido, type NodoArbol,
} from '@/lib/editor-landing/especificacion';
import { normalizarGrafico } from '@/lib/editor-landing/grafico-svg';
import { embedDeIframe } from '@/lib/embeds';
import {
  attrsDelJson, attrsSinParseo, dato, especificar, focoDeFondo, hijo, urlDeFondo, vistaDom,
} from './comun';

/** Opciones comunes: el NodeView que enchufa quien arma el editor (index.ts). */
export type OpcionesNodo = { vista: NodeViewRenderer | null };
const sinVista = (): OpcionesNodo => ({ vista: null });

/** El grupo de los bloques propios. No es `block` a propósito: así una cita o una celda de tabla no aceptan un formulario adentro. */
const GRUPO = 'bloqueLanding';

const forma = (nombre: string) => (attrs: unknown): NodoArbol => SPEC_NODOS[nombre](attrs, { modo: 'editor' });

// ─────────────────────────────────────────────────────────────────────────────
// El documento: sólo secciones
// ─────────────────────────────────────────────────────────────────────────────

export const Documento = Node.create({
  name: 'doc',
  topNode: true,
  content: CONTENIDO_TIPTAP.doc,
});

// ─────────────────────────────────────────────────────────────────────────────
// La sección («tarjeta»)
// ─────────────────────────────────────────────────────────────────────────────

/** Los atributos de una sección leídos de su HTML (cuando no vino el JSON del portapapeles). */
function leerTarjeta(el: HTMLElement): Record<string, unknown> {
  const acento = el.querySelector(':scope > .gm-acento');
  const fondo = el.querySelector(':scope > .gm-tarjeta-fondo');
  const estiloFondo = fondo?.getAttribute('style') ?? '';
  const foco = focoDeFondo(acento);
  const hex = /background:\s*(#[0-9a-fA-F]{6})/.exec(estiloFondo)?.[1] ?? null;
  // El degradado se reconoce por el texto EXACTO que escribe especificacion.ts (el estilo
  // crudo del atributo: el calculado lo reescribe el navegador).
  const degradado = (Object.keys(DEGRADADOS) as (keyof typeof DEGRADADOS)[]).find((k) => estiloFondo.includes(DEGRADADOS[k])) ?? null;
  const id = /^t-(.+)$/.exec(el.id)?.[1];
  return attrsTarjeta({
    id: idValido(id) ?? '',
    diseno: enLista(DISENOS_TARJETA, dato(el, 'diseno'), 'sin'),
    imagenSrc: urlDeFondo(acento),
    imagenFocoX: foco?.[0] ?? 50,
    imagenFocoY: foco?.[1] ?? 50,
    imagenAjuste: enLista(AJUSTES_IMAGEN, acento?.getAttribute('data-ajuste'), 'cubrir'),
    superposicion: enLista(SUPERPOSICIONES, dato(el, 'superposicion'), 'ninguna'),
    fondo: enLista(FONDOS_TARJETA, dato(el, 'fondo'), 'tema'),
    fondoColor: esHex(hex) ? hex : null,
    fondoDegradado: degradado,
    ancho: enLista(ANCHOS_TARJETA, dato(el, 'ancho'), 'normal'),
    alineacion: enLista(ALINEACIONES_TARJETA, dato(el, 'alinea'), 'centro'),
    alto: enLista(ALTOS_TARJETA, dato(el, 'alto'), 'auto'),
    oculta: dato(el, 'oculta') === 'si',
  });
}

/**
 * La sección. `isolating` (Backspace al principio no la funde con la de arriba: para eso está
 * «Combinar con lo anterior»), `defining` (un pegado que la reemplaza conserva la sección) y
 * `selectable: false`: con un clic en el margen de la sección, ProseMirror la elegía ENTERA
 * como NodeSelection y la primera tecla la borraba. `draggable: false`: se mueve con su asa
 * (TarjetaVista, gesto propio) y con la tira de secciones, nunca agarrándola de cualquier lado.
 */
export const Tarjeta = Node.create<OpcionesNodo>({
  name: NODO.tarjeta,
  content: CONTENIDO_TIPTAP[NODO.tarjeta],
  isolating: true,
  defining: true,
  selectable: false,
  draggable: false,
  addOptions: sinVista,
  addAttributes() {
    // `id: null` hasta que el plugin de ids le ponga uno (plugins.ts): una sección nueva nace
    // sin id y el mismo paso de transacción se lo da.
    return attrsSinParseo({ ...attrsTarjeta({}), id: null });
  },
  parseHTML() {
    return [{
      tag: 'section.gm-tarjeta',
      contentElement: '.gm-tarjeta-cuerpo',
      getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.tarjeta) ?? leerTarjeta(el as HTMLElement),
    }];
  },
  renderHTML({ node }) {
    return especificar(forma(NODO.tarjeta)(node.attrs));
  },
  addNodeView() {
    return this.options.vista;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

export const Columnas = Node.create<OpcionesNodo>({
  name: NODO.columnas,
  group: GRUPO,
  content: CONTENIDO_TIPTAP[NODO.columnas],
  defining: true,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsColumnas({})); },
  parseHTML() {
    return [{
      tag: 'div.gm-columnas',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        const j = attrsDelJson(e, NODO.columnas);
        if (j) return j;
        const cols = /--gm-cols:\s*([^;"]+)/.exec(e.getAttribute('style') ?? '')?.[1] ?? '';
        const anchos = [...cols.matchAll(/(\d+)fr/g)].map((m) => Number(m[1]));
        return attrsColumnas({ anchos, divisores: dato(e, 'divisores') === 'si' });
      },
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.columnas)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

export const Columna = Node.create({
  name: NODO.columna,
  content: CONTENIDO_TIPTAP[NODO.columna],
  isolating: true,
  parseHTML() { return [{ tag: 'div.gm-columna' }]; },
  renderHTML() { return especificar(forma(NODO.columna)({})); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Diseños optimizados
// ─────────────────────────────────────────────────────────────────────────────

export const Optimizado = Node.create<OpcionesNodo>({
  name: NODO.optimizado,
  group: GRUPO,
  content: CONTENIDO_TIPTAP[NODO.optimizado],
  defining: true,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsOptimizado({})); },
  parseHTML() {
    return [{
      tag: 'div.gm-optimizado',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return attrsDelJson(e, NODO.optimizado)
          ?? attrsOptimizado({ variante: dato(e, 'variante'), columnas: dato(e, 'cols'), mostrarIconos: dato(e, 'iconos') === 'si' });
      },
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.optimizado)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

/**
 * Un ítem de un diseño optimizado. Su marca (ícono, imagen, valor) vive FUERA del hueco del
 * contenido: el NodeView de DOM la marca no editable y le dibuja el ícono (comun.ts). Cómo se
 * elige el ícono o se escribe el valor lo resuelve el NodeView del diseño (OptimizadoVista).
 */
export const OptimizadoItem = Node.create<OpcionesNodo>({
  name: NODO.optimizadoItem,
  content: CONTENIDO_TIPTAP[NODO.optimizadoItem],
  isolating: true,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsOptimizadoItem({})); },
  parseHTML() {
    return [{
      tag: 'div.gm-item',
      contentElement: '.gm-item-cuerpo',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return attrsDelJson(e, NODO.optimizadoItem) ?? attrsOptimizadoItem({
          icono: e.querySelector('.gm-item-icono')?.getAttribute('data-icono') ?? null,
          imagenSrc: e.querySelector('img.gm-item-imagen')?.getAttribute('src') ?? null,
          valor: e.querySelector('.gm-item-valor')?.textContent ?? '',
          destacado: dato(e, 'destacado') === 'si',
        });
      },
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.optimizadoItem)(node.attrs)); },
  addNodeView() { return this.options.vista ?? vistaDom((n) => forma(NODO.optimizadoItem)(n.attrs)); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Botones
// ─────────────────────────────────────────────────────────────────────────────

export const Botones = Node.create<OpcionesNodo>({
  name: NODO.botones,
  group: GRUPO,
  content: CONTENIDO_TIPTAP[NODO.botones],
  defining: true,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsBotones({})); },
  parseHTML() {
    return [{
      tag: 'div.gm-botones',
      getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.botones) ?? attrsBotones({ alinea: dato(el as HTMLElement, 'alinea') }),
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.botones)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

/**
 * Un botón: su texto se edita en el lugar, SIN marcas (`marks: ''`, como `SIN_MARCAS` del
 * saneo). La regla de lectura va con `priority: 60` para ganarle a la marca de enlace (50):
 * con la misma prioridad, ProseMirror probaba antes la marca y un `<a class="gm-boton">`
 * pegado se convertía en un texto con link, dejando `botones` sin ningún `boton` adentro.
 */
export const Boton = Node.create({
  name: NODO.boton,
  content: CONTENIDO_TIPTAP[NODO.boton],
  marks: '',
  defining: true,
  addAttributes() { return attrsSinParseo(attrsBoton({})); },
  parseHTML() {
    return [{
      tag: 'a.gm-boton',
      priority: 60,
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return attrsDelJson(e, NODO.boton)
          ?? attrsBoton({ href: e.getAttribute('href') ?? '', variante: dato(e, 'variante'), nuevaPestana: e.getAttribute('target') === '_blank' });
      },
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.boton)(node.attrs)); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Cuadros de llamada y desplegables
// ─────────────────────────────────────────────────────────────────────────────

export const Recuadro = Node.create<OpcionesNodo>({
  name: NODO.recuadro,
  group: GRUPO,
  content: CONTENIDO_TIPTAP[NODO.recuadro],
  defining: true,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsRecuadro({})); },
  parseHTML() {
    return [{
      tag: 'aside.gm-recuadro',
      contentElement: '.gm-recuadro-cuerpo',
      getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.recuadro) ?? attrsRecuadro({ tono: dato(el as HTMLElement, 'tono') }),
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.recuadro)(node.attrs)); },
  addNodeView() { return this.options.vista ?? vistaDom((n) => forma(NODO.recuadro)(n.attrs)); },
});

/**
 * El desplegable. En el editor se dibuja SIEMPRE abierto (si no, el cuerpo no se puede editar)
 * y el clic en el título no lo cierra: en un `<details>` editable, el navegador alterna el
 * `open` con el clic y con la barra espaciadora (que también es un clic del `<summary>`), y
 * ProseMirror leería ese cambio de atributo como una edición que no sabe dónde poner.
 * Publicado, es un `<details>` nativo que funciona sin JavaScript (las preguntas frecuentes se
 * leen igual).
 */
export const Desplegable = Node.create<OpcionesNodo>({
  name: NODO.desplegable,
  group: GRUPO,
  content: CONTENIDO_TIPTAP[NODO.desplegable],
  defining: true,
  addOptions: sinVista,
  parseHTML() { return [{ tag: 'details.gm-desplegable' }, { tag: 'details', priority: 40 }]; },
  renderHTML() { return especificar(forma(NODO.desplegable)({})); },
  addNodeView() {
    return this.options.vista ?? vistaDom(() => forma(NODO.desplegable)({ abierto: true }), (dom) => {
      dom.setAttribute('open', '');
      dom.addEventListener('click', (e) => {
        if ((e.target as HTMLElement | null)?.closest('summary')) e.preventDefault();
      });
      return {
        // El `open` lo pone esta vista: si alguien lo saca (una extensión del navegador, un
        // atajo), se vuelve a poner y no es un cambio del documento.
        ignoreMutation: (m) => {
          if (m.type === 'attributes' && m.target === dom && (m as MutationRecord).attributeName === 'open') {
            if (!dom.hasAttribute('open')) dom.setAttribute('open', '');
            return true;
          }
          return false;
        },
      };
    });
  },
});

export const DesplegableTitulo = Node.create({
  name: NODO.desplegableTitulo,
  content: CONTENIDO_TIPTAP[NODO.desplegableTitulo],
  defining: true,
  parseHTML() { return [{ tag: 'summary' }]; },
  renderHTML() { return especificar(forma(NODO.desplegableTitulo)({})); },
});

export const DesplegableCuerpo = Node.create({
  name: NODO.desplegableCuerpo,
  content: CONTENIDO_TIPTAP[NODO.desplegableCuerpo],
  isolating: true,
  parseHTML() { return [{ tag: 'div.gm-desplegable-cuerpo' }]; },
  renderHTML() { return especificar(forma(NODO.desplegableCuerpo)({})); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Átomos: imagen, video, insertado, formulario, gráfico, espacio, HTML libre
// ─────────────────────────────────────────────────────────────────────────────

/** Lo común de un bloque atómico: se elige como bloque, se arrastra con el asa y no tiene texto adentro. */
const atomo = { group: GRUPO, atom: true, selectable: true, draggable: true } as const;

function leerImagen(el: HTMLElement): Record<string, unknown> | false {
  const img = hijo(el, 'img');
  const a = img?.closest('a');
  const attrs = attrsImagen({
    src: img?.getAttribute('src') ?? '',
    alt: img?.getAttribute('alt') ?? '',
    ancho: dato(el, 'ancho'),
    alinea: dato(el, 'alinea'),
    forma: dato(el, 'forma'),
    href: a?.getAttribute('href') ?? null,
  });
  return attrs;
}

export const Imagen = Node.create<OpcionesNodo>({
  name: NODO.imagen,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsImagen({})); },
  parseHTML() {
    return [
      { tag: 'figure.gm-imagen', getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.imagen) ?? leerImagen(el as HTMLElement) },
      // Una imagen suelta pegada: sólo si es del bucket público de la landing. Una de afuera no
      // entra (render.ts tampoco la dibujaría): se sube por el selector, que la copia al bucket.
      {
        tag: 'img[src]',
        priority: 40,
        getAttrs: (el) => {
          const a = leerImagen(el as HTMLElement);
          return a && (a as { src?: string }).src ? a : false;
        },
      },
    ];
  },
  renderHTML({ node }) { return especificar(forma(NODO.imagen)(node.attrs)); },
  renderText({ node }) { return String(node.attrs.alt ?? ''); },
  addNodeView() { return this.options.vista; },
});

export const Video = Node.create<OpcionesNodo>({
  name: NODO.video,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsVideo({})); },
  parseHTML() {
    return [{
      tag: 'figure.gm-video',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        const v = e.querySelector('video');
        return attrsDelJson(e, NODO.video) ?? attrsVideo({
          src: v?.getAttribute('src') ?? '', ancho: dato(e, 'ancho'), autoplay: !!v?.hasAttribute('autoplay'),
          bucle: !!v?.hasAttribute('loop'), poster: v?.getAttribute('poster') ?? null,
        });
      },
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.video)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

/** Lo que el editor lee de un `<iframe>`: la regla del saneo, `embedDeIframe` (lib/embeds.ts), la misma fuente que el editor rico. */
const leerIframe = (el: Element | null) =>
  el ? embedDeIframe({ src: el.getAttribute('src'), 'data-alto': el.getAttribute('data-alto'), height: el.getAttribute('height') }) : null;

/**
 * Lo insertado (YouTube, Vimeo, Loom, Calendly…): el nodo `insertado` del editor rico,
 * generalizado. El `src` que se guarda es el que arma lib/embeds.ts desde el id, nunca el que
 * vino; un iframe que no es de la lista no entra al documento (y al pegar se va con lo demás).
 */
export const Insertado = Node.create<OpcionesNodo>({
  name: NODO.insertado,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsInsertado({})); },
  parseHTML() {
    return [
      {
        tag: 'div.gm-insertado',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          const j = attrsDelJson(e, NODO.insertado);
          if (j) return j;
          const emb = leerIframe(e.querySelector('iframe'));
          return emb ? attrsInsertado(emb) : attrsInsertado({});
        },
      },
      {
        tag: 'iframe[src]',
        getAttrs: (el) => {
          const emb = leerIframe(el as HTMLElement);
          return emb ? attrsInsertado(emb) : false;
        },
      },
    ];
  },
  renderHTML({ node }) { return especificar(forma(NODO.insertado)(node.attrs)); },
  renderText({ node }) { return String(node.attrs.src ?? ''); },
  addNodeView() { return this.options.vista; },
});

/** Los campos de un formulario leídos de su HTML (un pegado de afuera, sin el JSON). */
function leerFormulario(el: HTMLElement): Record<string, unknown> {
  const campos = Array.from(el.querySelectorAll<HTMLElement>('.gm-campo[data-tipo]')).map((c) => {
    const tipo = (c.getAttribute('data-tipo') ?? 'texto') as TipoCampo;
    const rotulo = c.querySelector('.gm-campo-etiqueta');
    return {
      id: '',
      tipo,
      etiqueta: rotulo?.textContent ?? '',
      requerido: rotulo?.getAttribute('data-requerido') === 'si',
      opciones: Array.from(c.querySelectorAll('.gm-opcion span')).map((s) => s.textContent ?? ''),
    };
  });
  return attrsFormulario({
    campos,
    boton: el.querySelector('button[type="submit"]')?.textContent ?? '',
    exito: el.getAttribute('data-exito') ?? '',
    redirigir: el.getAttribute('data-redirigir'),
  });
}

export const Formulario = Node.create<OpcionesNodo>({
  name: NODO.formulario,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsFormulario({})); },
  parseHTML() {
    return [{ tag: 'form.gm-formulario', getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.formulario) ?? leerFormulario(el as HTMLElement) }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.formulario)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

/**
 * Un gráfico. Sus datos NO se pueden leer de vuelta del SVG: un gráfico pegado desde afuera
 * entra con su tipo y vacío. Copiado dentro del editor viaja entero en el JSON del portapapeles.
 */
export const Grafico = Node.create<OpcionesNodo>({
  name: NODO.grafico,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(normalizarGrafico({})); },
  parseHTML() {
    return [{
      tag: 'div.gm-grafico',
      getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.grafico) ?? normalizarGrafico({ tipo: dato(el as HTMLElement, 'tipo') }),
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.grafico)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

export const Espaciador = Node.create<OpcionesNodo>({
  name: NODO.espaciador,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsEspaciador({})); },
  parseHTML() {
    return [{ tag: 'div.gm-espaciador', getAttrs: (el) => attrsDelJson(el as HTMLElement, NODO.espaciador) ?? attrsEspaciador({ alto: dato(el as HTMLElement, 'alto') }) }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.espaciador)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

export const HtmlLibre = Node.create<OpcionesNodo>({
  name: NODO.htmlLibre,
  ...atomo,
  addOptions: sinVista,
  addAttributes() { return attrsSinParseo(attrsHtmlLibre({})); },
  parseHTML() {
    return [{
      tag: 'div.gm-html',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return attrsDelJson(e, NODO.htmlLibre)
          ?? attrsHtmlLibre({ html: e.querySelector('iframe')?.getAttribute('srcdoc') ?? '', alto: dato(e, 'alto') });
      },
    }];
  },
  renderHTML({ node }) { return especificar(forma(NODO.htmlLibre)(node.attrs)); },
  addNodeView() { return this.options.vista; },
});

// ─────────────────────────────────────────────────────────────────────────────
// La tabla: la de TipTap, dibujada con la forma de la landing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La tabla de TipTap (`resizable: false`: los anchos en px no pasan el saneo ni sirven en un
 * teléfono) con la forma de especificacion.ts (`.gm-tabla > table > tbody`, sin `colgroup` ni
 * `min-width`). El `<div>` de afuera no es un nodo: al pegar se saltea y se lee la tabla.
 *
 * ⚠️ `View: null` es lo que hace que el EDITOR use ese `renderHTML`. En TipTap 3, con
 * `resizable: false` la tabla igual se dibuja con su `TableView` (un `div.tableWrapper` con
 * `colgroup` y `min-width` en px) salvo que `View` sea null — y sin la clase `.gm-tabla` la hoja
 * no la alcanza: medido el 11/10/2026, la Tabla 3×3 salía en el lienzo sin bordes ni relleno,
 * «Columna 1Columna 2Columna 3» pegadas y las filas vacías invisibles.
 */
export const TablaLanding = Table.extend({
  renderHTML() {
    return especificar(forma('table')({}));
  },
}).configure({ resizable: false, View: null });

/** Todos los nodos propios, para armar el esquema. */
export const NODOS_PROPIOS = [
  Documento, Tarjeta, Columnas, Columna, Optimizado, OptimizadoItem, Botones, Boton, Recuadro,
  Desplegable, DesplegableTitulo, DesplegableCuerpo, Imagen, Video, Insertado, Formulario, Grafico,
  Espaciador, HtmlLibre,
] as const;
