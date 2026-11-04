'use client';

// =============================================================================
// Lo de WhatsApp en cada mensaje del Ops Center (17/10/2026), en la computadora y en el teléfono
// =============================================================================
// Martín: «Pon la funcionalidad de "Responder" que tiene WhatsApp al desplazar un mensaje hacia la derecha... Y agrega
// todas las funcionalidades de Whatsapp al mantener click en un mensaje». Copiado de WhatsApp en el iPhone y de WhatsApp
// Web/Desktop (mirados el 17/10):
//   · DESLIZAR A LA DERECHA RESPONDE: la burbuja sigue al dedo, asoma la flechita de responder y, pasado el umbral, un tic
//     (haptico 'light'); al soltar, la cita queda arriba de la caja. En la computadora, el mismo gesto con dos dedos en el
//     touchpad (la rueda horizontal), como en el teléfono.
//   · MANTENER APRETADO (el dedo o el clic, ~0,45 s), el CLIC DERECHO (WhatsApp Desktop) o la FLECHITA que aparece al
//     pasar por encima (WhatsApp Web) abren el menú: la fila de reacciones arriba y Responder, Reenviar, Copiar, Info,
//     Destacar, Fijar y Eliminar para mí (lib/centro-mensajes.ts → opcionesDelMensaje).
//   · LA CITA SE TOCA y lleva al mensaje citado, que se marca un momento (como en WhatsApp).
//   · LOS FIJADOS van en una barra arriba de la conversación: tocarla lleva al fijado y pasa al siguiente.
// Lo que NO se copió y por qué (reacciones que no viajan al chat, sin «Eliminar para todos»): lib/centro-mensajes.ts.
//
// ⚠️ EL MENÚ ES EL CLIC DERECHO DE LA CASA (app/_ui/MenuContextual.tsx): en la pila de modales, con teclado y por encima de
//    la hoja del teléfono (z 130 contra 80). La fila de reacciones es una línea de botones (`enLinea`).
// ⚠️ EN EL TELÉFONO LA BURBUJA NO SE SELECCIONA (como en WhatsApp: se copia desde el menú): mantener apretado abriría la
//    lupa de iOS en vez del menú. En la computadora el texto se sigue seleccionando con el mouse.

import { createContext, useContext, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type PointerEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useAtrasCierra } from './atras';
import { MenuContextual, type EntradaMenuContextual, type ItemMenuContextual } from '@/app/_ui/MenuContextual';
import { Icon } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { ejeDelGesto, rubberband } from '@/app/m/_ui/gestos';
import { ROTULO } from '@/lib/operaciones-reglas';
import { nombreCuenta, type ChatCentro, type LineaChat } from '@/lib/centro-chats';
import {
  REACCIONES, TOPE_REENVIO, buscarCitado, idDeLinea, idDelElemento, mensajeDeLinea, opcionesDelMensaje, renglonDeCita,
  type Cita, type IdMensaje, type MarcasChat, type MensajeWA, type OpcionMensaje,
} from '@/lib/centro-mensajes';
import { transcripcionAbierta } from './voces-enviadas';

export type { MensajeWA } from '@/lib/centro-mensajes';

/** Lo que el padre (la conversación de la computadora o la hoja del teléfono) hace con un mensaje. */
export type AccionesWA = {
  /** `tactil`: lo abrió un dedo (mantener apretado). Va la hoja de WhatsApp en el teléfono (HojaMensajeWA), no el menú. */
  abrirMenu: (m: MensajeWA, x: number, y: number, tactil?: boolean) => void;
  responder: (m: MensajeWA) => void;
  reaccionar: (id: IdMensaje, emoji: string | null) => void;
  /** Dibujar todos los mensajes (la conversación abre con los últimos): ir a uno viejo lo necesita. */
  verTodo?: () => void;
};
export const ContextoWA = createContext<AccionesWA | null>(null);

/** Cuánto hay que deslizar para responder (WhatsApp responde pasado ~1/6 del ancho; 56 px en un teléfono de 390). */
export const UMBRAL_RESPONDER = 56;
const LARGO_MS = 450;

/** Ir a un mensaje: se centra y se marca un momento (lo usan la cita y la barra de fijados). Si es de los que todavía no
 *  se dibujan (la conversación abre con los últimos), primero se dibujan todos. */
