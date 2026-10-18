// =============================================================================
// fetch-seguro — un `fetch` para direcciones que escribe un CLIENTE (o su agente)
// =============================================================================
// El análisis de una landing (`analizarLanding`, lib/landing-analisis.ts) bajaba la página con
// `fetch` + `redirect: 'follow'`: se validaba —a lo sumo— la primera dirección, y cada redirect se
// seguía sin mirarlo. Una landing pública que redirige a 169.254.169.254 (la metadata de la nube)
// o a 127.0.0.1 se leía entera desde nuestro servidor. Y desde el 16/09 lo puede disparar la API de
// MaKo (`detectar_piezas_landing`), así que «lo dispara un usuario con la tab» dejó de ser baranda.
//
// Esto es la misma bajada que ya usa «Sumar una web» del Archivero (lib/archivero-bajada.ts):
// `validarDestino` (lib/landing-fetch.ts: esquema http(s) y TODAS las IPs públicas) en CADA salto,
// el pedido a la IP ya validada (sin DNS rebinding), techo de 3 MB mientras se lee y plazo por
// salto. Acepta cualquier content-type a propósito: el análisis de una SPA lee los chunks
// `application/javascript`, que `htmlDePagina` rechaza (por eso no se usó ésa).
//
// La firma es la de `fetch` (lo que el analizador ya recibía por parámetro), con lo que el
// analizador no cambia y los tests siguen pasándole uno de mentira.
//
// ⚠️ NO lo importes desde nada que llegue a un componente `'use client'`: usa node:https.
// =============================================================================

import 'server-only';
import { bajarWebSegura, pedirClavado } from './archivero-bajada';
import { validarDestino } from './landing-fetch';
import type { Buscador } from './landing-analisis';

/** Un status que `new Response` acepta (200-599) y con el cuerpo que admite. */
function respuesta(status: number, cuerpo: Buffer): Response {
  const s = status >= 200 && status <= 599 ? status : 502;
  const sinCuerpo = s === 204 || s === 205 || s === 304;
  return new Response(sinCuerpo ? null : new Uint8Array(cuerpo), { status: s });
}

export const fetchSeguro: Buscador = async (url, init) => {
  const ua = new Headers(init?.headers).get('user-agent') ?? undefined;
  const bajada = bajarWebSegura(url, { validar: validarDestino, pedir: (u, ips) => pedirClavado(u, ips, ua) });
  const signal = init?.signal;
  if (!signal) {
    const r = await bajada;
    return respuesta(r.status, r.cuerpo);
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const r = await new Promise<Awaited<typeof bajada>>((resolve, reject) => {
    const cortar = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', cortar, { once: true });
    bajada.then(
      (v) => { signal.removeEventListener('abort', cortar); resolve(v); },
      (e: unknown) => { signal.removeEventListener('abort', cortar); reject(e); },
    );
  });
  return respuesta(r.status, r.cuerpo);
};
