// =============================================================================
// angulos-formatos — la BIBLIOTECA de formatos de creativo (¿cómo se muestra?)
// =============================================================================
// Un "ÁNGULO" (en el sentido de Mauricio) = el FORMATO del creativo: cómo se ejecuta
// visualmente. Separado en IMAGEN y VIDEO. La biblioteca es FIJA (la definimos
// nosotros, no es configurable por el cliente); la IA (`elegirAngulo`) agarra de esta
// biblioteca UN formato por anuncio, o sea por celda de la matriz, según su avatar, su
// razón, su copy y el entregable.
//
// ⚠️ Hasta el 23/10/2026 había además una «recomendación de formatos» a nivel negocio
// (`recomendarFormatos`, el setting `mako.formatos_recom`). Se sacó: ningún generador la
// leía, y medido en prod 0 negocios la tenían y la generación tenía 0 llamadas en toda la
// historia. Cuántos anuncios usan cada formato lo cuenta `usosPorFormato` (lib/angulos-data.ts).
//
// Distinto de las RAZONES (las motivaciones de compra, ver razones) y del ENTREGABLE
// (el elemento tangible, ver entregable). El pipeline: avatar → razón → entregable →
// FORMATO (esto) → creativo.
// =============================================================================

import 'server-only';
import { parseJsonObject } from './campaign-structurer';
import { getRazones, setRazones } from './razones';
import { getAvatares } from './avatares';
import { getEntregables, entregablesTexto } from './entregable';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';
import { BIBLIOTECA_ANGULOS, formatoPorId, type Medio, type FormatoAngulo } from './angulos-data';

// La biblioteca (data pura) vive en ./angulos-data para poder usarla también en la
// UI (client). Acá la re-exportamos + la lógica de IA que elige de ella.
export { BIBLIOTECA_ANGULOS, formatoPorId };
export type { Medio, FormatoAngulo };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// ── IA: elegir el mejor FORMATO por CELDA y MEDIO (imagen o video) ────────────
// Elige UN formato para UNA celda de la matriz (un anuncio concreto) y lo persiste en
// celda.anguloImagen / celda.anguloVideo. Es lo que alimenta la tab Imagen/Video del
// pop-up y el ángulo que sigue el guion. Envelope {ok}; nunca lanza.
export type AnguloResult = { ok: true; formatoId: string; formato: FormatoAngulo } | { ok: false; error: string };

export async function elegirAngulo(celdaId: string, medio: Medio, timeoutMs?: number): Promise<AnguloResult> {
  try {
    const razones = await getRazones();
    const celda = razones.find((r) => r.id === celdaId);
    if (!celda) return { ok: false, error: 'Celda no encontrada.' };
    const opciones = BIBLIOTECA_ANGULOS.filter((f) => f.medio === medio);
    const ids = new Set(opciones.map((f) => f.id));
    const [avatares, entregables] = await Promise.all([getAvatares(), getEntregables()]);
    const av = avatares.find((a) => a.id === celda.avatarId);

    const biblioteca = opciones.map((f) => `- ${f.id} — ${f.nombre}: ${f.descripcion}`).join('\n');
    const sys = `Eres MaKo, eligiendo el MEJOR FORMATO de ${medio === 'imagen' ? 'IMAGEN' : 'VIDEO'} para UN anuncio concreto (metodología de Jan). Tienes una biblioteca FIJA de formatos de ${medio}; elige EXACTAMENTE UNO, el que mejor ejecuta ESTE anuncio para ESTE avatar y ESTA motivación de compra, aprovechando el entregable tangible si aplica. NO inventes formatos.
Devuelve EXCLUSIVAMENTE un JSON: {"formatoId":"<uno de los ids>","porque":"<1 frase>"}`;
    const user = `AVATAR: ${av ? `${av.nombre} — ${av.segmento}. Dolor: ${av.dolor}` : '(sin avatar)'}
MOTIVACIÓN DE COMPRA: ${celda.nombre} — ${celda.descripcion}
COPY/HOOK: ${celda.copy || '(sin copy)'}
${entregables.length ? `ENTREGABLE TANGIBLE: ${entregablesTexto(entregables)}\n` : ''}
FORMATOS DE ${medio.toUpperCase()} (elige SOLO uno de estos ids):
${biblioteca}

Devuelve solo el JSON.`;
    const leerId = (t: string): string => { try { return str(parseJsonObject(t).formatoId); } catch { return ''; } };
    const text = await chatCheapCascade({
      system: sys, user, json: true, maxTokens: 300, timeoutMs,
      feature: 'angulos-formatos', motivo: `Elegir formato de ${medio} para una celda`,
      provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => ids.has(leerId(t)),
    });
    const formatoId = leerId(text);
    if (!ids.has(formatoId)) return { ok: false, error: `MaKo no eligió un formato de ${medio} válido. Reintenta.` };
    // Releer DESPUÉS de la llamada lenta para no pisar ediciones concurrentes.
    const actuales = await getRazones();
    const campo = medio === 'imagen' ? 'anguloImagen' : 'anguloVideo';
    await setRazones(actuales.map((r) => (r.id === celdaId ? { ...r, [campo]: formatoId } : r)));
    return { ok: true, formatoId, formato: formatoPorId(formatoId)! };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
