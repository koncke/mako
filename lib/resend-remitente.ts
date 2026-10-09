// =============================================================================
// resend-remitente — ¿este remitente puede mandar con ESTA cuenta de Resend?
// =============================================================================
// Lo usa el ping de la integración de Email (`email` en lib/metodo-verificar.ts), que ya trae la
// lista de dominios de la cuenta: con eso se puede decir ANTES de guardar si el remitente va a
// fallar, en vez de enterarse cuando un correo no sale.
//
// Existe por el punto 15 del audio de Customer Success (08/10/2026): Leandro cargó su key, los
// correos no salían, y lo que faltaba era el remitente. El campo ahora dice «falta» (ver `sinEsto`
// en lib/metodo-catalogo.ts); esto cuida lo que viene después, que el que se escriba sirva.
//
// ⚠️ GENEROSO A PROPÓSITO. Frenar un remitente que sí anda es peor que dejar pasar uno que no: el
// primero no se puede guardar y el segundo es lo de siempre. Por eso sólo frena lo que se sabe
// roto (un correo que no es un correo, el sandbox, un dominio que no está en la cuenta o que Resend
// declara sin verificar) y acepta un subdominio del dominio verificado.
//
// ⚠️ SIN `server-only` A PROPÓSITO: es lo que permite tenerlo con test.
// =============================================================================

import { direccionDe } from './curso-invitar-canales';

export type DominioResend = { name?: string | null; status?: string | null };

/** Los estados de un dominio con los que Resend NO deja mandar. Los demás pasan. */
const SIN_VERIFICAR = new Set(['not_started', 'pending', 'failed']);

/**
 * `null` = el remitente sirve (o no hay remitente: eso lo dice el campo, no el ping).
 * Un texto = por qué no va a salir, para mostrar tal cual.
 */
export function problemaDelRemitente(remitente: string | null | undefined, dominios: DominioResend[]): string | null {
  const s = String(remitente ?? '').trim();
  if (!s) return null;
  const dir = direccionDe(s);
  if (!dir) return 'El remitente no tiene un correo válido. Escríbelo así: Tu negocio <hola@tunegocio.com>.';
  const dom = dir.slice(dir.lastIndexOf('@') + 1);
  if (dom === 'resend.dev' || dom.endsWith('.resend.dev')) {
    return 'Ese es el remitente de prueba de Resend: solo te entrega a ti. Usa un correo de tu dominio.';
  }
  const suyo = dominios.find((d) => {
    const n = String(d.name ?? '').trim().toLowerCase();
    return !!n && (dom === n || dom.endsWith(`.${n}`));
  });
  if (!suyo) return `El dominio ${dom} no está en tu cuenta de Resend. Agrégalo en Resend → Domains y verifícalo.`;
  if (SIN_VERIFICAR.has(String(suyo.status ?? '').trim().toLowerCase())) {
    return `El dominio ${dom} todavía no está verificado en Resend. Cuando figure "Verified", vuelve a guardar.`;
  }
  return null;
}
