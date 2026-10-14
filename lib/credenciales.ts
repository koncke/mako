// =============================================================================
// credenciales — tokens de integraciones POR WORKSPACE (tablas 0053/0054/0055)
// =============================================================================
// Cada cliente (workspace) guarda sus propios tokens de Meta/Calendly/etc.,
// cifrados AES-256-GCM. El resolver `credWs(clave)` devuelve el token del
// workspace del request.
//
// LA BASE MANDA (para todos, dueño incluido): todo se configura DESDE LA APP.
// El env del server queda solo como RESPALDO DE ARRANQUE del dueño, para el
// hueco entre el deploy y la primera corrida de `migrarEnvACredenciales()`, que
// copia sus credenciales del entorno a la base cifrada. Una vez migradas, el
// dueño puede borrarlas del entorno y gestionarlas desde la app como cualquier
// otro cliente. Los clientes NUNCA leen process.env: sus tokens salen solo de su
// fila en la tabla (aislamiento estricto).
//
// Cifrado: AES-256-GCM con clave derivada por (workspace, clave) desde
// CREDENCIALES_SECRET — ver lib/cripto-credenciales.ts. Si el secreto rota, lo
// guardado queda ilegible y la UI lo marca para re-pegar.

import 'server-only';
// El cifrado vive en su propio módulo (sin server-only ni Next) para que se pueda
// testear suelto: scripts/test-cripto.mjs. Es el código más caro de equivocar.
import { cifrar, descifrar, versionCripto } from './cripto-credenciales';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';
import { ENVS_METODO, servicioDeEnv, servicioMetodo } from './metodo-catalogo';
import { ROUTING_CREDS, upsertRouting, borrarRoutingDeWs } from './webhook-routing';
import { identificadorDeRuteo } from './ruteo-hash';
import { esClaveDeCuenta } from './ia-keys';
import { problemaDeRemitenteGuardado } from './email-remitente';

export type CredencialMeta = {
  clave: string;
  servicio: string;
  mask: string;
  updated_by: string | null;
  updated_at: string;
  legible: boolean;
};

export type EstadoCampo = {
  configurado: boolean;
  /** De dónde sale HOY el valor: 'panel' = fila cifrada en la base (lo normal);
   *  'servidor' = respaldo del entorno del dueño, todavía sin migrar a la base.
   *  Es informativo — 'servidor' NO implica read-only: guardar siempre pisa. */
  origen: 'servidor' | 'panel' | null;
  mask: string;
  /** guardado pero ilegible (rotó el secret de cifrado) → re-pegar. */
  ilegible: boolean;
};

// Set de claves del dueño hidratadas a process.env (solo ws1). Sobrevive HMR.
const g = globalThis as typeof globalThis & { __makoCredsHidratadas?: Set<string> };
const hidratadas = (g.__makoCredsHidratadas ??= new Set<string>());

/**
 * Deja constancia de quién tocó qué llave, EN LA BASE (migración 0091) y no en
 * un log de la plataforma: un rastro que solo puede leer la agencia no le sirve
 * de nada al cliente para auditar su propio espacio.
 *
 * Nunca guarda el valor. Best-effort: si la auditoría falla no se rompe la
 * operación, pero SÍ queda el console.error — perder el rastro es un incidente.
 */
export async function auditarCredencial(
  ws: number,
  clave: string,
  accion: 'revelar' | 'guardar' | 'borrar',
  autor: string | null,
  opts: { permitido?: boolean; motivo?: string } = {},
): Promise<void> {
  const permitido = opts.permitido ?? true;
  // Se loguea igual: durante el deploy de la migración la tabla puede no existir.
  console.warn(`[credenciales] ${autor ?? 'desconocido'} · ${accion} ${clave} · ws ${ws} · ${permitido ? 'ok' : 'RECHAZADO'}${opts.motivo ? ` (${opts.motivo})` : ''}`);
  if (!supabaseConfigurado()) return;
  try {
    const { error } = await getSupabaseServer()
      .from('credenciales_auditoria')
      .insert({ workspace_id: ws, clave, accion, permitido, autor, motivo: opts.motivo ?? null });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('[credenciales] no se pudo auditar (¿falta la migración 0091?):', e instanceof Error ? e.message : e);
  }
}

