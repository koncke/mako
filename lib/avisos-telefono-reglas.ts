// =============================================================================
// avisos-telefono-reglas — qué cuenta como «tiene los avisos» y qué le falta a cada teléfono (puro)
// =============================================================================
// Lo leen el onboarding (app/onboarding/TarjetaAvisos.tsx) y el recordatorio de /general (lib/avisos-telefono.ts).
//
// ⚠️ EN IPHONE, HASTA QUE EXISTA LA APP DE LA TIENDA: Web Push existe sólo con la app AGREGADA A INICIO (iOS 16.4 o más) y abierta desde su ícono, y ahí la sesión es otra: hay que volver a
// entrar. En una pestaña de Safari no hay manera. Quien no pueda: sigue con su grupo mientras exista, y lo tiene adentro de la app.
// =============================================================================

import type { EstadoAvisos } from './push-cliente';

/** Una computadora no cuenta: los avisos son para cuando no está mirando la pantalla. */
export const esTelefonoDeAvisos = (plataforma: string | null | undefined): boolean => plataforma === 'android' || plataforma === 'ios';

/** ¿Este dispositivo es un teléfono o una tablet? En la computadora se ofrece el QR, en el teléfono el botón. */
export function esTelefonoPorUA(ua: string, tactil: number): boolean {
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && tactil > 1);
}

export type PasoAvisos = 'revisando' | 'qr' | 'activar' | 'instalar-ios' | 'bloqueado' | 'no-soportado' | 'registrando';

/** Qué le pide la tarjeta a este dispositivo. `activo` en el navegador y sin fila en el server: se registra solo. */
export function pasoDeAvisos(o: { telefono: boolean | null; estado: EstadoAvisos | null }): PasoAvisos {
  if (o.telefono === null || (o.telefono && o.estado === null)) return 'revisando';
  if (!o.telefono) return 'qr';
  switch (o.estado) {
    case 'instalar-primero': return 'instalar-ios';
    case 'bloqueado': return 'bloqueado';
    case 'no-soportado': return 'no-soportado';
    case 'activo': return 'registrando';
    default: return 'activar';
  }
}

export const PREGUNTA_AVISOS = 'Por último, activa los avisos en tu teléfono: así te enteras de lo que pasa en tu negocio.';
export const AVISOS_LISTOS = 'Avisos activados';
export const AVISOS_SIN_SOPORTE = 'Mi teléfono no puede';
export const PIDE_AVISOS = 'Para seguir, activa los avisos con el botón.';
