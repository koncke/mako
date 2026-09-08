'use client';

// =============================================================================
// EvolutionConnect — chip de estado + modal de conexión por QR del WhatsApp
// NO oficial (Evolution API). Autocontenido: su propio estado/fetching, se
// embebe en el header de la tab WhatsApp junto al chip de Chatwoot.
// =============================================================================
// Flujo: "Conectar" → POST conectar (QR base64) → se pollea el estado cada 3s y
// se refresca el QR cada 20s (los QR de WhatsApp expiran) hasta que engancha.
// Reglas del PDF: es el número de EMPRESA (no oficial). El QR se escanea desde
// WhatsApp → Dispositivos vinculados.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconRefresh, IconWrench } from './_shared/composer-icons';
import { useConfirm } from '../_components/useConfirm';

type Estado = 'desconectado' | 'conectando' | 'conectado' | 'error';
type Qr = { base64: string | null; code: string | null; pairingCode: string | null };
type Resp<T> = { status: number; body: T };
type WhEstado = 'ok' | 'sin_secret' | 'secret_prod' | 'no_registrado' | 'url_distinta' | 'error';

// Explicación de cada estado del espejo de mensajes para el usuario. Los estados
// de ENV (sin_secret/secret_prod/url_distinta) son configuración de despliegue de
// la plataforma: los resuelve el equipo técnico, no el botón "reparar".
const MIRROR_MSG: Record<Exclude<WhEstado, 'ok'>, string> = {
  sin_secret: 'Falta el secret del webhook de Evolution en la configuración de la plataforma. Sin eso los mensajes no llegan a la app — avisa al equipo técnico.',
  secret_prod: 'La app en producción rechaza el secret del webhook: la configuración de la plataforma quedó desalineada. Avisa al equipo técnico y después toca «Reparar espejo».',
  url_distinta: 'La app no responde donde debería: la dirección configurada en la plataforma no es la real. Avisa al equipo técnico.',
  no_registrado: 'El webhook no está activado en este número, por eso no aparecen los chats. Toca «Reparar espejo» para activarlo.',
  error: 'No pude verificar el espejo ahora (Evolution no respondió). Prueba «Reparar espejo».',
};
// Solo estos estados los arregla el botón (los de env los corrige el equipo técnico).
const REPARABLE: WhEstado[] = ['no_registrado', 'error'];

async function apiGet<T>(url: string): Promise<Resp<T>> {
  const r = await fetch(url, { cache: 'no-store' });
  return { status: r.status, body: (await r.json()) as T };
}
async function apiPost<T>(url: string, body: unknown): Promise<Resp<T>> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.json()) as T };
}

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px',
  borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
  fontFamily: "'Geist', sans-serif",
};
const MAX_FALLOS = 5; // tras N fallos seguidos del polling, cortar y avisar

