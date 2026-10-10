import 'server-only';

// =============================================================================
// reunion-recordatorio — el WhatsApp de «en media hora entrás a la R1 con X»
// =============================================================================
// Estaba en el catálogo de avisos desde el principio con `yaImplementado: 'no'`:
// el texto existía y NADIE lo llamaba. Es el momento en el que más sirve saber
// quién es el lead —treinta minutos antes, con el teléfono en la mano— y era
// justo el que faltaba.
//
// CÓMO NO MANDA DOS VECES. El candado no es la ventana del cron: es una marca
// por REUNIÓN (`mako.recordatorio.<leadId>.<R1|R2>.<iso>`). Con eso el cron
// puede correr cada minuto, cada diez o dos veces por un reintento de Vercel y
// el mensaje sale una sola vez. Atarlo a la frecuencia del cron es lo que hace
// que un cambio de schedule duplique avisos meses después, sin que nadie
// relacione una cosa con la otra.
//
// Y la marca lleva el ISO adentro a propósito: si el lead REAGENDA, la fecha
// cambia, la key es otra y el recordatorio del horario nuevo sí sale.
//
// Desde el 06/10/2026 el archivo tiene un SEGUNDO emisor, para el LEAD
// (`mandarRecordatoriosAlLead`, más abajo): 24 h, 1 h y 15 min antes, con el link.
// =============================================================================

import { getTenantDb, runWithWorkspace } from './workspace';
import { getSettingEstricto, setSetting, cambiarSettingSi } from './settings';
import { getSupabaseServer } from './supabase';
import { emitirDelCatalogo } from './avisos';
import { textoAvisoPreLlamada } from './lead-resumen';
import { envioWhatsappHabilitado } from './envio-flags';
import { enviarYEspejar } from './evolution-envio';
import { estaBloqueado } from './evolution-block';
import { normalizarTelefono } from './leads';
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import {
  KEY_RECORDATORIO, TOQUES, TOLERANCIA_MIN as TOLERANCIA_LEAD_MIN, configDeRecordatorio, juntasDe, leadAbierto, reunionParaElDueno,
  toquesVencidos, estadoDeLaMarca, envioIncierto, textoDelToque, type ConfigRecordatorio, type CualReunion, type Toque,
} from './recordatorio-lead';

/**
 * Cuánto antes avisa. Treinta minutos es el hueco donde el aviso todavía sirve:
 * alcanza para abrir el resumen y no tanto como para olvidarse.
 */
export const MINUTOS_ANTES = 30;

/**
 * Cuánto para atrás mira. Es la RED por si el cron no corrió (deploy, caída,
 * cold start): una reunión que ya empezó hace 10 minutos todavía merece el
 * aviso. Más atrás que eso ya es ruido — la reunión está pasando.
 */
const TOLERANCIA_MIN = 10;

const keyMarca = (leadId: number, cual: 'R1' | 'R2', iso: string) =>
  `mako.recordatorio.${leadId}.${cual}.${iso}`;

export type ResultadoRecordatorios = {
  /** Reuniones dentro de la ventana. */ miradas: number;
  /** Avisos que salieron ahora. */ avisados: number;
  /** Ya avisadas antes (la marca las frenó). */ yaAvisadas: number;
  errores: number;
};

type FilaReunion = {
  id: number;
  nombre: string;
  junta_1_at: string | null;
  junta_2_at: string | null;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  estado_lead: string | null;
};

/**
 * Manda el recordatorio de las reuniones que arrancan en los próximos
 * `MINUTOS_ANTES`. Corre dentro de runWithWorkspace (lo llama el cron).
 */
