// =============================================================================
// avisos-agrupables — qué aviso puede esperar al resumen de la mañana, y cómo se lee
// =============================================================================
// El reporte del dueño, textual (22/09/2026): «las notificaciones de WhatsApp son
// demasiadas». La segunda mitad de ese reporte (que ninguna avisara de un proyecto
// atrasado) se cerró el 23/09 con `plan-proyecto-vence`; esta es la primera.
//
// SIN `server-only` A PROPÓSITO: la condición que decide si un mensaje sale ahora o mañana
// —y el texto que sale— viven donde un test los pueda importar. Lo que lee la base y manda
// el WhatsApp está en `lib/avisos-cola.ts` y en el cron.
//
// ⚠️ LA LISTA VA EN POSITIVO, NUNCA «TODOS MENOS ÉSTE». Es la regla de la casa para
// cualquier guard sobre algo que puede hacer daño: con «todos menos», cada aviso nuevo
// entra a la lista de los que se posponen sin que nadie lo decida — y el día que se cablee
// uno urgente, se entera al otro día. Acá un aviso nuevo SALE EN EL MOMENTO hasta que
// alguien lo agregue a mano a este archivo.
// =============================================================================

/**
 * Los que aguantan hasta mañana a la mañana.
 *
 * El criterio, en una pregunta: **si esto llega 18 horas más tarde, ¿sirve igual?** Un
 * lead que acaba de entrar, una reunión que se agendó, un WhatsApp sin contestar o una
 * cuenta de Meta frenada NO — ahí lo que importa es la hora. Un objetivo que quedó
 * atrasado, una landing que cambió o las tareas que MaKo cerró solas, SÍ.
 */
export const AVISOS_AGRUPABLES: ReadonlySet<string> = new Set([
  'tareas-autocompletadas',        // ya venía agrupado de por sí (una vez por día)
  'plan-proyecto-vence',           // el digest del plan: su lugar natural es este resumen
  'retro-lista',                   // la retro de la semana, con su PDF
  'quarter-planificar',            // falta planificar el trimestre que viene
  'objetivo-en-riesgo',            // el ritmo del trimestre, no el de hoy
  'meta-alcanzada',                // una felicitación no urge
  'tracking-desactualizado',       // el Pixel viejo: hay que repegarlo, no corriendo
  'clarity-grabacion-por-vencer',  // una grabación que vence en días
  'landing-cambio',                // le cambiaron una pieza a la landing
  'prueba-grabada',                // quedó grabada una prueba
  'lead-fusionado',                // «lo sumé a X, que ya tenías»: informativo
]);

/** Las categorías que NUNCA se posponen, aunque el tipo esté en la lista. */
const CATEGORIAS_QUE_NO_ESPERAN = new Set(['accion', 'pregunta']);

/**
 * ¿Este aviso puede esperar al resumen?
 *
 * ⚠️ EL SEGUNDO CHEQUEO NO ES PARANOIA: un aviso de categoría `accion` o `pregunta` espera
 * un «sí» del dueño por WhatsApp, y `emitirAviso` guarda el turno del doer SÓLO cuando el
 * mensaje sale de verdad. Si se pospone, el «sí» de mañana se pega a otra conversación —
 * eso ya pasó una vez y duplicó dos tareas.
 */
export function puedeEsperar(tipo: string, categoria?: string): boolean {
  if (categoria && CATEGORIAS_QUE_NO_ESPERAN.has(categoria)) return false;
  return AVISOS_AGRUPABLES.has(tipo);
}

export type AvisoEnCola = { tipo: string; titulo: string; texto?: string; cuando?: string };

/** Cuánto del aviso entra en su renglón del resumen (sin contar el link). */
const LARGO_DETALLE = 100;

/**
 * El renglón de UN aviso: qué fue y DE QUÉ.
 *
 * ⚠️ EL TÍTULO SOLO NO ALCANZA, y es el defecto con el que esto nació. `emitirDelCatalogo`
 * pone siempre el título ESTÁTICO del catálogo («Se venció una grabación», «Cambió tu
 * landing»), así que tres avisos del mismo tipo salían como tres renglones idénticos: el
 * resumen decía QUÉ pasó y no de qué página, de qué grabación ni de qué proyecto — o sea,
 * la única parte accionable. El dato concreto vive en el TEXTO, que lo escribe el código.
 *
 * ⚠️ Y LA URL NO SE CORTA: se saca del cuerpo, se recorta sólo la prosa y el link se pega
 * entero al final. Un link cortado a la mitad es peor que ninguno — se ve clicable, y no
 * lleva a ningún lado.
 */
export function lineaDeAviso(a: AvisoEnCola): string {
  const crudo = (a.texto ?? '').replace(/\r/g, '');
  const url = crudo.match(/https?:\/\/\S+/)?.[0] ?? '';
  const detalle = crudo
    .split('\n')
    .map((l) => l.replace(/https?:\/\/\S+/g, '').replace(/[*_~`]/g, '').replace(/👉/g, '').replace(/\s+/g, ' ').trim())
    .find((l) => l.length > 1) ?? '';
  const titulo = (a.titulo || a.tipo).replace(/\s+/g, ' ').trim();
  const corto = detalle.length > LARGO_DETALLE ? detalle.slice(0, LARGO_DETALLE - 1).trimEnd() + '…' : detalle;
  // Sin detalle —o con uno que repite el título— queda el título solo: nunca un renglón que
  // diga dos veces lo mismo.
  const cuerpo = !corto || corto === titulo ? titulo : `${titulo} — ${corto}`;
  return url ? `${cuerpo} 👉 ${url}` : cuerpo;
}

/**
 * El resumen, en la voz de MaKo. Función pura: se puede mirar sin mandar nada.
 *
 * Una línea por aviso. Pegar los textos completos haría un mensaje de treinta renglones,
 * que es el problema que este resumen viene a resolver, no a mudar de lugar.
 */
export function textoResumen(items: AvisoEnCola[]): { titulo: string; texto: string } | null {
  if (!items.length) return null;
  const lineas = ['📋 *Lo que pasó desde ayer*', ''];
  for (const a of items.slice(0, 12)) lineas.push(`• ${lineaDeAviso(a)}`);
  if (items.length > 12) lineas.push(`• …y ${items.length - 12} más`);
  lineas.push('');
  lineas.push('Nada de esto necesitaba interrumpirte. Si quieres que alguno vuelva a llegar en el momento, se prende en Configuraciones › Notificaciones. — MaKo');
  return {
    titulo: `${items.length} ${items.length === 1 ? 'aviso' : 'avisos'} de ayer`,
    texto: lineas.join('\n'),
  };
}
