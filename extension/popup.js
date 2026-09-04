// =============================================================================
// Los cuatro pasos, adentro del popup
// =============================================================================
// El orden de las condiciones ES el diseño: se pregunta de lo más bloqueante a
// lo menos, y gana la primera. Nunca se pintan dos problemas a la vez, porque
// arreglar el de abajo no sirve mientras el de arriba siga.
//
//   paso 1  Instalar          → NO vive acá. Es una tautología: el popup es una
//                               página de la extensión y no existe antes de
//                               instalarla. Ese aviso queda en la web.
//   paso 2  Conectar          → botón `Conectar`. El token lo acuña la PÁGINA de
//                               MaKo con la sesión del usuario; desde acá sale el
//                               disparo y vuelve el resultado.
//   paso 3  Abrir Google Flow → acá mejora: el popup VE la pestaña, la enfoca y
//                               la recarga él mismo. La web solo podía pedirlo.
//   paso 4  Créditos          → se consulta contra la pestaña de Flow, sin dar la
//                               vuelta por la cola de MaKo.

const ORIGEN_MAKO = 'https://hola-mako.com';
const MAKO = `${ORIGEN_MAKO}/video-generator`;

const $ = (id) => document.getElementById(id);

/** Un solo lugar arma la pantalla: título, línea tenue y como máximo un botón. */
function pantalla({ titulo, numero, tenue, pasos, boton, accion, suave, boton2, accion2 }) {
  const cuerpo = $('cuerpo');
  cuerpo.textContent = '';

  const h = document.createElement('h1');
  if (numero) h.className = 'numero';
  h.textContent = titulo;
  cuerpo.appendChild(h);

  if (tenue) {
    const p = document.createElement('div');
    p.className = 'tenue';
    p.textContent = tenue;
    cuerpo.appendChild(p);
  }

  // Los pasos van ANTES de los botones: el primer boton es el paso 1, asi que
  // leerlos despues seria leer la receta despues de empezar a cocinar.
  if (pasos && pasos.length) {
    const ol = document.createElement('ol');
    ol.className = 'pasos';
    for (const p of pasos) {
      const li = document.createElement('li');
      // Los pasos traen **negrita** para lo que NO se puede saltear. Se arma por
      // NODOS y no con innerHTML: es texto nuestro, pero un popup que interpreta
      // HTML es una puerta que no hace falta abrir.
      //
      // ⚠️ El indice sale de `entries()`, NO de `indexOf`: `indexOf` devuelve la
      // PRIMERA coincidencia, asi que dos tramos con el mismo texto —«la» dos
      // veces en la misma frase— habrian tomado los dos el indice del primero, y
      // la negrita habria caido en el pedazo equivocado sin que nada falle.
      for (const [i, t] of p.split('**').entries()) {
        if (!t) continue;
        li.appendChild(i % 2
          ? Object.assign(document.createElement('b'), { textContent: t })
          : document.createTextNode(t));
      }
      ol.appendChild(li);
    }
    cuerpo.appendChild(ol);
  }

  const poner = (texto, fn, esSuave) => {
    const b = document.createElement('button');
    if (esSuave) b.className = 'suave';
    b.textContent = texto;
    b.addEventListener('click', () => {
      // Se apaga en el acto: el popup vive mientras tiene foco y un segundo clic
      // dispararía dos veces la misma cosa —dos tokens, dos pestañas de Flow—.
      b.disabled = true;
      b.textContent = 'Un momento…';
      fn();
    });
    cuerpo.appendChild(b);
  };
  if (boton) poner(boton, accion, suave);
  if (boton2) poner(boton2, accion2, true);
}

function esperando(titulo) {
  pantalla({ titulo });
}

const enviar = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (out) => {
  // Leer `lastError` no es cosmético: si el service worker estaba dormido y no
  // contesta, Chrome lo escupe como error sin capturar en la consola.
  void chrome.runtime.lastError;
  r(out || null);
}));

