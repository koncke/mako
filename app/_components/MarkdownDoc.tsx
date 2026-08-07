// =============================================================================
// MarkdownDoc — el renderer de DOCUMENTOS largos (docs/*.md, AGENTS.md)
// =============================================================================
// NO lleva 'use client' a propósito: no tiene estado ni handlers, así que
// renderiza en el servidor y no pesa un byte en el bundle del navegador. Por
// eso los links a otros documentos son <a href> y no botones con onClick — un
// handler lo volvería cliente y arrastraría el parser entero al browser.
// =============================================================================
// POR QUÉ NO ES app/_components/Markdown.tsx. Aquél es un subconjunto
// DELIBERADO —negrita, bullets, títulos h1-h3, separador— calibrado para texto
// corto dentro de una tarjeta: el chat, el detalle de una tarea, el resumen de
// una retro. Ampliarlo le cambiaría el render a esas cuatro pantallas, que ya
// están en producción y tienen sus márgenes ajustados a mano.
//
// Y no alcanzaba ni de casualidad. Medido sobre lo que hay que mostrar de
// verdad (AGENTS.md + docs/*.md, ~5.000 líneas): 515 filas de tabla, 3.334
// spans de `código` inline, 337 títulos ####, 30 bloques ```, 56 links y 49
// líneas de cita. El parser corto no entiende ninguna de esas construcciones y
// —esto es lo peligroso— no falla: manda al <p> todo lo que no reconoce. En
// pantalla eso son los pipes de las tablas y los numerales crudos a la vista.
//
// De hecho su regex de título es /^(#{1,3})\s+/, que contra «#### Foo» no
// matchea (los tres # se comen tres y \s+ choca con el cuarto). Justamente
// «####» es el nivel MÁS usado de los documentos.
//
// DOS DECISIONES QUE NO SE TOCAN:
//
// 1. Devuelve nodos de React, nunca dangerouslySetInnerHTML. No es prolijidad:
//    los documentos hablan DE código y están llenos de <button>, <select> y
//    ${}. Por la vía del string HTML eso se renderiza como un botón de verdad
//    —ya pasó en este repo, está contado en app/plan/board/RichText.tsx— y
//    encima la CSP global no tiene script-src, así que no habría red abajo.
//    Con nodos de React el escapado lo hace React y el problema no existe.
//
// 2. Las tablas van envueltas en `.mk-scroll-x` (la clase ya vive en ui.css y
//    está disponible sin importar nada). Sin eso, corridas-multiagente.md
//    —271 de sus 299 líneas son tabla— empuja el ancho de toda la página.
// =============================================================================

import { Fragment, type ReactNode } from 'react';
import { MONO } from '@/app/_ui';

// ---------------------------------------------------------------- inline ----

// La negrita se cierra en el PRIMER `**` que aparezca, no en «lo que no tenga
// asteriscos»: los documentos citan símbolos con comodín —`fathom*`, `deal*`,
// `mako_ws<id>`— adentro de una negrita, y con [^*]+ esa negrita no cerraba
// nunca y salían los asteriscos crudos a la pantalla.
const RE_INLINE = /(`[^`]+`|\*\*.+?\*\*|\[[^\]]+\]\([^)]+\))/g;
const RE_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Un link a otro documento del repo, no a la web. */
function esInterno(href: string) {
  return !/^(https?:)?\/\//.test(href) && /\.md(#.*)?$/i.test(href);
}

/**
 * `código`, **negrita** y [texto](url). Nada más: cursiva y tachado no
 * aparecen en estos documentos y cada construcción de más es un regex que
 * puede morder al texto que habla de código.
 */
function inline(text: string, k: string, hrefDoc?: (slug: string) => string): ReactNode[] {
  return text.split(RE_INLINE).filter((p) => p !== '').map((p, i) => {
    const key = `${k}-${i}`;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return <code key={key} style={codeInline}>{p.slice(1, -1)}</code>;
    }
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      // Se recurre adentro: una negrita puede contener `código` y un link, y
      // sin esto salen los backticks crudos a la pantalla. No hay recursión
      // infinita porque el contenido de una negrita ya no tiene `**` (el
      // patrón es [^*]+).
      return <strong key={key}>{inline(p.slice(2, -2), key, hrefDoc)}</strong>;
    }
    const l = p.match(RE_LINK);
    if (l) {
      const [, texto, href] = l;
      if (esInterno(href)) {
        // El slug es el nombre del archivo sin carpeta ni extensión, así
        // «../AGENTS.md», «docs/hallazgos-crm.md» y «hallazgos-crm.md» caen
        // todos en el mismo documento.
        const slug = href.replace(/#.*$/, '').replace(/^.*\//, '').replace(/\.md$/i, '');
        if (!hrefDoc) return <span key={key}>{texto}</span>;
        return <a key={key} href={hrefDoc(slug)} style={linkInterno}>{texto}</a>;
      }
      return <a key={key} href={href} target="_blank" rel="noreferrer" style={linkExterno}>{texto}</a>;
    }
    return <Fragment key={key}>{p}</Fragment>;
  });
}

// ----------------------------------------------------------------- bloque ---

const RE_ITEM = /^(\s*)([-*•]|\d+\.)\s+(.*)$/;

/** ¿Esta línea corta el párrafo que se venía juntando? */
function abreBloque(l: string) {
  const t = l.trim();
  return t === ''
    || t.startsWith('```')
    || t.startsWith('|')
    || t.startsWith('>')
    || /^-{3,}$/.test(t)
    || /^#{1,6}\s/.test(t)
    || RE_ITEM.test(l);
}

