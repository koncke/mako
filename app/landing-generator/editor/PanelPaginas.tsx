'use client';

// =============================================================================
// PanelPaginas — las páginas del sitio (Gamma Sites es multipágina)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Es el panel de
// gamma-ui.md §5.12.6: la cabeza «Páginas» con su «+», y cada página con ícono, título y ruta
// (la de inicio con la casa); la activa en azul claro; el ⋯ de cada una con «Cambiar nombre»,
// «Ruta de la URL», «Convertir en página de inicio», «Duplicar» y «Eliminar». Se arrastran para
// reordenar. «Añadir página» agrega una en blanco (la versión «con IA» de Gamma no está: la
// generación de una página suelta no tiene ruta en el server).
//
// Este panel NO guarda nada: arma la lista nueva y se la da al armazón (`setPaginas`), que la
// aplica y la autoguarda. El documento de la página ABIERTA vive en el editor, no en `paginas`
// (que lo trae del último guardado): por eso duplicar la página abierta lee el editor, y el
// armazón pisa esa página con lo vivo al aplicar.
//
// Las reglas de la ruta (doc.ts): '' = la página de inicio, y hay EXACTAMENTE una; las demás,
// un segmento como el slug (`rutaValida`: minúsculas, números y guiones, 3 a 60) y sin repetir.
// Dejar la ruta vacía es «Convertir en página de inicio», como en Gamma («vacía = página
// principal»).
// =============================================================================

import { useRef, useState, type KeyboardEvent as KeyboardEventReact } from 'react';
import {
  TOPES, docPagina, nuevoId, rutaValida, slugDe, tarjetaVacia, type DocPagina, type JsonNodo, type Pagina,
} from '@/lib/editor-landing/doc';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from './contexto';
import { DialogoGma, Ico, ItemMenu, Menu, SepMenu } from './MenuDocumento';
import { useReordenar } from './TiraSecciones';

// ─────────────────────────────────────────────────────────────────────────────
// Reglas puras (las fija tests/editor-landing-armazon.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Una ruta libre a partir de un texto: el slug, y si está tomada o es corta, con sufijo. */
export function rutaLibre(texto: string, usadas: readonly string[]): string {
  let base = slugDe(texto).slice(0, 50).replace(/-+$/g, '');
  if (!rutaValida(base)) base = 'pagina';
  const tomadas = new Set(usadas);
  if (!tomadas.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const r = `${base}-${i}`;
    if (!tomadas.has(r)) return r;
  }
  return `${base}-${nuevoId('').slice(0, 6)}`;
}

/** La lista con el ítem de `de` movido a `a`. */
export function moverEnLista<T>(lista: readonly T[], de: number, a: number): T[] {
  const out = [...lista];
  if (de < 0 || de >= out.length || a < 0 || a >= out.length || de === a) return out;
  const [x] = out.splice(de, 1);
  out.splice(a, 0, x);
  return out;
}

/**
 * La página `id` pasa a ser la de inicio (ruta '' y primera de la lista); la que era de inicio
 * recibe una ruta libre derivada de su título. Nunca quedan dos de inicio.
 */
export function hacerInicio(paginas: readonly Pagina[], id: string): Pagina[] {
  const elegida = paginas.find((p) => p.id === id);
  if (!elegida) return [...paginas];
  const usadas = paginas.filter((p) => p.id !== id && p.ruta).map((p) => p.ruta);
  const resto = paginas.filter((p) => p.id !== id).map((p) => {
    if (p.ruta !== '') return p;
    const ruta = rutaLibre(p.titulo || 'pagina', usadas);
    usadas.push(ruta);
    return { ...p, ruta };
  });
  return [{ ...elegida, ruta: '' }, ...resto];
}

