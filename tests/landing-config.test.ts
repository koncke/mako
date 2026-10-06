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

// PROBADO ROMPIENDOLO: cambiando el `idFila(...)` de `idsLimpios` por un cast
// crudo, este archivo pasa de **pass 19 / fail 0** a **pass 18 / fail 1**.
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
// este archivo pasa de **pass 19 / fail 0** a **pass 18 / fail 1**.
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
// `conLanding`, este archivo pasa de **pass 19 / fail 0** a **pass 18 / fail 1**.
test('⚠️ corregir la URL NO desasigna los productos, y la lista vacía sí', () => {
  // Es la misma trampa que ya mordió con `clarityProjectId` y con `esVsl`:
  // `conLanding` reconstruye la fila campo por campo, así que un campo que el
  // mapper no conserva se apaga solo en el próximo guardado de cualquier otro.
  const base = parsearConfig('[{"url":"https://a.com","funnelIds":[7]},{"url":"https://b.com","funnelIds":[9]}]');

  const renombrada = conLanding(base, 'https://a-nueva.com', {}, 'https://a.com');
  assert.deepEqual(renombrada, [{ url: 'https://a-nueva.com', funnelIds: [7] }, { url: 'https://b.com', funnelIds: [9] }]);

  // Guardar OTRO campo tampoco los toca.
  const conClarity = conLanding(base, 'https://a.com', { clarityProjectId: 'ABC' });
  assert.deepEqual(funnelIdsDeLanding(conClarity ?? [], 'https://a.com'), [7]);
  // …y no le toca los productos a la vecina.
  assert.deepEqual(funnelIdsDeLanding(conClarity ?? [], 'https://b.com'), [9]);

  // Lo único que desasigna es la lista vacía, y solo a ESA página.
  const sinProducto = conLanding(base, 'https://a.com', { funnelIds: [] });
  assert.deepEqual(funnelIdsDeLanding(sinProducto ?? [], 'https://a.com'), []);
  assert.deepEqual(funnelIdsDeLanding(sinProducto ?? [], 'https://b.com'), [9]);

  // Y agregar un producto no pisa el que ya estaba: la pantalla manda la lista
  // entera, así que esto es lo que ve el usuario al marcar la segunda casilla.
  const dos = conLanding(base, 'https://a.com', { funnelIds: [7, 9] });
  assert.deepEqual(funnelIdsDeLanding(dos ?? [], 'https://a.com'), [7, 9]);
});

// PROBADO ROMPIENDOLO: cambiando `return elegido.esDefault ? null : id;` por
// `return id;`, este archivo pasa de **pass 19 / fail 0** a **pass 18 / fail 1**.
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

// PROBADO ROMPIENDOLO: cambiando los cuatro `return [null]` de `funnelsDeLanding`
// por `return []`, este archivo pasa de **pass 19 / fail 0** a **pass 18 / fail 1**.
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

// PROBADO ROMPIENDOLO: cambiando `funnelIds: ids` por `funnelIds: []` en
// AsignarProducto.tsx, este archivo pasa de **pass 18 / fail 0** a
// **pass 17 / fail 1**.
test('CABLEADO: los productos se asignan en el PASO 2, y se puede marcar más de uno', () => {
  // Pedido de Martín el 06/10/2026: «tiene que ser otro paso en la configuración
  // del pixel asignar PRODUCTO, ponlo como segundo paso… no solo se debería poder
  // seleccionar 1 producto».
  const paso = leer('../app/integraciones/AsignarProducto.tsx');
  assert.ok(/getProductosAction\(\)/.test(paso), 'el paso tiene que pedir los productos');
  assert.ok(/<Checkbox/.test(paso), 'más de uno se marca con casillas, no con un desplegable');
  assert.ok(/funnelIds: ids/.test(paso), 'y guarda la lista ENTERA: es lo que permite que la vacía desasigne');
  // ⚠️ El valor guardado se dibuja aunque el embudo ya no se pueda elegir: si no
  // se dibujara, su casilla no existiría y el primer guardado de cualquier otra
  // lo borraría sin que nadie lo toque.
  assert.ok(/huerfanos/.test(paso), 'un producto archivado no puede borrarse solo al marcar otro');
  // ⚠️ Y el paso se dibuja SIEMPRE, también con un solo producto: un paso numerado
  // que no muestra nada deja un hueco en la numeración, que se lee como una
  // pantalla rota. Con uno solo se dice dónde se crean los demás.
  assert.ok(/créalos en tu CRM/.test(paso), 'con un solo producto hay que decir dónde se crean los otros');

  // Y está montado como el paso 2, con los demás renumerados.
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(/<Paso n=\{2\} titulo="¿Qué producto vende\?">/.test(board), 'el producto es el paso 2');
  assert.ok(/<AsignarProducto elegida=\{elegida\} \/>/.test(board), 'y el paso 2 monta el componente');
  assert.ok(/<Paso n=\{3\} titulo="Copia el código/.test(board), 'el código pasa a ser el 3');

  // ⚠️ Y EL PASO 1 DEJÓ DE DECIDIRLO. Con las dos pantallas leyendo el campo,
  // la que se arregle segunda se queda vieja — es la regla de «una cosa, un lugar»
  // aplicada a una mudanza: lo que se muda se SACA de donde estaba.
  const sel = sinComentarios(leer('../app/integraciones/SelectorLanding.tsx'));
  assert.ok(!/funnelIds/.test(sel), 'el selector de página no puede seguir escribiendo los productos');
  assert.ok(!/getProductosAction/.test(sel), 'ni seguir pidiéndolos');
});
