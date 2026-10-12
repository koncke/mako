// =============================================================================
// total-columna — la plata de una columna del Kanban, arriba, al lado de su título
// =============================================================================
// Pedido de Martín (12/10/2026, punto 21): «Y si en una columna hay dinero, debería tener el
// total arriba del todo, cerca del título de la columna... Obvio que con una aclaración sutil o
// con un ícono o algo que represente "estimado", solo el verdadero ingreso en Ganados».
//
// Tres clases de columna, y cada una suma OTRA cosa:
//   · ABIERTA (el pipeline que no terminó, y las de nutrición): el INGRESO ESTIMADO que alguien
//     le cargó a cada lead en su ficha (`leads.ingreso_estimado`, mig 0258). Es lo que se cree
//     que vale: se dibuja con «≈» y su `title` lo dice.
//   · GANADO: lo VENDIDO de verdad — el mismo monto de cierre que dibuja la tarjeta y que suma
//     Revenue (`monto_cierre_usd`), SIN los «sin cobro» (un becado no es una venta de US$0, y
//     las métricas de plata lo excluyen igual: lib/venta-tipo.ts, tests/venta-sin-cobro.test.ts).
//     Una SUSCRIPCIÓN no tiene monto de cierre (su plata es mensual, en otra columna) y por eso
//     no suma acá, igual que no suma en Revenue: un total no puede mezclar «una vez» con «por
//     mes». Si hay alguna, el `title` lo dice.
//   · LAS OTRAS TERMINALES (Perdido, Descalificado, No respondió): nada. Lo que se perdió no es
//     un ingreso, ni estimado.
//
// ⚠️ SUMA LO QUE LA COLUMNA MUESTRA: recibe las tarjetas ya filtradas. Con un filtro puesto, el
// total de arriba y las tarjetas de abajo hablan de los mismos leads.
// ⚠️ SI DA 0, NO HAY TOTAL (`null`): un «$0» arriba de cada columna vacía es ruido, y en una
// abierta un 0 no dice «no vale nada», dice «nadie cargó el estimado».
//
// Puro y sin 'use client' para que el test lo EJECUTE (tests/crm-tablero-alta-12-10.test.ts).
// =============================================================================

import { TERMINALES, TERMINAL_DEL_PIPELINE } from '@/lib/pipeline';
import { cuentaComoVenta, ventaTipoDe } from '@/lib/venta-tipo';

/** Lo que una tarjeta aporta: el subconjunto de `CrmLead` que hace falta. */
export type TarjetaConPlata = {
  monto: number;
  ingresoEstimado: number | null;
  ventaTipo?: string | null;
};

export type TotalColumna = {
  clase: 'estimado' | 'vendido';
  /** USD. Siempre > 0: con 0 no hay total. */
  valor: number;
  /** Cuántas tarjetas sumaron (las que tenían el dato). */
  cuantos: number;
  /** De esa columna, cuántas tarjetas hay en total. */
  de: number;
  /** Sólo en Ganado: cuántas suscripciones quedaron afuera de la suma. */
  suscripciones: number;
};

const positivo = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** La plata de una columna, o `null` si no hay nada que dibujar. */
export function totalDeColumna(etapa: string, tarjetas: readonly TarjetaConPlata[]): TotalColumna | null {
  if (etapa === TERMINAL_DEL_PIPELINE) {
    let valor = 0, cuantos = 0, suscripciones = 0;
    for (const t of tarjetas) {
      if (!cuentaComoVenta({ venta_tipo: t.ventaTipo ?? null })) continue;
      if (ventaTipoDe(t.ventaTipo) === 'suscripcion') { suscripciones++; continue; }
      const m = positivo(t.monto);
      if (m > 0) { valor += m; cuantos++; }
    }
    return valor > 0 ? { clase: 'vendido', valor, cuantos, de: tarjetas.length, suscripciones } : null;
  }
  if ((TERMINALES as readonly string[]).includes(etapa)) return null;
  let valor = 0, cuantos = 0;
  for (const t of tarjetas) {
    const e = positivo(t.ingresoEstimado);
    if (e > 0) { valor += e; cuantos++; }
  }
  return valor > 0 ? { clase: 'estimado', valor, cuantos, de: tarjetas.length, suscripciones: 0 } : null;
}

/**
 * Corto, porque vive al lado de un título en una columna de 282 px: «$850», «$12.4K», «$1.2M».
 * En inglés de EE. UU., como la plata de las tarjetas (`montoDeTarjeta`: «$1,500»).
 */
export function plataCorta(usd: number): string {
  return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(usd);
}

/** Lo que se dibuja, con la marca del estimado. */
export function textoDelTotal(t: TotalColumna): string {
  return t.clase === 'estimado' ? `≈ ${plataCorta(t.valor)}` : plataCorta(t.valor);
}

/** El porqué, para el `title` (ahí sí va texto: no ocupa lugar). */
export function ayudaDelTotal(t: TotalColumna): string {
  const usd = '$' + Math.round(t.valor).toLocaleString('en-US');
  if (t.clase === 'estimado') {
    return `Ingreso estimado: ${usd} USD, la suma de ${t.cuantos} de ${t.de} leads con un estimado cargado. No es una venta.`;
  }
  const subs = t.suscripciones > 0
    ? ` Las suscripciones (${t.suscripciones}) se cobran por mes y no suman aquí.`
    : '';
  return `Vendido: ${usd} USD, la suma de ${t.cuantos} ${t.cuantos === 1 ? 'venta' : 'ventas'}.${subs}`;
}
