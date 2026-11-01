// =============================================================================
// dashboard-focus — el Dashboard unido: la hoja fija «Focus» (lo que era /general) y las hojas de siempre
// =============================================================================
// Martín (17/10/2026, ~22:40, prototipo docs/prototipos/coherencia-1710.md, pedido 3): «Home» sale de la sidebar y el
// Dashboard abre en la hoja FOCUS, que es lo que era /general; las demás pestañas son las hojas de siempre y las
// plantillas van a la galería de «Nueva hoja» (hasta el 1/11/2026, a un botón «Templates»). Lo decidió el Cerebro: Focus es una hoja fija, la primera, y no se borra.
//
// ⚠️ SON DOS INFORMES y siguen siéndolo (lib/graficos-tablero.ts): el de General (`general.informe.<sub>`, con sus
//    bloques) y el del Dashboard (`graficos.tablero.<sub>`). No se mudó ningún dato: /dashboard elige QUÉ EDITOR monta
//    según la hoja pedida, y la tira de pestañas muestra las hojas de los dos.
//   · Focus es la PRIMERA hoja de General. Las otras hojas de General (medido el 17/10: 1 de 3 negocios tiene dos, el
//     ws1 con «Cobros») van como pestañas después de Focus: nada que alguien armó desaparece.
//   · Cada editor cambia de hoja entre las SUYAS sin recargar; una pestaña del otro informe es un link.
//   · `?hoja=focus` (o sin `?hoja=`) abre Focus. El id de una hoja de General también: es lo que el editor escribe en
//     la URL al cambiar de hoja. Cualquier otra cosa (una hoja del Dashboard, una plantilla como `foco`) es del
//     Dashboard, como siempre (`hojaDestino`, lib/graficos-plantillas.ts).
//   · Sólo para quien veía /general: el admin con la capa que incluye General. El closer y el setter siguen con su
//     única hoja.
// =============================================================================

/** La hoja fija del Dashboard en la URL: `/dashboard?hoja=focus`. ⚠️ No es la plantilla `foco` del Dashboard. */
export const HOJA_FOCUS = 'focus';

/** El nombre de la primera pestaña, sea cual sea el nombre de la primera hoja de General. */
export const NOMBRE_FOCUS = 'Focus';

/** El parámetro que abre la galería de plantillas al entrar. */
export const PARAM_PLANTILLAS = 'plantillas';

export type InformeDashboard = 'general' | 'dashboard';

/** Lo que la tira necesita de una hoja. */
export type HojaCorta = { id: string; nombre: string; emoji?: string };

export type Pestana = HojaCorta & { informe: InformeDashboard; href: string; fija?: boolean };

/** ¿Qué editor monta /dashboard para esta `?hoja=`? Sin Focus (closer, setter, capa sin General), siempre el Dashboard. */
export function informeDePedida(pedida: string | null | undefined, idsGeneral: readonly string[], idsDashboard: readonly string[], conFocus: boolean, plantillasGeneral: readonly string[] = []): InformeDashboard {
  if (!conFocus) return 'dashboard';
  const p = pedida?.trim();
  if (!p || p === HOJA_FOCUS) return 'general';
  // Primero el Dashboard: si un id estuviera en los dos (no pasa, son al azar), manda la pestaña de siempre.
  if (idsDashboard.includes(p)) return 'dashboard';
  if (idsGeneral.includes(p) || plantillasGeneral.includes(p)) return 'general';
  return 'dashboard';
}

/** La hoja de General que abre `?hoja=` (la primera para Focus o sin pedido). */
export function hojaGeneralPedida(pedida: string | null | undefined, idsGeneral: readonly string[]): string | null {
  const p = pedida?.trim();
  if (p && p !== HOJA_FOCUS && idsGeneral.includes(p)) return p;
  return idsGeneral[0] ?? null;
}

const hrefDeHoja = (id: string) => `/dashboard?hoja=${encodeURIComponent(id)}`;

/** La tira: Focus primero (fija), las otras hojas de General, y las del Dashboard. */
/**
 * Cómo se LLAMA una hoja en la interfaz. La PRIMERA del informe General es «Focus» —así la nombran los chips,
 * acá abajo— y el desplegable tiene que decir lo MISMO: si dibuja el nombre guardado, dos hojas llamadas
 * «General» quedan indistinguibles y no se sabe cuál es Focus (visto en producción el 1/11/2026).
 * Cambia lo que se MUESTRA y lo que se BUSCA; el nombre guardado no se toca.
 */
export const nombreQueSeVe = (nombre: string, informe: InformeDashboard | undefined, i: number): string =>
  informe === 'general' && i === 0 ? NOMBRE_FOCUS : nombre;

/** La hoja cuyo nombre guardado NO manda: la primera del General se llama «Focus» venga como venga. */
export const esLaDeFocus = (informe: InformeDashboard | undefined, i: number): boolean => informe === 'general' && i === 0;

export function pestanasDelDashboard(general: readonly HojaCorta[], dashboard: readonly HojaCorta[]): Pestana[] {
  const [primera, ...resto] = general;
  const focus: Pestana = { id: primera?.id ?? HOJA_FOCUS, nombre: NOMBRE_FOCUS, informe: 'general', href: '/dashboard', fija: true };
  return [
    focus,
    ...resto.map((h): Pestana => ({ ...h, informe: 'general', href: hrefDeHoja(h.id) })),
    ...dashboard.map((h): Pestana => ({ ...h, informe: 'dashboard', href: hrefDeHoja(h.id) })),
  ];
}

/**
 * Qué chips entran en la tira y cuáles se juntan en el último (1/11/2026). Van en orden hasta que se acaba el ancho, con el lugar del
 * último chip reservado. La hoja abierta (`activa`) entra siempre, aunque desplace a otra: es lo que dice dónde estás.
 */
export function chipsQueEntran(anchos: readonly number[], disponible: number, anchoUltimo: number, gap: number, activa: number): { visibles: number[]; fuera: number[] } {
  const suma = (ids: readonly number[]) => ids.reduce((s, i) => s + anchos[i] + gap, 0);
  const todas = anchos.map((_, i) => i);
  if (suma(todas) + anchoUltimo <= disponible) return { visibles: todas, fuera: [] };
  const lugar = disponible - anchoUltimo;
  const visibles: number[] = [];
  for (const i of todas) {
    if (suma(visibles) + anchos[i] + gap > lugar) break;
    visibles.push(i);
  }
  if (activa >= 0 && !visibles.includes(activa)) {
    while (visibles.length && suma(visibles) + anchos[activa] + gap > lugar) visibles.pop();
    visibles.push(activa);
  }
  return { visibles, fuera: todas.filter((i) => !visibles.includes(i)) };
}

/** La `?hoja=` con la que /general (y sus links viejos) llega a /dashboard: la de General viaja; sin hoja, Focus. */
export const hojaDesdeGeneral = (hoja: string | null | undefined): string => hoja?.trim() || HOJA_FOCUS;
