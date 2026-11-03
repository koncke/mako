// =============================================================================
// api-mako/acciones — el ciclo de una acción: proponer → pendiente → confirmar
// =============================================================================
// Ninguna acción escribe directo (AGENTS.md: «un canal PROPONE; una persona
// confirma»). Lo que cambia entre canales es DÓNDE dice que sí la persona:
//
//   · `chat`     → una fila en mako_acciones_pendientes (mig 0085) con vencimiento
//                  de 2 h. La confirma una PERSONA: un «sí» aparte en el grupo de
//                  WhatsApp, o la bandeja /mako/pendientes de la app. Por HTTP solo
//                  la confirma un token acuñado con alcance `ejecutar`, con el `id`
//                  obligatorio, y queda registrado que vino por la API.
//   · `pantalla` → una fila en `propuestas` (mig 0128) y un LINK absoluto a la
//                  pantalla donde se mira, se corrige y se confirma. Las áreas que
//                  ya tienen pantalla propia (leads, tareas, borradores) usan la
//                  suya; el resto va a la genérica /mako/revisar/<id>, que pinta un
//                  formulario desde `parametros` y al confirmar llama `ejecutar()`.
//
// LA CLAVE DE SCOPE de una pendiente es `ctx.canalKey` (lib/api-mako/canal.ts).
// Un «sí» solo alcanza lo que se propuso en ESE canal. Dos excepciones, y las dos
// son lugares con una persona adelante: la BANDEJA de la app ve todo el workspace,
// y el grupo de WhatsApp ve además las que vinieron por la API del mismo workspace,
// marcadas. El chat de la app (sin bandeja) ve solo las suyas.
//
// ⚠️ CONFIRMAR RECLAMA ANTES DE EJECUTAR. Dos «sí» seguidos, dos pestañas o un
// cliente HTTP que reintenta por timeout leían la misma pendiente y ejecutaban dos
// veces (dos eventos en el historial; con presupuesto, plata). El update con
// `.eq('estado','pendiente')` es lo que hace que UNA sola gane; la otra recibe
// «ya estaba». Y si la ejecución explota a mitad, la pendiente queda en `error`
// con el motivo: nunca vuelve a `pendiente`, porque eso es cómo se duplican cosas.
//
// ⚠️ Y EL GATING SE VUELVE A MIRAR AL CONFIRMAR, no solo al proponer. Entre los dos
// momentos puede cambiar quién está (una pendiente que propuso el dueño por WhatsApp
// la ve un closer en la bandeja) y la capa del workspace. Si la guarda viviera solo
// al proponer, cada pantalla que confirma tendría que repetirla — y la primera que
// se olvide es la puerta.
// =============================================================================

import 'server-only';
import { crearPendiente, pendientesVigentes, pendientesDelWorkspace, reclamarPendiente, resolverPendiente, type Pendiente } from '@/lib/mako-pendientes';
import { crearPropuesta, getPropuesta, marcarAplicada, descartarPropuesta } from '@/lib/propuestas';
import { ejecutarAccion } from '@/lib/mako-doer-acciones';
import { tzDeWorkspace } from '@/lib/timezone';
import { linkPantalla } from '@/lib/api-mako/link';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { porId, gatingOk } from './registro';
import { runnerDe } from './runners';
import { distintoAlRevisar, validarInput } from './validar';
import { vistaDe } from './vista';
import { canalKeyDe, canalDeClave, etiquetaDeCanal, puedeConfirmar, PREFIJO_APP, PREFIJO_FLUJO } from './canal';
import { esAccion, type AccionDef, type AccionRun, type Ctx, type Ejecutado } from './tipos';
import { rechazoSiNoEsConfirmacionPura } from '@/lib/confirmacion-pura';
import { anotarEnHiloDeOrigen } from '@/lib/chat-hilo-origen';
import { bloqueDeResultado } from '@/lib/chat-bloques';
import { esReglaUOpinion, lineaDelTicket } from '../no-pude';
import { esFallaTragada } from '../no-pude-frases';
import { ticketDeNoPude } from '../no-pude-server';
import { invalidarGrafoChat } from '../cerebro-cache-chat';

