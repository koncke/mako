// =============================================================================
// /api/reto — el reto de 7 días del negocio: en qué día va y lo hecho (18/11/2026)
// =============================================================================
//   GET                                        → { ok, ve, estado, abierto, dias, hechos, linea }
//   POST { accion: 'empezar' }                 → empieza el reto (el día 1, ahora). Si ya empezó, no hace nada.
//   POST { accion: 'adelantar', dia }          → abre el día que sigue al abierto, ya.
//   (Sin 'hecha' desde el 20/11: una tarea queda hecha cuando MaKo LEE que se hizo, en cada GET; lib/reto/senales.ts.)
//   POST { accion: 'dia1' }                     → eligió «Empezar mi día 1» (20/11, D1-02).
//   POST { accion: 'muestra', pestana }         → eligió «Muéstrame {pestaña}» (20/11, D1-02 y V3).
//   POST { accion: 'hora', hora }              → a qué hora le escribe MaKo por WhatsApp (la eligió al escribirle).
// Detrás del interruptor del onboarding V2 (lib/onboarding-v2/revision.ts): a quien no lo ve, `ve: false` y nada más. Guarda en
// `app_settings` del negocio de la pestaña (`reto.estado`). Lo que es cada día vive en lib/reto/dias.ts.
// =============================================================================
import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { veOnboardingV2 } from '@/lib/onboarding-v2/revision';
import { CLAVE_RETO, HORAS_WA, diaAbierto, estadoDeLosDias, leerEstado, type EstadoReto } from '@/lib/reto/dias';
import { leerTareasHechas } from '@/lib/reto/senales';

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

/**
 * Lo que MaKo lee como hecho en los días abiertos (lib/reto/senales.ts), guardado con lo que leyó (20/11, auditoría D1-01, d24-12 y
 * R57-09): las tareas ya no se cierran por tocar la pestaña. Se lee en cada GET: abrir el chat del reto, o volver a él, actualiza.
 */
async function conLoLeido(e: EstadoReto | null): Promise<EstadoReto | null> {
  if (!e) return e;
  const nuevas = await leerTareasHechas(e).catch(() => ({} as Record<string, string>));
  if (!Object.keys(nuevas).length) return e;
  const cuando = new Date().toISOString();
  const r: EstadoReto = { ...e, hechas: { ...e.hechas, ...Object.fromEntries(Object.keys(nuevas).map((k) => [k, cuando])) }, leidas: { ...(e.leidas ?? {}), ...nuevas } };
  await setSetting(CLAVE_RETO, JSON.stringify(r)).catch(() => {});
  return r;
}

/**
 * El número de la línea de MaKo a la que la persona ya le escribió (la verificación de su WhatsApp lo guarda: `numeroLinea` en
 * `mako.contacto.verificacion`). Sin preguntarle a Evolution ni pasar por lib/mako-grupo, que llega a una IA (tests/d6b-rutas.test.ts).
 */
async function linea(): Promise<string | null> {
  try {
    const v = JSON.parse((await getSetting('mako.contacto.verificacion')) ?? 'null') as { numeroLinea?: unknown } | null;
    const n = String(v?.numeroLinea ?? '').replace(/\D/g, '');
    return n.length >= 8 ? n : null;
  } catch { return null; }
}

/** El funnel principal que eligió en Funnel Coach (`funnel_coach.plan`): arma los días 4 a 6 (`diasDelReto`). Sin plan, null. */
async function funnel(): Promise<string | null> {
  try { const p = JSON.parse((await getSetting('funnel_coach.plan')) ?? 'null') as { funnel?: unknown } | null; return typeof p?.funnel === 'string' ? p.funnel : null; } catch { return null; }
}

/** Lo que eligió en «¿Qué te gustaría que MaKo resuelva primero?» (`onboarding.arranque` → intereses): «¿Qué hacemos ahora?». */
async function intereses(): Promise<string[]> {
  try { const a = JSON.parse((await getSetting('onboarding.arranque')) ?? 'null') as { intereses?: unknown } | null; return Array.isArray(a?.intereses) ? a.intereses.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}

async function respuesta(e: EstadoReto | null, numero: string | null) {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  const [f, i] = await Promise.all([funnel(), intereses()]);
  return Response.json({ ok: true, ve: true, estado: e, abierto, dias, hechos, linea: numero, funnel: f, intereses: i });
}

export async function GET() {
  const q = await quien();
  if (!q) return Response.json({ ok: true, ve: false });
  const [e, numero] = await Promise.all([leer().then(conLoLeido), linea()]);
  return respuesta(e, numero);
}

export async function POST(req: NextRequest) {
  const q = await quien();
  if (!q) return Response.json({ ok: false, ve: false }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { accion?: string; dia?: unknown; id?: unknown; hora?: unknown };
  let e = await leer();
  const ahora = Date.now();
  if (body.accion === 'empezar') {
    if (!e) { e = { v: 1, inicio: new Date(ahora).toISOString(), adelantado: 1, hechas: {}, leidas: {} }; await setSetting(CLAVE_RETO, JSON.stringify(e)); }
    return respuesta(e, await linea());
  }
  if (!e) return Response.json({ ok: false, error: 'El reto todavía no empezó.' }, { status: 409 });
  if (body.accion === 'adelantar') {
    const dia = Number(body.dia);
    const abierto = diaAbierto(e, ahora);
    if (!Number.isInteger(dia) || dia !== abierto + 1 || dia > 7) return Response.json({ ok: false, error: 'Ese día no se puede adelantar.' }, { status: 400 });
    // Adelantado = abierto ahora: el que sigue se abre mañana a su hora (adelantadoEn), y este día no lleva aviso de la mañana
    // (`avisado`): lo acordado es que el aviso sale sólo cuando el día se abre por calendario.
    e = { ...e, adelantado: dia, adelantadoEn: new Date(ahora).toISOString(), avisado: Math.max(e.avisado ?? 1, dia) };
  } else if (body.accion === 'dia1') {
    // «Empezar mi día 1» (D1-02): desde acá el chat muestra los días.
    e = { ...e, dia1Desde: e.dia1Desde ?? new Date(ahora).toISOString() };
  } else if (body.accion === 'muestra') {
    const p = String((body as { pestana?: unknown }).pestana ?? '');
    if (!/^[a-z-]{2,30}$/.test(p)) return Response.json({ ok: false, error: 'Esa pestaña no es del reto.' }, { status: 400 });
    e = { ...e, muestras: [...new Set([...(e.muestras ?? []), p])] };
  } else if (body.accion === 'despues') {
    // «Lo hago después» (R57-F1): queda guardado; el día termina igual y la tarea sigue marcada como pendiente.
    const k = `${Number(body.dia)}:${String(body.id ?? '')}`;
    if (!/^\d:[a-z-]+$/.test(k)) return Response.json({ ok: false, error: 'Esa tarea no es del reto.' }, { status: 400 });
    e = { ...e, despues: [...new Set([...(e.despues ?? []), k])] };
  } else if (body.accion === 'manana') {
    // «Mañana» (D1-06): la respuesta queda en el chat.
    const dia = Number(body.dia);
    if (!Number.isInteger(dia) || dia < 2 || dia > 7) return Response.json({ ok: false, error: 'Ese día no es del reto.' }, { status: 400 });
    e = { ...e, manana: dia };
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
