'use client';

// =============================================================================
// SheetM — la hoja que sube desde abajo (agendar, adjuntar, el detalle de una aprobación)
// =============================================================================
// Para tareas TRANSITORIAS con contexto detrás. Nunca como página y nunca dos a la
// vez: abrir una REEMPLAZA a la que estaba (nunca apiladas, Budiu/NN/g).
//
//   [ grabber ]
//   Título ........................ Cerrar
//   cuerpo (scroll propio, overscroll contain)
//   pie fijo: la advertencia pegada arriba del botón primario, y la salida debajo
//
// Gestos (app/m/_ui/gestos.ts): se arrastra 1:1 desde el grabber o la cabecera,
// o desde el cuerpo cuando está arriba de todo y se tira hacia abajo. Pasado el
// tope, rubber-band 0,55. Al soltar, el destino sale de PROYECTAR la velocidad, y
// un flick > 0,11 px/ms hacia abajo cierra aunque no se haya pasado de la mitad.
// Abre en 320 ms y cierra en 220 ms con --ease-drawer; con movimiento reducido
// aparece y se va con un fundido de 200 ms (el arrastre sigue 1:1: lo mueve el dedo).
//
// ⚠️ `setPointerCapture` SE PIDE RECIÉN CUANDO EL DEDO SE MOVIÓ 10 px, no en el
// pointerdown: la captura RETARGETEA el pointerup al nodo que capturó, y el click
// cae en el ancestro común — o sea que el botón «Cerrar» de la cabecera dejaba de
// recibir su click (AGENTS.md, el gesto de un lienzo). Un toque sin arrastre no
// captura nada y el botón funciona.
//
// El «atrás» de Android (y el del navegador) CIERRA la hoja: abrirla pone
// `?sheet=<id>` en la URL con `history.pushState`, que Next integra a su router
// (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-
// navigating.md). Cerrarla con un gesto equivale a «atrás»; cerrarla desde el
// código (después de enviar, por ejemplo) saca el parámetro con `replaceState`.
//
// `ocupado`: mientras se envía, la hoja no se cierra por el velo, el arrastre, el
// botón ni el «atrás» — una aprobación a medio mandar no se abandona por un roce.
// =============================================================================

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { shadow } from '@/app/_ui/tokens';
import { destinoDelSheet, ejeDelGesto, HISTERESIS, rubberband, velocidadDe, type Muestra, type SnapSheet } from './gestos';

type Snap = 'medio' | 'alto';

export type SheetMProps = {
  abierto: boolean;
  /** Lo llama la hoja cuando la persona la cierra (botón, velo, arrastre, «atrás»). */
  onCerrar: () => void;
  titulo: string;
  children?: ReactNode;
  /** El pie fijo: la advertencia + el botón primario + la salida, apilados. */
  pie?: ReactNode;
  /** Dónde abre. «medio» = 55% de la pantalla; «alto» = casi toda. */
  snap?: Snap;
  /** Los altos a los que puede ir. Por defecto: los dos si abre en medio, sólo alto si abre en alto. */
  snaps?: Snap[];
  /** Enviando: no se cierra por ningún camino y el botón Cerrar queda apagado. */
  ocupado?: boolean;
  /** El nombre en la URL (`?sheet=agendar`). Uno por tipo de hoja. */
  id?: string;
  rotuloCerrar?: string;
};

// ── El historial: «atrás» cierra, y nunca hay dos hojas ─────────────────────
const PARAM = 'sheet';
// `clave` es la INSTANCIA, no el id: dos hojas con el mismo nombre siguen siendo dos.
type Registro = { id: string; clave: object; cerrarYa: () => void; ocupado: () => boolean };
let activa: Registro | null = null;
let entradaPropia = false;
let ignorarPop = 0;
let escuchando = false;