/** Cuánto vive un «sí». Dos horas: alcanza para que el dueño conteste y no para que
 *  un «dale» de la tarde ejecute lo que se propuso a la mañana. */
export const TTL_PENDIENTE_MIN = 120;

/** La bandeja donde una persona ve y confirma toda pendiente del workspace. */
export const RUTA_BANDEJA = '/mako/pendientes';

/**
 * Los `tipo` que dejó el doer de WhatsApp ANTES del registro (los `case` de
 * `ejecutarAccion` en lib/mako-doer-acciones.ts). Mientras un área no declare su
 * `tipoPendiente`, una pendiente vigente con uno de estos se ejecuta por el camino
 * viejo en vez de morir con «operación desconocida». La lista es cerrada: un tipo
 * que no está acá y tampoco en el registro sí se cierra en error.
 *
 * `meta_presupuesto` NO está, a propósito: mueve plata y se confirma en PANTALLA. Si
 * un día ninguna def declarara ese slug, una pendiente vieja tiene que morir en error,
 * no caer al camino viejo y cambiar el presupuesto con un «sí» por WhatsApp.
 */
const TIPOS_HEREDADOS: ReadonlySet<string> = new Set([
  'lead_etapa', 'nutricion_toggle', 'meta_nombre', 'meta_estado', 'tareas_plan', 'agendar_reunion',
]);

const fmtFecha = (iso: string, tz: string): string => {
  try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return iso; }
};

// Un paso de un flujo (lib/api-mako/flujo.ts) deja la fila con el flujo como origen
// (`flujo:<aviso o secuencia>…`): es el rastro de qué hizo una automatización.
const origenDe = (ctx: Ctx): string => (ctx.canalKey.startsWith(PREFIJO_FLUJO)
  ? ctx.canalKey.slice(PREFIJO_APP.length)
  : ctx.canal === 'whatsapp' ? 'hola-mako' : ctx.canal === 'http' ? 'api' : 'app');

// ── chat: dejar una pendiente ─────────────────────────────────────────────────

type PropuestoChat = { pendiente: { id: number; resumen: string; venceEnMin: number; url: string } } | { error: string; motivo?: string };

export async function proponerChat(def: AccionDef, payload: Record<string, unknown>, resumen: string, ctx: Ctx): Promise<PropuestoChat> {
  const c = await crearPendiente(ctx.ws, {
    grupoJid: ctx.canalKey, tipo: def.tipoPendiente ?? def.id, payload, resumen,
    origen: origenDe(ctx), ttlMin: TTL_PENDIENTE_MIN,
    // Si el turno ya dejó una igual (el doer rotó de proveedor y volvió a correr), ésa.
    mismoTurnoDesde: ctx.turnStart,
    // En un grupo, quién la pidió: el «sí» de plata es de esa persona o le habla a MaKo (lib/confirmacion-pura.ts).
    pidio: ctx.enElGrupo?.quien,
  });
  // El motivo VIAJA (23/10/2026, el ws13): un paso de una automatización lo escribe en `nutricion_envios.error`, y
  // «no pude registrarla» sin él costó diez días de avisos perdidos con la causa en un log que nadie lee. Va APARTE
  // (`motivo`): a una persona por el chat o WhatsApp le llega la frase, no lo que contestó la base.
  if ('error' in c) return { error: ERROR_PENDIENTE, motivo: c.error };
  return { pendiente: { id: c.id, resumen, venceEnMin: TTL_PENDIENTE_MIN, url: linkPantalla(RUTA_BANDEJA, ctx.ws) } };
}

/** Lo que sale cuando la pendiente no entró (seguido de lo que contestó la base). */
export const ERROR_PENDIENTE = 'No se pudo registrar la acción pendiente.';

