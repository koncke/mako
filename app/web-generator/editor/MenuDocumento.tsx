'use client';

// =============================================================================
// MenuDocumento — el menú «⋯» del documento (Gamma 5) y las piezas de chrome que comparten
// los menús del editor
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». El menú es el de
// gamma-ui.md §5.3 adaptado a una landing, y SÓLO con ítems que funcionan: Gamma ofrece
// «Crear a partir de esto», «Guardar como plantilla» o «Publicar en el sitio…» con su
// propia infraestructura; acá un ítem que no hace nada se lee como que la app está rota
// (AGENTS.md, «Escribir la salida no es ofrecerla»).
//
// En este archivo viven también las piezas de chrome que usan los demás menús del armazón
// (el ▾ de Publicar, el clic derecho de la tira, el ⋯ de una página, el zoom) y que pueden
// usar los paneles: `Ico`, `Flotante`, `Menu` + `ItemMenu`, `DialogoGma`. Son del CHROME de
// Gamma (clases `gma-`, app/web-generator/gamma.css), no de app/_ui: la regla de copia
// pide sus propios menús, no los de MaKo.
//
// Tres trampas que estas piezas resuelven (y que ya mordieron en EditorRico y en el Plan):
//   · Un panel flotante va PORTALEADO al <body> y REGISTRADO en la pila de modales
//     (`useCapaModal(true, { anidada: true })`): sin eso, lo recorta el overflow del lienzo
//     o lo tapa un diálogo, y su Escape cierra también lo de abajo. Por eso el Escape se
//     escucha en captura y frena con `stopImmediatePropagation` cuando le toca.
//   · Se UBICA midiéndose después de montar: el efecto depende del NODO (un state de ref
//     callback), no de un `montado` — con un portal, la primera corrida de un efecto con
//     una ref estable no encuentra nada y no vuelve a correr (AGENTS.md, «un efecto que mide
//     un nodo montado por un portal…»). Mientras no está ubicado va con opacidad 0, no con
//     visibility (que también apagaría el foco).
//   · Un botón del menú no le roba el foco al texto: `onMouseDown` + `preventDefault`. Con
//     el cursor adentro de una sección, abrir el ⋯ y deshacer tiene que deshacer el texto.
// =============================================================================

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as KeyboardEventReact, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { ICONOS, ICONO_NEUTRO } from '@/lib/editor-landing/iconos';
import { useEditorLanding } from './contexto';
import { pedirDocs } from './subir';

// ─────────────────────────────────────────────────────────────────────────────
// Ícono (Phosphor, lib/editor-landing/iconos.ts: el mismo set que dibuja el contenido)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un ícono del set de la landing como elemento React. Un nombre que no existe dibuja el
 * NEUTRO, nunca un hueco: un ícono que desaparece se lee como un botón roto.
 */
export function Ico({ n, t = 16, className, style }: { n: string; t?: number; className?: string; style?: CSSProperties }) {
  const d = (Object.prototype.hasOwnProperty.call(ICONOS, n) ? ICONOS[n] : ICONOS[ICONO_NEUTRO]).d;
  return (
    <svg viewBox="0 0 256 256" width={t} height={t} fill="currentColor" aria-hidden focusable="false"
      className={className} style={{ flex: 'none', display: 'block', ...style }}>
      <path d={d} />
    </svg>
  );
}

/** ⌘ o Ctrl. Se decide DESPUÉS de montar: en el server no hay `navigator` y la hidratación no puede diferir. */
export function useTeclaMod(): string {
  const [mod, setMod] = useState('Ctrl+');
  useEffect(() => {
    try {
      if (/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)) setMod('⌘');
    } catch { /* sin navigator: queda Ctrl */ }
  }, []);
  return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flotante: un panel portaleado, en la pila, ubicado contra un ancla o un punto
// ─────────────────────────────────────────────────────────────────────────────

export type Ancla = HTMLElement | { x: number; y: number };

type PropsFlotante = {
  /** El botón que lo abrió (se ubica abajo de él) o un punto (el clic derecho). */
  ancla: Ancla | null;
  onCerrar: () => void;
  children: ReactNode;
  /** A qué borde del ancla se alinea. */
  alinear?: 'inicio' | 'fin';
  /** Si abre hacia arriba de entrada (el zoom de la esquina de abajo). */
  arriba?: boolean;
  /** Separación con el ancla, en px. */
  separacion?: number;
  /** Clase del contenedor (p. ej. `gma-menu` o `gma-pop`). */
  className?: string;
  /** Rótulo para lectores de pantalla. */
  etiqueta?: string;
  rol?: string;
  /** No cerrar al hacer clic afuera (un arrastre desde adentro sale del panel). */
  sinCerrarAfuera?: boolean;
  /** El foco entra al panel al abrirse (los menús sí; el de «Agregar bloque» lo pone en su buscador). */
  enfocar?: boolean;
  dataAttrs?: Record<string, string>;
};

