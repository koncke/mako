// =============================================================================
// replay-contrato — lo que los TRES paquetes del replay tienen que compartir
// =============================================================================
// Grabar la sesión de un visitante se construye en tres pedazos que no pueden
// verse entre sí:
//
//   1. el GRABADOR, que vive pegado en la página de un tercero (Lovable, Framer,
//      WordPress) y que no podemos tocar después;
//   2. el RECEPTOR (`/api/track/replay`), que corre acá;
//   3. el REPRODUCTOR, que corre dentro de MaKo.
//
// Un número distinto en cualquiera de los tres rompe el otro EN SILENCIO: un tope
// de lote más chico del lado del server descarta la cola de cada sesión y nadie
// se entera; una ruta de Storage armada distinto deja la grabación guardada y
// huérfana. Así que los números viven UNA vez, acá, y los tres los importan.
//
// ⚠️ SIN `server-only`, a propósito y por la misma razón que `landing-config.ts`:
// lo que se puede equivocar es el SANEO y las DECISIONES —qué se graba, qué cabe,
// cuándo vence—, y eso tiene que poder probarse sin base de datos. Y el grabador
// corre en un navegador: nada de acá puede tocar `node:`.
//
// Lo que NO está acá: ninguna llamada a rrweb, a Supabase ni a `fetch`. Este
// archivo no graba, no guarda y no reproduce. Decide.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. QUÉ SE GRABA Y QUÉ NO — la decisión que no se arregla después
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Esto corre sobre los visitantes de los clientes DE NUESTROS CLIENTES, que nunca
 * aceptaron nada con nosotros. No hay un segundo intento: lo que se grabe mal ya
 * está grabado, y borrarlo después no deshace haberlo recibido.
 *
 * ⚠️ `maskAllInputs` de rrweb viene en **false**: de fábrica tapa el campo de
 * contraseña y NADA MÁS. O sea que la versión por defecto de la librería manda el
 * teléfono, el mail y el nombre que la persona está tecleando, carácter por
 * carácter, antes de que apriete enviar. Clarity sí los tapa en sus tres modos,
 * así que el default de rrweb es PEOR que la herramienta que venimos a reemplazar.
 *
 * `REPLAY_QUE_SE_GRABA` está en castellano y en este archivo para que alguien que
 * no sabe qué es rrweb pueda leer la decisión y discutirla. Si cambia la lista,
 * cambia acá y cambian las opciones de abajo juntas — son la misma decisión escrita
 * dos veces, una para una persona y otra para la librería.
 */
export const REPLAY_QUE_SE_GRABA = {
  si: [
    'La forma de la página: el texto, las imágenes y cómo se acomoda.',
    'El movimiento del mouse, el scroll y los toques en pantalla.',
    'Los clics, con el elemento que recibió cada uno.',
    'El tamaño de la ventana y los cambios de tamaño.',
    'La dirección de la página y el momento de cada cosa.',
  ],
  no: [
    'Lo que la persona escribe en cualquier campo: todo llega tapado.',
    'Los textos ya dibujados que son datos de una persona: teléfonos y correos.',
    'Lo que pasa adentro de un reproductor de video de otro dominio.',
    'Las cookies, el almacenamiento del sitio y las cabeceras de red.',
    'Cualquier elemento marcado con la clase de bloqueo.',
  ],
  /**
   * Lo que se graba aunque parezca dato: los PRECIOS.
   *
   * Tapar un precio deja la grabación sin la única cosa que explica por qué la
   * persona se fue de la página. Un precio no es de nadie: está publicado.
   */
  precios: 'Los precios se graban. No son datos de una persona: están publicados.',
} as const;

/** Clase para tapar un texto YA DIBUJADO (no un campo). Teléfonos, correos. */
export const REPLAY_MASK_CLASS = 'mko-tapar';
/** Clase para no grabar un elemento ni sus hijos. Queda un recuadro vacío. */
export const REPLAY_BLOCK_CLASS = 'mko-no-grabar';
/** Clase para grabar el elemento pero no lo que se escribe adentro. */
export const REPLAY_IGNORE_CLASS = 'mko-sin-texto';

