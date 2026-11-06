// MaKo (no está en Polar): cuánto ancho ocupa cada gráfico de un MetricGroup.
//
// La grilla de Polar (MetricGroup.tsx) es de 1 columna, 2 desde `lg` y 3 desde `2xl`, con el primer gráfico a dos columnas.
// Con sus métricas de costos (cinco) las filas quedan llenas; con las dos que MaKo puede llenar (el gasto y el acumulado) el
// segundo quedaba solo con media fila vacía al lado (Analytics › Costs, 6/11/2026). Con `completarFila`, el ÚLTIMO estira
// lo que falta de su fila en cada ancho. Las clases van escritas enteras: Tailwind las encuentra leyendo el fuente.
// Puro: lo prueba tests/admin-polar-arreglos-2.test.ts.

export function claseDeAncho(index: number, total: number, completarFila = false): string {
  const clases: string[] = []
  if (index === 0) clases.push('lg:col-span-2')
  if (!completarFila || index !== total - 1 || total < 1) return clases.join(' ')

  // `lg` (2 columnas): el primero ocupa una fila entera; después, de a dos.
  const sobraLg = total === 1 ? 0 : (total - 1) % 2
  // `2xl` (3 columnas): el primero (2) y el segundo (1) llenan la primera fila; después, de a tres.
  const sobra2xl = total === 1 ? 2 : (total - 2) % 3

  if (index !== 0 && sobraLg === 1) clases.push('lg:col-span-2')
  if (sobra2xl === 2) clases.push(index === 0 ? '2xl:col-span-3' : '2xl:col-span-2')
  else if (sobra2xl === 1) clases.push('2xl:col-span-3')
  else if (index !== 0 && sobraLg === 1) clases.push('2xl:col-span-1')
  return clases.join(' ')
}
