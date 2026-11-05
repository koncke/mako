// =============================================================================
// api-mako/ejecutar — el choke point: UNA función corre cualquier operación
// =============================================================================
// Por acá pasan los tres canales (HTTP, WhatsApp, la app). Decide si la operación
// EXISTE para quien pide (canal, alcance, gating: todo en positivo, y a quien no le
// corresponde le contesta 404, no 403), valida el input contra la definición (solo
// lo declarado, con su tipo), corre el runner ADENTRO del workspace del contexto y
// normaliza la salida.
//
// ⚠️ El wrap del workspace lo hace ESTA función, no el transporte, y antes de correr
// el runner comprueba que el workspace en curso sea el del contexto. Fuera del store,
// `getWorkspaceActual()` cae a OWNER_WS (Mauricio, un cliente) y `settings.ts` hace
// `?? OWNER_WS`: un runner que corriera afuera leería y escribiría en el workspace
// equivocado SIN NINGÚN ERROR. Una línea convierte esa convención en un guard.
//
// Los errores del que llama (parámetro mal, id que no existe en ESTE workspace)
// salen como 400 con un mensaje que dice QUÉ, porque lo lee un agente que se
// corrige solo. Los nuestros, 500 y con un texto genérico: el detalle (nombres de
// tablas, errores de PostgREST) queda en la consola, no viaja a un tercero.
// =============================================================================

import 'server-only';
import { runWithWorkspace, getWorkspaceActual } from '@/lib/workspace';
import { linkPantalla } from '@/lib/api-mako/link';
import { porId, visible, type Vista } from './registro';
import { runnerDe } from './runners';
import { validarInput } from './validar';
import { vistaDe } from './vista';
import { proponerChat, proponerPantallaGenerica, TTL_PENDIENTE_MIN, RUTA_BANDEJA } from './acciones';
import { esAccion, esControl, esLectura, type Ctx, type Falta, type Resultado } from './tipos';
import { conexion } from '@/lib/conexiones-catalogo';
import { sanearBloque } from '@/lib/chat-bloques';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { conHorasDelNegocio } from './horas-del-negocio';
import { registrarAccionMako } from '@/lib/actividad-registro';

export { vistaDe };

/** ¿El texto de un error huele a infraestructura nuestra? Decide 500 vs 400. */
const esNuestro = (msg: string): boolean =>
  /api-mako:|fetch failed|ECONN|timeout|supabase|PGRST|permission denied|relation .* does not exist|column .* does not exist/i.test(msg)
  // Lo que Postgres dice con sus palabras: las libs lo envuelven en «Query X falló: …»
  // y sin esto salía como 400 al tercero, con nombres de tablas y columnas adentro.
  || /invalid input syntax|violates .*constraint|duplicate key|null value in column|syntax error at|operator does not exist|row-level security|^Query .* falló/i.test(msg);

export async function ejecutarOperacion(
  id: string,
  inputCrudo: Record<string, unknown> | null | undefined,
  ctx: Ctx,
  origen: 'query' | 'json',
  /** la vista ya calculada por el transporte, para no leer el workspace dos veces */
  vistaPrevia?: Vista,
): Promise<Resultado> {
  const r = await correrOperacion(id, inputCrudo, ctx, origen, vistaPrevia);
  // Admin › Activity (5/11/2026): QUÉ hizo MaKo, por qué canal y si salió (lib/actividad.ts). Sin los parámetros ni la
  // respuesta: «qué se hizo, no qué decía». No se espera y no tira: anotar nunca cambia lo que contesta la operación.
  const def = porId(id);
  if (def) {
    registrarAccionMako({
      ws: ctx.ws, usuario: ctx.quien?.sub ?? null, operacion: def.id, area: def.area, canal: ctx.canal,
      tipo: esLectura(def) ? 'lectura' : esControl(def) ? 'control' : 'accion', ok: r.ok,
    });
  }
  return r;
}

