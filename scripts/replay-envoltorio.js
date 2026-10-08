// =============================================================================
// El envoltorio del grabador — lo que `public/replay/2/r.js` agrega sobre rrweb
// =============================================================================
// `scripts/replay-libs.mjs` arma `public/replay/2/r.js` pegando ESTE archivo
// detrás del bundle de rrweb, sin sus comentarios de línea entera (los paga la
// descarga del visitante). La v1 es rrweb pelado y no se toca: una versión
// publicada es inmutable, está en la caché de los visitantes.
//
// ⚠️ POR QUÉ EXISTE: EL GRABADOR DE VERDAD VIVE EN EL SNIPPET, NO ACÁ. El lote,
// el piso (10 s y 20 eventos), el beacon de salida y la cola están dentro del
// código pegado en la página del cliente (lib/landing-token.ts, «GRABACIÓN DE
// SESIÓN»), y ese código no se puede cambiar sin que el cliente lo vuelva a
// pegar. Lo único que el servidor puede cambiar sin repegar es QUÉ archivo baja
// el snippet (`/replay/<rec.v>/r.js`, con la versión que contesta el pageview).
// Así que todo lo de acá trabaja desde afuera, sobre lo que el snippet llama:
// `window.rrwebRecord(opciones)` y la función de stop que devuelve.
//
// MEDIDO EN PRODUCCIÓN el 08/10/2026 (ws1, 150 visitantes con Pixel que graba):
// 32 con sesión, y 0 de los 35 que estuvieron entre 10 y 30 s. Tres causas, y
// cada una tiene su arreglo acá abajo:
//
//   1. La foto inicial (el FullSnapshot) de multiplicatusresultados.com pesa
//      ~115 KB, 70 de ellos de CSS que rrweb copia adentro (inlineStylesheet).
//      Si la persona se va antes del primer lote por fetch, el snippet la manda
//      por sendBeacon SIN comprimir, supera los 64 KiB de la cuota y la TIRA sin
//      avisar. → se graba con `inlineStylesheet: false`.
//   2. El piso pide 20 eventos, y quien mira el VSL (un iframe de otro dominio
//      que no genera eventos) sin tocar nada no llega nunca. → un latido.
//   3. Al esconder la pestaña por debajo del piso, el snippet vacía la cola con la
//      foto adentro, y rrweb no saca otra al volver: la sesión queda sin foto y no
//      se puede reproducir. → una foto nueva cada vez que la pestaña vuelve.
//
// ⚠️ UN ERROR ACÁ NO PUEDE ROMPER LA PÁGINA DEL CLIENTE. Todo va en try/catch y
// el peor caso tiene que ser «no graba», nunca una excepción en su consola o un
// script suyo que deja de correr.
// =============================================================================
;(function () {
  'use strict';
  try {
    var original = window.rrwebRecord;
    // Ya envuelto (el archivo se evaluó dos veces) o no hay rrweb: no se toca nada.
    if (typeof original !== 'function' || original.mkoEnvoltorio) return;

    // EL LATIDO. Quien mira sin tocar no genera eventos de rrweb, y el piso del
    // snippet pide 20. Medio segundo es lo que hace falta para llegar a los 20
    // en los mismos 10 s del piso de tiempo (los 2 primeros son la foto); con uno
    // por segundo recién llegaría a los ~18 s y el tramo de 10-30 s seguiría vacío.
    var LATIDO_RAPIDO_MS = 500;
    // 30 latidos rápidos son 15 s visibles: el piso (10 s y 20 eventos) con margen.
    var LATIDOS_RAPIDOS = 30;
    // Después, uno cada 8 s. ⚠️ TIENE QUE SER MENOR QUE LOS 10 s DE UN LOTE: el
    // snippet suma el hueco entre dos eventos topeado en 10 s (RMS), y ese número
    // es la duración que la ficha muestra. Con un latido más espaciado, una visita
    // de 5 minutos mirando el video quedaría registrada como de un minuto.
    var LATIDO_LENTO_MS = 8000;
    // El reproductor ignora los eventos Custom: no dibujan nada ni cuentan como
    // actividad, así que el «saltar lo inactivo» del reproductor los pasa de largo.
    var ETIQUETA = 'mko-vivo';

    var propio = function (obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); };

    var envuelto = function (opciones) {
      var o = {};
      if (opciones) for (var k in opciones) if (propio(opciones, k)) o[k] = opciones[k];
      // ⚠️ LA ÚNICA OPCIÓN QUE SE CAMBIA, Y SÓLO ÉSTA. Las de privacidad
      // (maskAllInputs, maskTextSelector, blockClass…) llegan del snippet y pasan
      // tal cual: este archivo no puede ser una puerta para bajarlas.
      //
      // Con la hoja adentro, la foto de ws1 pesa ~115 KB y no entra en el beacon de
      // 64 KiB; sin ella, el <link> queda como un link y la foto baja a lo que mide
      // el DOM. EL COSTO: el reproductor carga la hoja VIVA de la página del cliente,
      // así que una grabación vieja se ve con el estilo de hoy, o sin estilo si el
      // archivo ya no existe (Vite y Lovable le cambian el nombre en cada deploy).
      o.inlineStylesheet = false;

      var detener = original(o);
      // rrweb devuelve undefined cuando falla al arrancar (lo atrapa él mismo). Sin
      // grabación no hay nada que acompañar, y el snippet recibe lo mismo que hoy.
      if (typeof detener !== 'function') return detener;

      var vivo = true, timer = 0, latidos = 0;

      var visible = function () {
        try { return document.visibilityState !== 'hidden'; } catch (e) { return true; }
      };
      var parar = function () {
        if (timer) { try { clearTimeout(timer); } catch (e) {} timer = 0; }
      };
      var programar = function () {
        parar();
        // ⚠️ SÓLO CON LA PESTAÑA A LA VISTA. El tope de 10 minutos del snippet se
        // mide en tiempo grabado; latir escondida se lo comería en una pestaña
        // olvidada, y llenaría la sesión de eventos que no muestran nada.
        if (!vivo || !visible()) return;
        timer = setTimeout(latir, latidos < LATIDOS_RAPIDOS ? LATIDO_RAPIDO_MS : LATIDO_LENTO_MS);
      };
      var latir = function () {
        timer = 0;
        if (!vivo || !visible()) return;
        // ⚠️ addCustomEvent TIRA si rrweb todavía no arrancó (la página seguía
        // cargando) o si ya paró: «please add custom event after start recording».
        // El stop envuelto de abajo corta el latido, y esto cubre lo demás.
        try { original.addCustomEvent(ETIQUETA, {}); latidos++; } catch (e) {}
        programar();
      };
      var alCambiar = function () {
        if (!vivo) return;
        if (!visible()) { parar(); return; }
        // LA FOTO NUEVA AL VOLVER. Si la pestaña se escondió antes del piso, el
        // snippet tiró la cola con la foto adentro; si se escondió después, la foto
        // ya salió y ésta sobra, pero cuesta lo que pesa una foto comprimida. Desde
        // acá no se ve cuál de los dos pasó, y una sesión sin foto no se puede mirar.
        try { original.takeFullSnapshot(true); } catch (e) {}
        programar();
      };

      try { document.addEventListener('visibilitychange', alCambiar); } catch (e) {}
      programar();

      // ⚠️ EL STOP SE ENVUELVE, Y NO ES PROLIJIDAD. El snippet llama a esta función
      // al llegar al tope (10 minutos o 2 MiB): sin cortar el latido, la página del
      // cliente tiraría «please add custom event after start recording» cada 8 s
      // para siempre — atrapado acá, pero trabajando para nada.
      return function () {
        vivo = false;
        parar();
        try { document.removeEventListener('visibilitychange', alCambiar); } catch (e) {}
        return detener.apply(this, arguments);
      };
    };

    // Todo lo que rrweb cuelga de su función (addCustomEvent, takeFullSnapshot,
    // freezePage, mirror) sigue estando: hoy el snippet sólo la llama, pero un
    // snippet futuro que use otra cosa no puede encontrarse con un hueco.
    for (var p in original) if (propio(original, p)) envuelto[p] = original[p];
    envuelto.mkoEnvoltorio = 2;
    window.rrwebRecord = envuelto;
  } catch (e) {}
})();