// ── pantalla genérica: dejar una propuesta con link ──────────────────────────

/** `input` = el input VALIDADO de la operación (no el payload preparado): es lo que
 *  la pantalla pinta como formulario y lo que se vuelve a preparar al confirmar. */
export async function proponerPantallaGenerica(def: AccionDef, input: Record<string, unknown>, resumen: string, ctx: Ctx, ref?: string | null) {
  const { id, nueva } = await crearPropuesta({
    ws: ctx.ws, tipo: 'accion', ref: ref ?? null,
    origen: ctx.canal === 'whatsapp' ? 'whatsapp' : ctx.canal === 'http' ? 'claude' : 'app',
    resumen,
    // `canalKey`: el chat de donde salió. Lo confirmado en /mako/revisar vuelve a ESE hilo (1.8, lib/chat-hilo-origen.ts).
    datos: { operacion: def.id, payload: input, resumen, canal: ctx.canal, ...(ctx.canalKey ? { canalKey: ctx.canalKey } : {}) },
  });
  return { propuesta: { id, url: linkPantalla(`/mako/revisar/${id}`, ctx.ws), nueva } };
}

/**
 * Lo que la pantalla genérica aplica al confirmar. El input puede venir EDITADO por
 * la persona (la pantalla es editable, es el punto): se VALIDA contra `parametros`
 * (solo lo declarado, con sus topes), se vuelve a mirar el gating, se vuelve a
 * preparar contra la base y recién después se ejecuta. `marcarAplicada` antes de
 * ejecutar es lo que hace que dos clicks creen UNA sola cosa.
 */
/** `sinAnotar`: el resultado lo anota otro (un trabajo largo, lib/chat-trabajos.ts, reescribe su «En curso»). */
/**
 * SI UNA ACCIÓN CONFIRMADA REVIENTA AL EJECUTARSE, QUEDA UN TICKET (27/10/2026, lib/no-pude.ts). Sólo el catch (la revisión del
 * 28/10/2026): «Esa decisión ya no estaba abierta» o «El email dejó de estar conectado» son negativas, no fallas. Sólo lo que confirmó una persona
 * en un chat (la app o WhatsApp): un flujo de Automations o Mensajes (`PREFIJO_FLUJO`) avisa por su lado y la API HTTP no tiene
 * a quién decírselo. Las guardas de antes de ejecutar son reglas y no llegan acá; una negativa legítima que devuelve el runner
 * (el rol, una clave, confirmar en pantalla) tampoco abre ticket. Devuelve el número si el ticket es nuevo. Nunca tira.
 */
async function ticketSiFallo(ctx: Ctx, operacion: string, herramienta: string, error: string): Promise<number | null> {
  if ((ctx.canal !== 'app' && ctx.canal !== 'whatsapp') || ctx.canalKey.startsWith(PREFIJO_FLUJO) || esReglaUOpinion(error)) return null;
  const t = await ticketDeNoPude('ejecucion', {
    ws: ctx.ws, actor: ctx.actor ?? null, superficie: ctx.canal === 'whatsapp' ? 'whatsapp' : 'ops-center', conv: ctx.canalKey, pedido: ctx.mensajeUsuario ?? '',
  }, { operacion, herramienta, error });
  return t && t.nuevo ? t.id : null;
}

