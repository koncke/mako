/**
 * UN SONDEO QUE SÓLO PIDE CON LA PESTAÑA A LA VISTA (12/11/2026).
 *
 * El contador de WhatsApp de la barra (`/api/whatsapp/evolution/mensajes?resumen=1`, NotificationsProvider) pedía cada 12 s
 * con un `setInterval` pelado: también con la pestaña oculta, en cada pestaña abierta y sin esperar a que el pedido anterior
 * volviera. El provider vive en el layout, así que cada pestaña olvidada eran 300 funciones de Vercel por hora, pagas, para
 * un contador que nadie miraba (el chat «Probar Image» contó 1.300 pedidos).
 *
 * Las reglas, en un solo lugar para que un sondeo nuevo no las vuelva a armar a mano:
 *   · pide al arrancar, y después cada `cadaMs`;
 *   · con la pestaña oculta no pide nada: ni el reloj ni el arranque (una pestaña abierta en segundo plano espera);
 *   · al volver a la pestaña pide en el acto, salvo que el último pedido tenga menos de `alVolverMs` (ir y venir rápido
 *     entre pestañas no dispara una ráfaga);
 *   · nunca dos a la vez: si el anterior no volvió, la vuelta se saltea;
 *   · lo que devuelve lo apaga todo (el reloj y el oyente de la pestaña).
 *
 * Es pura (el documento y el reloj entran por parámetro): lo prueba tests/sondeo-a-la-vista.test.ts sin navegador.
 */

export type DocConVisibilidad = {
  readonly visibilityState: string;
  addEventListener(tipo: 'visibilitychange', f: () => void): void;
  removeEventListener(tipo: 'visibilitychange', f: () => void): void;
};

export type Reloj = {
  ahora(): number;
  cada(f: () => void, ms: number): unknown;
  parar(id: unknown): void;
};

const RELOJ_DEL_NAVEGADOR: Reloj = {
  ahora: () => Date.now(),
  cada: (f, ms) => setInterval(f, ms),
  parar: (id) => clearInterval(id as ReturnType<typeof setInterval>),
};

/** El contador de WhatsApp de la barra: medio minuto alcanza para un número y un aviso; el chat abierto tiene su propio sondeo. */
export const RESUMEN_WA_CADA_MS = 30_000;

/** Margen del reloj: un `setInterval` puede llegar unos milisegundos antes de la cuenta y no tiene que perder la vuelta. */
const MARGEN = 0.9;

export function sondearALaVista(
  pedir: () => unknown,
  o: { cadaMs: number; alVolverMs?: number; doc?: DocConVisibilidad; reloj?: Reloj },
): () => void {
  const doc = o.doc ?? document;
  const reloj = o.reloj ?? RELOJ_DEL_NAVEGADOR;
  const alVolverMs = o.alVolverMs ?? Math.min(10_000, o.cadaMs);
  let vivo = true;
  let enVuelo = false;
  let ultimo: number | null = null;

  const intentar = (minimoMs: number) => {
    if (!vivo || enVuelo || doc.visibilityState === 'hidden') return;
    const ahora = reloj.ahora();
    if (ultimo != null && ahora - ultimo < minimoMs) return;
    ultimo = ahora;
    enVuelo = true;
    let r: unknown;
    try { r = pedir(); } catch { r = null; }
    Promise.resolve(r).catch(() => {}).finally(() => { enVuelo = false; });
  };

  const alCambiar = () => { if (doc.visibilityState === 'visible') intentar(alVolverMs); };
  intentar(0);
  const id = reloj.cada(() => intentar(o.cadaMs * MARGEN), o.cadaMs);
  doc.addEventListener('visibilitychange', alCambiar);
  return () => {
    vivo = false;
    reloj.parar(id);
    doc.removeEventListener('visibilitychange', alCambiar);
  };
}
