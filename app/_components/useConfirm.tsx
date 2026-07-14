'use client';

// =============================================================================
// useConfirm — reemplazo con API de promesa para window.confirm()
// =============================================================================
// Devuelve `confirm(msg, opts?)` que resuelve true/false según el ConfirmModal de
// la casa, y `confirmNode` para renderizar una sola vez en el componente. Así un
// call-site pasa de `if (!window.confirm(msg)) return;` a
// `if (!(await confirm(msg))) return;` sin reestructurar la función (solo tiene
// que ser async, que las acciones destructivas ya suelen serlo).

import { useCallback, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

type ConfirmOpts = { confirmLabel?: string; danger?: boolean };
type Pending = ConfirmOpts & { msg: string; resolve: (ok: boolean) => void };

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (msg: string, opts?: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ msg, ...opts, resolve })),
    [],
  );
  const confirmNode = pending ? (
    <ConfirmModal
      msg={pending.msg}
      confirmLabel={pending.confirmLabel}
      danger={pending.danger}
      onOk={() => { pending.resolve(true); setPending(null); }}
      onCancel={() => { pending.resolve(false); setPending(null); }}
    />
  ) : null;
  return { confirm, confirmNode };
}
