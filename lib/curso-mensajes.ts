import 'server-only';

// =============================================================================
// curso-mensajes — lo que el curso le manda al cliente (y a Mauricio) por WhatsApp
// =============================================================================
// Tres mensajes, los tres pedidos:
//   1. El LINK del portal, a mano desde la ficha («Mandar su link»).
//   2. La ETAPA NUEVA: cuando el paso automático lo mueve a una etapa que tiene clases
//      («si esa próxima etapa tiene un tutorial con sus tareas, se debería enviarle un mensaje»,
//      Martín, 06/10/2026).
//   3. Los de las LLAMADAS de la entrega: uno el día antes con lo que le falta, y uno después
//      de la llamada con sus pendientes, al cliente y a Mauricio (pedido de Mauricio del 8/9:
//      «después de cada junta… y un día antes de la siguiente, lo que no está concluido»).
//   4. El RECORDATORIO DE CLASES (#780): a los 3 días sin entrar al portal, los videos sin ver
//      de su etapa (decisión de Martín, 06/10/2026). Lo corre el mismo cron horario, después de
//      las llamadas; ver la sección 4 de abajo.
//
// ⚠️ EL LINK LO ESCRIBE EL CÓDIGO (`linkDeAcceso`), nunca un modelo: es una firma, y un
// carácter cambiado es un link que no abre. Los textos son plantillas fijas
// (lib/curso-mensajes-texto.ts, puro y con test): acá no pasa nada por una IA.
//
// ── Por dónde sale y cuándo NO sale ──────────────────────────────────────────
// Por la línea de POR DEFAULT del WhatsApp no oficial del negocio (`enviarYEspejar` sin `linea`
// → `elegirLinea`, lib/lineas-whatsapp.ts), que es el número que el cliente conoce. El saliente
// queda espejado en `wa_mensajes`, así que se ve en el hilo del lead como cualquier otro.
//
// ⚠️ RESPETA `envio_whatsapp_enabled` DEL WORKSPACE, también en el envío a mano. En el ws1
// (Mauricio) estuvo en 'false' del 29/09 al 06/10/2026, y desde el 06/10 está PRENDIDO (lo dice
// el relevo de esa fecha; esta sesión no lo midió): lo de este archivo le llega de verdad a sus
// clientes. Apagado, el motivo vuelve escrito («envío de WhatsApp apagado») para que la pantalla
// lo diga en vez de mostrar un «enviado» que no pasó. Es el mismo interruptor que respeta el motor
// de nutrición (lib/nutricion.ts → `procesarEnvios`): uno solo para todo lo que le escribe a un
// lead, o el negocio lo apaga y algo le sigue escribiendo igual.
//
// Y sin aprobación previa: los tres son mensajes a clientes que YA PAGARON, que es el caso en
// que el no oficial manda directo (lib/evolution-envio.ts, `esLeadCliente`), y Mauricio lo pidió
// así el 8/9: «como son poquitos clientes, podríamos dejarlo sin aprobación y yo voy a ver qué
// le envió». Por eso a él le llega, en cada llamada, el mismo resumen y si al cliente le llegó.

import { getTenantDb, getWorkspaceActual, runWithWorkspace, listarWorkspaces } from './workspace';
import { getSupabaseServer } from './supabase';
import { envioWhatsappHabilitado } from './envio-flags';
import { enviarYEspejar } from './evolution-envio';
import { estaBloqueado } from './evolution-block';
import { normalizarTelefono } from './leads';
import { tzDeWorkspace } from './timezone';
import { entregaDeProducto, entregaDeProductoEstricta } from './entrega-servicio';
import { emitirAviso } from './avisos';
import {
  linkDeAcceso, linkDeAccesoExistente, clasesDelProducto, progresoDelCliente, etapaActualDe, productosDelAlumno,
  productosConCasaDelAlumno, accesoDe,
} from './curso-datos';
import { etapaCompleta, pendientesDe, videosSinVer, type Clase, type Progreso } from './curso';
import { aperturasDelAlumno } from './curso-portal';
import { etapaAnterior } from './curso-avance-regla';
import { esModuloDelCurso } from './servicio-etapas';
import { leerTodo } from './supabase-paginado';
import {
  textoLinkCurso, textoEntradaAEtapa, textoPrevioCliente, textoPosteriorCliente,
  textoPrevioDueno, textoPosteriorDueno, tituloAvisoDueno,
  faseDeSesion, ventanaDeSesiones, enHorarioDeMensajes, cuandoEs, horaDe, conMotivoDeFase, type FaseSesion,
  claveAvisoSesion, ventanaDeGrabacion, ventanaDeSesionesVecinas, grabacionesDeLaSesion, compromisosDeGrabaciones,
  NO_TENIA_PENDIENTES, type CompromisosJunta,
  juntaPendiente, juntaResuelta, claveAvisoJunta, textoJuntaDueno, tituloAvisoJunta,
  tocaRecordatorio, sigueEnElPrograma, sesionCerca, ventanaDeSesionCerca,
  textoRecordatorioClases, textoRecordatorioDueno, claveAvisoRecordatorio, TITULO_AVISO_RECORDATORIO,
  type AccesoParaRecordar, type BloqueVideos, type RecordatorioHecho, type RecordatorioSinEscribir,
} from './curso-mensajes-texto';

export type ResultadoEnvio = { ok: boolean; motivo?: string };

/**
 * El motivo cuando el negocio tiene apagado el envío. Lo leen la ficha (lo muestra tal cual) y las
 * sesiones (`aviso_motivo`), y es el que el cron usa para decidir ESPERAR en vez de marcar.
 */
const MOTIVO_APAGADO = 'envío de WhatsApp apagado';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── A quién y por dónde ──────────────────────────────────────────────────────

type LeadMin = { id: number; nombre: string | null; telefono: string | null; estado_lead: string | null };

async function leerLead(leadId: number): Promise<LeadMin | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre, telefono, estado_lead').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`no pude leer el cliente: ${error.message}`);
  return (data as LeadMin | null) ?? null;
}

type Destino = { ok: true; ws: number; nombre: string | null; telefono: string; link: string } | { ok: false; motivo: string };

/**
 * Todo lo que hace falta para escribirle a un cliente, o el PRIMER motivo por el que no se puede.
 * Corre adentro del workspace del cliente (sesión de la ficha o `runWithWorkspace` del cron).
 *
 * ⚠️ EL INTERRUPTOR SE MIRA ANTES QUE EL LINK, y no por prolijidad: `linkDeAcceso` CREA el acceso
 * del cliente si no lo tenía. Con el envío apagado no se le crea una puerta a nadie por un
 * mensaje que no va a salir.
 *
 * ⚠️ SÓLO A UN CLIENTE GANADO: `resolverAcceso` (lib/curso-datos.ts) no abre el portal a un lead
 * que no lo sea, así que mandarle el link es mandarle una puerta cerrada.
 */
async function destinoDe(
  leadId: number,
  opts: { porQuien?: string | null; envioOn?: boolean; sinCrearAcceso?: boolean } = {},
): Promise<Destino> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, motivo: 'sin negocio' };
  const on = opts.envioOn ?? (await envioWhatsappHabilitado());
  if (!on) return { ok: false, motivo: MOTIVO_APAGADO };
  const lead = await leerLead(leadId);
  if (!lead) return { ok: false, motivo: 'el cliente no existe' };
  if (lead.estado_lead !== 'ganado') return { ok: false, motivo: 'no es cliente ganado' };
  // Sólo dígitos, igual que el resto del repo (lib/leads.ts). La lada la pone quien cargó el
  // número: el motor de nutrición manda lo mismo y por el mismo camino.
  const telefono = normalizarTelefono(lead.telefono);
  if (!telefono) return { ok: false, motivo: 'sin teléfono' };
  if (await estaBloqueado(telefono)) return { ok: false, motivo: 'contacto bloqueado' };
  // `null` = acceso cortado (o sin secreto para firmar): no se manda un link que no abre.
  // ⚠️ `sinCrearAcceso`: el recordatorio de clases (sección 4) sólo le escribe a quien YA tiene
  // su acceso, y un mensaje automático no le abre una puerta a nadie. Sin acceso es «acceso cortado».
  const link = opts.sinCrearAcceso
    ? await linkDeAccesoExistente(leadId, ws)
    : await linkDeAcceso(leadId, ws, opts.porQuien ?? null);
  if (!link) return { ok: false, motivo: 'acceso cortado' };
  return { ok: true, ws, nombre: lead.nombre, telefono, link };
}

