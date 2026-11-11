// =============================================================================
// traida-por — ¿de qué negocio es una fila que entró por «Traer tu outlier»? (11/11/2026)
// =============================================================================
// Las bibliotecas de ejemplos son GLOBALES (de la plataforma) y lo que un negocio trae por su link vive en la misma tabla con su
// `workspace_id`: los carruseles (mig 0413, lib/carruseles/biblioteca.ts → `seMuestraA`) y las miniaturas de YouTube (mig 0414,
// lib/thumbnails/explorar.ts → `seVeThumbnail`). Una sola lectura del número para las dos: el bigint de la base llega como
// número o como texto, y nada raro (0, negativo, decimal, texto) cuenta como negocio.
//
// Puro y sin dependencias: lo usan la pantalla, el servidor y los tests.
// =============================================================================

/** El negocio que trajo esta fila por su link, o null si es de la plataforma (o la columna todavía no existe). */
export function traidaPor(p: { workspace_id?: unknown } | Record<string, unknown>): number | null {
  const v = (p as { workspace_id?: unknown }).workspace_id;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
