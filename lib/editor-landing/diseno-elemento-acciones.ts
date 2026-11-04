// =============================================================================
// diseno-elemento-acciones — CUALQUIER elemento de un «Diseño editable», elegido y cambiado (28/10/2026)
// =============================================================================
// Martín (28/10, por el Cerebro): «Es super importante que la replica de las landing, no solo replique, sino que luego sea
// editable absolutamente todo... Sino, no tendrá sentido replicarla, seria como hacer una captura... Debe ser todo editable».
// Hasta acá, en una sección de diseño (una copia idéntica es una por sección) se elegía sólo un enlace, una imagen, un video
// o un ícono, y el texto se escribía. No se podía quitar, duplicar ni mover un elemento, ni cambiarle el fondo, el color o
// la fuente, ni llegar al enlace que envuelve una imagen (el clic elegía la imagen), y un `<button>` no tenía a dónde llevar.
// Esto es el «Elemento» de la barrita (app/web-generator/editor/nodos/HtmlEditableVista.tsx):
//   · elegir el de AFUERA (un logo → su enlace; una tarjeta → su caja → la sección), hasta la raíz de la sección;
//   · duplicarlo, moverlo entre sus hermanos y quitarlo (la raíz no: eso es «Eliminar sección»);
//   · el color del texto, el fondo, la imagen de fondo y la fuente (de las que la página ya carga);
//   · un `<button>` (o algo con `role="button"`) pasa a ser un `<a>` cuando se le pone a dónde llevar, con lo suyo.
// Todo queda en su HTML (el `style` del elemento, sus atributos), sin nodos del editor; el saneo del server pasa igual.
// ⚠️ Sin `window` ni `document` globales: el documento es el del iframe y llega en el elemento. Lo prueba
//    tests/replica-editable.test.ts con un DOM de mentira (el jsdom de node_modules está roto).
// =============================================================================

/** Lo mínimo de un elemento del DOM que usan estas acciones (el del iframe en el editor; uno de mentira en los tests). */
export interface ElementoDiseno {
  tagName: string;
  parentElement: ElementoDiseno | null;
  previousElementSibling: ElementoDiseno | null;
  nextElementSibling: ElementoDiseno | null;
  children: ArrayLike<ElementoDiseno>;
  attributes: ArrayLike<{ name: string; value: string }>;
  style: { setProperty(n: string, v: string, prioridad?: string): void; removeProperty(n: string): string };
  ownerDocument: { createElement(tag: string): ElementoDiseno };
  getAttribute(n: string): string | null;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
  hasAttribute(n: string): boolean;
  cloneNode(profundo: boolean): ElementoDiseno;
  querySelectorAll(sel: string): ArrayLike<ElementoDiseno>;
  closest(sel: string): ElementoDiseno | null;
  before(...n: ElementoDiseno[]): void;
  after(...n: ElementoDiseno[]): void;
  replaceWith(...n: ElementoDiseno[]): void;
  remove(): void;
  append(...n: unknown[]): void;
  readonly childNodes: ArrayLike<unknown>;
}

/** La marca del elemento elegido en el editor: no viaja a un duplicado (dos marcados confunden). */
export const MARCA_ELEGIDO = 'data-gmx-sel';

const ETIQUETA: Record<string, string> = {
  a: 'Enlace', button: 'Botón', img: 'Imagen', picture: 'Imagen', video: 'Video', iframe: 'Video', svg: 'Ícono',
  h1: 'Título', h2: 'Título', h3: 'Título', h4: 'Título', h5: 'Título', h6: 'Título', p: 'Párrafo', span: 'Texto',
  strong: 'Texto', em: 'Texto', b: 'Texto', i: 'Texto', li: 'Elemento de lista', ul: 'Lista', ol: 'Lista',
  nav: 'Menú', header: 'Cabecera', footer: 'Pie', section: 'Sección', form: 'Formulario', label: 'Texto',
};

