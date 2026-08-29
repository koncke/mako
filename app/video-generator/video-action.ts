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
  cuerpoClipReferencias, semillaDeToma, mediaIdDeReferencia,
} from '@/lib/flow-clip-referencias';
import { leerHistorial, guardarEnHistorial, type PlanGuardado } from './video-datos';

async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede generar el video.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };
  return { ok: true, ws };
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

  // ── Estado VIVO del puente, no recordado ─────────────────────────────────
  const puente = await estadoPuente().catch(() => null);
  if (!puente || puente.estado !== 'listo') {
    return {
      ok: false,
      error: 'Tu navegador no está conectado al generador. Abre Flow en la pestaña con la extensión de MaKo.',
    };
  }

  // ── La cara ──────────────────────────────────────────────────────────────
  // Sin `mediaId` no se genera: un clip sin la foto de referencia sale con una
  // persona distinta, y descubrirlo cuesta el clip entero. El error dice qué
  // hacer, no que algo falló.
  const mediaId = mediaIdDeReferencia(String(puente.detalle ?? ''));
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
    if (estado === 'error') {
      item = await guardarMarca(item, n, { error: str(data?.error) || 'Flow rechazó el pedido.' });
      return { ok: true, item, estado: { fase: 'error', error: str(data?.error) || 'Flow rechazó el pedido.' } };
    }
    if (estado !== 'listo') {
      return { ok: true, item, estado: { fase: 'encolado', trabajoId: marca.trabajoId } };
    }

    // El nombre de la operación viene adentro de `operations[0].operation.name`.
    const op = arr(obj(data?.resultado).operations)[0];
    const nombre = str(obj(obj(op).operation).name) || str(obj(op).name);
    if (!nombre) {
      const e = 'Flow aceptó el pedido pero no devolvió una operación.';
      item = await guardarMarca(item, n, { error: e });
      return { ok: true, item, estado: { fase: 'error', error: e } };
    }
    item = await guardarMarca(item, n, { operacion: nombre });
    // Y se pide el primer estado en la misma pasada: el clip tarda de todos
    // modos, no hay razón para esperar un tick más para empezar a preguntar.
    await encolar('estado_clips', {
      path: ENDPOINTS.estadoVideo,
      body: { operations: [{ operation: { name: nombre } }] },
      operacion: nombre,
    });
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
    for (const it of arr(obj(c.resultado).operations)) {
      const op = obj(obj(it).operation);
      if (str(op.name) !== operacion) continue;
      const video = obj(obj(op.metadata).video);
      const mediaId = extraerMediaId(video);
      const url = str(video.fifeUrl) || str(video.videoUri);
      if (mediaId && url) {
        item = await guardarMarca(item, n, { url, mediaId });
        return { ok: true, item, estado: { fase: 'listo', url, mediaId } };
      }
    }
  }

  // Todavía no. Se vuelve a preguntar — una operación sin video NO falló.
  await encolar('estado_clips', {
    path: ENDPOINTS.estadoVideo,
    body: { operations: [{ operation: { name: operacion } }] },
    operacion,
  });
  return { ok: true, item, estado: { fase: 'generando', operacion } };
}