async function mandar(d: Extract<Destino, { ok: true }>, leadId: number, texto: string): Promise<ResultadoEnvio> {
  const r = await enviarYEspejar({ telefono: d.telefono, texto, leadId });
  if (!r.ok) return { ok: false, motivo: r.error?.trim() || 'no salió' };
  // Le LLEGÓ su link: es contacto con su portal, y el recordatorio de clases cuenta sus 3 días
  // desde acá (sección 4). Sólo si el texto lo lleva de verdad: un mensaje sin link no es eso.
  if (texto.includes(d.link)) await anotarLinkEnviado(leadId);
  return { ok: true };
}

/**
 * Deja escrito que al cliente le llegó su link por WhatsApp (`curso_accesos.link_enviado_at`, mig
 * 0211). Pasa por acá todo lo que el curso le manda con su link: «Mandar su link» de la ficha, la
 * etapa nueva, el previo y el posterior de una llamada, y el propio recordatorio.
 *
 * POR QUÉ (revisión del 07/10/2026): sin esto, el recordatorio no veía al cliente al que Mauricio
 * le mandó el link desde la ficha y nunca lo abrió —no tiene invitación por mail ni ingresos—, que
 * es el caso más típico de «nunca entró». Y mandar el link a mano no contaba como contacto: a quien
 * invitaron por mail hace 10 días le podía llegar el recordatorio una hora después del link.
 *
 * ⚠️ NUNCA TIRA, y va DESPUÉS del envío: el mensaje ya salió, y un error acá haría que alguien lo
 * mande de nuevo. Sin la mig 0211 la columna no existe y sólo queda el aviso en el log.
 */
async function anotarLinkEnviado(leadId: number): Promise<void> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('curso_accesos').update({ link_enviado_at: new Date().toISOString() }).eq('lead_id', leadId).is('area', null);
    if (error) console.warn(`[curso-mensajes] link al lead ${leadId}: salió y no pude anotarlo: ${error.message}`);
  } catch (e) {
    console.warn(`[curso-mensajes] link al lead ${leadId}: salió y no pude anotarlo:`, msg(e));
  }
}

// ── 1. El link, a mano ───────────────────────────────────────────────────────

/** Le manda al cliente el link de su portal. Lo dispara una persona desde la ficha. */
export async function mandarLinkDelCurso(leadId: number, opts: { porQuien?: string | null } = {}): Promise<ResultadoEnvio> {
  try {
    const d = await destinoDe(leadId, { porQuien: opts.porQuien ?? null });
    if (!d.ok) return d;
    return await mandar(d, leadId, textoLinkCurso({ nombre: d.nombre, link: d.link }));
  } catch (e) {
    console.error(`[curso-mensajes] link al lead ${leadId}:`, msg(e));
    return { ok: false, motivo: 'no se pudo mandar' };
  }
}

// ── 2. La etapa nueva ────────────────────────────────────────────────────────

/**
 * Le avisa al cliente que entró a una etapa nueva, con lo que tiene que ver/hacer y su link.
 *
 * ⚠️ «TERMINASTE X» SE DICE SÓLO SI X ESTÁ COMPLETA. Hoy lo llama el paso automático, que llega
 * acá justamente porque la completó; pero la función está exportada y el próximo que la llame
 * desde un movimiento a mano haría que el mensaje felicite por algo que no pasó. Sin la etapa
 * anterior completa el mensaje dice sólo lo que se abrió.
 */
export async function avisarEntradaAEtapa(p: { leadId: number; productoId: number; etapa: string }): Promise<ResultadoEnvio> {
  try {
    // ⚠️ ESTRICTA (riesgo 12 del relevo del 07/10/2026): «¿esa etapa es de la entrega?» DECIDE si sale
    // un mensaje, y con la lectura caída la tolerante contestaba sobre las etapas de fábrica.
    const [entrega, clases, progreso] = await Promise.all([
      entregaDeProductoEstricta(p.productoId), clasesDelProducto(p.productoId), progresoDelCliente(p.leadId),
    ]);
    if (!entrega) return { ok: false, motivo: 'no pude leer las etapas' };
    const claves = entrega.etapas.map((e) => e.key);
    if (!claves.includes(p.etapa)) return { ok: false, motivo: 'esa etapa no es de la entrega' };
    // Sólo una etapa que es MÓDULO del curso (D1, 08/10/2026): una sacada del curso no tiene clases que
    // contarle, y las que hubieran quedado con su clave no se dibujan en el portal (no son de ningún
    // módulo). Un suelto no entra acá nunca: no es una etapa y nadie «entra» a él.
    if (!entrega.etapas.some((e) => e.key === p.etapa && esModuloDelCurso(e))) return { ok: false, motivo: 'esa etapa no es un módulo del curso' };
    const deLaEtapa = clases.filter((c) => c.etapa === p.etapa);
    if (!deLaEtapa.length) return { ok: false, motivo: 'la etapa no tiene clases' };

    const rotulo = (k: string) => entrega.etapas.find((e) => e.key === k)?.label ?? k;
    const prev = etapaAnterior(claves, p.etapa);
    const estadoDe = (id: number) => progreso.get(id)?.estado;
    const terminada = prev && etapaCompleta(clases.filter((c) => c.etapa === prev), estadoDe) ? rotulo(prev) : null;

    const d = await destinoDe(p.leadId);
    if (!d.ok) return d;
    return await mandar(d, p.leadId, textoEntradaAEtapa({
      nombre: d.nombre, anterior: terminada, nueva: rotulo(p.etapa), clases: deLaEtapa.length, link: d.link,
    }));
  } catch (e) {
    console.error(`[curso-mensajes] etapa nueva «${p.etapa}» al lead ${p.leadId}:`, msg(e));
    return { ok: false, motivo: 'no se pudo mandar' };
  }
}

// ── 3. Las llamadas de la entrega (el cron) ──────────────────────────────────

/**
 * Lo que devuelve el cron. Los cuatro primeros son el contrato original; el resto se agregó al
 * escribir el cuerpo y es opcional para no romper a nadie que arme uno a mano.
 */
export type ResultadoSesiones = {
  /** Previos que le LLEGARON al cliente (el envío contestó ok). */
  previos: number;
  /** Posteriores que le llegaron al cliente. */
  posteriores: number;
  /** Sesiones procesadas en esta corrida sin mensaje al cliente (con su motivo en `aviso_motivo`). */
  omitidos: number;
  errores: string[];
  /** En ventana pero fuera de horario (9 a 21 del negocio): las toma la corrida siguiente. */
  esperando?: number;
  /** Avisos a Mauricio (el dueño) que salieron, por WhatsApp, por mail o a su resumen. */
  avisosDueno?: number;
  /** Avisos al dueño que NO salieron por ningún lado (sin grupo, línea de MaKo caída, apagado). */
  avisosDuenoSinSalir?: number;
  /** Workspaces con sesiones en ventana que se visitaron, y los que fallaron enteros. */
  workspaces?: number;
  workspacesFallidos?: number[];
  /** No se pudo leer la tabla de sesiones (o la lista de workspaces): no se procesó nada. */
  lecturaFallida?: boolean;
  /** Juntas cuya grabación se leyó DESPUÉS del posterior y cuyos compromisos se le avisaron a Mauricio. */
  juntas?: number;
  /** Juntas abiertas que siguen esperando su grabación (o que no se pudo leer): la próxima corrida vuelve a mirar. */
  juntasEsperando?: number;
  /**
   * La base todavía no tiene `aviso_junta_at` (mig 0210 sin aplicar): se leyó con las columnas
   * viejas y la junta se mira UNA vez, en el posterior, como antes del 06/10/2026.
   */
  sinMarcaDeJunta?: boolean;
};

/**
 * El TIPO de los avisos a Mauricio (feed + grupo «MaKo <> cliente» + mail si lo prendió).
 *
 * ⚠️ NO ESTÁN EN lib/avisos-catalogo.ts, y salen igual: `emitirAviso` no exige una entrada del
 * catálogo (un tipo desconocido sale prendido, por WhatsApp, con el rótulo «SISTEMA»). Lo que
 * falta sin la entrada es que el dueño los pueda apagar o renombrar desde /mensajes, y el rótulo
 * de REUNIÓN. La entrada exacta quedó pedida al dueño de ese archivo (tenía cambios sin commitear
 * de otra sesión cuando esto se escribió).
 */
