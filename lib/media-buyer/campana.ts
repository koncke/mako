// =============================================================================
// Media Buyer — «Lánzame una campaña» (el servidor): preparar, crear y dejarla con su Deshacer
// =============================================================================
// La regla pura y el cuerpo están en campana-reglas.ts. Acá, lo que depende de la cuenta y de lo que puso la persona:
//   · la conexión de Zernio de la cuenta (sin ella no hay camino: con el token, Meta rechaza el creativo nuevo, 1885183);
//   · DÓNDE: los lugares, por defecto la zona del Media Buyer, y siempre DENTRO de ella;
//   · HASTA: la fecha de la campaña, por defecto la del Media Buyer y nunca después de ella; no antes de hoy;
//   · los TOPES: si sale prendida, su presupuesto suma al de la cuenta y no puede pasar el máximo por día (topes.ts);
//   · el anuncio a reusar, de ESTA cuenta.
// Lo usan la pantalla «Nueva campaña» (op `crear_campana` de /api/media-buyer) y la API de MaKo (`proponer_crear_campana`, que
// se confirma en /mako/revisar). Una puerta para las dos: AGENTS.md, «Una cosa, un lugar».
//
// ⚠️ EL REGISTRO VA ANTES DE CREAR (como subir.ts): una decisión `crear_campana` con la entidad en '0' que se completa al volver
// Zernio. Si la base no la acepta (falta la 0350), no se crea nada: una campaña que MaKo no registra no se puede deshacer.
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseServer } from '@/lib/supabase';
import { ADS_CREATIVES_BUCKET } from '@/lib/meta-ads-create';
import { crearCampanaPorZernio, creativoDeAnuncioPorZernio, leerAnuncioPorZernio, leerErrorDeZernio } from '@/lib/zernio-ads';
import { fmtDinero } from '@/lib/format';
import { leerConfig, guardarConfig, guardarPropuestas, leerDecisiones, reclamar, actualizar, type ConfigGuardada } from './store';
import { leerDatosCuenta, hoyDelNegocio, type DatosCuenta } from './datos';
import { validarCampana, cuerpoCampana, resumenCampana, type EntradaCampana } from './campana-reglas';
import { diasHasta, nombreZona, validarZona, veredictoDeLugares } from './zona';
import { resolverLugares } from './publico';

export type Preparada =
  | { ok: true; entrada: EntradaCampana; hasta: string | null; resumen: string; moneda: string | null }
  | { ok: false; error: string; faltan?: string[]; falla?: true };

