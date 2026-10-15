// =============================================================================
// editor-landing/lector-navegador — abrir la ventana que LEE una landing y esperar su lectura (tanda 6, b)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página.". Soluciona eso...». Y sobre la ventana: «previo a abrir la página, es muy importante que
// si el usuario no tiene la opción de "habilitar ventanas emergentes" de Chrome, no continue, no abra la
// página, sino que indique dentro de MaKo que lo tiene que habilitar».
//
// `leerEnNavegador(url)` es lo que llaman Analizar, Replicar e Importar desde URL. Abre la ventana EN EL
// CLIC (un `window.open` sincrónico a `about:blank`: el navegador sólo deja abrir ventanas dentro del
// gesto de la persona, y un `await` antes lo pierde). Si vuelve null, o la cierra un bloqueador al
// instante, NO se abre nada y vuelve `{ ok: false, motivo: 'bloqueadas' }`: la pantalla muestra el aviso
// con la flecha (app/web-generator/lector/AvisoVentanasBloqueadas.tsx). Si abrió, recién ahí navega
// a la ruta que decide el camino (lector-pagina.ts): la página real con el Pixel, o la aislada. Antes de
// navegar le pide al server la FIRMA de esa lectura (verificación de la tanda 6, seguridad: lector-firma.ts);
// sin ella la ruta no sirve nada. Del otro lado corre el lector (lector-script.ts) y el protocolo es el de
// lector.ts.
//
// ⚠️ SE LLAMA DIRECTO EN EL `onClick`, SIN NINGÚN `await` ANTES: si no, el navegador bloquea la ventana
//    aunque la persona tenga las emergentes habilitadas, y el aviso le diría algo falso.
// =============================================================================

import { RUTA_PAGINA_DIAGNOSTICO } from './diagnostico';
import { urlParaReplicar } from './replicar-reglas';
import { conWs, wsDeBusqueda } from '../ws-tab';
import {
  PARAM_CAMINO, PARAM_FIRMA, PARAM_LECTOR, TIPO_MENSAJE_LECTURA,
  aLecturaDelServer, idLecturaValido, nuevoIdLectura, origenDeLecturaValido, sanearMensajeLectura,
  type CaminoPedido, type LecturaDelServer, type LecturaDetallada,
} from './lector';

/** Por qué no hubo lectura. */
export type MotivoSinLectura = 'bloqueadas' | 'cerrada' | 'tiempo' | 'error' | 'url';

export type ResultadoLectura =
  /** `lectura` va TAL CUAL al server (el `lectura` de ia «importar», del Diagnóstico y de Replicar). */
  | { ok: true; lectura: LecturaDelServer; detalle: LecturaDetallada }
  | { ok: false; motivo: MotivoSinLectura; mensaje: string };

export type OpcionesLectura = {
  /** `auto` (por defecto): decide MaKo mirando la página. `pixel` si la pantalla ya sabe que lo tiene. */
  camino?: CaminoPedido;
  /** Tope desde el clic hasta que la página saluda. Después del saludo, `TOPE_DESDE_HOLA_MS`. */
  topeMs?: number;
  /** El workspace de la pestaña (si no, el de `?ws=` de la URL actual). */
  ws?: number | null;
  /** Cómo se pide la firma del server (por defecto, `pedirFirmaLectura`). Lo cambian los tests. */
  firmar?: (url: string, id: string, ws: number | null) => Promise<string | null>;
};

/** Hasta que la página saluda (cargar una app lenta incluido). */
export const TOPE_LECTURA_MS = 25_000;
/** Desde el saludo: el lector tiene su propio tope de 17 s adentro (lector-script.ts). */
export const TOPE_DESDE_HOLA_MS = 21_000;
/** Un bloqueador que deja abrir y cierra al instante: se mira antes de navegar. */
const ESPERA_CIERRE_MS = 250;