export function Flotante({
  ancla, onCerrar, children, alinear = 'inicio', arriba = false, separacion = 6, className, etiqueta, rol,
  sinCerrarAfuera = false, enfocar = true, dataAttrs,
}: PropsFlotante) {
  const { z, visible, esElDeArriba } = useCapaModal(true, { anidada: true });
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  // Ubicarse: abajo del ancla (o arriba si no entra), sin salirse de la ventana.
  useLayoutEffect(() => {
    if (!nodo) return;
    const ubicar = () => {
      const caja = nodo.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x: number;
      let y: number;
      if (ancla && 'getBoundingClientRect' in ancla) {
        const r = ancla.getBoundingClientRect();
        x = alinear === 'fin' ? r.right - caja.width : r.left;
        const abajo = r.bottom + separacion;
        const encima = r.top - separacion - caja.height;
        y = arriba ? (encima >= 8 ? encima : abajo) : (abajo + caja.height <= vh - 8 || encima < 8 ? abajo : encima);
      } else if (ancla) {
        x = ancla.x;
        y = ancla.y;
        if (y + caja.height > vh - 8) y = Math.max(8, ancla.y - caja.height);
      } else {
        x = (vw - caja.width) / 2;
        y = (vh - caja.height) / 3;
      }
      x = Math.min(Math.max(8, x), Math.max(8, vw - caja.width - 8));
      y = Math.min(Math.max(8, y), Math.max(8, vh - caja.height - 8));
      setPos((p) => (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 ? p : { x, y }));
    };
    ubicar();
    const ro = new ResizeObserver(ubicar);
    ro.observe(nodo);
    window.addEventListener('resize', ubicar);
    return () => { ro.disconnect(); window.removeEventListener('resize', ubicar); };
  }, [nodo, ancla, alinear, arriba, separacion]);

  // El foco entra al panel una vez ubicado (con opacidad 0 el foco igual funciona).
  const enfocado = useRef(false);
  useEffect(() => {
    if (!nodo || !pos || enfocado.current || !enfocar) return;
    enfocado.current = true;
    const primero = nodo.querySelector<HTMLElement>('.gma-menu-item:not(:disabled), input, button:not(:disabled)');
    (primero ?? nodo).focus({ preventScroll: true });
  }, [nodo, pos, enfocar]);

  // Escape (en captura, y sólo si es la capa de arriba) y clic afuera.
  useEffect(() => {
    if (!nodo) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onCerrarRef.current();
    };
    const afuera = (e: PointerEvent) => {
      if (sinCerrarAfuera) return;
      const t = e.target as Node | null;
      if (!t || nodo.contains(t)) return;
      if (ancla && 'contains' in ancla && ancla.contains(t)) return;
      // Un clic en otra capa de arriba (un diálogo abierto desde el menú) no es «afuera».
      if (!esElDeArriba()) return;
      onCerrarRef.current();
    };
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('pointerdown', afuera, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('pointerdown', afuera, true);
    };
  }, [nodo, ancla, esElDeArriba, sinCerrarAfuera]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="gma" style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: z + 1 }}>
      <div
        ref={setNodo}
        role={rol}
        aria-label={etiqueta}
        tabIndex={-1}
        className={className}
        {...(dataAttrs ? Object.fromEntries(Object.entries(dataAttrs).map(([k, v]) => [`data-${k}`, v])) : {})}
        style={{
          position: 'fixed',
          left: pos?.x ?? 0,
          top: pos?.y ?? 0,
          opacity: pos ? 1 : 0,
          outline: 'none',
          display: visible ? undefined : 'none',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menú: Flotante con ítems de 28 px, flechas del teclado y cierre al elegir
// ─────────────────────────────────────────────────────────────────────────────

const CerrarMenu = createContext<() => void>(() => {});

export function Menu({ ancla, onCerrar, children, alinear, arriba, etiqueta, ancho }: {
  ancla: Ancla | null;
  onCerrar: () => void;
  children: ReactNode;
  alinear?: 'inicio' | 'fin';
  arriba?: boolean;
  etiqueta?: string;
  ancho?: number;
}) {
  // Las flechas recorren los ítems habilitados (como un menú de Chakra).
  const teclas = (e: KeyboardEventReact<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.gma-menu-item:not(:disabled)'));
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const sig = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
      : e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
    items[sig].focus();
  };
  return (
    <Flotante ancla={ancla} onCerrar={onCerrar} alinear={alinear} arriba={arriba} etiqueta={etiqueta} rol="menu" className="gma-menu">
      <div onKeyDown={teclas} style={ancho ? { width: ancho } : undefined}>
        <CerrarMenu.Provider value={onCerrar}>{children}</CerrarMenu.Provider>
      </div>
    </Flotante>
  );
}

export function ItemMenu({ icono, texto, atajo, onClick, disabled, peligro, mantenerAbierto }: {
  /** Nombre de un ícono del set, o un elemento (el tacho de la casa para borrar). */
  icono?: string | ReactNode;
  texto: string;
  atajo?: string;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
  /** No cerrar el menú al elegir (un interruptor). */
  mantenerAbierto?: boolean;
}) {
  const cerrar = useContext(CerrarMenu);
  return (
    <button
      type="button"
      role="menuitem"
      className="gma-menu-item"
      data-peligro={peligro ? 'si' : undefined}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { if (!mantenerAbierto) cerrar(); onClick(); }}
    >
      <span className="gma-menu-icono">{typeof icono === 'string' ? <Ico n={icono} t={16} /> : icono}</span>
      <span className="gma-menu-texto">{texto}</span>
      {atajo ? <span className="gma-menu-atajo">{atajo}</span> : null}
    </button>
  );
}

export function SepMenu() {
  return <hr className="gma-menu-sep" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diálogo chico del chrome (confirmar, mostrar un texto)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un diálogo del chrome de Gamma: fondo oscuro, caja de radio 16, Escape y clic en el fondo
 * cierran. `onCerrar` puede tener cualquier identidad: se lee por ref (AGENTS.md, «Todo
 * <Modal> recibe un onCerrar de identidad FIJA» — acá no hay efecto de foco que dependa de él).
 */
export function DialogoGma({ titulo, children, pie, onCerrar, etiqueta }: {
  titulo: string;
  children?: ReactNode;
  pie?: ReactNode;
  onCerrar: () => void;
  etiqueta?: string;
}) {
  const { z, visible, esElDeArriba } = useCapaModal(true, { anidada: true });
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const cajaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onCerrarRef.current();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [esElDeArriba]);

  // El foco entra al primer botón del pie (el que confirma va último, como en Gamma).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const caja = cajaRef.current;
      if (!caja) return;
      const botones = caja.querySelectorAll<HTMLElement>('.gma-dialogo-pie button, .gma-dialogo-pie a');
      (botones[botones.length - 1] ?? caja).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="gma" style={{ position: 'fixed', inset: 0, zIndex: z + 1, display: visible ? undefined : 'none' }}>
      <div className="gma-dialogo-fondo" onPointerDown={(e) => { if (e.target === e.currentTarget) onCerrarRef.current(); }}>
        <div ref={cajaRef} className="gma-dialogo" role="dialog" aria-modal="true" aria-label={etiqueta ?? titulo} tabIndex={-1}>
          <h2 className="gma-dialogo-titulo">{titulo}</h2>
          {children}
          {pie ? <div className="gma-dialogo-pie">{pie}</div> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El menú ⋯ del documento
// ─────────────────────────────────────────────────────────────────────────────

/** «11/10/2026», en la zona del navegador. '' si la fecha no se puede leer. */
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return ''; }
}

export type InfoDocumento = {
  /** ISO de cuando se creó la landing. */
  creado: string;
  /** Nombre de quien la creó, o null si la fila no lo tiene. */
  creadoPor: string | null;
};

/**
 * ⚠️ Va SIEMPRE montado y se abre con `abierto`: elegir un ítem cierra el menú, y lo que ese
 * ítem abre (el diálogo de la instrucción de origen) o termina (un pedido al server) tiene que
 * seguir vivo. Montado sólo mientras el menú está abierto, el diálogo no llegaba a dibujarse.
 */
export default function MenuDocumento({ abierto, ancla, onCerrar, info }: {
  abierto: boolean;
  ancla: Ancla | null;
  onCerrar: () => void;
  info: InfoDocumento;
}) {
  const ctx = useEditorLanding();
  const ws = useWs();
  const mod = useTeclaMod();
  const [verOrigen, setVerOrigen] = useState(false);
  const ocupado = useRef(false);

  const pedido = ctx.config.origen?.pedido?.trim() || '';
  const puedeDeshacer = !!ctx.editor && ctx.editor.can().undo();
  const creado = fechaCorta(info.creado);

  /** Una acción que habla con el server: una a la vez, con su aviso corto si falla. */
  const correr = useCallback(async (fn: () => Promise<void>) => {
    if (ocupado.current) return;
    ocupado.current = true;
    try { await fn(); } catch { ctx.avisar('No se pudo completar'); } finally { ocupado.current = false; }
  }, [ctx]);

  // «Añadir a favoritos» se fue con la tanda 2 (T1, 11/10/2026): el Panel ya no tiene la vista de
  // Favoritos, y marcar algo que no se ve en ningún lado es un control que no hace nada.

  // Duplicar, guardar versión y eliminar copian o mueven la FILA del server: lo pendiente va
  // primero (guardarAhora cancela el respiro del autoguardado), o la copia sale sin lo último.
  const duplicar = () => correr(async () => {
    await ctx.guardarAhora();
    const r = await pedirDocs({ accion: 'duplicar', id: ctx.docId });
    if (!r.ok) throw new Error(r.error);
    // Lo que cambió es QUÉ EXISTE: navegación dura (AGENTS.md), con el ?ws= de la pestaña.
    window.location.href = conWs(`/web-generator/${r.doc.id}`, ws);
  });

  const guardarVersion = () => correr(async () => {
    await ctx.guardarAhora();
    // motivo vacío = «Guardada a mano» (sanearMotivo pone el default del server).
    const r = await pedirDocs({ accion: 'guardarVersion', id: ctx.docId, motivo: '' });
    if (!r.ok) throw new Error(r.error);
    ctx.avisar('Versión guardada');
  });

  const eliminar = () => correr(async () => {
    await ctx.guardarAhora();
    const r = await pedirDocs({ accion: 'papelera', id: ctx.docId });
    if (!r.ok) throw new Error(r.error);
    window.location.href = conWs('/web-generator', ws);
  });

  return (
    <>
      {abierto ? (
      <Menu ancla={ancla} onCerrar={onCerrar} alinear="fin" etiqueta="Menú del documento" ancho={270}>
        <div className="gma-menu-cabeza">
          <div className="gma-menu-cabeza-titulo">{ctx.titulo.trim() || 'Sin título'}</div>
          {creado ? <div className="gma-menu-cabeza-sub">Creado el {creado}</div> : null}
          {info.creadoPor ? <div className="gma-menu-cabeza-sub">por {info.creadoPor}</div> : null}
        </div>
        <ItemMenu icono="deshacer" texto="Deshacer" atajo={`${mod}Z`} disabled={!puedeDeshacer}
          onClick={() => { ctx.editor?.commands.undo(); }} />
        <ItemMenu icono="historial" texto="Historial de versiones…" onClick={() => ctx.setPanelDer('historial')} />
        {pedido ? <ItemMenu icono="flecha-externa" texto="Ver instrucción de origen" onClick={() => setVerOrigen(true)} /> : null}
        <ItemMenu icono="paleta" texto="Logotipo, colores, fuentes..." onClick={() => ctx.setPanelDer('tema')} />
        <ItemMenu icono="engranaje" texto="Configuración de la página…" onClick={() => ctx.setDialogo('configuracion')} />
        <ItemMenu icono="descargar" texto="Exportar…" onClick={() => ctx.setDialogo('exportar')} />
        <SepMenu />
        <ItemMenu icono="comentario" texto="Comentarios" onClick={() => ctx.setPanelDer('comentarios')} />
        <ItemMenu icono="grafico" texto="Análisis" onClick={() => ctx.setDialogo('analitica')} />
        <ItemMenu icono="globo" texto="Ajustes del sitio..." onClick={() => ctx.setDialogo('publicar')} />
        <ItemMenu icono="duplicar" texto="Duplicar landing" onClick={duplicar} />
        <ItemMenu icono="reloj" texto="Guardar versión" onClick={guardarVersion} />
        <SepMenu />
        <ItemMenu icono={<IconoBorrar size={16} />} texto="Eliminar" peligro onClick={eliminar} />
      </Menu>
      ) : null}
      {verOrigen ? (
        <DialogoGma
          titulo="Instrucción de origen"
          onCerrar={() => setVerOrigen(false)}
          pie={(
            <>
              <button type="button" className="gma-boton gma-boton--contorno"
                onClick={() => { void navigator.clipboard?.writeText(pedido).then(() => ctx.avisar('Copiado'), () => ctx.avisar('No se pudo copiar')); }}>
                Copiar
              </button>
              <button type="button" className="gma-boton gma-boton--primario" onClick={() => setVerOrigen(false)}>Cerrar</button>
            </>
          )}
        >
          <div className="gma-dialogo-cita">{pedido}</div>
        </DialogoGma>
      ) : null}
    </>
  );
}
