// =============================================================================
// El tablero embebido escribe en el workspace del CLIENTE, no en el del que mira
// =============================================================================
// La ficha de un cliente en el panel de la plataforma monta el tablero de OTRO
// inquilino. Sus llamadas tienen que salir con el `?ws=` de ese cliente — el mismo
// mecanismo que «Inspeccionar», validado por `proxy.ts` contra la sesión firmada — y
// eso lo hace `setWsDeTrabajo` + la lista de rutas de `lib/ws-tab.ts`.
//
// ⚠️ EL MODO DE FALLA ES SILENCIOSO Y CARO. Una ruta del tablero que NO esté en la
// lista sale con el workspace del que MIRA, y no da error: `/api/plan-board` hace
// upsert con `onConflict: 'workspace_id,id'`, así que una edición sobre la tarea de un
// cliente le CLONA la fila al tablero del super admin. 200, sin error, y la tarea
// duplicada en el inquilino equivocado. Los delete y los update son peores de ver: se
// vuelven no-ops de 0 filas.
//
// Por eso este test no comprueba la lista contra sí misma: la comprueba contra el
// CÓDIGO. Barre los `fetch('/api/…')` de `app/plan/` y falla si aparece uno que la
// lista no cubre. Una ruta nueva del board obliga a decidir si va o no va — que es
// justo la decisión que nadie tomaría si esto no existiera.
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, de 8/8, y las dos veces quedan **5 pases y 3
// FALLOS**:
//   (a) sacando '/api/todo' de la lista —la ruta por la que escribe TODO el tablero de
//       un cliente, o sea 8 de los 9 workspaces— caen el barrido del código, el caso
//       que la nombra y el que comprueba que el barrido sigue viendo el board.
//   (b) cambiando el predicado por `pathname.startsWith('/api/')`, que es el atajo que
//       parece cubrir más, caen los tres que dicen qué NO puede llevar el ws: las
//       rutas del panel, las de sesión e imágenes, y el corte por segmento. Ésos son
//       los que impiden que la llamada que el panel de atrás hace mientras el modal
//       está abierto salga apuntando al cliente.
//
// ⚠️ Y EL BARRIDO YA ENCONTRÓ UNO AL ESCRIBIRSE: `app/plan/` entero incluye
// `/plan/revisar`, que llama a `/api/admin/impersonate`. Por eso el barrido es de las
// piezas del board y no de la carpeta — con la carpeta, el test habría pedido meter la
// impersonación en la lista, que es el bug al revés.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RUTAS_DEL_TABLERO, esRutaDelTablero } from '../lib/ws-tab';

/**
 * Lo que el tablero EMBEBIDO puede llegar a llamar.
 *
 * ⚠️ NO ES `app/plan/` ENTERO, y la diferencia la encontró este mismo test al
 * escribirlo: `app/plan/revisar/[id]/NoEsTuyo.tsx` llama a `/api/admin/impersonate`, y
 * ésa es una RUTA aparte —la pantalla de revisar un borrador— que nunca se monta
 * adentro de la ficha. Meterla en la lista habría hecho que la impersonación saliera
 * con el ws de un cliente, que es exactamente el bug al revés.
 *
 * Lo que sí se monta es `PlanBoard` / `TodoBoard` y todo `board/`. Si mañana la ficha
 * monta algo más, se agrega acá — y el test vuelve a tener algo que decir.
 */
const DEL_TABLERO = ['app/plan/board', 'app/plan/PlanBoard.tsx', 'app/plan/TodoBoard.tsx'];

/** Todos los `.ts`/`.tsx` de una ruta (archivo o carpeta), recursivo. */
function archivos(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return /\.tsx?$/.test(dir) ? [dir] : [];
  return readdirSync(dir).flatMap((n) => archivos(join(dir, n)));
}

/** Las rutas de /api que el subárbol del tablero llama. */
function rutasDelTablero(): Set<string> {
  const out = new Set<string>();
  for (const base of DEL_TABLERO) {
    for (const f of archivos(base)) for (const r of rutasDe(readFileSync(f, 'utf8'))) out.add(r);
  }
  return out;
}