export async function mandarRecordatoriosDeReunion(ws: number): Promise<ResultadoRecordatorios> {
  const out: ResultadoRecordatorios = { miradas: 0, avisados: 0, yaAvisadas: 0, errores: 0 };
  const supabase = await getTenantDb();

  const ahora = Date.now();
  const desde = new Date(ahora - TOLERANCIA_MIN * 60_000).toISOString();
  const hasta = new Date(ahora + MINUTOS_ANTES * 60_000).toISOString();

  // Se pregunta por las DOS columnas en una sola vuelta: `or` de Supabase con
  // los dos rangos. Traer todos los leads y filtrar en memoria funcionaba con
  // 200 leads y deja de funcionar sin avisar.
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, junta_1_at, junta_2_at, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, estado_lead')
    .or(
      `and(junta_1_at.gte.${desde},junta_1_at.lte.${hasta}),` +
      `and(junta_2_at.gte.${desde},junta_2_at.lte.${hasta})`,
    );
  if (error) {
    console.error(`[recordatorio] ws=${ws} no se pudieron leer las reuniones: ${error.message}`);
    out.errores += 1;
    return out;
  }

  // La FECHA de cada reunión se compara contra su hora en la zona de la agenda o la del negocio
  // (`reunionParaElDueno`, lib/recordatorio-lead.ts). Sólo se pide la zona si hay a quién mirar.
  const filas = (data ?? []) as FilaReunion[];
  const tz = filas.length ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;

  for (const lead of filas) {
    // Una reunión por lead por corrida, sin asistencia marcada y con su fecha (una cancelación de
    // Calendly deja la hora y borra la fecha). Si caen las dos en la ventana, gana la R2.
    const r = reunionParaElDueno(lead, ahora, MINUTOS_ANTES, TOLERANCIA_MIN, tz);
    if (!r) continue;
    const { cual, inicio: iso } = r;

    // Un lead que ya se cerró o se perdió sigue teniendo la fecha cargada: la
    // reunión no se borra al mover la etapa. Sin este filtro, el recordatorio de
    // una R1 vieja sale igual el día que alguien corrige una fecha a mano.
    if (lead.estado_lead && lead.estado_lead !== 'abierto') continue;
    // (La asistencia YA marcada —la reunión ocurrió, lo que sigue es el aviso post-llamada— la descarta
    // `reunionParaElDueno`.)

    out.miradas += 1;
    const key = keyMarca(lead.id, cual, iso);
    // Ante un error leyendo la marca se SALTEA (el catch devuelve 'error', que es
    // truthy): mejor perderse un recordatorio que mandar el mismo tres veces.
    // ⚠️ Con `getSetting` ese catch NO CORRÍA NUNCA: `getSetting` se come el error y
    // devuelve null, o sea «no hay marca» → mandaba otra vez. Va el estricto, que tira
    // (medido al escribir el recordatorio al lead, 06/10/2026).
    if (await getSettingEstricto(key).catch(() => 'error')) { out.yaAvisadas += 1; continue; }

    try {
      const minutos = Math.max(0, Math.round((Date.parse(iso) - ahora) / 60_000));
      const texto = await textoAvisoPreLlamada({ leadId: lead.id, cual, minutos });
      if (!texto) { out.errores += 1; continue; }
      const aviso = await emitirDelCatalogo('reunion-recordatorio', { ws, texto });
      // La marca se escribe DESPUÉS del envío y solo si el aviso se procesó — el
      // candado se escribe después del efecto que protege (misma disciplina que
      // lib/reunion-auto.ts, donde escribirlo antes perdía las tareas para
      // siempre). `ok` cubre también el caso «apagado en Configuraciones»: ahí no
      // hay que reintentar, el dueño lo silenció a propósito.
      if (aviso.ok) {
        await setSetting(key, new Date().toISOString()).catch(() => {});
        out.avisados += 1;
      } else {
        out.errores += 1;
      }
    } catch (e) {
      out.errores += 1;
      console.error(`[recordatorio] ws=${ws} lead=${lead.id} ${cual}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}

// =============================================================================
// El recordatorio AL LEAD: 24 h, 1 h y 15 min antes, con el link de la reunión
// =============================================================================
// Lo de arriba le avisa al DUEÑO. Esto le escribe al LEAD, por WhatsApp, desde la línea no
// oficial del negocio. Cuándo vence cada toque y qué dice vive en lib/recordatorio-lead.ts
// (puro, con test); acá se lee, se marca y se manda.
//
// ⚠️⚠️ CHOCA CON UNA REGLA DURA, Y ES UNA EXCEPCIÓN DECIDIDA. lib/evolution-envio.ts (y la mig
// 0074) dicen: a un lead que NO PAGÓ nunca se le manda automático directo, va a un BORRADOR que
// el setter manda con un clic. Esto le escribe directo a leads que no pagaron. Lo decidió Martín
// el 06/10/2026 («A: 24h, 1h y 15min con link, ws1, apago n8n»): son los recordatorios que ya
// le llegaban a esos mismos leads desde n8n, a alguien que AGENDÓ (o sea que ya escribió, que es
// lo que protege a una línea no oficial: no escribirle primero a quien nunca escribió). Y es
// OPT-IN POR WORKSPACE: nace apagado y sólo `activo === true` en el setting de ESE negocio lo
// prende. No es un default de la plataforma ni se le prende a nadie más por herencia.
//
// ⚠️ NO SE HEREDA DEL DUEÑO. `getSetting` lee el workspace del contexto y, FUERA de uno, cae al
// dueño (lib/settings.ts → `wsActual`); un cron que se olvide el `runWithWorkspace` le leería a
// cada cliente el interruptor de Mauricio. Por eso `leerConfigRecordatorio` pregunta con el
// `workspace_id` EXPLÍCITO y nunca por el contexto: que el ws1 lo prenda no le escribe a los
// leads de nadie más.
//
// ⚠️ Y MANDA SÓLO CON EL ENVÍO DEL NEGOCIO PRENDIDO (`envioWhatsappHabilitado`, el mismo
// interruptor que respetan la nutrición y el curso): uno solo para todo lo que le escribe a un
// lead, o el negocio lo apaga y esto le sigue escribiendo igual. No recibe `ws`: lee el contexto,
// así que va adentro del `runWithWorkspace`.
//
// CÓMO NO MANDA DOS VECES: una marca por TOQUE (`claveToque`: lead, R1/R2, el ISO de la reunión y
// los minutos), con compare-and-set ANTES de mandar (`reclamado:`) para que dos corridas del
// mismo tick no manden las dos —Evolution retiene el HTTP hasta 9 s con su `delay`, y el 27/09 eso
// dejó 21 pares duplicados en los avisos programados—, y la marca de `enviado:` DESPUÉS del envío
// ok. Si Evolution rechaza el envío, la marca queda en `fallo:` y la corrida siguiente lo
// reintenta mientras siga dentro de la tolerancia; pasada, el toque se pierde. Si el envío se
// cortó por tiempo (pudo haber salido), queda `incierto:` y NO se reintenta (revisión del #17).

export type RecordatorioEnSeco = { leadId: number; cual: CualReunion; min: number; conLink: boolean; texto: string };

export type ResultadoAlLead = {
  ws: number;
  /** El interruptor del negocio (`chatbot.recordatorio_reunion.activo`). */
  activo: boolean;
  /** `envio_whatsapp_enabled` del negocio. null = no se llegó a mirar. */
  envio: boolean | null;
  /** Toques vencidos en esta corrida. */
  vencidos: number;
  enviados: number;
  /** Ya enviados (o tomados por otra corrida): la marca los frenó. */
  yaEnviados: number;
  /** Por qué NO salió, por motivo. */
  omitidos: Record<string, number>;
  /** Los que no entraron en el tiempo de la corrida: los toma la siguiente si siguen en ventana. */
  sinTiempo: number;
  errores: string[];
  /** Sólo con `dry`: lo que mandaría. */
  enSeco?: RecordatorioEnSeco[];
};

/** Columnas que lee el emisor. `junta_X_url` es de la mig 0204: sin ella, el select ENTERO falla. */
const COLS_LEAD_RECORDATORIO =
  'id, nombre, telefono, estado_lead, junta_1_at, junta_2_at, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, junta_1_url, junta_2_url';

type FilaLeadRecordatorio = {
  id: number; nombre: string | null; telefono: string | null; estado_lead: string | null;
  junta_1_at: string | null; junta_2_at: string | null; fecha_junta_1: string | null; fecha_junta_2: string | null;
  asistio_j1: boolean | null; asistio_j2: boolean | null; junta_1_url: string | null; junta_2_url: string | null;
};

const msgErr = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * La configuración del recordatorio de ESE workspace, con el `workspace_id` explícito (ver la
 * cabecera: no se hereda del dueño). Un error de lectura TIRA: «no pude leer» no es «apagado» para
 * la pantalla que lo muestra, y el cron lo cuenta como error en vez de callarlo.
 */
export async function leerConfigRecordatorio(ws: number): Promise<ConfigRecordatorio> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings').select('value')
    .eq('workspace_id', ws).eq('key', KEY_RECORDATORIO)
    .maybeSingle();
  if (error) throw new Error(`No pude leer el recordatorio de la reunión: ${error.message}`);
  return configDeRecordatorio((data?.value as string | undefined) ?? null);
}

/**
 * Manda los recordatorios al lead de UN workspace. Con `dry` no reclama ni manda nada: devuelve
 * en `enSeco` lo que mandaría (y lo calcula aunque el interruptor esté apagado, que es para lo
 * que sirve: mirarlo un día antes de prenderlo).
 */
export async function mandarRecordatoriosAlLead(
  ws: number,
  opts: { dry?: boolean; ahora?: Date; deadlineMs?: number } = {},
): Promise<ResultadoAlLead> {
  return runWithWorkspace(ws, async () => {
    const res: ResultadoAlLead = {
      ws, activo: false, envio: null, vencidos: 0, enviados: 0, yaEnviados: 0, omitidos: {}, sinTiempo: 0, errores: [],
      ...(opts.dry ? { enSeco: [] } : {}),
    };
    const omitir = (motivo: string) => { res.omitidos[motivo] = (res.omitidos[motivo] ?? 0) + 1; };

    let cfg: ConfigRecordatorio;
    try { cfg = await leerConfigRecordatorio(ws); }
    catch (e) { res.errores.push(msgErr(e)); return res; }
    res.activo = cfg.activo;
    // Apagado: ni se mira la base. Es lo que pasa en casi todos los negocios en casi todas las
    // corridas, y este cron corre cada 10 minutos.
    if (!cfg.activo && !opts.dry) return res;

    res.envio = await envioWhatsappHabilitado().catch(() => false);
    if (!res.envio && !opts.dry) return res;

    const ahora = opts.ahora ?? new Date();
    const t = ahora.getTime();
    const desde = ahora.toISOString();
    const hasta = new Date(t + (Math.max(...TOQUES) + TOLERANCIA_LEAD_MIN) * 60_000).toISOString();
    // Las DOS reuniones en una vuelta, como el aviso de arriba. Son las de las próximas 24 h de un
    // negocio: no llegan a las 1000 filas del tope de PostgREST.
    const { data, error } = await (await getTenantDb())
      .from('leads').select(COLS_LEAD_RECORDATORIO)
      .or(`and(junta_1_at.gt.${desde},junta_1_at.lte.${hasta}),and(junta_2_at.gt.${desde},junta_2_at.lte.${hasta})`);
    if (error) { res.errores.push(`no pude leer las reuniones: ${error.message}`); return res; }

    const filas = (data ?? []) as FilaLeadRecordatorio[];
    // La zona del negocio ANTES de decidir: dice la hora del texto y también si la fecha de la
    // reunión sigue siendo la de su hora (`fechaCoincide`). Sólo se pide si hay a quién mirar.
    const tz = filas.length ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;
    for (const lead of filas) {
      if (!leadAbierto(lead.estado_lead)) continue;
      const vencidos = toquesVencidos({ leadId: lead.id, juntas: juntasDe(lead), ahora: t, tz });
      for (const v of vencidos) {
        res.vencidos += 1;
        const telefono = normalizarTelefono(lead.telefono);
        if (!telefono) { omitir('sin teléfono'); continue; }

        let marca: string | null;
        try { marca = await getSettingEstricto(v.clave); }
        catch (e) { res.errores.push(`lead ${lead.id}: no pude leer la marca (${msgErr(e)})`); continue; }
        const estado = estadoDeLaMarca(marca);
        if (estado === 'tomada') { res.yaEnviados += 1; continue; }

        if (await estaBloqueado(telefono)) { omitir('contacto bloqueado'); continue; }

        const texto = textoDelToque({
          plantilla: cfg.textos[v.min as Toque], nombre: lead.nombre,
          inicio: new Date(v.inicio), ahora, tz, link: v.link,
        });
        if (!texto) { omitir('texto vacío'); continue; }

        if (opts.dry) { res.enSeco!.push({ leadId: lead.id, cual: v.cual, min: v.min, conLink: Boolean(v.link), texto }); continue; }
        if (opts.deadlineMs && Date.now() > opts.deadlineMs) { res.sinTiempo += 1; continue; }

        // El reclamo ANTES de mandar, con compare-and-set: de dos corridas, gana una.
        const reclamo = `reclamado:${new Date().toISOString()}`;
        const gano = await cambiarSettingSi(v.clave, estado === 'libre' ? null : marca, reclamo).catch(() => false);
        if (!gano) { res.yaEnviados += 1; continue; }

        // Por el número de ESE toque (el que se eligió en su tarjeta); sin elegir, el de por default,
        // como siempre. Uno que ya no está no cae al de por default: `enviarTexto` no manda y el
        // error queda abajo, en `fallo:` (lib/recordatorio-lead.ts, `ConfigRecordatorio.lineas`).
        const r = await enviarYEspejar({ telefono, texto, leadId: lead.id, linea: cfg.lineas[v.min as Toque] ?? null })
          .catch((e): { ok: false; error: string } => ({ ok: false, error: msgErr(e) }));
        if (r.ok) {
          // La marca de ENVIADO va después del envío ok, nunca antes.
          await setSetting(v.clave, `enviado:${new Date().toISOString()}`).catch((e) =>
            console.error(`[recordatorio-lead] ws=${ws} lead=${lead.id}: salió y no pude marcarlo (${msgErr(e)})`));
          res.enviados += 1;
        } else {
          // Un corte por tiempo NO es «no salió»: puede haber salido. Queda `incierto:` y no se
          // reintenta (ver `envioIncierto`); sólo lo que Evolution rechazó vuelve a `fallo:`.
          const marcaFallo = envioIncierto(r.error) ? 'incierto' : 'fallo';
          await cambiarSettingSi(v.clave, reclamo, `${marcaFallo}:${new Date().toISOString()}`).catch(() => false);
          res.errores.push(`lead ${lead.id} ${v.cual} ${v.min} min (${marcaFallo}): ${r.error ?? 'no salió'}`);
        }
      }
    }
    return res;
  });
}
