// =============================================================================
// El puente: pide trabajo a MaKo, lo ejecuta contra Flow, devuelve el resultado
// =============================================================================
// Corre en el navegador del CLIENTE, con SU cuenta de Google y SUS créditos. Por
// eso los medios no salen del presupuesto de MaKo y no hay una cuenta central
// que se pueda quemar.
//
// ⚠️ LO QUE ESTA EXTENSIÓN NO HACE, Y ES DELIBERADO
//
// FlowKit —de donde salió el protocolo— incluye un `sendTelemetry()` que cada
// 45-120 s le manda a Google eventos de uso INVENTADOS (latencias, scroll,
// aperturas de proyecto) con el comentario textual «to mimic normal browser
// behavior». Eso no es usar el mecanismo: es fabricar señales para que la
// detección de bots no vea la automatización.
//
// Acá no se replica. La contención es el RITMO, y lo dicta el server: MaKo manda
// `cooldownMs` en cada respuesta y esto lo respeta. A pulso de persona no hay
// nada que disimular.
//
// ⚠️ EL BEARER NUNCA SALE DE ESTA MÁQUINA. Se usa para llamar a Google y se
// guarda en `chrome.storage.local`. A MaKo solo le viaja el RESULTADO.

const MAKO = 'https://hola-mako.com';
const FLOW_BASE = 'https://aisandbox-pa.googleapis.com';
const SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

/**
 * Un id de proyecto de Flow.
 *
 * Se valida antes de meterlo en una URL: el `projectId` sale de mirar el trafico
 * al pasar, asi que puede venir vacio o a medio leer — y armar
 * `flow.google.com/project/<basura>` manda a la persona a un 404 que se lee como
 * que MaKo perdio su proyecto.
 */
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo pisa el server en cada respuesta. Este es solo el arranque. */
let cooldownMs = 10000;
let bearer = null;
let projectId = '';
let apiKey = '';
let corriendo = false;

// ⚠️ CUANTOS TRABAJOS SE PIDEN POR LATIDO, y por que no es 1.
//
// Era 1, y eso hacia que CADA trabajo costara un latido entero. Un clip no es un
// trabajo: son ~9 —generarlo, preguntar 7 veces como va, y pedir el enlace—, o
// sea nueve esperas de 15 s que nadie ve trabajando. Medido en produccion sobre
// 348 trabajos: la mediana esperaba 13,6 s en la cola —la mitad de un latido, que
// es exactamente lo que predice pedir de a uno— y el p90 de las consultas de
// estado llegaba a 357 s.
//
// Subirlo NO afloja ninguna guarda:
// · el server ya topea en `LIMITES.concurrencia` (5) y el RPC toma con
//   `FOR UPDATE SKIP LOCKED`, asi que dos pestanas no se llevan el mismo trabajo;
// · los trabajos se siguen ejecutando DE A UNO y con el `cooldownMs` entre medio,
//   que es la guarda de verdad contra el PUBLIC_ERROR_UNUSUAL_ACTIVITY. Lo que
//   cambia es cuantos se traen por viaje, no cada cuanto se le habla a Google.
const LOTE = 5;

/**
 * Latidos seguidos que el ciclo puede encadenar solo, sin esperar a la alarma.
 *
 * Existe para que una tanda no se pague a 15 s por trabajo. El tope es la
 * baranda: un trabajo que falla y se reencola para siempre giraria sin fin.
 */
const CADENA_MAX = 20;
let cadena = 0;

/**
 * Cuándo se le habló a Flow por última vez. En `storage` y no en un global.
 *
 * ⚠️ EL SERVICE WORKER MV3 SE MUERE, y con él cualquier variable. Un piso de
 * ritmo guardado en memoria se reinicia cada vez que Chrome apaga el worker
 * —o sea seguido— y entonces la primera llamada del worker nuevo sale sin
 * esperar nada. Un guard que se olvida de lo que pasó hace diez segundos no es
 * un guard: es un guard el 80% de las veces, que es justo el que no sirve
 * cuando lo que está del otro lado es un detector de actividad automática.
 */
async function ultimaLlamadaFlow() {
  const v = await chrome.storage.local.get('ultimaLlamadaFlow');
  const t = Number(v && v.ultimaLlamadaFlow);
  return Number.isFinite(t) ? t : 0;
}

async function marcarLlamadaFlow() {
  await chrome.storage.local.set({ ultimaLlamadaFlow: Date.now() });
}

chrome.storage.local.get(['bearer', 'projectId', 'apiKey'], (v) => {
  bearer = v.bearer || null;
  projectId = v.projectId || '';
  apiKey = v.apiKey || '';
});

// ── Capturar el token de la sesión ───────────────────────────────────────────
// No se "roba" nada: es el mismo Authorization que la página ya manda cuando el
// usuario aprieta generar en Flow. Se lee al pasar y se guarda para poder
// repetir la llamada sin que el usuario esté mirando.

