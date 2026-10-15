// =============================================================================
// mfa — los segundos factores del login de MaKo, contra la base
// =============================================================================
// Las REGLAS (TOTP, códigos, quién necesita segundo factor) viven en lib/mfa-reglas.ts,
// sin base, para que se puedan testear. Acá está todo lo que lee o escribe:
//
//   · la app de autenticación (TOTP), con su secreto CIFRADO;
//   · el código por WhatsApp y por correo de respaldo: la verificación está; el ENVÍO no
//     (sale en la tanda 2 por una automatización del SuperAdmin, ver `CANALES_CODIGO`);
//   · las passkeys (huella, Face ID, PIN del dispositivo);
//   · los códigos de recuperación (de un solo uso);
//   · «recordar este dispositivo»;
//   · el registro de cada intento, que es auditoría Y el freno contra la fuerza bruta.
//
// ⚠️ Lo usan DOS puertas con dos autenticaciones distintas, y ninguna de las dos decide
// nada acá: `/api/auth/2fa` (sólo con el paso intermedio, para entrar) y
// `/api/perfil/seguridad` (sólo con sesión completa, para administrar). Cada una pasa el
// `usuarioId` que ella ya validó; este módulo confía en ese número y en nada más.
//
// ⚠️ Preguntas de verificación NO hay, a propósito: son el factor más débil que existe.

import 'server-only';
import crypto from 'node:crypto';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import QRCode from 'qrcode';
import { getSupabaseServer } from './supabase';
import { cifrar, descifrar } from './cripto-credenciales';
import { APP_BASE_URL } from './app-url';
import {
  type Factor, type RelyingParty, type Canal,
  generarSecretoTotp, verificarTotp, uriOtpauth, generarCodigoNumerico, hmacCodigo,
  generarCodigosRecuperacion as generarCodigosPuros, normalizarCodigoRecuperacion,
  validarEmailRespaldo, validarTelefono, enmascarar, debeFrenar, relyingParty, igualSeguro,
  canalDisponible, CANAL_NO_DISPONIBLE,
  MAX_FALLOS, VENTANA_FALLOS_MIN, CODIGO_MINUTOS, CODIGO_INTENTOS, DISPOSITIVO_DIAS,
} from './mfa-reglas';

export type { Canal };

const sb = () => getSupabaseServer();

/** La llave de los HMAC (códigos, dispositivos). Sin ella no se emite ni se verifica nada. */
function llave(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || !s.trim()) throw new Error('mfa: falta AUTH_SECRET');
  return s;
}

/** El AAD del secreto TOTP: el criptograma de un usuario no abre en la fila de otro. */
const CLAVE_TOTP = (usuarioId: number) => `mfa-totp:${usuarioId}`;
/** `cifrar` pide un workspace; el usuario no es de uno, así que va 0 y el AAD lo ata a él. */
const WS_CIFRADO = 0;

const ahoraIso = () => new Date().toISOString();
const enMin = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

// ── Lo que tiene cada usuario ────────────────────────────────────────────────

type FilaMfa = {
  usuario_id: number;
  totp_cifrado: string | null; totp_activo: boolean; totp_ultimo_paso: number | null;
  whatsapp_tel: string | null; whatsapp_activo: boolean;
  email_respaldo: string | null; email_activo: boolean;
};

async function filaMfa(usuarioId: number): Promise<FilaMfa | null> {
  const { data, error } = await sb().from('usuario_mfa').select('*').eq('usuario_id', usuarioId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaMfa) ?? null;
}

async function upsertMfa(usuarioId: number, cambios: Partial<FilaMfa>): Promise<void> {
  const { error } = await sb().from('usuario_mfa')
    .upsert({ usuario_id: usuarioId, ...cambios, updated_at: ahoraIso() }, { onConflict: 'usuario_id' });
  if (error) throw new Error(error.message);
}

