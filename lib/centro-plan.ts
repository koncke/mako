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
  avisoDeAlta, avisoDeYaEstaba, dondeQuedo, ordenarTareas, proyectoDelChat, proyectoDelJefe, proyectosDelListado, tareasDelListado, yaAbierta,
  type EscritoPlan, type LecturaPlan, type TareaPlanP,
} from './centro-plan-reglas';

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
    if (ya) return { ok: true, aviso: avisoDeYaEstaba(ya), plan: await leerPlanDelJefe(ctx, chat) };
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
  return { ok: true, aviso: avisoDeAlta(creadas, donde), plan: await leerPlanDelJefe(ctx, chat) };
}

/** Cierra UNA tarea abierta con la evidencia. Cerrar no es borrar: queda con su historial y su checklist tildada. */
export async function cerrarTareaDelPlan(ctx: Ctx, chat: string, t: { id: string; evidencia: string }): Promise<EscritoPlan> {
  const r = await enElActo('proponer_cierre_tareas', { cerrar: [{ id: t.id, evidencia: t.evidencia, confianza: 'alta' }], resumen: 'Marcada hecha desde el Centro de Operaciones' }, ctx);
  // Un borrador de cierres que no se aplicó se descarta: no queda esperando en /plan/revisar.
  if (!r.ok && typeof r.datos.propuestaId === 'string') await enElActo('descartar_borrador_plan', { id: r.datos.propuestaId }, ctx).catch(() => null);
  const plan = await leerPlanDelJefe(ctx, chat);
  if (!r.ok) {
    // La fila vieja no se queda en pantalla: si ya no está abierta, eso es lo que se dice.
    const sigue = plan.ok && plan.tareas.some((x) => x.id === t.id);
    return { ok: false, error: sigue ? r.error : 'Ya no estaba abierta.', plan };
  }
  return { ok: true, aviso: 'Marcada hecha', plan };
}
