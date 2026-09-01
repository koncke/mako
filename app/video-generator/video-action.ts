'use server';

// =============================================================================
// Generar el video — un clip por vez, con el OK del dueño entre cada uno
// =============================================================================
// La regla la puso el dueño y es económica antes que estética: *«sería ideal que
// cree 1 solo clip, el primero, y que el usuario le dé el OK para continuar
// creando todo el resto. Sino, es un gasto de tokens impresionante si los hizo
// todo mal.»*
//
// Y hay una razón que no es de plata: el primer clip es donde se fija la
// identidad. Aprobar el 1 no es aprobar un clip, es aprobar la cara.
//
// ── Cómo llega el pedido a Flow ─────────────────────────────────────────────
// Nada de esto sale del server: sale del NAVEGADOR del cliente. Acá solo se
// encola (`lib/flow-cola.ts`), la extensión lo toma, y el pedido lo hace la
// propia página de Flow calcado de su tráfico (extension/injected.js). Por eso
// no mandamos `clientContext`: el projectId, el sessionId y el token de
// reCAPTCHA los pone la página, y son suyos.
//
// ── Dos pasos, porque Flow es asíncrono ─────────────────────────────────────
// `generar_clip` no devuelve un video: devuelve el nombre de una OPERACIÓN. El
// video se pide después con `estado_clips`, y una operación que contesta sin
// video NO falló — todavía no terminó.

import { randomUUID } from 'node:crypto';
import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { encolar, estadoPuente } from '@/lib/flow-cola';
import { ENDPOINTS, obj, arr, str, extraerMediaId, parchesEstadoClip, urlDeMedioFlow, parchesSubirImagen, KEY_CARAS_FLOW } from '@/lib/flow-protocolo';
import {
  cuerpoClipReferencias, semillaDeToma, mediaIdDeReferencia, KEY_CARA_FLOW,
} from '@/lib/flow-clip-referencias';
import { parchesImagenEscena, imagenesDeRespuesta, semillaDeEscena } from '@/lib/flow-imagen';
import { promptDeClip } from '@/lib/prompts-video';
import { escribirEscenas, reescribirEscena } from '@/lib/escenas';
import { puestaPorId, contarPalabras, marcasDeVoseo } from '@/lib/puestas-data';
import { generarPlanAction } from './actions';
import { guionesDisponibles } from './guiones-datos';
import { causaFlow, causaDeMotivo, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { getSetting, setSetting } from '@/lib/settings';
import { leerHistorial, guardarEnHistorial, type PlanGuardado, type MarcaVideo, type MarcaImagen } from './video-datos';
import { sanearPlantillas, tieneCaraParcheable, KEY_PLANTILLAS } from '@/lib/flow-plantillas';
import { olvidarTomasFallidas, olvidarImagenesDeLaFoto } from './tomas-invalidar';
import { agregarClip, quitarClip, cambiarDuracion } from './plan-clips';
import { sumarVariantes } from './variantes-imagen';
import { archivarToma, recuperarToma } from './tomas-archivo';
import { personaEstado, addPersonaFoto, getPersona } from '@/lib/persona';
import { guardarSaldo, leerSaldoGuardado, guardarCostoMedido, type SaldoFlow } from './saldo-datos';

async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede generar el video.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };
  return { ok: true, ws };
}

/**
 * Busca un valor en cualquier profundidad de la respuesta.
 *
 * ⚠️ Existe porque la forma de la respuesta de Flow YA nos falló dos veces, y las
 * dos por lo mismo: se escribió el lector suponiendo la estructura en vez de
 * mirando una respuesta real.
 *
 * El pedido de clip devuelve `{ media: [{ video: { operation: { name } } }] }` y
 * el lector buscaba `{ operations: [{ operation: { name } }] }` — que es lo que
 * decía la documentación de un tercero. Resultado: Google generaba el video y
 * MaKo contestaba «Flow aceptó el pedido pero no devolvió una operación», con el
 * clip ya andando y los créditos ya gastados. El peor tipo de error: el que
 * reporta un fallo sobre algo que funcionó.
 *
 * Buscar por NOMBRE DE CAMPO en vez de por ruta sobrevive a que Google mueva las
 * cosas de lugar, que es exactamente lo que hace sin avisar.
 */
function buscarCampo(v: unknown, campos: string[], visto = new Set<unknown>()): string {
  if (!v || typeof v !== 'object' || visto.has(v)) return '';
  visto.add(v);
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = buscarCampo(x, campos, visto);
      if (r) return r;
    }
    return '';
  }
  const o = v as Record<string, unknown>;
  for (const c of campos) {
    const val = o[c];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  for (const x of Object.values(o)) {
    const r = buscarCampo(x, campos, visto);
    if (r) return r;
  }
  return '';
}

/**
 * Encola UNA consulta de estado, y solo si no hay ninguna esperando.
 *
 * ⚠️ Sin este freno la pantalla encolaba una cada 6 segundos mientras el puente
 * consume de a UNA por latido: la cola crecía más rápido de lo que se vaciaba.
 * Medido: 66 consultas pendientes para un solo clip.
 *
 * Y no es solo desprolijo. Cada consulta es tráfico contra Google desde la
 * sesión del cliente, y este proyecto ya midió lo que pasa cuando se le manda
 * ritmo de máquina: «reintentar contra un bloqueo causa el bloqueo».
 */
async function consultarUnaVez(operacion: string, aCiegas = false): Promise<void> {
  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('id, estado, tomado_at')
    .eq('tipo', 'estado_clips')
    .in('estado', ['pendiente', 'tomado'])
    // ⚠️ POR ESTA OPERACIÓN, no por cualquiera. El guard prometía «¿hay alguna
    // esperando por esto?» y contestaba «¿hay alguna esperando por cualquier
    // cosa?». Con una sola toma en vuelo no muerde; con dos, la consulta de la
    // toma 1 bloquea la de la toma 2 y la segunda no se pregunta nunca.
    .filter('pedido->>operacion', 'eq', operacion)
    .limit(50);

  // ⚠️ Y UN TRABAJO COLGADO NO CONTESTA POR NADIE.
  //
  // Si el navegador se cerró en el medio, su trabajo queda `tomado` para siempre
  // — y mientras esté ahí, este guard cree que alguien va a contestar y no encola
  // nada más. Resultado: la pantalla sondea cada seis segundos, no pasa nada, y
  // no hay ningún error porque tampoco hay ningún pedido. Medido el 31/08/2026:
  // el trabajo #215 quedó tomado a las 02:56:30 y congeló la cola.
  //
  // 10 minutos es el mismo `COLGADO_MS` que usa el rescate de `flow_tomar_trabajos`
  // (mig 0147). Se replica el número a propósito y con esta nota: la alternativa
  // era importar de un módulo `server-only` a otro por una constante.
  const COLGADO_MS = 10 * 60_000;
  const vivas = (data ?? []).filter((t) => {
    if (str(t.estado) !== 'tomado') return true;
    const t0 = Date.parse(str(t.tomado_at));
    return !Number.isFinite(t0) || Date.now() - t0 < COLGADO_MS;
  });
  // Si ya hay alguna esperando, esa contesta por esta. No hace falta otra.
  if (vivas.length > 0) return;

  // ⚠️ CUANDO YA SABEMOS QUE LA CONSULTA ESTÁ ROTA, SE PREGUNTA MÁS LENTO.
  //
  // Cada trabajo reintenta cinco veces antes de darse por fallido, así que la
  // pantalla —que sondea cada seis segundos— estaba produciendo una ráfaga
  // permanente de pedidos contra la sesión de Google del cliente por algo que ya
  // se sabe que no va a contestar. Este proyecto ya midió a qué lleva eso:
  // reintentar contra un bloqueo es lo que causa el bloqueo.
  //
  // No se deja de preguntar del todo, a propósito: el arreglo puede llegar por el
  // otro lado —la página de Flow renueva su plantilla— y entonces la toma se
  // destraba sola sin que nadie toque nada.
  if (aCiegas) {
    const { data: ultima } = await db
      .from('flow_trabajos')
      .select('listo_at')
      .eq('tipo', 'estado_clips')
      .eq('estado', 'fallido')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const t = Date.parse(str(ultima?.listo_at));
    if (Number.isFinite(t) && Date.now() - t < 60_000) return;
  }
  await encolar('estado_clips', {
    path: ENDPOINTS.estadoVideo,
    // ⚠️ PARCHE Y NO CUERPO, y acá estaba la causa MEDIDA del HTTP 400
    // «Request contains an invalid argument» que dejó al dueño mirando un
    // cronómetro eterno el 31/08/2026.
    //
    // El espejo funde nuestro cuerpo con el que manda la propia página de Flow
    // (`fundir()` en extension/injected.js) — y `fundir()` REEMPLAZA los arrays
    // enteros, a propósito. Así que mandar `operations: [{operation:{name}}]` no
    // agregaba nuestra operación al pedido de Flow: TIRABA el array de Flow y
    // dejaba el nuestro, con todo lo que cada entrada lleva al lado del `name` y
    // que nosotros no sabemos que existe. Google contestó lo único que podía.
    //
    // El parche por camino escribe SOLO esa hoja y no toca a sus hermanas. Es
    // exactamente el mecanismo que se construyó para el pedido de imágenes por
    // esta misma razón, y que acá no se había aplicado: una regla puesta en un
    // lugar de dos no está implementada, está documentada.
    parches: parchesEstadoClip(operacion),
    operacion,
  });
}

/**
 * Dónde quedan los clips ya bajados.
 *
 * ⚠️ PÚBLICO, como `avatars`, y con la ruta bajo el id del plan — un UUID que no
 * se adivina. Son anuncios que el cliente va a publicar igual; el costo de que
 * sea privado son URLs firmadas que vencen, y ya vimos esta noche lo que cuesta
 * un puntero con fecha de vencimiento.
 *
 * Límite de 100 MB y sólo tipos de video: un bucket sin tope es un bucket que un
 * día alguien llena.
 *
 * ⚠️ Si se agrega un bucket, va TAMBIÉN a `BUCKETS` de `lib/reset-workspace.ts`,
 * o el reset de un workspace deja los archivos huérfanos. Ya pasó con `ig-media`.
 */
const BUCKET_CLIPS = 'video-clips';

/**
 * Pide al navegador del cliente el enlace FIRMADO de un clip, y lo espera.
 *
 * No espera adentro: encola el trabajo si no hay ninguno, y en la vuelta
 * siguiente lo lee. La pantalla sondea cada seis segundos, así que «la vuelta
 * siguiente» es enseguida.
 *
 * ⚠️ POR QUÉ HACE FALTA UN TRABAJO PARA ESTO. El enlace no vive en ninguna
 * respuesta de Flow: `getMediaUrlRedirect?name=<id>` REDIRIGE al archivo, y ese
 * redirect no se puede leer con `fetch` ni desde la página ni desde el service
 * worker de la extensión. Lo único que lo ve es `webRequest`, que mira el tráfico
 * desde afuera del modelo de CORS. Así que hay que PROVOCAR el pedido en el
 * navegador del cliente y mirar a dónde fue.
 */
/**
 * Una firma de Google dura ~6 h. Se descarta con margen.
 *
 * El margen no es cautela de más: entre que se lee el enlace y que `guardarClip`
 * termina de bajar el .mp4 pasan segundos, y un enlace que vence en el medio deja
 * el clip a medio bajar — que es indistinguible de un 403.
 *
 * Sin fecha se lo trata como VIGENTE: los trabajos viejos no tienen `listo_at`
 * poblado, y descartarlos todos pediría un enlace nuevo por cada clip ya bajado.
 * Si estuviera vencido, el 403 lo descubre en la vuelta siguiente.
 */
