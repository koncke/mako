'use client';

// =============================================================================
// Markdown — el mismo parser que ya usaba el chat de MaKo, ahora compartido
// =============================================================================
// Es EL parser que venía funcionando adentro de MakoChat: negrita, bullets, títulos
// y separadores. Se mueve acá tal cual (sin dependencias nuevas y sin
// dangerouslySetInnerHTML) porque ahora lo necesita también el DETALLE de una tarea:
// desde que la extracción de reuniones escribe el contexto con formato
// (**Qué pidió** / **Por qué** / listas), pintarlo como texto plano mostraba los
// asteriscos crudos.
//
// A propósito NO soporta markdown completo: lo que se escribe en la app es negrita,
// listas y algún título. Una librería entera para eso es peso muerto.
// =============================================================================

import type { ReactNode } from 'react';

/** Negrita inline. Lo demás pasa como texto. */
export function renderInline(text: string, k: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong> : <span key={`${k}-${i}`}>{p}</span>,
  );
}

export function Markdown({ text, compacto = false }: { text: string; compacto?: boolean }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(<ul key={`ul-${blocks.length}`} style={{ margin: '4px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>{items.map((b, i) => <li key={i} style={{ lineHeight: 1.5 }}>{renderInline(b, `li-${blocks.length}-${i}`)}</li>)}</ul>);
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    if (/^[-*•]\s+/.test(t)) { bullets.push(t.replace(/^[-*•]\s+/, '')); return; }
    flush();
    if (t === '') return;
    if (/^---+$/.test(t)) { blocks.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); return; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { const lvl = h[1].length; blocks.push(<div key={idx} style={{ fontWeight: 600, fontSize: lvl === 1 ? 16 : lvl === 2 ? 15 : 14, color: 'var(--ink)', margin: '6px 0 2px' }}>{renderInline(h[2], `h-${idx}`)}</div>); return; }
    blocks.push(<p key={idx} style={{ margin: compacto ? '2px 0' : '3px 0', lineHeight: 1.55 }}>{renderInline(t, `p-${idx}`)}</p>);
  });
  flush();
  return <>{blocks}</>;
}
