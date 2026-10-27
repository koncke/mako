// =============================================================================
// botones-diseno — los botones de un «Diseño editable»: reconocerlos y cambiar su texto y sus colores
// =============================================================================
// Martín (26/10/2026): «Los botones tampoco son editables». En una sección de diseño (las páginas de MaKo) un botón es
// un `<a>` con su estilo: el texto se podía escribir, pero al elegirlo sólo se ofrecía «Enlace» (un ícono chico) y nada
// para su color. Con esto, elegir un botón abre «Botón» (nodos/HtmlEditableVista.tsx): su texto, a dónde lleva y sus
// dos colores. Todo queda en su HTML (el `style` del `<a>`), sin nodos del editor.
// =============================================================================

/** ¿El enlace se ve como un botón? Con fondo propio, o con borde redondeado o sombra y relleno. */
export function esBotonDeDiseno(a: Element): boolean {
  const v = a.ownerDocument.defaultView;
  if (!v) return false;
  const cs = v.getComputedStyle(a);
  const fondo = cs.backgroundColor;
  const conFondo = !!fondo && fondo !== 'transparent' && !/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(fondo);
  const conImagen = !!cs.backgroundImage && cs.backgroundImage !== 'none';
  const relleno = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingTop) || 0);
  const borde = (parseFloat(cs.borderTopWidth) || 0) > 0 && (parseFloat(cs.borderTopLeftRadius) || 0) > 0;
  const sombra = !!cs.boxShadow && cs.boxShadow !== 'none';
  return conFondo || conImagen || ((borde || sombra) && relleno >= 8);
}

/** Lo que muestra un botón, sin sus íconos y con los espacios juntos. */
export const textoDeBoton = (a: Element): string => (a.textContent ?? '').replace(/\s+/g, ' ').trim();

/** ¿El texto del botón lleva marcas que pone la página publicada (la prueba gratis, un precio)? Ese se escribe a mano. */
export const conMarcas = (a: Element): boolean => !!a.querySelector('[data-mako-prueba],[data-mako-precio],[data-mako-desde]');

/**
 * Cambia el texto y deja los íconos donde estaban: el texto nuevo va en el primer pedazo de texto (con sus espacios de
 * los costados) y los otros pedazos se vacían.
 */
export function ponerTextoDeBoton(a: Element, texto: string): void {
  const doc = a.ownerDocument;
  const pedazos: Text[] = [];
  const w = doc.createTreeWalker(a, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = w.nextNode(); n; n = w.nextNode()) if ((n.textContent ?? '').trim()) pedazos.push(n as Text);
  if (!pedazos.length) { a.appendChild(doc.createTextNode(texto)); return; }
  const [primero, ...resto] = pedazos;
  const m = /^(\s*)[\s\S]*?(\s*)$/.exec(primero.textContent ?? '');
  primero.textContent = (m?.[1] ?? '') + texto + (m?.[2] ?? '');
  for (const t of resto) t.textContent = '';
}

/** `rgb(47, 111, 237)` → `#2f6fed` (lo que el selector de color sabe leer). Lo que no es un rgb, como vino. */
export function hexDeRgb(v: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v.trim());
  if (!m) return v;
  return '#' + [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Number(x))).toString(16).padStart(2, '0')).join('');
}

/** Los dos colores de un botón, como se ven. */
export function colorDeBoton(a: Element): { fondo: string; texto: string } {
  const cs = a.ownerDocument.defaultView?.getComputedStyle(a);
  return { fondo: hexDeRgb(cs?.backgroundColor ?? ''), texto: hexDeRgb(cs?.color ?? '') };
}

/**
 * Un color del botón, con `!important`: la hoja de un diseño suele escribir el color del botón así (la de las landings de
 * MaKo: `.mkv-btn { color: #fff !important }`) y un estilo sin él no ganaría. El fondo va entero (`background`): un
 * degradé del diseño se reemplaza por el color.
 */
export function ponerColorDeBoton(a: HTMLElement, cual: 'fondo' | 'texto', valor: string): void {
  a.style.setProperty(cual === 'fondo' ? 'background' : 'color', valor, 'important');
}