/**
 * Cifrado de secretos que NO viven en la tabla `credenciales` pero merecen el
 * mismo trato: hoy el refresh_token de Google Calendar, que va en app_settings
 * (lib/google-calendar.ts). Exportados a propósito para que no exista la excusa
 * de guardar un token en claro "porque está en otra tabla".
 * El (ws, clave) tiene que ser el MISMO al guardar y al leer: en v2 es parte de
 * la clave derivada y del AAD.
 */
export function cifrarSecreto(valor: string, ws: number, clave: string): string {
  return cifrar(valor, ws, clave);
}
export function descifrarSecreto(valorEnc: string, ws: number, clave: string): string | null {
  // Compat: lo guardado ANTES de que esto se cifrara quedó en claro. Sin prefijo
  // conocido → es un valor viejo y se devuelve tal cual, en vez de romperle la
  // integración a quien ya la tenía conectada.
  const v = versionCripto(valorEnc);
  return v === 'otro' ? valorEnc : descifrar(valorEnc, ws, clave);
}

const supabaseConfigurado = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Valor de env "real": presente y no un placeholder 'PENDING…' (convención del repo).
const esValorReal = (v: string | undefined | null): v is string =>
  Boolean(v && v.trim() && !v.trim().startsWith('PENDING'));

async function wsDefault(ws?: number): Promise<number> {
  return ws ?? (await getWorkspaceActual()) ?? OWNER_WS;
}

// Lee (y descifra) UNA credencial de un workspace de la base. null si no está.
async function credDeBase(ws: number, clave: string): Promise<string | null> {
  if (!supabaseConfigurado()) return null;
  const { data } = await getSupabaseServer()
    .from('credenciales').select('valor_enc').eq('workspace_id', ws).eq('clave', clave).maybeSingle();
  return data ? descifrar(data.valor_enc as string, ws, clave) : null;
}

/**
 * Igual que `credWs` para un `ws` explícito, pero «NO PUDE LEER» NO ES «NO ESTÁ»: si la lectura
 * de la base falla, TIRA.
 *
 * ⚠️ `credDeBase` no lee el `error` de supabase-js, así que una base caída le devuelve null a
 * `credWs`, y null es un valor que decide: en el webhook de Calendly, sin el tipo de evento de
 * la R2, una reunión R2 se graba como R1 (medido el 06/10/2026). Es una función APARTE porque
 * `credWs` la usa medio producto y que empiece a tirar le cambiaría el comportamiento a todos.
 * El error lleva `code`, `details` y `hint` del original, que es lo que lee el clasificador de
 * lib/calendly-error.ts.
 */
export async function credWsEstricta(clave: string, ws: number): Promise<string | null> {
  if (supabaseConfigurado()) {
    const { data, error } = await getSupabaseServer()
      .from('credenciales').select('valor_enc').eq('workspace_id', ws).eq('clave', clave).maybeSingle();
    if (error) {
      throw Object.assign(new Error(`credenciales (${clave}): ${error.message}`), {
        code: error.code, details: error.details, hint: error.hint,
      });
    }
    const v = data ? descifrar(data.valor_enc as string, ws, clave) : null;
    if (esValorReal(v)) return v;
  }
  if (ws === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]!;
  return null;
}

/**
 * Token efectivo de una clave para el workspace del request (o `ws` explícito).
 * La BASE manda; para el dueño el env queda como respaldo de arranque (hasta que
 * `migrarEnvACredenciales()` lo copie a la base). Cliente → solo su fila cifrada.
 * Es el resolver que usan las libs de integración.
 */
export async function credWs(clave: string, ws?: number): Promise<string | null> {
  const w = await wsDefault(ws);
  const v = await credDeBase(w, clave);
  if (esValorReal(v)) return v;
  if (w === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]!;
  return null;
}

