// =============================================================================
// replay-reproductor — rrweb SÓLO cuando alguien abre una grabación
// =============================================================================
// El reproductor corre en NUESTRA pantalla, así que su peso es nuestro: no puede
// viajar en el bundle de toda la app para una pantalla que se abre una vez por
// semana. Acá se carga a pedido, la primera vez que alguien aprieta «Ver».
//
// ⚠️ SE CARGA DESDE UNA RUTA NUESTRA Y VERSIONADA (`/replay/<v>/player.js`), no
// desde un CDN público ni desde el bundle. Tres razones, y la primera es la que
// manda:
//
//   1. La pantalla que lo monta es la ficha de un lead: tiene la cookie de sesión
//      del equipo y los datos de los clientes a la vista. Un `<script>` de un
//      tercero ahí es la misma decisión que la de heatmaps rechazó de Clarity,
//      sólo que del lado de adentro. Y el único argumento a favor de un CDN —que
//      se cachea entre sitios— no existe desde 2020: la caché HTTP está
//      particionada por sitio.
//   2. La versión va en la RUTA, así que se cachea un año y un arreglo es una ruta
//      nueva. Es la misma decisión que `rutaDeLibreria` toma para el grabador
//      (lib/replay-contrato.ts).
//   3. `import('rrweb-player')` no compila hoy: la dependencia NO está instalada
//      (`npm ls rrweb` no devuelve nada), y un import literal de un paquete que no
//      existe tira el build entero — no esta pantalla.
//
// El archivo es el bundle UMD de `rrweb-player` (hoy 2.1.7), que genera
// `scripts/replay-libs.mjs`. Si no carga, `cargarReproductor()` devuelve
// `{ ok: false }` y la ficha LO DICE y ofrece bajarse los eventos — una pantalla
// que se queda girando para siempre sería peor que la que dice que falta algo.
//
// ⚠️ Y SE CARGA CON SU HOJA DE ESTILOS (`/replay/<v>/player.css`), o se ve ROTO. Hasta
// el 14/10/2026 sólo se inyectaba el script: `scripts/replay-libs.mjs` publicaba el
// .css y nadie lo pedía. Sin él, `.replayer-wrapper` no tiene el `position: relative`
// ni el `left/top: 50%` sobre los que el reproductor calcula su
// `scale(…) translate(-50%, -50%)`, así que la página grabada sale corrida hacia arriba
// y a la izquierda, fuera del recuadro, y la barra de controles sin forma. Martín, ese
// día: «Mira como se ve el reproductor, completamente roto». Se pide UNA vez por
// pestaña (un `<link>` con id) y sin ella no se monta: un reproductor roto en pantalla
// es peor que la frase que dice que no cargó y ofrece el archivo.
//
// Lo que esa hoja pisa de la app, revisado el 14/10/2026: casi todo va con la clase de
// Svelte (`.svelte-189zk2r`) o con el prefijo `rr-`/`replayer-`, que nadie más usa.
// Son globales dos `@keyframes` con nombre genérico (`click` y `touch-click`): hoy no
// hay otro igual en el repo, pero uno nuevo con ese nombre se pisaría con éste.
//
// ⚠️ `window.rrwebPlayer` NO ES LA CLASE: es un OBJETO `{ Player, default }`.
// Medido el 08/10/2026 en Chromium cargando `public/replay/1/player.js`: `typeof`
// da 'object'. Hasta ese día este archivo pedía `typeof === 'function'`, así que
// el pop-up decía «sin reproductor» con CADA grabación — ninguna se pudo mirar
// nunca, y ningún test lo veía porque ninguno cargaba el bundle.
// =============================================================================

import { REPLAY_LATIDO } from './replay-contrato';

/** Versión del reproductor que servimos. Parte de la URL, inmutable. */
export const REPLAY_PLAYER_VERSION = 1;

/** De dónde sale el reproductor. Inmutable por versión. */
export const rutaDelReproductor = (version: number = REPLAY_PLAYER_VERSION): string =>
  `/replay/${Math.max(1, Math.trunc(version))}/player.js`;