export type Passkey = { id: number; nombre: string | null; created_at: string; usado_at: string | null };
export type Dispositivo = { id: number; nombre: string | null; created_at: string; usado_at: string | null; expira_at: string };

export type EstadoMfa = {
  /** ¿Tiene al menos un factor? (el mismo dato que `usuarios.mfa_activo`). */
  activo: boolean;
  totp: boolean;
  passkeys: Passkey[];
  /** El destino enmascarado si está activo, para mostrarlo sin revelarlo entero. */
  whatsapp: string | null;
  email: string | null;
  codigosRestantes: number;
  dispositivos: Dispositivo[];
};

export async function estadoMfa(usuarioId: number): Promise<EstadoMfa> {
  const [fila, pk, cod, disp] = await Promise.all([
    filaMfa(usuarioId),
    sb().from('usuario_passkeys').select('id,nombre,created_at,usado_at').eq('usuario_id', usuarioId).order('created_at'),
    sb().from('usuario_codigos_recuperacion').select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId).is('usado_at', null),
    sb().from('usuario_dispositivos').select('id,nombre,created_at,usado_at,expira_at')
      .eq('usuario_id', usuarioId).is('revocado_at', null).gt('expira_at', ahoraIso()).order('created_at', { ascending: false }),
  ]);
  for (const r of [pk, cod, disp]) if (r.error) throw new Error(r.error.message);
  const passkeys = (pk.data ?? []) as Passkey[];
  const totp = !!fila?.totp_activo;
  const whatsapp = fila?.whatsapp_activo && fila.whatsapp_tel ? enmascarar(fila.whatsapp_tel) : null;
  const email = fila?.email_activo && fila.email_respaldo ? enmascarar(fila.email_respaldo) : null;
  return {
    activo: totp || passkeys.length > 0 || !!whatsapp || !!email,
    totp, passkeys, whatsapp, email,
    codigosRestantes: cod.count ?? 0,
    dispositivos: (disp.data ?? []) as Dispositivo[],
  };
}

/** Cuántos factores reales tiene (los códigos de recuperación no cuentan: son la salida). */
export function cantidadFactores(e: EstadoMfa): number {
  return (e.totp ? 1 : 0) + e.passkeys.length + (e.whatsapp ? 1 : 0) + (e.email ? 1 : 0);
}

/**
 * Deja `usuarios.mfa_activo` igual a lo que de verdad hay. Se llama después de CADA
 * alta o baja de un factor: ese flag es lo que `getUsuarioActual` mira en cada request.
 */
export async function sincronizarMfaActivo(usuarioId: number): Promise<boolean> {
  const e = await estadoMfa(usuarioId);
  const { error } = await sb().from('usuarios').update({ mfa_activo: e.activo }).eq('id', usuarioId);
  if (error) throw new Error(error.message);
  return e.activo;
}

/**
 * ¿Tiene algún factor DE VERDAD? Lo pregunta el login antes de decidir si hace falta el
 * segundo paso, y no confía sólo en `usuarios.mfa_activo`.
 *
 * ⚠️ Activar un factor son dos escrituras (el factor y después el flag): si la segunda
 * fallaba, quedaba un factor activo con el flag en false, y el 2FA de esa persona apagado
 * sin aviso y para siempre (revisión del 14/10/2026). Acá se cuenta lo que hay y, si no
 * coincide con el flag, se arregla el flag. Si la base no contesta, vale el flag: es lo
 * único que hay, y el login ya depende de la base para encontrar al usuario.
 */
/**
 * ¿Esta persona tiene un segundo factor? La MISMA cuenta que usa el login (`estadoMfa`), para
 * quien tenga que preguntarlo desde afuera (la condición «no tiene el 2FA» de un aviso). TIRA
 * si no puede leer: un «no» inventado le mandaría el aviso a quien ya cumplió.
 */
export async function tieneSegundoFactor(usuarioId: number): Promise<boolean> {
  return (await estadoMfa(usuarioId)).activo;
}