function enlaceVencido(listoAt: string, margenH = 5): boolean {
  const t = Date.parse(listoAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > margenH * 3600_000;
}

async function conseguirEnlace(mediaId: string): Promise<string> {
  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('id, estado, resultado, listo_at')
    .eq('tipo', 'enlace_clip')
    .filter('pedido->>mediaId', 'eq', mediaId)
    .order('id', { ascending: false })
    .limit(3);

  for (const t of data ?? []) {
    if (str(t.estado) !== 'listo') continue;
    const url = str(obj(t.resultado).url);
    if (!url) continue;
    // ⚠️ UN ENLACE VIEJO NO SIRVE, Y DEVOLVERLO TAPABA EL PEDIDO DE UNO NUEVO.
    //
    // La firma de Google vence a las ~6 h. Este bucle devolvía el enlace del
    // trabajo `listo` más reciente sin mirar su fecha, y el `return` está ARRIBA
    // del re-encolado de abajo: con un enlace vencido guardado, `guardarClip`
    // recibía 403, devolvía '', y la vuelta siguiente volvía a leer el mismo
    // enlace muerto. Para siempre.
    //
    // El resultado es el peor de este módulo: un clip que EXISTE del lado de
    // Google, pagado, que la app no puede bajar nunca más — con la pantalla
    // trabada «a ciegas» y la única salida ofrecida siendo filmarlo de nuevo, o
    // sea pagarlo dos veces.
    //
    // La causa es al revés de lo que uno buscaría: no falta el id permanente
    // —está guardado— sino que SOBRA un enlace muerto en el camino.
    if (enlaceVencido(str(t.listo_at))) continue;
    return url;
  }
  // Ninguno esperando: se pide. Con uno en vuelo, se espera a ése.
  if (!(data ?? []).some((t) => ['pendiente', 'tomado'].includes(str(t.estado)))) {
    await encolar('enlace_clip', { path: ENDPOINTS.estadoVideo, mediaId });
  }
  return '';
}

/**
 * Baja el clip con su enlace firmado y lo deja en storage propio.
 *
 * ⚠️ SE BAJA, NO SE APUNTA. La url firmada de Google vence —medido: unas 6 h— y
 * además el anuncio terminado son SIETE tomas que hay que pegar del lado del
 * servidor. Un puntero con fecha de vencimiento no sirve para ninguna de las dos
 * cosas, y el dueño lo dijo antes que nosotros: «si ya de por sí vamos a tener que
 * descargar luego los clips para agruparlos, por qué no simplemente los descargas».
 *
 * Devuelve la url propia, o `''` si algo falló — y si falló, se reintenta en la
 * vuelta siguiente sin gastar créditos: el clip ya está pagado del lado de Google.
 */
async function guardarClip(planId: string, n: number, firmada: string, operacion: string): Promise<string> {
  try {
    const r = await fetch(firmada);
    if (!r.ok) return '';
    const bytes = new Uint8Array(await r.arrayBuffer());
    // Un archivo de cero bytes no es un clip: es un error que se ve como un video.
    if (bytes.byteLength < 1000) return '';

    const db = await getTenantDb();
    // ⚠️ LA RUTA LLEVA LA OPERACIÓN, Y ANTES ERA FIJA CON `upsert: true`.
    //
    // O sea que refilmar una toma SOBRESCRIBÍA el .mp4 del clip anterior: se
    // perdía el archivo además de la marca, y con eso el clip pagado dejaba de
    // existir en los dos lugares a la vez. La regla del dueño —«un render nuevo
    // NUNCA sobrescribe al anterior; van los dos con nombre que los distinga»—
    // aplicada a lo único de este módulo que cuesta plata.
    //
    // La operación es el nombre que le puso Google a ESE clip: distingue los
    // intentos sin inventar un contador, y es el mismo id que queda guardado en
    // la marca como `mediaId`.
    const ruta = `video-generator/${planId}/toma-${n}-${operacion}.mp4`;
    const { error } = await db.storage
      .from(BUCKET_CLIPS)
      .upload(ruta, bytes, { contentType: 'video/mp4', upsert: false });
    if (error) {
      console.error('[video] no se pudo guardar el clip:', error.message);
      return '';
    }
    const { data } = db.storage.from(BUCKET_CLIPS).getPublicUrl(ruta);
    return str(data?.publicUrl);
  } catch (e) {
    console.error('[video] falló la bajada del clip:', String(e));
    return '';
  }
}

/** El nombre de la operación que Flow devolvió al aceptar el pedido. */
function nombreDeOperacion(resultado: unknown): string {
  // Primero la ruta REAL, medida sobre una respuesta de verdad; después la que
  // decía la documentación; y al final, la búsqueda por nombre de campo.
  const media = arr(obj(resultado).media)[0];
  const directo = str(obj(obj(obj(media).video).operation).name) || str(obj(media).name);
  if (directo) return directo;
  const op = arr(obj(resultado).operations)[0];
  return str(obj(obj(op).operation).name) || str(obj(op).name) || buscarCampo(resultado, ['name']);
}

export type EstadoToma =
  | { fase: 'sin_empezar' }
  | { fase: 'encolado'; trabajoId: number }
  | { fase: 'generando'; operacion: string }
  | { fase: 'listo'; url: string; mediaId: string }
  /**
   * La toma corre del lado de Google y NO podemos leer cómo va.
   *
   * ⚠️ No es `error`, y la diferencia cuesta plata: `error` significa que la toma
   * no existe y que hay que volver a generarla —o sea pagar otro clip—, mientras
   * que esto significa que el clip probablemente YA está hecho y lo único roto es
   * nuestra forma de preguntar. Meter las dos en el mismo casillero es la trampa
   * que este repo ya tiene escrita: «no puedo hacer X con este dato» no es «este
   * dato es falso».
   */
  | { fase: 'a_ciegas'; operacion: string; error: string }
  | { fase: 'error'; error: string };

/**
 * Lo que se guarda por toma. El tipo lo declara `video-datos.ts`, que es donde
 * se persiste; acá se importa. Tenerlo escrito en los dos lados fue lo que hizo
 * que agregarle un campo compilara en uno y rompiera en el otro.
 */

const marcas = (plan: PlanGuardado): Record<string, MarcaVideo> =>
  (plan.video ?? {}) as Record<string, MarcaVideo>;

async function guardarMarca(item: PlanGuardado, n: number, marca: MarcaVideo): Promise<PlanGuardado> {
  const actualizado: PlanGuardado = {
    ...item,
    video: { ...marcas(item), [String(n)]: { ...(marcas(item)[String(n)] ?? {}), ...marca } },
  };
  await guardarEnHistorial(actualizado);
  return actualizado;
}

/**
 * Manda a generar UNA toma.
 *
 * No encola las siete: encola la que se le pide. Quién decide que siga es el
 * dueño, mirando la anterior.
 */
export async function generarTomaAction(
  planId: string,
  n: number,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const historial = await leerHistorial();
  // `let` y no `const`: reintentar una toma fallada limpia su marca antes de
  // encolar, y eso devuelve un plan nuevo.
  let item = historial.find((e) => e.id === planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const clip = item.plan.clips.find((c) => c.n === n);
  if (!clip) return { ok: false, error: 'Esa toma no existe en el plan.' };

  // ⚠️ FRENO DE PLATA. Si esta toma YA tiene una operación en curso o un video,
  // no se genera de nuevo: se devuelve lo que hay.
  //
  // Sin esto, apretar «generar» sobre una toma que ya se estaba generando
  // encolaba OTRA generación y la cobraba. Pasó: dos clips pagados por el mismo
  // texto, con la única diferencia de que el primero no se supo leer.
  //
  // Reintentar es gratis para el que aprieta el botón y caro para el que paga la
  // cuenta. El guard va acá, en el server, no en que la pantalla deshabilite algo.
  const yaHay = marcas(item)[String(n)] ?? {};
  // Ya está filmada: no se refilma nunca.
  if (yaHay.url) return { ok: true, item };

  // ⚠️ PERO UNA TOMA FALLADA NO ESTÁ «EN CURSO», Y ESTE GUARD LAS CONFUNDÍA.
  //
  // El síntoma que lo delató: Google rechazó la toma 1 por su filtro de personas
  // públicas, la pantalla ofreció «Volver a filmar la toma 1»… y apretarlo no
  // hacía nada. Nada de nada: la marca conservaba la `operacion` del intento
  // rechazado, así que se entraba acá y se devolvía `ok: true` sin filmar.
  //
  // Y `ok: true` es lo que lo volvía invisible: la pantalla se quedaba igual sin
  // un solo error, o sea el modo de falla más caro que este repo tiene escrito —
  // un ÉXITO FALSO no deja log, no deja excepción, y encima envenena lo que
  // viene después. El dueño lo reportó como «le doy y no hace nada», que es
  // literalmente lo único que se podía ver.
  //
  // El guard sigue protegiendo lo que vino a proteger —dos clips pagados por el
  // mismo texto— porque eso sólo puede pasar mientras el primero está EN VUELO.
  // Con un error encima, el intento anterior ya terminó y no hay nada que
  // duplicar.
  const fallada = !!yaHay.error;
  if (!fallada && (yaHay.operacion || yaHay.trabajoId)) {
    return { ok: true, item };
  }
  // ⚠️ ACÁ SE BORRABA EL DIAGNÓSTICO, Y ES EL LUGAR EQUIVOCADO.
  //
  // Debajo hay CINCO guards que devuelven sin filmar nada —escenario sin
  // confirmar, puente sin conectar, sesión marcada, sesión de Flow vencida, sin
  // mediaId—. Limpiando antes, cualquiera de ellos dejaba la toma sin causa, sin
  // crudo y sin fecha: al recargar, una toma que Google había RECHAZADO se veía
  // como una que nunca se intentó.
  //
  // Y con causa `contenido` eso cuesta plata: el texto guardado dice que volver
  // a intentar con el mismo prompt va a dar lo mismo, y sin él la pantalla
  // ofrece filmar como si fuera un primer intento.
  //
  // La limpieza se mudó a la MISMA escritura que guarda el trabajo nuevo (al
  // final): así no existe ningún instante en que la toma esté sin diagnóstico y
  // sin intento nuevo.

  // ⚠️ EL PASO DE IMAGENES ES OBLIGATORIO, y el guard vive ACA.
  //
  // La pantalla ya apaga el boton, pero apagar un boton no protege nada: el que
  // decide es el server. Y lo que se protege no es un capricho de flujo — animar
  // sin haber fijado la imagen del escenario es exactamente lo que produjo el
  // primer clip de punta a punta, con el angulo equivocado y una cara que no era
  // la del dueno. Ese clip se pago.
  //
  // El guard va en POSITIVO: «solo se filma lo que tiene su escenario
  // confirmado». La forma negativa —«bloquear si hay escenas sin confirmar»—
  // dejaria pasar el caso de un plan SIN escenas, que es justamente el estado en
  // el que el paso todavia no se hizo.
  const escena = item.escenas?.find((e) => n >= e.desde && n <= e.hasta);
  // ⚠️ `confirmada`, NO `elegida`. La primera imagen se preselecciona sola al
  // llegar, así que mirar `elegida` era dar por cerrado un paso que nadie hizo.
  const confirmada = escena ? item.imagenes?.[String(escena.n)]?.confirmada : false;
  if (!confirmada) {
    return {
      ok: false,
      error: 'Antes de filmar hay que confirmar el escenario de esta toma. Está arriba, en la cabecera del lugar.',
    };
  }

  // ── Estado VIVO del puente, no recordado ─────────────────────────────────
  // ⚠️ Cada estado dice LO SUYO. Antes todo lo que no fuera `listo` contestaba
  // «tu navegador no está conectado», y eso era falso y contradecía a la pantalla
  // de al lado, que en la misma carga decía «ya está instalada» y «conectada».
  // Un aviso que contradice a otro no confunde solo sobre ese punto: hace
  // desconfiar de todos los demás.
  const puente = await estadoPuente().catch(() => null);
  if (!puente || puente.estado === 'sin_conectar') {
    return {
      ok: false,
      error: 'Tu navegador no está conectado. Sal al catálogo y ábrelo en «Tu navegador», al pie.',
    };
  }
  if (puente.estado === 'marcada') {
    return {
      ok: false,
      error: 'Google marcó esta sesión y dejó de aceptar generaciones. En el catálogo, dentro de «Tu navegador», está qué hacer y el botón para volver a habilitarla.',
    };
  }
  if (puente.estado === 'sin_sesion') {
    return {
      ok: false,
      error: 'Tu sesión de Google Flow venció. Abre Flow, inicia sesión, y vuelve a intentar.',
    };
  }

  // ── La cara ──────────────────────────────────────────────────────────────
  // Sin `mediaId` no se genera: un clip sin la foto de referencia sale con una
  // persona distinta, y descubrirlo cuesta el clip entero. El error dice qué
  // hacer, no que algo falló.
  // Primero lo APRENDIDO, después lo que se ve ahora. Al revés, un F5 en Flow
  // —que vacía las plantillas de la pestaña— dejaría a la tab sin poder generar
  // aunque la cara ya se supiera desde hace días.
  // ⚠️ EL CLIP SE ANIMA DESDE LA IMAGEN GENERADA DE SU ESCENA, no desde la foto.
  //
  // Martín lo vio en la grilla de Flow antes que nosotros: «referenció a la
  // imagen incorrecta… la segunda es la que debió referenciar, que es la que
  // generé con MaKo». Y es exactamente lo correcto: esa imagen ya tiene su cara
  // DENTRO de la escena —el auto, la luz, el encuadre, la ropa—, mientras que el
  // retrato del onboarding es una persona sobre un fondo de estudio. Animar
  // desde el retrato tira todo el trabajo del paso anterior.
  //
  // El respaldo sigue siendo la cara aprendida: si por lo que sea no hay id de la
  // imagen —una escena vieja, generada antes de que se guardara— se filma con lo
  // que había antes en vez de no filmar.
  const escenaDeLaToma = (item.escenas ?? []).find((e) => n >= e.desde && n <= e.hasta);
  const idImagen = escenaDeLaToma ? str(imgs(item)[String(escenaDeLaToma.n)]?.elegidaId) : '';
  const mediaId = idImagen
    || (await getSetting(KEY_CARA_FLOW))?.trim()
    || mediaIdDeReferencia(String(puente.detalle ?? ''));
  if (!mediaId) {
    return {
      ok: false,
      error: 'Todavía no sé cuál es tu foto dentro de Flow. Genera un video a mano en Flow usando tu foto, con la pestaña abierta, y vuelve a intentarlo.',
    };
  }

  // El saldo ANTES de gastar. Es la mitad de la medición del costo real: sin
  // esto el costo por clip se queda para siempre en una estimación heredada de
  // una tabla de internet — y este proyecto ya planificó con una que estaba AL
  // DOBLE.
  const saldoAntes = (await leerSaldoGuardado()).creditos;

  const trabajoId = await encolar('generar_clip', {
    path: ENDPOINTS.clipDesdeReferencias,
    body: cuerpoClipReferencias(
      // ⚠️ EL PROMPT DEL FORMATO GANA sobre el que escribió el modelo. El de
      // Car Talks lo validó Martín contra Flow; el del modelo describía la toma
      // desde cero y en inglés, compitiendo con la imagen de referencia que ya
      // tiene el auto, la luz y la cara resueltos.
      { prompt: promptDeClip(item.plan.puestaId, clip, item.promptsPropios?.[String(n)]), mediaId, seed: semillaDeToma(planId, n) },
      randomUUID(),
    ),
  });
  // ⚠️ «Encolar» es vocabulario NUESTRO. Un cliente no sabe que hay una cola, y
  // un error que nombra la maquinaria en vez del efecto lo deja sin saber si el
  // problema es suyo, si perdió algo, o si tiene que hacer algo. Se dice qué NO
  // pasó y de quién es.
  if (trabajoId == null) {
    return { ok: false, error: `No se pudo mandar la toma ${n} a filmar. Es un problema nuestro, no tuyo: vuelve a intentarlo en un momento.` };
  }

  // Los SEIS campos del intento anterior, en la misma escritura que encola el
  // nuevo. `operacion: ''` es la que más importa: con la vieja puesta, el sondeo
  // seguiría preguntando por ella y volvería a encontrar el mismo rechazo,
  // pisando el resultado del intento nuevo.
  return {
    ok: true,
    item: await guardarMarca(item, n, {
      trabajoId, operacion: '', url: '', saldoAntes,
      error: '', errorCausa: undefined, errorCrudo: undefined, errorAt: undefined, ciego: undefined,
    }),
  };
}

/**
 * Mira cómo va una toma y avanza lo que se pueda, sin bloquear.
 *
 * Se llama desde la pantalla cada pocos segundos. Cada llamada hace UN paso: si
 * el encolado ya volvió, saca el nombre de la operación; si ya hay operación,
 * pregunta por el video. Nunca espera adentro: una action que espera un minuto
 * es una action que muere en el timeout de la plataforma.
 */
export async function estadoTomaAction(
  planId: string,
  n: number,
): Promise<{ ok: true; item: PlanGuardado; estado: EstadoToma } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const historial = await leerHistorial();
  let item = historial.find((e) => e.id === planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const marca = marcas(item)[String(n)] ?? {};
  if (marca.url) return { ok: true, item, estado: { fase: 'listo', url: marca.url, mediaId: marca.mediaId ?? '' } };

  // ⚠️ UN ERROR DE PUENTE SOBRE UNA TOMA QUE SIGUE VIVA SE BORRA.
  //
  // El puente es la extensión del navegador, y se queda muda por cosas que duran
  // segundos: una recarga de la extensión deja huérfanos los scripts de las
  // pestañas abiertas, un F5 en Flow hace lo mismo. Nada de eso le pasa a la toma,
  // que se está generando del lado de Google.
  //
  // Sin esto, la pantalla le mostraba al dueño «La toma 1 no salió» mientras su
  // propio popup decía «✓ Conectado a MaKo · ✓ Sesión de Flow detectada». Un
  // hecho de hace dos minutos presentado como el estado de ahora, que es
  // exactamente lo que la regla de la casa prohíbe: el estado se lee vivo, no se
  // recuerda.
  //
  // Se borra sólo si hay `operacion`: eso es lo que prueba que Google aceptó el
  // pedido. Sin ella no hay nada vivo que rescatar y el error es el estado real.
  if (marca.error && marca.errorCausa === 'puente' && marca.operacion) {
    const puente = await estadoPuente().catch(() => null);
    if (puente?.estado === 'listo') {
      item = await guardarMarca(item, n, {
        error: undefined, errorCausa: undefined, errorCrudo: undefined, errorAt: undefined,
      });
      return { ok: true, item, estado: { fase: 'generando', operacion: String(marca.operacion) } };
    }
  }

  if (marca.error) return { ok: true, item, estado: { fase: 'error', error: marca.error } };
  if (!marca.trabajoId && !marca.operacion) return { ok: true, item, estado: { fase: 'sin_empezar' } };

  const db = await getTenantDb();

  // ── Paso 1: ¿el encolado ya volvió con el nombre de la operación? ────────
  if (!marca.operacion && marca.trabajoId) {
    const { data } = await db
      .from('flow_trabajos')
      .select('estado, resultado, error, motivo')
      .eq('id', marca.trabajoId)
      .maybeSingle();

    const estado = str(data?.estado);
    // ⚠️ `fallido`, que es lo que escribe la cola (lib/flow-cola.ts). Con `error`
    // —el nombre que uno supone— un trabajo caído se leía como «todavía no
    // terminó» y la pantalla giraba para siempre. El dueño lo vio antes que
    // nosotros: «se quedó pensando eternamente».
    if (estado === 'fallido') {
      const fallo = falloGuardable(str(data?.error), `la toma ${n}`, str(data?.motivo));
      item = await guardarMarca(item, n, fallo);
      return { ok: true, item, estado: { fase: 'error', error: fallo.error } };
    }
    if (estado !== 'listo') {
      return { ok: true, item, estado: { fase: 'encolado', trabajoId: marca.trabajoId } };
    }

    const nombre = nombreDeOperacion(data?.resultado);
    if (!nombre) {
      const e = 'Flow aceptó el pedido pero no devolvió una operación.';
      item = await guardarMarca(item, n, { error: e });
      return { ok: true, item, estado: { fase: 'error', error: e } };
    }
    item = await guardarMarca(item, n, { operacion: nombre });
    await consultarUnaVez(nombre);
    return { ok: true, item, estado: { fase: 'generando', operacion: nombre } };
  }

  // ── Paso 2: ¿ya hay video? ───────────────────────────────────────────────
  const operacion = String(marca.operacion);
  // ⚠️ SIN `.eq('estado','listo')`, y ese filtro era el bug.
  //
  // Preguntando sólo por las consultas que salieron BIEN, una consulta que falla
  // es indistinguible de una que todavía no llegó — y las cuatro que había el
  // 31/08/2026 habían fallado las cuatro, con cinco intentos cada una. La
  // pantalla decía «Filmando la toma 1» y el cronómetro pasaba los cinco minutos
  // sin que nada, en ningún lado, dijera que Google venía contestando 400.
  //
  // Es la misma lección que ya está aplicada veinte líneas más arriba, en el
  // Paso 1, con su comentario y todo: «un trabajo caído se leía como todavía no
  // terminó y la pantalla giraba para siempre». Estaba puesta en un lugar de dos.
  // ⚠️ EL FILTRO POR OPERACIÓN VA EN SQL, Y ESTO ERA UN CUELGUE SIN SALIDA.
  //
  // Traía las últimas 12 filas de `estado_clips` de CUALQUIER operación y recién
  // después filtraba en JS por la suya. O sea: una ventana GLOBAL para una
  // pregunta que es de UNA toma. Con doce tomas en vuelo —lo que produce «filmar
  // todas», y el formato admite doce— las doce filas más nuevas pueden ser todas
  // de las otras once, y la fila `listo` que YA trae la url de ésta se cae de la
  // ventana. Entonces el bucle no encuentra nada, la función llega al final,
  // `consultarUnaVez` encola otra consulta, y eso no converge nunca: cuantas más
  // tomas hay, menos chance tiene cada una de verse.
  //
  // No es teórico y hoy es más fácil que ayer: subir el lote a 5 hace que la cola
  // drene más rápido (más filas nuevas por minuto) y el sondeo pasó a preguntar
  // por TODAS las tomas en vuelo en vez de una. Los dos cambios son correctos y
  // los dos empujan hacia este techo.
  //
  // ⚠️ Y `.limit(12)` NO se baja. Con una sola operación en vuelo la profundidad
  // efectiva de hoy ya es de hasta 12 filas suyas; recortarla sería una regresión
  // justo en el camino `a_ciegas`, donde la fila que importa es la `listo` con
  // `SUCCESSFUL` —la única que dispara `conseguirEnlace` en cada vuelta— y cada
  // fila `fallido` la empuja hacia abajo. Con la ventana chica, tres fallas la
  // entierran y dejaríamos de pedirle el enlace a un clip que EXISTE y está
  // pagado.
  //
  // ⚠️ Y sólo `listo`/`fallido`: son los únicos estados que leen los tres
  // consumidores de `mias`. Las filas `pendiente`/`tomado` no se miran nunca y
  // sacarlas en SQL es lo que evita que las consultas EN VUELO se coman los slots
  // de la ventana — que es la otra mitad de la causa.
  //
  // ⚠️ SIN ÍNDICE, y queda dicho: `pedido->>operacion` no está indexado (la 0145
  // sólo crea `(workspace_id, estado, created_at)` y el parcial de colgados).
  // Como el `limit` se aplica DESPUÉS del predicado, para una operación cuyas
  // filas ya quedaron viejas el plan recorre `id` hacia atrás. Hoy no se nota y
  // `consultarUnaVez` ya hace este mismo filtro desde el 31/08; crece con la
  // tabla, que nadie purga. Antes de que moleste va un índice de expresión, no un
  // `limit` más chico: el `limit` chico rompe lo de arriba.
  const { data: consultas } = await db
    .from('flow_trabajos')
    .select('id, estado, resultado, error, motivo')
    .eq('tipo', 'estado_clips')
    .filter('pedido->>operacion', 'eq', operacion)
    .in('estado', ['listo', 'fallido'])
    .order('id', { ascending: false })
    .limit(12);

  const mias = consultas ?? [];

  for (const c of mias.filter((c) => str(c.estado) === 'listo')) {
    // Se mira la consulta ENTERA y no una ruta: la respuesta del estado tiene la
    // misma costumbre de mover los campos de lugar. Se comprueba que la operación
    // sea la nuestra buscando su nombre en cualquier parte del objeto, y recién
    // ahí se saca la URL.
    const texto = JSON.stringify(c.resultado ?? '');
    if (!texto.includes(operacion)) continue;

    // ── ⚠️ GOOGLE PUEDE HABERLO RECHAZADO, Y ESO NO ES «TODAVÍA NO» ────────
    //
    // Medido el 31/08/2026 sobre una toma que estuvo SEIS MINUTOS «filmando»:
    //
    //   mediaMetadata.mediaStatus = {
    //     mediaGenerationStatus: 'MEDIA_GENERATION_STATUS_FAILED',
    //     failureReasons: ['PROMINENT_PERSON'],
    //     error: { code: 3, message: 'PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED' },
    //   }
    //
    // Google decidió que la cara se parece a la de una persona pública y se negó
    // a animarla. Ese video NO va a llegar nunca. Y este bucle sólo buscaba
    // `SUCCESSFUL`: cualquier otra cosa caía al `continue` de abajo, así que la
    // pantalla esperaba para siempre un resultado que ya tenía respuesta.
    //
    // Es exactamente la regla que este repo ya tiene escrita —«no pasó nada» y
    // «pasó y se murió» se ven iguales si mirás sólo el resultado— y la razón por
    // la que un rechazo TIENE que dejar rastro: sin esto, «Google lo rechazó» y
    // «Google está tardando» son la misma pantalla.
    if (/MEDIA_GENERATION_STATUS_FAILED/.test(texto)) {
      const porFamoso = /PROMINENT_PERSON|PROMINENT_PEOPLE/i.test(texto);
      const causa: CausaFlow = porFamoso ? 'persona_publica' : 'contenido';
      const t = textoFlow(porFamoso ? 'persona_publica' : 'contenido', `la toma ${n}`);
      item = await guardarMarca(item, n, {
        error: t.detalle,
        errorCausa: causa,
        // El crudo se guarda para poder diagnosticar sin pedir otra captura: el
        // motivo real de Google vive ahí y no en nuestra traducción.
        errorCrudo: crudoGuardable(texto),
        errorAt: new Date().toISOString(),
        ciego: undefined,
      });
      return { ok: true, item, estado: { fase: 'error', error: t.detalle } };
    }
    // Los nombres salen del ESQUEMA del bundle de Flow, no de suponer: la respuesta
    // de estado declara `outputUri` y `encodedVideo`, y el medio terminado trae
    // `fifeUrl`. Se buscan todos, en cualquier profundidad.
    const url = buscarCampo(c.resultado, ['fifeUrl', 'outputUri', 'videoUri', 'servingUrl', 'encodedVideo', 'url']);
    if (!url) {
      // ⚠️ LA CONSULTA CONTESTÓ Y EL CLIP ESTÁ HECHO: eso NO es «todavía no».
      //
      // Medido el 31/08/2026 sobre una respuesta real: la consulta de estado trae
      // `mediaGenerationStatus: MEDIA_GENERATION_STATUS_SUCCESSFUL` y
      // `mediaBlobSize: 2586206` — y NINGUNA url. Ni `fifeUrl`, ni `outputUri`,
      // ni nada. El enlace vive en otro lado y todavía no sabemos dónde.
      //
      // Antes esto caía en el `continue` y la pantalla seguía esperando para
      // siempre sobre un video que ya existía. Son dos situaciones distintas y hay
      // que decirlas distinto: esperar no sirve, y volver a filmar tira un clip
      // pagado.
      if (/MEDIA_GENERATION_STATUS_SUCCESSFUL/.test(texto)) {
        // ── EL CLIP ESTÁ HECHO: SE PIDE SU ENLACE Y SE BAJA ────────────────
        //
        // Todo lo de abajo es el porqué de que esto NO sea `marca.url = <url de
        // Flow>`. Se probó y no puede funcionar.
        const enlace = await conseguirEnlace(operacion);
        if (enlace) {
          const guardada = await guardarClip(planId, n, enlace, operacion);
          if (guardada) {
            item = await guardarMarca(item, n, {
              url: guardada, mediaId: operacion, ciego: undefined,
            });
            if (typeof marca.saldoAntes === 'number') {
              await encolar('creditos', { path: ENDPOINTS.creditos, body: {} });
            }
            return { ok: true, item, estado: { fase: 'listo', url: guardada, mediaId: operacion } };
          }
        }

        // ⚠️⚠️ ACÁ SE PINTABA LA URL DE FLOW EN UN <video>, Y NO PUEDE FUNCIONAR.
        //
        // Se hizo razonando que el navegador de la persona la resolvería con su
        // propia sesión de Google. Suena bien y está mal, MEDIDO:
        //
        //     GET .../media.getMediaUrlRedirect?name=<id>   (sin la cookie)
        //     → 401 · text/html · 16 bytes · "No session found"
        //
        // Nuestra página vive en hola-mako.com, así que ese `<video src>` es un
        // pedido de TERCERA PARTE hacia labs.google. La cookie de Google no viaja
        // —SameSite, o el bloqueo de cookies de terceros que Chrome trae puesto— y
        // el elemento recibe dieciséis bytes de HTML.
        //
        // Y un <video> con dieciséis bytes de HTML adentro se comporta EXACTAMENTE
        // como «un video de 0 segundos», que fue el reporte textual del dueño. La
        // explicación que se había escrito —«esa url devuelve el póster»— era una
        // deducción a partir del síntoma; ésta es una medición.
        //
        // La lección: una url ajena que se ve bien en la pestaña donde estás
        // logueado NO se ve desde tu propio dominio. Antes de pintar un recurso de
        // otro sitio, pedilo desde el origen que lo va a pedir de verdad.
        //
        // Por eso el clip hay que BAJARLO desde la página que sí tiene la sesión
        // —la extensión— y servirlo desde storage propio. Que además es lo que hay
        // que hacer igual para pegar las siete tomas y antes de que venza el TTL.
        // Lo planteó el dueño hace rato y era la salida correcta desde el principio.
        const texto2 = textoFlow('sin_enlace', `la toma ${n}`).detalle;
        if (marca.ciego?.error !== texto2) {
          item = await guardarMarca(item, n, {
            ciego: { desde: new Date().toISOString(), error: texto2 },
          });
        }
        return { ok: true, item, estado: { fase: 'a_ciegas', operacion, error: texto2 } };
      }
      continue;
    }
    const mediaId = extraerMediaId(c.resultado) || buscarCampo(c.resultado, ['mediaId', 'mediaGenerationId']) || operacion;
    // La ceguera se borra sola: si esta consulta contestó, ya no estamos ciegos.
    item = await guardarMarca(item, n, { url, mediaId, ciego: undefined });
    // El clip esta listo: se pregunta el saldo, y la resta contra el de antes da
    // el costo REAL de una toma. Es el numero del que depende toda la economia
    // del plan y hasta hoy no lo teniamos medido.
    if (typeof marca.saldoAntes === 'number') {
      await encolar('creditos', { path: ENDPOINTS.creditos, body: {} });
    }
    return { ok: true, item, estado: { fase: 'listo', url, mediaId } };
  }

  // ── ¿Y si lo roto es la PREGUNTA? ────────────────────────────────────────
  //
  // Dos consultas fallidas son diez llamadas a Google rechazadas: eso ya no es un
  // bache. Se dice, y se dice sin convertir la toma en un error — el clip se
  // aceptó y lo más probable es que exista.
  //
  // Dos y no una: cada trabajo ya reintenta cinco veces solo, así que una sola
  // fallida puede ser un mal minuto de la red. Es la comparación asimétrica de
  // siempre: para afirmar que algo se rompió hacen falta dos lecturas, para
  // creerle a un éxito alcanza con una.
  // ⚠️ Y SI ALGUNA CONSULTA CONTESTÓ, YA NO ESTAMOS CIEGOS.
  //
  // `ciego` se escribía una vez y sólo se borraba al encontrar la url, así que
  // con las consultas ya funcionando la pantalla seguía diciendo «MaKo no puede
  // leer cómo va la toma 1» y mostrando, plegado, un HTTP 400 de veinte minutos
  // antes. Un estado que se escribe y no se revisa es un estado que miente en
  // cuanto el mundo cambia — y acá el mundo cambió porque lo arreglamos nosotros.
  if (marca.ciego && mias.some((c) => str(c.estado) === 'listo')) {
    item = await guardarMarca(item, n, { ciego: undefined });
    marca.ciego = undefined;
  }

  const fallidas = mias.filter((c) => str(c.estado) === 'fallido');
  if (fallidas.length >= 2) {
    const crudo = str(fallidas[0]?.error);
    const causa = causaDeMotivo(str(fallidas[0]?.motivo)) ?? causaFlow(crudo);

    // ⚠️ NINGUNA FALLA DE LA CONSULTA MATA LA TOMA. NINGUNA.
    //
    // Acá había una rama que, si la causa era del cliente —sesión, créditos,
    // puente—, escribía un `error` terminal sobre la toma. Estaba mal, y era la
    // misma regla que esta función aplica bien dos líneas más abajo: no poder
    // PREGUNTAR por algo no lo vuelve falso. La toma la aceptó Google y la está
    // haciendo; que nuestra extensión se haya quedado muda medio minuto no le pasa
    // a ella.
    //
    // El daño era doble y el segundo es plata: `error` apaga el sondeo y la
    // pantalla ofrece volver a filmar, o sea pagar un segundo clip por uno que ya
    // existe. Medido: le pasó al dueño con el puente sano, mirando «La toma 1 no
    // salió» al lado de un popup que decía «✓ Conectado».
    //
    // La causa NO se tira: decide QUÉ se lee. Si la sesión de Google venció, el
    // texto lo dice y manda a arreglarlo — pero como un estado a ciegas, que se
    // cura solo, y no como una toma perdida.
    const texto = causa === 'ciego' || causa === 'nuestra' || causa === 'desconocida'
      ? textoFlow('ciego', `la toma ${n}`).detalle
      : textoFlow(causa, `la toma ${n}`).detalle;
    if (!marca.ciego) {
      item = await guardarMarca(item, n, {
        ciego: { desde: new Date().toISOString(), error: texto, crudo: crudo.slice(0, 2000) },
      });
    }
    await consultarUnaVez(operacion, true);
    return { ok: true, item, estado: { fase: 'a_ciegas', operacion, error: texto } };
  }

  // Todavía no. Se vuelve a preguntar — una operación sin video NO falló.
  await consultarUnaVez(operacion);
  return { ok: true, item, estado: { fase: 'generando', operacion } };
}

// ── El saldo ─────────────────────────────────────────────────────────────────

/**
 * Pide el saldo al navegador del cliente y lo guarda.
 *
 * Es de SOLO LECTURA: no acuña captcha, no gasta créditos, y la propia página de
 * Flow cachea la respuesta 2 minutos. Preguntarlo es barato; no saberlo es lo
 * caro — un anuncio que se corta en la toma cinco por falta de créditos no dejó
 * cinco quintos de anuncio, dejó cinco clips pagados y nada que publicar.
 */
export async function pedirSaldoAction(): Promise<{ ok: true; trabajoId: number } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const puente = await estadoPuente().catch(() => null);
  if (!puente || puente.estado === 'sin_conectar') {
    return { ok: false, error: 'Todavía no conectaste tu navegador.' };
  }

  const id = await encolar('creditos', { path: ENDPOINTS.creditos, body: {} });
  if (id == null) return { ok: false, error: 'No se pudo preguntar por el saldo.' };
  return { ok: true, trabajoId: id };
}

/**
 * Cuantas generaciones de clip estan corriendo AHORA en este workspace.
 *
 * Es la pregunta que decide si la resta de saldos se puede atribuir a UN clip.
 * Se cuentan los trabajos de tipo `generar_clip` que todavia no cerraron: si hay
 * mas de uno, el saldo bajo por varios y medir seria inventar un precio.
 *
 * Ante la duda —una consulta que falla— devuelve 2, o sea «no midas». Un precio
 * que no se actualiza es un problema chico; uno inventado se muestra como hecho
 * y se usa para decidir si al cliente le alcanza.
 */
async function generacionesEnVuelo(): Promise<number> {
  try {
    const db = await getTenantDb();
    const { data } = await db
      .from('flow_trabajos')
      .select('id')
      .eq('tipo', 'generar_clip')
      .in('estado', ['pendiente', 'tomado'])
      .limit(5);
    return (data ?? []).length;
  } catch {
    return 2;
  }
}

/**
 * Mira si ya volvió el saldo. Si volvió, lo guarda y lo devuelve.
 *
 * La pantalla la llama unas pocas veces con unos segundos de diferencia. No
 * espera adentro: una action que se queda esperando muere en el timeout.
 */
export async function saldoAction(
  trabajoId: number | null,
): Promise<{ ok: true; saldo: SaldoFlow; listo: boolean } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  if (trabajoId != null) {
    const db = await getTenantDb();
    const { data } = await db.from('flow_trabajos').select('estado, resultado').eq('id', trabajoId).maybeSingle();
    if (str(data?.estado) === 'listo') {
      const r = obj(data?.resultado);
      const creditos = Number(r.credits ?? r.subscriptionCredits);
      if (Number.isFinite(creditos)) {
        // ⚠️ Se mide ANTES de pisar el saldo guardado: la resta necesita los dos
        // numeros, y guardar primero borraria el de antes.
        const previo = (await leerSaldoGuardado()).creditos;
        await guardarSaldo(creditos, str(r.userPaygateTier) || str(r.sku));
        // ⚠️ SOLO SI HAY UNA SOLA GENERACION EN VUELO. La premisa que estaba
        // escrita acá —«una sola toma por vez, asi que la diferencia ES el costo
        // de un clip»— era cierta cuando se escribio y **«filmar todas» la dejo de
        // ser**: con siete tomas lanzadas juntas, el saldo que se lee cuando
        // termina UNA ya tiene descontadas las que terminaron en el medio, y la
        // resta mide el LOTE.
        //
        // Costo medido: `video-generator.costo-clip` quedo en **150** en el
        // workspace del dueño, o sea diez clips presentados como uno, y sin el
        // «(estimado)» que avisa que no es un hecho.
        //
        // El techo de `guardarCostoMedido` acota el daño pero no lo evita: dos
        // clips de 4 s son 14, y 14 es un precio posible. Lo que de verdad lo
        // cierra es no medir cuando la premisa no se cumple — y eso solo se puede
        // preguntar acá, que es donde se sabe cuantas hay en vuelo.
        const enVuelo = await generacionesEnVuelo();
        if (enVuelo <= 1 && typeof previo === 'number' && previo > creditos) {
          await guardarCostoMedido(previo - creditos);
        }
        return { ok: true, saldo: await leerSaldoGuardado(), listo: true };
      }
    }
  }
  // Todavía no volvió: se devuelve lo último que se supo, con su fecha. Un saldo
  // viejo bien fechado sirve; uno sin fecha no se puede juzgar.
  return { ok: true, saldo: await leerSaldoGuardado(), listo: false };
}