const TIPO_AVISO: Record<FaseSesion, string> = { previo: 'curso-sesion-previa', posterior: 'curso-sesion-posterior' };

/** Una llamada leída SIN inquilino (la lectura cruzada del cron): lleva su workspace. */
type FilaSesion = {
  id: number; workspace_id: number; lead_id: number; producto_id: number | null; fecha: string;
  aviso_previo_at: string | null; aviso_posterior_at: string | null; aviso_motivo: string | null;
  /** `undefined` = la base no tiene la columna todavía (mig 0210): ver `sinMarcaDeJunta`. */
  aviso_junta_at?: string | null;
};

const COLS_SESION_SIN_JUNTA = 'id, workspace_id, lead_id, producto_id, fecha, aviso_previo_at, aviso_posterior_at, aviso_motivo';
const COLS_SESION = `${COLS_SESION_SIN_JUNTA}, aviso_junta_at`;

/**
 * ¿El error de la lectura es que la base todavía no tiene `aviso_junta_at`? Un `select` de
 * PostgREST con UNA columna que no existe rechaza la consulta ENTERA: sin este respaldo, un
 * deploy que llegue antes que la mig 0210 dejaría a TODOS los clientes sin el previo ni el
 * posterior, por una columna que sólo usa la junta.
 */
function faltaLaMarcaDeJunta(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || /aviso_junta_at/.test(error.message ?? '');
}

/** Lo que dice cada mensaje de una llamada: el cliente, su etapa y lo que le falta de ella. */
type Contenido =
  | { ok: true; lead: LeadMin; cliente: string; etapa: string; pendientes: string[] | null }
  | { ok: false; motivo: string };

/**
 * El curso de la llamada: el producto de la sesión, o —si no lo dice— el primero de los productos
 * del cliente que tenga clases cargadas (es el que tiene algo que pedirle).
 */
async function cursoDeLaSesion(leadId: number, productoId: number | null): Promise<{ productoId: number; clases: Clase[] } | null> {
  if (productoId) return { productoId, clases: await clasesDelProducto(productoId) };
  const productos = await productosDelAlumno(leadId);
  for (const id of productos) {
    const clases = await clasesDelProducto(id);
    if (clases.length) return { productoId: id, clases };
  }
  return null;
}

/**
 * De las clases de un producto, las que el alumno puede ABRIR hoy: sus candados y sus permisos, con la
 * MISMA evaluación que el portal (`aperturasDelAlumno`, lib/curso-portal.ts). `null` = no se pudo
 * evaluar, y entonces quien llama NO NOMBRA ninguna.
 *
 * ⚠️ UN MENSAJE QUE NOMBRA CLASES ES UNA PUERTA MÁS (revisión del 08/10/2026). El recordatorio y lo
 * pendiente de una llamada salían de «las clases de su etapa», sin candados (D2) ni permisos (mig
 * 0219): le pedían por WhatsApp ver una clase que no puede abrir, o le nombraban una de un módulo que
 * en el portal no viaja «ni el nombre». No poder evaluar es no nombrar: una lista de menos se nota
 * menos que una que manda a buscar lo que no está.
 */
async function abiertasDe(p: {
  leadId: number; productoId: number; productos: readonly number[]; casa: number | null;
  clases: readonly Clase[]; progreso: ReadonlyMap<number, Progreso>;
}): Promise<Set<number> | null> {
  try {
    const acceso = await accesoDe(p.leadId);
    const ap = await aperturasDelAlumno({ ...p, alcance: acceso?.alcance ?? null });
    return new Set(p.clases.filter((c) => ap.clases.get(c.id)?.abierta === true).map((c) => c.id));
  } catch (e) {
    console.warn(`[curso-mensajes] no pude evaluar los candados del lead ${p.leadId}:`, msg(e));
    return null;
  }
}

async function contenidoDe(f: FilaSesion): Promise<Contenido> {
  const lead = await leerLead(f.lead_id);
  if (!lead) return { ok: false, motivo: 'el cliente no existe' };
  if (lead.estado_lead !== 'ganado') return { ok: false, motivo: 'no es cliente ganado' };
  const curso = await cursoDeLaSesion(f.lead_id, f.producto_id);
  if (!curso || !curso.clases.length) return { ok: false, motivo: 'su curso no tiene clases' };
  const [etapa, progreso, entrega, { productos, casa }] = await Promise.all([
    etapaActualDe(f.lead_id, curso.productoId), progresoDelCliente(f.lead_id), entregaDeProducto(curso.productoId),
    productosConCasaDelAlumno(f.lead_id),
  ]);
  if (!etapa) return { ok: false, motivo: 'no está en la entrega de su servicio' };
  const deLaEtapa = curso.clases.filter((c) => c.etapa === etapa);
  // Sólo lo que puede ABRIR (ver `abiertasDe`); sin poder evaluarlo, no se nombra nada (`null`).
  // ⚠️ Y SÓLO DE UN CURSO QUE SU ACCESO LE ABRE (09/10/2026, mig 0232): una sesión puede traer el
  // `producto_id` de un curso al que no se lo invitó (las de antes, o una llamada del equipo, que agenda
  // sobre cualquier producto del que es cliente). Ahí `etapaActualDe` encuentra etapa igual, y nombrarle
  // clases sería mandarlo a buscar lo que su portal no le muestra.
  const abiertas = deLaEtapa.length && productos.includes(curso.productoId)
    ? await abiertasDe({ leadId: f.lead_id, productoId: curso.productoId, productos, casa, clases: curso.clases, progreso })
    : null;
  // `null` = la etapa no tiene clases cargadas (o no se pudo saber cuáles se le abren): ni «te falta»
  // ni «vas al día» serían verdad.
  const pendientes = deLaEtapa.length && abiertas
    ? pendientesDe(deLaEtapa.filter((c) => abiertas.has(c.id)), (id) => progreso.get(id)?.estado).map((c) => c.titulo)
    : null;
  return {
    ok: true, lead, cliente: (lead.nombre ?? '').trim() || `cliente ${lead.id}`,
    etapa: entrega.etapas.find((e) => e.key === etapa)?.label ?? etapa, pendientes,
  };
}

type Ctx = {
  ws: number; tz: string; ahora: Date; envioOn: boolean; res: Required<ResultadoSesiones>;
  /** ¿La base tiene `aviso_junta_at`? Sin ella no se escribe ni se reintenta la junta. */
  conJunta: boolean;
};

/**
 * Los compromisos de la junta de UNA sesión, leídos de su grabación (ver la sección de
 * lib/curso-mensajes-texto.ts). Nunca tira: lo que no se pudo leer vuelve como `error` y el
 * aviso lo dice en una frase — el aviso sale igual.
 *
 * ⚠️ `proximos_pasos` LO AGREGA OTRO GRUPO DE TRABAJO (la versión 3 del análisis de llamadas).
 * Mientras esa columna no exista en la base, PostgREST rechaza la consulta entera y esto
 * contesta `error` («No pude leer la grabación»), que es lo cierto. No se traduce a «sin
 * grabación»: con la columna faltando, las grabaciones existen igual.
 */
async function compromisosDeLaSesion(f: FilaSesion): Promise<CompromisosJunta> {
  const vg = ventanaDeGrabacion(f.fecha);
  const vs = ventanaDeSesionesVecinas(f.fecha);
  if (!vg || !vs) return { estado: 'sin-grabacion' };
  try {
    const db = await getTenantDb();
    const [g, s] = await Promise.all([
      db.from('closing_analyses').select('recording_id, started_at, proximos_pasos')
        .eq('lead_id', f.lead_id).eq('category', 'entrega_servicio').gte('analysis_version', 3)
        .gte('started_at', vg.desde).lte('started_at', vg.hasta)
        .order('started_at', { ascending: true }).limit(20),
      // Las otras sesiones del mismo lead que podrían reclamar la misma grabación.
      db.from('curso_sesiones').select('id, fecha')
        .eq('lead_id', f.lead_id).gte('fecha', vs.desde).lte('fecha', vs.hasta).limit(50),
    ]);
    if (g.error) throw new Error(`closing_analyses: ${g.error.message}`);
    if (s.error) throw new Error(`curso_sesiones: ${s.error.message}`);
    const grabaciones = ((g.data ?? []) as Array<{ started_at: string | null; proximos_pasos: unknown }>)
      .filter((x) => x.started_at)
      .map((x) => ({ startedAt: String(x.started_at), pasos: x.proximos_pasos }));
    const sesiones = ((s.data ?? []) as Array<{ id: number; fecha: string }>).map((x) => ({ id: Number(x.id), fecha: String(x.fecha) }));
    return compromisosDeGrabaciones(grabacionesDeLaSesion({ id: f.id, fecha: f.fecha }, sesiones, grabaciones));
  } catch (e) {
    console.error(`[curso-mensajes] sesión ${f.id}: no pude leer la grabación:`, msg(e));
    return { estado: 'error' };
  }
}

