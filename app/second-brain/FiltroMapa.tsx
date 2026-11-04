'use client';

// =============================================================================
// FiltroMapa — el filtro del mapa, con la anatomía del tablero /plan
// =============================================================================
// La versión anterior era UN desplegable con tres columnas de opciones y un solo
// valor elegido a la vez. Se podía mirar «lo que dedujo MaKo» O «la carpeta
// Oferta», nunca las dos cosas — y esa es justamente la pregunta que uno le hace
// a un mapa («de lo que dedujo MaKo, ¿qué hay en Oferta?»).
//
// Lo que se trae del tablero (app/plan/board/BoardShell.tsx:1450-1561), porque ya
// está probado ahí:
//   · DRILL-DOWN, no acordeón. En la raíz se ven las categorías con su resumen;
//     al tocar una, su contenido REEMPLAZA el panel en el mismo lugar, con un
//     «‹ volver». Nunca hay más de una lista larga a la vista.
//   · El disparador dice «Filtrar» siempre, y el número va en un badge colgado
//     de la esquina — con `border: 2px solid var(--bg)`, que es lo que lo despega.
//   · El badge ES el botón de limpiar todo.
//   · Multi-selección con `Set`, y `size === 0` significa «todos». No hay estado
//     «ninguno» que deje la pantalla vacía sin que nadie lo haya pedido.
//   · El panel NO se cierra al elegir. Es lo que hace tolerable marcar tres cosas.
//
// Lo que se trae del CRM (app/crm/CrmToolbar.tsx:431) y el tablero NO tiene: el
// conteo «N de M». Los chips de filtros activos del CRM se probaron y se sacaron —
// eran una segunda manera de borrar un filtro al lado de la primera, y con «Limpiar
// filtros (N)» adentro del panel alcanza. UNA acción, UN lugar.
//
// LAS CATEGORÍAS SE RECORTAN ENTRE SÍ. Si hay carpetas elegidas, la lista de
// secciones muestra SOLO las de esas carpetas, y al revés. Sin eso el menú ofrece
// combinaciones que dan cero —«carpeta Oferta» + «sección Razones» son ramas
// distintas del árbol— y el usuario descubre que eligió algo imposible recién
// cuando el mapa queda vacío.
//
// Y el estado vacío sale de `NoResults` (app/_ui/Estados.tsx), que ya es el
// canónico de la casa — el tablero muestra un «—» por columna que no dice que fue
// el filtro ni ofrece sacarlo, y eso no se replica.
// =============================================================================

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { MONO } from '@/app/_ui/tokens';
import { TAXONOMIA_NEGOCIO, type Taxonomia } from '@/lib/cerebro-modelo';
// El modelo del filtro vive en lib/, no acá: lo comparten el mapa y el exportador, y
// ahí se puede testear. Este archivo es solo su cara.
import {
  areasOfrecidas as areasDe, capaActiva, cuentaFiltros, filtroDeCapa, podarAreas,
  type Autoria, type EstadoFiltro,
} from '@/lib/cerebro-filtro';

export type { Autoria, EstadoFiltro };

const SANS = "'Geist', sans-serif";

export type CategoriaFiltro = 'capa' | 'carpeta' | 'area' | 'autoria';
export type PanelAbierto = 'root' | CategoriaFiltro | null;

const AUTORIA_OPS: Array<{ id: Autoria; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'mako', label: 'Los dedujo MaKo' },
  { id: 'usuario', label: 'Los escribiste tú' },
  { id: 'falta', label: 'Sin completar' },
];

