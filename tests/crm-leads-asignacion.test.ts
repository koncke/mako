// =============================================================================
// Con UNA sola persona en el workspace, el lead nace CON vendedor (#39)
// =============================================================================
// `vendedorUnicoDelWorkspace` descartaba a los administradores al buscar «el único
// vendedor», así que en un workspace cuya ÚNICA persona ES admin devolvía null y
// `createLead` no escribía ni setter ni closer. Ése es el workspace propio de Martín
// —medido en producción: una fila, rol admin— y es por donde el 17/10 entran +1.000
// leads importados por CSV, que pasan por ese mismo `createLead`.
//
// Lo que el filtro quería evitar sigue valiendo y no se toca: con VARIOS vendedores,
// el admin de una agencia no se lleva los leads de todos. Lo que cambia es el caso
// opuesto, donde no hay a quién más asignarle.
//
// ⚠️ ESTE ES UN GUARD DE FUENTE Y NO DE EJECUCIÓN, a propósito y no por comodidad:
// `lib/leads.ts` abre con `import 'server-only'`, así que un test no lo puede
// importar (el paquete lanza fuera de la condición `react-server`). Lo correcto sería
// que la decisión viviera en un módulo sin `server-only` para poder correrla con una
// tabla de casos; queda declarado como pendiente porque mover la función implica
// tocar sus cuatro call sites, que están fuera de este paquete.
//
// Por eso lo que se mira es el BLOQUE de la función y con los comentarios BORRADOS:
// un `assert.match` contra el archivo entero da verde sobre el comentario que explica
// el bug, que es la trampa que AGENTS.md documenta y que acá era segura de pisar —
// este arreglo escribió `rol !== 'admin'` dentro de su propio comentario.
//
// PROBADO ROMPIÉNDOLO, las cinco cosas que persigue (en verde: 6 pases, 0 fallos):
//   1) volviendo a meter `u.rol !== 'admin'` en el armado de `personas`
//      → 1 fallo, 5 pases.  ← es EL bug de la tarjeta
//   2) borrando el `if (personas.length === 1) return personas[0].nombre;`
//      → 2 fallos, 4 pases (cae el del fallback y cae el del orden).
//   3) sacando el `...(solo ? { setter: solo, closer: solo } : {})` de `createLead`
//      → 1 fallo, 5 pases.  ← la salida sin call site
//   4) excluyendo a MaKo sólo de `vendedores` y no de `personas`
//      → 2 fallos, 4 pases.
//   5) borrando el `if (error) return null;` de la consulta
//      → 1 fallo, 5 pases.
// Y restaurado vuelve a 6/0.
//
// Correr: npx tsx --test tests/crm-leads-asignacion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * El fuente sin `\r` (el repo está en CRLF y un `\r` pegado al final de una línea
 * rompe cualquier match sin que se vea en ningún listado) y SIN COMENTARIOS.
 *
 * Primero los de línea y después los de bloque: al revés, un `//` que contenga un
 * `/*` abre un bloque que se come el resto del archivo — ya pasó con el guard de
 * voseo.
 */
function leer(ruta: string): string {
  const crudo = readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const limpio = crudo.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Si el borrado de comentarios se desbocó, todo lo de abajo da verde por la razón
  // equivocada. Un ancla que tiene que sobrevivir siempre.
  assert.ok(limpio.includes('export async function createLead'), `el limpiado de comentarios se comió ${ruta}`);
  return limpio;
}

