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
//
// TANDA 7 (15/10/2026). Martín, textual: «Si no pudo leer la landing, no me debe saltar el botón de "MaKo no
// pudo leerla sola" y las opciones de leer en tu navegador... Por defecto si no pudo de una manera que vaya
// directo a abrir la ventana emergente y a analizar la landing...».
// POR QUÉ HABÍA UN SEGUNDO BOTÓN: Chrome sólo deja abrir una ventana DENTRO del gesto de la persona (la
// «activación transitoria» del clic; `window.open` la consume, y un `await` largo la pierde). El orden era
// server → ventana: el clic de Analizar o Replicar mandaba el pedido, el server tardaba en contestar
// `enNavegador`, y para entonces el clic ya no servía para abrir nada; la única forma de abrir era OTRO
// clic, el de «Leer en tu navegador». La restricción es real; el segundo botón era su consecuencia.
// Ahora el orden es ventana → server: la ventana se abre EN EL CLIC que pide Analizar o Replicar
// (`abrirEnElClic`), sin saber todavía si hace falta, y `pedirConVentana` decide con lo que llega:
//   · una prueba rápida del server, sin IA (`probarLecturaEnServer` → {accion:'probarLectura'}), corre al lado
//     del pedido; si el server SÍ la puede leer, la ventana se cierra enseguida (el parpadeo, aceptado);
//   · si el pedido contesta `enNavegador` y la ventana sigue abierta, se lee en ESA ventana y el pedido se
//     repite con la `lectura`, sin ningún clic. Sin texto, recién ahí «Pega el texto»;
//   · bloqueada, cerrada por la persona o por la prueba: la salida de siempre (LeerOPegar, con su botón).
// Los arranques AUTOMÁTICOS (el Diagnóstico y Replicar que arrancan solos al montarse) no tienen clic: el
// clic fue antes, en el ↑ de la caja. Ése abre la ventana y la deja en un casillero de este módulo
// (`reservarVentanaLectura`), y el efecto que arranca la toma (`tomarVentanaReservada`): misma URL, una vez,
// y vence a los `VENCE_RESERVA_MS` (cerrándola).
// =============================================================================

import { RUTA_DIAGNOSTICO, RUTA_PAGINA_DIAGNOSTICO } from './diagnostico';
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
  /**
   * Una ventana YA ABIERTA en el clic (tanda 7: `abrirEnElClic` o la reservada). Con ella no se abre otra:
   * se lee en ésa, con el mismo protocolo y la misma firma.
   */
  ventana?: Window;
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

/** Lo que dice la ventana mientras espera (corto: es lo que se dibuja). */
export const TEXTO_ESPERA_VENTANA = 'Leyendo la página…';

/**
 * Lo que se ve en la ventana mientras carga la página (es nuestra todavía: about:blank del mismo origen).
 * Con el GIRO de la casa (`.gp-giro`, CSS_GP de MiniaturaLanding.tsx, copiado: esta ventana no tiene
 * nuestras hojas): un «Leyendo…» escrito no dice que algo pasa (AGENTS.md, «un "Cargando…" escrito no es
 * un loader»). Tanda 7: con la ventana abierta en el clic, esto es lo que se ve hasta que el server
 * contesta (unos segundos), no sólo mientras carga la página.
 */
function pintarEspera(v: Window): void {
  try {
    const d = v.document;
    d.title = 'MaKo';
    const b = d.body;
    if (!b) return;
    b.style.cssText = 'margin:0;height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;color:#6b6b72;background:#f7f7f8';
    const estilo = d.createElement('style');
    estilo.textContent = '@keyframes mk-gira{to{transform:rotate(360deg)}}.mk-giro{display:inline-block;width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:mk-gira .7s linear infinite}';
    const fila = d.createElement('div');
    fila.style.cssText = 'display:flex;align-items:center;gap:10px';
    const giro = d.createElement('span');
    giro.className = 'mk-giro';
    giro.setAttribute('aria-hidden', 'true');
    fila.append(giro, d.createTextNode(TEXTO_ESPERA_VENTANA));
    b.replaceChildren(estilo, fila);
  } catch {
    // Sin DOM (o sin `replaceChildren`): al menos el texto.
    try { v.document.body.textContent = TEXTO_ESPERA_VENTANA; } catch { /* queda en blanco hasta que carga */ }
  }
}

/**
 * Lee `url` en el navegador de la persona. Ver la cabecera: se llama EN EL CLIC. Nunca tira: toda falla
 * vuelve como `{ ok: false, motivo }`. La ventana se cierra sola al terminar (y si no, la cierra esto).
 * Una lectura con `detalle.palabras` en 0 es una página que no mostró texto ni en el navegador (una app
 * que no corre aislada): la pantalla ofrece pegar el texto.
 */