/** De dónde salen sus estilos: la misma carpeta, la misma versión. */
export const rutaDeLosEstilos = (version: number = REPLAY_PLAYER_VERSION): string =>
  `/replay/${Math.max(1, Math.trunc(version))}/player.css`;

/** El id del `<link>` de los estilos: es lo que hace que se pidan una sola vez por pestaña. */
export const ID_ESTILOS_REPRODUCTOR = 'mko-replay-player-css';

/**
 * Lo que mide la barra de controles de rrweb-player. Es fija: está escrita en el bundle
 * (`const bn=80`) y el reproductor la suma DEBAJO del recuadro de la grabación.
 */
export const CONTROLES_ALTO = 80;

/** Qué parte del alto de la ventana puede ocupar el reproductor entero (recuadro + controles). */
export const TOPE_ALTO_VENTANA = 0.7;

/**
 * Los pisos. Más angosto que esto, la barra de controles (sus dos relojes miden 100 px cada
 * uno) aplasta la de tiempo hasta hacerla desaparecer; más bajo, la página grabada no se lee.
 */
const ANCHO_MINIMO = 240;
const ALTO_MINIMO = 160;

/** Sin el evento Meta no se sabe qué pantalla se grabó: la proporción de antes (16:10). */
const PROPORCION_SIN_DATO = 0.62;

/**
 * Cuánto se espera el reproductor (script + hoja). Pesan ~230 KB y vienen de nuestra
 * ruta, cacheados un año: pasado esto no es lento, está colgado, y una ficha que gira
 * para siempre es indistinguible de un producto roto. Es el mismo tope que el cuerpo
 * de la grabación (`ESPERA_CUERPO_MS`, app/crm/lead-view/GrabacionModal.tsx).
 */
const ESPERA_REPRODUCTOR_MS = 30_000;

/** Lo que dice el interruptor del reproductor en vez de «skip inactive». */
export const ROTULO_SALTAR_PAUSAS = 'Saltar pausas';

