// =============================================================================
// graficos-guardar-mirando — lo que un informe del Dashboard puede cambiar cuando se guarda MIRANDO
// =============================================================================
// Pendiente O10 (2) de docs/pendientes-verificados-17-11.md (18/11/2026): el «guardar» de /api/graficos no miraba si el
// tablero estaba en modo vista. Dos veces se escribió el informe de alguien que sólo lo miraba, y las dos sin un error:
//   · el 11/10/2026 la grilla compactó lo que vino al MONTAR y el autoguardado lo escribió (el informe de un cliente, a la
//     madrugada, sin que tocara nada). Se arregló en la pantalla: `alMoverGrilla` sólo escribe editando.
//   · el 16/10/2026 «Editar con MaKo» cambiaba la hoja que se estaba mirando (docs/hallazgos-graficos.md, «Mirando, MaKo
//     cambiaba la hoja»). Se arregló en la ruta de MaKo (`permisoEdicionMako`) y en la pantalla (`ponerHojaDeMako`).
// Los dos cierres eran de la PANTALLA o de otra ruta: la escritura en sí no tenía puerta. Ésta es la puerta, en el server.
//
// LA REGLA, en positivo: mirando se pueden hacer las cosas de las HOJAS, no las de su contenido:
//   · crear una hoja (en blanco, de una plantilla, armada por MaKo, pegada, duplicada, la que trae `?hoja=`): una hoja que
//     no estaba se guarda entera;
//   · archivarla, restaurarla, borrarla de Archivados, cambiarlas de orden, y la vacía de un informe en blanco;
//   · cambiar su cabecera (el nombre, el emoji y el subtítulo se editan en el lugar también mirando: app/dashboard/Cabecera.tsx);
//   · SUMAR un filtro a la barra («Filtrar la página por esto», desde el detalle de un número: `filtrarPor`).
// Todo lo demás de una hoja que ya estaba (sus componentes, sus conectores, su tema, su diseño, su animación, los filtros
// que ya tenía) tiene que llegar IGUAL. Si no, no se guarda nada y se dice.
//
// ⚠️ LO DECIDE EL SERVER sobre lo que se pide, como `permisoEdicionMako` (lib/graficos-ia-edicion.ts): la pantalla dice
//    si está editando (`editando` en el cuerpo) y la ruta compara lo que llega contra lo GUARDADO. Lo que se cambió
//    editando y se guarda un instante después de tocar «Ver» (un texto en el lugar se guarda al salir) va con `editando`:
//    lo cuida la pantalla (app/dashboard/EditorInforme.tsx, `huboEdicion`).
// ⚠️ Una pestaña de antes de este cambio no manda `editando`: se guarda como siempre (la ruta sólo aplica la puerta con un
//    `false` explícito). Con la próxima recarga ya lo manda.
// ⚠️ Compara después del SANEO de los dos lados (lo guardado se lee saneado y lo que llega se sanea antes de escribir): el
//    saneo es idempotente sobre lo ya saneado (tests/graficos-guardar-mirando.test.ts lo mide con todas las plantillas).
//
// Puro (sin base): lo usa lib/graficos-tablero.ts (`guardarTableroSi`) y lo ejecuta tests/graficos-guardar-mirando.test.ts.
// =============================================================================

import type { Hoja, Tablero } from './graficos-catalogo';

/** Lo que dice la pantalla si se intenta guardar mirando algo que sólo se cambia editando. */
export const NO_SE_CAMBIA_MIRANDO = 'Mirando la hoja no se cambia su contenido. Para cambiarla, toca Editar.';

/** Lo de una hoja que también se cambia mirando (la cabecera y los filtros que se suman). */
const CAMBIA_MIRANDO: ReadonlySet<string> = new Set(['nombre', 'emoji', 'subtitulo', 'controles']);

/** JSON con las claves en orden y sin los `undefined`: dos objetos iguales dan el mismo texto armados como sea. */
export function canon(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : canon(v))).join(',')}]`;
  if (x && typeof x === 'object') {
    const claves = Object.keys(x as Record<string, unknown>).filter((k) => (x as Record<string, unknown>)[k] !== undefined).sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canon((x as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(x) ?? 'null';
}

/** ¿`despues` es `antes` con sólo lo que se cambia mirando? */
function mismaHojaMirando(antes: Hoja, despues: Hoja): boolean {
  const contenido = (h: Hoja) => canon(Object.fromEntries(Object.entries(h).filter(([k]) => !CAMBIA_MIRANDO.has(k))));
  if (contenido(antes) !== contenido(despues)) return false;
  // Los filtros que ya tenía, iguales; mirando sólo se SUMAN.
  const nuevos = new Map(despues.controles.map((c) => [c.id, canon(c)] as const));
  return antes.controles.every((c) => nuevos.get(c.id) === canon(c));
}

/**
 * `null` = se puede guardar mirando; si no, el texto para la persona. `antes` es lo GUARDADO (saneado) y `despues` lo que
 * llega (saneado). Sin nada guardado no se llama: no hay nada de la persona que cuidar.
 */
export function escrituraMirando(antes: Tablero, despues: Tablero): string | null {
  const previas = new Map([...antes.hojas, ...(antes.archivadas ?? [])].map((h) => [h.id, h] as const));
  const llegan = [...despues.hojas, ...(despues.archivadas ?? [])];
  for (const h of llegan) {
    const a = previas.get(h.id);
    // Una hoja que no estaba: se crea entera (una plantilla, una copia, lo que trajo un link).
    if (a && !mismaHojaMirando(a, h)) return NO_SE_CAMBIA_MIRANDO;
  }
  // Una hoja a la vista que desaparece sin pasar a Archivados: sólo la vacía que viaja adentro de un informe en blanco.
  const quedan = new Set(llegan.map((h) => h.id));
  if (!antes.enBlanco && antes.hojas.some((h) => !quedan.has(h.id))) return NO_SE_CAMBIA_MIRANDO;
  return null;
}
