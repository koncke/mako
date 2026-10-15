// =============================================================================
// extensiones/marcas — las marcas del texto y las variantes de párrafo y título
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1, D3).
//
// Los NOMBRES de atributo son el contrato con el saneo y el render (NORMALIZAR_MARCAS de
// lib/editor-landing/especificacion.ts): textStyle `{color, tam}`, highlight `{color}`,
// etiqueta `{color}`, paragraph `{variante, textAlign}`, heading `{level, variante, textAlign}`.
// Si TipTap los guardara con otro nombre (`fontSize`, `backgroundColor`), el server los
// tiraría en cada guardado y el color elegido se perdería sin un error.
//
// Lo que NO es libre, a propósito (como en Gamma, y por lo mismo que el ancho de una imagen):
//   · el tamaño de letra es de la lista cerrada `TAMANOS_TEXTO` (xs…2xl), nunca un px;
//   · el color es un token del tema (`acento`, `paleta-3`…) o un `#rrggbb`. Un `rgb()` o un
//     nombre de color no se guarda (`colorValido`).
//
// ⚠️ La marca de ENLACE es la de StarterKit (`@tiptap/extension-link` no está declarado en
//    package.json, así que no se puede extender sin importarlo de rebote). Su `renderHTML` es el
//    de TipTap: en el DOM del editor el `<a>` no lleva el `rel` que escribe especificacion.ts.
//    Es sólo el editor (el portapapeles y `getHTML()`): lo publicado sale de render.ts. Los
//    atributos que guarda (`href`, `target`) sí son los del contrato; `rel` y `class` los tira
//    el saneo sin anotar (ATTRS_DE_TIPTAP de validar.ts).
// =============================================================================

import { Extension, Mark, type CommandProps } from '@tiptap/core';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TAMANOS_TEXTO, COLORES_TEMA, VARIANTES_PARRAFO, esHex, type TamanoTexto, type ColorTema, type VarianteParrafo } from '@/lib/editor-landing/doc';
import { SPEC_MARCAS, colorValido } from '@/lib/editor-landing/especificacion';
import { especificar } from './comun';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tamTexto: {
      /** Tamaño de letra de la selección, de la lista cerrada (Gamma: menú de tamaño). */
      setTamTexto: (tam: TamanoTexto) => ReturnType;
      unsetTamTexto: () => ReturnType;
    };
    etiqueta: {
      /** La píldora («Más vendido», «Oferta»), con un color del tema o el acento. */
      setEtiqueta: (color?: ColorTema | null) => ReturnType;
      toggleEtiqueta: (color?: ColorTema | null) => ReturnType;
      unsetEtiqueta: () => ReturnType;
    };
    varianteTexto: {
      /** Antetítulo, texto grande o pequeño en el párrafo del cursor (null = normal). */
      setVarianteParrafo: (variante: VarianteParrafo | null) => ReturnType;
      /** El «Título» grande de Gamma: un h1 con `variante: 'titulo'`. */
      setTituloGrande: () => ReturnType;
    };
  }
}

/** `rgb(1, 2, 3)` → `#010203` (el navegador devuelve así un color elegido como hex). */
function hexDeRgb(v: string): string | null {
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(v.trim());
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
}

