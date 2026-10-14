// =============================================================================
// descargar-codigos — baja los códigos de recuperación como un .txt
// =============================================================================
// Pedido de Martín (14/10/2026): «los códigos de recuperación se tienen que poder DESCARGAR»,
// no sólo mostrar. Lo usan las dos pantallas que los muestran (el alta en /login/2fa y
// /perfil/seguridad). El texto lo arma `textoCodigosRecuperacion` (lib/mfa-texto.ts, con test);
// acá sólo se dispara la descarga, en el navegador.

import { textoCodigosRecuperacion } from '@/lib/mfa-texto';

export function descargarCodigos(codigos: readonly string[], cuenta: string): void {
  const blob = new Blob([textoCodigosRecuperacion(codigos, cuenta)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mako-codigos-recuperacion.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // En el tick siguiente: revocar en el mismo tick cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
