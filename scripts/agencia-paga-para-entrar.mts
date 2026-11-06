// =============================================================================
// agencia-paga-para-entrar — pasa a «Paga para entrar» las cuentas que se suspendieron A MANO por no pagar (6/11/2026)
// =============================================================================
// Hasta la mensualidad automática (lib/agencia-mes.ts), a los clientes de una agencia que no pagaron su entrada se los cortaba
// suspendiendo a la PERSONA (`usuarios.estado = 'suspendido'`): así no entra nadie, pero tampoco hay forma de que entre sola al
// pagar. Este script los pasa al estado nuevo: la CUENTA en pausa con el corte `paga-para-entrar` (causa `entrada`), y la persona
// otra vez activa. Desde ahí, cuando la agencia manda el comprobante al grupo de MaKo, la cuenta vuelve a entrar sola, y su
// entrada se cuenta desde ese día (Martín, 5/11/2026: «se recalcula desde el día que entra»).
//
// Desde la PC del Cerebro (lee y escribe la base de PRODUCCIÓN):
//
//   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/agencia-paga-para-entrar.mts --usuarios 19,22,15
//
// y, mirando lo que lista, otra vez con `--aplicar`.
//
// ⚠️ SIN `--aplicar`, SÓLO LEE Y LISTA. Con `--aplicar`, por cada persona: primero pausa su CUENTA (compare-and-set sobre
//    `activo`; una que ya estaba pausada se deja así) y guarda el corte; recién después la vuelve a `activo`. En ese orden nunca
//    hay un momento en que la persona entre sin pagar.
// ⚠️ SÓLO cuentas que son CLIENTES APROBADOS de una agencia con la mensualidad PRENDIDA. Una persona de la agencia misma, de una
//    cuenta sin agencia, o de una agencia con la mensualidad apagada, se lista y NO se toca: eso lo decide Martín.
// ⚠️ Idempotente: correrlo dos veces no hace nada la segunda.
// =============================================================================

import { getSupabaseServer } from '../lib/supabase';
import { wsSuperAdmin } from '../lib/workspace';
import { CLAVE_CORTE, leerCorte, type CorteGuardado } from '../lib/plan-acceso-reglas';
import { leerConfigMensualidad } from '../lib/agencia-mes-reglas';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const aplicar = process.argv.includes('--aplicar');
const ids = (arg('--usuarios') ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isSafeInteger(x) && x > 0);
if (!ids.length) {
  console.error('uso: … scripts/agencia-paga-para-entrar.mts --usuarios 19,22,15 [--aplicar]');
  process.exit(2);
}

const db = getSupabaseServer();
const plataforma = await wsSuperAdmin();
const hoy = new Date().toISOString().slice(0, 10);

const { data: personas, error } = await db.from('usuarios').select('id, email, nombre, workspace_id, estado').in('id', ids);
if (error) { console.error(`No pude leer las personas: ${error.message}`); process.exit(1); }
const porId = new Map(((personas ?? []) as Array<{ id: number; email: string | null; nombre: string | null; workspace_id: number | null; estado: string | null }>).map((p) => [Number(p.id), p]));

