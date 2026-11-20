import 'server-only';
// =============================================================================
// LO QUE MaKo LEE PARA DAR UNA TAREA DEL RETO POR HECHA (20/11/2026)
// =============================================================================
// Auditoría del Cerebro (D1-01, d24-07, d24-12, R57-09): las tareas quedaban «Listo» con sólo tocar la fila del coach o la pestaña
// marcada. Lo acordado (la maqueta, `tareasDePanel`): no hay «ya lo hice»; MaKo LEE lo que pasó y lo marca solo, y dice lo que leyó
// («Leí 134 contactos en tu CRM.»). Cada lectura sale de datos del negocio que la app ya guarda, con la regla de lib/plan-senales.ts:
// sólo dice «sí» con evidencia positiva, y ante la duda (un error, una tabla que no se pudo leer) dice que no.
//
// Las trampas de cada una (medidas el 20/11), para no volver a caer:
//   · El funnel: TODO negocio nace con uno por defecto (`crearWorkspace`); cuenta el plan del Funnel Coach o un CRM que no sea el default.
//   · La oferta: la del perfil (`desde_brief`) no la armó nadie; cuenta la sesión del Offer Coach con una conclusión.
//   · La foto: entrar con Google pone la de Google sola; cuenta sólo la subida a MaKo (el bucket `avatars`).
//   · La automatización: toda secuencia nace apagada; cuenta una ACTIVA (contar filas daba verde con las del onboarding).
//   · El guion: al abrir Copywriter se mudan los guiones viejos con sus fechas; cuenta uno tocado desde que empezó el reto.
//   · El carrusel: un diseño en blanco es una lámina; cuenta uno de 2 láminas o más.
//   · El Plan: todo cliente nuevo recibe un plan de arranque; cuentan sólo las tareas que dejó el CoPilot (`#copiloto:`).
// Sin poder leer el usuario (otra sesión, una suplantación) lo de la persona (la app, la foto) queda en no.
// =============================================================================
import type { EstadoReto, IntegracionReto } from './dias';
import { DIAS_RETO, claveTarea, diaAbierto, integracionesDelReto } from './dias';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { getSetting } from '../settings';
import { integracionConectada } from '../credenciales';

/**
 * NO SE PUDO LEER (20/11/2026, d24-04): la lectura falló, o mira a LA PERSONA y no está su sesión (la vuelta de cada hora no la
 * tiene). Ni hecha ni falta: el chat del reto la deja sin marcar, como antes, y la noche no la nombra («no lo sé» no es «falta»:
 * decirle que le falta algo que ya hizo es justo lo que no puede pasar).
 */
export const NO_SE_LEE: unique symbol = Symbol('no-se-lee');
/** Lo que dice una lectura: hecha (lo que leyó), falta (null) o no se pudo leer. */
type Leida = string | null | typeof NO_SE_LEE;

/** Las tareas que miran a la persona, no al negocio: sin su sesión no se pueden leer. */
export const PIDEN_LA_PERSONA: readonly string[] = ['2:app', '2:perfil'];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Cuántas filas; null si no se pudo leer (antes daba 0, y un error se leía como «falta»). */
async function contar(tabla: string, filtro?: (q: any) => any): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const db = await getTenantDb();
    let q = db.from(tabla).select('*', { count: 'exact', head: true });
    if (filtro) q = filtro(q);
    const { count, error } = await q;
    return error ? null : count ?? 0;
  } catch { return null; }
}
/** Hecha con `minimo` filas o más; sin poder contar, no se sabe. */
const siHay = (n: number | null, texto: (n: number) => string, minimo = 1): Leida => (n == null ? NO_SE_LEE : n >= minimo ? texto(n) : null);

async function plan() { try { return await (await import('../funnel-plan-db')).leerPlanFunnel(); } catch { return null; } }