function urlCon(id: string | null): string {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set(PARAM, id); else u.searchParams.delete(PARAM);
  return u.pathname + u.search + u.hash;
}
function hojaEnUrl(): string | null {
  try { return new URL(window.location.href).searchParams.get(PARAM); } catch { return null; }
}
function escucharAtras() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  window.addEventListener('popstate', () => {
    if (ignorarPop > 0) { ignorarPop -= 1; return; }
    if (!activa) { entradaPropia = false; return; }
    if (hojaEnUrl() === activa.id) return;
    entradaPropia = false;
    if (activa.ocupado()) {
      // Enviando: el «atrás» no la cierra. Se vuelve a poner la entrada.
      window.history.pushState(null, '', urlCon(activa.id));
      entradaPropia = true;
      return;
    }
    const a = activa;
    activa = null;
    a.cerrarYa();
  });
}
function registrarApertura(r: Registro) {
  escucharAtras();
  if (activa && activa.clave !== r.clave) {
    // Una hoja sobre otra REEMPLAZA: la de antes se cierra y la entrada del
    // historial pasa a ser de la nueva (un «atrás» no tiene que pasar por las dos).
    const previa = activa;
    activa = null;
    previa.cerrarYa();
    if (entradaPropia) { window.history.replaceState(null, '', urlCon(r.id)); activa = r; return; }
  }
  activa = r;
  if (!entradaPropia) {
    window.history.pushState(null, '', urlCon(r.id));
    entradaPropia = true;
  }
}
/** La persona la cerró (botón, velo, arrastre): es lo mismo que «atrás». */
function soltarPorGesto(id: string, clave: object) {
  if (activa?.clave === clave) activa = null;
  if (entradaPropia && hojaEnUrl() === id) {
    entradaPropia = false;
    ignorarPop += 1;
    window.history.back();
  } else if (hojaEnUrl() === id) {
    window.history.replaceState(null, '', urlCon(null));
  }
}
/**
 * La cerró el código (el que la abrió puso `abierto=false`). Se saca el parámetro
 * con replaceState y NO con `back()`: un `back()` es asíncrono, y si la pantalla
 * navega en el mismo tick, deshace esa navegación. El costo es una entrada de más
 * en el historial con la misma URL, que es el menor de los dos.
 */
function soltarPorCodigo(id: string, clave: object) {
  if (activa?.clave === clave) activa = null;
  if (hojaEnUrl() === id) window.history.replaceState(null, '', urlCon(null));
  entradaPropia = false;
}

