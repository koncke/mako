// =============================================================================
// spy-compartido — cuándo sirve la lectura que YA pagó otro negocio (2/11/2026)
// =============================================================================
// Martín: «no tiene sentido de que uno analice a Alex Hormozi y luego otro también vuelva a
// analizar al mismo».
//
// Leer un canal público cuesta: una lectura de Instagram gasta del tope diario de Apify del negocio
// y una de YouTube gasta cuota de la API. El resultado es el MISMO para cualquiera que mire a esa
// persona, porque el canal es público. Lo caro se comparte (tabla `spy_lecturas_canal`, migración
// 0363); la lista de a quién mira cada negocio NO se comparte nunca.
//
// ⚠️ ESTE ARCHIVO ES PURO Y NO TOCA LA BASE a propósito: `lib/spy.ts` importa `server-only` y ningún
// test puede importarlo, así que una regla metida ahí sólo se podría cuidar leyendo el archivo como
// texto. Acá se EJECUTA.
// =============================================================================

/** Qué está pidiendo quien va a leer. Decide si la lectura compartida sirve o no. */
export type MotivoDeLectura =
  /** Se acaba de agregar al competidor y no hay nada que mostrar. */
  | 'alta'
  /** Una revisión de fondo, programada: nadie está mirando la pantalla esperando. */
  | 'rutina'
  /** La persona tocó «Revisar ahora» y está mirando. */
  | 'a-pedido';

/**
 * Cuánto vale una lectura ajena según para qué se la quiere.
 *
 * ⚠️ «REVISAR AHORA» NUNCA USA LA COMPARTIDA, Y ÉSA ES LA REGLA QUE IMPORTA. Quien toca ese botón
 * está pidiendo datos de HOY: servirle lo que otro leyó hace diez horas es ahorrar plata mintiendo.
 * Ahí se lee de verdad y, de paso, se refresca la copia compartida para todos.
 *
 * Para el ALTA es al revés: no hay NADA en pantalla, y una lectura de ayer es infinitamente mejor
 * que un cuadro vacío mientras se gasta un crédito. Ahí es donde se ahorra de verdad — es el caso
 * de «otro ya analizó a Hormozi».
 */
export const HORAS_QUE_SIRVE: Record<MotivoDeLectura, number> = {
  alta: 24,
  rutina: 6,
  'a-pedido': 0,
};

/**
 * ¿Sirve la lectura compartida que hay guardada, o hay que pagar una nueva?
 *
 * `leidoEn` es lo que diga `spy_lecturas_canal.leido_en`; `null` = no hay nada guardado.
 */
export function sirveLaCompartida(
  motivo: MotivoDeLectura,
  leidoEn: string | Date | null | undefined,
  ahoraMs: number,
): boolean {
  const horas = HORAS_QUE_SIRVE[motivo];
  if (!horas) return false;
  if (!leidoEn) return false;
  const t = leidoEn instanceof Date ? leidoEn.getTime() : Date.parse(leidoEn);
  if (!Number.isFinite(t)) return false;
  // Una fecha en el FUTURO es un reloj desfasado o un dato roto, no una lectura fresquísima.
  if (t > ahoraMs) return false;
  return ahoraMs - t <= horas * 3_600_000;
}

/**
 * La clave de una lectura compartida. Es el CANAL, no el competidor: dos negocios que miran a la
 * misma persona tienen dos filas en `spy_competidores` y UNA sola acá.
 *
 * ⚠️ El `ref` se normaliza igual que al guardarlo o no se encuentra nunca: el @ de Instagram va en
 * minúscula y sin arroba, y el id de YouTube tal cual lo devuelve la API, que distingue mayúsculas.
 */
export function claveDeCanal(canal: string, ref: string): { canal: string; ref: string } | null {
  const c = (canal ?? '').trim().toLowerCase();
  const r = (ref ?? '').trim();
  if (!c || !r || r.length > 200) return null;
  return { canal: c, ref: c === 'instagram' ? r.replace(/^@/, '').toLowerCase() : r };
}

/** Cuánto tiempo se guarda una lectura compartida antes de podarla. Más vieja que esto no la usa nadie. */
export const DIAS_QUE_SE_GUARDA = 30;
