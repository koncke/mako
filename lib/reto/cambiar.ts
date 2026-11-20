// =============================================================================
// CAMBIAR `reto.estado` SIN PISAR LO QUE ESCRIBIÓ OTRO (20/11/2026)
// =============================================================================
// Lo encontró el chat de WhatsApp: /api/reto (`conLoLeido` y cada acción) y el uso de Pro (lib/reto/pro-del-reto-server.ts) leían el
// reto y lo reescribían ENTERO con setSetting. Si en el medio llegaba la hora por WhatsApp (lib/reto/respuestas.ts, que sí escribe con
// compare-and-set), la escritura de acá la pisaba con la hora vieja. Ahora todos cambian con compare-and-set sobre lo leído: si otro
// escribió en el medio, se relee y se vuelve a aplicar el cambio sobre lo nuevo (hasta 3 veces). Lo prueba tests/reto-dias.test.ts
// reproduciendo la carrera.
// =============================================================================
import { leerEstado, type EstadoReto } from './dias';

export type IoReto = {
  /** Lo guardado, crudo (null = no hay). */
  leer: () => Promise<string | null>;
  /** Escribe `nuevo` sólo si lo guardado sigue siendo `esperado`; dice si ganó. */
  cas: (esperado: string | null, nuevo: string) => Promise<boolean>;
};

/**
 * Aplica `f` sobre el reto guardado y lo escribe con compare-and-set. `f` recibe SIEMPRE lo último leído. Devuelve lo escrito, o
 * null si no hay reto o no se pudo escribir en `intentos` vueltas.
 */
export async function cambiarReto(io: IoReto, f: (e: EstadoReto) => EstadoReto, intentos = 3): Promise<EstadoReto | null> {
  for (let i = 0; i < intentos; i++) {
    const crudo = await io.leer();
    const e = leerEstado(crudo);
    if (!e) return null;
    const r = f(e);
    if (await io.cas(crudo, JSON.stringify(r))) return r;
  }
  return null;
}
