// Por qué una corrida de la biblioteca de carruseles se detiene (lib/carruseles/biblioteca.ts: `motivoDelTecho`,
// `planDeTandas`, `porQueParo`). Corre el código y mira el resultado; nada de leer el fuente.
//
// El caso que lo trajo (medido el 6/11/2026): `laminas` paró diciendo «Llega al techo» con US$0,54 gastados de un tope PEDIDO
// de US$1,50, y de la salida no se podía saber si faltaba crédito o si era un límite nuestro. Eran las dos cosas: el techo
// efectivo lo ponía el crédito (US$0,70, no 1,50) y lo que se comparaba contra él era la suma de los techos de cada tanda
// —con su margen del 1,5×— en vez del gasto. 200 links leídos de 400, y la salida no decía ninguno de los dos números.
//
// Probado rompiéndolo (6/11/2026), base 8 verdes / 0 rojos:
//   · `motivoDelTecho` que contesta 'pedido' aunque el crédito no llegue a lo pedido → 1 rojo;
//   · `motivoDelTecho` sin descontar la reserva de Spy → 2 rojos;
//   · `siguienteTanda` que acumula el margen del 1,5× en vez del precio medido → 1 rojo (corta una tanda antes);
//   · `siguienteTanda` que descarta la tanda entera en vez de recortarla a lo que cabe → 2 rojos;
//   · `siguienteTanda` sin recortar el `maxTotalChargeUsd` de la tanda a lo que queda del techo → 1 rojo (se pasa del techo);
//   · `techoDeTanda` sin su margen (Apify cortaría la tanda a mitad) → 1 rojo;
//   · `porQueParo` que contesta lo mismo para «sin crédito» y «llegué a tu tope» → 1 rojo;
//   · `porQueParo` sin el número del techo → 1 rojo;
//   · `porQueParo` que culpa al techo cuando se leyó todo → 1 rojo.
//   · Y el cambio SIN efecto (renombrar `probable` en `planDeTandas`) lo deja verde: 0 rojos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINKS_POR_TANDA, MARGEN_TECHO_TANDA, RESERVA_CREDITO_USD, USD_POR_LINK_MEDIDO,
  motivoDelTecho, planDeTandas, porQueParo, siguienteTanda, techoConCredito, techoDeTanda,
} from '../lib/carruseles/biblioteca';
import { USD_POR_PUBLICACION } from '../lib/spy-todo-reglas';

/** Lo que de verdad tenía la clave de Spy de la plataforma el 6/11/2026 a la tarde: US$1,98 libres de US$10. */
const CLAVE_DEL_6_11 = { usado: 8.02, tope: 10 };

test('el techo dice DE DÓNDE sale: no hay crédito, el crédito no llega, o es el tope que pediste', () => {
  // Lo medido el 6/11/2026: quedan US$1,98 y la reserva de Spy son US$2 → la corrida no puede gastar nada.
  const sinCredito = motivoDelTecho(1, CLAVE_DEL_6_11, RESERVA_CREDITO_USD);
  assert.equal(sinCredito.techo, 0);
  assert.equal(sinCredito.motivo, 'sin-credito');
  assert.match(sinCredito.porque, /US\$1\.98/, 'dice cuánto queda de verdad');
  assert.match(sinCredito.porque, /US\$2\.00/, 'dice cuánto es la reserva');

  // El caso del 6/11 a la mañana: quedaban US$2,70, la reserva 2 → el techo es 0,70 y no los 1,50 que se pidieron.
  const porCredito = motivoDelTecho(1.5, { usado: 7.3, tope: 10 }, RESERVA_CREDITO_USD);
  assert.equal(porCredito.techo, 0.7);
  assert.equal(porCredito.motivo, 'credito');
  assert.match(porCredito.porque, /US\$0\.70/);
  assert.match(porCredito.porque, /US\$1\.50/, 'dice también lo que se pidió, para que se vea la diferencia');

  // Con crédito de sobra, el techo es el pedido y lo dice.
  const porPedido = motivoDelTecho(1.5, { usado: 1, tope: 10 }, RESERVA_CREDITO_USD);
  assert.equal(porPedido.techo, 1.5);
  assert.equal(porPedido.motivo, 'pedido');
  assert.match(porPedido.porque, /US\$1\.50/);

  // Sin saber el crédito no se gasta a ciegas (es lo que ya hacía `techoConCredito`, y ahora se explica).
  const sinSaber = motivoDelTecho(1.5, null, RESERVA_CREDITO_USD);
  assert.equal(sinSaber.techo, null);
  assert.equal(sinSaber.motivo, 'sin-saber');
  assert.equal(techoConCredito(1.5, null, RESERVA_CREDITO_USD), null, 'el número solo sigue siendo el de antes');
});

