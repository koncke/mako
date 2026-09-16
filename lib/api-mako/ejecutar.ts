// =============================================================================
// api-mako/ejecutar — el choke point: UNA función corre cualquier operación
// =============================================================================
// Por acá pasan los tres canales (HTTP, WhatsApp, la app). Decide si la operación
// EXISTE para quien pide (canal, alcance, gating: todo en positivo, y a quien no le
// corresponde le contesta 404, no 403), valida el input contra la definición (solo
// lo declarado, con su tipo), corre el runner ADENTRO del workspace del contexto y
// normaliza la salida.
//
// ⚠️ El `runWithWorkspace(ctx.ws, …)` lo hace ESTA función, no el transporte, y
// antes de correr el runner comprueba que el workspace en curso sea el del contexto.
// Fuera del store, `getWorkspaceActual()` cae a OWNER_WS (Mauricio, un cliente) y
// `settings.ts` hace `?? OWNER_WS`: un runner que corriera afuera leería y
// escribiría en el workspace equivocado SIN NINGÚN ERROR. Una línea convierte esa
// convención en un guard.
//
// Los errores del que llama (parámetro mal, id que no existe en ESTE workspace)
// salen como 400 con un mensaje que dice QUÉ, porque lo lee un agente que se
// corrige solo. Los nuestros, 500. Confundirlos manda al agente a reintentar algo
// que nunca va a andar.
// =============================================================================

