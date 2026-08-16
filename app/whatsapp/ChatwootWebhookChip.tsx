'use client';

// =============================================================================
// ChatwootWebhookChip — chip "API Oficial" del header de /whatsapp, ahora con
// salud REAL del webhook de Chatwoot (detección de respuestas del canal oficial).
// =============================================================================
// Antes era un span verde fijo: decía "conectado" aunque el webhook no existiera
// y la nutrición siguiera disparando sobre leads que ya habían contestado. Ahora,
// al montar la tab: chequea la salud (GET) y si el problema es reparable
// (webhook sin registrar / cuenta sin vincular) lo REGISTRA SOLO (auto-repair,
// una vez por montaje). Solo si no puede, muestra el chip en ámbar con un modal
// que explica y deja reintentar. Mismo patrón que EvolutionConnect (espejo).
// Setter/closer (403) y mientras carga: chip verde plano, como siempre.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconWrench } from './_shared/composer-icons';

type WhEstado = 'ok' | 'sin_secret' | 'secret_prod' | 'url_distinta' | 'no_registrado' | 'sin_ruteo' | 'ruteo_ocupado' | 'error';

// Explicación de cada estado para el usuario. Los de ENV (sin_secret/secret_prod/
// url_distinta) son configuración de despliegue de la plataforma: los resuelve el
// equipo técnico, no el botón. ruteo_ocupado es una colisión entre clientes: ídem.
const WH_MSG: Record<Exclude<WhEstado, 'ok'>, string> = {
  sin_secret: 'Falta el secret del webhook de Chatwoot en la configuración de la plataforma. Sin eso la app no se entera cuando un lead responde — avisá al equipo técnico.',
  secret_prod: 'La app en producción rechaza el secret del webhook: la configuración de la plataforma quedó desalineada. Avisá al equipo técnico.',
  url_distinta: 'La app no responde donde debería: la dirección configurada en la plataforma no es la real. Avisá al equipo técnico.',
  no_registrado: 'El webhook no está registrado en tu Chatwoot: cuando un lead responde, la app no se entera (no pausa su nutrición ni te avisa). Tocá «Activar detección» para registrarlo.',
  sin_ruteo: 'Tu cuenta de Chatwoot no está vinculada a este espacio: los mensajes entrantes se descartan. Tocá «Activar detección» para vincularla.',
  ruteo_ocupado: 'El ID de cuenta de Chatwoot ya está vinculado a otro cliente — sus mensajes entrantes le llegarían a él. Avisá al equipo técnico.',
  error: 'No pude verificar la detección de respuestas (Chatwoot no respondió). Tocá «Activar detección» para reintentar.',
};
// Solo estos los arregla el botón; los demás los corrige el equipo técnico.
const REPARABLE: WhEstado[] = ['no_registrado', 'sin_ruteo', 'error'];
// Estados que el chip intenta arreglar SOLO al montar (registro programático).
const AUTO_REPARABLE: WhEstado[] = ['no_registrado', 'sin_ruteo'];

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px',
  borderRadius: '999px', fontSize: '12.5px', fontWeight: 600,
  fontFamily: "'Geist', sans-serif",
};

export function ChatwootWebhookChip() {
  const [salud, setSalud] = useState<WhEstado | null>(null); // null = cargando / sin permiso / sin config
  const [open, setOpen] = useState(false);
  const [reparando, setReparando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoIntentado = useRef(false);

  async function reparar(): Promise<WhEstado | null> {
    try {
      const r = await fetch('/api/whatsapp/chatwoot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reparar-webhook' }),
      });
      const body = (await r.json()) as { ok: boolean; estado?: WhEstado; error?: string };
      if (!body.ok && body.error) setErr(body.error);
      return body.estado ?? null;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/chatwoot', { cache: 'no-store' });
        if (r.status === 403) return; // setter/closer → chip plano, sin salud
        const body = (await r.json()) as { ok: boolean; configurado?: boolean; estado?: WhEstado };
        if (!vivo || !body.ok || !body.configurado || !body.estado) return;
        // Registro programático: si falta el webhook o el vínculo de la cuenta,
        // se arregla solo al abrir la tab — el chip ámbar queda para lo que NO pudo.
        if (AUTO_REPARABLE.includes(body.estado) && !autoIntentado.current) {
          autoIntentado.current = true;
          const tras = await reparar();
          if (vivo) setSalud(tras ?? body.estado);
          return;
        }
        setSalud(body.estado);
      } catch { /* sin salud → chip plano, no rompe la tab */ }
    })();
    return () => { vivo = false; };
  }, []);

  async function repararClick() {
    setReparando(true); setErr(null);
    const tras = await reparar();
    if (tras) setSalud(tras);
    setReparando(false);
  }

  const problema = salud != null && salud !== 'ok';
  const chipStyle: CSSProperties = problema
    ? { ...chipBase, background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', color: 'var(--warn)', cursor: 'pointer' }
    : { ...chipBase, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)' };

  return (
    <>
      {problema ? (
        <button onClick={() => setOpen(true)} style={chipStyle}
          title="La detección de respuestas del WhatsApp oficial necesita atención — tocá para ver">
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--warn)' }} />
          API Oficial: revisar
        </button>
      ) : (
        <span style={chipStyle}
          title={salud === 'ok'
            ? 'Número oficial (Cloud API de Meta) — webhook de respuestas activo'
            : 'Número oficial (Cloud API de Meta) — recibe el tráfico frío de los anuncios'}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--good)' }} />
          API Oficial
        </span>
      )}

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Detección de respuestas</div>
              <button onClick={() => setOpen(false)} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.5, marginBottom: '14px' }}>
              Cuando un lead responde por el WhatsApp oficial, Chatwoot le avisa a la app (webhook): se pausa su nutrición y te llega el aviso. Eso es lo que está fallando.
            </div>

            {salud && salud !== 'ok' ? (
              <div style={{ padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--warn)' }}>La detección no está activa</div>
                <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>{WH_MSG[salud]}</div>
                {REPARABLE.includes(salud) && (
                  <button onClick={() => void repararClick()} disabled={reparando} style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: reparando ? 0.6 : 1 }}>
                    {reparando ? 'Activando…' : <><IconWrench size={13} /> Activar detección</>}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '12.5px', color: 'var(--good)', fontWeight: 600 }}>Detección de respuestas: activa</div>
            )}

            {err && <div style={{ marginTop: '12px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '13px' }}>{err}</div>}
          </div>
        </div>
      )}
    </>
  );
}