/** Valida lo que llega contra la cuenta. No escribe nada. `datos`/`config`: lecturas que ya tiene quien llama. */
export async function prepararCampana(ws: number, x: Record<string, unknown>, ya: { datos?: DatosCuenta; config?: ConfigGuardada } = {}): Promise<Preparada> {
  const config = ya.config ?? await leerConfig(ws);
  const z = validarZona(x.lugares ?? []);
  if (!z.ok) return { ok: false, error: z.error };
  // Sin lugares, los de la zona del Media Buyer. Y confirmados contra Meta: lo que vale es lo que dice Meta de cada id.
  const pedidos = z.valor.length ? z.valor : config.zona;
  if (!pedidos.length) return { ok: false, error: 'Elige dónde se muestra (un país, una provincia o una ciudad).', faltan: ['lugares'] };
  const resueltos = await resolverLugares(ws, pedidos);
  if (!resueltos.ok) return { ok: false, error: resueltos.error, ...(resueltos.error.startsWith('No pude') ? { falla: true as const } : {}) };
  const lugares = resueltos.lugares;
  const v = validarCampana(x, lugares);
  if (!v.ok) return v;
  const e = v.valor;

  // DÓNDE: una campaña nueva no puede salir de la zona del Media Buyer (lo mismo que no prende ni sube fuera de ella).
  if (config.zona.length) {
    const ver = veredictoDeLugares(config.zona, e.lugares);
    if (ver.veredicto !== 'dentro') {
      return { ok: false, error: `${ver.fuera.map((l) => l.nombre).join(', ') || 'Esos lugares'} queda fuera de tu zona (${nombreZona(config.zona)}). Cámbiala en Ajustes o elige lugares adentro.` };
    }
  }

  // HASTA: la de la campaña o la del Media Buyer, nunca después de la del Media Buyer y nunca antes de hoy.
  const hasta = e.hasta ?? config.hasta;
  if (e.hasta && config.hasta && e.hasta > config.hasta) return { ok: false, error: `Tu Media Buyer trabaja hasta el ${config.hasta}: la campaña no puede terminar después.` };
  if (hasta) {
    const hoy = await hoyDelNegocio(ws);
    if (hoy && diasHasta(hoy, hasta) < 0) return { ok: false, error: `La fecha de fin (${hasta}) ya pasó.` };
  }

  let datos: DatosCuenta;
  try { datos = ya.datos ?? await leerDatosCuenta(ws); }
  catch (err) { return { ok: false, error: `No pude leer tu cuenta de Meta: ${err instanceof Error ? err.message : String(err)}`, falla: true }; }
  if (!datos.conexion) return { ok: false, error: 'Para lanzar una campaña conecta tu cuenta publicitaria por Zernio (en Ajustes del Media Buyer): con la conexión anterior, Meta rechaza los anuncios nuevos (error 1885183).' };
  if (datos.parcial) return { ok: false, error: 'Meta devolvió tu cuenta a medias: no puedo mirar tus topes. Prueba de nuevo en unos minutos.', falla: true };

  // LOS TOPES: prendida, suma su presupuesto al de la cuenta (en la unidad del gasto, como topes.ts).
  const unidad = datos.conversor.aUsdNum(e.presupuestoDia);
  if (!e.enPausa && config.presupuestoMaxDia != null) {
    if (datos.conversor.aUsd(1) == null) return { ok: false, error: `Tu cuenta cobra en ${datos.moneda ?? 'una moneda desconocida'} y MaKo no tiene su tasa: no puedo mirar tu tope por día. Créala en pausa.` };
    const total = datos.totalActivo + unidad;
    if (total > config.presupuestoMaxDia + 1e-6) {
      return { ok: false, error: `Prendida, dejaría la cuenta en ${fmtDinero(total)} por día, y tu tope es ${fmtDinero(config.presupuestoMaxDia)}. Créala en pausa o sube tu tope en Ajustes.` };
    }
  }

  const resumen = resumenCampana(e, { moneda: datos.moneda, hasta, fmt: (n) => fmtDinero(n, datos.moneda) });
  return { ok: true, entrada: e, hasta, resumen, moneda: datos.moneda };
}

/**
 * El error de una creación que NO SE SABE si salió: Zernio tardó más que el corte o contestó 5xx (su doc: «never resends on its
 * own, read it back before retrying»). Puede haber una campaña viva en Meta sin su registro: la misma campaña no se vuelve a
 * crear hasta que alguien mire la cuenta (revisión adversarial del 29/10, hallazgo 2).
 */
export const CREACION_INCIERTA = 'No sé si se creó';

export type ResultadoCampana =
  | { ok: true; campaignId: string; adSetId: string | null; adId: string; decisionId: string; resumen: string }
  | { ok: false; error: string; falla?: true };

