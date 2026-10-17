import 'server-only';

// =============================================================================
// El Plan adentro de cada chat jefe — el lado del servidor (16/10/2026)
// =============================================================================
// Las reglas y el porqué, en lib/centro-plan-reglas.ts. Acá sólo se llama a las operaciones del Plan de la API de MaKo
// con un contexto del Centro: el workspace de la PLATAFORMA (su tablero es `plan_tareas`, el del super admin), canal
// `app`, rol admin, y como actor la persona que apretó.
// ⚠️ Quien llama tiene que haber pasado por `puedeOperar` (app/api/centro/plan/route.ts). Nada de acá mira la cookie.
// ⚠️ LO LLAMA UNA RUTA, NO UNA SERVER ACTION: al aplicar corre el Perro (30 a 60 s), y el navegador manda las server
// actions de a una: mientras tanto, mandarle algo a otro chat quedaba esperando (lo encontró la revisión del 16/10).

import { porId } from './api-mako/registro';
import { ejecutarOperacion } from './api-mako/ejecutar';
import { aplicarEnElActo } from './api-mako/flujo';
import { canalKeyDe } from './api-mako/canal';
import { esAccion, type Ctx } from './api-mako/tipos';
import { runWithWorkspace } from './workspace';
import {
  avisoDeAlta, avisoDeYaEstaba, dondeQuedo, numerosDeTarjeta, ordenarTareas, proyectoDelChat, proyectoDelJefe, proyectosDelListado,
  tareasDelListado, tarjetasDelYaEsta, yaAbierta,
  type EscritoPlan, type LecturaPlan, type TareaPlanP,
} from './centro-plan-reglas';
import { rutaDeYaEsta } from './centro-chats';
import { recortarPrueba } from './cierre-tarjeta';

/** El contexto con el que el Centro usa el Plan. `sub` va en la clave de scope: lo que propone una persona es suyo. */
export function ctxDelCentro(ws: number, persona: { sub: string; email: string }): Ctx {
  return {
    ws, canal: 'app', canalKey: canalKeyDe('app', `centro:${persona.sub}`), alcance: 'ejecutar', rol: 'admin',
    actor: `${persona.email || 'Martín'} · Centro de Operaciones`,
  };
}

const sinCaer = (m: string) => m.replace(/\s*Revisa los ids con ver_plan\.?/i, '').trim();

/** Todo el tablero abierto (las 300 de más puntaje) y sus proyectos: para saber el proyecto de un jefe y dónde quedó algo. */
async function listado(ctx: Ctx): Promise<{ ok: true; tareas: TareaPlanP[]; proyectos: Array<{ id: string; nombre: string }> } | { ok: false; motivo: string }> {
  const r = await ejecutarOperacion('listar_tareas_plan', {}, ctx, 'json');
  if (!r.ok) return { ok: false, motivo: r.error };
  if (r.tipo !== 'lectura') return { ok: false, motivo: 'El Plan contestó otra cosa.' };
  return { ok: true, tareas: tareasDelListado(r.resultado), proyectos: proyectosDelListado(r.resultado) };
}

/**
 * Las tareas abiertas del proyecto del jefe de `chat` (hasta 100, con `ver_proyecto_plan`: sin el tope de las 300 de
 * más puntaje de toda la lista, que dejaba afuera las de un jefe con poco puntaje). Sin proyecto con su nombre, lo dice.
 */
export async function leerPlanDelJefe(ctx: Ctx, chat: string): Promise<LecturaPlan> {
  if (!proyectoDelChat(chat)) return { ok: true, proyecto: null, tareas: [] };
  const l = await listado(ctx);
  if (!l.ok) return l;
  const p = proyectoDelJefe(l.proyectos, chat);
  if (!p) return { ok: true, proyecto: null, tareas: [] };
  const r = await ejecutarOperacion('ver_proyecto_plan', { proyectoId: p.id }, ctx, 'json');
  if (!r.ok) return { ok: false, motivo: r.error };
  if (r.tipo !== 'lectura') return { ok: false, motivo: 'El Plan contestó otra cosa.' };
  return { ok: true, proyecto: p.nombre, tareas: ordenarTareas(tareasDelListado(r.resultado, 'abiertas')) };
}

type EnElActo = { ok: true; datos: Record<string, unknown> } | { ok: false; error: string; datos: Record<string, unknown> };

async function enElActo(id: string, input: Record<string, unknown>, ctx: Ctx): Promise<EnElActo> {
  const def = porId(id);
  if (!def || !esAccion(def)) return { ok: false, error: 'El Plan no tiene esa acción en este momento.', datos: {} };
  const r = await runWithWorkspace(ctx.ws, () => aplicarEnElActo(def, input, ctx, { ws: ctx.ws, origen: 'centro' }));
  return r.ok ? { ok: true, datos: r.datos ?? {} } : { ok: false, error: sinCaer(r.resumen), datos: r.datos ?? {} };
}

/**
 * Suma UNA tarea al proyecto de un jefe, sin preguntar nada: `proyecto` es la pista y el Perro elige el proyecto final
 * entre los del tablero y el catálogo (puede no ser el del jefe: el aviso dice dónde quedó).
 * ⚠️ Antes de proponer se mira si ya hay una ABIERTA con ese título: sumarla otra vez la fusionaba con ésa —y la fusión
 * del detalle puede comerse lo que el Perro le había agregado— o dejaba el borrador colgado en /plan/revisar. Y si el
 * borrador no se pudo aplicar, se descarta: nada queda a medias esperando a alguien.
 */
