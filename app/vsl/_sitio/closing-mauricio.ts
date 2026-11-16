// =============================================================================
// El «antes y después» de Closing con dos llamadas de venta REALES de Mauricio (16/11/2026)
// =============================================================================
// Martín: «utiliza de las que tenemos grabadas ahí con Mauricio, eso lo puede utilizar sin problema… no debería tener tanto texto».
// Son dos análisis del Closing Analyst de su espacio (closing_analyses, leídos en sólo lectura el 16/11/2026): una de septiembre que
// se perdió y una de octubre que avanzó. De cada una, SÓLO la nota y la de cada dimensión: ni el nombre del prospecto, ni sus
// frases, ni las notas del análisis (son de terceros). Lo dibuja ./ClosingAntesDespues.tsx.
export const CLOSING_MAURICIO = {
  antes: { mes: 'Septiembre', nota: 6.2, dimensiones: [{"dimension":"Situación","nota":8},{"dimension":"Problema","nota":7.5},{"dimension":"Implicación","nota":5},{"dimension":"Necesidad / beneficio","nota":6},{"dimension":"Presentación de la propuesta","nota":5.5},{"dimension":"Manejo de objeciones","nota":4},{"dimension":"CTA / siguientes pasos","nota":5}] },
  despues: { mes: 'Octubre', nota: 8, dimensiones: [{"dimension":"Situación","nota":9},{"dimension":"Problema","nota":9},{"dimension":"Implicación","nota":8},{"dimension":"Necesidad / beneficio","nota":7},{"dimension":"Presentación de la propuesta","nota":8},{"dimension":"Manejo de objeciones","nota":6},{"dimension":"CTA / siguientes pasos","nota":9}] },
  /** La llamada de octubre (50 min): en qué minuto marcó MaKo cada parte (t_seconds de sus dimensiones). Sólo el minuto: sin frases. */
  llamada: {
    duracionMin: 50,
    momentos: [
      { parte: 'Dolor', segundo: 252, tono: 'dolor' },
      { parte: 'Implicación', segundo: 310, tono: 'implicacion' },
      { parte: 'Propuesta', segundo: 2614, tono: 'propuesta' },
      { parte: 'Objeción respondida', segundo: 2669, tono: 'ok' },
      { parte: 'Próximo paso', segundo: 2940, tono: 'ok' },
    ],
  },
} as const;
