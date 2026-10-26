// =============================================================================
// grabadores/http — el pedido a la API de un grabador, con la misma regla que Fathom (server)
// =============================================================================
// Reintenta 429 / 5xx / la red con backoff y, si no cede, tira `GrabadorSinRespuestaError` (pasajero: quien lee la
// reintenta, no la cierra como vacía). Un 4xx es un `Error` común «<Grabador> <código> en <ruta>: …», el mismo texto que
// tira Fathom (lib/fathom-api.ts): lo lee `clasificarFalloFathom` (lib/closing-entrega-contrato.ts) para decidir si
// gasta un intento. `esAuth` deja que cada grabador diga qué es «la clave no sirve» aunque venga con otro código
// (Fireflies contesta 500 a una clave mala: medido el 26/10/2026; reintentarlo sería reintentar para siempre).
// =============================================================================

import 'server-only';
import { GrabadorSinRespuestaError } from './errores';
import { nombreDeGrabador } from './catalogo';
import type { GrabadorId } from './reunion';

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PedidoGrabador = {
  grabador: GrabadorId;
  url: string;
  init?: RequestInit;
  /** Cuántas veces intentar (default 4, como Fathom). */
  intentos?: number;
  /** ¿Esta respuesta es «la clave no sirve», aunque el código no sea 401? Se tira como 401, sin reintentar. */
  esAuth?: (status: number, cuerpo: unknown) => boolean;
  /** Con `false` devuelve el texto crudo (un VTT de Zoom). */
  json?: boolean;
};

/** El cuerpo de la respuesta (JSON o texto). Ver el encabezado para cómo falla. */
export async function pedirAlGrabador<T = unknown>(p: PedidoGrabador): Promise<T> {
  const nombre = nombreDeGrabador(p.grabador);
  const ruta = (() => { try { return new URL(p.url).pathname; } catch { return p.url; } })();
  const intentos = p.intentos ?? 4;
  let ultimo = '';
  for (let i = 0; i < intentos; i++) {
    const espera = () => (i < intentos - 1 ? dormir(700 * (i + 1)) : Promise.resolve());
    let res: Response;
    try {
      res = await fetch(p.url, { ...p.init, cache: 'no-store', signal: p.init?.signal ?? AbortSignal.timeout(20_000) });
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e);
      await espera();
      continue;
    }
    const texto = await res.text().catch(() => '');
    let cuerpo: unknown = texto;
    if (p.json !== false) { try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; } }
    if (p.esAuth?.(res.status, cuerpo)) throw new Error(`${nombre} 401 en ${ruta}: la clave no sirve (${texto.slice(0, 160)})`);
    if (res.status === 429 || res.status >= 500) {
      ultimo = `${nombre} ${res.status}`;
      await espera();
      continue;
    }
    if (!res.ok) throw new Error(`${nombre} ${res.status} en ${ruta}: ${texto.slice(0, 200)}`);
    return cuerpo as T;
  }
  throw new GrabadorSinRespuestaError(p.grabador, `${nombre} sin respuesta en ${ruta} tras ${intentos} intentos: ${ultimo}`);
}
