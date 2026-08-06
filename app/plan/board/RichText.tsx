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

export function RichText({ value, onChange, placeholder, style }: {
  value: string; onChange: (html: string) => void; placeholder?: string; style?: CSSProperties;
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
  const btn: CSSProperties = { width: 26, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12.5, fontFamily: SANS, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div>
      <style>{`.mako-rt[contenteditable]:empty:before{content:attr(data-ph);color:var(--faint);pointer-events:none}.mako-rt b,.mako-rt strong{font-weight:700}.mako-rt u{text-decoration:underline}.mako-rt code{font-family:'Geist Mono',monospace;font-size:.9em;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:1px 5px}.mako-rt ul{margin:4px 0;padding-left:20px}.mako-rt li{margin:2px 0}`}</style>
      {/* mini toolbar: aparece al enfocar */}
      <div style={{ display: 'flex', gap: 5, height: focused ? 30 : 0, opacity: focused ? 1 : 0, overflow: 'hidden', transition: 'height .12s, opacity .12s', marginBottom: focused ? 6 : 0 }}>
        <button type="button" title="Negrita" onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} style={{ ...btn, fontWeight: 800 }}>B</button>
        <button type="button" title="Subrayado" onMouseDown={(e) => { e.preventDefault(); cmd('underline'); }} style={{ ...btn, textDecoration: 'underline' }}>U</button>
        <button type="button" title="Lista" onMouseDown={(e) => { e.preventDefault(); cmd('insertUnorderedList'); }} style={btn}>•</button>
      </div>
      <div ref={ref} className="mako-rt" contentEditable suppressContentEditableWarning role="textbox" aria-multiline
        data-ph={placeholder || 'Escribí acá…'}
        onFocus={() => setFocused(true)} onBlur={commit}
        style={{ outline: 'none', border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 14, lineHeight: 1.65, fontFamily: SANS, minHeight: 24, whiteSpace: 'pre-wrap', ...style }} />
    </div>
  );
}
