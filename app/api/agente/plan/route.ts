// =============================================================================
// /api/agente/plan — la puerta para un AGENTE externo (Claude Code) al plan
// =============================================================================
// Auth: `Authorization: Bearer <token de /integraciones>` → resuelve el workspace
// (lib/agente-token.ts). Sin sesión, sin cookies: corre en la compu del usuario.
//
// GET  → el plan abierto { tareas, proyectos } para que el agente NO duplique lo
//        que ya está anotado y pueda avisar si hay algo alta/vencido.
// POST → deja un BORRADOR (plan_propuestas) y devuelve la URL de revisión.
//
// LA REGLA: el agente NO crea tareas. Crea una propuesta; el humano
// la revisa en /plan/revisar/<id> y al aplicar corre el Perro Guardián. Es el
// MISMO camino que MaKo por WhatsApp — un solo proceso para todos los orígenes.
//
// Workspace-aware por diseño (sirve al dueño y a cada cliente): el board rico
// (plan_tareas) o el board simple del cliente (lib/todo) se resuelven solos.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, rechazoAgente, wsDelBearer } from '@/lib/agente-token';
import { rechazoPorAlcance } from '@/lib/api-mako/alcance';
import { limitePorClave } from '@/lib/limite-publico';
import { wsEnContexto, runWithWorkspace, getWorkspace, OWNER_WS } from '@/lib/workspace';
import { tableroDeCapa } from '@/lib/tablero-de-capa';
import { listPlanBoard } from '@/lib/plan-board';
import { listTareas, listCategorias } from '@/lib/todo';
import { estaPendiente } from '@/lib/todo-estados';
import { crearPropuesta } from '@/lib/plan-propuesta';
import { linkApp, APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** ¿Este workspace usa el board rico (plan_tareas)? Mismo criterio que aplicarPropuesta. */
async function usaPlanBoard(ws: number): Promise<boolean> {
  // SOLO por capa. Incluir `ws === OWNER_WS` era un bug heredado de cuando el dueño
  // no tenía workspace propio: hoy el ws 1 es un CLIENTE (Mauricio), su tablero vive
  // en experimento_tareas y plan_tareas está vacío para él. Con el criterio viejo, el
  // GET le devolvía el board equivocado y cualquier id que volviera por el POST
  // apuntaba a otra tabla. Mismo criterio que lib/plan-propuesta.ts.
  // ⚠️ El predicado vive en `lib/tablero-de-capa.ts` desde el 28/09/2026: estaba escrito
  // acá y en lib/plan-propuesta.ts, las dos veces igual, y ninguna se podía testear.
  return tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
}

/** Resuelve el ws del bearer, null (no autorizado), o el 503 de «no pude verificarlo». */
async function wsDeReq(req: NextRequest): Promise<number | null | Response> {
  return wsDelBearer(bearerDe(req));
}

export async function GET(req: NextRequest) {
  const ws = await wsDeReq(req);
  if (ws instanceof Response) return ws;
  if (ws == null) return rechazoAgente(req);
  try {
    return await runWithWorkspace(ws, async () => {
      if (await usaPlanBoard(ws)) {
        const { tareas, proyectos } = await listPlanBoard();
        // El proyecto va por NOMBRE, no por id: es lo que el agente tiene que
        // devolver en el POST para no duplicarlo.
        const nombreDe = new Map(proyectos.map((p) => [p.id, p.name]));
        return NextResponse.json({
          ok: true,
          board: 'plan',
          tareas: tareas
            .filter((t) => (t.progress ?? 0) < 100)
            .map((t) => ({ id: t.id, num: t.num, titulo: t.title, score: t.score, prioridad: t.priority, avance: t.progress, deadline: t.deadline || null, proyecto: nombreDe.get(t.labels[0]) ?? null })),
          proyectos: proyectos.map((p) => ({ id: p.pid ?? p.id, nombre: p.name, score: p.score })),
        });
      }
      // Cliente: su board simple. Las "categorías" son sus proyectos.
      // Sólo las del PLAN (#507), como /plan y como la API de MaKo.
      const [tareas, cats] = await Promise.all([listTareas({ soloDelPlan: true }), listCategorias()]);
      const nombreCat = new Map(cats.map((c) => [c.id, c.nombre]));
      return NextResponse.json({
        ok: true,
        board: 'todo',
        tareas: tareas
          .filter((t) => estaPendiente(t.estado))
          .map((t) => ({ id: t.id, titulo: t.titulo, score: t.score, prioridad: t.prioridad, estado: t.estado, avance: t.progreso, deadline: t.deadline, proyecto: nombreCat.get(t.categorias[0]) ?? null })),
        proyectos: cats.map((c) => ({ id: c.id, nombre: c.nombre })),
      });
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ws = await wsDeReq(req);
  if (ws instanceof Response) return ws;
  if (ws == null) return rechazoAgente(req);
  // Un token «Solo leer» no deja propuestas (lib/api-mako/alcance.ts → rechazoPorAlcance).
  const fuera = rechazoPorAlcance(bearerDe(req), 'proponer');
  if (fuera) return NextResponse.json({ ok: false, error: fuera }, { status: 403 });
  // Por NEGOCIO, no por IP: el token es del negocio, y un formulario suyo que se dispara en bucle no
  // le llena la bandeja de propuestas (lib/limite-publico.ts).
  const frenado = limitePorClave('agente-propone', ws, 60, 60_000);
  if (frenado) return frenado;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  const tareas = Array.isArray(body.tareas) ? body.tareas.slice(0, 30) : [];
  const cerrar = Array.isArray(body.cerrar) ? body.cerrar.slice(0, 30) : [];
  // El guard miraba SOLO `tareas`, así que un lote de puros CIERRES —«estas cinco ya
  // las hice»— devolvía 400 y era imposible de mandar. Todo el canal `cerrar` estaba
  // construido del lado del servidor (tipo, saneo, columna de la migración 0119, paso
  // propio en el wizard, y el cron cerrar-por-commits ya lo usa) y esta línea lo tenía
  // cerrado desde afuera. Ahora alcanza con que venga algo en cualquiera de los dos.
  if (!tareas.length && !cerrar.length) {
    return NextResponse.json({ ok: false, error: 'manda al menos una tarea en `tareas` o un cierre en `cerrar`' }, { status: 400 });
  }

  try {
    const id = await runWithWorkspace(ws, () =>
      crearPropuesta({
        // `prioridad` se ignora a propósito aunque venga: la decide el Perro al
        // aplicar, no el agente que propone (ver lib/plan-propuesta.ts).
        tareas: tareas.map((t) => {
          const o = (t ?? {}) as Record<string, unknown>;
          return {
            titulo: String(o.titulo ?? ''),
            proyecto: o.proyecto ? String(o.proyecto) : undefined,
            detalle: o.detalle ? String(o.detalle) : undefined,
            deadline: o.deadline ? String(o.deadline) : undefined,
            // ENRIQUECER una tarea que YA está, en vez de crear una gemela. Este
            // campo se caía acá: `crearPropuesta` lo sanea (limpiarTarea), el wizard
            // lo pinta y `ampliarTareasPlanOwner` lo aplica — pero el mapeo de esta
            // ruta solo copiaba cuatro campos, así que por la puerta del agente la
            // única opción era «crear otra». El resultado es el tablero con dos
            // tarjetas de lo mismo, que es justo lo que el cruce vino a evitar.
            enriquece: o.enriquece as { id: string; razon: string; confianza?: 'alta' | 'media' } | undefined,
            // «Se repite para siempre» (mig 0163). Se caía acá por el MISMO agujero que `enriquece`: el choke point
            // (`limpiarTarea` → `decidirRecurrente`, lib/plan-propuesta.ts) dice en su comentario que por él pasan
            // todos los productores «incluida la API del agente», y este mapeo copiaba cinco campos de los seis. Una
            // tarea pedida semanal entraba como tarea única, el Perro le ponía score y deadline, se llevaba un puesto
            // del ranking y titilaba pidiendo una fecha que nunca iba a tener. Y sin error: un campo que no está en el
            // objeto que devuelve el `map` es indistinguible de uno que el agente no mandó.
            // El desempate con `deadline` NO va acá: lo hace `decidirRecurrente`, para todos los productores igual.
            recurrente: o.recurrente === true ? true : undefined,
          };
        }),
        // `preguntas` ya no viaja: el alta dejó de preguntar (05/10/2026). Si un agente
        // viejo las manda, se ignoran acá y no en el borrador.
        eliminar: Array.isArray(body.eliminar) ? body.eliminar : [],
        // «Estas ya están hechas»: el agente las PROPONE con su evidencia (commit,
        // archivo:línea) y el dueño las confirma de a una en /plan/revisar. Nunca se
        // cierran solas: la precisión medida de un «ya está hecho» dicho por IA fue
        // 8 de 17 en la corrida real del 5/8 — sin confirmación humana, esto convierte
        // el tablero en algo que no se puede creer.
        cerrar,
        resumen: String(body.resumen ?? ''),
        origen: 'claude-code',
      }),
    );
    return NextResponse.json({ ok: true, id, url: linkApp(`/plan/revisar/${id}`, wsEnContexto()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
