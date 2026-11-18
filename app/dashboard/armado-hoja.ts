// =============================================================================
// armado-hoja — lo que MaKo arma en una hoja del Dashboard se ve ARMÁNDOSE (AGENTS.md, «Lo que MaKo construye se ve
// CONSTRUYÉNDOSE», 28/10/2026)
// =============================================================================
// Pendiente O13 de docs/pendientes-verificados-17-11.md (18/11/2026): «Editar con MaKo» y el ajuste de una plantilla a los
// datos del negocio (`rellenarHoja`) ponían la hoja nueva DE GOLPE. Ahora las tarjetas que MaKo agregó o cambió aparecen de
// a una, en el orden en que se leen (de arriba hacia abajo, de izquierda a derecha), con la cadencia de la pieza compartida
// (`useRevelado`, app/_ui/ArmadoEnVivo.tsx: fracciones de segundo por tarjeta, segundos en total, y «Ver todo»).
//
// ⚠️ ES SÓLO CÓMO SE MUESTRA: la hoja ya está entera en el informe (y la guarda el autoguardado de siempre). Las tarjetas
//    que faltan se esconden con CSS (opacity y `translate`, que no pisa el `transform` con que la grilla ubica cada tarjeta),
//    así que no se inventa progreso ni se frena nada.
// ⚠️ Con «reducir movimiento» del sistema, `useRevelado` muestra todo de una y la transición se apaga.
//
// Puro (sin React): lo usa app/dashboard/ArmadoDeHoja.tsx y lo ejecuta tests/dashboard-armado-hoja.test.ts.
// =============================================================================

import type { Hoja } from '@/lib/graficos-catalogo';
import { canon } from '@/lib/graficos-guardar-mirando';

/**
 * Las tarjetas de `despues` que MaKo AGREGÓ o CAMBIÓ respecto de `antes` (la misma hoja como estaba), en el orden en que se
 * leen. Una que sólo se movió también cuenta: cambió de lugar. Sin `antes` (una hoja que no estaba), todas.
 */
export function tarjetasPorArmar(antes: Hoja | null | undefined, despues: Hoja): string[] {
  const previas = new Map((antes?.componentes ?? []).map((c) => [c.id, canon(c)] as const));
  return despues.componentes
    .filter((c) => previas.get(c.id) !== canon(c))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((c) => c.id);
}

/** Un id como valor de un selector de atributo (entre comillas): sin comillas ni barras que lo corten. */
const comoValor = (id: string) => id.replace(/["\\]/g, '');

/**
 * La hoja de estilo que esconde las tarjetas que todavía no se ven (`ids.slice(visibles)`), y la transición con que entran
 * las demás. Vacía si ya se ve todo.
 */
export function cssDeArmado(ids: readonly string[], visibles: number): string {
  const faltan = ids.slice(Math.max(0, visibles));
  if (!faltan.length) return '';
  const todas = ids.map((id) => `[data-comp="${comoValor(id)}"]`).join(',');
  const ocultas = faltan.map((id) => `[data-comp="${comoValor(id)}"]`).join(',');
  return `${todas}{transition:opacity .32s ease-out,translate .32s ease-out,transform .2s ease}`
    + `${ocultas}{opacity:0;translate:0 12px;pointer-events:none}`
    + `@media (prefers-reduced-motion: reduce){${todas}{transition:none}}`;
}
