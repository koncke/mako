'use client';

// RichText — descripción editable que "flota" (sin caja), como el título, pero con
// formato (negrita / subrayado / lista). Guarda HTML. contentEditable NO controlado:
// se setea el HTML inicial una vez y se commitea onBlur para no pelear con el cursor.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

// sanea el HTML de la descripción (viene de contentEditable + paste): saca scripts,
// estilos, iframes y handlers on*, para poder renderizarlo con dangerouslySetInnerHTML.
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

// saca las etiquetas para mostrar la descripción como texto plano en las cards
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Markdown → HTML, solo para el texto que MaKo escribe.
 *
 * El campo guarda HTML (viene de contentEditable), pero la extracción de reuniones y el
 * Perro escriben MARKDOWN: `**Qué pidió**`, bullets con `- `. Sin esto se veían los
 * asteriscos crudos en la tarjeta. Se aplica SOLO si el texto no tiene ni una etiqueta:
 * lo que ya es HTML —todo lo que escribió el dueño a mano— no se toca.
 */
/** Las etiquetas que de verdad emite `contentEditable`. La detección vieja era
 *  `/<[a-z][\s\S]*>/i` — CUALQUIER cosa entre `<` y `>` — y eso rompía feo con los
 *  detalles que HABLAN de HTML: uno del rediseño dice «1.158 `<button>` sueltos», y con
 *  eso el texto se daba por HTML, así que (a) el markdown no se convertía y se veían los
 *  `**` crudos, y (b) ese `<button>` se renderizaba como un botón de verdad adentro de la
 *  descripción. Ahora solo cuentan las etiquetas de formato; `<button>`, `<select>` o
 *  `<input>` mencionados en un texto se escapan y se leen como lo que son: texto. */
const ES_HTML = /<(div|p|br|ul|ol|li|strong|b|u|em|i|span|h[1-6]|a)[\s>/]/i;

export function mdAHtml(texto: string): string {
  if (!texto || ES_HTML.test(texto)) return texto;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // `codigo` → <code>. Los detalles técnicos están llenos de `archivo:linea` y de
  // `style={{`, y sin esto se leían las comillas invertidas crudas. Va DESPUÉS del
  // escapado, así que lo que quedó adentro ya es texto seguro.
  const inline = (s: string) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out: string[] = [];
  let lista: string[] = [];
  const cerrar = () => { if (lista.length) { out.push(`<ul>${lista.map((li) => `<li>${li}</li>`).join('')}</ul>`); lista = []; } };
  for (const raw of texto.split('\n')) {
    const t = raw.trim();
    if (/^[-*•]\s+/.test(t)) { lista.push(inline(t.replace(/^[-*•]\s+/, ''))); continue; }
    cerrar();
    if (!t) continue;
    out.push(`<div>${inline(t)}</div>`);
  }
  cerrar();
  return out.join('');
}

/**
 * LA SEÑAL DE FOCO DE UN CAMPO DE TEXTO DEL DETALLE, Y ES UNA SOLA.
 *
 * «No tiene que aparecer ningún recuadro de texto, tal cual como la descripción, que no
 * parezca un input que esté flotando el título» (25/09/2026). Lo que había en el título
 * —borde gris al pasar el mouse, fondo `--surface-2` al enfocar, todo con `borderRadius`—
 * es literalmente un recuadro, y el doc de al lado no tenía ninguno: las dos cosas se
 * editan igual y se veían distinto.
 *
 * ⚠️ PERO UN CONTROL SIN NINGUNA SEÑAL DE FOCO ES INACCESIBLE POR TECLADO. Así que no se
 * saca la señal: se saca la CAJA. Queda una barra de 2px en el borde izquierdo, que es la
 * misma pieza que ya marca el margen del doc, no un rectángulo alrededor del texto.
 *
 * Y vive ACÁ, exportada, para que el título y el doc usen el MISMO valor: dos campos que
 * se editan igual no pueden señalar el foco de dos maneras. El `:focus` de abajo la aplica
 * al editor; el título la escribe con este mismo string.
 */
export const FOCO_BARRA = 'inset 2px 0 0 var(--primary)';