export async function aplicarPropuestaGenerica(propuestaId: string, inputEditado: Record<string, unknown> | null, ctx: Ctx, opciones?: { sinAnotar?: true }): Promise<Ejecutado> {
  return runWithWorkspace(ctx.ws, async () => {
    const prop = await getPropuesta(propuestaId);
    if (!prop || prop.tipo !== 'accion') return { ok: false, resumen: 'La propuesta no existe en este workspace.' };
    if (prop.estado !== 'pendiente') return { ok: false, resumen: `Esta propuesta ya está ${prop.estado}.` };
    const opId = String(prop.datos.operacion ?? '');
    const def = porId(opId);
    const run = runnerDe(def?.id ?? '');
    if (!def || !esAccion(def) || !run || !('ejecutar' in run) || !run.preparar) return { ok: false, resumen: `La operación «${opId}» ya no existe.` };
    if (!gatingOk(def, await vistaDe(ctx))) return { ok: false, resumen: 'Esta acción no está disponible para tu usuario en este workspace.' };

    const base = (prop.datos.payload ?? {}) as Record<string, unknown>;
    // ⚠️ LO QUE DICE SOBRE QUÉ SE HACE NO SE EDITA AL REVISAR (`fijoAlRevisar`, 15/10/2026): el resumen que la persona
    // confirma se armó con el valor guardado, y cambiarlo ejecutaba la acción sobre otro con el título del primero
    // (devolverle la plata a otro cliente). Un valor distinto se rechaza; uno vacío vuelve al guardado.
    let editado = inputEditado;
    for (const p of editado ? def.parametros : []) {
      if (!p.fijoAlRevisar || !editado || !(p.nombre in editado)) continue;
      const nuevo = editado[p.nombre];
      if (nuevo == null || nuevo === '') { editado = { ...editado, [p.nombre]: base[p.nombre] }; continue; }
      if (distintoAlRevisar(nuevo, base[p.nombre])) {
        return { ok: false, resumen: `«${p.rotulo ?? p.nombre}» no se puede cambiar al revisar: el resumen es de ése. Si es otro, pídeselo de nuevo a MaKo.` };
      }
    }
    const v = validarInput(def.parametros, editado ? { ...base, ...editado } : base, 'json');
    if ('error' in v) return { ok: false, resumen: v.error };
    const prep = await run.preparar(v.input, ctx);
    if ('error' in prep) return { ok: false, resumen: prep.error };
    // Igual que al confirmar una pendiente: lo que se sabe sin escribir se mira antes de marcarla aplicada.
    const falta = await run.faltaParaConfirmar?.(prep.payload, ctx);
    if (falta) return { ok: false, resumen: typeof falta === 'string' ? falta : falta.yaNoVale };

    const mia = await marcarAplicada(propuestaId, { en_curso: true, por: ctx.actor ?? null });
    if (!mia) return { ok: false, resumen: 'Esta propuesta ya se estaba aplicando.' };
    let r: Ejecutado;
    /** Reventó al ejecutar (el catch): lo único que abre ticket. Un ok:false del runner es una negativa de estado o de configuración. */
    let reventoAlEjecutar = false;
    try { r = await run.ejecutar(prep.payload, ctx); }
    catch (err) { reventoAlEjecutar = true; r = { ok: false, resumen: `No se pudo aplicar (${err instanceof Error ? err.message : 'error'}).` }; }
    // El resultado final pisa el «en curso». Si falló, queda aplicada con el error
    // escrito: volver a `pendiente` sería invitar a un segundo click sobre algo que
    // pudo haber escrito a medias.
    await marcarResultado(propuestaId, { resumen: r.resumen, ok: r.ok, por: ctx.actor ?? null, ...(r.datos ?? {}) });
    // Lo que acaba de cambiar se lee en el turno siguiente: el grafo de los chats de este negocio se vuelve a armar (aun si
    // falló: pudo escribir a medias). lib/cerebro-cache-chat.ts.
    invalidarGrafoChat(ctx.ws);
    // Si falló al ejecutarse, el ticket (`ticketSiFallo`) y su línea van con el «No se pudo».
    const ticket = reventoAlEjecutar || (!r.ok && esFallaTragada(r.resumen)) ? await ticketSiFallo(ctx, def.titulo, def.id, r.resumen) : null;
    if (ticket) r = { ...r, resumen: `${r.resumen} ${lineaDelTicket(ticket)}` };
    // El chat de donde salió se entera, con lo que dibuja el resultado: como si se hubiera confirmado en su tarjeta.
    const bloque = r.ok ? bloqueDeResultado(r.datos) : null;
    if (!opciones?.sinAnotar) await anotarEnHiloDeOrigen(prop.datos.canalKey, r.ok ? `Hecho: ${r.resumen}` : `No se pudo: ${r.resumen}`, bloque ? [bloque] : []);
    return r;
  });
}

