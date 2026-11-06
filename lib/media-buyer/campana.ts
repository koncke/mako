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
import { runWithWorkspace } from '@/lib/workspace';
import { ADS_CREATIVES_BUCKET, listLeadForms, listPixels } from '@/lib/meta-ads-create';
import { cambiarEstadoPorZernio, campanaMetaPorZernio, conjuntoMetaPorZernio, crearCampanaPorZernio, creativoDeAnuncioPorZernio, leerAnuncioPorZernio, leerErrorDeZernio } from '@/lib/zernio-ads';
import { lugaresDesdeMeta } from '@/lib/meta-geo';
import { fmtDinero } from '@/lib/format';
import { leerConfig, guardarConfig, guardarPropuestas, leerDecisiones, reclamar, actualizar, type ConfigGuardada } from './store';
import { leerDatosCuenta, hoyDelNegocio, type DatosCuenta } from './datos';
import { validarCampana, cuerpoCampana, diferenciasDeLaCreada, resumenCampana, type EntradaCampana } from './campana-reglas';
import { diasHasta, nombreZona, validarZona, veredictoDeLugares, type LugarZona } from './zona';
import { resolverLugares } from './publico';

/**
 * Lo que pide «Nueva campaña» para armarse: de la cuenta (formularios, píxeles, anuncios para reusar) y del Media Buyer (la
 * zona, la fecha y el tope). Cada lista que no se pudo leer viene vacía con su aviso: no frena la pantalla. La usan la pantalla
 * del Media Buyer (/api/media-buyer → nueva_preparar) y «Usar en un anuncio» de los editores (/api/anuncio-desde-pieza).
 */
export async function datosParaNuevaCampana(ws: number) {
  const config = await leerConfig(ws);
  const datos = await leerDatosCuenta(ws);
  const avisos: string[] = [];
  const [formularios, pixeles] = await Promise.all([
    runWithWorkspace(ws, () => listLeadForms()).catch((e) => { avisos.push(`No pude leer tus formularios: ${e instanceof Error ? e.message : String(e)}`); return []; }),
    runWithWorkspace(ws, () => listPixels()).catch((e) => { avisos.push(`No pude leer tus píxeles: ${e instanceof Error ? e.message : String(e)}`); return []; }),
  ]);
  const porId = new Map(datos.arbol.map((n) => [n.id, n] as const));
  const anuncios = datos.arbol.filter((n) => n.nivel === 'ad' && n.configurado !== 'DELETED').slice(0, 200).map((n) => {
    const conj = n.parentId ? porId.get(n.parentId) : undefined;
    return { id: n.id, nombre: n.nombre, campana: conj?.parentId ? porId.get(conj.parentId)?.nombre ?? null : null, prendido: n.configurado === 'ACTIVE' };
  });
  return {
    conectado: !!datos.conexion, moneda: datos.moneda, zona: config.zona, hasta: config.hasta,
    presupuestoMaxDia: config.presupuestoMaxDia, totalActivo: datos.totalActivo, formularios, pixeles, anuncios, avisos,
  };
}

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
  /** : lo que la relectura vio distinto de lo pedido, o una fecha que no se pudo guardar. La campaña existe igual. */
  | { ok: true; campaignId: string; adSetId: string | null; adId: string; decisionId: string; resumen: string; avisos: string[] }
  | { ok: false; error: string; falla?: true };

/** Crea la campaña por la Zernio del negocio, con lo que vuelve a validar AHORA (los topes pudieron cambiar desde la propuesta). */
/** El techo de la ruta y de /mako/revisar es de 300 s: la creación se cuida ANTES, con un margen para el registro y la relectura. */
const TECHO_MS = 270_000;
/** Lo mínimo que tiene que quedar para empezar a crear (Zernio crea los tres niveles y sube la imagen). */
const CREAR_MIN_MS = 60_000;
/** Lo que se reserva después del POST: guardar los ids, la fecha y releer lo creado. */
const RESERVA_MS = 40_000;

