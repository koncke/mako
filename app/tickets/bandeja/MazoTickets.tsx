'use client';

// =============================================================================
// La Ticketera en MAZO: un ticket por tarjeta, para deslizar (22/10/2026; la vista de entrada, compu y teléfono)
// =============================================================================
// Martín (22/10): «te pedí que vuelva la vista de tarjetas y el desplazamiento tipo tinder». Derecha = Aprobar (Arreglar
// un bug, Hacer un pedido, Responder una pregunta) · izquierda = Rechazar · arriba = Preguntarle al cliente. Cada gesto
// tiene su botón y su tecla (→ ← ↑): un gesto sin control visible es una función que sólo encuentra el que la conoce
// (Superhuman lleva sus dos gestos también en una barra de botones). Las reglas: ./mazo-reglas.ts.
//
// ⚠️ «VOLVER» SIEMPRE A LA VISTA (Martín, 14/10/2026: «arrastré sin querer una tarjeta y ya no tengo forma de volver,
//    debería haber un botón para volver»). Desde el 22/10 (tarde) vive en la FILA de los botones, el primero, como el
//    «rewind» de Tinder: apagado cuando no hay nada que deshacer, nunca escondido. Y deshace DE VERDAD: una decisión de
//    la Ticketera le escribe al cliente o se la firma al Cerebro, y eso no se recoge. Por eso cada decisión ESPERA
//    `VENTANA_DESHACER_MS` antes de salir (el «Deshacer envío» de Gmail: no recoge el mail, lo demora), y «Volver» la
//    saca de la espera: no llega nada a ningún lado. Si Martín se va de la pantalla (otra pestaña, otra vista, cierra),
//    lo que esperaba sale en el acto: lo decidió.
// ⚠️ EL GESTO ES EL DEL MAZO VIEJO (app/tickets/decisiones/Mazo.tsx, el que Martín aprobó el 14/10): `motion` sigue al
//    dedo, mide la velocidad y bloquea la dirección (`dragDirectionLock`); el arrastre arranca a mano
//    (`useDragControls`) y nunca sobre un link, un botón, un campo o el borde de la pantalla (el «volver» del sistema).
//    Ahora también hacia ARRIBA: la tarjeta no tiene scroll (lo largo se corta y está en «Ver todo»), así que el dedo
//    vertical es del gesto (`touch-action: none`), no de la página.
// ⚠️ EL MAZO NO SE REARMA AL REFRESCAR (se refresca solo): lo nuevo va al final y lo que decidió otro se va
//    (`refrescarMazo`). La tarjeta de adelante no cambia bajo el dedo.
// ⚠️ LA TARJETA SIEMPRE EN EL CENTRO (Martín, 22/10, 17:25: «las tarjetas siempre en el medio, mira como se rompe el
//    diseño»). «Lo que sigue» ya no se corre al costado: como en Tinder, lo que sigue es la tarjeta que asoma detrás y el
//    «1 de N» de arriba. Los botones, una fila centrada debajo: redondos, del MISMO tamaño, sólo con su ícono y su color
//    («no me gusta que tengan texto, solo iconos, para eso está el placeholder»: lo que hace cada uno va en el `title` y
//    el `aria-label`). Al pasar el mouse o al arrastrar hacia su lado, el botón del gesto se marca (`gestoMarcado`).

import { useCallback, useEffect, useRef, useState, type MouseEventHandler, type ReactNode, type RefObject } from 'react';
import {
  animate, motion, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform,
  type MotionValue, type PanInfo,
} from 'motion/react';
import { Icon } from '@/app/_components/icons';
import { pedidoAlCerebro } from '@/lib/tickets-reglas';
import type { FilaTicket } from '@/lib/tickets-db';
import { anotarDespachoAction, decidirTicketAction } from './acciones';
import type { CerebroParaTickets } from './cerebro';
import { TarjetaTicket } from './TarjetaTicket';
import {
  RESPUESTAS_GUARDADAS, VENTANA_DESHACER_MS, accionesDe, gestoMarcado, ordenDelMazo, quePaso, refrescarMazo, teclaDelMazo, veredictoGesto,
  versionesDe, type AccionMazo, type Salida,
} from './mazo-reglas';