test('el número del techo es el MISMO que el de `techoConCredito`: la explicación no cambia la plata', () => {
  for (const credito of [CLAVE_DEL_6_11, { usado: 7.3, tope: 10 }, { usado: 1, tope: 10 }, { usado: 0, tope: 5 }]) {
    for (const pedido of [0.5, 1, 1.5, 2]) {
      assert.equal(motivoDelTecho(pedido, credito, RESERVA_CREDITO_USD).techo, techoConCredito(pedido, credito, RESERVA_CREDITO_USD),
        `pedido ${pedido} con ${credito.usado}/${credito.tope}`);
    }
  }
});

test('el plan de tandas mide el techo con el GASTO probable, no con la suma de los márgenes', () => {
  // El caso real: 400 links con un techo efectivo de US$0,70.
  const p = planDeTandas(400, { techoUsd: 0.7 });
  const leidos = p.tandas.reduce((n, t) => n + t.cuantos, 0);
  // Al precio medido (US$0,0027) en 0,70 entran 259 links. El código viejo sumaba el techo de cada tanda (US$0,14 por 40
  // links, 1,5× el precio de lista) y cortaba en 200: una tanda entera de menos.
  assert.ok(leidos > 200, `lee más que los 200 de antes (leyó ${leidos})`);
  assert.ok(leidos <= 259, `y nunca más de los que paga el techo (leyó ${leidos})`);
  assert.equal(p.quedanFuera, 400 - leidos);
  assert.equal(p.corte, 'techo');
  // Lo probable no se pasa del techo, y es lo que de verdad se iba a gastar.
  assert.ok(p.probableUsd <= 0.7 + 1e-9, `probable ${p.probableUsd} dentro del techo`);
  assert.ok(p.probableUsd > 0.65, `y lo aprovecha (${p.probableUsd})`);
});

test('la última tanda se recorta a lo que cabe, y ninguna puede cobrar más de lo que quedaba al empezarla', () => {
  const p = planDeTandas(400, { techoUsd: 0.7 });
  const ultima = p.tandas[p.tandas.length - 1];
  assert.ok(ultima.cuantos >= 1 && ultima.cuantos < LINKS_POR_TANDA, `la última va recortada (${ultima.cuantos} links)`);
  // El `maxTotalChargeUsd` de cada tanda lleva margen (Apify no la corta a mitad) pero nunca pasa lo que quedaba del techo.
  let probable = 0;
  let esperado = 0;
  for (const t of p.tandas) {
    assert.ok(t.techoUsd > 0, 'ninguna tanda sale con techo cero (Apify no traería nada)');
    assert.ok(t.techoUsd <= Math.round((0.7 - probable) * 100) / 100 + 1e-9, `una tanda con techo ${t.techoUsd} y ${0.7 - probable} de margen`);
    assert.equal(t.desde, esperado, 'las tandas van en orden, sin huecos ni solapes');
    probable = Math.round((probable + t.cuantos * USD_POR_LINK_MEDIDO) * 100) / 100;
    esperado += t.cuantos;
  }
});

