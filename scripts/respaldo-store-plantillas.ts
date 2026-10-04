// =============================================================================
// respaldo-store-plantillas — guarda y restaura el store de /mensajes de un workspace
// =============================================================================
// ⚠️ EXISTE PORQUE VERIFICAR UNA PANTALLA ESCRIBE. El entorno local apunta a la base
// de PRODUCCIÓN, así que recorrer /mensajes con el mouse le deja el tablero cambiado a
// un cliente real. La regla de la casa lo tiene medido con nombre y fecha: el
// 02/09/2026 un recorrido de verificación le guardó a un cliente de Baja California el
// acento argentino de la máquina del que verificaba.
//
//   guardar:    NODE_OPTIONS="--conditions=react-server" npx tsx scripts/respaldo-store-plantillas.ts guardar <ws>
//   restaurar:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/respaldo-store-plantillas.ts restaurar <ws>
//
// ⚠️ SE RESPALDA LA ENTRADA ENTERA, Y ANTES ERA SÓLO `posiciones` (de ahí el nombre
// viejo, `respaldo-posiciones-plantillas.ts`). Cambió el 04/10/2026, cuando el lienzo
// pasó a poder AGREGAR pasos: el ＋ escribe `flujo`, su menú de canal escribe `canales`
// y escribir en el editor escribe `borrador`. Un respaldo que cubre un campo de cuatro
// es peor que ninguno — deja restaurar con confianza. La regla de la casa es que el
// respaldo se hace por lo que las ACTIONS tocan, y lo que tocan creció.
//
// ⚠️ Y SI LA ENTRADA NO EXISTÍA ANTES, RESTAURAR ES BORRARLA — no dejarla con lo que
// puso el recorrido. Por eso el respaldo distingue «no había entrada» de «había ésta».
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const MODO = process.argv[2];
const WS = Number(process.argv[3] || 1);
const ARCHIVO = resolve(process.cwd(), `.respaldo-store-plantillas-ws${WS}.json`);
const CLAVE = 'mako.plantillas.store';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function leerStore(): Promise<Record<string, unknown> | null> {
  const r = await sql`select value from app_settings where workspace_id = ${WS} and key = ${CLAVE} limit 1`;
  if (!r.length) return null;
  const v = (r[0] as { value: unknown }).value;
  return typeof v === 'string' ? (JSON.parse(v) as Record<string, unknown>) : (v as Record<string, unknown>);
}

/**
 * ⚠️ LA PREGUNTA QUE EL LECTOR PROPIO NO PUEDE CONTESTAR BIEN. `leerStore` hace
 * `JSON.parse` si el valor vino como string, así que deshace exactamente la capa de más
 * que produce un `JSON.stringify(obj)::jsonb` — o sea que releer con él da VERDE sobre
 * una fila corrompida. Pasó el 04/10/2026 y por eso esto está acá: un id de plantilla
 * nunca es `"0"`, y los índices de un string sí.
 */
function sano(store: Record<string, unknown> | null): boolean {
  const ks = Object.keys(store ?? {});
  return !ks.length || ks[0] !== '0';
}

async function main() {
  if (MODO === 'guardar') {
    const store = await leerStore();
    if (!sano(store)) { console.error('⛔ el store de hoy ya está corrompido: corré scripts/reparar-store-plantillas.ts'); await sql.end(); process.exit(1); }
    writeFileSync(ARCHIVO, JSON.stringify({ ws: WS, habiaStore: store !== null, store: store ?? {} }, null, 1), 'utf8');
    console.log(`✅ respaldo de ws${WS}: ${Object.keys(store ?? {}).length} entradas → ${ARCHIVO}`);
    await sql.end();
    return;
  }

  if (MODO === 'restaurar') {
    if (!existsSync(ARCHIVO)) { console.error(`⛔ no hay respaldo en ${ARCHIVO}`); process.exit(1); }
    const back = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as {
      ws: number; habiaStore: boolean; store: Record<string, unknown>;
    };
    const ahora = await leerStore();
    if (ahora === null) { console.log('la clave no existe hoy: no hay nada que restaurar'); await sql.end(); return; }

    // Se compara entrada por entrada para poder DECIR qué cambió el recorrido. Lo que
    // se escribe es el respaldo entero: una entrada que el recorrido CREÓ y que antes
    // no existía tiene que desaparecer, no quedarse con lo que puso la verificación.
    const ids = new Set([...Object.keys(ahora), ...Object.keys(back.store)]);
    const distintas = [...ids].filter((id) => JSON.stringify(ahora[id] ?? null) !== JSON.stringify(back.store[id] ?? null));
    const nacidas = distintas.filter((id) => !Object.prototype.hasOwnProperty.call(back.store, id));
    if (!distintas.length) { console.log(`✓ ws${WS}: nada cambió, no hace falta restaurar`); await sql.end(); return; }

    // ⚠️ VA EL OBJETO, NO `JSON.stringify(obj)::jsonb`. El driver ya serializa para
    // jsonb: pasarle el texto guarda un jsonb que CONTIENE UN STRING con el JSON
    // adentro, y entonces `Object.keys(store)` devuelve 0,1,2,3… —los índices del
    // string— en vez de los ids. No da error, el UPDATE contesta ok, y la pantalla
    // sigue dibujando las plantillas porque el catálogo vive en el código: lo que
    // desaparece en silencio son los OVERRIDES del cliente. Pasó acá el 04/10/2026 y
    // lo destraba scripts/reparar-store-plantillas.ts.
    await sql`update app_settings set value = ${sql.json(back.store as never)}, updated_at = now() where workspace_id = ${WS} and key = ${CLAVE}`;
    // Se verifica el valor LEÍDO de vuelta, no el que se mandó.
    const releido = await leerStore();
    if (!sano(releido)) { console.error('⛔ el store quedó corrompido al restaurar: scripts/reparar-store-plantillas.ts'); await sql.end(); process.exit(1); }
    const quedo = [...ids].filter((id) => JSON.stringify((releido ?? {})[id] ?? null) !== JSON.stringify(back.store[id] ?? null));
    console.log(`✅ ws${WS}: ${distintas.length} entrada(s) devueltas a su valor (${nacidas.length} que el recorrido había CREADO y no existían antes): ${distintas.join(', ')}`);
    if (quedo.length) console.error(`⛔ quedaron ${quedo.length} sin volver a su valor: ${quedo.join(', ')}`);
    await sql.end();
    if (quedo.length) process.exit(1);
    return;
  }

  console.error('uso: respaldo-store-plantillas.ts <guardar|restaurar> <ws>');
  await sql.end();
  process.exit(1);
}

void main();
