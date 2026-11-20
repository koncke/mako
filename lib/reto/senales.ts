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
import type { EstadoReto } from './dias';
import { DIAS_RETO, claveTarea, diaAbierto } from './dias';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { getSetting } from '../settings';
import { integracionConectada } from '../credenciales';
import type { Funnel } from '../funnel-plan';

type Leida = string | null;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

async function contar(tabla: string, filtro?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const db = await getTenantDb();
    let q = db.from(tabla).select('*', { count: 'exact', head: true });
    if (filtro) q = filtro(q);
    const { count, error } = await q;
    return error ? 0 : count ?? 0;
  } catch { return 0; }
}

/** Las integraciones que pide cada funnel (lo acordado el 16/11: «sólo las de lo que eligió»). */
export const INTEGRA_POR: Readonly<Record<Funnel, readonly string[]>> = {
  anuncios: ['meta'], 'anuncios-a-vsl': ['meta'], 'anuncios-a-whatsapp': ['meta', 'whatsapp'],
  organico: ['zernio'], youtube: ['youtube'], 'prospeccion-en-frio': ['whatsapp'],
};
const NOMBRE_INTEGRACION: Record<string, string> = { meta: 'Meta Ads', whatsapp: 'WhatsApp', zernio: 'tu Instagram (Zernio)', youtube: 'YouTube' };

async function plan() { try { return await (await import('../funnel-plan-db')).leerPlanFunnel(); } catch { return null; } }

const LECTURAS: Record<string, (e: EstadoReto) => Promise<Leida>> = {
  '1:offer': async () => {
    try {
      const id = await (await import('../onboarding-v2/offer-coach-db')).sesionDelOfferCoach();
      if (id == null) return null;
      const f = await (await import('../offer-sesiones')).leerFila(id);
      return f && f.conclusiones.length > 0 ? 'Tu oferta ya está armada, con su diagnóstico.' : null;
    } catch { return null; }
  },
  '1:funnel': async () => {
    const p = await plan();
    if (p) return `Elegiste tu funnel: ${(await import('../funnel-plan')).ROTULO_FUNNEL[p.funnel] ?? p.funnel}.`;
    return (await contar('funnels', (q) => q.eq('es_default', false))) > 0 ? 'Tu CRM ya tiene las etapas de tu funnel.' : null;
  },
  '2:app': async () => {
    try { const a = await (await import('../avisos-telefono')).avisosDeQuienEntra(); return a.aplica && a.listos ? 'Tu teléfono ya recibe los avisos de MaKo.' : null; } catch { return null; }
  },
  '2:extension': async () => {
    try { const p = await (await import('../flow-cola')).estadoPuente(); return p.ultimoVisto ? 'Tu extensión de Chrome está conectada.' : null; } catch { return null; }
  },
  '2:integraciones': async () => {
    const p = await plan();
    if (!p) return null;
    const claves = [...new Set([p.funnel, ...(p.otros ?? [])].flatMap((f) => INTEGRA_POR[f] ?? []))];
    if (!claves.length) return null;
    try {
      const { getIntegracion } = await import('../integraciones');
      const ok = await Promise.all(claves.map(async (k) => (await getIntegracion(k).catch(() => null))?.estado === 'conectada'));
      return ok.every(Boolean) ? `Conectaste ${claves.map((k) => NOMBRE_INTEGRACION[k] ?? k).join(' y ')}: lo que pide tu funnel.` : null;
    } catch { return null; }
  },
  '2:perfil': async () => {
    try { const p = await (await import('../perfil')).getPerfil(); return /\/object\/public\/avatars\//.test(p.avatarUrl ?? '') ? 'Ya tienes tu foto de perfil.' : null; } catch { return null; }
  },
  '3:contactos': async () => { const n = await contar('leads'); return n > 0 ? `Leí ${plural(n, 'contacto', 'contactos')} en tu CRM.` : null; },
  '3:automatizacion': async () => (await contar('nutricion_secuencias', (q) => q.eq('activa', true).is('archivada_at', null))) > 0 ? 'MaKo ya atiende solo a tus clientes.' : null,
  '3:calendar': async () => {
    try {
      if (await (await import('../google-calendar')).googleCalendarConectado()) return 'Tu Google Calendar quedó conectado.';
      if (await integracionConectada('calendly').catch(() => false)) return 'Tu Calendly quedó conectado.';
      if (await integracionConectada('calcom').catch(() => false)) return 'Tu Cal.com quedó conectado.';
      return null;
    } catch { return null; }
  },
  '4:spy': async () => { const n = await contar('spy_competidores'); return n >= 3 ? `Ya sigues a ${plural(n, 'competidor', 'competidores')}.` : null; },
  '4:web': async () => (await contar('landing_docs', (q) => q.is('papelera_at', null))) > 0 ? 'Tu página ya está en Web Generator.' : null,
  '5:carrusel': async () => (await contar('image_disenos', (q) => q.gte('paginas', 2).is('borrado_at', null))) > 0 ? 'Tu carrusel está listo.' : null,
  '5:guion': async (e) => {
    try {
      const r = await (await import('../copywriter/server')).listar();
      return r.ok && r.paginas.some((p) => !p.papelera && p.actualizado >= e.inicio) ? 'Tu guion está escrito.' : null;
    } catch { return null; }
  },
  '6:personaje': async () => {
    try { const ls = await (await import('../../app/ai-avatar/looks')).leerLooks(); return ls.some((l) => l.mediaId && l.url && !l.error) ? 'Tu personaje con IA está creado.' : null; } catch { return null; }
  },
  '6:clip': async () => {
    try {
      const h = await (await import('../../app/video-generator/video-datos')).leerHistorial();
      const filmado = h.some((p) => p.tipo === 'avatar' && Object.values(p.video ?? {}).some((v) => !!(v as { url?: string; operacion?: string }).url || !!(v as { operacion?: string }).operacion));
      return filmado ? 'Tu primer clip con tu personaje ya está filmado.' : null;
    } catch { return null; }
  },
  '7:copilot': async () => ((await getSetting('marketing-copilot.perfil').catch(() => null))?.trim().length ?? 0) > 2 ? 'Tu CoPilot ya revisó tu negocio.' : null,
  '7:semana': async () => {
    try {
      const ws = await getWorkspaceActual();
      if (ws == null) return null;
      const n = (await (await import('../copiloto/tareas-plan')).tareasEnElPlan(ws)).length;
      return n > 0 ? `Tu CoPilot te dejó ${plural(n, 'tarea', 'tareas')} en el Plan.` : null;
    } catch { return null; }
  },
};

/** Las claves que tienen lectura (las demás tareas no se cierran solas). */
export const TAREAS_CON_LECTURA = Object.keys(LECTURAS);

/**
 * Las tareas de los días ABIERTOS que MaKo lee como hechas y todavía no estaban guardadas: { "3:contactos": "Leí 134 contactos…" }.
 * Lo ya guardado no se vuelve a leer (una tarea hecha no se deshace porque después se borre un lead).
 */
export async function leerTareasHechas(e: EstadoReto, ahora = Date.now()): Promise<Record<string, string>> {
  const abierto = diaAbierto(e, ahora);
  const claves = DIAS_RETO.filter((d) => d.n <= abierto).flatMap((d) => d.tareas.map((t) => claveTarea(d.n, t.id)))
    .filter((k) => !e.hechas[k] && LECTURAS[k]);
  const leidas = await Promise.all(claves.map(async (k) => [k, await LECTURAS[k](e).catch(() => null)] as const));
  return Object.fromEntries(leidas.filter(([, v]) => !!v)) as Record<string, string>;
}
