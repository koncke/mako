'use client';

// =============================================================================
// Arbol — la barra de páginas de Notion, con las páginas del Copywriter del negocio
// =============================================================================
// Copiado de la barra de Notion (help/writing-and-editing-basics: «Drag-and-drop also works in your sidebar to reorder
// pages, nest pages inside pages»): la columna gris, un renglón de 30 px por página con su triángulo, su ícono y su
// nombre; arriba «Nueva» (los templates, ./Inicio.tsx); al pasar el cursor, «+» (una subpágina en blanco, como
// Notion) y «⋯» (Renombrar · Mover a la Papelera); arrastrar un renglón lo
// reordena (sobre el borde de arriba o de abajo de otro) o lo anida (sobre el medio); «Papelera» al pie, con
// «Restaurar»; y ««» pliega la columna entera. Lo que hace cada gesto con el índice es puro (lib/copywriter/arbol.ts)
// y lo escribe el armazón.
//
// El arrastre es HTML5 y no toca el renglón de origen al empezar (AGENTS.md: «Al nodo ORIGEN de un arrastre no se le
// toca el tamaño», «el navegador saca la FOTO al terminar tu handler»): la marca de «arrastrando» va en un setTimeout.
// =============================================================================

import { useMemo, useRef, useState, type DragEvent as EventoArrastre } from 'react';
import { INFO_TIPO, type PaginaCopy } from '@/lib/copywriter/tipos';
import { dePapelera, descendientes, hijasDe, rutaDe } from '@/lib/copywriter/arbol';
import { useCerrarAfuera } from './editor/cerrar-afuera';

type Soltar = { id: string; donde: 'antes' | 'dentro' | 'despues' } | null;

export type PropsArbol = {
  paginas: readonly PaginaCopy[];
  abierta: string | null;
  plegado: boolean;
  onPlegar: () => void;
  onAbrir: (id: string) => void;
  /** «Nueva»: los templates. */
  onNueva: () => void;
  /** El «+» de una página: una subpágina en blanco adentro de ella. */
  onSubpagina: (padre: string) => void;
  onRenombrar: (id: string, titulo: string) => void;
  onPapelera: (id: string) => void;
  onRestaurar: (id: string) => void;
  onMover: (id: string, padre: string | null, posicion: number) => void;
};

