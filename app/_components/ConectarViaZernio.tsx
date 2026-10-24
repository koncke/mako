'use client';

// =============================================================================
// ConectarViaZernio — «Conectar con Facebook / Instagram / anuncios de Meta», desde la tab donde estás
// =============================================================================
// Martín, 23/10/2026: «Que ellos conecten su API de Zernio y luego cuando quieran hacer X cosa que requiera un login, que en
// MaKo esté el botón de logearse con Facebook, Instagram o lo que haga falta». Y la regla de la casa (14/10): para una
// integración JAMÁS se sale de la tab. Una pieza para todas las pantallas que necesitan una red: el bloque «Redes» del modal de Zernio, Instagram y
// Messenger de Automations (`ConectarSocial`), Chats y, cuando lo cablee su chat, Ads Manager (anuncios de Meta).
//
// COPIADO DE NANGO (Connect UI + SDK frontend, https://nango.dev/docs/guides/auth/auth-guide.md y
// https://github.com/NangoHQ/nango/blob/master/packages/frontend/lib/index.ts): el modal es de la app y nunca navega; el login de la
// red se abre en una ventana emergente EN EL MISMO CLIC (`window.open('')` y la URL se asigna después, porque con un `await` por
// medio el navegador la bloquea); y la VERDAD la dice el servidor, no la ventana. De Ayrshare
// (https://www.ayrshare.com/docs/multiple-users/link-completion-events.md): un mensaje de la ventana sólo se mira si es del flujo
// esperado y sólo adelanta una medición, y un popup no se da por cancelado en el primer instante.
//
// COMO FUNCIONA (la parte del servidor, en lib/zernio-conectar.ts; lo puro, en lib/zernio-redes.ts):
//   1. EN EL CLIC y antes de cualquier `await`: `window.open('')` (sin `noopener`: con él devuelve null y no se puede asignar la URL;
//      el vínculo se corta a mano justo después, `opener = null`). En un teléfono o en el navegador interno de Instagram/Facebook/TikTok
//      no hay popup confiable (Meta lo dice en su doc): la pestaña navega y VUELVE a esta misma pantalla con `?zernio=<red>`.
//   2. Pide a la vez las conexiones de ANTES y el link (`/api/zernio`). Sin key (o con una mala): se abre el MISMO modal de Zernio
//      de /integraciones para pegarla ahí, y después queda el botón para volver a empezar (la ventana sólo se puede abrir en un clic).
//      Si ese modal ya está abierto (el bloque «Redes» vive adentro), `keyAca` lo dice acá mismo en vez de abrir OTRO encima.
//   3. Mientras la persona termina en la ventana se mide cada 4 s con `GET /v1/accounts` (`medirConexion`). El aviso de la landing de
//      la ventana (un `BroadcastChannel`, con el id de ESTE flujo) y el `accountId` de la vuelta son PISTAS para medir antes, nunca la medición.
//   4. Si la ventana se ve cerrada, 1,5 s de gracia, una medición más y un aviso («¿cerraste la ventana?»): NUNCA se da la conexión
//      por no hecha por eso, porque con `Cross-Origin-Opener-Policy` la ventana se ve cerrada desde acá aunque la persona siga
//      adentro. El botón sigue vivo para empezar de nuevo, y a los ~4 min se corta con «No llegó la cuenta».
//   5. La vuelta de PÁGINA ENTERA sólo vale si ESTA pestaña salió a hacer ese login (`guardarVuelta` en `sessionStorage`, con la red, las
//      cuentas de antes y la hora): un link armado a mano con `?zernio=…&connected=…` no hace nada, y se mide igual que la ventana.
//
// ⚠️ LA CUENTA NUEVA SE RECONOCE POR LO QUE NO ESTABA (`medirConexion`): con una ya conectada, «hay alguna» daba conectado en el
// primer sondeo, antes de que la persona terminara.
// ⚠️ UN SEGUNDO CLIC NO CIERRA LA VENTANA DEL PRIMERO: las dos corridas comparten la ventana por su nombre, y la vieja, al despertar,
// la cerraba con la nueva ya adentro de Meta. Sólo se cierra al desmontar, o cuando la corrida sigue siendo la vigente.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useConectarIntegracion } from './ConectarIntegracion';
import {
  CANAL_VENTANA, CLAVE_VUELTA, GRACIA_CIERRE_MS, MENSAJES_DE_MOTIVO, REDES, SONDEO_MAX, SONDEO_MS, delaRed, estadoDeRed, guardarVuelta,
  leerMensajeVentana, leerVueltaGuardada, medirConexion, retornoDeZernio, sinParamsDeVuelta, sinVentanaEmergente, textoDeErrorDeRetorno,
  type ConexionZernio, type MensajeVentana, type MotivoZernio, type RedZernio,
} from '@/lib/zernio-redes';

