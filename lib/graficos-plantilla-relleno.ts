// =============================================================================
// graficos-plantilla-relleno — la plantilla que MaKo ajusta POR DETRÁS (#857, módulo puro)
// =============================================================================
// Martín, 16/10/2026: «al crear un general o un dashboard… salta un mensajito de revisando y un timer de cuánto lleva
// revisando y hasta dos minutos dice. Eso no debería ser así porque confunde al usuario». Desde el 17/10 la hoja de una
// plantilla aparece AL INSTANTE (la plantilla tal cual, cada gráfico con su cargando) y /api/graficos/plantilla la ajusta
// a los datos del negocio en el fondo: saca los gráficos que quedarían vacíos y MaKo suma otros. La ruta ajusta ESA hoja
// (con sus ids), así que lo que se queda ya tiene sus datos leídos y no se vuelve a pedir.
//
// Cuando llega la ajustada, reemplaza a la creada SÓLO si nadie la tocó: lo que hizo la persona en esos segundos gana.
// Moverla no cuenta (la grilla compacta lo que vino al montar, sin que nadie toque nada); cambiar un título, un filtro o
// agregar o borrar una pieza, sí.
// =============================================================================

import type { Hoja } from './graficos-catalogo';

/** La hoja sin las posiciones de sus piezas: lo que la persona pudo cambiar a propósito. */
const forma = (h: Hoja): string => JSON.stringify({ ...h, componentes: h.componentes.map((c) => ({ ...c, x: 0, y: 0, w: 0, h: 0 })) });

/** ¿La hoja de ahora es la que se creó desde la plantilla, salvo dónde quedó cada pieza? */
export function sigueComoSeCreo(creada: Hoja, actual: Hoja): boolean {
  return creada.id === actual.id && forma(creada) === forma(actual);
}
