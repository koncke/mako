// ⚠️ SIN 'use client' a propósito: no tiene hooks y lo importan módulos neutros (Hilo.tsx) que no pueden llamar un valor de un
// archivo cliente (tests/frontera-use-client.test.ts).
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
//
// 17/10/2026 (Martín, Ops Center: «que los MD no salgan con texto feo, sino con el formato aplicado... nada de asteriscos ni
// almohadillas a la vista»): lo que escriben los CHATS de Claude trae más que eso, y cada cosa sin soporte se veía cruda.
// Se SUMÓ, sin cambiar lo de antes: listas numeradas, `código` en línea y en bloque, *cursiva*, títulos hasta
// `######`, citas con «>» y tablas con «|». Lo demás sigue pasando como texto.
// =============================================================================

import type { ReactNode } from 'react';
import { trozosConLinks } from '@/lib/links-texto';
import { Icon } from '@/app/_components/icons';
import { trozosConIconos } from '@/app/_chat/iconos-de-botones';

/** El botón o la tab que MaKo nombra entre «», con su ícono de verdad (`iconos`, app/_chat/iconos-de-botones.ts). */
const BOTON_NOMBRADO = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 6px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontWeight: 600, whiteSpace: 'nowrap' as const, verticalAlign: 'baseline' };
function conIconos(p: string, kk: string): ReactNode {
  const trozos = trozosConIconos(p);
  if (!trozos.some((x) => x.t === 'boton')) return p;
  return trozos.map((x, j) => (x.t === 'texto'
    ? <span key={`${kk}-i${j}`}>{x.s}</span>
    : <span key={`${kk}-i${j}`} data-boton-nombrado="" style={BOTON_NOMBRADO}><Icon name={x.icono} size={13} />{x.nombre}</span>));
}

