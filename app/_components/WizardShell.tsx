'use client';

// =============================================================================
// WizardShell — chrome del asistente MaKo (una pregunta por paso), reutilizable
// =============================================================================
// Header con ✦ MAKO + dots de progreso, cuerpo centrado (UNA pregunta por paso)
// y footer Atrás/Siguiente/Confirmar. Lo usan todos los formularios de >1
// pregunta de la app (Kanban, board /plan, onboarding) para que se vean igual.
//
// Dos formas, mismo cuerpo:
//   · modal (default)  — card de 560px sobre un backdrop. Para los de adentro.
//   · fullscreen       — overlay que tapa el sidebar, en DOS pantallas: a la
//                        izquierda el `escenario` (lo que MaKo va encontrando de
//                        tu negocio) y a la derecha la pregunta. Para el
//                        onboarding, que no es un diálogo sino una llegada.
// `bloqueante` va aparte del modo: es "no se puede cerrar" (sin ✕, backdrop
// muerto), que es la semántica del onboarding pero también la del gauntlet.

import type { CSSProperties, ReactNode } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Input estándar de los pasos del wizard (centrado). */
export const wizardInput: CSSProperties = { width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', textAlign: 'center' };

export function WizardShell({
  titulo, total, idx, pregunta, sub, children, error,
  puedeAvanzar, enUltimo, confirmLabel, pending = false,
  atrasLabel, onAtras, onSiguiente, onConfirmar, onClose, bloqueante = false, hideAtras = false,
  fullscreen = false, escenario, siguienteLabel = 'Siguiente →', extraFooter, adminBar,
}: {
  titulo: string;            // línea mono arriba (ej. "Nutrición manual · Juan")
  total: number; idx: number;
  pregunta: string; sub?: string;
  children: ReactNode;       // cuerpo del paso (input/textarea/botones)
  error?: string | null;
  puedeAvanzar: boolean;     // habilita Siguiente/Confirmar
  enUltimo: boolean;         // último paso → botón Confirmar
  confirmLabel: string;
  pending?: boolean;
  atrasLabel: string;        // "Cancelar" (primer paso) o "Atrás"
  onAtras: () => void; onSiguiente: () => void; onConfirmar: () => void; onClose: () => void;
  bloqueante?: boolean;      // true → no se puede cerrar (sin ✕, backdrop no cierra)
  hideAtras?: boolean;       // true → oculta el botón izquierdo (sin Cancelar/Atrás)
  /** true → overlay a pantalla completa en 2 columnas (onboarding), no modal. */
  fullscreen?: boolean;
  /** Panel izquierdo del modo fullscreen: lo que MaKo va sabiendo del negocio. */
  escenario?: ReactNode;
  /** Texto del botón de avance (default "Siguiente →"). */
  siguienteLabel?: string;
  /** Slot a la izquierda del footer (ej. "Completar después"). */
  extraFooter?: ReactNode;
  /** Barra fija arriba del overlay fullscreen (ej. "Salir de la vista" del admin). */
  adminBar?: ReactNode;
}) {
  const dots = (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 999, background: i === idx ? 'var(--primary)' : i < idx ? 'var(--primary-weak, #B9CDF8)' : 'var(--border)', transition: 'width .2s' }} />
      ))}
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
      {dots}
      {bloqueante
        ? <span style={{ width: 32 }} />
        : <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14, fontFamily: SANS }}>✕</button>}
    </div>
  );

  const cuerpo = (
    <div style={{ padding: fullscreen ? '18px clamp(20px,4vw,44px) 24px' : '26px clamp(20px,6vw,56px) 30px', textAlign: 'center' }}>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: MONO, marginBottom: 8 }}>{titulo}</div>
      <h3 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', fontFamily: SANS }}>{pregunta}</h3>
      {sub ? <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px', lineHeight: 1.55 }}>{sub}</p> : <div style={{ height: 12 }} />}
      <div style={{ maxWidth: 480, margin: '0 auto' }}>{children}</div>
      {error && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{error}</div>}
    </div>
  );

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      {hideAtras
        ? <span>{extraFooter}</span>
        : <button onClick={onAtras} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>← {atrasLabel}</button>}
      {enUltimo ? (
        <button onClick={onConfirmar} disabled={pending || !puedeAvanzar} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: puedeAvanzar ? 'var(--primary)' : 'var(--border)', color: puedeAvanzar ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: puedeAvanzar && !pending ? 'pointer' : 'default', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : confirmLabel}</button>
      ) : (
        <button onClick={onSiguiente} disabled={!puedeAvanzar || pending} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: puedeAvanzar ? 'var(--primary)' : 'var(--border)', color: puedeAvanzar ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: puedeAvanzar ? 'pointer' : 'default', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : siguienteLabel}</button>
      )}
    </div>
  );

  // Fullscreen: dos pantallas. El escenario a la izquierda no es decoración —
  // es lo que MaKo ya sabe del negocio, apareciendo mientras el cliente contesta.
  // Fullscreen: UNA tarjeta partida — el mismo grid `.mk-svc-modal` que el modal
  // de /integraciones y que el PanelActivacion de cada tab. No son dos cajas
  // sueltas a propósito: el aside negro tiene que leerse como parte de la misma
  // pieza (por eso su borde y su radio los pone .mk-svc-aside), y así el cliente
  // reconoce la MISMA pantalla en los tres lugares.
  if (fullscreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', overflowY: 'auto', fontFamily: SANS, display: 'flex', flexDirection: 'column', padding: 'clamp(12px,3vh,36px) 20px' }}>
        {/* Barra del admin: por encima del overlay (que si no tapa el banner de
            impersonación), para poder salir de la vista sin terminar el wizard. */}
        {adminBar && <div style={{ flex: 'none', marginBottom: 14 }}>{adminBar}</div>}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <div
            className={escenario ? 'mk-svc-modal' : undefined}
            style={{
              width: '100%', maxWidth: escenario ? 980 : 620,
              minHeight: escenario ? 560 : undefined,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 18, overflow: 'hidden',
              ...(escenario ? {} : { display: 'flex', flexDirection: 'column' }),
            }}
          >
            {escenario}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {header}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{cuerpo}</div>
              {footer}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={bloqueante ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        {header}
        {cuerpo}
        {footer}
      </div>
    </div>
  );
}