/** El aviso a Mauricio. Nunca tira (`emitirAviso` tampoco). Uno por sesión, fase y RESULTADO (ver `claveAvisoSesion`). */
async function avisarAlDueno(
  ctx: Ctx, f: FilaSesion, fase: FaseSesion, c: Extract<Contenido, { ok: true }>, noLlego: string | null,
  compromisos: CompromisosJunta | null = null,
): Promise<void> {
  const fecha = new Date(f.fecha);
  const texto = fase === 'previo'
    ? textoPrevioDueno({ cliente: c.cliente, cuando: cuandoEs(fecha, ctx.ahora, ctx.tz), hora: horaDe(fecha, ctx.tz), etapa: c.etapa, pendientes: c.pendientes, noLlego })
    : textoPosteriorDueno({ cliente: c.cliente, etapa: c.etapa, pendientes: c.pendientes, noLlego, compromisos });
  const r = await emitirAviso({
    ws: ctx.ws,
    tipo: TIPO_AVISO[fase],
    titulo: tituloAvisoDueno(fase, c.cliente),
    texto,
    categoria: 'aviso',
    semaforo: c.pendientes == null ? 'na' : c.pendientes.length ? 'amarillo' : 'verde',
    link: '/customer-success',
    // ⚠️ EL DEDUP ES LO QUE HACE SEGURO REPETIRLO: con el envío apagado —o sin teléfono, o con el
    // acceso cortado— la sesión NO se marca (ver abajo) y el cron vuelve a pasar cada hora. La
    // clave es la sesión Y EL RESULTADO: con sólo la sesión, el «no le llegó» de una hora se comía
    // el «ya le mandé» de cuando se arreglaba (72 h de dedup); con sólo el tipo, el aviso de un
    // cliente se comería el de otro.
    dedupKey: claveAvisoSesion(f.id, noLlego, compromisos),
    dedupTtlMin: 72 * 60,
  });
  if (r.deduped) return;
  if (r.wa || r.email || r.agrupado) ctx.res.avisosDueno += 1;
  else ctx.res.avisosDuenoSinSalir += 1;
}

async function procesarSesion(ctx: Ctx, f: FilaSesion, fase: FaseSesion): Promise<void> {
  const db = await getTenantDb();
  const columna = fase === 'previo' ? 'aviso_previo_at' : 'aviso_posterior_at';

  /**
   * LA MARCA, CON COMPARE-AND-SET, ANTES DE MANDAR. «Sólo si devolvió fila» es lo que hace que dos
   * corridas del cron (o un reintento de Vercel) no manden dos veces: la segunda encuentra la
   * columna ya escrita y no le toca. El costo es el opuesto y es el correcto: si el envío falla
   * después de marcar, ese mensaje no se reintenta — se anota el motivo. Un recordatorio que no
   * llegó se nota menos que dos iguales en el teléfono de un cliente.
   *
   * ⚠️ PERO ESA JUSTIFICACIÓN VALE SÓLO PARA LO QUE PASA DESPUÉS DE INTENTAR MANDAR. Lo que se
   * sabe SIN mandar nada —sin teléfono, contacto bloqueado, acceso cortado: `destinoDe` lo lee—
   * se mira ANTES de marcar (ver abajo). Hasta el 06/10/2026 se miraba después, así que una
   * sesión quedaba cerrada para siempre por un teléfono que faltaba, sin que hubiera existido
   * ningún riesgo de duplicado, y cargarle el teléfono no servía de nada.
   *
   * `cierraJunta`: en el posterior, la junta (`aviso_junta_at`) se cierra en la MISMA escritura
   * cuando la grabación ya está leída — el aviso que sale ahora la lleva. Si no está, la junta
   * queda abierta y `procesarJunta` vuelve a mirar en las corridas siguientes. En el previo no
   * se toca: la junta todavía no pasó.
   */
  const marcar = async (cierraJunta = false): Promise<boolean> => {
    const ahora = new Date().toISOString();
    const { data, error } = await db.from('curso_sesiones')
      .update({ [columna]: ahora, ...(cierraJunta && fase === 'posterior' && ctx.conJunta ? { aviso_junta_at: ahora } : {}) })
      .eq('id', f.id).is(columna, null)
      .select('id');
    if (error) throw new Error(`no pude marcar la sesión: ${error.message}`);
    return ((data ?? []) as unknown[]).length > 0;
  };
  /**
   * El motivo de ESTA fase, sin pisar el de la otra (`conMotivoDeFase`). `null` lo saca: el envío
   * salió y un «envío apagado» de una hora anterior ya no es verdad.
   */
  const anotar = async (motivo: string | null): Promise<void> => {
    const nuevo = conMotivoDeFase(f.aviso_motivo, fase, motivo);
    if (nuevo === f.aviso_motivo) return;
    const { error } = await db.from('curso_sesiones').update({ aviso_motivo: nuevo }).eq('id', f.id);
    if (error) { console.error(`[curso-mensajes] sesión ${f.id}: no pude anotar el motivo: ${error.message}`); return; }
    f.aviso_motivo = nuevo;
  };

  const c = await contenidoDe(f);
  if (!c.ok) {
    // Nada que decirle a nadie (ya no es cliente, no tiene curso): se procesa UNA vez y se anota.
    // La junta se cierra con él: sin contenido tampoco hay aviso posterior que la complete.
    if (await marcar(true)) await anotar(c.motivo);
    ctx.res.omitidos += 1;
    return;
  }

  /**
   * Los compromisos de la junta, de su grabación: sólo después de la llamada y sólo para el aviso
   * a Mauricio. NUNCA viajan al texto del cliente (decidido el 06/10/2026: los redactó un modelo y
   * nadie los revisó; Mauricio decide qué reenvía).
   *
   * ⚠️ Y SE LEEN AHORA PERO NO SÓLO AHORA: si la grabación todavía no llegó, la junta queda
   * abierta al marcar (`marcar(juntaResuelta(…))`) y `procesarJunta` la vuelve a buscar en las
   * corridas siguientes (ver `juntaPendiente`, lib/curso-mensajes-texto.ts).
   */
  const compromisos = fase === 'posterior' ? await compromisosDeLaSesion(f) : null;

  // Después de la llamada SIN pendientes no se le escribe al cliente: no hay nada que pedirle, y un
  // «gracias, no te falta nada» por cada llamada es un mensaje de más. A Mauricio tampoco, salvo
  // que la junta haya dejado compromisos: ésos no se los dijo nadie todavía. Si la grabación no
  // llegó, la junta queda abierta y le llegan cuando llegue.
  if (fase === 'posterior' && !c.pendientes?.length) {
    if (await marcar(juntaResuelta(compromisos))) {
      await anotar(c.pendientes == null ? 'su etapa no tiene clases, no se le escribió' : 'al día, no se le escribió');
      if (compromisos?.estado === 'leida' && compromisos.pasos.length) await avisarAlDueno(ctx, f, fase, c, NO_TENIA_PENDIENTES, compromisos);
    }
    ctx.res.omitidos += 1;
    return;
  }

  /**
   * ⚠️ CON EL ENVÍO APAGADO NO SE MARCA, y es lo que pide «no se miente»: `aviso_previo_at` diría
   * que salió algo que no salió. La sesión ESPERA (como el motor de nutrición con el canal
   * apagado) y el motivo queda escrito; si el negocio lo prende mientras la llamada sigue en
   * ventana, el mensaje sale en la corrida siguiente. A Mauricio sí se le avisa —su aviso no va
   * por la línea del negocio sino por el grupo de MaKo— diciéndole que al cliente no le llegó.
   */
  if (!ctx.envioOn) {
    await anotar(MOTIVO_APAGADO);
    await avisarAlDueno(ctx, f, fase, c, MOTIVO_APAGADO, compromisos);
    ctx.res.omitidos += 1;
    return;
  }

  /**
   * ⚠️ LO QUE SE SABE SIN MANDAR NADA SE MIRA ANTES DE MARCAR: sin teléfono, contacto bloqueado,
   * acceso cortado (`destinoDe` sólo lee). Igual que con el envío apagado, la sesión NO se marca y
   * ESPERA: si alguien le carga el teléfono o le reactiva el acceso mientras la llamada sigue en
   * ventana, la corrida siguiente le escribe. A Mauricio se le avisa UNA vez por motivo — la
   * clave de dedup lleva el resultado (`claveAvisoSesion`), así que cada hora no le repite «sin
   * teléfono» y el «ya le mandé» de cuando se arregla sí le llega.
   *
   * Si la LECTURA falla (la base, no el dato), `destinoDe` tira, la sesión tampoco se marca y la
   * próxima corrida reintenta: un error de lectura no es un motivo para darla por procesada.
   */
  const d = await destinoDe(f.lead_id, { envioOn: true });
  if (!d.ok) {
    await anotar(d.motivo);
    await avisarAlDueno(ctx, f, fase, c, d.motivo, compromisos);
    ctx.res.omitidos += 1;
    return;
  }

  if (!(await marcar(juntaResuelta(compromisos)))) return;   // otra corrida la tomó primero

  let noLlego: string | null = null;
  try {
    const fecha = new Date(f.fecha);
    const texto = fase === 'previo'
      ? textoPrevioCliente({ nombre: d.nombre, cuando: cuandoEs(fecha, ctx.ahora, ctx.tz), hora: horaDe(fecha, ctx.tz), etapa: c.etapa, pendientes: c.pendientes, link: d.link })
      // No es null: arriba ya se descartó el posterior sin pendientes.
      : textoPosteriorCliente({ nombre: d.nombre, etapa: c.etapa, pendientes: c.pendientes, link: d.link })!;
    const r = await mandar(d, f.lead_id, texto);
    if (!r.ok) noLlego = r.motivo ?? 'no salió';
  } catch (e) {
    // Ya está marcada: no se reintenta. Lo que queda es el motivo, para que la ficha lo diga.
    noLlego = 'falló el envío';
    console.error(`[curso-mensajes] sesión ${f.id} (${fase}):`, msg(e));
  }

  await anotar(noLlego);
  if (noLlego) ctx.res.omitidos += 1;
  else if (fase === 'previo') ctx.res.previos += 1;
  else ctx.res.posteriores += 1;
  await avisarAlDueno(ctx, f, fase, c, noLlego, compromisos);
}

