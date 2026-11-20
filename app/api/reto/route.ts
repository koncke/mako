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
import { CLAVE_RETO, HORAS_WA, cuandoSeAbrio, diaAbierto, estadoDeLosDias, inicioConLaPrueba, leerEstado, tareaHecha, zonaValida, type EstadoReto } from '@/lib/reto/dias';
import { estadoDeIntegraciones, leerTareasHechas } from '@/lib/reto/senales';

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
  // El reto en el Plan (d24-22): la primera vez, el proyecto y sus 7 tareas; después, cada vez que MaKo lee algo nuevo, cierra los días
  // hechos (y crea el que falte). Por las funciones del Plan (lib/reto/plan.ts). Si falla, el reto sigue: no es lo que se ve acá.
  // ⚠️ LA PRIMERA VEZ SE RESERVA con compare-and-set: al cargar, varias partes de la pantalla piden /api/reto a la vez, y dos pedidos
  // que ven «todavía no está» crearían el proyecto dos veces. Crea sólo el que gana la reserva.
  const conLoNuevo = { ...e, hechas: { ...e.hechas, ...Object.fromEntries(Object.keys(nuevas).map((k) => [k, e.hechas[k] ?? new Date().toISOString()])) } };
  // Sólo se pregunta si hace falta (la primera vez, o con algo nuevo leído): es una lectura más por pedido.
  const delPlan = e.enElPlan !== true || Object.keys(nuevas).length ? await (async () => {
    const ws = await getWorkspaceActual().catch(() => null);
    const m = ws == null ? null : await import('@/lib/reto/plan');
    return ws != null && m && (await m.elRetoVaAlPlan(ws).catch(() => false)) ? { ws, m } : null;
  })() : null;
  const alPlan = async () => { if (delPlan) await delPlan.m.sincronizarRetoConElPlan(delPlan.ws, conLoNuevo).catch(() => false); };
  let reservo = false;
  if (delPlan && e.enElPlan !== true) {
    const crudo = await IO.leer().catch(() => null);
    const x = leerEstado(crudo);
    reservo = !!x && x.enElPlan !== true && (await IO.cas(crudo, JSON.stringify({ ...x, enElPlan: true })).catch(() => false));
    if (reservo) await alPlan();
  } else if (delPlan && Object.keys(nuevas).length) await alPlan();
  const conPlan = (x: EstadoReto): EstadoReto => (reservo || x.enElPlan ? { ...x, enElPlan: true } : x);
  // Cuándo se ABRIÓ cada día (R57-F3: la fecha que lo separa en el hilo), también los que se abrieron sin que nadie mirara (d24-11).
  // La de cuando se abrió, no la de cuando se vio (segunda verificación del 20/11: `cuandoSeAbrio`, lib/reto/dias.ts).
  const abiertos = Array.from({ length: diaAbierto(e, Date.now()) }, (_, i) => String(i + 1));
  const sinFecha = abiertos.some((n) => !e.abiertoEl?.[n]);
  if (!Object.keys(nuevas).length && !sinFecha) return conPlan(e);
  const cuando = new Date().toISOString();
  // Con compare-and-set (lib/reto/cambiar.ts): sólo suma lo leído, sobre lo último guardado, y no pisa la hora del WhatsApp.
  const r = await cambiarReto(IO, (x) => ({ ...x, hechas: { ...x.hechas, ...Object.fromEntries(Object.keys(nuevas).filter((k) => !x.hechas[k]).map((k) => [k, cuando])) }, leidas: { ...(x.leidas ?? {}), ...nuevas },
    abiertoEl: { ...Object.fromEntries(abiertos.map((n) => [n, new Date(cuandoSeAbrio(x, Number(n), Date.parse(cuando)) ?? Date.parse(cuando)).toISOString()])), ...(x.abiertoEl ?? {}) } })).catch(() => null);
  return conPlan(r ?? e);
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

/** Cuándo cobra la prueba (el primer cobro, `estadoDePrueba().hasta`): de ahí sale el día 1 del reto (R57-19). Sin prueba, null. */
async function cobroDeLaPrueba(): Promise<string | null> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return null;
    const p = await (await import('@/lib/prueba-uso')).estadoDePrueba(ws);
    return p.enPrueba ? p.hasta : null;
  } catch { return null; }
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

/** El QR de la app (el link único, como el paso de los avisos del onboarding: lib/onboarding-arranque-server.ts). Sin él, null. */
async function qrDeLaApp(): Promise<string | null> {
  try {
    const [{ default: QRCode }, { linkApp }, { RUTA_APP }] = await Promise.all([import('qrcode'), import('@/lib/app-url'), import('@/lib/app-tiendas')]);
    return await QRCode.toDataURL(linkApp(RUTA_APP, null), { margin: 1, width: 336 });
  } catch { return null; }
}

/** Lo del día 2, con el día abierto (20/11, d24-05 y d24-06): sus integraciones con su estado, y el QR mientras la app no esté. */
async function delDia2(e: EstadoReto | null, abierto: number) {
  if (!e || abierto < 2) return { integraciones: [], qrApp: null };
  const [integraciones, qrApp] = await Promise.all([estadoDeIntegraciones().catch(() => []), tareaHecha(e, 2, 'app') ? null : qrDeLaApp()]);
  return { integraciones, qrApp };
}

async function respuesta(e: EstadoReto | null, numero: string | null) {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  const [f, i, unaVez, d2] = await Promise.all([funnel(), intereses(), essentialEnPrueba(), delDia2(e, abierto)]);
  return Response.json({ ok: true, ve: true, estado: e, abierto, dias, hechos, linea: numero, funnel: f, intereses: i, proUnaVez: unaVez, ...d2 });
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
    // Y se abrió AHORA (R57-F3): la fecha exacta del día en el hilo.
    return { ...e, adelantado: dia, adelantadoEn: new Date(ahora).toISOString(), avisado: Math.max(e.avisado ?? 1, dia), abiertoEl: { ...(e.abiertoEl ?? {}), [String(dia)]: new Date(ahora).toISOString() },
      adelantados: [...new Set([...(e.adelantados ?? []), dia])] };
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
  const body = (await req.json().catch(() => ({}))) as { accion?: string; dia?: unknown; id?: unknown; hora?: unknown; pestana?: unknown; zona?: unknown };
  let e = await leer();
  const ahora = Date.now();
  if (body.accion === 'empezar') {
    // Sólo si no había: compare-and-set contra «no hay» (dos pestañas abiertas no lo empiezan dos veces).
    // El día 1 es el primero de la prueba (R57-19) y los días se abren a la hora de SU zona, la del navegador (R57-20).
    if (!e) {
      const zona = typeof body.zona === 'string' && zonaValida(body.zona) ? body.zona : undefined;
      const nuevo: EstadoReto = { v: 1, inicio: new Date(inicioConLaPrueba(ahora, await cobroDeLaPrueba())).toISOString(), adelantado: 1, hechas: {}, leidas: {}, ...(zona ? { zona } : {}) };
      await IO.cas(null, JSON.stringify(nuevo)).catch(() => false); e = (await leer()) ?? nuevo;
    }
    return respuesta(e, await linea());
  }
  if (!e) return Response.json({ ok: false, error: 'El reto todavía no empezó.' }, { status: 409 });
  const primero = aplicar(e, body, ahora);
  if (primero instanceof Response) return primero;
  const escrito = await cambiarReto(IO, (x) => { const y = aplicar(x, body, ahora); return y instanceof Response ? x : y; }).catch(() => null);
  return respuesta(escrito ?? primero, await linea());
}
