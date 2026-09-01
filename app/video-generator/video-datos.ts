// =============================================================================
// video-datos — historial de planes y estado del contexto de la tab
// =============================================================================
// Mismo molde que app/reels/reels-datos.ts: el historial vive como JSON en
// app_settings (getSetting/setSetting ya scopean por workspace) en vez de una
// migración nueva, que colisiona con la numeración de otras corridas.
//
// Tope de 10 a propósito: app_settings guarda texto y el historial es para
// «recuperar el de ayer», no un archivo eterno. Si hace falta más, eso es una
// tabla con migración, no subir este número.
//
// ⚠️ Escritura read-modify-write sin lock: dos generaciones EXACTAMENTE
// simultáneas pueden perder una entrada del historial (no el plan en pantalla).
// Aceptado: es un historial de conveniencia, no la fuente de verdad de nada.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import type { CausaFlow } from '@/lib/flow-fallo-texto';
import { getPersona, personaEstado } from '@/lib/persona';
import { resolverAcento } from '@/lib/acento-workspace';
import { tzDeWorkspace } from '@/lib/timezone';
import { getWorkspaceActual } from '@/lib/workspace';
import { getSchema, getAnswers } from '@/lib/onboarding';
import type { PlanVideo } from '@/lib/video-planner';
import type { Escena } from '@/lib/escenas-core';

export const KEY_HISTORIAL_VIDEO = 'video-generator.historial';
const MAX_HISTORIAL = 10;

/**
 * Lo que se guarda por ESCENARIO.
 *
 * ⚠️ Vive acá —donde se persiste— y no en la action, que es donde estaba. Había
 * DOS declaraciones del mismo dato: el inline de `PlanGuardado.imagenes` y una
 * `MarcaImagen` en `video-action.ts`, y tres campos existían sólo en la segunda
 * (`opcionesId`, `elegidaId`, `intento`). El cast de `imgs()` tapaba la
 * diferencia, así que agregar un campo compilaba de un lado y del otro no se
 * veía. Es exactamente lo que ya había pasado con `MarcaVideo`, con el porqué
 * escrito al lado suyo — y volvió a pasar en el campo de al lado.
 */
export type MarcaImagen = {
  /** El último trabajo encolado para este escenario. */
  trabajoId?: number;
  /**
   * El trabajo cuyo resultado YA se absorbió.
   *
   * ⚠️ Existe porque `opciones` estaba haciendo DOS trabajos: guardar las
   * variantes y avisar que la generación terminó (`if (m.opciones?.length)
   * return listo`). Con la lista como señal de «listo», encolar una nueva
   * generación OBLIGABA a vaciarla — y vaciarla es borrar la imagen que la
   * persona tenía.
   *
   * Pasó, y lo reportó el dueño: regeneró, la nueva no le gustó, y la anterior
   * ya no estaba. Su regla, escrita: «un render nuevo NUNCA sobrescribe al
   * anterior; van los dos con nombre que los distinga».
   *
   * Separar la señal del dato es lo que permite que la lista sólo CREZCA.
   */
  trabajoListo?: number;
  /** Las variantes que devolvió Flow, en orden de generación. Se acumulan. */
  opciones?: string[];
  /** La que se está mirando. La escribe la persona o la llegada de una nueva. */
  elegida?: string;
  /**
   * El `mediaId` DENTRO DE FLOW de cada variante, en el mismo orden que
   * `opciones`, y el de la elegida.
   *
   * ⚠️ Es lo que permite que el clip se anime DESDE la imagen generada. Sin esto
   * el id se tiraba al pintar la lista, y a la hora de filmar no quedaba con qué
   * referenciarla — así que se usaba la foto cruda, que no tiene la escena
   * adentro. Martín lo vio en la grilla de Flow antes que nosotros.
   *
   * Se guardan los DOS: la lista para poder cambiar de variante sin volver a
   * pedir nada, y el de la elegida para no tener que buscar por índice —los
   * índices se corren cuando alguien regenera y la lista cambia de largo—.
   *
   * ⚠️ Y el id NO VENCE, la URL sí (~6 h). Cuando la dirección de una variante
   * vieja caduque, lo que sigue sirviendo para FILMAR es este id.
   */
  opcionesId?: string[];
  elegidaId?: string;
  /** true = la subió la persona, no la generó Flow. */
  propia?: boolean;
  /**
   * ⚠️ ELEGIR NO ES CONFIRMAR. Al llegar las imágenes se preselecciona la
   * nueva; este campo lo escribe una PERSONA mirando la comparación. Sin él,
   * el gate que protege ~105 créditos se abría solo en cuanto Flow contestaba.
   */
  confirmada?: boolean;
  /** Cuántas veces se pidió. Alimenta la semilla: sin esto, regenerar repetiría. */
  intento?: number;
  error?: string;
  /** De quién fue la culpa: decide qué se muestra y si hay a dónde ir. */
  errorCausa?: CausaFlow;
  /** Lo que dijo Google, tal cual. No se tira: se pliega. */
  errorCrudo?: string;
  /**
   * ⚠️ Cuándo pasó. Un error guardado sin fecha se lee como si acabara de
   * ocurrir — y esta pantalla mostró durante horas el JSON de un bug ya
   * arreglado, presentado como si fuera de ese momento.
   */
  errorAt?: string;
  /**
   * El saldo justo ANTES de generar esta imagen.
   *
   * Existe aunque las imágenes sean gratis — o precisamente por eso. «Son
   * gratis» es hoy una afirmación, no una medición, y este proyecto ya
   * planificó con una tabla de costos de internet que estaba al doble. Con
   * esto, la primera generación lo confirma o lo desmiente sola.
   */
  saldoAntes?: number | null;
};

