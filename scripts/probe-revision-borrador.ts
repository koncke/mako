// =============================================================================
// probe-revision-borrador — ¿sobrevive la revisión a un F5? ¿y las preguntas?
// =============================================================================
// Escribe SOBRE UNA COPIA: crea un borrador de prueba en el workspace indicado,
// simula la revisión (destildar + reasignar + corregir título), la vuelve a leer
// como lo haría un F5, pide las preguntas para lo elegido, y BORRA la copia.
// No toca ningún borrador real.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-revision-borrador.ts <ws>
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { runWithWorkspace } from '../lib/workspace';
import { crearPropuesta, getPropuesta, guardarRevision, preguntasParaCargar, descartarPropuesta } from '../lib/plan-propuesta';

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

      // — Las preguntas: solo sobre lo que queda tildado y es mío.
      const elegidas = (releida?.tareas ?? []).filter((t) => t.incluir !== false && !t.esDeOtro);
      console.log(`\npidiendo preguntas para las ${elegidas.length} elegidas (de ${releida?.tareas.length})…`);
      const qs = await preguntasParaCargar(elegidas.map((t) => ({ titulo: t.titulo, detalle: t.detalle, proyecto: t.proyecto })));
      console.log(`MaKo devolvió ${qs.length} pregunta(s):`);
      for (const q of qs) {
        console.log(`  · [${q.tipo}] ${q.pregunta}`);
        console.log(`      opciones: ${(q.opciones ?? []).join(' / ') || '(1-5)'}`);
        console.log(`      sobre: ${(q.sobre ?? []).map((x) => `«${x}»`).join(' · ') || '(no lo dijo)'}`);
      }
      const abiertas = qs.filter((q) => !(q.opciones ?? []).length && q.tipo !== 'escala');
      console.log(`\n${abiertas.length === 0 ? '✓' : '✗'} todas cerradas (${abiertas.length} abiertas)`);
      const hablanDeElegidas = qs.every((q) => !q.sobre?.length || q.sobre.some((tt) => elegidas.some((e) => e.titulo.includes(tt.slice(0, 20)) || tt.includes(e.titulo.slice(0, 20)))));
      console.log(`${hablanDeElegidas ? '✓' : '✗'} ninguna pregunta habla de lo destildado ni de lo de otro`);
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
