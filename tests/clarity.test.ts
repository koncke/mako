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
  // ⚠️ EL TOKEN ES OBLIGATORIO. Estuvo marcado opcional con el argumento de que
  // sin él «andan las grabaciones igual» — y es cierto, pero sin él no hay
  // resumen, y sin resumen MaKo no sabe cuándo se vencen esas grabaciones: el
  // aviso de «esto se borra en 4 días» no puede existir. Conectar a medias una
  // integración que a medias no sirve es peor que no conectarla.
  assert.ok(/env: 'CLARITY_API_TOKEN'[^\n]*secreto: true/.test(met), 'el token es un secreto');
  assert.ok(!/env: 'CLARITY_API_TOKEN'[^\n]*opcional: true/.test(met), 'sin token no hay aviso de vencimiento: no puede ser opcional');
  // El id del proyecto NO es secreto: viaja en el HTML como cualquier pixel, y
  // enmascararlo escondería justo lo que distingue un proyecto de otro.
  assert.ok(!/env: 'CLARITY_PROJECT_ID'[^\n]*secreto: true/.test(met), 'el id del proyecto no es un secreto');
  assert.ok(/clarity\.microsoft\.com/.test(met), 'el «?» tiene que llevar a donde se sacan las claves');
});

test('el cron avisa ANTES de que Clarity borre la grabación', () => {
  // Clarity guarda las grabaciones 30 días; las marcadas como favoritas, 13
  // meses. Marcarlas es MANUAL (no hay endpoint), así que lo único que el sistema
  // puede hacer —y lo que convierte 30 días en 13 meses para lo que importa— es
  // avisar a tiempo con el link a la grabación de esa persona.
  const cron = leer('../app/api/cron/clarity-vigilante/route.ts');
  assert.ok(/const DIAS_RETENCION = 30/.test(cron), 'los 30 días son el dato de Microsoft, no un número elegido');
  // ⚠️ Cinco días de margen, no uno: un aviso el día 29 llega cuando ya no hay
  // tiempo de hacer nada, y el aviso existe para que se haga algo.
  assert.ok(/AVISAR_DESDE = DIAS_RETENCION - 5/.test(cron), 'el margen tiene que dejar tiempo de reaccionar');
  // Solo por LEADS: las grabaciones anónimas son miles y ninguna importa.
  assert.ok(/\.not\('visitor_id', 'is', null\)/.test(cron), 'no se avisa por sesiones anónimas');

  // ⚠️ UN SOLO AVISO CON LA LISTA. El dedup de emitirDelCatalogo es por TIPO, así
  // que un aviso por lead habría sonado solo para el primero de la tanda y los
  // demás se habrían perdido en silencio.
  assert.ok(/const porVencer/.test(cron), 'los leads se juntan antes de avisar');
  assert.ok(/porVencer\.sort\(\(a, b\) => a\.dias - b\.dias\)/.test(cron), 'el más urgente primero: es el que decide si hay que entrar hoy');
  assert.ok(/dedupTtlMin: 60 \* 20/.test(cron), 'la ventana dura 5 días: sin dedup el mismo lead suena cinco veces');
  const i = cron.indexOf('const porVencer');
  assert.equal((cron.slice(i).match(/emitirDelCatalogo\(/g) ?? []).length, 1, 'un aviso por tanda, no uno por lead');
});

test('el resumen lo cachea el CRON, no la pantalla', () => {
  // La cuota es de 10 requests por proyecto por día: si lo consultara la
  // pantalla, tres personas abriendo la tab dos veces la agotan antes del
  // mediodía y queda en blanco sin que nada lo explique.
  const cron = leer('../app/api/cron/clarity-vigilante/route.ts');
  assert.ok(/setSetting\(CLARITY_RESUMEN_KEY/.test(cron), 'el resumen tiene que quedar cacheado');
  // ⚠️ Un error de Clarity NO borra el caché: lo de ayer sigue siendo cierto y es
  // mejor que una pantalla vacía.
  assert.ok(/if \(res\.ok\) \{/.test(cron), 'un fallo de Clarity no puede pisar el caché con nada');
  const vercel = leer('../vercel.json');
  assert.ok(/clarity-vigilante/.test(vercel), 'el cron tiene que estar agendado o no corre nunca');
});