export function FiltroMapa({ filtro, onFiltro, abierto, onAbrir, conteoArea, conteoAutoria, tax = TAXONOMIA_NEGOCIO, soloModulos = false }: {
  filtro: EstadoFiltro;
  onFiltro: (f: EstadoFiltro) => void;
  abierto: PanelAbierto;
  onAbrir: (v: PanelAbierto) => void;
  /** Cuántos datos tiene cada sección. Va al lado de cada opción: un filtro que no
   *  dice cuánto hay detrás obliga a probar de a uno. */
  conteoArea: Partial<Record<string, number>>;
  conteoAutoria: { mako: number; usuario: number; falta: number };
  /** El curso de un gurú (4/11/2026): una sola carpeta (el curso) y nadie del negocio escribió nada, así que sólo se filtra por
   *  módulo. Ofrecer «Carpeta» con una opción y «Quién lo escribió» sobre un curso eran dos filtros que no filtraban nada. */
  soloModulos?: boolean;
  /** Las carpetas y secciones de ESTE grafo (la del negocio, o las dos capas del super admin juntas). */
  tax?: Taxonomia;
}) {
  const caja = useRef<HTMLSpanElement>(null);
  const n = cuentaFiltros(filtro, tax);
  const capas = tax.capas && tax.capas.length > 1 ? tax.capas : null;

  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbrir(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [abierto, onAbrir]);

  const limpiar = () => onFiltro({ carpetas: new Set(), areas: new Set(), autoria: 'todos' });

  const toggleCarpeta = (id: string) => {
    const c = new Set(filtro.carpetas);
    if (c.has(id)) c.delete(id); else c.add(id);
    onFiltro({ ...filtro, carpetas: c, areas: podarAreas(filtro, c, tax) });
  };
  const toggleArea = (id: string) => {
    const c = new Set<string>(filtro.areas);
    if (c.has(id)) c.delete(id); else c.add(id);
    onFiltro({ ...filtro, areas: c as EstadoFiltro['areas'] });
  };

  const areasOfrecidas = areasDe(filtro, tax);
  const carpetasOfrecidas = filtro.areas.size
    ? tax.carpetas.filter((c) => [...filtro.areas].some((a) => tax.areas.find((x) => x.id === a)?.padre === c.id))
    : tax.carpetas;
  const capaElegida = capas ? capaActiva(filtro, tax) : null;

  const resumen = (cat: CategoriaFiltro): string => {
    if (cat === 'capa') {
      if (!filtro.carpetas.size) return 'Todo';
      return capas?.find((c) => c.id === capaElegida)?.nombre ?? 'Varias carpetas';
    }
    if (cat === 'carpeta') {
      if (!filtro.carpetas.size) return 'Todas';
      const nombres = tax.carpetas.filter((c) => filtro.carpetas.has(c.id)).map((c) => c.nombre);
      return nombres[0] + (nombres.length > 1 ? ` +${nombres.length - 1}` : '');
    }
    if (cat === 'area') {
      if (!filtro.areas.size) return 'Todas';
      const nombres = tax.areas.filter((a) => (filtro.areas as ReadonlySet<string>).has(a.id)).map((a) => a.nombre);
      return nombres[0] + (nombres.length > 1 ? ` +${nombres.length - 1}` : '');
    }
    return AUTORIA_OPS.find((o) => o.id === filtro.autoria)!.label;
  };

  const activa = (cat: CategoriaFiltro) =>
    cat === 'capa' ? capaElegida !== null : cat === 'carpeta' ? filtro.carpetas.size > 0 : cat === 'area' ? filtro.areas.size > 0 : filtro.autoria !== 'todos';

  const CATS: Array<{ cat: CategoriaFiltro; label: string }> = soloModulos ? [{ cat: 'area', label: 'Módulo' }] : [
    // Las CAPAS (sólo el super admin): desarrollo, ventas, marketing... son carpetas; la capa las marca de una vez.
    ...(capas ? [{ cat: 'capa' as const, label: 'Capa' }] : []),
    { cat: 'carpeta', label: 'Carpeta' },
    { cat: 'area', label: 'Sección' },
    { cat: 'autoria', label: 'Quién lo escribió' },
  ];

  return (
    <span ref={caja} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        onClick={() => onAbrir(abierto ? null : soloModulos ? 'area' : 'root')}
        aria-expanded={!!abierto}
        aria-label="Filtrar el Second Brain"
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 11px', borderRadius: 9, fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer',
          background: abierto ? 'var(--surface-2)' : 'transparent',
          color: n > 0 ? 'var(--primary)' : 'var(--dim)',
          border: `1px solid ${n > 0 ? 'var(--primary-weak)' : 'var(--border)'}`,
        }}
      >
        <IconoEmbudo color="var(--primary)" />
        Filtrar
        {n > 0 && (
          // El badge CUENTA, no borra. En el tablero además limpia, y acá se sacó a
          // propósito: entre el badge y «Limpiar filtros (N)» adentro del panel había
          // dos maneras de hacer lo mismo, y la de afuera no se anuncia. El borde del
          // color del FONDO es lo que lo despega y lo hace leer como notificación.
          <span
            aria-hidden
            style={{
              position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px',
              borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)',
            }}
          >{n}</span>
        )}
      </button>

      {abierto && (
        <>
          {/* Scrim invisible: cierra al tocar afuera sin oscurecer nada. */}
          <span onClick={() => onAbrir(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            role="dialog"
            aria-label="Filtros del Second Brain"
            style={{
              position: 'absolute', top: 38, left: 0, zIndex: 41, width: 262,
              maxWidth: 'calc(100vw - 32px)', maxHeight: 'min(460px, calc(100dvh - 96px))', overflowY: 'auto', overscrollBehavior: 'contain',
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 12, padding: 8, fontFamily: SANS,
            }}
          >
            {abierto === 'root' ? (
              <>
                {CATS.map(({ cat, label }) => (
                  <FilaCategoria key={cat} label={label} resumen={resumen(cat)} activa={activa(cat)} onClick={() => onAbrir(cat)} />
                ))}
                {n > 0 && (
                  <button type="button" onClick={limpiar} style={{ ...filaBase, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--primary)', fontWeight: 600 }}>
                    Limpiar filtros ({n})
                  </button>
                )}
              </>
            ) : (
              <>
                {!soloModulos && <button type="button" onClick={() => onAbrir('root')} style={volverBtn}>‹ volver</button>}

                {/* El aviso de que la lista está recortada. Sin él, entrar a «Carpeta»
                    con una sección elegida y ver dos opciones donde había cinco se lee
                    como que faltan opciones, no como que las otras no aplican. */}
                {abierto === 'carpeta' && carpetasOfrecidas.length < tax.carpetas.length && (
                  <p style={avisoRecorte}>Solo las carpetas de las secciones que elegiste.</p>
                )}
                {abierto === 'area' && areasOfrecidas.length < tax.areas.length && (
                  <p style={avisoRecorte}>Solo las secciones de las carpetas que elegiste.</p>
                )}

                {abierto === 'capa' && capas && (
                  <>
                    <Radio on={!filtro.carpetas.size} onClick={() => onFiltro(filtroDeCapa(filtro, tax, null))} label="Todo" />
                    {capas.map((c) => (
                      <Radio key={c.id} on={capaElegida === c.id} onClick={() => onFiltro(filtroDeCapa(filtro, tax, c.id))} label={c.nombre} />
                    ))}
                  </>
                )}

                {abierto === 'carpeta' && (capas
                  ? capas.map((capa) => {
                    const suyas = carpetasOfrecidas.filter((c) => capa.carpetas.includes(c.id));
                    return suyas.length === 0 ? null : (
                      <div key={capa.id}>
                        <p style={avisoRecorte}>{capa.nombre}</p>
                        {suyas.map((c) => <Casilla key={c.id} on={filtro.carpetas.has(c.id)} onClick={() => toggleCarpeta(c.id)} label={c.nombre} />)}
                      </div>
                    );
                  })
                  : carpetasOfrecidas.map((c) => (
                    <Casilla key={c.id} on={filtro.carpetas.has(c.id)} onClick={() => toggleCarpeta(c.id)} label={c.nombre} />
                  )))}

                {abierto === 'area' && areasOfrecidas.map((a) => (
                  <Casilla
                    key={a.id}
                    on={(filtro.areas as ReadonlySet<string>).has(a.id)}
                    onClick={() => toggleArea(a.id)}
                    label={a.nombre}
                    punto={a.color}
                    // Nunca un 0 pelado: se lee como «un dato que vale cero». Lo que
                    // no tiene nada lo dice con palabras.
                    cola={conteoArea[a.id] ? String(conteoArea[a.id]) : 'falta'}
                    colaTono={conteoArea[a.id] ? 'var(--faint)' : 'var(--warn)'}
                  />
                ))}

                {soloModulos && n > 0 && (
                  <button type="button" onClick={limpiar} style={{ ...filaBase, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--primary)', fontWeight: 600 }}>
                    Ver todos los módulos
                  </button>
                )}

                {abierto === 'autoria' && AUTORIA_OPS.filter((o) => o.id !== 'falta' || conteoAutoria.falta > 0 || filtro.autoria === 'falta').map((o) => (
                  <Radio
                    key={o.id}
                    on={filtro.autoria === o.id}
                    onClick={() => onFiltro({ ...filtro, autoria: o.id })}
                    label={o.label}
                    cola={o.id === 'todos' ? undefined : String(conteoAutoria[o.id as 'mako' | 'usuario' | 'falta'])}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </span>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function FilaCategoria({ label, resumen, activa, onClick }: { label: string; resumen: string; activa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      style={{ ...filaBase, justifyContent: 'space-between', padding: '10px 9px' }}
    >
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: activa ? 'var(--primary)' : 'var(--faint)', fontWeight: activa ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{resumen}</span>
        <span style={{ color: 'var(--faint)', fontSize: 13 }}>›</span>
      </span>
    </button>
  );
}

function Casilla({ on, onClick, label, punto, cola, colaTono }: { on: boolean; onClick: () => void; label: string; punto?: string; cola?: string; colaTono?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ ...filaBase, background: on ? 'var(--primary-bg)' : 'transparent', fontWeight: on ? 650 : 500 }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, flex: 'none', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
      {punto && <span style={{ width: 8, height: 8, borderRadius: '50%', background: punto, flex: 'none' }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {cola && <span style={{ fontFamily: MONO, fontSize: 10.5, color: colaTono ?? 'var(--faint)', flex: 'none' }}>{cola}</span>}
    </button>
  );
}

function Radio({ on, onClick, label, cola }: { on: boolean; onClick: () => void; label: string; cola?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ ...filaBase, background: on ? 'var(--primary-bg)' : 'transparent', fontWeight: on ? 650 : 500 }}>
      {/* El anillo interno del color de la SUPERFICIE hace el hueco del punto sin un
          div extra. Es el mismo truco del tablero, y por eso tiene que ser
          --surface y no blanco: acá la superficie es oscura. */}
      <span style={{ width: 13, height: 13, borderRadius: '50%', flex: 'none', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', boxShadow: on ? 'inset 0 0 0 2px var(--surface)' : 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {cola && <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>{cola}</span>}
    </button>
  );
}

function IconoEmbudo({ color = 'currentColor' }: { color?: string }): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

const filaBase: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px',
  borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer',
  fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS,
};

const avisoRecorte: CSSProperties = {
  margin: '2px 9px 6px', fontSize: 11, lineHeight: 1.4, color: 'var(--faint)',
};

const volverBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 6px 10px',
  border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer',
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--dim)', fontWeight: 700, marginBottom: 4,
};
