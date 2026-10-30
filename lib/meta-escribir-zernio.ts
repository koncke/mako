// =============================================================================
// meta-escribir-zernio — pausar, prender, presupuestar, renombrar y borrar en Meta por la conexión de Facebook (26/10/2026)
// =============================================================================
// Martín, 26/10: «¿Los usuarios pueden leer, crear, editar y eliminar sus campañas?». Un negocio que conectó Meta por Zernio
// (sin token) no podía escribir nada: `escribirEnMeta` (lib/meta-write.ts) pedía el token. Acá está la misma escritura por SU
// Zernio, con la misma regla de siempre: antes de tocar, se lee de qué cuenta publicitaria es el id (lo manda el navegador o
// el modelo) y, si no es la del negocio, no se escribe. Una clave de Zernio puede tener varias cuentas conectadas.
//
// Endpoints (OpenAPI v1.363.0, leída el 26/10/2026):
//   · leer de quién es: GET /ads/campaigns/{id} y /ads/ad-sets/{id} (paso directo de Meta, `fields=account_id,…`, con
//     `accountId`); GET /ads/{id}?live=true para un anuncio (el guardado por Zernio, con los interruptores releídos de Meta).
//   · estado y presupuesto: las funciones del Media Buyer (lib/zernio-ads.ts), que ya se midieron en la cuenta de MaKo.
//   · nombre: PUT /ads/campaigns/{id} · /ads/ad-sets/{id} · /ads/{id} con `name`.
//   · borrar: DELETE /ads/campaigns/{id} (con `accountId`, por si quedó vacía) · /ads/ad-sets/{id} · /ads/{id}.
// ⚠️ Trampas (docs/hallazgos-ads.md):
//   · prender o pausar una campaña que NACIÓ sin anuncios da 404 (el endpoint de estado no acepta `accountId`): no hay arreglo
//     nuestro. Una que los tuvo y quedó vacía sí se pausa (medido el 26/10/2026: Zernio la encuentra por sus anuncios guardados).
//   · pausar un anuncio BORRADO da 200 sin error: antes de escribir se mira si está borrado (`siYaEstaBorrada`).
//   · borrar el ÚLTIMO anuncio de un conjunto que creó Zernio borra también el conjunto, y la campaña si queda vacía. Con el
//     token eso no pasaba: la API lo avisa antes de confirmar.
//   · el tope de anuncios activos gratis de Zernio frena prender y subir presupuesto (`ads_allowance_exceeded`).
// =============================================================================

import 'server-only';
import { zFetch, ZernioError } from './zernio';
import { esDeLaCuenta } from './meta-cuenta-id';
import { borrarAnuncioPorZernio, borrarCampanaPorZernio, cambiarEstadoPorZernio, cambiarPresupuestoPorZernio } from './zernio-ads';
import { entidadDeZernio, falloDeEscrituraZernio, siYaEstaBorrada, type EntidadZernio, type NivelMeta } from './zernio-meta-cuerpo';
import type { CanalMeta } from './meta-via';
import type { MetaWriteBody, MetaWriteResult } from './meta-write';

type Canal = Extract<CanalMeta, { via: 'zernio' }>;

/** Los campos que se piden del paso directo de Meta para campañas y conjuntos. */
const CAMPOS_ENTIDAD = 'account_id,configured_status,effective_status';

/** Lee una campaña, un conjunto o un anuncio por Zernio: de qué cuenta es y sus dos estados, AHORA. Tira `ZernioError` o un Error. */
export async function entidadPorZernio(c: Canal, nivel: NivelMeta, id: string): Promise<EntidadZernio> {
  const q = new URLSearchParams({ accountId: c.accountId, fields: CAMPOS_ENTIDAD });
  const ruta = nivel === 'campaign' ? `/ads/campaigns/${encodeURIComponent(id)}?${q.toString()}`
    : nivel === 'adset' ? `/ads/ad-sets/${encodeURIComponent(id)}?${q.toString()}`
    : `/ads/${encodeURIComponent(id)}?live=true`;
  const e = entidadDeZernio(nivel, await zFetch<unknown>(c.clave, ruta, undefined, 30_000));
  if (!e) throw new Error('Zernio no devolvió esa entidad');
  return e;
}

