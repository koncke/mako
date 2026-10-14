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
