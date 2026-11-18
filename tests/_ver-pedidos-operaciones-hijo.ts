// =============================================================================
// Hijo de tests/respuestas-como-claude.test.ts (caso 4) — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el runner REAL de `ver_pedidos_operaciones` (lib/api-mako/areas/operaciones.run.ts, `server-only`) en un node
// aparte con `--conditions=react-server`, con la base reemplazada: los cuatro módulos que leen Supabase devuelven lo que
// trae el JSON de la variable `PEDIDOS_DE_PRUEBA`. Imprime en una línea lo que devuelve la operación.
// Va en un proceso aparte porque reemplaza `Module._load` (AGENTS.md: un test que toca `Module._load` corre solo).
// =============================================================================

// Un módulo, no un script global: sin esto sus nombres chocan con los de otros hijos en el tsc entero (TS2300/TS2451).
export {};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
const pedidos = JSON.parse(process.env.PEDIDOS_DE_PRUEBA ?? '[]') as unknown[];
const nada = async () => null;
const DOBLES: Record<string, Record<string, unknown>> = {
  '@/lib/operaciones': { listarPedidos: async () => pedidos, leerCarteros: async () => ({ carteros: [], tokenPista: null }), cancelarRespuestasDe: nada },
  '@/lib/centro-turnos-db': { leerTurnos: async () => [], leerUltimosTurnos: async () => [] },
  '@/lib/centro-ya-vistos-db': { leerYaVistosDe: async () => ({}), marcarYaVistoDe: nada },
  '@/lib/centro-preguntas-chat-db': { ignorarPregunta: nada, leerPreguntas: async () => [] },
};
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  return DOBLES[pedido] ?? cargarOriginal.call(this, pedido, padre, esMain);
};

(async () => {
  const { RUNNERS } = await import('../lib/api-mako/areas/operaciones.run');
  const r = RUNNERS.ver_pedidos_operaciones as { leer: (input: Record<string, unknown>, ctx: unknown) => Promise<unknown> };
  const salida = await r.leer({}, {});
  process.stdout.write(`${typeof salida === 'string' ? salida : JSON.stringify(salida)}\n`);
})().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`); process.exit(1); });
