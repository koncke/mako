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
import { ENDPOINTS, obj, arr, str, extraerMediaId } from '@/lib/flow-protocolo';
import {
  cuerpoClipReferencias, semillaDeToma, mediaIdDeReferencia, KEY_CARA_FLOW,
} from '@/lib/flow-clip-referencias';
import { parchesImagenEscena, imagenesDeRespuesta, semillaDeEscena } from '@/lib/flow-imagen';
import { escribirEscenas, reescribirEscena } from '@/lib/escenas';
import { puestaPorId } from '@/lib/puestas-data';
import { generarPlanAction } from './actions';
import { guionesDisponibles } from './guiones-datos';
import { causaFlow, causaDeMotivo, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { getSetting } from '@/lib/settings';
import { leerHistorial, guardarEnHistorial, type PlanGuardado } from './video-datos';
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
async function consultarUnaVez(operacion: string): Promise<void> {
  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('id')
    .eq('tipo', 'estado_clips')
    .in('estado', ['pendiente', 'tomado'])
    .limit(50);
  // Si ya hay alguna esperando, esa contesta por esta. No hace falta otra.
  if ((data ?? []).length > 0) return;
  await encolar('estado_clips', {
    path: ENDPOINTS.estadoVideo,
    body: { operations: [{ operation: { name: operacion } }] },
    operacion,
  });
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
  | { fase: 'error'; error: string };

/** Lo que se guarda por toma, dentro del plan. */
type MarcaVideo = {
  trabajoId?: number; operacion?: string; url?: string; mediaId?: string; error?: string;
  /** De quién fue la culpa. Decide qué se muestra y si hay a dónde ir. */
  errorCausa?: CausaFlow;
  /** Lo que dijo Google, tal cual. No se tira: se pliega. */
  errorCrudo?: string;
  /**
   * ⚠️ CUÁNDO pasó. Sin esto, un error guardado hace tres días se lee como si
   * acabara de ocurrir — que es exactamente lo que le pasó al dueño con un JSON
   * de un bug ya arreglado, que la pantalla devolvía para siempre.
   */
  errorAt?: string;
  /** El saldo justo ANTES de generar esta toma. La otra mitad de medir el costo. */
  saldoAntes?: number | null;
};

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
  const item = historial.find((e) => e.id === planId);
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
  if (yaHay.url || yaHay.operacion || yaHay.trabajoId) {
    return { ok: true, item };
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
      error: 'Todavía no conectaste tu navegador. Configúralo abajo, en «Prepara tu navegador».',
    };
  }
  if (puente.estado === 'marcada') {
    return {
      ok: false,
      error: 'Google marcó esta sesión y dejó de aceptar generaciones. Abajo, en «Prepara tu navegador», está qué hacer y el botón para volver a habilitarla.',
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
  const mediaId = (await getSetting(KEY_CARA_FLOW))?.trim()
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
  const { data: consultas } = await db
    .from('flow_trabajos')
    .select('estado, resultado')
    .eq('tipo', 'estado_clips')
    .eq('estado', 'listo')
    .order('id', { ascending: false })
    .limit(12);

  for (const c of consultas ?? []) {
    // Se mira la consulta ENTERA y no una ruta: la respuesta del estado tiene la
    // misma costumbre de mover los campos de lugar. Se comprueba que la operación
    // sea la nuestra buscando su nombre en cualquier parte del objeto, y recién
    // ahí se saca la URL.
    const texto = JSON.stringify(c.resultado ?? '');
    if (!texto.includes(operacion)) continue;
    // Los nombres salen del ESQUEMA del bundle de Flow, no de suponer: la respuesta
    // de estado declara `outputUri` y `encodedVideo`, y el medio terminado trae
    // `fifeUrl`. Se buscan todos, en cualquier profundidad.
    const url = buscarCampo(c.resultado, ['fifeUrl', 'outputUri', 'videoUri', 'servingUrl', 'encodedVideo', 'url']);
    if (!url) continue;
    const mediaId = extraerMediaId(c.resultado) || buscarCampo(c.resultado, ['mediaId', 'mediaGenerationId']) || operacion;
    item = await guardarMarca(item, n, { url, mediaId });
    // El clip esta listo: se pregunta el saldo, y la resta contra el de antes da
    // el costo REAL de una toma. Es el numero del que depende toda la economia
    // del plan y hasta hoy no lo teniamos medido.
    if (typeof marca.saldoAntes === 'number') {
      await encolar('creditos', { path: ENDPOINTS.creditos, body: {} });
    }
    return { ok: true, item, estado: { fase: 'listo', url, mediaId } };
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
    return { ok: false, error: 'Todavía no conectaste tu navegador. Configúralo abajo, en «Prepara tu navegador».' };
  }
  if (puente.estado === 'marcada') {
    return { ok: false, error: 'Google marcó esta sesión y dejó de aceptar generaciones. Abajo, en «Prepara tu navegador», está qué hacer.' };
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
      seed: semillaDeEscena(planId, n, intento),
      batchId: randomUUID(),
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

  const opciones = imagenesDeRespuesta(data?.resultado).map((i) => i.url);
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
  item = await guardarImagen(item, n, { opciones, elegida: opciones[0] });
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

  // Cambiar de imagen re-abre la decisión: lo que se confirmó fue la otra.
  return { ok: true, item: await guardarImagen(item, n, { elegida: url, confirmada: false }) };
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