chrome.webRequest.onBeforeSendHeaders.addListener(
  (det) => {
    for (const h of det.requestHeaders || []) {
      if (h.name.toLowerCase() !== 'authorization') continue;
      const v = h.value || '';
      if (!v.startsWith('Bearer ya29.')) continue;
      const nuevo = v.slice('Bearer '.length);
      if (nuevo !== bearer) {
        bearer = nuevo;
        chrome.storage.local.set({ bearer });
      }
    }
    // Y de paso, el projectId sale de la propia URL de las llamadas de imagen.
    const m = det.url.match(/\/v1\/projects\/([^/]+)\//);
    if (m && m[1] && m[1] !== projectId) {
      projectId = m[1];
      chrome.storage.local.set({ projectId });
    }

    // La API key del proyecto de Google, que Flow manda en el query de CADA
    // llamada (`?key=AIza…`). No es un secreto —viaja en la URL de una app web y
    // se ve en cualquier DevTools—, pero es OBLIGATORIA: sin ella `googleapis.com`
    // no sabe a qué proyecto atribuir el pedido y lo manda al bucket de tráfico no
    // identificado, que contesta la página de bloqueo. Ese fue el bug: se llamaba
    // a `/v1/credits` pelado porque el path salió de la documentación de useapi y
    // nunca se comparó contra el tráfico REAL de Flow.
    //
    // Se lee al pasar en vez de hardcodearla: si Google la rota, el que la tiene
    // al día es el navegador del cliente, no nuestro código.
    const k = det.url.match(/[?&]key=(AIza[A-Za-z0-9_-]{20,})/);
    if (k && k[1] && k[1] !== apiKey) {
      apiKey = k[1];
      chrome.storage.local.set({ apiKey });
    }
  },
  { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*', 'https://flow.google.com/*'] },
  ['requestHeaders'],
);

/**
 * A DONDE redirige el pedido de un medio.
 *
 * ⚠️ ES LA UNICA FORMA QUE QUEDA DE SABERLO, y no cuesta ningun permiso nuevo.
 *
 * Medido hoy: `getMediaUrlRedirect?name=<id>` redirige al archivo, y ese destino
 * no manda CORS. Asi que el redirect no se puede seguir ni leer con `fetch` —ni
 * desde la pagina («Failed to fetch») ni desde el service worker (lo mismo, y en
 * modo manual devuelve un `opaqueredirect` con el `Location` ilegible)—. Un
 * <video> lo carga igual, porque los elementos de medio no piden CORS: el archivo
 * esta ahi y el problema es solo LEERLO.
 *
 * `webRequest` mira el trafico desde afuera del modelo de CORS, y ya esta en el
 * manifest desde el primer dia —se usa para aprender la api key—. Su
 * `onBeforeRedirect` trae el `redirectUrl` completo.
 *
 * Y eso contesta la pregunta que decide todo: si el destino es una url FIRMADA,
 * el servidor la baja el mismo y la extension no tiene que mover un byte.
 */
const redirectsDeMedios = new Map();
chrome.webRequest.onBeforeRedirect.addListener(
  (det) => {
    try {
      const m = det.url.match(/[?&]name=([0-9a-f-]{8,})/i);
      if (!m) return;
      redirectsDeMedios.set(m[1], { url: det.redirectUrl, cuando: Date.now() });
      // Se guarda tambien en disco: el service worker se duerme y con el se va el Map.
      chrome.storage.local.set({ ultimoRedirectMedio: JSON.stringify({ mediaId: m[1], url: det.redirectUrl }) });
    } catch { /* mirar nunca puede romper nada */ }
  },
  // ⚠️ SE NOMBRA EL ENDPOINT, NO LA RUTA. En labs.google el tRPC cuelga de
  // /fx/api/trpc/; en flow.google.com no lo medimos, y adivinar un prefijo es como
  // se pierde trafico en silencio. Lo que SI sabemos es como se llama el endpoint,
  // que sale del codigo de la propia app y no cambio con la mudanza. El handler ya
  // se guarda solo: sin `name=<hex>` en la url sale sin hacer nada.
  { urls: [
    'https://labs.google/fx/api/trpc/media.getMediaUrlRedirect*',
    'https://flow.google.com/*getMediaUrlRedirect*',
  ] },
);

// ── El captcha ───────────────────────────────────────────────────────────────
// Se pide a la PÁGINA de Flow, que ya tiene el widget cargado. No hay ningún
// servicio de resolución de por medio: el token lo emite Google evaluando esta
// sesión, y si el comportamiento parece automatizado devuelve 403 — que es
// exactamente lo que tiene que pasar.

// ── DONDE VIVE FLOW ─────────────────────────────────────────────────────────
//
// ⚠️ GOOGLE MUDO FLOW A SU PROPIO DOMINIO, Y ESO APAGO LA EXTENSION ENTERA.
//
// Estaba escrito `https://labs.google/fx/*tools/flow*` y la pestana de un cliente
// medida el 04/09/2026 es `https://flow.google.com/project/<uuid>`. No matchean, asi
// que `chrome.tabs.query` devuelve vacio, `hayFlow` queda en false y el popup dice
// «Abre Google Flow» — con Flow abierto y cargado en la pestana de al lado.
//
// Y se muerde la cola: el boton «Abrir Google Flow» navegaba a labs.google, Google
// deja a la persona en el dominio nuevo, y la extension pierde de vista la pestana
// que ella misma acaba de abrir. Por eso no fallaba a veces: fallaba SIEMPRE.
//
// ⚠️ Y ESTE MISMO SINTOMA YA SE HABIA INVESTIGADO. El 02/09 se reporto textual —«ya
// abrimos Flow y no funciono, no deja de salir el boton de abrir Flow»— y se
// encontro una causa VERDADERA: el filtro `discarded` convertia «hay una durmiendo»
// en «no hay ninguna». Ese arreglo esta abajo y sigue siendo correcto. Pero una
// causa verdadera puede no ser LA causa, y la de abajo tapo a la de arriba.
//
// Van los DOS dominios y no uno: no sabemos si Google migro a todo el mundo, asi
// que reconocer los dos anda en las dos direcciones. El unico lugar donde esta lista
// se repite es el manifest, que no puede importar nada.
const PATRONES_FLOW = [
  'https://labs.google/fx/*tools/flow*',
  'https://flow.google.com/*',
];

/** El origen de una pestana de Flow, para armarle URLs de su MISMO dominio. */
function origenDeFlow(tab) {
  try { return new URL(tab.url).origin; } catch { return 'https://flow.google.com'; }
}

/** Si una url es de Flow, con la MISMA lista que usa el `tabs.query`. */
function esUrlDeFlow(url) {
  const u = String(url || "");
  return /^https:\/\/labs\.google\/fx\/.*tools\/flow/.test(u)
    || u.startsWith("https://flow.google.com/");
}

/**
 * Si esa pestana es el Flow NUEVO, el de flow.google.com.
 *
 * ⚠️ NO ES EL MISMO PRODUCTO CON OTRA DIRECCION: Google lo reescribio.
 *
 * Medido el 04/09/2026 leyendo el trafico de una cuenta real, dentro de un proyecto
 * cargado. El Flow nuevo habla UNICAMENTE por BOQ/batchexecute:
 *
 *   POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute
 *        ?rpcids=<id>&source-path=/project/<uuid>
 *        &bl=boq_labs-ai-sandbox-frontend_20260903.13_p0
 *
 * Cero llamadas a `aisandbox-pa.googleapis.com`. Cero `Authorization: Bearer ya29.`.
 * Cero `?key=AIza…`. Cero `/v1/projects/<id>/`. BOQ autentica con COOKIES.
 *
 * O sea que el protocolo entero que implementa este puente —capturar el bearer y la
 * apiKey al pasar, y despues repetir las llamadas REST desde el service worker— NO
 * TIENE CONTRAPARTE en el Flow nuevo. No es que falte un permiso ni un patron de
 * host: lo que capturamos ya no existe.
 *
 * Y no hay a donde volver: `labs.google/fx/tools/flow` dejo de ser la app y hoy es
 * una landing de marketing con un boton «Create with Google Flow».
 *
 * Esto NO se usa para decidir si el puente funciona —si funcionara, habria bearer y
 * no llegariamos a preguntarlo—. Se usa para poder DECIR LA VERDAD en vez de
 * mandar a iniciar sesion a alguien que ya inicio sesion.
 */
function esFlowNuevo(url) {
  return String(url || "").startsWith("https://flow.google.com/");
}

/**
 * Si esa pestana esta DENTRO de un proyecto, y no en la portada.
 *
 * ⚠️ ES LA DIFERENCIA ENTRE «no inicio sesion» Y «todavia no abrio un proyecto», y
 * hasta hoy las dos se mostraban con el mismo cartel.
 *
 * El bearer se ve al pasar, en el header `Authorization` de una llamada a la API
 * de Flow. En la portada —la lista de proyectos— la app no hace ninguna: pide sus
 * cosas con cookies. Asi que una persona perfectamente logueada, mirando su lista
 * de proyectos, no produce ni un bearer.
 *
 * Medido el 04/09/2026 con una clienta: pestana en `https://flow.google.com`, con su
 * avatar, su plan y su boton de «Salir» a la vista, y el popup diciendole «Inicia
 * sesion en Google Flow». Le pedia lo unico que ya estaba hecho — que es la regla de
 * la casa sobre errores, del reves.
 */
function enProyectoDeFlow(url) {
  return /\/project\//.test(String(url || ""));
}

async function pestanaDeFlow() {
  // ⚠️ «DORMIDA» NO ES «NO EXISTE», Y CONFUNDIRLAS ES UN CALLEJÓN SIN SALIDA.
  //
  // Esto era un solo `query({ url, discarded: false })`. El filtro es correcto
  // cuando hay varias —una dormida no tiene ningún script vivo adentro, así que
  // elegirla habiendo otra sana es elegir la muerta—, pero cuando la dormida es
  // la ÚNICA, el filtro convierte «hay una durmiendo» en «no hay ninguna».
  //
  // Y el mensaje que sale de ahí manda a ABRIR Google Flow. La persona la tiene
  // abierta, la está viendo, la abre otra vez, y el aviso no se va: Chrome duerme
  // las pestañas que no se miran, y mirar la de MaKo es justamente dejar de mirar
  // la de Flow. Reportado el 02/09/2026: «ya abrimos Flow y no funcionó, no deja
  // de salir el botón de abrir Flow».
  //
  // Así que primero se pregunta por TODAS y recién después se decide.
  const todas = await chrome.tabs.query({ url: PATRONES_FLOW });
  const sanas = todas.filter((t) => !t.discarded);
  const tab = sanas.find((t) => t.status === "complete") || sanas[0];
  if (tab) return tab;

  // Hay pestaña, pero Chrome la durmió. Se la despierta —`reload` es lo que
  // revive una descartada— y se avisa que hay que esperar un latido, en vez de
  // pedir que abran una que ya está abierta.
  if (todas.length) {
    try { await chrome.tabs.reload(todas[0].id); } catch { /* si no se puede, lo dice el error */ }
    throw new Error("FLOW_TAB_DORMIDA");
  }
  throw new Error("NO_FLOW_TAB");
}

/**
 * Acuna un token de reCAPTCHA para una accion.
 *
 * `medida` dice si esa accion salio de la TABLA (leida del bundle de Flow) o de
 * derivarla del path. La pagina lo necesita para saber si puede pisarla con lo
 * que vio acunar a Flow: una adivinada si, una medida NUNCA — ver el comentario
 * largo en injected.js.
 */
async function pedirCaptcha(tabId, action, medida) {
  const res = await chrome.tabs.sendMessage(tabId, { tipo: 'GET_CAPTCHA', action, siteKey: SITE_KEY, medida: !!medida });
  if (!res || !res.token) throw new Error(res?.error || 'CAPTCHA_FALLO');
  // Queda en la consola de la extension: si la clave de la pagina NO es la que
  // tenemos escrita, es la explicacion del 403 y hay que verla, no deducirla.
  if (res.siteKeyUsado && res.siteKeyUsado !== SITE_KEY) {
    console.warn(`[mako] el site key de la pagina es ${res.siteKeyUsado}, el nuestro era ${SITE_KEY}`);
  }
  // LA MEDICION que faltaba: con que acciones acuna Flow sus tokens. Queda
  // guardado para que viaje en el proximo latido y se pueda ver desde el server,
  // sin pedirle una captura de pantalla a nadie.
  if (Array.isArray(res.accionesDeFlow) && res.accionesDeFlow.length) {
    try { await chrome.storage.local.set({ accionesDeFlow: res.accionesDeFlow }); } catch { /* no es critico */ }
    if (!res.accionesDeFlow.includes(action)) {
      console.warn(`[mako] pedimos la accion "${action}" y Flow usa: ${res.accionesDeFlow.join(', ')}`);
    }
  }
  return res.token;
}


// ── El respaldo de plantillas ────────────────────────────────────────────────
//
// Las plantillas del espejo viven en la MEMORIA de la pestana de Flow. Un F5 las
// borra, y con ellas la posibilidad de generar: la tab pedia «abri Flow y genera
// algo a mano una vez» DESPUES DE CADA RECARGA. Para un producto eso no es un
// requisito, es una tab que no funciona.
//
// Asi que se guardan aca, en el storage de la extension, que sobrevive tanto al
// F5 como al reinicio del service worker.
//
// ⚠️ Lo que se guarda NO lleva credenciales: `injected.js` saca el `authorization`
// —que se repone fresco en cada pedido— y el token de reCAPTCHA, que se acuna en
// el momento y vencido no sirve. Guardar un token vencido seria cargar con una
// credencial sin ganar nada.
const CLAVE_PLANTILLAS = 'plantillas';

/**
 * La pestana de Flow que MaKo dejo lista, para poder devolverla a su lugar.
 *
 * ⚠️ EL PEDIDO DEL DUENO: «si detecta que toco algo de Google Flow, que vuelva a
 * redireccionar a la posicion correcta, al proyecto, y que le avise que no toque
 * nada».
 *
 * Y no es capricho: si la pestana se va del proyecto, el puente pierde de golpe el
 * unico lugar donde el trafico que necesita ocurre. Antes eso terminaba en un cartel
 * pidiendo volver a entrar — o sea, delegando en la persona el arreglo de algo que
 * ella no sabe que rompio.
 *
 * ⚠️ Se guarda la URL EXACTA y no solo el id: la gracia es devolverla al MISMO
 * proyecto. Con el id solo, «volver» seria adivinar a cual.
 */
const CLAVE_CUIDANDO = 'cuidandoFlow';

/**
 * Cuanto dura la guardia.
 *
 * ⚠️ TIENE QUE VENCER, o es una pestana secuestrada. Alguien que abrio Flow con MaKo
 * hace tres horas y ahora quiere navegar su propio Flow no esta cometiendo un error:
 * dejo de estar en la tarea. Media hora cubre una sesion de trabajo entera y no
 * convierte al navegador en algo que pelea con su dueno.
 */
const CUIDADO_MS = 30 * 60 * 1000;

/** Deja de cuidar: lo llama todo lo que significa «la tarea termino». */
async function soltarGuardia() {
  try { await chrome.storage.local.remove(CLAVE_CUIDANDO); } catch { /* nada que soltar */ }
}

async function guardarPlantillas(tabId) {
  try {
    const r = await chrome.tabs.sendMessage(tabId, { tipo: 'GUARDAR_PLANTILLAS' });
    const lista = (r && r.plantillas) || [];
    if (!lista.length) return;
    const previas = (await chrome.storage.local.get(CLAVE_PLANTILLAS))[CLAVE_PLANTILLAS] || {};
    const mapa = { ...previas };
    // La mas nueva gana. Y una plantilla vieja NO se borra porque hoy no se haya
    // visto: es justo el caso que esto viene a arreglar.
    for (const p of lista) mapa[p.clase] = { ...p, cuando: Date.now() };
    await chrome.storage.local.set({ [CLAVE_PLANTILLAS]: mapa });
  } catch { /* si la pestana no responde, no hay nada que guardar */ }
}

/**
 * Todo lo guardado, para mandarselo al servidor.
 *
 * Sin esto, lo que el navegador aprendio de Flow muere con el perfil — y la app
 * vuelve a pedir «genera UNA imagen a mano» sobre algo que el cliente ya hizo
 * decenas de veces. El dueno lo pregunto con todas las letras.
 */
async function todasLasPlantillas() {
  try {
    const mapa = (await chrome.storage.local.get(CLAVE_PLANTILLAS))[CLAVE_PLANTILLAS] || {};
    return Object.entries(mapa).map(([clase, p]) => ({ ...p, clase }));
  } catch {
    return [];
  }
}

/**
 * Guarda las que mando el servidor, para las clases que ACA no hay.
 *
 * ⚠️ Nunca pisa una local. La local es de esta maquina y de esta sesion; la del
 * servidor puede ser de otro dia. Se usa para llenar huecos, no para sincronizar.
 */
async function sembrarPlantillas(lista) {
  try {
    if (!Array.isArray(lista) || !lista.length) return 0;
    const previas = (await chrome.storage.local.get(CLAVE_PLANTILLAS))[CLAVE_PLANTILLAS] || {};
    const mapa = { ...previas };
    let n = 0;
    for (const p of lista) {
      if (!p || !p.clase || mapa[p.clase]) continue;
      mapa[p.clase] = { ...p, cuando: p.cuando || Date.now(), delServidor: true };
      n++;
    }
    if (n) await chrome.storage.local.set({ [CLAVE_PLANTILLAS]: mapa });
    return n;
  } catch {
    return 0;
  }
}

async function respaldoDe(clase) {
  try {
    const mapa = (await chrome.storage.local.get(CLAVE_PLANTILLAS))[CLAVE_PLANTILLAS] || {};
    return mapa[clase] || null;
  } catch {
    return null;
  }
}

// ── Ejecutar un trabajo contra Flow ──────────────────────────────────────────

/**
 * Los trabajos que solo LEEN. No llevan cuerpo, no llevan captcha, y si la página
 * ya preguntó lo mismo hace poco se contestan con su respuesta, sin tráfico.
 */
/**
 * Los trabajos que NO necesitan acunar un captcha.
 *
 * ⚠️ SE LLAMA POR LO QUE HACE, y el nombre viejo —`SOLO_LECTURA`— es la razon de
 * que este bug se repitiera TRES veces. «Solo lectura» suena a una propiedad del
 * pedido, asi que fue significando, una tras otra, tres cosas distintas:
 *
 *   1. «no necesita captcha»          ← lo unico que decide de verdad
 *   2. «no manda cuerpo»              ← rompio la consulta de estado la 1ra vez
 *   3. «no necesita clientContext»    ← la rompio la 3ra, con un 400 identico
 *
 * Cada una se descubrio por separado, con dias de diferencia, sobre el mismo
 * `if`. Un nombre que describe una CATEGORIA invita a colgarle comportamientos;
 * uno que describe UNA decision, no.
 *
 * (En el mensaje al mundo de la pagina el campo sigue llamandose `soloLectura`,
 * porque alli decide otra cosa —si una respuesta cacheada puede contestar— y
 * renombrarlo obligaria a que las dos puntas se actualicen a la vez.)
 */
// ⚠️ `subir_imagen` esta aca aunque ESCRIBA. El pedido real de Flow —medido— no
// lleva `recaptchaContext`, y agregarle un token que la app no manda es inventar
// un campo: exactamente lo que produjo los dos HTTP 400 de esta noche.
const SIN_CAPTCHA = new Set(['creditos', 'estado_clips', 'subir_imagen']);

/**
 * El nombre de la accion con la que se acuna el token de reCAPTCHA.
 *
 * ⚠️ NO es decorativo y NO es libre: reCAPTCHA Enterprise ATA el token a la
 * accion. Si Flow acuna el suyo con `batchAsyncGenerateVideoReferenceImages` y
 * nosotros mandamos uno acunado con `batchAsyncGenerateVideo`, Google contesta
 * 403 «reCAPTCHA evaluation failed» — y ese error se lee como sesion quemada
 * cuando en realidad es un nombre mal puesto de nuestro lado. Paso el 29/08 con
 * el primer clip del Video Generator.
 *
 * Por eso ya NO sale de una tabla por TIPO de trabajo: sale del ENDPOINT que se
 * va a llamar. Un tipo de trabajo puede pegarle a varios endpoints —generar un
 * clip desde referencias no es lo mismo que encadenarlo por frames— y la tabla
 * por tipo solo podia acertarle a uno.
 */
/**
 * Las acciones que Flow usa DE VERDAD. Medidas, no derivadas.
 *
 * ⚠️ Salieron de decodificar el bundle de Flow: la tabla de strings del
 * ofuscador, indice 0x13d8, despues de aplicar la rotacion que el propio bundle
 * hace al cargar. La linea donde la app acuna su token es
 *
 *     recaptchaContext: { token: await hw('VIDEO_GENERATION'), applicationType: ... }
 *
 * Antes se DERIVABA del path —`batchAsyncGenerateVideoReferenceImages`— con un
 * comentario que afirmaba que era «exactamente lo que la app pone en su propio
 * execute()». Era falso, y costo un dia: reCAPTCHA Enterprise ATA el token a la
 * accion, asi que cada pedido volvia 403 «reCAPTCHA evaluation failed» — el mismo
 * cuerpo que devuelve un token con score bajo, y por eso se confundio con una
 * sesion quemada durante horas.
 *
 * Y NO se pudo medir desde la pagina: se envolvio `grecaptcha.enterprise.execute`
 * y no capturo nada en dos intentos, porque Flow lo llama desde un contexto que
 * el espejo no alcanza. Cuando el espejo no llega, se lee el codigo.
 */
const ACCION_CAPTCHA = {
  generar_clip: 'VIDEO_GENERATION',
  generar_imagen: 'IMAGE_GENERATION',
};

function accionDeCaptcha(tipo, path) {
  if (ACCION_CAPTCHA[tipo]) return ACCION_CAPTCHA[tipo];
  // Fallback para lo que todavia no se midio: el metodo del endpoint. No es lo
  // que Flow usa —ahora lo sabemos— pero es lo unico inferible sin medir.
  const ultimo = String(path || '').split('?')[0].split('/').filter(Boolean).pop() || '';
  const metodo = ultimo.includes(':') ? ultimo.split(':').pop() : ultimo;
  return metodo || 'generate';
}

/**
 * Se reinicia sola cuando el server dice que hay una version mas nueva.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * Esta extension se instala DESCOMPRIMIDA, y a una instalacion descomprimida
 * Chrome no la actualiza nunca: el boton «Recargar» de chrome://extensions
 * vuelve a leer LA MISMA CARPETA. Si esa carpeta no cambio, recargar no puede
 * cambiar nada — y desde afuera se ve identico a un boton que no funciona.
 *
 * Ya costo dos veces el mismo dia. La primera se diagnostico mal (se creyo que
 * era el zip viejo que servia produccion, que era cierto y no era la causa); la
 * segunda, el dueno recargo y contesto «no funciono», con razon.
 *
 * `chrome.runtime.reload()` SI vuelve a leer los archivos del disco. Asi que en
 * cuanto la carpeta esta al dia, esto cierra el circulo solo.
 *
 * ── Las tres guardas, y las tres importan ─────────────────────────────────
 * 1. Solo en instalaciones descomprimidas. Chrome le agrega `update_url` al
 *    manifest de lo que viene de la tienda, y ahi el que actualiza es Chrome:
 *    reiniciar no traeria nada nuevo.
 * 2. UN intento por version de destino. Si la carpeta sigue vieja, el reinicio
 *    no cambia nada y sin esta guarda quedaria reiniciandose cada 15 segundos
 *    para siempre. Un bucle de reinicio es peor que estar desactualizado: mata
 *    la pestana de trabajo y no deja rastro de por que.
 * 3. Nunca en el medio de un trabajo. Reiniciar con un clip a mitad de camino
 *    pierde el resultado y deja al cliente mirando «generando…» sobre algo que
 *    ya termino.
 */
/** `a` es anterior a `b`. Gemela de `esMasVieja` en app/video-generator/PuentePanel.tsx. */
function esMasVieja(a, b) {
  const na = String(a || '').split('.').map(Number);
  const nb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const x = na[i] || 0;
    const y = nb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * Anota que version sirve produccion, para que el popup pueda frenar.
 *
 * ⚠️ ANTES ESTO REINICIABA LA EXTENSION, Y ERA UN AUTOGOL. `chrome.runtime.reload()`
 * vuelve a leer LA MISMA CARPETA: en una instalacion descomprimida no baja nada,
 * asi que no puede actualizar nada — y el `if (manifest.update_url) return` de
 * abajo hace que el reinicio corriera SOLO en instalaciones descomprimidas. O sea
 * que se reiniciaba unicamente en el unico caso donde reiniciar no sirve.
 *
 * Y no era gratis. Un `runtime.reload()` mata al service worker y **se lleva la
 * alarma**; si Chrome no lo vuelve a levantar —MV3 no arranca el worker hasta que
 * llegue un evento, y la alarma era el evento— el puente se apaga PARA SIEMPRE.
 * Es la causa mas probable del caso medido el 01/09/2026: una clienta con la
 * 0.37.1 instalada mientras produccion servia la 0.37.3, cuyo puente dejo de
 * latir y no volvio nunca.
 *
 * Lo que corresponde no es automatizar la recarga: es DECIR que hay que
 * reemplazar los archivos. Eso lo hace el popup, con el paso a paso, y hasta que
 * no este al dia no deja seguir.
 */
async function anotarVersionEsperada(esperada) {
  try {
    if (!esperada) return;
    await chrome.storage.local.set({ versionEsperada: String(esperada) });
  } catch { /* saber la version nunca puede romper al que ya funciona */ }
}

/** Sin llamadores desde el 01/09/2026. Se deja el porque arriba, no el codigo. */
async function quizasReiniciarNoUsar(esperada, hayTrabajoEnCurso) {
  try {
    if (!esperada || hayTrabajoEnCurso) return;
    const manifest = chrome.runtime.getManifest();
    // ORDENADA, no `===`. Una igualdad dispara TAMBIEN cuando la instalada va
    // ADELANTE de lo que sirve produccion —la maquina de desarrollo, los minutos
    // entre el push y el deploy, y para siempre si el build fallo— y cada uno de
    // esos reinicios deja la pestana muda hasta el latido siguiente. Es la misma
    // leccion que la pantalla ya aprendio en PuentePanel.tsx (`esMasVieja`); si se
    // cambia una, se cambia la otra: la extension no tiene bundler y no puede
    // importar de `app/`.
    if (!esMasVieja(manifest.version, esperada)) {
      // Al dia: se limpia la marca para que un salto futuro pueda volver a intentar.
      await chrome.storage.local.remove('reinicioIntentado');
      return;
    }
    // De la tienda: el que actualiza es Chrome, no nosotros.
    if (manifest.update_url) return;

    const { reinicioIntentado } = await chrome.storage.local.get('reinicioIntentado');
    if (reinicioIntentado === esperada) return;
    await chrome.storage.local.set({ reinicioIntentado: esperada });
    console.log(`[mako] ${manifest.version} -> ${esperada}: reiniciando para leer los archivos nuevos`);
    chrome.runtime.reload();
  } catch { /* actualizarse nunca puede romper al que ya funciona */ }
}

/**
 * Repone el puente de una pestana de Flow que quedo sin content script.
 *
 * CHROME NO REINYECTA HACIA ATRAS. Ni despues de un `chrome.runtime.reload()`,
 * ni en una pestana que ya estaba abierta cuando se instalo la extension, ni en
 * una navegacion por pushState adentro de la SPA de Flow. Los tres dejan el
 * script HUERFANO: sigue vivo en la pagina, pero el listener que registro
 * pertenece al contexto viejo y el service worker nuevo no lo ve.
 *
 * El sintoma es el error literal de Chrome «Receiving end does not exist», y
 * hasta hoy la unica salida era que una persona apretara F5 — y nadie se lo
 * pedia, porque el puente seguia diciendo que estaba listo.
 *
 * `injected.js` va PRIMERO y va SIEMPRE: si la pestana es de las que nunca lo
 * tuvieron, reponer solo content.js cambia un error claro por 25 segundos de
 * espera y un timeout de captcha. Re-ejecutarlo cuando ya esta vivo es gratis
 * —tiene su guarda de idempotencia— y conserva sus plantillas en memoria, que es
 * justo lo que no se puede perder.
 *
 * Devuelve 'ok' | 'repuesto' | 'mudo'.
 */
const reparadasEnEstaVuelta = new Set();

async function pingContent(tabId) {
  try {
    const r = await chrome.tabs.sendMessage(tabId, { tipo: 'PING' });
    return !!(r && r.ok);
  } catch { return false; }
}

async function asegurarContentScript(tabId) {
  if (await pingContent(tabId)) return 'ok';
  // UN intento por vuelta del ciclo: si inyectar no alcanzo, insistir cada 15 s
  // sobre la misma pestana no la va a arreglar y si puede tapar el diagnostico.
  if (reparadasEnEstaVuelta.has(tabId)) return 'mudo';
  reparadasEnEstaVuelta.add(tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['injected.js'], world: 'MAIN' });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    console.warn('[mako] no se pudo reponer el puente:', e);
    return 'mudo';
  }
  return (await pingContent(tabId)) ? 'repuesto' : 'mudo';
}

async function ejecutar(trabajo) {
  // ── EL ENLACE FIRMADO NO PASA POR EL ESPEJO ──────────────────────────────
  //
  // Es el unico trabajo asi, y la razon esta medida: el enlace de un clip no vive
  // en ninguna respuesta. `getMediaUrlRedirect?name=<id>` REDIRIGE al archivo, y
  // ese redirect no se puede leer con `fetch` ni desde la pagina ni desde el
  // service worker —CORS lo corta en las dos, y en modo manual el `Location` viene
  // ilegible—. Un <video> lo carga igual, porque los elementos de medio no piden
  // CORS.
  //
  // Asi que el trabajo es: PROVOCAR el pedido con un <video> suelto y leer a donde
  // fue, que es lo que `webRequest` ve desde afuera del modelo de CORS.
  //
  // El destino es una url firmada de flow-content.google que anda SIN cookies y
  // dura ~6 h, asi que con eso el servidor baja el archivo el mismo.
  if (trabajo.tipo === 'enlace_clip') {
    const mediaId = String((trabajo.pedido && trabajo.pedido.mediaId) || '');
    if (!mediaId) {
      return { id: trabajo.id, ok: false, motivo: 'transitorio', error: 'enlace_clip sin mediaId', reintentable: false };
    }
    const tabE = await pestanaDeFlow();
    if ((await asegurarContentScript(tabE.id)) === 'mudo') throw new Error('PUENTE_MUDO');
    redirectsDeMedios.delete(mediaId);
    const carga = await chrome.tabs.sendMessage(tabE.id, { tipo: 'PEDIR_ENLACE', mediaId });
    // Un instante: `onBeforeRedirect` corre en su propio hilo de eventos.
    await new Promise((r) => setTimeout(r, 400));
    const visto = redirectsDeMedios.get(mediaId);
    if (!visto || !visto.url) {
      return {
        id: trabajo.id, ok: false, motivo: 'transitorio',
        error: 'No se vio el redirect del medio (' + ((carga && carga.estado) || 'sin carga') + ')',
        reintentable: true,
      };
    }
    return { id: trabajo.id, ok: true, data: { url: visto.url, mediaId } };
  }

  const { path, body: pedidoOriginal, parches: parchesDelPedido } = trabajo.pedido || {};
  let parches = parchesDelPedido;
  if (typeof path !== 'string' || !path.startsWith('/v1')) {
    return { id: trabajo.id, ok: false, motivo: 'transitorio', error: 'pedido sin path válido', reintentable: false };
  }

  const tab = await pestanaDeFlow();

  // Reponer ANTES de gastar el trabajo. Un pedido que muere por un content
  // script ausente queda `puente_dormido`, que NO se reintenta: es un trabajo
  // quemado por algo que se arreglaba una linea antes.
  if ((await asegurarContentScript(tab.id)) === 'mudo') throw new Error('PUENTE_MUDO');

  // Los pedidos de LECTURA no llevan cuerpo, así que no llevan `recaptchaContext`
  // — y por lo tanto no hay que minar un token para ellos. Medido: `/v1/credits`
  // es un GET pelado. Pedir un `grecaptcha.execute()` cada 15 s sin que nadie
  // toque nada es, además, una señal de automatización por sí sola; hacerlo para
  // algo que ni siquiera lo usa era gratis en riesgo y caro en score.
  const sinCaptcha = SIN_CAPTCHA.has(trabajo.tipo);

  // ⚠️ `soloLectura` mezclaba DOS conceptos y eso rompio la consulta de estado.
  //
  // Significaba a la vez «no necesita captcha» y «no manda cuerpo». Para el saldo
  // las dos son ciertas. Para preguntar por un clip, la primera es cierta y la
  // segunda NO: la lista de operaciones por las que se pregunta VA en el cuerpo.
  //
  // Como el cuerpo no viajaba, Google contestaba los medios recientes del
  // proyecto en vez de los nuestros — y como ademas la respuesta se servia de la
  // CACHE de la propia pagina, lo que volvia eran los videos que el dueno habia
  // generado a mano. Medido: 24 consultas y NINGUNA mencionaba nuestra operacion,
  // mientras la pantalla decia «generando» para siempre.
  //
  // Ahora: el cuerpo va siempre que lo haya; el captcha, solo cuando hace falta.
  // Un body VACIO no es un body: `{}` es truthy y apagaba la cache de `creditos`,
  // que es justo el pedido que si conviene cachear porque no depende de nada
  // nuestro.
  // ⚠️ UN CUERPO CON `operations` SE CONVIERTE EN PARCHE, SIEMPRE.
  //
  // Medido el 31/08/2026: con el arreglo desplegado hacia media hora, produccion
  // SEGUIA encolando la consulta de estado con `body`, porque la pestana abierta
  // del cliente le habla al deploy con el que se cargo. O sea: el servidor se
  // arregla y el cliente sigue mandando la forma vieja durante todo lo que dure
  // esa pestana — y cada uno de esos pedidos se come un HTTP 400.
  //
  // El espejo es el unico lugar que SABE por que esa forma esta mal: `fundir()`
  // reemplaza los arrays enteros, asi que un `operations` nuestro TIRA el de
  // Flow con todo lo que lleva al lado. Traducirlo aca lo arregla para cualquier
  // version del servidor, vieja o nueva, sin esperar a nadie.
  //
  // Es acotado a proposito: SOLO `operations`, que es el unico array que un
  // pedido nuestro manda hoy. Convertir cualquier array a parches a ciegas seria
  // inventar una regla para casos que no existen.
  // ⚠️ Y `operations` NO ES EL CAMPO. Medido el 31/08/2026 sobre el pedido que
  // hace la propia pagina de Flow: el cuerpo real es
  // `{"media":[{"name":…,"projectId":…}]}`. `operations` no existe, y por eso
  // Google contestaba «Request contains an invalid argument».
  //
  // Un servidor viejo puede seguir mandando la forma equivocada durante todo lo
  // que dure una pestana abierta, asi que la traduccion vive aca: se saca el
  // nombre de donde estaba y se escribe donde va.
  let body = pedidoOriginal;
  if (body && Array.isArray(body.operations)) {
    const parchesDelCuerpo = {};
    body.operations.forEach((op, i) => {
      const nombre = op && (op.name || (op.operation && op.operation.name));
      if (nombre) parchesDelCuerpo[`media.${i}.name`] = nombre;
    });
    if (Object.keys(parchesDelCuerpo).length) {
      // Los del pedido ganan: son mas especificos que esta traduccion.
      parches = { ...parchesDelCuerpo, ...(parches || {}) };
      const { operations, ...resto } = body;
      body = Object.keys(resto).length ? resto : null;
      console.log('[mako] cuerpo viejo con `operations` traducido a `media` (servidor viejo)');
    }
  }

  const tieneCuerpo = !!body && Object.keys(body).length > 0;
  let cuerpo = tieneCuerpo ? { ...body } : null;

  // ⚠️ ACA HUBO UN clientContext INVENTADO, Y DURO UN COMMIT.
  //
  // Se agrego razonando que `estado_clips` era el unico tipo con parametros que
  // no lo recibia de nadie. El razonamiento era correcto y la conclusion no: el
  // cuerpo MEDIDO de este pedido es `{"media":[…]}` y NO LLEVA clientContext.
  // Agregarselo era exactamente el antipatron que el espejo existe para evitar —
  // nuestro dato inventado ganandole al copiado— y habria sido un segundo campo
  // que Google no reconoce encima del primero.
  //
  // Lo que quedo es el nombre del flag, que si valia la pena: `SIN_CAPTCHA` dice
  // la unica decision que toma, en vez de invitar a colgarle comportamientos.
  // ⚠️ `soloLectura` MEZCLABA DOS CONCEPTOS, Y ESO ROMPIO ESTA MISMA CONSULTA.
  //
  // Significa «no necesita captcha». Y de hecho significaba tambien «no manda
  // cuerpo» —eso ya se arreglo una vez, con su comentario— y ahora resulta que
  // significaba ademas «no necesita clientContext». `estado_clips` era el UNICO
  // tipo con parametros que no recibia `clientContext` de nadie: ni de aca,
  // porque este bloque se salteaba entero, ni de la plantilla, si la plantilla
  // quedo sin cuerpo.
  //
  // MEDIDO el 31/08/2026, y es lo que cierra el caso: con el pedido ya saliendo
  // por PARCHES —o sea sin pisar el array de Flow— el 400 siguio igual (#247).
  // Eso descarta la primera causa y deja esta: el pedido viajaba sin projectId,
  // sin tool y sin sessionId, que es exactamente un «argumento invalido».
  //
  // El `projectId` sale de las URLs que Flow hace de verdad y `tool: 'PINHOLE'`
  // esta MEDIDO en el cuerpo de `v1:checkAppAvailability`. No se inventa nada: lo
  // que no sabemos lo sigue poniendo la plantilla, porque `fundir` mezcla campo
  // por campo y lo nuestro solo gana en las dos claves que ponemos.
  if (!sinCaptcha) {
    const captcha = await pedirCaptcha(
      tab.id,
      accionDeCaptcha(trabajo.tipo, path),
      !!ACCION_CAPTCHA[trabajo.tipo],
    );
    cuerpo = { ...(body || {}) };
    // ⚠️ `projectId` solo viaja si lo SABEMOS. Iba siempre, y cuando estaba vacio
    // —que es casi siempre: solo se aprende de URLs con forma `/v1/projects/<id>/`
    // y ninguna de las que Flow hace de verdad la tiene— `fundir()` PISABA con ''
    // el projectId real que traia la plantilla. Un pedido de generacion que
    // declara no tener proyecto, con un bearer que si pertenece a uno, es una
    // incoherencia adentro del mismo request.
    //
    // Es el antipatron que el espejo existe para evitar: nuestro dato inventado
    // ganandole al copiado.
    cuerpo.clientContext = {
      ...(projectId ? { projectId } : {}),
      tool: 'PINHOLE',
      ...(cuerpo.clientContext || {}),
      recaptchaContext: { token: captcha },
    };
  }

  // ⚠️ EL PEDIDO NO SALE DE ACÁ, Y NO LO ARMAMOS NOSOTROS.
  //
  // Lo hace la PÁGINA de Flow, calcado del último pedido de la misma clase que la
  // propia app hizo (ver extension/injected.js). Dos razones, y las dos costaron:
  //
  //   1. Un `fetch` desde el service worker viaja con `Origin:
  //      chrome-extension://<id>` y sin las cookies del sitio. Google le contesta
  //      su página de bloqueo mientras la misma persona genera a mano sin problema:
  //      lo que rechaza tiene la forma exacta de un token robado.
  //   2. Reconstruir el pedido a mano es adivinar. El contrato salió de la doc de
  //      un tercero y le faltaba el `?key=` del proyecto; los headers que NO
  //      sabemos que faltan son peores, porque no hay a quién preguntarle.
  //
  // Con la plantilla se manda lo mismo que manda Flow. La `clase` es cómo se
  // encuentra: sale del último tramo del path (`/v1/credits` → `credits`).
  // ⚠️ Ya NO se arma la URL acá. La arma injected.js a partir de la plantilla: de
  // ahí salen el origen, el query (`?key=` incluido, y solo donde Flow lo manda) y
  // el método. Armarla acá y pasarla hecha fue el agujero de la primera versión
  // del espejo: se copiaba todo menos lo único que importaba.
  const clase = path.split('?')[0].split('/').filter(Boolean).pop() || '';
  const r = await chrome.tabs.sendMessage(tab.id, {
    tipo: 'HACER_FETCH', clase, path: path.split('?')[0], cuerpo, parches, soloLectura: sinCaptcha, bearer,
    // Por si la pestana se recargo y todavia no vio pasar este pedido.
    respaldo: await respaldoDe(clase),
  });
  if (!r || r.error) throw new Error(r?.error || 'FETCH_FALLO');

  const texto = String(r.texto || '');
  const res = { ok: r.status >= 200 && r.status < 300, status: r.status };
  let data = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { /* lo trata el server */ }

  // ⚠️ La extensión NO clasifica el fallo: manda el crudo y el status. Quien
  // decide si se reintenta es el server (`clasificarFalla`), porque es quien
  // sabe cuántos créditos hay en juego. Si el navegador pudiera decidirlo,
  // estaría decidiendo cuántas veces le pegamos a Google.
  if (!res.ok || (data && (data.error || (data.data && data.data.error)))) {
    // ⚠️ UN 401 DICE QUE EL BEARER YA NO SIRVE, Y HAY QUE CREERLE.
    //
    // `bearer` se guardaba y no se invalidaba nunca: era un «alguna vez», no un
    // «ahora» — la misma familia que `puente.estado`, que hoy se arregló
    // agregándole el latido. Con el token vencido, `if (!bearer)` seguía dando
    // falso y los cinco reintentos salían con la credencial muerta, cada uno
    // acuñando su reCAPTCHA contra la sesión de la persona. Cinco pedidos
    // rechazados es exactamente la forma del tráfico que Google marca.
    //
    // No hace falta medir cuánto dura un `ya29.` para esto: el 401 ES la medición.
    // Borrarlo hace que el próximo ciclo lo tome del tráfico real de Flow, que es
    // de donde sale, en vez de reusar el que ya se sabe muerto.
    if (res.status === 401) {
      bearer = '';
      try { await chrome.storage.local.remove('bearer'); } catch { /* el ciclo lo repone */ }
    }
    return { id: trabajo.id, ok: false, status: res.status, data, error: texto.slice(0, 400) };
  }
  return { id: trabajo.id, ok: true, data };
}

// ── El ciclo ─────────────────────────────────────────────────────────────────

async function ciclo() {
  if (corriendo) return;
  corriendo = true;
  // ⚠️ EL RASTRO DEL LATIDO, y se escribe en TODAS las salidas.
  //
  // Es lo unico de lo que el popup puede pintar: sin esto no tiene forma de
  // distinguir «MaKo dijo que la sesion esta marcada» de «no pude ni hablar con
  // MaKo». Y va en un acumulador con `finally` y no «al final del ciclo» porque
  // este ciclo tiene CUATRO salidas tempranas (sin token, res.ok falso, el catch,
  // y el return de pausado): escribiendolo al final, un 404 o una caida de red
  // nunca se registrarian y el popup pintaria el ultimo latido bueno para
  // siempre — que es el modo de falla mas caro, porque se lee como que anda.
  const latido = { ok: false, http: 0, estado: '', detalle: '', cuando: Date.now() };
  // ¿Este ciclo ejecuto algo? Decide si se encadena otro en el acto en vez de
  // esperar a la alarma. Va afuera del `try` por la misma razon que `latido`:
  // este ciclo tiene cuatro salidas tempranas.
  let hizoAlgo = false;
  try {
    const { token } = await chrome.storage.local.get('token');
    if (!token) { latido.estado = 'sin_token'; return; }

    // ⚠️ EN EL FLOW NUEVO, EL BEARER GUARDADO ES UN RECUERDO Y HAY QUE TIRARLO.
    //
    // No se puede refrescar ahí —la app nunca manda `Authorization`—, así que el que
    // haya en storage es de la época de labs.google. Y mientras siga puesto, todo lo
    // que pregunta «¿hay bearer?» contesta que sí: el popup mostraba «Todo listo»
    // sobre un puente que no puede filmar, y este latido reportaba `listo` al server.
    //
    // Una credencial que no se puede refrescar en el contexto actual no es una
    // credencial: es un recuerdo. Y este repo ya tiene la regla —el estado se lee
    // vivo, no se recuerda—; esto es aplicarla a algo que además abre una puerta.
    try {
      const tf = await pestanaDeFlow();
      if (bearer && esFlowNuevo(tf.url)) {
        bearer = '';
        await chrome.storage.local.remove('bearer');
      }
    } catch { /* sin pestaña, no hay nada que decidir */ }

    let estado = 'listo';
    let detalle = '';
    let respuestasVistas = null;
    if (!bearer) {
      // No es un error: es que el usuario todavía no abrió Flow en esta sesión.
      estado = 'sin_sesion';
      detalle = 'Abre Google Flow desde el ícono de MaKo e inicia sesión.';
      // ⚠️ SALVO QUE SEA EL FLOW NUEVO, DONDE NO HAY NADA QUE ABRIR NI QUE INICIAR.
      //
      // Ver `esFlowNuevo`: en flow.google.com no existe el mecanismo que este puente
      // captura. Mandar a abrir Flow ahí es mandar a repetir lo que ya está hecho, y
      // el que lo lee no tiene forma de saber que está persiguiendo algo imposible.
      //
      // El detalle viaja al server y de ahí a la pantalla de MaKo, que hasta hoy
      // decía «Falta abrir Google Flow» — la misma mentira en la otra superficie.
      try {
        const tf = await pestanaDeFlow();
        if (esFlowNuevo(tf.url)) {
          detalle = 'Google reescribió Flow y lo movió a flow.google.com. La forma en que MaKo se conectaba con la versión anterior ya no existe ahí: no es nada de tu cuenta. Estamos trabajando en la conexión nueva.';
        }
      } catch { /* sin pestaña, el detalle de arriba es el correcto */ }
    } else if (!apiKey) {
      // El bearer se ve en la PRIMERA llamada; la `key` también, pero si la
      // sesión venía guardada de antes y el usuario no volvió a navegar Flow,
      // puede haber bearer sin key. Sin key el pedido llega sin proyecto
      // atribuido y Google contesta su página de bloqueo — así que esto NO puede
      // reportarse como «listo»: sería un verde sobre algo que va a fallar.
      estado = 'sin_sesion';
      detalle = 'Recarga la pestaña de Google Flow para completar la conexión.';
    }

    // Qué pedidos vio la página. Viaja en `detalle` para que un fallo se pueda
    // diagnosticar mirando la base, sin pedirle a nadie otra captura de pantalla.
    if (estado === 'listo') {
      reparadasEnEstaVuelta.clear();
      try {
        const tab = await pestanaDeFlow();

        // ACA EL PUENTE DEJA DE MENTIR.
        //
        // `estado` se calculaba solo con el bearer y la apiKey, que viven en
        // chrome.storage y sobreviven a cualquier reinicio. O sea que decia
        // «listo» con la pestana muda — y el server, viendo verde, le seguia
        // repartiendo trabajo: cada uno moria terminal en el primer intento. Una
        // cola entera se vaciaba en fallos con el semaforo en verde.
        //
        // Este y `NO_FLOW_TAB` son los UNICOS dos caminos por los que este ciclo
        // apaga el puente. Cualquier otro fallo —espiar, guardar plantillas— NO
        // apaga nada: no poder MIRAR no es no poder trabajar.
        if ((await asegurarContentScript(tab.id)) === 'mudo') {
          estado = 'sin_sesion';
          detalle = 'La pestana de Google Flow esta abierta pero no responde, y no se pudo reponer el puente. Recargala (F5).';
          throw new Error('MUDO');
        }

        // Cada latido guarda lo que la pagina haya visto. Es el momento correcto:
        // no cuesta nada extra —la pestana ya se esta consultando— y garantiza que
        // lo que Flow hizo hace un minuto sobreviva al proximo F5.
        await guardarPlantillas(tab.id);
        // Lo que Flow ya recibio, por su propio canal. Va aparte del `detalle`
        // porque ese tiene tope de 7500 y las clases que generan se lo comen.
        try {
          const r = await chrome.tabs.sendMessage(tab.id, { tipo: 'VER_RESPUESTAS' });
          if (r && r.respuestas) respuestasVistas = r.respuestas;
          // De donde salen los medios que la pagina esta mostrando.
          if (r && Array.isArray(r.fuentes) && r.fuentes.length) {
            respuestasVistas = { ...(respuestasVistas || {}), '__fuentes': r.fuentes.join('\n') };
          }
        } catch { /* no poder mirar no apaga nada */ }

        const espia = await chrome.tabs.sendMessage(tab.id, { tipo: 'VER_ESPIA' });
        if (espia && espia.visto) {
          const visto = { ...espia.visto };

          // ⚠️ EL ESPIA MIRABA SOLO LA MEMORIA DE LA PESTANA, y esa se vacia con
          // cada F5. Resultado: el reporte listaba las 8 clases que Flow pide al
          // cargar la pagina y NINGUNA de las que generan — que son justo las que
          // hay que leer para saber por que un pedido nuestro sale mal.
          //
          // Medido el 31/08/2026: con una consulta de estado fallando con
          // HTTP 400, el detalle que llegaba al servidor no tenia ni una linea
          // sobre esa clase, aunque su plantilla existia (el pedido salio y Google
          // lo contesto). Estaba en el respaldo, que nadie reportaba.
          //
          // Las de memoria GANAN: son de esta sesion. El respaldo solo rellena lo
          // que hoy no se vio, marcado como tal para no leerlo como reciente.
          try {
            const guardadas = (await chrome.storage.local.get(CLAVE_PLANTILLAS))[CLAVE_PLANTILLAS] || {};
            for (const [clase, p] of Object.entries(guardadas)) {
              if (visto[clase]) continue;
              visto[clase] = {
                metodo: p.metodo,
                hayRespuesta: false,
                deRespaldo: true,
                url: String(p.url || '').replace(/key=[^&]+/, 'key=<oculta>'),
                headers: Object.keys(p.headers || {}).sort(),
                tieneCuerpo: p.cuerpo != null,
                esCascara: p.cuerpo == null && p.metodo !== 'GET' && p.metodo !== 'HEAD',
                cuerpoMuestra: p.cuerpo
                  ? String(p.cuerpo).slice(0, /generat/i.test(clase) ? 4000 : 200)
                  : null,
                edadMs: Date.now() - (p.cuando || 0),
              };
            }
          } catch { /* sin respaldo se reporta lo de memoria, que es lo de antes */ }

          // Ordenado con lo que GENERA primero: el detalle se corta al guardarse, y
          // lo que se pierde tiene que ser lo que ya conocemos, no el contrato que
          // estamos tratando de leer.
          // `/generat/i` cubre tambien `...VideoGenerationStatus`, que con
          // `/generate/i` quedaba al final y se lo comia el corte de 7500.
          const orden = Object.entries(visto).sort(
            (a, b) => (/generat/i.test(b[0]) ? 1 : 0) - (/generat/i.test(a[0]) ? 1 : 0),
          );
          detalle = JSON.stringify(Object.fromEntries(orden)).slice(0, 7500);
        }
      } catch (e) {
        // Si la pestana esta muda, `estado` y `detalle` ya se escribieron arriba y
        // no se pisan. Lo demas —no poder espiar— no apaga nada.
        const causa = String((e && e.message) || e);
        if (causa === 'FLOW_TAB_DORMIDA') {
          // ⚠️ UN MENSAJE QUE PIDE ALGO YA HECHO ENSEÑA A IGNORAR TODOS LOS DEMÁS.
          // Acá la pestaña existe: lo que hay que decir es que se está
          // despertando, no que falta abrirla.
          estado = 'sin_sesion';
          detalle = 'La pestana de Google Flow estaba dormida. La desperte: espera unos segundos sin cerrarla.';
        } else if (causa === 'NO_FLOW_TAB') {
          estado = 'sin_sesion';
          detalle = 'No hay ninguna pestana de Google Flow abierta. Abrila desde el icono de MaKo y dejala abierta.';
        }
      }
    }

    const pendientes = (await chrome.storage.local.get('pendientes')).pendientes || [];

    // Lo que este navegador aprendio de Flow, para que no se pierda con el perfil.
    // Se manda solo cuando CAMBIO: son decenas de KB y el latido es cada 15 s.
    // Lo que la sonda dejo listo en un latido anterior.
    const { sondaResultado, sondaSW } = await chrome.storage.local.get(['sondaResultado', 'sondaSW']);
    if (sondaResultado) {
      respuestasVistas = { ...(respuestasVistas || {}), __sonda: String(sondaResultado).slice(0, 1400) };
    }
    if (sondaSW) {
      respuestasVistas = { ...(respuestasVistas || {}), __sondaSW: String(sondaSW).slice(0, 1400) };
    }
    const { ultimoRedirectMedio } = await chrome.storage.local.get('ultimoRedirectMedio');
    if (ultimoRedirectMedio) {
      respuestasVistas = { ...(respuestasVistas || {}), __redirect: String(ultimoRedirectMedio).slice(0, 1400) };
    }

    const plantillasLocales = await todasLasPlantillas();
    const firma = plantillasLocales
      .map((p) => `${p.clase}:${(p.cuerpo || '').length}:${p.metodo}`)
      .sort()
      .join('|');
    const { firmaPlantillas } = await chrome.storage.local.get('firmaPlantillas');
    const mandarPlantillas = firma && firma !== firmaPlantillas;

    // El estado ya no cambia despues de esto: es lo que se le va a contar a MaKo
    // y es lo que el popup tiene que pintar.
    latido.estado = estado;
    latido.detalle = detalle;

    const res = await fetch(`${MAKO}/api/flow/puente`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-flow-token': token },
      // ⚠️ `plantillas` va solo cuando cambio; `clases` va SIEMPRE, porque es lo
      // que le permite al servidor contestar unicamente lo que falta.
      // ⚠️ `version` NO es telemetria: es la respuesta a «¿que codigo esta
      // corriendo alla?», que ya costo horas una vez —el cliente estuvo toda una
      // tarde con una copia vieja y nada lo mostraba— y volvio a costar hoy, al
      // no poder saber desde el server si el arreglo del captcha estaba puesto.
      //
      // Un artefacto que se distribuye COPIADO se desincroniza el mismo dia. Si
      // no dice su version, cada diagnostico arranca preguntando.
      body: JSON.stringify({
        token, projectId, estado, detalle, resultados: pendientes, cuantos: LOTE,
        version: chrome.runtime.getManifest().version,
        // La MEDICION del captcha. Vivia solo en la consola del service worker, o
        // sea que para leerla habia que pedirle a una persona que abriera DevTools
        // y copiara una linea — y si el navegador es de otro, ni eso. Un dato de
        // diagnostico que hay que pedir no es un dato: es una molestia.
        accionesCaptcha: ((await chrome.storage.local.get('accionesDeFlow')).accionesDeFlow || []).join(','),
        // Que clases tiene ESTE navegador. Es lo unico que el servidor necesita
        // para contestar solo lo que falta en vez de mandarlo todo cada 15 s.
        clases: plantillasLocales.map((p) => p.clase),
        // Lo que Flow ya recibio, para saber de donde sale el enlace de un video.
        ...(respuestasVistas ? { respuestas: respuestasVistas } : {}),
        ...(mandarPlantillas ? { plantillas: plantillasLocales } : {}),
      }),
    });
    latido.http = res.status;
    // ⚠️ Un 404 NO es un error de red: es «este token ya no existe», y pasa cada
    // vez que alguien conecta otro navegador (el upsert por workspace rota el
    // token). El popup lo distingue por el numero y ofrece volver a conectar, en
    // vez de mandar a revisar internet.
    if (!res.ok) return;

    latido.ok = true;
    const out = await res.json();
    // ⚠️ `pausado`, y NO un campo `estadoPuente` que no existe: la respuesta del
    // latido no trae el estado del puente, trae `pausado`, que el server calcula
    // como `guardado === 'marcada'`. Es el UNICO camino por el que la extension
    // puede enterarse de que Google marco la sesion — ella nunca lo dice, solo
    // sabe decir `listo` o `sin_sesion`.
    if (out && out.pausado) latido.estado = 'marcada';
    // Los resultados ya viajaron: recién ahora se limpian. Si la request falló,
    // quedan y se reintentan — perder un resultado deja al cliente mirando
    // «generando…» sobre algo que en realidad terminó.
    await chrome.storage.local.set({ pendientes: [] });

    if (typeof out.cooldownMs === 'number') cooldownMs = out.cooldownMs;

    // ⚠️ LA SONDA LA PIDE EL SERVIDOR Y CORRE UNA SOLA VEZ.
    //
    // Contesta cual variante de `mediaUrlType` trae el VIDEO. El enum no esta
    // documentado en ningun lado que tengamos, y probar valores contra produccion
    // de a uno —esperando un reporte del dueno entre cada intento— es exactamente
    // el bucle que costo esta noche.
    //
    // Tarda hasta 12 s por candidato, asi que NO puede correr en cada latido: se
    // anota el mediaId sondeado y no se repite. El resultado viaja con el latido
    // SIGUIENTE, que es lo que hace que esto no bloquee la cola.
    try {
      const pedido = out.sonda;
      if (pedido && pedido.mediaId) {
        // ⚠️ CLAVE NUEVA, Y NO ES CAPRICHO.
        //
        // La 0.26.0 escribia `sondaHecha` ANTES de sondear, asi que el primer
        // intento fallido dejo el marcador puesto para siempre. La 0.27.0 arreglo
        // el orden — y no sirvio de nada, porque el valor envenenado seguia en el
        // storage del navegador y hacia que el bloque se salteara entero.
        //
        // Un arreglo de logica no limpia el estado que dejo el error. Cuando una
        // guarda persistida se escribio mal aunque sea una vez, hay que cambiarle
        // el nombre o borrarla: si no, la version arreglada nunca llega a correr.
        //
        // `sondaOk` se escribe UNICAMENTE cuando la sonda contesto.
        const { sondaOk } = await chrome.storage.local.get('sondaOk');
        if (sondaOk !== pedido.mediaId + '|redir') {
          const tabS = await pestanaDeFlow();
          // El content script se repone ANTES: recargar la extension deja
          // huerfanos los de las pestanas abiertas, que es JUSTO el momento en que
          // esto corre por primera vez.
          await asegurarContentScript(tabS.id);
          const r = await chrome.tabs.sendMessage(tabS.id, {
            tipo: 'SONDA_MEDIO', mediaId: pedido.mediaId, variantes: pedido.variantes,
          });
          if (r && r.sonda) {
            // ⚠️ SE ANOTA DESPUES DE QUE CONTESTO, no antes.
            //
            // La version anterior marcaba «ya sondeado» y RECIEN despues sondeaba,
            // asi que el primer intento fallido —la pestana muda un segundo despues
            // de recargar la extension, que es exactamente cuando esto corre—
            // quemaba la sonda para siempre y en silencio. Una guarda de un solo
            // intento tiene que contar los intentos que SIRVIERON.
            // ⚠️ Y LA MISMA PREGUNTA, PERO DESDE EL SERVICE WORKER.
            //
            // Medido: desde la PAGINA el `fetch` tira «Failed to fetch» — el
            // endpoint es mismo origen pero redirige a un host que no manda CORS.
            // Un <video> lo carga igual (los elementos de medio no piden CORS),
            // asi que el archivo esta ahi y lo unico que falta es poder LEERLO.
            //
            // El service worker juega con otras reglas: para los hosts que estan
            // en `host_permissions` —labs.google lo esta— Chrome NO le aplica CORS.
            // La incognita es el salto siguiente, al host del archivo, que no
            // sabemos cual es. Se prueba y se anota; con la respuesta se decide si
            // alcanza con esto o si hay que sumar ese host al manifest.
            //
            // Se prueban las dos formas: siguiendo el redirect (si funciona, ya
            // tenemos los bytes) y frenando en el (si se puede leer el `Location`,
            // el servidor baja el archivo el mismo y no viaja nada por aca).
            const desdeSW = {};
            // ⚠️ La RUTA es la de labs.google y en flow.google.com NO esta medida: si
            // alla cuelga de otro prefijo, esta sonda falla — y eso esta bien, porque es
            // una sonda de diagnostico envuelta en try/catch, no el camino del producto.
            // El camino real lo copia el espejo de injected.js, que ahora reconoce la API
            // de la app por la RUTA /api/trpc/ y no por el host.
            //
            // Del MISMO origen que la pestana de Flow que encontramos: el endpoint es
            // de la app, asi que vive donde este servida la app. Clavarlo en
            // labs.google lo mandaba al dominio del que Google ya movio a la gente.
            const urlMedio = `${origenDeFlow(tabS)}/fx/api/trpc/media.getMediaUrlRedirect?name=`
              + encodeURIComponent(pedido.mediaId);
            try {
              const rr = await fetch(urlMedio, { credentials: 'include' });
              const bb = await rr.blob();
              desdeSW.follow = {
                ok: true, status: rr.status, tipo: rr.type,
                contentType: bb.type, tamano: bb.size,
                urlFinal: String(rr.url || '').slice(0, 200),
              };
            } catch (e) {
              desdeSW.follow = { ok: false, mensaje: String((e && e.message) || e).slice(0, 160) };
            }
            try {
              const rm = await fetch(urlMedio, { credentials: 'include', redirect: 'manual' });
              desdeSW.manual = {
                ok: true, status: rm.status, tipo: rm.type,
                location: String(rm.headers.get('location') || '(no legible)').slice(0, 200),
              };
            } catch (e) {
              desdeSW.manual = { ok: false, mensaje: String((e && e.message) || e).slice(0, 160) };
            }

            await chrome.storage.local.set({
              sondaOk: pedido.mediaId + '|redir',
              sondaSW: JSON.stringify(desdeSW).slice(0, 1200),
              sondaResultado: JSON.stringify({ mediaId: pedido.mediaId, r: r.sonda, bytes: r.bytes }),
            });
          }
        }
      }
    } catch (e) {
      // ⚠️ UN `catch` VACIO SOBRE EL INSTRUMENTO QUE SE CONSTRUYO PARA NO ESTAR
      // CIEGO. Estuvo ochenta latidos sin contestar y las cuatro causas posibles
      // —no hay pestana, el sendMessage rechaza, el content script no contesta, o
      // la respuesta viene vacia— se veian exactamente igual desde el servidor:
      // nada. Es el mismo modo de falla que costo la noche, montado encima de la
      // herramienta que venia a evitarlo.
      await chrome.storage.local.set({
        sondaResultado: JSON.stringify({ error: String((e && e.message) || e) }),
      });
    }

    // Lo que se mando quedo guardado del otro lado: se anota la firma para no
    // volver a mandarlo hasta que cambie.
    if (mandarPlantillas) await chrome.storage.local.set({ firmaPlantillas: firma });

    // Y lo que falta aca lo repone el servidor. Con esto, un F5, un perfil nuevo
    // o reinstalar la extension dejan de costar «genera uno a mano»: lo que este
    // navegador aprendio una vez sirve para siempre.
    const sembradas = await sembrarPlantillas(out.plantillas);
    if (sembradas) console.log(`[mako] ${sembradas} plantilla(s) repuestas desde el servidor`);

    // ⚠️ ANTES de tomar trabajo nuevo y solo si no hay nada en curso: es el unico
    // momento del ciclo en el que reiniciar no pierde nada.

    await anotarVersionEsperada(out.versionEsperada);

    if (out.pausado || estado !== 'listo') return;

    const cola = out.trabajos || [];
    const nuevos = [];
    /** Google frenó la sesión: no sale ni un pedido más de este lote. */
    let frenar = false;
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i];
      // ⚠️ EL COOLDOWN ES UN PISO ENTRE LLAMADAS, NO UN SLEEP AL FINAL DEL BUCLE.
      //
      // Antes vivia como un `await sleep(cooldownMs)` en la cola del `for`, y eso
      // solo espaciaba a los trabajos de UN MISMO lote. Mientras cada latido
      // traia un trabajo y despues dormia 15 s de alarma, alcanzaba por
      // accidente: la alarma hacia de guarda sin que nadie lo dijera.
      //
      // Al encadenar ciclos, ese accidente se termina — y con el sleep al final
      // del bucle, el ultimo trabajo de un lote y el primero del siguiente
      // quedaban separados por un viaje a nuestro servidor: ~0,3 s. O sea que dos
      // cambios que por separado no tocan la guarda, JUNTOS la desarman. Lo cazo
      // un revisor adversario y no una prueba, porque no rompe nada visible:
      // simplemente se le habla a Google mas rapido de lo permitido, y la factura
      // llega como un PUBLIC_ERROR_UNUSUAL_ACTIVITY que bloquea la sesion del
      // cliente.
      //
      // Esperando ANTES de llamar y contra el reloj de la ULTIMA llamada, la
      // guarda vale a traves de ciclos, de latidos y de reinicios del service
      // worker — y de paso desaparece la espera inutil despues del ultimo
      // trabajo, que era la mitad de lo que se venia a arreglar.
      const falta = cooldownMs - (Date.now() - (await ultimaLlamadaFlow()));
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      try {
        const r = await ejecutar(t);
        nuevos.push(r);

        // ⚠️ UN 403 FRENA EL LOTE ENTERO, EN EL ACTO.
        //
        // `out.pausado` se mira ANTES del bucle, así que un lote ya tomado seguía
        // hasta el final aunque el primer trabajo volviera con la sesión marcada.
        // Medido el 01/09/2026: tres trabajos de una clienta, tres 403 seguidos
        // de `PUBLIC_ERROR_UNUSUAL_ACTIVITY`. Con esto habría sido UNO.
        //
        // Y no es un detalle de eficiencia: `lib/flow-protocolo.ts` lo dice con
        // todas las letras — «`sesion_marcada` es el peor y el único que obliga a
        // frenar todo: seguir pegando con la sesión marcada es lo que la termina
        // de quemar». La regla estaba escrita y no la aplicaba nadie de este lado.
        //
        // ⚠️ Y ACÁ NO SE CLASIFICA, que es la regla de este archivo: quien decide
        // si algo se reintenta es el server, porque es quien sabe cuántos créditos
        // hay en juego. Frenar no es clasificar — es la dirección SEGURA, la única
        // que este lado tiene permitido tomar solo.
        // ⚠️ SE MARCA Y SE ROMPE DESPUES DEL SELLO. El `break` no puede saltearse
        // el `marcarLlamadaFlow()` de abajo: un pedido rechazado IGUAL SALIO, y
        // no sellarlo dejaria al proximo ciclo creyendo que la ultima llamada fue
        // hace rato — o sea reintentando rapido contra un bloqueo, que es
        // exactamente como se profundiza.
        if (r && r.ok === false && r.status === 403) {
          frenar = true;
          for (const resto of cola.slice(i + 1)) {
            // Se devuelven SIN intentar, y reintentables: no fallaron, no
            // salieron. Sin esto quedan `tomado` hasta que el rescate de diez
            // minutos los suelte, y el cliente mira un loader ese rato entero.
            nuevos.push({
              id: resto.id,
              ok: false,
              motivo: 'transitorio',
              error: 'No se intentó: Google frenó la sesión en el trabajo anterior.',
              reintentable: true,
            });
          }
        }
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        nuevos.push({
          id: t.id,
          ok: false,
          motivo: msg === 'NO_FLOW_TAB' ? 'sin_sesion' : 'transitorio',
          error: msg,
          reintentable: true,
        });
      }
      // ⚠️ DESPUES Y NO ANTES, y en el `finally` de hecho: el ritmo original
      // dormia al TERMINAR la llamada, asi que el hueco real entre dos pedidos
      // era «lo que tardo el primero + 10 s». Sellando al empezar, ese hueco se
      // encogeria a 10 s a secas — mas rapido que antes, que es exactamente lo
      // que no se puede hacer sin medir. Se sella al terminar y la guarda queda
      // igual de estricta que siempre, solo que ahora tambien entre ciclos.
      //
      // Y se sella aunque la llamada falle: un pedido rechazado igual salio, y
      // reintentar rapido contra un bloqueo es como se profundiza un bloqueo.
      await marcarLlamadaFlow();
      if (frenar) break;
    }
    if (nuevos.length) {
      await chrome.storage.local.set({ pendientes: nuevos });
      hizoAlgo = true;
    }
  } catch (e) {
    latido.detalle = String((e && e.message) || e);
  } finally {
    await chrome.storage.local.set({ ultimoLatido: latido });
    // La INSIGNIA es lo unico que se ve sin abrir nada, y es lo que reemplaza a
    // «volver a la web para enterarse». Sin permiso nuevo.
    try {
      await chrome.action.setBadgeText({ text: latido.ok && latido.estado === 'listo' ? '' : '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#d59b0a' });
    } catch { /* el badge no puede tumbar el ciclo */ }
    corriendo = false;

    // ⚠️ EL RESULTADO NO ESPERA A LA PROXIMA ALARMA.
    //
    // Los resultados se guardan en `pendientes` y se mandan al PRINCIPIO del
    // ciclo siguiente (ver la linea que los lee y el `set({ pendientes: [] })`
    // de mas arriba). O sea que todo trabajo terminado dormia un latido entero
    // antes de que MaKo se enterara — y despues la pantalla todavia tardaba
    // hasta 10 s mas en preguntar. Eso explica el numero que no cerraba de la
    // medicion: una consulta de estado y un pedido de enlace, que son dos
    // operaciones que no se parecen en nada, tardaban las dos ~14 s. No era
    // trabajo: era espera nuestra.
    //
    // Encadenar otro ciclo hace las dos cosas de una: manda lo que acaba de
    // terminar y se trae lo que siga. No le habla a Google de mas —lo unico que
    // se adelanta es el viaje a NUESTRO servidor— y el `cooldownMs` sigue
    // separando cada llamada a Flow exactamente igual que antes.
    if (hizoAlgo && cadena < CADENA_MAX) {
      cadena++;
      setTimeout(() => { void ciclo(); }, 0);
    } else {
      cadena = 0;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// LO QUE EL POPUP PIDE
// ═════════════════════════════════════════════════════════════════════════
// Los cuatro pasos de configuracion se mudaron al popup de la extension. Lo que
// sigue es lo que hace falta para que ahi se pueda hacer todo lo que NO exige la
// sesion de MaKo: conectar (disparando a la pagina), abrir y recargar Flow, y
// leer el saldo.

const URL_MAKO_TAB = `${MAKO}/video-generator`;
// ⚠️ EL DOMINIO NUEVO. Abria `labs.google/fx/tools/flow`, donde Google ya no deja a
// nadie: la persona terminaba en flow.google.com y la extension no reconocia esa
// pestana, asi que el boton que abre Flow era el que garantizaba que Flow no se
// detectara. Si una cuenta todavia no esta migrada, Google la manda a labs.google y
// `PATRONES_FLOW` la reconoce igual.
const URL_FLOW = 'https://flow.google.com/';

/**
 * Conectar: el disparo vive aca, el acunado vive en la pagina.
 *
 * ⚠️ NO se puede acunar el token desde el service worker, y no es por falta de
 * ganas: `crearTokenPuente` guarda un sha256 —no existe endpoint que devuelva el
 * token existente— y un POST de extension muere en el chequeo de Origin del
 * proxy de MaKo, que rechaza `chrome-extension://`. Abrirle una excepcion no es
 * opcion mientras la extension se instale descomprimida: el id es distinto en
 * cada maquina, asi que la excepcion tendria que ser para cualquier extension.
 *
 * Entonces: se busca una pestana de MaKo, se le pide a SU content script que le
 * pida el token a la pagina, y si no hay ninguna se abre una.
 */
async function conectar(forzar) {
  // La marca de tiempo es lo que le permite al popup distinguir «esta
  // conectando» de «se murio conectando». Sin ella, una sola de las dos existe.
  await chrome.storage.local.set({ emparejando: true, emparejandoDesde: Date.now(), emparejarError: '' });
  try {
    let tabs = [];
    try { tabs = await chrome.tabs.query({ url: `${MAKO}/*` }); } catch { tabs = []; }

    // ⚠️ SE PRUEBAN TODAS, NO LA PRIMERA QUE CONTESTE ALGO.
    //
    // Antes esto hacia `if (r) return`, y `r` es la respuesta del content script
    // —que SIEMPRE contesta, aunque sea su propio timeout—. O sea que la primera
    // pestana de MaKo de la lista decidia por todas: con una pestana vieja del
    // CRM abierta y la de /video-generator al lado, se le pedia el token a la del
    // CRM, fallaba, y ahi terminaba. Con dos pestanas abiertas, cual gana depende
    // del orden en que Chrome las devuelve.
    //
    // Ahora: gana el PRIMER EXITO. Si ninguna acuna, se guarda el fallo mas
    // informativo — un 'rol' o un 'sin_ws' los contesto el server sabiendo algo,
    // mientras que 'sin_enlace' solo dice que nadie atendio.
    // ⚠️ Y SE CORTA ANTE CUALQUIER RESPUESTA DEL SERVER, no solo ante `ok`.
    //
    // REGRESION MEDIDA, introducida el mismo dia que este bucle: seguir probando
    // despues de un `otro_navegador` DESCONECTA AL OTRO NAVEGADOR SIN PREGUNTAR.
    //
    // El mecanismo: `conectarPuenteAction` no acepta un `forzar` del cliente —lo
    // emite el server—. La primera vez contesta «ya hay otro» Y DEJA UN TICKET
    // armado por 60 s (`KEY_FORZAR`); el segundo pedido lo consume y pisa. Eso
    // esta bien cuando los dos pedidos son dos CLICS de la persona, con la
    // pantalla de «Si continuas, ese se desconectara» en el medio. Pero este
    // bucle hace los dos pedidos SEGUIDOS, sin pantalla y sin persona: la pestana
    // 1 arma el ticket y la pestana 2 lo consume.
    //
    // Y hoy pasa SIEMPRE que haya dos pestanas de MaKo abiertas, porque
    // `<PuenteEnlace/>` se mudo al layout raiz y ahora TODAS contestan. Antes
    // contestaba una sola y el bucle no llegaba a la segunda.
    //
    // Un motivo del server es una RESPUESTA: llego, pregunto, y le dijeron que
    // no. Probar otra pestana no cambia la respuesta —es la misma sesion y el
    // mismo workspace— y en el unico caso donde cambia algo, lo que cambia es
    // que se saltea el consentimiento. Solo `sin_enlace` justifica seguir: ahi
    // nadie contesto, y la de al lado puede.
    for (const t of tabs) {
      const r = await pedirEmparejar(t.id, forzar);
      if (r && (r.ok || r.motivo !== 'sin_enlace')) return await finEmparejado(r, null);
    }

    // ⚠️ Y SI TODAS CALLARON CON PESTANAS ABIERTAS, se recarga UNA y se reintenta.
    // El silencio casi siempre es una pestana cargada antes de que la extension
    // se instalara o se actualizara: su content script quedo huerfano. Reponerlo
    // ya se intenta en `pedirEmparejar`; lo que eso no arregla es una PAGINA
    // vieja, servida antes de que el enlace existiera. Eso lo arregla un F5.
    if (tabs.length) {
      const t = tabs.find((x) => x.active) || tabs[0];
      try {
        await chrome.tabs.reload(t.id);
        await esperarCarga(t.id);
        const r = await pedirEmparejar(t.id, forzar);
        if (r && r.ok) return await finEmparejado(r, null);
        if (r) return await finEmparejado(r, null);
      } catch { /* la cerraron mientras tanto: sigue el camino de abrir una */ }
    }

    // Ninguna pestana de MaKo: se abre una en segundo plano. Si la persona no
    // tiene sesion, la pagina no va a poder acunar y el pedido vuelve como
    // `sesion` — ahi la pestana se ACTIVA para que pueda entrar.
    const nueva = await chrome.tabs.create({ url: URL_MAKO_TAB, active: false });
    await esperarCarga(nueva.id);
    const r = await pedirEmparejar(nueva.id, forzar);
    // ⚠️ 'sin_enlace' y no 'sesion': que la pagina nueva no conteste puede ser que
    // no haya sesion —lo mas probable, y por eso la pestana se ACTIVA— o que no
    // haya terminado de cargar. Afirmar la primera es adivinar; el popup dice lo
    // que se sabe y la pestana abierta muestra lo que falte.
    return await finEmparejado(r || { ok: false, motivo: 'sin_enlace' }, nueva.id);
  } catch (e) {
    return await finEmparejado({ ok: false, motivo: 'error', error: String((e && e.message) || e) }, null);
  }
}

/**
 * DEJA EL NAVEGADOR LISTO PARA FILMAR, SIN PEDIRLE NADA A LA PERSONA.
 *
 * ⚠️ ESTO EXISTE PORQUE CASI TODO LO QUE FALLABA NO ERA UN BUG: ERA UN ESTADO QUE
 * LE PEDIAMOS AL USUARIO QUE ARMARA A MANO.
 *
 * La lista de lo que se reporto en tres dias, y que era siempre lo mismo:
 *
 *   · «no hay ninguna pestana de Flow abierta» — con Flow abierto al lado;
 *   · «inicia sesion en Google Flow» — logueada, mirando su avatar;
 *   · «abre un proyecto» — que nadie sabe que hace falta hasta que se lo dicen;
 *   · y la pestana de Flow DORMIDA, que Chrome descarta justo por mirar la de MaKo.
 *
 * Cada uno tuvo su arreglo y su cartel. Pero un cartel que pide armar un estado es
 * una tarea delegada al que menos contexto tiene, y la unica forma de que deje de
 * fallar es que no haya que armarlo: lo arma la extension, que es la unica que ve
 * las pestanas de las dos apps a la vez.
 *
 * El dueno lo pidio con esas palabras: «seria mucho mas facil si MaKo manejara las
 * tabs, para que no tenga que estar haciendo nada, y le decimos No toques nada».
 *
 * ── Que hace, en orden y por que ese orden ─────────────────────────────────
 *
 * 1. La pestana de FLOW primero. Es la que tarda (carga la app entera) y la que
 *    puede necesitar login. Arrancarla primero le da tiempo mientras se prepara lo
 *    demas.
 * 2. Adentro de un PROYECTO, no en la portada. El bearer y el resto del trafico que
 *    el puente necesita solo existen dentro de un proyecto — medido: en la lista de
 *    proyectos la app pide todo con cookies y no emite nada que sirva. Se usa el
 *    ultimo `projectId` visto; sin ninguno, se abre la portada y se dice que hay que
 *    entrar a uno, que es lo unico que no se puede hacer por la persona (elegir en
 *    cual de sus proyectos trabajar es una decision suya).
 * 3. La pestana de MAKO despues, y queda ACTIVA. Es donde la persona tiene que
 *    mirar; la de Flow trabaja atras.
 *
 * ⚠️ Y la de Flow se abre `active: false` a proposito. Activarla la traeria al
 * frente y dejaria la de MaKo atras — que es exactamente lo que hace que Chrome la
 * descarte y que despues no se encuentre. El orden de las pestanas ES parte del
 * arreglo, no una preferencia estetica.
 */
async function prepararEscenario() {
  const pasos = [];
  let avisoProyecto = false;

  // ── 1. Flow ───────────────────────────────────────────────────────────────
  let tabFlow = null;
  try { tabFlow = await pestanaDeFlow(); } catch { tabFlow = null; }

  if (tabFlow && !enProyectoDeFlow(tabFlow.url)) {
    // Hay pestana pero esta en la portada: se la lleva al ultimo proyecto visto.
    const { projectId: guardado } = await chrome.storage.local.get('projectId');
    if (ES_UUID.test(String(guardado || ''))) {
      await chrome.tabs.update(tabFlow.id, { url: `${origenDeFlow(tabFlow)}/project/${guardado}` }).catch(() => {});
      await esperarCarga(tabFlow.id);
      pasos.push('proyecto');
    } else {
      avisoProyecto = true;
    }
  } else if (!tabFlow) {
    const { projectId: guardado } = await chrome.storage.local.get('projectId');
    const destino = ES_UUID.test(String(guardado || ''))
      ? `${URL_FLOW}project/${guardado}`
      : URL_FLOW;
    // ⚠️ `active: false`: ver el comentario de arriba. La de MaKo tiene que quedar
    // adelante o Chrome duerme la de Flow.
    const nueva = await chrome.tabs.create({ url: destino, active: false });
    await esperarCarga(nueva.id);
    tabFlow = nueva;
    pasos.push('flow');
    if (!ES_UUID.test(String(guardado || ''))) avisoProyecto = true;
  }

  // ── 2. MaKo, y queda al frente ────────────────────────────────────────────
  let tabMako = null;
  try {
    const tabs = await chrome.tabs.query({ url: `${MAKO}/*` });
    tabMako = tabs.find((t) => String(t.url || '').includes('/video-generator')) || tabs[0] || null;
  } catch { tabMako = null; }

  if (!tabMako) {
    tabMako = await chrome.tabs.create({ url: URL_MAKO_TAB, active: true });
    await esperarCarga(tabMako.id);
    pasos.push('mako');
  } else {
    await chrome.tabs.update(tabMako.id, { active: true }).catch(() => {});
    await chrome.windows.update(tabMako.windowId, { focused: true }).catch(() => {});
  }

  // ── 3. Y se late, para no esperar la proxima alarma ───────────────────────
  // La persona acaba de apretar un boton: que el estado tarde 15 s en cambiar le
  // ensena que la app no se entera de lo que hace.
  await ciclo().catch(() => {});

  // ⚠️ QUEDA UNA GUARDIA PUESTA. Ver `CLAVE_CUIDANDO`.
  if (tabFlow && enProyectoDeFlow(tabFlow.url)) {
    await chrome.storage.local.set({
      [CLAVE_CUIDANDO]: { tabId: tabFlow.id, url: tabFlow.url, desde: Date.now() },
    });
  }

  return { ok: true, pasos, avisoProyecto, flow: !!tabFlow, mako: !!tabMako };
}
/**
 * Recarga la pestana de MaKo que no contesto y espera a que vuelva.
 *
 * Es el remedio de `sin_enlace`, y se hace desde aca porque el popup se cierra en
 * cuanto pierde el foco: una recarga disparada alla se corta a la mitad.
 */
async function recargarMako() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: `${MAKO}/*` }); } catch { tabs = []; }
  const t = tabs.find((x) => x.active) || tabs[0];
  if (!t) return { ok: false };
  try {
    await chrome.tabs.reload(t.id);
    await esperarCarga(t.id);
    return { ok: true };
  } catch { return { ok: false }; }
}