/**
 * La credencial PROPIA de un workspace. Nunca la de la plataforma.
 *
 * ⚠️ ES `credWs` SIN SU ÚLTIMA LÍNEA, Y ESA LÍNEA ES TODO EL PUNTO. `credWs`
 * cae a `process.env[clave]` cuando el workspace es `OWNER_WS` — que es
 * MAURICIO, un cliente. Para una credencial BYOK eso significa entregarle la
 * cuenta de la plataforma a un cliente y facturársela a MaKo, sin que falle:
 * funciona, y por eso nadie lo mira.
 *
 * Va acá y no en cada lib para que sea UN choke point: la pregunta «¿esta
 * credencial es del cliente o de la casa?» se contesta eligiendo función, y no
 * acordándose de pasar un segundo argumento.
 *
 * `null` cuando el cliente no cargó la suya, que es un estado legítimo: la
 * feature se apaga y la pantalla lo dice.
 */
export async function credDelCliente(clave: string, ws?: number): Promise<string | null> {
  const w = await wsDefault(ws);
  const v = await credDeBase(w, clave);
  return esValorReal(v) ? v : null;
}
// ── La barrera de arranque y el resolver de credenciales de PLATAFORMA ───────
// Problema que resuelven (medido en producción el 2026-08-05):
// `hidratarCredenciales()` corre en instrumentation.ts, pero Next 16 invoca
// `ensureInstrumentationRegistered(...)` SIN await dentro de prepare()
// (node_modules/next/dist/server/route-modules/route-module.js:356, y así queda en
// el runtime compilado que despliega Vercel). En el servidor largo da igual porque
// base-server ya lo esperó; en el despliegue POR FUNCIÓN de Vercel no, y el request
// puede entrar mientras la hidratación todavía va por la mitad.
//
// Medición: 3 de cada 10 requests al webhook de Calendly caían en una instancia sin
// la clave y devolvían 401. Y el cron de transcripción envenenó 9 anuncios (quedaron
// marcados como hechos, con transcript null, para siempre) por lo mismo.
//
// Dos mecanismos distintos, dos remedios:
//   · La CARRERA (la hidratación no terminó) → la barrera: esperás en vez de fallar.
//   · El TIMEOUT/catch silencioso (la hidratación terminó pero sin traer nada) → el
//     fallback a la base, que además se auto-repara.
// Una vez que la hidratación del boot terminó, `credencialesListas()` devuelve una
// promesa ya resuelta y no agrega latencia.
//
// La memo va en globalThis y NO en una variable de módulo, por el mismo motivo que
// `hidratadas` unas líneas más arriba: Turbopack emite una COPIA de este módulo por
// capa (instrumentation, app-route, ssr) y el cache deduplica por module id, así que
// una variable de módulo daría una memo por capa. Con eso, el primer `envCred()` de
// un route handler arrancaría una SEGUNDA hidratación completa (SELECT con timeout de
// 4s + seedRoutingDelDueno + migrarEnvACredenciales) adentro del request — justo el
// trabajo que la barrera venía a evitar.
const gBoot = globalThis as typeof globalThis & { __makoBootCreds?: Promise<void> };

/**
 * Espera a que la hidratación del boot haya terminado (una sola vez por proceso).
 * La llama instrumentation.ts y la esperan los lectores de credenciales de plataforma.
 * Nunca rechaza: `hidratarCredenciales` ya traga sus propios errores, y un rechazo acá
 * quedaría cacheado en la promesa y explotaría en CADA request.
 */
export function credencialesListas(): Promise<void> {
  return (gBoot.__makoBootCreds ??= hidratarCredenciales());
}

/**
 * Lee una credencial de PLATAFORMA (las del dueño, las que ~70 libs esperan en
 * `process.env`). Reemplaza a `process.env.X` en los call-sites que no pueden usar
 * `credWs` porque no saben de qué workspace están hablando.
 *
 * Para credenciales POR CLIENTE seguí usando `credWs(clave, ws)`: esta función
 * resuelve siempre contra el workspace dueño.
 */
