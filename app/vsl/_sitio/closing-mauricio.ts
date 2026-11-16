// =============================================================================
// El «antes y después» de Closing con datos REALES de Mauricio (16/11/2026, leídos en sólo lectura de su espacio)
// =============================================================================
// Martín: «utiliza de las que tenemos grabadas ahí con Mauricio, eso lo puede utilizar sin problema… no debería tener tanto texto».
// Después: «en lugar de poner puntuación… la tasa de closing o la cantidad de cierres»; «que aparezcan cosas como negativas que
// pasan… una objeción o que le parece muy caro… y que luego se vea una parte dentro de MaKo… que pase de tantas llamadas cerradas a
// tantas»; y «que sean objeciones más típicas».
// - Los cierres: los de su CRM (la columna `cerro`, por su fecha de cierre), por trimestre de 2026. La tasa: cierres / primeras
//   reuniones a las que fue el prospecto (`asistio_j1`, por la fecha de la primera reunión). Enero a marzo: 0 de 8; abril a junio: 9
//   de 27 (1 en abril, 3 en mayo, 5 en junio).
// - Analizadas y score: las llamadas de venta que analizó el Closing Analyst de abril a junio (41) y su score promedio (6,65).
// - Las objeciones: las de una llamada de venta suya del 15/05/2026 (110 min, la segunda reunión): la plata ya comprometida, el socio
//   que decide con él y el tiempo, con el minuto en que las marcó el análisis y si se respondieron. De cada una, SÓLO una categoría
//   escrita por nosotros: ni frases, ni nombres, ni las notas del análisis (son de terceros).
// Lo dibuja ./ClosingAntesDespues.tsx.
export const CLOSING_MAURICIO = {
  antes: { periodo: 'Ene–Mar', cierres: 0, reuniones: 8 },
  despues: { periodo: 'Abr–Jun', cierres: 9, reuniones: 27, analizadas: 41, score: '6.7' },
  /** Cierres y lo vendido de cada mes (el CRM: `cerro` y `monto_cierre_usd` por su fecha de cierre). Abril a junio: US$58.200. */
  porMes: [
    { mes: 'Ene', cierres: 0, usd: 0 }, { mes: 'Feb', cierres: 0, usd: 0 }, { mes: 'Mar', cierres: 0, usd: 0 },
    { mes: 'Abr', cierres: 1, usd: 7000 }, { mes: 'May', cierres: 3, usd: 20500 }, { mes: 'Jun', cierres: 5, usd: 30700 },
  ],
  /** El embudo de abril a junio (personas, del CRM): primeras reuniones a las que fue el prospecto, segundas y ventas. */
  embudo: [
    { paso: 'Primeras reuniones', n: 27 },
    { paso: 'Segundas reuniones', n: 10 },
    { paso: 'Ventas', n: 9 },
  ],
  /** El score promedio de sus llamadas de venta analizadas, semana por semana (del 30/03 al 15/06/2026). */
  scorePorSemana: [7.2, 7.1, 5.8, 6.2, 6, 5, 5.5, 7, 6.9, 7.4, 7.5, 6],
  /** Llamadas analizadas de abril a junio: la duración y el score son de llamadas reales de Mauricio; los nombres son INVENTADOS
   *  (Martín: «llamada con Lucrecia o clientes así potenciales inventados»). `avanzo`: el análisis la marcó como que avanzó. */
  llamadas: [
    { con: 'Lucrecia', min: 87, score: '8.0', avanzo: true },
    { con: 'Tomás', min: 73, score: '7.5', avanzo: true },
    { con: 'Valeria', min: 92, score: '7.2', avanzo: true },
    { con: 'Andrés', min: 110, score: '5.5', avanzo: false },
  ],
  llamada: {
    duracionMin: 110,
    /** El score que le puso el análisis a esa llamada (de 0 a 10). */
    score: '5.5',
    objeciones: [
      { tipo: 'No tiene el dinero ahora', segundo: 4190, respondida: false },
      { tipo: 'Lo habla con su socio', segundo: 4312, respondida: false },
      { tipo: 'No tiene tiempo ahora', segundo: 4815, respondida: true },
    ],
  },
} as const;

/** La tasa de cierre en porcentaje entero (0 de 8 → 0; 9 de 27 → 33). */
export const tasaDe = (p: { cierres: number; reuniones: number }) => (p.reuniones ? Math.round((p.cierres / p.reuniones) * 100) : 0);