/** Las integraciones que pide lo que eligió (lib/reto/dias.ts, `integracionesDelReto`), cada una con si ya está conectada (d24-05). */
export async function estadoDeIntegraciones(): Promise<Array<IntegracionReto & { conectada: boolean }>> {
  const p = await plan();
  const ints = integracionesDelReto(p ? [p.funnel, ...(p.otros ?? [])] : []);
  try {
    const { getIntegracion } = await import('../integraciones');
    return await Promise.all(ints.map(async (i) => ({ ...i, conectada: (await getIntegracion(i.key).catch(() => null))?.estado === 'conectada' })));
  } catch { return ints.map((i) => ({ ...i, conectada: false })); }
}

const LECTURAS: Record<string, (e: EstadoReto) => Promise<Leida>> = {
  '1:offer': async () => {
    try {
      const id = await (await import('../onboarding-v2/offer-coach-db')).sesionDelOfferCoach();
      if (id == null) return null;
      const f = await (await import('../offer-sesiones')).leerFila(id);
      return f && f.conclusiones.length > 0 ? 'Tu oferta ya está armada, con su diagnóstico.' : null;
    } catch { return NO_SE_LEE; }
  },
  '1:funnel': async () => {
    const p = await plan();
    if (p) return `Elegiste tu funnel: ${(await import('../funnel-plan')).ROTULO_FUNNEL[p.funnel] ?? p.funnel}.`;
    return siHay(await contar('funnels', (q) => q.eq('es_default', false)), () => 'Tu CRM ya tiene las etapas de tu funnel.');
  },
  '2:app': async () => {
    try { const a = await (await import('../avisos-telefono')).avisosDeQuienEntra(); if (!a.aplica) return NO_SE_LEE; return a.listos ? 'Tu teléfono ya recibe los avisos de MaKo.' : null; } catch { return NO_SE_LEE; }
  },
  '2:extension': async () => {
    try { const p = await (await import('../flow-cola')).estadoPuente(); return p.ultimoVisto ? 'Tu extensión de Chrome está conectada.' : null; } catch { return NO_SE_LEE; }
  },
  '2:integraciones': async () => {
    const ints = await estadoDeIntegraciones();
    return ints.length && ints.every((i) => i.conectada) ? `Conectaste ${ints.map((i) => i.nombre).join(' y ')}: lo que pide lo que elegiste.` : null;
  },
  '2:perfil': async () => {
    try { const p = await (await import('../perfil')).getPerfil(); return /\/object\/public\/avatars\//.test(p.avatarUrl ?? '') ? 'Ya tienes tu foto de perfil.' : null; } catch { return NO_SE_LEE; }
  },
  '3:contactos': async () => siHay(await contar('leads'), (n) => `Leí ${plural(n, 'contacto', 'contactos')} en tu CRM.`),
  '3:automatizacion': async () => siHay(await contar('nutricion_secuencias', (q) => q.eq('activa', true).is('archivada_at', null)), () => 'MaKo ya atiende solo a tus clientes.'),
  '3:calendar': async () => {
    try {
      if (await (await import('../google-calendar')).googleCalendarConectado()) return 'Tu Google Calendar quedó conectado.';
      if (await integracionConectada('calendly').catch(() => false)) return 'Tu Calendly quedó conectado.';
      if (await integracionConectada('calcom').catch(() => false)) return 'Tu Cal.com quedó conectado.';
      return null;
    } catch { return NO_SE_LEE; }
  },
  '4:spy': async () => siHay(await contar('spy_competidores'), (n) => `Ya sigues a ${plural(n, 'competidor', 'competidores')}.`, 3),
  '4:web': async () => siHay(await contar('landing_docs', (q) => q.is('papelera_at', null)), () => 'Tu página ya está en Web Generator.'),
  '5:carrusel': async () => siHay(await contar('image_disenos', (q) => q.gte('paginas', 2).is('borrado_at', null)), () => 'Tu carrusel está listo.'),
  '5:guion': async (e) => {
    try {
      const r = await (await import('../copywriter/server')).listar();
      return r.ok && r.paginas.some((p) => !p.papelera && p.actualizado >= e.inicio) ? 'Tu guion está escrito.' : null;
    } catch { return NO_SE_LEE; }
  },
  '6:personaje': async () => {
    try { const ls = await (await import('../../app/ai-avatar/looks')).leerLooks(); return ls.some((l) => l.mediaId && l.url && !l.error) ? 'Tu personaje con IA está creado.' : null; } catch { return NO_SE_LEE; }
  },
  '6:clip': async () => {
    try {
      const h = await (await import('../../app/video-generator/video-datos')).leerHistorial();
      const filmado = h.some((p) => p.tipo === 'avatar' && Object.values(p.video ?? {}).some((v) => !!(v as { url?: string; operacion?: string }).url || !!(v as { operacion?: string }).operacion));
      return filmado ? 'Tu primer clip con tu personaje ya está filmado.' : null;
    } catch { return NO_SE_LEE; }
  },
  '7:copilot': async () => ((await getSetting('marketing-copilot.perfil').catch(() => null))?.trim().length ?? 0) > 2 ? 'Tu CoPilot ya revisó tu negocio.' : null,
  '7:semana': async () => {
    try {
      const ws = await getWorkspaceActual();
      if (ws == null) return null;
      const n = (await (await import('../copiloto/tareas-plan')).tareasEnElPlan(ws)).length;
      return n > 0 ? `Tu CoPilot te dejó ${plural(n, 'tarea', 'tareas')} en el Plan.` : null;
    } catch { return NO_SE_LEE; }
  },
};

/** Las claves que tienen lectura (las demás tareas no se cierran solas). */
export const TAREAS_CON_LECTURA = Object.keys(LECTURAS);

/**
 * Las tareas de los días ABIERTOS que MaKo lee como hechas y todavía no estaban guardadas: { "3:contactos": "Leí 134 contactos…" }.
 * Lo ya guardado no se vuelve a leer (una tarea hecha no se deshace porque después se borre un lead).
 */
export async function leerTareasHechas(e: EstadoReto, ahora = Date.now()): Promise<Record<string, string>> {
  return (await leerTareasDelReto(e, ahora)).hechas;
}

/** Lo leído de las tareas pendientes de los días abiertos: las hechas (con lo que leyó) y las que NO SE PUDIERON LEER. Las demás faltan. */
export type LecturaDelReto = { hechas: Record<string, string>; noSeLeen: string[] };

/**
 * Como `leerTareasHechas`, pero distingue «falta» de «no se pudo leer» (d24-04). `sinSesion`: quien lee no es la persona (la vuelta
 * de cada hora): lo que mira a la persona (`PIDEN_LA_PERSONA`) ni se intenta.
 */
export async function leerTareasDelReto(e: EstadoReto, ahora = Date.now(), o: { sinSesion?: boolean } = {}): Promise<LecturaDelReto> {
  const abierto = diaAbierto(e, ahora);
  const claves = DIAS_RETO.filter((d) => d.n <= abierto).flatMap((d) => d.tareas.map((t) => claveTarea(d.n, t.id)))
    .filter((k) => !e.hechas[k] && LECTURAS[k]);
  const leidas = await Promise.all(claves.map(async (k): Promise<readonly [string, Leida]> =>
    [k, o.sinSesion && PIDEN_LA_PERSONA.includes(k) ? NO_SE_LEE : await LECTURAS[k](e).catch((): Leida => NO_SE_LEE)]));
  // ⚠️ `typeof v === 'string'`, no `!!v`: NO_SE_LEE es un símbolo, y un símbolo es «verdadero».
  return {
    hechas: Object.fromEntries(leidas.filter((x): x is readonly [string, string] => typeof x[1] === 'string')),
    noSeLeen: leidas.filter(([, v]) => v === NO_SE_LEE).map(([k]) => k),
  };
}