export function leerEnNavegador(url: string, opciones: OpcionesLectura = {}): Promise<ResultadoLectura> {
  const pedida = urlParaReplicar(url);
  // Tanda 7: la ventana que ya se abrió en el clic (`opciones.ventana`) es NUESTRA y está viva: no se abre
  // otra, no se repinta, y no se espera el «se cierra al instante» (eso ya pasó cuando se abrió). Si la
  // cerraron, es `cerrada`, nunca `bloqueadas`: el navegador SÍ la dejó abrir.
  const dada = opciones.ventana ?? null;
  if (!pedida) {
    if (dada) cerrarVentana(dada);
    return Promise.resolve(falla('url'));
  }
  if (dada?.closed) return Promise.resolve(falla('cerrada'));
  const ventana = dada ?? abrirVentanaLectura();
  if (!ventana) return Promise.resolve(falla('bloqueadas'));
  if (!dada) pintarEspera(ventana);
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
      if (ventana.closed) { terminar(falla(arranque === undefined || dada ? 'cerrada' : 'bloqueadas')); return; }
      if (Date.now() > limite) terminar(falla('tiempo', saludo ? 'La página tardó demasiado' : MENSAJE_SIN_LECTURA.tiempo));
    }, 300);

    // «Se cierra al instante»: si un bloqueador dejó abrir y la cerró, no se navega a nada. Si sigue
    // abierta, la firma del server y recién ahí la dirección (sin firma, la ruta no sirve nada). Con una
    // ventana dada (tanda 7) no hay nada que esperar: ya lleva abierta lo que tardó el server.
    arranque = setTimeout(() => {
      arranque = undefined;
      if (ventana.closed) { terminar(falla(dada ? 'cerrada' : 'bloqueadas')); return; }
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
    }, dada ? 0 : ESPERA_CIERRE_MS);
  });
}