/** El motivo por el que la página no pudo acuñar, en una frase. */
const POR_QUE = {
  sesion: 'Inicia sesión en MaKo y vuelve a intentar.',
  rol: 'Solo quien administra la cuenta puede conectar un navegador.',
  sin_ws: 'Abre un cliente en MaKo y vuelve a intentar.',
  // ⚠️ «No contestó» tiene su propio remedio, y no es iniciar sesión. La página
  // está abierta y la sesión puede estar perfecta: lo que no respondió es el
  // enlace, y eso se arregla recargando.
  sin_enlace: 'Tu pestaña de MaKo no respondió. Se recarga y se vuelve a intentar.',
  // ⚠️ Su remedio NO es reintentar. La pestaña quedó de antes de un deploy y llama a
  // una server action que ya no existe; apretar «Volver a intentar» falla igual las
  // veces que se apriete. Se recarga.
  pagina_vieja: 'Tu pestaña de MaKo quedó de antes de una actualización. Se recarga y se vuelve a intentar.',
  error: 'Vuelve a intentar en un momento.',
};

/** El título de la pantalla de fallo. `sin_enlace` no habla de conectar nada. */
const TITULO_FALLO = {
  sin_enlace: 'Recarga tu pestaña de MaKo',
  // ⚠️ «No se pudo conectar» y no «Termina de conectar en MaKo»: lo segundo
  // afirma que falta un paso EN MAKO, y con el catch viejo ese motivo se emitía
  // para cualquier excepción. Una clienta logueada y con su pestaña abierta leyó
  // durante horas que le faltaba iniciar sesión.
  sesion: 'Inicia sesión en MaKo',
  pagina_vieja: 'Recarga tu pestaña de MaKo',
  error: 'No se pudo conectar',
};

