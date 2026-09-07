// Corre en el mundo de la PÁGINA de Flow (declarado con `world: MAIN` en el
// manifest), que es donde existen `window.grecaptcha`, las cookies del sitio y el
// `fetch` que usa la propia app.
//
// Hace tres cosas:
//
//   1. ESPÍA los pedidos que Flow hace a su API, y se guarda el último de cada
//      clase como PLANTILLA. Nada sale de la máquina: viven en memoria.
//   2. Pide el token de reCAPTCHA al widget que la página ya tiene cargado.
//   3. Hace nuestros pedidos **calcados de la plantilla**.
//
// ── Por qué se copia el pedido en vez de reconstruirlo ──────────────────────
// El contrato de esta API salió de la documentación de un tercero (useapi), y al
// compararlo contra el tráfico REAL de Flow apareció que le faltaba el `?key=` del
// proyecto. Ese fue un dato; los que no sabemos que nos faltan son el problema:
// headers `x-goog-*`, `x-client-data`, el `accept-language`, el shape exacto del
// cuerpo. Adivinarlos de a uno es lo que convirtió esto en cinco vueltas.
//
// Con la plantilla no hay nada que adivinar: se manda **lo mismo que manda Flow**,
// cambiando solo lo que tiene que cambiar. Y si Google cambia el contrato mañana,
// la plantilla cambia sola porque sale del tráfico de hoy.
//
// ⚠️ El envoltorio de `fetch` NO puede romper la app: todo lo que hace va dentro de
// try/catch y la promesa original se devuelve intacta, siempre. Si la captura
// falla, Flow sigue andando y nosotros nos quedamos sin plantilla — que es
// exactamente el orden de prioridades correcto.

