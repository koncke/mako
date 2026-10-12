'use client';

// =============================================================================
// ConectarMedio — conectar un medio AHÍ MISMO, sin salir de la pestaña (décima tanda, GENERAL 6)
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «Si un usuario está creando una automatización que utiliza un medio
// que aún no conectó, en la tarjeta lo debe decir, y al momento de probarlo también. Y claro, no dejar
// publicarlo hasta que no lo configure. Y esas configuraciones siempre allí mismo, sin salirse de la pestaña.»
// Diseño: docs/diseno-automations-configuraciones.md §2.
//
// UN MODAL POR MEDIO, y es el MISMO que ya usaba «Probar» para vincular un emisor (`VincularEmisor`, que vivía
// en PanelProbar.tsx y se mudó acá): lo montan la tarjeta (el chip «Sin conectar», FlujoLienzo), «Probar», el
// 409 de Publicar (SecuenciaPerfil) y el CRON (EditorDisparadores). Dos modales para lo mismo son los que
// dejan de decir lo mismo.
//   · WhatsApp — `EvolutionConnect` con `nueva` (el QR de una línea, el de /whatsapp), en el modal.
//   · Email — `VincularRemitente` (app/automations/EditorEmailGmail.tsx), que carga `DominioSetup` de /email.
//   · Instagram / Messenger — el OAuth de Zernio en una VENTANA EMERGENTE y el sondeo de `estado` hasta que
//     aparezca la cuenta. Antes `EditorMensajeSocial` abría una pestaña nueva y no se enteraba de la vuelta.
//     Duodécima tanda (§2.11): SIN KEY O CON KEY MALA SE RESUELVE AHÍ MISMO. Con un 402 (la cuenta de Zernio del
//     negocio, pausada por falta de pago) dice eso y da su link de pago. Lo que contestó la ruta lo lee UNA función
//     (`leerZernio`), la misma para el modal y la cabecera de la tarjeta (EditorMensajeSocial).
//     DECIMOTERCERA TANDA (punto 5): sin Zernio («Falta conectar Zernio») o con un 401 de la key propia, se abre EL
//     modal de Zernio de /integraciones (`ServicioSuelto`), no un campo propio; al cerrarlo, sigue el OAuth.
//
// ⚠️ CONECTAR ALGO CAMBIA LO QUE CONTESTAN LAS LECTURAS CACHEADAS: el estado de los medios (`useEstadoMedios`,
// acá) y el de los canales del CRON (`canalesDeLaVisita`, EditorDisparadores). Al conectar se avisa
// (`avisarMedioConectado`) y las dos se vacían; sin eso el chip «Sin conectar» sigue después de conectar.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Button, Modal } from '@/app/_ui';
import { EvolutionConnect } from '../whatsapp/EvolutionConnect';
import { VincularRemitente } from './EditorEmailGmail';
import type { DomState } from '../email/EmailApp';
import { plataformaDe, NOMBRE_CANAL, type CanalSocial } from '@/lib/canal-social';
import { consultaDeMedios, type EstadoMedios, type Medio } from '@/lib/medios-automatizacion';

// ── «Algo se conectó»: las lecturas cacheadas se vacían ──────────────────────────────────────────