/** Las rutas de /api que un archivo llama con fetch. */
function rutasDe(texto: string): string[] {
  // Se buscan las dos formas que el repo usa: comilla simple y template literal.
  const re = /fetch\(\s*[`'"](\/api\/[a-zA-Z0-9-]+)/g;
  const out: string[] = [];
  for (let m = re.exec(texto); m; m = re.exec(texto)) out.push(m[1]);
  return out;
}

test('TODA ruta que el tablero llama está en la lista', () => {
  // ⚠️ Se lee el CÓDIGO, no la lista. Una lista comprobada contra sí misma siempre
  // pasa; lo que tiene que doler es agregar un `fetch` nuevo y olvidarse.
  const encontradas = rutasDelTablero();
  assert.ok(encontradas.size > 0, 'no encontré ningún fetch: el barrido está roto');

  const sinCubrir = [...encontradas].filter((r) => !esRutaDelTablero(r));
  assert.deepEqual(
    sinCubrir, [],
    `estas rutas del tablero NO llevarían el ws del cliente y escribirían en el del que mira: ${sinCubrir.join(', ')}`,
  );
});

test('la lista no tiene rutas de más: cada una la llama alguien', () => {
  // Una entrada que ya nadie usa no rompe nada, pero deja creer que está cubierto algo
  // que no existe — y el día que alguien la vea, va a buscar el consumidor.
  const huerfanas = RUTAS_DEL_TABLERO.filter((r) => !rutasDelTablero().has(r));
  assert.deepEqual([...huerfanas], [], `en la lista y sin call site: ${huerfanas.join(', ')}`);
});

test('LAS RUTAS DEL PANEL NUNCA llevan el ws del tablero', () => {
  // Es el corte que evita la carrera: mientras el modal está abierto, el panel de
  // atrás sigue llamando a lo suyo. Si esas salieran con el ws del cliente, una
  // recarga de la lista o una acción sobre un workspace apuntaría al inquilino
  // equivocado.
  for (const r of ['/api/admin/workspaces', '/api/admin/usuarios', '/api/admin/agencia', '/api/admin/tablero']) {
    assert.equal(esRutaDelTablero(r), false, `${r} no puede llevar el ws del tablero`);
  }
});

test('tampoco lo llevan las rutas de sesión ni las de imágenes', () => {
  // `/api/portadas` lo comparten el tablero y la PORTADA DE LA FICHA: si llevara el ws
  // del cliente, cambiarle la portada al workspace subiría el archivo al del otro.
  for (const r of ['/api/auth/me', '/api/portadas', '/api/notificaciones', '/api/v1/crm']) {
    assert.equal(esRutaDelTablero(r), false, `${r} no puede llevar el ws del tablero`);
  }
});

test('la lista nombra a /api/todo y a /api/plan-board, que son las dos que ESCRIBEN', () => {
  // Las dos puertas del Repo: una por tablero. Si alguna se cayera de la lista, todo
  // el CRUD del board embebido escribiría en el workspace del que mira.
  assert.ok(esRutaDelTablero('/api/todo'));
  assert.ok(esRutaDelTablero('/api/plan-board'));
});

test('el prefijo es por SEGMENTO, no por texto', () => {
  // `/api/todos-los-clientes` empieza con `/api/todo` como TEXTO y no es la ruta del
  // tablero. Sin el corte por segmento, cualquier ruta nueva que comparta prefijo
  // saldría con el ws de otro inquilino.
  assert.equal(esRutaDelTablero('/api/todo'), true);
  assert.equal(esRutaDelTablero('/api/todo/algo'), true);
  assert.equal(esRutaDelTablero('/api/todos-los-clientes'), false);
  assert.equal(esRutaDelTablero('/api/plan-boardeo'), false);
});

test('lo que NO es del tablero queda afuera del barrido a propósito', () => {
  // `/plan/revisar` es una ruta, no una pieza del board: llama a
  // `/api/admin/impersonate` y jamás se monta adentro de la ficha. Este caso fija esa
  // decisión — si alguien mete el barrido a `app/plan/` entero, el test le va a pedir
  // que agregue la impersonación a la lista, que es lo contrario de lo correcto.
  const delTablero = rutasDelTablero();
  assert.equal(delTablero.has('/api/admin'), false, 'el barrido se comió una ruta que no es del board');
  assert.ok(delTablero.has('/api/todo'), 'el barrido dejó de ver el board');
});

test('ninguna entrada de la lista es un prefijo peligroso', () => {
  // `/api/` o `/api` cubrirían TODO, incluido el panel. Es el error que convierte este
  // mecanismo en el bug que viene a evitar.
  for (const r of RUTAS_DEL_TABLERO) {
    assert.ok(r.startsWith('/api/') && r.length > '/api/'.length + 2, `«${r}» es demasiado amplio`);
  }
});
