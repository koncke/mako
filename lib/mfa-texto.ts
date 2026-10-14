// =============================================================================
// mfa-texto — el texto de los códigos de recuperación, para el NAVEGADOR
// =============================================================================
// Aparte de lib/mfa-reglas.ts a propósito: aquél importa node:crypto, y un componente
// 'use client' que lo importara se llevaría el módulo entero al bundle (o no compilaría).
// Sin dependencias: lo importan el alta de /login/2fa, /perfil/seguridad y los tests.

export function textoCodigosRecuperacion(codigos: readonly string[], cuenta: string, fecha: Date = new Date()): string {
  const dia = fecha.toISOString().slice(0, 10);
  return [
    'MaKo — códigos de recuperación',
    `Cuenta: ${cuenta}`,
    `Generados: ${dia}`,
    '',
    'Cada código sirve UNA vez, si pierdes tu método del segundo paso.',
    'Guárdalos fuera del teléfono (impresos o en un gestor de contraseñas).',
    'Si generas códigos nuevos, estos dejan de valer.',
    '',
    ...codigos,
    '',
  ].join('\r\n');
}

/**
 * El código de 6 dígitos que hay en un texto pegado o copiado: «123456», «123 456», «123-456» o
 * «Tu código es 123456. Vence en 10 minutos». Null si no hay uno solo claro.
 *
 * Pedido de Martín (14/10/2026): que el campo tome solo el código que acaba de copiar. ⚠️ Primero
 * se busca un bloque SUELTO de 6 dígitos y recién después el partido en 3+3: juntar dígitos
 * separados por espacios antes de buscar convertiría «123456 10» en 8 dígitos y no encontraría nada.
 */
export function extraerCodigo(texto: string | null | undefined): string | null {
  const t = String(texto ?? '');
  const solo = t.match(/(?<!\d)\d{6}(?!\d)/g);
  if (solo && solo.length === 1) return solo[0];
  if (solo && solo.length > 1) return null;
  const partido = t.match(/(?<!\d)(\d{3})[ -](\d{3})(?!\d)/);
  return partido ? partido[1] + partido[2] : null;
}
