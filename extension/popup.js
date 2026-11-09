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
  // Es la pantalla de Flow: si la persona ya se fue a otra (la navegación, 0.72.0), un `pintar` que llega tarde no la pisa.
  if (vista.pantalla !== 'flow') return;
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
    // ⚠️ PRIMERO, LA PESTAÑA AL DIA. El espejo de la página sobrevive a la
    // actualización de la extensión y sólo muere con una recarga: mientras sea
    // viejo, lo que aprenda no se guarda como corresponde. Recargar es lo que
    // hace la extensión, no la persona; el texto dice qué pasa, no cómo funciona.
    if (v.espejoViejo) {
      pantalla({
        titulo: 'Recarga Google Flow',
        tenue: 'La pestaña de Flow quedó con una versión anterior de MaKo. Al recargarla queda al día; no toques nada mientras se recarga.',
        boton: 'Recargar',
        accion: recargarFlow,
      });
      return;
    }
    // ⚠️ CON EL MOTOR POR INTERFAZ NO HAY NADA QUE ENSEÑAR, Y ESO NO ES «LISTO».
    // MaKo genera apretando los botones de Flow en esta pestaña, así que lo único
    // que hace falta es que la pestaña esté dentro de un proyecto y contestando.
    // Sin esta rama, `siguiente` vacío caía en «MaKo ya puede hacer tus anuncios»
    // con la pestaña muda: un verde que la cola iba a desmentir con el botón ya
    // apretado.
    if (v.juicio && v.juicio.motor === 'interfaz' && !v.juicio.puede) {
      if (!v.flowEnProyecto) {
        pantalla({
          titulo: 'Abre un proyecto en Flow',
          tenue: 'MaKo hace tus anuncios dentro de un proyecto de Flow. Entra a cualquiera —o crea uno— y vuelve acá.',
          boton: 'Ir a Google Flow',
          accion: abrirFlow,
        });
        return;
      }
      pantalla({
        titulo: 'Recarga Google Flow',
        tenue: 'La pestaña de Flow no contesta. Al recargarla queda lista; no toques nada mientras se recarga.',
        boton: 'Recargar',
        accion: recargarFlow,
      });
      return;
    }
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
    // ⚠️ ACA NO SE CUENTA COMO FUNCIONA MaKo POR DENTRO.
    //
    // Estas pantallas llegaron a decir «Ensename a usar tu Flow» y «ya se usar tu
    // Flow», y a ofrecer «un video de prueba». Eso es NUESTRO problema contado en voz
    // alta: quien abre MaKo no sabe que hay un puente, no sabe que Google cambio nada,
    // y no quiere un video de prueba — quiere su anuncio.
    //
    // Lo unico que necesita saber es si MaKo ya puede hacer sus anuncios y, si todavia
    // no, que tiene que hacer UNA vez. El resto es nuestro.
    //
    // ⚠️ PERO LA ESTRUCTURA NO SE TOCA, Y ESTO SE REESCRIBIO UNA VEZ SIN MIRARLA:
    // el rotulo sale del CATALOGO y la condicion es DONDE ESTA LA PERSONA, nunca «si
    // hay frase». `subir_imagen` no tiene frase; con la condicion de la frase cae por
    // el else y le dice «Ir a Google Flow» a alguien parado en Google Flow. Eso se
    // reporto tres veces. Cambiar las palabras no es motivo para volver a romperlo.
    if (v.siguiente) {
      const cuantas = v.cuantasOps || 0;
      const listas = v.cuantasListas || 0;
      // ⚠️ SE DICE SI CUESTA, ANTES DE APRETAR. Lo que sigue puede gastar un crédito
      // de la cuenta de Google de la persona, y eso no se descubre después. Las
      // gratis lo dicen también: saber que algo NO cuesta es la mitad de la decisión.
      const costo = v.siguiente.cuesta
        ? ' Usa un crédito de tu cuenta de Google, una sola vez.'
        : ' Esto no gasta créditos.';
      pantalla({
        // El «N de M» va en el título y no como lista: la regla de la casa es un paso
        // por pantalla, y saber cuántos faltan es lo único que hace falta de los otros.
        titulo: 'Para que MaKo haga tus anuncios'
          + (cuantas > 1 ? ' (' + (listas + 1) + ' de ' + cuantas + ')' : ''),
        tenue: v.siguiente.que + costo
          + (v.siguiente.frase ? ' La frase exacta: «' + v.siguiente.frase + '».' : ''),
        boton: v.flowEnProyecto ? v.siguiente.boton : 'Ir a Google Flow',
        // La acción sí puede mirar la frase: copiar algo que no existe no es una
        // acción. Lo que no puede mirarla es el RÓTULO, que es lo que mintió.
        accion: v.flowEnProyecto && v.siguiente.frase
          ? () => copiarFrase(v.siguiente.frase)
          : abrirFlow,
      });
      return;
    }
    // ⚠️ Y ACA NO HAY BOTON DE PROBAR. La persona no quiere probar: quiere su anuncio.
    // El primer anuncio de verdad ES la prueba, y si algo falla el error aparece donde
    // ella lo está esperando. Un «video de prueba» ademas la sacaba a Flow a mano, que
    // es exactamente lo que este producto existe para evitarle.
    pantalla({
      titulo: 'MaKo ya puede hacer tus anuncios',
      tenue: 'Todo listo. Crea tu anuncio en MaKo y él se encarga del resto.',
      boton: 'Ir a MaKo',
      accion: abrirMako,
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

// =============================================================================
// La NAVEGACIÓN del desplegable (26/10/2026, 0.72.0)
// =============================================================================
// Martín: «la extensión debe tener navegación, que se guarde el registro de las extracciones si me voy para "atrás" en la
// extracción, y que si me voy para atrás nuevamente pueda seleccionar Scraper o Flow, ya que la extensión hace las 2 cosas...
// por defecto está configurada la extensión para Flow, porque al "conectar" me abre Flow».
//   Inicio: Scraper de WhatsApp | Google Flow
//     · Scraper → el REGISTRO de las extracciones (lo escribe el worker en `extracciones`) → una, en vivo o terminada;
//     · Flow → lo de siempre (`pintar`, arriba): conectar este navegador recién ahí, cuando la persona eligió Flow.
// Al abrir: la extracción que está corriendo (el worker abre este desplegable al empezarla), y si no, donde se dejó.
let vista = { pantalla: 'inicio' };
const ATRAS = { flow: 'inicio', scraper: 'inicio', extraccion: 'scraper', spy: 'inicio', perfil: 'inicio', replica: 'inicio' };
const DONDE = { flow: 'Google Flow', scraper: 'Scraper de WhatsApp', extraccion: 'Scraper de WhatsApp', spy: 'Competitors Spy', perfil: 'CRM', replica: 'Web Generator' };
/** Una extracción sin noticias hace tanto se cortó (el navegador cerró la extensión a la mitad). */
const CORTADA_MS = 3 * 60000;

async function ir(v) {
  vista = v;
  try { await chrome.storage.local.set({ popupVista: v }); } catch { /* sin recordar dónde quedó */ }
  await dibujar();
}

async function registro() {
  try {
    const { extracciones } = await chrome.storage.local.get('extracciones');
    return Array.isArray(extracciones) ? extracciones.filter((e) => e && typeof e.id === 'string') : [];
  } catch { return []; }
}

/** ¿Sigue corriendo? «corriendo» sin noticias hace minutos es una que se cortó. */
const enCurso = (e) => !!e && e.estado === 'corriendo' && Date.now() - (Number(e.actualizado) || 0) < CORTADA_MS;

async function dibujar() {
  $('atras').hidden = vista.pantalla === 'inicio';
  $('donde').textContent = DONDE[vista.pantalla] || '';
  armada = null;
  if (vista.pantalla === 'flow') { esperando('Un momento…'); await pintar(); return; }
  if (vista.pantalla === 'spy') { if (spy.hay) dibujarSpy(); return; }
  if (vista.pantalla === 'perfil') { if (perfil.hay) void leerPerfil(); return; }
  const lista = await registro();
  if (vista.pantalla === 'scraper') dibujarRegistro(lista);
  else if (vista.pantalla === 'extraccion') dibujarExtraccion(lista.find((e) => e.id === vista.id) || null);
  else dibujarInicio(lista);
}

const NS = 'http://www.w3.org/2000/svg';
/** Un ícono de trazo (24×24), armado por nodos. */
function icono(d, color) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const tramo of d) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', tramo);
    svg.appendChild(p);
  }
  return svg;
}
const nodo = (tag, clase, texto) => {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
};

