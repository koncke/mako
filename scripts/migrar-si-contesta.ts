// =============================================================================
// «Si el lead contesta» por camino: las automatizaciones de antes, con lo que hacen hoy (14/10/2026)
// =============================================================================
// Hasta el 14/10 una respuesta del lead cortaba TODO lo que tenía por delante, salvo el carril del recordatorio
// (`pausarPorRespuesta` + `alResponder`, una regla escondida). Desde el 14/10 cada camino del CRON lo dice
// (`si_contesta` en el inicio, lib/flujo-grafo.ts) y el de fábrica es «sigue» (Martín: «Opción en cada camino,
// sigue de fábrica»). Sin esta migración, las que ya existen pasarían a «sigue» solas: este script les escribe lo de
// HOY — «se corta», y «sigue» en un camino que es sólo el carril (su primera tarjeta es un DELAY «antes de la
// reunión») — salvo la bienvenida de «Un Lead Agendó Llamada», que Martín pasó a «sigue» (era el bug 5).
//
// Sólo las que no están archivadas (una archivada no corre). Toca `pasos` y `pasos_borrador`. Sin tarjeta CRON
// en el dato, la crea (`fijarSiContesta`). Una clave que ya está puesta no se pisa: se puede correr dos veces.
//
// ⚠️ VA ANTES DEL DEPLOY del código que la lee: el código de antes ignora la clave, así que migrar primero no
// cambia nada; al revés, en el medio las de antes pasarían a «sigue».
//
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/migrar-si-contesta.ts            (dry run)
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/migrar-si-contesta.ts --apply
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: process.env.ENV_FILE ?? resolve(process.cwd(), '.env.local') });
import postgres from 'postgres';
import { caminosDeSalida, fijarSiContesta, normalizar, indicePorId, claseDe, type PasoGrafo, type SiContesta } from '../lib/flujo-grafo';

const APLICAR = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

/** Lo de HOY de un camino. */
function deHoy(pasos: readonly PasoGrafo[], c: { clave: string; raiz: string }, esAgendo: boolean): SiContesta {
  if (esAgendo && c.clave === 'p') return 'sigue';                       // decisión de Martín, 14/10/2026
  const r = pasos[indicePorId(pasos, c.raiz)];
  const soloCarril = !!r && claseDe(r) === 'esperar' && r.espera?.modo === 'antes_reunion';
  return soloCarril ? 'sigue' : 'corta';
}

/** Escribe lo de hoy en las claves que falten. Devuelve los pasos nuevos (o null si no cambia nada) y qué puso. */
function migrar(crudos: unknown, esAgendo: boolean): { pasos: PasoGrafo[] | null; puso: Record<string, SiContesta> } {
  if (!Array.isArray(crudos) || !crudos.length) return { pasos: null, puso: {} };
  let pasos = normalizar(crudos as PasoGrafo[]);
  const ini = pasos.find((p) => claseDe(p) === 'inicio');
  const ya = ini?.si_contesta ?? {};
  const puso: Record<string, SiContesta> = {};
  for (const c of caminosDeSalida(pasos)) {
    if (ya[c.clave] !== undefined) continue;
    const v = deHoy(pasos, c, esAgendo);
    pasos = fijarSiContesta(pasos, c.clave, v);
    puso[c.clave] = v;
  }
  return { pasos: Object.keys(puso).length ? pasos : null, puso };
}

async function main(): Promise<void> {
const filas = await sql<Array<{ id: number; workspace_id: number; nombre: string; activa: boolean; pasos: unknown; pasos_borrador: unknown }>>`
  select id, workspace_id, nombre, activa, pasos, pasos_borrador from nutricion_secuencias where archivada_at is null order by workspace_id, id`;
let cambian = 0;
for (const f of filas) {
  const esAgendo = /un lead agend[oó] llamada/i.test(f.nombre ?? '');
  const pub = migrar(f.pasos, esAgendo);
  const bor = migrar(f.pasos_borrador, esAgendo);
  if (!pub.pasos && !bor.pasos) { console.log(`ws${f.workspace_id} #${f.id} «${f.nombre}»: nada que migrar`); continue; }
  cambian += 1;
  console.log(`ws${f.workspace_id} #${f.id} «${f.nombre}»${f.activa ? ' (PRENDIDA)' : ''}: publicada ${JSON.stringify(pub.puso)}${bor.pasos ? ` · borrador ${JSON.stringify(bor.puso)}` : ''}`);
  if (!APLICAR) continue;
  if (pub.pasos) await sql`update nutricion_secuencias set pasos = ${sql.json(pub.pasos as never)} where id = ${f.id}`;
  if (bor.pasos) await sql`update nutricion_secuencias set pasos_borrador = ${sql.json(bor.pasos as never)} where id = ${f.id}`;
}
console.log(APLICAR ? `\n✓ ${cambian} migrada(s)` : `\n(dry run: ${cambian} cambiarían. Repetí con --apply)`);
await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
