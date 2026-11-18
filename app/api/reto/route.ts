// =============================================================================
// /api/reto — el reto de 7 días del negocio: en qué día va y lo hecho (18/11/2026)
// =============================================================================
//   GET                                        → { ok, ve, estado, abierto, dias, hechos, linea }
//   POST { accion: 'empezar' }                 → empieza el reto (el día 1, ahora). Si ya empezó, no hace nada.
//   POST { accion: 'adelantar', dia }          → abre el día que sigue al abierto, ya.
//   POST { accion: 'hecha', dia, id }          → una tarea del día, hecha (la persona tocó lo marcado).
//   POST { accion: 'hora', hora }              → a qué hora le escribe MaKo por WhatsApp (la eligió al escribirle).
// Detrás del interruptor del onboarding V2 (lib/onboarding-v2/revision.ts): a quien no lo ve, `ve: false` y nada más. Guarda en
// `app_settings` del negocio de la pestaña (`reto.estado`). Lo que es cada día vive en lib/reto/dias.ts.
// =============================================================================
import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { veOnboardingV2 } from '@/lib/onboarding-v2/revision';
import { CLAVE_RETO, DIAS_RETO, HORAS_WA, claveTarea, diaAbierto, estadoDeLosDias, leerEstado, type EstadoReto } from '@/lib/reto/dias';

export const dynamic = 'force-dynamic';

async function quien(): Promise<{ ws: number } | null> {
  const s = await getUsuarioActual().catch(() => null);
  if (!s || s.legacy) return null;
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null || !veOnboardingV2({ email: s.email, ws })) return null;
  return { ws };
}

async function leer(): Promise<EstadoReto | null> {
  return leerEstado(await getSetting(CLAVE_RETO).catch(() => null));
}

async function linea(): Promise<string | null> {
  try {
    const { lineaQueRecibe } = await import('@/lib/mako-grupo');
    return (await lineaQueRecibe())?.numero ?? null;
  } catch { return null; }
}

function respuesta(e: EstadoReto | null, numero: string | null) {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  return Response.json({ ok: true, ve: true, estado: e, abierto, dias, hechos, linea: numero });
}

export async function GET() {
  const q = await quien();
  if (!q) return Response.json({ ok: true, ve: false });
  const [e, numero] = await Promise.all([leer(), linea()]);
  return respuesta(e, numero);
}

export async function POST(req: NextRequest) {
  const q = await quien();
  if (!q) return Response.json({ ok: false, ve: false }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { accion?: string; dia?: unknown; id?: unknown; hora?: unknown };
  let e = await leer();
  const ahora = Date.now();
  if (body.accion === 'empezar') {
    if (!e) { e = { v: 1, inicio: new Date(ahora).toISOString(), adelantado: 1, hechas: {} }; await setSetting(CLAVE_RETO, JSON.stringify(e)); }
    return respuesta(e, await linea());
  }
  if (!e) return Response.json({ ok: false, error: 'El reto todavía no empezó.' }, { status: 409 });
  if (body.accion === 'adelantar') {
    const dia = Number(body.dia);
    const abierto = diaAbierto(e, ahora);
    if (!Number.isInteger(dia) || dia !== abierto + 1 || dia > 7) return Response.json({ ok: false, error: 'Ese día no se puede adelantar.' }, { status: 400 });
    e = { ...e, adelantado: dia };
  } else if (body.accion === 'hecha') {
    const dia = Number(body.dia), id = String(body.id ?? '');
    const d = DIAS_RETO.find((x) => x.n === dia);
    if (!d || !d.tareas.some((t) => t.id === id) || dia > diaAbierto(e, ahora)) return Response.json({ ok: false, error: 'Esa tarea no es de un día abierto.' }, { status: 400 });
    e = { ...e, hechas: { ...e.hechas, [claveTarea(dia, id)]: new Date(ahora).toISOString() } };
  } else if (body.accion === 'hora') {
    const hora = String(body.hora ?? '');
    if (!(HORAS_WA as readonly string[]).includes(hora)) return Response.json({ ok: false, error: 'Esa hora no está entre las del reto.' }, { status: 400 });
    e = { ...e, horaWa: hora };
  } else {
    return Response.json({ ok: false, error: 'Acción desconocida.' }, { status: 400 });
  }
  await setSetting(CLAVE_RETO, JSON.stringify(e));
  return respuesta(e, await linea());
}
