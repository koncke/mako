// =============================================================================
// respaldo-disparadores — el disparador de cada secuencia de un workspace
// =============================================================================
// ⚠️ EXISTE PORQUE VERIFICAR LA PANTALLA ESCRIBE. El entorno local apunta a la base de
// PRODUCCIÓN: tocar el desplegable de «Se dispara al caer en …» le cambia a un cliente
// real a quién le escriben sus secuencias. La regla de la casa está pagada con nombre y
// fecha (02/09/2026: un recorrido de verificación le guardó a un cliente de Baja
// California el acento argentino de la máquina del que verificaba).
//
//   guardar:    NODE_OPTIONS="--conditions=react-server" npx tsx scripts/respaldo-disparadores.ts guardar <ws>
//   restaurar:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/respaldo-disparadores.ts restaurar <ws>
//
// Son las SEIS columnas que el disparador escribe —`trigger_tipo`, `etapa`, `funnel_id`,
// `producto_id` (mig 0189, el ámbito de una secuencia de ENTREGA) y `cron` +
// `cron_proxima_at` (mig 0192, la mitad «por tiempo»)— de TODAS las secuencias del
// workspace, no sólo de la que se va a tocar: un respaldo que cubre una fila de N es peor
// que ninguno, porque deja restaurar con confianza.
//
// ⚠️ EL RESPALDO SE HACE POR LO QUE LAS ACTIONS TOCAN, NO POR EL CAMPO QUE ESTÁS MIRANDO.
// Al sumar el horario había que sumarlo acá en el MISMO commit: la vez anterior este
// script cubría 3 de 4 columnas (le faltaba `producto_id`) y «restauró» dejando un
// producto viejo — o sea restauró con confianza y mal.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const MODO = process.argv[2];
const WS = Number(process.argv[3] || 1);
const ARCHIVO = resolve(process.cwd(), `.respaldo-disparadores-ws${WS}.json`);

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

type Fila = {
  id: number; clave: string; trigger_tipo: string | null; etapa: string | null;
  funnel_id: number | null; producto_id: number | null;
  cron: unknown; cron_proxima_at: string | null;
};

/** El horario es jsonb: se compara por su TEXTO, que es lo único estable entre una
 *  lectura del driver y lo que quedó escrito en el archivo. */
const mismoCron = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const fechaIgual = (a: unknown, b: unknown): boolean => {
  const t = (v: unknown) => (v == null ? '' : new Date(v as string).toISOString());
  return t(a) === t(b);
};

const leer = async (): Promise<Fila[]> => (await sql`
  select id, clave, trigger_tipo, etapa, funnel_id, producto_id, cron, cron_proxima_at
    from nutricion_secuencias where workspace_id = ${WS} order by id`) as unknown as Fila[];

async function main() {
  if (MODO === 'guardar') {
    const filas = await leer();
    writeFileSync(ARCHIVO, JSON.stringify(filas, null, 2), 'utf8');
    console.log(`✓ ws${WS}: ${filas.length} secuencias guardadas en ${ARCHIVO}`);
    return;
  }
  if (MODO === 'restaurar') {
    if (!existsSync(ARCHIVO)) { console.error(`✗ no hay respaldo en ${ARCHIVO}`); process.exit(1); }
    const guardadas = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as Fila[];
    const ahora = await leer();
    const porId = new Map(ahora.map((f) => [f.id, f]));
    let tocadas = 0;
    for (const g of guardadas) {
      const hoy = porId.get(g.id);
      if (!hoy) { console.warn(`  · sec ${g.id} «${g.clave}» ya no existe`); continue; }
      const igual = hoy.trigger_tipo === g.trigger_tipo && hoy.etapa === g.etapa
        && Number(hoy.funnel_id ?? -1) === Number(g.funnel_id ?? -1)
        && Number(hoy.producto_id ?? -1) === Number(g.producto_id ?? -1)
        && mismoCron(hoy.cron, g.cron) && fechaIgual(hoy.cron_proxima_at, g.cron_proxima_at);
      if (igual) continue;
      // ⚠️ EL JSONB VA COMO OBJETO (`sql.json`), NUNCA COMO TEXTO. El driver ya serializa
      // para jsonb: pasarle el string guarda un jsonb que CONTIENE el JSON adentro, y la
      // relectura con un lector propio lo deshace y da verde sobre una fila corrupta.
      // Esta casa lo pagó el 04/10/2026 con el store de plantillas de un cliente real.
      await sql`update nutricion_secuencias
                   set trigger_tipo = ${g.trigger_tipo}, etapa = ${g.etapa}, funnel_id = ${g.funnel_id}, producto_id = ${g.producto_id},
                       cron = ${g.cron == null ? null : sql.json(g.cron as never)}, cron_proxima_at = ${g.cron_proxima_at}
                 where id = ${g.id}`;
      console.log(`  ✓ sec ${g.id} «${g.clave}»: ${hoy.trigger_tipo}/${hoy.etapa}/f${hoy.funnel_id}/p${hoy.producto_id} → ${g.trigger_tipo}/${g.etapa}/f${g.funnel_id}/p${g.producto_id}`);
      tocadas += 1;
    }
    // Se RELEE para verificar, y se compara contra lo guardado: el UPDATE que contesta ok
    // no es la pregunta (ver scripts/reparar-store-plantillas.ts).
    const despues = new Map((await leer()).map((f) => [f.id, f]));
    for (const g of guardadas) {
      const d = despues.get(g.id);
      if (!d) continue;
      if (d.trigger_tipo !== g.trigger_tipo || d.etapa !== g.etapa
        || Number(d.funnel_id ?? -1) !== Number(g.funnel_id ?? -1)
        || Number(d.producto_id ?? -1) !== Number(g.producto_id ?? -1)
        || !mismoCron(d.cron, g.cron) || !fechaIgual(d.cron_proxima_at, g.cron_proxima_at)) {
        throw new Error(`sec ${g.id} no quedó como el respaldo: ${d.trigger_tipo}/${d.etapa}/f${d.funnel_id}/p${d.producto_id}`);
      }
    }
    console.log(tocadas ? `✓ ws${WS}: ${tocadas} restauradas y verificadas` : `✓ ws${WS}: nada cambió, no hacía falta restaurar`);
    return;
  }
  console.error('uso: respaldo-disparadores.ts guardar|restaurar <ws>');
  process.exit(1);
}

main().then(() => sql.end()).catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
