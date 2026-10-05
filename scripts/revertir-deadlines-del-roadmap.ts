/**
 * La segunda mitad de «vuelve a lo que estaba» (Martín, 04/10/2026).
 *
 * El 03/10, entre las 19:26 y las 19:33 (UTC), Martín depuró las fechas del tablero a mano:
 * le SACÓ el deadline a seis proyectos y le CAMBIÓ el de otros cuatro. A las 19:40 mi
 * corrida que aplicaba el plan de la llamada con Leila del 1/10 escribió las fechas de ese
 * plan encima de las diez — catorce minutos después, y sin mirar si lo que iba a pisar
 * había cambiado desde que ese plan se decidió.
 *
 * Los seis que habían quedado SIN fecha los revierte `revertir-deadlines-resucitados.ts`.
 * Esto es la otra mitad: los cuatro a los que Martín les puso una fecha distinta y la
 * corrida se la cambió. Cada uno vuelve al valor que ÉL escribió, leído de su historial.
 *
 * ⚠️ LOS SCORES NO SE TOCAN. La misma corrida los reordenó, y eso sí es lo que se le había
 * pedido en ese momento: revertirlo sería deshacer una decisión suya por mi cuenta. Queda
 * dicho en el reporte para que lo decida él.
 *
 * Corre en seco por defecto. `--aplicar` escribe.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

const APLICAR = process.argv.includes('--aplicar');

/**
 * Lo que Martín escribió a mano entre las 19:26 y las 19:33, leído de su propio historial.
 * No va cableado a ojo: el script lo VERIFICA contra la entrada `user` anterior a la mía.
 */
const ESPERADO: Record<string, string> = {
  'Feature: Onboarding': '2026-10-09',
  'Vender MaKo: Oferta y precios': '2026-10-09',
  'Feature: Video Generator': '2026-10-14',
  'Feature: Image Generator': '2026-10-14',
};

const n = (x: unknown) => Number(x) || 0;
const fechaDe = (t: string) => /Deadline (\d{4}-\d{2}-\d{2})/.exec(t)?.[1] ?? null;

async function main() {
  const sb = getSupabaseServer();
  const nombres = Object.keys(ESPERADO);
  const { data, error } = await sb.from('plan_proyectos').select('id, name, deadline, historial').in('name', nombres);
  if (error) throw new Error(error.message);

  const plan: Array<{ id: string; name: string; de: string; a: string }> = [];
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    const name = String(p.name);
    const quiere = ESPERADO[name];
    const hoy = p.deadline ? String(p.deadline) : '';
    const h = ((Array.isArray(p.historial) ? p.historial : []) as Array<Record<string, unknown>>)
      .slice().sort((a, b) => n(b.ts) - n(a.ts));

    // ⚠️ SE VERIFICA CONTRA EL HISTORIAL, no se confía en la tabla de arriba. La última
    // entrada de `code` es la mía; la última de `user` ANTES de ésa es la de él, y ésa es
    // la que manda. Si no coincide con lo esperado, no se toca y se dice por qué.
    const iMia = h.findIndex((x) => String(x.actor) === 'code' && /Llamada con Leila/.test(String(x.text ?? '')));
    const suya = h.slice(iMia + 1).find((x) => String(x.actor) === 'user' && fechaDe(String(x.text ?? '')));
    const suyaFecha = suya ? fechaDe(String(suya.text)) : null;

    if (iMia < 0) { console.log(`  — ${name}: mi corrida no lo tocó, no se revierte`); continue; }
    if (suyaFecha !== quiere) {
      console.log(`  ⚠ ${name}: el historial dice que él puso ${suyaFecha ?? '(nada)'} y yo esperaba ${quiere} → NO SE TOCA`);
      continue;
    }
    if (hoy === quiere) { console.log(`  ✓ ${name}: ya está en ${quiere}`); continue; }
    plan.push({ id: String(p.id), name, de: hoy, a: quiere });
  }

  console.log(`\n═══ A REVERTIR: ${plan.length} ═══`);
  for (const x of plan) console.log(`  ${x.name.padEnd(34)} ${x.de} → ${x.a}   (lo que escribiste vos)`);

  if (!APLICAR) { console.log('\n(en seco · correr con --aplicar para escribir)'); return; }
  let hechas = 0;
  for (const x of plan) {
    // Columna por columna y por id — nunca un upsert de la fila entera.
    const { error: e } = await sb.from('plan_proyectos')
      .update({ deadline: x.a, updated_at: new Date().toISOString() })
      .eq('id', x.id);
    if (e) { console.error(`  ✖ ${x.name}: ${e.message}`); continue; }
    hechas++;
    console.log(`  ✔ ${x.name} → ${x.a}`);
  }
  console.log(`\n${hechas} de ${plan.length} revertidos.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
