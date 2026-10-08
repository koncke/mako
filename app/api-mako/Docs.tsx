'use client';

// =============================================================================
// /api-mako › Documentación — la de docs.github.com/en/rest, con los endpoints de MaKo
// =============================================================================
// Barra lateral a la izquierda (título, artículos en grupos, y las áreas plegables con sus
// recursos), y a la derecha la página: la portada, un artículo, la portada de un área (sus
// recursos) o la página de un recurso con todos sus endpoints apilados.
//
// La página que se ve vive en la URL (`?tab=docs&area=crm&recurso=leads#crear_lead`): el
// link que se copia es lo que se está viendo, y `documentation_url` de cada error apunta
// directo al endpoint. Los links son <a> de verdad (app/_ui/Link, que preserva el `?ws=`):
// se abren en otra pestaña como en GitHub.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import type { AreaDocs, PaginaDocs } from './datos';
import { Articulo, BotonesDescarga, type DatosArticulos } from './Articulos';
import { ARTICULOS, GRUPOS_ARTICULOS, type SlugArticulo } from './articulos-meta';
import { Endpoint, Migas } from './Endpoint';
import { Icono } from './piezas';

const DOCS = '/api-mako?tab=docs';
const hrefArea = (area: string) => `${DOCS}&area=${area}`;
const hrefRecurso = (area: string, recurso: string) => `${DOCS}&area=${area}&recurso=${recurso}`;
const hrefArt = (slug: string) => `${DOCS}&art=${slug}`;

export function Docs({ datos, pagina, area, recurso, art }: {
  datos: DatosArticulos;
  pagina: PaginaDocs | null;
  area: string | null;
  recurso: string | null;
  art: SlugArticulo | null;
}) {
  const { indice } = datos;
  const areaDocs = area ? indice.find((a) => a.area === area) ?? null : null;

  // Con un #ancla en la URL, el navegador no scrollea si el contenido llegó después: se
  // hace a mano al cambiar de página.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) { window.scrollTo({ top: 0 }); return; }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView();
  }, [area, recurso, art]);

  let contenido: React.ReactNode;
  if (art) {
    contenido = <><Migas items={[{ label: 'API REST', href: DOCS }, { label: ARTICULOS[art].corto }]} /><Articulo slug={art} d={datos} /></>;
  } else if (pagina) {
    contenido = <PaginaRecurso pagina={pagina} version={datos.version} />;
  } else if (areaDocs && !recurso) {
    contenido = <PortadaArea a={areaDocs} />;
  } else if (area || recurso) {
    contenido = (
      <div className="gh-blankslate">
        <h3>Esta página no existe</h3>
        <p>O no está disponible para tu workspace.</p>
        <Link href={DOCS}>Volver a la documentación</Link>
      </div>
    );
  } else {
    contenido = <Portada indice={indice} />;
  }

  return (
    <div className="gh-docs">
      <Barra indice={indice} area={area} recurso={recurso} art={art} />
      <main className="gh-docs-main">{contenido}</main>
    </div>
  );
}

