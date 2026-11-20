// =============================================================================
// EL IDA Y VUELTA ENTRE LA APP Y EL ONBOARDING, IMPOSIBLE POR CONSTRUCCIÓN (20/11/2026)
// =============================================================================
// El Cerebro, en producción (2885104c9), después de «Reiniciar onboarding» en el ws 3: al tocar «Entrar a MaKo», más de 1000 pedidos
// en segundos alternando /second-brain?_rsc y /onboarding?_rsc, la pantalla en blanco, durante ~7 minutos (18:43 a 18:50 UTC), y se
// fue solo. Las dos puntas decidían con lecturas distintas: la guarda de la app (`guardOnboarding`, lib/tab-access.ts) vio el
// onboarding SIN terminar y mandó a /onboarding; /onboarding lo vio terminado y devolvió a la app. La guarda leía TOLERANTE: un error
// de Supabase es `null`, y `null` es el estado inicial, «pending». No hubo forma de leer los logs de esos minutos (el endpoint de
// runtime-logs de Vercel es un stream), así que no se arregla la causa: se hace IMPOSIBLE el ida y vuelta, sea cual sea.
//
//   · La guarda lee ESTRICTO: si no pudo leer, NO manda al onboarding (deja pasar y lo anota en el log).
//   · Cada redirección entre las dos lleva `?rebote=<segundos>`. Un pedido que acaba de rebotar del otro lado (hasta
//     `SEGUNDOS_REBOTE`) no vuelve: la guarda lo deja pasar; /onboarding, con el onboarding terminado, muestra «Tu onboarding ya está
//     listo» con «Entrar a MaKo» (un toque de la persona, nunca otra redirección).
//
// Puro (sin servidor): lo usan lib/onboarding-state.ts (`mandarAlOnboarding`), lib/tab-access.ts y app/onboarding/page.tsx, y lo
// fija tests/onboarding-sin-ida-y-vuelta.test.ts.
// =============================================================================

export const PARAM_REBOTE = 'rebote';
/** Cuánto vale un rebote: lo que tarda un ida y vuelta, con margen. Pasado esto, la URL vieja con `?rebote=` es una URL más. */
export const SEGUNDOS_REBOTE = 30;

/** El valor del parámetro: la hora del servidor, en segundos. */
export const marcaDeRebote = (ahoraMs: number): string => String(Math.floor(ahoraMs / 1000));

/** ¿El pedido acaba de rebotar del otro lado? Un valor que no es una hora, o viejo, o del futuro (más de 5 s), no cuenta. */
export function reboteReciente(valor: string | string[] | null | undefined, ahoraMs: number): boolean {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v || !/^\d{9,11}$/.test(v)) return false;
  const dif = ahoraMs / 1000 - Number(v);
  return dif >= -5 && dif <= SEGUNDOS_REBOTE;
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
export function guardiaMandaAlOnboarding(o: { lectura: 'ok' | 'fallo'; terminado: boolean; reboteReciente: boolean }): boolean {
  if (o.lectura === 'fallo') return false;
  if (o.reboteReciente) return false;
  return !o.terminado;
}

/** /ONBOARDING, CON EL ONBOARDING TERMINADO: ¿devuelve a la app? No si el pedido acaba de rebotar de la guarda: muestra el «ya está listo». */
export function onboardingDevuelveALaApp(o: { reboteReciente: boolean }): boolean {
  return !o.reboteReciente;
}
