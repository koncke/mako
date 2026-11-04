// =============================================================================
// app-tiendas — el link único de la app: a qué tienda lleva cada dispositivo
// =============================================================================
// Martín, 3/11/2026: «que instalen la app y que sea ese link o que les lleve a la apple store dependiendo su dispositivo... Tipo un QR o algo así».
// El link es `/app` (app/app/page.tsx) y el QR del onboarding apunta a él:
//   · iPhone → su tienda; Android → la suya; una computadora → el QR;
//   · mientras una tienda no tenga la app, ese teléfono ve la guía para agregarla a la pantalla de inicio.
//
// ⚠️ PUBLICARLA ES CAMBIAR UN SOLO VALOR: `publicada` de esa tienda. Hasta entonces, esas direcciones no llevan a la app.
//
// PURO y sin `server-only`: lo leen la página, la pantalla del onboarding y tests/link-app.test.ts.
// =============================================================================

export const RUTA_APP = '/app';

export type Tienda = { url: string; publicada: boolean };

export const TIENDAS: Record<'ios' | 'android', Tienda> = {
  ios: { url: 'https://apps.apple.com/app/id6830383006', publicada: false },
  android: { url: 'https://play.google.com/store/apps/details?id=com.holamako.app', publicada: false },
};

export type DestinoApp = { tipo: 'tienda'; url: string } | { tipo: 'guia'; plataforma: 'ios' | 'android' } | { tipo: 'qr' };

/** A dónde va este dispositivo. La plataforma sale de `plataformaDeUA` (lib/push-payload.ts). */
export function destinoDeLaApp(plataforma: 'ios' | 'android' | 'desktop', tiendas: Record<'ios' | 'android', Tienda> = TIENDAS): DestinoApp {
  if (plataforma === 'desktop') return { tipo: 'qr' };
  const t = tiendas[plataforma];
  return t.publicada ? { tipo: 'tienda', url: t.url } : { tipo: 'guia', plataforma };
}