import 'server-only';
import { runWithWorkspace, getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import { capaDef, type CapaId } from '@/lib/capas';
import { porId, visible, disponiblesEn, type Vista } from './registro';
import { runnerDe } from './runners';
import { validarInput } from './validar';
import { proponerChat, proponerPantallaGenerica, TTL_PENDIENTE_MIN, RUTA_BANDEJA } from './acciones';
import { APP_BASE_URL } from '@/lib/app-url';
import { esAccion, esControl, esLectura, type Ctx, type Resultado } from './tipos';

/** La vista de un contexto: qué tabs tiene la capa del workspace (para `gating.tab`). */
export async function vistaDe(ctx: Ctx): Promise<Vista> {
  let tabs: readonly string[] | null = null;
  try {
    const w = await getWorkspace(ctx.ws);
    const capa = capaDef((w?.capa ?? 'completo') as CapaId);
    tabs = capa.navKeys ?? null;
  } catch { tabs = null; }
  return { canal: ctx.canal, alcance: ctx.alcance, ws: ctx.ws, rol: ctx.rol, tabs };
}

export async function ejecutarOperacion(
  id: string,
  inputCrudo: Record<string, unknown> | null | undefined,
  ctx: Ctx,
  origen: 'query' | 'json',
): Promise<Resultado> {
  const def = porId(id);
  const vista = await vistaDe(ctx);
  // Desconocida o fuera de lo que esta vista puede pedir: el MISMO 404. A quien no le
  // corresponde una operación, no existe; `disponibles` dice lo que sí puede pedir.
  if (!def || !visible(def, vista)) {
    const area = def?.area;
    return { ok: false, status: 404, error: `operación desconocida: «${id}». Pide el catálogo (GET /api/v1) para ver las disponibles.`, disponibles: area ? disponiblesEn(area, vista) : undefined };
  }

  const v = validarInput(def.parametros, inputCrudo, origen);
  if ('error' in v) return { ok: false, status: 400, error: v.error, faltan: v.faltan };

  const run = runnerDe(def.id);
  if (!run) return { ok: false, status: 500, error: `«${def.id}» está en el catálogo y no tiene implementación.` };

  try {
    return await runWithWorkspace(ctx.ws, async (): Promise<Resultado> => {
      const enCurso = await getWorkspaceActual();
      if (enCurso !== ctx.ws) throw new Error(`api-mako: «${def.id}» iba a correr en el workspace ${enCurso} y el contexto es ${ctx.ws}`);

      if (esLectura(def)) {
        if (!('leer' in run)) return { ok: false, status: 500, error: `«${def.id}» no tiene leer()` };
        const input = ctx.formato ? { ...v.input, formato: ctx.formato } : v.input;
        const cruda = await run.leer(input, ctx);
        if (typeof cruda === 'string') return { ok: true, tipo: 'lectura', salida: def.salida, resultado: cruda };
        if (cruda.isError) return { ok: false, status: 400, error: cruda.content };
        return { ok: true, tipo: 'lectura', salida: def.salida, formato: cruda.formato, headers: cruda.headers, resultado: cruda.content };
      }

      if (esControl(def)) {
        if (!('correr' in run)) return { ok: false, status: 500, error: `«${def.id}» no tiene correr()` };
        const cruda = await run.correr(v.input, ctx);
        const texto = typeof cruda === 'string' ? cruda : cruda.content;
        if (typeof cruda !== 'string' && cruda.isError) return { ok: false, status: 400, error: texto };
        return { ok: true, tipo: 'control', resultado: texto };
      }

      if (!esAccion(def) || !('ejecutar' in run)) return { ok: false, status: 500, error: `«${def.id}» no tiene ejecutar()` };

      // Las heredadas de mako-doer-acciones.ts: la tool vieja valida y deja la
      // pendiente ella misma; acá solo se traduce su JSON al Resultado.
      if (def.confirmacion === 'chat' && run.proponerLegado) {
        const crudo = await run.proponerLegado(v.input, ctx);
        return traducirLegado(crudo);
      }

      if (def.confirmacion === 'pantalla' && run.proponer) {
        const p = await run.proponer(v.input, ctx);
        if ('error' in p) return { ok: false, status: 400, error: p.error };
        return { ok: true, tipo: 'propuesta', propuesta: p };
      }

      if (!run.preparar) return { ok: false, status: 500, error: `«${def.id}» no tiene preparar()` };
      const prep = await run.preparar(v.input, ctx);
      if ('error' in prep) return { ok: false, status: 400, error: prep.error, faltan: prep.faltan, disponibles: prep.disponibles };

      if (def.confirmacion === 'pantalla') {
        const ref = typeof v.input.ref === 'string' ? v.input.ref : null;
        const p = await proponerPantallaGenerica(def, prep.payload, prep.resumen, ctx, ref);
        return { ok: true, tipo: 'propuesta', propuesta: p.propuesta };
      }
      const c = await proponerChat(def, prep.payload, prep.resumen, ctx);
      if ('error' in c) return { ok: false, status: 500, error: c.error };
      return { ok: true, tipo: 'pendiente', pendiente: c.pendiente };
    });
  } catch (err) {
    // Una lib lanza cuando el pedido está mal (un leadId que no existe acá) y ese
    // mensaje ya está escrito para que lo lea alguien: va como 400. Lo que huele
    // a infraestructura va como 500, y se registra.
    const msg = err instanceof Error ? err.message : String(err);
    const nuestro = /api-mako:|fetch failed|ECONN|timeout|supabase|PGRST|permission denied|relation .* does not exist/i.test(msg);
    if (nuestro) console.error(`[api-mako] ${def.id} (ws ${ctx.ws}, ${ctx.canal}):`, msg);
    return { ok: false, status: nuestro ? 500 : 400, error: msg };
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
    return { ok: true, tipo: 'pendiente', pendiente: { id: j.pendiente_id, resumen: String(j.resumen ?? ''), venceEnMin: Number(j.vence_en_min ?? TTL_PENDIENTE_MIN), url: `${APP_BASE_URL}${RUTA_BANDEJA}` } };
  }
  const { ok: _ok, error, faltan, ...resto } = j;
  void _ok;
  return { ok: false, status: 400, error: String(error ?? crudo), faltan: Array.isArray(faltan) ? faltan.map(String) : undefined, disponibles: Object.keys(resto).length ? resto : undefined };
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
export function runnerDelRegistro(ctx: Ctx) {
  return async (name: string, input: Record<string, unknown>): Promise<string | { content: string; isError?: boolean }> => {
    const r = await ejecutarOperacion(name, input, ctx, 'json');
    if (!r.ok) {
      const cuerpo: Record<string, unknown> = { ok: false, error: r.error };
      if (r.faltan) cuerpo.faltan = r.faltan;
      if (r.disponibles) cuerpo.disponibles = r.disponibles;
      // 404/500 son fallas nuestras o un nombre inventado: van como isError para que
      // el modelo no las lea como un dato. Un 400 es un pedido corregible: va como
      // texto, igual que hoy, para que el modelo pida lo que falta.
      return r.status === 400 ? JSON.stringify(cuerpo) : { content: JSON.stringify(cuerpo), isError: true };
    }
    if (r.tipo === 'lectura' || r.tipo === 'control') return r.resultado;
    if (r.tipo === 'pendiente') {
      return JSON.stringify({ ok: true, pendiente_id: r.pendiente.id, resumen: r.pendiente.resumen, vence_en_min: r.pendiente.venceEnMin, instruccion: 'Di qué vas a hacer y pide que confirmen con un «sí» para ejecutarlo.' });
    }
    return JSON.stringify({
      ok: true, url: r.propuesta.url, link: r.propuesta.url, nueva: r.propuesta.nueva, ...(r.propuesta.extra ?? {}),
      instruccion: r.propuesta.nueva
        ? 'Pásale el link TAL CUAL para que lo revise y confirme en MaKo. No pidas confirmación por el chat ni repitas los datos.'
        : 'Ya había una propuesta pendiente igual: es el MISMO link, no se creó otra. Dilo así y pásalo.',
    });
  };
}
