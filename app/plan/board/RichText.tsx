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
export function mdAHtml(texto: string): string {
  if (!texto || /<[a-z][\s\S]*>/i.test(texto)) return texto;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
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
      <style>{`.mako-rt[contenteditable]:empty:before{content:attr(data-ph);color:var(--faint);pointer-events:none}.mako-rt b,.mako-rt strong{font-weight:700}.mako-rt u{text-decoration:underline}`}</style>
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
