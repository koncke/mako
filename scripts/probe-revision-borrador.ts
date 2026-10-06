// =============================================================================
// probe-revision-borrador — ¿sobrevive la revisión a un F5?
// =============================================================================
// Escribe SOBRE UNA COPIA: crea un borrador de prueba en el workspace indicado,
// simula la revisión (destildar + reasignar + corregir título), la vuelve a leer
// como lo haría un F5, y BORRA la copia. (Las preguntas se fueron del alta el 05/10/2026.)
// No toca ningún borrador real.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-revision-borrador.ts <ws>
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { runWithWorkspace } from '../lib/workspace';
import { crearPropuesta, getPropuesta, guardarRevision, descartarPropuesta } from '../lib/plan-propuesta';

const WS = Number(process.argv[2] || 9);
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
  let id = '';
  try {
    await runWithWorkspace(WS, async () => {
      id = await crearPropuesta({
        ws: WS, origen: 'fathom', ref: `probe:${WS}:revision`, fuenteTitulo: 'PROBE (borrar)',
        resumen: 'Borrador de prueba del probe — se borra solo.',
        tareas: [
          { titulo: 'Agregar filtro por fecha en el tablero de guiones', detalle: 'Para poder ver solo los del mes.', prioridad: 'alta' },
          { titulo: 'Corregir el mensaje de error al agotarse los tokens', detalle: 'Hoy no dice qué hacer.', prioridad: 'media' },
          { titulo: 'Comprar el dominio definitivo', detalle: '', prioridad: 'media' },
        ],
      });
      console.log(`borrador de prueba: ${id}\n`);

      // — La revisión: destildo una, le paso otra a alguien, corrijo el título de la tercera.
      const ok = await guardarRevision(id, [
        { titulo: 'Agregar filtro por fecha en el tablero de guiones', detalle: 'Para poder ver solo los del mes.', prioridad: 'alta' },
        { titulo: 'Corregir el mensaje de error al agotarse los tokens', detalle: 'Hoy no dice qué hacer.', prioridad: 'media', incluir: false },
        { titulo: 'Comprar el dominio macodigital.app (TÍTULO CORREGIDO)', detalle: 'Con Porkbun.', prioridad: 'media', esDeOtro: true, dueno: 'Mauricio Bustos' },
      ]);
      console.log(`guardarRevision → ${ok}`);

      // — El F5: se relee de la base, como hace el board al montar.
      const releida = await getPropuesta(id);
      console.log('\nlo que ve el board después de recargar:');
      for (const t of releida?.tareas ?? []) {
        console.log(`  ${t.incluir === false ? '☐ destildada' : t.esDeOtro ? `→ de ${t.dueno}` : '☑ mía      '} · ${t.titulo}`);
      }
      const sobrevive = (releida?.tareas ?? []).some((t) => t.incluir === false)
        && (releida?.tareas ?? []).some((t) => t.esDeOtro)
        && (releida?.tareas ?? []).some((t) => t.titulo.includes('TÍTULO CORREGIDO'));
      console.log(`\n${sobrevive ? '✓' : '✗'} la revisión sobrevive al F5 (destildado + reparto + título corregido)`);

    });
  } finally {
    if (id) {
      await runWithWorkspace(WS, () => descartarPropuesta(id));
      const d = await sql`delete from plan_propuestas where id = ${id}`;
      console.log(`\nlimpieza: ${d.count} borrador de prueba borrado`);
    }
  }
}

main().then(() => sql.end()).then(() => process.exit(0)).catch(async (e) => { console.error('ERROR:', e); await sql.end(); process.exit(1); });
