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
// (Mauricio) está en 'false' desde el 29/09/2026: mientras siga así, NADA de esto le llega a un
// cliente, y el motivo vuelve escrito («envío de WhatsApp apagado») para que la pantalla lo
// diga en vez de mostrar un «enviado» que no pasó. Es el mismo interruptor que respeta el motor
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
import { entregaDeProducto } from './entrega-servicio';
import { emitirAviso } from './avisos';
import { linkDeAcceso, clasesDelProducto, progresoDelCliente, etapaActualDe, productosDelAlumno } from './curso-datos';
import { etapaCompleta, pendientesDe, type Clase } from './curso';
import { etapaAnterior } from './curso-avance-regla';
import {
  textoLinkCurso, textoEntradaAEtapa, textoPrevioCliente, textoPosteriorCliente,
  textoPrevioDueno, textoPosteriorDueno, tituloAvisoDueno,
  faseDeSesion, ventanaDeSesiones, enHorarioDeMensajes, cuandoEs, horaDe, conMotivoDeFase, type FaseSesion,
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
async function destinoDe(leadId: number, opts: { porQuien?: string | null; envioOn?: boolean } = {}): Promise<Destino> {
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
  const link = await linkDeAcceso(leadId, ws, opts.porQuien ?? null);
  if (!link) return { ok: false, motivo: 'acceso cortado' };
  return { ok: true, ws, nombre: lead.nombre, telefono, link };
}

async function mandar(d: Extract<Destino, { ok: true }>, leadId: number, texto: string): Promise<ResultadoEnvio> {
  const r = await enviarYEspejar({ telefono: d.telefono, texto, leadId });
  return r.ok ? { ok: true } : { ok: false, motivo: r.error?.trim() || 'no salió' };
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
    const [entrega, clases, progreso] = await Promise.all([
      entregaDeProducto(p.productoId), clasesDelProducto(p.productoId), progresoDelCliente(p.leadId),
    ]);
    const claves = entrega.etapas.map((e) => e.key);
    if (!claves.includes(p.etapa)) return { ok: false, motivo: 'esa etapa no es de la entrega' };
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
};

const COLS_SESION = 'id, workspace_id, lead_id, producto_id, fecha, aviso_previo_at, aviso_posterior_at, aviso_motivo';

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

async function contenidoDe(f: FilaSesion): Promise<Contenido> {
  const lead = await leerLead(f.lead_id);
  if (!lead) return { ok: false, motivo: 'el cliente no existe' };
  if (lead.estado_lead !== 'ganado') return { ok: false, motivo: 'no es cliente ganado' };
  const curso = await cursoDeLaSesion(f.lead_id, f.producto_id);
  if (!curso || !curso.clases.length) return { ok: false, motivo: 'su curso no tiene clases' };
  const [etapa, progreso, entrega] = await Promise.all([
    etapaActualDe(f.lead_id, curso.productoId), progresoDelCliente(f.lead_id), entregaDeProducto(curso.productoId),
  ]);
  if (!etapa) return { ok: false, motivo: 'no está en la entrega de su servicio' };
  const deLaEtapa = curso.clases.filter((c) => c.etapa === etapa);
  // `null` = la etapa no tiene clases cargadas: ni «te falta» ni «vas al día» serían verdad.
  const pendientes = deLaEtapa.length ? pendientesDe(deLaEtapa, (id) => progreso.get(id)?.estado).map((c) => c.titulo) : null;
  return {
    ok: true, lead, cliente: (lead.nombre ?? '').trim() || `cliente ${lead.id}`,
    etapa: entrega.etapas.find((e) => e.key === etapa)?.label ?? etapa, pendientes,
  };
}

type Ctx = { ws: number; tz: string; ahora: Date; envioOn: boolean; res: Required<ResultadoSesiones> };

/** El aviso a Mauricio. Nunca tira (`emitirAviso` tampoco). Uno por sesión y fase: el dedup es por sesión. */
async function avisarAlDueno(ctx: Ctx, f: FilaSesion, fase: FaseSesion, c: Extract<Contenido, { ok: true }>, noLlego: string | null): Promise<void> {
  const fecha = new Date(f.fecha);
  const texto = fase === 'previo'
    ? textoPrevioDueno({ cliente: c.cliente, cuando: cuandoEs(fecha, ctx.ahora, ctx.tz), hora: horaDe(fecha, ctx.tz), etapa: c.etapa, pendientes: c.pendientes, noLlego })
    : textoPosteriorDueno({ cliente: c.cliente, etapa: c.etapa, pendientes: c.pendientes, noLlego });
  const r = await emitirAviso({
    ws: ctx.ws,
    tipo: TIPO_AVISO[fase],
    titulo: tituloAvisoDueno(fase, c.cliente),
    texto,
    categoria: 'aviso',
    semaforo: c.pendientes == null ? 'na' : c.pendientes.length ? 'amarillo' : 'verde',
    link: '/customer-success',
    // ⚠️ EL DEDUP ES LO QUE HACE SEGURO REPETIRLO: con el envío al cliente apagado, la sesión NO se
    // marca (ver abajo) y el cron vuelve a pasar cada hora. La clave es la sesión, no el tipo: con
    // sólo el tipo, el aviso de un cliente se comería el de otro durante la ventana.
    dedupKey: `sesion:${f.id}`,
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
   */
  const marcar = async (): Promise<boolean> => {
    const { data, error } = await db.from('curso_sesiones')
      .update({ [columna]: new Date().toISOString() })
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
    if (await marcar()) await anotar(c.motivo);
    ctx.res.omitidos += 1;
    return;
  }

  // Después de la llamada SIN pendientes no se le escribe: no hay nada que pedirle, y un «gracias,
  // no te falta nada» por cada llamada es un mensaje de más. A Mauricio tampoco: su resumen sería
  // «al día», y eso ya se lo dijo el previo.
  if (fase === 'posterior' && !c.pendientes?.length) {
    if (await marcar()) await anotar(c.pendientes == null ? 'su etapa no tiene clases, no se le escribió' : 'al día, no se le escribió');
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
    await avisarAlDueno(ctx, f, fase, c, MOTIVO_APAGADO);
    ctx.res.omitidos += 1;
    return;
  }

  if (!(await marcar())) return;   // otra corrida la tomó primero

  let noLlego: string | null = null;
  try {
    const d = await destinoDe(f.lead_id, { envioOn: true });
    if (!d.ok) noLlego = d.motivo;
    else {
      const fecha = new Date(f.fecha);
      const texto = fase === 'previo'
        ? textoPrevioCliente({ nombre: d.nombre, cuando: cuandoEs(fecha, ctx.ahora, ctx.tz), hora: horaDe(fecha, ctx.tz), etapa: c.etapa, pendientes: c.pendientes, link: d.link })
        // No es null: arriba ya se descartó el posterior sin pendientes.
        : textoPosteriorCliente({ nombre: d.nombre, etapa: c.etapa, pendientes: c.pendientes, link: d.link })!;
      const r = await mandar(d, f.lead_id, texto);
      if (!r.ok) noLlego = r.motivo ?? 'no salió';
    }
  } catch (e) {
    // Ya está marcada: no se reintenta. Lo que queda es el motivo, para que la ficha lo diga.
    noLlego = 'falló el envío';
    console.error(`[curso-mensajes] sesión ${f.id} (${fase}):`, msg(e));
  }

  await anotar(noLlego);
  if (noLlego) ctx.res.omitidos += 1;
  else if (fase === 'previo') ctx.res.previos += 1;
  else ctx.res.posteriores += 1;
  await avisarAlDueno(ctx, f, fase, c, noLlego);
}

/** Las sesiones de UN workspace. Corre adentro de `runWithWorkspace(ws, …)`. */
async function procesarWorkspace(ws: number, items: Array<{ f: FilaSesion; fase: FaseSesion }>, ahora: Date, res: Required<ResultadoSesiones>): Promise<void> {
  // La hora del NEGOCIO, no la del server (UTC): «mañana a las 10» y el horario de 9 a 21 son de él.
  const tz = await tzDeWorkspace(ws);
  if (!enHorarioDeMensajes(ahora, tz)) {
    res.esperando += items.length;
    return;
  }
  const ctx: Ctx = { ws, tz, ahora, envioOn: await envioWhatsappHabilitado(), res };
  for (const { f, fase } of items) {
    // Una sesión que falla no corta a las demás del mismo negocio.
    try { await procesarSesion(ctx, f, fase); }
    catch (e) {
      res.errores.push(`ws${ws} sesión ${f.id}: ${msg(e)}`);
      console.error(`[curso-mensajes] ws${ws} sesión ${f.id}:`, msg(e));
    }
  }
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
  };

  let filas: FilaSesion[];
  try {
    const { desde, hasta } = ventanaDeSesiones(ahora);
    const { data, error } = await getSupabaseServer().from('curso_sesiones').select(COLS_SESION)
      .gte('fecha', desde).lte('fecha', hasta)
      .or('aviso_previo_at.is.null,aviso_posterior_at.is.null')
      .order('fecha', { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    filas = (data ?? []) as FilaSesion[];
  } catch (e) {
    res.lecturaFallida = true;
    res.errores.push(`no pude leer las sesiones: ${msg(e)}`);
    return res;
  }

  // Qué le toca a cada una se decide ANTES de visitar a nadie (puro): una sesión en el rango de
  // fechas pero sin mensaje pendiente no despierta a su workspace.
  const porWs = new Map<number, Array<{ f: FilaSesion; fase: FaseSesion }>>();
  for (const f of filas) {
    const fase = faseDeSesion({ fecha: f.fecha, avisoPrevioAt: f.aviso_previo_at, avisoPosteriorAt: f.aviso_posterior_at }, ahora);
    if (!fase) continue;
    const ws = Number(f.workspace_id);
    if (!porWs.has(ws)) porWs.set(ws, []);
    porWs.get(ws)!.push({ f, fase });
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
      await runWithWorkspace(ws, () => procesarWorkspace(ws, items, ahora, res));
    } catch (e) {
      res.workspacesFallidos.push(ws);
      res.errores.push(`ws${ws}: ${msg(e)}`);
      console.error(`[curso-mensajes] ws${ws}:`, msg(e));
    }
  }
  return res;
}
