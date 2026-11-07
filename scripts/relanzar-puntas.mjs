#!/usr/bin/env node
// =============================================================================
// Relanzar las puntas que quedaron afuera cuando Actions se frenó (7/11/2026)
// =============================================================================
// POR QUÉ EXISTE. El 7/11 a las 02:08 UTC GitHub dejó de arrancar los trabajos («recent account payments have
// failed or your spending limit needs to be increased») y 14 ramas quedaron pusheadas y sin chequear. Cuando el
// pago se arregla, ESAS RAMAS NO ENTRAN SOLAS: un flujo se dispara al PUSHEAR, y ya están pusheadas. Alguien
// tiene que volver a lanzarlas de a una, y a mano son 14 pestañas.
//
// QUÉ HACE: busca las corridas de «punta → main» que fallaron SIN EJECUTAR UN SOLO PASO —la huella de un trabajo
// que no arrancó— y las vuelve a lanzar. No toca las que fallaron de verdad: ésas tienen un paso fallado y son
// trabajo de su chat.
//
// ⚠️ SIN `--aplicar` NO RELANZA NADA: muestra qué haría. Es a propósito: relanzar cuesta minutos de Actions, y
// correrlo antes de que el pago esté arreglado los gasta para volver a fallar igual.
//
// Uso:  node scripts/relanzar-puntas.mjs            (muestra)
//       node scripts/relanzar-puntas.mjs --aplicar  (relanza)
// =============================================================================
import { execFileSync } from 'node:child_process';

const REPO = 'koncke/mako';
const APLICAR = process.argv.includes('--aplicar');

function token() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 20_000,
    env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' }, windowsHide: true,
  });
  const t = out.match(/^password=(.+)$/m)?.[1]?.trim();
  if (!t) throw new Error('sin credencial de GitHub');
  return t;
}

const T = token();
const H = { Authorization: `Bearer ${T}`, Accept: 'application/vnd.github+json' };
const api = async (ruta, metodo = 'GET') => {
  const r = await fetch(`https://api.github.com/repos/${REPO}${ruta}`, { method: metodo, headers: H, signal: AbortSignal.timeout(30_000) });
  return { ok: r.ok, status: r.status, cuerpo: r.status === 204 ? null : await r.json().catch(() => null) };
};

const { cuerpo: lista } = await api('/actions/runs?per_page=80&status=failure');
const runs = lista?.workflow_runs ?? [];
if (!runs.length) { console.log('no pude leer las corridas'); process.exit(1); }

// Una rama puede tener varias corridas rojas: sólo interesa la última de cada una.
const ultimaPorRama = new Map();
for (const r of runs) if (!ultimaPorRama.has(r.head_branch)) ultimaPorRama.set(r.head_branch, r);

/** ¿Esa rama ya entró a main? Una punta vieja puede tener un rojo guardado y estar hace rato adentro. */
const yaEnMain = (rama) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', `origin/${rama}`, 'origin/main'], { stdio: 'ignore', timeout: 15_000 });
    return true;
  } catch { return false; }
};

const candidatas = [];
for (const [rama, r] of ultimaPorRama) {
  if (!rama?.startsWith('punta/')) continue;
  // ⚠️ Sin esto relanzaba ramas que ya están adentro: el rojo que figura es de una corrida vieja y gastaría
  // minutos de Actions para chequear algo que main ya tiene.
  if (yaEnMain(rama)) continue;
  const { cuerpo } = await api(`/actions/runs/${r.id}/jobs`);
  const job = (cuerpo?.jobs ?? [])[0];
  const pasos = (job?.steps ?? []).length;
  const pasoMalo = (job?.steps ?? []).find((s) => s.conclusion === 'failure')?.name ?? null;
  // La huella de «no arrancó»: cero pasos y ningún paso fallado.
  if (pasos === 0 && !pasoMalo) candidatas.push({ rama, id: r.id, numero: r.run_number });
  // ⚠️ `console.log` de Node NO entiende anchos como «%-40s»: lo imprime literal y corre los argumentos, así que
  // el nombre de la rama salía donde iba el paso. El ancho se pone con `padEnd`.
  else console.log('— %s falló de VERDAD (paso «%s»): es de su chat, no la toco', rama.replace('punta/', '').padEnd(38), pasoMalo ?? '?');
}

console.log('\n%d punta(s) quedaron afuera porque el trabajo no arrancó:', candidatas.length);
for (const c of candidatas) console.log('   %s (corrida %s)', c.rama, c.numero);

if (!APLICAR) {
  console.log('\nEnsayo: no relancé nada. Con el pago YA arreglado, correlo con --aplicar.');
  process.exit(0);
}

console.log('');
for (const c of candidatas) {
  const r = await api(`/actions/runs/${c.id}/rerun`, 'POST');
  console.log('%s %s', r.ok ? '✓ relanzada' : `✗ HTTP ${r.status}`, c.rama);
}