let errores = 0;
for (const id of ids) {
  const p = porId.get(id);
  if (!p) { console.log(`· usuario ${id}: no existe. No toco nada.`); continue; }
  const quien = `usuario ${id} (${p.nombre ?? p.email ?? 'sin nombre'}, cuenta ${p.workspace_id ?? '—'})`;
  const ws = p.workspace_id != null ? Number(p.workspace_id) : null;
  if (ws == null) { console.log(`· ${quien}: sin cuenta. No toco nada.`); continue; }

  // ¿De qué agencia es cliente, aprobado? ¿Tiene la mensualidad prendida?
  const { data: cartera, error: e1 } = await db.from('agencia_clientes').select('agencia_ws').eq('cliente_ws', ws).eq('estado', 'aprobado');
  if (e1) { console.log(`✗ ${quien}: no pude leer su agencia (${e1.message}). No toco nada.`); errores++; continue; }
  const agencias = [...new Set(((cartera ?? []) as Array<{ agencia_ws: number }>).map((x) => Number(x.agencia_ws)))];
  if (agencias.length !== 1) { console.log(`· ${quien}: ${agencias.length ? `es cliente de ${agencias.length} agencias` : 'no es cliente aprobado de ninguna agencia'}. No toco nada: lo decide Martín.`); continue; }
  const agenciaWs = agencias[0];
  const { data: conf, error: e2 } = await db.from('app_settings').select('value').eq('workspace_id', plataforma).eq('key', `agencia.mensualidad.${agenciaWs}.config`).maybeSingle();
  if (e2) { console.log(`✗ ${quien}: no pude leer la mensualidad de su agencia (${e2.message}). No toco nada.`); errores++; continue; }
  if (!leerConfigMensualidad((conf as { value?: string } | null)?.value ?? null)) {
    console.log(`· ${quien}: la mensualidad de su agencia (${agenciaWs}) está APAGADA. Préndela primero; no toco nada.`);
    continue;
  }

  // Cómo está su cuenta y su corte.
  const [{ data: w, error: e3 }, { data: c, error: e4 }] = await Promise.all([
    db.from('workspaces').select('id, nombre, estado').eq('id', ws).maybeSingle(),
    db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_CORTE).maybeSingle(),
  ]);
  if (e3 || e4 || !w) { console.log(`✗ ${quien}: no pude leer su cuenta (${e3?.message ?? e4?.message ?? 'no existe'}). No toco nada.`); errores++; continue; }
  const cuenta = w as { nombre: string | null; estado: string | null };
  const corte = leerCorte((c as { value?: string } | null)?.value ?? null);
  const yaEsta = corte?.motivo === 'paga-para-entrar' && corte.vigente && cuenta.estado === 'pausado';
  const otro = corte?.vigente && corte.motivo !== 'paga-para-entrar';
  console.log(`${yaEsta && p.estado !== 'suspendido' ? '✓' : '→'} ${quien} · ${cuenta.nombre ?? ''} · agencia ${agenciaWs} · cuenta ${cuenta.estado} · persona ${p.estado}${corte ? ` · corte ${corte.motivo}${corte.vigente ? '' : ' (no vigente)'}` : ''}`);
  if (otro) { console.log(`  tiene otro corte vigente (${corte!.motivo}): no toco nada.`); continue; }
  if (yaEsta && p.estado !== 'suspendido') { console.log('  ya está en «Paga para entrar».'); continue; }
  if (!aplicar) {
    console.log(`  con --aplicar: la cuenta ${ws} en pausa («Paga para entrar», causa entrada) y la persona ${id} otra vez activa.`);
    continue;
  }

  // 1. La cuenta en pausa, con su corte. Si no se puede guardar el corte, se deja como estaba.
  const nuevo: CorteGuardado = {
    cobroId: 0, hasta: hoy, motivo: 'paga-para-entrar', desde: new Date().toISOString(), vigente: true,
    mensualidad: { agenciaWs, rol: 'cliente', causas: ['entrada'], perdonadas: [] },
  };
  let pausadaAhora = false;
  if (cuenta.estado === 'activo') {
    const { data: up, error: e5 } = await db.from('workspaces').update({ estado: 'pausado', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'activo').select('id');
    if (e5 || !up?.length) { console.log(`  ✗ no pude pausar la cuenta (${e5?.message ?? 'otro la cambió'}). No toco a la persona.`); errores++; continue; }
    pausadaAhora = true;
  } else if (cuenta.estado !== 'pausado') { console.log(`  ✗ la cuenta está «${cuenta.estado}»: no la toco.`); continue; }
  const { error: e6 } = await db.from('app_settings').upsert({ workspace_id: ws, key: CLAVE_CORTE, value: JSON.stringify(nuevo), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (e6) {
    if (pausadaAhora) await db.from('workspaces').update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'pausado');
    console.log(`  ✗ no pude guardar el corte (${e6.message}): dejé la cuenta como estaba y no toco a la persona.`);
    errores++;
    continue;
  }
  // 2. Recién ahora, la persona otra vez activa (sin el corte, entraría sin pagar).
  if (p.estado === 'suspendido') {
    const { error: e7 } = await db.from('usuarios').update({ estado: 'activo' }).eq('id', id).eq('estado', 'suspendido');
    if (e7) { console.log(`  ✗ la cuenta quedó en pausa, pero no pude reactivar a la persona (${e7.message}).`); errores++; continue; }
  }
  console.log(`  ✓ la cuenta ${ws} quedó en «Paga para entrar» y la persona ${id} activa: vuelve a entrar sola cuando entre el pago.`);
}
console.log(aplicar ? `\nListo${errores ? `, con ${errores} error(es)` : ''}.` : '\nNo escribí nada. Si está bien, otra vez con --aplicar.');
process.exit(errores ? 1 : 0);