// =============================================================================
// EL PASO DE IMÁGENES — primero el escenario, después el video
// =============================================================================
// El orden importa y el generador lo tenía al revés. El primer clip que salió de
// punta a punta salió en un ángulo que nadie pidió y con una cara que no se
// parecía: se estaba animando sobre la nada. El proceso real, el que produjo los
// cuatro anuncios que funcionaron, fija primero la imagen del lugar.
//
// ── Por qué la confirmación es LADO A LADO ─────────────────────────────────
// El dueño: «muchas muchas veces la imagen de IA sale mal porque la IMAGEN que
// se le pasó era mala: no tenía buena iluminación, o ya de por sí era otra
// imagen de IA, lo que hacía que todo se vea muy artificial».
//
// O sea: cuando una imagen no se parece, hay DOS causas posibles y se ven igual.
// Poner la foto original al lado de la generada convierte «esto está mal» en una
// pregunta que la persona puede contestar —¿realmente no se parecen, o la foto
// de entrada estaba mal?—. Sin la comparación, la única salida es regenerar, y
// regenerar contra una foto mala da otra imagen mala.


const imgs = (plan: PlanGuardado): Record<string, MarcaImagen> =>
  (plan.imagenes ?? {}) as Record<string, MarcaImagen>;

async function guardarImagen(item: PlanGuardado, n: number, marca: MarcaImagen): Promise<PlanGuardado> {
  // El choke point: TODA escritura de imagen pasa por acá, así que la regla se
  // escribe una vez. Puesta en cada action —generar, elegir, subir— serían tres
  // copias y la cuarta nacería sin ella.
  //
  // ⚠️ La condición es que `elegida` CAMBIE, no que se apriete Continuar.
  // Confirmar no cambia la entrada: si limpiara el fallo, el botón de avanzar
  // ofrecería filmar de nuevo la misma imagen que Google ya rechazó, a ~15
  // créditos la vuelta. Un bucle gratis es un bug; uno que cobra es peor.
  const base = marca.elegida !== undefined && marca.elegida !== imgs(item)[String(n)]?.elegida
    ? olvidarTomasFallidas(item, n)
    : item;
  const actualizado: PlanGuardado = {
    ...base,
    imagenes: { ...imgs(base), [String(n)]: { ...(imgs(base)[String(n)] ?? {}), ...marca } },
  };
  await guardarEnHistorial(actualizado);
  return actualizado;
}

