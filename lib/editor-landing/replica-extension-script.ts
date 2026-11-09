// =============================================================================
// editor-landing/replica-extension-script — la foto de la copia idéntica, en la PESTAÑA REAL de la persona (9/11/2026)
// =============================================================================
// Martín (4/11/2026, 16:13 UTC): «Pero podemos hacerlo con la extension de mako... Muchas extensiones capturan sitios
// web... Yo no quiero vulnerar a nadie, solo quiero capturar el diseño». Y hoy (9/11, 15:48 UTC): «habíamos quedado en
// actualizar la extensión de Mako para que se pueda replicar por allí. Y de esa manera siempre vamos a poder replicar
// cualquier landing».
//
// POR QUÉ HACE FALTA (docs/editor-landing/pendientes-web-generator.md §1.1): Replicar, «Leer en tu navegador» y «Sus
// páginas» de Spy dependen de que el SERVIDOR de MaKo baje la página. La ventana del lector no abre la página real: abre la
// copia que bajó el servidor. Con un antibots (Cloudflare «Just a moment...», el «Vercel Security Checkpoint»), un 401/403/
// 429 o una app de Vite en módulos que no corre aislada, fallan las tres. La barrera no se evade: la pasa la persona en SU
// navegador, y desde ahí se saca la misma foto que saca el lector.
//
// QUÉ ES ESTO: la función que corre en esa pestaña, ya armada con las MISMAS piezas del lector (copia-identica-script.ts:
// lo de antes de bajar, la cara visible en cada paso y la instantánea). `scripts/sync-replica-extension.mjs` la escribe en
// `extension/replica-leer.js` (Manifest V3 no deja correr código bajado de afuera: viaja en el paquete) y el pre-push falla
// si quedó vieja. ⚠️ Cada cambio acá es una versión nueva de la extensión que pasa por la tienda: lo que corre en la pestaña
// es tonto a propósito, y lo que se juzga (si es la página o el desafío, si pesa demasiado para copiarla) lo decide MaKo.
//
// LA REGLA PROPIA DE ESTA LECTURA (choca con la de AGENTS.md, «La extensión en el sitio de un tercero»: «no escribe nada
// ahí… ni la pantalla»). La copia idéntica NECESITA bajar por la página para que se cargue lo perezoso y se vea lo que
// aparece al bajar. Así que ésta es la única lectura de la extensión que MUEVE LA PANTALLA de un sitio ajeno, y sólo así:
//   · corre después del toque de la persona en el ícono de MaKo, en la pestaña que eligió, y una vez;
//   · sólo baja (`window.scrollTo`) y al terminar vuelve a donde estaba la persona. Ni clics, ni foco, ni teclas;
//   · de un campo copia sólo lo que trae la página, nunca lo tipeado (`soloDeLaPagina` de JS_INSTANTANEA);
//   · no lee cookies ni almacenamiento, no pide nada a la red y no escribe en la página. Lo que saca se lo da a la extensión
//     (`chrome.runtime.sendMessage`), y la extensión se lo pasa a la pestaña de MaKo de la persona;
//   · corre en el mundo AISLADO: no ve las variables de la página ni la página ve las suyas;
//   · la dirección viaja sin su consulta ni su ancla (ahí van los datos de quien la visita).
// Lo fija tests/replicar-extension.test.ts, corriéndola con un DOM y un reloj de mentira.
//
// ⚠️ ES JAVASCRIPT PLANO ADENTRO DE UN `String.raw` (las reglas de lector-script.ts): sin backticks, sin el signo de pesos
//    con llave y sin barra-asterisco (los tests de la extensión quitan comentarios con una regex, AGENTS.md).
// =============================================================================

import { JS_ANTES_DE_BAJAR, JS_INSTANTANEA, JS_MIRAR_VISIBLES } from './copia-identica-script';

/** La versión de la extensión que sabe replicar (la pantalla pide actualizar si la instalada es más vieja). */
export const VERSION_REPLICA = '0.79.0';

