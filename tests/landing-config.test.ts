// =============================================================================
// La configuración es POR LANDING, no por workspace
// =============================================================================
// Con una página, guardar todo a nivel workspace funciona. Con dos, todo lo que
// la pantalla afirma es mentira la mitad de las veces: el código puede estar al
// día en una y viejo en la otra, y Clarity conectado en una y no en la otra.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conLanding, funnelIdDeLanding, landingDe, MAX_LANDINGS, parsearConfig, sinLanding, urlsDe, type LandingConfig } from '../lib/landing-config';

test('⚠️ MIGRA el formato viejo sin perder nada', () => {
  // Hasta hoy se guardaba una lista de strings. Una migración que exija convertir
  // la base primero deja a alguien sin sus páginas el día del despliegue — y acá
  // tolerar las dos formas cuesta una línea.
  assert.deepEqual(parsearConfig('["https://a.com/","https://b.com"]'),
    [{ url: 'https://a.com' }, { url: 'https://b.com' }]);
  // Y el formato nuevo, con su config propia.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","clarityProjectId":"ABC123"}]'),
    [{ url: 'https://a.com', clarityProjectId: 'abc123' }]);
  // Mezclados, que es como va a estar la base durante la transición.
  assert.equal(parsearConfig('["https://a.com",{"url":"https://b.com"}]').length, 2);
});

test('un JSON roto no deja al cliente sin páginas', () => {
  for (const v of [null, '', 'no es json', '{"no":"un array"}', '[1,2,3]', '[null]']) {
    assert.deepEqual(parsearConfig(v), [], `«${v}» tendría que dar []`);
  }
});

test('la URL es la identidad: normalizada y sin repetir', () => {
  assert.equal(parsearConfig('["https://A.com/","https://a.com"]').length, 1);
  assert.equal(landingDe([{ url: 'https://a.com' }], 'https://A.com/')?.url, 'https://a.com');
  assert.equal(landingDe([{ url: 'https://a.com' }], 'https://b.com'), null);
  assert.equal(landingDe([], null), null);
});

test('cada landing lleva SU proyecto de Clarity', () => {
  // ⚠️ Un proyecto de Clarity es de un sitio. Guardarlo por workspace hacía que
  // la segunda landing escribiera en el proyecto de la primera, mezclando las
  // grabaciones de dos negocios distintos en un mismo panel.
  let l: LandingConfig[] = [];
  l = conLanding(l, 'https://a.com', { clarityProjectId: 'aaa111' }) ?? l;
  l = conLanding(l, 'https://b.com') ?? l;
  assert.equal(landingDe(l, 'https://a.com')?.clarityProjectId, 'aaa111');
  assert.equal(landingDe(l, 'https://b.com')?.clarityProjectId, undefined);
  // Conectar la segunda no toca la primera.
  l = conLanding(l, 'https://b.com', { clarityProjectId: 'bbb222' }) ?? l;
  assert.equal(landingDe(l, 'https://a.com')?.clarityProjectId, 'aaa111');
  assert.equal(landingDe(l, 'https://b.com')?.clarityProjectId, 'bbb222');
});

// ⚠️ LA MISMA REGLA QUE YA MORDIÓ CON `esVsl` EN LOS VIDEOS: `undefined` es «no
// lo toques», no «borralo». Corregir la URL de una landing no puede
// desconectarle Clarity, porque renombrar no contesta esa pregunta.
test('corregir la URL NO desconecta Clarity', () => {
  const antes = [{ url: 'https://a.com', clarityProjectId: 'aaa111' }];
  const despues = conLanding(antes, 'https://nueva.com', {}, 'https://a.com');
  assert.equal(despues?.[0].url, 'https://nueva.com');
  assert.equal(despues?.[0].clarityProjectId, 'aaa111', 'renombrar no contesta «cuál es tu proyecto»');
  // Y desconectar explícitamente sí se puede.
  const sin = conLanding(antes, 'https://a.com', { clarityProjectId: '' });
  assert.equal(sin?.[0].clarityProjectId, undefined);
});