export async function mfaActivoReal(usuarioId: number, flag: boolean): Promise<boolean> {
  try {
    const e = await estadoMfa(usuarioId);
    if (e.activo !== flag) await sincronizarMfaActivo(usuarioId).catch(() => {});
    return e.activo;
  } catch {
    return flag;
  }
}

// ── El registro de intentos, y el freno ──────────────────────────────────────

/**
 * Una fila de AUDITORÍA. Best-effort: perder una no puede tumbar un login que salió bien.
 * ⚠️ El freno NO se cuenta con estas filas (se tragan el error): lo cuenta `intentar`,
 * con las suyas.
 */
export async function registrarEvento(usuarioId: number | null, tipo: string, ok: boolean, detalle?: string): Promise<void> {
  await sb().from('mfa_eventos').insert({ usuario_id: usuarioId, tipo, ok, detalle: detalle?.slice(0, 300) ?? null })
    .then(() => {}, () => {});
}

/** El tipo de las filas que cuenta el freno. Un código de 6 dígitos se puede adivinar; una
 *  firma de passkey, no: por eso las passkeys no pasan por acá (y el que tiene la cuenta
 *  de Google no puede dejar al dueño sin su llave mandando códigos malos). */
const TIPO_INTENTO = 'intento';

/**
 * Anota un intento de ADIVINAR (un código de la app, uno mandado o uno de recuperación)
 * ANTES de verificarlo, y recién ahí cuenta. Devuelve el id de la fila si se puede probar,
 * o null si hay que frenar.
 *
 * ⚠️ Fail-closed en las dos puntas: si el insert falla o la cuenta falla, se frena. Un
 * freno que se abre cuando la base no contesta se apaga tirando la base.
 * ⚠️ La fila nace `ok: false` y sólo pasa a true si el código vale (`intentoOk`): un
 * pedido que se cae a mitad de camino cuenta como fallo, que es lo seguro.
 */
export async function intentar(usuarioId: number, accion: string): Promise<number | null> {
  const ins = await sb().from('mfa_eventos')
    .insert({ usuario_id: usuarioId, tipo: TIPO_INTENTO, ok: false, detalle: accion.slice(0, 60) })
    .select('id').single();
  if (ins.error || !ins.data) return null;
  const desde = new Date(Date.now() - VENTANA_FALLOS_MIN * 60_000).toISOString();
  const { count, error } = await sb().from('mfa_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId).eq('tipo', TIPO_INTENTO).eq('ok', false).gte('created_at', desde);
  if (error || debeFrenar(count ?? Number.POSITIVE_INFINITY)) return null;
  return (ins.data as { id: number }).id;
}

/** El código valió: la fila deja de contar como fallo. */
export async function intentoOk(id: number): Promise<void> {
  await sb().from('mfa_eventos').update({ ok: true }).eq('id', id).eq('tipo', TIPO_INTENTO).then(() => {}, () => {});
}

export const MENSAJE_FRENADO = `Demasiados intentos. Espera ${VENTANA_FALLOS_MIN} minutos y vuelve a probar.`;

// ── Desafíos de corta vida ───────────────────────────────────────────────────

type TipoDesafio =
  | 'login-whatsapp' | 'login-email' | 'login-passkey'
  | 'enrolar-totp' | 'enrolar-whatsapp' | 'enrolar-email' | 'enrolar-passkey';

type FilaDesafio = { id: number; dato: string; destino: string | null; intentos: number; expira_at: string };

async function crearDesafio(usuarioId: number, tipo: TipoDesafio, dato: string, minutos: number, destino?: string | null): Promise<void> {
  // Uno vivo por tipo: el anterior se cierra para que un código viejo no siga valiendo.
  await sb().from('mfa_desafios').update({ usado_at: ahoraIso() })
    .eq('usuario_id', usuarioId).eq('tipo', tipo).is('usado_at', null);
  const { error } = await sb().from('mfa_desafios').insert({
    usuario_id: usuarioId, tipo, dato, destino: destino ?? null, expira_at: enMin(minutos),
  });
  if (error) throw new Error(error.message);
}

async function desafioVivo(usuarioId: number, tipo: TipoDesafio): Promise<FilaDesafio | null> {
  const { data, error } = await sb().from('mfa_desafios')
    .select('id,dato,destino,intentos,expira_at')
    .eq('usuario_id', usuarioId).eq('tipo', tipo).is('usado_at', null).gt('expira_at', ahoraIso())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaDesafio) ?? null;
}

