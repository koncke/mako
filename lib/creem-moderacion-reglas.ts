// =============================================================================
// creem-moderacion-reglas — lo que decide la moderación de un prompt, sin red ni base (5/11/2026)
// =============================================================================
// ⚠️ DESDE EL 5/11/2026 A LA NOCHE NO HAY PROVEEDOR, Y NO SE LLAMA A NADIE. La moderación nació esa tarde porque Creem (la
// pasarela, merchant of record) la exige a quien genera IMAGEN o VIDEO desde un prompt (docs/relevo/nube-creem-revision.md).
// Creem rechazó la tienda de MaKo a las pocas horas, de forma definitiva (docs/creem-retiros.md): la plataforma ya no tiene
// su clave y Creem no reabre la cuenta. Por eso `PROVEEDOR_DE_MODERACION` vale `null`: la moderación NO CORRE, en silencio,
// y se genera. No se lee ninguna clave, no sale ningún pedido, no queda ninguna fila de uso y no se abre ningún ticket.
//
// EL NOMBRE DEL ARCHIVO es de cuando moderaba Creem. Se queda porque lo nombran AGENTS.md («Lo que genera imagen o video
// pasa por `encolar`») y la bitácora del área: mudarlo deja esos punteros apuntando a la nada. Lo de adentro ya no es de
// Creem: es un MOTOR que sirve a cualquier proveedor.
//
// CÓMO SE ENCHUFA OTRO PROVEEDOR, el día que haya uno (lo decide Martín: la próxima pasarela puede pedir su propia
// moderación, o ninguna):
//   1. Se escribe su `ProveedorModeracion`: el nombre, la credencial de la PLATAFORMA, cómo se arma el pedido y cómo se lee
//      la respuesta. El molde es `CREEM`, más abajo, leído del SDK oficial (`creem` 1.13.0 en npm, 5/11/2026).
//   2. `PROVEEDOR_DE_MODERACION = ESE`. Desde ahí `encolar` (lib/flow-cola.ts) frena lo que niega o marca.
//   3. Las legales vuelven a decir quién revisa el pedido: /terminos (sección 6), /aup (sección 6) y /privacidad (la lista
//      de con quién se comparte). Hoy no lo dicen porque no pasa: tests/creem-revision-sitio.test.ts lo fija.
//   ⚠️ NUNCA `CREEM`: Creem cerró la cuenta de MaKo y no la reabre (§20.6 de sus términos). tests/creem-moderacion.test.ts
//   da rojo si alguien lo vuelve a poner.
//
// LAS DECISIONES DEL MOTOR (con su porqué), que valen para cualquier proveedor:
//   · `deny` y `flag` FRENAN. `flag` es «no lo niega, pero lo mira de cerca»: generar igual es sumar marcas sobre la cuenta
//     de MaKo en el proveedor, y con Creem un rechazo fue definitivo para la tienda. Frenar cuesta reescribir un pedido.
//   · SI EL PROVEEDOR NO CONTESTA (caída, 5xx, tiempo, 429), LA GENERACIÓN SIGUE (lo pidió el encargo del 5/11: «si la
//     moderación falla por un error de Creem, no se cae la generación»). Se cambia en UNA línea: `SI_NO_CONTESTA`.
//   · SIN PROVEEDOR o SIN CLAVE de la plataforma, se genera EN SILENCIO: no es culpa de quien genera, y que falte la clave
//     de un proveedor que no existe no es un bug. Con la clave RECHAZADA (401/403) también se genera, pero eso SÍ es nuestro
//     (hay un proveedor elegido y su clave no anda): quien llama lo registra como error de la app.
//   · Se modera el prompt FINAL, el que va al modelo, entero: moderar un recorte es moderar otra cosa.
//   · Una respuesta que no se entiende es un ERROR, nunca un «allow» adivinado.
//   · Para no pagar dos veces lo mismo: la decisión de un prompt se recuerda un rato por proveedor y por negocio
//     (`DURA_RECUERDO_MS`). Un reintento de la misma toma no vuelve a llamar.
// SIN `server-only` a propósito: lo prueba tests/creem-moderacion.test.ts EJECUTÁNDOLO con un fetch falso. La red, la
// clave y el registro están en lib/creem-moderacion.ts (server-only), que arma las dependencias y llama a `moderarConDeps`.
// =============================================================================

/** Cuánto se espera al proveedor. Un generador espera minutos al modelo: 5 s de moderación no se notan, y más ya es una caída. */
export const ESPERA_MS = 5000;

/** Cuánto se recuerda la decisión sobre un mismo prompt de un mismo negocio. */
export const DURA_RECUERDO_MS = 30 * 60 * 1000;

/** Qué hace MaKo si el proveedor no contesta. Ver la cabecera: 'generar' es lo pedido; 'frenar', lo que recomendaba Creem. */
export const SI_NO_CONTESTA: 'generar' | 'frenar' = 'generar';

export type DecisionModeracion = 'allow' | 'deny' | 'flag';

