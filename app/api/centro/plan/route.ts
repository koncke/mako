// =============================================================================
// /api/centro/plan — el Plan adentro de cada chat jefe del Centro de Operaciones (16/10/2026)
// =============================================================================
// GET  ?chat=<título del chat>                → las tareas abiertas del proyecto de su jefe.
// POST { accion: 'sumar', chat, texto, dePedido } → suma una tarea, sin preguntas (el Perro pone el resto).
// POST { accion: 'marcar', chat, id }           → la marca hecha (cerrar no es borrar).
// Las reglas y el porqué: lib/centro-plan-reglas.ts. Las operaciones: lib/centro-plan.ts (las de la API de MaKo,
// aplicadas en el acto; ninguna escritura directa a la base).
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION A PROPÓSITO: al aplicar corre el Perro (30 a 60 s), y el navegador manda las
//    server actions de a una (docs de Next: «dispatches and awaits them one at a time»). Como acción, mandarle algo a
//    otro chat quedaba esperando a que el Perro terminara (lo encontró la revisión del 16/10/2026).
// ⚠️ LA GUARDA DEL CENTRO, PRIMERO: getSesionAdmin() + puedeOperar(admin, wsSuperAdmin()) antes de leer nada
//    (tests/centro-plan.test.ts lo fija). Y el POST sólo desde la misma página (el Origin), como las rutas de auth.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { cerrarTareaDelPlan, ctxDelCentro, leerPlanDelJefe, sumarTareaAlPlan } from '@/lib/centro-plan';
import { evidenciaDeCierre, proyectoDelChat, tareaDePedido, tituloValido } from '@/lib/centro-plan-reglas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NO_PUEDE = 'Entra con tu segundo factor para usar el Centro.';
const TOPE_CHAT = 120;
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Algo falló: vuelve a intentarlo.');

function origenValido(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

const chatValido = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= TOPE_CHAT;

export async function GET(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return NextResponse.json({ ok: false, motivo: NO_PUEDE }, { status: 403 });
  const ws = admin.ws as number; // puedeOperar ya comprobó que es el workspace de la plataforma
  const chat = req.nextUrl.searchParams.get('chat');
  if (!chatValido(chat)) return NextResponse.json({ ok: false, motivo: 'Elige un chat.' }, { status: 400 });
  try {
    return NextResponse.json(await leerPlanDelJefe(ctxDelCentro(ws, admin), chat.trim()));
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return no(NO_PUEDE, 403);
  const ws = admin.ws as number; // puedeOperar ya comprobó que es el workspace de la plataforma
  if (!origenValido(req)) return no('origen no permitido', 403);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!chatValido(body.chat)) return no('Elige un chat.');
  const chat = body.chat.trim();
  const ctx = ctxDelCentro(ws, admin);
  try {
    if (body.accion === 'sumar') {
      const proyecto = proyectoDelChat(chat);
      if (!proyecto) return no('El Cerebro reparte: suma la tarea desde el chat del jefe que la va a hacer.');
      const texto = typeof body.texto === 'string' ? body.texto : '';
      let tarea: { titulo: string; detalle: string };
      if (body.dePedido === true) {
        // Un pedido no se edita: no se rechaza por largo (tareaDePedido lo corta); sólo se acota lo que se lee.
        if (!texto.trim()) return no('No hay texto para sumar al Plan.');
        tarea = tareaDePedido(texto.slice(0, 20_000), chat);
      } else {
        const v = tituloValido(texto);
        if (!v.ok) return no(v.error);
        tarea = { titulo: v.titulo, detalle: `Sumada por Martín desde el Centro de Operaciones, en el chat «${chat}».` };
      }
      return NextResponse.json(await sumarTareaAlPlan(ctx, chat, { ...tarea, proyecto }));
    }
    if (body.accion === 'marcar') {
      const id = body.id;
      if (typeof id !== 'string' || !/^[^\s\u0000-\u001f]{1,80}$/.test(id)) return no('Elige la tarea a marcar hecha.');
      return NextResponse.json(await cerrarTareaDelPlan(ctx, chat, { id, evidencia: evidenciaDeCierre(chat) }));
    }
    return no('Acción desconocida.');
  } catch (e) {
    return no(msg(e), 500);
  }
}