/** Lo que dice cada falla (corto: es lo que se dibuja). */
export const MENSAJE_SIN_LECTURA: Record<MotivoSinLectura, string> = {
  bloqueadas: 'Habilita las ventanas emergentes',
  cerrada: 'Se cerró la ventana',
  tiempo: 'La página no respondió',
  error: 'No pude leer la página',
  url: 'Revisa el enlace',
};

const falla = (motivo: MotivoSinLectura, mensaje = MENSAJE_SIN_LECTURA[motivo]): ResultadoLectura => ({ ok: false, motivo, mensaje });

/** La dirección de la ventana: la ruta de la página de afuera con el id, el camino si no es `auto`, y la firma del server. */
export function rutaLector(url: string, id: string, camino: CaminoPedido = 'auto', ws: number | null = null, firma: string | null = null): string {
  const base = `${RUTA_PAGINA_DIAGNOSTICO}?url=${encodeURIComponent(url)}&${PARAM_LECTOR}=${encodeURIComponent(id)}`;
  const conCamino = camino === 'auto' ? base : `${base}&${PARAM_CAMINO}=${camino}`;
  return conWs(firma ? `${conCamino}&${PARAM_FIRMA}=${encodeURIComponent(firma)}` : conCamino, ws);
}

/**
 * La firma del server para ESTA lectura (verificación de la tanda 6, seguridad: lector-firma.ts). Un POST
 * a la misma ruta, con la ventana ya abierta: el `await` va DESPUÉS del `window.open`, así que el
 * navegador no la bloquea. null si no se pudo: la lectura falla y no se navega a nada.
 */
export async function pedirFirmaLectura(url: string, id: string, ws: number | null): Promise<string | null> {
  try {
    const r = await fetch(conWs(RUTA_PAGINA_DIAGNOSTICO, ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, [PARAM_LECTOR]: id }),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; firma?: unknown } | null;
    return r.ok && j?.ok && typeof j.firma === 'string' ? j.firma : null;
  } catch {
    return null;
  }
}

/**
 * La ventana, abierta YA (en el clic). Tamaño de computadora: la página se lee como la ve la mayoría de
 * quien la visita desde un anuncio en el escritorio, y con su menú de celular escondido.
 */
export function abrirVentanaLectura(): Window | null {
  try {
    const ancho = Math.round(Math.min(1280, Math.max(1024, (window.screen?.availWidth ?? 1280) - 80)));
    const alto = Math.round(Math.min(900, Math.max(640, (window.screen?.availHeight ?? 900) - 120)));
    return window.open('about:blank', '_blank', `popup=yes,width=${ancho},height=${alto},left=40,top=40`);
  } catch {
    return null;
  }
}

/** Lo que se ve en la ventana mientras carga la página (es nuestra todavía: about:blank del mismo origen). */
function pintarEspera(v: Window): void {
  try {
    v.document.title = 'MaKo';
    const b = v.document.body;
    if (!b) return;
    b.style.cssText = 'margin:0;height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;color:#6b6b72;background:#f7f7f8';
    b.textContent = 'Leyendo la página…';
  } catch { /* si no se puede, la ventana queda en blanco hasta que carga */ }
}

/**
 * Lee `url` en el navegador de la persona. Ver la cabecera: se llama EN EL CLIC. Nunca tira: toda falla
 * vuelve como `{ ok: false, motivo }`. La ventana se cierra sola al terminar (y si no, la cierra esto).
 * Una lectura con `detalle.palabras` en 0 es una página que no mostró texto ni en el navegador (una app
 * que no corre aislada): la pantalla ofrece pegar el texto.
 */
