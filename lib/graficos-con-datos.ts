// =============================================================================
// graficos-con-datos — una hoja armada con lo que el negocio TIENE: sin los gráficos vacíos, y con los que MaKo suma
// =============================================================================
// Pedido de Martín (reunión del 12/10/2026, 103:41), textual: «otro feedback que me doy en la parte del dashboard es que
// al momento de crear un template, debería analizar qué métricas tiene ese negocio disponible y crear los gráficos
// alrededor de esa métrica y no crear un montón de gráficos vacíos… tiene que crear el template, ya no solamente con los
// gráficos predefinidos, sino que elegir qué gráficos quitar o qué gráficos agregar, pero que tengan datos, que esté
// conectado a los datos automáticamente».
//
// Lo puro vive acá (con test); medir y llamar a la IA, en lib/graficos-con-datos-server.ts. Las reglas:
//   · «VACÍO» ES LA REGLA DE LA TARJETA (`sinDatos`, lib/graficos-agregar.ts): lo que la pantalla dibujaría «Sin datos
//     en este período» con el período de la hoja. Con otra regla, la plantilla quitaría lo que la tarjeta dibuja.
//   · «NO PUDE LEER» NO ES «VACÍO» (`'nose'`): un lector caído o que se pasó del plazo deja el gráfico. Quitar algo por
//     un timeout es inventar un dato.
//   · SI NINGUNO TIENE DATOS, LA HOJA QUEDA COMO ESTABA (`sinNada`): una hoja sin un gráfico no le sirve a nadie, y la
//     plantilla entera al menos muestra qué va a medir cuando lleguen los datos. El aviso lo dice.
//   · Lo que QUEDA SIN SENTIDO al sacar un gráfico se va con él: una caja de «Conclusiones de MaKo» que sólo leía
//     gráficos quitados (vacía, no leería nada) y una sección que se queda sin nada debajo. Los textos se quedan.
//   · UNA FILA que perdió tarjetas se vuelve a llenar a lo ancho (`rellenarFilas`), sólo si es una fila «limpia» (todas
//     con la misma fila y el mismo alto): una fila de cuatro KPI que pierde dos queda con dos de media fila, no con un
//     hueco a la derecha. Lo vertical lo compacta la grilla sola.
//   · LO QUE SUMA MaKo va ABAJO (`agregarAlFinal`), con ids nuevos, sin repetir un gráfico que ya está (mismo conjunto,
//     tipo, métricas, dimensión y desglose) y hasta un tope.
// =============================================================================

import { COLS, abajoDeTodo, nuevoId, type Componente, type Grafico, type Hoja } from './graficos-catalogo';
import { esCierre, esSeccion } from './graficos-secciones';

/** Lo que dio leer un gráfico: con datos, vacío (lo que la tarjeta dibujaría «Sin datos»), o no se pudo leer. */
export type Medida = 'con' | 'sin' | 'nose';

/** Lo más que suma MaKo a una plantilla. */
export const TOPE_AGREGADOS = 4;

type Caja = { id: string; x: number; y: number; w: number; h: number };

/**
 * Las filas que perdieron tarjetas, llenas otra vez a lo ancho. `antes`: las cajas de ANTES de quitar. Sólo una fila
 * LIMPIA (antes, todas sus cajas en la misma `y` y con el mismo `h`, sin nada más alto que la cruce) se reparte: el
 * ancho que quedó libre se reparte entre las que quedaron, en proporción, y se vuelven a poner de izquierda a derecha.
 */
export function rellenarFilas<T extends Caja>(quedan: readonly T[], antes: readonly Caja[]): T[] {
  const porY = new Map<number, Caja[]>();
  for (const c of antes) porY.set(c.y, [...(porY.get(c.y) ?? []), c]);
  const cambios = new Map<string, { x: number; w: number }>();
  for (const [y, fila] of porY) {
    const h = fila[0].h;
    if (fila.some((c) => c.h !== h)) continue;
    // Algo más alto que empieza ARRIBA y cruza esta fila: no es una fila limpia.
    if (antes.some((c) => c.y < y && c.y + c.h > y)) continue;
    const vivas = quedan.filter((c) => c.y === y).sort((a, b) => a.x - b.x);
    if (!vivas.length || vivas.length === fila.length) continue;
    const ancho = Math.min(COLS, fila.reduce((s, c) => s + c.w, 0));
    const usado = vivas.reduce((s, c) => s + c.w, 0);
    if (usado >= ancho) continue;
    let x = 0;
    vivas.forEach((c, i) => {
      const w = i === vivas.length - 1 ? ancho - x : Math.max(1, Math.round((c.w * ancho) / usado));
      cambios.set(c.id, { x, w });
      x += w;
    });
  }
  return quedan.map((c) => (cambios.has(c.id) ? { ...c, ...cambios.get(c.id)! } : c));
}

