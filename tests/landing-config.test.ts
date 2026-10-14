// =============================================================================
// La configuración es POR LANDING, no por workspace
// =============================================================================
// Con una página, guardar todo a nivel workspace funciona. Con dos, todo lo que
// la pantalla afirma es mentira la mitad de las veces: el código puede estar al
// día en una y viejo en la otra, y Clarity conectado en una y no en la otra.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conLanding, funnelIdsDeLanding, landingDe, MAX_LANDINGS, parsearConfig, sinLanding, urlsDe, type LandingConfig } from '../lib/landing-config';

/**
 * El fuente SIN sus comentarios, para los `doesNotMatch`.
 *
 * ⚠️ HACE FALTA, y lo probó este mismo archivo: la convención de la casa es
 * explicar en el comentario lo que se SACÓ —acá, que el selector de página ya no
 * escribe `funnelIds`—, así que un guard de «esto no está» se acusa a sí mismo.
 * Las líneas van ANTES que los bloques: un `/*` dentro de un `//` abriría un
 * bloque que se cierra páginas abajo y se come el código del medio.
 */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('⚠️ MIGRA el formato viejo sin perder nada', () => {
  // Hasta hoy se guardaba una lista de strings. Una migración que exija convertir
  // la base primero deja a alguien sin sus páginas el día del despliegue — y acá
  // tolerar las dos formas cuesta una línea.
  assert.deepEqual(parsearConfig('["https://a.com/","https://b.com"]'),
    [{ url: 'https://a.com' }, { url: 'https://b.com' }]);
  // Y el formato nuevo, con su config propia.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelIds":[7]}]'),
    [{ url: 'https://a.com', funnelIds: [7] }]);
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

test('cada landing lleva SUS productos', () => {
  // La configuración es de la PÁGINA: asignarle productos a una no puede tocar la
  // otra. (Hasta el 06/10/2026 este test usaba el proyecto de Clarity de cada
  // página como ejemplo; Clarity salió del producto y la regla quedó.)
  let l: LandingConfig[] = [];
  l = conLanding(l, 'https://a.com', { funnelIds: [7] }) ?? l;
  l = conLanding(l, 'https://b.com') ?? l;
  assert.deepEqual(landingDe(l, 'https://a.com')?.funnelIds, [7]);
  assert.equal(landingDe(l, 'https://b.com')?.funnelIds, undefined);
  // Asignarle a la segunda no toca la primera.
  l = conLanding(l, 'https://b.com', { funnelIds: [9] }) ?? l;
  assert.deepEqual(landingDe(l, 'https://a.com')?.funnelIds, [7]);
  assert.deepEqual(landingDe(l, 'https://b.com')?.funnelIds, [9]);
});

// PROBADO ROMPIENDOLO: reponiendo en `parsearConfig` la lectura de
// `clarityProjectId`, este test falla (la fila vuelve con el campo).
test('⚠️ una fila guardada con el proyecto de Clarity se lee igual, sin él', () => {
  // Clarity salió del producto el 06/10/2026 y no se migró ninguna fila: las que
  // todavía traen `clarityProjectId` se tienen que leer sanas —con su URL y sus
  // productos— y el campo viejo se cae solo. Si la lectura tirara la fila entera
  // por un campo que no conoce, el cliente se quedaría sin su página.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","clarityProjectId":"aaa111","funnelIds":[7]}]'),
    [{ url: 'https://a.com', funnelIds: [7] }]);
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","clarityProjectId":"aaa111"}]'),
    [{ url: 'https://a.com' }]);
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
  const orig = conLanding(conLanding([], 'https://a.com', { funnelIds: [7, 9] }) ?? [], 'https://b.com') ?? [];
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
  // ⚠️ Desde el 06/10/2026 la migración vive en `lib/landing-config-leer.ts`, que es
  // el lector que comparten el server de la pantalla y las actions que guardan.
  const lector = leer('../lib/landing-config-leer.ts');
  assert.ok(/parsearPaginas\(await getSetting\(PAGINAS_KEY\)\)/.test(lector), 'sin el respaldo al formato viejo, el despliegue vacía la lista');
  // Y las dos puertas que lo usan siguen detrás del gate de la tab: el lector no
  // lo lleva adentro a propósito, para no pagarlo dos veces en cada guardado.
  const acc = leer('../app/integraciones/landing-config-actions.ts');
  assert.ok(/requireRolWs\(\[\], \{ nav: 'integraciones' \}\);\s+return landingsDelWorkspace\(\);/.test(acc), 'las actions leen detrás del gate');
  const page = leer('../app/integraciones/page.tsx');
  assert.ok(/await requireRolWs\(\[\], \{ nav: 'integraciones' \}\);/.test(page), 'la pantalla también');
});