export function EvolutionConnect({ onEstado }: {
  /**
   * Le avisa al padre en qué estado quedó el canal.
   *
   * Existe por el chip «Envío real: ON» de al lado, que estaba en VERDE con el
   * número caído: es verdad sobre el FLAG y falso sobre el SISTEMA. Para que
   * pueda decir la verdad necesita saber esto, y el estado vive acá.
   *
   * `null` = todavía no se sabe. Que el padre reciba `null` y no
   * 'desconectado' es el punto: no puede afirmar nada mientras no sepa.
   */
  onEstado?: (e: Estado | null) => void;
} = {}) {
  const { confirm, confirmNode } = useConfirm();
  const [estado, setEstado] = useState<Estado>('desconectado');
  // ⚠️ ANTES DEL PRIMER FETCH NO SABEMOS NADA, y `estado` arranca en
  // 'desconectado' — o sea que sin esto el chip AFIRMA una desconexión en cada
  // carga de la pantalla, durante el instante que tarda la request. Con el chip
  // viejo (gris, «conectar») eso pasaba desapercibido; con el nuevo, que grita
  // DESCONECTADA en ámbar, sería una falsa alarma en cada F5.
  // «Todavía no pregunté» es un tercer estado y se dice como tal.
  const [cargado, setCargado] = useState(false);
  // ¿El estado que muestro lo MIDIÓ alguien, o es la fila?
  // El sondeo real (traer los grupos) tarda demasiado en una cuenta grande —
  // `mako_ws11` timeoutea a los 30s—, así que el GET le pone 4s de presupuesto y
  // cuando no llega devuelve la fila con `confirmado: false`. Un verde que nadie
  // comprobó no se puede ver igual que uno medido: ese es exactamente el chip
  // que dijo «conectada» sobre una sesión muerta.
  const [confirmado, setConfirmado] = useState(true);
  // Por qué se cayó, cuando se sabe. Un 403/401 de WhatsApp es «te desvinculé»:
  // no vuelve sola y hay que escanear de nuevo. Cualquier otro código es un
  // corte que SÍ puede volver, y ahí mandar a re-escanear seria de más.
  const [caida, setCaida] = useState<{ codigo: number | null; cuando: string | null; desvinculado: boolean } | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [configurado, setConfigurado] = useState(true);
  const [visible, setVisible] = useState(false); // el admin lo ve; setter/closer no (403)
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<Qr | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caido, setCaido] = useState(false); // Evolution no responde tras varios intentos
  const [wh, setWh] = useState<WhEstado | null>(null); // salud del espejo de mensajes
  const [reparando, setReparando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [pedirSync, setPedirSync] = useState(false); // pop-up "¿sincronizar?" al recién conectar
  const [borrando, setBorrando] = useState(false);

  const load = useCallback(async () => {
    try {
      const { status, body } = await apiGet<{ ok: boolean; configurado: boolean; estado: Estado; numero: string | null; confirmado?: boolean; caida?: { codigo: number | null; cuando: string | null; desvinculado: boolean } | null }>('/api/whatsapp/evolution');
      if (status === 403) { setVisible(false); return; }      // setter/closer → sin chip
      setVisible(true);                                        // admin (o error): mostrar chip
      if (body.ok) { setConfigurado(body.configurado); setEstado(body.estado); setNumero(body.numero); setConfirmado(body.confirmado !== false); setCaida(body.caida ?? null); }
      setCargado(true);
    } catch {
      setVisible(true); setEstado('error'); setCargado(true); // fallo de red → chip visible, reintentable
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Un solo lugar avisa al padre: en el efecto y no adentro de cada setEstado,
  // que son cinco y el próximo se olvidaría.
  useEffect(() => { onEstado?.(cargado ? estado : null); }, [estado, cargado, onEstado]);

  // Polling del estado (3s) + refresh del QR (20s) mientras el modal está abierto
  // sin conectar. Con backoff: tras MAX_FALLOS fallos seguidos corta y avisa.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  useEffect(() => {
    if (!open || estado === 'conectado') return;
    let fallos = 0;
    const poll = setInterval(() => {
      void (async () => {
        try {
          const { body } = await apiPost<{ ok: boolean; estado: Estado; numero: string | null }>('/api/whatsapp/evolution', { action: 'estado' });
          if (body.ok && body.estado !== 'error') {
            fallos = 0; setCaido(false);
            // Transición a conectado (recién escaneó el QR) → preguntar si sincronizar.
            if (body.estado === 'conectado' && estadoRef.current !== 'conectado') setPedirSync(true);
            setEstado(body.estado);
            if (body.numero) setNumero(body.numero);
          } else if (++fallos >= MAX_FALLOS) { setCaido(true); }
        } catch { if (++fallos >= MAX_FALLOS) setCaido(true); }
      })();
    }, 3000);
    const refresh = setInterval(() => {
      void (async () => {
        if (estadoRef.current === 'conectado') return;
        try {
          const { body } = await apiPost<{ ok: boolean; qr?: Qr }>('/api/whatsapp/evolution', { action: 'refrescar' });
          if (body.ok && body.qr) { setQr(body.qr); setCaido(false); }
          else setCaido(true); // no se pudo renovar → el QR de pantalla ya venció
        } catch { setCaido(true); }
      })();
    }, 20000);
    return () => { clearInterval(poll); clearInterval(refresh); };
  }, [open, estado]);

  // Salud del espejo de mensajes: al abrir el modal ya conectado, verificamos que
  // el webhook esté activo (si no, los chats no aparecen aunque diga "conectado").
  useEffect(() => {
    if (!open || estado !== 'conectado') { setWh(null); return; }
    let vivo = true;
    void (async () => {
      try {
        const { body } = await apiPost<{ ok: boolean; estado: WhEstado }>('/api/whatsapp/evolution', { action: 'webhook-estado' });
        if (vivo && body.ok) setWh(body.estado);
      } catch { /* sin salud → no mostramos nada, no rompe */ }
    })();
    return () => { vivo = false; };
  }, [open, estado]);

  async function repararMirror() {
    setReparando(true); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; estado: WhEstado; error?: string }>('/api/whatsapp/evolution', { action: 'reparar-webhook' });
      setWh(body.estado);
      if (!body.ok && body.error) setErr(body.error);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setReparando(false); }
  }

  async function sincronizar() {
    setSincronizando(true); setSyncMsg(null); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; chats?: number; mensajes?: number; error?: string }>('/api/whatsapp/evolution', { action: 'sincronizar' });
      if (!body.ok) throw new Error(body.error || 'No se pudo sincronizar');
      setSyncMsg(`Listo: ${body.chats ?? 0} chats · ${body.mensajes ?? 0} mensajes traídos.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSincronizando(false); }
  }

  async function borrarChats() {
    if (!(await confirm('¿Borrar TODOS los chats guardados del WhatsApp no oficial? Empiezas de 0. (No afecta tu WhatsApp; solo el espejo guardado en la app.)'))) return;
    setBorrando(true); setSyncMsg(null); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; borrados?: number; error?: string }>('/api/whatsapp/evolution', { action: 'borrar-chats' });
      if (!body.ok) throw new Error(body.error || 'No se pudo borrar');
      setSyncMsg(`Listo: se borraron ${body.borrados ?? 0} mensajes guardados. Empiezas de 0.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBorrando(false); }
  }

  function cerrar() {
    setOpen(false);
    void load(); // revalida el chip con el estado real al cerrar
  }

  async function abrir() {
    setOpen(true); setBusy(true); setErr(null); setQr(null); setCaido(false);
    try {
      const { body } = await apiPost<{ ok: boolean; error?: string; estado: Estado; qr: Qr }>('/api/whatsapp/evolution', { action: 'conectar' });
      if (!body.ok) throw new Error(body.error || 'No se pudo iniciar la conexión');
      setEstado(body.estado); setQr(body.qr);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function desconectar() {
    if (!(await confirm('¿Desconectar el WhatsApp de empresa? Vas a tener que volver a escanear el QR para reconectar.'))) return;
    setBusy(true); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution', { action: 'desconectar' });
      if (!body.ok) throw new Error(body.error || 'No se pudo desconectar');
      setEstado('desconectado'); setNumero(null); setOpen(false);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!visible) return null;

  const conectado = estado === 'conectado';

  // ⚠️ TRES ESTADOS, NO DOS — Y EL CAÍDO SE TIENE QUE LEER COMO CAÍDO.
  //
  // El chip decía «API no Oficial: conectar» con punto gris sobre fondo neutro,
  // entre «API Oficial» en verde y «Envío real: ON» en verde. El dueño miró esa
  // barra y dijo, textual, «acá me dice que está todo conectado» — con el número
  // caído hacía cinco días y la nutrición fallando en silencio.
  //
  // Tres cosas fallaban a la vez, y cada una sola ya alcanzaba:
  //
  // 1. EL RÓTULO ERA UN INFINITIVO. «conectar» es una invitación, no un estado, y
  //    al lado de dos chips que sí dicen un estado se lee como uno más de la
  //    familia. Un estado se nombra: DESCONECTADA.
  // 2. EL ESTILO ERA NEUTRO. Gris sobre `--surface-2` es el aspecto de «opción
  //    disponible», no el de «esto está roto». Y como el color era el único que
  //    intentaba decirlo, la regla de la casa —«el color nunca es el único
  //    portador»— quedaba violada en las dos puntas: ni el color ni el texto.
  // 3. «no conectado» TAPABA A «no pude preguntarlo». `estado` arranca en
  //    'desconectado' antes del primer fetch y cae en 'error' si la red falla,
  //    así que el chip AFIRMABA una desconexión sobre algo que todavía no sabía.
  //    Ésa es la regla que este repo ya pagó en el onboarding: 'desconocido' no
  //    es 'desconectado', y afirmar lo segundo manda a re-escanear un QR que no
  //    hace falta.
  const chipStyle: CSSProperties = conectado
    ? confirmado
      ? { ...chipBase, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)' }
      // Conectado SEGÚN LA FILA, sin confirmar con WhatsApp: borde punteado y
      // sin el verde pleno. La forma dice que es una lectura de segunda mano.
      : { ...chipBase, background: 'var(--surface-2)', border: '1px dashed var(--good)', color: 'var(--dim)' }
    : !cargado || estado === 'error'
      // No pudimos preguntarlo: ni verde ni rojo. No se afirma nada.
      ? { ...chipBase, background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', color: 'var(--dim)' }
      // Desconectado de verdad, o conectando. Ámbar: pide atención sin gritar
      // como un error del sistema — la sesión se cae sola y es normal.
      : { ...chipBase, background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)' };

  const puntoColor = conectado ? 'var(--good)' : (!cargado || estado === 'error') ? 'var(--faint)' : 'var(--warn)';
  // La fecha en que se desvinculó, dicha como la diría una persona.
  const fechaCaida = caida?.cuando
    ? new Date(caida.cuando).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
    : null;
  const rotulo = conectado
    ? (confirmado
      ? `API no Oficial conectada${numero ? ` · ${numero}` : ''}`
      : 'API no Oficial: conectada según el último registro (sin confirmar)')
    : !cargado ? 'API no Oficial: comprobando…'
      : estado === 'conectando' ? 'API no Oficial: conectando…'
      : estado === 'error' ? 'API no Oficial: no pude comprobarlo'
        : caida?.desvinculado
          // ⚠️ «DESCONECTADA» describe NUESTRO lado y no le dice nada al que lo
          // lee. El dueño vio ese cartel, abrió WhatsApp en su teléfono, lo
          // encontró perfecto y contestó «no entiendo» — y tenía razón: su
          // TELÉFONO estaba bien. Lo que se cayó es el dispositivo vinculado.
          // «Se desvinculó el 3 de septiembre» nombra un hecho que puede ir a
          // comprobar en WhatsApp → Dispositivos vinculados.
          ? `WhatsApp se desvinculó${fechaCaida ? ` el ${fechaCaida}` : ''} — volver a vincular`
          : 'API no Oficial DESCONECTADA — reconectar';

  return (
    <>
      {confirmNode}
      <button onClick={() => { setOpen(true); if (!conectado) void abrir(); }} style={chipStyle}
        title={
          conectado ? `WhatsApp no oficial conectado${numero ? ` (${numero})` : ''}`
            : !cargado ? 'Comprobando el estado del WhatsApp no oficial…'
            : estado === 'error' ? 'No se pudo comprobar el estado del WhatsApp no oficial — puede estar bien'
              : caida?.desvinculado
                ? `WhatsApp cerró la sesión del dispositivo vinculado${fechaCaida ? ` el ${fechaCaida}` : ''}. Tu teléfono está bien — lo que hay que volver a vincular es el dispositivo que usa MaKo (WhatsApp → Dispositivos vinculados). Mientras tanto las secuencias no envían nada.`
                : 'Tu WhatsApp no oficial está desconectado: las secuencias no envían nada. Toca para volver a vincularlo.'
        }>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: puntoColor }} />
        {rotulo}
      </button>

      {open && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>WhatsApp de empresa</div>
              <button onClick={cerrar} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.5, marginBottom: '16px' }}>
              Número no oficial (por QR). En el celular de la empresa: <strong style={{ color: 'var(--ink)' }}>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong> y escanea.
            </div>

            {!configurado && <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px' }}>Evolution API no está configurado en el servidor.</div>}

            {conectado ? (
              <div>
                <div style={{ width: '46px', height: '46px', margin: '0 auto', borderRadius: '50%', background: 'var(--good-bg)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--good)', marginTop: '6px' }}>Conectado</div>
                {numero && <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px', fontFamily: "'Geist Mono', monospace" }}>{numero}</div>}

                {/* Recién conectó → preguntar si querés traer las conversaciones. */}
                {pedirSync && (
                  <div style={{ marginTop: '14px', padding: '13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>¿Traes tus conversaciones ahora?</div>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>Puedes sincronizar los chats que ya tienes en este número, o empezar limpio y que se vayan sumando a medida que escribes/recibes.</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={() => { setPedirSync(false); void sincronizar(); }} disabled={sincronizando} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '9px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: sincronizando ? 0.6 : 1 }}>{sincronizando ? 'Sincronizando…' : <><IconRefresh size={14} /> Sí, sincronizar</>}</button>
                      <button onClick={() => setPedirSync(false)} style={{ padding: '8px 13px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>No, empezar limpio</button>
                    </div>
                  </div>
                )}

                {/* Salud del espejo de mensajes: sin esto, "conectado" pero los chats no aparecen. */}
                {wh === 'ok' && <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--good)', fontWeight: 600 }}>Espejo de mensajes: activo</div>}
                {wh && wh !== 'ok' && (
                  <div style={{ marginTop: '14px', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--warn)' }}>El espejo de mensajes no está activo</div>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>{MIRROR_MSG[wh]}</div>
                    {REPARABLE.includes(wh) && (
                      <button onClick={() => void repararMirror()} disabled={reparando} style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: reparando ? 0.6 : 1 }}>{reparando ? 'Reparando…' : <><IconWrench size={13} /> Reparar espejo</>}</button>
                    )}
                  </div>
                )}

                {/* Sincronizar todo: trae los chats/mensajes de Evolution al espejo
                    A PEDIDO (el inbox no vuelca la agenda entera solo). */}
                <div style={{ marginTop: '16px', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', textAlign: 'left' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink)' }}>Sincronizar conversaciones</div>
                  <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>Trae al inbox los chats que ya tienes en este número. El inbox no baja toda la agenda solo — solo lo que sincronizas o lo que entra/sale desde aquí.</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <button onClick={() => void sincronizar()} disabled={sincronizando} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: sincronizando ? 0.6 : 1 }}>{sincronizando ? 'Sincronizando…' : <><IconRefresh size={14} /> Sincronizar todo</>}</button>
                    <button onClick={() => void borrarChats()} disabled={borrando} title="Borra TODAS las conversaciones guardadas del inbox (no toca tu WhatsApp)" style={{ padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: borrando ? 0.6 : 1 }}>{borrando ? 'Borrando…' : 'Borrar todo el historial'}</button>
                  </div>
                  {syncMsg && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--good)', fontWeight: 600 }}>{syncMsg}</div>}
                </div>

                <button onClick={() => void desconectar()} disabled={busy} style={{ marginTop: '16px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Desconectar'}</button>
              </div>
            ) : caido ? (
              <div>
                <div style={{ fontSize: '34px' }}>⚠️</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--bad)', marginTop: '6px' }}>Evolution no responde</div>
                <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '4px' }}>El servicio de WhatsApp no oficial no está respondiendo ahora mismo.</div>
                <button onClick={() => void abrir()} disabled={busy} style={{ marginTop: '16px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Reintentar</button>
              </div>
            ) : (
              <div>
                <div style={{ width: '260px', height: '260px', margin: '0 auto', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {busy && !qr ? (
                    <span style={{ fontSize: '13px', color: 'var(--dim)' }}>Generando QR…</span>
                  ) : qr?.base64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr.base64} alt="QR de WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--faint)' }}>Sin QR</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '10px' }}>El QR se renueva solo. En cuanto escanees, esta ventana lo detecta.</div>
                <button onClick={() => void abrir()} disabled={busy} style={{ marginTop: '12px', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>↻ Nuevo QR</button>
              </div>
            )}

            {err && <div style={{ marginTop: '14px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '13px' }}>{err}</div>}
          </div>
        </div>
      )}
    </>
  );
}