/** El cuerpo de una función top-level: de su firma al `}` en la columna 0. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no está en el fuente: ${firma}`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de ${firma}`);
  return src.slice(i, fin + 2);
}

const LEADS = leer('../lib/leads.ts');
const FN = bloque(LEADS, 'export async function vendedorUnicoDelWorkspace');

test('la lista de personas NO filtra por rol: el admin tiene que estar adentro', () => {
  // Éste es EL bug. Si el filtro de admin vuelve al armado de `personas`, el
  // fallback de más abajo queda decorativo: en un workspace de un solo admin la
  // lista llega vacía y se vuelve a devolver null.
  const armado = FN.slice(FN.indexOf('const personas ='), FN.indexOf('const vendedores ='));
  assert.ok(armado.length > 50, 'no encontré el armado de `personas`');
  assert.doesNotMatch(
    armado,
    /rol !== 'admin'|!p\.esAdmin|esAdmin === false/,
    'volvió el filtro de admin al armado de `personas`: el workspace de una sola persona admin vuelve a crear leads sin vendedor',
  );
});

test('con UNA sola persona, ésa es el vendedor aunque sea admin', () => {
  assert.match(
    FN,
    /if \(personas\.length === 1\) return personas\[0\]\.nombre;/,
    'sin este fallback, el lead del workspace de una sola persona nace sin setter ni closer',
  );
});

test('pero el vendedor NO admin sigue ganando, y con varios no se adivina', () => {
  assert.match(FN, /const vendedores = personas\.filter\(\(p\) => !p\.esAdmin\);/);
  assert.match(FN, /if \(vendedores\.length === 1\) return vendedores\[0\]\.nombre;/);
  // El orden es la regla: primero el vendedor, después la persona única. Al revés,
  // en una agencia con un admin y un vendedor podría ganar el admin.
  assert.ok(
    FN.indexOf('if (vendedores.length === 1)') < FN.indexOf('if (personas.length === 1)'),
    'el fallback de la persona única quedó ANTES del vendedor: el admin de una agencia se lleva los leads',
  );
  // Y con dos o más, null: no hay una tercera rama que elija por su cuenta.
  assert.match(FN, /\n {4}return null;\n {2}\} catch \{ return null; \}/, 'el caso «hay varios» tiene que seguir devolviendo null');
});

test('MaKo se saca ANTES de partir en vendedores y personas, o se auto-asigna la IA', () => {
  // `MAKO_SETTER` es la firma de la IA, no alguien a quien repartirle leads. Si la
  // exclusión quedara sólo en la lista de vendedores, un workspace cuya única fila
  // fuera MaKo devolvería «MaKo» por el fallback.
  assert.match(FN, /p\.nombre !== MAKO_SETTER/);
  assert.ok(
    FN.indexOf('MAKO_SETTER') < FN.indexOf('const vendedores ='),
    'la exclusión de MaKo tiene que aplicarse al armar `personas`, no después',
  );
});

test('«no pude leer» no se convierte en «no hay nadie»', () => {
  // Con la consulta caída, inventar un vendedor o concluir que el workspace está
  // vacío son las dos formas de equivocarse. Se deja sin asignar, que es lo que una
  // persona arregla después en lote.
  assert.match(FN, /const \{ data, error \} = await getSupabaseServer\(\)/);
  assert.match(FN, /if \(error\) return null;/);
});

test('y createLead SIGUE siendo quien lo aplica (el call site, no sólo la función)', () => {
  // Una función que decide bien y que nadie llama es trabajo que no existe. Son
  // CUATRO los que la llaman; el que importa para los +1.000 importados es
  // `createLead`, porque la importación de CSV entra por ahí (app/crm/actions.ts).
  const crear = bloque(LEADS, 'export async function createLead');
  assert.match(crear, /const solo = await vendedorUnicoDelWorkspace\(\);/, 'createLead dejó de preguntar quién es el vendedor');
  assert.match(
    crear,
    /\.\.\.\(solo \? \{ setter: solo, closer: solo \} : \{\}\),/,
    'createLead pregunta y no escribe: el lead vuelve a nacer sin setter ni closer',
  );
  // Los otros tres, para que un renombre no deje a los webhooks sin asignación.
  const llamadas = LEADS.match(/await vendedorUnicoDelWorkspace\(\)/g) ?? [];
  assert.ok(llamadas.length >= 3, `en lib/leads.ts tiene que seguir llamándose en los tres caminos de alta (encontré ${llamadas.length})`);
  const ACTIONS = readFileSync(new URL('../app/crm/actions.ts', import.meta.url), 'utf8');
  assert.match(ACTIONS, /vendedorUnicoDelWorkspace\(\)/, 'el alta del CRM dejó de usarla');
});
