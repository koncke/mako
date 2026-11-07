// =============================================================================
// closing-marcadores — qué título dice «entrega de servicio» EN ESTE negocio
// =============================================================================
// La pre-clasificación del Closing Analyst (`preClassify`, lib/closing.ts) descarta una
// llamada sin gastar Claude cuando el título la nombra como entrega de servicio. Hasta el
// 06/11/2026 ese detector traía cableado el vocabulario de UN cliente y se lo aplicaba a
// TODOS los workspaces:
//
//     const RE_SERVICIO_EXPLICITO = /^\s*servicio:|^\s*coaching:|paddock\s*&\s*pit
//       |programa\s+via|sesiones\s+programa|reporte\s+semanal|scaling\s*up|mesa\s+de\s+trabajo/i;
//
// `paddock & pit`, `programa via`, `scaling up` y `mesa de trabajo` son nombres de programas
// de ese cliente. Para otro, una llamada de VENTA titulada «Mesa de trabajo» o «Scaling Up»
// —que es un libro de metodología, no la marca de nadie— se clasificaba como
// `entrega_servicio` ANTES de que el modelo la leyera: se descartaba sin error, sin aviso y
// sin dejar ni la fila que el análisis sí deja. Es el tercer mecanismo del mismo módulo que
// le aplicaba la identidad de un cliente a los demás (los dos anteriores:
// lib/closing-internos.ts, 14/08, y lib/closing-taxonomia.ts, 06/11).
//
// ⚠️ POR QUÉ VIVE ACÁ Y NO ADENTRO DE closing.ts: la regla de la casa es que la condición que
// gobierna algo destructivo va en un módulo SIN `server-only`, para que un test pueda
// ejecutarla. `lib/closing.ts` importa `server-only` en la línea 27, así que `preClassify`
// —exportada y todo— no la puede ejecutar ningún test. Descartar una venta lo es.
//
// ⚠️ LA DIRECCIÓN DEL ERROR, Y POR QUÉ NO LA DECIDE EL AHORRO. Hay un dato medido que invita
// a apretar este detector: el 77% del gasto de closing fue para que el modelo dijera «esto no
// es una venta» (docs/api-mako-inventario.md). Pero hay un segundo dato medido, sobre el mismo
// cliente y sobre las mismas llamadas, que dice qué parte de eso evita este detector:
//
//     «El título no sirve para separar: el detector RE_SERVICIO_EXPLICITO caza 0 de 28
//      entregas» (docs/hallazgos-crm.md, 06/10/2026)
//
// CERO de 28. Los títulos reales de las entregas de ese cliente son «Junta X y Y» y «X y
// Mauricio» —nombres de personas—, no nombres de programa. Así que estos marcadores no son lo
// que contiene el gasto: aflojarlos no lo mueve de forma medible, y mantenerlos cableados
// descarta ventas ajenas en silencio. Por eso el fallback es NO DESCARTAR, igual que
// `SIN_INTERNOS`: analizar de más se ve en la pantalla y en la factura —y la paga la clave del
// propio negocio desde IA12—; descartar una venta no se ve en ningún lado.
//
// ⚠️ Y LO QUE SÍ SEPARA LA ENTREGA, POR SI ALGUIEN VIENE A MEJORAR ESTO: no es el título, es
// el CIERRE del lead. `esGrabacionDeEntrega` (lib/insights-llamada-reparto.ts, pura y con
// test) midió 28 de 28 entregas y 19 de 19 ventas. No se puede llamar desde acá —necesita el
// lead, y el match contra el lead corre DESPUÉS de la pre-clasificación—, pero es el camino.
// =============================================================================

/**
 * Los nombres con los que ESTE negocio llama a lo que entrega, normalizados y ya filtrados.
 * Vacío = no hay ninguno, y entonces sólo deciden los prefijos de la app.
 */
export type Marcadores = { nombres: string[] };