test('CABLEADO: el análisis viaja como ARRAY, no como Set', () => {
  // ⚠️ Un `Set` no sobrevive a un server action: se serializa como `{}`. Es el
  // tipo de detalle que en desarrollo no se ve y en producción deja la lista de
  // piezas vacía sin ningún error.
  const acc = leer('../app/integraciones/landing-config-actions.ts');
  assert.ok(/piezas: \[\.\.\.a\.piezas\]/.test(acc), 'el Set se pierde al cruzar al cliente');
});

// =============================================================================
// Los PRODUCTOS de cada landing (04/10/2026, y VARIOS desde el 06/10/2026)
// =============================================================================
// Decisión de Martín el 04/10: «la configuración que falta es que el pixel
// deberíamos poder ASIGNAR a un PRODUCTO. Con la implementación que hicimos, para
// que lleguen los leads a ese CRM y no a otro».
//
// Y el 06/10: «no solo se debería poder seleccionar 1 producto, si quiero puedo
// seleccionar más de 1», con la semántica que eligió él — «el lead entra a TODOS
// los productos», o sea una FICHA por producto, la misma persona en N tableros.
//
// ⚠️ DOS SUJETOS EN CADA PRUEBA: una landing CON productos y otra SIN. Con una
// sola, una resolución cableada al embudo por defecto —o una que devuelva siempre
// el mismo número— pasa todas las pruebas.

test('los productos son de la PÁGINA: una landing con productos y otra sin', () => {
  const cfgs = parsearConfig(JSON.stringify([
    { url: 'https://vende-cursos.com', funnelIds: [7, 9] },
    { url: 'https://vende-inmuebles.com' },
  ]));
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://vende-cursos.com'), [7, 9]);
  // Sin asignar es la lista VACÍA, y vacía significa el embudo DEL NEGOCIO: es
  // donde caen hoy todos los leads de landing y donde tienen que seguir cayendo.
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://vende-inmuebles.com'), []);
  // Y una página que el cliente no declaró tampoco inventa un producto.
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://otra.com'), []);
  assert.deepEqual(funnelIdsDeLanding(cfgs, null), []);

  // Se compara NORMALIZADO en las dos puntas: la lista guardada está normalizada
  // y lo que llega en el opt-in es `location.href`, con su barra, su hash y los
  // UTM de la campaña. Un `===` crudo diría «esta página no tiene producto» sobre
  // la página que lo tiene.
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://vende-cursos.com/?utm_source=ig#form'), [7, 9]);
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'VENDE-CURSOS.com'), [7, 9]);
});

