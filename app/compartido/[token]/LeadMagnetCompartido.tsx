// =============================================================================
// LeadMagnetCompartido — la página del Copywriter que recibe un lead, de SOLO LECTURA (5/11/2026)
// =============================================================================
// Martín (29/10/2026): «compartir un Notion con prompts, una guía, un checklist». Es la página pública de Notion: la misma hoja
// que la del Copywriter (app/copywriter/notion.css, que copia las MEDIDAS de Notion: 708 px de ancho, el título de 40 px en
// 700, el cuerpo de 16 px con 1,5 de interlínea, los encabezados de 1,875 / 1,5 / 1,25 em, el destacado gris con su emoji), sin
// editor: un componente del SERVER que recorre el documento y dibuja HTML. Sin TipTap ni JavaScript: abre al instante en el
// teléfono del lead, y lo que no es un nodo conocido no se dibuja.
// Los links se vuelven a mirar acá (sólo http, https y mailto): el documento ya viene saneado (lib/copywriter/doc.ts), pero
// esta página la abre cualquiera.
// =============================================================================

// La hoja (./lead-magnet.css) la importa page.tsx, no este componente: en node un `.css` no carga, y el test lo dibuja.
import type { ReactNode } from 'react';
import type { JsonNodo } from '@/lib/copywriter/tipos';

const hrefSeguro = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return /^(https?:\/\/|mailto:)/i.test(t) && t.length <= 2_000 ? t : null;
};

function texto(n: JsonNodo, k: number): ReactNode {
  let out: ReactNode = n.text ?? '';
  for (const m of n.marks ?? []) {
    if (m.type === 'bold') out = <strong>{out}</strong>;
    else if (m.type === 'italic') out = <em>{out}</em>;
    else if (m.type === 'strike') out = <s>{out}</s>;
    else if (m.type === 'underline') out = <u>{out}</u>;
    else if (m.type === 'code') out = <code>{out}</code>;
    else if (m.type === 'link') {
      const href = hrefSeguro(m.attrs?.href);
      if (href) out = <a href={href} target="_blank" rel="noopener noreferrer nofollow">{out}</a>;
    }
  }
  return <span key={k}>{out}</span>;
}

function enLinea(hijos: JsonNodo[] | undefined): ReactNode[] {
  return (hijos ?? []).map((h, i) => (h.type === 'hardBreak' ? <br key={i} /> : h.type === 'text' ? texto(h, i) : null));
}

const num = (v: unknown): number | undefined => (Number.isInteger(v) && (v as number) > 1 ? (v as number) : undefined);

function bloque(n: JsonNodo, k: number): ReactNode {
  const hijos = (lista: JsonNodo[] | undefined) => (lista ?? []).map(bloque);
  switch (n.type) {
    case 'paragraph':
      return <p key={k} className="lmc-p">{enLinea(n.content)}</p>;
    case 'heading': {
      const nivel = Number(n.attrs?.level);
      if (nivel === 1) return <h2 key={k} className="lmc-h1">{enLinea(n.content)}</h2>;
      if (nivel === 3) return <h4 key={k} className="lmc-h3">{enLinea(n.content)}</h4>;
      return <h3 key={k} className="lmc-h2">{enLinea(n.content)}</h3>;
    }
    case 'bulletList':
      return <ul key={k} className="lmc-ul">{hijos(n.content)}</ul>;
    case 'orderedList':
      return <ol key={k} className="lmc-ol" start={num(n.attrs?.start)}>{hijos(n.content)}</ol>;
    case 'listItem':
      return <li key={k}>{hijos(n.content)}</li>;
    case 'taskList':
      return <ul key={k} className="lmc-tareas">{hijos(n.content)}</ul>;
    case 'taskItem': {
      const hecho = n.attrs?.checked === true;
      return (
        <li key={k} className="lmc-tarea" data-hecho={hecho ? 'si' : undefined}>
          <span className="lmc-casilla" aria-hidden>{hecho ? '✓' : ''}</span>
          <div className="lmc-tarea-texto">{hijos(n.content)}</div>
        </li>
      );
    }
    case 'blockquote':
      return <blockquote key={k} className="lmc-cita">{hijos(n.content)}</blockquote>;
    case 'horizontalRule':
      return <hr key={k} className="lmc-hr" />;
    case 'callout': {
      const emoji = typeof n.attrs?.emoji === 'string' ? n.attrs.emoji : '💡';
      return (
        <div key={k} className="lmc-destacado">
          <span className="lmc-destacado-emoji" aria-hidden>{emoji}</span>
          <div>{hijos(n.content)}</div>
        </div>
      );
    }
    case 'toggle': {
      const [primero, ...resto] = n.content ?? [];
      return (
        <details key={k} className="lmc-desplegable" open={n.attrs?.abierto !== false}>
          <summary>{primero ? enLinea(primero.content) : null}</summary>
          <div className="lmc-desplegable-dentro">{hijos(resto)}</div>
        </details>
      );
    }
    case 'table':
      return (
        <div key={k} className="lmc-tabla-caja">
          <table className="lmc-tabla"><tbody>{hijos(n.content)}</tbody></table>
        </div>
      );
    case 'tableRow':
      return <tr key={k}>{hijos(n.content)}</tr>;
    case 'tableHeader':
    case 'tableCell': {
      const props = { colSpan: num(n.attrs?.colspan), rowSpan: num(n.attrs?.rowspan) };
      return n.type === 'tableHeader' ? <th key={k} {...props}>{hijos(n.content)}</th> : <td key={k} {...props}>{hijos(n.content)}</td>;
    }
    default:
      return null;
  }
}

export default function LeadMagnetCompartido({ titulo, emoji, doc }: { titulo: string; emoji: string | null; doc: JsonNodo }) {
  return (
    <main className="lmc">
      <article className="lmc-hoja">
        {emoji ? <div className="lmc-emoji" aria-hidden>{emoji}</div> : null}
        <h1 className="lmc-titulo">{titulo}</h1>
        {(doc.content ?? []).map(bloque)}
      </article>
    </main>
  );
}
