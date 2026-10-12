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
// `{ ok: false }` y el pop-up LO DICE y ofrece bajarse los eventos — una pantalla
// que se queda girando para siempre sería peor que la que dice que falta algo.
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

/** Lo que la pantalla necesita poder hacer con el reproductor: montarlo y tirarlo. */
export type Reproductor = { destruir: () => void };

export type CargaDelReproductor =
  | { ok: true; montar: (nodo: HTMLElement, eventos: unknown[], ancho: number) => Reproductor }
  | { ok: false; motivo: 'sin_reproductor' };

/** La forma de `rrwebPlayer`, declarada acá y chica: no importamos sus tipos. */
type ConstructorPlayer = new (opts: {
  target: HTMLElement;
  props: Record<string, unknown>;
}) => { $destroy?: () => void };

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
 * Le saca `crossorigin` (e `integrity`) a las hojas de estilo enlazadas de la
 * grabación, para que el reproductor las pueda cargar. Cambia los eventos EN EL
 * LUGAR y los devuelve: son la copia recién parseada de este pop-up.
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

/** Una sola carga por pestaña, aunque se abran diez grabaciones. */
let enVuelo: Promise<ConstructorPlayer | null> | null = null;

function cargar(): Promise<ConstructorPlayer | null> {
  if (enVuelo) return enVuelo;
  enVuelo = new Promise<ConstructorPlayer | null>((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const ya = constructorDelGlobal((window as unknown as Record<string, unknown>).rrwebPlayer);
    if (ya) { resolve(ya); return; }
    const s = document.createElement('script');
    s.src = rutaDelReproductor();
    s.async = true;
    s.onload = () => {
      // Que el script cargue no es que el reproductor esté: un 404 servido como
      // HTML por el router carga perfecto y no define nada. Se pregunta por el
      // global, nunca por el `onload`.
      resolve(constructorDelGlobal((window as unknown as Record<string, unknown>).rrwebPlayer));
    };
    // Un fallo NO se memoiza: la próxima vez se vuelve a intentar, porque la causa
    // más probable es la red de quien está mirando.
    s.onerror = () => { enVuelo = null; resolve(null); };
    document.head.appendChild(s);
  });
  return enVuelo;
}

/**
 * Carga el reproductor y devuelve cómo montarlo, o dice que no se pudo.
 *
 * ⚠️ Devuelve un resultado y NO tira: quien lo llama tiene que poder escribir la
 * frase y ofrecer la otra puerta. Una excepción acá dejaría el pop-up en blanco.
 */
export async function cargarReproductor(): Promise<CargaDelReproductor> {
  const Player = await cargar();
  if (!Player) return { ok: false, motivo: 'sin_reproductor' };
  return {
    ok: true,
    montar: (nodo, eventos, ancho) => {
      const inst = new Player({
        target: nodo,
        props: {
          events: hojasSinCors(eventos),
          width: Math.max(320, Math.trunc(ancho)),
          // 16:10 sobre el ancho disponible: una grabación de una landing es
          // vertical larga, y el reproductor la escala sola.
          height: Math.round(Math.max(320, Math.trunc(ancho)) * 0.62),
          // ⚠️ NO arranca solo. Un video que empieza a correr al abrir un pop-up
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
      return { destruir: () => { try { inst.$destroy?.(); } catch { /* ya no está en el DOM */ } } };
    },
  };
}