function dibujarInicio(lista) {
  const cuerpo = $('cuerpo');
  cuerpo.textContent = '';
  cuerpo.appendChild(nodo('h1', '', '¿Qué hacemos?'));
  const viva = (lista || []).find(enCurso);
  const opcion = (nombre, sub, d, color, fondo, alElegir) => {
    const b = nodo('button', 'opcion');
    b.type = 'button';
    const ico = nodo('span', 'ico');
    ico.style.background = fondo;
    ico.appendChild(icono(d, color));
    const txt = nodo('span');
    txt.appendChild(nodo('span', 'nom', nombre));
    txt.appendChild(nodo('span', 'sub', sub));
    b.append(ico, txt);
    b.addEventListener('click', alElegir);
    cuerpo.appendChild(b);
  };
  opcion('Scraper de WhatsApp', viva ? `Extrayendo «${viva.titulo || 'tu grupo'}»…` : 'Los nombres de tus grupos, al CRM',
    ['M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z', 'M9 10h.01M12 10h.01M15 10h.01'], '#1f9d55', 'rgba(31,157,85,.12)',
    () => void ir(viva ? { pantalla: 'extraccion', id: viva.id } : { pantalla: 'scraper' }));
  opcion('Google Flow', 'Tus anuncios, con tu cuenta de Flow',
    ['M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4z', 'M17 10l4-3v10l-4-3'], '#2f6df6', 'rgba(47,109,246,.12)',
    () => void ir({ pantalla: 'flow' }));
  // «Guardar en Spy»: sólo si Chrome dio esta pestaña, o sea si la persona tocó el ícono (ver `prepararSpy`).
  if (spy.hay) {
    opcion(spy.rotulo, MakoSpy.detalle(spy.hay),
      ['M12 5C6.5 5 3 12 3 12s3.5 7 9 7 9-7 9-7-3.5-7-9-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], '#7c3aed', 'rgba(124,58,237,.12)',
      () => void abrirSpy());
  }
  // «Guardar en MaKo»: el perfil abierto de Instagram o de LinkedIn, como lead. Igual que Spy, sólo con la pestaña que dio Chrome.
  if (perfil.hay) {
    opcion(MakoPerfil.rotulo(), MakoPerfil.detalle(perfil.hay),
      ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19 8v6M22 11h-6'], '#c2410c', 'rgba(194,65,12,.12)',
      () => void abrirPerfil());
  }
  // «Replicar esta página»: cualquier página que no sea de MaKo, sólo con la pestaña que dio Chrome (ver `prepararReplica`).
  if (replica.hay) {
    opcion('Replicar esta página', 'Cópiala tal cual en tu Web Generator',
      ['M9 9h11v11H9z', 'M5 15H4V4h11v1'], '#0f766e', 'rgba(15,118,110,.12)',
      () => void replicarPagina({ ...replica.hay, desdeInicio: true }));
  }
}

// ── «Guardar en Spy» ──────────────────────────────────────────────────────────────────────────
// La persona abre el sitio o los anuncios de un competidor y toca el ícono. Tres cosas que son a propósito:
//   · ABRIR ESTO NO LEE NADA y no le cuenta a MaKo qué sitio se está mirando: la lista de competidores viene
//     entera y se compara acá (spy-reglas.js). La página se lee recién al tocar el botón.
//   · SÓLO `activeTab`. Sin `tab.url` es que Chrome no dio la pestaña, y entonces no se ofrece nada. Medido
//     el 3/11/2026 con Chrome 156: `chrome.action.openPopup` abre esto y NO otorga `activeTab`, así que
//     cuando el worker lo abre durante una extracción el botón no aparece. Hace falta el clic de la persona.
//   · LO LEÍDO SE INTERPRETA EN EL SERVIDOR (lib/spy-captura.ts). Lo que muestra esta pantalla es su respuesta,
//     con `textContent`: el nombre de una Página es de un tercero y acá no se interpreta como HTML.
const RUTA_SPY = `${ORIGEN_MAKO}/api/competitor-spy/extension`;
let spy = { hay: null, tabId: null, ficha: null, rotulo: '', competidores: [], token: null };

async function pedirSpy(cuerpo, esperaMs) {
  const r = await fetch(RUTA_SPY, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-flow-token': spy.token },
    body: JSON.stringify(cuerpo),
    ...(esperaMs ? { signal: AbortSignal.timeout(esperaMs) } : {}),
  });
  const datos = await r.json().catch(() => null);
  return { status: r.status, datos };
}

