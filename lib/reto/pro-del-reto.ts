// =============================================================================
// LO DE PRO QUE EL RETO ABRE UNA VEZ EN LA PRUEBA (20/11/2026, auditoría R57-03; decisión del Cerebro: la A)
// =============================================================================
// En una prueba de MaKo Essential, los días 4 a 6 terminaban en «Pasar a Pro»: replicar una página (día 4), el carrusel con IA y
// replicar el guion (día 5) y el personaje con IA (día 6) son de Pro (lib/topes-plan.ts, FUNCIONES_SOLO_PRO). Lo decidido:
//   1. durante la prueba, el reto abre UNA vez cada una, con el día que la pide ya abierto, y la tarjeta lo dice sin vender
//      («Esto es de Pro: en tu prueba lo usas una vez»);
//   2. la segunda vez, el candado de Essential de siempre;
//   3. lo que gastó cada uso queda anotado: `reto.estado.pro[función] = { desde, hasta }`. El gasto en MaKo Tokens está en el
//      libro de movimientos (`gastarMt`, lib/mako-tokens-medidor.ts: por negocio y por feature) entre `desde` y `hasta`. El clip del
//      día 6 por ApiMart lo hace y lo anota la sesión de AI Avatar.
// «Una vez» es UN uso: una réplica llama al candado varias veces (analizar, generar, guardar), así que el uso dura una ventana
// (VENTANA_MS) desde que se abrió. Pasada la ventana, candado.
// Este archivo es PURO (lo prueba tests/reto-dias.test.ts); la lectura y la escritura están en ./pro-del-reto-server.ts.
// =============================================================================
import { diaAbierto, type EstadoReto } from './dias';

export const PRO_DEL_RETO = { 'replicar-landing': 4, 'ia-editores': 5, 'replicar-guion': 5, 'ai-avatar': 6 } as const;
export type ProDelReto = keyof typeof PRO_DEL_RETO;
export const VENTANA_MS = 2 * 3_600_000;
export type UsoPro = { desde: string; hasta: string };

/** Las tareas del reto que piden cada función (para la nota de la tarjeta). */
export const TAREA_PRO: Readonly<Record<string, ProDelReto>> = { '4:web': 'replicar-landing', '5:carrusel': 'ia-editores', '5:guion': 'replicar-guion', '6:personaje': 'ai-avatar', '6:clip': 'ai-avatar' };
export const NOTA_PRO_UNA_VEZ = 'Esto es de Pro: en tu prueba lo usas una vez.';

/**
 * ¿El reto le abre esta función ahora? `nuevo`: el uso que hay que anotar (la primera vez), o null.
 * Sólo con el reto empezado, en prueba, con el día que la pide abierto, y la primera vez (o dentro de la ventana de ese uso).
 */
export function decidirProDelReto(e: EstadoReto | null, f: ProDelReto, o: { enPrueba: boolean; ahora: number }): { abre: boolean; nuevo: UsoPro | null } {
  if (!e || !o.enPrueba || diaAbierto(e, o.ahora) < PRO_DEL_RETO[f]) return { abre: false, nuevo: null };
  const uso = e.pro?.[f];
  if (uso) return { abre: o.ahora < Date.parse(uso.hasta), nuevo: null };
  return { abre: true, nuevo: { desde: new Date(o.ahora).toISOString(), hasta: new Date(o.ahora + VENTANA_MS).toISOString() } };
}

/**
 * Lo que el reto le abre AHORA, sin anotar ningún uso: lo que todavía no usó (con su día abierto) y lo que está dentro de la
 * ventana de su uso. Es para la PANTALLA (20/11, R57-03): /api/auth/me lo manda como `proDelReto` y `useSoloPro`
 * (app/_components/solo-pro.ts) no pone el candado de Essential en esas funciones. La misma regla que el servidor.
 */
export function queAbreElReto(e: EstadoReto | null, o: { enPrueba: boolean; ahora: number }): ProDelReto[] {
  return (Object.keys(PRO_DEL_RETO) as ProDelReto[]).filter((f) => decidirProDelReto(e, f, o).abre);
}
