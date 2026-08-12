// =============================================================================
// reunion-reparto — CLASIFICAR y PODER MANDAR son dos preguntas distintas
// =============================================================================
// 12/8/2026. El dueño: «como la funcionalidad de extraer las tareas falló
// completamente… me está poniendo tareas a mí que deberían ser de Mau, ni siquiera
// existe la tab de Mau».
//
// LA EXTRACCIÓN NO FALLÓ. El modelo acertó y `resolverDueño` acertó: el cache de esa
// misma corrida (`mako.fathom.cache.172397528`, escrito 13 segundos antes del borrador)
// tiene las 26 tareas de Mauricio con `esDeOtro: true` Y con su email real. El dato
// bueno existió y después alguien lo borró — este archivo es de donde se lo sacó:
//
//     duenoEmail: repartible(t.dueñoEmail) ? t.dueñoEmail : undefined,
//     esDeOtro:   t.esDeOtro && repartible(t.dueñoEmail) ? true : undefined,   // ⛔
//
// El comentario que estaba arriba de esas dos líneas decía lo correcto —«el nombre se
// conserva SIEMPRE (es información de la reunión); lo que se corta es el reparto»— y la
// segunda línea cortaba las dos cosas. `esDeOtro` no es el reparto: es la CLASIFICACIÓN.
// Sin ella, `ReunionTareas.tsx` mete las 37 en «Mías» y nunca crea el grupo de Mau: la
// tab no está rota, no se crea. Y el daño sigue río abajo, porque el cruce
// anti-duplicados después corre sobre las 37 creyéndolas propias.
//
// La ironía es que Mauricio SÍ es usuario de la app. El gate preguntaba «¿está en MI
// workspace?» (él es del 1, el borrador se armó en el 9) cuando la pregunta que importa
// para clasificar es «¿de quién es esto?» y la que importa para mandar es «¿sé a dónde
// escribirle?». Tres preguntas, no una.
//
// LA REGLA QUE QUEDA: `esDeOtro` lo escribe SOLO `resolverDueño`. Ningún consumidor río
// abajo lo vuelve a escribir. Cuando un control necesita decir «no le puedo mandar
// esto», eso es un campo APARTE, nunca el borrado de una clasificación.
//
// SIN 'server-only' a propósito: esto vivía inline adentro de una función de 200 líneas
// en `reunion-auto.ts`, que no tiene un solo test — y por eso nadie lo cazó. Es la misma
// lección que ya se había aprendido extrayendo `tarea-dueno.ts`, sin aplicar al eslabón
// siguiente.
// =============================================================================

/** Lo que sale de la extracción, con el dueño ya resuelto por `resolverDueño`. */
export type TareaExtraida = {
  dueño?: string;
  dueñoEmail?: string;
  esDeOtro?: boolean;
};

/** Lo que va al borrador. Las tres respuestas, separadas. */
export type RepartoTarea = {
  /** El nombre de quien asumió la tarea. Es información de la reunión: va SIEMPRE. */
  dueno?: string;
  /** A dónde escribirle. Solo si es un email de alguien con cuenta en la app. */
  duenoEmail?: string;
  /** ¿Es de otra persona? La CLASIFICACIÓN, y no depende de si le podemos escribir. */
  esDeOtro?: boolean;
  /** ¿Se le puede mandar de verdad? Lo que el gate viejo confundía con `esDeOtro`. */
  repartible?: boolean;
};

const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

/**
 * Los emails a los que este workspace SÍ puede repartir: los que tienen cuenta en la
 * app. `listarUsuarios()` es cross-workspace, así que el caller le pasa la lista entera.
 *
 * ⚠️ EL CRITERIO SE ENSANCHÓ A PROPÓSITO, y es la mitad del arreglo. Antes era «está en
 * MI workspace o es admin», y con eso Mauricio —usuario real de la app, con su propio
 * workspace— quedaba afuera y perdía sus 26 tareas. Repartir es mandarle a una persona
 * algo que dijo que iba a hacer; que su tablero viva en otro workspace no cambia que la
 * persona existe y que sabemos su email. El aislamiento no se juega acá: se juega en
 * DÓNDE se escribe la tarea, que sigue pasando por `runWithWorkspace`.
 */
export function emailsConCuenta(usuarios: Array<{ email?: string | null }>): Set<string> {
  return new Set(usuarios.map((u) => norm(u.email)).filter(Boolean));
}

/**
 * Las tres respuestas para una tarea, sin que ninguna pise a la otra.
 *
 * `conCuenta` vacío (la consulta de usuarios falló) degrada a «no le puedo mandar a
 * nadie» — nunca a «todo es mío». Ese default importa: la falla de hoy fue justamente
 * que un problema de reparto se leyó como un problema de propiedad.
 */
export function repartoDeTarea(t: TareaExtraida, conCuenta: Set<string>): RepartoTarea {
  const email = norm(t.dueñoEmail);
  const sePuedeMandar = !!email && conCuenta.has(email);
  return {
    dueno: t.dueño || undefined,
    duenoEmail: sePuedeMandar ? email : undefined,
    // La clasificación se conserva ENTERA, sepamos o no escribirle. Una tarea de Mau
    // sigue siendo de Mau aunque no tengamos su mail: va a su tab, con el nombre, y el
    // dueño la ve y decide. Lo único que falta en ese caso es el botón de mandársela.
    esDeOtro: t.esDeOtro || undefined,
    repartible: t.esDeOtro && sePuedeMandar ? true : undefined,
  };
}

/**
 * Cuántas quedaron TUYAS, para el resumen del aviso.
 *
 * Estaba mal por el mismo motivo: se contaba después de que el gate borrara `esDeOtro`,
 * así que el mensaje decía «sacó 37 compromisos tuyos» sobre una reunión donde 26 eran
 * de otro. El aviso confirmaba el bug en vez de delatarlo.
 */
export const cuantasSonMias = (rs: RepartoTarea[]): number => rs.filter((r) => !r.esDeOtro).length;

/** «11 compromisos tuyos y 26 de otras personas» — el resumen que no miente. */
export function resumenDelReparto(rs: RepartoTarea[]): string {
  const mias = cuantasSonMias(rs);
  const otras = rs.length - mias;
  const uno = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  if (!otras) return uno(mias, 'compromiso tuyo', 'compromisos tuyos');
  if (!mias) return `${uno(otras, 'compromiso', 'compromisos')} de otras personas`;
  return `${uno(mias, 'compromiso tuyo', 'compromisos tuyos')} y ${otras} de otras personas`;
}
