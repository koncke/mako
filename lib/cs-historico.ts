// =============================================================================
// cs-historico — lo que ya pasó con los clientes anteriores, bloque por bloque
// =============================================================================
// ES LO ÚNICO QUE MAKO APORTA Y NINGUNA DE LAS DOS SKILLS DE MAURICIO PUEDE.
// `mapa-ejecucion-4dx` y `dashboard-accountability` ven UN cliente por vez. Esto
// ve los seis, y por eso puede contestar la pregunta que traba todo el programa:
// «¿cómo resolvió esto alguien más?».
//
// Ataca los dos atoros que él mismo mide como los peores:
//   · Definir la evidencia — «el bloqueo número uno de todo el programa». Baja
//     Teriyaki estuvo TRES SEMANAS en esa sola pregunta.
//   · Poner el umbral — el dueño no tiene referencia de qué es exigente pero
//     posible, y ante la duda no contesta. Patricia no devolvió el archivo.
//
// ⚠️ ESTO ES PARA MAURICIO, NUNCA PARA EL CLIENTE.
// Cada entrada nombra a un cliente real suyo. Mostrarle a Baja Teriyaki lo que
// le pasó a TEXX es filtrar información de un cliente a otro, y ninguno de los
// dos lo autorizó. La pantalla del cliente (`TareaCliente.tsx`) NO importa este
// módulo, y no debería: el material sale por el lado de Mauricio, que decide qué
// contar en la sesión.
//
// ⚠️ Y NO ES UNA RESPUESTA PRE-LLENADA. Nada de esto es lo que el cliente
// contestó: son las OBSERVACIONES DE MAURICIO sobre dónde se trabó cada uno.
// Meterlas en `cs_respuestas.respuesta` sería ponerle en la boca al cliente algo
// que nunca dijo — la misma regla que el prompt de reescritura ya prohíbe.
//
// DE DÓNDE SALE, para que se pueda auditar: del documento «Cómo se construye el
// sistema · Norte Estratégico, PAS y Tableros» que pasó Mauricio, construido
// sobre sesiones reales de cuatro clientes entre mayo y agosto de 2026. Cada
// entrada lleva su `fuente`. Lo que no está ahí, no está acá.
//
// SIN `server-only` a propósito: es dato y tiene tests.
// =============================================================================

/** Qué tipo de aprendizaje es. Cambia cómo se usa: un `atoro` sirve para
 *  anticipar, un `resuelto` sirve para proponer, un `error` para no repetirlo. */
export type TipoCaso = 'atoro' | 'resuelto' | 'error';

export type CasoHistorico = {
  /** El cliente de Mauricio, con el nombre que él usa. */
  cliente: string;
  /** El bloque del programa al que aplica (`lib/programa-catalogo.ts`). */
  claseId: string;
  tipo: TipoCaso;
  /** Qué pasó, en una o dos frases. Textual del material siempre que se pueda. */
  que: string;
  /** Qué se hace con esto la próxima vez. Es lo que se le muestra a Mauricio. */
  leccion: string;
  fuente: string;
};