/** ¿Hay algo en pantalla completa? (Safari viejo lo dice con prefijo.) */
function enPantallaCompleta(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/** La pantalla del visitante que se grabó, en px. */
export type PantallaGrabada = { ancho: number; alto: number };

/** Lo que la pantalla necesita poder hacer con el reproductor: montarlo, volver a medirlo y tirarlo. */
export type Reproductor = {
  destruir: () => void;
  /** El recuadro cambió de ancho (o la ventana de alto): se recalcula y se reescala. */
  medir: (ancho: number, altoVentana: number) => void;
};

export type CargaDelReproductor =
  | { ok: true; montar: (nodo: HTMLElement, eventos: unknown[], ancho: number, altoVentana: number) => Reproductor }
  | { ok: false; motivo: 'sin_reproductor' };

/** La forma de `rrwebPlayer`, declarada acá y chica: no importamos sus tipos. */
type ConstructorPlayer = new (opts: {
  target: HTMLElement;
  props: Record<string, unknown>;
}) => { $destroy?: () => void; $set?: (props: Record<string, unknown>) => void; triggerResize?: () => void };

/**
 * El constructor del reproductor, venga como venga el global.
 *
 * ⚠️ El UMD de rrweb-player 2.x deja en `window.rrwebPlayer` el objeto del módulo
 * (`{ Player, default }`), no la clase: ver el encabezado. Se acepta también la
 * clase pelada, que es lo que dejaría otro bundle o una versión vieja.
 */
export function constructorDelGlobal(g: unknown): ConstructorPlayer | null {
  if (typeof g === 'function') return g as ConstructorPlayer;
  if (g && typeof g === 'object') {
    const m = g as Record<string, unknown>;
    if (typeof m.default === 'function') return m.default as ConstructorPlayer;
    if (typeof m.Player === 'function') return m.Player as ConstructorPlayer;
  }
  return null;
}

/**
 * La pantalla que se grabó: el ancho y el alto del PRIMER evento Meta de rrweb
 * (`type: 4`, `data: { href, width, height }`), que el grabador escribe antes de la foto.
 * `null` si no hay ninguno con dos números positivos: no se inventa una pantalla.
 *
 * Es el primero y no el más grande porque el reproductor arma su recuadro una vez y a
 * los Meta siguientes (la persona giró el teléfono, achicó la ventana) los reescala solo
 * dentro de ese mismo recuadro.
 */
export function pantallaGrabada(eventos: ReadonlyArray<unknown>): PantallaGrabada | null {
  for (const e of eventos) {
    if (!e || typeof e !== 'object' || (e as { type?: unknown }).type !== 4) continue;
    const d = (e as { data?: unknown }).data as { width?: unknown; height?: unknown } | null | undefined;
    if (!d || typeof d !== 'object') continue;
    const { width: ancho, height: alto } = d;
    if (typeof ancho === 'number' && typeof alto === 'number' && Number.isFinite(ancho) && Number.isFinite(alto) && ancho > 0 && alto > 0) {
      return { ancho, alto };
    }
  }
  return null;
}

/**
 * Cuánto mide el recuadro de la grabación (SIN los controles, que el reproductor suma abajo).
 *
 * El ancho es el que hay —el de la tarjeta—; el alto sale de la PROPORCIÓN de la pantalla
 * grabada, así la página grabada llena el recuadro sin franjas. Con un tope: el reproductor
 * entero (recuadro + controles) no pasa del 70% del alto de la ventana. Una visita desde un
 * teléfono (390×844) en una tarjeta de 700 px pediría 1.500 px de alto; topada, se ve entera,
 * más chica y centrada.
 *
 * ⚠️ Hasta el 14/10/2026 el alto era 0,62 × ancho para TODAS, y el reproductor no pasaba de
 * escala 1 (`maxScale` quedaba en su default). Una visita de escritorio de 1.440 px se veía a
 * la mitad y una de teléfono, una tira angosta. Ahora la escala la pone el recuadro, por
 * encima de 1 si entra (`maxScale: 0`, ver `cargarReproductor`).
 */
export function medidasDelReproductor(
  disponible: number,
  pantalla: PantallaGrabada | null,
  altoVentana: number,
): { ancho: number; alto: number } {
  const ancho = Math.max(ANCHO_MINIMO, Math.trunc(Number.isFinite(disponible) ? disponible : 0));
  const proporcion = pantalla ? pantalla.alto / pantalla.ancho : PROPORCION_SIN_DATO;
  const natural = Math.round(ancho * proporcion);
  // Sin un alto de ventana que sirva no hay tope que calcular: manda la proporción.
  const tope = Number.isFinite(altoVentana) && altoVentana > 0
    ? Math.trunc(altoVentana * TOPE_ALTO_VENTANA) - CONTROLES_ALTO
    : Number.POSITIVE_INFINITY;
  return { ancho, alto: Math.max(ALTO_MINIMO, Math.min(natural, tope)) };
}

/**
 * Le saca `crossorigin` (e `integrity`) a las hojas de estilo enlazadas de la
 * grabación, para que el reproductor las pueda cargar. Cambia los eventos EN EL
 * LUGAR y los devuelve: son la copia recién parseada de esta ficha.
 *
 * ⚠️ SIN ESTO, UNA GRABACIÓN DEL GRABADOR v2 SE VE SIN ESTILO. La v2 graba la hoja
 * como un `<link>` y no adentro (ver `scripts/replay-envoltorio.js`), así que el
 * reproductor la baja de la página del cliente. Vite —y por lo tanto Lovable— lo
 * escribe `<link rel="stylesheet" crossorigin href="/assets/…">`, y el servidor del
 * cliente no manda `Access-Control-Allow-Origin` (medido el 08/10/2026 con
 * multiplicatusresultados.com). Con el `crossorigin` puesto, el navegador pide la
 * hoja en modo CORS desde NUESTRO origen y la bloquea; sin él la pide como
 * cualquier hoja de otro sitio, que el navegador aplica igual. Medido en Chromium:
 * con el atributo, el fondo del encabezado de la página de prueba da
 * `rgba(0, 0, 0, 0)` y la consola dice «blocked by CORS policy»; sin él,
 * `rgb(12, 34, 56)`, el de la hoja. `integrity` sale por lo mismo: el chequeo de
 * integridad exige CORS y fallaría igual.
 *
 * Mira la foto entera (type 2) y los nodos que agrega una mutación (type 3,
 * source 0): una página de una sola pantalla agrega hojas al cambiar de ruta.
 *
 * ⚠️ LA REGLA DE QUÉ SE SACA VIVE EN `atributosSinCors`, y la usan DOS puertas: este
 * reproductor y la FOTO del mapa de calor (`htmlDeFoto`, lib/landing-mapa-foto.ts). Hasta
 * el 12/10/2026 la foto no la llamaba: el mapa se veía en serif y sin estilo por el mismo
 * `crossorigin` que acá ya estaba arreglado (relevo v5, área D). Una cosa, un lugar.
 */
export function hojasSinCors<T>(eventos: T[]): T[] {
  const limpiar = (n: unknown, prof: number): void => {
    if (!n || typeof n !== 'object' || prof > 400) return;
    const nodo = n as { type?: unknown; tagName?: unknown; attributes?: Record<string, unknown>; childNodes?: unknown };
    if (nodo.type === 2 && nodo.attributes) nodo.attributes = atributosSinCors(nodo.tagName, nodo.attributes);
    if (Array.isArray(nodo.childNodes)) for (const c of nodo.childNodes) limpiar(c, prof + 1);
  };
  for (const e of eventos) {
    const ev = e as { type?: unknown; data?: { node?: unknown; source?: unknown; adds?: unknown } } | null;
    if (!ev || typeof ev !== 'object' || !ev.data || typeof ev.data !== 'object') continue;
    if (ev.type === 2) limpiar(ev.data.node, 0);
    else if (ev.type === 3 && ev.data.source === 0 && Array.isArray(ev.data.adds)) {
      for (const add of ev.data.adds) limpiar((add as { node?: unknown } | null)?.node, 0);
    }
  }
  return eventos;
}

/** Los atributos que obligan al navegador a pedir una hoja en modo CORS (el chequeo de integridad también lo exige). */
const ATRIBUTOS_CORS = ['crossorigin', 'integrity'] as const;

/** ¿Es una hoja de estilo enlazada (`<link rel="stylesheet">`)? Mira la etiqueta y el `rel`, nada más. */
export function esHojaEnlazada(tag: unknown, attrs: Readonly<Record<string, unknown>> | null | undefined): boolean {
  return typeof tag === 'string' && tag.toLowerCase() === 'link' && !!attrs
    && typeof attrs.rel === 'string' && /(^|\s)stylesheet(\s|$)/i.test(attrs.rel);
}

/**
 * Los atributos de un nodo grabado, sin lo que bloquea su hoja por CORS: a una hoja enlazada le saca
 * `crossorigin` e `integrity`; a cualquier otro nodo lo devuelve TAL CUAL (el mismo objeto).
 *
 * PURA: no toca el objeto que recibe, devuelve uno nuevo cuando hay algo que sacar. La usan las dos puertas
 * que muestran una grabación —el reproductor (`hojasSinCors`) y la foto del mapa de calor (`htmlDeFoto`)— y
 * un test las prueba a las dos (tests/landing-mapa.test.ts).
 */
export function atributosSinCors<T extends Record<string, unknown>>(tag: unknown, attrs: T): T {
  if (!esHojaEnlazada(tag, attrs)) return attrs;
  if (!ATRIBUTOS_CORS.some((k) => k in attrs)) return attrs;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) if (!(ATRIBUTOS_CORS as readonly string[]).includes(k)) out[k] = v;
  return out as T;
}