async function pintar() {
  const v = await enviar({ tipo: 'ESTADO' });
  if (!v) { pantalla({ titulo: 'Reinicia el navegador', tenue: 'La extensión no responde.' }); return; }

  $('version').textContent = 'v' + v.version;
  $('ws').textContent = v.workspace || '';

  const latido = v.ultimoLatido || null;

  // ── Paso 0: la version ─────────────────────────────────────────────────
  // ⚠️ VA PRIMERO Y NO DEJA PASAR. El dueño: «que no te deje avanzar hasta que
  // tengas la última versión».
  //
  // No es celo: una extensión vieja no falla ruidoso, falla CALLADA. La 0.37.x
  // se apagaba sola al detectar que había una versión nueva —reiniciándose para
  // leer la misma carpeta vieja— y el puente no volvía nunca; el cliente veía un
  // clip generándose para siempre. Dejar «seguir igual» sería ofrecer un camino
  // que ya sabemos que termina ahí.
  //
  // La comparación la hizo `background.js` con `esMasVieja`, que compara ORDENADO
  // y no por `!==`: una instalación que va ADELANTE —la máquina de desarrollo,
  // los minutos entre el push y el deploy— no es vieja y no se frena.
  //
  // ⚠️ Y ESTO NO ALCANZA A QUIEN YA TIENE LA VERSIÓN VIEJA. Su popup es el
  // viejo, que no tiene esta pantalla. A esa persona la alcanza `AvisoExtensionVieja`
  // en la web, que la renderiza el server. Las dos piezas dicen lo mismo a
  // públicos distintos y por eso existen las dos.
  if (v.versionVieja) {
    pantalla({
      titulo: 'Actualiza la extensión',
      tenue: `Tienes la ${v.version} y la actual es la ${v.versionEsperada}. `
        + 'Con la vieja, un video puede quedarse generando para siempre.',
      // ⚠️ SE QUITA LA VIEJA Y SE CARGA LA NUEVA, no se «reemplazan los archivos».
      // Esa instrucción tiene un paso que quien la ejecuta NO PUEDE VERIFICAR
      // —cuál es «la misma carpeta»— y ya falló tres veces, una de ellas
      // costándole el día al dueño: Chrome tenía cargada una copia congelada en
      // otra ruta mientras él reemplazaba los archivos del repo.
      //
      // Reinstalar no tiene ese paso: la carpeta que se elige en «Cargar
      // descomprimida» ES la que Chrome carga. Y no cuesta nada — el token vuelve
      // con un clic y las plantillas las repone el servidor en el primer latido.
      pasos: [
        'Toca **Ver los pasos**: ahí está el detalle y el archivo.',
        'En **chrome://extensions**, quita MaKo y vuelve a cargarla descomprimida.',
        'Vuelve aquí: abajo tiene que decir **v' + v.versionEsperada + '**.',
      ],
      boton: 'Ver los pasos',
      accion: bajarNueva,
    });
    return;
  }

  // ── Conectar (paso 2) ──────────────────────────────────────────────────
  // ⚠️ «Conectando…» NO PUEDE SER PARA SIEMPRE. Es una pantalla sin botón colgada
  // de un flag que apaga `finEmparejado`, o sea el mismo proceso que se puede
  // morir: el service worker de MV3 se duerme, y `conectar()` espera hasta 12 s a
  // que la página conteste. Si lo matan en el medio, el flag queda en `true` y el
  // popup se queda en «Conectando…» sin nada que tocar, para siempre.
  //
  // Pasados los 30 s no se está conectando: se murió. Y ahí lo que corresponde es
  // ofrecer el reintento, no seguir contando una espera que ya no existe.
  if (v.emparejando) {
    const desde = Number(v.emparejandoDesde) || 0;
    if (!desde || Date.now() - desde < 30000) { esperando('Conectando…'); return; }
    pantalla({
      titulo: 'Se cortó a mitad de camino',
      tenue: 'El navegador cerró la extensión antes de terminar. Vuelve a intentar.',
      boton: 'Conectar',
      accion: () => void conectar(false),
    });
    return;
  }

  // ⚠️ UN ERROR VIEJO NO ES EL ESTADO DE AHORA. `emparejarError` vive en el
  // storage y sólo lo pisa el próximo intento: sin este corte, un fallo de hace
  // media hora —o de la versión anterior de la extensión— se repinta cada vez
  // que se abre el popup, con la misma cara que uno de recién.
  //
  // Pasados diez minutos se muestra el paso que corresponde, y si el problema
  // sigue vivo vuelve a aparecer en cuanto se toque «Conectar». Es la misma
  // regla que el resto del popup ya aplica: el estado se lee vivo, no se
  // recuerda.
  const errorFresco = !!v.emparejarError
    && (!v.emparejarCuando || Date.now() - v.emparejarCuando < 600000);

  if (errorFresco) {
    // «Ya hay otro navegador» es el único que no es un error del usuario: es una
    // decisión, y por eso ofrece continuar en vez de mandarlo a otro lado.
    if (v.emparejarError === 'otro_navegador') {
      pantalla({
        titulo: 'Ya hay otro navegador conectado',
        tenue: (v.emparejarEtiqueta ? v.emparejarEtiqueta + '. ' : '') + 'Si continúas, ese se desconectará.',
        boton: 'Conectar este',
        accion: () => void conectar(true),
      });
      return;
    }
    // ⚠️ EL BOTÓN PRINCIPAL SIEMPRE REINTENTA, y antes no lo hacía nunca.
    //
    // `emparejarError` vive en el storage y NO se borra solo: lo escribe el
    // último intento y se queda ahí para siempre. Con «Abrir MaKo» de única
    // salida, la persona abría MaKo —donde no hay nada que hacer, porque el
    // botón vive acá—, volvía, y leía el MISMO error de hace media hora sin que
    // nada lo hubiera vuelto a intentar. Un error congelado se lee igual que un
    // error de ahora, y manda a arreglar algo que capaz ya está bien.
    //
    // `rol` y `sin_ws` son los dos que NO se arreglan reintentando: los contestó
    // el server sabiendo quién es. Ahí el botón lleva a MaKo, que es donde se
    // cambia un permiso o se entra a un cliente.
    const seArreglaReintentando = v.emparejarError !== 'rol' && v.emparejarError !== 'sin_ws';
    pantalla({
      titulo: TITULO_FALLO[v.emparejarError] || 'No se pudo conectar',
      // Con `motivo: 'error'` el server o la página mandaron el detalle REAL: se
      // muestra ése y no una frase genérica. Es la diferencia entre «vuelve a
      // intentar» y saber qué pasó.
      tenue: (v.emparejarError === 'error' && v.emparejarEtiqueta)
        ? v.emparejarEtiqueta
        : (POR_QUE[v.emparejarError] || POR_QUE.error),
      // ⚠️ EL RÓTULO DICE LO QUE EL BOTÓN HACE. Con `sin_enlace` o `pagina_vieja` lo
      // que hace es RECARGAR, y llamarlo «Volver a intentar» es el defecto que este
      // repo ya pagó en el wizard: un rótulo de una fuente y una acción de otra.
      boton: !seArreglaReintentando
        ? 'Abrir MaKo'
        : ((v.emparejarError === 'sin_enlace' || v.emparejarError === 'pagina_vieja')
            ? 'Recargar y conectar'
            : 'Volver a intentar'),
      accion: seArreglaReintentando
        // `pagina_vieja` va con `sin_enlace`: los dos se arreglan recargando la
        // pestaña, y reintentar sin recargar repite el mismo fallo.
        ? ((v.emparejarError === 'sin_enlace' || v.emparejarError === 'pagina_vieja')
            ? recargarMakoYConectar
            : () => void conectar(false))
        : abrirMako,
      boton2: seArreglaReintentando ? 'Abrir MaKo' : undefined,
      accion2: abrirMako,
    });
    return;
  }

  if (!v.token) {
    pantalla({ titulo: 'Conecta tu navegador', boton: 'Conectar', accion: () => void conectar(false) });
    return;
  }

  // ⚠️ Un 404 NO es «se cayó internet»: es «este token ya no existe», y pasa cada
  // vez que se conecta otro navegador. Mandar a revisar la red sobre esto es
  // mandar a buscar donde no es.
  if (latido && latido.http === 404) {
    pantalla({
      titulo: 'Esta conexión ya no sirve',
      tenue: 'Se conectó otro navegador.',
      boton: 'Volver a conectar',
      accion: () => void conectar(true),
    });
    return;
  }

  if (latido && latido.ok === false && latido.http === 0 && Date.now() - latido.cuando < 120000) {
    pantalla({ titulo: 'No pude hablar con MaKo', tenue: 'Revisa tu internet.', boton: 'Reintentar', accion: latir });
    return;
  }

  if (latido && latido.estado === 'marcada') {
    // ⚠️ ERA UN CALLEJÓN SIN SALIDA. Decía qué hacer en una línea y ofrecía
    // «Abrir MaKo», que no toca este estado: la persona llegaba a MaKo y ahí le
    // decían que volviera a la extensión.
    //
    // Los tres pasos son manuales por naturaleza —esperar, borrar cookies,
    // volver a entrar— así que lo honesto es enumerarlos y hacer el único que sí
    // se puede automatizar: abrir Flow. El botón que LEVANTA la marca vive en
    // MaKo, porque es una decisión que se guarda del lado del server; ahora se
    // dibuja también dentro del estudio, que es donde ocurre el bloqueo.
    pantalla({
      titulo: 'Google pausó tu sesión de Flow',
      tenue: 'Detectó actividad inusual. Reintentar sin hacer esto solo empeora la marca.',
      pasos: [
        'Espera **unos minutos** sin generar nada.',
        'Borra las cookies de **google.com**, **labs.google** y **flow.google.com**.',
        'Vuelve a entrar a Flow e inicia sesión.',
        'En MaKo, toca **Ya lo hice, volver a habilitar** en el aviso rojo.',
      ],
      boton: 'Abrir Google Flow',
      accion: abrirFlow,
      boton2: 'Ir a MaKo',
      accion2: abrirMako,
    });
    return;
  }

  // ── Google Flow (paso 3) ───────────────────────────────────────────────
  if (!v.hayFlow) {
    pantalla({ titulo: 'Abre Google Flow', boton: 'Abrir Google Flow', accion: abrirFlow });
    return;
  }
  if (!v.bearer) {
    // ⚠️ DOS ESTADOS DISTINTOS QUE SE MOSTRABAN IGUAL.
    //
    // Sin bearer puede ser que no inició sesión, o que inició sesión y está en la
    // PORTADA de Flow. En la portada la app pide sus cosas con cookies y no hace
    // ninguna llamada con `Authorization`, así que no hay bearer que ver — y la
    // persona está perfectamente logueada.
    //
    // Medido con una clienta el 04/09/2026: su pestaña era `flow.google.com` con el
    // avatar, el plan y el botón de «Salir» a la vista, y el popup le decía «Inicia
    // sesión». Le pedía lo único que ya estaba hecho.
    // ⚠️ EL FLOW NUEVO NO PUEDE CONECTARSE, Y DECIR OTRA COSA ES MENTIR.
    //
    // Medido el 04/09/2026 dentro de un proyecto cargado de una cuenta real: el Flow
    // de flow.google.com habla sólo por BOQ/batchexecute y no emite NUNCA un
    // `Authorization: Bearer`. El protocolo que este puente implementa no tiene
    // contraparte ahí — no falta un permiso, falta el mecanismo entero.
    //
    // Llegar acá con `flowNuevo` significa exactamente ese caso: si el puente pudiera
    // funcionar habría bearer y esta rama no se ejecutaría.
    //
    // Se dice con todas las letras y SIN botón de reintentar: un botón acá manda a
    // repetir algo que no puede salir bien, y eso es lo que hace que la próxima vez
    // nadie lea el cartel. La regla de la casa: si la culpa no es del cliente, se
    // nombra a quién fue y no se le pide nada.
    if (v.flowNuevo) {
      pantalla({
        titulo: 'Google cambió Flow',
        tenue: 'Google reescribió Google Flow y movió la app a flow.google.com. La forma en que MaKo se conectaba con la versión anterior ya no existe ahí, así que esto no es nada de tu cuenta ni de tu sesión. Estamos trabajando en la conexión nueva.',
        boton: 'Ir a MaKo',
        accion: abrirMako,
      });
      return;
    }
    if (v.hayFlow && !v.flowEnProyecto) {
      pantalla({
        titulo: 'Abre un proyecto en Flow',
        tenue: 'MaKo necesita ver una llamada de Flow para conectarse, y en la lista de proyectos todavía no hay ninguna. Entra a cualquier proyecto —o crea uno— y vuelve acá.',
        boton: 'Ir a Google Flow',
        accion: abrirFlow,
      });
      return;
    }
    pantalla({ titulo: 'Inicia sesión en Google Flow', boton: 'Ir a Google Flow', accion: abrirFlow });
    return;
  }
  // ⚠️ Con bearer pero sin `apiKey` el pedido llega sin proyecto atribuido y
  // Google contesta su página de bloqueo. Tiene remedio propio —recargar— y por
  // eso es su propia pantalla: sin ella el popup diría «todo listo» mientras MaKo
  // dice «falta abrir Google Flow» sobre el mismo navegador.
  if (!v.apiKey || (latido && latido.estado === 'sin_sesion')) {
    pantalla({ titulo: 'Recarga Google Flow', boton: 'Recargar', accion: recargarFlow });
    return;
  }

  // ── Créditos (paso 4) ──────────────────────────────────────────────────
  const s = v.saldo;
  if (s && !s.error && typeof s.creditos === 'number' && Date.now() - s.cuando < 60000) {
    pantalla({
      titulo: s.creditos.toLocaleString('es-MX'),
      numero: true,
      tenue: 'créditos' + (s.gratuito ? ' · plan gratuito' : s.sku ? ' · plan ' + s.sku : ''),
    });
    return;
  }
  // ⚠️ «Todo listo» MIRA EL LATIDO, no sólo las credenciales guardadas. Sin esto
  // era la pantalla que contradice a MaKo sobre el mismo hecho: el popup decía
  // «Todo listo» —porque hay token, bearer y apiKey en storage— mientras la web
  // decía «tu navegador no está conectado», que es lo que mide el server. Los dos
  // hablaban del mismo navegador y sólo uno miraba el presente.
  //
  // Dos minutos es el mismo plazo que usa `lib/flow-puente-frescura.ts`. Si se
  // cambia uno hay que cambiar el otro: la extensión no tiene bundler y no puede
  // importar de `app/`.
  if (latido && latido.cuando && Date.now() - latido.cuando > 120000) {
    pantalla({
      titulo: 'Perdí contacto con MaKo',
      tenue: 'Hace un rato que no logro hablar con MaKo. Se reintenta y se ve qué pasa.',
      boton: 'Reintentar',
      accion: latir,
    });
    return;
  }
  pantalla({ titulo: 'Todo listo', boton: 'Ver mis créditos', suave: true, accion: verSaldo });
}

