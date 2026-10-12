'use client';

// =============================================================================
// Los controles de la v2: el segmentado, el interruptor y el pie fijo de una pantalla
// =============================================================================
// Anatomía del prototipo (docs/prototipos/mako-mobile-v2.html: .seg, .sw, .pie-fijo).
//
//   <SegmentadoM etiqueta="Vista" valor={v} onCambio={setV}
//     opciones={[{ id: 'decidir', label: 'Para decidir', n: 3 }, { id: 'avisos', label: 'Avisos' }]} />
//   <SegmentadoM etiqueta="Hoja" valor="mkt"                  // con links (página de server)
//     opciones={[{ id: 'mkt', label: 'Marketing', href: '/m/dashboard' }, …]} />
//   <InterruptorM etiqueta="Activa" activo={on} onCambio={cambiar} />
//   <PieFijoM consecuencia="Filmar de nuevo cuesta 12 créditos.">
//     <Button variant="primary" size="lg" full>…</Button>
//   </PieFijoM>
// =============================================================================

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { PieM } from './Piezas';

export type OpcionSegmentado<T extends string> = {
  id: T;
  label: string;
  /** Un número azul al lado (sólo lo que bloquea, como el badge de la barra). */
  n?: number | null;
  /** Con `href`, la opción es un link (el valor vive en la URL y la página es de server). */
  href?: string;
};

/** El control de dos o tres opciones. Cambiar no anima la pantalla: es la misma pantalla. */
export function SegmentadoM<T extends string>({ opciones, valor, onCambio, etiqueta }: {
  opciones: OpcionSegmentado<T>[];
  valor: T;
  onCambio?: (v: T) => void;
  /** Qué elige («Vista», «Período», «Hoja»): para el lector de pantalla. */
  etiqueta: string;
}) {
  return (
    <div className="m-seg" role="group" aria-label={etiqueta}>
      {opciones.map((o) => {
        const es = o.id === valor;
        const dentro = (
          <>
            <span className="m-seg__txt">{o.label}</span>
            {o.n ? <span className="m-seg__n">{o.n > 99 ? '99+' : o.n}</span> : null}
          </>
        );
        return o.href ? (
          <Link key={o.id} href={o.href} className="m-seg__op" aria-current={es ? 'page' : undefined}
            onClick={() => { if (!es) haptico('light'); }}>
            {dentro}
          </Link>
        ) : (
          <button key={o.id} type="button" className="m-seg__op" aria-pressed={es}
            onClick={() => { if (!es) { haptico('light'); onCambio?.(o.id); } }}>
            {dentro}
          </button>
        );
      })}
    </div>
  );
}

/**
 * El interruptor de una fila (prender o pausar algo YA, sin «Guardar»): el `mk-switch` de la
 * casa en tamaño iOS (51×31) y con 44 px de toque. Va en el `control` de FilaM. Si la acción se
 * puede revertir, el toast lleva «Deshacer».
 */
export function InterruptorM({ activo, onCambio, etiqueta, deshabilitado = false }: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  /** El nombre accesible («Activa», «Avisos en este teléfono»). */
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      className="mk-switch m-interruptor"
      onClick={() => { haptico('light'); onCambio(!activo); }}
    />
  );
}

/**
 * El pie FIJO de una pantalla (el editor de un video, el de una landing): la consecuencia en
 * tinta + UN botón primario grande, pegado abajo (arriba de la barra si la hay).
 *
 * ⚠️ SE MONTA EN EL SHELL (#m-pie), NO EN LA COLUMNA: la columna se mueve al navegar y al
 * tirar para refrescar, y un `position: fixed` adentro de algo que se mueve deja de estar
 * pegado a la pantalla. Antes de montar (el HTML del server) se dibuja en su lugar, igual de
 * fijo; el portal entra antes del primer pintado del cliente (useLayoutEffect).
 * Deja un espacio de su alto al final del contenido, y le dice al shell cuánto mide
 * (`--m-pie`) para que el toast salga arriba de él.
 */
export function PieFijoM({ consecuencia, children }: { consecuencia?: ReactNode; children?: ReactNode }) {
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  const [alto, setAlto] = useState(0);
  const pie = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => { setCapa(document.getElementById('m-pie')); }, []);

  useLayoutEffect(() => {
    const el = pie.current;
    if (!el) return;
    const shell = (el.closest('.m-shell') ?? document.querySelector('.m-shell')) as HTMLElement | null;
    const medir = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setAlto(h);
      shell?.style.setProperty('--m-pie', `${h}px`);
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return () => { shell?.style.removeProperty('--m-pie'); };
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => { ro.disconnect(); shell?.style.removeProperty('--m-pie'); };
  }, [capa]);

  const fijo = (
    <div ref={pie} className="m-pie-fijo">
      <PieM consecuencia={consecuencia}>{children}</PieM>
    </div>
  );
  return (
    <>
      <div className="m-pie-fijo__hueco" style={{ height: alto }} aria-hidden />
      {capa ? createPortal(fijo, capa) : fijo}
    </>
  );
}