/** El fallo de una llamada a Zernio con la forma de `MetaWriteResult`. */
function fallo(e: unknown, siNoEsZernio: string): MetaWriteResult {
  if (e instanceof ZernioError) return { ok: false, ...falloDeEscrituraZernio(e.status, e.body, e.message) };
  return { ok: false, message: e instanceof Error ? e.message : siNoEsZernio, status: 502 };
}

/**
 * La entidad, si es de la cuenta publicitaria del negocio; si no, la respuesta que corta (404: a quien no le corresponde, no
 * existe). Si Zernio no contesta de quién es, tampoco se escribe.
 */
async function fueraDeLaCuenta(c: Canal, nivel: NivelMeta, id: string): Promise<{ entidad: EntidadZernio } | MetaWriteResult> {
  try {
    const e = await entidadPorZernio(c, nivel, id);
    return esDeLaCuenta(e.cuenta, c.adAccountId) ? { entidad: e } : { ok: false, message: 'Eso no está en la cuenta de Meta de este negocio.', status: 404 };
  } catch (e) {
    // Meta contesta 400 por una campaña que la conexión no ve: para este negocio, no existe.
    if (e instanceof ZernioError && (e.status === 400 || e.status === 404)) return { ok: false, message: 'Eso no está en la cuenta de Meta de este negocio (o Zernio todavía no lo sincronizó: un anuncio nuevo tarda hasta una hora).', status: 404 };
    return fallo(e, 'Zernio no dejó leer de qué cuenta es');
  }
}

/**
 * Crea un formulario instantáneo en la página de la conexión (`POST /ads/lead-forms`). Un formulario no se borra (sólo se archiva):
 * no se reintenta, y una respuesta sin id se dice como «puede haberse creado» (lo dice quien llama). Tira `ZernioError`.
 */
export async function crearFormularioPorZernio(c: Canal, cuerpo: Record<string, unknown>): Promise<{ id: string | null }> {
  const r = await zFetch<{ form?: { id?: unknown; formId?: unknown } | null }>(c.clave, '/ads/lead-forms', { method: 'POST', body: JSON.stringify(cuerpo) }, 60_000);
  const id = r.form?.id ?? r.form?.formId;
  return { id: typeof id === 'string' || typeof id === 'number' ? String(id) : null };
}

async function renombrar(c: Canal, nivel: NivelMeta, id: string, nombre: string): Promise<void> {
  const ruta = nivel === 'campaign' ? `/ads/campaigns/${encodeURIComponent(id)}` : nivel === 'adset' ? `/ads/ad-sets/${encodeURIComponent(id)}` : `/ads/${encodeURIComponent(id)}`;
  // `accountId` sólo lo declara el de campañas (lo necesita una campaña vacía); `platform`, campañas y conjuntos.
  const body = nivel === 'campaign' ? { platform: 'facebook', name: nombre, accountId: c.accountId } : nivel === 'adset' ? { platform: 'facebook', name: nombre } : { name: nombre };
  await zFetch<unknown>(c.clave, ruta, { method: 'PUT', body: JSON.stringify(body) }, 60_000);
}

/**
 * La escritura de `escribirEnMeta` por la Zernio del negocio. El cuerpo ya viene validado (lib/meta-write.ts → `validar`).
 * Devuelve la misma forma que la escritura con el token; el rename a NUESTROS datos lo propaga quien llama.
 */
