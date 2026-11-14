// =============================================================================
// copywriter/datos-que-faltan — los [DATO: …] que quedaron, MaKo los PREGUNTA (PURO; 13/11/2026)
// =============================================================================
// El Cerebro, con el anuncio de Hormozi replicado el 13/11: quedó un [DATO: …] sin llenar en la pieza. Martín no quiere una pieza
// con huecos: después de escribirla, MaKo pregunta lo que falta en el mismo paso de las preguntas (app/copywriter/PanelMaKo.tsx), de a
// uno y con «No lo sé». Lo contestado se pone en la página EN LUGAR del [DATO] (todo junto, en un paso de deshacer); lo que nadie
// sabe queda marcado y la pantalla lo dice. Las cifras y los casos salen sólo del negocio: por eso no se los inventa la IA.
// =============================================================================

import type { JsonNodo } from './tipos';
import type { PasoIniciativa } from './iniciativa';

/** Cuántos datos pregunta como mucho (los demás quedan marcados y se dicen). */
export const TOPE_DATOS = 4;
/** «No lo sé: déjalo marcado». */
export const NO_LO_SE = 'no-lo-se';

const DATO = /\[DATO:\s*([^\]\n]{1,200})\]/g;

/** Los [DATO: …] de un texto, sin repetir y en orden. */
export function datosQueFaltan(texto: string): string[] {
  return [...new Set([...texto.matchAll(DATO)].map((m) => m[0]))];
}

/** Lo que pide un [DATO: …], para preguntarlo («[DATO: un caso real]» → «un caso real»). */
export function queFalta(dato: string): string {
  return dato.replace(/^\[DATO:\s*/, '').replace(/\]$/, '').trim();
}

const conMayuscula = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/** La pregunta del dato que sigue (de los primeros TOPE_DATOS), o null si ya contestó todos. */
export function pasoDeDato(lista: readonly string[], resp: Readonly<Record<string, string>>): PasoIniciativa | null {
  const preguntables = lista.slice(0, TOPE_DATOS);
  const i = preguntables.findIndex((d) => !(d in resp));
  if (i < 0) return null;
  const que = queFalta(preguntables[i]);
  const intro = i === 0
    ? `Para no inventarlo, dejé ${lista.length === 1 ? 'un dato' : `${lista.length} datos`} sin completar. `
    : '';
  return {
    id: `dato:${preguntables[i]}`, libre: true,
    pregunta: `${intro}${i === 0 ? que : conMayuscula(que)}: ¿me lo dices?`,
    opciones: [{ valor: NO_LO_SE, texto: 'No lo sé: déjalo marcado' }],
  };
}

/** La respuesta a la pregunta de un dato (la clave es el [DATO: …] entero). */
export const datoDelPaso = (paso: PasoIniciativa): string => paso.id.slice('dato:'.length);

/**
 * El documento con lo contestado EN LUGAR de cada [DATO: …] (en el texto de cada renglón; uno partido por un formato, como una
 * negrita en el medio, queda como estaba). `puestos`: cuántos se completaron.
 */
export function conDatos(doc: JsonNodo, resp: Readonly<Record<string, string>>): { doc: JsonNodo; puestos: number } {
  const valores = Object.entries(resp).filter(([, v]) => v && v !== NO_LO_SE).map(([d, v]) => [d, v.replace(/\s+/g, ' ').trim()] as const);
  const puestos = new Set<string>();
  const cambiar = (n: JsonNodo): JsonNodo => {
    let x = n;
    if (typeof n.text === 'string') {
      let t = n.text;
      for (const [d, v] of valores) if (t.includes(d)) { t = t.split(d).join(v); puestos.add(d); }
      if (t !== n.text) x = { ...n, text: t };
    }
    return n.content ? { ...x, content: n.content.map(cambiar) } : x;
  };
  const nuevo = cambiar(doc);
  return { doc: puestos.size ? nuevo : doc, puestos: puestos.size };
}

/** Lo que MaKo dice al terminar: cuántos puso y lo que queda marcado. */
export function dichoDeDatos(puestos: number, quedan: readonly string[]): string {
  const puse = puestos ? `Listo: ${puestos === 1 ? 'puse el dato' : `puse los ${puestos} datos`} en la página.` : '';
  const queda = quedan.length
    ? `${quedan.length === 1 ? 'Queda 1 dato marcado' : `Quedan ${quedan.length} datos marcados`} [DATO: …] en la página, para completar cuando lo tengas: ${quedan.map(queFalta).join('; ')}.`
    : '';
  return [puse, queda].filter(Boolean).join(' ') || 'Listo.';
}
