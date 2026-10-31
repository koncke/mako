// =============================================================================
// Hijo de tests/agency-dos-duenos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre las funciones REALES de lib/agencia.ts (`esClienteDeAgencia` y `agenciaDeCliente`, las dos con `server-only` y
// las dos envueltas en `cache()`) contra un PostgREST de mentira, en un node aparte con `--conditions=react-server`.
// Nada sale a la red: lo que no es la base se anota en `red` y tiene que dar vacío.
//
// ⚠️ EL CASO QUE IMPORTA NO EXISTE EN LOS DATOS: hoy ningún cliente tiene dos agencias. Por eso se arma acá — es la
//    única forma de medir el bug de P15 sin esperar a que un cliente real tenga dos dueños. La relación es N:N a
//    propósito, así que el caso no es imposible: es que todavía no pasó.
//
// ⚠️ UN WS POR CASO, y es a propósito: las dos funciones están memoizadas con `cache()`, así que preguntar dos veces
//    por el MISMO ws puede no volver a tocar la base. Con un ws distinto cada caso, cada pregunta es una lectura.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['agencia_clientes', 'workspaces'] as const;
const pg = crearPostgrest({ tablas: TABLAS });

/** Los ws cuya lectura de cartera TIENE que fallar (la base caída, la tabla sin migrar). */
const CAIDOS = new Set<string>();

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    // La falla se simula por cliente: así un mismo proceso mide el «no sé» sin romper los otros casos.
    const pedido = u.searchParams.get('cliente_ws') ?? '';
    if (u.pathname.endsWith('/agencia_clientes') && CAIDOS.has(pedido.replace(/^eq\./, ''))) {
      return new Response(JSON.stringify({ code: '42P01', message: 'relation "agencia_clientes" does not exist' }), { status: 500 });
    }
    return pg.responder(u, init);
  }
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

// Dos agencias, como manda tests/agencia-cartera.ts: con UNA sola no se puede preguntar «¿y si hay dos dueños?».
const A = 13;   // Código Inmobiliario, la real
const B = 77;   // de mentira, la que hace la pregunta
// Un ws por caso (ver la cabecera).
const SIN_DUENO = 101;
const UN_DUENO = 102;
const DOS_DUENOS = 103;         // el caso de P15: dos filas aprobadas
const DOS_UNA_REVOCADA = 104;   // una vigente + una historia: sigue siendo cliente
const DOS_REVOCADAS = 105;      // sólo historia: ya no es cliente de nadie
const DOS_PENDIENTES = 106;     // dos pendientes: pendiente también es dueña (esCarteraVigente)
const NO_SE_PUDO = 107;         // la base se cae

const ahoraIso = () => new Date().toISOString();

async function main() {
  const { esClienteDeAgencia, agenciaDeCliente, agenciasDeCliente } = await import('../lib/agencia');
  const db = pg.db;

  const fila = (agencia_ws: number, cliente_ws: number, estado: string) =>
    db.agencia_clientes.push({ agencia_ws, cliente_ws, estado, decidido_por: null, decidido_at: null, motivo: null, created_at: ahoraIso() });

  db.workspaces.push({ id: A, nombre: 'Código Inmobiliario' }, { id: B, nombre: 'Agencia B' });

  fila(A, UN_DUENO, 'aprobado');
  // EL CASO DE P15: el mismo cliente, aprobado por las DOS agencias.
  fila(A, DOS_DUENOS, 'aprobado');
  fila(B, DOS_DUENOS, 'aprobado');
  fila(A, DOS_UNA_REVOCADA, 'aprobado');
  fila(B, DOS_UNA_REVOCADA, 'revocado');
  fila(A, DOS_REVOCADAS, 'revocado');
  fila(B, DOS_REVOCADAS, 'revocado');
  fila(A, DOS_PENDIENTES, 'pendiente');
  fila(B, DOS_PENDIENTES, 'pendiente');
  fila(A, NO_SE_PUDO, 'aprobado');
  CAIDOS.add(String(NO_SE_PUDO));

  // Las dos preguntas, sobre los mismos clientes: la de sí/no y la de quién.
  const casos: Record<string, number> = {
    sinDueno: SIN_DUENO, unDueno: UN_DUENO, dosDuenos: DOS_DUENOS,
    dosUnaRevocada: DOS_UNA_REVOCADA, dosRevocadas: DOS_REVOCADAS, dosPendientes: DOS_PENDIENTES, noSePudo: NO_SE_PUDO,
  };
  const esCliente: Record<string, boolean | null> = {};
  const quien: Record<string, number | null> = {};
  const cuantasFilas: Record<string, number> = {};
  for (const [nombre, ws] of Object.entries(casos)) {
    esCliente[nombre] = await esClienteDeAgencia(ws);
    quien[nombre] = (await agenciaDeCliente(ws))?.ws ?? null;
    // El contrato viejo de `agenciasDeCliente` (`[]` para dibujar) no se tocó.
    cuantasFilas[nombre] = (await agenciasDeCliente(ws)).length;
  }

  // Un ws que no es un ws: tampoco es un «no».
  const wsInvalido = {
    cero: await esClienteDeAgencia(0),
    nulo: await esClienteDeAgencia(null),
    indefinido: await esClienteDeAgencia(undefined),
  };

  process.stdout.write(JSON.stringify({ esCliente, quien, cuantasFilas, wsInvalido, red, sinMock: [...pg.sinMock] }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