// La mudanza de las landings del editor a hola-mako.site (integración de la tanda 4, 14/10/2026): una
// página declarada ANTES (`hola-mako.com/l/<slug>`) y la que manda el Pixel DESPUÉS
// (`hola-mako.site/<slug>`, `location.href`) son la misma landing. Sin la traducción en las dos puntas,
// el lead caía en el embudo del negocio y no en el producto de la página, sin un error.
// PROBADO ROMPIÉNDOLO (14/10/2026), base 24 / 0, restaurado de memoria (sha256 igual):
//   · landingDe sin urlLandingVigente (la igualdad de antes)          → 23 / 1 (éste)
//   · urlLandingVigente sólo del lado del pedido (no de lo guardado)  → 23 / 1 (éste)
test('una landing del editor declarada antes de hola-mako.site sigue siendo la misma (y al revés)', () => {
  const cfgs = parsearConfig(JSON.stringify([
    { url: 'https://hola-mako.com/l/mi-oferta', funnelIds: [7] },
    { url: 'https://hola-mako.site/webinar', funnelIds: [9] },
    { url: 'https://hola-mako.com/l/sin-producto' },
  ]));
  // Declarada con la vieja, el Pixel manda la nueva (con los utm de la campaña).
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://hola-mako.site/mi-oferta?utm_source=fb&fbclid=1'), [7]);
  assert.equal(landingDe(cfgs, 'https://hola-mako.site/mi-oferta')?.url, 'https://hola-mako.com/l/mi-oferta');
  // Declarada con la nueva, llega la vieja (un link copiado antes de la mudanza).
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://www.hola-mako.com/l/webinar'), [9]);
  // Dos landings distintas siguen siendo distintas, y lo que no es de MaKo no se traduce.
  assert.deepEqual(funnelIdsDeLanding(cfgs, 'https://hola-mako.site/sin-producto'), []);
  assert.equal(landingDe(cfgs, 'https://hola-mako.site/otra'), null);
  assert.equal(landingDe(cfgs, 'https://tunegocio.com/l/mi-oferta'), null);
  assert.equal(landingDe(cfgs, 'https://hola-mako.site/mi-oferta/gracias'), null, 'otra página del sitio es otra landing');
});

// PROBADO ROMPIENDOLO: cambiando el `idFila(...)` de `idsLimpios` por un cast
// crudo, este archivo pasa de **pass 23 / fail 0** a **pass 22 / fail 1** (medido de nuevo el 06/10/2026, con el archivo en 23 tests).
test('⚠️ el id puede llegar como STRING (bigint), la basura no pasa y no hay repetidos', () => {
  // `funnels.id` es bigint y en este repo ya se midió que según el driver vuelve
  // como texto. Un `funnelIds: ["7"]` que se guarde tal cual haría que el `===`
  // del validador diera false SIEMPRE: nadie entraría nunca a su producto.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelIds":["7",9]}]'),
    [{ url: 'https://a.com', funnelIds: [7, 9] }]);
  // Lo que no es un id de fila se cae, y si no queda ninguno la página no trae
  // el campo: vacío y ausente son lo mismo acá, y así no hay dos formas de
  // decir «sin producto».
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelIds":["0","-3","1.5","siete","",null,0]}]'),
    [{ url: 'https://a.com' }]);
  // Y uno repetido es UNA ficha, no dos: dos fichas idénticas en el mismo tablero
  // son el bug que el `includes` de `idsLimpios` evita.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelIds":[7,7,"7"]}]'),
    [{ url: 'https://a.com', funnelIds: [7] }]);
  // Un valor que no es lista tampoco inventa nada.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelIds":7}]'), [{ url: 'https://a.com' }]);
});

// PROBADO ROMPIENDOLO: borrando las dos líneas del `funnelId` de `idsDeFila`,
// este archivo pasa de **pass 23 / fail 0** a **pass 22 / fail 1** (medido de nuevo el 06/10/2026, con el archivo en 23 tests).
test('⚠️ se lee el formato de UN producto: lo guardado antes no se pierde', () => {
  // Medido contra producción el 06/10/2026: cuatro workspaces tienen
  // `landing.config` y ninguna de sus seis páginas trae producto asignado, así que
  // hoy esto no arregla ninguna fila. Entre medir y desplegar hay un rato, y lo que
  // se perdería es exactamente a qué CRM entran los leads de esa página — en
  // silencio, porque un lead que cae al embudo del negocio no da ningún error.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelId":7}]'),
    [{ url: 'https://a.com', funnelIds: [7] }]);
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelId":"7"}]'),
    [{ url: 'https://a.com', funnelIds: [7] }]);
  // La lista NUEVA manda sobre el campo viejo: si están los dos, el viejo es un
  // resto del formato anterior y no una segunda opinión.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","funnelId":7,"funnelIds":[9]}]'),
    [{ url: 'https://a.com', funnelIds: [9] }]);
});