export async function escribirPorZernio(c: Canal, body: MetaWriteBody): Promise<MetaWriteResult> {
  const leida = await fueraDeLaCuenta(c, body.level, body.id);
  if (!('entidad' in leida)) return leida;
  const borrada = siYaEstaBorrada(leida.entidad, body.op);
  if (borrada === 'hecho') return { ok: true, id: body.id, applied: { deleted: true }, status: 200 };
  if (borrada === 'no_existe') return { ok: false, message: 'Eso ya está borrado en Meta: no se puede cambiar.', status: 404 };
  try {
    if (body.op === 'delete') {
      if (body.level === 'campaign') await borrarCampanaPorZernio(c.ws, body.id, c.accountId);
      else if (body.level === 'adset') await zFetch<unknown>(c.clave, `/ads/ad-sets/${encodeURIComponent(body.id)}`, { method: 'DELETE' }, 60_000);
      else await borrarAnuncioPorZernio(c.ws, body.id);
      return { ok: true, id: body.id, applied: { deleted: true }, status: 200 };
    }
    if (body.op === 'status') {
      await cambiarEstadoPorZernio(c.ws, body.level, body.id, body.status);
      return { ok: true, id: body.id, applied: { status: body.status }, status: 200 };
    }
    if (body.op === 'budget') {
      // En la moneda de la cuenta, en unidades: Zernio la pasa a la unidad mínima de Meta (también en las monedas sin centavos).
      const r = await cambiarPresupuestoPorZernio(c.ws, body.level, body.id, body.dailyBudgetMxn, c.accountId);
      return { ok: true, id: body.id, applied: { dailyBudgetMxn: r.monto ?? body.dailyBudgetMxn }, status: 200 };
    }
    const nombre = body.name.trim();
    await renombrar(c, body.level, body.id, nombre);
    return { ok: true, id: body.id, applied: { name: nombre }, status: 200 };
  } catch (e) {
    // Las dos trampas con texto propio: una campaña sin anuncios no se prende ni se pausa por Zernio, y una con el presupuesto en
    // sus conjuntos (ABO) no tiene presupuesto de campaña.
    if (e instanceof ZernioError && body.level === 'campaign' && body.op === 'status' && e.status === 404) {
      return { ok: false, message: 'Por la conexión de Facebook no se puede prender ni pausar una campaña sin anuncios: agrégale un anuncio, o bórrala.', status: 409 };
    }
    if (e instanceof ZernioError && body.level === 'campaign' && body.op === 'budget' && e.status === 409) {
      return { ok: false, message: 'Esta campaña reparte el presupuesto en sus conjuntos: cambia el presupuesto de cada conjunto.', status: 409 };
    }
    return fallo(e, 'Zernio rechazó la escritura');
  }
}

/**
 * Cambia el PÚBLICO de un conjunto por la Zernio del negocio (`PUT /ads/ad-sets/{id}` con `targeting` y/o `placements`, en la
 * forma de Zernio: lib/zernio-publico.ts). Zernio lee el público en vivo, mezcla SÓLO las claves que llegan y lo reescribe
 * entero; si no puede leerlo contesta 502 y no escribe nada. Antes se mira de qué cuenta es y si está borrado, como el resto.
 */
export async function publicoPorZernio(c: Canal, adSetId: string, cuerpo: { targeting?: Record<string, unknown>; placements?: Record<string, unknown> | null }): Promise<MetaWriteResult> {
  const leida = await fueraDeLaCuenta(c, 'adset', adSetId);
  if (!('entidad' in leida)) return leida;
  if (siYaEstaBorrada(leida.entidad, 'status') === 'no_existe') return { ok: false, message: 'Ese conjunto está borrado en Meta: no se puede cambiar.', status: 404 };
  try {
    await zFetch<unknown>(c.clave, `/ads/ad-sets/${encodeURIComponent(adSetId)}`, { method: 'PUT', body: JSON.stringify({ platform: 'facebook', ...cuerpo }) }, 60_000);
    return { ok: true, id: adSetId, applied: {}, status: 200 };
  } catch (e) {
    return fallo(e, 'Zernio rechazó el cambio de público');
  }
}