/** Cierra una ventana nuestra, si sigue abierta (nunca tira: puede ya no ser nuestra). */
export function cerrarVentana(v: Window | null | undefined): void {
  try { if (v && !v.closed) v.close(); } catch { /* ya no es nuestra */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tanda 7: la ventana EN EL CLIC que pide Analizar o Replicar (ver la cabecera)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que dejó el clic: la ventana abierta y pintada, o 'bloqueada' (el navegador no la dejó abrir). */
export type VentanaDelClic = Window | 'bloqueada';

/**
 * Abre la ventana de lectura EN EL CLIC, sin saber todavía si va a hacer falta. ⚠️ Se llama directo en el
 * handler, ANTES de cualquier `await` (y de cualquier `setState` que la pantalla quiera hacer): el clic
 * es lo único que la deja abrir. Lo que sigue (`pedirConVentana`) la cierra si el server sí puede leer.
 */
export function abrirEnElClic(): VentanaDelClic {
  const v = abrirVentanaLectura();
  if (!v) return 'bloqueada';
  pintarEspera(v);
  return v;
}

/** Cuánto espera una ventana reservada a que la tome el arranque automático (después, se cierra). */
export const VENCE_RESERVA_MS = 15_000;

/** EL casillero: una sola reserva a la vez (otro clic la reemplaza y cierra la anterior). */
let reserva: { url: string; ventana: VentanaDelClic; reloj: ReturnType<typeof setTimeout> } | null = null;

/** Suelta la reserva que haya: la cierra si sigue abierta (si `url`, sólo si es de esa página). */
export function soltarVentanaReservada(url?: string): void {
  const r = reserva;
  if (!r || (url !== undefined && urlParaReplicar(url) !== r.url)) return;
  reserva = null;
  clearTimeout(r.reloj);
  if (r.ventana !== 'bloqueada') cerrarVentana(r.ventana);
}

/**
 * En el CLIC de una acción cuya pantalla va a arrancar SOLA al montarse (el ↑ de la caja con «Analiza esta
 * landing» o «Replica esta landing», el «Ir a» del buscador): abre la ventana (`abrirEnElClic`) y la deja en
 * el casillero para `tomarVentanaReservada`. Una URL que no es una dirección no reserva nada.
 */
export function reservarVentanaLectura(url: string, o: { venceMs?: number } = {}): VentanaDelClic | null {
  const pedida = urlParaReplicar(url);
  if (!pedida) return null;
  // Primero la ventana (el gesto), después el casillero: soltar la anterior no consume nada.
  const ventana = abrirEnElClic();
  soltarVentanaReservada();
  const reloj = setTimeout(() => { if (reserva?.reloj === reloj) soltarVentanaReservada(); }, o.venceMs ?? VENCE_RESERVA_MS);
  reserva = { url: pedida, ventana, reloj };
  return ventana;
}

/**
 * El arranque automático toma la ventana que reservó el clic: la MISMA página, UNA vez (la segunda vez,
 * null), y si ya la cerraron no se usa (null: el camino de siempre). 'bloqueada' si el navegador no la
 * dejó abrir en el clic (la pantalla avisa sólo si después hace falta).
 */
export function tomarVentanaReservada(url: string): VentanaDelClic | null {
  const r = reserva;
  const pedida = urlParaReplicar(url);
  if (!r || !pedida || r.url !== pedida) return null;
  reserva = null;
  clearTimeout(r.reloj);
  if (r.ventana === 'bloqueada') return 'bloqueada';
  return r.ventana.closed ? null : r.ventana;
}

/**
 * La prueba rápida del server, sin IA (tanda 7): ¿puede leer esta página SOLO? Un POST a la ruta del
 * Diagnóstico ({accion:'probarLectura'}, lib/editor-landing/diagnostico-server.ts: la MISMA regla que
 * Replicar, `motivoDePagina`). Sirve sólo para CERRAR temprano la ventana abierta en el clic; cualquier
 * falla es `false` (la ventana queda, y decide el pedido de siempre).
 */
export async function probarLecturaEnServer(url: string, ws: number | null = wsDeBusqueda(window.location.search)): Promise<boolean> {
  try {
    const r = await fetch(conWs(RUTA_DIAGNOSTICO, ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'probarLectura', url }),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; legible?: unknown } | null;
    return r.ok && j?.ok === true && j.legible === true;
  } catch {
    return false;
  }
}

/** Por qué no se leyó SIN clic, cuando el server pidió el navegador. `vacia`: se leyó y no tenía texto. */
export type SalidaSinLectura = { motivo: MotivoSinLectura | 'vacia'; mensaje: string };

export type PedidoConVentana<R> = {
  /** La página TAL CUAL la pegó la persona. */
  url: string;
  /** Lo que dejó el clic (`abrirEnElClic`, `tomarVentanaReservada`), o null si no hubo ventana. */
  ventana: VentanaDelClic | null;
  /** El pedido de siempre (Analizar, Replicar); con `lectura`, la segunda vuelta. Nunca tira. */
  pedir: (lectura?: LecturaDelServer) => Promise<R>;
  /** ¿El server contestó que la página se lee en el navegador (`enNavegador`)? */
  pideNavegador: (r: R) => boolean;
  /** La prueba rápida (por defecto, `probarLecturaEnServer`). Lo cambian los tests. */
  probar?: (url: string) => Promise<boolean>;
  /** Empieza la lectura en la ventana: la pantalla pasa a «Leyendo la página…». */
  alLeer?: () => void;
  /** ¿Sigue la pantalla? Si no, no se lee ni se repite el pedido (la segunda vuelta paga IA). */
  sigue?: () => boolean;
  /** Para `leerEnNavegador` (el camino, el tope, el workspace, la firma de los tests). */
  lectura?: Omit<OpcionesLectura, 'ventana'>;
};

export type ResultadoConVentana<R> = {
  /** El resultado que vale: el de la segunda vuelta, si se leyó en el navegador. */
  r: R;
  /** La lectura del navegador que se usó (el Diagnóstico la reusa para Replicar), o null. */
  lectura: LecturaDelServer | null;
  /** El server pidió el navegador y no se leyó sin clic (null también si nunca hubo ventana o ya estaba cerrada). */
  sinLectura: SalidaSinLectura | null;
};

/**
 * El pedido de Analizar o Replicar con la ventana abierta en el clic (ver la cabecera). En orden:
 *   1. al lado del pedido, la prueba rápida: si el server SÍ puede leer, la ventana se cierra ya;
 *   2. con la respuesta: si no pide el navegador, se cierra la ventana (si quedó) y listo;
 *   3. si lo pide y la ventana sigue viva, se lee en ESA ventana y el pedido se repite con la lectura,
 *      sin ningún clic. Sin texto (0 palabras), `vacia`: recién ahí se pega;
 *   4. bloqueada → `bloqueadas` (el aviso con la flecha). Cerrada antes de leer → `sinLectura` null (la
 *      salida de siempre, con su botón).
 * Nunca tira, y la ventana nunca queda abierta al terminar.
 */
export async function pedirConVentana<R>(o: PedidoConVentana<R>): Promise<ResultadoConVentana<R>> {
  const ventana = o.ventana && o.ventana !== 'bloqueada' ? o.ventana : null;
  let enUso = false;
  const soltar = () => { if (!enUso) cerrarVentana(ventana); };
  try {
    if (ventana && !ventana.closed) {
      void (o.probar ?? probarLecturaEnServer)(o.url).then((legible) => { if (legible) soltar(); }, () => {});
    }
    const r = await o.pedir();
    if (!o.pideNavegador(r)) return { r, lectura: null, sinLectura: null };
    if (o.ventana === 'bloqueada') return { r, lectura: null, sinLectura: { motivo: 'bloqueadas', mensaje: MENSAJE_SIN_LECTURA.bloqueadas } };
    if (!ventana || ventana.closed || (o.sigue && !o.sigue())) return { r, lectura: null, sinLectura: null };
    enUso = true;
    o.alLeer?.();
    const l = await leerEnNavegador(o.url, { ...o.lectura, ventana });
    if (!l.ok) return { r, lectura: null, sinLectura: { motivo: l.motivo, mensaje: l.mensaje } };
    if (l.detalle.palabras === 0) return { r, lectura: null, sinLectura: { motivo: 'vacia', mensaje: 'La página no mostró texto' } };
    if (o.sigue && !o.sigue()) return { r, lectura: null, sinLectura: null };
    return { r: await o.pedir(l.lectura), lectura: l.lectura, sinLectura: null };
  } finally {
    enUso = false;
    soltar();
  }
}
