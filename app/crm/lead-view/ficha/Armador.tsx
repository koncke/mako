'use client';

// =============================================================================
// Armador — UNA tab de la ficha del lead, dibujada como una grilla de bloques
// =============================================================================
// La grilla es la del Dashboard (12 columnas, `COLS_FICHA`), sin alto fijo: el alto lo da el contenido
// (§5 del diseño). Qué se dibuja y con qué ancho lo decide ./armar.ts, puro y con test: lo vacío para este
// lead no deja hueco, y una fila que no se llena se estira.
//
// EDITANDO (sólo el admin, desde «Personalizar»), como una tarjeta del Dashboard en edición: cada bloque con
// su marco y su rótulo; un clic lo elige y le pone su barra (arrastrar, ancho, diseño, ícono, quitar); se
// arrastra para reordenar; y lo de adentro no se toca (`inert`): personalizar no es editar el lead.
//
// ⚠️ EL ARRASTRE (AGENTS.md, «En HTML5 drag-and-drop, el navegador saca la FOTO al terminar tu handler»):
//    la marca del que se arrastra va en un `setTimeout(0)`, no adentro del `dragstart`, y a su caja no se le
//    toca el tamaño. El `dragover` sólo cambia el estado cuando cambia el destino (no 60 veces por segundo), y
//    el auto-scroll va AHÍ: durante un arrastre nativo el navegador congela los timers y el rAF.
// =============================================================================

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { bloqueDef, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';
import type { BloquePuesto, CambioFicha } from '@/lib/ficha/config';
import { tituloDeBloque } from '@/lib/ficha/registro';
// La MISMA lista que ofrece la API de MaKo (cambiar_ficha_funnel, cambio icono): una sola fuente.
import { ICONOS_BLOQUE } from '@/lib/ficha/api';
import { anchosDeLaBarra, bloquesDeLaGrilla, disenoADibujar, disenosOfrecidos, lugarAlSoltar, ocurrencia, type BloqueEnGrilla } from './armar';
import { entradaDe } from './registro';
import { Flotante } from './Flotante';
import type { CtxFicha } from './tipos';

type Soltar = { indice: number; lado: 'antes' | 'despues' };

export function Armador({ tab, lista, ctx, editando, sel, onSel, onCambio, onAgregar }: {
  tab: TabFicha;
  /** La lista ENTERA de la tab (la ficha efectiva del funnel), con lo que no se dibuja. */
  lista: readonly BloquePuesto[];
  ctx: CtxFicha;
  editando: boolean;
  /** El bloque elegido (su índice en `lista`), o null. */
  sel: number | null;
  onSel: (indice: number | null) => void;
  onCambio: (c: CambioFicha) => void;
  /** Abre «Agregar bloque» anclado al botón que lo pidió. */
  onAgregar?: (ancla: HTMLElement) => void;
}) {
  const bloques = bloquesDeLaGrilla(lista, {
    reglasDe: (id) => entradaDe(id),
    vacio: (p, r) => !!r.estaVacio?.(ctx, p),
    editando,
    verPrivado: ctx.verPrivado,
  });
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const desdeRef = useRef<number | null>(null);
  const [soltar, setSoltar] = useState<Soltar | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  // El auto-scroll del arrastre, en el `dragover` del documento y en captura (AGENTS.md): el del bloque no
  // cubre los huecos de la grilla ni lo que está fuera de la tab.
  useEffect(() => {
    if (arrastrando == null) return;
    const sobre = (e: globalThis.DragEvent) => {
      const s = scrollRef.current;
      const caja = s && s !== document.scrollingElement ? s.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const borde = 70;
      if (e.clientY < caja.top + borde) (s ?? window).scrollBy(0, -18);
      else if (e.clientY > caja.bottom - borde) (s ?? window).scrollBy(0, 18);
    };
    document.addEventListener('dragover', sobre, true);
    return () => document.removeEventListener('dragover', sobre, true);
  }, [arrastrando]);

  if (!bloques.length && !editando) return <p className="fb-nada">Sin datos para mostrar.</p>;

  const terminar = () => { desdeRef.current = null; setArrastrando(null); setSoltar(null); };
  const mover = (desde: number, antesDe: number) => {
    const lugar = lugarAlSoltar(desde, antesDe);
    const b = lista[desde];
    if (lugar == null || !b) return;
    onCambio({ op: 'mover', tab, bloque: b.id, n: ocurrencia(lista, desde), lugar });
  };

  const celda = (b: BloqueEnGrilla, i: number) => {
    const entrada = entradaDe(b.def.id)!;
    const { Componente } = entrada;
    const titulo = tituloDeBloque(b.def, ctx.stages);
    const icono: NombreIconoMenu = b.puesto.icono ?? b.def.icono;
    const elegido = editando && sel === b.indice;
    const enFila = b.span < 12;
    const clases = ['fb-bloque',
      editando && 'fb-bloque--editando', elegido && 'fb-bloque--sel', arrastrando === b.indice && 'fb-bloque--arrastrado',
      soltar?.indice === b.indice && `fb-bloque--${soltar.lado}`, soltar?.indice === b.indice && (enFila ? 'fb-bloque--fila' : 'fb-bloque--columna'),
    ].filter(Boolean).join(' ');
    const incluidos = (b.reglas.incluye ?? []).map((id) => bloqueDef(id)?.titulo).filter(Boolean);

    const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
      if (!editando) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `${b.def.id}:${b.n}`);
      const r = e.currentTarget.getBoundingClientRect();
      e.dataTransfer.setDragImage(e.currentTarget, Math.min(e.clientX - r.left, r.width), Math.min(e.clientY - r.top, 40));
      desdeRef.current = b.indice;
      scrollRef.current = padreQueScrollea(e.currentTarget);
      // La foto ya está tomada cuando corre esto: recién ahí se marca el bloque que se mueve.
      window.setTimeout(() => setArrastrando(b.indice), 0);
    };
    const alPasar = (e: DragEvent<HTMLDivElement>) => {
      if (desdeRef.current == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const lado: Soltar['lado'] = enFila ? (e.clientX < r.left + r.width / 2 ? 'antes' : 'despues') : (e.clientY < r.top + r.height / 2 ? 'antes' : 'despues');
      setSoltar((s) => (s && s.indice === b.indice && s.lado === lado ? s : { indice: b.indice, lado }));
    };
    const alSoltar = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const desde = desdeRef.current;
      const s = soltar;
      terminar();
      if (desde == null || !s) return;
      mover(desde, s.lado === 'antes' ? s.indice : s.indice + 1);
    };
    // El teclado en el tirador: una flecha lo pasa por encima del bloque dibujado de al lado.
    const conTeclado = (dir: -1 | 1) => {
      const vecino = bloques[i + dir];
      if (!vecino) return;
      mover(b.indice, dir < 0 ? vecino.indice : vecino.indice + 1);
    };

    return (
      <div key={`${b.def.id}:${b.n}`} className={clases} style={{ gridColumn: `span ${b.span}` }}
        draggable={editando || undefined}
        onDragStart={editando ? alArrastrar : undefined}
        onDragOver={editando ? alPasar : undefined}
        onDrop={editando ? alSoltar : undefined}
        onDragEnd={editando ? terminar : undefined}
        onClick={editando ? (e) => { e.stopPropagation(); onSel(b.indice); } : undefined}>
        {editando && <div className="fb-marco" aria-hidden />}
        {editando && (
          <span className="fb-rotulo" title={incluidos.length ? `Incluye: ${incluidos.join(', ')}` : undefined}>
            <IconoMenu nombre={icono} size={13} /> {titulo}
          </span>
        )}
        {elegido && (
          <BarraBloque tab={tab} b={b} icono={icono} onCambio={onCambio} onQuitar={() => onSel(null)}
            onMoverTeclado={conTeclado} />
        )}
        {/* ⚠️ `inert` EDITANDO: personalizar la ficha no es editar el lead. Sin esto, un clic para elegir el
            bloque abría el campo de adentro (la tarjeta entera abre su edición, `CajaCampo`). */}
        <div className="fb-cuerpo" inert={editando || undefined}>
          {b.vacio
            ? <div className="fb-vacio">Sin datos en este lead</div>
            : <Componente ctx={ctx} puesto={b.puesto} def={b.def} tab={tab} titulo={titulo} diseno={disenoADibujar(b.puesto, b.def, b.reglas)} ancho={b.puesto.ancho} icono={icono} editando={editando} />}
        </div>
      </div>
    );
  };

  return (
    <div className="fb-grilla" onClick={editando ? () => onSel(null) : undefined}
      onDragOver={editando ? (e) => { if (desdeRef.current != null) e.preventDefault(); } : undefined}>
      {bloques.map(celda)}
      {editando && onAgregar && (
        <button type="button" className="fb-agregar-celda" onClick={(e) => { e.stopPropagation(); onAgregar(e.currentTarget); }}>
          <IconoMenu nombre="agregar" size={16} /> Agregar bloque
        </button>
      )}
    </div>
  );
}