/** Lo que le toca a una sesión en esta corrida: un mensaje de la llamada, o volver a buscar su junta. */
type Paso = FaseSesion | 'junta';

/** Las sesiones de UN workspace. Corre adentro de `runWithWorkspace(ws, …)`. */
async function procesarWorkspace(
  ws: number, items: Array<{ f: FilaSesion; paso: Paso }>, ahora: Date, res: Required<ResultadoSesiones>, conJunta: boolean,
): Promise<void> {
  // La hora del NEGOCIO, no la del server (UTC): «mañana a las 10» y el horario de 9 a 21 son de él.
  const tz = await tzDeWorkspace(ws);
  if (!enHorarioDeMensajes(ahora, tz)) {
    res.esperando += items.length;
    return;
  }
  const ctx: Ctx = { ws, tz, ahora, envioOn: await envioWhatsappHabilitado(), res, conJunta };
  for (const { f, paso } of items) {
    // Una sesión que falla no corta a las demás del mismo negocio.
    try {
      if (paso === 'junta') await procesarJunta(ctx, f);
      else await procesarSesion(ctx, f, paso);
    } catch (e) {
      res.errores.push(`ws${ws} sesión ${f.id}: ${msg(e)}`);
      console.error(`[curso-mensajes] ws${ws} sesión ${f.id}:`, msg(e));
    }
  }
}

/**
 * La JUNTA de una sesión cuyo posterior ya salió sin la grabación (ver `juntaPendiente`): se
 * vuelve a buscar y, si ya está leída, se le avisa a Mauricio en uno aparte. SÓLO a él: no
 * toca al cliente por ningún camino.
 *
 * Mismo orden que el resto del cron: la marca con compare-and-set ANTES de avisar. Sin la
 * grabación (o sin poder leerla) no se marca nada y la corrida siguiente vuelve a mirar; pasada
 * la ventana del posterior la sesión sale de la lectura y la junta queda en NULL.
 */
async function procesarJunta(ctx: Ctx, f: FilaSesion): Promise<void> {
  const compromisos = await compromisosDeLaSesion(f);
  if (!juntaResuelta(compromisos)) {
    ctx.res.juntasEsperando += 1;
    return;
  }
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_sesiones')
    .update({ aviso_junta_at: new Date().toISOString() })
    .eq('id', f.id).is('aviso_junta_at', null)
    .select('id');
  if (error) throw new Error(`no pude marcar la junta: ${error.message}`);
  if (!((data ?? []) as unknown[]).length) return;   // otra corrida la tomó primero
  // Se analizó y no dejó pasos: queda cerrada sin avisar (sería un aviso que no pide nada).
  if (!compromisos.pasos.length) return;
  const lead = await leerLead(f.lead_id);
  if (!lead) return;
  const cliente = (lead.nombre ?? '').trim() || `cliente ${lead.id}`;
  // El MISMO tipo que el posterior: si Mauricio apaga ese aviso, apaga también esto, que es
  // su continuación.
  const r = await emitirAviso({
    ws: ctx.ws,
    tipo: TIPO_AVISO.posterior,
    titulo: tituloAvisoJunta(cliente),
    texto: textoJuntaDueno({ cliente, pasos: compromisos.pasos }),
    categoria: 'aviso',
    semaforo: 'na',
    link: '/customer-success',
    dedupKey: claveAvisoJunta(f.id),
    dedupTtlMin: 72 * 60,
  });
  if (r.deduped) return;
  if (r.wa || r.email || r.agrupado) { ctx.res.avisosDueno += 1; ctx.res.juntas += 1; }
  else ctx.res.avisosDuenoSinSalir += 1;
}

/**
 * Lo corre el cron: los avisos del día antes y de después de cada llamada, de todos los workspaces.
 * Nunca tira: lo que falla vuelve en `errores`.
 *
 * ⚠️ LA ÚNICA LECTURA SIN INQUILINO ES LA DE ARRIBA, y sólo sirve para saber a quién visitar (el
 * molde de app/api/cron/avisos-programados): todo lo que lee o escribe datos de un cliente va
 * adentro de `runWithWorkspace(ws, …)`, con el workspace que dice LA FILA.
 */