async function pedirEmparejar(tabId, forzar) {
  try {
    return await chrome.tabs.sendMessage(tabId, { tipo: 'EMPAREJAR', forzar: !!forzar });
  } catch {
    // Content script HUERFANO: Chrome no lo inyecta hacia atras en una pestana
    // que ya estaba abierta cuando se instalo o se actualizo la extension. Con
    // hola-mako.com en `host_permissions` esto se puede reponer, y sin reponerlo
    // el sintoma es «apreto Conectar y no pasa nada» sobre una pestana abierta.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['mako-puente.js'] });
      return await chrome.tabs.sendMessage(tabId, { tipo: 'EMPAREJAR', forzar: !!forzar });
    } catch { return null; }
  }
}

async function finEmparejado(r, tabCreada) {
  const ok = !!(r && r.ok);
  await chrome.storage.local.set({
    emparejando: false,
    emparejarError: ok ? '' : String((r && r.motivo) || 'error'),
    // ⚠️ CUÁNDO. Sin la fecha, un error del emparejado se queda en el storage
    // PARA SIEMPRE y el popup lo repinta cada vez que se abre: un fallo de hace
    // media hora se lee exactamente igual que uno de recién, y manda a arreglar
    // algo que capaz ya está bien. Le paso a una clienta, con un mensaje de la
    // version anterior de la extension.
    emparejarCuando: ok ? 0 : Date.now(),
    emparejarEtiqueta: (r && r.etiqueta) || '',
  });
  if (ok) {
    // Se conecto: la pestana que abri yo ya no hace falta, y el latido sale ya
    // para que el popup no tenga que esperar 15 s a decir algo verdadero.
    if (tabCreada != null) { try { await chrome.tabs.remove(tabCreada); } catch { /* la cerro alguien */ } }
    await ciclo();
  } else if (tabCreada != null) {
    // No se pudo: la pestana se ACTIVA en vez de cerrarse. Es la unica forma de
    // que la persona vea que le falta iniciar sesion — cerrarla dejaria un error
    // sin ningun lugar donde resolverlo.
    try { await chrome.tabs.update(tabCreada, { active: true }); } catch { /* ya no esta */ }
  }
  return r || { ok: false, motivo: 'error' };
}

