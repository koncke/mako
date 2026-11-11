// =============================================================================
// Las miniaturas se bajan ANTES de animar (Martín, 4/11/2026)
// =============================================================================
// «Donde sale MaKo, previo a la animación, no debería haber absolutamente nada más en pantalla… muchas veces aparecen
// tarjetas vacías sin la miniatura, y segundos después… ahí aparece la miniatura». Lo usan las dos animaciones de Spy: la
// película del orden (OrdenSpy.tsx) y el gráfico del detalle (GraficoSpy.tsx). Una pieza, no dos copias.

/**
 * Lo más que se espera a las miniaturas antes de arrancar: las que no llegaron entran con su texto (ninguna caja vacía). Era 8 s:
 * en una ficha de 180 miniaturas del CDN de Meta, la entrada podía quedarse 8 s en la criatura (Martín, 4/11/2026: «que cargue más
 * rápido»). 3 s alcanza para las primeras, que son las que se ven llegar.
 */
export const TOPE_PRECARGA_MS = 3_000;

export const espera = (ms: number) => new Promise<void>((r) => { window.setTimeout(r, ms); });

/**
 * Baja una miniatura y espera a que se pueda pintar. Resuelve `true` si quedó lista, `false` si falló. Nunca rechaza.
 * ⚠️ `referrerPolicy = 'no-referrer'`, como la `<img>` que la dibuja: con otro, el CDN de Meta contesta 403.
 */
export function precargar(url: string): Promise<boolean> {
  return new Promise((listo) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { void img.decode().then(() => listo(true), () => listo(true)); };
    img.onerror = () => listo(false);
    img.src = url;
  });
}

/**
 * Baja todas y devuelve las que quedaron listas, sin esperar más que `TOPE_PRECARGA_MS`.
 *
 * ⚠️ LAS QUE LLEGAN DESPUÉS DEL TOPE NO SE TIRAN (10/11/2026, prueba en producción). Antes, lo que no llegaba en 3 s quedaba
 * para siempre como la tarjetita de color con el logo de la red: con Leila Hormozi, ~12 portadas de 180 en el gráfico (cada
 * una pesa ~250 KB), aunque las 180 estaban guardadas y respondían bien. Con `alTerminar`, cuando terminan TODAS se avisa el
 * juego completo, una sola vez, y quien dibuja las pone en su lugar.
 */
export async function precargarTodas(
  urls: ReadonlyArray<{ id: number; url: string }>,
  alTerminar?: (ok: Set<number>) => void,
): Promise<Set<number>> {
  const ok = new Set<number>();
  const todas = Promise.all(urls.map((m) => precargar(m.url).then((v) => { if (v) ok.add(m.id); })));
  const aTiempo = await Promise.race([todas.then(() => true), espera(TOPE_PRECARGA_MS).then(() => false)]);
  if (!aTiempo && alTerminar) void todas.then(() => alTerminar(new Set(ok)));
  return new Set(ok);
}

/** «Reducir movimiento» del sistema: con eso no se anima nada. */
export const quieto = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
