// =============================================================================
// contrasena — guardar, comprobar y frenar la contraseña de MaKo (15/10/2026)
// =============================================================================
// Las reglas puras (política, hash, cuándo se exige) viven en lib/contrasena-reglas.ts. Esto es lo
// que toca la base: la tabla `usuario_contrasena` (mig 0286) y el freno de intentos, en
// `mfa_eventos` con su PROPIO tipo.
//
// ⚠️ EL FRENO DE LA CONTRASEÑA NO COMPARTE CUENTA CON EL DEL 2FA. Si los fallos de contraseña
// contaran en el mismo cupo que los códigos, quien sólo sabe el correo de Martín le dejaba el
// segundo paso bloqueado mandando contraseñas malas: «un freno que corta TODO se vuelve un arma»
// (docs/hallazgos-seguridad.md, la revisión del 2FA). Tipo aparte: `intento-contrasena`.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { buscarUsuarioPorEmail, type Usuario } from './usuarios';
import { debeFrenar, VENTANA_FALLOS_MIN } from './mfa-reglas';
import { hashContrasena, verificarContrasena, hashDeRelleno, problemaDeContrasena, correoNormalizado } from './contrasena-reglas';
import { registrarEvento } from './mfa';

const sb = () => getSupabaseServer();
const TIPO_INTENTO_CONTRASENA = 'intento-contrasena';

/** ¿Tiene contraseña? null = no se pudo leer (quien decide con esto NO exige: ver requiereCrearContrasena). */
export async function tieneContrasena(usuarioId: number): Promise<boolean | null> {
  try {
    const { data, error } = await sb().from('usuario_contrasena').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle();
    if (error) return null;
    return data != null;
  } catch {
    return null;
  }
}

/** Crea o cambia la contraseña. El error que vuelve es para la pantalla (corto). */
export async function guardarContrasena(usuarioId: number, contrasena: unknown, email: string): Promise<{ ok: true } | { ok: false; error: string; nuestro?: true }> {
  const problema = problemaDeContrasena(contrasena, email);
  if (problema) return { ok: false, error: problema };
  const hash = await hashContrasena(contrasena as string);
  const ahora = new Date().toISOString();
  const { data: antes } = await sb().from('usuario_contrasena').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle();
  const { error } = antes
    ? await sb().from('usuario_contrasena').update({ hash, cambiada_at: ahora }).eq('usuario_id', usuarioId)
    : await sb().from('usuario_contrasena').insert({ usuario_id: usuarioId, hash, creada_at: ahora, cambiada_at: ahora });
  // `nuestro`: la base no guardó. Es distinto de «no sirve»: el login no la deja afuera por esto.
  if (error) return { ok: false, error: 'No se pudo guardar. Prueba de nuevo.', nuestro: true };
  await registrarEvento(usuarioId, antes ? 'contrasena-cambiar' : 'contrasena-crear', true);
  return { ok: true };
}

/** Anota el intento ANTES de contar (el molde de `intentar`, lib/mfa.ts). null = frenar. Fail-closed. */
async function intentarContrasena(usuarioId: number): Promise<number | null> {
  const ins = await sb().from('mfa_eventos')
    .insert({ usuario_id: usuarioId, tipo: TIPO_INTENTO_CONTRASENA, ok: false, detalle: 'login' })
    .select('id').single();
  if (ins.error || !ins.data) return null;
  const desde = new Date(Date.now() - VENTANA_FALLOS_MIN * 60_000).toISOString();
  const { count, error } = await sb().from('mfa_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId).eq('tipo', TIPO_INTENTO_CONTRASENA).eq('ok', false).gte('created_at', desde);
  if (error || debeFrenar(count ?? Number.POSITIVE_INFINITY)) return null;
  return (ins.data as { id: number }).id;
}

export const MENSAJE_CONTRASENA_FRENADA = `Demasiados intentos. Espera ${VENTANA_FALLOS_MIN} minutos o entra con Google.`;
/** UNA respuesta para «no existe», «no tiene contraseña» y «no coincide»: no cuenta qué correos hay. */
export const MENSAJE_NO_COINCIDE = 'El correo o la contraseña no coinciden.';

/**
 * Comprueba correo + contraseña. Tarda lo mismo si el correo no existe o no tiene contraseña (se
 * compara contra un hash de relleno), y contesta lo mismo en los tres casos.
 */
export async function comprobarContrasena(emailCrudo: unknown, contrasena: unknown): Promise<
  { ok: true; usuario: Usuario } | { ok: false; error: string; status: number }
> {
  const email = correoNormalizado(emailCrudo);
  const clave = typeof contrasena === 'string' ? contrasena : '';
  let usuario: Usuario | null = null;
  try { usuario = email ? await buscarUsuarioPorEmail(email) : null; } catch { usuario = null; }
  const valido = usuario && usuario.id > 0 && usuario.estado !== 'suspendido' ? usuario : null;

  let hash: string | null = null;
  if (valido) {
    const { data } = await sb().from('usuario_contrasena').select('hash').eq('usuario_id', valido.id).maybeSingle();
    hash = (data as { hash?: string } | null)?.hash ?? null;
  }
  if (!valido || !hash) {
    await verificarContrasena(clave, await hashDeRelleno());
    return { ok: false, error: MENSAJE_NO_COINCIDE, status: 401 };
  }
  const intento = await intentarContrasena(valido.id);
  if (!intento) return { ok: false, error: MENSAJE_CONTRASENA_FRENADA, status: 429 };
  if (!(await verificarContrasena(clave, hash))) return { ok: false, error: MENSAJE_NO_COINCIDE, status: 401 };
  await sb().from('mfa_eventos').update({ ok: true }).eq('id', intento).eq('tipo', TIPO_INTENTO_CONTRASENA).then(() => {}, () => {});
  return { ok: true, usuario: valido };
}
