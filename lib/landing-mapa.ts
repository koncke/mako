// =============================================================================
// El mapa de calor de una página: dispositivo, ubicación de cada toque y ranking
// =============================================================================
// Pedido de Martín (06/10/2026): «tienes que implementar el mapa de calor en
// Landing Analyst». Era lo único de Clarity sin reemplazo.
//
// SIN `server-only`: estas son las decisiones que se pueden equivocar (en qué
// cubo cae un toque, dónde se lo dibuja) y tienen que poder ejecutarse en un test.
// Las usan el lector del server (lib/landing-mapa-server.ts) y la pantalla.
//
// DE DÓNDE SALEN LOS TOQUES: `vsl_events` con `clic_x` puesto (Pixel v20+) — los
// clics en botones y enlaces ('click') y los toques en algo que no es un botón
// ('clic_vacio'). Desde la v22 cada toque trae además su ANCLA: el elemento tocado
// (`sel`) y dónde dentro de su caja (`rel_x`/`rel_y`, en milésimos).
// =============================================================================

/** El corte entre celular y computadora, en px CSS de ancho de ventana.
 *  Medido el 06/10/2026: los celulares van de 360 a 430 y las computadoras de 1200
 *  a 1920. Una tablet en vertical (768) cae del lado de la computadora. */
export const CORTE_MOVIL = 768;

export type Dispositivo = 'movil' | 'escritorio';

/** Desde qué versión del Pixel un toque trae su punto (v20) y su ancla (v22). */
export const PIXEL_PUNTO_DESDE = 20;
export const PIXEL_ANCLA_DESDE = 22;

/** Ventana por defecto, en días. */
export const MAPA_DIAS = 30;

export function dispositivoDe(ancho: number | null | undefined): Dispositivo | null {
  if (typeof ancho !== 'number' || !Number.isFinite(ancho) || ancho <= 0) return null;
  return ancho < CORTE_MOVIL ? 'movil' : 'escritorio';
}

/** Un toque, tal como lo devuelve el server. Sin datos de la persona: el visitante
 *  viaja sólo como un número para contar personas distintas. */
export type ToqueMapa = {
  tipo: 'click' | 'clic_vacio';
  /** Punto en la PÁGINA (px CSS), el ancho de la ventana y el alto del documento. */
  x: number; y: number; vw: number; dh: number | null;
  /** El ancla (v22): ruta CSS del elemento y dónde dentro de él (0..1000). */
  sel: string | null; rx: number | null; ry: number | null;
  /** Alto de la ventana (v22): la línea del pliegue. */
  vh: number | null;
  /** El elemento era fijo (se mueve con la pantalla). null = el Pixel no lo midió. */
  fijo: boolean | null;
  /** Qué se tocó, para el ranking: el destino del botón, o la etiqueta del elemento. */
  etiqueta: string;
  /** Persona distinta (índice), para contar personas sin mandar su id. */
  p: number;
};

/**
 * Dónde dibujar un toque SIN su ancla, sobre una foto de ancho `W` y alto `H`.
 *
 * Es el respaldo de los toques de la v20/v21 (punto de página, sin elemento):
 *   · en el celular la página ocupa todo el ancho, así que x se escala por W/vw;
 *   · en la computadora el contenido suele estar CENTRADO con un ancho máximo, así
 *     que x se corre desde el centro (escalar lo estiraría hacia los costados);
 *   · y se escala por H/alto del documento. ⚠️ Es aproximado: medido el 06/10/2026,
 *     el alto del documento en la misma página y el mismo ancho varió 3.518-4.650
 *     px. Por eso la v22 manda el ancla, y el ancla gana cuando existe.
 *
 * Un elemento FIJO no se ubica por su punto de página — se mueve con la pantalla,
 * así que su y de página es dónde estaba el scroll, no dónde está el botón. Sin
 * ancla, no se dibuja (se cuenta aparte).
 */
export function ubicarPorPunto(t: Pick<ToqueMapa, 'x' | 'y' | 'vw' | 'dh' | 'fijo'>, W: number, H: number, disp: Dispositivo): { x: number; y: number } | null {
  if (t.fijo === true) return null;
  if (!(W > 0) || !(H > 0) || !(t.vw > 0)) return null;
  const x = disp === 'movil' ? (t.x * W) / t.vw : W / 2 + (t.x - t.vw / 2);
  const y = t.dh && t.dh > 0 ? (t.y * H) / t.dh : t.y;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > W || y > H) return null;
  return { x, y };
}