/** Cierra el desafío SÓLO si sigue abierto: dos pestañas no lo usan dos veces. */
async function consumirDesafio(id: number): Promise<boolean> {
  const { data, error } = await sb().from('mfa_desafios').update({ usado_at: ahoraIso() })
    .eq('id', id).is('usado_at', null).select('id');
  if (error) return false;
  return (data ?? []).length === 1;
}

async function sumarIntento(d: FilaDesafio): Promise<void> {
  await sb().from('mfa_desafios').update({ intentos: d.intentos + 1 }).eq('id', d.id).then(() => {}, () => {});
}

/** Cuántos códigos se mandaron a este usuario por este canal en los últimos 10 minutos. */
async function enviosRecientes(usuarioId: number, tipo: TipoDesafio): Promise<number> {
  const desde = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error } = await sb().from('mfa_desafios').select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId).eq('tipo', tipo).gte('created_at', desde);
  if (error) return Number.POSITIVE_INFINITY;
  return count ?? 0;
}

/** Un mismo canal no manda más de 3 códigos cada 10 minutos: es WhatsApp o un correo ajeno. */
const MAX_ENVIOS = 3;

// `T = unknown` y no `Record<string, never>`: con ésa, `{ ok: true } & T` no lo cumple nada (el
// índice exige `never` también para `ok`) y ningún `return { ok: true }` tipaba.
export type Resultado<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

// ── App de autenticación (TOTP) ──────────────────────────────────────────────

/** Empieza a enrolar: el secreto queda en un desafío (cifrado) hasta que se confirme con un código. */
export async function iniciarTotp(usuarioId: number, cuenta: string): Promise<{ secreto: string; uri: string; qr: string }> {
  const secreto = generarSecretoTotp();
  await crearDesafio(usuarioId, 'enrolar-totp', cifrar(secreto, WS_CIFRADO, CLAVE_TOTP(usuarioId)), 15);
  const uri = uriOtpauth(secreto, cuenta);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { secreto, uri, qr };
}

/** Confirma el enrolamiento con el primer código de la app. Recién ahí queda activo. */
export async function confirmarTotp(usuarioId: number, codigo: string): Promise<Resultado> {
  const d = await desafioVivo(usuarioId, 'enrolar-totp');
  if (!d) return { ok: false, error: 'El código QR venció. Vuelve a empezar.' };
  const secreto = descifrar(d.dato, WS_CIFRADO, CLAVE_TOTP(usuarioId));
  if (!secreto) return { ok: false, error: 'No se pudo leer el código QR. Vuelve a empezar.' };
  const r = verificarTotp(secreto, codigo);
  if (!r.ok) {
    await sumarIntento(d);
    await registrarEvento(usuarioId, 'enrolar-totp', false, r.motivo);
    return { ok: false, error: 'Ese código no coincide. Usa el que muestra la app ahora.' };
  }
  if (!(await consumirDesafio(d.id))) return { ok: false, error: 'Ese código ya se usó.' };
  await upsertMfa(usuarioId, {
    totp_cifrado: cifrar(secreto, WS_CIFRADO, CLAVE_TOTP(usuarioId)), totp_activo: true, totp_ultimo_paso: r.paso,
  });
  await registrarEvento(usuarioId, 'enrolar-totp', true);
  await sincronizarMfaActivo(usuarioId);
  return { ok: true };
}

