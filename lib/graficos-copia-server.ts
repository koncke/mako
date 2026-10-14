// =============================================================================
// graficos-copia-server — guardar y leer un dashboard copiado detrás de su token (tabla `dashboard_copias`, mig 0268)
// =============================================================================
// Las reglas de qué viaja viven en lib/graficos-copia.ts (puro, con test); acá sólo la tabla. Es el molde de
// lib/flujo-copia-negocio.ts (`flujo_copias`, mig 0265): la tabla NO es de un inquilino (la lee cualquier negocio que
// tenga el token), así que va con el cliente crudo (`getSupabaseServer`) y su columna es `workspace_origen`, no
// `workspace_id`. Quien llama ya comprobó que es el admin de SU negocio (app/api/graficos/copia/route.ts).
//   · Sin la tabla (la migración todavía no se aplicó), `FaltaTablaDashError`: la ruta contesta 503 diciendo cuál falta.
//     Un error que NO es «falta la tabla» tira tal cual.

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { LARGO_TOKEN_COPIA } from './token-copia';
import { hojaDeCopia, tokenDashDeBytes, tokenDashDeTexto } from './graficos-copia';
import type { Hoja } from './graficos-catalogo';

const TABLA = 'dashboard_copias';
export const FALTA_TABLA_DASH = 'Falta la migración 0268 (dashboard_copias).';
export class FaltaTablaDashError extends Error {
  constructor() { super(FALTA_TABLA_DASH); this.name = 'FaltaTablaDashError'; }
}
/** La TABLA que falta (PGRST205 de PostgREST, 42P01 de Postgres), no otra cosa. */
const faltaLaTabla = (e: { code?: string } | null | undefined): boolean => !!e && (e.code === 'PGRST205' || e.code === '42P01');

/**
 * Guarda la hoja (ya pasada por `hojaParaCopiar`) y devuelve su token. Cada copia es una fila nueva. Un choque de token
 * (23505, 1 en 2^50) prueba otro; tres seguidos es otra cosa y tira.
 */
export async function guardarCopiaDash(hoja: Hoja, o: { ws: number; vaciados: number }): Promise<string> {
  const db = getSupabaseServer();
  for (let intento = 0; intento < 3; intento++) {
    const token = tokenDashDeBytes(randomBytes(LARGO_TOKEN_COPIA));
    const { error } = await db.from(TABLA).insert({
      token, workspace_origen: o.ws, nombre: hoja.nombre.slice(0, 60), hoja, vaciados: Math.max(0, Math.round(o.vaciados)),
    });
    if (!error) return token;
    if (faltaLaTabla(error)) throw new FaltaTablaDashError();
    if (error.code !== '23505') throw new Error(`guardarCopiaDash: ${error.message}`);
  }
  throw new Error('guardarCopiaDash: tres tokens repetidos seguidos');
}

/**
 * La copia detrás de un token: la hoja (saneada otra vez: lo guardado pasa por la misma vara), de qué negocio salió y
 * cuántos filtros sobre personas se vaciaron al copiarla. null = el token no existe (o lo guardado ya no es una hoja).
 */
export async function copiaDashDeToken(texto: unknown): Promise<{ hoja: Hoja; wsOrigen: number; vaciados: number } | null> {
  const token = tokenDashDeTexto(texto);
  if (!token) return null;
  const { data, error } = await getSupabaseServer().from(TABLA).select('hoja, workspace_origen, vaciados').eq('token', token).maybeSingle();
  if (error) {
    if (faltaLaTabla(error)) throw new FaltaTablaDashError();
    throw new Error(`copiaDashDeToken: ${error.message}`);
  }
  const fila = data as { hoja?: unknown; workspace_origen?: unknown; vaciados?: unknown } | null;
  const hoja = fila ? hojaDeCopia(fila.hoja) : null;
  if (!fila || !hoja) return null;
  return { hoja, wsOrigen: Number(fila.workspace_origen), vaciados: Number(fila.vaciados) || 0 };
}
