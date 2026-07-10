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

type Estado = 'desconectado' | 'conectando' | 'conectado' | 'error';
type Qr = { base64: string | null; code: string | null; pairingCode: string | null };
type Resp<T> = { status: number; body: T };
type WhEstado = 'ok' | 'sin_secret' | 'secret_prod' | 'no_registrado' | 'url_distinta' | 'error';

// Explicación de cada estado del espejo de mensajes para el usuario. Los estados de
// ENV (sin_secret/secret_prod/url_distinta) se arreglan en Vercel, no con "reparar".
const MIRROR_MSG: Record<Exclude<WhEstado, 'ok'>, string> = {
  sin_secret: 'Falta configurar EVOLUTION_WEBHOOK_SECRET en el servidor (Vercel). Sin eso los mensajes no llegan a la app — avisá al equipo técnico.',
  secret_prod: 'El servidor en producción rechaza el secret del webhook. En Vercel, poné EVOLUTION_WEBHOOK_SECRET (igual al de tu .env) y volvé a desplegar. Después tocá «Reparar espejo».',
  url_distinta: 'El servidor de la app no responde donde debería. Revisá APP_BASE_URL en Vercel (tiene que ser el dominio real de tu app) y volvé a desplegar.',
  no_registrado: 'El webhook no está activado en este número, por eso no aparecen los chats. Tocá «Reparar espejo» para activarlo.',
  error: 'No pude verificar el espejo ahora (Evolution no respondió). Probá «Reparar espejo».',
};
// Solo estos estados los arregla el botón (los de env se corrigen en Vercel).
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

export function EvolutionConnect() {
  const [estado, setEstado] = useState<Estado>('desconectado');
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

  const load = useCallback(async () => {
    try {
      const { status, body } = await apiGet<{ ok: boolean; configurado: boolean; estado: Estado; numero: string | null }>('/api/whatsapp/evolution');
      if (status === 403) { setVisible(false); return; }      // setter/closer → sin chip
      setVisible(true);                                        // admin (o error): mostrar chip
      if (body.ok) { setConfigurado(body.configurado); setEstado(body.estado); setNumero(body.numero); }
    } catch {
      setVisible(true); setEstado('error');                   // fallo de red → chip visible, reintentable
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
    if (!window.confirm('¿Desconectar el WhatsApp de empresa? Vas a tener que volver a escanear el QR para reconectar.')) return;
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
  const chipStyle: CSSProperties = conectado
    ? { ...chipBase, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)' }
    : { ...chipBase, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--dim)' };

  return (
    <>
      <button onClick={() => { setOpen(true); if (!conectado) void abrir(); }} style={chipStyle}
        title={conectado ? `WhatsApp no oficial conectado${numero ? ` (${numero})` : ''}` : 'Conectar el WhatsApp no oficial (API no Oficial)'}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: conectado ? 'var(--good)' : 'var(--faint)' }} />
        {conectado ? `API no Oficial conectada${numero ? ` · ${numero}` : ''}` : 'API no Oficial: conectar'}
      </button>

      {open && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>WhatsApp de empresa</div>
              <button onClick={cerrar} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.5, marginBottom: '16px' }}>
              Número no oficial (por QR). En el celular de la empresa: <strong style={{ color: 'var(--ink)' }}>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong> y escaneá.
            </div>

            {!configurado && <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px' }}>Evolution API no está configurado en el servidor.</div>}

            {conectado ? (
              <div>
                <div style={{ fontSize: '40px' }}>✅</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--good)', marginTop: '6px' }}>Conectado</div>
                {numero && <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px', fontFamily: "'Geist Mono', monospace" }}>{numero}</div>}

                {/* Salud del espejo de mensajes: sin esto, "conectado" pero los chats no aparecen. */}
                {wh === 'ok' && <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--good)', fontWeight: 600 }}>Espejo de mensajes: activo ✅</div>}
                {wh && wh !== 'ok' && (
                  <div style={{ marginTop: '14px', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--warn)' }}>⚠️ El espejo de mensajes no está activo</div>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>{MIRROR_MSG[wh]}</div>
                    {REPARABLE.includes(wh) && (
                      <button onClick={() => void repararMirror()} disabled={reparando} style={{ marginTop: '10px', padding: '7px 13px', borderRadius: '9px', border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: reparando ? 0.6 : 1 }}>{reparando ? 'Reparando…' : '🔧 Reparar espejo'}</button>
                    )}
                  </div>
                )}

                <button onClick={() => void desconectar()} disabled={busy} style={{ marginTop: '18px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Desconectar'}</button>
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
