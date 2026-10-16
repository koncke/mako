// =============================================================================
// /m/crm — QUÉ MUESTRA LA FICHA DEL TELÉFONO y en qué orden: la ficha del funnel, DESTILADA (puro)
// =============================================================================
// Pedido del 15/10/2026 (frente celular de la ficha por bloques): debajo del encabezado, la ficha del
// teléfono sigue la ELECCIÓN y el ORDEN de bloques de la ficha del funnel del lead (`fichaEfectiva`,
// lib/ficha/config.ts), con sólo los bloques que tienen versión de teléfono. Es la regla de MaKo Mobile
// (AGENTS.md, «EL TELÉFONO DESTILA EL ESCRITORIO»): no se rediseña, se destila.
//
// ⚠️ EL TELÉFONO NO TIENE EDITOR (§3 de docs/diseno-ficha-bloques.md: «Ficha del celular… no tienen editor
//    propio. Más adelante pueden leer el orden de la plantilla»). La ficha se arma en «Personalizar», en la
//    computadora, como en HubSpot, donde la vista del registro de la app del celular se configura desde la
//    computadora (documentación oficial, knowledge.hubspot.com, «Customize record previews»).
// ⚠️ LAS TABS DE ESCRITORIO VAN UNA DEBAJO DE LA OTRA, en su orden (Resumen, Tracking, Reuniones, Pagos, el de
//    FichaPorBloques), y sólo las que ESTE lead ve en escritorio: «Lo que salió de la llamada» vive en
//    Reuniones, y el teléfono la muestra sólo si el funnel tiene una etapa de reunión. Una pieza va una vez,
//    donde aparece primero.
// ⚠️ UN BLOQUE QUE SE CALLA SIN DATOS (`sinDatos: 'se-calla'` del catálogo) tampoco se dibuja en el teléfono;
//    uno con raya (`contacto`, `notas`) se dibuja siempre, como en escritorio.
//
// Puro, sin React ni server-only: lo leen el server (./datos.ts), la ficha (./[id]/FichaLead.tsx) y
// tests/m-ficha-bloques.test.ts.
// =============================================================================

import { bloqueDef, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';

/** Las piezas que el teléfono sabe dibujar. Cada una es la versión de teléfono de UN bloque de escritorio. */
export type PiezaFicha = 'proxima' | 'contacto' | 'llego-por' | 'contesto' | 'llamada' | 'notas';

/**
 * EL BLOQUE DE ESCRITORIO → SU VERSIÓN DE TELÉFONO. Un bloque que no está aquí no tiene versión de teléfono y
 * no se dibuja (lo que se ve en el teléfono sale de lo que ya tenía la ficha v2: docs/prototipos/mako-mobile-v2.html).
 */
export const PIEZA_DE_BLOQUE: Readonly<Partial<Record<BloqueId, PiezaFicha>>> = {
  'proxima-reunion': 'proxima',
  contacto: 'contacto',
  'lo-que-contesto': 'contesto',
  origen: 'llego-por',
  notas: 'notas',
  'lo-que-salio-de-la-llamada': 'llamada',
};

/** El orden de las tabs de la ficha de escritorio (FichaPorBloques: Tracking, Reuniones y Pagos, en ese orden). */
export const ORDEN_TABS_ESCRITORIO: readonly TabFicha[] = ['resumen', 'tracking', 'reuniones', 'pagos'];

/** Una pieza de la ficha del teléfono, con el bloque de escritorio del que sale. */
export type PiezaPuesta = { pieza: PiezaFicha; bloque: BloqueId };

/**
 * Las tabs que ESTE lead ve en escritorio, en lo que le importa al teléfono. Pagos no tiene piezas: no se
 * lee lo que la decide (la pasarela y los cobros) para nada.
 */
export function tabsQueVe(o: { verTracking: boolean; verReuniones: boolean }): TabFicha[] {
  return ['resumen', ...(o.verTracking ? ['tracking' as const] : []), ...(o.verReuniones ? ['reuniones' as const] : [])];
}

/**
 * LAS PIEZAS DEL TELÉFONO, EN ORDEN: las tabs que el lead ve, una debajo de la otra, y en cada una los
 * bloques de la ficha del funnel que tienen versión de teléfono. Una pieza va una sola vez.
 */
export function piezasDelTelefono(tabs: Readonly<Record<TabFicha, ReadonlyArray<{ id: BloqueId }>>>, ve: readonly TabFicha[]): PiezaPuesta[] {
  const out: PiezaPuesta[] = [];
  for (const tab of ORDEN_TABS_ESCRITORIO) {
    if (!ve.includes(tab)) continue;
    for (const b of tabs[tab] ?? []) {
      const pieza = PIEZA_DE_BLOQUE[b.id];
      if (pieza && !out.some((x) => x.pieza === pieza)) out.push({ pieza, bloque: b.id });
    }
  }
  return out;
}

/** Lo que el teléfono tiene de este lead para saber si una pieza tiene algo que mostrar. */
export type ConQueDibujar = {
  proxima: string | null;
  llegoPor: string | null;
  respuestas: number;
  llamada: boolean;
};

/** ¿La pieza no tiene nada para este lead? `contacto` y `notas` siempre tienen (el teléfono, «Nota por voz»). */
export function piezaVacia(p: PiezaFicha, d: ConQueDibujar): boolean {
  switch (p) {
    case 'proxima': return !d.proxima;
    case 'llego-por': return !d.llegoPor;
    case 'contesto': return d.respuestas === 0;
    case 'llamada': return !d.llamada;
    case 'contacto':
    case 'notas': return false;
  }
}

/** Las piezas que se dibujan: las vacías de un bloque que se calla sin datos, no (la regla del catálogo). */
export function piezasQueSeDibujan(piezas: readonly PiezaPuesta[], d: ConQueDibujar): PiezaPuesta[] {
  return piezas.filter((p) => !(bloqueDef(p.bloque)?.sinDatos === 'se-calla' && piezaVacia(p.pieza, d)));
}

/**
 * Cómo se agrupan en pantalla: las filas seguidas van en una lista, y las notas son su propia sección. Arriba
 * de todo va SIEMPRE «Datos», con la fila de la etapa primero: la etapa es del encabezado, que no se
 * personaliza. Si la ficha empieza por las notas, «Datos» queda sólo con la etapa y las notas van debajo.
 */
export type GrupoFicha = { tipo: 'filas'; piezas: PiezaFicha[]; primero: boolean } | { tipo: 'notas' };

export function gruposDeLaFicha(piezas: readonly PiezaFicha[]): GrupoFicha[] {
  const out: GrupoFicha[] = [{ tipo: 'filas', piezas: [], primero: true }];
  for (const p of piezas) {
    if (p === 'notas') { out.push({ tipo: 'notas' }); continue; }
    const ultimo = out[out.length - 1];
    if (ultimo.tipo === 'filas') ultimo.piezas.push(p);
    else out.push({ tipo: 'filas', piezas: [p], primero: false });
  }
  return out;
}
