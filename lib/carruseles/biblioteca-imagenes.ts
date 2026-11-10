// =============================================================================
// carruseles/biblioteca-imagenes — la biblioteca guarda imágenes NUESTRAS, nunca la URL de Instagram (9/11/2026)
// =============================================================================
// Martín, 9/11 a la noche, con la grilla de outliers de Image: «no podemos no visualizar bien los carruseles, se rompe todo el
// diseño. Y hay muchos que no tienen el botón para desplazar, todos deben tenerlo».
//
// Medido ese día en producción: 91 portadas visibles apuntaban al CDN de Instagram (y 27 de 60 de una muestra ya daban 403,
// aunque su `oe` decía que vencían al día siguiente), y 168 carruseles visibles no tenían láminas (sin láminas no hay flechas).
//
// ⚠️ LO OBVIO ERA «LAS URL VENCIERON», Y ERA LA MITAD. La causa era que la carga las GUARDABA: `guardarMiniaturas` corta a los
// 9 s (un tope pensado para una acción de Vercel) y, si una imagen no baja, devuelve la URL original «para no romper la lectura».
// Spy converge porque vuelve a leer cada hora; la biblioteca NO vuelve a leer una pieza nunca, así que lo que no bajó en esa
// vuelta quedaba con la URL de Instagram para siempre. Y una lámina que no bajaba dejaba al carrusel sin ninguna.
//
// La regla, que esto fija (tests/carruseles-biblioteca-imagenes.test.ts):
//   1. La portada que se guarda es NUESTRA: la bajada, o si no bajó, la lámina 1 ya bajada. Si ninguna es nuestra, la fila
//      va SIN la columna `miniatura`: una nueva queda sin portada (la pantalla dibuja su respaldo) y una que ya estaba
//      conserva la suya. Nunca se escribe una URL de Instagram.
//   2. Las láminas se guardan sólo si bajaron TODAS (una que falta en el medio cambia el carrusel); si no, la fila va sin la
//      columna y conserva las que tenía.
//   3. Un upsert de PostgREST con filas de columnas distintas pone NULL en las que le faltan a cada una (`defaultToNull`, el
//      default de supabase-js) y PISA lo guardado. Por eso las filas se mandan en grupos con las MISMAS columnas.
//
// Sin `server-only` a propósito: lo usa el script de la PC (scripts/carruseles-biblioteca.mts) y lo corre el test con
// bajadores falsos. Los de verdad (lib/spy-miniaturas.ts, ./biblioteca-servidor.ts) se pasan desde afuera.
// =============================================================================

/** Lo que hace falta para bajar: los bajadores de verdad en el script, unos falsos en el test. */
export type Bajadores = {
  /** Baja las portadas que no son nuestras y devuelve las piezas con su `miniatura` nueva (la original si no bajó). Nunca tira. */
  bajarPortadas: <T extends { canal: string; ref: string; miniatura?: string | null }>(piezas: readonly T[]) => Promise<T[]>;
  /** Las láminas de `ref` en nuestro bucket, en orden, o null si no bajaron todas. Nunca tira. */
  bajarLaminas: (ref: string, urls: readonly string[]) => Promise<string[] | null>;
  /** Si una URL ya es de nuestro bucket. */
  esNuestra: (url: string | null | undefined) => boolean;
};

/** La portada que se puede guardar: la nuestra, o la lámina 1 si es nuestra; si no, null (no se escribe la columna). */
export function portadaNuestra(
  miniatura: string | null | undefined, laminas: readonly string[] | null | undefined, esNuestra: Bajadores['esNuestra'],
): string | null {
  if (esNuestra(miniatura)) return miniatura as string;
  const primera = laminas?.[0];
  return primera && esNuestra(primera) ? primera : null;
}

/** Una fila de la tabla: sus columnas, con `ref`. */
export type FilaDePieza = Record<string, unknown> & { ref: string };
/** La fila lista para guardar: `miniatura` y `laminas_imagenes` vienen sólo si son NUESTRAS. */
export type FilaConImagenes = FilaDePieza & { miniatura?: string; laminas_imagenes?: string[] };

/**
 * Baja portada y láminas de cada fila y la deja lista para guardar con la regla de arriba: `miniatura` y `laminas_imagenes`
 * sólo si son nuestras; si no, la fila va SIN esa columna. `conLaminas` false (la 0404 sin aplicar) saca la columna siempre.
 */
export async function imagenesANuestroBucket(
  filas: readonly FilaDePieza[], b: Bajadores, o: { conLaminas: boolean },
): Promise<FilaConImagenes[]> {
  const conFoto = await b.bajarPortadas(filas.map((f) => ({
    ...f, canal: 'instagram', miniatura: typeof f.miniatura === 'string' ? f.miniatura : null,
  })));
  const out: FilaConImagenes[] = [];
  for (const f of conFoto) {
    const { canal: _c, miniatura, laminas_imagenes, ...resto } = f;
    const urls = Array.isArray(laminas_imagenes) ? laminas_imagenes.filter((u): u is string => typeof u === 'string' && !!u) : [];
    const laminas = o.conLaminas && urls.length ? await b.bajarLaminas(f.ref, urls) : null;
    const nuestras = laminas && laminas.length && laminas.every((u) => b.esNuestra(u)) ? laminas : null;
    const portada = portadaNuestra(typeof miniatura === 'string' ? miniatura : null, nuestras, b.esNuestra);
    out.push({
      ...resto,
      ...(portada ? { miniatura: portada } : {}),
      ...(nuestras ? { laminas_imagenes: nuestras } : {}),
    });
  }
  return out;
}

/**
 * Las filas en grupos con las MISMAS columnas, en el orden en que llegaron. Un upsert por grupo: así a ninguna fila le pone
 * NULL en una columna que no trae (y que en la base ya tenía un valor bueno).
 */
export function gruposParaUpsert<T extends Record<string, unknown>>(filas: readonly T[]): T[][] {
  const por = new Map<string, T[]>();
  for (const f of filas) {
    const clave = Object.keys(f).filter((k) => f[k] !== undefined).sort().join('|');
    const g = por.get(clave);
    if (g) g.push(f); else por.set(clave, [f]);
  }
  return [...por.values()];
}