function tyActual(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  try { return new DOMMatrixReadOnly(t).m42; } catch { return 0; }
}
function sinMovimiento(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function SheetM({
  abierto, onCerrar, titulo, children, pie, snap = 'medio', snaps, ocupado = false, id = 'detalle', rotuloCerrar = 'Cerrar',
}: SheetMProps) {
  const permitidos: Snap[] = snaps && snaps.length ? snaps : snap === 'alto' ? ['alto'] : ['medio', 'alto'];
  const tope: Snap = permitidos.includes('alto') ? 'alto' : 'medio';
  const inicial: Snap = permitidos.includes(snap) ? snap : tope;

  const [montada, setMontada] = useState(abierto);
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const actual = useRef<Snap>(inicial);
  const offset = useRef(0);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const ocupadoRef = useRef(ocupado);
  ocupadoRef.current = ocupado;
  const permitidosRef = useRef(permitidos);
  permitidosRef.current = permitidos;
  const porGesto = useRef(false);
  const foco = useRef<Element | null>(null);
  const tituloId = useId();
  const clave = useRef<object>({});
  const arrastre = useRef<{ y0: number; o0: number; muestras: Muestra[] } | null>(null);
  const pendiente = useRef<{ id: number; y0: number; x0: number } | null>(null);

  useEffect(() => { setCapa(document.getElementById('m-capas') ?? document.body); }, []);
  useEffect(() => { if (abierto) setMontada(true); }, [abierto]);

  // ── Medidas: el panel mide lo del snap más alto; los otros son un corrimiento ──
  const medir = useCallback(() => {
    const el = panel.current;
    if (!el) return null;
    const hPanel = el.offsetHeight;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const p = permitidosRef.current;
    const hMedio = p.includes('medio') ? Math.min(hPanel, Math.round(vh * 0.55)) : undefined;
    const hAlto = p.includes('alto') ? hPanel : undefined;
    return { hPanel, hMedio, hAlto };
  }, []);
  const offsetDe = (s: SnapSheet, m: { hPanel: number; hMedio?: number }) =>
    s === 'cerrado' ? m.hPanel : s === 'alto' ? 0 : m.hPanel - (m.hMedio ?? m.hPanel);

  const aplicar = useCallback((o: number, ms: number) => {
    const el = panel.current;
    const m = medir();
    if (!el || !m) return;
    offset.current = o;
    const t = ms ? `transform ${ms}ms var(--ease-drawer)` : 'none';
    el.style.transition = t;
    el.style.transform = `translateY(${o}px)`;
    // En «medio» el panel está corrido hacia abajo: el pie se corre hacia ARRIBA lo
    // mismo para quedar a la vista. Por debajo de «medio» (cerrando) baja con todo.
    const oMedio = m.hMedio != null && m.hMedio < m.hPanel ? m.hPanel - m.hMedio : 0;
    const comp = oMedio ? -Math.min(Math.max(o, 0), oMedio) : 0;
    if (pieRef.current) {
      pieRef.current.style.transition = t;
      pieRef.current.style.transform = comp ? `translateY(${comp}px)` : '';
    }
    if (velo.current) {
      const bajo = m.hMedio ?? m.hPanel;
      velo.current.style.transition = ms ? `opacity ${ms}ms var(--ease-drawer)` : 'none';
      velo.current.style.opacity = String(Math.max(0, Math.min(1, (m.hPanel - o) / bajo)));
    }
  }, [medir]);

  const pedirCierre = useCallback(() => {
    if (ocupadoRef.current) {
      const m = medir();
      if (m) aplicar(offsetDe(actual.current, m), sinMovimiento() ? 0 : 320);
      return;
    }
    porGesto.current = true;
    soltarPorGesto(id, clave.current);
    onCerrarRef.current();
  }, [aplicar, medir, id]);

  // ── Abrir ───────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!montada || !abierto || !capa) return;
    const el = panel.current;
    const m = medir();
    if (!el || !m) return;
    foco.current = document.activeElement;
    registrarApertura({
      id,
      clave: clave.current,
      cerrarYa: () => { porGesto.current = true; onCerrarRef.current(); },
      ocupado: () => ocupadoRef.current,
    });
    actual.current = inicial;
    const destino = offsetDe(inicial, m);
    if (sinMovimiento()) {
      aplicar(destino, 0);
      el.style.opacity = '0';
      el.getBoundingClientRect();
      el.style.transition = 'opacity 200ms linear';
      el.style.opacity = '1';
    } else {
      // Desde donde ESTÁ (recién montada: abajo de todo; si se estaba cerrando, desde ahí).
      aplicar(tyActual(el) || m.hPanel, 0);
      el.getBoundingClientRect();
      aplicar(destino, 320);
    }
    el.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montada, abierto, capa]);

  // ── Cerrar (por la persona o por el código) ─────────────────────────────
  useEffect(() => {
    if (abierto || !montada) return;
    if (!porGesto.current) soltarPorCodigo(id, clave.current);
    porGesto.current = false;
    const el = panel.current;
    const m = medir();
    let t: ReturnType<typeof setTimeout>;
    if (!el || !m) {
      setMontada(false);
    } else if (sinMovimiento()) {
      el.style.transition = 'opacity 200ms linear';
      el.style.opacity = '0';
      if (velo.current) { velo.current.style.transition = 'opacity 200ms linear'; velo.current.style.opacity = '0'; }
      t = setTimeout(() => setMontada(false), 200);
    } else {
      aplicar(m.hPanel, 220);
      t = setTimeout(() => setMontada(false), 230);
    }
    const previo = foco.current as HTMLElement | null;
    if (previo?.isConnected && typeof previo.focus === 'function') previo.focus({ preventScroll: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Si la pantalla se va con la hoja abierta (navegó a otro lado), sólo se suelta el
  // registro: tocar el historial acá podría deshacer la navegación en curso.
  useEffect(() => () => {
    if (activa?.clave !== clave.current) return;
    activa = null;
    entradaPropia = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape (un teclado conectado) cierra como el botón.
  useEffect(() => {
    if (!montada || !abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); pedirCierre(); } };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [montada, abierto, pedirCierre]);

  // ── El arrastre ─────────────────────────────────────────────────────────
  const iniciar = (y: number, t: number) => {
    const el = panel.current;
    if (!el) return;
    const o0 = tyActual(el); // desde donde está AHORA (puede estar a mitad de una animación)
    arrastre.current = { y0: y, o0, muestras: [{ v: y, t }] };
    aplicar(o0, 0);
  };
  const moverA = (y: number, t: number) => {
    const a = arrastre.current;
    const m = medir();
    if (!a || !m) return;
    let o = a.o0 + (y - a.y0);
    if (o < 0) o = rubberband(o, m.hPanel);
    aplicar(o, 0);
    a.muestras.push({ v: y, t });
    if (a.muestras.length > 8) a.muestras.shift();
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    const m = medir();
    if (!a || !m) return;
    let destino = destinoDelSheet({
      visible: m.hPanel - offset.current,
      velocidad: velocidadDe(a.muestras),
      alturas: { medio: m.hMedio, alto: m.hAlto },
      desde: actual.current,
    });
    if (destino === 'cerrado') {
      if (!ocupadoRef.current) { pedirCierre(); return; }
      destino = permitidosRef.current.includes('medio') ? 'medio' : 'alto';
    }
    actual.current = destino;
    aplicar(offsetDe(destino, m), sinMovimiento() ? 0 : 320);
  };

  // Desde el grabber y la cabecera: pointer events (ahí `touch-action: none`).
  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button, a, input, textarea, select')) return;
    if (pendiente.current || arrastre.current) return; // un segundo dedo no toma el control
    pendiente.current = { id: e.pointerId, y0: e.clientY, x0: e.clientX };
  };
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const p = pendiente.current;
    if (!p || e.pointerId !== p.id) return;
    if (!arrastre.current) {
      if (Math.abs(e.clientY - p.y0) < HISTERESIS) return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ya no existe */ }
      iniciar(p.y0, e.timeStamp);
    }
    moverA(e.clientY, e.timeStamp);
  };
  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    const p = pendiente.current;
    if (!p || e.pointerId !== p.id) return;
    pendiente.current = null;
    if (arrastre.current) soltar();
  };
  const gestos = { onPointerDown: alBajar, onPointerMove: alMover, onPointerUp: alSoltar, onPointerCancel: alSoltar };

  // Desde el cuerpo: eventos touch (el navegador se queda con el pan vertical y
  // mandaría pointercancel). Sólo arriba de todo y tirando hacia abajo.
  useEffect(() => {
    const c = cuerpo.current;
    if (!c || !montada || !capa) return;
    let t0: { x: number; y: number } | null = null;
    let tomado = false;
    const inicio = (e: TouchEvent) => {
      if (e.touches.length !== 1 || arrastre.current) { t0 = null; return; }
      t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      tomado = false;
    };
    const mover = (e: TouchEvent) => {
      if (!t0) return;
      if (e.touches.length !== 1) { t0 = null; if (tomado) { tomado = false; soltar(); } return; }
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (!tomado) {
        const dy = y - t0.y;
        // En iOS, si el primer touchmove no se frena, el scroll arranca y los
        // siguientes ya no se pueden cancelar: arriba de todo y hacia abajo, se frena YA.
        if (c.scrollTop <= 0 && dy > 0 && e.cancelable) e.preventDefault();
        const eje = ejeDelGesto(x - t0.x, dy);
        if (!eje) return;
        if (eje !== 'y' || dy <= 0 || c.scrollTop > 0) { t0 = null; return; }
        tomado = true;
        iniciar(t0.y, e.timeStamp);
      }
      if (e.cancelable) e.preventDefault();
      moverA(y, e.timeStamp);
    };
    const fin = () => { if (tomado) soltar(); t0 = null; tomado = false; };
    c.addEventListener('touchstart', inicio, { passive: true });
    c.addEventListener('touchmove', mover, { passive: false });
    c.addEventListener('touchend', fin, { passive: true });
    c.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      c.removeEventListener('touchstart', inicio);
      c.removeEventListener('touchmove', mover);
      c.removeEventListener('touchend', fin);
      c.removeEventListener('touchcancel', fin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montada, capa]);

  if (!montada || !capa) return null;

  return createPortal(
    <div className="m-sheet-capa">
      <div ref={velo} className="m-sheet__velo" onClick={() => { if (!ocupadoRef.current) pedirCierre(); }} aria-hidden />
      <div
        ref={panel}
        className="m-sheet"
        data-tope={tope}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        style={{ boxShadow: shadow.modal }}
      >
        <div className="m-sheet__agarre" {...gestos} aria-hidden>
          <span className="m-sheet__grabber" />
        </div>
        <div className="m-sheet__cab" {...gestos}>
          <h2 className="m-sheet__titulo" id={tituloId}>{titulo}</h2>
          <button type="button" className="m-sheet__cerrar" onClick={pedirCierre} disabled={ocupado}>{rotuloCerrar}</button>
        </div>
        <div ref={cuerpo} className="m-sheet__cuerpo">{children}</div>
        {pie != null && <div ref={pieRef} className="m-sheet__pie">{pie}</div>}
      </div>
    </div>,
    capa,
  );
}