/**
 * ¿La hoja cargó DE VERDAD? Que dispare `load` no alcanza, por lo mismo que con el script:
 * un 404 servido como HTML por el router es una respuesta. Es nuestra (mismo origen), así que
 * sus reglas se pueden leer: sin reglas no hay estilos.
 */
function hojaAplicada(l: HTMLLinkElement): boolean {
  try {
    return !!l.sheet && l.sheet.cssRules.length > 0;
  } catch {
    return false;
  }
}

/** Los estilos del reproductor, pedidos UNA vez por pestaña. `false` si no llegaron. */
function cargarEstilos(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const previo = document.getElementById(ID_ESTILOS_REPRODUCTOR);
    if (previo instanceof HTMLLinkElement && hojaAplicada(previo)) { resolve(true); return; }
    // Uno que quedó de un intento que falló (o a medio cargar de un módulo recargado) no va
    // a volver a avisar nada: se tira y se pide de nuevo.
    previo?.remove();
    const l = document.createElement('link');
    l.id = ID_ESTILOS_REPRODUCTOR;
    l.rel = 'stylesheet';
    l.href = rutaDeLosEstilos();
    l.onload = () => { const ok = hojaAplicada(l); if (!ok) l.remove(); resolve(ok); };
    l.onerror = () => { l.remove(); resolve(false); };
    document.head.appendChild(l);
  });
}

