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
