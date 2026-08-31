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
import { escribirEscenas, reescribirEscena } from '@/lib/escenas';
import { puestaPorId } from '@/lib/puestas-data';
import { generarPlanAction } from './actions';
import { guionesDisponibles } from './guiones-datos';
import { causaFlow, causaDeMotivo, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { getSetting, setSetting } from '@/lib/settings';
import { leerHistorial, guardarEnHistorial, type PlanGuardado, type MarcaVideo } from './video-datos';
import { sanearPlantillas, tieneCaraParcheable, KEY_PLANTILLAS } from '@/lib/flow-plantillas';
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
async function conseguirEnlace(mediaId: string): Promise<string> {
  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('id, estado, resultado')
    .eq('tipo', 'enlace_clip')
    .filter('pedido->>mediaId', 'eq', mediaId)
    .order('id', { ascending: false })
    .limit(3);

  for (const t of data ?? []) {
    if (str(t.estado) !== 'listo') continue;
    const url = str(obj(t.resultado).url);
    if (url) return url;
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
async function guardarClip(planId: string, n: number, firmada: string): Promise<string> {
  try {
    const r = await fetch(firmada);
    if (!r.ok) return '';
    const bytes = new Uint8Array(await r.arrayBuffer());
    // Un archivo de cero bytes no es un clip: es un error que se ve como un video.
    if (bytes.byteLength < 1000) return '';

    const db = await getTenantDb();
    const ruta = `video-generator/${planId}/toma-${n}.mp4`;
    const { error } = await db.storage
      .from(BUCKET_CLIPS)
      .upload(ruta, bytes, { contentType: 'video/mp4', upsert: true });
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
  if (fallada) {
    // Se limpia el intento anterior ANTES de encolar: si quedara la `operacion`
    // vieja, el sondeo del estado seguiría preguntando por ella y volvería a
    // encontrar el mismo rechazo, pisando el resultado del intento nuevo.
    item = await guardarMarca(item, n, {
      trabajoId: undefined,
      operacion: undefined,
      error: undefined,
      errorCausa: undefined,
      errorCrudo: undefined,
      errorAt: undefined,
      ciego: undefined,
    });
  }

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
      { prompt: clip.prompt, mediaId, seed: semillaDeToma(planId, n) },
      randomUUID(),
    ),
  });
  if (trabajoId == null) return { ok: false, error: 'No se pudo encolar el trabajo.' };

  return { ok: true, item: await guardarMarca(item, n, { trabajoId, operacion: '', url: '', error: '', saldoAntes }) };
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
  const { data: consultas } = await db
    .from('flow_trabajos')
    .select('id, estado, resultado, error, motivo, pedido')
    .eq('tipo', 'estado_clips')
    .order('id', { ascending: false })
    .limit(12);

  // Sólo las consultas por ESTA operación. Antes se miraban todas y se buscaba el
  // nombre adentro del resultado, que alcanza para las que contestaron pero no
  // para las que fallaron: una consulta fallida no tiene resultado donde buscar.
  // El `pedido.operacion` es el dato exacto y lo escribimos nosotros al encolar.
  const mias = (consultas ?? []).filter((c) => str(obj(c.pedido).operacion) === operacion);

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
        errorCrudo: texto.slice(0, 1200),
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
          const guardada = await guardarClip(planId, n, enlace);
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
        // Una sola toma por vez, asi que la diferencia ES el costo de un clip. Si
        // el dueno genero algo a mano en el medio, el guard de
        // `guardarCostoMedido` descarta el numero absurdo en vez de contaminar
        // todas las cuentas que vienen despues.
        if (typeof previo === 'number' && previo > creditos) await guardarCostoMedido(previo - creditos);
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

type MarcaImagen = {
  trabajoId?: number; opciones?: string[]; elegida?: string; propia?: boolean;
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
   */
  opcionesId?: string[]; elegidaId?: string;
  error?: string; saldoAntes?: number | null; intento?: number;
  /**
   * ⚠️ ELEGIR NO ES CONFIRMAR, y hasta hoy eran lo mismo.
   *
   * Al llegar las imágenes se preselecciona la primera (`elegida`), y el paso se
   * daba por cerrado con sólo mirar ese campo. O sea: la comparación lado a lado
   * —el único motivo por el que esta pantalla existe— nunca era obligatoria, y
   * el gate que protege ~105 créditos se abría solo.
   *
   * Un paso de confirmación cuyo estado lo escribe el server al llegar el dato
   * no es un paso: es un rótulo.
   */
  confirmada?: boolean;
  errorCausa?: CausaFlow;
  errorCrudo?: string;
  errorAt?: string;
};

const imgs = (plan: PlanGuardado): Record<string, MarcaImagen> =>
  (plan.imagenes ?? {}) as Record<string, MarcaImagen>;

async function guardarImagen(item: PlanGuardado, n: number, marca: MarcaImagen): Promise<PlanGuardado> {
  const actualizado: PlanGuardado = {
    ...item,
    imagenes: { ...imgs(item), [String(n)]: { ...(imgs(item)[String(n)] ?? {}), ...marca } },
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
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
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
    return { ok: false, error: 'MaKo está subiendo tu foto a Google. En unos segundos vuelve a intentar.' };
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
    item: await guardarImagen(item, n, {
      trabajoId, intento, saldoAntes, opciones: [], elegida: '', propia: false,
      confirmada: false,
      // Los CUATRO campos del error, no sólo el texto: un `errorCrudo` que
      // sobrevive a su `error` es lo que hace que el detalle técnico plegado
      // hable de un fallo que ya no existe.
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
  if (m.opciones?.length) {
    return { ok: true, item, estado: { fase: 'listo', opciones: m.opciones, elegida: m.elegida ?? '' } };
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
  const opciones = salidas.map((i) => i.url);
  const opcionesId = salidas.map((i) => i.mediaId ?? '');
  if (!opciones.length) {
    const fallo = falloGuardable(
      'Flow aceptó el pedido y no devolvió ninguna imagen.',
      `la imagen del escenario ${n}`,
    );
    item = await guardarImagen(item, n, fallo);
    return { ok: true, item, estado: { fase: 'error', error: fallo.error } };
  }

  // La primera queda preseleccionada: la persona confirma o cambia, pero nunca
  // se queda mirando dos imágenes sin ninguna elegida — eso convierte una
  // confirmación en un trámite más.
  item = await guardarImagen(item, n, {
    opciones, elegida: opciones[0], opcionesId, elegidaId: opcionesId[0] || '',
  });
  return { ok: true, item, estado: { fase: 'listo', opciones, elegida: opciones[0] } };
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

  const sin = { ...marcas(item) };
  delete sin[String(n)];
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

  const actualizado: PlanGuardado = { ...item, fotoId };
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
