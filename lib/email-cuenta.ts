// =============================================================================
// email-cuenta — CON QUÉ CUENTA DE RESEND manda cada negocio (4/11/2026)
// =============================================================================
// Martín (4/11/2026): «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako». Las reglas puras y el
// porqué viven en lib/email-cuenta-reglas.ts; esto lee la base.
//
//   · Un NEGOCIO manda con SU clave: la `RESEND_API_KEY` de SU fila, distinta de la de MaKo. Sin ella, su email no sale
//     (`SIN_EMAIL_PROPIO`) y la guía (`estado_email`) dice cómo conectarla. Nunca cae a la de MaKo: eso era alojarle el
//     dominio en la cuenta de MaKo, que es justo lo que se decidió no hacer.
//   · La PLATAFORMA (`wsSuperAdmin()`) manda con la de MaKo: es su cuenta.
//   · Lo que FIRMA MaKo (`from: REMITENTE_MAKO`) sale siempre por la de MaKo (`keyDeCorreoDeLaPlataforma`), desde
//     cualquier negocio: lib/resend.ts.
//
// ⚠️ «NO PUDE LEER» NO ES «NO TIENE»: las lecturas son estrictas (`credDelClienteEstricta`, `esDeLaPlataforma`) y un error
//    vuelve como `no_pude_leer`, que no manda nada y no dice «conecta tu email» sobre una cuenta que quizás está.
// =============================================================================

import 'server-only';
import { credDelClienteEstricta, envCred, esDeLaPlataforma } from './credenciales';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { SECRETO_WEBHOOK_PROPIO, type EstadoCuenta } from './email-cuenta-reglas';

export type CuentaDeCorreo =
  | { tipo: 'propia'; ws: number; key: string }
  | { tipo: 'plataforma'; ws: number; key: string }
  | { tipo: 'sin_cuenta' | 'la_de_mako'; ws: number | null }
  | { tipo: 'no_pude_leer'; ws: number | null; error: string };

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** La clave de correo de MaKo: la del entorno, que sale de la fila de la PLATAFORMA (lib/credenciales.ts → `wsDelEntorno`). */
export async function keyDeCorreoDeLaPlataforma(): Promise<string | null> {
  const k = await envCred('RESEND_API_KEY');
  return k && k.trim() ? k.trim() : null;
}

/** La cuenta de Resend del negocio `ws` (o el del contexto). Nunca tira. */
export async function cuentaDeCorreo(wsPedido?: number | null): Promise<CuentaDeCorreo> {
  let ws: number | null = null;
  try {
    ws = wsPedido ?? (await getWorkspaceActual());
    if (ws == null) return { tipo: 'sin_cuenta', ws: null };
    if (ws === (await wsSuperAdmin())) {
      const key = await keyDeCorreoDeLaPlataforma();
      return key ? { tipo: 'plataforma', ws, key } : { tipo: 'sin_cuenta', ws };
    }
    const propia = await credDelClienteEstricta('RESEND_API_KEY', ws, { ilegibleTira: true });
    if (!propia || !propia.trim()) return { tipo: 'sin_cuenta', ws };
    // La de MaKo en la fila de un negocio (el ws1 de antes del 4/11, la copia del ws4 de «Datos de Mau») no es suya.
    if (await esDeLaPlataforma('RESEND_API_KEY', propia)) return { tipo: 'la_de_mako', ws };
    return { tipo: 'propia', ws, key: propia.trim() };
  } catch (e) {
    return { tipo: 'no_pude_leer', ws, error: mensaje(e) };
  }
}

/** La clave con la que manda el negocio del contexto (la suya, o la de MaKo si es la plataforma), o null. */
export async function keyDeCorreoDelNegocio(): Promise<string | null> {
  const c = await cuentaDeCorreo();
  return 'key' in c ? c.key : null;
}

/** El estado de la cuenta para la guía (`EstadoCuenta`, lib/email-cuenta-reglas.ts). */
export const estadoDeCuenta = (c: CuentaDeCorreo): EstadoCuenta => c.tipo;

/**
 * El secreto del webhook de la cuenta DEL NEGOCIO `ws` (lo guarda `conectar_seguimiento_email`), o null. ESTRICTO: tira si
 * no se puede leer. Lo lee el webhook para decidir si un evento es de esa cuenta: «no pude leer» no puede ser «no tiene».
 */
export async function secretoDelWebhookPropio(ws: number): Promise<string | null> {
  const s = await credDelClienteEstricta(SECRETO_WEBHOOK_PROPIO, ws, { ilegibleTira: true });
  return s && s.trim() ? s.trim() : null;
}