/** Una sola carga por pestaña, aunque se abran diez grabaciones. */
let enVuelo: Promise<ConstructorPlayer | null> | null = null;

function cargar(): Promise<ConstructorPlayer | null> {
  if (enVuelo) return enVuelo;
  enVuelo = new Promise<ConstructorPlayer | null>((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    let resuelto = false;
    let tope: ReturnType<typeof setTimeout> | undefined;
    const fin = (p: ConstructorPlayer | null) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(tope);
      // Un fallo NO se memoiza: la próxima vez se vuelve a intentar, porque la causa
      // más probable es la red de quien está mirando.
      if (!p) enVuelo = null;
      resolve(p);
    };
    tope = setTimeout(() => fin(null), ESPERA_REPRODUCTOR_MS);

    const script = new Promise<ConstructorPlayer | null>((listo) => {
      const ya = constructorDelGlobal((window as unknown as Record<string, unknown>).rrwebPlayer);
      if (ya) { listo(ya); return; }
      const s = document.createElement('script');
      s.src = rutaDelReproductor();
      s.async = true;
      s.onload = () => {
        // Que el script cargue no es que el reproductor esté: un 404 servido como
        // HTML por el router carga perfecto y no define nada. Se pregunta por el
        // global, nunca por el `onload`.
        listo(constructorDelGlobal((window as unknown as Record<string, unknown>).rrwebPlayer));
      };
      s.onerror = () => { s.remove(); listo(null); };
      document.head.appendChild(s);
    });

    // Los dos o ninguno: sin la hoja, el reproductor se monta y se ve roto.
    void Promise.all([script, cargarEstilos()]).then(([P, estilos]) => fin(P && estilos ? P : null));
  });
  return enVuelo;
}

/**
 * Carga el reproductor y devuelve cómo montarlo, o dice que no se pudo.
 *
 * ⚠️ Devuelve un resultado y NO tira: quien lo llama tiene que poder escribir la
 * frase y ofrecer la otra puerta. Una excepción acá dejaría la ficha en blanco.
 */