// ── Las acciones. Todas terminan repintando: la pantalla siempre dice el
//    estado de AHORA, nunca el de antes del clic. ──────────────────────────
async function conectar(forzar) {
  esperando('Conectando…');
  await enviar({ tipo: 'CONECTAR', forzar: !!forzar });
  await pintar();
}

async function latir() { esperando('Reintentando…'); await enviar({ tipo: 'LATIR' }); await pintar(); }

async function abrirFlow() {
  await enviar({ tipo: 'ABRIR_FLOW' });
  // Abrir Flow enfoca otra pestaña, y con eso este popup se cierra solo. No hay
  // nada que repintar: la próxima vez que se abra dirá lo que corresponda.
  window.close();
}

async function recargarFlow() {
  esperando('Recargando…');
  await enviar({ tipo: 'RECARGAR_FLOW' });
  window.close();
}

async function verSaldo() {
  esperando('Preguntando a Google…');
  const s = await enviar({ tipo: 'SALDO' });
  if (s && s.error) {
    // ⚠️ EL MOTIVO DECIDE LA FRASE. Antes había una sola —«recarga Flow»— para
    // todas las causas, y encima este botón fallaba SIEMPRE por un campo mal
    // leído: `background.js` buscaba `r.resultado`, que no existe en ningún lado
    // de la extensión. O sea que el único texto que había era el equivocado para
    // el 100% de los casos.
    //
    // Ahora los motivos vienen separados, y cada uno tiene el remedio que de
    // verdad lo arregla. `SIN_PLANTILLA` es el más distinto de todos: no hay nada
    // que recargar, hay que ABRIR Flow para que haga su propia consulta de
    // créditos y podamos copiarla.
    const e = String(s.error);
    // ⚠️ RECARGAR, NO ABRIR. `abrirFlow` ENFOCA la pestaña que ya está abierta, y
    // enfocar no hace que Flow pida nada: la consulta de créditos que necesitamos
    // copiar la hace al CARGAR. Con la pestaña abierta —que es el caso normal,
    // porque sin ella ni se llega hasta acá— «Abrir Google Flow» era un botón que
    // cambiaba de ventana y dejaba todo igual.
    if (e.startsWith('SIN_PLANTILLA')) {
      pantalla({
        titulo: 'Recarga Google Flow',
        tenue: 'Todavía no vi a Flow consultar tus créditos. Al cargar la página lo hace solo.',
        boton: 'Recargar',
        accion: recargarFlow,
      });
      return;
    }
    if (e === 'HTTP_401' || e === 'HTTP_403' || e === 'RESPUESTA_NO_JSON') {
      pantalla({
        titulo: 'Google no aceptó la consulta',
        // No se afirma cuál de las dos: un 403 no las distingue, y mandar a
        // limpiar cookies a alguien cuya sesión sólo venció es mandarlo a hacer
        // de más. Recargar contesta las dos.
        tenue: 'Tu sesión de Flow venció, o Google la pausó. Recarga Flow y fíjate si te pide iniciar sesión.',
        boton: 'Recargar Flow',
        accion: recargarFlow,
      });
      return;
    }
    pantalla({
      titulo: 'No pude leer tus créditos',
      tenue: e === 'MUDO'
        ? 'La pestaña de Flow no responde. Se recarga y volvemos a intentar.'
        : 'Recarga la pestaña de Google Flow y vuelve a intentar.',
      boton: 'Recargar',
      accion: recargarFlow,
    });
    return;
  }
  await pintar();
}

