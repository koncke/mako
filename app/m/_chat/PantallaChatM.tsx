'use client';

// =============================================================================
// PantallaChatM — una conversación del teléfono A PANTALLA COMPLETA, como WhatsApp (13/11/2026)
// =============================================================================
// Martín aprobó el prototipo (https://claude.ai/artifact/W5vqkTgaaCLsMKwGnGaByM, docs/prototipos/mako-mobile-chat.html): el chat
// con MaKo, el grupo del negocio y cada chat de la lista se abren como en WhatsApp, no en una hoja con asa y ✕. Medido el 3/11 en
// producción: la hoja dejaba ver la página atrás y la caja ocupaba el 23 % de la pantalla.
//
//   [←] [foto] Nombre ...................................... (acción)
//   la conversación (scroll propio; el fondo es el del chat)
//   la caja, pegada abajo
//
// Lo que copia de WhatsApp: entra deslizándose desde la derecha (300 ms) y se va igual (220 ms); el «atrás» de Android, la
// flecha, Escape y deslizar desde el borde izquierdo la cierran. Con movimiento reducido, un fundido.
//
// ⚠️ LA MISMA FIRMA QUE SheetM (`abierto`, `onCerrar`, `titulo`, `pie`, `id`, `ocupado`): las pantallas la cambian por la hoja sin
// tocar su motor. Y el MISMO historial (./../_ui/hoja-historial.ts): abrirla pone `?sheet=<id>`, el «atrás» la cierra, y una hoja
// que se abra arriba la REEMPLAZA (nunca dos). Por eso lo que se abre ADENTRO de una conversación (Participantes, la Info, tus
// cuentas de IA) sigue yendo adentro, con su «‹», como hasta hoy.
// ⚠️ El cuerpo lleva `m-chat__cuerpo`: es lo que scrollea. Quien sigue la conversación lo busca con `closest(CUERPO_CHAT)`.
// ⚠️ El aspecto de WhatsApp vive en ./chat-wa.css con alcance `[data-m] .m-wa`: el hilo y la caja son los de toda la app
// (HiloMako, CajaChat) y la computadora no cambia.
// =============================================================================

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { velocidadDe, type Muestra } from '@/app/m/_ui/gestos';
import { BORDE_PX, cierraAlSoltar } from './pantalla-chat';
import { registrarApertura, soltarAlDesmontar, soltarPorCodigo, soltarPorGesto } from '@/app/m/_ui/hoja-historial';
import './chat-wa.css';

export { CUERPO_CHAT, BORDE_PX, UMBRAL_CIERRE, cierraAlSoltar } from './pantalla-chat';
const MS_ENTRA = 300;
const MS_SALE = 220;

