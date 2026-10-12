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
//     Duodécima tanda (§2.11): SIN KEY O CON KEY MALA SE RESUELVE AHÍ MISMO. Sin Zernio («Falta conectar Zernio»)
//     o con un 401 de la key propia, el modal pide «API key de Zernio», la guarda por la MISMA puerta que
//     /integraciones (POST /api/integraciones/credencial, `guardar`) y sigue con el OAuth. Con un 402 (la cuenta de
//     Zernio del negocio, pausada por falta de pago) dice eso y da su link de pago. Lo que contestó la ruta lo lee
//     UNA función (`leerZernio`), la misma para el modal y la cabecera de la tarjeta (EditorMensajeSocial).
//
// ⚠️ CONECTAR ALGO CAMBIA LO QUE CONTESTAN LAS LECTURAS CACHEADAS: el estado de los medios (`useEstadoMedios`,
// acá) y el de los canales del CRON (`canalesDeLaVisita`, EditorDisparadores). Al conectar se avisa
// (`avisarMedioConectado`) y las dos se vacían; sin eso el chip «Sin conectar» sigue después de conectar.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, TextField } from '@/app/_ui';
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
 * Guarda la key del negocio por la MISMA puerta que /integraciones (whitelist por servicio, auditoría, el rechazo de
 * la key de la plataforma). Devuelve el error a mostrar, o null si quedó guardada.
 */
async function guardarKeyZernio(key: string): Promise<string | null> {
  const j = await fetch('/api/integraciones/credencial', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ action: 'guardar', servicio: 'zernio', valores: { ZERNIO_API_KEY: key } }),
  }).then((r) => r.json()).catch(() => null) as { ok?: boolean; guardadas?: number; error?: string } | null;
  if (!j) return 'Sin conexión';
  if (!j.ok || !j.guardadas) return j.error || 'No se pudo guardar la key';
  return null;
}

/**
 * Instagram o Messenger: el OAuth de Zernio en una ventana emergente y el sondeo de la cuenta. `inicial` es lo que
 * ya sabe quien lo abre (la cabecera de la tarjeta): con «sin Zernio» o la key mala abre directo en el campo.
 */
export function ConectarSocial({ medio, inicial = null, onCerrar, onConectado }: {
  medio: CanalSocial; inicial?: EstadoZernio | null; onCerrar: () => void; onConectado: () => void;
}) {
  const [fase, setFase] = useState<'listo' | 'abriendo' | 'esperando' | 'conectado'>('listo');
  const [error, setError] = useState<string | null>(() =>
    inicial?.estado === 'sin_zernio' ? ZERNIO_SIN_KEY : inicial && inicial.estado !== 'ok' ? inicial.error : null);
  const [pideKey, setPideKey] = useState(() => pideKeyZernio(inicial));
  const [pago, setPago] = useState<string | null>(inicial?.estado === 'pausada' ? inicial.pago : null);
  const [key, setKey] = useState('');
  /** Se guardó una key: al cerrar, las lecturas cacheadas se vuelven a pedir (aunque no termine el OAuth). */
  const guardoKey = useRef(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  const plataforma = plataformaDe(medio);
  const pedir = (action: 'estado' | 'conectar') => fetch('/api/zernio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, plataforma }), signal: AbortSignal.timeout(65_000),
  }).then((r) => r.json()).catch(() => null) as Promise<RespuestaZernio | null>;
  const cerrar = () => { if (guardoKey.current) avisarMedioConectado(); onCerrar(); };

  const conectar = async () => {
    const k = key.trim();
    if (pideKey && !k) return;
    setError(null); setPago(null);
    // La ventana se abre EN el clic (si no, el navegador la bloquea) y después se le pone la URL.
    const ventana = window.open('', 'mako-conectar', 'width=560,height=720');
    setFase('abriendo');
    if (pideKey) {
      const fallo = await guardarKeyZernio(k);
      if (!vivo.current) return;
      if (fallo) { ventana?.close(); setFase('listo'); setError(fallo); return; }
      guardoKey.current = true;
    }
    const res = leerZernio(await pedir('conectar'));
    if (!vivo.current) return;
    if (res.estado !== 'ok' || !res.url) {
      ventana?.close(); setFase('listo');
      // Sin Zernio o con la key mala: el campo, ahí mismo (y vacío: lo que estaba escrito no sirvió).
      if (pideKeyZernio(res)) { setPideKey(true); setKey(''); }
      setError(res.estado === 'sin_zernio' ? ZERNIO_SIN_KEY : res.estado === 'ok' ? 'No se pudo conectar' : res.error);
      if (res.estado === 'pausada') setPago(res.pago);
      return;
    }
    const j = { url: res.url };
    setPideKey(false);
    if (ventana) ventana.location.href = j.url; else window.open(j.url, '_blank', 'noopener');
    setFase('esperando');
    for (let i = 0; i < SONDEO_MAX && vivo.current; i += 1) {
      await new Promise((r) => setTimeout(r, SONDEO_MS));
      if (!vivo.current) return;
      const e = await pedir('estado');
      if (e?.ok && Array.isArray(e.cuentas) && e.cuentas.length > 0) {
        try { ventana?.close(); } catch { /* otra ventana */ }
        setFase('conectado');
        avisarMedioConectado();
        onConectado();
        return;
      }
    }
    if (vivo.current) { setFase('listo'); setError('No llegó la cuenta. Prueba de nuevo.'); }
  };

  return (
    <Modal titulo={`Conectar ${NOMBRE_CANAL[medio]}`} onCerrar={cerrar} ancho={440}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, fontSize: 13.5, color: 'var(--ink)' }}>
        {fase === 'conectado'
          ? <span role="status" style={{ color: 'var(--good)', fontWeight: 600 }}>Conectado ✓</span>
          : fase === 'esperando'
            ? <span role="status" style={{ color: 'var(--dim)' }}>Termina en la ventana que se abrió.</span>
            : (
              <>
                {pideKey && (
                  <TextField label="API key de Zernio" type="password" autoComplete="off" spellCheck={false} data-zernio-key
                    hint="En Zernio: Settings → API Keys" value={key} disabled={fase === 'abriendo'}
                    onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && key.trim()) void conectar(); }}
                    style={{ alignSelf: 'stretch' }} />
                )}
                <Button onClick={() => void conectar()} disabled={fase === 'abriendo' || (pideKey && !key.trim())}>{`Conectar ${NOMBRE_CANAL[medio]}`}</Button>
              </>
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
export function ConectarMedio({ medio, linea = null, nueva = false, dom = null, reemplaza = false, onCerrar, onLinea, onDominio, onConectado, zernio = null }: {
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
  return createPortal(<ConectarSocial medio={medio} inicial={zernio} onCerrar={onCerrar} onConectado={() => onConectado?.()} />, document.body);
}
