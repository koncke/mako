'use client';
// =============================================================================
// DialogoFunnel — las páginas de la landing como el recorrido de un lead (13/11/2026)
// =============================================================================
// Pedido de Martín (vía Cerebro): «la vista de funnel, como en GoHighLevel: las páginas del negocio encadenadas en el orden en
// que las recorre un lead, viendo de qué página va a cuál, con botones para crear la siguiente y conectarlas». La propuesta
// aprobada (sin textos que expliquen: la vista se entiende sola): side-session-notes/…/funnel/propuesta-vista-funnel.jpg.
//
// Cada tarjeta es una página (en el orden del panel de páginas, que se reordena arrastrando); entre una y la siguiente, lo que
// las conecta («al enviar el formulario», «botón «Quiero agendar»»), o en rojo «sin salida: conéctala» (un clic la conecta). Tocar
// una flecha cambia a dónde lleva. «+ Siguiente paso» crea la página con su objetivo y conecta la última a ella. La lógica es pura
// (lib/editor-landing/funnel.ts, con test); `VistaFunnel` sólo dibuja (con props: se renderiza sola para las capturas), y
// `DialogoFunnel` la monta en una capa y aplica los cambios:
//   · la página ABIERTA vive en el editor (setPaginas conserva su doc vivo): un cambio en ella va por `setContent`;
//   · las demás, en la lista que se le da al armazón (`setPaginas`, que autoguarda).
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { TOPES, tarjetasDe, tituloDeTarjeta, type DocPagina, type Pagina } from '@/lib/editor-landing/doc';
import {
  conectar, paginaDePaso, recorridoDe, OBJETIVO_PASO, OBJETIVOS_PASO, type Conexion, type ObjetivoPaso, type PasoDelFunnel,
} from '@/lib/editor-landing/funnel';
import { useEditorLanding } from './contexto';
import { CSS_FUNNEL, s } from './funnel-estilos';

const COLOR: Record<ObjetivoPaso, string> = { formulario: '#0e9f6e', vsl: '#7c3aed', agenda: '#d97706', venta: '#dc2626', gracias: '#0891b2' };

/** Lo que dice la flecha: qué lleva de una página a la siguiente. */
function rotulo(c: Conexion): string {
  if (c.por === 'formulario') return 'al enviar el formulario';
  return `${c.por === 'boton' ? 'botón' : 'enlace'} «${c.texto || 'sin texto'}»`;
}

export type PropsVistaFunnel = {
  paginas: readonly Pagina[];
  paginaActual: string | null;
  pasos: readonly PasoDelFunnel[];
  docDe: (p: Pagina) => DocPagina;
  /** La flecha con su menú abierto (el índice de la página de la que sale), o null. */
  menu: number | null;
  setMenu: (i: number | null) => void;
  onCerrar: () => void;
  onEditar: (id: string) => void;
  onConectar: (i: number, hacia: string) => void;
  onAgregar: (objetivo: ObjetivoPaso) => void;
};