export type FaseZernio = 'listo' | 'abriendo' | 'esperando' | 'conectado' | 'error';
export type ExtraZernio = { reconectarId?: string | null; adAccountId?: string | null };

/** Lo que contesta POST /api/zernio (las acciones de esta pieza). */
type RespuestaApi = {
  ok?: boolean; motivo?: MotivoZernio; error?: string; pagoUrl?: string | null;
  tipo?: 'url' | 'ya-conectada'; url?: string; conexiones?: ConexionZernio[]; total?: number;
  ruteo?: 'ok' | 'ocupado' | 'error';
  // Lo manda recibirConexion (lib/zernio-conectar.ts:204) y la 158 lo lee: sin el campo, `c.webhook` no tipa.
  webhook?: 'creado' | 'actualizado' | 'sin_secreto' | 'error';
};

const api = (action: string, extra: Record<string, unknown> = {}): Promise<RespuestaApi | null> =>
  fetch('/api/zernio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
    // El tope de la ruta (60 s) más un margen: un `fetch` sin tope deja el botón «Conectando…» para siempre.
    signal: AbortSignal.timeout(65_000),
  }).then((r) => r.json() as Promise<RespuestaApi>).catch(() => null);

/** Las conexiones del negocio (de una red o de todas), o `null` si no se pudieron leer. */
export async function leerConexiones(red?: RedZernio): Promise<{ conexiones: ConexionZernio[]; total: number } | { motivo: MotivoZernio; error: string } | null> {
  const j = await api('conexiones', red ? { plataforma: red } : {});
  if (!j) return null;
  if (j.ok && Array.isArray(j.conexiones)) return { conexiones: j.conexiones, total: j.total ?? j.conexiones.length };
  return { motivo: j.motivo ?? 'error', error: j.error || MENSAJES_DE_MOTIVO[j.motivo ?? 'error'] };
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Las vueltas de página entera que ya se procesaron (varios botones montados no la procesan dos veces). */
const vueltasVistas = new Set<string>();
/** Un id del flujo (un clic): sólo los avisos de la ventana que lo traen se miran. */
const nuevoFlujo = (): string => {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return id.slice(0, 16);
};
/** Cuántas respuestas fallidas SEGUIDAS de la medición se aguantan antes de decir por qué (un 5xx suelto no corta nada). */
const FALLOS_SEGUIDOS = 3;

export type ConectarViaZernioApi = {
  fase: FaseZernio;
  /** La red en curso (la última que se tocó, o a la que volvía la página). */
  red: RedZernio | null;
  error: string | null;
  /** El link de pago de Zernio (sólo https) cuando pide una tarjeta. */
  pagoUrl: string | null;
  /** Un aviso que no es un error («guardaste tu key, toca Conectar de nuevo»). */
  nota: string | null;
  /** Se llama en el clic del botón, SIN `await` antes (si no, el navegador bloquea la ventana). */
  conectar: (red: RedZernio, extra?: ExtraZernio) => void;
  /** El modal de Zernio de /integraciones para pegar la key (null cerrado): va en el árbol. */
  modal: ReactNode;
};

/**
 * El hook de la pieza: `conectar(red)` en el clic. `volver` es la RUTA de esta pantalla («/ads-manager»): adonde vuelve la
 * pestaña si no hubo ventana emergente. `onConectado` recibe las conexiones de esa red (con su `accountId`) y la que quedó hecha, DESPUÉS de
 * armar la recepción de mensajes. `alError` y `alNota`: quien muestra los avisos en SU toast (Chats) los recibe acá; el componente los dibuja solo.
 */
export function useConectarViaZernio(opts: {
  volver: string;
  onConectado?: (conexiones: ConexionZernio[], nueva: ConexionZernio, red: RedZernio) => void;
  alError?: (texto: string, pagoUrl: string | null) => void;
  alNota?: (texto: string) => void;
  /** La key de Zernio se pega en ESTA misma pantalla (el modal de Zernio ya está abierto): sin key, o con una mala, lo dice en vez de abrir otro modal encima. */
  keyAca?: boolean;
}): ConectarViaZernioApi {
  const [fase, setFase] = useState<FaseZernio>('listo');
  const [red, setRed] = useState<RedZernio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagoUrl, setPagoUrl] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const vivo = useRef(true);
  const corrida = useRef(0);
  const adelantar = useRef(false);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; corrida.current += 1; };
  }, []);

  const ponerNota = useCallback((texto: string | null) => {
    if (!vivo.current) return;
    setNota(texto);
    if (texto) optsRef.current.alNota?.(texto);
  }, []);

  // Sin key (o con una que no sirve): EL modal de Zernio de /integraciones, ahí mismo. Al guardarla y probarla queda el botón.
  const { abrir: abrirIntegracion, modal } = useConectarIntegracion({
    onConectado: () => {
      if (!vivo.current) return;
      setError(null); setPagoUrl(null); setFase('listo');
      ponerNota('Listo, tu API key quedó guardada. Toca Conectar de nuevo.');
    },
  });

  const fallar = useCallback((texto: string, pago: string | null) => {
    if (!vivo.current) return;
    setFase('error'); setError(texto); setPagoUrl(pago);
    optsRef.current.alError?.(texto, pago);
  }, []);

  /**
   * Quedó conectada. Se arma la recepción de mensajes ANTES de avisarle a la pantalla (`onConectado`): sin eso conectar «anda» y no llega
   * ningún mensaje, y no da error. Si el ruteo no quedó (la cuenta ya es de otro negocio, o falló la base) se dice: «conectado ✓» NO garantiza que llegue nada.
   */
  const terminar = useCallback(async (r: RedZernio, ahora: readonly ConexionZernio[], nueva: ConexionZernio) => {
    if (!vivo.current) return;
    setFase('conectado'); setError(null); setPagoUrl(null); setNota(null);
    if (r === 'facebook' || r === 'instagram') {
      const c = await api('conectada');
      if (!vivo.current) return;
      if (!c || !c.ok || c.ruteo === 'error' || c.webhook === 'error') ponerNota('Quedó conectada, pero no pudimos armar la recepción de mensajes. Vuelve a conectarla.');
      else if (c.ruteo === 'ocupado') ponerNota('Quedó conectada, pero esa cuenta ya recibe sus mensajes en otro negocio de MaKo. Avisa a soporte.');
    }
    optsRef.current.onConectado?.(delaRed(r, ahora), nueva, r);
  }, [ponerNota]);

  const conectarAsync = useCallback(async (redElegida: RedZernio, extra: ExtraZernio = {}) => {
    const mia = ++corrida.current;
    const cancelada = () => !vivo.current || corrida.current !== mia;
    setError(null); setPagoUrl(null); setNota(null);

    // ⚠️ EN EL CLIC Y ANTES DE CUALQUIER `await`: pasado un `await` el navegador ya no lo cuenta como un gesto de la persona y bloquea
    // la ventana. Sin `noopener` (con él `window.open` devuelve null y no se le puede asignar la URL después).
    const sinPopup = sinVentanaEmergente(navigator.userAgent, window.innerWidth);
    const ventana = sinPopup ? null : window.open('', 'mako-zernio', 'popup=yes,width=560,height=740');
    // ⚠️ Y el vínculo se corta ya: la ventana va a páginas de terceros, y mientras `opener` apunte a esta pestaña, una página que no ponga
    // `Cross-Origin-Opener-Policy` podría mandarla a otra dirección (reverse tabnabbing). No hace falta: el aviso va por el canal y la medición es del servidor.
    try { if (ventana) ventana.opener = null; } catch { /* el navegador no deja: queda abierto */ }
    const modo = ventana ? 'ventana' : 'pagina';
    // Sólo se cierra al desmontar o si esta corrida sigue siendo LA vigente: una corrida más nueva comparte la ventana (por su nombre) y
    // la vieja, al despertar, la cerraba con la nueva ya adentro del login.
    const cerrar = () => { if (!vivo.current || corrida.current === mia) { try { ventana?.close(); } catch { /* otra ventana */ } } };
    setRed(redElegida); setFase('abriendo');
    const flujo = nuevoFlujo();

    // Las conexiones de ANTES salen junto con el pedido del link: para reconocer la nueva (`medirConexion`).
    const [antesJ, res] = await Promise.all([
      api('conexiones', { plataforma: redElegida }),
      api('conectar', { plataforma: redElegida, volver: optsRef.current.volver, modo, flujo, ...extra }),
    ]);
    if (cancelada()) { cerrar(); return; }
    const antes = antesJ?.ok && Array.isArray(antesJ.conexiones) ? antesJ.conexiones : null;

    if (!res) { cerrar(); fallar(MENSAJES_DE_MOTIVO['sin-red'], null); return; }
    if (!res.ok) {
      cerrar();
      const motivo = res.motivo ?? 'error';
      if (motivo === 'sin-clave' || motivo === 'clave-mala') {
        if (optsRef.current.keyAca) { fallar(`${MENSAJES_DE_MOTIVO[motivo]} Está arriba, en esta misma pantalla.`, null); return; }
        setFase('listo'); ponerNota(MENSAJES_DE_MOTIVO[motivo]); abrirIntegracion('zernio'); return;
      }
      fallar(res.error || MENSAJES_DE_MOTIVO[motivo], res.pagoUrl ?? null);
      return;
    }
    if (res.tipo === 'ya-conectada') {
      cerrar();
      const lista = res.conexiones ?? [];
      const nueva = delaRed(redElegida, lista).find((c) => c.activa && !c.vencida);
      if (nueva) await terminar(redElegida, lista, nueva); else fallar(MENSAJES_DE_MOTIVO.respuesta, null);
      return;
    }
    if (res.tipo !== 'url' || !res.url) { cerrar(); fallar(MENSAJES_DE_MOTIVO.respuesta, null); return; }

    // Sin ventana (teléfono, navegador interno o popup bloqueado): la pestaña navega y vuelve a ESTA pantalla con `?zernio=<red>`. Antes de salir se
    // guarda, en ESTA pestaña, que este login lo inició ella y qué había (la vuelta lo mide igual que la ventana).
    if (!ventana) {
      try { window.sessionStorage.setItem(CLAVE_VUELTA, guardarVuelta({ red: redElegida, antes, reconectarId: extra.reconectarId ?? null, ahoraMs: Date.now() })); } catch { /* sin almacenamiento: no hay vuelta que atar */ }
      window.location.assign(res.url);
      return;
    }
    try { ventana.location.href = res.url; } catch { cerrar(); fallar(MENSAJES_DE_MOTIVO.error, null); return; }
    setFase('esperando');

    // ── Esperar: medir cada SONDEO_MS, y antes si la ventana avisa o se cierra ──
    let pista: string | null = null;
    // En un objeto y no en un `let`: la unica asignacion vive dentro del closure `recibir`, asi que TS
    // narrowea el `let` a null y el `if` de abajo da `never`. Una propiedad si se narrowea en el if.
    const deLaVentana: { msg: MensajeVentana | null } = { msg: null };
    adelantar.current = false;
    const recibir = (data: unknown) => {
      const m = leerMensajeVentana(data);
      // Sólo los avisos de ESTE flujo: el canal es del origen entero y lo reciben todas las pestañas con un login en curso.
      if (!m || m.flujo !== flujo) return;
      pista = m.accountId; if (m.error) deLaVentana.msg = m; adelantar.current = true;
    };
    // El origen y la fuente: otra pestaña (o una página cualquiera) no puede hacer pasar un mensaje por el de la ventana.
    const alMensaje = (e: MessageEvent) => { if (e.origin === window.location.origin && e.source === ventana) recibir(e.data); };
    window.addEventListener('message', alMensaje);
    // ⚠️ Si la red pone `Cross-Origin-Opener-Policy`, el navegador corta el vínculo con la ventana: `window.opener` queda en null y
    // el mensaje no llega. El canal es del mismo origen y sigue andando; sólo trae una PISTA (la medición la hace el servidor).
    const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CANAL_VENTANA) : null;
    if (canal) canal.onmessage = (e: MessageEvent) => recibir(e.data);
    try {
      const inicio = Date.now();
      let ultima = 0;
      let cierre: number | null = null;
      let avisoDeCierre = false;
      let fallosSeguidos = 0;
      let ultimoFallo = '';
      while (Date.now() - inicio < SONDEO_MAX * SONDEO_MS) {
        await dormir(500);
        if (cancelada()) { cerrar(); return; }
        // ⚠️ `closed` NO ES «CANCELÓ»: con `Cross-Origin-Opener-Policy` la ventana se ve cerrada desde acá aunque la persona siga
        // adentro. Cerrada sólo adelanta una medición y avisa; nunca da la conexión por no hecha antes del tope.
        if (cierre == null && ventana.closed) cierre = Date.now();
        const graciaCumplida = cierre != null && Date.now() - cierre >= GRACIA_CIERRE_MS && !avisoDeCierre;
        if (!adelantar.current && !graciaCumplida && Date.now() - ultima < SONDEO_MS) continue;
        adelantar.current = false; ultima = Date.now();
        const j = await api('conexiones', { plataforma: redElegida });
        if (cancelada()) { cerrar(); return; }
        if (j?.ok && Array.isArray(j.conexiones)) {
          fallosSeguidos = 0;
          const nueva = medirConexion({ red: redElegida, antes, ahora: j.conexiones, pista, reconectarId: extra.reconectarId ?? null });
          if (nueva) { cerrar(); await terminar(redElegida, j.conexiones, nueva); return; }
        } else {
          // Un error que NO se arregla esperando se dice YA (key, cuenta pausada); los demás, si se repiten: esperar 4 minutos para decir
          // «no llegó» esconde la causa (un nombre que Zernio cambió, un 400 del filtro, un perfil que no está).
          const motivo = j?.motivo ?? 'sin-red';
          if (motivo === 'sin-clave' || motivo === 'clave-mala' || motivo === 'clave-en-uso' || motivo === 'pausada' || motivo === 'pago') {
            cerrar(); fallar(j?.error || MENSAJES_DE_MOTIVO[motivo], j?.pagoUrl ?? null); return;
          }
          fallosSeguidos = motivo === ultimoFallo ? fallosSeguidos + 1 : 1; ultimoFallo = motivo;
          if (fallosSeguidos >= FALLOS_SEGUIDOS) { cerrar(); fallar(j?.error || MENSAJES_DE_MOTIVO[motivo], j?.pagoUrl ?? null); return; }
        }
        // El error de la ventana se dice con lo que trajo, y la ventana NO se cierra: la landing queda unos segundos para que se alcance a leer.
        if (deLaVentana.msg) { fallar(textoDeErrorDeRetorno(deLaVentana.msg.error, deLaVentana.msg.mensaje), null); return; }
        if (graciaCumplida) {
          avisoDeCierre = true;
          ponerNota('¿Cerraste la ventana? Si ya terminaste, espera unos segundos; si no, toca Conectar para empezar de nuevo.');
        }
      }
      cerrar();
      fallar('No llegó la cuenta. Prueba de nuevo.', null);
    } finally {
      window.removeEventListener('message', alMensaje);
      canal?.close();
    }
  }, [abrirIntegracion, fallar, ponerNota, terminar]);

  const conectar = useCallback((r: RedZernio, extra?: ExtraZernio) => { void conectarAsync(r, extra); }, [conectarAsync]);

  // ── La vuelta de PÁGINA ENTERA: `?zernio=<red>` y lo que agregó Zernio (`connected`, `accountId`, `error`…) ──
  useEffect(() => {
    const clave = window.location.search;
    const ret = retornoDeZernio(clave);
    if (!ret.red || vueltasVistas.has(clave)) return;
    vueltasVistas.add(clave);
    // Se consume UNA vez y se saca de la barra (un F5 no repite el aviso); se conserva todo lo demás (`ws`, `abrir`…).
    // ⚠️ `replaceState(null, …)` y NO el `state` de la página: con el que ya tiene (`__NA`), el parche de Next lo deja pasar sin enterarse del
    // cambio de URL, y su router vuelve a escribir los parámetros en el próximo cambio; con `null` copia su estado y sincroniza la URL (app-router.js).
    window.history.replaceState(null, '', `${window.location.pathname}${sinParamsDeVuelta(clave)}${window.location.hash}`);
    const r = ret.red;
    // ⚠️ SÓLO si ESTA pestaña salió a hacer este login (y hace menos de 30 minutos): un link armado a mano, o la vuelta de otra red, no hace nada.
    let guardada = null as ReturnType<typeof leerVueltaGuardada>;
    try {
      guardada = leerVueltaGuardada(window.sessionStorage.getItem(CLAVE_VUELTA), r, Date.now());
      if (guardada) window.sessionStorage.removeItem(CLAVE_VUELTA);
    } catch { /* sin almacenamiento */ }
    if (!guardada) return;
    const g = guardada;
    setRed(r);
    if (ret.error) { fallar(textoDeErrorDeRetorno(ret.error, ret.mensaje), null); return; }
    setFase('abriendo');
    void (async () => {
      const j = await api('conexiones', { plataforma: r });
      if (!vivo.current) return;
      if (!j?.ok || !Array.isArray(j.conexiones)) { fallar(j?.error || MENSAJES_DE_MOTIVO['sin-red'], j?.pagoUrl ?? null); return; }
      // Se mide como en la ventana: lo que Zernio lista AHORA y no estaba ANTES (o la que nombra la vuelta, si existe y está sana). `connected`
      // de la URL sólo es una pista: si Zernio lo llama distinto, la cuenta igual se ve en el listado.
      const nueva = medirConexion({ red: r, antes: g.antes, ahora: j.conexiones, pista: ret.accountId, reconectarId: g.reconectarId });
      if (nueva) await terminar(r, j.conexiones, nueva);
      else fallar(estadoDeRed(r, j.conexiones).estado === 'vencida' ? 'Zernio pide reconectar esa cuenta. Vuelve a intentarlo.' : 'No pudimos confirmar la conexión. Vuelve a intentarlo.', null);
    })();
    // Al montar: la vuelta se procesa una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Volver con «atrás» desde la pantalla de permisos de Meta (el navegador restaura la página tal como estaba): el botón no puede quedar «Conectando…».
  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => { if (e.persisted) setFase((f) => (f === 'abriendo' ? 'listo' : f)); };
    window.addEventListener('pageshow', alVolver);
    return () => window.removeEventListener('pageshow', alVolver);
  }, []);

  return { fase, red, error, pagoUrl, nota, conectar, modal };
}

