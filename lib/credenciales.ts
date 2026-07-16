// =============================================================================
// credenciales — tokens de integraciones POR WORKSPACE (tablas 0053/0054/0055)
// =============================================================================
// Cada cliente (workspace) guarda sus propios tokens de Meta/Chatwoot/etc.,
// cifrados AES-256-GCM. El resolver `credWs(clave)` devuelve el token del
// workspace del request.
//
// INVARIANTE DEL DUEÑO (workspace 1): para el dueño el env de Vercel SIEMPRE
// gana — su resolución es idéntica a antes del multi-inquilino (sin lecturas
// extra a la base si la env está). Los clientes NUNCA leen process.env: sus
// tokens salen solo de su fila en la tabla (aislamiento estricto).
//
// Cifrado: clave = SHA-256 del secret (CREDENCIALES_SECRET → AUTH_COOKIE_VALUE
// → SUPABASE_SERVICE_ROLE_KEY). Si rota, lo guardado queda ilegible y /metodo
// lo marca para re-pegar.

import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';
import { servicioMetodo } from './metodo-catalogo';
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
  /** 'servidor' = env de Vercel (solo dueño); 'panel' = cargado en /metodo. */
  origen: 'servidor' | 'panel' | null;
  mask: string;
  /** guardado pero ilegible (rotó el secret de cifrado) → re-pegar. */
  ilegible: boolean;
};

// Set de claves del dueño hidratadas a process.env (solo ws1). Sobrevive HMR.
const g = globalThis as typeof globalThis & { __makoCredsHidratadas?: Set<string> };
const hidratadas = (g.__makoCredsHidratadas ??= new Set<string>());

function claveCifrado(): Buffer | null {
  const sec = process.env.CREDENCIALES_SECRET || process.env.AUTH_COOKIE_VALUE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sec || !sec.trim()) return null;
  return crypto.createHash('sha256').update(sec).digest();
}

function cifrar(valor: string): string {
  const key = claveCifrado();
  if (!key) throw new Error('credenciales: sin secret de cifrado (CREDENCIALES_SECRET / AUTH_COOKIE_VALUE)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return `gcm1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

function descifrar(valorEnc: string): string | null {
  const key = claveCifrado();
  if (!key) return null;
  const partes = valorEnc.split('.');
  if (partes.length !== 4 || partes[0] !== 'gcm1') return null;
  try {
    const [, iv, tag, cuerpo] = partes;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(cuerpo, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null; // secret rotado o fila corrupta
  }
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
  return data ? descifrar(data.valor_enc as string) : null;
}

/**
 * Token efectivo de una clave para el workspace del request (o `ws` explícito).
 * Dueño → env de Vercel gana; cliente → solo su fila cifrada. Es el resolver
 * que usan las libs de integración.
 */
export async function credWs(clave: string, ws?: number): Promise<string | null> {
  const w = await wsDefault(ws);
  if (w === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]!;
  const v = await credDeBase(w, clave);
  return esValorReal(v) ? v : null;
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

/** Estado de un campo para /metodo (configurado, origen, máscara). */
export async function estadoCampo(clave: string, ws?: number): Promise<EstadoCampo> {
  const w = await wsDefault(ws);
  if (w === OWNER_WS && esValorReal(process.env[clave])) {
    return { configurado: true, origen: 'servidor', mask: '', ilegible: false };
  }
  if (!supabaseConfigurado()) return { configurado: false, origen: null, mask: '', ilegible: false };
  const { data } = await getSupabaseServer()
    .from('credenciales').select('valor_enc').eq('workspace_id', w).eq('clave', clave).maybeSingle();
  if (!data) return { configurado: false, origen: null, mask: '', ilegible: false };
  const v = descifrar(data.valor_enc as string);
  if (esValorReal(v)) return { configurado: true, origen: 'panel', mask: v!.slice(-4), ilegible: false };
  return { configurado: false, origen: null, mask: '', ilegible: true };
}

/** Guarda cifrado en el workspace. Solo el dueño refleja el cambio a process.env. */
export async function guardarCredencial(ws: number, clave: string, valor: string, servicio: string, updatedBy: string | null): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('credenciales')
    .upsert(
      { workspace_id: ws, clave, valor_enc: cifrar(valor), servicio, updated_by: updatedBy, updated_at: new Date().toISOString() },
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
    const valor = descifrar(r.valor_enc as string);
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
 * Hidrata al process.env global SOLO las credenciales del workspace dueño.
 * Corre en instrumentation.ts (boot). Los tokens de los clientes NUNCA tocan
 * el process.env global: se resuelven por-request con credWs().
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
      const valor = descifrar(r.valor_enc as string);
      if (valor !== null && aplicarAEnv(r.clave as string, valor)) aplicadas++;
    }
    if (aplicadas) console.log(`[credenciales] ${aplicadas} credencial(es) del dueño hidratadas`);
    // Sembrar el índice de ruteo de webhooks del dueño desde el env (idempotente):
    // sus credenciales viven en Vercel, no pasan por guardarCredencial → sin esto
    // sus webhooks quedarían sin fila en webhook_routing y se ignorarían.
    const { seedRoutingDelDueno } = await import('./webhook-routing');
    await seedRoutingDelDueno();
  } catch (e) {
    console.error('[credenciales] hidratación falló:', e);
  }
}

/** true si el valor quedó aplicado (la env REAL del server siempre gana). Solo dueño. */
function aplicarAEnv(clave: string, valor: string): boolean {
  const envDelServer = esValorReal(process.env[clave]) && !hidratadas.has(clave);
  if (envDelServer) return false;
  process.env[clave] = valor;
  hidratadas.add(clave);
  return true;
}