export async function envCred(clave: string): Promise<string | null> {
  await credencialesListas();
  if (esValorReal(process.env[clave])) return process.env[clave]!;
  // Si llegamos acá la hidratación terminó y no dejó el valor: o falló, o la fila no
  // existe. Vamos a la base — es el mismo lugar del que habría salido.
  const v = await credDeBase(OWNER_WS, clave);
  if (esValorReal(v)) {
    console.warn(`[credenciales] MISS ${clave}: no estaba en el entorno tras el boot; resuelta contra la base`);
    return v;
  }
  return null;
}

/** true si el workspace tiene conectada la integración `servicioKey` (todos sus campos requeridos). */
export async function integracionConectada(servicioKey: string, ws?: number): Promise<boolean> {
  const s = servicioMetodo(servicioKey);
  if (!s) return false;
  // NO colapsar a OWNER_WS: un admin sin impersonar (getWorkspaceActual()===null)
  // debe dar false → las vistas en vivo quedan vacías (contrato: el admin sin
  // impersonar ve el panel, no la data de nadie). El panel /admin pasa OWNER_WS
  // explícito cuando quiere el estado del dueño.
  const w = ws ?? (await getWorkspaceActual());
  if (w == null) return false;
  const requeridos = s.campos.filter((c) => !c.opcional);
  const objetivo = requeridos.length ? requeridos : s.campos;
  const vals = await Promise.all(objetivo.map((c) => credWs(c.env, w)));
  return requeridos.length ? vals.every(esValorReal) : vals.some(esValorReal);
}

/**
 * Estado de un campo para /metodo y /integraciones (configurado, origen, máscara).
 * Espeja la precedencia de credWs: la base primero, el env del dueño de respaldo.
 * `origen` es informativo (de dónde sale hoy) — NUNCA bloquea la edición.
 */
export async function estadoCampo(clave: string, ws?: number): Promise<EstadoCampo> {
  const w = await wsDefault(ws);
  // Los rótulos de cuenta (`…_ACCOUNT`) NO son secretos: son el email que dice de
  // qué cuenta es cada API key. Van enteros, porque enmascarados se verían
  // `••••.com` — que es exactamente lo contrario de para lo que existen.
  const visible = esClaveDeCuenta(clave);
  if (supabaseConfigurado()) {
    const { data } = await getSupabaseServer()
      .from('credenciales').select('valor_enc').eq('workspace_id', w).eq('clave', clave).maybeSingle();
    if (data) {
      const v = descifrar(data.valor_enc as string, w, clave);
      if (esValorReal(v)) return { configurado: true, origen: 'panel', mask: visible ? v! : v!.slice(-4), ilegible: false };
      // Guardada pero ilegible (rotó el secret) → re-pegar, aunque el dueño siga
      // andando con el respaldo del entorno.
      return { configurado: false, origen: null, mask: '', ilegible: true };
    }
  }
  // Sin fila en la base: el dueño puede estar corriendo con el respaldo del
  // entorno (hueco entre el deploy y la migración del boot).
  const env = process.env[clave];
  if (w === OWNER_WS && esValorReal(env)) {
    return { configurado: true, origen: 'servidor', mask: visible ? env : env.slice(-4), ilegible: false };
  }
  return { configurado: false, origen: null, mask: '', ilegible: false };
}

/** Se pidió guardar un identificador que ya reclamó otro workspace. */
export class IdentificadorOcupadoError extends Error {
  constructor(public clave: string) {
    super(`El identificador de ${clave} ya está en uso por otro espacio de trabajo.`);
    this.name = 'IdentificadorOcupadoError';
  }
}

/** Un cliente intentó guardar como BYOK la key de la PLATAFORMA. */
export class KeyDePlataformaError extends Error {
  constructor(public clave: string) {
    super('Esa es la key de la plataforma, no la de tu cuenta. Crea tu propia cuenta del servicio y pega la API key de esa cuenta.');
    this.name = 'KeyDePlataformaError';
  }
}

/**
 * Se pidió guardar como `RESEND_FROM` un remitente de un dominio de MaKo (undécima tanda, decisión 3 de la
 * décima: «Quitale a Mauricio que pueda mandar email con MaKo. Nadie debería poder.»). El mensaje es el de
 * `problemaDeRemitenteGuardado` (lib/email-remitente.ts), para mostrar tal cual.
 */
