/**
 * «Yo había depurado y sacado muchos deadline como el de offer analyst y generator… me
 * cambiaste todo eso, vuelve a lo que estaba» (Martín, 04/10/2026).
 *
 * QUÉ PASÓ. El 03/10 a las 19:26 Martín le sacó el deadline a seis proyectos (su historial
 * lo dice: «Quitó el deadline»). A las 19:40 la corrida que aplicó el roadmap de la llamada
 * con Leila escribió los SCORES de diez proyectos… y revivió el deadline de esos seis con
 * el valor EXACTO que tenían antes del 19:26, sin dejar una sola entrada de historial.
 *
 * Esa combinación —el valor viejo de vuelta, sin rastro— es la firma de un upsert de la
 * FILA ENTERA armado desde un estado en memoria anterior al cambio. Es lo que AGENTS.md ya
 * tiene escrito («un `upsert` de fila entera armada en el cliente escribe TODAS las
 * columnas, incluidas las que ese formulario no muestra») visto desde el otro lado: no se
 * perdió un campo nuevo, se resucitó uno viejo.
 *
 * QUÉ HACE ESTO. Le pone `deadline = null` a los que cumplen las DOS condiciones, y a nadie
 * más:
 *   1. su historial dice «Quitó el deadline», y
 *   2. hoy tienen exactamente el MISMO valor que tenían ANTES de que se lo quitaran.
 *
 * La segunda condición es la que lo hace seguro: si alguien le puso una fecha NUEVA después
 * de quitarla, eso es una decisión y no se toca. Sin ese cruce, esto sería «borrar los
 * deadlines de los que alguna vez tuvieron uno», que es otra cosa.
 *
 * Corre en seco por defecto. `--aplicar` escribe.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

const APLICAR = process.argv.includes('--aplicar');
type Hist = { ts?: unknown; actor?: unknown; text?: unknown };
const n = (x: unknown) => Number(x) || 0;
const cuando = (ts: unknown) => new Date(n(ts)).toISOString().slice(0, 16).replace('T', ' ');

/** La fecha que menciona una entrada de historial, si menciona una. */
const fechaDe = (txt: string) => /^Deadline (\d{4}-\d{2}-\d{2})/.exec(txt)?.[1] ?? null;

async function main() {
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('plan_proyectos').select('id, name, deadline, historial');
  if (error) throw new Error(error.message);

  const candidatos: Array<{ id: string; name: string; hoy: string; quito: number; previo: string }> = [];
  const dudosos: Array<string> = [];

  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    const hoy = p.deadline ? String(p.deadline) : '';
    if (!hoy) continue;   // ya está sin fecha: nada que revertir
    const h = ((Array.isArray(p.historial) ? p.historial : []) as Hist[])
      .slice().sort((a, b) => n(a.ts) - n(b.ts));

    // La ÚLTIMA vez que alguien le sacó la fecha.
    let iQuito = -1;
    for (let i = 0; i < h.length; i++) if (/Quitó el deadline/i.test(String(h[i].text ?? ''))) iQuito = i;
    if (iQuito < 0) continue;

    // ¿Alguien le puso una fecha DESPUÉS de quitarla? Entonces es una decisión nueva.
    const despues = h.slice(iQuito + 1).map((x) => fechaDe(String(x.text ?? ''))).filter(Boolean) as string[];
    if (despues.length) {
      dudosos.push(`${String(p.name).padEnd(40)} hoy=${hoy} · le pusieron ${despues.join(', ')} DESPUÉS de quitarla → NO SE TOCA`);
      continue;
    }

    // El valor que tenía JUSTO ANTES de que se lo quitaran.
    const antes = h.slice(0, iQuito).map((x) => fechaDe(String(x.text ?? ''))).filter(Boolean) as string[];
    const previo = antes.at(-1) ?? '';
    if (previo && previo === hoy) {
      candidatos.push({ id: String(p.id), name: String(p.name), hoy, quito: n(h[iQuito].ts), previo });
    } else {
      dudosos.push(`${String(p.name).padEnd(40)} hoy=${hoy} · antes de quitarla tenía ${previo || '(no consta)'} → NO COINCIDE, no se toca`);
    }
  }

  console.log(`\n═══ A REVERTIR: ${candidatos.length} ═══`);
  for (const c of candidatos) {
    console.log(`  ${c.name.padEnd(42)} hoy=${c.hoy}  ·  se lo quitaste el ${cuando(c.quito)}  ·  y volvió el MISMO valor`);
  }
  if (dudosos.length) {
    console.log(`\n═══ MIRADOS Y NO TOCADOS: ${dudosos.length} ═══`);
    for (const d of dudosos) console.log('  ' + d);
  }

  if (!APLICAR) { console.log('\n(en seco · correr con --aplicar para escribir)'); return; }
  if (!candidatos.length) { console.log('\nNada que revertir.'); return; }

  // ⚠️ SE ESCRIBE **COLUMNA POR COLUMNA Y POR ID**, nunca un upsert de la fila: el upsert de
  // fila entera es exactamente lo que causó esto.
  let hechas = 0;
  for (const c of candidatos) {
    const { error: e } = await sb.from('plan_proyectos')
      // ⚠️ CADENA VACÍA, NO `null`: la columna es NOT NULL y «sin deadline» se guarda como
      // `''` — es lo que escribe `labelToRow` (lib/plan-board.ts:193). Con `null` el update
      // rebota con «violates not-null constraint», que es lo que pasó en el primer intento.
      .update({ deadline: '', updated_at: new Date().toISOString() })
      .eq('id', c.id);
    if (e) { console.error(`  ✖ ${c.name}: ${e.message}`); continue; }
    hechas++;
    console.log(`  ✔ ${c.name} — sin deadline`);
  }
  console.log(`\n${hechas} de ${candidatos.length} revertidos.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
