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
import { getSetting } from '@/lib/settings';
import { leerHistorial, guardarEnHistorial, type PlanGuardado } from './video-datos';

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
type MarcaVideo = { trabajoId?: number; operacion?: string; url?: string; mediaId?: string; error?: string };

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

  const trabajoId = await encolar('generar_clip', {
    path: ENDPOINTS.clipDesdeReferencias,
    body: cuerpoClipReferencias(
      { prompt: clip.prompt, mediaId, seed: semillaDeToma(planId, n) },
      randomUUID(),
    ),
  });
  if (trabajoId == null) return { ok: false, error: 'No se pudo encolar el trabajo.' };

  return { ok: true, item: await guardarMarca(item, n, { trabajoId, operacion: '', url: '', error: '' }) };
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
      .select('estado, resultado, error')
      .eq('id', marca.trabajoId)
      .maybeSingle();

    const estado = str(data?.estado);
    // ⚠️ `fallido`, que es lo que escribe la cola (lib/flow-cola.ts). Con `error`
    // —el nombre que uno supone— un trabajo caído se leía como «todavía no
    // terminó» y la pantalla giraba para siempre. El dueño lo vio antes que
    // nosotros: «se quedó pensando eternamente».
    if (estado === 'fallido') {
      item = await guardarMarca(item, n, { error: str(data?.error) || 'Flow rechazó el pedido.' });
      return { ok: true, item, estado: { fase: 'error', error: str(data?.error) || 'Flow rechazó el pedido.' } };
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
    return { ok: true, item, estado: { fase: 'listo', url, mediaId } };
  }

  // Todavía no. Se vuelve a preguntar — una operación sin video NO falló.
  await consultarUnaVez(operacion);
  return { ok: true, item, estado: { fase: 'generando', operacion } };
}
