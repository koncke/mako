// =============================================================================
// /m/crm — mientras se lee el tablero: la barra de etapas y las columnas (v3, 14/10/2026)
// =============================================================================
// Medido en producción: el tablero tarda 1,8-3,3 s (más con la instancia recién arrancada). Sin
// esto, tocar «CRM» no hacía nada visible: Martín lo tocó tres veces en diez segundos y triplicó
// la carga. Va también para la ficha y el chat del lead (sus propios loading.tsx).

import { SkeletonTablero } from '@/app/m/_ui';

export default function CrmCargando() {
  return <SkeletonTablero conArriba />;
}