/**
 * Las opciones con las que el grabador ARRANCA. No son un default sugerido: son
 * el contrato, y el grabador las importa en vez de escribirlas.
 *
 * ⚠️ `maskAllInputs: true` es la primera línea y no se negocia. Ver arriba.
 *
 * ⚠️ `maskTextSelector` tapa lo ya dibujado, que es un problema DISTINTO del de
 * los campos: una ficha de agradecimiento que dice «te escribimos al 55…» no es
 * un input y `maskAllInputs` no la ve. Esa es la fuga que queda abierta si uno
 * cree que tapar los campos alcanza.
 *
 * ⚠️ `collectFonts: false` y `inlineStylesheet: true`: la hoja de estilos va
 * adentro de la grabación (si no, el reproductor dibuja la página sin estilo el
 * día que el cliente la rediseña) y las fuentes NO (son cientos de kB por sesión
 * para que un texto se vea con la tipografía exacta).
 *
 * ⚠️ PERO DESDE EL GRABADOR v2 ESE `true` NO MANDA. Es lo que pide el snippet pegado
 * (v21/v22) y no se puede cambiar sin repegar; `public/replay/2/r.js` lo pisa con
 * `false` antes de llamar a rrweb (`scripts/replay-envoltorio.js`). Medido el
 * 08/10/2026 en la página real de ws1: con la hoja adentro la foto pesa 116.400 B y
 * el beacon de salida 123.687 —no entra en los 64 KiB y el snippet lo TIRA—; con la
 * hoja como link, 45.117 y 48.759. El costo es el del párrafo de arriba, y el
 * reproductor lo compensa a medias (`hojasSinCors`, lib/replay-reproductor.ts).
 */