export function leerEnNavegador(url: string, opciones: OpcionesLectura = {}): Promise<ResultadoLectura> {
  const pedida = urlParaReplicar(url);
  if (!pedida) return Promise.resolve(falla('url'));
  const ventana = abrirVentanaLectura();
  if (!ventana) return Promise.resolve(falla('bloqueadas'));
  pintarEspera(ventana);
  const id = nuevoIdLectura();
  const propio = window.location.origin;
  const ws = opciones.ws !== undefined ? opciones.ws : wsDeBusqueda(window.location.search);

  return new Promise<ResultadoLectura>((resolver) => {
    let saludo = false;
    let listo = false;
    let limite = Date.now() + (opciones.topeMs ?? TOPE_LECTURA_MS);
    let reloj: ReturnType<typeof setInterval> | undefined;
    let arranque: ReturnType<typeof setTimeout> | undefined;

    const terminar = (r: ResultadoLectura) => {
      if (listo) return;
      listo = true;
      window.removeEventListener('message', alMensaje);
      if (reloj) clearInterval(reloj);
      if (arranque) clearTimeout(arranque);
      try { if (!ventana.closed) ventana.close(); } catch { /* ya no es nuestra */ }
      resolver(r);
    };

    // Arrow y no `function`: una declaración se IZA y TS no le pasa el estrechamiento de `pedida` y
    // `ventana` (los `if (!…) return` de arriba); con `function` el tsc de la rama daba TS2345/TS18047.
    // `terminar` la nombra en su cuerpo, pero sólo corre después de esta línea: no hay TDZ.
    const alMensaje = (ev: MessageEvent): void => {
      // De LA ventana que se abrió, desde un origen esperado y con SU id (lector.ts, el protocolo).
      // ⚠️ `ev.source` LLEGA EN NULL si la página lo mandó mientras se iba (un botón que navega: el
      //    lector manda lo leído en el `pagehide`). Medido en Chromium el 14/10/2026. Se acepta sólo
      //    después del saludo de ESA ventana y sólo para el final: el id es un secreto de 144 bits.
      const deLaVentana = ev.source === ventana || (ev.source === null && saludo);
      if (!deLaVentana || !origenDeLecturaValido(ev.origin, pedida, propio)) return;
      const m = sanearMensajeLectura(ev.data, { id, url: pedida });
      if (!m || (ev.source === null && m.fase === 'hola')) return;
      if (m.fase === 'hola') {
        if (!saludo) { saludo = true; limite = Math.max(limite, Date.now() + TOPE_DESDE_HOLA_MS); }
        // A un origen opaco («null», la ventana aislada) sólo se le puede escribir con '*': el destino ya
        // es ESA ventana, y lo que viaja es el id que ella misma mandó.
        try { ventana.postMessage({ tipo: TIPO_MENSAJE_LECTURA, id, fase: 'dale' }, ev.origin === 'null' ? '*' : ev.origin); } catch { /* se cerró */ }
        return;
      }
      if (m.fase === 'error') { terminar(falla('error', m.mensaje)); return; }
      terminar({ ok: true, lectura: aLecturaDelServer(m.detalle), detalle: m.detalle });
    };
    window.addEventListener('message', alMensaje);

    reloj = setInterval(() => {
      if (ventana.closed) { terminar(falla(arranque === undefined ? 'cerrada' : 'bloqueadas')); return; }
      if (Date.now() > limite) terminar(falla('tiempo', saludo ? 'La página tardó demasiado' : MENSAJE_SIN_LECTURA.tiempo));
    }, 300);

    // «Se cierra al instante»: si un bloqueador dejó abrir y la cerró, no se navega a nada. Si sigue
    // abierta, la firma del server y recién ahí la dirección (sin firma, la ruta no sirve nada).
    arranque = setTimeout(() => {
      arranque = undefined;
      if (ventana.closed) { terminar(falla('bloqueadas')); return; }
      if (!idLecturaValido(id)) { terminar(falla('error')); return; }
      void (opciones.firmar ?? pedirFirmaLectura)(pedida, id, ws).catch(() => null).then((firma) => {
        if (listo) return;
        if (!firma) { terminar(falla('error')); return; }
        try {
          ventana.location.replace(rutaLector(pedida, id, opciones.camino ?? 'auto', ws, firma));
        } catch {
          terminar(falla('error'));
        }
      });
    }, ESPERA_CIERRE_MS);
  });
}
