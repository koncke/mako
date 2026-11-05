// =============================================================================
// creem-moderacion-reglas — lo que decide la moderación de un prompt, sin red ni base (5/11/2026)
// =============================================================================
// Creem (la pasarela, merchant of record) exige a quien genera IMAGEN o VIDEO desde un prompt que cada prompt pase por su
// Moderation API antes de llegar al modelo (docs/relevo/nube-creem-revision.md, con las fuentes). Acá vive lo que decide;
// la red, la clave y el registro están en lib/creem-moderacion.ts (server-only), que arma las dependencias y llama a
// `moderarConDeps`. SIN `server-only` a propósito: lo prueba tests/creem-moderacion.test.ts EJECUTÁNDOLO con un fetch falso.
//
// EL CONTRATO, leído del SDK oficial (`creem` 1.13.0 en npm, generado de su OpenAPI, 5/11/2026), porque docs.creem.io no
// se pudo abrir desde la nube:
//   · POST {host}/v1/moderation/prompt, la clave en `x-api-key` (como el resto de la API de Creem: lib/creem-api.ts).
//   · Cuerpo: `{ prompt, external_id? }`.
//   · Respuesta: `{ id, object, prompt, external_id?, decision: 'allow' | 'deny' | 'flag', usage: { units } }`.
//   · Host de prueba aparte: una clave `creem_test_…` va a test-api.creem.io (en el host real da 401). El de prueba contesta
//     `allow` a todo, según quienes ya lo integraron: `flag` y `deny` se prueban con dobles.
//   · El endpoint figura como «experimental and may change»: por eso una respuesta que no entendemos es un ERROR, nunca un
//     «allow» adivinado.
//
// LAS DECISIONES DE MaKo (con su porqué):
//   · `deny` y `flag` FRENAN. `flag` es «no lo niega, pero lo mira de cerca»: generar igual es sumar marcas sobre la cuenta
//     de MaKo en Creem, y un rechazo de Creem es definitivo para la tienda. Frenar cuesta reescribir un pedido.
//   · SI CREEM NO CONTESTA (caída, 5xx, tiempo, 429), LA GENERACIÓN SIGUE: así lo pidió el encargo («si la moderación falla
//     por un error de Creem, no se cae la generación»). Queda anotado en cada caso, con su motivo.
//     ⚠️ Creem recomienda lo CONTRARIO en su guía (frenar si la moderación no contesta). Es una decisión de Martín y se
//     cambia en UNA línea: `SI_CREEM_NO_CONTESTA`. Está en el relevo.
//   · SIN CLAVE de la plataforma, o con la clave RECHAZADA (401/403), tampoco se frena (no es culpa de quien genera), pero
//     es NUESTRO: quien llama lo registra como error de la app para que se arregle, no como un bache del proveedor.
//   · Se modera el prompt FINAL, el que va al modelo, entero: moderar un recorte es moderar otra cosa.
//   · Para no pagar dos veces lo mismo: la decisión de un prompt se recuerda un rato por negocio (`DURA_RECUERDO_MS`). Un
//     reintento de la misma toma no vuelve a llamar.
// =============================================================================

export const CREEM_MODERACION = 'https://api.creem.io/v1/moderation/prompt';
export const CREEM_MODERACION_PRUEBA = 'https://test-api.creem.io/v1/moderation/prompt';

/** Cuánto se espera a Creem. Un generador espera minutos al modelo: 5 s de moderación no se notan, y más ya es una caída. */
export const ESPERA_MS = 5000;

/** Cuánto se recuerda la decisión sobre un mismo prompt de un mismo negocio. */
export const DURA_RECUERDO_MS = 30 * 60 * 1000;

/** Qué hace MaKo si Creem no contesta. Ver la cabecera: 'generar' es lo pedido; 'frenar', lo que recomienda Creem. */
export const SI_CREEM_NO_CONTESTA: 'generar' | 'frenar' = 'generar';

export type DecisionCreem = 'allow' | 'deny' | 'flag';