async function marcarResultado(id: string, resultado: Record<string, unknown>): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('propuestas').update({ resultado }).eq('id', id);
  if (error) console.error(`[api-mako] no pude guardar el resultado de la propuesta ${id}:`, error.message);
}

export async function descartarPropuestaGenerica(propuestaId: string, ctx: Ctx): Promise<void> {
  await runWithWorkspace(ctx.ws, async () => {
    const prop = await getPropuesta(propuestaId);
    await descartarPropuesta(propuestaId);
    if (prop) await anotarEnHiloDeOrigen(prop.datos.canalKey, `No se ejecutó (se descartó en su pantalla): ${prop.resumen}`);
  });
}

// ── pendientes: listar, confirmar, cancelar ──────────────────────────────────

/** Qué ve cada canal. Todo lo que no es la bandeja ni WhatsApp ve SOLO su clave. */
async function vigentesPara(ctx: Ctx): Promise<Pendiente[]> {
  if (ctx.bandeja) return pendientesDelWorkspace(ctx.ws);
  if (ctx.canal === 'whatsapp') {
    const [grupo, api] = await Promise.all([
      pendientesVigentes(ctx.ws, ctx.canalKey),
      pendientesVigentes(ctx.ws, canalKeyDe('http', ctx.ws)),
    ]);
    return [...grupo, ...api].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  return pendientesVigentes(ctx.ws, ctx.canalKey);
}

export async function listarPendientes(ctx: Ctx) {
  const vig = await vigentesPara(ctx);
  const tz = await tzDeWorkspace(ctx.ws);
  return vig.map((p) => ({
    id: p.id, operacion: p.tipo, resumen: p.resumen,
    origen: etiquetaDeCanal(p.grupoJid), canal: canalDeClave(p.grupoJid),
    vence: fmtFecha(p.venceAt, tz), venceAt: p.venceAt, creada: p.createdAt,
  }));
}

type Elegida = { pendiente: Pendiente } | { error: string; vigentes?: Array<{ id: number; resumen: string }> };

/** Cuál pendiente quiso decir. En WhatsApp, sin id vale si hay una sola; en la app
 *  y por HTTP el id es obligatorio: todas las llamadas del workspace comparten
 *  cola, y «la única» de uno puede ser la de otro. */
async function elegir(ctx: Ctx, id: number | null, verbo: 'confirmar' | 'cancelar'): Promise<Elegida> {
  const vig = await vigentesPara(ctx);
  if (!vig.length) return { error: `No hay ninguna acción pendiente vigente para ${verbo}.` };
  const lista = vig.map((p) => ({ id: p.id, resumen: p.resumen }));
  if (id == null && ctx.canal !== 'whatsapp') return { error: 'Di cuál (el id es obligatorio en este canal).', vigentes: lista };
  const target = id != null ? vig.find((p) => p.id === id) : (vig.length === 1 ? vig[0] : undefined);
  if (target) return { pendiente: target };
  if (id != null) return { error: `No encuentro la acción #${id} vigente.`, vigentes: lista };
  return { error: `Hay ${vig.length} acciones pendientes, aclara cuál.`, vigentes: lista };
}

export async function cancelarPendiente(ctx: Ctx, id: number | null) {
  const e = await elegir(ctx, id, 'cancelar');
  if ('error' in e) return e;
  const tocada = await resolverPendiente(ctx.ws, e.pendiente.id, 'cancelada', `cancelada desde ${ctx.canal}${ctx.actor ? ` por ${ctx.actor}` : ''}`, { soloSiPendiente: true });
  if (!tocada) return { error: 'Esa acción ya estaba resuelta.' };
  return { ok: true as const, id: e.pendiente.id, resumen: `Cancelada: ${e.pendiente.resumen}` };
}

export async function confirmarPendiente(ctx: Ctx, id: number | null) {
  if (!puedeConfirmar(ctx.canal, ctx.alcance, ctx.bandeja)) {
    return { error: 'Este token propone pero no ejecuta: la persona confirma la acción en MaKo (bandeja de pendientes) o por WhatsApp.' };
  }
  const e = await elegir(ctx, id, 'confirmar');
  if ('error' in e) return e;
  const p = e.pendiente;
  const creada = Date.parse(p.createdAt);

  // Anti auto-confirm. En WhatsApp y en la app, una pendiente creada en ESTE turno
  // no se confirma en él: el «sí» es un mensaje aparte. 1,5 s de margen por el
  // skew reloj-app/base. Es el candado del caso que rompió todo (ver la cabecera
  // de mako-doer-acciones.ts, `CONFIRMACION_PELADA`).
  if (ctx.turnStart && Number.isFinite(creada) && creada >= ctx.turnStart - 1500) {
    return { error: 'Recién propuse esa acción en este mismo mensaje. NO la confirmes tú: frena y espera a que la persona mande un «sí» aparte.' };
  }

  const def = porId(p.tipo);
  const run = runnerDe(def?.id ?? '');
  const registrada = !!(def && esAccion(def) && run && 'ejecutar' in run);

  // Lo que se confirma en PANTALLA no se confirma acá, venga de donde venga la
  // pendiente: una tool vieja con el mismo slug (proponer_presupuesto_campana dejaba
  // `meta_presupuesto`), una fila de antes del registro. Se cierra sin ejecutar:
  // dejarla viva invita a un segundo «sí» sobre algo que no se va a hacer.
  if (registrada && (def as AccionDef).confirmacion === 'pantalla') {
    await resolverPendiente(ctx.ws, p.id, 'error', 'se confirma en pantalla, no por chat', { soloSiPendiente: true });
    return { error: 'Esta acción se confirma en su pantalla de revisión, no por el chat: la pendiente quedó cerrada sin ejecutar. Pide la propuesta de nuevo y confírmala en el link.' };
  }

  // Lo que LE LLEGA A OTRA PERSONA (un email, un WhatsApp, una invitación) y se confirma por WhatsApp pide un «sí» y nada más: «ok, esperá que
  // lo reviso» no lo ejecuta. La pendiente sigue viva; el rechazo vuelve al modelo, que repregunta mostrando qué va a salir (lib/confirmacion-pura.ts).
  const rechazoATercero = rechazoSiNoEsConfirmacionPura({
    canal: ctx.canal, aTerceros: def && esAccion(def) ? def.aTerceros : undefined, plata: def && esAccion(def) ? def.plata : undefined, mensaje: ctx.mensajeUsuario, titulo: def?.titulo ?? p.tipo, resumen: p.resumen,
    enElGrupo: ctx.enElGrupo ? { pidio: p.pidio ?? null, confirma: ctx.enElGrupo.quien, aMaKo: ctx.enElGrupo.aMaKo } : undefined,
    id: def?.id,
  });
  if (rechazoATercero) return { error: rechazoATercero };

  if (!registrada) {
    // Una heredada que ningún área declaró todavía: se ejecuta por el camino viejo,
    // que es por donde se propuso. Nunca por HTTP (ese canal solo ve lo que el
    // registro creó) y nunca un tipo fuera de la lista cerrada.
    if (!TIPOS_HEREDADOS.has(p.tipo) || ctx.canal === 'http') {
      await resolverPendiente(ctx.ws, p.id, 'error', `operación desconocida: ${p.tipo}`, { soloSiPendiente: true });
      return { error: `La acción «${p.tipo}» ya no existe en MaKo; la pendiente quedó cerrada.` };
    }
  } else if (!gatingOk(def as AccionDef, await vistaDe(ctx))) {
    // No se resuelve: la pendiente sigue ahí para quien sí puede confirmarla.
    return { error: 'Esta acción no está disponible para tu usuario en este workspace; la tiene que confirmar el administrador.' };
  }

  // Lo que se puede saber sin escribir se mira ANTES de reclamar: reclamar quema la pendiente, y un «sí» que no se puede cumplir
  // (una escritura firmada que llega sin nadie que firme) no la puede dejar en `error`: sigue ahí para quien sí la confirma.
  if (registrada) {
    const falta = await (run as Pick<AccionRun, 'faltaParaConfirmar'>).faltaParaConfirmar?.(p.payload, ctx);
    // La que ya no se puede cumplir nunca se cierra: viva, el «sí» siguiente chocaba con la que se pidió de nuevo (B12).
    if (falta && typeof falta !== 'string') {
      await resolverPendiente(ctx.ws, p.id, 'error', falta.yaNoVale, { soloSiPendiente: true });
      return { error: falta.yaNoVale };
    }
    if (falta) return { error: falta };
  }

  // RECLAMAR: una sola confirmación gana. 0 filas = otra ya la tomó (o venció).
  const mia = await reclamarPendiente(ctx.ws, p.id);
  if (!mia) return { error: 'Esa acción ya se estaba ejecutando o ya venció.' };

  let r: Ejecutado;
  /** Reventó al ejecutar (el catch): lo único que abre ticket (la revisión del 28/10/2026). */
  let reventoAlEjecutar = false;
  try {
    r = registrada
      ? await (run as { ejecutar: (payload: Record<string, unknown>, ctx: Ctx) => Promise<Ejecutado> }).ejecutar(p.payload, ctx)
      : await ejecutarAccion(ctx.ws, p.tipo, p.payload);
  } catch (err) { reventoAlEjecutar = true; r = { ok: false, resumen: `No pude ejecutarlo (${err instanceof Error ? err.message : 'error'}).` }; }
  // El detalle que el modelo no puede ver (lib/agenda-sin-ia.ts) va directo a la
  // persona. El `resumen` se guarda en la fila y vuelve al modelo: ése no lo lleva.
  if (r.paraLaPersona) ctx.aPersona?.(r.paraLaPersona);
  const quien =ctx.canal === 'http' ? ' (confirmado por la API)' : ctx.actor ? ` (confirmado por ${ctx.actor})` : '';
  await resolverPendiente(ctx.ws, p.id, r.ok ? 'ejecutada' : 'error', `${r.resumen}${quien}`);
  // Lo que acaba de cambiar se lee en el turno siguiente (también el flujo y la escritura directa de la API, que pasan por acá).
  invalidarGrafoChat(ctx.ws);
  // Si falló al ejecutarse, el ticket (`ticketSiFallo`): su línea va en el resumen, que leen la tarjeta de la app (también por
  // detrás, `enSegundoPlano`) y `confirmar_accion` de WhatsApp. El modelo la puede repetir: no dice «no pude» (anti-bucle).
  // O lo que el runner se TRAGÓ (`esFallaTragada`, lib/no-pude-frases.ts): los `sinLanzar`, ejecutarAccion, agendar.
  const ticket = reventoAlEjecutar || (!r.ok && esFallaTragada(r.resumen)) ? await ticketSiFallo(ctx, def?.titulo ?? p.tipo, p.tipo, r.resumen) : null;
  const resumen = ticket ? `${r.resumen} ${lineaDelTicket(ticket)}` : r.resumen;
  return { ok: r.ok, id: p.id, tipo: p.tipo, resumen, ...(ticket ? { ticket } : {}), ...(r.datos ? { datos: r.datos } : {}) };
}
