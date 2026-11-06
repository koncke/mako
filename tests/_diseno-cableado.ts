// =============================================================================
// _diseno-cableado — lo que comparten las guardas de cableado de cada hoja copiada (6/11/2026)
// =============================================================================
// Hasta el 6/11/2026 cada tests/dashboard-diseno-<x>.test.ts miraba una rama propia del editor
// (`hoja.diseno?.id === 'x' && !enGrilla && !editando && !dueno`): el diseño se dibujaba ENTERO sólo mirando, y editando la
// hoja era otra cosa (Martín: «se rompen todos en la vista de EDICIÓN»). Desde ese día cada tarjeta del diseño es un BLOQUE de
// la grilla (lib/disenos-partes.ts) que se dibuja igual mirando y editando, con UN despachador (app/dashboard/disenos/DisenoVivo.tsx).
// Esta función EJECUTA lo que cada hoja necesita para eso y mira el despachador por su nombre:
//   · la hoja que sale de la plantilla trae un bloque por cada tarjeta del diseño, apuntando a sus piezas;
//   · a la vista no hay más de 14 paneles (los gráficos de donde leen los bloques van plegados en «Todas las piezas»);
//   · el despachador dibuja ESTE diseño con su componente vivo, y el editor dibuja los bloques con él.
// =============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Elemento, Hoja } from '../lib/graficos-catalogo';
import { partesDe } from '../lib/disenos-partes';
import { panelesALaVista } from '../lib/graficos-secciones';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

/** Los bloques de un diseño en una hoja. */
export const bloquesDe = (h: Hoja, id: string): Elemento[] =>
  h.componentes.filter((c): c is Elemento => c.clase === 'elemento' && c.tipo === 'diseno' && c.diseno?.id === id);

/**
 * El cableado de un diseño en su hoja de plantilla ya instanciada. `vivo` es el componente con que el despachador lo dibuja
 * (`MarketingVivo`, `HojaClosing`…); `con` son props que ese renglón del despachador tiene que pasarle.
 */
export function cableadoDelDiseno(h: Hoja, id: string, vivo: string, con: readonly string[] = []): void {
  assert.equal(h.diseno?.id, id, `la hoja trae el diseño ${id}`);
  const partes = partesDe(id);
  assert.ok(partes.length > 0, `${id}: el diseño tiene sus tarjetas en lib/disenos-partes.ts`);
  const bloques = bloquesDe(h, id);
  for (const p of partes) {
    const b = bloques.find((x) => x.diseno?.parte === p.id);
    assert.ok(b, `${id}: la tarjeta «${p.nombre}» es un bloque de la hoja`);
    assert.deepEqual(b!.diseno!.piezas, h.diseno!.piezas, `${id}: el bloque «${p.nombre}» lee las piezas de la hoja`);
  }
  for (const k of new Set(partes.flatMap((p) => p.lee))) {
    const idPieza = h.diseno!.piezas[k];
    if (idPieza) assert.ok(h.componentes.some((c) => c.id === idPieza), `${id}: la pieza ${k} existe`);
  }
  const vista = panelesALaVista(h.componentes);
  assert.ok(vista.length <= 14, `${id}: ${vista.length} paneles a la vista (una hoja lleva hasta 14)`);
  const despachador = leer('app/dashboard/disenos/DisenoVivo.tsx');
  const renglon = despachador.split('\n').find((l) => l.includes(`case '${id}':`));
  assert.ok(renglon, `${id}: el despachador lo dibuja`);
  assert.ok(renglon!.includes(`<${vivo}`), `${id}: con ${vivo}`);
  for (const p of con) assert.ok(renglon!.includes(p), `${id}: le pasa ${p}`);
  assert.equal((leer('app/dashboard/EditorInforme.tsx').match(/<BloqueDeDiseno\b/g) ?? []).length, 1, 'el editor dibuja los bloques en UN lugar');
}
