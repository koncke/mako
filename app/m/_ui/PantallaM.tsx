'use client';

// =============================================================================
// PantallaM — el cuerpo de una página de /m, con el pull-to-refresh propio
// =============================================================================
// El título grande lo dibuja el SHELL (v2: el nombre de la sección, 32/700, que se va al hacer
// scroll y deja el chico en la barra). PantallaM ya no dibuja títulos ni «Actualizado hh:mm»:
// la v2 los eliminó (docs/diseno-mako-mobile-v2.md, «Qué texto se elimina»). Las props `titulo`
// y `actualizado` de la v1 se BORRARON (no se ignoran): pasarlas no compila, que es la forma de
// que nadie vuelva a escribir un título-frase creyendo que se dibuja.
//
// Lo que sí hace: tirar hacia abajo desde arriba de todo para refrescar (`router.refresh()`).
//
// ⚠️ EL PULL ES CON EVENTOS `touch`, NO `pointer`. Con `touch-action: pan-y` (el
// default de una página que scrollea), el navegador se queda con el gesto vertical
// y manda `pointercancel` en cuanto empieza a «scrollear» — también arriba de
// todo, donde no hay nada que scrollear. Los `touchmove` siguen llegando. El
// rebote nativo no compite: /m apaga el overscroll vertical del documento
// (app/m/m.css), que además es lo que saca el pull-to-refresh de Chrome.
//
// ⚠️ LOS EVENTOS SE ESCUCHAN EN EL DOCUMENTO, NO EN EL DIV DE LA PÁGINA (14/10/2026). Martín
// deslizaba hacia abajo «como en cualquier app y no pasa nada»: el dedo caía en el título grande
// (lo dibuja el shell, fuera de esta página) o en el espacio vacío debajo de una lista corta, y ahí
// no había nadie escuchando. Ahora vale el gesto desde cualquier lugar de la pantalla, salvo:
//   · adentro de un sheet (se baja tirando: ese gesto es suyo);
//   · en un scroll anidado que NO está arriba de todo (la columna de un tablero, un hilo): tirar
//     ahí sube esa lista. Se pregunta subiendo por los ancestros, no por una marca: cualquier
//     contenedor con overflow que ya bajó se queda con el gesto.
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

/** ¿El dedo cayó en algo que se queda con el gesto vertical? Un sheet, o un scroll anidado que ya bajó. */
function otroDuenoDelGesto(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false;
  if (t.closest('.m-sheet-capa, [data-m-sin-pull]')) return true;
  for (let n: Element | null = t; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0) {
      const oy = getComputedStyle(n).overflowY;
      if (oy === 'auto' || oy === 'scroll') return true;
    }
  }
  return false;
}

export function PantallaM({ refrescable = false, children }: {
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
      // Un sheet o un scroll anidado que no está arriba de todo (la columna de un tablero) se
      // quedan con el gesto: tirar ahí baja el sheet o sube esa lista, no refresca la página.
      if (otroDuenoDelGesto(e.target)) { y0 = null; return; }
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
      tirando = false;
      cruzo = false;
      dist = 0;
    };
    const mover = (e: TouchEvent) => {
      if (y0 == null) return;
      // Un `touchmove` frenado es de otro dueño (la tarjeta que se arrastra en KanbanM): no tira.
      if (e.touches.length !== 1 || e.defaultPrevented) { y0 = null; if (tirando) { tirando = false; pintar(0, true); } return; }
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

    // En el documento (ver la cabecera): el título grande y el vacío de abajo también tiran.
    document.addEventListener('touchstart', inicio, { passive: true });
    document.addEventListener('touchmove', mover, { passive: true });
    document.addEventListener('touchend', fin, { passive: true });
    document.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      document.removeEventListener('touchstart', inicio);
      document.removeEventListener('touchmove', mover);
      document.removeEventListener('touchend', fin);
      document.removeEventListener('touchcancel', fin);
    };
    // `pintar` sólo toca refs; `router` es estable (app/_ui/Link lo memoiza).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refrescable, router]);

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
        {children}
      </div>
      {cargando && <span className="m-sr" role="status">Actualizando</span>}
    </div>
  );
}
