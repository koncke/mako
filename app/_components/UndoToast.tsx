'use client';

// =============================================================================
// UndoToast — puente al Toast del sistema (app/_ui/Toast.tsx)
// =============================================================================
// El cartel efímero con «↶ Deshacer» pasó a ser parte de la biblioteca de
// primitives, junto al resto de los estados. Esto traduce la firma vieja para
// los archivos que ya lo usaban (CrmBoard, CobrarTable, DealDetailsCard).
//
// Para código nuevo: importá { Toast, useToast } desde '@/app/_ui'.

import { Toast, useToast, type ToastState } from '@/app/_ui/Toast';

export type UndoState = ToastState;

export function useUndoToast(ms = 5000) {
  const { toast, show, clear } = useToast(ms);
  return { undo: toast, show, clear };
}

export function UndoToast({ state, onClose }: { state: UndoState; onClose: () => void }) {
  return <Toast state={state} onClose={onClose} />;
}