function esperarCarga(tabId) {
  return new Promise((resolve) => {
    const reloj = setTimeout(fin, 9000);
    function alCambiar(id, info) {
      if (id !== tabId || info.status !== 'complete') return;
      fin();
    }
    function fin() {
      clearTimeout(reloj);
      chrome.tabs.onUpdated.removeListener(alCambiar);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(alCambiar);
  });
}

/** Abre Flow, o enfoca la pestana que ya esta. */
async function abrirFlow() {
  try {
    const t = await pestanaDeFlow();
    await chrome.tabs.update(t.id, { active: true });
    await chrome.windows.update(t.windowId, { focused: true });
    return { ok: true, creada: false };
  } catch {
    await chrome.tabs.create({ url: URL_FLOW, active: true });
    return { ok: true, creada: true };
  }
}

/**
 * Recarga la pestana de Flow.
 *
 * Lo hace la EXTENSION, no la persona. Es la diferencia concreta entre el panel
 * viejo y esto: la web solo podia PEDIR «recargala (F5)»; el popup ve la
 * pestana, la recarga, y despues late para que el estado se actualice solo.
 */
async function recargarFlow() {
  try {
    const t = await pestanaDeFlow();
    await chrome.tabs.reload(t.id);
    return { ok: true };
  } catch {
    await chrome.tabs.create({ url: URL_FLOW, active: true });
    return { ok: true, creada: true };
  }
}

/**
 * El saldo, LOCAL: sin dar la vuelta por la cola de MaKo.
 *
 * ⚠️ El pedido a `/v1/credits` sale de la PAGINA de Flow y nunca del service
 * worker: desde aca viaja con `Origin: chrome-extension://` y sin las cookies del
 * sitio, y Google contesta su pagina de bloqueo. Esta medido y es la razon de que
 * el paso 4 siga necesitando la pestana abierta.
 *
 * NO escribe nada en el server: `saldoAction` sigue siendo el unico escritor del
 * saldo guardado, que es lo que alimenta el costo por clip.
 */
/**
 * Los creditos, leidos de la respuesta que el Flow NUEVO ya trajo.
 *
 * ⚠️ NUNCA SE MOVIERON DE LUGAR: estan en el menu de la cuenta, arriba a la derecha,
 * como siempre. Lo que cambio es POR DONDE los pide la app.
 *
 * Medido el 05/09/2026 con el menu abierto y confirmado en pantalla: el `rpcids=nzlxg`
 * contesta, textual,
 *
 *   ["wrb.fr","nzlxg","[569,1,2,2,null,569]",null,null,null,"generic"]
 *
 * y 569 es exactamente el numero que muestra el menu. El primer elemento es el saldo.
 *
 * ⚠️ Y ESTO NO PIDE NADA: el espejo ya guarda la respuesta de cada `batchexecute`, asi
 * que leer los creditos deja de costar una llamada a Google. Es lo que el propio
 * espejo dice que existe para hacer —«con esto una consulta de creditos no necesita un
 * pedido nuestro»— y hasta hoy no se usaba en este camino.
 *
 * ⚠️ COMO SE ME PASO, que es lo que vale escribir: en la primera medicion busque la
 * palabra `credit` en las respuestas y no aparecia, asi que reporte que los creditos
 * ya no existian. El numero 569 ESTABA en esa misma captura, dos veces. Un predicado
 * mal elegido no devuelve «no se»: devuelve «no», que es indistinguible de un hecho.
 */
function creditosDeBoq(texto) {
  try {
    const m = /\["wrb\.fr","nzlxg","((?:[^"\\]|\\.)*)"/.exec(String(texto || ''));
    if (!m) return null;
    // Doble parseo a proposito: el tercer campo es un JSON guardado DENTRO de un
    // string JSON, asi que primero se desescapa el string y despues se parsea.
    const dentro = JSON.parse(JSON.parse('"' + m[1] + '"'));
    const n = Array.isArray(dentro) ? Number(dentro[0]) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch { return null; }
}