export async function correrAvisosDeSesiones(ahora: Date = new Date()): Promise<ResultadoSesiones> {
  const res: Required<ResultadoSesiones> = {
    previos: 0, posteriores: 0, omitidos: 0, errores: [], esperando: 0,
    avisosDueno: 0, avisosDuenoSinSalir: 0, workspaces: 0, workspacesFallidos: [], lecturaFallida: false,
    juntas: 0, juntasEsperando: 0, sinMarcaDeJunta: false,
  };

  let filas: FilaSesion[];
  try {
    const { desde, hasta } = ventanaDeSesiones(ahora);
    // La junta abierta también trae la sesión (`aviso_junta_at.is.null`): su posterior ya salió,
    // pero la grabación puede llegar después (ver `juntaPendiente`).
    const leerSesiones = (cols: string, marcas: string) => getSupabaseServer().from('curso_sesiones').select(cols)
      .gte('fecha', desde).lte('fecha', hasta)
      .or(marcas)
      .order('fecha', { ascending: true })
      .limit(1000);
    let { data, error } = await leerSesiones(COLS_SESION, 'aviso_previo_at.is.null,aviso_posterior_at.is.null,aviso_junta_at.is.null');
    if (error && faltaLaMarcaDeJunta(error)) {
      // Sin la mig 0210 se lee como antes: los mensajes salen igual, y la junta se mira una vez.
      console.warn('[curso-mensajes] curso_sesiones sin aviso_junta_at (mig 0210): la junta no se reintenta');
      res.sinMarcaDeJunta = true;
      ({ data, error } = await leerSesiones(COLS_SESION_SIN_JUNTA, 'aviso_previo_at.is.null,aviso_posterior_at.is.null'));
    }
    if (error) throw new Error(error.message);
    filas = (data ?? []) as unknown as FilaSesion[];
  } catch (e) {
    res.lecturaFallida = true;
    res.errores.push(`no pude leer las sesiones: ${msg(e)}`);
    return res;
  }
  const conJunta = !res.sinMarcaDeJunta;

  // Qué le toca a cada una se decide ANTES de visitar a nadie (puro): una sesión en el rango de
  // fechas pero sin mensaje pendiente no despierta a su workspace.
  const porWs = new Map<number, Array<{ f: FilaSesion; paso: Paso }>>();
  for (const f of filas) {
    const fase = faseDeSesion({ fecha: f.fecha, avisoPrevioAt: f.aviso_previo_at, avisoPosteriorAt: f.aviso_posterior_at }, ahora);
    const paso: Paso | null = fase
      ?? (conJunta && juntaPendiente({ fecha: f.fecha, avisoPosteriorAt: f.aviso_posterior_at, avisoJuntaAt: f.aviso_junta_at ?? null }, ahora)
        ? 'junta' : null);
    if (!paso) continue;
    const ws = Number(f.workspace_id);
    if (!porWs.has(ws)) porWs.set(ws, []);
    porWs.get(ws)!.push({ f, paso });
  }
  if (!porWs.size) return res;

  // ⚠️ SÓLO WORKSPACES ACTIVOS, y fail-closed: un negocio pausado no le escribe a sus clientes. Si
  // no se puede saber cuáles están activos, no se manda nada esta hora (la siguiente reintenta).
  let activos: Set<number>;
  try {
    activos = new Set((await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id));
  } catch (e) {
    res.lecturaFallida = true;
    res.errores.push(`no pude leer los workspaces: ${msg(e)}`);
    return res;
  }

  for (const [ws, items] of porWs) {
    if (!activos.has(ws)) continue;
    res.workspaces += 1;
    try {
      await runWithWorkspace(ws, () => procesarWorkspace(ws, items, ahora, res, conJunta));
    } catch (e) {
      res.workspacesFallidos.push(ws);
      res.errores.push(`ws${ws}: ${msg(e)}`);
      console.error(`[curso-mensajes] ws${ws}:`, msg(e));
    }
  }
  return res;
}

// ── 4. El recordatorio de clases (el cron, #780) ─────────────────────────────
// Decisión de Martín (06/10/2026): por WhatsApp, a los 3 días sin entrar al portal, sólo los
// videos sin ver de su etapa. Lo puro (a quién, cuándo, qué dice) vive en
// lib/curso-mensajes-texto.ts; qué video cuenta como «sin ver», en `videosSinVer` (lib/curso.ts).
//
// ⚠️ EL ENVÍO DEL WS1 ESTÁ PRENDIDO: esto le escribe de verdad a los clientes de Mauricio. Por eso
// el orden es el de las llamadas, con las mismas cinco reglas:
//   1. SÓLO DESDE EL CRON. Ninguna pantalla, deploy ni migración lo dispara.
//   2. El interruptor del negocio (`envio_whatsapp_enabled`) y su horario (9 a 21, su zona) se
//      miran ANTES de todo; apagado o fuera de horario no se marca nada y se espera.
//   3. NUNCA CREA UN ACCESO: el universo es quien ya recibió su acceso (la invitación por mail o su
//      link por WhatsApp, `link_enviado_at`) o ya entró, y el link se firma sobre el acceso que
//      existe (`destinoDe` con `sinCrearAcceso`), nunca con `linkDeAcceso`.
//   4. Lo que se sabe SIN mandar (no hay videos pendientes, sin teléfono, sesión cerca, dado de
//      baja) se mira ANTES de marcar: no marca, así nada queda cerrado por un dato que se arregla.
//   5. LA MARCA CON COMPARE-AND-SET ANTES DE MANDAR (`recordatorio_at`, mig 0211), contra el valor
//      recién leído: dos corridas del mismo tick no le mandan dos veces. Si el envío falla después,
//      no se reintenta hasta el próximo turno — un recordatorio de menos se nota menos que dos.

const TIPO_AVISO_RECORDATORIO = 'curso-recordatorio-clases';

/**
 * Cuántos recordatorios, como mucho, salen en UNA corrida (todos los negocios juntos). No es por la
 * cuota de nadie: es el RITMO de la línea no oficial, que es lo que la protege de un baneo
 * (AGENTS.md, «el WhatsApp del chatbot es el NO OFICIAL»). Si el día que se invita a los 14
 * clientes les toca a todos a la vez, salen como mucho de a ocho por hora, y el resto en la corrida
 * siguiente. En la práctica corta antes el RELOJ (`ultimoInicioDeRecordatorio`): con 120 s de
 * función y la copia a Mauricio reservada quedan ~40 s para empezar envíos, unos 3 o 4 por hora.
 */
const TOPE_RECORDATORIOS_POR_CORRIDA = 8;

export type ResultadoRecordatorios = {
  /** Recordatorios que le LLEGARON al cliente (el envío contestó ok). */
  enviados: number;
  /** Se marcaron y el envío falló: el motivo queda en `recordatorio_motivo` y no se reintenta hasta el próximo turno. */
  noLlegaron: number;
  /** Le tocaba y no tiene videos sin ver en su etapa (o su etapa no tiene videos medibles): no se le escribe. */
  alDia: number;
  /** Graduado, baja o pausado en `cs_clientes`: no recibe nada. */
  fueraDelPrograma: number;
  /** Tiene una sesión de la entrega a menos de 48 h (antes o después): ya le escriben por ella. */
  conSesionCerca: number;
  /** No es cliente ganado, sin teléfono, bloqueado o sin acceso: se anota el motivo y NO se marca. */
  sinDestino: number;
  /** Fuera del horario del negocio: los toma la corrida siguiente. */
  esperando: number;
  /** El negocio tiene apagado el envío de WhatsApp: no se marca ni se avisa. */
  apagados: number;
  /** La lectura fresca dijo que ya no toca (entró recién, lo revocaron, u otra corrida lo tomó). */
  yaNoToca: number;
  /** Se cortó por el tope de la corrida (cantidad o tiempo): el resto, la hora siguiente. */
  topeAlcanzado: boolean;
  /** Copias a Mauricio que salieron (WhatsApp, mail o su resumen), y las que no salieron por ningún lado. */
  avisosDueno: number;
  avisosDuenoSinSalir: number;
  /** Workspaces visitados, y los que fallaron enteros (la hora siguiente reintenta). */
  workspaces: number;
  workspacesFallidos: number[];
  /** No se pudo leer `curso_accesos` (o la lista de workspaces): no se procesó nada. */
  lecturaFallida: boolean;
  /** La base todavía no tiene `recordatorio_at` (mig 0211 sin aplicar): no se recuerda nada. */
  sinColumna: boolean;
  errores: string[];
};

/** La fila de `curso_accesos` que lee el cron SIN inquilino: sólo para saber a quién visitar. */
type FilaAccesoCruzada = {
  id: number; workspace_id: number; lead_id: number; revocado_at: string | null; ingresos: number | null;
  ultimo_ingreso_at: string | null; invitacion_enviada_at: string | null; link_enviado_at: string | null;
  recordatorio_at: string | null;
};
const COLS_ACCESO_CRUZADA = 'id, workspace_id, lead_id, revocado_at, ingresos, ultimo_ingreso_at, invitacion_enviada_at, link_enviado_at, recordatorio_at';

/** La misma fila, releída ADENTRO del workspace: es la que decide y contra la que se hace el CAS. */
type FilaAccesoFresca = Omit<FilaAccesoCruzada, 'id' | 'workspace_id'> & { recordatorio_motivo: string | null };
const COLS_ACCESO_FRESCA = 'lead_id, revocado_at, ingresos, ultimo_ingreso_at, invitacion_enviada_at, link_enviado_at, recordatorio_at, recordatorio_motivo';

const paraRecordar = (f: Omit<FilaAccesoCruzada, 'id' | 'workspace_id'>): AccesoParaRecordar => ({
  revocado: f.revocado_at != null,
  ingresos: Number(f.ingresos) || 0,
  ultimoIngresoAt: f.ultimo_ingreso_at ?? null,
  invitacionEnviadaAt: f.invitacion_enviada_at ?? null,
  linkEnviadoAt: f.link_enviado_at ?? null,
  recordatorioAt: f.recordatorio_at ?? null,
});