test('editar conserva la POSICIÓN', () => {
  // En un desplegable, que un renglón salte al final porque le corregiste una
  // letra es desconcertante.
  const antes = [{ url: 'https://a.com' }, { url: 'https://b.com' }, { url: 'https://c.com' }];
  const d = conLanding(antes, 'https://bb.com', {}, 'https://b.com');
  assert.deepEqual(urlsDe(d ?? []), ['https://a.com', 'https://bb.com', 'https://c.com']);
});

test('una URL inválida devuelve null, no una lista rota', () => {
  assert.equal(conLanding([], 'hola'), null);
});

test('borrar saca una y deja el resto', () => {
  const l = [{ url: 'https://a.com' }, { url: 'https://b.com' }];
  assert.deepEqual(urlsDe(sinLanding(l, 'https://A.com/')), ['https://b.com']);
  assert.deepEqual(urlsDe(sinLanding(l, 'no-existe')), ['https://a.com', 'https://b.com']);
});

test('hay tope', () => {
  let l: LandingConfig[] = [];
  for (let i = 0; i < MAX_LANDINGS + 5; i++) l = conLanding(l, `https://p${i}.com`) ?? l;
  assert.equal(l.length, MAX_LANDINGS);
});

test('lo que se guarda vuelve a leerse igual', () => {
  const orig = conLanding(conLanding([], 'https://a.com', { clarityProjectId: 'aaa111' }) ?? [], 'https://b.com') ?? [];
  assert.deepEqual(parsearConfig(JSON.stringify(orig)), orig);
});

// =============================================================================
// CABLEADO
// =============================================================================
import { readFileSync } from 'node:fs';
const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('CABLEADO: la migración es PEREZOSA, nadie se queda sin sus páginas', () => {
  // Mientras nadie haya guardado en el formato nuevo, se leen las viejas. Así el
  // despliegue no deja la lista vacía, y la primera vez que se toque algo queda
  // migrado — sin un script que haya que acordarse de correr, que es como se
  // migran a medias las cosas.
  const acc = leer('../app/integraciones/landing-config-actions.ts');
  assert.ok(/parsearPaginas\(await getSetting\(PAGINAS_KEY\)\)/.test(acc), 'sin el respaldo al formato viejo, el despliegue vacía la lista');
  assert.ok(/requireRolWs\(\[\], \{ nav: 'integraciones' \}\)/.test(acc), 'las landings son config del cliente: van detrás del gate de la tab');
});

test('CABLEADO: el análisis viaja como ARRAY, no como Set', () => {
  // ⚠️ Un `Set` no sobrevive a un server action: se serializa como `{}`. Es el
  // tipo de detalle que en desarrollo no se ve y en producción deja la lista de
  // piezas vacía sin ningún error.
  const acc = leer('../app/integraciones/landing-config-actions.ts');
  assert.ok(/piezas: \[\.\.\.a\.piezas\]/.test(acc), 'el Set se pierde al cruzar al cliente');
  // Y devuelve lo que la landing DECLARA y lo que MaKo tiene guardado, para poder
  // compararlos: «esta página tiene el Clarity de otro proyecto» solo se puede
  // decir teniendo los dos.
  assert.ok(/clarityGuardado/.test(acc), 'sin el guardado no se puede detectar un id que no corresponde');
});

// =============================================================================
// El PRODUCTO de cada landing (04/10/2026)
// =============================================================================
// Decisión de Martín: «la configuración que falta es que el pixel deberíamos
// poder ASIGNAR a un PRODUCTO. Con la implementación que hicimos, para que
// lleguen los leads a ese CRM y no a otro».
//
// ⚠️ DOS SUJETOS EN CADA PRUEBA: una landing CON producto y otra SIN. Con una
// sola, una resolución cableada al embudo por defecto —o una que devuelva siempre
// el mismo número— pasa todas las pruebas.

