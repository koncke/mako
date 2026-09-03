// =============================================================================
// agente-consultas — qué lecturas de MaKo puede hacer un agente EXTERNO
// =============================================================================
// El Claude del cliente tenía dos puertas (el negocio en `/contexto`, el tablero
// en `/plan`) y las dos devuelven CONFIGURACIÓN. MaKo, adentro de la app, tiene
// diez herramientas de lectura sobre datos vivos —leads, conversaciones de
// WhatsApp, reuniones con su asistencia, el funnel del workspace— y ninguna
// llegaba a la skill. Este módulo abre esa puerta.
//
// NO SE REIMPLEMENTAN: se reusa `runMakoTool` (lib/mako-tools.ts), que es el
// mismo `ToolRunner` que corre adentro de la app. Escribir una segunda versión de
// «buscar leads» es exactamente cómo se paga la factura del contrato del
// `detalle`: el día que una cambie, la otra se queda vieja y el cliente ve dos
// respuestas distintas a la misma pregunta según por dónde entró.
//
// ⚠️ LA LISTA ESTÁ EN POSITIVO, Y NO SE DERIVA DE `MAKO_TOOLS`. Hoy las diez son
// de lectura —lo dice la cabecera de mako-tools.ts— pero ese módulo ya declara
// que los «proponer» llegan en la próxima fase. Si esta lista fuera «todas menos
// las que escriben», la primera herramienta de escritura que alguien agregue allá
// queda expuesta acá sin que nadie lo decida. Es la regla de la casa: un guard
// sobre algo delicado se escribe nombrando lo que SÍ entra.
//
// Sin `server-only` a propósito: la lista y su verificación tienen que poder
// testearse, y un test no puede importar un módulo con `server-only`.
// =============================================================================

/**
 * Las lecturas que un agente externo puede pedir. Cada una tiene que cumplir las
 * dos condiciones, y las dos se verifican en tests/agente-consultas.test.ts:
 *   1. existe en `MAKO_TOOLS` con ese nombre exacto;
 *   2. es de LECTURA — no escribe, no manda nada, no deja propuestas.
 *
 * `ver_plan` NO está: ya tiene su puerta en `GET /api/agente/plan`, con el
 * formato que la skill enseña a usar. Dos caminos al mismo dato son dos formatos
 * que divergen.
 */
export const CONSULTAS_AGENTE = [
  'buscar_leads',
  'ficha_lead',
  'historial_whatsapp',
  'reuniones_lead',
  'reuniones_recientes',
  'ver_funnel',
  'estado_experimentos',
  'buscar_conocimiento',
  'buscar_tutorial',
  // El ANÁLISIS del período: la cascada de costos, la fuga de no calificados y el
  // ranking de creativos. Entra porque es de lectura pura y porque es justo lo
  // que un agente necesita para opinar con fundamento en vez de con adjetivos.
  'analisis_negocio',
] as const;

export type ConsultaAgente = (typeof CONSULTAS_AGENTE)[number];

const PERMITIDAS: ReadonlySet<string> = new Set(CONSULTAS_AGENTE);

/** ¿Este nombre está habilitado para el agente externo? Fail-closed. */
export function consultaPermitida(nombre: string): nombre is ConsultaAgente {
  return PERMITIDAS.has((nombre ?? '').trim());
}

/**
 * Qué parámetros de la query string se le pasan a cada herramienta.
 *
 * ⚠️ Se enumeran en vez de reenviar el objeto entero. Un `Object.fromEntries` del
 * `searchParams` le entrega al runner cualquier clave que alguien invente, y esas
 * claves terminan adentro de un `input` que las libs leen por nombre. Acá pasa
 * SOLO lo que la herramienta declara, y con el tipo que espera.
 */
// ⚠️ LOS NOMBRES SALEN DEL `input_schema` DE CADA TOOL, NO DE LO QUE PAREZCA.
// Tres de los nueve no se llaman como uno esperaría —`buscar_tutorial` pide
// `tema`, `buscar_conocimiento` pide `query`, y `reuniones_recientes` no acepta
// `limite`— y un nombre equivocado no da error: la lib lee `input.texto`, no lo
// encuentra, y la herramienta contesta «pasa un texto para buscar» como si el
// agente no hubiera mandado nada. El test los cruza contra MAKO_TOOLS.
export const PARAMS_CONSULTA: Record<ConsultaAgente, ReadonlyArray<{ nombre: string; tipo: 'texto' | 'numero'; obligatorio?: boolean }>> = {
  buscar_leads: [{ nombre: 'texto', tipo: 'texto', obligatorio: true }],
  ficha_lead: [{ nombre: 'leadId', tipo: 'numero', obligatorio: true }],
  historial_whatsapp: [{ nombre: 'leadId', tipo: 'numero', obligatorio: true }, { nombre: 'limite', tipo: 'numero' }],
  reuniones_lead: [{ nombre: 'leadId', tipo: 'numero', obligatorio: true }],
  reuniones_recientes: [{ nombre: 'dias', tipo: 'numero' }],
  ver_funnel: [],
  estado_experimentos: [],
  buscar_conocimiento: [{ nombre: 'query', tipo: 'texto', obligatorio: true }, { nombre: 'area', tipo: 'texto' }],
  buscar_tutorial: [{ nombre: 'tema', tipo: 'texto', obligatorio: true }],
  analisis_negocio: [
    { nombre: 'desde', tipo: 'texto' },
    { nombre: 'hasta', tipo: 'texto' },
    { nombre: 'cierres_objetivo', tipo: 'numero' },
    { nombre: 'presupuesto_propuesto', tipo: 'numero' },
  ],
};

/**
 * Arma el `input` de una herramienta desde la query string, quedándose solo con
 * lo declarado. Devuelve el error listo para mostrar si falta un obligatorio —el
 * mensaje dice QUÉ falta, porque lo lee un agente que puede corregirse solo.
 */
export function inputDeConsulta(
  que: ConsultaAgente,
  leer: (clave: string) => string | null,
): { input: Record<string, unknown> } | { error: string } {
  const input: Record<string, unknown> = {};
  for (const p of PARAMS_CONSULTA[que]) {
    const crudo = (leer(p.nombre) ?? '').trim();
    if (!crudo) {
      if (p.obligatorio) return { error: `«${que}» necesita el parámetro «${p.nombre}».` };
      continue;
    }
    if (p.tipo === 'numero') {
      const n = Number(crudo);
      if (!Number.isFinite(n)) return { error: `«${p.nombre}» tiene que ser un número, llegó «${crudo}».` };
      input[p.nombre] = n;
    } else {
      input[p.nombre] = crudo;
    }
  }
  return { input };
}
