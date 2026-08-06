'use client';

// =============================================================================
// ConfirmDialog — envoltorio del Confirm del sistema (app/_ui/Confirm.tsx)
// =============================================================================
// Este archivo ERA una de las dos confirmaciones que convivían en la app (la
// otra: app/_components/ConfirmModal.tsx). El rediseño dejó UNA sola
// implementación en app/_ui/Confirm.tsx; esto quedó como puente para los 14
// archivos que ya importaban desde acá.
//
// Para código nuevo: importá { Confirm } desde '@/app/_ui'.

export { Confirm as ConfirmDialog } from '@/app/_ui/Confirm';
