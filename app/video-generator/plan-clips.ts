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

/** El plan con los totales recalculados. Se llama después de tocar los clips. */
function recomponer(item: PlanGuardado, clips: PlanGuardado['plan']['clips']): PlanGuardado {
  return {
    ...item,
    plan: {
      ...item.plan,
      clips,
      duracionTotalSeg: clips.reduce((t, c) => t + c.segundos, 0),
      // El ritmo describe qué toma habla y cuál va en off. Con una toma más o una
      // menos, el patrón viejo describe otro anuncio.
      ritmo: clips.map((c) => (c.habla ? 'H' : 'O')).join(' '),
      deCorrido: clips.map((c) => c.voz).filter(Boolean).join(' '),
    },
  };
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
      prompt: '',
      palabras: 0,
      tope: 0,
      voseo: [],
    },
    ...viejos.filter((c) => c.n > despuesDe).map((c) => ({ ...c, n: c.n + 1 })),
  ];

  return {
    ok: true,
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
    }, clips),
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
    }, clips),
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
    ),
  };
}
