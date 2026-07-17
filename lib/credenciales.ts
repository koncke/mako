// =============================================================================
// credenciales — tokens de integraciones POR WORKSPACE (tablas 0053/0054/0055)
// =============================================================================
// Cada cliente (workspace) guarda sus propios tokens de Meta/Chatwoot/etc.,
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
// Cifrado: clave = SHA-256 del secret (CREDENCIALES_SECRET → AUTH_COOKIE_VALUE
// → SUPABASE_SERVICE_ROLE_KEY). Si rota, lo guardado queda ilegible y /metodo
// lo marca para re-pegar.

import 'server-only';
// El cifrado vive en su propio módulo (sin server-only ni Next) para que se pueda
// testear suelto: scripts/test-cripto.mjs. Es el código más caro de equivocar.
import { cifrar, descifrar, versionCripto } from './cripto-credenciales';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';
import { ENVS_METODO, servicioDeEnv, servicioMetodo } from './metodo-catalogo';
import { ROUTING_CREDS, upsertRouting, borrarRoutingDeWs } from './webhook-routing';

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
  if (supabaseConfigurado()) {
    const { data } = await getSupabaseServer()
      .from('credenciales').select('valor_enc').eq('workspace_id', w).eq('clave', clave).maybeSingle();
    if (data) {
      const v = descifrar(data.valor_enc as string, w, clave);
      if (esValorReal(v)) return { configurado: true, origen: 'panel', mask: v!.slice(-4), ilegible: false };
      // Guardada pero ilegible (rotó el secret) → re-pegar, aunque el dueño siga
      // andando con el respaldo del entorno.
      return { configurado: false, origen: null, mask: '', ilegible: true };
    }
  }
  // Sin fila en la base: el dueño puede estar corriendo con el respaldo del
  // entorno (hueco entre el deploy y la migración del boot).
  const env = process.env[clave];
  if (w === OWNER_WS && esValorReal(env)) {
    return { configurado: true, origen: 'servidor', mask: env.slice(-4), ilegible: false };
  }
  return { configurado: false, origen: null, mask: '', ilegible: false };
}

/** Guarda cifrado en el workspace. Solo el dueño refleja el cambio a process.env. */
export async function guardarCredencial(ws: number, clave: string, valor: string, servicio: string, updatedBy: string | null): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('credenciales')
    .upsert(
      { workspace_id: ws, clave, valor_enc: cifrar(valor, ws, clave), servicio, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,clave' },
    );
  if (error) throw new Error(`credenciales: ${error.message}`);
  if (ws === OWNER_WS) aplicarAEnv(clave, valor);
  // Espejo al índice de routing: si esta clave identifica webhooks entrantes,
  // mapeamos identificador→workspace para que el evento sin sesión rutee bien.
  if (ROUTING_CREDS[clave]) await upsertRouting(ROUTING_CREDS[clave], valor, ws);
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

// Infra de la plataforma: NUNCA se pisa desde la base. Sin estas claves no se
// puede leer/descifrar la propia tabla de credenciales (huevo y gallina), así que
// no son configurables desde la app y no viven en el catálogo. Este es el único
// choke point que escribe process.env → el guard va acá.
const INFRA_ENV = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CREDENCIALES_SECRET',
  'AUTH_COOKIE_VALUE',
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
