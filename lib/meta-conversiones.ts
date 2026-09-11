// =============================================================================
// meta-conversiones — qué MIDE de verdad una conversión, y cuándo falta la agenda
// =============================================================================
// Puro (sin server-only): lo usan lib/meta-ads-create.ts, el paso de conversión del
// wizard y lib/venta-por-llamada.ts, y se prueba en node:test.
//
// Existe por lo que vio Martín el 2026-09-11 en Código Inmobiliario (ws13). El
// desplegable de conversiones ofrecía «Tu conversión: AGENDA — Conversión que ya
// mides». Ese «que ya mides» era un TEXTO FIJO pegado a toda conversión
// personalizada de la cuenta; nadie lo había medido nunca (el comentario del código
// decía «tus conversiones personalizadas, que ya son activas»). Y lo que AGENDA
// cuenta, leído de Meta, no es el evento de agenda:
//
//   rule: {"and":[{"event":{"eq":"PageView"}},{"or":[{"URL":{"i_contains":"/gracias"}},
//          {"URL":{"i_contains":"name"}},{"URL":{"i_contains":"email"}}]}]}
//   custom_event_type: SCHEDULE · 17 disparos en 30 días, 16 el 25/08 (el día que se armó)
//
// O sea: visitas a una URL con «/gracias», «name» o «email», clasificadas como
// agenda. Y el pixel, en esos mismos 30 días, no recibió NI UN evento `Schedule`
// (PageView 152, CompleteRegistration 15, «agendar llamada 1 arriba» 20, Lead 2).
// Un negocio que vende por llamada con ese pixel no le puede pedir a Meta que busque
// gente que agende: Meta no tiene con qué saber quién agendó.
// =============================================================================

export type EstadoConversion = 'activa' | 'inactiva' | 'nunca';

/** La misma ventana que usa listPixelEvents para decir «activo en tu pixel». */
export const VENTANA_DIAS = 30;

