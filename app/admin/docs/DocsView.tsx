// =============================================================================
// DocsView — elegir un documento, buscar en los 20, leer el que toca
// =============================================================================
// SIN 'use client'. Todo el estado vive en la URL (?d= y ?q=), así que la
// pantalla no necesita React del lado del navegador: la lista son <a> y el
// buscador es un <form method="get">. Cero JavaScript propio, y el documento
// que viaja es UNO.
//
// La lista va AGRUPADA y con las tabs del producto abajo del nombre. Sin eso son
// veinte títulos parecidos y hay que abrirlos para saber cuál servía. Y el
// número de la derecha lleva `title`: era un número pelado que no se entendía.

import { Pagina, PageHeader, Badge, NoResults, Eyebrow, MONO } from '@/app/_ui';
import { MarkdownDoc, sumario } from '@/app/_components/MarkdownDoc';
import { ORDEN_GRUPOS, type FichaDoc } from './catalogo';
import type { MetaGit } from './git-meta';

export type Doc = {
  slug: string; rel: string; titulo: string; texto: string; lineas: number;
  ficha: FichaDoc | null; meta: MetaGit | null;
};
type Item = { slug: string; titulo: string; lineas: number; hits: number; grupo: string; tabs: string[] };

const href = (slug: string, q: string) => `/admin/docs?d=${encodeURIComponent(slug)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

export function DocsView({ lista, activo, q, total }: { lista: Item[]; activo: Doc; q: string; total: number }) {
  const toc = sumario(activo.texto);
  const hits = lista.reduce((n, x) => n + x.hits, 0);

  // Con búsqueda activa el orden es por relevancia, así que no se agrupa.
  const grupos = q
    ? [{ nombre: '', items: lista }]
    : ORDEN_GRUPOS.map((g) => ({ nombre: g, items: lista.filter((x) => x.grupo === g) })).filter((g) => g.items.length);

  return (
    <Pagina densidad="compacta">
      <PageHeader
        titulo="Documentación"
        proposito="Lo que hay que saber antes de tocar el código."
        estado={<span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-dim)' }}>{total} documentos</span>}
        filtros={
          <form method="get" style={{ display: 'flex', gap: 8, minWidth: 300 }}>
            <input className="mk-input" type="search" name="q" defaultValue={q}
              placeholder={`Buscar en los ${total} documentos…`} aria-label="Buscar en la documentación" />
          </form>
        }
      />

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        {/* --- columna de documentos --- */}
        <nav style={{ flex: '0 0 262px', position: 'sticky', top: 12, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
          {q ? <div style={{ marginBottom: 10 }}><Eyebrow>{hits} coincidencias en {lista.length}</Eyebrow></div> : null}

          {lista.length === 0 ? (
            <NoResults inline query={q} detalle={<a href="/admin/docs" style={{ color: 'var(--accent)' }}>Ver todos</a>} />
          ) : grupos.map((g) => (
            <div key={g.nombre} style={{ marginBottom: 16 }}>
              {g.nombre ? <div style={{ padding: '0 0 6px 10px' }}><Eyebrow>{g.nombre}</Eyebrow></div> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.items.map((d) => {
                  const sel = d.slug === activo.slug;
                  return (
                    <a key={d.slug} href={href(d.slug, q)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '7px 10px', borderRadius: 7, textDecoration: 'none',
                        border: '1px solid transparent',
                        background: sel ? 'var(--surface-2)' : 'transparent',
                        borderColor: sel ? 'var(--border)' : 'transparent',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', fontSize: 13, lineHeight: 1.35,
                          color: sel ? 'var(--ink)' : 'var(--text)', fontWeight: sel ? 600 : 400,
                        }}>{d.titulo}</span>
                        {d.tabs.length ? (
                          <span style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>
                            {d.tabs.join(' · ')}
                          </span>
                        ) : null}
                      </span>
                      {d.hits > 0
                        ? <Badge tono="info">{d.hits}</Badge>
                        : <span title={`${d.lineas} líneas`}
                            style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--text-dim)', cursor: 'help', paddingTop: 2 }}>
                            {d.lineas}L
                          </span>}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* --- el documento --- */}
        <article style={{ flex: 1, minWidth: 0 }}>
          <Ficha doc={activo} />

          {toc.length > 2 ? (
            <details style={{ margin: '0 0 22px', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)' }}>
                En este documento ({toc.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0 4px' }}>
                {toc.map((h) => (
                  <a key={h.id} href={`#${h.id}`}
                    style={{ fontSize: 13, color: 'var(--accent)', marginLeft: (h.nivel - 1) * 14, textDecoration: 'none' }}>
                    {h.texto}
                  </a>
                ))}
              </div>
            </details>
          ) : null}

          <MarkdownDoc texto={activo.texto} hrefDoc={(slug) => href(slug, q)} />
        </article>
      </div>
    </Pagina>
  );
}

/** Qué cubre este documento y de qué tanda de trabajo salió. */
function Ficha({ doc }: { doc: Doc }) {
  const { ficha, meta } = doc;
  return (
    <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px' }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--text-dim)' }}>{doc.rel}</span>
        {meta ? (
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}
            title={`Último commit que tocó este archivo · autor ${meta.autor}`}>
            {meta.fecha} · {meta.hora}
          </span>
        ) : null}
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}
          title="Largo del documento, en líneas">{doc.lineas} líneas</span>
      </div>

      {ficha?.hace.length ? (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          {ficha.hace.join(' · ')}
        </div>
      ) : null}

      {ficha?.tabs.length ? (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ficha.tabs.map((t) => (
            <span key={t} style={{
              fontFamily: MONO, fontSize: 11, color: 'var(--dim)',
              border: '1px solid var(--border)', borderRadius: 999, padding: '2px 9px',
            }}>{t}</span>
          ))}
        </div>
      ) : null}

      {meta ? (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
          Último cambio: «{meta.asunto}»
          {meta.cuenta ? <> · cuenta <strong style={{ color: 'var(--dim)' }}>{meta.cuenta}</strong></> : null}
        </div>
      ) : null}
    </div>
  );
}