/**
 * LA HOJA SIN LOS GRÁFICOS VACÍOS (sólo los de la hoja: lo de un pop-up se lee cuando se abre). `quitados`: cuántos
 * gráficos se fueron. `sinNada`: ninguno medido tenía datos, y la hoja vuelve tal cual.
 */
export function podarSinDatos(h: Hoja, medidas: ReadonlyMap<string, Medida>): { hoja: Hoja; quitados: number; sinNada: boolean } {
  const graficos = h.componentes.filter((c): c is Grafico => c.clase === 'grafico');
  const vacios = new Set(graficos.filter((g) => medidas.get(g.id) === 'sin').map((g) => g.id));
  if (!vacios.size) return { hoja: h, quitados: 0, sinNada: false };
  if (!graficos.some((g) => medidas.get(g.id) === 'con')) return { hoja: h, quitados: 0, sinNada: true };

  let quedan: Componente[] = h.componentes.filter((c) => !vacios.has(c.id));
  // Una caja de MaKo que leía SÓLO gráficos quitados no leería nada; si leía otros, sigue con esos.
  quedan = quedan.flatMap((c) => {
    if (c.clase !== 'elemento' || c.tipo !== 'ia' || !c.ia?.fuentes) return [c];
    const fuentes = c.ia.fuentes.filter((id) => !vacios.has(id));
    if (!fuentes.length && c.ia.fuentes.length) return [];
    return [fuentes.length === c.ia.fuentes.length ? c : { ...c, ia: { ...c.ia, fuentes } }];
  });
  // Una sección que se quedó sin nada debajo (hasta la siguiente sección) se va. Un cierre se queda: no agrupa nada.
  const secciones = quedan.filter(esSeccion).sort((a, b) => a.y - b.y || a.x - b.x);
  const vaciasDeSeccion = new Set(secciones.filter((s, i) => {
    if (esCierre(s)) return false;
    const tope = secciones[i + 1]?.y ?? Number.POSITIVE_INFINITY;
    return !quedan.some((c) => !esSeccion(c) && c.y >= s.y && c.y < tope);
  }).map((s) => s.id));
  quedan = quedan.filter((c) => !vaciasDeSeccion.has(c.id));

  const componentes = rellenarFilas(quedan, h.componentes);
  const ids = new Set(componentes.map((c) => c.id));
  const conectores = (h.conectores ?? []).filter((k) => ids.has(k.desde) && ids.has(k.hasta));
  const hoja: Hoja = { ...h, componentes };
  if (conectores.length) hoja.conectores = conectores;
  else delete hoja.conectores;
  return { hoja, quitados: vacios.size, sinNada: false };
}

/** La firma de un gráfico para no sumar uno que ya está: mismo conjunto, tipo, métricas, dimensión y desglose. */
export const firmaDeGrafico = (g: Pick<Grafico, 'fuente' | 'tipo' | 'metricas' | 'dimension' | 'desglose'>): string =>
  [g.fuente, g.tipo, [...g.metricas].sort().join('+'), g.dimension ?? '', g.desglose ?? ''].join('|');

/**
 * LO QUE SUMA MaKo, abajo de todo: sólo gráficos (sus textos no), con ids nuevos, sin repetir uno que ya está, hasta
 * `tope`. Conservan su lugar relativo (los acomodó `acomodar`, lib/graficos-ia.ts), corridos debajo de la hoja.
 */
export function agregarAlFinal(h: Hoja, extra: readonly Componente[], tope = TOPE_AGREGADOS): { hoja: Hoja; agregados: number } {
  const ya = new Set(h.componentes.filter((c): c is Grafico => c.clase === 'grafico').map(firmaDeGrafico));
  const nuevos: Grafico[] = [];
  for (const c of extra) {
    if (nuevos.length >= tope) break;
    if (c.clase !== 'grafico') continue;
    const f = firmaDeGrafico(c);
    if (ya.has(f)) continue;
    ya.add(f);
    nuevos.push(c);
  }
  if (!nuevos.length) return { hoja: h, agregados: 0 };
  const base = abajoDeTodo(h.componentes);
  const arriba = Math.min(...nuevos.map((c) => c.y));
  const corridos = nuevos.map((c) => ({ ...c, id: nuevoId(), y: base + (c.y - arriba), controles: c.controles.map((k) => ({ ...k, id: nuevoId() })) }));
  return { hoja: { ...h, componentes: [...h.componentes, ...corridos] }, agregados: corridos.length };
}

/** El aviso (toast) de lo que pasó: corto. null = no hubo nada que decir. */
export function avisoConDatos(p: { quitados: number; agregados: number; sinNada: boolean }): string | null {
  if (p.sinNada) return 'Todavía sin datos';
  const partes = [
    ...(p.quitados ? [`${p.quitados} ${p.quitados === 1 ? 'vacío quitado' : 'vacíos quitados'}`] : []),
    ...(p.agregados ? [`${p.agregados} con tus datos`] : []),
  ];
  return partes.length ? partes.join(' · ') : null;
}
