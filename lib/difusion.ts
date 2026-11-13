// =============================================================================
// difusion — preparar y crear una DIFUSIÓN desde el CRM (server-only; las reglas, en lib/difusion-reglas.ts)
// =============================================================================
// Una difusión es una AUTOMATIZACIÓN de una sola vez (la regla «Mensaje = automatización»): `crearDifusion` crea la fila (A
// mano, sin cohorte: sólo entran los que se inscriben acá), le pone el flujo de un hilo por canal (`pasosDeDifusion`), el
// goteo y el tope del día de ESTA automatización (la config de «Todos los canales», lib/config-automatizacion.ts), la prende
// y la inscribe a los elegidos. El motor la manda como a cualquier otra, con el goteo y los topes de la línea, y queda en
// Automations con sus métricas.
//
// ⚠️ LA INSCRIPCIÓN EN LOTE ES ACÁ Y SÓLO ACÁ (la barra de lote del CRM la dejó afuera a propósito: «necesita su pantalla con el
// ritmo a la vista», app/crm/AccionesLoteLeads.tsx). La hoja muestra el goteo antes de confirmar; la API de MaKo también lo
// dice en la propuesta. Una tanda por vez, sin pisar: el mismo pedido otra vez retoma ESTA automatización y suma a los que faltan.
// =============================================================================
import 'server-only';
import { createHash } from 'node:crypto';
import { getTenantDb } from './workspace';
import {
  alcanceDeMotivos, motivosDe, problemaDeDifusion, pasosDeDifusion, nombreDeDifusion, goteoValido, TOPE_DIFUSION, esCanalDifusion,
  claveDeDifusion, leerMarcaDifusion, decidirRepetida, GOTEO_DIFUSION_INICIAL, PREFIJO_CLAVE_DIFUSION, ESTADOS_DIFUSION_EN_CURSO,
  MIN_DIFUSION_ANTES_DE_PAUSAR, problemaDeSiContesta, conSiContesta, siContestaDeLosPasos,
  type LeadDifusion, type MotivosDelLead, type Alcance, type CanalDifusion, type MensajesDifusion, type GoteoDifusion, type SiContestaDifusion,
} from './difusion-reglas';
import { getSettingEstricto, cambiarSettingSi, borrarSettingSi } from './settings';
import { conversacionDeFila } from './canal-social';
import { TRIGGER_ETAPA } from './nutricion-etapa';
import { RANGOS_GOTEO } from './config-automatizacion';

/** Los elegidos en el tablero, o la columna entera (se resuelve acá: el tablero puede no tener todas las tarjetas cargadas). */
export type SeleccionDifusion = { leadIds: number[] } | { funnelId: number | null; etapa: string };

export type VistaDifusion = {
  /** De dónde salen, para el nombre: la etapa de la columna, o null (tildados). */
  etapa: string | null;
  alcance: Alcance;
  /** Hay más de `TOPE_DIFUSION`: se cortó (se dice). */
  cortado: boolean;
  /** WhatsApp por QR conectado: sin él, el canal no se ofrece (el oficial hoy no manda). */
  whatsappQr: boolean;
  /** Hasta cuántos WhatsApp por día deja la línea: un goteo más alto no llega. null = no se pudo leer. */
  lineaWaDia: number | null;
  /** Por dónde le llega a cada uno (para recalcular en la hoja al cambiar de canal). SIN sus datos de contacto. */
  porLead: MotivosDelLead[];
};

