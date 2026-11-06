// =============================================================================
// carruseles/variedad — que las primeras filas no sean de un solo creador (6/11/2026)
// =============================================================================
// Martín, 6/11/2026, mirando el explorador en producción: «en el filtro de CTA pusiste puros de DenBorg, no creo que ella sea
// la que más carruseles haga». No era un error del orden: una cuenta con muchos carruseles fuertes llenaba la pantalla entera
// con «Mayor outlier». La regla: en CUALQUIER tramo de `ventana` tarjetas seguidas (una pantalla y un poco más), un mismo creador
// aparece como mucho `porVentana` veces, mientras no se filtre por cuenta (ahí se pidió ver a uno solo).
//
// «Sin bajar el orden elegido más de lo necesario»: se recorre la lista ya ordenada y en cada lugar va la PRIMERA que todavía
// entra (su creador no llenó el tramo). Lo que no entra no se tira: espera unos lugares y vuelve apenas el tramo lo deja. Si no
// queda ninguna que entre (pocos creadores), va la primera igual: la regla nunca deja un hueco ni esconde nada.
//
// Acotada a propósito: mira hasta `mirar` candidatas por lugar y sólo reordena los primeros `hasta` lugares (lo que alguien ve
// sin «Ver más» varias veces). Con 6.000 carruseles de una sola cuenta sería cuadrática; así son unos 50.000 pasos.
//
// La usan los carruseles, los anuncios y las miniaturas de YouTube (lib/thumbnails/explorar.ts). Pura, con su test
// (tests/carruseles-variedad.test.ts).
// =============================================================================

export type OpcionesVariedad = {
  /** Cuántas veces puede aparecer un creador en un tramo. */
  porVentana?: number;
  /** El largo del tramo (en tarjetas). */
  ventana?: number;
  /** Hasta qué lugar se reordena: de ahí en más, queda el orden de siempre. */
  hasta?: number;
  /** Cuántas candidatas se miran, como mucho, para cada lugar. */
  mirar?: number;
};

export const VARIEDAD_POR_DEFECTO = { porVentana: 2, ventana: 12, hasta: 240, mirar: 300 } as const;

/** La lista en el mismo orden, salvo lo que hace falta correr para que ningún creador llene un tramo. No cambia la cantidad. */
export function conVariedad<T>(xs: readonly T[], quien: (x: T) => string | number, o: OpcionesVariedad = {}): T[] {
  const porVentana = Math.max(1, Math.floor(o.porVentana ?? VARIEDAD_POR_DEFECTO.porVentana));
  const ventana = Math.max(porVentana + 1, Math.floor(o.ventana ?? VARIEDAD_POR_DEFECTO.ventana));
  const hasta = Math.max(0, Math.min(xs.length, Math.floor(o.hasta ?? VARIEDAD_POR_DEFECTO.hasta)));
  const mirar = Math.max(1, Math.floor(o.mirar ?? VARIEDAD_POR_DEFECTO.mirar));
  if (xs.length <= porVentana) return [...xs];

  const usada = new Uint8Array(xs.length);
  const out: T[] = [];
  /** Cuántas veces está cada creador en las últimas `ventana - 1` puestas. */
  const enTramo = new Map<string | number, number>();
  let primero = 0; // la primera que todavía no se puso
  for (let lugar = 0; lugar < hasta; lugar += 1) {
    while (primero < xs.length && usada[primero]) primero += 1;
    let elegida = -1;
    for (let i = primero, vistas = 0; i < xs.length && vistas < mirar; i += 1) {
      if (usada[i]) continue;
      vistas += 1;
      if ((enTramo.get(quien(xs[i])) ?? 0) < porVentana) { elegida = i; break; }
    }
    // Ninguna entra (quedan pocos creadores): va la primera, sin hueco.
    if (elegida < 0) elegida = primero;
    usada[elegida] = 1;
    const x = xs[elegida];
    out.push(x);
    const k = quien(x);
    enTramo.set(k, (enTramo.get(k) ?? 0) + 1);
    // La que sale del tramo deja su lugar.
    const sale = out.length - ventana;
    if (sale >= 0) {
      const ks = quien(out[sale]);
      const n = (enTramo.get(ks) ?? 0) - 1;
      if (n > 0) enTramo.set(ks, n); else enTramo.delete(ks);
    }
  }
  for (let i = 0; i < xs.length; i += 1) if (!usada[i]) out.push(xs[i]);
  return out;
}

/** El peor tramo: cuántas veces, como mucho, se repite un creador en `ventana` tarjetas seguidas de los primeros `hasta`. */
export function peorTramo<T>(xs: readonly T[], quien: (x: T) => string | number, ventana: number = VARIEDAD_POR_DEFECTO.ventana, hasta: number = VARIEDAD_POR_DEFECTO.hasta): number {
  let peor = 0;
  const n = Math.min(xs.length, hasta);
  for (let i = 0; i + 1 <= n; i += 1) {
    const cuenta = new Map<string | number, number>();
    for (let j = i; j < Math.min(n, i + ventana); j += 1) {
      const k = quien(xs[j]);
      const c = (cuenta.get(k) ?? 0) + 1;
      cuenta.set(k, c);
      if (c > peor) peor = c;
    }
  }
  return peor;
}
