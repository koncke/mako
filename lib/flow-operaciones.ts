// =============================================================================
// Qué operaciones sabe hacer el puente, y cuáles hay que ENSEÑARLE
// =============================================================================
// EL PROBLEMA QUE RESUELVE, en palabras del dueño: «ten en cuenta la generación de
// imagen, no sé si hay que enseñarle eso también… y no solo la imagen, también el
// subir una nueva imagen, por si el usuario sube una foto suya. Y también el
// descargar».
//
// La pregunta es correcta y la respuesta no era una: son SEIS operaciones y cada
// una se aprende distinto. Hasta acá el puente tenía UNA frase centinela y un
// booleano `aprendioGenerar`, así que aprender una cosa hacía que el sistema dijera
// que sabía todo. Con seis operaciones eso ya no es una simplificación: es una
// afirmación falsa que además cuesta créditos de Google del cliente comprobar.
//
// ⚠️ ESTE ARCHIVO ES LA FUENTE ÚNICA. `extension/operaciones.js` se GENERA de acá
// con `scripts/sync-operaciones.mjs`, y el pre-push falla si quedó viejo. No se
// edita a mano: la extensión no puede importar de `lib/`, y una copia a mano es
// exactamente cómo se desincronizaron el contrato del `detalle` y la gramática de
// MaKo antes de que existieran sus scripts.
//
// SIN `server-only`: lo importa el generador, lo importan los tests, y lo importa
// el saneo de plantillas, que decide qué se persiste.

// `import type` se borra en compilación, así que esto NO arrastra `workspace` ni
// `supabase` —que sí son server-only— al grafo de nadie.
import type { TipoTrabajo } from './flow-cola';

/**
 * Cómo se aprende una operación.
 *
 * - `ancla`   — hace falta que la persona GENERE algo escribiendo una frase que
 *               lleva un token nuestro. Cuesta créditos: es la única forma de ver
 *               un pedido de generación, porque Flow no lo hace por su cuenta.
 * - `trafico` — se aprende MIRANDO lo que Flow hace igual. Gratis y sin pedirle
 *               nada a nadie.
 * - `ninguna` — no pasa por el espejo. No hay nada que aprender.
 */
export type ComoSeAprende = 'ancla' | 'trafico' | 'ninguna';

export type Operacion = {
  /**
   * El id estable de la operación.
   *
   * ⚠️ NO es el rpcid. El rpcid (`YhhmEf`) es de un bundle de Google y rota; si
   * fuera la llave, un respaldo guardado hoy re-sembraría mañana un id muerto —
   * peor que no tener respaldo, porque el pedido sale y falla.
   */
  op: string;
  /** El trabajo del producto que esta operación habilita. */
  tipo: TipoTrabajo;
  /** La clase del protocolo viejo, para el respaldo y los textos ya escritos. */
  pathClase: string;
  como: ComoSeAprende;
  /**
   * El ancla alfanumérica que se busca dentro del cuerpo capturado.
   *
   * ⚠️ ALFANUMÉRICA Y SIN ESPACIOS, y no es un detalle de estilo. La frase entera
   * no sirve como ancla: en un cuerpo `form-urlencoded` —como manda BOQ— el
   * espacio se escribe `+` y no `%20`, así que ninguna codificación la encuentra.
   * Medido: cero de seis. El token sobrevive a url-encoding, form-encoding, el
   * escapado de JSON y los tres anidados.
   */
  token: string | null;
  /** Lo que la persona escribe en Flow. Contiene el token. */
  frase: string | null;
  /**
   * Si esta operación le PIDE algo a la persona.
   *
   * ⚠️ NO ES LO MISMO QUE «se aprende gratis». `creditos` y `estado_clips` se
   * aprenden solas mirando lo que Flow hace igual: no hay ninguna acción que
   * alguien pueda tomar para que pasen antes. `subir_imagen` también es gratis, y
   * sin embargo SÍ pide algo — que suba una foto.
   *
   * Confundirlas fue un bug reportado el 05/09/2026: el popup mostraba «Enséñame a
   * usar tu Flow» con `creditos` como paso siguiente y un botón «Entendido» que sólo
   * cerraba la ventana. El dueño lo reportó textual: «le doy a Entendido y no hace
   * nada». Y no hacía nada porque no había nada que hacer.
   *
   * Peor que el botón muerto: dejaba TRABADO ahí, sin llegar a las dos que sí
   * necesitan a la persona. Es la regla de la casa —una guarda bloquea sólo lo que
   * se arregla haciendo lo que ella pide— aplicada a un wizard.
   */
  pide: boolean;
  /** Si aprenderla le cuesta créditos de Google al cliente. */
  cuesta: boolean;
  /** Si el pedido lleva token de reCAPTCHA (ver SIN_CAPTCHA en background.js). */
  captcha: boolean;
  /**
   * El rótulo del botón cuando la persona YA está parada donde tiene que actuar.
   *
   * ⚠️ EXISTE PORQUE «Ir a Google Flow» SE REPORTÓ TRES VECES ESTANDO EN GOOGLE FLOW.
   *
   * Las tres veces el botón HACÍA lo correcto —`abrirFlow` enfoca la pestaña, así que
   * estando ahí sólo cierra el popup y deja Flow adelante— y las tres veces la
   * ETIQUETA mentía. El defecto no estaba en la acción sino en el rótulo, y por eso
   * sobrevivió a dos arreglos: cada uno agregaba una condición para SU caso y el
   * siguiente caía por el `else`.
   *
   * Vive acá y no en un `if` del popup para que una operación nueva no pueda nacer sin
   * su rótulo: el compilador lo exige.
   *
   * Nombra su acción y su objeto, nunca un verbo suelto — la regla de la casa de que
   * ningún botón puede ser «Aceptar» a secas.
   */
  boton: string;
  /** Qué tiene que hacer la persona, en una línea, en español neutro. */
  que: string;
};