export async function crearCampana(ws: number, x: Record<string, unknown>, quien: string): Promise<ResultadoCampana> {
  const t0 = Date.now();
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
  // pedir otra. Lo deshecho y lo rechazado cuentan para el intento: volver a crearla después de borrarla no puede devolver la
  // borrada.
  const previas = (await leerDecisiones(ws, 2)).decisiones.filter((x) => x.tipo === 'crear_campana' && x.clave.startsWith(`manual:campana:${huella.slice(0, 24)}:`));
  const incierta = (x: (typeof previas)[number]) => (x.error ?? '').startsWith(CREACION_INCIERTA) || (x.estado === 'aplicada' && !/^[1-9]\d*$/.test(x.entidadId));
  if (previas.some(incierta)) {
    return { ok: false, error: 'La vez anterior no supe si esta campaña se creó: mírala en Campañas (o en el Administrador de Meta) antes de lanzarla otra vez. Para otra igual, cámbiale el nombre.' };
  }
  const lanzada = previas.find((x) => x.estado === 'aplicada');
  if (lanzada) return { ok: false, error: `Esta misma campaña ya se lanzó (${lanzada.entidadId}): mírala en Campañas. Para otra igual, cámbiale el nombre.` };
  // El intento de HOY (el día va en la clave: una fila de otro día no choca con un pedido nuevo). Cuenta TODAS las de hoy, en el
  // estado que estén: cada intento a sabiendas es otra clave.
  const dia = new Date().toISOString().slice(0, 10);
  const intento = `${dia}:${previas.filter((x) => x.clave.startsWith(`manual:campana:${huella.slice(0, 24)}:${dia}:`)).length}`;

  // EL TECHO PROPIO (revisión de Integración, M5): la ruta y /mako/revisar mueren a los 300 s. Si las lecturas de antes se comieron
  // el tiempo, no se empieza a crear (un corte a mitad del POST deja una campaña que quizá existe); si se empieza, el corte propio
  // llega antes que el de la plataforma, y entonces sí hay un `catch` que marca «no sé».
  const queda = TECHO_MS - (Date.now() - t0);
  if (queda < CREAR_MIN_MS) return { ok: false, error: 'Tardé demasiado leyendo tu cuenta y no llegaba a crearla: no se creó nada. Prueba de nuevo.', falla: true };

  // El registro ANTES de crear (ver la cabecera). ⚠️ La clave es FIJA por intento (sin la hora): dos pedidos iguales a la vez
  // chocan en `unique(workspace_id, clave)` y el segundo no crea nada (M6). Y nace marcada «no sé si se creó»: si la función
  // muere en medio, eso es lo que queda (M5); al volver Zernio se borra la marca.
  const filas = await guardarPropuestas(ws, [{
    clave: `manual:campana:${huella.slice(0, 24)}:${intento}`,
    tipo: 'crear_campana', tactica: 'manual', nivel: 'campaign', entidadId: '0', entidadNombre: e.nombre, campanaNombre: null,
    titulo: `Crear la campaña «${e.nombre}»`,
    titular: `${fmtDinero(e.presupuestoDia, datos.moneda)} por día en ${e.lugares.map((l) => l.nombre).join(', ')}${p.hasta ? `, hasta el ${p.hasta.slice(8, 10)}/${p.hasta.slice(5, 7)}` : ''}`,
    porque: [`La creó ${quien}.`, p.resumen, 'Deshacerla la borra en Meta, con su conjunto y su anuncio.'],
    numeros: [], antes: {}, despues: { estado: e.enPausa ? 'PAUSED' : 'ACTIVE', presupuesto: e.presupuestoDia },
  }], datos.moneda).then((xs) => ({ xs }), (err: unknown) => {
    console.error('[media-buyer/campana] no pude registrar la campaña:', err instanceof Error ? err.message : String(err));
    return { xs: null };
  });
  if (!filas.xs) return { ok: false, error: 'No pude registrar la campaña antes de crearla: no se creó nada. Prueba de nuevo en un momento.', falla: true };
  const d = filas.xs[0];
  if (!d) return { ok: false, error: 'Esta misma campaña se está creando ahora mismo (en otra pestaña o en /mako/revisar): espera a que termine y mírala en Campañas.' };
  await reclamar(ws, d.id, ['abierta'], {
    estado: 'aplicada', origen: 'persona', aplicada_por: quien.slice(0, 200), aplicada_at: new Date().toISOString(), canal: 'zernio',
    error: `${CREACION_INCIERTA}: la creación empezó y no terminó. Mírala en Campañas.`,
  });

  // La clave de Zernio protege el REINTENTO de esta creación: con la misma clave devuelve la respuesta de la primera vez (aunque ya
  // esté borrada, o aunque haya sido un rechazo), y con otro cuerpo contesta «already used» (hallazgos-ads). Por eso lleva el
  // intento: cada intento a sabiendas es otra clave; el reintento de un corte, no.
  const clave = `mb-campana:${ws}:${huella.slice(0, 32)}:${intento}`;
  let r: Awaited<ReturnType<typeof crearCampanaPorZernio>>;
  try {
    r = await crearCampanaPorZernio(ws, cuerpo, clave, Math.min(180_000, queda - RESERVA_MS));
  } catch (err) {
    const z = leerErrorDeZernio(err);
    // La misma clave con otro cuerpo (un archivo subido se firma de nuevo en cada pedido): es esta misma campaña pedida hace un
    // momento, que pudo haberse creado. No se reintenta a ciegas: se mira la cuenta.
    const repetida = /already used/i.test(z?.mensaje ?? (err instanceof Error ? err.message : ''));
    // Un corte por tiempo o un 5xx: Zernio pudo terminarla igual. Queda marcado, y la misma no se vuelve a crear a ciegas.
    const estado = err && typeof err === 'object' ? (err as { status?: unknown; name?: unknown }) : {};
    const noSe = estado.name === 'TimeoutError' || estado.name === 'AbortError' || (typeof estado.status === 'number' && estado.status >= 500);
    const msg = repetida ? 'Esta misma campaña ya se pidió hace un momento: mírala en Campañas antes de volver a lanzarla.'
      : noSe ? `${CREACION_INCIERTA}: Zernio no contestó a tiempo. Mírala en Campañas antes de volver a lanzarla.`
        : z ? `Zernio: ${z.mensaje}${z.subcode ? ` (Meta ${z.subcode})` : ''}` : err instanceof Error ? err.message : String(err);
    await actualizar(ws, d.id, { estado: 'fallida', error: msg.slice(0, 1000), aplicada_at: null, aplicada_por: null, origen: null }).catch(() => null);
    return { ok: false, error: msg };
  }
  if (!r.campaignId) {
    await actualizar(ws, d.id, { nota: `Zernio creó el anuncio ${r.adId} pero no devolvió la campaña: revísala en Meta.`, creados: [r.adId] }).catch(() => null);
    return { ok: false, error: `Zernio creó el anuncio ${r.adId} pero no devolvió el id de la campaña: revísala en Meta.`, falla: true };
  }
  await actualizar(ws, d.id, { entidad_id: r.campaignId, creados: [r.adId, ...(r.adSetId ? [r.adSetId] : [])], error: null });

  const avisos: string[] = [];
  // Su fecha de fin, para que MaKo la pause pasada la fecha (también con el Media Buyer apagado: vigia.ts). Si no se guarda, se DICE
  // (revisión de Integración, M1): Meta puede no cortarla sola, y nadie más la cuidaría.
  if (p.hasta && p.hasta !== config.hasta) {
    try { await guardarConfig(ws, { hastaCampana: { campanaId: r.campaignId, fecha: p.hasta } }, quien); }
    catch (err) { avisos.push(`No pude guardar su fecha de fin en MaKo (${err instanceof Error ? err.message : String(err)}): ponla en su hoja de Campañas.`); }
  }
  // LA RELECTURA (M2): lo que Meta guardó, contra lo pedido. El cuerpo de `POST /ads/create` no se midió todavía: si Zernio
  // descartó una clave sin error, se ve acá y no cuando ya gastó.
  if (r.adSetId) avisos.push(...(await releerCreada(ws, conexion, { campaignId: r.campaignId, adSetId: r.adSetId }, { lugares: e.lugares, hasta: p.hasta, zona: config.zona, enPausa: e.enPausa })));
  else avisos.push('Zernio no devolvió el conjunto: no pude revisar lo que guardó Meta. Míralo en el Administrador antes de prenderla.');
  if (avisos.length) await actualizar(ws, d.id, { nota: avisos.join(' · ').slice(0, 1000) }).catch(() => null);
  return { ok: true, campaignId: r.campaignId, adSetId: r.adSetId, adId: r.adId, decisionId: d.id, resumen: p.resumen, avisos };
}