const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const enTandas = <T,>(xs: readonly T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/** Los ids de la selección, con su tope. */
async function idsDe(sel: SeleccionDifusion): Promise<{ ids: number[]; etapa: string | null; cortado: boolean }> {
  let ids: number[];
  let etapa: string | null = null;
  if ('leadIds' in sel) ids = [...new Set(sel.leadIds.filter(idValido))];
  else {
    etapa = String(sel.etapa ?? '').trim() || null;
    if (!etapa) return { ids: [], etapa: null, cortado: false };
    // La MISMA cohorte que el CRON de etapa, sin la ventana de 90 días: los que ESTÁN hoy en la columna (sólo abiertos).
    const { leadsDeCohorte } = await import('./nutricion');
    ids = await leadsDeCohorte(TRIGGER_ETAPA, etapa, sel.funnelId ?? null, null, null, { sinVentana: true });
  }
  return { ids: ids.slice(0, TOPE_DIFUSION), etapa, cortado: ids.length > TOPE_DIFUSION };
}

/**
 * Lo que se lee de cada lead (sus datos de contacto y su conversación de Instagram), en tandas. Las conversaciones, POR EL
 * CANAL (`conversacionesDeLeads`, lib/canal-zernio.ts: Instagram se cablea sólo por ahí, tests/sin-instagram).
 */
async function leadsDe(ids: readonly number[]): Promise<LeadDifusion[]> {
  const db = await getTenantDb();
  const { conversacionesDeLeads } = await import('./canal-zernio');
  const convs = await conversacionesDeLeads(ids);
  const out: LeadDifusion[] = [];
  for (const tanda of enTandas(ids, 200)) {
    const leads = await db.from('leads').select('id, nombre, telefono, email, email_opt_out').in('id', tanda);
    if (leads.error) throw new Error(`difusión (leads): ${leads.error.message}`);
    for (const l of (leads.data ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null; email: string | null; email_opt_out: boolean | null }>) {
      const conv = convs.get(Number(l.id))?.instagram;
      out.push({ id: Number(l.id), nombre: l.nombre, telefono: l.telefono, email: l.email, emailBaja: l.email_opt_out === true, instagram: conv ? conversacionDeFila(conv) : null });
    }
  }
  return out;
}

/** ¿El negocio tiene una línea de WhatsApp por QR conectada? (lo que el motor usa para mandar: `lineasParaMandar`). */
async function hayWhatsAppQr(ws: number): Promise<boolean> {
  const { lineasParaMandar } = await import('./evolution');
  const { lineas } = await lineasParaMandar(ws).catch(() => ({ lineas: [] as Array<{ estado?: string | null }> }));
  return lineas.some((l) => String(l.estado ?? '').toLowerCase() === 'conectado');
}

/**
 * LO QUE LA HOJA MUESTRA ANTES DE MANDAR: a cuántos les llega por cada canal y quién queda afuera. No escribe nada. Con el
 * `goteo`, Instagram cuenta sólo a los que alcanza antes de que se les cierre la ventana (`alcanceDeMotivos`).
 */
export async function prepararDifusion(
  ws: number, sel: SeleccionDifusion, canales: readonly CanalDifusion[] = ['whatsapp', 'email', 'instagram'],
  goteo: GoteoDifusion = GOTEO_DIFUSION_INICIAL,
): Promise<VistaDifusion> {
  const { ids, etapa, cortado } = await idsDe(sel);
  const { limitesDeEnvio } = await import('./nutricion');
  const [leads, whatsappQr, limites] = await Promise.all([leadsDe(ids), hayWhatsAppQr(ws), limitesDeEnvio().catch(() => 'ilegible' as const)]);
  const usables = canales.filter((c) => c !== 'whatsapp' || whatsappQr);
  const ahora = Date.now();
  const porLead = leads.map((l) => motivosDe(l, ahora));
  return { etapa, cortado, whatsappQr, lineaWaDia: limites === 'ilegible' ? null : limites.wa.dia, alcance: alcanceDeMotivos(porLead, usables, { goteo, ahoraMs: ahora }), porLead };
}

export type PedidoDifusion = {
  seleccion: SeleccionDifusion;
  canales: CanalDifusion[];
  mensajes: MensajesDifusion;
  goteo: GoteoDifusion;
  /** Lo que les sale a los que CONTESTAN (`conSiContesta`, lib/difusion-reglas.ts). Sólo por WhatsApp. */
  siContesta?: SiContestaDifusion | null;
  /** Quién la mandó (el historial de la automatización y del lead). */
  autor: string;
};

export type ResultadoDifusion =
  | {
    ok: true; secuenciaId: number; nombre: string; leads: number; alcance: Alcance;
    /** Era el MISMO pedido y retomó la difusión que ya había creado: cuántos ya estaban (los de `leads` menos los sumados). */
    yaEstaban?: number;
  }
  | { ok: false; error: string };

/** La marca del pedido en app_settings (`claveDeDifusion`, hasheada: el pedido entero no es una clave). */
const keyDeDifusion = (clave: string): string => `difusion.pedido:${createHash('sha1').update(clave).digest('base64url').slice(0, 16)}`;

const EN_CURSO = 'Esta misma difusión se está creando ahora (en otra pestaña o con MaKo): espera un minuto y mírala en Automations.';

/**
 * INSCRIBE a los que faltan en la difusión, en tandas: todas vencidas ahora; el goteo de ESTA automatización las ordena (de a
 * una cada N minutos, con su tope por día) y el anti-ban de la línea también. Sin pisar (`unique (lead_id, secuencia_id)`): el
 * que ya está en ESTA difusión no entra dos veces, y `nuevos` cuenta sólo los que entraron ahora.
 */
async function inscribirEnDifusion(secuenciaId: number, ids: readonly number[]): Promise<{ nuevos: number; error: string | null }> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  let nuevos = 0;
  for (const tanda of enTandas(ids, 200)) {
    const { data, error } = await db.from('nutricion_inscripciones').upsert(
      tanda.map((leadId) => ({ lead_id: leadId, secuencia_id: secuenciaId, paso_actual: 0, estado: 'activa', proximo_envio_at: ahora })),
      { onConflict: 'lead_id,secuencia_id', ignoreDuplicates: true },
    ).select('id');
    if (error) return { nuevos, error: error.message };
    nuevos += (data ?? []).length;
  }
  return { nuevos, error: null };
}