type Props = {
  texto: string;
  /** Adónde apunta un link a otro documento. Sin esto, queda como texto. */
  hrefDoc?: (slug: string) => string;
};

export function MarkdownDoc({ texto, hrefDoc: onDoc }: Props) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];

  let i = 0;
  const key = () => `b-${out.length}`;

  while (i < lineas.length) {
    const linea = lineas[i];
    const t = linea.trim();

    // --- bloque de código: se toma CRUDO, sin pasarle el inline por encima.
    // AGENTS.md trae un ```sh con el hook de pre-push lleno de $, ! y comillas.
    if (t.startsWith('```')) {
      const lang = t.slice(3).trim();
      const cuerpo: string[] = [];
      i++;
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) cuerpo.push(lineas[i++]);
      i++; // la línea de cierre
      out.push(
        <pre key={key()} className="mk-scroll-x" style={pre}>
          {lang ? <span style={preLang}>{lang}</span> : null}
          <code style={{ fontFamily: MONO }}>{cuerpo.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // --- tabla GFM: header + separador |---|---| + filas.
    if (t.startsWith('|') && (lineas[i + 1] ?? '').trim().match(/^\|[\s:|-]+\|$/)) {
      const celdas = (fila: string) => fila.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = celdas(linea);
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) filas.push(celdas(lineas[i++]));
      out.push(
        <div key={key()} className="mk-scroll-x" style={{ margin: '14px 0' }}>
          <table style={tabla}>
            <thead>
              <tr>{head.map((c, n) => <th key={n} style={th}>{inline(c, `th-${n}`, onDoc)}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((f, n) => (
                <tr key={n}>{f.map((c, m) => <td key={m} style={td}>{inline(c, `td-${n}-${m}`, onDoc)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // --- cita
    if (t.startsWith('>')) {
      const cuerpo: string[] = [];
      while (i < lineas.length && lineas[i].trim().startsWith('>')) {
        cuerpo.push(lineas[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(<blockquote key={key()} style={cita}>{inline(cuerpo.join(' '), 'q', onDoc)}</blockquote>);
      continue;
    }

    // --- lista (con o sin numerar, con un nivel de anidado)
    const esItem = (s: string) => RE_ITEM.exec(s);
    if (esItem(linea)) {
      const items: { nivel: number; texto: string; num: boolean }[] = [];
      let ordenada = false;
      while (i < lineas.length) {
        const m = esItem(lineas[i]);
        if (!m) {
          // Una línea suelta indentada continúa el item anterior… salvo que
          // abra un bloque. Los .md traen bloques de código INDENTADOS dentro
          // de un item (hallazgos-infra.md tiene un ```bash con tres espacios
          // adelante) y sin esta guarda la lista se los tragaba como texto:
          // en pantalla salían los backticks y el comando desarmado.
          const sig = lineas[i];
          if (items.length && sig.trim() !== '' && /^\s{2,}/.test(sig) && !abreBloque(sig.trim())) {
            items[items.length - 1].texto += ' ' + sig.trim();
            i++;
            continue;
          }
          break;
        }
        const num = /\d/.test(m[2]);
        if (items.length === 0) ordenada = num;
        items.push({ nivel: m[1].length >= 2 ? 1 : 0, texto: m[3], num });
        i++;
      }
      const Lista = ordenada ? 'ol' : 'ul';
      out.push(
        <Lista key={key()} style={lista}>
          {items.map((it, n) => (
            <li key={n} style={{ ...itemLista, marginLeft: it.nivel * 18 }}>{inline(it.texto, `li-${n}`, onDoc)}</li>
          ))}
        </Lista>,
      );
      continue;
    }

    if (t === '') { i++; continue; }

    if (/^-{3,}$/.test(t)) {
      i++;
      out.push(<hr key={key()} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />);
      continue;
    }

    // --- título: #{1,6}, no #{1,3}. El nivel más usado de estos docs es ####.
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      i++;
      const lvl = h[1].length;
      out.push(
        <div key={key()} id={ancla(h[2])} style={titulo(lvl)}>
          {inline(h[2], `h-${out.length}`, onDoc)}
        </div>,
      );
      continue;
    }

    // --- párrafo. Las líneas consecutivas se JUNTAN antes de pasarles el
    // formateo inline. Los .md de este repo vienen con el renglón cortado a
    // ~90 caracteres, así que una negrita arranca en una línea y cierra en la
    // siguiente («**No es\ndescuido**», AGENTS.md). Procesando línea por línea
    // ese ** no cierra nunca y los asteriscos salen crudos a la pantalla —
    // pasó, y son 5 casos solo en AGENTS.md.
    const parr: string[] = [];
    while (i < lineas.length && !abreBloque(lineas[i])) parr.push(lineas[i++].trim());
    out.push(<p key={key()} style={parrafo}>{inline(parr.join(' '), `p-${out.length}`, onDoc)}</p>);
  }

  return <>{out}</>;
}

/** El id de un título, para poder enlazarlo desde el sumario. */
export function ancla(texto: string) {
  return 'h-' + texto.toLowerCase()
    .replace(/[`*[\]()]/g, '')
    .replace(/[^a-z0-9áéíóúñü]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** El sumario de un documento: sus títulos de nivel 1 y 2. */
export function sumario(texto: string) {
  return texto.split('\n')
    .map((l) => l.trim().match(/^(#{1,2})\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ nivel: m[1].length, texto: m[2].replace(/[`*]/g, ''), id: ancla(m[2]) }));
}

// ------------------------------------------------------------------ estilo --
// No hay NADA global para code, pre, table, th ni td: no existe un solo
// selector de esos elementos en globals.css ni en ui.css. Sin esto las celdas
// salen pegadas y los <pre> sin fondo.

const codeInline: React.CSSProperties = {
  fontFamily: MONO, fontSize: '.88em', background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px',
};

const linkInterno: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, font: 'inherit',
  color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer',
};

const linkExterno: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'underline' };

const pre: React.CSSProperties = {
  position: 'relative', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '14px 16px', margin: '14px 0', fontSize: 13,
  lineHeight: 1.55, whiteSpace: 'pre',
};

const preLang: React.CSSProperties = {
  position: 'absolute', top: 6, right: 10, fontSize: 10, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'var(--text-dim)', fontFamily: MONO,
};

const tabla: React.CSSProperties = { borderCollapse: 'collapse', fontSize: 13.5, minWidth: '100%' };

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border-strong)',
  fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--ink)',
};

const td: React.CSSProperties = {
  padding: '8px 12px', borderBottom: '1px solid var(--border)',
  verticalAlign: 'top', lineHeight: 1.5,
};

const cita: React.CSSProperties = {
  margin: '14px 0', padding: '2px 0 2px 16px', borderLeft: '3px solid var(--border-strong)',
  color: 'var(--text-dim)', lineHeight: 1.6,
};

const lista: React.CSSProperties = { margin: '10px 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 5 };

const itemLista: React.CSSProperties = { lineHeight: 1.6, maxWidth: '78ch' };

const parrafo: React.CSSProperties = { margin: '10px 0', lineHeight: 1.65, maxWidth: '78ch' };

/**
 * El tope de lectura va en el PÁRRAFO, no en la página: un maxWidth arriba
 * también angosta las tablas y los bloques de código (app/_ui/LEEME.md).
 */
function titulo(lvl: number): React.CSSProperties {
  const size = [26, 20, 16.5, 15, 14, 13][lvl - 1] ?? 14;
  return {
    fontSize: size,
    fontWeight: lvl <= 2 ? 650 : 600,
    color: 'var(--ink)',
    margin: lvl === 1 ? '4px 0 14px' : lvl === 2 ? '34px 0 10px' : '22px 0 6px',
    paddingBottom: lvl <= 2 ? 6 : 0,
    borderBottom: lvl <= 2 ? '1px solid var(--border)' : 'none',
    scrollMarginTop: 20,
  };
}
