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

/** Lo pisa el server en cada respuesta. Este es solo el arranque. */
let cooldownMs = 10000;
let bearer = null;
let projectId = '';
let apiKey = '';
let corriendo = false;

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
  { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*'] },
  ['requestHeaders'],
);

// ── El captcha ───────────────────────────────────────────────────────────────
// Se pide a la PÁGINA de Flow, que ya tiene el widget cargado. No hay ningún
// servicio de resolución de por medio: el token lo emite Google evaluando esta
// sesión, y si el comportamiento parece automatizado devuelve 403 — que es
// exactamente lo que tiene que pasar.

async function pestanaDeFlow() {
  // `discarded: false` importa: Chrome duerme las pestañas que no se miran, y una
  // pestaña dormida sigue apareciendo en `query` con su URL pero sin ningún script
  // vivo adentro. Sin este filtro se elige una pestaña muerta habiendo otra sana.
  const abiertas = await chrome.tabs.query({ url: 'https://labs.google/fx/*tools/flow*', discarded: false });
  const tab = abiertas.find((t) => t.status === 'complete') || abiertas[0];
  if (!tab) throw new Error('NO_FLOW_TAB');
  return tab;
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
const SIN_CAPTCHA = new Set(['creditos', 'estado_clips']);

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

async function quizasReiniciar(esperada, hayTrabajoEnCurso) {
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
    return { id: trabajo.id, ok: false, status: res.status, data, error: texto.slice(0, 400) };
  }
  return { id: trabajo.id, ok: true, data };
}

// ── El ciclo ─────────────────────────────────────────────────────────────────

async function ciclo() {
  if (corriendo) return;
  corriendo = true;
  try {
    const { token } = await chrome.storage.local.get('token');
    if (!token) return;

    let estado = 'listo';
    let detalle = '';
    let respuestasVistas = null;
    if (!bearer) {
      // No es un error: es que el usuario todavía no abrió Flow en esta sesión.
      estado = 'sin_sesion';
      detalle = 'Abre labs.google/fx/tools/flow e inicia sesión.';
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
        if (String((e && e.message) || e) === 'NO_FLOW_TAB') {
          estado = 'sin_sesion';
          detalle = 'No hay ninguna pestana de Google Flow abierta. Abre labs.google/fx/tools/flow y dejala abierta.';
        }
      }
    }

    const pendientes = (await chrome.storage.local.get('pendientes')).pendientes || [];

    // Lo que este navegador aprendio de Flow, para que no se pierda con el perfil.
    // Se manda solo cuando CAMBIO: son decenas de KB y el latido es cada 15 s.
    // Lo que la sonda dejo listo en un latido anterior.
    const { sondaResultado } = await chrome.storage.local.get('sondaResultado');
    if (sondaResultado) {
      respuestasVistas = { ...(respuestasVistas || {}), __sonda: String(sondaResultado).slice(0, 1400) };
    }

    const plantillasLocales = await todasLasPlantillas();
    const firma = plantillasLocales
      .map((p) => `${p.clase}:${(p.cuerpo || '').length}:${p.metodo}`)
      .sort()
      .join('|');
    const { firmaPlantillas } = await chrome.storage.local.get('firmaPlantillas');
    const mandarPlantillas = firma && firma !== firmaPlantillas;

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
        token, projectId, estado, detalle, resultados: pendientes, cuantos: 1,
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
    if (!res.ok) return;

    const out = await res.json();
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
        const { sondaHecha } = await chrome.storage.local.get('sondaHecha');
        if (sondaHecha !== pedido.mediaId) {
          await chrome.storage.local.set({ sondaHecha: pedido.mediaId });
          const tabS = await pestanaDeFlow();
          if (tabS) {
            const r = await chrome.tabs.sendMessage(tabS.id, {
              tipo: 'SONDA_MEDIO', mediaId: pedido.mediaId, variantes: pedido.variantes,
            });
            if (r && r.sonda) {
              await chrome.storage.local.set({
                sondaResultado: JSON.stringify({ mediaId: pedido.mediaId, r: r.sonda }),
              });
            }
          }
        }
      }
    } catch { /* sondear nunca apaga nada */ }

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

    await quizasReiniciar(out.versionEsperada, (out.trabajos || []).length > 0);

    if (out.pausado || estado !== 'listo') return;

    const nuevos = [];
    for (const t of out.trabajos || []) {
      try {
        nuevos.push(await ejecutar(t));
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
      // El ritmo que reemplaza al simulador de actividad humana.
      await new Promise((r) => setTimeout(r, cooldownMs));
    }
    if (nuevos.length) await chrome.storage.local.set({ pendientes: nuevos });
  } catch { /* la próxima vuelta reintenta */ } finally {
    corriendo = false;
  }
}

// El service worker MV3 se duerme: el alarm es lo que lo despierta. Con
// setInterval solo, el puente deja de existir a los 30 segundos sin que nada
// avise.
chrome.alarms.create('ciclo', { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'ciclo') void ciclo(); });
chrome.runtime.onMessage.addListener((msg, _s, responder) => {
  if (msg?.tipo === 'ESTADO') {
    responder({ conectado: !!bearer, projectId });
  }
  return true;
});
