/**
 * Agregar, quitar y redimensionar clips de un anuncio ya planificado.
 *
 * ── Por qué esto es delicado ────────────────────────────────────────────────
 * TODO en este módulo está indexado por NÚMERO DE TOMA: el mapa `video` (con las
 * urls de los clips PAGADOS), `promptsPropios`, y los rangos `desde`/`hasta` de
 * cada escena. Insertar un clip en el medio corre todos los números de ahí para
 * adelante — y lo que no se remapee queda apuntando a otra toma.
 *
 * El modo de falla no es un error: es que el clip de la toma 4 pase a mostrarse
 * como el de la 5. No hay excepción, no hay log, y lo único que lo delata es
 * mirar el anuncio y notar que dice otra cosa.
 *
 * Por eso vive acá, puro y sin `server-only`: la parte que puede perder trabajo
 * pagado tiene que poder probarse.
 *
 * ── Lo que NO hace, a propósito ─────────────────────────────────────────────
 * No borra un clip filmado. Quitar una toma que ya costó ~15 créditos no puede
 * ser el efecto lateral de reordenar un guion: quien quiera hacerlo, primero lo
 * descarta —que lo archiva— y después quita la toma.
 */

import type { PlanGuardado, MarcaVideo } from './video-datos';
import { DURACIONES_FLOW } from '@/lib/costo-clip';
import { puestaPorId, palabrasQueEntran } from '@/lib/puestas-data';
import { repartirGuion } from '@/lib/guion-reparto';
import { acentoDe } from '@/lib/prompts-video';

export type Edicion =
  | { ok: true; item: PlanGuardado }
  | { ok: false; error: string };

