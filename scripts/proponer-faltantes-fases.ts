// Las 13 tarjetas que las tres fases NOMBRAN y el tablero no tenía (barrido del 25/09).
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/proponer-faltantes-fases.ts [--aplicar]
//
// NO las inserta a mano: las PROPONE y deja que el Perro las puntúe y las rutee, que es el
// único camino que respeta la metodología (AGENTS.md, «nunca insertar en plan_tareas»).
//
// ⚠️ `aplicarPropuesta` corre la priorización sobre el tablero ENTERO: al volver, los scores
//    escritos a mano ya no están. El orden por fases se escribe DESPUÉS, con
//    `node backups/_escalera.mjs --apply`.
//
// El contenido viene de un JSON aparte a propósito: los detalles traen backticks y un
// template literal se cierra a la mitad con el primero (ya pasó en este repo, dos veces).
//
// ⚠️ `backups/_faltantes-a-crear.json` NO está versionado (backups/ es gitignored: son filas
//    de clientes y un respaldo versionado es una fuga con historial). Este script es de UNA
//    corrida: quedó commiteado como registro de QUÉ se creó y por qué camino, no para
//    volver a correrlo. Si falta el JSON, tira — y eso es correcto: no hay nada que repetir.
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace } from '../lib/workspace';
import { crearPropuesta, aplicarPropuesta } from '../lib/plan-propuesta';
import { APP_BASE_URL } from '../lib/app-url';

const WS = 9; // el tablero del dueño
const APLICAR = process.argv.includes('--aplicar');

type Fila = { titulo: string; proyecto: string; detalle: string; critico: boolean };

async function main() {
  const filas: Fila[] = JSON.parse(readFileSync('backups/_faltantes-a-crear.json', 'utf8'));
  console.log(`${filas.length} tarjetas · ${filas.filter((f) => f.critico).length} críticas`);
  for (const f of filas) console.log(`  ${f.critico ? '★' : ' '} ${f.proyecto.padEnd(28)} ${f.titulo.slice(0, 70)}`);
  if (!APLICAR) { console.log('\n— simulacro — (pasá --aplicar para crear el borrador y aplicarlo)'); return; }

  const id = await runWithWorkspace(WS, () =>
    crearPropuesta({
      ws: WS,
      origen: 'claude-code',
      resumen: 'Las 13 tarjetas que las tres fases nombran y el tablero no tenía. Salieron de tres críticos de completitud que recorrieron cada fase de punta a punta, y las validó una segunda pasada contra las 246 abiertas (8 ya existían y no se duplican; 1 se descartó porque la premisa no se sostenía contra el código).',
      fuenteTitulo: 'Barrido del board contra las tres fases · 25/09',
      tareas: filas.map((f) => ({ titulo: f.titulo, proyecto: f.proyecto, detalle: f.detalle })),
    }),
  );
  console.log(`\nborrador: ${id}`);

  // ⚠️ `ResultadoAplicar` devuelve `ids`, NO `aplicadas`. Leerlo mal imprimió «aplicadas: 0»
  //    sobre trece tarjetas que SÍ se habían creado — un cero perfectamente correcto sobre la
  //    pregunta equivocada, que es la forma más cara de equivocarse. Lo cazó el typecheck.
  const res = await runWithWorkspace(WS, () => aplicarPropuesta(id));
  if (!res?.ok) { console.error('NO aplicó:', res?.error ?? 'el borrador no existe'); process.exit(1); }
  console.log(`creadas: ${res.ids.length}`);
  for (const tareaId of res.ids) console.log(`  ${APP_BASE_URL}/plan?tarea=${tareaId}`);
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e); process.exit(1); },
);