/**
 * Lo más que puede pesar la foto (su JSON). El pedido a /api/landing-generator/replicar topa en 4,2 MB (Vercel corta a 4,5
 * sin decir por qué, `TOPE_PEDIDO_FOTO` en crear/Replicar.tsx): se deja aire para la dirección y el sobre.
 */
export const TOPE_FOTO_EXTENSION = 4_150_000;

/** Lo más que dura la lectura en la pestaña: la bajada se corta ahí y la foto se saca IGUAL, con lo que haya. */
export const TOPE_REPLICA_MS = 60_000;

/** Lo que se lleva del texto que se ve (para «Leer»: la estructura y los ángulos sin bajar la página). */
export const TOPE_TEXTO_REPLICA = 60_000;

/** Por qué no salió la foto en la pestaña (lo dice la pantalla, `mensajeDeReplica` en replica-extension-cliente.ts). */
export const MOTIVOS_REPLICA = ['vacia', 'pesada', 'excepcion', 'ocupada'] as const;
export type MotivoReplica = (typeof MOTIVOS_REPLICA)[number];

/**
 * La función que corre en la pestaña: `(op: { nonce }) => { ok, empezo } | { ok: false, motivo: 'ocupada' }`. Contesta en el
 * acto y sigue sola: el desplegable puede cerrarse (la persona toca la página) y el worker puede dormirse; lo que se va
 * leyendo y el final llegan como mensajes (`REPLICA_AVANCE`, `REPLICA_FOTO`), con su `nonce`, que es lo que el worker mira.
 */
