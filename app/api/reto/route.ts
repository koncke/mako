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
import { cambiarSettingSi, getSetting } from '@/lib/settings';
import { cambiarReto, type IoReto } from '@/lib/reto/cambiar';
import { veOnboardingV2 } from '@/lib/onboarding-v2/revision';
import { WHATSAPP_MAKO } from '@/app/vsl/_sitio/contacto';
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

/** `reto.estado` con compare-and-set (lib/reto/cambiar.ts): lo que escribe el WhatsApp en el medio no se pisa. */
const IO: IoReto = { leer: () => getSetting(CLAVE_RETO).catch(() => null), cas: (esperado, nuevo) => cambiarSettingSi(CLAVE_RETO, esperado, nuevo) };

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
  // Con compare-and-set (lib/reto/cambiar.ts): sólo suma lo leído, sobre lo último guardado, y no pisa la hora del WhatsApp.
  const r = await cambiarReto(IO, (x) => ({ ...x, hechas: { ...x.hechas, ...Object.fromEntries(Object.keys(nuevas).filter((k) => !x.hechas[k]).map((k) => [k, cuando])) }, leidas: { ...(x.leidas ?? {}), ...nuevas } })).catch(() => null);
  return r ?? e;
}

/**
 * El número de MaKo para los links del reto (20/11/2026, la auditoría wa-f4): el publicado (app/vsl/_sitio/contacto.ts), el de la línea
 * que recibe. Antes salía de `numeroLinea` de la verificación: si la línea cambiaba de número después de verificar, el link abría el
 * viejo, y una verificación de antes del 4/11 (sin ese campo) dibujaba «La línea de MaKo no está conectada» con la línea andando.
 * Sin preguntarle a Evolution ni pasar por lib/mako-grupo, que llega a una IA (tests/d6b-rutas.test.ts).
 */
async function linea(): Promise<string | null> {
  return WHATSAPP_MAKO.numero;
}

/** El funnel principal que eligió en Funnel Coach (`funnel_coach.plan`): arma los días 4 a 6 (`diasDelReto`). Sin plan, null. */
async function funnel(): Promise<string | null> {
  try { const p = JSON.parse((await getSetting('funnel_coach.plan')) ?? 'null') as { funnel?: unknown } | null; return typeof p?.funnel === 'string' ? p.funnel : null; } catch { return null; }
}

/** Lo que eligió en «¿Qué te gustaría que MaKo resuelva primero?» (`onboarding.arranque` → intereses): «¿Qué hacemos ahora?». */
async function intereses(): Promise<string[]> {
  try { const a = JSON.parse((await getSetting('onboarding.arranque')) ?? 'null') as { intereses?: unknown } | null; return Array.isArray(a?.intereses) ? a.intereses.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}

/** ¿Es una prueba de MaKo Essential? (20/11, R57-03): ahí lo de Pro de los días 4 a 6 se usa una vez, y la tarjeta lo dice. */
async function essentialEnPrueba(): Promise<boolean> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return false;
    const [{ estadoDePrueba }, { esEsencialDe }] = await Promise.all([import('@/lib/prueba-uso'), import('@/lib/plan-esencial')]);
    return (await estadoDePrueba(ws)).enPrueba && (await esEsencialDe(ws));
  } catch { return false; }
}

async function respuesta(e: EstadoReto | null, numero: string | null) {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  const [f, i, unaVez] = await Promise.all([funnel(), intereses(), essentialEnPrueba()]);
  return Response.json({ ok: true, ve: true, estado: e, abierto, dias, hechos, linea: numero, funnel: f, intereses: i, proUnaVez: unaVez });
}

export async function GET() {
  const q = await quien();
  if (!q) return Response.json({ ok: true, ve: false });
  const [e, numero] = await Promise.all([leer().then(conLoLeido), linea()]);
  return respuesta(e, numero);
}

