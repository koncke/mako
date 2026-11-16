// =============================================================================
// El «antes y después» de Closing con datos REALES de Mauricio (16/11/2026, leídos en sólo lectura de su espacio)
// =============================================================================
// Martín: «utiliza de las que tenemos grabadas ahí con Mauricio, eso lo puede utilizar sin problema… no debería tener tanto texto».
// Después: «en lugar de poner puntuación, porque si no, no se entiende… pongas la tasa de closing o la cantidad de cierres», y «que
// aparezcan cosas como negativas que pasan… una objeción o que le parece muy caro… y que luego se vea una parte dentro de MaKo… que
// pase de tantas llamadas cerradas a tantas, o aumentar tanto el factor de closing».
// - Los cierres: los de su CRM (la columna `cerro`, por su fecha de cierre), por trimestre de 2026. La tasa: cierres / primeras
//   reuniones a las que fue el prospecto (`asistio_j1`, por la fecha de la primera reunión). Enero a marzo: 0 de 8; abril a junio: 9
//   de 27 (1 en abril, 3 en mayo, 5 en junio).
// - Las objeciones: las de una llamada de venta suya del 27/03/2026 (49 min, la segunda reunión, no cerró), con el minuto en que las
//   marcó el análisis y si se respondieron. De cada una, SÓLO una categoría escrita por nosotros: ni frases, ni nombres, ni las notas
//   del análisis (son de terceros).
// Lo dibuja ./ClosingAntesDespues.tsx.
export const CLOSING_MAURICIO = {
  antes: { periodo: 'Ene–Mar', cierres: 0, reuniones: 8 },
  despues: { periodo: 'Abr–Jun', cierres: 9, reuniones: 27 },
  porMes: [
    { mes: 'Ene', cierres: 0 }, { mes: 'Feb', cierres: 0 }, { mes: 'Mar', cierres: 0 },
    { mes: 'Abr', cierres: 1 }, { mes: 'May', cierres: 3 }, { mes: 'Jun', cierres: 5 },
  ],
  llamada: {
    duracionMin: 49,
    objeciones: [
      { tipo: 'Mala experiencia previa', segundo: 1034, respondida: true },
      { tipo: 'Consulta a su equipo', segundo: 1633, respondida: true },
      { tipo: 'Condiciones de pago', segundo: 2227, respondida: false },
      { tipo: 'Lo deja para después', segundo: 2580, respondida: false },
    ],
  },
} as const;

/** La tasa de cierre en porcentaje entero (0 de 8 → 0; 9 de 27 → 33). */
export const tasaDe = (p: { cierres: number; reuniones: number }) => (p.reuniones ? Math.round((p.cierres / p.reuniones) * 100) : 0);
