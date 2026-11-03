import 'server-only';

// =============================================================================
// spy-otras-redes — buscar sus otras redes por Google (ítems 10/11 de Spy, 3/11/2026)
// =============================================================================
// La red. Lo que se lee y por qué está en `./spy-otras-redes-reglas.ts`, con el costo medido.
//
// ⚠️ ESTE ARCHIVO NO ESCRIBE EN LA BASE, Y ES A PROPÓSITO: devuelve CANDIDATOS. Martín pidió
// validar («¿este es el YouTube de esta persona?») porque resolver por búsqueda ya nos trajo a OTRA
// persona. Lo único que guarda es el «sí» de la persona en la pantalla. Un test
// (`tests/spy-otras-redes.test.ts`) se pone ROJO si este archivo empieza a tocar la base.
//
// ⚠️ LO PAGA EL NEGOCIO, con SU clave de Spy (`APIFY_CLAVE_DE_SPY`), igual que la lectura de
// Instagram de la tab. Sin clave no se busca: la plataforma no le paga búsquedas a nadie.
// =============================================================================

import { credDelCliente } from './credenciales';
import { APIFY_CLAVE_DE_SPY } from './instagram-perfil';
import {
  APIFY_ACTOR_REDES, TECHO_USD_POR_CORRIDA_REDES, TOPE_BUSQUEDAS_REDES_POR_DIA,
  candidatosDeLaRespuesta, consultaDeRedes, type CandidatoRed, type RedesQueYaTiene,
} from './spy-otras-redes-reglas';

/** Medido en 6 y 11 s. */
const TOPE_MS = 45_000;

// El mismo molde que el tope de lecturas (`apifyHoy`, lib/instagram-perfil-server.ts): por negocio
// y por día, en memoria de la instancia. El techo duro de plata por corrida lo pone Apify.
const g = globalThis as unknown as { __spyRedesHoy?: Map<string, number> };
const redesHoy = (g.__spyRedesHoy ??= new Map<string, number>());
const hoy = () => new Date().toISOString().slice(0, 10);

export type BusquedaRedes = { ok: true; candidatos: CandidatoRed[] } | { ok: false; error: string };

export async function buscarOtrasRedes(ws: number, c: RedesQueYaTiene & { nombre: string }): Promise<BusquedaRedes> {
  if (c.instagram && c.youtube_id && c.tiktok) return { ok: true, candidatos: [] };
  const consulta = consultaDeRedes(c);
  if (!consulta) return { ok: true, candidatos: [] };
  const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
  if (!token) return { ok: false, error: 'Para buscar sus otras redes hace falta tu clave de Apify (Integraciones).' };
  const cuenta = `${ws}|${hoy()}`;
  const usadas = redesHoy.get(cuenta) ?? 0;
  if (usadas >= TOPE_BUSQUEDAS_REDES_POR_DIA) {
    return { ok: false, error: `Ya buscaste ${TOPE_BUSQUEDAS_REDES_POR_DIA} veces hoy. Mañana se puede de nuevo, o pega el enlace a mano.` };
  }
  redesHoy.set(cuenta, usadas + 1);
  try {
    const params = new URLSearchParams({ maxTotalChargeUsd: String(TECHO_USD_POR_CORRIDA_REDES) });
    const r = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_REDES}/run-sync-get-dataset-items?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // UNA página: es lo que se midió, y las redes de la persona salen arriba o no salen.
      body: JSON.stringify({ queries: consulta, resultsPerPage: 10, maxPagesPerQuery: 1, mobileResults: false, saveHtml: false }),
      signal: AbortSignal.timeout(TOPE_MS),
      cache: 'no-store',
    });
    if (r.status < 200 || r.status >= 300) {
      console.error(`[spy-otras-redes] HTTP ${r.status} buscando «${consulta}»`);
      return { ok: false, error: 'No pude buscar sus otras redes ahora. Prueba en un rato.' };
    }
    return { ok: true, candidatos: candidatosDeLaRespuesta(await r.json().catch(() => null), c) };
  } catch (e) {
    console.error(`[spy-otras-redes] «${consulta}»: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude buscar sus otras redes ahora. Prueba en un rato.' };
  }
}