export async function cargarReproductor(): Promise<CargaDelReproductor> {
  const Player = await cargar();
  if (!Player) return { ok: false, motivo: 'sin_reproductor' };
  return {
    ok: true,
    montar: (nodo, eventos, ancho, altoVentana) => {
      const pantalla = pantallaGrabada(eventos);
      let medidas = medidasDelReproductor(ancho, pantalla, altoVentana);
      const inst = new Player({
        target: nodo,
        props: {
          events: hojasSinCors(eventos),
          width: medidas.ancho,
          height: medidas.alto,
          // ⚠️ 0 = SIN TOPE DE ESCALA. El default de rrweb-player es 1: una visita de
          // teléfono en una tarjeta ancha se quedaba en su tamaño real, chiquita en el
          // medio. La escala la decide el recuadro (`medidasDelReproductor`).
          maxScale: 0,
          // ⚠️ NO arranca solo. Un video que empieza a correr al abrir una grabación
          // se pierde los primeros segundos, que es donde se ve qué hizo la
          // persona al entrar.
          autoPlay: false,
          // El reproductor no tapa nada por su cuenta: lo tapado se decidió al
          // GRABAR (`REPLAY_OPCIONES_RRWEB`), y lo que no se grabó no está en el
          // archivo. Una opción de máscara acá daría la idea contraria.
          mouseTail: false,
          speedOption: [1, 2, 4],
          // ⚠️ El latido del grabador v2 es un evento Custom, y rrweb-player dibuja
          // CADA evento Custom como una marca azul en la barra de tiempo: medido el
          // 08/10/2026, una visita de 40 s mostraba 33 marcas que no significan nada
          // (las primeras 30, pegadas, se leían como una barra gruesa). Transparente,
          // la marca no se ve; el evento sigue y la duración no cambia.
          tags: { [REPLAY_LATIDO]: 'transparent' },
        },
      });
      // ⚠️ LA PÁGINA GRABADA ES UNA IMAGEN, NO UNA PÁGINA: va `inert`. Adentro del iframe del
      // reproductor están los links y los campos de la landing del cliente; rrweb le apaga el
      // mouse (`pointer-events: none`) pero no el Tab, y el foco podía entrar ahí — un documento
      // aparte, donde no llegan ni el Escape ni la trampa de foco de la ficha
      // (app/crm/LeadSheet.tsx). Los controles viven AFUERA de este recuadro y siguen andando.
      // El recuadro y los controles existen apenas vuelve el constructor: Svelte monta
      // sincrónico cuando recibe un `target`.
      nodo.querySelector('.rr-player__frame')?.setAttribute('inert', '');
      // El único texto que dibuja el reproductor viene en inglés («skip inactive», el
      // interruptor que salta los ratos sin actividad). Es estático —Svelte no lo vuelve a
      // escribir— así que se cambia una vez, acá.
      const rotulo = nodo.querySelector('.rr-controller .switch .label');
      if (rotulo) rotulo.textContent = ROTULO_SALTAR_PAUSAS;
      return {
        destruir: () => { try { inst.$destroy?.(); } catch { /* ya no está en el DOM */ } },
        medir: (anchoNuevo, altoVentanaNuevo) => {
          // ⚠️ EN PANTALLA COMPLETA LAS MEDIDAS SON DEL REPRODUCTOR: al entrar se pone el tamaño
          // de la pantalla y al salir vuelve solo al de antes (lo hace el bundle al escuchar
          // `fullscreenchange`). Entrar dispara un `resize` de la ventana, y reescalarlo ahí con
          // las medidas de la tarjeta dejaría la página grabada del tamaño de la tarjeta, en una
          // esquina de la pantalla. Leído del bundle, no medido en un navegador. Al salir, el
          // `resize` y el `ResizeObserver` de la tarjeta vuelven a medir.
          if (enPantallaCompleta()) return;
          const m = medidasDelReproductor(anchoNuevo, pantalla, altoVentanaNuevo);
          if (m.ancho === medidas.ancho && m.alto === medidas.alto) return;
          medidas = m;
          try {
            // `$set` cambia el recuadro; la escala de la página grabada la recalcula
            // `triggerResize`, que con las medidas nuevas ya puestas la vuelve a centrar.
            inst.$set?.({ width: m.ancho, height: m.alto });
            inst.triggerResize?.();
          } catch { /* se desmontó entre la medida y el cambio */ }
        },
      };
    },
  };
}
