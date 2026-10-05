/**
 * SOLO LECTURA. El historial de `plan_proyectos` guarda `campo` y `antes` en cada entrada
 * (ver `mkEntry` en useBoard.ts), así que el valor ANTERIOR de cada deadline está ahí.
 * Esto lo saca, para poder revertir con el número exacto y no de memoria.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

const fecha = (ts: unknown) => {
  const n = Number(ts);
  return Number.isFinite(n) && n > 1e12 ? new Date(n).toISOString().slice(0, 16).replace('T', ' ') : String(ts).slice(0, 16);
};

async function main() {
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('plan_proyectos').select('id, name, deadline, quarter, historial');
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<Record<string, unknown>>;

  console.log('═══ TODA entrada de historial que tocó una FECHA, más nueva primero ═══\n');
  const ev: Array<{ ts: number; n: string; id: string; campo: string; antes: unknown; txt: string; actor: string }> = [];
  for (const p of filas) {
    for (const h of (Array.isArray(p.historial) ? p.historial : []) as Array<Record<string, unknown>>) {
      const campo = String(h.campo ?? '');
      const txt = String(h.text ?? '');
      if (!/deadline|quarter/i.test(campo) && !/deadline|fecha|Sin deadline/i.test(txt)) continue;
      ev.push({ ts: Number(h.ts) || 0, n: String(p.name), id: String(p.id), campo, antes: h.antes, txt, actor: String(h.actor ?? '?') });
    }
  }
  ev.sort((a, b) => b.ts - a.ts);
  for (const e of ev.slice(0, 60)) {
    const antes = e.antes === undefined ? '(sin campo `antes`)' : JSON.stringify(e.antes);
    console.log(`${fecha(e.ts)} · ${e.actor.padEnd(5)} · campo=${(e.campo || '—').padEnd(9)} · antes=${String(antes).padEnd(14)} · ${e.txt.slice(0, 34).padEnd(34)} · ${e.n.slice(0, 38)}`);
  }

  console.log('\n═══ Los 19 que HOY tienen deadline, con lo que dice su historial ═══\n');
  for (const p of filas.filter((x) => x.deadline).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
    const h = ((Array.isArray(p.historial) ? p.historial : []) as Array<Record<string, unknown>>)
      .filter((x) => /deadline|fecha/i.test(String(x.text ?? '')) || /deadline/i.test(String(x.campo ?? '')))
      .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    console.log(`${String(p.name).slice(0, 44).padEnd(46)} hoy=${p.deadline}  q=${p.quarter ?? '—'}`);
    for (const x of h.slice(0, 3)) {
      console.log(`    ${fecha(x.ts)} ${String(x.actor ?? '?').padEnd(5)} antes=${JSON.stringify(x.antes ?? null).padEnd(14)} ${String(x.text ?? '').slice(0, 46)}`);
    }
    if (!h.length) console.log('    (su historial no tiene ninguna entrada de fecha)');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