export async function sumarTareaAlPlan(ctx: Ctx, chat: string, t: { titulo: string; detalle: string; proyecto: string }): Promise<EscritoPlan> {
  const antes = await listado(ctx);
  if (antes.ok) {
    // ⚠️ Puede tapar un alta distinta con el mismo primer renglón: por eso el aviso dice cuál y dónde, y Martín la suma
    // con otro título si no es la misma.
    const ya = yaAbierta(antes.tareas, t.titulo);
    if (ya) return { ok: true, aviso: avisoDeYaEstaba(ya), plan: await leerPlanDelJefe(ctx, chat), tareaId: ya.id };
  }
  const r = await enElActo('proponer_tareas_plan', { tareas: [{ titulo: t.titulo, detalle: t.detalle, proyecto: t.proyecto }] }, ctx);
  const borrador = typeof r.datos.propuestaId === 'string' ? r.datos.propuestaId : null;
  if (!r.ok) {
    if (borrador) await enElActo('descartar_borrador_plan', { id: borrador }, ctx).catch(() => null);
    return { ok: false, error: r.error };
  }
  const creadas = typeof r.datos.creadas === 'number' ? r.datos.creadas : 1;
  const despues = await listado(ctx);
  const donde = despues.ok ? dondeQuedo(despues.tareas, t.titulo, chat) : null;
  const tareaId = despues.ok ? yaAbierta(despues.tareas, t.titulo)?.id ?? null : null;
  return { ok: true, aviso: avisoDeAlta(creadas, donde), plan: await leerPlanDelJefe(ctx, chat), tareaId };
}

/**
 * Cierra UNA tarea abierta con la evidencia, EN EL ACTO y sin borrador (`cerrar_tareas_plan`, 17/10/2026). Hasta ese
 * día proponía un borrador de cierres y lo aplicaba en dos pasos; si el segundo fallaba, quedaba colgado en
 * /plan/revisar. Cerrar no es borrar: queda con su historial y su checklist tildada.
 */
export async function cerrarTareaDelPlan(ctx: Ctx, chat: string, t: { id: string; evidencia: string; revisar?: string | null }): Promise<EscritoPlan> {
  const r = await enElActo('cerrar_tareas_plan', { cerrar: [{ id: t.id, evidencia: t.evidencia, ...(t.revisar ? { revisar: t.revisar } : {}) }] }, ctx);
  const plan = await leerPlanDelJefe(ctx, chat);
  if (!r.ok) {
    // La fila vieja no se queda en pantalla: si ya no está abierta, eso es lo que se dice.
    const sigue = plan.ok && plan.tareas.some((x) => x.id === t.id);
    return { ok: false, error: sigue ? r.error : 'Ya no estaba abierta.', plan };
  }
  return { ok: true, aviso: 'Marcada hecha', plan };
}

/** Lo que hizo un «Ya está» con el Plan. `sinTarjeta`: no nombró ninguna ni había una con su título (no se cerró nada). */
export type CierrePorYaEsta =
  | { ok: true; cerradas: Array<{ num: number | null; titulo: string }>; noAbiertas: number[]; sinTarjeta: boolean }
  | { ok: false; error: string };

/**
 * EL «YA ESTÁ» DE UN CHAT CIERRA SU TARJETA (17/10/2026). Lo llama el Ops Center cuando un chat jefe dice «Ya está» en su
 * conversación: cierra, en el acto y con el texto del «Ya está» como evidencia, las tarjetas que nombra por número
 * (#870) o —si no nombra ninguna— la abierta de su proyecto cuyo título entero está en el texto
 * (`tarjetasDelYaEsta`, lib/centro-plan-reglas.ts). La ruta para revisar es la que dejó el texto (`rutaDeYaEsta`), si
 * no viene aparte. Lo que no encuentra no lo adivina: lo devuelve.
 */
export async function cerrarPorYaEsta(ctx: Ctx, chat: string, ya: { texto: string; evidencia?: string; revisar?: string | null }): Promise<CierrePorYaEsta> {
  const texto = (ya.texto ?? '').trim();
  if (!texto) return { ok: false, error: 'El «Ya está» llegó vacío.' };
  const l = await listado(ctx);
  if (!l.ok) return { ok: false, error: l.motivo };
  const delJefe = await leerPlanDelJefe(ctx, chat);
  const abiertas = l.tareas.concat(delJefe.ok ? delJefe.tareas.filter((t) => !l.tareas.some((x) => x.id === t.id)) : []);
  const tarjetas = tarjetasDelYaEsta(texto, abiertas, delJefe.ok ? delJefe.tareas : []);
  const nombradas = numerosDeTarjeta(texto);
  const noAbiertas = nombradas.filter((n) => !tarjetas.some((t) => t.num === n));
  if (!tarjetas.length) return { ok: true, cerradas: [], noAbiertas, sinTarjeta: !nombradas.length };
  const evidencia = recortarPrueba((ya.evidencia ?? '').trim() || texto.replace(/\s+/g, ' '));
  const revisar = ya.revisar ?? rutaDeYaEsta(texto);
  const r = await enElActo('cerrar_tareas_plan', {
    cerrar: tarjetas.map((t) => ({ id: t.id, evidencia, ...(revisar ? { revisar } : {}) })),
  }, ctx);
  if (!r.ok) return { ok: false, error: r.error };
  const ids = Array.isArray(r.datos.ids) ? (r.datos.ids as unknown[]).map(String) : tarjetas.map((t) => t.id);
  return { ok: true, cerradas: tarjetas.filter((t) => ids.includes(t.id)).map((t) => ({ num: t.num, titulo: t.titulo })), noAbiertas, sinTarjeta: false };
}
