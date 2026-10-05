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
// ⚠️ FALTA EL ARCHIVO. `public/replay/1/player.js` todavía no está en el repo: es
// el bundle UMD de `rrweb-player` (hoy 2.1.7), que expone `window.rrwebPlayer`.
// Mientras no esté, `cargarReproductor()` devuelve `{ ok: false }` y el pop-up LO
// DICE y ofrece bajarse los eventos — una pantalla que se queda girando para
// siempre sería peor que la que dice que falta algo. Si en vez del archivo se
// prefiere la dependencia, lo único que cambia es `cargar()`, acá abajo.
// =============================================================================

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

/** Una sola carga por pestaña, aunque se abran diez grabaciones. */
let enVuelo: Promise<ConstructorPlayer | null> | null = null;

function cargar(): Promise<ConstructorPlayer | null> {
  if (enVuelo) return enVuelo;
  enVuelo = new Promise<ConstructorPlayer | null>((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const ya = (window as unknown as Record<string, unknown>).rrwebPlayer;
    if (typeof ya === 'function') { resolve(ya as ConstructorPlayer); return; }
    const s = document.createElement('script');
    s.src = rutaDelReproductor();
    s.async = true;
    s.onload = () => {
      const g = (window as unknown as Record<string, unknown>).rrwebPlayer;
      // Que el script cargue no es que el reproductor esté: un 404 servido como
      // HTML por el router carga perfecto y no define nada. Se pregunta por el
      // global, nunca por el `onload`.
      resolve(typeof g === 'function' ? (g as ConstructorPlayer) : null);
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
          events: eventos,
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
        },
      });
      return { destruir: () => { try { inst.$destroy?.(); } catch { /* ya no está en el DOM */ } } };
    },
  };
}