/** Verifica un código de la app para ENTRAR. Un código aceptado no vale una segunda vez. */
export async function verificarTotpLogin(usuarioId: number, codigo: string): Promise<boolean> {
  const f = await filaMfa(usuarioId);
  if (!f?.totp_activo || !f.totp_cifrado) return false;
  const secreto = descifrar(f.totp_cifrado, WS_CIFRADO, CLAVE_TOTP(usuarioId));
  if (!secreto) return false;
  const r = verificarTotp(secreto, codigo, { ultimoPaso: f.totp_ultimo_paso });
  if (!r.ok) return false;
  // Compare-and-set sobre el último paso: dos pedidos con el mismo código en el mismo
  // instante no pueden pasar los dos.
  let q = sb().from('usuario_mfa').update({ totp_ultimo_paso: r.paso, updated_at: ahoraIso() }).eq('usuario_id', usuarioId);
  q = f.totp_ultimo_paso == null ? q.is('totp_ultimo_paso', null) : q.eq('totp_ultimo_paso', f.totp_ultimo_paso);
  const { data, error } = await q.select('usuario_id');
  return !error && (data ?? []).length === 1;
}

// ── Código por WhatsApp o por correo ─────────────────────────────────────────

/**
 * La puerta por donde sale el código: la tanda 2 la enchufa a la automatización del
 * SuperAdmin («Pidió un código de acceso»), con el workspace explícito y sin pasar por
 * `emitirAviso` (que lo copiaría al feed, a un push y a la conversación del doer).
 *
 * ⛔ Hoy no manda nada y no se llega: `enviarCodigo` corta antes con `canalDisponible`.
 * Acá NO va un `sendEmail` ni un `enviarAPersonaMaKo`: lo fija tests/mfa.test.ts.
 * ⚠️ Y el WhatsApp, cuando salga, va como JID canonizado al enrolar (`whatsappNumbers`):
 * con los dígitos pelados Evolution le saca uno a los números de AR y MX.
 */
async function mandarCodigo(canal: Canal, destino: string, codigo: string): Promise<Resultado> {
  void canal; void destino; void codigo;
  return { ok: false, error: CANAL_NO_DISPONIBLE };
}

/**
 * Manda un código. `proposito: 'login'` usa el destino ya verificado del usuario;
 * `'enrolar'` usa el que se pasa, recién validado, y no lo guarda hasta que se confirme.
 */
export async function enviarCodigo(
  usuarioId: number, canal: Canal, proposito: 'login' | 'enrolar',
  opts: { destino?: string; emailLogin?: string } = {},
): Promise<Resultado<{ destino: string }>> {
  // Antes de todo: sin canal no se crea ni un desafío.
  if (!canalDisponible(canal)) return { ok: false, error: CANAL_NO_DISPONIBLE };
  const tipo: TipoDesafio = `${proposito}-${canal}`;
  if ((await enviosRecientes(usuarioId, tipo)) >= MAX_ENVIOS) {
    return { ok: false, error: 'Ya te mandamos varios códigos. Espera unos minutos.' };
  }
  let destino: string;
  if (proposito === 'login') {
    const f = await filaMfa(usuarioId);
    const d = canal === 'whatsapp' ? (f?.whatsapp_activo ? f.whatsapp_tel : null) : (f?.email_activo ? f.email_respaldo : null);
    if (!d) return { ok: false, error: 'Ese método no está activado.' };
    destino = d;
  } else {
    const v = canal === 'whatsapp'
      ? validarTelefono(opts.destino ?? '')
      : validarEmailRespaldo(opts.destino ?? '', opts.emailLogin ?? '');
    if (!v.ok) return v;
    destino = 'digitos' in v ? v.digitos : v.email;
  }
  const codigo = generarCodigoNumerico(6);
  await crearDesafio(usuarioId, tipo, hmacCodigo(codigo, llave()), CODIGO_MINUTOS, destino);
  const r = await mandarCodigo(canal, destino, codigo);
  if (!r.ok) return r;
  return { ok: true, destino: enmascarar(destino) };
}

