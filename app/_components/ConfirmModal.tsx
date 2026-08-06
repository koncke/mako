'use client';

// =============================================================================
// ConfirmModal — envoltorio del Confirm del sistema (app/_ui/Confirm.tsx)
// =============================================================================
// Era la SEGUNDA confirmación de la app, con su propio tamaño, su propio radio y
// su propio z-index. El rediseño dejó una sola en app/_ui/Confirm.tsx; esto
// traduce la firma vieja (msg / danger / onOk) a la nueva para que los archivos
// que ya la usaban no cambien.
//
// Para código nuevo: importá { Confirm } o { useConfirm } desde '@/app/_ui'.

import { Confirm } from '@/app/_ui/Confirm';

export function ConfirmModal({ msg, confirmLabel = 'Eliminar', danger = true, onOk, onCancel }: {
  msg: string;
  confirmLabel?: string;
  danger?: boolean;
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <Confirm
      message={msg}
      confirmLabel={confirmLabel}
      tone={danger ? 'danger' : 'primary'}
      onConfirm={onOk}
      onCancel={onCancel}
    />
  );
}
