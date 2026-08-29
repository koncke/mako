import 'server-only';

// =============================================================================
// Los guiones que MaKo YA escribió, para elegir uno en vez de escribir el tema
// =============================================================================
// El dueño, textual: «En esta tab, jamás me debe preguntar "¿De qué habla tu
// anuncio?" para eso ya existen guiones creados dentro de MaKo, debe traer esos.
// Y claro, detectar si alguno ya fue creado con esta funcionalidad.»
//
// ── Dónde viven ─────────────────────────────────────────────────────────────
// No hay tabla. Viven como JSON en `app_settings` bajo la key `mako.razones`,
// dentro de `RazonCelda.guiones[]`, y los escribe `generarGuion()` desde la
// matriz de /ads-writer. El scoping por workspace lo da `app_settings`, que tiene
// PK compuesta `(workspace_id, key)` desde la mig 0054 — o sea que `getRazones()`
// ya devuelve solo lo del cliente en curso y no hace falta filtrar de nuevo.
//
// ── Y el texto tiene forma, aunque sea un string ────────────────────────────
// Cada bloque va con su etiqueta en MAYÚSCULA sola en su línea (GANCHO, HISTORIA,
// CTA…), porque el prompt que los escribe se lo exige: «No cambies el nombre, el
// orden ni el formato: la app las usa para separar el guion en tarjetas». Esas
// etiquetas NO son parte de lo que se dice a cámara, así que para medir cuánto
// dura el guion hay que sacarlas — contarlas infla el largo y haría que un guion
// que entra parezca que no.

import { getRazones } from '@/lib/razones';
// `soloHablado` vive en puestas-data —sin `server-only`— porque decide cuántas
// palabras tiene un guion, y de ahí sale la duración: necesita test.
import { soloHablado, puestaPorId } from '@/lib/puestas-data';
import { leerHistorial } from './video-datos';

export type GuionDisponible = {
  id: string;
  /** El ángulo del que salió, que es como el dueño los reconoce. */
  angulo: string;
  /** La estructura con la que se escribió (PAS, AIDA, …). */
  estructura: string;
  estado: string;
  creadoEn: number;
  /** El texto completo, con sus etiquetas. Es lo que se manda a generar. */
  texto: string;
  /**
   * Solo lo que se DICE, sin los rótulos de sección. Es lo que mide la duración:
   * contar los rótulos infla el largo y haría que un guion que entra parezca que
   * no.
   */
  hablado: string;
  /** Las primeras palabras de lo que de verdad se dice, para la lista. */
  primeraLinea: string;
  /** Palabras HABLADAS: sin las etiquetas de sección. */
  palabras: number;
  /** `true` si este guion ya se usó: se grabó, o se planificó en esta tab. */
  yaUsado: boolean;
  /**
   * Los formatos con los que YA se grabó, por nombre («Car Talks», «The
   * Office»). Vacío no significa «no se grabó»: significa que no consta.
   *
   * Se muestra en vez de un tilde porque «ya lo usaste» no alcanza para decidir:
   * el mismo guion grabado en Car Talks se puede querer grabar en The Office —
   * es lo que hizo el dueño con su primer anuncio— y para eso hay que saber
   * cuál de los dos falta.
   */
  grabadoEn: string[];
};

/**
 * Los guiones del workspace, del más nuevo al más viejo.
 *
 * ── De dónde sale «este ya lo usé» ─────────────────────────────────────────
 * De TRES lugares, y hacen falta los tres:
 *
 *  1. `grabadoComo` del guion — los formatos con los que ya se grabó. Es el
 *     único que no caduca, y el único que sabe de anuncios producidos FUERA de
 *     esta tab. Los cuatro primeros anuncios de Mauricio son eso: existen, son
 *     los ejemplos del catálogo de plantillas, y hasta hoy figuraban como si
 *     nunca se hubieran grabado.
 *  2. El `estado` del guion en el pipeline (`grabado` / `publicado`), que es lo
 *     que marca el resto de la app desde /ads-writer.
 *  3. El HISTORIAL de esta tab, que guarda 10 entradas y se recorta solo.
 *
 * El historial quedó de último a propósito: por sí solo miente por omisión —un
 * guion planificado hace mucho vuelve a figurar como nuevo—, y esa era la razón
 * por la que un guion ya grabado se ofrecía como si estuviera fresco.
 *
 * ⚠️ Se sigue marcando de menos y nunca de más. Decirle a alguien que ya grabó
 * un guion que no grabó lo manda a buscar un anuncio que no existe; lo contrario
 * solo repite un aviso.
 */
export async function guionesDisponibles(): Promise<GuionDisponible[]> {
  const [razones, historial] = await Promise.all([getRazones(), leerHistorial()]);

  const usados = new Set(
    historial.map((h) => h.guionId).filter((v): v is string => typeof v === 'string' && v.length > 0),
  );

  const out: GuionDisponible[] = [];
  for (const celda of razones ?? []) {
    for (const g of celda.guiones ?? []) {
      const texto = String(g.texto ?? '').trim();
      if (!texto) continue;
      const hablado = soloHablado(texto);

      // Los formatos con los que ya se grabó, por NOMBRE. Un id de puesta que no
      // está en el catálogo se descarta en vez de mostrarse crudo: «grabado como
      // selfie-movimiento» no le dice nada a nadie.
      const grabadoEn = (Array.isArray(g.grabadoComo) ? g.grabadoComo : [])
        .map((id) => puestaPorId(String(id))?.nombre)
        .filter((v): v is string => !!v);

      const estado = String(g.estado ?? 'borrador');

      out.push({
        id: String(g.id ?? ''),
        angulo: String(g.anguloNombre ?? celda.nombre ?? '').trim(),
        estructura: String(g.estructuraNombre ?? '').trim(),
        estado,
        creadoEn: Number(g.creadoEn ?? 0),
        texto,
        hablado,
        primeraLinea: hablado.slice(0, 160),
        palabras: hablado.split(/\s+/).filter(Boolean).length,
        grabadoEn,
        yaUsado:
          grabadoEn.length > 0
          || estado === 'grabado' || estado === 'publicado'
          || usados.has(String(g.id ?? '')),
      });
    }
  }

  // Del más nuevo al más viejo. `creadoEn: 0` son los viejos sin fecha, que caen
  // al final — que es donde corresponde: son los que menos probablemente se
  // quieran grabar hoy.
  return out.sort((a, b) => b.creadoEn - a.creadoEn);
}