/**
 * Busca una pestaña de MaKo ya abierta. `null` si no hay ninguna.
 *
 * ⚠️ Se prefiere la ACTIVA de la ventana actual: con dos pestañas de MaKo, la
 * que la persona está mirando es la que tiene en la cabeza, y llevarla a la otra
 * se siente como que el botón hizo cualquier cosa.
 */
async function pestanaDeMako() {
  const todas = await chrome.tabs.query({ url: `${ORIGEN_MAKO}/*` }).catch(() => []);
  if (!todas.length) return null;
  const activa = todas.find((t) => t.active);
  return activa || todas[0];
}

/**
 * ⚠️ NO ABRE UNA PESTAÑA NUEVA SI YA HAY UNA.
 *
 * Hacía `chrome.tabs.create` siempre, así que el remedio a «no estás conectada»
 * era una segunda pestaña de /video-generator encima de la que ya estaba abierta.
 * El dueño: «al abrir la extensión le abre una nueva tab de video-generator, no
 * tiene sentido». Tenía razón dos veces: no tenía sentido abrirla, y tampoco era
 * lo que hacía falta.
 */
/**
 * Lleva al instructivo, no al archivo.
 *
 * ⚠️ APUNTABA AL ZIP, y el comentario que estaba acá afirmaba una indirección que
 * el código no hacía. Bajar el archivo sin decir qué hacer con él es entregar el
 * remedio sin la receta: quien no sepa que hay que cargarlo descomprimido se
 * queda con un `.zip` en Descargas y ninguna pista.
 *
 * Y el zip está detrás del login a propósito, así que un link directo puede
 * terminar en `/login` sin ninguna explicación. La página lo dice y lo ofrece.
 */
function bajarNueva() {
  chrome.tabs.create({ url: `${ORIGEN_MAKO}/extension/instalar`, active: true });
  window.close();
}

async function abrirMako() {
  const t = await pestanaDeMako();
  if (t) {
    await chrome.tabs.update(t.id, { active: true }).catch(() => {});
    await chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
  } else {
    await chrome.tabs.create({ url: MAKO });
  }
  window.close();
}

/**
 * El remedio de `sin_enlace`: recargar la pestaña que no contestó y reintentar.
 *
 * Se hace ACÁ y no se le pide a la persona, porque «recarga la pestaña» es una
 * instrucción que se puede ejecutar sola. Y sin pestaña, se abre una: ahí sí
 * hace falta.
 */
async function recargarMakoYConectar() {
  esperando('Recargando MaKo…');
  await enviar({ tipo: 'RECARGAR_MAKO' });
  await enviar({ tipo: 'CONECTAR', forzar: false });
  await pintar();
}

void pintar();