/**
 * Traduce un fallo de Flow a lo que se guarda.
 *
 * Es el ÚNICO lugar donde el crudo cruza la frontera hacia el cliente. Los tres
 * puntos que lo producen pasan por acá; escribir la traducción en cada uno sería
 * tener tres versiones de la misma regla, y la tercera se queda vieja.
 */
function falloGuardable(crudo: string, que: string, motivo = '') {
  // ⚠️ EL MOTIVO DEL SERVER GANA SOBRE ADIVINAR POR TEXTO.
  //
  // `flow_trabajos.motivo` lo escribió quien vio el error CRUDO de Google. Lo que
  // hay en `.error` es la traducción al castellano que ese mismo código produjo,
  // así que clasificarla de nuevo por expresiones es adivinar sobre una respuesta
  // que ya estaba contestada — y medido, ocho de los nueve mensajes posibles
  // caían en «no sé».
  //
  // `causaFlow` queda de red para un motivo nuevo que este mapa todavía no
  // conozca, que es lo único que no se puede prever.
  const causa = causaDeMotivo(motivo) ?? causaFlow(crudo);
  return {
    error: textoFlow(causa, que, undefined, undefined, crudo).titulo,
    errorCausa: causa,
    errorCrudo: crudo,
    errorAt: new Date().toISOString(),
  };
}