export class RemitenteNoPropioError extends Error {
  constructor(public clave: string, mensaje: string) {
    super(mensaje);
    this.name = 'RemitenteNoPropioError';
  }
}

/**
 * ¿`valor` es la credencial `clave` de la PLATAFORMA? Compara contra las DOS copias, porque pueden diferir:
 * `process.env` (lo que dejó la hidratación del boot, o el env de Vercel si todavía no corrió) y la fila del
 * dueño (`OWNER_WS`, de donde sale la hidratación). Medido el 11/10/2026: la `RESEND_API_KEY` del `.env.local`
 * y la de la fila del ws1 son DISTINTAS, y la del ws4 es una copia de la del ws1 («Datos de Mau»): mirando sólo
 * el env, esa copia se leería como la cuenta propia del ws4.
 *
 * ⚠️ «NO PUDE LEER» TIRA (`credWsEstricta`): quien pregunta esto decide si una key es «propia», y un error
 *    leído como «no es la de la plataforma» la volvería propia. Quien llama atrapa y no deja mandar.
 */
export async function esDeLaPlataforma(clave: string, valor: string | null | undefined): Promise<boolean> {
  const v = typeof valor === 'string' ? valor.trim() : '';
  if (!v) return false;
  const env = process.env[clave];
  if (esValorReal(env) && env.trim() === v) return true;
  const base = await credWsEstricta(clave, OWNER_WS);
  return esValorReal(base) && base.trim() === v;
}

/**
 * Claves BYOK cuyo valor NUNCA puede coincidir con el de la plataforma. Para
 * estas, «key propia» activa un modo distinto (lib/zernio.ts: byok=true saltea
 * el aislamiento por profile y usa el Default de LA CUENTA), así que un cliente
 * pegando la key de la agencia se colgaría de los datos de otros workspaces.
 * El guard vive ACÁ —el choke point por el que pasan TODOS los caminos de
 * guardado (/integraciones, /metodo, onboarding, datos-mau, actions)— y no en
 * cada UI: cerrar cuatro caminos deja el quinto (regla del veto en el fetch).
 *
 * lib/zernio.ts se borró el 06/10/2026 con la tab Instagram y la tarjeta de Zernio
 * salió de /integraciones. La guarda queda igual: no cuesta nada, y el ws11 y el
 * ws13 todavía tienen su propia key cargada.
 */
const BYOK_NUNCA_PLATAFORMA: ReadonlySet<string> = new Set(['ZERNIO_API_KEY']);