/** Un proveedor de moderación: lo único que el motor no sabe de antemano. */
export type ProveedorModeracion = {
  /** Cómo se llama en la medición y en los logs ('creem', …). */
  nombre: string;
  /** La credencial de la PLATAFORMA: quien modera lo que generan los usuarios es MaKo, nunca el negocio. */
  credencial: string;
  /** El pedido HTTP para un texto. La clave va acá adentro y no sale de acá. */
  pedido: (p: { texto: string; clave: string; externalId: string }) => { url: string; init: RequestInit };
  /** La respuesta. null = no la entiendo (y eso es un error, no un «allow»). */
  leer: (json: unknown) => { id: string; decision: DecisionModeracion; unidades: number } | null;
};

// ── El adaptador de Creem: el MOLDE, no se usa ──────────────────────────────
// El contrato, leído del SDK oficial (`creem` 1.13.0 en npm, generado de su OpenAPI, 5/11/2026), porque docs.creem.io no se
// pudo abrir desde la nube:
//   · POST {host}/v1/moderation/prompt, la clave en `x-api-key` (como el resto de la API de Creem: lib/creem-api.ts).
//   · Cuerpo: `{ prompt, external_id? }`.
//   · Respuesta: `{ id, object, prompt, external_id?, decision: 'allow' | 'deny' | 'flag', usage: { units } }`.
//   · Host de prueba aparte: una clave `creem_test_…` va a test-api.creem.io (en el host real da 401).

export const CREEM_MODERACION = 'https://api.creem.io/v1/moderation/prompt';
export const CREEM_MODERACION_PRUEBA = 'https://test-api.creem.io/v1/moderation/prompt';

/** La clave de prueba de Creem va al host de prueba; las claves no son intercambiables. */
export function urlDeModeracion(clave: string): string {
  return clave.startsWith('creem_test_') ? CREEM_MODERACION_PRUEBA : CREEM_MODERACION;
}

/** Lee la respuesta de Creem. null = no la entendemos (y eso es un error, no un «allow»). */
export function leerRespuesta(x: unknown): { id: string; decision: DecisionModeracion; unidades: number } | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const d = o.decision;
  if (d !== 'allow' && d !== 'deny' && d !== 'flag') return null;
  const u = o.usage && typeof o.usage === 'object' ? Number((o.usage as Record<string, unknown>).units) : NaN;
  return { id: typeof o.id === 'string' ? o.id.slice(0, 80) : '', decision: d, unidades: Number.isFinite(u) && u >= 0 ? u : 0 };
}

export const CREEM: ProveedorModeracion = {
  nombre: 'creem',
  credencial: 'CREEM_API_KEY',
  pedido: ({ texto, clave, externalId }) => ({
    url: urlDeModeracion(clave),
    init: {
      method: 'POST',
      headers: { 'x-api-key': clave, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: texto, external_id: externalId }),
    },
  }),
  leer: leerRespuesta,
};

/**
 * EL PROVEEDOR QUE MODERA HOY: ninguno (5/11/2026, Creem cerró la tienda de MaKo). Con `null`, `moderarConDeps` contesta
 * `sin_proveedor` antes de leer una clave o de llamar a nadie, y se genera. Ver «Cómo se enchufa otro proveedor», arriba.
 */
export const PROVEEDOR_DE_MODERACION: ProveedorModeracion | null = null;

/**
 * Lo que pasó con un prompt:
 *   · `paso`: true = se puede generar.
 *   · `por`: de dónde sale el veredicto (lo lee quien registra la medición).
 */
export type Veredicto =
  | { paso: true; por: 'proveedor'; proveedor: string; decision: 'allow'; id: string; unidades: number; ms: number; recordado?: boolean }
  | { paso: false; por: 'proveedor'; proveedor: string; decision: 'deny' | 'flag'; id: string; unidades: number; ms: number; recordado?: boolean; texto: string }
  | { paso: boolean; por: 'sin_clave' | 'clave_rechazada' | 'no_contesto'; proveedor: string; motivo: string; ms: number; texto?: string }
  | { paso: true; por: 'vacio' }
  | { paso: true; por: 'sin_proveedor' };

/**
 * Lo que ve la persona cuando la moderación frena su pedido. Dice qué pasó, de quién es la regla y qué hacer. Sin la
 * categoría: un proveedor no siempre la devuelve, y adivinarla sería afirmar algo que no se midió.
 */
export const TEXTO_RECHAZO =
  'No puedo generar esto: el texto pide algo que la política de uso de MaKo no permite (hola-mako.com/aup). Cámbialo y vuelve a intentarlo. No se gastó nada.';

/** Lo que ve la persona si se decidió frenar cuando el proveedor no contesta (`SI_NO_CONTESTA = 'frenar'`). */
export const TEXTO_SIN_MODERACION =
  'No pude revisar el pedido antes de generarlo. No es nada tuyo: vuelve a intentarlo en un minuto.';

