'use client';

// =============================================================================
// PantallaM — el encabezado de una página de /m, y el pull-to-refresh propio
// =============================================================================
// Va adentro del contenido (el header oscuro de arriba es del shell). Lleva:
//   · un título grande opcional (26/600) — la frase héroe de Today, por ejemplo;
//   · «Actualizado 10:42» arriba de cada lista viva;
//   · tirar hacia abajo desde arriba de todo para refrescar (`router.refresh()`).
//
// ⚠️ EL PULL ES CON EVENTOS `touch`, NO `pointer`. Con `touch-action: pan-y` (el
// default de una página que scrollea), el navegador se queda con el gesto vertical
// y manda `pointercancel` en cuanto empieza a «scrollear» — también arriba de
// todo, donde no hay nada que scrollear. Los `touchmove` siguen llegando. El
// rebote nativo no compite: /m apaga el overscroll vertical del documento
// (app/m/m.css), que además es lo que saca el pull-to-refresh de Chrome.
//
// Física (app/m/_ui/gestos.ts): resistencia de rubber-band desde el primer px,
// se dispara a los 64 px (con un tic háptico al cruzar), se queda en 48 mientras
// carga y se pliega en 200 ms. Sin red no refresca: vuelve y la cinta ya dice por qué.
// =============================================================================

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { distanciaDePull, ejeDelGesto, RETENCION_PULL, UMBRAL_PULL } from './gestos';
import { useShellM } from './contexto';
import { HoraM } from './HoraM';

export function PantallaM({ titulo, actualizado, refrescable = false, children }: {
  /** El título grande de la pantalla (h2). El nombre del destino ya está en el header. */
  titulo?: ReactNode;
  /**
   * Cuándo se leyeron los datos (lo pasa el server: `new Date()` al leer). Si no
   * viene y la pantalla es refrescable, se muestra la hora de la última carga.
   */
  actualizado?: Date | number | string | null;
  /** Tirar hacia abajo para refrescar: Today, Inbox, CRM y Plan. Nunca el chat ni un sheet. */
  refrescable?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const { marcarCarga, conexion } = useShellM();
  const [pendiente, empezar] = useTransition();
  const [cargando, setCargando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const mueve = useRef<HTMLDivElement>(null);
  const ico = useRef<HTMLSpanElement>(null);
  const cargandoRef = useRef(false);
  const vioPendiente = useRef(false);
  const enLineaRef = useRef(conexion.enLinea);
  enLineaRef.current = conexion.enLinea;

  const pintar = (d: number, animar: boolean) => {
    const sinMovimiento = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = animar && !sinMovimiento ? '200ms' : '0ms';
    const m = mueve.current;
    if (m) {
      m.style.transition = `transform ${t} var(--ease-out)`;
      // En reposo, SIN transform: uno puesto convierte este nodo en el contenedor
      // de todo lo `position: fixed` que la página tenga adentro.
      m.style.transform = d > 0 ? `translateY(${d}px)` : '';
    }
    const i = ico.current;
    if (i) {
      i.style.transition = `opacity ${t} var(--ease-out)`;
      i.style.opacity = String(Math.min(1, d / UMBRAL_PULL));
      if (!cargandoRef.current) i.style.transform = `rotate(${Math.round(d * 4)}deg)`;
    }
  };

  // Termina la carga cuando el refresh de verdad terminó (no con un timer que adivina).
  const terminar = () => {
    vioPendiente.current = false;
    cargandoRef.current = false;
    setCargando(false);
    marcarCarga();
    pintar(0, true);
  };
  useEffect(() => {
    if (!cargando) return;
    if (pendiente) { vioPendiente.current = true; return; }
    if (vioPendiente.current) { terminar(); return; }
    // Red de seguridad: si la transición no llegó a marcarse pendiente (un refresh
    // que contestó del caché) o se quedó colgada, el aro no gira para siempre.
    const nunca = setTimeout(() => { if (!vioPendiente.current) terminar(); }, 1200);
    return () => clearTimeout(nunca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, pendiente]);
  useEffect(() => {
    if (!cargando) return;
    const tope = setTimeout(() => { if (cargandoRef.current) terminar(); }, 15_000);
    return () => clearTimeout(tope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  useEffect(() => {
    if (!refrescable) return;
    const el = raiz.current;
    if (!el) return;
    let y0: number | null = null;
    let x0 = 0;
    let tirando = false;
    let dist = 0;
    let cruzo = false;

    const inicio = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || cargandoRef.current) { y0 = null; return; }
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
      tirando = false;
      cruzo = false;
      dist = 0;
    };
    const mover = (e: TouchEvent) => {
      if (y0 == null) return;
      if (e.touches.length !== 1) { y0 = null; if (tirando) { tirando = false; pintar(0, true); } return; }
      const dy = e.touches[0].clientY - y0;
      const dx = e.touches[0].clientX - x0;
      if (!tirando) {
        const eje = ejeDelGesto(dx, dy);
        if (!eje) return;
        if (eje !== 'y' || dy <= 0 || window.scrollY > 0) { y0 = null; return; }
        tirando = true;
      }
      dist = distanciaDePull(dy, window.innerHeight);
      pintar(dist, false);
      if (!cruzo && dist >= UMBRAL_PULL) { cruzo = true; haptico('light'); }
      else if (cruzo && dist < UMBRAL_PULL) cruzo = false;
    };
    const fin = () => {
      const tiro = tirando;
      y0 = null;
      tirando = false;
      if (!tiro) return;
      if (dist >= UMBRAL_PULL && enLineaRef.current) {
        cargandoRef.current = true;
        vioPendiente.current = false;
        setCargando(true);
        pintar(RETENCION_PULL, true);
        empezar(() => router.refresh());
      } else {
        pintar(0, true);
      }
      dist = 0;
    };

    el.addEventListener('touchstart', inicio, { passive: true });
    el.addEventListener('touchmove', mover, { passive: true });
    el.addEventListener('touchend', fin, { passive: true });
    el.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      el.removeEventListener('touchstart', inicio);
      el.removeEventListener('touchmove', mover);
      el.removeEventListener('touchend', fin);
      el.removeEventListener('touchcancel', fin);
    };
    // `pintar` sólo toca refs; `router` es estable (app/_ui/Link lo memoiza).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refrescable, router]);

  const momento = actualizado ?? (refrescable ? conexion.datosDe : null);
  const hora = momento != null ? <HoraM momento={momento} /> : null;

  return (
    <div className="m-pantalla" ref={raiz}>
      {refrescable && (
        <div className="m-pull" aria-hidden>
          <span
            ref={ico}
            className="mk-spin m-pull__ico"
            // Mientras se tira, el aro gira con el dedo; cargando, gira solo.
            style={cargando ? undefined : { animation: 'none' }}
          />
        </div>
      )}
      <div ref={mueve}>
        {titulo != null ? (
          <div className="m-pantalla__cab">
            <h2 className="m-pantalla__titulo">{titulo}</h2>
            {hora}
          </div>
        ) : hora ? (
          <div className="m-pantalla__cab m-pantalla__cab--solo">{hora}</div>
        ) : null}
        {children}
      </div>
      {cargando && <span className="m-sr" role="status">Actualizando</span>}
    </div>
  );
}
