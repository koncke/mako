// =============================================================================
// diag-gemini-cuotas — ¿es verdad que "3 keys de Gemini" y "sin tokens"?
// =============================================================================
// SOLO LEE (SELECT). No escribe, no borra, no llama a ninguna IA.
// Correr:
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/diag-gemini-cuotas.mjs
//
// Contesta con números, por workspace:
//  1. cuántas filas GEMINI_API_KEY[_n] existen y si se DESCIFRAN (lo que decide credWs)
//  2. el uso de HOY en anthropic_usage por provider y por la columna `cuenta`
//  3. si hay saldo de gemini cargado (app_settings 'saldo.gemini') → free vs GEMINI_PAGO
//  4. el % real de cada cuenta contra LIMITES_PROVEEDOR / UMBRAL 0.9
import postgres from 'postgres';
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { descifrar, versionCripto } from '../lib/cripto-credenciales.ts';

config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 15, max: 1 });
// Sesión en UTC: el server (Vercel) corre en UTC y `usoHoyPorCuenta` usa
// `new Date().setHours(0,0,0,0)`, o sea medianoche UTC. Sin esto los `::date`
// se agrupan en la zona de esta máquina y el "hoy" queda corrido un día.
await sql`set time zone 'UTC'`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

// Espejo de lib/ia-cuotas.ts (LIMITES_PROVEEDOR / GEMINI_PAGO / UMBRAL).
const FREE = { rpd: 250, tokensDia: 250_000 };
const PAGO = { rpd: 30_000, tokensDia: 4_000_000 };
const UMBRAL = 0.9;
const MAX_KEYS = 10;
const CLAVES_GEMINI = ['GEMINI_API_KEY', ...Array.from({ length: MAX_KEYS - 1 }, (_, i) => `GEMINI_API_KEY_${i + 2}`)];
const pct = (u, lim) => Math.min(1, Math.max(lim.rpd ? u.requests / lim.rpd : 0, lim.tokensDia ? u.tokens / lim.tokensDia : 0));
const h = (t) => console.log(`\n=== ${t} ${'='.repeat(Math.max(0, 66 - t.length))}`);