/** El color de una marca leído de su HTML: el token de `data-color`, o el hex del estilo cuando dice «propio». */
function colorDe(el: HTMLElement, propiedad: 'color' | 'backgroundColor'): string | null {
  const d = el.getAttribute('data-color');
  if (d && d !== 'propio') return colorValido(d) as string | null;
  const crudo = el.style[propiedad] || '';
  const hex = esHex(crudo) ? crudo : hexDeRgb(crudo);
  return hex && esHex(hex) ? hex : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// textStyle: color y tamaño
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La marca `textStyle` con los atributos del contrato (`color`, `tam`) y la forma de
 * especificacion.ts (`span[data-color][data-tam]`). Se lee también un `<span>` SIN estilo que
 * traiga esos `data-*`: el de TipTap sólo leía spans con `style`, y un color de tema (que va
 * en `data-color`, sin estilo) se perdía al copiar y pegar dentro del mismo editor.
 */
export const TextStyleLanding = TextStyle.extend({
  addAttributes() {
    return {
      color: { default: null, parseHTML: (el) => colorDe(el, 'color'), rendered: false },
      tam: {
        default: null,
        parseHTML: (el) => {
          const t = el.getAttribute('data-tam');
          return (TAMANOS_TEXTO as readonly string[]).includes(t ?? '') ? t : null;
        },
        rendered: false,
      },
    };
  },
  parseHTML() {
    return [
      { tag: 'span[data-color]', consuming: false },
      { tag: 'span[data-tam]', consuming: false },
      { tag: 'span[style]', consuming: false, getAttrs: (el) => ((el as HTMLElement).style.color ? {} : false) },
    ];
  },
  renderHTML({ mark }) {
    return especificar(SPEC_MARCAS.textStyle(mark.attrs));
  },
});

/**
 * Los comandos `setColor` / `unsetColor` de TipTap, sin su atributo (`types: []`): el atributo
 * `color` lo declara `TextStyleLanding`, que lo lee y lo escribe como pide el contrato. Así
 * quien llama usa el comando de siempre (`editor.commands.setColor('acento')`).
 */
export const ColorLanding = Color.configure({ types: [] });

/** Tamaño de letra de lista cerrada. */
export const TamTexto = Extension.create({
  name: 'tamTexto',
  addCommands() {
    return {
      setTamTexto: (tam: TamanoTexto) => ({ chain }: CommandProps) => {
        if (!(TAMANOS_TEXTO as readonly string[]).includes(tam)) return false;
        return chain().setMark('textStyle', { tam }).run();
      },
      unsetTamTexto: () => ({ chain }: CommandProps) => chain().setMark('textStyle', { tam: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// highlight: resaltado multicolor
// ─────────────────────────────────────────────────────────────────────────────

export const ResaltadoLanding = Highlight.extend({
  addAttributes() {
    return { color: { default: null, parseHTML: (el) => colorDe(el, 'backgroundColor'), rendered: false } };
  },
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML({ mark }) {
    return especificar(SPEC_MARCAS.highlight(mark.attrs));
  },
}).configure({ multicolor: true });

// ─────────────────────────────────────────────────────────────────────────────
// etiqueta: la píldora de Gamma («Etiqueta» en «Formularios y botones»)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `span.gm-etiqueta[data-color]`. No es inclusiva: al escribir después de una etiqueta, el
 * texto nuevo sale normal (si no, todo lo que sigue a «Más vendido» se volvía píldora).
 * Prioridad 102, una más que textStyle: un `span.gm-etiqueta` lo toma la etiqueta.
 */
export const Etiqueta = Mark.create({
  name: 'etiqueta',
  inclusive: false,
  priority: 102,
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => {
          const c = el.getAttribute('data-color');
          return (COLORES_TEMA as readonly string[]).includes(c ?? '') ? c : null;
        },
        rendered: false,
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span.gm-etiqueta', priority: 60 }];
  },
  renderHTML({ mark }) {
    return especificar(SPEC_MARCAS.etiqueta(mark.attrs));
  },
  addCommands() {
    return {
      setEtiqueta: (color?: ColorTema | null) => ({ commands }: CommandProps) => commands.setMark(this.name, { color: color ?? null }),
      toggleEtiqueta: (color?: ColorTema | null) => ({ commands }: CommandProps) => commands.toggleMark(this.name, { color: color ?? null }),
      unsetEtiqueta: () => ({ commands }: CommandProps) => commands.unsetMark(this.name),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Variantes de párrafo y de título
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `paragraph.variante` (antetítulo, grande, pequeño) y `heading.variante` ('titulo' = el
 * «Título» grande de Gamma). Como atributos GLOBALES sobre los nodos de StarterKit: el DOM que
 * sale es el de especificacion.ts (`p[data-variante]`, `h1.gm-titulo`).
 *
 * `keepOnSplit: false`: Enter al final de un antetítulo abre un párrafo NORMAL (si no, todo lo
 * que se escribía después de «NUEVO» salía en mayúsculas chiquitas). Un título con
 * `variante: 'titulo'` siempre es h1: lo garantiza el plugin de plugins.ts.
 */
export const VariantesTexto = Extension.create({
  name: 'varianteTexto',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          variante: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => {
              const v = el.getAttribute('data-variante');
              return (VARIANTES_PARRAFO as readonly string[]).includes(v ?? '') ? v : null;
            },
            renderHTML: (a) => (a.variante ? { 'data-variante': a.variante } : {}),
          },
        },
      },
      {
        types: ['heading'],
        attributes: {
          variante: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => (el.classList.contains('gm-titulo') ? 'titulo' : null),
            renderHTML: (a) => (a.variante === 'titulo' ? { class: 'gm-titulo' } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setVarianteParrafo: (variante: VarianteParrafo | null) => ({ chain }: CommandProps) =>
        chain().setNode('paragraph', { variante: variante && (VARIANTES_PARRAFO as readonly string[]).includes(variante) ? variante : null }).run(),
      setTituloGrande: () => ({ chain }: CommandProps) => chain().setNode('heading', { level: 1, variante: 'titulo' }).run(),
    };
  },
});
