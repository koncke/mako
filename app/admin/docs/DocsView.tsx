// =============================================================================
// DocsView — elegir un documento, buscar en los 20, leer el que toca
// =============================================================================
// SIN 'use client'. Todo el estado vive en la URL (?d= y ?q=), así que la
// pantalla no necesita React del lado del navegador: la lista son <a> y el
// buscador es un <form method="get">. Cero JavaScript propio, y el documento
// que viaja es UNO.
//
// Para elegir documento NO se usan <Tabs>: son 20 y app/_ui/LEEME.md corta en
// seis («si son más de seis, probablemente falte una decisión de arquitectura,
// no una tab más»). Va una lista lateral, que además deja ver el tamaño de
// cada uno de un vistazo.

import { Pagina, PageHeader, Badge, NoResults, Eyebrow, MONO } from '@/app/_ui';
import { MarkdownDoc, sumario } from '@/app/_components/MarkdownDoc';

export type Doc = { slug: string; rel: string; titulo: string; texto: string; lineas: number };
type Item = { slug: string; titulo: string; lineas: number; hits: number };

const href = (slug: string, q: string) => `/admin/docs?d=${encodeURIComponent(slug)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

export function DocsView({ lista, activo, q, total }: { lista: Item[]; activo: Doc; q: string; total: number }) {
  const toc = sumario(activo.texto);
  const hits = lista.reduce((n, x) => n + x.hits, 0);

  return (
    <Pagina densidad="compacta">
      <PageHeader
        titulo="Documentación"
        proposito="Lo que hay que saber antes de tocar el código."
        estado={<span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-dim)' }}>{total} documentos</span>}
        filtros={
          <form method="get" style={{ display: 'flex', gap: 8, minWidth: 300 }}>
            <input
              className="mk-input"
              type="search"
              name="q"
              defaultValue={q}
              placeholder={`Buscar en los ${total} documentos…`}
              aria-label="Buscar en la documentación"
            />
          </form>
        }
      />

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        {/* --- columna de documentos --- */}
        <nav style={{ flex: '0 0 246px', position: 'sticky', top: 12, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
          {q ? (
            <div style={{ marginBottom: 10 }}>
              <Eyebrow>{hits} coincidencias en {lista.length}</Eyebrow>
            </div>
          ) : null}

          {lista.length === 0 ? (
            <NoResults inline query={q} detalle={<a href="/admin/docs" style={{ color: 'var(--accent)' }}>Ver todos</a>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {lista.map((d) => {
                const sel = d.slug === activo.slug;
                return (
                  <a
                    key={d.slug}
                    href={href(d.slug, q)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 7, fontSize: 13, lineHeight: 1.35,
                      border: '1px solid transparent', textDecoration: 'none',
                      background: sel ? 'var(--surface-2)' : 'transparent',
                      borderColor: sel ? 'var(--border)' : 'transparent',
                      color: sel ? 'var(--ink)' : 'var(--text)',
                      fontWeight: sel ? 600 : 400,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{d.titulo}</span>
                    {d.hits > 0
                      ? <Badge tono="info">{d.hits}</Badge>
                      : <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--text-dim)' }}>{d.lineas}</span>}
                  </a>
                );
              })}
            </div>
          )}
        </nav>

        {/* --- el documento --- */}
        <article style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--text-dim)' }}>{activo.rel}</span>
          </div>

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