test('el producto es de la PÁGINA: una landing con producto y otra sin', () => {
  const cfgs = parsearConfig(JSON.stringify([
    { url: 'https://vende-cursos.com', funnelId: 7 },
    { url: 'https://vende-inmuebles.com' },
  ]));
  assert.equal(funnelIdDeLanding(cfgs, 'https://vende-cursos.com'), 7);
  // Sin asignar es `null`, y `null` es el embudo DEL NEGOCIO: es donde caen hoy
  // todos los leads de landing y donde tienen que seguir cayendo.
  assert.equal(funnelIdDeLanding(cfgs, 'https://vende-inmuebles.com'), null);
  // Y una página que el cliente no declaró tampoco inventa un producto.
  assert.equal(funnelIdDeLanding(cfgs, 'https://otra.com'), null);
  assert.equal(funnelIdDeLanding(cfgs, null), null);

  // Se compara NORMALIZADO en las dos puntas: la lista guardada está normalizada
  // y lo que llega en el opt-in es `location.href`, con su barra, su hash y los
  // UTM de la campaña. Un `===` crudo diría «esta página no tiene producto» sobre
  // la página que lo tiene.
  assert.equal(funnelIdDeLanding(cfgs, 'https://vende-cursos.com/?utm_source=ig#form'), 7);
  assert.equal(funnelIdDeLanding(cfgs, 'VENDE-CURSOS.com'), 7);
});

// PROBADO ROMPIENDOLO: cambiando el `idFila(...)` de `parsearConfig` por un cast
// crudo, este archivo pasa de **pass 17 / fail 0** a **pass 16 / fail 1**.
test('⚠️ el id puede llegar como STRING (bigint) y la basura no pasa', () => {
  // `funnels.id` es bigint y en este repo ya se midió que según el driver vuelve
  // como texto. Un `funnelId: "7"` que se guarde tal cual haría que el `===` del
  // validador diera false SIEMPRE: nadie entraría nunca a su producto.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelId":"7"}]'),
    [{ url: 'https://a.com', funnelId: 7 }]);
  for (const v of ['0', '-3', '1.5', 'siete', '', 'null']) {
    assert.deepEqual(parsearConfig(`[{"url":"https://a.com","funnelId":${JSON.stringify(v)}}]`),
      [{ url: 'https://a.com' }], `«${v}» no es un id de fila`);
  }
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelId":0}]'), [{ url: 'https://a.com' }]);
});

// PROBADO ROMPIENDOLO: cambiando `: base?.funnelId;` por `: undefined;` en
// `conLanding`, este archivo pasa de **pass 17 / fail 0** a **pass 16 / fail 1**.
test('⚠️ corregir la URL NO desasigna el producto, y el 0 sí', () => {
  // Es la misma trampa que ya mordió con `clarityProjectId` y con `esVsl`:
  // `conLanding` reconstruye la fila campo por campo, así que un campo que el
  // mapper no conserva se apaga solo en el próximo guardado de cualquier otro.
  const base = parsearConfig('[{"url":"https://a.com","funnelId":7},{"url":"https://b.com","funnelId":9}]');

  const renombrada = conLanding(base, 'https://a-nueva.com', {}, 'https://a.com');
  assert.deepEqual(renombrada, [{ url: 'https://a-nueva.com', funnelId: 7 }, { url: 'https://b.com', funnelId: 9 }]);

  // Guardar OTRO campo tampoco lo toca.
  const conClarity = conLanding(base, 'https://a.com', { clarityProjectId: 'ABC' });
  assert.equal(funnelIdDeLanding(conClarity ?? [], 'https://a.com'), 7);
  // …y no le toca el producto a la vecina.
  assert.equal(funnelIdDeLanding(conClarity ?? [], 'https://b.com'), 9);

  // Lo único que desasigna es un 0 explícito, y solo a ESA página.
  const sinProducto = conLanding(base, 'https://a.com', { funnelId: 0 });
  assert.equal(funnelIdDeLanding(sinProducto ?? [], 'https://a.com'), null);
  assert.equal(funnelIdDeLanding(sinProducto ?? [], 'https://b.com'), 9);

  // Y reasignar pisa solo el valor.
  const movida = conLanding(base, 'https://a.com', { funnelId: 9 });
  assert.equal(funnelIdDeLanding(movida ?? [], 'https://a.com'), 9);
});

