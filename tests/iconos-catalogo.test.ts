// =============================================================================
// El contrato de los íconos: qué se acepta, qué se guarda y qué URL sale
// =============================================================================
// El ícono de un proyecto (y de un cliente) lo sirve Iconify, y de ahí salen dos
// riesgos que no se ven leyendo la pantalla:
//
//   1. LA LICENCIA. Iconify tiene 238 sets y la respuesta de búsqueda NO dice la
//      licencia de ninguno. Solar —8.280 íconos— es CC-BY-4.0: ofrecerlo arrastra
//      una obligación de atribución que nadie va a ver hasta que sea tarde. Por eso
//      `SETS_OK` está en positivo y este test lo fija.
//   2. EL NOMBRE VIAJA EN EL PATH DE UNA URL. Un valor con `/`, `..` o `?` arma una
//      URL a otro lado, y el valor sale de la base — o sea, de lo que alguien
//      guardó alguna vez.
//
// Sin red: todo esto es forma y texto. Lo que SÍ salió a la red se midió a mano y
// está anotado en la cabecera del módulo.
//
// PROBADO ROMPIÉNDOLO:
//   · con `FORMA_NOMBRE = /^.+$/` (sin validar el nombre) → 7 pasan, 1 falla: el
//     del path. O sea que `icon:lucide:../../etc/passwd` arma una URL.
//   · agregando `solar` a `SETS_OK` → 6 y 2.
//   · restaurado → 8 de 8.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETS_OK, ORIGEN_ICONOS, ICONOS_SUGERIDOS,
  nombreDeIcono, esIcono, valorIcono, urlIcono, urlBusquedaIconos,
} from '../lib/iconos-catalogo';

test('LA LICENCIA: sólo entran sets MIT/ISC, y Solar queda afuera', () => {
  // Medido el 27/09/2026 contra https://api.iconify.design/collections.
  const PERMISIVOS = new Set(['lucide', 'tabler', 'ph', 'heroicons', 'iconoir', 'octicon', 'bi']);
  for (const s of SETS_OK) {
    assert.ok(PERMISIVOS.has(s), `«${s}» no está en la lista de sets MIT/ISC verificados`);
  }
  // Los que piden atribución o NOTICE no se pueden ofrecer ni guardar.
  for (const prohibido of ['solar', 'mdi', 'material-symbols', 'carbon', 'ri', 'mingcute']) {
    assert.equal(esIcono(`icon:${prohibido}:rocket`), false, `«${prohibido}» se está aceptando`);
    assert.equal(valorIcono(`${prohibido}:rocket`), null);
  }
});

test('el valor va y vuelve, y la URL sale del set y del nombre', () => {
  const v = valorIcono('lucide:rocket');
  assert.equal(v, 'icon:lucide:rocket');
  assert.equal(nombreDeIcono(v), 'lucide:rocket');
  assert.equal(urlIcono(v), `${ORIGEN_ICONOS}/lucide/rocket.svg`);
  assert.equal(urlIcono(v, { color: '#fff', tam: 48 }), `${ORIGEN_ICONOS}/lucide/rocket.svg?color=%23fff&width=48&height=48`);
});

test('los nombres con dígitos y guiones son válidos: son los que usan los sets', () => {
  // `bar-chart-3` y `table-2` de Lucide y `rocket-16` de Octicon existen de verdad
  // (verificados contra la API). Una regex que sólo aceptara letras los tiraría.
  for (const n of ['lucide:bar-chart-3', 'lucide:table-2', 'octicon:rocket-16', 'ph:rocket-duotone']) {
    assert.equal(nombreDeIcono(`icon:${n}`), n, `«${n}» debería ser válido`);
  }
});

test('⚠️ EL NOMBRE NO PUEDE ESCAPARSE DEL PATH', () => {
  // Es la razón de ser de la validación: el valor sale de la base y termina
  // adentro de una URL. Ninguno de éstos puede producir una URL.
  const ataques = [
    'icon:lucide:../../etc/passwd',
    'icon:lucide:a/b',
    'icon:lucide:rocket?x=1',
    'icon:lucide:rocket#frag',
    'icon:lucide:rocket.svg',
    'icon:lucide:ro cket',
    'icon:lucide:ROCKET',
    'icon:lucide:',
    'icon::rocket',
    'icon:lucide',
    'icon:',
    'icon:otro-set:rocket',
    'icon:https://evil.tld/x:y',
  ];
  for (const a of ataques) {
    assert.equal(nombreDeIcono(a), null, `«${a}» pasó la validación`);
    assert.equal(urlIcono(a), null, `«${a}» produjo una URL`);
  }
});

test('un emoji, una foto, un degradado y el vacío NO son íconos', () => {
  // Es la MISMA columna: quien dibuja tiene que poder distinguir los cuatro, y un
  // falso positivo acá pinta una imagen rota donde iba un emoji.
  for (const v of ['🚀', '', null, undefined, 'https://picsum.photos/id/1/64', 'grad:indigo', 'iconos:cohete', 'lucide:rocket']) {
    assert.equal(esIcono(v as string | null | undefined), false, `«${String(v)}» se está tomando por un ícono`);
    assert.equal(urlIcono(v as string | null | undefined), null);
  }
});

test('la búsqueda sale con los sets permitidos puestos', () => {
  const u = new URL(urlBusquedaIconos('cohete'));
  assert.equal(u.origin, ORIGEN_ICONOS);
  assert.equal(u.pathname, '/search');
  assert.equal(u.searchParams.get('query'), 'cohete');
  // Si esto se cae, la búsqueda ofrece íconos que después no se van a poder guardar:
  // el usuario elige uno y no pasa nada, que es el peor de los dos mundos.
  assert.equal(u.searchParams.get('prefixes'), SETS_OK.join(','));
});

test('la búsqueda acota lo que manda: una consulta larga no viaja entera', () => {
  const u = new URL(urlBusquedaIconos('x'.repeat(500), 99999));
  assert.equal(u.searchParams.get('query')?.length, 60);
  assert.equal(u.searchParams.get('limit'), '999');
});

test('los sugeridos son todos válidos y sin repetir', () => {
  // Un sugerido inválido no da error: deja un hueco en la grilla del selector.
  // (Que EXISTAN en Iconify se verificó contra la API; acá se fija la forma.)
  const vistos = new Set<string>();
  for (const n of ICONOS_SUGERIDOS) {
    assert.equal(nombreDeIcono(`icon:${n}`), n, `el sugerido «${n}» no valida`);
    assert.ok(!vistos.has(n), `el sugerido «${n}» está dos veces`);
    vistos.add(n);
  }
  assert.ok(ICONOS_SUGERIDOS.length >= 40, `hay ${ICONOS_SUGERIDOS.length} sugeridos: con menos de 40 la pestaña se ve a medio cargar`);
});