export const REPLAY_OPCIONES_RRWEB = {
  maskAllInputs: true,
  maskInputOptions: { password: true, email: true, tel: true, text: true, textarea: true },
  maskTextClass: REPLAY_MASK_CLASS,
  maskTextSelector: '[data-mko-tapar], .mko-tapar, [type="tel"], [type="email"]',
  blockClass: REPLAY_BLOCK_CLASS,
  ignoreClass: REPLAY_IGNORE_CLASS,
  inlineStylesheet: true,
  collectFonts: false,
  recordCanvas: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERSIONES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Versión del PROTOCOLO (la forma del lote). Viaja en cada lote como `v`.
 *
 * Distinta de `SNIPPET_VERSION` (lib/landing-token.ts, hoy en 20) a propósito: el
 * snippet queda congelado en el HTML de un tercero y sube cuando sube; el
 * protocolo del replay cambia cuando cambia la forma del lote, que es otra cosa.
 */
export const REPLAY_VERSION = 1;

/**
 * Versión de la LIBRERÍA que servimos, y es parte de la URL.
 *
 * ⚠️ ACÁ ESTÁ EL ARREGLO DEL PROBLEMA MÁS CARO QUE TIENE EL PIXEL HOY. El código
 * va pegado en la página del cliente y nadie lo vuelve a pegar: medido el
 * 05/10/2026, el workspace con 7.052 visitas en septiembre corre la versión 14 del
 * snippet y la actual es la 20, y la columna `clic_vacio` —que la 20 estrenó—
 * tiene CERO filas en tres meses en los cuatro workspaces que miden.
 *
 * Así que la librería NO se inlinea en el snippet: el snippet carga
 * `/replay/<REPLAY_LIB_VERSION>/r.js`, y cambiar ESE archivo es subir este número
 * — sin que nadie repegue nada. La ruta lleva la versión adentro para que se pueda
 * cachear un año y para que un arreglo sea una ruta NUEVA: cambiar el contenido de
 * una ruta que ya está cacheada en el navegador de un visitante es un cambio que
 * llega cuando quiere, y además pisa la versión que se probó.
 *
 * ⚠️ PERO EL GRABADOR NO ES r.js, Y ESTE COMENTARIO DECÍA LO CONTRARIO. El lote, el
 * piso, el beacon de salida y la cola viven en el snippet pegado (lib/landing-token.ts,
 * «GRABACIÓN DE SESIÓN»); r.js sólo trae rrweb. Subir este número cambia la librería
 * y lo que se pueda hacer DESDE AFUERA del snippet, envolviendo lo único que él llama
 * (`window.rrwebRecord`). Lo demás pide un snippet nuevo y repegar.
 *
 * LAS VERSIONES (las genera `scripts/replay-libs.mjs`, y ninguna se reescribe):
 *   · 1 — rrweb 2.0.0-alpha.4 pelado (05/10/2026).
 *   · 2 — el mismo rrweb + `scripts/replay-envoltorio.js` (08/10/2026): la hoja como
 *         link para que la foto entre en el beacon, un latido mientras la pestaña
 *         está a la vista para que quien mira el video sin tocar llegue al piso, y
 *         una foto nueva cada vez que la pestaña vuelve. Medido en ws1 antes de esto:
 *         0 de los 35 visitantes que estuvieron 10-30 s quedaron grabados.
 */
export const REPLAY_LIB_VERSION = 2;

/**
 * La etiqueta del latido que el grabador v2 emite con la pestaña a la vista (un
 * evento Custom de rrweb). La escriben DOS archivos que no se ven: el envoltorio
 * (`scripts/replay-envoltorio.js`, que es JavaScript pelado y no puede importar
 * esto) y el reproductor, que la vuelve invisible en la barra de tiempo. El test
 * `tests/replay-envoltorio.test.ts` exige que sean la misma.
 */
export const REPLAY_LATIDO = 'mko-vivo';

/** De dónde sale el grabador. Inmutable por versión. */
export const rutaDeLibreria = (version: number = REPLAY_LIB_VERSION): string =>
  `/replay/${Math.max(1, Math.trunc(version))}/r.js`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. EL LOTE — cómo viaja
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cada cuánto sale un lote, y de cuántos eventos.
 *
 * ⚠️ Los dos a la vez, y gana el primero. Solo por tiempo, una página con una
 * animación manda un lote gigante; solo por cantidad, una página quieta no manda
 * nada durante minutos y una pestaña que se cierra se lleva todo.
 *
 * Los 10 s salen de la cuenta: a ~100 kB/min, un lote es ~17 kB. Con 5 s se duplica
 * la cantidad de requests para no ganar nada; con 30 s se pierden hasta 30 s de la
 * sesión si el navegador se cierra de golpe.
 */
export const REPLAY_LOTE_MS = 10_000;
export const REPLAY_LOTE_EVENTOS = 100;

/**
 * Cuánto puede pesar un lote. Es el techo de `sendBeacon`, no un gusto.
 *
 * ⚠️ `navigator.sendBeacon` devuelve **false** cuando el cuerpo no entra en la
 * cuota del documento (64 KiB), y ESE es el único camino que sirve al salir de la
 * página. `fetch(keepalive)` tiene la misma cuota de 64 KiB para todo el documento
 * y NO avisa: la promesa resuelve igual. O sea que el camino que parece más moderno
 * es el que pierde datos sin decirlo.
 *
 * El grabador tiene que mirar el `false` y tirar la cola, no fingir que salió.
 */
export const REPLAY_BEACON_MAX_BYTES = 64 * 1024;

/** Lo que el grabador manda en cada POST. Un lote, nunca un evento solo. */
export type ReplayLote = {
  /** Protocolo. Ver REPLAY_VERSION. */
  v: number;
  /** Token público de landing del workspace (`mko_…`), igual que en /api/track/vsl. */
  t: string;
  /** UUID anónimo de la cookie `nqe_visitor_id`. El MISMO que ya usa el beacon. */
  visitor_id: string;
  /** Sesión. Ver `sesionIdValido`. */
  s: string;
  /**
   * Número de lote dentro de la sesión, desde 0.
   *
   * ⚠️ EL ORDEN NO SE DEDUCE DE LA LLEGADA. Un POST con `keepalive` y un
   * `sendBeacon` salen sin esperar respuesta y el navegador los entrega cuando
   * puede: el último lote de una sesión puede llegar antes que el anterior. El
   * reproductor necesita el flujo EN ORDEN, y la hora del servidor no lo dice.
   */
  n: number;
  /** Eventos de rrweb, serializados. Gzip si `z` es 1. */
  e: string;
  /** 1 = el cuerpo viene comprimido con gzip desde el navegador. */
  z: 0 | 1;
  /** Milisegundos de grabación acumulados al cerrar este lote. */
  ms: number;
  /** URL de la página, igual que en el beacon: un negocio puede tener varias. */
  landing_url?: string;
  /** Marcador de prueba (`?mko_test=`). NULL en el tráfico real. */
  prueba?: string;
  /** 1 = es el último lote; la sesión se puede sellar. */
  fin?: 0 | 1;
};

/** La fila de índice que queda en la base. El cuerpo vive en Storage. */
export type ReplaySesion = {
  id: string;
  visitor_id: string;
  landing_url: string | null;
  inicio: string;
  segundos: number;
  eventos: number;
  bytes: number;
  /** Ruta dentro del bucket. NULL mientras la sesión no está sellada. */
  storage_path: string | null;
  /** Por qué dejó de grabar. */
  corte: ReplayCorte;
};

/** Por qué una sesión dejó de grabar. `null` = la persona se fue, que es lo normal. */
export type ReplayCorte = null | 'tiempo' | 'bytes';

// ─────────────────────────────────────────────────────────────────────────────
// 4. LOS TOPES — por qué el almacenamiento no tiene techo sin ellos
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tope de grabación por sesión: 10 minutos.
 *
 * MEDIDO sobre septiembre de 2026 (el mes pico), con los eventos `cierre` reales:
 *
 *   ws  cierres  minutos sin tope  con tope de 10  sesiones de +10 min
 *    1    3.385            15.669           3.474               4,8 %
 *   13    1.059             2.342           1.355               3,7 %
 *   11      189             6.498             415              14,3 %
 *   14       50             1.859             131              12,0 %
 *   ──────────────────────────────────────────────────────────────────
 *            4.683          26.368           5.375
 *
 * O sea: el tope corta el 4,8 % de las sesiones del workspace grande y ahorra el
 * **80 % de los minutos**. Esas colas no son gente mirando: son pestañas
 * olvidadas. El `cierre` más largo medido es de **124.055 segundos — 34 horas**.
 *
 * ⚠️ Y EL TOPE SE MIDE EN TIEMPO GRABADO, NO EN RELOJ DE PARED. Es la trampa de
 * estos números: el promedio de `cierre.segundos` del ws 1 es 262 s y la mediana es
 * **19 s**. Dimensionar con el promedio da 14 veces de más, porque el promedio es
 * la pestaña de 34 horas. Una pestaña escondida no genera eventos de rrweb, así que
 * `Date.now() - inicio` le comería el tope entero sin haber grabado nada: lo que
 * cuenta es `ms`, que el grabador acumula solo cuando hay eventos.
 */
export const REPLAY_TOPE_SEGUNDOS = 600;

/**
 * Tope de bytes por sesión: 2 MiB (ya comprimidos).
 *
 * El tope de tiempo NO acota los bytes. Una página con un carrusel que se mueve
 * solo, un contador animado o una lista que se re-dibuja puede tirar megas por
 * minuto, y el de 10 minutos la deja pasar entera. Gana el que llegue primero.
 */
export const REPLAY_TOPE_BYTES = 2 * 1024 * 1024;

/**
 * El PISO: debajo de esto no se guarda nada.
 *
 * MEDIDO en septiembre de 2026: el **32,4 %** de las sesiones del ws 1 duran menos
 * de 10 segundos (28,5 % en el ws 13, 46,6 % en el ws 11). Son rebotes: una
 * grabación de dos segundos no se puede mirar y ocupa una fila, un objeto y una
 * llamada igual que una de diez minutos.
 *
 * ⚠️ El piso se aplica en LAS DOS PUNTAS. En el navegador, para no gastar el
 * request —que es lo único que de verdad se ahorra—; y en el servidor al sellar,
 * porque el reloj del navegador no es confiable y porque una sesión que llegó por
 * un lote suelto fuera de orden puede quedar por debajo del piso sin que nadie lo
 * haya decidido.
 */
export const REPLAY_PISO_SEGUNDOS = 10;
export const REPLAY_PISO_EVENTOS = 20;

/**
 * ¿Cabe este lote en la sesión, o la sesión ya se terminó?
 *
 * Devuelve el CORTE cuando no cabe, porque el reproductor tiene que poder decir
 * «esto sigue» y no dejar creer que la persona se fue en ese segundo. Una
 * grabación que termina sin avisar que la cortamos nosotros es una conclusión
 * equivocada servida como dato.
 */
export function cabeEnLaSesion(
  yaAcumulado: { segundos: number; bytes: number },
  lote: { segundos: number; bytes: number },
): { cabe: boolean; corte: ReplayCorte } {
  const seg = Math.max(0, yaAcumulado.segundos) + Math.max(0, lote.segundos);
  const bytes = Math.max(0, yaAcumulado.bytes) + Math.max(0, lote.bytes);
  // El de bytes se evalúa primero: es el que puede saltar de golpe.
  if (bytes > REPLAY_TOPE_BYTES) return { cabe: false, corte: 'bytes' };
  if (seg > REPLAY_TOPE_SEGUNDOS) return { cabe: false, corte: 'tiempo' };
  return { cabe: true, corte: null };
}

/** `null` = la sesión se guarda. Cualquier otra cosa = por qué se tira. */
export function motivoDeDescarte(segundos: number, eventos: number): null | 'corta' | 'vacia' {
  if (!Number.isFinite(eventos) || eventos < REPLAY_PISO_EVENTOS) return 'vacia';
  if (!Number.isFinite(segundos) || segundos < REPLAY_PISO_SEGUNDOS) return 'corta';
  return null;
}

/** ¿Este cuerpo entra por `sendBeacon`, o hay que tirarlo? Ver REPLAY_BEACON_MAX_BYTES. */
export const puedeIrPorBeacon = (bytes: number): boolean =>
  Number.isFinite(bytes) && bytes > 0 && bytes <= REPLAY_BEACON_MAX_BYTES;

// ─────────────────────────────────────────────────────────────────────────────
// 5. LA RETENCIÓN — es parte del almacenamiento, no un detalle
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 30 días, los mismos que Clarity. Sin un tope, esto crece para siempre.
 *
 * LA CUENTA, con los datos reales de septiembre de 2026 (5.375 minutos grabables
 * con el tope de 10 min, los cuatro workspaces juntos) y los ~100 kB/min que
 * rrweb genera sin comprimir:
 *
 *   · 5.375 min × 100 kB = **537 MB por mes en crudo**, todos los clientes de hoy.
 *   · Comprimido: entre 54 MB (10×) y 134 MB (4×). El 4× es el que se usa para
 *     decidir, porque es el que no puede fallar para el lado peligroso.
 *   · Con 30 días de retención el régimen es un mes: **134 MB en total**. Los 100 GB
 *     de Storage que ya trae el plan Pro son **760 veces** eso.
 *   · A 100 clientes (25× el tráfico de hoy): 3,4 GB en régimen. Sigue adentro.
 *
 * O sea que la respuesta a «cómo resolvemos el almacenamiento» es que el
 * almacenamiento no es el problema: con 30 días de retención, 100 clientes entran
 * en lo que ya está pagado. Lo que SÍ no tiene techo es dejarlo sin retención: 100
 * clientes × 12 meses son ~40 GB comprimidos y creciendo, y en el tercer año eso
 * cruza los 100 GB y empieza a facturar. El tope existe por el techo, no por la
 * factura de este mes.
 *
 * ⚠️ El ratio de compresión de los eventos de rrweb **NO está medido** acá: el
 * 4×–10× es una estimación. Lo que está medido es el crudo (~100 kB/min, dato de
 * rrweb) y los minutos (arriba, de nuestra base). Con medir el ratio una vez en
 * producción se cierra.
 */
export const REPLAY_RETENCION_DIAS = 30;

/**
 * 180 días si ese visitante se volvió un lead.
 *
 * ⚠️ Esto es lo que arregla el agujero de Clarity que ya nos mordió. Sus 30 días
 * son los que hicieron falta para que exista el aviso `clarity-grabacion-por-vencer`
 * y su cron: el lead que entró hace tres semanas y recién ahora se está por cerrar
 * es justo el que uno quiere mirar, y esa grabación ya no existe.
 *
 * Y es barato porque son pocos: en septiembre de 2026, **41 de 5.919** visitantes
 * terminaron con un lead que lleva `visitor_id` (0,7 %). Seis veces la retención
 * sobre el 0,7 % del volumen es ~4 % más de disco.
 *
 * ⚠️ NO se decide al grabar, se decide al BORRAR. Cuando la sesión se graba
 * todavía no se sabe si esa persona va a dejar sus datos —el `visitor_id` se cose
 * al lead después, por Calendly o por el Camino 1 del beacon—, así que guardar un
 * vencimiento en la fila sería congelar una respuesta que todavía no existe. El
 * cron de purga pregunta en el momento.
 */
export const REPLAY_RETENCION_LEAD_DIAS = 180;

/** Tope duro de lo que un workspace puede pedirse a sí mismo. */
export const REPLAY_RETENCION_MAX_DIAS = 365;

/**
 * ¿Esta sesión ya se puede borrar? Pura: la fecha la trae quien llama.
 *
 * `tieneLead` es «el visitor_id de esta sesión aparece en algún lead», y lo
 * contesta el cron contra la base, no esta función.
 */
export function grabacionVencio(
  inicioISO: string,
  ahoraISO: string,
  tieneLead: boolean,
  retencionDias: number = REPLAY_RETENCION_DIAS,
): boolean {
  const inicio = Date.parse(inicioISO);
  const ahora = Date.parse(ahoraISO);
  if (!Number.isFinite(inicio) || !Number.isFinite(ahora)) return false; // una fecha ilegible NO se borra
  const dias = tieneLead
    ? Math.max(retencionDias, REPLAY_RETENCION_LEAD_DIAS)
    : retencionDias;
  return ahora - inicio > dias * 86_400_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DÓNDE SE GUARDA
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Bucket privado. La sesión sellada es UN objeto; en la base queda una fila de
 * índice de ~200 bytes y nada más.
 *
 * ⚠️ POR QUÉ STORAGE Y NO UNA TABLA, con los números del plan que ya pagamos: el
 * Pro trae **8 GB de base** y **100 GB de Storage**. Son 12 veces más lugar, y el
 * GB de base es el caro de los dos. 537 MB por mes de cuerpos en una tabla se
 * comerían el 7 % de los 8 GB CADA MES, en la misma base donde viven los leads.
 *
 * Y hay una segunda razón que no es plata: rrweb recomienda comprimir la sesión
 * ENTERA del lado del servidor, no evento por evento. Una sesión entera es un blob
 * que se escribe una vez y se lee de punta a punta — que es exactamente un archivo,
 * y exactamente lo que una tabla hace peor.
 */
export const REPLAY_BUCKET = 'replays';

/**
 * La ruta del objeto: `<ws>/<YYYY-MM-DD>/<sesion>.jsonl.gz`.
 *
 * ⚠️ El workspace va PRIMERO y el id de sesión se valida antes de armar la ruta.
 * Es lo único que impide que un id con `../` adentro escriba en la carpeta de otro
 * cliente: acá no hay RLS que ataje, porque el que escribe es el service role.
 *
 * ⚠️ Y la FECHA está en la ruta para que la purga pueda borrar un día entero por
 * prefijo sin leer el índice. Sin eso, un objeto cuya fila de índice se perdió no
 * aparece en ninguna consulta y queda pagándose para siempre: un bucket que no se
 * puede enumerar contra su índice es una factura sin nombre.
 */
export function rutaDeSesion(ws: number, sesionId: string, inicioISO: string): string | null {
  if (!Number.isSafeInteger(ws) || ws <= 0) return null;
  if (!sesionIdValido(sesionId)) return null;
  const t = Date.parse(inicioISO);
  if (!Number.isFinite(t)) return null;
  const dia = new Date(t).toISOString().slice(0, 10);
  return `${ws}/${dia}/${sesionId}.jsonl.gz`;
}

/**
 * Un id de sesión legítimo.
 *
 * `rs_` + 16 a 32 caracteres de alfabeto de URL. El grabador lo acuña y lo guarda
 * en `sessionStorage`, NO en una cookie: una cookie haría que «la sesión» durase un
 * año, y una sesión es una visita. `sessionStorage` sobrevive a navegar dentro de
 * la pestaña —que es lo que hace un botón que lleva a otra página, y entonces la
 * grabación sigue siendo la misma— y muere al cerrarla. Es la misma decisión que
 * `mko_test` ya toma en el snippet.
 */
export const sesionIdValido = (id: unknown): id is string =>
  typeof id === 'string' && /^rs_[A-Za-z0-9_-]{16,32}$/.test(id);

// ─────────────────────────────────────────────────────────────────────────────
// 7. EL APAGADOR — por workspace, sin tocar código
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Vive en `app_settings`, igual que `landing.config` y `landing_token`.
 *
 * ⚠️ Y ES POR WORKSPACE, NO POR PÁGINA, que es donde se separa de `landing.config`
 * a propósito. El id de proyecto de Clarity cuelga de la página porque un proyecto
 * de Clarity es de un sitio. «¿Grabamos a las personas?» no es una pregunta de una
 * página: es del negocio. Un interruptor por página es un interruptor con agujero
 * — alguien agrega una landing el mes que viene y queda grabando sin que nadie lo
 * haya decidido.
 */
export const REPLAY_CONFIG_KEY = 'landing.replay';

/**
 * ⚠️ YA NO HAY APAGADOR: la grabación está SIEMPRE prendida (decisión de Martín,
 * 06/10/2026, textual: «elimina lo de "Grabar las visitas" eso por default debe estar
 * siempre activado»).
 *
 * Hasta ese día esto era `activo: boolean`, apagado por default, con un interruptor en
 * el modal del Pixel. El campo se SACÓ del tipo, y no se dejó en `true`: un campo que
 * vale siempre lo mismo es un interruptor que miente, y el compilador fue el que listó
 * los once lugares que lo miraban (la ficha decía «la grabación está apagada», la
 * ingesta descartaba con motivo «apagado», el chequeo del Pixel pintaba un renglón de
 * apagado). Ninguno puede volver a pasar, así que ninguno queda.
 *
 * Lo que una fila guardada traiga en `activo` se IGNORA al leerla: los cuatro negocios
 * que lo tenían en true siguen igual, y los que no tenían fila pasan a grabar.
 *
 * Lo que sí sigue siendo perilla, sin pantalla: el muestreo (para bajarlo sin desplegar
 * si un cliente recibe una avalancha) y la retención.
 */
export type ReplayConfig = {
  /** 0 a 100. Qué porcentaje de los visitantes se graba. */
  muestreo: number;
  retencionDias: number;
};

export const REPLAY_CONFIG_DEFAULT: ReplayConfig = {
  muestreo: 100,
  retencionDias: REPLAY_RETENCION_DIAS,
};

const enRango = (v: unknown, min: number, max: number, porDefecto: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

/**
 * Lee el muestreo y la retención. Mismo molde tolerante que `parsearConfig`
 * (lib/landing-config.ts): lo que no se entiende cae al default y nadie pierde su
 * configuración. Un `activo` guardado de antes del 06/10/2026 se ignora.
 */
export function parsearReplay(crudo: string | null): ReplayConfig {
  if (!crudo?.trim()) return { ...REPLAY_CONFIG_DEFAULT };
  let x: unknown;
  try { x = JSON.parse(crudo); } catch { return { ...REPLAY_CONFIG_DEFAULT }; }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { ...REPLAY_CONFIG_DEFAULT };
  const o = x as Record<string, unknown>;
  return {
    muestreo: enRango(o.muestreo, 0, 100, REPLAY_CONFIG_DEFAULT.muestreo),
    retencionDias: enRango(o.retencionDias, 1, REPLAY_RETENCION_MAX_DIAS, REPLAY_RETENCION_DIAS),
  };
}

/**
 * Huella estable de un texto (FNV-1a de 32 bits).
 *
 * Sin `node:crypto` a propósito: esto también corre en el navegador del visitante,
 * y `crypto.subtle` es asíncrono. No es seguridad, es reparto.
 */
export function huellaDeVisitante(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * ¿Se graba a este visitante?
 *
 * ⚠️ EL MUESTREO ES DETERMINISTA SOBRE EL `visitor_id`, NUNCA `Math.random()`. Con
 * azar por página, la misma persona entra al 30 % en la landing y queda afuera en
 * la página de gracias: se guarda media sesión, que es peor que ninguna — muestra a
 * alguien que se va y esconde que volvió. Con la huella del visitor_id, quien está
 * adentro está adentro en todas sus páginas y en todas sus visitas.
 *
 * Hoy no hace falta muestrear: con 8.893 visitas en el mes pico el costo son
 * centavos, y muestrear regala justo las sesiones que alguien iba a mirar. La
 * perilla existe para poder bajarla sin desplegar el día que un cliente reciba una
 * avalancha de tráfico.
 */
export function grabaA(cfg: ReplayConfig, visitorId: string): boolean {
  if (!visitorId) return false;
  if (cfg.muestreo >= 100) return true;
  if (cfg.muestreo <= 0) return false;
  return huellaDeVisitante(visitorId) % 100 < cfg.muestreo;
}