/** El nombre del elemento en palabras de la persona («Imagen», «Botón», «Caja»…). `raiz`: la sección. */
export function nombreDeElemento(el: ElementoDiseno, raiz?: ElementoDiseno | null): string {
  if (raiz && el === raiz) return 'Sección';
  const t = el.tagName.toLowerCase();
  if (t === 'a' && esBotonPorAtributos(el)) return 'Botón';
  if (el.getAttribute('role') === 'button') return 'Botón';
  return ETIQUETA[t] ?? 'Caja';
}

/** Un `<a>` que su clase ya dice botón (`btn`, `button`, `cta`): sin estilos calculados, por si el clic cae en otro lado. */
const esBotonPorAtributos = (el: ElementoDiseno): boolean => /\b(btn|button|cta)\b/i.test(el.getAttribute('class') ?? '');

/** El de AFUERA, mientras siga adentro de la sección. null = ya es la raíz (o algo raro). */
export function deAfuera(el: ElementoDiseno, raiz: ElementoDiseno): ElementoDiseno | null {
  if (el === raiz) return null;
  let p = el.parentElement;
  // Un `<picture>` y su `<img>` son UNA imagen para la persona: subir desde la imagen no se queda en el picture.
  while (p && p !== raiz && p.tagName.toLowerCase() === 'picture') p = p.parentElement;
  if (!p) return null;
  // ¿Sigue adentro de la raíz?
  for (let x: ElementoDiseno | null = p; x; x = x.parentElement) if (x === raiz) return p;
  return null;
}

/** Duplica el elemento justo después de sí mismo; devuelve la copia (sin la marca de elegido). */
export function duplicarElemento(el: ElementoDiseno): ElementoDiseno {
  const copia = el.cloneNode(true);
  copia.removeAttribute(MARCA_ELEGIDO);
  const marcados = copia.querySelectorAll(`[${MARCA_ELEGIDO}]`);
  for (let i = 0; i < marcados.length; i++) marcados[i].removeAttribute(MARCA_ELEGIDO);
  // Un `id` repetido rompe los enlaces internos (#precios) y los `label for`: la copia va sin él.
  copia.removeAttribute('id');
  el.after(copia);
  return copia;
}

/** Lo mueve entre sus hermanos. false = no hay a dónde (ya es el primero o el último). */
export function moverElemento(el: ElementoDiseno, hacia: 'antes' | 'despues'): boolean {
  if (hacia === 'antes') {
    const h = el.previousElementSibling;
    if (!h) return false;
    h.before(el);
    return true;
  }
  const h = el.nextElementSibling;
  if (!h) return false;
  h.after(el);
  return true;
}

/** Lo quita. La raíz de la sección no: eso es «Eliminar sección» (con su deshacer). */
export function quitarElemento(el: ElementoDiseno, raiz: ElementoDiseno): boolean {
  if (el === raiz || !el.parentElement) return false;
  // Una imagen dentro de un `<picture>` se va con su picture: si no, quedan los `<source>` mostrando la de antes.
  const pic = el.tagName.toLowerCase() === 'img' ? el.closest('picture') : null;
  (pic && pic !== raiz ? pic : el).remove();
  return true;
}

/**
 * Una imagen que se cambia: sin `srcset`, `sizes` ni los `data-src` de la carga perezosa, y sin los `<source>` de su
 * `<picture>`. Cualquiera de esos le gana al `src` en el navegador: se cambiaba la imagen y se seguía viendo la de antes.
 */
export function limpiarParaCambiar(img: ElementoDiseno): void {
  for (const a of ['srcset', 'sizes', 'data-src', 'data-srcset', 'data-lazy-src', 'data-original']) img.removeAttribute(a);
  const pic = img.closest('picture');
  if (pic) {
    const fuentes = pic.querySelectorAll('source');
    for (let i = fuentes.length - 1; i >= 0; i--) fuentes[i].remove();
  }
}