/**
 * El crudo que se guarda para diagnosticar después: las dos puntas, no la primera.
 *
 * ⚠️ ERA `texto.slice(0, 1200)`, Y RECORTABA JUSTO LA EVIDENCIA. En la respuesta
 * de Flow el principio es el prompt —que ya tenemos escrito en el plan— y el
 * MOTIVO vive al final: `mediaStatus`, `failureReasons`, el `PUBLIC_ERROR_…`.
 * Medido el 31/08/2026 sobre el rechazo de la toma 1: los 1200 caracteres
 * guardados terminaban a la mitad del prompt y no contenían una sola palabra de
 * por qué había fallado.
 *
 * La clasificación en sí estaba bien —se hace sobre el texto ENTERO, antes de
 * recortar—, así que el daño no fue un mensaje equivocado: fue que después no
 * hubiera forma de COMPROBARLO. Es la regla de la casa, un escalón más abajo: un
 * mensaje recortado sirve para mostrar un error, no para decidir sobre su causa
 * — y éste no servía ni para mostrarlo.
 */
function crudoGuardable(texto: string, tope = 1600): string {
  if (texto.length <= tope) return texto;
  const cabeza = Math.floor(tope * 0.3);
  const cola = tope - cabeza;
  return `${texto.slice(0, cabeza)}\n…[${texto.length - tope} caracteres omitidos]…\n${texto.slice(-cola)}`;
}

function planDe(historial: PlanGuardado[], planId: string): PlanGuardado | null {
  return historial.find((e) => e.id === planId) ?? null;
}

/**
 * MaKo escribe los escenarios del anuncio. Es el primer paso después del guion.
 *
 * No genera ninguna imagen: escribe DÓNDE se filma cada tramo y con qué prompt.
 * Separar las dos cosas es lo que permite corregir el prompt antes de gastar
 * nada — y aunque las imágenes sean gratis, una imagen equivocada cuesta la
 * vuelta entera de mirarla, descartarla y volver a pedirla.
 */
