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
} as const;