/**
 * ¿El error es que la base todavía no tiene las columnas de la mig 0211? Un `select` con una
 * columna que no existe rechaza la consulta ENTERA: se distingue para decirlo (`sinColumna`) en vez
 * de leerlo como «la base se cayó». Incluye `link_enviado_at`: si se aplicó la 0211 de antes de la
 * revisión del 07/10/2026 (dos columnas), reaplicarla agrega la tercera.
 */
function faltaLaMarcaDeRecordatorio(mensaje: string): boolean {
  return /recordatorio_(at|motivo)|link_enviado_at/.test(mensaje) || /\b42703\b/.test(mensaje);
}

/** ¿Ya no queda tiempo para empezar otro recordatorio (y que entre la copia a Mauricio)? */
const sinTiempo = (ctl: ControlCorrida): boolean => Date.now() > ctl.hastaMs;

type ControlCorrida = { intentos: number; hastaMs: number };
type CacheCursos = { clases: Map<number, Clase[]>; rotulos: Map<number, Map<string, string>> };

/**
 * Los videos sin ver de su etapa ACTUAL, en cada curso que tiene (un bloque por producto con
 * algo pendiente). Vacío = no hay nada que recordarle.
 *
 * La etapa sale de `etapaActualDe`: la regla del kanban (sin fila = la primera), la misma del
 * portal y de los mensajes de las llamadas. Las clases y los rótulos se leen una vez por producto
 * y por corrida: son los mismos para todos los clientes del negocio.
 */
async function videosPendientesDe(leadId: number, cache: CacheCursos): Promise<BloqueVideos[]> {
  const { productos, casa } = await productosConCasaDelAlumno(leadId);
  const bloques: BloqueVideos[] = [];
  let progreso: Map<number, Progreso> | null = null;
  for (const productoId of productos) {
    let clases = cache.clases.get(productoId);
    if (!clases) { clases = await clasesDelProducto(productoId); cache.clases.set(productoId, clases); }
    if (!clases.length) continue;
    const etapa = await etapaActualDe(leadId, productoId, productos);
    if (!etapa) continue;
    const deLaEtapa = clases.filter((c) => c.etapa === etapa);
    if (!deLaEtapa.length) continue;
    progreso ??= await progresoDelCliente(leadId);
    const visto = progreso;
    // Sólo los videos que puede ABRIR (ver `abiertasDe`): sin poder evaluarlo, este curso no se nombra.
    const abiertas = await abiertasDe({ leadId, productoId, productos, casa, clases, progreso: visto });
    if (!abiertas) continue;
    const videos = videosSinVer(deLaEtapa.filter((c) => abiertas.has(c.id)), (id) => visto.get(id)?.pct);
    if (!videos.length) continue;
    let rotulos = cache.rotulos.get(productoId);
    if (!rotulos) {
      rotulos = new Map((await entregaDeProducto(productoId)).etapas.map((e) => [e.key, e.label]));
      cache.rotulos.set(productoId, rotulos);
    }
    bloques.push({ etapa: rotulos.get(etapa) ?? etapa, videos: videos.map((c) => c.titulo) });
  }
  return bloques;
}

/**
 * LA MARCA, CON COMPARE-AND-SET, ANTES DE MANDAR. Se escribe sólo si `recordatorio_at` sigue siendo
 * el que se acaba de leer (y el acceso no se revocó en el medio): la segunda corrida del mismo tick
 * no encuentra fila y no manda. `false` = otra la tomó.
 */
async function marcarRecordatorio(leadId: number, leido: string | null): Promise<boolean> {
  const db = await getTenantDb();
  const base = db.from('curso_accesos').update({ recordatorio_at: new Date().toISOString() })
    .eq('lead_id', leadId).is('area', null).is('revocado_at', null);
  const { data, error } = await (leido == null ? base.is('recordatorio_at', null) : base.eq('recordatorio_at', leido))
    .select('lead_id');
  if (error) throw new Error(`no pude marcar el recordatorio: ${error.message}`);
  return ((data ?? []) as unknown[]).length > 0;
}

/**
 * Anota por qué no le llegó el ÚLTIMO recordatorio (`null` = le llegó). Escribe sólo si cambió, y
 * devuelve si cambió: es lo que hace que «no le pude escribir» le llegue a Mauricio UNA vez por
 * motivo y no cada hora. Nunca tira: un motivo que no se anota no puede tumbar el recordatorio.
 */
async function anotarRecordatorio(leadId: number, previo: string | null, motivo: string | null): Promise<boolean> {
  const nuevo = motivo ? motivo.replace(/\s+/g, ' ').trim().slice(0, 200) : null;
  if ((previo ?? null) === nuevo) return false;
  try {
    const db = await getTenantDb();
    const { error } = await db.from('curso_accesos').update({ recordatorio_motivo: nuevo }).eq('lead_id', leadId).is('area', null);
    if (error) { console.error(`[curso-mensajes] recordatorio del lead ${leadId}: no pude anotar el motivo: ${error.message}`); return false; }
    return true;
  } catch (e) {
    console.error(`[curso-mensajes] recordatorio del lead ${leadId}: no pude anotar el motivo:`, msg(e));
    return false;
  }
}

type Corrida = {
  ahora: Date; res: ResultadoRecordatorios; ctl: ControlCorrida; cache: CacheCursos;
  hechos: Array<RecordatorioHecho & { leadId: number }>;
  sinEscribir: Array<RecordatorioSinEscribir & { leadId: number }>;
};

/** UN cliente. El orden es el del encabezado de la sección: lo que se sabe sin mandar, primero. */
async function recordarA(
  c: Corrida, leadId: number, f: FilaAccesoFresca | undefined, estado: string | null, sesiones: readonly string[],
): Promise<void> {
  const { ahora, res, ctl } = c;
  if (!f || !tocaRecordatorio(paraRecordar(f), ahora)) { res.yaNoToca += 1; return; }
  if (!sigueEnElPrograma(estado)) { res.fueraDelPrograma += 1; return; }
  if (sesionCerca(sesiones, ahora)) { res.conSesionCerca += 1; return; }

  // «Si no hay videos pendientes, no manda nada»: ni se marca ni se anota.
  const bloques = await videosPendientesDe(leadId, c.cache);
  if (!bloques.length) { res.alDia += 1; return; }

  const d = await destinoDe(leadId, { envioOn: true, sinCrearAcceso: true });
  if (!d.ok) {
    res.sinDestino += 1;
    if (await anotarRecordatorio(leadId, f.recordatorio_motivo, d.motivo)) {
      const lead = await leerLead(leadId).catch(() => null);
      c.sinEscribir.push({ leadId, cliente: (lead?.nombre ?? '').trim() || `cliente ${leadId}`, motivo: d.motivo });
    }
    return;
  }
  const texto = textoRecordatorioClases({ nombre: d.nombre, bloques, link: d.link });
  if (!texto) { res.alDia += 1; return; }

  // El tope va ANTES de la marca: un cliente que no entra en esta corrida no queda marcado. Y el
  // reloj se vuelve a mirar acá, no sólo al llegar a este cliente: sus lecturas también tardan.
  if (ctl.intentos >= TOPE_RECORDATORIOS_POR_CORRIDA || sinTiempo(ctl)) { res.topeAlcanzado = true; return; }
  if (!(await marcarRecordatorio(leadId, f.recordatorio_at))) { res.yaNoToca += 1; return; }   // otra corrida lo tomó
  ctl.intentos += 1;

  let noLlego: string | null = null;
  try {
    const r = await mandar(d, leadId, texto);
    if (!r.ok) noLlego = r.motivo ?? 'no salió';
  } catch (e) {
    // Ya está marcado: no se reintenta. Lo que queda es el motivo.
    noLlego = 'falló el envío';
    console.error(`[curso-mensajes] recordatorio del lead ${leadId}:`, msg(e));
  }
  await anotarRecordatorio(leadId, f.recordatorio_motivo, noLlego);
  if (noLlego) res.noLlegaron += 1; else res.enviados += 1;
  c.hechos.push({ leadId, cliente: (d.nombre ?? '').trim() || `cliente ${leadId}`, bloques, noLlego });
}