export async function escribirEscenasAction(
  planId: string,
  ajuste?: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const puesta = puestaPorId(item.plan.puestaId);
  if (!puesta) return { ok: false, error: 'No reconozco el formato de este anuncio.' };

  const salida = await escribirEscenas(item.plan, puesta, ajuste);
  if (!salida.ok) {
    // ⚠️ DOS CAUSAS, DOS FRASES. Antes las dos salían como «revisa tus API keys
    // en /integraciones», y una de ellas es culpa NUESTRA: la IA contestó bien y
    // la red que impide describir caras descartó el lote. Mandar a alguien a
    // revisar unas credenciales que están perfectas es la forma más cara de
    // equivocarse en un mensaje de error — y la contracara de la regla, que ya
    // estaba escrita: cuando NO es del usuario, se dice con todas las letras.
    return {
      ok: false,
      error: salida.motivo === 'filtro'
        ? `MaKo escribió los escenarios pero se los rechacé yo: ${salida.detalle}. No es nada tuyo ni de tus credenciales. Vuelve a intentarlo — sale distinto cada vez.`
        : 'MaKo no pudo escribir los escenarios. Vuelve a intentarlo; si sigue igual, revisa tus API keys en /integraciones.',
    };
  }
  const escenas = salida.escenas;

  // ⚠️ Rehacer los escenarios INVALIDA las imágenes, y por eso se borran acá.
  //
  // Dejarlas sería peor que borrarlas: quedaría la imagen del escenario viejo
  // ilustrando el prompt nuevo, y eso no se lee como un error — se lee como una
  // imagen. La persona aprobaría un escenario mirando otro.
  const actualizado: PlanGuardado = { ...item, escenas, imagenes: {} };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/** Corrige UN escenario con lo que pidió la persona, y descarta su imagen vieja. */
export async function corregirEscenaAction(
  planId: string,
  n: number,
  ajuste: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item?.escenas) return { ok: false, error: 'Este anuncio todavía no tiene escenarios.' };

  const escena = item.escenas.find((e) => e.n === n);
  if (!escena) return { ok: false, error: 'Ese escenario no existe.' };

  const nueva = await reescribirEscena(escena, ajuste);
  if (!nueva) {
    // Igual que arriba: este camino también puede caer por la red de las caras, y
    // ahí «prueba a decirlo de otra forma» es un callejón sin salida — pedir «una
    // silla junto a una superficie de madera» era legítimo y no hay otra forma de
    // decirlo. Ahora la red no da falsos positivos, pero el mensaje no puede
    // volver a acusar a quien escribió bien.
    return {
      ok: false,
      error: 'MaKo no pudo aplicar ese cambio. Vuelve a intentarlo, o descríbelo con otras palabras.',
    };
  }

  const actualizado: PlanGuardado = {
    ...item,
    escenas: item.escenas.map((e) => (e.n === n ? nueva : e)),
    // Solo la de ESTE escenario. Las otras siguen aprobadas y no se tocan.
    imagenes: { ...imgs(item), [String(n)]: {} },
  };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * Manda a generar la imagen de UN escenario.
 *
 * ⚠️ Sin freno de plata, a diferencia de las tomas: las imágenes de Flow no
 * gastan créditos. Lo que sí se guarda es el saldo de antes — «son gratis» es
 * hoy una afirmación y no una medición, y este proyecto ya planificó con una
 * tabla de costos de internet que estaba al doble. Con el saldo previo, la
 * primera generación lo confirma o lo desmiente sola.
 */
export async function generarImagenAction(
  planId: string,
  n: number,
  // ⚠️ El fallo puede traer `item`: hay una salida temprana que ESCRIBE antes de
  // rendirse (borra el fallo del intento anterior). Sin este campo, ese trabajo
  // no tenía cómo llegar a la pantalla.
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string; item?: PlanGuardado }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item?.escenas) return { ok: false, error: 'Este anuncio todavía no tiene escenarios.' };

  const escena = item.escenas.find((e) => e.n === n);
  if (!escena) return { ok: false, error: 'Ese escenario no existe.' };

  const puente = await estadoPuente().catch(() => null);
  if (!puente || puente.estado === 'sin_conectar') {
    return { ok: false, error: 'Tu navegador no está conectado. Sal al catálogo y ábrelo en «Tu navegador», al pie.' };
  }
  if (puente.estado === 'marcada') {
    return { ok: false, error: 'Google marcó esta sesión y dejó de aceptar generaciones. En el catálogo, dentro de «Tu navegador», está qué hacer.' };
  }
  if (puente.estado === 'sin_sesion') {
    return { ok: false, error: 'Tu sesión de Google Flow venció. Abre Flow, inicia sesión, y vuelve a intentar.' };
  }

  // ⚠️ ACÁ SE LEÍA LA CARA Y SE MANDABA EN EL CUERPO. Ya no.
  //
  // La cara sale de la PLANTILLA: son los `imageInputs` del pedido que la persona
  // hizo a mano en Flow con su foto. Es la misma foto que ya usa el paso de video
  // y no hay que nombrarla — lo cual, además, es más fuerte que mandarla: un id
  // que copiamos no puede quedar viejo respecto del que Flow está usando hoy.

  // Un intento más = otra semilla. «Regenerar» tiene que dar algo distinto o el
  // botón no hace nada; y la semilla sigue siendo derivada, así que volver al
  // intento 2 daría la misma imagen del intento 2.
  const intento = (imgs(item)[String(n)]?.intento ?? 0) + 1;
  const saldoAntes = (await leerSaldoGuardado()).creditos;

  // ⚠️ LAS DOS CONDICIONES, y la segunda es una guarda contra `parchar`, que

  // INVENTA los tramos que faltan: sobre una plantilla sin `imageInputs` crearía

  // uno sin su `imageInputType`, devolvería éxito, y saldría un cuerpo mal

  // formado hecho por nosotros — con una imagen de resultado y sin ningún error.

  const cara = (await caraParcheable()) ? await caraEnFlow(item) : '';

  // ⚠️ SI HAY UNA FOTO ELEGIDA Y TODAVÍA NO ESTÁ EN FLOW, NO SE GENERA.
  //
  // Medido: los trabajos #351 (subir la foto) y #352 (generar la imagen) se
  // crearon en el MISMO segundo, porque esta función encolaba la subida y seguía
  // de largo. Resultado: la imagen salió con la cara de la plantilla —la vieja— y
  // la foto que Martín acababa de elegir llegó a Flow un latido tarde, para nada.
  //
  // Y la forma en que fallaba es la peor: no da error, da UNA IMAGEN. Con la cara
  // equivocada, cobrada, y sin nada que lo delate.
  //
  // Esperar un latido no cuesta nada; generar con la cara vieja cuesta la
  // generación y la confianza en el selector.
  if (item.fotoId && !cara && (await caraParcheable())) {
    // ⚠️ SE BORRA EL FALLO VIEJO ANTES DE SALIR, Y ESA ES LA MITAD QUE FALTABA.
    //
    // La limpieza de los cuatro campos del error vive abajo, en la escritura que
    // sigue al encolado — o sea DESPUÉS de este return. Con lo cual la pantalla
    // decía dos cosas a la vez: el panel pintaba el fallo del intento anterior
    // («tu cuenta de Google se quedó sin créditos») y el pie, la espera de éste
    // («MaKo está subiendo tu foto»). El dueño lo reportó junto: «no solo me
    // sigue apareciendo el mismo mensaje erróneo, sino que me dice también que
    // está subiendo la foto cuando ya la subió».
    //
    // Dos mensajes que se contradicen no confunden sólo sobre ese punto: hacen
    // desconfiar de todos los demás. Y es la regla de la casa sobre las salidas
    // tempranas — un estado que se escribe «al final de la función» no registra
    // los `return` de arriba, que son justo los que hay que contar.
    return {
      ok: false,
      item: await guardarImagen(item, n, { error: '', errorCausa: undefined, errorCrudo: '', errorAt: '' }),
      error: 'MaKo está subiendo tu foto a Google. En unos segundos vuelve a intentar.',
    };
  }
  const trabajoId = await encolar('generar_imagen', {
    // El projectId de este path es de mentira y no importa: la extensión usa el
    // path SOLO para encontrar la plantilla (de su último tramo sale la clase) y
    // la URL la copia entera del tráfico real de Flow, projectId incluido.
    path: ENDPOINTS.generarImagenes('x'),
    // ⚠️ PARCHES, no cuerpo. Adentro de `requests[0]` viven `imageModelName` y
    // los `imageInputs` que traen la cara, y los dos los sabe SOLO la plantilla:
    // `fundir()` reemplaza los arrays enteros, así que mandar `requests` a medias
    // perdería el modelo y la cara. Se copia todo y se cambia sólo la hoja.
    parches: parchesImagenEscena({
      prompt: escena.prompt,
      // ⚠️ El FORMATO decide el prompt cuando tiene uno probado. La escena que
      // escribió el modelo sigue viajando —es el respaldo de los formatos que
      // todavía no lo tienen— y su `lugar` sigue siendo lo que se lee en
      // pantalla, así que no se pierde nada por mandar las dos cosas.
      puestaId: item.plan.puestaId,
      // Lo que la persona escribió a mano para esta escena, si escribió algo.
      propio: item.promptsImagenPropios?.[String(n)],
      seed: semillaDeEscena(planId, n, intento),
      batchId: randomUUID(),
      // La cara elegida, y SÓLO si las dos condiciones se cumplen: que ya esté
      // subida a Flow, y que la plantilla tenga dónde ponerla. Si falta una, no
      // se parchea y manda la plantilla — que es como funcionaba antes.
      ...(cara ? { cara } : {}),
    }),
  });
  if (trabajoId == null) return { ok: false, error: 'No se pudo encolar la imagen.' };

  return {
    ok: true,
    // ⚠️ ACÁ SE BORRABA LA IMAGEN QUE LA PERSONA TENÍA: `opciones: []` y
    // `elegida: ''`. Ya no.
    //
    // No era un descuido: `opciones` era también la señal de «ya terminó»
    // (`estadoImagenAction` hacía `if (m.opciones?.length) return listo`), así
    // que dejarla llena habría hecho que el sondeo nunca esperara la nueva. La
    // señal se mudó a `trabajoListo` y con eso la lista puede sólo CRECER.
    //
    // Lo reportó el dueño el 31/08/2026: regeneró, la segunda no le gustó, y la
    // primera ya no estaba en ningún lado de la app. Su regla, escrita hace
    // meses: «un render nuevo NUNCA sobrescribe al anterior; van los dos con
    // nombre que los distinga».
    //
    // `confirmada: false` SÍ se mantiene: hay una imagen nueva en camino y el
    // paso vuelve a estar abierto. Y los cuatro campos del error se limpian
    // juntos —un `errorCrudo` que sobrevive a su `error` deja el detalle
    // técnico plegado hablando de un fallo que ya no existe—.
    item: await guardarImagen(item, n, {
      trabajoId, intento, saldoAntes, propia: false,
      confirmada: false,
      error: '', errorCausa: undefined, errorCrudo: '', errorAt: '',
    }),
  };
}

export type EstadoImagen =
  | { fase: 'sin_empezar' }
  | { fase: 'generando' }
  | { fase: 'listo'; opciones: string[]; elegida: string }
  | { fase: 'error'; error: string };

/** Mira si ya volvió la imagen. Un paso por llamada, sin esperar adentro. */
export async function estadoImagenAction(
  planId: string,
  n: number,
): Promise<{ ok: true; item: PlanGuardado; estado: EstadoImagen } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  let item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const m = imgs(item)[String(n)] ?? {};
  // ⚠️ LA SEÑAL DE «YA TERMINÓ» ES `trabajoListo`, NO QUE LA LISTA TENGA ALGO.
  //
  // Con `opciones.length` como señal, una lista que se conserva entre
  // generaciones haría que el sondeo diera por terminada la nueva antes de
  // empezar. Son dos preguntas distintas —«¿tengo variantes?» y «¿llegó la que
  // pedí?»— y meterlas en un campo es lo que obligaba a vaciarlo.
  //
  // La segunda mitad es la compatibilidad: los planes escritos antes de que este
  // campo existiera tienen `opciones` y no tienen `trabajoListo`. Sin esta rama,
  // volverían a absorber su propio resultado y duplicarían la lista.
  const yaLlego = m.trabajoListo ? m.trabajoId === m.trabajoListo : !!m.opciones?.length;
  if (yaLlego) {
    return { ok: true, item, estado: { fase: 'listo', opciones: m.opciones ?? [], elegida: m.elegida ?? '' } };
  }
  if (m.error) return { ok: true, item, estado: { fase: 'error', error: m.error } };
  if (!m.trabajoId) return { ok: true, item, estado: { fase: 'sin_empezar' } };

  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('estado, resultado, error, motivo')
    .eq('id', m.trabajoId)
    .maybeSingle();

  // `fallido`, que es lo que escribe la cola. Con `error` —el nombre que uno
  // supone— un trabajo caído se lee como «todavía no terminó» y la pantalla gira
  // para siempre. Ya pasó una vez con los clips.
  if (str(data?.estado) === 'fallido') {
    const fallo = falloGuardable(str(data?.error), `la imagen del escenario ${n}`, str(data?.motivo));
    item = await guardarImagen(item, n, fallo);
    return { ok: true, item, estado: { fase: 'error', error: fallo.error } };
  }
  if (str(data?.estado) !== 'listo') return { ok: true, item, estado: { fase: 'generando' } };

  // ⚠️ EL `mediaId` YA NO SE TIRA, y ahí estaba el bug que encontró Martín.
  //
  // Esta línea era `.map((i) => i.url)`: se quedaba con la dirección para pintar
  // la imagen y descartaba su id dentro de Flow. Sin ese id, cuando llegaba el
  // momento de animar el clip no había con qué referenciar la imagen recién
  // generada — así que se usaba `KEY_CARA_FLOW`, o sea la FOTO CRUDA.
  //
  // Martín lo vio en la grilla de Flow: «referenció a la imagen incorrecta… la
  // segunda es la que debió referenciar, que es la que generé con MaKo». Y es lo
  // correcto: la imagen generada ya tiene su cara DENTRO de la escena —el auto,
  // la luz, el encuadre—, y animar desde el retrato pierde todo eso.
  const salidas = imagenesDeRespuesta(data?.resultado);
  if (!salidas.length) {
    const fallo = falloGuardable(
      'Flow aceptó el pedido y no devolvió ninguna imagen.',
      `la imagen del escenario ${n}`,
    );
    item = await guardarImagen(item, n, fallo);
    return { ok: true, item, estado: { fase: 'error', error: fallo.error } };
  }

  // ── LA LISTA SE SUMA, NO SE REEMPLAZA ────────────────────────────────────
  //
  // Las variantes viejas quedan disponibles para volver a ellas con un click. Es
  // lo que faltaba el día que el dueño regeneró, la nueva no le gustó, y la
  // anterior ya no existía en la app —sólo en `flow_trabajos`, de donde hubo que
  // rescatarla a mano—. La regla —y el porqué del dedup— vive en
  // `variantes-imagen.ts`, que es un módulo testeable.
  const previas = (m.opciones ?? []).map((url, i) => ({ url, mediaId: m.opcionesId?.[i] ?? '' }));
  const { todas, elegida: nueva } = sumarVariantes(previas, salidas);

  // Si todo lo que llegó ya estaba, se conserva lo que la persona tenía elegido:
  // un sondeo repetido no puede mover la selección debajo de nadie.
  const elegida = nueva?.url ?? m.elegida ?? todas[0]?.url ?? '';
  const elegidaId = nueva?.mediaId ?? (nueva ? '' : m.elegidaId) ?? todas[0]?.mediaId ?? '';

  item = await guardarImagen(item, n, {
    opciones: todas.map((v) => v.url),
    opcionesId: todas.map((v) => v.mediaId ?? ''),
    elegida,
    elegidaId,
    // El trabajo queda marcado como absorbido: sin esto el sondeo volvería a
    // entrar acá en cada vuelta.
    trabajoListo: m.trabajoId,
  });
  return { ok: true, item, estado: { fase: 'listo', opciones: todas.map((v) => v.url), elegida } };
}