/** Dónde dibujar un toque CON su ancla, dada la caja del elemento en la foto. */
export function ubicarPorAncla(t: Pick<ToqueMapa, 'rx' | 'ry'>, caja: { left: number; top: number; width: number; height: number }): { x: number; y: number } | null {
  if (t.rx == null || t.ry == null) return null;
  if (!(caja.width > 0) || !(caja.height > 0)) return null;
  return { x: caja.left + (t.rx / 1000) * caja.width, y: caja.top + (t.ry / 1000) * caja.height };
}

/**
 * El selector del toque, sólo si está ANCLADO (`body > …` o `#id`); si no, `null`.
 *
 * ⚠️ Un selector suelto no identifica un elemento. El Pixel sube como mucho 8 niveles
 * buscando `body` o un id, y si no llega manda el sufijo que juntó — que en un sitio de
 * Elementor con el mismo botón repetido coincide con los DOS, y `querySelector` devuelve
 * el primero: todos los toques del segundo se dibujaban sobre el primero, y el ranking
 * los fundía en una fila (revisión del 06/10/2026). El Pixel dejó de mandarlo, pero el
 * código que ya está pegado en las páginas lo sigue mandando: por eso se corta acá, que
 * es por donde pasan todos, y el toque cae a su punto.
 */
export function selAnclado(sel: string | null | undefined): string | null {
  if (!sel) return null;
  return sel.startsWith('body > ') || sel.startsWith('#') ? sel : null;
}

export type FilaRanking = { clave: string; etiqueta: string; sel: string | null; toques: number; personas: number };

/**
 * Lo más tocado: la tabla que acompaña al mapa (y lo reemplaza cuando no hay foto).
 *
 * Se agrupa por ELEMENTO cuando hay ancla (dos botones que dicen lo mismo son dos
 * filas: la gente tocó dos lugares distintos) y por lo que se tocó cuando no.
 * Personas distintas al lado de los toques: el toque número trece de la misma
 * persona en el mismo lugar no informa.
 */
export function rankingDe(toques: ToqueMapa[], tope = 8): { filas: FilaRanking[]; resto: number } {
  const m = new Map<string, { etiqueta: string; sel: string | null; toques: number; personas: Set<number> }>();
  for (const t of toques) {
    const clave = t.sel ? `sel:${t.sel}` : `et:${t.tipo}:${t.etiqueta}`;
    let a = m.get(clave);
    if (!a) { a = { etiqueta: t.etiqueta, sel: t.sel, toques: 0, personas: new Set() }; m.set(clave, a); }
    a.toques++;
    a.personas.add(t.p);
  }
  const todas = [...m.entries()]
    .map(([clave, a]) => ({ clave, etiqueta: a.etiqueta, sel: a.sel, toques: a.toques, personas: a.personas.size }))
    // Por personas, después por toques, y el desempate es la clave: un orden
    // inestable hace que la tabla cambie de lugar sola entre dos lecturas.
    .sort((x, y) => y.personas - x.personas || y.toques - x.toques || (x.clave < y.clave ? -1 : 1));
  return { filas: todas.slice(0, tope), resto: Math.max(0, todas.length - tope) };
}

/**
 * La rampa del calor: un solo tramo de tonos VECINOS (amarillo → naranja → rojo),
 * de transparente a opaco.
 *
 * ⚠️ NO es un arcoíris (azul→verde→rojo): la regla de los gráficos de la casa pide
 * un tono para la magnitud, y la única excepción multi-tono es el «calor
 * semántico» de vecinos cálidos, SIEMPRE con su escala a la vista. Y no es azul a
 * propósito: el mapa va encima de la página del cliente, y un azul se confunde con
 * sus propios botones.
 */
export function colorDeCalor(t: number): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, t));
  // Tres paradas: amarillo cálido, naranja, rojo profundo.
  const paradas: Array<[number, [number, number, number]]> = [
    [0, [255, 214, 92]],
    [0.5, [245, 124, 38]],
    [1, [196, 30, 42]],
  ];
  let i = 0;
  while (i < paradas.length - 2 && v > paradas[i + 1][0]) i++;
  const [t0, c0] = paradas[i];
  const [t1, c1] = paradas[i + 1];
  const k = t1 > t0 ? (v - t0) / (t1 - t0) : 0;
  const rgb = [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number];
  // La opacidad crece con la densidad: lo poco casi no tapa la página.
  const alfa = Math.round(70 + 160 * v);
  return [rgb[0], rgb[1], rgb[2], alfa];
}