export function RichText({ value, onChange, placeholder, style, encabezados = false, onFormato }: {
  value: string; onChange: (html: string) => void; placeholder?: string; style?: CSSProperties;
  /** dibuja el botón que convierte el renglón del cursor en ENCABEZADO (y al revés). Sólo
   *  lo pide el doc del detalle: en una nota no hay nada que plegar. */
  encabezados?: boolean;
  /** avisa que el botón de arriba tocó la estructura, para que quien decora el plegado
   *  vuelva a pasar. Trae el texto del encabezado RECIÉN CREADO (o `null` al quitarlo):
   *  sin eso, el encabezado nuevo nace plegado y esconde lo que se está escribiendo. */
  onFormato?: (encabezadoNuevo: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // set inicial (una vez) + cuando cambia value DESDE afuera y no está enfocado
  useEffect(() => {
    const html = mdAHtml(value || '');
    if (ref.current && !focused && ref.current.innerHTML !== html) ref.current.innerHTML = html;
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    let html = ref.current?.innerHTML ?? '';
    if (html === '<br>' || html === '<div><br></div>') html = '';
    html = sanitizeHtml(html);
    // Ojo con el markdown: al mostrarlo se convierte a HTML, así que si el dueño abre y
    // cierra la tarjeta SIN tocar nada, `html` ya no es igual a `value` y se guardaría
    // solo. Se compara contra la versión convertida para no ensuciar el historial con
    // ediciones fantasma.
    if (html !== value && html !== mdAHtml(value || '')) onChange(html);
  };
  const cmd = (c: string) => { document.execCommand(c, false); ref.current?.focus(); };

  /**
   * EL BOTÓN QUE CREA UN DESPLEGABLE. «Si es formato, debo poder poner otros desplegables,
   * de alguna manera» (25/09/2026): hasta hoy los chevrones salían de los encabezados que
   * YA venían en el texto (los que escribe la extracción) y no había forma de crear uno.
   *
   * ⚠️ USA LA MISMA REGLA CON LA QUE `DetalleDoc` RECONOCE UN ENCABEZADO, y por eso emite
   * un `<h3>` y no una negrita: el reconocedor acepta cualquier `h1-h6` SIN pasar por la
   * heurística del texto (≤60 caracteres, sin punto ni dos puntos al final). Con una
   * negrita, un renglón largo o terminado en punto se vería en negrita y no se plegaría
   * —el creador y el reconocedor diciendo cosas distintas, que es cómo se escribe algo que
   * no anda y no da ningún error—. Un `<h3>` puesto a mano es una DECLARACIÓN, no una
   * adivinanza, así que siempre pliega.
   */
  const bloqueDelCursor = (): HTMLElement | null => {
    const ed = ref.current;
    const sel = window.getSelection();
    if (!ed || !sel || !sel.anchorNode || !ed.contains(sel.anchorNode)) return null;
    let n: Node | null = sel.anchorNode;
    while (n && n.parentNode && n.parentNode !== ed) n = n.parentNode;
    return n && n.nodeType === 1 && n.parentNode === ed ? (n as HTMLElement) : null;
  };
  const alternarEncabezado = () => {
    const antes = bloqueDelCursor();
    const eraH = !!antes && /^H[1-6]$/.test(antes.tagName);
    document.execCommand('formatBlock', false, eraH ? '<div>' : '<h3>');
    const ahora = bloqueDelCursor();
    // Al QUITARLO hay que sacarle también la negrita: casi todos los encabezados del
    // detalle nacen de un `**…**` del markdown, así que un bloque desformateado que sigue
    // entero en negrita lo vuelve a reconocer la otra mitad de la regla y el botón no
    // haría nada visible.
    // Probado ROMPIÉNDOLO en Chrome (25/09/2026) sobre `<div><strong>Por qué</strong></div>`:
    // con sólo `formatBlock('<div>')` queda `<div><strong>Por qué</strong></div>` y el
    // reconocedor sigue diciendo que SÍ (el chevrón no se va); con este bloque puesto queda
    // `<div>Por qué</div>` y dice que NO. Uno y uno.
    if (eraH && ahora && ahora.querySelector('strong,b') && (ahora.textContent || '').trim() === (ahora.querySelector('strong,b')?.textContent || '').trim()) {
      const r = document.createRange(); r.selectNodeContents(ahora);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
      document.execCommand('bold');
      sel?.collapseToEnd();
    }
    ref.current?.focus();
    onFormato?.(!eraH && ahora ? (ahora.textContent || '').trim() : null);
  };

  const btn: CSSProperties = { width: 26, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12.5, fontFamily: SANS, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div>
      <style>{`.mako-rt[contenteditable]:empty:before{content:attr(data-ph);color:var(--faint);pointer-events:none}.mako-rt b,.mako-rt strong{font-weight:700}.mako-rt u{text-decoration:underline}.mako-rt code{font-family:'Geist Mono',monospace;font-size:.9em;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:1px 5px}.mako-rt ul{margin:4px 0;padding-left:20px}.mako-rt li{margin:2px 0}.mako-rt h1,.mako-rt h2,.mako-rt h3,.mako-rt h4,.mako-rt h5,.mako-rt h6{font-size:1em;font-weight:700;margin:11px 0 2px;color:var(--ink)}.mako-rt:focus{box-shadow:${FOCO_BARRA}}`}</style>
      {/* mini toolbar: aparece al enfocar */}
      <div style={{ display: 'flex', gap: 5, height: focused ? 30 : 0, opacity: focused ? 1 : 0, overflow: 'hidden', transition: 'height .12s, opacity .12s', marginBottom: focused ? 6 : 0 }}>
        <button type="button" title="Negrita" onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} style={{ ...btn, fontWeight: 800 }}>B</button>
        <button type="button" title="Subrayado" onMouseDown={(e) => { e.preventDefault(); cmd('underline'); }} style={{ ...btn, textDecoration: 'underline' }}>U</button>
        <button type="button" title="Lista" onMouseDown={(e) => { e.preventDefault(); cmd('insertUnorderedList'); }} style={btn}>•</button>
        {encabezados && <button type="button" title="Convertir este renglón en desplegable (y al revés)" aria-label="Convertir este renglón en desplegable"
          onMouseDown={(e) => { e.preventDefault(); alternarEncabezado(); }} style={{ ...btn, width: 'auto', padding: '0 8px', gap: 4, fontWeight: 800 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M3.4 1.4 L7 5 L3.4 8.6" /></svg>H
        </button>}
      </div>
      <div ref={ref} className="mako-rt" contentEditable suppressContentEditableWarning role="textbox" aria-multiline
        data-ph={placeholder || 'Escribe aquí…'}
        onFocus={() => setFocused(true)} onBlur={commit}
        style={{ outline: 'none', border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 14, lineHeight: 1.65, fontFamily: SANS, minHeight: 24, whiteSpace: 'pre-wrap', paddingLeft: 10, ...style }} />
    </div>
  );
}