/** La persona elige cuál de las variantes queda. */
export async function elegirImagenAction(
  planId: string,
  n: number,
  url: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const m = imgs(item)[String(n)] ?? {};
  // Solo una de las que se generaron para ESTA escena. Aceptar cualquier string
  // dejaría que la pantalla escriba una URL arbitraria dentro del plan.
  if (!m.opciones?.includes(url)) return { ok: false, error: 'Esa imagen no es de este escenario.' };

  // El id de ESA variante viaja con la elección: es lo que el clip va a
  // referenciar, y buscarlo después por índice se rompe cuando alguien regenera
  // y la lista cambia de largo.
  const idElegido = m.opcionesId?.[m.opciones.indexOf(url)] ?? '';

  // Cambiar de imagen re-abre la decisión: lo que se confirmó fue la otra.
  return { ok: true, item: await guardarImagen(item, n, { elegida: url, elegidaId: idElegido, confirmada: false }) };
}

/**
 * Descarta una toma ya filmada, para poder volver a filmarla.
 *
 * ⚠️ SIN ESTO, «rehacer la toma» NO HACE NADA. El freno de plata de
 * `generarTomaAction` devuelve lo que hay cuando la toma ya tiene `url` —y está
 * bien, es lo que impidió pagar dos veces el mismo clip—, así que pedir de nuevo
 * la misma toma contesta `ok` y no genera nada. Es un botón que responde bien y
 * no pasa nada, que es la peor forma de fallar.
 *
 * Rehacer es entonces DOS pasos explícitos: descartar y volver a generar. Que
 * sean dos es a propósito: borrar un clip pagado no puede ser un efecto lateral
 * de apretar «generar».
 */
