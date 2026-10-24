// =============================================================================
// unificar-en-seco — qué haría «Unificar» con dos fichas de un negocio, SIN escribir nada (23/10/2026)
// =============================================================================
// Para probar la lógica con un caso real sin tocarlo (el Cerebro, 23/10: «el ws1 tiene al lead 249 y al 3099, los dos de
// Martín y con el mismo teléfono normalizado... NO los unifiques en producción»). Sólo importa el PLAN
// (`planParaUnificar`): la escritura (`aplicarUnificar`) ni se carga.
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/unificar-en-seco.mts --ws 1 --a 249 --b 3099 [--queda 3099]
// =============================================================================

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const WS = Number(arg('ws')), A = Number(arg('a')), B = Number(arg('b'));
const QUEDA = arg('queda') ? Number(arg('queda')) : null;
if (![WS, A, B].every((n) => Number.isInteger(n) && n > 0)) throw new Error('Uso: --ws <negocio> --a <ficha> --b <ficha> [--queda <ficha>]');

const { runWithWorkspace } = await import(`file:///${base}/lib/workspace.ts`);
const { planParaUnificar } = await import(`file:///${base}/lib/leads-unificar.ts`);
const { textoDeLaPrevia } = await import(`file:///${base}/lib/leads-unificar-reglas.ts`);

await runWithWorkspace(WS, async () => {
  const plan = await planParaUnificar(A, B, QUEDA);
  console.log(`ws${WS} · ${A} y ${B} · EN SECO (no escribió nada)`);
  if (!plan.ok) { console.log(`No se uniría: ${plan.error}`); return; }
  const t = textoDeLaPrevia(plan.previa);
  console.log(`\n${t.titulo}\n${t.bajada}`);
  for (const s of t.secciones) { console.log(`\n${s.titulo}:`); for (const l of s.lineas) console.log(`  · ${l.texto}`); }
  console.log(`\n${t.aviso}\n\nLas ${plan.ops.length} operaciones, en orden:`);
  for (const o of plan.ops) console.log(`  ${JSON.stringify(o)}`);
});