/**
 * El saldo del Flow nuevo, sin pedirle nada a Google.
 *
 * Devuelve `null` si todavia no se vio pasar un `nzlxg` — que es un estado distinto de
 * «no hay creditos» y por eso no se confunde con cero.
 */
async function saldoDeBoq() {
  try {
    const tab = await pestanaDeFlow();
    if (!esFlowNuevo(tab.url)) return null;
    if ((await asegurarContentScript(tab.id)) === 'mudo') return null;
    const r = await chrome.tabs.sendMessage(tab.id, { tipo: 'VER_RESPUESTAS' });
    const texto = r && r.respuestas && r.respuestas['boq:nzlxg'];
    const creditos = creditosDeBoq(texto);
    return creditos == null ? null : { creditos, cuando: Date.now(), tier: '' };
  } catch { return null; }
}
async function saldoLocal(forzar) {
  const { saldoLocal: prev } = await chrome.storage.local.get('saldoLocal');
  // Piso de ritmo: abrir el popup no puede ser un pedido a Google cada vez.
  if (!forzar && prev && Date.now() - prev.cuando < 60000) return prev;

  // ⚠️ EL FLOW NUEVO PRIMERO, Y SIN PEDIR NADA. El camino de abajo llama a
  // `/v1/credits` con el bearer, que en flow.google.com no existe: ahi falla
  // SIEMPRE. Este lee el numero de una respuesta que la app ya trajo.
  const boq = await saldoDeBoq();
  if (boq) {
    await chrome.storage.local.set({ saldoLocal: boq });
    return boq;
  }

  try {
    const tab = await pestanaDeFlow();
    if ((await asegurarContentScript(tab.id)) === 'mudo') {
      return { error: 'MUDO', cuando: Date.now() };
    }
    const r = await chrome.tabs.sendMessage(tab.id, {
      tipo: 'HACER_FETCH',
      // ⚠️ `credits`, NO `creditos`. La clase de una plantilla es el ULTIMO TRAMO
      // DEL PATH (`claseDePath`), no el nombre que le damos en `ENDPOINTS`. Con el
      // nombre nuestro no hay respaldo que buscar, el espejo no puede armar el
      // pedido, y el popup contesta «no pude leer tus creditos» con Flow abierto y
      // andando — un error que culpa a Google por un typo nuestro.
      clase: 'credits',
      path: '/v1/credits',
      cuerpo: null,
      // ⚠️ `parches: null` EXPLICITO: `content.js` lo reenvia e `injected.js` lo
      // consulta para decidir si puede usar la respuesta cacheada. Omitirlo lo
      // deja `undefined`, que hoy se comporta igual y no tiene por que seguir
      // haciendolo.
      parches: null,
      soloLectura: true,
      bearer,
      respaldo: await respaldoDe('credits'),
    });
    // ⚠️ `r.texto`, NO `r.resultado`. Ese campo NO EXISTE en ningun lado de la
    // extension: `injected.js` contesta `{ status, texto, metodo, urlUsada }` o
    // `{ error }` (injected.js:795). Leyendo un campo que nadie escribe, `d` era
    // `undefined` SIEMPRE y este boton contestaba «No pude leer tus creditos» en
    // el 100% de los casos, con Flow abierto y andando.
    //
    // Es un bug de CONTRATO: dos lados de un mensaje que no se pusieron de
    // acuerdo sobre el nombre de un campo, sin que nada falle ruidoso. Y no
    // hacia falta inventar nada — el otro consumidor del mismo mensaje, treinta
    // lineas mas arriba (`ejecutar`), ya lo hacia bien: `String(r.texto || '')`,
    // `JSON.parse`, y mirar el `status`.
    if (!r || r.error) return { error: String((r && r.error) || 'SIN_RESPUESTA'), cuando: Date.now() };

    // ⚠️ Y EL STATUS SE MIRA. Un 200 con la pagina de bloqueo de Google adentro
    // parsea como HTML y cae al `catch` de abajo; un 401 o un 403 traen JSON
    // valido y sin `credits`, asi que sin esto se leerian como «cero creditos».
    // Cero y «no me dejaron preguntar» no son lo mismo.
    if (!(r.status >= 200 && r.status < 300)) {
      return { error: `HTTP_${r.status}`, cuando: Date.now() };
    }

    let d = null;
    try { d = r.texto ? JSON.parse(r.texto) : null; } catch { /* no era JSON: se dice abajo */ }
    // Google contesta HTML cuando bloquea. Que no sea JSON ES el dato.
    if (!d || typeof d !== 'object') return { error: 'RESPUESTA_NO_JSON', cuando: Date.now() };
    // ⚠️ SIN EL NUMERO NO HAY SALDO. `creditos: null` se guardaba igual, y el
    // popup lo pinta solo si es `number` — asi que caia en «Todo listo · Ver mis
    // creditos», el mismo boton, otra vez. Un dato ausente que se guarda como
    // valido es un bucle con cara de pantalla.
    if (typeof d.credits !== 'number') return { error: 'SIN_CREDITOS_EN_LA_RESPUESTA', cuando: Date.now() };

    const saldo = {
      creditos: d.credits,
      // En POSITIVO: se afirma «gratuito» solo con la marca explicita de Google.
      // Es la misma regla que `leerSaldo` del server, y dice lo mismo o calla.
      gratuito: d.userPaygateTier === 'PAYGATE_TIER_NOT_PAID' || d.sku === 'WS_FREEMIUM',
      sku: String(d.sku || ''),
      cuando: Date.now(),
    };
    await chrome.storage.local.set({ saldoLocal: saldo });
    return saldo;
  } catch (e) {
    return { error: String((e && e.message) || e), cuando: Date.now() };
  }
}