export const JS_REPLICA_EN_LA_PESTANA = String.raw`function (op) {
  var NONCE = String((op && op.nonce) || '');
  var mandar = function (m) {
    m.nonce = NONCE;
    try { chrome.runtime.sendMessage(m, function () { void chrome.runtime.lastError; }); } catch (e) {}
  };
  if (window.__mkReplica) return { ok: false, motivo: 'ocupada' };
  window.__mkReplica = 1;
  var T0 = Date.now();
  var tarde = function () { return Date.now() - T0 > ` + TOPE_REPLICA_MS + String.raw`; };
  var esperar = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
  var irA = function (x, y) { try { window.scrollTo({ left: x, top: y, behavior: 'instant' }); } catch (e) { try { window.scrollTo(x, y); } catch (z) {} } };
  var cargado = function (tope) {
    return new Promise(function (ok) {
      if (document.readyState === 'complete') return ok();
      var t = setTimeout(ok, Math.max(0, tope));
      window.addEventListener('load', function () { clearTimeout(t); ok(); }, { once: true });
    });
  };
  var esperarQuieto = function (quieto, tope) {
    return new Promise(function (ok) {
      var ini = Date.now(), ultimo = Date.now(), mo = null;
      try {
        mo = new MutationObserver(function () { ultimo = Date.now(); });
        mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      } catch (e) {}
      (function mirar() {
        var t = Date.now();
        if (t - ultimo >= quieto || t - ini >= tope || tarde()) { if (mo) mo.disconnect(); ok(); return; }
        setTimeout(mirar, 80);
      })();
    });
  };
  // Una dirección sin su consulta ni su ancla: ahí viajan los datos de quien la visita (un utm, un correo, un fbclid).
  var sinConsulta = function (u) { try { var x = new URL(String(u)); return x.origin + x.pathname; } catch (e) { return ''; } };
  var textoVisible = function () {
    try { return String((document.body && document.body.innerText) || '').replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, ` + TOPE_TEXTO_REPLICA + String.raw`); } catch (e) { return ''; }
  };
  var alto = function () { return Math.max(document.documentElement.scrollHeight || 0, document.body ? document.body.scrollHeight || 0 : 0); };
  var antesDeBajar = ` + JS_ANTES_DE_BAJAR + String.raw`;
  var mirarVisibles = ` + JS_MIRAR_VISIBLES + String.raw`;
  var instantanea = ` + JS_INSTANTANEA + String.raw`;

  (async function () {
    var x0 = window.scrollX || 0, y0 = window.scrollY || 0;
    var final = { tipo: 'REPLICA_FOTO', ok: false };
    try {
      mandar({ tipo: 'REPLICA_AVANCE', fase: 'cargando', hecho: 0 });
      await cargado(10000);
      await esperarQuieto(800, 8000);
      // Lo de una vuelta anterior (la persona tocó el ícono otra vez) no cuenta para esta.
      window.__mkVistos = new Map();
      window.__mkAntes = null;
      try { antesDeBajar(); } catch (e) {}
      // La bajada del lector con la foto pedida (lector-script.ts → bajarYSubir): lo que se arma al verse mete SU hoja recién
      // ahí. Sin clics: sólo bajar, mirar la cara visible en cada paso y volver arriba.
      var paso = Math.max(300, Math.floor((window.innerHeight || 800) * 0.7)), y = 0;
      try { mirarVisibles(); } catch (e) {}
      for (var n = 0; n < 90 && !tarde(); n++) {
        y += paso;
        var h = alto();
        if (y >= h) break;
        irA(0, y);
        await esperar(250);
        try { mirarVisibles(); } catch (e) {}
        if (n % 4 === 3) mandar({ tipo: 'REPLICA_AVANCE', fase: 'bajando', hecho: Math.min(95, Math.round((y / Math.max(1, h)) * 100)) });
      }
      await esperar(1000);
      irA(0, 0);
      await esperarQuieto(300, 1500);
      mandar({ tipo: 'REPLICA_AVANCE', fase: 'foto', hecho: 98 });
      var url = sinConsulta(location.href);
      var foto = instantanea({ soloDeLaPagina: true });
      final.url = url;
      final.titulo = String(document.title || '').slice(0, 300);
      final.parcial = tarde();
      if (!foto || !/\S/.test(String(foto.cuerpo || ''))) {
        final.motivo = 'vacia';
      } else {
        var crudo = String(location.href).split('#')[0];
        foto.url = url;
        if (String(foto.base || '').split('#')[0] === crudo) foto.base = url;
        for (var k = 0; k < foto.hojas.length; k++) if (foto.hojas[k].base && String(foto.hojas[k].base).split('#')[0] === crudo) foto.hojas[k].base = url;
        var peso = JSON.stringify(foto).length;
        final.peso = peso;
        if (peso > ` + TOPE_FOTO_EXTENSION + String.raw`) final.motivo = 'pesada';
        else { final.ok = true; final.foto = foto; final.texto = textoVisible(); }
      }
    } catch (e) {
      final.ok = false;
      final.motivo = 'excepcion';
      final.detalle = String((e && e.message) || e).slice(0, 200);
    }
    irA(x0, y0);
    window.__mkReplica = 0;
    mandar(final);
  })();
  return { ok: true, empezo: true };
}`;

/** El nombre del global que define `extension/replica-leer.js` en el desplegable (y que se inyecta con `func`). */
export const NOMBRE_EN_LA_EXTENSION = 'MakoReplicaLeer';

/**
 * El archivo `extension/replica-leer.js` entero. Lo carga el desplegable (popup.html) y lo inyecta en la pestaña con
 * `chrome.scripting.executeScript({ func: MakoReplicaLeer, args: [{ nonce }], world: 'ISOLATED' })`: no es un content
 * script, no corre en ningún sitio hasta el toque de la persona.
 */
export function archivoDeLaExtension(): string {
  return [
    '// =============================================================================',
    '// GENERADO por scripts/sync-replica-extension.mjs desde lib/editor-landing/replica-extension-script.ts — NO EDITAR A MANO',
    '// =============================================================================',
    '// «Replicar esta página» (0.79.0): la foto de la copia idéntica, en la pestaña real. El pre-push falla si quedó vieja.',
    '// La regla de esta lectura (la única que baja por una página ajena, y vuelve a donde estaba) está en el fuente.',
    '// =============================================================================',
    '',
    `var ${NOMBRE_EN_LA_EXTENSION} = ${JS_REPLICA_EN_LA_PESTANA};`,
    '',
  ].join('\n');
}