/** Por qué una ruta no sirve para la página `id` (texto corto), o null si sirve. */
export function motivoRuta(ruta: string, id: string, paginas: readonly Pagina[]): string | null {
  if (ruta === '') return null;
  if (!rutaValida(ruta)) return 'De 3 a 60: a-z, 0-9 y guiones';
  if (paginas.some((p) => p.id !== id && p.ruta === ruta)) return 'Esa ruta ya existe';
  return null;
}

/** Copia de una página con ids nuevos (de la página y de cada sección) y una ruta libre. */
export function duplicarPagina(p: Pagina, paginas: readonly Pagina[], docVivo?: DocPagina | null): Pagina {
  const doc = JSON.parse(JSON.stringify(docVivo ?? p.doc)) as DocPagina;
  doc.content = (doc.content ?? []).map((t: JsonNodo) => ({ ...t, attrs: { ...(t.attrs ?? {}), id: nuevoId('t') } }));
  const titulo = `${p.titulo || 'Página'} (copia)`.slice(0, TOPES.titulo);
  return { ...p, id: nuevoId('p'), titulo, ruta: rutaLibre(titulo, paginas.map((x) => x.ruta).filter(Boolean)), doc };
}

// ─────────────────────────────────────────────────────────────────────────────
// El panel
// ─────────────────────────────────────────────────────────────────────────────

type Edicion = { id: string; campo: 'titulo' | 'ruta'; valor: string; error: string | null };