/**
 * Ningún marcador propio.
 *
 * Es el FALLBACK cuando no se pudo leer la configuración del negocio, y la dirección del error
 * está elegida: sin marcadores no se descarta ninguna llamada por el nombre de un programa
 * —a lo sumo se analiza de más, que se ve y cuesta plata— y nunca se hereda el vocabulario de
 * otro cliente, que es el bug que esto vino a cerrar. Caer a los nombres del cliente de antes
 * sería el mismo agujero servido por el camino de error.
 *
 * Y no deja al detector en cero: `RE_CONVENCION_APP` sigue valiendo para todos.
 */
export const SIN_MARCADORES: Marcadores = { nombres: [] };

/**
 * Los prefijos que SÍ son convención de la app, no de un negocio: «SERVICIO:» y «COACHING:».
 *
 * Se quedan en el código porque nadie los escribe por casualidad. Y la diferencia con lo que
 * se fue a configuración es la regla que conviene recordar: **un prefijo es una declaración;
 * una subcadena es una adivinanza.** `^servicio:` sólo caza a quien tituló su llamada con esa
 * intención; `scaling up` en cualquier lugar del título caza al que estaba vendiendo.
 */
export const RE_CONVENCION_APP = /^\s*(?:servicio|coaching)\s*:/i;

/**
 * Señales FUERTES de VENTA en el título. Vive acá y no en closing.ts porque la usan las dos
 * decisiones de título que hay que poder testear: el rescate de una llamada sin invitado
 * externo (`preClassify`) y el desempate de este módulo.
 */
export const RE_VENTA_FUERTE = /\bpropuesta\b|diagn[oó]stico|calificaci[oó]n|primera\s+(junta|sesi[oó]n|llamada|reuni[oó]n)|junta\s*[12]\b|reuni[oó]n\s*[12]\b/i;

/**
 * Palabras que cualquier negocio usa: solas no distinguen nada.
 *
 * Un nombre hecho SÓLO de estas no entra como marcador. Sin esta lista, un negocio con un
 * producto llamado «Consultoría» o «Programa» se quedaría sin análisis de ninguna llamada que
 * mencione la palabra —incluidas sus ventas—, y ése es el bug de vuelta, nada más que servido
 * por la configuración en vez de por el código.
 */
export const PALABRAS_GENERICAS = new Set([
  // lo que se vende, en genérico
  'servicio', 'servicios', 'programa', 'programas', 'plan', 'planes', 'paquete', 'paquetes',
  'coaching', 'mentoria', 'mentoring', 'asesoria', 'consultoria', 'capacitacion', 'entrenamiento',
  'curso', 'cursos', 'taller', 'talleres', 'membresia', 'suscripcion', 'comunidad', 'masterclass',
  'workshop', 'bootcamp', 'intensivo', 'implementacion', 'acompanamiento', 'seguimiento',
  'auditoria', 'diagnostico', 'estrategia', 'estrategico', 'estrategica', 'negocio', 'negocios',
  'empresa', 'empresas', 'marketing', 'ventas', 'venta',
  // cómo la app misma llama a una oferta o a un producto cuando nadie le puso nombre: si
  // «Oferta principal» entrara como marcador, descartaría por el nombre que puso el default
  'oferta', 'ofertas', 'producto', 'productos', 'principal', 'cotizacion', 'presupuesto',
  'inicial', 'completo', 'avanzado', 'intermedio',
  // lo que es una llamada
  'sesion', 'sesiones', 'junta', 'juntas', 'reunion', 'reuniones', 'llamada', 'llamadas',
  'demo', 'kickoff', 'onboarding', 'cierre', 'propuesta', 'calificacion', 'revision',
  // forma y nivel
  'basico', 'basica', 'premium', 'pro', 'vip', 'elite', 'full', 'light', 'starter',
  'mensual', 'anual', 'trimestral', 'semanal', 'quincenal', 'grupal', 'individual',
  'uno', 'dos', 'tres', '1', '2', '3',
  // conectores
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'con', 'para', 'por', 'a', 'en', 'al',
  'un', 'una', 'the', 'of', 'and', 'to', 'for',
]);

/**
 * Mínimo de caracteres de un marcador. Un nombre más corto caza por accidente dentro de un
 * título ajeno, y lo que se paga por el accidente es una venta descartada en silencio.
 */
export const MINIMO_CARACTERES = 6;

