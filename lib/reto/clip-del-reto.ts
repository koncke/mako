// =============================================================================
// LA TARJETA DEL CLIP DE REGALO, EN EL DÍA 6 DEL RETO: qué dibuja en cada estado (20/11/2026)
// =============================================================================
// El clip lo hace la sesión de AI Avatar (app/ai-avatar/regalo/: un clip de 10 s por prueba, por ApiMart, que queda en el historial
// de videos; si falla o no hay saldo se dice claro y no se cobra). El reto sólo lo muestra: la tarjeta llama
// `clipDeRegaloAction()` al abrirse y cada 10 s mientras dice «generando» (cada consulta es la que avanza el clip: no hay un cron),
// y `pedirClipDeRegaloAction({ frase })` con el botón. Los textos que vienen de allá se muestran tal cual.
//
// Acá, lo que se prueba sin navegador (tests/reto-dias.test.ts): qué vista toca en cada estado y cuándo se puede mandar la frase.
// Puro y sin red: lo importa el componente del cliente (app/second-brain/reto/ChatDelReto.tsx).
// =============================================================================
import { MAX_PALABRAS_CLIP, SEGUNDOS_CLIP_REGALO, fraseDelClip, type ClipRegalo } from './clip-regalo-reglas';
import { esEtiqueta, textoDeNodo } from '../copywriter/doc';
import type { JsonNodo } from '../copywriter/tipos';

/** Cada cuánto pregunta la tarjeta mientras el clip se genera (el contrato de AI Avatar: ~10 s). */
export const CADA_MS_CLIP = 10_000;

export type VistaClip =
  /** Todavía no contestó: nada (nunca un hueco ni una promesa). */
  | { v: 'nada' }
  /** No hay clip para esta persona (no está en prueba, no administra el negocio…): el texto de allá. */
  | { v: 'aviso'; texto: string }
  /** El formulario: la frase y el botón. `aviso` = por qué se vuelve a pedir (un fallo con intento). */
  | { v: 'pedir'; aviso: string | null; segundos: number; max: number }
  | { v: 'generando' }
  | { v: 'listo'; url: string }
  /** Falló y no queda intento (o hay que revisarlo): el texto de allá, sin botón. */
  | { v: 'fallo'; texto: string };

/** Qué dibuja la tarjeta. `error` = lo que contestó la última llamada con `ok: false` (se muestra tal cual). */
export function vistaDelClip(clip: ClipRegalo | null, error: string | null): VistaClip {
  if (!clip) return error ? { v: 'aviso', texto: error } : { v: 'nada' };
  switch (clip.estado) {
    case 'disponible': return { v: 'pedir', aviso: null, segundos: clip.segundos, max: clip.maxPalabras };
    case 'generando': return { v: 'generando' };
    case 'listo': return { v: 'listo', url: clip.url };
    case 'no-disponible': return { v: 'aviso', texto: clip.texto };
    case 'fallo': return clip.puedeReintentar ? { v: 'pedir', aviso: clip.texto, segundos: SEGUNDOS_CLIP_REGALO, max: MAX_PALABRAS_CLIP } : { v: 'fallo', texto: clip.texto };
  }
}

/**
 * La frase mientras se escribe: cuántas palabras lleva y si ya se puede mandar. Cuenta IGUAL que el servidor (`fraseDelClip`), así el
 * botón no deja mandar lo que allá se rechaza. Si se pasa, el texto de allá («…la tuya tiene 31. Déjala más corta.»); si le falta,
 * nada todavía (no se reta a quien recién empieza a escribir).
 */
export function frasePorEscribir(texto: string, max: number = MAX_PALABRAS_CLIP): { palabras: number; lista: boolean; aviso: string | null } {
  const f = fraseDelClip(texto);
  const limpia = String(texto ?? '').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
  const palabras = limpia ? limpia.split(' ').length : 0;
  if (f.ok) return palabras <= max ? { palabras, lista: true, aviso: null } : { palabras, lista: false, aviso: null };
  return { palabras, lista: false, aviso: palabras > 1 ? f.error : null };
}

// ── La frase ya escrita: el gancho de su guion (el día 5 escribió uno en Copywriter) ──────────────────────────────────────────────
// La tarjeta lo lee con la API del Copywriter (`listar` y `abrir`, sólo lectura) y lo pone en la caja si todavía está vacía. Si no hay
// guion, o no se puede leer (otra persona del equipo, sin Copywriter), la caja queda vacía: nunca un error por esto.

/** El guion más nuevo que no está en la papelera (el del día 5, casi siempre). */
export function guionMasNuevo<P extends { id: string; actualizado: string; papelera?: string | null }>(paginas: readonly P[] | null | undefined): P | null {
  let mejor: P | null = null;
  for (const p of paginas ?? []) if (!p.papelera && (!mejor || p.actualizado > mejor.actualizado)) mejor = p;
  return mejor;
}

/**
 * El gancho de un guion: el primer bloque con texto bajo el título de sección «GANCHO» (lib/copywriter/doc.ts: una sección es un título
 * con `attrs.seccion`); sin esa sección, el primer párrafo con texto. Si no entra en `max` palabras, su primera oración, si esa entra;
 * si tampoco, el bloque entero: la cuenta de abajo le dice cuánto sobra y lo acorta ella (NUNCA se corta en silencio, la trampa del
 * 19/11 en el personaje en cubos).
 */
export function ganchoDelGuion(doc: JsonNodo | null | undefined, max: number = MAX_PALABRAS_CLIP): string {
  const bloques = doc?.content ?? [];
  const esSeccion = (b: JsonNodo) => b.type === 'heading' && esEtiqueta(b.attrs?.seccion);
  const i = bloques.findIndex((b) => esSeccion(b) && b.attrs?.seccion === 'GANCHO');
  const desde = i >= 0 ? bloques.slice(i + 1) : bloques;
  let texto = '';
  for (const b of desde) {
    if (i >= 0 && esSeccion(b)) break;
    if (b.type === 'heading') continue;
    const t = textoDeNodo(b).replace(/\s+/g, ' ').trim();
    if (t) { texto = t; break; }
  }
  if (!texto || frasePorEscribir(texto, max).lista) return texto;
  const primera = texto.match(/^.+?[.!?…](?=\s|$)/)?.[0]?.trim() ?? '';
  return primera && frasePorEscribir(primera, max).lista ? primera : texto;
}
