// =============================================================================
// Marketing CoPilot — la nevera de contenido (13/11/2026): lo que decide el código, PURO (con test)
// =============================================================================
// Martín (13/11): «la nevera de contenido: cuántos videos, reels e historias hay guardados, cuántos se publicaron, hasta qué fecha
// alcanzan, y avisos para grabar más según el tiempo que el usuario dijo tener». Lo listo vive en el Calendario
// (`calendario_eventos`: una publicación con su formato, su red, su archivo y si se publicó): ./nevera.ts lo lee y esto lo cuenta.
//   · LISTA = una publicación de hoy en adelante, con su archivo, que todavía no salió.
//   · PUBLICADA = la que Zernio confirmó (`publicada`) o la que la persona marcó hecha, en los últimos 30 días.
//   · ALCANZA HASTA = el día de la última lista de ese formato.
//   · El aviso: si lo listo no cubre la semana que viene y hay un ritmo (lo que respondió en el CoPilot), grabar las de una semana.
// Lo que se graba y no se programa NO se ve (no hay dónde guardarlo): lo dice docs/hallazgos-marketing-copilot.md.
// =============================================================================

export type FormatoNevera = 'reel' | 'story' | 'post' | 'video';
export const FORMATOS_NEVERA: readonly FormatoNevera[] = ['reel', 'story', 'post', 'video'];
const NOMBRE: Record<FormatoNevera, [string, string]> = { reel: ['reel', 'reels'], story: ['historia', 'historias'], post: ['carrusel o imagen', 'carruseles e imágenes'], video: ['video largo', 'videos largos'] };
export const nombreFormato = (f: FormatoNevera, n: number) => NOMBRE[f][n === 1 ? 0 : 1];

/** Una publicación del Calendario, con lo justo. `dia` = YYYY-MM-DD en la zona del negocio. */
export type PiezaNevera = { formato: string | null; red: string | null; dia: string; conArchivo: boolean; publicada: boolean; hecha: boolean };
export type RitmoNevera = Partial<Record<FormatoNevera, number>>;

export type FilaNevera = { formato: FormatoNevera; listas: number; publicadas30: number; hasta: string | null; porSemana: number | null; faltan: number };

/** El formato de la nevera de una publicación del Calendario: un video en YouTube es un video largo; en otra red, un reel. */
export function formatoDeNevera(formato: string | null, red: string | null): FormatoNevera | null {
  if (formato === 'reel') return 'reel';
  if (formato === 'story') return 'story';
  if (formato === 'post') return 'post';
  if (formato === 'video') return red === 'youtube' ? 'video' : 'reel';
  return null; // anuncios, correos y lo demás no son de la nevera
}

const sumarDias = (dia: string, n: number): string => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * La nevera, formato por formato. `hoy` en YYYY-MM-DD de la zona del negocio. Faltan = las de una semana de ritmo cuando lo listo no
 * llega a cubrir los próximos 7 días; sin ritmo, nunca avisa (no se inventa cuánto publica).
 */
export function armarNevera(piezas: readonly PiezaNevera[], hoy: string, ritmo: RitmoNevera | null): FilaNevera[] {
  const desde30 = sumarDias(hoy, -30);
  const semana = sumarDias(hoy, 7);
  return FORMATOS_NEVERA.map((f) => {
    const de = piezas.filter((p) => formatoDeNevera(p.formato, p.red) === f);
    const listas = de.filter((p) => p.dia >= hoy && p.conArchivo && !p.publicada && !p.hecha);
    const publicadas30 = de.filter((p) => (p.publicada || p.hecha) && p.dia >= desde30 && p.dia <= hoy).length;
    const hasta = listas.length ? listas.map((p) => p.dia).sort().at(-1)! : null;
    const porSemana = ritmo?.[f] && ritmo[f]! > 0 ? Math.round(ritmo[f]!) : null;
    const faltan = porSemana != null && (hasta == null || hasta < semana) ? porSemana : 0;
    return { formato: f, listas: listas.length, publicadas30, hasta, porSemana, faltan };
  });
}

/** El lunes de la semana de `dia` (YYYY-MM-DD): la clave de las tareas de la nevera. */
export function lunesDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Una fecha corta para la pantalla: «el martes 18». */
export function diaCorto(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  return `el ${d.toLocaleDateString('es', { weekday: 'long', timeZone: 'UTC' })} ${d.getUTCDate()}`;
}

/** Los avisos de la nevera como tareas de «Lo que te toca» (una por formato que se queda corto). */
export function avisosDeLaNevera(filas: readonly FilaNevera[], horas: number | null): Array<{ formato: FormatoNevera; titulo: string }> {
  return filas.filter((f) => f.faltan > 0).map((f) => ({
    formato: f.formato,
    titulo: `Graba ${f.faltan} ${nombreFormato(f.formato, f.faltan)}: ${f.hasta ? `te alcanzan hasta ${diaCorto(f.hasta)}` : f.formato === 'story' ? 'no tienes ninguna lista' : 'no tienes ninguno listo'}${horas ? ` (tienes ${horas} horas por semana)` : ''}`,
  }));
}
