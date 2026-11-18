// =============================================================================
// Toda server action de app/ tiene su operación en la API de MaKo, su motivo para no tenerla, o está en la DEUDA, que sólo baja
// (18/11/2026, F127)
// =============================================================================
// Martín, 25/10/2026: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Lo que la pantalla
// deja leer o editar, la API también. tests/api-mako-registro.test.ts mira las operaciones que EXISTEN; esto mira el otro lado:
// cada `export async function` de cada 'use server' de app/ (las mismas que barre tests/acciones-con-puerta.test.ts, con el mismo
// analizador) está en UNA de las tres listas de lib/api-mako/cobertura.ts.
//   · Una acción nueva sin clasificar → rojo. Se declara su operación (y va a CUBIERTAS) o se escribe por qué no (EXCEPCIONES).
//     Meterla en la DEUDA sube el número de abajo, y eso también es rojo: la deuda no crece.
//   · Una entrada vieja (la acción ya no existe, o una operación de CUBIERTAS no está en el registro) → rojo.
//   · Sacar algo de la DEUDA porque se cubrió → rojo hasta que se baje `TOPE_DEUDA` al número nuevo, en el mismo commit.
//
// Probado rompiéndolo (18/11/2026), base 6 pases / 0 fallos, una rotura por vez y restaurando de memoria:
//   · sacar `reenviarReciboAction` de CUBIERTAS (queda sin clasificar)                          → 5 / 1
//   · una acción que no existe (`fantasmaAction`) en la DEUDA de app/crm/actions.ts             → 4 / 2 (vieja y el número)
//   · `reenviar_recibo` → `reenviar_recibo_viejo` (una operación que el registro no tiene)       → 5 / 1
//   · mover `crearTokenApi` de EXCEPCIONES a la DEUDA (la deuda crece)                           → 5 / 1
//   · `reenviarReciboAction` además en la DEUDA de su archivo (en dos listas)                    → 4 / 2 (las dos listas y el número)
//   · un motivo vacío en EXCEPCIONES                                                              → 5 / 1
// Correr: node --import tsx --test tests/api-mako-cobertura.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Analizador } from './_puerta-acciones';
import { CUBIERTAS, EXCEPCIONES, DEUDA } from '../lib/api-mako/cobertura';
import { porId } from '../lib/api-mako/registro';

/** Lo que falta declarar en la API. Sólo baja: cuando se cubre una acción, se saca de DEUDA y se baja este número. */
const TOPE_DEUDA = 524;

const RAIZ = join(__dirname, '..');

/** Todas las server actions de app/, como `archivo#accion`, leídas con el mismo analizador del guard de la sesión. */
function accionesDeApp(): string[] {
  const a = new Analizador(RAIZ);
  const archivos = execFileSync('git', ['ls-files', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f));
  const out: string[] = [];
  for (const f of archivos) for (const x of a.acciones(f) ?? []) out.push(`${f}#${x.nombre}`);
  return out;
}

const deudaPlana = (): string[] => Object.entries(DEUDA).flatMap(([f, xs]) => xs.map((x) => `${f}#${x}`));

/** En qué listas está cada clave. Una clave en dos listas es una contradicción. */
function listasDe(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const sumar = (k: string, lista: string) => m.set(k, [...(m.get(k) ?? []), lista]);
  for (const k of Object.keys(CUBIERTAS)) sumar(k, 'CUBIERTAS');
  for (const k of Object.keys(EXCEPCIONES)) sumar(k, 'EXCEPCIONES');
  for (const k of deudaPlana()) sumar(k, 'DEUDA');
  return m;
}

test('cada server action de app/ está clasificada: cubierta por una operación, exceptuada, o en la deuda', () => {
  const acciones = accionesDeApp();
  // El denominador: el 18/11/2026 eran 585. Si baja de golpe, el analizador dejó de verlas y el test no miraría nada.
  assert.ok(acciones.length >= 550, `el barrido dejó de ver las acciones (${acciones.length})`);
  const listas = listasDe();
  const sinClasificar = acciones.filter((k) => !listas.has(k));
  assert.deepEqual(sinClasificar, [], `estas acciones no tienen su operación en la API de MaKo. Declárala (lib/api-mako/areas/<área>.def.ts y .run.ts) y súmala a CUBIERTAS de lib/api-mako/cobertura.ts, o escribe en EXCEPCIONES por qué no va. La DEUDA no crece:\n${sinClasificar.join('\n')}`);
});

test('ninguna acción está en dos listas', () => {
  const dobles = [...listasDe()].filter(([, ls]) => ls.length > 1).map(([k, ls]) => `${k} (${ls.join(' y ')})`);
  assert.deepEqual(dobles, [], `una acción va en UNA lista:\n${dobles.join('\n')}`);
});

test('ninguna entrada quedó vieja: cada clave de las tres listas es una acción que existe', () => {
  const existen = new Set(accionesDeApp());
  const viejas = [...listasDe().keys()].filter((k) => !existen.has(k));
  assert.deepEqual(viejas, [], `estas acciones ya no existen (se renombraron, se mudaron o se borraron): sácalas de lib/api-mako/cobertura.ts:\n${viejas.join('\n')}`);
});

test('cada operación de CUBIERTAS existe en el registro de la API', () => {
  const faltan: string[] = [];
  for (const [k, ops] of Object.entries(CUBIERTAS)) {
    if (!ops.length) faltan.push(`${k}: sin operaciones`);
    for (const op of ops) if (!porId(op)) faltan.push(`${k}: «${op}» no está en lib/api-mako/registro.ts`);
  }
  assert.deepEqual(faltan, []);
});

test('cada excepción dice por qué', () => {
  const sinMotivo = Object.entries(EXCEPCIONES).filter(([, m]) => m.trim().length < 20).map(([k]) => k);
  assert.deepEqual(sinMotivo, [], `una excepción sin motivo no es una decisión:\n${sinMotivo.join('\n')}`);
});

test('la deuda sólo baja', () => {
  const n = deudaPlana().length;
  assert.equal(n, TOPE_DEUDA, n > TOPE_DEUDA
    ? `la deuda creció de ${TOPE_DEUDA} a ${n}: una acción nueva se declara en la API (CUBIERTAS) o se exceptúa con su motivo, no se suma a la DEUDA`
    : `la deuda bajó de ${TOPE_DEUDA} a ${n}: baja TOPE_DEUDA a ${n} en este test, en el mismo commit`);
});
