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

export function RichText({ value, onChange, placeholder, style }: {
  value: string; onChange: (html: string) => void; placeholder?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // set inicial (una vez) + cuando cambia value DESDE afuera y no está enfocado
  useEffect(() => {
    if (ref.current && !focused && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    let html = ref.current?.innerHTML ?? '';
    if (html === '<br>' || html === '<div><br></div>') html = '';
    html = sanitizeHtml(html);
    if (html !== value) onChange(html);
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