// ── La pantalla ──────────────────────────────────────────────────────────────

const LINEA: CSSProperties = { fontSize: 13, lineHeight: 1.4 };

/** El estado de lo que se está haciendo: esperando, conectado, el error o el aviso. Sin nada que decir no dibuja nada. */
export function EstadoConexion({ z }: { z: Pick<ConectarViaZernioApi, 'fase' | 'red' | 'error' | 'pagoUrl' | 'nota'> }) {
  const etiqueta = z.red ? REDES[z.red].etiqueta : '';
  return (
    <>
      {z.fase === 'esperando' && (
        <span role="status" style={{ ...LINEA, color: 'var(--dim)' }}>Termina en la ventana que se abrió. Si no la ves, revisa que el navegador no la haya bloqueado.</span>
      )}
      {z.fase === 'conectado' && <span role="status" style={{ ...LINEA, color: 'var(--good)', fontWeight: 600 }}>{etiqueta ? `${etiqueta} conectado ✓` : 'Conectado ✓'}</span>}
      {z.nota && <span role="status" style={{ ...LINEA, color: 'var(--dim)' }}>{z.nota}</span>}
      {z.fase === 'error' && z.error && (
        <span role="alert" style={{ ...LINEA, color: 'var(--bad)' }}>
          {z.error}
          {z.pagoUrl && /^https:\/\//.test(z.pagoUrl) && (
            <> <a href={z.pagoUrl} target="_blank" rel="noopener noreferrer" data-zernio-pago style={{ color: 'var(--primary)', fontWeight: 600 }}>Pagar en Zernio</a></>
          )}
          <ReportarASoporte />
        </span>
      )}
    </>
  );
}