/** Guarda cifrado en el workspace. Solo el dueño refleja el cambio a process.env. */
export async function guardarCredencial(ws: number, clave: string, valor: string, servicio: string, updatedBy: string | null): Promise<void> {
  // Guard en POSITIVO contra la key de plataforma pegada como propia. Aplica a
  // todo workspace que no sea el dueño (para el dueño ese valor ES su cuenta).
  if (ws !== OWNER_WS && BYOK_NUNCA_PLATAFORMA.has(clave)) {
    const plataforma = await envCred(clave);
    if (plataforma && valor === plataforma) throw new KeyDePlataformaError(clave);
  }
  // ⚠️ EL REMITENTE DE MaKo NO ES DE NADIE (undécima tanda): ni el ws1, ni un cliente, ni la plataforma lo guardan
  // como credencial. Lo que habla MaKo lleva `REMITENTE_MAKO` en el código (lib/app-url.ts); un negocio, el suyo.
  // Para TODO workspace, en el choke point por el que pasan los cinco caminos de guardado.
  if (clave === 'RESEND_FROM') {
    const problema = problemaDeRemitenteGuardado(valor);
    if (problema) throw new RemitenteNoPropioError(clave, problema);
  }
  // Si esta clave identifica webhooks entrantes, RECLAMAR PRIMERO. El orden no es
  // capricho: guardar y espejar después dejaba la credencial escrita aunque el
  // identificador fuera de otro, o sea una credencial que no rutea a ningún lado.
  // Y sin el fail-closed, pegar el identificador de otro le secuestraba los
  // webhooks — los identificadores son públicos, no hace falta robar nada.
  if (ROUTING_CREDS[clave]) {
    // Un SECRETO que rutea (el hottok de Hotmart, la clave de Skool) va como su hash: lib/ruteo-hash.ts.
    const r = await upsertRouting(ROUTING_CREDS[clave], identificadorDeRuteo(clave, valor), ws);
    if (r === 'ocupado') throw new IdentificadorOcupadoError(clave);
    // 'error' NO frena el guardado: es un problema de base, no del usuario. La
    // credencial se guarda y el índice se re-siembra en el próximo boot.
  }

  const { error } = await getSupabaseServer()
    .from('credenciales')
    .upsert(
      { workspace_id: ws, clave, valor_enc: cifrar(valor, ws, clave), servicio, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,clave' },
    );
  if (error) throw new Error(`credenciales: ${error.message}`);
  if (ws === OWNER_WS) aplicarAEnv(clave, valor);
}

export async function eliminarCredencial(ws: number, clave: string): Promise<void> {
  const { error } = await getSupabaseServer().from('credenciales').delete().eq('workspace_id', ws).eq('clave', clave);
  if (error) throw new Error(`credenciales: ${error.message}`);
  if (ws === OWNER_WS && hidratadas.has(clave)) {
    delete process.env[clave];
    hidratadas.delete(clave);
  }
  // Al quitar la credencial de routing de un ws, se van sus mapeos del servicio.
  if (ROUTING_CREDS[clave]) await borrarRoutingDeWs(ROUTING_CREDS[clave], ws);
}

/** Metadatos (máscara, nunca el valor) de las credenciales cargadas en un workspace. */
export async function listarCredenciales(ws: number): Promise<CredencialMeta[]> {
  const { data, error } = await getSupabaseServer()
    .from('credenciales').select('clave, servicio, valor_enc, updated_by, updated_at').eq('workspace_id', ws);
  if (error) throw new Error(`credenciales: ${error.message}`);
  return (data ?? []).map((r) => {
    const valor = descifrar(r.valor_enc as string, ws, r.clave as string);
    return {
      clave: r.clave as string,
      servicio: r.servicio as string,
      mask: valor ? valor.slice(-4) : '',
      updated_by: (r.updated_by as string | null) ?? null,
      updated_at: r.updated_at as string,
      legible: valor !== null,
    };
  });
}

/**
 * Boot (instrumentation.ts). Hace los DOS sentidos, en este orden:
 *   1. base → process.env: hidrata SOLO las credenciales del workspace dueño,
 *      para que las ~70 libs que leen env vean lo mismo que credWs.
 *   2. process.env → base: `migrarEnvACredenciales()` copia lo que todavía viva
 *      solo en el entorno del dueño (ver ahí).
 * Los tokens de los clientes NUNCA tocan el process.env global: se resuelven
 * por-request con credWs().
 */
export async function hidratarCredenciales(): Promise<void> {
  if (!supabaseConfigurado()) return;
  try {
    const { data, error } = await getSupabaseServer()
      .from('credenciales').select('clave, valor_enc').eq('workspace_id', OWNER_WS)
      .abortSignal(AbortSignal.timeout(4000));
    if (error) {
      console.error(`[credenciales] hidratación: ${error.message}`);
      return;
    }
    let aplicadas = 0;
    for (const r of data ?? []) {
      const valor = descifrar(r.valor_enc as string, OWNER_WS, r.clave as string);
      if (valor !== null && aplicarAEnv(r.clave as string, valor)) aplicadas++;
    }
    if (aplicadas) console.log(`[credenciales] ${aplicadas} credencial(es) del dueño hidratadas`);
    // Sembrar el índice de ruteo de webhooks del dueño desde el env (idempotente):
    // sus credenciales pueden venir del entorno sin pasar por guardarCredencial →
    // sin esto sus webhooks quedarían sin fila en webhook_routing y se ignorarían.
    const { seedRoutingDelDueno } = await import('./webhook-routing');
    await seedRoutingDelDueno();
  } catch (e) {
    console.error('[credenciales] hidratación falló:', e);
  }
  // Sentido inverso (process.env → base): copia a la base cifrada lo que todavía
  // viva solo en el entorno del dueño. Va DESPUÉS de hidratar y fuera del try de
  // arriba, para que un fallo de hidratación no se la saltee. Best-effort.
  await migrarEnvACredenciales();
}

/**
 * Migración idempotente env → base para el workspace dueño: por cada clave del
 * catálogo que esté REAL en el entorno y NO tenga fila en `credenciales`, la
 * guarda cifrada. SOLO rellena huecos: jamás pisa lo que ya está en la base (que
 * es lo que manda). Corre en el boot; al deployar, las credenciales del dueño se
 * copian solas y después puede borrarlas del entorno del server.
 *
 * No hay bucle con `hidratarCredenciales()`: lo hidratado SALE de la base, así
 * que ya tiene fila y esta función lo saltea.
 */
/**
 * Claves que son de PLATAFORMA PURA (la cuenta es de MaKo, no del dueño) y por
 * eso NUNCA se migran del entorno a la fila de un workspace. La de Zernio es de
 * Martín: migrada al ws1 quedaba disfrazada de conexión BYOK de Mauricio
 * (integracionConectada('zernio', ws1) daba true) — el mismo problema, invertido,
 * que la app de Meta colgando de la cuenta personal de Mauricio. Y sin esta
 * exclusión, borrarla de la base no alcanza: el próximo boot la re-siembra
 * («migrarEnvACredenciales rellena huecos», la trampa anotada en .env.local).
 * En el catálogo la clave sigue: un CLIENTE sí puede pegar la suya (BYOK).
 */
/**
 * ⚠️ `ELEVENLABS_API_KEY` se sumó el 02/09/2026, al pasar la voz a BYOK.
 *
 * Sin esto, borrar la fila del ws1 no dura NADA: `migrarEnvACredenciales`
 * rellena huecos, así que el próximo arranque la vuelve a escribir desde el
 * entorno — y como el `.env.local` apunta a la base de PRODUCCIÓN, alcanza con
 * que alguien corra `npm run dev` para que la cuenta de MaKo reaparezca
 * disfrazada de conexión propia de Mauricio. Es exactamente el caso de Zernio
 * que ya está contado arriba.
 */
/**
 * ⚠️ Las SEIS de la pasarela de pagos (11/10/2026) están por otro motivo, y es más grave:
 * acá no se copia una cuenta que gasta, se copia una cuenta que COBRA.
 *
 *  · El boot: si alguien carga `STRIPE_SECRET_KEY` como env de Vercel «para la plataforma», la
 *    migración la escribiría en la fila del ws1 —Mauricio, un cliente— y sus links de pago
 *    cobrarían en la cuenta de MaKo con cara de conexión propia. La Stripe de MaKo vive en la fila
 *    de `wsSuperAdmin()`, pegada desde /integraciones como la de cualquier cliente.
 *  · «Datos de Mau» (lib/datos-mau.ts) copia las credenciales del ws1 a un workspace de prueba:
 *    sin esto, un clic dejaba la clave de cobro de Mauricio adentro de otro espacio.
 *
 * Los ids derivados (`STRIPE_ACCOUNT_ID`, `MERCADOPAGO_USER_ID`) igual rebotarían por
 * `IdentificadorOcupadoError`, pero van también: una lista que deja pasar la mitad de una
 * conexión es una lista que hay que pensar cada vez. tests/pasarela-sin-env.test.ts cuida el
 * otro lado: que ningún código lea estas claves de `process.env`.
 */
/**
 * ⚠️ `RESEND_FROM` (undécima tanda, 11/10/2026): el del entorno es la identidad de la PLATAFORMA, y
 * `guardarCredencial` ya no deja guardar un remitente de MaKo en ningún workspace. Sin esto, si el env lo
 * tuviera, cada boot intentaría copiarlo al ws1 y fallaría (un error en el log por arranque), y «Datos de Mau»
 * lo copiaría al workspace de prueba. Un CLIENTE sigue pegando el suyo desde /integraciones.
 */
const NO_MIGRAR_A_WS: ReadonlySet<string> = new Set([
  'ZERNIO_API_KEY', 'ZERNIO_WEBHOOK_SECRET', 'ELEVENLABS_API_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT_ID', 'STRIPE_WEBHOOK_SECRET',
  'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_USER_ID', 'MERCADOPAGO_WEBHOOK_SECRET',
  'RESEND_FROM',
]);

/** Para que otros módulos pregunten en vez de repetir la lista. */
export function esCredencialDeLaCasa(clave: string): boolean {
  return NO_MIGRAR_A_WS.has(clave);
}

export async function migrarEnvACredenciales(ws: number = OWNER_WS): Promise<number> {
  if (!supabaseConfigurado()) return 0;
  try {
    const { data, error } = await getSupabaseServer()
      .from('credenciales').select('clave').eq('workspace_id', ws)
      .abortSignal(AbortSignal.timeout(4000));
    if (error) {
      console.error(`[credenciales] migración env→base: ${error.message}`);
      return 0;
    }
    const yaEnBase = new Set((data ?? []).map((r) => r.clave as string));
    let migradas = 0;
    for (const clave of ENVS_METODO) {
      if (NO_MIGRAR_A_WS.has(clave)) continue; // plataforma pura: nunca a la fila de un ws
      if (yaEnBase.has(clave)) continue; // la base manda: nunca la pisamos
      const valor = process.env[clave];
      if (!esValorReal(valor)) continue;
      try {
        await guardarCredencial(ws, clave, valor, servicioDeEnv(clave) ?? 'otros', 'migracion-env');
        migradas++;
      } catch (e) {
        console.error(`[credenciales] migración de ${clave} falló:`, e);
      }
    }
    if (migradas) console.log(`[credenciales] ${migradas} credencial(es) migradas del entorno a la base (ws ${ws})`);
    return migradas;
  } catch (e) {
    console.error('[credenciales] migración env→base falló:', e);
    return 0;
  }
}

// Infra de la plataforma: NUNCA se pisa desde la base. Este es el único choke
// point que escribe process.env → el guard va acá.
//
// Dos motivos para estar en esta lista:
//  1. Huevo y gallina: sin la clave no se puede leer/descifrar la propia tabla de
//     credenciales, así que no puede vivir adentro de ella.
//  2. Es de la PLATAFORMA y sostiene el acceso de todos. Si la base la pudiera
//     pisar, una fila mala tumbaría el login o las sesiones de todo el mundo.
//
// El caso 2 no es hipotético: `credenciales` tenía filas zombie de
// GOOGLE_CLIENT_ID/SECRET (las escribió una versión vieja del catálogo, cuando
// Google figuraba como si fuera una credencial de cliente). El catálogo ya no las
// tiene, ninguna UI las muestra, pero hidratarCredenciales NO filtra por catálogo
// —agarra todas las filas del dueño— así que igual pisaban el entorno en cada
// boot. O sea: el login de la plataforma colgaba de dos filas invisibles.
const INFRA_ENV = new Set([
  // Huevo y gallina.
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CREDENCIALES_SECRET',
  // Acceso de la plataforma: la app OAuth con la que TODOS entran, y el secreto
  // que firma las sesiones. No son de ningún cliente.
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
]);

/**
 * Refleja al process.env global el valor que manda (el de la base). Solo dueño.
 * Las ~70 libs que leen process.env directo tienen que ver lo mismo que credWs,
 * así que esto PISA el respaldo del entorno (antes el entorno ganaba y las
 * ediciones del panel quedaban mudas para esas libs).
 * true si cambió algo.
 */
function aplicarAEnv(clave: string, valor: string): boolean {
  if (INFRA_ENV.has(clave)) return false;
  hidratadas.add(clave);
  if (process.env[clave] === valor) return false;
  process.env[clave] = valor;
  return true;
}