/**
 * El `external_id` que viaja al proveedor: el negocio, de dónde sale el pedido y un número al azar de la generación. Nada
 * de la persona (ni nombre ni email): sirve para relacionar llamadas, y con el negocio alcanza.
 */
export function externalId(ws: number | null, origen: string, azar: string): string {
  const o = origen.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'gen';
  return `mako_ws${ws ?? 0}:${o}:${azar.replace(/[^a-z0-9-]/gi, '').slice(0, 36)}`;
}

/** El texto que se manda: el prompt tal cual, sin espacios de las puntas. Nunca se recorta. */
export const promptAModerar = (p: unknown): string => (typeof p === 'string' ? p.trim() : '');

export type DepsModeracion = {
  /** Quién modera. null = nadie: no se lee la clave ni se llama (`PROVEEDOR_DE_MODERACION` en el server). */
  proveedor: ProveedorModeracion | null;
  /** La clave DE LA PLATAFORMA para esa credencial. null = no hay. Puede tirar si la base no contesta. */
  clave: (credencial: string) => Promise<string | null>;
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
  // Sin proveedor, lo primero y sin tocar nada: ni la clave, ni la red, ni el recuerdo.
  if (!deps.proveedor) return { paso: true, por: 'sin_proveedor' };
  const prov: ProveedorModeracion = deps.proveedor;
  const texto = promptAModerar(prompt);
  if (!texto) return { paso: true, por: 'vacio' };

  // El proveedor va en la clave: una decisión de uno no vale para otro. Y el ws también: una caché del server es de todos
  // los inquilinos.
  const llave = `${prov.nombre}:${ctx.ws ?? 0}:${deps.huella(texto)}`;
  const t0 = deps.ahora();
  const guardado = deps.recuerdo.get(llave);
  if (guardado && guardado.hasta > t0) {
    const v = guardado.v;
    if (v.por === 'proveedor') return { ...v, recordado: true, ms: 0 };
  }
  if (guardado) deps.recuerdo.delete(llave);

  const frenaSiFalla = SI_NO_CONTESTA === 'frenar';
  const sinModerar = (por: 'sin_clave' | 'clave_rechazada' | 'no_contesto', motivo: string): Veredicto => {
    // Lo que es NUESTRO (sin clave, clave rechazada) nunca frena a quien genera. Lo del proveedor, según la decisión de arriba.
    const frena = por === 'no_contesto' && frenaSiFalla;
    return frena
      ? { paso: false, por, proveedor: prov.nombre, motivo, ms: deps.ahora() - t0, texto: TEXTO_SIN_MODERACION }
      : { paso: true, por, proveedor: prov.nombre, motivo, ms: deps.ahora() - t0 };
  };

  let clave: string | null;
  try {
    clave = await deps.clave(prov.credencial);
  } catch (e) {
    return sinModerar('sin_clave', `no pude leer la clave: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
  }
  if (!clave) return sinModerar('sin_clave', `la plataforma no tiene ${prov.credencial}`);

  let res: Response;
  try {
    const { url, init } = prov.pedido({ texto, clave, externalId: externalId(ctx.ws, ctx.origen, ctx.azar) });
    res = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (e) {
    const tiempo = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return sinModerar('no_contesto', tiempo ? `sin respuesta en ${ESPERA_MS / 1000} s` : `la red no llegó a ${prov.nombre}`);
  }

  // El cuerpo de un error NO se copia al motivo: puede repetir el prompt (que es de un cliente) y no hace falta para saber
  // qué pasó. El estado alcanza.
  if (res.status === 401 || res.status === 403) return sinModerar('clave_rechazada', `${prov.nombre} rechazó la clave (HTTP ${res.status})`);
  if (!res.ok) return sinModerar('no_contesto', `HTTP ${res.status}`);

  let json: unknown;
  try { json = await res.json(); } catch { json = null; }
  const r = prov.leer(json);
  if (!r) return sinModerar('no_contesto', 'respuesta que no entiendo (sin decision)');

  const ms = deps.ahora() - t0;
  const v: Veredicto = r.decision === 'allow'
    ? { paso: true, por: 'proveedor', proveedor: prov.nombre, decision: 'allow', id: r.id, unidades: r.unidades, ms }
    : { paso: false, por: 'proveedor', proveedor: prov.nombre, decision: r.decision, id: r.id, unidades: r.unidades, ms, texto: TEXTO_RECHAZO };
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
  if (v.por === 'sin_proveedor') return `${donde} · sin moderar (no hay proveedor) · se generó`;
  if (v.por === 'proveedor') {
    return `${donde} · ${v.proveedor} · ${v.decision}${v.recordado ? ' (recordada, sin llamar)' : ''} · ${v.unidades} unidad${v.unidades === 1 ? '' : 'es'} · ${v.ms} ms`;
  }
  return `${donde} · ${v.proveedor} · sin moderar (${v.por}: ${v.motivo}) · ${v.paso ? 'se generó igual' : 'se frenó'} · ${v.ms} ms`;
}