function Barra({ indice, area, recurso, art }: { indice: AreaDocs[]; area: string | null; recurso: string | null; art: SlugArticulo | null }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set([
    ...(area ? [`area:${area}`] : []),
    ...GRUPOS_ARTICULOS.filter((g) => art && g.articulos.includes(art)).map((g) => `grupo:${g.titulo}`),
  ]));
  useEffect(() => {
    // Al navegar, se abre lo que se está viendo (sin cerrar lo que la persona abrió).
    setAbiertas((s) => {
      const n = new Set(s);
      if (area) n.add(`area:${area}`);
      for (const g of GRUPOS_ARTICULOS) if (art && g.articulos.includes(art)) n.add(`grupo:${g.titulo}`);
      return n;
    });
  }, [area, art]);
  const alternar = (k: string) => setAbiertas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // En el teléfono, como docs.github.com: la barra se pliega detrás de un botón y se cierra
  // al elegir una página.
  const [movil, setMovil] = useState(false);
  useEffect(() => { setMovil(false); }, [area, recurso, art]);

  return (
    <nav className="gh-docs-sidebar" aria-label="Documentación de la API" data-movil={movil ? 'abierto' : 'cerrado'}>
      <div className="gh-docs-sidebar-cabecera" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ margin: 0 }}><Link href={DOCS} style={{ color: 'inherit' }}>API REST</Link></h2>
        <button type="button" className="gh-btn gh-btn--sm gh-docs-menu" aria-expanded={movil} onClick={() => setMovil((x) => !x)}>
          {movil ? 'Cerrar' : 'Menú'}<Icono n="chevronDown" />
        </button>
      </div>
      <ul className="gh-docs-nav">
        <li><Link className="gh-docs-nav-item" href={hrefArt('inicio-rapido')} aria-current={art === 'inicio-rapido' ? 'page' : undefined}>{ARTICULOS['inicio-rapido'].corto}</Link></li>
        {GRUPOS_ARTICULOS.map((g) => {
          const k = `grupo:${g.titulo}`;
          const abierto = abiertas.has(k);
          return (
            <li key={k}>
              <button type="button" className="gh-docs-nav-item" aria-expanded={abierto} onClick={() => alternar(k)}>
                {g.titulo}<span className="gh-docs-chevron" data-abierto={abierto}><Icono n="chevronDown" /></span>
              </button>
              {abierto && (
                <ul className="gh-docs-nav-sub">
                  {g.articulos.map((s) => (
                    <li key={s}><Link className="gh-docs-nav-item" href={hrefArt(s)} aria-current={art === s ? 'page' : undefined}>{ARTICULOS[s].corto}</Link></li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <hr className="gh-docs-separador" />
      <ul className="gh-docs-nav" style={{ paddingTop: 0 }}>
        {indice.map((a) => {
          const k = `area:${a.area}`;
          const abierto = abiertas.has(k);
          return (
            <li key={a.area}>
              <button type="button" className="gh-docs-nav-item" aria-expanded={abierto} onClick={() => alternar(k)}
                aria-current={area === a.area && !recurso ? 'page' : undefined}>
                {a.titulo}<span className="gh-docs-chevron" data-abierto={abierto}><Icono n="chevronDown" /></span>
              </button>
              {abierto && (
                <ul className="gh-docs-nav-sub">
                  {a.recursos.map((r) => (
                    <li key={r.slug}>
                      <Link className="gh-docs-nav-item" href={hrefRecurso(a.area, r.slug)} aria-current={area === a.area && recurso === r.slug ? 'page' : undefined}>{r.titulo}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SelectorVersion({ version }: { version: string }) {
  return (
    <label className="gh-version">
      <span>Versión de la API:</span>
      <select className="gh-form-control" style={{ width: 'auto', height: 28, fontSize: 13 }} value={version} onChange={() => undefined} aria-label="Versión de la API">
        <option value={version}>{version} (la más reciente)</option>
      </select>
    </label>
  );
}

function Portada({ indice }: { indice: AreaDocs[] }) {
  const total = useMemo(() => indice.reduce((n, a) => n + a.recursos.reduce((m, r) => m + r.endpoints.length, 0), 0), [indice]);
  return (
    <div className="gh-articulo" style={{ maxWidth: 1080 }}>
      <h1>Documentación de la API REST de MaKo</h1>
      <p className="gh-lead">Crea integraciones, lee los datos de tu negocio y automatiza tu trabajo con la API REST de MaKo.</p>
      <BotonesDescarga />

      <h2 id="empieza">Empieza aquí</h2>
      <div className="gh-tarjetas">
        {(['inicio-rapido', 'autenticacion', 'permisos', 'limites', 'migrar-curso'] as SlugArticulo[]).map((s) => (
          <Link key={s} className="gh-tarjeta" href={hrefArt(s)}>
            <h3>{ARTICULOS[s].corto}</h3>
            <p>{ARTICULOS[s].lead}</p>
          </Link>
        ))}
      </div>

      <h2 id="todo">Toda la documentación de la API REST</h2>
      <p style={{ color: 'var(--gh-fg-muted)' }}>{total} endpoints en {indice.length} áreas.</p>
      <div className="gh-tarjetas" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {indice.map((a) => (
          <div key={a.area} className="gh-tarjeta" style={{ cursor: 'default' }}>
            <h3><Link href={hrefArea(a.area)}>{a.titulo}</Link></h3>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {a.recursos.slice(0, 6).map((r) => <li key={r.slug} style={{ padding: '2px 0' }}><Link href={hrefRecurso(a.area, r.slug)}>{r.titulo}</Link></li>)}
              {a.recursos.length > 6 && <li style={{ padding: '2px 0' }}><Link href={hrefArea(a.area)}>Ver los {a.recursos.length}</Link></li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortadaArea({ a }: { a: AreaDocs }) {
  return (
    <div className="gh-articulo">
      <Migas items={[{ label: 'API REST', href: DOCS }, { label: a.titulo }]} />
      <h1>Endpoints de la API REST para «{a.titulo}»</h1>
      <p className="gh-lead">Usa la API REST para trabajar con la tab {a.tab} de MaKo.</p>
      {a.recursos.map((r) => (
        <div key={r.slug} style={{ padding: '16px 0', borderTop: '1px solid var(--gh-border-muted)' }}>
          <h3 style={{ margin: '0 0 8px' }}><Link href={hrefRecurso(a.area, r.slug)}>{r.titulo}</Link></h3>
          <ul style={{ margin: 0, paddingLeft: '1.5em', color: 'var(--gh-fg-muted)' }}>
            {r.endpoints.map((e) => <li key={e.id}><Link href={`${hrefRecurso(a.area, r.slug)}#${e.id}`} style={{ color: 'var(--gh-fg-muted)' }}>{e.titulo}</Link></li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PaginaRecurso({ pagina, version }: { pagina: PaginaDocs; version: string }) {
  return (
    <div>
      <div className="gh-cabecera-doc">
        <Migas items={[{ label: 'API REST', href: DOCS }, { label: pagina.areaTitulo, href: hrefArea(pagina.area) }, { label: pagina.titulo }]} />
        <SelectorVersion version={version} />
      </div>
      <h1>Endpoints de la API REST para «{pagina.titulo}»</h1>
      <p className="gh-lead">Usa la API REST para trabajar con «{pagina.titulo}» en «{pagina.areaTitulo}».</p>
      <div>
        {pagina.endpoints.map((e) => <Endpoint key={e.id} e={e} />)}
      </div>
    </div>
  );
}