/**
 * Lo que pasó con un prompt:
 *   · `paso`: true = se puede generar.
 *   · `por`: de dónde sale el veredicto (lo lee quien registra la medición).
 */
export type Veredicto =
  | { paso: true; por: 'creem'; decision: 'allow'; id: string; unidades: number; ms: number; recordado?: boolean }
  | { paso: false; por: 'creem'; decision: 'deny' | 'flag'; id: string; unidades: number; ms: number; recordado?: boolean; texto: string }
  | { paso: boolean; por: 'sin_clave' | 'clave_rechazada' | 'creem_no_contesto'; motivo: string; ms: number; texto?: string }
  | { paso: true; por: 'vacio' };

/**
 * Lo que ve la persona cuando Creem frena su pedido. Dice qué pasó, de quién es la regla y qué hacer. Sin la categoría:
 * Creem no la devuelve, y adivinarla sería afirmar algo que no se midió.
 */
export const TEXTO_RECHAZO =
  'No puedo generar esto: el texto pide algo que la política de uso de MaKo no permite (hola-mako.com/aup). Cámbialo y vuelve a intentarlo. No se gastó nada.';

/** Lo que ve la persona si se decidió frenar cuando Creem no contesta (`SI_CREEM_NO_CONTESTA = 'frenar'`). */
export const TEXTO_SIN_MODERACION =
  'No pude revisar el pedido con Creem, que es quien procesa los pagos de MaKo y revisa lo que se genera. No es nada tuyo: vuelve a intentarlo en un minuto.';

/** La clave de prueba va al host de prueba; las claves no son intercambiables. */
export function urlDeModeracion(clave: string): string {
  return clave.startsWith('creem_test_') ? CREEM_MODERACION_PRUEBA : CREEM_MODERACION;
}

/** Lee la respuesta de Creem. null = no la entendemos (y eso es un error, no un «allow»). */
export function leerRespuesta(x: unknown): { id: string; decision: DecisionCreem; unidades: number } | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const d = o.decision;
  if (d !== 'allow' && d !== 'deny' && d !== 'flag') return null;
  const u = o.usage && typeof o.usage === 'object' ? Number((o.usage as Record<string, unknown>).units) : NaN;
  return { id: typeof o.id === 'string' ? o.id.slice(0, 80) : '', decision: d, unidades: Number.isFinite(u) && u >= 0 ? u : 0 };
}

/**
 * El `external_id` que viaja a Creem: el negocio, de dónde sale el pedido y un número al azar de la generación. Nada de
 * la persona (ni nombre ni email): Creem lo usa para relacionar llamadas, y con el negocio alcanza.
 */
export function externalId(ws: number | null, origen: string, azar: string): string {
  const o = origen.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'gen';
  return `mako_ws${ws ?? 0}:${o}:${azar.replace(/[^a-z0-9-]/gi, '').slice(0, 36)}`;
}

/** El texto que se manda: el prompt tal cual, sin espacios de las puntas. Nunca se recorta. */
export const promptAModerar = (p: unknown): string => (typeof p === 'string' ? p.trim() : '');

export type DepsModeracion = {
  /** La clave de Creem DE LA PLATAFORMA (MaKo es el vendedor en Creem). null = no hay. Puede tirar si la base no contesta. */
  clave: () => Promise<string | null>;
  fetch: typeof fetch;
  ahora: () => number;
  /** El recuerdo de decisiones (un Map en el server; en los tests, uno nuevo). */
  recuerdo: Map<string, { hasta: number; v: Veredicto }>;
  /** Una huella del prompt para la clave del recuerdo (sha256 en el server). */
  huella: (s: string) => string;
};

/**
 * Modera un prompt. NUNCA TIRA: todo lo que falla vuelve como un veredicto con su `por` y su `motivo`.
 * La medición (cuánto tardó, cuántas unidades, qué decidió) va en el veredicto: la anota quien llama.
 */