/** Los clientes de UN workspace a los que, según la lectura cruzada, les toca. Corre adentro de `runWithWorkspace(ws, …)`. */
async function recordarEnWorkspace(ws: number, leadIds: number[], ahora: Date, res: ResultadoRecordatorios, ctl: ControlCorrida): Promise<void> {
  // La hora del NEGOCIO, no la del server (UTC).
  const tz = await tzDeWorkspace(ws);
  if (!enHorarioDeMensajes(ahora, tz)) { res.esperando += leadIds.length; return; }
  if (!(await envioWhatsappHabilitado())) { res.apagados += leadIds.length; return; }

  // Tres lecturas para todo el negocio, adentro del inquilino. Si alguna falla, el negocio entero
  // espera a la hora siguiente: no se decide a quién escribirle con la mitad de los datos.
  const db = await getTenantDb();
  const v = ventanaDeSesionCerca(ahora);
  const [acc, est, ses] = await Promise.all([
    db.from('curso_accesos').select(COLS_ACCESO_FRESCA).in('lead_id', leadIds).is('area', null),
    db.from('cs_clientes').select('lead_id, estado').in('lead_id', leadIds),
    db.from('curso_sesiones').select('lead_id, fecha').in('lead_id', leadIds).gte('fecha', v.desde).lte('fecha', v.hasta),
  ]);
  if (acc.error) throw new Error(`curso_accesos: ${acc.error.message}`);
  if (est.error) throw new Error(`cs_clientes: ${est.error.message}`);
  if (ses.error) throw new Error(`curso_sesiones: ${ses.error.message}`);
  const accesos = new Map(((acc.data ?? []) as unknown as FilaAccesoFresca[]).map((f) => [Number(f.lead_id), f]));
  const estados = new Map(((est.data ?? []) as Array<{ lead_id: number; estado: string | null }>).map((f) => [Number(f.lead_id), f.estado]));
  const sesiones = new Map<number, string[]>();
  for (const s of (ses.data ?? []) as Array<{ lead_id: number; fecha: string }>) {
    const k = Number(s.lead_id);
    if (!sesiones.has(k)) sesiones.set(k, []);
    sesiones.get(k)!.push(String(s.fecha));
  }

  const c: Corrida = { ahora, res, ctl, cache: { clases: new Map(), rotulos: new Map() }, hechos: [], sinEscribir: [] };
  for (const leadId of leadIds) {
    // El reloj ANTES de cada cliente (revisión del 07/10/2026): sin tiempo no se empiezan ni sus
    // lecturas, y lo que queda es de la copia a Mauricio de abajo — que tiene su tiempo reservado
    // en `ultimoInicioDeRecordatorio` (lib/curso-mensajes-texto.ts).
    if (sinTiempo(ctl)) res.topeAlcanzado = true;
    if (res.topeAlcanzado) break;
    // Un cliente que falla no corta a los demás del mismo negocio.
    try {
      await recordarA(c, leadId, accesos.get(leadId), estados.get(leadId) ?? null, sesiones.get(leadId) ?? []);
    } catch (e) {
      res.errores.push(`ws${ws} recordatorio lead ${leadId}: ${msg(e)}`);
      console.error(`[curso-mensajes] ws${ws} recordatorio lead ${leadId}:`, msg(e));
    }
  }

  // UNA copia a Mauricio por corrida, con todos: a quién se le recordó qué.
  const texto = textoRecordatorioDueno({ hechos: c.hechos, sinEscribir: c.sinEscribir });
  if (!texto) return;
  const r = await emitirAviso({
    ws,
    tipo: TIPO_AVISO_RECORDATORIO,
    titulo: TITULO_AVISO_RECORDATORIO,
    texto,
    categoria: 'aviso',
    semaforo: c.sinEscribir.length || c.hechos.some((h) => h.noLlego) ? 'amarillo' : 'na',
    link: '/customer-success',
    dedupKey: claveAvisoRecordatorio(ws, [...c.hechos, ...c.sinEscribir].map((x) => x.leadId), ahora),
    dedupTtlMin: 60,
  });
  if (r.deduped) return;
  if (r.wa || r.email || r.agrupado) res.avisosDueno += 1;
  else res.avisosDuenoSinSalir += 1;
}

/**
 * Lo corre el cron horario (app/api/cron/curso-sesiones), DESPUÉS de las llamadas. Nunca tira: lo
 * que falla vuelve en `errores`. `hastaMs` es la hora (epoch) a partir de la cual no se empieza
 * ningún envío más: la función de Vercel tiene un tope y un envío por WhatsApp retiene segundos.
 *
 * ⚠️ LA ÚNICA LECTURA SIN INQUILINO ES LA DE ARRIBA, y sólo sirve para saber a quién visitar: todo
 * lo que decide, lee el detalle o escribe va adentro de `runWithWorkspace(ws, …)`, con el
 * workspace que dice LA FILA.
 */
export async function correrRecordatoriosDeClases(ahora: Date = new Date(), opts: { hastaMs?: number } = {}): Promise<ResultadoRecordatorios> {
  const res: ResultadoRecordatorios = {
    enviados: 0, noLlegaron: 0, alDia: 0, fueraDelPrograma: 0, conSesionCerca: 0, sinDestino: 0,
    esperando: 0, apagados: 0, yaNoToca: 0, topeAlcanzado: false,
    avisosDueno: 0, avisosDuenoSinSalir: 0, workspaces: 0, workspacesFallidos: [],
    lecturaFallida: false, sinColumna: false, errores: [],
  };
  const ctl: ControlCorrida = { intentos: 0, hastaMs: opts.hastaMs ?? Number.POSITIVE_INFINITY };
  if (Date.now() > ctl.hastaMs) { res.topeAlcanzado = true; return res; }

  let filas: FilaAccesoCruzada[];
  try {
    // El universo: NO revocados, y con su acceso dado (invitación por mail o link por WhatsApp) o
    // que ya entraron — el mismo de `enUniversoDeRecordatorio`. Paginado: es una fila por cliente
    // de todos los negocios, y PostgREST corta en 1000 sin avisar.
    filas = await leerTodo<FilaAccesoCruzada>(getSupabaseServer(), 'curso_accesos', COLS_ACCESO_CRUZADA, {
      filtros: (q) => q.is('area', null).is('revocado_at', null).or('invitacion_enviada_at.not.is.null,link_enviado_at.not.is.null,ingresos.gt.0'),
      orden: 'id',
    });
  } catch (e) {
    if (faltaLaMarcaDeRecordatorio(msg(e))) {
      console.warn('[curso-mensajes] curso_accesos sin recordatorio_at (mig 0211): el recordatorio de clases no corre');
      res.sinColumna = true;
      return res;
    }
    res.lecturaFallida = true;
    res.errores.push(`no pude leer los accesos: ${msg(e)}`);
    return res;
  }

  // A quién le toca se decide ANTES de visitar a nadie (puro): un negocio sin nadie a quien
  // recordarle no se despierta.
  const porWs = new Map<number, number[]>();
  for (const f of filas) {
    if (!tocaRecordatorio(paraRecordar(f), ahora)) continue;
    const ws = Number(f.workspace_id);
    if (!porWs.has(ws)) porWs.set(ws, []);
    porWs.get(ws)!.push(Number(f.lead_id));
  }
  if (!porWs.size) return res;

  // SÓLO WORKSPACES ACTIVOS, y fail-closed: un negocio pausado no le escribe a sus clientes.
  let activos: Set<number>;
  try {
    activos = new Set((await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id));
  } catch (e) {
    res.lecturaFallida = true;
    res.errores.push(`no pude leer los workspaces: ${msg(e)}`);
    return res;
  }

  for (const [ws, leadIds] of porWs) {
    if (!activos.has(ws)) continue;
    // Un negocio que arranca sin tiempo no lee nada: la copia del anterior ya salió (va al final
    // de `recordarEnWorkspace`) y éste no tendría a quién contarle.
    if (sinTiempo(ctl)) res.topeAlcanzado = true;
    if (res.topeAlcanzado) break;
    res.workspaces += 1;
    try {
      await runWithWorkspace(ws, () => recordarEnWorkspace(ws, leadIds, ahora, res, ctl));
    } catch (e) {
      res.workspacesFallidos.push(ws);
      res.errores.push(`ws${ws} recordatorios: ${msg(e)}`);
      console.error(`[curso-mensajes] ws${ws} recordatorios:`, msg(e));
    }
  }
  return res;
}