// PROBADO ROMPIENDOLO: cambiando `: base?.funnelIds ?? [];` por `: [];` en
// `conLanding`, este archivo pasa de **pass 23 / fail 0** a **pass 22 / fail 1** (medido de nuevo el 06/10/2026, con el archivo en 23 tests).
test('⚠️ corregir la URL NO desasigna los productos, y la lista vacía sí', () => {
  // Es la misma trampa que ya mordió con `clarityProjectId` y con `esVsl`:
  // `conLanding` reconstruye la fila campo por campo, así que un campo que el
  // mapper no conserva se apaga solo en el próximo guardado de cualquier otro.
  const base = parsearConfig('[{"url":"https://a.com","funnelIds":[7]},{"url":"https://b.com","funnelIds":[9]}]');

  const renombrada = conLanding(base, 'https://a-nueva.com', {}, 'https://a.com');
  assert.deepEqual(renombrada, [{ url: 'https://a-nueva.com', funnelIds: [7] }, { url: 'https://b.com', funnelIds: [9] }]);

  // Guardar sin nombrar los productos tampoco los toca.
  const sinCambios = conLanding(base, 'https://a.com', {});
  assert.deepEqual(funnelIdsDeLanding(sinCambios ?? [], 'https://a.com'), [7]);
  // …y no le toca los productos a la vecina.
  assert.deepEqual(funnelIdsDeLanding(sinCambios ?? [], 'https://b.com'), [9]);

  // Lo único que desasigna es la lista vacía, y solo a ESA página.
  const sinProducto = conLanding(base, 'https://a.com', { funnelIds: [] });
  assert.deepEqual(funnelIdsDeLanding(sinProducto ?? [], 'https://a.com'), []);
  assert.deepEqual(funnelIdsDeLanding(sinProducto ?? [], 'https://b.com'), [9]);

  // Y agregar un producto no pisa el que ya estaba: la pantalla manda la lista
  // entera, así que esto es lo que ve el usuario al marcar la segunda casilla.
  const dos = conLanding(base, 'https://a.com', { funnelIds: [7, 9] });
  assert.deepEqual(funnelIdsDeLanding(dos ?? [], 'https://a.com'), [7, 9]);
});

// PROBADO ROMPIENDOLO: cambiando `const valor = elegido.esDefault ? null : id;` por
// `const valor = id;` en lib/landing-funnel.ts, este archivo pasa de **pass 23 / fail 0** a **pass 22 / fail 1** (medido de nuevo el 06/10/2026, con el archivo en 23 tests).
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
  // (Desde el 06/10/2026 quien ofrece la lista es el server de la pantalla, no
  // una action: los productos bajan por props.)
  const page = leer('../app/integraciones/page.tsx');
  assert.ok(/from '@\/lib\/landing-funnel'/.test(page), 'la pantalla ofrece lo que la ruta resuelve, no su propia lista');
});

// PROBADO ROMPIENDOLO: cambiando `return out.length ? out : [null];` por
// `return out;` en `funnelsDeLanding`, este archivo pasa de **pass 23 / fail 0** a **pass 22 / fail 1** (medido de nuevo el 06/10/2026, con el archivo en 23 tests).
test('⚠️ CABLEADO: la lista de embudos NUNCA vuelve vacía', () => {
  // Es la mitad del contrato que no se ve en el tipo: quien llama crea UNA FICHA
  // POR ELEMENTO, así que una lista vacía haría que un opt-in no cree NINGÚN lead
  // — y perder a la persona es infinitamente peor que ponerla en el embudo
  // equivocado. Los cuatro caminos a `[null]` son: sin página, sin asignación,
  // todos los asignados muertos, y la lectura que falló.
  const lib = leer('../lib/landing-funnel.ts');
  assert.ok(/if \(!pagina\) return \[null\];/.test(lib), 'sin página no se inventa un producto, pero el lead entra igual');
  assert.ok(/if \(!ids\.length\) return \[null\];/.test(lib), 'una landing sin productos cae exactamente donde cae hoy');
  assert.ok(/return out\.length \? out : \[null\];/.test(lib), 'con todos los embudos archivados el lead tiene que entrar igual');
  assert.ok(/catch \(e\)[\s\S]{0,250}return \[null\];/.test(lib), 'una lectura que falla no puede dejar al lead sin CRM');
  // Y sin repetidos: con el default elegido dos veces saldrían dos fichas
  // idénticas en el mismo tablero.
  assert.ok(/if \(!out\.includes\(valor\)\) out\.push\(valor\);/.test(lib), 'dos veces el mismo embudo son dos fichas iguales');
});

