// =============================================================================
// limites-envio-cuenta — ¿con qué cuenta manda el negocio? Decide el máximo de «Email por día» (13/11/2026, ticket #93)
// =============================================================================
// La regla vive en lib/limites-envio.ts (`rangoDeLimite`, pura y con test). Esto lo lee contra la base, en el workspace del
// contexto: la cuenta de Resend (`cuentaDeCorreo`, lib/email-cuenta.ts) y el remitente (`remitenteDelNegocioActual`,
// lib/resend.ts). Cuenta propia = SU clave de Resend (tipo «propia», no la de la plataforma) Y un remitente que pasa.
//
// ⚠️ ANTE LA DUDA, LA DE LA PLATAFORMA (500): «no pude leer» no es «tiene cuenta propia». Y lo guardado por encima de 500 se
//    lee como 500 (`sanearLimites`): una lectura que falla manda menos, nunca más, y nunca baja a lo de fábrica.
// Con import diferido: lib/resend y lib/email-cuenta los usan pocos de los que leen los límites.
// =============================================================================

import 'server-only';
import type { OpcionesRango } from './limites-envio';

/** Las opciones de rango del negocio del contexto. Nunca tira. */
export async function opcionesDeRango(): Promise<OpcionesRango> {
  try {
    const [{ cuentaDeCorreo }, { remitenteDelNegocioActual }] = await Promise.all([import('./email-cuenta'), import('./resend')]);
    const [cuenta, remitente] = await Promise.all([cuentaDeCorreo(), remitenteDelNegocioActual()]);
    return { cuentaPropia: cuenta.tipo === 'propia' && remitente.puede };
  } catch (e) {
    console.error(`[limites-envio] con qué cuenta manda el negocio: ${e instanceof Error ? e.message : String(e)}`);
    return { cuentaPropia: false };
  }
}
