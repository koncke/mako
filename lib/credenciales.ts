// =============================================================================
// credenciales — tokens de integraciones cargados desde la UI (tabla 0053)
// =============================================================================
// El problema: ~30 lecturas de process.env repartidas por todo lib/ hacen que
// dar de alta un cliente nuevo exija cargar env vars en Vercel a mano. La
// solución NO es refactorizar todas las libs: los valores guardados acá se
// HIDRATAN a process.env cuando arranca cada instancia (instrumentation.ts) y
// al momento de guardarlos, así el resto del código sigue leyendo env como
// siempre.
//
// Reglas:
//   · La env de Vercel GANA: si META_ACCESS_TOKEN ya está seteada en el server,
//     lo guardado en la base no la pisa (evita romper producción desde la UI).
//     En una instancia nueva sin envs, todo sale de acá.
//   · Cifrado AES-256-GCM app-side: en la base solo viaja gcm1.<iv>.<tag>.<c>.
//     Clave = SHA-256 del secret (CREDENCIALES_SECRET → AUTH_COOKIE_VALUE →
//     SUPABASE_SERVICE_ROLE_KEY). Si rota el secret, lo guardado queda ilegible
//     y hay que volver a pegarlo — la UI lo muestra como "re-conectar".
//   · Solo claves del catálogo de /metodo (whitelist en el API) — nunca envs
//     arbitrarias.

import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseServer } from './supabase';

export type CredencialMeta = {
  clave: string;
  servicio: string;
  /** últimos 4 caracteres del valor, para mostrar "••••abcd" en la UI. */
  mask: string;
  updated_by: string | null;
  updated_at: string;
  /** false si el secret de cifrado cambió y el valor ya no se puede leer. */
  legible: boolean;
};

// Sobrevive HMR en dev; en Vercel cada instancia arranca con el Set vacío y lo
// llena la hidratación del boot.
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

// Un valor de env "real": presente y no un placeholder. La convención del repo
// (lib/meta-ads.ts, lib/panda.ts, lib/youtube.ts…) trata los valores que
// empiezan con 'PENDING' como ausentes — los replicamos para no bloquear el
// override desde el panel ni reportar como conectado algo que las libs ignoran.
const esValorReal = (v: string | undefined | null): v is string =>
  Boolean(v && v.trim() && !v.trim().startsWith('PENDING'));

/** Guarda cifrado y aplica a process.env si la env del server no manda. */
export async function guardarCredencial(clave: string, valor: string, servicio: string, updatedBy: string | null): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('credenciales')
    .upsert(
      { clave, valor_enc: cifrar(valor), servicio, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: 'clave' },
    );
  if (error) throw new Error(`credenciales: ${error.message}`);
  aplicarAEnv(clave, valor);
}

export async function eliminarCredencial(clave: string): Promise<void> {
  const { error } = await getSupabaseServer().from('credenciales').delete().eq('clave', clave);
  if (error) throw new Error(`credenciales: ${error.message}`);
  if (hidratadas.has(clave)) {
    delete process.env[clave];
    hidratadas.delete(clave);
  }
}

/** Metadatos para la UI (máscara, nunca el valor entero). */
export async function listarCredenciales(): Promise<CredencialMeta[]> {
  const { data, error } = await getSupabaseServer()
    .from('credenciales').select('clave, servicio, valor_enc, updated_by, updated_at');
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

/** Valor efectivo de una clave: env del server → base. Para los pings de /metodo. */
export async function valorEfectivo(clave: string): Promise<string | null> {
  if (esValorReal(process.env[clave])) return process.env[clave]!;
  if (!supabaseConfigurado()) return null;
  const { data } = await getSupabaseServer()
    .from('credenciales').select('valor_enc').eq('clave', clave).maybeSingle();
  return data ? descifrar(data.valor_enc as string) : null;
}

/**
 * Carga todo lo guardado a process.env (corre en el register() de
 * instrumentation.ts, antes de servir requests). Nunca tira: sin Supabase o
 * con la base caída, la app arranca igual solo con las envs del server.
 */
export async function hidratarCredenciales(): Promise<void> {
  if (!supabaseConfigurado()) return;
  try {
    // Timeout duro: register() bloquea el arranque de la instancia, así que una
    // DB colgada al boot no puede dejar la app sin atender requests. El abort
    // además desactiva los reintentos de postgrest-js y cae en el catch.
    const { data, error } = await getSupabaseServer()
      .from('credenciales').select('clave, valor_enc')
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
    if (aplicadas) console.log(`[credenciales] ${aplicadas} credencial(es) hidratadas desde la base`);
  } catch (e) {
    console.error('[credenciales] hidratación falló:', e);
  }
}

/** true si el valor quedó aplicado (la env REAL del server siempre gana). */
function aplicarAEnv(clave: string, valor: string): boolean {
  const envDelServer = esValorReal(process.env[clave]) && !hidratadas.has(clave);
  if (envDelServer) return false;
  process.env[clave] = valor;
  hidratadas.add(clave);
  return true;
}

/** De dónde sale el valor vigente de una env: del server, del panel, o no está. */
export function origenCredencial(clave: string): 'servidor' | 'panel' | null {
  if (!esValorReal(process.env[clave])) return null;
  return hidratadas.has(clave) ? 'panel' : 'servidor';
}
