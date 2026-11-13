// =============================================================================
// pedir-avisos-reglas — qué le pide <PedirAvisos> a quien entra a MaKo (puro)
// =============================================================================
// Martín, 13/11/2026: «El número de MaKo fue baneado otra vez, entonces vamos a implementar todo directamente dentro de MaKo y vamos a dejar los grupos por ahora».
// Los avisos ya caen en el hilo del grupo de la app y salen como push (lib/avisos.ts, lib/grupo-app.ts), pero `push_suscripciones` tenía 0 filas: el único pedido
// era el paso del onboarding (sólo para quien lo hace después del 4/11) y el recordatorio de /general (un QR, volver a entrar en el teléfono). Nadie llegaba.
// Ahora se pide AL ENTRAR, en cualquier pantalla y en cualquier dispositivo, hasta que este navegador los tenga.
//
// ⚠️ NO ES UN MODAL (regla de Martín: nada se abre solo al entrar): es una tarjeta que no bloquea, en la esquina de avisos o, en el teléfono, sobre la barra de abajo.
// ⚠️ «AHORA NO» POSPONE UN DÍA, no para siempre: el aviso que no llega es el que cuesta un cliente.
// ⚠️ CON EL PERMISO BLOQUEADO O SIN SOPORTE NO SE PIDE NADA: no hay botón que pueda hacer algo, y un cartel que no se puede cumplir se ignora para siempre.
// =============================================================================

import type { EstadoAvisos } from './push-cliente';

export type PedidoAvisos = 'nada' | 'activar' | 'instalar';

/** Cuánto calla la tarjeta después de «Ahora no». */
export const POSPONER_MS = 24 * 3600_000;
/** Dónde guarda el navegador hasta cuándo calla (localStorage: es de ESTE dispositivo, como el permiso). */
export const CLAVE_POSPUESTO = 'mako:pedir-avisos:hasta';

/**
 * Las pantallas donde no se pide: las que ya tienen su propio pedido (el paso del onboarding, el interruptor de la cuenta del teléfono, la página del link único)
 * y las de antes de entrar. `ruta` es la INTERNA (`/m/cuenta` en el teléfono, aunque la URL diga otra cosa).
 */
const SIN_PEDIDO = [/^\/onboarding(\/|$)/, /^\/login(\/|$)/, /^\/app\/?$/, /^\/m\/cuenta(\/|$)/, /^\/cuenta-pausada(\/|$)/];
export const rutaSinPedido = (ruta: string | null | undefined): boolean => SIN_PEDIDO.some((re) => re.test(ruta ?? ''));

/** ¿Sigue callada? Un valor ilegible o vencido no calla nada. */
export function pospuesto(hasta: string | null | undefined, ahora: number): boolean {
  const n = Number(hasta);
  return Number.isFinite(n) && n > ahora;
}

/** Qué pide la tarjeta. `estado` null: todavía no se leyó el del navegador. */
export function quePedir(o: { estado: EstadoAvisos | null; ruta: string | null | undefined; hasta: string | null | undefined; ahora: number }): PedidoAvisos {
  if (!o.estado || rutaSinPedido(o.ruta) || pospuesto(o.hasta, o.ahora)) return 'nada';
  if (o.estado === 'apagado') return 'activar';
  if (o.estado === 'instalar-primero') return 'instalar';
  return 'nada';
}

export const TEXTOS_PEDIR_AVISOS = {
  titulo: 'Activa los avisos',
  linea: 'Lo que pasa en tu negocio, al instante.',
  activar: 'Activar',
  activando: 'Activando…',
  luego: 'Ahora no',
  entendido: 'Entendido',
  instalarLinea: 'Agrega MaKo a tu inicio para recibirlos.',
  instalar: 'Ver cómo',
  listos: 'Avisos activados',
} as const;