export default function PanelPaginas({ onCerrar }: { onCerrar: () => void }) {
  const { paginas, paginaActual, irAPagina, setPaginas, editor, avisar } = useEditorLanding();
  const [menu, setMenu] = useState<{ id: string; ancla: HTMLElement } | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [borrar, setBorrar] = useState<Pagina | null>(null);
  const paginasRef = useRef(paginas);
  paginasRef.current = paginas;

  /** El documento de una página: el vivo del editor si es la abierta. */
  const docDe = (p: Pagina): DocPagina => {
    if (p.id === paginaActual && editor && !editor.isDestroyed) return editor.getJSON() as DocPagina;
    return p.doc;
  };

  const { contRef, arrastre, fueArrastre, handlers } = useReordenar((de, a) => {
    setPaginas(moverEnLista(paginasRef.current, de, a));
  });

  const agregar = () => {
    if (paginas.length >= TOPES.paginas) { avisar('Máximo de páginas'); return; }
    const titulo = 'Página nueva';
    const nueva: Pagina = {
      id: nuevoId('p'),
      titulo,
      ruta: rutaLibre(titulo, paginas.map((p) => p.ruta).filter(Boolean)),
      doc: docPagina([tarjetaVacia()]),
    };
    const i = paginas.findIndex((p) => p.id === paginaActual);
    const lista = [...paginas];
    lista.splice(i < 0 ? lista.length : i + 1, 0, nueva);
    setPaginas(lista);
    irAPagina(nueva.id);
  };

  const duplicar = (p: Pagina) => {
    if (paginas.length >= TOPES.paginas) { avisar('Máximo de páginas'); return; }
    const copia = duplicarPagina(p, paginas, docDe(p));
    const i = paginas.findIndex((x) => x.id === p.id);
    const lista = [...paginas];
    lista.splice(i + 1, 0, copia);
    setPaginas(lista);
    avisar('Página duplicada');
  };

  const convertirEnInicio = (id: string) => {
    setPaginas(hacerInicio(paginas, id));
    avisar('Página de inicio');
  };

  const confirmarBorrar = () => {
    const p = borrar;
    setBorrar(null);
    if (!p || paginas.length <= 1) return;
    const indice = paginas.findIndex((x) => x.id === p.id);
    const guardada: Pagina = { ...p, doc: docDe(p) };
    let lista = paginas.filter((x) => x.id !== p.id);
    // Si se va la de inicio, la nueva primera pasa a serlo (siempre hay exactamente una).
    let promovida: { id: string; rutaPrevia: string } | null = null;
    if (p.ruta === '' && lista.length) {
      promovida = { id: lista[0].id, rutaPrevia: lista[0].ruta };
      lista = [{ ...lista[0], ruta: '' }, ...lista.slice(1)];
    }
    setPaginas(lista);
    // Deshacer devuelve la MISMA página (mismo id, mismas secciones), en su lugar.
    avisar('Página eliminada', () => {
      const actual = paginasRef.current;
      if (actual.some((x) => x.id === guardada.id)) return;
      let restaurada = actual.map((x) => (promovida && x.id === promovida.id && guardada.ruta === '' ? { ...x, ruta: promovida.rutaPrevia } : x));
      if (guardada.ruta !== '' && restaurada.some((x) => x.ruta === guardada.ruta)) {
        guardada.ruta = rutaLibre(guardada.titulo, restaurada.map((x) => x.ruta).filter(Boolean));
      }
      restaurada = [...restaurada];
      restaurada.splice(Math.min(indice, restaurada.length), 0, guardada);
      setPaginas(restaurada);
    });
  };

  const empezarEdicion = (p: Pagina, campo: 'titulo' | 'ruta') => {
    setEdicion({ id: p.id, campo, valor: campo === 'titulo' ? p.titulo : p.ruta, error: null });
  };

  const terminarEdicion = (aplicar: boolean) => {
    const ed = edicion;
    if (!ed) return;
    if (!aplicar) { setEdicion(null); return; }
    if (ed.campo === 'titulo') {
      const titulo = ed.valor.replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo) || 'Sin título';
      setPaginas(paginas.map((p) => (p.id === ed.id ? { ...p, titulo } : p)));
      setEdicion(null);
      return;
    }
    const ruta = ed.valor.trim().toLowerCase();
    if (ruta === '') {
      const p = paginas.find((x) => x.id === ed.id);
      if (p && p.ruta !== '') convertirEnInicio(ed.id);
      setEdicion(null);
      return;
    }
    const motivo = motivoRuta(ruta, ed.id, paginas);
    if (motivo) { setEdicion({ ...ed, error: motivo }); return; }
    const p = paginas.find((x) => x.id === ed.id);
    if (p && p.ruta === '') {
      // La de inicio no puede quedarse sin la ruta vacía sin que otra la tome: se avisa.
      setEdicion({ ...ed, error: 'Elige otra de inicio primero' });
      return;
    }
    setPaginas(paginas.map((x) => (x.id === ed.id ? { ...x, ruta } : x)));
    setEdicion(null);
  };

  const teclasCampo = (e: KeyboardEventReact<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); terminarEdicion(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminarEdicion(false); }
  };

  const paginaMenu = menu ? paginas.find((p) => p.id === menu.id) ?? null : null;

  return (
    <>
      <div className="gma-izq-cabeza">
        <span className="gma-izq-titulo">Páginas</span>
        <button type="button" className="gma-boton gma-boton--chico gma-boton--icono gma-tip" data-tip="Añadir página" aria-label="Añadir página"
          disabled={paginas.length >= TOPES.paginas} onClick={agregar}>
          <Ico n="mas" t={16} />
        </button>
        <button type="button" className="gma-boton gma-boton--chico gma-boton--icono gma-tip" data-tip="Contraer" aria-label="Contraer" onClick={onCerrar}>
          <Ico n="chevron-doble-izquierda" t={16} />
        </button>
      </div>
      <div ref={contRef} className="gma-paginas" {...handlers}>
        {paginas.map((p, i) => {
          const editando = edicion?.id === p.id ? edicion : null;
          const inicio = p.ruta === '';
          return (
            <div
              key={p.id}
              data-indice={i}
              role="button"
              tabIndex={0}
              className="gma-pag"
              data-activa={p.id === paginaActual ? 'si' : undefined}
              data-arrastrando={arrastre?.de === i ? 'si' : undefined}
              aria-label={p.titulo || 'Sin título'}
              onClick={() => { if (!fueArrastre() && !editando) irAPagina(p.id); }}
              onDoubleClick={() => empezarEdicion(p, 'titulo')}
              onKeyDown={(e) => { if (!editando && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); irAPagina(p.id); } }}
            >
              <span className="gma-pag-icono"><Ico n={inicio ? 'casa' : 'archivo'} t={16} /></span>
              <span className="gma-pag-textos">
                {editando ? (
                  <span data-sin-arrastre="">
                    {editando.campo === 'ruta' ? <span className="gma-campo-prefijo">/</span> : null}
                    <input
                      className="gma-campo"
                      autoFocus
                      value={editando.valor}
                      aria-label={editando.campo === 'titulo' ? 'Cambiar nombre' : 'Ruta de la URL'}
                      aria-invalid={editando.error ? true : undefined}
                      placeholder={editando.campo === 'ruta' ? 'vacía = página de inicio' : 'Sin título'}
                      maxLength={editando.campo === 'titulo' ? TOPES.titulo : 60}
                      onChange={(e) => setEdicion({ ...editando, valor: e.target.value, error: null })}
                      onKeyDown={teclasCampo}
                      onBlur={() => terminarEdicion(true)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {editando.error ? <span className="gma-campo-error" role="alert">{editando.error}</span> : null}
                  </span>
                ) : (
                  <>
                    <span className="gma-pag-titulo">{p.titulo || 'Sin título'}</span>
                    <span className="gma-pag-ruta">{inicio ? 'Página de inicio' : `/${p.ruta}`}</span>
                  </>
                )}
              </span>
              {!editando ? (
                <button
                  type="button"
                  data-sin-arrastre=""
                  className="gma-boton gma-boton--chico gma-boton--icono"
                  aria-label="Abrir acciones de la página"
                  aria-expanded={menu?.id === p.id}
                  onClick={(e) => { e.stopPropagation(); setMenu({ id: p.id, ancla: e.currentTarget }); }}
                >
                  <Ico n="puntos" t={16} />
                </button>
              ) : null}
            </div>
          );
        })}
        {arrastre ? <div className="gma-marca-destino" style={{ top: arrastre.marca }} /> : null}
      </div>

      {menu && paginaMenu ? (
        <Menu ancla={menu.ancla} onCerrar={() => setMenu(null)} etiqueta="Acciones de la página" ancho={240}>
          <ItemMenu icono="lapiz" texto="Cambiar nombre" onClick={() => empezarEdicion(paginaMenu, 'titulo')} />
          <ItemMenu icono="enlace" texto="Ruta de la URL" onClick={() => empezarEdicion(paginaMenu, 'ruta')} />
          {paginaMenu.ruta !== '' ? <ItemMenu icono="casa" texto="Convertir en página de inicio" onClick={() => convertirEnInicio(paginaMenu.id)} /> : null}
          <ItemMenu icono="duplicar" texto="Duplicar" disabled={paginas.length >= TOPES.paginas} onClick={() => duplicar(paginaMenu)} />
          <SepMenu />
          <ItemMenu icono={<IconoBorrar size={16} />} texto="Eliminar" peligro disabled={paginas.length <= 1} onClick={() => setBorrar(paginaMenu)} />
        </Menu>
      ) : null}

      {borrar ? (
        <DialogoGma
          titulo={`¿Eliminar «${borrar.titulo || 'Sin título'}»?`}
          onCerrar={() => setBorrar(null)}
          pie={(
            <>
              <button type="button" className="gma-boton gma-boton--contorno" onClick={() => setBorrar(null)}>Cancelar</button>
              <button type="button" className="gma-boton gma-boton--rojo" onClick={confirmarBorrar}>Eliminar</button>
            </>
          )}
        >
          <p className="gma-dialogo-texto">Se elimina con todas sus secciones.</p>
        </DialogoGma>
      ) : null}
    </>
  );
}