// El service worker MV3 se duerme: el alarm es lo que lo despierta. Con
// setInterval solo, el puente deja de existir a los 30 segundos sin que nada
// avise.
//
// ⚠️ Y LA ALARMA NO ALCANZA CON CREARLA ACA ARRIBA. Esta linea corre cuando el
// service worker ARRANCA, y despues de una actualizacion el worker se termina y
// NO vuelve a arrancar hasta que llegue un evento. Si la actualizacion se llevo
// la alarma —y esa es la unica que despertaba al worker—, no queda ningun evento
// que pueda arrancarlo: el puente se apaga PARA SIEMPRE y nada lo dice.
//
// Medido en produccion el 01/09/2026: el ultimo latido de una clienta reporto la
// version 0.37.1 y su popup corria la 0.37.3. Desde la actualizacion no volvio a
// latir ni una vez. Su trabajo quedo `pendiente` con `intentos=0` durante horas,
// y la pantalla mostrando un clip que se generaba eternamente.
//
// `onInstalled` (que dispara con reason 'update') y `onStartup` SI despiertan al
// worker. Son los dos unicos momentos que pueden reponer la alarma, y por eso
// tienen que estar los dos: `onStartup` cubre reabrir Chrome, `onInstalled`
// cubre instalar y actualizar.
const PERIODO_MIN = 0.25;