export type PlanGuardado = {
  id: string;
  /** El tema que pidió el usuario (para el rótulo del historial). */
  pedido: string;
  /**
   * El guion de MaKo del que salió, cuando salió de uno.
   *
   * Es lo que permite contestar «¿este guion ya lo grabé?» sin comparar textos:
   * un id es una clave, un texto parecido es un parecido. Opcional porque las
   * entradas viejas del historial no lo tienen — y un campo ausente se lee como
   * «no sé», que es la verdad.
   */
  guionId?: string;
  plan: PlanVideo;
  at: string;
  /**
   * Lo generado por toma, indexado por su número: el trabajo encolado, la
   * operación de Flow, y la URL del video cuando llega.
   *
   * Vive en el PLAN y no en una tabla porque es el mismo dato de conveniencia
   * que el resto del historial. ⚠️ Y hereda su tope de 10: un anuncio que se
   * recorta se lleva los enlaces a sus clips. Por eso el video hay que BAJARLO a
   * storage propio antes de que venza el TTL de Google (~1 h) — mientras eso no
   * exista, esto es un puntero con fecha de vencimiento, no un archivo.
   */
  /**
   * `true` = alguien ya miró la toma 1 al lado de su foto y dijo que sí.
   *
   * Hace falta persistirlo porque la pregunta «¿esta cara es la tuya?» se hace
   * UNA vez —la semilla de la toma 1 fija la cara que heredan las otras seis— y
   * sin el dato, refrescar con solo la toma 1 filmada volvería a preguntarla
   * para siempre.
   */
  caraVista?: boolean;
  /**
   * `true` = ya vio el ejemplo del formato a pantalla completa.
   *
   * Se persiste por la misma razón que `caraVista`: es una pantalla que se
   * muestra UNA vez, y sin el dato volvería a aparecer en cada carga —delante de
   * alguien que ya sabe cómo se ve su formato— para siempre.
   *
   * Y la pantalla sólo existe mientras no hay escenas: un anuncio a medio filmar
   * no vuelve nunca ahí, tenga el campo lo que tenga.
   */
  ejemploVisto?: boolean;
  /**
   * Qué foto de la persona se eligió para ESTE anuncio.
   *
   * ⚠️ Por plan y no global, a propósito: dos anuncios pueden querer caras o
   * vestuarios distintos, y una preferencia global haría que empezar el segundo
   * cambiara el primero sin avisar. Si está vacío se usa la primera, que es lo que
   * pasaba antes — así ningún anuncio viejo cambia de cara solo.
   */
  fotoId?: string;
  /**
   * Los escenarios del anuncio: dónde se filma cada tramo, y el prompt de su
   * imagen. Los escribe MaKo (`lib/escenas.ts`) y la cantidad la fija el
   * formato, no el modelo.
   *
   * Ausente = todavía no se llegó al paso de imágenes. No es lo mismo que una
   * lista vacía, que sería «se pidieron y no salió ninguna».
   */
  escenas?: Escena[];
  /**
   * El prompt que la persona escribió a mano para una toma, por número.
   *
   * ⚠️ VIVE EN EL PLAN Y NO EN LA MARCA DE LA TOMA, y la diferencia es la que
   * hace que sirva: la marca se archiva y se limpia en cada refilmada
   * (`archivarToma`), así que un prompt guardado ahí se perdería justo al hacer
   * lo único para lo que se escribió — volver a filmar.
   *
   * Es una DECISIÓN sobre la toma, no un dato de un intento.
   */
  promptsPropios?: Record<string, string>;
  /**
   * Lo mismo para la IMAGEN de un escenario, por número de escena.
   *
   * Aparte de `promptsPropios` a propósito: son dos prompts distintos —uno arma
   * la foto, el otro la anima— y meterlos en el mismo mapa haría que la clave
   * `"1"` significara dos cosas según quién la lea. Es la misma razón por la que
   * `imagenes` y `video` ya viven separados.
   */
  promptsImagenPropios?: Record<string, string>;
  /**
   * Lo generado por ESCENARIO, indexado por su número.
   *
   * ⚠️ Va aparte de `video` a propósito. Son dos preguntas distintas —«¿ya tengo
   * la imagen del lugar?» y «¿ya animé la toma 3?»— y meterlas en el mismo mapa
   * hace que la clave `"1"` signifique dos cosas según quién la lea.
   */
  imagenes?: Record<string, MarcaImagen>;
  video?: Record<string, MarcaVideo>;
};