/** Lo que se ve: la barra, las tarjetas de los pasos con sus flechas y «+ Siguiente paso». Sin estado propio. */
export function VistaFunnel({ paginas, paginaActual, pasos, docDe, menu, setMenu, onCerrar, onEditar, onConectar, onAgregar }: PropsVistaFunnel) {
  return (
    <>
      <style>{CSS_FUNNEL}</style>
      <div className={s.barra}>
        <button type="button" className="gma-izq-volver" aria-label="Volver al editor" onClick={onCerrar}>←</button>
        <b>Funnel</b>
        <span className={s.tenue}>{paginas.length === 1 ? '1 página' : `${paginas.length} páginas`}</span>
      </div>
      <div className={s.lienzo} onPointerDown={(e) => { if (menu !== null && !(e.target as HTMLElement).closest(`.${s.menu}`)) setMenu(null); }}>
        <h1 className={s.titulo}>El recorrido de un lead</h1>
        <div className={s.fila}>
          {pasos.map((paso, i) => {
            const p = paso.pagina;
            const obj = paso.objetivo;
            const portada = tituloDeTarjeta(tarjetasDe({ ...p, doc: docDe(p) })[0] ?? { type: 'tarjeta' }) || p.titulo;
            const ultimo = i === pasos.length - 1;
            return (
              <div key={p.id} className={s.tramo}>
                <div className={s.paso} data-activa={p.id === paginaActual ? 'si' : undefined}>
                  <div className={s.mini} style={{ borderTopColor: obj ? COLOR[obj] : '#c4cad4' }}>
                    <span className={s.num}>{i + 1}</span>
                    <span className={s.portada}>{portada}</span>
                  </div>
                  <div className={s.cuerpo}>
                    <h3>{p.titulo || 'Sin título'}</h3>
                    <div className={s.ruta}>{p.ruta ? `/${p.ruta}` : '/ (inicio)'}</div>
                    {obj ? <span className={s.chip} style={{ background: COLOR[obj] }}>{OBJETIVO_PASO[obj].accion}</span> : null}
                    {paso.otras.length ? (
                      <div className={s.otras}>También lleva a: {paso.otras.map((c) => paginas.find((x) => x.id === c.hacia)?.titulo || 'otra página').join(', ')}</div>
                    ) : null}
                    {ultimo && paso.sinSalida ? <div className={s.alerta}>Sin salida</div> : null}
                    <button type="button" className={s.abrir} onClick={() => onEditar(p.id)}>Editar</button>
                  </div>
                </div>
                {!ultimo ? (
                  <div className={`${s.flecha} ${paso.siguiente ? '' : s.rota}`}>
                    <button
                      type="button"
                      className={s.rotulo}
                      onClick={() => (paso.siguiente ? setMenu(menu === i ? null : i) : onConectar(i, pasos[i + 1].pagina.id))}
                      title={paso.siguiente ? 'Cambiar a dónde lleva' : `Conectar con «${pasos[i + 1].pagina.titulo}»`}
                    >
                      {paso.siguiente ? rotulo(paso.siguiente) : <>sin salida: <b>conéctala</b></>}
                    </button>
                    <span className={s.linea} />
                    {menu === i ? (
                      <div className={s.menu} role="menu">
                        <p>¿A dónde lleva {paso.siguiente ? rotulo(paso.siguiente) : 'esta página'}?</p>
                        {paginas.map((x, k) => (x.id === p.id ? null : (
                          <button key={x.id} type="button" role="menuitem" data-sel={paso.siguiente?.hacia === x.id ? 'si' : undefined} onClick={() => onConectar(i, x.id)}>
                            {k + 1} · {x.titulo || 'Sin título'}
                          </button>
                        )))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className={s.tramo}>
            <div className={`${s.flecha} ${s.suave}`}><span className={s.linea} /></div>
            <div className={s.nuevo}>
              <b>+ Siguiente paso</b>
              {OBJETIVOS_PASO.map((o) => (
                <button key={o} type="button" disabled={paginas.length >= TOPES.paginas} onClick={() => onAgregar(o)}>
                  <span className={s.punto} style={{ background: COLOR[o] }} />{OBJETIVO_PASO[o].nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DialogoFunnel({ onCerrar }: { onCerrar: () => void }) {
  const { paginas, paginaActual, irAPagina, setPaginas, editor, avisar } = useEditorLanding();
  const { z, visible, esElDeArriba } = useCapaModal(true, { anidada: true });
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const [menu, setMenu] = useState<number | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (menu !== null) setMenu(null); else onCerrarRef.current();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [esElDeArriba, menu]);

  /** El documento de una página: el vivo del editor si es la abierta. */
  const docDe = (p: Pagina): DocPagina => (p.id === paginaActual && editor && !editor.isDestroyed ? (editor.getJSON() as DocPagina) : p.doc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pasos = useMemo(() => recorridoDe(paginas, docDe), [paginas, paginaActual, editor]);

  /** Aplica el documento nuevo de una página: la abierta, en el editor; la lista, al armazón. */
  const aplicar = (lista: Pagina[], id: string, doc: DocPagina): Pagina[] => {
    if (id === paginaActual && editor && !editor.isDestroyed) editor.commands.setContent(doc, { emitUpdate: true });
    return lista.map((p) => (p.id === id ? { ...p, doc } : p));
  };

  /** Que la página `i` lleve a `hacia` (la flecha de `i` hacia la siguiente, cambiada o nueva). */
  const conectarPaso = (i: number, hacia: string) => {
    const desde = paginas[i];
    if (!desde || desde.id === hacia) return;
    const r = conectar(docDe(desde), hacia, pasos[i]?.siguiente?.hacia ?? null);
    setPaginas(aplicar(paginas, desde.id, r.doc));
    setMenu(null);
    const destino = paginas.find((p) => p.id === hacia);
    avisar(`«${desde.titulo || 'Página'}» lleva a «${destino?.titulo || 'Página'}»`);
  };

  const agregarPaso = (objetivo: ObjetivoPaso) => {
    if (paginas.length >= TOPES.paginas) { avisar('Máximo de páginas'); return; }
    const nueva = paginaDePaso(objetivo, paginas);
    const ultima = paginas[paginas.length - 1];
    let lista = [...paginas, nueva];
    if (ultima) lista = aplicar(lista, ultima.id, conectar(docDe(ultima), nueva.id).doc);
    setPaginas(lista);
    avisar(`${OBJETIVO_PASO[objetivo].nombre}: agregada y conectada`);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`gma ${s.capa}`} style={{ zIndex: z + 1, display: visible ? undefined : 'none' }} role="dialog" aria-modal="true" aria-label="Funnel">
      <VistaFunnel
        paginas={paginas}
        paginaActual={paginaActual}
        pasos={pasos}
        docDe={docDe}
        menu={menu}
        setMenu={setMenu}
        onCerrar={onCerrar}
        onEditar={(id) => { irAPagina(id); onCerrar(); }}
        onConectar={conectarPaso}
        onAgregar={agregarPaso}
      />
    </div>,
    document.body,
  );
}