test('la corrida de verdad usa la MISMA regla con lo que Apify ya cobró, y así el margen no gasta de más', () => {
  // Es el bucle del script: pide una tanda, cuenta lo que LLEGÓ, y vuelve a preguntar con lo que queda del techo.
  const correr = (total: number, techo: number, llegan: (pedidos: number) => number) => {
    let pedidos = 0;
    let cobrado = 0;
    let tandas = 0;
    for (;;) {
      const t = siguienteTanda(total - pedidos, Math.round((techo - cobrado) * 100) / 100);
      if (!t) break;
      tandas += 1;
      cobrado = Math.round((cobrado + llegan(t.cuantos) * USD_POR_LINK_MEDIDO) * 100) / 100;
      pedidos += t.cuantos;
    }
    return { pedidos, cobrado, tandas };
  };
  // Con todo lo pedido llegando, el gasto no pasa el techo y se leen más de los 200 que leía antes.
  const lleno = correr(400, 0.7, (n) => n);
  assert.ok(lleno.cobrado <= 0.7 + 1e-9, `cobrado ${lleno.cobrado} dentro del techo`);
  assert.ok(lleno.pedidos > 200, `leyó ${lleno.pedidos}, más que los 200 de antes`);
  // Links muertos (el 6/11: carruseles borrados o privados): si no llega nada, no se cobra nada y se sigue leyendo TODO.
  // El código viejo descontaba el techo de la tanda igual y cortaba «al techo» sin haber gastado.
  const muertos = correr(400, 0.7, () => 0);
  assert.equal(muertos.pedidos, 400, 'una tanda que no trajo nada no gasta el techo de nadie');
  assert.equal(muertos.cobrado, 0);
  // Y nunca entra en bucle: cada vuelta pide al menos un link.
  assert.ok(muertos.tandas <= Math.ceil(400 / LINKS_POR_TANDA) + 1, `${muertos.tandas} tandas para 400 links`);
  // Sin techo no se pide nada, ni una vuelta.
  assert.equal(siguienteTanda(400, 0), null);
  assert.equal(siguienteTanda(400, -1), null, 'un techo negativo tampoco pide');
  assert.equal(siguienteTanda(0, 5), null, 'sin links que leer, tampoco');
  // Un techo que no paga ni un link es un «no», no una tanda de cero.
  assert.equal(siguienteTanda(400, USD_POR_LINK_MEDIDO / 2), null);
  assert.equal(siguienteTanda(400, 0.01)?.cuantos, 3, 'con un centavo entran 3 links al precio medido');
});

test('todo lo que entra se lee: con techo de sobra no queda ninguno afuera, y sin techo no se pide nada', () => {
  const holgado = planDeTandas(168, { techoUsd: 1 });
  assert.equal(holgado.quedanFuera, 0);
  assert.equal(holgado.corte, 'todo', 'paró porque se terminaron las tandas');
  assert.equal(holgado.tandas.length, Math.ceil(168 / LINKS_POR_TANDA));
  assert.equal(holgado.tandas.reduce((n, t) => n + t.cuantos, 0), 168);

  // Techo cero (el 6/11: la clave sin crédito libre): ni una tanda, y el corte lo dice.
  const sinTecho = planDeTandas(168, { techoUsd: 0 });
  assert.deepEqual(sinTecho.tandas, []);
  assert.equal(sinTecho.quedanFuera, 168);
  assert.equal(sinTecho.corte, 'sin-techo');
  assert.equal(sinTecho.probableUsd, 0);

  // Nada que leer no es un corte: no quedó nada afuera.
  assert.equal(planDeTandas(0, { techoUsd: 1 }).corte, 'todo');
  assert.equal(planDeTandas(0, { techoUsd: 0 }).corte, 'todo');
});

test('el techo de una tanda lleva su margen sobre el precio de LISTA, y el plan mide con el precio MEDIDO', () => {
  assert.equal(techoDeTanda(40), Math.ceil(40 * USD_POR_PUBLICACION * MARGEN_TECHO_TANDA * 100) / 100);
  assert.equal(techoDeTanda(40), 0.14, 'los US$0,14 por tanda de 40 que ya usaba el script');
  assert.ok(techoDeTanda(40) > 40 * USD_POR_LINK_MEDIDO, 'el techo de la tanda cubre el precio medido, que es más alto que el de lista');
  assert.ok(USD_POR_LINK_MEDIDO > USD_POR_PUBLICACION, 'lo medido cuesta más que el precio de la tienda: un techo que cree en la lista se pasa');
  assert.ok(techoDeTanda(0) > 0, 'una tanda vacía no pide un techo de cero');
});