try {
  h('WORKSPACES');
  const ws = await sql`select * from workspaces order by id`;
  for (const w of ws) console.log('  ws' + String(w.id).padEnd(3) + ' ' + JSON.stringify(w).slice(0, 220));

  h('FILAS DE CREDENCIALES GEMINI (TODOS LOS WORKSPACES)');
  const creds = await sql`
    select workspace_id, clave, valor_enc, updated_at, updated_by
    from credenciales
    where clave like 'GEMINI%'
    order by workspace_id, clave`;
  console.log(`  filas GEMINI* en total: ${creds.length}`);
  const porWs = new Map();
  for (const c of creds) {
    const esRotulo = c.clave.endsWith('_ACCOUNT');
    let estado, largo = '';
    if (esRotulo) {
      estado = 'rótulo';
    } else {
      const v = versionCripto(c.valor_enc);
      let plano = null;
      try { plano = v === 'otro' ? c.valor_enc : descifrar(c.valor_enc, c.workspace_id, c.clave); } catch (e) { plano = null; }
      const real = Boolean(plano && plano.trim() && !plano.trim().startsWith('PENDING'));
      estado = real ? `OK(${v})` : plano === null ? `ILEGIBLE(${v})` : `VACIO/PENDING(${v})`;
      // Huella del VALOR EN CLARO: dos filas distintas con la misma huella son la
      // MISMA key de Google → la misma cuota, aunque el panel las cuente como dos.
      largo = plano ? ` len=${plano.length} sha=${sha(plano)} …${plano.slice(-4)}` : '';
      if (!esRotulo) {
        const arr = porWs.get(c.workspace_id) ?? [];
        arr.push({ clave: c.clave, ok: real, estado });
        porWs.set(c.workspace_id, arr);
      }
    }
    console.log(`  ws${String(c.workspace_id).padEnd(3)} ${c.clave.padEnd(24)} ${estado.padEnd(18)}${largo} upd=${String(c.updated_at).slice(0, 19)} por=${c.updated_by ?? '-'}`);
  }
  console.log('\n  --- resumen por workspace (cuentas que credWs devolvería no-null) ---');
  for (const [w, arr] of [...porWs.entries()].sort((a, b) => a[0] - b[0])) {
    const ok = arr.filter((a) => a.ok);
    // El slot que ve el código = índice en CLAVES_GEMINI + 1
    const slots = ok.map((a) => CLAVES_GEMINI.indexOf(a.clave) + 1).sort((a, b) => a - b);
    console.log(`  ws${String(w).padEnd(3)} filas=${arr.length} usables=${ok.length} slots=[${slots.join(',')}]`);
  }

  h('SALDO DE IA EN app_settings (decide free 250rpd vs GEMINI_PAGO 30.000rpd)');
  const sets = await sql`
    select workspace_id, key, value, updated_at from app_settings
    where key = 'anthropic_saldo' or key like 'saldo.%' order by workspace_id, key`;
  if (!sets.length) console.log('  (ninguna fila de saldo en ningún workspace)');
  for (const s of sets) console.log(`  ws${String(s.workspace_id).padEnd(3)} ${String(s.key).padEnd(20)} ${String(s.value).slice(0, 120)} upd=${String(s.updated_at).slice(0, 19)}`);
  const saldoGemDeWs = new Map();
  for (const s of sets) if (s.key === 'saldo.gemini') saldoGemDeWs.set(s.workspace_id, s.value);

  h('anthropic_usage — USO DE HOY por workspace / provider / cuenta');
  const hoy = await sql`
    select workspace_id, provider, cuenta, count(*)::int pedidos,
           coalesce(sum(input_tokens),0)::int inp, coalesce(sum(output_tokens),0)::int outp
    from anthropic_usage
    where created_at >= date_trunc('day', now() at time zone 'UTC')
    group by 1,2,3 order by 1, 2, 3 nulls first`;
  if (!hoy.length) console.log('  (CERO filas de uso hoy, en ningún workspace)');
  for (const r of hoy) console.log(`  ws${String(r.workspace_id).padEnd(3)} ${String(r.provider ?? 'NULL').padEnd(12)} cuenta=${String(r.cuenta ?? 'NULL').padEnd(6)} pedidos=${String(r.pedidos).padEnd(6)} tokens=${(r.inp + r.outp).toLocaleString('es')} (in ${r.inp} / out ${r.outp})`);

  h('anthropic_usage — GEMINI: filas con cuenta NULL vs no-NULL (histórico completo)');
  const nulos = await sql`
    select workspace_id, (cuenta is null) as es_null, count(*)::int n,
           to_char(min(created_at),'YYYY-MM-DD HH24:MI') desde, to_char(max(created_at),'YYYY-MM-DD HH24:MI') hasta
    from anthropic_usage where provider = 'gemini'
    group by 1,2 order by 1,2`;
  if (!nulos.length) console.log('  (nunca hubo una fila con provider=gemini)');
  for (const r of nulos) console.log(`  ws${String(r.workspace_id).padEnd(3)} cuenta ${r.es_null ? 'NULL    ' : 'no-null '} n=${String(r.n).padEnd(7)} ${String(r.desde).slice(0, 19)} → ${String(r.hasta).slice(0, 19)}`);

  h('anthropic_usage — GEMINI por cuenta, ÚLTIMOS 7 DÍAS (día x cuenta)');
  const sem = await sql`
    select workspace_id, to_char(created_at,'YYYY-MM-DD') dia, cuenta,
           count(*)::int pedidos, coalesce(sum(input_tokens+output_tokens),0)::int tok
    from anthropic_usage
    where provider='gemini' and created_at >= now() - interval '7 days'
    group by 1,2,3 order by 1,2 desc,3 nulls first`;
  if (!sem.length) console.log('  (cero llamadas a gemini en 7 días)');
  for (const r of sem) console.log(`  ws${String(r.workspace_id).padEnd(3)} ${String(r.dia).slice(0, 10)} cuenta=${String(r.cuenta ?? 'NULL').padEnd(6)} pedidos=${String(r.pedidos).padEnd(6)} tokens=${r.tok.toLocaleString('es')}`);

  h('VEREDICTO: % de cuota de cada cuenta de gemini HOY (UMBRAL 0.9)');
  for (const [w, arr] of [...porWs.entries()].sort((a, b) => a[0] - b[0])) {
    const pago = saldoGemDeWs.has(w);
    const lim = pago ? PAGO : FREE;
    const n = arr.filter((a) => a.ok).length;
    console.log(`  ws${w}: ${n} cuenta(s) usable(s) · límite ${pago ? 'PAGO' : 'FREE'} = ${lim.rpd} rpd / ${lim.tokensDia.toLocaleString('es')} tok`);
    for (let i = 1; i <= Math.max(n, 1); i++) {
      const f = hoy.find((r) => r.workspace_id === w && r.provider === 'gemini' && (Number(r.cuenta) || 1) === i);
      const u = { requests: f?.pedidos ?? 0, tokens: f ? f.inp + f.outp : 0 };
      const p = pct(u, lim);
      console.log(`     cuenta ${i}: pedidos=${u.requests} tokens=${u.tokens} → pct=${(p * 100).toFixed(1)}% ${p >= UMBRAL ? 'AGOTADO' : 'con cuota'}`);
    }
  }

  h('ws9 y ws1 — GEMINI por CUENTA desde la mig 0132 (14/08, cuando `cuenta` dejó de ser NULL)');
  const desdeMig = await sql`
    select workspace_id, cuenta, count(*)::int pedidos,
           coalesce(sum(input_tokens+output_tokens),0)::int tok,
           to_char(min(created_at),'YYYY-MM-DD HH24:MI') primera, to_char(max(created_at),'YYYY-MM-DD HH24:MI') ultima
    from anthropic_usage
    where provider='gemini' and created_at >= '2026-08-14'
    group by 1,2 order by 1,2 nulls first`;
  for (const r of desdeMig) console.log(`  ws${String(r.workspace_id).padEnd(3)} cuenta=${String(r.cuenta ?? 'NULL').padEnd(6)} pedidos=${String(r.pedidos).padEnd(6)} tokens=${r.tok.toLocaleString('es')}  ${String(r.primera).slice(0, 24)} → ${String(r.ultima).slice(0, 24)}`);

  h('TODOS los proveedores, ws1 y ws9, últimos 3 días (¿gemini está atendiendo?)');
  const prov3 = await sql`
    select workspace_id, to_char(created_at,'YYYY-MM-DD') dia, provider, cuenta, count(*)::int pedidos,
           coalesce(sum(input_tokens+output_tokens),0)::int tok
    from anthropic_usage
    where workspace_id in (1,9) and created_at >= now() - interval '3 days'
    group by 1,2,3,4 order by 1,2 desc,3,4 nulls first`;
  if (!prov3.length) console.log('  (nada en 3 días para ws1/ws9)');
  for (const r of prov3) console.log(`  ws${String(r.workspace_id).padEnd(3)} ${String(r.dia).slice(0, 10)} ${String(r.provider ?? 'NULL').padEnd(11)} cuenta=${String(r.cuenta ?? 'NULL').padEnd(5)} pedidos=${String(r.pedidos).padEnd(5)} tokens=${r.tok.toLocaleString('es')}`);

  h('ÚLTIMAS 25 llamadas de ws9 (feature / model / motivo / provider / cuenta)');
  const ult = await sql`
    select to_char(created_at,'YYYY-MM-DD HH24:MI') created_at, provider, cuenta, feature, model, motivo, input_tokens, output_tokens
    from anthropic_usage where workspace_id=9 order by created_at desc limit 25`;
  for (const r of ult) console.log(`  ${String(r.created_at).slice(0, 24)} ${String(r.provider ?? '-').padEnd(10)} c=${String(r.cuenta ?? 'N').padEnd(3)} ${String(r.feature ?? '-').padEnd(22)} ${String(r.model ?? '-').padEnd(26)} tok=${(r.input_tokens ?? 0) + (r.output_tokens ?? 0)} motivo=${String(r.motivo ?? '-').slice(0, 40)}`);

  h('PICO DIARIO de gemini por ws (¿alguien REALMENTE revienta 250k?)');
  const pico = await sql`
    select workspace_id, to_char(created_at,'YYYY-MM-DD') dia, count(*)::int pedidos,
           coalesce(sum(input_tokens+output_tokens),0)::int tok
    from anthropic_usage where provider='gemini'
    group by 1,2 having coalesce(sum(input_tokens+output_tokens),0) > 200000
    order by 4 desc limit 20`;
  if (!pico.length) console.log('  (ningún día-workspace pasó de 200k tokens de gemini)');
  for (const r of pico) console.log(`  ws${String(r.workspace_id).padEnd(3)} ${String(r.dia).slice(0, 10)} pedidos=${String(r.pedidos).padEnd(5)} tokens=${r.tok.toLocaleString('es')}  (${(100 * r.tok / 250000).toFixed(0)}% de un free tier de 250k)`);

  h('ERRORES DE IA REGISTRADOS HOY (si existe una tabla de fallos)');
  const tablas = await sql`
    select table_name from information_schema.tables
    where table_schema='public' and (table_name ilike '%ia%' or table_name ilike '%usage%' or table_name ilike '%fallo%')
    order by 1`;
  console.log('  tablas candidatas: ' + tablas.map((t) => t.table_name).join(', '));

  h('COLUMNAS de anthropic_usage');
  const cols = await sql`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='anthropic_usage' order by ordinal_position`;
  console.log('  ' + cols.map((c) => `${c.column_name}:${c.data_type}`).join(' | '));
} finally {
  await sql.end();
}
