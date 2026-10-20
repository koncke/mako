// =============================================================================
// cerebro-union-servidor — el cerebro del super admin, acomodado ENTERO de una vez (20/10/2026)
// =============================================================================
// Martín, 20/10/2026: «En ningún caso jamás los cerebros se deben dividir en 2». `unirCerebros` (lib/cerebro-union.ts) ya
// cuelga la construcción de la raíz del negocio; esto le corre la física a TODO junto, así la construcción queda como un
// racimo más alrededor de la raíz y no como una segunda nube al lado. Antes el cliente sólo ponía las dos nubes, cada una
// con su layout, una al lado de la otra (`AIRE_ENTRE_NUBES`), y la pantalla mostraba dos cerebros.
//
// ⚠️ NINGÚN módulo con 'use client' importa este archivo: trae d3-force (lib/cerebro-layout.ts lo explica). Es PURO, sin
//    `server-only`, para poder testearlo (tests/second-brain-un-cerebro.test.ts); quien lo llama es
//    lib/second-brain-opera.ts, del lado del servidor.
// ⚠️ CUESTA: ~300 nodos son alrededor de un segundo (docs/hallazgos-second-brain.md). Por eso se guarda el último
//    acomodado y se reusa mientras la huella no cambie; cuando cambia, se parte de las posiciones de antes (lo que ya
//    estaba casi no se mueve y lo nuevo entra viajando, como en el grafo vivo).
// =============================================================================

import { layoutCerebro } from './cerebro-layout';
import { unirCerebros } from './cerebro-union';
import type { Cerebro, Punto } from './cerebro-modelo';

/** La huella del cerebro unido: cambia si cambia cualquiera de las dos partes. */
export const huellaUnida = (negocio: Cerebro<string>, obra: Cerebro<string>): string =>
  `u:${negocio.huella ?? negocio.nodos.length}+${obra.huella ?? `${obra.nodos.length}.${obra.aristas.length}`}`;

/** El negocio y la construcción en UN cerebro con UNA física: una raíz, un componente, una nube. */
export function acomodarUnido(negocio: Cerebro<string>, obra: Cerebro<string>, previo?: Record<string, Punto>): Cerebro<string> {
  const junto = unirCerebros(negocio, obra);
  const { posiciones, encuadre } = layoutCerebro(junto.nodos, junto.aristas, previo);
  return { ...junto, posiciones, encuadre, huella: huellaUnida(negocio, obra) };
}

let guardado: Cerebro<string> | null = null;

/** `acomodarUnido`, reusando el último si nada cambió. Uno solo: el cerebro unido es el de la plataforma (quien opera
 *  nunca lo ve mirando a un cliente, lib/second-brain-opera.ts). */
export function cerebroUnido(negocio: Cerebro<string>, obra: Cerebro<string>): Cerebro<string> {
  const huella = huellaUnida(negocio, obra);
  if (guardado?.huella === huella) return guardado;
  guardado = acomodarUnido(negocio, obra, guardado?.posiciones);
  return guardado;
}
