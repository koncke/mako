// =============================================================================
// El opt-in de una landing: las cuatro guardas que lo hacen seguro de repartir
// =============================================================================
// `/api/track/optin` es una ruta ABIERTA (el snippet corre en la página del
// cliente, sin sesión), así que lo que la hace segura no es el auth: son cuatro
// decisiones que tienen que seguir donde están. Son guards de CABLEADO — el
// cuerpo no se puede ejercitar sin Supabase, pero sí se puede exigir que los
// cables no se muevan.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const RUTA = () => leer('../app/api/track/optin/route.ts');

test('NO escribe en leads: deja una propuesta', () => {
  const src = RUTA();
  assert.ok(/crearPropuesta\(/.test(src), 'el opt-in tiene que dejar una propuesta');
  assert.ok(
    !/from\(['"]leads['"]\)|insertLead|createLead/.test(src),
    'un endpoint abierto que escribe directo en leads mete basura de un bot adentro del CRM',
  );
});

test('el ruteo del workspace es fail-closed', () => {
  const src = RUTA();
  assert.ok(/wsPorIdentificador\(/.test(src), 'el workspace sale del token, no del body');
  assert.ok(/ws == null/.test(src), 'un token sin mapeo tiene que cortar');
  assert.ok(
    !/OWNER_WS|\?\?\s*1\b/.test(src),
    'sin workspace NO se cae al dueño: sería meterle los leads de otro en su CRM',
  );
});

test('solo ingesta si el negocio declaró la landing como entrada', () => {
  const src = RUTA();
  assert.ok(/getFunnel\(\)/.test(src), 'la puerta se lee de donde el cliente la configura (/funnel), no de una copia');
  assert.ok(/entradas\.includes\('landing'\)/.test(src), 'falta la puerta: sin esto el mismo snippet le llena el CRM a cualquiera');
  // 200 y no 403: la página del cliente no puede mostrarle un error a SU visitante
  // por una config que le falta al dueño de la página.
  const i = src.indexOf("entradas.includes('landing')");
  assert.ok(/return ok\(/.test(src.slice(i, i + 400)), 'un negocio sin la landing declarada recibe 200, no un error');
});

test('es idempotente: dos submits del mismo formulario no son dos leads', () => {
  const src = RUTA();
  assert.ok(/ref:\s*ref|ref,/.test(src), 'falta la ref de idempotencia');
  assert.ok(/`landing:\$\{email \?\? telefono\}`/.test(src), 'sin ref del emisor, la identidad es el contacto');
});

test('sin forma de contacto se rechaza en la puerta, no en la revisión', () => {
  const src = RUTA();
  assert.ok(/!email && !telefono/.test(src), 'un lead sin email ni teléfono no se puede trabajar');
});

test('la ruta es pública de verdad (vive bajo un prefijo de PUBLICOS)', () => {
  // Si no, proxy.ts la corta con 401 ANTES de que su código corra, y en local no
  // se ve porque sin AUTH_SECRET el middleware hace no-op.
  const publicas = leer('../lib/rutas-publicas.ts');
  assert.ok(/'\/api\/track'/.test(publicas), '/api/track tiene que seguir en PUBLICOS');
});

test('el snippet que la app le entrega ya captura el formulario', () => {
  // El pedido que lo trajo: «yo no le debo pasar nada, Leila lo tiene que hacer
  // todo sola desde la app». Si el opt-in vive en un snippet aparte que hay que
  // mandar por chat, la feature no existe para quien no lo recibió.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/\/api\/track\/optin/.test(lib), 'el snippet de /integraciones tiene que postear el opt-in');
  assert.ok(/addEventListener\('submit'/.test(lib), 'se cuelga del submit del formulario del cliente');
  assert.ok(/keepalive: true/.test(lib), 'sin keepalive el envío muere cuando el formulario navega');
  // Se busca la LLAMADA, no la palabra: el comentario del snippet explica
  // justamente por qué no se frena, y esa memoria no puede hacer fallar el test.
  assert.ok(
    !/\.preventDefault\s*\(/.test(lib),
    'NUNCA se frena el submit: el formulario del cliente tiene que seguir haciendo lo suyo',
  );
});

test('el snippet lleva versión, y algo la mira cuando se queda vieja', () => {
  // El snippet queda CONGELADO en el HTML del cliente: una mejora nuestra no le
  // llega nunca y no hay síntoma, porque los eventos del código viejo llegan
  // igual y la integración sigue en verde. La versión es la ÚNICA forma de saberlo.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/export const SNIPPET_VERSION = \d+/.test(lib), 'falta la versión del snippet');
  assert.ok(/var SV = \$\{SNIPPET_VERSION\}/.test(lib), 'la versión tiene que VIAJAR en el snippet, no solo existir en el server');
  assert.ok(/data\.sv = SV/.test(lib), 'la versión tiene que ir en cada evento');

  // ⚠️ LA ASERCIÓN ESPEJO, y la que faltaba. Este test se escribió en el MISMO
  // commit (562f8962) que dejó `var TOKEN = ''` —la interpolación se perdió al
  // insertar la línea de la versión— y pasó en verde, porque exigía que viajara
  // la versión y nunca que viajara el token. Sin token, el beacon muere en el
  // fail-closed y el opt-in se rechaza con 400: el snippet queda MUDO y la
  // pantalla lo muestra igual de lindo. Si agregás algo nuevo al snippet, sumá
  // acá su aserción: lo que no se afirma es lo próximo que se va a romper.
  assert.ok(
    /var TOKEN = '\$\{token\}'/.test(lib),
    'el TOKEN dejó de interpolarse: el snippet sale sin identificar el workspace y no mide ni captura nada',
  );

  const beacon = leer('../app/api/track/vsl/route.ts');
  assert.ok(/anotarVersionSnippet/.test(beacon), 'el beacon es el único lugar donde se puede saber qué versión tiene puesta el cliente');

  // La comparación vive en `snippetDesactualizado()` — sin server-only alrededor
  // del dato, y con UN solo lugar que decide «esto quedó viejo»: lo consumen el
  // cron (para el WhatsApp) y la pantalla (para el chip). Dos copias divergirían.
  assert.ok(/instalada < SNIPPET_VERSION/.test(lib), 'nadie compara la instalada contra la actual: la versión sola no avisa nada');
  const cron = leer('../app/api/cron/tracking-vigilante/route.ts');
  assert.ok(/snippetDesactualizado\(\)/.test(cron), 'el cron tiene que preguntar por el mismo lugar que la pantalla');
  assert.ok(/tracking-desactualizado/.test(cron), 'falta el aviso por WhatsApp');
  // El aviso dice QUÉ se pierde: «actualizá» a secas es una tarea sin motivo, y
  // menos todavía cuando lo que tiene puesto funciona.
  assert.ok(/novedadesDesde\(instalada\)/.test(cron), 'el aviso tiene que decir qué se está perdiendo, no solo que actualice');
});

test('el aviso de código viejo: rótulo propio, texto determinista y link que abre el lugar', () => {
  const cat = leer('../lib/avisos-catalogo.ts');
  // Rótulo propio: «🔧 SISTEMA» no le dice a nadie de qué le están hablando.
  assert.ok(/landing:\s*\{ emoji: '🌐', texto: 'TU LANDING' \}/.test(cat), 'la landing necesita su propia área de aviso');
  assert.ok(/'tracking-desactualizado': 'landing'/.test(cat), 'el aviso tiene que salir con el rótulo de landing, no con el de sistema');

  const cron = leer('../app/api/cron/tracking-vigilante/route.ts');
  // ⚠️ `texto` y NO `contexto`: con contexto lo redacta el modelo, y acá viaja un
  // LINK exacto. Regla de la casa: un dato exacto no lo transporta un LLM.
  const i = cron.indexOf("emitirDelCatalogo('tracking-desactualizado'");
  // Se corta en el cierre de ESA llamada: el `tracking-apagado` de más abajo sí
  // usa `contexto` (su texto lo puede redactar el modelo, no lleva link), y con
  // una ventana fija el test lo leía como si fuera de este aviso.
  const bloque = cron.slice(i, cron.indexOf('});', i));
  assert.ok(/texto:/.test(bloque), 'el mensaje tiene que ser determinista: el link no lo puede escribir el modelo');
  assert.ok(!/contexto:/.test(bloque), 'volvió el contexto: el modelo puede reescribir mal la URL');
  assert.ok(/LINK_LANDING/.test(bloque), 'el aviso tiene que llevar el link exacto');
  assert.ok(/\/integraciones\?abrir=landing/.test(cron), 'el link tiene que abrir el LUGAR donde se resuelve, no la pantalla entera');
  assert.ok(/APP_BASE_URL/.test(cron), 'en un WhatsApp un path no es clicable: el link va absoluto');
});

test('la pantalla también lo dice (no solo el WhatsApp)', () => {
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(/i\.key === 'landing' && landingVieja\) return 'warn'/.test(board), 'con el código viejo la integración no puede seguir en verde');
  assert.ok(/'Actualizá el código'/.test(board), 'el chip tiene que decir qué hacer');
  // El deep-link: abre el modal, scrollea, y limpia el parámetro para que un F5
  // no reabra lo que la persona ya cerró.
  assert.ok(/searchParams\.get\('abrir'\)/.test(board), 'falta leer el parámetro del deep-link');
  assert.ok(/scrollIntoView/.test(board), 'el link tiene que scrollear a la tarjeta');
  assert.ok(/id=\{`svc-\$\{i\.key\}`\}/.test(board), 'sin ancla en la tarjeta, el scroll no tiene a dónde ir');
  assert.ok(/q\.delete\('abrir'\)/.test(board), 'el parámetro se limpia: si queda, un F5 reabre el modal cerrado');

  const page = leer('../app/integraciones/page.tsx');
  assert.ok(/snippetDesactualizado\(\)/.test(page), 'el dato ya existía y nadie lo leía en la pantalla');
});

test('la prueba del código chequea el formulario, y la versión NO se adivina', () => {
  const lib = leer('../lib/landing-token.ts');
  const i = lib.indexOf('const chequeos: ChequeoDiag[]');
  const bloque = lib.slice(i, i + 2600);

  // El chequeo que faltaba: el snippet captura el opt-in en el server y en
  // silencio, así que sin esta fila la única forma de saber si andaba era llenar
  // el formulario y después ir a buscar el lead a otra pantalla.
  assert.ok(/id: 'optin'/.test(bloque), 'la prueba no verifica que el formulario entre al CRM');
  assert.ok(/!declarado/.test(bloque), 'tiene que distinguir «no lo declaraste en /funnel» de «todavía no probaste»: se arreglan en lugares distintos');
  assert.ok(/completá tu propio formulario/.test(bloque), 'una prueba tiene que decir QUÉ hacer para probarla');

  // La versión se PREGUNTA, no se infiere. La heurística vieja (ausencia de
  // `segundos` en los eventos del VSL) mentía en el caso más común: una landing
  // sin video nunca manda segundos, así que le decía «tenés el código viejo»
  // para siempre a alguien que lo tenía al día.
  assert.ok(/id: 'version'/.test(bloque), 'falta el chequeo de versión');
  assert.ok(/snippetDesactualizado\(\)/.test(lib), 'la versión sale del dato que viaja en el evento, no de un proxy');
  assert.ok(!/id: 'segundos'/.test(bloque), 'volvió la heurística: una landing sin video daría «código viejo» para siempre');
  assert.ok(!/conSegundos > 0 \? 'ok'/.test(bloque), 'volvió a decidir la versión por la presencia de segundos');
});

test('el contador de chequeos sale de la LISTA, no de un número escrito al lado', () => {
  // Estuvo diciendo «1 de 4 chequeos OK» cuando ya eran cinco: un total que se
  // mantiene a mano queda viejo en el MISMO commit que agrega la fila, y encima
  // es lo primero que se lee del panel.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/okCount === chequeos\.length/.test(lib), 'el «todo funcionando» se compara contra un número fijo');
  assert.ok(/de \$\{chequeos\.length\} chequeos OK/.test(lib), 'el total del veredicto está hardcodeado');
  assert.ok(!/de 4 chequeos/.test(lib), 'volvió el 4 escrito a mano');
});

test('con el código viejo no se deja probar, y «Verificar» lo dice', () => {
  // Probar sobre un snippet desactualizado da un resultado que no significa nada:
  // los chequeos nuevos fallan SIEMPRE porque ese código no manda esos eventos, y
  // la persona sale creyendo que su landing está rota.
  const probar = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/previo\?\.codigoViejo/.test(probar), 'la prueba tiene que bloquearse con el código viejo');
  assert.ok(/Primero actualizá el código/.test(probar), 'y decir qué hacer antes de probar');
  // El botón NO se esconde: esconderlo deja la sección sin su acción y sin decir
  // qué la reemplazó. Se deja intentar, y ahí se explica por qué todavía no.
  assert.ok(/const arrancar = \(\) => \{/.test(probar), 'el botón de probar tiene que seguir existiendo');
  assert.ok(/setBloqueo\(true\); return;/.test(probar), 'el aviso aparece al APRETAR, no en lugar del panel');

  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(/j\.codigoViejo/.test(board), '«Verificar» tiene que mirar la versión');
  assert.ok(/es de una versión anterior/.test(board), '«Verificar» no puede contestar que sí sobre un código al que le falta la mitad');
});

test('la prueba se corre sobre una landing ELEGIDA, no sobre «abrila vos»', () => {
  const probar = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/previo\?\.urls/.test(probar), 'las landings que ya mandaron eventos se ofrecen: pedir que tipee una URL que ya tenemos es trabajo inventado');
  assert.ok(/window\.open\(u, '_blank'/.test(probar), 'la prueba abre la página, como el Test Events de Meta');
  assert.ok(/localStorage\.setItem\(URL_KEY/.test(probar), 'la URL se recuerda: se elige una vez, no en cada prueba');

  const lib = leer('../lib/landing-token.ts');
  assert.ok(/urls,/.test(lib) && /landing_url/.test(lib), 'el server tiene que devolver las URLs conocidas');
});

test('el panel usa las piezas de la casa, no HTML crudo', () => {
  // Sin comentarios: el comentario del componente explica POR QUÉ el <select>
  // nativo está prohibido, y esa memoria no puede hacer fallar el test. Es la
  // tercera vez que este mismo detalle muerde — por eso queda escrito acá.
  const probar = leer('../app/integraciones/ProbarTracking.tsx')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // El <select> nativo está PROHIBIDO por el propio componente de la casa: no se
  // puede estilar igual en todos los navegadores. Y el Select propio se renderiza
  // en portal, así que el scroll del modal no le recorta el menú.
  assert.ok(!/<select/.test(probar), 'volvió el <select> nativo');
  assert.ok(!/<input /.test(probar), 'volvió el <input> crudo: hay Input en app/_ui');
  assert.ok(/<Select\b/.test(probar) && /<Input\b/.test(probar) && /<Button\b/.test(probar), 'tiene que usar Select/Input/Button de app/_ui');

  // UN desplegable, no un desplegable AL LADO de un input: dos campos que hacen
  // lo mismo obligan a elegir cuál usar antes de poder contestar la pregunta.
  assert.ok(/value: NUEVA, label: 'Otra página…'/.test(probar), 'la salida para una página nueva es la última OPCIÓN del desplegable');
  assert.ok(/eligiendoNueva && \(/.test(probar), 'el campo libre aparece solo cuando se elige «Otra página…»');

  // UN solo botón, y siempre abre la pestaña: si la prueba depende de que la
  // persona se acuerde de abrir su página, la prueba no arranca.
  // Se cuenta en el panel de ARRANQUE (hasta que la prueba está corriendo): el
  // «Terminar» de la sesión activa no compite con nada.
  const idle = probar.slice(probar.indexOf('if (!activo)'), probar.indexOf('{avisoViejo}'));
  const botones = idle.match(/<Button\b/g) ?? [];
  assert.equal(botones.length, 1, `el arranque de la prueba tiene que tener UN botón y tiene ${botones.length}`);
  assert.ok(/window\.open\(u, '_blank'/.test(probar) && /const arrancar/.test(probar), 'el único botón abre la página');
});

test('el código se pliega, pero copiar sigue andando plegado', () => {
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  const i = board.indexOf('Pegá este código en tu landing');
  const bloque = board.slice(i, i + 2200);
  assert.ok(/<details/.test(bloque), 'el bloque de código tiene que poder plegarse: nadie lo lee, y empuja las acciones fuera de la vista');
  // Las acciones ANTES del <details>: lo accionable no puede quedar debajo de
  // 200 px de JavaScript.
  assert.ok(bloque.indexOf('Copiar código') < bloque.indexOf('<details'), 'los botones van ARRIBA del código plegado');
  assert.ok(!/<button type="button" onClick=\{copiar\}/.test(bloque), 'volvió el <button> crudo: hay Button en app/_ui');
});