const CODIGO_EN_LINEA = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.92em', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', borderRadius: 4, padding: '1px 4px', overflowWrap: 'anywhere' as const };
/** Una *cursiva* sólo si el asterisco abre una palabra y el otro la cierra: «lib/*.ts y app/*.tsx» no es una cursiva. */
const CURSIVA = /(^|[\s(\[«"'])(\*[^*\s](?:[^*]*[^*\s])?\*)(?=$|[\s.,;:!?)\]»"'])/g;

/** Inline: `código`, **negrita** y *cursiva*. Lo demás pasa como texto; con `enlaces`, los links http(s) y
 *  `[texto](url)` van como <a> (17/10/2026, el Ops Center: «un link pegado en el chat siempre se ve azul y clickeable»;
 *  lib/links-texto.ts). El código no se interpreta por adentro: lo que va entre comillas invertidas sale tal cual. */
export function renderInline(text: string, k: string, enlaces = false, iconos = false): ReactNode[] {
  const texto = (p: string, kk: string): ReactNode => (iconos ? conIconos(p, kk) : p);
  const conLinks = (p: string, kk: string): ReactNode => (!enlaces ? texto(p, kk) : trozosConLinks(p).map((x, j) => (x.tipo === 'texto'
    ? <span key={`${kk}-${j}`}>{texto(x.t, `${kk}-${j}`)}</span>
    : <a key={`${kk}-${j}`} className="co-link" href={x.href} target="_blank" rel="noreferrer noopener">{x.t}</a>)));
  // Un texto sin «*» sueltos pasa derecho (el DOM de siempre); con ellos, la cursiva.
  const conCursiva = (p: string, kk: string): ReactNode => {
    if (!p.includes('*')) return conLinks(p, kk);
    const out: ReactNode[] = [];
    let desde = 0;
    for (const m of p.matchAll(CURSIVA)) {
      const inicio = (m.index ?? 0) + m[1].length;
      if (inicio > desde) out.push(<span key={`${kk}-t${desde}`}>{conLinks(p.slice(desde, inicio), `${kk}-t${desde}`)}</span>);
      out.push(<em key={`${kk}-e${inicio}`}>{conLinks(m[2].slice(1, -1), `${kk}-e${inicio}`)}</em>);
      desde = inicio + m[2].length;
    }
    if (!out.length) return conLinks(p, kk);
    if (desde < p.length) out.push(<span key={`${kk}-t${desde}`}>{conLinks(p.slice(desde), `${kk}-t${desde}`)}</span>);
    return out;
  };
  const conNegrita = (p: string, kk: string): ReactNode[] => p.split(/(\*\*[^*]+\*\*)/g).map((q, i) =>
    /^\*\*[^*]+\*\*$/.test(q) ? <strong key={`${kk}-${i}`}>{conCursiva(q.slice(2, -2), `${kk}-${i}`)}</strong> : <span key={`${kk}-${i}`}>{conCursiva(q, `${kk}-${i}`)}</span>);
  return text.split(/(`[^`\n]+`)/g).flatMap((p, i): ReactNode[] => (/^`[^`\n]+`$/.test(p)
    ? [<code key={`${k}-c${i}`} style={CODIGO_EN_LINEA}>{p.slice(1, -1)}</code>]
    : conNegrita(p, `${k}-${i}`)));
}

/**
 * Un texto de UNA línea con su formato: si no trae ninguna marca (`código`, *cursiva*, **negrita**, un link) sale el texto tal
 * cual, sin envoltorios; si la trae, pasa por `renderInline` con los links azules. Es lo que usan los títulos, los cierres y las
 * preguntas de un chat (17/10/2026: «nada de asteriscos ni almohadillas a la vista»).
 */
export function conFormato(text: string, k: string): ReactNode {
  return /[`*]|\[|https?:\/\//i.test(text) ? renderInline(text, k, true) : text;
}

/** Las celdas de una fila de tabla («| a | b |»). */
const celdas = (t: string) => t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const ES_FILA_TABLA = /^\|.*\|$/;
const ES_SEPARADOR_TABLA = /^\|[\s:|-]+\|$/;

/**
 * `aire` (26/10/2026, Martín: «Que se parezca a Claude las respuestas»): el espacio de una respuesta de Claude, entre
 * párrafos y entre los ítems de una lista. Lo usan las respuestas de los chats del Ops Center; lo demás queda como estaba.
 */
export function Markdown({ text, compacto = false, enlaces = false, aire = false, iconos = false }: { text: string; compacto?: boolean; enlaces?: boolean; aire?: boolean; iconos?: boolean }) {
  const lines = text.split('\n');
  const lista = { margin: aire ? '2px 0 10px' : '4px 0', display: 'flex', flexDirection: 'column' as const, gap: aire ? 6 : 3 };
  const item = { lineHeight: aire ? 1.6 : 1.5 };
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let numeradas: string[] = [];
  let desde = 1;
  let tabla: string[][] = [];
  let cita: string[] = [];
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(<ul key={`ul-${blocks.length}`} style={{ ...lista, paddingLeft: 20 }}>{items.map((b, i) => <li key={i} style={item}>{renderInline(b, `li-${blocks.length}-${i}`, enlaces, iconos)}</li>)}</ul>);
      bullets = [];
    }
    if (numeradas.length) {
      const items = numeradas;
      blocks.push(<ol key={`ol-${blocks.length}`} start={desde} style={{ ...lista, paddingLeft: 22 }}>{items.map((b, i) => <li key={i} style={item}>{renderInline(b, `ol-${blocks.length}-${i}`, enlaces, iconos)}</li>)}</ol>);
      numeradas = [];
    }
    if (tabla.length) {
      const filas = tabla;
      const [cab, ...resto] = filas;
      blocks.push(
        <div key={`tb-${blocks.length}`} style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 'inherit' }}>
            <thead><tr>{cab.map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '4px 10px', borderBottom: '1px solid var(--border-strong)', fontWeight: 600 }}>{renderInline(c, `th-${blocks.length}-${i}`, enlaces, iconos)}</th>)}</tr></thead>
            <tbody>{resto.map((f, r) => <tr key={r}>{f.map((c, i) => <td key={i} style={{ padding: '4px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>{renderInline(c, `td-${blocks.length}-${r}-${i}`, enlaces, iconos)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      tabla = [];
    }
    if (cita.length) {
      const renglones = cita;
      blocks.push(<blockquote key={`bq-${blocks.length}`} style={{ margin: '4px 0', padding: '2px 0 2px 10px', borderLeft: '3px solid var(--border-strong)', color: 'var(--dim)' }}>{renglones.map((c, i) => <p key={i} style={{ margin: '2px 0', lineHeight: 1.55 }}>{renderInline(c, `bq-${blocks.length}-${i}`, enlaces, iconos)}</p>)}</blockquote>);
      cita = [];
    }
  };
  let codigo: string[] | null = null;
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    // Un bloque de código (``` … ```): tal cual, sin interpretar nada adentro.
    if (/^(```|~~~)/.test(t)) {
      if (codigo) {
        const cuerpo = codigo.join('\n');
        blocks.push(<pre key={`pre-${idx}`} style={{ ...CODIGO_EN_LINEA, margin: '6px 0', padding: '8px 10px', borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre', lineHeight: 1.45 }}>{cuerpo}</pre>);
        codigo = null;
      } else { flush(); codigo = []; }
      return;
    }
    if (codigo) { codigo.push(raw); return; }
    const num = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (num) {
      if (bullets.length || tabla.length || cita.length) flush();
      if (!numeradas.length) desde = Number(num[1]);
      numeradas.push(num[2]);
      return;
    }
    if (/^[-*•]\s+/.test(t)) {
      if (numeradas.length || tabla.length || cita.length) flush();
      bullets.push(t.replace(/^[-*•]\s+/, ''));
      return;
    }
    if (ES_FILA_TABLA.test(t)) {
      if (bullets.length || numeradas.length || cita.length) flush();
      if (!ES_SEPARADOR_TABLA.test(t)) tabla.push(celdas(t));
      return;
    }
    if (/^>\s?/.test(t)) {
      if (bullets.length || numeradas.length || tabla.length) flush();
      cita.push(t.replace(/^>\s?/, ''));
      return;
    }
    flush();
    if (t === '') return;
    if (/^---+$/.test(t)) { blocks.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); return; }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lvl = h[1].length; blocks.push(<div key={idx} style={{ fontWeight: 600, fontSize: lvl === 1 ? 16 : lvl === 2 ? 15 : 14, color: 'var(--ink)', margin: aire ? '12px 0 4px' : '6px 0 2px' }}>{renderInline(h[2], `h-${idx}`, enlaces, iconos)}</div>); return; }
    blocks.push(<p key={idx} style={{ margin: aire ? '0 0 10px' : compacto ? '2px 0' : '3px 0', lineHeight: aire ? 1.6 : 1.55 }}>{renderInline(t, `p-${idx}`, enlaces, iconos)}</p>);
  });
  // Un bloque de código sin cerrar se dibuja igual (lo que llegó hasta ahí).
  if (codigo) blocks.push(<pre key="pre-fin" style={{ ...CODIGO_EN_LINEA, margin: '6px 0', padding: '8px 10px', borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre', lineHeight: 1.45 }}>{(codigo as string[]).join('\n')}</pre>);
  flush();
  return <>{blocks}</>;
}
