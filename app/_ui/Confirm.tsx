'use client';

// =============================================================================
// Confirm — LA confirmación de la app (antes había dos)
// =============================================================================
// Hasta el rediseño convivían app/components/ConfirmDialog.tsx (14 archivos) y
// app/_components/ConfirmModal.tsx + useConfirm.tsx (3), con tipografías, radios
// y z-index distintos, y ninguna mandaba. Ésta es la única; las otras dos
// quedaron como envoltorios que llaman acá, así que ningún call-site cambió.
//
// Se usa de dos formas, según cómo esté escrito el call-site:
//
//   1) Declarativa — tenés un estado de «qué voy a borrar»:
//        {aBorrar && <Confirm title="¿Eliminar la campaña?" … />}
//
//   2) Con promesa — reemplazo directo de window.confirm(), sin reestructurar:
//        const { confirm, confirmNode } = useConfirm();
//        if (!(await confirm('¿Eliminar?'))) return;
//        …
//        return <>{confirmNode}…</>
//
// Nunca usamos el confirm() nativo del navegador: aparece pegado arriba de la
// ventana, con la tipografía del sistema, y rompe la ilusión de aplicación.
//
// Va SOBRE la pila de modales (no la esconde, ver pila-modales.ts): preguntar
// «¿seguro?» ocultando lo que estás por borrar sería absurdo.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

/** Por encima de cualquier modal de la pila (Z_BASE 130 + niveles). */
const Z_CONFIRM = 500;

export function Confirm({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
  zIndex = Z_CONFIRM,
  loading,
}: {
  /** El título ES la pregunta. Si solo tenés una frase, usá `message`. */
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para lo que destruye (rojo), `primary` para lo que solo confirma. */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
  /** La acción está corriendo: bloquea los dos botones y muestra el spinner. */
  loading?: boolean;
}) {
  const okRef = useRef<HTMLButtonElement | null>(null);

  // Escape cancela, Enter confirma. El foco arranca en el botón de acción, así
  // que quien navega por teclado no tiene que buscarlo.
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
      if (e.key === 'Enter' && !loading) { e.stopPropagation(); onConfirm(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onConfirm, onCancel, loading]);

  return (
    <div onClick={(e) => { e.stopPropagation(); if (!loading) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'mkFade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true"
        style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px', animation: 'mkPop .16s ease' }}>
        {title && <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>{title}</div>}
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.55 }}>{message}</div>
        <div className="mk-row mk-row--stack" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button ref={okRef} variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

type ConfirmOpts = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Pendiente = ConfirmOpts & { msg: ReactNode; resolve: (ok: boolean) => void };

/**
 * `confirm()` con API de promesa, para reemplazar window.confirm() sin
 * reestructurar la función que lo llama (solo tiene que ser async, que las
 * acciones destructivas ya suelen serlo).
 */
export function useConfirm() {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const confirm = useCallback(
    (msg: ReactNode, opts?: ConfirmOpts) => new Promise<boolean>((resolve) => setPendiente({ msg, ...opts, resolve })),
    [],
  );
  const confirmNode = pendiente ? (
    <Confirm
      title={pendiente.title}
      message={pendiente.msg}
      confirmLabel={pendiente.confirmLabel ?? 'Eliminar'}
      cancelLabel={pendiente.cancelLabel}
      tone={pendiente.danger === false ? 'primary' : 'danger'}
      onConfirm={() => { pendiente.resolve(true); setPendiente(null); }}
      onCancel={() => { pendiente.resolve(false); setPendiente(null); }}
    />
  ) : null;
  return { confirm, confirmNode };
}