export async function moderarConDeps(
  prompt: string,
  ctx: { ws: number | null; origen: string; azar: string },
  deps: DepsModeracion,
): Promise<Veredicto> {
  const texto = promptAModerar(prompt);
  if (!texto) return { paso: true, por: 'vacio' };

  const llave = `${ctx.ws ?? 0}:${deps.huella(texto)}`;
  const t0 = deps.ahora();
  const guardado = deps.recuerdo.get(llave);
  if (guardado && guardado.hasta > t0) {
    const v = guardado.v;
    if (v.por === 'creem') return { ...v, recordado: true, ms: 0 };
  }
  if (guardado) deps.recuerdo.delete(llave);

  const frenaSiFalla = SI_CREEM_NO_CONTESTA === 'frenar';
  const sinCreem = (por: 'sin_clave' | 'clave_rechazada' | 'creem_no_contesto', motivo: string): Veredicto => {
    // Lo que es NUESTRO (sin clave, clave rechazada) nunca frena a quien genera. Lo de Creem, según la decisión de arriba.
    const frena = por === 'creem_no_contesto' && frenaSiFalla;
    return frena
      ? { paso: false, por, motivo, ms: deps.ahora() - t0, texto: TEXTO_SIN_MODERACION }
      : { paso: true, por, motivo, ms: deps.ahora() - t0 };
  };

  let clave: string | null;
  try {
    clave = await deps.clave();
  } catch (e) {
    return sinCreem('sin_clave', `no pude leer la clave: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
  }
  if (!clave) return sinCreem('sin_clave', 'la plataforma no tiene CREEM_API_KEY');

  let res: Response;
  try {
    res = await deps.fetch(urlDeModeracion(clave), {
      method: 'POST',
      headers: { 'x-api-key': clave, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: texto, external_id: externalId(ctx.ws, ctx.origen, ctx.azar) }),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch (e) {
    const tiempo = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return sinCreem('creem_no_contesto', tiempo ? `sin respuesta en ${ESPERA_MS / 1000} s` : 'la red no llegó a Creem');
  }

  // El cuerpo de un error NO se copia al motivo: puede repetir el prompt (que es de un cliente) y no hace falta para saber
  // qué pasó. El estado alcanza.
  if (res.status === 401 || res.status === 403) return sinCreem('clave_rechazada', `Creem rechazó la clave (HTTP ${res.status})`);
  if (!res.ok) return sinCreem('creem_no_contesto', `HTTP ${res.status}`);

  let json: unknown;
  try { json = await res.json(); } catch { json = null; }
  const r = leerRespuesta(json);
  if (!r) return sinCreem('creem_no_contesto', 'respuesta que no entiendo (sin decision)');

  const ms = deps.ahora() - t0;
  const v: Veredicto = r.decision === 'allow'
    ? { paso: true, por: 'creem', decision: 'allow', id: r.id, unidades: r.unidades, ms }
    : { paso: false, por: 'creem', decision: r.decision, id: r.id, unidades: r.unidades, ms, texto: TEXTO_RECHAZO };
  deps.recuerdo.set(llave, { hasta: deps.ahora() + DURA_RECUERDO_MS, v });
  // Un tope al recuerdo: un proceso que vive días no junta prompts para siempre.
  if (deps.recuerdo.size > 2000) {
    const ahora = deps.ahora();
    for (const [k, g] of deps.recuerdo) if (g.hasta <= ahora || deps.recuerdo.size > 1500) deps.recuerdo.delete(k);
  }
  return v;
}

/** El renglón que deja cada veredicto en el registro de uso (sin el prompt: es de un cliente). */
export function motivoDeMedicion(v: Veredicto, ctx: { ws: number | null; origen: string }): string {
  const donde = `ws ${ctx.ws ?? '?'} · ${ctx.origen}`;
  if (v.por === 'vacio') return `${donde} · sin prompt`;
  if (v.por === 'creem') {
    return `${donde} · ${v.decision}${v.recordado ? ' (recordada, sin llamar)' : ''} · ${v.unidades} unidad${v.unidades === 1 ? '' : 'es'} · ${v.ms} ms`;
  }
  return `${donde} · sin moderar (${v.por}: ${v.motivo}) · ${v.paso ? 'se generó igual' : 'se frenó'} · ${v.ms} ms`;
}