/** Lo que el inicio necesita saber, sin leer la página. Si algo falla, el botón no aparece y todo lo demás sigue igual. */
async function prepararSpy() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const hay = tab?.url ? MakoSpy.queHay(tab.url) : null;
  if (!hay) return false;
  const { token } = await chrome.storage.local.get('token').catch(() => ({}));
  spy = { hay, tabId: tab.id, ficha: null, rotulo: MakoSpy.rotulo(null), competidores: [], token: token || null };
  if (!spy.token) return true;
  // Con MaKo lento, el desplegable no se queda en blanco: nada más de esta pantalla depende de esto.
  const { datos } = await pedirSpy({ accion: 'lista' }, 2500).catch(() => ({ datos: null }));
  spy.competidores = Array.isArray(datos?.competidores) ? datos.competidores : [];
  spy.ficha = MakoSpy.fichaDe(hay, spy.competidores);
  spy.rotulo = MakoSpy.rotulo(spy.ficha);
  return true;
}

function abrirSpy() {
  vista = { pantalla: 'spy' };
  $('atras').hidden = false;
  $('donde').textContent = DONDE.spy;
  dibujarSpy();
}

/** Una pantalla de esta parte: título, línea tenue y botones. Por nodos, nunca con HTML. */
function pantallaSpy(titulo, tenue, botones) {
  const cuerpo = $('cuerpo');
  cuerpo.textContent = '';
  cuerpo.appendChild(nodo('h1', '', titulo));
  if (tenue) cuerpo.appendChild(nodo('div', 'tenue', tenue));
  for (const [texto, fn, suave] of botones || []) {
    const b = nodo('button', suave ? 'suave' : '', texto);
    b.type = 'button';
    b.addEventListener('click', fn);
    cuerpo.appendChild(b);
  }
}

/** Sin token, a conectar. Con ficha, derecho. Sin ficha, primero de quién es: uno de la lista o uno nuevo. */
function dibujarSpy() {
  if (!spy.token) {
    pantallaSpy('Conecta este navegador', 'Para guardar en tu MaKo, primero hay que conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  if (spy.ficha) { void guardarEnSpy(spy.ficha.id); return; }
  if (!spy.competidores.length) { void guardarEnSpy(null); return; }
  pantallaSpy('¿De quién es?', MakoSpy.detalle(spy.hay), [
    ['Uno nuevo', () => void guardarEnSpy(null)],
    ...spy.competidores.map((c) => [c.nombre, () => void guardarEnSpy(c.id), true]),
  ]);
}

/** El clic: recién acá se inyecta el lector, una vez, en esta pestaña y en el mundo aislado. */
async function guardarEnSpy(competidorId) {
  pantallaSpy('Leyendo esta pestaña…');
  let captura = null;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: spy.tabId }, files: ['spy-leer.js'], world: 'ISOLATED' });
    captura = r?.result ?? null;
  } catch { captura = null; }
  if (!captura || captura.modo === 'prohibido') {
    pantallaSpy('No pude leer esta pestaña', 'Recárgala y vuelve a tocar el ícono de MaKo.', [['Volver', () => void ir({ pantalla: 'inicio' })]]);
    return;
  }
  pantallaSpy('Guardando…');
  const { status, datos } = await pedirSpy({ accion: 'guardar', competidorId, captura }).catch(() => ({ status: 0, datos: null }));
  if (status === 404) {
    pantallaSpy('Conecta este navegador', 'MaKo no lo reconoció. Vuelve a conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  if (!datos?.ok) {
    pantallaSpy(datos?.motivo === 'sin-anuncios' ? 'No vi anuncios' : datos?.motivo === 'de-otro' ? 'Son de otro' : 'No se guardó', datos?.error || 'No pude hablar con MaKo.', [['Volver', () => void ir({ pantalla: 'inicio' })]]);
    return;
  }
  const verla = ['Verla en MaKo', () => void abrirMakoEn(`/competitor-spy?competidor=${encodeURIComponent(datos.competidor.id)}`)];
  if (datos.tipo === 'anuncios') {
    // `sinGuardar`: con muchisimos anuncios en la pestana, los que no entraron por el tope. Se DICE: antes el
    // desplegable decia «50 anuncios» sin decir «de 213» (lib/spy-captura-db.ts).
    const sub = [`${datos.nuevos} nuevos`, datos.sinGuardar ? `${datos.sinGuardar} no entraron en esta captura` : '', datos.otros ? `${datos.otros} de otros anunciantes no se guardaron` : ''].filter(Boolean).join(' · ');
    pantallaSpy(`${datos.guardados} ${datos.guardados === 1 ? 'anuncio' : 'anuncios'} en la ficha de ${datos.competidor.nombre}`, sub, [verla]);
  } else if (datos.tipo === 'sitio') {
    pantallaSpy(`Guardado en la ficha de ${datos.competidor.nombre}`, (datos.lineas || []).join(' · ') || 'No vi píxeles, checkout ni video en esta página.', [verla]);
  } else {
    pantallaSpy(`${datos.competidor.nombre} ya está en Spy`, '', [verla]);
  }
}

// ── «Capturar» desde «Sus páginas» (0.76.0, 4/11/2026) ─────────────────────────────────────────
// ── «Guardar en MaKo» ─────────────────────────────────────────────────────────────────────────
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md): sobre el perfil abierto de Instagram o de LinkedIn,
// guardar a esa persona como lead del CRM. De a uno, a la vista y con el toque de la persona:
//   · ABRIR ESTO NO LEE NADA: el botón aparece por la dirección (perfil-reglas.js), y la página se lee recién al tocarlo
//     (perfil-leer.js, inyectado una vez, en esta pestaña y en el mundo aislado);
//   · LO LEÍDO SE INTERPRETA EN EL SERVIDOR (lib/perfil-captura.ts), que contesta qué entendió y si ya está en el CRM, SIN guardar;
//   · se guarda con el SEGUNDO toque, «Guardar en mi CRM», con el nombre que la persona ve y puede corregir.
// Todo lo que dice esta pantalla va con `textContent`: el nombre de un perfil lo escribe un tercero.
const RUTA_PERFIL = `${ORIGEN_MAKO}/api/crm/extension`;
let perfil = { hay: null, tabId: null, token: null, captura: null };

