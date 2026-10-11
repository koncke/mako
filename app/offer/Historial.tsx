'use client';

// =============================================================================
// Historial — las ofertas anteriores, en un menú colgado del botón del reloj
// =============================================================================
// Cada renglón: el título, el puntaje si ya se concluyó, y la fecha. Un clic la
// abre (POST abrir). Al abrir el menú se vuelve a pedir la lista: otra pestaña pudo
// haber creado una sesión, y un historial viejo es un historial que miente.
//
// ⚠️ Es una CAPA (pila de app/_components/pila-modales.ts, `anidada`): así le toca
// el z-index correcto y el Escape lo contesta SÓLO él. El listener va en `window`,
// en captura, y frena con stopImmediatePropagation: `esElDeArriba()` dice si le
// toca contestar, no impide que conteste otro (AGENTS.md, «un popover anclado
// también es una capa»).

import { useEffect, useRef, useState, type RefObject } from 'react';
import { IconButton, Spinner } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useCapaModal } from '@/app/_components/pila-modales';
import { TONO, shadow } from '@/app/_ui/tokens';
import type { OfferSesionResumen } from '@/lib/offer-marco';
import { fechaCorta, tonoDeNota } from './ayudas';

function Menu({ sesiones, actualId, abriendo, error, onAbrir, onCerrar, ancla }: {
  sesiones: OfferSesionResumen[];
  actualId: number | null;
  abriendo: number | null;
  error: string | null;
  onAbrir: (id: number) => void;
  onCerrar: () => void;
  ancla: RefObject<HTMLSpanElement | null>;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || ancla.current?.contains(t)) return;
      cerrar.current();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esArriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      cerrar.current();
      // El foco vuelve al botón que abrió el menú: si no, queda en un nodo que ya no existe.
      ancla.current?.querySelector<HTMLButtonElement>('button')?.focus();
    };
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', fuera, true); window.removeEventListener('keydown', tecla, true); };
  }, [ancla, esArriba]);

  // El foco entra al primer renglón al abrir, para que el teclado pueda elegir sin el mouse.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={ref} role="menu" aria-label="Ofertas anteriores" style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: capa.z,
      width: 'min(360px, calc(100vw - 32px))', maxHeight: 'min(440px, 60dvh)', overflowY: 'auto',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      boxShadow: shadow.pop, padding: 6, boxSizing: 'border-box',
    }}>
      {sesiones.length === 0 && (
        <p style={{ margin: 0, padding: '14px 12px', fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>Todavía no hay ofertas.</p>
      )}
      {sesiones.map((s) => {
        const actual = s.id === actualId;
        const tono = s.total != null ? TONO[tonoDeNota(s.total / 10)] : null;
        return (
          <button key={s.id} type="button" role="menuitem" className="of-menu-fila"
            aria-current={actual || undefined} disabled={abriendo != null}
            onClick={() => onAbrir(s.id)}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: actual ? 700 : 600 }}>
              {s.titulo || 'Oferta sin título'}
            </span>
            {tono && s.total != null && (
              <span title="Puntaje" style={{ flex: 'none', padding: '2px 8px', borderRadius: 999, background: tono.bg, color: tono.ink, fontSize: 'var(--fs-meta)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {s.total}
              </span>
            )}
            <span style={{ flex: 'none', minWidth: 44, textAlign: 'right', fontSize: 'var(--fs-meta)', color: 'var(--faint)', display: 'inline-flex', justifyContent: 'flex-end' }}>
              {abriendo === s.id ? <Spinner size={13} /> : fechaCorta(s.updatedAt)}
            </span>
          </button>
        );
      })}
      {error && (
        <p role="alert" style={{ margin: 0, padding: '8px 12px 6px', fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{error}</p>
      )}
    </div>
  );
}

export function Historial({ sesiones, actualId, abriendo, error, deshabilitado, onAbrir, alAbrir }: {
  sesiones: OfferSesionResumen[];
  actualId: number | null;
  /** La sesión que se está abriendo (su renglón muestra el giro). */
  abriendo: number | null;
  error: string | null;
  deshabilitado?: boolean;
  /** Abre una sesión; devuelve true si salió (y entonces el menú se cierra). */
  onAbrir: (id: number) => Promise<boolean>;
  /** Al desplegar: vuelve a pedir la lista. */
  alAbrir: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ancla = useRef<HTMLSpanElement>(null);

  const alternar = () => {
    if (!abierto) alAbrir();
    setAbierto((v) => !v);
  };
  const abrir = async (id: number) => {
    if (await onAbrir(id)) setAbierto(false);
  };

  return (
    <span ref={ancla} style={{ position: 'relative', display: 'inline-flex' }}>
      <IconButton title="Ofertas anteriores" className="of-iconbtn-borde" onClick={alternar} disabled={deshabilitado}
        aria-haspopup="menu" aria-expanded={abierto}>
        <IconoMenu nombre="reloj" size={19} />
      </IconButton>
      {abierto && !deshabilitado && (
        <Menu sesiones={sesiones} actualId={actualId} abriendo={abriendo} error={error}
          onAbrir={(id) => void abrir(id)} onCerrar={() => setAbierto(false)} ancla={ancla} />
      )}
    </span>
  );
}