// =============================================================================
// El PASO 2, segunda vuelta (06/10/2026)
// =============================================================================
// Martín, textual: «El paso de los productos tardó mucho en encontrar mis
// productos... No entiendo porque si son 2 literalmente. Y hazlo también dentro de
// un desplegable. Y elimina el texto de "Los leads de esta página entran al CRM…".
// Y no entiendo lo de "Sin marcar ninguno…", si o si se debe marcar 1. Y en todo
// caso si el workspace tiene solo 1 producto, que ya aparezca marcado.»
//
// ⚠️ UN TEST POR AFIRMACIÓN, no uno que junte las cinco: un guard que mira todo
// junto dice que algo se rompió y no cuál.

// PROBADO ROMPIENDOLO: cambiando `funnelIds: ids` por `funnelIds: []` en
// AsignarProducto.tsx, este archivo pasa de **pass 23 / fail 0** a
// **pass 22 / fail 1**.
test('CABLEADO: el paso 2 es el desplegable de la casa, eligiendo VARIOS', () => {
  const paso = sinComentarios(leer('../app/integraciones/AsignarProducto.tsx'));
  // El desplegable de la casa con la elección múltiple, no uno propio ni casillas
  // sueltas: «hazlo también dentro de un desplegable».
  assert.ok(/<Select/.test(paso), 'el paso es un desplegable');
  assert.ok(/varios=\{marcados\.map\(String\)\}/.test(paso), 'que elige VARIOS, con lo que se muestra marcado');
  assert.ok(!/<Checkbox/.test(paso), 'sin casillas sueltas fuera del desplegable');
  // Guarda la lista ENTERA: es lo que permite que la vacía desasigne.
  assert.ok(/funnelIds: ids/.test(paso), 'guarda la lista entera');
  // ⚠️ El valor guardado se dibuja aunque el embudo ya no se pueda elegir: si no,
  // el primer guardado de cualquier otro lo borraría sin que nadie lo toque.
  assert.ok(/huerfanos/.test(paso), 'un producto archivado no puede borrarse solo al marcar otro');
});

// PROBADO ROMPIENDOLO: cambiando `minimo={1}` por `minimo={0}`, este archivo pasa
// de **pass 23 / fail 0** a **pass 22 / fail 1**. Y cambiando
// `guardados.length ? guardados : [delNegocio.id]` por `guardados`, lo mismo.
test('⚠️ CABLEADO: SIEMPRE hay uno marcado — el del negocio cuando no hay nada guardado', () => {
  // «si o si se debe marcar 1… si el workspace tiene solo 1 producto, que ya
  // aparezca marcado». Sin nada guardado, los leads van al CRM del negocio
  // (`funnelsDeLanding` → `[null]`), así que eso es lo que se MUESTRA marcado. Es
  // un cálculo, no una escritura: abrir la pantalla no guarda nada.
  const paso = sinComentarios(leer('../app/integraciones/AsignarProducto.tsx'));
  assert.ok(/const marcados = guardados\.length \? guardados : \[delNegocio\.id\];/.test(paso),
    'sin nada guardado se muestra marcado el del negocio');
  assert.ok(/minimo=\{1\}/.test(paso), 'el desplegable no deja desmarcar el último');
  // Y el que guarda usa la MISMA regla del mínimo que el que dibuja.
  assert.ok(/alternarValor\(marcados\.map\(String\), v, 1\)/.test(paso), 'el guardado respeta el mismo mínimo');
});

// PROBADO ROMPIENDOLO: devolviendo el párrafo «Los leads de esta página entran al
// CRM de los productos que marques…» al JSX, este archivo pasa de
// **pass 23 / fail 0** a **pass 22 / fail 1**.
test('el paso 2 no explica: los dos textos que el dueño pidió sacar no vuelven', () => {
  // Se mira el fuente SIN comentarios: el comentario que cuenta que se sacaron
  // los nombra, y un guard sobre el archivo entero se acusaría a sí mismo.
  const paso = sinComentarios(leer('../app/integraciones/AsignarProducto.tsx'));
  assert.ok(!/entran al CRM de los productos que marques/.test(paso), 'el párrafo explicativo se fue');
  assert.ok(!/Sin marcar ninguno/.test(paso), '«sin marcar ninguno» no es un estado que exista');
});