/** Mueve las claves numéricas de un mapa según el corrimiento que se le pida. */
function remapear<T>(
  mapa: Record<string, T> | undefined,
  nuevoN: (n: number) => number | null,
): Record<string, T> | undefined {
  if (!mapa) return undefined;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(mapa)) {
    const n = nuevoN(Number(k));
    // `null` = esa toma dejó de existir. No se conserva bajo su número viejo:
    // una clave huérfana es exactamente cómo un clip termina mostrándose en la
    // toma equivocada.
    if (n != null) out[String(n)] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Estira los bordes para que los escenarios cubran las tomas 1..N sin agujeros.
 *
 * ⚠️ ES UNA INVARIANTE, NO UNA PROLIJIDAD: `generarTomaAction` busca la escena
 * que contiene a la toma y, si no la encuentra, se niega a filmar. Una toma
 * huérfana no da error al crearse — da un clip que no se puede filmar tres
 * pantallas después, sin que nada diga por qué.
 *
 * El caso que lo destapó: insertar un clip al PRINCIPIO. Todo se corría uno, así
 * que la primera escena pasaba a empezar en la toma 2 y la nueva toma 1 no era de
 * nadie. Lo cazó su test antes de que existiera la pantalla.
 *
 * Sólo toca los EXTREMOS: los cortes internos los eligió MaKo mirando el guion y
 * no se mueven.
 */
function cubrirTodo<T extends { desde: number; hasta: number }>(escenas: T[], total: number): T[] {
  if (!escenas.length) return escenas;
  return escenas.map((e, i) => ({
    ...e,
    desde: i === 0 ? 1 : e.desde,
    hasta: i === escenas.length - 1 ? Math.max(e.hasta, total) : e.hasta,
  }));
}

/**
 * Qué hacer con el TEXTO al recomponer. No es un detalle de implementación: las
 * tres operaciones quieren cosas distintas y meterlas en una sola regla hacía
 * que dos de ellas mintieran sobre su propio contrato.
 *
 * · `siDesborda` — sumar tomas. Si alguna no entra, se reparte (que es para lo
 *   que la persona apretó el botón); si todo entra, la toma nueva nace VACÍA,
 *   porque ahí sumar es agregar un beat, no partir uno.
 * · `siempre` — quitar una toma. Su texto tiene que ir a algún lado o se pierde.
 * · `nunca` — cambiar la duración. Su doc dice, textual, «No toca el texto:
 *   acortar un clip con más palabras de las que entran deja el aviso de "no
 *   entra", que es información». Y hasta hoy lo tocaba igual, porque pasaba por
 *   el mismo `recomponer` que los otros dos.
 */
type Reparto = 'siDesborda' | 'siempre' | 'nunca';

/** El plan con los totales recalculados. Se llama después de tocar los clips. */
function recomponer(item: PlanGuardado, clips: PlanGuardado['plan']['clips'], reparto: Reparto): PlanGuardado {
  const conTexto = redistribuir(item, clips, reparto);
  return {
    ...item,
    plan: {
      ...item.plan,
      clips: conTexto,
      duracionTotalSeg: conTexto.reduce((t, c) => t + c.segundos, 0),
      // El ritmo describe qué toma habla y cuál va en off. Con una toma más o una
      // menos, el patrón viejo describe otro anuncio.
      ritmo: conTexto.map((c) => (c.habla ? 'H' : 'O')).join(' '),
      deCorrido: conTexto.map((c) => c.voz).filter(Boolean).join(' '),
    },
  };
}

/**
 * Reparte el guion otra vez sobre la estructura nueva.
 *
 * ⚠️ SIN ESTO, «sumar una toma» EMPEORA EL PROBLEMA QUE VIENE A ARREGLAR.
 *
 * El dueño apretó el aviso de «no entra» esperando que se partiera la toma
 * larga. `agregarClip` insertaba un clip VACÍO y no tocaba el texto: la toma de
 * 63 palabras seguía con 63, y encima aparecía una toma muda al lado — que es un
 * corte a negro con la persona callada, o sea peor que el desborde.
 *
 * El texto se puede repartir de nuevo sin perder nada porque `repartirGuion`
 * garantiza que concatenar las tomas devuelve el guion entero: se junta lo que
 * hay, se vuelve a partir contra los topes nuevos, y no se pierde una palabra.
 *
 * ⚠️ Y NO SE TOCA NI UNA PALABRA DE UNA TOMA FILMADA. Ese clip costó créditos y
 * su video dice EXACTAMENTE el texto que tenía cuando se filmó; moverle una
 * palabra deja un anuncio donde el audio y el guion no coinciden, y eso no lo
 * detecta nadie hasta que alguien lo mira.
 *
 * ⚠️ PERO ABSTENERSE DEL PLAN ENTERO ERA DEMASIADO, y dejaba viva justo la falla
 * que este reparto vino a arreglar. Medido en producción el 01/09/2026: el plan
 * de una clienta tenía las tomas 1..8 filmadas y la 9 con **70 palabras en 8
 * segundos** —densidad 8,75 contra un techo de 3,0—. Apretar «sumar una toma»
 * insertaba el clip vacío, veía una toma filmada, y devolvía el texto intacto:
 * las 70 palabras seguían amontonadas Y ahora había una toma muda al lado. O
 * sea exactamente el «corte a negro con la persona callada» que el párrafo de
 * arriba dice que hay que evitar, entrando por la puerta del guard.
 *
 * Lo que corresponde es un corte más fino: se reparte DENTRO de cada tramo
 * contiguo de tomas SIN filmar. Las filmadas quedan congeladas y además hacen de
 * pared —el texto nunca cruza una—, así que ninguna palabra se mueve de un lado
 * al otro de algo pagado. Con nada filmado es un solo tramo y se comporta igual
 * que siempre.
 */
function redistribuir(
  item: PlanGuardado,
  clips: PlanGuardado['plan']['clips'],
  reparto: Reparto,
): PlanGuardado['plan']['clips'] {
  // El tope de cada toma sale de su duración: es la misma cuenta que hace el
  // planificador, y tenerla acá evita que el editor y el plan discrepen sobre
  // cuántas palabras entran en 8 segundos.
  const puesta = puestaPorId(item.plan.puestaId);
  // Sin la puesta no se puede saber cuántas palabras entran en un segundo, y
  // repartir contra un tope inventado es peor que no repartir: dejaría tomas
  // marcadas «no entra» que sí entran, o al revés.
  if (!puesta) return clips;

  // ⚠️ `item.video` YA VIENE REMAPEADO por quien llama. `agregarClip` corre los
  // números antes de componer, así que preguntar por `c.n` acá es preguntar por
  // la numeración NUEVA — que es la correcta. Preguntar por la vieja marcaría
  // como filmada a la toma de al lado.
  const filmada = (n: number) => !!(item.video ?? {})[String(n)]?.url;
  const salida = clips.map((c) => ({ ...c }));

  let i = 0;
  while (i < clips.length) {
    if (filmada(clips[i].n)) { i++; continue; }
    // El tramo: de acá hasta la próxima filmada (o el final).
    let fin = i;
    while (fin < clips.length && !filmada(clips[fin].n)) fin++;

    const tramo = clips.slice(i, fin);
    const topes = tramo.map((c) => palabrasQueEntran(puesta, c.segundos));
    const guion = tramo.map((c) => c.voz).filter(Boolean).join(' ').trim();

    // ¿Este tramo NECESITA que se lo reparta? Con `siDesborda`, sólo si alguna
    // de sus tomas se pasa de su tope. Repartir un tramo que ya entra le mueve
    // las frases a alguien que no lo pidió.
    const desborda = tramo.some((c, k) => (c.palabras || 0) > topes[k]);
    const tocaRepartir = reparto === 'siempre' || (reparto === 'siDesborda' && desborda);

    if (guion && tocaRepartir) {
      const repartidas = repartirGuion(guion, topes);
      for (let k = 0; k < tramo.length; k++) {
        salida[i + k] = {
          ...salida[i + k],
          voz: repartidas[k]?.voz ?? '',
          palabras: repartidas[k]?.palabras ?? 0,
          tope: topes[k],
        };
      }
    } else {
      // Un tramo sin texto igual necesita su tope al día: depende de la duración,
      // y es lo que decide si la pantalla dice «no entra».
      for (let k = 0; k < tramo.length; k++) salida[i + k] = { ...salida[i + k], tope: topes[k] };
    }
    i = fin;
  }

  return salida;
}

/**
 * En cuántas tomas hay que partir ésta para que el texto entre.
 *
 * Devuelve 1 cuando ya entra. Es la cuenta que convierte «no entra» en una
 * acción: sin ella la persona suma tomas de a una y prueba, que es tres viajes
 * al server para llegar al mismo lugar.
 */
export function tomasQueHacenFalta(palabras: number, segundos: number, puestaId: string): number {
  const puesta = puestaPorId(puestaId);
  if (!puesta) return 1;
  return tomasParaQueEntre(palabras, palabrasQueEntran(puesta, segundos));
}

/**
 * Parte la toma `n` en las que hagan falta para que su texto entre.
 *
 * ⚠️ SIMULA, NO ESTIMA. `ceil(palabras / tope)` da un piso y NO alcanza: el
 * repartidor corta en separadores seguros —nunca por el medio de una frase— así
 * que un tramo puede quedar por encima de su tope aunque el promedio entre.
 * Medido sobre el plan real: 70 palabras sobre topes de 24 daban ceil = 3, y con
 * tres tomas quedaban de 25 y 28. Una de ellas seguía sin poder filmarse, o sea
 * que el arreglo dejaba el problema puesto.
 *
 * Acá se agregan tomas de a una y se mira el resultado DE VERDAD, parando en
 * cuanto entra. Da el número mínimo que funciona, no el que la división promete.
 */
export function partirHastaQueEntre(item: PlanGuardado, n: number): Edicion {
  const clip = item.plan.clips.find((c) => c.n === n);
  if (!clip) return { ok: false, error: 'Esa toma no existe.' };

  const sinFilmar = (it: PlanGuardado, c: PlanGuardado['plan']['clips'][number]) =>
    !(it.video ?? {})[String(c.n)]?.url;
  const desborda = (it: PlanGuardado) =>
    it.plan.clips.some((c) => sinFilmar(it, c) && (c.palabras ?? 0) > (c.tope ?? 0));

  let acc = item;
  // El tope de 8 no es capricho: es lo que separa «partir una toma» de un número
  // mal calculado que crea cuarenta clips vacíos.
  for (let k = 0; k < 8; k++) {
    if (!desborda(acc)) break;
    const paso = agregarClip(acc, n + k, clip.segundos);
    if (!paso.ok) return paso;
    acc = paso.item;
  }
  return { ok: true, item: acc };
}

/**
 * Cuántas tomas va a haber donde hoy hay una, si se aprieta el botón.
 *
 * Corre la MISMA simulación que `partirHastaQueEntre`, para que el número que se
 * lee en el botón sea el que va a pasar. Con dos cuentas distintas —una para
 * mostrar y otra para hacer— el botón promete un número y el server hace otro.
 */
export function enCuantasQueda(item: PlanGuardado, n: number): number {
  const antes = item.plan.clips.length;
  const r = partirHastaQueEntre(item, n);
  return r.ok ? r.item.plan.clips.length - antes + 1 : 1;
}

/**
 * La misma cuenta contra el tope YA CALCULADO que cada clip lleva encima.
 *
 * ⚠️ Existe para que la PANTALLA no tenga que repetir la fórmula. La pantalla
 * tiene `c.palabras` y `c.tope` a mano y podría hacer el `ceil` ahí mismo — y con
 * eso habría dos lugares que contestan «en cuántas tomas hay que partir esto»,
 * que es exactamente cómo el botón termina diciendo un número y el server
 * exigiendo otro.
 */
export function tomasParaQueEntre(palabras: number, tope: number): number {
  if (tope <= 0 || palabras <= 0) return 1;
  return Math.max(1, Math.ceil(palabras / tope));
}

/**
 * Suma un clip vacío DESPUÉS de la toma `despuesDe`. Con 0, va al principio.
 *
 * Nace sin texto a propósito: el editor pide la línea después. Un clip con el
 * texto de otro es peor que uno vacío — el vacío se ve, el copiado se lee como
 * si alguien lo hubiera querido así.
 */
export function agregarClip(item: PlanGuardado, despuesDe: number, segundos: number): Edicion {
  if (!DURACIONES_FLOW.includes(segundos as (typeof DURACIONES_FLOW)[number])) {
    return { ok: false, error: `Flow no genera clips de ${segundos} segundos.` };
  }
  const viejos = item.plan.clips;
  if (despuesDe < 0 || despuesDe > viejos.length) return { ok: false, error: 'Esa posición no existe.' };

  const nuevoNum = despuesDe + 1;
  const corrido = (n: number) => (n >= nuevoNum ? n + 1 : n);
  const vecino = viejos.find((c) => c.n === despuesDe) ?? viejos[0];

  const clips = [
    ...viejos.filter((c) => c.n <= despuesDe),
    {
      n: nuevoNum,
      segundos,
      // Hereda de la toma de al lado: en un formato mixto, un clip suelto que
      // habla en medio de una tanda en off rompe la alternancia sin decirlo.
      habla: vecino?.habla ?? true,
      voz: '',
      queSeVe: '',
      camara: '',
      /**
       * ⚠️ NACE CON EL ACENTO DE SU VECINO, y antes nacía con la cadena vacía.
       *
       * `promptDeClip` rescata el bloque de acento DEL PROMPT VIEJO del clip —lo
       * hace a propósito, para que cambiar el acento hoy no le cambie la voz a un
       * anuncio ya filmado a medias—. Pero un clip que nunca tuvo prompt no tiene
       * de dónde rescatarlo, así que sale al modelo SIN decir en qué variedad de
       * español se habla.
       *
       * Medido el 02/09/2026 sobre el anuncio de una clienta: 11 tomas, las 9
       * originales con `Spoken in Northern Mexican Spanish…` y las DOS nacidas de
       * partir una toma sin nada. Esas dos son exactamente las que Google rechazó,
       * 24 veces entre las dos. No está probado que sea la causa —eso lo contesta
       * refilmarlas, que no cuesta créditos— pero la correlación es 9 de 9 contra 0
       * de 24, y el bloque de acento es OBLIGATORIO por regla del repo.
       *
       * Se hereda SÓLO el acento y no el prompt entero: el resto describe la
       * escena de OTRA línea, y copiarlo sería dirigir esta toma con las
       * instrucciones de la de al lado.
       */
      prompt: acentoDe(vecino?.prompt ?? ''),
      palabras: 0,
      tope: 0,
      voseo: [],
    },
    ...viejos.filter((c) => c.n > despuesDe).map((c) => ({ ...c, n: c.n + 1 })),
  ];

  return {
    ok: true,
    // `siDesborda`: sumar una toma sobre un guion que YA entra agrega un beat y
    // el clip nace vacío; sobre uno que no entra, PARTE la toma larga — que es
    // el botón que la persona apretó cuando leyó «no entra».
    item: recomponer({
      ...item,
      video: remapear<MarcaVideo>(item.video, corrido),
      promptsPropios: remapear<string>(item.promptsPropios, corrido),
      // ⚠️ La escena que CONTIENE la posición se estira; las de más adelante se
      // corren enteras. Sin esto el clip nuevo cae fuera de todo escenario y
      // `generarTomaAction` lo rechaza por no tener imagen confirmada — un clip
      // que no se puede filmar y ninguna pantalla que diga por qué.
      escenas: cubrirTodo(
        (item.escenas ?? []).map((e) => ({
          ...e,
          desde: e.desde > despuesDe ? e.desde + 1 : e.desde,
          hasta: e.hasta >= despuesDe ? e.hasta + 1 : e.hasta,
        })),
        clips.length,
      ),
    }, clips, 'siDesborda'),
  };
}

/**
 * Saca la toma `n`. Se niega si ya está filmada.
 *
 * ⚠️ La negativa es el punto, no una limitación: un clip filmado costó ~15
 * créditos, y quitarlo sería destruirlo sin que nadie lo haya decidido. Quien
 * quiera sacarlo primero lo descarta —eso lo archiva y se puede recuperar— y
 * recién después quita la toma.
 */
export function quitarClip(item: PlanGuardado, n: number): Edicion {
  const viejos = item.plan.clips;
  if (!viejos.some((c) => c.n === n)) return { ok: false, error: 'Esa toma no existe.' };
  if (viejos.length <= 1) return { ok: false, error: 'Un anuncio no puede quedarse sin ninguna toma.' };

  const marca = (item.video ?? {})[String(n)] as MarcaVideo | undefined;
  if (marca?.url) {
    return {
      ok: false,
      error: `La toma ${n} ya está filmada. Descarta el clip primero —queda guardado— y después quítala.`,
    };
  }

  const corrido = (k: number) => (k === n ? null : k > n ? k - 1 : k);
  const clips = viejos
    .filter((c) => c.n !== n)
    .map((c) => ({ ...c, n: c.n > n ? c.n - 1 : c.n }));

  // Las escenas se encogen, y la que se queda sin ninguna toma DESAPARECE — con
  // su imagen. Dejarla sería un escenario que no cubre nada, confirmable, que
  // seguiría pidiendo aprobación en un paso que ya no anima nada.
  const escenas = (item.escenas ?? [])
    .map((e) => ({
      ...e,
      desde: e.desde > n ? e.desde - 1 : e.desde,
      hasta: e.hasta >= n ? e.hasta - 1 : e.hasta,
    }))
    .filter((e) => e.hasta >= e.desde);

  // Al caerse una escena, las que siguen se renumeran — y con ellas la clave de
  // su imagen. Es el mismo remapeo que las tomas, un nivel más arriba.
  const nuevoDeEscena = new Map<number, number>();
  const escenasFinales = escenas.map((e, i) => {
    nuevoDeEscena.set(e.n, i + 1);
    return { ...e, n: i + 1 };
  });

  return {
    ok: true,
    item: recomponer({
      ...item,
      video: remapear<MarcaVideo>(item.video, corrido),
      promptsPropios: remapear<string>(item.promptsPropios, corrido),
      escenas: escenasFinales,
      imagenes: remapear(item.imagenes, (k) => nuevoDeEscena.get(k) ?? null),
      promptsImagenPropios: remapear<string>(
        item.promptsImagenPropios,
        (k) => nuevoDeEscena.get(k) ?? null,
      ),
    }, clips, 'siempre'),
  };
}

/**
 * Cambia cuánto dura una toma, entre las duraciones que Flow sabe generar.
 *
 * No toca el texto: acortar un clip con más palabras de las que entran deja el
 * aviso de «no entra», que es información. Recortarle la frase a alguien porque
 * movió un número sería decidir por él.
 */
export function cambiarDuracion(item: PlanGuardado, n: number, segundos: number): Edicion {
  if (!DURACIONES_FLOW.includes(segundos as (typeof DURACIONES_FLOW)[number])) {
    return { ok: false, error: `Flow no genera clips de ${segundos} segundos.` };
  }
  const clip = item.plan.clips.find((c) => c.n === n);
  if (!clip) return { ok: false, error: 'Esa toma no existe.' };

  const marca = (item.video ?? {})[String(n)] as MarcaVideo | undefined;
  if (marca?.url) {
    return {
      ok: false,
      error: `La toma ${n} ya está filmada en ${clip.segundos} s. Descarta el clip para poder cambiarle la duración.`,
    };
  }

  return {
    ok: true,
    item: recomponer(
      item,
      item.plan.clips.map((c) => (c.n === n ? { ...c, segundos } : c)),
      // `nunca`, y es lo que esta función dice arriba que hace. Pasaba por el
      // mismo `recomponer` que las otras dos, así que con nada filmado le
      // repartía el guion entero al anuncio por haber movido un número.
      'nunca',
    ),
  };
}