export const HISTORICO: CasoHistorico[] = [
  // ── El dato base que no existe (m1c6) ────────────────────────────────────
  {
    cliente: 'TEXX Supertiendas', claseId: 'm1c6', tipo: 'atoro',
    que: 'Vivió 19 días con su MCI abierta esperando la cifra de margen.',
    leccion: 'El número que falta no frena el ciclo: se anota como faltante con responsable y fecha, y la MCI se cierra con la base que haya.',
    fuente: 'Cómo se construye el sistema §7',
  },
  {
    cliente: 'Baja Teriyaki', claseId: 'm1c6', tipo: 'atoro',
    que: 'No tenía baseline de ticket promedio.',
    leccion: 'Preguntar por el dato ANTES de la sesión del Norte, no durante: conseguirlo es trabajo de días, no de minutos.',
    fuente: 'Cómo se construye el sistema §7',
  },
  {
    cliente: 'Grupo Esquer', claseId: 'm1c6', tipo: 'atoro',
    que: 'Opera con un ERP cuyo inventario no es confiable.',
    leccion: 'Un dato que existe pero no es confiable es peor que uno que falta: se marca como no confiable, o el tablero mide ruido.',
    fuente: 'Cómo se construye el sistema §7',
  },

  // ── Las dos MCIs (m4c1, m4c2) ────────────────────────────────────────────
  {
    cliente: 'TEXX Supertiendas', claseId: 'm4c2', tipo: 'resuelto',
    que: 'Redactó bien las dos MCIs: una económica y una de transferencia de criterio.',
    leccion: 'El caso que sirve de ejemplo cuando otro dueño no entiende por qué hacen falta las dos.',
    fuente: 'Cómo se construye el sistema §3',
  },
  {
    cliente: 'HMO Cold Management', claseId: 'm4c1', tipo: 'error',
    que: 'Escribió las DOS MCIs sobre transferencia de criterio y se quedó sin marcador económico.',
    leccion: 'Chequear antes de cerrar: si ninguna de las dos tiene un número de plata, el equipo no sabe si va ganando.',
    fuente: 'Cómo se construye el sistema §3',
  },

  // ── El PAS (m5c2, m5c3) ──────────────────────────────────────────────────
  {
    cliente: 'TEXX Supertiendas', claseId: 'm5c2', tipo: 'resuelto',
    que: 'La narrativa de David contra Goliat apareció en la MISMA sesión que las MCIs, no antes.',
    leccion: 'El adversario sale del diagnóstico. Si todavía no está, no se fuerza: aparece cuando los números están sobre la mesa.',
    fuente: 'Cómo se construye el sistema §2',
  },
  {
    cliente: 'Baja Teriyaki', claseId: 'm5c3', tipo: 'resuelto',
    que: '«Honrar» se cambió a «consentirse» porque la primera palabra sonaba demasiado formal para hablarle al equipo.',
    leccion: 'El valor se escribe con la palabra que usa la gente del piso, no con la que suena bien en un documento.',
    fuente: 'Cómo se construye el sistema §7',
  },

  // ── Las palancas (m6c1, m6c4) ────────────────────────────────────────────
  {
    cliente: 'HMO Cold Management', claseId: 'm6c1', tipo: 'resuelto',
    que: 'Un director llegó por su cuenta con sus tres números puestos —30 llamadas diarias, 8 conversaciones reales, 6 oportunidades calificadas al mes— sin que nadie se los sacara en sesión.',
    leccion: 'Lo que destraba no es el formulario, es el contexto: cuando el rol ya tiene una razón de existir dentro del sistema, la palanca se vuelve obvia.',
    fuente: 'Cómo se construye el sistema §8',
  },

  // ── La evidencia: el bloqueo número uno (m7c1, m7c2) ─────────────────────
  {
    cliente: 'Baja Teriyaki', claseId: 'm7c1', tipo: 'atoro',
    que: 'Estuvo TRES SEMANAS detenida en esta sola pregunta.',
    leccion: 'Es el bloqueo número uno de todo el programa. Llegar con ejemplos concretos de otros clientes, no con la pregunta abierta.',
    fuente: 'Cómo se construye el sistema §7',
  },
  {
    cliente: 'TEXX Supertiendas', claseId: 'm7c2', tipo: 'atoro',
    que: 'El protocolo de servicio no se podía medir porque el mystery shopper solo captura cuando hay alguien observando.',
    leccion: 'Una evidencia que solo existe cuando hay un observador no mide el proceso: mide la visita. Hay que cambiar la evidencia o cambiar la palanca.',
    fuente: 'Cómo se construye el sistema §7',
  },

  // ── Los umbrales (m8c1) ──────────────────────────────────────────────────
  {
    cliente: 'Patricia', claseId: 'm8c1', tipo: 'atoro',
    que: 'No devolvió el archivo de umbrales.',
    leccion: 'Ante la duda de qué es exigente pero posible, el dueño no contesta: no insiste, desaparece. La pregunta que sí funciona es «qué nivel ya lograste alguna vez».',
    fuente: 'Cómo se construye el sistema §7',
  },

  // ── Los catálogos que faltan, ahora colgados de las palancas ─────────────
  // ⚠️ Este caso vivía en m11c1 («Los catálogos que faltan»), que Mau sacó del
  // programa el 12/08: «esto es un retraso, se supone que ya me los mandaron».
  // La EVIDENCIA no se tira con la clase — el hallazgo es real y sigue valiendo,
  // así que se recuelga de donde el faltante se manifiesta: al elegir la palanca,
  // que es el momento en que alguien va a buscar el dato y no está.
  {
    cliente: 'TEXX Supertiendas', claseId: 'm6c3', tipo: 'atoro',
    que: 'Se detectaron trece catálogos faltantes, cada uno bloqueando una palanca.',
    leccion: 'Aparecen al final y no son trabajo de tablero: se listan con responsable y fecha antes del build, no después.',
    fuente: 'docs/programa-mauricio.md (derivado del material de Mauricio)',
  },

  // ── Transversal: el dueño trae la operación (m0c1) ───────────────────────
  {
    cliente: 'Caso extremo (sin nombrar en el material)', claseId: 'm0c1', tipo: 'error',
    que: 'Consumió catorce sesiones en reclutamiento, SEO y arquitectura web sin cerrar su MCI económica.',
    leccion: 'Todo legítimo, nada de eso es norte ni tablero. Es la razón por la que el bloque 0 existe: si el dueño no asume que él es el proyecto, la agenda se llena de operación.',
    fuente: 'Cómo se construye el sistema §7',
  },
];

/** Los casos de un bloque. Es lo que MaKo le muestra a Mauricio antes de la
 *  sesión: «acá se trabaron dos de tus clientes, y así se resolvió». */
export function casosDe(claseId: string): CasoHistorico[] {
  return HISTORICO.filter(c => c.claseId === claseId);
}

/** Los bloques que YA tienen material histórico. Sirve para saber dónde MaKo
 *  puede aportar algo y dónde todavía no tiene nada que decir. */
export function bloquesConHistorico(): string[] {
  return [...new Set(HISTORICO.map(c => c.claseId))].sort();
}

/** Los casos de un cliente. Sirve para preparar SU sesión. */
export function casosDeCliente(cliente: string): CasoHistorico[] {
  const n = cliente.trim().toLowerCase();
  return HISTORICO.filter(c => c.cliente.toLowerCase().includes(n));
}