/** El ancestro que scrollea (el cuerpo del pop-up), o el documento (la ruta). */
function padreQueScrollea(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

type Menu = { tipo: 'diseno' | 'icono'; ancla: HTMLElement } | null;

/** La barra del bloque elegido: arrastrar, ancho, diseño, ícono y quitar. */
function BarraBloque({ tab, b, icono, onCambio, onQuitar, onMoverTeclado }: {
  tab: TabFicha;
  b: BloqueEnGrilla;
  icono: NombreIconoMenu;
  onCambio: (c: CambioFicha) => void;
  onQuitar: () => void;
  onMoverTeclado: (dir: -1 | 1) => void;
}) {
  const [menu, setMenu] = useState<Menu>(null);
  const disenos = disenosOfrecidos(b.def, b.reglas);
  const diseno = disenoADibujar(b.puesto, b.def, b.reglas);
  const id: BloqueId = b.def.id;
  const quitable = b.def.quitable || b.def.tab !== tab;
  const abrir = (tipo: 'diseno' | 'icono') => (e: { currentTarget: HTMLElement }) => {
    const ancla = e.currentTarget;
    setMenu((m) => (m?.tipo === tipo ? null : { tipo, ancla }));
  };
  const sep: ReactNode = <span className="fb-sep" aria-hidden />;
  return (
    <div className="fb-barra-bloque" role="toolbar" aria-label={`Bloque ${b.def.titulo}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="fb-herr fb-herr--mover" title="Arrastra para mover" aria-label="Mover (flechas)"
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onMoverTeclado(-1); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onMoverTeclado(1); }
        }}>
        <IconoMenu nombre="mover" size={15} />
      </button>
      {sep}
      {anchosDeLaBarra(b.def).map((a) => (
        <button key={a.id} type="button" className="fb-herr" aria-pressed={b.puesto.ancho === a.id} disabled={!a.puede}
          title={a.puede ? `Ancho ${a.nombre.toLowerCase()}` : 'Este bloque no va de ese ancho'}
          onClick={() => { if (b.puesto.ancho !== a.id) onCambio({ op: 'ancho', tab, bloque: id, n: b.n, ancho: a.id }); }}>
          {a.id === 12 ? 'Todo' : a.nombre}
        </button>
      ))}
      {disenos.length > 0 && (
        <>
          {sep}
          <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'diseno'} onClick={abrir('diseno')}>
            Diseño <span aria-hidden>▾</span>
          </button>
        </>
      )}
      {sep}
      <button type="button" className="fb-herr" title="Ícono" aria-label="Ícono" aria-haspopup="menu" aria-expanded={menu?.tipo === 'icono'} onClick={abrir('icono')}>
        <IconoMenu nombre={icono} size={15} />
      </button>
      {sep}
      <BotonBorrar talla="sm" title={quitable ? `Quitar ${b.def.titulo}` : `${b.def.titulo} no se puede quitar`} disabled={!quitable}
        onClick={() => { onQuitar(); onCambio({ op: 'quitar', tab, bloque: id, n: b.n }); }} />

      {menu?.tipo === 'diseno' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={240} etiqueta="Diseño del bloque">
          <div role="menu">
            {disenos.map((d) => (
              <button key={d.id} type="button" role="menuitemradio" aria-checked={d.id === diseno} className="fb-opcion"
                onClick={() => { setMenu(null); if (d.id !== diseno) onCambio({ op: 'diseno', tab, bloque: id, n: b.n, diseno: d.id }); }}>
                {d.nombre}
              </button>
            ))}
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'icono' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300} etiqueta="Ícono del bloque">
          <button type="button" className="fb-opcion" aria-checked={!b.puesto.icono} role="menuitemradio"
            onClick={() => { setMenu(null); if (b.puesto.icono) onCambio({ op: 'icono', tab, bloque: id, n: b.n, icono: null }); }}>
            <IconoMenu nombre={b.def.icono} size={16} /> El de siempre
          </button>
          <div className="fb-iconos" role="menu">
            {ICONOS_BLOQUE.map((n) => (
              <button key={n} type="button" role="menuitemradio" aria-checked={n === icono} className="fb-herr" title={n} aria-label={n}
                onClick={() => { setMenu(null); if (n !== icono) onCambio({ op: 'icono', tab, bloque: id, n: b.n, icono: n === b.def.icono ? null : n }); }}>
                <IconoMenu nombre={n} size={16} />
              </button>
            ))}
          </div>
        </Flotante>
      )}
    </div>
  );
}