export function irAlMensaje(id: IdMensaje | null, verTodo?: () => void) {
  if (!id || typeof document === 'undefined') return;
  const el = document.getElementById(idDelElemento(id));
  if (!el) { if (verTodo) { verTodo(); window.setTimeout(() => irAlMensaje(id), 80); } return; }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('co-wa--visto');
  window.setTimeout(() => el.classList.remove('co-wa--visto'), 1600);
}

/**
 * La envoltura de un mensaje: el gesto de deslizar, el mantener apretado, el clic derecho y la flechita. `className` es
 * la de la fila que envuelve (co-yo o co-el): así el diseño de la conversación no cambia.
 */
export function Deslizable({ m, className, children }: { m: MensajeWA | null; className: string; children: ReactNode }) {
  const wa = useContext(ContextoWA);
  const raiz = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ id: number; x0: number; y0: number; tipo: string; eje: 'x' | 'y' | null; listo: boolean } | null>(null);
  const largo = useRef<number | null>(null);
  const tragar = useRef(false);
  const rueda = useRef<{ acum: number; t: number | null; listo: boolean }>({ acum: 0, t: null, listo: false });
  if (!wa || !m) return <div className={className} id={m ? idDelElemento(m.id) : undefined}>{children}</div>;

  const mover = (dx: number, ms = 0) => {
    const el = raiz.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms var(--ease-out, ease)` : 'none';
    el.style.transform = dx ? `translateX(${dx}px)` : '';
    el.style.setProperty('--co-wa-resp', String(Math.min(1, dx / UMBRAL_RESPONDER)));
  };
  const cortarLargo = () => { if (largo.current) { window.clearTimeout(largo.current); largo.current = null; } };
  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    tragar.current = false;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, tipo: e.pointerType, eje: null, listo: false };
    cortarLargo();
    const { clientX: x, clientY: y } = e;
    const tactil = e.pointerType !== 'mouse';
    largo.current = window.setTimeout(() => {
      largo.current = null;
      gesto.current = null;
      tragar.current = true;
      haptico('medium');
      wa.abrirMenu(m, x, y, tactil);
    }, LARGO_MS);
  };
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cortarLargo();
    // Con el mouse no se desliza: arrastrar es seleccionar texto.
    if (g.tipo === 'mouse') return;
    if (!g.eje) g.eje = ejeDelGesto(dx, dy);
    if (g.eje !== 'x') { if (g.eje === 'y') gesto.current = null; return; }
    const x = Math.max(0, dx);
    mover(x <= UMBRAL_RESPONDER ? x : UMBRAL_RESPONDER + rubberband(x - UMBRAL_RESPONDER, 160));
    if (!g.listo && x >= UMBRAL_RESPONDER) { g.listo = true; haptico('light'); }
    if (g.listo && x < UMBRAL_RESPONDER) g.listo = false;
  };
  const alSoltar = () => {
    cortarLargo();
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.eje !== 'x') return;
    mover(0, 220);
    if (g.listo) { tragar.current = true; wa.responder(m); }
  };
  const alCancelar = () => { cortarLargo(); if (gesto.current?.eje === 'x') mover(0, 220); gesto.current = null; };
  // El touchpad de la computadora: dos dedos de lado mandan una rueda horizontal. Se acumula y, pasado el umbral, responde.
  const alRodar = (e: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 1) return;
    // Un bloque de código que scrollea de lado se queda con su rueda.
    for (let n = e.target as HTMLElement | null; n && n !== raiz.current; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 1) return;
    const r = rueda.current;
    r.acum = Math.min(r.acum + Math.abs(e.deltaX), UMBRAL_RESPONDER * 1.6);
    mover(r.acum <= UMBRAL_RESPONDER ? r.acum : UMBRAL_RESPONDER + rubberband(r.acum - UMBRAL_RESPONDER, 160));
    if (!r.listo && r.acum >= UMBRAL_RESPONDER) r.listo = true;
    if (r.t) window.clearTimeout(r.t);
    r.t = window.setTimeout(() => {
      const listo = r.listo;
      rueda.current = { acum: 0, t: null, listo: false };
      mover(0, 220);
      if (listo) wa.responder(m);
    }, 140);
  };

  return (
    <div
      ref={raiz} id={idDelElemento(m.id)} className={`${className} co-wa${m.propio ? ' co-wa--yo' : ''}`}
      onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alCancelar} onPointerLeave={(e) => { if (e.pointerType === 'mouse') cortarLargo(); }}
      onWheel={alRodar}
      onContextMenu={(e) => {
        // En el teléfono el mantener apretado ya abrió el menú: el menú nativo (copiar, la lupa) no sale.
        e.preventDefault();
        if (gesto.current?.tipo === 'touch' || tragar.current) return;
        cortarLargo();
        wa.abrirMenu(m, e.clientX, e.clientY);
      }}
      onClickCapture={(e) => { if (tragar.current) { e.preventDefault(); e.stopPropagation(); tragar.current = false; } }}
    >
      <span className="co-wa__resp" aria-hidden><Icon name="flecha" size={16} /></span>
      {children}
      <button type="button" className="co-wa__mas" aria-label="Opciones del mensaje" title="Opciones"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); wa.abrirMenu(m, r.left, r.bottom + 4); }}>
        <Icon name="chevron" size={14} />
      </button>
    </div>
  );
}

/** Las marcas de un mensaje en su renglón de la hora: la estrella si está destacado y el alfiler si está fijado. */
export function MarcasEnHora({ id, marcas }: { id: IdMensaje | null; marcas: MarcasChat | null | undefined }) {
  if (!id || !marcas) return null;
  const destacado = marcas.destacados.includes(id);
  const fijado = marcas.fijados.includes(id);
  if (!destacado && !fijado) return null;
  return (
    <span className="co-wa__marcas">
      {destacado && <EstrellaWA llena size={11} />}
      {fijado && <AlfilerWA size={11} />}
    </span>
  );
}

/** La reacción de Martín, colgada abajo de la burbuja como en WhatsApp; tocarla la saca. */
export function ReaccionWA({ id, marcas }: { id: IdMensaje | null; marcas: MarcasChat | null | undefined }) {
  const wa = useContext(ContextoWA);
  const emoji = id ? marcas?.reacciones[id] : null;
  if (!id || !emoji) return null;
  return (
    <button type="button" className="co-wa__reaccion" title="Quitar la reacción" aria-label={`Quitar la reacción ${emoji}`}
      onClick={() => wa?.reaccionar(id, null)} disabled={!wa}>{emoji}</button>
  );
}

/** La cita adentro de una burbuja: quién y un renglón; se toca y lleva al mensaje citado (si sigue en la conversación). */
export function CitaEnBurbuja({ de, texto, lineas, citado }: { de: string; texto: string; lineas: readonly LineaChat[]; citado?: IdMensaje | null }) {
  const wa = useContext(ContextoWA);
  // `citado`: el hilo que no es de líneas del Centro (el chat con MaKo de un cliente) ya sabe cuál es.
  const id = citado !== undefined ? citado : buscarCitado(lineas, { texto });
  const cuerpo = <><span className="co-cita__de">{de}</span><span className="co-cita__texto">{texto}</span></>;
  return id
    ? <button type="button" className="co-cita co-cita--ir" onClick={() => irAlMensaje(id, wa?.verTodo)} title="Ir al mensaje">{cuerpo}</button>
    : <span className="co-cita">{cuerpo}</span>;
}

/** La cita arriba de la caja mientras se responde (WhatsApp: el recuadro con la barra de color y la ✕). */
export function CitaCaja({ cita, onQuitar, verTodo }: { cita: Cita; onQuitar: () => void; verTodo?: () => void }) {
  return (
    <div className="co-cita-caja">
      <button type="button" className="co-cita co-cita--ir" onClick={() => irAlMensaje(cita.id, verTodo)} title="Ir al mensaje">
        <span className="co-cita__de">{cita.de}</span>
        <span className="co-cita__texto">{renglonDeCita(cita.texto)}</span>
      </button>
      <button type="button" className="co-cita-caja__quitar" onClick={onQuitar} aria-label="No responder a ese mensaje" title="Quitar"><Icon name="x" size={14} /></button>
    </div>
  );
}

/** La barra de los fijados, arriba de la conversación: muestra uno; tocarla va a ése y pasa al siguiente (WhatsApp). */
export function BarraFijados({ marcas, lineas, titulo, onSoltar, verTodo, mensajes }: {
  marcas: MarcasChat; lineas: readonly LineaChat[]; titulo: string; onSoltar: (id: IdMensaje) => void; verTodo?: () => void;
  /** Los mensajes de un hilo que no es de líneas del Centro (el chat con MaKo de un cliente, 21/10/2026): se buscan acá. */
  mensajes?: readonly MensajeWA[];
}) {
  const fijados = marcas.fijados
    .map((id) => ({ id, m: mensajes ? mensajes.find((x) => x.id === id) ?? null : (() => { const l = lineas.find((x) => idDeLinea(x) === id); return l ? mensajeDeLinea(l, titulo) : null; })() }))
    .filter((x): x is { id: IdMensaje; m: MensajeWA } => !!x.m);
  const [i, setI] = useState(0);
  if (!fijados.length) return null;
  const k = Math.min(i, fijados.length - 1);
  const actual = fijados[fijados.length - 1 - k];
  const m = actual.m;
  return (
    <div className="co-fijados" role="region" aria-label="Mensajes fijados">
      {fijados.length > 1 && (
        <span className="co-fijados__puntos" aria-hidden>{fijados.map((f, j) => <i key={f.id} data-actual={j === fijados.length - 1 - k ? 'true' : undefined} />)}</span>
      )}
      <AlfilerWA size={14} />
      <button type="button" className="co-fijados__ir" onClick={() => { irAlMensaje(actual.id, verTodo); setI((k + 1) % fijados.length); }}>
        <span className="co-cita__de">{m?.de}</span>
        <span className="co-cita__texto">{renglonDeCita(m?.texto ?? '')}</span>
      </button>
      <button type="button" className="co-fijados__soltar" onClick={() => onSoltar(actual.id)} aria-label="No fijar" title="No fijar"><Icon name="x" size={13} /></button>
    </div>
  );
}

/** Lo abierto del menú de un mensaje: dónde, y si lo abrió un dedo. */
export type MenuAbiertoWA = { m: MensajeWA; x: number; y: number; tactil?: boolean };

/** El menú de un mensaje, con la fila de reacciones arriba. Elegir algo lo cierra. Abierto con el dedo, la hoja de WhatsApp. */
export function MenuMensajeWA({ abierto, marcas, onCerrar, onElegir, sin = [], sinReacciones = false }: {
  abierto: MenuAbiertoWA | null;
  marcas: MarcasChat;
  onCerrar: () => void;
  /** `reaccion:<emoji>` o una opción de `opcionesDelMensaje`. */
  onElegir: (m: MensajeWA, id: string) => void;
  /** Lo que este chat no tiene: el Ops Center de un cliente no reenvía a otro chat (21/10/2026). */
  sin?: readonly OpcionMensaje['id'][];
  /** Sin la fila de reacciones: las de un chat se guardan por persona, y en un grupo nadie más las vería (3/11/2026). */
  sinReacciones?: boolean;
}) {
  const [confirmar, setConfirmar] = useState<{ m: MensajeWA; x: number; y: number } | null>(null);
  if (confirmar) {
    // WhatsApp pregunta antes de eliminar: acá, en el mismo lugar del menú.
    return (
      <MenuContextual punto={{ x: confirmar.x, y: confirmar.y }} titulo="¿Eliminar el mensaje? Sólo para ti" onCerrar={() => setConfirmar(null)}
        onElegir={(id) => { const m = confirmar.m; setConfirmar(null); if (id === 'si') onElegir(m, 'eliminar'); }}
        items={[{ id: 'si', label: 'Eliminar para mí', icono: 'borrar', peligro: true }, { id: 'no', label: 'Cancelar', icono: 'cerrar' }]} />
    );
  }
  if (!abierto) return null;
  if (abierto.tactil) return <HojaMensajeWA m={abierto.m} marcas={marcas} onCerrar={onCerrar} onElegir={onElegir} sin={sin} sinReacciones={sinReacciones} />;
  const { m } = abierto;
  const actual = marcas.reacciones[m.id] ?? null;
  const iconos: Record<string, ItemMenuContextual['icono']> = {
    responder: 'cita', reenviar: 'enviar', copiar: 'copiar', info: 'ver', fijar: 'fijar', eliminar: 'borrar', transcripcion: 'texto',
    destacar: <EstrellaWA llena={marcas.destacados.includes(m.id)} size={17} />,
  };
  const items: EntradaMenuContextual[] = [
    ...(sinReacciones ? [] : [{
      id: 'reacciones', label: 'Reaccionar',
      enLinea: REACCIONES.map((e) => ({ id: `reaccion:${e}`, label: actual === e ? `Quitar ${e}` : `Reaccionar con ${e}`, icono: <span className="co-wa__emoji" data-actual={actual === e ? 'true' : undefined}>{e}</span> })),
    }, null]),
    ...opcionesDelMensaje(m, marcas, transcripcionAbierta(m.trabajo?.id ?? '')).filter((o) => !sin.includes(o.id)).flatMap((o): EntradaMenuContextual[] => [
      ...(o.id === 'eliminar' ? [null] : []),
      { id: o.id, label: o.label, icono: iconos[o.id], peligro: o.id === 'eliminar' },
    ]),
  ];
  return (
    <MenuContextual punto={{ x: abierto.x, y: abierto.y }} titulo={renglonDeCita(m.texto, 60)} etiqueta="Opciones del mensaje" onCerrar={onCerrar}
      onElegir={(id) => {
        if (id === 'eliminar') { setConfirmar(abierto); onCerrar(); return; }
        onElegir(m, id);
      }}
      items={items} />
  );
}

/**
 * MANTENER APRETADO EN EL TELÉFONO, COMO WHATSAPP (17/10/2026; Martín: «el menú se cierra solo enseguida y se lleva la fila de
 * emojis y la referencia... tiene que quedar abierto hasta que se toque afuera»). Copiado de WhatsApp en el iPhone: el fondo
 * se oscurece y se desenfoca, arriba la fila de reacciones, en el medio el mensaje (la referencia) y abajo las opciones.
 *
 * POR QUÉ SE CERRABA SOLO: el menú de la casa (MenuContextual) se cierra con cualquier `contextmenu` afuera (es su regla para
 * el clic derecho), con `resize` y con `blur`. Android dispara su propio `contextmenu` al mantener apretado, DESPUÉS de los
 * 450 ms en que se abre el menú, y en el iPhone abrirlo saca el foco de la caja (se cierra el teclado: `resize`). El menú se
 * abría y se cerraba en el mismo gesto. Esta hoja sólo se cierra con un toque que EMPIEZA afuera después de abrirla, con
 * Escape, con el «atrás» (atras.ts) o eligiendo algo; levantar el dedo que la abrió no elige nada.
 */
export function HojaMensajeWA({ m, marcas, onCerrar, onElegir, sin = [], sinReacciones = false }: {
  m: MensajeWA; marcas: MarcasChat; onCerrar: () => void; onElegir: (m: MensajeWA, id: string) => void; sin?: readonly OpcionMensaje['id'][]; sinReacciones?: boolean;
}) {
  // Un toque cuenta sólo si su dedo bajó con la hoja ya abierta: el que la abrió todavía está apoyado.
  const listo = useRef(false);
  const [confirmar, setConfirmar] = useState(false);
  useAtrasCierra(true, onCerrar);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCerrar(); } };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [onCerrar]);
  if (typeof document === 'undefined') return null;
  const vale = (e: { detail: number }) => listo.current || e.detail === 0;
  const actual = marcas.reacciones[m.id] ?? null;
  const elegir = (id: string) => (e: ReactMouseEvent) => {
    if (!vale(e)) return;
    if (id === 'eliminar') { setConfirmar(true); return; }
    onElegir(m, id);
  };
  const iconos: Record<string, ReactNode> = {
    responder: <IconoMenu nombre="cita" />, reenviar: <IconoMenu nombre="enviar" />, copiar: <IconoMenu nombre="copiar" />,
    info: <IconoMenu nombre="ver" />, fijar: <IconoMenu nombre="fijar" />, eliminar: <IconoMenu nombre="borrar" />,
    transcripcion: <IconoMenu nombre="texto" />,
    destacar: <EstrellaWA llena={marcas.destacados.includes(m.id)} size={17} />,
  };
  return createPortal(
    <div className={`co-wa-hoja${m.propio ? ' co-wa-hoja--yo' : ''}`} role="dialog" aria-modal="true" aria-label="Opciones del mensaje"
      onPointerDownCapture={() => { listo.current = true; }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => { if (e.target === e.currentTarget && vale(e)) onCerrar(); }}>
      <div className="co-wa-hoja__col">
        {!sinReacciones && (
          <div className="co-wa-hoja__reacciones" role="group" aria-label="Reaccionar">
            {REACCIONES.map((e) => (
              <button key={e} type="button" className="co-wa-hoja__emoji" data-actual={actual === e ? 'true' : undefined}
                aria-label={actual === e ? `Quitar ${e}` : `Reaccionar con ${e}`} onClick={elegir(`reaccion:${e}`)}>{e}</button>
            ))}
          </div>
        )}
        <div className="co-wa-hoja__msg">{renglonDeCita(m.texto, 280)}</div>
        <div className="co-wa-hoja__acciones" role="menu">
          {confirmar ? (
            <>
              <p className="co-wa-hoja__pregunta">¿Eliminar el mensaje? Sólo para ti</p>
              <button type="button" role="menuitem" className="co-wa-hoja__accion co-wa-hoja__accion--peligro" onClick={(e) => { if (vale(e)) onElegir(m, 'eliminar'); }}>
                <span>Eliminar para mí</span>{iconos.eliminar}
              </button>
              <button type="button" role="menuitem" className="co-wa-hoja__accion" onClick={(e) => { if (vale(e)) setConfirmar(false); }}><span>Cancelar</span></button>
            </>
          ) : opcionesDelMensaje(m, marcas, transcripcionAbierta(m.trabajo?.id ?? '')).filter((o) => !sin.includes(o.id)).map((o) => (
            <button key={o.id} type="button" role="menuitem" className={`co-wa-hoja__accion${o.id === 'eliminar' ? ' co-wa-hoja__accion--peligro' : ''}`} onClick={elegir(o.id)}>
              <span>{o.label}</span>{iconos[o.id]}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** «Info» de un mensaje propio: cuándo salió, cuándo lo recibió el chat y cuándo lo dio por hecho (WhatsApp: Leído,
 *  Entregado). Del Ops Center no hay «leído»: un chat recibe o no recibe. */
export function InfoMensaje({ m }: { m: MensajeWA }) {
  const hora = (v: string | null | undefined) => {
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? new Date(t).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
  };
  const w = m.trabajo;
  const filas: Array<[string, string | null]> = w
    ? [
      ['Enviado', hora(w.created_at)],
      ['Entregado', hora(w.entregado_at)],
      ['Hecho', hora(w.cerrado_at)],
      ['Estado', ROTULO[w.estado ?? 'escrito']],
      ['Cuenta', nombreCuenta(w.destino_cuenta)],
      ...(w.motivo ? [['Motivo', w.motivo] as [string, string]] : []),
    ]
    : [['Escrito', hora(new Date(m.instante).toISOString())], ['Por', m.de]];
  return (
    <div className="co-info-wa">
      <p className="co-info-wa__texto">{renglonDeCita(m.texto, 240)}</p>
      <dl className="co-info-wa__dl">
        {filas.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </div>
  );
}

/** Elegir a qué chats reenviar (WhatsApp: hasta 5, con un buscador arriba). */
export function ReenviarA({ chats, origen, onEnviar, enviando }: {
  chats: readonly ChatCentro[]; origen: string; enviando: boolean; onEnviar: (claves: string[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const lista = chats.filter((c) => c.clave !== origen && !c.nube && !c.esRunner && (!busca.trim() || normal(c.titulo).includes(normal(busca.trim()))));
  const alternar = (k: string) => setElegidos((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : xs.length >= TOPE_REENVIO ? xs : [...xs, k]));
  return (
    <div className="co-reenviar">
      <input className="co-reenviar__buscar" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar un chat" aria-label="Buscar un chat" />
      <ul className="co-reenviar__lista">
        {lista.map((c) => (
          <li key={c.clave}>
            <label className="co-reenviar__fila">
              <input type="checkbox" checked={elegidos.includes(c.clave)} onChange={() => alternar(c.clave)}
                disabled={!elegidos.includes(c.clave) && elegidos.length >= TOPE_REENVIO} />
              <span>{c.titulo}</span>
            </label>
          </li>
        ))}
        {!lista.length && <li className="co-nota">Ningún chat con ese nombre.</li>}
      </ul>
      <div className="co-reenviar__pie">
        <span className="co-nota">{elegidos.length ? `${elegidos.length} de ${TOPE_REENVIO}` : `Hasta ${TOPE_REENVIO} chats`}</span>
        <button type="button" className="co-enviar" disabled={!elegidos.length || enviando} onClick={() => onEnviar(elegidos)} aria-label="Reenviar" title="Reenviar">
          {enviando ? <span className="co-enviar__giro" aria-hidden /> : <Icon name="flecha" size={18} />}
        </button>
      </div>
    </div>
  );
}

function EstrellaWA({ llena, size = 12 }: { llena: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none' }}
      fill={llena ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1 6L12 17.05 6.65 19.85l1-6L3.3 9.6l6-.9Z" />
    </svg>
  );
}
export function AlfilerWA({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none' }} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3.5h6l-.8 5.3 3.3 3.2H6.5l3.3-3.2L9 3.5Z" /><path d="M12 12v8.5" />
    </svg>
  );
}