async function correrOperacion(
  id: string,
  inputCrudo: Record<string, unknown> | null | undefined,
  ctx: Ctx,
  origen: 'query' | 'json',
  vistaPrevia?: Vista,
): Promise<Resultado> {
  const def = porId(id);
  const vista = vistaPrevia ?? await vistaDe(ctx);
  // Desconocida o fuera de lo que esta vista puede pedir: el MISMO 404, con el mismo
  // cuerpo. Sin `disponibles` acá a propósito: si solo lo trajera la que existe, la
  // respuesta distinguiría «invisible» de «inventada». La ruta HTTP lo agrega por
  // ÁREA pedida, que no depende de si el id existe.
  if (!def || !visible(def, vista)) {
    return { ok: false, status: 404, error: `operación desconocida: «${id}». Pide el catálogo (GET /api/v1) para ver las disponibles.` };
  }

  const v = validarInput(def.parametros, inputCrudo, origen);
  // Un parámetro que falta o no vale es una GUARDA (la marca explícita, `guarda`: lib/no-pude.ts no adivina por el texto).
  if ('error' in v) return { ok: false, status: 400, error: v.error, faltan: v.faltan, guarda: true };

  const run = runnerDe(def.id);
  if (!run) {
    console.error(`[api-mako] «${def.id}» está en el catálogo y no tiene runner`);
    return { ok: false, status: 500, error: `«${def.id}» todavía no está disponible.` };
  }

  try {
    return await runWithWorkspace(ctx.ws, async (): Promise<Resultado> => {
      const enCurso = await getWorkspaceActual();
      if (enCurso !== ctx.ws) throw new Error(`api-mako: «${def.id}» iba a correr en el workspace ${enCurso} y el contexto es ${ctx.ws}`);

      if (esLectura(def)) {
        if (!('leer' in run)) throw new Error(`api-mako: «${def.id}» no tiene leer()`);
        const input = ctx.formato ? { ...v.input, formato: ctx.formato } : v.input;
        const cruda = await run.leer(input, ctx);
        // Lo que el modelo no puede ver (la agenda de Google) va a la persona por el canal
        // del código, sale bien o mal la lectura. Sin canal (HTTP), se descarta.
        if (typeof cruda !== 'string' && cruda.paraLaPersona) ctx.aPersona?.(cruda.paraLaPersona);
        // Lo que le falta conectar, por el mismo canal del código (`Falta`): salga bien o mal la lectura.
        if (typeof cruda !== 'string' && cruda.falta) ctx.aFalta?.(cruda.falta);
        if (typeof cruda === 'string') return { ok: true, tipo: 'lectura', salida: def.salida, resultado: cruda };
        // Lo que falta CONECTAR es una guarda, como en un preparar (la verificación de 692368a60).
        if (cruda.isError) return { ok: false, status: 400, error: cruda.content, ...(cruda.falta ? { falta: cruda.falta, guarda: true as const } : {}) };
        // Lo que la lectura DIBUJA (lib/chat-bloques.ts) va a la pantalla por el canal del código, saneado; el modelo
        // recibe sólo `content`. Sin `aDibujar` (WhatsApp, HTTP) se descarta. `siSeDibuja` va sólo si se dibujó: un saneo
        // que lo descarta o el tope de bloques del turno (`aDibujar` da `false`) no se lo dicen al modelo.
        const bloque = cruda.bloque && ctx.aDibujar ? sanearBloque(cruda.bloque) : null;
        const dibujado = bloque ? ctx.aDibujar?.(bloque) !== false : false;
        const resultado = dibujado && cruda.siSeDibuja ? `${cruda.content}\n\n${cruda.siSeDibuja}` : cruda.content;
        return { ok: true, tipo: 'lectura', salida: def.salida, formato: cruda.formato, headers: cruda.headers, resultado };
      }

      if (esControl(def)) {
        if (!('correr' in run)) throw new Error(`api-mako: «${def.id}» no tiene correr()`);
        const cruda = await run.correr(v.input, ctx);
        const texto = typeof cruda === 'string' ? cruda : cruda.content;
        if (typeof cruda !== 'string' && cruda.isError) return { ok: false, status: 400, error: texto };
        return { ok: true, tipo: 'control', resultado: texto };
      }

      if (!esAccion(def) || !('ejecutar' in run)) throw new Error(`api-mako: «${def.id}» no tiene ejecutar()`);

      // Las heredadas de mako-doer-acciones.ts: la tool vieja valida y deja la
      // pendiente ella misma; acá solo se traduce su JSON al Resultado, y el texto
      // crudo viaja para que el doer reciba exactamente la salida de siempre.
      if (def.confirmacion === 'chat' && run.proponerLegado) {
        const crudo = await run.proponerLegado(v.input, ctx);
        const r = traducirLegado(crudo);
        return r.ok && r.tipo === 'pendiente' ? { ...r, crudo } : r;
      }

      if (def.confirmacion === 'pantalla' && run.proponer) {
        const p = await run.proponer(v.input, ctx);
        // Como el de un preparar: es GUARDA salvo que el runner diga que es una falla nuestra (`falla`).
        if ('error' in p) return { ok: false, status: 400, error: p.error, ...(p.falla ? {} : { guarda: true as const }) };
        // Lo que la propuesta DIBUJA (`extra.bloque`: el antes y el después del Video Editor) va por el mismo canal que el
        // de una lectura; al modelo (y a la API) le llega `extra` sin él.
        const { bloque: crudo, ...extra } = p.extra ?? {};
        const bloque = crudo != null && ctx.aDibujar ? sanearBloque(crudo) : null;
        if (bloque) ctx.aDibujar?.(bloque);
        return { ok: true, tipo: 'propuesta', propuesta: { ...p, ...(p.extra ? { extra } : {}) } };
      }

      if (!run.preparar) throw new Error(`api-mako: «${def.id}» no tiene preparar()`);
      const prep = await run.preparar(v.input, ctx);
      if ('error' in prep && prep.paraLaPersona) ctx.aPersona?.(prep.paraLaPersona);
      if ('error' in prep && prep.falta) ctx.aFalta?.(prep.falta);
      // ⚠️ EL ERROR DE UN PREPARAR ES UNA GUARDA, salvo que el runner diga que es una FALLA nuestra (`falla`: «No pude leer las
      // pasarelas conectadas»). Al revés —guarda sólo con la marca— ninguna área la ponía, y unas 734 reglas («Sólo se
      // reembolsa un cobro pagado») abrían ticket y le pegaban «Quedó el ticket #N» al grupo del cliente (la verificación de
      // 692368a60). Lo que revienta sigue siendo una falla: va por el catch de abajo.
      if ('error' in prep) {
        const guarda = prep.falla ? {} : { guarda: true as const };
        return { ok: false, status: 400, error: prep.error, faltan: prep.faltan, disponibles: prep.disponibles, ...(prep.yaEstaba ? { yaEstaba: true } : {}), ...(prep.falta ? { falta: prep.falta } : {}), ...guarda };
      }

      if (def.confirmacion === 'pantalla') {
        // Se guarda el INPUT validado, no el payload preparado: la pantalla genérica
        // pinta el formulario desde `parametros`, la persona lo corrige, y al confirmar
        // se vuelve a validar y a preparar contra la base. Guardar el preparado
        // obligaría a cada preparar() a aceptar su propia salida como entrada.
        const ref = typeof v.input.ref === 'string' ? v.input.ref : null;
        const p = await proponerPantallaGenerica(def, v.input, prep.resumen, ctx, ref);
        return { ok: true, tipo: 'propuesta', propuesta: p.propuesta };
      }
      const c = await proponerChat(def, prep.payload, prep.resumen, ctx);
      if ('error' in c) return { ok: false, status: 500, error: c.error, ...(c.motivo ? { motivo: c.motivo } : {}), noCorrio: true };
      // DESPUÉS de guardar la pendiente: el detalle de algo que no quedó propuesto sería
      // un detalle de nada.
      if (prep.paraLaPersona) ctx.aPersona?.(prep.paraLaPersona);
      return { ok: true, tipo: 'pendiente', pendiente: c.pendiente };
    });
  } catch (err) {
    // Una lib lanza cuando el pedido está mal (un leadId que no existe acá) y ese
    // mensaje ya está escrito para que lo lea alguien: va como 400. Lo que huele a
    // infraestructura va como 500, se registra, y el cliente recibe un texto genérico.
    const msg = err instanceof Error ? err.message : String(err);
    if (!esNuestro(msg)) return { ok: false, status: 400, error: msg };
    console.error(`[api-mako] ${def.id} (ws ${ctx.ws}, ${ctx.canal}):`, msg);
    return { ok: false, status: 500, error: `Algo falló de nuestro lado al correr «${def.id}». Ya quedó registrado; vuelve a intentarlo en unos minutos.` };
  }
}

