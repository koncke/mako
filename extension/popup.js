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
/**
 * La frase con la que se le enseña a generar.
 *
 * ⚠️ ESTÁ ESCRITA DOS VECES, Y NO SE PUEDE EVITAR: la otra copia vive en
 * `injected.js`, que corre en el MAIN world de la página de Flow y no comparte
 * módulo con el popup — una extensión MV3 sin bundler no tiene dónde ponerla una
 * sola vez.
 *
 * Si se cambia, se cambian LAS DOS. Un desfase acá no rompe nada ruidoso: la
 * persona genera con una frase y el espejo busca otra, así que «no aprendí» sobre
 * una generación que salió bien — y el clip ya se pagó.
 */
// ⚠️ LA FRASE NO SE ESCRIBE ACA. Viene del catalogo, que es la fuente unica y la
// que el pre-push mantiene sincronizada con lib/flow-operaciones.ts. Escrita a mano
// en dos archivos, una letra de diferencia significa que la persona genera un clip,
// se le cobra, y el puente contesta que no aprendio.
// (el catalogo no se importa aca: el ESTADO ya manda el rotulo y la frase)

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

  // ⚠️ EL REBOTE SE AVISA ANTES QUE NADA. La persona acaba de ver que Flow «se
  // movió solo»: si el popup le habla de otra cosa, lo que aprende es que el
  // navegador hace cosas raras por su cuenta.
  if (v.volviAlProyecto) {
    await enviar({ tipo: 'AVISO_VISTO' });
    pantalla({
      titulo: 'Te devolví a tu proyecto',
      tenue: 'Fui yo: MaKo necesita esa pestaña justo ahí para poder filmar. No toques nada mientras trabaja — cuando termine, es toda tuya.',
      boton: 'Entendido',
      accion: () => window.close(),
    });
    return;
  }

  // ── Google Flow (paso 3) ───────────────────────────────────────────────
  if (!v.hayFlow) {
    // ⚠️ EL BOTÓN LO HACE, NO LO PIDE. Antes abría Flow y devolvía a la persona a
    // un popup que seguía diciendo lo mismo hasta que ella acertara el resto del
    // estado (entrar a un proyecto, no dejar dormir la pestaña, volver a MaKo).
    pantalla({
      titulo: 'Preparo todo y empezamos',
      tenue: 'Abro Google Flow, entro a tu proyecto y te dejo en MaKo. No toques nada mientras tanto.',
      // ⚠️ UN SOLO BOTON. Habia un «Solo abrir Flow» al lado, y el dueno lo saco:
      // «no deberia decir nunca abrir solo flow, solo el boton de comenzar».
      //
      // Tiene razon y es la misma regla que gobierna toda esta pantalla: una segunda
      // salida que hace MENOS es una invitacion a armar el estado a mano, que es
      // justo lo que este boton vino a terminar. Y la mitad de la gente aprieta la
      // opcion mas chica porque suena menos riesgosa.
      boton: 'Empezar',
      accion: prepararTodo,
    });
    return;
  }
  // ⚠️ EL FLOW NUEVO SE DECIDE ANTES QUE LAS CREDENCIALES, y esto era un «Todo
  // listo» sobre un puente que no puede filmar.
  //
  // `bearer` es un valor GUARDADO. En flow.google.com no se puede refrescar —la app
  // nunca manda `Authorization`—, así que el que haya en storage es necesariamente
  // de la época de labs.google y no sirve para nada. Pero el popup preguntaba
  // `if (!v.bearer)` antes que nada, veía un token viejo, y seguía de largo hasta
  // «Todo listo».
  //
  // O sea que para cualquiera que haya usado el Flow viejo —o sea, todos— la
  // pantalla del Flow nuevo era INALCANZABLE, y la de aprender también. Reportado
  // el 05/09/2026: el clip de aprendizaje generado, y el popup diciendo «Todo listo».
  //
  // Una credencial que no se puede refrescar en el contexto actual no es una
  // credencial: es un recuerdo. Y un recuerdo no puede ganarle a lo que se está
  // mirando ahora.
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
    // ⚠️ MIENTRAS NO APRENDIÓ, LA PANTALLA PIDE LA ÚNICA COSA QUE DESTRABA TODO.
    //
    // Para poder generar con la app nueva hace falta ver UNA generación de
    // verdad: el pedido lleva el prompt escapado adentro de JSON anidado, y
    // adivinar ese anidado es lo que este repo tiene prohibido. Con una
    // generación hecha con una frase conocida, el espejo encuentra dónde cae y
    // ya no hay nada que suponer.
    //
    // Va acá y no en un instructivo aparte porque es donde la persona está
    // mirando cuando se entera de que no puede generar.
    // ⚠️ UNA SOLA PANTALLA, Y LA CONDUCE EL SERVIDOR DE ESTADO.
    //
    // Antes habia dos ramas y un booleano `aprendioGenerar`. Con CINCO operaciones
    // que ensenar —leer creditos, sondear estado, subir imagen, generar video,
    // generar imagen— un booleano no es una simplificacion: es una afirmacion falsa.
    // Decia «ya aprendi» despues de la primera y el puente seguia sin saber hacer
    // las otras cuatro.
    //
    // `v.siguiente` es la PRIMERA que falta, en el orden del catalogo. Una sola,
    // porque la regla de la casa es un paso por pantalla; el «N de M» va como
    // contexto y no como lista.
    if (v.siguiente) {
      const cuantas = v.cuantasOps || 0;
      const listas = v.cuantasListas || 0;
      // ⚠️ SE DICE SI CUESTA, ANTES DE APRETAR. Lo que sigue puede gastar un crédito
      // de la cuenta de Google de la persona, y eso no se descubre después. Las
      // gratis lo dicen también: saber que algo NO cuesta es la mitad de la decisión.
      const costo = v.siguiente.cuesta
        ? ' Esto usa un crédito de tu cuenta de Google, una sola vez.'
        : ' Esto no gasta créditos.';
      pantalla({
        titulo: listas ? 'Falta enseñarme ' + (cuantas - listas) + ' de ' + cuantas
          : 'Enséñame a usar tu Flow',
        tenue: v.siguiente.que + costo
          + (v.siguiente.frase ? ' La frase exacta: «' + v.siguiente.frase + '».' : ''),
        // ⚠️ EL RÓTULO SALE DE DÓNDE ESTÁ LA PERSONA, Y ESO SE DECIDE EN UN SOLO
        // LUGAR. «Ir a Google Flow» se reportó TRES veces estando en Google Flow: las
        // tres el botón hacía lo correcto y la etiqueta mentía. La cura no fue una
        // tercera condición sino que el rótulo viva en el catálogo.
        boton: v.flowEnProyecto ? v.siguiente.boton : 'Ir a Google Flow',
        accion: (v.flowEnProyecto && v.siguiente.frase)
          ? () => copiarFrase(v.siguiente.frase)
          : abrirFlow,
      });
      return;
    }
    // ⚠️ ACÁ NO VAN NOMBRES DE VARIABLES.
    //
    // Esta pantalla llegó a decirle a un cliente «Todavía no sé reconocer creditos,
    // estado_clips, subir_imagen». Son identificadores del código: en la pantalla de
    // alguien no se leen como una explicación, se leen como que la app está a medio
    // hacer. Los nombres para personas viven en el catálogo.
    //
    // Y lo que falta se dice en UNA línea, sin disculpas: lo único accionable es que
    // no hay nada que hacer.
    pantalla({
      titulo: 'Ya sé usar tu Flow',
      tenue: 'Puedo probarlo ahora: le pido un video de prueba y te digo qué contestó.'
        + ' Usa un crédito de tu cuenta de Google.'
        + ((v.sinDetectar || []).length
          ? ' Todavía me falta ' + v.sinDetectar.join(' y ') + ', y eso lo resuelvo yo.'
          : ''),
      boton: 'Pedirle un video de prueba',
      accion: probarGeneracion,
      boton2: 'Ir a MaKo',
      accion2: abrirMako,
    });
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
    if (v.hayFlow && !v.flowEnProyecto) {
      pantalla({
        titulo: 'Abre un proyecto en Flow',
        tenue: 'MaKo necesita ver una llamada de Flow para conectarse, y en la lista de proyectos todavía no hay ninguna. Entra a cualquier proyecto —o crea uno— y vuelve acá.',
        boton: 'Empezar',
        accion: prepararTodo,
        boton2: 'Ir a Google Flow',
        accion2: abrirFlow,
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
    // ⚠️ EN EL FLOW NUEVO LOS CRÉDITOS SÍ SE PUEDEN LEER, Y NUNCA SE MOVIERON.
    //
    // Están en el menú de la cuenta —arriba a la derecha, el avatar— como siempre.
    // Lo que cambió es por dónde los pide la app: `rpcids=nzlxg` los contesta, y el
    // espejo ya guarda esa respuesta, así que `saldoDeBoq()` los lee sin pedir nada.
    //
    // Llegar acá con `flowNuevo` significa una sola cosa: todavía no vimos pasar ese
    // pedido en esta sesión. Y eso tiene un remedio de verdad —abrir el menú de la
    // cuenta, que es lo que lo dispara— en vez de un cartel de disculpa.
    //
    // ⚠️ Y ESTE TEXTO COSTÓ TRES INTENTOS, los tres afirmando de más:
    //   1. «tu sesión venció» — a alguien con la sesión perfecta;
    //   2. «míralos arriba a la derecha» — inventado, sin haberlo mirado;
    //   3. «Google los sacó» — falso: yo busqué la palabra `credit` en las
    //      respuestas, no aparecía, y reporté ausencia. El número estaba ahí, dos
    //      veces, en la misma captura.
    //
    // Un predicado mal elegido no devuelve «no sé»: devuelve «no», que es
    // indistinguible de un hecho. Este texto es el primero que se escribió DESPUÉS
    // de abrir el menú y ver el número.
    if (est && est.flowNuevo) {
      pantalla({
        titulo: 'Abre el menú de tu cuenta en Flow',
        tenue: 'Tus créditos están donde siempre: el avatar de arriba a la derecha, en Flow. Ábrelo una vez y MaKo los lee de ahí — no hace falta que vuelvas a abrirlo después.',
        boton: 'Ir a Google Flow',
        accion: abrirFlow,
      });
      return;
    }
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

/**
 * DEJA TODO LISTO Y LE PIDE A LA PERSONA QUE NO TOQUE NADA.
 *
 * ⚠️ ES EL REEMPLAZO DE CUATRO CARTELES QUE PEDÍAN ARMAR UN ESTADO A MANO.
 *
 * «Abre Google Flow», «Inicia sesión», «Abre un proyecto», «Recarga la pestaña»:
 * los cuatro son tareas delegadas a quien menos contexto tiene, y los cuatro se
 * reportaron rotos en tres días — casi siempre porque el estado YA estaba bien y el
 * cartel no sabía verlo.
 *
 * La extensión es la única que ve las pestañas de las dos apps a la vez, así que es
 * la única que puede armarlo. El dueño: «sería mucho más fácil si MaKo manejara las
 * tabs, para que no tenga que estar haciendo nada, y le decimos No toques nada».
 *
 * ⚠️ El popup se CIERRA en cuanto pierde el foco, y abrir pestañas se lo hace
 * perder. Por eso el trabajo vive en el background y esto sólo lo dispara: hacerlo
 * acá se cortaría a la mitad, con las pestañas abiertas y nada conectado.
 */
/**
 * Deja la frase en el portapapeles.
 *
 * ⚠️ Hay que escribirla EXACTA: el espejo la busca literal dentro del cuerpo del
 * pedido, así que una letra distinta significa «no aprendí» sobre una generación que
 * salió bien — y el clip ya se pagó, en créditos del cliente. Transcribir a mano un
 * token como `mako7f3a9c` es exactamente donde eso pasa.
 */
/**
 * Le pide a Flow un video de prueba, repitiendo el pedido que aprendimos.
 *
 * ⚠️ GASTA UN CRÉDITO DE LA CUENTA DE GOOGLE DE LA PERSONA, y por eso sale de un
 * botón y nunca de un ciclo automático. El texto lo dice antes de apretar.
 *
 * Y lo que se muestra es lo que CONTESTÓ Google, no un «listo»: si algo falla, el
 * crédito ya se gastó y la persona tiene derecho a saber en qué.
 */
async function probarGeneracion() {
  pantalla({ titulo: 'Se lo estoy pidiendo…', tenue: 'Puede tardar hasta un minuto. No cierres esta ventana.' });
  let r;
  try { r = await enviar({ tipo: 'PROBAR_BOQ' }); } catch (e) { r = { error: 'SIN_RESPUESTA' }; }

  if (r && r.ok) {
    pantalla({
      titulo: 'Se lo pedí y lo aceptó',
      tenue: 'Google contestó que sí. El video aparece en tu Flow en un rato.',
      boton: 'Ir a MaKo',
      accion: abrirMako,
    });
    return;
  }

  // ⚠️ CADA FALLA DICE DE QUIÉN FUE Y QUÉ HACER — y sobre todo, SI YA COSTÓ.
  // Un «no se pudo» a secas deja a la persona sin saber si le cobraron.
  const POR_QUE = {
    SIN_PLANTILLA: ['Todavía no sé pedirle un video', 'Genera uno tú con la frase que te doy y aprendo.'],
    SIN_ANCLA: ['No encontré dónde va el texto', 'La plantilla que aprendí ya no sirve: hay que enseñarme de nuevo.'],
    SIN_AT: ['Tu sesión de Flow no está lista', 'Recarga la pestaña de Google Flow y vuelve a probar.'],
    NO_FLOW_TAB: ['No tienes Google Flow abierto', 'Ábrelo desde el ícono de MaKo y vuelve a probar.'],
    PESTANA_MUDA: ['La pestaña de Flow no responde', 'Recárgala (F5) y vuelve a probar.'],
    BOQ_TIMEOUT: ['Google tardó demasiado', 'El pedido salió, así que puede haberse cobrado. Míralo en tu Flow antes de repetir.'],
  };
  const cod = (r && (r.error || (r.status ? 'HTTP_' + r.status : ''))) || 'SIN_RESPUESTA';
  const t = POR_QUE[cod];
  // ⚠️ `salio` decide si ya costó. Si el pedido llegó a salir, el crédito se gastó
  // pase lo que pase después, y repetir es pagar dos veces.
  const yaCosto = !!(r && r.salio);
  pantalla({
    titulo: t ? t[0] : 'Google no lo aceptó',
    tenue: (t ? t[1]
      : 'Contestó ' + (r && r.status ? 'con un error ' + r.status : 'algo que no supe leer') + '.')
      + (yaCosto ? ' El pedido salió, así que revisa tu Flow antes de repetir: puede haberse cobrado.' : ''),
    boton: 'Ir a MaKo',
    accion: abrirMako,
  });
}

async function copiarFrase(frase) {
  try {
    await navigator.clipboard.writeText(frase);
    pantalla({
      titulo: 'Frase copiada',
      tenue: 'Pégala en «¿Qué quieres crear?» de Flow, ponlo en 4 segundos y genera. Vuelve acá cuando termine.',
      boton: 'Listo',
      accion: () => window.close(),
    });
  } catch {
    // Si el navegador no deja copiar, no se finge que sí: se muestra la frase para
    // escribirla a mano, que es peor pero es cierto.
    pantalla({
      titulo: 'No pude copiarla',
      tenue: 'Escríbela a mano, tal cual: ' + frase,
      boton: 'Listo',
      accion: () => window.close(),
    });
  }
}

async function prepararTodo() {
  esperando('Preparando todo… no toques nada');
  const r = await enviar({ tipo: 'PREPARAR' });
  // ⚠️ Si falta elegir proyecto, se DICE y no se sigue como si nada: es lo único de
  // toda la secuencia que no se puede hacer por la persona —en cuál de sus
  // proyectos trabajar es una decisión suya— y callarlo la deja mirando una
  // pantalla que no avanza.
  if (r && r.avisoProyecto) {
    pantalla({
      titulo: 'Entra a un proyecto en Flow',
      tenue: 'Ya te dejé Flow abierto. Entra a cualquier proyecto —o crea uno— y vuelve acá: es lo único que no puedo elegir por ti.',
      boton: 'Ir a Google Flow',
      accion: abrirFlow,
    });
    return;
  }
  await pintar();
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
