// =============================================================================
// Un adjunto se LEE al elegirlo, no al mandar (25/10/2026, ticket #8)
// =============================================================================
// Martín, desde su Android (Chrome, 411 px): «No pude subir los adjuntos: vuelve a mandarlo» al «Firmar y mandar» del Ops
// Center. En Chrome de Android un archivo de la galería o de la cámara es una REFERENCIA a un `content://`: si la app pasa a
// segundo plano (fue a buscar otra cosa, contestó un mensaje) o pasa un rato, leerlo después tira `NotReadableError`. La caja
// lo leía recién al mandar (mandar.ts → subirAdjuntos), y ese error caía en el mensaje genérico, que no decía qué pasó.
// Ahora la caja lo copia a memoria en el momento de elegirlo (useCentro.ts → sumarAdjuntos), y si al mandar algo igual falla,
// el aviso dice qué: leer un archivo, la red, o lo que contestó MaKo.
// Sin dependencias: lo cargan los tests en node (File existe desde Node 20).

/** Una copia del archivo con sus bytes ya leídos: se puede leer cuantas veces haga falta, aunque el original ya no. */
export async function enMemoria(f: File): Promise<File> {
  const bytes = await f.arrayBuffer();
  return new File([bytes], f.name, { type: f.type, lastModified: f.lastModified });
}

/** Por qué no se pudo subir, dicho para quien manda (en lugar de «No pude subir los adjuntos»). */
export const ERROR_SUBIDA = {
  leer: (nombre: string) => `No pude leer «${nombre}»: quítalo y vuelve a elegirlo.`,
  red: 'Se cortó la conexión al subir los adjuntos: vuelve a mandarlo.',
  servidor: (status: number) => `MaKo no pudo recibir los adjuntos (${status}): vuelve a mandarlo.`,
  /** El archivo grande va directo al almacenamiento (mandar.ts → subirDirecto): si ése no lo recibe, se dice cuál y qué contestó. */
  almacen: (nombre: string, status: number) => `El almacenamiento no recibió «${nombre}» (${status}): vuelve a mandarlo.`,
  /** Lo que no se esperaba, con el NOMBRE del error (27/10/2026): sin él, desde el teléfono de Martín no hay cómo saber qué pasó. */
  inesperado: (nombre: string) => `No pude subir los adjuntos (${nombre}): vuelve a mandarlo, y si se repite, avísanos con este mensaje.`,
} as const;

/**
 * Por qué falló algo que no se esperaba al subir (27/10/2026, ticket #8 sin probar en un teléfono): un archivo que ya no se puede
 * leer (`NotReadableError` o `NotFoundError`, el `content://` de Android que se soltó), la red (`TypeError` de fetch, `TimeoutError`
 * o `AbortError`), o lo demás con su nombre. Nunca el «No pude subir los adjuntos» que no dice nada.
 */
export function porQueFallo(e: unknown, nombre: string | null = null): string {
  const n = e instanceof Error || (typeof e === 'object' && e && 'name' in e) ? String((e as { name?: unknown }).name ?? '') : '';
  if (n === 'NotReadableError' || n === 'NotFoundError') return ERROR_SUBIDA.leer(nombre ?? 'un adjunto');
  if (n === 'TypeError' || n === 'TimeoutError' || n === 'AbortError' || n === 'NetworkError') return ERROR_SUBIDA.red;
  return ERROR_SUBIDA.inesperado(n || 'sin nombre');
}