/** Crea la campaña por la Zernio del negocio, con lo que vuelve a validar AHORA (los topes pudieron cambiar desde la propuesta). */
export async function crearCampana(ws: number, x: Record<string, unknown>, quien: string): Promise<ResultadoCampana> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { ok: false, error: 'Falta aplicar la migración del Media Buyer: sin el registro no se lanza nada (no se podría deshacer).' };
  const datos = await leerDatosCuenta(ws).catch(() => null);
  if (!datos) return { ok: false, error: 'No pude leer tu cuenta de Meta.', falla: true };
  const p = await prepararCampana(ws, x, { datos, config });
  if (!p.ok) return p;
  const e = p.entrada;
  const conexion = datos.conexion!;

  // El creativo a reusar: de esta cuenta (lo comprueba Zernio con la cuenta de la conexión), con su texto y su link.
  let reusado: { id: string; texto: string | null; link: string | null } | null = null;
  if (e.creativo.tipo === 'anuncio') {
    try {
      const c = await creativoDeAnuncioPorZernio(ws, conexion, e.creativo.adId);
      if (!c.creativoId) return { ok: false, error: 'Ese anuncio no tiene un creativo que se pueda reusar. Sube una imagen o un video.' };
      const t = await leerAnuncioPorZernio(ws, e.creativo.adId).catch(() => null);
      reusado = { id: c.creativoId, texto: t?.body ?? null, link: t?.linkUrl?.startsWith('https://') ? t.linkUrl : null };
    } catch (err) {
      const z = leerErrorDeZernio(err);
      return { ok: false, error: `No pude leer el anuncio a reusar: ${z ? z.mensaje : err instanceof Error ? err.message : String(err)}` };
    }
  }
  // Un archivo subido por la pantalla: una URL firmada por una hora, como «Subir creativos» (subir.ts). Zernio lo baja de ahí.
  let conMedia: EntradaCampana = e;
  if (e.creativo.tipo === 'archivo') {
    const { data, error } = await getSupabaseServer().storage.from(ADS_CREATIVES_BUCKET).createSignedUrl(e.creativo.path, 3600);
    if (error || !data?.signedUrl) return { ok: false, error: 'No pude leer el archivo subido: súbelo de nuevo.', falla: true };
    conMedia = { ...e, creativo: e.creativo.media === 'video' ? { tipo: 'video', url: data.signedUrl } : { tipo: 'imagen', url: data.signedUrl } };
  }
  const cuerpo = cuerpoCampana(conMedia, { conexion, hasta: p.hasta, creativoReusado: reusado });
  // La huella de lo PEDIDO (no del cuerpo: la URL firmada cambia en cada pedido y dos clics serían dos campañas).
  const huella = createHash('sha256').update(JSON.stringify({ ...e, hasta: p.hasta })).digest('hex');
  // La MISMA campaña pedida antes (48 h): ya lanzada, o con un final que no se sabe, no se crea otra vez. Cambiarle el nombre es
  // pedir otra. Lo deshecho cuenta para la clave: volver a crearla después de borrarla no puede devolver la borrada.
  const previas = (await leerDecisiones(ws, 2)).decisiones.filter((x) => x.tipo === 'crear_campana' && x.clave.startsWith(`manual:campana:${huella.slice(0, 24)}:`));
  const lanzada = previas.find((x) => x.estado === 'aplicada');
  if (lanzada) return { ok: false, error: `Esta misma campaña ya se lanzó${/^[1-9]\d*$/.test(lanzada.entidadId) ? ` (${lanzada.entidadId})` : ''}: mírala en Campañas. Para otra igual, cámbiale el nombre.` };
  if (previas.some((x) => x.estado === 'fallida' && (x.error ?? '').startsWith(CREACION_INCIERTA))) {
    return { ok: false, error: 'La vez anterior no supe si esta campaña se creó: mírala en Campañas (o en el Administrador de Meta) antes de lanzarla otra vez. Para otra igual, cámbiale el nombre.' };
  }

  // El registro ANTES de crear (ver la cabecera).
  const [d] = await guardarPropuestas(ws, [{
    clave: `manual:campana:${huella.slice(0, 24)}:${Date.now()}`,
    tipo: 'crear_campana', tactica: 'manual', nivel: 'campaign', entidadId: '0', entidadNombre: e.nombre, campanaNombre: null,
    titulo: `Lanzar la campaña «${e.nombre}»`,
    titular: `${fmtDinero(e.presupuestoDia, datos.moneda)} por día en ${e.lugares.map((l) => l.nombre).join(', ')}${p.hasta ? `, hasta el ${p.hasta.slice(8, 10)}/${p.hasta.slice(5, 7)}` : ''}`,
    porque: [`La lanzó ${quien}.`, p.resumen, 'Deshacerla la borra en Meta, con su conjunto y su anuncio.'],
    numeros: [], antes: {}, despues: { estado: e.enPausa ? 'PAUSED' : 'ACTIVE', presupuesto: e.presupuestoDia },
  }], datos.moneda).catch((err: unknown) => {
    console.error('[media-buyer/campana] no pude registrar la campaña:', err instanceof Error ? err.message : String(err));
    return [];
  });
  if (!d) return { ok: false, error: 'No pude registrar la campaña antes de crearla (¿falta la migración 0350 del Media Buyer?): no se creó nada.', falla: true };
  await reclamar(ws, d.id, ['abierta'], { estado: 'aplicada', origen: 'persona', aplicada_por: quien.slice(0, 200), aplicada_at: new Date().toISOString(), canal: 'zernio' });

  // La clave protege el REINTENTO de esta creación: con la misma clave Zernio devuelve la respuesta de la primera vez (aunque ya
  // esté borrada, o aunque haya sido un rechazo), y con otro cuerpo contesta «already used» (hallazgos-ads). Por eso lleva
  // cuántas veces se deshizo o se rechazó la misma: cada intento a sabiendas es otra clave; el reintento de un corte, no.
  const clave = `mb-campana:${ws}:${huella.slice(0, 32)}:${previas.filter((x) => x.estado === 'deshecha' || x.estado === 'fallida').length}`;
  let r: Awaited<ReturnType<typeof crearCampanaPorZernio>>;
  try {
    r = await crearCampanaPorZernio(ws, cuerpo, clave);
  } catch (err) {
    const z = leerErrorDeZernio(err);
    // La misma clave con otro cuerpo (un archivo subido se firma de nuevo en cada pedido): es esta misma campaña pedida hace un
    // momento, que pudo haberse creado. No se reintenta a ciegas: se mira la cuenta.
    const repetida = /already used/i.test(z?.mensaje ?? (err instanceof Error ? err.message : ''));
    // Un corte por tiempo o un 5xx: Zernio pudo terminarla igual. Queda marcado, y la misma no se vuelve a crear a ciegas.
    const estado = err && typeof err === 'object' ? (err as { status?: unknown; name?: unknown }) : {};
    const incierta = estado.name === 'TimeoutError' || estado.name === 'AbortError' || (typeof estado.status === 'number' && estado.status >= 500);
    const msg = repetida ? 'Esta misma campaña ya se pidió hace un momento: mírala en Campañas antes de volver a lanzarla.'
      : incierta ? `${CREACION_INCIERTA}: Zernio no contestó a tiempo. Mírala en Campañas antes de volver a lanzarla.`
        : z ? `Zernio: ${z.mensaje}${z.subcode ? ` (Meta ${z.subcode})` : ''}` : err instanceof Error ? err.message : String(err);
    await actualizar(ws, d.id, { estado: 'fallida', error: msg.slice(0, 1000), aplicada_at: null, aplicada_por: null, origen: null }).catch(() => null);
    return { ok: false, error: msg };
  }
  if (!r.campaignId) {
    await actualizar(ws, d.id, { nota: `Zernio creó el anuncio ${r.adId} pero no devolvió la campaña: revísala en Meta.`, creados: [r.adId] }).catch(() => null);
    return { ok: false, error: `Zernio creó el anuncio ${r.adId} pero no devolvió el id de la campaña: revísala en Meta.`, falla: true };
  }
  await actualizar(ws, d.id, { entidad_id: r.campaignId, creados: [r.adId, ...(r.adSetId ? [r.adSetId] : [])] });
  // Su fecha de fin, para que el Media Buyer la pause y no la suba cerca del final (si no es la misma de toda la cuenta).
  if (p.hasta && p.hasta !== config.hasta) await guardarConfig(ws, { hastaCampana: { campanaId: r.campaignId, fecha: p.hasta } }, quien).catch(() => null);
  return { ok: true, campaignId: r.campaignId, adSetId: r.adSetId, adId: r.adId, decisionId: d.id, resumen: p.resumen };
}