async function pedirPerfil(cuerpo) {
  const r = await fetch(RUTA_PERFIL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-flow-token': perfil.token },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(20000),
  });
  const datos = await r.json().catch(() => null);
  return { status: r.status, datos };
}

/** ¿Esta pestaña es un perfil? Sólo con la dirección: no le pregunta nada a MaKo. */
async function prepararPerfil() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const hay = tab?.url ? MakoPerfil.queHay(tab.url) : null;
  if (!hay) return false;
  const { token } = await chrome.storage.local.get('token').catch(() => ({}));
  perfil = { hay, tabId: tab.id, token: token || null, captura: null };
  return true;
}

function abrirPerfil() {
  vista = { pantalla: 'perfil' };
  $('atras').hidden = false;
  $('donde').textContent = DONDE.perfil;
  void leerPerfil();
}

const alInicio = ['Volver', () => void ir({ pantalla: 'inicio' }), true];

/** La ficha del lead en MaKo, en una pestaña nueva. Sólo una dirección de MaKo. */
function abrirLead(lead) {
  const url = typeof lead?.link === 'string' && lead.link.startsWith(`${ORIGEN_MAKO}/`) ? lead.link : `${ORIGEN_MAKO}/crm/${encodeURIComponent(lead?.id ?? '')}`;
  void chrome.tabs.create({ url, active: true });
  window.close();
}

/** El primer toque: leer el perfil y preguntarle a MaKo qué entendió. No guarda nada. */
async function leerPerfil() {
  if (!perfil.token) {
    pantallaSpy('Conecta este navegador', 'Para guardar en tu MaKo, primero hay que conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  pantallaSpy('Leyendo este perfil…');
  let captura = null;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: perfil.tabId }, files: ['perfil-leer.js'], world: 'ISOLATED' });
    captura = r?.result ?? null;
  } catch { captura = null; }
  if (!captura || captura.modo !== 'perfil') {
    pantallaSpy('No pude leer este perfil', 'Recárgalo y vuelve a tocar el ícono de MaKo.', [alInicio]);
    return;
  }
  perfil.captura = captura;
  pantallaSpy('Mirando tu CRM…');
  const { status, datos } = await pedirPerfil({ accion: 'ver', captura }).catch(() => ({ status: 0, datos: null }));
  if (status === 404) {
    pantallaSpy('Conecta este navegador', 'MaKo no lo reconoció. Vuelve a conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  if (!datos?.ok) {
    pantallaSpy('No se pudo', datos?.error || 'No pude hablar con MaKo.', [alInicio]);
    return;
  }
  if (datos.ya) {
    pantallaSpy(`${datos.ya.nombre} ya está en tu CRM`, datos.perfil.rotulo, [['Abrir en MaKo', () => abrirLead(datos.ya)]]);
    return;
  }
  formularioPerfil(datos.perfil.rotulo, datos.perfil.nombre || '', datos.parecidos || []);
}

/** La pantalla de confirmar: el perfil, el nombre (que se corrige acá) y, si hay, el aviso de alguien que se llama igual. */
function formularioPerfil(rotuloPerfil, nombre, parecidos) {
  const cuerpo = $('cuerpo');
  cuerpo.textContent = '';
  cuerpo.appendChild(nodo('h1', '', 'Guardar en tu CRM'));
  cuerpo.appendChild(nodo('div', 'tenue', rotuloPerfil));
  const etiqueta = nodo('label', 'campo', 'Nombre');
  const campo = document.createElement('input');
  campo.type = 'text';
  campo.maxLength = 120;
  campo.value = nombre;
  campo.placeholder = 'Su nombre';
  etiqueta.appendChild(campo);
  cuerpo.appendChild(etiqueta);
  const igual = parecidos[0];
  if (igual) cuerpo.appendChild(nodo('div', 'tenue', `Ya tienes un lead que se llama ${igual.nombre}.`));
  const guardar = nodo('button', '', igual ? 'Guardar igual' : 'Guardar en mi CRM');
  guardar.type = 'button';
  guardar.addEventListener('click', () => void guardarPerfil(rotuloPerfil, campo.value, !!igual));
  cuerpo.appendChild(guardar);
  if (igual) {
    const ver = nodo('button', 'suave', `Abrir a ${igual.nombre}`);
    ver.type = 'button';
    ver.addEventListener('click', () => abrirLead(igual));
    cuerpo.appendChild(ver);
  }
  campo.focus();
}

/** El segundo toque: recién acá se crea el lead. */
async function guardarPerfil(rotuloPerfil, nombre, aunqueSeLlameIgual) {
  pantallaSpy('Guardando…');
  const { status, datos } = await pedirPerfil({ accion: 'guardar', captura: perfil.captura, nombre, aunqueSeLlameIgual })
    .catch(() => ({ status: 0, datos: null }));
  if (status === 404) {
    pantallaSpy('Conecta este navegador', 'MaKo no lo reconoció. Vuelve a conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  if (datos?.ok) {
    pantallaSpy(`${datos.lead.nombre} quedó en tu CRM`, rotuloPerfil, [['Abrir en MaKo', () => abrirLead(datos.lead)]]);
    return;
  }
  if (datos?.motivo === 'ya') {
    pantallaSpy(`${datos.lead.nombre} ya está en tu CRM`, rotuloPerfil, [['Abrir en MaKo', () => abrirLead(datos.lead)]]);
    return;
  }
  if (datos?.motivo === 'parecido') { formularioPerfil(rotuloPerfil, nombre, datos.parecidos || []); return; }
  if (datos?.motivo === 'sin-nombre') { formularioPerfil(rotuloPerfil, '', []); return; }
  if (datos?.motivo === 'tope' && typeof datos.planes === 'string' && datos.planes.startsWith(`${ORIGEN_MAKO}/`)) {
    pantallaSpy('No se guardó', datos.error, [['Pasar a Pro', () => { void chrome.tabs.create({ url: datos.planes, active: true }); window.close(); }], alInicio]);
    return;
  }
  pantallaSpy('No se guardó', datos?.error || 'No pude hablar con MaKo.', [alInicio]);
}

// Spy pidió capturar una página que el servidor no puede mostrar (una barrera, como el «comprobar que es una persona» de
// Beacons). El worker la abrió en esta pestaña y la anotó (`spyCapturas`). Cuando la persona la ve y toca el ícono, Chrome le da
// esta pestaña a la extensión (`activeTab`) y recién ahí se lee: la foto de lo que se ve y la página (spy-pagina.js). Sin ese toque
// no se lee nada, y no hace falta ningún permiso nuevo. Si la página pide comprobar que es una persona, lo hace ella: acá no se
// hace clic ni se resuelve nada.

/** La captura que Spy pidió para ESTA pestaña, si la hay. Sin `tab.url` es que Chrome no dio la pestaña: no hay nada que hacer. */
async function capturaPendiente() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab?.id || !tab.url) return null;
  const { spyCapturas } = await chrome.storage.session.get('spyCapturas').catch(() => ({}));
  const p = spyCapturas && spyCapturas[String(tab.id)];
  return p && Number.isInteger(p.competidorId) && typeof p.url === 'string' ? { ...p, tabId: tab.id, windowId: tab.windowId } : null;
}

