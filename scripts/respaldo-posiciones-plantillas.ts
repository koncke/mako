// =============================================================================
// respaldo-posiciones-plantillas — guarda y restaura las POSICIONES del lienzo
// =============================================================================
// ⚠️ EXISTE PORQUE VERIFICAR UNA PANTALLA ESCRIBE. Arrastrar una tarjeta del lienzo
// de /mensajes llama a `action: 'posiciones'`, que escribe en el store
// `mako.plantillas.store` del workspace — y el entorno local apunta a la base de
// PRODUCCIÓN, así que una verificación con el mouse le deja el tablero movido a un
// cliente real. La regla de la casa lo tiene medido con nombre y fecha: el 02/09/2026
// un recorrido de verificación le guardó a un cliente de Baja California el acento
// argentino de la máquina del que verificaba.
//
// El respaldo es de LO QUE LA ACTION TOCA, no del estado que se está mirando: acá eso
// es la clave `posiciones` de cada entrada del store, y nada más.
//
//   guardar:    NODE_OPTIONS="--conditions=react-server" npx tsx scripts/respaldo-posiciones-plantillas.ts guardar <ws>
//   restaurar:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/respaldo-posiciones-plantillas.ts restaurar <ws>
//
// ⚠️ Y SI LA CLAVE NO EXISTÍA ANTES, RESTAURAR ES BORRARLA — no dejarla con lo que puso
// el recorrido. Por eso el respaldo distingue «no había posiciones» de «había éstas».
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const MODO = process.argv[2];
const WS = Number(process.argv[3] || 1);
const ARCHIVO = resolve(process.cwd(), `.respaldo-posiciones-ws${WS}.json`);
const CLAVE = 'mako.plantillas.store';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function leerStore(): Promise<Record<string, unknown> | null> {
  const r = await sql`select value from app_settings where workspace_id = ${WS} and key = ${CLAVE} limit 1`;
  if (!r.length) return null;
  const v = (r[0] as { value: unknown }).value;
  return typeof v === 'string' ? (JSON.parse(v) as Record<string, unknown>) : (v as Record<string, unknown>);
}

async function main() {
  if (MODO === 'guardar') {
    const store = await leerStore();
    // Sólo las posiciones, por entrada. `null` como valor del archivo significa «esta
    // entrada NO tenía posiciones», que es distinto de «tenía un mapa vacío».
    const soloPos: Record<string, unknown> = {};
    for (const [id, e] of Object.entries(store ?? {})) {
      const pos = (e as { posiciones?: unknown } | null)?.posiciones;
      soloPos[id] = pos === undefined ? null : pos;
    }
    writeFileSync(ARCHIVO, JSON.stringify({ ws: WS, habiaStore: store !== null, posiciones: soloPos }, null, 1), 'utf8');
    const conPos = Object.values(soloPos).filter((p) => p !== null).length;
    console.log(`✅ respaldo de ws${WS}: ${Object.keys(soloPos).length} entradas, ${conPos} con posiciones → ${ARCHIVO}`);
    await sql.end();
    return;
  }

  if (MODO === 'restaurar') {
    if (!existsSync(ARCHIVO)) { console.error(`⛔ no hay respaldo en ${ARCHIVO}`); process.exit(1); }
    const back = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as {
      ws: number; habiaStore: boolean; posiciones: Record<string, unknown>;
    };
    const ahora = await leerStore();
    if (ahora === null) { console.log('la clave no existe hoy: no hay nada que restaurar'); await sql.end(); return; }

    let tocadas = 0;
    let borradas = 0;
    for (const [id, e] of Object.entries(ahora)) {
      if (!e || typeof e !== 'object') continue;
      const entrada = e as Record<string, unknown>;
      const guardada = Object.prototype.hasOwnProperty.call(back.posiciones, id) ? back.posiciones[id] : null;
      const hoy = JSON.stringify(entrada.posiciones ?? null);
      const antes = JSON.stringify(guardada);
      if (hoy === antes) continue;
      if (guardada === null) { delete entrada.posiciones; borradas++; } else { entrada.posiciones = guardada; }
      tocadas++;
    }
    if (!tocadas) { console.log(`✓ ws${WS}: nada cambió, no hace falta restaurar`); await sql.end(); return; }
    // ⚠️ VA EL OBJETO, NO `JSON.stringify(obj)::jsonb`. El driver ya serializa para
    // jsonb: pasarle el texto guarda un jsonb que CONTIENE UN STRING con el JSON
    // adentro, y entonces `Object.keys(store)` devuelve 0,1,2,3… —los índices del
    // string— en vez de los ids. No da error, el UPDATE contesta ok, y la pantalla
    // sigue dibujando las plantillas porque el catálogo vive en el código: lo que
    // desaparece en silencio son los OVERRIDES del cliente. Pasó acá el 04/10/2026 y
    // lo destraba scripts/reparar-store-plantillas.ts.
    await sql`update app_settings set value = ${sql.json(ahora as never)}, updated_at = now() where workspace_id = ${WS} and key = ${CLAVE}`;
    // Se verifica el valor LEÍDO de vuelta, no el que se mandó.
    const releido = await leerStore();
    const quedo = Object.entries(releido ?? {}).filter(([id, e]) => {
      const g = Object.prototype.hasOwnProperty.call(back.posiciones, id) ? back.posiciones[id] : null;
      return JSON.stringify((e as Record<string, unknown> | null)?.posiciones ?? null) !== JSON.stringify(g);
    });
    console.log(`✅ ws${WS}: ${tocadas} entradas restauradas (${borradas} con la clave BORRADA porque no existía antes)`);
    if (quedo.length) console.error(`⛔ quedaron ${quedo.length} sin volver a su valor: ${quedo.map(([id]) => id).join(', ')}`);
    await sql.end();
    if (quedo.length) process.exit(1);
    return;
  }

  console.error('uso: respaldo-posiciones-plantillas.ts <guardar|restaurar> <ws>');
  await sql.end();
  process.exit(1);
}

main().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