async function asegurarAlarma() {
  try {
    const a = await chrome.alarms.get('ciclo');
    if (!a) await chrome.alarms.create('ciclo', { periodInMinutes: PERIODO_MIN });
  } catch {
    // `get` puede fallar si el worker se esta apagando: crearla igual es barato
    // y `create` sobre una que ya existe la reemplaza sin duplicarla.
    try { await chrome.alarms.create('ciclo', { periodInMinutes: PERIODO_MIN }); } catch { /* no hay mas que hacer */ }
  }
  // Y SE LATE YA. Sin esto, despues de una actualizacion el puente se queda
  // callado hasta el primer disparo —y para MaKo, un puente que no late hace un
  // minuto es un puente muerto: el gate no deja filmar.
  void ciclo();
}

chrome.runtime.onInstalled.addListener(() => { void asegurarAlarma(); });
chrome.runtime.onStartup.addListener(() => { void asegurarAlarma(); });
void asegurarAlarma();

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'ciclo') void ciclo(); });

// ⚠️ Y NO SE ESPERA AL PROXIMO LATIDO PARA CONTAR LA BUENA NOTICIA.
//
// Abrir Flow es el paso que la persona acaba de hacer, mirando la pantalla. Si el
// aviso de MaKo tarda en irse, lo que aprende es que la app no se entera de lo
// que hace — y encima el reloj del navegador y el de la pagina son dos esperas
// que SE SUMAN: hasta 15 s hasta que la extension reporta, mas hasta 15 s hasta
// que la pagina pregunta. Medio minuto mirando un cartel que ya no es cierto.
//
// Con esto el lado de la extension pasa a ser inmediato: en cuanto una pestana de
// Flow termina de cargar, se late. `complete` y no `loading` porque antes de eso
// no hay content script al que preguntarle nada.
/**
 * Si la pestana cuidada se va del proyecto, se la devuelve.
 *
 * ⚠️ UNA SOLA VEZ POR SALIDA, y por eso se compara contra la URL guardada: sin eso,
 * la propia navegacion que hacemos dispararia el listener otra vez y quedaria un
 * lazo que la persona no puede cortar ni cerrando la pestana.
 *
 * Y se suelta la guardia si la persona insiste: `veces` cuenta los rebotes, y al
 * segundo se deja de pelear. Alguien que vuelve a irse despues de que lo trajimos
 * de vuelta no se equivoco — quiere estar en otro lado, y el producto no esta para
 * discutirle.
 */