export function Arbol(p: PropsArbol) {
  const { paginas, abierta } = p;
  // Abiertas: las que contienen a la página abierta, más las que la persona abrió.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(abierta ? rutaDe(paginas, abierta).map((x) => x.id) : []));
  const [menu, setMenu] = useState<{ id: string | null; que: 'pagina' } | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [papelera, setPapelera] = useState(false);
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [soltar, setSoltar] = useState<Soltar>(null);
  const refMenu = useRef<HTMLDivElement>(null);
  const refPapelera = useRef<HTMLDivElement>(null);
  useCerrarAfuera(refMenu, !!menu, () => setMenu(null));
  useCerrarAfuera(refPapelera, papelera, () => setPapelera(false));

  const enPapelera = useMemo(() => dePapelera(paginas), [paginas]);

  const alternar = (id: string) => setAbiertas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const zona = (e: EventoArrastre<HTMLElement>): 'antes' | 'dentro' | 'despues' => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    if (y < r.height * 0.28) return 'antes';
    if (y > r.height * 0.72) return 'despues';
    return 'dentro';
  };

  const soltarEn = (destino: PaginaCopy, donde: 'antes' | 'dentro' | 'despues') => {
    const id = arrastrada;
    setArrastrada(null);
    setSoltar(null);
    if (!id || id === destino.id || descendientes(paginas, id).has(destino.id)) return;
    if (donde === 'dentro') {
      p.onMover(id, destino.id, Number.MAX_SAFE_INTEGER);
      setAbiertas((s) => new Set(s).add(destino.id));
      return;
    }
    const hermanas = hijasDe(paginas, destino.padre).filter((x) => x.id !== id);
    const i = hermanas.findIndex((x) => x.id === destino.id);
    p.onMover(id, destino.padre, donde === 'antes' ? i : i + 1);
  };

  const renglon = (pg: PaginaCopy, nivel: number) => {
    const hijas = hijasDe(paginas, pg.id);
    const abiertaFila = abiertas.has(pg.id);
    const marca = soltar?.id === pg.id ? soltar.donde : undefined;
    return (
      <div key={pg.id} role="treeitem" aria-expanded={hijas.length ? abiertaFila : undefined} aria-selected={pg.id === abierta}>
        <div className="nt-fila" style={{ paddingLeft: 4 + nivel * 14, opacity: arrastrada === pg.id ? 0.4 : 1 }}
          data-abierta={pg.id === abierta ? '' : undefined} data-soltar={marca} data-menu={menu?.id === pg.id ? '' : undefined}
          draggable={renombrando !== pg.id}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', pg.titulo); const id = pg.id; setTimeout(() => setArrastrada(id), 0); }}
          onDragEnd={() => { setArrastrada(null); setSoltar(null); }}
          onDragOver={(e) => { if (!arrastrada || arrastrada === pg.id) return; e.preventDefault(); const d = zona(e); if (soltar?.id !== pg.id || soltar.donde !== d) setSoltar({ id: pg.id, donde: d }); }}
          onDragLeave={() => { if (soltar?.id === pg.id) setSoltar(null); }}
          onDrop={(e) => { e.preventDefault(); soltarEn(pg, zona(e)); }}
          onClick={() => { if (renombrando !== pg.id) p.onAbrir(pg.id); }}>
          <button type="button" className="nt-fila-flecha" data-abierta={abiertaFila ? '' : undefined} data-vacia={hijas.length ? undefined : ''}
            onClick={(e) => { e.stopPropagation(); alternar(pg.id); }} aria-label={abiertaFila ? 'Plegar' : 'Desplegar'} tabIndex={hijas.length ? 0 : -1}>▶</button>
          <span className="nt-fila-emoji" aria-hidden>{pg.emoji ?? INFO_TIPO[pg.tipo].emoji}</span>
          {renombrando === pg.id ? (
            <input className="nt-renombrar" autoFocus defaultValue={pg.titulo} aria-label="Nuevo nombre" maxLength={200}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { p.onRenombrar(pg.id, e.currentTarget.value); setRenombrando(null); }
                if (e.key === 'Escape') setRenombrando(null);
              }}
              onBlur={(e) => { p.onRenombrar(pg.id, e.currentTarget.value); setRenombrando(null); }} />
          ) : (
            <span className="nt-fila-nombre">{pg.titulo}</span>
          )}
          <span className="nt-fila-acciones" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="nt-boton-ico" aria-label={`Más opciones de ${pg.titulo}`} aria-expanded={menu?.id === pg.id && menu.que === 'pagina'}
              onClick={() => setMenu(menu?.id === pg.id && menu.que === 'pagina' ? null : { id: pg.id, que: 'pagina' })}>⋯</button>
            <button type="button" className="nt-boton-ico" aria-label={`Añadir una página adentro de ${pg.titulo}`} title="Añadir una página adentro"
              onClick={() => { setMenu(null); setAbiertas((s) => new Set(s).add(pg.id)); p.onSubpagina(pg.id); }}>+</button>
          </span>
          {menu?.id === pg.id && (
            <div ref={refMenu} onClick={(e) => e.stopPropagation()}>
              {(
                  <div className="nt-menu" data-chico="" role="menu" style={{ position: 'absolute', top: 30, right: 0 }}>
                    <button type="button" role="menuitem" className="nt-menu-fila" onClick={() => { setMenu(null); setRenombrando(pg.id); }}>
                      <span className="nt-menu-cuadro" aria-hidden>✎</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Renombrar</span></span>
                    </button>
                    <button type="button" role="menuitem" className="nt-menu-fila" data-peligro="" onClick={() => { setMenu(null); p.onPapelera(pg.id); }}>
                      <span className="nt-menu-cuadro" aria-hidden>✕</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Mover a la Papelera</span></span>
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
        {abiertaFila && hijas.length > 0 && <div role="group">{hijas.map((h) => renglon(h, nivel + 1))}</div>}
        {abiertaFila && hijas.length === 0 && nivel < 6 && (
          <div className="nt-fila" style={{ paddingLeft: 4 + (nivel + 1) * 14 + 24, cursor: 'default' }} aria-hidden>
            <span className="nt-prop-vacio" style={{ fontSize: 13 }}>Sin páginas adentro</span>
          </div>
        )}
      </div>
    );
  };

  const raiz = hijasDe(paginas, null);

  return (
    <nav className="nt-arbol" data-plegado={p.plegado ? '' : undefined} aria-label="Páginas">
      <div className="nt-arbol-cab">
        <span className="nt-arbol-titulo">Copywriter</span>
        <button type="button" className="nt-boton-ico" onClick={p.onPlegar} title="Cerrar la barra" aria-label="Cerrar la barra de páginas">«</button>
      </div>
      <div className="nt-arbol-acciones">
        <button type="button" className="nt-arbol-nuevo" data-principal="" onClick={p.onNueva}>
          <span aria-hidden>＋</span> Nueva
        </button>
      </div>
      <div className="nt-arbol-lista" role="tree" aria-label="Tus páginas"
        onDragOver={(e) => { if (arrastrada) e.preventDefault(); }}
        onDrop={(e) => {
          // Soltado en el espacio vacío de abajo: al final de la raíz.
          if (e.target !== e.currentTarget || !arrastrada) return;
          e.preventDefault();
          const id = arrastrada;
          setArrastrada(null);
          setSoltar(null);
          p.onMover(id, null, Number.MAX_SAFE_INTEGER);
        }}>
        {raiz.map((pg) => renglon(pg, 0))}
        {raiz.length === 0 && <div className="nt-arbol-seccion">Todavía no hay páginas</div>}
      </div>
      <div className="nt-arbol-pie">
        <div style={{ position: 'relative' }} ref={refPapelera}>
          <button type="button" className="nt-arbol-nuevo" onClick={() => setPapelera((v) => !v)} aria-expanded={papelera}>
            <span aria-hidden>✕</span> Papelera{enPapelera.length ? ` (${enPapelera.length})` : ''}
          </button>
          {papelera && (
            <div className="nt-menu" role="dialog" aria-label="Papelera" style={{ position: 'absolute', bottom: 36, left: 4 }}>
              <div className="nt-menu-grupo">Papelera</div>
              {enPapelera.length === 0 && <div className="nt-menu-vacio">No hay nada en la Papelera</div>}
              {enPapelera.map((pg) => (
                <div key={pg.id} className="nt-menu-fila" style={{ cursor: 'default' }}>
                  <span className="nt-menu-cuadro" aria-hidden>{pg.emoji ?? INFO_TIPO[pg.tipo].emoji}</span>
                  <span className="nt-menu-textos"><span className="nt-menu-nombre">{pg.titulo}</span></span>
                  <button type="button" className="nt-miga" onClick={() => p.onRestaurar(pg.id)}>Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