/**
 * Un botón «Conectar» y su estado, listo para pegar en cualquier pantalla:
 *   <ConectarViaZernio red="metaads" volver="/ads-manager" onConectado={(conexiones) => …}>Conectar anuncios</ConectarViaZernio>
 */
export function ConectarViaZernio({ red, volver, onConectado, children, reconectarId, adAccountId, variant = 'primary', size }: {
  red: RedZernio;
  /** La RUTA de esta pantalla («/ads-manager»): adonde vuelve la pestaña sin ventana emergente. */
  volver: string;
  onConectado?: (conexiones: ConexionZernio[], nueva: ConexionZernio) => void;
  children?: ReactNode;
  /** Reconectar una cuenta que Zernio dice vencida. */
  reconectarId?: string | null;
  /** Acota los anuncios a UNA cuenta publicitaria (`act_<dígitos>`). */
  adAccountId?: string | null;
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md';
}) {
  const z = useConectarViaZernio({ volver, onConectado: (c, n) => onConectado?.(c, n) });
  // ⚠️ En «esperando» el botón NO se bloquea: es la salida de quien cerró la ventana sin terminar (toca de nuevo y empieza otra vez).
  const ocupado = z.fase === 'abriendo';
  return (
    <>
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <Button variant={variant} size={size} loading={ocupado} disabled={ocupado} data-conectar-zernio={red}
          onClick={() => z.conectar(red, { reconectarId, adAccountId })}>
          {children ?? `Conectar ${REDES[red].etiqueta}`}
        </Button>
        <EstadoConexion z={z} />
      </span>
      {z.modal}
    </>
  );
}
