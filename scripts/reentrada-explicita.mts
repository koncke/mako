// =============================================================================
// La «Reentrada» del CRON, escrita en las automatizaciones que ya existen (14/10/2026, mig 0279)
// =============================================================================
// Hasta la 0279 lo decidía una regla escondida (`preparaReunion` → vuelve a entrar si es otra reunión; el resto, una sola
// vez). La columna nace en NULL y el motor, sin ella, usa esa misma regla (`reentradaDe`, lib/reentrada.ts). Este script
// la deja ESCRITA con lo que cada una hace hoy, así el panel del CRON muestra lo guardado y el respaldo se puede ir:
//   · prepara una reunión (por su CRON o por un DELAY «antes de la reunión») → 'otra_reunion';
//   · el resto → 'una_vez'.
// No cambia lo que hace ninguna: escribe lo que el motor ya leía. Sólo las que tienen la columna en NULL (una que alguien
// eligió no se toca) y no están archivadas. Se puede correr dos veces.
//
// ⚠️ VA DESPUÉS DE LA 0279 (sin la columna, el update falla y no escribe nada).
//
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/reentrada-explicita.mts            (dry run)
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/reentrada-explicita.mts --apply
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: process.env.ENV_FILE ?? resolve(process.cwd(), '.env.local') });
import postgres from 'postgres';
import { preparaReunion } from '../lib/nutricion-familias';
import { reentradaDe, ROTULO_REENTRADA } from '../lib/reentrada';
import type { PasoGrafo } from '../lib/flujo-grafo';

const APLICAR = process.argv.includes('--apply');

async function main(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
  try {
    const filas = await sql<Array<{ id: number; workspace_id: number; nombre: string; activa: boolean; trigger_tipo: string; etapa: string | null; etapas: unknown; disparadores: unknown; pasos: unknown }>>`
      select id, workspace_id, nombre, activa, trigger_tipo, etapa, etapas, disparadores, pasos
      from nutricion_secuencias where archivada_at is null and reentrada is null order by workspace_id, id`;
    const porValor = new Map<string, number>();
    for (const f of filas) {
      const pasos = Array.isArray(f.pasos) ? (f.pasos as PasoGrafo[]) : [];
      const sec = { trigger_tipo: f.trigger_tipo, etapa: f.etapa, etapas: (f.etapas as unknown[] | null) ?? null, disparadores: (f.disparadores as never) ?? null, pasos };
      const valor = reentradaDe(null, preparaReunion(sec as never));
      porValor.set(valor, (porValor.get(valor) ?? 0) + 1);
      console.log(`ws${f.workspace_id} #${f.id} «${f.nombre}»${f.activa ? ' (PRENDIDA)' : ''}: ${ROTULO_REENTRADA[valor]}`);
      if (APLICAR) {
        // Compare-and-set sobre el NULL: si alguien la eligió entre la lectura y acá, gana lo suyo.
        await sql`update nutricion_secuencias set reentrada = ${valor}, updated_at = now() where id = ${f.id} and reentrada is null`;
      }
    }
    const resumen = [...porValor].map(([v, n]) => `${n} «${ROTULO_REENTRADA[v as keyof typeof ROTULO_REENTRADA]}»`).join(', ') || 'ninguna';
    console.log(`\n${filas.length} automatización(es) sin reentrada: ${resumen}. ${APLICAR ? 'Escritas.' : '(dry run: --apply para escribir)'}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