const oyentes = new Set<() => void>();
/** Lo llama quien termina de conectar algo (un QR escaneado, un dominio, una cuenta de Zernio). */
export function avisarMedioConectado(): void {
  cacheMedios.clear();
  for (const f of [...oyentes]) { try { f(); } catch { /* un oyente roto no frena a los demás */ } }
}
/** Se suscribe a «algo se conectó» mientras el componente vive. `fn` puede cambiar de identidad. */
export function useAlConectarMedio(fn: () => void): void {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => {
    const f = () => ref.current();
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
}

// ── El estado de los medios, una lectura por visita y por conjunto de medios ────────────────────

const cacheMedios = new Map<string, Promise<EstadoMedios | null>>();

/**
 * ¿Están conectados los medios que usa esta automatización? `undefined` = todavía no llegó; `null` = no se
 * pudo leer («no pude comprobarlo»: nada avisa ni frena). Sin medios que medir, `{}` sin pedir nada.
 */
export function useEstadoMedios(usa: readonly Medio[], activo = true): EstadoMedios | null | undefined {
  const clave = consultaDeMedios(usa);
  const [estado, setEstado] = useState<{ clave: string; v: EstadoMedios | null } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useAlConectarMedio(useCallback(() => setVuelta((v) => v + 1), []));
  useEffect(() => {
    if (!activo || !usa.length) return;
    let vivo = true;
    let p = cacheMedios.get(clave);
    if (!p) {
      p = fetch(`/api/chat-agent/secuencias?${clave}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
        .then((r) => r.json()).then((j: { ok?: boolean; medios?: EstadoMedios }) => (j?.ok && j.medios ? j.medios : null))
        .catch(() => null);
      cacheMedios.set(clave, p);
    }
    void p.then((v) => { if (!v) cacheMedios.delete(clave); if (vivo) setEstado({ clave, v }); });
    return () => { vivo = false; };
    // `usa` entra por su `clave` (un array nuevo por render no vuelve a pedir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo, vuelta]);
  if (!usa.length) return {};
  return estado && estado.clave === clave ? estado.v : undefined;
}

// ── El modal ──────────────────────────────────────────────────────────────────────────────────

/** Cada cuánto se pregunta si la cuenta de Instagram/Messenger ya apareció, y hasta cuándo (≈4 min). */
const SONDEO_MS = 4000;
const SONDEO_MAX = 60;

// ── Lo que contesta POST /api/zernio, leído en UN lugar (el modal y la cabecera de la tarjeta) ──────────

/** Los textos (los mismos de app/api/zernio/route.ts: el test los compara). */
export const ZERNIO_SIN_KEY = 'Falta conectar Zernio';
export const ZERNIO_KEY_MALA = 'Tu key de Zernio no sirve';
export const ZERNIO_PAUSADA = 'Tu cuenta de Zernio está pausada';

export type CuentaZernio = { id: string; usuario: string; nombre: string };
/** La respuesta cruda de la ruta (`estado` o `conectar`). */
export type RespuestaZernio = {
  ok?: boolean; url?: string; configurado?: boolean; cuentas?: CuentaZernio[]; error?: string;
  motivo?: 'key' | 'pausada'; billingUrl?: unknown;
};
/**
 * Lo que la pantalla hace con eso: `sin_zernio` y `key_mala` piden la key ahí mismo; `pausada` da el link de
 * pago (`pago`, sólo un https); `error` es lo demás (Zernio caído, sin red).
 */
export type EstadoZernio =
  | { estado: 'ok'; url?: string; cuentas: CuentaZernio[] }
  | { estado: 'sin_zernio' }
  | { estado: 'key_mala'; error: string }
  | { estado: 'pausada'; error: string; pago: string | null }
  | { estado: 'error'; error: string };

export function leerZernio(j: RespuestaZernio | null | undefined): EstadoZernio {
  if (!j || typeof j !== 'object') return { estado: 'error', error: 'Sin conexión' };
  // Primero: sin Zernio la ruta contesta `ok: true` (no es un fallo de la llamada).
  if (j.configurado === false) return { estado: 'sin_zernio' };
  if (j.ok) return { estado: 'ok', url: j.url, cuentas: Array.isArray(j.cuentas) ? j.cuentas : [] };
  if (j.motivo === 'key') return { estado: 'key_mala', error: ZERNIO_KEY_MALA };
  if (j.motivo === 'pausada') {
    const pago = typeof j.billingUrl === 'string' && /^https:\/\/[^\s"'<>]+$/.test(j.billingUrl) ? j.billingUrl : null;
    return { estado: 'pausada', error: ZERNIO_PAUSADA, pago };
  }
  return { estado: 'error', error: j.error || 'Zernio no contestó' };
}

/** ¿Con esto se pide la key ahí mismo? */
export const pideKeyZernio = (e: EstadoZernio | null | undefined): boolean => e?.estado === 'sin_zernio' || e?.estado === 'key_mala';

/**
 * LA CUENTA QUE SE ACABA DE CONECTAR (decimocuarta tanda, punto 5: varias cuentas de Instagram, como varios WhatsApp). Con
 * una cuenta ya conectada, «hay alguna» daba conectado en el PRIMER sondeo, antes de que la persona terminara en la
 * ventana: lo que cuenta es una cuenta que antes no estaba. `antes` null = no se supo qué había (cualquiera vale, lo de
 * antes). Pura y exportada para el test.
 */
export function cuentaNueva(antes: readonly string[] | null, ahora: readonly CuentaZernio[]): CuentaZernio | null {
  if (!antes) return ahora[0] ?? null;
  return ahora.find((c) => !antes.includes(c.id)) ?? null;
}

/**
 * ⚠️ SIN ZERNIO O CON LA KEY MALA, EL MODAL DE /integraciones (decimotercera tanda, punto 5; Martín, con la captura del
 * modal «Conectar Instagram» que pedía la key en un campo propio: «No crees un nuevo modal de conectar la API, reutiliza
 * exactamente el mismo que ya tenemos en integraciones»). Es el `ServicioModal` de la grilla para Zernio
 * (app/integraciones/ServicioSuelto.tsx: el carrusel, el chip, `ServicioConfigForm` con pegar, guardar y probar), sin
 * salir de la pestaña. Hasta acá este modal tenía su campo «API key de Zernio» y su `guardarKeyZernio`: la misma
 * credencial por dos formularios. Se carga A DEMANDA: la grilla de /integraciones no viaja con el lienzo.
 */
const ServicioSuelto = dynamic(() => import('@/app/integraciones/ServicioSuelto'), { ssr: false, loading: () => null });

/** El botón que vuelve al modal de Integraciones cuando la key que se guardó no sirve. */
export const REVISAR_ZERNIO = 'Abrir Zernio';

/**
 * Instagram o Messenger: el OAuth de Zernio en una ventana emergente y el sondeo de la cuenta. `inicial` es lo que
 * ya sabe quien lo abre (la cabecera de la tarjeta): con «sin Zernio» o la key mala abre directo en el modal de
 * Integraciones. Sin `inicial`, pregunta el estado al abrir y, si Zernio no está, va al mismo lugar.
 */
export function ConectarSocial({ medio, inicial = null, onCerrar, onConectado, onCuenta }: {
  medio: CanalSocial; inicial?: EstadoZernio | null; onCerrar: () => void; onConectado: () => void;
  /** La cuenta que se conectó (quien la pidió desde una tarjeta la deja elegida en ella). */
  onCuenta?: (c: CuentaZernio) => void;
}) {
  const [fase, setFase] = useState<'zernio' | 'listo' | 'abriendo' | 'esperando' | 'conectado'>(() => (pideKeyZernio(inicial) ? 'zernio' : 'listo'));
  const [error, setError] = useState<string | null>(() => (inicial && inicial.estado !== 'ok' && inicial.estado !== 'sin_zernio' && !pideKeyZernio(inicial) ? inicial.error : null));
  const [pago, setPago] = useState<string | null>(inicial?.estado === 'pausada' ? inicial.pago : null);
  /** Se guardó la key en Integraciones y Zernio igual no la acepta: el botón para volver. */
  const [revisar, setRevisar] = useState(false);
  /** Integraciones avisó que Zernio quedó conectado (`ServicioConfigForm`, al guardar). */
  const guardoKey = useRef(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const plataforma = plataformaDe(medio);
  const pedir = useCallback((action: 'estado' | 'conectar') => fetch('/api/zernio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, plataforma }), signal: AbortSignal.timeout(65_000),
  }).then((r) => r.json()).catch(() => null) as Promise<RespuestaZernio | null>, [plataforma]);
  const cerrar = () => { if (guardoKey.current) avisarMedioConectado(); onCerrar(); };

  // Sin lo que ya se sabe, se pregunta al abrir: sin Zernio (o con la key mala) se va directo a Integraciones.
  useEffect(() => {
    if (inicial) return;
    void pedir('estado').then((j) => {
      if (!vivo.current) return;
      const e = leerZernio(j);
      if (pideKeyZernio(e)) setFase((f) => (f === 'listo' ? 'zernio' : f));
    });
    // Al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Se cerró el modal de Integraciones. Si Zernio ya sirve, sigue el OAuth acá («Conectar Instagram»). Si sigue sin
   * servir y se guardó una key, se dice y queda el botón para volver; si no se guardó nada, se cierra todo (la persona
   * no quiso).
   */
  const alCerrarZernio = async () => {
    setFase('listo'); setError(null); setPago(null); setRevisar(false);
    const e = leerZernio(await pedir('estado'));
    if (!vivo.current) return;
    if (!pideKeyZernio(e)) {
      if (guardoKey.current) avisarMedioConectado();
      if (e.estado === 'pausada') { setError(e.error); setPago(e.pago); }
      return;
    }
    if (!guardoKey.current) { onCerrar(); return; }
    setError(e.estado === 'key_mala' ? e.error : ZERNIO_SIN_KEY);
    setRevisar(true);
  };

  const conectar = async () => {
    setError(null); setPago(null); setRevisar(false);
    // La ventana se abre EN el clic (si no, el navegador la bloquea) y después se le pone la URL.
    const ventana = window.open('', 'mako-conectar', 'width=560,height=720');
    setFase('abriendo');
    // Las cuentas de ANTES, para reconocer la nueva (`cuentaNueva`): las de ahora o, si no se pudo leer, las que ya se sabían.
    const [crudo, previo] = await Promise.all([pedir('conectar'), pedir('estado')]);
    const res = leerZernio(crudo);
    const ePrevio = leerZernio(previo);
    const antes = ePrevio.estado === 'ok' ? ePrevio.cuentas.map((c) => c.id) : inicial?.estado === 'ok' ? inicial.cuentas.map((c) => c.id) : null;
    if (!vivo.current) return;
    if (res.estado !== 'ok' || !res.url) {
      ventana?.close();
      // Sin Zernio o con la key mala: EL modal de Integraciones, ahí mismo.
      if (pideKeyZernio(res)) { setFase('zernio'); return; }
      setFase('listo');
      setError(res.estado === 'ok' || res.estado === 'sin_zernio' ? 'No se pudo conectar' : res.error);
      if (res.estado === 'pausada') setPago(res.pago);
      return;
    }
    const j = { url: res.url };
    if (ventana) ventana.location.href = j.url; else window.open(j.url, '_blank', 'noopener');
    setFase('esperando');
    for (let i = 0; i < SONDEO_MAX && vivo.current; i += 1) {
      await new Promise((r) => setTimeout(r, SONDEO_MS));
      if (!vivo.current) return;
      const e = await pedir('estado');
      const nueva = e?.ok && Array.isArray(e.cuentas) ? cuentaNueva(antes, e.cuentas) : null;
      if (nueva) {
        try { ventana?.close(); } catch { /* otra ventana */ }
        setFase('conectado');
        avisarMedioConectado();
        onCuenta?.(nueva);
        onConectado();
        return;
      }
    }
    if (vivo.current) { setFase('listo'); setError('No llegó la cuenta. Prueba de nuevo.'); }
  };

  if (fase === 'zernio') {
    return <ServicioSuelto servicio="zernio" onCerrar={() => void alCerrarZernio()} onConectado={() => { guardoKey.current = true; }} />;
  }
  return (
    <Modal titulo={`Conectar ${NOMBRE_CANAL[medio]}`} onCerrar={cerrar} ancho={440}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, fontSize: 13.5, color: 'var(--ink)' }}>
        {fase === 'conectado'
          ? <span role="status" style={{ color: 'var(--good)', fontWeight: 600 }}>Conectado ✓</span>
          : fase === 'esperando'
            ? <span role="status" style={{ color: 'var(--dim)' }}>Termina en la ventana que se abrió.</span>
            : (
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={() => void conectar()} disabled={fase === 'abriendo'}>{`Conectar ${NOMBRE_CANAL[medio]}`}</Button>
                {revisar && (
                  <Button variant="secondary" data-revisar-zernio="" onClick={() => { guardoKey.current = false; setRevisar(false); setFase('zernio'); }}>{REVISAR_ZERNIO}</Button>
                )}
              </span>
            )}
        {error && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</span>}
        {pago && <a href={pago} target="_blank" rel="noopener noreferrer" data-zernio-pago style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Pagar en Zernio</a>}
      </div>
    </Modal>
  );
}

/**
 * WhatsApp: el QR de la línea (`linea`, o la de por default) o, con `nueva`, el de un número más. Avisa UNA vez
 * cuando queda conectada: la nueva por `onLineaCreada`, la de siempre por `onEstado`.
 */
function ConectarWhatsApp({ linea, nueva, onCerrar, onLinea, onConectado }: {
  linea: string | null; nueva: boolean; onCerrar: () => void; onLinea?: (linea: string) => void; onConectado?: () => void;
}) {
  const avisado = useRef(false);
  const listo = (l: string | null) => {
    if (avisado.current) return;
    avisado.current = true;
    avisarMedioConectado();
    if (l) onLinea?.(l);
    onConectado?.();
  };
  return (
    <Modal titulo="Vincular número" onCerrar={onCerrar} ancho={440}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        {nueva
          ? <EvolutionConnect key="nueva-linea" nueva inline panelVisible ocultarChip onLineaCreada={(l: string) => listo(l)} />
          : <EvolutionConnect key={`linea-${linea ?? ''}`} linea={linea} inline panelVisible ocultarChip onEstado={(e) => { if (e === 'conectado') listo(null); }} />}
      </div>
    </Modal>
  );
}

/**
 * Conectar `medio` ahí mismo. `onLinea` (WhatsApp) y `onDominio` (email) son los del flujo de cada uno, para
 * quien necesita el dato (Probar elige el emisor recién vinculado); `onConectado`, para cualquiera.
 */
export function ConectarMedio({ medio, linea = null, nueva = false, dom = null, reemplaza = false, onCerrar, onLinea, onDominio, onConectado, zernio = null, onCuenta }: {
  medio: Medio;
  /**
   * WhatsApp: la línea que hay que conectar (la de la automatización; null = la de por default). Se RECONECTA
   * esa —medido: ws13 con la línea caída desde el 18/08—: una línea nueva no arregla la automatización, que
   * sigue apuntando a la suya.
   */
  linea?: string | null;
  /** WhatsApp: «Vincular nuevo» de Probar (otro número), no la línea de la automatización. */
  nueva?: boolean;
  /** Email: el dominio ya leído (si no, lo lee el modal). */
  dom?: DomState | null;
  /** Email: hoy un negocio tiene UN remitente, y el modal dice que lo reemplaza. */
  reemplaza?: boolean;
  onCerrar: () => void;
  onLinea?: (linea: string) => void;
  onDominio?: (d: DomState) => void;
  onConectado?: () => void;
  /** Instagram / Messenger: lo que ya se sabe de Zernio (la cabecera de la tarjeta). Sin key o key mala: abre en el campo. */
  zernio?: EstadoZernio | null;
  /** Instagram / Messenger: la cuenta que se conectó (la tarjeta que pidió «Conectar otra» la deja elegida). */
  onCuenta?: (c: CuentaZernio) => void;
}): ReactNode {
  // Email: el dominio se conecta en VARIOS pasos (registros DNS, verificación) y `onDominio` avisa en cada
  // uno: no se cierra solo. Cada paso y el cierre vuelven a leer el estado (el chip puede apagarse).
  if (medio === 'email') {
    return <VincularRemitente inicial={dom} reemplaza={reemplaza} onCerrar={() => { avisarMedioConectado(); onCerrar(); }}
      onDominio={(d) => { avisarMedioConectado(); onDominio?.(d); }} />;
  }
  // Al `body`: quien lo monta vive en un muelle o en la tarjeta del lienzo, y un `fixed` adentro de un
  // contexto de apilamiento queda debajo de lo que tenga un z mayor (AGENTS.md, el `sticky` con z-index).
  if (medio === 'whatsapp') return createPortal(<ConectarWhatsApp linea={linea} nueva={nueva} onCerrar={onCerrar} onLinea={onLinea} onConectado={onConectado} />, document.body);
  return createPortal(<ConectarSocial medio={medio} inicial={zernio} onCerrar={onCerrar} onConectado={() => onConectado?.()} onCuenta={onCuenta} />, document.body);
}