async function capturarPagina(p) {
  vista = { pantalla: 'spy' };
  $('atras').hidden = true;
  $('donde').textContent = DONDE.spy;
  pantallaSpy('Capturando esta página…');
  const { token } = await chrome.storage.local.get('token').catch(() => ({}));
  if (!token) {
    pantallaSpy('Conecta este navegador', 'Para guardar en tu MaKo, primero hay que conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  spy.token = token;
  let captura = null;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: p.tabId }, files: ['spy-pagina.js'], world: 'ISOLATED' });
    captura = r?.result ?? null;
  } catch { captura = null; }
  // La foto de lo que se ve: con el toque en el ícono, `activeTab` alcanza.
  let foto = null;
  try { foto = await chrome.tabs.captureVisibleTab(p.windowId, { format: 'jpeg', quality: 60 }); } catch { foto = null; }
  if (!captura || captura.modo !== 'pagina') {
    pantallaSpy('No pude leer esta página', 'Recárgala y vuelve a tocar el ícono de MaKo.');
    return;
  }
  pantallaSpy('Guardando…');
  const { status, datos } = await pedirSpy({ accion: 'pagina', competidorId: p.competidorId, url: p.url, captura, foto }, 30000)
    .catch(() => ({ status: 0, datos: null }));
  if (status === 404) {
    pantallaSpy('Conecta este navegador', 'MaKo no lo reconoció. Vuelve a conectarlo.', [['Conectar', () => void ir({ pantalla: 'flow' })]]);
    return;
  }
  if (!datos?.ok) {
    // El desafío, su error o una página sin cargar: la pestaña queda abierta para volver a tocar el ícono.
    pantallaSpy(datos?.motivo === 'desafio' ? 'Falta pasar la verificación' : 'No se guardó', datos?.error || 'No pude hablar con MaKo.');
    return;
  }
  pantallaSpy('Guardada en «Sus páginas»', datos.titulo || '');
  // El worker cierra esta pestaña y vuelve a Spy, que la muestra sola.
  await enviar({ tipo: 'SPY_CAPTURA_LISTA', tabId: p.tabId });
  window.close();
}

// ── «Replicar esta página» (0.79.0, 9/11/2026) ─────────────────────────────────────────────────────────
// Martín: «habíamos quedado en actualizar la extensión de Mako para que se pueda replicar por allí». La foto de la copia
// idéntica sale en ESTA pestaña, con lo que la persona ya ve: si había que comprobar que es una persona, ya lo hizo ella. Dos
// entradas: la pestaña que abrió Replicar de MaKo («Replicar con la extensión», anotada en `replicas` por el worker), o
// cualquier página desde el inicio. La lectura la inyecta este desplegable con `func: MakoReplicaLeer` (replica-leer.js, el
// mismo código que el lector de MaKo, generado desde lib/): corre en el mundo aislado, baja por la página, vuelve a donde
// estaba y manda la foto al worker, que se la da a MaKo. El desplegable puede cerrarse: la lectura sigue sola.
let replica = { hay: null };

/** La réplica que MaKo pidió para ESTA pestaña, si la hay. Sin `tab.url`, Chrome no dio la pestaña. */
async function replicaPendiente() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab?.id || !tab.url) return null;
  const { replicas } = await chrome.storage.session.get('replicas').catch(() => ({}));
  const p = replicas && replicas[String(tab.id)];
  return p && p.pedido && typeof p.url === 'string' ? { tabId: tab.id, url: p.url, pedida: true } : null;
}