/**
 * Lo que se sabe de UNA toma. El tipo vive acá, que es donde se persiste.
 *
 * ⚠️ ESTABA ESCRITO DOS VECES —acá y en video-action.ts— y ya se pagó: al sumarle
 * `ciego` a la copia de la action, la pantalla dejó de compilar porque el que
 * gobierna lo guardado es éste. Es la regla de la casa: una cosa, un lugar. Si
 * hay que copiar la misma forma en dos archivos, el segundo se queda viejo — y en
 * un tipo, «viejo» significa que el compilador deja de proteger justo el campo
 * nuevo.
 */
export type MarcaVideo = {
  trabajoId?: number;
  operacion?: string;
  url?: string;
  mediaId?: string;
  error?: string;
  errorCausa?: string;
  errorCrudo?: string;
  errorAt?: string;
  /** El saldo justo ANTES de generar esta toma. La otra mitad de medir el costo. */
  saldoAntes?: number | null;
  /**
   * No podemos LEER el estado de esta toma, aunque Google la haya aceptado.
   *
   * Se persiste porque la pantalla decide qué dibujar mirando el plan y no lo que
   * devuelve la action: sin un dato acá, el sondeo seguía y la pantalla seguía
   * diciendo «Filmando la toma 1» con un cronómetro que no termina nunca.
   *
   * ⚠️ Y va en un campo PROPIO, no en `error`: `error` apaga el sondeo y ofrece
   * volver a generar —o sea, pagar otro clip por uno que probablemente ya existe—.
   * Esto no apaga nada, y en cuanto una consulta conteste bien se borra solo.
   */
  ciego?: { desde: string; error: string; crudo?: string };
  /**
   * Los clips que se descartaron para rehacer la toma. NUNCA se pierden.
   *
   * ⚠️ «Rehacer la toma N» era `descartarTomaAction` + `generarTomaAction` en un
   * solo click, y el primero hacía `delete`. O sea: el clip pagado se borraba
   * ANTES de saber si el segundo podía filmar — y el segundo tiene CINCO guards
   * que devuelven sin filmar nada (escenario sin confirmar, puente sin conectar,
   * sesión marcada, sesión de Flow vencida, sin mediaId). Con cualquiera de
   * ellos, ~15 créditos se iban a cambio de nada.
   *
   * El propio docstring de `descartarTomaAction` decía que los dos pasos están
   * separados a propósito «porque borrar un clip pagado no puede ser un efecto
   * lateral de apretar generar», y los tres call-sites de la pantalla los
   * volvían a juntar en uno.
   *
   * Guardar el intento anterior es además lo que hace que rehacer VALGA: sin
   * esto, comparar el clip nuevo con el viejo era imposible y volver atrás
   * también.
   */
  descartadas?: MarcaVideo[];
};

const esEntrada = (e: unknown): e is PlanGuardado => {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.at === 'string' && !!o.plan && typeof o.plan === 'object';
};

