// =============================================================================
// EL IDA Y VUELTA ENTRE LA APP Y EL ONBOARDING, IMPOSIBLE POR CONSTRUCCIÓN (20/11/2026)
// =============================================================================
// El Cerebro, en producción (2885104c9), después de «Reiniciar onboarding» en el ws 3: al tocar «Entrar a MaKo», más de 1000 pedidos
// en segundos alternando /second-brain?_rsc y /onboarding?_rsc, la pantalla en blanco, durante ~7 minutos (18:43 a 18:50 UTC), y se
// fue solo. EL DIAGNÓSTICO OBVIO (EL SERVIDOR) ERA EL EQUIVOCADO: el servidor contestaba bien todo el tiempo (medido con fetch RSC en
// la misma pestaña del bucle). Era el ROUTER CACHE del navegador: con el onboarding pendiente, algo de /onboarding prefetcheó
// /second-brain, el servidor contestó «a /onboarding?rebote=<viejo>», y eso quedó guardado. «Entrar a MaKo» (router.push) lo reusaba
// aunque cambiaran los parámetros; /onboarding, que miraba el rebote por FRESCURA, no reconocía el viejo y devolvía a la app; y así
// hasta que vencía el prefetch (~5 minutos: por eso «se fue solo», y por eso una pestaña nueva no lo hacía). Lo reprodujo el Cerebro.
//
//   · Del onboarding a la app, navegación ENTERA (`window.location.assign`): no mira el Router Cache.
//   · En /onboarding ningún link prefetchea la app (`enElOnboarding`, app/_ui/Link.tsx).
//   · Cada redirección entre las dos lleva `?rebote=<segundos>`, y uno PRESENTE corta, viejo o nuevo (`vieneRebotado`, sin mirar la
//     hora): la guarda lo deja pasar; /onboarding, con el onboarding terminado, muestra «Tu onboarding ya está listo» con «Entrar a
//     MaKo» (un toque de la persona, nunca otra redirección).
//   · Y, como red, la guarda lee ESTRICTO: si no pudo leer, NO manda al onboarding (deja pasar y lo anota en el log).
//
// Puro (sin servidor): lo usan lib/onboarding-state.ts (`mandarAlOnboarding`), lib/tab-access.ts y app/onboarding/page.tsx, y lo
// fija tests/onboarding-sin-ida-y-vuelta.test.ts.
// =============================================================================

export const PARAM_REBOTE = 'rebote';
/** El valor del parámetro: la hora del servidor, en segundos. */
export const marcaDeRebote = (ahoraMs: number): string => String(Math.floor(ahoraMs / 1000));

/**
 * ¿El pedido viene REBOTADO del otro lado? Con el `?rebote=` PRESENTE, sea viejo o nuevo: nada de comparar la hora (20/11/2026, el
 * Cerebro, en producción: el Router Cache del navegador servía un redirect guardado con un rebote de hacía minutos, y /onboarding,
 * que lo miraba por frescura, no lo reconocía y devolvía a la app). Una URL vieja con `?rebote=` que se recarga muestra «ya está
 * listo» y entra con un toque: eso es lo seguro.
 */
export function vieneRebotado(valor: string | string[] | null | undefined): boolean {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return !!v && /^\d{1,11}$/.test(v);
}

/** La ruta con su marca de rebote (pisa la que traiga). */
export function conRebote(ruta: string, ahoraMs: number): string {
  const [sinHash, hash] = ruta.split('#');
  const [camino, query = ''] = sinHash.split('?');
  const qs = new URLSearchParams(query);
  qs.set(PARAM_REBOTE, marcaDeRebote(ahoraMs));
  return `${camino}?${qs.toString()}${hash ? `#${hash}` : ''}`;
}

/**
 * LA GUARDA DE LA APP: ¿manda al onboarding? Sólo con el estado LEÍDO y sin terminar, y si el pedido no viene rebotado del onboarding
 * (que lo vio terminado: las dos lecturas no coinciden, y volver ahí es el bucle).
 */
export function guardiaMandaAlOnboarding(o: { lectura: 'ok' | 'fallo'; terminado: boolean; rebotado: boolean }): boolean {
  if (o.lectura === 'fallo') return false;
  if (o.rebotado) return false;
  return !o.terminado;
}

/** /ONBOARDING, CON EL ONBOARDING TERMINADO: ¿devuelve a la app? No si el pedido acaba de rebotar de la guarda: muestra el «ya está listo». */
export function onboardingDevuelveALaApp(o: { rebotado: boolean }): boolean {
  return !o.rebotado;
}