chrome.tabs.onUpdated.addListener((id, info) => {
  void (async () => {
    try {
      if (!info.url) return;
      const g = (await chrome.storage.local.get(CLAVE_CUIDANDO))[CLAVE_CUIDANDO];
      if (!g || g.tabId !== id) return;
      if (Date.now() - Number(g.desde || 0) > CUIDADO_MS) return soltarGuardia();
      // Sigue en su proyecto: nada que hacer.
      if (enProyectoDeFlow(info.url)) return;
      // Se fue de Flow del todo (cerro, o navego a otro sitio): no se lo persigue
      // fuera de Flow — eso ya no es «tocar algo de Flow», es irse.
      if (!esUrlDeFlow(info.url)) return soltarGuardia();
      if (Number(g.veces || 0) >= 1) return soltarGuardia();
      await chrome.storage.local.set({
        [CLAVE_CUIDANDO]: { ...g, veces: Number(g.veces || 0) + 1, avisado: true },
      });
      await chrome.tabs.update(id, { url: g.url }).catch(() => {});
    } catch { /* la guardia nunca puede romper la navegacion */ }
  })();
});

chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.status !== 'complete') return;
  // ⚠️ EL DECIMO SITIO QUE CLAVABA EL DOMINIO, y el mas silencioso de todos: no
  // rompe nada, solo hace que la buena noticia tarde hasta 30 s en llegar. Sale de
  // `PATRONES_FLOW` para que no vuelva a quedarse atras.
  if (!esUrlDeFlow(tab.url)) return;
  void ciclo();
});

chrome.runtime.onMessage.addListener((msg, _s, responder) => {
  // ⚠️ MAKO AVISA QUE HAY TRABAJO, EN VEZ DE QUE ESTE LADO LO DESCUBRA TARDE.
  //
  // El primer trabajo de una tanda esperaba a la proxima alarma —hasta 15 s, y
  // en una extension empaquetada Chrome puede llevar el minimo a 30— con la
  // persona mirando el loader inmediatamente despues de apretar «Generar». Nada
  // pasaba en ese rato: el trabajo ya estaba encolado y este lado no lo sabia.
  //
  // Viaja por el content script de hola-mako.com, igual que el emparejado, y por
  // la misma razon: `externally_connectable` necesita el ID de la extension, que
  // cambia al publicarse en la tienda.
  //
  // No abre ninguna puerta: `ciclo()` hace exactamente lo que ya hacia cada 15 s
  // —le pregunta al servidor si hay algo suyo, con el token de este navegador—.
  // Lo unico que cambia es CUANDO. Y `corriendo` lo hace idempotente: un aviso
  // que llega con un ciclo en curso no lo duplica.
  if (msg?.tipo === 'DESPERTAR') {
    void ciclo();
    responder?.({ ok: true });
    return false;
  }

  // ⚠️ ESTADO SE LEE DE STORAGE, NO DE LOS GLOBALES.
  //
  // Contestaba `{ conectado: !!bearer }` de forma SINCRONA, leyendo un global que
  // se hidrata por callback al arrancar el worker. El propio `sendMessage` del
  // popup despierta al worker en frio: el callback todavia no corrio, `bearer` es
  // null, y el popup pintaba «falta abrir Flow» con Flow perfectamente abierto.
  // Un dato que depende de una carrera no es un dato.
  if (msg?.tipo === 'ESTADO') {
    chrome.storage.local.get(
      ['token', 'bearer', 'apiKey', 'ultimoLatido', 'saldoLocal', 'emparejando', 'emparejandoDesde', 'emparejarError', 'emparejarCuando', 'emparejarEtiqueta', 'workspaceNombre', 'versionEsperada'],
      async (v) => {
        let hayFlow = false;
        // Dos preguntas y no una: «hay pestana de Flow» y «esa pestana esta dentro de
        // un proyecto». Ver `enProyectoDeFlow`: sin la segunda, a alguien logueado se
        // le pide que inicie sesion.
        let flowEnProyecto = false;
        let flowNuevo = false;
        // ⚠️ SI YA APRENDIÓ A GENERAR, y no es un adorno: es lo único que le dice a
        // la persona si la generación de prueba sirvió. Sin esto genera a ciegas y
        // no tiene forma de saber si hay que repetirla.
        //
        // `sentinela` lo escribe el espejo cuando encuentra la frase conocida dentro
        // del cuerpo capturado; si es `null`, la plantilla existe pero no sabemos
        // dónde va el prompt — que es un estado distinto de «no hay plantilla» y se
        // muestra distinto.
        let aprendioGenerar = false;
        // ⚠️ SI LA GUARDIA TUVO QUE DEVOLVER LA PESTAÑA, hay que decirlo. Sin esto,
        // la persona ve que Flow «se movió solo» y no sabe que fue MaKo — que es
        // peor que no haberla movido: parece que el navegador hace cosas raras.
        let volviAlProyecto = false;
        try {
          const g = (await chrome.storage.local.get(CLAVE_CUIDANDO))[CLAVE_CUIDANDO];
          volviAlProyecto = !!(g && g.avisado);
        } catch { volviAlProyecto = false; }
        try {
          const guardadas = (await chrome.storage.local.get(CLAVE_PLANTILLAS))[CLAVE_PLANTILLAS] || {};
          aprendioGenerar = !!(guardadas['boq:YhhmEf'] && guardadas['boq:YhhmEf'].sentinela);
        } catch { aprendioGenerar = false; }
        try {
          const tf = await pestanaDeFlow();
          hayFlow = true;
          flowEnProyecto = enProyectoDeFlow(tf.url);
          flowNuevo = esFlowNuevo(tf.url);
        } catch { hayFlow = false; }
        responder({
          // Booleanos: el popup no necesita ninguna credencial, y lo que no sale
          // de aca no se puede filtrar por una pantalla.
          token: !!v.token,
          bearer: !!v.bearer,
          apiKey: !!v.apiKey,
          hayFlow,
          flowEnProyecto,
          flowNuevo,
          aprendioGenerar,
          volviAlProyecto,
          ultimoLatido: v.ultimoLatido || null,
          saldo: v.saldoLocal || null,
          emparejando: !!v.emparejando,
          emparejandoDesde: Number(v.emparejandoDesde) || 0,
          emparejarError: v.emparejarError || '',
          emparejarCuando: Number(v.emparejarCuando) || 0,
          emparejarEtiqueta: v.emparejarEtiqueta || '',
          workspace: v.workspaceNombre || '',
          version: chrome.runtime.getManifest().version,
          // ⚠️ LA COMPARACION SE HACE ACA, no en el popup. `esMasVieja` ya vive
          // en este archivo y compara ORDENADO —no `!==`—, porque una igualdad
          // tambien dispara cuando la instalada va ADELANTE: la maquina de
          // desarrollo, los minutos entre el push y el deploy, y para siempre si
          // el build fallo. Duplicarla en el popup serian dos respuestas posibles
          // a la misma pregunta.
          versionEsperada: v.versionEsperada || '',
          // ⚠️ `deLaTienda` VIAJABA ACA Y NO LO LEIA NADIE — el mismo modo de
          // falla que `r.resultado`, en chiquito y recien nacido. Su condicion
          // (de la tienda actualiza Chrome solo, asi que ahi no hay paso a paso
          // que dar y frenar seria encerrar a alguien esperando a Google) ya vive
          // adentro de `versionVieja`, dos lineas mas abajo. Un campo de mas es
          // un contrato que alguien va a leer creyendo que decide algo.
          versionVieja: !!v.versionEsperada
            && !chrome.runtime.getManifest().update_url
            && esMasVieja(chrome.runtime.getManifest().version, v.versionEsperada),
        });
      },
    );
    return true;
  }
  if (msg?.tipo === 'CONECTAR') { void conectar(!!msg.forzar).then(responder); return true; }
  if (msg?.tipo === 'RECARGAR_MAKO') { void recargarMako().then(responder); return true; }
  if (msg?.tipo === 'ABRIR_FLOW') { void abrirFlow().then(responder); return true; }
  // Se limpia el aviso cuando el popup ya lo mostró: es un EVENTO, no un estado, y
  // dejarlo puesto lo repetiría cada vez que se abre el popup.
  if (msg?.tipo === 'AVISO_VISTO') {
    void (async () => {
      try {
        const g = (await chrome.storage.local.get(CLAVE_CUIDANDO))[CLAVE_CUIDANDO];
        if (g) await chrome.storage.local.set({ [CLAVE_CUIDANDO]: { ...g, avisado: false } });
      } catch { /* nada */ }
      responder({ ok: true });
    })();
    return true;
  }
  if (msg?.tipo === 'PREPARAR') { void prepararEscenario().then(responder, (e) => responder({ ok: false, error: String((e && e.message) || e) })); return true; }
  if (msg?.tipo === 'RECARGAR_FLOW') { void recargarFlow().then(responder); return true; }
  if (msg?.tipo === 'SALDO') { void saldoLocal(true).then(responder); return true; }
  if (msg?.tipo === 'LATIR') { void ciclo().then(() => responder({ ok: true })); return true; }
  // ⚠️ El `return true` estaba FUERA del if, asi que dejaba el canal abierto para
  // TODO mensaje desconocido y el emisor esperaba una respuesta que no llegaba
  // nunca.
  return false;
});