/**
 * Minúsculas, sin acentos, y todo lo que no sea letra o dígito convertido en UN espacio.
 *
 * Así «Paddock & Pit» y «paddock&pit» son el mismo marcador, que es lo que el regex viejo
 * conseguía a mano con `\s*&\s*`. Importa que la normalización sea la MISMA para el nombre y
 * para el título: si no, el marcador existe y nunca caza, que es el modo de falla invisible.
 */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** ¿Este nombre dice algo que no diría cualquier negocio? */
function esDistintivo(normalizado: string): boolean {
  if (normalizado.replace(/ /g, '').length < MINIMO_CARACTERES) return false;
  return normalizado.split(' ').some((p) => p && !PALABRAS_GENERICAS.has(p));
}

/**
 * Arma los marcadores de un workspace con los nombres de lo que vende y entrega (sus ofertas y
 * sus productos), descartando los que no sirven para decidir.
 *
 * `rotulosDeVenta` son los rótulos de las etapas de REUNIÓN de su embudo (`reunionesDe`,
 * lib/funnel-etapas.ts): la misma fuente única que usa el CRM. Un nombre que además es el
 * rótulo con el que este negocio llama a una de sus reuniones de venta NO entra como marcador
 * —ahí el título es ambiguo para el propio dueño, y «ante la duda, VENTA»—. Es el caso exacto
 * que dio nombre al bug: un negocio cuya reunión de venta se llama «Mesa de trabajo».
 *
 * ⚠️ ENTRAN TAMBIÉN LAS OFERTAS Y LOS PRODUCTOS INACTIVOS, a propósito: las llamadas de
 * entrega de hoy son justamente las del programa que se dejó de vender. Filtrar por activo
 * dejaría sin marcador al único caso que este detector puede cazar.
 */
export function marcadoresDe(
  nombres: Array<string | null | undefined>,
  rotulosDeVenta: Array<string | null | undefined> = [],
): Marcadores {
  const deVenta = new Set(rotulosDeVenta.map(normalizar).filter(Boolean));
  const out = new Set<string>();
  for (const raw of nombres) {
    const n = normalizar(raw);
    if (!n || deVenta.has(n) || !esDistintivo(n)) continue;
    out.add(n);
  }
  return { nombres: [...out] };
}

/**
 * ¿El título dice «esto es entrega de servicio», con la certeza suficiente para descartar la
 * llamada SIN que el modelo la lea?
 *
 * Dos caminos, y no valen lo mismo:
 *   1. El prefijo de la app (`SERVICIO:` / `COACHING:`) — una declaración de quien tituló.
 *      Alcanza solo.
 *   2. El nombre de un programa de ESTE negocio, como palabra completa del título. Es más
 *      débil: el mismo nombre aparece en la llamada donde se VENDE ese programa. Así que no
 *      descarta si el título trae además una señal fuerte de venta («propuesta»,
 *      «diagnóstico», «primera llamada», «Junta 1»). Ahí la casa ya fijó para dónde se cae:
 *      ante la duda, VENTA. Cuesta un análisis que el modelo va a cerrar bien; la duda al
 *      revés cuesta una venta que nadie vuelve a mirar.
 *
 * ⚠️ HUECO CONOCIDO, a propósito: la señal de duda es `RE_VENTA_FUERTE` y no tiene «demo», ni
 * «cotización», ni «presupuesto». Así que un título como «<su programa> — demo con Juan» se
 * descarta igual. Se reusa esa lista porque es la definición de la casa de «esto grita venta» y
 * la usan además el rescate de `preClassify` y el puntaje de `syncClosingCalls`: ensancharla
 * acá sola crearía una segunda definición (AGENTS.md ya cuenta lo que pasó con las DOS de «es
 * R2»). Ensancharla para los tres es su propia punta, y pide medir antes.
 */
export function esEntregaExplicita(titulo: string | null | undefined, marcadores: Marcadores = SIN_MARCADORES): boolean {
  const t = titulo ?? '';
  if (RE_CONVENCION_APP.test(t)) return true;
  if (!marcadores.nombres.length) return false;
  if (RE_VENTA_FUERTE.test(t)) return false;
  const norm = ` ${normalizar(t)} `;
  return marcadores.nombres.some((n) => norm.includes(` ${n} `));
}
