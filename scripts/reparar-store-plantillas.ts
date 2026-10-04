// =============================================================================
// reparar-store-plantillas — destraba un `mako.plantillas.store` sobre-codificado
// =============================================================================
// ⚠️ LO ESCRIBIÓ UN SCRIPT MÍO Y POR ESO EXISTE ESTE. `respaldo-store-plantillas`
// hacía `update ... set value = ${JSON.stringify(obj)}::jsonb` sobre una columna que el
// driver ya serializa sola: el resultado es un jsonb que contiene un STRING con el JSON
// adentro, en vez del objeto. No da error, el UPDATE contesta ok, y la pantalla sigue
// dibujando las 65 plantillas — porque el catálogo vive en el CÓDIGO y el store sólo
// guarda los overrides. Lo que se pierde en silencio es eso: qué apagó el cliente, qué
// renombró, sus plantillas propias y sus borradores.
//
// Se reconoce en una línea: `Object.keys(store)` devuelve `['0','1','2',…]` —los índices
// de un string— en vez de los ids de las plantillas.
//
// La cura es decodificar hasta llegar a un objeto, y VERIFICAR lo que el producto va a
// leer, no la fila que se escribió.
//
//   mirar:     NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-store-plantillas.ts <ws>
//   arreglar:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-store-plantillas.ts <ws> --escribir
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const WS = Number(process.argv[2] || 1);
const ESCRIBIR = process.argv.includes('--escribir');
const CLAVE = 'mako.plantillas.store';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

/** Un store sano es un objeto cuyas claves son ids de plantilla, nunca `0,1,2…`. */
function esStoreSano(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const ks = Object.keys(x);
  if (!ks.length) return true;                       // vacío es legítimo
  return !ks.every((k) => /^\d+$/.test(k));          // índices de string = roto
}

async function main() {
  const r = await sql`select value from app_settings where workspace_id = ${WS} and key = ${CLAVE} limit 1`;
  if (!r.length) { console.log(`ws${WS}: no hay fila`); await sql.end(); return; }

  let v: unknown = (r[0] as { value: unknown }).value;
  let vueltas = 0;
  // Se decodifica hasta llegar a un objeto sano o hasta que deje de ser string.
  while (typeof v === 'string' && vueltas < 5) {
    try { v = JSON.parse(v); } catch { break; }
    vueltas++;
  }

  if (!esStoreSano(v)) {
    console.error(`⛔ ws${WS}: no pude recuperar un objeto sano (${vueltas} decodificaciones). Tipo final: ${typeof v}`);
    console.error('   primeras claves:', Object.keys((v ?? {}) as object).slice(0, 8).join(', '));
    await sql.end();
    process.exit(1);
  }

  const ids = Object.keys(v);
  console.log(`ws${WS}: ${vueltas} decodificación(es) · ${ids.length} entradas`);
  console.log('  ids:', ids.slice(0, 10).join(', ') + (ids.length > 10 ? ` … (+${ids.length - 10})` : ''));
  const conAlgo = ids.filter((k) => {
    const e = (v as Record<string, unknown>)[k];
    return e && typeof e === 'object' && Object.keys(e as object).length > 0;
  });
  console.log(`  con contenido: ${conAlgo.length}`);

  if (vueltas <= 1) { console.log('✓ el store ya estaba sano: no hay nada que reparar'); await sql.end(); return; }
  if (!ESCRIBIR) { console.log('\n(solo mirando — pasá --escribir para arreglarlo)'); await sql.end(); return; }

  // ⚠️ El driver serializa el objeto solo: pasarle `JSON.stringify` es justo lo que
  // produjo el problema. Va el OBJETO.
  await sql`update app_settings set value = ${sql.json(v as never)}, updated_at = now()
             where workspace_id = ${WS} and key = ${CLAVE}`;

  // Se verifica lo que el producto va a LEER, no lo que se mandó.
  const rr = await sql`select value from app_settings where workspace_id = ${WS} and key = ${CLAVE} limit 1`;
  let w: unknown = (rr[0] as { value: unknown }).value;
  if (typeof w === 'string') { try { w = JSON.parse(w); } catch { /* queda como está */ } }
  if (!esStoreSano(w) || Object.keys(w as object).length !== ids.length) {
    console.error('⛔ la relectura NO da el store esperado:', typeof w, Object.keys((w ?? {}) as object).slice(0, 6));
    await sql.end();
    process.exit(1);
  }
  console.log(`✅ ws${WS} reparado y releído: ${Object.keys(w as object).length} entradas, claves reales`);
  await sql.end();
}

main().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