/** ¿Esta pestaña se puede replicar? Una página web que no sea de MaKo ni una de sus herramientas (Flow, WhatsApp Web). */
async function prepararReplica() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const u = String(tab?.url || '');
  if (!tab?.id || !/^https?:[/][/]/.test(u)) return false;
  if (/^https?:[/][/](?:hola-mako\.com|localhost)(?:[:/?#]|$)/.test(u)) return false;
  if (/^https:[/][/](?:web\.whatsapp\.com|flow\.google\.com|labs\.google)(?:[/?#]|$)/.test(u)) return false;
  replica = { hay: { tabId: tab.id, url: u } };
  return true;
}

/** Lo que dice el desplegable cuando la foto no salió (el motivo lo manda la lectura). */
const RAZON_REPLICA = {
  vacia: ['No vi nada que copiar', 'Espera a que la página termine de cargar y vuelve a tocar el ícono de MaKo.'],
  pesada: ['Esta página pesa demasiado', 'Es muy grande para copiarla tal cual. En MaKo puedes replicarla como «Landing».'],
  excepcion: ['No pude copiarla', 'Recárgala y vuelve a tocar el ícono de MaKo.'],
  ocupada: ['Ya la estoy copiando', 'Espera unos segundos.'],
};

/** Lo que va llegando de la lectura en la pestaña (con SU nonce): el avance y el final. */
function escucharReplica(nonce) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.nonce !== nonce || vista.pantalla !== 'replica') return false;
    if (msg.tipo === 'REPLICA_AVANCE') {
      const n = Math.max(0, Math.min(100, Number(msg.hecho) || 0));
      pantallaSpy(msg.fase === 'foto' ? 'Sacando la foto…' : `Copiando esta página… ${n} %`, 'Bajo por la página para que cargue entera y vuelvo arriba. No la toques mientras tanto.');
    } else if (msg.tipo === 'REPLICA_FOTO') {
      if (msg.ok === true) {
        pantallaSpy('Copiada', 'Sigue en MaKo: ahí eliges qué replicar.');
        setTimeout(() => window.close(), 1500);
      } else {
        const [t, linea] = RAZON_REPLICA[msg.motivo] || RAZON_REPLICA.excepcion;
        pantallaSpy(t, linea);
      }
    }
    return false;
  });
}

async function replicarPagina(p) {
  vista = { pantalla: 'replica' };
  $('atras').hidden = !p.desdeInicio;
  $('donde').textContent = DONDE.replica;
  pantallaSpy('Preparando…');
  const r = await enviar({ tipo: 'REPLICA_EMPEZAR', tabId: p.tabId });
  if (!r?.ok || typeof r.nonce !== 'string') {
    pantallaSpy('No pude copiar esta pestaña', 'Recárgala y vuelve a tocar el ícono de MaKo.');
    return;
  }
  escucharReplica(r.nonce);
  if (!r.yaLeyendo) {
    let res = null;
    try {
      const [x] = await chrome.scripting.executeScript({ target: { tabId: p.tabId }, world: 'ISOLATED', func: MakoReplicaLeer, args: [{ nonce: r.nonce }] });
      res = x?.result ?? null;
    } catch { res = null; }
    if (!res?.ok) {
      const [t, linea] = RAZON_REPLICA[res?.motivo] || RAZON_REPLICA.excepcion;
      pantallaSpy(t, linea);
      return;
    }
  }
  pantallaSpy('Copiando esta página…', 'Bajo por la página para que cargue entera y vuelvo arriba. No la toques mientras tanto.');
}

/** «hoy 10:32» o «24/10 10:32». */
function cuandoFue(ms) {
  const d = new Date(Number(ms) || 0);
  const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString() ? `hoy ${hora}` : `${d.getDate()}/${d.getMonth() + 1} ${hora}`;
}

const miles = (n) => (Number(n) || 0).toLocaleString('es');

/** Cómo terminó, en dos o tres palabras (la fila del registro). */
function comoTermino(e) {
  if (enCurso(e)) return 'en curso';
  if (e.estado === 'listo') return `${miles(e.nombres)} ${Number(e.nombres) === 1 ? 'nombre' : 'nombres'}`;
  if (e.estado === 'parado') return 'la paraste';
  return 'no se pudo';
}

/**
 * CÓMO ESTÁ TU WHATSAPP WEB, arriba del registro (0.72.3). Lo mismo que el desplegable hace con Google Flow («Preparo todo y
 * empezamos», «Inicia sesión en Google Flow»): una línea y, si hace falta, UN botón que lo resuelve. Martín, 26/10: «revisa
 * las cosas que tenemos en la extensión de Flow para replicarlas en Scraper». Sólo mira: abrir lo abre el botón (y nunca una
 * segunda pestaña: `WA_ENFOCAR` pone al frente la que hay, y abre una sólo si no hay ninguna).
 */
let turnoEstadoWa = 0;
async function estadoWhatsapp(caja) {
  const turno = ++turnoEstadoWa;
  const s = await enviar({ tipo: 'WA_ESTADO' });
  if (turno !== turnoEstadoWa || !caja.isConnected || !s) return;
  const ir = (texto) => {
    const b = nodo('button', 'suave', texto);
    b.type = 'button';
    b.addEventListener('click', () => { b.disabled = true; void enviar({ tipo: 'WA_ENFOCAR' }).then(() => window.close()); });
    return b;
  };
  caja.textContent = '';
  if (s.pestana === false) {
    caja.append(nodo('div', 'tenue', 'Tu WhatsApp Web no está abierto. Al extraer lo abro solo, o ábrelo ahora.'), ir('Abrir WhatsApp Web'));
  } else if (s.sesion === 'qr') {
    caja.append(nodo('div', 'tenue', 'Tu WhatsApp Web pide escanear el QR. Escanéalo antes de extraer (o al extraer: te espero unos minutos).'), ir('Ir a WhatsApp Web'));
  } else if (s.sesion === 'lista') {
    caja.append(nodo('div', 'tenue', 'Tu WhatsApp Web está listo.'));
  } else if (s.pestana) {
    caja.append(nodo('div', 'tenue', 'Tu WhatsApp Web se está preparando: al extraer lo pongo a punto.'));
  }
}

function dibujarRegistro(lista) {
  const cuerpo = $('cuerpo');
  cuerpo.textContent = '';
  const estadoWa = nodo('div', 'estado-wa');
  void estadoWhatsapp(estadoWa);
  if (!lista.length) {
    cuerpo.appendChild(nodo('h1', '', 'Todavía no extrajiste nada'));
    cuerpo.appendChild(nodo('div', 'tenue', 'En el CRM de MaKo: Nuevo lead › Scraper › el grupo › «Extraer». Lo vas a ver acá, paso a paso.'));
    const b = nodo('button', '', 'Ir al CRM');
    b.type = 'button';
    b.addEventListener('click', () => void abrirMakoEn('/crm'));
    cuerpo.appendChild(b);
    cuerpo.appendChild(estadoWa);
    return;
  }
  cuerpo.appendChild(nodo('h1', '', 'Tus extracciones'));
  cuerpo.appendChild(estadoWa);
  const caja = nodo('div', 'registro');
  for (const e of lista) {
    const b = nodo('button', 'fila');
    b.type = 'button';
    b.title = e.titulo || '';
    if (enCurso(e)) b.appendChild(nodo('span', 'vivo'));
    b.appendChild(nodo('span', 'nom', e.titulo || 'Tus contactos'));
    b.appendChild(nodo('span', 'meta', `${cuandoFue(e.cuando)} · ${comoTermino(e)}`));
    b.addEventListener('click', () => void ir({ pantalla: 'extraccion', id: e.id }));
    caja.appendChild(b);
  }
  cuerpo.appendChild(caja);
}

// Las fases que ve la persona, y qué pasos del worker / de WhatsApp Web / de MaKo cae en cada una.
const FASES = [
  { texto: 'Abro tu WhatsApp', pasos: ['abriendo', 'cargando', 'qr'] },
  { texto: 'Entro al grupo', pasos: ['buscando', 'entrando'] },
  { texto: 'Leo los miembros', pasos: ['miembros', 'recorriendo', 'parando'] },
  { texto: 'Junto los nombres', pasos: ['leyendo'] },
  { texto: 'Leo sus perfiles', pasos: ['perfiles'] },
  { texto: 'Los guardo en MaKo', pasos: ['guardando'] },
];
/** Lo que se dice mientras WhatsApp Web pide el QR (el worker espera cinco minutos con la pestaña al frente). */
const TEXTO_QR = 'Escanea el QR en WhatsApp Web: en tu teléfono, WhatsApp › Dispositivos vinculados › Vincular un dispositivo. Te espero unos minutos y sigo sola.';
const TEXTO_A_LA_VISTA = 'En tu WhatsApp Web, a la vista. No toques nada mientras tanto.';
/** WhatsApp Web corre oculta (27/10/2026): Chrome la frena y la lista se arrastra (el «11 de 126»). */
const TEXTO_OCULTA = 'Chrome quedó tapado por otra ventana y así va lento: tráelo al frente.';
const MOTIVO = {
  sin_sesion: 'No se escaneó el QR de WhatsApp Web a tiempo. Escanéalo y vuelve a tocar «Extraer» en MaKo.',
  sin_respuesta_wa: 'WhatsApp Web no contestó. Recarga esa pestaña y vuelve a tocar «Extraer».',
  recargar_whatsapp_web: 'Recarga la pestaña de WhatsApp Web y vuelve a tocar «Extraer».',
};
/** Un punto por miembro hasta este tope; en un grupo más grande, cada punto es un puñado. */
const TOPE_PUNTOS = 240;

/** Lo que ya está dibujado de la extracción a la vista: los avances sólo cambian números y clases (la animación no se corta). */
let armada = null;

function dibujarExtraccion(e) {
  const cuerpo = $('cuerpo');
  if (!e) {
    armada = null;
    cuerpo.textContent = '';
    cuerpo.appendChild(nodo('h1', '', 'Esa extracción ya no está'));
    cuerpo.appendChild(nodo('div', 'tenue', 'El registro guarda las últimas 30.'));
    return;
  }
  const viva = enCurso(e);
  const estado = viva ? 'corriendo' : e.estado === 'corriendo' ? 'cortada' : e.estado;
  if (!armada || armada.id !== e.id || armada.estado !== estado) armada = armarExtraccion(cuerpo, e, estado);
  const a = armada;

  // Los puntos: los leídos se encienden, y de ésos, los que traen nombre van en azul (repartidos parejo).
  const miembros = Number(e.miembros) || 0;
  const k = Math.max(1, Math.ceil(miembros / TOPE_PUNTOS));
  const cuantos = Math.min(TOPE_PUNTOS, Math.ceil((miembros || 0) / k));
  if (a.puntos && a.puntos.childElementCount !== cuantos) {
    a.puntos.textContent = '';
    for (let i = 0; i < cuantos; i++) a.puntos.appendChild(document.createElement('i'));
  }
  if (a.puntos) {
    const leidos = Math.min(cuantos, Math.floor((Number(e.vistos) || 0) / k));
    const azules = Math.min(leidos, Math.floor((Number(e.conNombre) || 0) / k));
    Array.from(a.puntos.children).forEach((p, j) => {
      const azul = j < leidos && Math.floor(((j + 1) * azules) / leidos) > Math.floor((j * azules) / leidos);
      p.className = azul ? 'n' : j < leidos ? 'v' : '';
    });
  }

  if (estado === 'corriendo') {
    // Con el QR a la vista, la línea de abajo del título dice qué hacer (como «Inicia sesión en Google Flow»).
    // Con WhatsApp Web oculta (Chrome tapado), eso primero: es por qué se arrastra, y se arregla trayendo Chrome al frente.
    a.tenue.textContent = e.fase === 'qr' ? TEXTO_QR : e.oculta ? TEXTO_OCULTA : e.fase === 'perfiles' && e.ahora ? e.ahora : TEXTO_A_LA_VISTA;
    const i = Math.max(0, FASES.findIndex((f) => f.pasos.includes(e.fase)));
    a.fases.forEach((li, j) => { li.className = j < i ? 'hecha' : j === i ? 'ahora' : ''; li.firstChild.textContent = j < i ? '✓' : ''; });
    if (e.fase === 'perfiles' && Number(e.perfilesTotal) > 0) {
      a.conteo.firstChild.textContent = `${miles(e.perfilesHechos)}`;
      a.conteo.lastChild.textContent = `de ${miles(e.perfilesTotal)} perfiles`;
    } else if (e.fase === 'guardando' && Number(e.total) > 0 && e.guardados != null) {
      a.conteo.firstChild.textContent = `${miles(e.guardados)}`;
      a.conteo.lastChild.textContent = `de ${miles(e.total)} guardados`;
    } else if (miembros) {
      a.conteo.firstChild.textContent = `${miles(Math.min(Number(e.vistos) || 0, miembros))}`;
      a.conteo.lastChild.textContent = `de ${miles(miembros)} miembros · ${miles(e.conNombre)} con nombre`;
    } else {
      a.conteo.firstChild.textContent = '';
      a.conteo.lastChild.textContent = '';
    }
  }
}

/** Arma la pantalla de una extracción según cómo está (corriendo, lista, parada, con error o cortada). */
function armarExtraccion(cuerpo, e, estado) {
  cuerpo.textContent = '';
  const out = { id: e.id, estado, puntos: null, fases: [], conteo: null, tenue: null };
  cuerpo.appendChild(nodo('h1', 'grupo', e.titulo || 'Tus contactos'));
  if (estado === 'corriendo') {
    out.tenue = nodo('div', 'tenue', TEXTO_A_LA_VISTA);
    cuerpo.appendChild(out.tenue);
    out.conteo = nodo('div', 'conteo');
    out.conteo.append(document.createTextNode(''), nodo('small'));
    cuerpo.appendChild(out.conteo);
    out.puntos = nodo('div', 'puntos');
    out.puntos.setAttribute('aria-hidden', 'true');
    cuerpo.appendChild(out.puntos);
    const ol = nodo('ol', 'fases');
    for (const f of FASES) {
      const li = nodo('li');
      li.append(nodo('span', 'marca-fase'), document.createTextNode(f.texto));
      ol.appendChild(li);
      out.fases.push(li);
    }
    cuerpo.appendChild(ol);
    const parar = nodo('button', 'suave', 'Parar');
    parar.type = 'button';
    parar.addEventListener('click', () => { parar.disabled = true; parar.textContent = 'Parando…'; void enviar({ tipo: 'WA_PARAR', id: e.id }); });
    cuerpo.appendChild(parar);
    return out;
  }
  if (estado === 'listo') {
    const c = nodo('div', 'conteo');
    c.append(document.createTextNode(miles(e.nombres)), nodo('small', '', Number(e.nombres) === 1 ? 'nombre en MaKo' : 'nombres en MaKo'));
    cuerpo.appendChild(c);
    if (e.miembros) {
      out.puntos = nodo('div', 'puntos');
      out.puntos.setAttribute('aria-hidden', 'true');
      cuerpo.appendChild(out.puntos);
    }
    if (e.texto) cuerpo.appendChild(nodo('div', 'tenue', e.texto));
    if (Number(e.perfiles) > 0) cuerpo.appendChild(nodo('div', 'tenue', `${miles(e.perfiles)} con links, redes o correo de su perfil.`));
  } else if (estado === 'parado') {
    cuerpo.appendChild(nodo('div', 'tenue', 'La paraste. Lo que ya estaba guardado queda; para seguir, vuelve a tocar «Extraer» en MaKo.'));
  } else if (estado === 'cortada') {
    cuerpo.appendChild(nodo('div', 'tenue', 'Se cortó a mitad de camino (el navegador cerró la extensión). Vuelve a tocar «Extraer» en MaKo.'));
  } else {
    cuerpo.appendChild(nodo('div', 'tenue', MOTIVO[e.motivo] || e.texto || 'No se pudo. Vuelve a tocar «Extraer» en MaKo.'));
  }
  if (e.noEncontrado) cuerpo.appendChild(nodo('div', 'tenue', `No encontré «${e.noEncontrado}» entre tus chats.`));
  if (e.volver === 'sin_pestana') cuerpo.appendChild(nodo('div', 'tenue', 'La pestaña de MaKo desde la que extrajiste ya no está abierta.'));
  cuerpo.appendChild(nodo('div', 'tenue', cuandoFue(e.cuando)));
  const b = nodo('button', '', 'Ver en MaKo');
  b.type = 'button';
  // A la pestaña desde la que se tocó «Extraer» (puede haber varios CRM abiertos); si ya no está, el CRM.
  b.addEventListener('click', () => void abrirMakoEn('/crm', e.origenTab));
  cuerpo.appendChild(b);
  return out;
}

/** La pestaña `preferida` (la de origen de una extracción), si sigue abierta; si no, la de MaKo que ya está; si no, una en `ruta`. */
async function abrirMakoEn(ruta, preferida) {
  const propia = preferida != null ? await chrome.tabs.get(preferida).catch(() => null) : null;
  const t = propia || await pestanaDeMako();
  if (t) {
    await chrome.tabs.update(t.id, { active: true }).catch(() => {});
    await chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
  } else {
    await chrome.tabs.create({ url: `${ORIGEN_MAKO}${ruta}` });
  }
  window.close();
}

async function arrancar() {
  try { $('version').textContent = 'v' + chrome.runtime.getManifest().version; } catch { /* nada */ }
  try { const { workspaceNombre } = await chrome.storage.local.get('workspaceNombre'); $('ws').textContent = workspaceNombre || ''; } catch { /* nada */ }
  $('atras').addEventListener('click', () => void ir({ pantalla: ATRAS[vista.pantalla] || 'inicio' }));
  const lista = await registro();
  let guardada = null;
  try { guardada = (await chrome.storage.local.get('popupVista')).popupVista || null; } catch { /* nada */ }
  // La pestaña que abrió «Replicar con la extensión» de MaKo: tocar el ícono es copiarla (lo mismo que con «Capturar»).
  const aReplicar = await replicaPendiente().catch(() => null);
  if (aReplicar) { await replicarPagina(aReplicar); return; }
  // La pestaña que abrió «Capturar» de Spy: tocar el ícono es capturarla, y no hay otra cosa que hacer acá.
  const pendiente = await capturaPendiente().catch(() => null);
  if (pendiente) { await capturarPagina(pendiente); return; }
  const viva = lista.find(enCurso);
  const conSpy = await prepararSpy().catch(() => false);
  const conPerfil = await prepararPerfil().catch(() => false);
  await prepararReplica().catch(() => false);
  if (viva) vista = { pantalla: 'extraccion', id: viva.id };
  // Abierto sobre el perfil de una persona, «Guardar en MaKo» está en el inicio: la pantalla donde se dejó lo escondería.
  else if (conPerfil) vista = { pantalla: 'inicio' };
  // Abierto sobre lo que ya es de un competidor o sobre sus anuncios, esto es lo que se vino a hacer: la
  // pantalla donde se dejó la última vez lo escondería.
  else if (conSpy && (spy.ficha || spy.hay?.tipo === 'anuncios')) vista = { pantalla: 'inicio' };
  else if (guardada && guardada.pantalla !== 'spy' && guardada.pantalla !== 'perfil' && guardada.pantalla !== 'replica' && ATRAS[guardada.pantalla] !== undefined) {
    // Una extracción terminada hace rato no es «donde se dejó»: su lugar es el registro.
    const e = guardada.pantalla === 'extraccion' ? lista.find((x) => x.id === guardada.id) : null;
    vista = guardada.pantalla === 'extraccion' && (!e || Date.now() - (Number(e.actualizado) || 0) > 10 * 60000) ? { pantalla: 'scraper' } : guardada;
  }
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local' || !c.extracciones) return;
    const nueva = Array.isArray(c.extracciones.newValue) ? c.extracciones.newValue : [];
    if (vista.pantalla === 'scraper') dibujarRegistro(nueva);
    else if (vista.pantalla === 'extraccion') dibujarExtraccion(nueva.find((e) => e && e.id === vista.id) || null);
    else if (vista.pantalla === 'inicio') dibujarInicio(nueva);
  });
  await dibujar();
}

void arrancar();
