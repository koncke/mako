// =============================================================================
// landing-clics — los clics que el Pixel ya guardaba y nadie podía consultar (9/11/2026)
// =============================================================================
// Ticket #66 (Mauricio Bustos, ws 1): «El script de MaKo versión 28 contiene seguimiento de eventos
// click, con destino del enlace y texto del botón. Sin embargo, la API documentada no permite
// consultar cuántos clics se recibieron por botón ni cuándo ocurrieron».
//
// ⚠️ LO PRIMERO QUE HAY QUE SABER: LOS CLICS SÍ ESTABAN GUARDADOS. Medido en producción el 9/11/2026
// antes de escribir una línea: `vsl_events` con `tipo_evento = 'click'` y el href o el texto del botón
// en `detalle` (migración 0133). En el negocio de Mauricio había 12 clics de 5 personas sobre el botón
// de Stripe que nombra el ticket, entre el 24/10 y el 9/11. O sea que esto NO es «recuperar un dato
// perdido» —que es lo que el ticket temía— sino abrir una puerta a un dato que ya estaba adentro.
// Decirlo importa: la respuesta a «¿se están guardando?» es sí, y cambia lo que el negocio decide.
//
// Qué devuelve y por qué así:
//   · Agrupado POR BOTÓN, que es la pregunta real («¿cuántos tocaron RESERVA TU CUPO?»), con cuántas
//     PERSONAS distintas —no sólo cuántos clics—: una persona que toca cinco veces no son cinco leads.
//   · Con `boton`, los clics de ESE botón uno por uno, con su fecha y hora en ISO (UTC, con la Z a la
//     vista: la zona la pone quien lo lee, y un timestamp sin zona es el error clásico de esta familia).
//   · `medido`: FALSE cuando la consulta falló, TRUE cuando corrió. Lo pide el ticket con todas las
//     letras («Distinción entre cero eventos y datos no disponibles») y es la misma regla que el repo
//     ya aplica en el comportamiento de una landing: «null = no se pudo medir, NUNCA 0». Un cero que
//     en realidad es un error hace que alguien apague una campaña que estaba funcionando.
//
// ⚠️ LAS PRUEBAS DEL PIXEL NO CUENTAN (`prueba is null`): son los toques de quien está probando la
// instalación, y mezclarlos con los clics de verdad infla justo el número que alguien va a mirar para
// decidir si su botón funciona.
//
// SIN `server-only`: lo puro de acá lo prueba tests/landing-clics.test.ts.
// =============================================================================

/** Un botón (o un destino) con lo que se midió de él. */
export type BotonConClics = {
  /** El href o el texto del botón, tal cual lo guardó el Pixel. */
  detalle: string;
  clics: number;
  /** Visitantes distintos: una persona que toca cinco veces no son cinco personas. */
  personas: number;
  primero: string;
  ultimo: string;
};

/** Un clic suelto, para el historial de un botón. */
export type ClicSuelto = { cuando: string; visitante: string; landing: string | null };

export type FilaClic = {
  detalle: string | null;
  visitor_id: string | null;
  created_at: string;
  landing_url: string | null;
};

/**
 * Agrupa las filas crudas por botón. Puro: la consulta la hace quien llama.
 *
 * ⚠️ UN `detalle` VACÍO NO SE TIRA, SE NOMBRA. El Pixel lo deja en null cuando el toque no tuvo ni
 * href ni texto (un ícono, un div con onclick). Descartarlos haría que el total de la respuesta no
 * cierre con el total de clics, y el primero en notarlo sería el cliente restando a mano.
 */
export function agruparPorBoton(filas: readonly FilaClic[]): BotonConClics[] {
  const mapa = new Map<string, { clics: number; personas: Set<string>; primero: string; ultimo: string }>();
  for (const f of filas) {
    const clave = (f.detalle ?? '').trim() || '(sin destino ni texto)';
    const ya = mapa.get(clave);
    if (!ya) {
      mapa.set(clave, { clics: 1, personas: new Set(f.visitor_id ? [f.visitor_id] : []), primero: f.created_at, ultimo: f.created_at });
      continue;
    }
    ya.clics += 1;
    if (f.visitor_id) ya.personas.add(f.visitor_id);
    if (f.created_at < ya.primero) ya.primero = f.created_at;
    if (f.created_at > ya.ultimo) ya.ultimo = f.created_at;
  }
  return [...mapa.entries()]
    .map(([detalle, v]) => ({ detalle, clics: v.clics, personas: v.personas.size, primero: v.primero, ultimo: v.ultimo }))
    .sort((a, b) => b.clics - a.clics || a.detalle.localeCompare(b.detalle));
}

/**
 * Si una fila es de la landing que se pidió. Sin `url` pedida, entran todas.
 *
 * ⚠️ COMPARA NORMALIZADO, no por texto: la misma página llega como `sprint.mauriciobustos.com`,
 * `https://sprint.mauriciobustos.com/` y con `?utm_source=...` según de dónde vino la persona. Un
 * `===` crudo deja afuera a la mayoría y devuelve un cero que parece una respuesta.
 */
export function esDeLaLanding(fila: FilaClic, urlNormalizada: string | null, normalizar: (s: string) => string | null): boolean {
  if (!urlNormalizada) return true;
  // ⚠️ `normalizarUrl` DEVUELVE `string | null` —null cuando lo que le llega no es una URL, y a
  // `landing_url` le llega lo que mande el Pixel—. Un null nunca es igual a una url pedida, así que
  // esa fila no es de esta landing: se descarta, no se cuenta como coincidencia.
  const suya = normalizar(fila.landing_url ?? '');
  return suya !== null && suya === urlNormalizada;
}

/** El total de clics y de personas distintas de un conjunto ya agrupado. */
export function totalesDe(filas: readonly FilaClic[]): { clics: number; personas: number } {
  const personas = new Set<string>();
  for (const f of filas) if (f.visitor_id) personas.add(f.visitor_id);
  return { clics: filas.length, personas: personas.size };
}