/** El JSON de una tool heredada (`{ ok, pendiente_id, resumen, vence_en_min }` o
 *  `{ ok:false, error, … }`), traducido al Resultado. Un texto que no es JSON es un
 *  error legible de la tool vieja: va como 400. */
function traducirLegado(crudo: string): Resultado {
  let j: Record<string, unknown> | null = null;
  try { j = JSON.parse(crudo) as Record<string, unknown>; } catch { j = null; }
  if (!j || typeof j !== 'object') return { ok: false, status: 400, error: crudo };
  if (j.ok === true && typeof j.pendiente_id === 'number') {
    return { ok: true, tipo: 'pendiente', pendiente: { id: j.pendiente_id, resumen: String(j.resumen ?? ''), venceEnMin: Number(j.vence_en_min ?? TTL_PENDIENTE_MIN), url: linkPantalla(RUTA_BANDEJA) } };
  }
  // La pendiente que no entró (`noCorrio`, mako-doer-acciones.ts `proponer`) es una falla nuestra: un 500, como `proponerChat`.
  if (j.noCorrio === true) return { ok: false, status: 500, error: String(j.error ?? crudo), noCorrio: true };
  const { ok: _ok, error, faltan, guarda, ...resto } = j;
  void _ok;
  // La tool vieja marca su GUARDA (`guarda: true`, o qué falta); «No pude registrar la acción pendiente» no la trae: es una falla.
  const esGuarda = guarda === true || (Array.isArray(faltan) && faltan.length > 0);
  return { ok: false, status: 400, error: String(error ?? crudo), faltan: Array.isArray(faltan) ? faltan.map(String) : undefined, disponibles: Object.keys(resto).length ? resto : undefined, ...(esGuarda ? { guarda: true as const } : {}) };
}

