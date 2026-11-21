// =============================================================================
// binance-sin-captura-en-seco — qué haría la vuelta del cron con los pagos REALES de la cuenta de Binance, SIN escribir nada (20/11/2026)
// =============================================================================
// La vuelta (lib/binance-sin-captura.ts) con `enSeco: true`: lee la cuenta (clave de sólo lectura), los libros, los recibos y las
// mensualidades, y dice, pago por pago, si lo aplicaría, se lo mandaría a Martín, lo da por usado, es ajeno o espera. No aplica, no avisa
// y no guarda lo aprendido. `--desde AAAA-MM-DD` mira desde ese día (por defecto, la ventana del cron: 48 h).
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/binance-sin-captura-en-seco.mts [--desde 2026-11-01] [--ws 13]
// =============================================================================

export {}; // módulo, no script global

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const desde = arg('desde') ? Date.parse(`${arg('desde')}T00:00:00-03:00`) : undefined;
const soloWs = arg('ws') ? Number(arg('ws')) : null;

const { revisarPagosSinCaptura } = await import(`file:///${base}/lib/binance-sin-captura.ts`);
const { lineaDeFila } = await import(`file:///${base}/lib/binance-sin-captura-reglas.ts`);

const r = await revisarPagosSinCaptura({ enSeco: true, desde });
console.log(`EN SECO (no escribió nada) · desde ${desde ? new Date(desde).toISOString() : 'la ventana del cron'}`);
if (r.error) console.log(`ERROR: ${r.error}`);
const { filas, ...cuentas } = r;
console.log(JSON.stringify(cuentas));
for (const f of filas) if (soloWs == null || f.agenciaWs === soloWs || f.agenciaWs == null) console.log(`  ${lineaDeFila(f)}`);