(function () {
  // ⚠️ RE-EJECUTAR ESTE ARCHIVO NO PUEDE VOLVER A ENVOLVER `window.fetch`.
  //
  // Ahora se lo puede re-inyectar para reponer el puente de una pestana que quedo
  // sin content script, y dos envoltorios serian DOS PEDIDOS REALES a Google por
  // cada uno nuestro — con los creditos del cliente. Y seria INVISIBLE: el flag
  // `cerrado` de content.js tapa la segunda respuesta, asi que el doble gasto no
  // dejaria ni un sintoma.
  //
  // La marca vive en el mundo de la PAGINA y muere con ella, que es exactamente
  // lo que hace falta: sobrevive a un reinicio de la extension y no a un F5.
  // ⚠️ LA MARCA LLEVA LA VERSION, y no es cosmetico: es el unico dato que delata
  // que esta pestana quedo con un espejo VIEJO.
  //
  // Esta marca vive en el mundo de la PAGINA, asi que sobrevive a que la extension
  // se actualice y solo muere con un F5. Una pestana abierta desde ayer sigue
  // corriendo este archivo tal como era ayer, y todo campo nuevo que aprenda a
  // mandar no llega nunca — con la extension al dia y el codigo correcto.
  //
  // Eso costo un dia entero el 05/09/2026: un arreglo bueno, desplegado, que no se
  // ejecutaba. Y era invisible: no hay error, no hay log, y el popup muestra un
  // estado perfectamente coherente con «todavia no aprendio».
  //
  // NO se recarga la pestana automaticamente al detectarlo: un reload mata las
  // generaciones en vuelo y tira el `at` vivo. Se REPORTA, y la persona decide.
  const VERSION_ESPEJO = '0.64.0';
  if (window.__makoEspejo) return;
  window.__makoEspejo = VERSION_ESPEJO;

  // Quien pregunte por la version la recibe. Un espejo ANTERIOR a esto no contesta
  // nada, y esa ausencia es la respuesta: es viejo.
  window.addEventListener('MAKO_VERSION_PIDO', (ev) => {
    try {
      window.dispatchEvent(new CustomEvent('MAKO_VERSION_OK', {
        detail: { id: ev.detail && ev.detail.id, version: VERSION_ESPEJO },
      }));
    } catch { /* nunca romper la pagina */ }
  });

  const API = 'aisandbox-pa.googleapis.com';
  // ── LO QUE UNA PLANTILLA DE BOQ NO PUEDE LLEVARSE ──────────────────────────
  //
  // ⚠️ EL CUERPO DE UN `batchexecute` TRAE EL TOKEN `at`, QUE ES UNA CREDENCIAL.
  //
  // Y las plantillas no se quedan acá: `todasLasPlantillas()` las manda al servidor
  // para poder sembrar un navegador nuevo. O sea que sin esto guardaríamos un token
  // de sesión de Google de cada cliente en nuestra base — algo que nadie pidió, que
  // no hace falta, y que si se filtra es la sesión de esa persona.
  //
  // Tampoco serviría: el `at` es de ESTA sesión y vence con ella. Una plantilla que
  // lo llevara adentro fallaría igual al usarse en otro momento, con la diferencia de
  // que el fallo sería tardío y el riesgo permanente.
  //
  // Va un marcador en su lugar: el replay lo repone del tráfico VIVO de la pestaña,
  // que es la única fuente que puede estar al día. Es la misma regla de la casa que
  // ya rige el puente: el estado se lee vivo, no se recuerda.
  const MARCA_AT = '__MAKO_AT__';
  function sinCredenciales(cuerpo) {
    if (typeof cuerpo !== 'string' || !cuerpo) return cuerpo;
    return cuerpo.replace(/(^|&)at=[^&]*/g, (_, pre) => pre + 'at=' + MARCA_AT);
  }

  // ── LA SENTINELA: cómo se aprende dónde va el prompt ───────────────────────
  //
  // Para repetir una generación con OTRO texto hay que saber en qué parte del cuerpo
  // vive el que escribió la persona. El cuerpo es un `f.req` con JSON anidado adentro
  // de JSON, url-encodeado — o sea que el prompt aparece escapado, y CUÁNTAS veces
  // depende de cómo BOQ arme el pedido ese día.
  //
  // Adivinar el anidado es exactamente lo que este repo tiene prohibido. Así que no
  // se adivina: la persona genera UNA vez con una frase conocida, y acá se prueba
  // cada codificación hasta encontrar cuál de todas aparece en el cuerpo. Esa es la
  // que se usa después para escribir el prompt de verdad.
  //
  // Si NINGUNA aparece, no se marca nada — y eso es información: quiere decir que el
  // prompt no viaja como texto plano en el cuerpo, y que el camino es otro. Un
  // `sentinela: null` es una medición, no un fallo silencioso.
  const SENTINELA = 'un cubo violeta girando sobre arena mako7f3a9c';

  const CODIFICACIONES = [
    ['crudo', (t) => t],
    ['json', (t) => JSON.stringify(t).slice(1, -1)],
    ['uri', (t) => encodeURIComponent(t)],
    ['json+uri', (t) => encodeURIComponent(JSON.stringify(t).slice(1, -1))],
    ['json2', (t) => JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1)],
    ['json2+uri', (t) => encodeURIComponent(JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1))],
  ];

  /**
   * El pedazo de la sentinela que NINGUNA codificación puede cambiar.
   *
   * ⚠️ ES LO QUE DECIDE, y la frase entera no puede serlo.
   *
   * `SENTINELA` tiene seis espacios, y un espacio es justo el carácter que cada
   * capa escribe distinto: `encodeURIComponent` lo manda como `%20`, pero un
   * cuerpo `application/x-www-form-urlencoded` —que es como viaja `f.req` en BOQ—
   * lo manda como `+`, y ninguna de las seis CODIFICACIONES de acá arriba produce
   * esa forma. Con eso, una generación perfectamente capturada daría `null`.
   *
   * `mako7f3a9c` son diez caracteres alfanuméricos: sobrevive idéntico a
   * url-encoding, a form-encoding, al escapado de JSON y a los tres anidados.
   * Por eso el que decide es el TOKEN y las codificaciones quedan solo para
   * NOMBRAR dónde apareció, que es un dato para escribir el pedido después.
   *
   * Es la misma lección que el `\s` del snippet del Pixel: lo que se lee en el
   * fuente y lo que viaja por el cable no son el mismo texto.
   */
  const TOKEN_SENTINELA = 'mako7f3a9c';

  // ⚠️ LA SEGUNDA ANCLA, QUE FALTABA. El espejo solo conocia la del video, asi que
  // la plantilla de IMAGEN nunca llevaba `sentinela` y la regla de «no pisar» de
  // abajo no podia protegerla. Las dos se pinean al catalogo por test.
  const SENTINELA_IMAGEN = 'una esfera naranja flotando sobre nieve mako4d1c8b';
  const TOKEN_IMAGEN = 'mako4d1c8b';
  const ANCLAS = [[SENTINELA, TOKEN_SENTINELA], [SENTINELA_IMAGEN, TOKEN_IMAGEN]];

  /**
   * La url como la ve el SERVER, no como la escribio la app.
   *
   * ⚠️ BOQ abre sus XHR con la ruta RELATIVA (`/_/AiSandbox…/batchexecute?…`). Al
   * navegador le da igual —la repite contra su propio origen—, pero el respaldo
   * del server valida el ORIGEN con `new URL(url)`, que sobre una relativa tira, y
   * la plantilla desaparece sin ruido. Medido: el respaldo de un workspace tenia
   * cero plantillas de BOQ con el navegador mandandolas en cada latido.
   */
  function absoluta(u) {
    try { return new URL(String(u || ''), location.href).href; } catch { return String(u || ''); }
  }

  /** Con qué codificación aparece la sentinela en este cuerpo, si aparece. */
  function codificacionDeLaSentinela(cuerpo) {
    if (typeof cuerpo !== 'string' || !cuerpo) return null;
    for (const [frase, token] of ANCLAS) {
      for (const [nombre, codificar] of CODIFICACIONES) {
        try { if (cuerpo.includes(codificar(frase))) return nombre; } catch { /* sigue */ }
      }
      if (cuerpo.includes(token)) return 'token';
    }
    // Ninguna de las seis, pero el token está: la frase viajó con los espacios
    // escritos de una forma que no conocemos. Alcanza para decir que aprendió, y
    // el nombre dice que la codificación quedó sin identificar — que es un dato
    // cierto y no un `null` que se lee como «no aprendió».
    return null;
  }


  /** Última plantilla vista por clase de pedido. Solo en memoria. */
  const plantillas = new Map();
  /** Última respuesta vista, por clase. Sirve para no repetir pedidos de lectura. */
  const respuestas = new Map();

  /**
   * La clase de un pedido sale de su path: `/v1/credits` → `credits`.
   *
   * ⚠️ SALVO EN BOQ, DONDE EL PATH ES SIEMPRE EL MISMO. El Flow nuevo manda TODO
   * por `/_/AiSandboxAngularFrontend/data/batchexecute` y lo que distingue un pedido
   * de otro es el `rpcids` del query. Con la regla del path, las seis operaciones
   * —generar, sondear, leer el proyecto— colapsarían en una sola clase llamada
   * `batchexecute`, y cada pedido pisaría la plantilla del anterior.
   *
   * Y no fallaría ruidoso: fallaría sirviendo la plantilla del SONDEO cuando se pide
   * generar, que es el modo de falla que este archivo ya tiene escrito —una plantilla
   * equivocada no se distingue de una sana en ningún punto del camino.
   *
   * Medido el 04/09/2026 generando un clip real: `YhhmEf` dispara la generación,
   * `jwpduf` y `ngNC2` son el sondeo (alternados, cada ~2 s), `as29s` trae el medio
   * al final, y `DTaVef` / `NfrxTb` / `ve2Lsc` cargan el proyecto.
   */
  function claseDe(url) {
    try {
      const u = new URL(url, location.origin);
      const rpc = u.searchParams.get('rpcids');
      if (rpc) return 'boq:' + rpc;
      return u.pathname.split('/').filter(Boolean).pop() || '';
    } catch { return ''; }
  }

  function headersAObjeto(h) {
    const out = {};
    try {
      if (!h) return out;
      if (typeof h.forEach === 'function') h.forEach((v, k) => { out[k] = v; });
      else if (Array.isArray(h)) for (const [k, v] of h) out[k] = v;
      else Object.assign(out, h);
    } catch { /* una plantilla incompleta es mejor que romper la página */ }
    return out;
  }

  /** El cuerpo de la plantilla como objeto. Si no era JSON, se ignora. */
  function base(texto) {
    try { const o = JSON.parse(texto); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
    catch { return {}; }
  }

  /**
   * Funde `nuevo` sobre `viejo`, hacia adentro.
   *
   * Tiene que ser profundo: un `{clientContext:{recaptchaContext:…}}` a nivel
   * superficial se lleva puesto el `projectId`, el `tool` y el `userPaygateTier`
   * que venían de Flow — que es exactamente el bug que esto viene a arreglar.
   *
   * Los arrays se reemplazan enteros a propósito: fundir dos listas elemento por
   * elemento produce mezclas que ninguna de las dos partes pidió.
   */
  function fundir(viejo, nuevo) {
    const out = { ...viejo };
    for (const [k, v] of Object.entries(nuevo || {})) {
      const antes = out[k];
      const los2SonObjetos = v && typeof v === 'object' && !Array.isArray(v)
        && antes && typeof antes === 'object' && !Array.isArray(antes);
      out[k] = los2SonObjetos ? fundir(antes, v) : v;
    }
    return out;
  }

  /**
   * Escribe UN valor adentro del cuerpo copiado, siguiendo un camino.
   *
   * `requests.0.structuredPrompt` cambia esa rama y NO toca a sus hermanas. Es lo
   * que `fundir()` no puede hacer: los arrays se reemplazan enteros a proposito,
   * porque fundir dos listas elemento por elemento produce mezclas que ninguna de
   * las dos partes pidio.
   *
   * Pero eso deja un agujero justo donde mas duele. El pedido de imagen de Flow
   * es `{ mediaGenerationContext, useNewMedia, requests: [ {...} ] }`, y adentro
   * de ese unico elemento conviven lo que NOSOTROS decidimos (el prompt, la
   * semilla) con lo que SOLO sabe la plantilla (`imageModelName`, y los
   * `imageInputs` que traen la cara de la persona). Mandar el array a medias
   * pierde el modelo y la cara; mandarlo entero exige inventar los dos, que es
   * exactamente lo que este espejo existe para no hacer.
   *
   * El parche es la tercera salida: se copia TODO y se cambia solo la hoja.
   *
   * Un camino que no existe se CREA (objetos para tramos con nombre, y se respeta
   * el array si el tramo es un numero y el array ya esta). Un tramo numerico sobre
   * algo que no es array no se fuerza: se ignora el parche entero, porque escribir
   * `{"0": ...}` donde el contrato espera una lista produce un pedido que el
   * servidor acepta y contesta cualquier cosa.
   */
  function parchar(cuerpo, camino, valor) {
    // ⚠️ Se RECORTA cada tramo antes de filtrar. Sin esto, un camino de puros
    // espacios ('   ') sobrevivia al filter y escribia una clave con ese nombre
    // adentro del cuerpo: un pedido que sale, que Google acepta, y que ignora el
    // prompt. Lo caza tests/espejo-parchar.test.ts.
    const tramos = String(camino || '').split('.').map((t) => t.trim()).filter(Boolean);
    if (!tramos.length) return false;
    let nodo = cuerpo;
    for (let i = 0; i < tramos.length - 1; i++) {
      const t = tramos[i];
      const esIndice = /^\d+$/.test(t);
      if (esIndice && !Array.isArray(nodo)) return false;
      if (nodo[t] == null || typeof nodo[t] !== 'object') {
        nodo[t] = /^\d+$/.test(tramos[i + 1]) ? [] : {};
      }
      nodo = nodo[t];
    }
    const ultimo = tramos[tramos.length - 1];
    if (/^\d+$/.test(ultimo) && !Array.isArray(nodo)) return false;
    nodo[ultimo] = valor;
    return true;
  }

  /**
   * ¿Se puede contestar este pedido con lo que la página ya recibió?
   *
   * Sale a una función propia porque era un `if` de tres condiciones adentro de un
   * handler de 120 líneas, y ahí NO se puede testear — que es justo lo que hace
   * falta, porque cuando se equivoca no falla: contesta. La respuesta cacheada es
   * de OTRA pregunta, así que devuelve datos plausibles del proyecto del cliente y
   * la pantalla los da por buenos.
   *
   * La regla es una sola: **una respuesta cacheada sólo vale si el pedido no tiene
   * parámetros.** Un cuerpo es un parámetro y un PARCHE también — el más
   * específico que hay. El guard miraba nada más el cuerpo, y por eso el día que
   * la consulta de estado pasó de cuerpo a parches habría vuelto a servir los
   * videos que el dueño generó a mano, que es el bug que ya se pagó una vez.
   */
  function puedeUsarCache(soloLectura, cuerpo, parches, cache, ahora) {
    if (!soloLectura) return false;
    if (cuerpo) return false;
    if (parches && Object.keys(parches).length) return false;
    if (!cache) return false;
    return ahora - cache.cuando < 120000;
  }

  /**
   * La API propia de la app de Flow, en su mismo dominio.
   *
   * ⚠️ SE RECONOCE POR LA RUTA, NO POR EL HOST, y el cambio no es cosmetico.
   *
   * Estaba escrito `labs.google/fx/api/trpc/`. Google mudo Flow a flow.google.com y
   * con eso el espejo dejo de ver la mitad del trafico — justo la mitad de donde sale
   * el ENLACE de un video.
   *
   * Este script solo corre DENTRO de una pagina de Flow, asi que «mismo origen +
   * /api/trpc/» dice exactamente lo que se queria decir —la API de la app que me
   * hospeda— sin nombrar ningun dominio. La proxima mudanza no lo rompe.
   */
  // ⚠️ DOS TRANSPORTES, PORQUE HAY DOS APPS.
  //
  // `/api/trpc/` es el Flow viejo, el de labs.google. El nuevo —BOQ, en
  // flow.google.com— manda TODO por `/_/AiSandboxAngularFrontend/data/batchexecute`,
  // que no tiene nada que ver con esa ruta.
  //
  // Se reconocen por la RUTA y no por el host: este script sólo corre dentro de una
  // página de Flow, así que «mismo origen + una de estas dos rutas» dice exactamente
  // lo que se quiere decir —la API de la app que me hospeda— sin nombrar ningún
  // dominio. Es lo que hizo que la mudanza a flow.google.com no rompiera esta línea,
  // y lo que va a hacer que la próxima tampoco.
  const esApiDeLaApp = (u) => u.includes('/api/trpc/') || u.includes('/data/batchexecute');

  const fetchOriginal = window.fetch;

  window.fetch = function (entrada, init) {
    const promesa = fetchOriginal.apply(this, arguments);
    try {
      const esRequest = typeof Request !== 'undefined' && entrada instanceof Request;
      const url = esRequest ? entrada.url : absoluta(entrada);
      // ⚠️ TAMBIEN LA API PROPIA DE labs.google, y no es una ampliacion menor:
      // es de donde sale el ENLACE de un video.
      //
      // Medido leyendo el DOM de la grilla: los clips se muestran desde
      // `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect`. El espejo
      // filtraba por `aisandbox-pa.googleapis.com` y nunca lo vio — se paso una
      // noche buscando en el trafico equivocado un enlace que la propia pagina
      // pedia a otro dominio.
      //
      // Es el mismo mecanismo, no uno nuevo: se copia el pedido que hace Flow.
      if (!url.includes(API) && !esApiDeLaApp(url)) return promesa;

      const clase = claseDe(url);
      const metodo = String((init && init.method) || (esRequest && entrada.method) || 'GET').toUpperCase();
      const headers = headersAObjeto((init && init.headers) || (esRequest && entrada.headers));
      // ⚠️ EL CUERPO TAMBIEN SE LEE DE UN `Request`, Y NO ES UN DETALLE.
      //
      // La version anterior guardaba el cuerpo solo si `init.body` era un string,
      // con el argumento de que clonar un Request cuesta y puede alterar el pedido
      // de la app. Lo segundo es falso —`clone()` existe justo para esto y el
      // original sigue intacto— y lo primero es despreciable al lado de lo que
      // costaba: si Flow llama `fetch(new Request(url, { body }))`, `init` es
      // `undefined` y quedaba una plantilla CASCARA — url buena, headers buenos,
      // metodo bueno, cuerpo vacio.
      //
      // Y una cascara NO SE DISTINGUE DE UNA PLANTILLA SANA en ningun punto del
      // camino: `SIN_PLANTILLA` no dispara porque la plantilla existe,
      // `PARCHE_FALLO` no dispara porque el parche se puede escribir sobre un
      // objeto vacio, y `base(null)` devuelve `{}` sin quejarse. El pedido sale,
      // Google contesta 400, y el error apunta a nuestro cuerpo cuando lo que
      // falta es todo lo que la plantilla tenia que aportar.
      //
      // Se lee ASINCRONICO y se completa la plantilla cuando llega: el pedido de
      // Flow no espera nada nuestro, y una plantilla que se completa un
      // milisegundo tarde sirve igual — la proxima vez que la usemos es minutos
      // despues.
      const cuerpo = init && typeof init.body === 'string' ? init.body : null;

      const credenciales = (init && init.credentials) || (esRequest && entrada.credentials) || undefined;
      const plantilla = {
        url, metodo, headers, cuerpo, credenciales, cuando: Date.now(),
        // Antes este camino no calculaba `sentinela`: una plantilla de fetch nunca
        // podia declarar que ensenaba, ni ser protegida por la regla de abajo.
        sentinela: codificacionDeLaSentinela(cuerpo),
      };
      // Ver el sitio del XHR: la entrada con ancla no se pisa con una sin ancla.
      const previaF = plantillas.get(clase);
      if (!(previaF && previaF.sentinela && !plantilla.sentinela)) plantillas.set(clase, plantilla);

      // El cuerpo que venia adentro del `Request` se completa cuando llega. Se
      // rellena ESTE objeto y no `plantillas.get(clase)`: si mientras tanto paso
      // otro pedido de la misma clase, el del mapa ya es otro y pisarlo seria
      // meterle el cuerpo de un pedido viejo.
      if (cuerpo == null && esRequest && entrada.body && !entrada.bodyUsed) {
        try {
          entrada.clone().text().then(
            (t) => { if (t && plantilla.cuerpo == null) { plantilla.cuerpo = t; plantilla.sentinela = codificacionDeLaSentinela(t); } },
            () => {},
          );
        } catch { /* si no se puede clonar, la plantilla queda como antes */ }
      }

      // La RESPUESTA se guarda clonada, y solo de lo que es una lectura barata:
      // con esto una consulta de créditos no necesita un pedido nuestro.
      // ⚠️ DE TODO, NO SOLO DE LOS GET.
      //
      // La condicion vieja guardaba la respuesta de los GET, y la grilla del
      // proyecto —que es donde estan los videos con su enlace— NO sale de ningun
      // GET: medido, `sessions` contesta `{}`. O sea que el unico lugar donde
      // podia estar la respuesta era justo el que no se guardaba.
      //
      // Guardar de mas no cambia ninguna decision: la rama que CONTESTA con la
      // cache exige `soloLectura` Y que el pedido no tenga parametros, asi que una
      // respuesta guardada de mas no puede servirse por error.
      if (true) {
        promesa.then((res) => {
          try {
            res.clone().text().then(
              (t) => respuestas.set(clase, { status: res.status, texto: t.slice(0, 20000), cuando: Date.now() }),
              () => {},
            );
          } catch { /* ignorar */ }
        }, () => {});
      }
    } catch { /* NUNCA romper la app de Flow por nuestra captura */ }
    return promesa;
  };

  // ── EL ESPEJO DE XHR, que es por donde habla el Flow NUEVO ──────────────────
  //
  // ⚠️ SIN ESTO EL ESPEJO NO VE NADA EN flow.google.com, Y NO SE QUEJA.
  //
  // Todo lo de arriba engancha `window.fetch`. El Flow viejo lo usaba; el nuevo —la
  // app BOQ de flow.google.com— manda sus `batchexecute` por XMLHttpRequest.
  //
  // Medido el 04/09/2026: con el espejo de `fetch` puesto se generó un clip real y
  // capturó CERO pedidos, con la generación corriendo al 7% en la pantalla de al
  // lado. El mismo espejo sobre XHR capturó nueve en seis segundos.
  //
  // Es la peor forma de fallar que tiene un espejo: no hay error, hay ausencia. Y
  // «no vi ningún pedido» se lee igual que «la app no pidió nada».
  //
  // Alimenta el MISMO mapa de plantillas y con la misma forma, así que todo lo que
  // ya sabe repetir un pedido calcado sirve sin cambiar una línea. La captura de la
  // respuesta va en `onloadend` porque XHR no devuelve una promesa que clonar.
  const XHR_ABRIR = XMLHttpRequest.prototype.open;
  const XHR_HEADER = XMLHttpRequest.prototype.setRequestHeader;
  const XHR_MANDAR = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (metodo, url) {
    try {
      this.__makoUrl = absoluta(url);
      this.__makoMetodo = String(metodo || 'GET').toUpperCase();
      // Los headers se acumulan acá: en XHR se ponen de a uno DESPUÉS de `open()`,
      // así que no hay un objeto que leer como en `fetch`.
      this.__makoHeaders = {};
    } catch { /* nunca romper */ }
    return XHR_ABRIR.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try { if (this.__makoHeaders) this.__makoHeaders[String(k)] = String(v); } catch { /* nunca romper */ }
    return XHR_HEADER.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (cuerpo) {
    try {
      const url = this.__makoUrl || '';
      if (url.includes(API) || esApiDeLaApp(url)) {
        const clase = claseDe(url);
        // ⚠️ El cuerpo se guarda SOLO si es texto. Un `FormData` o un `Blob` no se
        // pueden serializar acá sin leerlos, y leerlos puede consumir el cuerpo que
        // la app está por mandar — romper Flow para mirarlo es exactamente lo que
        // este espejo no puede hacer. BOQ manda form-urlencoded, o sea texto.
        const texto = typeof cuerpo === 'string' ? cuerpo : null;
        // ⚠️ La sentinela se busca sobre el cuerpo ORIGINAL y el `at` se corta
        // DESPUÉS: al revés, la redacción podría partir la frase que estamos
        // buscando y daría «no aprendí» sobre una generación que sí servía.
        // El `at` vivo, para poder repetir un pedido. Se guarda SOLO en memoria de
        // esta pestana y nunca se persiste: es una credencial de la sesion de Google.
        try {
          const mAt = /(?:^|&)at=([^&]*)/.exec(texto || '');
          if (mAt && mAt[1]) ultimoAtVisto = decodeURIComponent(mAt[1]);
        } catch { /* si no se puede leer, queda el de WIZ_global_data */ }
        const sentinela = codificacionDeLaSentinela(texto);
        // ⚠️ UN CUERPO CON ANCLA NO SE PISA CON UNO SIN ANCLA.
        //
        // La frase de aprendizaje se genera UNA vez y cuesta un credito. El pedido
        // siguiente de la misma clase —cualquier video del cliente— traia otro
        // cuerpo, lo reemplazaba, y la plantilla quedaba registrada como aprendida y
        // sin nada que parchear. Medido en produccion: SIN_ANCLA con la sentinela
        // intacta al lado. La entrada con ancla se queda ENTERA (url, headers y
        // cuerpo van juntos: mezclar la url de hoy con el cuerpo de ayer es armar
        // un pedido que ninguna version de Flow mando).
        const previaX = plantillas.get(clase);
        if (previaX && previaX.sentinela && !sentinela) { /* se conserva la que ensena */ } else
        plantillas.set(clase, {
          url,
          metodo: this.__makoMetodo || 'POST',
          headers: this.__makoHeaders || {},
          cuerpo: sinCredenciales(texto),
          sentinela,
          // XHR manda las cookies del mismo origen solo, y BOQ autentica con
          // cookies: repetir el pedido sin esto sería repetirlo sin sesión.
          credenciales: 'include',
          cuando: Date.now(),
        });
        this.addEventListener('loadend', () => {
          try {
            const t = typeof this.responseText === 'string' ? this.responseText : '';
            respuestas.set(clase, { status: this.status, texto: t.slice(0, 20000), cuando: Date.now() });
          } catch { /* una respuesta que no se puede leer no es un error nuestro */ }
        });
      }
    } catch { /* NUNCA romper la app de Flow por nuestra captura */ }
    return XHR_MANDAR.apply(this, arguments);
  };

  // ── reCAPTCHA ─────────────────────────────────────────────────────────────
  // ── El espejo del CAPTCHA ─────────────────────────────────────────────────
  //
  // El espejo ya copia la URL, el metodo, los headers, el cuerpo y el site key.
  // Quedaba UN campo adivinado: el nombre de ACCION con el que se acuna el token.
  //
  // Se derivaba del path (`batchAsyncGenerateVideoReferenceImages`) con un
  // comentario que afirmaba «es exactamente lo que la app pone en su propio
  // execute()». Eso NUNCA se midio, y no se podia: `grecaptcha.execute()` no pasa
  // por `window.fetch`, asi que el espejo de fetch no lo ve.
  //
  // Y reCAPTCHA Enterprise ATA el token a la accion: si no coincide, Google
  // contesta 403 «reCAPTCHA evaluation failed» — el mismo cuerpo que da un token
  // con score bajo. Dos causas, un solo error, y por eso hay que MEDIR en vez de
  // seguir cambiando una suposicion por otra.
  //
  // Esto envuelve `execute` y guarda la accion REAL que usa Flow. Un getter sobre
  // `window.grecaptcha` porque la libreria carga despues de nosotros.
  const accionesVistas = new Map();
  let _grecaptcha;
  // true mientras acunamos NOSOTROS. Sirve para no contar nuestra propia llamada
  // como si fuera de Flow.
  //
  // ⚠️ Antes esto viajaba como una clave extra DENTRO de las opciones de
  // `execute` (`{ action, __mako: true }`), y reCAPTCHA valida ese objeto: contesta
  // «Invalid parameters to grecaptcha.execute» y no acuna nada. Una marca propia
  // NUNCA va adentro del contrato de un tercero.
  let acunandoNosotros = false;

  function envolverGrecaptcha(g) {
    try {
      const e = g && g.enterprise;
      if (!e || typeof e.execute !== 'function' || e.__mako) return g;
      const orig = e.execute.bind(e);
      e.execute = function (siteKey, opciones) {
        try {
          const accion = opciones && opciones.action;
          // Solo se guarda lo que pide FLOW: la medicion no puede contaminarse con
          // lo que nosotros mismos inventamos.
          if (accion && !acunandoNosotros) {
            accionesVistas.set(String(accion), { siteKey: String(siteKey || ''), cuando: Date.now() });
          }
        } catch { /* medir no puede romper la pagina */ }
        return orig(siteKey, opciones);
      };
      e.__mako = true;
    } catch { /* si no se puede envolver, se sigue con la derivada */ }
    return g;
  }

  try {
    Object.defineProperty(window, 'grecaptcha', {
      configurable: true,
      get() { return _grecaptcha; },
      set(v) { _grecaptcha = envolverGrecaptcha(v); },
    });
  } catch { /* si alguien ya la definio no configurable, queda el poll de abajo */ }

  async function esperarGrecaptcha(ms) {
    const hasta = Date.now() + ms;
    while (Date.now() < hasta) {
      const g = window.grecaptcha;
      if (g?.enterprise?.execute) return envolverGrecaptcha(g).enterprise;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  const responder = (evento, id, detail) =>
    window.dispatchEvent(new CustomEvent(evento, { detail: { id, ...detail } }));

  /**
   * El site key que la PAGINA esta usando de verdad.
   *
   * ⚠️ Estaba hardcodeado en dos lugares (extension/background.js y
   * lib/flow-protocolo.ts), y eso es exactamente lo que el espejo existe para no
   * hacer: suponer un dato que la pagina tiene delante. Un token acunado contra
   * un site key que no es el de la app se rechaza con «reCAPTCHA evaluation
   * failed» — el mismo error que da un token con la accion equivocada, y por eso
   * cuesta distinguirlos.
   *
   * Sale del script de reCAPTCHA que la propia pagina cargo: su `src` trae
   * `?render=<sitekey>`. Si por lo que sea no esta, se cae al que mando el service
   * worker, que es lo que habia antes.
   */
  function siteKeyDeLaPagina() {
    try {
      for (const el of document.querySelectorAll('script[src*="recaptcha"]')) {
        const m = /[?&]render=([^&]+)/.exec(el.src || '');
        if (m && m[1] && m[1] !== 'explicit') return decodeURIComponent(m[1]);
      }
    } catch { /* si el DOM no colabora, manda el de siempre */ }
    return null;
  }

  window.addEventListener('MAKO_CAPTCHA_PIDO', async (ev) => {
    const { id, action, siteKey, medida } = ev.detail || {};
    try {
      const g = await esperarGrecaptcha(10000);
      if (!g) return responder('MAKO_CAPTCHA_OK', id, { error: 'SIN_GRECAPTCHA' });
      const clave = siteKeyDeLaPagina() || siteKey;

      // ⚠️ El fallback solo pisa a una accion ADIVINADA, nunca a una MEDIDA.
      //
      // Esto decia: «si Flow no acuno esta accion en la sesion, usa la primera
      // que si acuno». Nacio cuando la accion se derivaba del path —una
      // suposicion— y ahi cualquier cosa vista de verdad era mejor.
      //
      // Con la tabla leida del bundle deja de ser cierto, y de la peor forma: en
      // una sesion donde Flow genero un VIDEO y nosotros pedimos una IMAGEN,
      // `IMAGE_GENERATION` (medida, correcta) perdia contra `VIDEO_GENERATION`
      // (vista, de otro pedido). Un token acunado para otra accion vuelve como
      // 403 «reCAPTCHA evaluation failed», que es el mismo cuerpo que devuelve
      // una sesion quemada — o sea, un dia de diagnostico equivocado.
      //
      // Es el antipatron de siempre con el signo cambiado: lo observado
      // ganandole a lo medido cuando lo observado es de OTRA pregunta.
      const vista = accionesVistas.has(String(action));
      const accionFinal = (vista || medida ? String(action) : [...accionesVistas.keys()][0])
        || action || 'generate';

      acunandoNosotros = true;
      let token;
      try {
        token = await g.execute(clave, { action: accionFinal });
      } finally {
        acunandoNosotros = false;
      }
      responder('MAKO_CAPTCHA_OK', id, {
        token,
        siteKeyUsado: clave,
        accionUsada: accionFinal,
        // Con qué acciones vio Flow acunar: es LA medicion que faltaba.
        accionesDeFlow: [...accionesVistas.keys()],
      });
    } catch (e) {
      responder('MAKO_CAPTCHA_OK', id, { error: String(e?.message || e) });
    }
  });

  // ── Qué vimos: lo que el service worker necesita para decidir ─────────────
  /**
   * Las plantillas ENTERAS, para que el service worker las guarde.
   *
   * Distinto de `MAKO_ESPIA_PIDO`, que manda solo los NOMBRES de los headers para
   * diagnosticar. Acá hace falta el pedido completo, porque el día de mañana hay
   * que repetirlo.
   *
   * Lo que NO sale: el `authorization`, que se repone fresco en cada pedido, y el
   * token de reCAPTCHA, que se acuña en el momento y vencido no sirve para nada.
   * Guardar un token vencido es cargar con una credencial sin ganar nada.
   */
  window.addEventListener('MAKO_GUARDAR_PIDO', (ev) => {
    const { id } = ev.detail || {};
    const out = [];
    for (const [clase, p] of plantillas) {
      // ⚠️ SIN sensibilidad a mayusculas. `delete headers.authorization` NO borra
      // `Authorization`, que es como lo manda Flow — y el resultado era que el
      // BEARER quedaba guardado en chrome.storage.local, justo lo contrario de lo
      // que promete el comentario de background.js. Una credencial guardada por
      // un borrado que no borraba.
      const headers = {};
      for (const [k, v] of Object.entries(p.headers || {})) {
        if (k.toLowerCase() !== 'authorization') headers[k] = v;
      }
      let cuerpo = p.cuerpo;
      if (cuerpo) {
        try {
          const o = JSON.parse(cuerpo);
          if (o && o.clientContext) {
            // Se borra el TOKEN, no el objeto. La version anterior tiraba el
            // `recaptchaContext` entero y con el `applicationType:
            // RECAPTCHA_APPLICATION_TYPE_WEB`, que NO es una credencial: es una
            // constante del contrato. Un pedido sin ella declara un tipo de
            // aplicacion sin especificar, que es literalmente lo que reporta
            // «reCAPTCHA evaluation failed».
            if (o.clientContext.recaptchaContext) delete o.clientContext.recaptchaContext.token;
            // ⚠️ El `sessionId` se CONSERVA. Borrarlo parecia lo prudente —no
            // mandar el de ayer— pero AUSENTE es mas anomalo que viejo: el mismo
            // id viaja vivo en los eventos del frontend de Flow, asi que Google ve
            // una sesion activa y una generacion que dice no tener ninguna.
          }
          cuerpo = JSON.stringify(o);
        } catch { /* si no era JSON, va como vino */ }
      }
      // ⚠️ `sentinela` VA EN LA LISTA, Y FALTABA.
      //
      // Este objeto se arma campo por campo, así que todo lo que no esté nombrado acá
      // se pierde al guardar — aunque el espejo lo haya capturado bien. `sentinela`
      // se escribía en la captura y moría en esta línea: `aprendioGenerar` leía
      // `undefined` siempre, y el popup pedía generar de nuevo por más clips que la
      // persona pagara.
      //
      // Es «escribir la salida no es ofrecerla», la lección que ESTE archivo ya tiene
      // escrita — cometida en el archivo que la documenta. Y falla del modo más caro:
      // la captura anda, el guardado anda, y lo único que no llega es el campo que
      // decide. Nada da error.
      out.push({
        clase, url: p.url, metodo: p.metodo, headers, cuerpo,
        credenciales: p.credenciales,
        sentinela: p.sentinela ?? null,

      });
    }
    responder('MAKO_GUARDAR_OK', id, { plantillas: out });
  });

  /**
   * Lo que Flow YA RECIBIO, por su propio canal.
   *
   * ⚠️ Aparte del espia, y no por prolijidad: el `detalle` del espia se corta a
   * 7500 caracteres y las clases que GENERAN van primero a proposito. Sus cuerpos
   * llegan a 4000 cada uno, asi que dos de ellas se comen el presupuesto entero y
   * TODO lo demas desaparece — incluida la muestra que se agrego para saber de
   * donde sale el enlace de un video. Se instrumento, se desplego, y el dato no
   * llego nunca: lo borro el orden que yo mismo puse.
   *
   * Un canal compartido con un tope es un canal donde lo ultimo que se agrega es
   * lo primero que se pierde.
   */
  /**
   * ¿Cual de las variantes de `getMediaUrlRedirect` trae el VIDEO?
   *
   * ⚠️ SE MIDE, NO SE ADIVINA, y la diferencia ya costo una noche. El enum de
   * `mediaUrlType` no esta documentado en ningun lado que tengamos, y probar
   * valores contra produccion de a uno es exactamente el bucle que hay que evitar.
   *
   * El navegador es el unico que puede contestar sin ambiguedad: se crea un
   * `<video>` suelto —nunca se agrega al documento— con cada candidato y se espera
   * su `loadedmetadata`. Si vuelve con `duration > 0` y `videoWidth > 0`, eso ES el
   * video. Si es una imagen, el elemento la acepta y contesta duracion 0, que es
   * exactamente el sintoma que reporto el dueño: «me trajo un video, pero es de 0
   * segundos».
   *
   * Un elemento de medio no necesita CORS para cargar, asi que esto funciona donde
   * un `fetch` se choca contra el redirect a otro origen.
   *
   * No reproduce nada: `preload='metadata'` trae los primeros bytes y corta.
   */
  /**
   * Provoca el pedido del medio para que `webRequest` vea a donde redirige.
   *
   * Un <video> suelto —nunca se agrega al documento— con `preload='metadata'`:
   * pide los primeros bytes y corta. No reproduce nada y no descarga el archivo
   * entero.
   *
   * No devuelve el enlace: el que lo ve es el service worker. Aca solo se
   * dispara el pedido y se avisa cuando el elemento ya cargo algo.
   */
  window.addEventListener('MAKO_ENLACE_PIDO', (ev) => {
    const { id, mediaId } = ev.detail || {};
    const url = 'https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=' + encodeURIComponent(mediaId || '');
    let el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    const cerrar = (dato) => {
      try { el.removeAttribute('src'); el.load(); } catch { /* ignorar */ }
      el = null;
      responder('MAKO_ENLACE_OK', id, dato);
    };
    const reloj = setTimeout(() => cerrar({ estado: 'timeout' }), 15000);
    el.addEventListener('loadedmetadata', () => {
      clearTimeout(reloj);
      cerrar({ estado: 'ok', duracion: Number(el.duration) || 0 });
    }, { once: true });
    el.addEventListener('error', () => {
      clearTimeout(reloj);
      cerrar({ estado: 'error', codigo: el && el.error ? el.error.code : 0 });
    }, { once: true });
    el.src = url;
  });

  window.addEventListener('MAKO_SONDA_PIDO', async (ev) => {
    const { id, mediaId, variantes } = ev.detail || {};
    const base = 'https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=' + encodeURIComponent(mediaId || '');
    const lista = Array.isArray(variantes) && variantes.length ? variantes : [''];

    // ⚠️ TODOS A LA VEZ, no uno tras otro.
    //
    // En serie son ocho candidatos por doce segundos: hasta 96 s con el service
    // worker esperando, y un service worker MV3 se duerme mucho antes. La sonda
    // no llegaba a contestar nunca. En paralelo tarda lo que tarda el mas lento.
    const out = await Promise.all(lista.map((v) => {
      const url = v ? base + '&mediaUrlType=' + encodeURIComponent(v) : base;
      return new Promise((resolve) => {
        let el = document.createElement('video');
        el.preload = 'metadata';
        el.muted = true;
        const cerrar = (dato) => {
          try { el.removeAttribute('src'); el.load(); } catch { /* ignorar */ }
          el = null;
          resolve(dato);
        };
        const reloj = setTimeout(() => cerrar({ variante: v || '(sin parametro)', estado: 'timeout' }), 8000);
        el.addEventListener('loadedmetadata', () => {
          clearTimeout(reloj);
          cerrar({
            variante: v || '(sin parametro)',
            estado: 'ok',
            duracion: Number(el.duration) || 0,
            ancho: el.videoWidth || 0,
            alto: el.videoHeight || 0,
          });
        }, { once: true });
        el.addEventListener('error', () => {
          clearTimeout(reloj);
          const c = el && el.error ? el.error.code : 0;
          cerrar({ variante: v || '(sin parametro)', estado: 'error', codigo: c });
        }, { once: true });
        el.src = url;
      });
    }));
    // ⚠️ Y LA PREGUNTA QUE AHORA IMPORTA: se pueden LEER los bytes desde aca?
    //
    // Medido: esa url contesta 401 «No session found» sin la cookie de Google, asi
    // que pintarla en un <video> de nuestro dominio no puede funcionar nunca. El
    // clip hay que BAJARLO desde esta pagina, que si tiene la sesion.
    //
    // Lo unico que falta saber para construir eso es si el `fetch` puede leer la
    // respuesta: el endpoint es mismo origen, pero REDIRIGE a otro host, y si ese
    // host no manda CORS el fetch tira. Se pregunta una vez y se sabe.
    let bytes = null;
    try {
      const r = await fetch(base, { credentials: 'include' });
      const b = await r.blob();
      bytes = {
        estado: 'ok', status: r.status, tipo: r.type,
        contentType: b.type || r.headers.get('content-type') || '',
        tamano: b.size, urlFinal: String(r.url || '').slice(0, 200),
      };
    } catch (e) {
      bytes = { estado: 'error', mensaje: String((e && e.message) || e).slice(0, 200) };
    }

    responder('MAKO_SONDA_OK', id, { sonda: out, bytes });
  });

  window.addEventListener('MAKO_RESPUESTAS_PIDO', (ev) => {
    const { id } = ev.detail || {};
    const out = {};
    for (const [clase, r] of respuestas) {
      out[clase] = String(r.texto || '').slice(0, 1400);
    }

    // ⚠️ Y SE LE PREGUNTA AL DOM, que es la fuente que no puede mentir.
    //
    // La respuesta del estado dice que el clip esta hecho y no trae enlace;
    // ninguna respuesta guardada lo tiene. Pero la pagina LOS ESTA MOSTRANDO, asi
    // que el enlace existe y esta en un atributo. Se leen los `src` de los medios
    // y se manda su FORMA —origen y camino, sin query— para saber de que endpoint
    // bajarlos.
    //
    // Sin el query a proposito: ahi viajan los tokens de firma. Para saber DE
    // DONDE se baja alcanza con el camino, y una firma en nuestra base es una
    // credencial que no necesitamos.
    const fuentes = [];
    try {
      // ⚠️ LOS VIDEOS PRIMERO, Y NO ES ORDEN: ES QUE LLEGUEN.
      //
      // `querySelectorAll('video, img')` devuelve en orden del DOCUMENTO, asi que
      // las decenas de miniaturas de la grilla salen antes que el reproductor — y
      // el corte de la lista se las come todas menos las primeras. Se pidio dos
      // veces el dato y las dos veces llego la parte que no servia.
      //
      // Es la misma forma que ya mordio hoy con el `detalle` del espia: un
      // presupuesto compartido donde lo que hace falta va ultimo.
      const orden = [
        ...document.querySelectorAll('video'),
        ...document.querySelectorAll('video source'),
        ...document.querySelectorAll('img'),
      ];
      for (const el of orden) {
        const src = el.currentSrc || el.src || el.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) continue;
        let forma = src;
        try {
          const u = new URL(src, location.href);
          // ⚠️ CON QUERY solo para la API propia de Flow: ahi el query son los
          // PARAMETROS del pedido (que medio se pide), no una firma. Sin eso no se
          // puede saber como se le pregunta. Para todo lo demas —fife urls,
          // avatares— el query si lleva firmas y se corta.
          forma = u.host === 'labs.google' && u.pathname.startsWith('/fx/api/trpc/')
            ? `${u.protocol}//${u.host}${u.pathname}${u.search}`.slice(0, 600)
            : `${u.protocol}//${u.host}${u.pathname}`;
        } catch { /* blob: y demas van tal cual */ }
        // El tag delante: con veinte urls parecidas, saber cual salio de un
        // <video> es la mitad de la respuesta.
        const etiquetado = `${el.tagName.toLowerCase()} ${forma}`;
        if (!fuentes.includes(etiquetado)) fuentes.push(etiquetado);
        if (fuentes.length >= 25) break;
      }
    } catch { /* nunca romper la pagina de Flow por mirarla */ }

    responder('MAKO_RESPUESTAS_OK', id, { respuestas: out, fuentes });
  });

  window.addEventListener('MAKO_ESPIA_PIDO', (ev) => {
    const { id } = ev.detail || {};
    const visto = {};
    for (const [clase, p] of plantillas) {
      // Los headers van con el NOMBRE pero sin el VALOR de lo que autentica: para
      // decidir qué falta alcanza con saber cuáles son, y así no se transporta una
      // credencial a ningún lado.
      visto[clase] = {
        metodo: p.metodo,
        hayRespuesta: respuestas.has(clase),
        url: p.url.replace(/key=[^&]+/, 'key=<oculta>'),
        headers: Object.keys(p.headers).sort(),
        // ⚠️ El dato que separa «la plantilla no existe» de «existe y esta
        // vacia». Son dos diagnosticos con dos arreglos distintos y hasta ahora
        // se veian iguales desde el servidor.
        tieneCuerpo: p.cuerpo != null,
        esCascara: p.cuerpo == null && p.metodo !== 'GET' && p.metodo !== 'HEAD',
        // De los pedidos que GENERAN va el cuerpo entero: es el contrato que hay
        // que replicar, y una muestra cortada esconde justo el campo que falta.
        // Del resto alcanza con saber que existen.
        // ⚠️ `/generat/i` y no `/generate|Generate/`. La clase de la consulta de
        // estado es `video:batchCheckAsyncVideoGenerationStatus`: dice
        // «Generation», no «Generate», asi que caia en la rama de 200 caracteres
        // y su cuerpo —el contrato que hay que replicar— llegaba decapitado.
        // Una muestra cortada esconde justo el campo que falta, que es lo que el
        // comentario de al lado ya decia y el regex no cumplia.
        cuerpoMuestra: p.cuerpo
          ? p.cuerpo.slice(0, /generat/i.test(clase) ? 4000 : 200)
          : null,
        edadMs: Date.now() - p.cuando,
      };
    }
    responder('MAKO_ESPIA_OK', id, { visto });
  });

  // ── Nuestro pedido, calcado de la plantilla ───────────────────────────────
  /**
   * El `at` VIVO de esta sesion de BOQ.
   *
   * ⚠️ MEDIDO el 06/09/2026 en flow.google.com: `window.WIZ_global_data.SNlM0e`
   * existe, tiene 42 caracteres y contiene `:` — la forma exacta del token que la
   * app manda en `at=`. Es la ubicacion canonica de una app BOQ.
   *
   * No se guarda NUNCA: es una credencial de la sesion de Google del cliente, y por
   * eso `sinCredenciales` la borra antes de persistir la plantilla. Se lee fresca en
   * el momento de repetir el pedido, que es la unica forma de que valga.
   *
   * Respaldo: el ultimo `at` que el espejo vio pasar. Si la app acaba de usarlo, es
   * bueno — y si `WIZ_global_data` cambiara de forma, esto sigue andando.
   */
  let ultimoAtVisto = null;
  function atVivo() {
    try {
      const w = window.WIZ_global_data;
      const t = w && typeof w.SNlM0e === 'string' ? w.SNlM0e : '';
      if (t) return t;
    } catch { /* sigue al respaldo */ }
    return ultimoAtVisto;
  }

  /**
   * Repite un pedido de BOQ con el cuerpo que arma el service worker.
   *
   * ⚠️ SALE DESDE LA PAGINA Y NO DESDE LA EXTENSION, y no es una preferencia: BOQ
   * autentica por COOKIE con `x-same-domain`. Un fetch de extension manda otro
   * `Origin` y Google lo rechaza — eso ya esta medido en este repo.
   *
   * Lo unico que esta funcion pone de su lado es el `at` fresco. El cuerpo viene
   * armado y parcheado: quien decide QUE se pide es el service worker, que es donde
   * vive el catalogo y donde se puede probar.
   */
  window.addEventListener('MAKO_BOQ_PIDO', async (ev) => {
    const { id, url, cuerpo } = ev.detail || {};
    // ⚠️ `salio` SE DECLARA ACA, AFUERA DEL TRY, Y ESO ES LO QUE LO SALVA.
    //
    // Vivia adentro del `try`, asi que el `catch` de abajo —el que atrapa todo lo
    // que no sea el fetch— no lo veia: por scope, no por olvido. El caso concreto
    // es `await res.text()` fallando con la conexion cortada a mitad del cuerpo:
    // Google YA acepto el pedido y ya cobro el credito, y la respuesta salia como
    // `EXCEPCION` sin `salio` — o sea, indistinguible de un pedido que nunca sucedio.
    // El worker lo reintentaba y el cliente pagaba el mismo video otra vez.
    let salio = false;
    try {
      if (typeof url !== 'string' || typeof cuerpo !== 'string' || !url || !cuerpo) {
        return responder('MAKO_BOQ_OK', id, { error: 'PEDIDO_INCOMPLETO' });
      }
      const at = atVivo();
      // ⚠️ Sin `at` NO se manda. Un pedido sin el token anti-CSRF lo rechaza Google
      // con un error que se lee como un problema de la cuenta del cliente, y ademas
      // no hay nada que reintentar: hace falta que la pagina lo tenga.
      if (!at) return responder('MAKO_BOQ_OK', id, { error: 'SIN_AT' });

      const conAt = cuerpo.replace(/__MAKO_AT__/g, encodeURIComponent(at));
      if (conAt === cuerpo && !/(^|&)at=/.test(cuerpo)) {
        // La plantilla no tiene donde poner el `at`. Mandarla asi es gastar un
        // credito para que Google conteste que no.
        return responder('MAKO_BOQ_OK', id, { error: 'PLANTILLA_SIN_AT' });
      }

      // ⚠️ `salio` es el dato que decide si se puede reintentar. Se pone JUSTO antes
      // del await: todo lo que falle despues de esto ya gasto el credito, y un
      // reintento ahi es cobrarle dos veces al cliente por un video.
      let res;
      try {
        salio = true;
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-same-domain': '1',
          },
          body: conAt,
          credentials: 'include',
        });
      } catch (e) {
        return responder('MAKO_BOQ_OK', id, { error: 'RED', salio, detalle: String(e && e.message || e) });
      }
      const texto = await res.text();
      return responder('MAKO_BOQ_OK', id, {
        ok: res.ok,
        status: res.status,
        salio,
        // Recortado: la respuesta de una generacion trae el media entero.
        texto: String(texto || '').slice(0, 20000),
      });
    } catch (e) {
      return responder('MAKO_BOQ_OK', id, { error: 'EXCEPCION', salio, detalle: String(e && e.message || e) });
    }
  });

  window.addEventListener('MAKO_FETCH_PIDO', async (ev) => {
    const { id, clase, cuerpo, parches, path, soloLectura, bearer, respaldo } = ev.detail || {};
    try {
      // ── Lectura: si Flow ya lo preguntó, se usa SU respuesta ───────────────
      // Cero tráfico nuestro. El pedido que la produjo lo hizo la app.
      //
      // ⚠️ La condición es `soloLectura` y NO `!cuerpo`: `cuerpo` SIEMPRE llega
      // con algo (el `clientContext` que le agrega el service worker), así que
      // preguntar por él dejaba esta rama muerta sin que nada avisara.
      // ⚠️ La cache SOLO sirve para pedidos sin cuerpo.
      //
      // Se guardaba la respuesta que la propia pagina recibio para esa clase y se
      // devolvia como si fuera la nuestra. Para `/v1/credits` —un GET pelado— eso
      // es correcto: la respuesta no depende de nada nuestro. Para el estado de un
      // clip es directamente otra pregunta: devolvia los videos que el dueno habia
      // generado a mano y nunca los nuestros.
      //
      // La regla que queda: una respuesta cacheada solo vale si el pedido no tiene
      // parametros. Con cuerpo, cada pedido es una pregunta distinta.
      const cache = respuestas.get(clase);
      if (puedeUsarCache(soloLectura, cuerpo, parches, cache, Date.now())) {
        return responder('MAKO_FETCH_OK', id, {
          status: cache.status, texto: cache.texto, deCache: true, metodo: 'CACHE',
        });
      }

      // La de ESTA sesión primero; si la pestaña se recargó recién, la que el
      // service worker guardó de una sesión anterior.
      //
      // ⚠️ Que exista respaldo NO es «reconstruir el pedido a mano», que es lo que
      // no funcionó cinco veces: es el MISMO pedido que hizo Flow, copiado tal
      // cual, solo que visto hace un rato en vez de hace un minuto. Lo que sigue
      // sin inventarse es la forma.
      const plantilla = plantillas.get(clase) || (respaldo && respaldo.clase === clase ? respaldo : null);
      if (!plantilla) {
        return responder('MAKO_FETCH_OK', id, { error: `SIN_PLANTILLA:${clase}` });
      }

      // ── La URL sale de la PLANTILLA, no de nosotros ────────────────────────
      // Este era el agujero: se recibía una url ya armada y le ganaba a la real,
      // con lo cual «copiar el pedido» copiaba todo menos lo único que importaba.
      //
      // De la plantilla se toma el ORIGEN y el QUERY (ahí viven `?key=` y lo que
      // Flow mande el día que agregue algo). El path se reemplaza SOLO si este
      // pedido apunta a otro recurso — un `credits` se pide igualito, un
      // `video:batchAsyncGenerateVideo` cambia de path pero conserva el query.
      //
      // Y el `?key=` deja de pegarse a todo: medido, Flow lo manda ÚNICAMENTE en
      // `credits`; `checkAppAvailability`, `fetchUserRecommendations` y
      // `batchLogFrontendEvents` viajan sin él. Agregarlo donde la app no lo pone
      // es volver a inventar.
      // ⚠️ LA URL SE COPIA ENTERA. El `path` que manda el service worker sirve
      // para ENCONTRAR la plantilla (de él sale la `clase`), nunca para
      // reescribirla.
      //
      // Antes había un `if (path && !plantilla.url.includes(path)) url.pathname
      // = path`, y con el endpoint de imágenes eso era una bomba: su path lleva
      // el projectId adentro (`/v1/projects/<id>/flowMedia:batchGenerateImages`),
      // nosotros NO lo sabemos —solo se aprende de URLs que Flow no hace— y la
      // condición daba verdadera justamente porque los ids no coincidían. O sea:
      // habría pisado el projectId REAL de la plantilla con uno inventado.
      //
      // Y no se pierde nada, porque la `clase` sale del último tramo del path:
      // dos pedidos con paths distintos son dos clases distintas y por lo tanto
      // dos plantillas distintas. La que se encontró YA es la de este endpoint.
      const url = new URL(plantilla.url);

      // ⚠️ El `Authorization` de la plantilla se saca ANTES de poner el nuestro.
      // Sin esto quedaban los dos —`Authorization` de Flow y `authorization`
      // nuestro— y el constructor `Headers` los CONCATENA en uno solo:
      // «Bearer VIEJO, Bearer NUEVO». Medido en node. Flow nunca manda eso.
      const headers = {};
      for (const [k, v] of Object.entries(plantilla.headers || {})) {
        if (k.toLowerCase() !== 'authorization') headers[k] = v;
      }
      if (bearer) headers.authorization = `Bearer ${bearer}`;
      else if (plantilla.headers) {
        for (const [k, v] of Object.entries(plantilla.headers)) {
          if (k.toLowerCase() === 'authorization') headers[k] = v;
        }
      }

      // El VERBO también sale de la plantilla. Acá estaba la causa medida del 403:
      // `/v1/credits` es un GET y le mandábamos POST.
      const metodo = plantilla.metodo;
      const llevaCuerpo = metodo !== 'GET' && metodo !== 'HEAD';
      if (!llevaCuerpo) delete headers['content-type'];

      // ── El cuerpo se FUNDE con el de la plantilla ──────────────────────────
      // Medido: el `clientContext` que manda Flow trae `userPaygateTier` y más
      // campos que nosotros ni sabíamos que existían. Mandar el nuestro PISABA
      // todo eso — o sea que el espejo copiaba el sobre y tiraba la carta.
      //
      // Ahora la base es lo que manda la app y encima va solo lo que cambia: el
      // prompt y el token del captcha. Lo que no sabemos que existe viaja igual,
      // que es el punto entero de copiar en vez de reconstruir.
      const cuerpoFinal = llevaCuerpo ? fundir(base(plantilla.cuerpo), cuerpo || {}) : null;

      // Los PARCHES van despues de fundir: son lo mas especifico que se dijo sobre
      // este pedido, asi que ganan. Si alguno no se pudo aplicar, el pedido NO
      // sale: un prompt que no llego a destino produce una imagen perfecta del
      // escenario equivocado, y eso no se ve como un error — se ve como una imagen.
      if (cuerpoFinal && parches && typeof parches === 'object') {
        for (const [camino, valor] of Object.entries(parches)) {
          if (!parchar(cuerpoFinal, camino, valor)) {
            return responder('MAKO_FETCH_OK', id, { error: `PARCHE_FALLO:${camino}` });
          }
        }
      }

      const res = await fetchOriginal.call(window, url.toString(), {
        method: metodo,
        headers,
        // Se copia de la plantilla en vez de clavarlo: `credentials` decide si el
        // navegador acepta la respuesta, así que es justo el campo que no se puede
        // suponer.
        // El fallback era `'include'`, que es el valor MAS distinto del default
        // del navegador: adjuntaba el frasco de cookies a googleapis.com donde el
        // pedido de Flow no lo hace. Se copia, y si no hay dato se usa el default.
        credentials: plantilla.credenciales || 'same-origin',
        ...(llevaCuerpo ? { body: JSON.stringify(cuerpoFinal) } : {}),
      });
      // El texto crudo viaja tal cual: si Google contesta HTML en vez de JSON, eso
      // ES el dato — es lo que delata un bloqueo, y parsearlo acá lo perdería.
      responder('MAKO_FETCH_OK', id, {
        status: res.status, texto: (await res.text()).slice(0, 20000),
        metodo, urlUsada: url.pathname + url.search.replace(/key=[^&]+/, 'key=<oculta>'),
      });
    } catch (e) {
      responder('MAKO_FETCH_OK', id, { error: String(e?.message || e) });
    }
  });
})();