/**
 * El runner de tools para el doer (WhatsApp y la app), sobre el registro. Devuelve
 * lo que `chatClaudeTools` espera: texto, o `{ content, isError }`.
 *
 * Las claves de salida conservan las que el doer YA parsea (lib/mako-doer-in.ts lee
 * `link` con /plan/revisar y `url` con /crm/revisar para escribir él mismo el
 * mensaje del borrador) y llevan la `instruccion` al modelo, que es lo que
 * gobierna su comportamiento por canal y se probó en producción.
 */
/**
 * Lo que el MODELO lee de una conexión que falta (25/10/2026). Si el canal la agrega por código (`ctx.aFalta`: el doer de
 * WhatsApp), el link no se le da: lo escribiría él y saldría dos veces. Si no (la app, HTTP), va el link exacto del modal, para
 * que lo pase tal cual y no mande a «/integraciones» a secas.
 */
export function faltaParaElModelo(f: Falta, ctx: Pick<Ctx, 'aFalta' | 'ws'>): Record<string, unknown> {
  const c = conexion(f.servicio);
  if (ctx.aFalta) return { servicio: f.servicio, ...(c ? { nombre: c.nombre } : {}), instruccion: 'El link para conectarlo se lo manda MaKo aparte: dile qué falta y no escribas ningún link.' };
  return { servicio: f.servicio, ...(c ? { nombre: c.nombre, link: linkPantalla(c.ruta, ctx.ws), instruccion: 'Pásale este link TAL CUAL: abre justo esa conexión.' } : {}) };
}

export function runnerDelRegistro(ctx: Ctx) {
  let vista: Vista | null = null;
  // La zona del negocio, una vez por conversación del modelo: las lecturas le llegan con sus horas ahí (./horas-del-negocio.ts).
  let tz: string | null = null;
  return async (name: string, input: Record<string, unknown>): Promise<string | { content: string; isError?: boolean }> => {
    vista ??= await vistaDe(ctx);
    const r = await ejecutarOperacion(name, input, ctx, 'json', vista);
    // Lo que LEE el modelo, con las horas en la zona del negocio y el día de cada fecha (28/10/2026, «20:00 hs» que eran las
    // 17:00 y «lunes 27/10» que era martes). La API HTTP no pasa por acá: recibe los datos crudos.
    if (r.ok && r.tipo === 'lectura') {
      tz ??= await tzDeWorkspace(ctx.ws).catch(() => TZ_DEFAULT);
      return conHorasDelNegocio(r.resultado, tz);
    }
    if (!r.ok) {
      const cuerpo: Record<string, unknown> = { ok: false, error: r.error };
      if (r.faltan) cuerpo.faltan = r.faltan;
      if (r.disponibles) cuerpo.disponibles = r.disponibles;
      if (r.falta) cuerpo.falta = faltaParaElModelo(r.falta, ctx);
      // La marca de GUARDA viaja: el turno la lee para saber si el «no pude» es una regla (lib/no-pude.ts).
      if (r.guarda) cuerpo.guarda = true;
      // 404/500 son fallas nuestras o un nombre inventado: van como isError para que
      // el modelo no las lea como un dato. Un 400 es un pedido corregible: va como
      // texto, igual que hoy, para que el modelo pida lo que falta.
      return r.status === 400 ? JSON.stringify(cuerpo) : { content: JSON.stringify(cuerpo), isError: true };
    }
    if (r.tipo === 'control') return r.resultado;
    if (r.tipo === 'pendiente') {
      // Heredada: la salida vieja, textual, con su `instruccion` de siempre.
      if (r.crudo) return r.crudo;
      return JSON.stringify({ ok: true, pendiente_id: r.pendiente.id, resumen: r.pendiente.resumen, vence_en_min: r.pendiente.venceEnMin, instruccion: 'Di qué vas a hacer y pide que confirmen con un «sí» para ejecutarlo.' });
    }
    // `extra` va PRIMERO: un runner no puede pisar el link que el código garantiza.
    return JSON.stringify({
      ...(r.propuesta.extra ?? {}),
      ok: true, url: r.propuesta.url, link: r.propuesta.url, nueva: r.propuesta.nueva,
      instruccion: r.propuesta.nueva
        ? 'Pásale el link TAL CUAL para que lo revise y confirme en MaKo. No pidas confirmación por el chat ni repitas los datos.'
        : 'Ya había una propuesta pendiente igual: es el MISMO link, no se creó otra. Dilo así y pásalo.',
    });
  };
}