/** Historial del workspace (tolerante: basura o shape viejo → vacío). */
/**
 * Una url que YA SABEMOS que no puede funcionar no es una url.
 *
 * ⚠️ SE LIMPIA AL LEER, y ése es el punto entero. Una versión anterior guardó como
 * `url` de la toma el enlace de `labs.google` —que exige la cookie de Google y
 * contesta 401 desde nuestro dominio: dieciséis bytes de HTML, que en un <video>
 * se ven como «un video de 0 segundos»—. Se revirtió el código que lo escribía, y
 * eso no alcanzó: el valor ya estaba en el plan de la persona.
 *
 * Y `url` es justo la guarda que apaga todo lo demás: con ella puesta, la pantalla
 * da la toma por lista, el sondeo no corre, y el camino que baja el clip no se
 * ejecuta nunca. El arreglo quedaba detrás de una puerta que el dato malo mantenía
 * cerrada — la cuarta vez en la misma noche con esa forma.
 *
 * Por eso se limpia en `leerHistorial` y no en una pantalla: acá pasan todos los
 * caminos, así que ninguno se puede olvidar.
 *
 * El criterio es en POSITIVO sobre lo que se sabe roto, no una lista de lo que se
 * acepta: mañana el clip puede vivir en otro storage y una lista blanca lo
 * bloquearía sin decir por qué.
 */
const urlInservible = (u: string): boolean => u.includes('labs.google/fx/api/trpc/');

function limpiarUrlsMuertas(p: PlanGuardado): PlanGuardado {
  const video = p.video;
  if (!video) return p;
  let toco = false;
  const limpio: Record<string, MarcaVideo> = {};
  for (const [k, m] of Object.entries(video)) {
    if (m?.url && urlInservible(m.url)) {
      // Se borra la `url` y se conserva la `operacion`: el clip existe y está
      // pagado, lo único que falta es volver a pedir su enlace.
      const { url: _fuera, ...resto } = m;
      limpio[k] = resto;
      toco = true;
    } else {
      limpio[k] = m;
    }
  }
  return toco ? { ...p, video: limpio } : p;
}

export async function leerHistorial(): Promise<PlanGuardado[]> {
  try {
    const raw = await getSetting(KEY_HISTORIAL_VIDEO);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(esEntrada).slice(0, MAX_HISTORIAL).map(limpiarUrlsMuertas);
  } catch {
    return [];
  }
}

/**
 * Cuántos clips PAGADOS tiene un anuncio. Es lo que decide si se puede tirar.
 *
 * No es «cuántas tomas» ni «está terminado»: es cuántos costaron créditos. Un
 * anuncio a medio filmar con tres clips vale tanto como uno completo a la hora de
 * decidir si desaparece.
 */
function clipsPagados(e: PlanGuardado): number {
  return Object.values(e.video ?? {}).filter((v) => v?.url).length;
}

/** Agrega (o reemplaza por id) y recorta al tope. Devuelve el historial nuevo. */
export async function guardarEnHistorial(item: PlanGuardado): Promise<PlanGuardado[]> {
  const actual = await leerHistorial();
  const todos = [item, ...actual.filter((e) => e.id !== item.id)];

  // ⚠️ EL TOPE SACA PRIMERO LO QUE NO SE PAGÓ, y antes recortaba por fecha a
  // secas.
  //
  // Los .mp4 viven en storage colgados de un `planId` que sólo existía en esta
  // fila: cuando el tope evictaba un anuncio TERMINADO, sus siete clips quedaban
  // en el bucket sin nadie que supiera que existen. Ni una pantalla, ni un error,
  // ni forma de volver — sólo espacio ocupado y ~105 créditos que nadie puede
  // mirar.
  //
  // El orden nuevo: se conservan los que tienen clips pagados (los más recientes
  // primero) y recién después se llena con los que no costaron nada. Un anuncio
  // sin un solo clip filmado no le cuesta nada a nadie perderlo: el guion se
  // vuelve a escribir.
  //
  // ⚠️ El que se acaba de guardar NUNCA se cae, tenga clips o no: recortar el
  // anuncio en el que la persona está trabajando sería el peor momento posible.
  const nuevo = todos.length <= MAX_HISTORIAL
    ? todos
    : [
      todos[0],
      ...todos.slice(1).filter((e) => clipsPagados(e) > 0),
      ...todos.slice(1).filter((e) => clipsPagados(e) === 0),
    ].slice(0, MAX_HISTORIAL);

  if (todos.length > nuevo.length) {
    const tirados = todos.filter((e) => !nuevo.some((x) => x.id === e.id));
    const conClips = tirados.filter((e) => clipsPagados(e) > 0);
    // Se REGISTRA lo que se tira, y sobre todo si tenía clips: un recorte
    // silencioso se lee como «no había nada», que es justo lo que no se puede
    // saber después.
    if (conClips.length) {
      console.warn(
        `[video] el tope de ${MAX_HISTORIAL} tiró ${conClips.length} anuncio(s) CON clips pagados: `
        + conClips.map((e) => `${e.id} (${clipsPagados(e)})`).join(', '),
      );
    }
  }

  await setSetting(KEY_HISTORIAL_VIDEO, JSON.stringify(nuevo));
  return nuevo;
}

