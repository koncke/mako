// =============================================================================
// mensualidad-ciclo-propio — prende (o apaga) la mensualidad de una cuenta SUELTA con ciclo propio (Leila Fittipaldi, 17/11/2026)
// =============================================================================
// Martín (17/11/2026): «el mismo proceso que tenemos con Código Inmobiliario […] pero para Leila […] como no tiene clientes, es la fecha que
// pagó, la misma fecha pero al siguiente mes». Pagó el 26/10/2026 (US$97, su Pro): su ciclo arranca cada 26. Las reglas, en
// lib/agencia-mes-reglas.ts (`CicloPropio`); lo que hace la corrida del día, en lib/agencia-mes.ts.
//
// Desde la PC del Cerebro (lee y escribe la base de PRODUCCIÓN):
//
//   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/mensualidad-ciclo-propio.mts --ws 11 --dia 26 --desde 2026-11 --plan pro
//
// y, mirando lo que muestra, otra vez con `--aplicar` (y SÓLO con el sí de Martín: desde que está prendida MaKo le escribe a su grupo y,
// pasado el plazo sin pagar, le pausa la cuenta). `--apagar` la apaga (lo pagado queda anotado).
//
// ⚠️ SIN `--aplicar`, SÓLO LEE Y MUESTRA. Prenderla antes de que el código esté desplegado deja a la cuenta como «no es Agency» en la
//    corrida del día (un error por día en el cron, sin efecto): se prende DESPUÉS del deploy.
// ⚠️ Idempotente: prenderla dos veces igual no cambia nada.
// =============================================================================

import { getSupabaseServer } from '../lib/supabase';
import { wsSuperAdmin } from '../lib/workspace';
import { apagarMensualidad, prenderMensualidad } from '../lib/agencia-mes';
import { DIAS_DE_GRACIA_CICLO_PROPIO, diaLimite, inicioDelCiclo, leerConfigMensualidad, periodoDelCiclo, esCicloPropio } from '../lib/agencia-mes-reglas';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const aplicar = process.argv.includes('--aplicar');
const apagar = process.argv.includes('--apagar');
const ws = Number(arg('--ws'));
const dia = Number(arg('--dia'));
const desde = arg('--desde') ?? '';
const plan = arg('--plan') ?? 'pro';
const medio = arg('--medio') ?? 'Binance';
if (!Number.isSafeInteger(ws) || ws <= 0 || (!apagar && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(desde) || !esCicloPropio({ dia, plan })))) {
  console.error('uso: … scripts/mensualidad-ciclo-propio.mts --ws 11 --dia 26 --desde 2026-11 --plan pro [--medio Binance] [--aplicar] | --ws 11 --apagar [--aplicar]');
  process.exit(2);
}

const db = getSupabaseServer();
const plataforma = await wsSuperAdmin();
const { data: w, error: eW } = await db.from('workspaces').select('id, nombre, capa, estado').eq('id', ws).maybeSingle();
if (eW || !w) { console.error(`No pude leer la cuenta ${ws}: ${eW?.message ?? 'no existe'}`); process.exit(1); }
const { data: conf, error: eC } = await db.from('app_settings').select('value').eq('workspace_id', plataforma).eq('key', `agencia.mensualidad.${ws}.config`).maybeSingle();
if (eC) { console.error(`No pude leer su config: ${eC.message}`); process.exit(1); }
const hoy = new Date().toISOString().slice(0, 10);
console.log(`cuenta ${ws}: ${(w as { nombre: string }).nombre} · capa ${(w as { capa: string }).capa} · ${(w as { estado: string }).estado}`);
console.log(`config de hoy: ${conf ? JSON.stringify(leerConfigMensualidad((conf as { value: unknown }).value)) : 'ninguna (apagada)'}`);

if (apagar) {
  console.log(aplicar ? 'APAGANDO…' : 'Con --aplicar la apagaría.');
  if (aplicar) { const r = await apagarMensualidad({ agenciaWs: ws }); console.log(r.ok ? r.resumen : `✗ ${r.error}`); process.exit(r.ok ? 0 : 1); }
  process.exit(0);
}

const ciclo = { dia, plan: plan as 'pro' | 'esencial' };
// ⚠️ `--desde` es el PRIMER ciclo que se avisa: un ciclo que ya se pagó en el acto (el de octubre, de Leila) no está en el libro y saldría como deuda.
if (diaLimite(desde, ciclo) < hoy) { console.error(`✗ El ciclo ${desde} ya venció (su último día para pagar fue el ${diaLimite(desde, ciclo)}): saldría como deuda. Usa el ciclo que viene.`); process.exit(2); }
console.log(`\nprendería: avisa desde el ciclo ${desde}, ${periodoDelCiclo(desde, ciclo)}`);
console.log(`  el aviso sale el ${inicioDelCiclo(desde, ciclo)} (con el PDF, a su grupo de MaKo); se paga por ${medio} hasta el ${diaLimite(desde, ciclo)} (${DIAS_DE_GRACIA_CICLO_PROPIO + 1} días con el del aviso);`);
console.log(`  sin el pago, el ${new Date(Date.parse(`${diaLimite(desde, ciclo)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)} se pausa su cuenta (los datos no se tocan) y se le avisa a Martín.`);
console.log(`  hoy es ${hoy}${hoy < inicioDelCiclo(desde, ciclo) ? ': todavía no vence, no sale nada hasta esa fecha' : ': el aviso sale en la próxima corrida del cron (14:07 UTC)'}.`);
if (!aplicar) { console.log('\nSin --aplicar: no escribí nada.'); process.exit(0); }
const r = await prenderMensualidad({ agenciaWs: ws, desde, medio, cicloPropio: ciclo, autor: 'Cobros (pedido de Martín, 17/11/2026)' });
console.log(r.ok ? `\n✓ ${r.resumen}` : `\n✗ ${r.error}`);
process.exit(r.ok ? 0 : 1);
