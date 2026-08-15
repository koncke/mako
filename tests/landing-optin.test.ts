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

// ⚠️ ESTE TEST CAMBIÓ DE SENTIDO A PROPÓSITO, 14/08/2026. Antes exigía que el
// opt-in NO creara el lead. La regla «un canal propone, una persona confirma» no
// se abandona: se acota a donde sirve. El riesgo que cubre es un dato que llega
// mal; un formulario que la propia persona completó es el dato más confiable que
// hay. Lo que sí necesita ojo humano es el CHOQUE con alguien que ya está —
// fundir es irreversible y duplicar ensucia—, y ahí sigue la propuesta.
//
// El costo de la versión anterior está medido: ocho leads reales esperando un
// click que nadie sabía que había que dar.
test('entra SOLO, y solo un duplicado queda para revisar', () => {
  const src = RUTA();
  assert.ok(/createLead\(\{/.test(src), 'un lead limpio tiene que entrar solo: si hay que confirmarlo, no automatiza nada');
  assert.ok(/duplicadosDeLead\(/.test(src), 'sin chequeo de duplicados, el alta automática ensucia el CRM');
  assert.ok(/if \(!dup\.length\)/.test(src), 'el alta directa es SOLO cuando no hay con quién chocar');
  assert.ok(/crearPropuesta\(/.test(src), 'con duplicado tiene que quedar la propuesta, no descartarse');
  // Si el alta falla, la persona NO se pierde: cae a propuesta. Un error del CRM
  // no puede convertirse en un lead que no llegó nunca.
  const i = src.indexOf('createLead({');
  assert.ok(/catch \(e\)/.test(src.slice(i, src.indexOf('crearPropuesta({'))), 'un alta que falla tiene que caer a propuesta');
  // Y el aviso dice POR QUÉ quedó esperando: «confirmalo» a secas, sobre algo que
  // el resto de las veces entra solo, se lee como que el sistema falló.
  assert.ok(/textoDuplicado\(dup\)/.test(src), 'el aviso tiene que decir con quién choca');
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
  assert.ok(/`landing:\$\{clave\}`/.test(src), 'sin ref del emisor, la identidad es el contacto');
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

  // Cada versión nueva tiene que traer su renglón de novedades, o el aviso sale
  // diciendo «mejoras de medición» —el fallback— que no le dice nada a nadie.
  const ver = Number(/export const SNIPPET_VERSION = (\d+)/.exec(lib)?.[1]);
  assert.ok(new RegExp(`^\\s{2}${ver}: '`, 'm').test(lib), `falta la novedad de la v${ver} en NOVEDADES`);
});

test('el estado del player es POR VIDEO: una landing puede tener más de uno', () => {
  // ⚠️ EL BUG QUE ESTE TEST CUIDA. Hasta la v4 el snippet tenía UNA tanda de
  // variables para toda la página (`yaPlay`, `hitos`, `dur`, `segs`). Con dos
  // videos eso no mezclaba dos curvas — rompía la segunda:
  //   · `yaPlay` global → solo el PRIMER video mandaba un play.
  //   · `hitos` compartido → el 25% del segundo se suprimía porque ya lo había
  //     mandado el primero.
  //   · `dur` lo pisaba el último que reportara duración → el % de un video se
  //     calculaba con la duración de otro.
  // Y el síntoma en pantalla era «la retención da raro», que no apunta a nada.
  const lib = leer('../lib/landing-token.ts');
  const i = lib.indexOf('window.addEventListener(\'message\'');
  const j = lib.indexOf('window.addEventListener(\'pagehide\'');
  assert.ok(i > 0 && j > i, 'no se encontró el handler del player en el snippet');
  const bloque = lib.slice(i, j);

  // Lo que se afirma es que TODO lo mutable del player cuelga de un estado por
  // video, no que existan tales o cuales nombres de variable.
  for (const v of ['play', 'hitos', 'seg', 'dur', 'segs', 'pct']) {
    assert.ok(
      new RegExp(`e\\.${v}\\b`).test(bloque),
      `«${v}» tiene que vivir en el estado del video (e.${v}), no en una variable de la página`,
    );
  }
  assert.ok(/var e = est\(vid\)/.test(bloque), 'cada mensaje tiene que resolver a QUÉ video pertenece antes de tocar nada');
  assert.ok(/function quien\(/.test(lib), 'sin identificar el emisor, dos players anónimos vuelven a compartir un estado');

  // Y el exit, que es el dato del que sale el punto de abandono, tiene que salir
  // uno por video reproducido: con el exit único, de dos videos mirados quedaba
  // solo el del último que hubiera hablado.
  // ⚠️ La ventana se ancla a la FUNCIÓN, no a un tamaño fijo. La versión anterior
  // cortaba 900 caracteres para atrás desde 'pagehide' y se rompió sola en cuanto
  // se agregó código antes: el test falló sobre una función que no había cambiado.
  // Un límite arbitrario en un test que lee fuente es una falla programada.
  const ini = lib.indexOf('function alSalir()');
  assert.ok(ini > 0 && ini < j, 'no se encontró alSalir()');
  const salida = lib.slice(ini, j);
  assert.ok(/for \(var k in V\)/.test(salida), 'el exit tiene que recorrer todos los videos, no mandar uno solo');
  assert.ok(/if \(!e\.play\) continue/.test(salida), 'un video que nadie reprodujo no tiene punto de abandono que contar');
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
  assert.ok(/'Actualiza el Pixel'/.test(board), 'el chip tiene que decir qué hacer');
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
  // ⚠️ La ventana se corta en el CIERRE del array, no a los N caracteres. Con un
  // tope fijo, agregar un chequeo empuja al último fuera de la ventana y el test
  // falla sobre código correcto — ya pasó dos veces en este archivo. Un límite
  // arbitrario en un test que lee fuente es una falla programada.
  const i = lib.indexOf('const chequeos: ChequeoDiag[]');
  const fin = lib.indexOf('\n  ];', i);
  assert.ok(i > 0 && fin > i, 'no se encontró el array de chequeos');
  const bloque = lib.slice(i, fin);

  // El chequeo que faltaba: el snippet captura el opt-in en el server y en
  // silencio, así que sin esta fila la única forma de saber si andaba era llenar
  // el formulario y después ir a buscar el lead a otra pantalla.
  assert.ok(/id: 'optin'/.test(bloque), 'la prueba no verifica que el formulario entre al CRM');
  assert.ok(/!declarado/.test(bloque), 'tiene que distinguir «no lo declaraste en /funnel» de «todavía no probaste»: se arreglan en lugares distintos');
  assert.ok(/completa tu propio formulario/.test(bloque), 'una prueba tiene que decir QUÉ hacer para probarla');

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
  assert.ok(/Primero actualiza el código/.test(probar), 'y decir qué hacer antes de probar');
  // El botón NO se esconde: esconderlo deja la sección sin su acción y sin decir
  // qué la reemplazó. Se deja intentar, y ahí se explica por qué todavía no.
  // `async`: arrancar RELEE el estado antes de bloquear, en vez de creerle a lo
  // que se leyó al abrir el modal. Ver el comentario del componente.
  assert.ok(/const arrancar = async \(\) => \{/.test(probar), 'el botón de probar tiene que seguir existiendo');
  assert.ok(/setPrevio\(\(p\) =>/.test(probar), 'al apretar Probar hay que RELEER: si no, se bloquea con un dato viejo');
  assert.ok(/setBloqueo\(true\); return;/.test(probar), 'el aviso aparece al APRETAR, no en lugar del panel');

  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(/j\.codigoViejo/.test(board), '«Verificar» tiene que mirar la versión');
  assert.ok(/es de una versión anterior/.test(board), '«Verificar» no puede contestar que sí sobre un código al que le falta la mitad');
});

test('la prueba se corre sobre una landing ELEGIDA, no sobre «abrila vos»', () => {
  const probar = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/previo\?\.urls/.test(probar), 'las landings que ya mandaron eventos se ofrecen: pedir que tipee una URL que ya tenemos es trabajo inventado');
  // Ya no se abre `u` pelada: lleva pegado el marcador de la prueba. Lo que hay
  // que afirmar es que se abre en OTRA pestaña, no la forma exacta de la URL.
  assert.ok(/window\.open\(`\$\{base\}\$\{sep\}mko_test=/.test(probar), 'la prueba abre la página, como el Test Events de Meta');
  assert.ok(/'_blank', 'noopener'/.test(probar), 'siempre en otra pestaña');
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
  // ⚠️ Se ancla al `if (!activo)` DEL RENDER (el que sigue con `return (`), no al
  // primero que aparezca: hay otro adentro del useEffect, y el paso de «¿qué es
  // cada video?» vive en el medio con sus propios botones.
  // ⚠️ `lastIndexOf`: el aviso de Pixel viejo se pinta en DOS ramas, y la del paso
  // de los videos viene antes — con `indexOf` el recorte quedaba vacío y el test
  // contaba cero botones sobre un panel que sí los tiene.
  const idle = probar.slice(probar.indexOf('if (!activo) {\n    return ('), probar.lastIndexOf('{avisoViejo}'));
  const botones = idle.match(/<Button\b/g) ?? [];
  assert.equal(botones.length, 1, `el arranque de la prueba tiene que tener UN botón y tiene ${botones.length}`);
  assert.ok(/window\.open\(`/.test(probar) && /const arrancar/.test(probar), 'el único botón abre la página');
});

test('el código usa LA MISMA barra que una credencial, no una pieza propia', () => {
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  const i = board.indexOf('mk-key-row mk-key-row--code');
  const bloque = board.slice(i, i + 2600);

  // Mismo esqueleto que `.mk-key-row`: contenido a la izquierda, acciones
  // adentro al final. Dos cosas con la misma anatomía son UNA pieza con dos
  // configuraciones — mantenerlas separadas garantiza que diverjan.
  assert.ok(/mk-key-row mk-key-row--code/.test(bloque), 'el bloque de código tiene que ser la MISMA barra que una credencial, en oscuro');
  assert.ok(!/<details/.test(bloque), 'el «Ver el código» suelto se reemplazó por el chevron DENTRO de la barra');
  assert.ok(!/<Button\b/.test(bloque), 'los botones van DENTRO de la barra, como IconBtn');

  // Y son los IconBtn de la casa: el mismo componente que usa la barra de una
  // credencial, exportado en vez de copiado.
  assert.ok(/<IconBtn/.test(bloque), 'las acciones son IconBtn, no botones propios');
  assert.ok(/name="chevron"/.test(bloque), 'falta el chevron para expandir');
  // ⚠️ El «plug» YA NO vive acá: se mudó al lado del desplegable de páginas. Un
  // botón junto al código pregunta por el código; junto a la página, pregunta por
  // la página — y esa es la respuesta que sirve. Ver el test de verificarPagina.
  assert.ok(!/name="plug"/.test(bloque), 'el botón de verificar tiene que estar al lado del desplegable, no del código');
  assert.ok(/copiado \? 'check' : 'copy'/.test(bloque), 'copiar tiene que mostrar el tilde al copiar');
});

test('los íconos salen del catálogo, no son SVG sueltos', () => {
  // Si a un catálogo le falta algo, se le agrega AL catálogo — no se inventa un
  // SVG en la pantalla que lo necesitó.
  const icons = leer('../app/_components/icons.tsx');
  for (const n of ['copy', 'chevron', 'help', 'check', 'plug']) {
    assert.ok(new RegExp(`^  ${n}: `, 'm').test(icons), `falta el ícono ${n} en el catálogo`);
  }
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  // `lastIndexOf`: el texto aparece dos veces — en el comentario que explica el
  // bloque y en el JSX. El primero no tiene íconos, obviamente.
  assert.ok(!/'▲' : '▼'/.test(board), 'los triángulos de texto no escalan con el tamaño ni con el color: va el chevron del catálogo');
});

test('la barra del código arranca PLEGADA y la ayuda es su cuarto botón', () => {
  // Los dos síntomas que reportó el dueño salían de la MISMA causa: sin un
  // max-height, `overflow: hidden` no recorta nada — un <pre> de 200 líneas
  // crece hasta 200 líneas y la barra crece con él. Se veía desplegado siempre,
  // y de yapa los botones quedaban centrados contra un bloque altísimo.
  const css = leer('../app/globals.css');
  const i = css.indexOf('.mk-key-code {');
  const cerrada = css.slice(i, css.indexOf('}', i));
  // Se exige que EXISTA, no un número: cuántos renglones se ven plegado es una
  // decisión de diseño que va a cambiar (empezó en 1, hoy son 4). Lo que no
  // puede cambiar es que haya un tope.
  assert.ok(/max-height:\s*[\d.]+em/.test(cerrada), 'sin max-height en el estado CERRADO la barra no pliega nada');
  // Y el «…» que avisa que hay más: sin eso, plegado parece que el código
  // termina ahí.
  // El «…» lo pone `text-overflow` sobre UNA sola línea: con `nowrap` los saltos
  // se colapsan a espacios, así que entra el principio real del código y no solo
  // «<script>». La versión de cuatro renglones cortaba el último por la mitad,
  // que se lee como un error de render.
  assert.ok(/white-space: nowrap/.test(cerrada), 'plegado tiene que ser UNA línea, si no el «…» de text-overflow no aplica');
  assert.ok(/text-overflow: ellipsis/.test(cerrada), 'falta el «…» del plegado');
  // La barra oscura no puede aclararse al enfocarse: adentro no hay ningún
  // campo, así que el fondo blanco del :focus-within no aplica.
  assert.ok(/--code:focus-within \{[^}]*background: #0F1115/.test(css.replace(/\n/g, '')), 'la barra oscura se pone blanca al tocar un botón');
  assert.ok(/is-abierta \.mk-key-code \{[^}]*max-height: 260px/.test(css.replace(/\n/g, '')), 'falta el estado abierto');
  assert.ok(/--code\.is-abierta \{[^}]*align-items: flex-start/.test(css.replace(/\n/g, '')), 'abierta, los íconos van ARRIBA y no centrados contra el bloque');

  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  const j = board.indexOf('mk-key-row mk-key-row--code');
  const barra = board.slice(j, board.indexOf('{errorCopia', j));
  const botones = barra.match(/<IconBtn/g) ?? [];
  // TRES desde que verificar se mudó al desplegable: chevron, copiar y ayuda.
  // La ayuda sigue siendo el ÚLTIMO botón de la barra y no una fila aparte.
  assert.equal(botones.length, 3, `la barra tiene que tener 3 botones y tiene ${botones.length}`);
  assert.ok(/name="help"/.test(barra), 'el «?» va DENTRO de la barra, no en una fila aparte debajo');
});

test('el fondo y el borde del botón de barra NO van inline', () => {
  // Un estilo inline le gana a cualquier clase. Mientras el fondo blanco estuvo
  // inline en IconBtn, la variante oscura de la barra no podía repintarlo: los
  // botones salían blancos sobre negro y partían la barra al medio.
  const form = leer('../app/integraciones/ServicioConfigForm.tsx');
  const i = form.indexOf('export function IconBtn');
  // La ventana se corta en el `</button>` del propio componente. Ni `\n}` (la
  // firma ya cierra con `\n}) {`, así que dejaba afuera todo el cuerpo) ni un
  // largo fijo (se comía el componente de al lado, que sí tiene un borde inline
  // legítimo). Las dos versiones anteriores de este corte miraban el archivo
  // equivocado y el test decía cualquier cosa.
  const cuerpo = form.slice(i, form.indexOf('</button>', i));
  assert.ok(!/background:\s*'var\(--surface\)'/.test(cuerpo), 'volvió el fondo inline: la barra oscura no lo va a poder repintar');
  assert.ok(!/border:\s*'1px solid/.test(cuerpo), 'volvió el borde inline');
  assert.ok(/className="mk-icon-btn"/.test(cuerpo), 'el botón necesita su clase para que la variante oscura lo alcance');

  const css = leer('../app/globals.css');
  assert.ok(/\.mk-icon-btn \{[^}]*background: var\(--surface\)/.test(css.replace(/\n/g, '')), 'el fondo tiene que vivir en la clase');
  // Se exige que EXISTA la variante oscura, no un hex: el color se va a seguir
  // ajustando (el primero quedó casi del color del fondo y era invisible).
  assert.ok(/--code \.mk-icon-btn \{[^}]*background: #[0-9A-Fa-f]{6}/.test(css.replace(/\n/g, '')), 'falta la variante oscura del botón');
  // Y las barras de scroll del código no pueden ser las del navegador: blancas
  // y anchas sobre negro son el «tipo HTML» que el resto de la app evita.
  assert.ok(/scrollbar-color:/.test(css) && /::-webkit-scrollbar-thumb/.test(css), 'faltan las barras de scroll oscuras');
});

test('editar y borrar están DENTRO de cada renglón del desplegable', () => {
  // Tenerlos solo afuera alcanza para la página SELECCIONADA. Con siete
  // renglones de la misma landing —los previews de deploy—, sacar el que sobra
  // obligaba a seleccionarlo primero: a elegir justo lo que querés que
  // desaparezca. Ahora cada renglón trae los suyos.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/acciones: accionesDe\(u\)/.test(panel), 'los renglones del desplegable no traen sus acciones');
  assert.ok(/const accionesDe = \(u: string\)/.test(panel), 'falta el par corregir/quitar por renglón');
  // Y borrar OTRA no puede hacerte perder la que estabas por probar.
  assert.ok(/if \(mismaPagina\(u, url\)\) setUrl\(''\)/.test(panel), 'solo se deselecciona si se borró la elegida');

  // La capacidad se le agrega AL Dropdown de la casa, no a un segundo desplegable.
  const dd = leer('../app/components/Dropdown.tsx');
  assert.ok(/export type DropdownAccion/.test(dd), 'la acción por renglón tiene que ser del sistema, no de esta pantalla');
  // ⚠️ Un <button> adentro de otro es marcado inválido Y el click del de afuera
  // se dispara igual: «borrar» además seleccionaría lo que se acaba de borrar.
  assert.ok(/if \(!o\.acciones\?\.length\)/.test(dd), 'sin acciones el renglón tiene que seguir siendo UN solo button, como en las demás pantallas');
  assert.ok(/e\.stopPropagation\(\); e\.preventDefault\(\)/.test(dd), 'sin frenar el click, el menú se cierra y la acción se lee como que no pasó nada');
});

test('los previews de deploy no llenan el desplegable con la misma página', () => {
  // El síntoma era «se guardan un montón de URLs iguales con números adelante».
  // La causa estaba en la deduplicación, que comparaba el texto CRUDO.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/\.map\(\(v\) => normalizarUrl\(v\.landing_url \?\? ''\)\)/.test(lib), 'las urls detectadas se deduplican normalizadas, no por su texto');
  assert.ok(!/\.map\(\(v\) => \(v\.landing_url \?\? ''\)\.trim\(\)\)/.test(lib), 'volvió la deduplicación por texto crudo');
});

test('un lead de landing AVISA, o la propuesta no existe para nadie', () => {
  // ⚠️ EL DEFECTO QUE ESTE TEST CUIDA, medido en producción el 14/08/2026: el
  // ws11 tenía OCHO propuestas de lead en `pendiente`, con nombre y teléfono, que
  // nadie vio nunca. El sistema funcionaba exactamente como estaba escrito.
  //
  // La pantalla de revisión es /crm/revisar/<id> — POR ID, sin lista. Para los
  // otros canales el link vuelve por la misma conversación (WhatsApp, Claude), así
  // que nadie lo pensó dos veces. Un formulario de landing NO TIENE CANAL DE
  // VUELTA: quien lo completa ve la página de gracias del cliente. Si el link no
  // sale por un aviso, no sale por ningún lado.
  const ruta = RUTA();
  assert.ok(/emitirDelCatalogo\('lead-de-landing'/.test(ruta), 'sin aviso, la propuesta queda en pendiente para siempre');
  assert.ok(/if \(nueva\)/.test(ruta), 'un reintento del mismo formulario no puede volver a sonar');
  // El LINK lo arma el código. Un id de 16 caracteres al azar transportado por un
  // LLM ya falló en este repo, y la forma silenciosa —un link que resuelve a una
  // propuesta REAL pero equivocada— es la peor.
  assert.ok(/texto: `/.test(ruta), 'el mensaje va determinista (texto), no escrito por el modelo (contexto)');
  assert.ok(/\$\{APP_BASE_URL\}\/crm\/revisar\/\$\{id\}/.test(ruta), 'falta el link absoluto a la propuesta real');
  // Y el aviso NO puede tumbar la ingesta: el lead ya está guardado, y eso es el
  // hecho. Lo que se pierde si el aviso falla es la notificación, no la persona.
  assert.ok(/\.catch\(\(e\) => \{/.test(ruta.slice(ruta.indexOf("emitirDelCatalogo('lead-de-landing'"))), 'un aviso caído no puede perder el lead');

  const cat = leer('../lib/avisos-catalogo.ts');
  assert.ok(/'lead-de-landing': 'landing'/.test(cat), 'el aviso necesita su área en AREA_POR_AVISO');
  assert.ok(/id: 'lead-de-landing'/.test(cat), 'falta la ficha del aviso en el catálogo');
});

test('el chequeo del formulario cuenta los que ESPERAN, no solo los que llegaron', () => {
  // «Llegó al menos un formulario ✓» se lee como «esto funciona, seguí» — y era
  // cierto. Lo que faltaba es el segundo verbo: llegó ¿y ENTRÓ? Una propuesta sin
  // confirmar no es un lead: es una persona que dejó su teléfono y a la que nadie
  // escribió. Con gente esperando, el estado es de ACCIÓN, no de éxito.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/\.eq\('estado', 'pendiente'\)/.test(lib), 'el chequeo tiene que contar las que esperan');
  // ⚠️ CAMBIÓ A PROPÓSITO: ahora el chequeo va en VERDE aunque haya pendientes.
  // Los leads entran solos, así que el formulario ESTÁ entrando — que es lo que
  // este renglón mide. Lo que queda esperando es un CHOQUE: alguien que parece
  // estar ya en el CRM. Eso no es una tarea pendiente del sistema sino una
  // decisión que solo puede tomar una persona, y va como un aparte en el mismo
  // texto para no volver a teñir de amarillo algo que funciona.
  assert.ok(/estado: !declarado \? 'viejo' : hayOptin \? 'ok' : 'falta'/.test(lib),
    'el chequeo mide si el formulario entra, no si quedó alguien por decidir');
  assert.ok(lib.includes('Hay ${pendientes} pendiente'), 'los que coinciden se mencionan, no se esconden');
  // «Ver el pendiente», no «Revisar»: revisar sugiere que hay que aprobar cada
  // lead, y los leads entran solos. Lo único que espera es una decisión sobre un
  // contacto que coincide con otro.
  assert.ok(lib.includes("'Ver el pendiente'"), 'el botón no puede sugerir que hay que aprobar cada lead');
  // Sin ventana de tiempo a propósito: una de hace tres días sin revisar es MÁS
  // urgente que la de hoy, no menos.
  const i = lib.indexOf("eq('estado', 'pendiente')");
  assert.ok(!/gte\('created_at', desde\)/.test(lib.slice(i - 200, i + 100)), 'las pendientes NO se filtran por ventana de tiempo');
  // Y tiene que LLEVAR a algún lado: la pantalla de revisión es por id.
  assert.ok(/accion\?: \{ texto: string; href: string \}/.test(lib), 'el chequeo necesita poder llevar a resolverlo');
  // ⚠️ A LA BANDEJA, no a uno suelto. La primera versión de este arreglo linkeaba
  // al más reciente, y a los otros siete no se llegaba por ningún lado — que es
  // exactamente el agujero que el chequeo venía a cerrar.
  assert.ok(/href: '\/crm\/revisar'/.test(lib), 'el chequeo tiene que llevar a la lista, no a una sola propuesta');
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/c\.accion && \(/.test(panel), 'la pantalla no pinta el link del chequeo');
});

test('un evento que no se pudo clasificar se explica, no se muestra crudo', () => {
  // El beacon guarda 'desconocido' cuando le llega un tipo que no sabe clasificar
  // (código viejo o modificado) — y está bien guardarlo, porque es evidencia. Lo
  // que estaba mal era pintarlo tal cual: la palabra «desconocido» sola en la
  // lista se lee como que algo se rompió recién.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/e\.tipo === 'desconocido'/.test(panel), 'el evento sin clasificar necesita su traducción');
  const beacon = leer('../app/api/track/vsl/route.ts');
  assert.ok(/tipoEvento = 'desconocido'/.test(beacon), 'el beacon sigue guardándolo en vez de coercionarlo a play');
});

test('los CLICKS se miden: el CTA y el link de WhatsApp son el embudo', () => {
  // Reportado el 14/08/2026: «le apreté a varios botones de CTA que scrollean al
  // opt-in y eso no se registró» y «le di click al enlace de WhatsApp y no se
  // registró». Era cierto — el snippet solo emitía pageview, play, pNN, sNN y
  // exit. Para una landing cuyo CTA es un ancla (#registro), entre «visitó» y
  // «dejó sus datos» no había NINGÚN punto intermedio: una página que convierte
  // mal no se distinguía de una que nadie mira.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/addEventListener\('click'/.test(lib), 'el snippet no registra clicks');
  assert.ok(/tipo_evento: 'click'/.test(lib), 'el click necesita su propio tipo de evento');
  // NUNCA se frena el click: lo que la persona quería hacer tiene que pasar igual.
  const i = lib.indexOf("addEventListener('click'");
  assert.ok(!/preventDefault/.test(lib.slice(i, i + 1800)), 'un click frenado rompe la landing del cliente para medirla');
  // Tope por carga: sin esto un carrusel o un doble click manda cientos y el
  // ruido tapa lo que importa.
  assert.ok(/CLICKS >= 40/.test(lib), 'falta el tope de clicks por carga');
  // El DESTINO manda sobre el texto: dos botones distintos pueden ir al mismo
  // lado, y lo que se quiere contar es adónde va la gente.
  assert.ok(/el\.getAttribute\('href'\)/.test(lib), 'el destino del link es el dato, no solo el texto');

  // El beacon tiene que ACEPTARLO: había una lista blanca que lo habría guardado
  // como 'desconocido'.
  const beacon = leer('../app/api/track/vsl/route.ts');
  assert.ok(/tipoEvento !== 'click'/.test(beacon), "sin sumarlo a la lista blanca, el click entra como 'desconocido'");
  assert.ok(/detalle: texto\(payload\.detalle, 300\)/.test(beacon), 'el destino del click tiene que persistirse');
  // ⚠️ Columna propia, no reusar `vsl_titulo`: «cómo se llama el video» y «qué se
  // clickeó» son dos preguntas, y meterlas en un campo pierde una de las dos.
  const mig = leer('../supabase/migrations/0133_vsl_events_detalle.sql');
  assert.ok(/add column if not exists detalle text/.test(mig), 'falta la columna');
  assert.ok(!/default/i.test(mig.replace(/--[^\n]*/g, '')), 'un default inventaría un dato en los eventos que no son clicks');

  // Y se tiene que LEER en pantalla diciendo en QUÉ se hizo click.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/e\.tipo === 'click'/.test(panel), 'el click no se traduce en la lista de eventos');
  assert.ok(/r\.detalle \?\? r\.vsl_titulo/.test(lib), 'el detalle del click no llega a la pantalla');
});


test('existe la BANDEJA: un aviso es un evento, una lista es un estado', () => {
  // `propuestasPendientes()` vivía en lib/propuestas.ts desde el día uno con CERO
  // call-sites. La única forma de llegar a una propuesta era su link directo, y
  // para la landing ese link no se mandaba a ningún lado. El aviso nuevo cubre lo
  // que entra de acá en adelante; la bandeja rescata lo que ya estaba, y es la
  // red para cuando un aviso no se manda, no llega, o se lee y se olvida.
  const pag = leer('../app/crm/revisar/page.tsx');
  assert.ok(/propuestasPendientes\('lead'\)/.test(pag), 'la bandeja tiene que usar el lector que ya existía');
  assert.ok(/\.catch\(\(\) => \[\] as Propuesta\[\]\)/.test(pag), 'una bandeja caída no puede tumbar la navegación del CRM');
  assert.ok(/from '@\/app\/_ui\/Link'/.test(pag), 'el Link de la casa preserva el ?ws= del cliente que se está mirando');
  assert.ok(/getUsuarioActual\(\)/.test(pag) && /redirect\('\/inicio'\)/.test(pag), 'la bandeja no puede quedar abierta');
});

test('la llave de idempotencia del opt-in se normaliza', () => {
  // Era el teléfono CRUDO del input, así que la MISMA persona escribiendo
  // «998 136 1529» y «9981361529» creaba dos propuestas — justo lo que la
  // idempotencia venía a evitar.
  const ruta = RUTA();
  // ⚠️ Se afirma sin escribir la barra invertida. En una cadena de JS `"\D"` es
  // una secuencia de escape que no existe y se colapsa a `"D"`, así que la
  // aserción literal buscaba `/D/g` y fallaba sobre el código correcto. Cuando lo
  // que hay que afirmar contiene barras, se afirman las PARTES inequívocas.
  assert.ok(/replace\(\/\\D\/g, ''\)/.test(ruta), 'el teléfono se reduce a sus dígitos antes de ser la llave');
  assert.ok(ruta.includes('.slice(-10)'), 'el mismo número con y sin código de país es el mismo número');
  assert.ok(/const clave = email \?\?/.test(ruta), 'el email manda sobre el teléfono como identidad');
});

test('el probador muestra SOLO los eventos de esta prueba', () => {
  // Reportado el 14/08/2026: «al darle probar te trae TODOS los eventos pasados y
  // eso confunde, lo supe porque vi diferentes horarios». Era cierto: la ventana
  // era de 24 h. Es el mismo mecanismo que el `test_event_code` de Meta.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/mko_test=\$\{id\}/.test(panel), 'la landing se abre sin el marcador de la prueba');
  // ⚠️ El hash va SIEMPRE al final: `pagina.com/#registro?mko_test=x` deja el
  // parámetro DENTRO del hash y `location.search` no lo ve nunca — y esa landing
  // es justamente la que se prueba con `#registro`.
  assert.ok(/const \[base, hash\] = u\.split\('#'\)/.test(panel), 'con un ancla en la URL el parámetro quedaría adentro del hash');
  // Y el marcador viaja en CADA consulta, incluida la del intervalo: pasar
  // `traer` directo a setInterval le entrega el contador del timer como primer
  // argumento, y el filtro se perdía a los 3 segundos.
  assert.ok(/const consultar = \(\) => \{ void traer\(undefined, prueba\); \}/.test(panel), 'el poll pierde el marcador');

  const lib = leer('../lib/landing-token.ts');
  assert.ok(/landingDiagnostico\(prueba\?: string \| null\)/.test(lib), 'el diagnóstico tiene que poder filtrar por prueba');
  assert.ok(/prueba \? qVsl\.eq\('prueba', prueba\) : qVsl\.gte/.test(lib), 'con marcador se filtra por marcador, sin él por ventana de tiempo');
  // El snippet lo devuelve, y sobrevive a navegar dentro de la pestaña.
  assert.ok(/sessionStorage\.setItem\('mko_test', prueba\)/.test(lib), 'el marcador tiene que sobrevivir a un CTA que va a otra página');
  assert.ok(/if \(prueba\) data\.prueba = prueba/.test(lib), 'el marcador tiene que viajar en cada evento');
  // sessionStorage y NO una cookie: una cookie contaminaría el tráfico real
  // durante un año, marcando como «prueba» visitas que no lo son.
  assert.ok(!/mko_test[^\n]*max-age/.test(lib), 'el marcador NO puede vivir en una cookie');
});

test('un opt-in APARECE en el feed del probador', () => {
  // El feed se armaba solo con vsl_events y landing_visits, así que un formulario
  // que entraba PERFECTO no producía un solo renglón — y la instrucción decía
  // «completá tu propio formulario, los eventos aparecen acá». Una promesa que la
  // pantalla no podía cumplir, y se leyó como «el formulario no se registró».
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/tipo: 'optin'/.test(lib), 'el opt-in no llega al feed de eventos');
  assert.ok(/from\('propuestas'\)[^\n]*eq\('origen', 'landing'\)/.test(lib), 'el opt-in vive en propuestas, no en una tabla de eventos');
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/e\.tipo === 'optin'/.test(panel), 'el opt-in no se traduce en la lista');
});

test('descartar una propuesta NO encadena a esa persona para siempre', () => {
  // `crearPropuesta` hacía `select('id, estado')` y NO miraba el estado: cualquier
  // fila con esa ref bloqueaba, incluida una DESCARTADA. Descartar no significa
  // «esta persona no existe»: significa «esto no era un lead» o «me equivoqué».
  // Si mañana vuelve a completar el formulario, eso es intención NUEVA.
  const p = leer('../lib/propuestas.ts');
  assert.ok(/estado !== 'descartada'/.test(p), 'una propuesta descartada no puede bloquear a esa persona');
  // Las otras dos SÍ bloquean, y por razones distintas: 'pendiente' ya está
  // esperando, y 'aplicada' significa que el lead YA está en el CRM.
  assert.ok(/refFinal = `\$\{ref\}:\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}`/.test(p), 'la ref nueva necesita ser distinta de la vieja');
  // Y la llave del día se consulta también, o el segundo submit del mismo día
  // choca contra el unique de `ref`.
  assert.ok(/eq\('ref', refFinal\)/.test(p), 'sin esto el segundo submit del día rompe la idempotencia que esta rama habilita');
});

test('un <video> NATIVO también se mide, no solo los iframes de Panda', () => {
  // ⚠️ EL AGUJERO QUE ESTE TEST CUIDA, y era el caso de la PRIMERA clienta que lo
  // usó: su landing tiene un `<video controls>` común, no un iframe de Panda. El
  // snippet escuchaba solo mensajes `panda_*`, así que apretaba play y no se
  // registraba nada. Peor: el panel decía «nadie reprodujo el video en 24 h» —una
  // afirmación que iba a ser cierta para siempre, porque nunca iba a llegar un
  // evento— y como no se detectaba ningún video, tampoco aparecía la pantalla
  // para decir cuál es el VSL. Un solo hueco, tres síntomas que no se parecen.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/document\.querySelectorAll\('video'\)/.test(lib), 'el snippet no busca videos nativos');
  assert.ok(/el\.addEventListener\('play'/.test(lib), 'un <video> emite eventos del DOM, no postMessage');
  assert.ok(/el\.addEventListener\('timeupdate'/.test(lib), 'sin timeupdate no hay retención, solo el play');
  // Reusa el MISMO estado por video que Panda: dos clases de player alimentando
  // dos modelos distintos es cómo se llega a dos curvas que no se pueden comparar.
  assert.ok(/var e = est\(id\)/.test(lib), 'el video nativo tiene que usar el mismo estado por video');
  // Idempotente: el observer vuelve a pasar sobre los mismos elementos.
  assert.ok(/if \(el\.__mko\) continue/.test(lib), 'sin marca, cada pasada del observer engancha el mismo video otra vez');
  // Los videos que aparecen DESPUÉS: un builder monta el player al hacer scroll.
  assert.ok(/new MutationObserver\(engancharNativos\)/.test(lib), 'enganchar solo al cargar deja sin medir el video de más abajo');
  // El id sale de lo que IDENTIFICA al video; la posición es el último recurso,
  // porque reordenar la página cambiaría de qué video habla cada curva.
  assert.ok(/if \(el\.id\) return 'v:' \+ el\.id/.test(lib), 'el id del elemento manda sobre la posición');
});

test('los chequeos van en el orden del EMBUDO, y la versión primero', () => {
  const lib = leer('../lib/landing-token.ts');
  const i = lib.indexOf('const chequeos: ChequeoDiag[]');
  const fin = lib.indexOf('\n  ];', i);
  const ids = [...lib.slice(i, fin).matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]);
  // La VERSIÓN va primera aunque no sea un paso del embudo: si el código está
  // viejo, todos los demás chequeos miden otra cosa y sus resultados no
  // significan nada. Después, el recorrido de la persona que visita.
  assert.deepEqual(ids, ['version', 'pageview', 'play', 'profundidad', 'click', 'optin']);

  // Y en una PRUEBA los textos hablan de la prueba, no de las últimas 24 h: quien
  // acaba de apretar play no quiere que le contesten con una estadística del día.
  const bloque = lib.slice(i, fin);
  assert.ok(/enPrueba \? 'Aún no llega\. Reproduce tu video/.test(bloque), 'en una prueba no se dice «nadie reprodujo en 24 h»');
  assert.ok(/const enPrueba = !!prueba/.test(lib), 'los chequeos tienen que saber si están dentro de una prueba');
});

test('el marcador de prueba NO ensucia la lista de páginas', () => {
  // El propio probador llenaba la lista con copias de la misma landing: cada
  // corrida abre `?mko_test=<id>` distinto, y eso entraba como una página nueva.
  // Los UTM y los click-ids son el mismo caso: dicen de dónde vino esta VISITA,
  // no qué página es.
  const lib = leer('../lib/landing-paginas.ts');
  assert.ok(/PARAMS_DE_MEDICION/.test(lib), 'faltan los parámetros que no identifican una página');
  assert.ok(/'mko_test'/.test(lib), 'el marcador propio es el primero que hay que sacar');
  assert.ok(/for \(const p of PARAMS_DE_MEDICION\) u\.searchParams\.delete\(p\)/.test(lib), 'no se están sacando al normalizar');
});

test('verificar pregunta por LA PÁGINA elegida, no por el workspace', () => {
  // El botón vivía al lado del código y contestaba «¿llegó algún evento alguna
  // vez?». Un cliente con dos landings publicadas —la vieja y la nueva— tenía UNA
  // sola respuesta para las dos, y era la del que hubiera mandado el último
  // evento. Al lado del desplegable la pregunta cambia y se vuelve la útil.
  const lib = leer('../lib/landing-token.ts');
  assert.ok(/export async function verificarPagina/.test(lib), 'falta la verificación por página');
  // ⚠️ Se compara NORMALIZADO en las dos puntas. En la base conviven la URL con
  // barra final, con hash y con los parámetros de cada campaña: un `eq` sobre el
  // texto crudo diría «no está instalada» sobre una página que mide hace meses.
  assert.ok(/normalizarUrl\(r\.landing_url \?\? ''\) === url/.test(lib), 'comparar el texto crudo daría un falso «no instalada»');
  // La versión sale de la visita MÁS RECIENTE que la traiga: si repegaron el
  // código hace una hora, eso manda sobre 300 visitas viejas.
  assert.ok(/filas\.find\(\(r\) => r\.sv != null\)/.test(lib), 'la versión tiene que salir de la visita más reciente');
  assert.ok(/version < SNIPPET_VERSION/.test(lib), 'sin comparar contra la actual no puede decir «vieja»');

  const beacon = leer('../app/api/track/vsl/route.ts');
  assert.ok(/sv: Number\.isFinite/.test(beacon), 'sin guardar sv por visita no hay versión por página');

  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/verificarEsta/.test(panel), 'el panel no puede verificar la página elegida');
  assert.ok(/name="plug"/.test(panel), 'el botón de verificar tiene que estar al lado del desplegable');
  // Y se fue de la barra del código: dos botones que preguntan cosas distintas
  // con el mismo ícono es peor que uno solo en el lugar correcto.
  const board = leer('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(!/<IconBtn name="plug"/.test(board), 'el botón viejo sigue en la barra del código');
  // Cambiar de página invalida la verificación anterior: dejarla pintada haría
  // creer que el resultado es de la página que ahora está elegida.
  assert.ok(/setEditando\(null\); setVerif\(null\)/.test(panel), 'la verificación vieja tiene que limpiarse al cambiar de página');
});

test('la prueba abre una ventana de prueba de MaKo ENCIMA de la landing', () => {
  // Para verificar que un click se registra hay que hacerlo EN la landing y mirar
  // el resultado EN MaKo: con dos pestañas eso es alternar a ciegas.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/\/integraciones\/escuchando\?p=\$\{id\}/.test(panel), 'falta la ventana de prueba');
  assert.ok(/'mako_prueba'/.test(panel), 'con nombre, dos pruebas seguidas reusan la ventana en vez de sembrar huérfanas');
  // ⚠️ Se abre DESPUÉS de la landing: la última que se abre queda arriba, y la
  // que tiene que quedar arriba es esta.
  const iLanding = panel.indexOf('mko_test=${id}');
  const iVentana = panel.indexOf('/integraciones/escuchando?p=');
  assert.ok(iLanding > 0 && iVentana > iLanding, 'la ventana de prueba se abre después, para quedar encima');
  // Si el navegador la bloquea, el panel de la tab sigue funcionando: la prueba
  // no puede depender de un permiso que no controlamos.
  // La pestaña de atrás NO cambia: sigue mostrando la misma prueba. Un panel que
  // se reemplaza por «esto corre en otro lado» obliga a volver para enterarse de
  // que no hay nada que ver ahí.
  assert.ok(!/enVentana/.test(panel), 'la pestaña no puede cambiar porque se abrió la ventana de prueba');
  // Y no se poll-ea dos veces lo mismo.

  // La ventana de prueba reusa el MISMO componente: una segunda copia del panel es una
  // copia que se queda vieja.
  const pag = leer('../app/integraciones/escuchando/page.tsx');
  assert.ok(/<ProbarTracking pruebaInicial=\{p\} \/>/.test(pag), 'la ventana de prueba tiene que reusar el panel, no copiarlo');
  assert.ok(/requireRolWs\(\[\], \{ nav: 'integraciones' \}\)/.test(pag), 'una ventana sin chrome sigue siendo la misma pantalla: el permiso no se relaja');
  assert.ok(/if \(!p\) redirect/.test(pag), 'sin marcador no hay nada que escuchar');
});

test('«qué es cada video» es un PASO de la prueba, no un formulario colgado', () => {
  // Colgado del panel permanentemente era una tarea abierta que nadie iba a
  // cerrar: está ahí desde que entrás y nada dice para qué sirve contestarla.
  // Preguntada justo antes de la prueba tiene contexto — lo que estás por hacer
  // es mirar los eventos de esos videos.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/useState<'inicio' \| 'videos'>\('inicio'\)/.test(panel), 'la prueba necesita el paso previo');
  // «no le he cargado de qué se trata» y «se agregaron nuevos» son EL MISMO
  // estado: hay un video detectado sin respuesta guardada.
  assert.ok(/const sinNombre = detectadosVideo\.filter/.test(panel), 'falta detectar los videos sin nombre');
  assert.ok(/if \(paso !== 'videos' && sinNombre\.length > 0\) \{ setPaso\('videos'\); return; \}/.test(panel),
    'con videos sin nombre, «Probar» tiene que preguntar ANTES de los pasos');
  // ⚠️ Y «Siguiente» NO exige contestar: un paso que bloquea sobre algo opcional
  // convierte la prueba en un trámite. La pregunta vuelve sola la próxima vez,
  // porque el dato sigue faltando.
  const i = panel.indexOf("if (paso === 'videos')");
  const bloque = panel.slice(i, panel.indexOf('// La prueba corre en la ventana de prueba', i));
  assert.ok(/>\s*Probar\s*</.test(bloque), 'falta el botón que sigue a la prueba');
  assert.ok(!/disabled=\{sinNombre/.test(bloque), 'nombrar los videos no puede ser obligatorio para probar');
  // La salida para corregirse existe, y NO es el formulario abierto de vuelta:
  // es la respuesta actual a la vista, que es lo único que permite darse cuenta
  // de que uno se equivocó.
  assert.ok(/Tus videos: \{videosGuardados\.map/.test(panel), 'falta el renglón que nombra lo declarado');
  assert.ok(/title="Cambiar la identificación de cada video"/.test(panel), 'falta la forma de corregirlo');
});

test('la ventana de prueba se dibuja SOLA, sin el sidebar', () => {
  // Mide 440 px: el riel del sidebar es fijo y se come un cuarto del ancho para
  // navegar a lugares a los que nadie va a ir desde acá — lo único que se hace en
  // esa ventana es mirar entrar eventos y cerrarla.
  const gate = leer('../app/_components/PublicRouteGate.tsx');
  // Se busca dentro de `esVistaSinChrome` y no en el archivo entero: la ruta
  // podría estar nombrada en un comentario y el test daría verde sobre un gate
  // que no la cubre.
  const j = gate.indexOf('export function esVistaSinChrome');
  const cuerpo = gate.slice(j, gate.indexOf('\n}', j));
  assert.ok(cuerpo.includes('escuchando'), 'la ventana de prueba sigue heredando el chrome de la app');
  // Se suma al predicado que YA existía para esto, no a un mecanismo nuevo: son
  // dos preguntas distintas —«¿la puede ver alguien de afuera?» y «¿se dibuja
  // sola?»— y esta ventana exige sesión pero va limpia, igual que el resumen del
  // lead que se abre en el celular.
  assert.ok(/export function esVistaSinChrome/.test(gate), 'el predicado tiene que seguir siendo uno solo');
  const i = gate.indexOf('export function esVistaSinChrome');
  assert.ok(/isPublicLandingPath\(p\)/.test(gate.slice(i, i + 700)), 'sin-chrome no puede dejar de cubrir las públicas');
});

test('cada video se puede VER desde la pantalla que te pide nombrarlo', () => {
  // Un id como «v:que-se-vive.mp4» alcanza para atribuir eventos y no para
  // RECONOCERLO: con dos videos en la página había que adivinar cuál se estaba
  // nombrando. La pregunta era incontestable sin salir de la app.
  const lib = leer('../lib/landing-token.ts');
  // El dato viaja en el 'play' de las dos clases de player, o la mitad de los
  // clientes tendría el botón y la otra mitad no.
  assert.ok(/detalle: \(el\.currentSrc \|\| el\.getAttribute\('src'\) \|\| ''\)/.test(lib), 'el <video> nativo no manda su URL');
  assert.ok(/enviar\(\{ tipo_evento: 'play'[^\n]*detalle: src\.slice\(0, 300\)/.test(lib), 'el player de Panda no manda su URL');
  // La URL viene SOLO en el play: pisarla con el null de los demás eventos la
  // perdería, igual que pasaba con el título.
  assert.ok(/if \(!e\.url && r\.detalle\?\.trim\(\)\.startsWith\('http'\)\)/.test(lib), 'la URL se pierde entre los eventos que no la traen');

  const ui = leer('../app/integraciones/NombrarVideos.tsx');
  assert.ok(/title="Ver este video"/.test(ui), 'falta el botón de ver');
  assert.ok(/target="_blank" rel="noopener noreferrer"/.test(ui), 'abrir el video no puede sacarte de la app');
  // Solo si sabemos dónde está: un botón que no puede abrir nada es peor que
  // ninguno — promete y falla, y quien lo aprieta no sabe si el roto es el video.
  assert.ok(/\{d\.url \? \(/.test(ui), 'el botón no puede aparecer sin URL');
  // ⚠️ Y LA AUSENCIA SE EXPLICA. Esconderlo es correcto; esconderlo EN SILENCIO
  // deja a la persona buscando un botón que le dijimos que existía. La razón es
  // accionable: la URL viaja desde la v8, así que un video con eventos y sin URL
  // es uno cuyo código todavía es anterior.
  assert.ok(/para verlo, actualiza el Pixel/.test(ui), 'un botón que falta sin decir por qué se lee como una pantalla rota');
});


test('el aviso de Pixel viejo se pinta en LOS DOS pasos', () => {
  // ⚠️ EL ERROR QUE SE REPITE, y este es el tercero de la misma familia:
  // cambiar un estado que se renderiza en una rama que NO se está mostrando.
  // `arrancar()` prende `bloqueo`, y el aviso solo vivía en el panel de inicio:
  // apretar «Probar» desde el paso de los videos cambiaba el estado y la pantalla
  // quedaba quieta, como si el botón estuviera roto.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  const iPaso = panel.indexOf("if (paso === 'videos')");
  const finPaso = panel.indexOf('if (!activo) {\n    return (');
  assert.ok(iPaso > 0 && finPaso > iPaso, 'no se encontró el paso de los videos');
  assert.ok(panel.slice(iPaso, finPaso).includes('{avisoViejo}'), 'el paso de los videos no puede tragarse el aviso');
  // Y sigue estando en el de inicio: no se movió, se sumó.
  assert.ok(panel.slice(finPaso).includes('{avisoViejo}'), 'el panel de inicio perdió el aviso');
});
