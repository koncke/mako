// =============================================================================
// /m/hoy (General, la portada) — mientras se arma la hoja: la FORMA, no un spinner (v3, 14/10/2026)
// =============================================================================
// Medido en producción: General tarda 1,2-2,2 s en caliente y 3,3-5,6 s en una instancia recién
// arrancada. Sin esto, abrir la app o tocar «General» dejaba la pantalla en blanco o la anterior
// congelada hasta que llegaba todo. El saludo lo pone el shell.

import { SkeletonTarjetas } from '@/app/m/_ui';

export default function GeneralCargando() {
  return <SkeletonTarjetas />;
}