export async function descartarTomaAction(
  planId: string,
  n: number,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  // ⚠️ SE ARCHIVA, NO SE BORRA. Antes esto era `delete sin[String(n)]`, y el
  // clip pagado dejaba de existir en el mismo instante — antes de saber si
  // `generarTomaAction` iba a poder filmar algo, cosa que tiene cinco motivos
  // para no poder. Ahora el intento anterior queda guardado y la pantalla
  // ofrece volver a él.
  const sin = { ...marcas(item) };
  sin[String(n)] = archivarToma(marcas(item)[String(n)]);
  const actualizado: PlanGuardado = { ...item, video: sin };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * Las tres ediciones del plan de clips: agregar, quitar, cambiar la duración.
 *
 * Una sola action con un `que` en vez de tres, porque las tres hacen lo MISMO
 * —leer el plan, aplicar una función pura, guardar— y la diferencia cabe en una
 * palabra. Tres copias de ese envoltorio son tres lugares donde olvidarse el
 * guard de admin.
 *
 * ⚠️ La decisión de si se puede vive en `plan-clips.ts`, que es puro y testeado.
 * Acá NO se re-valida nada: duplicar la regla es cómo una de las dos se queda
 * vieja, y la que se queda vieja siempre es la que no tiene test.
 */
export async function editarClipsAction(
  planId: string,
  orden:
    | { que: 'agregar'; despuesDe: number; segundos: number }
    | { que: 'quitar'; n: number }
    | { que: 'duracion'; n: number; segundos: number },
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const r = orden.que === 'agregar'
    ? agregarClip(item, orden.despuesDe, orden.segundos)
    : orden.que === 'quitar'
      ? quitarClip(item, orden.n)
      : cambiarDuracion(item, orden.n, orden.segundos);

  if (!r.ok) return r;
  await guardarEnHistorial(r.item);
  return { ok: true, item: r.item };
}

/**
 * Escribe la línea que dice una toma.
 *
 * Existe por el clip que nace vacío: sin esto, agregar un clip daría una toma que
 * no se puede filmar y ninguna forma de arreglarla.
 *
 * ⚠️ Recalcula `palabras` con la misma función que el planificador
 * (`contarPalabras`), no contando espacios acá: dos formas de contar palabras dan
 * dos topes distintos para el mismo texto, y el aviso de «no entra» pasaría a
 * depender de quién preguntó.
 */
export async function escribirVozTomaAction(
  planId: string,
  n: number,
  voz: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };
  if (!item.plan.clips.some((c) => c.n === n)) return { ok: false, error: 'Esa toma no existe.' };

  const marca = marcas(item)[String(n)];
  if (marca?.url) {
    return { ok: false, error: `La toma ${n} ya está filmada. Descarta el clip para poder cambiar lo que dice.` };
  }

  const texto = (voz ?? '').trim().slice(0, 1000);
  const clips = item.plan.clips.map((c) => (
    c.n === n ? { ...c, voz: texto, palabras: contarPalabras(texto), voseo: marcasDeVoseo(texto) } : c
  ));

  const actualizado: PlanGuardado = {
    ...item,
    plan: { ...item.plan, clips, deCorrido: clips.map((c) => c.voz).filter(Boolean).join(' ') },
  };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * Guarda el prompt que la persona escribió para la IMAGEN de un escenario.
 *
 * Gemela de `guardarPromptTomaAction` y con las mismas dos reglas: NO genera
 * —guardar y gastar son decisiones distintas— y vaciar el campo devuelve el
 * prompt del formato, que es la forma de deshacer.
 */
export async function guardarPromptEscenaAction(
  planId: string,
  n: number,
  prompt: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };
  if (!item.escenas?.some((e) => e.n === n)) return { ok: false, error: 'Ese escenario no existe.' };

  const texto = (prompt ?? '').trim().slice(0, 4000);
  const previos = { ...(item.promptsImagenPropios ?? {}) };
  if (texto) previos[String(n)] = texto;
  else delete previos[String(n)];

  const actualizado: PlanGuardado = {
    ...item,
    promptsImagenPropios: Object.keys(previos).length ? previos : undefined,
  };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * Guarda el prompt que la persona escribió para una toma.
 *
 * ⚠️ NO FILMA. Guardar y gastar ~15 créditos son dos decisiones distintas, y
 * juntarlas haría que corregir una coma cobrara un clip. Quien llama decide si
 * después filma.
 *
 * Vaciar el campo lo devuelve al prompt del formato: es la forma de deshacer, y
 * tiene que existir o la única salida de un texto mal escrito sería escribir otro
 * texto encima.
 */
export async function guardarPromptTomaAction(
  planId: string,
  n: number,
  prompt: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };
  if (!item.plan.clips.some((c) => c.n === n)) return { ok: false, error: 'Esa toma no existe en el plan.' };

  // Un tope generoso pero real: el plan entero vive en UNA fila de texto de
  // `app_settings`, y siete prompts sin límite la hacen crecer sin techo.
  const texto = (prompt ?? '').trim().slice(0, 4000);

  const previos = { ...(item.promptsPropios ?? {}) };
  if (texto) previos[String(n)] = texto;
  else delete previos[String(n)];

  const actualizado: PlanGuardado = {
    ...item,
    promptsPropios: Object.keys(previos).length ? previos : undefined,
  };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * Vuelve al último clip descartado de una toma.
 *
 * Es la otra mitad de archivar: guardar el intento anterior sin ofrecer cómo
 * recuperarlo sería la misma pérdida con un rastro en la base — «escribir la
 * salida no es ofrecerla», que este módulo ya pagó tres veces.
 */
export async function restaurarTomaAction(
  planId: string,
  n: number,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const vuelve = recuperarToma(marcas(item)[String(n)]);
  if (!vuelve) return { ok: false, error: 'No hay ningún clip anterior guardado para esa toma.' };

  const sin = { ...marcas(item) };
  sin[String(n)] = vuelve;
  const actualizado: PlanGuardado = { ...item, video: sin };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/** Queda escrito que la cara ya se miró: la pregunta se hace una sola vez. */
/**
 * La persona ya vio el ejemplo del formato. Es el «Empezar mi anuncio».
 *
 * Gemela de `marcarCaraVistaAction`, y por la misma razón: una pantalla que se
 * muestra una sola vez necesita que ese «una vez» sobreviva a un refresh.
 */
/**
 * La persona elige con QUÉ foto suya se genera este anuncio.
 *
 * Se guarda en el plan y no en un ajuste global: dos anuncios pueden querer caras
 * distintas, y una preferencia global haría que empezar el segundo le cambiara la
 * cara al primero sin avisar.
 */
export async function elegirFotoAction(
  planId: string,
  fotoId: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  // Se comprueba que la foto EXISTA antes de guardarla: un id que no está deja el
  // anuncio apuntando a nada y la pantalla en blanco, sin decir por qué.
  const est = await personaEstado().catch(() => ({ fotos: [] as { id: string }[] }));
  if (!est.fotos.some((f: { id: string }) => f.id === fotoId)) {
    return { ok: false, error: 'Esa foto ya no está en tu perfil.' };
  }

  // ⚠️ Y SE INVALIDA LO QUE SALIÓ DE LA FOTO ANTERIOR. Sin esto el selector no
  // gobierna nada: la persona cambia la foto, aprieta Continuar, y «Continuar»
  // CONFIRMA la imagen vieja — la de la cara anterior—, que es el cuadro del que
  // después sale el clip pagado.
  //
  // Sólo si de verdad cambió: reelegir la misma foto no puede costarle las
  // imágenes que ya aprobó.
  const actualizado: PlanGuardado = item.fotoId === fotoId
    ? { ...item, fotoId }
    : { ...olvidarImagenesDeLaFoto(item), fotoId };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * El `mediaId` en Flow de la foto elegida para este anuncio. Si no está, la sube.
 *
 * Devuelve `''` mientras no la tenga —la subida es un trabajo del puente y tarda
 * un latido—, y la pantalla vuelve a preguntar. No bloquea: una action que espera
 * a que un navegador ajeno conteste muere en el timeout.
 *
 * ⚠️ SE CACHEA POR FOTO. Subir la misma foto en cada anuncio no rompe nada y gasta
 * tráfico contra la sesión de Google del cliente, y este proyecto ya midió lo que
 * cuesta el ritmo de máquina contra Google.
 */
async function caraEnFlow(item: PlanGuardado): Promise<string> {
  const fotoId = str(item.fotoId);
  if (!fotoId) return '';

  // ⚠️ SE COMPRUEBA QUE LA FOTO SIGA EXISTIENDO ANTES DE USAR LO CACHEADO.
  //
  // `elegirFotoAction` verifica que exista al ELEGIRLA, y eso no cubre nada acá:
  // borrar la foto después deja el `fotoId` del plan y la entrada del mapa vivos,
  // así que se seguía generando con la cara de una foto que ya no está — mientras
  // la pantalla muestra otra. Nadie puede notar que la comparación «¿apruebas tu
  // avatar?» está comparando dos cosas sin relación.
  //
  // Y de paso se purga el mapa: una clave que apunta a una foto borrada no vuelve
  // a servir nunca, y guardarla es prometer que sí.
  const est = await personaEstado().catch(() => null);
  if (est && !est.fotos.some((f: { id: string }) => f.id === fotoId)) {
    const sucio = JSON.parse((await getSetting(KEY_CARAS_FLOW)) || '{}') as Record<string, string>;
    if (fotoId in sucio) {
      delete sucio[fotoId];
      await setSetting(KEY_CARAS_FLOW, JSON.stringify(sucio));
    }
    return '';
  }

  const mapa = JSON.parse((await getSetting(KEY_CARAS_FLOW)) || '{}') as Record<string, string>;
  if (str(mapa[fotoId])) return str(mapa[fotoId]);

  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('id, estado, resultado')
    .eq('tipo', 'subir_imagen')
    .filter('pedido->>fotoId', 'eq', fotoId)
    .order('id', { ascending: false })
    .limit(3);

  for (const t of data ?? []) {
    if (str(t.estado) !== 'listo') continue;
    // ⚠️ La respuesta MEDIDA trae el id en `media.name`, y `media` es un OBJETO
    // —no un array, a diferencia de las respuestas de generación—. Por eso no se
    // usa `extraerMediaId`, que mira claves de primer nivel: acá está un nivel
    // más adentro.
    const id = str(obj(obj(t.resultado).media).name);
    if (!id) continue;
    await setSetting(KEY_CARAS_FLOW, JSON.stringify({ ...mapa, [fotoId]: id }));
    return id;
  }

  // Ninguna esperando: se sube. Con una en vuelo, se espera a ésa.
  if (!(data ?? []).some((t) => ['pendiente', 'tomado'].includes(str(t.estado)))) {
    const foto = (await getPersona()).fotos.find((f: { id: string }) => f.id === fotoId);
    if (!foto) return '';
    const bin = await db.storage.from('archivero').download(foto.path);
    if (bin.error || !bin.data) return '';
    const b64 = Buffer.from(await bin.data.arrayBuffer()).toString('base64');
    await encolar('subir_imagen', {
      path: ENDPOINTS.subirImagen,
      parches: parchesSubirImagen(b64),
      // Para poder encontrar este trabajo despues sin mirar el cuerpo entero.
      fotoId,
    });
  }
  return '';
}

/**
 * ¿Se puede parchear la cara sin romper el pedido?
 *
 * Se pregunta a la PLANTILLA guardada, no al esquema. Si no se puede saber
 * —cuerpo ausente o truncado— no se parchea: no poder comprobar algo no autoriza
 * a asumirlo.
 */
async function caraParcheable(): Promise<boolean> {
  try {
    const guardadas = sanearPlantillas(JSON.parse((await getSetting(KEY_PLANTILLAS)) || '[]'));
    const p = guardadas.find((x) => x.clase === 'flowMedia:batchGenerateImages');
    return tieneCaraParcheable(p?.cuerpo ?? null) === true;
  } catch {
    return false;
  }
}

/**
 * Deja elegida la ÚLTIMA foto que se subió.
 *
 * ⚠️ EL ARCHIVO NO PASA POR ACÁ, y el intento anterior era un bug listo para
 * morder. Una server action de Next topea el cuerpo en **1 MB** por default y
 * este proyecto no sube ese límite (`next.config.ts` no define
 * `serverActions.bodySizeLimit`), así que mandar una foto en base64 como
 * argumento falla con cualquier foto de celular — y el repo ya lo tiene escrito
 * con su caso en `docs/hallazgos-infra.md`: por eso la importación de leads
 * necesitó un route handler.
 *
 * La foto sube por `POST /api/onboarding/persona` en multipart, que ya existe,
 * ya valida tipo y tamaño (15 MB) y es el único lugar que sabe dónde viven las
 * fotos. Acá sólo se fija cuál quedó elegida.
 */
export async function elegirUltimaFotoAction(
  planId: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const est = await personaEstado().catch(() => null);
  const ultima = est?.fotos?.[est.fotos.length - 1];
  if (!ultima) return { ok: false, error: 'No se encontró la foto que subiste.' };
  return elegirFotoAction(planId, ultima.id);
}

export async function marcarEjemploVistoAction(
  planId: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const actualizado: PlanGuardado = { ...item, ejemploVisto: true };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

export async function marcarCaraVistaAction(
  planId: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  const actualizado: PlanGuardado = { ...item, caraVista: true };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

/**
 * La persona CONFIRMA que esa imagen es el lugar.
 *
 * Es el paso que faltaba, y no es ceremonia: es el único momento en que alguien
 * mira la comparación antes de que se gasten créditos. Sin él, `escenariosListos`
 * se cumplía solo en cuanto Flow contestaba.
 */
export async function confirmarEscenaAction(
  planId: string,
  n: number,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  // No se confirma lo que no existe: sin imagen elegida no hay nada que mirar.
  if (!imgs(item)[String(n)]?.elegida) {
    return { ok: false, error: 'Todavía no hay una imagen de ese escenario para confirmar.' };
  }
  return { ok: true, item: await guardarImagen(item, n, { confirmada: true }) };
}

/**
 * La persona sube SU foto del lugar en vez de generarla.
 *
 * Es la tercera corrección que pidió el dueño, y la que más veces gana: cuando
 * el escenario existe de verdad, una foto real del lugar le gana a cualquier
 * prompt. Entra como una opción más y queda elegida.
 *
 * ⚠️ Llega como data: URI y se guarda tal cual, igual que las que devuelve Flow
 * cuando manda binario. Pesa dentro del historial y el historial topea en 10
 * anuncios — es la misma deuda que ya tienen los clips, y se salda igual: bajando
 * los medios a storage propio. Está anotado en docs/hallazgos-generativa.md.
 */
export async function subirImagenEscenaAction(
  planId: string,
  n: number,
  dataUri: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const uri = (dataUri || '').trim();
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(uri)) {
    return { ok: false, error: 'Eso no es una imagen. Sube un PNG, un JPG o un WEBP.' };
  }
  // ~6 MB de base64. Por encima de eso el historial entero deja de entrar en su
  // fila de app_settings y se pierde el anuncio, no la foto.
  if (uri.length > 8_000_000) return { ok: false, error: 'Esa imagen pesa demasiado. Prueba con una más chica.' };

  const item = planDe(await leerHistorial(), planId);
  if (!item?.escenas?.some((e) => e.n === n)) return { ok: false, error: 'Ese escenario no existe.' };

  return {
    ok: true,
    item: await guardarImagen(item, n, {
      opciones: [uri], elegida: uri, propia: true, confirmada: false,
      error: '', errorCausa: undefined, errorCrudo: '', errorAt: '',
    }),
  };
}

/**
 * Rehace el guion con o sin las muletillas de la persona.
 *
 * ── Por qué vive acá y no en el paso anterior ──────────────────────────────
 * Martín: *«ahí debería estar el botón de agregar las muletillas, en esa tab, y
 * se debe agregar sin salir de la tab»*. La decisión se toma LEYENDO el guion —es
 * literalmente «¿me gusta cómo suena?»— y estaba en la pantalla anterior, donde
 * todavía no hay nada que leer. Preguntarlo antes es pedir una opinión sobre algo
 * que no se vio.
 *
 * ⚠️ NO ES UN INTERRUPTOR: rehace el guion entero, así que descarta los
 * escenarios y sus imágenes. Por eso quien llama sólo lo ofrece mientras no haya
 * ninguna toma filmada — una vez que se gastaron créditos, cambiar el guion de
 * lado a lado deja de ser algo que se prueba y se vuelve una decisión.
 */
export async function cambiarMuletillasAction(
  planId: string,
  adaptarVoz: boolean,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  // Con algo filmado no se rehace: son créditos gastados sobre un texto que
  // dejaría de existir.
  if (Object.values(marcas(item)).some((v) => v?.url || v?.trabajoId)) {
    return { ok: false, error: 'Ya hay tomas filmadas con este guion: cambiarlo ahora las dejaría sin sentido.' };
  }
  if (!item.guionId) {
    return { ok: false, error: 'Este anuncio no guardó de qué guion salió, así que no se puede rehacer.' };
  }

  const guion = (await guionesDisponibles()).find((g) => g.id === item.guionId);
  if (!guion?.texto?.trim()) {
    return { ok: false, error: 'No encontré el guion original de este anuncio.' };
  }

  const out = await generarPlanAction({
    puestaId: item.plan.puestaId,
    anguloId: item.plan.anguloId,
    guionId: item.guionId,
    guionTexto: guion.texto,
    adaptarVoz,
  });
  if (!out.ok) return out;

  // El anuncio conserva su ID: es el MISMO anuncio con el guion reescrito. Si
  // naciera con otro, el `?plan=` de la barra quedaría apuntando al viejo y la
  // pantalla mostraría uno mientras la URL nombra otro.
  const actualizado: PlanGuardado = {
    ...out.item, id: item.id, guionId: item.guionId,
    escenas: undefined, imagenes: {}, video: {},
  };
  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}

// ── El montaje: pegar las tomas y devolver el anuncio ────────────────────────
// El pipeline corre en un contenedor propio (worker/), no acá: encadena ~15
// invocaciones de ffmpeg y un render son ~25 s de CPU. Esto sólo encola y
// consulta.

export type EstadoMontaje =
  | { fase: 'sin_empezar' }
  | { fase: 'encolado'; id: number }
  | { fase: 'montando'; id: number; desde: string | null }
  | { fase: 'listo'; url: string; segundosAntes?: number; segundosDespues?: number }
  | { fase: 'error'; error: string; motivo: string };

/**
 * Encola el montaje de un anuncio con todas sus tomas filmadas.
 *
 * ⚠️ IDEMPOTENTE, y no por prolijidad: un doble click o dos pestañas abiertas
 * encolarían dos montajes del mismo anuncio, y el worker renderizaría dos veces
 * ~25 s de CPU para escribir los dos en la MISMA ruta. El segundo pisaría al
 * primero mientras el primero todavía sube: un mp4 a medias, sin ningún error.
 */
export async function montarAnuncioAction(
  planId: string,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const item = planDe(await leerHistorial(), planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial.' };

  // Las tomas EN ORDEN. Sin una, no hay anuncio que montar: pegar seis de siete
  // daría un video que se corta a la mitad de una frase y nadie lo miraría hasta
  // publicarlo.
  const clips: string[] = [];
  for (const c of item.plan.clips) {
    const url = item.video?.[String(c.n)]?.url;
    if (!url) return { ok: false, error: `Falta filmar la toma ${c.n}.` };
    clips.push(url);
  }
  if (!clips.length) return { ok: false, error: 'Este anuncio no tiene tomas.' };

  const db = await getTenantDb();

  // ⚠️ SI YA HAY UNO EN VUELO, SE DEVUELVE ÉSE. No se encola otro ni se contesta
  // un error: quien apretó dos veces quiere el anuncio, no un reto.
  const { data: vivo } = await db
    .from('montaje_trabajos')
    .select('id')
    .eq('plan_id', planId)
    .in('estado', ['pendiente', 'tomado'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vivo?.id) return { ok: true, id: Number(vivo.id) };

  const { data, error } = await db
    .from('montaje_trabajos')
    .insert({
      plan_id: planId,
      pedido: {
        titulo: item.plan.titulo,
        clips,
        // Contra esto se verifica que el corte no se haya comido una palabra.
        // Es el texto REAL de las tomas, no el guion original: si alguien
        // corrigió una línea a mano, el anuncio dice la corregida.
        guion: item.plan.clips.map((c) => c.voz).filter(Boolean).join(' '),
        segundosPorToma: item.plan.clips.map((c) => c.segundos),
      },
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    console.error('[montaje] no se pudo encolar:', error?.message);
    return { ok: false, error: 'No se pudo empezar el montaje.' };
  }
  return { ok: true, id: Number(data.id) };
}

/** Cómo va el montaje de este anuncio. La pantalla la llama cada pocos segundos. */
export async function estadoMontajeAction(
  planId: string,
): Promise<{ ok: true; estado: EstadoMontaje } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const db = await getTenantDb();
  // ⚠️ FILTRADO POR `plan_id` EN SQL, no traer las últimas N y filtrar acá. Es la
  // lección de `estadoTomaAction`: una ventana global se llena con los trabajos
  // de otros anuncios y la fila que contesta por éste se cae afuera, sin error.
  const { data } = await db
    .from('montaje_trabajos')
    .select('id, estado, resultado, error, motivo, tomado_at')
    .eq('plan_id', planId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { ok: true, estado: { fase: 'sin_empezar' } };

  const est = str(data.estado);
  if (est === 'listo') {
    const r = obj(data.resultado);
    const url = str(r.url);
    // Un `listo` sin url no es un listo: el worker reportó éxito y no dejó nada.
    // Se dice como error en vez de mostrar un reproductor vacío.
    if (!url) return { ok: true, estado: { fase: 'error', error: 'El montaje terminó sin dejar el archivo.', motivo: 'interno' } };
    return {
      ok: true,
      estado: {
        fase: 'listo',
        url,
        segundosAntes: typeof r.segundosAntes === 'number' ? r.segundosAntes : undefined,
        segundosDespues: typeof r.segundosDespues === 'number' ? r.segundosDespues : undefined,
      },
    };
  }
  if (est === 'fallido') {
    return { ok: true, estado: { fase: 'error', error: str(data.error) || 'No se pudo montar.', motivo: str(data.motivo) } };
  }
  if (est === 'tomado') {
    return { ok: true, estado: { fase: 'montando', id: Number(data.id), desde: str(data.tomado_at) || null } };
  }
  return { ok: true, estado: { fase: 'encolado', id: Number(data.id) } };
}
