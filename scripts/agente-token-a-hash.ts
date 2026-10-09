// =============================================================================
// agente-token-a-hash — convierte UNA VEZ los tokens principales que quedaron en claro
// =============================================================================
// Desde el 09/10/2026 el token de la skill de Claude (`agente_token`) se guarda como hash +
// pista (lib/agente-token-nucleo.ts). Las filas acuñadas antes siguen en claro y el código
// nuevo las sigue aceptando; este script las pasa al formato nuevo y borra del índice
// `webhook_routing('agente', …)` todas las filas en claro que ya no autentican nada.
//
// ⚠️ ORDEN: DESPUÉS del deploy que trae lib/agente-token-nucleo.ts. Antes, el código viejo
// leería el setting en hash como un token distinto del presentado y las skills instaladas
// recibirían 401.
//
// Por defecto SÓLO CUENTA (no escribe nada) y nunca imprime un valor del token: ni el token,
// ni su hash, ni su pista. La lógica, con su porqué, está en lib/agente-token-conversion.ts.
//
//   contar:     npx tsx scripts/agente-token-a-hash.ts
//   convertir:  npx tsx scripts/agente-token-a-hash.ts --aplicar
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { AGENTE_SERVICIO, AGENTE_TOKEN_KEY } from '../lib/agente-token-nucleo';
import { convertirAgenteTokens, type IoConversion } from '../lib/agente-token-conversion';

const APLICAR = process.argv.includes('--aplicar');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('⛔ falta DATABASE_URL (se lee de .env.local, en la carpeta desde donde se corre el script)');
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
  // app_settings.value es TEXT (mig 0016): se compara y se escribe como texto.
  const io: IoConversion = {
    leerSettings: async () => {
      const rs = await sql`select workspace_id, value from app_settings where key = ${AGENTE_TOKEN_KEY} order by workspace_id`;
      return rs.map((x) => ({ ws: Number(x.workspace_id), value: (x.value as string | null) ?? null }));
    },
    leerIndice: async () => {
      const rs = await sql`select workspace_id, identificador from webhook_routing where servicio = ${AGENTE_SERVICIO}`;
      return rs.map((x) => ({ ws: Number(x.workspace_id), identificador: String(x.identificador) }));
    },
    indexar: async (identificador, ws) => {
      // Primer reclamante gana, como upsertRouting: si ya existe no se toca, y se lee de quién quedó.
      await sql`insert into webhook_routing (servicio, identificador, workspace_id)
                values (${AGENTE_SERVICIO}, ${identificador}, ${ws})
                on conflict (servicio, identificador) do nothing`;
      const rs = await sql`select workspace_id from webhook_routing where servicio = ${AGENTE_SERVICIO} and identificador = ${identificador}`;
      return rs.length === 1 && Number(rs[0].workspace_id) === ws;
    },
    cambiarSettingSi: async (ws, esperado, nuevo) => {
      const rs = await sql`update app_settings set value = ${nuevo}, updated_at = now()
                           where workspace_id = ${ws} and key = ${AGENTE_TOKEN_KEY} and value = ${esperado}
                           returning workspace_id`;
      return rs.length === 1;
    },
    borrarIndice: async (ws, identificador) => {
      await sql`delete from webhook_routing where servicio = ${AGENTE_SERVICIO} and workspace_id = ${ws} and identificador = ${identificador}`;
    },
  };

  try {
    const r = await convertirAgenteTokens(io, { aplicar: APLICAR, log: (l) => console.log(l) });
    if (APLICAR) {
      // Se verifica lo que el producto va a LEER, no lo que se mandó: otra pasada, sólo contando.
      console.log('\nRelectura:');
      const v = await convertirAgenteTokens(io, { aplicar: false, log: (l) => console.log(`  ${l}`) });
      if (v.settings.enClaro.length !== r.fallidos.length || v.indice.enClaro !== v.indice.enClaroVigentes) {
        console.error('⛔ la relectura no da lo esperado: quedan settings o filas en claro de más.');
        process.exitCode = 1;
      }
    }
    if (r.fallidos.length) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('⛔', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
