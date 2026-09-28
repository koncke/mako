// =============================================================================
// La capa de la PLATAFORMA no se ofrece como un plan
// =============================================================================
// `superadmin` no es algo que un cliente compre: es CÓMO SE IDENTIFICA MaKo.
// `wsSuperAdmin()` (lib/workspace.ts) devuelve el workspace de MENOR id con esa
// capa y lo cachea a nivel de módulo, así que ponérsela a un cliente muda la
// identidad de la plataforma a su workspace — de ahí salen las credenciales y el
// remitente de los mails de acceso. Es la misma familia que «OWNER_WS no es la
// plataforma: es un cliente».
//
// El panel de clientes la ofrecía en DOS lugares —el alta y el «Pasar a …» de
// cada tarjeta— porque las dos listas eran `CAPAS_LISTA`, el catálogo entero. No
// hacía falta ningún bug: alcanzaba con un click.
//
// ⚠️ Probado ROMPIÉNDOLO: cambiando `CAPAS_VENDIBLES` por `CAPAS_LISTA` en
// lib/capas.ts, este archivo pasa de 5/5 a **2 FALLOS** — «la capa de la
// plataforma NO se vende» y «lo vendible es un subconjunto…». Los otros tres
// siguen en verde porque miran el catálogo, que no cambia.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPAS_LISTA, CAPAS_VENDIBLES, CAPA_DEFAULT, capaDef, esCapaValida } from '../lib/capas';

test('la capa de la plataforma NO se vende', () => {
  assert.ok(CAPAS_LISTA.some((c) => c.id === 'superadmin'), 'sigue existiendo en el catálogo');
  assert.ok(!CAPAS_VENDIBLES.some((c) => c.id === 'superadmin'),
    'pero NO se puede elegir desde una pantalla');
});

test('lo vendible es un subconjunto del catálogo, nunca al revés', () => {
  // Al revés sería ofrecer una capa que `capaDef` no conoce, y `capaDef` es
  // fail-open: ese cliente vería todas las tabs del producto.
  for (const c of CAPAS_VENDIBLES) {
    assert.ok(esCapaValida(c.id), `${c.id} está en la lista de venta y no en el catálogo`);
  }
  assert.ok(CAPAS_VENDIBLES.length < CAPAS_LISTA.length, 'algo tiene que quedar afuera');
  assert.ok(CAPAS_VENDIBLES.length > 0, 'y algo tiene que quedar adentro');
});

test('el nombre del super admin ya no dice «agencia»', () => {
  // «Un SuperAdmin NO es lo mismo que agencia» (27/09/2026). Una agencia es un
  // CLIENTE que además tiene clientes propios; el super admin es la plataforma.
  const sa = CAPAS_LISTA.find((c) => c.id === 'superadmin')!;
  assert.ok(!/agencia/i.test(sa.nombre), `el rótulo sigue diciendo «${sa.nombre}»`);
});

test('la capa por defecto se puede vender', () => {
  // Si el default no estuviera en la lista, el alta abriría con un valor que el
  // propio dropdown no ofrece — y el `<select>` mostraría la primera opción sobre
  // un estado que dice otra cosa.
  assert.ok(CAPAS_VENDIBLES.some((c) => c.id === CAPA_DEFAULT));
});

test('capaDef es FAIL-OPEN, y por eso el CHECK de la base no es un trámite', () => {
  // Esto no es un deseo: es lo que el código hace. Se fija acá para que quede
  // medido, porque el comentario del módulo decía lo contrario durante meses.
  // Una capa desconocida NO cae a la más restrictiva: cae a 'completo', que tiene
  // `navKeys: null` — todas las tabs.
  const desconocida = capaDef('una-capa-que-no-existe');
  assert.equal(desconocida.id, CAPA_DEFAULT);
  assert.equal(desconocida.navKeys, null, 'el default ve TODO: por eso el fail-open duele');
});
