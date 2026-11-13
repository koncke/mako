// =============================================================================
// sin-codigos-de-negocio — un texto para personas nombra el NEGOCIO, nunca «ws9» (13/11/2026)
// =============================================================================
// En la prueba del grupo de la app del ws9, MaKo contestó «Este resumen es de la cuenta de este grupo, ws9» y «en esta cuenta (ws9)».
// Martín, 24/10/2026: «No me digas más "ws9" porque yo no entiendo ID o códigos... Dime nombres» (memoria `nombres-no-codigos`). El
// modelo copia el número de lo que ve en su contexto; el prompt no alcanza. Esto lo cambia en la SALIDA del turno (lib/mako-doer-in.ts,
// `partes`), como `alTuteo`: lo que sale al grupo y lo que queda en la memoria.
//
// ⚠️ Un link no se toca: `?ws=9` lleva `=` y queda afuera. Lo que va entre «…» o entre `…` tampoco: son palabras de la persona o un dato.
// ⚠️ Quien llama decide qué nombres se pueden decir: en el grupo de un cliente, sólo el suyo (un número de otro negocio no puede
// convertirse en su nombre ahí). Lo que no tiene nombre dice `porDefecto`.
// Puro y sin `server-only`: lo prueba tests/sin-codigos-de-negocio.test.ts.
// =============================================================================

/** «ws9», «WS 13», «ws#21». No: «?ws=9», «news9», «ws9x». */
const CODIGO = /(?<![\p{L}\p{N}?&=/._-])ws\s?#?(\d{1,7})(?![\p{L}\p{N}=])/giu;

/** Los números de negocio que nombra un texto, sin repetir y fuera de «…» y `…`. */
export function idsDeNegocioEn(texto: string): number[] {
  const ids = new Set<number>();
  for (const tramo of tramosLibres(texto)) for (const m of tramo.matchAll(CODIGO)) ids.add(Number(m[1]));
  return [...ids];
}

/** Lo que va entre «…» y `…` no se toca; el resto sí. */
function tramosLibres(texto: string): string[] {
  return String(texto ?? '').split(/(«[^»]*»|`[^`]*`)/).filter((t) => !t.startsWith('«') && !t.startsWith('`'));
}

/** El texto con cada «wsN» cambiado por el nombre de ese negocio, o por `porDefecto`. «Martín Koncke (Martín Koncke)» queda en uno. */
export function sinCodigosDeNegocio(texto: string, nombres: ReadonlyMap<number, string>, porDefecto = 'este negocio'): string {
  if (!texto || !/ws/i.test(texto)) return texto;
  return texto.split(/(«[^»]*»|`[^`]*`)/).map((tramo) => {
    if (tramo.startsWith('«') || tramo.startsWith('`')) return tramo;
    const cambiado = tramo.replace(CODIGO, (_m, n: string) => nombres.get(Number(n))?.trim() || porDefecto);
    return cambiado.replace(/([^\n()]{2,80}?) \(\s*\1\s*\)/gu, '$1');
  }).join('');
}