/**
 * Las seis, en el orden en que conviene enseñarlas.
 *
 * ⚠️ EL ORDEN ES POR LO QUE DESBLOQUEA, NO POR LO FÁCIL. Las tres gratis van
 * primero porque no cuestan nada y ya dejan al puente leyendo saldo y sondeando; y
 * entre las dos pagas va primero el clip, que es lo que el producto pide más.
 */
export const OPERACIONES: readonly Operacion[] = Object.freeze([
  {
    op: 'creditos',
    tipo: 'creditos',
    pathClase: 'credits',
    como: 'trafico',
    token: null,
    frase: null,
    pide: false,
    cuesta: false,
    captcha: false,
    boton: 'Entendido',
    que: 'Se aprende sola: Flow lee tu saldo cada vez que abres el proyecto.',
  },
  {
    op: 'estado_clips',
    tipo: 'estado_clips',
    pathClase: 'video:batchCheckAsyncVideoGenerationStatus',
    como: 'trafico',
    token: null,
    frase: null,
    pide: false,
    cuesta: false,
    captcha: false,
    boton: 'Entendido',
    que: 'Se aprende sola mientras un video tuyo se está generando.',
  },
  {
    op: 'subir_imagen',
    tipo: 'subir_imagen',
    pathClase: 'uploadImage',
    como: 'trafico',
    token: null,
    frase: null,
    pide: true,
    cuesta: false,
    captcha: false,
    // Es la que el dueño preguntó por su nombre. Gratis: se aprende la primera vez
    // que la persona sube una foto suya, sin pedirle nada extra.
    boton: 'Subir la foto',
    que: 'Sube una foto tuya a Flow una vez. Con eso queda aprendida.',
  },
  {
    op: 'generar_clip',
    tipo: 'generar_clip',
    pathClase: 'video:batchAsyncGenerateVideoStartImage',
    como: 'ancla',
    token: 'mako7f3a9c',
    frase: 'un cubo violeta girando sobre arena mako7f3a9c',
    pide: true,
    cuesta: true,
    captcha: true,
    boton: 'Copiar la frase',
    que: 'Genera UN video de 4 segundos con la frase exacta que MaKo te da.',
  },
  {
    op: 'generar_imagen',
    tipo: 'generar_imagen',
    pathClase: 'flowMedia:batchGenerateImages',
    como: 'ancla',
    // ⚠️ Token PROPIO, distinto al del clip. Con un token compartido no se puede
    // saber CUÁL de las dos se aprendió — y el sistema diría que sabe generar video
    // después de que la persona generó una imagen, que es la falla más cara acá:
    // se descubre cuando el pedido sale y Google contesta 400.
    token: 'mako4d1c8b',
    frase: 'una esfera naranja flotando sobre nieve mako4d1c8b',
    pide: true,
    cuesta: true,
    captcha: true,
    boton: 'Copiar la frase',
    que: 'Genera UNA imagen con la frase exacta que MaKo te da.',
  },
  {
    op: 'enlace_clip',
    tipo: 'enlace_clip',
    pathClase: '',
    como: 'ninguna',
    token: null,
    frase: null,
    pide: false,
    cuesta: false,
    captcha: false,
    // ⚠️ LA BAJADA NO SE ENSEÑA, y no es una omisión: es el único trabajo que no
    // pasa por el espejo. El enlace firmado no vive en ninguna respuesta —
    // `getMediaUrlRedirect` REDIRIGE al archivo, y ese redirect no se puede leer
    // con `fetch` ni desde la página ni desde el service worker: CORS lo corta en
    // las dos. Lo resuelve `webRequest`, que mira el tráfico desde afuera del
    // modelo de CORS.
    //
    // Por eso sobrevive a que Google reescriba el protocolo: no depende de él.
    boton: 'Entendido',
    que: 'No hace falta enseñarla: MaKo la resuelve mirando el tráfico.',
  },
]);