/** Un valor de color que va al `style`: hex, rgb(a), hsl(a), oklch… o un nombre. Nunca otra cosa. */
export function colorValido(v: string): boolean {
  const s = v.trim();
  if (!s || s.length > 60 || /[;{}<>"'\\]|url\(|expression|var\(/i.test(s)) return false;
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^(rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)$/i.test(s) || /^[a-z]{3,20}$/i.test(s);
}

/**
 * El color del texto o del fondo del elemento. `null` lo saca (vuelve a lo que diga la hoja).
 * ⚠️ El del TEXTO va también a `-webkit-text-fill-color` (4/11/2026): un título con degradado (`background-clip: text` y
 *    el relleno transparente, el truco de casi toda landing de SaaS) se pinta con el RELLENO, no con `color`, así que cambiar
 *    sólo `color` cambiaba el valor calculado y en pantalla no se veía nada. En un texto común el relleno ya es `currentColor`:
 *    ponerle el mismo valor no cambia nada. Es la causa probable del ❌ de la sección 10 de la copia #68 (matriz del 29/10),
 *    sin verificar contra esa copia: vive en la base de producción.
 */
export function ponerColor(el: ElementoDiseno, cual: 'texto' | 'fondo', valor: string | null): boolean {
  const prop = cual === 'texto' ? 'color' : 'background-color';
  if (valor === null) {
    el.style.removeProperty(prop);
    if (cual === 'texto') el.style.removeProperty('-webkit-text-fill-color');
    return true;
  }
  if (!colorValido(valor)) return false;
  el.style.setProperty(prop, valor.trim(), 'important');
  if (cual === 'texto') el.style.setProperty('-webkit-text-fill-color', valor.trim(), 'important');
  // Un fondo de color tapa un degradado de la hoja (`background-image`): elegir un color es querer ESE color.
  if (cual === 'fondo') el.style.setProperty('background-image', 'none', 'important');
  return true;
}

/** La primera `url(...)` de un `background-image` calculado, o null (un degradado o `none` no son una imagen). */
export function imagenDeFondo(backgroundImage: string | null | undefined): string | null {
  const m = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(backgroundImage ?? '');
  return m && m[2] ? m[2] : null;
}

/** Una dirección que puede ir de imagen de fondo: https (el bucket, el stock) o una imagen en data. */
const URL_IMAGEN = /^(https:\/\/[^\s"'()<>\\]+|data:image\/(png|jpe?g|webp|gif|avif|svg\+xml)[;,][^\s"'()<>\\]+)$/i;

/** La imagen de fondo del elemento; `null` la saca. Sin cambiar cómo se acomoda, salvo que no tuviera nada dicho. */
export function ponerImagenDeFondo(el: ElementoDiseno, url: string | null, acomodo?: { size?: string; position?: string }): boolean {
  if (url === null) { el.style.setProperty('background-image', 'none', 'important'); return true; }
  if (!URL_IMAGEN.test(url.trim())) return false;
  el.style.setProperty('background-image', `url("${url.trim()}")`, 'important');
  if (acomodo?.size !== undefined && (!acomodo.size || acomodo.size === 'auto')) el.style.setProperty('background-size', 'cover');
  if (acomodo?.position !== undefined && (!acomodo.position || acomodo.position === '0% 0%')) el.style.setProperty('background-position', 'center');
  return true;
}

/** Lo que hace falta de un `::before` o `::after` calculado para saber si tapa el fondo del elemento. */
export type CapaPseudo = { content: string; position: string; backgroundColor: string; backgroundImage: string; opacity: string };

/**
 * ¿Una capa de la página (`::before` o `::after` con fondo, puesta encima) tapa el fondo del elemento? (4/11/2026)
 * El ❌ de la sección 13 de la copia #69 (matriz del 29/10): la imagen de fondo quedaba puesta y no se veía. La sospecha es
 * una capa así; sin la copia (vive en la base de producción) no se pudo medir. Con esto el editor no queda mudo: lo dice.
 * Un estilo en línea no llega a un seudo-elemento, así que lo que se puede hacer es avisar.
 */
export function capaEncima(capas: readonly (CapaPseudo | null | undefined)[]): boolean {
  const transparente = (c: string) => !c || c === 'transparent' || /^rgba\(.*,\s*0(\.0+)?\)$/i.test(c.replace(/\s+/g, ' '));
  return capas.some((c) => !!c
    && c.content !== 'none' && c.content !== 'normal' && c.content !== ''
    && (c.position === 'absolute' || c.position === 'fixed')
    && Number(c.opacity || '1') >= 0.05
    && (c.backgroundImage !== 'none' && !!c.backgroundImage || !transparente(c.backgroundColor)));
}

/** Una familia de fuente que va al `style`: nombres y comas, nada más. */
export function fuenteValida(v: string): boolean {
  const s = v.trim();
  return !!s && s.length <= 200 && /^[\w\s"',.-]+$/.test(s) && !/[;{}<>\\]|url\(/i.test(s);
}

export function ponerFuente(el: ElementoDiseno, familia: string | null): boolean {
  if (familia === null) { el.style.removeProperty('font-family'); return true; }
  if (!fuenteValida(familia)) return false;
  el.style.setProperty('font-family', familia.trim(), 'important');
  return true;
}

/** Las fuentes que la página YA carga (las de sus elementos, sin repetir): elegir otra que no carga no cambiaría nada. */
export function fuentesDeLaPagina(familias: readonly string[], tope = 12): string[] {
  const vistas = new Map<string, string>();
  for (const f of familias) {
    const s = (f ?? '').trim();
    if (!s || !fuenteValida(s)) continue;
    const primera = s.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (!primera || /^(inherit|initial|unset|serif|sans-serif|monospace|system-ui|-apple-system|ui-sans-serif)$/.test(primera)) continue;
    if (!vistas.has(primera)) vistas.set(primera, s);
    if (vistas.size >= tope) break;
  }
  return [...vistas.values()];
}

/** Los atributos que un `<button>` trae y un `<a>` no debe llevar (son de formulario o de su comportamiento). */
const DE_BOTON = new Set(['type', 'disabled', 'form', 'formaction', 'formmethod', 'formenctype', 'formtarget', 'formnovalidate', 'name', 'value', 'popovertarget', 'popovertargetaction']);

/**
 * El elemento como un `<a>`, para ponerle a dónde llevar: un `<a>` vuelve tal cual; un `<button>` (o algo con
 * `role="button"`) se cambia por un `<a>` con sus mismos atributos de estilo y sus hijos, en su lugar. null = no es un
 * botón ni un enlace (un texto suelto no se convierte en enlace por acá: eso es «Enlace» de la barra de texto).
 */
export function comoEnlace(el: ElementoDiseno): ElementoDiseno | null {
  const t = el.tagName.toLowerCase();
  if (t === 'a') return el;
  if (t !== 'button' && el.getAttribute('role') !== 'button') return null;
  const a = el.ownerDocument.createElement('a');
  for (let i = 0; i < el.attributes.length; i++) {
    const { name, value } = el.attributes[i];
    if (DE_BOTON.has(name.toLowerCase()) || /^on/i.test(name)) continue;
    if (name.toLowerCase() === 'role' && value === 'button') continue;
    a.setAttribute(name, value);
  }
  // Un botón no lleva subrayado ni el color de un enlace: el `<a>` se ve como el botón (su hoja le daba el estilo por la etiqueta).
  a.style.setProperty('text-decoration', 'none');
  a.style.setProperty('display', 'inline-block');
  a.style.setProperty('cursor', 'pointer');
  a.append(...Array.from(el.childNodes));
  el.replaceWith(a);
  return a;
}

/**
 * Lo que se mira para que el `<a>` que reemplaza a un `<button>` se vea IGUAL (28/10/2026): la hoja de la página suele dar
 * estilo por etiqueta (`button{…}`, `a{…}`) y el del navegador también. Ni el ancho ni el alto (salen solos y fijarlos en px
 * rompe el celular) ni la manito (el `<a>` la lleva siempre).
 */
export const ESTILO_A_IGUALAR = [
  'display', 'box-sizing', 'vertical-align', 'white-space',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'background-color', 'background-image', 'color', 'box-shadow', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
  'align-items', 'justify-content', 'gap', 'flex-direction',
] as const;

/** Los valores calculados de `ESTILO_A_IGUALAR` (el `getComputedStyle` del iframe). */
export function fotoDeEstilo(cs: { getPropertyValue(p: string): string }): Record<string, string> {
  return Object.fromEntries(ESTILO_A_IGUALAR.map((p) => [p, cs.getPropertyValue(p)]));
}

/** Pone en el `style` del elemento lo que cambió de `antes` a `ahora` (con el valor de antes). Devuelve cuántas. */
export function igualarEstilo(el: ElementoDiseno, antes: Record<string, string>, ahora: Record<string, string>): number {
  let n = 0;
  for (const p of ESTILO_A_IGUALAR) {
    const v = antes[p];
    // El valor va por `setProperty` (no se pega a un texto: no abre otra declaración); lo que ejecuta, igual no.
    if (v === undefined || v === '' || v === ahora[p] || /javascript:|expression\(/i.test(v)) continue;
    el.style.setProperty(p, v);
    n++;
  }
  return n;
}

// ── Elementos NUEVOS adentro de la sección (28/10/2026, «elementos sueltos»: un texto, un botón o una imagen más) ──

/** Lo que va en línea: un elemento nuevo «debajo» de uno de estos va después del bloque que lo tiene, no adentro del renglón. */
const EN_LINEA = new Set(['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'small', 'img', 'picture', 'svg', 'label', 'sup', 'sub', 'code', 'mark', 'button']);

/**
 * Pone `nuevo` debajo del elegido: después de él, o del bloque que lo tiene si es algo en línea (un texto suelto, un enlace,
 * un ícono), sin salir de la sección. Con la sección elegida, al final de ella.
 */
export function agregarElemento(el: ElementoDiseno, raiz: ElementoDiseno, nuevo: ElementoDiseno): void {
  if (el === raiz) { raiz.append(nuevo); return; }
  let ancla = el;
  while (ancla.parentElement && ancla.parentElement !== raiz && EN_LINEA.has(ancla.tagName.toLowerCase())) ancla = ancla.parentElement;
  ancla.after(nuevo);
}

/** Un párrafo nuevo: toma la letra y el color de donde va (la hoja de la página). */
export function nuevoTexto(doc: { createElement(tag: string): ElementoDiseno }, texto = 'Escribe aquí'): ElementoDiseno {
  const p = doc.createElement('p');
  p.append(texto);
  return p;
}

/**
 * Un botón nuevo con el estilo de los de la sección: una copia del primero que se vea como botón (sin su id ni la marca de
 * elegido), con un solo texto. Si la sección no tiene, uno sobrio. Lleva a «#» hasta que se le ponga a dónde.
 */
export function nuevoBoton(doc: { createElement(tag: string): ElementoDiseno }, raiz: ElementoDiseno, texto = 'Botón'): ElementoDiseno {
  const modelo = Array.from(raiz.querySelectorAll('a')).find(esBotonPorAtributos) ?? null;
  const a = modelo ? modelo.cloneNode(false) : doc.createElement('a');
  a.removeAttribute('id');
  a.removeAttribute(MARCA_ELEGIDO);
  a.setAttribute('href', '#');
  if (!modelo) {
    for (const [p, v] of [['display', 'inline-block'], ['padding', '12px 22px'], ['border-radius', '8px'], ['background', '#1f6feb'],
      ['color', '#ffffff'], ['font-weight', '600'], ['text-decoration', 'none']] as const) a.style.setProperty(p, v);
  }
  a.append(texto);
  return a;
}

/** Una imagen nueva que no se sale de su caja. */
export function nuevaImagen(doc: { createElement(tag: string): ElementoDiseno }, src: string, alt = ''): ElementoDiseno {
  const img = doc.createElement('img');
  img.setAttribute('src', src);
  img.setAttribute('alt', alt);
  img.style.setProperty('max-width', '100%');
  img.style.setProperty('height', 'auto');
  return img;
}