/**
 * Lo que hace cada acción sobre el reto (o el error para la persona). Se aplica sobre lo ÚLTIMO leído: si el compare-and-set pierde
 * (la hora llegó por WhatsApp en el medio), se vuelve a aplicar sobre lo nuevo (lib/reto/cambiar.ts).
 */
function aplicar(e: EstadoReto, body: { accion?: string; dia?: unknown; id?: unknown; hora?: unknown; pestana?: unknown }, ahora: number): EstadoReto | Response {
  if (body.accion === 'adelantar') {
    const dia = Number(body.dia);
    const abierto = diaAbierto(e, ahora);
    if (!Number.isInteger(dia) || dia !== abierto + 1 || dia > 7) return Response.json({ ok: false, error: 'Ese día no se puede adelantar.' }, { status: 400 });
    // Adelantado = abierto ahora: el que sigue se abre mañana a su hora (adelantadoEn), y este día no lleva aviso de la mañana
    // (`avisado`): lo acordado es que el aviso sale sólo cuando el día se abre por calendario.
    return { ...e, adelantado: dia, adelantadoEn: new Date(ahora).toISOString(), avisado: Math.max(e.avisado ?? 1, dia) };
  }
  // «Empezar mi día 1» (D1-02): desde acá el chat muestra los días.
  if (body.accion === 'dia1') return { ...e, dia1Desde: e.dia1Desde ?? new Date(ahora).toISOString() };
  if (body.accion === 'muestra') {
    const p = String(body.pestana ?? '');
    if (!/^[a-z-]{2,30}$/.test(p)) return Response.json({ ok: false, error: 'Esa pestaña no es del reto.' }, { status: 400 });
    return { ...e, muestras: [...new Set([...(e.muestras ?? []), p])] };
  }
  if (body.accion === 'despues') {
    // «Lo hago después» (R57-F1): queda guardado; el día termina igual y la tarea sigue marcada como pendiente.
    const k = `${Number(body.dia)}:${String(body.id ?? '')}`;
    if (!/^\d:[a-z-]+$/.test(k)) return Response.json({ ok: false, error: 'Esa tarea no es del reto.' }, { status: 400 });
    return { ...e, despues: [...new Set([...(e.despues ?? []), k])] };
  }
  if (body.accion === 'manana') {
    // «Mañana» (D1-06): la respuesta queda en el chat.
    const dia = Number(body.dia);
    if (!Number.isInteger(dia) || dia < 2 || dia > 7) return Response.json({ ok: false, error: 'Ese día no es del reto.' }, { status: 400 });
    return { ...e, manana: dia };
  }
  if (body.accion === 'hora') {
    const hora = String(body.hora ?? '');
    if (!(HORAS_WA as readonly string[]).includes(hora)) return Response.json({ ok: false, error: 'Esa hora no está entre las del reto.' }, { status: 400 });
    return { ...e, horaWa: hora };
  }
  return Response.json({ ok: false, error: 'Acción desconocida.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const q = await quien();
  if (!q) return Response.json({ ok: false, ve: false }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { accion?: string; dia?: unknown; id?: unknown; hora?: unknown; pestana?: unknown };
  let e = await leer();
  const ahora = Date.now();
  if (body.accion === 'empezar') {
    // Sólo si no había: compare-and-set contra «no hay» (dos pestañas abiertas no lo empiezan dos veces).
    if (!e) { const nuevo: EstadoReto = { v: 1, inicio: new Date(ahora).toISOString(), adelantado: 1, hechas: {}, leidas: {} }; await IO.cas(null, JSON.stringify(nuevo)).catch(() => false); e = (await leer()) ?? nuevo; }
    return respuesta(e, await linea());
  }
  if (!e) return Response.json({ ok: false, error: 'El reto todavía no empezó.' }, { status: 409 });
  const primero = aplicar(e, body, ahora);
  if (primero instanceof Response) return primero;
  const escrito = await cambiarReto(IO, (x) => { const y = aplicar(x, body, ahora); return y instanceof Response ? x : y; }).catch(() => null);
  return respuesta(escrito ?? primero, await linea());
}