type Manejo = { volar: (s: Salida, velocidad?: number) => Promise<void> };
/** Una decisión tomada que todavía no salió: «Volver» la trae de vuelta entera. */
type Pendiente = { t: FilaTicket; accion: AccionMazo; texto: string; hasta: number };
type Aviso = { texto: string; error?: boolean; pendiente?: number };
/** Lo que dice el aviso mientras la decisión espera salir. */
const PASADO: Record<AccionMazo['decision'], string> = {
  arreglar: 'Aprobado', hacer: 'Aprobado', responder: 'Respondido', rechazar: 'Rechazado', preguntar: 'Preguntado', duplicado: 'Duplicado',
};

export function MazoTickets({ tickets, cerebro, ahora, onCambio, onVerTodo, quieto, barra, onVerTabla }: {
  tickets: readonly FilaTicket[];
  cerebro: CerebroParaTickets | null;
  ahora: number;
  /** Después de que una decisión salió: la bandeja vuelve a leer. */
  onCambio: () => void;
  onVerTodo: (id: number) => void;
  /** Hay una hoja abierta encima (el ticket entero): las teclas no son del mazo. */
  quieto: boolean;
  /** Lo de la derecha de la franja de arriba (el cambio de vista y el arreglo automático). */
  barra: ReactNode;
  onVerTabla: () => void;
}) {
  const [orden, setOrden] = useState<number[]>(() => ordenDelMazo(tickets));
  const [indice, setIndice] = useState(0);
  // La versión de cada ticket en la última lectura: lo que vuelve a esperar a Martín, vuelve al mazo (`refrescarMazo`).
  const vistos = useRef<Map<number, string>>(versionesDe(tickets));
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const relojes = useRef(new Map<number, number>());
  const [caja, setCaja] = useState<{ id: number; salida: Salida } | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [entrada, setEntrada] = useState<Salida | null>(null);
  // El botón del gesto que se está haciendo (arrastrando hacia su lado, o decidido con una tecla): se marca.
  const [marca, setMarca] = useState<Salida | null>(null);
  const manejo = useRef<Manejo | null>(null);
  const ocupado = useRef(false);
  const progreso = useMotionValue(0);
  const cerebroRef = useRef(cerebro);
  cerebroRef.current = cerebro;

  const porId = new Map(tickets.map((t) => [t.id, t]));
  const ids = orden.filter((id) => porId.has(id));
  const i = Math.min(indice, Math.max(0, ids.length - 1));
  const actual = ids.length ? porId.get(ids[i])! : null;
  const siguiente = ids.length > 1 ? porId.get(ids[(i + 1) % ids.length])! : null;
  const acciones = actual ? accionesDe(actual) : null;
  const claveTexto = (id: number, s: Salida) => `${id}:${s}`;
  const textoDe = (id: number, s: Salida) => textos[claveTexto(id, s)] ?? '';

  // Lo que llega al refrescar: al final, sin rearmar (y sin lo que espera salir). Contra la lectura ANTERIOR, copiada:
  // React puede correr el `setOrden(fn)` dos veces (StrictMode, un render que se reintenta) y tiene que dar lo mismo.
  useEffect(() => {
    const apartados = new Set(pendientes.map((p) => p.t.id));
    const antes: ReadonlyMap<number, string> = new Map(vistos.current);
    for (const t of tickets) vistos.current.set(t.id, t.updated_at);
    setOrden((o) => {
      const r = refrescarMazo(o, tickets, antes, apartados);
      return r.length === o.length && r.every((x, k) => x === o[k]) ? o : r;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  useEffect(() => { ocupado.current = false; }, [actual?.id]);
  useEffect(() => {
    if (!aviso || aviso.pendiente != null) return;
    const r = window.setTimeout(() => setAviso(null), aviso.error ? 7000 : 3500);
    return () => window.clearTimeout(r);
  }, [aviso]);

  /** La decisión SALE: al servidor, y si es Aprobar, firmada al Cerebro. Si falla, la tarjeta vuelve adelante. */
  const salir = useCallback(async (p: Pendiente) => {
    const id = p.t.id;
    window.clearTimeout(relojes.current.get(id));
    relojes.current.delete(id);
    setPendientes((ps) => ps.filter((x) => x.t.id !== id));
    setAviso((a) => (a?.pendiente === id ? null : a));
    const d = p.accion.decision;
    const r = await decidirTicketAction(id, d === 'arreglar' || d === 'hacer' ? { decision: d, nota: '' } : { decision: d, respuesta: p.texto })
      .catch(() => ({ ok: false as const, error: 'No se pudo guardar' }));
    if (!r.ok) {
      setOrden((o) => [id, ...o.filter((x) => x !== id)]);
      setIndice(0);
      setAviso({ texto: `#${id}: ${r.error}`, error: true });
      onCambio();
      return;
    }
    if (d === 'arreglar' || d === 'hacer') {
      const c = cerebroRef.current;
      let falla: string | null = null;
      if (!c) falla = 'no hay un chat «Cerebro»';
      else if (!c.listo.ok) falla = c.listo.motivo;
      else {
        const m = await c.mandar(pedidoAlCerebro(p.t, d, null)).catch(() => ({ ok: false as const, error: 'no salió' }));
        if (!m.ok) falla = m.error;
        else {
          const a = await anotarDespachoAction(id, m.id).catch(() => ({ ok: false as const, error: 'no se anotó' }));
          if (!a.ok) falla = a.error;
        }
      }
      if (falla) setAviso({ texto: `#${id} quedó aprobado, sin llegar al Cerebro (${falla}). Mándaselo desde «Ver todo».`, error: true });
    }
    onCambio();
  }, [onCambio]);

  // Si se va de la pantalla, lo que esperaba sale ya: lo decidió (y una pestaña cerrada no espera 8 segundos).
  const pendientesRef = useRef(pendientes);
  pendientesRef.current = pendientes;
  const salirRef = useRef(salir);
  salirRef.current = salir;
  useEffect(() => {
    const vaciar = () => { for (const p of pendientesRef.current) void salirRef.current(p); };
    const oculta = () => { if (document.visibilityState === 'hidden') vaciar(); };
    window.addEventListener('pagehide', vaciar);
    document.addEventListener('visibilitychange', oculta);
    return () => {
      window.removeEventListener('pagehide', vaciar);
      document.removeEventListener('visibilitychange', oculta);
      vaciar();
    };
  }, []);

  /** La única salida de una tarjeta, venga del gesto, de un botón o de una tecla. */
  const decidir = useCallback((s: Salida, velocidad = 0): boolean => {
    if (!actual || !acciones || ocupado.current) return false;
    const acc = acciones[s];
    if (!acc) return false;
    const texto = textoDe(actual.id, s).trim();
    if (acc.pideTexto && !texto) {
      // Sin texto no sale: se abre la caja de lo que lee el cliente (ella misma es el aviso) y el gesto vuelve solo.
      setCaja({ id: actual.id, salida: s });
      return false;
    }
    ocupado.current = true;
    const t = actual;
    try { navigator.vibrate?.(8); } catch { /* sin vibración */ }
    setMarca(s);
    void (manejo.current?.volar(s, velocidad) ?? Promise.resolve()).then(() => {
      const p: Pendiente = { t, accion: acc, texto, hasta: Date.now() + VENTANA_DESHACER_MS };
      setMarca(null);
      setEntrada(null);
      setCaja(null);
      setOrden((o) => o.filter((x) => x !== t.id));
      setPendientes((ps) => [...ps, p]);
      relojes.current.set(t.id, window.setTimeout(() => void salirRef.current(p), VENTANA_DESHACER_MS));
      setAviso({ texto: `${PASADO[acc.decision]} · #${t.id}`, pendiente: t.id });
    });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, acciones, textos]);

  /** «Volver»: la última decisión que todavía no salió vuelve adelante, como estaba. No llega nada a ningún lado. */
  const volver = useCallback(() => {
    const u = pendientes[pendientes.length - 1];
    if (!u || ocupado.current) return;
    window.clearTimeout(relojes.current.get(u.t.id));
    relojes.current.delete(u.t.id);
    setPendientes((ps) => ps.slice(0, -1));
    setEntrada(u.accion.salida);
    setOrden((o) => [u.t.id, ...o.filter((x) => x !== u.t.id)]);
    setIndice(0);
    setAviso({ texto: `Volvió #${u.t.id}: no salió nada` });
  }, [pendientes]);

  const mover = useCallback((paso: number) => {
    if (ids.length < 2) return;
    setCaja(null);
    setEntrada(null);
    setIndice((x) => (Math.min(x, ids.length - 1) + paso + ids.length) % ids.length);
  }, [ids.length]);

  // Las teclas, en la compu (qué hace cada una, y cuándo NO: ./mazo-reglas.ts → `teclaDelMazo`).
  const cajaAbierta = !!actual && caja?.id === actual.id;
  useEffect(() => {
    if (quieto) return;
    const tecla = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      const enCampo = !!el && ((el as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const enFlechas = !!el?.closest('[role="tablist"], [role="radiogroup"], [role="listbox"], [role="menu"], [role="slider"]');
      const a = teclaDelMazo(e, { enCampo, enFlechas, cajaAbierta });
      if (!a) return;
      if (a !== 'cerrar' && a !== 'siguiente' && a !== 'anterior') e.preventDefault();
      if (a === 'volver') volver();
      else if (a === 'cerrar') setCaja(null);
      else if (a === 'siguiente') mover(1);
      else if (a === 'anterior') mover(-1);
      else if (a !== 'comer') decidir(a);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [quieto, cajaAbierta, decidir, volver, mover]);

  const hayVuelta = pendientes.length > 0;
  const enCaja = actual && caja?.id === actual.id ? caja.salida : null;

  return (
    <section className="tickets-bandeja__mazo" aria-label="Tickets por decidir" data-m-sin-pull="">
      <header className="tickets-bandeja__franja">
        {ids.length > 0 && (
          <div className="tickets-bandeja__cuenta">
            <button type="button" onClick={() => mover(-1)} disabled={ids.length < 2} aria-label="La anterior (K)">
              <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={16} /></span>
            </button>
            <span aria-live="polite"><b>{i + 1}</b> de {ids.length}</span>
            <button type="button" onClick={() => mover(1)} disabled={ids.length < 2} aria-label="La siguiente (J)">
              <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Icon name="chevron" size={16} /></span>
            </button>
          </div>
        )}
        <div className="tickets-bandeja__franja-der">{barra}</div>
      </header>

      <div className="tickets-bandeja__mesa">
        <div className="tickets-bandeja__pila">
          {siguiente && siguiente.id !== actual?.id && <CartaAtras key={`atras-${siguiente.id}`} t={siguiente} ahora={ahora} progreso={progreso} />}
          {actual && acciones ? (
            <CartaArriba
              key={actual.id}
              t={actual}
              ahora={ahora}
              acciones={acciones}
              textos={{ derecha: textoDe(actual.id, 'derecha'), izquierda: textoDe(actual.id, 'izquierda'), arriba: textoDe(actual.id, 'arriba') }}
              enCaja={enCaja}
              entrada={entrada}
              progreso={progreso}
              manejo={manejo}
              onDecidir={decidir}
              onTexto={(s, v) => setTextos((x) => ({ ...x, [claveTexto(actual.id, s)]: v }))}
              onCaja={(s) => setCaja(s ? { id: actual.id, salida: s } : null)}
              onVerTodo={() => onVerTodo(actual.id)}
              onTocar={() => setAviso((a) => (a && !a.error ? null : a))}
              onMarca={setMarca}
            />
          ) : (
            <div className="tickets-bandeja__mazo-vacio">
              <span className="tickets-bandeja__mazo-vacio-ico" aria-hidden><Icon name="check" size={30} /></span>
              <h2>{hayVuelta ? 'Listo' : 'Nada por decidir'}</h2>
              <button type="button" className="tickets-bandeja__pildora" onClick={onVerTabla}>Ver la tabla</button>
            </div>
          )}

          {/* Lo que acaba de pasar: flota abajo y se va solo (o al tocar la tarjeta que sigue: «Volver» sigue arriba). */}
          {aviso && (
            <div className={`tickets-bandeja__aviso${aviso.error ? ' tickets-bandeja__aviso--error' : ''}`} role={aviso.error ? 'alert' : 'status'}>
              <span>{aviso.texto}</span>
              {aviso.pendiente != null && hayVuelta && <button type="button" onClick={volver}>Deshacer</button>}
              {aviso.pendiente != null && (
                <i key={aviso.pendiente} className="tickets-bandeja__aviso-reloj" style={{ animationDuration: `${VENTANA_DESHACER_MS}ms` }} aria-hidden />
              )}
            </div>
          )}
        </div>
      </div>

      {/* La fila de los botones, centrada debajo de la tarjeta: ↺ ✕ ↑ ✓ (el orden de Tinder: volver, no, el del medio, sí). */}
      <div className="tickets-bandeja__pulgar">
        <button type="button" className="tickets-bandeja__gesto tickets-bandeja__gesto--volver" onClick={volver} disabled={!hayVuelta}
          aria-label={hayVuelta ? 'Volver: deshacer la última (⌫)' : 'Nada para volver'} title={hayVuelta ? 'Volver: deshacer la última (⌫)' : 'Nada para volver'}>
          <svg viewBox="0 0 24 24" width="25" height="25" aria-hidden>
            <path d="M4.5 9.5h9.8a4.7 4.7 0 010 9.4H9" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 5.2L3.8 9.5 8 13.8" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {actual && acciones && (
          <>
            <BotonGesto s="izquierda" a={acciones.izquierda} marcado={marca === 'izquierda'} onClick={() => decidir('izquierda')} />
            {acciones.arriba && <BotonGesto s="arriba" a={acciones.arriba} marcado={marca === 'arriba'} onClick={() => decidir('arriba')} />}
            <BotonGesto s="derecha" a={acciones.derecha} marcado={marca === 'derecha'} onClick={() => decidir('derecha')} />
          </>
        )}
      </div>
    </section>
  );
}

const TECLA: Record<Salida, string> = { derecha: '→', izquierda: '←', arriba: '↑' };
const ICONO_GESTO: Record<Salida, ReactNode> = {
  derecha: <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  izquierda: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
  arriba: <path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
};
/** Un botón por gesto: redondo, sólo el ícono; lo que hace, en el `title` (el «placeholder») y el `aria-label`. */
function BotonGesto({ s, a, marcado, onClick }: { s: Salida; a: AccionMazo | null; marcado: boolean; onClick: () => void }) {
  if (!a) return null;
  const dice = `${a.rotulo} (${TECLA[s]})`;
  return (
    <button type="button" className={`tickets-bandeja__gesto tickets-bandeja__gesto--${s}${marcado ? ' is-marcado' : ''}`} onClick={onClick}
      aria-label={dice} title={dice}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>{ICONO_GESTO[s]}</svg>
    </button>
  );
}

// =============================================================================
// La tarjeta de adelante: la que se arrastra
// =============================================================================
function CartaArriba(p: {
  t: FilaTicket;
  ahora: number;
  acciones: Record<Salida, AccionMazo | null>;
  textos: Record<Salida, string>;
  enCaja: Salida | null;
  entrada: Salida | null;
  progreso: MotionValue<number>;
  manejo: RefObject<Manejo | null>;
  onDecidir: (s: Salida, velocidad?: number) => boolean;
  onTexto: (s: Salida, v: string) => void;
  onCaja: (s: Salida | null) => void;
  onVerTodo: () => void;
  onTocar: () => void;
  /** El botón que se marca mientras se arrastra (o null). */
  onMarca: (s: Salida | null) => void;
}) {
  const { t, progreso, acciones } = p;
  const ref = useRef<HTMLElement>(null);
  // La que VUELVE empieza fuera, del lado por el que salió, y entra con el resorte.
  const desde = useRef(p.entrada);
  const fuera = typeof window === 'undefined' ? 560 : window.innerWidth;
  const x = useMotionValue(desde.current === 'derecha' ? fuera : desde.current === 'izquierda' ? -fuera : 0);
  const y = useMotionValue(desde.current === 'arriba' ? -(typeof window === 'undefined' ? 800 : window.innerHeight) : 0);
  const opacidad = useMotionValue(1);
  const rotate = useTransform(x, [-320, 0, 320], [-14, 0, 14]);
  const selloSi = useTransform(x, [24, 110], [0, 1]);
  const selloNo = useTransform(x, [-110, -24], [1, 0]);
  const selloArriba = useTransform(y, [-120, -28], [1, 0]);
  const controles = useDragControls();
  const reducido = useReducedMotion();
  const saliendo = useRef(false);
  const arrastro = useRef(false);

  useEffect(() => { progreso.set(0); }, [progreso]);
  // El botón del gesto se ENCIENDE sólo arrastrando: la que vuelve con «Volver» entra desde el costado y no tiene que
  // encender el botón de ese lado. Uno encendido se sigue mirando hasta que se apaga: al soltar sin decidir, la tarjeta
  // vuelve con el resorte (y el clic de después del arrastre ya bajó `arrastro`) y la marca se apaga sola.
  const marcada = useRef<Salida | null>(null);
  const marcar = () => {
    if (saliendo.current || (!arrastro.current && marcada.current === null)) return;
    const m = gestoMarcado(x.get(), y.get());
    if (m !== marcada.current) { marcada.current = m; p.onMarca(m); }
  };
  // La que se va en pleno arrastre (la sacó un refresco, o «Volver» trajo otra) apaga lo que encendió.
  const onMarca = p.onMarca;
  useEffect(() => () => onMarca(null), [onMarca]);
  useMotionValueEvent(x, 'change', (v) => { if (!saliendo.current) progreso.set(Math.min(1, Math.max(Math.abs(v), Math.abs(y.get())) / 160)); marcar(); });
  useMotionValueEvent(y, 'change', (v) => { if (!saliendo.current) progreso.set(Math.min(1, Math.max(Math.abs(v), Math.abs(x.get())) / 160)); marcar(); });

  useEffect(() => {
    if (!desde.current) return;
    const resorte = { type: 'spring', stiffness: 460, damping: 40 } as const;
    if (reducido) { x.set(0); y.set(0); return; }
    animate(x, 0, resorte);
    animate(y, 0, resorte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    p.manejo.current = {
      volar: (s, velocidad = 0) => new Promise<void>((resolver) => {
        saliendo.current = true;
        progreso.set(1);
        // La salida no depende de que la animación TERMINE: con la pestaña de fondo el navegador no dibuja cuadros y
        // `onComplete` no llega nunca (medido en el arnés). A los 600 ms sale igual.
        let hecho = false;
        const listo = () => { if (!hecho) { hecho = true; resolver(); } };
        window.setTimeout(listo, 600);
        if (reducido) { listo(); return; }
        if (s === 'arriba') {
          animate(y, -(typeof window === 'undefined' ? 900 : window.innerHeight), { duration: 0.32, ease: [0.4, 0, 0.6, 1] });
          animate(opacidad, 0, { duration: 0.3, onComplete: () => listo() });
          return;
        }
        const ancho = typeof window === 'undefined' ? 800 : window.innerWidth;
        const destino = (s === 'derecha' ? 1 : -1) * (ancho + 240);
        const restante = Math.abs(destino - x.get());
        const rapidez = Math.max(1600, Math.abs(velocidad));
        animate(x, destino, { duration: Math.min(0.38, Math.max(0.18, restante / rapidez)), ease: [0.2, 0.6, 0.4, 1], onComplete: () => listo() });
      }),
    };
  });

  const alSoltar = (_: unknown, info: PanInfo) => {
    const caja = ref.current;
    const v = veredictoGesto({
      dx: info.offset.x, dy: info.offset.y, vx: info.velocity.x, vy: info.velocity.y,
      ancho: caja?.offsetWidth ?? 360, alto: caja?.offsetHeight ?? 560,
    });
    if (v) p.onDecidir(v, v === 'arriba' ? info.velocity.y : info.velocity.x);
  };
  const comerClick: MouseEventHandler<HTMLElement> = (e) => {
    if (!arrastro.current) return;
    arrastro.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const listo = (s: Salida) => !acciones[s]?.pideTexto || !!p.textos[s].trim();
  const accCaja = p.enCaja ? acciones[p.enCaja] : null;
  return (
    <motion.article
      ref={ref}
      className={`tickets-bandeja__carta${p.enCaja ? ' tickets-bandeja__carta--escribe' : ''}`}
      style={{ x, y, rotate, opacity: opacidad }}
      drag={!p.enCaja}
      dragControls={controles}
      dragListener={false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={1}
      dragDirectionLock
      dragTransition={{ bounceStiffness: 520, bounceDamping: 26 }}
      onPointerDown={(e) => {
        arrastro.current = false;
        p.onTocar();
        if (saliendo.current || p.enCaja) return;
        const el = e.target as HTMLElement;
        // Ni sobre un control, ni sobre el «Detalle» abierto (ahí el dedo es del scroll del texto).
        if (el.closest('textarea, input, a, button, select, [data-sin-gesto]')) return;
        if (e.pointerType === 'touch' && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return;
        controles.start(e);
      }}
      onDragStart={() => { arrastro.current = true; }}
      onDragEnd={alSoltar}
      onClickCapture={comerClick}
      aria-label={`Ticket #${t.id}: ${quePaso(t)}`}
    >
      {acciones.derecha && (
        <motion.span className={`tickets-bandeja__sello tickets-bandeja__sello--derecha${listo('derecha') ? '' : ' tickets-bandeja__sello--falta'}`} style={{ opacity: selloSi }} aria-hidden>
          {acciones.derecha.rotulo}
        </motion.span>
      )}
      <motion.span className={`tickets-bandeja__sello tickets-bandeja__sello--izquierda${listo('izquierda') ? '' : ' tickets-bandeja__sello--falta'}`} style={{ opacity: selloNo }} aria-hidden>
        Rechazar
      </motion.span>
      {acciones.arriba && (
        <motion.span className={`tickets-bandeja__sello tickets-bandeja__sello--arriba${listo('arriba') ? '' : ' tickets-bandeja__sello--falta'}`} style={{ opacity: selloArriba }} aria-hidden>
          {acciones.arriba.rotulo}
        </motion.span>
      )}
      <TarjetaTicket t={t} ahora={p.ahora} onVerTodo={p.onVerTodo} />

      {/* La caja de lo que lee el cliente: tapa el pie de la tarjeta, no la agranda (la tarjeta no tiene scroll). */}
      {p.enCaja && accCaja && (
        <div className="tickets-bandeja__caja" role="group" aria-label={accCaja.rotulo}>
          <div className="tickets-bandeja__caja-cab">
            <b>{accCaja.rotulo}</b><span>lo lee el cliente</span>
            <button type="button" onClick={() => p.onCaja(null)} aria-label="Cerrar"><Icon name="x" size={16} /></button>
          </div>
          {(RESPUESTAS_GUARDADAS[accCaja.decision] ?? []).length > 0 && (
            <div className="tickets-bandeja__caja-guardadas">
              {(RESPUESTAS_GUARDADAS[accCaja.decision] ?? []).map((r) => (
                <button key={r} type="button" onClick={() => p.onTexto(p.enCaja!, r)}>{r}</button>
              ))}
            </div>
          )}
          <textarea rows={3} maxLength={2000} autoFocus value={p.textos[p.enCaja]} aria-label={`${accCaja.rotulo}: lo que lee el cliente`}
            placeholder={p.enCaja === 'izquierda' ? 'Por qué no se hace' : p.enCaja === 'arriba' ? 'Qué le preguntas' : 'La respuesta'}
            onChange={(e) => p.onTexto(p.enCaja!, e.target.value)} />
          <button type="button" className={`tickets-bandeja__caja-mandar tickets-bandeja__caja-mandar--${p.enCaja}`}
            disabled={!p.textos[p.enCaja].trim()} onClick={() => p.onDecidir(p.enCaja!)}>
            {accCaja.rotulo}
          </button>
        </div>
      )}
    </motion.article>
  );
}

// La de atrás: asoma por ARRIBA y crece a medida que la de adelante se va (el mazo viejo: el origen en el centro,
// para que no se meta detrás de los botones).
function CartaAtras({ t, ahora, progreso }: { t: FilaTicket; ahora: number; progreso: MotionValue<number> }) {
  const scale = useTransform(progreso, [0, 1], [0.95, 1]);
  const y = useTransform(progreso, [0, 1], [-10, 0]);
  return (
    <motion.article className="tickets-bandeja__carta tickets-bandeja__carta--atras" style={{ scale, y }} aria-hidden inert>
      <TarjetaTicket t={t} ahora={ahora} atras />
    </motion.article>
  );
}