/** Verifica el código mandado. Al enrolar, recién acá queda activo el destino. */
export async function verificarCodigo(
  usuarioId: number, canal: Canal, proposito: 'login' | 'enrolar', codigo: string,
): Promise<Resultado> {
  if (!canalDisponible(canal)) return { ok: false, error: CANAL_NO_DISPONIBLE };
  const d = await desafioVivo(usuarioId, `${proposito}-${canal}`);
  if (!d) return { ok: false, error: 'El código venció. Pide uno nuevo.' };
  if (d.intentos >= CODIGO_INTENTOS) return { ok: false, error: 'Demasiados intentos con ese código. Pide uno nuevo.' };
  const limpio = String(codigo ?? '').replace(/\D/g, '');
  const ok = limpio.length === 6 && igualSeguro(hmacCodigo(limpio, llave()), d.dato);
  if (!ok) {
    await sumarIntento(d);
    await registrarEvento(usuarioId, `${proposito}-${canal}`, false);
    return { ok: false, error: 'Ese código no coincide.' };
  }
  if (!(await consumirDesafio(d.id))) return { ok: false, error: 'Ese código ya se usó.' };
  if (proposito === 'enrolar' && d.destino) {
    await upsertMfa(usuarioId, canal === 'whatsapp'
      ? { whatsapp_tel: d.destino, whatsapp_activo: true }
      : { email_respaldo: d.destino, email_activo: true });
    await sincronizarMfaActivo(usuarioId);
  }
  await registrarEvento(usuarioId, `${proposito}-${canal}`, true);
  return { ok: true };
}

// ── Códigos de recuperación ──────────────────────────────────────────────────

/** Genera 10 nuevos y BORRA los anteriores. Se muestran una sola vez: acá sólo queda su HMAC. */
export async function generarCodigosRecuperacion(usuarioId: number): Promise<string[]> {
  const codigos = generarCodigosPuros(10);
  const { error: e1 } = await sb().from('usuario_codigos_recuperacion').delete().eq('usuario_id', usuarioId);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb().from('usuario_codigos_recuperacion').insert(
    codigos.map((c) => ({ usuario_id: usuarioId, hash: hmacCodigo(normalizarCodigoRecuperacion(c), llave()) })),
  );
  if (e2) throw new Error(e2.message);
  await registrarEvento(usuarioId, 'recuperacion-generar', true);
  return codigos;
}

/** Usa un código de recuperación. Un solo uso, con compare-and-set. */
export async function usarCodigoRecuperacion(usuarioId: number, codigo: string): Promise<boolean> {
  const h = hmacCodigo(normalizarCodigoRecuperacion(codigo), llave());
  const { data, error } = await sb().from('usuario_codigos_recuperacion').update({ usado_at: ahoraIso() })
    .eq('usuario_id', usuarioId).eq('hash', h).is('usado_at', null).select('id');
  return !error && (data ?? []).length === 1;
}

// ── Passkeys ─────────────────────────────────────────────────────────────────

/** El dominio y los orígenes de las passkeys para este pedido, o null si acá no hay. */
export function rpDelPedido(host: string | null): RelyingParty | null {
  let canonico = '';
  try { canonico = new URL(APP_BASE_URL).hostname; } catch { canonico = ''; }
  return relyingParty(host ?? '', canonico);
}

const userIdWebauthn = (usuarioId: number) => new TextEncoder().encode(`mako-usuario-${usuarioId}`);

