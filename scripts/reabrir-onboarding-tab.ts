// =============================================================================
// reabrir-onboarding-tab — volver a abrir el onboarding de UNA tab de UN cliente
// =============================================================================
//
// ⚠️ POR QUÉ ESTE SCRIPT EXISTE Y NO SE BORRA UNA FILA A MANO.
//
// La pregunta «¿este paso está hecho?» tiene la respuesta escrita en DOS claves:
// el estado propio de la tab (`onboarding.tab.<key>`) y el registro COMPARTIDO
// del workspace (`onboarding.tab.pasos`), que existe para que conectar el
// WhatsApp desde una tab cuente también en la otra.
//
// `getEstadoTab` las cruza y **RECALCULA el status**: un paso vale si lo marcó
// esta tab O si figura en el compartido, y si están todos los no-opcionales la
// tab queda `done`. O sea que **borrar la fila propia no resetea nada**: el
// compartido la vuelve a dar por terminada, sin error y sin síntoma.
//
// Medido el 03/09/2026: se «reseteó» el Video Generator del ws 10 borrando
// `onboarding.tab.video-generator`, y al entrar la tab abrió normal. Los cinco
// `vg_*` seguían vivos en `onboarding.tab.pasos`. Se reportó como «no me salta el
// onboarding apenas entre».
//
// `reabrirOnboardingTab` hace las DOS cosas, y es la única forma correcta.
//
// ── Uso ─────────────────────────────────────────────────────────────────────
//
//   node --import tsx scripts/reabrir-onboarding-tab.ts --ws=10 --tab=video-generator
//   ... --apply     ← sin esto NO escribe nada, sólo muestra el antes y el después
//
// Siempre imprime el estado previo de las dos claves antes de tocar nada: es el
// respaldo, y va a la consola para que quede en el registro de la sesión.

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { getSetting } from '../lib/settings';
import { getEstadoTab, reabrirOnboardingTab, tabOnboardingDef } from '../lib/tab-onboarding-state';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const APLICAR = process.argv.includes('--apply');
const WS = Number(arg('ws'));
const TAB = arg('tab') ?? '';

if (!Number.isInteger(WS) || WS <= 0 || !TAB) {
  console.error('uso: --ws=<n> --tab=<key> [--apply]');
  process.exit(1);
}

async function main() {
  const def = tabOnboardingDef(TAB);
  if (!def) throw new Error(`La tab "${TAB}" no tiene onboarding definido.`);

  await runWithWorkspace(WS, async () => {
    // ⚠️ EL RESPALDO ES DE LAS DOS CLAVES, no de la que uno está mirando. Es
    // exactamente el error que este script viene a evitar, aplicado al respaldo.
    const propioAntes = await getSetting(`onboarding.tab.${TAB}`);
    const compartidoAntes = await getSetting('onboarding.tab.pasos');
    const estadoAntes = await getEstadoTab(TAB);

    console.log(`\n=== ws ${WS} · tab ${TAB} · ANTES ===`);
    console.log(`  status calculado: ${estadoAntes.status}`);
    console.log(`  onboarding.tab.${TAB}: ${propioAntes ?? '(no existe)'}`);
    console.log(`  onboarding.tab.pasos: ${compartidoAntes ?? '(no existe)'}`);
    console.log(`\n  pasos de esta tab que el compartido da por hechos:`);
    const comp = compartidoAntes ? (JSON.parse(compartidoAntes) as Record<string, string>) : {};
    for (const p of def.pasos) {
      console.log(`    ${comp[p.key] ? '✓' : '·'} ${p.key}${comp[p.key] ? `  (${comp[p.key]})` : ''}`);
    }

    if (!APLICAR) {
      console.log('\n=== SIMULACIÓN: sin --apply no se escribió nada ===');
      return;
    }

    await reabrirOnboardingTab(TAB);

    const estadoDespues = await getEstadoTab(TAB);
    console.log(`\n=== DESPUÉS ===`);
    console.log(`  status calculado: ${estadoDespues.status}`);
    console.log(`  onboarding.tab.pasos: ${await getSetting('onboarding.tab.pasos')}`);
    // ⚠️ Se verifica el estado CALCULADO y no la fila escrita: la fila es lo que
    // uno controla, el calculado es lo que la tab va a leer — y la diferencia
    // entre los dos es todo este script.
    if (estadoDespues.status === 'done') {
      throw new Error('Escribió, y la tab sigue calculando "done". Hay una tercera fuente.');
    }
    console.log('\n✓ La tab vuelve a abrir en su onboarding.');
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
