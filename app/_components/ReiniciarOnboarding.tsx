'use client';

// =============================================================================
// «Reiniciar onboarding» — en la barra de la vista de administrador, al lado de RESET (20/11/2026)
// =============================================================================
// Martín: «una opción en SuperAdmin para resetear al usuario sin que pierda su información… que pueda resetear el onboarding».
// RESET (PanelAgencia) vacía el negocio entero y sólo existe en el Cliente de Prueba. Éste borra SÓLO el estado del onboarding y
// del reto (lib/reiniciar-onboarding.ts dice qué sí y qué no), así que va en cualquier cliente que el super admin esté mirando.
// Quién puede lo decide el server (/api/admin/reiniciar-onboarding: super admin, nunca el negocio del dueño).
//
// Después de reiniciar dice que quedó y lleva al onboarding del negocio (20/11, el Cerebro: «no da ninguna señal y deja la pantalla
// como estaba»). Con navegación COMPLETA (`location.assign`, con el `?ws=` de la pestaña): la pantalla de antes ya no vale.
// ⚠️ Mirándolo como administrador, cada paso que se TOCA avanza el onboarding DEL CLIENTE (el arranque se guarda en el negocio).
//
// ⚠️ La confirmación va en un panel FLOTANTE debajo del botón, no en la barra (medido a 1440 y 375 el 20/11): escrita en la barra la
// estiraba a 87 px, y la página sólo descuenta 50 (`--barra-agencia`, app/globals.css), así que tapaba lo de arriba de la pantalla.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { AvisoFlotante } from './AvisoFlotante';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const ID_PANEL = 'reiniciar-onboarding-panel';

const chip: CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap',
};

/** Lo que dice la confirmación: qué vuelve a empezar y qué NO se toca. */
export const TEXTO_REINICIAR = 'Vuelve a empezar el onboarding y el reto de 7 días. No borra nada de lo suyo: leads y CRM, cursos, automatizaciones, funnels, ofertas, conversaciones, archivos, plan y cobros quedan como están. Su WhatsApp sigue verificado.';

export function ReiniciarOnboarding({ cliente }: { cliente: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; ancho: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hecho, setHecho] = useState(false);
  const ws = useWs();
  const [aviso, setAviso] = useState<{ texto: string; tono: 'info' | 'error' } | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);

  function abrir() {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const ancho = Math.min(380, vw - 24);
    // Alineado al borde derecho del botón, sin salirse de la pantalla por ningún lado (12 px de margen).
    setPos({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(12, Math.min(vw - r.right, vw - ancho - 12))), ancho });
    setConfirmar(true);
  }

  // Se cierra con Escape, con un clic afuera o si la ventana cambia de tamaño (la posición medida queda vieja). Nunca a mitad del pedido.
  useEffect(() => {
    if (!confirmar || busy) return;
    const cerrar = () => setConfirmar(false);
    const fuera = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(`#${ID_PANEL}`) || (t && btn.current?.contains(t))) return;
      cerrar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', cerrar);
    };
  }, [confirmar, busy]);

  async function reiniciar() {
    setBusy(true); setAviso(null);
    try {
      const r = await fetch('/api/admin/reiniciar-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aplicar: true }),
      });
      const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!j.ok) { setAviso({ texto: j.error || 'No se pudo reiniciar el onboarding.', tono: 'error' }); setBusy(false); return; }
      // Lo dice el MISMO panel (a la vista, donde se tocó), y lleva al onboarding. `busy` queda prendido: no se vuelve a tocar.
      setHecho(true);
      setTimeout(() => window.location.assign(conWs('/onboarding', ws)), 1200);
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo reiniciar el onboarding.', tono: 'error' });
      setBusy(false);
    }
  }

  return (
    <>
      <button ref={btn} type="button" onClick={() => (confirmar ? setConfirmar(false) : abrir())} title={TEXTO_REINICIAR}
        aria-expanded={confirmar} aria-controls={confirmar ? ID_PANEL : undefined} style={chip}>
        Reiniciar onboarding
      </button>
      {confirmar ? (
        pos && createPortal(
          <div id={ID_PANEL} role="dialog" aria-label={`Reiniciar el onboarding de ${cliente}`} style={{
            position: 'fixed', top: pos.top, right: pos.right, width: pos.ancho, zIndex: 3000, boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 18px 44px rgba(23,21,17,.32)', padding: '14px 16px', fontFamily: SANS,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>
              {hecho ? `Listo: el onboarding de ${cliente} empieza de cero.` : `¿Reiniciar el onboarding de ${cliente}?`}
            </div>
            <p role={hecho ? 'status' : undefined} style={{ margin: '6px 0 14px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
              {hecho ? 'No se borró nada de lo suyo. Te llevo a su onboarding…' : TEXTO_REINICIAR}
            </p>
            {!hecho && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="mk-btn mk-btn--sm mk-btn--secondary" onClick={() => setConfirmar(false)} disabled={busy}>No</button>
              <button type="button" className="mk-btn mk-btn--sm mk-btn--primary" onClick={() => void reiniciar()} disabled={busy}>
                {busy ? 'Reiniciando…' : 'Sí, reiniciar'}
              </button>
            </div>}
          </div>,
          document.body,
        )
      ) : null}
      {aviso && <AvisoFlotante mensaje={aviso.texto} tono={aviso.tono} onCerrar={() => setAviso(null)} />}
    </>
  );
}
