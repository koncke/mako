// =============================================================================
// Microsoft Clarity: el link al lead, el BYOK y lo que NO se puede hacer
// =============================================================================
// La investigación (docs/heatmaps-decision.md) dejó cuatro límites de Clarity que
// el código tiene que respetar o la integración promete lo que no puede dar:
// API de 10 requests por día, sin endpoint de grabaciones, sin embeber el
// reproductor, y credenciales por cliente. Los tests cuidan esas cuatro.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const LIB = () => leer('../lib/clarity.ts');

test('BYOK: la credencial es del CLIENTE, nunca de la plataforma', () => {
  // ⚠️ Si el project id viviera en una env nuestra, TODOS los clientes
  // escribirían en el proyecto de Clarity del dueño y ninguno vería el suyo.
  const s = LIB();
  assert.ok(/credWs\('CLARITY_PROJECT_ID', ws\)/.test(s), 'el id del proyecto tiene que salir del workspace');
  assert.ok(/credWs\('CLARITY_API_TOKEN', ws\)/.test(s), 'el token tiene que salir del workspace');
  assert.ok(!/process\.env\.CLARITY/.test(s), 'una env de plataforma haría que todos escriban en el proyecto del dueño');
  // El centinela PENDING no puede pasar por un id válido: daría un link roto.
  assert.ok(/startsWith\('PENDING'\)/.test(s), 'una credencial a medias no puede tratarse como conectada');
  const cat = leer('../lib/integraciones-catalogo.ts');
  assert.ok(/key: 'clarity'[^\n]*CLARITY_PROJECT_ID[^\n]*CLARITY_API_TOKEN/.test(cat), 'Clarity necesita su entrada en el catálogo para que la pantalla pida las credenciales');
});

test('el link va FILTRADO por la persona, o no va', () => {
  // Es la mitad del valor: sin el filtro, el botón lleva a una lista de miles de
  // sesiones anónimas. Con él, lleva a lo que hizo ese lead.
  const s = LIB();
  assert.ok(/CustomUserId=\$\{encodeURIComponent\(vid\)\}/.test(s), 'el link tiene que filtrar por nuestro visitor_id');
  // Sin visitor_id o sin proyecto NO se devuelve link: un botón que no puede
  // abrir nada promete y falla, y quien lo aprieta no sabe qué está roto.
  assert.ok(/if \(!vid\) return null/.test(s), 'sin identificador no puede haber botón');
  assert.ok(/if \(!pid\) return null/.test(s), 'sin proyecto conectado no puede haber botón');
  const card = leer('../app/crm/lead-view/ComportamientoCard.tsx');
  assert.ok(/\{urlClarity && \(/.test(card), 'la tarjeta no puede pintar el botón sin link');
  // ⚠️ SE LINKEA, NO SE EMBEBE: Clarity no permite su reproductor en un iframe.
  assert.ok(/target="_blank" rel="noopener noreferrer"/.test(card), 'abre en otra pestaña, no dentro de la ficha');
  assert.ok(!/<iframe/.test(card), 'Clarity no se puede embeber: un marco vacío es peor que un link');
});

test('el identify viaja en el MISMO script que el Pixel', () => {
  // El cliente pega UNA cosa. Pedirle un segundo script es garantizar que la
  // mitad pegue uno solo y que después nadie sepa cuál falta.
  const s = LIB();
  assert.ok(/window\.clarity\("identify", visitorId\)/.test(s), 'sin identify, la grabación no se puede atar al lead');
  const lt = leer('../lib/landing-token.ts');
  assert.ok(/\$\{bloqueClarity\(clarityProjectId\)\}/.test(lt), 'el bloque de Clarity tiene que ir dentro del snippet');
  // Y Clarity es OPCIONAL: sin proyecto, el Pixel tiene que seguir igual.
  assert.ok(/if \(!projectId\) return ''/.test(s), 'sin Clarity el Pixel tiene que seguir midiendo');
  // Nunca puede tumbar la medición propia si Microsoft está caído.
  const i = s.indexOf('bloqueClarity');
  assert.ok(/try \{/.test(s.slice(i)) && /catch \(e\) \{\}/.test(s.slice(i)), 'Clarity caído no puede romper el Pixel');
});

test('la cuota de 10 por día no se consulta desde una pantalla', () => {
  // ⚠️ Documentado por Microsoft: 10 requests por proyecto por día. Tres personas
  // abriendo una tab dos veces la agotan antes del mediodía, y la pantalla queda
  // en blanco sin que nada explique por qué.
  const s = LIB();
  assert.ok(/NO LO LLAMES DESDE UNA PANTALLA/.test(s), 'la cuota tiene que estar advertida donde se lee');
  // El 402 es el de cuota agotada y merece su propio mensaje: «falló» a secas
  // manda a revisar el token, que es justo lo que NO está mal.
  assert.ok(/r\.status === 402/.test(s), 'la cuota agotada no puede confundirse con un token inválido');
  assert.ok(/r\.status === 401/.test(s), 'un token vencido tiene que decirse como tal');
  assert.ok(/numOfDays=\$\{dias\}/.test(s), 'la API solo acepta 1, 2 o 3 días');
});

test('Clarity está en el catálogo del MÉTODO, o la barra dice «servicio inválido»', () => {
  // ⚠️ EL BUG QUE ESTE TEST CUIDA. Clarity estaba en el catálogo de integraciones
  // (marcado `oculto`, porque no lleva tarjeta propia) pero NO en el catálogo del
  // método, que es de donde la barra de credenciales saca sus campos y sus pasos.
  // Resultado: el formulario se dibujaba y respondía «servicio inválido».
  //
  // Son DOS catálogos con dos preguntas distintas —«¿qué tarjetas existen?» y
  // «¿qué campos pide este servicio?»— y una integración que se configura dentro
  // de otra necesita estar en los dos.
  const met = leer('../lib/metodo-catalogo.ts');
  assert.ok(/key: 'clarity'/.test(met), 'sin esto la barra de credenciales no sabe qué pedir');
  assert.ok(/env: 'CLARITY_PROJECT_ID'/.test(met), 'falta el campo del id del proyecto');
  assert.ok(/env: 'CLARITY_API_TOKEN'[^\n]*secreto: true[^\n]*opcional: true/.test(met),
    'el token es secreto Y opcional: sin él andan las grabaciones, que son el 90% del valor');
  // El id del proyecto NO es secreto: viaja en el HTML como cualquier pixel, y
  // enmascararlo escondería justo lo que distingue un proyecto de otro.
  assert.ok(!/env: 'CLARITY_PROJECT_ID'[^\n]*secreto: true/.test(met), 'el id del proyecto no es un secreto');
  assert.ok(/clarity\.microsoft\.com/.test(met), 'el «?» tiene que llevar a donde se sacan las claves');
});
