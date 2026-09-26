'use client';

// =============================================================================
// Modal — el DETALLE de algo, en su propia caja
// =============================================================================
// No es `Confirm` (eso es una pregunta de 440 px con dos botones) ni
// `WizardShell` (eso es un flujo de varios pasos). Esto es lo que faltaba: la
// caja donde se lee el detalle completo de una cosa y se decide qué hacer con
// ella.
//
// ⚠️ POR QUÉ EXISTE, Y NO ES UNA PREFERENCIA ESTÉTICA. Antes el detalle se
// desplegaba en el lugar, adentro de la tarjeta. Medido: el texto ocupaba
// 603 px dentro de una caja de 1134 — el 47% quedaba vacío a la derecha y el
// párrafo «se cortaba al medio de la card». La causa era un `max-width` puesto
// al texto adentro de un contenedor mucho más ancho, que es exactamente lo que
// AGENTS.md ya prohibía: «un maxWidth pegado a la izquierda es lo que deja la
// franja muerta».
//
// LA REGLA QUE SALE DE ESO, y es la razón de ser de este archivo:
//
//   **EL ÚNICO ANCHO MÁXIMO DEL DISEÑO VIVE EN ESTA CAJA.**
//   Nada de lo que va adentro lleva `max-width`: todo va al 100%.
//
// Es literal de cómo lo resuelven los que lo tienen resuelto. En shadcn/Radix
// el único ancho del componente está en el contenedor y adentro no hay ni uno.
// En Notion el `max-width` de la página se APAGA al entrar al peek. Y Linear
// cuenta en su changelog que tuvo este mismo problema: cuando la ventana crece
// CENTRAN el contenido en vez de dejar todo el hueco de un lado.
// Si alguna vez hace falta acotar la medida de lectura, se hace con
// `margin-inline: auto` —el sobrante se reparte— nunca con un ancho suelto.
//
// Las medidas salen de los sistemas que publican los números en su código:
// 600 px de ancho (Cloudscape «medium» 600, Polaris 620, Primer «xlarge» 640),
// alto `min(85vh, 720px)`, y header y pie FIJOS con el cuerpo como único que
// scrollea — que es la regla que comparten Polaris, Carbon, Primer y Atlassian
// palabra por palabra.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useCapaModal } from '@/app/_components/pila-modales';

/** Lo que puede recibir el foco adentro de la caja, para el ciclo del Tab. */
const FOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  titulo,
  encabezado,
  pie,
  onCerrar,
  children,
  ancho = 600,
  etiqueta,
  anidada = false,
}: {
  /** El título de la caja. Es el nombre de LA COSA, no una instrucción. */
  titulo: ReactNode;
  /** Va arriba del título, chico: el tipo de cosa que es (un estado, un rótulo). */
  encabezado?: ReactNode;
  /** Los botones. Van a la derecha, y el pie no scrollea. */
  pie?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  /** 440 para una frase · 600 por defecto · 720 si adentro va una lista larga. */
  ancho?: number;
  /** Para el lector de pantalla, si el título no es texto plano. */
  etiqueta?: string;
  /** ⚠️ Un diálogo que se abre DESDE UN CAMPO del modal de atrás, y que es parte de la misma
   *  tarea (el «Personalizado…» de la repetición). Con esto el de atrás NO se apaga: se ve
   *  detrás, como en cualquier app. Sin esto —el default— el de atrás desaparece, que es lo
   *  correcto cuando lo que se abre es OTRA pantalla, y es lo que hacía que elegir
   *  «Personalizado…» pareciera cerrar el detalle. */
  anidada?: boolean;
}) {
  const capa = useCapaModal(true, { anidada });
  const cajaRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    // De dónde venía el foco, para devolverlo al cerrar. Sin esto, quien navega
    // con teclado vuelve al principio de la página y pierde el lugar en la lista.
    const previo = document.activeElement as HTMLElement | null;
    cajaRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); return; }
      if (e.key !== 'Tab') return;
      // El ciclo del Tab se cierra adentro de la caja: un modal del que te podés
      // ir con Tab a la página de atrás no es modal para quien usa teclado.
      const focables = cajaRef.current?.querySelectorAll<HTMLElement>(FOCABLES);
      if (!focables?.length) return;
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === cajaRef.current)) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primero.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previo?.focus?.();
    };
  }, [onCerrar]);

  // El fondo no scrollea mientras hay un modal, pero lo bloquea SOLO el primero:
  // con dos abiertos, el de arriba al cerrarse devolvería el scroll con el de
  // abajo todavía puesto.
  useEffect(() => {
    if (!capa.esElPrimero) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, [capa.esElPrimero]);

  return (
    <div
      className="mk-modal__fondo"
      // `display: none` y NO desmontar: es la regla de la pila de modales. Un
      // modal desmontado pierde lo que tenía adentro a medio hacer.
      style={{ zIndex: capa.z, display: capa.visible ? 'flex' : 'none' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div
        ref={cajaRef}
        className="mk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-label={etiqueta}
        tabIndex={-1}
        style={{ maxWidth: ancho }}
      >
        <div className="mk-modal__cab">
          <div className="mk-modal__tit">
            {encabezado}
            <h2 id={tituloId} className="mk-modal__h">{titulo}</h2>
          </div>
          <button type="button" className="mk-modal__x" onClick={onCerrar} aria-label="Cerrar">
            <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden focusable="false">
              <path d="M3.5 3.5l8 8m0-8l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* El ÚNICO que scrollea. `minHeight: 0` es lo que lo permite dentro de
            un flex column: sin eso el hijo crece y el que scrollea termina
            siendo la página, con el pie empujado fuera de la pantalla. */}
        <div className="mk-modal__cuerpo" ref={capa.refScroll}>{children}</div>

        {pie && <div className="mk-modal__pie">{pie}</div>}
      </div>
    </div>
  );
}