function sinMovimiento(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function PantallaChatM({ abierto, onCerrar, titulo, children, pie, id = 'chat', ocupado = false, grupo = false, accion }: {
  abierto: boolean;
  /** Lo llama la pantalla cuando la persona vuelve (flecha, «atrás», borde, Escape). */
  onCerrar: () => void;
  /** La cabecera: la foto y el nombre (y quiénes están, en un grupo). Se toca si la pantalla lo pide. */
  titulo: ReactNode;
  children?: ReactNode;
  /** La caja, pegada abajo. */
  pie?: ReactNode;
  /** El nombre en la URL (`?sheet=`). */
  id?: string;
  /** Mandando: no se vuelve por ningún camino. */
  ocupado?: boolean;
  /** Un grupo: cada mensaje de otro lleva su foto y su nombre. */
  grupo?: boolean;
  /** A la derecha de la cabecera (Invitar, la ficha). */
  accion?: ReactNode;
}) {
  const [montada, setMontada] = useState(abierto);
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const ocupadoRef = useRef(ocupado);
  ocupadoRef.current = ocupado;
  const porGesto = useRef(false);
  const clave = useRef<object>({});
  const foco = useRef<Element | null>(null);
  const tituloId = useId();
  const arrastre = useRef<{ id: number; x0: number; muestras: Muestra[]; tomado: boolean } | null>(null);

  useEffect(() => { setCapa(document.getElementById('m-capas') ?? document.body); }, []);
  useEffect(() => { if (abierto) setMontada(true); }, [abierto]);

  const mover = useCallback((x: number, ms: number) => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms var(--ease-drawer)` : 'none';
    el.style.transform = x ? `translateX(${x}px)` : 'translateX(0)';
  }, []);

  const pedirCierre = useCallback(() => {
    if (ocupadoRef.current) { mover(0, sinMovimiento() ? 0 : MS_ENTRA); return; }
    porGesto.current = true;
    soltarPorGesto(id, clave.current);
    onCerrarRef.current();
  }, [id, mover]);

  // ── Entrar ──────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!montada || !abierto || !capa) return;
    const el = panel.current;
    if (!el) return;
    foco.current = document.activeElement;
    registrarApertura({ id, clave: clave.current, cerrarYa: () => { porGesto.current = true; onCerrarRef.current(); }, ocupado: () => ocupadoRef.current });
    if (sinMovimiento()) {
      mover(0, 0);
      el.style.opacity = '0';
      el.getBoundingClientRect();
      el.style.transition = 'opacity 200ms linear';
      el.style.opacity = '1';
    } else {
      mover(el.offsetWidth, 0);
      el.getBoundingClientRect();
      mover(0, MS_ENTRA);
    }
    el.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montada, abierto, capa]);

  // ── Salir (por la persona o por el código) ──────────────────────────────
  useEffect(() => {
    if (abierto || !montada) return;
    if (!porGesto.current) soltarPorCodigo(id, clave.current);
    porGesto.current = false;
    const el = panel.current;
    let t: ReturnType<typeof setTimeout>;
    if (!el) setMontada(false);
    else if (sinMovimiento()) {
      el.style.transition = 'opacity 200ms linear';
      el.style.opacity = '0';
      t = setTimeout(() => setMontada(false), 200);
    } else {
      mover(el.offsetWidth, MS_SALE);
      t = setTimeout(() => setMontada(false), MS_SALE + 10);
    }
    const previo = foco.current as HTMLElement | null;
    if (previo?.isConnected && typeof previo.focus === 'function') previo.focus({ preventScroll: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Si la página se va con la conversación abierta, sólo se suelta el registro (tocar el historial desharía la navegación).
  useEffect(() => () => soltarAlDesmontar(clave.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  useEffect(() => {
    if (!montada || !abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); pedirCierre(); } };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [montada, abierto, pedirCierre]);

  // ── Deslizar desde el borde izquierdo ───────────────────────────────────
  // La captura se pide recién cuando el dedo se movió (la regla de SheetM): un toque en el borde sigue siendo un toque.
  const alBajar = (e: PointerEvent<HTMLElement>) => {
    if (arrastre.current || e.pointerType === 'mouse') return;
    const izq = panel.current?.getBoundingClientRect().left ?? 0;
    if (e.clientX - izq > BORDE_PX) return;
    arrastre.current = { id: e.pointerId, x0: e.clientX, muestras: [{ v: e.clientX, t: e.timeStamp }], tomado: false };
  };
  const alMover = (e: PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x0;
    if (!a.tomado) {
      if (dx < 10) return;
      a.tomado = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ya no está */ }
    }
    mover(Math.max(0, dx), 0);
    a.muestras.push({ v: e.clientX, t: e.timeStamp });
    if (a.muestras.length > 8) a.muestras.shift();
  };
  const alSoltar = (e: PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    arrastre.current = null;
    if (!a.tomado) return;
    const ancho = panel.current?.offsetWidth ?? 0;
    if (cierraAlSoltar(Math.max(0, e.clientX - a.x0), ancho, velocidadDe(a.muestras)) && !ocupadoRef.current) pedirCierre();
    else mover(0, sinMovimiento() ? 0 : MS_SALE);
  };

  if (!montada || !capa) return null;
  const saliendo = !abierto;
  return createPortal(
    <div className="m-chat-capa">
      <section ref={panel} className={`m-chat m-wa${grupo ? ' m-wa--grupo' : ''}`} inert={saliendo} role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1}
        onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
        <header className="m-chat__cab">
          <button type="button" className="m-chat__volver" onClick={pedirCierre} disabled={ocupado} aria-label="Volver">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          </button>
          <div className="m-chat__titulo" id={tituloId}>{titulo}</div>
          {accion}
        </header>
        <div className="m-chat__cuerpo">{children}</div>
        {pie != null && <div className="m-chat__pie">{pie}</div>}
      </section>
    </div>,
    capa,
  );
}
