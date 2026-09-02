// =============================================================================
// Reusar el escenario que ya se generó, en vez de volver a pagarlo
// =============================================================================
// SIN `server-only` y sin React: es lo que decide si se le ofrece a alguien una
// imagen VIEJA como si fuera de este anuncio, y eso no puede vivir sin test.
//
// ── El pedido ──────────────────────────────────────────────────────────────
// Martín: «cuando ya se generó 1 video en algún formato, las fotos que se usaron
// de molde para el clip deberían quedar, con la opción de hacer nuevas o
// variaciones, pero de esta manera evitamos pasar por tantos pasos si ya hice 1
// generación».
//
// Tiene razón y el costo es medible: cada imagen de escenario es una generación
// que se paga y una espera que la persona mira. En Car Talks hay UNA por anuncio;
// en The Office hay CUATRO. Alguien que hace su segundo anuncio del mismo formato
// vuelve a pasar por todo eso para llegar al mismo lugar.
//
// ── ⚠️ Y POR QUÉ NO ALCANZA CON «MISMO FORMATO» ────────────────────────────
// Un escenario no es del FORMATO: es del LUGAR. «The Office» son cuatro rincones
// de una oficina, y el segundo anuncio puede transcurrir en otros cuatro. Reusar
// por formato pondría a la persona en un lugar que su guion no menciona — y eso
// no da error: da un anuncio donde lo que se ve no tiene nada que ver con lo que
// se dice, que es exactamente la regla que el formato ya tiene escrita («Lo que
// se ve NO ilustra la frase» es otra cosa: ahí el fondo es contexto, acá sería
// un contexto de otro anuncio).
//
// Así que el match es por LUGAR, normalizado. Es el mismo criterio que este repo
// ya pagó en otro lado: un nombre derivado de datos es una CLAVE, y dos que
// difieren en un acento o en un espacio doble se ven idénticos en cualquier
// listado.

import type { PlanGuardado, MarcaImagen } from './video-datos';

/** Una imagen ya generada que sirve para este escenario. */
export type Reusable = {
  /** El número de escena de ESTE plan al que le corresponde. */
  escena: number;
  /** De dónde sale, para poder decirlo en pantalla. */
  deAnuncio: string;
  lugar: string;
  /** La url para mostrarla. ⚠️ Vence (~6 h): sirve para mirar, no para filmar. */
  url: string;
  /**
   * El `mediaId` dentro de Flow. ⚠️ ES EL QUE IMPORTA: no vence, y es con lo que
   * el clip se anima. Una reutilización sin esto se vería bien en la pantalla y
   * no se podría filmar.
   */
  mediaId: string;
};

/**
 * Un lugar, como CLAVE.
 *
 * ⚠️ Sin acentos, sin mayúsculas y sin espacios de más. «La oficina» y «la
 * oficina.» son el mismo lugar, y compararlos crudos los trata como dos.
 */
export function claveDeLugar(lugar: string): string {
  return (lugar ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Esta imagen sirve para filmar? Confirmada, con url Y con mediaId. */
function sirve(m: MarcaImagen | undefined): m is MarcaImagen & { elegida: string; elegidaId: string } {
  return !!m?.confirmada && !!m.elegida && !!m.elegidaId;
}

/**
 * Qué escenarios de `plan` se pueden llenar con imágenes ya generadas.
 *
 * `historial` viene ordenado del más nuevo al más viejo, así que la primera
 * coincidencia gana: la última vez que esa persona filmó ese lugar es la que más
 * se parece a lo que quiere ahora.
 */
export function escenariosReusables(plan: PlanGuardado, historial: PlanGuardado[]): Reusable[] {
  const mias = plan.escenas ?? [];
  if (!mias.length) return [];

  const out: Reusable[] = [];
  for (const escena of mias) {
    // ⚠️ NO SE OFRECE PARA UN ESCENARIO QUE YA TIENE IMAGEN. Ofrecer una vieja
    // sobre una que la persona ya confirmó es proponerle deshacer su propio
    // trabajo, y con un clic que no dice qué se lleva puesto.
    if (plan.imagenes?.[String(escena.n)]?.elegida) continue;

    const clave = claveDeLugar(escena.lugar);
    if (!clave) continue;

    for (const viejo of historial) {
      if (viejo.id === plan.id) continue;
      // El formato tiene que ser el mismo: una imagen de Car Talks es un selfie
      // adentro de un auto, y en The Office el encuadre es otro. El lugar puede
      // llamarse igual y la foto no servir.
      if (viejo.plan?.puestaId !== plan.plan?.puestaId) continue;

      const suya = (viejo.escenas ?? []).find((e) => claveDeLugar(e.lugar) === clave);
      if (!suya) continue;
      const img = viejo.imagenes?.[String(suya.n)];
      if (!sirve(img)) continue;

      out.push({
        escena: escena.n,
        deAnuncio: viejo.plan?.titulo ?? 'un anuncio anterior',
        lugar: escena.lugar,
        url: img.elegida,
        mediaId: img.elegidaId,
      });
      break;
    }
  }
  return out;
}

/**
 * Cuántos escenarios de este plan se podrían llenar sin generar nada.
 *
 * Es el número que va en la pantalla: «3 de tus 4 escenarios ya los tienes». Sin
 * el número, la oferta es una casilla más que nadie sabe si le conviene.
 */
export function cuantosSeReusan(plan: PlanGuardado, historial: PlanGuardado[]): number {
  return escenariosReusables(plan, historial).length;
}