export async function opcionesRegistroPasskey(usuarioId: number, email: string, nombre: string, rp: RelyingParty) {
  const { data: previas } = await sb().from('usuario_passkeys').select('credential_id,transports').eq('usuario_id', usuarioId);
  const opciones = await generateRegistrationOptions({
    rpName: 'MaKo', rpID: rp.rpID,
    userName: email, userDisplayName: nombre || email, userID: userIdWebauthn(usuarioId),
    attestationType: 'none',
    excludeCredentials: (previas ?? []).map((p) => ({
      id: p.credential_id as string,
      transports: (p.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await crearDesafio(usuarioId, 'enrolar-passkey', opciones.challenge, 10);
  return opciones;
}

export async function verificarRegistroPasskey(
  usuarioId: number, respuesta: RegistrationResponseJSON, rp: RelyingParty, nombre?: string,
): Promise<Resultado> {
  const d = await desafioVivo(usuarioId, 'enrolar-passkey');
  if (!d) return { ok: false, error: 'Se venció el tiempo. Vuelve a probar.' };
  let v;
  try {
    v = await verifyRegistrationResponse({
      response: respuesta, expectedChallenge: d.dato, expectedOrigin: rp.origenes, expectedRPID: rp.rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    await registrarEvento(usuarioId, 'enrolar-passkey', false, e instanceof Error ? e.message : 'error');
    return { ok: false, error: 'El dispositivo no confirmó la llave. Vuelve a probar.' };
  }
  if (!v.verified) return { ok: false, error: 'El dispositivo no confirmó la llave.' };
  if (!(await consumirDesafio(d.id))) return { ok: false, error: 'Ese pedido ya se usó.' };
  const c = v.registrationInfo.credential;
  const { error } = await sb().from('usuario_passkeys').insert({
    usuario_id: usuarioId, credential_id: c.id,
    public_key: Buffer.from(c.publicKey).toString('base64url'), contador: c.counter,
    transports: c.transports ?? null, nombre: (nombre ?? '').trim().slice(0, 60) || null,
  });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? 'Esa llave ya está registrada.' : error.message };
  await registrarEvento(usuarioId, 'enrolar-passkey', true);
  await sincronizarMfaActivo(usuarioId);
  return { ok: true };
}

export async function opcionesLoginPasskey(usuarioId: number, rp: RelyingParty) {
  const { data } = await sb().from('usuario_passkeys').select('credential_id,transports').eq('usuario_id', usuarioId);
  const opciones = await generateAuthenticationOptions({
    rpID: rp.rpID, userVerification: 'preferred',
    allowCredentials: (data ?? []).map((p) => ({
      id: p.credential_id as string,
      transports: (p.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
  });
  await crearDesafio(usuarioId, 'login-passkey', opciones.challenge, 5);
  return opciones;
}

export async function verificarLoginPasskey(usuarioId: number, respuesta: AuthenticationResponseJSON, rp: RelyingParty): Promise<boolean> {
  const d = await desafioVivo(usuarioId, 'login-passkey');
  if (!d) return false;
  // La llave tiene que ser DE ESTE usuario: si no, cualquiera con una passkey propia de
  // MaKo pasaba el segundo paso de otro.
  const { data: pk } = await sb().from('usuario_passkeys').select('id,credential_id,public_key,contador,transports')
    .eq('usuario_id', usuarioId).eq('credential_id', respuesta.id).maybeSingle();
  if (!pk) return false;
  try {
    const v = await verifyAuthenticationResponse({
      response: respuesta, expectedChallenge: d.dato, expectedOrigin: rp.origenes, expectedRPID: rp.rpID,
      credential: {
        id: pk.credential_id as string,
        publicKey: new Uint8Array(Buffer.from(pk.public_key as string, 'base64url')),
        counter: Number(pk.contador ?? 0),
        transports: (pk.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      },
      requireUserVerification: false,
    });
    if (!v.verified) return false;
    if (!(await consumirDesafio(d.id))) return false;
    await sb().from('usuario_passkeys')
      .update({ contador: v.authenticationInfo.newCounter, usado_at: ahoraIso() }).eq('id', pk.id);
    return true;
  } catch {
    return false;
  }
}

// ── «Recordar este dispositivo» ──────────────────────────────────────────────

/** Crea el dispositivo de confianza y devuelve el token para la cookie (en la base, su HMAC). */
export async function crearDispositivo(usuarioId: number, nombre: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const { error } = await sb().from('usuario_dispositivos').insert({
    usuario_id: usuarioId, token_hash: hmacCodigo(token, llave()),
    nombre: nombre.slice(0, 120) || null,
    expira_at: new Date(Date.now() + DISPOSITIVO_DIAS * 86_400_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  await registrarEvento(usuarioId, 'dispositivo-recordar', true);
  return token;
}

/** ¿Este token de cookie es un dispositivo vigente DE ESTE usuario? */
export async function dispositivoValido(usuarioId: number, token: string | undefined | null): Promise<boolean> {
  if (!token || token.length < 20 || token.length > 200) return false;
  const { data, error } = await sb().from('usuario_dispositivos').select('id')
    .eq('usuario_id', usuarioId).eq('token_hash', hmacCodigo(token, llave()))
    .is('revocado_at', null).gt('expira_at', ahoraIso()).maybeSingle();
  if (error || !data) return false;
  await sb().from('usuario_dispositivos').update({ usado_at: ahoraIso() }).eq('id', data.id).then(() => {}, () => {});
  return true;
}

export async function revocarDispositivo(usuarioId: number, id: number | 'todos'): Promise<void> {
  let q = sb().from('usuario_dispositivos').update({ revocado_at: ahoraIso() }).eq('usuario_id', usuarioId).is('revocado_at', null);
  if (id !== 'todos') q = q.eq('id', id);
  const { error } = await q;
  if (error) throw new Error(error.message);
  await registrarEvento(usuarioId, 'dispositivo-revocar', true, String(id));
}

// ── Sacar un factor ──────────────────────────────────────────────────────────

/**
 * Saca un factor. ⚠️ Al super admin no se le deja sacar el ÚLTIMO: sin ninguno, el
 * próximo login lo mandaría a enrolar uno desde cero — y en ese momento cualquiera que
 * tenga su cuenta de Google se enrola el suyo. Primero se agrega otro, después se saca.
 */
export async function quitarFactor(
  usuarioId: number, obligado: boolean, factor: Factor | 'passkey', passkeyId?: number,
): Promise<Resultado> {
  const e = await estadoMfa(usuarioId);
  // `obligado` = `politicaLoExige` (lib/mfa-reglas.ts): el super admin, o un negocio que lo exige.
  if (obligado && cantidadFactores(e) <= 1) {
    return { ok: false, error: 'Es tu único método. Agrega otro antes de sacar éste.' };
  }
  if (factor === 'totp') await upsertMfa(usuarioId, { totp_cifrado: null, totp_activo: false, totp_ultimo_paso: null });
  else if (factor === 'whatsapp') await upsertMfa(usuarioId, { whatsapp_activo: false });
  else if (factor === 'email') await upsertMfa(usuarioId, { email_activo: false });
  else if (factor === 'passkey') {
    if (!passkeyId) return { ok: false, error: 'Falta cuál llave.' };
    const { error } = await sb().from('usuario_passkeys').delete().eq('usuario_id', usuarioId).eq('id', passkeyId);
    if (error) return { ok: false, error: error.message };
  } else return { ok: false, error: 'Ese método no se puede quitar.' };
  await registrarEvento(usuarioId, `quitar-${factor}`, true);
  const sigue = await sincronizarMfaActivo(usuarioId);
  // Sin ningún factor, los códigos de recuperación no tienen nada que recuperar.
  if (!sigue) await sb().from('usuario_codigos_recuperacion').delete().eq('usuario_id', usuarioId);
  return { ok: true };
}

export { MAX_FALLOS };