// PROBADO ROMPIENDOLO: cambiando `return elegido.esDefault ? null : id;` por
// `return id;`, este archivo pasa de **pass 17 / fail 0** a **pass 16 / fail 1**.
test('CABLEADO: el EMBUDO DEL NEGOCIO se escribe como null, nunca con su id', () => {
  // ⚠️ `listLeadsDeFunnel(null)` pide los leads del tablero por defecto con
  // `.is('funnel_id', null)`, así que un lead nacido con el ID del embudo por
  // defecto DESAPARECE de la única pantalla que el cliente mira — con el producto
  // correcto escrito en la fila y sin un solo error.
  const lib = leer('../lib/landing-funnel.ts');
  assert.ok(/esDefault \? null : id/.test(lib), 'el default tiene que resolver a null: con su id, el lead sale del tablero por defecto');
  // Y se valida contra la misma lista que ofrece la pantalla: un embudo borrado o
  // archivado cae al del negocio en vez de romper el alta con una violación de FK.
  assert.ok(/productosAsignables\(\)/.test(lib), 'sin validar, un id viejo rompe el insert y el lead cae a propuesta');
  // ⚠️ El ws se pinnea: `getSetting` resuelve el workspace del request (cookies) y
  // la ruta del opt-in no tiene sesión.
  assert.ok(/runWithWorkspace\(ws,/.test(lib), 'sin pinnear el ws, lee la config del inquilino del contexto');
  // La pantalla y la ruta leen el MISMO módulo: con dos lectores, la pantalla
  // puede ofrecer un producto al que el lead nunca llega.
  const acc = leer('../app/integraciones/landing-config-actions.ts');
  assert.ok(/from '@\/lib\/landing-funnel'/.test(acc), 'la pantalla ofrece lo que la ruta resuelve, no su propia lista');
});

// PROBADO ROMPIENDOLO: cambiando `otros.length > 0` por `true` en
// SelectorLanding.tsx, este archivo pasa de **pass 17 / fail 0** a
// **pass 16 / fail 1**.
test('CABLEADO: la pantalla donde se asigna es la del Pixel, el paso 1', () => {
  // No hay pantalla nueva: se asigna donde ya se elige la página y se copia el
  // código. El rótulo es el PRODUCTO y no el nombre del embudo — «Funnel
  // principal» lo puso la migración 0170 y es el mismo en todos los workspaces.
  const sel = leer('../app/integraciones/SelectorLanding.tsx');
  assert.ok(/getProductosAction\(\)/.test(sel), 'el selector tiene que pedir los productos');
  assert.ok(/asignarProducto/.test(sel), 'y tiene que poder guardarlos');
  assert.ok(/funnelId: Number\(v\) \|\| 0/.test(sel), 'el 0 es lo que desasigna: `undefined` sería «no lo toques»');
  // ⚠️ Con UN solo producto no se dibuja: un desplegable de un elemento no ofrece
  // una decisión, ofrece confirmar la única que hay.
  assert.ok(/otros\.length > 0/.test(sel), 'con un solo producto no hay nada que elegir');
  // ⚠️ Y el valor guardado entra a la lista aunque ya no se pueda elegir: un
  // `<select>` cuyo `value` no está entre sus opciones no muestra nada y el primer
  // click escribe la primera.
  assert.ok(/huerfano/.test(sel), 'un producto archivado no puede borrar la asignación con el primer click');
});