/**
 * EL MISMO PEDIDO OTRA VEZ: retoma la difusión que creó y suma sólo a los que faltan (los de una tanda que falló, o los que
 * llegaron a la columna después). null = esa automatización ya no está (la borraron o la archivaron): el pedido va como nuevo.
 * ⚠️ Y SI ESTÁ PAUSADA, LA PRENDE (la reverificación de Integración, 29/10/2026): la corrida de la hora pausa la que terminó
 * (`pausarDifusionesTerminadas`), y el mismo pedido decía «préndela ahí», pero prenderla no sumaba a los que faltaban. Pedirla
 * de nuevo ES pedir que salga: se prende por la puerta de siempre (`setSecuenciaActiva`: el tope del plan, el medio conectado)
 * y SIN `aunqueDuplique`: mientras estuvo pausada la pudieron editar en Automations, así que pasa por la misma pregunta de la
 * duplicada que «Activar» (una difusión sin tocar no choca con nadie y se prende igual).
 */
async function retomarDifusion(ws: number, secuenciaId: number, vista: VistaDifusion, autor: string): Promise<ResultadoDifusion | null> {
  const db = await getTenantDb();
  const { data: sec, error } = await db.from('nutricion_secuencias').select('id, nombre, activa, archivada_at').eq('id', secuenciaId).maybeSingle();
  if (error) return { ok: false, error: `No pude leer la difusión que ya se había creado (${error.message}). Vuelve a intentarlo.` };
  const fila = sec as { id: number; nombre: string; activa: boolean | null; archivada_at: string | null } | null;
  if (!fila || fila.archivada_at) return null;
  if (!fila.activa) {
    const { setSecuenciaActiva, DuplicadaError } = await import('./nutricion');
    try {
      await setSecuenciaActiva(fila.id, true, { ws });
    } catch (e) {
      if (e instanceof DuplicadaError) return { ok: false, error: `Esta misma difusión ya está creada, «${fila.nombre}», y está pausada. ${e.message} Si igual quieres que salga, préndela en Automations y vuelve a mandarla.` };
      return { ok: false, error: `Esta misma difusión ya está creada, «${fila.nombre}», y no la pude volver a prender: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const r = await inscribirEnDifusion(fila.id, vista.alcance.ids);
  if (r.error) return { ok: false, error: `Esta misma difusión ya estaba, «${fila.nombre}», y no pude sumar a los que faltaban (${r.error}). Vuelve a intentarlo.` };
  console.log(`[difusion] «${fila.nombre}» (#${fila.id}) era el mismo pedido: sumé ${r.nuevos}, ya estaban ${vista.alcance.ids.length - r.nuevos} — ${autor}`);
  return { ok: true, secuenciaId: fila.id, nombre: fila.nombre, leads: vista.alcance.ids.length, alcance: vista.alcance, yaEstaban: vista.alcance.ids.length - r.nuevos };
}

/**
 * CREA LA DIFUSIÓN Y LA MANDA (con su goteo). Vuelve a leer a quién le llega (no confía en lo que vio la hoja), crea la
 * automatización, la prende e inscribe. Lo que falla ANTES de inscribir borra la fila nueva (como Crear con IA): no queda una
 * automatización a medias con el nombre de la difusión.
 *
 * ⚠️ UNA VEZ POR PEDIDO (la verificación del Cerebro sobre 69b49a31c): la marca del pedido se reclama con compare-and-set ANTES
 * de crear nada; el mismo pedido otra vez retoma la difusión que ya creó (`retomarDifusion`) en vez de crear otra.
 */
export async function crearDifusion(ws: number, p: PedidoDifusion): Promise<ResultadoDifusion> {
  const canales = [...new Set(p.canales.filter(esCanalDifusion))];
  const goteo = goteoValido(p.goteo);
  if (!goteo) return { ok: false, error: `El goteo va de ${RANGOS_GOTEO.minutos[0]} a ${RANGOS_GOTEO.minutos[1]} minutos y de ${RANGOS_GOTEO.dia[0]} a ${RANGOS_GOTEO.dia[1]} por día.` };
  const vista = await prepararDifusion(ws, p.seleccion, canales, goteo);
  if (canales.includes('whatsapp') && !vista.whatsappQr) return { ok: false, error: 'No hay un WhatsApp por QR conectado: conéctalo o saca WhatsApp de la difusión.' };
  const falta = problemaDeDifusion({ canales, mensajes: p.mensajes, alcance: vista.alcance }) ?? problemaDeSiContesta(canales, p.siContesta ?? null);
  if (falta) return { ok: false, error: `${falta}.` };

  // EL MISMO PEDIDO: si no se puede leer la marca, no se manda (mandar dos veces es peor que pedir que lo intente de nuevo).
  const key = keyDeDifusion(claveDeDifusion({ seleccion: p.seleccion, canales, mensajes: p.mensajes, goteo, siContesta: p.siContesta ?? null }));
  const previo = await getSettingEstricto(key);
  const repetida = decidirRepetida(leerMarcaDifusion(previo), Date.now());
  if (repetida.es === 'en_curso') return { ok: false, error: EN_CURSO };
  if (repetida.es === 'retomar') {
    const r = await retomarDifusion(ws, repetida.secuenciaId, vista, p.autor);
    if (r) return r;
  }
  const reclamo = JSON.stringify({ at: new Date().toISOString(), secuenciaId: null });
  if (!(await cambiarSettingSi(key, previo, reclamo))) return { ok: false, error: EN_CURSO };

  const { crearSecuenciaVacia } = await import('./setting-secuencias');
  const { setSecuenciaPasos, setSecuenciaActiva, setSecuenciaReentrada } = await import('./nutricion');
  const { guardarConfigAutomatizacion } = await import('./config-automatizacion-db');
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(new Date());
  const nombre = nombreDeDifusion({ etapa: vista.etapa, leads: vista.alcance.llegan, fecha });
  const fila = await crearSecuenciaVacia(nombre, { prefijoClave: PREFIJO_CLAVE_DIFUSION });
  const db = await getTenantDb();
  try {
    await setSecuenciaPasos(fila.id, pasosDeDifusion(canales, p.mensajes, p.siContesta ?? null) as Parameters<typeof setSecuenciaPasos>[1]);
    const cfg = await guardarConfigAutomatizacion(fila.id, { goteo });
    if (!cfg.ok) throw new Error(cfg.error);
    await setSecuenciaReentrada(fila.id, 'una_vez');
    // Activar pasa por las mismas puertas que «Activar» (el tope del plan, el medio conectado). `aunqueDuplique`: una
    // difusión es A mano y no le escribe a nadie más que a los que se inscriben acá.
    await setSecuenciaActiva(fila.id, true, { aunqueDuplique: true, ws });
  } catch (e) {
    await db.from('nutricion_secuencias').delete().eq('id', fila.id).then(({ error }) => {
      if (error) console.error(`[difusion] no pude borrar la automatización ${fila.id} que quedó a medias: ${error.message}`);
    });
    // No se creó nada: el pedido queda libre para intentarlo de nuevo.
    await borrarSettingSi(key, reclamo).catch((err) => console.error(`[difusion] no pude soltar la marca del pedido: ${err instanceof Error ? err.message : String(err)}`));
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  // La marca apunta a ESTA automatización: el mismo pedido otra vez la retoma. Si no se pudiera escribir, la marca «se está
  // creando» vence en `ESPERA_DIFUSION_EN_CURSO_MIN` y un pedido igual crearía otra: se dice en el log.
  const marca = JSON.stringify({ ...(JSON.parse(reclamo) as object), secuenciaId: fila.id });
  if (!(await cambiarSettingSi(key, reclamo, marca).catch(() => false))) console.error(`[difusion] automatización ${fila.id}: no pude dejarle la marca del pedido`);

  // LA INSCRIPCIÓN (`inscribirEnDifusion`). Una tanda que falla se dice: las de antes ya entraron, y el mismo pedido otra vez
  // suma sólo a los que faltan.
  const { nuevos: inscriptos, error } = await inscribirEnDifusion(fila.id, vista.alcance.ids);
  if (error) {
    console.error(`[difusion] automatización ${fila.id}: inscribí ${inscriptos} y la tanda siguiente falló: ${error}`);
    return { ok: false, error: `Entraron ${inscriptos} de ${vista.alcance.llegan}: la siguiente tanda falló (${error}). La automatización «${nombre}» quedó prendida con ésos: si la vuelves a mandar igual, sumo sólo a los que faltan.` };
  }
  console.log(`[difusion] ws=${ws} «${nombre}» (#${fila.id}) por ${canales.join(', ')}: ${inscriptos} leads, de a uno cada ${goteo.minutos} min y hasta ${goteo.dia} por día${goteo.arranque ? ` (arranca con ${goteo.arranque.dia} y sube ${goteo.arranque.sube})` : ''} — ${p.autor}`);
  return { ok: true, secuenciaId: fila.id, nombre, leads: inscriptos, alcance: vista.alcance };
}

export type ResultadoSiContesta =
  | {
    ok: true; secuenciaId: number; nombre: string; antes: SiContestaDifusion | null;
    /** Les falta el mensaje (o lo están escuchando): a ellas les sale el seguimiento si contestan. */
    loVan: number;
    /** Ya lo recibieron y la difusión terminó con ellas, o ya contestaron: no les sale (se dice). */
    yaPasaron: number;
  }
  | { ok: false; error: string };

/** Antes del mensaje o escuchando la respuesta: a éstas les llega el seguimiento nuevo. */
const NODOS_QUE_LO_VAN = new Set([null, 'entrada', 'd_c_whatsapp', 'd_whatsapp', 'd_escucha']);

/**
 * AGREGARLE «SEGUIR CON LOS QUE CONTESTAN» A UNA DIFUSIÓN QUE YA ESTÁ SALIENDO (13/11/2026, Leila: la #732 seguía con 88 por
 * recibir). Reescribe sus pasos con `conSiContesta` por la puerta de siempre (`setSecuenciaPasos`, que lo valida). Les llega a
 * las que todavía no recibieron el mensaje y a las que lo están escuchando; a las que ya terminaron (lo recibieron sin un
 * seguimiento, o ya contestaron) no: el motor no vuelve a abrir una inscripción cerrada, y se dice cuántas son. `soloVer`: decide
 * y cuenta sin escribir (la propuesta de MaKo).
 */
export async function seguirConLosQueContestan(secuenciaId: number, sc: SiContestaDifusion, o: { soloVer?: boolean } = {}): Promise<ResultadoSiContesta> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, clave, pasos, archivada_at').eq('id', secuenciaId).maybeSingle();
  if (error) return { ok: false, error: `No pude leer la difusión (${error.message}).` };
  const sec = data as { id: number; nombre: string; clave: string | null; pasos: unknown; archivada_at: string | null } | null;
  if (!sec || sec.archivada_at) return { ok: false, error: 'Esa automatización no está (o está archivada).' };
  if (!String(sec.clave ?? '').startsWith(PREFIJO_CLAVE_DIFUSION)) return { ok: false, error: `«${sec.nombre}» no es una difusión: a una automatización se le agrega «Contestó» en Automations, después de un mensaje y una espera.` };
  const pasos = (Array.isArray(sec.pasos) ? sec.pasos : []) as Parameters<typeof conSiContesta>[0];
  const canales = (['whatsapp', 'email', 'instagram'] as const).filter((c) => pasos.some((p) => p.id === `d_${c}`));
  const falta = problemaDeSiContesta(canales, sc);
  if (falta) return { ok: false, error: `${falta}.` };
  const { data: ins, error: eI } = await db.from('nutricion_inscripciones').select('estado, nodo_actual').eq('secuencia_id', sec.id);
  if (eI) return { ok: false, error: `No pude contar a quién le llega (${eI.message}).` };
  const filas = (ins ?? []) as Array<{ estado: string; nodo_actual: string | null }>;
  const loVan = filas.filter((f) => f.estado === 'activa' && NODOS_QUE_LO_VAN.has(f.nodo_actual)).length;
  if (!loVan) return { ok: false, error: `«${sec.nombre}» ya terminó: a nadie le queda por recibirla ni la están escuchando. Para seguir con los que contesten, manda una difusión nueva con el seguimiento.` };
  const antes = siContestaDeLosPasos(pasos);
  if (!o.soloVer) {
    const { setSecuenciaPasos } = await import('./nutricion');
    await setSecuenciaPasos(sec.id, conSiContesta(pasos, sc) as Parameters<typeof setSecuenciaPasos>[1]);
    console.log(`[difusion] «${sec.nombre}» (#${sec.id}): seguimiento a los que contestan (${sc.mensajes.length} mensajes, ${sc.dias} días); le llega a ${loVan}`);
  }
  return { ok: true, secuenciaId: sec.id, nombre: sec.nombre, antes, loVan, yaPasaron: filas.length - loVan };
}

/**
 * PAUSA LAS DIFUSIONES QUE YA TERMINARON (`PREFIJO_CLAVE_DIFUSION`, lib/difusion-reglas.ts): prendidas, de hace más de
 * `MIN_DIFUSION_ANTES_DE_PAUSAR` y sin nadie en curso. La llama la corrida de la hora del motor (lib/nutricion.ts), con el
 * negocio puesto. Apaga con compare-and-set (`activa = true`): si alguien la apagó o la prendió a mano en el medio, no la pisa.
 * Nunca tira; devuelve cuántas pausó.
 */
export async function pausarDifusionesTerminadas(): Promise<number> {
  try {
    const db = await getTenantDb();
    const antes = new Date(Date.now() - MIN_DIFUSION_ANTES_DE_PAUSAR * 60_000).toISOString();
    const { data, error } = await db.from('nutricion_secuencias').select('id, nombre')
      .like('clave', `${PREFIJO_CLAVE_DIFUSION}%`).eq('activa', true).is('archivada_at', null).lt('created_at', antes);
    if (error) throw new Error(error.message);
    let pausadas = 0;
    for (const d of (data ?? []) as Array<{ id: number; nombre: string }>) {
      const { count, error: e } = await db.from('nutricion_inscripciones').select('id', { count: 'exact', head: true })
        .eq('secuencia_id', d.id).in('estado', [...ESTADOS_DIFUSION_EN_CURSO]);
      // «No pude contar» no es «no queda nadie».
      if (e || count == null || count > 0) continue;
      const { data: hecho } = await db.from('nutricion_secuencias').update({ activa: false, updated_at: new Date().toISOString() })
        .eq('id', d.id).eq('activa', true).select('id');
      if ((hecho ?? []).length) { pausadas += 1; console.log(`[difusion] «${d.nombre}» (#${d.id}) terminó: la pausé (ya no ocupa lugar en el tope del plan)`); }
    }
    return pausadas;
  } catch (e) {
    console.error(`[difusion] pausar las terminadas: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}
