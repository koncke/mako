// =============================================================================
// La pila del celular: qué pieza mide lo que dibuja y cuál conserva el alto de la grilla
// =============================================================================
// En el celular el editor no dibuja la grilla de 12 columnas: va una tarjeta debajo de la otra (EditorInforme, `angosto`).
// Una tarjeta con el alto del escritorio deja, abajo de lo que dibuja, el hueco que en la grilla llenaba su vecina: «Estancadas»
// (4 filas) o «Las llamadas» dejaban media pantalla en blanco (capturas del arnés, 15/10/2026). Lo que es HTML y se mide solo
// pasa a medir lo que dibuja; lo de recharts necesita un alto para dibujar y lo conserva.
//
// Vive aparte para que lo lean EditorInforme y el arnés de capturas (que lo copiaba a mano y se quedaba viejo).

import type { Grafico } from '@/lib/graficos-catalogo';

/** Los tipos de gráfico que en la pila miden lo que dibujan (HTML que se mide solo). */
export const ALTO_LIBRE_EN_PILA: ReadonlySet<string> = new Set([
  'barra_proporcion', 'numero', 'numero_compacto', 'tabla', 'tabla_barras', 'tabla_calor', 'dinamica', 'dinamica_barras', 'dinamica_calor',
  'tarjetas', 'tramos',
]);

/**
 * Las barras horizontales son HTML (BarrasGordas) cuando no se apilan, no se desglosan y tienen hasta dos métricas: es la
 * misma condición con la que app/dashboard/Grafico.tsx elige BarrasGordas. Apiladas o desglosadas son de recharts.
 */
export const esBarrasGordas = (g: Grafico): boolean => g.tipo === 'barras' && !g.desglose && g.metricas.length <= 2;

/** ¿Este gráfico, en la pila, mide lo que dibuja? Una PORTADA no: mide sus filas de portada (lib/graficos-identidad.ts). */
export const graficoAltoLibreEnPila = (g: Grafico): boolean => !g.portada && (ALTO_LIBRE_EN_PILA.has(g.tipo) || esBarrasGordas(g));

/** Los elementos que en la pila miden lo que dibujan (una forma o un video, no: su caja ES su tamaño). */
export const ELEMENTOS_ALTO_LIBRE_EN_PILA: ReadonlySet<string> = new Set(['texto', 'enlace', 'seccion', 'accion', 'ia']);

/**
 * En la pila los números van de a dos; el último de un grupo IMPAR quedaba solo en media fila, con la otra mitad vacía
 * («Estancadas», «Atraso promedio», «Agendaron desde la página»: capturas del 15/10/2026). Devuelve esos ids: van a lo
 * ancho (`.lk-comp--solo`, editor-css.ts). `deADos` dice qué pieza va de a dos (un número que no es titular ni portada);
 * cualquier otra corta el grupo.
 */
export function solosEnPila<T extends { id: string }>(orden: readonly T[], deADos: (c: T) => boolean): ReadonlySet<string> {
  const solos = new Set<string>();
  let corrida: T[] = [];
  const cerrar = () => {
    if (corrida.length % 2 === 1) solos.add(corrida[corrida.length - 1].id);
    corrida = [];
  };
  for (const c of orden) {
    if (deADos(c)) corrida.push(c);
    else cerrar();
  }
  cerrar();
  return solos;
}
