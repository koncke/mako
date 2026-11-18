// =============================================================================
// Hijo de tests/plan-lecturas-juntas.test.ts — NO es un test
// =============================================================================
// Llama a la página de verdad de /plan (app/plan/page.tsx, el tablero del CLIENTE) con sus bordes de mentira y anota, en una
// línea de tiempo, cuándo ARRANCA y cuándo TERMINA cada lectura. Así se ve lo único que cambió el 18/11/2026 (O27): qué lecturas
// esperan en serie y cuáles van juntas, y que el conjunto de lo que se lee y lo que llega al tablero sea el mismo de antes.
//
// Cada lectura de mentira tarda 25 ms: dos lecturas «juntas» arrancan las dos antes de que termine la primera.
//
// Uso: node --experimental-test-module-mocks --no-warnings --import tsx tests/_plan-lecturas-juntas-hijo.ts
// Imprime UN JSON con una escena por caso. Nada de esto toca la red ni la base.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;

type Escena = { tareasFallan?: boolean; categoriasFallan?: boolean; vacio?: boolean };
const estado: Escena = {};
let linea: string[] = [];
const sembradas: number[] = [];
const autocompletadas: number[] = [];

/** Una lectura de mentira: anota el arranque, tarda 25 ms, anota el final y contesta (o tira). */
const leer = <T,>(nombre: string, valor: () => T, falla = () => false) => async (): Promise<T> => {
  linea.push(`${nombre}:inicio`);
  await new Promise((r) => setTimeout(r, 25));
  linea.push(`${nombre}:fin`);
  if (falla()) throw new Error(`${nombre} cayó (de mentira)`);
  return valor();
};

const TAREA = { id: 1, titulo: 'Una tarea' };
const CATEGORIA = { id: 7, nombre: 'Un proyecto' };

async function main() {
  mock.module('server-only', { namedExports: {} });
  mock.module(url('lib/todo.ts'), { namedExports: {
    listTareas: leer('tareas', () => (estado.vacio ? [] : [TAREA]), () => !!estado.tareasFallan),
    listCategorias: leer('categorias', () => (estado.vacio ? [] : [CATEGORIA]), () => !!estado.categoriasFallan),
  } });
  mock.module(url('lib/todo-seeds.ts'), { namedExports: {
    seedTodoBoardSiVacio: async () => { sembradas.push(1); linea.push('sembrar'); },
    autocompletarPorSenales: async () => { autocompletadas.push(1); linea.push('autocompletar'); return false; },
  } });
  mock.module(url('lib/tab-access.ts'), { namedExports: { guardOnboarding: async () => {}, requireCapa: async () => {} } });
  mock.module(url('lib/auth.ts'), { namedExports: { getUsuarioActual: async () => ({ rol: 'cliente', id: 5 }) } });
  mock.module(url('lib/workspace.ts'), { namedExports: {
    getWorkspaceActual: leer('workspace', () => 10), estaImpersonando: async () => false,
    rutaConWs: async (r: string) => r, getRolWsEfectivo: leer('rol', () => 'admin'),
  } });
  mock.module(url('lib/plan-columnas-server.ts'), { namedExports: { leerColumnasPlan: leer('columnas', () => ({ columnas: 'de mentira' })) } });
  mock.module(url('lib/perfil.ts'), { namedExports: {
    getPerfil: leer('perfil', () => ({ nombre: 'Ana', avatarUrl: '' })), getTarjetaPlan: leer('tarjeta', () => ({ campos: [], guardable: true })),
  } });
  mock.module(url('lib/onboarding-arranque-server.ts'), { namedExports: { leerEstadoArranque: leer('arranque', () => ({ planBorrador: null })) } });
  mock.module(url('lib/plan-propuesta.ts'), { namedExports: { getPropuesta: async () => null } });
  mock.module(url('lib/clientes-ganados.ts'), { namedExports: { clientesGanadosOVacio: leer('clientes', () => [{ leadId: 3, nombre: 'Cliente X' }]) } });
  // El tablero es un componente de cliente: acá sólo importa QUÉ recibe.
  mock.module(url('app/plan/TodoBoard.tsx'), { namedExports: { TodoBoard: () => null } });

  const { default: TodoPage } = await import('../app/plan/page');

  const correr = async (e: Escena) => {
    Object.assign(estado, { tareasFallan: false, categoriasFallan: false, vacio: false }, e);
    linea = [];
    sembradas.length = 0;
    autocompletadas.length = 0;
    const el = await TodoPage({ searchParams: Promise.resolve({ vista: 'tareas' }) }) as unknown as { props: Record<string, unknown> };
    const p = el.props;
    return {
      linea: [...linea],
      sembro: sembradas.length,
      autocompleto: autocompletadas.length,
      props: {
        tareas: p.tareas, categorias: p.categorias, demo: p.demo, wsId: p.wsId, clientes: p.clientes, vistaInicial: p.vistaInicial,
        columnas: p.columnas, tarjeta: p.tarjeta, apertura: p.apertura, user: p.user,
      },
    };
  };

  const salida: Record<string, unknown> = {};
  salida.normal = await correr({});
  salida.sinTareas = await correr({ tareasFallan: true });
  salida.sinCategorias = await correr({ categoriasFallan: true });
  salida.vacio = await correr({ vacio: true });
  process.stdout.write(JSON.stringify(salida));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