// PROBADO ROMPIENDOLO: devolviendo el `useEffect` con `getProductosAction()` a
// AsignarProducto.tsx, este archivo pasa de **pass 23 / fail 0** a
// **pass 22 / fail 1**.
test('⚠️ CABLEADO: los productos y las páginas bajan del SERVER, no de una action', () => {
  // Medido el 06/10/2026: tres server actions EN SERIE antes de la primera
  // casilla —Next las despacha de a una, así que un Promise.all no las paraleliza—,
  // 11 a 13 idas y vueltas a la base para traer dos filas.
  const page = leer('../app/integraciones/page.tsx');
  assert.ok(/productosAsignables\(\)/.test(page), 'el server resuelve los productos');
  assert.ok(/landingsDelWorkspace\(\)/.test(page), 'y las páginas');
  // ⚠️ Una lista vacía es una lectura que falló (todo workspace tiene su embudo del
  // negocio), y baja como `null` para que el paso diga que no pudo leer en vez de
  // afirmar que no hay productos.
  assert.ok(/l\.length \? l : null/.test(page), 'vacío baja como null, no como «no tenés productos»');

  const paso = sinComentarios(leer('../app/integraciones/AsignarProducto.tsx'));
  assert.ok(!/useEffect/.test(paso), 'el paso 2 no espera nada al montarse');
  assert.ok(!/getProductosAction|getLandingsAction/.test(paso), 'ni pide sus datos por action');
  const sel = sinComentarios(leer('../app/integraciones/SelectorLanding.tsx'));
  assert.ok(!/getLandingsAction/.test(sel), 'el paso 1 tampoco: era el primer viaje de la cola');

  // Y las dos actions de lectura se fueron con su único motivo: una salida que
  // nadie pide es la forma de falla que esta casa ya pagó.
  const acc = sinComentarios(leer('../app/integraciones/landing-config-actions.ts'));
  assert.ok(!/export async function getProductosAction/.test(acc), 'la action de productos ya no tiene a quién servir');
  assert.ok(!/export async function getLandingsAction/.test(acc), 'la de páginas tampoco');
});

test('CABLEADO: el paso 2 está montado como el 2, y comparte las páginas con el 1', () => {
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(/<Paso n=\{2\} titulo="¿A qué funnel entran sus leads\?">/.test(board), 'el funnel es el paso 2');
  // Desde el 09/10/2026 el paso 3 ofrece primero la LÍNEA del cargador (lib/pixel-cargador.ts).
  assert.ok(/<Paso n=\{3\} titulo=\{cargador \? 'Copia esta línea/.test(board), 'el código es el 3');
  // ⚠️ El MISMO estado de páginas para los dos pasos: con una copia en cada uno,
  // guardar en el 2 dejaba al 1 mostrando la configuración vieja.
  assert.ok(/<SelectorLanding elegida=\{elegida\} onElegir=\{onElegir\} landings=\{landings\} onLandings=\{setLandings\} \/>/.test(board),
    'el paso 1 lee y escribe el estado compartido');
  // (Desde el 07/10/2026 recibe también las visitas a la página de gracias que no se unieron a
  // un lead: lib/landing-gracias.ts.)
  assert.ok(/<AsignarProducto elegida=\{elegida\} productos=\{pixel\?\.productos \?\? null\}\s+landings=\{landings\} onLandings=\{setLandings\} rechazos=\{pixel\?\.gracias \?\? \[\]\} \/>/.test(board),
    'el paso 2 también, y recibe los productos del server');

  // ⚠️ Y EL PASO 1 DEJÓ DE DECIDIR LOS PRODUCTOS: lo que se muda se SACA de donde
  // estaba, o la que se arregle segunda se queda vieja.
  const sel = sinComentarios(leer('../app/integraciones/SelectorLanding.tsx'));
  assert.ok(!/funnelIds/.test(sel), 'el selector de página no puede escribir los productos');
});
