// =============================================================================
// avatars-huerfanas — qué fotos de leads del bucket `avatars` ya no nombra nadie (6/11/2026, el barrido de pendientes)
// =============================================================================
// El bucket `avatars` es PÚBLICO (lib/fotos-contacto-ruta.ts). Hasta el 17/10/2026 la foto de WhatsApp de un lead se copiaba a
// `leads/<ws>/<lead>.jpg`, dos enteros chicos: cualquiera sin credencial se bajaba las caras recorriendo los números. La mudanza
// (`renombrarFotosAdivinables`, lib/fotos-contacto.ts) sólo mueve las que una fila VIVA nombra: las que quedaron sin fila (un lead
// borrado, una foto que se refrescó, una carrera) siguen ahí con el nombre adivinable (docs/relevo/seguridad-aislamiento.md).
// Lo corre `scripts/avatars-huerfanas.mts`, en seco primero.
//
// SIN `server-only`: puro, con test (tests/avatars-huerfanas.test.ts).
// =============================================================================

/** Una ruta de foto de un lead dentro del bucket: `leads/<ws>/<lead>.jpg` (vieja) o `leads/<ws>/<lead>-<32 hex>.jpg` (nueva). */
const RUTA_FOTO_RE = /^leads\/\d+\/\d+(?:-[0-9a-f]{32})?\.jpg$/;
/** La misma ruta, adentro de cualquier texto: una URL pública, una foto JSON de la papelera. */
const RUTA_EN_TEXTO_RE = /avatars\/(leads\/\d+\/\d+(?:-[0-9a-f]{32})?\.jpg)/g;

/** Una foto se borra sólo si tiene al menos esto: si no, la fila que la va a nombrar puede estar escribiéndose. */
export const EDAD_MINIMA_HUERFANA_MS = 24 * 60 * 60_000;

/** Las rutas de fotos de leads que nombra un texto (una URL de `foto_auto_url`, la foto JSON de un lead en la papelera). */
export function rutasNombradas(texto: string | null | undefined): string[] {
  if (!texto) return [];
  return [...texto.matchAll(RUTA_EN_TEXTO_RE)].map((m) => m[1]);
}

export type ObjetoBucket = { ruta: string; creado: string | null; bytes: number | null };

/**
 * De los objetos de una carpeta `leads/<ws>/`, cuáles son huérfanos: una foto de lead (con el formato de la casa), que ninguna fila
 * nombra (`nombradas`: las filas vivas, la papelera y los contactos), y con al menos `EDAD_MINIMA_HUERFANA_MS`. Un objeto sin fecha no
 * se toca (no se sabe si se está escribiendo); uno con otro formato tampoco (no es nuestro). `adivinable` = el formato viejo.
 */
export function huerfanas(objetos: readonly ObjetoBucket[], nombradas: ReadonlySet<string>, ahoraMs: number): {
  huerfanas: Array<ObjetoBucket & { adivinable: boolean }>;
  recientes: number;
  ajenos: number;
} {
  const out: Array<ObjetoBucket & { adivinable: boolean }> = [];
  let recientes = 0;
  let ajenos = 0;
  for (const o of objetos) {
    if (!RUTA_FOTO_RE.test(o.ruta)) { ajenos++; continue; }
    if (nombradas.has(o.ruta)) continue;
    const creado = o.creado ? Date.parse(o.creado) : NaN;
    if (!Number.isFinite(creado) || ahoraMs - creado < EDAD_MINIMA_HUERFANA_MS) { recientes++; continue; }
    out.push({ ...o, adivinable: /^leads\/\d+\/\d+\.jpg$/.test(o.ruta) });
  }
  return { huerfanas: out, recientes, ajenos };
}