/** La operación de un id, o `null`. */
export function operacionDe(op: string): Operacion | null {
  return OPERACIONES.find((o) => o.op === op) || null;
}

/** Las que el puente necesita saber. Las de `ninguna` no cuentan. */
export const A_ENSENAR: readonly Operacion[] = Object.freeze(
  OPERACIONES.filter((o) => o.como !== 'ninguna'),
);

/**
 * Las que se le PIDEN a la persona, en orden.
 *
 * ⚠️ ES LO QUE ALIMENTA EL WIZARD, y es un subconjunto de `A_ENSENAR`. Las otras se
 * aprenden solas: mostrarlas como un paso deja a alguien mirando una pantalla que le
 * pide algo que no puede hacer, con un botón que sólo cierra.
 */
export const A_PEDIR: readonly Operacion[] = Object.freeze(
  OPERACIONES.filter((o) => o.como !== 'ninguna' && o.pide),
);

/** Cuántas generaciones pagadas hacen falta para dejar el puente completo. */

/** Cuántas generaciones pagadas hacen falta para dejar el puente completo. */
export const CUANTAS_PAGADAS = OPERACIONES.filter((o) => o.cuesta).length;

/**
 * Las formas en que un texto puede aparecer dentro del cuerpo de un pedido.
 *
 * ⚠️ `form` FALTABA Y ERA LA QUE IMPORTABA. BOQ manda `f.req` como
 * `application/x-www-form-urlencoded`, donde el espacio es `+`. Sin esa fila, una
 * generación capturada perfecta daba «no aprendí».
 */
const CODIFICACIONES: readonly [string, (t: string) => string][] = Object.freeze([
  ['crudo', (t: string) => t],
  ['json', (t: string) => JSON.stringify(t).slice(1, -1)],
  ['uri', (t: string) => encodeURIComponent(t)],
  ['json+uri', (t: string) => encodeURIComponent(JSON.stringify(t).slice(1, -1))],
  ['form', (t: string) => new URLSearchParams({ x: t }).toString().slice(2)],
  ['json2', (t: string) => JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1)],
]);

/**
 * Con qué codificación aparece `ancla` en `cuerpo`, o `null`.
 *
 * Generaliza lo que antes buscaba UNA frase fija. El nombre de la codificación no
 * es decorativo: dice dónde y cómo hay que escribir el prompt el día que MaKo
 * repita el pedido.
 */
export function dondeAparece(cuerpo: string | null | undefined, ancla: string): string | null {
  if (typeof cuerpo !== 'string' || !cuerpo || !ancla) return null;
  for (const [nombre, codificar] of CODIFICACIONES) {
    try { if (cuerpo.includes(codificar(ancla))) return nombre; } catch { /* sigue */ }
  }
  return null;
}

/**
 * Qué operación es este cuerpo, mirando los tokens del catálogo.
 *
 * Devuelve `{ op, donde }` o `null`. Es lo que reemplaza al booleano global: con
 * seis operaciones, «aprendió» sin decir QUÉ aprendió no es una respuesta.
 */
export function operacionDelCuerpo(cuerpo: string | null | undefined): { op: string; donde: string } | null {
  for (const o of OPERACIONES) {
    if (!o.token) continue;
    // ⚠️ SE DETECTA CON EL TOKEN Y SE ETIQUETA CON LA FRASE, y son dos cosas.
    //
    // El token es alfanumérico justamente para que ninguna codificación lo cambie —
    // por eso encuentra la generación pase lo que pase. Pero eso mismo lo vuelve
    // INÚTIL como etiqueta: al ser idéntico bajo todas, `dondeAparece` contesta
    // siempre 'crudo', que es cierto y no dice nada.
    //
    // Lo que hace falta para REPETIR el pedido es cómo viajó la FRASE, que sí tiene
    // espacios y sí cambia: en un cuerpo form-urlencoded es 'form'. Ése es el dato
    // que dice dónde y cómo hay que escribir el prompt nuevo.
    //
    // Medido: token → 'crudo', frase → 'form', sobre el mismo cuerpo.
    if (!dondeAparece(cuerpo, o.token)) continue;
    const donde = (o.frase && dondeAparece(cuerpo, o.frase)) || 'token';
    return { op: o.op, donde };
  }
  return null;
}