/** "a" · "a y b" · "a, b y c". */
export function unir(xs: string[], conj = 'y'): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} ${conj} ${xs[xs.length - 1]}`;
}

/**
 * ¿Se disparó en los últimos 30 días? Sale de `last_fired_time`, que Meta manda como
 * "2026-09-11T19:29:01+0000" (sin los dos puntos del huso: se normaliza antes).
 */
export function estadoConversion(lastFired: string | null | undefined, ahora: Date = new Date()): EstadoConversion {
  if (!lastFired) return 'nunca';
  const t = Date.parse(String(lastFired).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  if (!Number.isFinite(t)) return 'nunca';
  return ahora.getTime() - t <= VENTANA_DIAS * 86_400_000 ? 'activa' : 'inactiva';
}

// Operadores de las reglas de Meta que sabemos decir en castellano. Uno que no esté
// acá hace que la regla NO se describa: una traducción a medias afirma algo que la
// regla no dice, y es peor que admitir «regla propia de tu cuenta».
const OPS: Record<string, string> = {
  eq: 'es', i_eq: 'es',
  contains: 'contiene', i_contains: 'contiene',
  not_contains: 'no contiene', i_not_contains: 'no contiene',
  starts_with: 'empieza con', i_starts_with: 'empieza con',
  ends_with: 'termina con', i_ends_with: 'termina con',
  regex_match: 'cumple el patrón',
};

type Cond = { campo: 'evento' | 'url'; op: string; valor: string; grupo: 'and' | 'or' };

function recoger(n: unknown, grupo: 'and' | 'or', out: { conds: Cond[]; raro: boolean }): void {
  if (!n || typeof n !== 'object') { out.raro = true; return; }
  if (Array.isArray(n)) { for (const x of n) recoger(x, grupo, out); return; }
  for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
    const kl = k.toLowerCase();
    if (kl === 'and' || kl === 'or') { recoger(v, kl, out); continue; }
    if (kl === 'event' || kl === 'url') {
      const ops = v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : [];
      if (!ops.length) { out.raro = true; continue; }
      for (const [op, val] of ops) {
        if (!OPS[op] || (typeof val !== 'string' && typeof val !== 'number')) { out.raro = true; continue; }
        out.conds.push({ campo: kl === 'event' ? 'evento' : 'url', op, valor: String(val), grupo });
      }
      continue;
    }
    // Cualquier otro campo (value, content_ids, parámetros propios): no se adivina.
    out.raro = true;
  }
}

/**
 * La regla de una conversión personalizada, dicha como lo que cuenta:
 * «Visitas a una URL que contiene «/gracias», «name» o «email»». null si la regla
 * tiene algo que no sabemos traducir — la pantalla dice entonces «regla propia».
 */
export function describirRegla(regla: string | null | undefined): string | null {
  if (!regla) return null;
  let raiz: unknown;
  try { raiz = JSON.parse(regla); } catch { return null; }
  const out = { conds: [] as Cond[], raro: false };
  recoger(raiz, 'and', out);
  if (out.raro || !out.conds.length) return null;
  const eventos = out.conds.filter((c) => c.campo === 'evento');
  const urls = out.conds.filter((c) => c.campo === 'url');
  if (eventos.some((e) => OPS[e.op] !== 'es') || new Set(eventos.map((e) => e.valor)).size > 1) return null;
  const evento = eventos[0]?.valor ?? null;
  let fraseUrl: string | null = null;
  if (urls.length) {
    const conj = urls.every((u) => u.grupo === 'or') ? 'o' : 'y';
    const porOp = new Map<string, string[]>();
    for (const u of urls) porOp.set(OPS[u.op], [...(porOp.get(OPS[u.op]) ?? []), `«${u.valor}»`]);
    fraseUrl = [...porOp.entries()].map(([op, vals]) => `${op} ${unir(vals, conj)}`).join(` ${conj} `);
  }
  // Una regla sólo de URL, o de PageView + URL, cuenta VISITAS a una página.
  if (!evento || evento === 'PageView') return fraseUrl ? `Visitas a una URL que ${fraseUrl}` : 'Cada visita a cualquier página';
  return fraseUrl ? `Cada evento «${evento}» en una URL que ${fraseUrl}` : `Cada evento «${evento}»`;
}

/**
 * Por qué MaKo cree que este negocio vende por LLAMADA AGENDADA. Cada motivo es un
 * hecho que se puede verificar —algo que el dueño declaró o que se midió en su
 * landing—, porque el aviso los cita: nunca se afirma «tu negocio vende por
 * llamada» sin decir de dónde sale. Vacío = no hay con qué afirmarlo, y no se avisa.
 */
export function motivosVentaPorLlamada(s: {
  canal: string | null | undefined;
  entradas: readonly string[];
  snapshots: Record<string, { piezas: readonly string[] }>;
}): string[] {
  const m: string[] = [];
  if (s.canal === 'llamadas') m.push('declaraste que vendes por llamada');
  if (s.entradas.includes('agenda_sola')) m.push('tu funnel dice que agendan solos desde un link');
  const hosts = Object.entries(s.snapshots)
    .filter(([, snap]) => snap.piezas.includes('embed-agenda'))
    .map(([url]) => { try { return new URL(url).host; } catch { return url; } });
  if (hosts.length === 1) m.push(`tu landing ${hosts[0]} tiene una agenda para reservar`);
  else if (hosts.length > 1) m.push(`tus landings ${unir(hosts)} tienen una agenda para reservar`);
  return m;
}

/**
 * El aviso de Martín: si el negocio vende por llamada y el pixel no mide la agenda,
 * es un ERROR, y hay que decirlo con todas las letras.
 *
 * Tres salidas en falso que NO avisan, a propósito:
 *   · sin motivos → no hay con qué decir que vende por llamada;
 *   · `eventosPixel` vacío o null → listPixelEvents devuelve [] también cuando NO
 *     PUDO leer las estadísticas, y «no pude preguntar» no autoriza a afirmar que
 *     falta un evento;
 *   · `Schedule` presente → lo está midiendo.
 */
export function avisoAgendaSinMedir(motivos: string[], eventosPixel: readonly string[] | null): { titulo: string; detalle: string } | null {
  if (!motivos.length) return null;
  if (!eventosPixel || !eventosPixel.length) return null;
  if (eventosPixel.includes('Schedule')) return null;
  return {
    titulo: 'Tu pixel no está midiendo las agendas',
    detalle: `Es un error: ${unir(motivos)}, pero tu pixel no recibió ningún evento «Schedule» (agendar) en los últimos ${VENTANA_DIAS} días. Sin ese evento, Meta no sabe quién agendó: no puede buscar gente que agende y nunca te va a traer llamadas. Instálalo en tu pixel en el momento en que alguien reserva. Si lo acabas de instalar, este aviso se va cuando Meta registre la primera agenda.`,
  };
}