test('«al techo» a secas no alcanza: cada corte dice su causa, su número y qué lo destraba', () => {
  const base = { quedanFuera: 146, techo: 0.7 };
  const sinCredito = porQueParo({ ...base, corte: 'sin-techo', ...motivoDelTecho(1, CLAVE_DEL_6_11, RESERVA_CREDITO_USD) });
  const miTope = porQueParo({ ...base, corte: 'techo', ...motivoDelTecho(0.7, { usado: 1, tope: 10 }, RESERVA_CREDITO_USD) });
  const seTermino = porQueParo({ ...base, corte: 'todo', quedanFuera: 0, ...motivoDelTecho(1, { usado: 1, tope: 10 }, RESERVA_CREDITO_USD) });

  // Los tres dicen cosas distintas: es todo el punto.
  assert.notEqual(sinCredito, miTope);
  assert.notEqual(miTope, seTermino);
  assert.match(sinCredito, /crédito/i);
  assert.match(sinCredito, /US\$1\.98/, 'cuánto queda de verdad');
  assert.doesNotMatch(sinCredito, /subí/i, 'subir el tope no lo destraba');
  assert.match(miTope, /tope que me pediste/i);
  assert.match(miTope, /US\$0\.70/, 'con el número del tope');
  assert.match(miTope, /techo-usd/, 'y qué lo destraba');
  assert.match(seTermino, /se terminaron las tandas/i);
  assert.doesNotMatch(seTermino, /crédito/i, 'leer todo no es un problema de plata');

  // El gasto real, cuando se sabe, va en el mismo renglón: es el número que faltaba el 6/11.
  assert.match(porQueParo({ ...base, corte: 'techo', gastado: 0.54, ...motivoDelTecho(1.5, { usado: 7.3, tope: 10 }, RESERVA_CREDITO_USD) }), /US\$0\.54/);
  // Y sin saber el crédito tampoco se culpa al tope.
  assert.match(porQueParo({ ...base, corte: 'techo', ...motivoDelTecho(1.5, null, RESERVA_CREDITO_USD) }), /no se gasta a ciegas|no dijo/i);
});

test('un «no queda crédito» que dice APIFY a mitad de la corrida no se cuenta como el techo', () => {
  // El crédito se agota mientras la corrida avanza: al empezar el techo era el pedido y tenía lugar de sobra. Si ese corte se
  // contara como techo, el renglón final diría «llegué al tope que me pediste» sobre un tope que no se tocó.
  const conLugar = motivoDelTecho(1.5, { usado: 1, tope: 10 }, RESERVA_CREDITO_USD);
  assert.equal(conLugar.motivo, 'pedido', 'al empezar el techo era el pedido');
  const apify = porQueParo({ ...conLugar, corte: 'apify', quedanFuera: 120, gastado: 0.33 });
  assert.match(apify, /Apify dijo que no queda crédito/i);
  // En neutro, como todo el copy del repo (el guard de tests/puente-panel-copy.test.ts barre también esta salida).
  assert.match(apify, /Carga crédito/i, 'y qué lo destraba');
  assert.doesNotMatch(apify, /tope que me pediste/i, 'nunca le echa la culpa al tope');
  assert.match(apify, /120/, 'con cuántos quedaron sin leer');
  assert.match(apify, /US\$0\.33/, 'y lo que se gastó');
  // Y es distinto de los otros tres cortes con el mismo techo.
  for (const corte of ['todo', 'techo', 'sin-techo'] as const) assert.notEqual(apify, porQueParo({ ...conLugar, corte, quedanFuera: 120, gastado: 0.33 }));
});