// ── Estado del contexto de la tab ────────────────────────────────────────────
// Dos requisitos, y son distintos: sin PERFIL el anuncio se escribe sobre nada;
// sin FOTO cada clip inventa una cara. El segundo es bloqueante de verdad y el
// motor lo corta con error propio — acá se lee para poder avisarlo ANTES, en la
// pantalla, en vez de dejar que el usuario escriba un tema y recién ahí falle.
//
// Estado VIVO, no recordado: se lee el estado de AHORA en cada carga. Si el
// cliente borra sus fotos, el aviso vuelve solo.

export type EstadoContextoVideo = {
  tieneFotos: boolean;
  cantidadFotos: number;
  /**
   * La primera foto de la cara de marca, firmada.
   *
   * Se trae la IMAGEN y no solo el conteo porque el paso de revisión tiene que
   * poder contestar «¿es esta persona?», y un número no lo contesta: «3 fotos»
   * se lee igual con las fotos correctas que con las de otro. Un parecido se
   * juzga mirando.
   */
  fotoUrl: string | null;
  /**
   * TODAS las fotos del onboarding, para poder elegir.
   *
   * ⚠️ Antes bajaba sólo `fotos[0]` y la pantalla mostraba «Tu foto» como si fuera
   * la única. Martín: «debo ser capaz de elegir qué foto de entre todas las que
   * están ya subidas gracias al onboarding». Y tiene razón más allá de la
   * comodidad: la primera foto del array no es una decisión de nadie, es un orden
   * de subida — el producto estaba eligiendo por él sin decirlo.
   */
  fotos: { id: string; url: string }[];
  /**
   * El acento que el server va a usar, ya resuelto.
   *
   * Baja resuelto y no como zona horaria a propósito: si el cliente lo dedujera
   * por su cuenta, la regla viviría en dos lugares y la previa podría mostrar un
   * acento distinto del que se termina usando. Una previa que difiere del
   * resultado es peor que no tener previa.
   */
  acento: { etiqueta: string; seguro: boolean };
  perfilListo: boolean;
  faltanDelPerfil: string[];
};

export async function estadoContextoVideo(): Promise<EstadoContextoVideo> {
  const [persona, perfil] = await Promise.all([
    getPersona().catch(() => null),
    (async () => {
      try {
        const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
        const faltan = schema
          .filter((g) => !g.fields.some((f) => (answers[f.key] ?? '').trim()))
          .map((g) => g.label);
        return { listo: faltan.length < schema.length, faltan };
      } catch {
        // Consulta caída ≠ perfil vacío, pero acá el estado solo pinta un aviso
        // suave (nunca bloquea): degradar a "no listo" es lo conservador.
        return { listo: false, faltan: [] as string[] };
      }
    })(),
  ]);

  const fotos = persona?.fotos.length ?? 0;
  // La URL firmada se pide solo si hay foto, y su fallo no tumba la pantalla: sin
  // imagen el paso muestra el aviso, que es peor que verla pero mucho mejor que
  // un error.
  let fotoUrl: string | null = null;
  let listaFotos: { id: string; url: string }[] = [];
  if (fotos > 0) {
    try {
      const est = await personaEstado();
      listaFotos = est.fotos
        .filter((f) => !!f.url)
        .map((f) => ({ id: f.id, url: f.url as string }));
      fotoUrl = listaFotos[0]?.url ?? null;
    } catch { fotoUrl = null; }
  }

  const ws = await getWorkspaceActual();
  const acento = resolverAcento(null, ws != null ? await tzDeWorkspace(ws).catch(() => null) : null);

  return {
    tieneFotos: fotos > 0,
    cantidadFotos: fotos,
    fotoUrl,
    fotos: listaFotos,
    acento: { etiqueta: acento.etiqueta, seguro: acento.seguro },
    perfilListo: perfil.listo,
    faltanDelPerfil: perfil.faltan,
  };
}