/**
 * La campaña recién creada, leída en vivo, contra lo que se pidió: su interruptor (pedida en pausa, si quedó PRENDIDA se pausa en
 * el acto: `status: PAUSED` se midió, los de nivel no), y del conjunto los lugares (cada uno pedido tiene que estar, y nada fuera
 * de la zona) y la fecha de fin (`end_time`). Devuelve lo que no coincide, en palabras: lo DICE para que la persona no la prenda
 * a ciegas (revisión de Integración, M2).
 */
async function releerCreada(ws: number, conexion: NonNullable<DatosCuenta['conexion']>, ids: { campaignId: string; adSetId: string }, pedido: { lugares: readonly LugarZona[]; hasta: string | null; zona: readonly LugarZona[]; enPausa: boolean }): Promise<string[]> {
  const out: string[] = [];
  if (pedido.enPausa) {
    const c = await campanaMetaPorZernio(ws, conexion, ids.campaignId, 'configured_status').catch(() => null);
    const sw = typeof c?.configured_status === 'string' ? c.configured_status.toUpperCase() : null;
    if (sw === 'ACTIVE') {
      const pausada = await cambiarEstadoPorZernio(ws, 'campaign', ids.campaignId, 'PAUSED').then(() => true, () => false);
      out.push(pausada ? 'Meta la había dejado PRENDIDA aunque se pidió en pausa: MaKo la pausó.' : '⚠️ Meta la dejó PRENDIDA aunque se pidió en pausa, y no pude pausarla: páusala ya en el Administrador.');
    } else if (!sw) out.push('No pude confirmar que la campaña quedó en pausa: míralo en el Administrador.');
  }
  let o: Record<string, unknown>;
  try { o = await conjuntoMetaPorZernio(ws, conexion, ids.adSetId, 'targeting,end_time'); }
  catch (err) { return [...out, `No pude releer lo que guardó Meta (${err instanceof Error ? err.message : String(err)}): míralo en el Administrador antes de prenderla.`]; }
  const t = (o.targeting && typeof o.targeting === 'object' ? o.targeting : {}) as Record<string, unknown>;
  const lec = lugaresDesdeMeta(t.geo_locations, t.excluded_geo_locations);
  return [...out, ...diferenciasDeLaCreada(pedido, { lugares: lec.lugares, noEntiendo: lec.noEntiendo, finMeta: typeof o.end_time === 'string' && o.end_time ? o.end_time : null })];
}
