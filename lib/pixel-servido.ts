// =============================================================================
// La versión del Pixel que SIRVE una página hoy, leída de su HTML
// =============================================================================
// Pedido de Martín (06/10/2026): «Ya publiqué y sigue apareciendo que falta publicar
// el pixel». La página servía `var SV = 22;` y MaKo decía 21: la versión sólo se
// enteraba por las VISITAS, y hasta que entra alguien con el código nuevo el número no
// cambia. Lo que va a recibir el próximo visitante es lo que la página sirve AHORA, y
// eso se puede leer.
//
// Se baja con las barandas del análisis de landings (`htmlDePagina`: IP clavada contra
// el rebinding, tope de tamaño mientras se lee, plazo). Y con un plazo PROPIO más corto
// encima, porque esto lo espera una pantalla.
//
// ⚠️ SE CACHEA EN MEMORIA, y asimétrico. Lo pregunta el aviso fijo en cada carga de la
// app: un «al día» se guarda 10 minutos (no va a dejar de estarlo sin que alguien edite
// la página), y un «viejo» o un «no pude leer» sólo 30 segundos — es el caso de quien
// acaba de republicar y vuelve a MaKo a mirar. Si se guardara 10 minutos, el aviso le
// seguiría diciendo «viejo» justo después de arreglarlo, que es exactamente el reporte.
//
// `null` NO es «viejo»: no se pudo leer, o el código entra por un administrador de
// etiquetas y no está en el HTML. Quien llama cae a lo que dicen las visitas.
// =============================================================================
import 'server-only';
import { htmlDePagina } from './landing-fetch';
import { clavePagina, versionEnHtml, PIXEL_MINIMO_AVISO } from './pixel-aviso';

const AL_DIA_MS = 10 * 60_000;
const OTRO_MS = 30_000;
const cache = new Map<string, { v: number | null; hasta: number }>();

export async function versionServida(url: string, opts: { minimo?: number; plazoMs?: number } = {}): Promise<number | null> {
  const k = clavePagina(url);
  if (!k) return null;
  const minimo = opts.minimo ?? PIXEL_MINIMO_AVISO;
  const guardada = cache.get(k);
  if (guardada && guardada.hasta > Date.now()) return guardada.v;
  let v: number | null = null;
  let plazo: ReturnType<typeof setTimeout> | undefined;
  try {
    const html = await Promise.race([
      htmlDePagina(url),
      new Promise<never>((_, rechazar) => { plazo = setTimeout(() => rechazar(new Error('plazo')), opts.plazoMs ?? 5_000); }),
    ]);
    v = versionEnHtml(html);
  } catch {
    v = null;
  } finally {
    if (plazo) clearTimeout(plazo);
  }
  cache.set(k, { v, hasta: Date.now() + (v != null && v >= minimo ? AL_DIA_MS : OTRO_MS) });
  return v;
}
